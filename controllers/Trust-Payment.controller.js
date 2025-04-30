const axios = require('axios');
const { encryption, decryption } = require('../configurations/Encryption');
const Account = require('../models/Account.model');
const AccountLevel = require('../models/Account-Level.model');
const Pan = require('../models/Pan.model');
const Transaction = require('../models/Transaction.model');
const Fee = require('../models/Fee.model');
const Wallet = require('../models/Wallet.model');
const Country = require('../models/Country.model');
const jwt = require('jsonwebtoken');
const CryptoJS = require('crypto-js');
const { limitCheck, featureCheck, balanceLimitCheck, cardCountryValidation, logError, fetchLocalOrDefaultWalletConditionally } = require('../utils/helpers');
const topupTransactionDataTokenKey = "bac6723rd@#dn#aFw%%Y%VSV"
const moment = require('moment-timezone');
const { confirmTransaction } = require('../utils/thunesHelpers');
const { confirmtransactionAirtime, confirmAirtimeTransactionFixed, createTransactionRangedHelper, createTransactionFixedHelper } = require('../utils/dtOneHelpers');
const countriesIso = require('../utils/countries_iso2.json')
const { sendTemplate } = require('../utils/instaChatbotUtils');
const { formatDecimalNumbersWithLimit } = require('../utils/payerRates');
const trustPaymentCurrencies = require('../utils/trustPaymentCurrenciesWithDecimals.json')
const { sendButtons, sendPhoto, sendMessage } = require('../utils/telegramBotUtils');
const PanModel = require('../models/Pan.model');
const VCCTransactionModel = require('../models/VCC-Transaction.model');
const { encryptDataVCC } = require('../configurations/EncryptionVCC');
const TelegramBotModel = require('../models/TelegramBot.model');
// const { encryption, decryption } = require('../configurations/Encryption');
const secretKeyIntl = process.env.jwtKey;
module.exports.trustpayment = async (req, res) => {
    try {

        // let data = req.body;
        // // if (!req.user) {
        // //     let error = await encryption({
        // //         status: false,
        // //         message: "Unauthorized User!"
        // //     });
        // //     return res.status(401).send(error);
        // // } else {
        // let user = req.user;
        // // let data = await decryption(req.body.data);
        // var { currencyiso3a, amount, pan, expirydate, securitycode } = data
        // if (!currencyiso3a || !amount || !pan || !expirydate || !securitycode) {
        //     let error = await encryption({
        //         status: false,
        //         message: "Something is missing."
        //     });
        //     return res.status(400).send(error);
        // }
        const url = 'https://webservices.securetrading.net/json/';

        // const dataObj = {
        //     alias: `${process.env.WEBSERVICES_USER_ID}`,
        //     version: '1.00',
        //     request: [
        //         {
        //             "accounttypedescription": "ECOM",
        //             "baseamount": "100",
        //             "currencyiso3a": "USD",
        //             // "sitereference": "test_kemitkingdom79109",
        //             "sitereference": "kemitkingdom79110",
        //             "requesttypedescriptions": "THREEDLOOKUP",
        //             // "orderreference": "My_Order_1256",
        //             "pan": "4744770181502742",
        //             "expirydate": "09/2028",
        //             // "securitycode": "348"
        //             // "pan": "4111111111111111",
        //             // "expirydate": "09/2028",
        //             // "securitycode": "123"
        //             // parenttransactionreference: "24-9-80061"
        //         },
        //     ],
        // };

        // const dataObj = {
        //     alias: `${process.env.WEBSERVICES_USER_ID}`,
        //     version: '1.00',
        //     "request": [{
        //         "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        //         "accounttypedescription": "ECOM",
        //         // "acquirerbin": "474477",
        //         "baseamount": "100",
        //         "browsercolordepth": "24",
        //         "browserjavaenabled": "false",
        //         "browserjavascriptenabled": "true",
        //         "browserlanguage": "en",
        //         "browserscreenheight": "864",
        //         "browserscreenwidth": "1536",
        //         "browsertz": "120",
        //         "cachetoken": "eyJkYXRhY2VudGVydXJsIjogImh0dHBzOi8vd2Vic2VydmljZXMuc2VjdXJldHJhZGluZy5uZXQiLCAiY2FjaGV0b2tlbiI6ICI2MC1jNGJmNDAwODFkZjIxYThmZjE1N2JhODU0MjVkZWFlYWNmNmEyMzhkZTcyMWMyM2I2NmM4ODFmMDFlZjM2NTUyIn0=",
        //         "termurl": "https://webhook.site/8e3f413f-1e33-4a31-acf2-d10a19e04556",
        //         "challengewindowsize": "02",
        //         "currencyiso3a": "USD",
        //         "customerip": "192.168.100.226",
        //         "expirydate": "09/2028",
        //         "pan": "4744770181502742",
        //         "requesttypedescription": "THREEDQUERY",
        //         "sitereference": "kemitkingdom79110",
        //         "threedstransactionid": "cfca9c89-5e7d-4d34-846a-7ec0276f4303",
        //         "threedscompind": "Y",
        //         "useragent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        //     }]
        // }

        const dataObj = {
            alias: `${process.env.WEBSERVICES_USER_ID}`,
            version: '1.00',
            "request": [{
                "requesttypedescriptions": ["TRANSACTIONQUERY"],
                "filter": {
                    "sitereference": [{ "value": "kemitkingdom79110" }],
                    // "currencyiso3a": [{ "value": "CHF" }],
                    "transactionreference": [{ "value": "58-70-95953803" }]
                }
            }]
        }
        const headers = {
            'Content-type': 'application/json',
            'Accept': 'application/json',
        };

        const auth = {
            username: `${process.env.WEBSERVICES_USER_ID}`,
            password: 't!dWp?sP3fHX',
        };

        axios.post(url, dataObj, { headers, auth })
            .then(response => {
                res.status(200).send(response.data);
            }).catch(err => {
                console.log(err);
                res.status(500).send(err);
            })

        // }
    } catch (err) {
        console.log(err);
    }
    // let acc = await Account.updateMany({ account_type: "business" }, { $set: { category: "65afab25e1456f79bc5c9358", level: "65bd0761b76b0f9c91a421c7", country_iso_code: "CHE", country: "654c62e241b5836abf0b63a5", country_name: "Switzerland" } })
    // console.log(acc);
}


module.exports.trustpaymentPage = async (req, res) => {

    let iat = Math.floor(Date.now() / 1000)

    // Example data to encode into a JWT

    const payload = {
        "payload": {
            "accounttypedescription": "ECOM",
            "baseamount": "7401",
            "currencyiso3a": "CHF",
            "sitereference": "kemitkingdom79110",
            "requesttypedescriptions": [
                "THREEDQUERY",
                "AUTH"
            ],
            "pan": "5479 8880 0020 5863",
            "expirydate": "02 / 25",
            "securitycode": "333",
            "orderreference": "jackeb777_6J9S2F3X_save_card_tr_1733221913686",
            "billingfirstname": "RENE JEAN-JACQUES",
            "billinglastname": "ELONG DIT BILLE",
            "billingstreet": "AVENUE DES ALPES 125 1820 MONTREUX SUISSE",
            "billingtown": "Montreux",
            "billingcounty": "Switzerland",
            "billingpostcode": "1820",
            "billingcountryiso2a": "CH",
            "billingemail": "jjelong@gmail.com",
            "billingtelephone": "41795396691",
            "billingtelephonetype": "M",
            "customerfirstname": "jackeb777",
            "customermiddlename": "6J9S2F3X",
            "customerlastname": "tr_1733221913686"
        },
        "iat": iat,
        "iss": "jwt@kemitkingdom.com"
    }
    // Secret key used to sign the JWT (keep this secure!)
    const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;

    // Create a JWT

    const header = { "alg": "HS256", "typ": "JWT" };
    const secret = secretKey;
    console.log(payload, secret);

    const token = jwt.sign(payload, secret, { header });
    console.log(token);

    // const token = base64UrlEncode(signature)
    // console.log(iat, token);



    res.send(`
        <html>
        <head>
        </head>
        <body>
        <form id="stform" action="https://webhook.site/28739ff2-a7ac-43f2-be5e-9620b5be499a" method="POST">
        <div id="st-card-number" class="st-card-number"></div>
        <div id="st-expiration-date" class="st-expiration-date"></div>
        <div id="st-security-code" class="st-security-code"></div>
        <input type="checkbox"/>
          <button type="submit" id="st-form__submit" class="st-form__submit">
            Pay securely
          </button>
        </form>
            <script src="https://cdn.eu.trustpayments.com/js/latest/st.js"></script>
            <script>
            (function() {
                var st = SecureTrading({
                    jwt: "${token}",
                    formId: "stform",
                    submitOnError:true
                }); 
                st.Components({startOnLoad: true}); 
            })(); 
            </script>
        </body>
        </html>
    `);
}

async function getExchangeRates(from, to, amount) {
    try {
        if (to != from) {
            let exchangeRate = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`)
            if (exchangeRate.data.success) {
                let rate = exchangeRate.data.result;
                // console.log(rate);
                return rate;
            } else {
                return null;
            }
        } else {
            return amount;
        }
    } catch (err) {
        // console.log(err);
        return amount;
    }
}

async function topUpFeeCalculation(wallet, amount, payment_type) {
    try {
        let feeDetails = await Fee.findOne({ $and: [{ service_name: payment_type }, { account_level: wallet.account.level._id }] })
        if (wallet.currency.code.toLowerCase() == 'usd') {
            let fee = feeDetails.flat_fee;
            if (feeDetails.fee_type == 'percentage') {
                fee = amount * (feeDetails.percentage_fee / 100);
            }
            return formatDecimalNumbersWithLimit(fee, 2);
        } else {
            if (feeDetails.fee_type == 'flat') {
                let fee = await getExchangeRates('USD', wallet.currency.code, feeDetails.flat_fee)
                return fee;
            } else {
                let fee = amount * (feeDetails.percentage_fee / 100);
                return formatDecimalNumbersWithLimit(fee, 2);
            }
        }
    } catch (err) {
        return null
    }
}

module.exports.getTopupByCardFee = async (req, res) => {
    try {
        let wallet_id = req.params.wallet_id;
        let amount = req.params.amount;
        let wallet = await Wallet.findOne({
            $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])
        let feeDetails = await Fee.findOne({ $and: [{ service_name: 'topup_card_payment' }, { account_level: wallet.account.level._id }] })
        // console.log(wallet.account._id, req.user._id);
        if (wallet.account._id.toString() != req.user._id.toString()) {
            let error = await encryption({
                status: false,
                message: "unauthorized."
            });
            return res.status(401).send(error);
        }
        if (!wallet || !feeDetails) {
            let error = await encryption({
                status: false,
                message: "Required information is not correct."
            });
            return res.status(404).send(error);
        }
        if (wallet.currency.code.toLowerCase() == 'usd') {
            let fee = feeDetails.flat_fee;
            if (feeDetails.fee_type == 'percentage') {
                fee = amount * (feeDetails.percentage_fee / 100);
            }
            let ciphertext = await encryption({
                status: "true",
                message: "Topup Fee.",
                feeDetails: formatDecimalNumbersWithLimit(fee)
            })
            res.status(200).send(ciphertext);
        } else {
            if (feeDetails.fee_type == 'flat') {
                let fee = await getExchangeRates('USD', wallet.currency.code, feeDetails.flat_fee)
                let ciphertext = await encryption({
                    status: "true",
                    message: "Topup Fee.",
                    feeDetails: formatDecimalNumbersWithLimit(fee)
                })
                res.status(200).send(ciphertext);
            } else {
                let fee = amount * (feeDetails.percentage_fee / 100);
                let ciphertext = await encryption({
                    status: "true",
                    message: "Topup Fee.",
                    feeDetails: formatDecimalNumbersWithLimit(fee)
                })
                res.status(200).send(ciphertext);
            }
        }
    } catch (err) {
        console.log(err);
        let ciphertext = await encryption({
            status: "false",
            message: "Internal server error.",
        })
        res.status(500).send(ciphertext);
    }
}


// const revesed = "5479888000205863:123:12:13".split(":").reverse().join(":")
// console.log(revesed)
// let payload = {
//     gurhaku: revesed,

// }
// let originalPan = revesed.split(":").reverse().join(":");
// console.log(originalPan)

// let token = jwt.sign(payload, process.env.FRONTEND_KEY, { expiresIn: '2h' });
// console.log(token, "token")
module.exports.initiatTrustPaymentTransaction = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        // let data = req.body
        let { wallet_id, amount, is_card_save, se_shambey } = data;
        let ref = 'tr_' + Date.now().toString();

        if (!wallet_id || !amount || !se_shambey) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing."
            });
            return res.status(404).send(error);
        }

        amount = parseInt(amount);

        let decoded;
        try {
            decoded = jwt.verify(se_shambey, process.env.FRONTEND_KEY);
        } catch (err) {
            console.log(err)
            const error = await encryption({
                status: false,
                message: "Invalid token."
            })
            return res.status(400).send(error);
        }

        let decodedRevesredString = decoded.gurhaku;
        let originalPan = decodedRevesredString.split(":").reverse().join(":");

        let [pan, securitycode, expiry_month, expiry_year] = originalPan.split(":");

        console.log({ pan, securitycode, expiry_month, expiry_year })

        let receiverWallet = await Wallet.findOne({
            $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])

        if (receiverWallet.account._id.toString() != req.user._id.toString()) {
            let error = await encryption({
                status: false,
                message: "Unauthorized."
            });
            return res.status(404).send(error);
        }

        // checking card authentication
        const cardDetails = await cardCountryValidation(pan, receiverWallet.account.country_iso_code)

        if (!cardDetails.valid) {
            const error = await encryption({
                status: false,
                message: "Invalid card."
            })
            return res.status(400).send(error);
        }

        let feeDetails = await topUpFeeCalculation(receiverWallet, amount / 100, 'topup_card_payment');
        let featureChecked = await featureCheck('topup_channel', 'card_payment', receiverWallet.account.level);
        if (featureChecked && feeDetails >= 0) {
            let amountInUSD = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', (amount / 100) - feeDetails))
            let amountInUSDTotal = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', (amount / 100)))
            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account)
            let limitChecked = limitCheck(parseFloat(amountInUSDTotal), receiverWallet.account.level, receiverWallet.account, 'topup')
            if (limitChecked.status && balanceLimitChecked) {
                const receiverTimezone = receiverWallet.account?.timezone || "UTC"
                const receiverCurrentTime = moment().tz(receiverTimezone).format();

                let receiverTransactionObj = {
                    reference_id: ref,
                    type: 'instant',
                    transaction_type: 'credit',
                    service_type: 'topup',
                    payment_type: 'card',
                    status: 'INITIATED',
                    purpose: '',
                    description: 'Topup by Card',
                    currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                    amount: (amount / 100) - feeDetails,
                    is_card_save: is_card_save ? true : false,
                    fee: feeDetails,
                    total: amount / 100,
                    wallet_id: receiverWallet.wallet_id,
                    wallet: receiverWallet._id,
                    account: receiverWallet.account._id,
                    receiver: receiverWallet.account._id,
                    current_balance: receiverWallet.balance.available,
                    timeline: [
                        {
                            status: 'INITIATED',
                            date: receiverCurrentTime,
                        }
                    ]
                }

                Transaction.create(receiverTransactionObj).then(async (transaction) => {

                    let iat = Math.floor(Date.now() / 1000);
                    const payload = generatePayload(amount / 100, receiverWallet, { pan, securitycode, expirydate: `${expiry_month}/${expiry_year}` }, transaction, iat, false, false, false);
                    console.log({ payload })
                    const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
                    const token = jwt.sign(payload, secretKey, { header: { "alg": "HS256", "typ": "JWT" } });

                    let response = {
                        status: "true",
                        message: "Transaction initiated successfully.",
                        currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                        transaction_id: transaction._id,
                        transaction_ref: transaction.reference_id,
                        token,
                    }

                    let ciphertext = await encryption(response);
                    res.status(200).send(ciphertext);
                }).catch(async (err) => {
                    // console.log(err);
                    let ciphertext = await encryption({
                        status: "false",
                        message: "Transaction failed.",
                        error: err
                    })
                    res.status(400).send(ciphertext);
                })
            } else {
                if (!limitChecked.status && balanceLimitChecked) {
                    let error = await encryption(limitChecked)
                    res.status(400).send(error)
                }
                if (limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption({
                        status: false,
                        code: 'ble400',
                        message: "Balance limit exceeded"
                    })
                    res.status(400).send(error)
                }
                if (!limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption(limitChecked)
                    res.status(400).send(error)
                }
            }
        } else {
            let error = await encryption({
                status: false,
                message: "This service is not allowed."
            })
            res.status(400).send(error)
        }

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

async function getExchangeRatesToUSD(from, to, amount) {
    try {
        if (to != from) {
            let exchangeRate = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`)
            if (exchangeRate.data.success) {
                let rate = exchangeRate.data.result;
                // console.log(rate);
                return rate;
            } else {
                return null;
            }
        } else {
            return amount;
        }
    } catch (err) {
        // console.log(err);
        return amount;
    }
}

module.exports.trustPaymentConfirmation = async (req, res) => {
    try {
        // console.log(req.body);
        let transaction_id = req.params.transaction_id;
        let transactionDetails = await Transaction.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] });
        // console.log(transactionDetails, "transactionDetails");
        if (!transactionDetails) {
            await logError(
                "Transaction not found",
                "topup_trust_payment",
                null,
                transaction_id,
                { routeParams: req.params }
            )
            return res.redirect('https://my.insta-pay.ch/add-funds/card/error/null')
        }
        // var { token, wallet_id } = data
        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])
        // console.log(receiverWallet, "receiverWallet");
        if (!receiverWallet) {
            await logError(
                "Receiver wallet not found or inactive",
                "topup_trust_payment",
                receiverWallet?.account?._id,
                transaction_id,
            );
            return res.redirect('https://my.insta-pay.ch/add-funds/card/error/null')
        }

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "topup_trust_payment",
                receiverWallet?.account?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${req.body.errorcode}`);
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        jwt.verify(token, secretKey, async function (err, data) {
            if (err) {
                await logError(
                    "JWT verification error",
                    "topup_trust_payment",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { jwtError: err }
                );
                console.log(err, "err in jwt");
                transactionDetails.timeline.push({
                    status: 'PENDING',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'PENDING'
                await transactionDetails.save();
                return res.redirect('https://my.insta-pay.ch/add-funds/card/error/null');
            }
            console.log(data.payload, "data.payload");
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }

                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        res.redirect('https://my.insta-pay.ch/add-funds/card/success')
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error",
                                            "topup_trust_payment",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'PENDING',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'PENDING'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed",
                                        "topup_trust_payment",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'PENDING',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'PENDING'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance: ${err.message}`,
                                    "topup_trust_payment",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'PENDING',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'PENDING'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error`,
                                "topup_trust_payment",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0"`,
                            "topup_trust_payment",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                        "topup_trust_payment",
                        receiverWallet?.account?._id,
                        transaction_id,
                        value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {

                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        res.redirect('https://my.insta-pay.ch/add-funds/card/success')
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error 2",
                                            "topup_trust_payment",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'PENDING',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'PENDING'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed 2",
                                        "topup_trust_payment",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'PENDING',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'PENDING'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance 2: ${err.message}`,
                                    "topup_trust_payment",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'PENDING',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'PENDING'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error 2`,
                                "topup_trust_payment",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2`,
                            "topup_trust_payment",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                        "topup_trust_payment",
                        receiverWallet?.account?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2`,
                    "topup_trust_payment",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );

                let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                await transactionDetails.save();
                res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
            }
        })
    } catch (err) {
        await logError(
            err,
            "topup_trust_payment",
            null,
            req.params?.transaction_id || null,
        );
        // let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null}`)
    }

}

module.exports.initiatKYCTrustPaymentTransaction = async (req, res) => {
    try {
        // let data = req.body
        let data = await decryption(req.body.data);
        let user = req.user;
        // console.log(user);
        let { is_card_save, se_shambey } = data;

        let decoded;
        try {
            decoded = jwt.verify(se_shambey, process.env.FRONTEND_KEY);
        } catch (err) {
            console.log(err);
            const error = await encryption({
                status: false,
                message: "Invalid token."
            });
            return res.status(400).send(error);
        }

        let decodedRevesredString = decoded.gurhaku;
        let originalPan = decodedRevesredString.split(":").reverse().join(":");
        let [pan, securitycode, expiry_month, expiry_year] = originalPan.split(":");

        console.log({ pan, securitycode, expiry_month, expiry_year });

        let ref = 'tr_' + Date.now().toString();
        let countryDetails = await Country.findOne({ _id: user.country }, { status: true, kyc_fee: true, country_iso_code: true })
        let accountFound = await Account.findOne({ _id: req.user._id, kyc_verification_paid: true });
        if (accountFound) {
            let error = await encryption({
                status: true,
                message: "Payment already done!"
            });
            return res.status(200).send(error);
        }
        if (!countryDetails || countryDetails.status !== "active" || !countryDetails.kyc_fee) {
            let error = await encryption({
                status: false,
                message: "Unable to process payment in this country!"
            });
            return res.status(400).send(error);
        }

        console.log({ countryDetails })

        // checking card authentication
        const cardDetails = await cardCountryValidation(pan, countryDetails.country_iso_code)

        console.log({ cardDetails, iso: countryDetails.country_iso_code, pan })
        if (!cardDetails.valid) {
            const error = await encryption({
                status: false,
                message: "Invalid card."
            })
            return res.status(400).send(error);
        }

        const receiverTimezone = user?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();
        const defaultWallet = await fetchLocalOrDefaultWalletConditionally(user._id);

        let receiverTransactionObj = {
            reference_id: ref,
            type: 'instant',
            transaction_type: 'debit',
            service_type: 'kyc_verification',
            payment_type: 'card',
            status: 'INITIATED',
            purpose: '',
            description: 'KYC verification fee payment by card',
            currency: { code: 'USD', symbol: '$' },
            amount: countryDetails.kyc_fee,
            is_card_save: is_card_save ? true : false,
            fee: 0,
            total: countryDetails.kyc_fee,
            account: user._id,
            timeline: [
                {
                    status: 'INITIATED',
                    date: receiverCurrentTime,
                }
            ]
        }
        // console.log(receiverTransactionObj);
        Transaction.create(receiverTransactionObj).then(async (transaction) => {
            let iat = Math.floor(Date.now() / 1000);
            const payload = generatePayload(countryDetails.kyc_fee, defaultWallet, { pan, securitycode, expirydate: `${expiry_month}/${expiry_year}` }, transaction, iat, false, true, false);
            const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
            const token = jwt.sign(payload, secretKey, { header: { "alg": "HS256", "typ": "JWT" } });

            let response = {
                status: "true",
                message: "Transaction initiated successfully.",
                currency: { code: 'USD', symbol: '$' },
                transaction_id: transaction._id,
                transaction_ref: transaction.reference_id,
                token,
            }
            let ciphertext = await encryption(response)
            res.status(200).send(ciphertext);
        }).catch(async (err) => {
            console.log(err);
            let ciphertext = await encryption({
                status: "false",
                message: "Transaction failed.",
                error: err
            })
            res.status(400).send(ciphertext);
        })

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.trustPaymentKYCConfirmation = async (req, res) => {
    try {
        console.log('kyc_card', req.body);
        // let data = await decryption(req.body.data)
        let transaction_id = req.params.transaction_id;
        let transactionDetails = await Transaction.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] }).populate([{ path: 'account', populate: (['level']) }]);
        console.log(transactionDetails);
        if (!transactionDetails) {
            await logError(
                "Transaction not found",
                "kyc_trust_payment",
                null,
                transaction_id,
                { routeParams: req.params }
            )
            return res.redirect('https://my.insta-pay.ch/settings?tab=verification&status=failed&code=null')
        }
        const receiverTimezone = transactionDetails.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "kyc_trust_payment",
                transactionDetails?.account?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            return res.redirect(`https://my.insta-pay.ch/settings?tab=verification&status=failed&code=${req.body.errorcode}`);
        }
        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        jwt.verify(token, secretKey, async function (err, data) {
            if (err) {
                await logError(
                    "JWT verification error",
                    "kyc_trust_payment",
                    transactionDetails?.account?._id,
                    transaction_id,
                    { jwtError: err }
                );
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'FAILED'
                await transactionDetails.save();
                return res.redirect('https://my.insta-pay.ch/settings?tab=verification&status=failed&code=null');
            }
            console.log(data.payload.response);
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: transactionDetails.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            Account.updateOne({ _id: transactionDetails.account._id }, { $set: { "kyc_verification_paid": true } }).then(async (accountDetails) => {
                                if (accountDetails.acknowledged && accountDetails.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        res.redirect('https://my.insta-pay.ch/settings?tab=verification&status=success')
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error",
                                            "kyc_trust_payment",
                                            transactionDetails?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'PENDING',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'PENDING'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/settings?tab=verification&status=failed&code=${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed",
                                        "kyc_trust_payment",
                                        transactionDetails?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'PENDING',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'PENDING'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/settings?tab=verification&status=failed&code=${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance: ${err.message}`,
                                    "kyc_trust_payment",
                                    transactionDetails?.account?._id,
                                    transaction_id
                                )
                                transactionDetails.timeline.push({
                                    status: 'PENDING',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'PENDING'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/settings?tab=verification&status=failed&code=${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error`,
                                "kyc_trust_payment",
                                transactionDetails?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/settings?tab=verification&status=failed&code=null`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0"`,
                            "kyc_trust_payment",
                            transactionDetails?.account?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/settings?tab=verification&status=failed&code=${errorCode}`)
                    }
                }
                else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                        "kyc_trust_payment",
                        transactionDetails?.account?._id,
                        transaction_id,
                        value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed`)
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {
                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: transactionDetails.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            Account.updateOne({ _id: transactionDetails.account._id }, { $set: { "kyc_verification_paid": true } }).then(async (accountDetails) => {
                                if (accountDetails.acknowledged && accountDetails.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        res.redirect('https://my.insta-pay.ch/settings?tab=verification&status=success')
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error 2",
                                            "kyc_trust_payment",
                                            transactionDetails?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        tra
                                        transactionDetails.timeline.push({
                                            status: 'PENDING',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'PENDING'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/settings?tab=verification&status=failed&code=${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed 2",
                                        "kyc_trust_payment",
                                        transactionDetails?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'PENDING',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'PENDING'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/settings?tab=verification&status=failed&code=${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance 2: ${err.message}`,
                                    "kyc_trust_payment",
                                    transactionDetails?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'PENDING',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'PENDING'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/settings?tab=verification&status=failed&code=${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error 2`,
                                "kyc_trust_payment",
                                transactionDetails?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/settings?tab=verification&status=failed&code=null`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2`,
                            "kyc_trust_payment",
                            transactionDetails?.account?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/settings?tab=verification&status=failed&code=${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                        "kyc_trust_payment",
                        transactionDetails?.account?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/settings?tab=verification&status=failed&code=${errorCode}`)
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2`,
                    "kyc_trust_payment",
                    transactionDetails?.account?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );
                let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                await transactionDetails.save();
                res.redirect('https://my.insta-pay.ch/settings?tab=verification&status=failed&code=null')
            }
        })
    } catch (err) {
        await logError(
            err,
            "kyc_trust_payment",
            null,
            req.params?.transaction_id || null,
        );
        // let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect('https://my.insta-pay.ch/add-funds/card/failed/null')
    }
}

// module.exports.initiatTrustPaymentTransactionWithSaveCard = async (req, res) => {
//     try {
//         // let data = req.body
//         let data = await decryption(req.body.data)
//         var { wallet_id, amount, payment_type, pan } = data;
//         let ref = 'tr_' + Date.now().toString();
//         if (!wallet_id || !amount || !payment_type || !pan) {
//             let error = await encryption({
//                 status: false,
//                 message: "Required fields are missing."
//             });
//             return res.status(404).send(error);
//         }

//         let receiverWallet = await Wallet.findOne({
//             $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
//                 $or: [
//                     { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
//                     { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
//                     { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
//                     { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
//                 ]
//             }]
//         }).populate([{ path: 'account', populate: (['level']) }])
//         // console.log(receiverWallet.account._id, req.user._id);
//         if (receiverWallet.account._id.toString() != req.user._id.toString()) {
//             let error = await encryption({
//                 status: false,
//                 message: "Unauthorized."
//             });
//             return res.status(404).send(error);
//         }
//         let panDetails = await Pan.findOne({ $and: [{ _id: pan }, { account: receiverWallet.account._id }] })
//         if (!panDetails) {
//             let error = await encryption({
//                 status: false,
//                 message: "Invalid Card Details."
//             });
//             return res.status(404).send(error);
//         }
//         let bytes = await CryptoJS.AES.decrypt(panDetails.panData, process.env.PAN_ENCRYPTION_KEY);
//         let panDataObj = bytes.toString(CryptoJS.enc.Utf8);
//         let amountInUSD = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount)

//         // console.log(receiverWallet.currency);
//         let feeDetails = await topUpFeeCalculation(receiverWallet, amount, 'topup_card_payment')

//         let featureChecked = await featureCheck('topup_channel', 'card_payment', receiverWallet.account.level)
//         // console.log(amountInUSD);
//         if (featureChecked && feeDetails >= 0) {
//             let amountInUSD = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount)
//             // console.log(amountInUSD);
//             let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account)
//             let limitChecked = await limitCheck(parseFloat(amountInUSD), receiverWallet.account.level, receiverWallet.account, 'topup')
//             // console.log(limitChecked);
//             if (limitChecked.status && balanceLimitChecked) {
//                 const url = 'https://webservices.securetrading.net/json/';
//                 const dataObj = {
//                     alias: `${process.env.WEBSERVICES_USER_ID}`,
//                     version: '1.00',
//                     "request": [{
//                         "currencyiso3a": receiverWallet.currency.code,
//                         "requesttypedescriptions": ["AUTH"],
//                         "sitereference": `${process.env.SITE_REFERENCE}`,
//                         "baseamount": (amount * 100).toString(),
//                         "orderreference": `${receiverWallet.wallet_id.toString()}_${ref}`,
//                         "accounttypedescription": "ECOM",
//                         "pan": "4744770181502742",
//                         "expirydate": "09/2028",
//                         "securitycode": "348"
//                     }]
//                 }
//                 const headers = {
//                     'Content-type': 'application/json',
//                     'Accept': 'application/json',
//                 };

//                 const auth = {
//                     username: `${process.env.WEBSERVICES_USER_ID}`,
//                     password: `${process.env.WEBSERVICES_PASSWORD}`,
//                 };
//                 // console.log(dataObj);
//                 axios.post(url, dataObj, { headers, auth })
//                     .then(async (response) => {
//                         console.log(response.data.response);
//                         if (response.data?.response?.length) {
//                             if (response.data.response[0].errorcode == '0') {

//                                 const receiverTimezone = receiverWallet.account?.timezone || "UTC"
//                                 const receiverCurrentTime = moment().tz(receiverTimezone).format();

//                                 let receiverTransactionObj = {
//                                     reference_id: ref,
//                                     type: 'trust_payment',
//                                     transaction_type: 'credit',
//                                     service_type: 'topup',
//                                     payment_type: 'card',
//                                     status: 'INITIATED',
//                                     purpose: '',
//                                     description: 'Topup by Card',
//                                     external_reference: response.data.response[0]?.transactionreference,
//                                     currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
//                                     amount: amount - feeDetails,
//                                     fee: feeDetails,
//                                     total: amount,
//                                     wallet_id: receiverWallet.wallet_id,
//                                     wallet: receiverWallet._id,
//                                     account: receiverWallet.account._id,
//                                     receiver: receiverWallet.account._id,
//                                     current_balance: receiverWallet.balance.available,
//                                     timeline: [
//                                         {
//                                             status: 'INITIATED',
//                                             date: receiverCurrentTime,
//                                         }
//                                     ]
//                                 }

//                                 Transaction.create(receiverTransactionObj).then(async (transaction) => {
//                                     let receiverBalance = receiverWallet.balance.available + transaction.amount;
//                                     Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
//                                         if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
//                                             let transactionUpdt = await Transaction.updateOne({ _id: transaction._id }, { $set: { status: 'COMPLETED', external_reference: response.data?.response[0]?.transactionreference } })
//                                             // console.log(transactionUpdt);
//                                             if (transactionUpdt?.modifiedCount == 1) {

//                                                 let ciphertext = await encryption({
//                                                     status: "true",
//                                                     message: "Transaction completed successfully.",
//                                                     transaction_id: transaction._id,
//                                                     transaction_ref: transaction.reference_id
//                                                 })
//                                                 res.status(200).send(ciphertext);
//                                             } else {
//                                                 let ciphertext = await encryption({
//                                                     status: "true",
//                                                     message: "Transaction pending.",
//                                                     transaction_id: transaction._id,
//                                                     transaction_ref: transaction.reference_id
//                                                 })
//                                                 res.status(200).send(ciphertext);
//                                             }
//                                         } else {
//                                             let ciphertext = await encryption({
//                                                 status: "true",
//                                                 message: "Transaction pending.",
//                                                 transaction_id: transaction._id,
//                                                 transaction_ref: transaction.reference_id
//                                             })
//                                             res.status(200).send(ciphertext);
//                                         }
//                                     }).catch(async (err) => {
//                                         let ciphertext = await encryption({
//                                             status: "true",
//                                             message: "Transaction pending.",
//                                             transaction_id: transaction._id,
//                                             transaction_ref: transaction.reference_id
//                                         })
//                                         res.status(200).send(ciphertext);
//                                     })
//                                 }).catch(async (err) => {
//                                     // console.log(err);
//                                     let ciphertext = await encryption({
//                                         status: "false",
//                                         message: "Transaction failed.",
//                                         error: err
//                                     })
//                                     res.status(400).send(ciphertext);
//                                 })
//                             } else {
//                                 let ciphertext = await encryption({
//                                     status: "false",
//                                     errorcode: response.data.response[0].errorcode,
//                                     message: "Transaction failed.",
//                                     error: err
//                                 })
//                                 res.status(400).send(ciphertext);
//                             }
//                         } else {
//                             let ciphertext = await encryption({
//                                 status: "false",
//                                 errorcode: response.data.response[0].errorcode,
//                                 message: "Transaction failed.",
//                                 error: err
//                             })
//                             res.status(400).send(ciphertext);
//                         }
//                     }).catch(async (err) => {
//                         // console.log(err);
//                         let ciphertext = await encryption({
//                             status: "false",
//                             message: "Transaction failed.",
//                             error: err
//                         })
//                         res.status(400).send(ciphertext);
//                     })
//             } else {
//                 if (!limitChecked.status && balanceLimitChecked) {
//                     let error = await encryption(limitChecked)
//                     res.status(400).send(error)
//                 }
//                 if (limitChecked.status && !balanceLimitChecked) {
//                     let error = await encryption({
//                         status: false,
//                         code: 'ble400',
//                         message: "Balance limit exceeded"
//                     })
//                     res.status(400).send(error)
//                 }
//                 if (!limitChecked.status && !balanceLimitChecked) {
//                     let error = await encryption(limitChecked)
//                     res.status(400).send(error)
//                 }
//             }
//         } else {
//             let error = await encryption({
//                 status: false,
//                 message: "This service is not allowed."
//             })
//             res.status(400).send(error)
//         }

//     } catch (err) {
//         console.log(err);
//         let error = await encryption({
//             status: false,
//             message: "Internal server error!"
//         })
//         res.status(500).send(error)
//     }
// }

function changeDateFormat(dateStr) {
    if (!dateStr) {
        return dateStr
    }
    const [day, month, year] = dateStr.split('-');
    return `${year}-${month}-${day}`;
}

function generatePayload(amount, receiverWallet, panDataObj, transaction, iat, savedCard, kyc, isBot, guestPayDOB) {
    let currency
    if (transaction?.cardNo) {
        currency = transaction.currency
    } else {
        currency = kyc ? "USD" : receiverWallet.currency.code;
    }
    const decimalPlaces = trustPaymentCurrencies[currency] === 0 ? 0 : 2;

    const formattedAmount = parseFloat(amount).toFixed(decimalPlaces);
    return {
        "payload": {
            "accounttypedescription": "ECOM",
            "mainamount": formattedAmount,
            "currencyiso3a": currency,
            "accountfunding": "1",
            "transactiontypeindicator": "F07",
            "sitereference": `${process.env.SITE_REFERENCE}`,
            "requesttypedescriptions": ["THREEDQUERY", "AUTH"],
            "pan": panDataObj.pan,
            "expirydate": panDataObj.expirydate,
            "securitycode": panDataObj.securitycode,
            "orderreference": `${receiverWallet?.account?.username}_${transaction?.cardNo || receiverWallet.wallet_id}_${kyc ? "kyc" : savedCard ? "saved_card" : "new_card"}_${transaction?.reference_id || transaction?.transactionId}`,
            "billingfirstname": receiverWallet?.account?.first_name || "",
            "billinglastname": receiverWallet?.account?.last_name || "",
            "billingstreet": receiverWallet?.account?.address || "",
            "billingtown": receiverWallet?.account?.city || "",
            "billingcounty": receiverWallet?.account?.country_name || "",
            "billingpostcode": receiverWallet?.account?.postal_code || "",
            "billingcountryiso2a": `${countriesIso[receiverWallet?.account?.country_iso_code] || "CH"}`,
            "billingdob": changeDateFormat(guestPayDOB) || changeDateFormat(receiverWallet?.account?.dob) || "",
            "billingpremise": isBot ? `bot_${isBot}` : "web",
            "customeraccountnumber": transaction?.cardNo || receiverWallet.wallet_id,
            "customeraccountnumbertype": `ACCOUNT`,
            "customercountryiso2a": `${countriesIso[receiverWallet?.account?.country_iso_code] || "CH"}`,
            "billingemail": receiverWallet?.account?.email || "",
            "billingtelephone": receiverWallet?.account?.phone || "",
            "billingtelephonetype": "M",
            "customerfirstname": receiverWallet?.account?.username || "",
            "customermiddlename": receiverWallet?.wallet_id || "",
            "customerlastname": transaction?.reference_id || transaction?.transactionId || "",
            "customerstreet": transaction?.guest_details?.name || undefined,
            // "customertown": receiverWallet?.account?.city || undefined,
            // "customercountryiso2a": `${countriesIso[receiverWallet?.account?.country_iso_code] || "CH"}` || undefined,
            // "customerpostcode": receiverWallet?.account?.postal_code || undefined,
            "customeremail": transaction?.guest_details?.email || undefined,
            "customertelephone": transaction?.guest_details?.phone || undefined,
            // "customertelephonetype": "M",
        },
        "iat": iat,
        "iss": `${process.env.JWT_USER}`
    };
}

module.exports.initiatTrustPaymentKYCTransactionWithSaveCard = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        // let data = req.body
        let { pan } = data;
        let user = req.user;

        if (!pan) {
            const error = await encryption({
                status: false,
                message: "Card details (PAN) are missing."
            });
            return res.status(400).send(error);
        }

        let panDetails = await Pan.findOne({ $and: [{ _id: pan }, { account: user._id }] })
        if (!panDetails) {
            let error = await encryption({
                status: false,
                message: "Invalid Card Details."
            });
            return res.status(404).send(error);
        }

        let bytes = CryptoJS.AES.decrypt(panDetails.panData, process.env.PAN_ENCRYPTION_KEY);
        let panDataObj = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

        let ref = "tr_" + Date.now().toString();

        let countryDetails = await Country.findOne(
            { _id: user.country },
            { status: true, kyc_fee: true }
        );
        let accountFound = await Account.findOne({
            _id: user._id,
            kyc_verification_paid: true,
        });

        if (accountFound) {
            const error = await encryption({
                status: true,
                message: "Payment already completed."
            });
            return res.status(200).send(error);
        }

        if (!countryDetails || countryDetails.status !== "active" || !countryDetails.kyc_fee) {
            const error = await encryption({
                status: false,
                message: "Unable to process payment for this country."
            });
            return res.status(400).send(error);
        }

        const receiverTimezone = user?.timezone || "UTC";
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        const defaultWallet = await fetchLocalOrDefaultWalletConditionally(user._id);

        const transactionObj = {
            reference_id: ref,
            type: "instant",
            transaction_type: "debit",
            service_type: "kyc_verification",
            payment_type: "card",
            status: "INITIATED",
            description: "KYC verification fee payment by card",
            currency: { code: "USD", symbol: "$" },
            amount: countryDetails.kyc_fee,
            fee: 0,
            total: countryDetails.kyc_fee,
            is_card_save: false,
            wallet: defaultWallet._id,
            account: user._id,
            timeline: [
                {
                    status: "INITIATED",
                    date: receiverCurrentTime,
                },
            ],
        };

        Transaction.create(transactionObj)
            .then(async (transaction) => {
                let iat = Math.floor(Date.now() / 1000);
                const payload = generatePayload(
                    countryDetails.kyc_fee,
                    defaultWallet,
                    panDataObj,
                    transaction,
                    iat,
                    true,
                    true,
                    false
                );

                const secretKey = process.env.TRUST_PAYMENT_SECRET;
                const token = jwt.sign(payload, secretKey, { header: { alg: "HS256", typ: "JWT" } });

                const response = await encryption({
                    status: true,
                    message: "Transaction initiated successfully.",
                    currency: { code: "USD", symbol: "$" },
                    transaction_id: transaction._id,
                    transaction_ref: transaction.reference_id,
                    token,
                });

                return res.status(200).send(response);
            })
            .catch(async (err) => {
                console.error(err);
                const error = await encryption({
                    status: false,
                    message: "Transaction failed.",
                    error: err,
                });
                res.status(400).send(error);
            });
    } catch (err) {
        console.error(err);
        const error = await encryption({
            status: false,
            message: "Internal server error."
        });
        res.status(500).send(error);
    }
};

module.exports.initiatTrustPaymentTransactionWithSaveCard = async (req, res) => {
    try {
        // let data = req.body
        let data = await decryption(req.body.data)
        var { wallet_id, amount, payment_type, pan } = data;
        let ref = 'tr_' + Date.now().toString();
        if (!wallet_id || !amount || !payment_type || !pan) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing."
            });
            return res.status(404).send(error);
        }

        amount = parseInt(amount);

        let receiverWallet = await Wallet.findOne({
            $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])
        // console.log(receiverWallet.account._id, req.user._id);
        if (receiverWallet.account._id.toString() != req.user._id.toString()) {
            let error = await encryption({
                status: false,
                message: "Unauthorized."
            });
            return res.status(404).send(error);
        }
        let panDetails = await Pan.findOne({ $and: [{ _id: pan }, { account: receiverWallet.account._id }] })
        if (!panDetails) {
            let error = await encryption({
                status: false,
                message: "Invalid Card Details."
            });
            return res.status(404).send(error);
        }
        let bytes = await CryptoJS.AES.decrypt(panDetails.panData, process.env.PAN_ENCRYPTION_KEY);
        let panDataObj = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        // let amountInUSD = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount/100)

        console.log(panDataObj);
        let feeDetails = await topUpFeeCalculation(receiverWallet, amount / 100, 'topup_card_payment')

        let featureChecked = await featureCheck('topup_channel', 'card_payment', receiverWallet.account.level)
        // console.log(amountInUSD);
        if (featureChecked && feeDetails >= 0) {
            let amountInUSD = formatDecimalNumbersWithLimit(
                await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', (amount / 100) - feeDetails)
            );
            let amountInUSDTotal = formatDecimalNumbersWithLimit(
                await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount / 100)
            );

            // console.log(amountInUSD);
            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account)
            let limitChecked = limitCheck(parseFloat(amountInUSDTotal), receiverWallet.account.level, receiverWallet.account, 'topup')

            // console.log(limitChecked);
            if (limitChecked.status && balanceLimitChecked) {

                const receiverTimezone = receiverWallet.account?.timezone || "UTC"
                const receiverCurrentTime = moment().tz(receiverTimezone).format();

                let receiverTransactionObj = {
                    reference_id: ref,
                    type: 'trust_payment',
                    transaction_type: 'credit',
                    service_type: 'topup',
                    payment_type: 'card',
                    status: 'INITIATED',
                    purpose: '',
                    description: 'Topup by Saved Card',
                    currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                    amount: (amount / 100) - feeDetails,
                    fee: feeDetails,
                    total: (amount / 100),
                    wallet_id: receiverWallet.wallet_id,
                    wallet: receiverWallet._id,
                    account: receiverWallet.account._id,
                    receiver: receiverWallet.account._id,
                    current_balance: receiverWallet.balance.available,
                    payment_id: `******* ${panDataObj?.pan?.slice(-4)}`,
                    timeline: [
                        {
                            status: 'INITIATED',
                            date: receiverCurrentTime,
                        }
                    ]
                }

                Transaction.create(receiverTransactionObj).then(async (transaction) => {
                    let iat = Math.floor(Date.now() / 1000)
                    const payload = generatePayload(amount / 100, receiverWallet, panDataObj, transaction, iat, true, false, false);

                    // const payload = {
                    //     "payload": {
                    //         "accounttypedescription": "ECOM",
                    //         "baseamount": amount.toString(),
                    //         "currencyiso3a": receiverWallet.currency.code,
                    //         "sitereference": `${process.env.SITE_REFERENCE}`,
                    //         "requesttypedescriptions": ["THREEDQUERY", "AUTH"],
                    //         "pan": panDataObj.pan,
                    //         "expirydate": panDataObj.expirydate,
                    //         "securitycode": panDataObj.securitycode,
                    //         "orderreference": `${receiverWallet?.account?.username}_${receiverWallet.wallet_id}_save_card_${transaction?.reference_id}`,
                    //         "billingfirstname": receiverWallet?.account?.first_name || "",
                    //         "billinglastname": receiverWallet?.account?.last_name || "",
                    //         "billingstreet": receiverWallet?.account?.address || "",
                    //         "billingtown": receiverWallet?.account?.city || "",
                    //         "billingcounty": receiverWallet?.account?.country_name || "",
                    //         "billingpostcode": receiverWallet?.account?.postal_code || "",
                    //         "billingcountryiso2a": `${countriesIso[receiverWallet?.account?.country_iso_code] || "CH"}` || "",
                    //         "billingemail": receiverWallet?.account?.email || "",
                    //         "billingtelephone": receiverWallet?.account?.phone || "",
                    //         "billingtelephonetype": "M",
                    //         "customerfirstname": receiverWallet?.account?.username || "",
                    //         "customerlastname": receiverWallet?.account?.username || "",
                    //         "customerstreet": receiverWallet?.account?.address || "",
                    //         "customertown": receiverWallet?.account?.city || "",
                    //         "customercountryiso2a": `${countriesIso[receiverWallet?.account?.country_iso_code] || "CH"}` || "",
                    //         "customerpostcode": receiverWallet?.account?.postal_code || "",
                    //         "customeremail": receiverWallet?.account?.email || "",
                    //         "customertelephone": receiverWallet?.account?.phone || "",
                    //         "customertelephonetype": "M",
                    //     },
                    //     "iat": iat,
                    //     "iss": `${process.env.JWT_USER}`
                    // }
                    console.log(payload);
                    // Secret key used to sign the JWT (keep this secure!)
                    const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;

                    // Create a JWT

                    const header = { "alg": "HS256", "typ": "JWT" };
                    const secret = secretKey;

                    const token = jwt.sign(payload, secret, { header });
                    if (token) {
                        let ciphertext = await encryption({
                            status: "true",
                            message: "Transaction initiated successfully.",
                            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                            transaction_id: transaction._id,
                            transaction_ref: transaction.reference_id,
                            token
                        })
                        res.status(200).send(ciphertext);
                    } else {
                        let ciphertext = await encryption({
                            status: "false",
                            message: "Transaction failed.",
                        })
                        res.status(400).send(ciphertext);
                    }
                }).catch(async (err) => {
                    // console.log(err);
                    let ciphertext = await encryption({
                        status: "false",
                        message: "Transaction failed.",
                        error: err
                    })
                    res.status(400).send(ciphertext);
                })

            } else {
                if (!limitChecked.status && balanceLimitChecked) {
                    let error = await encryption(limitChecked)
                    res.status(400).send(error)
                }
                if (limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption({
                        status: false,
                        code: 'ble400',
                        message: "Balance limit exceeded"
                    })
                    res.status(400).send(error)
                }
                if (!limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption(limitChecked)
                    res.status(400).send(error)
                }
            }
        } else {
            let error = await encryption({
                status: false,
                message: "This service is not allowed."
            })
            res.status(400).send(error)
        }

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.confirmTrustPaymentTransactionWithSaveCard = async (req, res) => {
    try {
        // console.log(req.body);
        let transaction_id = req.params.transaction_id;
        let transactionDetails = await Transaction.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] });
        // console.log(transactionDetails);
        if (!transactionDetails) {
            await logError(
                "Transaction not found",
                "topup_trust_payment",
                null,
                transaction_id,
                { routeParams: req.params }
            );
            return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`)
        }
        // var { token, wallet_id } = data
        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])
        if (!receiverWallet) {
            await logError(
                "Receiver wallet not found or inactive",
                "topup_trust_payment",
                receiverWallet?.account?._id,
                transaction_id,
            );
            return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`)
        }

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "topup_trust_payment",
                receiverWallet?.account?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${req.body.errorcode}`);
        }



        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        jwt.verify(token, secretKey, async function (err, data) {
            if (err) {
                await logError(
                    "JWT verification error",
                    "topup_trust_payment",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { jwtError: err }
                );
                transactionDetails.timeline.push({
                    status: 'PENDING',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'PENDING'
                await transactionDetails.save();
                return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`);
            }
            console.log(data.payload);
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        console.log({ innerToken })
                        // let obj = {
                        //     "securitycode": innerToken.payload.securitycode,
                        //     "expirydate": innerToken.payload.expirydate,
                        //     "pan": innerToken.payload.pan,
                        //     // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        // }
                        // let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }

                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {

                                        res.redirect('https://my.insta-pay.ch/add-funds/card/success')
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error",
                                            "topup_trust_payment",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'PENDING',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'PENDING'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed",
                                        "topup_trust_payment",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'PENDING',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'PENDING'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance: ${err.message}`,
                                    "topup_trust_payment",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'PENDING',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'PENDING'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error`,
                                "topup_trust_payment",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0"`,
                            "topup_trust_payment",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );

                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                        "topup_trust_payment",
                        receiverWallet?.account?._id,
                        transaction_id,
                        value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {

                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        res.redirect('https://my.insta-pay.ch/add-funds/card/success')
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error 2",
                                            "topup_trust_payment",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'PENDING',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'PENDING'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed 2",
                                        "topup_trust_payment",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'PENDING',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'PENDING'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance 2: ${err.message}`,
                                    "topup_trust_payment",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'PENDING',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'PENDING'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error 2`,
                                "topup_trust_payment",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2`,
                            "topup_trust_payment",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                        "topup_trust_payment",
                        receiverWallet?.account?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );

                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2`,
                    "topup_trust_payment",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );

                let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                await transactionDetails.save();
                res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null`)
            }
        })
    } catch (err) {
        await logError(
            err,
            "topup_trust_payment",
            null,
            req.params?.transaction_id || null,
        );

        // let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null`)
    }

}

// WALLET TO WALLET
module.exports.initiatTrustPaymentW2WTransaction = async (req, res) => {
    try {
        let data = req.body
        console.log(data)

        // let data = await decryption(req.body.data)
        var { wallet_id, amount, payment_type, is_card_save, w2w_data, se_shambey, rates_token } = data;
        let ref = 'tr_' + Date.now().toString();
        if (!wallet_id || !amount || !payment_type || !w2w_data || !se_shambey) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing."
            });
            return res.status(404).send(error);
        }

        amount = parseInt(amount);

        let decoded;
        try {
            decoded = jwt.verify(se_shambey, process.env.FRONTEND_KEY);
        } catch (err) {
            const error = await encryption({
                status: false,
                message: "Invalid token."
            });
            return res.status(400).send(error);
        }

        let decodedRevesredString = decoded.gurhaku;
        let originalPan = decodedRevesredString.split(":").reverse().join(":");
        let [pan, securitycode, expiry_month, expiry_year] = originalPan.split(":");

        let receiverWallet = await Wallet.findOne({
            $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])

        // checking card authentication
        const cardDetails = await cardCountryValidation(pan, receiverWallet.account.country_iso_code)

        if (!cardDetails.valid) {
            const error = await encryption({
                status: false,
                message: "Invalid card."
            })
            return res.status(400).send(error);
        }
        // console.log(receiverWallet.currency);
        // if(receiverWallet.account._id!= req.){}
        let feeDetails = await topUpFeeCalculation(receiverWallet, amount / 100, 'topup_card_payment')
        //  await Fee.findOne({ $and: [{ service_name: 'topup_card_payment' }, { account_level: receiverWallet.account.level._id }] })
        let featureChecked = await featureCheck('topup_channel', 'card_payment', receiverWallet.account.level)
        // console.log(featureChecked, feeDetails, receiverWallet.account.level);
        if (featureChecked && feeDetails >= 0) {
            let amountInUSD = formatDecimalNumbersWithLimit(
                await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', (amount / 100) - feeDetails)
            );
            let amountInUSDTotal = formatDecimalNumbersWithLimit(
                await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount / 100)
            );

            // console.log(amountInUSD);
            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account)
            let limitChecked = limitCheck(parseFloat(amountInUSDTotal), receiverWallet.account.level, receiverWallet.account, 'topup');
            // console.log(balanceLimitChecked);
            if (limitChecked.status && balanceLimitChecked) {

                const receiverTimezone = receiverWallet.account?.timezone || "UTC"
                const receiverCurrentTime = moment().tz(receiverTimezone).format();

                let receiverTransactionObj = {
                    reference_id: ref,
                    type: 'instant',
                    transaction_type: 'credit',
                    service_type: 'topup',
                    payment_type: 'card',
                    status: 'INITIATED',
                    purpose: '',
                    description: 'Topup by Card',
                    currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                    amount: (amount / 100) - feeDetails,
                    is_card_save: is_card_save ? true : false,
                    fee: feeDetails,
                    total: (amount / 100),
                    wallet_id: receiverWallet.wallet_id,
                    wallet: receiverWallet._id,
                    account: receiverWallet.account._id,
                    receiver: receiverWallet.account._id,
                    current_balance: receiverWallet.balance.available,
                    hidden: true,
                    timeline: [
                        {
                            status: 'INITIATED',
                            date: receiverCurrentTime,
                        }
                    ]
                }

                Transaction.create(receiverTransactionObj).then(async (transaction) => {
                    w2w_data['transaction_id'] = transaction._id;
                    w2w_data['attachments'] = req.w2w_attachments;
                    w2w_data['token'] = rates_token;
                    const JWTToken = jwt.sign(w2w_data, topupTransactionDataTokenKey, { expiresIn: '120s' })

                    // Generate the token using the card details
                    let iat = Math.floor(Date.now() / 1000);
                    const payload = generatePayload(amount / 100, receiverWallet, { pan, securitycode, expirydate: `${expiry_month}/${expiry_year}` }, transaction, iat, false, false, false);
                    const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
                    const token = jwt.sign(payload, secretKey, { header: { "alg": "HS256", "typ": "JWT" } });

                    let ciphertext = await encryption({
                        status: "true",
                        message: "Transaction initiated successfully.",
                        currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                        transaction_id: transaction._id,
                        transaction_ref: transaction.reference_id,
                        w2w_data: JWTToken,
                        token
                    })
                    res.status(200).send(ciphertext);
                }).catch(async (err) => {
                    // console.log(err);
                    let ciphertext = await encryption({
                        status: "false",
                        message: "Transaction failed.",
                        error: err
                    })
                    res.status(400).send(ciphertext);
                })
            } else {
                if (!limitChecked.status && balanceLimitChecked) {
                    let error = await encryption(limitChecked)
                    res.status(400).send(error)
                }
                if (limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption({
                        status: false,
                        code: 'ble400',
                        message: "Balance limit exceeded"
                    })
                    res.status(400).send(error)
                }
                if (!limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption(limitChecked)
                    res.status(400).send(error)
                }
            }
        } else {
            let error = await encryption({
                status: false,
                message: "This service is not allowed."
            })
            res.status(400).send(error)
        }

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.trustPaymentW2WConfirmation = async (req, res, next) => {
    try {
        // console.log(req.body);
        let transaction_token = req.params.token;
        let transaction_id = req.params.transaction_id;
        let transactionDetails = await Transaction.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] });
        // console.log(transactionDetails);
        if (!transactionDetails) {
            await logError(
                "Transaction not found",
                "topup_trust_payment_w2w",
                null,
                transaction_id,
                { routeParams: req.params }
            );
            return res.redirect('https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/null')
        }
        // var { token, wallet_id } = data
        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])
        if (!receiverWallet) {
            await logError(
                "Receiver wallet not found or inactive",
                "topup_trust_payment_w2w",
                receiverWallet?.account?._id,
                transaction_id,
            );
            return res.redirect('https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/null')
        }

        console.log({ bodyFromTrust: req.body })

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "topup_trust_payment_w2w",
                receiverWallet?.account?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            return res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${req.body.errorcode}`);
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        jwt.verify(transaction_token, topupTransactionDataTokenKey, async function (err, data1) {
            if (err) {
                await logError(
                    "JWT verification error",
                    "topup_trust_payment_w2w",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { jwtError: err }
                );
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'FAILED'
                await transactionDetails.save();
                return res.redirect('https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/null');
            } else {
                jwt.verify(token, secretKey, async function (err, data) {
                    if (err) {
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        return res.redirect('https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/null');
                    }
                    // console.log(data.payload);
                    const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
                    if (data.payload.response.length == 2) {
                        if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                            if (data.payload.response[1].errorcode == "0") {
                                let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                                let obj = {
                                    "securitycode": innerToken.payload.securitycode,
                                    "expirydate": innerToken.payload.expirydate,
                                    "pan": innerToken.payload.pan,
                                    // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                                }
                                let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                                // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                                // var pass = bytes.toString(CryptoJS.enc.Utf8);
                                // let ref = 'tr_' + Date.now().toString();
                                let amount = parseFloat(innerToken.payload.mainamount)
                                if (transactionDetails.is_card_save) {
                                    let panObj = {
                                        panData: panDetails,
                                        last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                        status: true,
                                        account: receiverWallet.account._id
                                    }
                                    let panCreated = await Pan.create(panObj);
                                }
                                if (amount == transactionDetails.total) {
                                    let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                                    Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                        if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                            transactionDetails.timeline.push({
                                                status: 'COMPLETED',
                                                date: receiverCurrentTime,
                                            })
                                            await transactionDetails.save();
                                            transactionDetails.status = 'COMPLETED'
                                            transactionDetails['hidden'] = false
                                            let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                            // console.log(transactionUpdt);
                                            if (transactionUpdt?.modifiedCount == 1) {
                                                // jwt.verify(transaction_token, topupTransactionDataTokenKey, async function (err, data) {
                                                //     if (err) {
                                                //         return res.redirect('https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/null');
                                                //     }
                                                // formatW2WData(data.type, data.body, transactionDetails.attachments) 
                                                // res.redirect(`https://my.insta-pay.ch/payments/success/${transaction_token}`)
                                                // })
                                                req.token = transaction_token
                                                req.transaction_id = transaction_id
                                                next()
                                            } else {
                                                await logError(
                                                    "transactionUpdt?.modifiedCount == 1 error",
                                                    "topup_trust_payment_w2w",
                                                    receiverWallet?.account?._id,
                                                    transaction_id,
                                                    { value: transactionUpdt?.modifiedCount }
                                                );
                                                transactionDetails.timeline.push({
                                                    status: 'FAILED',
                                                    date: receiverCurrentTime,
                                                })
                                                transactionDetails['status'] = 'FAILED'
                                                await transactionDetails.save();
                                                res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                                            }
                                        } else {
                                            await logError(
                                                "Receiver balance update failed",
                                                "topup_trust_payment_w2w",
                                                receiverWallet?.account?._id,
                                                transaction_id
                                            );
                                            transactionDetails.timeline.push({
                                                status: 'FAILED',
                                                date: receiverCurrentTime,
                                            })
                                            transactionDetails['status'] = 'FAILED'
                                            await transactionDetails.save();
                                            res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                                        }
                                    }).catch(async (err) => {
                                        await logError(
                                            `Error updating receiver balance: ${err.message}`,
                                            "topup_trust_payment_w2w",
                                            receiverWallet?.account?._id,
                                            transaction_id
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                                    })
                                } else {
                                    await logError(
                                        `(amount == transactionDetails.total) error`,
                                        "topup_trust_payment_w2w",
                                        receiverWallet?.account?._id,
                                        transaction_id,
                                        value = { amount, total: transactionDetails.total }
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                                }
                            } else {
                                await logError(
                                    `data.payload.response[1].errorcode == "0"`,
                                    "topup_trust_payment_w2w",
                                    receiverWallet?.account?._id,
                                    transaction_id,
                                    { value: data.payload.response[1].errorcode }
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                            }
                        } else {
                            await logError(
                                `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                                "topup_trust_payment_w2w",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                        }
                    } else if (data.payload.response.length == 1) {
                        if (data.payload.response[0].requesttypedescription == 'AUTH') {
                            if (data.payload.response[0].errorcode == "0") {

                                let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                                let obj = {
                                    "securitycode": innerToken.payload.securitycode,
                                    "expirydate": innerToken.payload.expirydate,
                                    "pan": innerToken.payload.pan,
                                    // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                                }
                                let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                                // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                                // var pass = bytes.toString(CryptoJS.enc.Utf8);
                                // let ref = 'tr_' + Date.now().toString();
                                let amount = parseFloat(innerToken.payload.mainamount)
                                if (transactionDetails.is_card_save) {
                                    let panObj = {
                                        panData: panDetails,
                                        last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                        status: true,
                                        account: receiverWallet.account._id
                                    }
                                    let panCreated = await Pan.create(panObj);
                                }
                                if (amount == transactionDetails.total) {
                                    let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                                    Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                        if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                            transactionDetails.timeline.push({
                                                status: 'COMPLETED',
                                                date: receiverCurrentTime,
                                            })
                                            transactionDetails['status'] = 'COMPLETED'
                                            transactionDetails['hidden'] = false
                                            await transactionDetails.save();
                                            let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                            // console.log(transactionUpdt);
                                            if (transactionUpdt?.modifiedCount == 1) {
                                                // res.redirect(`https://my.insta-pay.ch/payments/success/${transaction_token}`)
                                                req.token = transaction_token
                                                req.transaction_id = transaction_id
                                                next()
                                            } else {
                                                await logError(
                                                    "transactionUpdt?.modifiedCount == 1 error 2",
                                                    "topup_trust_payment_w2w",
                                                    receiverWallet?.account?._id,
                                                    transaction_id,
                                                    { value: transactionUpdt?.modifiedCount }
                                                );
                                                transactionDetails.timeline.push({
                                                    status: 'FAILED',
                                                    date: receiverCurrentTime,
                                                })
                                                transactionDetails['status'] = 'FAILED'
                                                await transactionDetails.save();
                                                res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                                            }
                                        } else {
                                            await logError(
                                                "Receiver balance update failed 2",
                                                "topup_trust_payment_w2w",
                                                receiverWallet?.account?._id,
                                                transaction_id
                                            );
                                            transactionDetails.timeline.push({
                                                status: 'FAILED',
                                                date: receiverCurrentTime,
                                            })
                                            transactionDetails['status'] = 'FAILED'
                                            await transactionDetails.save();
                                            res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                                        }
                                    }).catch(async (err) => {
                                        await logError(
                                            `Error updating receiver balance 2: ${err.message}`,
                                            "topup_trust_payment_w2w",
                                            receiverWallet?.account?._id,
                                            transaction_id
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                                    })
                                } else {
                                    await logError(
                                        `(amount == transactionDetails.total) error 2`,
                                        "topup_trust_payment_w2w",
                                        receiverWallet?.account?._id,
                                        transaction_id,
                                        value = { amount, total: transactionDetails.total }
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                                }
                            } else {
                                await logError(
                                    `data.payload.response[0].errorcode == "0" 2`,
                                    "topup_trust_payment_w2w",
                                    receiverWallet?.account?._id,
                                    transaction_id,
                                    { value: data.payload.response[0].errorcode }
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                            }
                        } else {
                            await logError(
                                `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                                "topup_trust_payment_w2w",
                                receiverWallet?.account?._id,
                                transaction_id,
                                { value: data.payload.response[0].requesttypedescription }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response.length === 1 2`,
                            "topup_trust_payment_w2w",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response.length }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                        res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                    }
                })
            }
        })
    } catch (err) {
        await logError(
            err,
            "topup_trust_payment_w2w",
            null,
            req.params?.transaction_id || null,
        );
        // let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect('https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/null')
    }

}

module.exports.initiatTrustPaymentW2WTransactionSavedCard = async (req, res) => {
    try {
        let data = req.body
        console.log(data)
        // let data = await decryption(req.body.data)
        var { wallet_id, amount, payment_type, w2w_data, rates_token } = data;
        const pan = data.panData.pan
        let ref = 'tr_' + Date.now().toString();
        if (!wallet_id || !amount || !payment_type || !pan) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing."
            });
            return res.status(404).send(error);
        }

        amount = parseInt(amount);

        let receiverWallet = await Wallet.findOne({
            $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])
        // console.log(receiverWallet.account._id, req.user._id);
        if (receiverWallet.account._id.toString() != req.user._id.toString()) {
            let error = await encryption({
                status: false,
                message: "Unauthorized."
            });
            return res.status(404).send(error);
        }
        let panDetails = await Pan.findOne({ $and: [{ _id: pan }, { account: receiverWallet.account._id }] })
        if (!panDetails) {
            let error = await encryption({
                status: false,
                message: "Invalid Card Details."
            });
            return res.status(404).send(error);
        }
        let bytes = await CryptoJS.AES.decrypt(panDetails.panData, process.env.PAN_ENCRYPTION_KEY);
        let panDataObj = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        // let amountInUSD = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount)

        console.log(panDataObj);
        let feeDetails = await topUpFeeCalculation(receiverWallet, amount / 100, 'topup_card_payment')

        let featureChecked = await featureCheck('topup_channel', 'card_payment', receiverWallet.account.level)
        // console.log(amountInUSD);
        if (featureChecked && feeDetails >= 0) {
            let amountInUSD = formatDecimalNumbersWithLimit(
                await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', (amount / 100) - feeDetails)
            );
            let amountInUSDTotal = formatDecimalNumbersWithLimit(
                await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount / 100)
            );

            // console.log(amountInUSD);
            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account)
            let limitChecked = limitCheck(parseFloat(amountInUSDTotal), receiverWallet.account.level, receiverWallet.account, 'topup')
            // console.log(limitChecked);
            if (limitChecked.status && balanceLimitChecked) {

                const receiverTimezone = receiverWallet.account?.timezone || "UTC"
                const receiverCurrentTime = moment().tz(receiverTimezone).format();

                let receiverTransactionObj = {
                    reference_id: ref,
                    type: 'trust_payment',
                    transaction_type: 'credit',
                    service_type: 'topup',
                    payment_type: 'card',
                    status: 'INITIATED',
                    purpose: '',
                    description: 'Topup by Saved Card',
                    currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                    amount: (amount / 100) - feeDetails,
                    fee: feeDetails,
                    total: amount / 100,
                    wallet_id: receiverWallet.wallet_id,
                    wallet: receiverWallet._id,
                    account: receiverWallet.account._id,
                    receiver: receiverWallet.account._id,
                    current_balance: receiverWallet.balance.available,
                    hidden: true,
                    timeline: [
                        {
                            status: 'INITIATED',
                            date: receiverCurrentTime,
                        }
                    ]
                }

                Transaction.create(receiverTransactionObj).then(async (transaction) => {
                    w2w_data['transaction_id'] = transaction._id;
                    w2w_data['attachments'] = req.w2w_attachments;
                    w2w_data['token'] = rates_token;
                    const JWTToken = jwt.sign(w2w_data, topupTransactionDataTokenKey, { expiresIn: '120s' })

                    let iat = Math.floor(Date.now() / 1000)
                    const payload = generatePayload(amount / 100, receiverWallet, panDataObj, transaction, iat, true, false, false);
                    // const payload = {
                    //     "payload": {
                    //         "accounttypedescription": "ECOM",
                    //         "baseamount": (amount).toString(),
                    //         "currencyiso3a": receiverWallet.currency.code,
                    //         "sitereference": `${process.env.SITE_REFERENCE}`,
                    //         "requesttypedescriptions": ["THREEDQUERY", "AUTH"],
                    //         "pan": panDataObj.pan,
                    //         "expirydate": panDataObj.expirydate,
                    //         "securitycode": panDataObj.securitycode,
                    //         "orderreference": `${receiverWallet?.account?.username}_${receiverWallet.wallet_id}_save_card_${transaction?.reference_id}`
                    //     },
                    //     "iat": iat,
                    //     "iss": `${process.env.JWT_USER}`
                    // }
                    console.log(payload);
                    // Secret key used to sign the JWT (keep this secure!)
                    const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;

                    // Create a JWT

                    const header = { "alg": "HS256", "typ": "JWT" };
                    const secret = secretKey;

                    const token = jwt.sign(payload, secret, { header });
                    if (token) {
                        let ciphertext = await encryption({
                            status: "true",
                            message: "Transaction initiated successfully.",
                            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                            transaction_id: transaction._id,
                            transaction_ref: transaction.reference_id,
                            token,
                            w2w_data: JWTToken
                        })
                        res.status(200).send(ciphertext);
                    } else {
                        let ciphertext = await encryption({
                            status: "false",
                            message: "Transaction failed.",
                        })
                        res.status(400).send(ciphertext);
                    }
                }).catch(async (err) => {
                    console.log(err);
                    let ciphertext = await encryption({
                        status: "false",
                        message: "Transaction failed.",
                        error: err
                    })
                    res.status(400).send(ciphertext);
                })

            } else {
                if (!limitChecked.status && balanceLimitChecked) {
                    let error = await encryption(limitChecked)
                    res.status(400).send(error)
                }
                if (limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption({
                        status: false,
                        code: 'ble400',
                        message: "Balance limit exceeded"
                    })
                    res.status(400).send(error)
                }
                if (!limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption(limitChecked)
                    res.status(400).send(error)
                }
            }
        } else {
            let error = await encryption({
                status: false,
                message: "This service is not allowed."
            })
            res.status(400).send(error)
        }

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.trustPaymentW2WConfirmationSavedCard = async (req, res, next) => {
    try {
        // console.log(req.body);
        let transaction_id = req.params.transaction_id;
        let transaction_token = req.params.token;
        console.log(req.params, "req.params")
        let transactionDetails = await Transaction.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] });
        // console.log(transactionDetails);
        if (!transactionDetails) {
            await logError(
                "Transaction not found - w2w saved card",
                "topup_trust_payment_w2w",
                null,
                transaction_id,
                { routeParams: req.params }
            );
            return res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/null`)
        }
        // var { token, wallet_id } = data
        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])
        if (!receiverWallet) {
            await logError(
                "Receiver wallet not found or inactive - w2w saved card",
                "topup_trust_payment_w2w",
                receiverWallet?.account?._id,
                transaction_id,
            );
            return res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/null`)
        }

        console.log({ bodyFromTrust: req.body })

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        console.log(req.body.errorcode, "req.body.errorcode")
        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode - w2w saved card",
                "topup_trust_payment_w2w",
                receiverWallet?.account?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            return res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${req.body.errorcode}`);
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        jwt.verify(token, secretKey, async function (err, data) {
            if (err) {
                await logError(
                    "JWT verification error - w2w saved card",
                    "topup_trust_payment_w2w",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { jwtError: err }
                );
                console.log("jwterror", err)
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'FAILED'
                await transactionDetails.save();
                return res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/null`);
            }
            console.log(data.payload);
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        // let obj = {
                        //     "securitycode": innerToken.payload.securitycode,
                        //     "expirydate": innerToken.payload.expirydate,
                        //     "pan": innerToken.payload.pan,
                        //     // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        // }
                        // let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        // if (transactionDetails.is_card_save) {
                        //     let panObj = {
                        //         panData: panDetails,
                        //         last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                        //         status: true,
                        //         account: receiverWallet.account._id
                        //     }
                        //     let panCreated = await Pan.create(panObj);
                        // }

                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        // res.redirect('https://my.insta-pay.ch/add-funds/card/success')
                                        req.token = transaction_token
                                        req.transaction_id = transaction_id
                                        next()
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error - w2w saved card",
                                            "topup_trust_payment_w2w",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed - w2w saved card",
                                        "topup_trust_payment_w2w",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance: ${err.message} - w2w saved card`,
                                    "topup_trust_payment_w2w",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error - w2w saved card`,
                                "topup_trust_payment_w2w",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/aborted/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0" - w2w saved card`,
                            "topup_trust_payment_w2w",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/aborted/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH' - w2w saved card`,
                        "topup_trust_payment_w2w",
                        receiverWallet?.account?._id,
                        transaction_id,
                        value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/aborted/${errorCode}`)
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {

                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            console.log("i have ran")
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        console.log("i have ran too")
                                        // res.redirect('https://my.insta-pay.ch/add-funds/card/success')
                                        req.token = transaction_token
                                        req.transaction_id = transaction_id
                                        next()
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error 2 - w2w saved card",
                                            "topup_trust_payment_w2w",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed 2 - w2w saved card",
                                        "topup_trust_payment_w2w",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance 2: ${err.message} - w2w saved card`,
                                    "topup_trust_payment_w2w",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error 2 - w2w saved card`,
                                "topup_trust_payment_w2w",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/aborted/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2 - w2w saved card`,
                            "topup_trust_payment_w2w",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/aborted/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2 - w2w saved card`,
                        "topup_trust_payment_w2w",
                        receiverWallet?.account?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/aborted/${errorCode}`)
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2 - w2w saved card`,
                    "topup_trust_payment_w2w",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );
                let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'FAILED'
                await transactionDetails.save();
                res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/aborted/null`)
            }
        })
    } catch (err) {
        console.log(err)
        await logError(
            `${err} - w2w saved card`,
            "topup_trust_payment_w2w",
            null,
            req.params?.transaction_id || null,
        );
        // let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/aborted/null`)
    }
}

module.exports.getUserPanList = async (req, res) => {
    try {
        let id = req.params.account_id;
        Pan.find({ account: id }, { panData: false }).then(async (panList) => {
            if (panList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Pan list!",
                    panList
                })
                res.status(200).send(ciphertext)
            } else {
                let ciphertext = await encryption({
                    status: true,
                    message: "No pan found!",
                    panList: []
                })
                res.status(404).send(ciphertext)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting list!"
            })
            res.status(400).send(error);
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }
}

module.exports.deletePan = async (req, res) => {
    try {
        let id = req.params.id;
        Pan.findOne({ _id: id }).then(async (panDetails) => {
            if (panDetails) {
                Pan.findByIdAndRemove({ _id: panDetails._id }).then(async (panDeleted) => {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Pan deleted successfully!",
                        panDeleted
                    })
                    res.status(200).send(ciphertext)
                }).catch(async (err) => {
                    console.log(err);
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while deleting pan!"
                    })
                    res.status(400).send(error);
                })
            } else {
                let ciphertext = await encryption({
                    status: true,
                    message: "No pan found!",
                    panDetails: []
                })
                res.status(404).send(ciphertext)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while deleting pan!"
            })
            res.status(400).send(error);
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }
}

function generateHmacSha256(header, payload, secret) {
    const data = `${base64UrlEncode(header)}.${base64UrlEncode(payload)}`;
    const signature = CryptoJS.HmacSHA256(data, secret);
    console.log(signature);
    return CryptoJS.enc.Base64.stringify(signature);
}

function base64UrlEncode(input) {
    return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(input))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

module.exports.initiatTrustPaymentTransactionWithSaveCardIntl = async (req, res) => {
    try {
        console.log(req, "req")
        let data = req.body
        const panData = req.panData
        // let data = await decryption(req.body.data)
        let { wallet_id, amount, payment_type, pan } = panData;
        // const { intlToken } = data;

        console.log(panData, "panData")
        amount = parseInt(amount);
        const newToken = jwt.sign(data, secretKeyIntl);

        // jwt.verify(intlToken, secretKeyIntl, async (err, payload) => {
        //     // if tokn is expired
        //     if (err) {
        //         console.log(err, "err in verifying token")
        //         let error = await encryption({
        //             status: false,
        //             message: "Invalid or expired token"
        //         });
        //         return res.status(400).send(error);
        //     } else {
        //         console.log(payload)
        //         const { iat, exp, nbf, jti, ...validData } = payload;
        //         console.log(payload, "payload")

        //         newToken = jwt.sign(validData, secretKey);

        //     }
        // })

        let ref = 'tr_' + Date.now().toString();
        if (!wallet_id || !amount || !payment_type || !pan) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing."
            });
            return res.status(404).send(error);
        }

        let receiverWallet = await Wallet.findOne({
            $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])
        // console.log(receiverWallet.account._id, req.user._id);
        if (receiverWallet.account._id.toString() != req.user._id.toString()) {
            let error = await encryption({
                status: false,
                message: "Unauthorized."
            });
            return res.status(404).send(error);
        }
        let panDetails = await Pan.findOne({ $and: [{ _id: pan }, { account: receiverWallet.account._id }] })
        if (!panDetails) {
            let error = await encryption({
                status: false,
                message: "Invalid Card Details."
            });
            return res.status(404).send(error);
        }
        let bytes = await CryptoJS.AES.decrypt(panDetails.panData, process.env.PAN_ENCRYPTION_KEY);
        let panDataObj = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        // let amountInUSD = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount)

        console.log(panDataObj);
        let feeDetails = await topUpFeeCalculation(receiverWallet, amount / 100, 'topup_card_payment')

        let featureChecked = await featureCheck('topup_channel', 'card_payment', receiverWallet.account.level)
        // console.log(amountInUSD);
        if (featureChecked && feeDetails >= 0) {
            console.log(receiverWallet.currency.code, 'USD', amount / 100, "receiverWallet.currency.code, 'USD', amount / 100")
            let amountInUSD = formatDecimalNumbersWithLimit(
                await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', (amount / 100) - feeDetails)
            );
            let amountInUSDTotal = formatDecimalNumbersWithLimit(
                await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount / 100)
            );

            console.log(amountInUSD);
            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account)
            let limitChecked = limitCheck(parseFloat(amountInUSDTotal), receiverWallet.account.level, receiverWallet.account, 'topup')
            // console.log(limitChecked);
            if (limitChecked.status && balanceLimitChecked) {

                const receiverTimezone = receiverWallet.account?.timezone || "UTC"
                const receiverCurrentTime = moment().tz(receiverTimezone).format();

                let receiverTransactionObj = {
                    reference_id: ref,
                    type: 'trust_payment',
                    transaction_type: 'credit',
                    service_type: 'topup',
                    payment_type: 'card',
                    status: 'INITIATED',
                    purpose: '',
                    description: 'Topup by Saved Card',
                    currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                    amount: (amount / 100) - feeDetails,
                    fee: feeDetails,
                    total: amount / 100,
                    wallet_id: receiverWallet.wallet_id,
                    wallet: receiverWallet._id,
                    account: receiverWallet.account._id,
                    receiver: receiverWallet.account._id,
                    current_balance: receiverWallet.balance.available,
                    hidden: true,
                    timeline: [
                        {
                            status: 'INITIATED',
                            date: receiverCurrentTime,
                        }
                    ]
                }

                Transaction.create(receiverTransactionObj).then(async (transaction) => {
                    let iat = Math.floor(Date.now() / 1000)
                    const payload = generatePayload(amount / 100, receiverWallet, panDataObj, transaction, iat, true, false, false);
                    // const payload = {
                    //     "payload": {
                    //         "accounttypedescription": "ECOM",
                    //         "baseamount": (amount).toString(),
                    //         "currencyiso3a": receiverWallet.currency.code,
                    //         "sitereference": `${process.env.SITE_REFERENCE}`,
                    //         "requesttypedescriptions": ["THREEDQUERY", "AUTH"],
                    //         "pan": panDataObj.pan,
                    //         "expirydate": panDataObj.expirydate,
                    //         "securitycode": panDataObj.securitycode,
                    //         "orderreference": `${receiverWallet?.account?.username}_${receiverWallet.wallet_id}_save_card_${transaction?.reference_id}`
                    //     },
                    //     "iat": iat,
                    //     "iss": `${process.env.JWT_USER}`
                    // }
                    console.log(payload);
                    // Secret key used to sign the JWT (keep this secure!)
                    const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;

                    // Create a JWT

                    const header = { "alg": "HS256", "typ": "JWT" };
                    const secret = secretKey;

                    const token = jwt.sign(payload, secret, { header });
                    if (token) {
                        let ciphertext = await encryption({
                            status: "true",
                            message: "Transaction initiated successfully.",
                            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                            transaction_id: transaction._id,
                            transaction_ref: transaction.reference_id,
                            token,
                            intlToken: newToken,
                        })
                        return res.status(200).send(ciphertext);
                    } else {
                        let ciphertext = await encryption({
                            status: "false",
                            message: "Transaction failed.",
                        })
                        return res.status(400).send(ciphertext);
                    }
                }).catch(async (err) => {
                    // console.log(err);
                    let ciphertext = await encryption({
                        status: "false",
                        message: "Transaction failed.",
                        error: err
                    })
                    return res.status(400).send(ciphertext);
                })

            } else {
                if (!limitChecked.status && balanceLimitChecked) {
                    let error = await encryption(limitChecked)
                    return res.status(400).send(error)
                }
                if (limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption({
                        status: false,
                        code: 'ble400',
                        message: "Balance limit exceeded"
                    })
                    return res.status(400).send(error)
                }
                if (!limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption(limitChecked)
                    return res.status(400).send(error)
                }
            }
        } else {
            let error = await encryption({
                status: false,
                message: "This service is not allowed."
            })
            return res.status(400).send(error)
        }

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        return res.status(500).send(error)
    }
}

module.exports.confirmTrustPaymentTransactionWithSaveCardIntl = async (req, res) => {
    try {
        // console.log(req.body);
        let transaction_id = req.params.transaction_id;
        let intlToken = req.params.token;

        console.log(transaction_id, intlToken, "transaction_id, intlToken");

        let transactionDetails = await Transaction.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] });
        // console.log(transactionDetails);
        if (!transactionDetails) {
            await logError(
                "Transaction not found  - intl saved card",
                "topup_trust_payment_intl",
                null,
                transaction_id,
                { routeParams: req.params }
            );
            return res.redirect('https://my.insta-pay.ch/payment-status/international/error/null')
        }
        // var { token, wallet_id } = data
        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])
        if (!receiverWallet) {
            await logError(
                "Receiver wallet not found or inactive - intl saved card",
                "topup_trust_payment_intl",
                receiverWallet?.account?._id,
                transaction_id,
            );
            return res.redirect('https://my.insta-pay.ch/payment-status/international/error/null')
        }

        console.log({ bodyFromTrust: req.body })

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode - intl saved card",
                "topup_trust_payment_intl",
                receiverWallet?.account?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            return res.redirect(`https://my.insta-pay.ch/payment-status/international/error/${req.body.errorcode}`);
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        jwt.verify(token, secretKey, async function (err, data) {
            if (err) {
                await logError(
                    "JWT verification error - intl saved card",
                    "topup_trust_payment_intl",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { jwtError: err }
                );
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'FAILED'
                await transactionDetails.save();
                return res.redirect('https://my.insta-pay.ch/payment-status/international/error/null');
            }
            console.log(data.payload);

            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
            const errorMessage = data.payload.response.length == 2 ? data.payload.response[1]?.acquirerresponsemessage : data.payload.response[0]?.acquirerresponsemessage
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }

                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        // res.redirect('https://my.insta-pay.ch/add-funds/card/success')
                                        const decoded = jwt.verify(intlToken, secretKeyIntl);

                                        console.log(decoded, "intl decoded data in cards");

                                        const confirmIntlTransaction = await confirmTransaction(decoded, [])

                                        if (confirmIntlTransaction?.status) {
                                            const { transactionDetails: beneficiary_id } = decoded
                                            res.redirect(`https://my.insta-pay.ch/payment-status/international/success/${beneficiary_id}`)
                                        } else {
                                            await logError(
                                                `error while intl confirmation: ${confirmIntlTransaction?.message} - intl saved card`,
                                                "topup_trust_payment_intl",
                                                receiverWallet?.account?._id,
                                                transaction_id,
                                            );
                                            res.redirect('https://my.insta-pay.ch/payment-status/international/error/null?add_funds=true')
                                        }
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error - intl saved card",
                                            "topup_trust_payment_intl",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/payment-status/international/error/${errorcode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed - intl saved card",
                                        "topup_trust_payment_intl",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/payment-status/international/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance: ${err.message} - intl saved card`,
                                    "topup_trust_payment_intl",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/payment-status/international/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error - intl saved card`,
                                "topup_trust_payment_intl",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/payment-status/international/aborted/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0" - intl saved card`,
                            "topup_trust_payment_intl",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/payment-status/international/aborted/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH' - intl saved card`,
                        "topup_trust_payment_intl",
                        receiverWallet?.account?._id,
                        transaction_id,
                        value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/payment-status/international/aborted/${errorCode}`)
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {

                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                console.log("ran till here", newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1)
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    console.log("ran till here 2")
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false

                                    await transactionDetails.save();
                                    console.log("ran till here 3")
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        const decoded = jwt.verify(intlToken, secretKeyIntl);

                                        console.log({ decoded_intl_token: decoded })
                                        const confirmIntlTransaction = await confirmTransaction(decoded, [])

                                        if (confirmIntlTransaction?.status) {
                                            const { transactionDetails: beneficiary_id } = decoded
                                            res.redirect(`https://my.insta-pay.ch/payment-status/international/success/${beneficiary_id}`)
                                        } else {
                                            await logError(
                                                `error while intl confirmation: ${confirmIntlTransaction?.message} - intl saved card`,
                                                "topup_trust_payment_intl",
                                                receiverWallet?.account?._id,
                                                transaction_id,
                                            );
                                            res.redirect('https://my.insta-pay.ch/payment-status/international/error/null?add_funds=true')
                                        }


                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error 2 - intl saved card",
                                            "topup_trust_payment_intl",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/payment-status/international/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed 2 - intl saved card",
                                        "topup_trust_payment_intl",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/payment-status/international/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                console.log(err)
                                await logError(
                                    `Error updating receiver balance 2: ${err.message} - intl saved card`,
                                    "topup_trust_payment_intl",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/payment-status/international/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error 2 - intl saved card`,
                                "topup_trust_payment_intl",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/payment-status/international/aborted/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2 - intl saved card`,
                            "topup_trust_payment_intl",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/payment-status/international/aborted/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2 - intl saved card`,
                        "topup_trust_payment_intl",
                        receiverWallet?.account?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/payment-status/international/aborted/${errorCode}`)
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2 - intl saved card`,
                    "topup_trust_payment_intl",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );
                let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                await transactionDetails.save();
                res.redirect(`https://my.insta-pay.ch/payment-status/international/aborted/null`)
            }
        })
    } catch (err) {
        await logError(
            `${err} - intl saved card`,
            "topup_trust_payment_intl",
            null,
            req.params?.transaction_id || null,
        );
        // let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect('https://my.insta-pay.ch/payment-status/international/aborted/null')
    }

}

module.exports.initiatTrustPaymentTransactionIntl = async (req, res) => {
    try {
        let data = req.body
        const trustPaymentData = req.panData
        const newToken = jwt.sign(data, secretKeyIntl);
        // let data = await decryption(req.body.data)
        var { se_shambey, wallet_id, amount, payment_type, is_card_save } = trustPaymentData;
        let ref = 'tr_' + Date.now().toString();
        if (!wallet_id || !amount || !payment_type) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing."
            });
            return res.status(404).send(error);
        }
        amount = parseInt(amount);

        // Decode token and fetch card details
        let decoded;
        try {
            decoded = jwt.verify(se_shambey, process.env.FRONTEND_KEY);
        } catch (err) {
            const error = await encryption({
                status: false,
                message: "Invalid token."
            });
            return res.status(400).send(error);
        }

        let decodedReversedString = decoded.gurhaku;
        let originalPan = decodedReversedString.split(":").reverse().join(":");
        let [pan, securitycode, expiry_month, expiry_year] = originalPan.split(":");

        let receiverWallet = await Wallet.findOne({
            $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])

        if (!receiverWallet) {
            let error = await encryption({
                status: false,
                message: "Wallet not found or inactive."
            });
            return res.status(404).send(error);
        }

        // checking card authentication
        const cardDetails = await cardCountryValidation(pan, receiverWallet.account.country_iso_code)

        if (!cardDetails.valid) {
            const error = await encryption({
                status: false,
                message: "Invalid card."
            })
            return res.status(400).send(error);
        }

        let feeDetails = await topUpFeeCalculation(receiverWallet, amount / 100, 'topup_card_payment');
        let featureChecked = await featureCheck('topup_channel', 'card_payment', receiverWallet.account.level);

        if (featureChecked && feeDetails >= 0) {
            let amountInUSD = formatDecimalNumbersWithLimit(
                await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', (amount / 100) - feeDetails)
            );
            let amountInUSDTotal = formatDecimalNumbersWithLimit(
                await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount / 100)
            );

            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account);
            let limitChecked = limitCheck(parseFloat(amountInUSDTotal), receiverWallet.account.level, receiverWallet.account, 'topup');

            if (limitChecked.status && balanceLimitChecked) {
                const receiverTimezone = receiverWallet.account?.timezone || "UTC"
                const receiverCurrentTime = moment().tz(receiverTimezone).format();

                let receiverTransactionObj = {
                    reference_id: ref,
                    type: 'instant',
                    transaction_type: 'credit',
                    service_type: 'topup',
                    payment_type: 'card',
                    status: 'INITIATED',
                    purpose: '',
                    description: 'Topup by Card',
                    currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                    amount: (amount / 100) - feeDetails,
                    is_card_save: is_card_save ? true : false,
                    fee: feeDetails,
                    total: (amount / 100),
                    wallet_id: receiverWallet.wallet_id,
                    wallet: receiverWallet._id,
                    account: receiverWallet.account._id,
                    receiver: receiverWallet.account._id,
                    current_balance: receiverWallet.balance.available,
                    hidden: true,
                    timeline: [
                        {
                            status: 'INITIATED',
                            date: receiverCurrentTime,
                        }
                    ]
                }

                Transaction.create(receiverTransactionObj).then(async (transaction) => {
                    let iat = Math.floor(Date.now() / 1000);
                    const payload = generatePayload(
                        (amount / 100),
                        receiverWallet,
                        { pan, securitycode, expirydate: `${expiry_month}/${expiry_year}` },
                        transaction,
                        iat,
                        false,
                        false,
                        false
                    );
                    const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
                    const token = jwt.sign(payload, secretKey, { algorithm: "HS256" });

                    let ciphertext = await encryption({
                        status: "true",
                        message: "Transaction initiated successfully.",
                        currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                        transaction_id: transaction._id,
                        transaction_ref: transaction.reference_id,
                        intlToken: newToken,
                        token,
                    })
                    res.status(200).send(ciphertext);
                }).catch(async (err) => {
                    let ciphertext = await encryption({
                        status: "false",
                        message: "Transaction failed.",
                        error: err
                    })
                    res.status(400).send(ciphertext);
                })
            } else {
                if (!limitChecked.status && balanceLimitChecked) {
                    let error = await encryption(limitChecked)
                    res.status(400).send(error)
                }
                if (limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption({
                        status: false,
                        code: 'ble400',
                        message: "Balance limit exceeded"
                    })
                    res.status(400).send(error)
                }
                if (!limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption(limitChecked)
                    res.status(400).send(error)
                }
            }
        } else {
            let error = await encryption({
                status: false,
                message: "This service is not allowed."
            })
            res.status(400).send(error)
        }

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}


module.exports.trustPaymentConfirmationIntl = async (req, res) => {
    try {
        // console.log(req.body);
        let transaction_id = req.params.transaction_id;
        let intlToken = req.params.token;
        let transactionDetails = await Transaction.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] });
        // console.log(transactionDetails);
        if (!transactionDetails) {
            await logError(
                "Transaction not found - intl w/o saved card",
                "topup_trust_payment_intl",
                null,
                transaction_id,
                { routeParams: req.params }
            );
            return res.redirect('https://my.insta-pay.ch/payment-status/international/error/null')
        }
        // var { token, wallet_id } = data
        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])
        if (!receiverWallet) {
            await logError(
                "Receiver wallet not found or inactive - intl w/o saved card",
                "topup_trust_payment_intl",
                receiverWallet?.account?._id,
                transaction_id,
            );
            return res.redirect('https://my.insta-pay.ch/payment-status/international/error/null')
        }

        console.log({ bodyFromTrust: req.body })

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode - intl w/o saved card",
                "topup_trust_payment_intl",
                receiverWallet?.account?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            return res.redirect(`https://my.insta-pay.ch/payment-status/international/error/${req.body.errorcode}`);
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        jwt.verify(token, secretKey, async function (err, data) {
            if (err) {
                await logError(
                    "JWT verification error - intl w/o saved card",
                    "topup_trust_payment_intl",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { jwtError: err }
                );
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'FAILED'
                await transactionDetails.save();
                return res.redirect('https://my.insta-pay.ch/payment-status/international/error/null');
            }
            console.log(data.payload, "data.payload", intlToken);
            const decoded = jwt.verify(intlToken, secretKeyIntl);
            console.log(decoded, "decodedlol")
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
            const errorMessage = data.payload.response.length == 2 ? data.payload.response[1]?.acquirerresponsemessage : data.payload.response[0]?.acquirerresponsemessage
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }

                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        const decoded = jwt.verify(intlToken, secretKeyIntl);

                                        const confirmIntlTransaction = await confirmTransaction(decoded, [])

                                        if (confirmIntlTransaction?.status) {
                                            const { transactionDetails: beneficiary_id } = decoded
                                            res.redirect(`https://my.insta-pay.ch/payment-status/international/success/${beneficiary_id}`)
                                        } else {
                                            await logError(
                                                `error while intl confirmation: ${confirmIntlTransaction?.message} - intl w/o saved card`,
                                                "topup_trust_payment_intl",
                                                receiverWallet?.account?._id,
                                                transaction_id,
                                            );
                                            res.redirect('https://my.insta-pay.ch/payment-status/international/error/null?add_funds=true')
                                        }
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error - intl w/o saved card",
                                            "topup_trust_payment_intl",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/payment-status/international/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed - intl w/o saved card",
                                        "topup_trust_payment_intl",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/payment-status/international/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance: ${err.message} - intl w/o saved card`,
                                    "topup_trust_payment_intl",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/payment-status/international/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error - intl w/o saved card`,
                                "topup_trust_payment_intl",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/payment-status/international/aborted/${errorCode}}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0" - intl w/o saved card`,
                            "topup_trust_payment_intl",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );
                        transa
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/payment-status/international/aborted/${errorCode}}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH' - intl w/o saved card`,
                        "topup_trust_payment_intl",
                        receiverWallet?.account?._id,
                        transaction_id,
                        value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/payment-status/international/aborted/${errorCode}}`)
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {

                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        const decoded = jwt.verify(intlToken, secretKeyIntl);

                                        const confirmIntlTransaction = await confirmTransaction(decoded, [])

                                        if (confirmIntlTransaction?.status) {
                                            const { transactionDetails: beneficiary_id } = decoded
                                            res.redirect(`https://my.insta-pay.ch/payment-status/international/success/${beneficiary_id}`)
                                        } else {
                                            await logError(
                                                `error while intl confirmation: ${confirmIntlTransaction?.message} - intl w/o saved card`,
                                                "topup_trust_payment_intl",
                                                receiverWallet?.account?._id,
                                                transaction_id,
                                            );
                                            res.redirect('https://my.insta-pay.ch/payment-status/international/error/null?add_funds=true')
                                        }
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error 2 - intl w/o saved card",
                                            "topup_trust_payment_intl",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/payment-status/international/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed 2 - intl w/o saved card",
                                        "topup_trust_payment_intl",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/payment-status/international/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance 2: ${err.message} - intl w/o saved card`,
                                    "topup_trust_payment_intl",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/payment-status/international/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error 2 - intl w/o saved card`,
                                "topup_trust_payment_intl",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/payment-status/international/aborted/${errorCode}}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2 - intl w/o saved card`,
                            "topup_trust_payment_intl",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/payment-status/international/aborted/${errorCode}}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2 - intl w/o saved card`,
                        "topup_trust_payment_intl",
                        receiverWallet?.account?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/payment-status/international/aborted/${errorCode}}`)
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2 - intl w/o saved card`,
                    "topup_trust_payment_intl",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );
                let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                await transactionDetails.save();
                res.redirect(`https://my.insta-pay.ch/payment-status/international/aborted/${errorCode}}`)
            }
        })
    } catch (err) {
        console.log("err in trust payment", err)
        await logError(
            `${err} - intl w/o saved card`,
            "topup_trust_payment_intl",
            null,
            req.params?.transaction_id || null,
        );
        // let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect('https://my.insta-pay.ch/payment-status/international/error/null')
    }

}


// airtime - DT One
module.exports.confirmTrustPaymentAirtimeTransactionWithSaveCard = async (req, res) => {
    try {
        // console.log(req.body);
        let transaction_id = req.params.transaction_id;
        let intlToken = req.params.token;
        let type = req.params.type;

        let transactionDetails = await Transaction.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] });
        // console.log(transactionDetails);
        if (!transactionDetails) {
            return res.redirect('https://my.insta-pay.ch/add-funds/card/error/null')
        }
        // var { token, wallet_id } = data
        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])
        if (!receiverWallet) {
            return res.redirect('https://my.insta-pay.ch/add-funds/card/error/null')
        }

        console.log({ bodyFromTrust: req.body })

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        if (req.body.errorcode !== "0") {
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${req.body.errorcode}`);
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        jwt.verify(token, secretKey, async function (err, data) {
            if (err) {
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'FAILED'
                await transactionDetails.save();
                return res.redirect('https://my.insta-pay.ch/add-funds/card/error/null');
            }
            console.log(data.payload);

            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
            const errorMessage = data.payload.response.length == 2 ? data.payload.response[1]?.acquirerresponsemessage : data.payload.response[0]?.acquirerresponsemessage
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }

                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        // res.redirect('https://my.insta-pay.ch/add-funds/card/success')
                                        const decoded = jwt.verify(intlToken, secretKeyIntl);

                                        let confirmIntlTransaction

                                        if (type !== "fixed") {
                                            confirmIntlTransaction = await confirmtransactionAirtime(decoded)
                                        } else {
                                            confirmIntlTransaction = await confirmAirtimeTransactionFixed(decoded)
                                        }


                                        if (confirmIntlTransaction?.status) {
                                            res.redirect(`https://my.insta-pay.ch/add-funds/card/success`)
                                        } else {
                                            res.redirect('https://my.insta-pay.ch/add-funds/card/error/null')
                                        }
                                    } else {
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                    }
                                } else {
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                            })
                        } else {
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                        }
                    } else {
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                    }
                } else {
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {

                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        const decoded = jwt.verify(intlToken, secretKeyIntl);

                                        let confirmIntlTransaction

                                        if (type !== "fixed") {
                                            confirmIntlTransaction = await confirmtransactionAirtime(decoded)
                                        } else {
                                            confirmIntlTransaction = await confirmAirtimeTransactionFixed(decoded)
                                        }

                                        if (confirmIntlTransaction?.status) {
                                            res.redirect(`https://my.insta-pay.ch/add-funds/card/success`)
                                        } else {
                                            res.redirect('https://my.insta-pay.ch/add-funds/card/error/null')
                                        }


                                    } else {
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                    }
                                } else {
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                            })
                        } else {
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                        }
                    } else {
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                    }
                } else {
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                }
            } else {
                let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                await transactionDetails.save();
                res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
            }
        })
    } catch (err) {
        // let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect('https://my.insta-pay.ch/add-funds/card/failed/null')
    }

}

module.exports.trustPaymentConfirmationAirtime = async (req, res) => {
    try {
        // console.log(req.body);
        let transaction_id = req.params.transaction_id;
        let intlToken = req.params.token;
        let type = req.params.type
        let transactionDetails = await Transaction.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] });
        // console.log(transactionDetails);
        if (!transactionDetails) {
            return res.redirect('https://my.insta-pay.ch/add-funds/card/error/null')
        }
        // var { token, wallet_id } = data
        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])
        if (!receiverWallet) {
            return res.redirect('https://my.insta-pay.ch/add-funds/card/error/null')
        }

        console.log({ bodyFromTrust: req.body })

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        if (req.body.errorcode !== "0") {
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${req.body.errorcode}`);
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        jwt.verify(token, secretKey, async function (err, data) {
            if (err) {
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'FAILED'
                await transactionDetails.save();
                return res.redirect('https://my.insta-pay.ch/add-funds/card/error/null');
            }
            console.log(data.payload, "data.payload");
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
            const errorMessage = data.payload.response.length == 2 ? data.payload.response[1]?.acquirerresponsemessage : data.payload.response[0]?.acquirerresponsemessage
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }

                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        const decoded = jwt.verify(intlToken, secretKeyIntl);

                                        let confirmIntlTransaction

                                        if (type !== "fixed") {
                                            confirmIntlTransaction = await confirmtransactionAirtime(decoded)
                                        } else {
                                            confirmIntlTransaction = await confirmAirtimeTransactionFixed(decoded)
                                        }

                                        if (confirmIntlTransaction?.status) {
                                            res.redirect(`https://my.insta-pay.ch/add-funds/card/success`)
                                        } else {
                                            res.redirect('https://my.insta-pay.ch/add-funds/card/error/null')
                                        }
                                    } else {
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                    }
                                } else {
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                            })
                        } else {
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                        }
                    } else {
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                    }
                } else {
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {

                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        const decoded = jwt.verify(intlToken, secretKeyIntl);

                                        let confirmIntlTransaction

                                        if (type !== "fixed") {
                                            confirmIntlTransaction = await confirmtransactionAirtime(decoded)
                                        } else {
                                            confirmIntlTransaction = await confirmAirtimeTransactionFixed(decoded)
                                        }

                                        if (confirmIntlTransaction?.status) {
                                            res.redirect(`https://my.insta-pay.ch/add-funds/card/success`)
                                        } else {
                                            res.redirect('https://my.insta-pay.ch/add-funds/card/error/null')
                                        }
                                    } else {
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                    }
                                } else {
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                            })
                        } else {
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                        }
                    } else {
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                    }
                } else {
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                }
            } else {
                let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                await transactionDetails.save();
                res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
            }
        })
    } catch (err) {
        console.log("err in trust payment", err)
        // let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect('https://my.insta-pay.ch/add-funds/card/failed/null')
    }

}


// chatbot add funds webhook
module.exports.confirmTopupChatbotWebhook = async (req, res) => {
    try {
        console.log(`\u{1F7EA} Received bot trustpayment webhook:`);
        console.dir(req.params);
        let transaction_id = req.params.transaction_id;
        let transactionDetails = await Transaction.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] }).populate([{ path: "account", populate: (['insta_recipient_id']) }]);
        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails?.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company', 'insta_recipient_id']) }]);

        let recipientBotId;
        let chatbotData;

        const platform = transactionDetails?.external_token?.type;
        if (transactionDetails?.external_token?.type === "telegram") {
            recipientBotId = receiverWallet?.account?.telegram_id || transactionDetails?.account?.telegram_id;
        } else {
            recipientBotId = receiverWallet?.account?.insta_recipient_id?.recipient || transactionDetails?.account?.insta_recipient_id?.recipient;
            chatbotData = { sender: { id: recipientBotId } };
        }
        if (!transactionDetails) {
            await logError(
                "Transaction not found",
                "topup_trust_payment_ch",
                null,
                transaction_id,
                { routeParams: req.params }
            );
            if (platform === "telegram") {
                await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction details not found");
            } else {
                await sendBotTemplate(chatbotData, "Error: Transaction details not found", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
            }
            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
        }

        if (!receiverWallet) {
            await logError(
                "Receiver wallet not found or inactive",
                "topup_trust_payment_ch",
                receiverWallet?.account?._id,
                transaction_id,
            );
            if (platform === "telegram") {
                await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Receiver wallet not found");
            } else {
                await sendBotTemplate(chatbotData, "Error: Receiver wallet not found", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
            }
            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        console.log({ bodyFromTrust: req.body })
        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "topup_trust_payment_ch",
                receiverWallet?.account?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            if (platform === "telegram") {
                await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed. Please try again.");
            } else {
                await sendBotTemplate(chatbotData, "Error: Transaction failed. Please try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
            }
            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        console.log("tokenintrust", token);
        jwt.verify(token, secretKey, async function (err, data) {
            console.log("dataintrust", data);
            if (err) {
                await logError(
                    "JWT verification error",
                    "topup_trust_payment_ch",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { jwtError: err }
                );
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                });
                transactionDetails['status'] = 'FAILED';
                await transactionDetails.save();

                if (platform === "telegram") {
                    await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction Time Expired. Please try again.");
                } else {
                    await sendBotTemplate(chatbotData, "Error: Transaction Time Expired. Please try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
                }
                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }

            console.log("payloadintrust", data.payload);
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode;
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = await jwt.verify(data.payload.jwt, secretKey);

                        let amount = parseFloat(innerToken.payload.mainamount);
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            };
                            let panCreated = await Pan.create(panObj);
                        }

                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    });
                                    transactionDetails['status'] = 'COMPLETED';
                                    transactionDetails['hidden'] = false;
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } });

                                    if (transactionUpdt?.modifiedCount == 1) {
                                        if (platform === "telegram") {
                                            await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/success.png", `${transactionDetails.amount} ${receiverWallet.currency.code} has been added in your ${receiverWallet.wallet_id} Wallet`);
                                        } else {
                                            await sendBotTemplate(chatbotData, `${transactionDetails.amount} ${receiverWallet.currency.code} has been added in your ${receiverWallet.wallet_id} Wallet`, "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png");
                                        }
                                        res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/success/0');
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error",
                                            "topup_trust_payment_ch",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        });
                                        transactionDetails['status'] = 'FAILED';
                                        await transactionDetails.save();

                                        if (platform === "telegram") {
                                            await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction pending. Please contact InstaPay support.");
                                        } else {
                                            await sendBotTemplate(chatbotData, "Error: Transaction pending. Please contact InstaPay support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
                                        }
                                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`);
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed",
                                        "topup_trust_payment_ch",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    });
                                    transactionDetails['status'] = 'FAILED';
                                    await transactionDetails.save();

                                    if (platform === "telegram") {
                                        await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction pending. Please contact InstaPay support.");
                                    } else {
                                        await sendBotTemplate(chatbotData, "Error: Transaction pending. Please contact InstaPay support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
                                    }
                                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`);
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance: ${err.message}`,
                                    "topup_trust_payment_ch",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                });
                                transactionDetails['status'] = 'FAILED';
                                await transactionDetails.save();

                                if (platform === "telegram") {
                                    await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction pending. Please contact InstaPay support.");
                                } else {
                                    await sendBotTemplate(chatbotData, "Error: Transaction pending. Please contact InstaPay support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
                                }
                                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`);
                            });
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error`,
                                "topup_trust_payment_ch",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            });
                            transactionDetails['status'] = 'FAILED';
                            await transactionDetails.save();

                            if (platform === "telegram") {
                                await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed.");
                            } else {
                                await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
                            }
                            res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`);
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0"`,
                            "topup_trust_payment_ch",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        });
                        transactionDetails['status'] = 'FAILED';
                        await transactionDetails.save();

                        if (platform === "telegram") {
                            await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed.");
                        } else {
                            await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
                        }
                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`);
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                        "topup_trust_payment_ch",
                        receiverWallet?.account?._id,
                        transaction_id,
                        value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    });
                    transactionDetails['status'] = 'FAILED';
                    await transactionDetails.save();

                    if (platform === "telegram") {
                        await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed.");
                    } else {
                        await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
                    }
                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`);
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {

                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount);
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            };
                            let panCreated = await Pan.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    });
                                    transactionDetails['status'] = 'COMPLETED';
                                    transactionDetails['hidden'] = false;
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } });

                                    if (transactionUpdt?.modifiedCount == 1) {
                                        if (platform === "telegram") {
                                            await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/success.png", `${transactionDetails.amount} ${receiverWallet.currency.code} has been added in your ${receiverWallet.wallet_id} Wallet`);
                                        } else {
                                            await sendBotTemplate(chatbotData, `${transactionDetails.amount} ${receiverWallet.currency.code} has been added in your ${receiverWallet.wallet_id} Wallet`, "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png");
                                        }
                                        res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/success');
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error 2",
                                            "topup_trust_payment_ch",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        });
                                        transactionDetails['status'] = 'FAILED';
                                        await transactionDetails.save();

                                        if (platform === "telegram") {
                                            await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction pending. Please contact InstaPay support.");
                                        } else {
                                            await sendBotTemplate(chatbotData, "Error: Transaction pending. Please contact InstaPay support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
                                        }
                                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`);
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed 2",
                                        "topup_trust_payment_ch",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    });
                                    transactionDetails['status'] = 'FAILED';
                                    await transactionDetails.save();

                                    if (platform === "telegram") {
                                        await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction pending. Please contact InstaPay support.");
                                    } else {
                                        await sendBotTemplate(chatbotData, "Error: Transaction pending. Please contact InstaPay support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
                                    }
                                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`);
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance 2: ${err.message}`,
                                    "topup_trust_payment_ch",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                });
                                transactionDetails['status'] = 'FAILED';
                                await transactionDetails.save();

                                if (platform === "telegram") {
                                    await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction pending. Please contact InstaPay support.");
                                } else {
                                    await sendBotTemplate(chatbotData, "Error: Transaction pending. Please contact InstaPay support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
                                }
                                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`);
                            });
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error 2`,
                                "topup_trust_payment_ch",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();

                            if (platform === "telegram") {
                                await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed.");
                            } else {
                                await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
                            }
                            res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`);
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2`,
                            "topup_trust_payment_ch",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();

                        if (platform === "telegram") {
                            await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed.");
                        } else {
                            await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
                        }
                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`);
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                        "topup_trust_payment_ch",
                        receiverWallet?.account?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();

                    if (platform === "telegram") {
                        await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed.");
                    } else {
                        await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
                    }
                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`);
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2`,
                    "topup_trust_payment_ch",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );
                let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                await transactionDetails.save();

                if (platform === "telegram") {
                    await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed.");
                } else {
                    await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
                }
                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/null`);
            }
        });
    } catch (err) {
        console.error(err)
        await logError(
            err,
            "topup_trust_payment_ch",
            null,
            req.params?.transaction_id || null,
        );
        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/null`)
    }
}

// chatbot w2w topup webhook
module.exports.confirmW2WTopupChatbotWebhook = async (req, res, next) => {
    try {
        console.log(`\u{1F7EA} Received bot W2W trustpayment webhook:`);
        console.dir(req.params, "req.params");
        // console.log(req.body);
        let transaction_id = req.params.transaction_id;
        let transaction_token = req.params.token;
        let transactionDetails = await Transaction.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] }).populate([{ path: "account", populate: (['insta_recipient_id']) }])
        // console.log(transactionDetails);
        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails?.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company', 'insta_recipient_id']) }])

        const recipientBotId = receiverWallet?.account?.insta_recipient_id?.recipient || transactionDetails?.account?.insta_recipient_id?.recipient
        const chatbotData = { sender: { id: recipientBotId } };
        if (!transactionDetails) {
            await logError(
                "Transaction not found",
                "topup_trust_payment_w2w_ch",
                null,
                transaction_id,
                { routeParams: req.params }
            )
            await sendBotTemplate(chatbotData, "Error: Transaction details not found", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }
        // var { token, wallet_id } = data
        if (!receiverWallet) {
            await logError(
                "Receiver wallet not found or inactive",
                "topup_trust_payment_w2w_ch",
                receiverWallet?.account?._id,
                transaction_id,
            );
            await sendBotTemplate(chatbotData, "Error: Receiver wallet not found", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        console.log({ bodyFromTrust: req.body })

        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "topup_trust_payment_w2w_ch",
                receiverWallet?.account?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            await sendBotTemplate(chatbotData, "Error: Transaction failed. Please try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        console.log("tokenintrust", token);
        jwt.verify(token, secretKey, async function (err, data) {
            console.log("dataintrust", data);
            if (err) {
                await logError(
                    "JWT verification error",
                    "topup_trust_payment_w2w_ch",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { jwtError: err }
                );
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'FAILED'
                await transactionDetails.save();
                await sendBotTemplate(chatbotData, "Error: Transaction Time Expired. Please try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
            console.log("payloadintrust", data.payload);
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)

                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }

                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        req.token = transaction_token
                                        req.botId = recipientBotId
                                        req.transaction_id = transactionDetails._id
                                        next()
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error",
                                            "topup_trust_payment_w2w_ch",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        await sendBotTemplate(chatbotData, "Error: Transaction pending. Please contact InstaPay support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed",
                                        "topup_trust_payment_w2w_ch",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    await sendBotTemplate(chatbotData, "Error: Transaction pending. Please contact InstaPay support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance: ${err.message}`,
                                    "topup_trust_payment_w2w_ch",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                await sendBotTemplate(chatbotData, "Error: Transaction pending. Please contact InstaPay support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error`,
                                "topup_trust_payment_w2w_ch",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                            res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0"`,
                            "topup_trust_payment_w2w_ch",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                        "topup_trust_payment_w2w_ch",
                        receiverWallet?.account?._id,
                        transaction_id,
                        value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {

                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        req.token = transaction_token
                                        req.botId = recipientBotId
                                        req.transaction_id = transactionDetails._id
                                        next()
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error 2",
                                            "topup_trust_payment_w2w_ch",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed 2",
                                        "topup_trust_payment_w2w_ch",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance 2: ${err.message}`,
                                    "topup_trust_payment_w2w_ch",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error 2`,
                                "topup_trust_payment_w2w_ch",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                            res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2`,
                            "topup_trust_payment_w2w_ch",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                        "topup_trust_payment_w2w_ch",
                        receiverWallet?.account?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2`,
                    "topup_trust_payment_w2w_ch",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );
                let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                await transactionDetails.save();
                await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/null`)
            }
        })
    } catch (err) {
        console.error(err)
        await logError(
            err,
            "topup_trust_payment_w2w_ch",
            null,
            req.params?.transaction_id || null,
        );
        // let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/null`)
    }

}

module.exports.confirmW2WTopupChatbotWebhookTelegram = async (req, res, next) => {
    try {
        console.log(`\u{1F7EA} Received bot W2W trustpayment webhook:`);
        console.dir(req.params, "req.params");
        // console.log(req.body);
        let transaction_id = req.params.transaction_id;
        let transaction_token = req.params.token;
        let transactionDetails = await Transaction.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] }).populate("account")
        // console.log(transactionDetails);
        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails?.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])

        const recipientBotId = receiverWallet?.account?.telegram_id || transactionDetails?.account?.telegram_id
        if (!transactionDetails) {
            await logError(
                "Transaction not found",
                "topup_trust_payment_w2w_ch",
                null,
                transaction_id,
                { routeParams: req.params }
            )
            // await sendBotTemplate(chatbotData, "Error: Transaction details not found", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
            await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction details not found");

            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }
        // var { token, wallet_id } = data
        if (!receiverWallet) {
            await logError(
                "Receiver wallet not found or inactive",
                "topup_trust_payment_w2w_ch",
                receiverWallet?.account?._id,
                transaction_id,
            );
            await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Receiver wallet not found");

            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        console.log({ bodyFromTrust: req.body })

        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "topup_trust_payment_w2w_ch",
                receiverWallet?.account?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed. Please try again.");
            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        console.log("tokenintrust", token);
        jwt.verify(token, secretKey, async function (err, data) {
            console.log("dataintrust", data);
            if (err) {
                await logError(
                    "JWT verification error",
                    "topup_trust_payment_w2w_ch",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { jwtError: err }
                );
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'FAILED'
                await transactionDetails.save();
                await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction Time Expired. Please try again.");

                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
            console.log("payloadintrust", data.payload);
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)

                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }

                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        req.token = transaction_token
                                        req.botId = recipientBotId
                                        req.transaction_id = transactionDetails._id
                                        next()
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error",
                                            "topup_trust_payment_w2w_ch",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction pending. Please contact InstaPay support.");

                                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed",
                                        "topup_trust_payment_w2w_ch",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction pending. Please contact InstaPay support.");

                                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance: ${err.message}`,
                                    "topup_trust_payment_w2w_ch",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction pending. Please contact InstaPay support.");

                                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error`,
                                "topup_trust_payment_w2w_ch",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed.");

                            res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0"`,
                            "topup_trust_payment_w2w_ch",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed.");

                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                        "topup_trust_payment_w2w_ch",
                        receiverWallet?.account?._id,
                        transaction_id,
                        value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed.");

                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {

                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        req.token = transaction_token
                                        req.botId = recipientBotId
                                        req.transaction_id = transactionDetails._id
                                        next()
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error 2",
                                            "topup_trust_payment_w2w_ch",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed.");

                                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed 2",
                                        "topup_trust_payment_w2w_ch",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed.");


                                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance 2: ${err.message}`,
                                    "topup_trust_payment_w2w_ch",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed.");


                                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error 2`,
                                "topup_trust_payment_w2w_ch",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed.");


                            res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2`,
                            "topup_trust_payment_w2w_ch",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed.");


                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                        "topup_trust_payment_w2w_ch",
                        receiverWallet?.account?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed.");


                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2`,
                    "topup_trust_payment_w2w_ch",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );
                let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                await transactionDetails.save();
                await sendPhoto(recipientBotId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed.");


                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/null`)
            }
        })
    } catch (err) {
        console.error(err)
        await logError(
            err,
            "topup_trust_payment_w2w_ch",
            null,
            req.params?.transaction_id || null,
        );
        // let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/null`)
    }

}

// intl topup webhook pan - bot - instagram
module.exports.confirmIntlTopupChatbotWebhook = async (req, res, next) => {
    try {
        console.log(`\u{1F7EA} Received bot INTL trustpayment webhook:`);
        console.dir(req.params);
        // console.log(req.body);
        let transaction_id = req.params.transaction_id;
        let transaction_token = req.params.token;
        let transactionDetails = await Transaction.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] }).populate([{ path: "account", populate: (['insta_recipient_id']) }])
        // console.log(transactionDetails);
        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails?.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company', 'insta_recipient_id']) }])

        const recipientBotId = receiverWallet?.account?.insta_recipient_id?.recipient || transactionDetails?.account?.insta_recipient_id?.recipient
        const chatbotData = { sender: { id: recipientBotId } };
        if (!transactionDetails) {
            await logError(
                "Transaction not found",
                "topup_trust_payment_intl_ch",
                null,
                transaction_id,
                { routeParams: req.params }
            )
            await sendBotTemplate(chatbotData, "Error: Transaction details not found", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }
        // var { token, wallet_id } = data
        if (!receiverWallet) {
            await logError(
                "Receiver wallet not found or inactive",
                "topup_trust_payment_intl_ch",
                receiverWallet?.account?._id,
                transaction_id,
            );

            await sendBotTemplate(chatbotData, "Error: Receiver wallet not found", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        console.log({ bodyFromTrust: req.body })

        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "topup_trust_payment_intl_ch",
                receiverWallet?.account?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            await sendBotTemplate(chatbotData, "Error: Transaction failed. Please try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        console.log("tokenintrust", token);
        jwt.verify(token, secretKey, async function (err, data) {
            console.log("dataintrust", data);
            if (err) {
                await logError(
                    "JWT verification error",
                    "topup_trust_payment_intl_ch",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { jwtError: err }
                );
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'FAILED'
                await transactionDetails.save();
                await sendBotTemplate(chatbotData, "Error: Transaction Time Expired. Please try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
            console.log("payloadintrust", data.payload);
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)

                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }

                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        req.token = transaction_token
                                        req.botId = recipientBotId
                                        req.transaction_id = transactionDetails._id
                                        next()
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error",
                                            "topup_trust_payment_intl_ch",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        await sendBotTemplate(chatbotData, "Error: Transaction pending. Please contact InstaPay support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed",
                                        "topup_trust_payment_intl_ch",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    await sendBotTemplate(chatbotData, "Error: Transaction pending. Please contact InstaPay support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance: ${err.message}`,
                                    "topup_trust_payment_intl_ch",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                await sendBotTemplate(chatbotData, "Error: Transaction pending. Please contact InstaPay support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error`,
                                "topup_trust_payment_intl_ch",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                            res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0"`,
                            "topup_trust_payment_intl_ch",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                        "topup_trust_payment_intl_ch",
                        receiverWallet?.account?._id,
                        transaction_id,
                        value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {

                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        req.token = transaction_token
                                        req.botId = recipientBotId
                                        req.transaction_id = transactionDetails._id
                                        next()
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error 2",
                                            "topup_trust_payment_intl_ch",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );

                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed 2",
                                        "topup_trust_payment_intl_ch",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance 2: ${err.message}`,
                                    "topup_trust_payment_intl_ch",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error 2`,
                                "topup_trust_payment_intl_ch",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                            res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2`,
                            "topup_trust_payment_intl_ch",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        tr
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                        "topup_trust_payment_intl_ch",
                        receiverWallet?.account?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2`,
                    "topup_trust_payment_intl_ch",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );
                let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                await transactionDetails.save();
                await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/null`)
            }
        })
    } catch (err) {
        await logError(
            err,
            "topup_trust_payment_intl_ch",
            null,
            req.params?.transaction_id || null,
        );
        console.error(err)
        // let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/null`)
    }

}

async function sendBotTemplate(chatbotData, title, imageUrl) {
    const templatePayload = {
        template_type: "generic",
        elements: [
            {
                title: title,
                image_url: imageUrl,
                buttons: [{ type: "postback", title: "Main Menu", payload: "main_menu" }]
            }
        ]
    };
    await sendTemplate(chatbotData, chatbotData?.sender?.id, templatePayload, "4");
}

// intl topup webhook pan - bot - telegram
module.exports.confirmIntlTopupChatbotTelegramWebhook = async (req, res, next) => {
    try {
        console.log(`\u{1F7EA} Received bot INTL trustpayment webhook - telegram:`);
        console.dir(req.params);
        // console.log(req.body);
        let transaction_id = req.params.transaction_id;
        let transaction_token = req.params.token;
        let transactionDetails = await Transaction.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] }).populate("account")
        // console.log(transactionDetails);
        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails?.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])

        const recipientBotId = receiverWallet?.account?.telegram_id || transactionDetails?.account?.telegram_id
        if (!transactionDetails) {
            await logError(
                "Transaction not found",
                "topup_trust_payment_intl_ch_tg",
                null,
                transaction_id,
                { routeParams: req.params }
            )
            await sendButtons(recipientBotId, "Error: Transaction details not found", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");
            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }
        if (!receiverWallet) {
            await logError(
                "Receiver wallet not found or inactive",
                "topup_trust_payment_intl_ch_tg",
                receiverWallet?.account?._id,
                transaction_id,
            );

            await sendButtons(recipientBotId, "Error: Receiver wallet not found", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        console.log({ bodyFromTrust: req.body })

        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "topup_trust_payment_intl_ch_tg",
                receiverWallet?.account?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            await sendButtons(recipientBotId, "Error: Transaction failed. Please try again", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        console.log("tokenintrust", token);
        jwt.verify(token, secretKey, async function (err, data) {
            console.log("dataintrust", data);
            if (err) {
                await logError(
                    "JWT verification error",
                    "topup_trust_payment_intl_ch_tg",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { jwtError: err }
                );
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'FAILED'
                await transactionDetails.save();
                await sendButtons(recipientBotId, "Error: Transaction Time Expired. Please try again", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
            console.log("payloadintrust", data.payload);
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = jwt.verify(data.payload.jwt, secretKey)

                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }

                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        req.token = transaction_token
                                        req.botId = recipientBotId
                                        req.transaction_id = transactionDetails._id
                                        req.chatbot = "telegram"
                                        next()
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error",
                                            "topup_trust_payment_intl_ch_tg",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        await sendButtons(recipientBotId, "Error: Transaction pending. Please contact InstaPay support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed",
                                        "topup_trust_payment_intl_ch_tg",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    await sendButtons(recipientBotId, "Error: Transaction pending. Please contact InstaPay support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance: ${err.message}`,
                                    "topup_trust_payment_intl_ch_tg",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                await sendButtons(recipientBotId, "Error: Transaction pending. Please contact InstaPay support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error`,
                                "topup_trust_payment_intl_ch_tg",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            await sendButtons(recipientBotId, "Error: Transaction failed.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                            res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0"`,
                            "topup_trust_payment_intl_ch_tg",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        await sendButtons(recipientBotId, "Error: Transaction failed.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                        "topup_trust_payment_intl_ch_tg",
                        receiverWallet?.account?._id,
                        transaction_id,
                        value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    await sendButtons(recipientBotId, "Error: Transaction failed.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {

                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        req.token = transaction_token
                                        req.botId = recipientBotId
                                        req.transaction_id = transactionDetails._id
                                        req.chatbot = "telegram"
                                        next()
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error 2",
                                            "topup_trust_payment_intl_ch_tg",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );

                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        await sendButtons(recipientBotId, "Error: Transaction failed.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed 2",
                                        "topup_trust_payment_intl_ch_tg",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    await sendButtons(recipientBotId, "Error: Transaction failed.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance 2: ${err.message}`,
                                    "topup_trust_payment_intl_ch_tg",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                await sendButtons(recipientBotId, "Error: Transaction failed.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error 2`,
                                "topup_trust_payment_intl_ch_tg",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            await sendButtons(recipientBotId, "Error: Transaction failed.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                            res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2`,
                            "topup_trust_payment_intl_ch_tg",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        tr
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        await sendButtons(recipientBotId, "Error: Transaction failed.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                        "topup_trust_payment_intl_ch_tg",
                        receiverWallet?.account?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    await sendButtons(recipientBotId, "Error: Transaction failed.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2`,
                    "topup_trust_payment_intl_ch_tg",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );
                let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                await transactionDetails.save();
                await sendButtons(recipientBotId, "Error: Transaction failed.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/null`)
            }
        })
    } catch (err) {
        await logError(
            err,
            "topup_trust_payment_intl_ch_tg",
            null,
            req.params?.transaction_id || null,
        );
        console.error(err)
        // let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/null`)
    }

}

// const revesed = "5479888000205863:123:12:13".split(":").reverse().join(":")
// console.log(revesed)
// let payload = {
//     gurhaku: revesed,

// }
// let originalPan = revesed.split(":").reverse().join(":");
// console.log(originalPan)

// let token = jwt.sign(payload, process.env.FRONTEND_KEY, { expiresIn: '2h' });
// console.log(token, "token")
// AIRTIME NEW 
// for saved cards
module.exports.initiatTrustPaymentTransactionAirtime = async (req, res) => {
    try {
        const trustPaymentData = req.body

        var { se_shambey, wallet_id, airtime_token, is_card_save, number } = trustPaymentData;
        if (!wallet_id || !airtime_token || !number || !se_shambey) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing."
            });
            return res.status(404).send(error);
        }

        // Decode token and fetch card details
        let decoded;
        try {
            decoded = jwt.verify(se_shambey, process.env.FRONTEND_KEY);
        } catch (err) {
            const error = await encryption({
                status: false,
                message: "Invalid token."
            });
            return res.status(400).send(error);
        }

        let decodedReversedString = decoded.gurhaku;
        let originalPan = decodedReversedString.split(":").reverse().join(":");
        let [pan, securitycode, expiry_month, expiry_year] = originalPan.split(":");

        let receiverWallet = await Wallet.findOne({
            $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])

        if (!receiverWallet) {
            let error = await encryption({
                status: false,
                message: "Wallet not found or inactive."
            });
            return res.status(404).send(error);
        }

        // checking card authentication
        const cardDetails = await cardCountryValidation(pan, receiverWallet.account.country_iso_code)

        if (!cardDetails.valid) {
            const error = await encryption({
                status: false,
                message: "Invalid card."
            })
            return res.status(400).send(error);
        }

        let decodedAirtime;
        try {
            decodedAirtime = jwt.verify(airtime_token, secretKeyIntl);
        } catch (err) {
            const error = await encryption({
                status: false,
                message: "Invalid token."
            });
            return res.status(400).send(error);
        }

        const airtimeType = decodedAirtime.product_details.type
        console.log(decodedAirtime, "decodedAirtime")

        let totalAmount = airtimeType === "RANGED_VALUE_RECHARGE" ? decodedAirtime.total.value : decodedAirtime.converted.total.value
        totalAmount = parseInt(totalAmount * 100)

        let feeDetails = await topUpFeeCalculation(receiverWallet, totalAmount / 100, 'topup_card_payment');
        let featureChecked = await featureCheck('topup_channel', 'card_payment', receiverWallet.account.level);

        if (featureChecked && feeDetails >= 0) {
            let amountInUSD = formatDecimalNumbersWithLimit(
                await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', (totalAmount / 100) - feeDetails)
            );
            let amountInUSDTotal = formatDecimalNumbersWithLimit(
                await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', totalAmount / 100)
            );

            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account);
            let limitChecked = limitCheck(parseFloat(amountInUSDTotal), receiverWallet.account.level, receiverWallet.account, 'topup');
            console.log({ limitChecked })
            if (limitChecked.status && balanceLimitChecked) {
                const receiverTimezone = receiverWallet.account?.timezone || "UTC"
                const receiverCurrentTime = moment().tz(receiverTimezone).format();

                let ref = 'tr_' + Date.now().toString();

                const payload = {
                    ...decodedAirtime,
                    wallet_id,
                    number
                }

                console.log({ payload })

                const newAirtimeToken = jwt.sign(payload, secretKeyIntl);

                let receiverTransactionObj = {
                    reference_id: ref,
                    type: 'instant',
                    transaction_type: 'credit',
                    service_type: 'topup',
                    payment_type: 'card',
                    status: 'INITIATED',
                    purpose: '',
                    description: 'Topup by Card',
                    currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                    amount: (totalAmount / 100) - feeDetails,
                    is_card_save: is_card_save ? true : false,
                    fee: feeDetails,
                    total: (totalAmount / 100),
                    wallet_id: receiverWallet.wallet_id,
                    wallet: receiverWallet._id,
                    account: receiverWallet.account._id,
                    receiver: receiverWallet.account._id,
                    current_balance: receiverWallet.balance.available,
                    hidden: true,
                    external_token: {
                        token: newAirtimeToken,
                        type: airtimeType === "RANGED_VALUE_RECHARGE" ? "airtime_ranged" : "airtime_fixed"
                    },
                    timeline: [
                        {
                            status: 'INITIATED',
                            date: receiverCurrentTime,
                        }
                    ]
                }

                console.log({ receiverTransactionObj, totalAmount, rece: receiverWallet.account, new: { pan, securitycode, expirydate: `${expiry_month}/${expiry_year}` } })

                Transaction.create(receiverTransactionObj).then(async (transaction) => {
                    let iat = Math.floor(Date.now() / 1000);
                    const payload = generatePayload(
                        (totalAmount / 100),
                        receiverWallet,
                        { pan, securitycode, expirydate: `${expiry_month}/${expiry_year}` },
                        transaction,
                        iat,
                        false,
                        false,
                        false
                    );
                    const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
                    const token = jwt.sign(payload, secretKey, { algorithm: "HS256" });

                    let ciphertext = await encryption({
                        status: "true",
                        message: "Transaction initiated successfully.",
                        currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                        transaction_id: transaction._id,
                        transaction_ref: transaction.reference_id,
                        token,
                    })
                    res.status(200).send(ciphertext);
                }).catch(async (err) => {
                    console.log(err);
                    let ciphertext = await encryption({
                        status: "false",
                        message: "Transaction failed.",
                        error: err
                    })
                    res.status(400).send(ciphertext);
                })
            } else {
                if (!limitChecked.status && balanceLimitChecked) {
                    let error = await encryption(limitChecked)
                    res.status(400).send(error)
                }
                if (limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption({
                        status: false,
                        code: 'ble400',
                        message: "Balance limit exceeded"
                    })
                    res.status(400).send(error)
                }
                if (!limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption(limitChecked)
                    res.status(400).send(error)
                }
            }
        } else {
            let error = await encryption({
                status: false,
                message: "This service is not allowed."
            })
            res.status(400).send(error)
        }

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.trustPaymentAirtimeConfirmation = async (req, res) => {
    try {
        let transaction_id = req.params.transaction_id;
        let transactionDetails = await Transaction.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] });

        if (!transactionDetails) {
            await logError(
                "Transaction not found",
                "topup_trust_payment_airtime",
                null,
                transaction_id,
                { routeParams: req.params }
            )
            return res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null')
        }
        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])

        if (!receiverWallet) {
            await logError(
                "Receiver wallet not found or inactive",
                "topup_trust_payment_airtime",
                receiverWallet?.account?._id,
                transaction_id,
            );
            transactionDetails.external_token = undefined
            await transactionDetails.save();
            return res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null')
        }


        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "topup_trust_payment_airtime",
                receiverWallet?.account?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            transactionDetails.external_token = undefined
            await transactionDetails.save();

            return res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${req.body.errorcode}`);
        }

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;

        let token = req.body.jwt
        jwt.verify(token, secretKey, async function (err, data) {
            if (err) {
                await logError(
                    "JWT verification error",
                    "topup_trust_payment_airtime",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { jwtError: err }
                );
                console.log(err, "err in jwt");
                transactionDetails.timeline.push({
                    status: 'PENDING',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'PENDING'
                transactionDetails.external_token = undefined
                await transactionDetails.save();
                return res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null');
            }
            console.log(data.payload, "data.payload");
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }

                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    if (transactionUpdt?.modifiedCount == 1) {

                                        if (transactionDetails?.external_token?.type.startsWith("airtime")) {
                                            const airtimeType = transactionDetails?.external_token?.type.split("_")[1];

                                            let decoded;
                                            try {
                                                decoded = jwt.verify(transactionDetails.external_token.token, secretKeyIntl);
                                            } catch (err) {
                                                await logError(
                                                    "airtime token expired or invalid",
                                                    "topup_trust_payment_airtime",
                                                    receiverWallet?.account?._id,
                                                    transaction_id,
                                                );
                                                return res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                            }

                                            if (airtimeType === "ranged") {
                                                try {
                                                    const rangedAirtimeTransaction = await createTransactionRangedHelper({ number: decoded.number, decoded, wallet_id: receiverWallet._id, transaction_id })

                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    if (rangedAirtimeTransaction?.status) {

                                                        res.redirect('https://my.insta-pay.ch/payment-status/airtime/success')
                                                    } else {
                                                        await logError(
                                                            `${rangedAirtimeTransaction?.message}`,
                                                            "topup_trust_payment_airtime",
                                                            receiverWallet?.account?._id,
                                                            transaction_id,
                                                        );
                                                        res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                                    }
                                                } catch (err) {
                                                    await logError(
                                                        err,
                                                        "topup_trust_payment_airtime",
                                                        receiverWallet?.account?._id,
                                                        transaction_id,
                                                    );
                                                    console.log(err, "err while confirming airtime")
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                                }

                                            } else if (airtimeType === "fixed") {
                                                try {
                                                    const fixedAirtimeTransaction = await createTransactionFixedHelper({ number: decoded.number, decoded, wallet_id: receiverWallet._id, transaction_id })
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();

                                                    if (fixedAirtimeTransaction?.status) {
                                                        res.redirect('https://my.insta-pay.ch/payment-status/airtime/success')
                                                    } else {
                                                        await logError(
                                                            `${fixedAirtimeTransaction?.message}`,
                                                            "topup_trust_payment_airtime",
                                                            receiverWallet?.account?._id,
                                                            transaction_id,
                                                        );
                                                        res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                                    }
                                                } catch (err) {
                                                    await logError(
                                                        err,
                                                        "topup_trust_payment_airtime",
                                                        receiverWallet?.account?._id,
                                                        transaction_id,
                                                    );
                                                    console.log(err, "err while confirming airtime")
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                                }
                                            }

                                        } else {
                                            await logError(
                                                `transactionDetails?.external_token?.type.startsWith("airtime")`,
                                                "topup_trust_payment_airtime",
                                                receiverWallet?.account?._id,
                                                transaction_id,
                                                { value: transactionDetails?.external_token?.type }
                                            );
                                            transactionDetails.external_token = undefined
                                            await transactionDetails.save();
                                            return res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true`)
                                        }
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error",
                                            "topup_trust_payment_airtime",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'PENDING',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'PENDING'
                                        transactionDetails.external_token = undefined
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed",
                                        "topup_trust_payment_airtime",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'PENDING',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'PENDING'
                                    transactionDetails.external_token = undefined
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance: ${err.message}`,
                                    "topup_trust_payment_airtime",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'PENDING',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'PENDING'
                                transactionDetails.external_token = undefined
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error`,
                                "topup_trust_payment_airtime",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            transactionDetails.external_token = undefined
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0"`,
                            "topup_trust_payment_airtime",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        transactionDetails.external_token = undefined
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                        "topup_trust_payment_airtime",
                        receiverWallet?.account?._id,
                        transaction_id,
                        value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    transactionDetails.external_token = undefined
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {

                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {

                                        if (transactionDetails?.external_token?.type.startsWith("airtime")) {
                                            const airtimeType = transactionDetails?.external_token?.type.split("_")[1];

                                            let decoded;
                                            try {
                                                decoded = jwt.verify(transactionDetails.external_token.token, secretKeyIntl);
                                            } catch (err) {
                                                await logError(
                                                    "airtime token expired or invalid",
                                                    "topup_trust_payment_airtime",
                                                    receiverWallet?.account?._id,
                                                    transaction_id,
                                                );
                                                return res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                            }

                                            if (airtimeType === "ranged") {
                                                try {
                                                    const rangedAirtimeTransaction = await createTransactionRangedHelper({ number: decoded.number, decoded, wallet_id: receiverWallet._id, transaction_id })

                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    if (rangedAirtimeTransaction?.status) {

                                                        res.redirect('https://my.insta-pay.ch/payment-status/airtime/success')
                                                    } else {
                                                        await logError(
                                                            `${rangedAirtimeTransaction?.message}`,
                                                            "topup_trust_payment_airtime",
                                                            receiverWallet?.account?._id,
                                                            transaction_id,
                                                        );
                                                        res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                                    }
                                                } catch (err) {
                                                    await logError(
                                                        err,
                                                        "topup_trust_payment_airtime",
                                                        receiverWallet?.account?._id,
                                                        transaction_id,
                                                    );
                                                    console.log(err, "err while confirming airtime")
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                                }

                                            } else if (airtimeType === "fixed") {
                                                try {
                                                    const fixedAirtimeTransaction = await createTransactionFixedHelper({ number: decoded.number, decoded, wallet_id: receiverWallet._id, transaction_id })
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();

                                                    if (fixedAirtimeTransaction?.status) {
                                                        res.redirect('https://my.insta-pay.ch/payment-status/airtime/success')
                                                    } else {
                                                        await logError(
                                                            `${fixedAirtimeTransaction?.message}`,
                                                            "topup_trust_payment_airtime",
                                                            receiverWallet?.account?._id,
                                                            transaction_id,
                                                        );
                                                        res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                                    }
                                                } catch (err) {
                                                    await logError(
                                                        err,
                                                        "topup_trust_payment_airtime",
                                                        receiverWallet?.account?._id,
                                                        transaction_id,
                                                    );
                                                    console.log(err, "err while confirming airtime")
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                                }
                                            }

                                        } else {
                                            await logError(
                                                `transactionDetails?.external_token?.type.startsWith("airtime")`,
                                                "topup_trust_payment_airtime",
                                                receiverWallet?.account?._id,
                                                transaction_id,
                                                { value: transactionDetails?.external_token?.type }
                                            );
                                            transactionDetails.external_token = undefined
                                            await transactionDetails.save();
                                            return res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true`)
                                        }
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error 2",
                                            "topup_trust_payment_airtime",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'PENDING',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'PENDING'
                                        transactionDetails.external_token = undefined
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed 2",
                                        "topup_trust_payment_airtime",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'PENDING',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'PENDING'
                                    transactionDetails.external_token = undefined
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance 2: ${err.message}`,
                                    "topup_trust_payment_airtime",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'PENDING',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'PENDING'
                                transactionDetails.external_token = undefined
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error 2`,
                                "topup_trust_payment_airtime",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            transactionDetails.external_token = undefined
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2`,
                            "topup_trust_payment_airtime",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        transactionDetails.external_token = undefined
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                        "topup_trust_payment_airtime",
                        receiverWallet?.account?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    transactionDetails.external_token = undefined
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2`,
                    "topup_trust_payment_airtime",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );
                let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                transactionDetails.external_token = undefined
                await transactionDetails.save();
                res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
            }
        })
    } catch (err) {
        await logError(
            err,
            "topup_trust_payment_airtime",
            null,
            req.params?.transaction_id || null,
        );
        // let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/null}`)
    }

}

module.exports.initiateAirtimeTransactionSavedCard = async (req, res) => {
    try {
        const panData = req.panData
        const { wallet_id, airtime_token, pan, number } = panData;

        console.log(panData, "panData")

        if (!wallet_id || !airtime_token || !pan || !number) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing."
            });
            return res.status(404).send(error);
        }

        let ref = 'tr_' + Date.now().toString();
        let receiverWallet = await Wallet.findOne({
            $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])
        // console.log(receiverWallet.account._id, req.user._id);
        if (receiverWallet.account._id.toString() != req.user._id.toString()) {
            let error = await encryption({
                status: false,
                message: "Unauthorized."
            });
            return res.status(404).send(error);
        }
        let panDetails = await Pan.findOne({ $and: [{ _id: pan }, { account: receiverWallet.account._id }] })
        if (!panDetails) {
            let error = await encryption({
                status: false,
                message: "Invalid Card Details."
            });
            return res.status(404).send(error);
        }
        let bytes = await CryptoJS.AES.decrypt(panDetails.panData, process.env.PAN_ENCRYPTION_KEY);
        let panDataObj = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

        console.log(panDataObj);

        let decodedAirtime;
        try {
            decodedAirtime = jwt.verify(airtime_token, secretKeyIntl);
        } catch (err) {
            const error = await encryption({
                status: false,
                message: "Invalid token."
            });
            return res.status(400).send(error);
        }

        const airtimeType = decodedAirtime.product_details.type
        console.log(decodedAirtime, "decodedAirtime")

        let totalAmount = airtimeType === "RANGED_VALUE_RECHARGE" ? decodedAirtime.total.value : decodedAirtime.converted.total.value
        totalAmount = totalAmount * 100
        totalAmount = parseInt(totalAmount);
        let feeDetails = await topUpFeeCalculation(receiverWallet, totalAmount / 100, 'topup_card_payment')

        let featureChecked = await featureCheck('topup_channel', 'card_payment', receiverWallet.account.level)
        // console.log(amountInUSD);
        if (featureChecked && feeDetails >= 0) {
            console.log(receiverWallet.currency.code, 'USD', totalAmount / 100, "receiverWallet.currency.code, 'USD', totalAmount / 100")
            let amountInUSD = formatDecimalNumbersWithLimit(
                await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', (totalAmount / 100) - feeDetails)
            );
            let amountInUSDTotal = formatDecimalNumbersWithLimit(
                await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', totalAmount / 100)
            );

            console.log(amountInUSD);
            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account)
            let limitChecked = limitCheck(parseFloat(amountInUSDTotal), receiverWallet.account.level, receiverWallet.account, 'topup')
            // console.log(limitChecked);
            if (limitChecked.status && balanceLimitChecked) {

                const payload = {
                    ...decodedAirtime,
                    wallet_id,
                    number
                }

                console.log({ payload })

                const newAirtimeToken = jwt.sign(payload, secretKeyIntl);

                const receiverTimezone = receiverWallet.account?.timezone || "UTC"
                const receiverCurrentTime = moment().tz(receiverTimezone).format();

                let receiverTransactionObj = {
                    reference_id: ref,
                    type: 'trust_payment',
                    transaction_type: 'credit',
                    service_type: 'topup',
                    payment_type: 'card',
                    status: 'INITIATED',
                    purpose: '',
                    description: 'Topup by Saved Card',
                    currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                    amount: (totalAmount / 100) - feeDetails,
                    fee: feeDetails,
                    total: totalAmount / 100,
                    wallet_id: receiverWallet.wallet_id,
                    wallet: receiverWallet._id,
                    account: receiverWallet.account._id,
                    receiver: receiverWallet.account._id,
                    current_balance: receiverWallet.balance.available,
                    hidden: true,
                    external_token: {
                        token: newAirtimeToken,
                        type: airtimeType === "RANGED_VALUE_RECHARGE" ? "airtime_ranged" : "airtime_fixed"
                    },
                    timeline: [
                        {
                            status: 'INITIATED',
                            date: receiverCurrentTime,
                        }
                    ]
                }

                Transaction.create(receiverTransactionObj).then(async (transaction) => {
                    let iat = Math.floor(Date.now() / 1000)
                    const payload = generatePayload(totalAmount / 100, receiverWallet, panDataObj, transaction, iat, true, false, false);

                    console.log({ payload });
                    // Secret key used to sign the JWT (keep this secure!)
                    const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;

                    // Create a JWT
                    const header = { "alg": "HS256", "typ": "JWT" };
                    const secret = secretKey;

                    const token = jwt.sign(payload, secret, { header });
                    if (token) {
                        let ciphertext = await encryption({
                            status: "true",
                            message: "Transaction initiated successfully.",
                            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                            transaction_id: transaction._id,
                            transaction_ref: transaction.reference_id,
                            token,
                        })
                        return res.status(200).send(ciphertext);
                    } else {
                        let ciphertext = await encryption({
                            status: "false",
                            message: "Transaction failed.",
                        })
                        return res.status(400).send(ciphertext);
                    }
                }).catch(async (err) => {
                    console.log(err);
                    let ciphertext = await encryption({
                        status: "false",
                        message: "Transaction failed.",
                        error: err
                    })
                    return res.status(400).send(ciphertext);
                })

            } else {
                if (!limitChecked.status && balanceLimitChecked) {
                    let error = await encryption(limitChecked)
                    return res.status(400).send(error)
                }
                if (limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption({
                        status: false,
                        code: 'ble400',
                        message: "Balance limit exceeded"
                    })
                    return res.status(400).send(error)
                }
                if (!limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption(limitChecked)
                    return res.status(400).send(error)
                }
            }
        } else {
            let error = await encryption({
                status: false,
                message: "This service is not allowed."
            })
            return res.status(400).send(error)
        }

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        return res.status(500).send(error)
    }
}

module.exports.trustPaymentAirtimeConfirmationSavedCard = async (req, res) => {
    try {
        let transaction_id = req.params.transaction_id;
        let transactionDetails = await Transaction.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] });

        if (!transactionDetails) {
            await logError(
                "Transaction not found",
                "topup_trust_payment_airtime",
                null,
                transaction_id,
                { routeParams: req.params }
            )
            return res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null')
        }
        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])

        if (!receiverWallet) {
            await logError(
                "Receiver wallet not found or inactive",
                "topup_trust_payment_airtime",
                receiverWallet?.account?._id,
                transaction_id,
            );
            transactionDetails.external_token = undefined
            await transactionDetails.save();
            return res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null')
        }


        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "topup_trust_payment_airtime",
                receiverWallet?.account?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            transactionDetails.external_token = undefined
            await transactionDetails.save();

            return res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${req.body.errorcode}`);
        }

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;

        let token = req.body.jwt
        jwt.verify(token, secretKey, async function (err, data) {
            if (err) {
                await logError(
                    "JWT verification error",
                    "topup_trust_payment_airtime",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { jwtError: err }
                );
                console.log(err, "err in jwt");
                transactionDetails.timeline.push({
                    status: 'PENDING',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'PENDING'
                transactionDetails.external_token = undefined
                await transactionDetails.save();
                return res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null');
            }
            console.log(data.payload, "data.payload");
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }

                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    if (transactionUpdt?.modifiedCount == 1) {

                                        if (transactionDetails?.external_token?.type.startsWith("airtime")) {
                                            const airtimeType = transactionDetails?.external_token?.type.split("_")[1];

                                            let decoded;
                                            try {
                                                decoded = jwt.verify(transactionDetails.external_token.token, secretKeyIntl);
                                            } catch (err) {
                                                await logError(
                                                    "airtime token expired or invalid",
                                                    "topup_trust_payment_airtime",
                                                    receiverWallet?.account?._id,
                                                    transaction_id,
                                                );
                                                return res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                            }

                                            if (airtimeType === "ranged") {
                                                try {
                                                    const rangedAirtimeTransaction = await createTransactionRangedHelper({ number: decoded.number, decoded, wallet_id: receiverWallet._id, transaction_id })

                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    if (rangedAirtimeTransaction?.status) {

                                                        res.redirect('https://my.insta-pay.ch/payment-status/airtime/success')
                                                    } else {
                                                        await logError(
                                                            `${rangedAirtimeTransaction?.message}`,
                                                            "topup_trust_payment_airtime",
                                                            receiverWallet?.account?._id,
                                                            transaction_id,
                                                        );
                                                        res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                                    }
                                                } catch (err) {
                                                    await logError(
                                                        err,
                                                        "topup_trust_payment_airtime",
                                                        receiverWallet?.account?._id,
                                                        transaction_id,
                                                    );
                                                    console.log(err, "err while confirming airtime")
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                                }

                                            } else if (airtimeType === "fixed") {
                                                try {
                                                    const fixedAirtimeTransaction = await createTransactionFixedHelper({ number: decoded.number, decoded, wallet_id: receiverWallet._id, transaction_id })
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();

                                                    if (fixedAirtimeTransaction?.status) {
                                                        res.redirect('https://my.insta-pay.ch/payment-status/airtime/success')
                                                    } else {
                                                        await logError(
                                                            `${fixedAirtimeTransaction?.message}`,
                                                            "topup_trust_payment_airtime",
                                                            receiverWallet?.account?._id,
                                                            transaction_id,
                                                        );
                                                        res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                                    }
                                                } catch (err) {
                                                    await logError(
                                                        err,
                                                        "topup_trust_payment_airtime",
                                                        receiverWallet?.account?._id,
                                                        transaction_id,
                                                    );
                                                    console.log(err, "err while confirming airtime")
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                                }
                                            }


                                        } else {
                                            await logError(
                                                `transactionDetails?.external_token?.type.startsWith("airtime")`,
                                                "topup_trust_payment_airtime",
                                                receiverWallet?.account?._id,
                                                transaction_id,
                                                { value: transactionDetails?.external_token?.type }
                                            );
                                            transactionDetails.external_token = undefined
                                            await transactionDetails.save();
                                            return res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/null`)
                                        }
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error",
                                            "topup_trust_payment_airtime",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'PENDING',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'PENDING'
                                        transactionDetails.external_token = undefined
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed",
                                        "topup_trust_payment_airtime",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'PENDING',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'PENDING'
                                    transactionDetails.external_token = undefined
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance: ${err.message}`,
                                    "topup_trust_payment_airtime",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'PENDING',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'PENDING'
                                transactionDetails.external_token = undefined
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error`,
                                "topup_trust_payment_airtime",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            transactionDetails.external_token = undefined
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0"`,
                            "topup_trust_payment_airtime",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        transactionDetails.external_token = undefined
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                        "topup_trust_payment_airtime",
                        receiverWallet?.account?._id,
                        transaction_id,
                        value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    transactionDetails.external_token = undefined
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {

                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {

                                        if (transactionDetails?.external_token?.type.startsWith("airtime")) {
                                            const airtimeType = transactionDetails?.external_token?.type.split("_")[1];

                                            let decoded;
                                            try {
                                                decoded = jwt.verify(transactionDetails.external_token.token, secretKeyIntl);
                                            } catch (err) {
                                                await logError(
                                                    "airtime token expired or invalid",
                                                    "topup_trust_payment_airtime",
                                                    receiverWallet?.account?._id,
                                                    transaction_id,
                                                );
                                                return res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                            }

                                            if (airtimeType === "ranged") {
                                                try {
                                                    const rangedAirtimeTransaction = await createTransactionRangedHelper({ number: decoded.number, decoded, wallet_id: receiverWallet._id, transaction_id })

                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    if (rangedAirtimeTransaction?.status) {

                                                        res.redirect('https://my.insta-pay.ch/payment-status/airtime/success')
                                                    } else {
                                                        await logError(
                                                            `${rangedAirtimeTransaction?.message}`,
                                                            "topup_trust_payment_airtime",
                                                            receiverWallet?.account?._id,
                                                            transaction_id,
                                                        );
                                                        res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                                    }
                                                } catch (err) {
                                                    await logError(
                                                        err,
                                                        "topup_trust_payment_airtime",
                                                        receiverWallet?.account?._id,
                                                        transaction_id,
                                                    );
                                                    console.log(err, "err while confirming airtime")
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                                }

                                            } else if (airtimeType === "fixed") {
                                                try {
                                                    const fixedAirtimeTransaction = await createTransactionFixedHelper({ number: decoded.number, decoded, wallet_id: receiverWallet._id, transaction_id })
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();

                                                    if (fixedAirtimeTransaction?.status) {
                                                        res.redirect('https://my.insta-pay.ch/payment-status/airtime/success')
                                                    } else {
                                                        await logError(
                                                            `${fixedAirtimeTransaction?.message}`,
                                                            "topup_trust_payment_airtime",
                                                            receiverWallet?.account?._id,
                                                            transaction_id,
                                                        );
                                                        res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                                    }
                                                } catch (err) {
                                                    await logError(
                                                        err,
                                                        "topup_trust_payment_airtime",
                                                        receiverWallet?.account?._id,
                                                        transaction_id,
                                                    );
                                                    console.log(err, "err while confirming airtime")
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    res.redirect('https://my.insta-pay.ch/payment-status/airtime/error/null?add_funds=true')
                                                }
                                            }


                                        } else {
                                            await logError(
                                                `transactionDetails?.external_token?.type.startsWith("airtime")`,
                                                "topup_trust_payment_airtime",
                                                receiverWallet?.account?._id,
                                                transaction_id,
                                                { value: transactionDetails?.external_token?.type }
                                            );
                                            transactionDetails.external_token = undefined
                                            await transactionDetails.save();
                                            return res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/null`)
                                        }
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error 2",
                                            "topup_trust_payment_airtime",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'PENDING',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'PENDING'
                                        transactionDetails.external_token = undefined
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed 2",
                                        "topup_trust_payment_airtime",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'PENDING',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'PENDING'
                                    transactionDetails.external_token = undefined
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance 2: ${err.message}`,
                                    "topup_trust_payment_airtime",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'PENDING',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'PENDING'
                                transactionDetails.external_token = undefined
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error 2`,
                                "topup_trust_payment_airtime",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            transactionDetails.external_token = undefined
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2`,
                            "topup_trust_payment_airtime",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        transactionDetails.external_token = undefined
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                        "topup_trust_payment_airtime",
                        receiverWallet?.account?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    transactionDetails.external_token = undefined
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2`,
                    "topup_trust_payment_airtime",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );
                let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                transactionDetails.external_token = undefined
                await transactionDetails.save();
                res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/${errorCode}`)
            }
        })
    } catch (err) {
        await logError(
            err,
            "topup_trust_payment_airtime",
            null,
            req.params?.transaction_id || null,
        );
        // let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect(`https://my.insta-pay.ch/payment-status/airtime/error/null}`)
    }
}

module.exports.confirmAirtimeChatbotWebhook = async (req, res, next) => {
    try {
        console.log(`\u{1F7EA} Received bot airtime trustpayment webhook:`);
        console.dir(req.params);

        let transaction_id = req.params.transaction_id;
        let transactionDetails = await Transaction.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] }).populate([{ path: "account", populate: (['insta_recipient_id']) }])

        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails?.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company', 'insta_recipient_id']) }])

        const recipientBotId = receiverWallet?.account?.insta_recipient_id?.recipient || transactionDetails?.account?.insta_recipient_id?.recipient

        const chatbotData = { sender: { id: recipientBotId } };

        if (!transactionDetails) {
            await logError(
                "Transaction not found",
                "topup_trust_payment_airtime_ch",
                null,
                transaction_id,
                { routeParams: req.params }
            )
            await sendBotTemplate(chatbotData, "Error: Transaction details not found", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }

        if (!receiverWallet) {
            await logError(
                "Receiver wallet not found or inactive",
                "topup_trust_payment_airtime_ch",
                receiverWallet?.account?._id,
                transaction_id,
            );

            await sendBotTemplate(chatbotData, "Error: Receiver wallet not found", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        console.log({ bodyFromTrust: req.body })

        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "topup_trust_payment_airtime_ch",
                receiverWallet?.account?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            await sendBotTemplate(chatbotData, "Error: Transaction failed. Please try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        console.log("tokenintrust", token);
        jwt.verify(token, secretKey, async function (err, data) {
            console.log("dataintrust", data);
            if (err) {
                await logError(
                    "JWT verification error",
                    "topup_trust_payment_airtime_ch",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { jwtError: err }
                );
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'FAILED'
                await transactionDetails.save();
                await sendBotTemplate(chatbotData, "Error: Transaction Time Expired. Please try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
            console.log("payloadintrust", data.payload);
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)

                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }

                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {

                                        if (transactionDetails?.external_token?.type.startsWith("airtime")) {
                                            const airtimeType = transactionDetails?.external_token?.type.split("-")[1];
                                            console.log({ airtimeType })
                                            let decoded;
                                            try {
                                                decoded = jwt.verify(transactionDetails.external_token.token, secretKeyIntl);
                                            } catch (err) {
                                                await logError(
                                                    "airtime token expired or invalid",
                                                    "topup_trust_payment_airtime_ch",
                                                    receiverWallet?.account?._id,
                                                    transaction_id,
                                                );
                                                await sendBotTemplate(chatbotData, "Error: Transaction Time Expired. Please try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                                return res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                            }

                                            if (airtimeType === "ranged") {
                                                try {
                                                    const rangedAirtimeTransaction = await createTransactionRangedHelper({ number: decoded.number, decoded, wallet_id: receiverWallet._id, transaction_id })

                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    if (rangedAirtimeTransaction?.status) {

                                                        await sendBotTemplate(chatbotData, `Airtime Transaction of ${decoded.total.value} ${decoded.total.currency} confirmed`, "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png");

                                                        return res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/success')
                                                    } else {
                                                        await logError(
                                                            `${rangedAirtimeTransaction?.message}`,
                                                            "topup_trust_payment_airtime_ch",
                                                            receiverWallet?.account?._id,
                                                            transaction_id,
                                                        );
                                                        await sendBotTemplate(chatbotData, rangedAirtimeTransaction?.message, "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                                        res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                                    }
                                                } catch (err) {
                                                    await logError(
                                                        err,
                                                        "topup_trust_payment_airtime_ch",
                                                        receiverWallet?.account?._id,
                                                        transaction_id,
                                                    );
                                                    await sendBotTemplate(chatbotData, "Something went wrong while confirming your airtime. Please contact support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                                    console.log(err, "err while confirming airtime")
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                                }

                                            } else if (airtimeType === "fixed") {
                                                try {
                                                    const fixedAirtimeTransaction = await createTransactionFixedHelper({ number: decoded.number, decoded, wallet_id: receiverWallet._id, transaction_id })
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();

                                                    if (fixedAirtimeTransaction?.status) {
                                                        await sendBotTemplate(chatbotData, `Airtime Transaction of ${decoded?.name || "N/A"} confirmed`, "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png");

                                                        return res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/success')
                                                    } else {
                                                        await sendBotTemplate(chatbotData, fixedAirtimeTransaction?.message, "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                                        await logError(
                                                            `${fixedAirtimeTransaction?.message}`,
                                                            "topup_trust_payment_airtime_ch",
                                                            receiverWallet?.account?._id,
                                                            transaction_id,
                                                        );

                                                        res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                                    }
                                                } catch (err) {
                                                    await sendBotTemplate(chatbotData, "Something went wrong while confirming your airtime. Please contact support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                                    await logError(
                                                        err,
                                                        "topup_trust_payment_airtime_ch",
                                                        receiverWallet?.account?._id,
                                                        transaction_id,
                                                    );
                                                    console.log(err, "err while confirming airtime")
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                                }
                                            } else {
                                                await sendBotTemplate(chatbotData, "Something went wrong while confirming your airtime. Please contact support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                                await logError(
                                                    "airtime type not found",
                                                    "topup_trust_payment_airtime_ch",
                                                    receiverWallet?.account?._id,
                                                    transaction_id,
                                                );
                                                transactionDetails.external_token = undefined
                                                await transactionDetails.save();
                                                res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                            }


                                        } else {
                                            await sendBotTemplate(chatbotData, "Something went wrong while confirming your airtime. Please contact support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                            await logError(
                                                `transactionDetails?.external_token?.type.startsWith("airtime")`,
                                                "topup_trust_payment_airtime_ch",
                                                receiverWallet?.account?._id,
                                                transaction_id,
                                                { value: transactionDetails?.external_token?.type }
                                            );
                                            transactionDetails.external_token = undefined
                                            await transactionDetails.save();
                                            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true`)
                                        }
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error",
                                            "topup_trust_payment_airtime_ch",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        await sendBotTemplate(chatbotData, "Error: Transaction pending. Please contact InstaPay support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed",
                                        "topup_trust_payment_airtime_ch",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    await sendBotTemplate(chatbotData, "Error: Transaction pending. Please contact InstaPay support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance: ${err.message}`,
                                    "topup_trust_payment_airtime_ch",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                await sendBotTemplate(chatbotData, "Error: Transaction pending. Please contact InstaPay support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error`,
                                "topup_trust_payment_airtime_ch",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                            res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0"`,
                            "topup_trust_payment_airtime_ch",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                        "topup_trust_payment_airtime_ch",
                        receiverWallet?.account?._id,
                        transaction_id,
                        value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {

                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {

                                        if (transactionDetails?.external_token?.type.startsWith("airtime")) {
                                            const airtimeType = transactionDetails?.external_token?.type.split("-")[1];
                                            console.log({ airtimeType })
                                            let decoded;
                                            try {
                                                decoded = jwt.verify(transactionDetails.external_token.token, secretKeyIntl);
                                            } catch (err) {
                                                await logError(
                                                    "airtime token expired or invalid",
                                                    "topup_trust_payment_airtime_ch",
                                                    receiverWallet?.account?._id,
                                                    transaction_id,
                                                );
                                                await sendBotTemplate(chatbotData, "Error: Transaction Time Expired. Please try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                                return res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                            }

                                            if (airtimeType === "ranged") {
                                                try {
                                                    const rangedAirtimeTransaction = await createTransactionRangedHelper({ number: decoded.number, decoded, wallet_id: receiverWallet._id, transaction_id })

                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    if (rangedAirtimeTransaction?.status) {
                                                        await sendBotTemplate(chatbotData, `Airtime Transaction of ${decoded.total.value} ${decoded.total.currency} confirmed`, "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png");

                                                        res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/success')
                                                    } else {
                                                        await logError(
                                                            `${rangedAirtimeTransaction?.message}`,
                                                            "topup_trust_payment_airtime_ch",
                                                            receiverWallet?.account?._id,
                                                            transaction_id,
                                                        );
                                                        await sendBotTemplate(chatbotData, rangedAirtimeTransaction?.message, "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                                        res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                                    }
                                                } catch (err) {
                                                    await logError(
                                                        err,
                                                        "topup_trust_payment_airtime_ch",
                                                        receiverWallet?.account?._id,
                                                        transaction_id,
                                                    );
                                                    await sendBotTemplate(chatbotData, "Something went wrong while confirming your airtime. Please contact support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                                    console.log(err, "err while confirming airtime")
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                                }

                                            } else if (airtimeType === "fixed") {
                                                try {
                                                    const fixedAirtimeTransaction = await createTransactionFixedHelper({ number: decoded.number, decoded, wallet_id: receiverWallet._id, transaction_id })
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();

                                                    if (fixedAirtimeTransaction?.status) {
                                                        await sendBotTemplate(chatbotData, `Airtime Transaction of ${decoded?.name || "N/A"} confirmed`, "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png");

                                                        res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/success')
                                                    } else {
                                                        await sendBotTemplate(chatbotData, fixedAirtimeTransaction?.message, "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                                        await logError(
                                                            `${fixedAirtimeTransaction?.message}`,
                                                            "topup_trust_payment_airtime_ch",
                                                            receiverWallet?.account?._id,
                                                            transaction_id,
                                                        );

                                                        res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                                    }
                                                } catch (err) {
                                                    await sendBotTemplate(chatbotData, "Something went wrong while confirming your airtime. Please contact support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                                    await logError(
                                                        err,
                                                        "topup_trust_payment_airtime_ch",
                                                        receiverWallet?.account?._id,
                                                        transaction_id,
                                                    );
                                                    console.log(err, "err while confirming airtime")
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                                }
                                            } else {
                                                await sendBotTemplate(chatbotData, "Something went wrong while confirming your airtime. Please contact support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                                await logError(
                                                    "airtime type not found",
                                                    "topup_trust_payment_airtime_ch",
                                                    receiverWallet?.account?._id,
                                                    transaction_id,
                                                );
                                                transactionDetails.external_token = undefined
                                                await transactionDetails.save();
                                                res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                            }


                                        } else {
                                            await sendBotTemplate(chatbotData, "Something went wrong while confirming your airtime. Please contact support.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                            await logError(
                                                `transactionDetails?.external_token?.type.startsWith("airtime")`,
                                                "topup_trust_payment_airtime_ch",
                                                receiverWallet?.account?._id,
                                                transaction_id,
                                                { value: transactionDetails?.external_token?.type }
                                            );
                                            transactionDetails.external_token = undefined
                                            await transactionDetails.save();
                                            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true`)
                                        }
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error 2",
                                            "topup_trust_payment_airtime_ch",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );

                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed 2",
                                        "topup_trust_payment_airtime_ch",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance 2: ${err.message}`,
                                    "topup_trust_payment_airtime_ch",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error 2`,
                                "topup_trust_payment_airtime_ch",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                            res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2`,
                            "topup_trust_payment_airtime_ch",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        tr
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                        "topup_trust_payment_airtime_ch",
                        receiverWallet?.account?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2`,
                    "topup_trust_payment_airtime_ch",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );
                let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                await transactionDetails.save();
                await sendBotTemplate(chatbotData, "Error: Transaction failed.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/null`)
            }
        })
    } catch (err) {
        await logError(
            err,
            "topup_trust_payment_airtime_ch",
            null,
            req.params?.transaction_id || null,
        );
        console.error(err)
        // let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/null`)
    }

}

module.exports.confirmAirtimeChatbotWebhookTelegram = async (req, res, next) => {
    try {
        console.log(`\u{1F7EA} Received bot airtime trustpayment webhook-telegram:`);
        console.dir(req.params);

        let transaction_id = req.params.transaction_id;
        let transactionDetails = await Transaction.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] }).populate("account")

        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails?.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])

        const telegramBot = await TelegramBotModel.findOne({ recipient: transactionDetails?.account?.telegram_id }).select("selected_language")

        const chatId = transactionDetails?.account?.telegram_id;
        const selectedLanguage = telegramBot?.selected_language || transactionDetails?.account?.language || 'en';

        if (!transactionDetails) {
            await logError(
                "Transaction not found",
                "topup_trust_payment_airtime_ch_tg",
                null,
                transaction_id,
                { routeParams: req.params }
            )
            await sendButtons(chatId, "Error: Transaction details not found", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }

        if (!receiverWallet) {
            await logError(
                "Receiver wallet not found or inactive",
                "topup_trust_payment_airtime_ch_tg",
                receiverWallet?.account?._id,
                transaction_id,
            );

            await sendButtons(chatId, "Error: Receiver wallet not found", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        console.log({ bodyFromTrust: req.body })

        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "topup_trust_payment_airtime_ch_tg",
                receiverWallet?.account?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            await sendButtons(chatId, "Error: Transaction failed. Please try again.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`)
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        console.log("tokenintrust", token);
        jwt.verify(token, secretKey, async function (err, data) {
            console.log("dataintrust", data);
            if (err) {
                await logError(
                    "JWT verification error",
                    "topup_trust_payment_airtime_ch_tg",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { jwtError: err }
                );
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'FAILED'
                await transactionDetails.save();
                await sendButtons(chatId, "Error: Transaction Time Expired. Please try again", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
            console.log("payloadintrust", data.payload);
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)

                        let amount = parseFloat(innerToken.payload.mainamount)

                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {

                                        if (transactionDetails?.external_token?.type.startsWith("airtime")) {
                                            const airtimeType = transactionDetails?.external_token?.type.split("-")[1];
                                            console.log({ airtimeType })
                                            let decoded;
                                            try {
                                                decoded = jwt.verify(transactionDetails.external_token.token, secretKeyIntl);
                                            } catch (err) {
                                                await logError(
                                                    "airtime token expired or invalid",
                                                    "topup_trust_payment_airtime_ch_tg",
                                                    receiverWallet?.account?._id,
                                                    transaction_id,
                                                );
                                                await sendButtons(chatId, "Error: Transaction Time Expired. Please try again", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                                return res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                            }

                                            if (airtimeType === "ranged") {
                                                try {
                                                    const rangedAirtimeTransaction = await createTransactionRangedHelper({ number: decoded.number, decoded, wallet_id: receiverWallet._id, transaction_id })

                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    if (rangedAirtimeTransaction?.status) {

                                                        await sendButtons(chatId, `Airtime Transaction of ${formattedAmount(decoded.total.value)} ${decoded.total.currency} confirmed`, [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                                        return res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/success')
                                                    } else {
                                                        await logError(
                                                            `${rangedAirtimeTransaction?.message}`,
                                                            "topup_trust_payment_airtime_ch_tg",
                                                            receiverWallet?.account?._id,
                                                            transaction_id,
                                                        );
                                                        await sendButtons(chatId, rangedAirtimeTransaction?.message, [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                                        res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                                    }
                                                } catch (err) {
                                                    await logError(
                                                        err,
                                                        "topup_trust_payment_airtime_ch_tg",
                                                        receiverWallet?.account?._id,
                                                        transaction_id,
                                                    );
                                                    await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                                    console.log(err, "err while confirming airtime")
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                                }

                                            } else if (airtimeType === "fixed") {
                                                try {
                                                    const fixedAirtimeTransaction = await createTransactionFixedHelper({ number: decoded.number, decoded, wallet_id: receiverWallet._id, transaction_id })
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();

                                                    if (fixedAirtimeTransaction?.status) {
                                                        await sendButtons(
                                                            chatId,
                                                            `Airtime Transaction of ${decoded?.name || "N/A"} confirmed`,
                                                            [[{ text: "Main Menu", callback_data: "main_menu" }]],
                                                            "4"
                                                        );

                                                        return res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/success');
                                                    } else {
                                                        await sendButtons(
                                                            chatId,
                                                            fixedAirtimeTransaction?.message,
                                                            [[{ text: "Main Menu", callback_data: "main_menu" }]],
                                                            "4"
                                                        );

                                                        await logError(
                                                            `${fixedAirtimeTransaction?.message}`,
                                                            "topup_trust_payment_airtime_ch_tg",
                                                            receiverWallet?.account?._id,
                                                            transaction_id,
                                                        );

                                                        res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true');
                                                    }
                                                } catch (err) {
                                                    await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                                    await logError(
                                                        err,
                                                        "topup_trust_payment_airtime_ch_tg",
                                                        receiverWallet?.account?._id,
                                                        transaction_id,
                                                    );
                                                    console.log(err, "err while confirming airtime")
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                                }
                                            } else {
                                                await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                                await logError(
                                                    "airtime type not found",
                                                    "topup_trust_payment_airtime_ch_tg",
                                                    receiverWallet?.account?._id,
                                                    transaction_id,
                                                );
                                                transactionDetails.external_token = undefined
                                                await transactionDetails.save();
                                                res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                            }


                                        } else {
                                            await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                            await logError(
                                                `transactionDetails?.external_token?.type.startsWith("airtime")`,
                                                "topup_trust_payment_airtime_ch_tg",
                                                receiverWallet?.account?._id,
                                                transaction_id,
                                                { value: transactionDetails?.external_token?.type }
                                            );
                                            transactionDetails.external_token = undefined
                                            await transactionDetails.save();
                                            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true`)
                                        }
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error",
                                            "topup_trust_payment_airtime_ch_tg",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed",
                                        "topup_trust_payment_airtime_ch_tg",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance: ${err.message}`,
                                    "topup_trust_payment_airtime_ch_tg",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error`,
                                "topup_trust_payment_airtime_ch_tg",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                            res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0"`,
                            "topup_trust_payment_airtime_ch_tg",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                        "topup_trust_payment_airtime_ch_tg",
                        receiverWallet?.account?._id,
                        transaction_id,
                        value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {

                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {

                                        if (transactionDetails?.external_token?.type.startsWith("airtime")) {
                                            const airtimeType = transactionDetails?.external_token?.type.split("-")[1];
                                            console.log({ airtimeType })
                                            let decoded;
                                            try {
                                                decoded = jwt.verify(transactionDetails.external_token.token, secretKeyIntl);
                                            } catch (err) {
                                                await logError(
                                                    "airtime token expired or invalid",
                                                    "topup_trust_payment_airtime_ch_tg",
                                                    receiverWallet?.account?._id,
                                                    transaction_id,
                                                );
                                                await sendButtons(chatId, "Error: Transaction Time Expired. Please try again", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                                return res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                            }

                                            if (airtimeType === "ranged") {
                                                try {
                                                    const rangedAirtimeTransaction = await createTransactionRangedHelper({ number: decoded.number, decoded, wallet_id: receiverWallet._id, transaction_id })

                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    if (rangedAirtimeTransaction?.status) {
                                                        await sendButtons(
                                                            chatId,
                                                            `Airtime Transaction of ${formattedAmount(decoded.total.value)} ${decoded.total.currency} confirmed`,
                                                            [[{ text: "Main Menu", callback_data: "main_menu" }]],
                                                            "4"
                                                        );

                                                        res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/success')
                                                    } else {
                                                        await logError(
                                                            `${rangedAirtimeTransaction?.message}`,
                                                            "topup_trust_payment_airtime_ch_tg",
                                                            receiverWallet?.account?._id,
                                                            transaction_id,
                                                        );
                                                        await sendButtons(
                                                            chatId,
                                                            rangedAirtimeTransaction?.message, [[{ text: "Main Menu", callback_data: "main_menu" }]],
                                                            "4"
                                                        );

                                                        res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                                    }
                                                } catch (err) {
                                                    await logError(
                                                        err,
                                                        "topup_trust_payment_airtime_ch_tg",
                                                        receiverWallet?.account?._id,
                                                        transaction_id,
                                                    );
                                                    await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                                    console.log(err, "err while confirming airtime")
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                                }

                                            } else if (airtimeType === "fixed") {
                                                try {
                                                    const fixedAirtimeTransaction = await createTransactionFixedHelper({ number: decoded.number, decoded, wallet_id: receiverWallet._id, transaction_id })
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();

                                                    if (fixedAirtimeTransaction?.status) {
                                                        await sendButtons(
                                                            chatId,
                                                            `Airtime Transaction of ${decoded?.name || "N/A"} confirmed`,
                                                            [[{ text: "Main Menu", callback_data: "main_menu" }]],
                                                            "4"
                                                        );
                                                        res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/success')
                                                    } else {
                                                        await sendButtons(
                                                            chatId,
                                                            fixedAirtimeTransaction?.message,
                                                            [[{ text: "Main Menu", callback_data: "main_menu" }]],
                                                            "4"
                                                        );
                                                        await logError(
                                                            `${fixedAirtimeTransaction?.message}`,
                                                            "topup_trust_payment_airtime_ch_tg",
                                                            receiverWallet?.account?._id,
                                                            transaction_id,
                                                        );

                                                        res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                                    }
                                                } catch (err) {
                                                    await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                                    await logError(
                                                        err,
                                                        "topup_trust_payment_airtime_ch_tg",
                                                        receiverWallet?.account?._id,
                                                        transaction_id,
                                                    );
                                                    console.log(err, "err while confirming airtime")
                                                    transactionDetails.external_token = undefined
                                                    await transactionDetails.save();
                                                    res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                                }
                                            } else {
                                                await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                                await logError(
                                                    "airtime type not found",
                                                    "topup_trust_payment_airtime_ch_tg",
                                                    receiverWallet?.account?._id,
                                                    transaction_id,
                                                );
                                                transactionDetails.external_token = undefined
                                                await transactionDetails.save();
                                                res.redirect('https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true')
                                            }


                                        } else {
                                            await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                            await logError(
                                                `transactionDetails?.external_token?.type.startsWith("airtime")`,
                                                "topup_trust_payment_airtime_ch_tg",
                                                receiverWallet?.account?._id,
                                                transaction_id,
                                                { value: transactionDetails?.external_token?.type }
                                            );
                                            transactionDetails.external_token = undefined
                                            await transactionDetails.save();
                                            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null?add_funds=true`)
                                        }
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error 2",
                                            "topup_trust_payment_airtime_ch_tg",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );

                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed 2",
                                        "topup_trust_payment_airtime_ch_tg",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance 2: ${err.message}`,
                                    "topup_trust_payment_airtime_ch_tg",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error 2`,
                                "topup_trust_payment_airtime_ch_tg",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                            res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2`,
                            "topup_trust_payment_airtime_ch_tg",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        tr
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                        "topup_trust_payment_airtime_ch_tg",
                        receiverWallet?.account?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                    res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/${errorCode}`)
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2`,
                    "topup_trust_payment_airtime_ch_tg",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );
                let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                await transactionDetails.save();
                await sendButtons(chatId, "Something went wrong while confirming your airtime. Please contact support.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/null`)
            }
        })
    } catch (err) {
        await logError(
            err,
            "topup_trust_payment_airtime_ch_tg",
            null,
            req.params?.transaction_id || null,
        );
        console.error(err)
        // let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/failed/null`)
    }

}

// VCC topup using saved card
// Helper function to perform VCC topup
async function performVCCTopup(cardId, amount, fee) {
    try {
        const requestData = {
            cardId: cardId,
            amt: (amount - fee).toString()
        };

        console.log({ requestData });

        const encryptedData = encryptDataVCC(requestData);
        const payload = { data: encryptedData };

        const apiResponse = await axios.post(`${process.env.vccdaddyURL}/openapi/card/hk/recharge`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'oaToken': process.env.vccToken,
            }
        });
        console.log({ apiResponse });

        if (apiResponse.data.code !== 1) {
            return { success: false, errorCode: apiResponse.data.code, errorMessage: 'Card top-up failed' };
        }

        return { success: true };
    } catch (error) {
        console.error('Error in performVCCTopup:', error);
        let errorCode = 'UNKNOWN_ERROR';
        let errorMessage = error.message;

        if (error.response) {
            errorCode = error.response.data?.code || error.response.status;
            errorMessage = error.response.data?.message || error.message;
        } else if (error.request) {
            errorCode = 'NO_RESPONSE';
            errorMessage = 'No response received from VCC API';
        }

        return {
            success: false,
            errorCode: errorCode,
            errorMessage: errorMessage
        };
    }
}

module.exports.confirmVCCTopupWithSaveCardTelegram = async (req, res) => {
    try {
        let transaction_id = req.params.transaction_id;
        let transaction_token = req.params.token;
        console.log({ params: req.params, body: req.body })
        let transactionDetails = await VCCTransactionModel.findOne({ $and: [{ _id: transaction_id }, { transaction_type: 'mastercard_topup' }, { status: 'INITIATED' }] }).populate("accountId");
        console.log({ transactionDetails })
        const telegramBot = await TelegramBotModel.findOne({ recipient: transactionDetails?.accountId?.telegram_id }).select("selected_language")

        const chatId = transactionDetails?.accountId?.telegram_id;
        const selectedLanguage = telegramBot?.selected_language || transactionDetails?.accountId?.language || 'en';
        if (!transactionDetails) {
            await logError(
                "Transaction not found",
                "topup_trust_payment",
                null,
                transaction_id,
                { routeParams: req.params }
            );

            await sendButtons(chatId, "Error: Transaction details not found", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

            return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`);
        }

        const receiverTimezone = transactionDetails.accountId?.timezone || "UTC";
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "topup_trust_payment",
                transactionDetails?.accountId?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            });
            transactionDetails['status'] = 'FAILED';
            await transactionDetails.save();

            await sendButtons(chatId, "Error: Transaction failed. Please try again", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

            return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${req.body.errorcode}`);
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt;
        jwt.verify(token, secretKey, async function (err, data) {
            if (err) {
                await logError(
                    "JWT verification error",
                    "topup_trust_payment",
                    transactionDetails?.accountId?._id,
                    transaction_id,
                    { jwtError: err }
                );
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                });
                transactionDetails['status'] = 'FAILED';
                await transactionDetails.save();

                await sendButtons(chatId, "Error: Transaction Time Expired. Please try again", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`);
            }
            console.log(data.payload);
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode;
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = jwt.verify(data.payload.jwt, secretKey);

                        let amount = parseFloat(innerToken.payload.mainamount);

                        if (amount == transactionDetails.txAmount) {
                            let decoded;
                            try {
                                decoded = jwt.verify(transaction_token, process.env.jwtKey);
                            } catch (error) {
                                await logError(
                                    "transaction token expired",
                                    "topup_trust_payment",
                                    transactionDetails?.accountId?._id,
                                    transaction_id,
                                    { jwtError: error }
                                );

                                await sendButtons(chatId, "Error: Transaction Time Expired. Please try again", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`);
                            }

                            const topupResult = await performVCCTopup(decoded.cardId, decoded.amount, decoded.fee);

                            if (!topupResult.success) {
                                await logError(
                                    topupResult.errorMessage,
                                    "topup_trust_payment",
                                    transactionDetails?.accountId?._id,
                                    transaction_id,
                                    { errorCode: topupResult.errorCode }
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                });
                                transactionDetails.status = 'FAILED';
                                await transactionDetails.save();

                                await sendButtons(chatId, "Error: Transaction failed. Please try again", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null`);
                            }

                            transactionDetails.timeline.push({
                                status: 'COMPLETED',
                                date: receiverCurrentTime,
                            });
                            transactionDetails.status = "COMPLETED";
                            await transactionDetails.save();

                            const message = `Your topup of ${formattedAmount(decoded.amount)} ${decoded.currency} was successful.`

                            await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", message, "4");
                            const buttons = [
                                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                                [{ text: "My MasterCard", callback_data: "vcc_menu" }],
                            ];
                            await sendButtons(chatId, `${lang[selectedLanguage].TRANSACTION_ID} ${transactionDetails.transactionId}`, buttons, "4");

                            return res.redirect(`https://my.insta-pay.ch/add-funds/card/success`);
                        } else {
                            await logError(
                                `(amount == transactionDetails.txAmount) error`,
                                "topup_trust_payment",
                                transactionDetails?.accountId?._id,
                                transaction_id,
                                { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            });
                            transactionDetails['status'] = 'FAILED';
                            await transactionDetails.save();

                            await sendButtons(chatId, "Error: Transaction failed. Please try again", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                            return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0"`,
                            "topup_trust_payment",
                            transactionDetails?.accountId?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );

                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        });
                        transactionDetails['status'] = 'FAILED';
                        await transactionDetails.save();

                        await sendButtons(chatId, "Error: Transaction failed. Please try again", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                        return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                        "topup_trust_payment",
                        transactionDetails?.accountId?._id,
                        transaction_id,
                        { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    });
                    transactionDetails['status'] = 'FAILED';
                    await transactionDetails.save();

                    await sendButtons(chatId, "Error: Transaction failed. Please try again", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                    return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {
                        let innerToken = jwt.verify(data.payload.jwt, secretKey);
                        let amount = parseFloat(innerToken.payload.mainamount);

                        if (amount == transactionDetails.txAmount) {
                            let decoded;
                            try {
                                decoded = jwt.verify(transaction_token, process.env.jwtKey);
                            } catch (error) {
                                await logError(
                                    "transaction token expired",
                                    "topup_trust_payment",
                                    transactionDetails?.accountId?._id,
                                    transaction_id,
                                    { jwtError: error }
                                );

                                await sendButtons(chatId, "Error: Transaction Time Expired. Please try again", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`);
                            }

                            const topupResult = await performVCCTopup(decoded.cardId, decoded.amount, decoded.fee);

                            if (!topupResult.success) {
                                await logError(
                                    topupResult.errorMessage,
                                    "topup_trust_payment",
                                    transactionDetails?.accountId?._id,
                                    transaction_id,
                                    { errorCode: topupResult.errorCode }
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                });
                                transactionDetails.status = 'FAILED';
                                await transactionDetails.save();

                                await sendButtons(chatId, "Error: Transaction failed. Please try again", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                                return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null`);
                            }

                            transactionDetails.timeline.push({
                                status: 'COMPLETED',
                                date: receiverCurrentTime,
                            });
                            transactionDetails.status = "COMPLETED";
                            await transactionDetails.save();

                            const message = `Your topup of ${formattedAmount(decoded.amount)} ${decoded.currency} was successful.`

                            await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", message, "4");
                            const buttons = [
                                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                                [{ text: "My MasterCard", callback_data: "vcc_menu" }],
                            ];
                            await sendButtons(chatId, `${lang[selectedLanguage].TRANSACTION_ID} ${transactionDetails.transactionId}`, buttons, "4");

                            return res.redirect(`https://my.insta-pay.ch/add-funds/card/success`);
                        } else {
                            await logError(
                                `(amount == transactionDetails.txAmount) error 2`,
                                "topup_trust_payment",
                                transactionDetails?.accountId?._id,
                                transaction_id,
                                { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            });
                            transactionDetails['status'] = 'FAILED';
                            await transactionDetails.save();

                            await sendButtons(chatId, "Error: Transaction failed. Please try again", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                            return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2`,
                            "topup_trust_payment",
                            transactionDetails?.accountId?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        });
                        transactionDetails['status'] = 'FAILED';
                        await transactionDetails.save();

                        await sendButtons(chatId, "Error: Transaction failed. Please try again", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                        return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                        "topup_trust_payment",
                        transactionDetails?.accountId?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );

                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    });
                    transactionDetails['status'] = 'FAILED';
                    await transactionDetails.save();

                    await sendButtons(chatId, "Error: Transaction failed. Please try again", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                    return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2`,
                    "topup_trust_payment",
                    transactionDetails?.accountId?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );

                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                });
                transactionDetails.status = "FAILED";
                await transactionDetails.save();

                await sendButtons(chatId, "Error: Transaction failed. Please try again", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");

                return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null`);
            }
        });
    } catch (err) {
        await logError(
            err,
            "topup_trust_payment",
            null,
            req.params?.transaction_id || null,
        );

        return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null`);
    }
};

module.exports.confirmVCCTopupWithSaveCardInstagram = async (req, res) => {
    try {
        let transaction_id = req.params.transaction_id;
        let transaction_token = req.params.token;
        console.log({ params: req.params, body: req.body })
        let transactionDetails = await VCCTransactionModel.findOne({ $and: [{ _id: transaction_id }, { transaction_type: 'mastercard_topup' }, { status: 'INITIATED' }] })
            .populate([{ path: "accountId", populate: ("insta_recipient_id") }]);
        console.log({ transactionDetails })

        const selectedLanguage = transactionDetails?.accountId?.insta_recipient_id?.active_language || transactionDetails?.accountId?.language || 'en';
        const chatbotData = { sender: { id: transactionDetails?.accountId?.insta_subscriber_id } };
        if (!transactionDetails) {
            await logError(
                "Transaction not found",
                "topup_trust_payment",
                null,
                transaction_id,
                { routeParams: req.params }
            );

            await sendBotTemplate(chatbotData, "Error: Transaction details not found", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

            return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`);
        }

        const receiverTimezone = transactionDetails.accountId?.timezone || "UTC";
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "topup_trust_payment",
                transactionDetails?.accountId?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            });
            transactionDetails['status'] = 'FAILED';
            await transactionDetails.save();

            await sendBotTemplate(chatbotData, "Error: Transaction failed. Please try again", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

            return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${req.body.errorcode}`);
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt;
        jwt.verify(token, secretKey, async function (err, data) {
            if (err) {
                await logError(
                    "JWT verification error",
                    "topup_trust_payment",
                    transactionDetails?.accountId?._id,
                    transaction_id,
                    { jwtError: err }
                );
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                });
                transactionDetails['status'] = 'FAILED';
                await transactionDetails.save();

                await sendBotTemplate(chatbotData, "Error: Transaction Time Expired. Please try again", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`);
            }
            console.log(data.payload);
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode;
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = jwt.verify(data.payload.jwt, secretKey);

                        let amount = parseFloat(innerToken.payload.mainamount);

                        if (amount == transactionDetails.txAmount) {
                            let decoded;
                            try {
                                decoded = jwt.verify(transaction_token, process.env.jwtKey);
                            } catch (error) {
                                await logError(
                                    "transaction token expired",
                                    "topup_trust_payment",
                                    transactionDetails?.accountId?._id,
                                    transaction_id,
                                    { jwtError: error }
                                );

                                await sendBotTemplate(chatbotData, "Error: Transaction Time Expired. Please try again", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`);
                            }

                            const topupResult = await performVCCTopup(decoded.cardId, decoded.amount, decoded.fee);

                            if (!topupResult.success) {
                                await logError(
                                    topupResult.errorMessage,
                                    "topup_trust_payment",
                                    transactionDetails?.accountId?._id,
                                    transaction_id,
                                    { errorCode: topupResult.errorCode }
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                });
                                transactionDetails.status = 'FAILED';
                                await transactionDetails.save();

                                await sendBotTemplate(chatbotData, "Error: Transaction failed. Please try again", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null`);
                            }

                            transactionDetails.timeline.push({
                                status: 'COMPLETED',
                                date: receiverCurrentTime,
                            });
                            transactionDetails.status = "COMPLETED";
                            await transactionDetails.save();

                            const message = `Your topup of ${formattedAmount(decoded.amount)} ${decoded.currency} was successful.`;

                            await sendTemplate(chatbotData, chatbotData?.sender?.id, {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: message,
                                        subtitle: `${lang[selectedLanguage].TRANSACTION_ID} ${transactionDetails.transactionId}`,
                                        image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                                        buttons: [
                                            { type: "postback", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                            { type: "postback", title: "My MasterCard", payload: "vcc_menu" },
                                        ],
                                    },
                                ],
                            }, "4");

                            return res.redirect(`https://my.insta-pay.ch/add-funds/card/success`);
                        } else {
                            await logError(
                                `(amount == transactionDetails.txAmount) error`,
                                "topup_trust_payment",
                                transactionDetails?.accountId?._id,
                                transaction_id,
                                { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            });
                            transactionDetails['status'] = 'FAILED';
                            await transactionDetails.save();

                            await sendBotTemplate(chatbotData, "Error: Transaction failed. Please try again", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                            return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0"`,
                            "topup_trust_payment",
                            transactionDetails?.accountId?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );

                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        });
                        transactionDetails['status'] = 'FAILED';
                        await transactionDetails.save();

                        await sendBotTemplate(chatbotData, "Error: Transaction failed. Please try again", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                        return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                        "topup_trust_payment",
                        transactionDetails?.accountId?._id,
                        transaction_id,
                        { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    });
                    transactionDetails['status'] = 'FAILED';
                    await transactionDetails.save();

                    await sendBotTemplate(chatbotData, "Error: Transaction failed. Please try again", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                    return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {
                        let innerToken = jwt.verify(data.payload.jwt, secretKey);
                        let amount = parseFloat(innerToken.payload.mainamount);

                        if (amount == transactionDetails.txAmount) {
                            let decoded;
                            try {
                                decoded = jwt.verify(transaction_token, process.env.jwtKey);
                            } catch (error) {
                                await logError(
                                    "transaction token expired",
                                    "topup_trust_payment",
                                    transactionDetails?.accountId?._id,
                                    transaction_id,
                                    { jwtError: error }
                                );

                                await sendBotTemplate(chatbotData, "Error: Transaction Time Expired. Please try again", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`);
                            }

                            const topupResult = await performVCCTopup(decoded.cardId, decoded.amount, decoded.fee);

                            if (!topupResult.success) {
                                await logError(
                                    topupResult.errorMessage,
                                    "topup_trust_payment",
                                    transactionDetails?.accountId?._id,
                                    transaction_id,
                                    { errorCode: topupResult.errorCode }
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                });
                                transactionDetails.status = 'FAILED';
                                await transactionDetails.save();

                                await sendBotTemplate(chatbotData, "Error: Transaction failed. Please try again", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                                return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null`);
                            }

                            transactionDetails.timeline.push({
                                status: 'COMPLETED',
                                date: receiverCurrentTime,
                            });
                            transactionDetails.status = "COMPLETED";
                            await transactionDetails.save();

                            const message = `Your topup of ${formattedAmount(decoded.amount)} ${decoded.currency} was successful.`;

                            await sendTemplate(chatbotData, chatbotData?.sender?.id, {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: message,
                                        subtitle: `${lang[selectedLanguage].TRANSACTION_ID} ${transactionDetails.transactionId}`,
                                        image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                                        buttons: [
                                            { type: "postback", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                            { type: "postback", title: "My MasterCard", payload: "vcc_menu" },
                                        ],
                                    },
                                ],
                            }, "4");

                            return res.redirect(`https://my.insta-pay.ch/add-funds/card/success`);
                        } else {
                            await logError(
                                `(amount == transactionDetails.txAmount) error 2`,
                                "topup_trust_payment",
                                transactionDetails?.accountId?._id,
                                transaction_id,
                                { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            });
                            transactionDetails['status'] = 'FAILED';
                            await transactionDetails.save();

                            await sendBotTemplate(chatbotData, "Error: Transaction failed. Please try again", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                            return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2`,
                            "topup_trust_payment",
                            transactionDetails?.accountId?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        });
                        transactionDetails['status'] = 'FAILED';
                        await transactionDetails.save();

                        await sendBotTemplate(chatbotData, "Error: Transaction failed. Please try again", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                        return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                        "topup_trust_payment",
                        transactionDetails?.accountId?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );

                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    });
                    transactionDetails['status'] = 'FAILED';
                    await transactionDetails.save();

                    await sendBotTemplate(chatbotData, "Error: Transaction failed. Please try again", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                    return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2`,
                    "topup_trust_payment",
                    transactionDetails?.accountId?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );

                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                });
                transactionDetails.status = "FAILED";
                await transactionDetails.save();

                await sendBotTemplate(chatbotData, "Error: Transaction failed. Please try again", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null`);
            }
        });
    } catch (err) {
        await logError(
            err,
            "topup_trust_payment",
            null,
            req.params?.transaction_id || null,
        );

        return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null`);
    }
};

module.exports.confirmVCCTopupWithSaveCard = async (req, res) => {
    try {
        let transaction_id = req.params.transaction_id;
        let transaction_token = req.params.token;
        console.log({ params: req.params, body: req.body })
        let transactionDetails = await VCCTransactionModel.findOne({ $and: [{ _id: transaction_id }, { transaction_type: 'mastercard_topup' }, { status: 'INITIATED' }] }).populate("accountId");
        console.log({ transactionDetails })

        if (!transactionDetails) {
            await logError(
                "Transaction not found",
                "topup_trust_payment",
                null,
                transaction_id,
                { routeParams: req.params }
            );

            return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`);
        }

        const receiverTimezone = transactionDetails.accountId?.timezone || "UTC";
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "topup_trust_payment",
                transactionDetails?.accountId?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            });
            transactionDetails['status'] = 'FAILED';
            await transactionDetails.save();

            return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${req.body.errorcode}`);
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt;
        jwt.verify(token, secretKey, async function (err, data) {
            if (err) {
                await logError(
                    "JWT verification error",
                    "topup_trust_payment",
                    transactionDetails?.accountId?._id,
                    transaction_id,
                    { jwtError: err }
                );
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                });
                transactionDetails['status'] = 'FAILED';
                await transactionDetails.save();

                return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`);
            }
            console.log(data.payload);
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode;
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = jwt.verify(data.payload.jwt, secretKey);

                        let amount = parseFloat(innerToken.payload.mainamount);

                        if (amount == transactionDetails.txAmount) {
                            let decoded;
                            try {
                                decoded = jwt.verify(transaction_token, process.env.jwtKey);
                            } catch (error) {
                                await logError(
                                    "transaction token expired",
                                    "topup_trust_payment",
                                    transactionDetails?.accountId?._id,
                                    transaction_id,
                                    { jwtError: error }
                                );

                                return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`);
                            }

                            const topupResult = await performVCCTopup(decoded.cardId, decoded.amount, decoded.fee);

                            if (!topupResult.success) {
                                await logError(
                                    topupResult.errorMessage,
                                    "topup_trust_payment",
                                    transactionDetails?.accountId?._id,
                                    transaction_id,
                                    { errorCode: topupResult.errorCode }
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                });
                                transactionDetails.status = 'FAILED';
                                await transactionDetails.save();

                                return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null`);
                            }

                            transactionDetails.timeline.push({
                                status: 'COMPLETED',
                                date: receiverCurrentTime,
                            });
                            transactionDetails.status = "COMPLETED";
                            await transactionDetails.save();

                            return res.redirect(`https://my.insta-pay.ch/add-funds/card/success`);
                        } else {
                            await logError(
                                `(amount == transactionDetails.txAmount) error`,
                                "topup_trust_payment",
                                transactionDetails?.accountId?._id,
                                transaction_id,
                                { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            });
                            transactionDetails['status'] = 'FAILED';
                            await transactionDetails.save();

                            return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0"`,
                            "topup_trust_payment",
                            transactionDetails?.accountId?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );

                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        });
                        transactionDetails['status'] = 'FAILED';
                        await transactionDetails.save();

                        return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                        "topup_trust_payment",
                        transactionDetails?.accountId?._id,
                        transaction_id,
                        { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    });
                    transactionDetails['status'] = 'FAILED';
                    await transactionDetails.save();

                    return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {
                        let innerToken = jwt.verify(data.payload.jwt, secretKey);
                        let amount = parseFloat(innerToken.payload.mainamount);

                        if (amount == transactionDetails.txAmount) {
                            let decoded;
                            try {
                                decoded = jwt.verify(transaction_token, process.env.jwtKey);
                            } catch (error) {
                                await logError(
                                    "transaction token expired",
                                    "topup_trust_payment",
                                    transactionDetails?.accountId?._id,
                                    transaction_id,
                                    { jwtError: error }
                                );

                                return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`);
                            }

                            const topupResult = await performVCCTopup(decoded.cardId, decoded.amount, decoded.fee);

                            if (!topupResult.success) {
                                await logError(
                                    topupResult.errorMessage,
                                    "topup_trust_payment",
                                    transactionDetails?.accountId?._id,
                                    transaction_id,
                                    { errorCode: topupResult.errorCode }
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                });
                                transactionDetails.status = 'FAILED';
                                await transactionDetails.save();

                                return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null`);
                            }

                            transactionDetails.timeline.push({
                                status: 'COMPLETED',
                                date: receiverCurrentTime,
                            });
                            transactionDetails.status = "COMPLETED";
                            await transactionDetails.save();

                            return res.redirect(`https://my.insta-pay.ch/add-funds/card/success`);
                        } else {
                            await logError(
                                `(amount == transactionDetails.txAmount) error 2`,
                                "topup_trust_payment",
                                transactionDetails?.accountId?._id,
                                transaction_id,
                                { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            });
                            transactionDetails['status'] = 'FAILED';
                            await transactionDetails.save();

                            return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2`,
                            "topup_trust_payment",
                            transactionDetails?.accountId?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        });
                        transactionDetails['status'] = 'FAILED';
                        await transactionDetails.save();

                        return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                        "topup_trust_payment",
                        transactionDetails?.accountId?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );

                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    });
                    transactionDetails['status'] = 'FAILED';
                    await transactionDetails.save();

                    return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2`,
                    "topup_trust_payment",
                    transactionDetails?.accountId?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );

                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                });
                transactionDetails.status = "FAILED";
                await transactionDetails.save();

                return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null`);
            }
        });
    } catch (err) {
        await logError(
            err,
            "topup_trust_payment",
            null,
            req.params?.transaction_id || null,
        );

        return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null`);
    }
};

module.exports.confirmVCCTopupWithOutSaveCard = async (req, res) => {
    try {
        let transaction_id = req.params.transaction_id;
        let transaction_token = req.params.token;
        console.log({ params: req.params, body: req.body })
        let transactionDetails = await VCCTransactionModel.findOne({ $and: [{ _id: transaction_id }, { transaction_type: 'mastercard_topup' }, { status: 'INITIATED' }] }).populate("accountId");
        console.log({ transactionDetails })

        if (!transactionDetails) {
            await logError(
                "Transaction not found",
                "topup_trust_payment_vcc_w/o_savedcard",
                null,
                transaction_id,
                { routeParams: req.params }
            );

            return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`);
        }

        const receiverTimezone = transactionDetails.accountId?.timezone || "UTC";
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "topup_trust_payment_vcc_w/o_savedcard",
                transactionDetails?.accountId?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            });
            transactionDetails['status'] = 'FAILED';
            await transactionDetails.save();

            return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${req.body.errorcode}`);
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt;
        jwt.verify(token, secretKey, async function (err, data) {
            if (err) {
                await logError(
                    "JWT verification error",
                    "topup_trust_payment_vcc_w/o_savedcard",
                    transactionDetails?.accountId?._id,
                    transaction_id,
                    { jwtError: err }
                );
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                });
                transactionDetails['status'] = 'FAILED';
                await transactionDetails.save();

                return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`);
            }
            console.log(data.payload);
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode;
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = jwt.verify(data.payload.jwt, secretKey);

                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();

                        let amount = parseFloat(innerToken.payload.mainamount);

                        if (transactionDetails.is_card_save) {
                            try {
                                let panObj = {
                                    panData: panDetails,
                                    last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                    status: true,
                                    account: receiverWallet.account._id
                                }
                                let panCreated = await Pan.create(panObj);

                            } catch (err) {
                                await logError(
                                    "pan data couldn't be saved",
                                    "topup_trust_payment_vcc_w/o_savedcard",
                                    transactionDetails?.accountId?._id,
                                    transaction_id,
                                    { jwtError: error }
                                );
                            }
                        }

                        if (amount == transactionDetails.txAmount) {
                            let decoded;
                            try {
                                decoded = jwt.verify(transaction_token, process.env.jwtKey);
                            } catch (error) {
                                await logError(
                                    "transaction token expired",
                                    "topup_trust_payment_vcc_w/o_savedcard",
                                    transactionDetails?.accountId?._id,
                                    transaction_id,
                                    { jwtError: error }
                                );

                                return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`);
                            }

                            const topupResult = await performVCCTopup(decoded.cardId, decoded.amount, decoded.fee);

                            if (!topupResult.success) {
                                await logError(
                                    topupResult.errorMessage,
                                    "topup_trust_payment_vcc_w/o_savedcard",
                                    transactionDetails?.accountId?._id,
                                    transaction_id,
                                    { errorCode: topupResult.errorCode }
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                });
                                transactionDetails.status = 'FAILED';
                                await transactionDetails.save();

                                return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null`);
                            }

                            transactionDetails.timeline.push({
                                status: 'COMPLETED',
                                date: receiverCurrentTime,
                            });
                            transactionDetails.status = "COMPLETED";
                            await transactionDetails.save();

                            return res.redirect(`https://my.insta-pay.ch/add-funds/card/success`);
                        } else {
                            await logError(
                                `(amount == transactionDetails.txAmount) error`,
                                "topup_trust_payment_vcc_w/o_savedcard",
                                transactionDetails?.accountId?._id,
                                transaction_id,
                                { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            });
                            transactionDetails['status'] = 'FAILED';
                            await transactionDetails.save();

                            return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0"`,
                            "topup_trust_payment_vcc_w/o_savedcard",
                            transactionDetails?.accountId?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );

                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        });
                        transactionDetails['status'] = 'FAILED';
                        await transactionDetails.save();

                        return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                        "topup_trust_payment_vcc_w/o_savedcard",
                        transactionDetails?.accountId?._id,
                        transaction_id,
                        { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    });
                    transactionDetails['status'] = 'FAILED';
                    await transactionDetails.save();

                    return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {
                        let innerToken = jwt.verify(data.payload.jwt, secretKey);

                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        let amount = parseFloat(innerToken.payload.mainamount);

                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: transactionDetails.accountId._id
                            }
                            let panCreated = await Pan.create(panObj);
                        }

                        if (amount == transactionDetails.txAmount) {
                            let decoded;
                            try {
                                decoded = jwt.verify(transaction_token, process.env.jwtKey);
                            } catch (error) {
                                await logError(
                                    "transaction token expired",
                                    "topup_trust_payment_vcc_w/o_savedcard",
                                    transactionDetails?.accountId?._id,
                                    transaction_id,
                                    { jwtError: error }
                                );

                                return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`);
                            }

                            const topupResult = await performVCCTopup(decoded.cardId, decoded.amount, decoded.fee);

                            if (!topupResult.success) {
                                await logError(
                                    topupResult.errorMessage,
                                    "topup_trust_payment_vcc_w/o_savedcard",
                                    transactionDetails?.accountId?._id,
                                    transaction_id,
                                    { errorCode: topupResult.errorCode }
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                });
                                transactionDetails.status = 'FAILED';
                                await transactionDetails.save();

                                return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null`);
                            }

                            transactionDetails.timeline.push({
                                status: 'COMPLETED',
                                date: receiverCurrentTime,
                            });
                            transactionDetails.status = "COMPLETED";
                            await transactionDetails.save();

                            return res.redirect(`https://my.insta-pay.ch/add-funds/card/success`);
                        } else {
                            await logError(
                                `(amount == transactionDetails.txAmount) error 2`,
                                "topup_trust_payment_vcc_w/o_savedcard",
                                transactionDetails?.accountId?._id,
                                transaction_id,
                                { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            });
                            transactionDetails['status'] = 'FAILED';
                            await transactionDetails.save();

                            return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2`,
                            "topup_trust_payment_vcc_w/o_savedcard",
                            transactionDetails?.accountId?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        });
                        transactionDetails['status'] = 'FAILED';
                        await transactionDetails.save();

                        return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                        "topup_trust_payment_vcc_w/o_savedcard",
                        transactionDetails?.accountId?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );

                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    });
                    transactionDetails['status'] = 'FAILED';
                    await transactionDetails.save();

                    return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`);
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2`,
                    "topup_trust_payment_vcc_w/o_savedcard",
                    transactionDetails?.accountId?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );

                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                });
                transactionDetails.status = "FAILED";
                await transactionDetails.save();

                return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null`);
            }
        });
    } catch (err) {
        await logError(
            err,
            "topup_trust_payment_vcc_w/o_savedcard",
            null,
            req.params?.transaction_id || null,
        );

        return res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null`);
    }
};

module.exports.checkCardExpiry = async (req, res) => {
    try {
        // const { card_id } = req.body;
        const { card_id } = await decryption(req.body.data);

        if (!card_id) {
            const ciphertext = await encryption({
                status: false,
                message: "Card ID is required"
            });
            return res.status(400).send(ciphertext);
        }

        const card = await PanModel.findById(card_id);

        if (card.account.toString() !== req.user._id.toString()) {
            const ciphertext = await encryption({
                status: false,
                message: "Card does not belong to you"
            });
            return res.status(401).send(ciphertext);
        }
        if (!card) {
            const ciphertext = await encryption({
                status: false,
                message: "Card not found"
            });
            return res.status(404).send(ciphertext);
        }

        let bytes = CryptoJS.AES.decrypt(card.panData, process.env.PAN_ENCRYPTION_KEY);
        let panDataObj = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        const [expMonth, expYear] = panDataObj.expirydate.split('/');

        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        const expiryYear = parseInt(expYear) + 2000;
        const expiryMonth = parseInt(expMonth);

        if (expiryYear < currentYear ||
            (expiryYear === currentYear && expiryMonth < currentMonth)) {

            // Delete expired card
            await PanModel.deleteOne({ _id: card_id });

            const ciphertext = await encryption({
                status: false,
                message: "Card has expired and has been removed",
                isExpired: true
            });
            return res.status(200).send(ciphertext);
        }

        const ciphertext = await encryption({
            status: true,
            message: "Card is valid",
            isExpired: false
        });
        return res.status(200).send(ciphertext);

    } catch (error) {
        console.error(error);
        const ciphertext = await encryption({
            status: false,
            message: "Internal server error"
        });
        return res.status(500).send(ciphertext);
    }
};

module.exports.topUpFeeCalculation = topUpFeeCalculation;
module.exports.generatePayload = generatePayload
module.exports.sendBotTemplate = sendBotTemplate