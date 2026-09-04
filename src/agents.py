"""
Agents: Portfolio Health Advisor

Two simple, sequential agents:

    Agent 1 (Analyst)  -->  findings (dict/JSON)  -->  Agent 2 (Advisor)

Neither agent needs to be built with a heavyweight framework. A
straightforward Python function that (optionally) calls an LLM API is
completely sufficient. Feel free to use LangChain/CrewAI/etc. if your team prefers,
but it is not required or rewarded extra for its own sake.
"""

from typing import Any

from tools import calculate_returns, calculate_allocation


def analyst_agent(portfolio) -> dict[str, Any]:
    """
    Agent 1: Reads portfolio data, calls both tools, and returns
    structured findings. This agent should NOT produce advice just
    facts, computed via the tools.

    TODO: implement this. At minimum:
        1. Call calculate_returns(portfolio)
        2. Call calculate_allocation(portfolio)
        3. Combine both results into a single findings dict

    Args:
        portfolio: a DataFrame loaded from the sample portfolio CSV.

    Returns:
        A dict combining return and allocation findings, e.g.:
        {
            "returns": {...},       # from calculate_returns()
            "allocation": {...},    # from calculate_allocation()
        }
    """
    returns = calculate_returns(portfolio)
    allocation = calculate_allocation(portfolio)

    return {
        'analysis': "",
        'returns': returns,
        'allocation': allocation
    }


def advisor_agent(findings: dict[str, Any]) -> str:
    """
    Agent 2: Takes Agent 1's structured findings and produces a short,
    plain-English summary with 1-2 actionable suggestions.

    This agent should call an LLM (via your API of choice) with a prompt
    that includes the findings, and ask it to reason about the
    portfolio's health and give simple advice.

    No new tools are needed here just reasoning over `findings`.

    TODO: implement this.

    Args:
        findings: the dict returned by analyst_agent().

    Returns:
        A plain-English summary string with actionable suggestions.
    """
    return ""
