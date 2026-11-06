"use strict";
// Bridge reality sampling step 1: method census on Blockscout for all 8 pairs x 3 contracts.
const PAIRS = [
  { symbol: "QOM",    br: "0x049a78Fe311cf1C23f09cdd4F12420FfC917C8db", infR: "0xf4440822c681Ce4CB80b5a3A508876eE23b40F1b", ql1R: "0x30da1e7c8de5FA75B593002E0b2D2910FFcAdCB6" },
  { symbol: "BABY",   br: "0x4aba9dBE8a990C19501C1c4C3E677f775006D2e2", infR: "0x49b525D647068E17892a66e08d197e7Faa036D3E", ql1R: "0x8ff9452f309159828903d2D6cCa58CCcb2b5Cd16" },
  { symbol: "CAW",    br: "0x82bA5D61a70677f7f53A9894C63DfB61FD8bCb65", infR: "0xA8493DbB1be229Fbbc9127d6D2e387dbEA2AE214", ql1R: "0xD14cF03D3753d80a1f6fb818Aa1c728D5c36B3bf" },
  { symbol: "FATHER", br: "0x056c116c09ACb788d038E7dDc167249C26493D6e", infR: "0xAe3fB59A4c950447386e7d2cA54ab05c857B817E", ql1R: "0x54718De5e064DcD1181b7847591c5864434ED92e" },
  { symbol: "HAWK",   br: "0x0d198200dC673e96217ddeA9560d26Ae0d092074", infR: "0xBd0c6E7dA96F71cfD2E6651d697b048bAf5c91Cd", ql1R: "0x916fb1a761d0Db8888C3F79d6c614C9FFf73b657" },
  { symbol: "KET",    br: "0x3BC94E9F417561Ca37559E07dfC65496fcE94557", infR: "0xb1b313B3767c73398935E5bCDD7914340E73f3dD", ql1R: "0x59d6e50f5b0559A088e3eaAc21E520be18453704" },
  { symbol: "O",      br: "0xcB893a7e5f2932531f6e04c0Fc3b17AC4884475f", infR: "0xE62ba8A1df1ED3628f2C22A245f7A47a76573CB5", ql1R: "0x488B1f39AA01196ec8a14891bAfFEe6630155A61" },
  { symbol: "OSAK",   br: "0xA2093426c03ba6F0f6049532b6f13F1e36566358", infR: "0xB477ab5A53d8361b735BD812095325a35Fc29b1B", ql1R: "0xe3a35d9f4EF7eacD5bb47164Ee8d7bff75C2cF6B" },
];
async function txsPage(base, addr, pages) {
  let url = `${base}/api/v2/addresses/${addr}/transactions`;
  const items = [];
  for (let p = 0; p < pages; p++) {
    const r = await fetch(url); if (!r.ok) throw new Error(url + " -> " + r.status);
    const j = await r.json();
    items.push(...(j.items || []));
    if (!j.next_page_params) break;
    const q = new URLSearchParams(Object.entries(j.next_page_params).map(([k, v]) => [k, String(v)]));
    url = `${base}/api/v2/addresses/${addr}/transactions?${q.toString()}`;
  }
  return items;
}
function census(items) {
  const c = {};
  for (const it of items) c[it.method || "(none)"] = (c[it.method || "(none)"] || 0) + 1;
  return c;
}
(async () => {
  for (const p of PAIRS) {
    const [ql1, infR, br] = await Promise.all([
      txsPage("https://scan.qom.network", p.ql1R, 1).catch((e) => { console.error(p.symbol, "ql1 err", e.message); return []; }),
      txsPage("https://scan.infinitedrive.xyz", p.infR, 1).catch((e) => { console.error(p.symbol, "infR err", e.message); return []; }),
      txsPage("https://scan.infinitedrive.xyz", p.br, 1).catch((e) => { console.error(p.symbol, "br err", e.message); return []; }),
    ]);
    const latest = (arr) => arr.length ? arr[0].timestamp : "-";
    console.log(`\n== ${p.symbol} ==`);
    console.log(` QL1 warpRouter  n=${ql1.length} census=${JSON.stringify(census(ql1))} latest=${latest(ql1)}`);
    console.log(` INF warpRouter  n=${infR.length} census=${JSON.stringify(census(infR))} latest=${latest(infR)}`);
    console.log(` INF BridgeRouter n=${br.length} census=${JSON.stringify(census(br))} latest=${latest(br)}`);
    const ex = (arr, m) => arr.filter((x) => x.method === m).slice(0, 2).map((x) => x.hash + "@" + x.timestamp).join(" | ");
    console.log(`  QL1->INF sends (ql1 transferRemote): ${ex(ql1, "transferRemote") || "none in page"}`);
    console.log(`  deliveries to INF (inf warp handle): ${ex(infR, "handle") || "none in page"}`);
    console.log(`  INF->QL1 sends (BridgeRouter transferRemote): ${ex(br, "transferRemote") || "none in page"}`);
    console.log(`  deliveries to QL1 (ql1 warp handle): ${ex(ql1, "handle") || "none in page"}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
