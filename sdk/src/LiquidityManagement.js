// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

const {ethers, upgrades} = require("hardhat");
const { Pool, Position, NonfungiblePositionManager, nearestUsableTick } = require('@uniswap/v3-sdk');
const { Percent, Token, CurrencyAmount } = require('@uniswap/sdk-core');

const MIN_TICK = -887272;
const MAX_TICK = 887272;
const NonFungiblePositionManager_ADDRESS = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";//goerli: 0xC36442b4a4522E871399CD717aBDD847Ab11FE88
const UniswapV3Factory_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984"; //goeril: 0x1F98431c8aD98523631AE4a59f267346ea31F984
const CHAIN_ID = 1;
const MAX_FEE_PER_GAS = '100000000000';
const MAX_PRIORITY_FEE_PER_GAS = '100000000000';

class LiquidityManagement {
    constructor(poolAddress){
        this.poolAddress = poolAddress;
    }

    async init() {
        this.PoolV3 = await ethers.getContractAt("IUniswapV3Pool", this.poolAddress);
        this.immutables = await this.getPoolImmutables();
        let Token0Contract = await ethers.getContractAt("IERC20Metadata", this.immutables.token0);
        let Token1Contract = await ethers.getContractAt("IERC20Metadata", this.immutables.token1);
        this.Token0 = new Token(CHAIN_ID, this.immutables.token0, await Token0Contract.decimals());
        this.Token1 = new Token(CHAIN_ID, this.immutables.token1, await Token1Contract.decimals());
    }

    //TODO add max_tick, min_tick as optional para,meter
    async mintNewPosition(signer, receiver, amount0, amount1) {

        const state = await this.getPoolState();
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        console.log('STATE: ', JSON.stringify(state));
        console.log('liquidity: ', state.liquidity.toString());
        console.log('sqrtPriceX96: ', state.sqrtPriceX96.toString());

        //create a pool Object for SDK transaction
        const LP_POOL = new Pool(
            this.Token0,
            this.Token1,
            this.immutables.fee,
            state.sqrtPriceX96.toString(),
            state.liquidity.toString(),
            state.tick
        )

        // create a position with the pool
        // the position is in-range, specified by the lower and upper tick
        // in this example, we will set the liquidity parameter to a small percentage of the current liquidity
        const position = new Position({
            pool: LP_POOL,
            liquidity: Math.sqrt(amount0 * amount1), //ethers.BigNumber.from(state.liquidity).div(5000).toString(),
            tickLower: nearestUsableTick(state.tick, this.immutables.tickSpacing) - this.immutables.tickSpacing * 2,
            tickUpper: nearestUsableTick(state.tick, this.immutables.tickSpacing) + this.immutables.tickSpacing * 2,
        })


        const { calldata, value } = await NonfungiblePositionManager.addCallParameters(position, {
            slippageTolerance: new Percent(50, 10_000),
            recipient: receiver,
            deadline: deadline,
        });

        let transaction = {
            data: calldata,
            to: NonFungiblePositionManager_ADDRESS,
            value: value,
            from: signer.address,
            maxFeePerGas: MAX_FEE_PER_GAS,
            maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
        }

        await signer.sendTransaction(transaction);

    }

    async decreaseLiquidity(signer, receiver, tokenId, percent) {

        const state = await this.getPoolState();
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        console.log('STATE: ', JSON.stringify(state));
        console.log('liquidity: ', state.liquidity.toString());
        console.log('sqrtPriceX96: ', state.sqrtPriceX96.toString());

        //create a pool Object for SDK transaction
        const LP_POOL = new Pool(
            this.Token0,
            this.Token1,
            this.immutables.fee,
            state.sqrtPriceX96.toString(),
            state.liquidity.toString(),
            state.tick
        )

        const NonFungiblePositionManagerV3 = await ethers.getContractAt("INonfungiblePositionManager", NonFungiblePositionManager_ADDRESS);
        let positionInfo = await NonFungiblePositionManagerV3.positions(tokenId);

        const position = new Position({
            pool: LP_POOL,
            liquidity: state.liquidity.toString(), //ethers.BigNumber.from(state.liquidity).div(5000).toString(),
            tickLower: positionInfo.tickLower,
            tickUpper: positionInfo.tickUpper,
        })


        const { calldata, value } = NonfungiblePositionManager.removeCallParameters(position, {
            tokenId: tokenId,
            liquidityPercentage: new Percent(percent / 100),//TODO
            slippageTolerance: new Percent(50, 10_000),
            deadline: deadline,
            collectOptions: {
                expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(this.Token0, 0),
                expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(this.Token1, 0),
                recipient: receiver,
            },
        });

        let transaction = {
            data: calldata,
            to: NonFungiblePositionManager_ADDRESS,
            value: value,
            from: signer.address,
            maxFeePerGas: MAX_FEE_PER_GAS,
            maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
        }

        await signer.sendTransaction(transaction);

    }

    async increaseLiquidity(signer, receiver, amount0, amount1, tokenId) {

        const state = await this.getPoolState();
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        console.log('STATE: ', JSON.stringify(state));
        console.log('liquidity: ', state.liquidity.toString());
        console.log('sqrtPriceX96: ', state.sqrtPriceX96.toString());

        //create a pool Object for SDK transaction
        const LP_POOL = new Pool(
            this.Token0,
            this.Token1,
            this.immutables.fee,
            state.sqrtPriceX96.toString(),
            state.liquidity.toString(),
            state.tick
        );

        const NonFungiblePositionManagerV3 = await ethers.getContractAt("INonfungiblePositionManager", NonFungiblePositionManager_ADDRESS);
        let positionInfo = await NonFungiblePositionManagerV3.positions(tokenId);

        //tickLower and TickUpper is mock value, which is no problem in this case.
        //if we need to set the correct value, we should fetch the ones from NonFungiblePositionManager contract with given tokenID.
        const position = new Position({
            pool: LP_POOL,
            liquidity: Math.sqrt(amount0 * amount1), //ethers.BigNumber.from(state.liquidity).div(5000).toString(),
            tickLower: positionInfo.tickLower,
            tickUpper: positionInfo.tickUpper,
        })


        const { calldata, value } = NonfungiblePositionManager.addCallParameters(position, {
            slippageTolerance: new Percent(50, 10_000),
            deadline: deadline,
            tokenId: tokenId,
        });

        let transaction = {
            data: calldata,
            to: NonFungiblePositionManager_ADDRESS,
            value: value,
            from: signer.address,
            maxFeePerGas: MAX_FEE_PER_GAS,
            maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
        }

        await signer.sendTransaction(transaction);

    }

    //TODO use Promise.all to improve performance
    async getPoolImmutables() {
        const immutables = {
            factory: await this.PoolV3.factory(),
            token0: await this.PoolV3.token0(),
            token1: await this.PoolV3.token1(),
            fee: await this.PoolV3.fee(),
            tickSpacing: await this.PoolV3.tickSpacing(),
            maxLiquidityPerTick: await this.PoolV3.maxLiquidityPerTick(),
        };
        return immutables;
    }

    async getPoolState() {
        const slot = await this.PoolV3.slot0();
        const PoolState = {
            liquidity: await this.PoolV3.liquidity(),
            sqrtPriceX96: slot[0],
            tick: slot[1],
            observationIndex: slot[2],
            observationCardinality: slot[3],
            observationCardinalityNext: slot[4],
            feeProtocol: slot[5],
            unlocked: slot[6],
        };
        return PoolState;
    }

}


module.exports = {LiquidityManagement};

