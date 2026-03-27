import pandas as pd
import dataframe_image as dfi
import json

# Load JSON
with open("evaluation_report.json") as f:
    data = json.load(f)

# Prepare per-query table
per_query_df = pd.json_normalize(data['per_query'])
columns_to_show = [
    'qid', 'query', 'latency_ms', 'num_relevant',
    'average_precision', 'reciprocal_rank', 
    'p@1','r@1','ndcg@1',
    'p@3','r@3','ndcg@3',
    'p@5','r@5','ndcg@5',
    'p@10','r@10','ndcg@10'
]
per_query_df = per_query_df[columns_to_show]

# Export as PNG image
dfi.export(per_query_df, "per_query_metrics.png")
print("Saved per-query metrics as per_query_metrics.png")