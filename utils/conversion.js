const axios = require('axios');
const Fee = require('../models/Fee.model');
const Wallet = require('../models/Wallet.model');
const ReceiverFeeModel = require('../models/ReceiverFee.model');
const FeeModel = require('../models/Fee.model');

const shortid = require('shortid');
const jwt = require('jsonwebtoken');
const CountryModel = require('../models/Country.model');
const AccountLevelModel = require('../models/Account-Level.model');
const { formatDecimalNumbersWithLimit } = require('./payerRates');

// const Thunes_KEY = process.env.APIKEY;
// const Thunes_SECRET = process.env.APISECRET;
const Thunes_KEY = process.env.API_KEY_PROD;
const Thunes_SECRET = process.env.API_SECRET_PROD;
const secretKey = process.env.jwtKey;

async function getExchangeRatesToUSD(from, to, amount) {
    try {
        if (to != from) {
            let exchangeRate = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`)
            if (exchangeRate.data.success) {
                let rate = formatDecimalNumbersWithLimit(exchangeRate.data.result, 6);
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

function formatDecimalNumbers(number) {
    // Convert the number to a string to manipulate the decimal part
    let numberString = number.toString();

    // Split the number into integer and decimal parts
    let [integerPart, decimalPart] = numberString.split('.');

    // If there's no decimal part, return the number as it is
    if (!decimalPart) {
        return number;
    }

    // Find the first occurrence of a non-zero digit
    let firstNonZeroIndex = decimalPart.search(/[1-9]/);

    // If no non-zero digit is found, return the number as it is
    if (firstNonZeroIndex === -1) {
        return number;
    }

    // Extract the significant part of the decimal
    let significantDecimalPart = decimalPart.slice(0, firstNonZeroIndex + 6);

    // Combine the integer part with the significant decimal part
    let formattedNumberString = `${integerPart}.${significantDecimalPart}`;

    // Convert the formatted string back to a number
    return parseFloat(formattedNumberString);
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

// const updateUsedLimits = async (senderAccount, receiverAccount, exchangedAmountSender, exchangedAmountReceiver) => {
//     const senderUsedLimits = senderAccount.used_limits || {};
//     const receiverUsedLimits = receiverAccount.used_limits || {};

//     // limits with 0 if undefined
//     senderUsedLimits.daily_sending_limit = senderUsedLimits.daily_sending_limit || 0;
//     senderUsedLimits.monthly_sending_limit = senderUsedLimits.monthly_sending_limit || 0;
//     senderUsedLimits.yearly_sending_limit = senderUsedLimits.yearly_sending_limit || 0;

//     receiverUsedLimits.daily_receiving_limit = receiverUsedLimits.daily_receiving_limit || 0;
//     receiverUsedLimits.monthly_receiving_limit = receiverUsedLimits.monthly_receiving_limit || 0;
//     receiverUsedLimits.yearly_receiving_limit = receiverUsedLimits.yearly_receiving_limit || 0;

//     senderUsedLimits.daily_transaction_count = senderUsedLimits.daily_transaction_count || 0;
//     senderUsedLimits.monthly_transaction_count = senderUsedLimits.monthly_transaction_count || 0;
//     senderUsedLimits.yearly_transaction_count = senderUsedLimits.yearly_transaction_count || 0;

//     // Updating the limits and counts
//     senderUsedLimits.daily_sending_limit += exchangedAmountSender;
//     senderUsedLimits.monthly_sending_limit += exchangedAmountSender;
//     senderUsedLimits.yearly_sending_limit += exchangedAmountSender;

//     receiverUsedLimits.daily_receiving_limit += exchangedAmountReceiver;
//     receiverUsedLimits.monthly_receiving_limit += exchangedAmountReceiver;
//     receiverUsedLimits.yearly_receiving_limit += exchangedAmountReceiver;

//     senderUsedLimits.daily_transaction_count += 1;
//     senderUsedLimits.monthly_transaction_count += 1;
//     senderUsedLimits.yearly_transaction_count += 1;

//     senderAccount.used_limits = senderUsedLimits;
//     receiverAccount.used_limits = receiverUsedLimits;

//     await senderAccount.save();
//     await receiverAccount.save();
// };

const updateUsedLimits = async (senderAccount, receiverAccount = null, exchangedAmountSender, exchangedAmountReceiver = null) => {
    const senderUsedLimits = senderAccount.used_limits || {};
    const receiverUsedLimits = receiverAccount ? (receiverAccount.used_limits || {}) : {};

    senderUsedLimits.daily_sending_limit = senderUsedLimits.daily_sending_limit || 0;
    senderUsedLimits.monthly_sending_limit = senderUsedLimits.monthly_sending_limit || 0;
    senderUsedLimits.yearly_sending_limit = senderUsedLimits.yearly_sending_limit || 0;

    senderUsedLimits.daily_transaction_count = senderUsedLimits.daily_transaction_count || 0;
    senderUsedLimits.monthly_transaction_count = senderUsedLimits.monthly_transaction_count || 0;
    senderUsedLimits.yearly_transaction_count = senderUsedLimits.yearly_transaction_count || 0;

    senderUsedLimits.daily_sending_limit += exchangedAmountSender;
    senderUsedLimits.monthly_sending_limit += exchangedAmountSender;
    senderUsedLimits.yearly_sending_limit += exchangedAmountSender;

    senderUsedLimits.daily_transaction_count += 1;
    senderUsedLimits.monthly_transaction_count += 1;
    senderUsedLimits.yearly_transaction_count += 1;

    if (receiverAccount && exchangedAmountReceiver !== null) {
        receiverUsedLimits.daily_receiving_limit = receiverUsedLimits.daily_receiving_limit || 0;
        receiverUsedLimits.monthly_receiving_limit = receiverUsedLimits.monthly_receiving_limit || 0;
        receiverUsedLimits.yearly_receiving_limit = receiverUsedLimits.yearly_receiving_limit || 0;

        receiverUsedLimits.daily_receiving_limit += exchangedAmountReceiver;
        receiverUsedLimits.monthly_receiving_limit += exchangedAmountReceiver;
        receiverUsedLimits.yearly_receiving_limit += exchangedAmountReceiver;

        receiverAccount.used_limits = receiverUsedLimits;
        await receiverAccount.save();
    }

    senderAccount.used_limits = senderUsedLimits;
    await senderAccount.save();
};

const revertUsedLimits = async (senderAccount, receiverAccount = null, exchangedAmountSender, exchangedAmountReceiver = null) => {
    console.log("yes i ran")
    const senderUsedLimits = senderAccount.used_limits || {};
    const receiverUsedLimits = receiverAccount ? (receiverAccount.used_limits || {}) : {};

    // Initialize sender limits if they don't exist
    senderUsedLimits.daily_sending_limit = senderUsedLimits.daily_sending_limit || 0;
    senderUsedLimits.monthly_sending_limit = senderUsedLimits.monthly_sending_limit || 0;
    senderUsedLimits.yearly_sending_limit = senderUsedLimits.yearly_sending_limit || 0;

    senderUsedLimits.daily_transaction_count = senderUsedLimits.daily_transaction_count || 0;
    senderUsedLimits.monthly_transaction_count = senderUsedLimits.monthly_transaction_count || 0;
    senderUsedLimits.yearly_transaction_count = senderUsedLimits.yearly_transaction_count || 0;

    // Revert sender limits
    senderUsedLimits.daily_sending_limit -= exchangedAmountSender;
    senderUsedLimits.monthly_sending_limit -= exchangedAmountSender;
    senderUsedLimits.yearly_sending_limit -= exchangedAmountSender;

    senderUsedLimits.daily_transaction_count = Math.max(0, senderUsedLimits.daily_transaction_count - 1);
    senderUsedLimits.monthly_transaction_count = Math.max(0, senderUsedLimits.monthly_transaction_count - 1);
    senderUsedLimits.yearly_transaction_count = Math.max(0, senderUsedLimits.yearly_transaction_count - 1);

    if (receiverAccount && exchangedAmountReceiver !== null) {
        // Initialize receiver limits if they don't exist
        receiverUsedLimits.daily_receiving_limit = receiverUsedLimits.daily_receiving_limit || 0;
        receiverUsedLimits.monthly_receiving_limit = receiverUsedLimits.monthly_receiving_limit || 0;
        receiverUsedLimits.yearly_receiving_limit = receiverUsedLimits.yearly_receiving_limit || 0;

        // Revert receiver limits
        receiverUsedLimits.daily_receiving_limit -= exchangedAmountReceiver;
        receiverUsedLimits.monthly_receiving_limit -= exchangedAmountReceiver;
        receiverUsedLimits.yearly_receiving_limit -= exchangedAmountReceiver;

        // Ensure limits do not go negative
        receiverUsedLimits.daily_receiving_limit = Math.max(0, receiverUsedLimits.daily_receiving_limit);
        receiverUsedLimits.monthly_receiving_limit = Math.max(0, receiverUsedLimits.monthly_receiving_limit);
        receiverUsedLimits.yearly_receiving_limit = Math.max(0, receiverUsedLimits.yearly_receiving_limit);

        receiverAccount.used_limits = receiverUsedLimits;
        await receiverAccount.save();
    }

    // Ensure sender limits do not go negative
    senderUsedLimits.daily_sending_limit = Math.max(0, senderUsedLimits.daily_sending_limit);
    senderUsedLimits.monthly_sending_limit = Math.max(0, senderUsedLimits.monthly_sending_limit);
    senderUsedLimits.yearly_sending_limit = Math.max(0, senderUsedLimits.yearly_sending_limit);

    senderAccount.used_limits = senderUsedLimits;
    await senderAccount.save();

    console.log("saved")
};

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

    // console.log({
    //     amount,
    //     daily_sending_limit_used,
    //     monthly_sending_limit_used,
    //     yearly_sending_limit_used,
    //     daily: level.daily_sending_limit,
    //     monthly: level.monthly_sending_limit,
    //     yearly: level.yearly_sending_limit,

    // });

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

    console.log(daily_sending_limit, "<", amount, "+", daily_sending_limit_used)

    if (type === 'sending') {
        if (daily_sending_limit >= amount + daily_sending_limit_used &&
            monthly_sending_limit >= amount + monthly_sending_limit_used &&
            yearly_sending_limit >= amount + yearly_sending_limit_used &&
            transaction_amount_limit >= amount &&
            daily_transaction_count >= daily_transaction_count_used &&
            monthly_transaction_count >= monthly_transaction_count_used &&
            yearly_transaction_count >= yearly_transaction_count_used) {

            console.log('limitCheck: true');
            return { status: true, code: 'OK' };
        } else {

            if (daily_sending_limit < amount + daily_sending_limit_used) {
                console.log('limitCheck1: True', daily_sending_limit, "<", amount, "+", daily_sending_limit_used);
                return { status: false, code: 'sdl400' }; // Daily Sending Limit exceeded
            } else if (monthly_sending_limit < amount + monthly_sending_limit_used) {
                console.log('limitCheck2: true', monthly_sending_limit, "<", amount, "+", monthly_sending_limit_used);
                return { status: false, code: 'sml400' }; // Monthly Sending Limit exceeded
            } else if (yearly_sending_limit < amount + yearly_sending_limit_used) {
                console.log('limitCheck3: true', yearly_sending_limit, "<", amount, "+", yearly_sending_limit_used);
                return { status: false, code: 'syl400' }; // Yearly Sending Limit exceeded
            } else if (transaction_amount_limit < amount) {
                console.log('limitCheck4: true', transaction_amount_limit, "<", amount);
                return { status: false, code: 'tal400' }; // Transaction Amount Limit exceeded
            } else if (daily_transaction_count < daily_transaction_count_used) {
                console.log('limitCheck5: true', daily_transaction_count, "<", daily_transaction_count_used);
                return { status: false, code: 'dtc400' }; // Daily Transaction Count Limit exceeded
            } else if (monthly_transaction_count < monthly_transaction_count_used) {
                console.log('limitCheck6: true', monthly_transaction_count, "<", monthly_transaction_count_used);
                return { status: false, code: 'mtc400' }; // Monthly Transaction Count Limit exceeded
            } else if (yearly_transaction_count < yearly_transaction_count_used) {
                console.log('limitCheck7: true', yearly_transaction_count, "<", yearly_transaction_count_used);
                return { status: false, code: 'ytc400' }; // Yearly Transaction Count Limit exceeded
            }
        }
    } else if (type === 'topup') {
        if (daily_receiving_limit >= (amount + daily_receiving_limit_used) &&
            monthly_receiving_limit >= (amount + monthly_receiving_limit_used) &&
            yearly_receiving_limit >= (amount + yearly_receiving_limit_used) &&
            topup_min_amount <= amount && amount <= topup_max_amount) {
            return { status: true, code: 'OK' };
        } else {
            if (daily_receiving_limit < amount + daily_receiving_limit_used) {
                return { status: false, code: 'rdl400' }; //Daily Receiving Limit exceeded
            } else if (monthly_receiving_limit < amount + monthly_receiving_limit_used) {
                return { status: false, code: 'rml400' }; //Monthly Receiving Limit exceeded
            } else if (yearly_receiving_limit < amount + yearly_receiving_limit_used) {
                return { status: false, code: 'ryl400' }; //Yearly Receiving Limit exceeded
            } else if (topup_min_amount > amount || amount > topup_max_amount) {
                return { status: false, code: 'tpl400' }; //Topup Amount Limit exceeded
            }

        }
    } else {
        if (daily_receiving_limit >= amount &&
            monthly_receiving_limit >= amount &&
            yearly_receiving_limit >= amount) {
            return { status: true, code: 'OK' };
        } else {
            if (daily_receiving_limit < amount) {
                return { status: false, code: 'rdl400' }; //Daily Receiving Limit exceeded
            } else if (monthly_receiving_limit < amount) {
                return { status: false, code: 'rml400' }; //Monthly Receiving Limit exceeded
            } else if (yearly_receiving_limit < amount) {
                return { status: false, code: 'ryl400' }; //Yearly Receiving Limit exceeded
            }
            // else {
            //     return { status: false, code: 'tal400' }; //Transaction Amount Limit exceeded
            // }
        }
    }
}

function featureCheck(param1, param2, level) {
    // console.log(param1, param2, level, "param1, param2, level");
    return level[param1][param2];
}

async function gettingExchangeRates(from, to, amount, level_id, type, transaction_type) {
    console.log({ from, to, amount, level_id, type, transaction_type });
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
                    actual_rate: exchange_rate.data.info.rate,
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

async function createQuotationHelper(data) {

    try {
        const API_URL = `${process.env.THUNES_PROD_URL}/v2/money-transfer/quotations`;
        // const API_URL = '${process.env.THUNES_PROD_URL}/v2/money-transfer/quotations';
        const authHeader = `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`;
        const config = {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        };

        const response = await axios.post(API_URL, data, config);

        console.log(response.data, "response")

        return { status: true, data: response.data };

    } catch (err) {
        console.log(err);
        return { status: false, data: err?.response?.data?.errors ?? err.message }
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

async function getPayerRatesHelper(payerId) {

    try {
        const API_URL = `${process.env.THUNES_PROD_URL}/v2/money-transfer/payers/${payerId}/rates`;
        const authHeader = `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`;

        const config = {
            headers: {
                'Authorization': authHeader,
            }
        };

        // axios.get(API_URL, config).then((response) => {
        //     console.log(response.data, "response")

        // }).catch((error) => {
        //     console.log(error.response.data.errors)

        // })

        const response = await axios.get(API_URL, config);

        return { status: true, data: response };

    } catch (err) {
        console.log(err);
        return { status: false, data: err?.response?.data?.errors ?? err.message }
    }

}

// Exchange rates for international
const processExchangeRates = async ({ transaction_type, amount, service_name, wallet_id, channel_name, payerId, external_id, service_id, country }) => {
    console.log("processExchangeRates", transaction_type, amount, service_name, wallet_id, channel_name, payerId, external_id, service_id, country)
    try {
        const walletDetails = await Wallet.findById(wallet_id).populate([{ path: 'account', populate: [{ path: 'level' }] }])
        if (!walletDetails) {
            return {
                message: "Wallet not found",
                status: false
            }
        }

        amount = formatDecimalNumbersWithLimit(amount);

        const receivingCountryFee = await ReceiverFeeModel.findOne({ country, service_name: channel_name });
        const user_wallet_details = walletDetails.account.level
        let accountLevel
        if (user_wallet_details.level_no === 1) {
            accountLevel = await AccountLevelModel.findOne({ $and: [{ level_no: 2 }, { country: walletDetails.account.country }, { category: user_wallet_details.category }, { account_type: "individual" }] });
            feeDetails = await FeeModel.findOne({ $and: [{ service_name }, { account_level: accountLevel._id }] }).populate('account_level');
            console.log(feeDetails, "feeDetails")
        } else {
            accountLevel = user_wallet_details
            feeDetails = await FeeModel.findOne({ $and: [{ service_name }, { account_level: user_wallet_details._id }] }).populate('account_level');
        }

        console.log(accountLevel, "accountLevel", user_wallet_details)

        let fee_type = receivingCountryFee ? receivingCountryFee.fee_type : feeDetails?.fee_type;
        let flat_fee = receivingCountryFee ? receivingCountryFee.flat_fee : feeDetails?.flat_fee;
        let percentage_fee = receivingCountryFee ? receivingCountryFee.percentage_fee : feeDetails?.percentage_fee;
        let fee_currency = receivingCountryFee ? receivingCountryFee.fee_currency : feeDetails?.fee_currency;

        // let markup_fee = receivingCountryFee ? receivingCountryFee.flat_markup : feeDetails?.flat_markup;
        let markup_type = receivingCountryFee ? receivingCountryFee.markup_type : feeDetails?.markup_type;
        let percentage_markup = receivingCountryFee ? receivingCountryFee.percentage_markup : feeDetails?.percentage_markup;
        // let markup_currency = receivingCountryFee ? receivingCountryFee.markup_currency : feeDetails?.markup_currency;

        let exchangedAmountSender = await convertCurrency(walletDetails.currency.code, 'USD', amount)


        let paymentType;
        if (service_id == 1) {
            paymentType = 'mobile_money';
        } else if (service_id == 2) {
            paymentType = 'bank';
        } else if (service_id == 3) {
            paymentType = 'cash_pickup';
        } else {
            paymentType = 'card_payment';
        }

        let featureCheck1 = await featureCheck("international_transfer", paymentType, accountLevel);

        if (!featureCheck1) {
            return {
                status: false,
                message: "Feature not available!"
            };
        }

        let limitCheck1 = limitCheck(exchangedAmountSender, accountLevel, walletDetails.account, 'sending');

        if (!limitCheck1.status) {
            return {
                status: false,
                message: limitCheck1.code
            }
        }

        if (walletDetails.balance.available < amount) {
            return {
                status: false,
                message: "Insufficient balance!"
            };
        }

        // const API_URL = `${process.env.THUNES_PROD_URL}/v2/money-transfer/payers/${payerId}/rates`;

        // const config = {
        //     headers: {
        //         'Authorization': `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`,
        //     }
        // };

        // console.log(config, "config", API_URL);
        // const response = await axios.get(API_URL, config);

        const getPayerRates = await getPayerRatesHelper(payerId);
        const response = getPayerRates.data

        if (!getPayerRates?.status) {
            return { status: false, message: response?.data }
        }

        console.log(response?.data?.rates?.C2C, "responseingetrates")

        console.log({ fee_type, flat_fee, percentage_fee, fee_currency, percentage_markup, markup_type, fromCurrency: walletDetails.currency.code, toCurrency: response.data.destination_currency, amount });

        const mode = 'DESTINATION_AMOUNT';
        const Thunes_Currency = 'USD';
        const Thunes_Country = 'USA';
        const destinationCurrency = response.data.destination_currency;
        const min_max_values = response.data.rates[transaction_type][Thunes_Currency][0]
        let Max_Amount;
        let Min_Amount;





        let feeExchange;
        if (fee_type === 'flat') {
            fee = flat_fee;
            feeExchange = await convertCurrency(fee_currency, walletDetails.currency.code, fee);
        } else {
            feeExchange = amount * (percentage_fee / 100);
        }

        feeExchange = formatDecimalNumbersWithLimit(feeExchange);
        let exchange_rate_temp = await convertCurrency(walletDetails.currency.code, destinationCurrency, 1);
        exchange_rate_temp = formatDecimalNumbers(exchange_rate_temp);
        let wallet_to_thunes_rate = await convertCurrency(walletDetails.currency.code, Thunes_Currency, 1);
        wallet_to_thunes_rate = formatDecimalNumbers(wallet_to_thunes_rate);
        let system_to_thunes_rate = await convertCurrency(fee_currency, walletDetails.currency.code, 1);
        system_to_thunes_rate = formatDecimalNumbers(system_to_thunes_rate);

        let exchange_rate;
        let markupReceived;

        if (destinationCurrency !== walletDetails.currency.code) {
            exchange_rate = formatDecimalNumbers((exchange_rate_temp - ((percentage_markup / 100) * exchange_rate_temp)));
            markupReceived = {
                markup_type: markup_type,
                exchange_rate_markup: formatDecimalNumbers((exchange_rate_temp - ((percentage_markup / 100) * exchange_rate_temp))),
                markup: formatDecimalNumbers(percentage_markup),
                currency: walletDetails.currency.code,
            };
        } else {
            exchange_rate = 1;
            markupReceived = {
                markup_type: "N/A",
                exchange_rate_markup: exchange_rate_temp,
                markup: 0,
                currency: walletDetails.currency.code,
            };
        }

        // if (Max_Amount === null) {
        //     Max_Amount = 100000;
        // }

        // if (Min_Amount === null) {
        //     Min_Amount = 0;
        // }

        // let converted_max_amount = Max_Amount * exchange_rate;
        // let converted_min_amount = Min_Amount * exchange_rate;


        const limitedAmountCheck = amount - feeExchange
        let converted_amount = limitedAmountCheck * wallet_to_thunes_rate;

        console.log({ limitedAmountCheck, exchange_rate, converted_amount })

        // if (Max_Amount <= converted_amount) {
        //     return { status: false, message: "Amount exceeds maximum allowed", value: converted_max_amount }
        // }

        // if (converted_amount <= Min_Amount) {
        //     return { status: false, message: "Amount is below the minimum allowed", value: converted_min_amount }
        // }

        // getting minimum and maximum values from thunes
        const authHeader = `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`;
        const config = {
            headers: {
                'Authorization': authHeader,
            }
        };
        const payer_rates = await axios.get(`${process.env.THUNES_PROD_URL}/v2/money-transfer/payers/${payerId}`, config)

        console.log(payer_rates, "payer_rates", payer_rates.data[transaction_type], payer_rates.data.transaction_types[transaction_type])

        const min_thunes_value = payer_rates.data.transaction_types[transaction_type].minimum_transaction_amount
        const max_thunes_value = payer_rates.data.transaction_types[transaction_type].maximum_transaction_amount

        console.log({ min_thunes_value, max_thunes_value })

        if (!max_thunes_value) {
            Max_Amount = null;
        } else {
            Max_Amount = max_thunes_value
        }

        if (!min_thunes_value) {
            Min_Amount = 0;
        } else {
            Min_Amount = min_thunes_value
        }

        const requestData = {
            external_id: external_id,
            payer_id: payerId,
            mode,
            transaction_type,
            source: {
                amount: null,
                currency: Thunes_Currency,
                country_iso_code: Thunes_Country,
            },
            destination: {
                amount: 1 > Min_Amount ? 1 : Min_Amount,
                currency: destinationCurrency,
            },
        };

        console.log(requestData, "requestData")

        const quotationResult = await createQuotationHelper(requestData);

        console.log(quotationResult, "quotationResult")

        if (!quotationResult?.status) {
            return { status: false, message: quotationResult?.data }
        }

        console.log(quotationResult, "quotationResult")

        // NEW Calculation
        const sending_currency = walletDetails.currency.code
        const receiving_currency = destinationCurrency

        let google_fx = await convertCurrency(Thunes_Currency, receiving_currency, 1);
        google_fx = formatDecimalNumbers(google_fx)
        let thunes_fx = min_max_values.wholesale_fx_rate
        thunes_fx = formatDecimalNumbers(thunes_fx)
        let sending_to_thunes_fx = await convertCurrency(sending_currency, Thunes_Currency, 1);
        sending_to_thunes_fx = formatDecimalNumbers(sending_to_thunes_fx)
        let eurToKes = await convertCurrency(sending_currency, receiving_currency, 1)
        eurToKes = formatDecimalNumbers(eurToKes)

        const fee_thunes = quotationResult.data.fee.amount

        const rate_diff = thunes_fx / google_fx

        const sending_to_thunes_rate = sending_to_thunes_fx   // ref(3)  

        const converted_thunes_fee = quotationResult.data.fee.amount / sending_to_thunes_rate // ref(5)

        let calculated_fee
        if (fee_type === 'flat') {
            calculated_fee = (flat_fee + fee_thunes) / sending_to_thunes_rate
        } else {
            calculated_fee = amount * (percentage_fee / 100);
            calculated_fee = calculated_fee + converted_thunes_fee
        }

        const sending_amount_after_fee = amount - calculated_fee

        const usd_sent_from_thunes = sending_amount_after_fee * sending_to_thunes_rate // ref(4)

        const markup_value = thunes_fx * (percentage_markup / 100)

        const thunes_rate_after_markup = formatDecimalNumbers(thunes_fx - markup_value)

        const destination_amount = usd_sent_from_thunes * thunes_rate_after_markup

        const final_exchange_rate = formatDecimalNumbers(destination_amount / sending_amount_after_fee)

        console.log(
            {
                google_fx,
                thunes_fx,
                eurToKes,
                sending_to_thunes_fx,
                fee_thunes,
                rate_diff,
                sending_to_thunes_rate,
                converted_thunes_fee,
                calculated_fee,
                sending_amount_after_fee,
                usd_sent_from_thunes,
                markup_value,
                thunes_rate_after_markup,
                destination_amount,
                flat_fee,
                percentage_markup,
                fee_type,
                percentage_fee
            },)

        // // // // // // // // // // 
        let thunes_rate = quotationResult.data.wholesale_fx_rate;
        let thunes_fee = formatDecimalNumbersWithLimit(quotationResult.data.fee.amount);

        let convertedThunesFee = await convertCurrency(Thunes_Currency, walletDetails.currency.code, thunes_fee);
        convertedThunesFee = formatDecimalNumbersWithLimit(convertedThunesFee);

        let totalFeeConverted = formatDecimalNumbersWithLimit(convertedThunesFee + feeExchange);
        console.log({ thunes_fee, feeExchange, convertedThunesFee, totalFeeConverted });

        let amountAfterFee = formatDecimalNumbersWithLimit(amount - totalFeeConverted);

        console.log(exchange_rate, "exchange_rate")


        console.log(amountAfterFee, "amountAfterFee");

        // minimum value work

        let minimum_value;
        let calculated_minimum = converted_thunes_fee + feeExchange
        calculated_minimum = calculated_minimum + (calculated_minimum * 0.02);
        let converted_calculated_minium = wallet_to_thunes_rate * calculated_minimum

        // comparing thuness_fee + instapay fee + 2% and thunes min and setting the minimum value accordingly
        // if (converted_calculated_minium > Min_Amount) {
        //     minimum_value = converted_calculated_minium
        // } else {
        //     minimum_value = Min_Amount
        // }
        let destination_to_sending_minimum = await convertCurrency(destinationCurrency, sending_currency, Min_Amount || 1)
        if (converted_calculated_minium > destination_to_sending_minimum) {
            minimum_value = converted_calculated_minium
        } else {
            minimum_value = destination_to_sending_minimum
        }

        console.log(minimum_value, "minimum_value", amount, Min_Amount, destination_to_sending_minimum, calculated_minimum, wallet_to_thunes_rate, converted_calculated_minium)

        if (minimum_value > amount) {
            return { status: false, message: `Amount is below the minimum allowed`, value: minimum_value, currency: walletDetails.currency.code }
        }

        if (amountAfterFee < 0) {
            return { status: false, message: `Amount is below the minimum allowed`, value: minimum_value, currency: walletDetails.currency.code }
        }

        // maximum amount work
        // get sending limit, amount per transaction, and thunes max value, then sending max value accordingly
        let daily_sending_limit_used = walletDetails.account.used_limits.daily_sending_limit || 0
        let monthly_sending_limit_used = walletDetails.account.used_limits.monthly_sending_limit || 0
        let yearly_sending_limit_used = walletDetails.account.used_limits.yearly_sending_limit || 0

        let transaction_amount_limit = accountLevel.transaction_amount_limit;

        let daily_sending_limit = accountLevel.daily_sending_limit;
        let monthly_sending_limit = accountLevel.monthly_sending_limit;
        let yearly_sending_limit = accountLevel.yearly_sending_limit;

        if (walletDetails.account.is_external_limit) {
            daily_sending_limit = walletDetails.account.external_limits.daily_sending_limit;
            monthly_sending_limit = walletDetails.account.external_limits.monthly_sending_limit;
            yearly_sending_limit = walletDetails.account.external_limits.yearly_sending_limit;

            transaction_amount_limit = walletDetails.account.external_limits.transaction_amount_limit;
        }

        // getting the minimum sending limit from daily, monthly, yearly
        let minimum_sending_limit = Math.min(daily_sending_limit - daily_sending_limit_used, monthly_sending_limit - monthly_sending_limit_used, yearly_sending_limit - yearly_sending_limit_used);
        // per transaction limit
        minimum_sending_limit = Math.min(minimum_sending_limit, transaction_amount_limit);
        // minimum_sending_limit = sending_to_thunes_fx * minimum_sending_limit;
        // minimum from thunes and system limit
        minimum_sending_limit = Math.min(minimum_sending_limit, !Max_Amount ? minimum_sending_limit : Max_Amount)

        console.log({ converted_amount, minimum_sending_limit })

        let max_value_in_sending_curr = await convertCurrency(Thunes_Currency, walletDetails.currency.code, minimum_sending_limit)

        if (converted_amount > minimum_sending_limit) {
            return {
                status: false, message: `Amount is above the maximum allowed`, value: max_value_in_sending_curr
            }
        }



        // let exchange_rate_limits = await convertCurrency(fee_currency, walletDetails.currency.code, 1)


        // thunes fee + hamari fee = will be minimum
        // then we have two condition
        // 1) two minimums we have, then we have to found, which is maximum from both of them then we have to return the maximum from them as a min on front
        // 2) we have entered 1000 from 1000 balance, but the 

        let totalAmountConverted = formatDecimalNumbersWithLimit(amountAfterFee * thunes_rate);
        let totalAmountConvertedWithMarkup = formatDecimalNumbersWithLimit(amountAfterFee * exchange_rate);

        let recipientReceivingAmount = await convertCurrency(walletDetails.currency.code, destinationCurrency, totalAmountConvertedWithMarkup);


        console.log({ totalAmountConverted, totalAmountConvertedWithMarkup, thunes_rate, exchange_rate_with_markup: exchange_rate, amountAfterFeeDedection: amountAfterFee, recipientReceivingAmount });

        return {
            result: {
                exchanged_rate: {
                    value: final_exchange_rate,
                    currency: destinationCurrency,
                },
                fee: {
                    // value: totalFeeConverted,
                    value: formatDecimalNumbersWithLimit(calculated_fee),
                    currency: walletDetails.currency.code,
                },
                recipient: {
                    // value: formatDecimalNumbersWithLimit(totalAmountConvertedWithMarkup),
                    value: formatDecimalNumbersWithLimit(destination_amount),
                    currency: destinationCurrency,
                },
                total: {
                    value: formatDecimalNumbersWithLimit(amount),
                    currency: walletDetails.currency.code,
                },
            },
            extras: {
                totalAmountConverted,
                totalAmountConvertedWithMarkup,
                thunes_rate,
                exchange_rate_with_markup: final_exchange_rate,
                amountAfterFeeDedection: amountAfterFee,
                recipientReceivingAmount: formatDecimalNumbersWithLimit(destination_amount),
                thunes_fee,
                calculated_fee,
                converted_thunes_fee,
                calculated_fee,
                markup_value,
                fee_type,
                percentage_markup,
                original_exchange_rate: exchange_rate_temp,
            },
            status: true,
        };

    } catch (err) {
        console.error("Error in processExchangeRates:", err.message ?? err);
        return { status: false, message: err.message ?? err };
    }
};

const compareNestedObjects = (obj1, obj2) => {
    let differences = [];
    let status = true;

    const compare = (obj1, obj2, path = '') => {
        for (let key in obj1) {
            const currentPath = path ? `${path}.${key}` : key;
            if (obj1.hasOwnProperty(key)) {
                if (typeof obj1[key] === 'object' && obj1[key] !== null && !Array.isArray(obj1[key])) {
                    compare(obj1[key], obj2[key], currentPath);
                } else if (obj1[key] !== obj2[key]) {
                    differences.push(currentPath);
                    status = false;
                }
            }
        }
        for (let key in obj2) {
            const currentPath = path ? `${path}.${key}` : key;
            if (obj2.hasOwnProperty(key) && !obj1.hasOwnProperty(key)) {
                differences.push(currentPath);
                status = false;
            }
        }
    };

    compare(obj1, obj2);

    return { differences, status };
};

async function createQuotationNew(data) {
    try {

        const external_id = shortid.generate()

        const { token, transaction_type, amount, wallet_id, payerId, service_id, payout_method, iso_code } = data;

        const country = await CountryModel.findOne({ country_iso_code: iso_code })

        let channel_name, service_name;
        if (payout_method === "1") {
            channel_name = "mobile_money";
            service_name = "international_mobile_wallet";
        } else if (payout_method === "2") {
            channel_name = "bank_account";
            service_name = "international_bank_transfer";
        } else if (payout_method === "3") {
            channel_name = "cash_pickup";
            service_name = "international_cash_pickup";
        } else {
            channel_name = "card_payment";
            service_name = "international_card_payment";
        }

        const result = await processExchangeRates({
            transaction_type,
            amount,
            service_name,
            wallet_id,
            channel_name,
            payerId,
            external_id,
            service_id: payout_method,
            country: country._id
        });

        console.log(result, "ifferences in exchange rate")
        if (result.status === false) {
            return { status: false, message: "Something went wrong while processing exchange rates", };
        }

        const decoded = jwt.verify(token, secretKey);
        // console.log(decoded, "decoded", result);

        const obj1 = {
            result: decoded.result,
            // extras: decoded.extras,
        }

        const obj2 = {
            result: result.result,
            // extras: result.extras,
        }

        console.log(obj1, "obj1", obj2, "obj2");

        const difference = compareNestedObjects(obj1, obj2);

        console.log(difference, "difference");

        // if (difference.status === false) {
        //     return { status: false, message: "Differences in exchange rates", };
        // }

        const mode = 'DESTINATION_AMOUNT'
        const Thunes_Currency = 'USD'
        const Thunes_Country = 'USA'
        const external_id1 = shortid.generate()
        const requestData = {
            external_id: external_id1,
            payer_id: payerId,
            mode,
            transaction_type: transaction_type,
            source: {
                amount: null,
                currency: Thunes_Currency,
                country_iso_code: Thunes_Country
            },
            destination: {
                amount: parseInt(obj1.result.recipient.value),
                currency: obj2.result.exchanged_rate.currency
            },
        };

        console.log(requestData, "requestData");
        const quotationResult = await createQuotationHelper(requestData);

        return {
            status: true, message: {
                QuotationID: external_id1,
                token,
            }
        }

    } catch (error) {
        console.error('Error creating quotation:', error);
        return { status: false, message: "Something went wrong while creating quotation" };
    }
}

async function checkTransactionLimitsForSender(exchangedAmountSender, walletDetails, limitType, withdrawal = false) {
    let limitCheckResult = limitCheck(exchangedAmountSender, walletDetails.account.level, walletDetails.account, limitType);

    let senderLimit, senderDailyLimit, senderMonthlyLimit, senderYearlyLimit;
    if (!walletDetails.account.is_external_limit) {
        senderLimit = walletDetails.account.level.transaction_amount_limit;
        senderDailyLimit = walletDetails.account.level.daily_sending_limit;
        senderMonthlyLimit = walletDetails.account.level.monthly_sending_limit;
        senderYearlyLimit = walletDetails.account.level.yearly_sending_limit;
    } else {
        senderLimit = walletDetails.account.external_limits.transaction_amount_limit;
        senderDailyLimit = walletDetails.account.external_limits.daily_sending_limit;
        senderMonthlyLimit = walletDetails.account.external_limits.monthly_sending_limit;
        senderYearlyLimit = walletDetails.account.external_limits.yearly_sending_limit;
    }

    let daily_sending_limit_used = walletDetails.account.used_limits.daily_sending_limit;
    let monthly_sending_limit_used = walletDetails.account.used_limits.monthly_sending_limit;
    let yearly_sending_limit_used = walletDetails.account.used_limits.yearly_sending_limit;

    const convertedSenderLimit = await getExchangeRatesToUSD('USD', walletDetails.currency.code, senderLimit);
    const convertedDailyLimit = await getExchangeRatesToUSD('USD', walletDetails.currency.code, senderDailyLimit);
    const convertedMonthlyLimit = await getExchangeRatesToUSD('USD', walletDetails.currency.code, senderMonthlyLimit);
    const convertedYearlyLimit = await getExchangeRatesToUSD('USD', walletDetails.currency.code, senderYearlyLimit);
    const convertedDailyLimitUsed = await getExchangeRatesToUSD('USD', walletDetails.currency.code, daily_sending_limit_used);
    const convertedMonthlyLimitUsed = await getExchangeRatesToUSD('USD', walletDetails.currency.code, monthly_sending_limit_used);
    const convertedYearlyLimitUsed = await getExchangeRatesToUSD('USD', walletDetails.currency.code, yearly_sending_limit_used);

    if (!limitCheckResult.status) {
        let limitMessages
        if (withdrawal) {

            limitMessages = {
                sdl400: `Your daily transaction left limit is ${(convertedDailyLimit - convertedDailyLimitUsed).toFixed(2) ?? "N/A"} ${walletDetails.currency.code}.`,
                sml400: `Your monthly transaction left limit is ${(convertedMonthlyLimit - convertedMonthlyLimitUsed).toFixed(2) ?? "N/A"} ${walletDetails.currency.code}.`,
                syl400: `Your yearly transaction left limit is ${(convertedYearlyLimit - convertedYearlyLimitUsed).toFixed(2) ?? "N/A"} ${walletDetails.currency.code}.`,
                tal400: `You can send the maximum of ${convertedSenderLimit?.toFixed(2) ?? "N/A"} ${walletDetails.currency.code} per transaction.`,
                dtc400: `Your daily transaction count has exceeded the limit`,
                mtc400: `Your monthly transaction count has exceeded the limit`,
                ytc400: `Your yearly transaction count has exceeded the limit`
            };
        } else {
            limitMessages = {
                sdl400: `Your daily transaction left limit is ${(convertedDailyLimit - convertedDailyLimitUsed).toFixed(2) ?? "N/A"} ${walletDetails.currency.code}. Please enter the amount again.`,
                sml400: `Your monthly transaction left limit is ${(convertedMonthlyLimit - convertedMonthlyLimitUsed).toFixed(2) ?? "N/A"} ${walletDetails.currency.code}. Please enter the amount again.`,
                syl400: `Your yearly transaction left limit is ${(convertedYearlyLimit - convertedYearlyLimitUsed).toFixed(2) ?? "N/A"} ${walletDetails.currency.code}. Please enter the amount again.`,
                tal400: `You can send the maximum of ${convertedSenderLimit?.toFixed(2) ?? "N/A"} ${walletDetails.currency.code} per transaction. Please enter the amount again.`,
                dtc400: `Your daily transaction count has exceeded the limit`,
                mtc400: `Your monthly transaction count has exceeded the limit`,
                ytc400: `Your yearly transaction count has exceeded the limit`
            };

        }
        const limitMessage = limitMessages[limitCheckResult.code];
        return { status: false, message: limitMessage };
    }

    return { status: true };
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
                let fee = await getExchangeRatesToUSD('USD', wallet.currency.code, feeDetails.flat_fee)
                return formatDecimalNumbersWithLimit(fee, 2);
            } else {
                let fee = amount * (feeDetails.percentage_fee / 100);
                return formatDecimalNumbersWithLimit(fee, 2);
            }
        }
    } catch (err) {
        return null
    }
}

module.exports = { requestExchangeRateApi, getExchangeRatesToUSD, updateUsedLimits, revertUsedLimits, limitCheck, featureCheck, gettingExchangeRates, processExchangeRates, createQuotationNew, checkTransactionLimitsForSender, formatDecimalNumbers, topUpFeeCalculation }
