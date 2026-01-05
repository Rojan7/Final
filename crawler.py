import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from collections import deque
from PIL import Image
from io import BytesIO
import json
from tqdm import tqdm

# ---------------- CONFIG ----------------
start_url = "https://en.wikipedia.org/wiki/Kallang_Field"
allowed_domain = "en.wikipedia.org"
max_pages = 400

output_dir = "wikipedia_scrape"
os.makedirs(output_dir, exist_ok=True)
os.makedirs(os.path.join(output_dir, "images"), exist_ok=True)
os.makedirs(os.path.join(output_dir, "meta"), exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) WikipediaCrawler/1.0"
}

# ---------------- COUNTERS ----------------
page_count = 1
image_count = 1


# ---------------- SCRAPE PAGE ----------------
def extract_content(url, page_id):
    global image_count

    response = requests.get(url, headers=HEADERS, timeout=10)
    if response.status_code != 200:
        raise Exception(f"HTTP {response.status_code}")

    soup = BeautifulSoup(response.content, "html.parser")

    title = soup.title.string.strip() if soup.title else "No Title"

    # Remove scripts/styles
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    content_blocks = []
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
                    "content": text
                })

        elif tag.name == "img" and tag.has_attr("src"):
            img_url = urljoin(url, tag["src"])

            if not any(img_url.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png"]):
                continue

            try:
                img_res = requests.get(img_url, headers=HEADERS, timeout=10)
                img = Image.open(BytesIO(img_res.content))

                if img.width < 100 or img.height < 100:
                    continue

                img_name = f"image_{image_count}.jpg"
                img_path = os.path.join(output_dir, "images", img_name)
                img.convert("RGB").save(img_path)

                caption = tag.get("alt") or tag.get("title") or "No caption"

                content_blocks.append({
                    "type": "image",
                    "section": current_section,
                    "filename": img_name,
                    "caption": caption
                })

                image_count += 1

            except:
                continue

    metadata = {
        "page_id": page_id,
        "url": url,
        "title": title,
        "content": content_blocks
    }

    meta_file = os.path.join(output_dir, "meta", f"meta_{page_id}.json")
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    return title


# ---------------- EXTRACT LINKS ----------------
def extract_links(url):
    links = set()

    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(response.content, "html.parser")

        for a in soup.find_all("a", href=True):
            href = a["href"]
            full_url = urljoin(url, href)
            parsed = urlparse(full_url)

            if parsed.netloc == allowed_domain and parsed.scheme.startswith("http"):
                if "/wiki/" in parsed.path and ":" not in parsed.path.split("/wiki/")[-1]:
                    links.add(full_url)

    except:
        pass

    return links


# ---------------- BFS CRAWLER ----------------
def bfs_crawl(start_url, max_pages):
    global page_count

    visited = set()
    queue = deque([start_url])

    with tqdm(total=max_pages, desc="Crawling Wikipedia") as pbar:
        while queue and page_count <= max_pages:
            current = queue.popleft()

            if current in visited:
                continue

            visited.add(current)

            try:
                title = extract_content(current, page_count)
                pbar.set_description(f"Scraped: {title[:50]}")
                pbar.update(1)
                page_count += 1

            except Exception as e:
                print(f"[!] Failed: {current} ({e})")
                continue

            for link in extract_links(current):
                if link not in visited:
                    queue.append(link)


# ---------------- RUN ----------------
if __name__ == "__main__":
    bfs_crawl(start_url, max_pages)
