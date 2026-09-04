# Evaluation Criteria — Portfolio Health Advisor Agent

This rubric applies to this problem statement and follows the same weight
structure used across every problem statement in this hackathon, so all
teams are judged on a comparable basis regardless of theme/track.

| Criterion | Weight | What judges look for |
|---|---|---|
| **Core Functionality** | 40% | Does the two-agent pipeline run end-to-end on the sample (or a new, similarly-shaped) portfolio? Does the Analyst Agent's findings correctly reflect the return/allocation tool outputs? Is the Advisor Agent's advice coherent and grounded in those findings (not hallucinated/generic)? |
| **Code Quality & Repo Hygiene** | 15% | Readable code, sensible structure, meaningful commit history, no hardcoded secrets/API keys, README updated with the team's own setup/run notes |
| **UI/UX** | 15% | Is the chosen interface (CLI / web / notebook) usable and clear? Are both the findings and the final advice presented legibly? |
| **Creativity / Extra Features** | 20% | Quality and usefulness of self-added features beyond the core requirements (extra tools, a third agent, what-if simulation, etc.) — judged on originality and execution, not quantity |
| **Presentation & Demo Clarity** | 10% | Can the team clearly explain the two-agent flow and demo it live within the given time? |

---

## Checkpoint-wise Scoring Guidance

Judging happens 3 times during the 8-hour event.

### Checkpoint 1 (~1–2 hrs in)
Focus: **are the two core tools implemented and callable?**
- Full credit: `calculate_returns()` and `calculate_allocation()` both
  work correctly on the sample portfolio.
- Partial credit: one tool working, environment set up correctly, clear
  progress toward both.
- Mostly reflects progress on **Core Functionality**.

### Checkpoint 2 (mid-point)
Focus: **does the Analyst Agent produce findings, and is the Advisor Agent wired up?**
- Full credit: Agent 1 produces a complete findings dict; Agent 2 is at
  least producing some form of output from it (even if rough).
- Partial credit: Agent 1 complete, Agent 2 in progress.
- Reflects **Core Functionality** + early **UI/UX** signal.

### Checkpoint 3 (final)
Full rubric applied across all 5 criteria above.

---

## Fairness Notes for Jury

- Score teams **relative to this problem's difficulty as announced at the
  start** — do not compare this Agentic-track team's creativity score
  directly against a Multimodal or MLOps-track team's. Creativity scores
  are normalized *within* each problem statement, not across themes.
- The two-agent split is intentionally lightweight — Agent 2 requires no
  new tools, only reasoning over Agent 1's output. Do not penalize teams
  for keeping the implementation simple (e.g. two plain Python functions,
  each making one LLM call) — that is the intended scope, not a shortcut.
- Reward **thoughtful, working** additions over flashy-but-broken ones — a
  working tax-impact estimate beats a half-built third agent that never
  runs.
- A team that focuses entirely on a polished, robust two-agent core with
  no extra features can still score well (up to 80%) — creativity is a
  bonus layer, not a requirement to be competitive.
- Deduct marks for hardcoded API keys committed to the repo, plagiarized
  code without attribution, or non-functional submissions with no visible
  progress at any checkpoint.
