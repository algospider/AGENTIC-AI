"""
Core Tools — Portfolio Health Advisor

These are plain Python functions that the Analyst Agent will call. Keep
them as deterministic, testable functions (no LLM calls needed here) —
the LLM reasoning happens in the agents, not the tools.

You are free to change function signatures, split these into more
functions, or add new tools entirely (e.g. a tax estimator) for the
creative extension portion.
"""

import pandas as pd


def calculate_returns(portfolio: pd.DataFrame) -> dict:
    """
    Compute current value and gain/loss for each holding and the
    portfolio overall.

    TODO: implement this.

    Expected input columns (from sample_portfolio.csv):
        ticker, company_name, sector, quantity, buy_price, current_price

    Suggested output shape (feel free to adjust):
        {
            "holdings": [
                {
                    "ticker": "TCHX",
                    "current_value": ...,
                    "cost_basis": ...,
                    "gain_loss": ...,
                    "gain_loss_pct": ...,
                },
                ...
            ],
            "total_current_value": ...,
            "total_cost_basis": ...,
            "total_gain_loss": ...,
            "total_gain_loss_pct": ...,
        }

    Args:
        portfolio: a DataFrame loaded from sample_portfolio.csv (or a
            team's own uploaded portfolio with the same columns).

    Returns:
        A dict summarizing returns per holding and overall.
    """
    raise NotImplementedError("Implement return calculation here")


def calculate_allocation(portfolio: pd.DataFrame) -> dict:
    """
    Compute % concentration by sector (based on current value).

    TODO: implement this.

    Suggested output shape (feel free to adjust):
        {
            "by_sector": {
                "Technology": 42.5,
                "Financials": 12.1,
                ...
            },
            "most_concentrated_sector": "Technology",
            "most_concentrated_pct": 42.5,
        }

    Args:
        portfolio: a DataFrame loaded from sample_portfolio.csv.

    Returns:
        A dict summarizing sector allocation as percentages.
    """
    raise NotImplementedError("Implement allocation breakdown here")
