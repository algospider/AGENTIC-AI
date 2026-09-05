# Project Manual — Portfolio Health Advisor
*Understand every agent, every calculation, and how data flows through the whole system — so you can present it with confidence.*

---

## 1. The big picture (say this first in any demo)

Retail investors can't answer three simple questions about their own money:
**how much did I really gain, how concentrated is my risk, and what should I do?**
This project automates that reasoning with a **pipeline of specialist agents**:
raw portfolio CSV in → verified math → risk/tax/planning analysis → plain-English
advice out, plus a chat interface for follow-up questions.

```
sample_data/*.csv (or your own CSV, or live Yahoo prices on web)
        │
        ▼
┌──────────────┐   ┌──────────────────────────────────────────────────┐
│  VALIDATION  │──▶│  ANALYST AGENT (facts only, no opinions)          │
│ _validate()  │   │  calculate_returns + calculate_allocation        │
└──────────────┘   └──────────────────────┬───────────────────────────┘
                                          │ findings {analysis, returns, allocation}
        ┌─────────────────────────────────┼─────────────────────────────────┐
        ▼                                 ▼                                 ▼
┌───────────────┐              ┌──────────────────────┐            ┌──────────────────┐
│ RISK AGENT    │              │ PLANNER AGENT        │            │ TAX AGENT        │
│ danger +      │              │ way out: plan,       │            │ cost of acting:  │
│ wobble        │              │ projection, SIP goal │            │ tax bill +       │
└───────┬───────┘              └──────────┬───────────┘            │ harvest pairs    │
        │                                 │                      └────────┬─────────┘
        ▼                                 ▼                               ▼
┌────────────────┐              ┌─────────────────────┐     ┌───────────────────────┐
│ SENTINEL AGENT │              │ SCOUT AGENT         │     │ ADVISOR AGENT (LLM)   │
│ tripwires:     │              │ "Today's brief":    │     │ 120-word summary +    │
│ alerts         │─────────────▶│ top-5 insights      │────▶│ 1–2 suggestions       │
└────────────────┘              └─────────────────────┘     └───────────┬───────────┘
                                                                       ▼
                                                              ┌──────────────────┐
                                                              │ Q&A AGENT (chat) │
                                                              │ follow-up Qs     │
                                                              └──────────────────┘
```

Two implementations share identical math: **Python CLI/TUI** (`src/`) and the
**Next.js website** (`web/`, TypeScript port verified number-for-number).
The website never calls Python — it re-implements the same logic (see §9).

---

## 2. Data in: the portfolio CSV

Columns (exact names required): `ticker, company_name, sector, quantity, buy_price, current_price`.
`_validate()` rejects missing columns, non-numeric prices, and negative quantities
with a beginner-friendly error. Duplicate tickers are **aggregated, never dropped**.

| File | Holdings | Story (verified outputs) |
|---|---|---|
| `sample_portfolio.csv` | 10 | Concentrated: Tech 53.71%, +8.75%, health 29.4/D |
| `large_portfolio_200.csv` | 200 | Even fictional spread, ~₹3.85M |
| `portfolio_50_42.csv` | 50 | Real tickers, correlated returns |
| `portfolio_100_diversified_123.csv` | 100 | Diversified |
| `portfolio_200_diversified_42.csv` | 200 | Diversified |
| `portfolio_500_diversified_42.csv` | 500 | Large-scale demo |
| `generate_portfolio.py` / `generate_portfolio_enhanced.py` | — | Seeded generators (fictional names / real tickers + scenarios) |

Web only: **Go live** replaces `current_price` with real Yahoo Finance quotes
(batch `spark` endpoint, no key; unknown tickers keep CSV prices; one-click revert).

---

## 3. The tools — every calculation, with a worked example

All tools are **deterministic** (same input → same output, no AI inside) and live in
`src/tools.py` (Python) / `web/lib/portfolio.ts` (TypeScript). Math runs on exact
values; rounding to 2dp happens only on output; sector shares are
largest-remainder normalized so they always sum to exactly 100.00.

Worked example — holding TCHX: 25 shares, bought 142.50, now 198.30:

- `cost_value = 25 × 142.50 = 3562.50`
- `current_value = 25 × 198.30 = 4957.50`
- `pnl = 4957.50 − 3562.50 = +1395.00`
- `pnl_pct = 1395.00 / 3562.50 × 100 = +39.16%`

| # | Tool (Python / TS) | What it computes | Key formula / rule |
|---|---|---|---|
| 1 | `calculate_returns` | Per-holding value, P&L, P&L%; portfolio totals; best/worst ticker; winners/losers count | Totals summed from **exact** values, then rounded. Sample: value 27,110.70, +2,180.40 (+8.75%), 7W/3L |
| 2 | `calculate_allocation` | Sector % and holding % of current value; top sector/holding; HHI concentration index | `weight = value/total × 100`; `HHI = Σ weight²` (sample 3207.72; ≥2500 = highly concentrated) |
| 3 | `assess_risk` | Level LOW/MEDIUM/HIGH + score 25/55/80 + flag list | HIGH if top sector ≥50%; MEDIUM if sector ≥30%, holding ≥20%, or HHI ≥2500; always lists losers + worst |
| 4 | `health_score` | 0–100 score + grade A≥80 B≥65 C≥50 else D, with penalty breakdown | Start 100; −(top−30)×1.5 (cap 40); −10 single holding ≥20%; −10 HHI≥2500; −5/loser (cap 15); −5 worst ≤−10%; +5 if overall gain. Sample: 29.4/D |
| 5 | `estimate_tax` | Flat-rate (default 15%) gains estimate | `tax = Σ max(0, pnl) × rate` → sample ≈ 429.65. Simplified, unrealized only |
| 6 | `tax_loss_harvest` | Pairs each loser with winners to offset gains | Greedy biggest-winner-first; sample: 3 pairs save ~102.6 |
| 7 | `rebalance_plan` | Caps every sector at 35%: exact SELL qty/value per holding, BUY per sector | Trims overweight pro-rata, redeploys to underweight pro-rata. Sample frees ≈ ₹5,072 |
| 8 | `simulate_rebalance` | What-if lab: trim-a-holding **or** target weights | Trim: proceeds = qty×price×fraction; Targets: delta_value per sector |
| 9 | `project_growth` | Compounding at 5/10/15% over 5y | `FV = PV(1+r)^n`. Illustration, not a forecast |
| 10 | `sip_for_goal` | Monthly SIP for a target | `PMT = FV·r/((1+r)^n−1)`, r=annual/12. E.g. ₹1,00,000 in 5y @10% ≈ ₹1,291/mo |
| 11 | `stress_test` | Sector crash impact (default: top sector −20%) | Sample: Tech −20% → portfolio −10.74% → ≈24,199. Hypothetical |
| 12 | `risk_metrics` | Volatility (std of holding returns), Sharpe proxy = return/vol, win rate, avg win/loss, best/worst contributor | Single-period estimates for comparison |
| 13 | `build_alerts` | CRITICAL/WARN/OK tripwires, severity-sorted | Critical: sector ≥50%, holding ≥25%, holding ≤−20%. Warn: sector ≥30%, holding ≥20%, ≤−10%, HHI≥2500 |
| 14 | `build_insights` | "Today's brief": ≤5 title+body insights, urgent first | Concentration headline, best/worst spotlight, harvest + trim opportunities, protection note |

---

## 4. The agents — who calls what, in order

### Python (`src/agents.py`)

| Order | Agent | Input → Output | How |
|---|---|---|---|
| 1 | **Analyst** | CSV → `findings {analysis, returns, allocation}` | Calls tools #1–2 only. Facts, zero advice |
| 2 | **Risk** | findings → `risk, metrics, stress` (+ assembles full bundle) | Calls #3, #12, #11; reuses Analyst output when present |
| 3 | **Planner** *(folded into risk_agent's bundle)* | → `plan, projection, goal` | Calls #7, #9, #10 |
| 4 | **Tax** (`tax_agent`) | → `{tax, harvest}` | Calls #5, #6. `risk_agent` sources its tax/harvest **from this agent** (tested) |
| 5 | **Sentinel** *(in bundle)* | → `alerts` | Calls #13 |
| 6 | **Scout** *(in bundle)* | → `insights` | Calls #14 on (returns, allocation, risk, harvest, plan) |
| 7 | **Advisor** | findings + bundle → 120-word English advice | Builds a capped JSON prompt (findings ≤3200 chars, slim context ≤2800), calls Zen LLM (`nemotron-3-ultra-free`, temp 0.4, ≤600 tokens, 30s timeout, 1 retry, urllib fallback). **Any failure → rule-based `_fallback_advice`** (same facts, template prose) |
| 8 | **Q&A** | question + last-6 chat turns + bundle → answer | Same LLM path with 100-word cap; offline → keyword branches: health, rebalance, SIP (parses numbers live), projection, stress, harvest, brief, alerts, sharpe, risk, tax, losers, fallback summary |

### Web (`web/lib/agents.ts` — visible orchestra)

Same six specialists as **timed stages** with a live timeline UI
(Analyst → Risk → Planner → Tax → Sentinel → Scout), then Advisor via
`/api/advice`. Verified **byte-identical** to `analystBundle()` output.

### LLM layer (`src/llm.py`, `web/app/api/*`)

- Provider: OpenCode Zen, OpenAI-compatible (`OPENAI_BASE_URL`, key, `MODEL_ID`).
- No key / any error → rule engine. Demo never dies.
- Advice cached by `sha256(csv bytes + MODEL_ID)` in `outputs/.advice_cache/` — **shared by CLI and web**, so repeat runs answer in ~0.2s instead of ~11s (`--refresh` bypasses).

---

## 5. How to run / present it

| Mode | Command | Best for |
|---|---|---|
| Full-screen TUI | `python3 src/main.py` (TTY) / `--fullscreen` | Live demo: mouse + keys 1–8, dashboards, labs, chat |
| Classic menu | `--menu` | Projector-friendly scrolling output |
| One-shot | `--auto` | Prints everything + saves Markdown **and** JSON reports |
| Judge script | `--non-interactive` | Plain sections incl. METRICS/ALERTS/INSIGHTS |
| Single question | `--question "..."` | "Why is my risk high?" |
| Website | `./run-web.sh` → localhost:3000 | 6 tabs, charts, live prices, holding editor, A/B compare |
| Deck | `presentation/Portfolio_Health_Advisor.pptx` | Pre-built slides (rebuild: `scripts/build_presentation.py`) |

---

## 6. Presenting: what to say

**30 seconds:** "We automate what a human advisor does first: measure the portfolio exactly, name the risks, price the fixes — then an LLM explains it in plain English. Sample: Tech is 54% of the money, health 29 out of 100, and one trim frees about five thousand."

**2 minutes:** 30s version + live dashboard tour: health gauge → red concentration bar → rebalance table → ask "SIP for 100000 in 5 years?" → export report.

**5 minutes:** add What-If lab (crash Technology 20%), Datasets view (load the 500-holding file — same pipeline, milliseconds), Go-live prices, test suite run.

**Jury questions you'll ace:**
- *"Why agents, not one script?"* — Separation of concerns: deterministic math stays testable (14 tools, 0 LLM calls inside), LLM only synthesizes prose; any agent is replaceable, and the timeline UI proves the handoff.
- *"What if the LLM fails/offline?"* — Every LLM call has retry + rule-based fallback; demo with `OPENAI_API_KEY=""` to prove it.
- *"How do you know the math is right?"* — Totals reconcile to the cent on all 6 datasets; sectors sum to exactly 100.00; `tests/` cover tools, agents (LLM stubbed), and real mouse-click TUI tests.
- *"Real data?"* — Seeded generators + optional live Yahoo prices; real-ticker files are simulated prices (say so — honesty scores).
- *"Is this financial advice?"* — No: every output says so; tax/projections are simplified illustrations.

---

## 7. File map (where everything lives)

```
src/tools.py        14 deterministic tools (§3)          src/agents.py      8 agents (§4)
src/pipeline.py     load / cache / list / compare        src/llm.py         Zen client + retry + fallback
src/main.py         CLI flags (§5)                       src/tui.py         Rich menu UI
src/app_tui.py      Textual fullscreen UI                src/report.py      Markdown + JSON export
web/lib/...         TS port (portfolio.ts, agents.ts)    web/app/api/...   advice · qa · quotes routes
web/app/page.tsx    7-tab site                           web/components/    ui · charts · views · icons
sample_data/        6 CSVs + 2 generators                tests/             tools · agents · TUI-click tests
design.md           web design system                    USER_MANUAL.md     usage guide
```

*Companion docs: `USER_MANUAL.md` (how to use), `design.md` (how it looks), `web/README.md` (site internals).*
