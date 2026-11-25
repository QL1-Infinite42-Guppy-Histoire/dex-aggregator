"use strict";
/* 監査 2026-11-24 の fail-closed 回帰プローブ (送信はしません):
   - #1 (高): quoteNative (ブリッジ手数料取得) をスタブで失敗させると、
     quoteCrossPlan の候補に feeUnknown が立ち、bridgeFeeInSrcToken は
     null を返し、分割プランは提示されない (plan null / net は convFailed)。
     単一ルートの見積もり自体は従来どおり返る。対照 (スタブなし) では
     feeUnknown は立たず、手数料が実数で入る。
   - #2 (中): 同じスタブ下で quoteArbRoute (QOM, infToQl1) は ok=false +
     feeUnknown になり、正味の数値を持たない。対照では ok=true で
     手数料が QOM 換算で差し引かれている。
   - #5 (中): decimals=200 を返す偽トークンは fetchTokenMeta が弾く。
   - #3/#4/#9: DOM スタブ上で xAmount の無効化、スリッページ不正値の
     明示エラー＋復帰、txLinkHtml のハッシュ検証を確認する。
   スタブ方法: global.fetch を包み、eth_call のうち data が quoteNative
   セレクタ (0xe9e64e40) で始まるものだけ JSON-RPC エラーにし、偽
   トークン宛の symbol/name/decimals だけ偽応答する。他は実 RPC に流す。 */
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

global.localStorage = { _m: {}, getItem(k) { return this._m[k] || null; }, setItem(k, v) { this._m[k] = v; }, removeItem(k) { delete this._m[k]; } };

const realFetch = global.fetch;
let failQuoteNative = false;
const FAKE_TOKEN = "0x000000000000000000000000000000000000dead";
const FAKE_DECIMALS = 200;
function abiString(s) {
  const bytes = Buffer.from(s, "utf8");
  const padded = Buffer.alloc(Math.max(32, Math.ceil(bytes.length / 32) * 32));
  bytes.copy(padded);
  return "0x" + (32).toString(16).padStart(64, "0") + bytes.length.toString(16).padStart(64, "0") + padded.toString("hex");
}
function stubDecision(call) {
  if (!call || call.method !== "eth_call") return { handled: false };
  const p = (call.params && call.params[0]) || {};
  const to = String(p.to || "").toLowerCase();
  const data = String(p.data || "");
  if (to === FAKE_TOKEN) {
    if (data.startsWith("0x313ce567")) return { handled: true, result: "0x" + BigInt(FAKE_DECIMALS).toString(16).padStart(64, "0") };
    if (data.startsWith("0x95d89b41")) return { handled: true, result: abiString("EVIL") };
    if (data.startsWith("0x06fdde03")) return { handled: true, result: abiString("Evil Token") };
    return { handled: true, result: "0x" };
  }
  if (failQuoteNative && data.startsWith("0xe9e64e40")) return { handled: true, error: { code: -32000, message: "stubbed quoteNative failure" } };
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

const app = require("../docs/app.js");
const { parseAmount, formatAmount } = app;

/* ---------- DOM stub loader (probe/maintenance.cjs と同じ方式) ---------- */
const IDS = ["chainInf", "chainQl1", "chainNote", "connectBtn", "connectBtnMain", "fromTokenBadge", "toTokenBadge", "xFromTokenBadge", "xToTokenBadge", "accountLine", "status", "fromToken", "toToken", "fromBalance", "toBalance", "amountIn", "flipBtn", "quoteBtn", "planArea", "routeList", "splitNote", "rateLine", "rateInvertBtn", "gasLine", "receiveOut", "minLine", "swapBtn", "txResult", "slipCustom", "caInput", "caAddBtn", "caMsg", "modeSame", "modeCross", "modeNote", "swapPanel", "caPanel", "crossPanel", "xSrcInf", "xSrcQl1", "xDstLabel", "xFromToken", "xToToken", "xFromBalance", "xAmount", "xQuoteBtn", "xStatus", "xCandidates", "xFlow", "xAbandon", "arbPanel", "arbAmount", "arbScanBtn", "arbStatus", "arbBoard", "langSel", "aggArea", "themeToggle"];
function loadPage(lang) {
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
  const store = {};
  const sandbox = {
    console, setTimeout, setInterval, clearInterval, BigInt, JSON, Math, Number, String, Array, Object, Map, Set, Promise, RegExp, Error, TextDecoder, URLSearchParams,
    fetch: (...a) => fetch(...a),
    localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } },
    document: {
      documentElement: { lang }, body,
      getElementById: (id) => els[id] || null,
      querySelectorAll: (sel) => (sel === "button, input, select, textarea" ? Object.values(els) : []),
      addEventListener: () => {},
    },
    window: {},
    module: { exports: {} },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(__dirname + "/../docs/app.js", "utf8"), sandbox, { filename: "app.js" });
  return { app: sandbox.module.exports, els };
}

(async () => {
  const usdt = app.tokenById("infinite", "usdt");
  const qom = app.tokenById("ql1", "native");
  const amt = parseAmount("120", usdt.decimals);
  const qomPair = app.bridgePairBySym("QOM");

  /* ================= Part A: 手数料取得が失敗する世界 ================= */
  failQuoteNative = true;
  console.log("=== Part A: quoteNative stubbed to FAIL ===");
  const cands = await app.quoteCrossPlan("infinite", usdt, "ql1", qom, amt);
  const enabled = cands.filter((c) => c.enabled);
  assert.ok(enabled.length > 0, "A1: single routes are still quoted when the fee fetch fails");
  assert.ok(enabled.every((c) => c.feeUnknown === true), "A2: every enabled candidate is marked feeUnknown");
  assert.ok(enabled[0].finalOut > 0n, "A3: single-route output is still computed");
  console.log("  A1-A3 PASS: singles quoted, all marked feeUnknown, best finalOut =", formatAmount(enabled[0].finalOut, 18, 6), "QOM");

  const deduct = await app.bridgeFeeInSrcToken("infinite", enabled[0]);
  assert.strictEqual(deduct, null, "A4: bridgeFeeInSrcToken must refuse an unknown fee");
  console.log("  A4 PASS: bridgeFeeInSrcToken returns null for a feeUnknown candidate");

  const xs = await app.evaluateCrossSplit("infinite", "ql1", amt, cands);
  assert.ok(!xs.plan, "A5: no split plan may be produced when fees are unknown");
  console.log("  A5 PASS: evaluateCrossSplit produced no plan under fee failure");

  const fakeXs = { plan: { totalOut: 1000n, parts: [{ cand: { feeUnknown: true, nativeFee: 0n } }] }, bestSingle: { finalOut: 900n, nativeFee: 0n, feeUnknown: false } };
  const netFake = await app.evaluateCrossSplitNet("infinite", "ql1", qom, fakeXs);
  assert.ok(netFake && netFake.shown === false && netFake.convFailed === true, "A6: net verdict must fail closed (convFailed) for a feeUnknown plan");
  console.log("  A6 PASS: evaluateCrossSplitNet fails closed for a feeUnknown plan");

  const rowBad = await app.quoteArbRoute("infToQl1", qomPair, parseAmount("100", 18), new Map());
  assert.strictEqual(rowBad.ok, false, "A7: arb row must not be ok when the fee is unknown");
  assert.strictEqual(rowBad.feeUnknown, true, "A7: arb row flagged feeUnknown");
  assert.ok(rowBad.netSingle == null, "A7: arb row carries no net figure when the fee is unknown");
  console.log("  A7 PASS: arb row withheld (ok=false, feeUnknown) instead of a fee-0 net");

  let threw = null;
  try { await app.fetchTokenMeta(app.CHAINS.infinite, FAKE_TOKEN); } catch (e) { threw = e; }
  assert.ok(threw && /decimals/i.test(threw.message), "A8: hostile decimals must be rejected, got: " + (threw && threw.message));
  console.log("  A8 PASS: fetchTokenMeta rejected decimals=" + FAKE_DECIMALS + " (" + threw.message + ")");

  /* ================= Part B: DOM スタブ上の配線 ================= */
  console.log("=== Part B: DOM wiring (stub) ===");
  const { app: vapp, els } = loadPage("en");
  vapp.state.xQuote = { fromId: "usdt", toId: "native", amountIn: "1000000" };
  vapp.state.xCandidates = [{ enabled: true }];
  vapp.state.xSplit = { plan: { parts: [] } };
  const xInput = els.xAmount._handlers.input || [];
  assert.ok(xInput.length >= 1, "B1: xAmount input handler is registered");
  xInput.forEach((fn) => fn());
  assert.strictEqual(vapp.state.xQuote, null, "B1: xQuote cleared when the amount changes");
  assert.strictEqual(vapp.state.xCandidates.length, 0, "B1: xCandidates cleared when the amount changes");
  assert.strictEqual(vapp.state.xSplit, null, "B1: xSplit cleared when the amount changes");
  assert.ok(els.xStatus.textContent.length > 0, "B1: a re-quote message is shown");
  console.log("  B1 PASS (#3): changing xAmount after a quote clears candidates/plan and asks for a re-quote");

  vapp.state.slippagePct = 1;
  els.slipCustom.value = "999";
  (els.slipCustom._handlers.input || []).forEach((fn) => fn());
  assert.strictEqual(vapp.state.slippagePct, 1, "B2: invalid slippage must not change the active value");
  assert.strictEqual(els.slipCustom.value, "1", "B2: field restored to the active value");
  assert.ok(els.status.textContent.length > 0, "B2: an explicit error is shown");
  console.log("  B2 PASS (#4): out-of-range slippage shows an error and restores the field");

  const badLink = vapp.txLinkHtml("0xnot-a-real-hash", "txSentLabel");
  assert.ok(!badLink.includes("<a "), "B3: a malformed hash must not become a link");
  const goodHash = "0x" + "ab".repeat(32);
  const goodLink = vapp.txLinkHtml(goodHash, "txSentLabel");
  assert.ok(goodLink.includes('<a href="https://scan.infinitedrive.xyz/tx/' + goodHash), "B3: a valid hash links to the explorer");
  console.log("  B3 PASS (#15): malformed hash renders as plain text, valid hash links");

  /* ================= Part C: 対照 (実 RPC・スタブなし) ================= */
  failQuoteNative = false;
  console.log("=== Part C: live controls (real RPC) ===");
  const cands2 = await app.quoteCrossPlan("infinite", usdt, "ql1", qom, amt);
  const enabled2 = cands2.filter((c) => c.enabled);
  assert.ok(enabled2.length > 0, "C1: live cross candidates exist");
  assert.ok(enabled2.every((c) => !c.feeUnknown), "C1: no feeUnknown flags when the fee fetch works");
  const best2 = enabled2.reduce((a, b) => (b.finalOut > a.finalOut ? b : a));
  assert.ok(best2.nativeFee > 0n, "C1: the bridge native fee is fetched live");
  console.log("  C1 PASS: live 120 USDT -> QOM (QL1) best single =", formatAmount(best2.finalOut, 18, 6), "QOM via", best2.pair.sym, "| native fee", formatAmount(best2.nativeFee, 18, 4), "[42]");

  const xs2 = await app.evaluateCrossSplit("infinite", "ql1", amt, cands2);
  if (xs2 && xs2.plan) {
    const net2 = await app.evaluateCrossSplitNet("infinite", "ql1", qom, xs2);
    assert.ok(net2 && net2.convFailed === false, "C2: live net conversion must not fail closed spuriously");
    console.log("  C2 PASS: live split plan total =", formatAmount(xs2.plan.totalOut, 18, 6), "QOM | net verdict shown =", net2.shown);
  } else {
    console.log("  C2 SKIP: no live split plan at current pool state (net gate untested live; Part A covers the logic)");
  }

  const rowOk = await app.quoteArbRoute("infToQl1", qomPair, parseAmount("100", 18), new Map());
  assert.strictEqual(rowOk.ok, true, "C3: live arb QOM row is ok");
  assert.ok(rowOk.feeQom > 0n, "C3: live arb fee converted to QOM terms");
  assert.strictEqual(rowOk.netSingle, rowOk.endRaw - rowOk.feeQom, "C3: live arb net = gross - fee");
  console.log("  C3 PASS: live arb QOM row ok, fee =", formatAmount(rowOk.feeQom, 18, 6), "QOM, net =", formatAmount(rowOk.netSingle, 18, 6), "QOM");

  const t42 = app.tokenById("infinite", "native");
  const q = await app.fetchQuotesForTokens(app.CHAINS.infinite, usdt, t42, parseAmount("100", usdt.decimals));
  assert.ok(q.routes.length > 0, "C4: live same-chain routes exist");
  console.log("  C4 PASS: live same-chain 100 USDT -> 42 best =", formatAmount(q.routes[0].amountOut, 18, 6), "42 over", q.routes.length, "routes");

  const meta = await app.fetchTokenMeta(app.CHAINS.ql1, app.tokenById("ql1", "qusdt").address);
  assert.strictEqual(meta.decimals, 6, "C5: live qUSDT decimals read as 6");
  console.log("  C5 PASS: live fetchTokenMeta(qUSDT) decimals = 6, symbol =", meta.symbol);

  console.log("FEEFAIL PROBE: ALL PASS");
})().catch((e) => { console.error("FAIL:", e && e.message ? e.message : e); process.exit(1); });
