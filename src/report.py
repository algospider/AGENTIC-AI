"""Export beginner-friendly Markdown (+JSON) reports of the full analysis."""

import json
from datetime import datetime
from pathlib import Path


def build_report(portfolio_path: str, findings: dict, risks: dict, advice: str) -> str:
    """Write report to outputs/ and return its path."""
    t = findings["returns"]["totals"]
    a = findings["allocation"]
    risk, tax = risks.get("risk", {}), risks.get("tax", {})
    health, plan = risks.get("health", {}), risks.get("plan", {})
    proj = risks.get("projection", {})
    stress, harvest = risks.get("stress", {}), risks.get("harvest", {})
    goal = risks.get("goal", {})
    metrics, alerts = risks.get("metrics", {}), risks.get("alerts", [])
    insights = risks.get("insights", [])

    lines = [
        "# Portfolio Health Report",
        f"_Generated {datetime.now():%Y-%m-%d %H:%M} from `{portfolio_path}`_",
        "",
        f"## Health Score: {health.get('score', '?')}/100 (Grade {health.get('grade', '?')})",
        *[f"- {b}" for b in health.get("breakdown", [])],
        "",
        "## Summary",
        findings.get("analysis", ""),
        "",
        "## Today's Brief",
        *([f"- [{i['tone'].upper()}] {i['title']} — {i['body']}" for i in insights]
          if insights else ["- No insights."]),
        "",
        "## Returns",
        f"- Total value: {t['total_value']} (cost {t['total_cost']})",
        f"- Profit: {t['total_pnl']:+} ({t['return_pct']:+}%)",
        f"- Winners {t['num_winners']} / Losers {t['num_losers']} "
        f"(best {t['best_ticker']}, worst {t['worst_ticker']})",
        "",
        "## Allocation",
        *[f"- {s}: {p}%" for s, p in sorted(a.get("by_sector", {}).items(), key=lambda x: -x[1])],
        f"- HHI concentration index: {a.get('hhi')}",
        "",
        "## Risk",
        f"- Level: {risk.get('risk_level')} ({risk.get('risk_score')}/100)",
        *[f"- {f}" for f in risk.get("flags", [])],
        f"- Volatility {metrics.get('volatility_pct')}% · Sharpe proxy {metrics.get('sharpe_proxy')} · "
        f"win rate {metrics.get('win_rate_pct')}% (best {metrics.get('best_contributor')}, "
        f"worst {metrics.get('worst_contributor')})",
        "",
        "## Alerts",
        *([f"- [{a['severity'].upper()}] {a['text']}" for a in alerts]
          if alerts else ["- No alerts."]),
        "",
        "## Tax (simplified estimate, not advice)",
        f"- Est. tax ~{tax.get('total_est_tax')} on gains {tax.get('total_taxable_gain')} "
        f"@ {tax.get('rate', 0) * 100:.0f}%",
        "",
        "## Rebalance Plan",
        f"- {plan.get('note', '')} Freed total: ~{plan.get('freed_total', 0)}",
        *[f"- SELL {s['ticker']}: ~{s['sell_value']} (~{s['sell_qty']} shares)" for s in plan.get("sells", [])],
        *[f"- BUY {b['sector']}: ~{b['buy_value']} (-> {b['new_pct']}%)" for b in plan.get("buys", [])],
        "",
        "## Growth Projection (illustration only)",
        f"- From {proj.get('starting_value')} over {proj.get('years')} years: "
        + ", ".join(f"{s['label']} = {s['value']}" for s in proj.get("scenarios", [])),
        f"- Goal example: ~{goal.get('monthly_sip')}/month for {goal.get('years')}y "
        f"at {goal.get('annual_rate', 0)*100:.0f}% reaches ~{goal.get('target_amount')}",
        "",
        "## Stress Test (hypothetical)",
        f"- {stress.get('note', '')}",
        "",
        "## Tax-Loss Harvest (simplified, not advice)",
        f"- {harvest.get('note', '')} Total est. saved: ~{harvest.get('total_tax_saved', 0)}",
        *[f"- Sell {p['sell_loser']} (book loss {p['book_loss']}): offsets "
          + ", ".join(f"{o['ticker']} ({o['offset']})" for o in p['offset_with'])
          + f" → saves ~{p['tax_saved']}" for p in harvest.get("pairs", [])],
        "",
        "## Advisor Recommendation",
        advice,
        "",
        "_Not financial advice. Educational demo on static sample data._",
    ]
    out_dir = Path(__file__).resolve().parent.parent / "outputs"
    out_dir.mkdir(exist_ok=True)
    path = out_dir / f"report_{datetime.now():%Y%m%d_%H%M%S}.md"
    path.write_text("\n".join(lines))
    return str(path)


def build_json(portfolio_path: str, findings: dict, risks: dict, advice: str) -> str:
    """Write the full machine-readable analysis to outputs/ and return its path."""
    out_dir = Path(__file__).resolve().parent.parent / "outputs"
    out_dir.mkdir(exist_ok=True)
    payload = {"generated_at": datetime.now().isoformat(timespec="seconds"),
               "portfolio": str(portfolio_path),
               "analysis": findings.get("analysis", ""),
               "returns": findings.get("returns", {}),
               "allocation": findings.get("allocation", {}),
               "risks": risks, "advice": advice,
               "disclaimer": "Not financial advice. Educational demo on static sample data."}
    path = out_dir / f"report_{datetime.now():%Y%m%d_%H%M%S}.json"
    path.write_text(json.dumps(payload, indent=2))
    return str(path)
