"use strict";
/* 共有 SplitSwap のデプロイ後検証 (2026-11-25、ユーザー判断で共有化)。
   サイト内デプロイフローでデプロイされた SplitSwap が、想定どおりの
   バイトコードで建っているかを機械的に確認する。

   使い方: node probe/verify_shared_splitswap.cjs <42|ql1> <address>
     42  = 42 Chain (CHAINS.infinite, chainId 421018)
     ql1 = QL1      (CHAINS.ql1,      chainId 766)

   チェック内容:
     1) RPC の chainId が対象チェーンと一致する
     2) アドレスにコードが存在する
     3) ランタイムバイトコードが probe/splitswap_baseline.json の
        そのチェーンの期待バイト列と完全一致する (ルーターは immutable
        としてコードに埋め込まれるため、チェーンごとに期待値が違う)
     4) router() がそのチェーンの DEX ルーターを返す
   全て PASS で exit 0、それ以外は exit 1 (理由を表示)。

   期待値は、サイト内蔵の作成バイトコード (docs/app.js SPLIT_BYTECODE、
   contracts/SplitSwap.json と同一) をローカル paris EVM にデプロイして
   eth_getCode で読み取った実物。経緯と既知のメタデータハッシュ差分は
   baseline JSON の derivation / knownDiscrepancy_metadataHashOnly を参照。 */
const fs = require("fs");
const path = require("path");
global.localStorage = { _s: {}, getItem(k) { return k in this._s ? this._s[k] : null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
global.window = undefined;
const app = require("../docs/app.js");
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, "splitswap_baseline.json"), "utf8"));
let ethers = null;
try { ethers = require("/home/hatch/workspace/qom-staking/node_modules/ethers"); } catch (e) { /* ハッシュ表示用のみ。無くてもバイト比較は行う */ }

const ROUTER_SELECTOR = "0xf887ea40"; // SplitSwap.router()

async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(method + ": " + (j.error.message || JSON.stringify(j.error)));
  return j.result;
}

(async () => {
  const arg = process.argv[2];
  const address = (process.argv[3] || "").toLowerCase();
  const spec = baseline.chains[arg];
  if (!spec || !/^0x[0-9a-f]{40}$/.test(address)) {
    console.error("使い方: node probe/verify_shared_splitswap.cjs <42|ql1> <address>");
    process.exit(2);
  }
  const chainObj = app.CHAINS[spec.chainKey];
  const rpcUrl = chainObj.rpcs[0];
  console.log(`=== 共有 SplitSwap 検証: ${spec.label} (chainId ${spec.chainId}) @ ${address} ===`);
  console.log("RPC:", rpcUrl);
  let failures = 0;
  const check = (name, ok, detail) => {
    console.log((ok ? "PASS" : "FAIL"), "-", name, detail ? "| " + detail : "");
    if (!ok) failures++;
  };

  // 1) chainId
  try {
    const cid = parseInt(await rpc(rpcUrl, "eth_chainId", []), 16);
    check("chainId", cid === spec.chainId, "got " + cid);
  } catch (e) { check("chainId", false, e.message); }

  // 2)+3) コード存在とバイトコード一致
  let code = null;
  try {
    code = await rpc(rpcUrl, "eth_getCode", [address, "latest"]);
  } catch (e) { check("eth_getCode", false, e.message); }
  if (code !== null) {
    const exists = !!code && code !== "0x";
    check("コード存在", exists, exists ? ((code.length - 2) / 2) + " bytes" : "コードなし (未デプロイの住所)");
    if (exists) {
      const same = code.toLowerCase() === spec.expectedRuntimeHex.toLowerCase();
      let detail = "期待 " + spec.expectedRuntimeBytes + " bytes";
      if (ethers) detail += " | 実コード keccak " + ethers.keccak256(code) + " / 期待 " + spec.expectedRuntimeKeccak256;
      if (!same) {
        // 最初の差分位置を出す (immutable スロット内だけの差ならルーター違いの可能性)
        const a = code.toLowerCase(), b = spec.expectedRuntimeHex.toLowerCase();
        let i = 0; while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
        detail += " | 最初の差分 at hex char " + i + " (byte " + Math.floor((i - 2) / 2) + ")";
      }
      check("ランタイムバイトコード完全一致", same, detail);
    }
  }

  // 4) router()
  if (code && code !== "0x") {
    try {
      const res = await rpc(rpcUrl, "eth_call", [{ to: address, data: ROUTER_SELECTOR }, "latest"]);
      const got = "0x" + (res || "").slice(-40);
      check("router()", got.toLowerCase() === spec.router.toLowerCase(), "got " + got + " / 期待 " + spec.router);
    } catch (e) { check("router()", false, e.message); }
  }

  console.log(failures === 0 ? "\nVERIFY RESULT: PASS — 想定どおりの共有 SplitSwap です" : "\nVERIFY RESULT: FAIL (" + failures + " 件) — この住所は共有 SplitSwap として使えません");
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("VERIFY ERROR:", e.message || e); process.exit(1); });
