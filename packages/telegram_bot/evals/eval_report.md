# Telegram bot extractor — eval report

**Mode:** FULL (952 rows of 952)  
**Model:** `mistral-small-latest`  
**Parallelism:** 16  
**Wall time:** 667.6s (1.4 msg/s)  
**LLM/network errors:** 0

## Headline

- **Fully correct rows** (all three fields match): 794/952 = **83.4%**
- Station accuracy: **91.9%**
- Direction accuracy: **91.3%**
- Line accuracy: **97.2%**

## Per-field metrics

Null is treated as a negative prediction. *Precision* = "when the bot says X, how often is X right?". *Recall* = "when the label has a value, how often does the bot extract it correctly?".

| Field | Accuracy | Correct | Precision | Recall | F1 | TP | FP | FN | TN |
|---|---|---|---|---|---|---|---|---|---|
| stationId | 91.9% | 875/952 | 93.0% | 92.1% | 92.5% | 596 | 45 | 51 | 279 |
| directionId | 91.3% | 869/952 | 77.0% | 94.7% | 84.9% | 234 | 70 | 13 | 635 |
| lineName | 97.2% | 925/952 | 97.8% | 96.1% | 97.0% | 493 | 11 | 20 | 432 |

See `eval_results.json` for the full per-row breakdown.
