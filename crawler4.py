import os
import cloudscraper
import hashlib
import json
import time
import random
from pathlib import Path
from bs4 import BeautifulSoup
from PIL import Image
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse

# --- CONFIG ---
START_URL = "https://en.wikipedia.org/wiki/Nepal"
OUT = Path("wikipedia_scrape")
MAX_PAGES = 1000
WORKERS = 150  # Increased workers for higher parallelism

(OUT / "images").mkdir(parents=True, exist_ok=True)
(OUT / "meta").mkdir(parents=True, exist_ok=True)

# Shared Thread-Safe resources
visited = set()
downloaded_images = set()
scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False})

def download_image(img_tag, page_url):
    """Finds the best available source (srcset, data-src, or src) and saves it."""
    try:
        # 1. Wikipedia 'srcset' usually has the 1.5x or 2x high-res versions
        src = None
        srcset = img_tag.get("srcset")
        if srcset:
            # Pick the highest resolution (usually the last one in the comma-separated list)
            src = srcset.split(",")[-1].strip().split(" ")[0]
        else:
            src = img_tag.get("data-src") or img_tag.get("src")

        if not src: return None
        if src.startswith("//"): src = "https:" + src
        img_url = urljoin(page_url, src)

        # 2. Filter out UI noise and SVGs (Pillow doesn't support SVGs natively)
        if any(x in img_url.lower() for x in ['.svg', '.gif', 'static', 'icon', 'symbol', 'blank']):
            return None

        # 3. Request Image
        img_res = scraper.get(img_url, timeout=5)
        if img_res.status_code == 200:
            img = Image.open(BytesIO(img_res.content))
            
            # Lowered threshold to 50x50 to capture smaller but relevant inline photos
            if img.width < 50 or img.height < 50:
                return None
            
            # Save with unique hash
            img_hash = hashlib.md5(img_url.encode()).hexdigest()[:12]
            fname = f"img_{img_hash}.jpg"
            img.convert("RGB").save(OUT / "images" / fname, "JPEG")
            return fname
    except:
        return None

def process_page(url, index):
    """Scrapes text, all available images, and finds new links."""
    try:
        # Prevent simultaneous burst requests
        time.sleep(random.uniform(0.1, 0.4))
        
        resp = scraper.get(url, timeout=10)
        if resp.status_code != 200: return url, []

        soup = BeautifulSoup(resp.text, "html.parser")
        body = soup.find(id="mw-content-text")
        if not body: return url, []

        page_data = {
            "page_id": index,
            "url": url,
            "title": soup.find(id="firstHeading").text if soup.find(id="firstHeading") else "No Title",
            "content": []
        }

        # 1. Aggressive Image Scraping (No limits, check all attributes)
        for img_tag in body.find_all("img"):
            fname = download_image(img_tag, url)
            if fname:
                page_data["content"].append({
                    "type": "image", 
                    "filename": fname,
                    "alt": img_tag.get("alt", "")
                })

        # 2. Text Scraping (First 20 paragraphs)
        for p in body.find_all("p", limit=20):
            text = p.get_text().strip()
            if len(text) > 40:
                page_data["content"].append({"type": "text", "data": text})

        # 3. Write Meta
        with open(OUT / "meta" / f"meta_{index}.json", "w", encoding="utf-8") as f:
            json.dump(page_data, f, indent=2, ensure_ascii=False)

        # 4. Extract Links
        links = []
        for a in body.select('a[href^="/wiki/"]'):
            href = a['href']
            # Avoid technical pages and Main Page
            if ":" not in href and "Main_Page" not in href:
                links.append(urljoin("https://en.wikipedia.org", href))
        
        return url, links

    except Exception as e:
        return url, []

def main():
    queue = [START_URL]
    total_scraped = 0
    
    print(f"[*] Starting Aggressive Parallel Scrape ({WORKERS} threads)...")

    while total_scraped < MAX_PAGES and queue:
        # Pull next batch
        current_batch = []
        while queue and len(current_batch) < (MAX_PAGES - total_scraped):
            link = queue.pop(0)
            if link not in visited:
                visited.add(link)
                current_batch.append(link)

        if not current_batch: break

        # Execute threads
        with ThreadPoolExecutor(max_workers=WORKERS) as executor:
            futures = {executor.submit(process_page, url, total_scraped + i): url 
                       for i, url in enumerate(current_batch)}
            
            for future in as_completed(futures):
                try:
                    _, new_links = future.result()
                    if new_links:
                        queue.extend(new_links)
                    total_scraped += 1
                    print(f"[+] Total Pages: {total_scraped}/{MAX_PAGES}", end="\r")
                except:
                    continue

    print(f"\n[DONE] Check '{OUT}' folder. Images are in '{OUT}/images'.")

if __name__ == "__main__":
    main()