# Telegram bot extractor — eval report

**Mode:** FULL (1000 rows of 1000)  
**Model:** `mistral-small-latest`  
**Parallelism:** 8  
**Wall time:** 511.0s (2.0 msg/s)  
**LLM/network errors:** 8

## Headline

- **Fully correct rows** (all three fields match): 856/1000 = **85.6%**
- Station accuracy: **91.3%**
- Direction accuracy: **94.4%**
- Line accuracy: **96.9%**

## Per-field metrics

Null is treated as a negative prediction. *Precision* = "when the bot says X, how often is X right?". *Recall* = "when the label has a value, how often does the bot extract it correctly?".

| Field | Accuracy | Correct | Precision | Recall | F1 | TP | FP | FN | TN |
|---|---|---|---|---|---|---|---|---|---|
| stationId | 91.3% | 913/1000 | 92.6% | 93.1% | 92.8% | 648 | 52 | 48 | 265 |
| directionId | 94.4% | 944/1000 | 89.4% | 91.7% | 90.5% | 319 | 38 | 29 | 625 |
| lineName | 96.9% | 969/1000 | 99.0% | 95.8% | 97.4% | 576 | 6 | 25 | 393 |

See `eval_results.berlin.json` for the full per-row breakdown.
