"""Generate a large, realistic, reproducible demo portfolio CSV.

Same columns as sample_portfolio.csv (fictional companies only):
    ticker,company_name,sector,quantity,buy_price,current_price

Usage:
    python3 sample_data/generate_portfolio.py                 # 200 holdings
    python3 sample_data/generate_portfolio.py --n 500 --seed 7
"""
import argparse
import csv
import random
from pathlib import Path

SECTORS = {
    "Technology": (["Tech", "Cloud", "Data", "Cyber", "Quantum", "Nano", "Pixel", "Logic"],
                   ["Systems", "Labs", "Works", "Dynamics", "Innovations", "Devices"]),
    "Financials": (["Fin", "Capital", "Trust", "Credit", "Money", "Wealth", "Union"],
                   ["Bank", "Holdings", "Partners", "Securities", "Financial"]),
    "Healthcare": (["Health", "Medi", "Bio", "Pharma", "Care", "Life", "Gen"],
                   ["Pharma", "Labs", "Sciences", "Health", "Biotech"]),
    "Energy": (["Ener", "Solar", "Hydro", "Petro", "Wind", "Grid", "Thermo"],
               ["Energy", "Power", "Renewables", "Oil", "Utilities"]),
    "Consumer Staples": (["Fresh", "Daily", "Home", "Pure", "Basic", "Value"],
                         ["Foods", "Goods", "Essentials", "Brands", "Stores"]),
    "Consumer Discretionary": (["Auto", "Style", "Travel", "Fun", "Lux", "Sport"],
                              ["Motors", "Retail", "Leisure", "Fashion", "Next"]),
    "Real Estate": (["Urban", "Prime", "Metro", "Land", "Sky", "Prop"],
                    ["Properties", "Estates", "Realty", "Developers", "Homes"]),
    "Utilities": (["Power", "Water", "Gas", "Volt", "Current", "Aqua"],
                  ["Grid", "Utility", "Services", "Energy", "Networks"]),
    "Industrials": (["Build", "Steel", "Heavy", "Machine", "Forge", "Indus"],
                    ["Industries", "Works", "Systems", "Corp", "Tools"]),
    "Materials": (["Chem", "Mine", "Paper", "Glass", "Metal", "Poly"],
                  ["Chemicals", "Mining", "Materials", "Packaging", "Films"]),
    "Communication": (["Tele", "Media", "Net", "Broad", "Signal", "Stream"],
                      ["Com", "Media", "Networks", "Broadcast", "Digital"]),
    "Insurance": (["Safe", "Shield", "Guard", "Assure", "Cover", "Secure"],
                  ["Insurance", "Assurance", "Life", "General", "Re"]),
}


def _ticker(rng: random.Random, used: set) -> str:
    while True:
        t = "".join(rng.choice("ABCDEFGHJKLMNPQRSTUVWXYZ") for _ in range(4))
        if t not in used:
            used.add(t)
            return t


def generate(n: int, seed: int) -> list[dict]:
    rng = random.Random(seed)
    sectors = sorted(SECTORS)
    used: set = set()
    rows = []
    for i in range(n):
        sector = sectors[i % len(sectors)]  # even spread across all sectors
        pre, suf = SECTORS[sector]
        name = f"{rng.choice(pre)}{rng.choice(suf)} {rng.choice(suf)}".replace("__", "_")
        # keep names tidy: "TechSystems Labs" style is fine for demo data
        buy = round(rng.uniform(20, 500), 2)
        drift = rng.gauss(0.08, 0.18)  # mostly winners, some losers
        current = round(max(1.0, buy * (1 + drift)), 2)
        qty = rng.randint(5, 120)
        rows.append({"ticker": _ticker(rng, used), "company_name": name,
                     "sector": sector, "quantity": qty,
                     "buy_price": buy, "current_price": current})
    return rows


def main():
    p = argparse.ArgumentParser(description="Generate a large demo portfolio CSV")
    p.add_argument("--n", type=int, default=200)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--out", type=str, default=None)
    args = p.parse_args()
    rows = generate(args.n, args.seed)
    out = Path(args.out) if args.out else Path(__file__).resolve().parent / f"large_portfolio_{args.n}.csv"
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["ticker", "company_name", "sector",
                                          "quantity", "buy_price", "current_price"])
        w.writeheader()
        w.writerows(rows)
    total = sum(r["quantity"] * r["current_price"] for r in rows)
    print(f"Wrote {len(rows)} holdings to {out} (value ~{total:,.2f}, seed {args.seed})")


if __name__ == "__main__":
    main()
