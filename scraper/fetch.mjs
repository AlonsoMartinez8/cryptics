// Abre la web en un Chromium headless y ejecuta, dentro de la página,
// `await fetchDailyPuzzleFromSupabase("YYYY-MM-DD")` para cada fecha del rango.
//
// Los resultados se FUSIONAN con el cripticos.json existente (no se pierde nada)
// y nunca se guardan crípticos de días futuros (salvo --include-future).
//
// Uso: node fetch.mjs --url https://web.com --out ../app/src/data
//      [--year 2026]            todo ese año (por defecto, el actual)
//      [--days 7]               solo los últimos N días hasta hoy
//      [--from 2026-01-01] [--to 2026-12-31]
//      [--concurrency 4] [--fn fetchDailyPuzzleFromSupabase] [--headed] [--include-future]
//
// "Hoy" usa la zona horaria del proceso (variable TZ, p.ej. TZ=Europe/Madrid).

import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) args[key] = true;
      else { args[key] = next; i++; }
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const url = args.url;
// Fecha local (según TZ) en formato YYYY-MM-DD
const today = new Date().toLocaleDateString("sv-SE");
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const includeFuture = Boolean(args["include-future"]);

const year = Number(args.year ?? today.slice(0, 4));
let from = args.from ?? `${year}-01-01`;
let to = args.to ?? `${year}-12-31`;
if (args.days) {
  from = addDays(today, -Math.max(0, Number(args.days) - 1));
  to = today;
}
if (!includeFuture && to > today) to = today;
const outDir = path.resolve(args.out ?? "../app/src/data");
const concurrency = Math.max(1, Number(args.concurrency ?? 4));
const fnName = args.fn ?? "fetchDailyPuzzleFromSupabase";
const headed = Boolean(args.headed);

if (!url) {
  console.error("Falta --url");
  process.exit(1);
}

function* dateRange(start, end) {
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last) {
    yield d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
  }
}

const dates = [...dateRange(from, to)];
console.log(`→ ${url}`);
console.log(`→ ${dates.length} fechas (${from} … ${to}), concurrencia ${concurrency}`);

let browser;
try {
  browser = await chromium.launch({ headless: !headed });
} catch (e) {
  const msg = String(e?.message ?? e);
  if (/error while loading shared libraries|Host system is missing dependencies/i.test(msg)) {
    const lib = msg.match(/([\w.+-]+\.so[\w.]*)/)?.[1];
    console.error(`\n✖ A Chromium le faltan librerías del sistema${lib ? ` (${lib})` : ""}.`);
    console.error("  Instálalas una vez con:\n");
    console.error("    cd scraper && sudo npx playwright install-deps chromium\n");
    console.error("  o ejecuta el script con --install-deps.");
  } else {
    console.error(`✖ No se pudo abrir Chromium: ${msg.split("\n")[0]}`);
  }
  process.exit(3);
}
const page = await browser.newPage();

try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
} catch (e) {
  console.warn(`⚠ La página tardó en cargar (${e.message.split("\n")[0]}); continúo igualmente.`);
}

try {
  await page.waitForFunction(
    (name) => typeof window[name] === "function",
    fnName,
    { timeout: 30_000 }
  );
} catch {
  console.error(`✖ No encuentro la función global "${fnName}" en ${url}.`);
  await browser.close();
  process.exit(2);
}

async function fetchOne(date) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await page.evaluate(
        async ({ name, date }) => {
          try {
            const r = await window[name](date);
            return { ok: true, data: r ?? null };
          } catch (err) {
            return { ok: false, error: String(err?.message ?? err) };
          }
        },
        { name: fnName, date }
      );
      return result;
    } catch (err) {
      // Error de Playwright (p.ej. navegación); reintenta una vez
      if (attempt === 2) return { ok: false, error: String(err?.message ?? err) };
    }
  }
}

const puzzles = [];
const missing = [];
const errors = [];
let done = 0;

// Pool de concurrencia simple
const queue = [...dates];
async function worker() {
  while (queue.length) {
    const date = queue.shift();
    const res = await fetchOne(date);
    done++;
    if (res.ok && res.data && typeof res.data === "object" && res.data.clue) {
      puzzles.push({ date, ...res.data });
      process.stdout.write(`\r  ${done}/${dates.length}  ✔ ${date} ${" ".repeat(10)}`);
    } else if (res.ok) {
      missing.push(date);
      process.stdout.write(`\r  ${done}/${dates.length}  · ${date} (sin críptico)`);
    } else {
      errors.push({ date, error: res.error });
      process.stdout.write(`\r  ${done}/${dates.length}  ✖ ${date} (error)      `);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
process.stdout.write("\n");

await browser.close();

// ---------- fusionar con lo ya guardado ----------
const outFile = path.join(outDir, "cripticos.json");
let previous = { puzzles: [] };
try {
  previous = JSON.parse(await readFile(outFile, "utf8"));
} catch {}

const byDate = new Map((previous.puzzles ?? []).map((p) => [p.date, p]));
for (const p of puzzles) byDate.set(p.date, p);
const merged = [...byDate.values()]
  .filter((p) => includeFuture || p.date <= today) // nunca publicar días futuros
  .sort((a, b) => a.date.localeCompare(b.date));

const changed = JSON.stringify(merged) !== JSON.stringify(previous.puzzles ?? []);
const payload = {
  source: url,
  generatedAt: changed ? new Date().toISOString() : previous.generatedAt ?? new Date().toISOString(),
  count: merged.length,
  puzzles: merged,
};

await mkdir(outDir, { recursive: true });
await writeFile(outFile, JSON.stringify(payload, null, 2) + "\n", "utf8");
const errFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "errors.json");
if (errors.length) await writeFile(errFile, JSON.stringify(errors, null, 2), "utf8");

console.log(`✔ ${puzzles.length} encontrados en el rango · ${merged.length} en total (${changed ? "actualizado" : "sin cambios"})`);
console.log(`· ${missing.length} fechas sin críptico`);
if (errors.length) console.log(`✖ ${errors.length} fechas con error (ver ${errFile})`);
// Si TODO ha fallado, algo va mal con la web: avisa con código de error
if (errors.length && errors.length === dates.length) process.exit(4);
