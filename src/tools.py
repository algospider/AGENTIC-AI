"""
Core Tools: Portfolio Health Advisor

Deterministic, testable plain-Python functions (no LLM calls here).
The LLM reasoning happens in the agents, not the tools.
"""

import pandas as pd

REQUIRED_COLS = ["ticker", "company_name", "sector", "quantity", "buy_price", "current_price"]


def _validate(portfolio: pd.DataFrame) -> pd.DataFrame:
    missing = [c for c in REQUIRED_COLS if c not in portfolio.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}. Expected {REQUIRED_COLS}")
    df = portfolio.copy()
    for col in ("quantity", "buy_price", "current_price"):
        df[col] = pd.to_numeric(df[col], errors="raise")
    if (df["quantity"] < 0).any():
        raise ValueError("quantity must be >= 0")
    return df


def calculate_returns(portfolio: pd.DataFrame) -> dict:
    """
    Compute current value and gain/loss per holding and overall.

    Returns:
        {
          "holdings": [{ticker, company_name, sector, quantity,
                        buy_price, current_price, cost_value,
                        current_value, pnl, pnl_pct}, ...],
          "totals": {total_cost, total_value, total_pnl, return_pct,
                     best_ticker, worst_ticker, num_winners, num_losers}
        }
    """
    df = _validate(portfolio)
    holdings = []
    for _, r in df.iterrows():
        cost = round(float(r["quantity"]) * float(r["buy_price"]), 2)
        cur = round(float(r["quantity"]) * float(r["current_price"]), 2)
        pnl = round(cur - cost, 2)
        pnl_pct = round((pnl / cost * 100) if cost else 0.0, 2)
        holdings.append({
            "ticker": str(r["ticker"]),
            "company_name": str(r["company_name"]),
            "sector": str(r["sector"]),
            "quantity": float(r["quantity"]),
            "buy_price": float(r["buy_price"]),
            "current_price": float(r["current_price"]),
            "cost_value": cost,
            "current_value": cur,
            "pnl": pnl,
            "pnl_pct": pnl_pct,
        })
    holdings.sort(key=lambda h: h["pnl"], reverse=True)
    total_cost = round(sum(h["cost_value"] for h in holdings), 2)
    total_value = round(sum(h["current_value"] for h in holdings), 2)
    total_pnl = round(total_value - total_cost, 2)
    return_pct = round((total_pnl / total_cost * 100) if total_cost else 0.0, 2)
    return {
        "holdings": holdings,
        "totals": {
            "total_cost": total_cost,
            "total_value": total_value,
            "total_pnl": total_pnl,
            "return_pct": return_pct,
            "best_ticker": holdings[0]["ticker"] if holdings else None,
            "worst_ticker": holdings[-1]["ticker"] if holdings else None,
            "num_winners": sum(1 for h in holdings if h["pnl"] > 0),
            "num_losers": sum(1 for h in holdings if h["pnl"] < 0),
        },
    }


def calculate_allocation(portfolio: pd.DataFrame) -> dict:
    """
    Compute % concentration by sector (based on current value).

    Returns:
        {"by_sector": {sector: pct}, "by_holding": {ticker: pct},
         "top_sector": ..., "top_sector_pct": ..., "top_holding": ...,
         "top_holding_pct": ..., "hhi": ... (0-10000 concentration index)}
    """
    df = _validate(portfolio)
    df = df.copy()
    df["current_value"] = df["quantity"] * df["current_price"]
    total = float(df["current_value"].sum())
    if total == 0:
        return {"by_sector": {}, "by_holding": {}, "top_sector": None,
                "top_sector_pct": 0.0, "top_holding": None, "top_holding_pct": 0.0, "hhi": 0.0}
    by_sector = (df.groupby("sector")["current_value"].sum() / total * 100).round(2).to_dict()
    by_holding = ((df.set_index("ticker")["current_value"] / total * 100).round(2)).to_dict()
    top_sector = max(by_sector, key=by_sector.get)
    top_holding = max(by_holding, key=by_holding.get)
    # HHI on sector weights (0-10000 scale)
    hhi = round(sum((w ** 2 for w in by_sector.values())), 2)
    return {
        "by_sector": {str(k): float(v) for k, v in by_sector.items()},
        "by_holding": {str(k): float(v) for k, v in by_holding.items()},
        "top_sector": str(top_sector),
        "top_sector_pct": float(by_sector[top_sector]),
        "top_holding": str(top_holding),
        "top_holding_pct": float(by_holding[top_holding]),
        "hhi": float(hhi),
    }


def assess_risk(portfolio: pd.DataFrame, returns: dict | None = None, allocation: dict | None = None) -> dict:
    """Rule-based risk flags feeding the Risk Agent / Advisor. No LLM."""
    import pandas as pd  # local to keep import light
    df = _validate(portfolio)
    returns = returns or calculate_returns(df)
    allocation = allocation or calculate_allocation(df)
    flags: list[str] = []
    level = "LOW"
    top_pct = allocation.get("top_sector_pct", 0)
    top_sector = allocation.get("top_sector")
    if top_pct >= 50:
        flags.append(f"Very high concentration: {top_sector} is {top_pct}% of portfolio (threshold 50%).")
        level = "HIGH"
    elif top_pct >= 30:
        flags.append(f"High concentration: {top_sector} is {top_pct}% of portfolio (threshold 30%).")
        level = "MEDIUM" if level == "LOW" else level
    if allocation.get("top_holding_pct", 0) >= 20:
        flags.append(f"Single-holding risk: {allocation['top_holding']} is {allocation['top_holding_pct']}% (threshold 20%).")
        level = "MEDIUM" if level == "LOW" else level
    losers = [h for h in returns["holdings"] if h["pnl"] < 0]
    if losers:
        worst = min(losers, key=lambda h: h["pnl_pct"])
        flags.append(f"{len(losers)} losing holding(s); worst is {worst['ticker']} ({worst['pnl_pct']}%).")
    hhi = allocation.get("hhi", 0)
    if hhi >= 2500:
        flags.append(f"Diversification weak (HHI {hhi} >= 2500 = highly concentrated).")
        if level == "LOW":
            level = "MEDIUM"
    if not flags:
        flags.append("No major concentration or loss flags. Portfolio looks reasonably diversified.")
    score = {"LOW": 25, "MEDIUM": 55, "HIGH": 80}[level]
    return {"risk_level": level, "risk_score": score, "flags": flags,
            "top_sector": top_sector, "top_sector_pct": top_pct,
            "num_losers": len(losers),
            "losers": [{"ticker": h["ticker"], "pnl": h["pnl"], "pnl_pct": h["pnl_pct"]} for h in losers]}


def estimate_tax(returns: dict, rate: float = 0.15) -> dict:
    """Simplified capital-gains estimate: rate * positive pnl only. Educational, not tax advice."""
    per_holding = []
    for h in returns.get("holdings", []):
        gain = max(0.0, h["pnl"])
        per_holding.append({"ticker": h["ticker"], "pnl": h["pnl"],
                            "taxable_gain": round(gain, 2),
                            "est_tax": round(gain * rate, 2)})
    total_tax = round(sum(p["est_tax"] for p in per_holding), 2)
    total_gain = round(sum(p["taxable_gain"] for p in per_holding), 2)
    return {"rate": rate, "total_taxable_gain": total_gain, "total_est_tax": total_tax,
            "per_holding": per_holding,
            "note": "Simplified flat-rate estimate on unrealized gains only. Not tax advice."}


def simulate_rebalance(portfolio: pd.DataFrame, target_sector_weights: dict[str, float] | None = None,
                       sell_ticker: str | None = None, sell_fraction: float = 0.5) -> dict:
    """
    What-if simulator (no trades executed).
    Option A: target_sector_weights like {"Technology": 35} = desired % of total value.
      Returns buy/sell deltas in value terms vs current.
    Option B: sell `sell_fraction` of `sell_ticker` -> proceeds + new allocation preview.
    """
    df = _validate(portfolio)
    allocation = calculate_allocation(df)
    returns = calculate_returns(df)
    total = returns["totals"]["total_value"]
    out: dict = {"total_value": total, "current_allocation": allocation["by_sector"]}
    if target_sector_weights:
        deltas = {}
        for sector, target_pct in target_sector_weights.items():
            cur_pct = allocation["by_sector"].get(sector, 0.0)
            deltas[sector] = {"current_pct": cur_pct, "target_pct": target_pct,
                              "delta_pct": round(target_pct - cur_pct, 2),
                              "delta_value": round((target_pct - cur_pct) / 100 * total, 2)}
        out["mode"] = "target_weights"
        out["deltas"] = deltas
        out["note"] = "Positive delta_value = buy more; negative = trim. Adds to 0 only if targets sum to 100."
    elif sell_ticker:
        row = df[df["ticker"] == sell_ticker]
        if row.empty:
            raise ValueError(f"ticker {sell_ticker} not in portfolio")
        r = row.iloc[0]
        proceeds = round(float(r["quantity"]) * float(r["current_price"]) * sell_fraction, 2)
        out["mode"] = "trim_holding"
        out["sell_ticker"] = sell_ticker
        out["sell_fraction"] = sell_fraction
        out["proceeds"] = proceeds
        out["new_total"] = round(total - proceeds, 2)
        out["note"] = f"Selling {sell_fraction*100:.0f}% of {sell_ticker} frees ~{proceeds}. Redeploy to underweight sectors."
    else:
        out["mode"] = "none"
        out["note"] = "Pass target_sector_weights or sell_ticker."
    return out


def health_score(returns: dict, allocation: dict, risk: dict) -> dict:
    """Beginner-friendly 0-100 portfolio health score (higher = healthier)."""
    score = 100.0
    notes: list[str] = []
    top_pct = allocation.get("top_sector_pct", 0)
    if top_pct > 30:
        penalty = min(40.0, round((top_pct - 30) * 1.5, 1))
        score -= penalty
        notes.append(f"-{penalty:g} concentration ({allocation.get('top_sector')} {top_pct}%)")
    if allocation.get("top_holding_pct", 0) >= 20:
        score -= 10
        notes.append(f"-10 single holding {allocation['top_holding']} at {allocation['top_holding_pct']}%")
    if allocation.get("hhi", 0) >= 2500:
        score -= 10
        notes.append("-10 weak diversification (HHI >= 2500)")
    losers = risk.get("losers", [])
    if losers:
        penalty = min(15.0, 5.0 * len(losers))
        score -= penalty
        notes.append(f"-{penalty:g} for {len(losers)} losing holding(s)")
        worst = min(losers, key=lambda h: h["pnl_pct"])
        if worst["pnl_pct"] <= -10:
            score -= 5
            notes.append(f"-5 worst loser {worst['ticker']} at {worst['pnl_pct']}%")
    if returns.get("totals", {}).get("return_pct", 0) > 0:
        score = min(100.0, score + 5)
        notes.append("+5 overall gain is positive")
    score = round(max(0.0, min(100.0, score)), 1)
    grade = "A" if score >= 80 else "B" if score >= 65 else "C" if score >= 50 else "D"
    if not notes:
        notes.append("No penalties — well balanced.")
    return {"score": score, "grade": grade, "breakdown": notes}


def rebalance_plan(portfolio: pd.DataFrame, cap_pct: float = 35.0) -> dict:
    """One-click plan: cap every sector at cap_pct, redeploy freed cash to the rest.

    Trims overweight holdings pro-rata within their sector; buys spread across
    underweight sectors pro-rata to current weights. Value-based, no trades executed.
    """
    df = _validate(portfolio)
    allocation = calculate_allocation(df)
    df = df.copy()
    df["current_value"] = df["quantity"] * df["current_price"]
    total = float(df["current_value"].sum())
    by_sector = allocation["by_sector"]
    sells: list[dict] = []
    freed = 0.0
    for sector, pct in by_sector.items():
        if pct > cap_pct:
            excess = round((pct - cap_pct) / 100 * total, 2)
            freed += excess
            members = df[df["sector"] == sector]
            sec_total = float(members["current_value"].sum())
            for _, r in members.iterrows():
                w = float(r["current_value"]) / sec_total if sec_total else 0
                sell_val = round(excess * w, 2)
                sells.append({"ticker": str(r["ticker"]), "sector": sector,
                              "sell_value": sell_val,
                              "sell_qty": round(sell_val / float(r["current_price"]), 3)})
    under = {s: p for s, p in by_sector.items() if p < cap_pct}
    under_total = sum(under.values())
    buys: list[dict] = []
    if freed and under_total:
        for sector, pct in sorted(under.items(), key=lambda x: -x[1]):
            buy_val = round(freed * pct / under_total, 2)
            new_pct = round((pct / 100 * total + buy_val) / total * 100, 2)
            buys.append({"sector": sector, "buy_value": buy_val, "new_pct": new_pct})
    new_by_sector = {s: (cap_pct if p > cap_pct else
                         next((b["new_pct"] for b in buys if b["sector"] == s), p))
                     for s, p in by_sector.items()}
    return {"cap_pct": cap_pct, "freed_total": round(freed, 2), "sells": sells,
            "buys": buys, "new_by_sector": new_by_sector,
            "note": ("Trim the SELL list and spread proceeds across the BUY list. "
                     "Values only — review taxes before acting.") if sells
            else f"No sector above {cap_pct}% — no rebalancing needed."}


def project_growth(total_value: float, years: int = 5,
                   rates: tuple[float, ...] = (0.05, 0.10, 0.15)) -> dict:
    """Simple compound-growth projector for beginners. Educational, not a forecast."""
    scenarios = [{"label": f"{r*100:.0f}% p.a.", "rate": r,
                  "value": round(total_value * (1 + r) ** years, 2)}
                 for r in rates]
    return {"starting_value": round(total_value, 2), "years": years,
            "scenarios": scenarios,
            "note": "Straight compounding illustration. Real returns vary — not a prediction."}


def stress_test(portfolio: pd.DataFrame, drop_sector: str | None = None,
                drop_pct: float = 20.0) -> dict:
    """What if a sector crashes? Revalues that sector down by drop_pct.

    Defaults to the most concentrated sector (the realistic fear).
    Deterministic and clearly labelled as a hypothetical.
    """
    df = _validate(portfolio)
    allocation = calculate_allocation(df)
    if drop_pct < 0 or drop_pct > 100:
        raise ValueError("drop_pct must be between 0 and 100")
    target = drop_sector or allocation["top_sector"]
    if target not in allocation["by_sector"]:
        raise ValueError(f"Unknown sector '{target}'. Choices: {sorted(allocation['by_sector'])}")
    df = df.copy()
    df["current_value"] = df["quantity"] * df["current_price"]
    total = float(df["current_value"].sum())
    sector_val = float(df.loc[df["sector"] == target, "current_value"].sum())
    loss = round(sector_val * drop_pct / 100, 2)
    new_total = round(total - loss, 2)
    new_pct = round((sector_val - loss) / new_total * 100, 2) if new_total else 0.0
    return {"sector": target, "drop_pct": drop_pct, "sector_loss": loss,
            "old_total": round(total, 2), "new_total": new_total,
            "portfolio_fall_pct": round(loss / total * 100, 2) if total else 0.0,
            "sector_new_pct": new_pct,
            "note": (f"If {target} fell {drop_pct:g}%, the portfolio would drop "
                     f"{round(loss/total*100, 2) if total else 0:g}% to ~{new_total}. Hypothetical.")}


def sip_for_goal(target_amount: float, years: int, annual_rate: float = 0.10) -> dict:
    """Monthly SIP needed to reach a goal: FV of monthly compounding.

    PMT = FV * r / ((1+r)^n - 1), r = monthly rate. Beginner goal planner.
    """
    if target_amount <= 0 or years <= 0:
        raise ValueError("target_amount and years must be positive")
    if not 0 <= annual_rate <= 1:
        raise ValueError("annual_rate must be between 0 and 1 (e.g. 0.10 for 10%)")
    r = annual_rate / 12
    n = years * 12
    monthly = round(target_amount * r / ((1 + r) ** n - 1), 2) if r else round(target_amount / n, 2)
    return {"target_amount": target_amount, "years": years, "annual_rate": annual_rate,
            "monthly_sip": monthly, "total_invested": round(monthly * n, 2),
            "note": f"Invest ~{monthly}/month for {years}y at {annual_rate*100:.0f}% to reach ~{target_amount}."}


def tax_loss_harvest(returns: dict, rate: float = 0.15) -> dict:
    """Pair each losing holding with winners: selling both nets the loss against gains.

    Shows per-loser: which winners it can offset and the tax saved. Educational.
    """
    losers = [h for h in returns.get("holdings", []) if h["pnl"] < 0]
    winners = sorted([h for h in returns.get("holdings", []) if h["pnl"] > 0],
                     key=lambda h: -h["pnl"])
    pairs = []
    for loser in losers:
        loss = abs(loser["pnl"])
        offset_with = []
        remaining = loss
        for w in winners:
            if remaining <= 0:
                break
            use = round(min(w["pnl"], remaining), 2)
            offset_with.append({"ticker": w["ticker"], "offset": use})
            remaining = round(remaining - use, 2)
        pairs.append({"sell_loser": loser["ticker"], "book_loss": round(loss, 2),
                      "offset_with": offset_with,
                      "tax_saved": round((loss - remaining) * rate, 2)})
    total_saved = round(sum(p["tax_saved"] for p in pairs), 2)
    return {"rate": rate, "pairs": pairs, "total_tax_saved": total_saved,
            "note": ("Sell losers + trim paired winners to offset gains. "
                     "Simplified — watch wash-sale rules. Not tax advice.") if pairs
            else "No losing holdings — nothing to harvest."}
