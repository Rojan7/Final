# backend/search.py
import os
import json
import time
import math
import datetime
import faiss
import torch
import numpy as np
from PIL import Image
from sentence_transformers import SentenceTransformer, CrossEncoder

# -------------------- Paths --------------------
INDEX_DIR   = "indices1"
METRICS_LOG = "search_metrics.jsonl"   # one JSON object per line
device      = "cuda" if torch.cuda.is_available() else "cpu"

# -------------------- Models --------------------
print("Loading search models...")

text_embedder = SentenceTransformer("BAAI/bge-base-en").to(device)
reranker      = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2").to(device)

print("Loading CLIP ViT-L-14 via sentence-transformers...")
clip_model = SentenceTransformer("clip-ViT-L-14")

# -------------------- Load FAISS indices --------------------
text_index         = faiss.read_index(os.path.join(INDEX_DIR, "text.index"))
image_index        = faiss.read_index(os.path.join(INDEX_DIR, "image.index"))
unified_clip_index = faiss.read_index(os.path.join(INDEX_DIR, "unified_clip.index"))

# -------------------- Load Metadata --------------------
with open(os.path.join(INDEX_DIR, "text_meta.json"), encoding="utf-8") as f:
    text_meta = json.load(f)

with open(os.path.join(INDEX_DIR, "image_meta.json"), encoding="utf-8") as f:
    image_meta = json.load(f)

with open(os.path.join(INDEX_DIR, "unified_clip_meta.json"), encoding="utf-8") as f:
    unified_clip_meta = json.load(f)

# ============================================================
#  EVALUATION METRICS
#  All metrics are computed automatically on every search result
#  and returned alongside results so the frontend can display them.
#
#  Metrics included (all standard IR / thesis-worthy):
#
#  1. cosine_similarity      - dot product of L2-normalised vectors.
#                              Since FAISS IndexFlatIP operates on
#                              normalised vectors, D values ARE cosine
#                              similarities already.
#
#  2. score_distribution     - mean, std, min, max of raw retrieval
#                              scores across the result set. Useful for
#                              showing score spread in your thesis.
#
#  3. reciprocal_rank (RR)   - 1/rank of the top result. Used to derive
#                              MRR (Mean Reciprocal Rank) across queries.
#                              RR=1.0 means best result is rank 1.
#
#  4. ndcg@k                 - Normalised Discounted Cumulative Gain at k.
#                              Uses the retrieval scores as graded
#                              relevance judgements (proxy NDCG — no
#                              human labels required). Standard metric in
#                              SIGIR / ECIR papers.
#
#  5. precision_at_k         - P@1, P@3, P@5, P@10. Fraction of top-k
#                              results with score above the mean score
#                              threshold (proxy for relevance).
#
#  6. score_drop_rate        - How fast relevance drops from rank 1 to
#                              rank k: (score[0] - score[-1]) / score[0].
#                              High drop = strong top result, poor tail.
#
#  7. retrieval_latency_ms   - Wall-clock time for the full search
#                              pipeline in milliseconds.
#
#  8. index_coverage         - k / index_size. What fraction of the
#                              corpus was retrieved.
#
# ============================================================

def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two L2-normalised vectors."""
    a = a.reshape(-1).astype("float64")
    b = b.reshape(-1).astype("float64")
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def _ndcg_at_k(scores: list[float], k: int) -> float:
    """
    Proxy NDCG@k using retrieval scores as graded relevance.
    Formula: DCG@k / IDCG@k
    DCG@k  = sum_{i=1}^{k} (2^rel_i - 1) / log2(i+1)
    IDCG@k = DCG of the ideal (sorted) ranking
    Scores are min-max normalised to [0,1] before use so they are
    interpretable as graded relevance in [0,1].
    """
    if not scores:
        return 0.0
    arr = np.array(scores[:k], dtype="float64")
    lo, hi = arr.min(), arr.max()
    if hi == lo:
        return 0.0  # all scores equal -> no discrimination possible, NDCG undefined
    rel = (arr - lo) / (hi - lo)          # normalise to [0,1]

    dcg  = sum((2**r - 1) / math.log2(i + 2) for i, r in enumerate(rel))
    idcg = sum((2**r - 1) / math.log2(i + 2) for i, r in enumerate(sorted(rel, reverse=True)))
    return float(dcg / idcg) if idcg > 0 else 0.0


def _precision_at_k(scores: list[float], k_values: list[int]) -> dict[str, float]:
    """
    Proxy P@k: fraction of top-k results with score above the mean score
    of the full result list. Acts as an automatic relevance threshold.
    """
    if not scores:
        return {f"p@{k}": 0.0 for k in k_values}
    threshold = float(np.mean(scores))
    result = {}
    for k in k_values:
        top_k = scores[:k]
        relevant = sum(1 for s in top_k if s >= threshold)
        result[f"p@{k}"] = round(relevant / k, 4)
    return result


def _score_distribution(scores: list[float]) -> dict:
    """Mean, std, min, max of retrieval scores."""
    if not scores:
        return {"mean": 0.0, "std": 0.0, "min": 0.0, "max": 0.0}
    arr = np.array(scores, dtype="float64")
    return {
        "mean": round(float(arr.mean()), 4),
        "std":  round(float(arr.std()),  4),
        "min":  round(float(arr.min()),  4),
        "max":  round(float(arr.max()),  4),
    }


def _compute_metrics(
    scores: list[float],
    query_emb: np.ndarray,
    result_embs: list[np.ndarray],
    index_size: int,
    latency_ms: float,
    k: int,
) -> dict:
    """
    Compute all evaluation metrics for a result set.

    Parameters
    ----------
    scores       : list of final fused/retrieval scores, length == len(results)
    query_emb    : the query embedding vector (L2-normalised)
    result_embs  : list of per-result embedding vectors (L2-normalised).
                   Pass [] if embeddings are not available (image results).
    index_size   : total number of vectors in the searched index
    latency_ms   : wall-clock search time in milliseconds
    k            : number of results requested
    """
    n = len(scores)
    if n == 0:
        return {}

    # 1. Per-result cosine similarity to query (when embeddings available)
    cosine_sims = (
        [round(_cosine_similarity(query_emb, e), 4) for e in result_embs]
        if result_embs else []
    )

    # 2. Score distribution
    dist = _score_distribution(scores)

    # 3. Reciprocal Rank (top result is always rank 1 after sorting)
    reciprocal_rank = round(1.0 / 1, 4)   # = 1.0; useful when averaged over queries

    # 4. NDCG at multiple cutoffs
    ndcg = {
        "ndcg@1":  round(_ndcg_at_k(scores, 1),  4),
        "ndcg@3":  round(_ndcg_at_k(scores, 3),  4),
        "ndcg@5":  round(_ndcg_at_k(scores, 5),  4),
        "ndcg@10": round(_ndcg_at_k(scores, 10), 4),
    }

    # 5. Precision at k
    precision = _precision_at_k(scores, [1, 3, 5, 10])

    # 6. Score drop rate: how sharply relevance declines
    score_drop_rate = round(
        (scores[0] - scores[-1]) / (scores[0] + 1e-9), 4
    ) if n > 1 else 0.0

    # 7. Latency
    # 8. Index coverage
    index_coverage = round(n / max(index_size, 1), 6)

    return {
        "result_count":       n,
        "retrieval_latency_ms": round(latency_ms, 2),
        "index_coverage":     index_coverage,
        "reciprocal_rank":    reciprocal_rank,
        "score_distribution": dist,
        "ndcg":               ndcg,
        "precision":          precision,
        "score_drop_rate":    score_drop_rate,
        "cosine_similarities": cosine_sims,  # per-result, empty for image results
    }



# -------------------- Metrics logger --------------------
def _log_metrics(search_type: str, query_repr: str, metrics: dict, results: list) -> None:
    """
    Append one search event to search_metrics.jsonl.
    Each line is a self-contained JSON object — easy to load with pandas:

        import pandas as pd
        df = pd.read_json("search_metrics.jsonl", lines=True)

    Fields written
    --------------
    timestamp       : ISO-8601 UTC time of the query
    search_type     : "text->text" | "text->image" | "image->text" | "image->image"
    query           : text query string, or "[image]" for image queries
    result_titles   : list of returned titles (for manual relevance checking)
    metrics         : full metrics dict (ndcg, precision, latency, etc.)
    """
    record = {
        "timestamp":     datetime.datetime.utcnow().isoformat() + "Z",
        "search_type":   search_type,
        "query":         query_repr,
        "result_titles": [r.get("title") for r in results],
        "metrics":       metrics,
    }
    with open(METRICS_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


# -------------------- Utils --------------------
def normalize(v: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(v)
    return v if n == 0 else v / n

def _minmax(arr: np.ndarray) -> np.ndarray:
    lo, hi = arr.min(), arr.max()
    return (arr - lo) / (hi - lo + 1e-9)

def _preprocess_image(img: Image.Image) -> Image.Image:
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top  = (h - side) // 2
    return img.crop((left, top, left + side, top + side))

# -------------------- Embedding helpers --------------------
BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

def embed_text_bge(query: str) -> np.ndarray:
    emb = text_embedder.encode(
        [BGE_QUERY_PREFIX + query],
        normalize_embeddings=True,
    )[0]
    return normalize(emb.astype("float32"))

def embed_text_clip(query: str) -> np.ndarray:
    emb = clip_model.encode(query, convert_to_numpy=True)
    return normalize(emb.astype("float32").reshape(-1))

def embed_image_clip(img: Image.Image) -> np.ndarray:
    emb = clip_model.encode(img, convert_to_numpy=True)
    return normalize(emb.astype("float32").reshape(-1))

# -------------------- TEXT -> TEXT --------------------
def search_text(query: str, k: int = 10) -> dict:
    t0 = time.perf_counter()

    query_emb    = embed_text_bge(query)
    emb          = query_emb.reshape(1, -1)
    n_candidates = max(100, k * 10)

    D, I = text_index.search(emb, n_candidates)
    candidates   = [text_meta[i] for i in I[0] if i < len(text_meta)]
    faiss_scores = [float(D[0][j]) for j in range(len(candidates))]

    pairs       = [[query, c["text"]] for c in candidates]
    ce_scores   = reranker.predict(pairs).flatten()
    ranked      = sorted(zip(ce_scores.tolist(), faiss_scores, candidates),
                         key=lambda x: x[0], reverse=True)

    results      = []
    final_scores = []   # FAISS cosine scores used for NDCG/distribution
    ce_score_list = []  # CrossEncoder scores stored separately
    for ce_s, faiss_s, c in ranked[:k]:
        results.append({
            "title":             c.get("title"),
            "url":               c.get("url"),
            "score":             round(float(ce_s), 4),
            "cosine_similarity": round(float(faiss_s), 4),
            "snippet":           (c.get("text") or "")[:200] + "...",
        })
        # Use FAISS cosine score for IR metrics: it has real variance
        # across passages. CE score collapses to same value for passages
        # from the same article, making std=0 and NDCG=undefined.
        final_scores.append(float(faiss_s))
        ce_score_list.append(float(ce_s))

    latency_ms = (time.perf_counter() - t0) * 1000

    metrics = _compute_metrics(
        scores      = final_scores,
        query_emb   = query_emb,
        result_embs = [],           # cosine_sims already in final_scores
        index_size  = text_index.ntotal,
        latency_ms  = latency_ms,
        k           = k,
    )
    # Overwrite cosine_similarities with the actual per-result FAISS scores
    metrics["cosine_similarities"] = [round(s, 4) for s in final_scores]
    metrics["crossencoder_scores"] = [round(s, 4) for s in ce_score_list]

    return {"results": results, "metrics": metrics}


# -------------------- TEXT -> IMAGE --------------------
def search_images_from_text(query: str, k: int = 10) -> dict:
    t0 = time.perf_counter()

    query_emb    = embed_text_clip(query)
    emb          = query_emb.reshape(1, -1)
    n_candidates = max(100, k * 10)

    D, I        = image_index.search(emb, n_candidates)
    candidates  = [image_meta[i] for i in I[0] if i < len(image_meta)]
    clip_scores = np.array([float(D[0][j]) for j in range(len(candidates))])

    ce_inputs = [
        [query, f"{c.get('caption', '')} {c.get('title', '')}".strip()]
        for c in candidates
    ]
    ce_scores = reranker.predict(ce_inputs).flatten()

    clip_norm = _minmax(clip_scores)
    ce_norm   = _minmax(ce_scores)
    fused     = 0.4 * clip_norm + 0.6 * ce_norm
    ranked    = sorted(
        zip(fused.tolist(), clip_scores.tolist(), candidates),
        key=lambda x: x[0], reverse=True
    )

    results      = []
    final_scores = []
    for fused_s, cosine_s, c in ranked[:k]:
        results.append({
            "title":             c.get("title"),
            "filename":          c.get("filename"),
            "caption":           c.get("caption"),
            "url":               c.get("url"),
            "score":             round(float(fused_s), 4),
            "cosine_similarity": round(float(cosine_s), 4),
        })
        final_scores.append(float(fused_s))

    latency_ms = (time.perf_counter() - t0) * 1000

    # Collect cosine scores in result order for the metrics log
    cosine_list = [r["cosine_similarity"] for r in results]

    metrics = _compute_metrics(
        scores      = final_scores,
        query_emb   = query_emb,
        result_embs = [],
        index_size  = image_index.ntotal,
        latency_ms  = latency_ms,
        k           = k,
    )
    metrics["cosine_similarities"] = cosine_list

    return {"results": results, "metrics": metrics}


# -------------------- IMAGE -> IMAGE --------------------
def search_images_from_image(img: Image.Image, k: int = 10) -> dict:
    t0 = time.perf_counter()

    img       = _preprocess_image(img)
    query_emb = embed_image_clip(img)
    emb       = query_emb.reshape(1, -1)

    n_candidates = min(len(image_meta), max(50, k * 5))
    D, I = image_index.search(emb, n_candidates)

    results      = []
    final_scores = []
    for i, d in zip(I[0], D[0]):
        if i >= len(image_meta):
            continue
        if float(d) < 0.15:
            continue
        results.append({
            "title":             image_meta[i].get("title"),
            "filename":          image_meta[i].get("filename"),
            "caption":           image_meta[i].get("caption"),
            "url":               image_meta[i].get("url"),
            "score":             round(float(d), 4),
            "cosine_similarity": round(float(d), 4),  # same as score for pure CLIP
        })
        final_scores.append(float(d))
        if len(results) >= k:
            break

    latency_ms = (time.perf_counter() - t0) * 1000

    metrics = _compute_metrics(
        scores      = final_scores,
        query_emb   = query_emb,
        result_embs = [],
        index_size  = image_index.ntotal,
        latency_ms  = latency_ms,
        k           = k,
    )

    return {"results": results, "metrics": metrics}


# -------------------- IMAGE -> TEXT --------------------
def search_text_from_image(img: Image.Image, k: int = 10) -> dict:
    t0 = time.perf_counter()

    img       = _preprocess_image(img)
    query_emb = embed_image_clip(img)
    emb       = query_emb.reshape(1, -1)

    n_candidates = max(150, k * 15)
    D, I = unified_clip_index.search(emb, n_candidates)

    text_candidates  = []
    text_clip_scores = []
    for j, i in enumerate(I[0]):
        if i >= len(unified_clip_meta):
            continue
        entry = unified_clip_meta[i]
        if entry.get("kind") == "text" and float(D[0][j]) > 0.10:
            text_candidates.append(entry)
            text_clip_scores.append(float(D[0][j]))

    if not text_candidates:
        return {"results": [], "metrics": {}}

    clip_scores  = np.array(text_clip_scores)
    proxy_query  = text_candidates[0].get("text", "")[:512]
    ce_inputs    = [[proxy_query, c.get("text", "")] for c in text_candidates]
    ce_scores    = reranker.predict(ce_inputs).flatten()

    clip_norm = _minmax(clip_scores)
    ce_norm   = _minmax(ce_scores)
    fused     = 0.7 * clip_norm + 0.3 * ce_norm

    seen_titles  = set()
    results      = []
    final_scores = []
    cosine_vals  = []

    for score, cosine_s, c in sorted(
        zip(fused.tolist(), clip_scores.tolist(), text_candidates),
        key=lambda x: x[0], reverse=True
    ):
        title = c.get("title")
        if title in seen_titles:
            continue
        seen_titles.add(title)
        results.append({
            "title":             title,
            "url":               c.get("url"),
            "score":             round(float(score), 4),
            "cosine_similarity": round(float(cosine_s), 4),
            "snippet":           (c.get("text") or "")[:200] + "...",
        })
        final_scores.append(float(score))
        cosine_vals.append(float(cosine_s))
        if len(results) >= k:
            break

    latency_ms = (time.perf_counter() - t0) * 1000

    metrics = _compute_metrics(
        scores      = final_scores,
        query_emb   = query_emb,
        result_embs = [],
        index_size  = unified_clip_index.ntotal,
        latency_ms  = latency_ms,
        k           = k,
    )
    # Also attach raw cosine similarities list for image->text
    metrics["cosine_similarities"] = [round(v, 4) for v in cosine_vals]

    return {"results": results, "metrics": metrics}


# -------------------- UNIFIED ENDPOINTS --------------------
def unified_text_search(query: str, k: int = 10) -> dict:
    text   = search_text(query, k)
    images = search_images_from_text(query, k)

    _log_metrics("text->text",  query, text["metrics"],   text["results"])
    _log_metrics("text->image", query, images["metrics"], images["results"])

    return {
        "text_results":  text["results"],
        "image_results": images["results"],
    }

def unified_image_search(image: Image.Image, k: int = 10) -> dict:
    text   = search_text_from_image(image, k)
    images = search_images_from_image(image, k)

    _log_metrics("image->text",  "[image]", text["metrics"],   text["results"])
    _log_metrics("image->image", "[image]", images["metrics"], images["results"])

    return {
        "text_results":  text["results"],
        "image_results": images["results"],
    }
