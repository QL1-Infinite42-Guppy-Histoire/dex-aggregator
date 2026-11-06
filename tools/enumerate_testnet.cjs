"use strict";
/* テストネット(421018001)ファクトリーの全ペアを列挙し、トークン情報を
   オンチェーンから読んで表示する。docs/app.js の testnet トークン一覧は
   この出力から生成した（手書きでメインネットのアドレスを流用していない）。*/
const RPC = "https://evm-rpc-testnet.infinitedrive.xyz";
const FACTORY = "0x8944aadc2b88e1ee59fc079d6e70b23c758494da";
let id = 0;
async function batch(calls) {
  const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(calls.map((c, i) => ({ jsonrpc: "2.0", id: i + 1, method: c[0], params: c[1] }))) });
  const j = await r.json(); const by = {}; for (const x of j) by[x.id] = x.error ? null : x.result; return calls.map((_, i) => by[i + 1]);
}
const call = (to, data) => ["eth_call", [{ to, data }, "latest"]];
const decAddr = (h) => h && h.length >= 42 ? "0x" + h.slice(-40).toLowerCase() : null;
function decStr(hex) {
  if (!hex || hex === "0x") return null;
  try { const b = hex.slice(2);
    if (b.length === 64) { let s = ""; for (let i = 0; i < 64; i += 2) { const c = parseInt(b.substr(i, 2), 16); if (c) s += String.fromCharCode(c); } return s || null; }
    const len = Number(BigInt("0x" + b.substr(64, 64))); const raw = b.substr(128, len * 2); const bytes = [];
    for (let i = 0; i < raw.length; i += 2) bytes.push(parseInt(raw.substr(i, 2), 16));
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch (e) { return null; }
}
(async () => {
  const apl = (await batch([call(FACTORY, "0x574f2ba3")]))[0];
  const n = parseInt(apl, 16);
  console.log("allPairsLength:", n);
  const pairAddrs = [];
  for (let i = 0; i < n; i++) {
    const p = decAddr((await batch([call(FACTORY, "0x1e3dd18b" + BigInt(i).toString(16).padStart(64, "0"))]))[0]);
    pairAddrs.push(p);
  }
  const metas = await batch(pairAddrs.flatMap((p) => [call(p, "0x0dfe1681"), call(p, "0xd21220a7"), call(p, "0x0902f1ac")]));
  const tokens = new Map();
  const pairs = [];
  pairAddrs.forEach((p, i) => {
    const t0 = decAddr(metas[i * 3]), t1 = decAddr(metas[i * 3 + 1]); const res = metas[i * 3 + 2];
    const r0 = res ? BigInt("0x" + res.slice(2, 66)) : 0n, r1 = res ? BigInt("0x" + res.slice(66, 130)) : 0n;
    pairs.push({ pair: p, t0, t1, r0: r0.toString(), r1: r1.toString() });
    tokens.set(t0, true); tokens.set(t1, true);
  });
  const tlist = [...tokens.keys()];
  console.log(JSON.stringify({ pairs }, null, 1));
  console.log("tokens:", tlist.join(", "));
  // metadata one by one (few tokens)
  for (const t of tlist) {
    if (t === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") { console.log(t, "=> NATIVE PLACEHOLDER (TEST42)"); continue; }
    const [s, nm, d] = await batch([call(t, "0x95d89b41"), call(t, "0x06fdde03"), call(t, "0x313ce567")]);
    console.log(t, "=> symbol:", decStr(s), "| name:", decStr(nm), "| decimals:", d ? parseInt(d, 16) : null);
  }
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
