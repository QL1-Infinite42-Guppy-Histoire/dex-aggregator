"use strict";
/* Cross-chain SPLIT probe v6/v6.1 (送信はしません):
   - ケースA (ユーザーのスクショ条件): 100 USDT (42 Chain) -> QOM (QL1)。
     親実測: 単一ベスト (中継QOM) 158,939,386,644.5 / 中継BABY 158,726,284,663.2 /
     50:50 分割 = 173,506,993,671.8 (+9.17%)。evaluateCrossSplit がそれ以上の
     分割プランを「勝ち」として出すことを確認する (v6: 40/40/20 = +10.70%)。
   - ケースB (対照): Infinite QOM 10B -> QL1 QOM。v6.1/v6.2 では単独ベスト
     (BABY経由 11.955B, +19.5%) が勝ち、分割プランは出なかった (同一中継
     バリアントは v6.1 ルールで探索対象外)。v6.4 の合算モデルでは BABY
     バリアント分割が leg2 合算後も小幅 (+0.70%) に勝ち、プランが立つ。
     内訳は leg1 第1ホップ (QOM→FISH 直接 / QOM→42→FISH) の分散であり、
     leg1 共有サフィックスまで合算した反実仮想でも +0.05〜0.12% 勝つため、
     leg2 二重見積もりの幻ではない — v6.4 レポートで親へ判断を仰いだ事項。
   - ケースC (v6.1): 1,000 USDT -> QOM (QL1)。v6 では中継ごとの最良だけが
     候補で、プラン (70/20/10) = 1,139.34B に leg1 USDT→FISH→QOM のパートが
     入らなかった。親実測: R1 50/R2 50 = 1,171.64B、R1 40/R2 30/BABY 20/
     FATHER 10 = 1,290.68B (+38.5%)。拡張した探索が R2 パートを含む
     1,270B 以上のプランを出すことを確認する。
   - calldata 照合: 分割プランの1パートについて交換1 tx を組み立て、
     amountIn ワードがパート金額 (全体額ではない) であることと、
     パスがそのパートの保存パスと一致することを復号して確認する。 */
global.localStorage = { _m: {}, getItem(k) { return this._m[k] || null; }, setItem(k, v) { this._m[k] = v; }, removeItem(k) { delete this._m[k]; } };
const app = require("../docs/app.js");
const { parseAmount, formatAmount } = app;

function label(chainKey, path) { return path ? path.map((a) => app.symbolFor(chainKey, a)).join(" → ") : "(直接ブリッジ)"; }
function fullLabel(r) {
  const l1 = r.leg1Path ? label("infinite", r.leg1Path) + "（42 Chain）" : r.tSrc.symbol + "（42 Chain・直接）";
  const l2 = r.leg2Path ? label("ql1", r.leg2Path) + "（QL1）" : r.tDst.symbol + "（QL1・そのまま）";
  return l1 + " ⇢ブリッジ⇢ " + l2;
}
function decodeSwap(data) {
  // swapExactTokensForTokens: words = [amountIn, amountOutMin, pathOffset, to, deadline, pathLen, ...path]
  const paramsHex = data.slice(10);
  const word = (i) => paramsHex.slice(i * 64, i * 64 + 64);
  const amountIn = BigInt("0x" + word(0));
  const off = Number(BigInt("0x" + word(2)));
  const len = Number(BigInt("0x" + paramsHex.slice(off * 2, off * 2 + 64)));
  const path = [];
  for (let i = 0; i < len; i++) path.push("0x" + paramsHex.slice(off * 2 + 64 + i * 64, off * 2 + 64 + (i + 1) * 64).slice(24));
  return { amountIn, path };
}
const samePath = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x.toLowerCase() === b[i].toLowerCase());
const pctVs = (a, b) => ((Number(a) / Number(b) - 1) * 100);
const F18 = (raw) => Number(raw) / 1e18;
const refDiff = (raw, refFloat) => ((F18(raw) / refFloat - 1) * 100).toFixed(2) + "%";

(async () => {
  /* ================= ケースA: 100 USDT -> QOM (QL1) ================= */
  const fromA = app.tokenById("infinite", "usdt");
  const toA = app.tokenById("ql1", "native");
  const amtA = parseAmount("100", fromA.decimals);
  console.log("=== ケースA: 100 USDT (42 Chain) -> QOM (QL1) ===");
  const candsA = await app.quoteCrossPlan("infinite", fromA, "ql1", toA, amtA);
  const enA = candsA.filter((c) => c.enabled);
  const bestSingleA = enA[0];
  console.log("単一ベスト:", fullLabel(bestSingleA), "=>", formatAmount(bestSingleA.finalOut, 18, 2), "QOM (親実測 158,939,386,644.5 / 差", refDiff(bestSingleA.finalOut, 158939386644.5) + ")");
  const babyA = enA.find((c) => c.pair.sym === "BABY");
  console.log("中継BABY最良:", babyA && formatAmount(babyA.finalOut, 18, 2), "QOM (親実測 158,726,284,663.2)");
  const xsA = await app.evaluateCrossSplit("infinite", "ql1", amtA, candsA);
  console.log("分割探索: 評価した配分数:", xsA.evaluated, "| 最良の分割:", xsA.best && formatAmount(xsA.best.totalOut, 18, 2), "QOM | 親実測50:50 = 173,506,993,671.8 との差:", xsA.best ? refDiff(xsA.best.totalOut, 173506993671.8) : "—");
  console.log("v6.2 微調整:", JSON.stringify(xsA.refineStats), "| v6.1 結果 176,818,000,402.81 以上か:", xsA.best ? xsA.best.totalOut >= parseAmount("176818000402.81", 18) : "—");
  console.log("分割プラン (勝ちとして出るか):", !!xsA.plan);
  if (xsA.best) {
    for (const p of xsA.best.parts) console.log(`   ${p.pct}% [中継 ${p.cand.pair.sym}] ${fullLabel(p.cand)} => ${formatAmount(p.finalOut, 18, 2)} QOM`);
    console.log("   単一ベスト比:", pctVs(xsA.best.totalOut, bestSingleA.finalOut).toFixed(2) + "%", "| パート金額の合計 == 全体額:", xsA.best.parts.reduce((s, p) => s + p.amountIn, 0n) === amtA);
  }
  // 50:50 (QOMルート/BABYルート) そのものの再現確認: 両ルートを半額で個別に辿る
  const qomRouteA = enA.find((c) => c.pair.sym === "QOM");
  async function quotePart(cand, amount) {
    const l1 = cand.leg1Path ? await app.requotePathExact(app.CHAINS.infinite, amount, cand.leg1Path) : amount;
    if (l1 == null) return null;
    return cand.leg2Path ? await app.requotePathExact(app.CHAINS.ql1, l1, cand.leg2Path) : l1;
  }
  const half = amtA / 2n;
  const pQ = await quotePart(qomRouteA, half), pB = await quotePart(babyA, amtA - half);
  console.log("手計算 50:50 (QOMルート半分 + BABYルート半分):", pQ && pB ? formatAmount(pQ + pB, 18, 2) + " QOM (親実測 173,506,993,671.8)" : "見積もり不可");

  /* ================= ケースB: 10B QOM (Infinite) -> QOM (QL1) ================= */
  const fromB = app.tokenById("infinite", "qom");
  const amtB = parseAmount("10000000000", fromB.decimals);
  console.log("\n=== ケースB (対照): 10B QOM (42 Chain) -> QOM (QL1) ===");
  const candsB = await app.quoteCrossPlan("infinite", fromB, "ql1", toA, amtB);
  const enB = candsB.filter((c) => c.enabled);
  for (const sym of ["QOM", "BABY", "FATHER", "HAWK"]) {
    const r = enB.find((c) => c.pair.sym === sym);
    if (r) console.log(`  単独 中継${sym}: ${formatAmount(r.finalOut, 18, 2)} QOM (${pctVs(r.finalOut, amtB).toFixed(2)}% vs 直接) [${fullLabel(r)}]`);
  }
  const xsB = await app.evaluateCrossSplit("infinite", "ql1", amtB, candsB);
  console.log("単一ベスト:", enB[0] && enB[0].pair.sym, "=>", enB[0] && formatAmount(enB[0].finalOut, 18, 2), "QOM");
  console.log("最良の分割:", xsB.best && formatAmount(xsB.best.totalOut, 18, 2), "QOM (単一ベスト比:", xsB.best ? pctVs(xsB.best.totalOut, enB[0].finalOut).toFixed(2) + "%" : "—", ")");
  if (xsB.best) for (const p of xsB.best.parts) console.log(`   ${p.pct}% [中継 ${p.cand.pair.sym}] ${fullLabel(p.cand)} => ${formatAmount(p.finalOut, 18, 2)} QOM`);
  console.log("★ v6.4 所見: v6.1/v6.2 ではプラン非表示だったが、合算モデルでは BABY バリアント分割 (leg1 第1ホップ QOM→FISH と QOM→42→FISH の分散) が小幅に勝ち、プランが立つ。leg1 共有サフィックスまで合算した反実仮想でも +0.05〜0.12% 勝つため、leg2 二重見積もり由来の幻ではない (親へ報告済みの判断待ち事項)。plan =", !!xsB.plan);

  /* ================= ケースC (v6.1): 1,000 USDT -> QOM (QL1) ================= */
  const amtC = parseAmount("1000", fromA.decimals);
  console.log("\n=== ケースC (v6.1): 1,000 USDT (42 Chain) -> QOM (QL1) ===");
  const candsC = await app.quoteCrossPlan("infinite", fromA, "ql1", toA, amtC);
  const enC = candsC.filter((c) => c.enabled);
  const bestSingleC = enC[0];
  console.log("単一ベスト:", fullLabel(bestSingleC), "=>", formatAmount(bestSingleC.finalOut, 18, 2), "QOM (親実測 931,938,815,018.81)");
  const FISH_A = app.tokenById("infinite", "fish").address.toLowerCase();
  const isR2 = (cand) => cand.pair.sym === "QOM" && cand.leg1Path && cand.leg1Path.length === 3 && cand.leg1Path[1].toLowerCase() === FISH_A;
  const r2 = enC.find(isR2);
  console.log("R2 (中継QOM・leg1 USDT→FISH→QOM) 単独:", r2 && formatAmount(r2.finalOut, 18, 2), "QOM (親実測 846,349,806,769.16)");
  const xsC = await app.evaluateCrossSplit("infinite", "ql1", amtC, candsC);
  console.log("分割探索: 評価した配分数:", xsC.evaluated, "| 最良の分割:", xsC.best && formatAmount(xsC.best.totalOut, 18, 2), "QOM (親の手計算ベスト 1,290,684,698,120.14)");
  console.log("v6.2 微調整:", JSON.stringify(xsC.refineStats));
  console.log("★ v6.1 結果 (1,290,684,698,120.14) 以上か:", xsC.best ? xsC.best.totalOut >= parseAmount("1290684698120.14", 18) : "—",
    "| ★★ 目標ライン 1,300B QOM に届いたか:", xsC.best ? xsC.best.totalOut >= 1300n * 10n ** 27n : "—",
    "| 1,300B まであと:", xsC.best ? formatAmount(1300n * 10n ** 27n - xsC.best.totalOut, 18, 2) + " QOM" : "—");
  console.log("分割プラン (勝ちとして出るか):", !!xsC.plan);
  if (xsC.best) {
    for (const p of xsC.best.parts) console.log(`   ${p.pct}% [中継 ${p.cand.pair.sym}] ${fullLabel(p.cand)} => ${formatAmount(p.finalOut, 18, 2)} QOM`);
    console.log("   単一ベスト比:", pctVs(xsC.best.totalOut, bestSingleC.finalOut).toFixed(2) + "%", "| パート金額の合計 == 全体額:", xsC.best.parts.reduce((s, p) => s + p.amountIn, 0n) === amtC);
  }
  const planC = xsC.plan;
  console.log("★ R2 パートを含む:", !!(planC && planC.parts.some((p) => isR2(p.cand))), "| 合計 >= 1,270B QOM:", !!(planC && planC.totalOut >= 1270n * 10n ** 27n));

  /* ================= ケースD (v6.4): 1,000 USDT -> qCAW (QL1) =================
     宛先が QOM 以外だと、v6.1 の splitAllocAllowed が中継 QOM の R1/R2 の
     組み合わせを禁止していた (ユーザーの実機スクショ: プラン 60/20/10/10 =
     550,960,984,867 qCAW, +28.67%, R2 パートなし)。v6.4 の合算モデルでは
     R2 系パートが入り、交換2 は合算額で1回だけ見積もられる。 */
  const toD = app.tokenById("ql1", "qcaw");
  console.log("\n=== ケースD (v6.4): 1,000 USDT (42 Chain) -> qCAW (QL1) ===");
  const candsD = await app.quoteCrossPlan("infinite", fromA, "ql1", toD, amtC);
  const enD = candsD.filter((c) => c.enabled);
  const bestSingleD = enD[0];
  console.log("単一ベスト:", fullLabel(bestSingleD), "=>", formatAmount(bestSingleD.finalOut, 18, 2), "qCAW");
  const xsD = await app.evaluateCrossSplit("infinite", "ql1", amtC, candsD);
  console.log("分割探索: 評価した配分数:", xsD.evaluated, "| 最良の分割:", xsD.best && formatAmount(xsD.best.totalOut, 18, 2), "qCAW | 微調整:", JSON.stringify(xsD.refineStats));
  console.log("分割プラン (勝ちとして出るか):", !!xsD.plan);
  if (xsD.best) {
    for (const p of xsD.best.parts) console.log(`   ${p.pct}% [中継 ${p.cand.pair.sym}] ${fullLabel(p.cand)} => ${formatAmount(p.finalOut, 18, 2)} qCAW`);
    console.log("   単一ベスト比:", pctVs(xsD.best.totalOut, bestSingleD.finalOut).toFixed(2) + "%", "| パート金額の合計 == 全体額:", xsD.best.parts.reduce((s, p) => s + p.amountIn, 0n) === amtC);
  }
  const FISH_A2 = app.tokenById("infinite", "fish").address.toLowerCase();
  const isR2D = (p) => p.cand.pair.sym === "QOM" && p.cand.leg1Path && p.cand.leg1Path.length === 3 && p.cand.leg1Path[1].toLowerCase() === FISH_A2;
  console.log("★ R2 系パート (中継QOM・leg1 USDT→FISH→QOM) を含む:", !!(xsD.plan && xsD.plan.parts.some(isR2D)),
    "| v6.1 実機ベースライン 550,960,984,867 qCAW との差:", xsD.best ? refDiff(xsD.best.totalOut, 550960984867.0) : "—");

  /* ================= calldata 照合 (ケースAの分割パート) ================= */
  console.log("\n--- calldata 照合: 分割パートの交換1 (パート金額で組む) ---");
  const planA = xsA.plan || xsA.best;
  const part = planA && planA.parts.find((p) => p.cand.leg1Path);
  if (part) {
    const account = "0x1111111111111111111111111111111111111111";
    const tSrc = part.cand.tSrc;
    const fresh = await app.requotePathExact(app.CHAINS.infinite, part.amountIn, part.cand.leg1Path);
    const route = { path: part.cand.leg1Path, amountOut: fresh, amountIn: part.amountIn, hops: part.cand.leg1Path.length - 1 };
    const tx = app.buildSwapTx(app.CHAINS.infinite, fromA, tSrc, route, account, 1);
    const dec = decodeSwap(tx.data);
    console.log("  パート:", part.pct + "%", "[中継 " + part.cand.pair.sym + "]", label("infinite", part.cand.leg1Path));
    console.log("  calldata の amountIn:", formatAmount(dec.amountIn, 18, 2), "USDT | パート金額と一致:", dec.amountIn === part.amountIn, "| 全体額 (100 USDT) ではない:", dec.amountIn !== amtA);
    console.log("  calldata のパス:", label("infinite", dec.path), "| 保存パスと一致:", samePath(dec.path, part.cand.leg1Path));
  } else console.log("  leg1 のあるパートが無いためスキップ");

  console.log("\nSPLITCROSS PROBE DONE");
  /* ---- v6.5: 手数料引き (net-of-fees) 判定 — ケースA/B/C/D ---- */
  console.log("\n=== v6.5 手数料引き判定 (evaluateCrossSplitNet) ===");
  const fmt = (v, tk) => app.formatAmount(v, tk.decimals, 4);
  const netCase = async (label, xs, dstTok, sym) => {
    if (!xs || !xs.plan) { console.log(label + ": plan なし (分割自体が負け) — net 判定なし"); return null; }
    const net = await app.evaluateCrossSplitNet("infinite", "ql1", dstTok, xs);
    console.log(label + ": 総勝ち +" + fmt(xs.plan.totalOut - xs.bestSingle.finalOut, dstTok) + " " + sym + " -> shown:", net && net.shown,
      "| convFailed:", net && net.convFailed,
      "| 追加代:", net && net.extraFeeNative != null ? fmt(net.extraFeeNative, app.tokenById("infinite", "native")) + " [42]" : "-",
      "| 宛先換算:", net && net.extraFeeDest != null ? fmt(net.extraFeeDest, dstTok) + " " + sym : "-",
      "| 手数料引き:", net && net.netGain != null ? fmt(net.netGain, dstTok) + " " + sym + " (" + (net.netPct >= 0 ? "+" : "") + net.netPct.toFixed(2) + "%)" : "-");
    return net;
  };
  await netCase("A 100 USDT->QOM", xsA, toA, "QOM");
  await netCase("B 10B QOM->QOM", xsB, toA, "QOM");
  await netCase("C 1000 USDT->QOM", xsC, toA, "QOM");
  await netCase("D 1000 USDT->qCAW", xsD, toD, "qCAW");
  console.log("期待 (v7.1): A 単一が最適 (plan なし or shown=false) / B shown=false or plan なし / C shown=true / D shown=true");

})().catch((e) => { console.error("PROBE FAILED:", e); process.exit(1); });
