# Telegram bot extractor — eval report

**Mode:** FULL (200 rows of 200)  
**Model:** `mistral-small-latest`  
**Parallelism:** 4  
**Wall time:** 77.7s (2.6 msg/s)  
**LLM/network errors:** 0

## Headline

- **Fully correct rows** (all three fields match): 134/200 = **67.0%**
- Station accuracy: **82.5%**
- Direction accuracy: **86.5%**
- Line accuracy: **91.5%**

## Per-field metrics

Null is treated as a negative prediction. *Precision* = "when the bot says X, how often is X right?". *Recall* = "when the label has a value, how often does the bot extract it correctly?".

| Field | Accuracy | Correct | Precision | Recall | F1 | TP | FP | FN | TN |
|---|---|---|---|---|---|---|---|---|---|
| stationId | 82.5% | 165/200 | 80.1% | 90.1% | 84.8% | 109 | 27 | 12 | 56 |
| directionId | 86.5% | 173/200 | 75.5% | 88.8% | 81.6% | 71 | 23 | 9 | 102 |
| lineName | 91.5% | 183/200 | 90.0% | 91.0% | 90.5% | 81 | 9 | 8 | 102 |

See `eval_results.cologne.json` for the full per-row breakdown.
