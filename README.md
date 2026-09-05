# Portfolio Health Advisor, Starter Repo

**Theme:** Agentic AI
**Hackathon:** ACM Student Chapter Hackathon
**Duration:** 8 hours (offline)

> **Website UI (new):** the whole project also runs as a Next.js app —
> `./run-web.sh` → http://localhost:3000 (dashboard, charts, chat, compare).
> See `web/README.md`. The Python CLI/TUI below still works unchanged.

---

## Problem Statement

Retail investors often have a portfolio spread across several
stocks/funds but no easy way to understand it holistically how much
they've actually gained, how concentrated their risk is, and what they
should consider doing about it. You're going to automate a simplified
version of that reasoning process using a two-agent pipeline.

### Your Task

Build a **two-agent pipeline**:

**Agent 1 Analyst Agent**
- Reads the provided portfolio data (`sample_data/sample_portfolio.csv`)
- Calls two tools:
  - **Return Calculator** — current value & gain/loss per holding and
    overall
  - **Allocation Breakdown** — % concentration by sector/asset class
- Outputs structured findings (facts only, no advice yet)

**Agent 2 — Advisor Agent**
- Takes Agent 1's structured findings as input
- Reasons over them (no new tools needed) and produces a short,
  plain-English summary with 1–2 actionable suggestions

This is a **sequential handoff**: Agent 1's output → Agent 2's input.

### Core Requirements (must-have)

1. Load portfolio data from `sample_data/sample_portfolio.csv`.
2. Analyst Agent computes findings using both tools.
3. Advisor Agent converts findings into a readable recommendation.
4. Present both the findings and the final advice through a simple
   interface (CLI, notebook, or web UI your choice).

### Creative Extension Space (open-ended, graded separately)

- Tax-impact estimator tool (simple capital gains estimate)
- Finance news/sentiment tool feeding into the Advisor Agent's reasoning
- "What-if" rebalance simulation
- A third agent (e.g. a Risk Agent) extending the pipeline
- Multi-turn Q&A on top of the final advice (e.g. "why is my risk high?")

We want to see what *you* think makes portfolio advice actually useful.
Surprise us.

### Constraints

- No training/fine-tuning models from scratch, use an LLM API (free-tier)
  or a local model for the agent reasoning steps.
- Tools should be plain Python functions operating on the static sample
  data no real brokerage/market API integration required.
- Must run/demo on your own laptop (no paid infra dependency).
- Final submission = last commit pushed to your repo, submitted via the
  Google Form before the deadline.

---

## Setup

Easiest (one command, works with or without an API key):

```bash
./run.sh            # interactive menu + dashboard (uses the sample portfolio)
./run.sh --auto     # one-shot: prints everything + saves a report to outputs/
```

Manual setup:

```bash
git clone <your-team-repo-url>
cd p2

python -m venv venv
source venv/bin/activate      # on Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# then edit .env and add your free-tier key
```

Then run:

```bash
python3 src/main.py                       # full-screen TUI, mouse + keyboard (default)
python3 src/main.py --menu                # classic scrolling menu instead
python3 src/main.py --portfolio my.csv    # your own CSV (same columns)
python3 src/main.py --auto                # no menu: dashboard + report file
python3 src/main.py --non-interactive     # plain text output for scripts
```

Demo datasets in `sample_data/` (prices simulated):

| File | Holdings | Story |
|------|----------|-------|
| `sample_portfolio.csv` | 10 | Concentrated tech (default) |
| `large_portfolio_200.csv` | 200 | Even fictional spread |
| `portfolio_50_42.csv` | 50 | Real tickers, correlated returns |
| `portfolio_100_diversified_123.csv` | 100 | Diversified |
| `portfolio_200_diversified_42.csv` | 200 | Diversified |
| `portfolio_500_diversified_42.csv` | 500 | Large-scale demo |

```bash
python3 sample_data/generate_portfolio.py --n 200 --seed 42
python3 sample_data/generate_portfolio_enhanced.py --n 100 --seed 7 --scenario losers
# scenarios: concentrated | diversified | losers | high_dividend
```

You do **not** need a paid API key. Free tiers (Groq, Gemini, OpenAI trial
credits, or a local model via Ollama/HF) are all acceptable — pick
whatever's easiest for your team to set up quickly.

---

## Submission

1. Make sure your final code is committed and pushed.
2. Copy your **final commit hash** (`git log -1 --format="%H"`).
3. Submit it via the Google Form shared by the organizers, along with your
   team name/ID.
4. Judging happens at 3 checkpoints during the event.

---

## Evaluation

Full judging rubric:

| Criterion | Weight |
|---|---|
| Core Functionality | 40% |
| Code Quality & Repo Hygiene | 15% |
| UI/UX | 15% |
| Creativity / Extra Features | 20% |
| Presentation & Demo Clarity | 10% |