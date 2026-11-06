"use strict";
/* Cross-chain probe v3 (送信はしません):
   - QL1 QSWAP -> Infinite FISH / Infinite FISH -> QL1 QSWAP の中継候補ごとの実見積もり
   - ブリッジ calldata 構築の復号検証 (両方向: domain / recipient / amount)
   - サンプリング済み messageId の delivered() を出荷関数で再確認 */
global.localStorage = { _m: {}, getItem(k) { return this._m[k] || null; }, setItem(k, v) { this._m[k] = v; }, removeItem(k) { delete this._m[k]; } };
const fs = require("fs");
const app = require("../docs/app.js");
const { CHAINS, parseAmount, formatAmount } = app;

function label(chainKey, path) { return path.map((a) => app.symbolFor(chainKey, a)).join(" -> "); }
async function xquote(srcKey, fromId, dstKey, toId, amountText) {
  const f = app.tokenById(srcKey, fromId), tk = app.tokenById(dstKey, toId);
  const amountIn = parseAmount(amountText, f.decimals);
  const cands = await app.quoteCrossPlan(srcKey, f, dstKey, tk, amountIn);
  console.log(`\n=== CROSS ${CHAINS[srcKey].label}: ${f.symbol} (${amountText}) -> ${CHAINS[dstKey].label}: ${tk.symbol} ===`);
  for (const c of cands) {
    if (!c.enabled) { console.log(`  via ${c.pair.sym}: 無効 — ${c.reason}`); continue; }
    const s1 = c.swap1Route ? `${label(srcKey, c.swap1Route.path)} => ${formatAmount(c.swap1Out, c.tSrc.decimals, 6)} ${c.tSrc.symbol}` : `そのまま ${formatAmount(c.swap1Out, c.tSrc.decimals, 6)} ${c.tSrc.symbol}`;
    const s2 = c.swap2Route ? `${label(dstKey, c.swap2Route.path)} => ${formatAmount(c.finalOut, tk.decimals, 6)} ${tk.symbol}` : `そのまま ${formatAmount(c.finalOut, tk.decimals, 6)} ${tk.symbol}`;
    console.log(`  via ${c.pair.sym}: 交換1[${s1}] | ブリッジ ${formatAmount(c.bridgeOut, c.tSrc.decimals, 6)} ${c.tSrc.symbol} (手数料0, ネイティブ代 ${formatAmount(c.nativeFee, 18, 4)} ${CHAINS[srcKey].nativeSymbol}) | 交換2[${s2}]`);
  }
  const best = cands.find((c) => c.enabled);
  console.log(`  >> ベスト中継: ${best ? best.pair.sym : "なし"} / 最終見積もり ${best ? formatAmount(best.finalOut, tk.decimals, 6) + " " + tk.symbol : "—"}`);
  return cands;
}

(async () => {
  const a = await xquote("ql1", "qswap", "infinite", "fish", "10000");
  const b = await xquote("infinite", "fish", "ql1", "qswap", "10");
  const bestA = a.find((c) => c.enabled), bestB = b.find((c) => c.enabled);
  console.log("\n中継 != 送受トークンのケース:", "QL1->INF best via", bestA && bestA.pair.sym, "(QSWAP/FISH ではない中継:", bestA && bestA.pair.sym !== "QSWAP" && bestA.pair.sym !== "FISH", ") / INF->QL1 best via", bestB && bestB.pair.sym);

  // ---- calldata construction (no broadcast) ----
  const recip = "0x1111111111111111111111111111111111111111";
  const pairQ = app.bridgePairBySym("QOM");
  const txI = app.buildBridgeTx(pairQ, "infinite", recip, 123456789n, 2941645679554057186n);
  const dI = app.decodeBridgeTxData(txI.data);
  console.log("\nINF->QL1 calldata:", txI.to, "value", txI.value.toString(), "| decoded dest", dI.destination, "recipient", dI.recipient, "amount", dI.amount.toString(), "| OK:", dI.destination === 766 && dI.recipient === recip && dI.amount === 123456789n);
  const txQ = app.buildBridgeTx(pairQ, "ql1", recip, 987654321n);
  const dQ = app.decodeBridgeTxData(txQ.data);
  console.log("QL1->INF calldata:", txQ.to, "value", txQ.value.toString(), "| decoded dest", dQ.destination, "recipient", dQ.recipient, "amount", dQ.amount.toString(), "| OK:", dQ.destination === 421018 && dQ.recipient === recip && dQ.amount === 987654321n);

  // ---- delivered() re-check with a sampled messageId via shipped function ----
  const sampling = JSON.parse(fs.readFileSync(__dirname + "/../tools/bridge/sampling_results.json", "utf8"));
  const exQ = sampling.pairs.QOM.ql1ToInf.examples[0];
  const okQ = await app.fetchBridgeDelivered(CHAINS.infinite, exQ.messageId);
  console.log("\ndelivered() 再確認 QL1->INF QOM (send", exQ.sendTx.slice(0, 12) + "…):", okQ);
  const exI = sampling.pairs.QOM.infToQl1.examples[0];
  const okI = await app.fetchBridgeDelivered(CHAINS.ql1, exI.messageId);
  console.log("delivered() 再確認 INF->QL1 QOM (send", exI.sendTx.slice(0, 12) + "…):", okI);
  console.log("\nCROSSCHAIN PROBE DONE");
})().catch((e) => { console.error("PROBE FAILED:", e); process.exit(1); });
