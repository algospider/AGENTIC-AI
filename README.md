# Portfolio Health Advisor — Starter Repo

**Theme:** Agentic AI
**Hackathon:** ACM Student Chapter Hackathon
**Duration:** 8 hours (offline)

---

## 📋 Problem Statement

Retail investors often have a portfolio spread across several
stocks/funds but no easy way to understand it holistically — how much
they've actually gained, how concentrated their risk is, and what they
should consider doing about it. You're going to automate a simplified
version of that reasoning process using a two-agent pipeline.

### Your Task

Build a **two-agent pipeline**:

**Agent 1 — Analyst Agent**
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

This is a **sequential handoff**: Agent 1's output → Agent 2's input. You
do not need routing logic, shared memory, or an orchestrator deciding
which agent to call — keep it simple.

### Core Requirements (must-have)

1. Load portfolio data from `sample_data/sample_portfolio.csv`.
2. Analyst Agent computes findings using both tools.
3. Advisor Agent converts findings into a readable recommendation.
4. Present both the findings and the final advice through a simple
   interface (CLI, notebook, or web UI — your choice).

### Creative Extension Space (open-ended, graded separately)

- Tax-impact estimator tool (simple capital gains estimate)
- Finance news/sentiment tool feeding into the Advisor Agent's reasoning
- "What-if" rebalance simulation
- A third agent (e.g. a Risk Agent) extending the pipeline
- Multi-turn Q&A on top of the final advice (e.g. "why is my risk high?")

We want to see what *you* think makes portfolio advice actually useful.
Surprise us.

### Constraints

- No training/fine-tuning models from scratch — use an LLM API (free-tier)
  or a local model for the agent reasoning steps.
- Tools should be plain Python functions operating on the static sample
  data — no real brokerage/market API integration required.
- Must run/demo on your own laptop (no paid infra dependency).
- Final submission = last commit pushed to your repo, submitted via the
  Google Form before the deadline.

---

## 🛠️ Setup

```bash
# 1. Clone this repo (your team's copy)
git clone <your-team-repo-url>
cd portfolio-advisor-starter

# 2. Create a virtual environment
python -m venv venv
source venv/bin/activate      # on Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up your API key (if using an LLM API for agent reasoning)
cp .env.example .env
# then edit .env and add your free-tier key
```

You do **not** need a paid API key. Free tiers (Groq, Gemini, OpenAI trial
credits, or a local model via Ollama/HF) are all acceptable — pick
whatever's easiest for your team to set up quickly.

---

## ▶️ Quickstart

Open `notebooks/quickstart.ipynb` to see the sample portfolio loaded as a
DataFrame — it stops there on purpose. Building the tools, agents, and
pipeline is your job. Stub functions are provided in `src/tools.py` and
`src/agents.py` to help you get started without a blank page.

Run the pipeline once wired up:
```bash
python src/main.py --portfolio sample_data/sample_portfolio.csv
```

---

## 📤 Submission

1. Make sure your final code is committed and pushed.
2. Copy your **final commit hash** (`git log -1 --format="%H"`).
3. Submit it via the Google Form shared by the organizers, along with your
   team name/ID.
4. Judging happens at 3 checkpoints during the event — make sure something
   runnable exists at each checkpoint, even if incomplete.

---

## ⚖️ Evaluation

See [`docs/evaluation_criteria.md`](docs/evaluation_criteria.md) for the
full judging rubric. In short:

| Criterion | Weight |
|---|---|
| Core Functionality | 40% |
| Code Quality & Repo Hygiene | 15% |
| UI/UX | 15% |
| Creativity / Extra Features | 20% |
| Presentation & Demo Clarity | 10% |

---

## ❓ FAQ

**Does Agent 2 need its own tools?**
No — Agent 2 (Advisor) should reason purely over Agent 1's structured
output. Keep it simple: one LLM call that turns findings into advice.

**Can the "agents" just be two functions that each make one LLM call?**
Yes, absolutely. You don't need a heavyweight agent framework — a clean
sequential pipeline of two well-scoped LLM calls with tool use in the
first one is exactly the intended scope.

**Can we use an agent framework (LangChain, CrewAI, LlamaIndex, etc.)?**
Yes, if you're comfortable with it — but it's not required. Plain Python
+ an LLM API call is perfectly sufficient and often faster to build in 7
hours.

**Is live market data required?**
No — use the static `current_price` column already provided in the sample
CSV. No API calls to real market data needed.

Good luck — build something you'd actually trust to look at your own
portfolio!
