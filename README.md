# Liquidity Management for Uniswap V3
Our goal is creating liquidity management module for Uniswap V3. 
As first milestone, we will write a simple test script which performs minting position, adding liquidity, removing liquidity in order. 
There are a few ways to interact with Uniswap V3 protocol for liquidity management.
1. directly interact with NonFungiblePositionManager contract
2. interact through custom smart contract
3. interact through Uniswap SDK

This repository demonstrates example code using smart contract and SDK.

## NonFungiblePositionManager
The most straight forward way. However, user must deeply understand the parameter restriction. 
Since on-chain smart contract does not show clear error message when failed, you will face difficulty to debug or find the solition to move forward.
Here goes a couple of tips, i have faced during the integration.
- burn function can only use when the liquidity of given position is 0.
- Given Tick values must comply with restricted logic depending on the pool fee. 
- minting function failed during its execution with unknown reason.　

Because of the second issue, we could not complete our goal with this approach alone.

## Smart Contract
Set up our own contract to interact with NonFungiblePositionManager.
Once set up is done, it is easier to do the rest of things. 
Please note that we needed to have the newer version of solidity to avoid "stack too deep" erro.

## SDK
Uniswap SDK is the tool to create calldata for NonFungiblePositionManager contract interaction.
SDK will hide the complexity of many parameter restriction of contract and offer easier interface in theory.
It was not as easy as it is expected, and we observed following challenges. But it worked.
- You have to populate SDK specific object for creating calldata.
- SDK does not have the function to create the pool.(At least, not explained in tutorial)

## Reference
https://github.com/Uniswap/docs/tree/main/examples  
https://github.com/Uniswap/examples
