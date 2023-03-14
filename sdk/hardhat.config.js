require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.9",
      },
      {
        version: "0.7.6",
        settings: {},
      },
    ]
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.MAINNET_ALCHEMY_URL,
        blockNumber: 16749000,
        gas: "auto",
        gasPrice: "auto",
      }
    },

    goerli: {
      url: process.env.GOERLI_ALCHEMY_URL,
      accounts: [process.env.PRIVATE_KEY]
    }

  },
  etherscan: {
    apiKey: {
      goerli: process.env.ETHERSCAN_KEY
    },
    customChains: [
      {
        network: "goerli",
        chainId: 5,
        urls: {
          apiURL: "https://api-goerli.etherscan.io/api",
          browserURL: "https://goerli.etherscan.io"
        }
      }
    ]
  }
};
