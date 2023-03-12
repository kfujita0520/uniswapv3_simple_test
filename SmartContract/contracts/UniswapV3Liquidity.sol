// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './interfaces/external/IWETH9.sol';
import './interfaces/INonfungiblePositionManager.sol';
import './interfaces/IUniswapV3Factory.sol';
import "hardhat/console.sol";

//TODO remove debug code
contract UniswapV3Liquidity is IERC721Receiver, Ownable {

    int24 private constant MIN_TICK = - 887272;
    int24 private constant MAX_TICK = - MIN_TICK;

    INonfungiblePositionManager public NonfungiblePositionManager;
    IUniswapV3Factory public UniswapV3Factory;

    constructor(address nonfungiblePositionManagerAddress, address uniswapV3FacotryAddress) public {
        NonfungiblePositionManager = INonfungiblePositionManager(nonfungiblePositionManagerAddress);
        UniswapV3Factory = IUniswapV3Factory(uniswapV3FacotryAddress);
    }

    function onERC721Received(
        address operator,
        address from,
        uint tokenId,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function mintNewPosition(
        address token0Addr,
        address token1Addr,
        uint24 fee,
        uint amount0ToAdd,
        uint amount1ToAdd
    ) external onlyOwner returns (uint tokenId, uint128 liquidity, uint amount0, uint amount1) {
        IERC20 Token0 = IERC20(token0Addr);
        IERC20 Token1 = IERC20(token1Addr);
        Token0.transferFrom(msg.sender, address(this), amount0ToAdd);
        Token1.transferFrom(msg.sender, address(this), amount1ToAdd);
        console.log('transfer from wallet to this address');

        Token0.approve(address(NonfungiblePositionManager), amount0ToAdd);
        Token1.approve(address(NonfungiblePositionManager), amount1ToAdd);

        int24 TICK_SPACING = UniswapV3Factory.feeAmountTickSpacing(fee);

        INonfungiblePositionManager.MintParams
        memory params = INonfungiblePositionManager.MintParams({
            token0 : token0Addr,
            token1 : token1Addr,
            fee : fee,
            tickLower : (MIN_TICK / TICK_SPACING) * TICK_SPACING,
            tickUpper : (MAX_TICK / TICK_SPACING) * TICK_SPACING,
            amount0Desired : amount0ToAdd,
            amount1Desired : amount1ToAdd,
            amount0Min : 0,
            amount1Min : 0,
            recipient : msg.sender, //this can be address(this), if we want to manger positionNFT in this contract
            deadline : block.timestamp
        });
        console.logInt((MIN_TICK / TICK_SPACING) * TICK_SPACING);
        //console.logInt(params.tickUpper);

        (tokenId, liquidity, amount0, amount1) = NonfungiblePositionManager.mint(
            params
        );
        console.log('amount0: %s', amount0);
        console.log('amount1: %s', amount1);
        console.log('liquidity: %s', liquidity);
        console.log('tokenId: %s', tokenId);

        if (amount0 < amount0ToAdd) {
            Token0.approve(address(NonfungiblePositionManager), 0);
            uint refund0 = amount0ToAdd - amount0;
            console.log('refund0: %s', refund0);
            //console.log('balance: %s', Token0.balanceOf(address(this)));
            Token0.transfer(msg.sender, refund0);
        }
        if (amount1 < amount1ToAdd) {
            Token1.approve(address(NonfungiblePositionManager), 0);
            uint refund1 = amount1ToAdd - amount1;
            console.log('refund1: %s', refund1);
            //console.log('balance: %s', Token1.balanceOf(address(this)));
            Token1.transfer(msg.sender, refund1);
        }
    }

    function collectAllFees(
        uint tokenId
    ) external onlyOwner returns (uint amount0, uint amount1) {
        INonfungiblePositionManager.CollectParams
        memory params = INonfungiblePositionManager.CollectParams({
        tokenId : tokenId,
        recipient : address(this),
        amount0Max : type(uint128).max,
        amount1Max : type(uint128).max
        });

        (amount0, amount1) = NonfungiblePositionManager.collect(params);
    }

    function increaseLiquidityCurrentRange(
        uint tokenId,
        uint amount0ToAdd,
        uint amount1ToAdd
    ) external onlyOwner returns (uint128 liquidity, uint amount0, uint amount1) {

        (, , address token0, address token1, , , , , , , , ) = NonfungiblePositionManager.positions(tokenId);

        IERC20(token0).transferFrom(msg.sender, address(this), amount0ToAdd);
        IERC20(token1).transferFrom(msg.sender, address(this), amount1ToAdd);

        IERC20(token0).approve(address(NonfungiblePositionManager), amount0ToAdd);
        IERC20(token1).approve(address(NonfungiblePositionManager), amount1ToAdd);

        INonfungiblePositionManager.IncreaseLiquidityParams
        memory params = INonfungiblePositionManager.IncreaseLiquidityParams({
            tokenId : tokenId,
            amount0Desired : amount0ToAdd,
            amount1Desired : amount1ToAdd,
            amount0Min : 0,
            amount1Min : 0,
            deadline : block.timestamp
        });

        (liquidity, amount0, amount1) = NonfungiblePositionManager.increaseLiquidity(
            params
        );
    }

    function decreaseLiquidityCurrentRange(
        uint tokenId,
        uint128 liquidity
    ) external onlyOwner returns (uint amount0, uint amount1) {
        INonfungiblePositionManager.DecreaseLiquidityParams
        memory params = INonfungiblePositionManager.DecreaseLiquidityParams({
            tokenId : tokenId,
            liquidity : liquidity,
            amount0Min : 0,
            amount1Min : 0,
            deadline : block.timestamp
        });
        console.log(liquidity);

        (amount0, amount1) = NonfungiblePositionManager.decreaseLiquidity(params);
    }
}


