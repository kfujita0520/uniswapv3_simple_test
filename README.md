# Liquidity Management for Uniswap V3

There are a few ways to interact with Uniswap V3 protocol for liquidity management.
1. directly interact with NonFungiblePositionManager contract
2. interact through custom smart contract
3. interact through Uniswap SDK

## NonFungiblePositionManager
Usually failed without clear error message. However, decrease Liquidity works
Ex. 
- burn function can only use when the liquidity of given position is 0.
- Tick value should have some restricted logic depending on the pool fee. 
- mint function could not accept specified value set from java script.

## Smart Contract
Work around solution for creating pool or minting
- example smart contract does not work in older version

## SDK
SDK does not have the function to create the pool.
SDK does not work with the latest version of solidity. 

## Reference
https://github.com/Uniswap/docs/tree/main/examples
https://github.com/Uniswap/examples
