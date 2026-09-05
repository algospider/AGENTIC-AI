# Portfolio Health Advisor — User Manual

> An agentic-AI app that reads your stock portfolio and tells you, in plain
> English, how healthy it is and what to consider doing next.

---

## 1. What it does

| Step | Agent | What happens |
|------|-------|--------------|
| 1 | **Analyst** | Reads your portfolio CSV and computes facts: profit/loss per holding and overall, plus sector concentration. No opinions — just math. |
| 2 | **Risk** | Scores risk (LOW/MEDIUM/HIGH), volatility/Sharpe-style metrics, and stress impact. |
| 3 | **Planner** | Builds the rebalance plan, growth projection, and SIP goal. |
| 4 | **Tax** | Prices every move: capital-gains estimate plus tax-loss harvest pairs (which loser offsets which winner). Simplified flat-rate math — educational, not tax advice. |
| 5 | **Sentinel** | Raises threshold alerts (critical / warn / ok). |
| 6 | **Scout** | Writes "Today's brief" — up to 5 plain-English insights, most urgent first. |
| 7 | **Advisor** | An LLM (free-tier, via OpenCode Zen) turns those facts into a short summary with 1–2 actionable suggestions. Works **offline too** — a built-in rule engine takes over when there is no API key. |
| 8 | **Q&A** | Ask follow-up questions in your own words ("why is my risk high?", "SIP for 50000 in 3 years?", "give me the brief"). |

## 2. Installation

**Requirements:** Python 3.10+ (3.14 works), ~2 minutes.

```bash
git clone https://github.com/algospider/AGENTIC-AI.git
cd AGENTIC-AI

# Easiest: one command does setup + launch
./run.sh

# ...or manually:
python3 -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
python3 -m pip install -r requirements.txt
cp .env.example .env        # optional but recommended (enables AI advice)
```

Then open `.env` and make sure it contains your key (free-tier key for
`https://opencode.ai/zen/v1`; the default free model is `nemotron-3-ultra-free`).
**Without a key everything still works** — advice comes from the rule engine.

## 3. Running the app

```bash
python3 src/main.py                                             # full-screen TUI (mouse + keyboard)
python3 src/main.py --menu                                      # classic scrolling menu
python3 src/main.py --portfolio my.csv                          # your own portfolio file
python3 src/main.py --portfolio my.csv --auto                   # one-shot: print all + save report
python3 src/main.py --non-interactive                           # plain text (for scripts/judges)
python3 src/main.py --question "why is my risk high?"           # answer one question and exit
python3 src/main.py --refresh                                   # ignore cached AI advice, regenerate
python3 src/main.py --export                                    # save Markdown report to outputs/ and exit
```

**Full-screen TUI keys:** `1–8` switch views (Dashboard, Holdings, Rebalance,
Projection, What-If lab, Ask Advisor, Export, **Datasets & compare**), `h` opens help,
`q` quits. Everything is also clickable with the mouse.

**Switching datasets without restarting:** open view `8` (or Rich-menu option
`7`), click any portfolio to load it instantly (advice is cached), import your
own CSV by path, or pick two and hit **Compare A vs B** for a side-by-side
verdict (return, health, concentration, losers).

## 4. Your portfolio file (CSV)

Same columns as `sample_data/sample_portfolio.csv`:

```csv
ticker,company_name,sector,quantity,buy_price,current_price
TCHX,TechCorp Innovations,Technology,25,142.50,198.30
```

Rules: column names must match exactly · `quantity ≥ 0` · prices must be numbers.
A missing file or bad column prints a friendly hint telling you exactly what's wrong.

**Ready-made demo datasets** (all in `sample_data/`, prices simulated):

| File | Holdings | Character |
|------|----------|-----------|
| `sample_portfolio.csv` | 10 | Concentrated tech story (default) |
| `large_portfolio_200.csv` | 200 | Evenly spread fictional companies |
| `portfolio_50_42.csv` | 50 | Real tickers, correlated returns |
| `portfolio_100_diversified_123.csv` | 100 | Diversified, real tickers |
| `portfolio_200_diversified_42.csv` | 200 | Diversified, real tickers |
| `portfolio_500_diversified_42.csv` | 500 | Large-scale demo |

Generate your own (fictional names, always unique tickers):

```bash
python3 sample_data/generate_portfolio.py --n 200 --seed 42
python3 sample_data/generate_portfolio_enhanced.py --n 100 --seed 7 --scenario losers
# scenarios: concentrated | diversified | losers | high_dividend
python3 src/main.py --portfolio sample_data/large_portfolio_200.csv --auto
```

## 5. Features at a glance

**Core analysis**
- Per-holding and total returns (value, cost, P&L, P&L%) — exact to the cent, sectors always sum to 100.00%.
- Sector allocation with concentration bars and HHI index.

**Creative extensions**
- **Health score** 0–100 + grade (A/B/C/D) with a penalty breakdown.
- **Today's brief** — up to 5 auto-written insights (concentration, winners/losers, harvest, trim), most urgent first.
- **One-click rebalance plan** — caps every sector at 35%, lists exact SELL quantities and BUY amounts.
- **Growth projection** — 5/10/15% scenarios over 5 years (illustration, not a forecast).
- **Stress-test lab** — "what if Technology fell 20%?" with portfolio impact.
- **SIP goal planner** — exact monthly investment for any target ("SIP for 100000 in 5 years").
- **Tax estimators** — flat-rate capital-gains estimate + tax-loss harvest pairs (which loser offsets which winner).
- **Risk-adjusted metrics** — volatility, Sharpe-like proxy, win rate, best/worst contributors.
- **Alert center** — CRITICAL/WARN/OK threshold signals (sector caps, single-stock caps, 10–20% drawdowns).
- **A/B compare** — any two datasets head-to-head with automatic verdicts.
- **Report export** — Markdown **and** JSON into `outputs/` with one click.
- **Advice cache** — repeat runs answer in ~0.2s instead of ~11s.

## 6. Understanding your results

- **Health D + HIGH risk** on the sample portfolio is expected: Technology is
  ~54% of the money (threshold: 30%), one holding (SEMI) exceeds 20%, and three
  holdings are at a loss. The rebalance plan shows exactly how to fix it.
- **Tax numbers are simplified** (flat 15% on gains, unrealized only) and the
  projections are straight compounding illustrations — educational, **not
  financial advice** (every output says so).

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Could not find 'my.csv'` | Check the path; CSVs live best in `sample_data/`. |
| `Missing required columns` | Rename headers to `ticker,company_name,sector,quantity,buy_price,current_price`. |
| `No .env file` warning | Harmless — rule-engine mode. Add `.env` for AI advice. |
| `LLM ... failed` lines, then an answer | Free-model hiccup; automatic retry + fallback already handled it. |
| Full-screen won't start | `pip install textual`, or use `--menu`. Piped output always uses plain text. |
| `OutOfBounds` in tests | Only affects the 80×24 test screen; real terminals scroll. |

## 8. For developers

```
src/tools.py    deterministic tools (all math, zero LLM calls)
src/agents.py   analyst / risk / advisor / Q&A agents
src/llm.py      OpenCode Zen client (OpenAI-compatible) + retry + fallback
src/app_tui.py  full-screen Textual TUI (mouse + keyboard)
src/tui.py      classic Rich menu UI
src/report.py   Markdown report exporter
src/main.py     CLI entry point, advice cache, friendly error handling
tests/          test_tools.py · test_agents.py (LLM stubbed) · test_tui.py (mouse clicks)
scripts/build_presentation.py  regenerates the slide deck below
```

Run the suite: `python3 tests/test_tools.py && python3 tests/test_agents.py && python3 tests/test_tui.py`

## 9. Presentation

`presentation/Portfolio_Health_Advisor.pptx` — slide deck for the demo
(regenerate anytime with `python3 scripts/build_presentation.py`).

## 10. Website UI (Next.js)

The entire project is ported to a website in `web/` — same math (verified
identical to Python), same agents, charts included:

```bash
./run-web.sh            # → http://localhost:3000
```

Tabs: Dashboard (stats, health bar, **agent orchestra timeline**, allocation pie, P&L bars, alerts, advice) ·
Holdings (searchable, **add / remove holdings, download your edited CSV**) · Rebalance (cap slider + harvest) · Projection (SIP
planner) · Lab (trim / targets / stress-test) · Q&A chat · Datasets (switch,
upload your CSV, A/B compare). Export downloads `.md`/`.json` reports.
API keys live in `web/.env.local`; without one the rule engine takes over.
Only the Advice and Q&A calls hit the network — everything else computes
instantly in your browser. Details in `web/README.md`, design tokens in `design.md`.

**Going live:** hit **● Go live** in the header to refresh real-ticker prices
from Yahoo Finance (free, no key). Fictional tickers keep CSV prices, the run
re-executes through all five agents, and one click returns to CSV prices.
