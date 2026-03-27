import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from collections import deque
from PIL import Image
from io import BytesIO
import json
from tqdm import tqdm
import time
import hashlib

# ---------------- CONFIG ----------------
start_url      = "https://en.wikipedia.org/wiki/Balen_Shah"  # Change anytime
allowed_domain = "en.wikipedia.org"

output_dir = "wikipedia_scrape"
os.makedirs(output_dir, exist_ok=True)
os.makedirs(os.path.join(output_dir, "images"), exist_ok=True)
os.makedirs(os.path.join(output_dir, "meta"), exist_ok=True)

STATE_FILE = os.path.join(output_dir, "crawl_state.json")

HEADERS = {
    "User-Agent": "Mozilla/5.0 WikipediaCrawler/3.0"
}

# ---------------- STATE ----------------
def load_state():
    """Load previous crawl state, compute next_page_id from meta files."""
    meta_dir = os.path.join(output_dir, "meta")
    existing_files = [
        f for f in os.listdir(meta_dir)
        if f.startswith("meta_") and f.endswith(".json")
    ]

    if existing_files:
        ids = [int(f.split("_")[1].split(".")[0]) for f in existing_files]
        next_page_id = max(ids) + 1
    else:
        next_page_id = 0

    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            state = json.load(f)

        visited = set(state["visited"])
        downloaded_images = set(state["downloaded_images"])
        queue = deque(state["queue"])
        page_count = state["page_count"]
        image_count = state["image_count"]

        print(f"[resume] {len(visited)} visited | {page_count} pages | "
              f"{image_count} images | next_id={next_page_id}")

        # Inject new start URL immediately
        if start_url not in visited:
            queue.appendleft(start_url)

        return visited, downloaded_images, queue, page_count, image_count, next_page_id

    print("[fresh] Starting new crawl...")
    return set(), set(), deque([start_url]), 0, 0, next_page_id


def save_state(visited, downloaded_images, queue, page_count, image_count, next_page_id):
    """Save current crawler state."""
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "visited": list(visited),
            "downloaded_images": list(downloaded_images),
            "queue": list(queue),
            "page_count": page_count,
            "image_count": image_count,
            "next_page_id": next_page_id,
        }, f, ensure_ascii=False)


# ---------------- SCRAPER ----------------
def extract_content_and_links(url, page_id, downloaded_images, image_count):
    """Scrape page content, images, and links."""
    content_blocks = []
    links = set()

    response = requests.get(url, headers=HEADERS, timeout=10)
    if response.status_code != 200:
        raise Exception(f"HTTP {response.status_code}")

    soup = BeautifulSoup(response.content, "html.parser")
    title = soup.title.string.strip() if soup.title else "No Title"

    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    current_section = ""
    for tag in soup.find_all(["h1", "h2", "h3", "p", "img"]):
        if tag.name in ["h1", "h2", "h3"]:
            current_section = tag.get_text().strip()

        elif tag.name == "p":
            text = tag.get_text().strip()
            if text:
                content_blocks.append({
                    "type": "text",
                    "section": current_section,
                    "content": text,
                })

        elif tag.name == "img" and tag.has_attr("src"):
            img_url = urljoin(url, tag["src"])

            if not any(img_url.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png"]):
                continue
            if img_url in downloaded_images:
                continue

            try:
                img_res = requests.get(img_url, headers=HEADERS, timeout=10)
                img = Image.open(BytesIO(img_res.content)).convert("RGB")

                if img.width < 100 or img.height < 100:
                    continue

                # ---------------- Unique filename ----------------
                url_hash = hashlib.md5(img_url.encode("utf-8")).hexdigest()[:12]
                img_name = f"{page_id}_{url_hash}.jpg"
                img_path = os.path.join(output_dir, "images", img_name)

                if not os.path.exists(img_path):
                    img.save(img_path)

                caption = tag.get("alt") or tag.get("title") or "No caption"

                content_blocks.append({
                    "type": "image",
                    "section": current_section,
                    "filename": img_name,
                    "caption": caption,
                })

                downloaded_images.add(img_url)
                image_count += 1

            except:
                continue

    # ---------------- LINKS ----------------
    for a in soup.find_all("a", href=True):
        full_url = urljoin(url, a["href"])
        parsed = urlparse(full_url)

        if (
            parsed.netloc == allowed_domain
            and parsed.scheme.startswith("http")
            and "/wiki/" in parsed.path
        ):
            path = parsed.path.lower()
            if any(x in path for x in [
                "file:", "category:", "help:", "special:", "talk:"
            ]):
                continue
            links.add(full_url)

    # ---------------- SAVE META ----------------
    meta_path = os.path.join(output_dir, "meta", f"meta_{page_id}.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({
            "page_id": page_id,
            "url": url,
            "title": title,
            "content": content_blocks
        }, f, indent=2, ensure_ascii=False)

    return title, links, downloaded_images, image_count


# ---------------- CRAWLER ----------------
def bfs_crawl():
    visited, downloaded_images, queue, page_count, image_count, next_page_id = load_state()

    try:
        pages_this_run = int(input("How many pages to crawl this run? "))
    except:
        pages_this_run = 50
        print("Invalid input → default 50")

    run_count = 0

    with tqdm(total=pages_this_run, desc="Crawling") as pbar:
        while queue and run_count < pages_this_run:
            current = queue.popleft()

            if current in visited:
                continue

            visited.add(current)

            try:
                title, links, downloaded_images, image_count = extract_content_and_links(
                    current, next_page_id, downloaded_images, image_count
                )

                pbar.set_description(f"Scraped: {title[:50]}")
                pbar.update(1)

                page_count += 1
                run_count += 1
                next_page_id += 1

            except Exception as e:
                print(f"[!] Failed: {current} ({e})")
                continue

            # Add new links to queue
            for link in links:
                if link not in visited and link not in queue:
                    queue.append(link)

            # Save after every page
            save_state(visited, downloaded_images, queue, page_count, image_count, next_page_id)

            time.sleep(0.5)  # polite to Wikipedia

    print("\n✅ Run complete")
    print(f"➡ Crawled this run: {run_count}")
    print(f"➡ Total pages: {page_count}")
    print(f"➡ Total images: {image_count}")
    print(f"➡ Queue size: {len(queue)}")
    print(f"➡ State saved in: {STATE_FILE}")


# ---------------- RUN ----------------
if __name__ == "__main__":
    bfs_crawl()