"use strict";
/* 監査 2026-11-24 第2弾 (ユーザー承認「オススメで」) の回帰プローブ。
   実送信はしません (ウォレットはスタブ、見積もりは getAmountsOut を
   スタブして決定的にし、それ以外の RPC は実チェーンへ流します):
   - A (#10) 同一チェーン送信直前ガード: 単一/分割とも、新しい見込みが
     表示した最低量を割ると送信せず見積もりを取り直して理由を表示する。
     問題なければ表示見積もり基準の minOut のまま送信される。
   - B (#9) SplitSwap 未監査警告がデプロイ領域に出る。
   - C (#11) verifyStoredAggregator: コード無し/router() 不一致/RPC
     失敗はすべて false (fail-closed)、一致すれば true。分割実行も
     再検証に失敗すると送信前に止まる。
   - D (#12) 旧保存フローは初回再開時に接続アカウントへ紐付き、別
     アカウントでは単一/分割の送信ステップが止まる。
   - E (#8) クロス step1: 再見積もりをステップ内に表示し、開始時の
     最低量を割る場合はそのクリックでは送らず再押下を促す (単一/分割)。 */
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const ACCT_A = "0x1111111111111111111111111111111111111111";
const ACCT_B = "0x2222222222222222222222222222222222222222";
const FAKE_AGG = "0x3333333333333333333333333333333333333333";
const FAKE_HASH = "0x" + "ab".repeat(32);
const E18 = 10n ** 18n;

/* ---------- controllable stubs ---------- */
let freshOut = 1000n * E18;         // getAmountsOut の末尾 (見込み) を差す
let aggCode = "0x60006000";         // FAKE_AGG の eth_getCode
let aggRouterRet = null;            // FAKE_AGG の router() 応答 (住所)
let aggRpcFail = false;             // FAKE_AGG 宛の確認を全部失敗させる
const sentTxs = [];
const ethListeners = {};

const realFetch = global.fetch;
const word = (v) => BigInt(v).toString(16).padStart(64, "0");
const amountsResult = (v) => "0x" + word(32) + word(2) + word(0) + word(v);
function stubDecision(call) {
  if (!call) return { handled: false };
  const params = call.params || [];
  if (call.method === "eth_getCode") {
    if (String(params[0] || "").toLowerCase() === FAKE_AGG) {
      return aggRpcFail ? { handled: true, error: { code: -32000, message: "stub rpc fail" } } : { handled: true, result: aggCode };
    }
    return { handled: false };
  }
  if (call.method !== "eth_call") return { handled: false };
  const p = params[0] || {};
  const to = String(p.to || "").toLowerCase();
  const data = String(p.data || "");
  if (data.startsWith("0xd06ca61f")) return { handled: true, result: amountsResult(freshOut) };
  if (to === FAKE_AGG && data.startsWith("0xf887ea40")) {
    return aggRpcFail ? { handled: true, error: { code: -32000, message: "stub rpc fail" } } : { handled: true, result: "0x" + word(aggRouterRet || 0) };
  }
  return { handled: false };
}
global.fetch = async (url, opts) => {
  let body = null;
  try { body = JSON.parse((opts && opts.body) || "null"); } catch (e) { body = null; }
  if (!body) return realFetch(url, opts);
  const isArr = Array.isArray(body);
  const calls = isArr ? body : [body];
  const decisions = calls.map(stubDecision);
  if (!decisions.some((d) => d.handled)) return realFetch(url, opts);
  const fwdIdx = calls.map((c, i) => i).filter((i) => !decisions[i].handled);
  const fwdResults = {};
  if (fwdIdx.length) {
    const fwdBody = isArr ? fwdIdx.map((i) => calls[i]) : calls[fwdIdx[0]];
    const res = await realFetch(url, { ...opts, body: JSON.stringify(fwdBody) });
    const j = await res.json();
    for (const r of (Array.isArray(j) ? j : [j])) fwdResults[r.id] = r;
  }
  const merged = calls.map((c, i) => {
    if (decisions[i].handled) {
      return decisions[i].error
        ? { jsonrpc: "2.0", id: c.id, error: decisions[i].error }
        : { jsonrpc: "2.0", id: c.id, result: decisions[i].result };
    }
    return fwdResults[c.id] || { jsonrpc: "2.0", id: c.id, error: { code: -32000, message: "stub merge miss" } };
  });
  return new Response(JSON.stringify(isArr ? merged : merged[0]), { status: 200, headers: { "Content-Type": "application/json" } });
};

const stubEth = {
  request: async (req) => {
    const method = req && req.method;
    if (method === "eth_chainId") return "0x" + (421018).toString(16);
    if (method === "eth_sendTransaction") { sentTxs.push(req.params[0]); return FAKE_HASH; }
    if (method === "eth_getTransactionReceipt") return { status: "0x1", contractAddress: null };
    if (method === "eth_requestAccounts") return [ACCT_A];
    throw new Error("stubEth: unexpected method " + method);
  },
  on: (ev, fn) => { ethListeners[ev] = fn; },
};

/* ---------- DOM stub loader (feefail.cjs と同じ方式 + ethereum) ---------- */
const IDS = ["chainInf", "chainQl1", "chainNote", "connectBtn", "connectBtnMain", "fromTokenBadge", "toTokenBadge", "xFromTokenBadge", "xToTokenBadge", "accountLine", "status", "fromToken", "toToken", "fromBalance", "toBalance", "amountIn", "flipBtn", "quoteBtn", "planArea", "routeList", "splitNote", "rateLine", "rateInvertBtn", "gasLine", "receiveOut", "minLine", "swapBtn", "txResult", "slipCustom", "caInput", "caAddBtn", "caMsg", "modeSame", "modeCross", "modeNote", "swapPanel", "caPanel", "crossPanel", "xSrcInf", "xSrcQl1", "xDstLabel", "xFromToken", "xToToken", "xFromBalance", "xAmount", "xQuoteBtn", "xStatus", "xCandidates", "xFlow", "xAbandon", "arbPanel", "arbAmount", "arbScanBtn", "arbStatus", "arbBoard", "langSel", "aggArea", "themeToggle"];
function loadPage(lang, presetStore) {
  function makeEl(id) {
    return {
      id, value: "", innerHTML: "", textContent: "", disabled: false, style: {},
      dataset: {}, _handlers: {},
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else f ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      addEventListener(ev, fn) { (this._handlers[ev] = this._handlers[ev] || []).push(fn); },
      setAttribute() {}, getAttribute() { return null; },
      querySelectorAll() { return []; },
    };
  }
  const els = {};
  for (const id of IDS) els[id] = makeEl(id);
  const body = makeEl("body");
  const store = Object.assign({}, presetStore || {});
  const sandbox = {
    console, setTimeout, setInterval, clearInterval, BigInt, JSON, Math, Number, String, Array, Object, Map, Set, Promise, RegExp, Error, TextDecoder, URLSearchParams,
    fetch: (...a) => fetch(...a),
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    document: {
      documentElement: { lang }, body,
      getElementById: (id) => els[id] || null,
      querySelectorAll: (sel) => (sel === "button, input, select, textarea" ? Object.values(els) : []),
      addEventListener: () => {},
    },
    window: { ethereum: stubEth },
    module: { exports: {} },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(__dirname + "/../docs/app.js", "utf8"), sandbox, { filename: "app.js" });
  return { app: sandbox.module.exports, els, store };
}

function baseFlowSingle(extra) {
  return Object.assign({
    v: 1, pathsV5: true, step: 2,
    srcKey: "infinite", dstKey: "ql1", fromId: "usdt", toId: "native",
    amountText: "10", amountIn: (10n * E18).toString(),
    sym: "QOM", tSrcId: "qom", tDstId: "wqom",
    leg1Wrap: false, wrapTx: null,
    swap1Path: null, swap1Out: (1000n * E18).toString(),
    swap2Path: null, swap2Out: (1000n * E18).toString(),
    bridgeOut: (1000n * E18).toString(), finalEst: (1000n * E18).toString(), nativeFee: "0",
    baselineT: "0", baselineDst: null, swap1Tx: null, bridgeTx: null, swap2Tx: null, messageId: null, bridgeAt: null, arrived: null,
    arbReturn: false, createdAt: Date.now(),
  }, extra || {});
}
function baseFlowSplit(extra) {
  return Object.assign({
    v: 2, kind: "split",
    srcKey: "infinite", dstKey: "ql1", fromId: "usdt", toId: "native",
    amountText: "10", amountIn: (10n * E18).toString(),
    totalEst: (2000n * E18).toString(), baselineDstBySym: {},
    parts: [{
      idx: 0, pct: 100, sym: "QOM", tSrcId: "qom", tDstId: "wqom",
      amountIn: (10n * E18).toString(),
      leg1Path: null, leg1Wrap: false, wrapTx: null,
      leg2Path: null, estLeg1Out: (1000n * E18).toString(), estFinalOut: (1000n * E18).toString(),
      nativeFee: "0", step: 0, received: null,
      baselineT: null, swap1Tx: null, bridgeTx: null, bridgeAt: null, messageId: null,
      bridgedAmount: null, arrivedAmt: null, arrivedFlag: false, swap2Tx: null,
      error: null, errorPhase: null,
    }],
    createdAt: Date.now(),
  }, extra || {});
}

(async () => {
  const probeApp = require("../docs/app.js");
  const USDT = probeApp.tokenById("infinite", "usdt").address;
  const FISH = probeApp.tokenById("infinite", "fish").address;
  const QOM42 = probeApp.tokenById("infinite", "qom").address;
  const NATIVE_PH = probeApp.tokenById("infinite", "native").address;
  const ROUTER = probeApp.CHAINS.infinite.router.toLowerCase();

  /* ================= A: 同一チェーン単一 ================= */
  console.log("=== A1/A2: same-chain single requote guard ===");
  {
    const { app, els } = loadPage("en");
    const setup = () => {
      app.state.account = ACCT_A;
      app.state.chainKey = "infinite";
      els.fromToken.value = "usdt"; els.toToken.value = "native"; els.amountIn.value = "10";
      app.state.lastQuote = { fromId: "usdt", toId: "native", amountIn: 10n * E18, amountText: "10" };
      app.state.routes = [{ path: [USDT, NATIVE_PH], amountOut: 1000n * E18, amountIn: 10n * E18, hops: 1 }];
      app.state.selectedIdx = 0; app.state.selectedPlan = { type: "single", idx: 0 };
    };
    setup();
    freshOut = 900n * E18; // 表示 min = 990 を割る
    sentTxs.length = 0;
    await app.onSwap();
    assert.strictEqual(sentTxs.length, 0, "A1: below-minimum requote must not send");
    assert.ok(els.status.textContent.includes("below the minimum"), "A1: quote-changed message shown, got: " + els.status.textContent);
    console.log("  A1 PASS: fresh 900 < displayed min 990 -> aborted, quote refreshed, message shown");

    setup();
    freshOut = 1000n * E18; // min 以上
    sentTxs.length = 0;
    await app.onSwap();
    const swapSend = sentTxs.find((tx) => (tx.to || "").toLowerCase() === ROUTER);
    assert.ok(swapSend, "A2: fine requote proceeds to send the swap");
    const minWord = BigInt("0x" + swapSend.data.slice(10 + 64, 10 + 128));
    assert.strictEqual(minWord, 990n * E18, "A2: signed minOut stays anchored to the DISPLAYED quote (990)");
    console.log("  A2 PASS: fresh 1000 >= min -> sent; calldata minOut = 990 (displayed quote - slippage)");
  }

  /* ================= A-split + C ================= */
  console.log("=== A3/C: same-chain split guard + stored aggregator re-verification ===");
  {
    const preset = { dexagg_aggregator_v1: JSON.stringify({ infinite: FAKE_AGG }) };
    const { app, els } = loadPage("en", preset);
    const setupSplit = () => {
      app.state.account = ACCT_A;
      app.state.chainKey = "infinite";
      els.fromToken.value = "usdt"; els.toToken.value = "native"; els.amountIn.value = "10";
      app.state.lastQuote = { fromId: "usdt", toId: "native", amountIn: 10n * E18, amountText: "10" };
      app.state.splitEval = { plan: { totalOut: 2000n * E18, legs: [
        { amountIn: 5n * E18, amountOut: 1000n * E18, pct: 50, route: { path: [USDT, NATIVE_PH], hops: 1 } },
        { amountIn: 5n * E18, amountOut: 1000n * E18, pct: 50, route: { path: [USDT, FISH, NATIVE_PH], hops: 2 } },
      ] }, best: null };
      app.state.selectedPlan = { type: "split" };
    };

    // C unit-level: three failure modes + success
    aggRpcFail = false; aggCode = "0x"; aggRouterRet = ROUTER;
    assert.strictEqual(await app.verifyStoredAggregator(app.CHAINS.infinite), false, "C1: no code -> false");
    aggCode = "0x60006000"; aggRouterRet = USDT;
    assert.strictEqual(await app.verifyStoredAggregator(app.CHAINS.infinite), false, "C2: router mismatch -> false");
    aggRpcFail = true;
    assert.strictEqual(await app.verifyStoredAggregator(app.CHAINS.infinite), false, "C3: RPC failure -> false (fail closed)");
    aggRpcFail = false; aggRouterRet = ROUTER;
    assert.strictEqual(await app.verifyStoredAggregator(app.CHAINS.infinite), true, "C4: code + matching router -> true");
    console.log("  C1-C4 PASS: verifyStoredAggregator fails closed on no-code / mismatch / RPC error, passes on match");

    // A-split abort (guard fires before C, which would pass here)
    setupSplit();
    freshOut = 900n * E18; // 合計 1800 < min 1980
    sentTxs.length = 0;
    await app.onSwap();
    assert.strictEqual(sentTxs.length, 0, "A3: below-minimum split requote must not send");
    assert.ok(els.status.textContent.includes("below the minimum"), "A3: message shown, got: " + els.status.textContent);
    console.log("  A3 PASS: split fresh total 1800 < displayed min 1980 -> aborted + refreshed");

    // C at execution: guard passes (fresh fine) but router() mismatches -> stopped before any send
    setupSplit();
    freshOut = 1000n * E18;
    aggCode = "0x60006000"; aggRouterRet = USDT; aggRpcFail = false;
    sentTxs.length = 0;
    await app.onSwap();
    assert.strictEqual(sentTxs.length, 0, "C5: split execution must stop when re-verification fails");
    assert.ok(els.status.textContent.includes("re-verified"), "C5: clear error shown, got: " + els.status.textContent);
    console.log("  C5 PASS: split execution blocked by failed aggregator re-verification (no sends)");

    // C passes -> split executes to the stored address
    setupSplit();
    aggRouterRet = ROUTER;
    sentTxs.length = 0;
    await app.onSwap();
    const splitSend = sentTxs.find((tx) => (tx.to || "").toLowerCase() === FAKE_AGG);
    assert.ok(splitSend, "C6/A4: verified stored aggregator receives the split send");
    console.log("  C6/A4 PASS: guard fine + re-verification ok -> split sent to the stored aggregator");
  }

  /* ================= B: 未監査警告 ================= */
  console.log("=== B: SplitSwap unaudited warning ===");
  {
    const { app, els } = loadPage("en");
    app.renderAggArea();
    assert.ok(els.aggArea.innerHTML.includes("unaudited"), "B1: deploy area shows the unaudited warning");
    const src = fs.readFileSync(__dirname + "/../docs/app.js", "utf8");
    assert.ok((src.match(/t\("splitUnaudited"\)/g) || []).length >= 2, "B2: warning also referenced at split execution (splitNote)");
    console.log("  B1/B2 PASS: warning in the deploy area and appended at split selection");
  }

  /* ================= D: アカウント紐付け ================= */
  console.log("=== D: flow account binding ===");
  {
    const { app, els, store } = loadPage("en");
    app.state.account = ACCT_A;
    app.state.xflow = baseFlowSingle(); // account 欄なし = 旧保存フロー
    app.renderXFlow();
    assert.strictEqual(app.state.xflow.account, ACCT_A, "D1: legacy flow binds the connected account on first resume");
    assert.ok((store.dexagg_xflow_v1 || "").includes(ACCT_A), "D1: binding is persisted");
    console.log("  D1 PASS: legacy flow bound to the connected account and saved");

    app.state.account = ACCT_B;
    app.renderXFlow();
    assert.ok(els.xFlow.innerHTML.includes("different wallet"), "D2: mismatch warning rendered in the flow");
    sentTxs.length = 0;
    await app.doXStep2();
    assert.strictEqual(sentTxs.length, 0, "D2: send step blocked under a different account");
    assert.ok(els.xStatus.textContent.includes("different wallet"), "D2: block message shown, got: " + els.xStatus.textContent);
    assert.strictEqual(app.state.xflow.bridgeTx, null, "D2: no bridge tx recorded");
    console.log("  D2 PASS: different account -> warning shown, step 2 blocked, nothing sent");

    const p2 = loadPage("en");
    p2.app.state.account = ACCT_B;
    p2.app.state.xflow = baseFlowSplit({ account: ACCT_A });
    p2.app.state.xflow.parts[0].leg1Path = [USDT, QOM42];
    sentTxs.length = 0;
    await p2.app.doXSplitStep1(0);
    assert.strictEqual(sentTxs.length, 0, "D3: split step blocked under a different account");
    assert.ok(p2.els.xStatus.textContent.includes("different wallet"), "D3: block message shown");
    console.log("  D3 PASS: split step 1 blocked under a different account");
    assert.strictEqual(typeof ethListeners.accountsChanged, "function", "D4: accountsChanged subscription registered");
    console.log("  D4 PASS: accountsChanged listener registered at init");
  }

  /* ================= E: クロス step1 の署名前表示 + 中止 ================= */
  console.log("=== E: cross step-1 requote display + abort ===");
  {
    const { app, els } = loadPage("en");
    app.state.account = ACCT_A;
    app.state.xflow = baseFlowSingle({ step: 1, account: ACCT_A, swap1Path: [USDT, QOM42] });
    freshOut = 900n * E18; // 開始時 min = 990 を割る
    sentTxs.length = 0;
    await app.doXStep1();
    assert.strictEqual(sentTxs.length, 0, "E1: below-minimum step-1 requote must not send");
    assert.strictEqual(app.state.xflow.step, 1, "E1: flow stays on step 1");
    assert.ok(app.state.xflow.step1Fresh && app.state.xflow.step1Fresh.out === (900n * E18).toString(), "E1: fresh figures stored for display");
    assert.ok(els.xFlow.innerHTML.includes("900"), "E1: fresh expected amount displayed in the step UI");
    assert.ok(els.xStatus.textContent.includes("press the button again"), "E1: review-and-press-again message, got: " + els.xStatus.textContent);
    console.log("  E1 PASS: step-1 fresh 900 < stored min 990 -> not sent, figures shown in step, re-press requested");

    freshOut = 1000n * E18;
    sentTxs.length = 0;
    await app.doXStep1();
    assert.ok(sentTxs.some((tx) => (tx.to || "").toLowerCase() === ROUTER), "E2: fine requote proceeds to sign the swap");
    assert.strictEqual(app.state.xflow.step, 2, "E2: flow advanced to step 2");
    console.log("  E2 PASS: step-1 fresh 1000 >= min -> signed with requoted values, flow advanced");

    const p3 = loadPage("en");
    p3.app.state.account = ACCT_A;
    p3.app.state.xflow = baseFlowSplit({ account: ACCT_A });
    p3.app.state.xflow.parts[0].leg1Path = [USDT, QOM42];
    freshOut = 900n * E18;
    sentTxs.length = 0;
    await p3.app.doXSplitStep1(0);
    const part = p3.app.state.xflow.parts[0];
    assert.strictEqual(sentTxs.length, 0, "E3: split part below-minimum requote must not send");
    assert.strictEqual(part.step, 0, "E3: part stays on phase 1");
    assert.ok(part.step1Fresh && part.step1Fresh.out === (900n * E18).toString(), "E3: fresh figures stored on the part");
    assert.ok(p3.els.xFlow.innerHTML.includes("xStep1Quote-0") && p3.els.xFlow.innerHTML.includes("900"), "E3: figures displayed in the part UI");
    assert.ok(p3.els.xStatus.textContent.includes("press the button again"), "E3: re-press message shown");
    console.log("  E3 PASS: split step-1 fresh 900 < stored min 990 -> not sent, figures shown in the part, re-press requested");
  }

  console.log("AUDIT2 PROBE: ALL PASS");
})().catch((e) => { console.error("FAIL:", e && e.stack ? e.stack : e); process.exit(1); });
