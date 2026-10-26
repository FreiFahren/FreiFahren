# Telegram bot extractor — eval report

**Mode:** FULL (200 rows of 200)  
**Model:** `mistral-small-latest`  
**Parallelism:** 4  
**Wall time:** 238.0s (0.8 msg/s)  
**LLM/network errors:** 0

## Headline

- **Fully correct rows** (all three fields match): 166/200 = **83.0%**
- Station accuracy: **88.5%**
- Direction accuracy: **89.5%**
- Line accuracy: **96.5%**

## Per-field metrics

Null is treated as a negative prediction. *Precision* = "when the bot says X, how often is X right?". *Recall* = "when the label has a value, how often does the bot extract it correctly?".

| Field | Accuracy | Correct | Precision | Recall | F1 | TP | FP | FN | TN |
|---|---|---|---|---|---|---|---|---|---|
| stationId | 88.5% | 177/200 | 85.6% | 90.4% | 87.9% | 113 | 19 | 12 | 64 |
| directionId | 89.5% | 179/200 | 84.8% | 87.6% | 86.2% | 78 | 14 | 11 | 101 |
| lineName | 96.5% | 193/200 | 98.7% | 92.5% | 95.5% | 74 | 1 | 6 | 119 |

See `eval_results.hannover.json` for the full per-row breakdown.
