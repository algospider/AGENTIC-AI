# Portfolio Health Advisor — Web UI (Next.js)

Full TypeScript port of the Python project: same math (verified identical —
27,110.70 totals, 53.71% Tech, health 29.4/D), same agents, same free-tier
LLM via OpenCode Zen, plus charts.

## Run it

```bash
./run-web.sh            # from the repo root → http://localhost:3000
./run-web.sh --prod     # production build + serve
```

Or manually inside `web/`:

```bash
npm install
npm run dev             # http://localhost:3000
```

API keys live in `web/.env.local` (git-ignored, already filled in):

```bash
OPENAI_BASE_URL=https://opencode.ai/zen/v1
OPENAI_API_KEY=...
MODEL_ID=nemotron-3-ultra-free
```

Without a key the site still works — advice and Q&A fall back to the
built-in rule engine, exactly like the CLI.

## Deploy to Netlify (free)

The repo ships a `netlify.toml`, so deployment is configuration-free:

1. Push this repo to GitHub (already done for `algospider/AGENTIC-AI`).
2. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project** → connect GitHub → pick `AGENTIC-AI`.
3. Netlify reads `netlify.toml` automatically (base `web`, build `npm run build`). Change nothing.
4. Open **Site settings → Environment variables** and add:
   - `OPENAI_BASE_URL` = `https://opencode.ai/zen/v1`
   - `OPENAI_API_KEY` = your key (never commit this — dashboard only)
   - `MODEL_ID` = `nemotron-3-ultra-free`
5. **Deploy site.** API routes (`/api/advice`, `/api/qa`, `/api/quotes`) run as
   serverless functions — no extra setup.

## What's inside

| Path | Purpose |
|------|---------|
| `app/page.tsx` | Whole app: header, dataset picker, live toggle, 7 tabs, exports |
| `components/ui.tsx` | Cards, stats, health bar, badges, toasts, skeletons, timeline, live badge |
| `components/charts.tsx` | Allocation pie + winners/losers bars (recharts) |
| `components/views.tsx` | Holdings, rebalance, projection+SIP, lab, chat |
| `lib/portfolio.ts` | Port of `src/tools.py` + deterministic agent logic |
| `lib/agents.ts` | 5-agent orchestra (Analyst → Risk → Planner → Sentinel → Advisor) with run timeline |
| `lib/report.ts` | Markdown/JSON report builders + download |
| `app/api/advice/route.ts` | Zen LLM advice + shared file cache with the CLI (`outputs/.advice_cache`) |
| `app/api/qa/route.ts` | Zen LLM Q&A with offline fallback |
| `app/api/quotes/route.ts` | Live prices via Yahoo Finance (no key; unknown tickers keep CSV prices) |
| `public/datasets/` | All 6 sample CSVs served to the browser |

Tabs: **Dashboard** (stats, health, pie, P&L bars, alerts, advice) ·
**Holdings** (searchable table) · **Rebalance** (cap slider + harvest) ·
**Projection** (scenarios + SIP planner) · **Lab** (trim / targets / stress) ·
**Q&A** (chat with suggestion chips) · **Datasets** (switch, upload, A/B compare).

All analysis except the two LLM calls runs instantly in the browser.
