"""Full-screen Textual TUI for Portfolio Health Advisor.

Dashboard + Holdings + Rebalance + Projection + What-If + Q&A + Export,
all in one keyboard-driven screen. Falls back to the Rich menu (tui.py)
if Textual is not installed — main.py handles that switch.
"""

import asyncio

from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from textual.app import App, ComposeResult
from textual.containers import Horizontal, ScrollableContainer, Vertical
from textual.widgets import (Button, DataTable, Footer, Header, Input,
                             Label, ListItem, ListView, RichLog, Sparkline, Static)

try:
    from report import build_report
except ImportError:
    from src.report import build_report

MENU = [
    ("1", "Dashboard"),
    ("2", "Holdings"),
    ("3", "Rebalance plan"),
    ("4", "Projection"),
    ("5", "What-If lab"),
    ("6", "Ask Advisor"),
    ("7", "Export report"),
]

CSS = """
#sidebar { width: 26; border-right: solid cyan; }
#main { padding: 1 2; }
#chat { height: 1fr; border: solid blue; }
#spark { height: 5; border: solid cyan; }
ListView > ListItem.--highlight { background: $accent; }
"""


def _health_panel(health: dict) -> Panel:
    score = health.get("score", 0)
    color = "green" if score >= 80 else "yellow" if score >= 65 else "red" if score < 50 else "yellow"
    filled = int(score // 5)
    bar = "█" * filled + "░" * (20 - filled)
    return Panel(f"[{color}]{bar} {score}/100 (Grade {health.get('grade', '?')})[/{color}]\n"
                 + "\n".join(f"• {b}" for b in health.get("breakdown", [])),
                 title="Health Score", border_style=color)


def _risk_panel(risk: dict) -> Panel:
    color = {"LOW": "green", "MEDIUM": "yellow", "HIGH": "red"}.get(risk.get("risk_level", ""), "white")
    return Panel("\n".join(f"• {f}" for f in risk.get("flags", [])),
                 title=f"Risk {risk.get('risk_level')} ({risk.get('risk_score')}/100)",
                 border_style=color)


def _alloc_table(allocation: dict) -> Table:
    t = Table(title="Allocation by Sector")
    t.add_column("Sector")
    t.add_column("%", justify="right")
    for s, p in sorted(allocation.get("by_sector", {}).items(), key=lambda x: -x[1]):
        style = "red" if p >= 50 else "yellow" if p >= 30 else "cyan"
        t.add_row(s, f"[{style}]{p:.2f}%[/{style}]")
    return t


def _harvest_panel(harvest: dict) -> Panel:
    if not harvest.get("pairs"):
        return Panel(harvest.get("note", "Nothing to harvest."),
                     title="Tax-Loss Harvest", border_style="green")
    rows = "\n".join(f"• Sell {p['sell_loser']} (loss {p['book_loss']}) offsets "
                     + ", ".join(f"{o['ticker']} ({o['offset']})" for o in p["offset_with"])
                     + f" → saves ~{p['tax_saved']}" for p in harvest["pairs"])
    return Panel(rows + f"\nTotal est. saved ~{harvest['total_tax_saved']}. Simplified.",
                 title="Tax-Loss Harvest", border_style="magenta")


class PortfolioApp(App):
    """Full-screen portfolio advisor. All data is passed in — no I/O here except Q&A/Export."""

    CSS = CSS
    BINDINGS = [("q", "quit", "Quit"),
                ("1", "view('dashboard')", "Dashboard"),
                ("2", "view('holdings')", "Holdings"),
                ("3", "view('plan')", "Rebalance"),
                ("4", "view('proj')", "Projection"),
                ("5", "view('whatif')", "What-If"),
                ("6", "view('qa')", "Q&A"),
                ("7", "view('export')", "Export")]

    def __init__(self, portfolio, findings: dict, risks: dict, advice: str,
                 portfolio_path: str = "portfolio.csv",
                 simulate_fn=None, qa_fn=None,
                 stress_fn=None, goal_fn=None) -> None:
        super().__init__()
        self.portfolio = portfolio
        self.findings = findings
        self.risks = risks
        self.advice = advice
        self.portfolio_path = portfolio_path
        self.simulate_fn = simulate_fn
        self.qa_fn = qa_fn
        self.stress_fn = stress_fn
        self.goal_fn = goal_fn
        self.history: list[dict] = []

    def compose(self) -> ComposeResult:
        yield Header(show_clock=False)
        with Horizontal():
            with Vertical(id="sidebar"):
                yield Label(" MENU  (1-7, q=quit) ")
                yield ListView(*[ListItem(Label(f"{k}  {name}"), id=f"m-{k}")
                                 for k, name in MENU], id="menu")
            yield ScrollableContainer(id="main")
        yield Footer()

    async def on_mount(self) -> None:
        self.title = "Portfolio Health Advisor"
        self.sub_title = f"{self.portfolio_path} | {self.findings['returns']['totals']['total_value']}"
        await self.show_view("dashboard")
        self.query_one("#menu", ListView).focus()

    async def action_view(self, name: str) -> None:
        await self.show_view(name)

    async def on_list_view_selected(self, event: ListView.Selected) -> None:
        key = (event.item.id or "m-1").split("-")[1]
        await self.show_view({"1": "dashboard", "2": "holdings", "3": "plan",
                              "4": "proj", "5": "whatif", "6": "qa", "7": "export"}[key])

    async def show_view(self, name: str) -> None:
        main = self.query_one("#main", ScrollableContainer)
        await main.remove_children()
        builders = {"dashboard": self._dashboard, "holdings": self._holdings,
                    "plan": self._plan, "proj": self._proj, "whatif": self._whatif,
                    "qa": self._qa, "export": self._export}
        for widget in builders[name]():
            await main.mount(widget)
        main.scroll_home(animate=False)

    # ---- views (each returns a list of widgets) ----
    def _dashboard(self):
        t = self.findings["returns"]["totals"]
        a = self.findings["allocation"]
        weights = [p for _, p in sorted(a.get("by_sector", {}).items(), key=lambda x: -x[1])]
        stress = self.risks.get("stress", {})
        spark = Sparkline(weights, summary_function=max, id="spark")
        spark.border_title = "Sector weights, high to low"
        return [Static(_health_panel(self.risks.get("health", {}))),
                Static(Panel(f"Value {t['total_value']} | P&L {t['total_pnl']:+} "
                              f"({t['return_pct']:+}%) | Winners {t['num_winners']} / "
                              f"Losers {t['num_losers']} | Top {a['top_sector']} {a['top_sector_pct']}%",
                              title="Snapshot", border_style="cyan")),
                spark,
                Static(_alloc_table(a)),
                Static(_risk_panel(self.risks.get("risk", {}))),
                Static(Panel(stress.get("note", ""), title="Stress check", border_style="yellow")),
                Static(Panel(self.advice, title="Advisor — Recommendation", border_style="green"))]

    def _holdings(self):
        table = DataTable(zebra_stripes=True)
        for col in ("Ticker", "Company", "Qty", "Buy", "Now", "Value", "P&L", "P&L%"):
            table.add_column(col)
        for h in self.findings["returns"]["holdings"]:
            table.add_row(h["ticker"], h["company_name"][:24], f"{h['quantity']:g}",
                          f"{h['buy_price']:.2f}", f"{h['current_price']:.2f}",
                          f"{h['current_value']:.2f}", f"{h['pnl']:+.2f}", f"{h['pnl_pct']:+.2f}%")
        return [table]

    def _plan(self):
        plan = self.risks.get("plan", {})
        if not plan.get("sells"):
            return [Static(Panel(plan.get("note", "No rebalancing needed."),
                                 title="Rebalance Plan", border_style="green"))]
        table = DataTable(zebra_stripes=True)
        for col in ("Action", "Target", "Amount"):
            table.add_column(col)
        for s in plan["sells"]:
            table.add_row(Text("SELL", style="bold red"),
                          f"{s['ticker']} (~{s['sell_qty']} shares)", f"{s['sell_value']:.2f}")
        for b in plan["buys"]:
            table.add_row(Text("BUY", style="bold green"),
                          f"{b['sector']} (-> {b['new_pct']}%)", f"{b['buy_value']:.2f}")
        return [Static(Panel(f"Frees ~{plan['freed_total']} by capping sectors at "
                             f"{plan['cap_pct']}%", title="Rebalance Plan", border_style="cyan")),
                table,
                Static(Panel(plan.get("note", ""), title="Note", border_style="dim")),
                Static(_harvest_panel(self.risks.get("harvest", {})))]

    def _proj(self):
        proj = self.risks.get("projection", {})
        table = DataTable(zebra_stripes=True)
        table.add_column("Scenario")
        table.add_column("Future value")
        for s in proj.get("scenarios", []):
            table.add_row(s["label"], f"{s['value']:.2f}")
        return [Static(Panel(f"From {proj.get('starting_value')} over {proj.get('years')} years",
                             title="Growth Projection (illustration)", border_style="cyan")),
                table,
                Static(Panel(proj.get("note", ""), title="Note", border_style="dim")),
                Label("Goal planner — monthly SIP needed:"),
                Input(placeholder="Target amount, e.g. 100000", id="sip-target"),
                Input(placeholder="Years, e.g. 5", id="sip-years"),
                Input(placeholder="Return % p.a., e.g. 10", id="sip-rate"),
                Button("Calculate SIP", id="sip-go", variant="primary"),
                Static("", id="sip-result")]

    def _whatif(self):
        tickers = ", ".join(h["ticker"] for h in self.findings["returns"]["holdings"])
        sectors = ", ".join(sorted(self.findings["allocation"].get("by_sector", {})))
        return [Static(Panel(f"Nothing is actually traded. Your tickers: {tickers}",
                             title="What-If Lab", border_style="cyan")),
                Label("Trim a holding:"),
                Input(placeholder="Ticker, e.g. TCHX", id="wi-ticker"),
                Input(placeholder="Fraction to sell 0-1, e.g. 0.5", id="wi-frac"),
                Button("Simulate trim", id="wi-trim", variant="primary"),
                Label("Or target sector weights:"),
                Input(placeholder="Technology=35, Financials=15", id="wi-targets"),
                Button("Simulate targets", id="wi-apply", variant="primary"),
                Static(Panel("Result appears here.", title="Result"), id="wi-result"),
                Label("Or stress-test a crash:"),
                Input(placeholder=f"Sector (blank = top). Choices: {sectors}", id="st-sector"),
                Input(placeholder="Drop %, e.g. 20", id="st-drop"),
                Button("Run stress test", id="st-go", variant="warning"),
                Static(Panel(self.risks.get("stress", {}).get("note", ""), title="Stress result"),
                       id="st-result")]

    def _qa(self):
        return [Static(Panel("Try: why is my risk high? | health score? | stress test? | "
                             "harvest losses? | SIP for 100000? | tax?",
                             title="Ask Advisor", border_style="blue")),
                RichLog(id="chat", wrap=True, highlight=True),
                Input(placeholder="Type a question, Enter to send", id="q-in")]

    def _export(self):
        return [Static(Panel("Saves a Markdown report with every finding into outputs/.",
                             title="Export Report", border_style="green")),
                Button("Export now", id="exp-go", variant="success"),
                Static("", id="exp-result")]

    # ---- events ----
    async def on_button_pressed(self, event: Button.Pressed) -> None:
        bid = event.button.id or ""
        if bid == "wi-trim":
            await self._do_trim()
        elif bid == "wi-apply":
            await self._do_targets()
        elif bid == "st-go":
            await self._do_stress()
        elif bid == "sip-go":
            await self._do_sip()
        elif bid == "exp-go":
            try:
                path = await asyncio.to_thread(
                    build_report, str(self.portfolio_path),
                    self.findings, self.risks, self.advice)
                self.query_one("#exp-result", Static).update(f"Saved to {path}")
                self.notify(f"Report saved", title="Export")
            except Exception as e:
                self.query_one("#exp-result", Static).update(f"Export failed: {e}")
                self.notify("Export failed", severity="error")

    async def _do_trim(self) -> None:
        out = self.query_one("#wi-result", Static)
        tickers = [h["ticker"] for h in self.findings["returns"]["holdings"]]
        ticker = (self.query_one("#wi-ticker", Input).value or "").upper().strip()
        try:
            frac = float((self.query_one("#wi-frac", Input).value or "0.5").strip())
        except ValueError:
            out.update("Fraction must be a number like 0.5"); return
        if ticker not in tickers:
            out.update(f"Unknown ticker. Pick one of: {', '.join(tickers)}"); return
        if not 0 < frac <= 1:
            out.update("Fraction must be between 0 and 1."); return
        try:
            res = await asyncio.to_thread(self.simulate_fn, self.portfolio,
                                          sell_ticker=ticker, sell_fraction=frac)
            out.update(f"Selling {frac*100:.0f}% of {ticker} frees ~{res['proceeds']}. "
                       f"New total ~{res['new_total']}. {res['note']}")
        except Exception as e:
            out.update(f"Failed: {e}")

    async def _do_targets(self) -> None:
        out = self.query_one("#wi-result", Static)
        raw = self.query_one("#wi-targets", Input).value or ""
        try:
            targets = {k.strip(): float(v) for k, v in
                       (p.split("=") for p in raw.split(",") if "=" in p)}
        except ValueError:
            out.update("Could not parse. Example: Technology=35, Financials=15"); return
        if not targets:
            out.update("Type targets like: Technology=35, Financials=15"); return
        try:
            res = await asyncio.to_thread(self.simulate_fn, self.portfolio,
                                          target_sector_weights=targets)
            rows = "\n".join(f"• {s}: {d['current_pct']}% → {d['target_pct']}% "
                             f"({d['delta_value']:+.2f})" for s, d in res["deltas"].items())
            out.update(rows + f"\n{res['note']}")
        except Exception as e:
            out.update(f"Failed: {e}")

    async def _do_stress(self) -> None:
        out = self.query_one("#st-result", Static)
        sectors = sorted(self.findings["allocation"].get("by_sector", {}))
        raw_sector = (self.query_one("#st-sector", Input).value or "").strip()
        raw_drop = (self.query_one("#st-drop", Input).value or "20").strip()
        try:
            drop = float(raw_drop)
        except ValueError:
            out.update("Drop must be a number like 20"); return
        try:
            res = await asyncio.to_thread(
                self.stress_fn, self.portfolio,
                drop_sector=raw_sector or None, drop_pct=drop)
            out.update(res["note"])
        except ValueError as e:
            out.update(f"{e} Choices: {', '.join(sectors)}")
        except Exception as e:
            out.update(f"Failed: {e}")

    async def _do_sip(self) -> None:
        out = self.query_one("#sip-result", Static)
        try:
            target = float((self.query_one("#sip-target", Input).value or "").strip())
            years = int((self.query_one("#sip-years", Input).value or "").strip())
            rate = float((self.query_one("#sip-rate", Input).value or "10").strip()) / 100
        except ValueError:
            out.update("Enter numbers: target like 100000, years like 5, return like 10"); return
        try:
            res = await asyncio.to_thread(self.goal_fn, target, years, rate)
            out.update(res["note"] + f" Total invested ~{res['total_invested']}.")
        except ValueError as e:
            out.update(str(e))
        except Exception as e:
            out.update(f"Failed: {e}")

    async def on_input_submitted(self, event: Input.Submitted) -> None:
        if event.input.id != "q-in":
            return
        q = event.value.strip()
        if not q:
            return
        event.input.value = ""
        chat = self.query_one("#chat", RichLog)
        chat.write(Panel(q, title="You", border_style="dim"))
        chat.write("Thinking…")
        try:
            answer = await asyncio.to_thread(self.qa_fn, self.findings, q,
                                             self.history, self.risks)
        except Exception as e:
            answer = f"Sorry, that failed: {e}"
        self.history += [{"role": "user", "content": q},
                         {"role": "assistant", "content": answer}]
        chat.write(Panel(answer, title="Advisor", border_style="blue"))


def launch(portfolio, findings: dict, risks: dict, advice: str,
           portfolio_path: str = "portfolio.csv",
           simulate_fn=None, qa_fn=None,
           stress_fn=None, goal_fn=None) -> None:
    """Blocking full-screen run. Import this lazily so Rich mode never needs Textual."""
    PortfolioApp(portfolio, findings, risks, advice, portfolio_path,
                 simulate_fn, qa_fn, stress_fn, goal_fn).run()
