"use strict";
/* SplitSwap 検証プローブ (送信はしません)。2026-11-25 の共有化で差し替え:
   旧版は「サイト内蔵バイトコードと contracts/ の一致」「デプロイ tx の
   復号」「デプロイのガス見積もり」を見ていたが、画面内デプロイは廃止され、
   共有コントラクトが両チェーンに固定された。現在は次を検証する:
   1) サイト内蔵の共有住所 (CHAINS.aggregator / effectiveAggregator) が
      期待どおり両チェーンとも同じ共有住所であること
   2) 実チェーン上の共有コントラクトのランタイムバイトコードが
      probe/splitswap_baseline.json の基準値と完全一致し、router() が
      各チェーンの DEX ルーターを返すこと (共有化の根拠の再確認)
   3) buildSplitTx の3バリアントのセレクタが contracts/SplitSwap.json の
      ABI (ethers) と一致し、宛先が共有住所になること
   実行: node probe/splitswap.cjs */
const fs = require("fs");
const path = require("path");
const assert = require("assert");
global.localStorage = { _s: {}, getItem(k) { return k in this._s ? this._s[k] : null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
global.window = undefined;
const app = require("../docs/app.js");
const { ethers } = require("/home/hatch/workspace/qom-staking/node_modules/ethers");
const artifact = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "contracts", "SplitSwap.json"), "utf8"));
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, "splitswap_baseline.json"), "utf8"));

const SHARED = "0x50ea429acb073525742bae5a038615c3cd8c3a7e";
const ROUTER_SEL = "0xf887ea40"; // router()

async function rpc(url, method, params) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await res.json();
  if (j.error) throw new Error(method + ": " + j.error.message);
  return j.result;
}

(async () => {
  console.log("=== SplitSwap 共有コントラクト検証 ===");
  for (const key of ["infinite", "ql1"]) {
    assert.strictEqual(app.CHAINS[key].aggregator, SHARED, key + ": CHAINS.aggregator is the shared address");
    assert.strictEqual(app.effectiveAggregator(app.CHAINS[key]), SHARED, key + ": effectiveAggregator resolves to the shared address");
    assert.strictEqual(app.aggregatorSource(app.CHAINS[key]), "builtin", key + ": source is builtin");
  }
  console.log("1) 内蔵解決: 両チェーンとも共有住所", SHARED, "に解決 — PASS");

  const baseKey = { infinite: "42", ql1: "ql1" };
  for (const key of ["infinite", "ql1"]) {
    const c = app.CHAINS[key];
    const exp = baseline.chains[baseKey[key]];
    const code = await rpc(c.rpcs[0], "eth_getCode", [SHARED, "latest"]);
    assert.ok(code && code !== "0x", key + ": code exists at the shared address");
    assert.strictEqual(code.toLowerCase(), exp.expectedRuntimeHex.toLowerCase(), key + ": runtime bytecode matches the baseline exactly");
    const keccak = ethers.keccak256(code);
    assert.strictEqual(keccak, exp.expectedRuntimeKeccak256, key + ": runtime keccak matches the baseline");
    const routerRes = await rpc(c.rpcs[0], "eth_call", [{ to: SHARED, data: ROUTER_SEL }, "latest"]);
    const gotRouter = "0x" + routerRes.slice(-40).toLowerCase();
    assert.strictEqual(gotRouter, c.router.toLowerCase(), key + ": router() matches the chain router");
    console.log("2)", key + ": 実チェーンの共有コントラクトが基準バイトコードと完全一致 (keccak " + keccak.slice(0, 18) + "…)、router() 一致 — PASS");
  }

  const iface = new ethers.Interface(artifact.abi);
  for (const fn of ["swapSplit", "swapSplitToNative", "swapSplitFromNative", "router"]) {
    console.log("   selector", fn, "=", iface.getFunction(fn).selector);
  }
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
    assert.strictEqual(tx.data.slice(0, 10), iface.getFunction(fn).selector, fn + ": selector matches the ABI");
    assert.strictEqual(tx.to, SHARED, fn + ": destination is the shared aggregator");
    console.log("3)", fn, ": セレクタ一致: true | ethers 復号 fn:", parsed.name, "| to == 共有アグリゲーター: true");
  }
  console.log("\nSPLIT-SWAP PROBE: ALL PASS");
})().catch((e) => { console.error("PROBE FAILED:", e); process.exit(1); });
