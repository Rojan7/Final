# backend/search.py
import os
import json
import faiss
import torch
import numpy as np
from PIL import Image
from transformers import CLIPProcessor, CLIPModel

# -------------------- Paths --------------------
INDEX_DIR = "indices1"
device = "cuda" if torch.cuda.is_available() else "cpu"

# -------------------- Load CLIP --------------------
clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32", use_fast=False)

# -------------------- Load FAISS --------------------
text_index = faiss.read_index(os.path.join(INDEX_DIR, "text.index"))
image_index = faiss.read_index(os.path.join(INDEX_DIR, "image.index"))

with open(os.path.join(INDEX_DIR, "text_meta.json"), "r", encoding="utf-8") as f:
    text_meta = json.load(f)

with open(os.path.join(INDEX_DIR, "image_meta.json"), "r", encoding="utf-8") as f:
    image_meta = json.load(f)

# -------------------- Utility Functions --------------------
def normalize(v: np.ndarray) -> np.ndarray:
    return v / np.linalg.norm(v)

def embed_text(text: str) -> np.ndarray:
    inputs = clip_processor(text=[text], return_tensors="pt", padding=True, truncation=True).to(device)
    with torch.no_grad():
        emb = clip_model.get_text_features(**inputs)
        if hasattr(emb, "pooler_output"):  # in case HF returns BaseModelOutputWithPooling
            emb = emb.pooler_output
    emb = torch.tensor(emb) if not isinstance(emb, torch.Tensor) else emb
    return normalize(emb.cpu().numpy().reshape(-1)).astype("float32")

def embed_image(image: Image.Image) -> np.ndarray:
    inputs = clip_processor(images=image, return_tensors="pt").to(device)
    with torch.no_grad():
        emb = clip_model.get_image_features(**inputs)
        if hasattr(emb, "pooler_output"):
            emb = emb.pooler_output
    emb = torch.tensor(emb) if not isinstance(emb, torch.Tensor) else emb
    return normalize(emb.cpu().numpy().reshape(-1)).astype("float32")

# -------------------- FAISS Search --------------------
def search_from_embedding(emb: np.ndarray, k: int = 5):
    emb = emb.reshape(1, -1).astype("float32")
    # Text search
    D_t, I_t = text_index.search(emb, k)
    text_results = [
        {
            "title": text_meta[i]["title"],
            "text": text_meta[i]["text"],
            "url": text_meta[i].get("url"),
            "score": float(d)
        }
        for i, d in zip(I_t[0], D_t[0])
    ]

    # Image search
    D_i, I_i = image_index.search(emb, k)
    image_results = [
        {
            "title": image_meta[i]["title"],
            "filename": image_meta[i]["filename"],
            "caption": image_meta[i].get("caption"),
            "url": image_meta[i].get("url"),
            "score": float(d)
        }
        for i, d in zip(I_i[0], D_i[0])
    ]

    return text_results, image_results

# -------------------- Unified Search Functions --------------------
def unified_text_search(query: str, k: int = 5):
    emb = embed_text(query)
    text, images = search_from_embedding(emb, k)
    return {
        "text_results": text,
        "image_results": images,
        "embedding": emb.tolist()
    }

def unified_image_search(image: Image.Image, k: int = 5):
    emb = embed_image(image)
    text, images = search_from_embedding(emb, k)
    return {
        "text_results": text,
        "image_results": images,
        "embedding": emb.tolist()
    }

def refine_search(base_embedding: list, refinement: str, alpha: float = 0.6, k: int = 5):
    base = np.array(base_embedding).astype("float32")
    refine_emb = embed_text(refinement)
    blended = normalize((1 - alpha) * base + alpha * refine_emb)
    text, images = search_from_embedding(blended, k)
    return {
        "text_results": text,
        "image_results": images,
        "embedding": blended.tolist()
    }
