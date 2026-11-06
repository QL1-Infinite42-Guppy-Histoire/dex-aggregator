# DEXアグリゲーター（42 Chain / QL1 / 42 Testnet）— v2

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**サイト: https://ql1-infinite42-guppy-histoire.github.io/dex-aggregator/**
**English: https://ql1-infinite42-guppy-histoire.github.io/dex-aggregator/en.html**

42 Chain（Infinite、EVM 421018）、QL1（EVM 766）、42 テストネット（EVM 421018001）で、
トークンの交換（スワップ）のときに**いちばん多く受け取れるプランを全部のプールから探す**サイトです（1inch と同じ考え方）。

例：USDT → 42 は直接交換できるだけでなく、USDT → FISH → 42 のように経由する道もあります。
さらに金額を複数のルートに分ける「分割」も含め、金額によって最適が変わるため、
このサイトは候補を全部見積もって並べ、選んだプランでそのまま交換できます。

## 使い方

1. チェーン（42 Chain / QL1 / 42 Testnet）を選ぶ
2. 出すトークン・金額・受け取るトークンを選ぶ（金額は 25% / 50% / 75% / MAX チップでも指定可）
3. 「ルートを比べる」を押す → 単一ルートと分割プランが、受け取れる量の多い順に並ぶ
4. 好きなプランを選び、MetaMask を接続して交換する

一覧に無いトークンは、CA（コントラクトアドレス）を貼るとチェーンから読み取って追加できます（このブラウザに保存されます）。

## ルートと分割の探し方

- DEX ルーター（42 Chain: Don't Panic / Nutri-Matic、QL1: QomSwap、どちらも Uniswap V2 方式）の
  `getAmountsOut` を、以下の全候補で実際に叩いて比較します。
  - 直接（A → B）
  - 1つ経由（A → X → B）: X はチェーンの基準トークン全部
  - 2つ経由（A → X → Y → B）: 基準トークンの全ペア
  - **分割**: 上位3ルートへの配分（2ルートは 90/10〜50/50、3ルートは 50/30/20 など）を
    部分金額で実際に見積もり、単一ベストより多ければ「分割プラン（おすすめ）」として提示
- 各プランには、直接ルートとの差（%）、交換回数、プール残高から計算した
  「値段の下がり幅（手数料＋価格への影響）」、ガス代の目安を表示します。
- 直接プールが無いペアでも、経由ルートがあれば成立します（例: QL1 の BABY → KET は WQOM 経由）。

## 正直な限界（分割の実行について）

分割を1回の取引で実行するには専用のアグリゲーター・コントラクトが必要です。
このリポジトリにはそのコントラクト **SplitSwap**（`contracts/SplitSwap.sol`、コンパイル済み
`contracts/SplitSwap.json`、デプロイ手順 `contracts/deploy.cjs`）を用意しましたが、
**まだどのチェーンにもデプロイされていません**。

- 42 Chain / QL1 本番: 分割は見積もりのみ。実行は単一ルートです（サイトにも明記）。
- 42 テストネット: デプロイを試みましたが、デプロイ用アドレスの TEST42 残高が 0 で、
  TEST42 の公開ファウセットが見つからなかったため未デプロイです。
  TEST42 が手に入れば `TESTNET_PRIVATE_KEY=… node contracts/deploy.cjs` でデプロイでき、
  `docs/app.js` の `CHAINS.testnet.aggregator` にアドレスを入れるだけで分割実行が有効になります。

## テストネットについて

- RPC: https://evm-rpc-testnet.infinitedrive.xyz ／ チェーンID 421018001 ／ 通貨 TEST42
- DEX ルーターは、Builders 投稿の記録が **41桁（1文字多い）で壊れていた**ため、
  1文字削除の全候補（ユニーク38件）をライブRPCで検証し、コードがあり・`factory()` が
  テストネット factory `0x8944AaDc2B88E1eE59Fc079d6E70b23c758494dA` を返し・`WETH()` が
  答えた唯一の候補 `0xfe644aa3e5C9B3901822627a237f5e4c2d012690` を採用しました
  （記録の `…237F5e4eC…` の余分な `e` が原因）。
- トークン一覧（TEST42 / FOXXEY / ARBA / ARBB / pop / TST）は、テストネット factory の
  全6ペアを列挙して作った実物です（`tools/enumerate_testnet.cjs`）。
  メインネットのアドレスを流用していません。

## その他

- 見積もりだけならウォレット不要。交換のときだけ MetaMask を使います。
- スリッページ（見積もりからのズレの許容幅）は 0.5% / 1% / 3% / 自由入力。有効期限20分。
- このサイト自体は手数料を取りません。交換は各 DEX のルーターと直接やり取りします。
- プールが小さいトークンでは結果がズレやすくなります。小額で試してから使ってください。

## English summary

A DEX aggregator for 42 Chain (Infinite, EVM 421018), QL1 (EVM 766) and the 42 Testnet
(EVM 421018001), in the style of 1inch. For any swap it quotes **every** candidate route —
direct, 1-hop and 2-hop paths through the chain's base tokens — plus **split allocations**
across the top routes (90/10 … 50/50 and 3-way splits), using the DEX router's real
`getAmountsOut` for each partial amount. Plans are ranked by actual output, with price
impact and estimated gas shown, and the selected single route can be executed via MetaMask.

Honest limits: executing a split in one transaction requires a dedicated aggregator
contract. The contract (**SplitSwap**, in `contracts/`) is written and compiled but **not
deployed yet** — on mainnet, splits are quote-only; on the testnet, deployment is blocked
only by the lack of TEST42 for gas (no public faucet was found). The testnet router
address in public records was corrupted (41 hex digits); the address used here was
recovered by verifying every single-character deletion live on-chain. The testnet token
list is built from the testnet factory's real pairs. English UI:
https://ql1-infinite42-guppy-histoire.github.io/dex-aggregator/en.html

## 開発

ビルド不要の静的サイトです（`docs/` がそのまま GitHub Pages）。

```sh
node probe/probe.cjs               # ライブ見積もり・分割評価・calldata構築の検証（送信はしません）
node tools/harness.cjs             # 出荷コードを DOM スタブ上で動かす検証（JP/EN/テストネット）
node tools/enumerate_testnet.cjs   # テストネット factory の全ペア列挙
```

## 更新履歴

- **v2（2026-11-06）**: 1inch風パネル（You pay / You receive・レート反転・ガス目安）、
  分割プランの評価と％バー表示、42 テストネット対応（ルーター復旧・実ペアのトークン一覧）、
  英語版（en.html）、SplitSwap コントラクト同梱（未デプロイ）。
- v1（2026-11-06）: 42 Chain / QL1 のルート比較と単一ルート実行。

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 QL1-Infinite42-Guppy-Histoire
