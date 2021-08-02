import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { Biconomy } from '@biconomy/mexa';
import { signTypedData_v4 } from 'eth-sig-util';
import Common, { CustomChain } from '@ethereumjs/common';
import { Transaction as Tx } from '@ethereumjs/tx';
import PLATFORM_SPN_ABI from './contracts/SapienPlatformSPN.json';
import BADGE_STORE_ABI from './contracts/BadgeStore.json';
const abi = require('ethereumjs-abi');


// config...
const config = {
  POLY_NETWORK_ID: 80001,
  POLY_WS_PROVIDER: 'wss://ws-matic-mumbai.chainstacklabs.com',
  POLY_SPN_TOKEN_ADDRESS: '0x8174Ab11EEd70297311f7318a71d9e9f48466Fff', // Mumbai SPN
  POLY_BADGE_STORE_ADDRESS: '0xab221c69D8EEcF6aC7944efD4589DA206AE1046C',
  BICONOMY_API_KEY: 'tYSKReKvQ.c2fbc08c-3991-49b8-8ed8-cb945b0e55fe',
  USER_ADDRESS: '0x39a1e6759982d5409e1a496c31571A9352CA229E',
  PRIVATE_KEY: 'bda187d9e6482b03ab0d696f5e33de5e63cc4ab11490498cf5d13c6215c4719c',
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

  let provider;

  const getProvider = () => {
    if (!provider || !provider.connected) {
      provider = new Web3.providers.WebsocketProvider(config.POLY_WS_PROVIDER);
      provider.on('connect', () => console.log('WS Connected!'));
      provider.on('error', () => {
        console.error('WS Error');
      });
      provider.on('end', () => {
        console.error('WS End');
        web3.setProvider(getProvider());
      });
    }
    return provider;
  };

  const biconomy = new Biconomy(getProvider(), {
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
        .purchaseBadge(7, 1)
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

      const common = Common.custom(CustomChain.PolygonMumbai);

      const tx = Tx.fromTxData(txObject, { common });
      const signedTx = tx.sign(Buffer.from(config.PRIVATE_KEY, 'hex'));
      const serializedTx = signedTx.serialize();
      const raw = '0x' + serializedTx.toString('hex');

      console.log(raw);

      /* web3.eth.sendSignedTransaction(raw)
        .once('transactionHash', (hash: string) => console.log(hash))
        .once('receipt', (rec) => console.log(rec))
        .once('error', (err) => console.log(err)); */

    })
    .onEvent(biconomy.ERROR, (error, message) => {
      // Handle error while initializing mexa
      console.error('Error initializing Mexa', error, message);
    });


})();