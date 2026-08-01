# Telegram bot extractor — eval report

**Mode:** FULL (1000 rows of 1000)  
**Model:** `mistral-small-latest`  
**Parallelism:** 8  
**Wall time:** 595.1s (1.7 msg/s)  
**LLM/network errors:** 14

## Headline

- **Fully correct rows** (all three fields match): 484/1000 = **48.4%**
- Station accuracy: **84.7%**
- Direction accuracy: **85.6%**
- Line accuracy: **59.5%**

## Per-field metrics

Null is treated as a negative prediction. *Precision* = "when the bot says X, how often is X right?". *Recall* = "when the label has a value, how often does the bot extract it correctly?".

| Field | Accuracy | Correct | Precision | Recall | F1 | TP | FP | FN | TN |
|---|---|---|---|---|---|---|---|---|---|
| stationId | 84.7% | 847/1000 | 83.5% | 87.7% | 85.6% | 608 | 120 | 85 | 239 |
| directionId | 85.6% | 856/1000 | 74.2% | 69.5% | 71.8% | 253 | 88 | 111 | 603 |
| lineName | 59.5% | 595/1000 | 92.9% | 3.1% | 6.0% | 13 | 1 | 404 | 582 |

See `eval_results.leipzig.json` for the full per-row breakdown.
