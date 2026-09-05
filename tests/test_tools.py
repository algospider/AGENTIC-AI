"""Smoke tests for deterministic tools (no LLM needed). Run: python3 tests/test_tools.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import pandas as pd
from tools import (calculate_returns, calculate_allocation, assess_risk, estimate_tax,
                   simulate_rebalance, health_score, rebalance_plan, project_growth,
                   stress_test, sip_for_goal, tax_loss_harvest)

CSV = str(Path(__file__).resolve().parent.parent / "sample_data" / "sample_portfolio.csv")


def test_returns_totals():
    df = pd.read_csv(CSV)
    r = calculate_returns(df)
    assert r["totals"]["total_value"] == 27110.7, r["totals"]
    assert r["totals"]["total_cost"] == 24930.3, r["totals"]
    assert r["totals"]["total_pnl"] == 2180.4, r["totals"]
    assert len(r["holdings"]) == 10


def test_allocation_tech_concentration():
    df = pd.read_csv(CSV)
    a = calculate_allocation(df)
    assert a["top_sector"] == "Technology"
    assert a["top_sector_pct"] > 50  # ~53.7%
    assert abs(sum(a["by_sector"].values()) - 100) < 0.05


def test_risk_tax_rebalance():
    df = pd.read_csv(CSV)
    r = calculate_returns(df)
    a = calculate_allocation(df)
    risk = assess_risk(df, r, a)
    assert risk["risk_level"] == "HIGH"
    tax = estimate_tax(r)
    assert tax["total_est_tax"] > 0
    sim = simulate_rebalance(df, sell_ticker="TCHX", sell_fraction=0.5)
    assert sim["proceeds"] > 0


def test_health_plan_projection():
    df = pd.read_csv(CSV)
    r = calculate_returns(df)
    a = calculate_allocation(df)
    risk = assess_risk(df, r, a)
    h = health_score(r, a, risk)
    assert 0 <= h["score"] <= 100 and h["grade"] in "ABCD", h
    plan = rebalance_plan(df)
    assert plan["freed_total"] > 0 and plan["sells"], plan  # Tech 53% > 35% cap
    assert max(plan["new_by_sector"].values()) <= 35.01
    proj = project_growth(r["totals"]["total_value"])
    assert len(proj["scenarios"]) == 3
    assert proj["scenarios"][0]["value"] < proj["scenarios"][-1]["value"]


def test_stress_sip_harvest():
    df = pd.read_csv(CSV)
    s = stress_test(df)  # default: Technology -20%
    assert s["sector"] == "Technology" and s["drop_pct"] == 20.0, s
    # Tech value 14560.5 * 20% = 2912.1 loss; portfolio falls ~10.74%
    assert s["sector_loss"] == 2912.1, s
    assert s["new_total"] == round(27110.7 - 2912.1, 2), s
    s2 = stress_test(df, drop_sector="Utilities", drop_pct=50)
    assert s2["sector"] == "Utilities" and s2["portfolio_fall_pct"] < s["portfolio_fall_pct"]
    g = sip_for_goal(100000, 5)
    assert 1200 < g["monthly_sip"] < 1400, g  # ~1283 at 10%
    assert g["total_invested"] == round(g["monthly_sip"] * 60, 2)
    r = calculate_returns(df)
    hv = tax_loss_harvest(r)
    assert len(hv["pairs"]) == 3, hv  # CLDW, CNSG, RLST
    assert hv["total_tax_saved"] > 0
    worst = max(hv["pairs"], key=lambda p: p["book_loss"])
    assert worst["sell_loser"] == "CLDW" and worst["tax_saved"] == round(516 * 0.15, 2)


def test_validation_errors():
    df = pd.read_csv(CSV)

    def raises(fn, *args, **kwargs):
        try:
            fn(*args, **kwargs)
        except (ValueError, KeyError):
            return True
        return False

    assert raises(calculate_returns, pd.DataFrame({"a": [1]}))  # missing columns
    assert raises(stress_test, df, drop_sector="Nope", drop_pct=10)  # bad sector
    assert raises(stress_test, df, drop_pct=150)  # bad pct
    assert raises(sip_for_goal, -100, 5)  # bad target
    assert raises(sip_for_goal, 100, 0)  # bad years
    assert raises(simulate_rebalance, df, sell_ticker="XXXX")  # bad ticker


if __name__ == "__main__":
    test_returns_totals()
    test_allocation_tech_concentration()
    test_risk_tax_rebalance()
    test_health_plan_projection()
    test_stress_sip_harvest()
    test_validation_errors()
    print("All tool tests passed.")

