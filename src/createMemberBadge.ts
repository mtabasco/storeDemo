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
const web3config = {
  wsProvider: 'wss://ws-matic-mumbai.chainstacklabs.com',
  sapienAccount: '--',
  sapienPrivKey: '--',
  spnTokenAddress: '0x8174Ab11EEd70297311f7318a71d9e9f48466Fff',
  badgeStoreAddress: '0xab221c69D8EEcF6aC7944efD4589DA206AE1046C',
};


// main
(async () => {

  const getProvider = () => {
    const provider = new Web3.providers.WebsocketProvider(web3config.wsProvider);
    provider.on('connect', () => console.log('WS Connected!'))
    provider.on('error', () => {
      console.error('WS Error');
    })
    provider.on('end', () => {
      console.error('WS End');
      web3.setProvider(getProvider());
    })

    return provider;
  }
  const web3 = new Web3(getProvider());
  const spnContract = new web3.eth.Contract(PLATFORM_SPN_ABI as AbiItem[], web3config.spnTokenAddress);
  const badgeStoreContract = new web3.eth.Contract(BADGE_STORE_ABI as AbiItem[], web3config.badgeStoreAddress);


  const contractSignature = badgeStoreContract.methods.createBadge('0xeC736346eBf9f995a40006147923CD8Ad7bfb2d7', 0).encodeABI();

  web3.eth.getTransactionCount(web3config.sapienAccount)
    .then(txCount => {
      const txObject = {
        nonce: web3.utils.toHex(txCount),
        gasPrice: 30000000000,
        gasLimit: 300000,
        to: web3config.badgeStoreAddress,
        data: contractSignature
      };

      const common = Common.custom(CustomChain.PolygonMumbai);

      const tx = Tx.fromTxData(txObject, { common });
      const signedTx = tx.sign(Buffer.from(web3config.sapienPrivKey, 'hex'));
      const serializedTx = signedTx.serialize();
      const raw = '0x' + serializedTx.toString('hex');

      web3.eth.sendSignedTransaction(raw)
        .on('transactionHash', (hash: string) => console.log(hash))
        .on('receipt', (rec) => console.log(rec))
        .on('error', (err) => console.log(err));
    });

})();