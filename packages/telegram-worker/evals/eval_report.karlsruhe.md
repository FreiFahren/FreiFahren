# Telegram bot extractor — eval report

**Mode:** FULL (200 rows of 200)  
**Model:** `mistral-small-latest`  
**Parallelism:** 6  
**Wall time:** 41.4s (4.8 msg/s)  
**LLM/network errors:** 0

## Headline

- **Fully correct rows** (all three fields match): 143/200 = **71.5%**
- Station accuracy: **89.5%**
- Direction accuracy: **90.0%**
- Line accuracy: **88.5%**

## Per-field metrics

Null is treated as a negative prediction. *Precision* = "when the bot says X, how often is X right?". *Recall* = "when the label has a value, how often does the bot extract it correctly?".

| Field | Accuracy | Correct | Precision | Recall | F1 | TP | FP | FN | TN |
|---|---|---|---|---|---|---|---|---|---|
| stationId | 89.5% | 179/200 | 87.7% | 91.7% | 89.6% | 121 | 17 | 11 | 58 |
| directionId | 90.0% | 180/200 | 84.3% | 88.6% | 86.4% | 70 | 13 | 9 | 110 |
| lineName | 88.5% | 177/200 | 93.5% | 80.0% | 86.2% | 72 | 5 | 18 | 105 |

See `eval_results.karlsruhe.json` for the full per-row breakdown.
