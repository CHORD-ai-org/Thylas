# Notes on the baseline run

Working notes from the baseline sweep. The point of the run was not the number;
it was to find out whether two runs can be compared at all.

## What we measured

- Boundary: the declared north edge of the sample region.
- Crossings: every event that left the region and came back.
- Unknowns: crossings we could not locate to within one tick.

## What we found

Two runs with the same mean disagreed on 41 of 2400 crossings. The difference
did not come from the model; it came from the logging policy — one run recorded
intermediate crossings, the other only endpoints.

| Run | Policy | Crossings | Unknowns |
| --- | --- | --- | --- |
| 12 | full | 318 | 6 |
| 11 | endpoints | 311 | 4 |
| 08 | sparse | 288 | 31 |

## What it means

Comparability fails at the boundary, not at the average. A mean without a
declared boundary is a summary of an unstated choice.

```text
mean(run 12) = 42.8 ms
mean(run 08) = 47.9 ms
difference   = 5.1 ms, of which ~4.4 is policy
```

## Next

1. Re-run 08 with the full policy.
2. Keep the boundary id in every output row.
3. Do not compare runs whose policies differ.
