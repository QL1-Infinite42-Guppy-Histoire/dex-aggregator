"use strict";
/* v7 検証プローブ (送信はしません):
   1) サイト内蔵バイトコード (app.js の SPLIT_BYTECODE) と contracts/SplitSwap.json の一致
   2) buildSplitTx の3バリアントのセレクタが、再コンパイル済み ABI (ethers) と一致
   3) buildDeployTx の復号 (末尾 = コンストラクタ引数 = 各チェーンのルーター)
   4) 各チェーン RPC への eth_estimateGas 試行 (情報提供のみ: 資金なし住所からの
      見積もりは「残高不足」で失敗しうるが、tx 形状が受理された証跡として記録する)
   実行: node probe/splitswap.cjs */
const fs = require("fs");
const path = require("path");
global.localStorage = { _s: {}, getItem(k) { return k in this._s ? this._s[k] : null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
global.window = undefined;
const app = require("../docs/app.js");
const { ethers } = require("/home/hatch/workspace/qom-staking/node_modules/ethers");
const artifact = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "contracts", "SplitSwap.json"), "utf8"));

(async () => {
  console.log("=== v7 SplitSwap 検証 ===");
  console.log("1) バイトコード一致 (app.js 内蔵 == contracts/SplitSwap.json):", app.SPLIT_BYTECODE === artifact.bytecode, "| bytes:", (artifact.bytecode.length - 2) / 2);
  const iface = new ethers.Interface(artifact.abi);
  for (const fn of ["swapSplit", "swapSplitToNative", "swapSplitFromNative", "router"]) {
    console.log("   selector", fn, "=", iface.getFunction(fn).selector);
  }
  app.setStoredAggregator("infinite", "0x3333333333333333333333333333333333333333");
  const acct = "0x1111111111111111111111111111111111111111";
  const usdt = app.tokenById("infinite", "usdt"), fish = app.tokenById("infinite", "fish"), nat = app.tokenById("infinite", "native");
  const plan = { legs: [{ route: { path: [usdt.address, fish.address], hops: 1 }, pct: 100, amountIn: 100n * 10n ** 6n, amountOut: 900n * 10n ** 18n }], totalOut: 900n * 10n ** 18n };
  const planFN = { legs: [{ route: { path: [nat.address, fish.address], hops: 1 }, pct: 100, amountIn: 10n ** 18n, amountOut: 900n * 10n ** 18n }], totalOut: 900n * 10n ** 18n };
  const cases = [
    ["swapSplit", app.buildSplitTx(app.CHAINS.infinite, usdt, fish, plan, acct, 1, 1700000000)],
    ["swapSplitToNative", app.buildSplitTx(app.CHAINS.infinite, usdt, nat, plan, acct, 1, 1700000000)],
    ["swapSplitFromNative", app.buildSplitTx(app.CHAINS.infinite, nat, fish, planFN, acct, 1, 1700000000)],
  ];
  for (const [fn, tx] of cases) {
    const parsed = iface.parseTransaction({ data: tx.data, value: tx.value });
    console.log("2)", fn, ": セレクタ一致:", tx.data.slice(0, 10) === iface.getFunction(fn).selector, "| ethers 復号 fn:", parsed.name,
      "| leg0:", parsed.args[fn === "swapSplitFromNative" ? 0 : 1][0].amountIn.toString(), "in /", parsed.args[fn === "swapSplitFromNative" ? 0 : 1][0].amountOutMin.toString(), "minOut / path len", parsed.args[fn === "swapSplitFromNative" ? 0 : 1][0].path.length,
      "| to == 保存済みアグリゲーター:", tx.to === "0x3333333333333333333333333333333333333333");
  }
  console.log("3) デプロイ tx:");
  for (const key of ["infinite", "ql1", "testnet"]) {
    const c = app.CHAINS[key];
    const dtx = app.buildDeployTx(c);
    console.log("  ", key, ": to:", dtx.to, "| 末尾32B == ルーター:", ("0x" + dtx.data.slice(-40)) === c.router.toLowerCase(), "| data bytes:", (dtx.data.length - 2) / 2);
    try {
      const res = await fetch(c.rpcs[0], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_estimateGas", params: [{ from: acct, data: dtx.data }] }) });
      const j = await res.json();
      console.log("    eth_estimateGas:", j.result ? parseInt(j.result, 16).toLocaleString() + " gas" : "error: " + (j.error && j.error.message));
    } catch (e) { console.log("    eth_estimateGas: fetch failed:", e.message); }
  }
  console.log("\nSPLIT-SWAP PROBE DONE");
})().catch((e) => { console.error("PROBE FAILED:", e); process.exit(1); });
