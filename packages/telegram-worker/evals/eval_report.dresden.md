# Telegram bot extractor — eval report

**Mode:** FULL (200 rows of 200)  
**Model:** `mistral-small-latest`  
**Parallelism:** 3  
**Wall time:** 336.8s (0.6 msg/s)  
**LLM/network errors:** 0

## Headline

- **Fully correct rows** (all three fields match): 142/200 = **71.0%**
- Station accuracy: **87.0%**
- Direction accuracy: **83.5%**
- Line accuracy: **89.0%**

## Per-field metrics

Null is treated as a negative prediction. *Precision* = "when the bot says X, how often is X right?". *Recall* = "when the label has a value, how often does the bot extract it correctly?".

| Field | Accuracy | Correct | Precision | Recall | F1 | TP | FP | FN | TN |
|---|---|---|---|---|---|---|---|---|---|
| stationId | 87.0% | 174/200 | 83.1% | 89.6% | 86.2% | 103 | 21 | 12 | 71 |
| directionId | 83.5% | 167/200 | 82.1% | 71.4% | 76.4% | 55 | 12 | 22 | 112 |
| lineName | 89.0% | 178/200 | 80.9% | 85.9% | 83.3% | 55 | 13 | 9 | 123 |

See `eval_results.dresden.json` for the full per-row breakdown.
