// Extractor Agent core — turns messy real-world files into clean holdings.
// Pure functions (no I/O): CSV/XLSX/PDF text in, validated rows out.
// The user always previews + confirms before anything enters the portfolio.

export interface ExtractedRow {
  ticker: string; company_name: string; sector: string;
  quantity: string; buy_price: string; current_price: string;
}
export interface ExtractResult {
  rows: ExtractedRow[]; warnings: string[]; format: string;
}

const HEADER_SYNONYMS: Record<string, string[]> = {
  ticker: ["ticker", "symbol", "code", "scrip", "instrument"],
  company_name: ["company_name", "company", "name", "security", "description", "stock"],
  sector: ["sector", "industry", "segment", "category"],
  quantity: ["quantity", "qty", "shares", "units", "holdings", "nos", "shares_held"],
  buy_price: ["buy_price", "buy", "buyprice", "avg_cost", "avgcost", "average_cost",
    "cost_price", "costprice", "purchase_price", "purchaseprice", "rate"],
  current_price: ["current_price", "current", "currentprice", "price", "market_price",
    "marketprice", "ltp", "last_price", "lastprice", "nav", "cmp"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

export function mapHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const used = new Set<number>();
  for (const [field, syns] of Object.entries(HEADER_SYNONYMS)) {
    for (let i = 0; i < headers.length; i++) {
      if (used.has(i)) continue;
      if (syns.some((s) => norm(headers[i]) === norm(s) || norm(headers[i]).includes(norm(s)))) {
        map[field] = i;
        used.add(i);
        break;
      }
    }
  }
  return map;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[$,₹\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** Structured rows (CSV/XLSX grids) → validated holdings. */
export function rowsFromGrid(headers: string[], grid: unknown[][]): ExtractResult {
  const warnings: string[] = [];
  const map = mapHeaders(headers);
  const need = ["ticker", "quantity", "buy_price", "current_price"];
  const missing = need.filter((f) => !(f in map));
  if (missing.length)
    return { rows: [], warnings: [`Could not find columns for: ${missing.join(", ")}.`], format: "grid" };
  const rows: ExtractedRow[] = [];
  grid.forEach((cells, ri) => {
    const cell = (i: number) => String(cells[i] ?? "").trim();
    const ticker = cell(map.ticker).toUpperCase().replace(/\s+/g, "");
    const qty = num(cells[map.quantity]);
    const buy = num(cells[map.buy_price]);
    const cur = num(cells[map.current_price]);
    if (!ticker || qty === null || buy === null || cur === null || qty <= 0 || buy <= 0 || cur <= 0) {
      warnings.push(`Row ${ri + 2} skipped (needs ticker + positive qty/buy/current).`);
      return;
    }
    rows.push({
      ticker,
      company_name: map.company_name !== undefined && cell(map.company_name)
        ? cell(map.company_name) : ticker,
      sector: map.sector !== undefined && cell(map.sector) ? cell(map.sector) : guessSector(ticker, cell(map.company_name ?? -1)),
      quantity: String(qty), buy_price: String(buy), current_price: String(cur),
    });
  });
  return { rows, warnings: warnings.slice(0, 8), format: "grid" };
}

const SECTOR_HINTS: [RegExp, string][] = [
  [/tech|soft|cloud|data|cyber|digital|info|semicon|chip|consult|service|solution/i, "Technology"],
  [/bank|financ|capital|credit|insurance|assur/i, "Financials"],
  [/pharma|health|medic|bio|drug|hospital/i, "Healthcare"],
  [/energy|oil|gas|solar|power|petro|utility|utilities|electric/i, "Energy"],
  [/auto|motor|steel|industr|manufact|cement|infra/i, "Industrials"],
  [/fmcg|consumer|retail|food|fashion|goods/i, "Consumer Staples"],
  [/real|estate|propert|realty|housing/i, "Real Estate"],
  [/tele|media|communic/i, "Communication"],
  [/chem|mine|metal|material/i, "Materials"],
];

export function guessSector(ticker: string, name: string): string {
  const hay = `${ticker} ${name}`;
  for (const [re, sector] of SECTOR_HINTS) if (re.test(hay)) return sector;
  return "Unknown";
}

/** Free text (PDF statements, pasted text) → holdings via line patterns. */
export function rowsFromText(text: string): ExtractResult {
  const rows: ExtractedRow[] = [];
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    // A holding line: TICKER-ish token + company words + ≥3 numbers (qty, buy, current)
    const m = line.match(/\b([A-Z][A-Z0-9.\-]{1,9})\b\s+([A-Za-z][A-Za-z .&'\-]{2,40}?)\s+([\d,]+\.?\d*)\s+[$₹]?([\d,]+\.?\d*)\s+[$₹]?([\d,]+\.?\d*)/);
    if (!m) continue;
    const [, ticker, name, q, b, c] = m;
    if (/^(TOTAL|PAGE|DATE|FOLIO|ACCOUNT|HOLDING|STATEMENT)$/i.test(ticker)) continue;
    const qty = num(q), buy = num(b), cur = num(c);
    if (qty === null || buy === null || cur === null || qty <= 0 || buy <= 0 || cur <= 0) continue;
    // Skip absurd rows (likely dates/totals): qty must be sane, prices sane
    if (qty > 1000000 || buy > 1000000 || cur > 1000000) continue;
    rows.push({
      ticker: ticker.toUpperCase(), company_name: name.trim(), sector: guessSector(ticker, name),
      quantity: String(qty), buy_price: String(buy), current_price: String(cur),
    });
  }
  if (!rows.length)
    warnings.push("No holding lines found. Tip: a line like “RELIANCE Reliance Industries 50 2400 2985” works.");
  return { rows, warnings, format: "text" };
}

/** Merge extracted rows into existing records (skip dup tickers, report them). */
export function mergeRows(
  existing: Record<string, string>[], incoming: ExtractedRow[],
): { merged: Record<string, string>[]; added: number; skipped: string[] } {
  const have = new Set(existing.map((r) => r.ticker));
  const skipped: string[] = [];
  const merged = [...existing];
  for (const r of incoming) {
    if (have.has(r.ticker)) { skipped.push(r.ticker); continue; }
    have.add(r.ticker);
    merged.push({ ...r });
  }
  return { merged, added: merged.length - existing.length, skipped };
}
