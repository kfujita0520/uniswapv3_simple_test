// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

const {ethers, upgrades} = require("hardhat");
const { Pool, Position, NonfungiblePositionManager, nearestUsableTick } = require('@uniswap/v3-sdk');
const { Percent, Token, CurrencyAmount } = require('@uniswap/sdk-core');

let deployer, lpprovider1, lpprovider2, NonFungiblePositionManagerCont, usdToken, WETH, FactoryV3, PoolV3, fee;

const MIN_TICK = -887272;
const MAX_TICK = 887272;
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; //goerli: 0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6
const NonFungiblePositionManager_ADDRESS = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";//goerli: 0xC36442b4a4522E871399CD717aBDD847Ab11FE88
const UniswapV3Factory_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984"; //goeril: 0x1F98431c8aD98523631AE4a59f267346ea31F984

const MAX_FEE_PER_GAS = '100000000000';
const MAX_PRIORITY_FEE_PER_GAS = '100000000000';

async function main() {

    await initialSetup();

    //Verify WETH address is bigger value than newly created usdToken value. This is important pre-check for createAndInitializePoolIfNecessary
    //As you have to specify the token in order in its argument parameter.
    if(WETH.address > usdToken.address){
        console.log("token0 is usdToken, token1 is WETH");//amount0 = usdToken, amount1 = WETH
    } else {
        //console.log("Unexpected status to process in this sccript");
        throw Error ('Unexpected status to process in this script')
    }
    let amount0 = ethers.utils.parseEther('750');//usdToken
    let amount1 = ethers.utils.parseEther('0.5');//WETH

    let sqrtPriceX96 = Math.sqrt(amount1 / amount0) * (2**96);
    console.log('sqrtPriceX96', BigInt(sqrtPriceX96));

    fee = 3000;

    //Create new Pool USDToken/ETH with 0.3% fee
    await NonFungiblePositionManagerCont.createAndInitializePoolIfNecessary(usdToken.address, WETH.address, fee, BigInt(sqrtPriceX96));
    //approve two token to be transferred to nonFungilbePositionManager
    await WETH.approve(NonFungiblePositionManagerCont.address, ethers.constants.MaxUint256);
    await usdToken.approve(NonFungiblePositionManagerCont.address, ethers.constants.MaxUint256);

    FactoryV3 = await ethers.getContractAt("IUniswapV3Factory", "0x1F98431c8aD98523631AE4a59f267346ea31F984");
    let poolAddress = await FactoryV3.getPool(usdToken.address, WETH.address, fee);
    console.log("poolAddress: ", poolAddress);


    await WETH.approve(NonFungiblePositionManagerCont.address, ethers.constants.MaxUint256);
    await usdToken.approve(NonFungiblePositionManagerCont.address, ethers.constants.MaxUint256);

    await mintNewPosition(deployer, deployer.address, usdToken.address, WETH.address, poolAddress, amount0, amount1);

    let numOfPositions = await NonFungiblePositionManagerCont.balanceOf(deployer.address);
    console.log('numOfPositions: ', numOfPositions);
    let tokenId = await NonFungiblePositionManagerCont.tokenOfOwnerByIndex(deployer.address, 0);
    let positionInfo = await NonFungiblePositionManagerCont.positions(tokenId);
    console.log(positionInfo);


    await decreaseLiquidity(deployer, deployer.address, usdToken.address, WETH.address, poolAddress, amount0, amount1, tokenId);

    console.log('remove liquidity');
    positionInfo = await NonFungiblePositionManagerCont.positions(tokenId);
    console.log('liquidity: ', positionInfo.liquidity);

}

async function initialSetup(){
    [deployer, lpprovider1, lpprovider2] = await ethers.getSigners();

    const usdTokenContract = await ethers.getContractFactory("USDToken");
    usdToken = await usdTokenContract.deploy();
    await usdToken.deployed();
    console.log("usdToken deployed to:", usdToken.address);

    WETH = await ethers.getContractAt("IWETH9","0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    //goerli: 0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6
    NonFungiblePositionManagerCont = await ethers.getContractAt("INonfungiblePositionManager", "0xC36442b4a4522E871399CD717aBDD847Ab11FE88");
    //goerli: 0xC36442b4a4522E871399CD717aBDD847Ab11FE88

    await WETH.deposit({from: deployer.address, value: BigInt(5000000000000000000)});
    console.log('deposit complete');



}

async function getPoolImmutables(PoolV3) {
    const immutables = {
        factory: await PoolV3.factory(),
        token0: await PoolV3.token0(),
        token1: await PoolV3.token1(),
        fee: await PoolV3.fee(),
        tickSpacing: await PoolV3.tickSpacing(),
        maxLiquidityPerTick: await PoolV3.maxLiquidityPerTick(),
    };
    return immutables;
}

async function getPoolState(PoolV3) {
    const slot = await PoolV3.slot0();
    const PoolState = {
        liquidity: await PoolV3.liquidity(),
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


//TODO add optional parameter for min_tick and max_tick
async function mintNewPosition(signer, receiver, token0Addr, token1Addr, poolAddress, amount0, amount1) {

    const PoolV3 = await ethers.getContractAt("IUniswapV3Pool", poolAddress);
    const immutables = await getPoolImmutables(PoolV3);
    const state = await getPoolState(PoolV3);
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    console.log('STATE: ', JSON.stringify(state));
    console.log('liquidity: ', state.liquidity.toString());
    console.log('sqrtPriceX96: ', state.sqrtPriceX96.toString());

    //TODO fetch decimal value from token contract dynamically
    const Token0 = new Token(1, token0Addr, 18);
    const Token1 = new Token(1, token1Addr, 18);

    //create a pool Object for SDK transaction
    const LP_POOL = new Pool(
        Token0,
        Token1,
        immutables.fee,
        state.sqrtPriceX96.toString(),
        state.liquidity.toString(),
        state.tick
    )

    // create a position with the pool
    // the position is in-range, specified by the lower and upper tick
    // in this example, we will set the liquidity parameter to a small percentage of the current liquidity
    const position = new Position({
        pool: LP_POOL,
        liquidity:  Math.sqrt(amount0 * amount1), //ethers.BigNumber.from(state.liquidity).div(5000).toString(),
        tickLower: nearestUsableTick(state.tick, immutables.tickSpacing) - immutables.tickSpacing * 2,
        tickUpper: nearestUsableTick(state.tick, immutables.tickSpacing) + immutables.tickSpacing * 2,
    })


    const { calldata, value } = await NonfungiblePositionManager.addCallParameters(position, {
        slippageTolerance: new Percent(50, 10_000),
        recipient: receiver,
        deadline: deadline,
    })
    // console.log(value);
    // console.log(calldata);

    let transaction = {
        data: calldata,
        to: NonFungiblePositionManagerCont.address,
        value: value,
        from: signer.address,
        maxFeePerGas: MAX_FEE_PER_GAS,
        maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
    }

    await signer.sendTransaction(transaction);


}

async function decreaseLiquidity(signer, receiver, token0Addr, token1Addr, poolAddress, amount0, amount1, tokenId) {
    const PoolV3 = await ethers.getContractAt("IUniswapV3Pool", poolAddress);
    const immutables = await getPoolImmutables(PoolV3);
    const state = await getPoolState(PoolV3);
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    console.log('STATE: ', JSON.stringify(state));
    console.log('liquidity: ', state.liquidity.toString());
    console.log('sqrtPriceX96: ', state.sqrtPriceX96.toString());

    //TODO fetch decimal value from token contract dynamically
    const Token0 = new Token(1, token0Addr, 18);
    const Token1 = new Token(1, token1Addr, 18);

    //create a pool Object for SDK transaction
    const LP_POOL = new Pool(
        Token0,
        Token1,
        immutables.fee,
        state.sqrtPriceX96.toString(),
        state.liquidity.toString(),
        state.tick
    )


    const position = new Position({
        pool: LP_POOL,
        liquidity: state.liquidity.toString(), //ethers.BigNumber.from(state.liquidity).div(5000).toString(),
        tickLower: nearestUsableTick(state.tick, immutables.tickSpacing) - immutables.tickSpacing * 2,
        tickUpper: nearestUsableTick(state.tick, immutables.tickSpacing) + immutables.tickSpacing * 2,
    })

    const { calldata, value } = NonfungiblePositionManager.removeCallParameters(position, {
        tokenId: tokenId,
        liquidityPercentage: new Percent(1),
        slippageTolerance: new Percent(50, 10_000),
        deadline: deadline,
        collectOptions: {
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(Token0, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(Token1, 0),
            recipient: receiver,
        },
    })

    console.log(value);
    console.log(calldata);

    let transaction = {
        data: calldata,
        to: NonFungiblePositionManagerCont.address,
        value: value,
        from: signer.address,
        maxFeePerGas: MAX_FEE_PER_GAS,
        maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
    }

    await signer.sendTransaction(transaction);

}

async function increaseLiquidity(signer, receiver, token0Addr, token1Addr, poolAddress, amount0, amount1, tokenId) {
    const PoolV3 = await ethers.getContractAt("IUniswapV3Pool", poolAddress);
    const immutables = await getPoolImmutables(PoolV3);
    const state = await getPoolState(PoolV3);
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    console.log('STATE: ', JSON.stringify(state));
    console.log('liquidity: ', state.liquidity.toString());
    console.log('sqrtPriceX96: ', state.sqrtPriceX96.toString());

    //TODO fetch decimal value from token contract dynamically
    const Token0 = new Token(1, token0Addr, 18);
    const Token1 = new Token(1, token1Addr, 18);

    //create a pool Object for SDK transaction
    const LP_POOL = new Pool(
        Token0,
        Token1,
        immutables.fee,
        state.sqrtPriceX96.toString(),
        state.liquidity.toString(),
        state.tick
    )


    const position = new Position({
        pool: LP_POOL,
        liquidity: state.liquidity.toString(), //ethers.BigNumber.from(state.liquidity).div(5000).toString(),
        tickLower: nearestUsableTick(state.tick, immutables.tickSpacing) - immutables.tickSpacing * 2,
        tickUpper: nearestUsableTick(state.tick, immutables.tickSpacing) + immutables.tickSpacing * 2,
    })

    const { calldata, value } = NonfungiblePositionManager.addCallParameters(position, {
        slippageTolerance: new Percent(50, 10_000),
        deadline: deadline,
        tokenId: tokenId,
    });


    let transaction = {
        data: calldata,
        to: NonFungiblePositionManagerCont.address,
        value: value,
        from: signer.address,
        maxFeePerGas: MAX_FEE_PER_GAS,
        maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
    }

    await signer.sendTransaction(transaction);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
