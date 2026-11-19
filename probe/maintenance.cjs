"use strict";
/* 再開状態チェック (2026-11-19 差し替え。旧: メンテナンス停止状態の検証)
   2026-11-19 のユーザー指示でアグリゲーターは「使用可能だがメンテナンス中
   (不具合の可能性あり)」として再開した。このプローブはその状態を検証する:
   (1) MAINTENANCE_MODE = false で、停止機構 (全ハンドラのガードと
       applyMaintenanceMode) はコードに残っていること、
   (2) 両言語ページのバナーが新しい注意書きで、旧「利用できません」文面が
       残っていないこと — フラグだけ戻したりバナーだけ戻したりすると落ちる、
   (3) 初期化後に操作部品が disabled になっていないこと、
   (4) 入口ハンドラが no-op ではなく実際に動くこと (不正な金額/アドレスに
       対して検証エラーを返すところまで。送信・見積もりの実通信はしない —
       実見積もりの確認は tools/harness.cjs と probe/*.cjs の担当)。 */
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const IDS = ["chainInf", "chainQl1", "chainTest", "testnetBanner", "chainNote", "connectBtn", "connectBtnMain", "fromTokenBadge", "toTokenBadge", "xFromTokenBadge", "xToTokenBadge", "accountLine", "status", "fromToken", "toToken", "fromBalance", "toBalance", "amountIn", "flipBtn", "quoteBtn", "planArea", "routeList", "splitNote", "rateLine", "rateInvertBtn", "gasLine", "receiveOut", "minLine", "swapBtn", "txResult", "slipCustom", "caInput", "caAddBtn", "caMsg", "modeSame", "modeCross", "modeNote", "swapPanel", "caPanel", "crossPanel", "xSrcInf", "xSrcQl1", "xDstLabel", "xFromToken", "xToToken", "xFromBalance", "xAmount", "xQuoteBtn", "xStatus", "xCandidates", "xFlow", "xAbandon", "arbPanel", "arbAmount", "arbScanBtn", "arbStatus", "arbBoard", "arbTestnetNote", "langSel", "aggArea", "themeToggle"];

const NEW_BANNER = {
  en: "Usable, but still under maintenance — bugs may occur.",
  ja: "使用可能ですが、メンテナンス中ですので不具合の可能性があります",
};
const OLD_BANNER = {
  en: "Under maintenance — quotes and trading are unavailable.",
  ja: "メンテナンス中 — 見積もりと取引は利用できません。",
};

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
  /* ---- static checks: flag is OFF, mechanism retained, banners match ---- */
  const appSrc = fs.readFileSync(__dirname + "/../docs/app.js", "utf8");
  assert.ok(/const MAINTENANCE_MODE = false;/.test(appSrc), "MAINTENANCE_MODE = false present (reopened 2026-11-19)");
  assert.ok(!/const MAINTENANCE_MODE = true;/.test(appSrc), "flag must not be true in the reopened state");
  assert.ok(/function applyMaintenanceMode\(\) \{\n  if \(!MAINTENANCE_MODE\) return;/.test(appSrc), "applyMaintenanceMode still keys off the flag (mechanism retained)");
  const gated = ["onQuote", "onConnect", "onDeployAggregator", "onSwap", "onXQuote", "startXFlow", "doXSplitStep1", "doXSplitStep2", "checkSplitArrival", "doXSplitStep4", "doXStep1", "doXStep2", "checkArrival", "doXStep4Legacy", "doXStep4", "onXAbandon", "onArbScan", "startArbFlow", "startReturnFlow", "onCaAdd"];
  for (const fn of gated) {
    const re = new RegExp("(?:async )?function " + fn + "\\([^)]*\\) \\{\\n  if \\(MAINTENANCE_MODE\\) return;");
    assert.ok(re.test(appSrc), "handler still carries the maintenance guard (mechanism retained): " + fn);
  }
  console.log("static: flag=false, all " + gated.length + " handler guards + applyMaintenanceMode retained");

  const pages = { en: fs.readFileSync(__dirname + "/../docs/en.html", "utf8"), ja: fs.readFileSync(__dirname + "/../docs/ja.html", "utf8") };
  for (const lang of ["en", "ja"]) {
    assert.ok(pages[lang].includes(NEW_BANNER[lang]), lang + ": new caution banner present");
    assert.ok(!pages[lang].includes(OLD_BANNER[lang]), lang + ": old unavailable banner gone");
    assert.ok(!/quotes and trading are unavailable|見積もりと取引は利用できません/.test(pages[lang]), lang + ": no 'unavailable' wording anywhere");
  }
  for (const [name, html, cta] of [["EN", pages.en, "Connect wallet"], ["JA", pages.ja, "ウォレットを接続"]]) {
    assert.strictEqual((html.match(/id="connectBtn"/g) || []).length, 1, name + ": one header connect button");
    assert.strictEqual((html.match(/id="connectBtnMain"/g) || []).length, 1, name + ": one main-area connect button");
    assert.ok(html.includes('id="connectBtnMain" type="button" class="big connect-cta">' + cta + "</button>"), name + ": main connect CTA label");
    assert.ok(html.indexOf('id="connectBtn"') < html.indexOf('id="themeToggle"'), name + ": header connect sits in the top actions row");
    assert.ok(html.includes('src="app.js?v=14"'), name + ": app.js cache-buster bumped to v=14");
  }
  console.log("static: EN/JA caution banners + both connect buttons + cache-buster OK");

  for (const lang of ["en", "ja"]) {
    const { app, els, body } = loadPage(lang);
    assert.strictEqual(app.MAINTENANCE_MODE, false, lang + ": exported flag is false");

    /* initApp が走っても applyMaintenanceMode は即 return し、部品は有効なまま */
    const mustBeEnabled = ["connectBtn", "connectBtnMain", "quoteBtn", "fromToken", "toToken", "amountIn", "slipCustom", "caInput", "caAddBtn", "xQuoteBtn", "xAmount", "xFromToken", "xToToken", "arbScanBtn", "arbAmount", "chainInf", "chainQl1", "modeSame", "modeCross", "xAbandon", "flipBtn", "langSel"];
    for (const id of mustBeEnabled) assert.strictEqual(els[id].disabled, false, lang + ": " + id + " NOT disabled after init");
    /* swapBtn はメンテナンスではなく通常ロジック (未接続なので updateSwapBtn が
       無効化) で disabled になるのが v7.2 の正常挙動 */
    assert.strictEqual(els.swapBtn.disabled, true, lang + ": swapBtn disabled by the normal no-account logic (not maintenance)");
    assert.ok(!body.classList.contains("maintenance"), lang + ": body has no maintenance class");
    assert.strictEqual(els.fromTokenBadge.textContent, "USDT", lang + ": pay token badge syncs from the selected token");
    assert.strictEqual(els.toTokenBadge.textContent, "42", lang + ": receive token badge syncs from the selected token");
    console.log(lang + ": controls enabled after init, no maintenance class");

    /* 入口が no-op でないこと: バリデーションまで実際に到達する
       (メンテナンス中はここが無言で return し、status/caMsg は空のままだった) */
    els.amountIn.value = "abc";
    await app.onQuote();
    assert.ok(els.status.textContent.length > 0, lang + ": onQuote is live (validation error reaches status, not a silent no-op)");

    els.caInput.value = "not-an-address";
    await app.onCaAdd();
    assert.ok(els.caMsg.textContent.length > 0, lang + ": onCaAdd is live (format error reaches caMsg, not a silent no-op)");

    const connectHandler = (els.connectBtn._handlers.click || [])[0];
    assert.ok(connectHandler, lang + ": connect click handler registered");
    console.log(lang + ": quote/CA handlers live (validation reached), connect handler registered");
  }
  console.log("REOPENED-STATE PROBE (flag off / caution banner / controls live): ALL PASS");
})().catch((e) => { console.error("FAIL:", e && e.message ? e.message : e); process.exit(1); });
