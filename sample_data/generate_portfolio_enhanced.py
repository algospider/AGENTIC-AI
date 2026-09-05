"""Enhanced portfolio generator with realistic distributions, correlations, and market dynamics."""

import argparse
import csv
import random
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta

# Real-world sector weights (approximate S&P 500 sector weights)
SECTOR_WEIGHTS = {
    "Technology": 0.28,
    "Healthcare": 0.13,
    "Financials": 0.12,
    "Consumer Discretionary": 0.10,
    "Communication Services": 0.09,
    "Industrials": 0.08,
    "Consumer Staples": 0.06,
    "Energy": 0.04,
    "Utilities": 0.03,
    "Real Estate": 0.02,
    "Materials": 0.02,
}

SECTOR_TICKERS = {
    "Technology": {
        "prefixes": ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "AVGO", "ORCL", "CRM", 
                     "ADBE", "NFLX", "INTC", "AMD", "QCOM", "TXN", "INTU", "AMAT", "MU", "LRCX"],
        "name_parts": [("Apple", "Inc"), ("Microsoft", "Corp"), ("Alphabet", "Inc"), ("Amazon.com", "Inc"),
                       ("Meta Platforms", "Inc"), ("NVIDIA", "Corp"), ("Tesla", "Inc"), ("Broadcom", "Inc"),
                       ("Oracle", "Corp"), ("Salesforce", "Inc"), ("Adobe", "Inc"), ("Netflix", "Inc"),
                       ("Intel", "Corp"), ("AMD", "Inc"), ("Qualcomm", "Inc"), ("Texas Instruments", "Inc"),
                       ("Intuit", "Inc"), ("Applied Materials", "Inc"), ("Micron Technology", "Inc"), ("Lam Research", "Corp")]
    },
    "Healthcare": {
        "prefixes": ["JNJ", "UNH", "PFE", "ABT", "TMO", "DHR", "MRK", "ABBV", "LLY", "BMY",
                     "AMGN", "GILD", "CVS", "CI", "HUM", "ZTS", "BDX", "SYK", "BSX", "ISRG"],
        "name_parts": [("Johnson & Johnson", ""), ("UnitedHealth Group", "Inc"), ("Pfizer", "Inc"),
                       ("Abbott Laboratories", ""), ("Thermo Fisher Scientific", "Inc"), ("Danaher", "Corp"),
                       ("Merck & Co", "Inc"), ("AbbVie", "Inc"), ("Eli Lilly and Co", ""), ("Bristol-Myers Squibb", "Co"),
                       ("Amgen", "Inc"), ("Gilead Sciences", "Inc"), ("CVS Health", "Corp"), ("Cigna Group", "The"),
                       ("Humana", "Inc"), ("Zoetis", "Inc"), ("Becton Dickinson", "and Co"), ("Stryker", "Corp"),
                       ("Boston Scientific", "Corp"), ("Intuitive Surgical", "Inc")]
    },
    "Financials": {
        "prefixes": ["BRK.B", "JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "C", "AXP",
                     "BLK", "SPGI", "SCHW", "CB", "PGR", "AON", "MMC", "ICE", "CME", "MCO"],
        "name_parts": [("Berkshire Hathaway", "Inc"), ("JPMorgan Chase", "& Co"), ("Visa", "Inc"),
                       ("Mastercard", "Inc"), ("Bank of America", "Corp"), ("Wells Fargo", "& Co"),
                       ("Goldman Sachs Group", "Inc"), ("Morgan Stanley", ""), ("Citigroup", "Inc"),
                       ("American Express", "Co"), ("BlackRock", "Inc"), ("S&P Global", "Inc"),
                       ("Charles Schwab", "Corp"), ("Chubb Limited", ""), ("Progressive Corp", "The"),
                       ("Aon plc", ""), ("Marsh & McLennan", "Cos"), ("Intercontinental Exchange", "Inc"),
                       ("CME Group", "Inc"), ("Moody's Corp", "")]
    },
    "Consumer Discretionary": {
        "prefixes": ["TSLA", "AMZN", "HD", "MCD", "NKE", "LOW", "SBUX", "TGT", "TJX", "BKNG",
                     "MAR", "GM", "F", "HLT", "DIS", "CMCSA", "ORLY", "AZO", "CMG", "YUM"],
        "name_parts": [("Tesla", "Inc"), ("Amazon.com", "Inc"), ("Home Depot", "Inc"),
                       ("McDonald's Corp", ""), ("Nike", "Inc"), ("Lowe's Cos", "Inc"),
                       ("Starbucks Corp", ""), ("Target Corp", ""), ("TJX Cos", "Inc"),
                       ("Booking Holdings", "Inc"), ("Marriott International", "Inc"),
                       ("General Motors", "Co"), ("Ford Motor", "Co"), ("Hilton Worldwide", "Holdings Inc"),
                       ("Walt Disney", "Co"), ("Comcast Corp", ""), ("O'Reilly Automotive", "Inc"),
                       ("AutoZone", "Inc"), ("Chipotle Mexican Grill", "Inc"), ("Yum! Brands", "Inc")]
    },
    "Communication Services": {
        "prefixes": ["GOOGL", "META", "NFLX", "DIS", "CMCSA", "VZ", "T", "TMUS", "CHTR", "EA",
                     "TTWO", "ATVI", "FOXA", "FOX", "NWS", "NWSA", "IPG", "OMC", "DISH", "SIRI"],
        "name_parts": [("Alphabet", "Inc"), ("Meta Platforms", "Inc"), ("Netflix", "Inc"),
                       ("Walt Disney", "Co"), ("Comcast Corp", ""), ("Verizon Communications", "Inc"),
                       ("AT&T", "Inc"), ("T-Mobile US", "Inc"), ("Charter Communications", "Inc"),
                       ("Electronic Arts", "Inc"), ("Take-Two Interactive", "Software Inc"),
                       ("Activision Blizzard", "Inc"), ("Fox Corp", "Class A"), ("Fox Corp", "Class B"),
                       ("News Corp", "Class A"), ("News Corp", "Class B"),
                       ("Interpublic Group", "of Cos Inc"), ("Omnicom Group", "Inc"),
                       ("DISH Network Corp", ""), ("Sirius XM Holdings", "Inc")]
    },
    "Industrials": {
        "prefixes": ["HON", "UNP", "UPS", "CAT", "GE", "RTX", "LMT", "BA", "DE", "MMM",
                     "EMR", "ETN", "ITW", "PH", "CSX", "NSC", "FDX", "GD", "NOC", "LHX"],
        "name_parts": [("Honeywell International", "Inc"), ("Union Pacific Corp", ""),
                       ("United Parcel Service", "Inc"), ("Caterpillar", "Inc"),
                       ("General Electric", "Co"), ("RTX Corp", ""), ("Lockheed Martin", "Corp"),
                       ("Boeing Co", "The"), ("Deere & Co", ""), ("3M Co", ""),
                       ("Emerson Electric", "Co"), ("Eaton Corp plc", ""), ("Illinois Tool Works", "Inc"),
                       ("Parker-Hannifin Corp", ""), ("CSX Corp", ""), ("Norfolk Southern Corp", ""),
                       ("FedEx Corp", ""), ("General Dynamics Corp", ""), ("Northrop Grumman Corp", ""),
                       ("L3Harris Technologies", "Inc")]
    },
    "Consumer Staples": {
        "prefixes": ["PG", "KO", "PEP", "WMT", "COST", "PM", "MO", "EL", "CL", "KMB",
                     "GIS", "K", "HSY", "CLX", "STZ", "KDP", "SYY", "KR", "WBA", "CVS"],
        "name_parts": [("Procter & Gamble", "Co"), ("Coca-Cola Co", "The"), ("PepsiCo", "Inc"),
                       ("Walmart", "Inc"), ("Costco Wholesale", "Corp"), ("Philip Morris International", "Inc"),
                       ("Altria Group", "Inc"), ("Estee Lauder Cos", "Inc"), ("Colgate-Palmolive", "Co"),
                       ("Kimberly-Clark Corp", ""), ("General Mills", "Inc"), ("Kellogg Co", ""),
                       ("Hershey Co", "The"), ("Clorox Co", "The"), ("Constellation Brands", "Inc"),
                       ("Keurig Dr Pepper", "Inc"), ("Sysco Corp", ""), ("Kroger Co", "The"),
                       ("Walgreens Boots Alliance", "Inc"), ("CVS Health Corp", "")]
    },
    "Energy": {
        "prefixes": ["XOM", "CVX", "COP", "EOG", "SLB", "MPC", "PSX", "VLO", "OXY", "HAL",
                     "DVN", "FANG", "HES", "APA", "MRO", "OVV", "EQT", "CTRA", "AR", "CHK"],
        "name_parts": [("Exxon Mobil Corp", ""), ("Chevron Corp", ""), ("ConocoPhillips", ""),
                       ("EOG Resources", "Inc"), ("Schlumberger Limited", ""), ("Marathon Petroleum Corp", ""),
                       ("Phillips 66", ""), ("Valero Energy Corp", ""), ("Occidental Petroleum Corp", ""),
                       ("Halliburton Co", ""), ("Devon Energy Corp", ""), ("Diamondback Energy", "Inc"),
                       ("Hess Corp", ""), ("APA Corp", ""), ("Marathon Oil Corp", ""),
                       ("Ovintiv Inc", ""), ("EQT Corp", ""), ("Coterra Energy", "Inc"),
                       ("Antero Resources Corp", ""), ("Chesapeake Energy Corp", "")]
    },
    "Utilities": {
        "prefixes": ["NEE", "DUK", "SO", "D", "AEP", "EXC", "SRE", "XEL", "PEG", "ED",
                     "FE", "ETR", "CMS", "WEC", "AES", "CNP", "NI", "LNT", "ATO", "NRG"],
        "name_parts": [("NextEra Energy", "Inc"), ("Duke Energy Corp", ""), ("Southern Co", "The"),
                       ("Dominion Energy", "Inc"), ("American Electric Power", "Co Inc"),
                       ("Exelon Corp", ""), ("Sempra", ""), ("Xcel Energy", "Inc"),
                       ("Public Service Enterprise Group", "Inc"), ("Consolidated Edison", "Inc"),
                       ("FirstEnergy Corp", ""), ("Entergy Corp", ""), ("CMS Energy Corp", ""),
                       ("WEC Energy Group", "Inc"), ("AES Corp", "The"), ("CenterPoint Energy", "Inc"),
                       ("NiSource Inc", ""), ("Alliant Energy Corp", ""), ("Atmos Energy Corp", ""),
                       ("NRG Energy", "Inc")]
    },
    "Real Estate": {
        "prefixes": ["AMT", "PLD", "CCI", "EQIX", "PSA", "WELL", "DLR", "SPG", "O", "VICI",
                     "AVB", "EQR", "INVH", "ESS", "MAA", "UDR", "CPT", "BXP", "ARE", "EXR"],
        "name_parts": [("American Tower Corp", ""), ("Prologis", "Inc"), ("Crown Castle", "Inc"),
                       ("Equinix", "Inc"), ("Public Storage", ""), ("Welltower", "Inc"),
                       ("Digital Realty Trust", "Inc"), ("Simon Property Group", "Inc"),
                       ("Realty Income Corp", ""), ("VICI Properties", "Inc"),
                       ("AvalonBay Communities", "Inc"), ("Equity Residential", ""),
                       ("Invitation Homes", "Inc"), ("Essex Property Trust", "Inc"),
                       ("Mid-America Apartment Communities", "Inc"), ("UDR", "Inc"),
                       ("Camden Property Trust", ""), ("Boston Properties", "Inc"),
                       ("Alexandria Real Estate Equities", "Inc"), ("Extra Space Storage", "Inc")]
    },
    "Materials": {
        "prefixes": ["LIN", "APD", "SHW", "FCX", "NEM", "ECL", "DD", "DOW", "PPG", "IFF",
                     "NUE", "ALB", "FMC", "VMC", "MLM", "CF", "MOS", "IP", "PKG", "WRK"],
        "name_parts": [("Linde plc", ""), ("Air Products and Chemicals", "Inc"),
                       ("Sherwin-Williams Co", "The"), ("Freeport-McMoRan", "Inc"),
                       ("Newmont Corp", ""), ("Ecolab", "Inc"), ("DuPont de Nemours", "Inc"),
                       ("Dow Inc", ""), ("PPG Industries", "Inc"), ("International Flavors & Fragrances", "Inc"),
                       ("Nucor Corp", ""), ("Albemarle Corp", ""), ("FMC Corp", ""),
                       ("Vulcan Materials Co", ""), ("Martin Marietta Materials", "Inc"),
                       ("CF Industries Holdings", "Inc"), ("Mosaic Co", "The"),
                       ("International Paper Co", ""), ("Packaging Corp of America", ""),
                       ("WestRock Co", "")]
    }
}


def _generate_correlated_returns(n_holdings: int, sector_returns: dict, rng: random.Random) -> dict:
    """Generate correlated returns based on sector and market correlation."""
    # Market factor (systematic risk)
    market_return = rng.gauss(0.08, 0.15)
    
    # Sector-specific factors
    sector_alphas = {}
    for sector in sector_returns:
        sector_alphas[sector] = rng.gauss(0.0, 0.05)
    
    # Idiosyncratic (stock-specific) factors
    stock_alphas = {}
    for i in range(n_holdings):
        stock_alphas[i] = rng.gauss(0.0, 0.12)
    
    # Combine: return = market * beta + sector_alpha + stock_alpha
    returns = {}
    for i in range(n_holdings):
        sector = sector_returns[i]
        # Beta varies by sector (tech higher, utilities lower)
        sector_betas = {
            "Technology": 1.3, "Consumer Discretionary": 1.2, "Communication Services": 1.1,
            "Financials": 1.1, "Industrials": 1.0, "Materials": 1.0,
            "Healthcare": 0.8, "Energy": 1.1, "Real Estate": 0.9,
            "Consumer Staples": 0.7, "Utilities": 0.5
        }
        beta = sector_betas.get(sector, 1.0)
        total_return = market_return * beta + sector_alphas[sector] + stock_alphas[i]
        returns[i] = total_return
    
    return returns


def generate_realistic_portfolio(n: int, seed: int = 42) -> list[dict]:
    """Generate a realistic portfolio with real tickers, proper sector weights, and correlated returns."""
    rng = random.Random(seed)
    np.random.seed(seed)
    
    # Determine sector for each holding based on real weights (normalized to sum to 1)
    sectors = list(SECTOR_WEIGHTS.keys())
    w_sum = sum(SECTOR_WEIGHTS.values())
    weights = [SECTOR_WEIGHTS[s] / w_sum for s in sectors]
    
    # Assign sectors to holdings
    holdings_per_sector = {}
    for sector in sectors:
        holdings_per_sector[sector] = max(1, int(n * SECTOR_WEIGHTS[sector]))
    
    # Adjust to exactly n holdings
    total_assigned = sum(holdings_per_sector.values())
    if total_assigned != n:
        # Add/remove from largest sectors
        diff = n - total_assigned
        largest = max(holdings_per_sector, key=holdings_per_sector.get)
        holdings_per_sector[largest] += diff
    
    # Create list of sectors for each holding
    sector_assignments = []
    for sector, count in holdings_per_sector.items():
        sector_assignments.extend([sector] * count)
    rng.shuffle(sector_assignments)
    
    # Generate correlated returns
    sector_returns = _generate_correlated_returns(n, sector_assignments, rng)
    
    # Generate holdings (tickers kept unique: repeats get a numeric suffix
    # like TSLA2, so allocation math never merges distinct rows)
    ticker_uses: dict = {}
    rows = []
    for i in range(n):
        sector = sector_assignments[i]
        sector_data = SECTOR_TICKERS[sector]

        # Pick a real ticker
        ticker_idx = i % len(sector_data["prefixes"])
        base = sector_data["prefixes"][ticker_idx]
        ticker_uses[base] = ticker_uses.get(base, 0) + 1
        ticker = base if ticker_uses[base] == 1 else f"{base}{ticker_uses[base]}"
        name_parts = sector_data["name_parts"][ticker_idx]
        company_name = f"{name_parts[0]} {name_parts[1]}".strip() if name_parts[1] else name_parts[0]
        
        # Generate realistic prices
        # Base price varies by sector
        sector_price_ranges = {
            "Technology": (100, 500),
            "Healthcare": (80, 400),
            "Financials": (40, 300),
            "Consumer Discretionary": (60, 400),
            "Communication Services": (50, 350),
            "Industrials": (80, 300),
            "Consumer Staples": (60, 250),
            "Energy": (40, 200),
            "Utilities": (40, 150),
            "Real Estate": (50, 200),
            "Materials": (50, 250),
        }
        price_range = sector_price_ranges.get(sector, (50, 300))
        
        # Buy price at some point in the past (1-5 years ago)
        buy_price = round(rng.uniform(*price_range), 2)
        
        # Current price based on correlated return
        total_return = sector_returns[i]
        years_held = rng.uniform(0.5, 5.0)
        annual_return = (1 + total_return) ** (1/years_held) - 1
        current_price = round(buy_price * (1 + total_return), 2)
        
        # Quantity based on position size (log-normal distribution for realism)
        # Smaller positions more common
        base_qty = rng.lognormvariate(3.5, 0.8)  # median ~33
        qty = max(1, min(500, int(base_qty)))
        
        rows.append({
            "ticker": ticker,
            "company_name": company_name,
            "sector": sector,
            "quantity": qty,
            "buy_price": buy_price,
            "current_price": current_price
        })
    
    return rows


def _unique(base: str, uses: dict) -> str:
    """Keep tickers unique across a generated file (TSLA, TSLA2, ...)."""
    uses[base] = uses.get(base, 0) + 1
    return base if uses[base] == 1 else f"{base}{uses[base]}"


def generate_scenario_portfolio(scenario: str, n: int = 50, seed: int = 42) -> list[dict]:
    """Generate portfolios for specific test scenarios."""
    rng = random.Random(seed)
    uses: dict = {}

    if scenario == "concentrated":
        # Heavily concentrated in tech
        rows = []
        tech_tickers = SECTOR_TICKERS["Technology"]["prefixes"]
        tech_names = SECTOR_TICKERS["Technology"]["name_parts"]
        for i in range(n):
            idx = i % len(tech_tickers)
            ticker = _unique(tech_tickers[idx], uses)
            name = tech_names[idx][0]
            buy = round(rng.uniform(100, 500), 2)
            drift = rng.gauss(0.15, 0.25)  # High volatility tech
            current = round(max(1.0, buy * (1 + drift)), 2)
            qty = rng.randint(10, 100)
            rows.append({"ticker": ticker, "company_name": name, "sector": "Technology",
                         "quantity": qty, "buy_price": buy, "current_price": current})
        return rows
    
    elif scenario == "diversified":
        # Well diversified across all sectors
        return generate_realistic_portfolio(n, seed)
    
    elif scenario == "losers":
        # Portfolio with many losing positions
        rows = []
        sectors = list(SECTOR_TICKERS.keys())
        for i in range(n):
            sector = sectors[i % len(sectors)]
            sector_data = SECTOR_TICKERS[sector]
            idx = i % len(sector_data["prefixes"])
            ticker = _unique(sector_data["prefixes"][idx], uses)
            name = sector_data["name_parts"][idx][0]
            buy = round(rng.uniform(50, 400), 2)
            drift = rng.gauss(-0.10, 0.15)  # Mostly losers
            current = round(max(1.0, buy * (1 + drift)), 2)
            qty = rng.randint(5, 50)
            rows.append({"ticker": ticker, "company_name": name, "sector": sector,
                         "quantity": qty, "buy_price": buy, "current_price": current})
        return rows
    
    elif scenario == "high_dividend":
        # Utility/REIT heavy for income focus
        rows = []
        income_sectors = ["Utilities", "Real Estate", "Consumer Staples", "Energy"]
        for i in range(n):
            sector = income_sectors[i % len(income_sectors)]
            sector_data = SECTOR_TICKERS[sector]
            idx = i % len(sector_data["prefixes"])
            ticker = _unique(sector_data["prefixes"][idx], uses)
            name = sector_data["name_parts"][idx][0]
            buy = round(rng.uniform(40, 200), 2)
            drift = rng.gauss(0.04, 0.10)  # Lower growth, more stable
            current = round(max(1.0, buy * (1 + drift)), 2)
            qty = rng.randint(20, 200)
            rows.append({"ticker": ticker, "company_name": name, "sector": sector,
                         "quantity": qty, "buy_price": buy, "current_price": current})
        return rows
    
    else:
        return generate_realistic_portfolio(n, seed)


def main():
    p = argparse.ArgumentParser(description="Generate realistic demo portfolio CSV")
    p.add_argument("--n", type=int, default=200, help="Number of holdings")
    p.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    p.add_argument("--out", type=str, default=None, help="Output file path")
    p.add_argument("--scenario", type=str, default=None, 
                   choices=["concentrated", "diversified", "losers", "high_dividend"],
                   help="Generate specific scenario portfolio")
    args = p.parse_args()
    
    if args.scenario:
        rows = generate_scenario_portfolio(args.scenario, args.n, args.seed)
        suffix = f"_{args.scenario}"
    else:
        rows = generate_realistic_portfolio(args.n, args.seed)
        suffix = ""
    
    out = Path(args.out) if args.out else Path(__file__).resolve().parent / f"portfolio_{args.n}{suffix}_{args.seed}.csv"
    
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["ticker", "company_name", "sector",
                                          "quantity", "buy_price", "current_price"])
        w.writeheader()
        w.writerows(rows)
    
    total_value = sum(r["quantity"] * r["current_price"] for r in rows)
    total_cost = sum(r["quantity"] * r["buy_price"] for r in rows)
    
    # Sector breakdown
    sector_alloc = {}
    for r in rows:
        sector_alloc[r["sector"]] = sector_alloc.get(r["sector"], 0) + r["quantity"] * r["current_price"]
    
    print(f"Wrote {len(rows)} holdings to {out}")
    print(f"Total Value: ${total_value:,.2f} | Total Cost: ${total_cost:,.2f} | P&L: ${total_value-total_cost:,.2f} ({(total_value-total_cost)/total_cost*100:+.2f}%)")
    print("\nSector Allocation:")
    for sector, val in sorted(sector_alloc.items(), key=lambda x: -x[1]):
        print(f"  {sector}: {val/total_value*100:.2f}%")
    print(f"\nSeed: {args.seed}")


if __name__ == "__main__":
    main()