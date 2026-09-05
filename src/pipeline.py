"""Shared pipeline: loading, caching, listing and comparing portfolios.

Used by main.py (CLI/Rich) and app_tui.py (fullscreen) so both UIs
share identical behavior. No Rich/Textual output here except progress hints.
"""

import hashlib
import os
from pathlib import Path

import pandas as pd

try:
    from agents import analyst_agent, risk_agent, advisor_agent
except ImportError:
    from src.agents import analyst_agent, risk_agent, advisor_agent

REPO_ROOT = Path(__file__).resolve().parent.parent
SAMPLE = REPO_ROOT / "sample_data" / "sample_portfolio.csv"
REQUIRED_NOTE = ("ticker,company_name,sector,quantity,buy_price,current_price")


def find_portfolio(given: str | None) -> Path:
    """Beginner-proof CSV lookup: explicit path, else the bundled sample."""
    if given:
        p = Path(given)
        for c in (p, REPO_ROOT / p, Path.cwd() / p):
            if c.is_file():
                return c
        raise FileNotFoundError(
            f"Could not find '{given}'. Tip: put your CSV in sample_data/ "
            f"with columns: {REQUIRED_NOTE}")
    if SAMPLE.is_file():
        return SAMPLE
    raise FileNotFoundError("Sample portfolio not found. Expected at sample_data/sample_portfolio.csv")


def cached_advice(raw: bytes, findings, risks, use_cache: bool = True,
                  quiet: bool = False, advisor_fn=None) -> str:
    """Cache LLM advice by portfolio content + model so repeat runs start instantly."""
    key = hashlib.sha256(raw + os.getenv("MODEL_ID", "").encode()).hexdigest()[:16]
    cache = REPO_ROOT / "outputs" / ".advice_cache" / f"{key}.txt"
    if use_cache and cache.is_file():
        return cache.read_text()
    if not quiet:
        try:
            from rich.console import Console
            Console().print("[dim]Generating AI advice (free model, ~30s first time; cached after)...[/dim]")
        except Exception:
            print("Generating AI advice (free model, ~30s first time; cached after)...")
    advice = (advisor_fn or advisor_agent)(findings, risks)
    try:
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(advice)
    except OSError:
        pass
    return advice


def run_pipeline(portfolio_path: Path, use_cache: bool = True, quiet: bool = False):
    """Full pipeline: CSV -> findings -> risks -> advice. Returns (df, findings, risks, advice)."""
    try:
        raw = portfolio_path.read_bytes()
        portfolio = pd.read_csv(portfolio_path)
    except Exception as e:
        raise SystemExit(f"Could not read '{portfolio_path}': {e}\n"
                         f"Tip: it must be a CSV with columns {REQUIRED_NOTE}")
    try:
        findings = analyst_agent(portfolio)
        risks = risk_agent(portfolio, findings)
    except ValueError as e:
        raise SystemExit(f"Problem with the portfolio data: {e}")
    advice = cached_advice(raw, findings, risks, use_cache, quiet)
    return portfolio, findings, risks, advice


def quick_bundle(portfolio_path: Path):
    """Fast pipeline without LLM advice (for listings and comparisons)."""
    portfolio = pd.read_csv(portfolio_path)
    findings = analyst_agent(portfolio)
    risks = risk_agent(portfolio, findings)
    return portfolio, findings, risks


def list_datasets() -> list[dict]:
    """Every sample_data/*.csv with instant stats (no LLM calls). Sorted by name."""
    out = []
    for path in sorted((REPO_ROOT / "sample_data").glob("*.csv")):
        try:
            _, findings, risks = quick_bundle(path)
            t = findings["returns"]["totals"]
            out.append({"path": str(path), "name": path.name,
                        "n": len(findings["returns"]["holdings"]),
                        "value": t["total_value"], "return_pct": t["return_pct"],
                        "health": risks["health"]["score"], "grade": risks["health"]["grade"],
                        "risk": risks["risk"]["risk_level"]})
        except Exception as e:
            out.append({"path": str(path), "name": path.name, "error": str(e)[:100]})
    return out


def compare_portfolios(path_a: str | Path, path_b: str | Path) -> dict:
    """Side-by-side comparison of two datasets (no LLM needed)."""
    sides = []
    for p in (Path(path_a), Path(path_b)):
        _, findings, risks = quick_bundle(p)
        t = findings["returns"]["totals"]
        sides.append({"file": Path(p).name,
                      "n": len(findings["returns"]["holdings"]),
                      "value": t["total_value"], "return_pct": t["return_pct"],
                      "health": risks["health"]["score"], "grade": risks["health"]["grade"],
                      "risk": risks["risk"]["risk_level"],
                      "top_sector": findings["allocation"]["top_sector"],
                      "top_sector_pct": findings["allocation"]["top_sector_pct"],
                      "winners": t["num_winners"], "losers": t["num_losers"]})
    a, b = sides
    def verdict(key, better, fmt="{:.2f}"):
        if a[key] == b[key]:
            return f"Tie on {key} ({fmt.format(a[key])})."
        w, l = (a, b) if better(a[key], b[key]) else (b, a)
        return f"{w['file']} wins {key} ({fmt.format(w[key])} vs {fmt.format(l[key])})."
    lower = lambda x, y: x < y
    higher = lambda x, y: x > y
    return {"a": a, "b": b, "verdicts": [
        verdict("return_pct", higher),
        verdict("health", higher),
        verdict("top_sector_pct", lower),
        verdict("losers", lower),
    ]}
