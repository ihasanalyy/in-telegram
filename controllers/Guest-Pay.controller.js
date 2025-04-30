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
const { limitCheck, featureCheck, balanceLimitCheck, getExchangeRatesToUSD, cardCountryValidation, logError, sendSMSTemplate } = require('../utils/helpers');
const moment = require('moment-timezone');
const e = require('cors');
// const { encryption, decryption } = require('../configurations/Encryption');
const paypalUrl = process.env.PAYPAL_URL
const iso2Countries = require("../utils/countries_iso2.json");
const { formatDecimalNumbersWithLimit } = require('../utils/payerRates');
const { topUpFeeCalculation, generatePayload } = require('./Trust-Payment.controller');
const secretKey = process.env.jwtKey;
const supportedCurrencies = require("../utils/paypalSupportedCurrencies.json")
const { formattedAmount } = require('../utils/InstaChatbotHelpers');


module.exports.getAvailableMethods = async (req, res) => {
    try {
        const level_id = req.params.level_id

        if (!level_id) {
            let error = await encryption({
                status: false,
                message: "Account level ID is required!",
            });
            return res.status(400).send(error);
        }

        const accountLevel = await AccountLevel.findById(level_id)

        if (!accountLevel) {
            let error = await encryption({
                status: false,
                message: "Account level not found!",
            });
            return res.status(400).send(error);
        }

        const availableChannels = accountLevel.topup_channel

        const activeMethods = Object.keys(availableChannels).filter((method) => availableChannels[method] === true)

        let response = await encryption({
            status: true,
            message: "Available methods!",
            data: activeMethods
        });
        return res.status(200).send(response);

    } catch (error) {
        console.error('error:', error.response?.data || error.message);
        res.status(500).json({
            status: false,
            message: 'Failed to fetch payment methods',
            error: error.response?.data || error.message
        });
    }
}

// PAYPAL
module.exports.getPaypalFee = async (req, res) => {
    try {
        const wallet_id = req.params.wallet_id;
        const amount = parseFloat(req.params.amount)
        let wallet = await Wallet.findOne({
            $and: [{ wallet_id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
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
        let paymentAddressFee = await topUpFeeCalculation(wallet, amount, 'payment_address')

        let amountInUSD = formatDecimalNumbersWithLimit(amount + feeDetails);
        let rate = 1;

        // If the wallet currency is not supported by PayPal, convert to USD
        if (!supportedCurrencies.includes(wallet.currency.code)) {
            // Convert amount and fee separately
            const convertedAmount = await getExchangeRatesToUSD(wallet.currency.code, "USD", amount);
            const convertedFee = await getExchangeRatesToUSD(wallet.currency.code, "USD", feeDetails);

            // Sum the converted values
            amountInUSD = formatDecimalNumbersWithLimit(convertedAmount + convertedFee);
            rate = await getExchangeRatesToUSD(wallet.currency.code, "USD", 1);
        }

        const payload = {
            wallet_id: wallet_id,
            amount: formatDecimalNumbersWithLimit(amount, 2),
            fee: feeDetails,
            converted_amount: formatDecimalNumbersWithLimit(amountInUSD, 2),
            original_currency: wallet.currency.code,
            converted_currency: "USD",
            rate: rate,
            totalAmount: formatDecimalNumbersWithLimit(amount + feeDetails, 2),
            paymentAddressFee
        };

        const token = jwt.sign(payload, secretKey, { expiresIn: '10m' });

        // Encrypting response data
        const ciphertext = await encryption({
            status: true,
            message: "Fee fetched successfully!",
            data: {
                fee: feeDetails,
                converted_amount: formatDecimalNumbersWithLimit(amountInUSD),
                total_amount: formatDecimalNumbersWithLimit(amount + feeDetails),
                converted_currency: "USD",
                rate,
                original_currency: wallet.currency.code,
                token,
                recipient_amount: formatDecimalNumbersWithLimit(amount - paymentAddressFee),
                paymentAddressFee
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

module.exports.initiatPaypalTransaction = async (req, res) => {
    try {
        // const data = req.body
        const data = await decryption(req.body.data)
        const { token, name, email, phone } = data;

        if (!token || !name || !phone) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        let decodedToken;
        try {
            decodedToken = jwt.verify(token, secretKey)
        } catch (err) {
            console.log(err)
            let errorMessage = await encryption({
                status: false,
                message: "Invalid or expired token!"
            });
            return res.status(400).send(errorMessage);
        }

        let { wallet_id, amount } = decodedToken;
        let ref = 'tr_' + Date.now().toString();

        let receiverWallet = await Wallet.findOne({
            $and: [
                { wallet_id: wallet_id },
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

        let feeDetails = await topUpFeeCalculation(receiverWallet, amount, 'topup_paypal');

        let totalAmount = formatDecimalNumbersWithLimit(amount + feeDetails);

        console.log({ decodedFee: decodedToken.fee, decodedTotal: decodedToken.totalAmount, feeDetails, totalAmount })
        // Compare fee and total from token with the new calculated values
        if (decodedToken.fee !== feeDetails || decodedToken.totalAmount !== totalAmount) {
            let error = await encryption({
                status: false,
                message: "Fee or total amount has been updated. Please try again with the new values."
            });
            return res.status(400).send(error);
        }

        let featureChecked = await featureCheck('topup_channel', 'paypal', receiverWallet.account.level);
        if (featureChecked && feeDetails >= 0) {

            let currencyCode = receiverWallet.currency.code;
            let finalAmount = formatDecimalNumbersWithLimit(amount + feeDetails);
            let exchangeRate = 1;

            // if currency not supported by paypal
            if (!supportedCurrencies.includes(currencyCode)) {
                currencyCode = 'USD';

                const convertedAmount = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount);
                const convertedFee = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', feeDetails);

                finalAmount = formatDecimalNumbersWithLimit(convertedAmount + convertedFee);
                exchangeRate = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', 1);
            }

            console.log({ finalAmount })

            let amountInUSD = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', totalAmount)
            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account)
            let limitChecked = limitCheck(parseFloat(amountInUSD), receiverWallet.account.level, receiverWallet.account, 'topup')
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
                            "return_url": `https://my.insta-pay.ch/pay/${receiverWallet?.account?.username}/success?transaction_id=${ref}`,
                            "cancel_url": `https://my.insta-pay.ch/pay/${receiverWallet?.account?.username}/error?transaction_id=${ref}`
                        }
                    }
                    console.log(paymentObj, 'paymentObj', paymentObj.transactions[0].amount, 'amount', paymentObj.transactions[0].item_list, 'total');
                    axios.post(paymentApi, paymentObj, cnfg).then(async (resp1) => {
                        if (resp1.data.state === 'created') {
                            const receiverTimezone = receiverWallet.account?.timezone || "UTC"
                            const receiverCurrentTime = moment().tz(receiverTimezone).format();
                            let paymentAddressFee = await topUpFeeCalculation(receiverWallet, amount, 'payment_address')

                            let receiverTransactionObj = {
                                reference_id: ref,
                                type: 'instant',
                                transaction_type: 'credit',
                                service_type: 'payment_address',
                                payment_type: 'paypal',
                                status: 'INITIATED',
                                purpose: '',
                                payment_id: resp1.data.id,
                                description: 'Guest Payment',
                                currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                                replacement_currency: { code: currencyCode, value: finalAmount, rate: exchangeRate },
                                amount: formatDecimalNumbersWithLimit(amount - paymentAddressFee, 2),
                                fee: paymentAddressFee,
                                total: amount,
                                wallet_id: receiverWallet.wallet_id,
                                wallet: receiverWallet._id,
                                account: receiverWallet.account._id,
                                receiver: receiverWallet.account._id,
                                current_balance: receiverWallet.balance.available,
                                hidden: true,
                                guest_details: {
                                    name,
                                    email: email || "",
                                    phone,
                                },
                                external_token: {
                                    token: undefined,
                                    type: "guest_pay"
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

// TRUST PAYMENT - CARD
module.exports.getCardFee = async (req, res) => {
    try {
        let wallet_id = req.params.wallet_id;
        let amount = parseFloat(req.params.amount);
        let wallet = await Wallet.findOne({
            $and: [{ wallet_id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])
        let feeDetails = await Fee.findOne({ $and: [{ service_name: 'topup_card_payment' }, { account_level: wallet.account.level._id }] })
        let paymentAddressFee = await topUpFeeCalculation(wallet, amount, 'payment_address')

        // console.log(wallet.account._id, req.user._id);
        if (!wallet || !feeDetails) {
            let error = await encryption({
                status: false,
                message: "Required information is not correct."
            });
            return res.status(404).send(error);
        }

        const payload = {
            amount: parseFloat(amount * 100),
            wallet_id
        }

        const token = jwt.sign(payload, secretKey, { expiresIn: '10m' });

        if (wallet.currency.code.toLowerCase() == 'usd') {
            let fee = feeDetails.flat_fee;
            if (feeDetails.fee_type == 'percentage') {
                fee = amount * (feeDetails.percentage_fee / 100);
            }
            let ciphertext = await encryption({
                status: "true",
                message: "Topup Fee.",
                feeDetails: formatDecimalNumbersWithLimit(fee, 2),
                total: formatDecimalNumbersWithLimit(amount + fee, 2),
                recipient_amount: formatDecimalNumbersWithLimit(amount - paymentAddressFee),
                paymentAddressFee,
                token
            })
            res.status(200).send(ciphertext);
        } else {
            if (feeDetails.fee_type == 'flat') {
                let fee = await getExchangeRatesToUSD('USD', wallet.currency.code, feeDetails.flat_fee)
                let ciphertext = await encryption({
                    status: "true",
                    message: "Topup Fee.",
                    total: formatDecimalNumbersWithLimit(amount + fee, 2),
                    feeDetails: formatDecimalNumbersWithLimit(fee, 2),
                    recipient_amount: formatDecimalNumbersWithLimit(amount - paymentAddressFee),
                    paymentAddressFee,
                    token
                })
                res.status(200).send(ciphertext);
            } else {
                let fee = amount * (feeDetails.percentage_fee / 100);
                let ciphertext = await encryption({
                    status: "true",
                    message: "Topup Fee.",
                    total: formatDecimalNumbersWithLimit(amount + fee, 2),
                    feeDetails: formatDecimalNumbersWithLimit(fee, 2),
                    recipient_amount: formatDecimalNumbersWithLimit(amount - paymentAddressFee),
                    paymentAddressFee,
                    token
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
module.exports.initiatTrustPaymentTransaction = async (req, res) => {
    try {
        // let data = req.body
        let data = await decryption(req.body.data)
        const { token, name, email, phone, se_shambey, iso_code, dob } = data;

        if (!token || !name || !phone || !se_shambey || !iso_code) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        let decoded;
        try {
            decoded = jwt.verify(token, secretKey);
        } catch (err) {
            console.log(err)
            return res.status(400).send(await encryption({ status: false, message: "Invalid token or token expired!" }));
        }

        const wallet_id = decoded.wallet_id;
        const amount = parseInt(decoded.amount);

        let decodedCardToken;
        try {
            decodedCardToken = jwt.verify(se_shambey, process.env.FRONTEND_KEY);
        } catch (err) {
            console.log(err)
            const error = await encryption({
                status: false,
                message: "Invalid token."
            });
            return res.status(400).send(error);
        }

        let decodedRevesredString = decodedCardToken.gurhaku;
        let originalPan = decodedRevesredString.split(":").reverse().join(":");
        let [pan, securitycode, expiry_month, expiry_year] = originalPan.split(":");

        console.log({ pan, securitycode, expiry_month, expiry_year })

        let ref = 'tr_' + Date.now().toString();

        if (!wallet_id || !amount) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing."
            });
            return res.status(404).send(error);
        }

        let receiverWallet = await Wallet.findOne({
            $and: [{ wallet_id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])

        // checking card authentication
        const cardDetails = await cardCountryValidation(pan, iso_code)

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
        let paymentAddressFee = await topUpFeeCalculation(receiverWallet, amount / 100, 'payment_address')
        //  await Fee.findOne({ $and: [{ service_name: 'topup_card_payment' }, { account_level: receiverWallet.account.level._id }] })
        let featureChecked = await featureCheck('topup_channel', 'card_payment', receiverWallet.account.level)
        // console.log(featureChecked, feeDetails, receiverWallet.account.level);
        if (featureChecked && feeDetails >= 0) {
            let amountInUSD = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount / 100)
            // console.log(amountInUSD);
            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account)
            let limitChecked = await limitCheck(parseFloat(amountInUSD), receiverWallet.account.level, receiverWallet.account, 'topup')
            // console.log(balanceLimitChecked);
            if (limitChecked.status && balanceLimitChecked) {

                const receiverTimezone = receiverWallet.account?.timezone || "UTC"
                const receiverCurrentTime = moment().tz(receiverTimezone).format();

                let receiverTransactionObj = {
                    reference_id: ref,
                    type: 'instant',
                    transaction_type: 'credit',
                    service_type: 'payment_address',
                    payment_type: 'card',
                    status: 'INITIATED',
                    purpose: '',
                    description: 'Guest Payment',
                    currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                    amount: (amount / 100) - paymentAddressFee,
                    is_card_save: false,
                    fee: paymentAddressFee,
                    total: amount / 100,
                    wallet_id: receiverWallet.wallet_id,
                    wallet: receiverWallet._id,
                    account: receiverWallet.account._id,
                    receiver: receiverWallet.account._id,
                    current_balance: receiverWallet.balance.available,
                    hidden: true,
                    guest_details: {
                        name,
                        email: email || "",
                        phone,
                    },
                    timeline: [
                        {
                            status: 'INITIATED',
                            date: receiverCurrentTime,
                        }
                    ]
                }

                Transaction.create(receiverTransactionObj).then(async (transaction) => {
                    let iat = Math.floor(Date.now() / 1000);
                    const payload = generatePayload(amount / 100, receiverWallet, { pan, securitycode, expirydate: `${expiry_month}/${expiry_year}` }, transaction, iat, false, false, false, dob);
                    const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
                    const trustPaymentToken = jwt.sign(payload, secretKey, { header: { "alg": "HS256", "typ": "JWT" } });
                    let ciphertext = await encryption({
                        status: "true",
                        message: "Transaction initiated successfully.",
                        transaction_ref: transaction.reference_id,
                        token,
                        trustPaymentToken
                    })
                    return res.status(200).send(ciphertext);
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

module.exports.trustPaymentConfirmation = async (req, res) => {
    let transaction_id = req.params.transaction_id;
    let transactionDetails = await Transaction.findOne({ $and: [{ reference_id: transaction_id }, { service_type: 'payment_address' }, { status: 'INITIATED' }] }).populate("account")
    console.log(transactionDetails, "transactionDetails");
    if (!transactionDetails) {
        await logError(
            "Transaction not found",
            "guestpay_trust_payment",
            null,
            transactionDetails?._id,
            { routeParams: req.params }
        )
        return res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed?code=null`)
    }
    try {
        console.log("trustPaymentConfirmation guest webhook", req.body);
        // var { token, wallet_id } = data
        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])
        // console.log(receiverWallet, "receiverWallet");
        if (!receiverWallet) {
            await logError(
                "Receiver wallet not found or inactive",
                "guestpay_trust_payment",
                receiverWallet?.account?._id,
                transactionDetails?._id,
            );
            return res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed?code=null`)
        }

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "guestpay_trust_payment",
                receiverWallet?.account?._id,
                transactionDetails?._id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            return res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed?code=${req.body.errorcode}`);
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        jwt.verify(token, secretKey, async function (err, data) {
            if (err) {
                await logError(
                    "JWT verification error",
                    "guestpay_trust_payment",
                    receiverWallet?.account?._id,
                    transactionDetails?._id,
                    { jwtError: err }
                );
                console.log(err, "err in jwt");
                transactionDetails.timeline.push({
                    status: 'PENDING',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'PENDING'
                await transactionDetails.save();
                return res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed?code=null`);
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
                        let amount = parseInt(innerToken.payload.mainamount)
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
                                    transactionDetails.hidden = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        await sendSMSTemplate(transactionDetails?.account?.phone, `${formattedAmount(transactionDetails.amount) || "N/A"} ${transactionDetails?.currency?.code || "N/A"} received from ${transactionDetails?.guest_details?.name || "N/A"} in Wallet ID ${transactionDetails?.wallet_id}`)
                                        res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/success`)
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error",
                                            "guestpay_trust_payment",
                                            receiverWallet?.account?._id,
                                            transactionDetails?._id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'PENDING',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'PENDING'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed?code=${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed",
                                        "guestpay_trust_payment",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'PENDING',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'PENDING'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed?code=${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance: ${err.message}`,
                                    "guestpay_trust_payment",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                )
                                transactionDetails.timeline.push({
                                    status: 'PENDING',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'PENDING'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed?code=${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error`,
                                "guestpay_trust_payment",
                                receiverWallet?.account?._id,
                                transactionDetails?._id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed?code=${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0"`,
                            "guestpay_trust_payment",
                            receiverWallet?.account?._id,
                            transactionDetails?._id,
                            { value: data.payload.response[1].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed?code=${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                        "guestpay_trust_payment",
                        receiverWallet?.account?._id,
                        transactionDetails?._id,
                        value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed?code=${errorCode}`)
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
                        let amount = parseInt(innerToken.payload.mainamount)
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
                                    transactionDetails.hidden = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        await sendSMSTemplate(transactionDetails?.account?.phone, `${formattedAmount(transactionDetails.amount) || "N/A"} ${transactionDetails?.currency?.code || "N/A"} received from ${transactionDetails?.guest_details?.name || "N/A"} in Wallet ID ${transactionDetails?.wallet_id}`)
                                        res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/success`)
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error 2",
                                            "guestpay_trust_payment",
                                            receiverWallet?.account?._id,
                                            transactionDetails?._id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'PENDING',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'PENDING'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed?code=${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed 2",
                                        "guestpay_trust_payment",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'PENDING',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'PENDING'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed?code=${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance 2: ${err.message}`,
                                    "guestpay_trust_payment",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'PENDING',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'PENDING'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed?code=${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error 2`,
                                "guestpay_trust_payment",
                                receiverWallet?.account?._id,
                                transactionDetails?._id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed?code=${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2`,
                            "guestpay_trust_payment",
                            receiverWallet?.account?._id,
                            transactionDetails?._id,
                            { value: data.payload.response[0].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed?code=${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                        "guestpay_trust_payment",
                        receiverWallet?.account?._id,
                        transactionDetails?._id,
                        { value: data.payload.response[0].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed?code=${errorCode}`)
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2`,
                    "guestpay_trust_payment",
                    receiverWallet?.account?._id,
                    transactionDetails?._id,
                    { value: data.payload.response.length }
                );
                let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                await transactionDetails.save();
                res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed?code=${errorCode}`)
            }
        })
    } catch (err) {
        console.log(err, "err in tpayment guest")
        await logError(
            err,
            "guestpay_trust_payment",
            null,
            req.params?.transaction_id || null,
        );
        // let transactionUpdt = await Transaction.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect(`https://my.insta-pay.ch/pay/${transactionDetails?.account?.username}/failed?code=null`)
    }

}