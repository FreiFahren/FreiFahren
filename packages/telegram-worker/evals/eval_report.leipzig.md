# Telegram bot extractor — eval report

**Mode:** FULL (1000 rows of 1000)  
**Model:** `mistral-small-latest`  
**Parallelism:** 8  
**Wall time:** 1086.9s (0.9 msg/s)  
**LLM/network errors:** 32

## Headline

- **Fully correct rows** (all three fields match): 689/1000 = **68.9%**
- Station accuracy: **83.5%**
- Direction accuracy: **84.4%**
- Line accuracy: **90.5%**

## Per-field metrics

Null is treated as a negative prediction. *Precision* = "when the bot says X, how often is X right?". *Recall* = "when the label has a value, how often does the bot extract it correctly?".

| Field | Accuracy | Correct | Precision | Recall | F1 | TP | FP | FN | TN |
|---|---|---|---|---|---|---|---|---|---|
| stationId | 83.5% | 835/1000 | 83.8% | 85.7% | 84.7% | 594 | 115 | 99 | 241 |
| directionId | 84.4% | 844/1000 | 76.9% | 61.3% | 68.2% | 223 | 67 | 141 | 621 |
| lineName | 90.5% | 905/1000 | 96.3% | 80.3% | 87.6% | 335 | 13 | 82 | 570 |

See `eval_results.leipzig.json` for the full per-row breakdown.
