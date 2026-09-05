"""Rich-based Terminal UI for Portfolio Health Advisor (beginner-friendly)."""

from rich.columns import Columns
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.table import Table
from rich.text import Text

console = Console()

GREEN, RED = "green", "red"


def banner(subtitle: str = "Analyst -> Risk -> Advisor pipeline") -> None:
    console.print(Panel(
        Text("Portfolio Health Advisor", justify="center", style="bold cyan"),
        subtitle=subtitle,
        border_style="cyan"))


def show_holdings(returns: dict) -> None:
    t = Table(title="Holdings — Returns", show_lines=False)
    for col in ("Ticker", "Company", "Qty", "Buy", "Now", "Value", "P&L", "P&L%"):
        t.add_column(col, justify="right" if col not in ("Ticker", "Company") else "left")
    for h in returns["holdings"]:
        color = GREEN if h["pnl"] >= 0 else RED
        marker = "+" if h["pnl"] >= 0 else ""
        t.add_row(h["ticker"], h["company_name"][:22], f"{h['quantity']:g}",
                  f"{h['buy_price']:.2f}", f"{h['current_price']:.2f}",
                  f"{h['current_value']:.2f}",
                  f"[{color}]{marker}{h['pnl']:.2f}[/{color}]",
                  f"[{color}]{marker}{h['pnl_pct']:.2f}%[/{color}]")
    tot = returns["totals"]
    t.caption = (f"Total value {tot['total_value']:.2f} | Cost {tot['total_cost']:.2f} | "
                 f"P&L {tot['total_pnl']:+.2f} ({tot['return_pct']:+.2f}%) | "
                 f"Winners {tot['num_winners']} / Losers {tot['num_losers']}")
    console.print(t)


def show_allocation(allocation: dict) -> None:
    t = Table(title="Allocation by Sector", show_lines=False)
    t.add_column("Sector", justify="left")
    t.add_column("%", justify="right")
    t.add_column("Bar", justify="left")
    for sector, pct in sorted(allocation["by_sector"].items(), key=lambda x: -x[1]):
        bar = "█" * max(1, int(pct // 2))
        style = "red" if pct >= 50 else "yellow" if pct >= 30 else "cyan"
        t.add_row(sector, f"[{style}]{pct:.2f}%[/{style}]", f"[{style}]{bar}[/{style}]")
    t.caption = (f"Top: {allocation['top_sector']} {allocation['top_sector_pct']}% | "
                 f"Top holding {allocation['top_holding']} {allocation['top_holding_pct']}% | HHI {allocation['hhi']}")
    console.print(t)


def show_health(health: dict) -> None:
    score = health.get("score", 0)
    color = "green" if score >= 80 else "yellow" if score >= 65 else "red" if score < 50 else "yellow"
    filled = int(score // 5)
    bar = "█" * filled + "░" * (20 - filled)
    console.print(Panel(
        f"[{color}]{bar} {score}/100 (Grade {health.get('grade', '?')})[/{color}]\n"
        + "\n".join(f"• {b}" for b in health.get("breakdown", [])),
        title="Health Score", border_style=color))


def show_risk_tax(risk_data: dict) -> None:
    risk, tax = risk_data.get("risk", {}), risk_data.get("tax", {})
    color = {"LOW": "green", "MEDIUM": "yellow", "HIGH": "red"}.get(risk.get("risk_level", ""), "white")
    console.print(Panel("\n".join(f"• {f}" for f in risk.get("flags", [])),
                        title=f"Risk: [{color}]{risk.get('risk_level')} ({risk.get('risk_score')}/100)[/{color}]",
                        border_style=color))
    console.print(Panel(f"Est. tax ~{tax.get('total_est_tax')} on gains {tax.get('total_taxable_gain')} "
                        f"@ {tax.get('rate', 0)*100:.0f}% (simplified, unrealized only).",
                        title="Tax Estimator", border_style="magenta"))
    show_harvest(risk_data.get("harvest", {}))
    show_stress(risk_data.get("stress", {}))


def show_harvest(harvest: dict) -> None:
    if not harvest:
        return
    if not harvest.get("pairs"):
        console.print(Panel(harvest.get("note", "Nothing to harvest."),
                            title="Tax-Loss Harvest", border_style="green"))
        return
    rows = "\n".join(f"• Sell {p['sell_loser']} (loss {p['book_loss']}) offsets "
                     + ", ".join(f"{o['ticker']} ({o['offset']})" for o in p["offset_with"])
                     + f" → saves ~{p['tax_saved']}" for p in harvest["pairs"])
    console.print(Panel(rows + f"\nTotal est. saved ~{harvest['total_tax_saved']}. Simplified.",
                        title="Tax-Loss Harvest", border_style="magenta"))


def show_stress(stress: dict) -> None:
    if not stress:
        return
    console.print(Panel(stress.get("note", ""), title="Stress Check", border_style="yellow"))


def show_insights(insights: list) -> None:
    if not insights:
        return
    style = {"bad": "red", "warn": "yellow", "good": "green"}
    rows = "\n".join(f"• [{style.get(i.get('tone'), 'white')}]{i['title']}[/] — {i['body']}"
                     for i in insights)
    console.print(Panel(rows, title="Today's Brief", border_style="cyan"))


def show_plan(plan: dict) -> None:
    if not plan.get("sells"):
        console.print(Panel(plan.get("note", "No rebalancing needed."),
                            title="Rebalance Plan", border_style="green"))
        return
    t = Table(title=f"Rebalance Plan — frees ~{plan['freed_total']} (cap {plan['cap_pct']}%)")
    t.add_column("Action", justify="left")
    t.add_column("Target", justify="left")
    t.add_column("Amount", justify="right")
    for s in plan["sells"]:
        t.add_row("[red]SELL[/red]", f"{s['ticker']} (~{s['sell_qty']} shares)", f"{s['sell_value']:.2f}")
    for b in plan["buys"]:
        t.add_row("[green]BUY[/green]", f"{b['sector']} (-> {b['new_pct']}%)", f"{b['buy_value']:.2f}")
    t.caption = plan.get("note", "")
    console.print(t)


def show_projection(proj: dict, goal: dict | None = None) -> None:
    t = Table(title=f"Growth Projection — {proj.get('starting_value')} over {proj.get('years')}y (illustration)")
    t.add_column("Scenario", justify="left")
    t.add_column("Future value", justify="right")
    for s in proj.get("scenarios", []):
        t.add_row(s["label"], f"{s['value']:.2f}")
    t.caption = proj.get("note", "")
    console.print(t)
    if goal:
        console.print(Panel(
            f"Goal example: ~{goal.get('monthly_sip')}/month for {goal.get('years')}y "
            f"at {goal.get('annual_rate', 0)*100:.0f}% reaches ~{goal.get('target_amount')}. "
            "Ask me 'SIP for <amount> in <years> years' for your own goal.",
            title="SIP Goal Planner", border_style="cyan"))


def show_advice(advice: str) -> None:
    console.print(Panel(advice, title="Advisor — Recommendation", border_style="green"))


def show_dashboard(findings, risks, advice) -> None:
    """One-screen overview: the default view for beginners."""
    from rich.rule import Rule
    banner()
    show_health(risks.get("health", {}))
    console.print(Rule(style="dim"))
    show_holdings(findings["returns"])
    console.print(Rule(style="dim"))
    console.print(Columns([_alloc_renderable(findings["allocation"]), _risk_renderable(risks)]))
    console.print(Rule(style="dim"))
    show_risk_tax(risks)
    console.print(Rule(style="dim"))
    show_insights(risks.get("insights", []))
    console.print(Rule(style="dim"))
    show_advice(advice)


def _alloc_renderable(allocation: dict) -> Panel:
    rows = "\n".join(f"{s}: {p}%" for s, p in
                     sorted(allocation.get("by_sector", {}).items(), key=lambda x: -x[1]))
    return Panel(rows, title="Allocation", border_style="cyan")


def _risk_renderable(risks: dict) -> Panel:
    risk = risks.get("risk", {})
    return Panel("\n".join(f"• {f}" for f in risk.get("flags", [])),
                 title=f"Risk {risk.get('risk_level', '')}", border_style="yellow")


def main_menu() -> str:
    console.print("\n[bold]What next?[/bold]")
    console.print("  1) Dashboard (everything)  2) Rebalance plan  3) Growth + SIP")
    console.print("  4) What-if + stress lab    5) Ask a question  6) Export report")
    console.print("  7) Datasets & compare      8) Exit")
    console.print("[dim]Tip: run without --menu for the full-screen mouse + keyboard UI.[/dim]")
    return Prompt.ask("Choose", choices=["1", "2", "3", "4", "5", "6", "7", "8"], default="8")


def what_if_flow(portfolio, simulate_fn, tickers: list[str], stress_fn=None) -> None:
    console.print("\n[bold]What-if simulator[/bold] (nothing is actually traded)")
    console.print(f"Your tickers: {', '.join(tickers)}")
    console.print("1) Trim a holding  2) Target sector weights  3) Stress-test a crash  4) Back")
    choice = Prompt.ask("Choose", choices=["1", "2", "3", "4"], default="4")
    try:
        if choice == "1":
            ticker = Prompt.ask("Ticker to trim").upper().strip()
            if ticker not in tickers:
                console.print(f"[red]Unknown ticker. Pick one of: {', '.join(tickers)}[/red]")
                return
            frac = float(Prompt.ask("Fraction to sell (0-1)", default="0.5"))
            if not 0 < frac <= 1:
                console.print("[red]Fraction must be between 0 and 1.[/red]")
                return
            res = simulate_fn(portfolio, sell_ticker=ticker, sell_fraction=frac)
            console.print(Panel(f"Selling {frac*100:.0f}% of {ticker} frees ~{res['proceeds']}. "
                                f"New total ~{res['new_total']}. {res['note']}",
                                title="What-if Result", border_style="cyan"))
        elif choice == "2":
            raw = Prompt.ask("Targets like Technology=35, Financials=15 (should sum to ~100)")
            targets = {k.strip(): float(v) for k, v in
                       (p.split("=") for p in raw.split(",") if "=" in p)}
            if not targets:
                console.print("[red]No valid targets parsed. Example: Technology=35,Financials=15[/red]")
                return
            res = simulate_fn(portfolio, target_sector_weights=targets)
            rows = "\n".join(f"• {s}: {d['current_pct']}% → {d['target_pct']}% "
                             f"({d['delta_value']:+.2f})" for s, d in res["deltas"].items())
            console.print(Panel(rows + f"\n{res['note']}", title="What-if Result", border_style="cyan"))
        elif choice == "3" and stress_fn is not None:
            sector = Prompt.ask("Sector to crash (blank = biggest)", default="").strip() or None
            drop = float(Prompt.ask("Drop %", default="20"))
            res = stress_fn(portfolio, drop_sector=sector, drop_pct=drop)
            console.print(Panel(res["note"], title="Stress Result", border_style="yellow"))
    except ValueError as e:
        console.print(f"[red]Hmm, that input didn't work: {e}[/red]")
    except Exception as e:
        console.print(f"[red]What-if failed: {e}[/red]")


def qa_flow(findings, risk_data, qa_fn) -> None:
    console.print("\n[bold]Q&A — ask about your portfolio[/bold] (blank line goes back)")
    console.print("[dim]Try: 'why is my risk high?' / 'health score?' / 'stress test?' / 'harvest?' / 'SIP?'[/dim]")
    history: list[dict] = []
    while True:
        q = Prompt.ask("You").strip()
        if not q:
            break
        with console.status("Thinking..."):
            a = qa_fn(findings, q, history, risk_data)
        console.print(Panel(a, title="Advisor", border_style="blue"))
        history += [{"role": "user", "content": q}, {"role": "assistant", "content": a}]


def show_compare(res: dict) -> None:
    sa, sb = res["a"], res["b"]
    t = Table(title=f"{sa['file']}  vs  {sb['file']}")
    t.add_column("Metric", justify="left")
    t.add_column(sa["file"][:22], justify="right")
    t.add_column(sb["file"][:22], justify="right")
    for k in ("n", "value", "return_pct", "health", "risk", "top_sector_pct",
              "winners", "losers"):
        t.add_row(k, str(sa[k]), str(sb[k]))
    console.print(t)
    console.print(Panel("\n".join(f"▸ {v}" for v in res["verdicts"]),
                        title="Verdict", border_style="cyan"))


def datasets_flow(current_path: str, datasets: list[dict], load_fn, compare_fn) -> dict | None:
    """Browse, load, import and compare datasets. Returns fresh state dict or None."""
    while True:
        t = Table(title="Datasets & Compare")
        t.add_column("#", justify="right")
        t.add_column("File", justify="left")
        t.add_column("Holdings", justify="right")
        t.add_column("Value", justify="right")
        t.add_column("Return", justify="right")
        t.add_column("Health", justify="right")
        t.add_column("Risk", justify="left")
        for i, d in enumerate(datasets, 1):
            mark = "▶ " if d.get("path") == current_path else "  "
            if "error" in d:
                t.add_row(str(i), mark + d["name"], "-", "-", "-", "-", "unreadable")
            else:
                t.add_row(str(i), mark + d["name"], str(d["n"]), f"{d['value']:,.0f}",
                          f"{d['return_pct']:+.1f}%", f"{d['health']}/100({d['grade']})", d["risk"])
        console.print(t)
        console.print("[dim]<number> load · C compare two · P import own CSV path · B back[/dim]")
        choice = Prompt.ask("Datasets", default="B").strip()
        if choice.upper() == "B" or not choice:
            return None
        if choice.upper() == "P":
            raw = Prompt.ask("Path to your CSV").strip()
            if not raw:
                continue
            return _load_state(raw, load_fn)
        if choice.upper() == "C":
            try:
                ia = int(Prompt.ask("First dataset #")) - 1
                ib = int(Prompt.ask("Second dataset #")) - 1
                show_compare(compare_fn(datasets[ia]["path"], datasets[ib]["path"]))
            except (ValueError, IndexError, KeyError) as e:
                console.print(f"[red]Compare failed: {e}[/red]")
            continue
        try:
            return _load_state(datasets[int(choice) - 1]["path"], load_fn)
        except (ValueError, IndexError, KeyError):
            console.print("[red]Pick a number from the list, C, P or B.[/red]")


def _load_state(path: str, load_fn) -> dict | None:
    try:
        with console.status(f"Loading {path}..."):
            portfolio, findings, risks, advice = load_fn(path)
    except SystemExit as e:
        console.print(f"[red]{e}[/red]")
        return None
    except Exception as e:
        console.print(f"[red]Load failed: {e}[/red]")
        return None
    console.print(f"[green]Loaded {path} — {len(findings['returns']['holdings'])} holdings.[/green]")
    return {"path": path, "portfolio": portfolio, "findings": findings,
            "risks": risks, "advice": advice,
            "tickers": [h["ticker"] for h in findings["returns"]["holdings"]]}
