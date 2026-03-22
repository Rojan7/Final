# single_file_crawler.py

import asyncio
import json
import logging
import time
from collections import deque
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse, urljoin
from urllib.robotparser import RobotFileParser

import aiohttp
from bs4 import BeautifulSoup
import hashlib

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("crawler")

# ---------------- SETTINGS ----------------
class Settings:
    crawl_user_agent = "MyCrawlerBot/1.0"
    crawl_rate_limit_seconds = 1.0
    crawl_timeout_seconds = 20
    crawl_concurrency = 5
    images_dir = Path("./images")
    data_dir = Path("./data")
    images_dir.mkdir(exist_ok=True)
    data_dir.mkdir(exist_ok=True)


# ---------------- UTILS ----------------
def canonicalize_url(url: str) -> str:
    return url.strip().split("#")[0]

def clean_text(text: str) -> str:
    return " ".join(text.split())

def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()

def stable_id(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()

def safe_join(base: str, href: str) -> str:
    return urljoin(base, href)

def filename_from_hash(sha: str, ext: str) -> str:
    return f"{sha}{ext}"


# ---------------- DOMAIN RATE LIMITER ----------------
class DomainRateLimiter:
    def __init__(self, min_delay_seconds: float):
        self.min_delay_seconds = min_delay_seconds
        self._last_hit: dict[str, float] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    async def wait(self, domain: str) -> None:
        lock = self._locks.setdefault(domain, asyncio.Lock())
        async with lock:
            now = time.monotonic()
            last_hit = self._last_hit.get(domain, 0.0)
            delay = self.min_delay_seconds - (now - last_hit)
            if delay > 0:
                await asyncio.sleep(delay)
            self._last_hit[domain] = time.monotonic()


# ---------------- ROBOTS CACHE ----------------
class RobotsCache:
    def __init__(self):
        self._cache: dict[str, RobotFileParser] = {}

    async def can_fetch(self, session: aiohttp.ClientSession, user_agent: str, url: str) -> bool:
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        robots_url = f"{origin}/robots.txt"
        parser = self._cache.get(origin)
        if parser is None:
            parser = RobotFileParser()
            parser.set_url(robots_url)
            try:
                async with session.get(robots_url, timeout=10) as response:
                    if response.status == 200:
                        text = await response.text()
                        parser.parse(text.splitlines())
                    else:
                        parser.parse([])
            except Exception:
                parser.parse([])
            self._cache[origin] = parser
        return parser.can_fetch(user_agent, url)


# ---------------- CRAWLER ----------------
class AsyncCrawler:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.rate_limiter = DomainRateLimiter(settings.crawl_rate_limit_seconds)
        self.robots_cache = RobotsCache()
        self.seen_urls: set[str] = set()
        self.seen_images: dict[str, str] = {}

    async def crawl(self, seed_urls: Iterable[str], max_pages: int = 100):
        seed_urls = [canonicalize_url(url) for url in seed_urls]
        queue = deque(seed_urls)
        queued_set = set(queue)
        pages_crawled = 0
        skipped = 0
        saved_images = 0

        session_timeout = aiohttp.ClientTimeout(total=self.settings.crawl_timeout_seconds)
        async with aiohttp.ClientSession(timeout=session_timeout, headers={"User-Agent": self.settings.crawl_user_agent}) as session:
            while queue and pages_crawled < max_pages:
                batch = []
                while queue and len(batch) < self.settings.crawl_concurrency and pages_crawled + len(batch) < max_pages:
                    url = queue.popleft()
                    queued_set.discard(url)
                    if url in self.seen_urls:
                        skipped += 1
                        continue
                    batch.append(url)

                if not batch:
                    continue

                tasks = [self._crawl_single(session, url) for url in batch]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for result in results:
                    if isinstance(result, Exception):
                        logger.exception("Crawler task failed", exc_info=result)
                        skipped += 1
                        continue
                    if result is None:
                        skipped += 1
                        continue
                    page, discovered_links, image_saves = result
                    pages_crawled += 1
                    saved_images += image_saves
                    self.seen_urls.add(page["url"])

                    # save page JSON
                    with open(self.settings.data_dir / f"{page['id']}.json", "w", encoding="utf-8") as f:
                        json.dump(page, f, ensure_ascii=False, indent=2)

                    # queue discovered links
                    for link in discovered_links:
                        if link not in self.seen_urls and link not in queued_set:
                            queue.append(link)
                            queued_set.add(link)

        logger.info("Crawl complete: crawled=%d, skipped=%d, images=%d", pages_crawled, skipped, saved_images)

    async def _crawl_single(self, session: aiohttp.ClientSession, url: str):
        parsed = urlparse(url)
        await self.rate_limiter.wait(parsed.netloc)

        if not await self.robots_cache.can_fetch(session, self.settings.crawl_user_agent, url):
            logger.info("Disallowed by robots.txt: %s", url)
            return None

        try:
            async with session.get(url) as response:
                if response.status != 200 or "text/html" not in response.headers.get("Content-Type", ""):
                    return None
                html = await response.text()
        except Exception:
            logger.exception("Failed to fetch page %s", url)
            return None

        soup = BeautifulSoup(html, "html.parser")
        title = clean_text(soup.title.get_text()) if soup.title else url
        sections = self._extract_sections(soup, url)
        if not sections:
            return None

        downloaded_images = 0
        for section in sections:
            if section["type"] != "image" or not section["image_url"]:
                continue
            filename, was_downloaded = await self._download_image(session, section["image_url"])
            if filename:
                if was_downloaded:
                    downloaded_images += 1
                section["image_filename"] = filename
            else:
                section["image_url"] = None
                section["image_filename"] = None

        sections = [s for s in sections if s["type"] == "text" or s.get("image_filename")]
        if not sections:
            return None

        page = {
            "id": stable_id(url),
            "url": url,
            "title": title,
            "sections": sections
        }

        links = self._extract_links(soup, url)
        logger.info("Crawled %s with %d sections", url, len(sections))
        return page, links, downloaded_images

    def _extract_sections(self, soup: BeautifulSoup, base_url: str):
        main = soup.find("main") or soup.body or soup
        sections = []
        current_heading = None
        for element in main.find_all(["h1", "h2", "h3", "p", "li", "img", "figure"], limit=300):
            if element.name in {"h1", "h2", "h3"}:
                current_heading = clean_text(element.get_text())
                continue
            if element.name in {"p", "li"}:
                text = clean_text(element.get_text(" ", strip=True))
                if len(text) >= 40:
                    sections.append({"type": "text", "heading": current_heading, "text": text})
                continue
            if element.name == "figure":
                img = element.find("img")
                if not img:
                    continue
                caption = clean_text(element.find("figcaption").get_text()) if element.find("figcaption") else None
                src = self._choose_largest_image(img)
                if src:
                    sections.append({"type": "image", "heading": current_heading, "image_url": safe_join(base_url, src), "caption": caption or clean_text(img.get("alt"))})
                continue
            if element.name == "img":
                src = self._choose_largest_image(element)
                if src:
                    sections.append({"type": "image", "heading": current_heading, "image_url": safe_join(base_url, src), "caption": clean_text(element.get("alt"))})
        # Deduplicate
        deduped = []
        seen_texts, seen_imgs = set(), set()
        for s in sections:
            if s["type"] == "text":
                key = s["text"]
                if key in seen_texts:
                    continue
                seen_texts.add(key)
            if s["type"] == "image":
                key = s["image_url"]
                if key in seen_imgs:
                    continue
                seen_imgs.add(key)
            deduped.append(s)
        return deduped

    def _choose_largest_image(self, img_tag):
        srcset = img_tag.get("srcset")
        if srcset:
            candidates = []
            for item in srcset.split(","):
                parts = item.strip().split()
                if len(parts) == 2 and parts[1].endswith("w"):
                    try:
                        width = int(parts[1][:-1])
                        candidates.append((width, parts[0]))
                    except ValueError:
                        continue
            if candidates:
                candidates.sort(reverse=True)
                return candidates[0][1]
        return img_tag.get("src")

    def _extract_links(self, soup: BeautifulSoup, base_url: str):
        links = []
        for a in soup.find_all("a", href=True, limit=200):
            url = safe_join(base_url, a["href"])
            parsed = urlparse(url)
            if parsed.scheme in {"http", "https"}:
                links.append(url)
        return links

    async def _download_image(self, session: aiohttp.ClientSession, image_url: str):
        if image_url in self.seen_images:
            return self.seen_images[image_url], False
        parsed = urlparse(image_url)
        await self.rate_limiter.wait(parsed.netloc)
        try:
            async with session.get(image_url) as response:
                if response.status != 200:
                    return None, False
                content_type = response.headers.get("Content-Type", "")
                if not content_type.startswith("image/"):
                    return None, False
                payload = await response.read()
        except Exception:
            logger.exception("Failed image %s", image_url)
            return None, False
        sha_value = sha256_bytes(payload)
        ext = Path(parsed.path).suffix or f".{content_type.split('/')[-1]}"
        filename = filename_from_hash(sha_value, ext)
        image_path = self.settings.images_dir / filename
        was_downloaded = not image_path.exists()
        if was_downloaded:
            image_path.write_bytes(payload)
        self.seen_images[image_url] = filename
        return filename, was_downloaded


# ---------------- RUN ----------------
if __name__ == "__main__":
    seed_urls = ["https://en.wikipedia.org/wiki/Nepal"]
    crawler = AsyncCrawler(Settings())
    asyncio.run(crawler.crawl(seed_urls, max_pages=100))