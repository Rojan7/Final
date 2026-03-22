"""
evaluate.py  —  Proper IR evaluation for thesis
================================================
Usage
-----
Step 1: Generate the relevance judgement template (run once):
    python evaluate.py --create-qrels

Step 2: Open qrels.json and fill in relevance scores manually:
    0 = not relevant
    1 = relevant
    2 = highly relevant

Step 3: Run evaluation against your live search system:
    python evaluate.py --evaluate

Output: evaluation_report.json  +  printed summary table
"""

import argparse
import json
import math
import time
import numpy as np
from pathlib import Path

# ----------------------------------------------------------------
# Sample queries — edit/extend these for your thesis domain
# These cover the main entity types in your Wikipedia corpus
# ----------------------------------------------------------------
SAMPLE_QUERIES = [
    # text queries
    {"qid": "q01", "query": "balen shah mayor kathmandu", "type": "text"},
    {"qid": "q02", "query": "kp oli prime minister nepal",  "type": "text"},
    {"qid": "q03", "query": "mountains in nepal",        "type": "text"},
    {"qid": "q04", "query": "kathmandu",       "type": "text"},
    {"qid": "q05", "query": "sher bahadur deuba",      "type": "text"},
    {"qid": "q06", "query": "pashupatinath temple",         "type": "text"},

]

QRELS_FILE  = "qrels.json"
REPORT_FILE = "evaluation_report.json"
K_VALUES    = [1, 3, 5, 10]


# ================================================================
#  METRIC FUNCTIONS  (ground-truth based — not self-referential)
# ================================================================

def precision_at_k(retrieved_titles: list[str], relevant_titles: set[str], k: int) -> float:
    """
    P@k = |relevant ∩ top-k retrieved| / k
    Strictly counts how many of the top-k results are in the relevant set.
    """
    top_k    = retrieved_titles[:k]
    relevant = sum(1 for t in top_k if t in relevant_titles)
    return round(relevant / k, 4)


def recall_at_k(retrieved_titles: list[str], relevant_titles: set[str], k: int) -> float:
    """
    R@k = |relevant ∩ top-k retrieved| / |relevant|
    What fraction of all known relevant items were found in top-k.
    """
    if not relevant_titles:
        return 0.0
    top_k    = retrieved_titles[:k]
    relevant = sum(1 for t in top_k if t in relevant_titles)
    return round(relevant / len(relevant_titles), 4)


def average_precision(retrieved_titles: list[str], relevant_titles: set[str]) -> float:
    """
    AP = average of P@k values at each rank where a relevant item appears.
    Mean over queries gives MAP — the gold standard IR metric.
    """
    if not relevant_titles:
        return 0.0
    hits      = 0
    precision_sum = 0.0
    for rank, title in enumerate(retrieved_titles, start=1):
        if title in relevant_titles:
            hits += 1
            precision_sum += hits / rank
    return round(precision_sum / len(relevant_titles), 4)


def ndcg_at_k(retrieved_titles: list[str], graded_relevance: dict[str, int], k: int) -> float:
    """
    NDCG@k using human graded relevance (0, 1, or 2).
    This is the real NDCG — not the fake score-based proxy.

    graded_relevance: {title -> relevance_grade}
      0 = not relevant
      1 = relevant
      2 = highly relevant
    """
    def dcg(rels):
        return sum(
            (2**r - 1) / math.log2(i + 2)
            for i, r in enumerate(rels)
        )

    retrieved_rels = [graded_relevance.get(t, 0) for t in retrieved_titles[:k]]
    ideal_rels     = sorted(graded_relevance.values(), reverse=True)[:k]

    actual_dcg = dcg(retrieved_rels)
    ideal_dcg  = dcg(ideal_rels)

    return round(actual_dcg / ideal_dcg, 4) if ideal_dcg > 0 else 0.0


def reciprocal_rank(retrieved_titles: list[str], relevant_titles: set[str]) -> float:
    """
    RR = 1/rank of first relevant result.
    Mean over queries gives MRR.
    """
    for rank, title in enumerate(retrieved_titles, start=1):
        if title in relevant_titles:
            return round(1.0 / rank, 4)
    return 0.0


def f1_at_k(p: float, r: float) -> float:
    return round(2 * p * r / (p + r), 4) if (p + r) > 0 else 0.0


# ================================================================
#  STEP 1 — CREATE QRELS TEMPLATE
# ================================================================

def create_qrels_template():
    """
    Runs all sample queries against the live search system,
    saves results to qrels.json for manual relevance labelling.
    """
    from backend.search import unified_text_search

    print("Running queries against live search system...")
    qrels = {}

    for item in SAMPLE_QUERIES:
        qid   = item["qid"]
        query = item["query"]
        print(f"  {qid}: {query}")

        t0     = time.perf_counter()
        result = unified_text_search(query, k=10)
        latency = (time.perf_counter() - t0) * 1000

        titles = [r.get("title", "") for r in result["text_results"]]

        # Build judgement template: every returned title gets grade=None
        # You fill these in manually: 0=not relevant, 1=relevant, 2=highly relevant
        judgements = {t: None for t in titles}

        qrels[qid] = {
            "query":       query,
            "type":        item["type"],
            "latency_ms":  round(latency, 2),
            "results":     [
                {
                    "rank":      i + 1,
                    "title":     r.get("title"),
                    "snippet":   r.get("snippet", "")[:120],
                    "relevance": None,   # <-- fill this in: 0, 1, or 2
                }
                for i, r in enumerate(result["text_results"])
            ],
        }

    with open(QRELS_FILE, "w", encoding="utf-8") as f:
        json.dump(qrels, f, ensure_ascii=False, indent=2)

    print(f"\nTemplate saved to {QRELS_FILE}")
    print("Open it and set each 'relevance' field to 0, 1, or 2, then run:")
    print("  python evaluate.py --evaluate")


# ================================================================
#  STEP 2 — EVALUATE AGAINST FILLED QRELS
# ================================================================

def run_evaluation():
    """
    Reads filled qrels.json, re-runs queries against live system,
    computes all metrics with ground-truth relevance, saves report.
    """
    if not Path(QRELS_FILE).exists():
        print(f"ERROR: {QRELS_FILE} not found. Run --create-qrels first.")
        return

    with open(QRELS_FILE, encoding="utf-8") as f:
        qrels = json.load(f)

    # Check all relevance labels are filled
    unlabelled = [
        f"{qid} rank {r['rank']}"
        for qid, data in qrels.items()
        for r in data["results"]
        if r["relevance"] is None
    ]
    if unlabelled:
        print(f"ERROR: {len(unlabelled)} results still have relevance=null.")
        print("Please fill in all relevance labels in", QRELS_FILE)
        print("First few:", unlabelled[:5])
        return

    from backend.search import unified_text_search

    print("Running evaluation...")
    per_query_metrics = []
    all_ap, all_rr    = [], []
    ndcg_by_k         = {k: [] for k in K_VALUES}
    prec_by_k         = {k: [] for k in K_VALUES}
    rec_by_k          = {k: [] for k in K_VALUES}
    latencies         = []

    for qid, data in qrels.items():
        query = data["query"]
        print(f"  {qid}: {query}")

        # Build ground-truth sets from human labels
        graded  = {r["title"]: r["relevance"] for r in data["results"]}
        relevant = {t for t, g in graded.items() if g and g >= 1}
        # highly_relevant = {t for t, g in graded.items() if g and g >= 2}

        # Re-run query on live system
        t0     = time.perf_counter()
        result = unified_text_search(query, k=max(K_VALUES))
        latency = (time.perf_counter() - t0) * 1000
        latencies.append(latency)

        retrieved = [r.get("title", "") for r in result["text_results"]]

        # Compute per-query metrics
        ap = average_precision(retrieved, relevant)
        rr = reciprocal_rank(retrieved, relevant)
        all_ap.append(ap)
        all_rr.append(rr)

        q_metrics = {
            "qid":              qid,
            "query":            query,
            "latency_ms":       round(latency, 2),
            "num_relevant":     len(relevant),
            "retrieved":        retrieved,
            "average_precision": ap,
            "reciprocal_rank":  rr,
        }

        for k in K_VALUES:
            p   = precision_at_k(retrieved, relevant, k)
            r_k = recall_at_k(retrieved, relevant, k)
            n   = ndcg_at_k(retrieved, graded, k)
            f1  = f1_at_k(p, r_k)

            prec_by_k[k].append(p)
            rec_by_k[k].append(r_k)
            ndcg_by_k[k].append(n)

            q_metrics[f"p@{k}"]    = p
            q_metrics[f"r@{k}"]    = r_k
            q_metrics[f"ndcg@{k}"] = n
            q_metrics[f"f1@{k}"]   = f1

        per_query_metrics.append(q_metrics)

    # Aggregate metrics across all queries
    def mean(lst): return round(float(np.mean(lst)), 4) if lst else 0.0
    def std(lst):  return round(float(np.std(lst)),  4) if lst else 0.0

    aggregate = {
        "num_queries":    len(qrels),
        "MAP":            mean(all_ap),
        "MRR":            mean(all_rr),
        "mean_latency_ms": mean(latencies),
        "std_latency_ms":  std(latencies),
    }
    for k in K_VALUES:
        aggregate[f"mean_p@{k}"]    = mean(prec_by_k[k])
        aggregate[f"mean_r@{k}"]    = mean(rec_by_k[k])
        aggregate[f"mean_ndcg@{k}"] = mean(ndcg_by_k[k])
        aggregate[f"std_ndcg@{k}"]  = std(ndcg_by_k[k])

    report = {
        "aggregate":        aggregate,
        "per_query":        per_query_metrics,
    }

    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    # Print summary
    print("\n" + "="*55)
    print("  EVALUATION RESULTS")
    print("="*55)
    print(f"  Queries evaluated : {aggregate['num_queries']}")
    print(f"  MAP               : {aggregate['MAP']}")
    print(f"  MRR               : {aggregate['MRR']}")
    print(f"  Mean latency      : {aggregate['mean_latency_ms']} ms")
    print("-"*55)
    print(f"  {'Metric':<14}", end="")
    for k in K_VALUES:
        print(f"  @{k:<4}", end="")
    print()
    print("-"*55)
    for metric, label in [("mean_p", "Precision"), ("mean_r", "Recall"), ("mean_ndcg", "NDCG")]:
        print(f"  {label:<14}", end="")
        for k in K_VALUES:
            print(f"  {aggregate[f'{metric}@{k}']:<6}", end="")
        print()
    print("="*55)
    print(f"\nFull report saved to {REPORT_FILE}")


# ================================================================
#  CLI
# ================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate multimodal search system")
    parser.add_argument("--create-qrels", action="store_true",
                        help="Run queries and generate qrels.json template for manual labelling")
    parser.add_argument("--evaluate", action="store_true",
                        help="Evaluate system against filled qrels.json")
    args = parser.parse_args()

    if args.create_qrels:
        create_qrels_template()
    elif args.evaluate:
        run_evaluation()
    else:
        parser.print_help()
