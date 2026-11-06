"use strict";
/* Bridge reality sampling step 2:
   - For every pair: take up to 2 recent sends per direction, extract Hyperlane messageId
     from the receipt, and ask the DESTINATION mailbox delivered(messageId).
   - Live BridgeRouter quotes (token(), paused, quoteNative(766), quoteBridge).
   - Delivery timing for QOM both directions via recipient token-transfer timestamps. */
const { keccak_256 } = require('/home/hatch/workspace/qom-staking/node_modules/@noble/hashes/sha3.js');
const H = (s) => '0x' + Buffer.from(keccak_256(Buffer.from(s))).toString('hex');
const sel = (s) => H(s).slice(0, 10);
const TOPIC_DISPATCHID = H("DispatchId(bytes32)");
const TOPIC_BRIDGEINIT = H("BridgeInitiated(bytes32,address,uint32,bytes32,uint256,uint256,uint256)");
const QL1_RPC = "https://evm-rpc-ql1.mschihuahua.org", INF_RPC = "https://evm-rpc.infinitedrive.xyz";
const QL1_MAILBOX = "0x2f136baa37eb5711483d295944eeda01c4142da0", INF_MAILBOX = "0xac70cdd7f2b712aef7a20661e0c2e96e1da1d63e";
const PAIRS = [
  { symbol: "QOM",    br: "0x049a78fe311cf1c23f09cdd4f12420ffc917c8db", ql1R: "0x30da1e7c8de5fa75b593002e0b2d2910ffcadcb6", infToken: "0x53465cbbba5b14f5dc00794330f0f4afb30eaa1d", ql1Token: "0xa26dfbf98dd1a32fae56a3d2b2d60a8a41b0bdf0" },
  { symbol: "BABY",   br: "0x4aba9dbe8a990c19501c1c4c3e677f775006d2e2", ql1R: "0x8ff9452f309159828903d2d6cCa58CcCb2b5Cd16", infToken: "0x77479226c103cc3c142faff6691bc7f849ce9c92", ql1Token: "0x4667fc0a4b996e0f997313a49de48036b584ef22" },
  { symbol: "CAW",    br: "0x82ba5d61a70677f7f53a9894c63dfb61fd8bcb65", ql1R: "0xd14cf03d3753d80a1f6fb818aa1c728d5c36b3bf", infToken: "0xce8aee7148daa8943453239c42b7b93f984a49f0", ql1Token: "0xd2140e16adf37194036865e90bbca1139b739d0d" },
  { symbol: "FATHER", br: "0x056c116c09acb788d038e7dDc167249C26493d6e", ql1R: "0x54718de5e064dcd1181b7847591c5864434ed92e", infToken: "0x8981f00e92f31a87af12f980383d2217706258e7", ql1Token: "0x2860ec7c34b29f3d2b43788c9a5f0de051f799bb" },
  { symbol: "HAWK",   br: "0x0d198200dc673e96217ddeA9560d26Ae0d092074", ql1R: "0x916fb1a761d0db8888c3f79d6c614c9ffF73b657".replace("F73","f73"), infToken: "0x4e3e79981a64d5678e2e70fd7b4b9550c2b41db2", ql1Token: "0xbc85f14059d60458b614052b4a84734e463878cc" },
  { symbol: "KET",    br: "0x3bc94e9f417561ca37559e07dfc65496fcE94557", ql1R: "0x59d6e50f5b0559a088e3eaac21e520be18453704", infToken: "0xb749d42e6004db590b2f04f32b87485402a061e2", ql1Token: "0x034c1fe794ab9d30e27e1ce0d89a4591fc9f1fb4" },
  { symbol: "O",      br: "0xcb893a7e5f2932531f6e04c0fc3b17ac4884475f", ql1R: "0x488b1f39aa01196ec8a14891bafFEe6630155A61", infToken: "0xf4c14c0322e361f35eb9465c992fb1c21c91c156", ql1Token: "0x6c39b68a28ba90f4eb80032ec0eb32ad81cbbed4" },
  { symbol: "OSAK",   br: "0xa2093426c03ba6F0f6049532b6f13F1e36566358", ql1R: "0xe3a35d9f4ef7eacD5bb47164Ee8d7bff75C2cF6B", infToken: "0x404f3a213ff6c5d654f4e95e6a7ed098b1c3d3b3", ql1Token: "0x5b6af20880a583128170d8c1fc319889ff405a5a" },
];
let rpcId = 0;
async function rpc(url, method, params) { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }) }); const j = await r.json(); if (j.error) throw new Error(method + " " + (j.error.message || "")); return j.result; }
async function bsTxs(base, addr, pages) {
  let url = `${base}/api/v2/addresses/${addr}/transactions`; const items = [];
  for (let p = 0; p < pages; p++) { const r = await fetch(url); if (!r.ok) throw new Error("bs " + r.status); const j = await r.json(); items.push(...(j.items || [])); if (!j.next_page_params) break; url = `${base}/api/v2/addresses/${addr}/transactions?` + new URLSearchParams(Object.entries(j.next_page_params).map(([k, v]) => [k, String(v)])); }
  return items;
}
async function delivered(dstRpc, mailbox, msgId) {
  const r = await rpc(dstRpc, "eth_call", [{ to: mailbox, data: sel("delivered(bytes32)") + msgId.replace("0x", "") }, "latest"]);
  return BigInt(r) === 1n;
}
function msgIdFromReceipt(rc, topicWanted) {
  for (const l of rc.logs) if (l.topics[0] === topicWanted && l.topics.length > 1) return l.topics[1];
  return null;
}
(async () => {
  const out = { sampledAt: new Date().toISOString(), pairs: {} };
  for (const p of PAIRS) {
    const rec = { ql1ToInf: { sendsSampled: 0, deliveredTrue: 0, examples: [] }, infToQl1: { sendsSampled: 0, deliveredTrue: 0, examples: [] }, router: {} };
    // QL1 -> INF sends
    try {
      const items = (await bsTxs("https://scan.qom.network", p.ql1R, 1)).filter((x) => x.method === "transferRemote" && x.status === "ok").slice(0, 2);
      for (const it of items) {
        const rc = await rpc(QL1_RPC, "eth_getTransactionReceipt", [it.hash]);
        const mid = msgIdFromReceipt(rc, TOPIC_DISPATCHID);
        const d = mid ? await delivered(INF_RPC, INF_MAILBOX, mid) : null;
        rec.ql1ToInf.sendsSampled++; if (d) rec.ql1ToInf.deliveredTrue++;
        rec.ql1ToInf.examples.push({ sendTx: it.hash, at: it.timestamp, valueWei: it.value, messageId: mid, delivered: d });
      }
    } catch (e) { rec.ql1ToInf.error = e.message; }
    // INF -> QL1 sends via BridgeRouter
    try {
      const items = (await bsTxs("https://scan.infinitedrive.xyz", p.br, 2)).filter((x) => x.method === "transferRemote" && x.status === "ok").slice(0, 2);
      for (const it of items) {
        const rc = await rpc(INF_RPC, "eth_getTransactionReceipt", [it.hash]);
        const mid = msgIdFromReceipt(rc, TOPIC_BRIDGEINIT);
        const d = mid ? await delivered(QL1_RPC, QL1_MAILBOX, mid) : null;
        rec.infToQl1.sendsSampled++; if (d) rec.infToQl1.deliveredTrue++;
        rec.infToQl1.examples.push({ sendTx: it.hash, at: it.timestamp, valueWei: it.value, messageId: mid, delivered: d });
      }
    } catch (e) { rec.infToQl1.error = e.message; }
    // BridgeRouter live state
    try {
      const token = await rpc(INF_RPC, "eth_call", [{ to: p.br, data: sel("token()") }, "latest"]);
      const paused = await rpc(INF_RPC, "eth_call", [{ to: p.br, data: sel("paused()") }, "latest"]);
      const qn = await rpc(INF_RPC, "eth_call", [{ to: p.br, data: sel("quoteNative(uint32,bytes)") + (766).toString(16).padStart(64, "0") + (64).toString(16).padStart(64, "0") + (0).toString(16).padStart(64, "0") }, "latest"]);
      const words = qn.slice(2).match(/.{64}/g).map((w) => BigInt("0x" + w));
      const qb = await rpc(INF_RPC, "eth_call", [{ to: p.br, data: sel("quoteBridge(uint256)") + (10n ** 18n).toString(16).padStart(64, "0") }, "latest"]);
      const qw = qb.slice(2).match(/.{64}/g).map((w) => BigInt("0x" + w));
      rec.router = { token: "0x" + token.slice(-40), tokenMatchesSite: ("0x" + token.slice(-40)) === p.infToken, paused: BigInt(paused) === 1n, quoteNative766_totalNativeWei: words[2].toString(), quoteBridge_1token: { forward: qw[0].toString(), fee: qw[1].toString(), totalRequired: qw[2].toString() } };
    } catch (e) { rec.router.error = e.message; }
    out.pairs[p.symbol] = rec;
    console.log(p.symbol, "QL1->INF", rec.ql1ToInf.deliveredTrue + "/" + rec.ql1ToInf.sendsSampled, "| INF->QL1", rec.infToQl1.deliveredTrue + "/" + rec.infToQl1.sendsSampled, "| router totalNative(766)=", rec.router.quoteNative766_totalNativeWei, "tokenMatch=", rec.router.tokenMatchesSite, "paused=", rec.router.paused, "bridgeFee(1)=", rec.router.quoteBridge_1token && rec.router.quoteBridge_1token.fee);
  }
  // ---- QOM timing both directions via recipient token transfers ----
  async function timing(base, recipient, tokenAddr, sendAtIso, amountWei) {
    const url = `${base}/api/v2/addresses/${recipient}/token-transfers`;
    const r = await fetch(url); const j = await r.json();
    const sendMs = Date.parse(sendAtIso);
    for (const it of (j.items || [])) {
      if ((it.token && it.token.address_hash || "").toLowerCase() !== tokenAddr.toLowerCase()) continue;
      const v = it.total && it.total.value; const ts = Date.parse(it.timestamp);
      if (v === amountWei.toString() && ts >= sendMs - 5000) return { arrivalTx: it.transaction_hash, at: it.timestamp, deltaSec: Math.round((ts - sendMs) / 1000), token: it.token.symbol };
    }
    return null;
  }
  const q1 = out.pairs.QOM.ql1ToInf.examples[0];
  if (q1) { const rc = await rpc(QL1_RPC, "eth_getTransactionByHash", [q1.sendTx]); const recip = "0x" + rc.input.slice(98, 138); const amt = BigInt("0x" + rc.input.slice(138, 202)); out.qomTimingQl1ToInf = { sendTx: q1.sendTx, recipient: recip, amount: amt.toString(), arrival: await timing("https://scan.infinitedrive.xyz", recip, PAIRS[0].infToken, q1.at, amt) }; console.log("QOM QL1->INF timing:", JSON.stringify(out.qomTimingQl1ToInf)); }
  const q2 = out.pairs.QOM.infToQl1.examples[0];
  if (q2) { const rc = await rpc(INF_RPC, "eth_getTransactionByHash", [q2.sendTx]); const recip = "0x" + rc.input.slice(98, 138); const amt = BigInt("0x" + rc.input.slice(138, 202)); const arr = await timing("https://scan.qom.network", recip, PAIRS[0].ql1Token, q2.at, amt); out.qomTimingInfToQl1 = { sendTx: q2.sendTx, recipient: recip, amount: amt.toString(), arrivalWQOM: arr }; if (!arr) { /* arrival may be in xERC20 form */ out.qomTimingInfToQl1.arrivalXerc20 = await timing("https://scan.qom.network", recip, "0x91fe5fe31493de5e2eab71aa1006099627626fa8", q2.at, amt); } console.log("QOM INF->QL1 timing:", JSON.stringify(out.qomTimingInfToQl1)); }
  require("fs").writeFileSync(__dirname + "/sampling_results.json", JSON.stringify(out, null, 2));
  console.log("\nwrote sampling_results.json");
})().catch((e) => { console.error(e); process.exit(1); });
