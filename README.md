# DEXアグリゲーター（42 Chain / QL1 / 42 Testnet）— v6.5 + v7

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**サイト: https://ql1-infinite42-guppy-histoire.github.io/dex-aggregator/（開くと英語がデフォルト表示。日本語を選ぶと記憶されます）**
**日本語: https://ql1-infinite42-guppy-histoire.github.io/dex-aggregator/ja.html**
**English: https://ql1-infinite42-guppy-histoire.github.io/dex-aggregator/en.html**

言語は各ページ上部のセレクタ（English / 日本語）でいつでも切り替えできます（v6.3）。

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

### クロスチェーン分割（v6〜v6.5）

v6 から、クロスチェーンでも **全体ルート同士の分割** を評価します
（同一チェーン内モードの分割と同じ考え方を、全体ルート単位に広げたもの）。

- 候補は最終見積もり順の全体ルート上位6件＋中継ごとの最良ルート（最大8件。
  直接ブリッジの全体ルートもパート候補に含む）。同じ中継の異なるパス
  （leg1 / leg2 バリアント）も別々の候補です。
- **探索は2段階（v6.2）**: ステージ1 = 10%刻みグリッド（2〜5パート）＋
  ペアの1%刻み全探索。ステージ2 = 最良配分から1%刻みで微調整する山登り
  （ステップ 5% → 2% → 1%、パート間の移し替え＋未使用候補の追加。追加候補は
  全体ルート一覧の全件から、パート数は最大5）。「1%刻みで微調整した最良」
  であり、数学的な大域最適の証明ではありません。同一チェーン内の分割も
  同じ微調整を使います。
- **同一中継・同一の交換2は合算見積もり（v6.4）**: v6.1 では「交換2が実在
  する中継は1配分に1パートまで」と禁止していましたが、宛先が QOM 以外の
  とき中継 QOM の R1/R2 が組み合わせられない問題があり、禁止ではなく
  合算モデルに置き換えました。同一中継・同一 leg2Path のパート群は、
  交換2 をブリッジ到着額の合計で1回だけ見積もり、出力を到着額に比例配分
  します（端数はグループ内最大パートへ）。v6.1 が避けたかった「同じ宛先
  プールを2回独立見積もりする上振れ」はこれで構造的に消えます。交換1 は
  従来どおりパートごとの独立見積もり（同一チェーン分割と同じ慣例）で、
  実行もパート個別のままです（見積もりモデルだけの変更）。
- 各パートは、その全体ルートの保存パスをそのパートの金額で実際に
  見積もり直します（交換1 → ブリッジ1:1 → 交換2。交換1の出力がブリッジ
  最小量未満のパートは不成立）。最良レッグの額の流用はしません。
- **分割プランのカードは、最良の分割が単一ベスト全体ルートに勝ったときだけ**
  出ます。負けるときは「今回は単一ルートがいちばん」と小さく表示するだけです。
  実測の対照（2026-11-06、プールは時々刻々変わります）:
  - 100 USDT（42 Chain）→ QOM（QL1）: 単一ベスト 158,939,386,644.5 QOM
    （親実測と一致）。50:50（中継QOM/BABY）= 173,506,993,671.8（+9.17%、
    親実測と完全一致）。v6.2 の1%微調整で 177,532,096,521（+11.62%、
    5パート）まで伸び、v6.4 の合算モデルでは BABY・FATHER のバリアント
    分割も使えるため 183,456,862,117（+15.33%）が最良です。
  - 1,000 USDT（42 Chain）→ QOM（QL1）: 単一ベスト（中継QOM、
    leg1 USDT→42→FISH→QOM）931,938,815,018.81 QOM。v6.1 の探索最良は
    **40/30/20/10（R1/R2/BABY/FATHER）= 1,290,684,698,120（+38.49%）** で、
    親の手計算ベストと一致（R2 単独は 846,349,806,769 QOM）。v6.2 の
    1%微調整では 42/34/15/9 = 1,297,738,096,429（+39.19%）まで伸びたものの、
    目標の **1,300B には 2,261,903,571（0.17%）届きませんでした**
    （BABY の QL1 側プールが浅く限界レートが急落するのが上限）。
    v6.4 の合算モデルでは BABY バリアント分割（12%/12%）も正当に使え、
    37/31/12/12/8 = **1,346,962,652,325（+44.46%）** と 1,300B を超えました。
  - 1,000 USDT（42 Chain）→ qCAW（QL1）（v6.4 の動機になったケース）:
    v6.1 では中継QOM の R2 パートが禁止ルールで入らず、実機スクショの
    プランは 550,960,984,867 qCAW（+28.67%）でした。v6.4 では R2 パート
    （27%）を含む5パート = **637,090,857,770 qCAW（+48.77%）** が最良です。
  - 10B QOM（42 Chain）→ QOM（QL1）: **v6.4 で結論が変わりました**。
    v6.1/v6.2 では単独 BABY 経由 11,954,927,955（+19.55%）が勝ち、
    分割プランは出ませんでした（中継が異なる分割の最良は −0.02%）。
    v6.4 では BABY バリアント同士の分割が、交換2を合算した後も +0.70%
    （72/28）勝ち、プランが出ます。内訳を検証したところ、勝ち分は交換2の
    二重見積もりではなく、交換1の第1ホップ（QOM→FISH 直接 と
    QOM→42→FISH）の分散によるもので、交換1の共有区間まで合算した
    反実仮想でも +0.05〜0.12% 勝ちます（同一チェーン分割や中継QOM の
    R1/R2 分割と同じ仕組み）。旧来の「幻の勝ち」という解釈は実測で
    覆ったため、正直な実測として記録します。
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

- **手数料引きで勝つときだけ出す（v6.5、ユーザー決定）**: 分割カードは、
  追加のブリッジ代を引いても単一ベストに勝つ場合にだけ表示します。
  追加代 = プランの全パートのメッセージ代合計 − 単一ベストのメッセージ代
  （= 実質 (パート数 − 1) × quoteNative。QL1 発は 0 なので追加代も 0）。
  換算はこのサイト自身の見積もり機構だけを使います: [42] の追加代を
  Infinite の最良ルートで QOM に替え（ブリッジ 1:1 で QL1 の QOM と同量）、
  宛先が QOM 以外なら QL1 の最良ルートでもう一度替えます（裁定ボードの
  手数料換算と同じ考え方）。換算できなかった場合は安全側でプランを
  出さず、理由を注記します。総量では勝つのに手数料引きで負ける場合は、
  カードの代わりに「利益 +X ＜ 追加手数料 Y」の数字入り注記を出します。
  勝つ場合はカードに手数料引きの利益も表示します。実測（2026-11-06）:
  - ケースB（10B QOM → QOM）: 総勝ち +79,079,974 QOM に対し追加代
    3.0721 [42] ≒ 3,454,417,785 QOM → **手数料負けでプランを出さない**
    （v6.4 で出るようになったプランは、v6.5 で再び出なくなります。
    勝ち分が第1ホップ分散による実在のものである点は変わりません）。
  - ケースA（100 USDT → QOM）: 総勝ち +21,094,652,758、追加代
    12.2884 [42] ≒ 13,755,298,521 → 手数料引き **+7,339,354,237 QOM
    （+4.62%）** で表示。
  - ケースC（1,000 USDT → QOM）: 総勝ち +405,559,552,922、追加代は
    同じ 13,755,298,521 → 手数料引き **+391,804,254,401 QOM（+42.04%）**。
  - ケースD（1,000 USDT → qCAW）: 総勝ち +204,522,537,322 qCAW、追加代
    ≒ 6,762,677,879 qCAW → 手数料引き **+197,759,859,443 qCAW
    （+46.20%）**。
- v3〜v5 の単一ルート保存フローは従来どおり再開できます（復元の互換を維持）。

### 同一チェーン分割の実行（v7）

同一チェーン内の分割は、専用コントラクト **SplitSwap** を使って
1トランザクションで実行できます（従来は見積もりのみでした）。

- **サイト内デプロイ**: チェーンに使える住所が無い場合、交換パネルの下に
  「アグリゲーターをデプロイ」が出ます。自分のウォレットで1回デプロイ
  すると（ガス代は自分の負担、実測見積もり約 1,210,366 gas）、住所が
  そのチェーン用にブラウザ（localStorage `dexagg_aggregator_v1`）へ
  保存され、以降そのブラウザでは分割プランをそのまま実行できます。
  保存前に、デプロイ先にコードがあり `router()` がそのチェーンの
  DEX ルーターと一致することを自動確認します。住所の表示（エクスプ
  ローラーへのリンク付き）と、保存した住所の利用停止（消去）もできます。
  サイト設定（CHAINS）に内蔵住所が入ればそちらが優先されます。
- **コントラクトの変更（v7）**: 各レッグに最低受取量（amountOutMin）を
  追加しました。合計の最低量に加えて、レッグ単体でも見積もり−スリッ
  ページを下回ると全体が失敗します。再コンパイルは solc 0.8.26 /
  optimizer 200 runs / **EVM ターゲット paris** です。QL1 の EVM は
  Shanghai の PUSH0 命令に未対応（デプロイ見積もりが
  "invalid opcode: PUSH0" で失敗することを実測）なため、paris が必須です。
  作成バイトコード 5,601 バイト。権限なし・資産の預かりなしは従来どおり。
- 実行は従来の分割プランそのままです: ERC20 入力ならアグリゲーターへの
  approve → splitSwap 系 tx を1回。ネイティブ入力は value = レッグ合計。
  テストネットも同じデプロイ方法ですが、ガス代に TEST42 が必要です。
- **正直な限界**: この開発環境からは実際の送信はしていません（鍵・資金が
  無いため）。calldata の構築・復号の往復、デプロイ tx の見積もり
  （3チェーン全て成功）、状態遷移は全てローカル検証済みです。実利用の
  最初の一歩は「チェーンごとに1回デプロイ → 少額で初回の分割交換」です。

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
  - **分割**: 上位3ルートへの配分（ペアは1%刻み全探索、3ルートは代表配分）を
    部分金額で実際に見積もり、さらに1%刻みの山登りで微調整（v6.2）。
    単一ベストより多ければ「分割プラン（おすすめ）」として提示
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

**New in v6.2 — 1% split refinement:** after the 10% grid, pairs are
brute-forced at 1% steps and the best plan is hill-climb refined at
5% → 2% → 1% granularity (transfers between parts plus adding any
not-yet-used full route; up to 5 parts; same-chain splits are refined
the same way). This is a local optimum at 1% granularity, not a proven
global optimum. Measured: 1,000 USDT -> QOM (QL1) improved to
42/34/15/9 = 1,297,738,096,429 QOM (+39.19%) — close to, but honestly
short of, the 1,300B line (missed by 2,261,903,571 QOM, 0.17%; the
shallow QL1-side BABY pool caps it). 100 USDT improved to
177,532,096,521 (+11.62%); 10B QOM -> QOM still showed no plan
(best split −0.02%).

**New in v6.3 — language selector, English by default:** the site root
is now a small gate page: it sends you to the English page unless a
saved choice says Japanese. The Japanese page lives at `ja.html`, the
English page at `en.html`, and both headers carry an
English / 日本語 selector that switches immediately and remembers the
choice (localStorage `dexagg_lang`).

**New in v6.4 — combined leg-2 quoting replaces the same-intermediate
ban:** v6.1 allowed at most one part per intermediate with a real leg-2
swap, which also blocked useful combinations (for a qCAW destination,
the QOM intermediate's R1 and R2 routes could not be combined — the
user's screenshot plan had no R2 part). Now, parts sharing one
intermediate and one leg-2 path get ONE combined leg-2 quote on their
summed bridge arrival, distributed back pro-rata — the double-count
v6.1 feared is structurally impossible, while leg 1 stays quoted per
part (the same-chain convention) and execution stays per-part.
Measured: 1,000 USDT -> qCAW (QL1) now plans 637,090,857,770 qCAW
(+48.77%, R2 part included) vs the 550,960,984,867 screenshot baseline;
1,000 USDT -> QOM reaches 1,346,962,652,325 (+44.46%), past the 1,300B
line; 100 USDT -> QOM reaches 183,456,862,117 (+15.33%). One honest
change: at 10B QOM -> QOM a BABY-variant split now wins slightly
(+0.70%) even with leg 2 combined, so a plan IS offered — verification
showed the gain is leg-1 first-hop diversification (QOM→FISH direct vs
QOM→42→FISH; +0.05–0.12% even when the shared leg-1 suffix is also
combined), not the leg-2 double-count, so the old "phantom win"
reading did not survive measurement.

**New in v6.5 — cross-chain splits must win after bridge fees:** a cross
split plan card is now shown only when the split still beats the best
single full route after the EXTRA bridge messaging cost: the plan's
total nativeFee minus the single route's (i.e. (parts − 1) × quoteNative;
QL1-origin bridges cost 0, so the extra is 0 there). The extra fee is
converted into the destination token with the site's own quoting (best
Infinite route 42 -> QOM, bridge 1:1, then the best QL1 route QOM ->
destination when needed — the same method as the arb board's fee
conversion); if conversion is impossible the split is not shown and the
note says why. A gross win that loses after fees gets a small note with
both numbers instead of the card; a net win shows the after-fee gain on
the card. Measured (2026-11-06): case B (10B QOM -> QOM) gross
+79,079,974 QOM vs extra fee 3.0721 [42] ≈ 3,454,417,785 QOM -> plan
hidden with the fee-lose note; case A (100 USDT -> QOM) net
+7,339,354,237 QOM (+4.62%); case C (1,000 USDT -> QOM) net
+391,804,254,401 QOM (+42.04%); case D (1,000 USDT -> qCAW) net
+197,759,859,443 qCAW (+46.20%). Same-chain splits are unchanged.

**New in v7 — same-chain splits execute, via your own SplitSwap
deployment:** same-chain split plans were quote-only because the
SplitSwap aggregator contract was deployed nowhere. Now, when a chain
has no aggregator address, the swap panel shows a "Deploy the
aggregator" button: your wallet deploys the exact SplitSwap bytecode
embedded in the page (published in `contracts/`), the returned address
is verified on-chain (code present, `router()` matches the chain's DEX
router) and saved per chain in this browser (localStorage
`dexagg_aggregator_v1`), and split plans then execute in one
transaction (approve -> one split call), with a built-in CHAINS address
slot taking precedence when set. The address is shown with an explorer
link, and a locally saved one can be cleared. The contract itself
changed minimally: each leg now carries its own minimum output
(leg quote minus slippage) in addition to the total minimum, and it was
recompiled with solc 0.8.26, optimizer 200 runs, **EVM target paris** —
QL1's EVM rejects Shanghai PUSH0 (measured: the deploy estimate failed
with "invalid opcode: PUSH0"), so paris is required; with it, the
deploy estimates cleanly on all three chains (≈1,210,366 gas). The
testnet uses the same in-page deploy but needs TEST42 for gas.

Honest limits: split execution needs the SplitSwap aggregator on the
chain you use — until you deploy it from the page (once per chain, your
own gas), same-chain splits stay quote-only there. No transaction was
broadcast from the development environment (it holds no keys/funds);
calldata construction/decoding round-trips, the deployment transaction
and its gas estimate, and all state transitions are verified locally.
The testnet router address in public records was corrupted (41 hex
digits); the address used here was recovered by verifying every
single-character deletion live on-chain. The testnet token list is
built from the testnet factory's real pairs. Site root
(English by default; Japanese at /ja.html):
https://ql1-infinite42-guppy-histoire.github.io/dex-aggregator/

## 開発

ビルド不要の静的サイトです（`docs/` がそのまま GitHub Pages）。

```sh
node probe/probe.cjs               # ライブ見積もり・分割評価・calldata構築の検証（送信はしません）
node probe/crosschain.cjs          # クロスチェーン見積もり（2方向）・ブリッジcalldata・delivered再確認
node probe/arb.cjs                 # 価格差: 具体例 (42->QOM)・直接ブリッジ比較・ボード全行スナップショット
node probe/fullroutes.cjs          # v5全体ルート: 1000 USDT->QL1 QOM の4例照合・全中継カバー・非ベストルートのcalldata照合
node probe/splitcross.cjs          # v6〜v6.4クロス分割: 100 USDT の勝ちケース・10B QOM の対照 (v6.4でバリアント分割が小幅勝利に転じた所見)・1,000 USDT のケースC (1,300B 目標)・qCAW のケースD (R2パート入り)・パートcalldata照合
node probe/splitswap.cjs           # v7: 内蔵バイトコードと contracts/ の一致・3バリアントのセレクタ/復号照合・デプロイtxの見積もり (3チェーン)
node tools/harness.cjs             # 出荷コードを DOM スタブ上で動かす検証（JP/EN/テストネット/クロスチェーン）
node tools/enumerate_testnet.cjs   # テストネット factory の全ペア列挙
node tools/bridge/sample_counts.cjs    # ブリッジ各ルーターの実txメソッド集計
node tools/bridge/sample_delivery.cjs  # 実送信の messageId → 届け先 mailbox の delivered() 照合
```

## 更新履歴

- **v7（2026-11-06）**: 同一チェーン分割を実際に実行できるようにした
  （ユーザー要望「実際にtx送って取引できるようにして」）。SplitSwap は
  未デプロイだったため、画面内デプロイを追加: チェーンに使える住所が
  無ければ「アグリゲーターをデプロイ」ボタンが出て、自分のウォレットで
  デプロイ → 住所を検証（コード存在＋ router() 一致）してブラウザに
  チェーンごと保存 → 以後は分割プランを1txで実行（approve込み）。
  内蔵住所スロット（CHAINS）があればそちら優先。表示・リンク・消去つき。
  コントラクトは最小変更: レッグごとの最低受取量 amountOutMin を追加し、
  solc 0.8.26 / optimizer 200 / **EVM paris** で再コンパイル（5,601
  バイト）。QL1 の EVM が PUSH0 未対応（Shanghai 版のデプロイ見積もりが
  "invalid opcode: PUSH0" で失敗する実測）のため paris が必須で、paris 版は
  3チェーン全てで見積もり成功（約1,210,366 gas）。実行監査も実施:
  他の全送信経路（同一チェーン単一、クロス単一/分割の各ステップ）の
  spender・value・古い見積もりのみ文言を確認し、分割の approve 先を
  有効なアグリゲーター住所に統一。検証: probe/splitswap.cjs（バイト
  コード一致・セレクタ・3バリアント復号・デプロイ見積もり）、
  probe/probe.cjs（ethers 復号でレッグ minOut 往復）、ハーネス（保存 →
  実行可 → 消去で見積もりのみに戻る、デプロイ tx 復号、スワップボタン
  有効化 JP/EN）。実送信は開発環境からは未実施（鍵・資金なし）で、
  実利用の初回は「チェーンごとに1回デプロイ＋少額の初回取引」。
- **v6.5（2026-11-06）**: クロスチェーン分割の表示ルールを「手数料引きで
  勝つときだけ」に変更（ユーザー決定）。追加のブリッジ代 = プランの
  メッセージ代合計 − 単一ベスト分（実質 (パート数−1) × quoteNative、
  QL1 発は 0）を、サイト自身の見積もり（42→QOM 最良ルート＋ブリッジ
  1:1＋必要なら QL1 側 QOM→宛先）で宛先トークンに換算し、差し引いても
  勝つ場合だけカードを出す。総勝ち・手数料負けなら数字入りの注記に
  切替え、換算不能なら安全側で出さない。実測: ケースB（10B QOM）は
  総勝ち +79,079,974 QOM に対し追加代 ≒3,454,417,785 QOM でプラン
  非表示（注記表示）。ケースA は手数料引き +7,339,354,237 QOM
  （+4.62%）、ケースC は +391,804,254,401 QOM（+42.04%）、ケースD は
  +197,759,859,443 qCAW（+46.20%）で表示。分割フロー開始にも同じ
  ガードを追加。同一チェーン分割・単一ルート・裁定ボードは不変。
- **v6.4（2026-11-06）**: 同一中継の扱いを「禁止」から「合算見積もり」へ。
  ユーザー指摘（宛先 qCAW の分割に USDT→FISH→QOM のルートが入らない）の
  原因だった v6.1 の構成ルール（交換2が実在する中継は1配分1パートまで）を
  廃し、同一中継・同一 leg2Path のパート群は交換2をブリッジ到着額の合計で
  1回だけ見積もり、到着額に比例配分するモデルに置き換え（端数は最大
  パートへ）。実行はパート個別のまま（見積もりモデルだけの変更）で、
  1%微調整（v6.2）の評価にも同じ合算を適用。実測: 1,000 USDT→qCAW は
  R2 パート（27%）入り5パート = 637,090,857,770 qCAW（+48.77%、実機
  スクショの旧プラン 550,960,984,867 からも +15.6%）。1,000 USDT→QOM は
  1,346,962,652,325（+44.46%）で 1,300B を超え、100 USDT→QOM も
  183,456,862,117（+15.33%）に改善。**正直な変更点**: 10B QOM→QOM では
  BABY バリアント分割が合算後も +0.70% 勝ち、プランが出るようになった。
  内訳を検証した結果、勝ち分は交換2の二重見積もりではなく交換1の
  第1ホップ（QOM→FISH / QOM→42→FISH）の分散で、交換1の共有区間まで
  合算した反実仮想でも +0.05〜0.12% 勝つため、旧来の「幻の勝ち」という
  解釈は実測で覆った（経緯は「クロスチェーン分割」の実測対照に詳述）。
  合算の単体テスト（グループ化・比例配分・端数処理）とケースD の
  ライブ検証をハーネスに追加。
- **v6.3（2026-11-06）**: 言語まわりを変更。ルート（index.html）を軽い
  振り分けページにし、保存済み言語（localStorage `dexagg_lang`）が
  「ja」のときだけ日本語ページ、それ以外は **英語がデフォルト** で
  表示されるようにした。日本語ページは `ja.html` として新設（英語は
  従来どおり `en.html`）。両ページのヘッダーに言語セレクタ
  （English / 日本語）を置き、選ぶと即移動＋選択を保存する。
  noscript でも両ページへのリンクから進める。ハーネスで振り分け・
  セレクタの保存・言語判定を検証。
- **v6.2（2026-11-06）**: 分割探索を1%刻みに精密化（ユーザー要望
  「1%刻みで最善の結果を出して」）。クロスチェーン分割は2段階探索に:
  ステージ1 = 従来の10%グリッド（5パートまで拡張）＋ペアの1%刻み
  全探索（プール上位5件間）、ステージ2 = 最良配分からの山登り微調整
  （ステップ 5% → 2% → 1%。パート間の移し替え＋未使用候補の1%追加 —
  追加候補は候補プールでなく全体ルート一覧の全件から。パート数最大5）。
  1%ムーブで改善が無くなれば終了する局所最適であり、大域最適の証明では
  ない。同一チェーン内の分割も同じ微調整を適用（実測: USDT→FISH 500 で
  53/27/20 の非ラウンド配分）。実測（ケースC = 1,000 USDT→QL1 QOM）:
  42/34/15/9 = 1,297,738,096,429（+39.19%）まで改善したが、目標の
  **1,300B には 2,261,903,571 QOM（0.17%）届かなかった**。上限は
  BABY の QL1 側プール（BABY→WQOM）の浅さ: BABY 15%→20% の追加
  50 USDT が生む増分は約42B QOM（≒0.84B/USDT）まで落ち、QOM 系ルートの
  約1.27B/USDT を下回るため、それ以上寄せても合計は伸びない。
  ケースA（100 USDT）は 177,532,096,521（+11.62%、5パート。O が追加
  ムーブで参入）。ケースB（10B QOM）は最良の分割でも −0.02% で、
  従来どおりプランなし。性能: 評価は (ルート,金額) キャッシュ＋
  バッチ RPC で、ケースC のパート見積もり実数 692 件・約8.4秒（検証環境）。
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
