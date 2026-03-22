# backend/embed.py
import os
import json
import numpy as np
import faiss
import torch
from PIL import Image
from transformers import logging
from sentence_transformers import SentenceTransformer

logging.set_verbosity_error()

# -------------------- Paths --------------------
DATA_DIR      = "wikipedia_scrape"
TEXT_META_DIR = os.path.join(DATA_DIR, "meta")
IMAGE_DIR     = os.path.join(DATA_DIR, "images")
INDEX_DIR     = "indices1"
os.makedirs(INDEX_DIR, exist_ok=True)

# -------------------- Device --------------------
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

# -------------------- Models --------------------
print("Loading models...")

# BGE: text-to-text retrieval (768-dim, unchanged)
text_embedder = SentenceTransformer("BAAI/bge-base-en").to(device)

# CLIP via sentence-transformers: unified image+text space (768-dim)
# clip-ViT-L-14 is larger and much better than clip-ViT-B-32.
# sentence-transformers wraps it cleanly and works on Python 3.14.
# Both images and text passages are embedded into the same 768-dim space,
# so image queries can directly retrieve text and vice versa.
print("Loading CLIP ViT-L-14 via sentence-transformers...")
clip_model = SentenceTransformer("clip-ViT-L-14")

# -------------------- Utils --------------------
def normalize(vec: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(vec)
    return vec if n == 0 else vec / n

# BGE: document side (no prefix - added at query time in search.py)
def embed_text_bge(text: str) -> np.ndarray:
    emb = text_embedder.encode(
        [text],
        convert_to_numpy=True,
        normalize_embeddings=True,
    )
    return normalize(emb[0].astype("float32"))

# CLIP text: embeds text into the shared image+text space
def embed_text_clip(text: str) -> np.ndarray:
    emb = clip_model.encode(text, convert_to_numpy=True)
    return normalize(emb.astype("float32").reshape(-1))

# CLIP image: embeds image into the same shared space
def embed_image_clip(path: str) -> np.ndarray:
    image = Image.open(path).convert("RGB")
    emb = clip_model.encode(image, convert_to_numpy=True)
    return normalize(emb.astype("float32").reshape(-1))

# -------------------- Storage --------------------
text_embeddings,      text_metadata      = [], []  # BGE 768-dim
image_embeddings,     image_metadata     = [], []  # CLIP 768-dim (images)
clip_text_embeddings, clip_text_metadata = [], []  # CLIP 768-dim (text passages)

meta_files = [f for f in os.listdir(TEXT_META_DIR) if f.endswith(".json")]
print(f"Processing {len(meta_files)} metadata files...")

for meta_file in meta_files:
    with open(os.path.join(TEXT_META_DIR, meta_file), "r", encoding="utf-8") as f:
        page = json.load(f)

    page_title = page.get("title")
    page_url   = page.get("url")

    for block in page.get("content", []):

        # ---- Text blocks ----
        if block["type"] == "text":
            text = block.get("content", "").strip()
            if not text:
                continue

            # BGE embedding (text->text search)
            try:
                emb_bge = embed_text_bge(text)
                text_embeddings.append(emb_bge)
                text_metadata.append({
                    "title": page_title,
                    "url":   page_url,
                    "text":  text,
                })
            except Exception as e:
                print(f"[BGE ERROR] {e}")

            # CLIP text embedding (image->text cross-modal search)
            try:
                emb_clip = embed_text_clip(text)
                clip_text_embeddings.append(emb_clip)
                clip_text_metadata.append({
                    "title": page_title,
                    "url":   page_url,
                    "text":  text,
                    "kind":  "text",
                })
            except Exception as e:
                print(f"[CLIP TEXT ERROR] {e}")

        # ---- Image blocks ----
        elif block["type"] == "image":
            filename = block.get("filename")
            if not filename:
                continue
            path = os.path.join(IMAGE_DIR, filename)
            if not os.path.exists(path):
                print(f"[IMAGE MISSING] {filename}")
                continue
            try:
                emb_clip = embed_image_clip(path)
                image_embeddings.append(emb_clip)
                image_metadata.append({
                    "title":    page_title,
                    "url":      page_url,
                    "filename": filename,
                    "caption":  block.get("caption", ""),
                    "kind":     "image",
                })
            except Exception as e:
                print(f"[CLIP IMAGE ERROR] {filename}: {e}")

print(
    f"Embeddings collected -> "
    f"BGE text: {len(text_embeddings)} | "
    f"CLIP text: {len(clip_text_embeddings)} | "
    f"CLIP images: {len(image_embeddings)}"
)

# -------------------- Build FAISS indices --------------------
text_embeddings      = np.stack(text_embeddings).astype("float32")
image_embeddings     = np.stack(image_embeddings).astype("float32")
clip_text_embeddings = np.stack(clip_text_embeddings).astype("float32")

# Unified CLIP index: images + text passages in the same space.
# An image query vector can now retrieve both images AND text passages.
unified_clip_embeddings = np.vstack([image_embeddings, clip_text_embeddings]).astype("float32")
unified_clip_metadata   = image_metadata + clip_text_metadata

dim_bge  = text_embeddings.shape[1]
dim_clip = image_embeddings.shape[1]

print(f"BGE dim: {dim_bge} | CLIP dim: {dim_clip}")

text_index         = faiss.IndexFlatIP(dim_bge)
image_index        = faiss.IndexFlatIP(dim_clip)
unified_clip_index = faiss.IndexFlatIP(dim_clip)

text_index.add(text_embeddings)
image_index.add(image_embeddings)
unified_clip_index.add(unified_clip_embeddings)

faiss.write_index(text_index,         os.path.join(INDEX_DIR, "text.index"))
faiss.write_index(image_index,        os.path.join(INDEX_DIR, "image.index"))
faiss.write_index(unified_clip_index, os.path.join(INDEX_DIR, "unified_clip.index"))

# -------------------- Save Metadata --------------------
with open(os.path.join(INDEX_DIR, "text_meta.json"), "w", encoding="utf-8") as f:
    json.dump(text_metadata, f, ensure_ascii=False, indent=2)

with open(os.path.join(INDEX_DIR, "image_meta.json"), "w", encoding="utf-8") as f:
    json.dump(image_metadata, f, ensure_ascii=False, indent=2)

with open(os.path.join(INDEX_DIR, "unified_clip_meta.json"), "w", encoding="utf-8") as f:
    json.dump(unified_clip_metadata, f, ensure_ascii=False, indent=2)

print("All embeddings computed and indices saved.")
print(f"  text.index          -> {text_index.ntotal} vectors ({dim_bge}-dim BGE)")
print(f"  image.index         -> {image_index.ntotal} vectors ({dim_clip}-dim CLIP)")
print(f"  unified_clip.index  -> {unified_clip_index.ntotal} vectors ({dim_clip}-dim CLIP, images+text)")
