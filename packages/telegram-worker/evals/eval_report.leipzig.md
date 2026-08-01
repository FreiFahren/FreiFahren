# Telegram bot extractor — eval report

**Mode:** FULL (1000 rows of 1000)  
**Model:** `mistral-small-latest`  
**Parallelism:** 8  
**Wall time:** 926.8s (1.1 msg/s)  
**LLM/network errors:** 16

## Headline

- **Fully correct rows** (all three fields match): 450/1000 = **45.0%**
- Station accuracy: **85.3%**
- Direction accuracy: **78.3%**
- Line accuracy: **59.4%**

## Per-field metrics

Null is treated as a negative prediction. *Precision* = "when the bot says X, how often is X right?". *Recall* = "when the label has a value, how often does the bot extract it correctly?".

| Field | Accuracy | Correct | Precision | Recall | F1 | TP | FP | FN | TN |
|---|---|---|---|---|---|---|---|---|---|
| stationId | 85.3% | 853/1000 | 83.7% | 87.9% | 85.7% | 609 | 119 | 84 | 244 |
| directionId | 78.3% | 783/1000 | 60.3% | 72.3% | 65.8% | 263 | 173 | 101 | 520 |
| lineName | 59.4% | 594/1000 | 92.3% | 2.9% | 5.6% | 12 | 1 | 405 | 582 |

See `eval_results.leipzig.json` for the full per-row breakdown.
