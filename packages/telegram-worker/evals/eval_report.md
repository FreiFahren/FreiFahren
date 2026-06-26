# Telegram bot extractor — eval report

**Mode:** FULL (1000 rows of 1000)  
**Model:** `mistral-small-latest`  
**Parallelism:** 8  
**Wall time:** 551.0s (1.8 msg/s)  
**LLM/network errors:** 0

## Headline

- **Fully correct rows** (all three fields match): 861/1000 = **86.1%**
- Station accuracy: **92.3%**
- Direction accuracy: **94.1%**
- Line accuracy: **97.5%**

## Per-field metrics

Null is treated as a negative prediction. *Precision* = "when the bot says X, how often is X right?". *Recall* = "when the label has a value, how often does the bot extract it correctly?".

| Field | Accuracy | Correct | Precision | Recall | F1 | TP | FP | FN | TN |
|---|---|---|---|---|---|---|---|---|---|
| stationId | 92.3% | 923/1000 | 92.9% | 94.5% | 93.7% | 658 | 50 | 38 | 265 |
| directionId | 94.1% | 941/1000 | 87.8% | 93.1% | 90.4% | 324 | 45 | 24 | 617 |
| lineName | 97.5% | 975/1000 | 99.0% | 96.8% | 97.9% | 582 | 6 | 19 | 393 |

See `eval_results.json` for the full per-row breakdown.
