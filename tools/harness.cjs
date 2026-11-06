"use strict";
/* DOM-stub harness v2: docs/app.js を JP / EN 両ページ相当のスタブ上で実行し、
   見積もりランキング / 分割評価 / ルート選択 / CA追加 / テストネット設定 を検証する。 */
const fs = require("fs");
const vm = require("vm");

const IDS = ["chainInf", "chainQl1", "chainTest", "testnetBanner", "chainNote", "connectBtn", "accountLine", "status", "fromToken", "toToken", "fromBalance", "toBalance", "amountIn", "flipBtn", "quoteBtn", "planArea", "routeList", "splitNote", "rateLine", "rateInvertBtn", "gasLine", "receiveOut", "minLine", "swapBtn", "txResult", "slipCustom", "caInput", "caAddBtn", "caMsg", "modeSame", "modeCross", "modeNote", "swapPanel", "caPanel", "crossPanel", "xSrcInf", "xSrcQl1", "xDstLabel", "xFromToken", "xToToken", "xFromBalance", "xAmount", "xQuoteBtn", "xStatus", "xCandidates", "xFlow", "xAbandon", "arbPanel", "arbAmount", "arbScanBtn", "arbStatus", "arbBoard", "arbTestnetNote", "langSel", "aggArea"];

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

  /* ================= v4 arbitrage (JP) ================= */
  console.log("\n[V4-JP] --- arbitrage: benchmark badge in cross quotes ---");
  const jp3 = loadPage("ja");
  jp3.app.setMode("cross");
  jp3.app.setXSrc("infinite");
  jp3.els.xFromToken.value = "native"; jp3.els.xToToken.value = "native"; jp3.els.xAmount.value = "100";
  await jp3.app.onXQuote();
  const bm = jp3.app.state.xBenchmark;
  const babyC = jp3.app.state.xCandidates.find((x) => x.pair.sym === "BABY");
  console.log("[V4-JP] benchmark:", bm && bm.sym, "(" + (bm && bm.kind) + ")", "| BABY vsBench%:", babyC && babyC.vsBenchPct != null ? babyC.vsBenchPct.toFixed(2) : null);
  console.log("[V4-JP] candidates html: gap badge:", jp3.els.xCandidates.innerHTML.includes("価格差で"), "| benchmark line:", jp3.els.xCandidates.innerHTML.includes("基準"));
  // direct bridge: holding CAW on Infinite, entering QL1 as CAW itself (no swap 1)
  jp3.els.xFromToken.value = "caw"; jp3.els.xToToken.value = "native"; jp3.els.xAmount.value = "10000";
  await jp3.app.onXQuote();
  const cawCand = jp3.app.state.xCandidates.find((x) => x.pair.sym === "CAW");
  console.log("[V4-JP] direct-bridge candidate: CAW swap1Route is null:", !!(cawCand && cawCand.enabled && !cawCand.swap1Route), "| html labels it:", jp3.els.xCandidates.innerHTML.includes("直接ブリッジ"), "| benchmark kind:", jp3.app.state.xBenchmark && jp3.app.state.xBenchmark.kind);

  console.log("[V4-JP] --- arbitrage board ---");
  jp3.els.arbAmount.value = "100000000";
  await jp3.app.onArbScan();
  const arows = jp3.app.state.arbRows;
  console.log("[V4-JP] board rows:", arows.length, "| ok:", arows.filter((r) => r.ok).length, "| status:", jp3.els.arbStatus.textContent.slice(0, 70));
  console.log("[V4-JP] board html: single group:", jp3.els.arbBoard.innerHTML.includes("片道裁定"), "| RT group:", jp3.els.arbBoard.innerHTML.includes("往復裁定"), "| cards:", (jp3.els.arbBoard.innerHTML.match(/arb-card/g) || []).length, "| has start buttons:", jp3.els.arbBoard.innerHTML.includes("arb-start"));
  // sorting: extract net % of single-group cards in HTML order (they appear before the RT group heading)
  const singlePart = jp3.els.arbBoard.innerHTML.split("往復裁定")[0];
  const pcts = [...singlePart.matchAll(/arb-net (?:pos|neg)">([+-]?[0-9.]+)%/g)].map((m) => parseFloat(m[1]));
  console.log("[V4-JP] single-group net% in HTML order:", pcts.join(", "), "| sorted desc:", pcts.every((v, i) => i === 0 || pcts[i - 1] >= v));
  const osakRow = arows.find((r) => r.sym === "OSAK" && r.dirKey === "ql1ToInf");
  console.log("[V4-JP] OSAK ql1ToInf row ok:", osakRow && osakRow.ok, "| gain:", osakRow && osakRow.ok ? osakRow.gainSinglePct.toFixed(2) + "%" : osakRow && osakRow.reason);
  const osakInf = arows.find((r) => r.sym === "OSAK" && r.dirKey === "infToQl1");
  console.log("[V4-JP] OSAK infToQl1 unavailable (direction disabled):", osakInf && !osakInf.ok);

  console.log("[V4-JP] --- board click -> prefill cross-chain flow ---");
  jp3.app.state.account = "0x1111111111111111111111111111111111111111";
  const pick = arows.find((r) => r.ok && r.sym === "BABY" && r.dirKey === "ql1ToInf") || arows.find((r) => r.ok && !r.isBenchmark);
  await jp3.app.startArbFlow(pick, "single");
  const fl4 = jp3.app.state.xflow;
  console.log("[V4-JP] prefilled flow: sym", fl4 && fl4.sym, "| from", fl4 && fl4.fromId, "-> to", fl4 && fl4.toId, "| src", fl4 && fl4.srcKey, "| arbReturn:", fl4 && fl4.arbReturn, "| xFrom select:", jp3.els.xFromToken.value, "| xAmount:", jp3.els.xAmount.value);
  await jp3.app.startArbFlow(pick, "rt");
  console.log("[V4-JP] RT prefill: arbReturn:", jp3.app.state.xflow && jp3.app.state.xflow.arbReturn, "| xFlow html has return note:", jp3.els.xFlow.innerHTML.includes("往復の戻り"));

  /* ================= v4 arbitrage (EN) ================= */
  const en3 = loadPage("en");
  en3.app.setMode("cross");
  en3.app.setXSrc("infinite");
  en3.els.xFromToken.value = "native"; en3.els.xToToken.value = "native"; en3.els.xAmount.value = "100";
  await en3.app.onXQuote();
  console.log("\n[V4-EN] benchmark line in candidates:", en3.els.xCandidates.innerHTML.includes("Benchmark"), "| benchmark:", en3.app.state.xBenchmark && en3.app.state.xBenchmark.sym);
  en3.els.arbAmount.value = "100000000";
  await en3.app.onArbScan();
  console.log("[V4-EN] board rows:", en3.app.state.arbRows.length, "| html single group:", en3.els.arbBoard.innerHTML.includes("One-way arbitrage"), "| RT group:", en3.els.arbBoard.innerHTML.includes("Round-trip"), "| status:", en3.els.arbStatus.textContent.slice(0, 60));

  // ---- v5: full routes ----
  const jp5 = loadPage("ja.html", {});
  jp5.app.setMode("cross"); jp5.app.setXSrc("infinite");
  jp5.els.xFromToken.value = "usdt"; jp5.els.xToToken.value = "native"; jp5.els.xAmount.value = "1000";
  await jp5.app.onXQuote();
  const fr = jp5.app.state.xCandidates.filter((c) => c.enabled);
  const perSym = {};
  for (const r of fr) perSym[r.pair.sym] = (perSym[r.pair.sym] || 0) + 1;
  console.log("\n[V5-JP] full routes:", fr.length, "| per-intermediate:", JSON.stringify(perSym));
  console.log("[V5-JP] caps ok (<=24 total, <=4 per T):", fr.length <= 24 && Object.values(perSym).every((n) => n <= 4));
  console.log("[V5-JP] sorted desc across intermediates:", fr.every((r, i) => i === 0 || fr[i - 1].finalOut >= r.finalOut));
  console.log("[V5-JP] multiple variants for QOM (>=3):", (perSym.QOM || 0) >= 3, "| benchmark route kept & flagged:", fr.some((r) => r.isBenchmark));
  const xhtml = jp5.els.xCandidates.innerHTML;
  console.log("[V5-JP] full-path html has bridge mark + 42 Chain + QL1:", xhtml.includes("ブリッジ") && xhtml.includes("42 Chain") && xhtml.includes("QL1"));
  console.log("[V5-JP] start button label is route label:", xhtml.includes("このルートではじめる"), "| x-start still present:", xhtml.includes("x-start"));
  // start a NON-best full route (example 2 shape: USDT -> FISH -> QOM leg1) and verify stored paths
  const FISH_A = "0x2c32120a12b754272d9e85c57f64b50ca2c43513";
  const ex2 = fr.find((r) => r.pair.sym === "QOM" && r.leg1Path && r.leg1Path.length === 3 && r.leg1Path[1].toLowerCase() === FISH_A);
  console.log("[V5-JP] example-2 full route present (USDT->FISH->QOM):", !!ex2, ex2 ? "| final: " + jp5.app.formatAmount(ex2.finalOut, 18, 2) : "");
  jp5.app.state.account = "0x1111111111111111111111111111111111111111";
  if (ex2) {
    await jp5.app.startXFlow(ex2);
    const fl = jp5.app.state.xflow;
    console.log("[V5-JP] flow stores CHOSEN paths exactly:", JSON.stringify(fl.swap1Path) === JSON.stringify(ex2.leg1Path), "| leg2 stored (identity=null):", fl.swap2Path === null, "| pathsV5:", fl.pathsV5 === true);
    const saved = jp5.store["dexagg_xflow_v1"] || "";
    console.log("[V5-JP] persisted localStorage carries leg1 path:", saved.includes("swap1Path") && saved.includes(FISH_A.slice(0, 20)));
    // reload with the same store -> restore keeps the paths
    const jp5b = loadPage("ja.html", jp5.store);
    const restored = jp5b.app.restoreXFlow(jp5.store["dexagg_xflow_v1"]); // restoreXFlow takes the raw JSON string
    console.log("[V5-JP] reload-resume keeps swap1Path:", JSON.stringify(restored && restored.swap1Path) === JSON.stringify(ex2.leg1Path), "| step:", restored && restored.step);
    // legacy v4 flow (no pathsV5 / no swap2Path) still renders step 4 with the legacy button
    const legacy = { v: 1, step: 4, srcKey: "infinite", dstKey: "ql1", fromId: "usdt", toId: "native", amountText: "5", amountIn: "5000000000000000000", sym: "QOM", tSrcId: "qom", tDstId: "wqom", swap1Path: null, swap1Out: "0", bridgeOut: "1000000000000000000", finalEst: "0", nativeFee: "0", baselineT: "0", baselineDst: "0", swap1Tx: null, bridgeTx: null, messageId: null, bridgeAt: null, arrived: "1000000000000000000", createdAt: Date.now() };
    jp5b.app.state.xflow = legacy; jp5b.app.renderXFlow();
    console.log("[V5-JP] legacy v4 flow renders step4 (legacy button):", jp5b.els.xFlow.innerHTML.includes("ステップ4へ"));
  }
  const en5 = loadPage("en.html", {});
  en5.app.setMode("cross"); en5.app.setXSrc("infinite");
  en5.els.xFromToken.value = "usdt"; en5.els.xToToken.value = "native"; en5.els.xAmount.value = "100";
  await en5.app.onXQuote();
  const enHtml = en5.els.xCandidates.innerHTML;
  console.log("[V5-EN] full-path html has 'bridge' + route start label:", enHtml.includes("bridge") && enHtml.includes("Start with this route"));
  console.log("[V5-EN] full routes count:", en5.app.state.xCandidates.filter((c) => c.enabled).length);

  // ---- v6: cross-chain split plans ----
  const jp6 = loadPage("ja", {});
  jp6.app.state.account = "0x1111111111111111111111111111111111111111";
  jp6.app.setMode("cross"); jp6.app.setXSrc("infinite");
  jp6.els.xFromToken.value = "usdt"; jp6.els.xToToken.value = "native"; jp6.els.xAmount.value = "100";
  await jp6.app.onXQuote();
  const xs6 = jp6.app.state.xSplit;
  console.log("\n[V6-JP] split evaluated:", xs6 && xs6.evaluated, "| best single:", xs6 && jp6.app.formatAmount(xs6.bestSingle.finalOut, 18, 2), "| best split:", xs6 && xs6.best && jp6.app.formatAmount(xs6.best.totalOut, 18, 2), "| plan:", !!(xs6 && xs6.plan));
  console.log("[V6-JP] plan beats single:", !!(xs6 && xs6.plan && xs6.plan.totalOut > xs6.bestSingle.finalOut), "| split card html:", jp6.els.xCandidates.innerHTML.includes("分割プラン") && jp6.els.xCandidates.innerHTML.includes("この分割プランではじめる"), "| fee total line:", jp6.els.xCandidates.innerHTML.includes("メッセージ代の合計"), "| parts-separate note:", jp6.els.xCandidates.innerHTML.includes("パートごとに分かれて"));
  const net6 = jp6.app.state.xSplitNet;
  console.log("[V6.5-JP caseA] net verdict: shown:", net6 && net6.shown, "| convFailed:", net6 && net6.convFailed, "| gross gain:", net6 && jp6.app.formatAmount(net6.gain, 18, 2), "QOM | extra fee in dest terms:", net6 && jp6.app.formatAmount(net6.extraFeeDest, 18, 2), "QOM | net gain:", net6 && jp6.app.formatAmount(net6.netGain, 18, 2), "| net line on card:", jp6.els.xCandidates.innerHTML.includes("追加のブリッジ代を引いても"));
  if (xs6 && xs6.plan) {
    console.log("[V6-JP] plan parts:", xs6.plan.parts.map((p) => p.pct + "%:" + p.cand.pair.sym).join(" + "), "| vs single:", ((Number(xs6.plan.totalOut) / Number(xs6.bestSingle.finalOut) - 1) * 100).toFixed(2) + "%");
    await jp6.app.startXSplitFlow();
    const sf = jp6.app.state.xflow;
    console.log("[V6-JP] split flow: kind", sf && sf.kind, "| v", sf && sf.v, "| parts:", sf && sf.parts.length, "| pct sum:", sf && sf.parts.reduce((s, p) => s + p.pct, 0), "| amounts sum == amountIn:", !!sf && sf.parts.reduce((s, p) => s + BigInt(p.amountIn), 0n).toString() === sf.amountIn, "| persisted:", (jp6.store["dexagg_xflow_v1"] || "").includes('"kind":"split"'));
    console.log("[V6-JP] flow html: phase titles:", jp6.els.xFlow.innerHTML.includes("パートごと"), "| s1 buttons:", (jp6.els.xFlow.innerHTML.match(/data-split-act="s1"/g) || []).length, "| abandon visible:", JSON.stringify(jp6.els.xAbandon.style.display));
    const jp6b = loadPage("ja", jp6.store);
    const rsf = jp6b.app.loadXFlow();
    console.log("[V6-JP reload] split flow restored:", rsf && rsf.kind, "| parts:", rsf && rsf.parts.length, "| leg paths kept:", !!rsf && JSON.stringify(rsf.parts.map((p) => p.leg1Path)) === JSON.stringify(sf.parts.map((p) => p.leg1Path)), "| phase:", jp6b.app.crossSplitPhase(rsf));
    const mk = (steps) => ({ kind: "split", parts: steps.map((s) => ({ step: s })) });
    console.log("[V6-JP] phase derivation:", [mk([0, 0]), mk([1, 0]), mk([1, 1]), mk([2, 2]), mk([3, 4])].map((x) => jp6.app.crossSplitPhase(x)).join(","), "| done cases:", String(jp6.app.crossSplitPhase(mk([4, 4]))), String(jp6.app.crossSplitPhase(mk([4, "error"]))));
  }
  // attribution unit tests (pure): shared intermediate, over-delivery and partial arrival
  const E18 = (n) => (BigInt(n) * 10n ** 18n).toString();
  const parts1 = [{ sym: "BABY", bridgedAmount: E18(100), arrivedAmt: null, arrivedFlag: false }, { sym: "BABY", bridgedAmount: E18(50), arrivedAmt: null, arrivedFlag: false }, { sym: "QOM", bridgedAmount: E18(7), arrivedAmt: null, arrivedFlag: false }];
  jp6.app.attributeSplitArrivals(parts1, { BABY: 160n * 10n ** 18n, QOM: 7n * 10n ** 18n });
  console.log("[V6] attribution over-delivery: p1 exact:", parts1[0].arrivedAmt === E18(100) && parts1[0].arrivedFlag, "| last part takes remainder incl. dust:", parts1[1].arrivedAmt === E18(60) && parts1[1].arrivedFlag, "| other sym independent:", parts1[2].arrivedAmt === E18(7) && parts1[2].arrivedFlag);
  const parts2 = [{ sym: "BABY", bridgedAmount: E18(100), arrivedAmt: null, arrivedFlag: false }, { sym: "BABY", bridgedAmount: E18(50), arrivedAmt: null, arrivedFlag: false }];
  jp6.app.attributeSplitArrivals(parts2, { BABY: 120n * 10n ** 18n });
  console.log("[V6] attribution partial: p1 full+flagged:", parts2[0].arrivedAmt === E18(100) && parts2[0].arrivedFlag, "| p2 partial, not flagged:", parts2[1].arrivedAmt === E18(20) && !parts2[1].arrivedFlag);
  // case B honesty: 10B QOM (Infinite) -> QOM (QL1): the single BABY route must win, no split plan
  const jp6c = loadPage("ja", {});
  jp6c.app.setMode("cross"); jp6c.app.setXSrc("infinite");
  jp6c.els.xFromToken.value = "qom"; jp6c.els.xToToken.value = "native"; jp6c.els.xAmount.value = "10000000000";
  await jp6c.app.onXQuote();
  const xsB = jp6c.app.state.xSplit;
  console.log("[V6-JP caseB] 10B QOM: best single via:", jp6c.app.state.xCandidates.find((c) => c.enabled).pair.sym, "| best split vs single:", xsB && xsB.best ? ((Number(xsB.best.totalOut) / Number(xsB.bestSingle.finalOut) - 1) * 100).toFixed(2) + "%" : null, "| plan (v6.4: BABY-variant split now wins slightly — see v6.4 finding):", !!(xsB && xsB.plan), "| split card shown:", jp6c.els.xCandidates.innerHTML.includes("分割プラン"));
  const netB = jp6c.app.state.xSplitNet;
  console.log("[V6.5-JP caseB] net verdict (gross win, fee loss): shown:", netB && netB.shown, "| convFailed:", netB && netB.convFailed, "| gross gain:", netB && jp6c.app.formatAmount(netB.gain, 18, 2), "QOM | extra fee in dest terms:", netB && jp6c.app.formatAmount(netB.extraFeeDest, 18, 2), "QOM | fee > gain:", !!(netB && netB.extraFeeDest > netB.gain), "| fee-lose note shown:", jp6c.els.xCandidates.innerHTML.includes("手数料引きでは負けます"), "| split card NOT shown:", !jp6c.els.xCandidates.innerHTML.includes("分割プラン"));

  // ---- v6.1: case C (1,000 USDT) — same-intermediate (QOM) path variants in one split plan ----
  const jp61 = loadPage("ja", {});
  jp61.app.state.account = "0x1111111111111111111111111111111111111111";
  jp61.app.setMode("cross"); jp61.app.setXSrc("infinite");
  jp61.els.xFromToken.value = "usdt"; jp61.els.xToToken.value = "native"; jp61.els.xAmount.value = "1000";
  await jp61.app.onXQuote();
  const xsC = jp61.app.state.xSplit;
  const usdtA = jp61.app.tokenById("infinite", "usdt").address.toLowerCase();
  const fishA = jp61.app.tokenById("infinite", "fish").address.toLowerCase();
  const qomA = jp61.app.tokenById("infinite", "qom").address.toLowerCase();
  const isR2Part = (p) => p.cand.pair.sym === "QOM" && Array.isArray(p.cand.leg1Path) && p.cand.leg1Path.length === 3 &&
    p.cand.leg1Path[0].toLowerCase() === usdtA && p.cand.leg1Path[1].toLowerCase() === fishA && p.cand.leg1Path[2].toLowerCase() === qomA;
  console.log("\n[V6.1-JP caseC] plan:", !!(xsC && xsC.plan), "| total:", xsC && xsC.plan && jp61.app.formatAmount(xsC.plan.totalOut, 18, 2), "QOM | >= 1,270B:", !!(xsC && xsC.plan && xsC.plan.totalOut >= 1270n * 10n ** 27n), "| vs single:", xsC && xsC.plan ? ((Number(xsC.plan.totalOut) / Number(xsC.bestSingle.finalOut) - 1) * 100).toFixed(2) + "%" : null);
  console.log("[V6.1-JP caseC] plan includes R2 part (leg1 USDT->FISH->QOM):", !!(xsC && xsC.plan && xsC.plan.parts.some(isR2Part)), "| parts:", xsC && xsC.plan && xsC.plan.parts.map((p) => p.pct + "%:" + p.cand.pair.sym).join(" + "));
  const netC = jp61.app.state.xSplitNet;
  console.log("[V6.5-JP caseC] net verdict: shown:", netC && netC.shown, "| net gain:", netC && jp61.app.formatAmount(netC.netGain, 18, 2), "QOM | netPct:", netC && netC.netPct.toFixed(2) + "%", "| net line on card:", jp61.els.xCandidates.innerHTML.includes("追加のブリッジ代を引いても"));
  if (xsC && xsC.plan) {
    await jp61.app.startXSplitFlow();
    const sfC = jp61.app.state.xflow;
    const qomParts = sfC ? sfC.parts.filter((p) => p.sym === "QOM") : [];
    const distinctLeg1 = new Set(qomParts.map((p) => JSON.stringify((p.leg1Path || []).map((a) => a.toLowerCase()))));
    console.log("[V6.1-JP caseC] split flow: parts:", sfC && sfC.parts.length, "| same-intermediate QOM parts:", qomParts.length, "| distinct leg1 paths among them:", distinctLeg1.size, "| pct sum:", sfC && sfC.parts.reduce((s, p) => s + p.pct, 0), "| amounts sum == amountIn:", !!sfC && sfC.parts.reduce((s, p) => s + BigInt(p.amountIn), 0n).toString() === sfC.amountIn, "| persisted:", (jp61.store["dexagg_xflow_v1"] || "").includes('"kind":"split"'));
    const jp61b = loadPage("ja", jp61.store);
    const rsfC = jp61b.app.loadXFlow();
    console.log("[V6.1-JP caseC reload] restored:", rsfC && rsfC.kind, "| QOM leg1 paths kept distinct:", !!rsfC && JSON.stringify(rsfC.parts.map((p) => p.leg1Path)) === JSON.stringify(sfC.parts.map((p) => p.leg1Path)));
  }
  // same-intermediate phase progression (synthetic flow parts, pure functions):
  // two QOM parts share the intermediate token (leg2 identity) + one BABY part (real leg2).
  const E18s = (n) => (BigInt(n) * 10n ** 18n).toString();
  const sparts = [
    { sym: "QOM", leg2Path: null, step: 0, bridgedAmount: E18s(300), arrivedAmt: null, arrivedFlag: false },
    { sym: "QOM", leg2Path: null, step: 0, bridgedAmount: E18s(200), arrivedAmt: null, arrivedFlag: false },
    { sym: "BABY", leg2Path: ["0xa", "0xb"], step: 0, bridgedAmount: E18s(50), arrivedAmt: null, arrivedFlag: false },
  ];
  const sflow = { kind: "split", parts: sparts };
  const phaseSeq = [jp6.app.crossSplitPhase(sflow)];
  for (const p of sparts) p.step = 1; phaseSeq.push(jp6.app.crossSplitPhase(sflow));
  for (const p of sparts) p.step = 2; phaseSeq.push(jp6.app.crossSplitPhase(sflow));
  // arrivals: QOM over-delivers by 5 (dust), BABY exact -> attribute, then apply
  // checkSplitArrival's transition (flagged: leg2 ? step 3 : step 4)
  jp6.app.attributeSplitArrivals(sparts, { QOM: 505n * 10n ** 18n, BABY: 50n * 10n ** 18n });
  const attrOk = sparts[0].arrivedAmt === E18s(300) && sparts[0].arrivedFlag && sparts[1].arrivedAmt === E18s(205) && sparts[1].arrivedFlag && sparts[2].arrivedAmt === E18s(50) && sparts[2].arrivedFlag;
  for (const p of sparts) if (p.step === 2 && p.arrivedFlag) p.step = p.leg2Path ? 3 : 4;
  phaseSeq.push(jp6.app.crossSplitPhase(sflow));
  sparts[2].step = 4; phaseSeq.push(jp6.app.crossSplitPhase(sflow));
  console.log("[V6.1] same-sym attribution (QOM parts in order, last takes remainder+dust):", attrOk, "| phase progression 1,2,3,4,done:", JSON.stringify(phaseSeq) === JSON.stringify([1, 2, 3, 4, "done"]), "| seq:", phaseSeq.join(","));

  const en6 = loadPage("en", {});
  en6.app.state.account = "0x1111111111111111111111111111111111111111";
  en6.app.setMode("cross"); en6.app.setXSrc("infinite");
  en6.els.xFromToken.value = "usdt"; en6.els.xToToken.value = "native"; en6.els.xAmount.value = "100";
  await en6.app.onXQuote();
  console.log("\n[V6-EN] split plan:", !!(en6.app.state.xSplit && en6.app.state.xSplit.plan), "| card html:", en6.els.xCandidates.innerHTML.includes("Split plan") && en6.els.xCandidates.innerHTML.includes("Start with this split plan"), "| fee line:", en6.els.xCandidates.innerHTML.includes("Total bridge messaging cost"));
  if (en6.app.state.xSplit && en6.app.state.xSplit.plan) {
    await en6.app.startXSplitFlow();
    console.log("[V6-EN] split flow parts:", en6.app.state.xflow.parts.length, "| html has per-part heads:", en6.els.xFlow.innerHTML.includes("Part 1 of"), "| persisted:", (en6.store["dexagg_xflow_v1"] || "").includes('"kind":"split"'));
  }
  // v6.1 EN: case C plan includes the R2 (USDT->FISH->QOM leg1) part too
  const en61 = loadPage("en", {});
  en61.app.setMode("cross"); en61.app.setXSrc("infinite");
  en61.els.xFromToken.value = "usdt"; en61.els.xToToken.value = "native"; en61.els.xAmount.value = "1000";
  await en61.app.onXQuote();
  const xsCE = en61.app.state.xSplit;
  console.log("[V6.1-EN caseC] plan:", !!(xsCE && xsCE.plan), "| includes R2 part:", !!(xsCE && xsCE.plan && xsCE.plan.parts.some(isR2Part)), "| total >= 1,270B:", !!(xsCE && xsCE.plan && xsCE.plan.totalOut >= 1270n * 10n ** 27n));

  // ---- v6.2: 1% refinement ----
  // (a) live case C (jp61 above): refineStats present, plan keeps the v6.1 bar,
  //     parts may carry non-round percentages after refinement.
  console.log("\n[V6.2-JP caseC] refineStats:", JSON.stringify(xsC && xsC.refineStats), "| plan pcts:", xsC && xsC.plan && xsC.plan.parts.map((p) => p.pct).join("/"), "| has non-round pct:", !!(xsC && xsC.plan && xsC.plan.parts.some((p) => p.pct % 10 !== 0)), "| vs 1,300B line:", xsC && xsC.plan ? jp61.app.formatAmount(xsC.plan.totalOut - 1300n * 10n ** 27n, 18, 2) + " QOM" : null);
  console.log("[V6.2-EN caseC] refineStats:", JSON.stringify(xsCE && xsCE.refineStats));
  // (b) synthetic unit test of refineSplitAllocation with stubbed quotes:
  // concave per-route curves with a known interior optimum at ~69/31 (not on
  // the 10% grid). Refinement must strictly improve on the 50/50 start, land
  // on a non-round allocation, and terminate. A third route that is strong
  // at small amounts must enter via the add move when offered.
  {
    const T = 10000;
    const curves = { A: (a) => (3 * a) / (a + 2000), B: (a) => (2 * a) / (a + 500), C: (a) => (5 * a) / (a + 100) };
    const stubScore = async (allocs) => allocs.map((alloc) => {
      let total = 0;
      for (const p of alloc) {
        const amt = Math.floor((T * p.pct) / 100);
        if (amt <= 0) return null;
        total += curves[p.cand.id](amt) * 1e6;
      }
      return { totalOut: total };
    });
    const cA = { id: "A" }, cB = { id: "B" }, cC = { id: "C" };
    const start = [{ cand: cA, pct: 50 }, { cand: cB, pct: 50 }];
    const startScore = (await stubScore([start]))[0];
    const grid7030 = (await stubScore([[{ cand: cA, pct: 70 }, { cand: cB, pct: 30 }]]))[0];
    const r1 = await jp6.app.refineSplitAllocation(start, startScore, stubScore, { addCandidates: [], maxParts: 2, keyOf: (c) => c.id, maxIterations: 150 });
    const pcts1 = Object.fromEntries(r1.alloc.map((p) => [p.cand.id, p.pct]));
    console.log("[V6.2-unit] refine 50/50 ->", JSON.stringify(pcts1), "| improved over start:", r1.score.totalOut > startScore.totalOut, "| >= best 10%-grid point (70/30):", r1.score.totalOut >= grid7030.totalOut, "| non-round pct present:", r1.alloc.some((p) => p.pct % 10 !== 0), "| terminated (iterations):", r1.iterations, "<= 150:", r1.iterations <= 150);
    const r2 = await jp6.app.refineSplitAllocation(start, startScore, stubScore, { addCandidates: [cC], maxParts: 3, keyOf: (c) => c.id, maxIterations: 150 });
    const pcts2 = Object.fromEntries(r2.alloc.map((p) => [p.cand.id, p.pct]));
    console.log("[V6.2-unit] add move: C entered the plan:", (pcts2.C || 0) >= 1, "| pcts:", JSON.stringify(pcts2), "| total beats no-C optimum:", r2.score.totalOut > r1.score.totalOut, "| pct sum:", r2.alloc.reduce((s, p) => s + p.pct, 0));
  }

  // ---- v6.3: language selector + English-default gate ----
  {
    const fs2 = require("fs");
    const gate = fs2.readFileSync(__dirname + "/../docs/index.html", "utf8");
    const jaHtml = fs2.readFileSync(__dirname + "/../docs/ja.html", "utf8");
    const enHtml = fs2.readFileSync(__dirname + "/../docs/en.html", "utf8");
    console.log("\n[V6.3] gate page: reads dexagg_lang and redirects (ja only when saved, else en):", gate.includes("dexagg_lang") && gate.includes('"ja.html"') && gate.includes('"en.html"') && gate.includes('lang === "ja"'), "| fallback/noscript links to both pages:", gate.includes('href="en.html"') && gate.includes('href="ja.html"'));
    console.log("[V6.3] ja.html is the JP app page (lang=ja, has langSel, loads app.js):", jaHtml.includes('lang="ja"') && jaHtml.includes('id="langSel"') && jaHtml.includes('src="app.js"'));
    console.log("[V6.3] en.html is the EN app page (lang=en, has langSel, loads app.js):", enHtml.includes('lang="en"') && enHtml.includes('id="langSel"') && enHtml.includes('src="app.js"'));
    const lt = jp6.app.langTargetFor;
    console.log("[V6.3] langTargetFor: en from ja:", lt("en", "ja") === "en.html", "| ja from en:", lt("ja", "en") === "ja.html", "| same language is a no-op:", lt("ja", "ja") === null && lt("en", "en") === null);
    const jpl = loadPage("ja", {});
    const initValJ = jpl.els.langSel.value;
    const handlersJ = jpl.els.langSel._handlers.change || [];
    jpl.els.langSel.value = "en";
    if (handlersJ.length) handlersJ[0]();
    console.log("[V6.3] JP page selector: initial value = page lang:", initValJ === "ja", "| change handler registered:", handlersJ.length > 0, "| picking English saved dexagg_lang:", jpl.store["dexagg_lang"]);
    const enl = loadPage("en", {});
    const initValE = enl.els.langSel.value;
    const handlersE = enl.els.langSel._handlers.change || [];
    enl.els.langSel.value = "ja";
    if (handlersE.length) handlersE[0]();
    console.log("[V6.3] EN page selector: initial value = page lang:", initValE === "en", "| change handler registered:", handlersE.length > 0, "| picking Japanese saved dexagg_lang:", enl.store["dexagg_lang"]);
  }

  // ---- v6.4: combined leg-2 quoting (shared intermediate) ----
  {
    const P = (sym, leg2Path, leg1Out) => ({ cand: { pair: { sym }, leg2Path }, leg1Out });
    const gParts = [P("QOM", ["0xw", "0xc"], 300n), P("QOM", ["0xw", "0xc"], 200n), P("BABY", ["0xb", "0xw", "0xc"], 50n), P("QOM", null, 7n), P("QOM", ["0xw", "0xq"], 11n)];
    const groups = jp6.app.combineLeg2Groups(gParts);
    const gQom = groups.find((g) => g.key.startsWith("QOM|"));
    const gBaby = groups.find((g) => g.key.startsWith("BABY|"));
    const gQom2 = groups.filter((g) => g.key.startsWith("QOM|"))[1];
    console.log("\n[V6.4-unit] grouping: 2 leg2 groups + separate path-variant group:", groups.length === 3, "| QOM same-path group sums arrivals (500) in order:", !!gQom && gQom.totalIn === 500n && JSON.stringify(gQom.idxs) === "[0,1]", "| BABY group:", !!gBaby && gBaby.totalIn === 50n, "| different leg2Path is a different group:", !!gQom2 && gQom2.totalIn === 11n);
    const sh1 = jp6.app.distributeCombinedOut(1000n, [300n, 200n]);
    const sh2 = jp6.app.distributeCombinedOut(101n, [1n, 1n]);
    const sh3 = jp6.app.distributeCombinedOut(100n, [1n, 2n]);
    console.log("[V6.4-unit] distribution pro-rata:", JSON.stringify(sh1.map(String)) === '["600","400"]', "| dust to largest part:", JSON.stringify(sh2.map(String)) === '["51","50"]', "| floors + dust to largest:", JSON.stringify(sh3.map(String)) === '["33","67"]', "| shares always sum to the combined quote:", sh1.reduce((s, x) => s + x, 0n) === 1000n && sh2.reduce((s, x) => s + x, 0n) === 101n);
  }
  // live case D: destination qCAW — the R2 (USDT->FISH->QOM leg1) part must be
  // allowed into the split plan now that shared leg 2 is combined, not banned.
  const jp64 = loadPage("ja", {});
  jp64.app.state.account = "0x1111111111111111111111111111111111111111";
  jp64.app.setMode("cross"); jp64.app.setXSrc("infinite");
  jp64.els.xFromToken.value = "usdt"; jp64.els.xToToken.value = "qcaw"; jp64.els.xAmount.value = "1000";
  await jp64.app.onXQuote();
  const xsD = jp64.app.state.xSplit;
  const usdtA2 = jp64.app.tokenById("infinite", "usdt").address.toLowerCase();
  const fishA2 = jp64.app.tokenById("infinite", "fish").address.toLowerCase();
  const qomA2 = jp64.app.tokenById("infinite", "qom").address.toLowerCase();
  const isR2PartD = (p) => p.cand.pair.sym === "QOM" && Array.isArray(p.cand.leg1Path) && p.cand.leg1Path.length === 3 &&
    p.cand.leg1Path[0].toLowerCase() === usdtA2 && p.cand.leg1Path[1].toLowerCase() === fishA2 && p.cand.leg1Path[2].toLowerCase() === qomA2;
  console.log("[V6.4-JP caseD] dest qCAW: plan:", !!(xsD && xsD.plan), "| total:", xsD && xsD.plan && jp64.app.formatAmount(xsD.plan.totalOut, 18, 2), "qCAW | includes R2 part (leg1 USDT->FISH->QOM):", !!(xsD && xsD.plan && xsD.plan.parts.some(isR2PartD)), "| parts:", xsD && xsD.plan && xsD.plan.parts.map((p) => p.pct + "%:" + p.cand.pair.sym).join(" + "));
  if (xsD && xsD.plan) {
    await jp64.app.startXSplitFlow();
    const sfD = jp64.app.state.xflow;
    console.log("[V6.4-JP caseD] split flow from refined plan: parts:", sfD && sfD.parts.length, "| pct sum:", sfD && sfD.parts.reduce((s, p) => s + p.pct, 0), "| amounts sum == amountIn:", !!sfD && sfD.parts.reduce((s, p) => s + BigInt(p.amountIn), 0n).toString() === sfD.amountIn);
  }
  const en64 = loadPage("en", {});
  en64.app.setMode("cross"); en64.app.setXSrc("infinite");
  en64.els.xFromToken.value = "usdt"; en64.els.xToToken.value = "qcaw"; en64.els.xAmount.value = "1000";
  await en64.app.onXQuote();
  const xsDE = en64.app.state.xSplit;
  console.log("[V6.4-EN caseD] plan:", !!(xsDE && xsDE.plan), "| includes R2 part:", !!(xsDE && xsDE.plan && xsDE.plan.parts.some(isR2PartD)));
  const netD = jp64.app.state.xSplitNet, netDE = en64.app.state.xSplitNet;
  console.log("[V6.5-JP caseD] net verdict: shown:", netD && netD.shown, "| net gain:", netD && jp64.app.formatAmount(netD.netGain, 18, 2), "qCAW | extra fee in dest terms:", netD && jp64.app.formatAmount(netD.extraFeeDest, 18, 2), "qCAW");
  console.log("[V6.5-EN caseD] net verdict: shown:", netDE && netDE.shown, "| net line on card (EN):", en64.els.xCandidates.innerHTML.includes("After the extra bridge cost"));

  // ---- v7: aggregator storage / deploy tx / split calldata round-trip ----
  const fs7 = require("fs"), path7 = require("path");
  const artBc = JSON.parse(fs7.readFileSync(path7.join(__dirname, "..", "contracts", "SplitSwap.json"), "utf8")).bytecode;
  const jp7 = loadPage("ja", {});
  const a7 = jp7.app;
  const acct7 = "0x1111111111111111111111111111111111111111";
  console.log("\n[V7-JP] fresh page: splitExecutable(infinite):", a7.splitExecutable(a7.CHAINS.infinite), "| aggArea deploy btn:", jp7.els.aggArea.innerHTML.includes("アグリゲーターをデプロイ"), "| effectiveAggregator:", a7.effectiveAggregator(a7.CHAINS.infinite), "| source:", a7.aggregatorSource(a7.CHAINS.infinite));
  const dtx = a7.buildDeployTx(a7.CHAINS.infinite);
  const dtx2 = a7.buildDeployTx(a7.CHAINS.ql1);
  console.log("[V7] deploy tx: to null:", dtx.to === null, "| value 0:", dtx.value === 0n, "| data starts with SPLIT_BYTECODE:", dtx.data.startsWith(a7.SPLIT_BYTECODE), "| ctor arg == infinite router:", ("0x" + dtx.data.slice(-40)) === a7.CHAINS.infinite.router.toLowerCase(), "| ql1 ctor arg == ql1 router:", ("0x" + dtx2.data.slice(-40)) === a7.CHAINS.ql1.router.toLowerCase(), "| embedded bytecode == contracts artifact:", a7.SPLIT_BYTECODE === artBc);
  const FAKE_AGG = "0x3333333333333333333333333333333333333333";
  a7.setStoredAggregator("infinite", FAKE_AGG);
  console.log("[V7] stored: splitExecutable:", a7.splitExecutable(a7.CHAINS.infinite), "| source:", a7.aggregatorSource(a7.CHAINS.infinite), "| storedAggregator:", a7.storedAggregator("infinite"));
  a7.renderAggArea();
  console.log("[V7-JP] aggArea in-use: addr shown:", jp7.els.aggArea.innerHTML.includes("0x3333"), "| clear btn:", jp7.els.aggArea.innerHTML.includes("使うのをやめる"), "| explorer link:", jp7.els.aggArea.innerHTML.includes("/address/" + FAKE_AGG));
  const usdt7 = a7.tokenById("infinite", "usdt"), fish7 = a7.tokenById("infinite", "fish"), nat7 = a7.tokenById("infinite", "native");
  const plan7 = { legs: [
    { route: { path: [usdt7.address, fish7.address], hops: 1 }, pct: 60, amountIn: 600n * 10n ** 6n, amountOut: 5000n * 10n ** 18n },
    { route: { path: [usdt7.address, nat7.address, fish7.address], hops: 2 }, pct: 40, amountIn: 400n * 10n ** 6n, amountOut: 3400n * 10n ** 18n },
  ], totalOut: 8400n * 10n ** 18n };
  const txTT = a7.buildSplitTx(a7.CHAINS.infinite, usdt7, fish7, plan7, acct7, 1, 1700000000);
  const decTT = a7.decodeSplitTxData(txTT.data);
  const legsOk7 = !!decTT && decTT.legs.every((l, i) => l.amountIn === plan7.legs[i].amountIn && l.amountOutMin === a7.applySlippageBps(plan7.legs[i].amountOut, 1) && l.path.join() === plan7.legs[i].route.path.map((x) => x.toLowerCase()).join());
  console.log("[V7] swapSplit round-trip: to == stored agg:", txTT.to === FAKE_AGG, "| fn:", decTT && decTT.functionName, "| legs:", decTT && decTT.legs.length, "| legs round-trip (amountIn/minOut/path):", legsOk7, "| total min matches:", !!decTT && decTT.amountOutMinTotal === a7.applySlippageBps(plan7.totalOut, 1), "| tokenIn:", decTT && decTT.tokenIn === usdt7.address.toLowerCase(), "| tokenOut:", decTT && decTT.tokenOut === fish7.address.toLowerCase(), "| value:", txTT.value === 0n);
  const txTN = a7.buildSplitTx(a7.CHAINS.infinite, usdt7, nat7, plan7, acct7, 0.5, 1700000000);
  const decTN = a7.decodeSplitTxData(txTN.data);
  console.log("[V7] swapSplitToNative round-trip: fn:", decTN && decTN.functionName, "| legs:", decTN && decTN.legs.length, "| tokenIn:", !!decTN && decTN.tokenIn === usdt7.address.toLowerCase(), "| total min:", !!decTN && decTN.amountOutMinTotal === a7.applySlippageBps(plan7.totalOut, 0.5), "| value:", txTN.value === 0n);
  const planFN = { legs: [{ route: { path: [nat7.address, fish7.address], hops: 1 }, pct: 100, amountIn: 10n * 10n ** 18n, amountOut: 900n * 10n ** 18n }], totalOut: 900n * 10n ** 18n };
  const txFN = a7.buildSplitTx(a7.CHAINS.infinite, nat7, fish7, planFN, acct7, 1, 1700000000);
  const decFN = a7.decodeSplitTxData(txFN.data);
  console.log("[V7] swapSplitFromNative round-trip: fn:", decFN && decFN.functionName, "| value == sum of legs:", txFN.value === 10n * 10n ** 18n, "| tokenOut:", !!decFN && decFN.tokenOut === fish7.address.toLowerCase(), "| leg minOut:", !!decFN && decFN.legs[0].amountOutMin === a7.applySlippageBps(planFN.legs[0].amountOut, 1));
  jp7.app.state.account = acct7;
  jp7.els.fromToken.value = "usdt"; jp7.els.toToken.value = "fish"; jp7.els.amountIn.value = "500";
  await a7.onQuote();
  const se7 = a7.state.splitEval;
  if (se7 && se7.plan) {
    a7.selectSplit();
    console.log("[V7-JP] split plan + stored agg: selectedPlan:", JSON.stringify(a7.state.selectedPlan), "| swapBtn enabled:", jp7.els.swapBtn.disabled === false, "| swapBtn label:", jp7.els.swapBtn.textContent, "| splitNote executable:", jp7.els.splitNote.textContent.includes("そのまま実行できます"));
  } else console.log("[V7-JP] note: no same-chain split plan at 500 USDT->FISH this run (pool state)");
  a7.setStoredAggregator("infinite", null);
  a7.renderAggArea();
  console.log("[V7] cleared: splitExecutable:", a7.splitExecutable(a7.CHAINS.infinite), "| aggArea deploy btn back:", jp7.els.aggArea.innerHTML.includes("アグリゲーターをデプロイ"));
  const en7 = loadPage("en", {});
  console.log("[V7-EN] aggArea: title:", en7.els.aggArea.innerHTML.includes("Split contract"), "| deploy btn:", en7.els.aggArea.innerHTML.includes("Deploy the aggregator"));

  console.log("\nHARNESS DONE");
})().catch((e) => { console.error("HARNESS FAILED:", e); process.exit(1); });
