import os
import json
import time
import requests
from io import BytesIO
from PIL import Image
from tqdm import tqdm
from playwright.sync_api import sync_playwright

# ---------------- CONFIG ----------------
BASE_URL = "https://www.daraz.com.np/catalog/?q=mens+shoes&page="
MAX_PAGES = 5

OUT_DIR = "daraz_shoes"
IMG_DIR = os.path.join(OUT_DIR, "images")
os.makedirs(IMG_DIR, exist_ok=True)

# ---------------- IMAGE SAVE ----------------
def save_image(url, idx):
    try:
        r = requests.get(url, timeout=10)
        img = Image.open(BytesIO(r.content)).convert("RGB")
        name = f"image_{idx}.jpg"
        img.save(os.path.join(IMG_DIR, name))
        return name
    except:
        return None

# ---------------- SCRAPER ----------------
def scrape():
    all_pages = []
    img_id = 1

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            )
        )

        for page_num in tqdm(range(1, MAX_PAGES + 1), desc="Scraping Daraz"):
            url = BASE_URL + str(page_num)
            page.goto(url, wait_until="networkidle", timeout=60000)
            time.sleep(3)

            # 🔑 Daraz embeds products as JSON
            scripts = page.query_selector_all("script[type='application/ld+json']")

            products = []

            for s in scripts:
                try:
                    data = json.loads(s.inner_text())
                except:
                    continue

                if isinstance(data, dict) and "itemListElement" in data:
                    for item in data["itemListElement"]:
                        prod = item.get("item", {})
                        name = prod.get("name")
                        link = prod.get("url")
                        image = prod.get("image")
                        offers = prod.get("offers", {})
                        price = offers.get("price")

                        if not name or not image:
                            continue

                        img_name = save_image(image, img_id)
                        img_id += 1

                        products.append({
                            "title": name,
                            "price": price,
                            "url": link,
                            "image": img_name
                        })

            all_pages.append({
                "page": page_num,
                "url": url,
                "product_count": len(products),
                "products": products
            })

            time.sleep(2)

        browser.close()

    with open(os.path.join(OUT_DIR, "daraz_shoes.json"), "w", encoding="utf-8") as f:
        json.dump(all_pages, f, indent=2, ensure_ascii=False)

    print("✅ Scraping completed successfully")

# ---------------- RUN ----------------
if __name__ == "__main__":
    scrape()
