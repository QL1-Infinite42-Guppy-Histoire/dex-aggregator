"use strict";
/* SplitSwap を Infinite テストネット (421018001) にデプロイする。
   使い方: TESTNET_PRIVATE_KEY=0x... node contracts/deploy.cjs
   - 鍵は環境変数でのみ渡す。リポジトリに鍵を置かないこと。
   - ethers が必要 (npm i ethers)。デプロイには TEST42 (ガス代) が必要。
   - 公開ファウセットは 2026-11-06 時点で見つかっていない。残高0だと
     "insufficient funds" で失敗する（その場合はコミュニティに TEST42 を依頼）。*/
const fs = require("fs");
let ethers;
try { ethers = require("ethers"); } catch (e) {
  try { ethers = require("/home/hatch/workspace/qom-staking/node_modules/ethers"); }
  catch (e2) { console.error("ethers が必要です: npm i ethers"); process.exit(1); }
}
const RPC = "https://evm-rpc-testnet.infinitedrive.xyz";
const TESTNET_ROUTER = "0xfe644aa3e5c9b3901822627a237f5e4c2d012690"; // 復旧済み (factory()=テストネットfactory を確認)
(async () => {
  const pk = process.env.TESTNET_PRIVATE_KEY;
  if (!pk) { console.error("TESTNET_PRIVATE_KEY が未設定です"); process.exit(1); }
  const artifact = JSON.parse(fs.readFileSync(__dirname + "/SplitSwap.json", "utf8"));
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(pk, provider);
  const bal = await provider.getBalance(wallet.address);
  console.log("deployer:", wallet.address, "| TEST42 balance:", ethers.formatEther(bal));
  if (bal === 0n) { console.error("残高0のためデプロイできません (insufficient funds)。TEST42 を入手してから再実行してください。"); process.exit(2); }
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(TESTNET_ROUTER);
  console.log("deploy tx:", contract.deploymentTransaction().hash);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("SplitSwap deployed:", addr);
  console.log("router():", await contract.router());
  console.log("code bytes:", ((await provider.getCode(addr)).length - 2) / 2);
  console.log("→ docs/app.js の CHAINS.testnet.aggregator にこのアドレスを設定すると分割実行が有効になります。");
})().catch((e) => { console.error("DEPLOY FAILED:", e.shortMessage || e.message); process.exit(1); });
