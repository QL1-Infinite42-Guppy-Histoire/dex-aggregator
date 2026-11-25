/* localStorage 復元の検証プローブ (監査 2026-11-25)。実送信なし (ウォレット・
   RPC はスタブ)。壊れた保存データがページを壊さないことを固定する:
   - カスタムトークン: null / 住所なし / decimals 異常のエントリは読み取り時に
     捨てられ、初期化が最後まで進む (ハンドラが全て付く)。正常なエントリは残る
   - 保存フロー: 必須の数値フィールドが欠けた v1 / v2 分割フローは復元されず
     破棄される (クロス画面を開いても例外にならない)。正規の v5 単一・
     旧 v4 形式・v2 分割フローは従来どおり復元される
   - JSON 破損は従来どおり null (破棄) */
"use strict";
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const ACCT_A = "0x1111111111111111111111111111111111111111";
const ACCT_B = "0x2222222222222222222222222222222222222222";

function makeEth(opts) {
  const o = Object.assign({ accounts: [], revoke: "ok" }, opts || {});
  const eth = {
    calls: [],
    listeners: {},
    request: async (req) => {
      eth.calls.push(req);
      const m = req && req.method;
      if (m === "eth_requestAccounts") return o.accounts.slice();
      if (m === "eth_accounts") return o.accounts.slice();
      if (m === "eth_chainId") return "0x" + (421018).toString(16);
      if (m === "wallet_revokePermissions") {
        if (o.revoke === "throw") throw new Error("revoke unsupported (stub)");
        o.accounts = [];
        /* MetaMask は revoke に伴って accountsChanged([]) を発火しうる */
        if (eth.listeners.accountsChanged) eth.listeners.accountsChanged([]);
        return null;
      }
      throw new Error("stubEth: unexpected method " + m);
    },
    on: (ev, fn) => { eth.listeners[ev] = fn; },
  };
  return eth;
}

/* 残高系 JSON-RPC は決定的に 0 を返す (ネットワークに出ない) */
async function stubFetch(url, opts) {
  let body = null;
  try { body = JSON.parse((opts && opts.body) || "null"); } catch (e) { body = null; }
  if (!body) throw new Error("stubFetch: non-RPC fetch " + url);
  const one = (c) => ({ jsonrpc: "2.0", id: c.id, result: c.method === "eth_getBalance" ? "0x0" : "0x" + "0".repeat(64) });
  const payload = Array.isArray(body) ? body.map(one) : one(body);
  return { ok: true, status: 200, json: async () => payload };
}

const IDS = ["chainInf", "chainQl1", "chainTest", "testnetBanner", "chainNote", "connectBtn", "connectBtnMain", "connDlg", "connTitle", "connAddr", "disconnectBtn", "connClose", "fromTokenBadge", "toTokenBadge", "xFromTokenBadge", "xToTokenBadge", "accountLine", "status", "fromToken", "toToken", "fromBalance", "toBalance", "amountIn", "flipBtn", "quoteBtn", "planArea", "routeList", "splitNote", "rateLine", "rateInvertBtn", "gasLine", "receiveOut", "minLine", "swapBtn", "txResult", "slipCustom", "caInput", "caAddBtn", "caMsg", "modeSame", "modeCross", "modeNote", "swapPanel", "caPanel", "crossPanel", "xSrcInf", "xSrcQl1", "xDstLabel", "xDstMark", "xFromToken", "xToToken", "xFromBalance", "xAmount", "xQuoteBtn", "xStatus", "xCandidates", "xFlow", "xAbandon", "arbPanel", "arbAmount", "arbScanBtn", "arbStatus", "arbBoard", "arbTestnetNote", "langSel", "aggArea", "themeToggle"];
function loadPage(lang, eth, presetStore) {
  function makeEl(id) {
    return {
      id, value: "", innerHTML: "", textContent: "", disabled: false, style: {},
      dataset: {}, _handlers: {}, open: false,
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else f ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      addEventListener(ev, fn) { (this._handlers[ev] = this._handlers[ev] || []).push(fn); },
      setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
      querySelectorAll() { return []; },
      showModal() { this.open = true; },
      close() { this.open = false; },
      async click() { for (const fn of (this._handlers.click || [])) await fn(); },
    };
  }
  const els = {};
  for (const id of IDS) els[id] = makeEl(id);
  const body = makeEl("body");
  const store = Object.assign({}, presetStore || {});
  const sandbox = {
    console, setTimeout, setInterval, clearInterval, BigInt, JSON, Math, Number, String, Array, Object, Map, Set, Promise, RegExp, Error, TextDecoder, URLSearchParams,
    fetch: stubFetch,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    document: {
      documentElement: { lang }, body,
      getElementById: (id) => els[id] || null,
      querySelectorAll: (sel) => (sel === "button, input, select, textarea" ? Object.values(els) : []),
      addEventListener: () => {},
    },
    window: { ethereum: eth },
    module: { exports: {} },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(__dirname + "/../docs/app.js", "utf8"), sandbox, { filename: "app.js" });
  return { app: sandbox.module.exports, els, store, win: sandbox.window };
}
const flush = () => new Promise((r) => setTimeout(r, 0));
(async () => {
  const eth = makeEth({ accounts: [] });
  const VALID_TOK = { id: "ca_0x1111111111111111111111111111111111111111", symbol: "VTK", name: "Valid", address: "0x1111111111111111111111111111111111111111", decimals: 18, isNative: false, custom: true };

  /* ---- custom tokens ---- */
  {
    const preset = { dexagg_custom_v1: JSON.stringify({ infinite: [null, VALID_TOK, { id: "ca_x", symbol: "NOADDR", decimals: 18 }, { id: "ca_y", symbol: "BADDEC", address: "0x2222222222222222222222222222222222222222", decimals: 1e9 }, { id: "ca_z", symbol: "STRDEC", address: "0x3333333333333333333333333333333333333333", decimals: "18" }], ql1: [], testnet: [] }) };
    const { app, els } = loadPage("en", eth, preset);
    assert.ok((els.quoteBtn._handlers.click || []).length > 0, "init completed: quote handler wired");
    assert.ok((els.connectBtn._handlers.click || []).length > 0, "init completed: connect handler wired");
    const ids = app.state.custom.infinite.map((t) => t.id);
    assert.deepStrictEqual(ids, [VALID_TOK.id], "only the valid custom token survives load validation");
    console.log("CUSTOM PASS: malformed entries dropped at load, init completes, valid entry kept");
  }

  /* ---- flows: malformed are discarded, valid ones restore ---- */
  const baseV1 = { v: 1, step: 4, srcKey: "infinite", dstKey: "ql1", fromId: "usdt", toId: "native", amountText: "5", amountIn: "5000000000000000000", sym: "QOM", tSrcId: "qom", tDstId: "wqom", swap1Path: null, swap1Out: "0", bridgeOut: "1000000000000000000", finalEst: "0", nativeFee: "0", baselineT: "0", baselineDst: "0", swap1Tx: null, bridgeTx: null, messageId: null, bridgeAt: null, arrived: "1000000000000000000", createdAt: 1 };
  {
    const { app } = loadPage("en", eth, { dexagg_xflow_v1: JSON.stringify(baseV1) });
    assert.ok(app.state.xflow && app.state.xflow.sym === "QOM", "legacy v4-shape flow restores");
    console.log("FLOW PASS: legacy v4-shape v1 flow restores");
  }
  for (const [label, mutate] of [
    ["missing bridgeOut", (f) => { delete f.bridgeOut; }],
    ["missing amountIn", (f) => { delete f.amountIn; }],
    ["non-numeric amountIn", (f) => { f.amountIn = "abc"; }],
    ["unknown chain key", (f) => { f.srcKey = "bogus"; }],
    ["unknown bridge sym", (f) => { f.sym = "NOPE"; }],
    ["bad step", (f) => { f.step = 9; }],
    ["path not an array", (f) => { f.swap1Path = "0x1234"; }],
  ]) {
    const f = JSON.parse(JSON.stringify(baseV1)); mutate(f);
    const { app, els } = loadPage("en", eth, { dexagg_xflow_v1: JSON.stringify(f) });
    assert.strictEqual(app.state.xflow, null, label + ": flow discarded");
    await els.modeCross.click(); await flush(); // must not throw
    console.log("FLOW PASS: malformed v1 flow discarded (" + label + "), cross mode opens cleanly");
  }
  {
    const part = { idx: 0, pct: 100, sym: "QOM", tSrcId: "wqom", tDstId: "qom", amountIn: "1000", leg1Path: null, leg1Wrap: false, leg2Path: null, estLeg1Out: "1000", estFinalOut: "1000", nativeFee: "0", step: 1, received: "1000", baselineT: null, swap1Tx: null, bridgeTx: null, bridgeAt: null, messageId: null, bridgedAmount: null, arrivedAmt: null, arrivedFlag: false, swap2Tx: null, error: null, errorPhase: null };
    const good = { v: 2, kind: "split", srcKey: "ql1", dstKey: "infinite", fromId: "qswap", toId: "fish", amountIn: "2000", totalEst: "2000", parts: [part, Object.assign({}, part, { idx: 1 })], createdAt: 1 };
    const { app } = loadPage("en", eth, { dexagg_xflow_v1: JSON.stringify(good) });
    assert.ok(app.state.xflow && app.state.xflow.kind === "split", "valid split flow restores");
    const bad = JSON.parse(JSON.stringify(good)); delete bad.totalEst;
    const r2 = loadPage("en", eth, { dexagg_xflow_v1: JSON.stringify(bad) });
    assert.strictEqual(r2.app.state.xflow, null, "split flow without totalEst discarded");
    const bad2 = JSON.parse(JSON.stringify(good)); bad2.parts[0].amountIn = "x";
    const r3 = loadPage("en", eth, { dexagg_xflow_v1: JSON.stringify(bad2) });
    assert.strictEqual(r3.app.state.xflow, null, "split flow with non-numeric part amountIn discarded");
    console.log("FLOW PASS: valid v2 split flow restores; malformed split flows discarded");
  }
  {
    const { app } = loadPage("en", eth, { dexagg_xflow_v1: "{not json" });
    assert.strictEqual(app.state.xflow, null, "corrupt JSON discarded");
    console.log("FLOW PASS: corrupt JSON discarded");
  }
  console.log("STORAGE PROBE: ALL PASS");
})().catch((e) => { console.error("STORAGE PROBE FAIL:", e && e.message); process.exit(1); });
