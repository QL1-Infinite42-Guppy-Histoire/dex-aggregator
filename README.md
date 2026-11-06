# DEXアグリゲーター（42 Chain / QL1 / 42 Testnet）— v3

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

## クロスチェーン（v3）

「クロスチェーン」モードでは、QL1 ⇔ 42 Chain の間で
**交換 → ブリッジ → 交換** を束ねて見積もり、案内どおりに進められます。

- 中継トークンの候補（QOM / BABY / CAW / FATHER / HAWK / KET / O / OSAK）ごとに、
  送る側の最良ルート見積もり × ブリッジ（手数料0・1:1）× 届く側の最良ルート見積もり を計算し、
  最終見積もりの多い順に並べます。中継の最適は直感と違うことがあります
  （実測: QL1 QSWAP → 42 Chain FISH では中継 QOM より OSAK が多く、
  逆向き FISH → QSWAP では中継 QOM より BABY が約19%多くなりました）。
- 実行は4ステップのガイド式です（各ステップでウォレット確認が必要、自動送信なし）。
  進み具合はブラウザ（localStorage）に保存され、画面を閉じても再開できます。
  到着確認は、届く側チェーンで自分のトークン残高が増えたかを公開RPCで自動チェックします。
- 最後の交換は到着時点の値段で再見積もりするので、最終見積もりは目安です。
  到着には数分かかることがあります（実測で約5分40秒の例あり）。

### ブリッジの実在確認（有効範囲の根拠）

有効にしている向き・トークンは、推測ではなく実取引のサンプリングで決めています
（`tools/bridge/sample_delivery.cjs`、結果は `tools/bridge/sampling_results.json`）。

- 方法: 各ルーターの直近の実送信トランザクションから Hyperlane のメッセージIDを取り、
  届け先チェーンのメールボックスで `delivered(messageId)` が true になるかを確認。
- **QL1 → 42 Chain: 全8トークン × 2件 = 16/16 が配達済み** → 全トークン有効。
- **42 Chain → QL1: OSAK を除く7トークンで 13/13 が配達済み** → その7トークンを有効。
  OSAK の 42 Chain 側 BridgeRouter は全履歴が管理txのみで送信実績が0件のため、
  この向きだけ無効にしています（サイトにも理由を表示）。
- bridge.zaphod.one の公式統計では「QL1発の配達0件」と出ますが、それは統計側の
  索引が QL1 を拾えていないためで、チェーン上では上記のとおり配達が確認できています。
- 手数料: 全ペアでブリッジ手数料0（`quoteBridge` の fee=0 を全ルーターで確認）。
  42 Chain から送る場合はメッセージ代が別途必要（`quoteNative(766)` 実測で約2.94 [42]、
  送信時に再取得してそのまま支払う）。QL1 から送る場合はサンプルした全送信が
  支払い額0だったため、0で送ります。
- QL1 側の送信は、Zaphod と同じく warp ルーターへ直接 `transferRemote` を呼びます
  （ラッパー無し）。ルーターが取引トークンをロックボックス経由で xERC20 化する処理は
  その1件のトランザクションの中で行われます（実送信のログで確認済み）。
- テストネットには QL1 とのブリッジが確認できていないため、クロスチェーンは本番同士だけです。

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

**New in v3 — cross-chain (QL1 <-> 42 Chain):** a guided mode that quotes
swap -> bridge -> swap as one plan. For every bridgeable intermediate token
(QOM / BABY / CAW / FATHER / HAWK / KET / O / OSAK) it combines the best
same-chain route on the source chain, the Hyperlane (Zaphod) bridge leg
(fee 0, 1:1), and the best route on the destination chain at current rates,
then ranks the candidates by final estimate. Execution is a 4-step guided
flow (each step signed separately, progress persisted in localStorage,
arrival detected by watching the destination token balance via public RPC;
the final swap re-quotes at arrival-time prices, so the total is an
estimate). A direction/token is enabled only where delivery was proven by
sampling real transactions: message IDs from actual sends were checked
against the destination mailbox's `delivered()` — QL1 -> 42 Chain 16/16
(all 8 tokens), 42 Chain -> QL1 13/13 (7 tokens; OSAK has zero sends in its
42 Chain router's entire history, so that one direction is disabled with
the reason shown). The bridge site's own stats showing "0 QL1-origin
deliveries" are an indexer gap; deliveries are confirmed on-chain. Sending
from 42 Chain additionally pays the messaging fee quoted live by the
BridgeRouter (measured approx. 2.94 [42]); sampled QL1 sends all paid 0.

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
node probe/crosschain.cjs          # クロスチェーン見積もり（2方向）・ブリッジcalldata・delivered再確認
node tools/harness.cjs             # 出荷コードを DOM スタブ上で動かす検証（JP/EN/テストネット/クロスチェーン）
node tools/enumerate_testnet.cjs   # テストネット factory の全ペア列挙
node tools/bridge/sample_counts.cjs    # ブリッジ各ルーターの実txメソッド集計
node tools/bridge/sample_delivery.cjs  # 実送信の messageId → 届け先 mailbox の delivered() 照合
```

## 更新履歴

- **v3（2026-11-06）**: クロスチェーン・モード（QL1 ⇔ 42 Chain）。中継トークンごとの
  交換→ブリッジ→交換の束ね見積もりとランキング、4ステップのガイド式実行（状態は
  localStorage に保存・再開可、到着は残高監視で自動検出）。有効範囲は実送信の
  delivered() 照合で決定（QL1→42 は全8トークン、42→QL1 は OSAK を除く7トークン）。
- **v2（2026-11-06）**: 1inch風パネル（You pay / You receive・レート反転・ガス目安）、
  分割プランの評価と％バー表示、42 テストネット対応（ルーター復旧・実ペアのトークン一覧）、
  英語版（en.html）、SplitSwap コントラクト同梱（未デプロイ）。
- v1（2026-11-06）: 42 Chain / QL1 のルート比較と単一ルート実行。

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 QL1-Infinite42-Guppy-Histoire
