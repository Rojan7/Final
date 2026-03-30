# backend/embed.py
import os
import json
import sys
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

# Persistent embedding arrays (raw numpy, saved alongside indices)
# These let us append new embeddings without re-embedding old pages.
NPY_TEXT_EMB        = os.path.join(INDEX_DIR, "text_embeddings.npy")
NPY_IMAGE_EMB       = os.path.join(INDEX_DIR, "image_embeddings.npy")
NPY_CLIP_TEXT_EMB   = os.path.join(INDEX_DIR, "clip_text_embeddings.npy")

# Tracks which meta files have already been embedded
EMBEDDED_STATE_FILE = os.path.join(INDEX_DIR, "embedded_pages.json")

# -------------------- Device --------------------
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

# -------------------- Models --------------------
print("Loading models...")
text_embedder = SentenceTransformer("BAAI/bge-base-en").to(device)

print("Loading CLIP ViT-L-14 via sentence-transformers...")
clip_model = SentenceTransformer("clip-ViT-L-14")

# -------------------- Utils --------------------
def normalize(vec: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(vec)
    return vec if n == 0 else vec / n

def embed_text_bge(text: str) -> np.ndarray:
    emb = text_embedder.encode(
        [text], convert_to_numpy=True, normalize_embeddings=True,
    )
    return normalize(emb[0].astype("float32"))

def embed_text_clip(text: str) -> np.ndarray:
    emb = clip_model.encode(text, convert_to_numpy=True)
    return normalize(emb.astype("float32").reshape(-1))

def embed_image_clip(path: str) -> np.ndarray:
    image = Image.open(path).convert("RGB")
    emb = clip_model.encode(image, convert_to_numpy=True)
    return normalize(emb.astype("float32").reshape(-1))

# -------------------- Load existing state --------------------
def load_existing():
    """
    Load previously embedded arrays and the set of already-processed files.
    Returns empty arrays if this is the first run.
    """
    if os.path.exists(EMBEDDED_STATE_FILE):
        with open(EMBEDDED_STATE_FILE, "r") as f:
            state = json.load(f)
        embedded_files  = set(state["embedded_files"])
        text_metadata   = state["text_metadata"]
        image_metadata  = state["image_metadata"]
        clip_text_meta  = state["clip_text_metadata"]
        print(f"[resume] {len(embedded_files)} pages already embedded, "
              f"{len(text_metadata)} text vectors, "
              f"{len(image_metadata)} image vectors.")
    else:
        embedded_files = set()
        text_metadata  = []
        image_metadata = []
        clip_text_meta = []
        print("[fresh] No previous embeddings found — embedding everything.")

    # Load raw embedding arrays if they exist
    text_embs      = np.load(NPY_TEXT_EMB).tolist()      if os.path.exists(NPY_TEXT_EMB)      else []
    image_embs     = np.load(NPY_IMAGE_EMB).tolist()     if os.path.exists(NPY_IMAGE_EMB)     else []
    clip_text_embs = np.load(NPY_CLIP_TEXT_EMB).tolist() if os.path.exists(NPY_CLIP_TEXT_EMB) else []

    return (
        embedded_files,
        text_embs,      text_metadata,
        image_embs,     image_metadata,
        clip_text_embs, clip_text_meta,
    )


def save_state(embedded_files, text_metadata, image_metadata, clip_text_meta):
    """Persist the list of embedded files and metadata to disk."""
    with open(EMBEDDED_STATE_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "embedded_files":    list(embedded_files),
            "text_metadata":     text_metadata,
            "image_metadata":    image_metadata,
            "clip_text_metadata": clip_text_meta,
        }, f, ensure_ascii=False)


# -------------------- Load existing state --------------------
(
    embedded_files,
    text_embeddings,  text_metadata,
    image_embeddings, image_metadata,
    clip_text_embeddings, clip_text_metadata,
) = load_existing()

# -------------------- Find new pages --------------------
all_meta_files = sorted(f for f in os.listdir(TEXT_META_DIR) if f.endswith(".json"))
new_meta_files = [f for f in all_meta_files if f not in embedded_files]

if not new_meta_files:
    print("Nothing new to embed — all pages are already indexed.")
    print("Delete indices1/embedded_pages.json to force a full re-embed.")
    exit(0)

print(f"Found {len(new_meta_files)} new pages to embed "
      f"({len(all_meta_files) - len(new_meta_files)} already done).")

# -------------------- Count new items --------------------
total_new = 0
for meta_file in new_meta_files:
    with open(os.path.join(TEXT_META_DIR, meta_file), "r", encoding="utf-8") as f:
        page = json.load(f)
    total_new += len(page.get("content", []))

print(f"Total new items to embed: {total_new}")
processed = 0

# -------------------- Embed new pages --------------------
for meta_file in new_meta_files:
    with open(os.path.join(TEXT_META_DIR, meta_file), "r", encoding="utf-8") as f:
        page = json.load(f)

    page_title = page.get("title")
    page_url   = page.get("url")

    for block in page.get("content", []):
        processed += 1
        if processed % 50 == 0 or processed == total_new:
            pct = (processed / total_new * 100) if total_new else 0
            sys.stdout.write(f"\rProgress: {processed}/{total_new} ({pct:.1f}%)")
            sys.stdout.flush()

        # ---- Text ----
        if block["type"] == "text":
            text = block.get("content", "").strip()
            if not text:
                continue
            try:
                text_embeddings.append(embed_text_bge(text))
                text_metadata.append({"title": page_title, "url": page_url, "text": text})
            except Exception as e:
                print(f"\n[BGE ERROR] {e}")
            try:
                clip_text_embeddings.append(embed_text_clip(text))
                clip_text_metadata.append({"title": page_title, "url": page_url, "text": text, "kind": "text"})
            except Exception as e:
                print(f"\n[CLIP TEXT ERROR] {e}")

        # ---- Image ----
        elif block["type"] == "image":
            filename = block.get("filename")
            if not filename:
                continue
            path = os.path.join(IMAGE_DIR, filename)
            if not os.path.exists(path):
                print(f"\n[IMAGE MISSING] {filename}")
                continue
            try:
                image_embeddings.append(embed_image_clip(path))
                image_metadata.append({
                    "title": page_title, "url": page_url,
                    "filename": filename, "caption": block.get("caption", ""), "kind": "image",
                })
            except Exception as e:
                print(f"\n[CLIP IMAGE ERROR] {filename}: {e}")

    # Mark this file as done immediately after processing
    embedded_files.add(meta_file)

print("\nEmbedding complete.")

# -------------------- Validate --------------------
if len(text_embeddings) == 0 or len(image_embeddings) == 0 or len(clip_text_embeddings) == 0:
    raise ValueError("No embeddings found. Check your data pipeline.")

# -------------------- Build updated FAISS indices --------------------
print("Building FAISS indices...")

text_arr      = np.stack(text_embeddings).astype("float32")
image_arr     = np.stack(image_embeddings).astype("float32")
clip_text_arr = np.stack(clip_text_embeddings).astype("float32")
unified_arr   = np.vstack([image_arr, clip_text_arr]).astype("float32")
unified_meta  = image_metadata + clip_text_metadata

dim_bge  = text_arr.shape[1]
dim_clip = image_arr.shape[1]
print(f"BGE dim: {dim_bge} | CLIP dim: {dim_clip}")

text_index         = faiss.IndexFlatIP(dim_bge)
image_index        = faiss.IndexFlatIP(dim_clip)
unified_clip_index = faiss.IndexFlatIP(dim_clip)

text_index.add(text_arr)
image_index.add(image_arr)
unified_clip_index.add(unified_arr)

faiss.write_index(text_index,         os.path.join(INDEX_DIR, "text.index"))
faiss.write_index(image_index,        os.path.join(INDEX_DIR, "image.index"))
faiss.write_index(unified_clip_index, os.path.join(INDEX_DIR, "unified_clip.index"))

# -------------------- Save raw embeddings for future incremental runs --------------------
np.save(NPY_TEXT_EMB,      text_arr)
np.save(NPY_IMAGE_EMB,     image_arr)
np.save(NPY_CLIP_TEXT_EMB, clip_text_arr)

# -------------------- Save metadata + state --------------------
with open(os.path.join(INDEX_DIR, "text_meta.json"), "w", encoding="utf-8") as f:
    json.dump(text_metadata, f, ensure_ascii=False, indent=2)
with open(os.path.join(INDEX_DIR, "image_meta.json"), "w", encoding="utf-8") as f:
    json.dump(image_metadata, f, ensure_ascii=False, indent=2)
with open(os.path.join(INDEX_DIR, "unified_clip_meta.json"), "w", encoding="utf-8") as f:
    json.dump(unified_meta, f, ensure_ascii=False, indent=2)

save_state(embedded_files, text_metadata, image_metadata, clip_text_metadata)

print("All indices saved.")
print(f"  text.index          -> {text_index.ntotal} vectors ({dim_bge}-dim BGE)")
print(f"  image.index         -> {image_index.ntotal} vectors ({dim_clip}-dim CLIP)")
print(f"  unified_clip.index  -> {unified_clip_index.ntotal} vectors ({dim_clip}-dim CLIP, images+text)")
print(f"  Embedded pages tracked: {len(embedded_files)} / {len(all_meta_files)}")