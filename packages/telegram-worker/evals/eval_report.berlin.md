# Telegram bot extractor — eval report

**Mode:** FULL (1000 rows of 1000)  
**Model:** `mistral-small-latest`  
**Parallelism:** 8  
**Wall time:** 1044.8s (1.0 msg/s)  
**LLM/network errors:** 32

## Headline

- **Fully correct rows** (all three fields match): 838/1000 = **83.8%**
- Station accuracy: **89.3%**
- Direction accuracy: **94.1%**
- Line accuracy: **95.3%**

## Per-field metrics

Null is treated as a negative prediction. *Precision* = "when the bot says X, how often is X right?". *Recall* = "when the label has a value, how often does the bot extract it correctly?".

| Field | Accuracy | Correct | Precision | Recall | F1 | TP | FP | FN | TN |
|---|---|---|---|---|---|---|---|---|---|
| stationId | 89.3% | 893/1000 | 91.7% | 90.8% | 91.3% | 632 | 57 | 64 | 261 |
| directionId | 94.1% | 941/1000 | 90.0% | 90.5% | 90.3% | 315 | 35 | 33 | 626 |
| lineName | 95.3% | 953/1000 | 98.9% | 93.2% | 96.0% | 560 | 6 | 41 | 393 |

See `eval_results.berlin.json` for the full per-row breakdown.
