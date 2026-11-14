"use strict";
/* Cross-chain WRAP-bridge regression check v7.2 (送信はしません):
   ユーザー指摘 (2026-11-14)「QOM(QL1) -> ZAP(42) で WQOM のままブリッジ
   する経路が書いていない。これが一番安いのでは?」への修正の回帰防止。
   修正前は quoteCrossPlan が「出すトークン = 素の QOM」のとき QOM ブリッジ
   ペア自体を無効化していた (ラップ未対応が理由) ため、直接経路は単一・
   基準・分割候補の全部から消えていた。v7.2 ではラップ必須の直接ブリッジ
   (leg1Wrap) として見積もり対象に入り、実行はステップ1の deposit()。
   - 1T QOM: 直接 (ラップ) が単一ベスト級に存在し、分割プランにも
     ラップパートが含まれて、旧候補集合 (QOM 中継を除いた分割) を上回る。
   - 10B QOM: 直接は存在するが正直に負ける (単一ベストはラップ経路でない)。
   - WQOM 選択時: 従来どおり leg1Wrap は付かず、最終見積もりは素の QOM の
     ラップ経路と一致する (同じ経路のはず)。
   - 実ルートオブジェクトから作るラップ calldata が WQOM deposit() そのもの
     (宛先 / セレクタ / value) で、復号と往復一致すること。
   - フロー保存 (serialize/restore) で leg1Wrap が単一・分割とも保持される。 */
global.localStorage = { _m: {}, getItem(k) { return this._m[k] || null; }, setItem(k, v) { this._m[k] = v; }, removeItem(k) { delete this._m[k]; } };
const app = require("../docs/app.js");
const { CHAINS, parseAmount, formatAmount } = app;

let failures = 0;
function check(name, cond, detail) {
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail ? " — " + detail : ""));
  if (!cond) failures++;
}
const rel = (a, b) => Math.abs(Number(a - b)) / Number(b);

(async () => {
  const qomNative = app.tokenById("ql1", "native");
  const wqom = app.tokenById("ql1", "wqom");
  const zap = app.tokenById("infinite", "zap");
  const WQOM_ADDR = CHAINS.ql1.nativeAnchor.toLowerCase();
  const isWrapCand = (c) => c.enabled && c.pair.sym === "QOM" && c.leg1Wrap === true && !c.leg1Path;

  /* ================= 1T QOM -> ZAP: 直接 (ラップ) が最良級 ================= */
  console.log("=== 1T QOM (native) -> ZAP ===");
  const amtT = parseAmount("1000000000000", qomNative.decimals); // 1T QOM
  const candsT = await app.quoteCrossPlan("ql1", qomNative, "infinite", zap, amtT);
  const enabledT = candsT.filter((c) => c.enabled);
  const wrapT = enabledT.filter(isWrapCand);
  check("1T: ラップ直接経路が候補に存在する", wrapT.length >= 1, wrapT.length + " 件");
  const wrapBest = wrapT.length ? wrapT[0] : null;
  if (wrapBest) {
    console.log("  ラップ直接ベスト:", formatAmount(wrapBest.finalOut, zap.decimals, 4), "ZAP (leg2:", wrapBest.leg2Path ? wrapBest.leg2Path.length - 1 + " hop" : "identity", ")");
    check("1T: ラップ経路の leg1 は 1:1 (swap1Out == bridgeOut == amountIn)",
      wrapBest.swap1Out === amtT && wrapBest.bridgeOut === amtT);
    check("1T: ラップ経路が単一ベスト級 (>= 3,000 ZAP かつ上位3件以内)",
      wrapBest.finalOut >= 3000n * 10n ** 18n && enabledT.indexOf(wrapBest) <= 2,
      "rank " + (enabledT.indexOf(wrapBest) + 1) + " / " + formatAmount(wrapBest.finalOut, zap.decimals, 2) + " ZAP");
    check("1T: ラップ経路が基準 (benchmark) として印付けされるか、同等以上",
      wrapBest.isBenchmark === true || candsT.benchmark == null || wrapBest.finalOut >= candsT.benchmark.finalOut - (candsT.benchmark.finalOut / 100n),
      "benchmark=" + (candsT.benchmark ? candsT.benchmark.sym + "/" + candsT.benchmark.kind : "なし"));
  }
  const xsT = await app.evaluateCrossSplit("ql1", "infinite", amtT, candsT);
  console.log("  単一ベスト:", xsT.bestSingle ? formatAmount(xsT.bestSingle.finalOut, zap.decimals, 2) + " ZAP (中継 " + xsT.bestSingle.pair.sym + (xsT.bestSingle.leg1Wrap ? "・ラップ" : "") + ")" : "なし");
  check("1T: 分割プランが立つ", !!xsT.plan);
  if (xsT.plan) {
    for (const p of xsT.plan.parts) console.log(`    ${p.pct}% [中継 ${p.cand.pair.sym}${p.cand.leg1Wrap ? "・ラップ直接" : ""}] -> ${formatAmount(p.finalOut, zap.decimals, 2)} ZAP`);
    console.log("  分割総額:", formatAmount(xsT.plan.totalOut, zap.decimals, 2), "ZAP");
    check("1T: 分割プランにラップパートが含まれる", xsT.plan.parts.some((p) => p.cand.leg1Wrap === true));
    check("1T: パート金額の合計 == 入力総額", xsT.plan.parts.reduce((s, p) => s + p.amountIn, 0n) === amtT);
  }
  // 旧候補集合 (QOM 中継を丸ごと除く = 修正前の見え方) との比較
  const xsOld = await app.evaluateCrossSplit("ql1", "infinite", amtT, candsT.filter((c) => c.pair.sym !== "QOM"));
  const oldBest = xsOld.plan ? xsOld.plan.totalOut : xsOld.bestSingle.finalOut;
  console.log("  旧候補集合の最良:", formatAmount(oldBest, zap.decimals, 2), "ZAP (plan:", !!xsOld.plan, ")");
  check("1T: 修正後の最良 (単一/分割) が旧候補集合の最良を上回る",
    (xsT.plan ? xsT.plan.totalOut : xsT.bestSingle.finalOut) > oldBest,
    formatAmount(xsT.plan ? xsT.plan.totalOut : xsT.bestSingle.finalOut, zap.decimals, 2) + " vs " + formatAmount(oldBest, zap.decimals, 2));

  /* ================= 10B QOM -> ZAP: 直接は正直に負ける ================= */
  console.log("=== 10B QOM (native) -> ZAP ===");
  const amt10 = parseAmount("10000000000", qomNative.decimals); // 10B QOM
  const cands10 = await app.quoteCrossPlan("ql1", qomNative, "infinite", zap, amt10);
  const enabled10 = cands10.filter((c) => c.enabled);
  const wrap10 = enabled10.filter(isWrapCand);
  check("10B: ラップ直接経路が候補に存在する", wrap10.length >= 1);
  const xs10 = await app.evaluateCrossSplit("ql1", "infinite", amt10, cands10);
  console.log("  単一ベスト:", xs10.bestSingle ? formatAmount(xs10.bestSingle.finalOut, zap.decimals, 4) + " ZAP (中継 " + xs10.bestSingle.pair.sym + ")" : "なし",
    "| ラップ直接:", wrap10.length ? formatAmount(wrap10[0].finalOut, zap.decimals, 4) + " ZAP" : "なし");
  check("10B: 単一ベストはラップ経路ではない (正直に負ける)", !!xs10.bestSingle && xs10.bestSingle.leg1Wrap !== true,
    "best via " + (xs10.bestSingle && xs10.bestSingle.pair.sym));
  if (xs10.plan) {
    const wrapShare = xs10.plan.parts.filter((p) => p.cand.leg1Wrap).reduce((s, p) => s + p.pct, 0);
    console.log("  分割プランのラップ配分:", wrapShare + "%");
    check("10B: 分割が立つ場合もラップは過半を占めない", wrapShare <= 50, wrapShare + "%");
  }

  /* ================= WQOM 選択時: 従来どおり (ラップ不要) ================= */
  console.log("=== 1T WQOM -> ZAP (従来動作) ===");
  const candsW = await app.quoteCrossPlan("ql1", wqom, "infinite", zap, amtT);
  const enabledW = candsW.filter((c) => c.enabled);
  const directW = enabledW.filter((c) => c.pair.sym === "QOM" && !c.leg1Path);
  check("WQOM: QOM 中継の直接経路が存在し leg1Wrap は付かない",
    directW.length >= 1 && directW.every((c) => c.leg1Wrap !== true), directW.length + " 件");
  if (directW.length && wrapBest) {
    check("WQOM: 直接ベストの最終見積もりが素の QOM のラップ経路と一致 (1%以内)",
      rel(directW[0].finalOut, wrapBest.finalOut) < 0.01,
      formatAmount(directW[0].finalOut, zap.decimals, 2) + " vs " + formatAmount(wrapBest.finalOut, zap.decimals, 2));
  }

  /* ================= ラップ calldata (実ルートオブジェクトから) ================= */
  console.log("=== ラップ calldata / ルートオブジェクト完全性 ===");
  check("候補オブジェクトに leg1Wrap が載っている", !!wrapBest && wrapBest.leg1Wrap === true && wrapBest.leg1Path === null && !!wrapBest.leg2Path);
  if (wrapBest) {
    const tx = app.buildWrapTx(CHAINS.ql1, wrapBest.bridgeOut);
    console.log("  wrap tx:", tx.to, tx.data, "value", tx.value.toString());
    check("wrap tx の宛先が WQOM コントラクト", tx.to.toLowerCase() === WQOM_ADDR, tx.to);
    check("wrap tx の data が deposit() セレクタのみ", tx.data === "0xd0e30db0" && app.decodeWrapTxData(tx.data) !== null);
    check("wrap tx の value がパート額ちょうど (bridgeOut == amountIn)", tx.value === amtT && wrapBest.bridgeOut === amtT);
    check("decodeWrapTxData は他セレクタを拒否する", app.decodeWrapTxData("0x095ea7b3") === null && app.decodeWrapTxData("0xd0e30db0ff") === null);
  }
  /* フロー保存の往復で leg1Wrap / wrapTx が保持されること (再開の前提) */
  const flowV1 = { v: 1, pathsV5: true, step: 1, srcKey: "ql1", dstKey: "infinite", fromId: "native", toId: "zap", sym: "QOM", leg1Wrap: true, wrapTx: null };
  const backV1 = app.restoreXFlow(app.serializeXFlow(flowV1));
  check("単一フロー保存: leg1Wrap が往復で保持される", !!backV1 && backV1.leg1Wrap === true);
  const flowV2 = { v: 2, kind: "split", srcKey: "ql1", dstKey: "infinite", parts: [
    { idx: 0, sym: "QOM", leg1Wrap: true, wrapTx: "0xabc", step: 0 },
    { idx: 1, sym: "BABY", leg1Wrap: false, wrapTx: null, step: 0 },
  ] };
  const backV2 = app.restoreXFlow(app.serializeXFlow(flowV2));
  check("分割フロー保存: パートの leg1Wrap / wrapTx が往復で保持される",
    !!backV2 && backV2.parts[0].leg1Wrap === true && backV2.parts[0].wrapTx === "0xabc" && backV2.parts[1].leg1Wrap === false);

  console.log(failures ? "\nWRAPBRIDGE: " + failures + " FAILURES" : "\nWRAPBRIDGE: ALL PASS");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("PROBE FAILED:", e); process.exit(1); });
