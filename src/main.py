"""
Portfolio Health Advisor — Entry Point (CLI + Rich TUI).

Beginner quickstart (from the repo folder):
    ./run.sh
or:
    python3 src/main.py            # full-screen TUI (mouse + keyboard)
    python3 src/main.py --menu     # classic scrolling menu instead

More options:
    python3 src/main.py --portfolio my.csv --auto      # one-shot: dashboard + report file
    python3 src/main.py --non-interactive               # plain text, for scripts/judges
    python3 src/main.py --question "why is my risk high?"
"""

import argparse
import hashlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd

from agents import analyst_agent, risk_agent, advisor_agent, qa_agent
from tools import simulate_rebalance, stress_test, sip_for_goal

try:
    from tui import (console, show_dashboard, show_plan, show_projection,
                     main_menu, what_if_flow, qa_flow)
except ImportError:
    from src.tui import (console, show_dashboard, show_plan, show_projection,
                         main_menu, what_if_flow, qa_flow)

try:
    from report import build_report
except ImportError:
    from src.report import build_report

REPO_ROOT = Path(__file__).resolve().parent.parent
SAMPLE = REPO_ROOT / "sample_data" / "sample_portfolio.csv"


def find_portfolio(given: str | None) -> Path:
    """Beginner-proof CSV lookup: explicit path, else the bundled sample."""
    if given:
        p = Path(given)
        candidates = [p, REPO_ROOT / p, Path.cwd() / p]
        for c in candidates:
            if c.is_file():
                return c
        raise FileNotFoundError(
            f"Could not find '{given}'. Tip: put your CSV in sample_data/ "
            f"with columns: ticker,company_name,sector,quantity,buy_price,current_price")
    if SAMPLE.is_file():
        return SAMPLE
    raise FileNotFoundError("Sample portfolio not found. Expected at sample_data/sample_portfolio.csv")


def setup_hint() -> None:
    """Friendly first-run guidance. Never a hard error: the app works without a key."""
    if not (REPO_ROOT / ".env").is_file():
        console.print("[yellow]No .env file — running on the built-in rule engine. "
                      "For AI advice: cp .env.example .env and add your key.[/yellow]")


def run_pipeline(portfolio_path: Path, use_cache: bool = True):
    try:
        raw = portfolio_path.read_bytes()
        portfolio = pd.read_csv(portfolio_path)
    except Exception as e:
        raise SystemExit(f"Could not read '{portfolio_path}': {e}\n"
                         "Tip: it must be a CSV with columns "
                         "ticker,company_name,sector,quantity,buy_price,current_price")
    try:
        findings = analyst_agent(portfolio)
        risks = risk_agent(portfolio, findings)
    except ValueError as e:
        raise SystemExit(f"Problem with the portfolio data: {e}")
    advice = cached_advice(raw, findings, risks, use_cache)
    return portfolio, findings, risks, advice


def cached_advice(raw: bytes, findings, risks, use_cache: bool = True) -> str:
    """Cache LLM advice by portfolio content + model so repeat runs start instantly."""
    import os
    key = hashlib.sha256(raw + os.getenv("MODEL_ID", "").encode()).hexdigest()[:16]
    cache = REPO_ROOT / "outputs" / ".advice_cache" / f"{key}.txt"
    if use_cache and cache.is_file():
        return cache.read_text()
    console.print("[dim]Generating AI advice (free model, ~30s first time; cached after)...[/dim]")
    advice = advisor_agent(findings, risks)
    try:
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(advice)
    except OSError:
        pass
    return advice


def export_report(portfolio_path: Path, findings, risks, advice) -> None:
    path = build_report(str(portfolio_path), findings, risks, advice)
    console.print(f"[green]Report saved to {path}[/green]")


def main():
    parser = argparse.ArgumentParser(description="Portfolio Health Advisor (beginner-friendly TUI)")
    parser.add_argument("--portfolio", type=str, default=None,
                        help="Path to portfolio CSV (default: sample_data/sample_portfolio.csv)")
    parser.add_argument("--non-interactive", action="store_true", help="Plain stdout, no prompts")
    parser.add_argument("--auto", action="store_true", help="One-shot: show dashboard + save report, no menu")
    parser.add_argument("--fullscreen", action="store_true", help="Force the full-screen Textual TUI")
    parser.add_argument("--menu", action="store_true", help="Force the classic Rich menu instead of full-screen")
    parser.add_argument("--export", action="store_true", help="Save a Markdown report to outputs/ and exit")
    parser.add_argument("--refresh", action="store_true", help="Ignore cached AI advice and regenerate")
    parser.add_argument("--question", type=str, default=None, help="Answer one question and exit")
    args = parser.parse_args()

    setup_hint()
    try:
        portfolio_path = find_portfolio(args.portfolio)
    except FileNotFoundError as e:
        console.print(f"[red]{e}[/red]")
        raise SystemExit(1)
    portfolio, findings, risks, advice = run_pipeline(portfolio_path, use_cache=not args.refresh)
    tickers = [h["ticker"] for h in findings["returns"]["holdings"]]

    if args.non_interactive or args.auto:
        print("--- FINDINGS ---")
        print(findings["analysis"])
        print(findings["returns"]["totals"])
        print(findings["allocation"]["by_sector"])
        print("--- HEALTH ---")
        print(risks["health"])
        print("--- RISK ---")
        print(risks["risk"])
        print("--- TAX ---")
        print(risks["tax"])
        print("--- PLAN ---")
        print(risks["plan"])
        print("--- PROJECTION ---")
        print(risks["projection"])
        print("--- STRESS ---")
        print(risks["stress"])
        print("--- HARVEST ---")
        print(risks["harvest"])
        print("--- ADVICE ---")
        print(advice)
        if args.question:
            print("--- ANSWER ---")
            print(qa_agent(findings, args.question, [], risks))
        if args.auto or args.export:
            print("--- REPORT ---")
            print(build_report(str(portfolio_path), findings, risks, advice))
        return

    if args.export:
        export_report(portfolio_path, findings, risks, advice)
        return

    if args.question:
        console.print(f"\n[bold]Q:[/bold] {args.question}")
        with console.status("Thinking..."):
            answer = qa_agent(findings, args.question, [], risks)
        console.print(f"[bold]A:[/bold] {answer}")
        return

    # Interactive: full-screen Textual TUI by default (mouse + keyboard).
    # Falls back to the classic Rich menu when Textual is missing or
    # output is piped (judges/scripts). Override with --fullscreen / --menu.
    use_fullscreen = args.fullscreen or (
        not args.menu and sys.stdin.isatty() and sys.stdout.isatty())
    if use_fullscreen:
        try:
            try:
                from app_tui import launch as launch_fullscreen
            except ImportError:
                from src.app_tui import launch as launch_fullscreen
            launch_fullscreen(portfolio, findings, risks, advice,
                              str(portfolio_path), simulate_rebalance, qa_agent,
                              stress_test, sip_for_goal)
            return
        except ImportError:
            console.print("[yellow]Textual not installed — using classic menu. "
                          "(pip install textual for full-screen)[/yellow]")
        except Exception as e:
            console.print(f"[yellow]Full-screen TUI failed ({e}) — using classic menu.[/yellow]")

    console.print(f"[dim]Loaded {len(tickers)} holdings from {portfolio_path.name}[/dim]")
    show_dashboard(findings, risks, advice)
    while True:
        choice = main_menu()
        if choice == "1":
            show_dashboard(findings, risks, advice)
        elif choice == "2":
            show_plan(risks["plan"])
        elif choice == "3":
            show_projection(risks["projection"], risks.get("goal"))
        elif choice == "4":
            what_if_flow(portfolio, simulate_rebalance, tickers, stress_test)
        elif choice == "5":
            qa_flow(findings, risks, qa_agent)
        elif choice == "6":
            export_report(portfolio_path, findings, risks, advice)
        else:
            console.print("[dim]Goodbye! Your data never left this machine except LLM prompts.[/dim]")
            break


if __name__ == "__main__":
    main()
