# Telegram bot extractor — eval report

**Mode:** FULL (952 rows of 952)  
**Model:** `mistral-small-latest`  
**Parallelism:** 16  
**Wall time:** 610.2s (1.6 msg/s)  
**LLM/network errors:** 0

## Headline

- **Fully correct rows** (all three fields match): 797/952 = **83.7%**
- Station accuracy: **92.0%**
- Direction accuracy: **91.6%**
- Line accuracy: **97.2%**

## Per-field metrics

Null is treated as a negative prediction. *Precision* = "when the bot says X, how often is X right?". *Recall* = "when the label has a value, how often does the bot extract it correctly?".

| Field | Accuracy | Correct | Precision | Recall | F1 | TP | FP | FN | TN |
|---|---|---|---|---|---|---|---|---|---|
| stationId | 92.0% | 876/952 | 92.6% | 92.6% | 92.6% | 599 | 48 | 48 | 277 |
| directionId | 91.6% | 872/952 | 77.6% | 95.1% | 85.5% | 235 | 68 | 12 | 637 |
| lineName | 97.2% | 925/952 | 97.8% | 96.1% | 97.0% | 493 | 11 | 20 | 432 |

See `eval_results.json` for the full per-row breakdown.
