# Telegram bot extractor — eval report

**Mode:** FULL (200 rows of 200)  
**Model:** `mistral-small-latest`  
**Parallelism:** 3  
**Wall time:** 305.6s (0.7 msg/s)  
**LLM/network errors:** 0

## Headline

- **Fully correct rows** (all three fields match): 175/200 = **87.5%**
- Station accuracy: **93.5%**
- Direction accuracy: **96.0%**
- Line accuracy: **97.0%**

## Per-field metrics

Null is treated as a negative prediction. *Precision* = "when the bot says X, how often is X right?". *Recall* = "when the label has a value, how often does the bot extract it correctly?".

| Field | Accuracy | Correct | Precision | Recall | F1 | TP | FP | FN | TN |
|---|---|---|---|---|---|---|---|---|---|
| stationId | 93.5% | 187/200 | 90.2% | 95.7% | 92.8% | 110 | 12 | 5 | 77 |
| directionId | 96.0% | 192/200 | 93.9% | 96.8% | 95.3% | 92 | 6 | 3 | 100 |
| lineName | 97.0% | 194/200 | 96.9% | 96.9% | 96.9% | 93 | 3 | 3 | 101 |

See `eval_results.nuremberg.json` for the full per-row breakdown.
