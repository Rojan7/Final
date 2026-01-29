# backend/main.py
from fastapi import FastAPI, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List
from PIL import Image
import io

from backend.search import unified_text_search, unified_image_search, refine_search

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
    name="images"
)

# -------------------- Endpoints --------------------
@app.get("/search")
def search(q: str = Query(..., min_length=1), k: int = 5):
    return unified_text_search(q, k)

@app.post("/search/image/unified")
async def image_search(file: UploadFile = File(...), k: int = 5):
    image = Image.open(io.BytesIO(await file.read())).convert("RGB")
    return unified_image_search(image, k)

class RefineRequest(BaseModel):
    base_embedding: List[float]
    refinement: str
    alpha: float = 0.6

@app.post("/search/refine")
def refine(req: RefineRequest):
    return refine_search(
        req.base_embedding,
        req.refinement,
        req.alpha
    )
