"use strict";
/* DOM-stub harness: docs/app.js をブラウザ相当のスタブ上で実行し、
   見積もりランキング / ルート選択 / CA追加 を検証する (ql1-prices の方式)。 */
const fs = require("fs");
const vm = require("vm");

function makeEl(id) {
  return {
    id, value: "", innerHTML: "", textContent: "", disabled: false, style: {},
    dataset: {}, _handlers: {},
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else f ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    addEventListener(ev, fn) { (this._handlers[ev] = this._handlers[ev] || []).push(fn); },
    querySelectorAll() { return []; },
  };
}
const IDS = ["chainInf", "chainQl1", "chainNote", "connectBtn", "accountLine", "status", "fromToken", "toToken", "fromBalance", "toBalance", "amountIn", "flipBtn", "quoteBtn", "routeList", "splitNote", "minLine", "swapBtn", "txResult", "slipCustom", "caInput", "caAddBtn", "caMsg"];
const els = {};
for (const id of IDS) els[id] = makeEl(id);
const store = {};
const sandbox = {
  console, setTimeout, BigInt, JSON, Math, Number, String, Array, Object, Map, Set, Promise, RegExp, Error, TextDecoder, URLSearchParams,
  fetch: (...a) => fetch(...a),
  localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } },
  document: { getElementById: (id) => els[id] || null, querySelectorAll: () => [], addEventListener: () => {} },
  window: {},
  module: { exports: {} },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(__dirname + "/../docs/app.js", "utf8"), sandbox, { filename: "app.js" });
const app = sandbox.module.exports;

(async () => {
  console.log("init OK. default chain:", app.state.chainKey, "| from select =", els.fromToken.value, "| to select =", els.toToken.value);

  // --- quote ranking on Infinite (default USDT -> 42, 10) ---
  els.amountIn.value = "10";
  await app.onQuote();
  console.log("\n[Infinite] routes:", app.state.routes.length, "| status:", els.status.textContent);
  console.log("[Infinite] routeList HTML has cards:", (els.routeList.innerHTML.match(/route-card/g) || []).length, "| best badge:", els.routeList.innerHTML.includes("いちばん多い"));
  const outs = app.state.routes.map((r) => r.amountOut);
  console.log("[Infinite] sorted desc:", outs.every((v, i) => i === 0 || outs[i - 1] >= v), "| top:", app.formatAmount(outs[0], 18, 6), "42 | directOut:", app.state.directOut != null ? app.formatAmount(app.state.directOut, 18, 6) : null);

  // --- route selection ---
  if (app.state.routes.length > 1) {
    app.selectRoute(1);
    console.log("[select] selectedIdx =", app.state.selectedIdx, "| minLine:", els.minLine.textContent);
  }

  // --- chain switch to QL1 + quote ranking (qUSDT -> QOM, 10) ---
  app.setChain("ql1");
  console.log("\n[QL1] after setChain: from =", els.fromToken.value, "to =", els.toToken.value, "| chainNote:", els.chainNote.textContent);
  els.amountIn.value = "10";
  await app.onQuote();
  const outsQ = app.state.routes.map((r) => r.amountOut);
  console.log("[QL1] routes:", app.state.routes.length, "| sorted desc:", outsQ.every((v, i) => i === 0 || outsQ[i - 1] >= v), "| top:", app.formatAmount(outsQ[0], 18, 6), "QOM | HTML cards:", (els.routeList.innerHTML.match(/route-card/g) || []).length);

  // --- CA add on QL1 (a token not in presets: FUND 0x63e2487e...) ---
  els.caInput.value = "0x63e2487e6d0fca552774966a1ab413a0f8aba5f2";
  await app.onCaAdd();
  console.log("\n[CA] caMsg:", els.caMsg.textContent);
  console.log("[CA] custom ql1 count:", app.state.custom.ql1.length, "| localStorage saved:", Boolean(store["dexagg_custom_v1"]), "| toToken now:", els.toToken.value);
  const fund = app.state.custom.ql1[0];
  console.log("[CA] meta:", fund && fund.symbol, fund && fund.name, "decimals", fund && fund.decimals);

  // --- CA add on Infinite (STARSHIP, not in presets) ---
  app.setChain("infinite");
  els.caInput.value = "0x645D71e49B86CfBE3FB93081deC2c17a496Cd57d";
  await app.onCaAdd();
  console.log("[CA-INF] caMsg:", els.caMsg.textContent, "| custom infinite:", app.state.custom.infinite.map((t) => t.symbol + "/" + t.decimals).join(","));

  console.log("\nHARNESS DONE");
})().catch((e) => { console.error("HARNESS FAILED:", e); process.exit(1); });
