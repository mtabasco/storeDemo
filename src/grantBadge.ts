import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { PromiEvent, TransactionReceipt } from 'web3-core';
import { Biconomy } from '@biconomy/mexa';
import { signTypedData_v4 } from 'eth-sig-util';
import Common, { CustomChain } from '@ethereumjs/common';
import { Transaction as Tx } from '@ethereumjs/tx';
import PLATFORM_SPN_ABI from './contracts/SapienPlatformSPN.json';
import BADGE_STORE_ABI from './contracts/BadgeStore.json';
import axios from 'axios';
import { BN } from 'ethereumjs-util'


// config...
/* const config = {
  POLY_NETWORK_ID: 80001,
  POLY_RPC_PROVIDER: 'https://rpc-mumbai.matic.today',
  POLY_WS_PROVIDER: 'wss://ws-matic-mumbai.chainstacklabs.com',
  POLY_SPN_TOKEN_ADDRESS: '0x8174Ab11EEd70297311f7318a71d9e9f48466Fff', // Mumbai SPN
  POLY_BADGE_STORE_ADDRESS: '0x59cD3d76cC9EA4f626629337664A3CbD78F48474',
  BICONOMY_API_KEY: 'tYSKReKvQ.c2fbc08c-3991-49b8-8ed8-cb945b0e55fe',
  USER_ADDRESS: '0x6A89ab508E8D4c69aEE0b4443f18bC1590AE2023',
  PRIVATE_KEY: 'aff2b7f298394adcd619ee20fdbe9bf1d7a7215c9348bb5a370fdccf7c54253a',
}; */

const config = {
  POLY_NETWORK_ID: 137,
  POLY_RPC_PROVIDER: 'https://matic-mainnet.chainstacklabs.com',
  POLY_SPN_TOKEN_ADDRESS: '0x20f7a3ddf244dc9299975b4da1c39f8d5d75f05a', // mainnet SPN
  POLY_BADGE_STORE_ADDRESS: '0x975dE233452b915219373bFf5A49b1C81cD807eF',
  BICONOMY_API_KEY: 'pQ1Z6RGoB.def61969-2863-4a9b-98a4-d2c50fa2b8a0',
  USER_ADDRESS: '0x6A89ab508E8D4c69aEE0b4443f18bC1590AE2023',
  PRIVATE_KEY: 'aff2b7f298394adcd619ee20fdbe9bf1d7a7215c9348bb5a370fdccf7c54253a',
}; 

// Initialize constants
const domainType = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "verifyingContract", type: "address" },
  { name: "salt", type: "bytes32" },
];
const metaTransactionType = [
  { name: "nonce", type: "uint256" },
  { name: "from", type: "address" },
  { name: "functionSignature", type: "bytes" }
];

const domainData = {
  name: "Sapien Badge Store",
  version: "v3",
  verifyingContract: config.POLY_BADGE_STORE_ADDRESS,
  salt: '0x' + (config.POLY_NETWORK_ID).toString(16).padStart(64, '0')
};

const getSignatureParameters = (web3, signature) => {
  if (!web3.utils.isHexStrict(signature)) {
    throw new Error(
      'Given value "'.concat(signature, '" is not a valid hex string.')
    );
  }
  const r = signature.slice(0, 66);
  const s = '0x'.concat(signature.slice(66, 130));
  const v = '0x'.concat(signature.slice(130, 132));
  let vNum: number = web3.utils.hexToNumber(v);
  if (![27, 28].includes(vNum)) vNum += 27;
  return {
    r: r,
    s: s,
    v: vNum
  };
};

// main
(async () => {

  const biconomy = new Biconomy(new Web3.providers.HttpProvider(config.POLY_RPC_PROVIDER), {
    apiKey: config.BICONOMY_API_KEY,
    debug: true,
  });
  const web3 = new Web3(biconomy);

  biconomy
    .onEvent(biconomy.READY, async () => {
      // Initialize your dapp here like getting user accounts etc
      console.log('Mexa is Ready');
      const contract = new web3.eth.Contract(BADGE_STORE_ABI as AbiItem[], config.POLY_BADGE_STORE_ADDRESS);

      const functionSignature = contract.methods
        .grantBadge('0x7dCE49add48661fAd5f52aE9bF964Da80F33BeFF', 8, 1)
        .encodeABI();

      const nonce = await contract.methods.getNonce(config.USER_ADDRESS).call();

      let message = {
        nonce: web3.utils.toHex(nonce),
        from: config.USER_ADDRESS,
        functionSignature: functionSignature,
      };

      //please refer to SDK front end example for domainType and domainData
      const dataToSign = {
        types: {
          EIP712Domain: domainType,
          MetaTransaction: metaTransactionType
        },
        domain: domainData,
        primaryType: "MetaTransaction",
        message: message
      };

      /*Its important to use eth_signTypedData_v3 and not v4 to get EIP712 
      signature because we have used salt in domain data instead of chainId*/
      const signature = signTypedData_v4(Buffer.from(config.PRIVATE_KEY, 'hex'), { data: dataToSign });
      let { r, s, v } = getSignatureParameters(web3, signature); // same helper used in SDK frontend code
      const executeMetaTransactionData = contract.methods.executeMetaTransaction(config.USER_ADDRESS, functionSignature, r, s, v).encodeABI();

      // Build the transaction
      const txObject = {
        nonce: web3.utils.toHex(nonce),
        to: config.POLY_BADGE_STORE_ADDRESS,
        data: executeMetaTransactionData,
      }

      const common = Common.custom(CustomChain.PolygonMainnet);

      const tx = Tx.fromTxData(txObject, { common });
      const signedTx = tx.sign(Buffer.from(config.PRIVATE_KEY, 'hex'));
      const serializedTx = signedTx.serialize();
      const raw = '0x' + serializedTx.toString('hex');

      console.log(raw);

      web3.eth.sendSignedTransaction(raw)
        .on('transactionHash', (hash: string) => console.log('hash----------', hash))
        .on('receipt', (rec) => console.log('receipt----------', rec))
        .on('error', (err) => console.log('err---------------', err));


    })
    .onEvent(biconomy.ERROR, (error, message) => {
      // Handle error while initializing mexa
      console.error('Error initializing Mexa', error, message);
    });


})();