'use strict'
const nem = require('nem-sdk').default;
const proxy = "https://cors-anywhere.herokuapp.com/";
const cryptoPaymentTemplateData = {"api": {}, "deposit": {}}
const cryptoPaymentTemplatePaymentData = {
  "time": "",
  "txHash": "",
  "invoiceJpy": 0,
  "lastRate": 0.0000,
  "invoiceAmount": 0.0,
  "receivedJPY": 0.0,
}
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
let password;
const registerPassword = () => {
  ons.notification.prompt({
    title: "パスワード登録",
    messageHTML: "API情報の暗号化に使用するパスワードを登録してください。",
    buttonLabel: "登録",
    animation: "default",
    inputType: "password",
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
    inputType: "password",
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
            ons.notification.toast("エラーが発生しました！パスワードが間違っているか、サーバーとの通信に失敗しているようです。", {timeout: 2000});
            checkPassword();
          }
        }catch{
          password = "";
          modal.hide();
          ons.notification.toast("エラーが発生しました！パスワードが間違っているか、サーバーとの通信に失敗しているようです。", {timeout: 2000});
          checkPassword();
        }
      }
    }
  });
}
const initialProcedure = () => {
  if(! localStorage.cryptoPaymentData){
    registerPassword();
  }else if(JSON.parse(localStorage.cryptoPaymentData).api === {}){
    registerPassword();
  }else{
    checkPassword();
  }
  if(! localStorage.cryptoPaymentHistoryData){
    localStorage.cryptoPaymentHistoryData = "[]";
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
const testAndSaveApi = (async function(){
  var modal = document.querySelector('ons-modal');
  modal.show();
  let exchange = document.getElementById("settingExchange").value;
  let apiKey = document.getElementById("settingApiKey").value.trim();
  let secret = document.getElementById("settingApiSecret").value.trim();
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
      console.error(err);
      modal.hide();
      ons.notification.alert("エラーが発生しました！APIキーかAPIシークレットに誤りがあるか、サーバーに問題が生じています。APIキーとAPIシークレットを再確認の上、リトライしてください。" + err);
    })
    if(flagApi){
      await saveApi(exchange, apiKey, secret).catch((err)=>{
        flagSave = false;
        console.error(err);
        modal.hide();
        ons.notification.alert("エラーが発生しました！ローカルストレージへのAPI情報書き込みに失敗しました。");
      })
      if(flagSave){
        document.getElementById("settingApiKey").value = "";
        document.getElementById("settingApiSecret").value = "";
        modal.hide();
        ons.notification.alert(
          {
            "message": "API情報の登録が完了しました。",
            "title": "成功"
          }
        );
      }
    }
  }
  exchange = "";
  apiKey = "";
  secret = "";
})
const saveApi = async (exchange, apiKey, secret) => {
  let encryptedApiKey = encrypt(apiKey, password);
  let encryptedSecret = encrypt(secret, password);
  let saveApiData = {"apiKey": encryptedApiKey, "secret": encryptedSecret};
  let cryptoPaymentData;
  if(! localStorage.cryptoPaymentData){
    cryptoPaymentData = cryptoPaymentTemplateData;
  }else{
    cryptoPaymentData = JSON.parse(localStorage.cryptoPaymentData);
  }
  cryptoPaymentData.api[exchange] = saveApiData;
  localStorage.cryptoPaymentData = JSON.stringify(cryptoPaymentData);
  encryptedApiKey = "";
  encryptedSecret = "";
  saveApiData = "";
  cryptoPaymentData = "";
}
const checkAndSaveDepositAddress = function () {
  const exchange = document.getElementById("settingExchange").value;
  const currency = document.getElementById("settingCurrency").value;
  let depositAddress;
  let depositMessage;
  let flagAddress = false;
  let flagMessage = false;
  if(currency === "XEM"){
    const rawDepositAddress = document.getElementById("settingDepositAddress").value;
    depositAddress = NemSdkHelper.getAddress(rawDepositAddress);
    depositMessage = document.getElementById("settingDepositMessage").value.trim();
    if (depositAddress.length >= 40) {
      flagAddress = true;
    }else{
      ons.notification.alert("エラーが発生しました！アドレスが不適切です。適切なアドレスを入力してください。");
    }
    if(depositMessage.length > 0){
      flagMessage = true;
    }else{
      ons.notification.alert("エラーが発生しました！メッセージが入力されていません。適切なメッセージを入力してください。");
    }
  }
  if(flagAddress || flagMessage){
    saveDepositAddress(exchange, currency, depositAddress, depositMessage);
  }
}
const saveDepositAddress = async (exchange, currency, depositAddress, depositMessage) => {
  let saveDepositAddressData = {};
  saveDepositAddressData[currency] = {"depositAddress": depositAddress, "depositMessage": depositMessage};
  let cryptoPaymentData;
  if(! localStorage.cryptoPaymentData){
    cryptoPaymentData = cryptoPaymentTemplateData;
  }else{
    cryptoPaymentData = JSON.parse(localStorage.cryptoPaymentData);
  }
  cryptoPaymentData.deposit[exchange] = saveDepositAddressData;
  localStorage.cryptoPaymentData = JSON.stringify(cryptoPaymentData);
  ons.notification.alert(
    {
      "message": "アドレス情報の登録が完了しました。",
      "title": "成功"
    }
  );
  document.getElementById("settingDepositAddress").value = "";
  document.getElementById("settingDepositMessage").value = "";
}
const clearAllSetting = async () => {
  localStorage.removeItem("cryptoPaymentData");
  ons.notification.alert(
    {
      "message": "全ての設定情報を削除しました！",
      "title": "成功"
    }
  );
}
const clearAllHistory = async () => {
  localStorage.removeItem("cryptoPaymentHistoryData");
  ons.notification.alert(
    {
      "message": "全ての履歴情報を削除しました！",
      "title": "完了"
    }
  );
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
const showHistoryTable = () => {
  if(localStorage.cryptoPaymentHistoryData){
    const historyData = JSON.parse(localStorage.cryptoPaymentHistoryData);
    if(historyData.length > 0){
      let tempHtml = "";
      historyData.forEach((element) => {
        tempHtml = tempHtml + "<table><tr><th>" + element.time + "</th>" + "</tr>" + "<tr>" + "<td>" + "請求額" + "</td>" + "<td>" + element.invoiceJpy + "円</td>" + "</tr>" + "<tr>" + "<td>" + "レート" + "</td>" + "<td>" + element.lastRate + "円/XEM</td>" + "</tr>" + "<tr>" + "<td>" + "請求量" + "</td>" + "<td>" + element.invoiceAmount + "XEM</td>" + "</tr>" + "<tr>" + "<td>" + "受取金額" + "</td>" + "<td>" + element.receivedJPY + "円</td>" + "</tr>" + "<tr>" + "<td>" + "ハッシュ" + "</td>" + "<td>" + element.txHash + "</td>" + "</tr>" + "</table>";
      });
      document.getElementById("historyTable").innerHTML = tempHtml;
    }
  }else{
    ons.notification.toast("履歴情報はまだありません。", {timeout: 2000});
    document.getElementById("historyTable").textContent = "";
  }
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
  } else if (page.matches('#history-page')) {
    titleElement.innerHTML = '履歴';
    showHistoryTable();
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
    this.now = new Date();
    this.year = this.now.getFullYear();
    this.month = this.now.getMonth()+1;
    this.date = this.now.getDate();
    this.hour = this.now.getHours();
    this.min = this.now.getMinutes();
    this.sec = this.now.getSeconds();
    this.time = this.year + "/" + this.month + "/" + this.date + " " + this.hour + ":" + this.min + ":" + this.sec;
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
    this.receivedJpy = this.sellResult.info.return.received;
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
                ons.notification.alert(
                  {
                    "message":"着金を確認しました。お支払いありがとうございました。",
                    "title": "成功"
                  }
                );
                const targetSound = document.getElementById("soundUnconfirmed");
                targetSound.play();
                this.txHash = res.meta.hash.data;
                cryptoPaymentTemplatePaymentData.time = this.time;
                cryptoPaymentTemplatePaymentData.txHash = this.txHash;
                cryptoPaymentTemplatePaymentData.invoiceJpy = this.jpyPrice;
                cryptoPaymentTemplatePaymentData.lastRate = this.lastRate;
                cryptoPaymentTemplatePaymentData.invoiceAmount = this.invoiceAmount;
                cryptoPaymentTemplatePaymentData.receivedJPY = this.receivedJpy;
                const tempHistoryData = JSON.parse(localStorage.cryptoPaymentHistoryData);
                tempHistoryData.unshift(cryptoPaymentTemplatePaymentData);
                localStorage.cryptoPaymentHistoryData = JSON.stringify(tempHistoryData);
                console.log(localStorage.cryptoPaymentHistoryData);
                cryptoPaymentTemplatePaymentData.time = "";
                cryptoPaymentTemplatePaymentData.txHash = "";
                cryptoPaymentTemplatePaymentData.invoiceJpy = 0;
                cryptoPaymentTemplatePaymentData.lastRate = 0;
                cryptoPaymentTemplatePaymentData.invoiceAmount = 0;
                cryptoPaymentTemplatePaymentData.receivedJPY = 0;
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
  try{
    await payment.fetchTickerInfo();
    await payment.fetchOrderBookInfo();
  }catch{
    ons.notification.alert("エラーが発生しました！価格、板情報の取得に失敗しました。");
  }
  payment.calculatePayment();
  if(mode === "QrAndExchange"){
    try{
      await payment.sell();
    }catch{
      ons.notification.alert("エラーが発生しました！売却に失敗しました。");
    }
  }
  modal.hide();
  payment.showQr();
  try{
    await payment.receive();
  }catch{
    ons.notification.alert("エラーが発生しました！送金状況のモニターに失敗しました。");
  }
}