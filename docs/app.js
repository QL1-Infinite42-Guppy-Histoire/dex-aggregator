"use strict";
/* DEXアグリゲーター (42 Chain / QL1)
   Uniswap V2 ルーターの getAmountsOut を、直接・1つ経由・2つ経由の
   全候補ルートで叩いて比較し、いちばん多く受け取れるルートで交換する。
   分割ルート（例: 70%/30%）の実行には専用のアグリゲーター・コントラクトが
   必要だが、このチェーンにはまだ無いため、分割は「参考見積もり」のみ表示し
   実行はしない（正直な範囲）。*/

const NATIVE_PH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const WQOM = "0xa26dfbf98dd1a32fae56a3d2b2d60a8a41b0bdf0";

const CHAINS = {
  infinite: {
    key: "infinite", label: "42 Chain", chainId: 421018,
    nativeSymbol: "42", nativeName: "Infinite Drivechain",
    rpcs: ["https://evm-rpc.infinitedrive.xyz", "https://evm-rpc-infinite.mschihuahua.org", "https://evm-rpc.infinitepanda.xyz"],
    explorer: "https://scan.infinitedrive.xyz",
    router: "0xbf07dfe35746894bae373f63f4bf2379f9bafec0",
    factory: "0x3157c6aca800d507af95ab1466adbA3a6f11eE1a",
    nativeAnchor: NATIVE_PH,
    tokens: [
      { id: "native", symbol: "42", name: "42（ネイティブ）", address: NATIVE_PH, decimals: 18, isNative: true },
      { id: "usdt", symbol: "USDT", name: "Bridged USDT", address: "0xc2684966e5c95b2bc636fb4a1f3da9ad23d94753", decimals: 18, isNative: false },
      { id: "usdc", symbol: "USDC", name: "Bridged USDC", address: "0xea5b7fd59b7ec0f34663835a3a361f469c2d4c5c", decimals: 18, isNative: false },
      { id: "fish", symbol: "FISH", name: "FISH", address: "0x2c32120a12b754272d9e85c57f64b50ca2c43513", decimals: 18, isNative: false },
      { id: "panic", symbol: "PANIC", name: "Dont Panic (DONT)", address: "0xfaa842c8871f7f99c183f77871f79ce07dd056cd", decimals: 18, isNative: false },
      { id: "zap", symbol: "ZAP", name: "ZAP", address: "0x89195ca5c954b6f99b78f4a2aa5435a75dc5b256", decimals: 18, isNative: false },
      { id: "cat42", symbol: "CAT42", name: "CAT42", address: "0x7386719ebbbed4d810ff89027bfb8a1cdf696310", decimals: 18, isNative: false },
      { id: "father", symbol: "FATHER", name: "FATHER", address: "0x8981f00e92f31a87af12f980383d2217706258e7", decimals: 18, isNative: false },
      { id: "ket", symbol: "KET", name: "KET", address: "0xb749d42e6004db590b2f04f32b87485402a061e2", decimals: 18, isNative: false },
      { id: "baby", symbol: "BABY", name: "BABY", address: "0x77479226c103cc3c142faff6691bc7f849ce9c92", decimals: 18, isNative: false },
      { id: "qom", symbol: "QOM", name: "QOM (Infinite)", address: "0x53465cbbba5b14f5dc00794330f0f4afb30eaa1d", decimals: 18, isNative: false },
      { id: "marvin", symbol: "MARVIN", name: "MARVIN", address: "0xa307362f8a756722541dde6255aecf64f35ba337", decimals: 18, isNative: false },
      { id: "o", symbol: "O", name: "O", address: "0xf4c14c0322e361f35eb9465c992fb1c21c91c156", decimals: 18, isNative: false },
      { id: "osak", symbol: "OSAK", name: "OSAK", address: "0x404f3a213ff6c5d654f4e95e6a7ed098b1c3d3b3", decimals: 18, isNative: false },
      { id: "fox", symbol: "FOXXEY", name: "FOXXEY", address: "0x68d5a28d3bf09a32d3b9c35714ab7a6166ae2a00", decimals: 18, isNative: false },
      { id: "bfoxx", symbol: "BFOXX", name: "BFOXX", address: "0x3a921a988099374c65433208a452195ea6a1e116", decimals: 18, isNative: false },
      { id: "hawk", symbol: "HAWK", name: "HAWK", address: "0x4e3e79981a64d5678e2e70fd7b4b9550c2b41db2", decimals: 18, isNative: false },
      { id: "caw", symbol: "CAW", name: "CAW", address: "0xce8aee7148daa8943453239c42b7b93f984a49f0", decimals: 18, isNative: false },
      { id: "st42", symbol: "st42", name: "Staked 42 (stC2)", address: "0x78f40e828a92af9e137ff7660e52ac8b0f1d121e", decimals: 18, isNative: false },
    ],
    baseAddresses: [NATIVE_PH, "0xc2684966e5c95b2bc636fb4a1f3da9ad23d94753", "0xea5b7fd59b7ec0f34663835a3a361f469c2d4c5c", "0x2c32120a12b754272d9e85c57f64b50ca2c43513", "0x53465cbbba5b14f5dc00794330f0f4afb30eaa1d", "0x89195ca5c954b6f99b78f4a2aa5435a75dc5b256", "0xfaa842c8871f7f99c183f77871f79ce07dd056cd"],
    defaultFrom: "usdt", defaultTo: "native",
  },
  ql1: {
    key: "ql1", label: "QL1", chainId: 766,
    nativeSymbol: "QOM", nativeName: "QOM Layer One",
    rpcs: ["https://evm-rpc-ql1.mschihuahua.org"],
    explorer: "https://scan.qom.network",
    router: "0xc1f90231035a52091ebcb7dddaCa3051a5F44f30".toLowerCase(),
    factory: "0x475f361993d6facbf32fb82b66be0fb40f3d974c",
    nativeAnchor: WQOM,
    tokens: [
      { id: "native", symbol: "QOM", name: "QOM（ネイティブ）", address: WQOM, decimals: 18, isNative: true },
      { id: "wqom", symbol: "WQOM", name: "Wrapped QOM", address: WQOM, decimals: 18, isNative: false },
      { id: "qusdt", symbol: "qUSDT", name: "USDT FROM ETHEREUM", address: "0xc276b91c0e8d10260af7b67009d2683bb7776308", decimals: 6, isNative: false },
      { id: "qusdc", symbol: "qUSDC", name: "USDC FROM ETHEREUM", address: "0xb0a125e9673dc8e12bbcd0769c1257cf4a836d54", decimals: 6, isNative: false },
      { id: "qdai", symbol: "qDAI", name: "DAI FROM ETHEREUM", address: "0x8cb00ee173ae1c35d66118b7e08a69a0d4da06f2", decimals: 18, isNative: false },
      { id: "qswap", symbol: "QSWAP", name: "QOMSWAP", address: "0x4af41f453ead00d1cc6aa0b5b454bdeb102afc8d", decimals: 18, isNative: false },
      { id: "zap", symbol: "ZAP", name: "ZAP (QL1)", address: "0x6041b64618434b9d0a9558b5975c5c1deb45cee6", decimals: 18, isNative: false },
      { id: "baby", symbol: "BABY", name: "A Fund Baby", address: "0x4667fc0a4b996e0f997313a49de48036b584ef22", decimals: 18, isNative: false },
      { id: "ket", symbol: "KET", name: "Ryoshi Afterparty", address: "0x034c1fe794ab9d30e27e1ce0d89a4591fc9f1fb4", decimals: 18, isNative: false },
      { id: "hawk", symbol: "HAWK", name: "HAWK", address: "0xbc85f14059d60458b614052b4a84734e463878cc", decimals: 18, isNative: false },
      { id: "father", symbol: "Father", name: "Robert A. Heinlein", address: "0x2860ec7c34b29f3d2b43788c9a5f0de051f799bb", decimals: 18, isNative: false },
      { id: "o", symbol: "O", name: "Childhoods End", address: "0x6c39b68a28ba90f4eb80032ec0eb32ad81cbbed4", decimals: 18, isNative: false },
      { id: "qosak", symbol: "qOSAK", name: "OSAK FROM ETHEREUM", address: "0x5b6af20880a583128170d8c1fc319889ff405a5a", decimals: 18, isNative: false },
      { id: "qcaw", symbol: "qCAW", name: "CAW FROM ETHEREUM", address: "0xd2140e16adf37194036865e90bbca1139b739d0d", decimals: 18, isNative: false },
    ],
    baseAddresses: [WQOM, "0xc276b91c0e8d10260af7b67009d2683bb7776308", "0xb0a125e9673dc8e12bbcd0769c1257cf4a836d54", "0x8cb00ee173ae1c35d66118b7e08a69a0d4da06f2", "0x4af41f453ead00d1cc6aa0b5b454bdeb102afc8d"],
    defaultFrom: "qusdt", defaultTo: "native",
  },
};

const SEL = {
  getAmountsOut: "0xd06ca61f", getPair: "0xe6a43905", getReserves: "0x0902f1ac", token0: "0x0dfe1681",
  symbol: "0x95d89b41", name: "0x06fdde03", decimals: "0x313ce567",
  balanceOf: "0x70a08231", allowance: "0xdd62ed3e", approve: "0x095ea7b3",
  swapTokensForTokens: "0x38ed1739", swapETHForTokens: "0x7ff36ab5", swapTokensForETH: "0x18cbafe5",
};
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/* ---------- state ---------- */
const state = {
  chainKey: "infinite",
  custom: { infinite: [], ql1: [] },   // CA-added tokens per chain
  account: null,
  routes: [],                          // last quote result (sorted desc)
  directOut: null,                     // BigInt | null
  splitEstimate: null,                 // {out, bestOut} | null
  selectedIdx: 0,
  lastQuote: null,                     // {fromId,toId,amountIn,amountText}
  balances: {},                        // tokenId -> raw BigInt
  slippagePct: 1,
};
function chain() { return CHAINS[state.chainKey]; }
function allTokens(chainKey) {
  const c = CHAINS[chainKey || state.chainKey];
  return [...c.tokens, ...state.custom[c.key]];
}
function tokenById(chainKey, id) { return allTokens(chainKey).find((t) => t.id === id) || null; }
function tokenByAddress(chainKey, addr) {
  const a = (addr || "").toLowerCase();
  const list = allTokens(chainKey);
  // native first so the placeholder / WQOM resolves to the native entry
  return list.find((t) => t.isNative && t.address.toLowerCase() === a) || list.find((t) => t.address.toLowerCase() === a) || null;
}
function symbolFor(chainKey, addr) {
  const t = tokenByAddress(chainKey, addr);
  return t ? t.symbol : (addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "?");
}

/* ---------- amount helpers (BigInt only) ---------- */
function parseAmount(text, decimals) {
  const s = String(text == null ? "" : text).trim();
  if (!s || !/^\d*(\.\d*)?$/.test(s) || s === ".") throw new Error("金額の形式が違います");
  const [ip, fpRaw = ""] = s.split(".");
  if (fpRaw.length > decimals) throw new Error("小数点以下が多すぎます（最大 " + decimals + " 桁）");
  const fp = fpRaw.padEnd(decimals, "0");
  const v = BigInt(ip || "0") * (10n ** BigInt(decimals)) + (fp ? BigInt(fp) : 0n);
  return v;
}
function formatAmount(raw, decimals, maxFrac) {
  if (raw == null) return "—";
  const neg = raw < 0n; const v = neg ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const ip = v / base; let fp = (v % base).toString().padStart(decimals, "0");
  if (maxFrac != null) {
    fp = fp.slice(0, maxFrac);
    // 0.000000… のように先頭側が全部ゼロだと「0」に見えてしまうので、
    // 最初の0でない桁＋数桁まで伸ばして表示する（ダストルート用）
    if (ip === 0n && !/[1-9]/.test(fp)) {
      const full = (v % base).toString().padStart(decimals, "0");
      const first = full.search(/[1-9]/);
      if (first >= 0) fp = full.slice(0, Math.min(decimals, first + 4));
    }
  }
  fp = fp.replace(/0+$/, "");
  const ipStr = ip.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + ipStr + (fp ? "." + fp : "");
}

/* ---------- ABI encoding helpers ---------- */
function encAddr(a) { return a.toLowerCase().replace("0x", "").padStart(64, "0"); }
function encUint(n) { return BigInt(n).toString(16).padStart(64, "0"); }
function encPath(addrs) {
  return encUint(32) + encUint(addrs.length) + addrs.map(encAddr).join("");
}
function decUint(hex) { return hex && hex !== "0x" ? BigInt(hex) : null; }
function decAddr(hex) { return hex && hex.length >= 42 ? "0x" + hex.slice(-40).toLowerCase() : null; }
function decStr(hex) {
  if (!hex || hex === "0x") return null;
  try {
    const b = hex.slice(2);
    if (b.length === 64) {
      let s = ""; for (let i = 0; i < 64; i += 2) { const c = parseInt(b.substr(i, 2), 16); if (c) s += String.fromCharCode(c); }
      return s || null;
    }
    const len = Number(BigInt("0x" + b.substr(64, 64)));
    const raw = b.substr(128, len * 2); const bytes = [];
    for (let i = 0; i < raw.length; i += 2) bytes.push(parseInt(raw.substr(i, 2), 16));
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch (e) { return null; }
}
function encodeGetAmountsOut(amountIn, pathAddrs) {
  // getAmountsOut(uint256,address[]) : head = amountIn, offset(0x40), then len + addrs
  return SEL.getAmountsOut + encUint(amountIn) + encUint(64) + encUint(pathAddrs.length) + pathAddrs.map(encAddr).join("");
}
function decodeAmountsOut(hex) {
  if (!hex || hex === "0x" || hex.length < 128) return null;
  try {
    const len = Number(BigInt("0x" + hex.slice(66, 130)));
    const out = [];
    for (let i = 0; i < len; i++) out.push(BigInt("0x" + hex.slice(130 + i * 64, 194 + i * 64)));
    return out;
  } catch (e) { return null; }
}

/* ---------- RPC (public, read-only) ---------- */
let rpcId = 0;
async function rpcBatchOnce(url, calls) {
  const start = rpcId;
  const payload = calls.map(([to, data]) => ({ jsonrpc: "2.0", id: ++rpcId, method: "eth_call", params: [{ to, data }, "latest"] }));
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error("RPC HTTP " + res.status);
  const out = await res.json();
  if (!Array.isArray(out)) throw new Error("RPC応答が不正です");
  const byId = {};
  for (const x of out) byId[x.id] = x.error ? null : (x.result || null);
  return calls.map((_, i) => byId[start + i + 1] || null);
}
async function rpcBatch(chainObj, calls) {
  let lastErr = null;
  for (const url of chainObj.rpcs) {
    try { return await rpcBatchOnce(url, calls); } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("RPCに接続できませんでした");
}
async function rpcOne(chainObj, to, data) { return (await rpcBatch(chainObj, [[to, data]]))[0]; }
async function rpcMethod(chainObj, method, params) {
  let lastErr = null;
  for (const url of chainObj.rpcs) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }) });
      const j = await res.json();
      if (j.error) throw new Error(j.error.message || "RPC error");
      return j.result;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("RPCに接続できませんでした");
}

/* ---------- route enumeration ---------- */
function buildCandidatePaths(chainObj, fromTok, toTok) {
  const from = fromTok.address.toLowerCase(), to = toTok.address.toLowerCase();
  const bases = chainObj.baseAddresses.map((a) => a.toLowerCase()).filter((a) => a !== from && a !== to);
  const paths = [[from, to]];
  for (const x of bases) paths.push([from, x, to]);
  for (const x of bases) for (const y of bases) { if (x !== y) paths.push([from, x, y, to]); }
  const seen = new Set(); const out = [];
  for (const p of paths) { const k = p.join(","); if (!seen.has(k)) { seen.add(k); out.push(p); } }
  return out;
}

/* spot output (no fee) walking reserves; returns map pairKey -> {pair, rInFor(a), token0} */
async function fetchPairs(chainObj, routes) {
  const keys = new Set();
  for (const r of routes) for (let i = 0; i < r.path.length - 1; i++) keys.add(r.path[i] + "," + r.path[i + 1]);
  const keyArr = [...keys];
  const pairRes = await rpcBatch(chainObj, keyArr.map((k) => { const [a, b] = k.split(","); return [chainObj.factory, SEL.getPair + encAddr(a) + encAddr(b)]; }));
  const pairOf = new Map();
  keyArr.forEach((k, i) => { const p = decAddr(pairRes[i]); if (p && p !== ZERO_ADDR) pairOf.set(k, p); });
  const uniqPairs = [...new Set(pairOf.values())];
  const detail = await rpcBatch(chainObj, uniqPairs.flatMap((p) => [[p, SEL.getReserves], [p, SEL.token0]]));
  const info = new Map();
  uniqPairs.forEach((p, i) => {
    const raw = detail[i * 2]; const t0 = decAddr(detail[i * 2 + 1]);
    if (!raw || raw.length < 130 || !t0) return;
    try { info.set(p, { r0: BigInt("0x" + raw.slice(2, 66)), r1: BigInt("0x" + raw.slice(66, 130)), token0: t0 }); } catch (e) { /* skip */ }
  });
  return { pairOf, info };
}
function spotOutFor(route, amountIn, pairOf, info) {
  let cur = amountIn;
  for (let i = 0; i < route.path.length - 1; i++) {
    const pair = pairOf.get(route.path[i] + "," + route.path[i + 1]);
    if (!pair) return null;
    const d = info.get(pair); if (!d) return null;
    const inIs0 = d.token0 === route.path[i];
    const rIn = inIs0 ? d.r0 : d.r1; const rOut = inIs0 ? d.r1 : d.r0;
    if (rIn === 0n || rOut === 0n) return null;
    cur = (cur * rOut) / rIn;
  }
  return cur;
}

/* ---------- quoting: compare ALL routes ---------- */
async function fetchQuotesForTokens(chainObj, fromTok, toTok, amountIn) {
  if (fromTok.address.toLowerCase() === toTok.address.toLowerCase()) {
    throw new Error("同じトークン同士は交換できません（QOM⇔WQOM の包み直しはこのサイトでは扱いません）");
  }
  if (amountIn <= 0n) throw new Error("金額は0より大きくしてください");
  const paths = buildCandidatePaths(chainObj, fromTok, toTok);
  const results = await rpcBatch(chainObj, paths.map((p) => [chainObj.router, encodeGetAmountsOut(amountIn, p)]));
  const routes = [];
  results.forEach((hex, i) => {
    const amounts = decodeAmountsOut(hex);
    if (!amounts || !amounts.length) return;
    const out = amounts[amounts.length - 1];
    if (out <= 0n) return;
    routes.push({ path: paths[i], amounts, amountOut: out, hops: paths[i].length - 1, priceImpactPct: null });
  });
  if (!routes.length) throw new Error("どのルートでも交換できませんでした（プールが無いか、流動性がありません）");
  routes.sort((a, b) => (b.amountOut > a.amountOut ? 1 : b.amountOut < a.amountOut ? -1 : 0));
  const direct = routes.find((r) => r.hops === 1) || null;
  // price impact from reserves (best-effort; failures just leave null)
  try {
    const { pairOf, info } = await fetchPairs(chainObj, routes);
    for (const r of routes) {
      const spot = spotOutFor(r, amountIn, pairOf, info);
      if (spot !== null && spot > 0n) {
        const spotN = Number(spot), outN = Number(r.amountOut);
        if (spotN > 0) r.priceImpactPct = (1 - outN / spotN) * 100;
      }
    }
  } catch (e) { /* impact is optional */ }
  // split estimate (reference only): top-2 routes at 50/50
  let splitEstimate = null;
  if (routes.length >= 2) {
    try {
      const half1 = amountIn / 2n, half2 = amountIn - half1;
      const [h1, h2] = await rpcBatch(chainObj, [
        [chainObj.router, encodeGetAmountsOut(half1, routes[0].path)],
        [chainObj.router, encodeGetAmountsOut(half2, routes[1].path)],
      ]);
      const a1 = decodeAmountsOut(h1), a2 = decodeAmountsOut(h2);
      if (a1 && a2) {
        const total = a1[a1.length - 1] + a2[a2.length - 1];
        if (total > routes[0].amountOut) splitEstimate = { out: total, bestOut: routes[0].amountOut };
      }
    } catch (e) { /* reference only */ }
  }
  return { routes, directOut: direct ? direct.amountOut : null, splitEstimate, amountIn };
}

/* ---------- tx construction (pure; used by send flow AND the harness) ---------- */
function applySlippageBps(amount, slippagePct) {
  const bps = Math.round(Number(slippagePct) * 100);
  return (amount * BigInt(10000 - bps)) / 10000n;
}
function deadline20Min(nowSec) { return (nowSec || Math.floor(Date.now() / 1000)) + 20 * 60; }
function buildSwapTx(chainObj, fromTok, toTok, route, account, slippagePct, nowSec) {
  const amountIn = route.amountIn;
  const amountOutMin = applySlippageBps(route.amountOut, slippagePct);
  const deadline = deadline20Min(nowSec);
  const path = route.path;
  // ABI: dynamic array arg offset differs per function; build per function.
  function arrayTail(addrs) { return encUint(addrs.length) + addrs.map(encAddr).join(""); }
  let data, value = 0n, fn;
  if (fromTok.isNative) {
    fn = "swapExactETHForTokens";
    // (uint amountOutMin, address[] path, address to, uint deadline): head 4 words, array offset = 4*32=128
    data = SEL.swapETHForTokens + encUint(amountOutMin) + encUint(128) + encAddr(account) + encUint(deadline) + arrayTail(path);
    value = amountIn;
  } else if (toTok.isNative) {
    fn = "swapExactTokensForETH";
    // (uint amountIn, uint amountOutMin, address[] path, address to, uint deadline): offset = 5*32=160
    data = SEL.swapTokensForETH + encUint(amountIn) + encUint(amountOutMin) + encUint(160) + encAddr(account) + encUint(deadline) + arrayTail(path);
  } else {
    fn = "swapExactTokensForTokens";
    data = SEL.swapTokensForTokens + encUint(amountIn) + encUint(amountOutMin) + encUint(160) + encAddr(account) + encUint(deadline) + arrayTail(path);
  }
  return { to: chainObj.router, data, value, amountOutMin, deadline, functionName: fn, path };
}
function buildApproveTx(tokenAddr, spender, amount) {
  return { to: tokenAddr.toLowerCase(), data: SEL.approve + encAddr(spender) + encUint(amount), value: 0n };
}

/* ---------- token metadata (CA add) ---------- */
async function fetchTokenMeta(chainObj, address) {
  const addr = address.toLowerCase();
  const res = await rpcBatch(chainObj, [[addr, SEL.symbol], [addr, SEL.name], [addr, SEL.decimals]]);
  const symbol = decStr(res[0]); const name = decStr(res[1]);
  const decimals = res[2] ? Number(decUint(res[2])) : null;
  if (!symbol && decimals == null) throw new Error("トークンとして読み取れませんでした（アドレスが違うか、このチェーンのトークンではない可能性があります）");
  return { id: "ca_" + addr, symbol: symbol || "?", name: name || "", address: addr, decimals: decimals != null ? decimals : 18, isNative: false, custom: true };
}

/* ---------- storage ---------- */
function loadLocal() {
  try {
    const c = JSON.parse(localStorage.getItem("dexagg_custom_v1") || "{}");
    for (const k of ["infinite", "ql1"]) if (Array.isArray(c[k])) state.custom[k] = c[k];
  } catch (e) { /* ignore */ }
}
function saveLocal() {
  try { localStorage.setItem("dexagg_custom_v1", JSON.stringify(state.custom)); } catch (e) { /* ignore */ }
}

/* ================= browser UI ================= */
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function setStatus(msg, isErr) { const el = $("status"); if (el) { el.textContent = msg || ""; el.style.color = isErr ? "#ff9d9d" : ""; } }

function fillTokenSelects() {
  const c = chain();
  const toks = allTokens();
  const mk = (sel, keepId) => {
    const cur = keepId || sel.value;
    sel.innerHTML = toks.map((t) => '<option value="' + esc(t.id) + '">' + esc(t.symbol) + (t.name ? " — " + esc(t.name) : "") + "</option>").join("");
    sel.value = tokenById(state.chainKey, cur) ? cur : "";
  };
  mk($("fromToken")); mk($("toToken"));
  if (!$("fromToken").value) $("fromToken").value = c.defaultFrom;
  if (!$("toToken").value) $("toToken").value = c.defaultTo;
}
function currentFrom() { return tokenById(state.chainKey, $("fromToken").value); }
function currentTo() { return tokenById(state.chainKey, $("toToken").value); }
function clearRoutes(msg) {
  state.routes = []; state.directOut = null; state.splitEstimate = null; state.selectedIdx = 0; state.lastQuote = null;
  $("routeList").innerHTML = msg ? '<p class="count">' + esc(msg) + "</p>" : "";
  $("splitNote").textContent = "";
  $("minLine").textContent = "";
  $("swapBtn").disabled = true;
}
function renderBalances() {
  const f = currentFrom(), t = currentTo();
  const line = (tok) => {
    if (!state.account) return "ウォレット接続後に表示";
    const raw = state.balances[tok.id];
    return raw == null ? "…" : formatAmount(raw, tok.decimals, 6) + " " + tok.symbol;
  };
  $("fromBalance").textContent = f ? "残高: " + line(f) : "";
  $("toBalance").textContent = t ? "残高: " + line(t) : "";
}
async function refreshBalances() {
  if (!state.account) { renderBalances(); return; }
  const c = chain(); const f = currentFrom(), t = currentTo();
  try {
    const calls = [], ids = [];
    for (const tok of [f, t]) {
      if (!tok) continue;
      if (tok.isNative) { /* handled separately */ } else { calls.push([tok.address, SEL.balanceOf + encAddr(state.account)]); ids.push(tok.id); }
    }
    const res = calls.length ? await rpcBatch(c, calls) : [];
    ids.forEach((id, i) => { state.balances[id] = decUint(res[i]) || 0n; });
    for (const tok of [f, t]) {
      if (tok && tok.isNative) {
        const hex = await rpcMethod(c, "eth_getBalance", [state.account, "latest"]);
        state.balances[tok.id] = hex ? BigInt(hex) : 0n;
      }
    }
  } catch (e) { /* balances are optional display */ }
  renderBalances();
}
function renderRoutes() {
  const c = chain(); const toTok = state.lastQuote ? tokenById(state.chainKey, state.lastQuote.toId) : null;
  const list = $("routeList");
  if (!state.routes.length || !toTok) { list.innerHTML = ""; return; }
  list.innerHTML = state.routes.map((r, i) => {
    const pathLabel = r.path.map((a) => symbolFor(state.chainKey, a)).join(" → ");
    let vs;
    if (r.hops === 1) vs = "直接ルート";
    else if (state.directOut != null) {
      const diff = (Number(r.amountOut - state.directOut) / Number(state.directOut)) * 100;
      vs = "直接より " + (diff >= 0 ? "+" : "") + diff.toFixed(2) + "%";
    } else vs = "直接ルートなし";
    const impact = r.priceImpactPct != null ? "値段の下がり幅 約" + r.priceImpactPct.toFixed(2) + "%" : "値段の下がり幅 —";
    return '<button type="button" class="route-card' + (i === state.selectedIdx ? " selected" : "") + '" data-idx="' + i + '">' +
      '<span class="r-head"><span class="r-rank">' + (i + 1) + "位</span>" + (i === 0 ? '<span class="badge best">いちばん多い</span>' : "") +
      '<span class="r-out">' + formatAmount(r.amountOut, toTok.decimals, 6) + " " + esc(toTok.symbol) + "</span></span>" +
      '<span class="r-line">ルート: ' + esc(pathLabel) + "</span>" +
      '<span class="r-line">' + esc(vs) + " ／ 交換 " + r.hops + "回 ／ " + esc(impact) + "</span></button>";
  }).join("");
  list.querySelectorAll(".route-card").forEach((el) => el.addEventListener("click", () => selectRoute(Number(el.dataset.idx))));
  const sn = $("splitNote");
  if (state.splitEstimate) {
    sn.textContent = "分割したら（参考）: 上位2ルートに半分ずつ分けると約 " + formatAmount(state.splitEstimate.out, toTok.decimals, 6) + " " + toTok.symbol +
      " になる見積もりです。ただし分割の実行には専用コントラクトが必要で、まだ無いため実行はできません。";
  } else sn.textContent = "";
  updateMinLine();
  $("swapBtn").disabled = !state.account;
}
function selectRoute(idx) {
  state.selectedIdx = idx;
  // attach amountIn to route objects for tx building
  renderRoutes();
}
function selectedRoute() {
  const r = state.routes[state.selectedIdx];
  if (!r || !state.lastQuote) return null;
  return { ...r, amountIn: state.lastQuote.amountIn };
}
function updateMinLine() {
  const r = selectedRoute(); const toTok = state.lastQuote ? tokenById(state.chainKey, state.lastQuote.toId) : null;
  if (!r || !toTok) { $("minLine").textContent = ""; return; }
  const min = applySlippageBps(r.amountOut, state.slippagePct);
  $("minLine").textContent = "最低でも受け取る量（スリッページ " + state.slippagePct + "% を引いた額）: " + formatAmount(min, toTok.decimals, 6) + " " + toTok.symbol;
}
async function onQuote() {
  const c = chain(); const f = currentFrom(), t = currentTo();
  if (!f || !t) return;
  let amountIn;
  try { amountIn = parseAmount($("amountIn").value, f.decimals); } catch (e) { setStatus(e.message, true); return; }
  const btn = $("quoteBtn"); btn.disabled = true;
  setStatus("全部のルートを比べています…（直接・1つ経由・2つ経由）");
  try {
    const q = await fetchQuotesForTokens(c, f, t, amountIn);
    state.routes = q.routes; state.directOut = q.directOut; state.splitEstimate = q.splitEstimate;
    state.selectedIdx = 0;
    state.lastQuote = { fromId: f.id, toId: t.id, amountIn, amountText: $("amountIn").value };
    renderRoutes();
    const best = q.routes[0];
    const bestLabel = best.path.map((a) => symbolFor(state.chainKey, a)).join(" → ");
    setStatus(q.routes.length + " ルートを比べました。いちばん多いのは「" + bestLabel + "」です。" + (q.directOut == null ? "直接ルートはありませんでした。" : ""));
  } catch (e) {
    clearRoutes();
    setStatus("見積もりできませんでした: " + e.message, true);
  } finally { btn.disabled = false; }
}

/* ---------- MetaMask ---------- */
function eth() { return (typeof window !== "undefined" && window.ethereum) ? window.ethereum : null; }
async function ensureChain() {
  const e = eth(); if (!e) throw new Error("MetaMaskが見つかりません。MetaMask（または対応ウォレット）を入れたブラウザで開いてください");
  const c = chain();
  const hexId = "0x" + c.chainId.toString(16);
  const cur = await e.request({ method: "eth_chainId" });
  if (cur && cur.toLowerCase() === hexId) return;
  try {
    await e.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
  } catch (err) {
    if (err && err.code === 4902) {
      await e.request({ method: "wallet_addEthereumChain", params: [{ chainId: hexId, chainName: c.label + " (" + c.nativeName + ")", nativeCurrency: { name: c.nativeSymbol, symbol: c.nativeSymbol, decimals: 18 }, rpcUrls: c.rpcs, blockExplorerUrls: [c.explorer] }] });
    } else throw err;
  }
}
async function onConnect() {
  const e = eth();
  if (!e) { setStatus("MetaMaskが見つかりません。MetaMask（または対応ウォレット）を入れたブラウザで開いてください", true); return; }
  try {
    const accts = await e.request({ method: "eth_requestAccounts" });
    if (!accts || !accts.length) throw new Error("アカウントが取得できませんでした");
    state.account = accts[0].toLowerCase();
    await ensureChain();
    $("accountLine").textContent = "接続中: " + state.account.slice(0, 6) + "…" + state.account.slice(-4) + "（" + chain().label + "）";
    $("swapBtn").disabled = !state.routes.length;
    await refreshBalances();
    setStatus("ウォレットを接続しました");
  } catch (err) { setStatus("接続できませんでした: " + friendlyErr(err), true); }
}
function friendlyErr(err) {
  if (!err) return "不明なエラー";
  if (err.code === 4001) return "ウォレット側でキャンセルされました";
  return err.message || String(err);
}
async function waitReceipt(hash) {
  const e = eth();
  for (let i = 0; i < 30; i++) {
    try { const r = await e.request({ method: "eth_getTransactionReceipt", params: [hash] }); if (r) return r; } catch (err) { /* retry */ }
    await new Promise((res) => setTimeout(res, 3000));
  }
  return null;
}
async function sendTx(tx, valueHex) {
  const e = eth();
  return await e.request({ method: "eth_sendTransaction", params: [{ from: state.account, to: tx.to, data: tx.data, value: valueHex || "0x0" }] });
}
async function onSwap() {
  const c = chain(); const f = currentFrom(), t = currentTo(); const r = selectedRoute();
  if (!state.account) { setStatus("先にウォレットを接続してください", true); return; }
  if (!r || !f || !t) { setStatus("先に「ルートを比べる」を押してください", true); return; }
  if (state.lastQuote.fromId !== f.id || state.lastQuote.toId !== t.id) { setStatus("トークンが変わっています。もう一度「ルートを比べる」を押してください", true); return; }
  const btn = $("swapBtn"); btn.disabled = true;
  try {
    await ensureChain();
    // allowance (token -> token / token -> native only)
    if (!f.isNative) {
      setStatus("使える量の許可を確認しています…");
      const allowHex = await rpcOne(c, f.address, SEL.allowance + encAddr(state.account) + encAddr(c.router));
      const allowance = decUint(allowHex) || 0n;
      if (allowance < r.amountIn) {
        setStatus("このトークンを使う許可をウォレットで承認してください（1回だけ必要です）");
        const atx = buildApproveTx(f.address, c.router, r.amountIn);
        const ah = await sendTx(atx, "0x0");
        setStatus("許可の取引を送りました。完了を待っています… " + ah);
        const rc = await waitReceipt(ah);
        if (rc && rc.status === "0x0") throw new Error("許可の取引が失敗しました");
      }
    }
    const tx = buildSwapTx(c, f, t, r, state.account, state.slippagePct);
    setStatus("ウォレットで交換を確認してください（ルート: " + r.path.map((a) => symbolFor(state.chainKey, a)).join(" → ") + "）");
    const hash = await sendTx(tx, "0x" + tx.value.toString(16));
    const link = c.explorer + "/tx/" + hash;
    $("txResult").innerHTML = '交換の取引を送りました: <a href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(hash.slice(0, 10)) + "…" + esc(hash.slice(-6)) + "</a>（エクスプローラーで開きます）";
    setStatus("送信しました。チェーン上で完了するまで少し待ってください");
    waitReceipt(hash).then((rc) => {
      if (rc) setStatus(rc.status === "0x1" ? "交換が完了しました" : "取引は失敗しました（エクスプローラーで確認してください）", rc.status !== "0x1");
      refreshBalances();
    });
  } catch (err) {
    setStatus("交換できませんでした: " + friendlyErr(err), true);
  } finally { btn.disabled = false; }
}

/* ---------- CA add ---------- */
async function onCaAdd() {
  const input = $("caInput"), msg = $("caMsg");
  const m = input.value.trim().match(/0x[0-9a-fA-F]{40}/);
  if (!m) { msg.textContent = "アドレスの形式が違います（0x + 40文字）"; return; }
  const addr = m[0].toLowerCase();
  if (tokenByAddress(state.chainKey, addr) && allTokens().some((t) => t.address.toLowerCase() === addr && !t.isNative)) { msg.textContent = "そのトークンはもう一覧にあります"; return; }
  const btn = $("caAddBtn"); btn.disabled = true; msg.textContent = "チェーンから読み取り中…";
  try {
    const meta = await fetchTokenMeta(chain(), addr);
    state.custom[state.chainKey].push(meta);
    saveLocal();
    fillTokenSelects();
    $("toToken").value = meta.id;
    clearRoutes("トークンを追加しました。金額を入れて「ルートを比べる」を押してください");
    msg.textContent = "追加しました: " + meta.symbol + "（" + (meta.name || "") + "、小数 " + meta.decimals + " 桁）";
    input.value = "";
    refreshBalances();
  } catch (e) { msg.textContent = "読み取れませんでした: " + e.message; }
  finally { btn.disabled = false; }
}

/* ---------- wiring ---------- */
function setChain(key) {
  state.chainKey = key;
  state.balances = {};
  $("chainInf").classList.toggle("active", key === "infinite");
  $("chainQl1").classList.toggle("active", key === "ql1");
  $("chainNote").textContent = key === "infinite"
    ? "42 Chain（チェーンID 421018）／ DEX: Don't Panic（Nutri-Matic）"
    : "QL1（チェーンID 766）／ DEX: QomSwap";
  fillTokenSelects();
  clearRoutes("チェーンを切り替えました。金額を入れて「ルートを比べる」を押してください");
  if (state.account) { $("accountLine").textContent = "接続中: " + state.account.slice(0, 6) + "…" + state.account.slice(-4) + "（" + chain().label + " に切り替えるには交換時に自動で切り替わります）"; refreshBalances(); }
}
function applyChip(pct) {
  const f = currentFrom(); if (!f) return;
  const raw = state.balances[f.id];
  if (!state.account || raw == null) { setStatus("残高がまだ分かりません。ウォレットを接続してください", true); return; }
  let v;
  if (pct === "MAX") {
    if (f.isNative) {
      const buffer = parseAmount("0.01", f.decimals); // gas用に 0.01 残す（画面にも明記）
      v = raw > buffer ? raw - buffer : 0n;
    } else v = raw;
  } else v = (raw * BigInt(pct)) / 100n;
  $("amountIn").value = formatAmount(v, f.decimals, f.decimals).replace(/,/g, "");
  clearRoutes("金額が変わりました。「ルートを比べる」を押してください");
}
function initApp() {
  loadLocal();
  fillTokenSelects();
  $("chainInf").addEventListener("click", () => setChain("infinite"));
  $("chainQl1").addEventListener("click", () => setChain("ql1"));
  $("connectBtn").addEventListener("click", onConnect);
  $("quoteBtn").addEventListener("click", onQuote);
  $("swapBtn").addEventListener("click", onSwap);
  $("flipBtn").addEventListener("click", () => {
    const a = $("fromToken").value; $("fromToken").value = $("toToken").value; $("toToken").value = a;
    clearRoutes("入れ替えました。「ルートを比べる」を押してください"); refreshBalances();
  });
  for (const id of ["fromToken", "toToken"]) $(id).addEventListener("change", () => { clearRoutes("トークンが変わりました。「ルートを比べる」を押してください"); refreshBalances(); });
  $("amountIn").addEventListener("input", () => { if (state.routes.length) clearRoutes("金額が変わりました。「ルートを比べる」を押してください"); });
  document.querySelectorAll(".chip").forEach((el) => el.addEventListener("click", () => applyChip(el.dataset.pct === "MAX" ? "MAX" : Number(el.dataset.pct))));
  document.querySelectorAll(".slip-btn").forEach((el) => el.addEventListener("click", () => {
    state.slippagePct = Number(el.dataset.val);
    $("slipCustom").value = "";
    document.querySelectorAll(".slip-btn").forEach((x) => x.classList.toggle("active", x === el));
    updateMinLine();
  }));
  $("slipCustom").addEventListener("input", () => {
    const v = parseFloat($("slipCustom").value);
    if (!isNaN(v) && v >= 0 && v <= 50) { state.slippagePct = v; document.querySelectorAll(".slip-btn").forEach((x) => x.classList.remove("active")); updateMinLine(); }
  });
  $("caAddBtn").addEventListener("click", onCaAdd);
  $("caInput").addEventListener("keydown", (e) => { if (e.key === "Enter") onCaAdd(); });
  setChain("infinite");
  renderBalances();
}
if (typeof document !== "undefined" && document.getElementById && document.getElementById("fromToken")) {
  try { initApp(); } catch (e) { /* harness stubs may lack full DOM */ }
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { CHAINS, state, parseAmount, formatAmount, encAddr, encUint, encodeGetAmountsOut, decodeAmountsOut, buildCandidatePaths, fetchQuotesForTokens, buildSwapTx, buildApproveTx, applySlippageBps, fetchTokenMeta, tokenById, allTokens, symbolFor, onQuote, onCaAdd, selectRoute, selectedRoute, setChain };
}
