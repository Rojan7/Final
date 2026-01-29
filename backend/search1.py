import os
import numpy as np
import torch
from PIL import Image
import faiss
import json
from transformers import CLIPProcessor, CLIPModel

INDEX_DIR = "indices1"
device = "cuda" if torch.cuda.is_available() else "cpu"

# Load CLIP model
clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

# Load FAISS indices
text_index = faiss.read_index(os.path.join(INDEX_DIR, "text.index"))
image_index = faiss.read_index(os.path.join(INDEX_DIR, "image.index"))

with open(os.path.join(INDEX_DIR, "text_meta.json"), "r", encoding="utf-8") as f:
    text_meta = json.load(f)

with open(os.path.join(INDEX_DIR, "image_meta.json"), "r", encoding="utf-8") as f:
    image_meta = json.load(f)


def normalize(vec):
    norm = np.linalg.norm(vec)
    return vec if norm == 0 else vec / norm


def embed_text(text: str):
    inputs = clip_processor(text=[text], return_tensors="pt", padding=True, truncation=True).to(device)
    with torch.no_grad():
        emb = clip_model.get_text_features(**inputs)
    return normalize(emb[0].cpu().numpy()).astype("float32")


def embed_image_pil(image: Image.Image):
    inputs = clip_processor(images=image, return_tensors="pt").to(device)
    with torch.no_grad():
        emb = clip_model.get_image_features(**inputs)
    return normalize(emb[0].cpu().numpy()).astype("float32")


# ----- Text search -----
def search_text(query: str, k=5):
    q = embed_text(query)
    D, I = text_index.search(np.array([q]), k)
    results = []
    for idx, score in zip(I[0], D[0]):
        meta = text_meta[idx]
        results.append({
            "page_id": meta["page_id"],
            "title": meta["title"],
            "url": meta.get("url"),
            "section": meta.get("section"),
            "text": meta.get("text"),
            "score": float(score)
        })
    return results


# ----- Image search -----
def search_image(image: Image.Image, k=5):
    q = embed_image_pil(image)
    D, I = image_index.search(np.array([q]), k)
    results = []
    for idx, score in zip(I[0], D[0]):
        meta = image_meta[idx]
        results.append({
            "page_id": meta["page_id"],
            "title": meta["title"],
            "url": meta.get("url"),
            "filename": meta.get("filename"),
            "caption": meta.get("caption"),
            "score": float(score)
        })
    return results


# ----- Image search using text query -----
def search_image_from_text(query: str, k=5):
    q_emb = embed_text(query)
    D, I = image_index.search(np.array([q_emb]), k)
    results = []
    for idx, score in zip(I[0], D[0]):
        meta = image_meta[idx]
        results.append({
            "page_id": meta["page_id"],
            "title": meta["title"],
            "url": meta.get("url"),
            "filename": meta.get("filename"),
            "caption": meta.get("caption"),
            "score": float(score)
        })
    return results


# ----- Unified search by text -----
def search_unified(query: str, k=5):
    return {
        "text_results": search_text(query, k),
        "image_results": search_image_from_text(query, k)
    }


# ----- Unified search by image -----
def search_unified_by_image(image: Image.Image, k=5):
    q_emb = embed_image_pil(image)

    # Text search using image embedding
    D_text, I_text = text_index.search(np.array([q_emb]), k)
    text_results = []
    for idx, score in zip(I_text[0], D_text[0]):
        meta = text_meta[idx]
        text_results.append({
            "page_id": meta["page_id"],
            "title": meta["title"],
            "url": meta.get("url"),
            "section": meta.get("section"),
            "text": meta.get("text"),
            "score": float(score)
        })

    # Image search using image embedding
    D_img, I_img = image_index.search(np.array([q_emb]), k)
    image_results = []
    for idx, score in zip(I_img[0], D_img[0]):
        meta = image_meta[idx]
        image_results.append({
            "page_id": meta["page_id"],
            "title": meta["title"],
            "url": meta.get("url"),
            "filename": meta.get("filename"),
            "caption": meta.get("caption"),
            "score": float(score)
        })

    return {"text_results": text_results, "image_results": image_results}
