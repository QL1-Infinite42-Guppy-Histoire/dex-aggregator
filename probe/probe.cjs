"use strict";
/* Live probe: shipped docs/app.js の見積もりロジックをそのまま Node で実行する。
   - Infinite USDT->42 (10 / 1000 USDT)
   - QL1 qUSDT->QOM, WQOM->QSWAP
   - 直接ペア無しケース: Infinite CAT42->HAWK / QL1 BABY->KET
   - スワップ/approve の calldata 構築（送信はしない） */
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
  console.log(`成立ルート ${q.routes.length} 件 / 直接ルート: ${q.directOut == null ? "なし" : formatAmount(q.directOut, t.decimals, 6) + " " + t.symbol}`);
  for (const [i, r] of q.routes.slice(0, 6).entries()) {
    const vs = r.hops === 1 ? "直接" : q.directOut == null ? "直接なし" : "直接比 " + (((Number(r.amountOut - q.directOut) / Number(q.directOut)) * 100).toFixed(2)) + "%";
    console.log(`  ${i + 1}. ${label(c, r.path)}  => ${formatAmount(r.amountOut, t.decimals, 6)} ${t.symbol}  (${vs}, 交換${r.hops}回, 影響 ${r.priceImpactPct == null ? "—" : r.priceImpactPct.toFixed(2) + "%"})`);
  }
  if (q.splitEstimate) console.log(`  分割(参考): ${formatAmount(q.splitEstimate.out, t.decimals, 6)} ${t.symbol} (ベスト単一より多い。実行は不可)`);
  return { c, f, t, amountIn, q };
}

function decodeSwap(data) {
  // swapExactTokensForTokens / swapExactTokensForETH 共通レイアウトで検証
  const sel = data.slice(0, 10);
  const words = [];
  for (let i = 10; i + 64 <= data.length; i += 64) words.push(data.slice(i, i + 64));
  const vals = words.map((w) => BigInt("0x" + w));
  return { sel, vals, words };
}

(async () => {
  const a = await quote("infinite", "usdt", "native", "10");
  await quote("infinite", "usdt", "native", "1000");
  await quote("ql1", "qusdt", "native", "10");
  await quote("ql1", "wqom", "qswap", "100000000000");
  const nd1 = await quote("infinite", "baby", "hawk", "1000");
  console.log("直接なし検証(Infinite BABY->HAWK、FISH経由): directOut =", nd1.q.directOut, "/ 成立ルート =", nd1.q.routes.length);
  const nd2 = await quote("ql1", "baby", "ket", "10");
  console.log("直接なし検証(QL1 BABY->KET): directOut =", nd2.q.directOut, "/ 成立ルート =", nd2.q.routes.length);

  /* ---- calldata 構築シミュレーション（送信しない） ---- */
  console.log("\n=== calldata 構築（ブロードキャストなし） ===");
  const acct = "0x1111111111111111111111111111111111111111";
  // 1) token->native, multi-hop route を使う
  const multi = a.q.routes.find((r) => r.hops >= 2) || a.q.routes[0];
  const routeObj = { ...multi, amountIn: a.amountIn };
  const tx1 = app.buildSwapTx(a.c, a.f, a.t, routeObj, acct, 1, 1700000000);
  console.log("swap(to native): fn =", tx1.functionName, "to =", tx1.to, "value =", tx1.value.toString(), "minOut =", formatAmount(tx1.amountOutMin, a.t.decimals, 6), "deadline =", tx1.deadline);
  console.log("  path =", label(a.c, tx1.path));
  const d1 = decodeSwap(tx1.data);
  console.log("  selector =", d1.sel, "(swapExactTokensForETH = 0x18cbafe5)");
  const nPath = Number(d1.vals[5]);
  const pathFromData = d1.words.slice(6, 6 + nPath).map((w) => "0x" + w.slice(-40));
  console.log("  calldataから復号したpath =", label(a.c, pathFromData), "/ 一致:", JSON.stringify(pathFromData) === JSON.stringify(tx1.path.map((x) => x.toLowerCase())));
  // 2) native->token
  const rev = await quote("infinite", "native", "usdt", "100");
  const tx2 = app.buildSwapTx(rev.c, rev.f, rev.t, { ...rev.q.routes[0], amountIn: rev.amountIn }, acct, 0.5, 1700000000);
  console.log("swap(from native): fn =", tx2.functionName, "value =", formatAmount(tx2.value, 18, 6), "42 を payable で送る形 / selector =", tx2.data.slice(0, 10), "(swapExactETHForTokens = 0x7ff36ab5)");
  // 3) token->token (QL1)
  const tt = await quote("ql1", "qusdt", "qswap", "50");
  const tx3 = app.buildSwapTx(tt.c, tt.f, tt.t, { ...tt.q.routes[0], amountIn: tt.amountIn }, acct, 1, 1700000000);
  console.log("swap(token->token, QL1): fn =", tx3.functionName, "selector =", tx3.data.slice(0, 10), "(swapExactTokensForTokens = 0x38ed1739) path =", label(tt.c, tx3.path));
  // 4) approve
  const ap = app.buildApproveTx(tt.f.address, tt.c.router, tt.amountIn);
  console.log("approve: to =", ap.to, "data =", ap.data, "(selector 0x095ea7b3, spender=router, amount=amountIn)");
  console.log("\nPROBE DONE");
})().catch((e) => { console.error("PROBE FAILED:", e); process.exit(1); });
