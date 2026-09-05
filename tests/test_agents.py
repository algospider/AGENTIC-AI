"""Agent tests with the LLM stubbed out (no network, no key needed).

Covers: analyst facts, risk bundle keys, rule-based fallback advice,
and every offline Q&A branch. Run: python3 tests/test_agents.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import pandas as pd

import agents
from agents import analyst_agent, risk_agent, advisor_agent, qa_agent

# Force offline mode: complete() always fails -> fallbacks engage.
agents.complete = lambda *a, **k: None

CSV = str(Path(__file__).resolve().parent.parent / "sample_data" / "sample_portfolio.csv")


def _bundle():
    df = pd.read_csv(CSV)
    findings = analyst_agent(df)
    risks = risk_agent(df, findings)
    return df, findings, risks


def test_analyst_facts_only():
    df, findings, _ = _bundle()
    assert set(("analysis", "returns", "allocation")) <= set(findings)
    assert "worth" in findings["analysis"] and "Top sector" in findings["analysis"]
    assert len(df) == 10


def test_risk_bundle_keys():
    _, _, risks = _bundle()
    for key in ("risk", "tax", "health", "plan", "projection", "stress", "harvest", "goal"):
        assert key in risks, f"missing {key}"
    assert risks["stress"]["sector"] == "Technology"
    assert len(risks["harvest"]["pairs"]) == 3
    assert 1200 < risks["goal"]["monthly_sip"] < 1400


def test_fallback_advice_mentions_key_facts():
    _, findings, risks = _bundle()
    advice = advisor_agent(findings, risks)
    for needle in ("27110.7", "Technology", "53.71", "Health score"):
        assert needle in advice, f"missing {needle!r} in:\n{advice}"


def test_qa_branches():
    _, findings, risks = _bundle()
    cases = {
        "what is my health score?": "29.4",
        "how to rebalance?": "frees",
        "stress test crash?": "Technology",
        "harvest my losses": "CLDW",
        "SIP for 50000 in 3 years": "/month",
        "why is my risk high?": "53.71",
        "tax?": "429.65",
        "worst loser?": "CLDW",
        "hello": "27110.7",
    }
    for q, needle in cases.items():
        answer = qa_agent(findings, q, [], risks)
        assert needle in answer, f"Q {q!r} -> missing {needle!r} in {answer!r}"


if __name__ == "__main__":
    test_analyst_facts_only()
    test_risk_bundle_keys()
    test_fallback_advice_mentions_key_facts()
    test_qa_branches()
    print("All agent tests passed.")
