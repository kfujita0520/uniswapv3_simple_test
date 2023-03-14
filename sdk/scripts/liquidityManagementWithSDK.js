// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

const {ethers, upgrades} = require("hardhat");
const {LiquidityManagement} = require('../src/LiquidityManagement.js');

let deployer, lpprovider1, lpprovider2, NonFungiblePositionManagerCont, usdToken, WETH, FactoryV3, PoolV3, fee;

const MIN_TICK = -887272;
const MAX_TICK = 887272;
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; //goerli: 0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6
const NonFungiblePositionManager_ADDRESS = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";//goerli: 0xC36442b4a4522E871399CD717aBDD847Ab11FE88
const UniswapV3Factory_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984"; //goeril: 0x1F98431c8aD98523631AE4a59f267346ea31F984


async function main() {

    await initialSetup();

    //Verify WETH address is bigger value than newly created usdToken value. This is important pre-check for createAndInitializePoolIfNecessary
    //As you have to specify the token in order in its argument parameter.
    if (WETH.address > usdToken.address) {
        console.log("token0 is usdToken, token1 is WETH");//amount0 = usdToken, amount1 = WETH
    } else {
        //console.log("Unexpected status to process in this sccript");
        throw Error('Unexpected status to process in this script')
    }
    let amount0 = ethers.utils.parseEther('750');//usdToken
    let amount1 = ethers.utils.parseEther('0.5');//WETH

    let sqrtPriceX96 = Math.sqrt(amount1 / amount0) * (2 ** 96);
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

    const LiquidityManager = new LiquidityManagement(poolAddress);
    await LiquidityManager.init();

    await LiquidityManager.mintNewPosition(deployer, deployer.address, amount0, amount1);

    let numOfPositions = await NonFungiblePositionManagerCont.balanceOf(deployer.address);
    console.log('numOfPositions: ', numOfPositions);
    let tokenId = await NonFungiblePositionManagerCont.tokenOfOwnerByIndex(deployer.address, 0);
    let positionInfo = await NonFungiblePositionManagerCont.positions(tokenId);
    console.log(positionInfo);


    await LiquidityManager.decreaseLiquidity(deployer, deployer.address, tokenId, 100);

    console.log('remove liquidity');
    positionInfo = await NonFungiblePositionManagerCont.positions(tokenId);
    console.log('liquidity: ', positionInfo.liquidity);

    await LiquidityManager.increaseLiquidity(deployer, deployer.address, amount0, amount1, tokenId);
    console.log('add liquidity');
    positionInfo = await NonFungiblePositionManagerCont.positions(tokenId);
    console.log('liquidity: ', positionInfo.liquidity.toString());
}

async function initialSetup() {
    [deployer, lpprovider1, lpprovider2] = await ethers.getSigners();

    const usdTokenContract = await ethers.getContractFactory("USDToken");
    usdToken = await usdTokenContract.deploy();
    await usdToken.deployed();
    console.log("usdToken deployed to:", usdToken.address);

    WETH = await ethers.getContractAt("IWETH9", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
    //goerli: 0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6
    NonFungiblePositionManagerCont = await ethers.getContractAt("INonfungiblePositionManager", "0xC36442b4a4522E871399CD717aBDD847Ab11FE88");
    //goerli: 0xC36442b4a4522E871399CD717aBDD847Ab11FE88

    await WETH.deposit({from: deployer.address, value: BigInt(5000000000000000000)});
    console.log('deposit complete');

}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
