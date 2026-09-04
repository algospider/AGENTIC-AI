"""
Portfolio Health Advisor: Starter Entry Point

This file wires the two-agent pipeline together. You are free to
restructure this, add a web UI (Streamlit/Gradio), or build your own
CLI flow this is just here to remove blank-page friction.

Run with:
    python src/main.py --portfolio ../sample_data/sample_portfolio.csv
"""

import argparse

import pandas as pd

from agents import analyst_agent, advisor_agent


def main():
    parser = argparse.ArgumentParser(description="Portfolio Health Advisor")
    parser.add_argument(
        "--portfolio",
        type=str,
        required=True,
        help="Path to the portfolio CSV file",
    )
    args = parser.parse_args()

    print(f"Loading portfolio from: {args.portfolio}")
    portfolio = pd.read_csv(args.portfolio)

    print("\n[Agent 1] Analyst Agent: computing findings...")
    findings = analyst_agent(portfolio)
    print("\n--- FINDINGS ---")
    print(findings)

    print("\n[Agent 2] Advisor Agent: generating recommendation...")
    advice = advisor_agent(findings)
    print("\n--- ADVICE ---")
    print(advice)


if __name__ == "__main__":
    main()
