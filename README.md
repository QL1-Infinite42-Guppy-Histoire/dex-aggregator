# DEXアグリゲーター（42 Chain / QL1 / 42 Testnet）— v6.1

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

### 全体ルート表示（v5）

v5 から、クロスチェーンの結果は中継ごとの最良1件ではなく、
**全体ルート（交換1 → ブリッジ → 交換2 を1つに束ねた通り道）** を単位に並べます。
中継の仕組みはトークン固有ではなくブリッジ接続の有無だけが条件なので、
ブリッジペア表にある全トークン（QOM / BABY / CAW / FATHER / HAWK / KET / O / OSAK、
向きの有効範囲は下記の実在確認どおり）に対して一般的に列挙します
（トークン名のハードコードなし・ペア表駆動）。

- 交換1は上位3パス（直接・1つ経由・2つ経由）、交換2は「各交換1バリアントには
  最良パス、交換1の最良バリアントには上位3パス」を組み合わせ、重複を除去。
  中継ごとに最大4件・全体で最大24件（中継ごとの最良とベンチマークのルートは必ず保持）。
- 各全体ルートの最終額は、そのバリアントの交換1の実出力を入力にして交換2を
  実際に見積もり直した値です（最良レッグの額を別のパスに流用しません）。
- カードには通り道全体を1本の鎖で表示します。例（1000 USDT → QL1 の QOM、実測）:
  - `USDT → 42 → FISH → QOM（42 Chain）⇢ ブリッジ ⇢ QOM（QL1）` = **931,938,815,018 QOM**（基準）
  - `USDT → FISH → QOM（42 Chain）⇢ ブリッジ ⇢ QOM（QL1）` = 846,349,806,769 QOM
  - `USDT → 42 → QOM（42 Chain）⇢ ブリッジ ⇢ QOM（QL1）` = 164,083,781,214 QOM
    （QOM/42 プールが小さいため、42 だけ経由だと大きく目減りします。単純なルートも
    隠さず並べるので、なぜ遠回りが勝つのかがその場で分かります）
  - 中継 CAW の最良: `USDT → 42 → FISH → CAW ⇢ qCAW → QOM` = 173,331,261,165 QOM
  - 中継 BABY の最良: `USDT → 42 → FISH → BABY ⇢ BABY → QOM` = 485,927,843,971 QOM
  - 中継 FATHER 337,798,379,437 / O 157,372,279,933 / HAWK 103,843,095,001 /
    KET 67,926,878,543 QOM（同条件の最良全体ルート）
- 実行は選んだ全体ルートの通り道そのものを使います。「このルートではじめる」で
  交換1・交換2のパス（アドレス列）がフローに保存され（localStorage、再開時も保持）、
  ステップ1とステップ4は保存パスで再見積もりしてから実行します。保存パスが
  使えなくなっていた場合は、別のルートへ勝手に切り替えず、理由を表示して止まります。
  v4 以前の保存フロー（パス無し）は従来どおり同一チェーン画面への受け渡しで継続できます。
- 価格差ボードは従来どおりで、行クリックではその中継の最良全体ルートが選ばれます。

### クロスチェーン分割（v6 / v6.1）

v6 から、クロスチェーンでも **全体ルート同士の分割** を評価します
（同一チェーン内モードの分割と同じ考え方を、全体ルート単位に広げたもの）。

- 候補は最終見積もり順の全体ルート上位6件＋中継ごとの最良ルート（最大8件。
  直接ブリッジの全体ルートもパート候補に含む）。v6.1 からは **同じ中継の
  異なるパス（leg1 / leg2 バリアント）も別々の候補** になり、ペア・3分割・
  4分割の全てを10%刻み（各パート10%以上）で探索します（10%刻みのグリッド
  探索であり、厳密な最適化ではありません）。
- ただし、交換2が実在する中継（中継 ≠ 宛先トークン）は1配分に1パートまで
  です。同一プールへの宛先側の交換を2パートに分けると、独立見積もりの
  合計が実額を上振れして見えるためです（実測: 10B QOM で BABY バリアント
  同士の 50:50 が単独ベストを +0.33% 上回って見えた）。中継 = 宛先トークン
  の場合は宛先側にプールが無いので、複数パート（パスの違いのみ）を許可
  します — 同一チェーン分割で USDT→FISH→QOM と USDT→42→FISH→QOM に
  分けるのと同じ状況です。
- 各パートは、その全体ルートの保存パスをそのパートの金額で実際に
  見積もり直します（交換1 → ブリッジ1:1 → 交換2。交換1の出力がブリッジ
  最小量未満のパートは不成立）。最良レッグの額の流用はしません。
- **分割プランのカードは、最良の分割が単一ベスト全体ルートに勝ったときだけ**
  出ます。負けるときは「今回は単一ルートがいちばん」と小さく表示するだけです。
  実測の対照（2026-11-06）:
  - 100 USDT（42 Chain）→ QOM（QL1）: 単一ベスト 158,939,386,644.5 QOM
    （親実測と一致）。50:50（中継QOM/BABY）= 173,506,993,671.8（+9.17%、
    親実測と完全一致）。v6 の探索最良は 40/40/20（QOM/BABY/FATHER）=
    175,951,409,029（+10.70%）。v6.1 では中継QOM の FISH 経由バリアントも
    入った 40/30/20/10（BABY/QOM/QOM/FATHER）= 約176.8B（**+11.2%**）が
    最良になり、分割プランとして提示されます。
  - 1,000 USDT（42 Chain）→ QOM（QL1）（v6.1）: 単一ベスト（中継QOM、
    leg1 USDT→42→FISH→QOM）931,938,815,018.81 QOM。v6 のプランは
    70/20/10 = 1,139,337,772,809 で、leg1 **USDT→FISH→QOM** のパートが
    候補から漏れていました。v6.1 の探索最良は **40/30/20/10
    （R1/R2/BABY/FATHER）= 1,290,684,698,120（+38.49%）** で、親の
    手計算ベストと一致。R2 単独は 846,349,806,769 QOM です。
  - 10B QOM（42 Chain）→ QOM（QL1）: 単独 BABY 経由 11,954,927,955
    （+19.55%）が最良の分割 11,916,683,987（−0.32%）にも勝ち、
    **分割プランは出ません**。全ルートが前半 QOM→FISH を共有するため
    分散効果が薄く、限界レートの高い BABY に寄せ切る方が多い、という
    実見積もりどおりの結論です。
- 実行はパートごとのガイド式フローです（状態は localStorage に保存・再開可）:
  フェーズ1 = パートごとの交換1（保存パスを再見積もりして実行、受け取り量は
  残高差分で記録）→ フェーズ2 = パートごとのブリッジ → フェーズ3 = 中継
  トークンごとの到着監視（同じ中継のパートは順番に帰属させ、最後のパートが
  実際の残り全部を受け取る）→ フェーズ4 = パートごとの交換2（交換2が
  そのまま受け取りトークンのパートは自動完了）。保存パスが使えなくなった
  パートは理由を表示して止まり、別ルートへは切り替えません（他パートは続行）。
- **ブリッジはパートごとに別送信**です。42 Chain 発のメッセージ代
  （quoteNative、実測約3.07 [42]）はパート数分かかります。カードには
  合計額を明示します（QL1 発は実測0のまま）。DEX ガスもパート数分です。
- v3〜v5 の単一ルート保存フローは従来どおり再開できます（復元の互換を維持）。

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

## 価格差（裁定）（v4）

QL1 と 42 Chain の間の価格差を、2つの形で表面化します。

### クロスチェーン見積もりのベンチマーク＋節約バッジ

- 各クロス見積もりで「素直なルート」を**ベンチマーク**にします。中継 QOM の候補と、
  出すトークンそのものを直接ブリッジできる場合はその候補のうち、多い方です。
- 全候補カードにベンチマークとの差（%と量）を表示し、いちばん多い候補が
  ベンチマークより 0.5% 超多いときは「価格差で +○%」バッジが付きます。
- 中継候補は3形態を区別して表示します：
  (a) 出すトークンそのものを**直接ブリッジ**（交換1は「直接ブリッジ（スワップなしで
  そのまま入る）」と表示。例：Infinite の CAW をそのまま送って QL1 で qCAW → QOM）、
  (b) 別トークンに換えてからブリッジ（購入型中継）、(c) QOM 中継（ベンチマーク）。
- 実測（2026-11-06、ユーザーの例）：42 Chain の **100 [42] → QL1 QOM** では
  中継 BABY が **114,095,040,112 QOM** で、ベンチマーク（中継 QOM の
  107,256,718,156 QOM）より **+6.38%**。ただし **5,000 [42]** では BABY の
  プールが吸収しきれず **−63.50%** と逆転（境目は 100〜200 [42] の間：
  200 では −5.3%）。価格差は金額で消えるので、自分の金額での見積もりが必須です。
- 直接ブリッジの実測：CAW 10,000（Infinite→QL1 QOM）は直接ブリッジ
  20,196.81 QOM で、QOM ベンチマーク 20,381.03 QOM より −0.90%（この金額では
  わずかにベンチマーク勝ち）。O 10,000,000 では直接ブリッジ自体が
  ベンチマークになり 4,166,595,462 QOM（QOM 経由は −8.55%）。
  逆向き qCAW 10,000（QL1→42 Chain QOM）でも直接ブリッジがベンチマーク
  （20,381.03 QOM、QOM 経由は −0.90%）。

### 価格差ボード

- 基準通貨 **QOM** で始めて QOM で終わるルートを、全ブリッジ可能トークン
  （QOM / BABY / CAW / FATHER / HAWK / KET / O / OSAK）× 両方向で計算します。
  QL1 側のトークンは QL1 版アドレス（qCAW = 0xd214…9d0d、O = 0x6c39…bed4 など）で
  評価し、Infinite 側の同名アドレスとは混同しません。
- **スポット価格の比較は使いません。** 薄いプールではスポット差が嘘になるため、
  全行とも実際のルート見積もり（各レッグの `getAmountsOut`）で計算します。
- **片道裁定**：QOM（チェーンA）→ T に交換 → ブリッジ → T → QOM（チェーンB）。
  ベンチマークは QOM の直接ブリッジ（1:1 で開始額のまま）。
  差し引きはブリッジのメッセージ代を QOM 換算して差し引いたもの
  （42 Chain 発は `quoteNative` の実額を 42→QOM の実見積もりで換算、実測
  約 3,454,301,132 QOM ≈ 2.94 [42]；QL1 発は 0）。DEX 手数料は見積もり内に
  含まれます。ガス代は概算のため含みません（サイトに明記）。
- **往復裁定**：片道の後、得た QOM を元のチェーンへブリッジして戻す。
  両方向のメッセージ代を差し引きます。「ブリッジ2回＝価格変動の時間が2倍」の
  強い注意つき。行を押すと片道目のガイド式フローが事前入力され、完了後に
  戻りのフローを開始するボタンが出ます（自動送信はしません）。
- マイナスの行も灰色で「今はマイナス（裁定なし）」と表示します。プラスが
  無いときは無いと正直に出します。レッグが成立しない・ブリッジ最小量未満の
  行は「見積もり不可」＋理由です。
- 金額プリセットは 1億 / 10億 / 1000億 QOM、初期値は **1000億 QOM**。
  理由：42 Chain 発の固定メッセージ代（約34.5億 QOM 換算）が、10億 QOM では
  開始額の345%に達して全行が手数料だけで意味を失うため。1000億では約3.5%に
  収まります。逆に 1兆 QOM では全行が価格への影響で大幅マイナスでした。
  小さい金額（1億）では QL1 発の小口の差が見えます（実測 OSAK +187.56%、
  CAW +0.85%。ただし OSAK の +187% は絶対額では約1.9億 QOM の話で、
  1000億では −87.17% に消えます）。
- ボード実測スナップショット（1000億 QOM、2026-11-06）：プラスの片道は
  **0件**。最良は QOM（QL1→42、そのまま）±0%、BABY（42→QL1）−3.91%
  （手数料を引く前は −0.46% で、手数料 3.45% が効いています）。
  往復の最良も同 −3.45%（QOM 42→QL1→42、手数料1回分のみ）。
  つまりこの金額・この時点では裁定は存在せず、ボードはその通りに表示します。

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

**New in v4 — price gaps (arbitrage):** cross-chain quotes now carry a benchmark
(the better of the via-QOM route and, when the token you pay is itself
bridgeable, the direct-bridge route), show every candidate's difference from
it, and badge the best candidate with "Price gap +x%" when it beats the
benchmark by over 0.5% (measured: 100 [42] -> QOM on QL1 via BABY paid
+6.38% over the QOM benchmark; at 5,000 [42] the BABY pools cannot absorb
the size and it flips to −63.5%). Direct bridges are labelled as such (no
swap on the source side; e.g. CAW held on 42 Chain bridged as-is and sold
for QOM on QL1 measured 20,196.81 QOM vs the 20,381.03 QOM benchmark at
10,000 CAW — at that size the benchmark was slightly better, and the board
says so). A new **Price gaps board** computes, in QOM terms, one-way and
round-trip arbitrage routes for all 8 bridgeable tokens in both directions
using real route quotes only (no spot-price comparisons — these pools are
too thin for spots to be honest), deducting bridge messaging fees converted
to QOM (42 Chain origin measured approx. 3.45B QOM; QL1 origin 0). Negative
routes are shown greyed as "no arbitrage right now" and unquotable ones
with their reason; at the 100B QOM default, the build-time snapshot had
**zero** positive one-way routes, and the board displays exactly that.
Clicking a route pre-fills the guided cross-chain flow (round trips offer
the return leg after the first completes; nothing is auto-sent).

**New in v5 — full routes:** cross-chain results are now listed as FULL
ROUTES (one bundled "swap 1 -> bridge -> swap 2" path each), not one best
combination per bridge token. For every bridgeable token (the enumeration
is driven by the bridge-pair table — any token with a working bridge can
relay, nothing is token-specific), the top-3 swap-1 paths are combined
with the best swap-2 path per variant (plus the top-3 swap-2 paths for the
best swap-1 variant); each full route's final figure is computed by
actually quoting swap 2 with that variant's swap-1 output. Caps: 4 routes
per bridge token, 24 total, with every token's best route and the
benchmark route always kept. Simpler routes stay visible even when far
worse — measured at 1,000 USDT (42 Chain) -> QOM (QL1): via 42+FISH
931,938,815,018 QOM (benchmark), via FISH only 846,349,806,769, via 42
only 164,083,781,214 (the QOM/42 pool is tiny, which is exactly why the
longer route wins). Best full routes in the same quote: BABY
485,927,843,971 / FATHER 337,798,379,437 / CAW 173,331,261,165 / O
157,372,279,933 / HAWK 103,843,095,001 / KET 67,926,878,543 QOM. Starting
a route stores its exact leg paths in the guided flow (persisted across
reloads); steps 1 and 4 re-quote and execute along the stored paths and
stop with an explanation rather than switching paths if a stored path
stops working. Flows saved by v4 (no stored leg-2 path) keep the old
hand-off behaviour.

**New in v6 — cross-chain split plans:** splits ACROSS full routes are now
evaluated in cross-chain mode, the same way same-chain mode splits across
routes. Candidates are the top full routes (distinct bridge tokens first,
the direct-bridge route included); all pairs in 10% steps plus triples
among the top 3 distinct-intermediate routes are searched, and every part
is re-quoted through its own full route at its own amount. A split plan
card is shown ONLY when the best split beats the best single full route —
measured contrast (2026-11-06): 100 USDT (42 Chain) -> QOM (QL1), best
single 158,939,386,644.5 QOM, a 50:50 QOM/BABY split reproduces the
parent measurement 173,506,993,671.8 (+9.17%) exactly, and the search's
best (40/40/20 QOM/BABY/FATHER) reaches 175,951,409,029 (+10.70%); while
at 10B QOM -> QOM (QL1) the single BABY route (11,954,927,955, +19.5%)
beats every split (best split −0.32% vs it), so no plan is offered.
Execution is a grouped per-part guided flow (all swap-1s, then all bridge
sends, then per-token arrival watch with in-order attribution — the last
part on a token takes the actual remainder — then all swap-2s; identity
leg-2 parts finish automatically), persisted in localStorage like the
single-route flow. Each part bridges separately, so a 42 Chain origin
pays the quoteNative messaging cost once per part; the plan's total is
shown on the card. v3–v5 saved single-route flows still resume.

**New in v6.1 — wider cross-chain split search:** the split candidate set
is now the top full routes overall (top 6 by final output, plus every
intermediate's best route, max 8), and same-intermediate path variants
(e.g. the QOM route with leg 1 USDT→FISH→QOM) are distinct candidates;
pairs, triples and quads are all searched on a 10% grid (a heuristic grid
search, not an exact optimum). One composition rule: at most one part per
intermediate when that intermediate has a real leg-2 swap — two parts
into the same destination pool would overstate their independently
quoted sum (measured: a BABY-variant 50:50 at 10B QOM appeared +0.33%
above the best single); multiple parts per intermediate are allowed when
leg 2 is the identity (intermediate = destination token, no destination
pool — the same situation as same-chain splits). Measured
(2026-11-06): 1,000 USDT (42 Chain) -> QOM (QL1) — best single
931,938,815,018.81 QOM; the v6 plan (70/20/10) reached 1,139,337,772,809
but contained no USDT→FISH→QOM part; the v6.1 search finds
40/30/20/10 (R1/R2/BABY/FATHER) = 1,290,684,698,120 (+38.49%), exactly
the hand-computed best. At 100 USDT the best split improves to about
176.8B (+11.2%, now a 4-part plan including the via-FISH QOM variant);
at 10B QOM -> QOM the best split still loses (−0.32%) and no plan is
offered.

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
node probe/arb.cjs                 # 価格差: 具体例 (42->QOM)・直接ブリッジ比較・ボード全行スナップショット
node probe/fullroutes.cjs          # v5全体ルート: 1000 USDT->QL1 QOM の4例照合・全中継カバー・非ベストルートのcalldata照合
node probe/splitcross.cjs          # v6/v6.1クロス分割: 100 USDT の勝ちケース・10B QOM の対照 (単一勝利)・1,000 USDT のケースC (R2パート入り +38.5%)・パートcalldata照合
node tools/harness.cjs             # 出荷コードを DOM スタブ上で動かす検証（JP/EN/テストネット/クロスチェーン）
node tools/enumerate_testnet.cjs   # テストネット factory の全ペア列挙
node tools/bridge/sample_counts.cjs    # ブリッジ各ルーターの実txメソッド集計
node tools/bridge/sample_delivery.cjs  # 実送信の messageId → 届け先 mailbox の delivered() 照合
```

## 更新履歴

- **v6.1（2026-11-06）**: クロスチェーン分割の探索範囲を拡張。候補を
  「中継ごとの最良だけ」から「全体ルートの最終額順 上位6件＋中継ごとの
  最良（最大8件）」に広げ、同じ中継のパスバリアント（例: 中継QOM の
  leg1 USDT→FISH→QOM）も別候補に。ペア・3分割に加えて4分割も10%刻みで
  探索（グリッド探索であり厳密な最適化ではない）。1,000 USDT→QL1 QOM で
  v6 のプラン（70/20/10 = 1,139.34B）に無かった R2 パートを含む
  40/30/20/10 = 1,290,684,698,120 QOM（単一ベスト比 +38.49%）が最良に。
  100 USDT のケースも +11.2%（4パート）に改善。宛先側の同一プールへの
  二重計上を避けるため、交換2が実在する中継は1配分1パートまで（中継 =
  宛先トークンで交換2が無い場合は複数可）という構成ルールを追加し、
  10B QOM の対照ケースでは従来どおり分割プランを出さない（最良の分割
  −0.32%）。実行フロー（グループフェーズ型）は v6 から不変で、同一中継の
  2パート（異なる leg1 パス）でも到着帰属とフェーズ進行が正しいことを
  ハーネスで検証。
- **v6（2026-11-06）**: クロスチェーン分割プラン。全体ルート同士の割合配分を
  実見積もりで探索し（ペア全組×10%刻み＋中継が異なる上位3件の3分割）、
  単一ベストに勝ったときだけ分割プランのカードを提示（100 USDT→QL1 QOM で
  +10.70%）。負けるケースでは正直に単一推奨のまま（10B QOM→QL1 QOM では
  単独 BABY 経由が全分割に勝利し、プランは出ない）。実行はパートごとの
  グループフェーズ型ガイドフロー（交換1群→ブリッジ群→中継ごとの到着監視と
  順序帰属→交換2群、localStorage 保存・再開可）。ブリッジはパートごとに
  別送信で、42 Chain 発のメッセージ代はパート数分（カードに合計明示）。
- **v5（2026-11-06）**: クロスチェーン結果を「全体ルート」単位に変更。中継ごとに
  交換1・交換2の上位バリアントを組み合わせた全体ルートを最終額順に並べ（中継ごとに
  最大4件・全体24件）、通り道全体を1本の鎖で表示。選んだ全体ルートのパスがフローに
  保存され、ステップ1/4はその保存パスで再見積もりして実行（使えなくなっていたら
  切り替えずに停止）。単純なルートも隠さず表示（例: 1000 USDT→QL1 QOM で
  42経由だけのルート 164,083,781,214 QOM も一覧に残る）。
- **v4（2026-11-06）**: 価格差（裁定）の表面化。クロスチェーン見積もりに
  ベンチマーク（中継 QOM / 直接ブリッジの多い方）との差表示と「価格差で +○%」
  バッジ、直接ブリッジの明示を追加。「価格差ボード」を新設：QOM 建てで
  全8トークン×両方向の片道・往復裁定を実見積もり（スポット比較なし）で計算し、
  メッセージ代（QOM換算）を差し引いて並べ、行クリックでガイド式フローに
  事前入力。マイナス・見積もり不可も正直に表示。
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
