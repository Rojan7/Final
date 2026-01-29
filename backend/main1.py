from fastapi import FastAPI, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io

from backend.search import search_text, search_image, search_unified_by_image

app = FastAPI(title="Multimodal Search API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static mount for images
from fastapi.staticfiles import StaticFiles
app.mount("/wikipedia_scrape/images", StaticFiles(directory="wikipedia_scrape/images"), name="images")

# ----- Unified text search -----
@app.get("/search")
def unified_text_search(q: str = Query(..., min_length=1), k: int = 5):
    return search_text_and_images(q, k)

def search_text_and_images(query: str, k=5):
    from backend.search import search_unified
    return search_unified(query, k)


# ----- Unified image search -----
@app.post("/search/image/unified")
async def unified_image_search(file: UploadFile = File(...), k: int = 5):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    results = search_unified_by_image(image, k)
    return results
