"use strict";
/* DOM-stub harness v2: docs/app.js を JP / EN 両ページ相当のスタブ上で実行し、
   見積もりランキング / 分割評価 / ルート選択 / CA追加 / テストネット設定 を検証する。 */
const fs = require("fs");
const vm = require("vm");

const IDS = ["chainInf", "chainQl1", "chainTest", "testnetBanner", "chainNote", "connectBtn", "accountLine", "status", "fromToken", "toToken", "fromBalance", "toBalance", "amountIn", "flipBtn", "quoteBtn", "planArea", "routeList", "splitNote", "rateLine", "rateInvertBtn", "gasLine", "receiveOut", "minLine", "swapBtn", "txResult", "slipCustom", "caInput", "caAddBtn", "caMsg", "modeSame", "modeCross", "modeNote", "swapPanel", "caPanel", "crossPanel", "xSrcInf", "xSrcQl1", "xDstLabel", "xFromToken", "xToToken", "xFromBalance", "xAmount", "xQuoteBtn", "xStatus", "xCandidates", "xFlow", "xAbandon"];

function loadPage(lang, seedStore) {
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
  const store = seedStore || {};
  const sandbox = {
    console, setTimeout, setInterval, clearInterval, BigInt, JSON, Math, Number, String, Array, Object, Map, Set, Promise, RegExp, Error, TextDecoder, URLSearchParams,
    fetch: (...a) => fetch(...a),
    localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } },
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

  /* ================= v3 cross-chain (JP) ================= */
  console.log("\n[V3-JP] --- cross-chain ---");
  app.state.account = "0x1111111111111111111111111111111111111111";
  app.setMode("cross");
  console.log("[V3-JP] mode:", app.state.mode, "| crossPanel display:", JSON.stringify(els.crossPanel.style.display), "| swapPanel display:", JSON.stringify(els.swapPanel.style.display), "| xSrc:", app.state.xSrc, "| dstLabel:", els.xDstLabel.textContent);
  els.xFromToken.value = "qswap"; els.xToToken.value = "fish"; els.xAmount.value = "10000";
  await app.onXQuote();
  const xc = app.state.xCandidates;
  const enC = xc.filter((c) => c.enabled);
  console.log("[V3-JP] candidates:", xc.length, "| enabled:", enC.length, "| sorted desc:", enC.every((c, i) => i === 0 || enC[i - 1].finalOut >= c.finalOut), "| best via:", enC[0] && enC[0].pair.sym, "=>", enC[0] && app.formatAmount(enC[0].finalOut, 18, 4), "FISH");
  console.log("[V3-JP] OSAK enabled (QL1->INF):", xc.find((c) => c.pair.sym === "OSAK").enabled, "| xStatus:", els.xStatus.textContent.slice(0, 60));
  console.log("[V3-JP] candidates html has cards:", (els.xCandidates.innerHTML.match(/route-card/g) || []).length, "| has start btn:", els.xCandidates.innerHTML.includes("x-start"));
  await app.startXFlow(enC[0].pair.sym);
  const fl = app.state.xflow;
  console.log("[V3-JP] flow created: step", fl && fl.step, "| sym", fl && fl.sym, "| persisted:", Boolean(jp.store["dexagg_xflow_v1"]), "| xFlow html has step1:", els.xFlow.innerHTML.includes("ステップ1"), "| abandon visible:", JSON.stringify(els.xAbandon.style.display));
  // reload simulation: fresh page over the same localStorage store
  const jp2 = loadPage("ja", jp.store);
  const restored = jp2.app.loadXFlow();
  console.log("[V3-JP reload] restored flow:", restored && restored.sym, "step", restored && restored.step, "| serialize/restore roundtrip:", JSON.stringify(jp2.app.restoreXFlow(jp2.app.serializeXFlow(restored))) === JSON.stringify(restored));
  jp2.app.setMode("cross");
  console.log("[V3-JP reload] xFlow re-rendered with resume note:", jp2.els.xFlow.innerHTML.includes("続き"));
  // arrival check negative case (step 3, nothing arrived)
  jp2.app.state.account = "0x1111111111111111111111111111111111111111";
  jp2.app.state.xflow.step = 3; jp2.app.state.xflow.baselineDst = "0"; jp2.app.state.xflow.bridgeAt = Date.now();
  const arr = await jp2.app.checkArrival(false);
  console.log("[V3-JP] checkArrival with no arrival returns:", arr, "| step stays:", jp2.app.state.xflow.step);
  jp2.app.onXAbandon();
  console.log("[V3-JP] after abandon: flow", jp2.app.state.xflow, "| store cleared:", !jp.store["dexagg_xflow_v1"]);
  // testnet guard: cross mode must fall back to same-chain
  jp2.app.setMode("cross"); jp2.app.setChain("testnet");
  console.log("[V3-JP] testnet guard: mode after setChain(testnet) =", jp2.app.state.mode);

  /* ================= v3 cross-chain (EN) ================= */
  const en2 = loadPage("en");
  en2.app.setMode("cross");
  en2.els.xFromToken.value = "qswap"; en2.els.xToToken.value = "fish"; en2.els.xAmount.value = "10000";
  await en2.app.onXQuote();
  console.log("\n[V3-EN] xStatus:", en2.els.xStatus.textContent.slice(0, 80));
  console.log("[V3-EN] candidates html has 'Via':", en2.els.xCandidates.innerHTML.includes("Via"), "| best via:", en2.app.state.xCandidates.find((c) => c.enabled).pair.sym);
  en2.app.setXSrc("infinite");
  en2.els.xFromToken.value = "fish"; en2.els.xToToken.value = "qswap"; en2.els.xAmount.value = "10";
  await en2.app.onXQuote();
  const xcE = en2.app.state.xCandidates;
  console.log("[V3-EN] INF->QL1: OSAK disabled:", !xcE.find((c) => c.pair.sym === "OSAK").enabled, "| reason len>0:", (xcE.find((c) => c.pair.sym === "OSAK").reason || "").length > 0, "| best via:", xcE.find((c) => c.enabled).pair.sym);

  console.log("\nHARNESS DONE");
})().catch((e) => { console.error("HARNESS FAILED:", e); process.exit(1); });
