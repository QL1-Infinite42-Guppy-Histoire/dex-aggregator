"use strict";
/* DEXアグリゲーター v4 (42 Chain / QL1 / 42 Testnet)
   1inch風: 直接・1つ経由・2つ経由の全ルートを getAmountsOut で比較し、
   さらに上位ルートへの「分割」配分も評価して一番多いプランを提示する。
   分割の1tx実行には専用コントラクト (contracts/SplitSwap.sol) が必要。
   デプロイ済みチェーンでのみ分割実行でき、それ以外は見積もりのみ（正直に表示）。
   v3: クロスチェーン (QL1 <=> 42 Chain) の束ね見積もり＋ガイド式実行。
   v4: 価格差 (裁定) — クロス見積もりのベンチマーク差表示＋バッジと、
   QOM建てで全ブリッジ可能トークン×両方向を実見積もりする価格差ボード。*/

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
    xComparing: "クロスチェーンの候補を比べています…（中継トークンごとに 交換→ブリッジ→交換 を全部見積もります）",
    xQuoted: (n, sym, amt, dstSym) => "中継候補 " + n + " 件を比べました。いちばん多いのは中継 " + sym + " で、最終見積もりは約 " + amt + " " + dstSym + " です。",
    xQuoteFail: "クロスチェーン見積もりができませんでした: ", xNoCandidate: "成立する中継候補がありませんでした（プールが無いか、流動性がありません）",
    xVia: "中継", xSwap1: "交換1", xBridge: "ブリッジ", xSwap2: "交換2", xFinalEst: "最終見積もり",
    xDirectBridge: "直接ブリッジ（スワップなしでそのまま入る）",
    xBridgeFeeZero: "手数料 0", xNativeFeeInf: (amt) => "＋メッセージ代 約 " + amt + " [42]", xNativeFeeQl1: "＋メッセージ代 0（実測: QL1側の送信は全て支払い0でした）",
    xStartBtn: "この中継ではじめる", xTooSmall: "ブリッジの最小量（1トークン）未満のため使えません",
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
    xComparing: "Comparing cross-chain candidates... (for each bridge token: swap -> bridge -> swap)",
    xQuoted: (n, sym, amt, dstSym) => "Compared " + n + " bridge candidates. The best is via " + sym + ", final estimate approx. " + amt + " " + dstSym + ".",
    xQuoteFail: "Cross-chain quote failed: ", xNoCandidate: "No bridge candidate works (no pool or no liquidity)",
    xVia: "Via", xSwap1: "Swap 1", xBridge: "Bridge", xSwap2: "Swap 2", xFinalEst: "Final estimate",
    xDirectBridge: "Direct bridge (no swap — enters as-is)",
    xBridgeFeeZero: "fee 0", xNativeFeeInf: (amt) => "+ messaging cost approx. " + amt + " [42]", xNativeFeeQl1: "+ messaging cost 0 (measured: every sampled QL1 send paid 0)",
    xStartBtn: "Start with this bridge token", xTooSmall: "Below the bridge minimum (1 token)",
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

/* ---------- split evaluation (1inch-style allocation search) ---------- */
async function evaluateSplits(chainObj, routes, amountIn) {
  const top = routes.slice(0, 3);
  if (top.length < 2 || amountIn <= 0n) return { evaluated: 0, best: null, plan: null };
  const candidates = [];
  for (const pct of [90, 80, 70, 60, 50]) candidates.push([[top[0], pct], [top[1], 100 - pct]]);
  if (top.length >= 3) for (const sh of [[50, 30, 20], [40, 30, 30], [60, 25, 15], [34, 33, 33]]) candidates.push(sh.map((pct, i) => [top[i], pct]));
  // leg amountIns (last leg takes the remainder so the sum is exact)
  const candLegs = candidates.map((cand) => {
    const legs = []; let used = 0n;
    cand.forEach(([route, pct], i) => {
      const amt = i === cand.length - 1 ? amountIn - used : (amountIn * BigInt(pct)) / 100n;
      used += amt; legs.push({ route, pct, amountIn: amt, amountOut: null });
    });
    return legs;
  }).filter((legs) => legs.every((l) => l.amountIn > 0n));
  const flat = [];
  candLegs.forEach((legs, ci) => legs.forEach((leg, li) => flat.push({ ci, li, call: [chainObj.router, encodeGetAmountsOut(leg.amountIn, leg.route.path)] })));
  const results = await rpcBatch(chainObj, flat.map((f) => f.call));
  flat.forEach((f, i) => {
    const amts = decodeAmountsOut(results[i]);
    candLegs[f.ci][f.li].amountOut = amts && amts.length ? amts[amts.length - 1] : null;
  });
  let best = null;
  for (const legs of candLegs) {
    if (legs.some((l) => l.amountOut == null || l.amountOut <= 0n)) continue;
    const totalOut = legs.reduce((s, l) => s + l.amountOut, 0n);
    if (!best || totalOut > best.totalOut) best = { legs, totalOut };
  }
  const plan = best && best.totalOut > routes[0].amountOut ? best : null;
  return { evaluated: candLegs.length, best, plan };
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

/* ---------- v3 cross-chain: quote all bridge candidates ---------- */
async function quoteCrossPlan(srcKey, fromTok, dstKey, toTok, amountIn) {
  const src = CHAINS[srcKey], dst = CHAINS[dstKey];
  const out = [];
  for (const pair of BRIDGE_PAIRS) {
    const tSrc = tokenById(srcKey, srcKey === "infinite" ? pair.infId : pair.ql1Id);
    const tDst = tokenById(dstKey, dstKey === "infinite" ? pair.infId : pair.ql1Id);
    if (!tSrc || !tDst) continue;
    const enabledDir = srcKey === "ql1" ? pair.enabledFromQl1 : pair.enabledFromInf;
    if (!enabledDir) { out.push({ pair, tSrc, tDst, enabled: false, reason: t("xDisabledOsak") }); continue; }
    if (srcKey === "ql1" && fromTok.id === "native" && pair.sym === "QOM") { out.push({ pair, tSrc, tDst, enabled: false, reason: t("xDisabledWrap") }); continue; }
    // swap 1 (skip when the source token already is the bridge token)
    let swap1Out = null, swap1Route = null;
    if (fromTok.address.toLowerCase() === tSrc.address.toLowerCase()) swap1Out = amountIn;
    else {
      const best = await fetchBestRoute(src, fromTok, tSrc, amountIn);
      if (!best) continue;
      swap1Out = best.amountOut; swap1Route = best;
    }
    if (swap1Out < (10n ** BigInt(tSrc.decimals))) { out.push({ pair, tSrc, tDst, enabled: false, reason: t("xTooSmall") }); continue; }
    const bridgeOut = swap1Out; // bridge fee 0, scale 1:1 (verified by sampling + quoteBridge)
    // swap 2 at current rates on the destination chain
    let finalOut = null, swap2Route = null;
    if (tDst.address.toLowerCase() === toTok.address.toLowerCase()) finalOut = bridgeOut;
    else {
      const best2 = await fetchBestRoute(dst, tDst, toTok, bridgeOut);
      if (!best2) continue;
      finalOut = best2.amountOut; swap2Route = best2;
    }
    let nativeFee = 0n;
    if (srcKey === "infinite") { try { const q = await fetchBridgeNativeQuote(pair); if (q) nativeFee = q.totalNative; } catch (e) { /* shown as approx */ } }
    out.push({ pair, tSrc, tDst, enabled: true, swap1Out, swap1Route, bridgeOut, finalOut, swap2Route, nativeFee });
  }
  const en = out.filter((c) => c.enabled);
  en.sort((a, b) => (b.finalOut > a.finalOut ? 1 : b.finalOut < a.finalOut ? -1 : 0));
  const result = [...en, ...out.filter((c) => !c.enabled)];
  /* v4 benchmark: the "obvious" route — via QOM, or bridging the source token
     itself when that is possible. The better of the available ones is the
     benchmark; every candidate gets its difference vs the benchmark so the
     price-gap (arbitrage) saving is visible on the card itself. */
  let benchmark = null;
  const consider = (cand, kind) => {
    if (!cand || !cand.enabled || cand.finalOut == null) return;
    if (!benchmark || cand.finalOut > benchmark.finalOut) benchmark = { sym: cand.pair.sym, kind, finalOut: cand.finalOut };
  };
  consider(en.find((c) => c.pair.sym === "QOM"), "qom");
  consider(en.find((c) => c.tSrc.address.toLowerCase() === fromTok.address.toLowerCase()), "direct");
  if (benchmark) {
    for (const c of result) {
      if (!c.enabled || c.finalOut == null) continue;
      c.vsBenchDiff = c.finalOut - benchmark.finalOut;
      c.vsBenchPct = benchmark.finalOut > 0n ? (Number(c.vsBenchDiff) / Number(benchmark.finalOut)) * 100 : 0;
    }
  }
  result.benchmark = benchmark;
  return result;
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
    if (!f || f.v !== 1 || !f.srcKey || !f.dstKey || !f.sym) return null;
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
  state.xCandidates = []; state.xQuote = null; state.xBenchmark = null;
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
    renderXCandidates();
    const best = cands.find((c) => c.enabled);
    if (best) setXStatus(t("xQuoted", cands.filter((c) => c.enabled).length, best.pair.sym, formatAmount(best.finalOut, tk.decimals, 6), tk.symbol));
    else setXStatus(t("xNoCandidate"), true);
  } catch (e) { setXStatus(t("xQuoteFail") + e.message, true); }
  finally { btn.disabled = false; }
}
function renderXCandidates() {
  const list = $("xCandidates"); if (!list) return;
  const dst = CHAINS[xDstKey()];
  const toTok = state.xQuote ? tokenById(xDstKey(), state.xQuote.toId) : null;
  const fromTok = state.xQuote ? tokenById(state.xSrc, state.xQuote.fromId) : null;
  if (!toTok || !fromTok) { list.innerHTML = ""; return; }
  list.innerHTML = state.xCandidates.map((c, i) => {
    if (!c.enabled) {
      return '<div class="route-card" style="opacity:.55"><span class="r-head"><span class="r-rank">' + esc(t("xVia")) + " " + esc(c.pair.sym) + '</span></span><span class="r-line">' + esc(c.reason || "") + "</span></div>";
    }
    const s1 = c.swap1Route ? pathLabel(state.xSrc, c.swap1Route.path) + " → " + formatAmount(c.swap1Out, c.tSrc.decimals, 6) + " " + c.tSrc.symbol + (c.swap1Route.priceImpactPct != null ? " (" + t("routeImpact", c.swap1Route.priceImpactPct.toFixed(2)) + ")" : "") : t("xDirectBridge") + ": " + formatAmount(c.swap1Out, c.tSrc.decimals, 6) + " " + c.tSrc.symbol;
    const fee = state.xSrc === "infinite" ? t("xBridgeFeeZero") + " / " + t("xNativeFeeInf", formatAmount(c.nativeFee, 18, 4)) : t("xBridgeFeeZero") + " / " + t("xNativeFeeQl1");
    const s2 = c.swap2Route ? pathLabel(xDstKey(), c.swap2Route.path) + " → " + formatAmount(c.finalOut, toTok.decimals, 6) + " " + toTok.symbol + (c.swap2Route.priceImpactPct != null ? " (" + t("routeImpact", c.swap2Route.priceImpactPct.toFixed(2)) + ")" : "") : formatAmount(c.finalOut, toTok.decimals, 6) + " " + toTok.symbol;
    const bench = state.xBenchmark;
    let benchHtml = "";
    if (bench) {
      if (c.finalOut === bench.finalOut && c.pair.sym === bench.sym) {
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
      '<span class="r-line">' + esc(t("xSwap1")) + ": " + esc(s1) + "</span>" +
      '<span class="r-line">' + esc(t("xBridge")) + " (" + esc(CHAINS[state.xSrc].label) + " → " + esc(dst.label) + "): " + esc(fee) + "</span>" +
      '<span class="r-line">' + esc(t("xSwap2")) + ": " + esc(s2) + "</span>" +
      '<span class="r-line">' + esc(t("xFinalEst")) + ": " + formatAmount(c.finalOut, toTok.decimals, 6) + " " + esc(toTok.symbol) + "</span>" +
      benchHtml +
      '<button type="button" class="x-start" data-sym="' + esc(c.pair.sym) + '">' + esc(t("xStartBtn")) + "</button></div>";
  }).join("") + '<p class="count">' + esc(t("xEstNote")) + "</p>";
  list.querySelectorAll(".x-start").forEach((el) => el.addEventListener("click", () => startXFlow(el.dataset.sym)));
}
async function startXFlow(sym, opts) {
  if (!state.account) { setXStatus(t("xNeedConnect"), true); return; }
  const cand = state.xCandidates.find((c) => c.enabled && c.pair.sym === sym);
  if (!cand || !state.xQuote) return;
  const src = CHAINS[state.xSrc], dst = CHAINS[xDstKey()];
  const fromTok = tokenById(state.xSrc, state.xQuote.fromId);
  let baselineT = 0n;
  try { baselineT = cand.swap1Route ? await readTokenBalance(src, cand.tSrc.address, state.account) : 0n; } catch (e) { /* optional */ }
  state.xflow = {
    v: 1, step: cand.swap1Route ? 1 : 2,
    srcKey: state.xSrc, dstKey: xDstKey(), fromId: state.xQuote.fromId, toId: state.xQuote.toId,
    amountText: $("xAmount").value, amountIn: state.xQuote.amountIn,
    sym, tSrcId: cand.tSrc.id, tDstId: cand.tDst.id,
    swap1Path: cand.swap1Route ? cand.swap1Route.path : null, swap1Out: cand.swap1Out.toString(),
    bridgeOut: cand.bridgeOut.toString(), finalEst: cand.finalOut.toString(), nativeFee: cand.nativeFee.toString(),
    baselineT: baselineT.toString(), baselineDst: null, swap1Tx: null, bridgeTx: null, messageId: null, bridgeAt: null, arrived: null,
    arbReturn: !!(opts && opts.arbReturn),
    createdAt: Date.now(),
  };
  saveXFlow();
  renderXFlow();
  setXStatus("");
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
  html += '<div class="xstep' + (f.step === 4 ? " current" : "") + '"><div class="xstep-head"><b>' + esc(t("xStep4Title")) + '</b><span class="badge-step">' + esc(st(4)) + '</span></div>' +
    '<p class="count">' + esc(t("xStep4Desc", tSrc.symbol, toTok.symbol)) + "</p>" +
    (f.arbReturn ? '<p class="count">' + esc(t("arbRtNote")) + "</p>" : "") +
    (f.step === 4 ? '<button type="button" id="xStep4Btn">' + esc(t("xStep4Btn")) + "</button>" : "") + "</div>";
  if (f.step === "done") {
    html += '<p class="count">' + esc(t("xFlowDone")) + "</p>";
    if (f.arbReturn) html += '<button type="button" id="xReturnBtn">' + esc(t("arbReturnBtn")) + "</button>";
  }
  html += "</div>";
  area.innerHTML = html;
  const b1 = $("xStep1Btn"); if (b1) b1.addEventListener("click", doXStep1);
  const b2 = $("xStep2Btn"); if (b2) b2.addEventListener("click", doXStep2);
  const b4 = $("xStep4Btn"); if (b4) b4.addEventListener("click", doXStep4);
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
async function doXStep1() {
  const f = state.xflow; if (!f || f.step !== 1) return;
  const { fromTok, tSrc, src } = xFlowTokens();
  const btn = $("xStep1Btn"); if (btn) btn.disabled = true;
  try {
    if (!state.account) throw new Error(t("xNeedConnect"));
    await ensureChain(src);
    const route = { path: f.swap1Path, amountOut: BigInt(f.swap1Out), amountIn: BigInt(f.amountIn), hops: f.swap1Path.length - 1 };
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
function doXStep4() {
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
function initApp() {
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
  for (const id of ["xFromToken", "xToToken"]) if ($(id)) $(id).addEventListener("change", () => { state.xCandidates = []; state.xQuote = null; if ($("xCandidates")) $("xCandidates").innerHTML = ""; refreshXBalance(); });
  loadXFlow();
  setChain("infinite");
  renderBalances();
}
if (typeof document !== "undefined" && document.getElementById && document.getElementById("fromToken")) {
  try { initApp(); } catch (e) { /* harness stubs may lack full DOM */ }
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { CHAINS, STR, LANG, state, parseAmount, formatAmount, formatRate, formatGas, encAddr, encUint, encLegsTail, encodeGetAmountsOut, decodeAmountsOut, buildCandidatePaths, fetchQuotesForTokens, evaluateSplits, buildSwapTx, buildApproveTx, buildSplitTx, applySlippageBps, fetchTokenMeta, tokenById, allTokens, symbolFor, onQuote, onCaAdd, selectRoute, selectSplit, selectedRoute, setChain, estimateGasUnitsSingle, estimateGasUnitsSplit, splitExecutable,
    BRIDGE_PAIRS, BRIDGE_MAILBOX, bridgePairBySym, fetchBestRoute, buildBridgeTx, decodeBridgeTxData, encodeRecipient32, fetchBridgeNativeQuote, fetchBridgeDelivered, readTokenBalance, extractMessageId, quoteCrossPlan, serializeXFlow, restoreXFlow, saveXFlow, loadXFlow, setMode, setXSrc, xDstKey, onXQuote, renderXCandidates, startXFlow, renderXFlow, checkArrival, doXStep4, onXAbandon,
    qomTokenId, fetchBridgeFeeInQom, quoteArbRoute, quoteArbBoard, renderArbBoard, onArbScan, startArbFlow, startReturnFlow };
}
