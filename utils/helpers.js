
const axios = require('axios');
const jwt = require('jsonwebtoken');
// var lookup = require('binlookup')('dZsJyp3C6W6KIgsc32LPl8DG6rsvMFgf89G0tBPD');
const { addNotification } = require('../utils/generateNotification');
const { sendPrivateMessage } = require('../utils/websocket');
const mongoose = require('mongoose');
const Wallet = require('../models/Wallet.model');
const Account = require('../models/Account.model');
const AccountLevel = require('../models/Account-Level.model');
const facebook_access_token = process.env.facebook_access_token
const CryptoJS = require("crypto-js");

const Transaction = require('../models/Transaction.model');
const InstaChatbotModel = require('../models/InstaChatbot.model');
const Fee = require('../models/Fee.model');

const { sendNotifications } = require('../utils/sendEmail');
const lang = require('../utils/languages/languages.json');

const Country = require('../models/Country.model');

const AWS = require('aws-sdk');
const moment = require('moment-timezone');
const momentTime = require('moment');

const countries_iso2 = require('../utils/countries_iso2.json');
const templates = require('../utils/emailTemplateIDs.json');
const purposes = require('../utils/purposes.json')
const CommissionModel = require('../models/Commission.model');
const { updateUsedLimits, topUpFeeCalculation } = require('./conversion');
const RequestPaymentModel = require('../models/Request-Payment.model');
const QuotationModel = require('../models/Quotation.model');
const { formatDecimalNumbersWithLimit } = require('./payerRates');
const supportedCurrencies = require("../utils/paypalSupportedCurrencies.json");
const Log = require('../models/Log.model');
const Schedule = require('../models/Schedule.model');

const countryCurrencyJson = require('../utils/countries/country.json');
const countries = require("../utils/countries/CitiesData.json")
const { encryption } = require('../configurations/Encryption');
const VCCTransactionModel = require('../models/VCC-Transaction.model');
const { encryptDataVCC, decryptDataVCC } = require('../configurations/EncryptionVCC');
const VirtualCardModel = require('../models/Virtual-Card.model');
const PanModel = require('../models/Pan.model');

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();

// const Thunes_KEY = process.env.APIKEY;
// const Thunes_SECRET = process.env.APISECRET;
const Thunes_KEY = process.env.API_KEY_PROD;
const Thunes_SECRET = process.env.API_SECRET_PROD;
const secretKey = process.env.jwtKey;

const accountSid = `${process.env.TWILIO_ACCOUNT_SID}`;//'ACd27647d39bbcec466a22096459a14297'
const authToken = `${process.env.TWILIO_AUTH_TOKEN}`;//'932acb397d9d66f41d076f5a2b873143'

const baseURL = process.env.vccdaddyURL
const token = process.env.vccToken;

const client = require('twilio')(accountSid, authToken);
const prodAuthHeader = `Basic ${Buffer.from(`72718b4b-87bc-4b9f-bb33-fde786794e43:2e541546-8b87-465d-b6b3-01d3443c1ea9`).toString('base64')}`;


async function updateLastMessage(data, lastMessage) {
    try {
        console.log(data, lastMessage, "datainside")
        const timestamp = data?.timestamp;
        const timesStamp = timestamp ? new Date(timestamp) : new Date();
        console.log(timesStamp, "timesStamp")
        let instaChatbot = await InstaChatbotModel.findOne({ recipient: data?.sender?.id });
        if (instaChatbot) {
            instaChatbot.last_message = lastMessage;
            instaChatbot.last_message_time = timesStamp
            await instaChatbot.save();
        } else {
            await new InstaChatbotModel({ recipient: data?.sender?.id, last_message: lastMessage, last_message_time: timesStamp }).save();
        }
    } catch (error) {
        console.error('Error updating last message:', error);
    }
}

async function sendTemplate(data, recipientId, templatePayload, lastMessage) {
    console.log(recipientId, "recipientId")
    const url = `https://graph.facebook.com/v12.0/me/messages`;
    const body = {
        recipient: {
            id: recipientId,
        },
        message: {
            attachment: {
                type: "template",
                payload: templatePayload,
            },
        },
    };

    try {
        const response = await axios.post(url, body, {
            params: {
                access_token: facebook_access_token,
            },
        });
        console.log('Template message sent successfully:', response.data);
        if (lastMessage) {

            await updateLastMessage(data, lastMessage);
        }
    } catch (error) {
        console.error('Error sending template message:', error.response ? error.response.data : error.message);
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
            console.log(feeDetails, "feeDetails")
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
                let feeExchange = await getExchangeRatesToUSD(fee_currency, from, fee) // falt markup, percent markup, 
                let markup = await calculateMarkup(amount, feeDetails, exchangeRate)
                console.log(markup, "markuping");
                exchangeRate.data['fee'] = {
                    fee_type: feeDetails.fee_type,
                    exchange_fee: feeExchange,
                    fee: fee,
                    currency: from
                }
                exchangeRate.data['markup'] = {
                    markup_type: feeDetails.markup_type,
                    markup,
                    currency: from
                }
                // exchangeRate.data['exchanged_amount'] = exchangedAmount - markup - feeInReceivingCurrency;
                console.log(exchangeRate.data['exchanged_amount'], "exchangeRate.data['exchanged_amount']", markup, "markup", feeExchange, "feeExchange", exchangedAmount)
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

async function calculateMarkup(amount, feeDetails, exchangeRate) {
    console.log(exchangeRate, "exchangeRate", feeDetails, "feeDetails")
    let exchange_rate_with_markup = 0;

    // if (markup_type === 'flat') {
    //     if (markup_currency === thune_currency) {
    //         markup = markup_fee
    //     }
    //     else {
    //         rate = await convertCurrency(markup_currency, thune_currency, 1)
    //         markup = markup_fee * rate
    //     }

    //     exchange_rate_with_markup = exchange_rate - (exchange_rate * markup)
    // }
    console.log(feeDetails.markup_type, "feeDetails.markup_type")
    if (feeDetails.markup_type === 'percentage') {

        difference = exchangeRate.data.new_rate * (feeDetails.percentage_markup / 100)
        console.log(difference, "difference", feeDetails.percentage_markup, "feeDetails.percentage_markup", exchangeRate.data.new_rate)
        // markup = (exchange_rate - ((percentage_markup / 100) * exchange_rate))
        // exchange_rate_with_markup = markup = exchangeRate.data.exchanged_amount - difference
        exchange_rate_with_markup = exchangeRate.data.result - difference
    }

    console.log(exchange_rate_with_markup, "exchange_rate_with_markup", exchangeRate.data.result, "exchangeRate.data.exchanged_amount")

    return exchange_rate_with_markup;
    // return 0.9
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

async function featureCheck(param1, param2, level) {
    console.log(param1, param2, level, "param1, param2, level");
    return level[param1][param2];
}

function limitCheck(amount, level, userData, type) {

    let daily_sending_limit_used = userData?.used_limits?.daily_sending_limit >= 0 ? userData.used_limits.daily_sending_limit : 0;
    let daily_receiving_limit_used = userData?.used_limits?.daily_receiving_limit >= 0 ? userData.used_limits.daily_receiving_limit : 0;

    let monthly_sending_limit_used = userData?.used_limits?.monthly_sending_limit >= 0 ? userData.used_limits.monthly_sending_limit : 0;
    let monthly_receiving_limit_used = userData?.used_limits?.monthly_receiving_limit >= 0 ? userData.used_limits.monthly_receiving_limit : 0;

    let yearly_sending_limit_used = userData?.used_limits?.yearly_sending_limit >= 0 ? userData.used_limits.yearly_sending_limit : 0;
    let yearly_receiving_limit_used = userData?.used_limits?.yearly_receiving_limit >= 0 ? userData.used_limits.yearly_receiving_limit : 0;

    let daily_transaction_count_used = userData?.used_limits?.daily_transaction_count >= 0 ? userData.used_limits.daily_transaction_count : 0;
    let monthly_transaction_count_used = userData?.used_limits?.monthly_transaction_count >= 0 ? userData.used_limits.monthly_transaction_count : 0;
    let yearly_transaction_count_used = userData?.used_limits?.yearly_transaction_count >= 0 ? userData.used_limits.yearly_transaction_count : 0;

    console.log({
        amount,
        daily_sending_limit_used,
        monthly_sending_limit_used,
        yearly_sending_limit_used,
        daily_transaction_count_used,
        monthly_transaction_count_used,
        yearly_transaction_count_used,
        daily: level.daily_sending_limit,
        monthly: level.monthly_sending_limit,
        yearly: level.yearly_sending_limit
    });

    let daily_sending_limit;
    let monthly_sending_limit;
    let yearly_sending_limit;
    let daily_receiving_limit;
    let monthly_receiving_limit;
    let yearly_receiving_limit;
    let transaction_amount_limit;
    let daily_transaction_count;
    let monthly_transaction_count;
    let yearly_transaction_count;
    let topup_min_amount;
    let topup_max_amount;

    if (!userData.is_external_limit) {
        daily_sending_limit = level.daily_sending_limit;
        monthly_sending_limit = level.monthly_sending_limit;
        yearly_sending_limit = level.yearly_sending_limit;
        daily_receiving_limit = level.daily_receiving_limit;
        monthly_receiving_limit = level.monthly_receiving_limit;
        yearly_receiving_limit = level.yearly_receiving_limit;
        transaction_amount_limit = level.transaction_amount_limit;
        daily_transaction_count = level.daily_transaction_count;
        monthly_transaction_count = level.monthly_transaction_count;
        yearly_transaction_count = level.yearly_transaction_count;
        topup_min_amount = level.topup_min_amount;
        topup_max_amount = level.topup_max_amount;
    } else {
        daily_sending_limit = userData.external_limits.daily_sending_limit
        monthly_sending_limit = userData.external_limits.monthly_sending_limit
        yearly_sending_limit = userData.external_limits.yearly_sending_limit
        daily_receiving_limit = userData.external_limits.daily_receiving_limit
        monthly_receiving_limit = userData.external_limits.monthly_receiving_limit
        yearly_receiving_limit = userData.external_limits.yearly_receiving_limit
        transaction_amount_limit = userData.external_limits.transaction_amount_limit
        daily_transaction_count = userData.external_limits.daily_transaction_count
        monthly_transaction_count = userData.external_limits.monthly_transaction_count
        yearly_transaction_count = userData.external_limits.yearly_transaction_count
        topup_min_amount = userData.external_limits.topup_min_amount
        topup_max_amount = userData.external_limits.topup_max_amount
    }

    if (type === 'sending') {
        console.log("Checking sending limits...",
            monthly_sending_limit, ">=", amount, "+", monthly_sending_limit_used,
            yearly_sending_limit, ">=", amount, "+", yearly_sending_limit_used);
        if (daily_sending_limit >= amount + daily_sending_limit_used &&
            monthly_sending_limit >= amount + monthly_sending_limit_used &&
            yearly_sending_limit >= amount + yearly_sending_limit_used &&
            transaction_amount_limit >= amount &&
            daily_transaction_count > daily_transaction_count_used &&
            monthly_transaction_count > monthly_transaction_count_used &&
            yearly_transaction_count > yearly_transaction_count_used) {

            console.log('limitCheck: true');
            return { status: true, code: 'OK' };
        } else {

            console.log("Sending limit failed. Checking specific conditions...");
            if (daily_sending_limit < amount + daily_sending_limit_used) {
                console.log('Daily Sending Limit exceeded', { amount, daily_sending_limit, daily_sending_limit_used });
                return { status: false, code: 'sdl400' }; // Daily Sending Limit exceeded
            } else if (monthly_sending_limit < amount + monthly_sending_limit_used) {
                console.log('Monthly Sending Limit exceeded', { amount, monthly_sending_limit, monthly_sending_limit_used });
                return { status: false, code: 'sml400' }; // Monthly Sending Limit exceeded
            } else if (yearly_sending_limit < amount + yearly_sending_limit_used) {
                console.log('Yearly Sending Limit exceeded', { amount, yearly_sending_limit, yearly_sending_limit_used });
                return { status: false, code: 'syl400' }; // Yearly Sending Limit exceeded
            } else if (transaction_amount_limit < amount) {
                console.log('Transaction Amount Limit exceeded', { amount, transaction_amount_limit });
                return { status: false, code: 'tal400' }; // Transaction Amount Limit exceeded
            } else if (daily_transaction_count < daily_transaction_count_used) {
                console.log('Daily Transaction Count Limit exceeded', { daily_transaction_count, daily_transaction_count_used });
                return { status: false, code: 'dtc400' }; // Daily Transaction Count Limit exceeded
            } else if (monthly_transaction_count < monthly_transaction_count_used) {
                console.log('Monthly Transaction Count Limit exceeded', { monthly_transaction_count, monthly_transaction_count_used });
                return { status: false, code: 'mtc400' }; // Monthly Transaction Count Limit exceeded
            } else if (yearly_transaction_count < yearly_transaction_count_used) {
                console.log('Yearly Transaction Count Limit exceeded', { yearly_transaction_count, yearly_transaction_count_used });
                return { status: false, code: 'ytc400' }; // Yearly Transaction Count Limit exceeded
            }
        }
    } else if (type === 'topup') {
        console.log("Checking topup limits...");
        if (daily_receiving_limit >= (amount + daily_receiving_limit_used) &&
            monthly_receiving_limit >= (amount + monthly_receiving_limit_used) &&
            yearly_receiving_limit >= (amount + yearly_receiving_limit_used) &&
            topup_min_amount <= amount && amount <= topup_max_amount) {
            console.log('Topup limitCheck: true');
            return { status: true, code: 'OK' };
        } else {
            console.log("Topup limit failed. Checking specific conditions...");
            if (daily_receiving_limit < amount + daily_receiving_limit_used) {
                console.log('Daily Receiving Limit exceeded', { amount, daily_receiving_limit, daily_receiving_limit_used });
                return { status: false, code: 'rdl400' }; //Daily Receiving Limit exceeded
            } else if (monthly_receiving_limit < amount + monthly_receiving_limit_used) {
                console.log('Monthly Receiving Limit exceeded', { amount, monthly_receiving_limit, monthly_receiving_limit_used });
                return { status: false, code: 'rml400' }; //Monthly Receiving Limit exceeded
            } else if (yearly_receiving_limit < amount + yearly_receiving_limit_used) {
                console.log('Yearly Receiving Limit exceeded', { amount, yearly_receiving_limit, yearly_receiving_limit_used });
                return { status: false, code: 'ryl400' }; //Yearly Receiving Limit exceeded
            } else if (topup_min_amount > amount || amount > topup_max_amount) {
                console.log('Topup Amount Limit exceeded', { amount, topup_min_amount, topup_max_amount });
                return { status: false, code: 'tpl400' }; //Topup Amount Limit exceeded
            }
        }
    } else {
        console.log("Checking receiving limits...");
        if (daily_receiving_limit > amount + daily_receiving_limit_used &&
            monthly_receiving_limit > amount + monthly_receiving_limit_used &&
            yearly_receiving_limit > amount + yearly_receiving_limit_used) {
            console.log('Receiving limitCheck: true');
            return { status: true, code: 'OK' };
        } else {
            console.log("Receiving limit failed. Checking specific conditions...");
            if (daily_receiving_limit <= amount + daily_receiving_limit_used) {
                console.log('Daily Receiving Limit exceeded:', { amount, daily_receiving_limit, daily_receiving_limit_used });
                return { status: false, code: 'rdl400' }; // Daily Receiving Limit exceeded
            }

            if (monthly_receiving_limit <= amount + monthly_receiving_limit_used) {
                console.log('Monthly Receiving Limit exceeded:', { amount, monthly_receiving_limit, monthly_receiving_limit_used });
                return { status: false, code: 'rml400' }; // Monthly Receiving Limit exceeded
            }

            if (yearly_receiving_limit <= amount + yearly_receiving_limit_used) {
                console.log('Yearly Receiving Limit exceeded:', { amount, yearly_receiving_limit, yearly_receiving_limit_used });
                return { status: false, code: 'ryl400' }; // Yearly Receiving Limit exceeded
            }
            // else {
            //     return { status: false, code: 'tal400' }; //Transaction Amount Limit exceeded
            // }
        }
    }
}

async function getTopupLimitMessage(statusCode, currencyCode, userData) {
    try {

        const fxRate = formatDecimalNumbersWithLimit(await convertCurrency('USD', currencyCode, 1), 6);

        const limits = userData.is_external_limit ? {
            topup_min_amount: userData.external_limits?.topup_min_amount ?? 0,
            topup_max_amount: userData.external_limits?.topup_max_amount ?? 0,
            daily_receiving_limit: userData.external_limits?.daily_receiving_limit ? formatDecimalNumbersWithLimit(userData.external_limits.daily_receiving_limit * fxRate) : 0,
            monthly_receiving_limit: userData.external_limits?.monthly_receiving_limit ? formatDecimalNumbersWithLimit(userData.external_limits.monthly_receiving_limit * fxRate) : 0,
            yearly_receiving_limit: userData.external_limits?.yearly_receiving_limit ? formatDecimalNumbersWithLimit(userData.external_limits.yearly_receiving_limit * fxRate) : 0,
            transaction_amount_limit: userData.external_limits?.transaction_amount_limit ?? 0
        } : {
            topup_min_amount: userData.level?.topup_min_amount ?? 0,
            topup_max_amount: userData.level?.topup_max_amount ?? 0,
            daily_receiving_limit: userData.level?.daily_receiving_limit ? formatDecimalNumbersWithLimit(userData.level.daily_receiving_limit * fxRate) : 0,
            monthly_receiving_limit: userData.level?.monthly_receiving_limit ? formatDecimalNumbersWithLimit(userData.level.monthly_receiving_limit * fxRate) : 0,
            yearly_receiving_limit: userData.level?.yearly_receiving_limit ? formatDecimalNumbersWithLimit(userData.level.yearly_receiving_limit * fxRate) : 0,
            transaction_amount_limit: userData.level?.transaction_amount_limit ?? 0
        };

        // Get used limits and convert them using the fxRate
        const used_limits = {
            daily: userData?.used_limits?.daily_receiving_limit > 0
                ? formatDecimalNumbersWithLimit(userData.used_limits.daily_receiving_limit * fxRate)
                : 0,

            monthly: userData?.used_limits?.monthly_receiving_limit > 0
                ? formatDecimalNumbersWithLimit(userData.used_limits.monthly_receiving_limit * fxRate)
                : 0,

            yearly: userData?.used_limits?.yearly_receiving_limit > 0
                ? formatDecimalNumbersWithLimit(userData.used_limits.yearly_receiving_limit * fxRate)
                : 0
        };

        const convertedLimits = {
            min: formatDecimalNumbersWithLimit(limits.topup_min_amount * fxRate),
            max: formatDecimalNumbersWithLimit(limits.topup_max_amount * fxRate),
            transaction_amount_limit: formatDecimalNumbersWithLimit(limits.transaction_amount_limit * fxRate),
            daily: formatDecimalNumbersWithLimit((limits.daily_receiving_limit - (formatDecimalNumbersWithLimit(used_limits.daily) || 0))),
            monthly: formatDecimalNumbersWithLimit((limits.monthly_receiving_limit - (formatDecimalNumbersWithLimit(used_limits.monthly) || 0))),
            yearly: formatDecimalNumbersWithLimit((limits.yearly_receiving_limit - (formatDecimalNumbersWithLimit(used_limits.yearly) || 0)))
        };

        const responses = {
            'tpl400': {
                status: 'tpl400',
                value: { min: convertedLimits.min, max: convertedLimits.max },
                message: `Your topup amount limit has been exceeded. It must be greater than ${formattedAmount(convertedLimits.min)} ${currencyCode} and less than ${formattedAmount(convertedLimits.max)} ${currencyCode}.`
            },
            'tal400': {
                status: 'tal400',
                value: convertedLimits.transaction_amount_limit,
                message: `Your transaction amount limit has been exceeded. It must be less than ${formattedAmount(convertedLimits.transaction_amount_limit)} ${currencyCode}.`
            },
            'rdl400': {
                status: 'rdl400',
                value: convertedLimits.daily,
                message: `The daily receiving limit has been reached. Your remaining limit is ${formattedAmount(convertedLimits.daily)} ${currencyCode}. Please try again.`
            },
            'rml400': {
                status: 'rml400',
                value: convertedLimits.monthly,
                message: `The monthly receiving limit has been reached. Your remaining limit is ${formattedAmount(convertedLimits.monthly)} ${currencyCode}. Please try again.`
            },
            'ryl400': {
                status: 'ryl400',
                value: convertedLimits.yearly,
                message: `The yearly receiving limit has been reached. Your remaining limit is ${formattedAmount(convertedLimits.yearly)} ${currencyCode}. Please try again.`
            }
        };

        // Return the appropriate response based on the status code
        const response = responses[statusCode];
        if (response) {
            if (response.value && typeof response.value !== 'object') {
                response.value = formatDecimalNumbersWithLimit(response.value);
            }
            return response;
        }

        // Handle invalid status codes
        return {
            status: 'error',
            value: null,
            message: 'Invalid status code'
        };

    } catch (error) {
        console.error('Error in getTopupLimitMessage:', error);
        return {
            status: 'error',
            value: null,
            message: `Error processing topup limits: ${error.message}`
        };
    }
}

async function balanceLimitCheck(amount, userData) {
    try {
        let userWallets = await Wallet.find({ $and: [{ account: userData._id }, { wallet_type: "insta" }] });
        let arrayOfPromises = [];
        userWallets.map(async (al) => {
            arrayOfPromises.push(getExchangeRates(al.currency.code.toUpperCase(), 'USD', al.balance.available))
        })
        let response = await Promise.all(arrayOfPromises)
        let totalBalanceInUsd = 0;
        await response.map(al => totalBalanceInUsd += al)
        let balanceLimit = userData.level.account_balance_limit
        if (userData.is_external_limit) {
            balanceLimit = userData.external_limits.account_balance_limit;
        }
        if (balanceLimit >= totalBalanceInUsd + amount) {
            return true;
        } else {
            return false;
        }
    } catch (err) {
        return false;
    }


    // Account.updateMany({}, {
    //     $set: {
    //         external_limits: {
    //             account_balance_limit: 10000,
    //             wallet_limit_conversion: 1000,
    //             transaction_amount_limit: 1000,
    //             topup_amount_limit: 1000,
    //             daily_sending_limit: 1000,
    //             monthly_sending_limit: 10000,
    //             yearly_sending_limit: 20000,
    //             daily_receiving_limit: 1000,
    //             monthly_receiving_limit: 10000,
    //             yearly_receiving_limit: 20000,
    //             daily_transaction_count: 100,
    //             monthly_transaction_count: 1000,
    //             yearly_transaction_count: 10000
    //         }
    //     }
    // }).then(sa => { console.log(sa); })
}

async function accountBalanceUsed(userData) {
    try {
        let userWallets = await Wallet.find({ $and: [{ account: userData._id }, { wallet_type: "insta" }] });

        let arrayOfPromises = userWallets.map(al => getExchangeRates(al.currency.code.toUpperCase(), 'USD', al.balance.available));

        let response = await Promise.all(arrayOfPromises);
        let totalBalanceInUsd = response.reduce((acc, value) => acc + value, 0);

        return totalBalanceInUsd;

    } catch (err) {
        console.error("Error in balanceLimitCheck:", err);
        return null;
    }
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

async function sendNotificationHelper(senderWallet, receiverWallet, paymentType, data, totalAmountWithFee, recipient_amount, link, type, purpose) {
    purpose = purposes[purpose] || "OTHER"
    console.log(data, "datainhelper", totalAmountWithFee, recipient_amount)
    const sender_name = senderWallet?.account?.user ?
        senderWallet?.account?.user?.first_name + " " + senderWallet?.account?.user?.last_name :
        senderWallet?.account?.company?.company_name;
    const receiver_name = receiverWallet?.account.user ?
        receiverWallet?.account?.user?.first_name + " " + receiverWallet?.account?.user?.last_name :
        receiverWallet?.account?.company?.company_name;

    let notificationObj = {
        title: 'Wallet to Wallet transaction',
        desc: 'You have received a transaction!',
        type: 'wallet_to_wallet',
        status: 'unread',
        from: senderWallet.account._id,
        to: receiverWallet.account._id,
        link_id: link ?? data._id,
    };

    let templateMsg = ""

    if (paymentType === 'quotation') {
        notificationObj.title = 'Quotation Notification';
        notificationObj.desc = 'Quotation amount received successfully!';
        const senderOptions = {
            toEmail: senderWallet?.account?.email ?? "",
            phoneNumber: senderWallet?.account?.phone ?? "",
            instaUsername: senderWallet?.account?.insta_username ?? "",
            message: `You have sent a quotation of ${senderWallet?.currency?.symbol}${formattedAmount(formatDecimalNumbersWithLimit(totalAmountWithFee))} to ${receiver_name} in Wallet ID ${data?.wallet_id}`,
            subject: "You have sent a quotation in your Instapay Account!",
            templateId: "d-2d5f929ed89847d693ab15621b95890f",
            phoneMessage: `Quotation amount sent of ${senderWallet?.currency?.symbol}${formattedAmount(formatDecimalNumbersWithLimit(totalAmountWithFee))} to ${receiver_name} in Wallet ID ${data?.wallet_id}`
        };
        const receiverOptions = {
            toEmail: receiverWallet?.account?.email ?? "",
            phoneNumber: receiverWallet?.account?.phone ?? "",
            instaUsername: receiverWallet?.account?.insta_username ?? "",
            message: `You have received a quotation of ${receiverWallet?.currency?.symbol}${formattedAmount(formatDecimalNumbersWithLimit(recipient_amount)) || "N/A"} from ${sender_name}`,
            subject: "You have received a quotation in your Instapay Account!",
            templateId: "d-2d5f929ed89847d693ab15621b95890f",
            phoneMessage: `Quotation received of ${receiverWallet?.currency?.symbol}${formattedAmount(formatDecimalNumbersWithLimit(recipient_amount)) || "N/A"} from ${sender_name}`
        };
        templateMsg = receiverOptions.message
        // external notifications
        // await sendNotifications(receiverWallet.account, 'payments', senderOptions);
        // await sendNotifications(senderWallet.account, 'payments', receiverOptions);

        const quotationSendLanguage = 'english';
        const quotationSendtemplateName = 'Quotation accepted';

        const date = new Date();
        const formattedDate = momentTime(date).format('YYYY-MM-DD');

        const templateIdSending = getTemplateId(quotationSendLanguage, quotationSendtemplateName);

        const quotationReceiverLanguage = 'english';
        const quotationReceivertemplateName = 'Quotation accepted';

        const templateIdReceiving = getTemplateId(quotationReceiverLanguage, quotationReceivertemplateName);

        const dynamicDataReceiving = {
            quote_id: data.reference_id,
            receiver_name: sender_name,
            date_accepted: formattedDate,
            total_amount: `${formattedAmount(formatDecimalNumbersWithLimit(recipient_amount)) || "N/A"} ${receiverWallet?.currency?.code}`,
            service_description: "None",
        }

        const receiverDetails = {
            toEmail: receiverWallet?.account?.email,
            templateId: templateIdReceiving,
            phoneNumber: receiverWallet?.account?.phone,
            phoneMessage: `Quotation amount received of ${receiverWallet?.currency?.symbol}${formattedAmount(formatDecimalNumbersWithLimit(recipient_amount)) || "N/A"} from ${sender_name}`,
            dynamicData: dynamicDataReceiving
        }
        // email, phone and push notifications
        await sendNotifications(receiverWallet.account, 'quotation', receiverDetails)
    } else if (paymentType === 'wallet_to_wallet') {
        notificationObj.title = 'Payment Notification';
        notificationObj.desc = 'Payment amount received successfully!';
        // const senderOptions = {
        //     toEmail: senderWallet?.account?.email ?? "",
        //     phoneNumber: senderWallet?.account?.phone ?? "",
        //     instaUsername: senderWallet?.account?.insta_username ?? "",
        //     message: `You have sent a payment of ${senderWallet?.currency?.symbol}${excRate?.otal?.value?.toFixed(2)} to ${receiver_name} in Wallet ID ${data?.wallet_id}`,
        //     subject: "You have sent a payment in your Instapay Account!",
        //     templateId: "d-2d5f929ed89847d693ab15621b95890f",
        //     phoneMessage: `Payment amount sent of ${senderWallet?.currency?.symbol}${excRate?.otal?.value?.toFixed(2)} to ${receiver_name} in Wallet ID ${data?.wallet_id}`
        // };
        const receiverOptions = {
            toEmail: receiverWallet?.account?.email ?? "",
            phoneNumber: receiverWallet?.account?.phone ?? "",
            instaUsername: receiverWallet?.account?.insta_username ?? "",
            message: `You have received a payment of ${receiverWallet?.currency?.symbol}${formattedAmount(formatDecimalNumbersWithLimit(recipient_amount)) || "N/A"} from ${sender_name}`,
            subject: "You have received a payment in your Instapay Account!",
            templateId: "d-2d5f929ed89847d693ab15621b95890f",
        }
        // external notifications
        // await sendNotifications(receiverWallet.account, 'payments', receiverOptions);
        // await sendNotifications(senderWallet.account, 'payments', senderOptions);

        const quotationSendLanguage = 'english';
        const quotationSendtemplateName = 'wallet to wallet transfer(sender)';

        const date = new Date();
        const formattedDate = momentTime(date).format('YYYY-MM-DD');

        const templateIdSending = getTemplateId(quotationSendLanguage, quotationSendtemplateName);

        const quotationReceiverLanguage = 'english';
        const quotationReceivertemplateName = 'wallet to wallet transfer(reciever)';

        const templateIdReceiving = getTemplateId(quotationReceiverLanguage, quotationReceivertemplateName);

        const dynamicDataReceiving = {
            transaction_id: data.reference_id,
            sender_name: sender_name,
            date_time: formattedDate,
            amount: `${formattedAmount(formatDecimalNumbersWithLimit(recipient_amount)) || "N/A"} ${receiverWallet?.currency?.code}`,
            purpose_of_payment: purpose || "N/A",
        }

        const receiverDetails = {
            toEmail: receiverWallet?.account?.email,
            templateId: templateIdReceiving,
            phoneNumber: receiverWallet?.account?.phone,
            phoneMessage: `${formattedAmount(formatDecimalNumbersWithLimit(recipient_amount)) || "N/A"} ${receiverWallet?.currency?.code} received from ${sender_name} in Wallet ID ${data?.wallet_id}`,
            dynamicData: dynamicDataReceiving
        }
        const dynamicDataSending = {
            transaction_id: data.reference_id,
            receiver_name: sender_name,
            date_time: formattedDate,
            amount: `${formattedAmount(formatDecimalNumbersWithLimit(totalAmountWithFee))} ${senderWallet?.currency?.code}`,
            purpose_of_payment: purpose || "N/A",
        }

        const senderDetails = {
            toEmail: senderWallet?.account?.email,
            templateId: templateIdSending,
            phoneNumber: senderWallet?.account?.phone,
            phoneMessage: `${formattedAmount(formatDecimalNumbersWithLimit(totalAmountWithFee))} ${senderWallet?.currency?.code} sent to ${receiver_name} in Wallet ID ${data?.wallet_id}`,
            dynamicData: dynamicDataSending
        }
        // email, phone and push notifications

        await sendNotifications(senderWallet.account, 'payments', senderDetails)
        await sendNotifications(receiverWallet.account, 'payments', receiverDetails)
        templateMsg = receiverOptions.message
    } else if (paymentType === 'payment_request') {
        notificationObj.title = 'Payment Request Notification';
        notificationObj.desc = 'Payment request amount received successfully!';
        const senderOptions = {
            toEmail: senderWallet?.account?.email ?? "",
            phoneNumber: senderWallet?.account?.phone ?? "",
            instaUsername: senderWallet?.account?.insta_username ?? "",
            message: `You have sent a payment request of ${senderWallet?.currency?.symbol}${formattedAmount(formatDecimalNumbersWithLimit(totalAmountWithFee))} to ${receiver_name} in Wallet ID ${data?.wallet_id}`,
            subject: "You have sent a payment request in your Instapay Account!",
            templateId: "d-2d5f929ed89847d693ab15621b95890f",
            phoneMessage: `Payment request amount sent of ${senderWallet?.currency?.symbol}${formattedAmount(formatDecimalNumbersWithLimit(totalAmountWithFee))} to ${receiver_name} in Wallet ID ${data?.wallet_id}`
        };

        const receiverOptions = {
            toEmail: receiverWallet?.account?.email ?? "",
            phoneNumber: receiverWallet?.account?.phone ?? "",
            instaUsername: receiverWallet?.account?.insta_username ?? "",
            message: `Your payment request of ${receiverWallet?.currency?.symbol}${formattedAmount(formatDecimalNumbersWithLimit(recipient_amount)) || "N/A"} has been accepted from ${sender_name}`,
            subject: "Your payment request has been accepted in your Instapay Account!",
            templateId: "d-2d5f929ed89847d693ab15621b95890f",
            phoneMessage: `Payment request amount received of ${receiverWallet?.currency?.symbol}${formattedAmount(formatDecimalNumbersWithLimit(recipient_amount)) || "N/A"} from ${sender_name}`
        };

        // const quotationSendLanguage = 'english';
        // const quotationSendtemplateName = 'wallet to wallet transfer(sender)';

        const date = new Date();
        const formattedDate = momentTime(date).format('YYYY-MM-DD');

        // const templateIdSending = getTemplateId(quotationSendLanguage, quotationSendtemplateName);

        const quotationReceiverLanguage = 'english';
        const quotationReceivertemplateName = 'Request Money(Standard Payment Request) - Accepted';

        const templateIdReceiving = getTemplateId(quotationReceiverLanguage, quotationReceivertemplateName);

        // const dynamicDataReceiving = {
        //     request_id: data.reference_id,
        //     reciever_name: sender_name,
        //     date_accepted: formattedDate,
        //     amount: `${formattedAmount(formatDecimalNumbersWithLimit(recipient_amount)) || "N/A"} ${receiverWallet?.currency?.code}`,
        //     purpose_of_payment: purpose || "N/A",
        // }

        // const receiverDetails = {
        //     toEmail: receiverWallet?.account?.email,
        //     templateId: templateIdReceiving,
        //     phoneNumber: receiverWallet?.account?.phone,
        //     phoneMessage: `Payment amount received of ${excRate?.otal?.value?.toFixed(2)} ${senderWallet?.currency?.code} from ${sender_name}`,
        //     dynamicData: dynamicDataReceiving
        // }
        const dynamicDataSending = {
            request_id: data.reference_id,
            receiver_name: sender_name,
            date_accepted: formattedDate,
            amount: `${formattedAmount(formatDecimalNumbersWithLimit(recipient_amount)) || "N/A"} ${receiverWallet?.currency?.code}`,
            purpose_of_payment: purpose || "N/A",
        }

        const senderDetails = {
            toEmail: receiverWallet?.account?.email,
            templateId: templateIdReceiving,
            phoneNumber: receiverWallet?.account?.phone,
            phoneMessage: `Your payment request of ${formattedAmount(formatDecimalNumbersWithLimit(recipient_amount))} ${receiverWallet?.currency?.code} has been accepted by ${sender_name}`,
            dynamicData: dynamicDataSending
        }
        // email, phone and push notifications

        await sendNotifications(senderWallet.account, 'payment_requests', senderDetails)
        templateMsg = receiverOptions.message
    }
    else if (paymentType === "payment_address") {
        notificationObj.title = 'Payment Address Notification';
        notificationObj.desc = 'Payment address amount received successfully!';
        const senderOptions = {
            toEmail: senderWallet?.account?.email ?? "",
            phoneNumber: senderWallet?.account?.phone ?? "",
            instaUsername: senderWallet?.account?.insta_username ?? "",
            message: `You have sent a payment address of ${senderWallet?.currency?.symbol}${formattedAmount(formatDecimalNumbersWithLimit(totalAmountWithFee))} to ${receiver_name} in Wallet ID ${data?.wallet_id}`,
            subject: "You have sent a payment address in your Instapay Account!",
            templateId: "d-2d5f929ed89847d693ab15621b95890f",
            phoneMessage: `Payment address amount sent of ${senderWallet?.currency?.symbol}${formattedAmount(formatDecimalNumbersWithLimit(totalAmountWithFee))} to ${receiver_name} in Wallet ID ${data?.wallet_id}`
        }
        const receiverOptions = {
            toEmail: receiverWallet?.account?.email ?? "",
            phoneNumber: receiverWallet?.account?.phone ?? "",
            instaUsername: receiverWallet?.account?.insta_username ?? "",
            phoneMessage: `Great news! ${formattedAmount(recipient_amount) || "N/A"} ${receiverWallet?.currency?.code} has been received in your wallet ID ${receiverWallet?.wallet_id} from ${sender_name || "N/A"} via payment address.`,
            message: `Great news! ${formattedAmount(recipient_amount) || "N/A"} ${receiverWallet?.currency?.code} has been received in your wallet ID ${receiverWallet?.wallet_id} from ${sender_name || "N/A"} via payment address.`,
            subject: "You have received a payment address in your Instapay Account!",
            templateId: "d-2d5f929ed89847d693ab15621b95890f",
        }
        await sendNotifications(senderWallet.account, 'payments', senderOptions);
        await sendNotifications(receiverWallet.account, 'payments', receiverOptions);
        templateMsg = receiverOptions.message
    }
    else if (paymentType === "qr_pay") {
        notificationObj.title = 'QR Pay Notification';
        notificationObj.desc = 'QR Pay amount received successfully!';
        const senderOptions = {
            toEmail: senderWallet?.account?.email ?? "",
            phoneNumber: senderWallet?.account?.phone ?? "",
            instaUsername: senderWallet?.account?.insta_username ?? "",
            message: `You have sent a QR Pay of ${senderWallet?.currency?.symbol}${formattedAmount(formatDecimalNumbersWithLimit(totalAmountWithFee))} to ${receiver_name} in Wallet ID ${data?.wallet_id}`,
            subject: "You have sent a QR Pay in your Instapay Account!",
            templateId: "d-2d5f929ed89847d693ab15621b95890f",
            phoneMessage: `QR Pay amount sent of ${senderWallet?.currency?.symbol}${formattedAmount(formatDecimalNumbersWithLimit(totalAmountWithFee))} to ${receiver_name} in Wallet ID ${data?.wallet_id}`
        }
        const receiverOptions = {
            toEmail: receiverWallet?.account?.email ?? "",
            phoneNumber: receiverWallet?.account?.phone ?? "",
            instaUsername: receiverWallet?.account?.insta_username ?? "",
            message: `You have received a QR Pay of ${receiverWallet?.currency?.symbol}${formattedAmount(formatDecimalNumbersWithLimit(recipient_amount)) || "N/A"} from ${sender_name}`,
            subject: "You have received a QR Pay in your Instapay Account!",
            templateId: "d-2d5f929ed89847d693ab15621b95890f",
        }
        await sendNotifications(senderWallet.account, 'payments', senderOptions);
        await sendNotifications(receiverWallet.account, 'payments', receiverOptions);
        templateMsg = receiverOptions.message
    }

    // system notification
    await addNotification(notificationObj);
    console.log(notificationObj, "notificationObj")
    // socket notification
    sendPrivateMessage(receiverWallet?.account?._id, `You have received a transaction of ${formattedAmount(formatDecimalNumbersWithLimit(recipient_amount)) || "N/A"}${receiverWallet?.currency?.code} from ${sender_name}`);

    if (receiverWallet?.account?.insta_recipient_id && receiverWallet?.account?.insta_bot) {
        const receiverLang = receiverWallet?.account?.insta_recipient_id?.active_language || receiverWallet?.account?.language || "en"
        let templatePayload = {}
        let subtitle = `
${lang[receiverLang].TRANSACTION_ID} ${data.reference_id}
${lang[receiverLang].USERNAME}: ${senderWallet?.account?.username}
${lang[receiverLang].WALLET_ID} ${data?.wallet_id}
${lang[receiverLang].STATUS}: Completed`
        if (paymentType !== "conversion") {
            if (type === "subscription" || type === "schedule") {
                templatePayload = {
                    template_type: "generic",
                    elements: [
                        {
                            title: `You've received a new ${type === "subscription" ? "subscribed" : "scheduled"} transaction of ${formattedAmount(formatDecimalNumbersWithLimit(recipient_amount)) || "N/A"} ${receiverWallet?.currency?.code} from ${sender_name}!`,
                            subtitle,
                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Send%20Money.png",
                            buttons: [
                                {
                                    type: "postback",
                                    title: "Cash Out now",
                                    payload: `cash_out_id_${data?._id}`,
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
            } else {
                templatePayload = {
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
                                    payload: `cash_out_id_${data?._id}`
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
            }
        }

        const templateData = {
            sender: { id: receiverWallet?.account?.insta_recipient_id?.recipient },
        };
        console.log(templateData, "templateDatainsendTemplate")
        await sendTemplate(templateData, receiverWallet?.account?.insta_recipient_id?.recipient, templatePayload, "4");
    }


}

async function gettingExchangeRates(from, to, amount, level_id, type, transaction_type) {
    console.log({ from, to, amount, level_id, type });
    let fee;
    let feeDetails = await Fee.findOne({ $and: [{ service_name: type }, { account_level: level_id }] })
    if (feeDetails) {
        if (transaction_type !== 'request') {
            let exchangeRate
            exchangeRate = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`)
            if (exchangeRate.data.success) {

                console.log(from, to, amount, exchangeRate.data.info.rate, feeDetails)
                let fee_currency = feeDetails ? feeDetails.fee_currency : 'USD'
                let markupReceived, feeReceived = {}

                let feeExchange;
                if (feeDetails.fee_type === 'flat') {
                    fee = feeDetails.flat_fee

                    feeExchange = await getExchangeRatesToUSD(fee_currency, from, fee);

                    feeReceived = {
                        fee_type: feeDetails.fee_type,
                        exchange_fee: feeExchange,
                        actualfee: feeDetails.flat_fee,
                        currency: from
                    }
                }
                else {

                    feeExchange = amount * (feeDetails.percentage_fee / 100)

                    console.log(feeExchange, "feeExchange")
                    feeReceived = {
                        fee_type: feeDetails.fee_type,
                        exchange_fee: feeExchange,
                        actualfee: feeDetails.percentage_fee,
                        currency: from
                    }
                }

                let newRate = formatDecimalNumbersWithLimit(exchangeRate.data.info.rate, 6) //+ (exchangeRate.data.info.rate * (additional / 100))
                let rateAfterFee

                rateAfterFee = formatDecimalNumbersWithLimit(amount - feeExchange)

                let exchange_rate

                if (from !== to) {
                    exchange_rate = formatDecimalNumbersWithLimit(newRate - ((feeDetails.percentage_markup / 100) * newRate), 6)
                    markupReceived = {
                        markup_type: feeDetails.markup_type,
                        exchange_rate_markup: formatDecimalNumbersWithLimit(newRate - ((feeDetails.percentage_markup / 100) * newRate), 6),
                        markup: feeDetails.percentage_markup,
                        currency: feeDetails.markup_currency
                    }
                } else {
                    exchange_rate = newRate
                    markupReceived = {
                        markup_type: "N/A",
                        exchange_rate_markup: newRate,
                        markup: 0,
                        currency: feeDetails.markup_currency
                    }
                }

                let newExchangeAmount = formatDecimalNumbersWithLimit(rateAfterFee * exchange_rate)
                console.log(exchange_rate, "markup", feeDetails.percentage_markup, newExchangeAmount, rateAfterFee, fee, feeExchange);

                let data = {
                    exchanged_rate: {
                        value: exchange_rate,
                        currency: to,
                        actual_rate: newRate,
                        rate_with_markup: exchange_rate,
                    },
                    fee: {
                        value: formatDecimalNumbersWithLimit(feeExchange),
                        currency: from
                    },
                    recipient: {
                        value: newExchangeAmount,
                        currency: to
                    },
                    total: {
                        value: formatDecimalNumbersWithLimit(amount),
                        currency: from
                    },
                    markup: markupReceived,
                    fee: feeReceived
                }

                return data
            } else {
                return null
            }
        } else {
            let exchange_rate = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`)
            let markupReceived, feeReceived = {}
            let fee_currency = feeDetails.fee_currency
            let new_exchange_rate;
            console.log(feeDetails, feeDetails.percentage_markup, "markup", feeDetails.percentage_markup, exchange_rate.data.info.rate);
            const exchangeRate = exchange_rate.data.info.rate
            // do nt find fx if from = to
            if (from !== to) {
                new_exchange_rate = formatDecimalNumbersWithLimit(exchangeRate - ((feeDetails.percentage_markup / 100) * exchangeRate), 6)
                markupReceived = {
                    markup_type: feeDetails.markup_type,
                    exchange_rate_markup: formatDecimalNumbersWithLimit(exchangeRate - ((feeDetails.percentage_markup / 100) * exchangeRate), 6),
                    markup: feeDetails.percentage_markup,
                    currency: feeDetails.markup_currency
                }
            } else {
                new_exchange_rate = exchangeRate
                markupReceived = {
                    markup_type: "N/A",
                    exchange_rate_markup: exchangeRate,
                    markup: 0,
                    currency: feeDetails.markup_currency
                }
            }

            if (feeDetails.fee_type === 'flat') {
                fee = feeDetails.flat_fee
                // condition here too if from = to
                feeExchange = await getExchangeRatesToUSD(fee_currency, from, fee);

                feeReceived = {
                    fee_type: feeDetails.fee_type,
                    exchange_fee: feeExchange,
                    actualfee: feeDetails.flat_fee,
                    currency: from
                }
            }
            else {
                feeExchange = amount * (feeDetails.percentage_fee / 100)

                console.log(feeExchange, "feeExchange")
                feeReceived = {
                    fee_type: feeDetails.fee_type,
                    exchange_fee: feeExchange,
                    actualfee: feeDetails.percentage_fee,
                    currency: from
                }
            }

            console.log(markupReceived, "markupReceived", feeReceived, "feeReceived")

            let new_amount = amount / markupReceived.exchange_rate_markup
            new_amount = new_amount + feeExchange

            let data = {
                exchanged_rate: {
                    value: markupReceived.exchange_rate_markup,
                    currency: to,
                    actual_rate: new_exchange_rate,
                    rate_with_markup: markupReceived.exchange_rate_markup,
                },
                fee: {
                    value: formatDecimalNumbersWithLimit(feeExchange),
                    currency: from
                },
                recipient: {
                    value: amount,
                    currency: to
                },
                total: {
                    value: formatDecimalNumbersWithLimit(new_amount, 3),
                    currency: from
                },
                markup: markupReceived,
                fee: feeReceived
            }

            return data
        }
    } else {
        return null
    }
}

// async function findConversionSystemMarkupRate(from, to, amount, service_name, level_id) {
//     const feeDetails = await Fee.findOne({ service_name, account_level: level_id });

//     if (!feeDetails) throw new Error("Fee details not found!");

//     const exchangeRateResponse = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`);

//     if (!exchangeRateResponse.data.success) throw new Error("Exchange Rates not found!");

//     const newRate = formatDecimalNumbersWithLimit(exchangeRateResponse.data.info.rate, 6);

//     let exchange_rate = from !== to ? formatDecimalNumbersWithLimit(newRate - (feeDetails.percentage_markup / 100) * newRate, 6) : newRate;

//     return exchange_rate * amount;

// }

const calculateTopupMarkupHelper = (newRate, percentageMarkup, from, to) => {
    if (from !== to) {
        return formatDecimalNumbersWithLimit(newRate + (percentageMarkup / 100) * newRate, 6);
    }
    return newRate;
};
const calculateExchangeAndFees = async (from, to, amount, type, level_id, payment_type, senderWallet, transaction_type) => {
    let fee = 0;
    let exchange_rate, recipient_amount, totalAmountWithFee;

    try {
        console.log({ from, to, amount, type, level_id, payment_type, senderWallet: { senderWallet: senderWallet.currency.code }, transaction_type })
        const feeDetails = await Fee.findOne({ service_name: type, account_level: level_id });
        if (!feeDetails) throw new Error("Fee details not found!");

        const exchangeRateResponse = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`);
        if (!exchangeRateResponse.data.success) throw new Error("Exchange Rates not found!");

        const newRate = formatDecimalNumbersWithLimit(exchangeRateResponse.data.info.rate, 6);
        exchange_rate = from !== to ? formatDecimalNumbersWithLimit(newRate - (feeDetails.percentage_markup / 100) * newRate, 6) : newRate;

        let convertedSendingAmount;
        if (transaction_type && transaction_type === 'request') {
            convertedSendingAmount = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(to, from, amount));
        }
        // Logic for calculating fees
        if (feeDetails.fee_type === 'flat') {
            fee = feeDetails.flat_fee;
            fee = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(feeDetails.fee_currency || 'USD', from, fee), 2);
        } else {
            // if transaction_type === 'request', then we will convert the requested amount into sending currency
            if (transaction_type && transaction_type === 'request') {
                fee = formatDecimalNumbersWithLimit(convertedSendingAmount * (feeDetails.percentage_fee / 100), 2);
            } else {
                fee = formatDecimalNumbersWithLimit(amount * (feeDetails.percentage_fee / 100), 2);
            }
        }

        // Add top-up fee for card payments
        let topupFee
        if (payment_type && payment_type === 'card') {
            if (transaction_type && transaction_type === 'request') {
                topupFee = await topUpFeeCalculation(senderWallet, convertedSendingAmount, 'topup_card_payment');
            } else {
                topupFee = await topUpFeeCalculation(senderWallet, amount, 'topup_card_payment');
            }
            fee += parseFloat(topupFee);
            console.log({ topupFee, amount })
        } else if (payment_type && payment_type === 'paypal') {
            let paypalFeeDetails;
            if (transaction_type && transaction_type === 'request') {
                paypalFeeDetails = await getPaypalFeeHelper(senderWallet, convertedSendingAmount, convertedSendingAmount + fee);
            } else {
                paypalFeeDetails = await getPaypalFeeHelper(senderWallet, amount, amount);
            }
            console.log({ paypalFeeDetails })
            topupFee = paypalFeeDetails.fee
            fee += topupFee;
            var paypalConverted = paypalFeeDetails.converted_amount;
            var paypalRate = paypalFeeDetails.rate;
            var currencySupported = paypalFeeDetails.currencySupported;
        }

        fee = formatDecimalNumbersWithLimit(fee, 2);

        // if type is conversion
        if (type === 'conversion') {

            const amountAfterFee = amount - fee;

            recipient_amount = amountAfterFee * exchange_rate;

            return {
                exchange_rate,
                fee,
                totalAmountWithFee: formatDecimalNumbersWithLimit(amount, 2),
                recipient_amount: formatDecimalNumbersWithLimit(recipient_amount, 2),
                feeType: feeDetails.fee_type,
                markup: feeDetails.percentage_markup,
                original_rate: newRate,
            };
        }

        // when transaction type is 'request'
        if (transaction_type && transaction_type === 'request') {
            recipient_amount = amount;

            // Deduct the total amount including fees from the sender's wallet
            totalAmountWithFee = recipient_amount / exchange_rate + fee;

            console.log({ exchange_rate, fee, totalAmountWithFee, recipient_amount });

            return {
                exchange_rate,
                fee,
                totalAmountWithFee: formatDecimalNumbersWithLimit(totalAmountWithFee, 2),
                recipient_amount: formatDecimalNumbersWithLimit(recipient_amount, 2),
                feeType: feeDetails.fee_type,
                markup: feeDetails.percentage_markup,
                original_rate: newRate,
                feeToSendingRate: formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(feeDetails.fee_currency || 'USD', from, 1), 6),
                topupFee: formatDecimalNumbersWithLimit(topupFee || 1, 2),
                paypal: {
                    paypal_converted: { value: formatDecimalNumbersWithLimit(paypalConverted || 0, 2) || null, currency: "USD" },
                    paypal_rate: { value: formatDecimalNumbersWithLimit(paypalRate || 0, 6) || null, currency: "USD" },
                    paypal_currency_supported: currencySupported,
                    fee: { value: formatDecimalNumbersWithLimit(topupFee || 1, 2) || null, currency: senderWallet.currency.code },

                },

            };
        }

        // for simple w2w
        totalAmountWithFee = amount + fee;
        recipient_amount = amount * exchange_rate;
        console.log({ exchange_rate, fee, totalAmountWithFee, recipient_amount });
        return {
            exchange_rate,
            fee,
            totalAmountWithFee: formatDecimalNumbersWithLimit(totalAmountWithFee, 2),
            recipient_amount: formatDecimalNumbersWithLimit(recipient_amount, 2),
            feeType: feeDetails.fee_type,
            markup: feeDetails.percentage_markup,
            original_rate: newRate,
            feeToSendingRate: formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(feeDetails.fee_currency || 'USD', from, 1), 6),
            topupFee: formatDecimalNumbersWithLimit(topupFee || 1, 2), // if rates are being fetched for the simple w2w and on first step, there is no topup fee
            paypal: {
                paypal_converted: { value: formatDecimalNumbersWithLimit(paypalConverted || 0, 2) || null, currency: "USD" },
                paypal_rate: { value: formatDecimalNumbersWithLimit(paypalRate || 0, 6) || null, currency: "USD" },
                paypal_currency_supported: currencySupported,
                fee: { value: formatDecimalNumbersWithLimit(topupFee || 0, 2) || null, currency: senderWallet.currency.code },

            },

        };
    } catch (error) {
        console.log(error?.response?.data?.error)
        throw new Error(error.message);
    }
};

const walletToWalletTransactionHelper = async (data, req, files) => {
    try {
        // console.log(req.user, "res", data.sender_wallet_id)
        let senderWallet = await Wallet.findOne({
            $and: [{ _id: data.sender_wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([
            {
                path: 'account',
                populate: [
                    { path: 'user' },
                    { path: 'company' },
                    { path: 'level' },
                    { path: 'insta_recipient_id' }
                ]
            },
        ]);
        let receiverWallet = await Wallet.findOne({
            $and: [{ wallet_id: data.receiver_wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([
            {
                path: 'account',
                populate: [
                    { path: 'user' },
                    { path: 'company' },
                    { path: 'level' },
                    { path: 'insta_recipient_id' }
                ]
            },
        ]);

        if (!senderWallet) {
            return {
                status: false,
                message: "Invalid Sender!"
            };
        }

        if (!receiverWallet) {
            return {
                status: false,
                message: "Invalid Receiver!"
            };
        }

        const receivingCountry = await Country.findById(receiverWallet?.account?.country)

        console.log(receivingCountry, "receivingCountry")

        if (!receivingCountry.receivingActive) {
            return {
                status: false,
                message: "Receiving not active for the receiver country"
            }
        }

        // console.log(senderWallet.account, senderWallet.account._id.toString() !== req.user._id.toString(), "senderWallet.account")

        if (req?.user) {
            if (senderWallet.account._id.toString() !== req.user._id.toString() || !senderWallet.account.active) {
                return {
                    status: false,
                    message: "Invalid Sender!"
                };
            }
        }

        if (!receiverWallet.account.active) {
            return {
                status: false,
                message: "Invalid Receiver!"
            };
        }

        if (data?.payment_method === "paypal" || data?.payment_method === "card") {
            const decodedExtras = jwt.verify(data?.token, secretKey)
            console.log({ decodedExtras })
            var { exchange_rate, fee, totalAmountWithFee, recipient_amount, feeType, markup, original_rate, topupFee, feeToSendingRate } = decodedExtras?.extras
        } else {
            var { exchange_rate, fee, totalAmountWithFee, recipient_amount, feeType, markup, original_rate, feeToSendingRate } = await calculateExchangeAndFees(senderWallet.currency.code, receiverWallet.currency.code, data.amount, data?.payment_type, senderWallet.account.level._id, data?.payment_method, senderWallet, data?.transaction_type);
        }

        console.log({ exchange_rate, fee, totalAmountWithFee, recipient_amount, feeType, markup, original_rate });

        if (totalAmountWithFee > senderWallet.balance.available) {
            return {
                status: false,
                message: "Insufficient Balance!"
            };
        }

        let exchangedAmountSender
        let exchagnedAmountReceiver
        // if (data.transaction_type === "request") {
        exchangedAmountSender = await getExchangeRatesToUSD(senderWallet.currency.code, 'USD', totalAmountWithFee)
        exchagnedAmountReceiver = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', recipient_amount)
        // } else {
        //     exchangedAmountSender = await getExchangeRatesToUSD(senderWallet.currency.code, 'USD', data.amount)
        //     exchagnedAmountReceiver = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', excRate.recipient.value - excRate.fee.exchange_fee)
        // }


        // features check
        let featureCheck1, featureCheck2;
        if (data.payment_type === "conversion") {
            featureCheck1 = await featureCheck('wallet_to_wallet', 'conversion', senderWallet.account.level);
            featureCheck2 = await featureCheck('wallet_to_wallet', 'conversion', receiverWallet.account.level);
        } else {
            featureCheck1 = await featureCheck(data.payment_type, 'send', senderWallet.account.level);
            featureCheck2 = await featureCheck(data.payment_type, 'receive', receiverWallet.account.level);
        }

        if (!featureCheck1 || !featureCheck2) {
            return {
                status: false,
                message: "Feature not available!"
            };
        }

        console.log(exchangedAmountSender, exchagnedAmountReceiver, "exchangedAmountSender, exchagnedAmountReceiver")

        if (data.payment_type !== "conversion") {
            // limits checking
            let limitCheck1 = limitCheck(exchangedAmountSender, senderWallet.account.level, senderWallet.account, 'sending');
            let limitCheck2 = limitCheck(exchagnedAmountReceiver, receiverWallet.account.level, receiverWallet.account, 'receiving');
            if (!limitCheck1.status) {
                return {
                    status: false,
                    message: limitCheck1.code
                }
            }
            if (!limitCheck2.status) {
                return {
                    status: false,
                    message: limitCheck2.code
                }
            }
        }

        if (data.payment_type !== "conversion") {
            // receiver's account balance check
            const receiverBalanceCheck = await balanceLimitCheck(exchagnedAmountReceiver, receiverWallet.account);

            if (!receiverBalanceCheck) {
                return {
                    status: false,
                    message: "rbl400"
                }
            }
        }

        // Attachment uploading related work
        const hasTrueStatus = files?.some(file => file.status === true);

        let attachments = [];

        if (files && files.length > 0 && !hasTrueStatus) {
            const bucketName = process.env.AWS_BUCKET_NAME;
            for (const file of files) {
                if (file.mimetype.split("/")[0] === "image" || file.mimetype.split("/")[0] === "video") {

                    const params = {
                        Bucket: bucketName,
                        Key: `transaction_images/${senderWallet.account.username}_${receiverWallet.account.username}/${file.originalname}`,
                        Body: file.buffer
                    };

                    const uploadResult = await s3.upload(params).promise();

                    if (uploadResult?.Location && uploadResult?.Key && uploadResult?.ETag) {
                        attachments.push({
                            key: uploadResult.Key,
                            url: uploadResult.Location,
                            ETag: uploadResult.ETag
                        });
                    } else {
                        return {
                            status: false,
                            message: "Something went wrong while uploading the image."
                        }
                    }
                } else {
                    return {
                        status: false,
                        message: "Something went wrong while uploading the image."
                    }
                }
            }
        }

        const senderTimezone = senderWallet.account?.timezone || "UTC"
        const receiverTimezone = receiverWallet.account?.timezone || "UTC"

        const senderCurrentTime = moment().tz(senderTimezone).format();
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        let senderBalance;
        let receiverBalance;

        if (data.type === "schedule" || data.type === "subscription") {
            // Deduct from reserved balance for scheduled or subscription transactions
            senderBalance = senderWallet.balance.reserved - totalAmountWithFee;
        } else {
            if (data?.payment_method === "paypal" || data?.payment_method === "card") {
                senderBalance = senderWallet.balance.available - parseFloat(totalAmountWithFee - parseFloat(topupFee))
            } else {
                senderBalance = senderWallet.balance.available - totalAmountWithFee
            }
        }
        receiverBalance = receiverWallet.balance.available + recipient_amount;

        let ref = 'tr_' + Date.now().toString();
        let type
        if (data.type === "schedule") {
            type = "schedule"
        } else if (data.type === "subscription") {
            type = "subscription"
        } else {
            type = "instant"
        }
        let senderTransactionObj = {
            reference_id: ref,
            type,
            transaction_type: 'debit',
            service_type: 'wallet_to_wallet',
            payment_type: data.payment_type === "wallet_to_wallet" ? "wallet_to_wallet" : data.payment_type,
            status: 'COMPLETED',
            purpose: data.purpose,
            description: data.description || "",
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount: totalAmountWithFee - fee,
            fee: fee,
            fee_type: feeType,
            markup,
            markup_currency: senderWallet.currency.code,
            exchange_rate: original_rate,
            exchange_rate_markup: exchange_rate,
            feeToSendingRate,
            total: totalAmountWithFee,
            recipient_received_amount: recipient_amount,
            recipient_received_currency: receiverWallet.currency.code,
            wallet_id: senderWallet.wallet_id,
            wallet: senderWallet._id,
            account: senderWallet.account._id,
            sender: senderWallet.account._id,
            receiver: receiverWallet.account._id,
            current_balance: senderWallet.balance.available,
            new_balance: senderWallet.balance.available - totalAmountWithFee,
            lat: data.payment_type === "payment_request" ? data?.address?.lat : undefined,
            long: data.payment_type === "payment_request" ? data?.address?.long : undefined,
            address: data.payment_type === "payment_request" ? data?.address?.adress : undefined,
            display_name: data.payment_type === "payment_request" ? data?.address?.display_name : undefined,
            timeline: [
                {
                    status: 'COMPLETED',
                    date: senderCurrentTime,
                }
            ]
        };

        let receiverTransactionObj = {
            reference_id: ref,
            type,
            transaction_type: 'credit',
            service_type: 'wallet_to_wallet',
            payment_type: data.payment_type === "wallet_to_wallet" ? "wallet_to_wallet" : data.payment_type,
            status: 'COMPLETED',
            purpose: data.purpose,
            description: data.description || "",
            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
            amount: recipient_amount,
            fee: 0,
            fee_type: feeType,
            markup,
            markup_currency: senderWallet.currency.code,
            exchange_rate: original_rate,
            exchange_rate_markup: exchange_rate,
            total: recipient_amount,
            recipient_received_currency: receiverWallet.currency.code,
            wallet_id: receiverWallet.wallet_id,
            wallet: receiverWallet._id,
            account: receiverWallet.account._id,
            sender: senderWallet.account._id,
            receiver: receiverWallet.account._id,
            current_balance: receiverWallet.balance.available,
            new_balance: receiverWallet.balance.available + recipient_amount,
            lat: data.payment_type === "payment_request" ? data?.address?.lat : undefined,
            long: data.payment_type === "payment_request" ? data?.address?.long : undefined,
            address: data.payment_type === "payment_request" ? data?.address?.address : undefined,
            display_name: data.payment_type === "payment_request" ? data?.address?.display_name : undefined,
            timeline: [
                {
                    status: 'COMPLETED',
                    date: receiverCurrentTime,
                }
            ]
        };

        console.log(senderTransactionObj, receiverTransactionObj, "senderTransactionObj, receiverTransactionObj")

        if (attachments.length > 0) {
            senderTransactionObj.attachments = attachments;
            receiverTransactionObj.attachments = attachments;
        }

        if (hasTrueStatus) {
            senderTransactionObj.attachments = files;
            receiverTransactionObj.attachments = files;
        }

        // setting the schedules id if the transaction type is schedule/subscription
        if (type === "schedule") {
            senderTransactionObj["schedule_id"] = data.link_id
            receiverTransactionObj["schedule_id"] = data.link_id
        } else if (type === "subscription") {
            senderTransactionObj["subscription_id"] = data.link_id
            receiverTransactionObj["subscription_id"] = data.link_id
        }
        // updating the limits used
        // if conversion do not update the limits
        if (data.payment_type !== "conversion") {
            await updateUsedLimits(senderWallet.account, receiverWallet.account, exchangedAmountSender, exchagnedAmountReceiver);
        }

        // update balance field according to the tranasction type
        let balanceFieldToUpdate = (data.type === "schedule" || data.type === "subscription") ? "balance.reserved" : "balance.available";
        let newSenderBalance = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { [balanceFieldToUpdate]: senderBalance } });
        if (newSenderBalance.acknowledged && newSenderBalance.modifiedCount === 1) {
            let supdt = await Transaction.create(senderTransactionObj);
            if (supdt) {
                let newReceiverBalance = await Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } });
                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount === 1) {
                    let rupdt = await Transaction.create(receiverTransactionObj);
                    if (rupdt) {
                        try {
                            await sendNotificationHelper(senderWallet, receiverWallet, data.payment_type, rupdt, totalAmountWithFee, recipient_amount, data.link, data.type, data.purpose);
                        } catch (error) {
                            console.error("Error sending notification:", error);
                        }
                        return {
                            status: true,
                            message: "Transaction successfull.",
                            data: supdt
                        };
                    } else {
                        await Transaction.findByIdAndRemove({ _id: supdt._id });
                        await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } });
                        await Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverWallet.balance.available } });
                        return {
                            status: false,
                            message: "Transaction Failed."
                        };
                    }
                } else {
                    // Rollback transaction and handle error
                    await Transaction.findByIdAndRemove({ _id: supdt._id });
                    await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } });
                    return {
                        status: false,
                        message: "Transaction Failed."
                    };
                }
            } else {
                // Rollback transaction and handle error
                await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } });
                return {
                    status: false,
                    message: "Transaction Failed."
                };
            }
        } else {
            return {
                status: false,
                message: "Transaction Failed."
            };
        }
    } catch (err) {
        console.log(err);
        await logError(
            `${err} (inside w2w helper)`,
            "w2w",
            null,
            req?.transaction_id || null,
        );
        return {
            status: false,
            message: "Internal server error!"
        };
    }
};

async function createQuotationHelper(data) {

    try {
        const API_URL = `${process.env.THUNES_PROD_URL}/v2/money-transfer/quotations`;
        // const API_URL = 'https://api-mt.pre.thunes.com/v2/money-transfer/quotations';
        const authHeader = `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`;
        const config = {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        };

        const response = await axios.post(API_URL, data, config);

        return { status: true, data: response.data };

    } catch (err) {
        console.log(err?.response?.data?.errors ?? err.message);
        return { status: false, data: err?.response?.data?.errors ?? err.message }
    }

}
async function getPayerRatesHelper(payerId) {

    try {
        const API_URL = `${process.env.THUNES_PROD_URL}/v2/money-transfer/payers/${payerId}/rates`;
        const authHeader = `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`;

        const config = {
            headers: {
                'Authorization': authHeader,
            }
        };

        const response = await axios.get(API_URL, config);

        return { status: true, data: response };

    } catch (err) {
        console.log(err);
        return { status: false, data: err?.response?.data?.errors ?? err.message }
    }

}

async function sendSMSTemplate(to, message) {

    try {
        to.replace('+', '')
        to = '+' + to;
        let obj = {
            body: message,
            messagingServiceSid: process.env.TWILIO_SERVICE_ID,
            to: to
        }
        // console.log(obj);
        let send = await client.messages.create(obj)
        console.log('SMS sent successfully');
        return true;
    } catch (error) {
        console.error(error.toString());
        return false;
    }
}

async function sendMailsHelper(to, message, subject, templateId, dynamicData) {
    try {
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey('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');

        const msg = {
            personalizations: [
                {
                    to: [
                        {
                            email: to
                        }
                    ],
                    dynamic_template_data: dynamicData,
                }
            ],
            from: {
                email: 'noreply@insta-pay.ch',
                name: 'InstaPay'
            },
            tracking_settings: {
                click_tracking: {
                    enable: true,
                    enable_text: true
                },
                open_tracking: {
                    enable: true
                }
            },
            template_id: templateId
        }

        let send = await sgMail.send(msg);
        console.log(`Email sent successfully to ${to}`);
        return true;
    } catch (error) {
        console.error(error.toString());
        return false;
    }
}

function getTemplateId(language, name) {
    const languageTemplates = templates[language]
    if (languageTemplates && languageTemplates[name]) {
        return languageTemplates[name]
    } else {
        const englishTemplates = templates['english']
        if (englishTemplates && englishTemplates[name]) {
            return englishTemplates[name]
        } else {
            return null
        }
    }
}

const handleAttachments = async (req, res, next) => {
    try {
        let attachments = [];
        let user = req.user
        // const decrypted = await decryption(req.body.data)
        let decrypted = req.body;
        const { w2w_data } = decrypted
        let type = w2w_data.type

        if (type === 'request') {
            const requestPayment = await RequestPaymentModel.findById(w2w_data.request_id);
            if (!requestPayment) {
                const error = encryption({
                    status: false,
                    message: "Request Payment not found!",
                })
                return res.status(404).send(error);

            }
            attachments = requestPayment.attachments;
        } else if (type === 'quotation') {
            const quotation = await QuotationModel.findById(w2w_data.body.quotation_id);

            if (!quotation) {
                const error = encryption({
                    status: false,
                    message: "Quotation not found!",
                })
                return res.status(404).send(error);
            }
            attachments = quotation.images;
        } else if (req.files && req.files.length > 0) {
            const bucketName = process.env.AWS_BUCKET_NAME;
            for (const file of req.files) {
                const params = {
                    Bucket: bucketName,
                    Key: `uploads/${Date.now()}_${file.originalname}`,
                    Key: `transaction_images/${user.username}/${file.originalname}`,
                    Body: file.buffer,
                    ContentType: file.mimetype,
                };

                const uploadResult = await s3.upload(params).promise();

                if (uploadResult.Location && uploadResult.Key && uploadResult.ETag) {
                    attachments.push({
                        key: uploadResult.Key,
                        url: uploadResult.Location,
                        ETag: uploadResult.ETag
                    });
                } else {
                    const error = encryption({
                        status: false,
                        message: "Something went wrong whle uploading the files",
                    })
                    return res.status(500).send(error);
                }
            }
        }

        req.w2w_attachments = attachments
        next()

    } catch (err) {
        console.error(err);
        const error = encryption({
            status: false,
            message: "Internal server error!"
        })
        return res.status(500).send(error);
    }
};

async function getPaypalFeeHelper(wallet, amount, totalAmount) {
    try {
        console.log({ amount, totalAmount });
        let feeDetails = await topUpFeeCalculation(wallet, amount, 'topup_paypal');

        const finalAmount = formatDecimalNumbersWithLimit(totalAmount + parseFloat(feeDetails), 2);

        let amountInUSD = finalAmount;
        let rate = 1;
        let currencySupported = true;

        if (!supportedCurrencies.includes(wallet.currency.code)) {
            currencySupported = false;
            amountInUSD = await convertCurrency(wallet.currency.code, "USD", finalAmount);
            rate = await convertCurrency(wallet.currency.code, "USD", 1);
        }

        return {
            fee: parseFloat(feeDetails),
            original_amount: amount,
            converted_amount: formatDecimalNumbersWithLimit(amountInUSD, 2),
            rate,
            original_currency: wallet.currency.code,
            currencySupported
        };

    } catch (error) {
        throw new Error(error.message || 'Failed to calculate PayPal fee');
    }
}

async function cardCountryValidation(pan, country_iso_code) {
    try {
        let alpha2 = countries_iso2[country_iso_code];
        pan = pan.replace(/\s/g, '')
        if (pan.length >= 8) {
            let bin = pan.slice(0, 8);
            const apiKey = 'dZsJyp3C6W6KIgsc32LPl8DG6rsvMFgf89G0tBPD'; // Replace with your actual API key
            let data = await axios.get(`https://api.iinlist.com/cards?iin=${bin}`, {
                headers: {
                    'X-API-Key': apiKey
                }
            });
            console.log(alpha2, data.data['_embedded']?.cards[0]?.account?.country.code);

            if (data.data['_embedded']?.cards[0]?.account?.country.code == alpha2) {
                return { valid: true }
            } else {
                return { valid: false }
            }
        } else {
            return { valid: false }
        }
    } catch (err) {
        return { valid: true }
    }
}

async function getGeocodeData(latitude, longitude) {
    try {
        const url = `https://geocode.maps.co/reverse?lat=${latitude}&lon=${longitude}&api_key=${process.env.GEO_CODE_KEY}`;

        const response = await axios.get(url);

        if (response.status === 200) {
            return { status: true, data: response.data };
        } else {
            return { status: false };
        }
    } catch (error) {
        console.error('Error fetching geocode data:', error.message);
        return { status: false };
    }
}

async function logError(error, type, account, transaction_id, additionalInfo) {
    try {
        await Log.create({
            error: error?.message || error,
            account,
            transaction_id,
            additionalInfo,
            type
        });
    } catch (logError) {
        console.error("Failed to log error:", logError);
    }
}

function formattedAmount(amount, limit = 2) {
    try {
        const numericAmount = Number(amount);
        if (isNaN(numericAmount)) throw new Error("Invalid number");

        const formattedAmount = formatDecimalNumbersWithLimit(numericAmount, limit);
        let [integerPart, decimalPart = ''] = formattedAmount.toString().split('.');

        // Pad with zeros if decimal part is too short (for limit=2 cases)
        if (limit === 2 && decimalPart.length < 2) {
            decimalPart = decimalPart.padEnd(2, '0');
        }

        const formattedIntegerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return `${formattedIntegerPart}.${decimalPart}`;
    } catch (error) {
        console.error('Error while formatting amount:', error);
        return amount.toString();
    }
}

const schedulePaymentW2WHelper = async (data) => {
    try {
        let { receiver_wallet_id, sender_wallet_id, purpose, amount, date, time, description, timezone } = data;

        if (!receiver_wallet_id || !sender_wallet_id || !amount || !date || !time) {
            return {
                status: false,
                message: "All fields are required!"
            };
        }

        // if (req.files.length > 5) {
        //     return {
        //         status: false,
        //         message: "Your images limit is exceeded!"
        //     };
        // }

        let senderWallet = await Wallet.findOne({
            $and: [{ _id: sender_wallet_id }, { wallet_type: "insta" }, { status: 'active' }]
        }).populate([{ path: 'account', populate: ['level', 'user', 'company'] }]);

        let receiverWallet = await Wallet.findOne({
            $and: [{ wallet_id: receiver_wallet_id }, { wallet_type: "insta" }, { status: 'active' }]
        }).populate([{ path: 'account', populate: ['level', 'user', 'company'] }]);

        if (!senderWallet || !senderWallet.account.active) {
            return {
                status: false,
                message: "Invalid Sender!"
            };
        }

        if (!receiverWallet || !receiverWallet.account.active) {
            return {
                status: false,
                message: "Invalid Receiver!"
            };
        }

        if (senderWallet.balance.available < amount) {
            return {
                status: false,
                message: "Insufficient balance available to reserve."
            };
        }

        let payObj = {
            purpose,
            description,
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount,
            sender_wallet_id: senderWallet.wallet_id,
            sender_wallet: senderWallet._id,
            sender: senderWallet.account._id,
            reciever_wallet_id: receiverWallet.wallet_id,
            reciever_wallet: receiverWallet._id,
            receiver: receiverWallet.account._id,
            account: senderWallet.account._id
        };

        let objSch = {
            date,
            time,
            type: 'payment',
            active: true,
            status: 'processing',
            recursive: false,
            account: senderWallet.account._id,
            payment: payObj,
            timezone,
            reserved: true
        };

        const newSchedule = new Schedule(objSch);
        // const bucketName = process.env.AWS_BUCKET_NAME;

        // for (const file of req.files) {
        //     if (file.mimetype.split("/")[0] === "image") {
        //         const params = {
        //             Bucket: bucketName,
        //             Key: `transaction_images/${senderWallet.account._id}/${file.originalname}`,
        //             Body: file.buffer
        //         };

        //         const uploadResult = await s3.upload(params).promise();

        //         if (uploadResult?.key) {
        //             newSchedule.attachments.push({
        //                 key: uploadResult.Key,
        //                 url: uploadResult.Location,
        //                 ETag: uploadResult.ETag
        //             });
        //         }
        //     } else {
        //         return {
        //             status: false,
        //             message: "Please provide image files"
        //         };
        //     }
        // }

        await newSchedule.save();

        senderWallet.balance.reserved = senderWallet.balance?.reserved || 0;
        senderWallet.balance.reserved += amount;
        senderWallet.balance.available -= amount;
        await senderWallet.save();

        return {
            status: true,
            message: "Payment details.",
            data: newSchedule
        };

    } catch (err) {
        console.log(err);
        return {
            status: false,
            message: "Internal server error!"
        };
    }
};

const subscribePaymentW2WHelper = async (data) => {
    try {
        const { receiver_wallet_id, sender_wallet_id, purpose, amount, date, cycles, description, timezone } = data;

        if (!receiver_wallet_id || !sender_wallet_id || !amount || !date || !cycles) {
            return { status: false, message: "All fields are required!" };
        }

        // if (req.files.length > 5) {
        //     return { status: false, message: "Image limit exceeded!" };
        // }

        const [senderWallet, receiverWallet] = await Promise.all([
            Wallet.findOne({ _id: sender_wallet_id, wallet_type: "insta", status: 'active' }).populate('account.level'),
            Wallet.findOne({ wallet_id: receiver_wallet_id, wallet_type: "insta", status: 'active' }).populate('account.level')
        ]);

        if (!senderWallet || !senderWallet?.account?.active) {
            return { status: false, message: "Invalid Sender!" };
        }
        if (!receiverWallet || !receiverWallet?.account?.active) {
            return { status: false, message: "Invalid Receiver!" };
        }

        if (senderWallet.balance.available < amount) {
            return { status: false, message: "Insufficient balance." };
        }

        const payObj = {
            purpose,
            description,
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount,
            sender_wallet_id: senderWallet.wallet_id,
            sender_wallet: senderWallet._id,
            sender: senderWallet.account._id,
            receiver_wallet_id: receiverWallet.wallet_id,
            receiver_wallet: receiverWallet._id,
            receiver: receiverWallet.account._id,
            account: senderWallet.account._id
        };

        const scheduleData = {
            date,
            cycles: cycles === "unlimited" ? 12 : cycles,
            next_date: date,
            nextCycles: cycles === "unlimited" ? 12 : cycles,
            type: 'payment',
            active: true,
            status: 'processing',
            recursive: true,
            account: senderWallet.account._id,
            payment: payObj,
            timezone,
            reserved: true
        };

        const newSchedule = new Schedule(scheduleData);

        await newSchedule.save();

        // Reserve amount
        senderWallet.balance.reserved = (senderWallet.balance.reserved || 0) + amount;
        senderWallet.balance.available -= amount;
        await senderWallet.save();

        return { status: true, message: "Payment details.", subscriptionDetails: newSchedule };

    } catch (err) {
        console.error(err);
        return { status: false, message: "Internal server error!" };
    }
};

// fetch local or default wallet based on active status
async function fetchLocalOrDefaultWalletConditionally(account_id) {
    try {
        const account = await Account.findById(account_id).populate("country")

        // first finding the local currency
        let currency = countryCurrencyJson.find(cc => cc.country_code.toLowerCase() == account.country.country_iso_code.toLowerCase())

        // if (!currency) {
        //     return {
        //         status: false,
        //         message: "Currency not found"
        //     }
        // }

        const wallet = await Wallet.findOne({
            $and: [{ account: account._id }, { "currency.code": currency?.currency_code }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: "account", populate: "level" }])

        if (wallet) {
            return wallet

        } else {
            // else find the default wallet
            const defaultWallet = await Wallet.findOne({ account: account._id, default: true }).populate([{ path: "account", populate: "level" }])

            if (defaultWallet) {
                return defaultWallet

            } else {
                return null
            }
        }
    } catch (err) {
        console.log(err)
        return null
    }
}

const TIMEZONE_API_KEY = 'M0TFOM4T5HFM';
const TIMEZONE_API_URL = `http://api.timezonedb.com/v2.1`;
async function getTimezonesWithGmt() {
    try {
        const response = await axios.get(`${TIMEZONE_API_URL}/list-time-zone?key=${TIMEZONE_API_KEY}&format=json`);
        const zones = response.data.zones;
        // console.log(zones)

        const formattedZones = zones.map(zone => {
            const gmtOffsetHours = zone.gmtOffset / 3600;
            const gmtOffsetString = gmtOffsetHours >= 0 ? `GMT+${gmtOffsetHours}` : `GMT${gmtOffsetHours}`;
            return `${zone.zoneName} ${gmtOffsetString}`;
        });

        return formattedZones;
    } catch (error) {
        console.log({ message: 'Error fetching timezones', error: error.message });
        throw new Error(error.message || 'Error fetching timezones');
    }
}

async function getTimezones() {
    try {
        const response = await axios.get(`${TIMEZONE_API_URL}/list-time-zone?key=${TIMEZONE_API_KEY}&format=json`);
        const zones = response.data.zones;

        const timezoneNames = zones.map(zone => zone.zoneName);

        return timezoneNames
    } catch (error) {
        console.log({ message: 'Error fetching timezones', error: error?.message });
        throw new Error(error.message || 'Error fetching timezones');
    }
}

async function getCountrySpecificTimezoneWithGMT(countryCode) {
    try {
        const response = await axios.get(`${TIMEZONE_API_URL}/list-time-zone?key=${TIMEZONE_API_KEY}&format=json&country=${countryCode}`);
        const zones = response.data.zones;

        const formattedZones = zones.map(zone => {
            const gmtOffsetHours = zone.gmtOffset / 3600;
            const gmtOffsetString = gmtOffsetHours >= 0 ? `GMT+${gmtOffsetHours}` : `GMT${gmtOffsetHours}`;
            return `${zone.zoneName} ${gmtOffsetString}`;
        });

        return formattedZones;

    } catch (error) {
        console.log({ message: 'Error fetching timezones', error: error?.message });
        throw new Error(error.message || 'Error fetching timezones');
    }
}

async function getCurrentTimeUsingTimezone(timezone) {
    try {
        const response = await axios.get(`${TIMEZONE_API_URL}/get-time-zone?key=${TIMEZONE_API_KEY}&format=json&by=zone&zone=${timezone}`);
        return response.data.formatted;
    } catch (error) {
        console.log({ message: 'Error fetching timezones', error: error.message });
        throw new Error(error.message || 'Error fetching timezones');
    }
}

// (async () => {
//     try {
//         const timezones = await getCurrentTimeUsingTimezone("America/Chicago");
//         console.log(timezones);
//     } catch (error) {
//         console.error(error);
//     }
// })()

// Function to get GMT offset for a timezone
function getGmtOffset(timezone) {
    const now = moment().tz(timezone);
    const gmtOffsetMinutes = now.utcOffset(); // Offset in minutes
    const hours = Math.floor(gmtOffsetMinutes / 60);
    const minutes = Math.abs(gmtOffsetMinutes % 60);
    const sign = gmtOffsetMinutes >= 0 ? "+" : "-";
    return `GMT${sign}${String(Math.abs(hours)).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

async function getUserActiveWallets(account_id) {
    const wallets = await Wallet.find({
        $and: [
            { account: account_id },
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

    return wallets;
}
async function getActiveWallet(wallet_id) {
    const wallets = await Wallet.findOne({
        $and: [
            { wallet_id },
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

    return wallets;
}
async function getActiveWalletById(wallet_id) {
    const wallets = await Wallet.findOne({
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

    return wallets;
}

function getMaxValidExpiryDateVCC() {
    const currentDate = momentTime();
    const maxValidDate = currentDate.clone().add(2, 'years'); // 2 years from today
    return maxValidDate.format('YYYY-MM-DD'); // Return in 'YYYY-MM-DD' format
}

const getCardDetails = async (card_id) => {
    try {
        if (!card_id) return { status: false, message: "Card ID is required" };

        const card = await VirtualCardModel.findById(card_id);
        if (!card) return { status: false, message: "Card not found" };

        const requestData = { cardId: card.card_id };
        const encryptedData = encryptDataVCC(requestData);
        const payload = { data: encryptedData };

        const response = await axios.post(`${baseURL}/openapi/card/hk/info`, payload, {
            headers: { "Content-Type": "application/json", "oaToken": token },
        });

        if (response.data.code === 1) {
            const decryptedResponse = decryptDataVCC(response.data.data);
            // const decryptedResponse = decryptDataVCC("jQ1KwU7SHYKnaTPBxNzCZCTKcJVsP6ZKYv2/99kgjA6wpuPs/iGgszts/MDo3lFJflWANyrCfQyGT+xReDOoSmJ7ECQXOzPCk6/xfECN1D0br5u3vjoE1MR9CLcXEIGgpTFHWCT68ZYoszoGv2KzvAdGNiuEyzFBuQyB3qhf/Sd0/XDE+mnszdb1swJvMxymkvod4JSvgAjm9TCPCPBRYroQ/1pIP2dNcpWXvlspuuX7g5owea8tjg98DjgqmtjS5iRZgAoNlWhW2mf+eO+SuJp7p7yl/LAHeZJibhz7lJEY6zi/OVvbeknm/DBt40Q7");
            return {
                status: true,
                card_number: decryptedResponse.cardNo,
                card_id: card.card_id,
                currency: decryptedResponse.curId,
                balance: decryptedResponse.cardBal,
                type: card.type,
                subscription_type: card.subscription_type || "Standard",
                last4: card.last4,
                account: card.account
            };
        } else {
            return { status: false, message: "Failed to fetch card details" };
        }
    } catch (error) {
        console.error("Error fetching card details:", error.message);
        return { status: false, message: "Internal server error" };
    }
}
const walletToCardTransactionHelper = async (data) => {
    try {
        let senderWallet = await getActiveWalletById(data.sender_wallet_id);

        if (!senderWallet) {
            return {
                status: false,
                message: "Invalid Sender!"
            };
        }

        // Calculate fees and exchange rates
        let decoded;
        try {
            decoded = jwt.verify(data.token, process.env.jwtKey);
        } catch (error) {
            return {
                status: false,
                message: "Token Expired or Invalid Token!"
            };
        }
        if (!decoded) {
            return {
                status: false,
                message: "Invalid Token!"
            };
        }

        const { amount, fee, feeInLocalCurrency, markup_rate, markup, local_amount, feeType, rate } = decoded

        // Check sender balance
        if (local_amount > senderWallet.balance.available) {
            return {
                status: false,
                message: "Insufficient Balance!"
            };
        }

        // Check sender limits
        const exchangedAmountSender = await getExchangeRatesToUSD(
            senderWallet.currency.code,
            'USD',
            local_amount
        );

        const limitCheckValue = limitCheck(
            exchangedAmountSender,
            senderWallet.account.level,
            senderWallet.account,
            'sending'
        );

        if (!limitCheckValue.status) {
            return {
                status: false,
                message: limitCheckValue.code
            };
        }

        // Prepare transaction record
        const ref = 'tr_' + Date.now().toString();
        const senderCurrentTime = moment().tz(senderWallet.account?.timezone || "UTC").format();

        const cardDetails = await VirtualCardModel.findById(decoded.cardId)
            .populate("account", "first_name last_name");

        const senderTransactionObj = {
            reference_id: ref,
            type: "instant",
            transaction_type: 'debit',
            service_type: 'wallet_to_card',
            payment_type: 'mastercard',
            status: 'PENDING',
            currency: {
                code: senderWallet.currency.code,
                symbol: senderWallet.currency.symbol
            },
            amount: local_amount,
            fee: feeInLocalCurrency,
            fee_type: feeType,
            recipient_received_amount: amount - fee,
            recipient_received_currency: cardDetails.currency,
            markup,
            exchange_rate: rate,
            exchange_rate_markup: markup_rate,
            total: local_amount,
            wallet_id: senderWallet.wallet_id,
            wallet: senderWallet._id,
            account: senderWallet.account._id,
            current_balance: senderWallet.balance.available,
            new_balance: senderWallet.balance.available - local_amount,
            timeline: [{
                status: 'INITIATED',
                date: senderCurrentTime,
            }]
        };

        // Update sender wallet
        await Wallet.findByIdAndUpdate(
            senderWallet._id,
            { $set: { "balance.available": senderWallet.balance.available - local_amount } }
        );

        const transaction = await Transaction.create([senderTransactionObj]);

        const requestData = {
            cardId: cardDetails.card_id,
            amt: (decoded.amountToTopup).toString()
        }

        console.log({ requestData })

        const encryptedData = encryptDataVCC(requestData);
        const payload = { data: encryptedData };

        // card topup api
        const apiResponse = await axios.post(
            `${process.env.vccdaddyURL}/openapi/card/hk/recharge`,
            payload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'oaToken': token,
                }
            }
        );

        console.log({ apiResponse });

        if (apiResponse.data.code !== 1) {
            throw new Error('Card top-up failed');
        }

        // Create VCC transaction record
        const vccTransaction = await VCCTransactionModel.create([{
            cardNo: cardDetails.card_id,
            accountId: senderWallet.account._id,
            transactionId: transaction[0].reference_id,
            billAmount: amount,
            txAmount: amount,
            currency: cardDetails.currency,
            status: 'COMPLETED',
            merchantName: 'Card Top-Up By Wallet',
            merchantCategory: "topup_by_wallet",
            transaction_type: 'mastercard_topup',
            type: "credit"
        }]);

        // Update transaction status
        await Transaction.findByIdAndUpdate(
            transaction[0]._id,
            {
                status: 'COMPLETED',
                $push: { timeline: { status: 'COMPLETED', date: new Date() } }
            }
        );

        return {
            status: true,
            message: "Transaction successful",
            data: {
                transactionId: transaction[0].reference_id,
                cardTransactionId: vccTransaction[0]._id,
                amount,
                currency: cardDetails.currency
            }
        };
    } catch (err) {
        console.error(err);
        await logError(
            `${err} (inside walletToCardTransactionHelper)`,
            "wallet_to_card",
            data.account,
            null,
        );
        return {
            status: false,
            message: "Internal server error!"
        };
    }
};

const cardToCardTransactionHelper = async (data) => {
    try {
        const senderCard = await getCardDetails(data.senderCardId)
        const receiverCard = await getCardDetails(data.receiverCardId)

        if (!senderCard.status || !receiverCard.status) {
            return {
                status: false,
                message: "Card not found"
            };
        }

        let decoded
        try {
            decoded = jwt.verify(data.token, process.env.jwtKey);
        } catch (error) {
            return { status: false, message: "Transaction token expired or invalid" };
        }

        console.log({ decoded })

        const amount = data.amount;
        const recipientAmount = decoded.recipientAmount
        const fee = decoded.feeDetails.fee;
        const totalAmount = amount + fee;

        if (senderCard.balance < totalAmount) {
            return {
                status: false,
                message: "insufficient_funds"
            };
        }

        const withdrawalPayload = encryptDataVCC({
            cardId: senderCard.card_id,
            amt: (totalAmount).toFixed(2).toString()
        })

        const rechargePayload = encryptDataVCC({
            cardId: receiverCard.card_id,
            amt: recipientAmount.toFixed(2).toString()
        })

        const withdrawalResponse = await axios.post(`${process.env.vccdaddyURL}/openapi/card/withdraw`, {
            data: withdrawalPayload
        }, {
            headers: {
                'Content-Type': 'application/json',
                'oaToken': token,
            }
        })

        if (withdrawalResponse.data.code !== 1) {
            console.error('withdrawalResponse', withdrawalResponse)
            throw new Error('Charge API failed: ' + withdrawalResponse.data.message);
        }

        const rechargeResponse = await axios.post(`${process.env.vccdaddyURL}/openapi/card/hk/recharge`, {
            data: rechargePayload
        }, {
            headers: {
                'Content-Type': 'application/json',
                'oaToken': token,
            }
        })

        if (rechargeResponse.data.code !== 1) {
            // If recharge fails, refund the charged amount
            const refundPayload = encryptDataVCC({
                cardId: senderCard.card_id,
                amt: (totalAmount).toFixed(2).toString()
            });

            const refundResponse = await axios.post(
                `${process.env.vccdaddyURL}/openapi/card/hk/recharge`,
                { data: refundPayload },
                { headers: { 'oaToken': token } }
            );

            if (refundResponse.data.code !== 1) {
                throw new Error('Recharge failed and refund also failed: ' + refundResponse.data.message);
            }
            throw new Error('Recharge API failed: ' + rechargeResponse.data.message);
        }

        const transction_id = 'tr_' + Date.now();

        await VCCTransactionModel.create([
            {
                cardNo: senderCard.card_id,
                transactionId: transction_id,
                billAmount: totalAmount,
                txAmount: amount,
                currency: senderCard.currency,
                status: 'COMPLETED',
                receiverCard: data.receiverCardId,
                reason: data?.note || undefined,
                type: "debit",
                transaction_type: "card_to_card",
                fee,
                accountId: senderCard.account
            },
            {
                cardNo: receiverCard.card_id,
                transactionId: transction_id,
                billAmount: recipientAmount,
                txAmount: recipientAmount,
                currency: receiverCard.currency,
                status: 'COMPLETED',
                senderCard: data.senderCardId,
                reason: data?.note || undefined,
                transaction_type: "card_to_card",
                type: "credit",
                accountId: receiverCard.account
            }
        ]);

        return {
            status: true,
            message: "Transaction successful",
            data: {
                transction_id,
            }
        }
    } catch (error) {
        console.error("Card-to-card transaction error:", error);

        return {
            status: false,
            message: error.response?.data?.message || error.message || "Payment gateway error"
        };
    }
}

function calculateAge(dob) {
    // Split the date string into day, month, and year
    const [day, month, year] = dob.split("-").map(Number);

    // Create a Date object for the birthdate
    const birthDate = new Date(year, month - 1, day); // Month is 0-based in JS

    // Get today's date
    const today = new Date();

    // Calculate age
    let age = today.getFullYear() - birthDate.getFullYear();

    // Adjust if the birthday hasn't occurred yet this year
    const hasBirthdayPassed =
        today.getMonth() > birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

    if (!hasBirthdayPassed) {
        age--;
    }

    return age;
}

const getCountryName = (isoCode) => {
    const country = countryCurrencyJson.find(c => c.country_code === isoCode);
    return country ? country.country_name : isoCode;
};

// Helper function to generate a unique integer from a string (e.g., TransactionID)
const generateUniqueInteger = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash); // Ensure it's positive
};


// Helper function to format date
function formatDate(dateString) {
    return momentTime(dateString).format('M/D/YYYY, h:mm:ss A');
}

// Helper function to mask card numbers
function maskCardNumber(cardNo) {
    return `**** ${cardNo.slice(-4)}`;
}

// Helper function to format amount with currency
function formatAmount(amount, currency) {
    const currencySymbols = {
        USD: '$',
        EUR: '€',
        INR: '₨',
        CHF: 'Fr',
    };
    const symbol = currencySymbols[currency] || currency;
    return `${symbol}${amount.toFixed(2)}`;
}

async function fetchCardDetails(cardNo) {
    return await VirtualCardModel.findOne({ card_id: cardNo })
        .populate("account", "first_name last_name");
}
async function formatVCCTransaction(transaction) {
    console.log({ transaction });
    const date = new Date(transaction.createdAt).toLocaleString();
    const status = transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1);
    const amount = `${transaction.type === "credit" ? "+" : "-"}${formattedAmount(transaction.txAmount)} ${transaction.currency}`;
    const fee = transaction.fee ? `\nFee: -${formattedAmount(transaction.fee)} ${transaction.currency}` : "";
    const total = transaction.fee ? `\nTotal: ${transaction.type === "credit" ? "+" : "-"}${formattedAmount(transaction.txAmount + transaction.fee)} ${transaction.currency}` : "";

    let details = "";

    // Card-to-Card Transfer
    if (transaction.transaction_type === "card_to_card") {
        let senderCardDetails, receiverCardDetails;

        if (transaction.type === "debit") {
            senderCardDetails = await fetchCardDetails(transaction.cardNo);
        } else if (transaction.senderCard) {
            senderCardDetails = transaction.senderCard;
        }

        if (transaction.type === "credit") {
            receiverCardDetails = await fetchCardDetails(transaction.cardNo);
        } else if (transaction.receiverCard) {
            receiverCardDetails = transaction.receiverCard;
        }

        const senderCard = senderCardDetails ? `${senderCardDetails.last4}` : "N/A";
        const receiverCard = receiverCardDetails ? `${receiverCardDetails.last4}` : "N/A";
        const senderName = senderCardDetails?.account ? `${senderCardDetails.account.first_name} ${senderCardDetails.account.last_name}` : "N/A";
        const receiverName = receiverCardDetails?.account ? `${receiverCardDetails.account.first_name} ${receiverCardDetails.account.last_name}` : "N/A";

        details = `
Card to Card Transfer
${transaction.type === "debit" ? `Sender Card Number: ${senderCard}\nReceiver Name: ${receiverName}\nReceiver Card Number: ${receiverCard}` : `Receiver Card Number: ${receiverCard}\nSender Name: ${senderName}\nSender Card Number: ${senderCard}`}`;
    }
    // Top-Up
    else if (transaction.merchantCategory === "topup_by_wallet") {
        const topupCardDetails = await fetchCardDetails(transaction.cardNo);
        details = `
Top Up By Wallet
Card Number: ${topupCardDetails?.last4}`;
    }
    // Card Transaction
    else {
        details = `
Card Transaction
Merchant Name: ${transaction.merchantName || "N/A"}
Merchant Category: ${transaction.merchantCategory || "N/A"}
Merchant Country: ${getCountryName(transaction.merchantCountry) || "N/A"}`;
    }

    return `${date}
Status: ${status}
Amount: ${amount}${fee}${total}
Type: ${transaction?.type?.charAt(0)?.toUpperCase() + transaction?.type?.slice(1)}${details}
Transaction ID: ${transaction.transactionId}
${transaction.reason ? `Transfer note: ${transaction.reason}` : ""}\n`;
}

const vccTopupFeeCalculation = async (currency, level_id, amount, payment_type) => {
    try {
        console.log({ currency, level_id, amount, payment_type })
        let feeDetails = await Fee.findOne({ $and: [{ service_name: payment_type }, { account_level: level_id }] })
        if (currency.toLowerCase() == 'usd') {
            let fee = feeDetails.flat_fee;
            if (feeDetails.fee_type == 'percentage') {
                fee = amount * (feeDetails.percentage_fee / 100);
            }
            return { fee: formatDecimalNumbersWithLimit(fee, 2), markup: feeDetails.percentage_markup, feeType: feeDetails.fee_type };
        } else {
            if (feeDetails.fee_type == 'flat') {
                let fee = await getExchangeRatesToUSD('USD', currency, feeDetails.flat_fee)
                return fee;
            } else {
                let fee = amount * (feeDetails.percentage_fee / 100);
                return { fee: formatDecimalNumbersWithLimit(fee, 2), markup: feeDetails.percentage_markup, feeType: feeDetails.fee_type };
            }
        }
    } catch (err) {
        console.log(err)
        return null
    }
}

const validateCardExpiry = async (cardId) => {
    try {
        const card = await PanModel.findById(cardId);
        if (!card) {
            return { status: false, message: "Card not found." };
        }

        let bytes = CryptoJS.AES.decrypt(card.panData, process.env.PAN_ENCRYPTION_KEY);
        let panDataObj = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

        const [expMonth, expYear] = panDataObj.expirydate.split('/');
        const expiryYear = parseInt(expYear) + 2000;
        const expiryMonth = parseInt(expMonth);

        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        if (expiryYear < currentYear || (expiryYear === currentYear && expiryMonth < currentMonth)) {
            // Remove expired card
            await PanModel.deleteOne({ _id: cardId });
            return { status: false, message: "Card has expired and has been removed." };
        }

        return { status: true, message: "Card is valid.", card };
    } catch (error) {
        console.error("Error validating card expiry:", error);
        return { status: false, message: "Internal server error while validating card expiry." };
    }
};

async function updateCardContacts(cardId, account) {
    const updateErrors = [];

    // Update email if exists
    if (account?.email) {
        try {
            const emailData = { cardId, card_email: account.email };
            console.log({ emailData })
            const encryptedEmail = encryptDataVCC(emailData);
            const response = await axios.post(`${baseURL}/openapi/card/update_email`,
                { data: encryptedEmail },
                { headers: { 'Content-Type': 'application/json', 'oaToken': token } }
            );

            console.log({ response: response.data })

            if (response.data.code !== 1) {
                const error = decryptDataVCC(response.data.data);
                updateErrors.push(`Email: ${error.message || 'Unknown error'}`);
            }
        } catch (error) {
            updateErrors.push(`Email: ${error.message}`);
        }
    }

    // Update phone if exists
    if (account?.phone) {
        try {
            const country = countries.find(c => c.iso3 === account.country_iso_code);
            const zoneNumber = country?.phone_code;

            if (!zoneNumber) {
                updateErrors.push('Phone: Invalid country code');
            } else {
                // Clean phone number and extract local part
                const cleanPhone = account.phone.replace(/^\+/, '');
                const localNumber = cleanPhone.startsWith(zoneNumber)
                    ? cleanPhone.slice(zoneNumber.length)
                    : cleanPhone;

                const phoneData = {
                    card_id: cardId,
                    zone_number: `+${zoneNumber}`,
                    phone_number: localNumber
                };

                console.log({ phoneData })

                const encryptedPhone = encryptDataVCC(phoneData);
                const response = await axios.post(`${baseURL}/openapi/card/update_phone`,
                    { data: encryptedPhone },
                    { headers: { 'Content-Type': 'application/json', 'oaToken': token } }
                );

                console.log({ response: response.data })

                if (response.data.code !== 1) {
                    const error = decryptDataVCC(response.data.data);
                    updateErrors.push(`Phone: ${error.message || 'Unknown error'}`);
                }
            }
        } catch (error) {
            updateErrors.push(`Phone: ${error.message}`);
        }
    }

    return updateErrors;
}

const sendWhatsAppMessage = async (phone, OTP) => {
    try {
        const payload = {
            messaging_product: "whatsapp",
            to: phone,
            type: "template",
            template: {
                name: "otp",
                language: { code: "en" },
                "components": [
                    {
                        "type": "body",
                        "parameters": [
                            {
                                "type": "text",
                                "text": OTP
                            }
                        ]
                    },
                    {
                        "type": "button",
                        "sub_type": "url",
                        "index": "0",
                        "parameters": [
                            {
                                "type": "text",
                                "text": OTP   // This fills {{1}} in your URL button
                            }
                        ]
                    }
                ]
            }
        };

        const response = await axios.post(`https://graph.facebook.com/v22.0/${process.env.WHATSAPP_ID}/messages`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
            }
        });
        return true;
    } catch (error) {
        console.error("Error sending WhatsApp message:", error?.response?.data?.error || error);
        return null;
    }
};

const whatsappMessageHelper = async (to, templateName, languageCode = 'en', bodyParams = []) => {
    try {
        const payload = {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
                name: templateName,
                language: {
                    code: languageCode,
                },
                components: [
                    {
                        type: 'body',
                        parameters: bodyParams.map(param => ({
                            type: 'text',
                            text: param.text,
                            parameter_name: param.parameter_name
                        }))
                    }
                ]
            }
        };

        const response = await axios.post(
            `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_ID}/messages`,
            payload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                },
            }
        );

        console.log('Message sent:', response.data);
        return response.data;
    } catch (error) {
        console.error('Failed to send WhatsApp message:', error.response?.data || error.message);
        return null;
    }
};

module.exports = {
    cardCountryValidation,
    walletToWalletTransactionHelper,
    limitCheck,
    balanceLimitCheck,
    getTopupLimitMessage,
    featureCheck,
    createQuotationHelper,
    sendSMSTemplate,
    sendMailsHelper,
    getTemplateId,
    getExchangeRatesToUSD,
    convertCurrency,
    getPayerRatesHelper,
    handleAttachments,
    calculateExchangeAndFees,
    calculateTopupMarkupHelper,
    getPaypalFeeHelper,
    getGeocodeData,
    logError,
    formattedAmount,
    accountBalanceUsed,
    schedulePaymentW2WHelper,
    subscribePaymentW2WHelper,
    fetchLocalOrDefaultWalletConditionally,
    getTimezonesWithGmt,
    getTimezones,
    getCountrySpecificTimezoneWithGMT,
    getCurrentTimeUsingTimezone,
    getGmtOffset,
    getUserActiveWallets,
    getActiveWallet,
    getActiveWalletById,
    getMaxValidExpiryDateVCC,
    getCardDetails,
    walletToCardTransactionHelper,
    cardToCardTransactionHelper,
    calculateAge,
    getCountryName,
    generateUniqueInteger,
    formatVCCTransaction,
    vccTopupFeeCalculation,
    validateCardExpiry,
    updateCardContacts,
    sendWhatsAppMessage,
    whatsappMessageHelper
};
