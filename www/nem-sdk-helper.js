NemSdkHelper = (() => {
  'use strict';
  const nem = require('nem-sdk').default;
  const htmlEscape = (string) => {
    if (typeof string !== 'string') {
      return string;
    }
    return string.replace(/[&'`"<>]/g, function (match) {
      return {
        '&': '&amp;',
        "'": '&#x27;',
        '`': '&#x60;',
        '"': '&quot;',
        '<': '&lt;',
        '>': '&gt;',
      } [match]
    });
  };
  return {
    //NIS1 Node
    //get NIS1 Node List
    getNIS1NodeList: async () => {
      const proxy = "https://cors-anywhere.herokuapp.com/";
      const nis1NodeListUrl = "https://s3-ap-northeast-1.amazonaws.com/xembook.net/data/v4/node.json";
      const url = proxy + nis1NodeListUrl;
      const abortController = new AbortController();
      setTimeout(() => abortController.abort(), 15000);
      const nis1NodeList = await fetch(url, {
          signal: abortController.signal
        })
        .then((res) => {
          return res.json();
        }).then((json) => {
          return json;
        }).catch((error) => {
          console.error(error);
          return {};
        });
      return nis1NodeList;
    },
    //Get NIS1 https Node List
    getNIS1HttpsNodeList: (nis1NodeList) => {
      return nis1NodeList.https;
    },
    //Get NIS1 https random node
    getNIS1HttpsRandomNode: (nis1NodeList) => {
      return nis1NodeList.https[Math.floor(Math.random() * nis1NodeList.https.length)];
    },
    //Get NIS1 https random node url
    getNIS1HttpsRandomNodeUrl: (nis1NodeList) => {
      return nis1NodeList.https[Math.floor(Math.random() * nis1NodeList.https.length)].replace(/:7891/g, "");
    },

    //nem-sdk
    //Validate private key
    isValidPrivateKey: (rawPrivateKey) => {
      const privateKey = htmlEscape(rawPrivateKey).trim();
      return ((privateKey.length === 64 || privateKey.length === 66) && (privateKey.match(/^[0-9a-f]+$/g)[0] === privateKey)) ? true : false;
    },
    //Validate address
    isValidAddress: (rawAddress) => {
      const address = htmlEscape(rawAddress).replace(/-/g, "").trim();
      return nem.model.address.isValid(address) ? true : false;
    },
    //Get validated private key
    getPrivateKey: (rawPrivateKey) => {
      const privateKey = htmlEscape(rawPrivateKey).trim();
      return NemSdkHelper.isValidPrivateKey(privateKey) ? privateKey : "";
    },
    //Get validated address
    getAddress: (rawAddress) => {
      const address = htmlEscape(rawAddress).replace(/-/g, "").trim();
      return NemSdkHelper.isValidAddress(address) ? address : "";
    },
    //Get address from private key
    getAddressFromPrivateKey: (rawPrivateKey) => {
      const privateKey = htmlEscape(rawPrivateKey).trim();
      const keyPair = nem.crypto.keyPair.create(privateKey);
      const publicKey = keyPair.publicKey.toString();
      const address = nem.model.address.toAddress(
        publicKey,
        nem.model.network.data.mainnet.id
      );
      return NemSdkHelper.isValidAddress(address) ? address : "";
    },
    //Get XEM balance
    getXemBalance: async (rawAddress, endpointUrl) => {
      const address = NemSdkHelper.getAddress(rawAddress);
      const endpoint = nem.model.objects.create('endpoint')(endpointUrl, 7891);
      const result = await nem.com.requests.account.data(endpoint, address).then(res => {
        return res;
      }).catch((error) => {
        console.error(error);
      });
      const balance = result.account.balance / 1000000;
      return balance;
    },
    //Get unconfirmed Tx
    getUnconfirmedTx: async (rawAddress, rawMessage, endpointUrl) => {
      const address = NemSdkHelper.getAddress(rawAddress);
      const message = rawMessage
      const endpoint = nem.model.objects.create('endpoint')(endpointUrl, 7890);
      const result = await nem.com.requests.account.transactions.unconfirmed(endpoint, address).then((res) => {
        console.log(JSON.stringify(res));
        return res;
      }).catch((error) => {
        console.error(JSON.stringify(error));
      });
      return result;
    },
    //MonitorUnconfirmedTxWithPolling
    monitorUnconfirmedTxPolling: async (rawAddress, rawMessage, invoiceAmount, endpointUrl) => {
      console.log("monitorUnconfirmedTxPolling start");
      const intAmount = Math.round(invoiceAmount * 10)*100000;
      console.log(intAmount);
      const result = await NemSdkHelper.getUnconfirmedTx(rawAddress, rawMessage, endpointUrl);
      console.log(result);
    },
    //Get all mosaic balance
    getAllBalance: async (rawAddress, endpointUrl) => {
      const address = NemSdkHelper.getAddress(rawAddress);
      const endpoint = nem.model.objects.create('endpoint')(endpointUrl, 7891);
      const results = Promise.all([
        await nem.com.requests.account.mosaics.owned(endpoint, address).then((res) => {
          return res;
        }).catch((error) => {
          console.error(error);
        }),
        await nem.com.requests.account.mosaics.allDefinitions(endpoint, address).then((res) => {
          return res;
        }).catch((error) => {
          console.error(error);
        })
      ]).then((results) => {
        return results;
      }).catch((error) => {
        console.error(error);
      });
      return results;
    },
    //Check the address is not used
    isNotUsedAddress: async (rawAddress, endpointUrl) => {
      const address = NemSdkHelper.getAddress(rawAddress);
      const endpoint = nem.model.objects.create('endpoint')(endpointUrl, 7891);
      const result = await nem.com.requests.account.transactions.all(endpoint, address).then(res => {
        return res;
      }).catch((error) => {
        console.error(error);
      });
      return result.data.length === 0 ? true : false;
    },
    //Send Tx (XEM only, with no encrypted message)
    sendTx: async (rawSenderPrivateKey, rawRecipientAddress, amount, message, endpointUrl) => {
      const senderPrivateKey = NemSdkHelper.getPrivateKey(rawSenderPrivateKey);
      const recipientAddress = NemSdkHelper.getAddress(rawRecipientAddress);
      const transferTx = nem.model.objects.create("transferTransaction")(
        recipientAddress,
        amount,
        message
      );
      const common = nem.model.objects.create("common")("", senderPrivateKey);
      const transactionEntity = nem.model.transactions.prepare("transferTransaction")(
        common,
        transferTx,
        nem.model.network.data.mainnet.id
      );
      const endpoint = nem.model.objects.create("endpoint")(
        endpointUrl,
        7891
      );
      const result = await nem.model.transactions
        .send(common, transactionEntity, endpoint)
        .then((res) => {
          return res;
        })
        .catch((error) => {
          console.error(error);
          return "";
        });
      return result;
    },
    //Get invoice QR Data
    getInvoiceData: (recipientAddress, amount, message) => {
      const json = {
        "data": {
          "addr": "",
          "amount": 0,
          "msg": "",
          "name": "nem-sdk-helper"
        },
        "type": 2,
        "v": 2
      };
      json.data.addr = NemSdkHelper.getAddress(recipientAddress);
      json.data.amount = Math.round(htmlEscape(amount) * 1000000);
      json.data.msg = htmlEscape(message);
      const stringData = JSON.stringify(json);
      return stringData;
    },
    //Set invoice QR Code
    setInvoiceQrCode: (rawElementId, invoiceData) => {
      const elementId = htmlEscape(rawElementId);
      $(() => {
        $(`#${elementId}`).empty();
        $(`#${elementId}`).qrcode({
          width: 256,
          height: 256,
          text: invoiceData
        });
      });
    },
    //When Tx is received this function will be executed.
    txReceiveCallBack: (res) => {
      console.log("hash", res.meta.hash.data);
      console.log("intAmount", res.transaction.amount);
      console.log("amount", res.transaction.amount / 1000000);
      console.log("intFee", res.transaction.fee);
      console.log("fee", res.transaction.fee / 1000000);
      console.log("senderPublicKey", res.transaction.signer);
      console.log("senderAddress", nem.model.address.toAddress(res.transaction.signer, nem.model.network.data.mainnet.id));
      console.log("messagePayload", res.transaction.message);
      console.log("message", nem.utils.format.hexToUtf8(res.transaction.message.payload));
    },
    //Receive Tx (XEM only, with no encrypted message)
    receiveTx: async (rawAddress, rawAmount, rawMessage) => {
      const address = NemSdkHelper.getAddress(rawAddress);
      const amount = htmlEscape(rawAmount);
      const intAmount = Math.round(amount * 1000000);
      const message = htmlEscape(rawMessage);
      const wsNodes = [
        "http://alice7.nem.ninja"
      ];
      const endpointUrl = wsNodes[Math.floor(Math.random() * wsNodes.length)];
      const endpoint = nem.model.objects.create("endpoint")(endpointUrl, nem.model.nodes.websocketPort);
      console.log(JSON.stringify(endpoint));
      const connector = nem.com.websockets.connector.create(endpoint, address);
      console.log(JSON.stringify(connector));
      connector.connect().then(() => {
          console.log("Connected");
          nem.com.websockets.subscribe.errors(
            connector,
            (res) => {
              console.log("errors", res);
            }
          );
          nem.com.websockets.subscribe.account.transactions.unconfirmed(
            connector,
            (res) => {
              console.log("unconfirmed", res);
              if (res.transaction.recipient === address) {
                if (nem.utils.format.hexToUtf8(res.transaction.message.payload) === message) {
                  if (res.transaction.amount === intAmount) {
                    ons.notification.alert("着金を確認しました。\nお支払いありがとう\nございました。");
                    connector.close();
                    NemSdkHelper.txReceiveCallBack(res);
                    document.getElementById("qrInvoice").textContent = "";
                    return res;
                  }
                }
              }
            }
          );
        },
        (error) => {
          console.log(error);
          return error;
        });
    }
  };
})();