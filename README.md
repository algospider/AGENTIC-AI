# Portfolio Health Advisor

### *Your money, finally explained in plain English.*

**🌐 Live demo → [portfoliohealthadvisor.netlify.app](https://portfoliohealthadvisor.netlify.app/)**

---

Most of us own a handful of stocks across different companies — and have no
real idea how we're actually doing. Are we really making money? Is everything
secretly riding on one sector? What should we even do about it?

**Portfolio Health Advisor answers those three questions for you.**
Upload a portfolio (or pick a sample), and a team of AI specialists reads every
holding, measures your gains to the last cent, spots where your risk is hiding,
and tells you — in simple, honest language — what to consider doing next.

No jargon. No 40-page reports. Just clarity.

---

## What it feels like to use

**📊 A health score for your money.**
One number, 0–100, with a grade. Underneath it, a plain breakdown of exactly
what's helping and what's hurting — like a report card you can actually act on.

**🔍 Risk, named out loud.**
"Technology is 54% of your money." "One stock alone is 20%." "Three holdings
are quietly losing." Every warning comes with a threshold, so you always know
*why* something is flagged — and the moment it stops being true.

**✂️ A fix-it plan, down to the share.**
One click builds a rebalancing plan: exactly what to trim, how many shares,
where the freed money should go, and what tax each move would roughly cost.
It even pairs your losers with winners so losses can offset gains.

**🔮 A glimpse of tomorrow.**
See your money compound at 5, 10, 15% — then flip it around: tell it your goal
("₹1,00,000 in 5 years") and it tells you the monthly SIP to get there.
Crash-test any sector ("what if tech fell 20%?") before the market does it
for you.

**💬 Ask anything, in your own words.**
*"Why is my risk high?" · "How do I rebalance?" · "SIP for 50000 in 3 years?"*
A chat advisor answers from *your* numbers — never generic tips.

**📁 Your data, your way.**
Start from a sample, upload a broker statement (PDF, Excel, CSV — an Extractor
Agent reads it for you), type holdings in by hand, or flip on **live market
prices**. Save analyses to your personal library. Compare any two portfolios
side by side.

---

## Under the hood (the 30-second version)

Seven specialist agents work as a relay team — one measures, one scores danger,
one plans the way out, one prices the tax, one sets tripwires, one writes your
morning brief, and one explains it all in plain English. Every number is
computed with exact, testable math (audited to the cent across all datasets);
the AI only ever *narrates* — it never invents figures. If the AI is ever
unreachable, a built-in rule engine takes over instantly, so the app never
goes speechless.

---

## Try it yourself

| Way in | How |
|---|---|
| 🌐 Website (easiest) | Open **[portfoliohealthadvisor.netlify.app](https://portfoliohealthadvisor.netlify.app/)** — no install, no signup needed to explore |
| 💻 Terminal UI | `./run.sh` — full-screen dashboard with mouse + keyboard |
| 📓 One-shot report | `python3 src/main.py --auto` — prints everything, saves Markdown + JSON |

Prefer your own data? Any CSV with
`ticker, company_name, sector, quantity, buy_price, current_price` works —
or generate a realistic 500-stock demo set with one command (see `USER_MANUAL.md`).

---

## Docs for the curious

- **`PROJECT_MANUAL.md`** — every agent, every formula, the full pipeline, and a presenting guide
- **`USER_MANUAL.md`** — setup, all run modes, troubleshooting
- **`design.md`** — the visual system behind the website
- **`presentation/`** — the slide deck

*Built for the ACM Student Chapter Hackathon — Agentic AI theme.
Educational demo on simulated data. Not financial advice.*
