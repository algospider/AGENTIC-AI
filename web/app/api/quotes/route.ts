// Live quotes via Yahoo Finance batch endpoint, proxied server-side.
// No API key needed. Unknown/fictional tickers simply miss and keep CSV prices.
import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

function toYahoo(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\./g, "-");
}

function stripSuffix(ticker: string): string | null {
  // Our generators disambiguate repeats as BASE+N (TSLA2). Try the base.
  const m = ticker.match(/^([A-Z\-]+?)(\d+)$/);
  return m ? m[1] : null;
}

async function fetchBatch(symbols: string[]): Promise<Record<string, { price: number; time: number; currency: string }>> {
  const out: Record<string, { price: number; time: number; currency: string }> = {};
  const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${symbols.join(",")}&range=1d&interval=1d`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!res.ok) return out;
    const data = await res.json();
    for (const item of data?.spark?.result ?? []) {
      const meta = item?.response?.[0]?.meta;
      const price = Number(meta?.regularMarketPrice);
      if (item?.symbol && Number.isFinite(price) && price > 0) {
        out[item.symbol] = {
          price,
          time: Number(meta?.regularMarketTime ?? 0),
          currency: String(meta?.currency ?? "USD"),
        };
      }
    }
  } catch { /* offline -> empty */ }
  finally { clearTimeout(timer); }
  return out;
}

export async function POST(req: NextRequest) {
  const { tickers } = (await req.json()) as { tickers: string[] };
  if (!Array.isArray(tickers) || !tickers.length)
    return NextResponse.json({ error: "tickers[] required" }, { status: 400 });
  const uniq = [...new Set(tickers.map((t) => toYahoo(String(t))).filter(Boolean))].slice(0, 150);

  const prices: Record<string, { price: number; time: number; currency: string }> = {};
  const missed = new Set(uniq);
  // Pass 1: exact symbols, in chunks (URL-length safe).
  for (let i = 0; i < uniq.length; i += 60) {
    const got = await fetchBatch(uniq.slice(i, i + 60));
    Object.keys(got).forEach((k) => { prices[k] = got[k]; missed.delete(k); });
  }
  // Pass 2: retry misses with numeric suffix stripped (TSLA2 -> TSLA).
  const retry: Record<string, string> = {};
  missed.forEach((m) => {
    const base = stripSuffix(m);
    if (base && !(base in prices)) retry[m] = base;
  });
  const bases = [...new Set(Object.values(retry))];
  for (let i = 0; i < bases.length; i += 60) {
    const got = await fetchBatch(bases.slice(i, i + 60));
    Object.entries(retry).forEach(([orig, base]) => {
      if (got[base] && !(orig in prices)) prices[orig] = got[base];
    });
  }
  // Map back to the caller's original ticker spellings.
  const byOrig: Record<string, { price: number; time: number; currency: string }> = {};
  tickers.forEach((t) => {
    const key = toYahoo(String(t));
    if (prices[key]) byOrig[String(t)] = prices[key];
  });
  return NextResponse.json({ prices: byOrig, updated: Object.keys(byOrig).length, requested: uniq.length });
}
