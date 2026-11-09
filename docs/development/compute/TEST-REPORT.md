# Compute — test report

**Date:** 2026-11-09. Everything below was measured in this repository, in a real Chrome over CDP or in Vitest. Nothing is asserted from memory.

## 1. Gates

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | silent |
| `npm run lint` (src + server) | 0 problems |
| `npx vitest run` | **250 passed** (20 files); 22 of them are the Compute model |
| `npm run e2e` | **254 passed** (was 243; +11 for Compute) |
| `npm run build` | CSS 101.95 KB (18.27 gzip) · JS 581.42 KB (180.60 gzip) |

## 2. What the unit tests pin

22 cases in `src/data/compute.test.ts`, all on pure functions:

- `statusLine` keeps connection and availability as two words, including the case where a seed says `available` but the connection failed (`r-tm-h100` → `Connection error · Availability unknown`).
- `metricsOf` returns `undefined` for anything not connected — utilization cannot leak from an unreachable machine.
- Seed integrity: every resource's provider exists, no disconnected machine carries utilization, every workload targets a real resource.
- `filterResources`: provider, type, scope, availability — and `available` returns only the two genuinely idle machines, not the four that are merely connected.
- `rankResources`: hard requirements filter; an idle datacenter machine outranks a busy one; shared machines get a caveat; unreachable machines score below reachable ones; cloud instances carry the billing caveat.
- `noMatchReason` names the binding constraint for >80GB.
- Provider registry: every provider declares fields; `planned` providers declare no capabilities.

## 3. What the e2e run pins (11 assertions)

| Assertion | Measured |
| --- | --- |
| rail opens Compute | path `/compute`, `h1` = `Compute` |
| overview counts the pool | 7 registered, ≥3 pool rows |
| unreachable machine | `Connection error · Availability unknown`, `no sample`, and **no `GPU n%` anywhere on the page** |
| filter by unknown | exactly 2 rows: `tm-h100-04`, `office-box` |
| add: unreachable host | stays on the form, error contains "did not answer", nothing added |
| add: reachable host | `Machine added`, name present, `declared` stated |
| find | ≥2 ranked cards with reasons |
| accept | assigned band present |
| workloads | queued list gains a row |
| stop | running count 3 → 2 |
| no-match filter | `No machine matches these filters` |

## 4. Flows walked by hand (scripted CDP, then re-read in screenshots)

| Flow | Before | After |
| --- | --- | --- |
| Add SSH machine, failing host | — | inline error, no resource created, form keeps its values |
| Add SSH machine, reachable host | pool 7 | pool 8, detail shows `declared hardware` |
| Connect `office-box` from detail | `Disconnected · Availability unknown` | `Connected · Offline` — the machine answers, it is not accepting work |
| Find ≥40GB | 7 candidates | ranked list; first card carries reasons and the shared-machine caveat |
| Find 120GB | — | `No machine fits` + "No machine in the pool has 120GB" + one-press fix |
| Accept a recommendation | — | a **queued** run appears in Workloads with a note that it has no executor |
| Stop a running run | 3 running | 2 running, 1 more cancelled |
| Filter `q=zzzz` | — | empty state naming the filters |

## 5. Responsive

| Width | Overflow (`scrollWidth − clientWidth`) | Note |
| --- | --- | --- |
| 1440 | 0 on all five screens | full table, two-column detail/find |
| 1024 | 0 | provider + utilization columns drop, status stays |
| 390 | 0 by measurement | **not supported visually**: the shell's rail is fixed at 240px and has no drawer. Recorded as an app-shell gap, not fixed in this unit |

## 6. Defects found and fixed during the pass

1. Two token names that do not exist (`--s5`, `--hairline`) silently dropped every border and gap — the first screenshots showed a page with no rules and a step indicator with no spacing.
2. Six-column tables cannot live in the 880px prose container: `PlainLayout` gained `size="console"` (1180px).
3. Utilization rendered as three stacked bars made a 40px row 68px tall: tables now use a one-line variant.
4. Every Compute page read the store without subscribing, so **Stop did nothing** and an added machine did not appear elsewhere. Fixed with `useCompute()` per page; the stop flow is now asserted in e2e.
5. A `<select>` shows its first option while state was empty, so validation called a filled field missing.
6. Accepting a recommendation for an unreachable machine said nothing about it; the band now quotes the target's status.

## 7. Known gaps

- 390px is blocked by the app shell, not by Compute (see §5).
- The five screens are in the main bundle (+24 KB gzip). Lazy-loading them is a follow-up.
- No cost, no staleness field, no real-time refresh: all three would need a backend contract (`MOCKED-AND-FUTURE.md` §2).
