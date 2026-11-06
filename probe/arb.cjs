"use strict";
/* Arbitrage probe v4 (送信はしません):
   1) ユーザーの具体例: Infinite 42 -> QL1 QOM を中継ごとに見積もり、
      基準 (中継QOM / 直接ブリッジ) との差 (出荷コードの benchmark 計算) を表示
   2) 価格差ボード (quoteArbBoard) を初期値 1000億 QOM で実行し、全行を表で表示
   3) 往復裁定の最良例を表示 */
global.localStorage = { _m: {}, getItem(k) { return this._m[k] || null; }, setItem(k, v) { this._m[k] = v; }, removeItem(k) { delete this._m[k]; } };
const app = require("../docs/app.js");
const { parseAmount, formatAmount } = app;

async function example(amountText) {
  const f = app.tokenById("infinite", "native");   // 42
  const tk = app.tokenById("ql1", "native");       // QOM (QL1 native)
  const amountIn = parseAmount(amountText, f.decimals);
  const cands = await app.quoteCrossPlan("infinite", f, "ql1", tk, amountIn);
  const b = cands.benchmark;
  console.log(`\n=== EXAMPLE 42 Chain: 42 (${amountText}) -> QL1: QOM | benchmark: ${b ? b.sym + " (" + b.kind + ") = " + formatAmount(b.finalOut, 18, 2) + " QOM" : "なし"} ===`);
  for (const c of cands) {
    if (!c.enabled) { console.log(`  via ${c.pair.sym}: 無効 — ${c.reason}`); continue; }
    console.log(`  via ${c.pair.sym}: ${formatAmount(c.finalOut, 18, 2)} QOM | vs基準 ${c.vsBenchPct != null ? c.vsBenchPct.toFixed(2) + "%" : "-"}`);
  }
  const baby = cands.find((c) => c.pair.sym === "BABY");
  console.log(`  >> BABY が基準より多い: ${baby && baby.vsBenchPct != null ? baby.vsBenchPct > 0 : "n/a"} (${baby && baby.vsBenchPct != null ? baby.vsBenchPct.toFixed(2) + "%" : "-"})`);
  return cands;
}

(async () => {
  await example("100");
  await example("5000");

  /* --- 直接ブリッジ (トークンそのもので入る) vs ベンチマーク ---
     ユーザー例: Infinite に CAW / O を持っている場合、そのままブリッジして
     QL1 側で QOM に換えるルート (swap1 なし) を、QOM 中継ベンチマークと比較。 */
  async function directExample(srcKey, fromId, dstKey, toId, amountText, focusSym) {
    const f = app.tokenById(srcKey, fromId), tk = app.tokenById(dstKey, toId);
    const amountIn = parseAmount(amountText, f.decimals);
    const cands = await app.quoteCrossPlan(srcKey, f, dstKey, tk, amountIn);
    const b = cands.benchmark;
    const focus = cands.find((c) => c.pair.sym === focusSym);
    console.log(`\n=== DIRECT ${srcKey}: ${f.symbol} (${amountText}) -> ${dstKey}: ${tk.symbol} | benchmark: ${b ? b.sym + " (" + b.kind + ") = " + formatAmount(b.finalOut, tk.decimals, 2) + " " + tk.symbol : "なし"} ===`);
    for (const c of cands) {
      if (!c.enabled) { console.log(`  via ${c.pair.sym}: 無効 — ${c.reason}`); continue; }
      console.log(`  via ${c.pair.sym}: ${formatAmount(c.finalOut, tk.decimals, 2)} ${tk.symbol} | swap1 ${c.swap1Route ? "ルートあり" : "直接ブリッジ"} | vs基準 ${c.vsBenchPct != null ? c.vsBenchPct.toFixed(2) + "%" : "-"}`);
    }
    if (focus && focus.enabled) console.log(`  >> 直接ブリッジ (${focusSym} そのまま): ${formatAmount(focus.finalOut, tk.decimals, 2)} ${tk.symbol} / ベンチマーク比 ${focus.vsBenchPct != null ? focus.vsBenchPct.toFixed(2) + "%" : "-"}`);
    return cands;
  }
  await directExample("infinite", "caw", "ql1", "native", "10000", "CAW");
  await directExample("infinite", "o", "ql1", "native", "10000000", "O");
  await directExample("ql1", "qcaw", "infinite", "qom", "10000", "CAW");

  const startText = "100000000000"; // ボード初期値 1000億 QOM
  const start = parseAmount(startText, 18);
  const rows = await app.quoteArbBoard(start);
  console.log(`\n=== BOARD (start ${startText} QOM) 片道 ===`);
  const singles = rows.slice().sort((a, b2) => (b2.ok ? b2.gainSinglePct : -1e9) - (a.ok ? a.gainSinglePct : -1e9));
  for (const r of singles) {
    if (!r.ok) { console.log(`  ${r.sym} ${r.dirKey}: 見積もり不可 — ${r.reason}`); continue; }
    console.log(`  ${r.sym} ${r.dirKey}: ${r.gainSinglePct >= 0 ? "+" : ""}${r.gainSinglePct.toFixed(2)}% (end ${formatAmount(r.netSingle, 18, 2)} QOM, fee ${formatAmount(r.feeQom, 18, 2)} QOM)`);
  }
  console.log(`\n=== BOARD 往復 ===`);
  const rts = rows.slice().sort((a, b2) => (b2.ok ? b2.gainRtPct : -1e9) - (a.ok ? a.gainRtPct : -1e9));
  for (const r of rts) {
    if (!r.ok) { console.log(`  ${r.sym} ${r.dirKey}: 見積もり不可 — ${r.reason}`); continue; }
    console.log(`  ${r.sym} ${r.dirKey}: ${r.gainRtPct >= 0 ? "+" : ""}${r.gainRtPct.toFixed(2)}% (end ${formatAmount(r.netRt, 18, 2)} QOM, fees ${formatAmount(r.feeQomRt, 18, 2)} QOM)`);
  }
  const pos = rows.filter((r) => r.ok && r.gainSinglePct > 0);
  const bestRt = rts.find((r) => r.ok);
  console.log(`\n片道プラス: ${pos.length} 件 ${pos.map((r) => r.sym + "/" + r.dirKey + " +" + r.gainSinglePct.toFixed(2) + "%").join(", ") || "(なし)"}`);
  console.log(`往復の最良: ${bestRt ? bestRt.sym + " " + bestRt.dirKey + " " + bestRt.gainRtPct.toFixed(2) + "% (start " + startText + " -> end " + formatAmount(bestRt.netRt, 18, 2) + " QOM)" : "なし"}`);
  console.log("\nARB PROBE DONE");
})().catch((e) => { console.error("ARB PROBE FAILED:", e); process.exit(1); });
