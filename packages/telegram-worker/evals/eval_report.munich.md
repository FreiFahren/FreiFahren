# Telegram bot extractor — eval report

**Mode:** FULL (196 rows of 196)  
**Model:** `mistral-small-latest`  
**Parallelism:** 6  
**Wall time:** 106.7s (1.8 msg/s)  
**LLM/network errors:** 0

## Headline

- **Fully correct rows** (all three fields match): 184/196 = **93.9%**
- Station accuracy: **98.5%**
- Direction accuracy: **95.4%**
- Line accuracy: **99.0%**

## Per-field metrics

Null is treated as a negative prediction. *Precision* = "when the bot says X, how often is X right?". *Recall* = "when the label has a value, how often does the bot extract it correctly?".

| Field | Accuracy | Correct | Precision | Recall | F1 | TP | FP | FN | TN |
|---|---|---|---|---|---|---|---|---|---|
| stationId | 98.5% | 193/196 | 98.1% | 99.4% | 98.7% | 153 | 3 | 1 | 40 |
| directionId | 95.4% | 187/196 | 94.5% | 92.9% | 93.7% | 104 | 6 | 8 | 83 |
| lineName | 99.0% | 194/196 | 100.0% | 98.5% | 99.2% | 128 | 0 | 2 | 66 |

See `eval_results.munich.json` for the full per-row breakdown.
