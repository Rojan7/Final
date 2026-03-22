# backend/main.py
from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image
import io

from backend.search import unified_text_search, unified_image_search

app = FastAPI(title="Multimodal Search API")

# -------------------- CORS --------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- Static Images --------------------
app.mount(
    "/wikipedia_scrape/images",
    StaticFiles(directory="wikipedia_scrape/images"),
    name="images",
)

# -------------------- Health --------------------
@app.get("/health")
def health():
    return {"status": "ok"}

# -------------------- Text search --------------------
@app.get("/search")
def search(
    q: str = Query(..., min_length=1, description="Search query"),
    k: int = Query(default=5, ge=1, le=50, description="Number of results"),
):
    """
    Text query → ranked text results + ranked image results.
    Uses BGE retrieval + CrossEncoder reranking for text,
    and CLIP + CrossEncoder caption fusion for images.
    """
    return unified_text_search(q, k)

# -------------------- Image search --------------------
# Single canonical endpoint. The two routes below are kept for
# backwards-compatibility but both call the same handler.

async def _run_image_search(file: UploadFile, k: int) -> dict:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=422, detail="Could not decode image. Ensure the file is a valid image format.")
    return unified_image_search(image, k)

@app.post("/search/image")
async def image_search(
    file: UploadFile = File(...),
    k: int = Query(default=5, ge=1, le=50),
):
    """
    Image query → ranked text results + ranked image results.
    Uses CLIP image embedding against the unified CLIP index (no dimension mismatch).
    """
    return await _run_image_search(file, k)

@app.post("/search/image/unified")
async def image_search_unified(
    file: UploadFile = File(...),
    k: int = Query(default=5, ge=1, le=50),
):
    """Alias of /search/image — kept for backwards compatibility."""
    return await _run_image_search(file, k)
