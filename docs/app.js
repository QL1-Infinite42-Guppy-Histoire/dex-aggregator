"use strict";
/* DEXアグリゲーター v6 (42 Chain / QL1 / 42 Testnet)
   1inch風: 直接・1つ経由・2つ経由の全ルートを getAmountsOut で比較し、
   さらに上位ルートへの「分割」配分も評価して一番多いプランを提示する。
   分割の1tx実行には専用コントラクト (contracts/SplitSwap.sol) が必要。
   デプロイ済みチェーンでのみ分割実行でき、それ以外は見積もりのみ（正直に表示）。
   v3: クロスチェーン (QL1 <=> 42 Chain) の束ね見積もり＋ガイド式実行。
   v4: 価格差 (裁定) — クロス見積もりのベンチマーク差表示＋バッジと、
   QOM建てで全ブリッジ可能トークン×両方向を実見積もりする価格差ボード。
   v5: クロスチェーンの結果を「全体ルート」単位に変更。中継トークンごとに
   交換1・交換2の上位バリアントを組み合わせた全体ルートを並べ、選んだ
   全体ルートのパスそのものをガイド実行 (ステップ1/4) で使う。
   v6: クロスチェーンでも全体ルート同士の「分割」を評価する。1つの取引を
   複数の全体ルートに割合配分し、各パートをそのルート・その金額で実際に
   見積もり直して合計する。単一ベストに勝ったときだけ分割プランのカードを
   出し、実行はパートごとのガイド式フロー (交換1→ブリッジ→着金→交換2 を
   パート単位で進める)。ブリッジはパートごとに別送信になるため、42 Chain 発
   のメッセージ代はパート数分かかる (カードとフローに明示)。*/

const NATIVE_PH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const WQOM = "0xa26dfbf98dd1a32fae56a3d2b2d60a8a41b0bdf0";

/* ---------- i18n ---------- */
const LANG = (typeof document !== "undefined" && document.documentElement && (document.documentElement.lang || "").toLowerCase().indexOf("en") === 0) ? "en" : "ja";
const STR = {
  ja: {
    errAmountFormat: "金額の形式が違います", errTooManyDecimals: (d) => "小数点以下が多すぎます（最大 " + d + " 桁）",
    errSameToken: "同じトークン同士は交換できません（QOM⇔WQOM の包み直しはこのサイトでは扱いません）",
    errAmountPositive: "金額は0より大きくしてください",
    errNoRoute: "どのルートでも交換できませんでした（プールが無いか、流動性がありません）",
    errTokenRead: "トークンとして読み取れませんでした（アドレスが違うか、このチェーンのトークンではない可能性があります）",
    errNoMetaMask: "MetaMaskが見つかりません。MetaMask（または対応ウォレット）を入れたブラウザで開いてください",
    errNoAccount: "アカウントが取得できませんでした", errCancelled: "ウォレット側でキャンセルされました", errUnknown: "不明なエラー",
    balanceLabel: "残高: ", balanceConnectFirst: "ウォレット接続後に表示",
    statusComparing: "全部のルートと分割プランを比べています…（直接・1つ経由・2つ経由・分割）",
    statusQuoted: (n, bestLabel, directNone, splitWin) => n + " ルートを比べました。いちばん多いのは「" + bestLabel + "」です。" + (directNone ? "直接ルートはありませんでした。" : "") + (splitWin ? "分割プランが単一ルートより多くなりました。" : ""),
    statusQuoteFail: "見積もりできませんでした: ", statusConnected: "ウォレットを接続しました", statusConnectFail: "接続できませんでした: ",
    statusNeedConnect: "先にウォレットを接続してください", statusNeedQuote: "先に「ルートを比べる」を押してください",
    statusTokenChanged: "トークンが変わっています。もう一度「ルートを比べる」を押してください",
    statusCheckingAllowance: "使える量の許可を確認しています…", statusApprovePrompt: "このトークンを使う許可をウォレットで承認してください（許可の宛先は交換先です）",
    statusApproveSent: "許可の取引を送りました。完了を待っています… ", statusApproveFail: "許可の取引が失敗しました",
    statusSwapConfirm: (label) => "ウォレットで交換を確認してください（ルート: " + label + "）",
    statusSplitConfirm: "ウォレットで分割交換を確認してください",
    statusSent: "送信しました。チェーン上で完了するまで少し待ってください",
    statusSwapDone: "交換が完了しました", statusSwapFailedTx: "取引は失敗しました（エクスプローラーで確認してください）", statusSwapFail: "交換できませんでした: ",
    statusBalanceUnknown: "残高がまだ分かりません。ウォレットを接続してください",
    statusAmountChanged: "金額が変わりました。「ルートを比べる」を押してください",
    statusSwappedPair: "入れ替えました。「ルートを比べる」を押してください",
    statusTokenChangedMsg: "トークンが変わりました。「ルートを比べる」を押してください",
    statusChainSwitched: "チェーンを切り替えました。金額を入れて「ルートを比べる」を押してください",
    statusCaAddedQuote: "トークンを追加しました。金額を入れて「ルートを比べる」を押してください",
    accountLine: (a, label) => "接続中: " + a + "（" + label + "）",
    accountLineSwitch: (a, label) => "接続中: " + a + "（" + label + " に切り替えるには交換時に自動で切り替わります）",
    notConnected: "未接続（見積もりだけなら接続なしで使えます）",
    noteInfinite: "42 Chain（チェーンID 421018）／ DEX: Don't Panic（Nutri-Matic）",
    noteQl1: "QL1（チェーンID 766）／ DEX: QomSwap",
    noteTestnet: "42 Testnet（チェーンID 421018001）／ DEX: Don't Panic 系テストネット（ルーターは復旧済みアドレス）",
    routeBest: "いちばん多い", routeDirect: "直接ルート", routeVsDirect: (d) => "直接より " + (d >= 0 ? "+" : "") + d + "%",
    routeNoDirect: "直接ルートなし", routeImpact: (v) => "値段の下がり幅 約" + v + "%", routeImpactNA: "値段の下がり幅 —",
    routeHops: (n) => "交換 " + n + "回", gasEst: "ガス目安", gasApproxSuffix: "（目安）", gasPrefix: "約 ",
    planSingleBest: "単一ルート", planSplitTitle: "分割プラン", badgeRecommended: "おすすめ",
    splitVsSingle: (d) => "単一ベストより " + (d >= 0 ? "+" : "") + d + "%",
    splitLost: (amt, sym) => "分割も比べました（最良の分割は約 " + amt + " " + sym + "）。今回は単一ルートがいちばんです。",
    splitQuoteOnly: "分割の実行には専用コントラクトが必要なため、今は見積もりのみ。実行は単一ルートです。",
    splitQuoteOnlyTestnet: "分割の実行には専用コントラクトが必要なため、今は見積もりのみ。実行は単一ルートです。（テストネット用コントラクトは用意済みですが、デプロイ用の TEST42 が無いため未デプロイです）",
    splitExecutable: "このチェーンには分割用コントラクトがあるため、分割プランをそのまま実行できます。",
    minReceived: (slip, amt, sym) => "最低でも受け取る量（スリッページ " + slip + "% を引いた額）: " + amt + " " + sym,
    rateInvertTitle: "レート表示を反転", txSentLabel: "交換の取引を送りました: ", txSentSplitLabel: "分割交換の取引を送りました: ", txExplorerSuffix: "（エクスプローラーで開きます）",
    caBadFormat: "アドレスの形式が違います（0x + 40文字）", caExists: "そのトークンはもう一覧にあります", caReading: "チェーンから読み取り中…",
    caAdded: (s, n, d) => "追加しました: " + s + "（" + n + "、小数 " + d + " 桁）", caReadFail: "読み取れませんでした: ",
    swapBtnSingle: "このルートで交換する", swapBtnSplit: "この分割プランで交換する",
    xComparing: "クロスチェーンの全体ルートを比べています…（中継トークンごとに 交換→ブリッジ→交換 の組み合わせを全部見積もります。少し時間がかかります）",
    xQuoted: (n, sym, amt, dstSym) => "全体ルート " + n + " 件を比べました。いちばん多いのは中継 " + sym + " のルートで、最終見積もりは約 " + amt + " " + dstSym + " です。",
    xQuoteFail: "クロスチェーン見積もりができませんでした: ", xNoCandidate: "成立する中継候補がありませんでした（プールが無いか、流動性がありません）",
    xVia: "中継", xSwap1: "交換1", xBridge: "ブリッジ", xSwap2: "交換2", xFinalEst: "最終見積もり",
    xDirectBridge: "直接ブリッジ（スワップなしでそのまま入る）",
    xBridgeFeeZero: "手数料 0", xNativeFeeInf: (amt) => "＋メッセージ代 約 " + amt + " [42]", xNativeFeeQl1: "＋メッセージ代 0（実測: QL1側の送信は全て支払い0でした）",
    xStartBtn: "このルートではじめる", xTooSmall: "ブリッジの最小量（1トークン）未満のため使えません",
    xBridgeMark: "ブリッジ",
    routeGone: "選んだルートが今は使えなくなりました。見積もりをやり直してください（別のルートへ自動では切り替えていません）",
    xStep4DescV5: (sym, dst, label) => "到着した " + sym + " を、選んだルート（" + label + "）で " + dst + " に交換します。実行ボタンを押すと、そのルートのまま今の値段で見積もり直してから送ります。",
    xStep4BtnExec: "ステップ4を実行（最後の交換）",
    xStep4QuoteLine: (amt, sym, label) => "今の見積もり: 約 " + amt + " " + sym + "（ルート: " + label + "）",
    xStep4Identity: "届いたトークンがそのまま受け取りトークンなので、交換は不要です。このまま完了にできます。",
    xStep4IdentityBtn: "完了にする（交換なし）",
    xSplitStartBtn: "この分割プランではじめる",
    xSplitWinNote: "分割プランが単一ルートより多くなりました。",
    xSplitFeeTotalInf: (amt, n) => "ブリッジのメッセージ代の合計: 約 " + amt + " [42]（ブリッジ " + n + " 回分、それぞれにかかります）",
    xSplitFeeQl1: "ブリッジのメッセージ代は、パートごとに分けても 0 です（実測: QL1側の送信は全て支払い0でした）",
    xSplitPartsNote: (n) => "交換とブリッジはパートごとに分かれて、それぞれ " + n + " 回ずつ行います（まとめて1回では送りません）",
    xsStep1Title: "ステップ1: 最初の交換（パートごと）", xsStep2Title: "ステップ2: ブリッジで送る（パートごと）", xsStep4Title: "ステップ4: 最後の交換（パートごと）",
    xsPartHead: (i, n, pct, sym) => "パート " + (i + 1) + " / " + n + "（" + pct + "%・中継 " + sym + "）",
    xsReceived: (amt, sym) => "受け取り済み: " + amt + " " + sym,
    xsResumeNote: "前回の分割プランの続きが残っています。",
    xsDone: "分割プランの案内は完了しました。",
    xsDonePartial: (ok, n) => "完了したパートは " + ok + " / " + n + " です。止まったパートには理由を表示しています（すでにブリッジで送った分は、そのまま相手チェーンの自分のアドレスに届きます）。",
    xsAutoDone: "交換なしで完了（届いたトークンがそのまま受け取りトークンです）",
    xsStepFailBadge: "失敗",
    xDisabledOsak: "42 Chain → QL1 の OSAK ブリッジは、公式ルーターの送信実績が確認できていないため無効です（QL1 → 42 Chain は実績あり）",
    xDisabledWrap: "QOM のまま送るには WQOM の形が必要で、このサイトでは包み直しが未対応のため、この組み合わせでは使えません（出すトークンで WQOM を選べば使えます）",
    xEstNote: "最終見積もりは今の値段での計算です。ブリッジの到着は数分かかることがあり、最後の交換は到着時点の値段で決まります。",
    xNeedConnect: "先にウォレットを接続してください（上のボタン）", xStepDone: "完了", xStepWait: "まだ", xStepNow: "いまここ",
    xStep1Title: "ステップ1: 最初の交換", xStep1Desc: (a, b, label) => a + " を中継トークン " + b + " に交換します（ルート: " + label + "）。",
    xStep1Skip: "出すトークンがそのまま中継トークンなので、交換は不要です。", xStep1Btn: "ステップ1を実行（交換）",
    xStep2Title: "ステップ2: ブリッジで送る", xStep2DescInf: (amt, sym) => amt + " " + sym + " を QL1 へ送ります。メッセージ代として [42] が別に必要です（送信時に最新額を取ります）。受取先は自分の同じアドレスです。",
    xStep2DescQl1: (amt, sym) => amt + " " + sym + " を 42 Chain へ送ります（QL1側のメッセージ代は実測0です）。受取先は自分の同じアドレスです。",
    xStep2Btn: "ステップ2を実行（ブリッジ送信）",
    xStep3Title: "ステップ3: 到着を待つ", xStep3Desc: (sym, chainLabel) => chainLabel + " で " + sym + " の残高が増えるのを自動で見ています。到着まで数分かかることがあります。この画面を閉じても、開き直せば続きから再開できます。",
    xStep3Elapsed: (s) => "送信から " + s + " 秒", xStep3CheckBtn: "いま確認する", xStep3NotYet: "まだ到着していません",
    xStepArrived: (amt, sym) => "到着しました: " + amt + " " + sym,
    xStep4Title: "ステップ4: 最後の交換", xStep4Desc: (sym, dst) => "到着した " + sym + " を、受け取りトークン " + dst + " に交換します。ボタンを押すと同一チェーン画面にチェーン・トークン・金額をセットするので、そこで「ルートを比べる」→「交換する」を押してください（到着時点の値段で再見積もりします）。",
    xStep4Btn: "ステップ4へ（仕上げの交換画面を開く）", xFlowDone: "このクロスチェーン交換の案内は完了しました。最後の交換は同一チェーン画面で実行してください。",
    xAbandoned: "進み具合を消しました。すでにブリッジで送った分は、そのまま相手チェーンの自分のアドレスに届きます。",
    xBridgeTxLabel: "ブリッジ送信: ", xWorking: "ウォレットで確認してください…", xStepFail: "失敗しました: ",
    xResumeNote: "前回のクロスチェーン交換の続きが残っています。",
    benchLabel: (sym) => "基準（中継 " + sym + "）",
    benchLabelDirect: (sym) => "基準（" + sym + " をそのままブリッジ）",
    vsBench: (pct, amt, sym) => "基準より " + (pct >= 0 ? "+" : "") + pct + "%（" + (pct >= 0 ? "+" : "−") + amt + " " + sym + "）",
    gapBadge: (pct) => "価格差で +" + pct + "%",
    arbScanning: "価格差を調べています…（全トークン×両方向で、実際のルート見積もりを全部叩きます。少し時間がかかります）",
    arbDone: (pos, total) => "調べました。プラスの価格差は " + pos + " / " + total + " 件です（マイナスは「今はマイナス（裁定なし）」と表示しています）。",
    arbFail: "価格差を調べられませんでした: ",
    arbSingleTitle: "片道裁定（QOM で始めて、もう一方のチェーンの QOM で終わる）",
    arbRoundTitle: "往復裁定（片道のあと、QOM を元のチェーンへ戻す）",
    arbRouteBridge: "ブリッジ",
    arbStartLabel: "開始", arbEndLabel: "終了見積もり", arbNetLabel: "差し引き",
    arbFeeInQom: (amt) => "ブリッジのメッセージ代（QOM換算）約 " + amt + " QOM を差し引き済み",
    arbFeeZero: "ブリッジのメッセージ代は0（QL1発）",
    arbNegative: "今はマイナス（裁定なし）",
    arbUnavailable: "見積もり不可: ",
    arbStartBtn: "このルートではじめる", arbStartRtBtn: "往復の片道目ではじめる",
    arbBenchmarkRow: "基準（QOM をそのままブリッジ）",
    arbRtNote: "往復の戻りは、片道が終わったあとにこの画面の案内から開始できます（自動では送りません）。",
    arbReturnBtn: "往復の戻りをはじめる（QOM を戻す）",
    arbReturnNote: "往復裁定の戻りです。届いた QOM を元のチェーンへブリッジする案内を開始します。",
    arbNeedAmount: "金額（QOM）を入れてください",
    arbDirLabel: (a, b) => a + " → " + b,
  },
  en: {
    errAmountFormat: "Invalid amount format", errTooManyDecimals: (d) => "Too many decimal places (max " + d + ")",
    errSameToken: "Cannot swap a token for itself (QOM <-> WQOM wrapping is not supported on this site)",
    errAmountPositive: "Amount must be greater than 0",
    errNoRoute: "No route could swap this pair (no pool or no liquidity)",
    errTokenRead: "Could not read this as a token (wrong address, or not a token on this chain)",
    errNoMetaMask: "MetaMask not found. Open this page in a browser with MetaMask (or a compatible wallet)",
    errNoAccount: "Could not get an account", errCancelled: "Cancelled in the wallet", errUnknown: "Unknown error",
    balanceLabel: "Balance: ", balanceConnectFirst: "Connect a wallet to see",
    statusComparing: "Comparing all routes and split plans... (direct / 1 hop / 2 hops / splits)",
    statusQuoted: (n, bestLabel, directNone, splitWin) => "Compared " + n + " routes. The best is \"" + bestLabel + "\"." + (directNone ? " There was no direct route." : "") + (splitWin ? " A split plan beats the best single route." : ""),
    statusQuoteFail: "Could not quote: ", statusConnected: "Wallet connected", statusConnectFail: "Could not connect: ",
    statusNeedConnect: "Connect your wallet first", statusNeedQuote: "Press \"Compare routes\" first",
    statusTokenChanged: "Tokens changed. Press \"Compare routes\" again",
    statusCheckingAllowance: "Checking the spending allowance...",
    statusApprovePrompt: "Approve this token in your wallet (the spender is shown in the wallet)",
    statusApproveSent: "Approval sent. Waiting for it to finish... ", statusApproveFail: "The approval transaction failed",
    statusSwapConfirm: (label) => "Confirm the swap in your wallet (route: " + label + ")",
    statusSplitConfirm: "Confirm the split swap in your wallet",
    statusSent: "Sent. Wait a moment for it to complete on-chain",
    statusSwapDone: "Swap completed", statusSwapFailedTx: "The transaction failed (check the explorer)", statusSwapFail: "Could not swap: ",
    statusBalanceUnknown: "Balance not known yet. Connect your wallet",
    statusAmountChanged: "Amount changed. Press \"Compare routes\"",
    statusSwappedPair: "Swapped. Press \"Compare routes\"",
    statusTokenChangedMsg: "Token changed. Press \"Compare routes\"",
    statusChainSwitched: "Chain switched. Enter an amount and press \"Compare routes\"",
    statusCaAddedQuote: "Token added. Enter an amount and press \"Compare routes\"",
    accountLine: (a, label) => "Connected: " + a + " (" + label + ")",
    accountLineSwitch: (a, label) => "Connected: " + a + " (will switch to " + label + " automatically at swap time)",
    notConnected: "Not connected (quotes work without a wallet)",
    noteInfinite: "42 Chain (chain ID 421018) / DEX: Don't Panic (Nutri-Matic)",
    noteQl1: "QL1 (chain ID 766) / DEX: QomSwap",
    noteTestnet: "42 Testnet (chain ID 421018001) / DEX: Don't Panic-style testnet (router address recovered and verified on-chain)",
    routeBest: "Best", routeDirect: "Direct route", routeVsDirect: (d) => (d >= 0 ? "+" : "") + d + "% vs direct",
    routeNoDirect: "No direct route", routeImpact: (v) => "Price impact approx. " + v + "%", routeImpactNA: "Price impact —",
    routeHops: (n) => n + (n === 1 ? " swap" : " swaps"), gasEst: "Est. gas", gasApproxSuffix: " (estimate)", gasPrefix: "approx. ",
    planSingleBest: "Single route", planSplitTitle: "Split plan", badgeRecommended: "Recommended",
    splitVsSingle: (d) => (d >= 0 ? "+" : "") + d + "% vs best single route",
    splitLost: (amt, sym) => "Splits were compared too (best split approx. " + amt + " " + sym + "). A single route is best this time.",
    splitQuoteOnly: "Executing a split needs a dedicated aggregator contract, so this is a quote only for now. Execution uses a single route.",
    splitQuoteOnlyTestnet: "Executing a split needs a dedicated aggregator contract, so this is a quote only for now. Execution uses a single route. (The testnet contract is ready in this repo but not deployed yet: no TEST42 to pay for deployment gas.)",
    splitExecutable: "This chain has a split contract, so the split plan can be executed as shown.",
    minReceived: (slip, amt, sym) => "Minimum you receive (after " + slip + "% slippage): " + amt + " " + sym,
    rateInvertTitle: "Invert rate", txSentLabel: "Swap transaction sent: ", txSentSplitLabel: "Split swap transaction sent: ", txExplorerSuffix: " (opens in the explorer)",
    caBadFormat: "Invalid address format (0x + 40 characters)", caExists: "That token is already in the list", caReading: "Reading from the chain...",
    caAdded: (s, n, d) => "Added: " + s + " (" + n + ", " + d + " decimals)", caReadFail: "Could not read it: ",
    swapBtnSingle: "Swap with this route", swapBtnSplit: "Swap with this split plan",
    xComparing: "Comparing full cross-chain routes... (for each bridge token, combinations of swap -> bridge -> swap; this takes a little while)",
    xQuoted: (n, sym, amt, dstSym) => "Compared " + n + " full routes. The best is a route via " + sym + ", final estimate approx. " + amt + " " + dstSym + ".",
    xQuoteFail: "Cross-chain quote failed: ", xNoCandidate: "No bridge candidate works (no pool or no liquidity)",
    xVia: "Via", xSwap1: "Swap 1", xBridge: "Bridge", xSwap2: "Swap 2", xFinalEst: "Final estimate",
    xDirectBridge: "Direct bridge (no swap — enters as-is)",
    xBridgeFeeZero: "fee 0", xNativeFeeInf: (amt) => "+ messaging cost approx. " + amt + " [42]", xNativeFeeQl1: "+ messaging cost 0 (measured: every sampled QL1 send paid 0)",
    xStartBtn: "Start with this route", xTooSmall: "Below the bridge minimum (1 token)",
    xBridgeMark: "bridge",
    routeGone: "The route you picked no longer works. Please compare again (it was NOT switched to another route automatically)",
    xStep4DescV5: (sym, dst, label) => "Swap the arrived " + sym + " into " + dst + " along the route you picked (" + label + "). Pressing the button re-quotes that exact route at current prices before sending.",
    xStep4BtnExec: "Run step 4 (final swap)",
    xStep4QuoteLine: (amt, sym, label) => "Current quote: approx. " + amt + " " + sym + " (route: " + label + ")",
    xStep4Identity: "The arrived token already is the token you receive, so no swap is needed. You can simply finish.",
    xStep4IdentityBtn: "Finish (no swap)",
    xSplitStartBtn: "Start with this split plan",
    xSplitWinNote: "A split plan beats the best single full route.",
    xSplitFeeTotalInf: (amt, n) => "Total bridge messaging cost: approx. " + amt + " [42] (" + n + " bridge sends, charged per send)",
    xSplitFeeQl1: "The bridge messaging cost stays 0 per part (measured: every sampled QL1 send paid 0)",
    xSplitPartsNote: (n) => "Swaps and bridges run separately for each part (" + n + " of each — they are not sent as one transaction)",
    xsStep1Title: "Step 1: First swaps (one per part)", xsStep2Title: "Step 2: Bridge sends (one per part)", xsStep4Title: "Step 4: Final swaps (one per part)",
    xsPartHead: (i, n, pct, sym) => "Part " + (i + 1) + " of " + n + " (" + pct + "%, via " + sym + ")",
    xsReceived: (amt, sym) => "Received: " + amt + " " + sym,
    xsResumeNote: "You have an unfinished split plan saved.",
    xsDone: "This split plan guide is complete.",
    xsDonePartial: (ok, n) => ok + " of " + n + " parts completed. Stopped parts show their reason (anything already bridged still arrives at your own address on the other chain).",
    xsAutoDone: "Done with no swap (the arrived token already is the token you receive)",
    xsStepFailBadge: "Failed",
    xDisabledOsak: "The 42 Chain -> QL1 OSAK bridge is disabled: no sends through the official router could be verified (QL1 -> 42 Chain is verified)",
    xDisabledWrap: "Sending QOM as-is needs it in WQOM form, and wrapping is not supported on this site, so this combination is unavailable (pick WQOM as the token you pay to use it)",
    xEstNote: "The final estimate uses current prices. Bridge arrival can take several minutes, and the last swap executes at arrival-time prices.",
    xNeedConnect: "Connect your wallet first (button above)", xStepDone: "Done", xStepWait: "Pending", xStepNow: "Current step",
    xStep1Title: "Step 1: First swap", xStep1Desc: (a, b, label) => "Swap " + a + " into the bridge token " + b + " (route: " + label + ").",
    xStep1Skip: "The token you pay already is the bridge token, so no swap is needed.", xStep1Btn: "Run step 1 (swap)",
    xStep2Title: "Step 2: Send over the bridge", xStep2DescInf: (amt, sym) => "Send " + amt + " " + sym + " to QL1. A messaging cost in [42] is charged on top (fetched fresh at send time). The recipient is your own same address.",
    xStep2DescQl1: (amt, sym) => "Send " + amt + " " + sym + " to 42 Chain (the QL1-side messaging cost measured 0). The recipient is your own same address.",
    xStep2Btn: "Run step 2 (bridge send)",
    xStep3Title: "Step 3: Wait for arrival", xStep3Desc: (sym, chainLabel) => "Watching your " + sym + " balance on " + chainLabel + " automatically. Arrival can take several minutes. You can close this page and resume later — progress is saved.",
    xStep3Elapsed: (s) => s + "s since sending", xStep3CheckBtn: "Check now", xStep3NotYet: "Not arrived yet",
    xStepArrived: (amt, sym) => "Arrived: " + amt + " " + sym,
    xStep4Title: "Step 4: Final swap", xStep4Desc: (sym, dst) => "Swap the arrived " + sym + " into " + dst + ". The button sets the chain, tokens and amount on the same-chain screen — there, press \"Compare routes\" and then swap (it re-quotes at arrival-time prices).",
    xStep4Btn: "Go to step 4 (open the final swap screen)", xFlowDone: "This cross-chain guide is complete. Execute the final swap on the same-chain screen.",
    xAbandoned: "Progress cleared. Anything already sent over the bridge will still arrive at your own address on the other chain.",
    xBridgeTxLabel: "Bridge send: ", xWorking: "Confirm in your wallet...", xStepFail: "Failed: ",
    xResumeNote: "You have an unfinished cross-chain swap saved.",
    benchLabel: (sym) => "Benchmark (via " + sym + ")",
    benchLabelDirect: (sym) => "Benchmark (bridge " + sym + " itself)",
    vsBench: (pct, amt, sym) => (pct >= 0 ? "+" : "") + pct + "% vs benchmark (" + (pct >= 0 ? "+" : "−") + amt + " " + sym + ")",
    gapBadge: (pct) => "Price gap +" + pct + "%",
    arbScanning: "Scanning price gaps... (runs real route quotes for every token in both directions; this takes a little while)",
    arbDone: (pos, total) => "Done. Positive gaps: " + pos + " of " + total + " routes (negative ones are labelled \"no arbitrage right now\").",
    arbFail: "Could not scan price gaps: ",
    arbSingleTitle: "One-way arbitrage (start in QOM, end in QOM on the other chain)",
    arbRoundTitle: "Round-trip arbitrage (then bridge the QOM back)",
    arbRouteBridge: "bridge",
    arbStartLabel: "Start", arbEndLabel: "Est. end", arbNetLabel: "Net",
    arbFeeInQom: (amt) => "Bridge messaging fee already deducted (approx. " + amt + " in QOM terms)",
    arbFeeZero: "Bridge messaging fee is 0 (QL1 origin)",
    arbNegative: "Negative right now (no arbitrage)",
    arbUnavailable: "Cannot quote: ",
    arbStartBtn: "Start with this route", arbStartRtBtn: "Start the first (one-way) leg",
    arbBenchmarkRow: "Benchmark (bridge QOM itself)",
    arbRtNote: "The return leg can be started from this screen's guide after the one-way leg finishes (it is never sent automatically).",
    arbReturnBtn: "Start the return leg (bridge the QOM back)",
    arbReturnNote: "This is the return leg of a round-trip arbitrage. Starting the guide to bridge the arrived QOM back to the original chain.",
    arbNeedAmount: "Enter an amount (in QOM)",
    arbDirLabel: (a, b) => a + " -> " + b,
  },
};
function t(key, ...args) { const v = STR[LANG][key]; return typeof v === "function" ? v(...args) : v; }

/* ---------- chains ---------- */
const CHAINS = {
  infinite: {
    key: "infinite", label: "42 Chain", chainId: 421018,
    nativeSymbol: "42", nativeName: "Infinite Drivechain",
    rpcs: ["https://evm-rpc.infinitedrive.xyz", "https://evm-rpc-infinite.mschihuahua.org", "https://evm-rpc.infinitepanda.xyz"],
    explorer: "https://scan.infinitedrive.xyz",
    router: "0xbf07dfe35746894bae373f63f4bf2379f9bafec0",
    factory: "0x3157c6aca800d507af95ab1466adbA3a6f11eE1a",
    nativeAnchor: NATIVE_PH, aggregator: "", isTestnet: false,
    tokens: [
      { id: "native", symbol: "42", name: "42 (native)", address: NATIVE_PH, decimals: 18, isNative: true },
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
    nativeAnchor: WQOM, aggregator: "", isTestnet: false,
    tokens: [
      { id: "native", symbol: "QOM", name: "QOM (native)", address: WQOM, decimals: 18, isNative: true },
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
  testnet: {
    key: "testnet", label: "42 Testnet", chainId: 421018001,
    nativeSymbol: "TEST42", nativeName: "Infinite Improbability Drive Testnet",
    rpcs: ["https://evm-rpc-testnet.infinitedrive.xyz"],
    explorer: "", // テストネット用エクスプローラーは未確認のため無し（推測で入れない）
    // router は Builders 投稿の記録が41桁で壊れていたため、1文字削除の全候補を
    // ライブRPCで検証して復旧した (factory() が下の factory を返し WETH() が答えた唯一の候補)。
    router: "0xfe644aa3e5c9b3901822627a237f5e4c2d012690",
    factory: "0x8944aadc2b88e1ee59fc079d6e70b23c758494da",
    nativeAnchor: NATIVE_PH,
    // 分割実行用 SplitSwap のデプロイ先。デプロイできたらここにアドレスを入れるだけで有効化される。
    // 現在: 未デプロイ (コントラクトは contracts/ に用意済み。デプロイ用 TEST42 が無いため)
    aggregator: "",
    isTestnet: true,
    // トークン一覧はテストネット factory の全6ペアを列挙して生成した実物
    // (tools/enumerate_testnet.cjs, 2026-11-06)。メインネットのアドレス流用ではない。
    tokens: [
      { id: "native", symbol: "TEST42", name: "TEST42 (native)", address: NATIVE_PH, decimals: 18, isNative: true },
      { id: "fox", symbol: "FOXXEY", name: "Foxxey", address: "0x68d5a28d3bf09a32d3b9c35714ab7a6166ae2a00", decimals: 18, isNative: false },
      { id: "arba", symbol: "ARBA", name: "ArbTokenA", address: "0xb71ea881e20d525bdc11755b41912b76d000cc73", decimals: 18, isNative: false },
      { id: "arbb", symbol: "ARBB", name: "ArbTokenB", address: "0x7d16e53c505349454489a3aef85bb2e2e8cbfa42", decimals: 18, isNative: false },
      { id: "pop", symbol: "pop", name: "popcorn", address: "0x8460711b38d845b93ebc99d6d0c6fc53ec5a5558", decimals: 18, isNative: false },
      { id: "tst", symbol: "TST", name: "Test", address: "0xc5988ab7022a750716a40454166097232ae75f78", decimals: 18, isNative: false },
    ],
    baseAddresses: [NATIVE_PH, "0xb71ea881e20d525bdc11755b41912b76d000cc73", "0x7d16e53c505349454489a3aef85bb2e2e8cbfa42"],
    defaultFrom: "native", defaultTo: "arba",
  },
};

/* ---------- v3: cross-chain bridge config (QL1 <-> Infinite, Hyperlane) ----------
   2026-11-06 の実取引サンプリングで裏取り済み (tools/bridge/sample_delivery.cjs):
   - QL1->Infinite: 全8トークンで直近の送信2件ずつ、宛先 mailbox の delivered(messageId)==true を確認 (16/16)
   - Infinite->QL1: QOM/BABY/CAW/FATHER/HAWK/O 各2件・KET 1件で delivered==true を確認。
     OSAK は Infinite 側 BridgeRouter の全履歴に transferRemote が 0 件 (管理txのみ) のため、この向きは未証明として無効化。
   - QL1 側の送信は全サンプル msg.value = 0 (ネイティブのガス支払い不要)。Infinite 側は BridgeRouter の
     quoteNative(766) の totalNative をそのまま払う (実測 約2.94 [42]、送信時に再取得)。
   - ブリッジ手数料は全ペア 0 (quoteBridge の fee=0 を全ルーターで確認)。 */
const BRIDGE_PAIRS = [
  { sym: "QOM",    infId: "qom",    ql1Id: "wqom",  br: "0x049a78fe311cf1c23f09cdd4f12420ffc917c8db", ql1Router: "0x30da1e7c8de5fa75b593002e0b2d2910ffcadcb6", enabledFromQl1: true, enabledFromInf: true },
  { sym: "BABY",   infId: "baby",   ql1Id: "baby",  br: "0x4aba9dbe8a990c19501c1c4c3e677f775006d2e2", ql1Router: "0x8ff9452f309159828903d2d6cca58cccb2b5cd16", enabledFromQl1: true, enabledFromInf: true },
  { sym: "CAW",    infId: "caw",    ql1Id: "qcaw",  br: "0x82ba5d61a70677f7f53a9894c63dfb61fd8bcb65", ql1Router: "0xd14cf03d3753d80a1f6fb818aa1c728d5c36b3bf", enabledFromQl1: true, enabledFromInf: true },
  { sym: "FATHER", infId: "father", ql1Id: "father", br: "0x056c116c09acb788d038e7dDc167249C26493D6e", ql1Router: "0x54718de5e064dcd1181b7847591c5864434ed92e", enabledFromQl1: true, enabledFromInf: true },
  { sym: "HAWK",   infId: "hawk",   ql1Id: "hawk",  br: "0x0d198200dc673e96217ddeA9560d26Ae0d092074", ql1Router: "0x916fb1a761d0db8888c3f79d6c614c9ffF73b657".toLowerCase(), enabledFromQl1: true, enabledFromInf: true },
  { sym: "KET",    infId: "ket",    ql1Id: "ket",   br: "0x3bc94e9f417561ca37559e07dfc65496fcE94557", ql1Router: "0x59d6e50f5b0559a088e3eaac21e520be18453704", enabledFromQl1: true, enabledFromInf: true },
  { sym: "O",      infId: "o",      ql1Id: "o",     br: "0xcb893a7e5f2932531f6e04c0Fc3b17AC4884475f", ql1Router: "0x488b1f39aa01196ec8a14891bAfFEe6630155A61", enabledFromQl1: true, enabledFromInf: true },
  { sym: "OSAK",   infId: "osak",   ql1Id: "qosak", br: "0xa2093426c03ba6F0f6049532b6f13F1e36566358", ql1Router: "0xe3a35d9f4ef7eacD5bb47164Ee8d7bff75C2cF6B", enabledFromQl1: true, enabledFromInf: false },
];
const BRIDGE_MAILBOX = { infinite: "0xac70cdd7f2b712aef7a20661e0c2e96e1da1d63e", ql1: "0x2f136baa37eb5711483d295944eeda01c4142da0" };
const TOPIC_BRIDGE_INITIATED = "0x8f90f45f78e58a284c9aa2b93fed3647c4fed38904c460c2c07a6f5a26f2c1fd";
const TOPIC_DISPATCH_ID = "0x788dbc1b7152732178210e7f4d9d010ef016f9eafbe66786bd7169f56e0c353a";

const SEL = {
  getAmountsOut: "0xd06ca61f", getPair: "0xe6a43905", getReserves: "0x0902f1ac", token0: "0x0dfe1681",
  transferRemote: "0x81b4e8b4", quoteNative: "0xe9e64e40", quoteBridge: "0x15b2393a", mailboxDelivered: "0xe495f1d4",
  symbol: "0x95d89b41", name: "0x06fdde03", decimals: "0x313ce567",
  balanceOf: "0x70a08231", allowance: "0xdd62ed3e", approve: "0x095ea7b3",
  swapTokensForTokens: "0x38ed1739", swapETHForTokens: "0x7ff36ab5", swapTokensForETH: "0x18cbafe5",
  // contracts/SplitSwap.sol のセレクタ (コンパイル済みABIから取得)
  split: "0xecd49173",            // swapSplit(address,(uint256,address[])[],uint256,address,address,uint256)
  splitToNative: "0x906a96a7",    // swapSplitToNative(address,(uint256,address[])[],uint256,address,uint256)
  splitFromNative: "0xa4a25d0c",  // swapSplitFromNative((uint256,address[])[],uint256,address,address,uint256)
};
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/* ガス目安 (実測ではなくホップ数からの近似。画面でも「目安」と明記する) */
const GAS_BASE = 65000, GAS_PER_HOP = 105000, GAS_AGG_OVERHEAD = 90000, GAS_LEG_BASE = 35000;
function estimateGasUnitsSingle(route) { return GAS_BASE + GAS_PER_HOP * route.hops; }
function estimateGasUnitsSplit(legs) { return GAS_AGG_OVERHEAD + legs.reduce((s, l) => s + GAS_LEG_BASE + GAS_PER_HOP * l.route.hops, 0); }

/* ---------- state ---------- */
const state = {
  chainKey: "infinite",
  custom: { infinite: [], ql1: [], testnet: [] },
  account: null,
  routes: [],
  directOut: null,
  splitEstimate: null,   // v1互換: 分割プランが単一ベストに勝った場合のみ {out, bestOut}
  splitEval: null,       // {evaluated, best, plan}
  gasPrice: null,        // BigInt | null (見積もり時点)
  selectedIdx: 0,
  selectedPlan: { type: "single", idx: 0 },  // {type:"single",idx} | {type:"split"}
  rateInvert: false,
  lastQuote: null,
  balances: {},
  slippagePct: 1,
  mode: "same",          // v3: "same" | "cross"
  xSrc: "ql1",           // v3: cross-chain source chain key ("ql1" | "infinite")
  xCandidates: [],       // v3: last cross-chain quote result
  xQuote: null,          // v3: {fromId, toId, amountIn} of last cross quote
  xflow: null,           // v3: guided flow state (persisted)
  xPollTimer: null,
  xBenchmark: null,      // v4: {sym, kind, finalOut} benchmark of the last cross quote
  xSplit: null,          // v6: {evaluated, best, plan, bestSingle} cross-chain split evaluation
  arbRows: [],           // v4: last arbitrage board scan rows
  arbStartRaw: null,     // v4: start amount (QOM raw) of the last board scan
};
function chain() { return CHAINS[state.chainKey]; }
function splitExecutable(chainObj) { return !!(chainObj && chainObj.aggregator && chainObj.aggregator.length === 42); }
function allTokens(chainKey) {
  const c = CHAINS[chainKey || state.chainKey];
  return [...c.tokens, ...state.custom[c.key]];
}
function tokenById(chainKey, id) { return allTokens(chainKey).find((tk) => tk.id === id) || null; }
function tokenByAddress(chainKey, addr) {
  const a = (addr || "").toLowerCase();
  const list = allTokens(chainKey);
  return list.find((tk) => tk.isNative && tk.address.toLowerCase() === a) || list.find((tk) => tk.address.toLowerCase() === a) || null;
}
function symbolFor(chainKey, addr) {
  const tk = tokenByAddress(chainKey, addr);
  return tk ? tk.symbol : (addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "?");
}

/* ---------- amount helpers (BigInt only) ---------- */
function parseAmount(text, decimals) {
  const s = String(text == null ? "" : text).trim();
  if (!s || !/^\d*(\.\d*)?$/.test(s) || s === ".") throw new Error(t("errAmountFormat"));
  const [ip, fpRaw = ""] = s.split(".");
  if (fpRaw.length > decimals) throw new Error(t("errTooManyDecimals", decimals));
  const fp = fpRaw.padEnd(decimals, "0");
  return BigInt(ip || "0") * (10n ** BigInt(decimals)) + (fp ? BigInt(fp) : 0n);
}
function formatAmount(raw, decimals, maxFrac) {
  if (raw == null) return "—";
  const neg = raw < 0n; const v = neg ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const ip = v / base; let fp = (v % base).toString().padStart(decimals, "0");
  if (maxFrac != null) {
    fp = fp.slice(0, maxFrac);
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
function formatRate(fromTok, toTok, amountIn, amountOut, invert) {
  if (!amountIn || amountIn <= 0n || !amountOut || amountOut <= 0n) return "";
  // rate = (out / 10^toDec) / (in / 10^fromDec), 1e6 精度で BigInt 計算
  let num, den;
  if (!invert) { num = amountOut * (10n ** BigInt(fromTok.decimals + 6)); den = amountIn * (10n ** BigInt(toTok.decimals)); }
  else { num = amountIn * (10n ** BigInt(toTok.decimals + 6)); den = amountOut * (10n ** BigInt(fromTok.decimals)); }
  const q = Number(num / den) / 1e6;
  const a = invert ? toTok.symbol : fromTok.symbol, b = invert ? fromTok.symbol : toTok.symbol;
  return "1 " + a + " = " + (q >= 1000 ? q.toLocaleString("en-US", { maximumFractionDigits: 4 }) : q.toPrecision(6).replace(/\.?0+$/, "")) + " " + b;
}
function formatGas(chainObj, units) {
  if (state.gasPrice) {
    const cost = BigInt(units) * state.gasPrice;
    return t("gasPrefix") + formatAmount(cost, 18, 6) + " " + chainObj.nativeSymbol + t("gasApproxSuffix");
  }
  return t("gasPrefix") + units.toLocaleString("en-US") + " gas" + t("gasApproxSuffix");
}

/* ---------- ABI encoding helpers ---------- */
function encAddr(a) { return a.toLowerCase().replace("0x", "").padStart(64, "0"); }
function encUint(n) { return BigInt(n).toString(16).padStart(64, "0"); }
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
/* SplitSwap の Leg[] ((uint256 amountIn, address[] path)[]) の tail エンコーディング */
function encLegsTail(legs) {
  const elems = legs.map((leg) => encUint(leg.amountIn) + encUint(64) + encUint(leg.path.length) + leg.path.map(encAddr).join(""));
  let off = 32 * elems.length; const offsets = [];
  for (const e of elems) { offsets.push(encUint(off)); off += e.length / 2; }
  return encUint(elems.length) + offsets.join("") + elems.join("");
}

/* ---------- RPC (public, read-only) ---------- */
let rpcId = 0;
async function rpcBatchOnce(url, calls) {
  const start = rpcId;
  const payload = calls.map(([to, data]) => ({ jsonrpc: "2.0", id: ++rpcId, method: "eth_call", params: [{ to, data }, "latest"] }));
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error("RPC HTTP " + res.status);
  const out = await res.json();
  if (!Array.isArray(out)) throw new Error("RPC bad response");
  const byId = {};
  for (const x of out) byId[x.id] = x.error ? null : (x.result || null);
  return calls.map((_, i) => byId[start + i + 1] || null);
}
async function rpcBatch(chainObj, calls) {
  let lastErr = null;
  for (const url of chainObj.rpcs) {
    try { return await rpcBatchOnce(url, calls); } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("RPC unreachable");
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
  throw lastErr || new Error("RPC unreachable");
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

/* ---------- split allocation refinement (generic hill climbing) ----------
   配分 [{cand, pct}] (pct 合計 100) を、ステップ幅 5% → 2% → 1% の順に
   「1パートから別パートへ step% 移す」「未使用の候補を 1% で追加する
   (既存パートから比例的に削る)」ムーブを全て評価し、最良の改善を採用
   し続ける。改善ムーブが無くなったら止まる (局所最適)。scoreMany は
   配分の配列を受け取り、各配分の {totalOut, ...} か null を返す非同期
   関数 (呼び出し側が見積もりを一括実行する)。 */
async function refineSplitAllocation(startAlloc, startScore, scoreMany, opts) {
  const o = opts || {};
  const maxParts = o.maxParts || 5;
  const maxIterations = o.maxIterations || 150;
  const steps = o.steps || [5, 2, 1];
  const allowed = o.allowed || (() => true);
  const addCandidates = o.addCandidates || [];
  const keyOf = o.keyOf || ((c) => c);
  const budget = o.budget || null;
  let cur = startAlloc.map((p) => ({ cand: p.cand, pct: p.pct }));
  let curScore = startScore;
  let iterations = 0, evaluatedMoves = 0;
  const sigOf = (alloc) => alloc.map((p) => keyOf(p.cand) + ":" + p.pct).sort().join(",");
  const genMoves = (alloc, step) => {
    const moves = [];
    const seen = new Set([sigOf(alloc)]);
    const push = (a) => {
      if (a.length < 2 || a.length > maxParts) return;
      const s = sigOf(a);
      if (seen.has(s)) return;
      seen.add(s); moves.push(a);
    };
    for (let i = 0; i < alloc.length; i++) {
      for (let j = 0; j < alloc.length; j++) {
        if (i === j || alloc[i].pct < step) continue;
        const na = alloc.map((p) => ({ cand: p.cand, pct: p.pct }));
        na[i].pct -= step; na[j].pct += step;
        const f = na.filter((p) => p.pct > 0);
        if (f.length < 2) continue;
        if (!allowed(f.map((p) => p.cand))) continue;
        push(f);
      }
    }
    if (alloc.length < maxParts) {
      const inPlan = new Set(alloc.map((p) => keyOf(p.cand)));
      for (const cand of addCandidates) {
        if (inPlan.has(keyOf(cand))) continue;
        if (!allowed([...alloc.map((p) => p.cand), cand])) continue;
        const na = alloc.map((p) => ({ cand, pct: Math.floor((p.pct * 99) / 100) })).filter((p) => p.pct > 0);
        if (!na.length) continue;
        let deficit = 99 - na.reduce((s, p) => s + p.pct, 0);
        const order = na.map((p, i) => i).sort((a, b) => na[b].pct - na[a].pct);
        for (let k = 0; deficit > 0 && order.length; k++) { na[order[k % order.length]].pct += 1; deficit--; }
        na.push({ cand, pct: 1 });
        if (na.reduce((s, p) => s + p.pct, 0) !== 100) continue;
        push(na);
      }
    }
    return moves;
  };
  for (const step of steps) {
    while (iterations < maxIterations) {
      if (budget && !budget()) return { alloc: cur, score: curScore, iterations, evaluatedMoves };
      const moves = genMoves(cur, step);
      if (!moves.length) break;
      const scores = await scoreMany(moves);
      evaluatedMoves += moves.length;
      let bi = -1;
      for (let i = 0; i < moves.length; i++) {
        if (scores[i] && (bi < 0 || scores[i].totalOut > scores[bi].totalOut)) bi = i;
      }
      if (bi >= 0 && scores[bi].totalOut > curScore.totalOut) { cur = moves[bi]; curScore = scores[bi]; iterations++; }
      else break;
    }
    if (iterations >= maxIterations) break;
  }
  return { alloc: cur, score: curScore, iterations, evaluatedMoves };
}

/* ---------- split evaluation (1inch-style allocation search) ----------
   v6.2: ペアは 1% 刻みで全探索し、最良配分を 1% 刻みの微調整
   (refineSplitAllocation) で詰める。同一チェーン側も同じ微調整を使う。 */
async function evaluateSplits(chainObj, routes, amountIn) {
  const top = routes.slice(0, 3);
  if (top.length < 2 || amountIn <= 0n) return { evaluated: 0, best: null, plan: null };
  const routeIdx = new Map(); top.forEach((r, i) => routeIdx.set(r, i));
  // leg amountIns (last leg takes the remainder so the sum is exact)
  const legsOf = (alloc) => {
    const legs = []; let used = 0n;
    alloc.forEach((l, i) => {
      const amt = i === alloc.length - 1 ? amountIn - used : (amountIn * BigInt(l.pct)) / 100n;
      used += amt; legs.push({ route: l.cand, pct: l.pct, amountIn: amt, amountOut: null });
    });
    return legs;
  };
  const cache = new Map(); // "routeIdx|amountIn" -> amountOut | null
  const CHUNK = 150;
  async function ensure(legsList) {
    const missing = [];
    const seen = new Set();
    for (const leg of legsList) {
      if (leg.amountIn <= 0n) continue;
      const key = routeIdx.get(leg.route) + "|" + leg.amountIn.toString();
      if (!cache.has(key) && !seen.has(key)) { seen.add(key); missing.push({ key, leg }); }
    }
    for (let s = 0; s < missing.length; s += CHUNK) {
      const chunk = missing.slice(s, s + CHUNK);
      const res = await rpcBatch(chainObj, chunk.map((m) => [chainObj.router, encodeGetAmountsOut(m.leg.amountIn, m.leg.route.path)]));
      chunk.forEach((m, k) => { const amts = decodeAmountsOut(res[k]); cache.set(m.key, amts && amts.length ? amts[amts.length - 1] : null); });
    }
  }
  const scoreFromCache = (alloc) => {
    const legs = legsOf(alloc);
    if (legs.some((l) => l.amountIn <= 0n)) return null;
    let total = 0n;
    for (const leg of legs) {
      const out = cache.get(routeIdx.get(leg.route) + "|" + leg.amountIn.toString());
      if (out == null || out <= 0n) return null;
      leg.amountOut = out; total += out;
    }
    return { legs, totalOut: total };
  };
  let evaluated = 0;
  let best = null;
  const considerAll = async (allocs) => {
    if (!allocs.length) return;
    await ensure(allocs.flatMap(legsOf));
    for (const a of allocs) {
      evaluated++;
      const s = scoreFromCache(a);
      if (s && (!best || s.totalOut > best.totalOut)) best = s;
    }
  };
  // stage 1: pairs at 1% steps among the top routes + classic triple templates
  const allocs = [];
  for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++)
    for (let p = 1; p <= 99; p++) allocs.push([{ cand: top[i], pct: p }, { cand: top[j], pct: 100 - p }]);
  if (top.length >= 3) for (const sh of [[50, 30, 20], [40, 30, 30], [60, 25, 15], [34, 33, 33]]) allocs.push(sh.map((pct, i) => ({ cand: top[i], pct })));
  await considerAll(allocs);
  // stage 2: 1% hill-climb refinement (transfers + adds within the top routes)
  if (best) {
    const scoreMany = async (al) => { await ensure(al.flatMap(legsOf)); return al.map((a) => scoreFromCache(a)); };
    const refined = await refineSplitAllocation(
      best.legs.map((l) => ({ cand: l.route, pct: l.pct })), best, scoreMany,
      { addCandidates: top, maxParts: 3, keyOf: (r) => routeIdx.get(r), maxIterations: 100 });
    evaluated += refined.evaluatedMoves;
    if (refined.score && refined.score.totalOut > best.totalOut) best = refined.score;
  }
  const plan = best && best.totalOut > routes[0].amountOut ? best : null;
  return { evaluated, best, plan };
}

/* ---------- quoting: compare ALL routes + splits ---------- */
async function fetchQuotesForTokens(chainObj, fromTok, toTok, amountIn) {
  if (fromTok.address.toLowerCase() === toTok.address.toLowerCase()) throw new Error(t("errSameToken"));
  if (amountIn <= 0n) throw new Error(t("errAmountPositive"));
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
  if (!routes.length) throw new Error(t("errNoRoute"));
  routes.sort((a, b) => (b.amountOut > a.amountOut ? 1 : b.amountOut < a.amountOut ? -1 : 0));
  const direct = routes.find((r) => r.hops === 1) || null;
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
  let splitEval = { evaluated: 0, best: null, plan: null };
  try { splitEval = await evaluateSplits(chainObj, routes, amountIn); } catch (e) { /* splits are optional */ }
  const splitEstimate = splitEval.plan ? { out: splitEval.plan.totalOut, bestOut: routes[0].amountOut } : null;
  let gasPrice = null;
  try { const gp = await rpcMethod(chainObj, "eth_gasPrice", []); if (gp) gasPrice = BigInt(gp); } catch (e) { /* optional */ }
  return { routes, directOut: direct ? direct.amountOut : null, splitEstimate, splitEval, gasPrice, amountIn };
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
  function arrayTail(addrs) { return encUint(addrs.length) + addrs.map(encAddr).join(""); }
  let data, value = 0n, fn;
  if (fromTok.isNative) {
    fn = "swapExactETHForTokens";
    data = SEL.swapETHForTokens + encUint(amountOutMin) + encUint(128) + encAddr(account) + encUint(deadline) + arrayTail(path);
    value = amountIn;
  } else if (toTok.isNative) {
    fn = "swapExactTokensForETH";
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
/* SplitSwap への分割実行 calldata。aggregator 未設定のチェーンでは呼ばないこと。 */
function buildSplitTx(chainObj, fromTok, toTok, plan, account, slippagePct, nowSec) {
  if (!splitExecutable(chainObj)) throw new Error("aggregator not configured for this chain");
  const legs = plan.legs.map((l) => ({ amountIn: l.amountIn, path: l.route.path }));
  const totalIn = legs.reduce((s, l) => s + l.amountIn, 0n);
  const amountOutMin = applySlippageBps(plan.totalOut, slippagePct);
  const deadline = deadline20Min(nowSec);
  const tail = encLegsTail(legs);
  let data, value = 0n, fn;
  if (fromTok.isNative) {
    fn = "swapSplitFromNative";
    data = SEL.splitFromNative + encUint(160) + encUint(amountOutMin) + encAddr(toTok.address) + encAddr(account) + encUint(deadline) + tail;
    value = totalIn;
  } else if (toTok.isNative) {
    fn = "swapSplitToNative";
    data = SEL.splitToNative + encAddr(fromTok.address) + encUint(160) + encUint(amountOutMin) + encAddr(account) + encUint(deadline) + tail;
  } else {
    fn = "swapSplit";
    data = SEL.split + encAddr(fromTok.address) + encUint(192) + encUint(amountOutMin) + encAddr(toTok.address) + encAddr(account) + encUint(deadline) + tail;
  }
  return { to: chainObj.aggregator.toLowerCase(), data, value, amountOutMin, deadline, functionName: fn, legs, totalIn };
}

/* ---------- v3 cross-chain: light best-route quote (no split evaluation) ---------- */
async function fetchBestRoute(chainObj, fromTok, toTok, amountIn) {
  if (fromTok.address.toLowerCase() === toTok.address.toLowerCase()) return null;
  if (amountIn <= 0n) return null;
  const paths = buildCandidatePaths(chainObj, fromTok, toTok);
  const results = await rpcBatch(chainObj, paths.map((p) => [chainObj.router, encodeGetAmountsOut(amountIn, p)]));
  let best = null;
  results.forEach((hex, i) => {
    const amounts = decodeAmountsOut(hex);
    if (!amounts || !amounts.length) return;
    const out = amounts[amounts.length - 1];
    if (out <= 0n) return;
    if (!best || out > best.amountOut) best = { path: paths[i], amounts, amountOut: out, hops: paths[i].length - 1, priceImpactPct: null };
  });
  if (!best) return null;
  try {
    const { pairOf, info } = await fetchPairs(chainObj, [best]);
    const spot = spotOutFor(best, amountIn, pairOf, info);
    if (spot !== null && spot > 0n) best.priceImpactPct = (1 - Number(best.amountOut) / Number(spot)) * 100;
  } catch (e) { /* impact optional */ }
  return best;
}

/* ---------- v5: all-routes quote (no split evaluation, impacts attachable later) ----------
   fetchBestRoute の「最良だけ」版に対して、成功した全ルートを多い順で返す。
   クロスチェーンの全体ルート列挙 (レッグのバリアント保持) に使う。 */
async function fetchRoutesOnly(chainObj, fromTok, toTok, amountIn) {
  if (fromTok.address.toLowerCase() === toTok.address.toLowerCase()) return [];
  if (amountIn <= 0n) return [];
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
  routes.sort((a, b) => (b.amountOut > a.amountOut ? 1 : b.amountOut < a.amountOut ? -1 : 0));
  return routes;
}
/* items: [{route, amountIn}] — ルートごとに自分の入力額で spot 比較して
   priceImpactPct を付ける (ペア情報の取得はチェーンにつき1バッチにまとめる)。 */
async function attachImpactsMulti(chainObj, items) {
  if (!items.length) return;
  try {
    const { pairOf, info } = await fetchPairs(chainObj, items.map((i) => i.route));
    for (const it of items) {
      const spot = spotOutFor(it.route, it.amountIn, pairOf, info);
      if (spot !== null && spot > 0n) it.route.priceImpactPct = (1 - Number(it.route.amountOut) / Number(spot)) * 100;
    }
  } catch (e) { /* impact is optional */ }
}

/* ---------- v3 cross-chain: bridge calls ---------- */
function bridgePairBySym(sym) { return BRIDGE_PAIRS.find((p) => p.sym === sym) || null; }
function encodeRecipient32(address) { return encAddr(address); } // bytes32 = address left-padded to 32 bytes
function buildBridgeTx(pair, srcKey, recipient, amount, nativeValue) {
  const dstDomain = srcKey === "infinite" ? 766 : 421018;
  const data = SEL.transferRemote + encUint(dstDomain) + encodeRecipient32(recipient) + encUint(amount);
  if (srcKey === "infinite") return { to: pair.br.toLowerCase(), data, value: BigInt(nativeValue || 0n), dstDomain, functionName: "transferRemote" };
  return { to: pair.ql1Router.toLowerCase(), data, value: 0n, dstDomain, functionName: "transferRemote" };
}
function decodeBridgeTxData(data) {
  if (!data || data.slice(0, 10) !== SEL.transferRemote) return null;
  const w = [];
  for (let i = 10; i + 64 <= data.length; i += 64) w.push(data.slice(i, i + 64));
  if (w.length < 3) return null;
  return { destination: Number(BigInt("0x" + w[0])), recipient: "0x" + w[1].slice(-40), amount: BigInt("0x" + w[2]) };
}
async function fetchBridgeNativeQuote(pair) {
  const c = CHAINS.infinite;
  const data = SEL.quoteNative + encUint(766) + encUint(64) + encUint(0);
  const hex = await rpcOne(c, pair.br, data);
  if (!hex || hex === "0x" || hex.length < 322) return null;
  const words = hex.slice(2).match(/.{64}/g).map((x) => BigInt("0x" + x));
  return { nativeFee: words[0], gasPayment: words[1], totalNative: words[2] };
}
async function fetchBridgeDelivered(dstChainObj, messageId) {
  const mailbox = BRIDGE_MAILBOX[dstChainObj.key];
  if (!mailbox || !messageId) return null;
  const hex = await rpcOne(dstChainObj, mailbox, SEL.mailboxDelivered + messageId.replace("0x", ""));
  return hex ? BigInt(hex) === 1n : null;
}
async function readTokenBalance(chainObj, tokenAddr, account) {
  const hex = await rpcOne(chainObj, tokenAddr, SEL.balanceOf + encAddr(account));
  return decUint(hex) || 0n;
}
function extractMessageId(receipt) {
  if (!receipt || !Array.isArray(receipt.logs)) return null;
  for (const l of receipt.logs) {
    const t0 = (l.topics && l.topics[0] || "").toLowerCase();
    if ((t0 === TOPIC_BRIDGE_INITIATED || t0 === TOPIC_DISPATCH_ID) && l.topics.length > 1) return l.topics[1].toLowerCase();
  }
  return null;
}

/* ---------- v3/v5 cross-chain: quote FULL ROUTES per bridge intermediate ----------
   v5: 中継トークンごとに「交換1のバリアント × 交換2」を組み合わせた全体ルートを
   単位として返す。各全体ルートの最終額は、そのバリアントの交換1の実出力で交換2を
   実際に見積もり直した値 (最良レッグの額の流用はしない)。
   - 交換1: 上位3パス (直接含む) を保持。出すトークン自体が中継トークンの場合は
     交換なし (直接ブリッジ) の1バリアント。
   - 交換2: 各交換1バリアントには最良パスを、交換1最良バリアントには上位3パスを組み合わせる。
   - 重複する全体パスは除去。中継ごとに最大4件、全体で最大24件
     (中継ごとの最良1件とベンチマークの全体ルートは必ず残す)。
   戻り値の各要素は v4 互換フィールド (swap1Route / swap1Out / bridgeOut /
   swap2Route / finalOut / nativeFee / vsBench*) を持ち、加えて
   leg1Path / leg2Path (アドレス配列。交換なしの側は null) を持つ。 */
const X_MAX_ROUTES_PER_T = 4, X_MAX_ROUTES_TOTAL = 24, X_LEG_VARIANTS = 3;
async function quoteCrossPlan(srcKey, fromTok, dstKey, toTok, amountIn) {
  const src = CHAINS[srcKey], dst = CHAINS[dstKey];
  const disabled = [];
  const perPair = []; // [{pair, routes:[fullRoute...]}]
  const impactItems = { [srcKey]: [], [dstKey]: [] };
  for (const pair of BRIDGE_PAIRS) {
    const tSrc = tokenById(srcKey, srcKey === "infinite" ? pair.infId : pair.ql1Id);
    const tDst = tokenById(dstKey, dstKey === "infinite" ? pair.infId : pair.ql1Id);
    if (!tSrc || !tDst) continue;
    const enabledDir = srcKey === "ql1" ? pair.enabledFromQl1 : pair.enabledFromInf;
    if (!enabledDir) { disabled.push({ pair, tSrc, tDst, enabled: false, reason: t("xDisabledOsak") }); continue; }
    if (srcKey === "ql1" && fromTok.id === "native" && pair.sym === "QOM") { disabled.push({ pair, tSrc, tDst, enabled: false, reason: t("xDisabledWrap") }); continue; }
    // --- leg 1 variants: source -> bridge token (top distinct paths) ---
    let leg1Vars; // [{route|null, out}]
    if (fromTok.address.toLowerCase() === tSrc.address.toLowerCase()) {
      leg1Vars = [{ route: null, out: amountIn }];
    } else {
      const all = await fetchRoutesOnly(src, fromTok, tSrc, amountIn);
      if (!all.length) continue;
      leg1Vars = all.slice(0, X_LEG_VARIANTS).map((r) => ({ route: r, out: r.amountOut }));
    }
    const minT = 10n ** BigInt(tSrc.decimals);
    leg1Vars = leg1Vars.filter((v) => v.out >= minT);
    if (!leg1Vars.length) { disabled.push({ pair, tSrc, tDst, enabled: false, reason: t("xTooSmall") }); continue; }
    // --- leg 2 combinations (bridge fee 0, 1:1 — verified by sampling + quoteBridge) ---
    const leg2Identity = tDst.address.toLowerCase() === toTok.address.toLowerCase();
    const combos = new Map();
    const addCombo = (v, r2, finalOut) => {
      const key = (v.route ? v.route.path.join(",") : "-") + "|" + (r2 ? r2.path.join(",") : "-");
      if (combos.has(key)) return;
      combos.set(key, {
        pair, tSrc, tDst, enabled: true,
        swap1Route: v.route, swap1Out: v.out, bridgeOut: v.out,
        swap2Route: r2, finalOut,
        leg1Path: v.route ? v.route.path.slice() : null,
        leg2Path: r2 ? r2.path.slice() : null,
        nativeFee: 0n, vsBenchDiff: null, vsBenchPct: null, isBenchmark: false,
      });
    };
    let leg2TopForBest = null;
    for (let vi = 0; vi < leg1Vars.length; vi++) {
      const v = leg1Vars[vi];
      if (leg2Identity) { addCombo(v, null, v.out); continue; }
      const all2 = await fetchRoutesOnly(dst, tDst, toTok, v.out);
      if (!all2.length) continue;
      if (vi === 0) leg2TopForBest = all2.slice(0, X_LEG_VARIANTS);
      addCombo(v, all2[0], all2[0].amountOut);
    }
    if (leg2TopForBest) for (let i = 1; i < leg2TopForBest.length; i++) addCombo(leg1Vars[0], leg2TopForBest[i], leg2TopForBest[i].amountOut);
    let routes = [...combos.values()];
    if (!routes.length) continue;
    routes.sort((a, b) => (b.finalOut > a.finalOut ? 1 : b.finalOut < a.finalOut ? -1 : 0));
    routes = routes.slice(0, X_MAX_ROUTES_PER_T);
    if (srcKey === "infinite") { try { const q = await fetchBridgeNativeQuote(pair); const fee = q ? q.totalNative : 0n; for (const r of routes) r.nativeFee = fee; } catch (e) { /* shown as approx */ } }
    perPair.push({ pair, routes });
    for (const r of routes) {
      if (r.swap1Route) impactItems[srcKey].push({ route: r.swap1Route, amountIn });
      if (r.swap2Route) impactItems[dstKey].push({ route: r.swap2Route, amountIn: r.bridgeOut });
    }
  }
  /* v4 benchmark: the "obvious" route — via QOM, or bridging the source token
     itself when that is possible. The better of the two intermediates' best
     full routes is the benchmark; every full route gets its difference vs it. */
  let benchmark = null, benchmarkRoute = null;
  const considerPair = (sym, kind) => {
    const pp = perPair.find((p) => p.pair.sym === sym);
    if (!pp || !pp.routes.length) return;
    const best = pp.routes[0];
    if (!benchmark || best.finalOut > benchmark.finalOut) { benchmark = { sym, kind, finalOut: best.finalOut }; benchmarkRoute = best; }
  };
  considerPair("QOM", "qom");
  const directPP = perPair.find((p) => {
    const ts = tokenById(srcKey, srcKey === "infinite" ? p.pair.infId : p.pair.ql1Id);
    return ts && ts.address.toLowerCase() === fromTok.address.toLowerCase();
  });
  if (directPP) considerPair(directPP.pair.sym, "direct");
  if (benchmarkRoute) benchmarkRoute.isBenchmark = true;
  /* global cap: keep the best full route of every intermediate, then fill by
     output up to the cap (the benchmark route is a per-intermediate best, so
     it is always kept). */
  let all = perPair.flatMap((p) => p.routes);
  all.sort((a, b) => (b.finalOut > a.finalOut ? 1 : b.finalOut < a.finalOut ? -1 : 0));
  let kept = all;
  if (all.length > X_MAX_ROUTES_TOTAL) {
    const keepSet = new Set(perPair.map((p) => p.routes[0]));
    for (const r of all) { if (keepSet.size >= X_MAX_ROUTES_TOTAL) break; keepSet.add(r); }
    kept = all.filter((r) => keepSet.has(r));
  }
  if (benchmark) {
    for (const c of kept) {
      c.vsBenchDiff = c.finalOut - benchmark.finalOut;
      c.vsBenchPct = benchmark.finalOut > 0n ? (Number(c.vsBenchDiff) / Number(benchmark.finalOut)) * 100 : 0;
    }
  }
  /* impacts only for the routes that survive (leg routes carry their own inputs) */
  for (const key of [srcKey, dstKey]) {
    const items = impactItems[key].filter((it) =>
      kept.some((r) => (key === srcKey ? r.swap1Route : r.swap2Route) === it.route));
    if (items.length) await attachImpactsMulti(CHAINS[key], items);
  }
  const result = [...kept, ...disabled];
  result.benchmark = benchmark;
  return result;
}

/* ---------- v6/v6.1: cross-chain SPLIT evaluation across full routes ----------
   1つの取引を複数の全体ルートに割合配分する。各パートは「その全体ルートの
   保存パス」を「そのパートの金額」で実際に見積もり直す (交換1 → ブリッジ1:1 →
   交換2)。最良レッグの額を流用しない。直接ブリッジの全体ルートも候補に含む。
   v6.1 で候補と探索を拡張 (ユーザー指摘: 中継 QOM の leg1 バリアント
   USDT→FISH→QOM が分割候補から漏れていた):
   - 候補 = 全体ルートの最終額順 上位6件 + 中継ごとの最良ルート (最大8件)。
     同じ中継の異なるパス (leg1 / leg2 バリアント) も別々の候補。
   - 探索 = 候補の全ペア・全3分割・全4分割 × 10%刻み配分 (各パート10%以上)。
   v6.2 で探索を 1% 刻みに精密化 (ユーザー要望「1%刻みで最善の結果を」):
   - ステージ1a: 上記 10% グリッド (5分割まで拡張)。
   - ステージ1b: 候補プール内のペアを 1% 刻みで全探索 (99配分/ペア)。
   - ステージ2: 最良配分から山登り微調整 (ステップ 5% → 2% → 1%。
     パート間の移し替え + 未使用候補の 1% 追加 — 追加候補はプールでなく
     全体ルート一覧の全件から。パート数は最大5)。1% ムーブで改善が
     無くなったら終了する局所最適であり、数学的な大域最適の証明ではない。
   - 全ステージで (ルート, 金額) 単位の見積もりキャッシュを共有する。
   v6.4 で同一中継の扱いを変更 (ユーザー指摘: 宛先が QOM 以外だと中継 QOM
   の R1/R2 が組み合わせられない): v6.1 の「交換2が実在する中継は1パート
   まで」という禁止を廃し、同一中継・同一 leg2Path のパート群は交換2を
   合算額で1回だけ見積もり、到着額に比例配分する合算モデルに置き換えた
   (combineLeg2Groups / distributeCombinedOut)。v6.1 が潰したかった
   「同じ宛先プールを2回独立見積もりする幻の勝ち」(10B QOM の BABY
   バリアント同士 50:50 の +0.33%) は、合算により構造的に消える。
   実行フェーズは従来どおりパート個別で、見積もりモデルだけの変更。
   パート金額は pct の床割りで統一し (見積もりはキャッシュ、RPC は
   レッグごとに一括)、勝った配分だけ最後に端数を最大パートへ寄せて
   同じモデルで再計算し、パート合計 = 入力額ちょうどにする。
   plan は「最良の分割が単一ベスト全体ルートに勝ったとき」だけ立つ (正直ルール)。 */
function crossSplitPool(enabled) {
  const pool = enabled.slice(0, 6);
  for (const r of enabled) {
    if (pool.length >= 8) break;
    if (!pool.includes(r) && !pool.some((p) => p.pair.sym === r.pair.sym)) pool.push(r);
  }
  return pool;
}
const X_SPLIT_COMPS = { 2: [], 3: [], 4: [], 5: [] };
(function buildSplitComps() {
  const gen = (n, total, prefix) => {
    if (n === 1) { if (total >= 10) X_SPLIT_COMPS[prefix.length + 1].push([...prefix, total]); return; }
    for (let p = 10; p <= total - 10 * (n - 1); p += 10) gen(n - 1, total - p, [...prefix, p]);
  };
  gen(2, 100, []); gen(3, 100, []); gen(4, 100, []); gen(5, 100, []);
})();
/* ---------- v6.4: combined leg-2 quoting for shared intermediates ----------
   v6.1 では「交換2が実在する中継は1プランに1パートまで」と禁止していた
   (同じ宛先プールを2回独立に見積もると合計が上振れるため)。v6.4 では禁止
   ではなく合算見積もりに置き換える: 同一中継・同一 leg2Path のパート群は、
   交換2 を「ブリッジ到着額の合計」で1回だけ見積もり、出力を到着額に比例
   配分する (端数はグループ内最大パートへ)。これで上振れは構造的に消え、
   宛先が QOM 以外でも中継 QOM の R1/R2 のような組み合わせが使える。
   交換1 は従来どおりパートごとの独立見積もり (同一チェーン分割と同じ)。 */
function leg2GroupKey(cand) {
  return cand.leg2Path ? cand.pair.sym + "|" + cand.leg2Path.map((a) => String(a).toLowerCase()).join(",") : null;
}
/* parts: [{cand, leg1Out}] -> leg2 を共有するグループ [{key, cand, totalIn, idxs}] */
function combineLeg2Groups(parts) {
  const groups = new Map();
  parts.forEach((p, i) => {
    const key = leg2GroupKey(p.cand);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, { key, cand: p.cand, totalIn: 0n, idxs: [] });
    const g = groups.get(key);
    g.totalIn += p.leg1Out;
    g.idxs.push(i);
  });
  return [...groups.values()];
}
/* 合算見積もりの出力を到着額 (leg1Out) の比率で配分する。端数は最大パートへ。 */
function distributeCombinedOut(totalOut, leg1Outs) {
  const totalIn = leg1Outs.reduce((s, x) => s + x, 0n);
  if (totalIn <= 0n) return leg1Outs.map(() => 0n);
  const shares = leg1Outs.map((o) => (totalOut * o) / totalIn);
  const dust = totalOut - shares.reduce((s, x) => s + x, 0n);
  if (dust > 0n) {
    let mi = 0;
    for (let i = 1; i < leg1Outs.length; i++) if (leg1Outs[i] > leg1Outs[mi]) mi = i;
    shares[mi] += dust;
  }
  return shares;
}
async function requoteSplitPart(srcKey, dstKey, cand, amount) {
  let o1 = null;
  if (!cand.leg1Path) o1 = amount;
  else {
    const res = await rpcBatch(CHAINS[srcKey], [[CHAINS[srcKey].router, encodeGetAmountsOut(amount, cand.leg1Path)]]);
    const amts = decodeAmountsOut(res[0]);
    o1 = amts && amts.length ? amts[amts.length - 1] : null;
  }
  if (o1 == null || o1 <= 0n) return null;
  if (o1 < (10n ** BigInt(cand.tSrc.decimals))) return null;
  if (!cand.leg2Path) return { leg1Out: o1, finalOut: o1 };
  const res2 = await rpcBatch(CHAINS[dstKey], [[CHAINS[dstKey].router, encodeGetAmountsOut(o1, cand.leg2Path)]]);
  const amts2 = decodeAmountsOut(res2[0]);
  const v = amts2 && amts2.length ? amts2[amts2.length - 1] : null;
  return v != null && v > 0n ? { leg1Out: o1, finalOut: v } : null;
}
/* ---------- v6.2/v6.4: cross-split quoter ----------
   交換1 は (候補ルート, 金額) 単位でキャッシュする。交換2 は v6.4 から
   「グループキー (中継+leg2Path) × 合算到着額」単位でキャッシュする
   (combineLeg2Groups 参照 — 同一 leg2 を共有するパートは合算で1回だけ
   見積もり、比例配分する)。探索の全ステージでキャッシュを共有し、
   1回の rpcBatch が大きくなりすぎないよう 150 件ずつに区切る。 */
function makeCrossSplitQuoter(srcKey, dstKey, candIdx) {
  const leg1Cache = new Map(); // "candIdx|amount" -> leg1Out (BigInt) | null (null = その金額では交換1不可)
  const leg2Cache = new Map(); // "groupKey|totalIn" -> combined leg2 totalOut (BigInt) | null
  const stats = { partQuotes: 0, leg2Quotes: 0, batches: 0 };
  const CHUNK = 150;
  const leg1Key = (cand, amount) => candIdx.get(cand) + "|" + amount.toString();
  async function ensureLeg1(jobs) {
    const missing = [];
    const seen = new Set();
    for (const j of jobs) {
      if (!j || j.amount == null || j.amount <= 0n) continue;
      const key = leg1Key(j.cand, j.amount);
      if (!leg1Cache.has(key) && !seen.has(key)) { seen.add(key); missing.push({ key, cand: j.cand, amount: j.amount }); }
    }
    for (let s = 0; s < missing.length; s += CHUNK) {
      const chunk = missing.slice(s, s + CHUNK);
      stats.partQuotes += chunk.length;
      const calls = [], keys = [];
      for (const m of chunk) {
        if (!m.cand.leg1Path) leg1Cache.set(m.key, m.amount); // identity leg 1 = direct bridge
        else { keys.push(m.key); calls.push([CHAINS[srcKey].router, encodeGetAmountsOut(m.amount, m.cand.leg1Path)]); }
      }
      if (calls.length) {
        stats.batches++;
        const res = await rpcBatch(CHAINS[srcKey], calls);
        keys.forEach((key, k) => { const amts = decodeAmountsOut(res[k]); leg1Cache.set(key, amts && amts.length ? amts[amts.length - 1] : null); });
      }
    }
  }
  async function ensureLeg2(jobs) {
    // jobs: [{key (groupKey|totalIn), path, totalIn}]
    const missing = [];
    const seen = new Set();
    for (const j of jobs) {
      if (!j || j.totalIn == null || j.totalIn <= 0n) continue;
      if (!leg2Cache.has(j.key) && !seen.has(j.key)) { seen.add(j.key); missing.push(j); }
    }
    for (let s = 0; s < missing.length; s += CHUNK) {
      const chunk = missing.slice(s, s + CHUNK);
      stats.leg2Quotes += chunk.length;
      stats.batches++;
      const res = await rpcBatch(CHAINS[dstKey], chunk.map((m) => [CHAINS[dstKey].router, encodeGetAmountsOut(m.totalIn, m.path)]));
      chunk.forEach((m, k) => {
        const amts = decodeAmountsOut(res[k]);
        const v = amts && amts.length ? amts[amts.length - 1] : null;
        leg2Cache.set(m.key, v != null && v > 0n ? v : null);
      });
    }
  }
  return {
    ensureLeg1, ensureLeg2, stats,
    getLeg1: (cand, amount) => leg1Cache.get(leg1Key(cand, amount)) ?? null,
    hasLeg1: (cand, amount) => leg1Cache.has(leg1Key(cand, amount)),
    getLeg2: (key) => leg2Cache.get(key) ?? null,
    hasLeg2: (key) => leg2Cache.has(key),
  };
}
async function evaluateCrossSplit(srcKey, dstKey, amountIn, cands) {
  const enabled = (cands || []).filter((c) => c.enabled);
  const bestSingle = enabled.length ? enabled[0] : null;
  if (!bestSingle || enabled.length < 2 || amountIn <= 0n) return { evaluated: 0, best: null, plan: null, bestSingle };
  const pool = crossSplitPool(enabled);
  if (pool.length < 2) return { evaluated: 0, best: null, plan: null, bestSingle };
  const t0 = Date.now();
  const candIdx = new Map(); enabled.forEach((c, i) => candIdx.set(c, i));
  const quoter = makeCrossSplitQuoter(srcKey, dstKey, candIdx);
  const partAmount = (pct) => (amountIn * BigInt(pct)) / 100n;
  /* Batch-scorer for allocations ([{cand, pct, amountIn?}]).
     v6.4: parts sharing one leg 2 (same intermediate + same leg2Path) get ONE
     combined leg-2 quote on their summed bridge arrival, distributed back
     pro-rata (see combineLeg2Groups). Leg 1 stays per-part independent.
     A part whose leg-1 output is missing or below the bridge minimum makes
     the whole allocation unusable (null), as before. */
  const scoreAllocations = async (allocs) => {
    const partLists = allocs.map((a) => a.map((l) => ({
      cand: l.cand, pct: l.pct, amountIn: l.amountIn != null ? l.amountIn : partAmount(l.pct),
    })));
    await quoter.ensureLeg1(partLists.flat().map((p) => ({ cand: p.cand, amount: p.amountIn })));
    const resolved = partLists.map((parts) => {
      const items = [];
      for (const p of parts) {
        if (p.amountIn <= 0n) return null;
        const o1 = quoter.getLeg1(p.cand, p.amountIn);
        if (o1 == null || o1 <= 0n || o1 < (10n ** BigInt(p.cand.tSrc.decimals))) return null;
        items.push({ cand: p.cand, pct: p.pct, amountIn: p.amountIn, leg1Out: o1 });
      }
      return items;
    });
    const leg2Jobs = new Map();
    for (const items of resolved) {
      if (!items) continue;
      for (const g of combineLeg2Groups(items)) {
        const key = g.key + "|" + g.totalIn.toString();
        if (!quoter.hasLeg2(key)) leg2Jobs.set(key, { key, path: g.cand.leg2Path, totalIn: g.totalIn });
      }
    }
    await quoter.ensureLeg2([...leg2Jobs.values()]);
    return resolved.map((items) => {
      if (!items) return null;
      const parts = items.map((p) => ({ cand: p.cand, pct: p.pct, amountIn: p.amountIn, leg1Out: p.leg1Out, finalOut: p.leg1Out }));
      for (const g of combineLeg2Groups(items)) {
        const tot = quoter.getLeg2(g.key + "|" + g.totalIn.toString());
        if (tot == null || tot <= 0n) return null;
        const shares = distributeCombinedOut(tot, g.idxs.map((i) => items[i].leg1Out));
        g.idxs.forEach((pi, k) => { parts[pi].finalOut = shares[k]; });
      }
      let total = 0n;
      for (const p of parts) {
        if (p.finalOut == null || p.finalOut <= 0n) return null;
        total += p.finalOut;
      }
      return { parts, totalOut: total };
    });
  };
  let evaluated = 0;
  let best = null;
  const considerAll = async (allocs) => {
    if (!allocs.length) return;
    const scores = await scoreAllocations(allocs);
    allocs.forEach((a, i) => {
      evaluated++;
      const s = scores[i];
      if (s && (!best || s.totalOut > best.totalOut)) best = s;
    });
  };
  // ---- stage 1a: 10% grid over the pool (2..5 parts, each >= 10%) ----
  const combosOf = (n) => {
    const out = [];
    const rec = (start, picked) => {
      if (picked.length === n) { out.push(picked.slice()); return; }
      for (let i = start; i <= pool.length - (n - picked.length); i++) { picked.push(i); rec(i + 1, picked); picked.pop(); }
    };
    rec(0, []);
    return out;
  };
  const gridAllocs = [];
  for (const n of [2, 3, 4, 5]) {
    if (pool.length < n) break;
    for (const idxs of combosOf(n)) {
      const routes = idxs.map((i) => pool[i]);
      for (const comp of X_SPLIT_COMPS[n]) {
        gridAllocs.push(routes.map((cand, k) => ({ cand, pct: comp[k] })));
      }
    }
  }
  await considerAll(gridAllocs);
  // ---- stage 1b: pairs brute-forced at 1% steps over the top-5 pool routes
  // (quote-count control; stage 2 can still add/grow any other route) ----
  const pairPool = pool.slice(0, 5);
  const pairAllocs = [];
  for (let i = 0; i < pairPool.length; i++) for (let j = i + 1; j < pairPool.length; j++) {
    for (let p = 1; p <= 99; p++) pairAllocs.push([{ cand: pairPool[i], pct: p }, { cand: pairPool[j], pct: 100 - p }]);
  }
  await considerAll(pairAllocs);
  // ---- stage 2 (v6.2): hill-climb refinement 5% -> 2% -> 1%. Adds may come
  // from ANY enabled full route (not just the pool), plans may reach 5 parts.
  // Scoring goes through scoreAllocations, so the v6.4 combined leg-2 rule
  // applies to every refinement move as well.
  let refineInfo = { iterations: 0, evaluatedMoves: 0 };
  if (best) {
    const refined = await refineSplitAllocation(
      best.parts.map((p) => ({ cand: p.cand, pct: p.pct })), best, scoreAllocations,
      { addCandidates: enabled, maxParts: 5, keyOf: (c) => candIdx.get(c), maxIterations: 150, budget: () => quoter.stats.partQuotes + quoter.stats.leg2Quotes < 8000 });
    refineInfo = { iterations: refined.iterations, evaluatedMoves: refined.evaluatedMoves };
    evaluated += refined.evaluatedMoves;
    if (refined.score && refined.score.totalOut > best.totalOut) best = refined.score;
  }
  if (best) {
    // display order: largest part first; then fold the floor-rounding dust
    // into the largest part and re-score the whole plan under the same
    // (combined leg-2) model, so the parts sum to exactly amountIn without
    // overstating any part's quote.
    best.parts.sort((a, b) => b.pct - a.pct);
    const dust = amountIn - best.parts.reduce((s, p) => s + p.amountIn, 0n);
    if (dust > 0n) {
      const adjusted = best.parts.map((p, i) => ({ cand: p.cand, pct: p.pct, amountIn: i === 0 ? p.amountIn + dust : p.amountIn }));
      const rescored = (await scoreAllocations([adjusted]))[0];
      if (rescored) best = rescored;
    }
  }
  const plan = best && best.totalOut > bestSingle.finalOut ? best : null;
  return { evaluated, best, plan, bestSingle, refineStats: { partQuotes: quoter.stats.partQuotes, leg2Quotes: quoter.stats.leg2Quotes, batches: quoter.stats.batches, iterations: refineInfo.iterations, ms: Date.now() - t0 } };
}

/* ---------- v6: split-flow arrival attribution (pure; harness-tested) ----------
   同じ中継トークンのパートが複数ある場合、到着分はパートの順番どおりに
   「そのパートがブリッジした見込み量」まで割り当てる。最後のパートだけは、
   合計が見込み合計 (許容誤差内) に達した時点で実際の残り全部を受け取る
   (過剰配達や端数が宙に浮かないように)。
   parts: [{sym, bridgedAmount(string|null), arrivedAmt, arrivedFlag}]
   arrivedBySym: {sym: BigInt (基準残高を引いた到着合計)} */
function attributeSplitArrivals(parts, arrivedBySym) {
  const groups = new Map();
  for (const p of parts) {
    if (p.bridgedAmount == null) continue;
    if (!groups.has(p.sym)) groups.set(p.sym, []);
    groups.get(p.sym).push(p);
  }
  for (const [sym, group] of groups) {
    let remaining = BigInt(arrivedBySym[sym] != null ? arrivedBySym[sym] : "0");
    if (remaining < 0n) remaining = 0n;
    const totalBridged = group.reduce((s, p) => s + BigInt(p.bridgedAmount), 0n);
    const covered = remaining > 0n && remaining >= totalBridged - (totalBridged / 1000n + 1n);
    group.forEach((p, i) => {
      const bridged = BigInt(p.bridgedAmount);
      const isLast = i === group.length - 1;
      let attributed = isLast && covered ? remaining : (remaining < bridged ? remaining : bridged);
      if (attributed < 0n) attributed = 0n;
      remaining -= attributed; if (remaining < 0n) remaining = 0n;
      p.arrivedAmt = attributed.toString();
      p.arrivedFlag = attributed > 0n && attributed >= bridged - (bridged / 1000n + 1n);
    });
  }
}
/* split flow の現在フェーズ (パートの最小未完ステップから導出。永続化しない) */
function crossSplitPhase(f) {
  if (!f || !Array.isArray(f.parts) || !f.parts.length) return "done";
  if (f.parts.every((p) => p.step === 4 || p.step === "error")) return "done";
  if (f.parts.some((p) => p.step === 0)) return 1;
  if (f.parts.some((p) => p.step === 1)) return 2;
  if (f.parts.some((p) => p.step === 2)) return 3;
  return 4;
}

/* ---------- v4 arbitrage: price-gap routes between QL1 and Infinite ----------
   Numeraire is QOM (exists on both chains, bridges 1:1 at fee 0).
   Every number comes from running the real route quotes (fetchBestRoute =
   getAmountsOut on each leg) at the requested size — spot prices of these
   thin pools would lie. Bridge messaging fees are converted into QOM terms
   and deducted: Infinite-origin sends pay quoteNative in [42] (converted via
   the live 42->QOM route); QL1-origin sends measured 0. DEX gas is NOT
   included (the UI says so). */
function qomTokenId(chainKey) { return chainKey === "infinite" ? "qom" : "wqom"; }
async function fetchBridgeFeeInQom(pair, cache) {
  if (cache && cache.has(pair.sym)) return cache.get(pair.sym);
  let fee = 0n;
  try {
    const q = await fetchBridgeNativeQuote(pair);
    if (q && q.totalNative > 0n) {
      const conv = await fetchBestRoute(CHAINS.infinite, tokenById("infinite", "native"), tokenById("infinite", "qom"), q.totalNative);
      if (conv) fee = conv.amountOut;
    }
  } catch (e) { fee = 0n; }
  if (cache) cache.set(pair.sym, fee);
  return fee;
}
async function quoteArbRoute(dirKey, pair, startRaw, feeCache) {
  const srcKey = dirKey === "infToQl1" ? "infinite" : "ql1";
  const dstKey = srcKey === "infinite" ? "ql1" : "infinite";
  const src = CHAINS[srcKey], dst = CHAINS[dstKey];
  const row = { sym: pair.sym, dirKey, srcKey, dstKey, startRaw, ok: false, reason: null, isBenchmark: pair.sym === "QOM" };
  const enabled = srcKey === "ql1" ? pair.enabledFromQl1 : pair.enabledFromInf;
  if (!enabled) { row.reason = t("xDisabledOsak"); return row; }
  const qomSrc = tokenById(srcKey, qomTokenId(srcKey));
  const qomDst = tokenById(dstKey, qomTokenId(dstKey));
  const tSrc = tokenById(srcKey, srcKey === "infinite" ? pair.infId : pair.ql1Id);
  const tDst = tokenById(dstKey, dstKey === "infinite" ? pair.infId : pair.ql1Id);
  if (!qomSrc || !qomDst || !tSrc || !tDst) { row.reason = t("errNoRoute"); return row; }
  let mid = startRaw, swap1Route = null;
  if (pair.sym !== "QOM") {
    const best = await fetchBestRoute(src, qomSrc, tSrc, startRaw);
    if (!best) { row.reason = t("errNoRoute"); return row; }
    mid = best.amountOut; swap1Route = best;
  }
  if (mid < (10n ** BigInt(tSrc.decimals))) { row.reason = t("xTooSmall"); return row; }
  let endRaw = mid, swap2Route = null;
  if (pair.sym !== "QOM") {
    const best2 = await fetchBestRoute(dst, tDst, qomDst, mid);
    if (!best2) { row.reason = t("errNoRoute"); return row; }
    endRaw = best2.amountOut; swap2Route = best2;
  }
  let feeQom = 0n;
  if (srcKey === "infinite") feeQom = await fetchBridgeFeeInQom(pair, feeCache);
  let feeQomRt = feeQom;
  if (dstKey === "infinite") feeQomRt = feeQom + (await fetchBridgeFeeInQom(bridgePairBySym("QOM"), feeCache));
  row.ok = true;
  row.midRaw = mid; row.endRaw = endRaw;
  row.swap1Route = swap1Route; row.swap2Route = swap2Route;
  row.feeQom = feeQom; row.feeQomRt = feeQomRt;
  row.netSingle = endRaw - feeQom;
  row.gainSinglePct = startRaw > 0n ? (Number(row.netSingle - startRaw) / Number(startRaw)) * 100 : 0;
  row.netRt = endRaw - feeQomRt;
  row.gainRtPct = startRaw > 0n ? (Number(row.netRt - startRaw) / Number(startRaw)) * 100 : 0;
  return row;
}
async function quoteArbBoard(startRaw) {
  const feeCache = new Map();
  const jobs = [];
  for (const dirKey of ["infToQl1", "ql1ToInf"]) for (const pair of BRIDGE_PAIRS) jobs.push({ dirKey, pair });
  const rows = [];
  const CHUNK = 4;
  for (let i = 0; i < jobs.length; i += CHUNK) {
    const part = await Promise.all(jobs.slice(i, i + CHUNK).map((j) => quoteArbRoute(j.dirKey, j.pair, startRaw, feeCache).catch((e) => ({
      sym: j.pair.sym, dirKey: j.dirKey, srcKey: j.dirKey === "infToQl1" ? "infinite" : "ql1", dstKey: j.dirKey === "infToQl1" ? "ql1" : "infinite",
      startRaw, ok: false, reason: (e && e.message) || "error", isBenchmark: j.pair.sym === "QOM",
    }))));
    rows.push(...part);
  }
  return rows;
}

/* ---------- v3 cross-chain: guided flow state (localStorage persistence) ---------- */
const XFLOW_KEY = "dexagg_xflow_v1";
function serializeXFlow(flow) { return flow ? JSON.stringify(flow) : null; }
function restoreXFlow(json) {
  if (!json) return null;
  try {
    const f = JSON.parse(json);
    if (!f || !f.srcKey || !f.dstKey) return null;
    if (f.v === 2 && f.kind === "split" && Array.isArray(f.parts) && f.parts.length >= 2) return f;
    if (f.v !== 1 || !f.sym) return null;
    return f;
  } catch (e) { return null; }
}
function saveXFlow() {
  try {
    if (state.xflow) localStorage.setItem(XFLOW_KEY, serializeXFlow(state.xflow));
    else if (localStorage.removeItem) localStorage.removeItem(XFLOW_KEY);
  } catch (e) { /* ignore */ }
}
function loadXFlow() {
  try { state.xflow = restoreXFlow(localStorage.getItem(XFLOW_KEY)); } catch (e) { state.xflow = null; }
  return state.xflow;
}

/* ---------- token metadata (CA add) ---------- */
async function fetchTokenMeta(chainObj, address) {
  const addr = address.toLowerCase();
  const res = await rpcBatch(chainObj, [[addr, SEL.symbol], [addr, SEL.name], [addr, SEL.decimals]]);
  const symbol = decStr(res[0]); const name = decStr(res[1]);
  const decimals = res[2] ? Number(decUint(res[2])) : null;
  if (!symbol && decimals == null) throw new Error(t("errTokenRead"));
  return { id: "ca_" + addr, symbol: symbol || "?", name: name || "", address: addr, decimals: decimals != null ? decimals : 18, isNative: false, custom: true };
}

/* ---------- storage ---------- */
function loadLocal() {
  try {
    const c = JSON.parse(localStorage.getItem("dexagg_custom_v1") || "{}");
    for (const k of ["infinite", "ql1", "testnet"]) if (Array.isArray(c[k])) state.custom[k] = c[k];
  } catch (e) { /* ignore */ }
}
function saveLocal() {
  try { localStorage.setItem("dexagg_custom_v1", JSON.stringify(state.custom)); } catch (e) { /* ignore */ }
}

/* ================= browser UI ================= */
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function setStatus(msg, isErr) { const el = $("status"); if (el) { el.textContent = msg || ""; el.style.color = isErr ? "#ff9d9d" : ""; } }
function pathLabel(chainKey, path) { return path.map((a) => symbolFor(chainKey, a)).join(" → "); }

function fillTokenSelects() {
  const c = chain();
  const toks = allTokens();
  const mk = (sel, keepId) => {
    const cur = keepId || sel.value;
    sel.innerHTML = toks.map((tk) => '<option value="' + esc(tk.id) + '">' + esc(tk.symbol) + (tk.name ? " — " + esc(tk.name) : "") + "</option>").join("");
    sel.value = tokenById(state.chainKey, cur) ? cur : "";
  };
  mk($("fromToken")); mk($("toToken"));
  if (!$("fromToken").value) $("fromToken").value = c.defaultFrom;
  if (!$("toToken").value) $("toToken").value = c.defaultTo;
  if ($("fromToken").value === $("toToken").value) {
    $("fromToken").value = c.defaultFrom;
    if ($("fromToken").value === $("toToken").value) $("toToken").value = c.defaultTo;
  }
}
function currentFrom() { return tokenById(state.chainKey, $("fromToken").value); }
function currentTo() { return tokenById(state.chainKey, $("toToken").value); }
function clearRoutes(msg) {
  state.routes = []; state.directOut = null; state.splitEstimate = null; state.splitEval = null; state.gasPrice = null;
  state.selectedIdx = 0; state.selectedPlan = { type: "single", idx: 0 }; state.lastQuote = null;
  if ($("planArea")) $("planArea").innerHTML = "";
  $("routeList").innerHTML = msg ? '<p class="count">' + esc(msg) + "</p>" : "";
  $("splitNote").textContent = "";
  if ($("receiveOut")) $("receiveOut").textContent = "0.0";
  if ($("rateLine")) $("rateLine").textContent = "";
  if ($("gasLine")) $("gasLine").textContent = "";
  $("minLine").textContent = "";
  $("swapBtn").disabled = true;
}
function renderBalances() {
  const f = currentFrom(), tk = currentTo();
  const line = (tok) => {
    if (!state.account) return t("balanceConnectFirst");
    const raw = state.balances[tok.id];
    return raw == null ? "…" : formatAmount(raw, tok.decimals, 6) + " " + tok.symbol;
  };
  $("fromBalance").textContent = f ? t("balanceLabel") + line(f) : "";
  $("toBalance").textContent = tk ? t("balanceLabel") + line(tk) : "";
}
async function refreshBalances() {
  if (!state.account) { renderBalances(); return; }
  const c = chain(); const f = currentFrom(), tk = currentTo();
  try {
    const calls = [], ids = [];
    for (const tok of [f, tk]) {
      if (!tok || tok.isNative) continue;
      calls.push([tok.address, SEL.balanceOf + encAddr(state.account)]); ids.push(tok.id);
    }
    const res = calls.length ? await rpcBatch(c, calls) : [];
    ids.forEach((id2, i) => { state.balances[id2] = decUint(res[i]) || 0n; });
    for (const tok of [f, tk]) {
      if (tok && tok.isNative) {
        const hex = await rpcMethod(c, "eth_getBalance", [state.account, "latest"]);
        state.balances[tok.id] = hex ? BigInt(hex) : 0n;
      }
    }
  } catch (e) { /* balances are optional display */ }
  renderBalances();
}
function planOut() {
  if (state.selectedPlan.type === "split" && state.splitEval && state.splitEval.plan) return state.splitEval.plan.totalOut;
  const r = state.routes[state.selectedIdx];
  return r ? r.amountOut : null;
}
function planGasUnits() {
  if (state.selectedPlan.type === "split" && state.splitEval && state.splitEval.plan) return estimateGasUnitsSplit(state.splitEval.plan.legs);
  const r = state.routes[state.selectedIdx];
  return r ? estimateGasUnitsSingle(r) : null;
}
function renderPlans() {
  const area = $("planArea"); if (!area) return;
  const toTok = state.lastQuote ? tokenById(state.chainKey, state.lastQuote.toId) : null;
  const se = state.splitEval;
  if (!se || !se.best || !toTok) { area.innerHTML = ""; return; }
  if (!se.plan) {
    area.innerHTML = '<p class="count">' + esc(t("splitLost", formatAmount(se.best.totalOut, toTok.decimals, 6), toTok.symbol)) + "</p>";
    return;
  }
  const plan = se.plan;
  const singleBest = state.routes[0];
  const diff = singleBest ? (Number(plan.totalOut - singleBest.amountOut) / Number(singleBest.amountOut)) * 100 : 0;
  const legsHtml = plan.legs.map((leg) =>
    '<span class="split-leg"><span class="split-leg-head"><span class="pct-chip">' + leg.pct + '%</span>' +
    '<span class="split-path">' + esc(pathLabel(state.chainKey, leg.route.path)) + '</span>' +
    '<span class="split-leg-out">' + formatAmount(leg.amountOut, toTok.decimals, 6) + " " + esc(toTok.symbol) + '</span></span>' +
    '<span class="split-bar"><span class="split-bar-fill" style="width:' + leg.pct + '%"></span></span></span>'
  ).join("");
  area.innerHTML = '<button type="button" id="splitCard" class="route-card split-card' + (state.selectedPlan.type === "split" ? " selected" : "") + '">' +
    '<span class="r-head"><span class="r-rank">' + esc(t("planSplitTitle")) + '</span><span class="badge best">' + esc(t("badgeRecommended")) + '</span>' +
    '<span class="r-out">' + formatAmount(plan.totalOut, toTok.decimals, 6) + " " + esc(toTok.symbol) + '</span></span>' +
    '<span class="r-line">' + esc(t("splitVsSingle", diff.toFixed(2))) + " ／ " + esc(t("gasEst")) + ": " + esc(formatGas(chain(), estimateGasUnitsSplit(plan.legs))) + '</span>' +
    legsHtml + '</button>';
  const card = $("splitCard");
  if (card) card.addEventListener("click", selectSplit);
}
function renderRoutes() {
  const c = chain(); const toTok = state.lastQuote ? tokenById(state.chainKey, state.lastQuote.toId) : null;
  const list = $("routeList");
  if (!state.routes.length || !toTok) { list.innerHTML = ""; return; }
  renderPlans();
  list.innerHTML = state.routes.map((r, i) => {
    let vs;
    if (r.hops === 1) vs = t("routeDirect");
    else if (state.directOut != null) {
      const diff = (Number(r.amountOut - state.directOut) / Number(state.directOut)) * 100;
      vs = t("routeVsDirect", diff.toFixed(2));
    } else vs = t("routeNoDirect");
    const impact = r.priceImpactPct != null ? t("routeImpact", r.priceImpactPct.toFixed(2)) : t("routeImpactNA");
    return '<button type="button" class="route-card' + (state.selectedPlan.type === "single" && i === state.selectedIdx ? " selected" : "") + '" data-idx="' + i + '">' +
      '<span class="r-head"><span class="r-rank">' + (i + 1) + '</span>' + (i === 0 ? '<span class="badge best">' + esc(t("routeBest")) + '</span>' : "") +
      '<span class="r-out">' + formatAmount(r.amountOut, toTok.decimals, 6) + " " + esc(toTok.symbol) + "</span></span>" +
      '<span class="r-line">' + esc(pathLabel(state.chainKey, r.path)) + "</span>" +
      '<span class="r-line">' + esc(vs) + " ／ " + esc(t("routeHops", r.hops)) + " ／ " + esc(impact) + " ／ " + esc(t("gasEst")) + ": " + esc(formatGas(c, estimateGasUnitsSingle(r))) + "</span></button>";
  }).join("");
  list.querySelectorAll(".route-card").forEach((el) => el.addEventListener("click", () => selectRoute(Number(el.dataset.idx))));
  updateReceive();
}
function selectRoute(idx) {
  state.selectedIdx = idx;
  state.selectedPlan = { type: "single", idx };
  renderRoutes();
}
function selectSplit() {
  if (!state.splitEval || !state.splitEval.plan) return;
  state.selectedPlan = { type: "split" };
  renderRoutes();
}
function selectedRoute() {
  const r = state.routes[state.selectedIdx];
  if (!r || !state.lastQuote) return null;
  return { ...r, amountIn: state.lastQuote.amountIn };
}
function updateReceive() {
  const toTok = state.lastQuote ? tokenById(state.chainKey, state.lastQuote.toId) : null;
  const fromTok = state.lastQuote ? tokenById(state.chainKey, state.lastQuote.fromId) : null;
  const out = planOut();
  if ($("receiveOut")) $("receiveOut").textContent = out != null && toTok ? formatAmount(out, toTok.decimals, 6) : "0.0";
  if ($("rateLine")) $("rateLine").textContent = out != null && fromTok && toTok ? formatRate(fromTok, toTok, state.lastQuote.amountIn, out, state.rateInvert) : "";
  const gu = planGasUnits();
  if ($("gasLine")) $("gasLine").textContent = gu != null ? t("gasEst") + ": " + formatGas(chain(), gu) : "";
  if (!out || !toTok) { $("minLine").textContent = ""; return; }
  const min = applySlippageBps(out, state.slippagePct);
  $("minLine").textContent = t("minReceived", state.slippagePct, formatAmount(min, toTok.decimals, 6), toTok.symbol);
  const isSplit = state.selectedPlan.type === "split";
  $("swapBtn").textContent = isSplit ? t("swapBtnSplit") : t("swapBtnSingle");
  const sn = $("splitNote");
  if (isSplit) sn.textContent = splitExecutable(chain()) ? t("splitExecutable") : (chain().isTestnet ? t("splitQuoteOnlyTestnet") : t("splitQuoteOnly"));
  else sn.textContent = "";
  $("swapBtn").disabled = !state.account || (isSplit && !splitExecutable(chain()));
}
function updateMinLine() { updateReceive(); }
async function onQuote() {
  const c = chain(); const f = currentFrom(), tk = currentTo();
  if (!f || !tk) return;
  let amountIn;
  try { amountIn = parseAmount($("amountIn").value, f.decimals); } catch (e) { setStatus(e.message, true); return; }
  const btn = $("quoteBtn"); btn.disabled = true;
  setStatus(t("statusComparing"));
  try {
    const q = await fetchQuotesForTokens(c, f, tk, amountIn);
    state.routes = q.routes; state.directOut = q.directOut; state.splitEstimate = q.splitEstimate;
    state.splitEval = q.splitEval; state.gasPrice = q.gasPrice;
    state.selectedIdx = 0;
    state.selectedPlan = q.splitEval && q.splitEval.plan ? { type: "split" } : { type: "single", idx: 0 };
    state.lastQuote = { fromId: f.id, toId: tk.id, amountIn, amountText: $("amountIn").value };
    renderRoutes();
    const splitWin = !!(q.splitEval && q.splitEval.plan);
    const bestLabel = splitWin
      ? q.splitEval.plan.legs.map((l) => l.pct + "%: " + pathLabel(state.chainKey, l.route.path)).join(" + ")
      : pathLabel(state.chainKey, q.routes[0].path);
    setStatus(t("statusQuoted", q.routes.length, bestLabel, q.directOut == null, splitWin));
  } catch (e) {
    clearRoutes();
    setStatus(t("statusQuoteFail") + e.message, true);
  } finally { btn.disabled = false; }
}

/* ---------- MetaMask ---------- */
function eth() { return (typeof window !== "undefined" && window.ethereum) ? window.ethereum : null; }
async function ensureChain(chainObj) {
  const e = eth(); if (!e) throw new Error(t("errNoMetaMask"));
  const c = chainObj || chain();
  const hexId = "0x" + c.chainId.toString(16);
  const cur = await e.request({ method: "eth_chainId" });
  if (cur && cur.toLowerCase() === hexId) return;
  try {
    await e.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
  } catch (err) {
    if (err && err.code === 4902) {
      const params = { chainId: hexId, chainName: c.label + " (" + c.nativeName + ")", nativeCurrency: { name: c.nativeSymbol, symbol: c.nativeSymbol, decimals: 18 }, rpcUrls: c.rpcs };
      if (c.explorer) params.blockExplorerUrls = [c.explorer];
      await e.request({ method: "wallet_addEthereumChain", params: [params] });
    } else throw err;
  }
}
function shortAddr(a) { return a.slice(0, 6) + "…" + a.slice(-4); }
async function onConnect() {
  const e = eth();
  if (!e) { setStatus(t("errNoMetaMask"), true); return; }
  try {
    const accts = await e.request({ method: "eth_requestAccounts" });
    if (!accts || !accts.length) throw new Error(t("errNoAccount"));
    state.account = accts[0].toLowerCase();
    await ensureChain();
    $("accountLine").textContent = t("accountLine", shortAddr(state.account), chain().label);
    await refreshBalances();
    if (state.mode === "cross") refreshXBalance();
    updateReceive();
    setStatus(t("statusConnected"));
  } catch (err) { setStatus(t("statusConnectFail") + friendlyErr(err), true); }
}
function friendlyErr(err) {
  if (!err) return t("errUnknown");
  if (err.code === 4001) return t("errCancelled");
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
function txLinkHtml(hash, labelKey) {
  const c = chain();
  const short = hash.slice(0, 10) + "…" + hash.slice(-6);
  if (c.explorer) return esc(t(labelKey)) + '<a href="' + esc(c.explorer + "/tx/" + hash) + '" target="_blank" rel="noopener">' + esc(short) + "</a>" + esc(t("txExplorerSuffix"));
  return esc(t(labelKey)) + esc(hash);
}
async function ensureAllowance(spender, token, amountIn, chainObj) {
  const c = chainObj || chain();
  setStatus(t("statusCheckingAllowance"));
  const allowHex = await rpcOne(c, token.address, SEL.allowance + encAddr(state.account) + encAddr(spender));
  const allowance = decUint(allowHex) || 0n;
  if (allowance >= amountIn) return;
  setStatus(t("statusApprovePrompt"));
  const atx = buildApproveTx(token.address, spender, amountIn);
  const ah = await sendTx(atx, "0x0");
  setStatus(t("statusApproveSent") + ah);
  const rc = await waitReceipt(ah);
  if (rc && rc.status === "0x0") throw new Error(t("statusApproveFail"));
}
async function onSwap() {
  const c = chain(); const f = currentFrom(), tk = currentTo();
  if (!state.account) { setStatus(t("statusNeedConnect"), true); return; }
  if (!state.lastQuote) { setStatus(t("statusNeedQuote"), true); return; }
  if (state.lastQuote.fromId !== f.id || state.lastQuote.toId !== tk.id) { setStatus(t("statusTokenChanged"), true); return; }
  const isSplit = state.selectedPlan.type === "split";
  const btn = $("swapBtn"); btn.disabled = true;
  try {
    await ensureChain();
    if (isSplit) {
      if (!splitExecutable(c)) { setStatus(c.isTestnet ? t("splitQuoteOnlyTestnet") : t("splitQuoteOnly"), true); return; }
      const plan = state.splitEval && state.splitEval.plan;
      if (!plan) { setStatus(t("statusNeedQuote"), true); return; }
      if (!f.isNative) await ensureAllowance(c.aggregator, f, state.lastQuote.amountIn);
      const tx = buildSplitTx(c, f, tk, plan, state.account, state.slippagePct);
      setStatus(t("statusSplitConfirm"));
      const hash = await sendTx(tx, "0x" + tx.value.toString(16));
      $("txResult").innerHTML = txLinkHtml(hash, "txSentSplitLabel");
      setStatus(t("statusSent"));
      waitReceipt(hash).then((rc) => {
        if (rc) setStatus(rc.status === "0x1" ? t("statusSwapDone") : t("statusSwapFailedTx"), rc.status !== "0x1");
        refreshBalances();
      });
      return;
    }
    const r = selectedRoute();
    if (!r) { setStatus(t("statusNeedQuote"), true); return; }
    if (!f.isNative) await ensureAllowance(c.router, f, r.amountIn);
    const tx = buildSwapTx(c, f, tk, r, state.account, state.slippagePct);
    setStatus(t("statusSwapConfirm", pathLabel(state.chainKey, r.path)));
    const hash = await sendTx(tx, "0x" + tx.value.toString(16));
    $("txResult").innerHTML = txLinkHtml(hash, "txSentLabel");
    setStatus(t("statusSent"));
    waitReceipt(hash).then((rc) => {
      if (rc) setStatus(rc.status === "0x1" ? t("statusSwapDone") : t("statusSwapFailedTx"), rc.status !== "0x1");
      refreshBalances();
    });
  } catch (err) {
    setStatus(t("statusSwapFail") + friendlyErr(err), true);
  } finally { btn.disabled = false; updateReceive(); }
}

/* ================= v3 cross-chain UI ================= */
function xDstKey() { return state.xSrc === "ql1" ? "infinite" : "ql1"; }
function setXStatus(msg, isErr) { const el = $("xStatus"); if (el) { el.textContent = msg || ""; el.style.color = isErr ? "#ff9d9d" : ""; } }
function setMode(mode) {
  if (mode === "cross" && state.chainKey === "testnet") {
    state.mode = "same";
    if ($("modeNote")) $("modeNote").textContent = LANG === "en" ? "Cross-chain is mainnet-only (no QL1 testnet bridge is known)." : "クロスチェーンは本番チェーン同士だけです（QL1のテストネットブリッジは確認できていません）。";
    mode = "same";
  } else state.mode = mode;
  const cross = state.mode === "cross";
  if ($("swapPanel")) $("swapPanel").style.display = cross ? "none" : "";
  if ($("caPanel")) $("caPanel").style.display = cross ? "none" : "";
  if ($("crossPanel")) $("crossPanel").style.display = cross ? "" : "none";
  if ($("modeSame")) $("modeSame").classList.toggle("active", !cross);
  if ($("modeCross")) $("modeCross").classList.toggle("active", cross);
  if (cross) { setXSrc(state.xSrc); renderXFlow(); }
}
function setXSrc(srcKey) {
  state.xSrc = srcKey;
  if ($("xSrcInf")) $("xSrcInf").classList.toggle("active", srcKey === "infinite");
  if ($("xSrcQl1")) $("xSrcQl1").classList.toggle("active", srcKey === "ql1");
  if ($("xDstLabel")) $("xDstLabel").textContent = CHAINS[xDstKey()].label;
  fillXSelects();
  state.xCandidates = []; state.xQuote = null; state.xBenchmark = null; state.xSplit = null;
  if ($("xCandidates")) $("xCandidates").innerHTML = "";
  setChain(srcKey);
  refreshXBalance();
}
function fillXSelects() {
  const src = CHAINS[state.xSrc], dst = CHAINS[xDstKey()];
  const mk = (sel, toks, keep) => {
    if (!sel) return;
    const cur = keep || sel.value;
    sel.innerHTML = toks.map((tk) => '<option value="' + esc(tk.id) + '">' + esc(tk.symbol) + (tk.name ? " — " + esc(tk.name) : "") + "</option>").join("");
    if (toks.some((tk) => tk.id === cur)) sel.value = cur;
  };
  // On QL1 the pure-native QOM entry stays selectable as a source (it swaps via WQOM),
  // but the bridge itself always pulls the WQOM form (see the QOM wrap rule in quoteCrossPlan).
  mk($("xFromToken"), allTokens(state.xSrc), state.xSrc === "ql1" ? "qswap" : "fish");
  mk($("xToToken"), allTokens(xDstKey()), xDstKey() === "infinite" ? "fish" : "qswap");
  if (!$("xFromToken").value) $("xFromToken").value = allTokens(state.xSrc)[0].id;
  if (!$("xToToken").value) $("xToToken").value = allTokens(xDstKey())[0].id;
}
function xFrom() { return tokenById(state.xSrc, $("xFromToken").value); }
function xTo() { return tokenById(xDstKey(), $("xToToken").value); }
async function refreshXBalance() {
  const el = $("xFromBalance"); if (!el) return;
  const f = xFrom(); if (!f) return;
  if (!state.account) { el.textContent = t("balanceLabel") + t("balanceConnectFirst"); return; }
  try {
    const c = CHAINS[state.xSrc];
    const raw = f.isNative ? BigInt(await rpcMethod(c, "eth_getBalance", [state.account, "latest"])) : await readTokenBalance(c, f.address, state.account);
    el.textContent = t("balanceLabel") + formatAmount(raw, f.decimals, 6) + " " + f.symbol;
  } catch (e) { /* optional */ }
}
async function onXQuote() {
  const src = CHAINS[state.xSrc], dst = CHAINS[xDstKey()];
  const f = xFrom(), tk = xTo();
  if (!f || !tk) return;
  let amountIn;
  try { amountIn = parseAmount($("xAmount").value, f.decimals); if (amountIn <= 0n) throw new Error(t("errAmountPositive")); } catch (e) { setXStatus(e.message, true); return; }
  const btn = $("xQuoteBtn"); btn.disabled = true;
  setXStatus(t("xComparing"));
  if ($("xCandidates")) $("xCandidates").innerHTML = "";
  try {
    const cands = await quoteCrossPlan(state.xSrc, f, xDstKey(), tk, amountIn);
    state.xCandidates = cands;
    state.xBenchmark = cands.benchmark || null;
    state.xQuote = { fromId: f.id, toId: tk.id, amountIn: amountIn.toString() };
    state.xSplit = null;
    try { state.xSplit = await evaluateCrossSplit(state.xSrc, xDstKey(), amountIn, cands); } catch (e) { state.xSplit = null; /* splits are optional */ }
    renderXCandidates();
    const best = cands.find((c) => c.enabled);
    if (best) {
      let msg = t("xQuoted", cands.filter((c) => c.enabled).length, best.pair.sym, formatAmount(best.finalOut, tk.decimals, 6), tk.symbol);
      if (state.xSplit && state.xSplit.plan) msg += t("xSplitWinNote");
      setXStatus(msg);
    }
    else setXStatus(t("xNoCandidate"), true);
  } catch (e) { setXStatus(t("xQuoteFail") + e.message, true); }
  finally { btn.disabled = false; }
}
/* v5: full-route path as one chain of nowrap token spans, bridge in the middle.
   例: USDT → 42 → FISH → QOM（42 Chain）⇢ ブリッジ ⇢ qCAW → QOM（QL1） */
function tokSpan(sym) { return '<span class="tok">' + esc(sym) + "</span>"; }
function fullPathHtml(c, fromTok, toTok) {
  const srcLabel = CHAINS[state.xSrc].label, dstLabel = CHAINS[xDstKey()].label;
  const arrow = ' <span class="path-arrow">→</span> ';
  let leg1;
  if (c.leg1Path) {
    // leg1 path symbols; the last one is the bridge token on the source chain
    leg1 = c.leg1Path.map((a, i) => {
      const s = symbolFor(state.xSrc, a);
      return tokSpan(i === c.leg1Path.length - 1 ? s + "（" + srcLabel + "）" : s);
    }).join(arrow);
  } else {
    leg1 = tokSpan(fromTok.symbol + "（" + srcLabel + "）");
  }
  let leg2;
  if (c.leg2Path) {
    leg2 = c.leg2Path.map((a, i) => {
      const s = symbolFor(xDstKey(), a);
      return tokSpan(i === c.leg2Path.length - 1 ? s + "（" + dstLabel + "）" : s);
    }).join(arrow);
  } else {
    leg2 = tokSpan(toTok.symbol + "（" + dstLabel + "）");
  }
  return leg1 + ' <span class="tok bridge-mark">⇢ ' + esc(t("xBridgeMark")) + " ⇢</span> " + leg2;
}
function renderXCandidates() {
  const list = $("xCandidates"); if (!list) return;
  const dst = CHAINS[xDstKey()];
  const toTok = state.xQuote ? tokenById(xDstKey(), state.xQuote.toId) : null;
  const fromTok = state.xQuote ? tokenById(state.xSrc, state.xQuote.fromId) : null;
  if (!toTok || !fromTok) { list.innerHTML = ""; return; }
  /* v6: split plan card (only when a split actually beats the best single
     full route; when splits were evaluated but lost, a small honest note). */
  let splitHtml = "";
  const xs = state.xSplit;
  if (xs && xs.plan) {
    const plan = xs.plan;
    const diff = xs.bestSingle && xs.bestSingle.finalOut > 0n ? (Number(plan.totalOut - xs.bestSingle.finalOut) / Number(xs.bestSingle.finalOut)) * 100 : 0;
    const partsHtml = plan.parts.map((p) =>
      '<span class="split-leg"><span class="split-leg-head"><span class="pct-chip">' + p.pct + '%</span>' +
      '<span class="split-path">' + fullPathHtml(p.cand, fromTok, toTok) + '</span>' +
      '<span class="split-leg-out">' + formatAmount(p.finalOut, toTok.decimals, 6) + " " + esc(toTok.symbol) + '</span></span>' +
      '<span class="split-bar"><span class="split-bar-fill" style="width:' + p.pct + '%"></span></span></span>'
    ).join("");
    const feeLine = state.xSrc === "infinite"
      ? '<span class="r-line">' + esc(t("xSplitFeeTotalInf", formatAmount(plan.parts.reduce((s, p) => s + (p.cand.nativeFee || 0n), 0n), 18, 4), plan.parts.length)) + "</span>"
      : '<span class="r-line">' + esc(t("xSplitFeeQl1")) + "</span>";
    splitHtml = '<div class="route-card split-card">' +
      '<span class="r-head"><span class="r-rank">' + esc(t("planSplitTitle")) + '</span><span class="badge best">' + esc(t("badgeRecommended")) + '</span>' +
      '<span class="r-out">' + formatAmount(plan.totalOut, toTok.decimals, 6) + " " + esc(toTok.symbol) + '</span></span>' +
      '<span class="r-line">' + esc(t("splitVsSingle", diff.toFixed(2))) + "</span>" +
      partsHtml + feeLine +
      '<span class="r-line">' + esc(t("xSplitPartsNote", plan.parts.length)) + "</span>" +
      '<button type="button" class="x-start x-split-start">' + esc(t("xSplitStartBtn")) + "</button></div>";
  }
  const splitLostNote = xs && !xs.plan && xs.best
    ? '<p class="count">' + esc(t("splitLost", formatAmount(xs.best.totalOut, toTok.decimals, 6), toTok.symbol)) + "</p>"
    : "";
  list.innerHTML = splitHtml + state.xCandidates.map((c, i) => {
    if (!c.enabled) {
      return '<div class="route-card" style="opacity:.55"><span class="r-head"><span class="r-rank">' + esc(t("xVia")) + " " + esc(c.pair.sym) + '</span></span><span class="r-line">' + esc(c.reason || "") + "</span></div>";
    }
    const s1 = c.swap1Route ? pathLabel(state.xSrc, c.swap1Route.path) + " → " + formatAmount(c.swap1Out, c.tSrc.decimals, 6) + " " + c.tSrc.symbol + (c.swap1Route.priceImpactPct != null ? " (" + t("routeImpact", c.swap1Route.priceImpactPct.toFixed(2)) + ")" : "") : t("xDirectBridge") + ": " + formatAmount(c.swap1Out, c.tSrc.decimals, 6) + " " + c.tSrc.symbol;
    const fee = state.xSrc === "infinite" ? t("xBridgeFeeZero") + " / " + t("xNativeFeeInf", formatAmount(c.nativeFee, 18, 4)) : t("xBridgeFeeZero") + " / " + t("xNativeFeeQl1");
    const s2 = c.swap2Route ? pathLabel(xDstKey(), c.swap2Route.path) + " → " + formatAmount(c.finalOut, toTok.decimals, 6) + " " + toTok.symbol + (c.swap2Route.priceImpactPct != null ? " (" + t("routeImpact", c.swap2Route.priceImpactPct.toFixed(2)) + ")" : "") : formatAmount(c.finalOut, toTok.decimals, 6) + " " + toTok.symbol;
    const hops = (c.swap1Route ? c.swap1Route.hops : 0) + (c.swap2Route ? c.swap2Route.hops : 0);
    const bench = state.xBenchmark;
    let benchHtml = "";
    if (bench) {
      if (c.isBenchmark) {
        benchHtml = '<span class="r-line">' + esc(bench.kind === "direct" ? t("benchLabelDirect", bench.sym) : t("benchLabel", bench.sym)) + "</span>";
      } else if (c.vsBenchPct != null) {
        const diffAbs = c.vsBenchDiff < 0n ? -c.vsBenchDiff : c.vsBenchDiff;
        benchHtml = '<span class="r-line">' + esc(t("vsBench", c.vsBenchPct.toFixed(2), formatAmount(diffAbs, toTok.decimals, 6), toTok.symbol)) + "</span>";
      }
    }
    const gapBadge = i === 0 && c.vsBenchPct != null && c.vsBenchPct > 0.5 ? '<span class="badge gap">' + esc(t("gapBadge", c.vsBenchPct.toFixed(2))) + "</span>" : "";
    return '<div class="route-card">' +
      '<span class="r-head"><span class="r-rank">' + esc(t("xVia")) + " " + esc(c.pair.sym) + "</span>" + (i === 0 ? '<span class="badge best">' + esc(t("routeBest")) + "</span>" : "") + gapBadge +
      '<span class="r-out">' + formatAmount(c.finalOut, toTok.decimals, 6) + " " + esc(toTok.symbol) + "</span></span>" +
      '<span class="r-line fullpath">' + fullPathHtml(c, fromTok, toTok) + "</span>" +
      '<span class="r-line">' + esc(t("xSwap1")) + ": " + esc(s1) + "</span>" +
      '<span class="r-line">' + esc(t("xBridge")) + " (" + esc(CHAINS[state.xSrc].label) + " → " + esc(dst.label) + "): " + esc(fee) + "</span>" +
      '<span class="r-line">' + esc(t("xSwap2")) + ": " + esc(s2) + "</span>" +
      '<span class="r-line">' + esc(t("xFinalEst")) + ": " + formatAmount(c.finalOut, toTok.decimals, 6) + " " + esc(toTok.symbol) + " ／ " + esc(t("routeHops", hops)) + "</span>" +
      benchHtml +
      '<button type="button" class="x-start" data-idx="' + i + '">' + esc(t("xStartBtn")) + "</button></div>";
  }).join("") + splitLostNote + '<p class="count">' + esc(t("xEstNote")) + "</p>";
  list.querySelectorAll(".x-start").forEach((el) => { if (el.classList && el.classList.contains("x-split-start")) return; el.addEventListener("click", () => startXFlow(state.xCandidates[Number(el.dataset.idx)])); });
  list.querySelectorAll(".x-split-start").forEach((el) => el.addEventListener("click", () => startXSplitFlow()));
}
/* routeOrSym: a full-route entry from state.xCandidates (v5: the CHOSEN route's
   paths are stored and executed exactly), or a bridge-token symbol string
   (v4 callers: the best full route for that intermediate is used). */
async function startXFlow(routeOrSym, opts) {
  if (!state.account) { setXStatus(t("xNeedConnect"), true); return; }
  const cand = typeof routeOrSym === "string"
    ? state.xCandidates.find((c) => c.enabled && c.pair.sym === routeOrSym)
    : routeOrSym;
  if (!cand || !cand.enabled || !state.xQuote) return;
  const sym = cand.pair.sym;
  const src = CHAINS[state.xSrc], dst = CHAINS[xDstKey()];
  const fromTok = tokenById(state.xSrc, state.xQuote.fromId);
  let baselineT = 0n;
  try { baselineT = cand.swap1Route ? await readTokenBalance(src, cand.tSrc.address, state.account) : 0n; } catch (e) { /* optional */ }
  state.xflow = {
    v: 1, pathsV5: true, step: cand.swap1Route ? 1 : 2,
    srcKey: state.xSrc, dstKey: xDstKey(), fromId: state.xQuote.fromId, toId: state.xQuote.toId,
    amountText: $("xAmount").value, amountIn: state.xQuote.amountIn,
    sym, tSrcId: cand.tSrc.id, tDstId: cand.tDst.id,
    swap1Path: cand.swap1Route ? cand.swap1Route.path.slice() : null, swap1Out: cand.swap1Out.toString(),
    swap2Path: cand.swap2Route ? cand.swap2Route.path.slice() : null, swap2Out: cand.finalOut.toString(),
    bridgeOut: cand.bridgeOut.toString(), finalEst: cand.finalOut.toString(), nativeFee: cand.nativeFee.toString(),
    baselineT: baselineT.toString(), baselineDst: null, swap1Tx: null, bridgeTx: null, swap2Tx: null, messageId: null, bridgeAt: null, arrived: null,
    arbReturn: !!(opts && opts.arbReturn),
    createdAt: Date.now(),
  };
  saveXFlow();
  renderXFlow();
  setXStatus("");
}
/* ---------- v6: guided SPLIT flow (grouped phases, per-part execution) ----------
   part.step: 0 = 交換1待ち, 1 = ブリッジ待ち, 2 = 到着待ち, 3 = 交換2待ち,
   4 = 完了, "error" = そのパートは理由を表示して停止 (他パートは続行)。
   各パートは選ばれた全体ルートの保存パスをそのまま使う。パスが見積もり
   できなくなっていたら、そのパートだけ止めて理由を表示する (v5 の原則)。 */
async function startXSplitFlow() {
  if (!state.account) { setXStatus(t("xNeedConnect"), true); return; }
  const xs = state.xSplit;
  if (!xs || !xs.plan || !state.xQuote) return;
  const plan = xs.plan;
  const parts = plan.parts.map((p, i) => ({
    idx: i, pct: p.pct, sym: p.cand.pair.sym, tSrcId: p.cand.tSrc.id, tDstId: p.cand.tDst.id,
    amountIn: p.amountIn.toString(),
    leg1Path: p.cand.leg1Path ? p.cand.leg1Path.slice() : null,
    leg2Path: p.cand.leg2Path ? p.cand.leg2Path.slice() : null,
    estLeg1Out: p.leg1Out.toString(), estFinalOut: p.finalOut.toString(),
    nativeFee: (p.cand.nativeFee || 0n).toString(),
    step: p.cand.leg1Path ? 0 : 1,
    received: p.cand.leg1Path ? null : p.amountIn.toString(),
    baselineT: null, swap1Tx: null, bridgeTx: null, bridgeAt: null, messageId: null,
    bridgedAmount: null, arrivedAmt: null, arrivedFlag: false, swap2Tx: null,
    error: null, errorPhase: null,
  }));
  state.xflow = {
    v: 2, kind: "split",
    srcKey: state.xSrc, dstKey: xDstKey(), fromId: state.xQuote.fromId, toId: state.xQuote.toId,
    amountText: $("xAmount").value, amountIn: state.xQuote.amountIn,
    totalEst: plan.totalOut.toString(), baselineDstBySym: {}, parts,
    createdAt: Date.now(),
  };
  saveXFlow();
  renderXFlow();
  setXStatus("");
}
function xSplitPartTokens(f, p) {
  return {
    tSrc: tokenById(f.srcKey, p.tSrcId), tDst: tokenById(f.dstKey, p.tDstId),
    pair: bridgePairBySym(p.sym),
  };
}
function renderXSplitFlow() {
  const area = $("xFlow"); if (!area) return;
  const f = state.xflow;
  const fromTok = tokenById(f.srcKey, f.fromId), toTok = tokenById(f.dstKey, f.toId);
  const src = CHAINS[f.srcKey], dst = CHAINS[f.dstKey];
  if (!fromTok || !toTok) { area.innerHTML = ""; return; }
  const phase = crossSplitPhase(f);
  const n = f.parts.length;
  const badge = (p, ph) => {
    if (p.step === "error") return p.errorPhase === ph ? t("xsStepFailBadge") : t("xStepWait");
    const doneAt = [1, 2, 3, 4][ph - 1];
    if (typeof p.step === "number" && p.step >= doneAt) return t("xStepDone");
    if ((ph === 1 && p.step === 0) || (ph === 2 && p.step === 1) || (ph === 3 && p.step === 2) || (ph === 4 && p.step === 3)) return t("xStepNow");
    return t("xStepWait");
  };
  const head = (p) => '<div class="xstep-head"><b>' + esc(t("xsPartHead", p.idx, n, p.pct, p.sym)) + "</b></div>";
  let html = '<div class="xflow">';
  if (phase !== "done") html += '<p class="count">' + esc(t("xsResumeNote")) + " " + esc(src.label) + " → " + esc(dst.label) + " / " + esc(fromTok.symbol) + " → " + esc(toTok.symbol) + " / " + esc(t("xFinalEst")) + ": " + formatAmount(BigInt(f.totalEst), toTok.decimals, 6) + " " + esc(toTok.symbol) + "</p>";
  html += '<p class="count">' + esc(t("xSplitPartsNote", n)) + "</p>";
  // ---- phase 1: swap 1 per part ----
  html += '<div class="xstep' + (phase === 1 ? " current" : "") + '"><div class="xstep-head"><b>' + esc(t("xsStep1Title")) + "</b></div>";
  for (const p of f.parts) {
    const { tSrc } = xSplitPartTokens(f, p);
    if (!tSrc) continue;
    html += '<div class="xpart">' + head(p) +
      '<p class="count">' + esc(p.leg1Path
        ? t("xStep1Desc", formatAmount(BigInt(p.amountIn), fromTok.decimals, 6) + " " + fromTok.symbol, tSrc.symbol, pathLabel(f.srcKey, p.leg1Path))
        : t("xStep1Skip")) + "</p>" +
      '<p class="count">' + esc(badge(p, 1)) + "</p>" +
      (p.received != null ? '<p class="count">' + esc(t("xsReceived", formatAmount(BigInt(p.received), tSrc.decimals, 6), tSrc.symbol)) + "</p>" : "") +
      (p.step === 0 ? '<button type="button" data-split-act="s1" data-idx="' + p.idx + '">' + esc(t("xStep1Btn")) + "</button>" : "") +
      (p.swap1Tx ? '<p class="count">' + esc(shortHash(p.swap1Tx)) + "</p>" : "") +
      (p.step === "error" && p.errorPhase === 1 ? '<p class="count" style="color:#ff9d9d">' + esc(p.error || "") + "</p>" : "") + "</div>";
  }
  html += "</div>";
  // ---- phase 2: bridge per part ----
  html += '<div class="xstep' + (phase === 2 ? " current" : "") + '"><div class="xstep-head"><b>' + esc(t("xsStep2Title")) + "</b></div>";
  for (const p of f.parts) {
    const { tSrc } = xSplitPartTokens(f, p);
    if (!tSrc) continue;
    const amt = p.received != null ? formatAmount(BigInt(p.received), tSrc.decimals, 6) + " " + tSrc.symbol : "—";
    html += '<div class="xpart">' + head(p) +
      '<p class="count">' + esc(f.srcKey === "infinite" ? t("xStep2DescInf", amt, tSrc.symbol) : t("xStep2DescQl1", amt, tSrc.symbol)) + "</p>" +
      '<p class="count">' + esc(badge(p, 2)) + "</p>" +
      (p.step === 1 ? '<button type="button" data-split-act="s2" data-idx="' + p.idx + '">' + esc(t("xStep2Btn")) + "</button>" : "") +
      (p.bridgeTx ? '<p class="count">' + esc(t("xBridgeTxLabel")) + esc(shortHash(p.bridgeTx)) + "</p>" : "") +
      (p.step === "error" && p.errorPhase === 2 ? '<p class="count" style="color:#ff9d9d">' + esc(p.error || "") + "</p>" : "") + "</div>";
  }
  html += "</div>";
  // ---- phase 3: arrival watch (per intermediate token) ----
  html += '<div class="xstep' + (phase === 3 ? " current" : "") + '"><div class="xstep-head"><b>' + esc(t("xStep3Title")) + "</b></div>";
  for (const p of f.parts) {
    const { tSrc } = xSplitPartTokens(f, p);
    if (!tSrc) continue;
    let line;
    if (p.arrivedAmt != null && BigInt(p.arrivedAmt) > 0n) line = t("xStepArrived", formatAmount(BigInt(p.arrivedAmt), tSrc.decimals, 6), tSrc.symbol);
    else if (p.bridgedAmount != null) line = t("xStep3Desc", tSrc.symbol, dst.label);
    else line = t("xStepWait");
    html += '<div class="xpart">' + head(p) + '<p class="count">' + esc(badge(p, 3)) + "</p>" +
      '<p class="count">' + esc(line) + "</p></div>";
  }
  if (f.parts.some((p) => p.step === 2)) {
    html += '<p class="count" id="xElapsed"></p><button type="button" id="xSplitCheckBtn">' + esc(t("xStep3CheckBtn")) + "</button>";
  }
  html += "</div>";
  // ---- phase 4: swap 2 per part ----
  html += '<div class="xstep' + (phase === 4 ? " current" : "") + '"><div class="xstep-head"><b>' + esc(t("xsStep4Title")) + "</b></div>";
  for (const p of f.parts) {
    const { tSrc } = xSplitPartTokens(f, p);
    if (!tSrc) continue;
    const desc = p.leg2Path
      ? t("xStep4DescV5", tSrc.symbol, toTok.symbol, pathLabel(f.dstKey, p.leg2Path))
      : t("xStep4Identity");
    html += '<div class="xpart">' + head(p) +
      '<p class="count">' + esc(desc) + "</p>" +
      '<p class="count">' + esc(badge(p, 4)) + "</p>" +
      (!p.leg2Path && p.step === 4 ? '<p class="count">' + esc(t("xsAutoDone")) + "</p>" : "") +
      (p.step === 3 && p.leg2Path ? '<button type="button" data-split-act="s4" data-idx="' + p.idx + '">' + esc(t("xStep4BtnExec")) + "</button>" : "") +
      (p.swap2Tx ? '<p class="count">' + esc(shortHash(p.swap2Tx)) + "</p>" : "") +
      (p.step === "error" && p.errorPhase === 4 ? '<p class="count" style="color:#ff9d9d">' + esc(p.error || "") + "</p>" : "") + "</div>";
  }
  html += "</div>";
  if (phase === "done") {
    const okCount = f.parts.filter((p) => p.step === 4).length;
    html += '<p class="count">' + esc(t("xsDone")) + "</p>";
    if (okCount < n) html += '<p class="count">' + esc(t("xsDonePartial", okCount, n)) + "</p>";
  }
  html += "</div>";
  area.innerHTML = html;
  area.querySelectorAll("[data-split-act]").forEach((el) => {
    const idx = Number(el.dataset.idx);
    el.addEventListener("click", () => {
      if (el.dataset.splitAct === "s1") doXSplitStep1(idx);
      else if (el.dataset.splitAct === "s2") doXSplitStep2(idx);
      else if (el.dataset.splitAct === "s4") doXSplitStep4(idx);
    });
  });
  const bc = $("xSplitCheckBtn"); if (bc) bc.addEventListener("click", () => checkSplitArrival(true));
  if (f.parts.some((p) => p.step === 2)) {
    const earliest = Math.min(...f.parts.filter((p) => p.step === 2 && p.bridgeAt).map((p) => p.bridgeAt));
    const upd = () => { const el = $("xElapsed"); if (el && isFinite(earliest)) el.textContent = t("xStep3Elapsed", Math.max(0, Math.floor((Date.now() - earliest) / 1000))); };
    upd();
    state.xPollTimer = setInterval(() => { upd(); checkSplitArrival(false); }, 15000);
    checkSplitArrival(false);
  }
}
async function doXSplitStep1(idx) {
  const f = state.xflow; if (!f || f.kind !== "split") return;
  const p = f.parts[idx]; if (!p || p.step !== 0) return;
  const src = CHAINS[f.srcKey];
  const fromTok = tokenById(f.srcKey, f.fromId);
  const { tSrc } = xSplitPartTokens(f, p);
  if (!fromTok || !tSrc) return;
  try {
    if (!state.account) throw new Error(t("xNeedConnect"));
    await ensureChain(src);
    const amountIn = BigInt(p.amountIn);
    p.baselineT = (await readTokenBalance(src, tSrc.address, state.account)).toString();
    const fresh = await requotePathExact(src, amountIn, p.leg1Path);
    if (fresh == null) {
      p.step = "error"; p.error = t("routeGone"); p.errorPhase = 1;
      saveXFlow(); renderXFlow(); return;
    }
    const route = { path: p.leg1Path, amountOut: fresh, amountIn, hops: p.leg1Path.length - 1 };
    if (!fromTok.isNative) await ensureAllowance(src.router, fromTok, amountIn, src);
    const tx = buildSwapTx(src, fromTok, tSrc, route, state.account, state.slippagePct);
    setXStatus(t("xWorking"));
    const hash = await sendTx(tx, "0x" + tx.value.toString(16));
    p.swap1Tx = hash; saveXFlow();
    const rc = await waitReceipt(hash);
    if (rc && rc.status === "0x0") throw new Error(t("statusSwapFailedTx"));
    let received = fresh;
    try {
      const after = await readTokenBalance(src, tSrc.address, state.account);
      const delta = after - BigInt(p.baselineT || "0");
      if (delta > 0n) received = delta;
    } catch (e) { /* keep the fresh quote */ }
    p.received = received.toString(); p.step = 1; saveXFlow(); renderXFlow();
  } catch (e) { setXStatus(t("xStepFail") + friendlyErr(e), true); }
}
async function doXSplitStep2(idx) {
  const f = state.xflow; if (!f || f.kind !== "split") return;
  const p = f.parts[idx]; if (!p || p.step !== 1) return;
  const src = CHAINS[f.srcKey], dst = CHAINS[f.dstKey];
  const { tSrc, tDst, pair } = xSplitPartTokens(f, p);
  if (!tSrc || !tDst || !pair) return;
  try {
    if (!state.account) throw new Error(t("xNeedConnect"));
    await ensureChain(src);
    const amount = BigInt(p.received);
    if (!f.baselineDstBySym) f.baselineDstBySym = {};
    if (f.baselineDstBySym[p.sym] == null) {
      f.baselineDstBySym[p.sym] = (await readTokenBalance(dst, tDst.address, state.account)).toString();
    }
    let value = 0n;
    if (f.srcKey === "infinite") {
      const q = await fetchBridgeNativeQuote(pair);
      if (!q) throw new Error(t("errUnknown"));
      value = q.totalNative; p.nativeFee = value.toString();
      await ensureAllowance(pair.br, tSrc, amount, src);
    } else {
      await ensureAllowance(pair.ql1Router, tSrc, amount, src);
    }
    const tx = buildBridgeTx(pair, f.srcKey, state.account, amount, value);
    setXStatus(t("xWorking"));
    const hash = await sendTx(tx, "0x" + tx.value.toString(16));
    p.bridgeTx = hash; p.bridgeAt = Date.now();
    try {
      const rc = await waitReceipt(hash);
      const mid = extractMessageId(rc); if (mid) p.messageId = mid;
      if (rc && rc.status === "0x0") throw new Error(t("statusSwapFailedTx"));
    } catch (e) { if (e && e.message === t("statusSwapFailedTx")) throw e; }
    p.bridgedAmount = amount.toString(); p.step = 2; saveXFlow(); renderXFlow();
  } catch (e) { setXStatus(t("xStepFail") + friendlyErr(e), true); }
}
async function checkSplitArrival(manual) {
  const f = state.xflow; if (!f || f.kind !== "split") return false;
  if (!f.parts.some((p) => p.step === 2)) return false;
  const dst = CHAINS[f.dstKey];
  try {
    const syms = [...new Set(f.parts.filter((p) => p.step === 2).map((p) => p.sym))];
    const arrivedBySym = {};
    for (const sym of syms) {
      const anyPart = f.parts.find((p) => p.sym === sym);
      const tDst = tokenById(f.dstKey, anyPart.tDstId);
      const bal = await readTokenBalance(dst, tDst.address, state.account);
      const base = BigInt((f.baselineDstBySym || {})[sym] || "0");
      arrivedBySym[sym] = bal > base ? bal - base : 0n;
    }
    const before = f.parts.map((p) => String(p.step) + ":" + (p.arrivedAmt || "")).join("|");
    attributeSplitArrivals(f.parts, arrivedBySym);
    for (const p of f.parts) {
      if (p.step === 2 && p.arrivedFlag) p.step = p.leg2Path ? 3 : 4;
    }
    const after = f.parts.map((p) => String(p.step) + ":" + (p.arrivedAmt || "")).join("|");
    if (before !== after) { saveXFlow(); renderXFlow(); return true; }
    if (manual) setXStatus(t("xStep3NotYet"));
  } catch (e) { if (manual) setXStatus(t("xStepFail") + e.message, true); }
  return false;
}
async function doXSplitStep4(idx) {
  const f = state.xflow; if (!f || f.kind !== "split") return;
  const p = f.parts[idx]; if (!p || p.step !== 3 || !p.leg2Path) return;
  const dst = CHAINS[f.dstKey];
  const toTok = tokenById(f.dstKey, f.toId);
  const { tDst } = xSplitPartTokens(f, p);
  if (!toTok || !tDst) return;
  try {
    if (!state.account) throw new Error(t("xNeedConnect"));
    await ensureChain(dst);
    const amount = BigInt(p.arrivedAmt || p.bridgedAmount);
    const fresh = await requotePathExact(dst, amount, p.leg2Path);
    if (fresh == null) {
      p.step = "error"; p.error = t("routeGone"); p.errorPhase = 4;
      saveXFlow(); renderXFlow(); return;
    }
    setXStatus(t("xStep4QuoteLine", formatAmount(fresh, toTok.decimals, 6), toTok.symbol, pathLabel(f.dstKey, p.leg2Path)));
    const route = { path: p.leg2Path, amountOut: fresh, amountIn: amount, hops: p.leg2Path.length - 1 };
    if (!tDst.isNative) await ensureAllowance(dst.router, tDst, amount, dst);
    const tx = buildSwapTx(dst, tDst, toTok, route, state.account, state.slippagePct);
    setXStatus(t("xWorking"));
    const hash = await sendTx(tx, "0x" + tx.value.toString(16));
    p.swap2Tx = hash; saveXFlow();
    const rc = await waitReceipt(hash);
    if (rc && rc.status === "0x0") throw new Error(t("statusSwapFailedTx"));
    p.step = 4; saveXFlow(); renderXFlow();
    if (crossSplitPhase(f) === "done") setXStatus(t("xsDone"));
  } catch (e) { setXStatus(t("xStepFail") + friendlyErr(e), true); }
}
function xFlowTokens() {
  const f = state.xflow; if (!f) return {};
  return {
    fromTok: tokenById(f.srcKey, f.fromId), toTok: tokenById(f.dstKey, f.toId),
    tSrc: tokenById(f.srcKey, f.tSrcId), tDst: tokenById(f.dstKey, f.tDstId),
    pair: bridgePairBySym(f.sym), src: CHAINS[f.srcKey], dst: CHAINS[f.dstKey],
  };
}
function stopXPoll() { if (state.xPollTimer) { clearInterval(state.xPollTimer); state.xPollTimer = null; } }
function renderXFlow() {
  const area = $("xFlow"); if (!area) return;
  const f = state.xflow;
  stopXPoll();
  if ($("xAbandon")) $("xAbandon").style.display = f ? "" : "none";
  if (!f) { area.innerHTML = ""; return; }
  if (f.kind === "split") { renderXSplitFlow(); return; }
  const { fromTok, toTok, tSrc, pair, src, dst } = xFlowTokens();
  if (!fromTok || !toTok || !tSrc || !pair) { area.innerHTML = ""; return; }
  const st = (n) => f.step > n || f.step === "done" ? t("xStepDone") : f.step === n ? t("xStepNow") : t("xStepWait");
  const amtBridge = formatAmount(BigInt(f.bridgeOut), tSrc.decimals, 6) + " " + tSrc.symbol;
  let html = '<div class="xflow">';
  if (f.step !== "done") html += '<p class="count">' + esc(t("xResumeNote")) + " " + esc(src.label) + " → " + esc(dst.label) + " / " + esc(fromTok.symbol) + " → " + esc(toTok.symbol) + "</p>";
  // step 1
  const step1Text = f.swap1Path
    ? t("xStep1Desc", formatAmount(BigInt(f.amountIn), fromTok.decimals, 6) + " " + fromTok.symbol, tSrc.symbol, pathLabel(f.srcKey, f.swap1Path))
    : t("xStep1Skip");
  html += '<div class="xstep' + (f.step === 1 ? " current" : "") + '"><div class="xstep-head"><b>' + esc(t("xStep1Title")) + '</b><span class="badge-step">' + esc(st(1)) + '</span></div>' +
    '<p class="count">' + esc(step1Text) + "</p>" +
    (f.step === 1 ? '<button type="button" id="xStep1Btn">' + esc(t("xStep1Btn")) + "</button>" : "") + (f.swap1Tx ? '<p class="count">' + esc(shortHash(f.swap1Tx)) + "</p>" : "") + "</div>";
  // step 2
  html += '<div class="xstep' + (f.step === 2 ? " current" : "") + '"><div class="xstep-head"><b>' + esc(t("xStep2Title")) + '</b><span class="badge-step">' + esc(st(2)) + '</span></div>' +
    '<p class="count">' + esc(f.srcKey === "infinite" ? t("xStep2DescInf", amtBridge, tSrc.symbol) : t("xStep2DescQl1", amtBridge, tSrc.symbol)) + "</p>" +
    (f.step === 2 ? '<button type="button" id="xStep2Btn">' + esc(t("xStep2Btn")) + "</button>" : "") + (f.bridgeTx ? '<p class="count">' + esc(t("xBridgeTxLabel")) + esc(shortHash(f.bridgeTx)) + "</p>" : "") + "</div>";
  // step 3
  html += '<div class="xstep' + (f.step === 3 ? " current" : "") + '"><div class="xstep-head"><b>' + esc(t("xStep3Title")) + '</b><span class="badge-step">' + esc(st(3)) + '</span></div>' +
    '<p class="count">' + esc(t("xStep3Desc", tSrc.symbol, dst.label)) + "</p>" +
    (f.step === 3 ? '<p class="count" id="xElapsed"></p><button type="button" id="xCheckBtn">' + esc(t("xStep3CheckBtn")) + "</button>" : "") +
    (f.arrived ? '<p class="count">' + esc(t("xStepArrived", formatAmount(BigInt(f.arrived), tSrc.decimals, 6), tSrc.symbol)) + "</p>" : "") + "</div>";
  // step 4
  let step4Desc, step4BtnLabel;
  if (f.pathsV5) {
    step4Desc = f.swap2Path ? t("xStep4DescV5", tSrc.symbol, toTok.symbol, pathLabel(f.dstKey, f.swap2Path)) : t("xStep4Identity");
    step4BtnLabel = f.swap2Path ? t("xStep4BtnExec") : t("xStep4IdentityBtn");
  } else {
    step4Desc = t("xStep4Desc", tSrc.symbol, toTok.symbol);
    step4BtnLabel = t("xStep4Btn");
  }
  html += '<div class="xstep' + (f.step === 4 ? " current" : "") + '"><div class="xstep-head"><b>' + esc(t("xStep4Title")) + '</b><span class="badge-step">' + esc(st(4)) + '</span></div>' +
    '<p class="count">' + esc(step4Desc) + "</p>" +
    (f.pathsV5 && f.swap2Path && f.step === 4 ? '<p class="count" id="xStep4Quote"></p>' : "") +
    (f.arbReturn ? '<p class="count">' + esc(t("arbRtNote")) + "</p>" : "") +
    (f.step === 4 ? '<button type="button" id="xStep4Btn">' + esc(step4BtnLabel) + "</button>" : "") + "</div>";
  if (f.step === "done") {
    html += '<p class="count">' + esc(t("xFlowDone")) + "</p>";
    if (f.arbReturn) html += '<button type="button" id="xReturnBtn">' + esc(t("arbReturnBtn")) + "</button>";
  }
  html += "</div>";
  area.innerHTML = html;
  const b1 = $("xStep1Btn"); if (b1) b1.addEventListener("click", doXStep1);
  const b2 = $("xStep2Btn"); if (b2) b2.addEventListener("click", doXStep2);
  const b4 = $("xStep4Btn"); if (b4) b4.addEventListener("click", doXStep4);
  if (f.step === 4 && f.pathsV5 && f.swap2Path) fillStep4Quote();
  const brt = $("xReturnBtn"); if (brt) brt.addEventListener("click", startReturnFlow);
  const bc = $("xCheckBtn"); if (bc) bc.addEventListener("click", () => checkArrival(true));
  if (f.step === 3) {
    const upd = () => { const el = $("xElapsed"); if (el && f.bridgeAt) el.textContent = t("xStep3Elapsed", Math.max(0, Math.floor((Date.now() - f.bridgeAt) / 1000))); };
    upd();
    state.xPollTimer = setInterval(() => { upd(); checkArrival(false); }, 15000);
    checkArrival(false);
  }
}
function shortHash(h) { return h ? h.slice(0, 10) + "…" + h.slice(-6) : ""; }
/* v5: re-quote ONE exact stored path (never substitutes another path).
   Returns the output amount, or null when that path no longer quotes. */
async function requotePathExact(chainObj, amountIn, path) {
  const hex = await rpcOne(chainObj, chainObj.router, encodeGetAmountsOut(amountIn, path));
  const amts = decodeAmountsOut(hex);
  if (!amts || !amts.length || amts[amts.length - 1] <= 0n) return null;
  return amts[amts.length - 1];
}
/* Show the current re-quote of the stored leg-2 path inside step 4 (display only;
   execution re-quotes again at click time). */
async function fillStep4Quote() {
  const f = state.xflow; if (!f || f.step !== 4 || !f.pathsV5 || !f.swap2Path) return;
  const el = $("xStep4Quote"); if (!el) return;
  const { toTok, dst } = xFlowTokens();
  if (!toTok || !dst) return;
  try {
    const out = await requotePathExact(dst, BigInt(f.arrived || f.bridgeOut), f.swap2Path);
    const el2 = $("xStep4Quote");
    if (!el2 || !state.xflow || state.xflow.step !== 4) return;
    el2.textContent = out != null
      ? t("xStep4QuoteLine", formatAmount(out, toTok.decimals, 6), toTok.symbol, pathLabel(f.dstKey, f.swap2Path))
      : t("routeGone");
  } catch (e) { /* display only */ }
}
async function doXStep1() {
  const f = state.xflow; if (!f || f.step !== 1) return;
  const { fromTok, tSrc, src } = xFlowTokens();
  const btn = $("xStep1Btn"); if (btn) btn.disabled = true;
  try {
    if (!state.account) throw new Error(t("xNeedConnect"));
    await ensureChain(src);
    let amountOut = BigInt(f.swap1Out);
    if (f.pathsV5) {
      // re-quote the CHOSEN route's exact path for min-out; if it is gone, stop
      // with a clear error instead of silently switching to another path.
      const fresh = await requotePathExact(src, BigInt(f.amountIn), f.swap1Path);
      if (fresh == null) throw new Error(t("routeGone"));
      amountOut = fresh;
    }
    const route = { path: f.swap1Path, amountOut, amountIn: BigInt(f.amountIn), hops: f.swap1Path.length - 1 };
    if (!fromTok.isNative) await ensureAllowance(src.router, fromTok, BigInt(f.amountIn), src);
    const tx = buildSwapTx(src, fromTok, tSrc, route, state.account, state.slippagePct);
    setXStatus(t("xWorking"));
    const hash = await sendTx(tx, "0x" + tx.value.toString(16));
    f.swap1Tx = hash; saveXFlow();
    const rc = await waitReceipt(hash);
    if (rc && rc.status === "0x0") throw new Error(t("statusSwapFailedTx"));
    // actual received = balance delta of the bridge token
    try {
      const after = await readTokenBalance(src, tSrc.address, state.account);
      const delta = after - BigInt(f.baselineT || "0");
      if (delta > 0n) f.bridgeOut = delta.toString();
    } catch (e) { /* keep estimate */ }
    f.step = 2; saveXFlow(); renderXFlow();
  } catch (e) { setXStatus(t("xStepFail") + friendlyErr(e), true); if (btn) btn.disabled = false; }
}
async function doXStep2() {
  const f = state.xflow; if (!f || f.step !== 2) return;
  const { tSrc, pair, src, dst } = xFlowTokens();
  const btn = $("xStep2Btn"); if (btn) btn.disabled = true;
  try {
    if (!state.account) throw new Error(t("xNeedConnect"));
    await ensureChain(src);
    const amount = BigInt(f.bridgeOut);
    // destination baseline BEFORE sending (arrival watch compares against this)
    f.baselineDst = (await readTokenBalance(dst, tokenById(f.dstKey, f.tDstId).address, state.account)).toString();
    let value = 0n;
    if (f.srcKey === "infinite") {
      const q = await fetchBridgeNativeQuote(pair);
      if (!q) throw new Error(t("errUnknown"));
      value = q.totalNative; f.nativeFee = value.toString();
      await ensureAllowance(pair.br, tSrc, amount, src);
    } else {
      await ensureAllowance(pair.ql1Router, tSrc, amount, src);
    }
    const tx = buildBridgeTx(pair, f.srcKey, state.account, amount, value);
    setXStatus(t("xWorking"));
    const hash = await sendTx(tx, "0x" + tx.value.toString(16));
    f.bridgeTx = hash; f.bridgeAt = Date.now();
    try { const rc = await waitReceipt(hash); const mid = extractMessageId(rc); if (mid) f.messageId = mid; if (rc && rc.status === "0x0") throw new Error(t("statusSwapFailedTx")); } catch (e) { if (e && e.message === t("statusSwapFailedTx")) throw e; }
    f.step = 3; saveXFlow(); renderXFlow();
  } catch (e) { setXStatus(t("xStepFail") + friendlyErr(e), true); if (btn) btn.disabled = false; }
}
async function checkArrival(manual) {
  const f = state.xflow; if (!f || f.step !== 3) return false;
  const { tDst, dst } = xFlowTokens();
  try {
    const bal = await readTokenBalance(dst, tDst.address, state.account);
    const base = BigInt(f.baselineDst || "0");
    const delta = bal - base;
    const expect = BigInt(f.bridgeOut);
    const tol = expect / 1000n + 1n;
    if (delta >= expect - tol && delta > 0n) {
      f.arrived = delta.toString(); f.step = 4; saveXFlow(); renderXFlow();
      setXStatus(t("xStepArrived", formatAmount(delta, tDst.decimals, 6), tDst.symbol));
      return true;
    }
    if (manual) setXStatus(t("xStep3NotYet"));
  } catch (e) { if (manual) setXStatus(t("xStepFail") + e.message, true); }
  return false;
}
/* v4-era saved flows (no stored leg-2 path): hand off to the same-chain screen
   exactly as before. */
function doXStep4Legacy() {
  const f = state.xflow; if (!f || f.step !== 4) return;
  const arrived = BigInt(f.arrived || f.bridgeOut);
  const tDst = tokenById(f.dstKey, f.tDstId);
  f.step = "done"; saveXFlow();
  setMode("same");
  setChain(f.dstKey);
  $("fromToken").value = f.tDstId;
  $("toToken").value = f.toId;
  $("amountIn").value = formatAmount(arrived, tDst.decimals, tDst.decimals).replace(/,/g, "");
  clearRoutes("");
  setStatus(t("xStepArrived", formatAmount(arrived, tDst.decimals, 6), tDst.symbol) + " — " + (LANG === "en" ? "Now compare routes and swap." : "ルートを比べて交換してください。"));
  refreshBalances();
  renderXFlow();
}
/* v5: execute the final swap along the STORED leg-2 path of the chosen full
   route. The path is re-quoted at execution time (the user saw the current
   quote in the step before signing); if that exact path no longer quotes,
   stop with a clear error — never switch paths silently. */
async function doXStep4() {
  const f = state.xflow; if (!f || f.step !== 4) return;
  if (!f.pathsV5) { doXStep4Legacy(); return; }
  const { tDst, toTok, dst } = xFlowTokens();
  if (!tDst || !toTok || !dst) return;
  const arrived = BigInt(f.arrived || f.bridgeOut);
  const btn = $("xStep4Btn"); if (btn) btn.disabled = true;
  try {
    if (!state.account) throw new Error(t("xNeedConnect"));
    if (!f.swap2Path) {
      // leg 2 is the identity: the arrived token already is the destination token
      f.step = "done"; saveXFlow(); renderXFlow();
      setXStatus(t("xStep4Identity"));
      return;
    }
    await ensureChain(dst);
    const fresh = await requotePathExact(dst, arrived, f.swap2Path);
    if (fresh == null) throw new Error(t("routeGone"));
    setXStatus(t("xStep4QuoteLine", formatAmount(fresh, toTok.decimals, 6), toTok.symbol, pathLabel(f.dstKey, f.swap2Path)));
    const route = { path: f.swap2Path, amountOut: fresh, amountIn: arrived, hops: f.swap2Path.length - 1 };
    if (!tDst.isNative) await ensureAllowance(dst.router, tDst, arrived, dst);
    const tx = buildSwapTx(dst, tDst, toTok, route, state.account, state.slippagePct);
    setXStatus(t("xWorking"));
    const hash = await sendTx(tx, "0x" + tx.value.toString(16));
    f.swap2Tx = hash; saveXFlow();
    const rc = await waitReceipt(hash);
    if (rc && rc.status === "0x0") throw new Error(t("statusSwapFailedTx"));
    f.step = "done"; saveXFlow(); renderXFlow();
    setXStatus(t("statusSwapDone"));
  } catch (e) { setXStatus(t("xStepFail") + friendlyErr(e), true); if (btn) btn.disabled = false; }
}
function onXAbandon() {
  state.xflow = null; saveXFlow(); stopXPoll(); renderXFlow();
  setXStatus(t("xAbandoned"));
}

/* ================= v4 arbitrage board UI ================= */
function setArbStatus(msg, isErr) { const el = $("arbStatus"); if (el) { el.textContent = msg || ""; el.style.color = isErr ? "#ff9d9d" : ""; } }
function arbCardHtml(row, kind) {
  const isRt = kind === "rt";
  const net = isRt ? row.netRt : row.netSingle;
  const pct = isRt ? row.gainRtPct : row.gainSinglePct;
  const fee = isRt ? row.feeQomRt : row.feeQom;
  const dir = t("arbDirLabel", CHAINS[row.srcKey].label, CHAINS[row.dstKey].label);
  if (!row.ok) {
    return '<div class="route-card arb-card" style="opacity:.55"><span class="r-head"><span class="r-rank">' + esc(row.sym) + " ／ " + esc(dir) + '</span></span>' +
      '<span class="r-line">' + esc(t("arbUnavailable")) + esc(row.reason || "") + "</span></div>";
  }
  const routeLine = row.sym === "QOM"
    ? "QOM →（" + t("arbRouteBridge") + "）→ QOM"
    : "QOM → " + row.sym + "（" + CHAINS[row.srcKey].label + "）→（" + t("arbRouteBridge") + "）→ " + row.sym + " → QOM（" + CHAINS[row.dstKey].label + "）";
  const s1 = row.swap1Route ? pathLabel(row.srcKey, row.swap1Route.path) : null;
  const s2 = row.swap2Route ? pathLabel(row.dstKey, row.swap2Route.path) : null;
  const pctTxt = (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
  return '<div class="route-card arb-card">' +
    '<span class="r-head"><span class="r-rank">' + esc(row.sym) + " ／ " + esc(dir) + "</span>" +
    (row.isBenchmark ? '<span class="badge bench">' + esc(t("arbBenchmarkRow")) + "</span>" : "") +
    '<span class="r-out arb-net ' + (pct >= 0 ? "pos" : "neg") + '">' + pctTxt + "</span></span>" +
    '<span class="r-line">' + esc(routeLine) + "</span>" +
    (s1 ? '<span class="r-line">' + esc(t("xSwap1")) + ": " + esc(s1) + "</span>" : "") +
    (s2 ? '<span class="r-line">' + esc(t("xSwap2")) + ": " + esc(s2) + "</span>" : "") +
    '<span class="r-line">' + esc(t("arbStartLabel")) + ": " + formatAmount(row.startRaw, 18, 6) + " QOM → " + esc(t("arbEndLabel")) + ": " + formatAmount(net, 18, 6) + " QOM（" + esc(t("arbNetLabel")) + " " + pctTxt + "）</span>" +
    '<span class="r-line">' + esc(fee > 0n ? t("arbFeeInQom", formatAmount(fee, 18, 4)) : t("arbFeeZero")) + "</span>" +
    (pct <= 0 ? '<span class="r-line arb-neg-label">' + esc(t("arbNegative")) + "</span>" : "") +
    (isRt ? '<span class="r-line">' + esc(t("arbRtNote")) + "</span>" : "") +
    '<button type="button" class="x-start arb-start" data-sym="' + esc(row.sym) + '" data-dir="' + esc(row.dirKey) + '" data-kind="' + kind + '">' + esc(isRt ? t("arbStartRtBtn") : t("arbStartBtn")) + "</button></div>";
}
function renderArbBoard() {
  const list = $("arbBoard"); if (!list) return;
  const rows = state.arbRows;
  if (!rows || !rows.length || state.arbStartRaw == null) { list.innerHTML = ""; return; }
  const byGain = (key) => (a, b) => {
    if (a.ok && !b.ok) return -1; if (!a.ok && b.ok) return 1;
    if (a.ok && b.ok) return b[key] - a[key];
    return 0;
  };
  const singles = rows.slice().sort(byGain("gainSinglePct"));
  const rts = rows.slice().sort(byGain("gainRtPct"));
  list.innerHTML =
    '<p class="arb-group">' + esc(t("arbSingleTitle")) + "</p>" + singles.map((r) => arbCardHtml(r, "single")).join("") +
    '<p class="arb-group">' + esc(t("arbRoundTitle")) + "</p>" + rts.map((r) => arbCardHtml(r, "rt")).join("");
  list.querySelectorAll(".arb-start").forEach((el) => el.addEventListener("click", () => {
    const row = state.arbRows.find((r) => r.sym === el.dataset.sym && r.dirKey === el.dataset.dir);
    if (row) startArbFlow(row, el.dataset.kind);
  }));
}
async function onArbScan() {
  if (state.chainKey === "testnet") { setArbStatus(LANG === "en" ? "The price-gap board is mainnet-only (no QL1 testnet bridge is known)." : "価格差ボードは本番チェーン同士だけです（QL1のテストネットブリッジは確認できていません）。", true); return; }
  let startRaw;
  try {
    startRaw = parseAmount($("arbAmount").value, 18);
    if (startRaw <= 0n) throw new Error(t("arbNeedAmount"));
  } catch (e) { setArbStatus(e.message, true); return; }
  const btn = $("arbScanBtn"); if (btn) btn.disabled = true;
  setArbStatus(t("arbScanning"));
  if ($("arbBoard")) $("arbBoard").innerHTML = "";
  try {
    const rows = await quoteArbBoard(startRaw);
    state.arbRows = rows; state.arbStartRaw = startRaw;
    renderArbBoard();
    const pos = rows.filter((r) => r.ok && r.gainSinglePct > 0).length;
    setArbStatus(t("arbDone", pos, rows.length));
  } catch (e) { setArbStatus(t("arbFail") + e.message, true); }
  finally { if (btn) btn.disabled = false; }
}
async function startArbFlow(row, kind) {
  if (!row || !row.ok) return;
  const isRt = kind === "rt";
  if (state.chainKey === "testnet") setChain("infinite");
  setMode("cross");
  setXSrc(row.srcKey);
  if ($("xFromToken")) $("xFromToken").value = qomTokenId(row.srcKey);
  if ($("xToToken")) $("xToToken").value = qomTokenId(row.dstKey);
  if ($("xAmount")) $("xAmount").value = formatAmount(row.startRaw, 18, 18).replace(/,/g, "");
  await onXQuote();
  const cand = state.xCandidates.find((c) => c.enabled && c.pair.sym === row.sym);
  if (!cand) { setXStatus(t("xNoCandidate"), true); return; }
  if (!state.account) { setXStatus(t("xNeedConnect"), true); return; }
  await startXFlow(row.sym, { arbReturn: isRt });
  if (isRt) setXStatus(t("arbRtNote"));
}
async function startReturnFlow() {
  const f = state.xflow; if (!f || !f.arbReturn) return;
  const srcKey = f.dstKey, dstKey = f.srcKey;
  setMode("cross");
  setXSrc(srcKey);
  if ($("xFromToken")) $("xFromToken").value = qomTokenId(srcKey);
  if ($("xToToken")) $("xToToken").value = qomTokenId(dstKey);
  if ($("xAmount")) $("xAmount").value = formatAmount(BigInt(f.finalEst || f.bridgeOut), 18, 18).replace(/,/g, "");
  await onXQuote();
  setXStatus(t("arbReturnNote"));
  if (!state.account) { setXStatus(t("xNeedConnect"), true); return; }
  await startXFlow("QOM");
}

/* ---------- CA add ---------- */
async function onCaAdd() {
  const input = $("caInput"), msg = $("caMsg");
  const m = input.value.trim().match(/0x[0-9a-fA-F]{40}/);
  if (!m) { msg.textContent = t("caBadFormat"); return; }
  const addr = m[0].toLowerCase();
  if (allTokens().some((tk) => tk.address.toLowerCase() === addr && !tk.isNative)) { msg.textContent = t("caExists"); return; }
  const btn = $("caAddBtn"); btn.disabled = true; msg.textContent = t("caReading");
  try {
    const meta = await fetchTokenMeta(chain(), addr);
    state.custom[state.chainKey].push(meta);
    saveLocal();
    fillTokenSelects();
    $("toToken").value = meta.id;
    clearRoutes(t("statusCaAddedQuote"));
    msg.textContent = t("caAdded", meta.symbol, meta.name || "", meta.decimals);
    input.value = "";
    refreshBalances();
  } catch (e) { msg.textContent = t("caReadFail") + e.message; }
  finally { btn.disabled = false; }
}

/* ---------- wiring ---------- */
function setChain(key) {
  if (key === "testnet" && state.mode === "cross") setMode("same");
  state.chainKey = key;
  if (state.mode === "cross" && key !== state.xSrc && (key === "infinite" || key === "ql1")) { setXSrc(key); return; }
  state.balances = {};
  $("chainInf").classList.toggle("active", key === "infinite");
  $("chainQl1").classList.toggle("active", key === "ql1");
  if ($("chainTest")) $("chainTest").classList.toggle("active", key === "testnet");
  if ($("testnetBanner")) $("testnetBanner").style.display = key === "testnet" ? "" : "none";
  if ($("arbTestnetNote")) $("arbTestnetNote").style.display = key === "testnet" ? "" : "none";
  if ($("arbScanBtn")) $("arbScanBtn").disabled = key === "testnet";
  $("chainNote").textContent = key === "infinite" ? t("noteInfinite") : key === "ql1" ? t("noteQl1") : t("noteTestnet");
  fillTokenSelects();
  clearRoutes(t("statusChainSwitched"));
  if (state.account) { $("accountLine").textContent = t("accountLineSwitch", shortAddr(state.account), chain().label); refreshBalances(); }
}
function applyChip(pct) {
  const f = currentFrom(); if (!f) return;
  const raw = state.balances[f.id];
  if (!state.account || raw == null) { setStatus(t("statusBalanceUnknown"), true); return; }
  let v;
  if (pct === "MAX") {
    if (f.isNative) {
      const buffer = parseAmount("0.01", f.decimals);
      v = raw > buffer ? raw - buffer : 0n;
    } else v = raw;
  } else v = (raw * BigInt(pct)) / 100n;
  $("amountIn").value = formatAmount(v, f.decimals, f.decimals).replace(/,/g, "");
  clearRoutes(t("statusAmountChanged"));
}
/* ---------- v6.3: language selector ----------
   index.html は言語の振り分けページ (保存済み dexagg_lang = "ja" のときだけ
   日本語、それ以外はデフォルト英語)。各言語ページのヘッダーにある
   セレクタで切り替えると、選択を保存して相手ページへ移動する。 */
function langTargetFor(value, currentLang) {
  const v = value === "ja" ? "ja" : "en";
  if (v === currentLang) return null;
  return v === "ja" ? "ja.html" : "en.html";
}
function initLangSelector() {
  const sel = typeof document !== "undefined" && document.getElementById ? document.getElementById("langSel") : null;
  if (!sel || !sel.addEventListener) return;
  sel.value = LANG;
  sel.addEventListener("change", () => {
    const v = sel.value === "ja" ? "ja" : "en";
    try { localStorage.setItem("dexagg_lang", v); } catch (e) { /* storage unavailable: still navigate */ }
    const target = langTargetFor(v, LANG);
    if (target && typeof location !== "undefined" && location) location.href = target;
  });
}
function initApp() {
  initLangSelector();
  loadLocal();
  fillTokenSelects();
  $("chainInf").addEventListener("click", () => setChain("infinite"));
  $("chainQl1").addEventListener("click", () => setChain("ql1"));
  if ($("chainTest")) $("chainTest").addEventListener("click", () => setChain("testnet"));
  $("connectBtn").addEventListener("click", onConnect);
  $("quoteBtn").addEventListener("click", onQuote);
  $("swapBtn").addEventListener("click", onSwap);
  $("flipBtn").addEventListener("click", () => {
    const a = $("fromToken").value; $("fromToken").value = $("toToken").value; $("toToken").value = a;
    clearRoutes(t("statusSwappedPair")); refreshBalances();
  });
  if ($("rateInvertBtn")) $("rateInvertBtn").addEventListener("click", () => { state.rateInvert = !state.rateInvert; updateReceive(); });
  for (const id of ["fromToken", "toToken"]) $(id).addEventListener("change", () => { clearRoutes(t("statusTokenChangedMsg")); refreshBalances(); });
  $("amountIn").addEventListener("input", () => { if (state.routes.length) clearRoutes(t("statusAmountChanged")); });
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
  /* v3 cross-chain wiring (guarded so partial DOM stubs do not crash) */
  if ($("modeSame")) $("modeSame").addEventListener("click", () => setMode("same"));
  if ($("modeCross")) $("modeCross").addEventListener("click", () => setMode("cross"));
  if ($("xSrcInf")) $("xSrcInf").addEventListener("click", () => setXSrc("infinite"));
  if ($("xSrcQl1")) $("xSrcQl1").addEventListener("click", () => setXSrc("ql1"));
  if ($("xQuoteBtn")) $("xQuoteBtn").addEventListener("click", onXQuote);
  if ($("arbScanBtn")) $("arbScanBtn").addEventListener("click", onArbScan);
  document.querySelectorAll(".arb-chip").forEach((el) => el.addEventListener("click", () => { if ($("arbAmount")) $("arbAmount").value = el.dataset.amt; }));
  if ($("xAbandon")) $("xAbandon").addEventListener("click", onXAbandon);
  for (const id of ["xFromToken", "xToToken"]) if ($(id)) $(id).addEventListener("change", () => { state.xCandidates = []; state.xQuote = null; state.xSplit = null; if ($("xCandidates")) $("xCandidates").innerHTML = ""; refreshXBalance(); });
  loadXFlow();
  setChain("infinite");
  renderBalances();
}
if (typeof document !== "undefined" && document.getElementById && document.getElementById("fromToken")) {
  try { initApp(); } catch (e) { /* harness stubs may lack full DOM */ }
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { CHAINS, STR, LANG, state, parseAmount, formatAmount, formatRate, formatGas, encAddr, encUint, encLegsTail, encodeGetAmountsOut, decodeAmountsOut, buildCandidatePaths, fetchQuotesForTokens, evaluateSplits, buildSwapTx, buildApproveTx, buildSplitTx, applySlippageBps, fetchTokenMeta, tokenById, allTokens, symbolFor, onQuote, onCaAdd, selectRoute, selectSplit, selectedRoute, setChain, estimateGasUnitsSingle, estimateGasUnitsSplit, splitExecutable,
    BRIDGE_PAIRS, BRIDGE_MAILBOX, bridgePairBySym, fetchBestRoute, fetchRoutesOnly, attachImpactsMulti, buildBridgeTx, decodeBridgeTxData, encodeRecipient32, fetchBridgeNativeQuote, fetchBridgeDelivered, readTokenBalance, extractMessageId, quoteCrossPlan, requotePathExact, serializeXFlow, restoreXFlow, saveXFlow, loadXFlow, setMode, setXSrc, xDstKey, onXQuote, renderXCandidates, startXFlow, renderXFlow, checkArrival, doXStep1, doXStep4, doXStep4Legacy, onXAbandon,
    evaluateCrossSplit, crossSplitPool, requoteSplitPart, makeCrossSplitQuoter, refineSplitAllocation, leg2GroupKey, combineLeg2Groups, distributeCombinedOut, attributeSplitArrivals, crossSplitPhase, startXSplitFlow, renderXSplitFlow, checkSplitArrival, doXSplitStep1, doXSplitStep2, doXSplitStep4,
    qomTokenId, fetchBridgeFeeInQom, quoteArbRoute, quoteArbBoard, renderArbBoard, onArbScan, startArbFlow, startReturnFlow,
    langTargetFor, initLangSelector };
}
