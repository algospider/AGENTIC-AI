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
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pandas as pd  # noqa: F401  (kept for `python -c` style reuse)

from agents import qa_agent
from tools import simulate_rebalance, stress_test, sip_for_goal

try:
    from pipeline import (REPO_ROOT, find_portfolio, run_pipeline,
                          list_datasets, compare_portfolios)
except ImportError:
    from src.pipeline import (REPO_ROOT, find_portfolio, run_pipeline,
                              list_datasets, compare_portfolios)

try:
    from tui import (console, show_dashboard, show_plan, show_projection,
                     main_menu, what_if_flow, qa_flow, datasets_flow, show_compare)
except ImportError:
    from src.tui import (console, show_dashboard, show_plan, show_projection,
                         main_menu, what_if_flow, qa_flow, datasets_flow, show_compare)

try:
    from report import build_report, build_json
except ImportError:
    from src.report import build_report, build_json

def setup_hint() -> None:
    """Friendly first-run guidance. Never a hard error: the app works without a key."""
    if not (REPO_ROOT / ".env").is_file():
        console.print("[yellow]No .env file — running on the built-in rule engine. "
                      "For AI advice: cp .env.example .env and add your key.[/yellow]")


def export_report(portfolio_path: Path, findings, risks, advice) -> None:
    md = build_report(str(portfolio_path), findings, risks, advice)
    js = build_json(str(portfolio_path), findings, risks, advice)
    console.print(f"[green]Reports saved:\n  {md}\n  {js}[/green]")


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
        print("--- METRICS ---")
        print(risks["metrics"])
        print("--- ALERTS ---")
        print(risks["alerts"])
        print("--- INSIGHTS ---")
        print(risks["insights"])
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
            print(build_json(str(portfolio_path), findings, risks, advice))
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
                              stress_test, sip_for_goal,
                              lambda p: run_pipeline(Path(p)))
            return
        except ImportError:
            console.print("[yellow]Textual not installed — using classic menu. "
                          "(pip install textual for full-screen)[/yellow]")
        except Exception as e:
            console.print(f"[yellow]Full-screen TUI failed ({e}) — using classic menu.[/yellow]")

    console.print(f"[dim]Loaded {len(tickers)} holdings from {portfolio_path.name}[/dim]")
    t = findings["returns"]["totals"]
    console.print(f"[dim]Worth {t['total_value']} ({t['return_pct']:+}% overall) · "
                  f"health {risks['health']['score']}/100 ({risks['health']['grade']}) · "
                  f"risk {risks['risk']['risk_level']}[/dim]")
    show_dashboard(findings, risks, advice)
    state = {"path": str(portfolio_path), "portfolio": portfolio, "findings": findings,
             "risks": risks, "advice": advice, "tickers": tickers}
    while True:
        choice = main_menu()
        if choice == "1":
            show_dashboard(state["findings"], state["risks"], state["advice"])
        elif choice == "2":
            show_plan(state["risks"]["plan"])
        elif choice == "3":
            show_projection(state["risks"]["projection"], state["risks"].get("goal"))
        elif choice == "4":
            what_if_flow(state["portfolio"], simulate_rebalance, state["tickers"], stress_test)
        elif choice == "5":
            qa_flow(state["findings"], state["risks"], qa_agent)
        elif choice == "6":
            export_report(Path(state["path"]), state["findings"], state["risks"], state["advice"])
        elif choice == "7":
            fresh = datasets_flow(state["path"], list_datasets(),
                                  lambda p: run_pipeline(Path(p)), compare_portfolios)
            if fresh:
                state.update(fresh)
                show_dashboard(state["findings"], state["risks"], state["advice"])
        else:
            console.print("[dim]Goodbye! Your data never left this machine except LLM prompts.[/dim]")
            break


if __name__ == "__main__":
    main()
