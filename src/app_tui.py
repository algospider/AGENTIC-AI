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
from textual.screen import ModalScreen
from textual.widgets import (Button, DataTable, Footer, Header, Input,
                             Label, ListItem, ListView, RichLog, Select, Sparkline, Static)

try:
    from report import build_report, build_json
except ImportError:
    from src.report import build_report, build_json

try:
    from pipeline import list_datasets, compare_portfolios
except ImportError:
    from src.pipeline import list_datasets, compare_portfolios

MENU = [
    ("1", "Dashboard"),
    ("2", "Holdings"),
    ("3", "Rebalance plan"),
    ("4", "Projection"),
    ("5", "What-If lab"),
    ("6", "Ask Advisor"),
    ("7", "Export report"),
    ("8", "Datasets & compare"),
]

HELP_TEXT = """Keys & mouse — everything clickable

  1–8        switch views (Dashboard … Datasets)
  q          quit
  h          this help
  Tab        move between sidebar, buttons and inputs
  ↑ ↓ / PgUp PgDn   scroll lists, tables and panels
  Enter      send chat / press focused button
  Mouse      click menu, buttons, tables; scroll anywhere

Tip: in Ask Advisor try 'why is my risk high?', 'stress test?',
'harvest losses?' or 'SIP for 100000 in 5 years?'."""


class HelpScreen(ModalScreen):
    BINDINGS = [("q", "dismiss", "Close"), ("h", "dismiss", "Close"),
                ("escape", "dismiss", "Close")]

    def compose(self) -> ComposeResult:
        yield Static(Panel(HELP_TEXT, title="Help", border_style="cyan"))

CSS = """
#sidebar { width: 28; border-right: solid cyan; background: $surface; }
#sidebar Label { padding: 1 1 0 1; text-style: bold; color: $accent; }
#main { padding: 1 2; }
#chat { height: 1fr; border: solid blue; }
#spark { height: 5; border: solid cyan; }
Input { margin: 0 0 1 0; }
Button { margin: 0 0 1 0; }
ListView > ListItem.--highlight { background: $accent; color: $text; text-style: bold; }
DataTable { border: solid $primary; }
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


def _alerts_panel(alerts: list) -> Panel:
    if not alerts:
        return Panel("No alerts.", title="Alerts", border_style="green")
    rows = []
    for a in alerts[:6]:
        sev = a.get("severity", "warn")
        style = "red" if sev == "critical" else "yellow" if sev == "warn" else "green"
        rows.append(f"[{style}][{sev.upper()}][/{style}] {a.get('text', '')}")
    more = f"\n…+{len(alerts) - 6} more" if len(alerts) > 6 else ""
    n_crit = sum(1 for a in alerts if a.get("severity") == "critical")
    border = "red" if n_crit else "yellow"
    return Panel("\n".join(rows) + more, title=f"Alerts ({len(alerts)})", border_style=border)


def _brief_panel(insights: list) -> Panel:
    if not insights:
        return Panel("No insights right now.", title="Today's Brief", border_style="green")
    style = {"bad": "red", "warn": "yellow", "good": "green"}
    rows = "\n".join(f"• [{style.get(i.get('tone'), 'white')}]{i['title']}[/] — {i['body']}"
                     for i in insights)
    return Panel(rows, title="Today's Brief", border_style="cyan")


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
                ("h", "help", "Help"),
                ("1", "view('dashboard')", "Dashboard"),
                ("2", "view('holdings')", "Holdings"),
                ("3", "view('plan')", "Rebalance"),
                ("4", "view('proj')", "Projection"),
                ("5", "view('whatif')", "What-If"),
                ("6", "view('qa')", "Q&A"),
                ("7", "view('export')", "Export"),
                ("8", "view('data')", "Datasets")]

    def __init__(self, portfolio, findings: dict, risks: dict, advice: str,
                 portfolio_path: str = "portfolio.csv",
                 simulate_fn=None, qa_fn=None,
                 stress_fn=None, goal_fn=None, load_fn=None) -> None:
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
        self.load_fn = load_fn
        self.history: list[dict] = []
        self._ds_paths: list[str] = []

    def compose(self) -> ComposeResult:
        yield Header(show_clock=False)
        with Horizontal():
            with Vertical(id="sidebar"):
                yield Label(" PORTFOLIO DOCTOR ")
                yield Label(" 1-8 views · q quit · h help ", id="hint")
                yield ListView(*[ListItem(Label(f"{k}  {name}"), id=f"m-{k}")
                                 for k, name in MENU], id="menu")
            yield ScrollableContainer(id="main")
        yield Footer()

    async def action_help(self) -> None:
        await self.push_screen(HelpScreen())

    async def on_mount(self) -> None:
        self.title = "Portfolio Health Advisor"
        self.sub_title = f"{self.portfolio_path} | {self.findings['returns']['totals']['total_value']}"
        await self.show_view("dashboard")
        self.query_one("#menu", ListView).focus()

    async def action_view(self, name: str) -> None:
        await self.show_view(name)

    async def on_list_view_selected(self, event: ListView.Selected) -> None:
        lv = getattr(event, "list_view", None)
        if lv is not None and getattr(lv, "id", "") == "ds-list":
            idx = int((event.item.id or "ds-0").split("-")[1])
            if 0 <= idx < len(self._ds_paths):
                await self._do_load(self._ds_paths[idx])
            return
        key = (event.item.id or "m-1").split("-")[1]
        await self.show_view({"1": "dashboard", "2": "holdings", "3": "plan",
                              "4": "proj", "5": "whatif", "6": "qa", "7": "export",
                              "8": "data"}[key])

    async def show_view(self, name: str) -> None:
        main = self.query_one("#main", ScrollableContainer)
        await main.remove_children()
        builders = {"dashboard": self._dashboard, "holdings": self._holdings,
                    "plan": self._plan, "proj": self._proj, "whatif": self._whatif,
                    "qa": self._qa, "export": self._export, "data": self._data}
        for widget in builders[name]():
            await main.mount(widget)
        main.scroll_home(animate=False)

    # ---- views (each returns a list of widgets) ----
    def _dashboard(self):
        t = self.findings["returns"]["totals"]
        a = self.findings["allocation"]
        weights = [p for _, p in sorted(a.get("by_sector", {}).items(), key=lambda x: -x[1])]
        stress = self.risks.get("stress", {})
        pnl_color = "green" if t["total_pnl"] >= 0 else "red"
        spark = Sparkline(weights, summary_function=max, id="spark")
        spark.border_title = "Sector weights, high to low"
        return [Static(_health_panel(self.risks.get("health", {}))),
                Static(Panel(f"Value {t['total_value']} | "
                              f"P&L [{pnl_color}]{t['total_pnl']:+} ({t['return_pct']:+}%)[/{pnl_color}] | "
                              f"Winners {t['num_winners']} / Losers {t['num_losers']} | "
                              f"Top {a['top_sector']} {a['top_sector_pct']}%",
                              title="Snapshot", border_style="cyan")),
                spark,
                Static(_alloc_table(a)),
                Static(_risk_panel(self.risks.get("risk", {}))),
                Static(_alerts_panel(self.risks.get("alerts", []))),
                Static(Panel(stress.get("note", ""), title="Stress check", border_style="yellow")),
                Static(_brief_panel(self.risks.get("insights", []))),
                Static(Panel(self.advice, title="Advisor — Recommendation", border_style="green"))]

    def _holdings(self):
        table = DataTable(zebra_stripes=True)
        for col in ("Ticker", "Company", "Qty", "Buy", "Now", "Value", "P&L", "P&L%"):
            table.add_column(col)
        for h in self.findings["returns"]["holdings"]:
            style = "bold green" if h["pnl"] >= 0 else "bold red"
            table.add_row(h["ticker"], h["company_name"][:24], f"{h['quantity']:g}",
                          f"{h['buy_price']:.2f}", f"{h['current_price']:.2f}",
                          f"{h['current_value']:.2f}",
                          Text(f"{h['pnl']:+.2f}", style=style),
                          Text(f"{h['pnl_pct']:+.2f}%", style=style))
        table.border_title = f"{len(self.findings['returns']['holdings'])} holdings — green wins, red losses"
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
        return [Static(Panel("Saves Markdown + JSON reports with every finding into outputs/.",
                             title="Export Report", border_style="green")),
                Button("Export now", id="exp-go", variant="success"),
                Static("", id="exp-result")]

    def _data(self):
        """Dataset switcher + A/B compare. Click a dataset to load it instantly."""
        try:
            datasets = list_datasets()
        except Exception as e:
            return [Static(Panel(f"Could not list datasets: {e}", title="Datasets"))]
        self._ds_paths = [d.get("path", "") for d in datasets]
        items = []
        for i, d in enumerate(datasets):
            if "error" in d:
                label = f"{d['name']}  (unreadable)"
            else:
                label = (f"{d['name']}  ·  {d['n']} holdings  ·  "
                         f"{d['value']:,.0f}  ·  {d['return_pct']:+.1f}%  ·  "
                         f"health {d['health']}/100({d['grade']})  ·  {d['risk']}")
            mark = "▶ " if d.get("path") == str(self.portfolio_path) else "   "
            items.append(ListItem(Label(mark + label), id=f"ds-{i}"))
        opts = [(d["name"], d["path"]) for d in datasets if "error" not in d]
        cur = str(self.portfolio_path)
        return [Static(Panel("Click a dataset to switch — advice is cached, so it loads instantly. "
                             "Compare pits any two against each other.",
                             title="Datasets & Compare", border_style="cyan")),
                Label("Available portfolios (click to load):"),
                ListView(*items, id="ds-list"),
                Label("Or import your own CSV (same columns):"),
                Input(placeholder="/path/to/my.csv  (blank = cancel)", id="ds-path"),
                Button("Import & load", id="ds-import", variant="primary"),
                Static("", id="ds-status"),
                Label("Compare two portfolios:"),
                Select(opts, value=cur if any(v == cur for _, v in opts) else (opts[0][1] if opts else ""),
                       id="cmp-a"),
                Select(opts, value=opts[1][1] if len(opts) > 1 else (opts[0][1] if opts else ""),
                       id="cmp-b"),
                Button("Compare A vs B", id="cmp-go", variant="warning"),
                Static("", id="cmp-result")]

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
        elif bid == "ds-import":
            await self._do_import()
        elif bid == "cmp-go":
            await self._do_compare()
        elif bid == "exp-go":
            try:
                md = await asyncio.to_thread(
                    build_report, str(self.portfolio_path),
                    self.findings, self.risks, self.advice)
                js = await asyncio.to_thread(
                    build_json, str(self.portfolio_path),
                    self.findings, self.risks, self.advice)
                self.query_one("#exp-result", Static).update(f"Saved:\n{md}\n{js}")
                self.notify("Reports saved (md + json)", title="Export")
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

    async def _do_load(self, path: str) -> None:
        """Swap the whole app to another dataset (advice comes from cache when seen)."""
        if not self.load_fn:
            self.notify("Loading not wired in this mode", severity="error")
            return
        main = self.query_one("#main", ScrollableContainer)
        await main.remove_children()
        await main.mount(Static(Panel(f"Loading {path.split('/')[-1]}…",
                                      title="Datasets", border_style="cyan")))
        try:
            portfolio, findings, risks, advice = await asyncio.to_thread(self.load_fn, path)
        except SystemExit as e:
            await self.show_view("data")
            self.notify(str(e)[:120], severity="error", title="Load failed")
            return
        except Exception as e:
            await self.show_view("data")
            self.notify(f"Load failed: {e}", severity="error")
            return
        self.portfolio, self.findings, self.risks, self.advice = portfolio, findings, risks, advice
        self.portfolio_path = path
        self.history = []
        self.sub_title = f"{path.split('/')[-1]} | {findings['returns']['totals']['total_value']}"
        await self.show_view("dashboard")
        self.notify(f"Loaded {path.split('/')[-1]}", title="Datasets")

    async def _do_import(self) -> None:
        raw = (self.query_one("#ds-path", Input).value or "").strip()
        if not raw:
            return
        await self._do_load(raw)

    async def _do_compare(self) -> None:
        out = self.query_one("#cmp-result", Static)
        a = self.query_one("#cmp-a", Select).value
        b = self.query_one("#cmp-b", Select).value
        if not a or not b:
            out.update("Pick two portfolios first.")
            return
        try:
            res = await asyncio.to_thread(compare_portfolios, str(a), str(b))
        except Exception as e:
            out.update(f"Compare failed: {e}")
            return
        sa, sb = res["a"], res["b"]
        rows = "\n".join(
            f"• {k}: {sa[k]}  vs  {sb[k]}"
            for k in ("value", "return_pct", "health", "risk", "top_sector_pct",
                      "winners", "losers"))
        out.update(f"{sa['file']}  vs  {sb['file']}\n{rows}\n"
                   + "\n".join(f"▸ {v}" for v in res["verdicts"]))

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
           stress_fn=None, goal_fn=None, load_fn=None) -> None:
    """Blocking full-screen run. Import this lazily so Rich mode never needs Textual."""
    PortfolioApp(portfolio, findings, risks, advice, portfolio_path,
                 simulate_fn, qa_fn, stress_fn, goal_fn, load_fn).run()
