"""Smoke tests for deterministic tools (no LLM needed). Run: python3 tests/test_tools.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import pandas as pd
from tools import (calculate_returns, calculate_allocation, assess_risk, estimate_tax,
                   simulate_rebalance, health_score, rebalance_plan, project_growth,
                   stress_test, sip_for_goal, tax_loss_harvest,
                   risk_metrics, build_alerts)

CSV = str(Path(__file__).resolve().parent.parent / "sample_data" / "sample_portfolio.csv")
LARGE = str(Path(__file__).resolve().parent.parent / "sample_data" / "large_portfolio_200.csv")


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
    assert sum(a["by_sector"].values()) == 100.0  # normalized exactly


def test_precision_reconciliation():
    """Totals must reconcile with the raw CSV to the cent; sectors sum to 100."""
    import time
    for path in (CSV, LARGE):
        df = pd.read_csv(path)
        r = calculate_returns(df)
        a = calculate_allocation(df)
        exact_cost = round(float((df["quantity"] * df["buy_price"]).sum()), 2)
        exact_value = round(float((df["quantity"] * df["current_price"]).sum()), 2)
        assert r["totals"]["total_cost"] == exact_cost, (path, r["totals"])
        assert r["totals"]["total_value"] == exact_value, (path, r["totals"])
        assert r["totals"]["total_pnl"] == round(exact_value - exact_cost, 2)
        assert sum(a["by_sector"].values()) == 100.0, path
        # holding-level rounding drift stays within half a cent per row
        drift = abs(sum(h["current_value"] for h in r["holdings"]) - exact_value)
        assert drift <= 0.005 * len(df) + 1e-9, (path, drift)
    # scale: 200 holdings must compute fast
    df = pd.read_csv(LARGE)
    t0 = time.perf_counter()
    calculate_returns(df)
    calculate_allocation(df)
    assert time.perf_counter() - t0 < 2.0


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


def test_insights():
    from tools import build_insights
    df = pd.read_csv(CSV)
    r = calculate_returns(df)
    a = calculate_allocation(df)
    risk = assess_risk(df, r, a)
    ins = build_insights(r, a, risk, tax_loss_harvest(r), rebalance_plan(df))
    assert 1 <= len(ins) <= 5, ins
    assert ins[0]["tone"] == "bad" and "Technology" in ins[0]["title"], ins
    assert all(set(i) == {"tone", "title", "body"} for i in ins)
    assert any("TCHX" in i["title"] for i in ins)


def test_large_dataset_shape():
    df = pd.read_csv(LARGE)
    assert len(df) == 200, len(df)
    assert df["ticker"].is_unique, "tickers must be unique"
    assert (df["quantity"] > 0).all() and (df["current_price"] > 0).all()
    assert df["sector"].nunique() == 12, df["sector"].unique()
    r = calculate_returns(df)
    assert r["totals"]["total_value"] > 0
    assert r["totals"]["num_winners"] + r["totals"]["num_losers"] <= 200


def test_duplicate_tickers_aggregate():
    """User CSVs may repeat a ticker: math must aggregate, never drop rows."""
    df = pd.DataFrame([
        {"ticker": "AAA", "company_name": "A1", "sector": "Tech",
         "quantity": 10, "buy_price": 100.0, "current_price": 110.0},
        {"ticker": "AAA", "company_name": "A2", "sector": "Tech",
         "quantity": 10, "buy_price": 100.0, "current_price": 90.0},
        {"ticker": "BBB", "company_name": "B", "sector": "Bank",
         "quantity": 10, "buy_price": 50.0, "current_price": 60.0},
    ])
    a = calculate_allocation(df)
    assert sum(a["by_sector"].values()) == 100.0
    # AAA total = 1100+900=2000 of 2600 -> 76.92%
    assert a["by_holding"]["AAA"] == round(2000 / 2600 * 100, 2), a["by_holding"]
    sim = simulate_rebalance(df, sell_ticker="AAA", sell_fraction=0.5)
    assert sim["proceeds"] == 1000.0, sim  # 50% of 2000, not just first row


def test_metrics_alerts():
    df = pd.read_csv(CSV)
    r = calculate_returns(df)
    a = calculate_allocation(df)
    m = risk_metrics(r)
    assert m["volatility_pct"] > 0 and m["win_rate_pct"] == 70.0, m
    assert m["best_contributor"] == "TCHX" and m["worst_contributor"] == "CLDW", m
    assert isinstance(m["sharpe_proxy"], float)
    risk = assess_risk(df, r, a)
    alerts = build_alerts(r, a, risk)
    sevs = [x["severity"] for x in alerts]
    assert "critical" in sevs, alerts  # Tech 53.7% >= 50
    assert sevs == sorted(sevs, key=lambda s: {"critical": 0, "warn": 1, "ok": 2}[s])
    assert any("Technology" in x["text"] for x in alerts)


def test_pipeline_helpers():
    from pipeline import list_datasets, compare_portfolios, quick_bundle
    ds = list_datasets()
    assert len(ds) >= 6, ds
    assert all("error" not in d for d in ds), ds
    names = [d["name"] for d in ds]
    assert "sample_portfolio.csv" in names and "portfolio_500_diversified_42.csv" in names
    res = compare_portfolios(ds[0]["path"], ds[-1]["path"])
    assert len(res["verdicts"]) == 4 and all(isinstance(v, str) for v in res["verdicts"])
    _, findings, risks = quick_bundle(ds[0]["path"])
    assert "metrics" in risks and "alerts" in risks


if __name__ == "__main__":
    test_returns_totals()
    test_allocation_tech_concentration()
    test_risk_tax_rebalance()
    test_health_plan_projection()
    test_stress_sip_harvest()
    test_validation_errors()
    test_precision_reconciliation()
    test_large_dataset_shape()
    test_duplicate_tickers_aggregate()
    test_metrics_alerts()
    test_pipeline_helpers()
    test_insights()
    print("All tool tests passed.")

