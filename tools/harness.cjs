"use strict";
/* DOM-stub harness v2: docs/app.js を JP / EN 両ページ相当のスタブ上で実行し、
   見積もりランキング / 分割評価 / ルート選択 / CA追加 / テストネット設定 を検証する。 */
const fs = require("fs");
const vm = require("vm");

const IDS = ["chainInf", "chainQl1", "chainTest", "testnetBanner", "chainNote", "connectBtn", "accountLine", "status", "fromToken", "toToken", "fromBalance", "toBalance", "amountIn", "flipBtn", "quoteBtn", "planArea", "routeList", "splitNote", "rateLine", "rateInvertBtn", "gasLine", "receiveOut", "minLine", "swapBtn", "txResult", "slipCustom", "caInput", "caAddBtn", "caMsg"];

function loadPage(lang) {
  function makeEl(id) {
    return {
      id, value: "", innerHTML: "", textContent: "", disabled: false, style: {},
      dataset: {}, _handlers: {},
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else f ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      addEventListener(ev, fn) { (this._handlers[ev] = this._handlers[ev] || []).push(fn); },
      querySelectorAll() { return []; },
    };
  }
  const els = {};
  for (const id of IDS) els[id] = makeEl(id);
  const store = {};
  const sandbox = {
    console, setTimeout, BigInt, JSON, Math, Number, String, Array, Object, Map, Set, Promise, RegExp, Error, TextDecoder, URLSearchParams,
    fetch: (...a) => fetch(...a),
    localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } },
    document: { documentElement: { lang }, getElementById: (id) => els[id] || null, querySelectorAll: () => [], addEventListener: () => {} },
    window: {},
    module: { exports: {} },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(__dirname + "/../docs/app.js", "utf8"), sandbox, { filename: "app.js" });
  return { app: sandbox.module.exports, els, store };
}

(async () => {
  /* ================= JP ページ ================= */
  const jp = loadPage("ja");
  const app = jp.app, els = jp.els;
  console.log("[JP] LANG:", app.LANG, "| init chain:", app.state.chainKey, "| from:", els.fromToken.value, "to:", els.toToken.value);
  els.amountIn.value = "10";
  await app.onQuote();
  const outs = app.state.routes.map((r) => r.amountOut);
  console.log("[JP] routes:", app.state.routes.length, "| sorted desc:", outs.every((v, i) => i === 0 || outs[i - 1] >= v), "| top:", app.formatAmount(outs[0], 18, 6), "42");
  console.log("[JP] status:", els.status.textContent);
  const se = app.state.splitEval;
  console.log("[JP] split evaluated:", se && se.evaluated, "| best split:", se && se.best ? app.formatAmount(se.best.totalOut, 18, 6) : null, "| plan:", !!(se && se.plan), "| selectedPlan:", JSON.stringify(app.state.selectedPlan));
  console.log("[JP] receiveOut:", els.receiveOut.textContent, "| rateLine:", els.rateLine.textContent, "| gasLine:", els.gasLine.textContent);
  console.log("[JP] planArea has split card:", els.planArea.innerHTML.includes("split-card"), "| route cards:", (els.routeList.innerHTML.match(/route-card/g) || []).length);
  app.selectRoute(0);
  console.log("[JP] after selectRoute(0): plan =", JSON.stringify(app.state.selectedPlan), "| swapBtn label:", els.swapBtn.textContent, "| splitNote:", els.splitNote.textContent.slice(0, 40));

  // テストネットへ切替 + 実見積もり
  app.setChain("testnet");
  console.log("\n[JP-Testnet] chainNote:", els.chainNote.textContent, "| banner display:", JSON.stringify(els.testnetBanner.style.display), "| from:", els.fromToken.value, "to:", els.toToken.value);
  console.log("[JP-Testnet] config: chainId", app.CHAINS.testnet.chainId, "| router", app.CHAINS.testnet.router, "| aggregator", JSON.stringify(app.CHAINS.testnet.aggregator), "| splitExecutable:", app.splitExecutable(app.CHAINS.testnet));
  els.amountIn.value = "100";
  await app.onQuote();
  const outsT = app.state.routes.map((r) => r.amountOut);
  console.log("[JP-Testnet] TEST42->ARBA routes:", app.state.routes.length, "| sorted:", outsT.every((v, i) => i === 0 || outsT[i - 1] >= v), "| top:", app.formatAmount(outsT[0], 18, 6), "ARBA | status:", els.status.textContent);
  console.log("[JP-Testnet] split evaluated:", app.state.splitEval && app.state.splitEval.evaluated, "| receiveOut:", els.receiveOut.textContent, "| rate:", els.rateLine.textContent);

  // QL1 + CA (v1 から継続)
  app.setChain("ql1");
  els.amountIn.value = "10";
  await app.onQuote();
  console.log("\n[JP-QL1] routes:", app.state.routes.length, "| top:", app.formatAmount(app.state.routes[0].amountOut, 18, 6), "QOM");
  els.caInput.value = "0x63e2487e6d0fca552774966a1ab413a0f8aba5f2";
  await app.onCaAdd();
  console.log("[JP-QL1 CA] msg:", els.caMsg.textContent, "| saved:", Boolean(jp.store["dexagg_custom_v1"]));

  /* ================= EN ページ ================= */
  const en = loadPage("en");
  const eapp = en.app, eels = en.els;
  console.log("\n[EN] LANG:", eapp.LANG, "| chainNote:", eels.chainNote.textContent);
  eels.amountIn.value = "10";
  await eapp.onQuote();
  console.log("[EN] status:", eels.status.textContent);
  console.log("[EN] receiveOut:", eels.receiveOut.textContent, "| rateLine:", eels.rateLine.textContent, "| gasLine:", eels.gasLine.textContent);
  console.log("[EN] minLine:", eels.minLine.textContent);
  eapp.selectRoute(0);
  console.log("[EN] swapBtn label:", eels.swapBtn.textContent, "| splitNote:", eels.splitNote.textContent.slice(0, 60));
  eapp.setChain("testnet");
  console.log("[EN-Testnet] chainNote:", eels.chainNote.textContent);
  eels.amountIn.value = "1000";
  // ARBA -> ARBB (direct + via TEST42) で分割評価が走るケース
  eels.fromToken.value = "arba"; eels.toToken.value = "arbb";
  await eapp.onQuote();
  const ese = eapp.state.splitEval;
  console.log("[EN-Testnet] ARBA->ARBB routes:", eapp.state.routes.length, "| split evaluated:", ese && ese.evaluated, "| best split:", ese && ese.best ? eapp.formatAmount(ese.best.totalOut, 18, 6) : null, "| single best:", eapp.formatAmount(eapp.state.routes[0].amountOut, 18, 6), "| plan:", !!(ese && ese.plan));

  console.log("\nHARNESS DONE");
})().catch((e) => { console.error("HARNESS FAILED:", e); process.exit(1); });
