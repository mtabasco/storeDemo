import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { Biconomy } from '@biconomy/mexa';
import { toBuffer } from "ethereumjs-util";
import Common, { CustomChain } from '@ethereumjs/common';
import { Transaction as Tx } from '@ethereumjs/tx';
import PLATFORM_SPN from './contracts/SapienPlatformSPN.json';
const abi = require('ethereumjs-abi');


// config...
const config = {
  POLY_NETWORK_ID: 80001,
  POLY_WS_PROVIDER: 'wss://ws-matic-mumbai.chainstacklabs.com',
  POLY_SPN_TOKEN_ADDRESS: '0x8174Ab11EEd70297311f7318a71d9e9f48466Fff', // Mumbai SPN
  BICONOMY_API_KEY: 'tYSKReKvQ.c2fbc08c-3991-49b8-8ed8-cb945b0e55fe',
};

const privateKey = 'bda187d9e6482b03ab0d696f5e33de5e63cc4ab11490498cf5d13c6215c4719c';
const publicAddress = '0x39a1e6759982d5409e1a496c31571A9352CA229E';

// utils...
const constructMetaTransactionMessage = (
  nonce,
  chainId,
  functionSignature,
  contractAddress
) => {
  return abi.soliditySHA3(
    ['uint256', 'address', 'uint256', 'bytes'],
    [nonce, contractAddress, chainId, toBuffer(functionSignature)]
  );
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
      const contract = new web3.eth.Contract(PLATFORM_SPN as AbiItem[], config.POLY_SPN_TOKEN_ADDRESS);

      const functionSignature = contract.methods
        .transfer('0xeC736346eBf9f995a40006147923CD8Ad7bfb2d7', 1000)
        .encodeABI();


      const nonce = await contract.methods.getNonce(publicAddress).call();
      
      //same helper constructMetaTransactionMessage used in SDK front end code
      const messageToSign = constructMetaTransactionMessage(
        nonce,
        config.POLY_NETWORK_ID,
        functionSignature,
        config.POLY_SPN_TOKEN_ADDRESS
      );

      const { signature } = web3.eth.accounts.sign(
        "0x" + messageToSign.toString("hex"),
        privateKey
      );
      console.log('signature...', signature);

      const { r, s, v } = getSignatureParameters(web3, signature); // same helper used in SDK frontend code

      console.log('r,s,v', r, s, v);

      const executeMetaTransactionData = contract.methods
        .executeMetaTransaction(publicAddress, functionSignature, r, s, v)
        .encodeABI();

      console.log('contractSignature', executeMetaTransactionData);


      const txParams = {
        nonce: web3.utils.toHex(nonce),
        to: config.POLY_SPN_TOKEN_ADDRESS,
        data: executeMetaTransactionData,
      };

      const common = Common.custom(CustomChain.PolygonMumbai);

      // Sign the transaction
      const tx = Tx.fromTxData(txParams, { common });
      const signedTx = tx.sign(Buffer.from(privateKey, 'hex'));
      const serializedTx = signedTx.serialize();
      const raw = '0x' + serializedTx.toString('hex');

      web3.eth
        .sendSignedTransaction(raw)
        .once('transactionHash', (hash) => console.log('transactionHash', hash))
        .once('receipt', (rec) => console.log('receipt', rec))
        .once('error', (err) => console.log('error...', err));

    })
    .onEvent(biconomy.ERROR, (error, message) => {
      // Handle error while initializing mexa
      console.error('Error initializing Mexa', error, message);
    });


})();