import { NextRequest, NextResponse } from "next/server";
import { rowsFromGrid, rowsFromText, type ExtractResult } from "@/lib/extract";

export const runtime = "nodejs";

function splitCSVLine(line: string): string[] {
  // Minimal quoted-field support: "a, b",c
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function looksLikeHeader(cells: string[]): boolean {
  const joined = cells.join(" ").toLowerCase();
  return /ticker|symbol|scrip/.test(joined) && /qty|quantity|shares|units/.test(joined);
}

function gridFromText(text: string): ExtractResult | null {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return null;
  const headers = splitCSVLine(lines[0]);
  if (!looksLikeHeader(headers)) return null;
  return { ...rowsFromGrid(headers, lines.slice(1).map(splitCSVLine)), format: "csv" };
}

async function pdfToText(buf: Buffer): Promise<string> {
  // unpdf: serverless-safe PDF text (no worker needed, unlike raw pdfjs).
  const { extractText } = await import("unpdf");
  const { text } = await extractText(new Uint8Array(buf), { mergePages: false });
  return (Array.isArray(text) ? text.join("\n") : String(text ?? "")).slice(0, 60000);
}

export async function POST(req: NextRequest) {
  let file: File | null = null;
  try {
    file = (await req.formData()).get("file") as File | null;
  } catch {
    return NextResponse.json({ error: "Send multipart form with a 'file' field." }, { status: 400 });
  }
  if (!file || typeof file === "string")
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024)
    return NextResponse.json({ error: "File too large (8 MB max)." }, { status: 400 });

  const name = (file.name || "upload").toLowerCase();
  try {
    if (/\.(csv|txt|md|tsv)$/.test(name)) {
      const text = await file.text();
      const grid = gridFromText(text);
      const res = grid ?? { ...rowsFromText(text), format: "text" };
      return NextResponse.json({ filename: file.name, ...res });
    }
    if (/\.(xlsx|xls|ods)$/.test(name)) {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];
      if (aoa.length < 2) return NextResponse.json({ rows: [], warnings: ["Sheet is empty."], format: "xlsx", filename: file.name });
      const res = rowsFromGrid(aoa[0].map(String), aoa.slice(1));
      return NextResponse.json({ filename: file.name, ...res, format: "xlsx" });
    }
    if (/\.pdf$/.test(name)) {
      const text = await pdfToText(Buffer.from(await file.arrayBuffer()));
      const res = rowsFromText(text);
      return NextResponse.json({ filename: file.name, ...res, format: "pdf" });
    }
    return NextResponse.json(
      { error: `Unsupported type. Use .csv, .xlsx, .pdf or .txt — got “${file.name}”.` },
      { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not read that file: ${String((e as Error).message ?? e)}` },
      { status: 400 });
  }
}
