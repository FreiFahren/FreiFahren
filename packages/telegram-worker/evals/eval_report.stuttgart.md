# Telegram bot extractor — eval report

**Mode:** FULL (200 rows of 200)  
**Model:** `mistral-small-latest`  
**Parallelism:** 4  
**Wall time:** 81.9s (2.4 msg/s)  
**LLM/network errors:** 0

## Headline

- **Fully correct rows** (all three fields match): 170/200 = **85.0%**
- Station accuracy: **89.5%**
- Direction accuracy: **93.0%**
- Line accuracy: **96.0%**

## Per-field metrics

Null is treated as a negative prediction. *Precision* = "when the bot says X, how often is X right?". *Recall* = "when the label has a value, how often does the bot extract it correctly?".

| Field | Accuracy | Correct | Precision | Recall | F1 | TP | FP | FN | TN |
|---|---|---|---|---|---|---|---|---|---|
| stationId | 89.5% | 179/200 | 90.0% | 88.1% | 89.0% | 126 | 14 | 17 | 53 |
| directionId | 93.0% | 186/200 | 88.0% | 95.0% | 91.3% | 95 | 13 | 5 | 91 |
| lineName | 96.0% | 192/200 | 96.0% | 96.0% | 96.0% | 97 | 4 | 4 | 95 |

See `eval_results.stuttgart.json` for the full per-row breakdown.
