// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SplitSwap — 最小の分割スワップ・アグリゲーター
/// @notice 1回のトランザクションで、入力トークンを複数のルート（Uniswap V2
///         ルーターのパス）に配分して交換する。各レッグは通常の
///         swapExactTokensForTokens / swapExactTokensForETH /
///         swapExactETHForTokens を呼ぶだけの薄い実装。
/// @dev 監査を受けていないテスト用コントラクト。本番資金では使わないこと。

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IV2Router {
    function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts);
    function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts);
    function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable returns (uint256[] memory amounts);
    function WETH() external view returns (address);
}

contract SplitSwap {
    IV2Router public immutable router;

    struct Leg {
        uint256 amountIn;   // このレッグに配分する入力量（最小単位）
        address[] path;     // ルーターに渡すパス
    }

    event SplitSwapExecuted(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountInTotal, uint256 amountOutTotal, uint8 legs);

    constructor(address router_) {
        require(router_ != address(0), "router=0");
        router = IV2Router(router_);
    }

    function _checkLegs(Leg[] calldata legs, uint256 deadline) internal view returns (uint256 totalIn) {
        require(legs.length >= 1 && legs.length <= 8, "legs 1..8");
        require(deadline >= block.timestamp, "expired");
        for (uint256 i = 0; i < legs.length; i++) {
            require(legs[i].amountIn > 0, "leg amount=0");
            require(legs[i].path.length >= 2, "path len<2");
            totalIn += legs[i].amountIn;
        }
    }

    /// @notice トークン → トークンの分割スワップ
    function swapSplit(
        address tokenIn,
        Leg[] calldata legs,
        uint256 amountOutMinTotal,
        address tokenOut,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOutTotal) {
        uint256 totalIn = _checkLegs(legs, deadline);
        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), totalIn), "transferFrom failed");
        uint256 balBefore = IERC20(tokenOut).balanceOf(to);
        for (uint256 i = 0; i < legs.length; i++) {
            require(IERC20(tokenIn).approve(address(router), 0), "approve0 failed");
            require(IERC20(tokenIn).approve(address(router), legs[i].amountIn), "approve failed");
            uint256[] memory amounts = router.swapExactTokensForTokens(legs[i].amountIn, 0, legs[i].path, to, deadline);
            amountOutTotal += amounts[amounts.length - 1];
        }
        // ルーターの返り値と実残高差分の両方で最低量を確認する
        uint256 balDiff = IERC20(tokenOut).balanceOf(to) - balBefore;
        require(balDiff >= amountOutMinTotal, "amountOut < min");
        require(amountOutTotal >= amountOutMinTotal, "amountOut(router) < min");
        emit SplitSwapExecuted(msg.sender, tokenIn, tokenOut, totalIn, amountOutTotal, uint8(legs.length));
    }

    /// @notice トークン → ネイティブ通貨の分割スワップ（出力は `to` へ直接送られる）
    function swapSplitToNative(
        address tokenIn,
        Leg[] calldata legs,
        uint256 amountOutMinTotal,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOutTotal) {
        uint256 totalIn = _checkLegs(legs, deadline);
        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), totalIn), "transferFrom failed");
        uint256 balBefore = to.balance;
        for (uint256 i = 0; i < legs.length; i++) {
            require(IERC20(tokenIn).approve(address(router), 0), "approve0 failed");
            require(IERC20(tokenIn).approve(address(router), legs[i].amountIn), "approve failed");
            uint256[] memory amounts = router.swapExactTokensForETH(legs[i].amountIn, 0, legs[i].path, to, deadline);
            amountOutTotal += amounts[amounts.length - 1];
        }
        require(to.balance - balBefore >= amountOutMinTotal, "amountOut < min");
        emit SplitSwapExecuted(msg.sender, tokenIn, address(0), totalIn, amountOutTotal, uint8(legs.length));
    }

    /// @notice ネイティブ通貨 → トークンの分割スワップ（msg.value を legs.amountIn の合計と一致させる）
    function swapSplitFromNative(
        Leg[] calldata legs,
        uint256 amountOutMinTotal,
        address tokenOut,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountOutTotal) {
        uint256 totalIn = _checkLegs(legs, deadline);
        require(msg.value == totalIn, "msg.value != sum(legs)");
        uint256 balBefore = IERC20(tokenOut).balanceOf(to);
        for (uint256 i = 0; i < legs.length; i++) {
            uint256[] memory amounts = router.swapExactETHForTokens{value: legs[i].amountIn}(0, legs[i].path, to, deadline);
            amountOutTotal += amounts[amounts.length - 1];
        }
        require(IERC20(tokenOut).balanceOf(to) - balBefore >= amountOutMinTotal, "amountOut < min");
        emit SplitSwapExecuted(msg.sender, address(0), tokenOut, totalIn, amountOutTotal, uint8(legs.length));
    }
}
