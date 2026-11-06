"use strict";
/* Full-route probe v5 (送信はしません):
   - 1000 USDT (Infinite) -> QOM (QL1) の全体ルートを出荷コード quoteCrossPlan で列挙し、
     ユーザーの4例 + 単純な 42 経由ルートが実在するか、最終見積もりはいくつかを確認
   - 全中継トークン (QOM/BABY/CAW/FATHER/HAWK/KET/O/OSAK) の最良全体ルートを一覧
   - 非ベストルート (例2: USDT→FISH→QOM) を選んだ場合の swap1 calldata を復号し、
     パスがそのまま入っている (最良ルートへのすり替えが無い) ことを確認 */
global.localStorage = { _m: {}, getItem(k) { return this._m[k] || null; }, setItem(k, v) { this._m[k] = v; }, removeItem(k) { delete this._m[k]; } };
const app = require("../docs/app.js");
const { CHAINS, parseAmount, formatAmount } = app;

const NATIVE_PH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const USDT = "0xc2684966e5c95b2bc636fb4a1f3da9ad23d94753";
const FISH = "0x2c32120a12b754272d9e85c57f64b50ca2c43513";
const QOM_INF = "0x53465cbbba5b14f5dc00794330f0f4afb30eaa1d";
const CAW_INF = "0xce8aee7148daa8943453239c42b7b93f984a49f0";
const BABY_INF = "0x77479226c103cc3c142faff6691bc7f849ce9c92";

function label(chainKey, path) { return path ? path.map((a) => app.symbolFor(chainKey, a)).join(" → ") : "(なし)"; }
function fullLabel(r) {
  const l1 = r.leg1Path ? label("infinite", r.leg1Path) + "（42 Chain）" : r.tSrc.symbol + "（42 Chain・直接）";
  const l2 = r.leg2Path ? label("ql1", r.leg2Path) + "（QL1）" : r.tDst.symbol + "（QL1・そのまま）";
  return l1 + " ⇢ブリッジ⇢ " + l2;
}
function samePath(a, b) { return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x.toLowerCase() === b[i].toLowerCase()); }
function decodeSwapPath(data) {
  // swapExactTokensForTokens: params words = [amountIn, amountOutMin, pathOffset, to, deadline, pathLen, ...path]
  const paramsHex = data.slice(10); // after "0x" + 4-byte selector
  const word = (i) => paramsHex.slice(i * 64, i * 64 + 64);
  const off = Number(BigInt("0x" + word(2))); // byte offset of the path array, from params start
  const len = Number(BigInt("0x" + paramsHex.slice(off * 2, off * 2 + 64)));
  const out = [];
  for (let i = 0; i < len; i++) {
    const w = paramsHex.slice(off * 2 + 64 + i * 64, off * 2 + 64 + (i + 1) * 64);
    out.push("0x" + w.slice(24));
  }
  return out;
}

(async () => {
  const fromTok = app.tokenById("infinite", "usdt");
  const toTok = app.tokenById("ql1", "native"); // QOM (QL1)
  const amountIn = parseAmount("1000", fromTok.decimals);
  console.log("=== FULL ROUTES: 1000 USDT (42 Chain) -> QOM (QL1) ===");
  const cands = await app.quoteCrossPlan("infinite", fromTok, "ql1", toTok, amountIn);
  const routes = cands.filter((c) => c.enabled);
  const disabled = cands.filter((c) => !c.enabled);
  console.log("全体ルート数:", routes.length, "| 無効:", disabled.map((d) => d.pair.sym + "(" + (d.reason || "").slice(0, 20) + "…)").join(", "));
  console.log("降順ソート:", routes.every((r, i) => i === 0 || routes[i - 1].finalOut >= r.finalOut));
  console.log("ベンチマーク:", cands.benchmark && cands.benchmark.sym, cands.benchmark && cands.benchmark.kind, cands.benchmark && formatAmount(cands.benchmark.finalOut, 18, 2));
  for (const r of routes) {
    console.log(`  [中継 ${r.pair.sym}] ${fullLabel(r)}`);
    console.log(`      交換1 out: ${formatAmount(r.swap1Out, r.tSrc.decimals, 4)} ${r.tSrc.symbol} | 最終: ${formatAmount(r.finalOut, 18, 4)} QOM | 対基準: ${r.vsBenchPct != null ? r.vsBenchPct.toFixed(2) + "%" : "—"} | 影響1: ${r.swap1Route && r.swap1Route.priceImpactPct != null ? r.swap1Route.priceImpactPct.toFixed(2) + "%" : "—"} / 影響2: ${r.swap2Route && r.swap2Route.priceImpactPct != null ? r.swap2Route.priceImpactPct.toFixed(2) + "%" : "—"}`);
  }

  console.log("\n--- ユーザーの4例 + 単純ルートの照合 ---");
  const qomRoutes = routes.filter((r) => r.pair.sym === "QOM");
  const ex1 = qomRoutes.find((r) => samePath(r.leg1Path, [USDT, NATIVE_PH, FISH, QOM_INF]));
  const ex2 = qomRoutes.find((r) => samePath(r.leg1Path, [USDT, FISH, QOM_INF]));
  const simple42 = qomRoutes.find((r) => samePath(r.leg1Path, [USDT, NATIVE_PH, QOM_INF]));
  const parent = { ex1: 931938815018n, ex2: 846349806769n, s42: 164083781214n };
  const show = (name, r, ref) => {
    if (!r) { console.log(`  ${name}: 見つからない`); return null; }
    // ref: 親エージェントの実測した交換1出力 (QOM の個数単位, 18 decimals を割った値)
    const diff = ref ? (Number(r.swap1Out) / 1e18 / Number(ref)) * 100 - 100 : null;
    console.log(`  ${name}: あり | 交換1 out = ${formatAmount(r.swap1Out, 18, 2)} QOM | 最終 = ${formatAmount(r.finalOut, 18, 2)} QOM${diff != null ? " | 親実測との差: " + diff.toFixed(2) + "%" : ""}`);
    return r;
  };
  show("例1 USDT→42→FISH→QOM(Inf)⇢QOM(QL1)", ex1, parent.ex1);
  show("例2 USDT→FISH→QOM(Inf)⇢QOM(QL1)", ex2, parent.ex2);
  show("単純 USDT→42→QOM(Inf)⇢QOM(QL1)", simple42, parent.s42);
  const cawBest = routes.find((r) => r.pair.sym === "CAW");
  const cawEx = routes.find((r) => r.pair.sym === "CAW" && samePath(r.leg1Path, [USDT, NATIVE_PH, FISH, CAW_INF]));
  show("例3 USDT→42→FISH→CAW(Inf)⇢qCAW→QOM(QL1) 形状", cawEx, null);
  console.log("  CAW 最良全体ルート:", cawBest ? fullLabel(cawBest) + " | 最終 " + formatAmount(cawBest.finalOut, 18, 2) + " QOM" : "なし");
  const babyBest = routes.find((r) => r.pair.sym === "BABY");
  const babyEx = routes.find((r) => r.pair.sym === "BABY" && samePath(r.leg1Path, [USDT, NATIVE_PH, FISH, BABY_INF]));
  show("例4 USDT→42→FISH→BABY(Inf)⇢BABY(QL1)→QOM(QL1) 形状", babyEx, null);
  console.log("  BABY 最良全体ルート:", babyBest ? fullLabel(babyBest) + " | 最終 " + formatAmount(babyBest.finalOut, 18, 2) + " QOM" : "なし");

  console.log("\n--- 全中継カバー (最良全体ルート) ---");
  for (const p of app.BRIDGE_PAIRS) {
    const best = routes.find((r) => r.pair.sym === p.sym);
    const dis = disabled.find((d) => d.pair.sym === p.sym);
    if (best) console.log(`  ${p.sym}: ${fullLabel(best)} | 最終 ${formatAmount(best.finalOut, 18, 2)} QOM`);
    else if (dis) console.log(`  ${p.sym}: 無効 — ${dis.reason}`);
    else console.log(`  ${p.sym}: 成立する全体ルートなし (レッグの見積もりが全滅)`);
  }

  console.log("\n--- calldata 照合: 非ベストルート (例2) を選んだ場合の swap1 ---");
  if (ex2) {
    const account = "0x1111111111111111111111111111111111111111";
    const tInf = app.tokenById("infinite", "qom");
    const route = { path: ex2.leg1Path, amountOut: ex2.swap1Out, amountIn, hops: ex2.leg1Path.length - 1 };
    const tx = app.buildSwapTx(app.CHAINS.infinite, fromTok, tInf, route, account, 1);
    const decoded = decodeSwapPath(tx.data);
    console.log("  関数:", tx.functionName, "| selector:", tx.data.slice(0, 10));
    console.log("  復号パス:", label("infinite", decoded));
    console.log("  選んだパスと一致:", samePath(decoded, ex2.leg1Path), "| 最良ルート(例1)と別物:", !samePath(decoded, ex1 ? ex1.leg1Path : []));
    // stored-path re-quote must reproduce leg1 out for the same path
    const re = await app.requotePathExact(app.CHAINS.infinite, amountIn, ex2.leg1Path);
    console.log("  requotePathExact(例2パス):", re && formatAmount(re, 18, 2), "| 見積もりと一致:", re === ex2.swap1Out);
  } else {
    console.log("  例2ルートが無いため calldata 照合をスキップ");
  }
  console.log("\nFULLROUTES PROBE DONE");
})().catch((e) => { console.error("PROBE FAILED:", e); process.exit(1); });
