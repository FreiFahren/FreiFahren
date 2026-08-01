# Telegram bot extractor — eval report

**Mode:** FULL (1000 rows of 1000)  
**Model:** `mistral-small-latest`  
**Parallelism:** 8  
**Wall time:** 537.3s (1.9 msg/s)  
**LLM/network errors:** 0

## Headline

- **Fully correct rows** (all three fields match): 458/1000 = **45.8%**
- Station accuracy: **86.1%**
- Direction accuracy: **80.5%**
- Line accuracy: **59.5%**

## Per-field metrics

Null is treated as a negative prediction. *Precision* = "when the bot says X, how often is X right?". *Recall* = "when the label has a value, how often does the bot extract it correctly?".

| Field | Accuracy | Correct | Precision | Recall | F1 | TP | FP | FN | TN |
|---|---|---|---|---|---|---|---|---|---|
| stationId | 86.1% | 861/1000 | 84.5% | 89.2% | 86.8% | 618 | 113 | 75 | 243 |
| directionId | 80.5% | 805/1000 | 64.1% | 71.2% | 67.4% | 259 | 145 | 105 | 546 |
| lineName | 59.5% | 595/1000 | 92.9% | 3.1% | 6.0% | 13 | 1 | 404 | 582 |

See `eval_results.leipzig.json` for the full per-row breakdown.
