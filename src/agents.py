"""
Agents: Portfolio Health Advisor

Sequential handoff:
    Analyst (facts) -> Risk (danger) -> Planner (way out) -> Tax (cost of acting)
        -> Sentinel (tripwires) -> Scout (brief) -> Advisor (LLM) -> Q&A (chat)
"""

import json
from typing import Any

try:
    from tools import (calculate_returns, calculate_allocation, assess_risk,
                       estimate_tax, health_score, rebalance_plan, project_growth,
                       stress_test, sip_for_goal, tax_loss_harvest,
                       risk_metrics, build_alerts, build_insights)
except ImportError:  # allow `python src/main.py` and `python -m src.main`
    from src.tools import (calculate_returns, calculate_allocation, assess_risk,
                           estimate_tax, health_score, rebalance_plan, project_growth,
                           stress_test, sip_for_goal, tax_loss_harvest,
                           risk_metrics, build_alerts, build_insights)

try:
    from llm import complete
except ImportError:
    from src.llm import complete


def analyst_agent(portfolio) -> dict[str, Any]:
    """Agent 1: facts only — calls both required tools."""
    returns = calculate_returns(portfolio)
    allocation = calculate_allocation(portfolio)
    t = returns["totals"]
    analysis = (
        f"Portfolio worth {t['total_value']} (cost {t['total_cost']}, "
        f"P&L {t['total_pnl']} / {t['return_pct']}%). "
        f"Top sector {allocation['top_sector']} at {allocation['top_sector_pct']}%. "
        f"Winners {t['num_winners']}, losers {t['num_losers']}."
    )
    return {"analysis": analysis, "returns": returns, "allocation": allocation}


def risk_agent(portfolio, findings: dict[str, Any] | None = None) -> dict[str, Any]:
    """Agent 1b / third agent: rule-based risk + tax + health + auto plan + extras."""
    findings = findings or {}
    returns = findings.get("returns") or calculate_returns(portfolio)
    allocation = findings.get("allocation") or calculate_allocation(portfolio)
    risk = assess_risk(portfolio, returns, allocation)
    taxed = tax_agent(portfolio, {"returns": returns})
    tax, harvest = taxed["tax"], taxed["harvest"]
    health = health_score(returns, allocation, risk)
    plan = rebalance_plan(portfolio)
    projection = project_growth(returns["totals"]["total_value"])
    stress = stress_test(portfolio)  # default: top sector -20%
    goal = sip_for_goal(100000, 5)  # default example; UI recomputes live
    metrics = risk_metrics(returns)
    alerts = build_alerts(returns, allocation, risk)
    insights = build_insights(returns, allocation, risk, harvest, plan)
    return {"risk": risk, "tax": tax, "health": health, "plan": plan,
            "projection": projection, "stress": stress, "harvest": harvest,
            "goal": goal, "metrics": metrics, "alerts": alerts, "insights": insights}


def tax_agent(portfolio, findings: dict[str, Any] | None = None) -> dict[str, Any]:
    """Tax Calculator Agent: what acting costs, and how losers can pay for winners.

    Returns {"tax": estimate_tax(...), "harvest": tax_loss_harvest(...)}.
    Simplified flat-rate math on unrealized gains — educational, not tax advice.
    """
    findings = findings or {}
    returns = findings.get("returns") or calculate_returns(portfolio)
    return {"tax": estimate_tax(returns), "harvest": tax_loss_harvest(returns)}


def _fallback_advice(findings: dict[str, Any], risk_data: dict[str, Any] | None = None) -> str:
    t = findings["returns"]["totals"]
    a = findings["allocation"]
    risk_data = risk_data or {}
    health = risk_data.get("health", {})
    plan = risk_data.get("plan", {})
    lines = [
        f"Your portfolio is worth {t['total_value']} with an overall gain of "
        f"{t['total_pnl']} ({t['return_pct']}%).",
    ]
    if health:
        lines.append(f"Health score: {health.get('score')}/100 (grade {health.get('grade')}).")
    if a["top_sector_pct"] >= 30:
        lines.append(
            f"Risk: {a['top_sector']} is {a['top_sector_pct']}% of your money — "
            "that's concentrated. Consider trimming it gradually and adding to underweight sectors.")
    else:
        lines.append("Diversification looks reasonable across sectors.")
    if plan.get("sells"):
        top = plan["sells"][0]
        lines.append(f"Suggestion: rebalance plan frees ~{plan['freed_total']} "
                     f"(e.g. trim {top['ticker']} by ~{top['sell_value']}). Spread it across: "
                     + ", ".join(b["sector"] for b in plan["buys"][:3]) + ".")
    else:
        losers = [h for h in findings["returns"]["holdings"] if h["pnl"] < 0][:2]
        if losers:
            names = ", ".join(f"{h['ticker']} ({h['pnl_pct']}%)" for h in losers)
            lines.append(f"Suggestion: review losers {names} — decide if the story changed or it's time to exit.")
        else:
            lines.append("Suggestion: all holdings are green — consider booking partial profit on the top winner.")
    tax = risk_data.get("tax", {})
    if tax:
        lines.append(f"Note: selling all winners now could mean ~{tax.get('total_est_tax')} in simplified tax at "
                     f"{tax.get('rate', 0)*100:.0f}%. Prefer phased exits.")
    return "\n".join(f"• {l}" for l in lines)


def _alert_counts(alerts: list[dict]) -> dict:
    counts = {"critical": 0, "warn": 0, "ok": 0}
    for a in alerts or []:
        if a.get("severity") in counts:
            counts[a["severity"]] += 1
    return counts


def advisor_agent(findings: dict[str, Any], risk_data: dict[str, Any] | None = None) -> str:
    """Agent 2: reasons over findings (+risk/tax/health/plan), calls Zen LLM, falls back to rules."""
    risk_data = risk_data or {}
    slim = {"risk": risk_data.get("risk"), "tax": risk_data.get("tax"),
            "health": risk_data.get("health"), "plan": risk_data.get("plan"),
            "stress": risk_data.get("stress"), "harvest": risk_data.get("harvest"),
            "metrics": risk_data.get("metrics"),
            "insights": risk_data.get("insights", [])[:3],
            "alert_counts": _alert_counts(risk_data.get("alerts", []))}
    prompt = (
        "You are a portfolio advisor for a retail investor.\n"
        f"ANALYST FINDINGS (JSON):\n{json.dumps(findings, indent=2)[:3200]}\n"
        f"RISK+TAX+HEALTH+PLAN+STRESS+HARVEST (JSON):\n{json.dumps(slim, indent=2)[:2800]}\n\n"
        "Write a SHORT plain-English summary (max 120 words):\n"
        "1) One line on overall health (value + return + health score).\n"
        "2) One line on biggest risk (concentration/losers).\n"
        "3) Give exactly 1-2 actionable suggestions (mention the rebalance plan's freed amount if useful, no jargon).\n"
        "End with: 'Not financial advice.'"
    )
    text = complete(prompt, system="You are a concise, honest retail portfolio advisor.")
    return text.strip() if text else _fallback_advice(findings, risk_data)


def qa_agent(findings: dict[str, Any], question: str, history: list[dict] | None = None,
             risk_data: dict[str, Any] | None = None) -> str:
    """Multi-turn Q&A over the final advice. Falls back to extractive answers offline."""
    history = history or []
    hist_txt = "\n".join(f"{m['role']}: {m['content']}" for m in history[-6:])
    rd = risk_data or {}
    extras = {"projection": rd.get("projection"), "stress": rd.get("stress"),
              "harvest": rd.get("harvest"),
              "goal_example": rd.get("goal"), "metrics": rd.get("metrics"),
              "alerts": rd.get("alerts"),
              "sip_help": "For a custom SIP goal use: monthly = FV*r/((1+r)^n-1), r=annual_rate/12, n=years*12. Compute it."}
    prompt = (
        "Answer the user's portfolio question using ONLY these findings.\n"
        f"FINDINGS:\n{json.dumps(findings, indent=2)[:3000]}\n"
        f"RISK:\n{json.dumps(rd.get('risk', {}), indent=2)[:1200]}\n"
        f"PROJECTION+STRESS+HARVEST+GOAL:\n{json.dumps(extras, indent=2)[:1500]}\n"
        f"CHAT SO FAR:\n{hist_txt}\nQUESTION: {question}\n"
        "Keep it under 100 words, plain English."
    )
    text = complete(prompt, system="You answer portfolio questions briefly and factually.")
    if text:
        return text.strip()
    # Offline extractive fallback
    q = question.lower()
    a = findings["allocation"]
    if "score" in q or "health" in q or "grade" in q:
        h = (risk_data or {}).get("health", {})
        return (f"Health score is {h.get('score', '?')}/100 (grade {h.get('grade', '?')}). "
                + " ".join(h.get("breakdown", [])))
    if "rebalanc" in q or "plan" in q or "fix" in q:
        p = (risk_data or {}).get("plan", {})
        if p.get("sells"):
            return (f"Rebalance plan frees ~{p['freed_total']} by trimming "
                    + ", ".join(f"{s['ticker']} (~{s['sell_value']})" for s in p["sells"][:3])
                    + ". Spread it across " + ", ".join(b["sector"] for b in p.get("buys", [])[:3]) + ".")
        return str(p.get("note", "No rebalancing needed."))
    if "project" in q or "future" in q or "grow" in q or "sip" in q or "goal" in q:
        import re
        nums = [float(n.replace(",", "")) for n in re.findall(r"[\d,]+", q)]
        if ("sip" in q or "goal" in q) and len(nums) >= 2:
            try:
                g = sip_for_goal(nums[0], int(nums[1]))
                return g["note"] + f" Total invested ~{g['total_invested']}."
            except ValueError as e:
                return str(e)
        pj = (risk_data or {}).get("projection", {})
        bits = ", ".join(f"{s['label']}: {s['value']}" for s in pj.get("scenarios", []))
        return f"In {pj.get('years', '?')} years from {pj.get('starting_value', '?')}: {bits}. Illustration only."
    if "stress" in q or "crash" in q or "drop" in q or "fall" in q:
        s = (risk_data or {}).get("stress", {})
        return (f"Stress test: if {s.get('sector')} fell {s.get('drop_pct')}%, "
                f"you'd lose ~{s.get('sector_loss')} and the portfolio would drop "
                f"{s.get('portfolio_fall_pct')}% to ~{s.get('new_total')}. Hypothetical.")
    if "harvest" in q or "offset" in q or "save tax" in q:
        hv = (risk_data or {}).get("harvest", {})
        if not hv.get("pairs"):
            return str(hv.get("note", "Nothing to harvest."))
        bits = "; ".join(f"sell {p['sell_loser']} (loss {p['book_loss']}) saves ~{p['tax_saved']}"
                         for p in hv["pairs"])
        return f"Tax-loss harvest: {bits}. Total saved ~{hv['total_tax_saved']}. Simplified."
    if "insight" in q or "brief" in q or "headline" in q or "tl;dr" in q or "tldr" in q:
        items = (risk_data or {}).get("insights", [])
        if not items:
            return "No insights right now."
        return "Today's brief: " + " | ".join(f"{i['title']} — {i['body']}" for i in items[:3])
    if "alert" in q or "warning" in q or "watch" in q:
        alerts = (risk_data or {}).get("alerts", [])
        if not alerts:
            return "No alerts right now."
        return "Alerts: " + " | ".join(f"[{a['severity'].upper()}] {a['text']}" for a in alerts[:5])
    if "sharpe" in q or "volatil" in q or "win rate" in q or "metric" in q:
        m = (risk_data or {}).get("metrics", {})
        return (f"Volatility {m.get('volatility_pct')}% | Sharpe proxy {m.get('sharpe_proxy')} | "
                f"win rate {m.get('win_rate_pct')}% | best {m.get('best_contributor')} / "
                f"worst {m.get('worst_contributor')}. Single-period estimates.")
    if "risk" in q or "concentrat" in q or "diversif" in q:
        return (f"Your biggest risk is concentration: {a['top_sector']} is {a['top_sector_pct']}% "
                f"(top holding {a['top_holding']} at {a['top_holding_pct']}%). HHI is {a['hhi']}. "
                "Consider trimming the top sector toward ~30-35%.")
    if "tax" in q:
        t = (risk_data or {}).get("tax", {})
        return f"Simplified tax estimate is ~{t.get('total_est_tax', '?')} on gains of {t.get('total_taxable_gain', '?')}."
    if "los" in q or "worst" in q or "sell" in q:
        worst = findings["returns"]["holdings"][-1]
        return (f"Worst holding is {worst['ticker']} ({worst['company_name']}): "
                f"{worst['pnl']} ({worst['pnl_pct']}%). Review if its story changed before selling.")
    t = findings["returns"]["totals"]
    return (f"Portfolio worth {t['total_value']} ({t['return_pct']}% overall). "
            f"Top sector {a['top_sector']} {a['top_sector_pct']}%. Ask me about risk, tax, or any ticker.")
