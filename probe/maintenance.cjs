"use strict";
/* Maintenance-mode check (2026-11-17): docs/app.js を DOM スタブで読み、
   MAINTENANCE_MODE が有効な間は (1) 操作部品が disabled になり (言語セレクタ
   だけ有効)、(2) 見積もり/接続/クロス/裁定/CA追加/フロー実行の入口がすべて
   no-op であること、(3) 静的 HTML に両言語のバナーが入っていることを検証する。
   送信は一切しない (入口が即 return するかの確認のみ)。 */
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const IDS = ["chainInf", "chainQl1", "chainTest", "testnetBanner", "chainNote", "connectBtn", "connectBtnMain", "fromTokenBadge", "toTokenBadge", "xFromTokenBadge", "xToTokenBadge", "accountLine", "status", "fromToken", "toToken", "fromBalance", "toBalance", "amountIn", "flipBtn", "quoteBtn", "planArea", "routeList", "splitNote", "rateLine", "rateInvertBtn", "gasLine", "receiveOut", "minLine", "swapBtn", "txResult", "slipCustom", "caInput", "caAddBtn", "caMsg", "modeSame", "modeCross", "modeNote", "swapPanel", "caPanel", "crossPanel", "xSrcInf", "xSrcQl1", "xDstLabel", "xFromToken", "xToToken", "xFromBalance", "xAmount", "xQuoteBtn", "xStatus", "xCandidates", "xFlow", "xAbandon", "arbPanel", "arbAmount", "arbScanBtn", "arbStatus", "arbBoard", "arbTestnetNote", "langSel", "aggArea", "themeToggle"];

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
  return { app: sandbox.module.exports, els, body };
}

(async () => {
  /* ---- static checks: flag + banners ---- */
  const appSrc = fs.readFileSync(__dirname + "/../docs/app.js", "utf8");
  assert.ok(/const MAINTENANCE_MODE = true;/.test(appSrc), "MAINTENANCE_MODE = true present");
  const gated = ["onQuote", "onConnect", "onDeployAggregator", "onSwap", "onXQuote", "startXFlow", "doXSplitStep1", "doXSplitStep2", "checkSplitArrival", "doXSplitStep4", "doXStep1", "doXStep2", "checkArrival", "doXStep4Legacy", "doXStep4", "onXAbandon", "onArbScan", "startArbFlow", "startReturnFlow", "onCaAdd"];
  for (const fn of gated) {
    const re = new RegExp("(?:async )?function " + fn + "\\([^)]*\\) \\{\\n  if \\(MAINTENANCE_MODE\\) return;");
    assert.ok(re.test(appSrc), "handler gated: " + fn);
  }
  console.log("static: all " + gated.length + " handlers carry the maintenance guard");
  const en = fs.readFileSync(__dirname + "/../docs/en.html", "utf8");
  const ja = fs.readFileSync(__dirname + "/../docs/ja.html", "utf8");
  assert.ok(en.includes("Under maintenance — quotes and trading are unavailable."), "EN banner text");
  assert.ok(ja.includes("メンテナンス中 — 見積もりと取引は利用できません。"), "JA banner text");
  for (const [name, html, cta] of [["EN", en, "Connect wallet"], ["JA", ja, "ウォレットを接続"]]) {
    assert.strictEqual((html.match(/id="connectBtn"/g) || []).length, 1, name + ": one header connect button");
    assert.strictEqual((html.match(/id="connectBtnMain"/g) || []).length, 1, name + ": one main-area connect button");
    assert.ok(html.includes('id="connectBtnMain" type="button" class="big connect-cta">' + cta + "</button>"), name + ": main connect CTA label");
    assert.ok(html.indexOf('id="connectBtn"') < html.indexOf('id="themeToggle"'), name + ": header connect sits in the top actions row");
  }
  console.log("static: flag + EN/JA banners + both connect buttons OK");

  for (const lang of ["en", "ja"]) {
    const { app, els } = loadPage(lang);
    assert.strictEqual(app.MAINTENANCE_MODE, true, lang + ": exported flag is true");

    /* initApp の最後で applyMaintenanceMode が走り、部品が無効化されている */
    const mustBeDisabled = ["connectBtn", "connectBtnMain", "quoteBtn", "swapBtn", "fromToken", "toToken", "amountIn", "slipCustom", "caInput", "caAddBtn", "xQuoteBtn", "xAmount", "xFromToken", "xToToken", "arbScanBtn", "arbAmount", "chainInf", "chainQl1", "modeSame", "modeCross", "xAbandon", "flipBtn"];
    for (const id of mustBeDisabled) assert.strictEqual(els[id].disabled, true, lang + ": " + id + " disabled after init");
    assert.strictEqual(els.langSel.disabled, false, lang + ": langSel stays enabled");
    assert.strictEqual(els.fromTokenBadge.textContent, "USDT", lang + ": pay token badge syncs from the selected token");
    assert.strictEqual(els.toTokenBadge.textContent, "42", lang + ": receive token badge syncs from the selected token");
    console.log(lang + ": controls disabled after init, langSel enabled");

    /* 入口が no-op であること */
    els.amountIn.value = "10";
    await app.onQuote();
    assert.strictEqual(app.state.routes.length, 0, lang + ": onQuote no-op (no routes)");
    assert.strictEqual(els.status.textContent, "", lang + ": onQuote no-op (no status)");

    /* onConnect は export されていないので、initApp が登録した click ハンドラ経由で呼ぶ */
    const connectHandler = (els.connectBtn._handlers.click || [])[0];
    assert.ok(connectHandler, lang + ": connect click handler registered");
    await connectHandler();
    assert.ok(!app.state.account, lang + ": onConnect no-op (no account)");

    await app.onXQuote();
    assert.strictEqual(app.state.xCandidates.length, 0, lang + ": onXQuote no-op");

    await app.onArbScan();
    assert.strictEqual(els.arbStatus.textContent, "", lang + ": onArbScan no-op");

    els.caInput.value = "0x0000000000000000000000000000000000000001";
    await app.onCaAdd();
    assert.strictEqual(els.caMsg.textContent, "", lang + ": onCaAdd no-op");

    await app.doXStep1();
    await app.doXStep4();
    await app.checkArrival(true);
    await app.checkSplitArrival(true);
    await app.startXFlow(null);
    await app.startReturnFlow();
    console.log(lang + ": quote/connect/cross/arb/CA/flow handlers all no-op");
  }
  console.log("MAINTENANCE PROBE: ALL PASS");
})().catch((e) => { console.error("FAIL:", e && e.message ? e.message : e); process.exit(1); });
