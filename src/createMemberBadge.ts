import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { Biconomy } from '@biconomy/mexa';
import { signTypedData_v4 } from 'eth-sig-util';
import Common, { CustomChain } from '@ethereumjs/common';
import { Transaction as Tx, TxData } from '@ethereumjs/tx';
import PLATFORM_SPN_ABI from './contracts/SapienPlatformSPN.json';
import BADGE_STORE_ABI from './contracts/BadgeStore.json';
import { BN } from 'ethereumjs-util'
const abi = require('ethereumjs-abi');
const axios = require('axios');


// config...
const web3config = {
  httpProvider: 'https://polygon-rpc.com/',
  sapienAccount: '0x9Ba109487226cB29E54D1FC55f5E55Ebff3f0Bfe',
  sapienPrivKey: '73f40c9501c430890571d62f81fa3647c80801225524283447e68f6b64325cca',
  spnTokenAddress: '0x3Cd92Be3Be24daf6D03c46863f868F82D74905bA',
  badgeStoreAddress: '0x975dE233452b915219373bFf5A49b1C81cD807eF',
};


// main
(async () => {

  const web3 = new Web3(new Web3.providers.HttpProvider(web3config.httpProvider));
  const spnContract = new web3.eth.Contract(PLATFORM_SPN_ABI as AbiItem[], web3config.spnTokenAddress);
  const badgeStoreContract = new web3.eth.Contract(BADGE_STORE_ABI as AbiItem[], web3config.badgeStoreAddress);


  const contractSignature = badgeStoreContract.methods.createBadge('0x9Ba109487226cB29E54D1FC55f5E55Ebff3f0Bfe', 0).encodeABI();

  const gasPrice = await axios.get('https://gasstation-mainnet.matic.network')
  .then(response => response.data?.fastest);

  web3.eth.getTransactionCount(web3config.sapienAccount)
    .then(txCount => {
      const txObject: TxData = {
        nonce: web3.utils.toHex(txCount),
        gasPrice: web3.utils.toWei(new BN(gasPrice), 'gwei').toNumber(),
        gasLimit: 300000,
        to: web3config.badgeStoreAddress,
        data: contractSignature
      };

      const common = Common.custom(CustomChain.PolygonMainnet);

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