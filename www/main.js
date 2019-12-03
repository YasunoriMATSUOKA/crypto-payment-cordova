'use strict'
const nem = require('nem-sdk').default;
const proxy = "https://cors-anywhere.herokuapp.com/"
const cryptoPaymentTemplateData = {"api": {}, "deposit": {}}
const cryptoPaymentTemplateHistoryData = [];  //現時点では未使用
const cryptoPaymentTemplatePaymentData = {
  "txHash": "",
  "invoiceJpy": 0,
  "lastRate": 0.0000,
  "invoiceAmount": 0.0,
  "receivedJPY": 0.0,
} //現時点では未使用
let password;
const registerPassword = () => {
  ons.notification.prompt({
    title: "パスワード登録",
    messageHTML: "API情報の暗号化に使用するパスワードを登録してください。",
    buttonLabel: "登録",
    animation: "default",
    callback: (str) => {
      password = str;
      ons.notification.toast("パスワード登録完了しました。", {timeout: 2000});
    }
  });
}
const checkPassword = () => {
  ons.notification.prompt({
    title: "パスワード確認",
    messageHTML: "既に登録済の暗号化されたAPI情報の復号に使用するパスワードを入力してください。",
    buttonLabel: "確認",
    animation: "default",
    callback: async (str) => {
      password = str
      var modal = document.querySelector('ons-modal');
      modal.show();
      if(JSON.parse(localStorage.cryptoPaymentData).api.zaif){
        const apiKey = getApiKey("zaif");
        const secret = getSecret("zaif");
        const exchangeObject = new ccxt.zaif({
          "apiKey": apiKey,
          "secret": secret,
          "proxy": proxy,
        })
        try{
          const result = await exchangeObject.fetchBalance();
          if(result){
            modal.hide();
            ons.notification.toast('パスワードを確認しました。', {timeout: 2000});
          }else{
            password = "";
            modal.hide();
            ons.notification.toast("エラーが発生しました！/nパスワードが間違っているか、/nサーバーとの通信に失敗しているようです。", {timeout: 2000});
            checkPassword();
          }
        }catch{
          password = "";
          modal.hide();
          ons.notification.toast("エラーが発生しました！/nパスワードが間違っているか、/nサーバーとの通信に失敗しているようです。", {timeout: 2000});
          checkPassword();
        }
      }
    }
  });
}
const initialProcedure = () => {
  if(! localStorage.cryptoPaymentData){
    registerPassword();
  }else{
    checkPassword();
  }
}
const encrypt = (message, key) => {
  const encryptedMessage = CryptoJS.AES.encrypt(message, key).toString();
  return encryptedMessage;
}
const decrypt = (encryptedMessage, key) => {
  const decryptedMessage = CryptoJS.AES.decrypt(encryptedMessage, key).toString(CryptoJS.enc.Utf8);
  return decryptedMessage;
}
//API情報の動作検証をして保存
const testAndSaveApi = (async function(){
  var modal = document.querySelector('ons-modal');
  modal.show();
  let exchange = document.getElementById("settingExchange").value;
  let apiKey = document.getElementById("settingApiKey").value;
  let secret = document.getElementById("settingApiSecret").value;
  let flagApi = true;
  let flagSave = true;
  if((! apiKey) || (! secret)){
    modal.hide();
    ons.notification.alert("APIキーとAPIシークレットに値を入力してください。");
    flagApi = false;
  }else{
    const exchangeObject = new ccxt[exchange]({
      apiKey: apiKey,
      secret: secret,
      proxy: proxy,
    });
    const balance = await exchangeObject.fetchBalance().catch((err)=>{
      flagApi = false;
      console.log(err);
      modal.hide();
      ons.notification.alert("エラーが発生しました！\nAPIキーかAPIシークレットに誤りがあるか、\nサーバーに問題が生じています。\nAPIキーとAPIシークレットを再確認の上、リトライしてください。\n" + err);
    })
    if(flagApi){
      console.log("Saving API Info to localStorage.");
      console.log(balance);
      await saveApi(exchange, apiKey, secret).catch((err)=>{
        flagSave = false;
        console.log(err);
        modal.hide();
        ons.notification.alert("エラーが発生しました！\nローカルストレージへのAPI情報書き込みに失敗しました。");
      })
      if(flagSave){
        document.getElementById("settingApiKey").value = "";
        document.getElementById("settingApiSecret").value = "";
        modal.hide();
        ons.notification.alert("API情報の登録が完了しました。");
      }
    }
  }
  exchange = "";
  apiKey = "";
  secret = "";
})
//API情報のlocalStorgeへの保存
const saveApi = async (exchange, apiKey, secret) => {
  let encryptedApiKey = encrypt(apiKey, password);
  console.log(encryptedApiKey);
  let encryptedSecret = encrypt(secret, password);
  console.log(encryptedSecret);
  let saveApiData = {"apiKey": encryptedApiKey, "secret": encryptedSecret};
  console.log(JSON.stringify(saveApiData));
  let cryptoPaymentData;
  if(! localStorage.cryptoPaymentData){
    console.log("localStorage Empty");
    cryptoPaymentData = cryptoPaymentTemplateData;
  }else{
    console.log("localStorage Already Set");
    cryptoPaymentData = JSON.parse(localStorage.cryptoPaymentData);
  }
  console.log(cryptoPaymentData);
  cryptoPaymentData.api[exchange] = saveApiData;
  localStorage.cryptoPaymentData = JSON.stringify(cryptoPaymentData);
  console.log("localStorage.cryptoPaymentData: " + localStorage.cryptoPaymentData);
  encryptedApiKey = "";
  encryptedSecret = "";
  saveApiData = "";
  cryptoPaymentData = "";
}
//取引所への入金アドレス、メッセージのチェック(と保存)
const checkAndSaveDepositAddress = function () {
  const exchange = document.getElementById("settingExchange").value;
  console.log(exchange);
  const currency = document.getElementById("settingCurrency").value;
  console.log(currency);
  let depositAddress;
  let depositMessage;
  let flagAddress = false;
  let flagMessage = false;
  if(currency === "XEM"){
    const rawDepositAddress = document.getElementById("settingDepositAddress").value;
    console.log(rawDepositAddress);
    depositAddress = NemSdkHelper.getAddress(rawDepositAddress);
    console.log(depositAddress);
    depositMessage = document.getElementById("settingDepositMessage").value;
    console.log(depositMessage);
    if (depositAddress.length >= 40) {
      flagAddress = true;
    }else{
      ons.notification.alert("エラーが発生しました！/nアドレスが不適切です。/n適切なアドレスを入力してください。");
    }
    if(depositMessage.length > 0){
      flagMessage = true;
    }else{
      ons.notification.alert("エラーが発生しました！/nメッセージが入力されていません。/n適切なメッセージを入力してください。");
    }
  }
  if(flagAddress || flagMessage){
    console.log(exchange);
    console.log(currency);
    console.log(depositAddress);
    console.log(depositMessage);
    saveDepositAddress(exchange, currency, depositAddress, depositMessage);
  }
}
//取引所への入金情報をlocalStorageへ保存
const saveDepositAddress = async (exchange, currency, depositAddress, depositMessage) => {
  let saveDepositAddressData = {};
  saveDepositAddressData[currency] = {"depositAddress": depositAddress, "depositMessage": depositMessage};
  console.log(saveDepositAddressData);
  let cryptoPaymentData;
  if(! localStorage.cryptoPaymentData){
    cryptoPaymentData = cryptoPaymentTemplateData;
  }else{
    cryptoPaymentData = JSON.parse(localStorage.cryptoPaymentData);
  }
  cryptoPaymentData.deposit[exchange] = saveDepositAddressData;
  localStorage.cryptoPaymentData = JSON.stringify(cryptoPaymentData);
  console.log(localStorage.cryptoPaymentData);
  ons.notification.alert("アドレス情報の登録が完了しました。");
  document.getElementById("settingDepositAddress").value = "";
  document.getElementById("settingDepositMessage").value = "";
}
const clearAllSetting = async () => {
  console.log("clear");
  console.log(localStorage.cryptoPaymentData);
  localStorage.removeItem("cryptoPaymentData");
  ons.notification.alert("全ての設定情報を削除しました！");
}
const getApiKey = (exchange) => {
  const encryptedApiKey = JSON.parse(localStorage.cryptoPaymentData).api[exchange]["apiKey"];
  const apiKey = decrypt(encryptedApiKey, password);
  return apiKey
}
const getSecret = (exchange) => {
  const encryptedSecret = JSON.parse(localStorage.cryptoPaymentData).api[exchange]["secret"];
  const secret = decrypt(encryptedSecret, password);
  return secret;
}
const getDepositAddress = (exchange, currency) => {
  const depositAddress = JSON.parse(localStorage.cryptoPaymentData).deposit[exchange][currency]["depositAddress"];
  return depositAddress;
}
const getDepositMessage = (exchange, currency) => {
  const depositMessage = JSON.parse(localStorage.cryptoPaymentData).deposit[exchange][currency]["depositMessage"];
  return depositMessage;
}

ons.ready(function() {
  console.log("Onsen UI is ready!");
  initialProcedure();
});

document.addEventListener('show', function(event) {
  var page = event.target;
  var titleElement = document.querySelector('#toolbar-title');

  if (page.matches('#home-page')) {
    titleElement.innerHTML = 'ホーム';
  } else if (page.matches('#setting-page')) {
    titleElement.innerHTML = '設定';
  }
});

if (ons.platform.isIPhoneX()) {
  document.documentElement.setAttribute('onsflag-iphonex-portrait', '');
  document.documentElement.setAttribute('onsflag-iphonex-landscape', '');
}

const Payment = class {
  constructor(exchange, currency, jpyPrice){
    this.exchange = exchange;
    this.exchangeClass = ccxt[exchange];
    this.exchangeObject = new this.exchangeClass({
      "apiKey": "dummy",
      "secret": "dummy",
      "proxy": proxy
    });
    this.currency = currency;
    this.jpyPrice = Math.round(jpyPrice);
    this.currencyPair = currency + "/JPY";
    this.tickerConfig = {};
    this.tickerInfo = {};
    this.orderBookInfo = {};
    this.bids = [];
    this.lastRate = 0;
    this.effectiveRate = 0;
    this.invoiceAmount = 0.0;
    this.sellResult = {};
    this.receivedJpy
    this.depositAddress = getDepositAddress(this.exchange, this.currency);
    this.depositMessage = getDepositMessage(this.exchange, this.currency);
    this.invoiceData = "";
    this.txHash = "";
  }
  showLoadingImage(){
    document.getElementById("lastRate").innerHTML = '<ons-icon size="16px" spin icon="md-spinner"></ons-icon>';
    document.getElementById("invoiceAmount").innerHTML = '<ons-icon size="16px" spin icon="md-spinner"></ons-icon>'
  }
  async fetchTickerConfig(){
    //未使用
  }
  async fetchTickerInfo(){
    const jsonResult = await this.exchangeObject.fetchTicker(this.currencyPair);
    this.tickerInfo = jsonResult;
    const stringResult = JSON.stringify(jsonResult);
    console.log(stringResult);
    return jsonResult;
  }
  async fetchOrderBookInfo(){
    const jsonResult = await this.exchangeObject.fetchOrderBook(this.currencyPair);
    this.orderBookInfo = jsonResult;
    const stringResult = JSON.stringify(jsonResult);
    console.log(stringResult);
    return jsonResult;
  }
  calculatePayment(){
    const lastRate = this.tickerInfo.last;
    this.lastRate = lastRate;
    console.log("lastRate:" + this.lastRate);
    document.getElementById("lastRate").textContent = this.lastRate;

    const rawInvoiceAmount = this.jpyPrice / this.lastRate;
    console.log("rawInvoiceAmount:" + rawInvoiceAmount);
    const invoiceAmount = (Math.round(rawInvoiceAmount * 10)) / 10;
    console.log("const invoiceAmount:" + invoiceAmount);
    this.invoiceAmount = invoiceAmount;
    console.log("invoiceAmount:" + this.invoiceAmount);
    document.getElementById("invoiceAmount").textContent = this.invoiceAmount;

    this.bids = this.orderBookInfo.bids;
    let depth = 0;
    for(let i=0; i < this.bids.length; i++){
      depth = depth + this.bids[i][1];
      if(depth > this.invoiceAmount){
        this.effectiveRate = this.bids[i][0]
        console.log("effective rate:" + this.effectiveRate);
        console.log("depth:" + depth);
        break;
      }
    }
  }
  async sell(){
    this.exchangeObject.apiKey = getApiKey(this.exchange);
    this.exchangeObject.secret = getSecret(this.exchange);
    const jsonResult = await this.exchangeObject.createLimitSellOrder (this.currencyPair, this.invoiceAmount, this.effectiveRate);
    this.exchangeObject.apiKey = "";
    this.exchangeObject.secret   = "";
    this.sellResult = jsonResult;
    const stringResult = JSON.stringify(jsonResult);
    console.log(stringResult);
    return jsonResult;
  }
  showQr(){
    const invoiceData = NemSdkHelper.getInvoiceData(this.depositAddress, this.invoiceAmount, this.depositMessage);
    this.invoiceData = invoiceData;
    console.log(invoiceData);
    NemSdkHelper.setInvoiceQrCode("qrInvoice", this.invoiceData);
  }
  async receive(){
    const address = NemSdkHelper.getAddress(this.depositAddress);
    const amount = this.invoiceAmount;
    const intAmount = Math.round(amount * 1000000);
    const message = this.depositMessage;
    const wsNodes = [
      "http://alice7.nem.ninja"
    ];
    const endpointUrl = wsNodes[Math.floor(Math.random() * wsNodes.length)];
    const endpoint = nem.model.objects.create("endpoint")(endpointUrl, nem.model.nodes.websocketPort);
    console.log(JSON.stringify(endpoint));
    const connector = nem.com.websockets.connector.create(endpoint, address);
    console.log(JSON.stringify(connector));
    setTimeout(()=>{
      try{
        connector.close();
        ons.notification.toast("WebSocket通信がタイムアウトしました！リトライしてください。", {timeout: 2000});
        document.getElementById("qrInvoice").textContent = "";
      }catch{
        (error) => {
          console.error(JSON.stringify(error));
          ons.notification.toast(JSON.stringify(error), {timeout: 2000});
        }
      }
    }, 120000);
    connector.connect().then(() => {
      console.log("Connected");
      nem.com.websockets.subscribe.errors(
        connector,
        (res) => {
          console.log("errors", JSON.stringify(res));
        }
      );
      nem.com.websockets.subscribe.account.transactions.unconfirmed(
        connector,
        (res) => {
          console.log("unconfirmed", JSON.stringify(res));
          if (res.transaction.recipient === address) {
            if (nem.utils.format.hexToUtf8(res.transaction.message.payload) === message) {
              if (res.transaction.amount === intAmount) {
                connector.close();
                ons.notification.alert("着金を確認しました。\nお支払いありがとう\nございました。");
                const targetSound = document.getElementById("soundUnconfirmed");
                targetSound.play();
                this.txHash = res.meta.hash.data;
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
}

const executePayment = async (mode) => {
  const exchange = document.getElementById("paymentExchange").value;
  const currency = document.getElementById("paymentCurrency").value;
  const jpyPrice = document.getElementById("paymentJpyPrice").value;
  const payment = new Payment(exchange, currency, jpyPrice);
  payment.showLoadingImage();
  var modal = document.querySelector('ons-modal');
  modal.show();
  await payment.fetchTickerInfo();
  await payment.fetchOrderBookInfo();
  payment.calculatePayment();
  if(mode === "QrAndExchange"){
    await payment.sell();
  }
  modal.hide();
  payment.showQr();
  await payment.receive();
}

const clear = () => {
  document.getElementById("paymentJpyPrice").value = 0;
  document.getElementById("lastRate").textContent = "";
  document.getElementById("invoiceAmount").textContent = "";
}