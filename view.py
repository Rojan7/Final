import pandas as pd, json

df = pd.read_json("search_metrics.jsonl", lines=True)

# Average NDCG@10 by search type
df["ndcg@10"] = df["metrics"].apply(lambda m: m["ndcg"]["ndcg@10"])
df["latency"] = df["metrics"].apply(lambda m: m["retrieval_latency_ms"])

print(df.groupby("search_type")[["ndcg@10", "latency"]].mean())