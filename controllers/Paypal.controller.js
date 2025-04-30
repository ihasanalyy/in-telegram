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
const { limitCheck, featureCheck, balanceLimitCheck, walletToWalletTransactionHelper, logError, schedulePaymentW2WHelper, subscribePaymentW2WHelper, fetchLocalOrDefaultWalletConditionally, updateCardContacts } = require('../utils/helpers');
const topupTransactionDataTokenKey = "bac6723rd@#dn#aFw%%Y%VSV"
const { formatW2WData } = require('../utils/helpers');
const moment = require('moment-timezone');
const { confirmTransaction } = require('../utils/thunesHelpers');
const { confirmtransactionAirtime, confirmAirtimeTransactionFixed, createTransactionRangedHelper, createTransactionFixedHelper, createTransactionEsimHelper } = require('../utils/dtOneHelpers');
const { sendTemplate } = require('../utils/instaChatbotUtils');
const e = require('cors');
// const { encryption, decryption } = require('../configurations/Encryption');
const secretKeyIntl = process.env.jwtKey;
const paypalUrl = process.env.PAYPAL_URL
const iso2Countries = require("../utils/countries_iso2.json");
const { formatDecimalNumbersWithLimit } = require('../utils/payerRates');
const QuotationModel = require('../models/Quotation.model');
const RequestPaymentModel = require('../models/Request-Payment.model');
const secretKey = process.env.jwtKey;

const lang = require('../utils/languages/languages.json');
const { formattedAmount } = require('../utils/InstaChatbotHelpers');
const Schedule = require('../models/Schedule.model');
const { sendBotTemplate } = require('./Trust-Payment.controller');
const { encryptDataVCC, decryptDataVCC } = require('../configurations/EncryptionVCC');
const VirtualCardModel = require('../models/Virtual-Card.model');
const TelegramBotModel = require('../models/TelegramBot.model');
const { sendPhoto, sendButtons } = require('../utils/telegramBotUtils');
const VCCTransactionModel = require('../models/VCC-Transaction.model');
const { sendNotifications } = require('../utils/sendEmail');

module.exports.trustpayment = async (req, res) => {
    try {

        let data = req.body;
        // if (!req.user) {
        //     let error = await encryption({
        //         status: false,
        //         message: "Unauthorized User!"
        //     });
        //     return res.status(401).send(error);
        // } else {
        let user = req.user;
        // let data = await decryption(req.body.data);
        var { currencyiso3a, amount, pan, expirydate, securitycode } = data
        if (!currencyiso3a || !amount || !pan || !expirydate || !securitycode) {
            let error = await encryption({
                status: false,
                message: "Something is missing."
            });
            return res.status(400).send(error);
        }
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
                "requesttypedescriptions": ["AUTH"],
                "sitereference": "kemitkingdom79110",
                "orderreference": "My_Order_1298",
                "parenttransactionreference": "59-70-78951072",
                // "threedresponse": `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MTA0NjU2ODUsInBheWxvYWQiOnsicmVxdWVzdHJlZmVyZW5jZSI6Ilc2MC1GQkZGMjAwNSIsInZlcnNpb24iOiIxLjAwIiwiand0IjoiZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKcWQzUkFhMlZ0YVhScmFXNW5aRzl0SWl3aWFXRjBJam94TnpFd05EWTFOamcxTENKd1lYbHNiMkZrSWpwN0ltTjFjbkpsYm1ONWFYTnZNMkVpT2lKVlUwUWlMQ0p5WlhGMVpYTjBkSGx3WldSbGMyTnlhWEIwYVc5dWN5STZXeUpVU0ZKRlJVUlJWVVZTV1NJc0lrRlZWRWdpWFN3aWMybDBaWEpsWm1WeVpXNWpaU0k2SW5SbGMzUmZhMlZ0YVhScmFXNW5aRzl0TnpreE1Ea2lMQ0poWTJOdmRXNTBkSGx3WldSbGMyTnlhWEIwYVc5dUlqb2lSVU5QVFNJc0luTmxZM1Z5YVhSNVkyOWtaU0k2SWpFeU15SXNJbVY0Y0dseWVXUmhkR1VpT2lJeE1pOHlNREkxSWl3aVltRnpaV0Z0YjNWdWRDSTZJakV3TUNJc0ltTmhZMmhsZEc5clpXNGlPaUkyTUMwNU16TXdNRFEyWlRjM01HRmtOalV4WW1SbE1tVTBPREZpT0RNd09ESXlNRGcwWWpneFpUSTFOMkUyWlRnNE1UVXlNREV5TURrNFpHWTBPVGN5TTJFMElpd2ljR0Z1SWpvaU5EQXdNREF3TURBd01EQXdNVEE1TVNKOWZRLnRVTE01NWd6S0lFekNjNzBaWm5RN2FoVi1Rd3V6NVVXWjJnNWdlb2ZKZGsiLCJyZXNwb25zZSI6W3sidHJhbnNhY3Rpb25zdGFydGVkdGltZXN0YW1wIjoiMjAyNC0wMy0xNSAwMToyMToyNSIsImxpdmVzdGF0dXMiOiIwIiwiaXNzdWVyIjoiU2VjdXJlVHJhZGluZyBUZXN0IElzc3VlcjEiLCJtZXJjaGFudGNhdGVnb3J5Y29kZSI6IjEyMzQiLCJkY2NlbmFibGVkIjoiMCIsInNldHRsZWR1ZWRhdGUiOiIyMDI0LTAzLTE1IiwiZXJyb3Jjb2RlIjoiMCIsInRpZCI6IjI3ODgyNzg4IiwibWVyY2hhbnRudW1iZXIiOiIwMDAwMDAwMCIsIm1lcmNoYW50Y291bnRyeWlzbzJhIjoiR0IiLCJ0cmFuc2FjdGlvbnJlZmVyZW5jZSI6IjYwLTktMzU5NjIyNCIsIm1lcmNoYW50bmFtZSI6IktFTUlUIEtJTkdET00gKEsyKSBTQSIsInBheW1lbnR0eXBlZGVzY3JpcHRpb24iOiJWSVNBIiwiYWNjb3VudHR5cGVkZXNjcmlwdGlvbiI6IkVDT00iLCJyZXF1ZXN0dHlwZWRlc2NyaXB0aW9uIjoiVEhSRUVEUVVFUlkiLCJtYXNrZWRwYW4iOiI0MDAwMDAjIyMjIyMxMDkxIiwiZXJyb3JtZXNzYWdlIjoiT2siLCJkZWJ0cmVwYXltZW50IjoiMCIsImlzc3VlcmNvdW50cnlpc28yYSI6IlpaIiwiZW5yb2xsZWQiOiJOIiwib3BlcmF0b3JuYW1lIjoiand0QGtlbWl0a2luZ2RvbSIsInNldHRsZXN0YXR1cyI6IjAifSx7InRyYW5zYWN0aW9uc3RhcnRlZHRpbWVzdGFtcCI6IjIwMjQtMDMtMTUgMDE6MjE6MjUiLCJwYXJlbnR0cmFuc2FjdGlvbnJlZmVyZW5jZSI6IjYwLTktMzU5NjIyNCIsImN1c3RvbWVyb3V0cHV0IjoiVFJZQUdBSU4iLCJsaXZlc3RhdHVzIjoiMCIsImlzc3VlciI6IlNlY3VyZVRyYWRpbmcgVGVzdCBJc3N1ZXIxIiwibWVyY2hhbnRjYXRlZ29yeWNvZGUiOiIxMjM0IiwiZGNjZW5hYmxlZCI6IjAiLCJzZXR0bGVkdWVkYXRlIjoiMjAyNC0wMy0xNSIsImVycm9yY29kZSI6IjYwMTA4IiwidGlkIjoiMjc4ODI3ODgiLCJtZXJjaGFudG51bWJlciI6IjAwMDAwMDAwIiwibWVyY2hhbnRjb3VudHJ5aXNvMmEiOiJHQiIsInRyYW5zYWN0aW9ucmVmZXJlbmNlIjoiNjAtOS0zNTk2MjI1IiwibWVyY2hhbnRuYW1lIjoiS0VNSVQgS0lOR0RPTSAoSzIpIFNBIiwicGF5bWVudHR5cGVkZXNjcmlwdGlvbiI6IlZJU0EiLCJiYXNlYW1vdW50IjoiMTAwIiwiYWNjb3VudHR5cGVkZXNjcmlwdGlvbiI6IkVDT00iLCJzcGxpdGZpbmFsbnVtYmVyIjoiMSIsInJlcXVlc3R0eXBlZGVzY3JpcHRpb24iOiJBVVRIIiwiZXJyb3JkYXRhIjpbIlJVTEUgLSB0ZXN0X2tlbWl0a2luZ2RvbTc5MTA5IC0gM0RTIEZvcmNlIC0gdGVzdF9rZW1pdGtpbmdkb203OTEwOSAtIDNEUyBGb3JjZSIsIjMtRCBTZWN1cmUiXSwiY3VycmVuY3lpc28zYSI6IlVTRCIsIm1hc2tlZHBhbiI6IjQwMDAwMCMjIyMjIzEwOTEiLCJlcnJvcm1lc3NhZ2UiOiJJbnZhbGlkIHByb2Nlc3MiLCJkZWJ0cmVwYXltZW50IjoiMCIsImlzc3VlcmNvdW50cnlpc28yYSI6IlpaIiwiZW5yb2xsZWQiOiJOIiwib3BlcmF0b3JuYW1lIjoiand0QGtlbWl0a2luZ2RvbSIsInNldHRsZXN0YXR1cyI6IjMifV0sInNlY3JhbmQiOiIyMzlaMEtBUGtEdjVNIn0sImF1ZCI6Imp3dEBrZW1pdGtpbmdkb20ifQ.HL7doKnnwiTP10ecnZgoRsYRo52DqWYGqDZicaQA8iA`
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
            "baseamount": "280",
            "currencyiso3a": "PKR",
            "sitereference": "kemitkingdom79110",
            "requesttypedescriptions": [
                "THREEDQUERY",
                "AUTH"
            ],
            "pan": "5590490217960077",
            "expirydate": "08/28",
            "securitycode": "430",
            "orderreference": "imtiaz0307_ZR9SDF05_tr_1724755555302"
            // "accounttypedescription": "ECOM",
            // "baseamount": "10",
            // "currencyiso3a": "USD",
            // // "sitereference": "test_kemitkingdom79109",   // TEST SITE REFERENCE
            // "sitereference": "kemitkingdom79110",
            // "requesttypedescriptions": ["THREEDQUERY", "AUTH"],
            // "pan": "4744770181502742",
            // "expirydate": "09/28",
            // "securitycode": "348",
            // // "pan": "4000000000001091",
            // // "expirydate": "12/2025",
            // // "securitycode": "123",
            // // "pan": `${process.env.PAN}`,
            // // "expirydate": `${process.env.EXP}`,
            // // "securitycode": `${process.env.CVC}`

            // accounttypedescription: "ECOM",
            // baseamount: "700",
            // currencyiso3a: "PKR",
            // expirydate: "08/28",
            // orderreference: "imtiaz0307_ZR9SDF05_tr_1724073192699",
            // pan: "5590490217960077",
            // requesttypedescriptions: ['THREEDQUERY', 'AUTH'],
            // securitycode: "430",
            // sitereference: "kemitkingdom79110"
        },
        "iat": iat,
        "iss": `${process.env.JWT_USER}`
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
        <form id="stform" action="https://webhook.site/43bdd5a6-5dc2-4e4f-94f7-98067757742b" method="POST">
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
            return fee;
        } else {
            if (feeDetails.fee_type == 'flat') {
                let fee = await getExchangeRates('USD', wallet.currency.code, feeDetails.flat_fee)
                return fee;
            } else {
                let fee = amount * (feeDetails.percentage_fee / 100);
                return fee;
            }
        }
    } catch (err) {
        return null
    }
}

module.exports.getTopupByPaypalFee = async (req, res) => {
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
        let feeDetails = await Fee.findOne({ $and: [{ service_name: 'topup_paypal' }, { account_level: wallet.account.level._id }] })
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
                feeDetails: fee.toFixed(6)
            })
            res.status(200).send(ciphertext);
        } else {
            if (feeDetails.fee_type == 'flat') {
                let fee = await getExchangeRates('USD', wallet.currency.code, feeDetails.flat_fee)
                let ciphertext = await encryption({
                    status: "true",
                    message: "Topup Fee.",
                    feeDetails: fee.toFixed(6)
                })
                res.status(200).send(ciphertext);
            } else {
                let fee = amount * (feeDetails.percentage_fee / 100);
                let ciphertext = await encryption({
                    status: "true",
                    message: "Topup Fee.",
                    feeDetails: fee.toFixed(6)
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
const supportedCurrencies = ["AUD", "BRL", "CAD", "CNY", "CZK", "DKK", "EUR", "HKD", "HUF", "ILS", "JPY", "MYR", "MXN", "TWD", "NZD", "NOK", "PHP", "PLN", "GBP", "SGD", "SEK", "CHF", "THB", "USD"];

module.exports.initiatPaypalTransaction = async (req, res) => {
    try {
        // let data = req.body
        let data = await decryption(req.body.data);
        let { wallet_id, amount, payment_type, token } = data;

        let ref = 'tr_' + Date.now().toString();
        if (!wallet_id || !amount || !payment_type || !token) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing."
            });
            return res.status(404).send(error);
        }
        amount = parseFloat(amount)

        let receiverWallet = await Wallet.findOne({
            $and: [
                { _id: wallet_id },
                { wallet_type: "insta" },
                { status: 'active' },
                {
                    $or: [
                        { $and: [{ admin_blocked: false }, { blocked: false }] },
                        { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] },
                        { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] },
                        { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] }
                    ]
                }
            ]
        }).populate([{ path: 'account', populate: (['level']) }]);

        let decodedToken;
        try {
            decodedToken = jwt.verify(token, secretKey);
        } catch (err) {
            let errorMessage = await encryption({
                status: false,
                message: "Invalid or expired token!"
            });
            return res.status(400).send(errorMessage);
        }

        let feeDetails = await topUpFeeCalculation(receiverWallet, amount, 'topup_paypal');

        let remainingAmount = amount - feeDetails;
        if (remainingAmount <= 0) {
            let error = await encryption({
                status: false,
                message: "Amount is too low after deducting the fee."
            });
            return res.status(400).send(error);
        }

        remainingAmount = formatDecimalNumbersWithLimit(remainingAmount, 2);

        console.log({ decodedFee: decodedToken.fee, decodedTotal: decodedToken.remainingAmount, feeDetails, remainingAmount })
        // Compare fee and total from token with the new calculated values
        if (decodedToken.fee !== feeDetails || decodedToken.remainingAmount !== remainingAmount) {
            let error = await encryption({
                status: false,
                message: "Fee or total amount has been updated. Please try again with the new values."
            });
            return res.status(400).send(error);
        }

        let featureChecked = await featureCheck('topup_channel', 'paypal', receiverWallet.account.level);
        if (featureChecked && feeDetails >= 0) {

            let currencyCode = receiverWallet.currency.code;
            let finalAmount = amount;
            let exchangeRate = 1;

            // if currency not supported by paypal
            if (!supportedCurrencies?.includes(currencyCode)) {
                currencyCode = 'USD';
                finalAmount = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount);
                exchangeRate = await getExchangeRates(receiverWallet.currency.code, 'USD', 1)
            }

            console.log(finalAmount)

            let amountInUSD = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', remainingAmount))
            let amountInUSDTotal = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount))

            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account)
            let limitChecked = limitCheck(parseFloat(amountInUSDTotal), receiverWallet.account.level, receiverWallet.account, 'topup')

            if (limitChecked.status && balanceLimitChecked) {
                let api = `${paypalUrl}/oauth2/token`;
                let obj = {
                    url: api,
                    method: 'post',
                    data: 'grant_type=client_credentials',
                    auth: {
                        username: process.env.PAYPAL_CLIENT_ID,
                        password: process.env.PAYPAL_SECRET
                    }
                }
                axios(obj).then(async (resp) => {
                    let paymentApi = `${paypalUrl}/payments/payment`;
                    const cnfg = {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + resp.data.access_token,
                        },
                    }
                    let paymentObj = {
                        "intent": "sale",
                        "payer": {
                            "payment_method": "paypal"
                        },
                        "transactions": [
                            {
                                "amount": {
                                    "total": formatDecimalNumbersWithLimit(finalAmount, 2)?.toFixed(2),
                                    "currency": currencyCode
                                },
                                "description": receiverWallet?.account?.username,
                                "custom": receiverWallet.wallet_id,
                                "item_list": {
                                    //     "items": [
                                    //         {
                                    //             "name": "hat",
                                    //             "description": "Brown hat.",
                                    //             "quantity": "5",
                                    //             "price": "3",
                                    //             "tax": "0.01",
                                    //             "sku": "1",
                                    //             "currency": "USD"
                                    //         },
                                    //         {
                                    //             "name": "handbag",
                                    //             "description": "Black handbag.",
                                    //             "quantity": "1",
                                    //             "price": "15",
                                    //             "tax": "0.02",
                                    //             "sku": "product34",
                                    //             "currency": "USD"
                                    //         }
                                    //     ],
                                    "shipping_address": {
                                        "recipient_name": `${receiverWallet?.account?.first_name} ${receiverWallet?.account?.last_name}`,
                                        "line1": `${receiverWallet?.account?.address || receiverWallet?.account?.country_iso_code}`,
                                        "city": `${receiverWallet?.account?.city || ""}`,
                                        "country_code": `${iso2Countries[receiverWallet?.account?.country_iso_code] || "CH"}`,
                                        "postal_code": `${receiverWallet?.account?.postal_code || ""}`,
                                        "phone": `${receiverWallet?.account?.phone || ""}`,
                                    }
                                }
                            }
                        ],
                        "redirect_urls": {
                            "return_url": `https://my.insta-pay.ch/add-funds/success/null?transaction_id=${ref}`,
                            "cancel_url": `https://my.insta-pay.ch/add-funds/error/null?transaction_id=${ref}`
                        }
                    }
                    console.log(paymentObj, 'paymentObj', paymentObj.transactions[0].amount, 'amount', paymentObj.transactions[0].item_list, 'total');
                    axios.post(paymentApi, paymentObj, cnfg).then(async (resp1) => {
                        if (resp1.data.state === 'created') {
                            const receiverTimezone = receiverWallet.account?.timezone || "UTC"
                            const receiverCurrentTime = moment().tz(receiverTimezone).format();

                            let receiverTransactionObj = {
                                reference_id: ref,
                                type: 'instant',
                                transaction_type: 'credit',
                                service_type: 'topup',
                                payment_type: 'paypal',
                                status: 'INITIATED',
                                purpose: '',
                                payment_id: resp1.data.id,
                                description: 'Topup by Paypal',
                                currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                                amount: (amount) - feeDetails,
                                fee: feeDetails,
                                total: amount,
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
                                let link = resp1.data.links.find(l => l.rel === 'approval_url');
                                let ciphertext = await encryption({
                                    status: "true",
                                    message: "Transaction initiated successfully.",
                                    currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                                    transaction_id: transaction._id,
                                    transaction_ref: transaction.reference_id,
                                    url: link ? link.href : ''
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
                            let ciphertext = await encryption({
                                status: "false",
                                message: "Transaction failed.",
                                error: err
                            })
                            res.status(400).send(ciphertext);
                        }
                    }).catch(async (err) => {
                        console.log(err?.response?.data?.details || err);
                        let ciphertext = await encryption({
                            status: "false",
                            message: "Transaction failed.",
                            error: err
                        })
                        res.status(400).send(ciphertext);
                    })
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
// paypal webhook
module.exports.getPaypalPayment = async (req, res) => {
    console.log(`\u{1F7EA} paypal webhook ${req.body}`)
    const status = req.body.event_type.toUpperCase();

    let payment_id;
    if (status === "PAYMENTS.PAYMENT.CREATED") {
        payment_id = req.body.resource.id;
    } else {
        payment_id = req.body.resource.parent_payment;
    }

    // CHECK IF TRANSACTION IS FOR VCC MASTERCARD TOPUP 
    const vccTransaction = await VCCTransactionModel.findOne({ authCode: payment_id, status: "INITIATED" }).populate({ path: "accountId", populate: ('insta_recipient_id') })
    if (vccTransaction) {
        console.log("VCCTransaction found:", vccTransaction);
        const receiverTimezone = vccTransaction?.accountId?.timezone || "UTC";
        const currentTime = moment().tz(receiverTimezone).format();

        if (status === "PAYMENTS.PAYMENT.CREATED") {
            const payer_id = req.body?.resource.payer.payer_info.payer_id;
            let api = `${paypalUrl}/oauth2/token`;
            let authOptions = {
                url: api,
                method: 'post',
                data: 'grant_type=client_credentials',
                auth: {
                    username: process.env.PAYPAL_CLIENT_ID,
                    password: process.env.PAYPAL_SECRET
                },
            };

            axios(authOptions)
                .then(async (tokenResponse) => {
                    const accessToken = tokenResponse.data.access_token;
                    console.log("accessToken", accessToken);

                    let exeApi = `${paypalUrl}/payments/payment/` + payment_id + '/execute';
                    const cnfg = {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                        },
                    };
                    let exeObj = { "payer_id": payer_id };

                    console.log({ exeApi, exeObj, cnfg });

                    axios.post(exeApi, exeObj, cnfg)
                        .then(exeResponse => {
                            console.log("Payment executed:", exeResponse.data);
                            return res.status(200).send("EVENT_RECEIVED");
                        })
                        .catch(err => {
                            console.error("Error in payment execution", err);
                            return res.status(200).send("EVENT_RECEIVED");
                        });
                })
                .catch(err => {
                    console.error("access token error", err);
                    return res.status(200).send("EVENT_RECEIVED");
                });
        } else {
            if (["PAYMENT.SALE.DENIED", "PAYMENT.SALE.PENDING", "PAYMENT.SALE.REFUNDED"].includes(status)) {
                let newStatus = status === "PAYMENT.SALE.DENIED" ? "DENIED" :
                    status === "PAYMENT.SALE.REFUNDED" ? "REFUNDED" : "PENDING";

                vccTransaction.timeline.push({ date: currentTime, status: newStatus });
                vccTransaction.status = newStatus;
                vccTransaction.external_token = undefined
                await vccTransaction.save();
            }
            else if (status === "PAYMENT.SALE.COMPLETED") {
                const tokenType = vccTransaction?.external_token?.type
                const isChatBot = tokenType?.includes("bot");
                let decoded;
                try {
                    decoded = jwt.verify(vccTransaction?.external_token?.token, process.env.jwtKey);
                } catch (error) {
                    vccTransaction.external_token = undefined
                    console.log(error.message);
                    await logError(
                        "Topup Mastercard failed",
                        `topup_paypal_mastercard_topup${isChatBot ? "_bot" : ""}`,
                        vccTransaction?.accountId?._id,
                        null,
                        { message: error.message },
                    );
                    return res.status(200).send("EVENT_RECEIVED");
                }
                const requestData = {
                    cardId: decoded.cardId,
                    amt: (decoded.amount - decoded.fee).toString()
                }

                console.log({ requestData })

                const encryptedData = encryptDataVCC(requestData);
                const payload = { data: encryptedData };

                try {
                    const apiResponse = await axios.post(`${process.env.vccdaddyURL}/openapi/card/hk/recharge`, payload, {
                        headers: {
                            'Content-Type': 'application/json',
                            'oaToken': process.env.vccToken,
                        }
                    });

                    console.log({ apiResponse });

                    if (apiResponse.data.code !== 1) {
                        throw new Error('Card top-up failed');
                    }

                    vccTransaction.status = "COMPLETED";
                    vccTransaction.timeline.push({ date: currentTime, status: "COMPLETED" });
                    vccTransaction.external_token = undefined

                    const telegramBot = await TelegramBotModel.findOne({ recipient: vccTransaction?.accountId?.telegram_id }).select("selected_language")
                    console.log({ telegramBot })
                    if (isChatBot) {
                        if (tokenType?.includes("telegram")) {
                            const selectedLanguage = telegramBot?.selected_language || vccTransaction?.accountId?.language || "en"
                            const message = `Your topup of ${formattedAmount(decoded.amount)} ${decoded.original_currency} was successful.`

                            await sendPhoto(vccTransaction?.accountId?.telegram_id, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", message, "4");
                            const buttons = [
                                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                                [{ text: "My MasterCard", callback_data: "vcc_menu" }],
                            ];
                            await sendButtons(vccTransaction?.accountId?.telegram_id, `${lang[selectedLanguage].TRANSACTION_ID} ${vccTransaction.transactionId}`, buttons, "4");
                        } else if (tokenType?.includes("instagram")) {
                            const selectedLanguage = vccTransaction?.accountId?.insta_recipient_id?.active_language || vccTransaction?.accountId?.language || 'en';
                            const chatbotData = {
                                sender: {
                                    id: vccTransaction?.accountId?.insta_recipient_id?.recipient || vccTransaction?.accountId?.insta_recipient_id?.recipient

                                }
                            }
                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: `Your topup of ${formattedAmount(decoded.amount)} ${decoded.original_currency} was successful.`,
                                        subtitle: `${lang[selectedLanguage].TRANSACTION_ID} ${vccTransaction.transactionId}`,
                                        image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                                        buttons: [

                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MAIN_MENU,
                                                payload: "main_menu",
                                            },
                                        ],
                                    },
                                ]
                            };

                            await sendTemplate(chatbotData, chatbotData.sender.id, templatePayload, "4");
                        }
                    }
                } catch (error) {
                    console.error("Card top-up error:", error?.message);

                    // Mark transaction as failed
                    vccTransaction.status = "FAILED";
                    vccTransaction.timeline.push({ date: currentTime, status: "FAILED" });
                    vccTransaction.external_token = undefined

                    await logError(
                        "Topup Mastercard failed from VCCDADDY",
                        `topup_paypal_mastercard_topup${isChatBot ? "_bot" : ""}`,
                        vccTransaction?.accountId?._id,
                        null,
                        { message: error?.message || error },
                    );
                }

                await vccTransaction.save();
            }
        }

        return res.status(200).send("EVENT_RECEIVED");
    }


    // HERE LOGIC STARTS OF NORMAL WALLET TOPUP AND THEN NORMAL TRANSACTIONS (INTL, W2W, AIRTIME)
    const transactionDetails = await Transaction.findOne({ payment_id: payment_id, status: "INITIATED" }).populate([{ path: "account", populate: (['insta_recipient_id']) }])
    console.log(transactionDetails, "transactionDetails");

    if (!transactionDetails) {
        console.log("No transaction found");
        return res.status(200).send("EVENT_RECEIVED");
    }

    const receiverTimezone = transactionDetails.account?.timezone || "UTC";
    const currentTime = moment().tz(receiverTimezone).format();

    if (status === "PAYMENTS.PAYMENT.CREATED") {
        const payer_id = req.body?.resource.payer.payer_info.payer_id;

        let api = `${paypalUrl}/oauth2/token`;
        let authOptions = {
            url: api,
            method: 'post',
            data: 'grant_type=client_credentials',
            auth: {
                username: process.env.PAYPAL_CLIENT_ID,
                password: process.env.PAYPAL_SECRET
            },
        };

        // Access token
        axios(authOptions)
            .then(async (tokenResponse) => {
                const accessToken = tokenResponse.data.access_token;
                console.log("accessToken", accessToken);

                let exeApi = `${paypalUrl}/payments/payment/` + payment_id + '/execute';
                const cnfg = {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`,
                    },
                };
                let exeObj = { "payer_id": payer_id };

                console.log({ exeApi, exeObj, cnfg });

                axios.post(exeApi, exeObj, cnfg)
                    .then(exeResponse => {
                        console.log("Payment executed:", exeResponse.data);
                        return res.status(200).send("EVENT_RECEIVED");
                    })
                    .catch(err => {
                        console.error("Error in payment execution", err);
                        return res.status(200).send("EVENT_RECEIVED");
                    });
            })
            .catch(err => {
                console.error("access token error", err);
                return res.status(200).send("EVENT_RECEIVED");
            });
    } else {
        if (status === 'PAYMENT.SALE.DENIED' || status === 'PAYMENT.SALE.PENDING' || status === 'PAYMENT.SALE.REFUNDED') {
            transactionDetails.timeline.push({
                date: currentTime,
                status: status === 'PAYMENT.SALE.DENIED' ? "DENIED" : status === 'PAYMENT.SALE.REFUNDED' ? "REFUNDED" : "PENDING",
            });
            transactionDetails.status = status === 'PAYMENT.SALE.DENIED' ? "DENIED" : status === 'PAYMENT.SALE.REFUNDED' ? "REFUNDED" : "PENDING";

            if (transactionDetails.hidden) {
                transactionDetails.hidden = false;
            }

            await transactionDetails.save();
        } else if (status === 'PAYMENT.SALE.COMPLETED') {
            const isChatBot = transactionDetails?.external_token?.type?.includes("bot")
            const walletDetails = await Wallet.findById(transactionDetails.wallet);

            const selectedLanguage = transactionDetails?.account?.insta_recipient_id?.active_language || transactionDetails?.account?.language || 'en';

            transactionDetails.current_balance = walletDetails?.balance?.available;

            // Check if external_token exists and is not of type "kyc_fee" (topup the wallet first so that the wallet can be credited only if type is not of KYC fee)
            if (transactionDetails?.external_token && transactionDetails?.external_token?.type !== "kyc_fee") {
                walletDetails.balance.available += transactionDetails.amount;
                transactionDetails.new_balance = walletDetails.balance.available;
                await walletDetails.save();
            }

            transactionDetails.timeline.push({
                date: currentTime,
                status: "COMPLETED"
            });
            transactionDetails.status = "COMPLETED";

            if (transactionDetails.hidden) {
                transactionDetails.hidden = false;
            }

            // notification for guest payment

            if (transactionDetails?.external_token?.type === "guest_pay") {
                let notificationObj = {};
                notificationObj.title = 'Payment Address Notification';
                notificationObj.desc = 'Payment address amount received successfully!';

                const receiverOptions = {
                    toEmail: transactionDetails?.account?.email ?? "",
                    phoneNumber: transactionDetails?.account?.phone ?? "",
                    instaUsername: transactionDetails?.account?.insta_username ?? "",
                    phoneMessage: `Great news! ${formattedAmount(transactionDetails?.amount) || "N/A"} ${transactionDetails?.currency?.code} has been received in your wallet ID ${transactionDetails?.wallet_id} from ${transactionDetails?.guest_details?.name || "Guest"} via payment address.`,
                    message: `Great news! ${formattedAmount(transactionDetails?.amount) || "N/A"} ${transactionDetails?.currency?.code} has been received in your wallet ID ${transactionDetails?.wallet_id} from ${transactionDetails?.guest_details?.name || "Guest"} via payment address.`,
                    subject: "You have received a payment address in your Instapay Account!",
                    templateId: "d-2d5f929ed89847d693ab15621b95890f",
                }
                await sendNotifications(transactionDetails?.account, 'payments', receiverOptions);
                templateMsg = receiverOptions.message

                const subtitle = `
${lang[selectedLanguage].TRANSACTION_ID} ${transactionDetails.reference_id}
${lang[selectedLanguage].BENEFICIARY_NAME}: ${transactionDetails?.guest_details?.name || "Guest"}
${lang[selectedLanguage].WALLET_ID} ${transactionDetails?.wallet_id}
${lang[selectedLanguage].STATUS}: Completed`

                const templatePayload = {
                    template_type: "generic",
                    elements: [
                        {
                            title: templateMsg,
                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Send%20Money.png",
                            subtitle,
                            buttons: [
                                {
                                    type: "postback",
                                    title: "Cash Out now",
                                    payload: `cash_out_id_${transactionDetails?._id}`
                                },

                                {
                                    type: "postback",
                                    title: "Main Menu",
                                    payload: "main_menu",
                                },

                            ],
                        },
                    ]
                };

                const templateData = {
                    sender: { id: transactionDetails?.account?.insta_subscriber_id },
                };
                await sendTemplate(templateData, transactionDetails?.account?.insta_subscriber_id, templatePayload, "4");
            }

            const recipientBotId = transactionDetails?.account?.insta_recipient_id?.recipient || transactionDetails?.account?.insta_recipient_id?.recipient

            const chatbotData = { sender: { id: recipientBotId } };

            // TODO: set the language conditionally on the chatbot
            // if the transaction is for international transfer
            if (transactionDetails?.external_token?.type === "international" || transactionDetails?.external_token?.type?.includes("international")) {
                let decoded;
                try {
                    decoded = jwt.verify(transactionDetails.external_token.token, secretKeyIntl);
                } catch (err) {
                    transactionDetails.external_token = undefined;
                    await transactionDetails.save()
                    return res.status(200).send("EVENT_RECEIVED");
                }

                console.log("Decodeddata:", decoded);

                try {
                    const confirmIntlTransaction = await confirmTransaction(decoded, []);

                    if (!confirmIntlTransaction?.status) {
                        await logError(
                            "INTL Transaction failed",
                            `topup_paypal_intl${isChatBot ? "_bot" : ""}`,
                            null,
                            transactionDetails._id,
                            { message: confirmIntlTransaction?.message, values: decoded }
                        )
                    }
                } catch (err) {
                    console.log(err, "error in intl transaction");
                }

                transactionDetails.external_token = undefined;

            }
            // if the transaction is for wallet to wallet
            else if (transactionDetails?.external_token?.type === "wallet_to_wallet" || transactionDetails?.external_token?.type?.includes("wallet_to_wallet")) {

                console.log(isChatBot, "isChatBotl", transactionDetails.external_token.token)

                let decodedW2WToken;

                try {
                    decodedW2WToken = jwt.verify(transactionDetails.external_token.token, secretKeyIntl);
                    console.log(decodedW2WToken);
                } catch (err) {
                    console.log("JWT:", err);
                    transactionDetails.external_token = undefined;
                    await transactionDetails.save();
                    return res.status(200).send("EVENT_RECEIVED");
                }

                console.log("Decodeddata:", decodedW2WToken);

                if (!isChatBot || (isChatBot && transactionDetails?.external_token?.type === "wallet_to_wallet_instant_bot")) {
                    try {
                        const confirmW2WTransaction = await handleW2WPaypalTransction(decodedW2WToken, [], req = { transaction_id: transactionDetails._id });

                        if (confirmW2WTransaction.status && decodedW2WToken.payment_type === "payment_request") {
                            const requestDetails = await RequestPaymentModel.findOneAndUpdate(
                                { _id: decodedW2WToken.link, status: 'pending' },
                                { $set: { status: 'completed' } },
                                { new: true }
                            );

                            if (!requestDetails) {
                                console.log("no request found in paypal")
                            }
                        } else if (confirmW2WTransaction.status && decodedW2WToken.payment_type === "quotation") {
                            const quotation = await QuotationModel.findOneAndUpdate(
                                { _id: decodedW2WToken.link, status: { $in: ['sent', 'revise', 'bargain-accepted'] } },
                                { $set: { status: 'accepted' } },
                                { new: true }
                            ).populate({
                                path: 'sender',
                                populate: {
                                    path: 'insta_recipient_id'
                                }
                            });

                            if (!quotation) {
                                console.log("No quotation found with the specified statuses");
                            }
                        } else if (!confirmW2WTransaction.status) {
                            await logError(
                                "W2W Transaction failed",
                                `topup_paypal_w2w${isChatBot ? "_bot" : ""}`,
                                null,
                                transactionDetails._id,
                                { message: confirmW2WTransaction.message }
                            )
                        }
                    } catch (err) {
                        console.log(err, "error in w2w transaction");
                    }
                }
                // if transaction type is qr pay from chatbot
                else if (isChatBot && (transactionDetails?.external_token?.type === "wallet_to_wallet_qr_pay_bot" || transactionDetails?.external_token?.type?.includes("wallet_to_wallet_qr_pay_bot"))) {
                    const confirmW2WTransaction = await handleW2WPaypalTransction(decodedW2WToken, [], req = { transaction_id: transactionDetails._id });

                    if (confirmW2WTransaction.status) {
                        const receiverWalletDetails = await Wallet.findOne({ wallet_id: decodedW2WToken.receiver_wallet_id }).populate([
                            {
                                path: 'account',
                                populate: [
                                    { path: 'user' },
                                    { path: 'company' },
                                ]
                            }
                        ]);
                        const receiverName = receiverWalletDetails.account.account_type === "individual" ? receiverWalletDetails.account.user.first_name + " " + receiverWalletDetails.account.user.last_name :
                            receiverWalletDetails?.account?.company?.company_name

                        const subtitles = `
${lang[selectedLanguage].TRANSACTION_ID} ${confirmW2WTransaction?.data?.reference_id}
${lang[selectedLanguage].STATUS}: Completed`
                        const title = `You have succesfully sent ${formattedAmount(confirmW2WTransaction?.data?.recipient_received_amount)} ${confirmW2WTransaction?.data?.recipient_received_currency} to ${receiverName} `
                        if (transactionDetails?.external_token?.type?.includes("telegram")) {
                            await sendPhoto(transactionDetails?.account?.telegram_id, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", title)
                            await sendButtons(transactionDetails?.account?.telegram_id, subtitles, [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]], "4");
                        } else {
                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title,
                                        subtitle: subtitles,
                                        image_url: "https://my.insta-pay.ch/static/media/chips_in_left.3898cd344de2a6cfda6c.png",
                                        buttons: [

                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MAIN_MENU,
                                                payload: "main_menu",
                                            },
                                        ],
                                    },
                                ]
                            };

                            await sendTemplate(chatbotData, recipientBotId, templatePayload, "4");
                        }
                    } else {
                        await logError(
                            "W2W Transaction failed",
                            "topup_paypal_w2w_qr_pay_bot",
                            null,
                            transactionDetails._id,
                            { message: confirmW2WTransaction.message }
                        )
                    }
                }
                // if transaction type is quotation from chatbot
                else if (isChatBot && (transactionDetails?.external_token?.type === "wallet_to_wallet_quotation_bot" || transactionDetails?.external_token?.type?.includes("wallet_to_wallet_quotation_bot"))) {
                    const confirmW2WTransaction = await handleW2WPaypalTransction(decodedW2WToken, [], req = { transaction_id: transactionDetails._id });

                    if (confirmW2WTransaction.status) {
                        const quotationDetails = await QuotationModel.findOneAndUpdate(
                            { _id: decodedW2WToken.link, status: { $in: ['sent', 'revise', 'bargain-accepted'] } },
                            { $set: { status: 'accepted' } },
                            { new: true }
                        ).populate({
                            path: 'sender',
                            populate: {
                                path: 'insta_recipient_id'
                            }
                        });

                        if (!quotationDetails) {
                            console.log("No quotation found with the specified statuses");
                            await logError(
                                "Quotation using paypal transaction completed but quotation failed as quotation not found",
                                "topup_paypal_w2w_quotation_bot",
                                null,
                                transactionDetails._id,
                                additionalInfo = { quotation_id: decodedW2WToken.link }
                            )
                        }

                        const currencyDetails = await Wallet.findById(quotationDetails?.amount_reciever_currency)
                        const quotationSender = await Account.findById(quotationDetails?.sender).populate('insta_recipient_id')

                        const quotationInfo = `
Quotation ID: ${quotationDetails.reference_id}
${lang[selectedLanguage].AMOUNT}: ${quotationDetails?.revised_amount ? formattedAmount(quotationDetails?.revised_amount?.toFixed(2)) : formattedAmount(quotationDetails?.amount?.toFixed(2))} ${currencyDetails?.currency.code}
Username: ${quotationSender?.username}
${lang[selectedLanguage].TITLE}: ${quotationDetails?.title}
                                `

                        // accepting message
                        const templatePayload = {
                            template_type: "generic",
                            elements: [
                                {
                                    title: `You've accepted the quote. The payment will be processed per the agreed terms.`,
                                    image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Quote%20Accepted.png",
                                    subtitle: quotationInfo,

                                    buttons: [
                                        {
                                            type: "postback",
                                            title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                            payload: `main_menu`,
                                        },


                                    ]
                                },
                            ]
                        };

                        await sendTemplate(chatbotData, recipientBotId, templatePayload, "4")

                        if (transactionDetails?.external_token?.type?.includes("telegram")) {

                            const message = `You've accepted the quote. The payment will be processed per the agreed terms.`;
                            await sendPhoto(transactionDetails?.account?.telegram_id, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", message)
                            await sendButtons(transactionDetails?.account?.telegram_id, quotationInfo, [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]], "4");
                        }
                    } else {
                        await logError(
                            "Quotation using paypal transaction failed",
                            "topup_paypal_w2w_quotation_bot",
                            null,
                            transactionDetails._id,
                            { message: confirmW2WTransaction.message }
                        )
                    }

                }
                // if transaction type is request from chatbot
                else if (isChatBot && transactionDetails?.external_token?.type === "wallet_to_wallet_request_bot") {
                    const confirmW2WTransaction = await handleW2WPaypalTransction(decodedW2WToken, [], req = { transaction_id: transactionDetails._id });

                    if (confirmW2WTransaction.status) {
                        const requestDetails = await RequestPaymentModel.findOneAndUpdate(
                            { _id: decodedW2WToken.link, status: 'pending' },
                            { $set: { status: 'completed' } },
                            { new: true }
                        )

                        if (!requestDetails) {
                            console.log("No request found with the specified statuses");
                            await logError(
                                "request using paypal transaction completed but request failed as request not found",
                                "topup_paypal_w2w_request_bot",
                                null,
                                transactionDetails._id,
                                additionalInfo = { request_id: decodedW2WToken.link }
                            )
                            return
                        }
                        const subtitle = `
${lang[selectedLanguage].TRANSACTION_ID} ${requestDetails?.reference_id}
                                                        `
                        // accepting message
                        const templatePayload = {
                            template_type: "generic",
                            elements: [
                                {
                                    title: lang[selectedLanguage].PAYMENT_ACCEPTED_MESSAGE,
                                    image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20%20Request%20Accepted.png",
                                    subtitle,

                                    buttons: [
                                        {
                                            type: "postback",
                                            title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                            payload: `main_menu`,
                                        },


                                    ]
                                },
                            ]
                        };

                        await sendTemplate(chatbotData, recipientBotId, templatePayload, "4")
                    } else {
                        await logError(
                            "request using paypal transaction failed",
                            "topup_paypal_w2w_request_bot",
                            null,
                            transactionDetails._id,
                            { message: confirmW2WTransaction.message }
                        )
                    }

                }
                // else transaction type will be scheduled from chatbot
                else {
                    const senderWalletDetails = await Wallet.findById(decodedW2WToken.sender_wallet_id).populate([{ path: "account", populate: (['insta_recipient_id']) }])

                    if (decodedW2WToken.type === "subscription") {
                        const subscription_data = {
                            receiver_wallet_id: decodedW2WToken.receiver_wallet_id,
                            sender_wallet_id: decodedW2WToken.sender_wallet_id,
                            purpose: decodedW2WToken.purpose,
                            amount: decodedW2WToken.amount,
                            date: decodedW2WToken.date,
                            next_date: decodedW2WToken.next_date,
                            nextCycles: decodedW2WToken.nextCycles,
                            cycles: decodedW2WToken.cycles,
                            untilIStop: decodedW2WToken.untilIStop,
                            timezone: decodedW2WToken.timezone,
                            attachments: decodedW2WToken.attachments,
                            description: decodedW2WToken.description,
                            reserved: true,
                        }

                        const subscriptionDetails = await subscribePaymentW2WHelper(subscription_data)

                        if (subscriptionDetails.status) {

                            const receiverWalletDetails = await Wallet.findOne({ wallet_id: decodedW2WToken.receiver_wallet_id }).populate([
                                {
                                    path: 'account',
                                    populate: [
                                        { path: 'user' },
                                        { path: 'company' },
                                    ]
                                }
                            ]);

                            // reserving the amount - checking balance
                            // if (senderWalletDetails.balance.available < decodedW2WToken.amount) {
                            //     const schedule = await Schedule.findById(subscriptionDetails?.subscribtionDetails?._id)
                            //     schedule.status = "declined"
                            //     schedule.reserved = false
                            //     await schedule.save()

                            //     await sendBotTemplate(chatbotData, "Your subscription payment could not be processed due to insufficient funds. Please top up your wallet and try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Declined.png");
                            //     return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
                            // }

                            // // if enough balance available then reserving the amount
                            // senderWalletDetails.balance.reserved = senderWalletDetails.balance.reserved || 0;
                            // senderWalletDetails.balance.reserved += decodedW2WToken.amount
                            // senderWalletDetails.balance.available -= decodedW2WToken.amount
                            // await senderWalletDetails.save()

                            const userName = receiverWalletDetails?.account?.account_type === "individual" ? receiverWalletDetails?.account?.user?.first_name + " " + receiverWalletDetails?.account?.user?.last_name : receiverWalletDetails?.account?.company?.company_name
                            const subtitle = `
Recipient: ${userName}
From: ${decodedW2WToken.date}
${decodedW2WToken?.cycles ? `For: ${decodedW2WToken?.cycles} months` : decodedW2WToken.next_date ? `To: ${decodedW2WToken.next_date}` : 'To: Until Cancelled'}
Wallet ID: ${receiverWalletDetails.wallet_id}
Status: Pending`

                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: `Your subscription payment of ${formattedAmount(decodedW2WToken.amount?.toFixed(2))} ${senderWalletDetails?.currency?.code} is all set up.`,
                                        subtitle,
                                        image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",

                                        buttons: [
                                            {
                                                type: "postback",
                                                title: "Main Menu",
                                                payload: "main_menu",
                                            },
                                        ],
                                    },
                                ]
                            };
                            await sendTemplate(chatbotData, recipientBotId, templatePayload, "4")
                        } else {
                            await sendBotTemplate(chatbotData, "Something went wrong while setting up your subscribed payment. Please try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Declined.png");
                            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
                        }
                    }

                    else if (decodedW2WToken.type === "schedule") {
                        const scheduleData = {
                            receiver_wallet_id: decodedW2WToken.receiver_wallet_id,
                            sender_wallet_id: decodedW2WToken.sender_wallet_id,
                            purpose: decodedW2WToken.purpose,
                            amount: decodedW2WToken.amount,
                            date: decodedW2WToken.date,
                            time: decodedW2WToken.time,
                            timezone: decodedW2WToken.timezone,
                            attachments: decodedW2WToken.attachments,
                            description: decodedW2WToken.description,
                            reserved: true
                        }

                        console.log(scheduleData, "scheduleDatainsched2")

                        const scheduleDetails = await schedulePaymentW2WHelper(scheduleData)
                        console.log(scheduleDetails, "scheduleDetails")

                        if (scheduleDetails.status) {
                            const receiverWalletDetails = await Wallet.findOne({ wallet_id: decodedW2WToken.receiver_wallet_id }).populate([
                                {
                                    path: 'account',
                                    populate: [
                                        { path: 'user' },
                                        { path: 'company' },
                                    ]
                                }
                            ]);
                            const senderWalletDetails = await Wallet.findById(decodedW2WToken.sender_wallet_id);

                            // Reserving the amount - checking balance
                            // if (senderWalletDetails.balance.available < decodedW2WToken.amount) {
                            //     const schedule = await Schedule.findById(scheduleDetails?.scheduleDetails?._id);
                            //     schedule.status = "declined";
                            //     schedule.reserved = false
                            //     await schedule.save();

                            //     await sendBotTemplate(chatbotData, "Your scheduled payment could not be processed due to insufficient funds. Please top up your wallet and try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Declined.png");
                            //     return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
                            // }

                            // // If enough balance available, reserving the amount
                            // senderWalletDetails.balance.reserved = senderWalletDetails.balance.reserved || 0;
                            // senderWalletDetails.balance.reserved += decodedW2WToken.amount;
                            // senderWalletDetails.balance.available -= decodedW2WToken.amount;
                            // await senderWalletDetails.save();

                            const userName = receiverWalletDetails?.account?.account_type === "individual" ? receiverWalletDetails?.account?.user?.first_name + " " + receiverWalletDetails?.account?.user?.last_name : receiverWalletDetails?.account?.company?.company_name;
                            const subtitle = `
Recipient: ${userName}
Schedule: ${decodedW2WToken.time}, ${decodedW2WToken.date}
Timezone: ${decodedW2WToken.timezone}
WalletID: ${receiverWalletDetails.wallet_id}
Status: Pending`;

                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: `Your scheduled payment of ${formattedAmount(decodedW2WToken.amount?.toFixed(2))} ${senderWalletDetails?.currency?.code} is all set up.`,
                                        subtitle,
                                        image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                                        buttons: [
                                            {
                                                type: "postback",
                                                title: "Main Menu",
                                                payload: "main_menu",
                                            },
                                        ],
                                    },
                                ]
                            };
                            await sendTemplate(chatbotData, recipientBotId, templatePayload, "4");
                        } else {
                            await sendBotTemplate(chatbotData, "Something went wrong while setting up your scheduled payment. Please try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Declined.png");
                            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
                        }
                    }
                }


                transactionDetails.external_token = undefined;
            }

            // if the transction is for kyc fee
            else if (transactionDetails?.external_token?.type === "kyc_fee") {
                const updatedAccount = await Account.updateOne({ _id: transactionDetails.account._id }, { $set: { "kyc_verification_paid": true } })
                transactionDetails.external_token = undefined;
            }
            // if transaction starts with airtime
            else if (transactionDetails?.external_token?.type?.startsWith("airtime")) {
                const airtimeType = transactionDetails?.external_token?.type.split("_")[1];
                const isChatbot = transactionDetails?.external_token?.type?.includes("bot");

                console.log({ airtimeType, isChatbot, type: transactionDetails?.external_token?.type });

                let decoded;
                try {
                    decoded = jwt.verify(transactionDetails.external_token.token, secretKeyIntl);
                } catch (err) {
                    transactionDetails.external_token = undefined;
                    await transactionDetails.save()
                    return res.status(200).send("EVENT_RECEIVED");
                }

                if (airtimeType === "ranged") {
                    if (isChatbot) {
                        const rangedAirtimeTransactionBot = await createTransactionRangedHelper({ number: decoded.number, decoded, wallet_id: transactionDetails.wallet });
                        if (!rangedAirtimeTransactionBot?.status) {
                            await logError(
                                "Airtime ranged Transaction failed",
                                `topup_paypal_airtime_bot`,
                                null,
                                transactionDetails._id,
                                { message: rangedAirtimeTransactionBot.message }
                            )
                        }
                    } else {
                        const rangedAirtimeTransaction = await createTransactionRangedHelper({ number: decoded.number, decoded, wallet_id: transactionDetails.wallet });
                        if (!rangedAirtimeTransaction?.status) {
                            await logError(
                                "Airtime ranged Transaction failed",
                                `topup_paypal_airtime`,
                                null,
                                transactionDetails._id,
                                { message: rangedAirtimeTransaction.message }
                            )
                        }
                    }
                } else if (airtimeType === "fixed") {
                    if (isChatbot) {
                        const fixedAirtimeTransactionBot = await createTransactionFixedHelper({ number: decoded.number, decoded, wallet_id: transactionDetails.wallet });
                        if (!fixedAirtimeTransactionBot?.status) {
                            await logError(
                                "Airtime fixed Transaction failed",
                                `topup_paypal_airtime_bot`,
                                null,
                                transactionDetails._id,
                                { message: fixedAirtimeTransactionBot.message }
                            )
                        }
                    } else {
                        const fixedAirtimeTransaction = await createTransactionFixedHelper({ number: decoded.number, decoded, wallet_id: transactionDetails.wallet });
                        if (!fixedAirtimeTransaction?.status) {
                            await logError(
                                "Airtime fixed Transaction failed",
                                `topup_paypal_airtime`,
                                null,
                                transactionDetails._id,
                                { message: fixedAirtimeTransaction.message }
                            )
                        }
                    }
                } else if (airtimeType === "esim") {
                    const esimTransaction = await createTransactionEsimHelper({ decoded, wallet_id: transactionDetails.wallet, transaction_id: transactionDetails._id });
                    if (!esimTransaction?.status) {
                        await logError(
                            "Airtime esim Transaction failed",
                            `topup_paypal_airtime`,
                            null,
                            transactionDetails._id,
                            { message: esimTransaction.message }
                        )
                    } else if (esimTransaction?.status) {
                        if (isChatbot) {
                            if (transactionDetails?.external_token?.type?.includes("telegram")) {

                            } else if (transactionDetails?.external_token?.type?.includes("instagram")) {

                            }
                        } else {

                        }
                    }
                }

                transactionDetails.external_token = undefined;
            }
            // if transaction is for creation of virtual card
            else if (transactionDetails?.external_token?.type?.startsWith("vcc_creation")) {
                let cardType;
                if (transactionDetails?.external_token?.type?.includes("premium_plus")) {
                    cardType = "premium_plus";
                } else {
                    cardType = transactionDetails?.external_token?.type.split("_")[2];
                }
                let decodedVCCToken

                try {
                    decodedVCCToken = jwt.verify(transactionDetails.external_token.token, secretKey);

                    // Ensure Apple Pay & Google Pay fields are provided for premium_plus cards
                    if (cardType === "premium_plus" && (decodedVCCToken.apple_pay === undefined || decodedVCCToken.google_pay === undefined)) {
                        transactionDetails.external_token = undefined;
                        await transactionDetails.save();

                        if (isChatBot) {
                            if (transactionDetails?.external_token?.type?.includes("telegram")) {
                                await telegramVCCMessageFailure(transactionDetails?.account?.telegram_id);
                            } else {
                                await sendBotTemplate(chatbotData, "Your Card creation failed. Please provide Apple Pay and Google Pay details for premium_plus cards.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
                            }
                        }

                        await logError(
                            "Virtual Card creation failed due to missing Apple Pay or Google Pay",
                            `topup_paypal_vcc_${isChatBot ? "bot" : ""}`,
                            null,
                            transactionDetails._id,
                            { message: "Missing Apple Pay or Google Pay details for premium_plus" }
                        );

                        return res.status(200).send("EVENT_RECEIVED");
                    }
                } catch (err) {
                    transactionDetails.external_token = undefined;
                    await transactionDetails.save();

                    if (isChatBot) {
                        if (transactionDetails?.external_token?.type?.includes("telegram")) {
                            await telegramVCCMessageFailure(transactionDetails?.account?.telegram_id)
                        } else {
                            await sendBotTemplate(chatbotData, "Your Card creation failed. Please try again and contact support if the issue persists.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
                        }
                    }

                    await logError(
                        "Virtual Card creation failed",
                        `topup_paypal_vcc_${isChatBot ? "bot" : ""}`,
                        null,
                        transactionDetails._id,
                        { message: err.message }
                    )

                    return res.status(200).send("EVENT_RECEIVED");
                }

                // checking max card validation
                const maxCards = await VirtualCardModel.countDocuments({ account: transactionDetails.account._id, subscription_type: "virtual" });
                if (maxCards >= 3) {
                    transactionDetails.external_token = undefined;
                    await transactionDetails.save();

                    if (isChatBot) {
                        if (transactionDetails?.external_token?.type?.includes("telegram")) {
                            await telegramVCCMessageFailure(transactionDetails?.account?.telegram_id)
                        } else if (transactionDetails?.external_token?.type?.includes("instagram")) {
                            await sendBotTemplate(chatbotData, "Your Card creation failed. Please try again and contact support if the issue persists.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
                        }

                        await logError(
                            "Virtual Card creation failed",
                            `topup_paypal_vcc_${isChatBot ? "bot" : ""}`,
                            null,
                            transactionDetails._id,
                            { message: "Max cards reached" }
                        )
                        return res.status(200).send("EVENT_RECEIVED");
                    }
                }

                const requestData = {
                    amt: '0.01',
                    currency: decodedVCCToken.currency,
                    expdate: decodedVCCToken.expdate,
                };

                if (cardType === "premium_plus") {
                    requestData.productCode = "E0W00008";
                }

                const encryptedData = encryptDataVCC(requestData);
                const payload = { data: encryptedData };

                const response = await axios.post(`${process.env.vccdaddyURL}/openapi/card/hk/multi_issue`, payload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'oaToken': process.env.vccToken,
                    }
                })

                if (response.data.code === 1) {
                    const decryptedResponse = decryptDataVCC(response.data.data);

                    const virtualCard = await VirtualCardModel.create({
                        account: transactionDetails.account._id,
                        card_id: decryptedResponse.cardId,
                        type: cardType,
                        last4: `************${decryptedResponse.cardNo.slice(-4)}`,
                        expiry: decryptedResponse.expDate,
                        subscription_type: "virtual",
                        currency: decryptedResponse.curId,
                        premium_features: cardType === "premium_plus" ? {
                            apple_pay: decodedVCCToken.apple_pay,
                            google_pay: decodedVCCToken.google_pay
                        } : undefined
                    });

                    walletDetails.balance.available -= transactionDetails.amount;
                    await walletDetails.save();

                    // updating the card phone and email if the card type is apple pay
                    if (cardType.includes("vcc_premium_plus")) {
                        try {
                            const updateErrors = await updateCardContacts(
                                decryptedResponse.cardId,
                                transactionDetails.account
                            );

                            console.log({ updateErrors })
                            if (updateErrors.length > 0) {

                                await logError(
                                    "Error while updating the card phone and email",
                                    `topup_paypal_vcc_${isChatBot ? "bot" : ""}`,
                                    null,
                                    transactionDetails._id,
                                    { errors: updateErrors }
                                )
                            }
                        } catch (err) {
                            console.log(err)
                        }

                    }
                    if (isChatBot) {
                        if (transactionDetails?.external_token?.type?.includes("telegram")) {
                            // trigger telegram notification
                            await telegramVCCMessage(transactionDetails?.account?.telegram_id, virtualCard.type);
                            transactionDetails.external_token = undefined;
                            await transactionDetails.save();
                        } else {
                            // trigger instagram notification
                            await telegramVCCMessageInstagram(chatbotData, virtualCard.type);
                            transactionDetails.external_token = undefined;
                            await transactionDetails.save();
                        }
                    }
                } else {
                    if (isChatBot) {
                        if (transactionDetails?.external_token?.type?.includes("telegram")) {
                            await telegramVCCMessageFailure(transactionDetails?.account?.telegram_id)
                        } else {
                            await sendBotTemplate(chatbotData, "Your Card creation failed. Please try again and contact support if the issue persists.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
                        }
                    }
                    transactionDetails.external_token = undefined;
                    return res.status(200).send("EVENT_RECEIVED");
                }
            }

            await transactionDetails.save();

            return res.status(200).send("EVENT_RECEIVED");
        }
    };
}

async function telegramVCCMessage(chatId, type) {
    const telegramBot = await TelegramBotModel.findOne({ recipient: chatId });
    console.log({ telegramBot })
    const selectedLanguage = telegramBot?.selected_language || "en";
    const photoUrl = type?.includes("premium") ? "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Premium1.png" : "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Standard1.png"
    await sendPhoto(chatId, photoUrl);

    const message = `🎉 Done! Your InstaPay Virtual Card is ready to use! 🚀


👉 iPhone Users: Add your card to Apple Wallet for instant tap-to-pay convenience!
👉 Android Users: Google Pay support is coming soon! Stay tuned.
`

    await sendButtons(chatId, message, [[{ text: "Card Management Menu", callback_data: "vcc_menu" }]], "4");
    const message1 = `🌍 Want to explore more card features?
Visit our InstaPay Guide for detailed information! 🔗

`

    await sendButtons(chatId, message1, [
        [{ text: "📖 InstaPay Guide", url: "https://instapay.gitbook.io/kemit-kingdom-sa/8CXSlU3g9aU7Li42DHE4/faq/faq/instapay-mastercard-virtual-prepaid-card" }],
        [{ text: "🔄 Need more help? Let’s chat!", callback_data: "main_menu" }]
    ]);
}

async function telegramVCCMessageInstagram(data, type) {
    const photoUrl = type?.includes("premium") ? "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Premium1.png" : "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Standard1.png"

    const templatePayload = {
        template_type: "generic",
        elements: [
            {
                title: "🎉 Done! Your InstaPay Virtual Card is ready to use! 🚀",
                subtitle: "👉 iPhone Users: Add your card to Apple Wallet for instant tap-to-pay convenience!\n👉 Android Users: Google Pay support is coming soon! Stay tuned.",
                image_url: photoUrl,
                buttons: [
                    {
                        type: "postback",
                        title: "Card Management Menu",
                        payload: "vcc_menu"
                    }
                ]
            }
        ]
    };
    await sendTemplate(data, data.sender.id, templatePayload, "4");
    const templatePayload1 = {
        template_type: "generic",
        elements: [
            {
                title: "🌍 Want to explore more card features? Visit our InstaPay Guide for detailed information! 🔗",
                buttons: [
                    {
                        type: "web_url",
                        title: "📖 InstaPay Guide",
                        url: `https://instapay.gitbook.io/kemit-kingdom-sa/8CXSlU3g9aU7Li42DHE4/faq/faq/instapay-mastercard-virtual-prepaid-card`,
                        webview_height_ratio: "full"
                    },
                    {
                        type: "postback",
                        title: "🔄 Need more help? Let’s chat!",
                        payload: "chat_with_us"
                    }
                ]
            }
        ]
    };
    await sendTemplate(data, data.sender.id, templatePayload1);
}

async function telegramVCCMessageFailure(chatId) {
    await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png");

    const message = `Your Card creation failed. Please try again and contact support if the issue persists.`

    await sendButtons(chatId, message, [[{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]], "4");
}

async function getAccessToken() {
    const api = `${paypalUrl}/oauth2/token`;
    const authOptions = {
        method: 'post',
        url: api,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
            username: process.env.PAYPAL_CLIENT_ID,
            password: process.env.PAYPAL_SECRET
        },
        data: 'grant_type=client_credentials',
    };

    try {
        const tokenResponse = await axios(authOptions);
        return tokenResponse.data.access_token;
    } catch (error) {
        console.error("Error fetching access token", error.response?.data || error.message);
        throw new Error("Could not fetch access token");
    }
}

module.exports.getPaymentDetails = async (req, res) => {
    const { payment_id } = req.params;

    try {
        const accessToken = await getAccessToken();
        console.log(accessToken);

        const paymentDetailsOptions = {
            url: `${paypalUrl}/payments/payment/${payment_id}`,
            method: 'get',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
        };

        const paymentDetailsResponse = await axios(paymentDetailsOptions);
        console.log(paymentDetailsResponse.data);

        const relatedResources = paymentDetailsResponse.data.transactions[0]?.related_resources;
        let saleState = null;

        if (relatedResources) {
            const saleResource = relatedResources.find(resource => resource.sale);
            saleState = saleResource?.sale?.state || null;
        }

        const ciphertext = await encryption({
            status: true,
            message: "transaction details",
            transactioStatus: saleState

        });

        return res.status(200).send(ciphertext);

    } catch (error) {
        console.error('Error fetching payment details:', error.response?.data || error.message);
        res.status(500).send(await encryption({ status: false, message: 'Failed to fetch payment details' }));
    }
};

// refund
module.exports.refundSale = async (req, res) => {
    // const { paymentId } = req.params;
    const { total, currency, invoice_id, payer_email } = req.body;

    try {
        const accessToken = await getAccessToken();

        const refundOptions = {
            url: `${paypalUrl}/payments/sale/49Y23743CA7402634/refund`,
            method: 'post',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            data: {
                "amount": {
                    "total": 6,
                    "currency": "USD"
                },
                "invoice_id": "",
                "payer_info": {
                    "email": "sb-wdl8t5194797@personal.example.com"
                }
            }
        };

        const refundResponse = await axios(refundOptions);

        res.status(200).json({
            status: true,
            message: 'Refund processed successfully',
            data: refundResponse.data
        });

    } catch (error) {
        console.error('Error processing refund:', error.response?.data || error.message);
        res.status(500).json({
            status: false,
            message: 'Failed to process refund',
            error: error.response?.data || error.message
        });
    }
};

// get fee
module.exports.getPaypalFee = async (req, res) => {
    try {
        const wallet_id = req.params.wallet_id;
        const amount = parseFloat(req.params.amount)
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

        if (!wallet) {
            let error = await encryption({
                status: false,
                message: "Wallet not found!"
            });
            return res.status(404).send(error);
        }

        let feeDetails = await topUpFeeCalculation(wallet, amount, 'topup_paypal');

        const finalAmount = formatDecimalNumbersWithLimit(amount - feeDetails, 2);

        if (finalAmount <= 0) {
            let error = await encryption({
                status: false,
                message: "Amount after fee deduction is too low!"
            });
            return res.status(400).send(error);
        }

        let amountInUSD = amount;
        let rate = 1;

        // If the wallet currency is not supported by PayPal, convert to USD
        if (!supportedCurrencies?.includes(wallet.currency.code)) {
            amountInUSD = await getExchangeRatesToUSD(wallet.currency.code, "USD", amount);
            rate = await getExchangeRatesToUSD(wallet.currency.code, "USD", 1);
        }

        const payload = {
            fee: feeDetails,
            original_amount: amount,
            converted_amount: amountInUSD,
            remainingAmount: finalAmount
        };

        const token = jwt.sign(payload, secretKey, { expiresIn: '1h' });

        // Encrypting response data
        const ciphertext = await encryption({
            status: true,
            message: "Fee fetched successfully!",
            data: {
                fee: feeDetails,
                amount,
                recipient_amount: finalAmount,
                converted_amount: amountInUSD,
                converted_currency: "USD",
                rate,
                original_currency: wallet.currency.code,
                token
            }
        })

        return res.status(200).send(ciphertext);

    } catch (error) {
        console.error('Error processing refund:', error.response?.data || error.message);
        res.status(500).json({
            status: false,
            message: 'Failed to fetch fee',
            error: error.response?.data || error.message
        });
    }
}

// international
module.exports.initiatIntlPaypalTransaction = async (req, res) => {
    try {
        console.log(req.body)
        let data = req.body
        const {
            wallet_id,
            transactionDetails
        } = data;

        let ref = 'tr_' + Date.now().toString();

        // let decoded =
        // {
        //     "TransactionID": "instapay_t_id_1729847083309",
        //     "wallet_id": "66bf28268a779f59e2461aeb",
        //     "status_message": "CREATED",
        //     "user_id": "6663f3bb48ce900921c8d91c",
        //     "transactionDetails": {
        //         "calculations": {
        //             "exchanged_rate": {
        //                 "value": 300.60506656,
        //                 "currency": "PKR"
        //             },
        //             "fee": {
        //                 "value": 1.76,
        //                 "currency": "CHF"
        //             },
        //             "recipient": {
        //                 "value": 3306.66,
        //                 "currency": "PKR"
        //             },
        //             "total": {
        //                 "value": 12.76,
        //                 "currency": "CHF"
        //             },
        //             "sending": {
        //                 "value": 11,
        //                 "currency": "CHF"
        //             },
        //             "paypal": {
        //                 "paypal_converted": {
        //                     "value": 11,
        //                     "currency": "USD"
        //                 },
        //                 "paypal_rate": {
        //                     "value": 1,
        //                     "currency": "USD"
        //                 },
        //                 "paypal_currency_supported": true,
        //                 "fee": {
        //                     "value": 0.0275,
        //                     "currency": "CHF"
        //                 }
        //             },
        //             "min_amount": 0
        //         },
        //         "extras": {
        //             "markup_value": 6,
        //             "fee_type": "flat",
        //             "original_exchange_rate": 319.792624,
        //             "exchange_rate_with_markup": 300.60506656,
        //             "precision": 2
        //         },
        //         "purpose": "GIFT_AND_DONATION",
        //         "description": "",
        //         "service_id": 1,
        //         "beneficiary_id": "66ba000aec8498ea57a1ce8a",
        //         "credit_party_identifier": {
        //             "msisdn": "923193921220",
        //             "account_number": "",
        //             "iban": "",
        //             "email": "sarfarazahmed1012@gmail.com",
        //             "bank_account_number": "",
        //             "account_type": ""
        //         }
        //     }
        // }

        let receiverWallet = await Wallet.findOne({
            $and: [
                { _id: wallet_id },
                { wallet_type: "insta" },
                { status: 'active' },
                {
                    $or: [
                        { $and: [{ admin_blocked: false }, { blocked: false }] },
                        { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] },
                        { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] },
                        { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] }
                    ]
                }
            ]
        }).populate([{ path: 'account', populate: (['level']) }]);

        if (!receiverWallet) {
            let error = await encryption({
                status: false,
                message: "Wallet not found."
            });
            return res.status(404).send(error);
        }

        let featureChecked = await featureCheck('topup_channel', 'paypal', receiverWallet.account.level);
        if (featureChecked) {

            const { calculations } = transactionDetails;
            let paypalAmount = calculations.paypal.paypal_currency_supported ? calculations.total.value : calculations.paypal.paypal_converted.value
            let paypalCurrency = !calculations.paypal.paypal_currency_supported ? "USD" : receiverWallet.currency.code
            console.log(calculations.paypal.paypal_currency_supported, "testing")

            let amountInUSD = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', calculations.total.value - calculations.paypal.fee.value));
            let amountInUSDTotal = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', calculations.total.value));

            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account)
            let limitChecked = limitCheck(parseFloat(amountInUSDTotal), receiverWallet.account.level, receiverWallet.account, 'topup')
            if (limitChecked.status && balanceLimitChecked) {
                let api = `${paypalUrl}/oauth2/token`;
                let obj = {
                    url: api,
                    method: 'post',
                    data: 'grant_type=client_credentials',
                    auth: {
                        username: process.env.PAYPAL_CLIENT_ID,
                        password: process.env.PAYPAL_SECRET
                    }
                }
                axios(obj).then(async (resp) => {
                    let paymentApi = `${paypalUrl}/payments/payment`;
                    const cnfg = {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + resp.data.access_token,
                        },
                    }
                    let paymentObj = {
                        "intent": "sale",
                        "payer": {
                            "payment_method": "paypal"
                        },
                        "transactions": [
                            {
                                "amount": {
                                    "total": formatDecimalNumbersWithLimit(paypalAmount, 2)?.toFixed(2),
                                    "currency": paypalCurrency
                                },
                                "description": receiverWallet?.account?.username,
                                "custom": receiverWallet.wallet_id,
                                "item_list": {
                                    //     "items": [
                                    //         {
                                    //             "name": "hat",
                                    //             "description": "Brown hat.",
                                    //             "quantity": "5",
                                    //             "price": "3",
                                    //             "tax": "0.01",
                                    //             "sku": "1",
                                    //             "currency": "USD"
                                    //         },
                                    //         {
                                    //             "name": "handbag",
                                    //             "description": "Black handbag.",
                                    //             "quantity": "1",
                                    //             "price": "15",
                                    //             "tax": "0.02",
                                    //             "sku": "product34",
                                    //             "currency": "USD"
                                    //         }
                                    //     ],
                                    "shipping_address": {
                                        "recipient_name": `${receiverWallet?.account?.first_name} ${receiverWallet?.account?.last_name}`,
                                        "line1": `${receiverWallet?.account?.address || receiverWallet?.account?.country_iso_code}`,
                                        "city": `${receiverWallet?.account?.city || ""}`,
                                        "country_code": `${iso2Countries[receiverWallet?.account?.country_iso_code] || "CH"}`,
                                        "postal_code": `${receiverWallet?.account?.postal_code || ""}`,
                                        "phone": `${receiverWallet?.account?.phone || ""}`,
                                    }
                                }
                            }
                        ],
                        "redirect_urls": {
                            "return_url": `https://my.insta-pay.ch/add-funds/success/null?transaction_id=${ref}`,
                            "cancel_url": `https://my.insta-pay.ch/add-funds/error/null?transaction_id=${ref}`
                        }
                    }
                    console.log(paymentObj, 'paymentObj', paymentObj.transactions[0].amount, 'amount', paymentObj.transactions[0].item_list, 'total');
                    axios.post(paymentApi, paymentObj, cnfg).then(async (resp1) => {
                        if (resp1.data.state === 'created') {
                            const receiverTimezone = receiverWallet.account?.timezone || "UTC"
                            const receiverCurrentTime = moment().tz(receiverTimezone).format();

                            const token = jwt.sign(data, secretKeyIntl);

                            let receiverTransactionObj = {
                                reference_id: ref,
                                type: 'instant',
                                transaction_type: 'credit',
                                service_type: 'topup',
                                payment_type: 'paypal',
                                status: 'INITIATED',
                                purpose: '',
                                payment_id: resp1.data.id,
                                description: 'Topup by Paypal',
                                currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                                replacement_currency: { code: paypalCurrency, value: formatDecimalNumbersWithLimit(paypalAmount, 2)?.toFixed(2), rate: calculations.paypal.paypal_rate.value },
                                amount: calculations.total.value - calculations.paypal.fee.value,
                                fee: calculations.paypal.fee.value,
                                total: calculations.total.value,
                                wallet_id: receiverWallet.wallet_id,
                                wallet: receiverWallet._id,
                                account: receiverWallet.account._id,
                                receiver: receiverWallet.account._id,
                                current_balance: receiverWallet.balance.available,
                                hidden: true,
                                external_token: {
                                    token: token,
                                    type: "international"
                                },
                                timeline: [
                                    {
                                        status: 'INITIATED',
                                        date: receiverCurrentTime,
                                    }
                                ]
                            };

                            Transaction.create(receiverTransactionObj).then(async (transaction) => {
                                let link = resp1.data.links.find(l => l.rel === 'approval_url');
                                let ciphertext = await encryption({
                                    status: "true",
                                    message: "Transaction initiated successfully.",
                                    currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                                    transaction_id: transaction._id,
                                    transaction_ref: transaction.reference_id,
                                    url: link ? link.href : ''
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
                            let ciphertext = await encryption({
                                status: "false",
                                message: "Transaction failed.",
                                error: err
                            })
                            res.status(400).send(ciphertext);
                        }
                    }).catch(async (err) => {
                        console.log(err?.response?.data?.details || err);
                        let ciphertext = await encryption({
                            status: "false",
                            message: "Transaction failed.",
                            error: err
                        })
                        res.status(400).send(ciphertext);
                    })
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

// w2w
module.exports.initiatW2WPaypalTransaction = async (req, res) => {
    try {
        console.log("bodyininitiatew2wpayapl", req.body)
        let data = req.body
        let {
            receiver_wallet_id,
            sender_wallet_id,
            purpose,
            type,
            payment_type,
            description,
            request_id,
            token,
            quotation_id
        } = data;

        let decoded;
        try {
            decoded = jwt.verify(token, secretKey);
        } catch (err) {
            console.log(err)
            let error = await encryption({
                status: false,
                message: "Invalid token."
            });
            return res.status(400).send(error);
        }

        let requestBody, senderWallet;
        if (decoded.type === "quotation") {
            const quotation = await QuotationModel.findOne({ _id: quotation_id, status: { $in: ['sent', 'revise', 'bargain-accepted'] } }).populate({
                path: 'sender',
                populate: {
                    path: 'insta_recipient_id'
                }
            })
            if (!quotation) {
                return res.status(400).send(await encryption({
                    status: false,
                    message: "Quotation not found or already accepted!"
                }))
            }

            let amount;
            if (quotation.revised_amount) {
                amount = quotation.revised_amount
            } else {
                amount = quotation.amount
            }

            const quotation_receiver_wallet = await Wallet.findById(quotation.amount_reciever_currency);
            senderWallet = await Wallet.findOne({
                $and: [
                    { _id: receiver_wallet_id },
                    { wallet_type: "insta" },
                    { status: 'active' },
                    {
                        $or: [
                            { $and: [{ admin_blocked: false }, { blocked: false }] },
                            { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] },
                            { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] },
                            { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] }
                        ]
                    }
                ]
            }).populate([{ path: 'account', populate: (['level']) }]);

            requestBody = {
                sender_wallet_id: receiver_wallet_id,
                receiver_wallet_id: quotation_receiver_wallet?.wallet_id,
                amount,
                purpose: quotation.purpose,
                service_type: 'wallet_to_wallet',
                payment_type: 'quotation',
                link: quotation._id,
                description: quotation.desc,
                transaction_type: "request",
                payment_method: "paypal"
            }

        } else if (decoded.type === "payment_request") {
            let requestDetails = await RequestPaymentModel.findOne({ $and: [{ reference_id: request_id }, { status: 'pending' }] })
            if (!requestDetails) {
                let error = await encryption({
                    status: "false",
                    message: "Request not found!"
                })
                return res.status(404).send(error);
            }

            let receiver_wallet_id = requestDetails.wallet_id;
            let amount = requestDetails.amount;

            senderWallet = await Wallet.findOne({ $and: [{ _id: sender_wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company', 'insta_recipient_id']) }])

            requestBody = {
                sender_wallet_id,
                receiver_wallet_id,
                amount,
                purpose: purpose,
                service_type: 'wallet_to_wallet',
                payment_type: 'payment_request',
                link: requestDetails._id,
                description: requestDetails.description,
                transaction_type: "request",
                payment_method: "paypal"
            }
        } else {
            senderWallet = await Wallet.findOne({ $and: [{ _id: sender_wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company', 'insta_recipient_id']) }])

            requestBody = {
                ...data,
                payment_method: "paypal"
            }
        }

        requestBody.token = token

        console.log({ requestBody })

        let ref = 'tr_' + Date.now().toString();

        if (!senderWallet) {
            let error = await encryption({
                status: false,
                message: "Wallet not found."
            });
            return res.status(404).send(error);
        }

        let featureChecked = await featureCheck('topup_channel', 'paypal', senderWallet.account.level);
        if (featureChecked) {

            let paypalAmount = decoded.paypal.paypal_currency_supported ? decoded.total.value : decoded.paypal.paypal_converted.value
            let paypalCurrency = !decoded.paypal.paypal_currency_supported ? "USD" : senderWallet.currency.code
            console.log(decoded.paypal.paypal_currency_supported, "testing")

            let amountInUSD = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(senderWallet.currency.code, 'USD', decoded.total.value - decoded.paypal.fee.value));
            let amountInUSDTotal = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(senderWallet.currency.code, 'USD', decoded.total.value));

            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), senderWallet.account);
            let limitChecked = limitCheck(parseFloat(amountInUSDTotal), senderWallet.account.level, senderWallet.account, 'topup');

            if (limitChecked.status && balanceLimitChecked) {
                let api = `${paypalUrl}/oauth2/token`;
                let obj = {
                    url: api,
                    method: 'post',
                    data: 'grant_type=client_credentials',
                    auth: {
                        username: process.env.PAYPAL_CLIENT_ID,
                        password: process.env.PAYPAL_SECRET
                    }
                }
                axios(obj).then(async (resp) => {
                    let paymentApi = `${paypalUrl}/payments/payment`;
                    const cnfg = {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + resp.data.access_token,
                        },
                    }
                    let paymentObj = {
                        "intent": "sale",
                        "payer": {
                            "payment_method": "paypal"
                        },
                        "transactions": [
                            {
                                "amount": {
                                    "total": formatDecimalNumbersWithLimit(paypalAmount, 2)?.toFixed(2),
                                    "currency": paypalCurrency
                                },
                                "description": senderWallet?.account?.username,
                                "custom": senderWallet.wallet_id,
                                "item_list": {
                                    //     "items": [
                                    //         {
                                    //             "name": "hat",
                                    //             "description": "Brown hat.",
                                    //             "quantity": "5",
                                    //             "price": "3",
                                    //             "tax": "0.01",
                                    //             "sku": "1",
                                    //             "currency": "USD"
                                    //         },
                                    //         {
                                    //             "name": "handbag",
                                    //             "description": "Black handbag.",
                                    //             "quantity": "1",
                                    //             "price": "15",
                                    //             "tax": "0.02",
                                    //             "sku": "product34",
                                    //             "currency": "USD"
                                    //         }
                                    //     ],
                                    "shipping_address": {
                                        "recipient_name": `${senderWallet?.account?.first_name} ${senderWallet?.account?.last_name}`,
                                        "line1": `${senderWallet?.account?.address || senderWallet?.account?.country_iso_code}`,
                                        "city": `${senderWallet?.account?.city || ""}`,
                                        "country_code": `${iso2Countries[senderWallet?.account?.country_iso_code] || "CH"}`,
                                        "postal_code": `${senderWallet?.account?.postal_code || ""}`,
                                        "phone": `${senderWallet?.account?.phone || ""}`,
                                    }
                                }
                            }
                        ],
                        "redirect_urls": {
                            "return_url": `https://my.insta-pay.ch/add-funds/success/null?transaction_id=${ref}`,
                            "cancel_url": `https://my.insta-pay.ch/add-funds/error/null?transaction_id=${ref}`
                        }
                    }
                    console.log(paymentObj, 'paymentObj', paymentObj.transactions[0].amount, 'amount', paymentObj.transactions[0].item_list, 'total');
                    axios.post(paymentApi, paymentObj, cnfg).then(async (resp1) => {
                        if (resp1.data.state === 'created') {
                            const receiverTimezone = senderWallet.account?.timezone || "UTC"
                            const receiverCurrentTime = moment().tz(receiverTimezone).format();

                            const newToken = jwt.sign(requestBody, secretKeyIntl, { expiresIn: "10m" });

                            let receiverTransactionObj = {
                                reference_id: ref,
                                type: 'instant',
                                transaction_type: 'credit',
                                service_type: 'topup',
                                payment_type: 'paypal',
                                status: 'INITIATED',
                                purpose: '',
                                payment_id: resp1.data.id,
                                description: 'Topup by Paypal',
                                currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
                                replacement_currency: { code: paypalCurrency, value: formatDecimalNumbersWithLimit(paypalAmount, 2)?.toFixed(2), rate: decoded.paypal.paypal_rate.value },
                                amount: decoded.total.value - decoded.paypal.fee.value,
                                fee: decoded.paypal.fee.value,
                                total: decoded.total.value,
                                wallet_id: senderWallet.wallet_id,
                                wallet: senderWallet._id,
                                account: senderWallet.account._id,
                                receiver: senderWallet.account._id,
                                current_balance: senderWallet.balance.available,
                                hidden: true,
                                external_token: {
                                    token: newToken,
                                    type: "wallet_to_wallet"
                                },
                                timeline: [
                                    {
                                        status: 'INITIATED',
                                        date: receiverCurrentTime,
                                    }
                                ]
                            };

                            Transaction.create(receiverTransactionObj).then(async (transaction) => {
                                let link = resp1.data.links.find(l => l.rel === 'approval_url');
                                let ciphertext = await encryption({
                                    status: "true",
                                    message: "Transaction initiated successfully.",
                                    currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
                                    transaction_id: transaction._id,
                                    transaction_ref: transaction.reference_id,
                                    url: link ? link.href : ''
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
                            let ciphertext = await encryption({
                                status: "false",
                                message: "Transaction failed.",
                                error: err
                            })
                            res.status(400).send(ciphertext);
                        }
                    }).catch(async (err) => {
                        console.log(err?.response?.data?.details || err);
                        let ciphertext = await encryption({
                            status: "false",
                            message: "Transaction failed.",
                            error: err
                        })
                        res.status(400).send(ciphertext);
                    })
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

async function handleW2WPaypalTransction(decoded, files, req) {

    let transaction_type
    if (
        decoded?.payment_type === 'qr_pay'
        || decoded?.payment_type === 'payment_address'
        || decoded?.payment_type === 'payment_request'
        || decoded?.payment_type === 'quotation'
    ) {
        transaction_type = 'request'
    } else {
        transaction_type = 'instant'
    }

    decoded['payment_type'] = decoded.payment_type ? decoded.payment_type : 'wallet_to_wallet';
    decoded['payment_method'] = 'paypal'
    decoded['transaction_type'] = transaction_type;

    console.log(decoded, "decoded")

    const response = await walletToWalletTransactionHelper(decoded, req, files)
    console.log({ response })

    return { status: response.status, message: response.message, data: response.data }
}

// KYC
module.exports.initiateKYCPaypalTransaction = async (req, res) => {
    try {
        const user = req.user

        let countryDetails = await Country.findOne({ _id: user.country }, { status: true, kyc_fee: true })
        let accountFound = await Account.findOne({
            $and: [
                { _id: req.user._id },
                { kyc_verification_paid: true }
            ]
        });

        if (accountFound) {
            let error = await encryption({
                status: true,
                message: "Payment already done!"
            });
            return res.status(200).send(error);
        }

        if (!countryDetails || countryDetails.status != "active" || !countryDetails.kyc_fee) {
            let error = await encryption({
                status: false,
                message: "Unable to process payment in this country!"
            });
            return res.status(400).send(error);
        }

        let ref = 'tr_' + Date.now().toString();

        let api = `${paypalUrl}/oauth2/token`;
        let obj = {
            url: api,
            method: 'post',
            data: 'grant_type=client_credentials',
            auth: {
                username: process.env.PAYPAL_CLIENT_ID,
                password: process.env.PAYPAL_SECRET
            }
        }
        axios(obj).then(async (resp) => {
            let paymentApi = `${paypalUrl}/payments/payment`;
            const cnfg = {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + resp.data.access_token,
                },
            }
            let paymentObj = {
                "intent": "sale",
                "payer": {
                    "payment_method": "paypal"
                },
                "transactions": [
                    {
                        "amount": {
                            "total": formatDecimalNumbersWithLimit(countryDetails.kyc_fee, 2)?.toFixed(2),
                            "currency": "USD"
                        },
                        "description": "Instapay KYC Payment",
                        "custom": req.user?.username,
                        "item_list": {
                            "shipping_address": {
                                "recipient_name": `${req.user?.first_name} ${req.user?.last_name}`,
                                "line1": `${req.user?.address || req.user?.country_iso_code}`,
                                "city": `${req.user?.city || ""}`,
                                "country_code": `${iso2Countries[req.user?.country_iso_code] || "CH"}`,
                                "postal_code": `${req.user?.postal_code || ""}`,
                                "phone": `${req.user?.phone || ""}`,
                            }
                        }
                    }
                ],
                "redirect_urls": {
                    "return_url": `https://my.insta-pay.ch/settings?tab=verification&status=success&payment_through=paypal`,
                    "cancel_url": `https://my.insta-pay.ch/settings?tab=verification&status=failed&payment_through=paypal`
                }
            }
            console.log(paymentObj, 'paymentObj', paymentObj.transactions[0].amount, 'amount', paymentObj.transactions[0].item_list, 'total');
            axios.post(paymentApi, paymentObj, cnfg).then(async (resp1) => {
                if (resp1.data.state === 'created') {
                    const receiverTimezone = req.user?.timezone || "UTC"
                    const receiverCurrentTime = moment().tz(receiverTimezone).format();

                    // const defaultWallet = await Wallet.findOne({ account: req.user._id, default: true }).populate([{ path: "account", populate: "level" }])
                    const defaultWallet = fetchLocalOrDefaultWalletConditionally(req.user._id)

                    if (!defaultWallet) {
                        return res.status(400).send(await encryption({ status: false, message: "Local or Default Wallet not found!" }))
                    }

                    let receiverTransactionObj = {
                        reference_id: ref,
                        type: 'instant',
                        transaction_type: 'credit',
                        service_type: 'topup',
                        payment_type: 'paypal',
                        status: 'INITIATED',
                        purpose: '',
                        payment_id: resp1.data.id,
                        description: 'Topup by Paypal',
                        currency: { code: "USD", symbol: "$" },
                        amount: countryDetails.kyc_fee,
                        fee: 0,
                        total: countryDetails.kyc_fee,
                        wallet: defaultWallet._id,
                        account: req.user._id,
                        receiver: req.user._id,
                        hidden: true,
                        external_token: {
                            token: undefined,
                            type: "kyc_fee"
                        },
                        timeline: [
                            {
                                status: 'INITIATED',
                                date: receiverCurrentTime,
                            }
                        ]
                    };

                    Transaction.create(receiverTransactionObj).then(async (transaction) => {
                        let link = resp1.data.links.find(l => l.rel === 'approval_url');
                        let ciphertext = await encryption({
                            status: "true",
                            message: "Transaction initiated successfully.",
                            // currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                            transaction_id: transaction._id,
                            transaction_ref: transaction.reference_id,
                            url: link ? link.href : ''
                        })
                        res.status(200).send(ciphertext);
                    }).catch(async (err) => {
                        console.log(err)
                        let ciphertext = await encryption({
                            status: "false",
                            message: "Transaction failed.",
                        })
                        res.status(400).send(ciphertext);
                    })
                } else {
                    let ciphertext = await encryption({
                        status: "false",
                        message: "Transaction failed.",
                    })
                    res.status(400).send(ciphertext);
                }
            }).catch(async (err) => {
                console.log(err?.response?.data?.details || err);
                let ciphertext = await encryption({
                    status: "false",
                    message: "Transaction failed.",
                })
                res.status(400).send(ciphertext);
            })
        }).catch(async (err) => {
            console.log(err);
            let ciphertext = await encryption({
                status: "false",
                message: "Transaction failed.",
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

// AIRTIME RANGED
module.exports.initiateAirtimePaypalTransaction = async (req, res) => {
    try {
        console.log("bodyininitiateairtimerangedpayapl", req.body)
        let data = req.body
        let {
            number,
            token,
            wallet_id,
        } = data;

        let decoded;
        try {
            decoded = jwt.verify(token, secretKey);
        } catch (err) {
            console.log(err)
            let error = await encryption({
                status: false,
                message: "Invalid token."
            });
            return res.status(400).send(error);
        }

        const wallet = await Wallet.findOne({
            $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])

        let ref = 'tr_' + Date.now().toString();

        let featureChecked = await featureCheck('topup_channel', 'paypal', wallet.account.level);
        if (featureChecked) {

            const paypalDetails = decoded.paypal
            let paypalAmount = paypalDetails.paypal_currency_supported ? decoded.total.value : paypalDetails.paypal_converted.value
            let paypalCurrency = !paypalDetails.paypal_currency_supported ? "USD" : wallet.currency.code
            console.log(paypalDetails, "testing")

            let amountInUSD = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(wallet.currency.code, 'USD', decoded.total.value - paypalDetails.fee.value));
            let amountInUSDTotal = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(wallet.currency.code, 'USD', decoded.total.value));

            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), wallet.account)
            let limitChecked = limitCheck(parseFloat(amountInUSDTotal), wallet.account.level, wallet.account, 'topup');

            if (limitChecked.status && balanceLimitChecked) {
                let api = `${paypalUrl}/oauth2/token`;
                let obj = {
                    url: api,
                    method: 'post',
                    data: 'grant_type=client_credentials',
                    auth: {
                        username: process.env.PAYPAL_CLIENT_ID,
                        password: process.env.PAYPAL_SECRET
                    }
                }
                axios(obj).then(async (resp) => {
                    let paymentApi = `${paypalUrl}/payments/payment`;
                    const cnfg = {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + resp.data.access_token,
                        },
                    }
                    let paymentObj = {
                        "intent": "sale",
                        "payer": {
                            "payment_method": "paypal"
                        },
                        "transactions": [
                            {
                                "amount": {
                                    "total": formatDecimalNumbersWithLimit(paypalAmount, 2)?.toFixed(2),
                                    "currency": paypalCurrency
                                },
                                "description": wallet?.account?.username,
                                "custom": wallet.wallet_id,
                                "item_list": {
                                    //     "items": [
                                    //         {
                                    //             "name": "hat",
                                    //             "description": "Brown hat.",
                                    //             "quantity": "5",
                                    //             "price": "3",
                                    //             "tax": "0.01",
                                    //             "sku": "1",
                                    //             "currency": "USD"
                                    //         },
                                    //         {
                                    //             "name": "handbag",
                                    //             "description": "Black handbag.",
                                    //             "quantity": "1",
                                    //             "price": "15",
                                    //             "tax": "0.02",
                                    //             "sku": "product34",
                                    //             "currency": "USD"
                                    //         }
                                    //     ],
                                    "shipping_address": {
                                        "recipient_name": `${wallet?.account?.first_name} ${wallet?.account?.last_name}`,
                                        "line1": `${wallet?.account?.address || wallet?.account?.country_iso_code}`,
                                        "city": `${wallet?.account?.city || ""}`,
                                        "country_code": `${iso2Countries[wallet?.account?.country_iso_code] || "CH"}`,
                                        "postal_code": `${wallet?.account?.postal_code || ""}`,
                                        "phone": `${wallet?.account?.phone || ""}`,
                                    }
                                }
                            }
                        ],
                        "redirect_urls": {
                            "return_url": `https://my.insta-pay.ch/add-funds/success/null?transaction_id=${ref}`,
                            "cancel_url": `https://my.insta-pay.ch/add-funds/error/null?transaction_id=${ref}`
                        }
                    }
                    console.log(paymentObj, 'paymentObj', paymentObj.transactions[0].amount, 'amount', paymentObj.transactions[0].item_list, 'total');
                    axios.post(paymentApi, paymentObj, cnfg).then(async (resp1) => {
                        if (resp1.data.state === 'created') {
                            const receiverTimezone = wallet.account?.timezone || "UTC"
                            const receiverCurrentTime = moment().tz(receiverTimezone).format();

                            const payload = {
                                ...decoded,
                                wallet_id,
                                number
                            }

                            const newToken = jwt.sign(payload, secretKeyIntl);

                            let receiverTransactionObj = {
                                reference_id: ref,
                                type: 'instant',
                                transaction_type: 'credit',
                                service_type: 'topup',
                                payment_type: 'paypal',
                                status: 'INITIATED',
                                purpose: '',
                                payment_id: resp1.data.id,
                                description: 'Topup by Paypal',
                                currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
                                replacement_currency: { code: paypalCurrency, value: formatDecimalNumbersWithLimit(paypalAmount, 2)?.toFixed(2), rate: paypalDetails.paypal_rate.value },
                                amount: decoded.total.value - paypalDetails.fee.value,
                                fee: paypalDetails.fee.value,
                                total: decoded.total.value,
                                wallet_id: wallet.wallet_id,
                                wallet: wallet._id,
                                account: wallet.account._id,
                                receiver: wallet.account._id,
                                current_balance: wallet.balance.available,
                                hidden: true,
                                external_token: {
                                    token: newToken,
                                    type: "airtime_ranged"
                                },
                                timeline: [
                                    {
                                        status: 'INITIATED',
                                        date: receiverCurrentTime,
                                    }
                                ]
                            };

                            Transaction.create(receiverTransactionObj).then(async (transaction) => {
                                let link = resp1.data.links.find(l => l.rel === 'approval_url');
                                let ciphertext = await encryption({
                                    status: "true",
                                    message: "Transaction initiated successfully.",
                                    currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
                                    transaction_id: transaction._id,
                                    transaction_ref: transaction.reference_id,
                                    url: link ? link.href : ''
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
                            let ciphertext = await encryption({
                                status: "false",
                                message: "Transaction failed.",
                                error: err
                            })
                            res.status(400).send(ciphertext);
                        }
                    }).catch(async (err) => {
                        console.log(err?.response?.data?.details || err);
                        let ciphertext = await encryption({
                            status: "false",
                            message: "Transaction failed.",
                            error: err
                        })
                        res.status(400).send(ciphertext);
                    })
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

// AIRTIME FIXED
module.exports.initiateAirtimeFixedPaypalTransaction = async (req, res) => {
    try {
        console.log("bodyininitiateairtimefixedpayapl", req.body)
        let data = req.body
        let {
            number,
            token,
            wallet_id,
        } = data;

        let decoded;
        try {
            decoded = jwt.verify(token, secretKey);
        } catch (err) {
            console.log(err)
            let error = await encryption({
                status: false,
                message: "Invalid token."
            });
            return res.status(400).send(error);
        }

        console.log({ decoded })

        const wallet = await Wallet.findOne({
            $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])

        let ref = 'tr_' + Date.now().toString();

        let featureChecked = await featureCheck('topup_channel', 'paypal', wallet.account.level);
        if (featureChecked) {

            const paypalDetails = decoded.converted.paypal
            let paypalAmount = paypalDetails.paypal_currency_supported ? decoded.converted.total.value : paypalDetails.paypal_converted.value
            let paypalCurrency = !paypalDetails.paypal_currency_supported ? "USD" : wallet.currency.code
            console.log(paypalDetails, "testing")

            let amountInUSD = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(wallet.currency.code, 'USD', decoded.converted.total.value - paypalDetails.fee.value));
            let amountInUSDTotal = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(wallet.currency.code, 'USD', decoded.converted.total.value));

            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), wallet.account)
            let limitChecked = limitCheck(parseFloat(amountInUSDTotal), wallet.account.level, wallet.account, 'topup')

            if (limitChecked.status && balanceLimitChecked) {
                let api = `${paypalUrl}/oauth2/token`;
                let obj = {
                    url: api,
                    method: 'post',
                    data: 'grant_type=client_credentials',
                    auth: {
                        username: process.env.PAYPAL_CLIENT_ID,
                        password: process.env.PAYPAL_SECRET
                    }
                }
                axios(obj).then(async (resp) => {
                    let paymentApi = `${paypalUrl}/payments/payment`;
                    const cnfg = {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + resp.data.access_token,
                        },
                    }
                    let paymentObj = {
                        "intent": "sale",
                        "payer": {
                            "payment_method": "paypal"
                        },
                        "transactions": [
                            {
                                "amount": {
                                    "total": formatDecimalNumbersWithLimit(paypalAmount, 2)?.toFixed(2),
                                    "currency": paypalCurrency
                                },
                                "description": wallet?.account?.username,
                                "custom": wallet.wallet_id,
                                "item_list": {
                                    //     "items": [
                                    //         {
                                    //             "name": "hat",
                                    //             "description": "Brown hat.",
                                    //             "quantity": "5",
                                    //             "price": "3",
                                    //             "tax": "0.01",
                                    //             "sku": "1",
                                    //             "currency": "USD"
                                    //         },
                                    //         {
                                    //             "name": "handbag",
                                    //             "description": "Black handbag.",
                                    //             "quantity": "1",
                                    //             "price": "15",
                                    //             "tax": "0.02",
                                    //             "sku": "product34",
                                    //             "currency": "USD"
                                    //         }
                                    //     ],
                                    "shipping_address": {
                                        "recipient_name": `${wallet?.account?.first_name} ${wallet?.account?.last_name}`,
                                        "line1": `${wallet?.account?.address || wallet?.account?.country_iso_code}`,
                                        "city": `${wallet?.account?.city || ""}`,
                                        "country_code": `${iso2Countries[wallet?.account?.country_iso_code] || "CH"}`,
                                        "postal_code": `${wallet?.account?.postal_code || ""}`,
                                        "phone": `${wallet?.account?.phone || ""}`,
                                    }
                                }
                            }
                        ],
                        "redirect_urls": {
                            "return_url": `https://my.insta-pay.ch/add-funds/success/null?transaction_id=${ref}`,
                            "cancel_url": `https://my.insta-pay.ch/add-funds/error/null?transaction_id=${ref}`
                        }
                    }
                    console.log(paymentObj, 'paymentObj', paymentObj.transactions[0].amount, 'amount', paymentObj.transactions[0].item_list, 'total');
                    axios.post(paymentApi, paymentObj, cnfg).then(async (resp1) => {
                        if (resp1.data.state === 'created') {
                            const receiverTimezone = wallet.account?.timezone || "UTC"
                            const receiverCurrentTime = moment().tz(receiverTimezone).format();

                            const payload = {
                                ...decoded,
                                wallet_id,
                                number
                            }

                            const newToken = jwt.sign(payload, secretKeyIntl);

                            let receiverTransactionObj = {
                                reference_id: ref,
                                type: 'instant',
                                transaction_type: 'credit',
                                service_type: 'topup',
                                payment_type: 'paypal',
                                status: 'INITIATED',
                                purpose: '',
                                payment_id: resp1.data.id,
                                description: 'Topup by Paypal',
                                currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
                                replacement_currency: { code: paypalCurrency, value: formatDecimalNumbersWithLimit(paypalAmount, 2)?.toFixed(2), rate: paypalDetails.paypal_rate.value },
                                amount: decoded.converted.total.value - paypalDetails.fee.value,
                                fee: paypalDetails.fee.value,
                                total: decoded.converted.total.value,
                                wallet_id: wallet.wallet_id,
                                wallet: wallet._id,
                                account: wallet.account._id,
                                receiver: wallet.account._id,
                                current_balance: wallet.balance.available,
                                hidden: true,
                                external_token: {
                                    token: newToken,
                                    type: "airtime_fixed"
                                },
                                timeline: [
                                    {
                                        status: 'INITIATED',
                                        date: receiverCurrentTime,
                                    }
                                ]
                            };

                            Transaction.create(receiverTransactionObj).then(async (transaction) => {
                                let link = resp1.data.links.find(l => l.rel === 'approval_url');
                                let ciphertext = await encryption({
                                    status: "true",
                                    message: "Transaction initiated successfully.",
                                    currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
                                    transaction_id: transaction._id,
                                    transaction_ref: transaction.reference_id,
                                    url: link ? link.href : ''
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
                            let ciphertext = await encryption({
                                status: "false",
                                message: "Transaction failed.",
                                error: err
                            })
                            res.status(400).send(ciphertext);
                        }
                    }).catch(async (err) => {
                        console.log(err?.response?.data?.details || err);
                        let ciphertext = await encryption({
                            status: "false",
                            message: "Transaction failed.",
                            error: err
                        })
                        res.status(400).send(ciphertext);
                    })
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

// E-Sim
module.exports.initiateEsimPaypalTransaction = async (req, res) => {
    try {
        console.log("bodyininitiateairtimefixedpayapl", req.body)
        let data = req.body
        let {
            number,
            email,
            token,
            wallet_id,
        } = data;

        let decoded;
        try {
            decoded = jwt.verify(token, secretKey);
        } catch (err) {
            console.log(err)
            let error = await encryption({
                status: false,
                message: "Invalid token."
            });
            return res.status(400).send(error);
        }

        console.log({ decoded })

        const wallet = await Wallet.findOne({
            $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])

        let ref = 'tr_' + Date.now().toString();

        let featureChecked = await featureCheck('topup_channel', 'paypal', wallet.account.level);
        if (featureChecked) {

            const paypalDetails = decoded.converted.paypal
            let paypalAmount = paypalDetails.paypal_currency_supported ? decoded.converted.total.value : paypalDetails.paypal_converted.value
            let paypalCurrency = !paypalDetails.paypal_currency_supported ? "USD" : wallet.currency.code
            console.log(paypalDetails, "testing")

            let amountInUSD = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(wallet.currency.code, 'USD', decoded.converted.total.value - paypalDetails.fee.value));
            let amountInUSDTotal = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(wallet.currency.code, 'USD', decoded.converted.total.value));

            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), wallet.account)
            let limitChecked = limitCheck(parseFloat(amountInUSDTotal), wallet.account.level, wallet.account, 'topup')

            if (limitChecked.status && balanceLimitChecked) {
                let api = `${paypalUrl}/oauth2/token`;
                let obj = {
                    url: api,
                    method: 'post',
                    data: 'grant_type=client_credentials',
                    auth: {
                        username: process.env.PAYPAL_CLIENT_ID,
                        password: process.env.PAYPAL_SECRET
                    }
                }
                axios(obj).then(async (resp) => {
                    let paymentApi = `${paypalUrl}/payments/payment`;
                    const cnfg = {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + resp.data.access_token,
                        },
                    }
                    let paymentObj = {
                        "intent": "sale",
                        "payer": {
                            "payment_method": "paypal"
                        },
                        "transactions": [
                            {
                                "amount": {
                                    "total": formatDecimalNumbersWithLimit(paypalAmount, 2)?.toFixed(2),
                                    "currency": paypalCurrency
                                },
                                "description": wallet?.account?.username,
                                "custom": wallet.wallet_id,
                                "item_list": {
                                    "shipping_address": {
                                        "recipient_name": `${wallet?.account?.first_name} ${wallet?.account?.last_name}`,
                                        "line1": `${wallet?.account?.address || wallet?.account?.country_iso_code}`,
                                        "city": `${wallet?.account?.city || ""}`,
                                        "country_code": `${iso2Countries[wallet?.account?.country_iso_code] || "CH"}`,
                                        "postal_code": `${wallet?.account?.postal_code || ""}`,
                                        "phone": `${wallet?.account?.phone || ""}`,
                                    }
                                }
                            }
                        ],
                        "redirect_urls": {
                            "return_url": `https://my.insta-pay.ch/add-funds/success/null?transaction_id=${ref}`,
                            "cancel_url": `https://my.insta-pay.ch/add-funds/error/null?transaction_id=${ref}`
                        }
                    }
                    console.log(paymentObj, 'paymentObj', paymentObj.transactions[0].amount, 'amount', paymentObj.transactions[0].item_list, 'total');
                    axios.post(paymentApi, paymentObj, cnfg).then(async (resp1) => {
                        if (resp1.data.state === 'created') {
                            const receiverTimezone = wallet.account?.timezone || "UTC"
                            const receiverCurrentTime = moment().tz(receiverTimezone).format();

                            const payload = {
                                ...decoded,
                                wallet_id,
                                number,
                                email
                            }

                            const newToken = jwt.sign(payload, secretKeyIntl);

                            let receiverTransactionObj = {
                                reference_id: ref,
                                type: 'instant',
                                transaction_type: 'credit',
                                service_type: 'topup',
                                payment_type: 'paypal',
                                status: 'INITIATED',
                                purpose: '',
                                payment_id: resp1.data.id,
                                description: 'Topup by Paypal',
                                currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
                                replacement_currency: { code: paypalCurrency, value: formatDecimalNumbersWithLimit(paypalAmount, 2)?.toFixed(2), rate: paypalDetails.paypal_rate.value },
                                amount: decoded.converted.total.value - paypalDetails.fee.value,
                                fee: paypalDetails.fee.value,
                                total: decoded.converted.total.value,
                                wallet_id: wallet.wallet_id,
                                wallet: wallet._id,
                                account: wallet.account._id,
                                receiver: wallet.account._id,
                                current_balance: wallet.balance.available,
                                hidden: true,
                                external_token: {
                                    token: newToken,
                                    type: "esim"
                                },
                                timeline: [
                                    {
                                        status: 'INITIATED',
                                        date: receiverCurrentTime,
                                    }
                                ]
                            };

                            Transaction.create(receiverTransactionObj).then(async (transaction) => {
                                let link = resp1.data.links.find(l => l.rel === 'approval_url');
                                let ciphertext = await encryption({
                                    status: "true",
                                    message: "Transaction initiated successfully.",
                                    currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
                                    transaction_id: transaction._id,
                                    transaction_ref: transaction.reference_id,
                                    url: link ? link.href : ''
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
                            let ciphertext = await encryption({
                                status: "false",
                                message: "Transaction failed.",
                                error: err
                            })
                            res.status(400).send(ciphertext);
                        }
                    }).catch(async (err) => {
                        console.log(err?.response?.data?.details || err);
                        let ciphertext = await encryption({
                            status: "false",
                            message: "Transaction failed.",
                            error: err
                        })
                        res.status(400).send(ciphertext);
                    })
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

// BOT Notifications
module.exports.sendBotNotification = async (req, res) => {
    const data = await decryption(req.body.data);
    const { referenceId, flow, method } = data;

    try {
        const transaction = await Transaction.findOne({ reference_id: referenceId })
            .populate([{ path: 'account', populate: 'insta_recipient_id' }, { path: 'wallet' }]);

        if (!transaction) {
            const encryptedResponse = await encryption({
                status: false,
                message: 'Transaction not found'
            });
            return res.status(404).send(encryptedResponse);
        }

        // notification already sent
        if (!transaction?.notificationNotSent) {
            const encryptedResponse = await encryption({
                status: false,
                message: 'Notification already sent'
            });
            return res.status(400).send(encryptedResponse);
        }

        const selectedLanguage = transaction?.account?.insta_recipient_id.active_language || transaction?.account?.language || 'en';
        const senderTimezone = transaction.account?.timezone || "UTC";
        const transactionDateTime = moment(transaction.createdAt).tz(senderTimezone).format('DD-MM-YYYY hh:mm A');

        let title;
        if (flow === "international") {
            title = `Your International transaction has been initiated.`;
        } else if (flow === "airtime") {
            title = `Your Airtime transaction has been initiated.`;
        } else if (flow === "w2w_instant") {
            title = "Your Wallet to Wallet Instant transaction has been initiated.";
        } else if (flow === "w2w_quotation") {
            title = "Your Wallet to Wallet Quotation transaction has been initiated.";
        } else if (flow === "w2w_request") {
            title = "Your Wallet to Wallet Request transaction has been initiated.";
        } else if (flow === "w2w_qr_pay") {
            title = "Your Wallet to Wallet QR Pay transaction has been initiated.";
        } else {
            title = `Your transaction has been initiated.`;
        }

        const subtitle = `
Date & Time: ${transactionDateTime}
Transaction ID: ${referenceId}
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(transaction.total)} ${transaction.wallet.currency.code}
        `;

        const templatePayload = {
            template_type: "generic",
            elements: [
                {
                    title,
                    subtitle,
                    image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                    buttons: [
                        {
                            type: "postback",
                            title: "Main Menu",
                            payload: "main_menu",
                        }
                    ],
                },
            ]
        };
        await sendTemplate({ sender: { id: transaction.account.insta_recipient_id.recipient } }, transaction.account.insta_recipient_id.recipient, templatePayload);

        transaction.notificationNotSent = undefined;
        await transaction.save();

        const encryptedResponse = await encryption({
            status: true,
            message: 'Notification sent successfully.'
        });
        return res.status(200).send(encryptedResponse);

    } catch (error) {
        console.error('Error sending transaction notification:', error);

        const encryptedError = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(encryptedError);
    }
};
module.exports.sendBotNotificationTelegram = async (req, res) => {
    const data = await decryption(req.body.data);
    const { referenceId, flow, method } = data;

    try {
        const transaction = await Transaction.findOne({ reference_id: referenceId })
            .populate(['account', 'wallet']);

        const bot = await TelegramBotModel.findOne({ recipient: transaction?.account?.telegram_id })

        if (!transaction) {
            const encryptedResponse = await encryption({
                status: false,
                message: 'Transaction not found'
            });
            return res.status(404).send(encryptedResponse);
        }

        // notification already sent
        if (!transaction?.notificationNotSent) {
            const encryptedResponse = await encryption({
                status: false,
                message: 'Notification already sent'
            });
            return res.status(400).send(encryptedResponse);
        }

        const selectedLanguage = bot?.selected_language || transaction?.account?.language || 'en';
        const senderTimezone = transaction.account?.timezone || "UTC";
        const transactionDateTime = moment(transaction.createdAt).tz(senderTimezone).format('DD-MM-YYYY hh:mm A');

        let title;
        if (flow === "international") {
            title = `Your International transaction has been initiated.`;
        } else if (flow === "airtime") {
            title = `Your Airtime transaction has been initiated.`;
        } else if (flow === "w2w_instant") {
            title = "Your Wallet to Wallet Instant transaction has been initiated.";
        } else if (flow === "w2w_quotation") {
            title = "Your Wallet to Wallet Quotation transaction has been initiated.";
        } else if (flow === "w2w_request") {
            title = "Your Wallet to Wallet Request transaction has been initiated.";
        } else if (flow === "w2w_qr_pay") {
            title = "Your Wallet to Wallet QR Pay transaction has been initiated.";
        } else if (flow?.includes("vcc_premium")) {
            title = "Your transaction for Premium Card has been initiated.";
        } else if (flow?.includes("vcc_standard")) {
            title = "Your transaction for Standard Card has been initiated.";
        }
        else {
            title = `Your transaction has been initiated.`;
        }

        const subtitle = `
Date & Time: ${transactionDateTime}
Transaction ID: ${referenceId}
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(transaction.total)} ${transaction.wallet.currency.code}
        `;

        const messageText = `${title}\n\n${subtitle}`

        await sendPhoto(bot.recipient, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", messageText, "4")

        transaction.notificationNotSent = undefined;
        await transaction.save();

        const encryptedResponse = await encryption({
            status: true,
            message: 'Notification sent successfully.'
        });
        return res.status(200).send(encryptedResponse);

    } catch (error) {
        console.error('Error sending transaction notification:', error);

        const encryptedError = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(encryptedError);
    }
};

module.exports.initiateIntlPaypalTransactionHelper = async (data, wallet_id, intlToken, botType) => {
    try {
        // return console.log(data)
        const ref = 'tr_' + Date.now().toString();

        console.log({ wallet_id })
        const receiverWallet = await Wallet.findOne({
            $and: [
                { _id: wallet_id },
                { wallet_type: "insta" },
                { status: 'active' },
                {
                    $or: [
                        { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                        { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                        { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                        { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                    ]
                }
            ]
        }).populate([{ path: 'account', populate: ['level'] }]);

        console.log(receiverWallet)

        if (!receiverWallet) {
            return { status: false, message: "Wallet not found." };
        }

        const featureChecked = await featureCheck('topup_channel', 'paypal', receiverWallet.account.level);
        if (!featureChecked) {
            return { status: false, message: "This service is not allowed." };
        }

        console.log({ data })
        const calculations = data.transactionDetails.calculations;
        console.log(calculations.total.value, calculations.paypal.paypal_converted.value, "calculations.paypal.paypal_converted.value")
        const paypalAmount = calculations.paypal.paypal_currency_supported
            ? calculations.total.value
            : calculations.paypal.paypal_converted.value;
        const paypalCurrency = calculations.paypal.paypal_currency_supported
            ? receiverWallet.currency.code
            : "USD";

        console.log(calculations)

        const amountInUSD = formatDecimalNumbersWithLimit(
            await getExchangeRatesToUSD(
                receiverWallet.currency.code,
                'USD',
                calculations.total.value - calculations.paypal.fee.value
            )
        );
        const amountInUSDTotal = formatDecimalNumbersWithLimit(
            await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', calculations.total.value)
        );

        const balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account);
        const limitChecked = limitCheck(parseFloat(amountInUSDTotal), receiverWallet.account.level, receiverWallet.account, 'topup');


        if (!limitChecked.status || !balanceLimitChecked) {
            return {
                status: false,
                message: !limitChecked.status
                    ? "Transaction limit exceeded."
                    : "Balance limit exceeded."
            };
        }

        const api = `${paypalUrl}/oauth2/token`;
        const tokenResponse = await axios.post(api, 'grant_type=client_credentials', {
            auth: {
                username: process.env.PAYPAL_CLIENT_ID,
                password: process.env.PAYPAL_SECRET
            }
        });

        const paymentApi = `${paypalUrl}/payments/payment`;
        const paymentObj = {
            intent: "sale",
            payer: { payment_method: "paypal" },
            transactions: [{
                amount: {
                    total: paypalAmount.toFixed(2),
                    currency: paypalCurrency
                },
                description: receiverWallet.account.username,
                custom: receiverWallet.wallet_id,
                item_list: {
                    shipping_address: {
                        recipient_name: `${receiverWallet.account.first_name} ${receiverWallet.account.last_name}`,
                        line1: receiverWallet.account.address || receiverWallet.account.country_iso_code,
                        city: receiverWallet.account.city || "",
                        country_code: iso2Countries[receiverWallet.account.country_iso_code] || "CH",
                        postal_code: receiverWallet.account.postal_code || "",
                        phone: receiverWallet.account.phone || ""
                    }
                }
            }],
            redirect_urls: {
                return_url: `https://my.insta-pay.ch/chatbot/paypal-transaction/success/${ref}?flow=international`,
                cancel_url: `https://my.insta-pay.ch/chatbot/paypal-transaction/failed/${ref}?flow=international`
            }
        };

        const resp1 = await axios.post(paymentApi, paymentObj, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + tokenResponse.data.access_token
            }
        });

        if (resp1.data.state !== 'created') {
            return { status: false, message: "Transaction failed during PayPal processing." };
        }

        const transaction = await Transaction.create({
            reference_id: ref,
            type: 'instant',
            transaction_type: 'credit',
            service_type: 'topup',
            payment_type: 'paypal',
            status: 'INITIATED',
            description: 'Topup by Paypal',
            payment_id: resp1.data.id,
            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
            replacement_currency: { code: paypalCurrency, value: paypalAmount.toFixed(2), rate: calculations.paypal.paypal_rate.value },
            amount: calculations.total.value - calculations.paypal.fee.value,
            fee: calculations.paypal.fee.value,
            total: calculations.total.value,
            wallet_id: receiverWallet.wallet_id,
            wallet: receiverWallet._id,
            account: receiverWallet.account._id,
            receiver: receiverWallet.account._id,
            current_balance: receiverWallet.balance.available,
            hidden: true,
            external_token: { token: intlToken, type: `international_bot${botType ? `_${botType}` : ``}` },
            notificationNotSent: true,
            timeline: [{ status: 'INITIATED', date: moment().tz(receiverWallet.account.timezone || "UTC").format() }]
        });

        const link = resp1.data.links.find(l => l.rel === 'approval_url');
        return {
            status: true,
            message: "Transaction initiated successfully.",
            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
            transaction_id: transaction._id,
            transaction_ref: transaction.reference_id,
            url: link ? link.href : ''
        };

    } catch (err) {
        console.error(err);
        return { status: false, message: "Internal server error!", error: err };
    }
};

