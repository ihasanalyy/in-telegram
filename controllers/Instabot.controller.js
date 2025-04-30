const axios = require('axios');
const CryptoJS = require("crypto-js");
const SecurityQuestion = require('../models/Security-Question.model')
const Account = require('../models/Account.model')
const User = require('../models/User.model')
const Company = require('../models/Company.model')
const Fee = require('../models/Fee.model');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Wallet = require('../models/Wallet.model');
const Transaction = require('../models/Transaction.model');
const RequestPayment = require('../models/Request-Payment.model');
const { encryption, decryption } = require('../configurations/Encryption');
require("dotenv").config();
const moment = require('moment');
const Beneficiary = require('../models/Beneficiary.model');
const isoCountries = require('i18n-iso-countries');
isoCountries.registerLocale(require("i18n-iso-countries/langs/en.json"));
const lang = require('../utils/languages/languages.json');
const shortid = require('shortid');
const countryData = require('country-data');
const stringSimilarity = require('string-similarity');
const InstaChatbotModel = require('../models/InstaChatbot.model');
const TelegramBotModel = require('../models/TelegramBot.model');
const { sendTemplate, quickMessage, mainMenuMessage, quickReply } = require('../utils/instaChatbotUtils');
const { sendButtons, sendPhoto, mainMenuKeyboardMessage, registerMenuKeyboardMessage } = require('../utils/telegramBotUtils');
const { getActiveWallet } = require('../utils/helpers');


const Thunes_KEY = process.env.APIKEY;
const Thunes_SECRET = process.env.APISECRET;

//jwt token key 
const secretKey = process.env.jwtKey;


const apiKey = process.env.APIKEY;
const baseUrl = 'https://kemitkingdom.sb.getid.dev/api/v1/tokenized-url';


module.exports.encryptBody = async (req, res) => {
    try {
        let body = await encryption(req.body)
        res.status(200).send(body)
    } catch (err) {
        console.log(err);
        res.status(500).send({
            message: "Internal server error!",
            status: "false"
        })
    }
}

module.exports.decryptBody = async (req, res) => {
    try {
        let body = await decryption(req.body.data)
        res.status(200).send(body)
    } catch (err) {
        console.log(err);
        res.status(500).send({
            message: "Internal server error!",
            status: "false"
        })
    }
}

module.exports.manyChatMessage = async (req, res) => {
    res.status(200).send({ success: true })
    var { subscriber_id, fieldBody, flow } = req.body;
    manyChatMessage(subscriber_id, fieldBody, flow, 1)
}

module.exports.verifyInstaChatbotLinkCode = async (req, res) => {
    try {

        // if (req.user._id != account_id) {
        //     let error = {
        //         message: "Unauthorized user.",
        //         status: "false",
        //     })
        //     return res.status(401).send(error)
        // }
        let data = req.body
        var { insta_username, subscriber_id, code } = data;
        let username = code.split(':')[0]
        // console.log(username);
        Account.findOne({ $and: [{ username: username.toLowerCase() }, { active: true }] }, { insta_bot: true, username: true, instaBotToken: true, account_type: true, user: true, company: true, level: true }).populate([{
            path: 'user',
            select: 'first_name last_name'
        }, {
            path: 'company',
            select: 'company_name'
        }]).then(async (user) => {
            if (user && user?.instaBotToken) {
                if (!user.insta_bot) {
                    console.log(user.instaBotToken);
                    jwt.verify(user.instaBotToken, process.env.INSTA_CHATBOT_LINK_KEY, async function (err, token_data) {
                        if (err) {
                            res.status(403).send({
                                status: "false",
                                message: "Invalid code."
                            })
                        } else {
                            if (code == token_data.link_code && user._id == token_data.account_id) {
                                let updt = await Account.updateOne({ _id: user._id }, { $set: { insta_username: insta_username, insta_subscriber_id: subscriber_id, insta_bot: true } })
                                if (user.account_type == 'individual') {
                                    res.status(200).send({
                                        status: "true",
                                        account_id: user._id,
                                        username,
                                        account_typea: user.account_type,
                                        first_name: user.user.first_name,
                                        last_name: user.user.last_name,
                                        level: user.level
                                    });
                                } else if (user.account_type == 'business') {
                                    res.status(200).send({
                                        success: true,
                                        account_id: user._id,
                                        username,
                                        account_type,
                                        company_name: user.user.company_name,
                                        level: user.level
                                    });
                                }
                            } else {
                                res.status(403).send({
                                    status: "false",
                                    message: "Invalid code."
                                })
                            }
                        }
                    });
                } else {
                    res.status(404).send({
                        status: "false",
                        message: "Account already linked"
                    })
                }
            } else {
                res.status(404).send({
                    status: "false",
                    message: "Account not found"
                })
            }
        }).catch(async (err) => {
            console.log(err);
            res.status(400).send({
                message: "An error occurred while searching for username!",
                status: "false"
            })
        })
    } catch (err) {
        console.log(err);
        res.status(500).send({
            message: "Internal server error!",
            status: "false"
        })
    }
}

module.exports.unlinkIntagramBot = async (req, res) => {
    try {
        let account_id = req.params.account_id;

        const user = await Account.findOne({ _id: account_id });

        if (user && user?.instaBotToken && user?.insta_subscriber_id) {

            await InstaChatbotModel.updateOne({ recipient: user.insta_subscriber_id }, { $set: { instabot_connected: false, last_message: "0" } });
            await Account.updateOne({ _id: user._id }, { $set: { insta_username: '', insta_subscriber_id: '', insta_bot: false, insta_recipient_id: null, } });

            res.status(200).send({
                status: "true",
                message: "Account Unlinked."
            });
        } else {
            res.status(404).send({
                status: "false",
                message: "Account not found or bot not connected!"
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send({
            message: "Internal server error!",
            status: "false"
        });
    }
};

module.exports.unlinkTelegramBot = async (req, res) => {
    try {
        let account_id = req.params.account_id;

        const user = await Account.findOne({ _id: account_id });

        if (user && user?.telegramBotToken && user?.telegram_id) {
            const chatId = user.telegram_id;

            const telegramBot = await TelegramBotModel.updateOne({ recipient: user.telegram_id }, { $set: { account_connected: false, last_message: "connect" } });
            await Account.updateOne({ _id: user._id }, { $set: { telegram_bot: false, telegram_id: null, } });

            const selectedLanguage = telegramBot?.selectedLanguage ? user?.language : "en";

            // trigger telegram notification
            await registerMenuKeyboardMessage(chatId, selectedLanguage, `Your account has been unlinked from Telegram InstaPay Bot.`);

            res.status(200).send({
                status: "true",
                message: "Account Unlinked."
            });
        } else {
            res.status(404).send({
                status: "false",
                message: "Account not found or bot not connected!"
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).send({
            message: "Internal server error!",
            status: "false"
        });
    }
};


module.exports.getUsersInstaWalletOverview = async (req, res) => {
    try {

        var account_id = req.params.account_id;
        Wallet.find({ $and: [{ account: account_id }, { status: 'active' }, { wallet_type: 'insta' }] }).populate([{
            path: 'account',
            select: 'active',
        }]).then(async (walletList) => {

            if (walletList.length) {
                if (walletList[0]?.account.active) {
                    let msg = '';
                    walletList.map((wl, i) => {
                        if (wl.currency.code.toLowerCase() == 'usd') { msg = msg + '🇺🇸 Wallet Currency: ' }
                        if (wl.currency.code.toLowerCase() == 'gbp') { msg = msg + '🇬🇧 Wallet Currency: ' }
                        if (wl.currency.code.toLowerCase() == 'eur') { msg = msg + '🇪🇺 Wallet Currency: ' }
                        msg = msg + wl.currency.code + '\n';
                        msg = msg + '💳 Wallet ID: ' + wl.wallet_id + '\n';
                        msg = msg + '💰 Wallet Balance: ' + wl.currency.symbol + wl.balance.available.toFixed(2).toString() + '\n\n';
                        if (i < walletList.length - 1) {
                            msg = msg + '------------------------\n\n'
                        }
                    })
                    let ciphertext = {
                        status: "true",
                        message: msg
                    }
                    res.status(200).send(ciphertext)
                } else {
                    let error = {
                        status: "false",
                        message: "Account not active!"
                    }
                    res.status(404).send(error)
                }
            } else {
                let error = {
                    status: "false",
                    message: "No Wallet found!"
                }
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = {
                status: "false",
                message: "Something went wrong while getting wallet details!"
            }
            res.status(400).send(error)
        })
    } catch (err) {
        console.log(err);
        let error = {
            status: "false",
            message: "Internal server error!"
        }
        res.status(500).send(error)
    }
}

module.exports.getWalletDetails = async (req, res) => {
    try {

        var { account_id, currency } = req.body;
        Wallet.findOne({ $and: [{ account: account_id }, { "currency.code": currency.toUpperCase() }, { status: 'active' }] }).populate([{
            path: 'account',
            select: 'user',
            populate: ([{ path: 'user', select: 'first_name last_name' }])
        }]).then(async (walletInfo) => {
            let walletDetails = JSON.parse(JSON.stringify(walletInfo));
            walletDetails['first_name'] = walletInfo?.account?.user?.first_name
            walletDetails['last_name'] = walletInfo?.account?.user?.last_name
            walletDetails['balance']['available'] = parseFloat(walletDetails.balance.available.toFixed(2))
            await delete walletDetails['account'];
            if (walletDetails) {
                let ciphertext = {
                    status: "true",
                    message: "Wallet Details!",
                    walletDetails
                }
                res.status(200).send(ciphertext)
            } else {
                let error = {
                    status: "false",
                    message: "Wallet not found!"
                }
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = {
                status: "false",
                message: "Something went wrong while getting wallet details!"
            }
            res.status(400).send(error)
        })
    } catch (err) {
        console.log(err);
        let error = {
            status: "false",
            message: "Internal server error!"
        }
        res.status(500).send(error)
    }
}

module.exports.getWalletByWalletId = async (req, res) => {
    try {
        let wallet_id = req.params.wallet_id;
        Wallet.findOne({ $and: [{ wallet_id: wallet_id }, { status: 'active' }] }, { balance: false }).populate([{
            path: 'account',
            select: 'user',
            populate: ([
                { path: 'user', select: 'first_name last_name' },
                { path: 'company', select: 'company_name' },
            ])
        }]).then(async (walletInfo) => {

            let walletDetails = JSON.parse(JSON.stringify(walletInfo));
            walletDetails['first_name'] = walletInfo.account.user?.first_name
            walletDetails['last_name'] = walletInfo.account.user?.last_name
            await delete walletDetails['account'];
            if (walletDetails) {
                res.status(200).send({
                    status: "true",
                    message: "Wallet Details!",
                    walletDetails
                })
            } else {
                res.status(404).send({
                    status: "false",
                    message: "Wallet not found!"
                })
            }
        }).catch(async (err) => {
            console.log(err);
            res.status(400).send({
                status: "false",
                message: "Something went wrong while getting wallet details!"
            })
        })
    } catch (err) {
        console.log(err);
        res.status(500).send({
            status: "false",
            message: "Internal server error!"
        })
    }
}

module.exports.getExchangeRates = async (req, res) => {
    try {
        // let additional = 2;
        let fee = 0;
        var { from, to, type, level_id, amount, wallet_id } = req.body
        if (!to || !from || !type || !level_id || !amount || !wallet_id) {
            return res.status(404).send({
                status: "false",
                message: "Required field are missing!"
            })
        }
        // console.log(req.query);
        let walletDetails = await Wallet.findOne({ _id: wallet_id }, { balance: true })
        Fee.findOne({ $and: [{ service_name: type }, { account_level: level_id }] }).then(async (feeDetails) => {
            if (feeDetails) {
                axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`).then(async (exchangeRate) => {
                    if (exchangeRate.data.success) {
                        let newRate = exchangeRate.data.info.rate //+ (exchangeRate.data.info.rate * (additional / 100))
                        let exchangedAmount = newRate * amount;
                        exchangeRate.data['new_rate'] = newRate;
                        exchangeRate.data['exchanged_amount'] = exchangedAmount;
                        let fee_currency = feeDetails ? feeDetails.fee_currency : 'USD'
                        if (feeDetails) {
                            if (feeDetails.fee_type == 'flat') { fee = feeDetails.flat_fee }
                            else { fee = amount * (feeDetails.percentage_fee / 100) }
                        }
                        let feeExchange = await getExchangeRatesToUSD(fee_currency, from, fee)
                        // console.log(feeExchange);
                        exchangeRate.data['fee'] = {
                            fee_type: feeDetails?.fee_type,
                            exchange_fee: feeExchange,
                            fee: fee,
                            currency: from
                        }

                        res.status(200).send({
                            status: "true",
                            message: "Exchange Rates!",
                            insufficient_balance: (feeExchange + amount) > walletDetails?.balance.available ? true : false,
                            exchangeRate: exchangeRate.data,
                            walletDetails
                        })
                    } else {
                        res.status(404).send({
                            status: "false",
                            message: "Exchange Rates not found!"
                        })
                    }
                }).catch(async (err) => {
                    console.log(err);
                    res.status(400).send({
                        status: "false",
                        message: "Something went wrong while getting Exchange Rates!"
                    })
                })
            } else {
                res.status(400).send({
                    status: "false",
                    message: "Fee details not found!"
                })
            }

        }).catch(async (err) => {
            console.log(err);
            res.status(400).send({
                status: "false",
                message: "Something went wrong while getting Exchange Rates!"
            })
        })
    } catch (err) {
        let error = {
            status: "false",
            message: "Internal server error!"
        }
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

module.exports.instaWalletToWalletTransfer = async (req, res) => {
    try {
        let data = req.body
        // let data = await decryption(req.body.data)
        var { receiver_wallet_id, sender_wallet_id, purpose, amount, type } = data

        let senderWallet = await Wallet.findOne({ $and: [{ _id: sender_wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level']) }])
        let receiverWallet = await Wallet.findOne({ $and: [{ wallet_id: receiver_wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level']) }])
        // console.log(senderWallet.account._id, req.user._id, senderWallet.account.active);
        if (!senderWallet) {
            let error = {
                status: "false",
                message: "Invalid Sender!"
            }
            return res.status(400).send(error);
        }
        if (!receiverWallet) {
            let error = {
                status: "false",
                message: "Invalid Receiver!"
            }
            return res.status(400).send(error);
        }
        if (!senderWallet.account.active) {
            let error = {
                status: "false",
                message: "Invalid Sender!"
            }
            return res.status(400).send(error);
        }
        if (!receiverWallet.account.active) {
            let error = {
                status: "false",
                message: "Invalid Receiver!"
            }
            return res.status(400).send(error);
        }
        let senderLimit = senderWallet.account.level.sending_limit;
        let receiverLimit = receiverWallet.account.level.receiving_limit;
        if (senderWallet.account.is_external_limit) {
            senderLimit = senderWallet.account.sending_limit
        }
        if (receiverWallet.account.is_external_limit) {
            receiverLimit = senderWallet.account.receiving_limit
        }
        let excRate = await exchangeRateApi(senderWallet.currency.code, receiverWallet.currency.code, amount, senderWallet.account.level._id, 'wallet_to_wallet')
        // console.log(excRate);
        let totalAmount = amount + excRate.fee.exchange_fee;

        if (senderWallet.balance.available < (amount + excRate.fee.exchange_fee)) {
            let error = {
                status: "false",
                message: "Insufficient balance!"
            }
            return res.status(400).send(error);
        }
        if (senderLimit < totalAmount) {
            let error = {
                status: "false",
                message: "Sending limit exceeded!"
            }
            return res.status(400).send(error);
        }
        if (receiverLimit < excRate.exchanged_amount) {
            let error = {
                status: "false",
                message: "Receiver account receiving limit exceeded!"
            }
            return res.status(400).send(error);
        }

        let senderBalance = senderWallet.balance.available - (amount + excRate.fee.exchange_fee)
        let receiverBalance = receiverWallet.balance.available + excRate.exchanged_amount
        let ref = 'tr_' + Date.now().toString();
        let senderTransactionObj = {
            reference_id: ref,
            type: 'transfer',
            transaction_type: 'debit',
            service_type: 'wallet_to_wallet',
            status: 'completed',
            purpose: purpose,
            description: 'Wallet to wallet transfer',
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount: amount,
            fee: excRate.fee.exchange_fee,
            total: amount + excRate.fee.exchange_fee,
            wallet_id: senderWallet.wallet_id,
            wallet: senderWallet._id,
            account: senderWallet.account._id,
            sender: senderWallet.account._id,
            receiver: receiverWallet.account._id,
            current_balance: senderWallet.balance.available
        }
        let receiverTransactionObj = {
            reference_id: ref,
            type: 'transfer',
            transaction_type: 'credit',
            service_type: 'wallet_to_wallet',
            status: 'completed',
            purpose: purpose,
            description: 'Wallet to wallet transfer',
            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
            amount: excRate.exchanged_amount,
            fee: 0,
            total: excRate.exchanged_amount,
            wallet_id: receiverWallet.wallet_id,
            wallet: receiverWallet._id,
            account: receiverWallet.account._id,
            sender: senderWallet.account._id,
            receiver: receiverWallet.account._id,
            current_balance: receiverWallet.balance.available
        }
        Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderBalance } }).then(async (newSenderBalance) => {
            if (newSenderBalance.acknowledged && newSenderBalance.modifiedCount == 1) {
                let supdt = await Transaction.create(senderTransactionObj)
                if (supdt) {
                    Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                        if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                            let rupdt = await Transaction.create(receiverTransactionObj)
                            if (rupdt) {
                                // let updtr = Transaction.updateOne({ _id: supdt._id }, { $set: { status: 'completed' } })
                                if (receiverWallet.account.insta_subscriber_id && receiverWallet.account.insta_bot) {
                                    let bodyObj = {
                                        "subscriber_id": receiverWallet.account.insta_subscriber_id,
                                        "fields": [
                                            {
                                                "field_id": 9791576,
                                                "field_value": `You have received a payment of ${excRate.exchanged_amount.toFixed(2)} ${receiverWallet.currency.code}.`
                                            }
                                        ]
                                    }
                                    let flow = "content20230911011901_763323";
                                    manyChatMessage(receiverWallet.account.insta_subscriber_id, bodyObj, flow, 1)
                                }
                                let error = {
                                    status: "true",
                                    message: "Transaction successfull.",
                                    data: supdt
                                }
                                res.status(200).send(error);
                            } else {
                                let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
                                let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                                let wrupdt = await Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverWallet.balance.available } })
                                let error = {
                                    status: "false",
                                    message: "Transaction Failed."
                                }
                                res.status(400).send(error);
                            }
                        } else {
                            let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
                            let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                            let error = {
                                status: "false",
                                message: "Transaction Failed."
                            }
                            res.status(400).send(error);
                        }
                    }).catch(async (err) => {
                        let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
                        let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                        let error = {
                            status: "false",
                            message: "Transaction Failed."
                        }
                        res.status(400).send(error);
                    })
                } else {
                    let wupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                    let error = {
                        status: "false",
                        message: "Transaction Failed."
                    }
                    res.status(400).send(error);
                }
            } else {
                // let updt = Transaction.updateOne({ _id: supdt._id }, { $set: { status: 'failed' } })
                let error = {
                    status: "false",
                    message: "Transaction Failed."
                }
                res.status(200).send(error);
            }
        }).catch(async (err) => {
            // let updt = Transaction.updateOne({ _id: supdt._id }, { $set: { status: 'failed' } })
            let error = {
                status: "false",
                message: "Transaction Failed."
            }
            res.status(400).send(error);
        })

    } catch (err) {
        console.log(err);
        let error = {
            status: "false",
            message: "Internal server error!"
        }
        res.status(500).send(error)
    }
}

async function exchangeRateApi(from, to, amount, level_id, type) {
    try {
        let fee = 0;
        // let from = req.query.from;
        // let to = req.query.to;
        // let type = req.query.type;
        // let level_id = req.query.level_id;
        // let amount = req.query.amount;
        if (!to || !from || !type || !level_id || !amount) {
            return null;
        }
        console.log(from, to, amount, level_id, type);
        let feeDetails = await Fee.findOne({ $and: [{ service_name: type }, { account_level: level_id }] })
        if (feeDetails) {
            let exchangeRate = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`)
            if (exchangeRate.data.success) {
                let newRate = exchangeRate.data.info.rate //+ (exchangeRate.data.info.rate * (additional / 100))
                let exchangedAmount = newRate * amount;
                exchangeRate.data['new_rate'] = newRate;
                exchangeRate.data['exchanged_amount'] = exchangedAmount;
                let fee_currency = feeDetails ? feeDetails.fee_currency : 'USD'
                if (feeDetails) {
                    if (feeDetails.fee_type == 'flat') { fee = feeDetails.flat_fee }
                    else { fee = amount * (feeDetails.percentage_fee / 100) }
                }
                let feeExchange = await getExchangeRatesToUSD(fee_currency, from, fee)
                // console.log(feeDetails);
                exchangeRate.data['fee'] = {
                    fee_type: feeDetails.fee_type,
                    exchange_fee: feeExchange,
                    fee: fee,
                    currency: from
                }
                return exchangeRate.data;
            } else {
                return null;
            }
        } else {
            return null;
        }
    } catch (err) {
        console.log(err);
        return null;
    }
}

module.exports.getUserBeneficiaries = async (req, res) => {
    try {
        // let type = req.params.type;
        // let user_id = req.params.account_id;
        var { type, account_id } = req.body;
        Beneficiary.find({ $and: [{ account: account_id }, { account_type: { $all: [type] } }] }).then(async (beneficiaryList) => {
            if (beneficiaryList.length) {
                let idList = [];
                let message = ""
                beneficiaryList.map((bl, i) => {
                    idList.push(bl._id)
                    message += (i + 1).toString() + '. ' + (bl.first_name ? bl.first_name : '') + ' ' + (bl.last_name ? bl.last_name : '') + '\n'
                })
                var ciphertext = await encryption({ idList })
                var ciphertext = {
                    status: "true",
                    message: message,
                    data: ciphertext.data
                }
                res.status(200).send(ciphertext);
            } else {
                var ciphertext = {
                    status: "false",
                    message: "No Beneficiary found for this user!",
                    beneficiaryList: []
                }
                res.status(404).send(ciphertext);
            }
        }).catch(async (err) => {
            let error = {
                status: "false",
                message: "Something went wrong while getting beneficiary list!"
            }
            res.status(400).send(error)
        })

    } catch (err) {
        let error = {
            status: "false",
            message: "Internal server error!"
        }
        res.status(500).send(error)
    }
}

module.exports.getBeneficiaryDetails = async (req, res) => {
    try {
        var { selected_number, data } = req.body;
        data = await decryption(data);
        if (selected_number > 0 && selected_number <= data.idList.length) {
            // console.log(data.idList[selected_number - 1]);
            Beneficiary.findOne({ _id: data.idList[selected_number - 1] }).then(async (beneficiaryData) => {
                if (beneficiaryData) {
                    var ciphertext = {
                        status: "true",
                        message: "Beneficiary Details!",
                        beneficiaryData
                    }
                    res.status(200).send(ciphertext);
                } else {
                    var error = {
                        status: "false",
                        message: "No Beneficiary found for provided ID!"
                    }
                    res.status(404).send(error);
                }
            }).catch(async (err) => {
                let error = {
                    status: "false",
                    message: "Something went wrong while getting beneficiary details!"
                }
                res.status(400).send(error);
            })
        } else {
            let error = {
                status: "false",
                message: "Invalid input."
            }
            res.status(400).send(error);
        }
    } catch (err) {
        let error = {
            status: "false",
            message: "Internal server error!"
        }
        res.status(500).send(error);
    }
}

module.exports.getUserDetails = async (req, res) => {
    try {
        let account_id = req.params.account_id;
        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).populate(['user', 'company']).then(async (accountDetails) => {
            // console.log(accountDetails)
            if (accountDetails) {
                let resp = {
                    status: "true",
                    message: "Account details.",
                    accountDetails
                }
                res.status(200).send(resp)
            } else {
                let error = {
                    status: "false",
                    message: "No account found."
                }
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = {
                status: "false",
                message: "Something went wrong while getting account details"
            }
            res.status(400).send(error)
        })
    } catch (err) {
        console.log(err);
        let error = {
            status: "false",
            message: "Internal server error!"
        }
        res.status(500).send(error)
    }
}

module.exports.searchAccount = async (req, res) => {
    try {
        let query = req.params.query;
        Account.findOne({ $and: [{ $or: [{ username: query.toLowerCase() }, { phone: query }, { email: query.toLowerCase() }] }, { active: true }] }).populate(['user', 'company']).then(async (accountDetails) => {
            // console.log(accountDetails)
            if (accountDetails) {
                let resp = {
                    status: "true",
                    message: "Account details.",
                    accountDetails
                }
                res.status(200).send(resp);
            } else {
                let error = {
                    status: "false",
                    message: "No account found."
                }
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            let error = {
                status: "false",
                message: "Something went wrong while getting account details"
            }
            res.status(400).send(error);
        })
    } catch (err) {
        let error = {
            status: "false",
            message: "Internal server error!"
        }
        res.status(500).send(error);
    }
}

module.exports.requestPaymentW2W = async (req, res) => {
    try {
        var { amount, wallet_id, purpose, sender, receiver, subscriber_id } = req.body;

        let senderWallet = await Wallet.findOne({ $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level']) }])
        let receiverDetails = await Account.findOne({ $and: [{ _id: receiver }, { active: true }] }).populate(['user', 'company'])
        let senderDetails = await Account.findOne({ $and: [{ _id: sender }, { active: true }] }).populate(['user', 'company'])
        if (!senderWallet) {
            let error = {
                status: "false",
                message: "Sender Wallet not valid!"
            }
            return res.status(400).send(error);
        }

        if (!senderWallet?.account?.active || !senderDetails) {
            let error = {
                status: "false",
                message: "Invalid Sender!"
            }
            return res.status(400).send(error);
        }

        if (!receiverDetails) {
            let error = {
                status: "false",
                message: "Receiver not found!"
            }
            return res.status(404).send(error);
        }
        let ref = 'rq_' + Date.now().toString();

        let objReq = {
            reference_id: ref,
            type: 'payment_request',
            service_type: 'wallet_to_wallet',
            status: 'pending',
            purpose: purpose,
            description: 'Wallet to wallet payment request.',
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount,
            wallet_id: senderWallet.wallet_id,
            wallet: senderWallet._id,
            sender: senderWallet.account._id,
            receiver: receiverDetails._id
        }

        RequestPayment.create(objReq).then(async (requestDetails) => {
            // console.log(requestDetails)
            if (receiverDetails.insta_bot && receiverDetails.insta_subscriber_id) {
                console.log(senderDetails);
                let senderName = '';
                if (senderDetails.account_type == 'individual') { senderName = senderDetails.user.first_name + ' ' + senderDetails.user.last_name }
                if (senderDetails.account_type == 'business') { senderName = senderDetails.company.company_name }
                let bodyObj = {
                    "subscriber_id": receiverDetails.insta_subscriber_id,
                    "fields": [
                        {
                            "field_id": 9786303,
                            "field_value": `${senderName} have requested a payment of ${amount} ${senderWallet.currency.code}. Please tap below to Accept or Decline.\n\nReviews:\n\n🔹️ Good to work with.\n\n🔹 All went ok.\n\n🔹 A trustworthy person.\n\n👉 View more reviews ( instapay.com/username)`
                        },
                        {
                            "field_id": 9786332,
                            "field_value": objReq.reference_id
                        }
                    ]
                }
                let flow = "content20230909122607_148625";
                manyChatMessage(receiverDetails.insta_subscriber_id, bodyObj, flow, 1)
            }
            if (requestDetails) {
                let resp = {
                    status: "true",
                    message: "Request details.",
                    requestDetails
                }
                res.status(200).send(resp);
            } else {
                let error = {
                    status: "false",
                    message: "No account found."
                }
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            let error = {
                status: "false",
                message: "Something went wrong while getting account details"
            }
            res.status(400).send(error);
        })
    } catch (err) {
        console.log(err);
        let error = {
            status: "false",
            message: "Internal server error!"
        }
        res.status(500).send(error);
    }
}

module.exports.getExchangeRatesForRequest = async (req, res) => {
    try {
        // let additional = 2;
        let fee = 0;
        var { request_id, currency } = req.body;
        if (!request_id || !currency) {
            return res.status(404).send({
                status: "false",
                message: "Required field are missing!"
            })
        }
        let requestDetails = await RequestPayment.findOne({ reference_id: request_id })
        if (!requestDetails) {
            return res.status(404).send({
                status: "false",
                message: "Request not found!"
            })
        }
        // if (!to || !from || !type || !level_id || !amount || !wallet_id) {
        //     return res.status(404).send({
        //         status: "false",
        //         message: "Required field are missing!"
        //     })
        // }
        // console.log(req.query);
        let walletDetails = await Wallet.findOne({ $and: [{ account: requestDetails.receiver }, { "currency.code": currency.toUpperCase() }, { status: 'active' }] }).populate([{ path: 'account', select: 'level', populate: (['level']) }])
        let recieverWalletDetails = await Wallet.findOne({ $and: [{ _id: requestDetails.wallet }, { status: 'active' }] })
        let to = walletDetails.currency.code;
        let from = recieverWalletDetails.currency.code;
        let amount = requestDetails.amount;
        let level_id = walletDetails.account.level._id

        Fee.findOne({ $and: [{ service_name: 'wallet_to_wallet' }, { account_level: level_id }] }).then(async (feeDetails) => {
            if (feeDetails) {
                axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`).then(async (exchangeRate) => {
                    if (exchangeRate.data.success) {
                        let newRate = exchangeRate.data.info.rate //+ (exchangeRate.data.info.rate * (additional / 100))
                        let exchangedAmount = newRate * amount;
                        // exchangeRate.data['new_rate'] = newRate;
                        exchangeRate.data['exchanged_amount'] = exchangedAmount;
                        let fee_currency = feeDetails ? feeDetails.fee_currency : 'USD'
                        if (feeDetails) {
                            if (feeDetails.fee_type == 'flat') { fee = feeDetails.flat_fee }
                            else { fee = amount * (feeDetails.percentage_fee / 100) }
                        }
                        let feeExchange = await getExchangeRatesToUSD(fee_currency, to, fee)
                        // console.log(feeExchange);
                        exchangeRate.data['fee'] = {
                            fee_type: feeDetails?.fee_type,
                            exchange_fee: feeExchange,
                            fee: fee,
                            currency: to
                        }

                        res.status(200).send({
                            status: "true",
                            message: "Exchange Rates!",
                            insufficient_balance: (feeExchange + exchangeRate.data.result) > walletDetails?.balance.available ? true : false,
                            total: feeExchange + exchangeRate.data.result,
                            exchangeRate: exchangeRate.data,
                            walletDetails
                        })
                    } else {
                        res.status(404).send({
                            status: "false",
                            message: "Exchange Rates not found!"
                        })
                    }
                }).catch(async (err) => {
                    console.log(err);
                    res.status(400).send({
                        status: "false",
                        message: "Something went wrong while getting Exchange Rates!"
                    })
                })
            } else {
                res.status(400).send({
                    status: "false",
                    message: "Fee details not found!"
                })
            }

        }).catch(async (err) => {
            console.log(err);
            res.status(400).send({
                status: "false",
                message: "Something went wrong while getting Exchange Rates!"
            })
        })
    } catch (err) {
        let error = {
            status: "false",
            message: "Internal server error!"
        }
        res.status(500).send(error)
    }
}

async function requestExchangeRateApi(from, to, amount, level_id, type) {
    try {
        let fee = 0;
        if (!to || !from || !type || !level_id || !amount) {
            return null;
        }
        console.log(from, to, amount, level_id, type);
        let feeDetails = await Fee.findOne({ $and: [{ service_name: type }, { account_level: level_id }] })
        if (feeDetails) {
            let exchangeRate = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`)
            if (exchangeRate.data.success) {
                let newRate = exchangeRate.data.info.rate //+ (exchangeRate.data.info.rate * (additional / 100))
                let exchangedAmount = newRate * amount;
                exchangeRate.data['new_rate'] = newRate;
                exchangeRate.data['exchanged_amount'] = exchangedAmount;
                let fee_currency = feeDetails ? feeDetails.fee_currency : 'USD'
                if (feeDetails) {
                    if (feeDetails.fee_type == 'flat') { fee = feeDetails.flat_fee }
                    else { fee = amount * (feeDetails.percentage_fee / 100) }
                }
                let feeExchange = await getExchangeRatesToUSD(fee_currency, to, fee)
                // console.log(feeDetails);
                exchangeRate.data['fee'] = {
                    fee_type: feeDetails.fee_type,
                    exchange_fee: feeExchange,
                    fee: fee,
                    currency: to
                }
                return exchangeRate.data;
            } else {
                return null;
            }
        } else {
            return null;
        }
    } catch (err) {
        console.log(err);
        return null;
    }
}

module.exports.acceptPaymentRequest = async (req, res) => {
    try {
        var { request_id, account_id, sender_wallet_id, purpose } = req.body;
        if (!request_id || !account_id || !sender_wallet_id) {
            return res.status(404).send({
                status: "false",
                message: "Required field are missing!"
            })
        }
        let requestDetails = await RequestPayment.findOne({ $and: [{ reference_id: request_id }, { status: 'pending' }] })
        // console.log(requestDetails);
        if (!requestDetails) {
            return res.status(404).send({
                status: "false",
                message: "Request not found!"
            })
        }
        let receiver_wallet_id = requestDetails.wallet_id;
        let amount = requestDetails.amount;
        let type = 'payment_request';

        let senderWallet = await Wallet.findOne({ $and: [{ _id: sender_wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])
        let receiverWallet = await Wallet.findOne({ $and: [{ wallet_id: receiver_wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])
        // console.log(senderWallet.account._id, req.user._id, senderWallet.account.active);
        if (!senderWallet) {
            let error = {
                status: "false",
                message: "Invalid Sender!"
            }
            return res.status(400).send(error);
        }
        if (!receiverWallet) {
            let error = {
                status: "false",
                message: "Invalid Receiver!"
            }
            return res.status(400).send(error);
        }
        if (!senderWallet.account.active) {
            let error = {
                status: "false",
                message: "Invalid Sender!"
            }
            return res.status(400).send(error);
        }
        if (!receiverWallet.account.active) {
            let error = {
                status: "false",
                message: "Invalid Receiver!"
            }
            return res.status(400).send(error);
        }
        let senderLimit = senderWallet.account.level.sending_limit;
        let receiverLimit = receiverWallet.account.level.receiving_limit;
        if (senderWallet.account.is_external_limit) {
            senderLimit = senderWallet.account.sending_limit
        }
        if (receiverWallet.account.is_external_limit) {
            receiverLimit = senderWallet.account.receiving_limit
        }
        let excRate = await requestExchangeRateApi(receiverWallet.currency.code, senderWallet.currency.code, amount, senderWallet.account.level._id, 'wallet_to_wallet')
        // console.log(excRate);
        let totalAmount = excRate.exchanged_amount + excRate.fee.exchange_fee;

        if (senderWallet.balance.available < (excRate.exchanged_amount + excRate.fee.exchange_fee)) {
            let error = {
                status: "false",
                message: "Insufficient balance!"
            }
            return res.status(400).send(error);
        }
        if (senderLimit < totalAmount) {
            let error = {
                status: "false",
                message: "Sending limit exceeded!"
            }
            return res.status(400).send(error);
        }
        if (receiverLimit < amount) {
            let error = {
                status: "false",
                message: "Receiver account receiving limit exceeded!"
            }
            return res.status(400).send(error);
        }

        let senderBalance = senderWallet.balance.available - (excRate.exchanged_amount + excRate.fee.exchange_fee)
        let receiverBalance = receiverWallet.balance.available + amount
        let ref = 'tr_' + Date.now().toString();
        let senderTransactionObj = {
            reference_id: ref,
            type: 'payment_request',
            transaction_type: 'debit',
            service_type: 'wallet_to_wallet',
            status: 'completed',
            purpose: purpose,
            description: 'Wallet to wallet transfer',
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount: excRate.exchanged_amount,
            fee: excRate.fee.exchange_fee,
            total: excRate.exchanged_amount + excRate.fee.exchange_fee,
            wallet_id: senderWallet.wallet_id,
            wallet: senderWallet._id,
            account: senderWallet.account._id,
            sender: senderWallet.account._id,
            receiver: receiverWallet.account._id,
            current_balance: senderWallet.balance.available
        }
        let receiverTransactionObj = {
            reference_id: ref,
            type: 'payment_request',
            transaction_type: 'credit',
            service_type: 'wallet_to_wallet',
            status: 'completed',
            purpose: purpose,
            description: 'Wallet to wallet transfer',
            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
            amount: amount,
            fee: 0,
            total: amount,
            wallet_id: receiverWallet.wallet_id,
            wallet: receiverWallet._id,
            account: receiverWallet.account._id,
            sender: senderWallet.account._id,
            receiver: receiverWallet.account._id,
            current_balance: receiverWallet.balance.available
        }
        Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderBalance } }).then(async (newSenderBalance) => {
            if (newSenderBalance.acknowledged && newSenderBalance.modifiedCount == 1) {
                let supdt = await Transaction.create(senderTransactionObj)
                if (supdt) {
                    Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                        if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                            let rupdt = await Transaction.create(receiverTransactionObj)
                            console.log(rupdt);
                            if (rupdt) {
                                console.log(receiverWallet.account.insta_subscriber_id && receiverWallet.account.insta_bot);
                                if (receiverWallet.account.insta_subscriber_id && receiverWallet.account.insta_bot) {
                                    let senderName = '';
                                    if (senderWallet.account.account_type == 'individual') { senderName = senderWallet.account?.user?.first_name + ' ' + senderWallet.account?.user?.last_name }
                                    if (senderWallet.account.account_type == 'business') { senderName = senderWallet.account?.company?.company_name }
                                    let bodyObj = {
                                        "subscriber_id": receiverWallet.account.insta_subscriber_id,
                                        "fields": [
                                            {
                                                "field_id": 9786304,
                                                "field_value": `Your payment request of ${amount} ${receiverWallet.currency.code} had been accepted by "${senderName}"`
                                            }
                                        ]
                                    }
                                    console.log('test');
                                    let flow = "content20230909123103_666911";
                                    manyChatMessage(receiverWallet.account.insta_subscriber_id, bodyObj, flow, 1)
                                }
                                let newSenderBalance = await RequestPayment.updateOne({ _id: requestDetails._id }, { $set: { "status": 'completed' } })
                                let ciphertext = {
                                    status: "true",
                                    message: "Transaction successfull.",
                                    data: supdt
                                }
                                res.status(200).send(ciphertext);
                            } else {
                                let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
                                let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                                let wrupdt = await Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverWallet.balance.available } })
                                let error = {
                                    status: "false",
                                    message: "Transaction Failed."
                                }
                                res.status(400).send(error);
                            }
                        } else {
                            let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
                            let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                            let error = {
                                status: "false",
                                message: "Transaction Failed."
                            }
                            res.status(400).send(error);
                        }
                    }).catch(async (err) => {
                        let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
                        let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                        let error = {
                            status: "false",
                            message: "Transaction Failed."
                        }
                        res.status(400).send(error);
                    })
                } else {
                    let wupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                    let error = {
                        status: "false",
                        message: "Transaction Failed."
                    }
                    res.status(400).send(error);
                }
            } else {
                // let updt = Transaction.updateOne({ _id: supdt._id }, { $set: { status: 'failed' } })
                let error = {
                    status: "false",
                    message: "Transaction Failed."
                }
                res.status(200).send(error);
            }
        }).catch(async (err) => {
            // let updt = Transaction.updateOne({ _id: supdt._id }, { $set: { status: 'failed' } })
            let error = {
                status: "false",
                message: "Transaction Failed."
            }
            res.status(400).send(error);
        })


    } catch (err) {

        let error = {
            status: "false",
            message: "Internal server error!"
        }
        res.status(500).send(error);
    }
}

module.exports.declinePaymentRequest = async (req, res) => {
    try {
        let request_id = req.params.request_id;
        let requestDetails = await RequestPayment.findOne({ $and: [{ reference_id: request_id }, { status: 'pending' }] })
            .populate([
                { path: 'receiver', populate: (['user', 'company']) },
                { path: 'sender', populate: (['user', 'company']) }
            ]);
        if (!requestDetails) {
            return res.status(404).send({
                status: "false",
                message: "Request not found!"
            })
        }
        let newSenderBalance = await RequestPayment.updateOne({ _id: requestDetails._id }, { $set: { "status": 'cancelled' } })

        if (requestDetails.sender.insta_subscriber_id && requestDetails.sender.insta_bot) {
            let senderName = '';
            if (requestDetails.receiver.account_type == 'individual') { senderName = requestDetails.receiver?.user?.first_name + ' ' + requestDetails.receiver?.user?.last_name }
            if (requestDetails.receiver.account_type == 'business') { senderName = requestDetails.receiver?.company?.company_name }
            let bodyObj = {
                "subscriber_id": requestDetails.sender.insta_subscriber_id,
                "fields": [
                    {
                        "field_id": 9786305,
                        "field_value": `Your payment request of ${requestDetails.amount} ${requestDetails.currency.code} had been declined by "${senderName}"`
                    }
                ]
            }
            let flow = "content20230909123149_783385";
            manyChatMessage(requestDetails.sender.insta_subscriber_id, bodyObj, flow, 1)
        }
        let ciphertext = {
            status: "true",
            message: "Payment request declined."
        }
        res.status(200).send(ciphertext);
    } catch (err) {
        console.log(err);
        let error = {
            status: "false",
            message: "Internal server error!"
        }
        res.status(500).send(error);
    }
}

module.exports.getSubscriberId = async (req, res) => {
    try {
        let account_id = req.params.account_id
        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }, { insta_subscriber_id: true, insta_bot: true }).then(accountDetails => {
            if (accountDetails) {
                if (accountDetails.insta_bot && accountDetails.insta_subscriber_id) {
                    let error = {
                        status: "true",
                        subscriber_id: accountDetails.insta_subscriber_id
                    }
                    res.status(200).send(error);
                } else {
                    let error = {
                        status: "false",
                        message: "No subscriber ID found."
                    }
                    res.status(404).send(error);
                }
            } else {
                let error = {
                    status: "false",
                    message: "No account found."
                }
                res.status(404).send(error);
            }
        }).catch(err => {
            let error = {
                status: "false",
                message: "Something went wrong while searching for account."
            }
            res.status(400).send(error);
        })
    } catch (err) {

        let error = {
            status: "false",
            message: "Internal server error!"
        }
        res.status(500).send(error);
    }
}

async function manyChatMessage(subscriber_id, bodyObj, flow, count) {
    // console.log(subscriber_id, bodyObj, count);
    let config = {
        headers: {
            Authorization: `Bearer 651520:ffa2597339a6c10ac2b50aec755ce42c`,
        }
    }

    axios.post('https://api.manychat.com/fb/subscriber/setCustomFields', bodyObj, config).then(resp => {
        console.log(resp.data);
        if (resp.data.status != 'success' && count < 2) {
            manyChatMessage(subscriber_id, bodyObj, flow, count + 1)
        } else {
            manyChatFlow(subscriber_id, flow, 1)
        }
    }).catch(err => {
        if (count < 2) {
            manyChatMessage(subscriber_id, bodyObj, flow, count + 1)
        }
    })

}

async function manyChatFlow(subscriber_id, flow, count) {

    let config = {
        headers: {
            Authorization: `Bearer 651520:ffa2597339a6c10ac2b50aec755ce42c`,
        }
    }

    axios.post('https://api.manychat.com/fb/sending/sendFlow', {
        "subscriber_id": subscriber_id,
        "flow_ns": flow
    }, config).then(resp => {
        console.log(resp.data);
        if (resp.data.status != 'success' && count < 2) {
            manyChatFlow(subscriber_id, flow, count + 1)
        }
    }).catch(err => {
        if (count < 2) {
            manyChatFlow(subscriber_id, flow, count + 1)
        }
    })

}






async function convertCurrency(from, to, amount) {
    const exchangeRateKey = process.env.EXCHANGE_RATE_KEY;
    const apiUrl = `https://api.exchangeratesapi.io/v1/convert?access_key=${exchangeRateKey}&from=${from}&to=${to}&amount=${amount}&format=1`;

    try {
        const response = await axios.get(apiUrl);
        return response.data.result;
    } catch (error) {
        throw new Error(`Error fetching exchange rate: ${error.message}`);
    }
}


// function which calculates fees( being used in multiple apis)
async function calculateFee(fee_type, fee_currency, wallet_currency, flat_fee, percentage_fee, amount) {
    let fee = 0;

    if (fee_type === 'flat') {
        if (fee_currency === wallet_currency) {
            fee = flat_fee;
        } else {
            const rate = await convertCurrency(fee_currency, wallet_currency, 1);
            fee = flat_fee * rate;
        }
    }

    if (fee_type === 'percentage') {
        fee = (percentage_fee / 100) * amount;

    }
    return fee;
}

// fucntion to calculate markup
async function calculateExchangeRateWithMarkup(markup_type, markup_currency, thune_currency, exchange_rate, markup_fee) {
    let exchange_rate_with_markup = 1;

    if (markup_type === 'flat') {
        if (markup_currency === thune_currency) {
            markup = markup_fee
        }
        else {
            rate = await convertCurrency(markup_currency, thune_currency, 1)
            markup = markup_fee * rate
        }

        exchange_rate_with_markup = exchange_rate - (exchange_rate * markup)
    }


    // we reduce the percentage in the exchangerate and show that 
    if (markup_type === 'percentage') {
        markup = (exchange_rate - ((percentage_markup / 100) * exchange_rate))
        exchange_rate_with_markup = markup
    }

    return exchange_rate_with_markup;
}

function generateUniqueID() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const milliseconds = now.getMilliseconds().toString().padStart(3, '0');

    const uniqueID = `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}`;
    return uniqueID;
}

// Function to fetch countries from the Thunes API
const fetchCountriesFromThunes = async () => {
    const API_URL = 'https://api-mt.pre.thunes.com/v2/money-transfer/countries';
    const perPage = 100;

    const config = {
        headers: {
            'Authorization': `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`,
        },
        params: {
            per_page: perPage,
        },
    };

    try {
        const response = await axios.get(API_URL, config);
        const countries = response.data;
        return countries;
    } catch (error) {
        console.error('Error fetching countries from Thunes API:', error);
        throw error; // You can choose to handle or propagate the error as needed
    }
};

// to get all the supported countires in our thunes
exports.getCountries = async (req, res) => {
    try {

        const country_name = req.body.country_name

        const countryInfo = countryData.countries.all;
        const countryNames = [];

        countryInfo.forEach((country) => {
            const countryName = {
                name: country.name,
            };

            countryNames.push(countryName);
        });

        // we put the country in another varaible
        const countryNameToFind = country_name

        const exactMatch = countryNames.find(
            (country) => country.name.toLowerCase() === countryNameToFind.toLowerCase()
        );

        // if country is found in list
        if (exactMatch) {
            const countries = await fetchCountriesFromThunes()  // function which makes axios call to thunes url

            // to check if the country is supported by thunes or not
            const supportedCountry = countries.find(
                (country) => country.name === exactMatch.name
            );

            if (supportedCountry) {
                return res.json({ status: "true", Country: "supported", Name: exactMatch.name, iso_code: supportedCountry.iso_code });
            } else {
                return res.json({ status: "false", Country: "unsupported" });
            }

        } else {
            // finding the result with similar output
            const matches = stringSimilarity.findBestMatch(
                countryNameToFind.toLowerCase(),
                countryNames.map((country) => country.name.toLowerCase())
            );

            // getting the best match
            const closestMatch = matches.bestMatch;

            if (closestMatch.rating > 0.5) {
                const suggestedCountry = countryNames.find(
                    (country) => country.name.toLowerCase() === closestMatch.target
                );

                const countries = await fetchCountriesFromThunes()
                const supportedCountry = countries.find(
                    (country) => country.name === suggestedCountry.name
                );

                if (supportedCountry) {
                    return res.json({ status: "true", Country: "suggestion", Name: supportedCountry.name, iso_code: supportedCountry.iso_code });
                } else {
                    return res.json({ status: "false", Country: "unsupported" });
                }
            } else {
                return res.json({ status: "false", Country: "unsupported" });
            }
        }

    } catch (error) {
        console.error('Error fetching countries:', error);
        Status = "false";
        Message = 'Internal Server Error'
        res.status(500).send({ Status, Message });
        //res.status(500).send({Error: 'Internal Server Error'});
    }
};

// get all the services available in that country
exports.getServices = async (req, res) => {
    try {
        const requestedCountry = req.body.country_name;

        const API_URL = 'https://api-mt.pre.thunes.com/v2/money-transfer/services';
        const perPage = 100;

        const config = {
            headers: {
                'Authorization': `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`,
            },
            params: {
                per_page: perPage,
                country_iso_code: requestedCountry
            },
        };

        const response = await axios.get(API_URL, config);
        const services = response.data;

        let MobileWallet = {
            status: "false",
            id: null
        }
        for (const item of services) {
            if (item.name === "MobileWallet") {
                MobileWallet.status = "true"
                MobileWallet.id = item.id.toString()
                break;
            }
        }


        let BankAccount = {
            status: "false",
            id: null
        }
        for (const item of services) {
            if (item.name === "BankAccount") {
                BankAccount.status = "true"
                BankAccount.id = item.id.toString()
                break;
            }
        }

        let CashPickup = {
            status: "false",
            id: null
        }
        for (const item of services) {
            if (item.name === "CashPickup") {
                CashPickup.status = "true"
                CashPickup.id = item.id.toString()
                break;
            }
        }


        res.json({ Status: "true", MobileWallet: MobileWallet, BankAccount: BankAccount, CashPickup: CashPickup });
        //res.json(services);


    } catch (error) {
        console.error('Error fetching payers:', error);
        Status = "false";
        message = 'Internal Server Error'
        res.status(500).send({ Status, message });
    };
}

// we use this to only return the names of the payers
exports.getPayerNames = async (req, res) => {
    try {

        const requestedService = req.body.id;
        const requestedCountry = req.body.country;

        // there are no results for more then 100 payers in the api for any country & service code so have not used any logic to check beyond page 1
        const API_URL = 'https://api-mt.pre.thunes.com/v2/money-transfer/payers';
        const perPage = 100;

        const config = {
            headers: {
                'Authorization': `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`,
            },
            params: {
                per_page: perPage,
                country_iso_code: requestedCountry,
                service_id: requestedService
            },
        };

        const response = await axios.get(API_URL, config);
        const payers = response.data;

        const transformedServices = payers.map(service => ({
            // country_iso_code: service.country_iso_code,
            // currency: service.currency,
            // id: service.id,
            // increment: service.increment,
            name: service.name
            // precision: service.precision,
            // transaction_types: {
            //   C2C: {
            //     maximum_transaction_amount: service.transaction_types.C2C.maximum_transaction_amount,
            //     minimum_transaction_amount: service.transaction_types.C2C.minimum_transaction_amount,
            //     purpose_of_remittance_values_accepted: service.transaction_types.C2C.purpose_of_remittance_values_accepted,
            //     required_documents: service.transaction_types.C2C.required_documents
            //   }
            //}
        }));


        function formatBankNames(bankNames) {
            let formattedList = '';
            for (let i = 0; i < bankNames.length; i++) {
                formattedList = formattedList + `${i + 1}. ${bankNames[i].name} \n`;
            }
            return formattedList;
        }

        // Call the function and store the formatted list
        const formattedList = formatBankNames(transformedServices);


        console.log(formattedList)
        res.json({ Status: "true", payers: formattedList });

    } catch (error) {
        console.error('Error fetching payers:', error);
        Status = "false";
        message = 'Internal Server Error'
        res.status(500).send({ Status, message });
    }
};

//this is being used for payer info
exports.getPayerInfo = async (req, res) => {
    try {

        const requestedinput = req.body.input;
        const requestedService = req.body.id;
        const requestedCountry = req.body.country;

        // there are no results for more then 100 payers in the api for any country & service code so have not used any logic to check beyond page 1
        const API_URL = 'https://api-mt.pre.thunes.com/v2/money-transfer/payers';
        const perPage = 100;

        const config = {
            headers: {
                'Authorization': `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`,
            },
            params: {
                per_page: perPage,
                country_iso_code: requestedCountry,
                service_id: requestedService
            },
        };

        const response = await axios.get(API_URL, config);
        const payers = response.data;

        // we only sending names so other things are commented here 
        const transformedServices = payers.map(service => ({
            // country_iso_code: service.country_iso_code,
            // currency: service.currency,
            // id: service.id,
            // increment: service.increment,
            name: service.name
            // precision: service.precision,
            // transaction_types: {
            //   C2C: {
            //     maximum_transaction_amount: service.transaction_types.C2C.maximum_transaction_amount,
            //     minimum_transaction_amount: service.transaction_types.C2C.minimum_transaction_amount,
            //     purpose_of_remittance_values_accepted: service.transaction_types.C2C.purpose_of_remittance_values_accepted,
            //     required_documents: service.transaction_types.C2C.required_documents
            //   }
            //}
        }));


        function formatBankNames(bankNames) {
            let formattedList = '';
            for (let i = 0; i < bankNames.length; i++) {
                formattedList = formattedList + `${i + 1}. ${bankNames[i].name} \n`;
            }
            return formattedList;
        }
        const formattedList = formatBankNames(transformedServices);

        //console.log(formattedList)


        function getItemByNumber(inputString, inputNumber) {
            const lines = inputString.split('\n');
            const itemIndex = inputNumber - 1; // Adjust for 0-based indexing

            if (itemIndex >= 0 && itemIndex < lines.length) {
                return lines[itemIndex].trim(); // Trim to remove leading/trailing spaces
            } else {
                return "Item not found";
            }
        }

        const result = getItemByNumber(formattedList, requestedinput);

        function extractName(inputString) {
            const parts = inputString.split('. ');
            if (parts.length > 1) {
                return parts[1];
            } else {
                return inputString;
            }
        }

        const extractedName = extractName(result);




        const transformedServicesTwo = payers.map(service => {
            // Handle maximum_transaction_amount condition
            const string_max_amount = service.transaction_types.C2C.maximum_transaction_amount == null ? "null" : service.transaction_types.C2C.maximum_transaction_amount;

            // Handle minimum_transaction_amount condition
            const string_min_amount = service.transaction_types.C2C.minimum_transaction_amount === null ? "null" : service.transaction_types.C2C.minimum_transaction_amount;

            // Construct and return the transformed object
            return {
                country_iso_code: service.country_iso_code,
                currency: service.currency,
                id: service.id.toString(),
                increment: service.increment.toString(),
                name: service.name,
                precision: service.precision,
                transaction_types: {
                    C2C: {
                        maximum_transaction_amount: string_max_amount,
                        minimum_transaction_amount: string_min_amount
                        // Add other properties as needed
                    }
                }
            };
        });


        const last_result = transformedServicesTwo.find(item => item.name === extractedName);
        res.json({ Status: "true", payer_info: last_result });


    } catch (error) {
        console.error('Error fetching payers:', error);
        Status = "false";
        message = 'Internal Server Error'
        res.status(500).send({ Status, message });
    }
};

// function to get the rate
const calculatePayerRatesLogic = async (payerId, walletId, user_id, beneficiary_id, amount) => {

    const wallet = await Wallet.findOne({ _id: walletId }).populate('account');
    const wallet_currency = wallet.currency.code //'EUR'
    const balance = wallet.balance.available;
    const fees = await Fee.findOne({ account_level: wallet.account.level._id }).populate('account_level');
    const thune_currency = 'USD'; // As we only have USD in account right now, this will later need to be updated depending 
    let wallet_to_thune_exchangerate = 1;
    let wallet_to_thune_currency_amount


    const users = await User.findOne({ _id: user_id }).populate('account');
    let transactionType = 'C2C' //decrypted_request_body.transaction_type;
    if (beneficiary_id) {
        const beneficiary = await Beneficiary.findOne({ _id: beneficiary_id }).populate('account');

        if (users.account.account_type === "business") {
            transactionType = transactionType.replace(/^C/, "B");

        }
        if (beneficiary.account.account_type === "business") {
            transactionType = transactionType.replace(/C$/, "B");
        }
    }

    // Converting source currency into the Thunes currency
    if (wallet_currency !== thune_currency) {
        wallet_to_thune_exchangerate = await convertCurrency(wallet_currency, thune_currency, 1);
        wallet_to_thune_exchangerate = parseFloat(wallet_to_thune_exchangerate.toFixed(2))
        wallet_to_thune_currency_amount = amount * wallet_to_thune_exchangerate;
        // console.log(wallet_to_thune_exchangerate)
        // console.log(wallet_to_thune_currency_amount)
    }
    else {
        wallet_to_thune_currency_amount = amount
    }

    const fee_type = fees.fee_type;
    const flat_fee = fees.flat_fee;
    const percentage_fee = fees.percentage_fee;
    const fee_currency = fees.fee_currency;
    const sending_limit = 1000//fees.account_level.sending_limit;  // hardcoced cause they were very less in the db
    const daily_sending_limit = fees.account_level.daily_sending_limit;
    const monthly_sending_limit = 1000 //fees.account_level.monthly_sending_limit;
    const yearly_sending_limit = 1000 //fees.account_level.yearly_sending_limit;
    var fee = 0;

    const markup_fee = 0.05;
    const markup_type = 'flat';
    const percentage_markup = 10;
    const markup_currency = 'USD';
    var markup = 0;
    var exchange_rate_with_markup = 0;

    const API_URL = `https://api-mt.pre.thunes.com/v2/money-transfer/payers/${payerId}/rates`;

    const config = {
        headers: {
            'Authorization': `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`,
        }
    };

    let Max_Amount
    let Min_Amount
    let exchange_rate

    const response = await axios.get(API_URL, config);
    const rates = response.data;
    let destination_currency = rates.destination_currency;

    const keys = Object.keys(rates.rates);  // extracting the transaction types supported by payer,  this infor is not shown in the get payer info so extracting it here

    if (keys.includes(transactionType)) {
        Max_Amount = rates.rates[transactionType][thune_currency][0].source_amount_max;
        Min_Amount = rates.rates[transactionType][thune_currency][0].source_amount_min;
        exchange_rate = parseFloat((rates.rates[transactionType][thune_currency][0].wholesale_fx_rate).toFixed(2))
    } else {
        return {
            error: "Transaction Type Not Supoorted by Payer"
        };
    }


    // Calling the calculateFee function
    fee = await calculateFee(fee_type, fee_currency, wallet_currency, flat_fee, percentage_fee, amount);

    // Call the calculateExchangeRateWithMarkup function
    exchange_rate_with_markup = await calculateExchangeRateWithMarkup(markup_type, markup_currency, thune_currency, exchange_rate, markup_fee);
    exchange_rate_with_markup = parseFloat(exchange_rate_with_markup.toFixed(2))

    if (Max_Amount === null) {
        Max_Amount = 100000;
    }

    if (Min_Amount === null) {
        Min_Amount = 0;
    }


    let converted_amount = wallet_to_thune_currency_amount * exchange_rate_with_markup;
    // console.log(wallet_to_thune_currency_amount)
    // console.log(exchange_rate_with_markup)
    // console.log(converted_amount)


    let converted_max_amount = Max_Amount * exchange_rate_with_markup;
    let converted_min_amount = Min_Amount * exchange_rate_with_markup;
    let total = fee + amount;



    if (converted_max_amount <= converted_amount) {
        return {
            error: "Amount exceeds maximum allowed"
        };
    }

    if (converted_amount <= converted_min_amount) {
        return {
            error: "Amount is below the minimum allowed"
        };
    }

    if (total > sending_limit) {
        return {
            error: "Total is more than sending limit"
        };
    }

    if (total > daily_sending_limit) {
        return {
            error: "Total is more than daily sending limit"
        };
    }

    if (total > monthly_sending_limit) {
        return {
            error: "Total is more than monthly sending limit"
        };
    }

    if (total > yearly_sending_limit) {
        return {
            error: "Total is more than yearly sending limit"
        };
    }

    if (total > balance) {
        return {
            error: `Insufficient Balance, your current balance in this wallet is ${balance}`
        };
    }

    const amount_to_thune = converted_amount / exchange_rate;
    // console.log(wallet_to_thune_currency_amount)
    // console.log(exchange_rate_with_markup)
    const our_markup = wallet_to_thune_currency_amount - amount_to_thune;

    const roundedExchangeRate = parseFloat(exchange_rate.toFixed(3));
    const roundedExchangeRateWithMarkup = parseFloat(exchange_rate_with_markup.toFixed(3));
    const roundedConvertedAmount = parseFloat(converted_amount.toFixed(3));
    const roundedConvertedMaxAmount = parseFloat(converted_max_amount.toFixed(3));
    const roundedConvertedMinAmount = parseFloat(converted_min_amount.toFixed(3));
    const roundedFee = parseFloat(fee.toFixed(3));
    const roundedTotal = parseFloat(total.toFixed(3));
    const roundedOriginalConvertedAmount = parseFloat(wallet_to_thune_currency_amount.toFixed(3));
    const roundedAmountToThune = parseFloat(amount_to_thune.toFixed(3));
    const roundedOurMarkup = parseFloat(our_markup.toFixed(3));

    // returning everything so it is easy to understand(output will need to be changed later)
    let api_response = {
        //thunes_exchange_rate: roundedExchangeRate,
        exchange_rate: roundedExchangeRateWithMarkup,
        wallet_currency: wallet_currency,
        destination_currency: destination_currency,
        converted_amount: roundedConvertedAmount,                  // value in destination currency
        converted_max_amount: roundedConvertedMaxAmount,           // value in destination currency
        converted_min_amount: roundedConvertedMinAmount,           // value in destination currency
        fee: roundedFee,              // these values are in source currency
        total: roundedTotal,
        transactionType: transactionType,       // value in source currency
        //original_converted_amount: roundedOriginalConvertedAmount,    // value in thunes account currency
        amount_to_thune: roundedAmountToThune,                       // value in thunes account currency
        //our_markup: roundedOurMarkup                                // value in thunes account currency
    };

    return {
        success: true,
        //Supported_Transaction_Types:keys,
        api_response: api_response
    };
}

// to only get the excahnge rate on thunes for the selected payer
exports.getPayerRates = async (req, res) => {
    try {
        const requestbody = req.body;
        const decrypted_request_body = req.body //await decryption(requestbody);
        let payerId = parseInt(decrypted_request_body.payer_id);
        const wallet_id = decrypted_request_body.wallet_id;
        const user_id = decrypted_request_body.user_id;
        const beneficiary_id = decrypted_request_body.beneficiary_id;
        //const transaction_type = decrypted_request_body.transaction_type;
        const amount = parseFloat(decrypted_request_body.amount);

        const result = await calculatePayerRatesLogic(payerId, wallet_id, user_id, beneficiary_id, amount);
        if (result.success) {

            const payload = {
                result: result.api_response
            };

            const options = {
                expiresIn: '1h',
            };         // not expiring the token right now

            const token = jwt.sign(payload, secretKey);

            res.json({ Status: "true", result: result.api_response, token: token, Supported_Transaction_Types: result.Supported_Transaction_Types });
        } else {
            res.status(404).json({ status: "false", message: result.error });
        }
    } catch (error) {
        console.error('Error fetching payer rates:', error);
        Status = "false";
        message = 'Internal Server Error'
        res.status(500).send({ Status, message });
        //res.status(500).json('Internal Server Error');
    }
}

// gives the exchange rate, a Quotationid which is used to create a transaction
exports.createQuotation = async (req, res) => {
    try {
        const external_id1 = shortid.generate();
        const API_URL = 'https://api-mt.pre.thunes.com/v2/money-transfer/quotations';
        const Thunes_Currency = 'USD'  // AS WE ONLY HAVE USD FOR NOW SO HARDCODING IT 
        const Thunes_Country = 'USA'  // AS WE ONLY HAVE USD FOR NOW SO HARDCODING IT 

        // REQBODY FROM POSTMAN
        const requestedData = req.body
        let {
            wallet_id,
            payer_id,
            transactionType,
            user_id,
            beneficiary_id,
            amount,
            token
            // destination: { currency: destinationCurrency }
        } = requestedData;

        amount = parseFloat(amount)
        //payer_id=parseInt(payer_id)

        const decodedToken = jwt.verify(token, secretKey);
        const result = await calculatePayerRatesLogic(payer_id, wallet_id, user_id, beneficiary_id, amount);
        if (result.success) {
            const mode = 'SOURCE_AMOUNT'

            console.log(decodedToken.result);
            // console.log(result.api_response)

            // this function comapres both the objects, from the token and the one returned right now
            function findDifferences(obj1, obj2) {
                let feeChanged = false;
                let otherPropertyChanged = false;

                if (obj1.fee !== obj2.fee) {
                    feeChanged = true;
                }
                for (const key in obj1) {
                    if (key !== "fee" && obj1.hasOwnProperty(key)) {
                        if (!obj2.hasOwnProperty(key) || obj1[key] !== obj2[key]) {
                            otherPropertyChanged = true;
                            break;
                        }
                    }
                }

                // console.log(decodedToken.result)
                // console.log(result.api_response)

                if (feeChanged && otherPropertyChanged) {
                    return "difference";      // we only show that the exchagne rate has been changd, (read the next comments to understand)
                } else if (feeChanged) {
                    return "fees changed";   // so msg cn be displayed that fee has been cahgned
                } else if (otherPropertyChanged) {
                    return "difference";   // if any other property has changed then it means that there has been a change in the exchange rate
                } else {
                    return "no changes";
                }
            }

            const difference = findDifferences(decodedToken.result, result.api_response);

            if (difference === "difference") {
                Status = "false";
                message = 'There has been a change in the exchagne rate'
                res.status(400).send({ Status, message });
                //res.status(400).json('There has been a change in the exchagne rate');
            }

            if (difference === "fees changed") {
                Status = "false";
                message = 'Fees has been updaated.'
                res.status(400).send({ Status, message });
                //res.status(400).json('Fees has been updaated.');

            }
            if (difference === "no changes") {

                // THE REQUEST DATA WE SENDING ,  IT HAS AMOUNT IN DESTINATION, WHICH CANT BE EMPTY AND IS SET TO NULL(PUTTING A VALUE IN IT DOESNT DO ANYTHING)
                const requestData = {
                    external_id: external_id1,
                    payer_id: payer_id,
                    mode: mode,
                    transaction_type: transactionType,
                    source: {
                        amount: result.api_response.amount_to_thune,
                        currency: Thunes_Currency,
                        country_iso_code: Thunes_Country
                    },
                    destination: {
                        amount: null,
                        currency: result.api_response.destination_currency
                    }
                };

                const authHeader = `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`;
                const config = {
                    headers: {
                        'Authorization': authHeader,
                        'Content-Type': 'application/json'
                    }
                };

                const response = await axios.post(API_URL, requestData, config);
                const quotationResult = response.data;

                // converting the creation date into a human readbale format
                const creationMoment = moment(quotationResult.creation_date);
                const humanReadableCreation = creationMoment.format('MMMM Do YYYY, h:mm a');

                // converting the expiry date into a human readbale format
                // the quotation is only valid for one hour, after that it cant be used to create a transaction
                const expirationMoment = moment(quotationResult.expiration_date);
                const humanReadableExpiration = expirationMoment.format('MMMM Do YYYY, h:mm a');

                // removing the external_id as i am returing this value in the QuotationID  
                const { external_id, ...filteredQuotationResult } = quotationResult;

                const filteredResponse = {
                    QuotationID: external_id1,                       // external being saved in QuotationID
                    creation_date: humanReadableCreation,          // this updates the nonreadbale time into readable
                    expiration_date: humanReadableExpiration,
                    token: token    // this updates the nonreadbale time into readable
                };

                res.json({ Status: "true", Response: filteredResponse });
            }

        }
        else {
            res.status(404).json({ Status: "false", message: result.error });
        }

    } catch (error) {
        console.error('Error creating quotation:', error);


        // if (error.response && error.response.data && error.response.data.errors) {

        //   // not showing the error messages by thune thats why commented
        //   const errorMessages = error.response.data.errors
        //     .map(error => `${error.code}: ${error.message}`)
        //     .join(', ');
        //   const encryptedError = await encryption(errorMessages);

        //   const errorCodes = error.response.data.errors.map(error => error.code); // Extract all error codes by thune

        //   //const encryptedError = await encryption(errorCodes.join(', '));



        //   res.status(error.response.status).send(encryptedError);
        // } else {
        res.status(500).send({ Status: "false", message: 'An error occurred while creating the quotation' });
        //  }
    }
};

exports.createTransaction = async (req, res) => {
    try {
        const requestedData = req.body

        // required information to make a transaction
        const {
            Quotation_ID,
            wallet_id,
            additional_information,
            purpose_of_remittance,
            user_id,             // right now this is taken in request body, later it will be taken from token, so needs to be updated
            beneficiary_id,
            service,
            transaction_type,
            token
        } = requestedData;

        const user = await User.findById(user_id);
        const beneficiary = await Beneficiary.findById(beneficiary_id);

        // console.log(user)
        // console.log(beneficiary)


        const service_id = service.id;

        const credit_party_identifier = {
            msisdn: "",
            bank_account_number: "",
            //swift_bic_code: "",  not using this for now as it isnt the requirment for any payer currently
            iban: ""
        };

        // hardcoding values for now, since this data isnt in the database
        if (service_id === 1) {
            credit_party_identifier.msisdn = beneficiary.mobile_wallet_account_number// "272715638100" //beneficiary.mobile_wallet_account_number
            //console.log(credit_party_identifier.msisdn)
        } else if (service_id === 2) {
            credit_party_identifier.bank_account_number = beneficiary.bank_account_number //"272715638100" //beneficiary.bank_account_number
            credit_party_identifier.iban = beneficiary.bank_iban //"AT351111111111111100"; //beneficiary.bank_swift_code
            // console.log(credit_party_identifier.bank_account_number)
            // console.log(credit_party_identifier.iban)

        }

        // console.log(credit_party_identifier)

        const API_URL = `https://api-mt.pre.thunes.com/v2/money-transfer/quotations/ext-${Quotation_ID}/transactions`;
        const transactionExternalID = shortid.generate();

        //console.log(transaction_type)

        first_type = transaction_type[0] // to see if the sender is individual or business
        second_type = transaction_type[2] // to see if the reciever is individual or business
        let requestData
        let sender_obj

        // all the fields of a individual 
        if (first_type === 'C') {
            sender_obj = {
                firstname: user.first_name || '',
                lastname: user.last_name || '',
                nationality: user.nationality || '',
                address: user.address || '',
                date_of_birth: user.dob || '',
                id_expiration_date: "",
                country_of_birth_iso_code: "",
                source_of_funds: "",
                date_of_birth: "",
                country_iso_code: "TZA",       // not in database so hardocing this value for now
                beneficiary_relationship: "", //beneficiary.relation || '',   // from bene db (these need to be in a format which is acceptable by thunes, so do check)
                nativename: "",
                id_country_iso_code: "",
                email: "",
                city: "",
                postal_code: "",
                id_type: "",
                id_number: "",
                gender: "",
                code: "",
                id_delivery_date: "",
                middlename: "",
                occupation: "",
                province_state: "",
                msisdn: "",
                nationality_country_iso_code: "",
            }

        }

        let beneficiary_obj
        if (second_type === "C") {
            // all fields of individual beneficiary
            beneficiary_obj = {
                firstname: beneficiary.first_name || '',
                bank_account_holder_name: "",
                id_expiration_date: "",
                lastname2: "",
                date_of_birth: "",
                country_iso_code: "USA",
                lastname: beneficiary.last_name,
                nativename: "",
                id_country_iso_code: "",
                email: beneficiary.email,
                city: beneficiary.city,
                postal_code: "",
                id_type: "",
                address: "",
                id_number: "",
                gender: "",
                code: "",
                id_delivery_date: "",
                middlename: "",
                occupation: "",
                province_state: "",
                country_of_birth_iso_code: "",
                msisdn: "",
                nationality_country_iso_code: ""
            }



        }


        let sending_business
        if (first_type === 'B') {
            // all the fields of a business sender
            // things hardcoded which are not in database
            sending_business = {
                registered_name: user.first_name || '',
                trading_name: user.first_name || '',
                address: "address",
                postal_code: "123",
                city: "Paris",
                country_iso_code: "FRA",
                registration_number: "123"   //hardcoded for now
            }
        }

        let receiving_business
        if (second_type === 'B') {
            // things hardcoded which are not in database
            receiving_business = {
                registered_name: beneficiary.first_name,
                trading_name: beneficiary.first_name,
                address: "Address",
                postal_code: "12345",
                city: "Singapore",
                country_iso_code: "SGP",
                tax_id: 1234567,
                date_of_incorporation: "",
                representative_lastname: "Doe",
                representative_firstname: "John",
                representative_id_type: "",
                representative_id_country_iso_code: ""
            }
        }

        // C2C
        if (first_type === 'C' && second_type === "C") {
            // all the fields we can send in transaction
            // all the mandotory fields have values in them , i have still kept the others so that i can easily update it later when the database is updated
            requestData = {
                retail_rate: "",
                additional_information_1: additional_information,
                purpose_of_remittance: purpose_of_remittance,
                callback_url: "",
                retail_fee_currency: "",
                external_code: "",
                credit_party_identifier: credit_party_identifier,
                retail_fee: "",
                external_id: transactionExternalID,
                sender: sender_obj,
                beneficiary: beneficiary_obj,
                callback_url: "https://webhook.site/56f869ff-bac3-4ba0-b269-c0ece549eba5",

            };
        }

        // B2C
        if (first_type === 'B' && second_type === "C") {
            // all the fields we can send in transaction
            // all the mandotory fields have values in them , i have still kept the others so that i can easily update it later when the database is updated
            requestData = {
                retail_rate: "",
                additional_information_1: additional_information,
                purpose_of_remittance: purpose_of_remittance,
                callback_url: "",
                retail_fee_currency: "",
                external_code: "",
                credit_party_identifier: credit_party_identifier,
                retail_fee: "",
                external_id: transactionExternalID,
                sending_business: sending_business,
                beneficiary: beneficiary_obj,
                callback_url: "https://webhook.site/56f869ff-bac3-4ba0-b269-c0ece549eba5",

            };
        }
        // B2B
        if (first_type === 'B' && second_type === "B") {
            // all the fields we can send in transaction
            // all the mandotory fields have values in them , i have still kept the others so that i can easily update it later when the database is updated
            requestData = {
                retail_rate: "",
                additional_information_1: additional_information,
                purpose_of_remittance: purpose_of_remittance,
                callback_url: "",
                retail_fee_currency: "",
                external_code: "",
                credit_party_identifier: credit_party_identifier,
                retail_fee: "",
                external_id: transactionExternalID,
                sending_business: sending_business,
                receiving_business: receiving_business,
                document_reference_number: 123,       // hardcoded for now
                callback_url: "https://webhook.site/56f869ff-bac3-4ba0-b269-c0ece549eba5",

            };
        }

        // B2C
        if (first_type === 'C' && second_type === "B") {
            // all the fields we can send in transaction
            // all the mandotory fields have values in them , i have still kept the others so that i can easily update it later when the database is updated
            requestData = {
                retail_rate: "",
                additional_information_1: additional_information,
                purpose_of_remittance: purpose_of_remittance,
                callback_url: "",
                retail_fee_currency: "",
                external_code: "",
                credit_party_identifier: credit_party_identifier,
                retail_fee: "",
                external_id: transactionExternalID,
                sender: sender_obj,
                receiving_business: receiving_business,
                callback_url: "https://webhook.site/56f869ff-bac3-4ba0-b269-c0ece549eba5",

            };
        }

        const authHeader = `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`;
        const config = {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        };

        const response = await axios.post(API_URL, requestData, config);
        const transactionResult = response.data;

        // converting the times into human readbale 
        const humanReadableCreationDate = moment(transactionResult.creation_date).format('MMMM Do YYYY, h:mm a');
        const humanReadableExpirationDate = moment(transactionResult.expiration_date).format('MMMM Do YYYY, h:mm a');

        // filtering and keeping the fields which need to be shown
        const outputData = {
            TransactionID: transactionExternalID,
            additional_information_1: transactionResult.additional_information_1,
            sender: {
                ...transactionResult.sender,
            },
            beneficiary: {
                ...transactionResult.beneficiary,
            },
            creation_date: humanReadableCreationDate,
            credit_party_identifier: {
                ...transactionResult.credit_party_identifier,
            },
            destination: {
                ...transactionResult.destination,
            },
            expiration_date: humanReadableExpirationDate,
            payer: {
                ...transactionResult.payer,
            },
            purpose_of_remittance: transactionResult.purpose_of_remittance,
            sent_amount: {
                ...transactionResult.sent_amount,
            },
            source: {
                ...transactionResult.source,
            },
            status_message: transactionResult.status_message,
            transaction_type: transactionResult.transaction_type,
            wholesale_fx_rate: transactionResult.wholesale_fx_rate,
        };


        const decodedToken = jwt.verify(token, secretKey);
        //console.log(token)
        let total = decodedToken.result.total

        const payload = {
            TransactionID: transactionExternalID,
            total: total,
            wallet_id: wallet_id,
            status_message: transactionResult.status_message,
            user_id: user_id
        };

        const options = {
            expiresIn: '1h',
        };         // not expiring the token right now

        const new_token = jwt.sign(payload, secretKey);

        res.json({ Status: "true", message: "Transaction Created", token: new_token });

    } catch (error) {
        console.error('Error creating transaction:', error);

        if (error.response && error.response.data && error.response.data.errors) {
            // not showing the error messages by thunes thats why commented
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');

            //     const errorCodes = error.response.data.errors.map(error => error.code); // Extract all error codes by thunes

            //   const encryptedError = await encryption(errorCodes.join(', '));

            res.status(error.response.status).send({ Status: "false", message: errorMessages });
        } else {
            res.status(500).send({ Status: "false", message: 'An error occurred while creating the transaction' });
        }
    }
};

// In thunes we have to use this function after creating a transaction to confirm it 
exports.confirmTransaction = async (req, res) => {
    try {

        const requestedData = req.body;

        // required information to make a transaction
        token = requestedData.token;

        const decodedToken = jwt.verify(token, secretKey);

        const {
            TransactionID,
            total,
            wallet_id,
            user_id,
            status_message,
        } = decodedToken;

        //console.log(decodedToken)

        const wallet = await Wallet.findOne({ _id: wallet_id }).populate('account')
        if (!wallet) {
            res.json("Wallet not found");
        }

        const balance = wallet.balance.available

        const account = await Account.findOne({ _id: wallet.account.id })
        if (!account) {
            res.json("account not found");
        }

        const daily_limit = account.daily_limit.sending_limit_used
        const monthly_limit = account.monthly_limit.sending_limit_used
        const yearly_limit = account.yearly_limit.sending_limit_used

        if (total > balance) {
            return res.json(`Insufficient Balance, your current balance in this wallet is ${balance}`);
        }

        if (total > daily_limit) {
            return res.json(`Amount is more than the reamining daily sending limit`);
        }

        if (total > monthly_limit) {
            return res.json('Amount is more than the reamining monthly sending limit');
        }

        if (total > yearly_limit) {
            return res.json(`Amount is more than the reamining yearly sending limit`);
        }

        const transactionId = TransactionID;
        const API_URL = `https://api-mt.pre.thunes.com/v2/money-transfer/transactions/ext-${transactionId}/confirm`;

        const config = {
            headers: {
                'Authorization': `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/json'
            }
        };

        // req_body = {
        //   callback_url: "https://webhook.site/56f869ff-bac3-4ba0-b269-c0ece549eba5",
        // }

        const response = await axios.post(API_URL, {}, config);
        const confirmationResult = response.data;

        // converting the creation time in readable format
        const humanReadableCreationDate = moment(confirmationResult.creation_date).format('MMMM Do YYYY, h:mm a');

        // // only keeping important fields
        const outputData = {
            TransactionID: transactionId,
            status_message: confirmationResult.status_message
        }
        //     additional_information_1: confirmationResult.additional_information_1,
        //     sender: {
        //       ...confirmationResult.sender,
        //     },
        //     beneficiary: {
        //       ...confirmationResult.beneficiary,
        //     },
        //     creation_date: humanReadableCreationDate,
        //     credit_party_identifier: {
        //       ...confirmationResult.credit_party_identifier,
        //     },
        //     destination: {
        //       ...confirmationResult.destination,
        //     },
        //     payer: {
        //       ...confirmationResult.payer,
        //     },
        //     purpose_of_remittance: confirmationResult.purpose_of_remittance,
        //     sent_amount: {
        //       ...confirmationResult.sent_amount,
        //     },
        //     source: {
        //       ...confirmationResult.source,
        //     },
        //     transaction_type: confirmationResult.transaction_type,
        //     wholesale_fx_rate: confirmationResult.wholesale_fx_rate,
        //   };


        if (confirmationResult.status_message === 'CONFIRMED') {
            wallet.balance.available = balance - total;
            await wallet.save();

            account.daily_limit.sending_limit_used = daily_limit + total
            account.monthly_limit.sending_limit_used = monthly_limit + total
            account.yearly_limit.sending_limit_used = yearly_limit + total
            await account.save();

        }
        res.json({ Status: "true", TransactionID: outputData.TransactionID, status_message: outputData.status_message });

    } catch (error) {
        console.error('Error confirming transaction:', error);

        if (error.response && error.response.data && error.response.data.errors) {

            //  not showing the error messages by thunes thats why commented
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');

            //   const encryptedError = await encryption(errorMessages);

            // const errorCodes = error.response.data.errors.map(error => error.code); // Extract all error codes by thunes

            // const encryptedError = await encryption(errorCodes.join(', '));

            res.status(error.response.status).send({ Status: "true", message: error.message });
        } else {
            res.status(500).send({ Status: "false", message: 'An error occurred while confirming the transaction' });
        }
    }
};

// get the status of the transaction
exports.getStatus = async (req, res) => {
    try {
        const transactionId = req.body.TransactionID;
        const API_URL = `https://api-mt.pre.thunes.com/v2/money-transfer/transactions/ext-${transactionId}`;

        console.log(transactionId)
        const config = {
            headers: {
                'Authorization': `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/json'
            }
        };

        const response = await axios.get(API_URL, config);
        const transactionDetails = response.data;

        // converting time into human readable format
        const humanReadableCreationDate = moment(transactionDetails.creation_date).format('MMMM Do YYYY, h:mm a');


        // only keeping important fields
        const outputData = {
            TransactionID: transactionId,
            status_message: transactionDetails.status_message
        }
        //   additional_information_1: transactionDetails.additional_information_1,
        //   sender: {
        //     ...transactionDetails.sender,
        //   },
        //   beneficiary: {
        //     ...transactionDetails.beneficiary,
        //   },
        //   creation_date: humanReadableCreationDate,
        //   credit_party_identifier: {
        //     ...transactionDetails.credit_party_identifier,
        //   },
        //   destination: {
        //     ...transactionDetails.destination,
        //   },
        //   payer: {
        //     ...transactionDetails.payer,
        //   },
        //   purpose_of_remittance: transactionDetails.purpose_of_remittance,
        //   sent_amount: {
        //     ...transactionDetails.sent_amount,
        //   },
        //   source: {
        //     ...transactionDetails.source,
        //   },

        //   transaction_type: transactionDetails.transaction_type,
        //   wholesale_fx_rate: transactionDetails.wholesale_fx_rate,
        // };

        res.json({ Status: "true", TransactionID: outputData.TransactionID, status_message: outputData.status_message });

    } catch (error) {
        console.error('Error getting status:', error);

        if (error.response && error.response.data && error.response.data.errors) {

            //  not showing the error messages by thunes thats why commented
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');

            //   const encryptedError = await encryption(errorMessages);

            const errorCodes = error.response.data.errors.map(error => error.code); // Extract all error codes by thunes

            //const encryptedError = await encryption(errorCodes.join(', '));

            res.status(error.response.status).send({ Status: "false", message: error.message });
        } else {
            res.status(500).send({ Status: "false", message: 'An error occurred while getting the status' });
        }
    }
};

exports.setPassword = async (req, res) => {
    // const { password, platform, recipientId } = req.body
    const { password, platform, recipientId } = await decryption(req.body.data);

    if (!password || !platform || !recipientId) {
        let error = await encryption({ status: false, message: "Required fields are missing!" });
        return res.status(400).send(error);
    }

    try {
        const encryptedNewPassword = CryptoJS.AES.encrypt(password, process.env.PASSWORD_ENCRYPTION_KEY).toString();

        let selectedLanguage;
        let bot;
        if (platform === "instagram") {

            bot = await InstaChatbotModel.findOne({ recipient: recipientId });

            if (bot.registeration.temp_password) {
                let error = await encryption({ status: false, message: "Password already set!" });
                return res.status(400).send(error);
            }

            selectedLanguage = bot?.active_language || "en";
            bot.registeration.temp_password = encryptedNewPassword;
            await bot.save();

        } else if (platform === "telegram") {
            bot = await TelegramBotModel.findOne({ recipient: recipientId });

            if (bot.registeration.temp_password) {
                let error = await encryption({ status: false, message: "Password already set!" });
                return res.status(400).send(error);
            }

            selectedLanguage = bot?.selected_language || "en";
            bot.registeration.temp_password = encryptedNewPassword;
            await bot.save();
        } else {
            let ciphertext = await encryption({ status: false, message: "Invalid platform" })
            return res.status(400).send(ciphertext);
        }

        if (platform === "instagram") {
            const templatePayload = {
                template_type: "generic",
                elements: [
                    {
                        title: 'Your password has been set successfully!',
                        image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                        buttons: [
                            {
                                type: "postback",
                                title: lang[selectedLanguage].CONTINUE,
                                payload: "register_terms",
                            },
                        ],
                    },
                ]
            };

            const data = {
                sender: {
                    id: recipientId
                }
            }

            await sendTemplate(data, recipientId, templatePayload, "register_nousername")
            let ciphertext = await encryption({ status: true, message: "Password updated successfully!" });
            return res.status(200).send(ciphertext);
        } else if (platform === "telegram") {
            const buttons = [
                [{ text: lang[selectedLanguage].CONTINUE, callback_data: "register_terms" }],
            ];
            await sendPhoto(recipientId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Explore%20More.png");
            await sendButtons(recipientId, 'Your password has been set successfully!', buttons);
            let ciphertext = await encryption({ status: true, message: "Password updated successfully!" });
            return res.status(200).send(ciphertext);
        }

    } catch (error) {
        console.log(error);
        let ciphertext = await encryption({ status: false, message: "Something went wrong!" });
        return res.status(500).send(ciphertext);
    }
}

exports.setAccountPin = async (req, res) => {

    // const { pin, platform, account_id } = req.body;
    const { pin, platform, account_id } = await decryption(req.body.data);

    if (!pin || !platform || !account_id) {
        let error = await encryption({ status: false, message: "Required fields are missing!" });
        return res.status(400).send(error);
    }

    if (!/^\d{4}$/.test(pin)) {
        let error = await encryption({ status: false, message: "PIN must be exactly 4 digits!" });
        return res.status(400).send(error);
    }

    try {
        const accountDetails = await Account.findById(account_id);

        if (!accountDetails) {
            let error = await encryption({ status: false, message: "Account not found!" });
            return res.status(404).send(error);
        }

        if (accountDetails?.pin) {
            let error = await encryption({ status: false, message: "PIN already set!" });
            return res.status(400).send(error);
        }

        const encryptedPin = CryptoJS.AES.encrypt(pin, process.env.PASSWORD_ENCRYPTION_KEY).toString();

        let selectedLanguage;
        let bot;
        if (platform === "instagram") {

            bot = await InstaChatbotModel.findOne({ recipient: accountDetails.insta_subscriber_id });
            selectedLanguage = bot?.active_language || "en";

        } else if (platform === "telegram") {
            bot = await TelegramBotModel.findOne({ recipient: accountDetails.telegram_id });
            selectedLanguage = bot?.selected_language || "en";
        } else {
            let ciphertext = await encryption({ status: false, message: "Invalid platform" });
            return res.status(400).send(ciphertext);
        }

        accountDetails.pin = encryptedPin;
        accountDetails.pin_status = true;
        await accountDetails.save();

        if (platform === "instagram") {
            const templatePayload = {
                template_type: "generic",
                elements: [
                    {
                        title: 'Your PIN has been set successfully!',
                        image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Coonect%20to%20instapay.png",
                        subtitle: lang[selectedLanguage].CONGRATS_INSTAPAY_READY.replace('{{username}}', accountDetails.username),
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

            const data = {
                sender: {
                    id: bot.recipient
                }
            };

            await sendTemplate(data, bot.recipient, templatePayload, "4");
            let ciphertext = await encryption({ status: true, message: "PIN updated successfully!" });
            return res.status(200).send(ciphertext);
        } else if (platform === "telegram") {
            const buttons = [
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
            ];
            await sendPhoto(bot.recipient, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png");
            await sendButtons(bot.recipient, lang[selectedLanguage].CONGRATS_INSTAPAY_READY.replace('{{username}}', accountDetails.username), buttons, "4");
            let ciphertext = await encryption({ status: true, message: "PIN updated successfully!" });
            return res.status(200).send(ciphertext);
        }

    } catch (error) {
        console.log(error);
        let ciphertext = await encryption({ status: false, message: "Something went wrong!" });
        return res.status(500).send(ciphertext);
    }
};

exports.verifyPin = async (req, res) => {
    try {
        const { account_id, pin, platform } = await decryption(req.body.data);
        // const { account_id, pin, platform } = req.body;

        const account = await Account.findById(account_id).populate("insta_recipient_id");
        if (!account) {
            const error = await encryption({
                status: false,
                message: "Account not found."
            });
            return res.status(404).send(error);
        }

        if (!account.pin) {
            const error = await encryption({
                status: false,
                message: "No PIN set for this account."
            });
            return res.status(400).send(error);
        }

        if (account?.pin_attempts >= 4) {
            const error = await encryption({
                status: false,
                message: "Maximum PIN attempts exceeded. Please contact support."
            });
            return res.status(403).send(error);
        }

        const decryptedPin = CryptoJS.AES.decrypt(account.pin, process.env.PASSWORD_ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);

        if (decryptedPin !== pin) {
            account.pin_attempts = (account?.pin_attempts || 0) + 1;
            await account.save();

            const error = await encryption({
                status: false,
                message: "Incorrect PIN. Please try again."
            });
            return res.status(401).send(error);
        }

        account.pin_attempts = 0;
        if (platform && platform === "telegram") {
            const telegramBot = await TelegramBotModel.findOne({ recipient: account?.telegram_id });
            if (!telegramBot) {
                const error = await encryption({
                    status: false,
                    message: "Telegram bot not found."
                });
                return res.status(404).send(error);
            }

            // already logged in validation
            // if (telegramBot?.loggedOut === false) {
            //     const error = await encryption({
            //         status: false,
            //         message: "You are already logged in."
            //     });
            //     return res.status(400).send(error);
            // }

            telegramBot.loggedOut = false;
            telegramBot.last_message_time = new Date();

            await telegramBot.save();
            await account.save()
            const selectedLanguage = telegramBot?.selected_language || account?.language || "en";

            await mainMenuKeyboardMessage(account?.telegram_id, selectedLanguage, telegramBot);
        } else {

            // already logged in validation
            // if (account.insta_recipient_id?.loggedOut === false) {
            //     const error = await encryption({
            //         status: false,
            //         message: "You are already logged in."
            //     });
            //     return res.status(400).send(error);
            // }

            account.insta_recipient_id.last_message_time = new Date()
            account.insta_recipient_id.loggedOut = false;

            await account.save();
            await account.insta_recipient_id.save()

            const selectedLanguage = account?.insta_recipient_id?.active_language || "en";

            const data1 = {
                sender: {
                    id: account?.insta_subscriber_id
                }
            };

            await mainMenuMessage(data1, account?.insta_subscriber_id, account.insta_recipient_id, selectedLanguage);
        }

        res.status(200).send(await encryption({
            status: true,
            message: "PIN verified successfully."
        }));

    } catch (err) {
        console.error(err);
        const errResponse = await encryption({
            status: false,
            message: "Something went wrong!",
        });
        return res.status(500).send(errResponse);
    }
};

exports.setQrPayWallet = async (req, res) => {
    try {
        const { token, platform, recipientId } = await decryption(req.body.data);
        // const { token, platform, recipientId } = req.body;

        if (!token || !platform || !recipientId) {
            let errorMessage = await encryption({
                status: false,
                message: "Required fields are missing!"
            });
            return res.status(400).send(errorMessage);
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.jwtKey)
        } catch (err) {
            console.log(err)
            let errorMessage = await encryption({
                status: false,
                message: "Invalid or expired token!"
            });
            return res.status(400).send(errorMessage);
        }

        const walletId = decoded.wallet_id;

        const walletDetails = await getActiveWallet(walletId)

        if (!walletDetails) {
            let errorMessage = await encryption({
                status: false,
                message: "Wallet not found!"
            });
            return res.status(400).send(errorMessage);
        }

        if (platform === "telegram") {
            const telegramBot = await TelegramBotModel.findOne({ recipient: recipientId });
            const selectedLanguage = telegramBot?.selected_language || walletDetails?.account?.language || "en";

            if (!telegramBot) {
                const error = await encryption({
                    status: false,
                    message: "Telegram bot not found."
                });
                return res.status(404).send(error);
            }
            const walletInfo = `
${lang[selectedLanguage].USERNAME_LABEL}: ${walletDetails?.account?.username}
${lang[selectedLanguage].COUNTRY_LABEL}: ${walletDetails.account.country_name}
${lang[selectedLanguage].WALLET_NAME}: ${walletDetails.wallet_id}
${lang[selectedLanguage].WALLET_CURRENCY_LABEL}: ${walletDetails.currency.code}
`;

            telegramBot.wallet_to_wallet.receiving_wallet = walletId;
            await telegramBot.save();

            await sendPhoto(recipientId, walletDetails?.account?.profileImage?.url || "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Explore%20More.png", `${walletDetails?.account?.first_name} ${walletDetails?.account?.last_name}`);

            await sendButtons(recipientId, `${walletInfo}\n${lang[selectedLanguage].PROCEED}`, [
                [{ text: lang[selectedLanguage].YES, callback_data: "qr_pay_yes" }],
                [{ text: lang[selectedLanguage].NO, callback_data: "qr_pay" }],
                [{ text: lang[selectedLanguage].SCAN_AGAIN, url: `https://my.insta-pay.ch/quick-qrpay?bot=telegram&bot_id=${recipientId}` }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
            ], "qr_pay_yes");

            res.status(200).send(await encryption({
                status: true,
                message: "QR code sent successfully."
            }))
        } else if (platform === "instagram") {
            const instaChatbot = await InstaChatbotModel.findOne({ recipient: recipientId });

            const selectedLanguage = instaChatbot?.active_language || walletDetails?.account?.language || "en";

            if (!instaChatbot) {
                const error = await encryption({
                    status: false,
                    message: "Instachat bot not found."
                });
                return res.status(404).send(error);
            }

            const userName = walletDetails?.account?.account_type === "individual" ? walletDetails?.account?.first_name + " " + walletDetails?.account?.last_name : walletDetails?.account?.company_name
            const walletInfo = `${lang[selectedLanguage].PROCEED}`;

            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].YES, payload: "qr_pay_code_yes" },
                { content_type: "text", title: lang[selectedLanguage].NO, payload: "qr_pay_code_no" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
            ]
            instaChatbot.qr_receiving_wallet = walletDetails?.wallet_id;
            await instaChatbot.save()

            const subtitleMsg = `
${lang[selectedLanguage].USERNAME_LABEL}: ${walletDetails?.account?.username}
${lang[selectedLanguage].COUNTRY_LABEL}: ${walletDetails?.account?.country_name}
${lang[selectedLanguage].WALLET_NAME}: ${walletDetails.wallet_id}
${lang[selectedLanguage].WALLET_CURRENCY_LABEL}: ${walletDetails.currency.code}
`;

            const templatePayload = {
                template_type: "generic",
                elements: [
                    {
                        title: userName,
                        subtitle: subtitleMsg,
                        image_url: walletDetails?.account?.profileImage?.url,
                        buttons: [
                            {
                                type: "web_url",
                                title: lang[selectedLanguage].VIEW_PROFILE_BUTTON,
                                url: `https://my.insta-pay.ch/profile/${walletDetails?.account?.username}`,
                                webview_height_ratio: "full"
                            },
                            {
                                type: "web_url",
                                title: lang[selectedLanguage].SCAN_AGAIN,
                                url: `https://my.insta-pay.ch/quick-qrpay?bot=instagram&bot_id=${recipientId}`,
                                webview_height_ratio: "full"
                            }
                        ],
                    },
                ]
            };
            const data = {
                sender: {
                    id: recipientId
                }
            }
            await sendTemplate(data, recipientId, templatePayload, "4")
            await quickReply(data, walletInfo, quickReplies);

            res.status(200).send(await encryption({
                status: true,
                message: "QR code sent successfully."
            }))
        }

    } catch (err) {
        console.error(err);
        const errResponse = await encryption({
            status: false,
            message: "Something went wrong!",
        });
        return res.status(500).send(errResponse);
    }
};



