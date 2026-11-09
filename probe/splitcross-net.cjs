"use strict";
/* Cross-chain SPLIT regression check v7.1 (送信はしません):
   ユーザー指摘 (2026-11-09)「クロスチェーンの数量計算が分割前提になって
   いない」「クロスチェーンも分割ルートで最適が欲しい」への回帰防止。
   正しいモデル: 各パートは「その量で交換1 → そのパート分のブリッジ
   手数料を差し引く → 交換2 をその到着額で」を独立に計算し、総受け取り
   はパート合計。提示される最適は「ベスト単一 (手数料引き後ネット)」と
   「ベスト分割 (手数料引き後ネット)」の多い方。
   - ケースA (100 USDT -> QOM): パートごとの手数料負けで単一が最適のまま
     (plan が立たない、または net 判定で shown=false)。
   - ケースC (1,000 USDT -> QOM): FISH 直接パート (R2) を含む分割が
     ネットでも単一を上回り、最適として提示される。総額は親ベンチマーク
     1,290.68B QOM (2026-11-06 実測) と同じ水準 (価格変動をみて
     1,270B を下限ガードにする)。
   - 内部整合 (厳密): パート金額の合計 == 入力総額、各パート
     arrival == leg1Out - feeDeduct、パート finalOut の合計 == 総額。
   - 独立再見積もり (requoteSplitPart) と各パート finalOut が 1% 以内で
     一致すること (v6.4 の leg2 合算モデルでは共有パートが 2〜4% ずれた)。 */
global.localStorage = { _m: {}, getItem(k) { return this._m[k] || null; }, setItem(k, v) { this._m[k] = v; }, removeItem(k) { delete this._m[k]; } };
const app = require("../docs/app.js");
const { parseAmount, formatAmount } = app;

let failures = 0;
function check(name, cond, detail) {
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail ? " — " + detail : ""));
  if (!cond) failures++;
}
const rel = (a, b) => Math.abs(Number(a - b)) / Number(b); // a,b BigInt, b != 0

(async () => {
  const usdt = app.tokenById("infinite", "usdt");
  const qom = app.tokenById("ql1", "native");
  const FISH_A = app.tokenById("infinite", "fish").address.toLowerCase();
  const isR2 = (cand) => cand.pair.sym === "QOM" && cand.leg1Path && cand.leg1Path.length === 3 && cand.leg1Path[1].toLowerCase() === FISH_A;

  /* ================= ケースA: 100 USDT -> QOM (単一が最適のはず) ================= */
  console.log("=== ケースA: 100 USDT -> QOM (QL1) ===");
  const amtA = parseAmount("100", usdt.decimals);
  const candsA = await app.quoteCrossPlan("infinite", usdt, "ql1", qom, amtA);
  const xsA = await app.evaluateCrossSplit("infinite", "ql1", amtA, candsA);
  const netA = xsA.plan ? await app.evaluateCrossSplitNet("infinite", "ql1", qom, xsA) : null;
  console.log("  単一ベスト (グロス):", formatAmount(xsA.bestSingle.finalOut, 18, 2), "QOM");
  if (xsA.best) console.log("  分割ベスト (ネット):", formatAmount(xsA.best.totalOut, 18, 2), "QOM | plan:", !!xsA.plan, "| net shown:", netA && netA.shown);
  check("A: 単一が最適のまま (分割プランが提示されない)", !xsA.plan || (netA && !netA.shown),
    xsA.plan ? "net=" + (netA && netA.shown) : "plan なし");

  /* ================= ケースC: 1,000 USDT -> QOM (分割が最適のはず) ================= */
  console.log("=== ケースC: 1,000 USDT -> QOM (QL1) ===");
  const amtC = parseAmount("1000", usdt.decimals);
  const candsC = await app.quoteCrossPlan("infinite", usdt, "ql1", qom, amtC);
  const xsC = await app.evaluateCrossSplit("infinite", "ql1", amtC, candsC);
  check("C: 分割プランが立つ", !!xsC.plan);
  if (xsC.plan) {
    const plan = xsC.plan;
    const netC = await app.evaluateCrossSplitNet("infinite", "ql1", qom, xsC);
    const singleNet = plan.totalOut - netC.netGain;
    console.log("  単一ベスト: グロス", formatAmount(xsC.bestSingle.finalOut, 18, 2), "-> ネット", formatAmount(singleNet, 18, 2), "QOM");
    console.log("  分割ベスト (ネット):", formatAmount(plan.totalOut, 18, 2), "QOM (ベンチマーク 1,290.68B / 単一ネット比 +" + ((Number(plan.totalOut) / Number(singleNet) - 1) * 100).toFixed(2) + "%)");
    for (const p of plan.parts) console.log(`    ${p.pct}% [中継 ${p.cand.pair.sym}] 入力 ${formatAmount(p.amountIn, usdt.decimals, 2)} USDT -> leg1Out ${formatAmount(p.leg1Out, 18, 2)} - 手数料 ${formatAmount(p.feeDeduct, p.cand.tSrc.decimals, 6)} ${p.cand.tSrc.symbol} -> ${formatAmount(p.finalOut, 18, 2)} QOM`);
    check("C: ネット判定で分割が最適として提示される", !!(netC && netC.shown), "netGain=" + (netC && formatAmount(netC.netGain, 18, 2)));
    check("C: FISH 直接パート (R2) を含む", plan.parts.some((p) => isR2(p.cand)));
    check("C: 総額がベンチマーク水準 (>= 1,270B QOM)", plan.totalOut >= 1270n * 10n ** 27n, formatAmount(plan.totalOut, 18, 2));
    check("C: パート金額の合計 == 入力総額", plan.parts.reduce((s, p) => s + p.amountIn, 0n) === amtC);
    check("C: パート受け取りの合計 == 総額", plan.parts.reduce((s, p) => s + p.finalOut, 0n) === plan.totalOut);
    check("C: 各パート arrival == leg1Out - feeDeduct", plan.parts.every((p) => p.arrival === p.leg1Out - p.feeDeduct));
    check("C: 各パート手数料が差し引かれている (feeDeduct > 0)", plan.parts.every((p) => p.feeDeduct > 0n));
    for (const p of plan.parts) {
      const rq = await app.requoteSplitPart("infinite", "ql1", p.cand, p.amountIn);
      check(`C: パート ${p.pct}% [${p.cand.pair.sym}] の受け取りが独立再見積もりと一致 (1%以内)`,
        !!rq && rel(rq.finalOut, p.finalOut) < 0.01,
        rq ? "engine " + formatAmount(p.finalOut, 18, 2) + " vs requote " + formatAmount(rq.finalOut, 18, 2) : "requote 不可");
    }
  }

  console.log(failures ? "\nSPLITCROSS-NET: " + failures + " FAILURES" : "\nSPLITCROSS-NET: ALL PASS");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("PROBE FAILED:", e); process.exit(1); });
