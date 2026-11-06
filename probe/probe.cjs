"use strict";
/* Live probe v2: shipped docs/app.js の見積もり/分割/テストネットを Node で実行する。
   - Infinite USDT->42 (10 / 1000 USDT): ルート比較 + 分割評価の実数
   - QL1 qUSDT->QOM, WQOM->QSWAP
   - 直接ペア無しケース: Infinite BABY->HAWK / QL1 BABY->KET
   - Testnet (421018001): TEST42->ARBA, ARBA->ARBB の実ルート見積もり
   - スワップ/approve/分割 の calldata 構築（送信はしない。分割は ethers で復号検証） */
global.localStorage = { _m: {}, getItem(k) { return this._m[k] || null; }, setItem(k, v) { this._m[k] = v; } };
const app = require("../docs/app.js");
const { CHAINS, parseAmount, formatAmount } = app;

function label(chainObj, path) { return path.map((a) => app.symbolFor(chainObj.key, a)).join(" -> "); }
async function quote(chainKey, fromId, toId, amountText) {
  const c = CHAINS[chainKey];
  const f = app.tokenById(chainKey, fromId), t = app.tokenById(chainKey, toId);
  const amountIn = parseAmount(amountText, f.decimals);
  const q = await app.fetchQuotesForTokens(c, f, t, amountIn);
  console.log(`\n=== ${c.label}: ${f.symbol} -> ${t.symbol} (${amountText} ${f.symbol}) ===`);
  console.log(`成立ルート ${q.routes.length} 件 / 直接ルート: ${q.directOut == null ? "なし" : formatAmount(q.directOut, t.decimals, 6) + " " + t.symbol} / gasPrice: ${q.gasPrice ? q.gasPrice.toString() : "—"}`);
  for (const [i, r] of q.routes.slice(0, 5).entries()) {
    const vs = r.hops === 1 ? "直接" : q.directOut == null ? "直接なし" : "直接比 " + (((Number(r.amountOut - q.directOut) / Number(q.directOut)) * 100).toFixed(2)) + "%";
    console.log(`  ${i + 1}. ${label(c, r.path)}  => ${formatAmount(r.amountOut, t.decimals, 6)} ${t.symbol}  (${vs}, 交換${r.hops}回, 影響 ${r.priceImpactPct == null ? "—" : r.priceImpactPct.toFixed(2) + "%"}, ガス目安 ${app.estimateGasUnitsSingle(r)})`);
  }
  const se = q.splitEval;
  if (se && se.best) {
    console.log(`  分割評価: ${se.evaluated} 候補を評価 / 最良の分割 = ${formatAmount(se.best.totalOut, t.decimals, 6)} ${t.symbol} [${se.best.legs.map((l) => l.pct + "% " + label(c, l.route.path)).join(" + ")}]`);
    console.log(`  単一ベスト = ${formatAmount(q.routes[0].amountOut, t.decimals, 6)} ${t.symbol} → 分割プラン ${se.plan ? "採用（単一より多い）" : "不採用（単一の勝ち）"}`);
  } else console.log("  分割評価: 候補なし");
  return { c, f, t, amountIn, q };
}

function decodeSwapWords(data) {
  const sel = data.slice(0, 10);
  const words = [];
  for (let i = 10; i + 64 <= data.length; i += 64) words.push(data.slice(i, i + 64));
  return { sel, words, vals: words.map((w) => BigInt("0x" + w)) };
}

(async () => {
  const a = await quote("infinite", "usdt", "native", "10");
  const big = await quote("infinite", "usdt", "native", "1000");
  await quote("ql1", "qusdt", "native", "10");
  await quote("ql1", "wqom", "qswap", "100000000000");
  const nd1 = await quote("infinite", "baby", "hawk", "1000");
  console.log("直接なし検証(Infinite BABY->HAWK): directOut =", nd1.q.directOut, "/ 成立ルート =", nd1.q.routes.length);
  const nd2 = await quote("ql1", "baby", "ket", "10");
  console.log("直接なし検証(QL1 BABY->KET): directOut =", nd2.q.directOut, "/ 成立ルート =", nd2.q.routes.length);

  /* ---- テストネット ---- */
  console.log("\n######## 42 Testnet (421018001) ########");
  console.log("router:", CHAINS.testnet.router, "| factory:", CHAINS.testnet.factory, "| aggregator:", JSON.stringify(CHAINS.testnet.aggregator), "| tokens:", CHAINS.testnet.tokens.map((x) => x.symbol).join(","));
  const tn1 = await quote("testnet", "native", "arba", "100");
  await quote("testnet", "arba", "arbb", "1000");
  await quote("testnet", "fox", "arbb", "10000");

  /* ---- calldata 構築シミュレーション（送信しない） ---- */
  console.log("\n=== calldata 構築（ブロードキャストなし） ===");
  const acct = "0x1111111111111111111111111111111111111111";
  const multi = a.q.routes.find((r) => r.hops >= 2) || a.q.routes[0];
  const tx1 = app.buildSwapTx(a.c, a.f, a.t, { ...multi, amountIn: a.amountIn }, acct, 1, 1700000000);
  console.log("swap(to native): fn =", tx1.functionName, "selector =", tx1.data.slice(0, 10), "(0x18cbafe5) path =", label(a.c, tx1.path));
  const rev = await quote("infinite", "native", "usdt", "100");
  const tx2 = app.buildSwapTx(rev.c, rev.f, rev.t, { ...rev.q.routes[0], amountIn: rev.amountIn }, acct, 0.5, 1700000000);
  console.log("swap(from native): fn =", tx2.functionName, "value =", formatAmount(tx2.value, 18, 6), "selector =", tx2.data.slice(0, 10), "(0x7ff36ab5)");
  const ap = app.buildApproveTx(a.f.address, a.c.router, a.amountIn);
  console.log("approve: to =", ap.to, "selector =", ap.data.slice(0, 10), "(0x095ea7b3)");

  /* ---- 分割 calldata: エンコード → ethers で復号して往復検証 ---- */
  console.log("\n=== SplitSwap calldata 往復検証 (ethers で復号) ===");
  const { ethers } = require("/home/hatch/workspace/qom-staking/node_modules/ethers");
  const artifact = require("../contracts/SplitSwap.json");
  const iface = new ethers.Interface(artifact.abi);
  const fakeChain = { ...CHAINS.testnet, aggregator: "0x2222222222222222222222222222222222222222" };
  const src = big.q.routes.length >= 2 ? big : tn1;
  const plan = {
    legs: [
      { route: src.q.routes[0], pct: 60, amountIn: (src.amountIn * 60n) / 100n, amountOut: 0n },
      { route: src.q.routes[1], pct: 40, amountIn: src.amountIn - (src.amountIn * 60n) / 100n, amountOut: 0n },
    ],
    totalOut: src.q.routes[0].amountOut,
  };
  const fTok = src.f.isNative ? app.tokenById("infinite", "usdt") : src.f;
  const chainForSplit = src.c.key === "testnet" ? { ...CHAINS.infinite, aggregator: fakeChain.aggregator } : fakeChain;
  // token->token で検証 (Infinite USDT -> FISH を題材に、ルートは実在のものを使う)
  const tt = await quote("infinite", "usdt", "fish", "500");
  const planTT = {
    legs: [
      { route: tt.q.routes[0], pct: 60, amountIn: (tt.amountIn * 60n) / 100n, amountOut: 0n },
      { route: tt.q.routes[1], pct: 40, amountIn: tt.amountIn - (tt.amountIn * 60n) / 100n, amountOut: 0n },
    ],
    totalOut: tt.q.routes[0].amountOut,
  };
  const stx = app.buildSplitTx(chainForSplit, tt.f, tt.t, planTT, acct, 1, 1700000000);
  console.log("split fn =", stx.functionName, "to =", stx.to, "minOut =", formatAmount(stx.amountOutMin, tt.t.decimals, 6), tt.t.symbol);
  const parsed = iface.parseTransaction({ data: stx.data, value: stx.value });
  console.log("復号: fn =", parsed.name, "| tokenIn =", parsed.args[0], "| legs =", parsed.args[1].length,
    "| leg amounts =", parsed.args[1].map((l) => l[0].toString()).join(","), "| paths =", parsed.args[1].map((l) => "[" + l[1].join(",") + "]").join(" "),
    "| min =", parsed.args[2].toString(), "| tokenOut =", parsed.args[3], "| to =", parsed.args[4], "| deadline =", parsed.args[5].toString());
  const legsOk = parsed.args[1].every((l, i) => l[0] === planTT.legs[i].amountIn && l[1].map((x) => x.toLowerCase()).join() === planTT.legs[i].route.path.join());
  console.log("legs 往復一致:", legsOk, "| 合計in 一致:", parsed.args[1].reduce((s, l) => s + l[0], 0n) === tt.amountIn);
  // native->token variant
  const planNT = { legs: [{ route: rev.q.routes[0], pct: 100, amountIn: rev.amountIn, amountOut: 0n }], totalOut: rev.q.routes[0].amountOut };
  const ntx = app.buildSplitTx(chainForSplit, rev.f, rev.t, planNT, acct, 1, 1700000000);
  const parsedN = iface.parseTransaction({ data: ntx.data, value: ntx.value });
  console.log("fromNative 復号: fn =", parsedN.name, "| value =", ntx.value.toString(), "| legs =", parsedN.args[0].length, "| min =", parsedN.args[1].toString());
  console.log("\nPROBE DONE");
})().catch((e) => { console.error("PROBE FAILED:", e); process.exit(1); });
