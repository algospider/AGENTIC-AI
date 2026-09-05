"""Fullscreen TUI pilot test: real mouse clicks through every view.

Stub QA avoids network. Run: python3 tests/test_tui.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import pandas as pd
from agents import analyst_agent, risk_agent
from app_tui import PortfolioApp
from textual.widgets import Button, DataTable, Input, Static

CSV = str(Path(__file__).resolve().parent.parent / "sample_data" / "sample_portfolio.csv")


async def _run():
    df = pd.read_csv(CSV)
    findings = analyst_agent(df)
    risks = risk_agent(df, findings)
    from tools import simulate_rebalance, stress_test, sip_for_goal
    app = PortfolioApp(df, findings, risks, "advice text", "sample.csv",
                       simulate_rebalance,
                       lambda f, q, h, r: f"STUB-ANSWER to: {q}",
                       stress_test, sip_for_goal)
    async with app.run_test(size=(110, 45)) as pilot:
        # Mouse through every read-only view
        for m in ("#m-1", "#m-2", "#m-3", "#m-4"):
            await pilot.click(m)
            await pilot.pause()
        assert len(app.query("#main DataTable")) >= 1
        print("PASS menu clicks 1-4")

        # What-If trim via mouse
        await pilot.click("#m-5")
        await pilot.pause()
        app.query_one("#wi-ticker", Input).value = "TCHX"
        app.query_one("#wi-frac", Input).value = "0.5"
        await pilot.click("#wi-trim")
        await pilot.pause()
        assert "frees" in str(app.query_one("#wi-result", Static).render())
        print("PASS what-if trim click")

        # Stress test via mouse
        app.query_one("#st-drop", Input).value = "20"
        app.query_one("#st-go", Button).scroll_visible()
        await pilot.pause()
        await pilot.click("#st-go")
        await pilot.pause()
        assert "Technology" in str(app.query_one("#st-result", Static).render())
        print("PASS stress click")

        # SIP planner via mouse
        await pilot.click("#m-4")
        await pilot.pause()
        app.query_one("#sip-target", Input).value = "100000"
        app.query_one("#sip-years", Input).value = "5"
        app.query_one("#sip-rate", Input).value = "10"
        app.query_one("#sip-go", Button).scroll_visible()
        await pilot.pause()
        await pilot.click("#sip-go")
        await pilot.pause()
        assert "/month" in str(app.query_one("#sip-result", Static).render())
        print("PASS sip click")

        # Q&A via keyboard
        await pilot.click("#m-6")
        await pilot.pause()
        app.query_one("#q-in", Input).value = "health score"
        app.query_one("#q-in", Input).focus()
        await pilot.pause()
        await pilot.press("enter")
        await pilot.pause(2)
        assists = [m for m in app.history if m["role"] == "assistant"]
        assert assists and "STUB-ANSWER" in assists[-1]["content"], app.history
        print("PASS Q&A:", assists[-1]["content"])

        # Export via mouse
        await pilot.click("#m-7")
        await pilot.pause()
        await pilot.click("#exp-go")
        await pilot.pause(3)
        out = str(app.query_one("#exp-result", Static).render())
        assert out.startswith("Saved to"), out
        print("PASS export click:", out)


if __name__ == "__main__":
    asyncio.run(_run())
    print("FULLSCREEN CLICK TEST PASSED")
