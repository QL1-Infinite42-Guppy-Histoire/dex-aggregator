"use strict";
/* 接続解除 UI (QOM DEX と仕様統一、2026-11-25) のプローブ。実送信なし
   (ウォレットはスタブ、残高 RPC は fetch スタブで 0 応答):
   - 接続済みで接続ボタンを再タップすると再接続フローは回らず、
     ダイアログが開いてアドレス全文が出る
   - ✕ で閉じても接続は維持される
   - 解除で wallet_revokePermissions が [{eth_accounts:{}}] で呼ばれ、
     ローカル状態が未接続表示に戻る (accountLine / status / swapBtn)
   - revoke が accountsChanged([]) を発火してもエラーにならない
   - revoke 非対応 (例外を投げる) ウォレットでもローカル切断が完了する
   - 切断は保存済みフロー (dexagg_xflow_v1) を変更しない
   - 再読み込み相当 (新規ロード) では自動復帰しない (本サイトには
     ロード時の自動接続経路が無いことの確認を含む)
   - 切断後に再接続できる / connectBtnMain からもダイアログが開く
   - JA ページではダイアログ文言が日本語になる / STR 日英キー数一致 */
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
const countCalls = (eth, method) => eth.calls.filter((c) => c && c.method === method).length;

(async () => {
  /* ================= STR パリティ ================= */
  {
    const probeApp = require("../docs/app.js");
    const en = Object.keys(probeApp.STR.en), ja = Object.keys(probeApp.STR.ja);
    assert.strictEqual(en.length, ja.length, "STR parity: EN/JA key counts equal");
    for (const k of ["connectedTitle", "disconnectBtn", "statusDisconnected"]) {
      assert.ok(probeApp.STR.en[k] && probeApp.STR.ja[k], "STR: new key present in both tables: " + k);
    }
    console.log("STR PASS: parity " + en.length + "/" + ja.length + ", 3 new keys in both tables");
  }

  /* ================= EN: 接続 → ダイアログ → 解除 ================= */
  console.log("=== EN: connect / dialog / disconnect ===");
  {
    const eth = makeEth({ accounts: [ACCT_A] });
    const preset = { dexagg_xflow_v1: JSON.stringify({ v: 1, account: ACCT_B, note: "sentinel" }) };
    const { app, els, store } = loadPage("en", eth, preset);
    const flowAfterInit = store.dexagg_xflow_v1;

    await els.connectBtn.click();
    assert.strictEqual(app.state.account, ACCT_A, "1: connected account recorded");
    assert.ok(els.accountLine.textContent.includes("Connected:"), "1: accountLine shows connected state");
    assert.strictEqual(countCalls(eth, "eth_requestAccounts"), 1, "1: one account request");
    console.log("  1 PASS: connect works, connected state rendered");

    await els.connectBtn.click(); await flush();
    assert.strictEqual(els.connDlg.open, true, "2: dialog opens on second tap");
    assert.strictEqual(els.connAddr.textContent, ACCT_A, "2: FULL address shown in the dialog");
    assert.strictEqual(els.connTitle.textContent, "Wallet connected", "2: dialog title (EN)");
    assert.strictEqual(els.disconnectBtn.textContent, "Disconnect", "2: disconnect label (EN)");
    assert.strictEqual(countCalls(eth, "eth_requestAccounts"), 1, "2: connect flow NOT re-run");
    console.log("  2 PASS: second tap opens the dialog with the full address, no re-connect");

    await els.connClose.click();
    assert.strictEqual(els.connDlg.open, false, "3: close button closes the dialog");
    assert.strictEqual(app.state.account, ACCT_A, "3: still connected after close");
    console.log("  3 PASS: close affordance works, connection kept");

    await els.connectBtn.click(); await flush();
    assert.strictEqual(els.connDlg.open, true, "4: dialog reopens");
    await els.disconnectBtn.click();
    const revoke = eth.calls.find((c) => c && c.method === "wallet_revokePermissions");
    assert.ok(revoke, "4: wallet_revokePermissions was requested");
    assert.strictEqual(JSON.stringify(revoke.params), JSON.stringify([{ eth_accounts: {} }]), "4: revoke params are [{eth_accounts:{}}]");
    assert.strictEqual(app.state.account, null, "4: local account cleared (accountsChanged([]) during revoke caused no error)");
    assert.strictEqual(els.accountLine.textContent, "Not connected (quotes work without a wallet)", "4: accountLine back to the not-connected text");
    assert.strictEqual(els.status.textContent, "Wallet disconnected", "4: status confirms the disconnect");
    assert.strictEqual(els.connDlg.open, false, "4: dialog closed by disconnect");
    assert.strictEqual(els.swapBtn.disabled, true, "4: swap button disabled again");
    assert.strictEqual(store.dexagg_xflow_v1, flowAfterInit, "4: saved flow untouched by disconnect");
    console.log("  4 PASS: revoke requested with exact params, UI back to disconnected, saved flow untouched");

    /* accountsChanged の単独発火でも壊れない (空配列 / 別アカウント) */
    eth.listeners.accountsChanged([]);
    assert.strictEqual(app.state.account, null, "5: accountsChanged([]) keeps the clean disconnected state");
    eth.listeners.accountsChanged([ACCT_B]);
    assert.strictEqual(app.state.account, ACCT_B, "5: accountsChanged([addr]) still tracks the wallet");
    eth.listeners.accountsChanged([]);
    assert.strictEqual(app.state.account, null, "5: accountsChanged([]) disconnects cleanly again");
    console.log("  5 PASS: accountsChanged subscription intact both ways");

    /* 再読み込み相当: 新規ロードでは自動復帰しない */
    const re = loadPage("en", eth, store);
    assert.strictEqual(re.app.state.account, null, "6: fresh load does not restore the connection (revoked)");
    const ethStillAuthed = makeEth({ accounts: [ACCT_A] });
    const re2 = loadPage("en", ethStillAuthed, store);
    assert.strictEqual(re2.app.state.account, null, "6: fresh load never auto-connects, even with an authorised wallet");
    console.log("  6 PASS: no silent restore on reload");

    /* 再接続できる */
    await re.els.connectBtn.click();
    assert.strictEqual(re.app.state.account, null, "7: revoked wallet returns no accounts -> stays disconnected");
    const ethBack = makeEth({ accounts: [ACCT_A] });
    const re3 = loadPage("en", ethBack, store);
    await re3.els.connectBtn.click();
    assert.strictEqual(re3.app.state.account, ACCT_A, "7: explicit tap reconnects normally");
    console.log("  7 PASS: reconnect works on an explicit tap");

    /* connectBtnMain からも同じダイアログが開く */
    await re3.els.connectBtnMain.click(); await flush();
    assert.strictEqual(re3.els.connDlg.open, true, "8: main CTA opens the same dialog while connected");
    assert.strictEqual(re3.els.connAddr.textContent, ACCT_A, "8: full address shown via the main CTA path");
    console.log("  8 PASS: connectBtnMain forwards to the same dialog");
  }

  /* ================= revoke 非対応ウォレット ================= */
  console.log("=== Fallback: wallet without revoke support ===");
  {
    const eth = makeEth({ accounts: [ACCT_A], revoke: "throw" });
    const { app, els } = loadPage("en", eth);
    await els.connectBtn.click();
    assert.strictEqual(app.state.account, ACCT_A, "9: connected");
    await els.connectBtn.click(); await flush();
    assert.strictEqual(els.connDlg.open, true, "9: dialog open");
    await els.disconnectBtn.click(); /* revoke が throw してもここで例外が出ないこと */
    assert.strictEqual(countCalls(eth, "wallet_revokePermissions"), 1, "9: revoke was attempted");
    assert.strictEqual(app.state.account, null, "9: local disconnect completed despite the revoke failure");
    assert.strictEqual(els.accountLine.textContent, "Not connected (quotes work without a wallet)", "9: UI back to disconnected");
    assert.strictEqual(els.connDlg.open, false, "9: dialog closed");
    console.log("  9 PASS: revoke failure falls back to local-only disconnect");
  }

  /* ================= JA ページ ================= */
  console.log("=== JA: dialog strings ===");
  {
    const eth = makeEth({ accounts: [ACCT_A] });
    const { app, els } = loadPage("ja", eth);
    await els.connectBtn.click();
    await els.connectBtn.click(); await flush();
    assert.strictEqual(els.connDlg.open, true, "10: dialog opens (JA)");
    assert.strictEqual(els.connTitle.textContent, "ウォレット接続中", "10: dialog title (JA)");
    assert.strictEqual(els.disconnectBtn.textContent, "接続を解除", "10: disconnect label (JA)");
    assert.strictEqual(els.connAddr.textContent, ACCT_A, "10: full address (JA)");
    await els.disconnectBtn.click();
    assert.strictEqual(app.state.account, null, "10: disconnected (JA)");
    assert.strictEqual(els.accountLine.textContent, "未接続（見積もりだけなら接続なしで使えます）", "10: accountLine not-connected text (JA)");
    assert.strictEqual(els.status.textContent, "ウォレットの接続を解除しました", "10: status (JA)");
    console.log("  10 PASS: JA dialog + disconnect strings");
  }

  /* ================= 常時表示の接続ボタン (2026-11-25) ================= */
  console.log("=== Always-visible connect button ===");
  {
    /* 静的確認: 両ページの接続ボタンは hidden/disabled 属性なしで常時描画 */
    for (const [name, file] of [["EN", "../docs/en.html"], ["JA", "../docs/ja.html"]]) {
      const html = fs.readFileSync(__dirname + "/" + file, "utf8");
      for (const id of ["connectBtn", "connectBtnMain"]) {
        const m = html.match(new RegExp('<button id="' + id + '"[^>]*>'));
        assert.ok(m, name + ": " + id + " present in static HTML");
        assert.ok(!/hidden|disabled/.test(m[0]), name + ": " + id + " is not hidden/disabled in markup");
      }
    }
    console.log("  11a PASS: both connect buttons are static, never hidden/disabled in markup");

    /* (a) プロバイダなしでロード → ボタン有効、クリックで案内、例外なし */
    const noProv = loadPage("en", null);
    assert.strictEqual(noProv.els.connectBtn.disabled, false, "11b: header connect enabled without a provider");
    assert.strictEqual(noProv.els.connectBtnMain.disabled, false, "11b: main connect enabled without a provider");
    await noProv.els.connectBtn.click();
    assert.strictEqual(noProv.els.status.textContent, "MetaMask not found. Open this page in a browser with MetaMask (or a compatible wallet)", "11b: no-wallet guidance shown as status, got: " + noProv.els.status.textContent);
    assert.strictEqual(noProv.app.state.account, null, "11b: still disconnected");
    assert.strictEqual(noProv.els.connectBtn.disabled, false, "11b: button still usable after the guidance");
    await noProv.els.connectBtnMain.click(); await flush();
    assert.ok(noProv.els.status.textContent.includes("MetaMask not found"), "11b: main CTA shows the same guidance");
    /* クロスモードでは見えている側 (xStatus) にも案内が出る */
    noProv.app.setMode("cross");
    await noProv.els.connectBtn.click();
    assert.strictEqual(noProv.els.xStatus.textContent, "MetaMask not found. Open this page in a browser with MetaMask (or a compatible wallet)", "11b: guidance mirrored to the visible cross-mode status");
    console.log("  11b PASS: no provider at load -> buttons live, click shows guidance (both modes), no exception");

    const noProvJa = loadPage("ja", null);
    await noProvJa.els.connectBtn.click();
    assert.strictEqual(noProvJa.els.status.textContent, "MetaMaskが見つかりません。MetaMask（または対応ウォレット）を入れたブラウザで開いてください", "11c: guidance shown (JA)");
    console.log("  11c PASS: no-provider guidance (JA)");

    /* (b) ロード後にプロバイダが注入されたら、クリックで接続できる */
    const late = loadPage("en", null);
    assert.strictEqual(late.app.state.account, null, "12: starts disconnected");
    late.win.ethereum = makeEth({ accounts: [ACCT_A] });
    await late.els.connectBtn.click();
    assert.strictEqual(late.app.state.account, ACCT_A, "12: late-injected provider connects at click time");
    assert.ok(late.els.accountLine.textContent.includes("Connected:"), "12: connected state rendered");
    /* 接続後は従来どおり再タップでダイアログが開く */
    await late.els.connectBtn.click(); await flush();
    assert.strictEqual(late.els.connDlg.open, true, "12: disconnect dialog still opens after a late-injected connect");
    console.log("  12 PASS: provider injected after load -> click connects, dialog logic intact");

    /* (c) プロバイダありでロードした場合は従来どおり */
    const withProv = loadPage("en", makeEth({ accounts: [ACCT_A] }));
    assert.strictEqual(withProv.els.connectBtn.disabled, false, "13: header connect enabled with a provider");
    assert.strictEqual(withProv.els.connectBtnMain.disabled, false, "13: main connect enabled with a provider");
    await withProv.els.connectBtn.click();
    assert.strictEqual(withProv.app.state.account, ACCT_A, "13: click connects as before");
    console.log("  13 PASS: provider at load -> unchanged behaviour");
  }

  /* ================= チェーンマーク (2026-11-25) ================= */
  console.log("=== Chain marks ===");
  {
    for (const [name, file] of [["EN", "../docs/en.html"], ["JA", "../docs/ja.html"]]) {
      const html = fs.readFileSync(__dirname + "/" + file, "utf8");
      assert.strictEqual((html.match(/img\/chain-42\.jpg/g) || []).length, 4, name + ": 42 mark in chain switcher x2 + cross source + destination");
      assert.strictEqual((html.match(/img\/chain-ql1\.jpg/g) || []).length, 2, name + ": QL1 mark in chain switcher + cross source");
      assert.ok(html.includes('id="xDstMark"'), name + ": destination mark element present");
    }
    console.log("  14a PASS: both pages reference the marks at the switcher / cross source / destination spots");

    const { app, els } = loadPage("en", makeEth({ accounts: [ACCT_A] }));
    app.setXSrc("infinite");
    assert.strictEqual(els.xDstMark.src, "img/chain-ql1.jpg", "14b: destination mark follows the label (QL1)");
    assert.strictEqual(els.xDstMark.className, "chain-mark", "14b: QL1 mark uses the round frame");
    app.setXSrc("ql1");
    assert.strictEqual(els.xDstMark.src, "img/chain-42.jpg", "14b: destination mark follows the label (42 Chain)");
    assert.strictEqual(els.xDstMark.className, "chain-mark sq", "14b: 42 mark uses the rounded-square frame");
    console.log("  14b PASS: destination mark swaps with the destination chain");

    app.state.arbRows = [{ sym: "QOM", srcKey: "ql1", dstKey: "infinite", ok: false, reason: " (stub)", gainSinglePct: 0, gainRtPct: 0 }];
    app.state.arbStartRaw = 1000n;
    app.renderArbBoard();
    assert.ok(els.arbBoard.innerHTML.includes('src="img/chain-ql1.jpg"') && els.arbBoard.innerHTML.includes('src="img/chain-42.jpg"'), "14c: arb card shows both direction marks");
    console.log("  14c PASS: arbitrage board cards carry the source/destination marks");
  }

  console.log("DISCONNECT PROBE: ALL PASS");
})().catch((e) => { console.error("FAIL:", e && e.stack ? e.stack : e); process.exit(1); });
