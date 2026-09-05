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
| `app/api/extract/route.ts` | **Extractor Agent**: PDF (unpdf) / Excel (xlsx) / CSV / text → validated holdings + warnings |
| `lib/extract.ts` | Header-synonym mapping, statement-line heuristics, sector guessing, dup-safe merge |
| `lib/firebase.ts` | Firebase Auth client (email/password + Google, friendly errors) |
| `lib/library.ts` | Personal library in per-user localStorage (Netlify-safe, no server disk) |
| `public/datasets/` | All 6 sample CSVs served to the browser |

Tabs: **Overview** (stats, health bar, agent timeline, pie, P&L bars, alerts, advice) ·
**Holdings** (search, **add / edit / delete**, download CSV) ·
**Plan** (rebalance + projection + SIP planner) · **Lab** (trim / targets /
stress-test + A/B compare) · **Ask** (chat with suggestion chips) ·
**My Data** (your saved portfolios when signed in, samples, **upload a broker
PDF / Excel / CSV for the Extractor Agent**, blank portfolio, saved reports).
Header: **＋ New** (upload / import / blank / add holding), live prices, theme,
auth, Export menu.

All analysis except the two LLM calls runs instantly in the browser.

## Accounts & personal library (Firebase)

Header → **Sign in**: email + password or **Continue with Google**, powered by
Firebase Auth (`lib/firebase.ts` — project `portfolio-health-advisor`).
Signed-in users get a **Library** tab: save any analysis, reopen it instantly
with zero AI calls, delete anytime. Saved reports live per-user in the browser
(`localStorage`) — this is deliberate: serverless filesystems (Netlify/Vercel)
are ephemeral, so server file storage would silently lose data in production.

Console checklist (Firebase Console → Authentication):
- **Sign-in method**: enable *Email/Password* and *Google*.
- **Settings → Authorized domains**: add `localhost` (dev) and your
  `*.netlify.app` domain (prod), or sign-in fails with `auth/unauthorized-domain`.
- The browser `apiKey` in `lib/firebase.ts` is public by design; restrict it
  under Google Cloud → Credentials → API restrictions if you want.
- Optional overrides without code edits: `NEXT_PUBLIC_FIREBASE_*` env vars.
