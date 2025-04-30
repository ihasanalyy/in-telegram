const axios = require('axios');
const Fee = require('../models/Fee.model');
const Account = require('../models/Account.model');

// const Thunes_KEY = process.env.APIKEY;
// const Thunes_SECRET = process.env.APISECRET;
const Thunes_KEY = process.env.API_KEY_PROD;
const Thunes_SECRET = process.env.API_SECRET_PROD;
const THUNES_CURRENCY = 'USD';
const THUNES_COUNTRY = 'USA';

const makeApiRequest = async (url) => {

    const authHeader = `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`;
    const config = {
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
        }
    };
    try {
        const response = await axios.get(url, config);
        return response.data;
    } catch (error) {
        console.error(`Error making API request: ${error}`);
        throw error;
    }
};

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

    // here i have replaced percentage_markup with markup_fee as it was undefined
    if (markup_type === 'percentage') {
        markup = (exchange_rate - ((markup_fee / 100) * exchange_rate))
        exchange_rate_with_markup = markup
    }

    return exchange_rate_with_markup;
}


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

const calculatePayerRatesLogic = async (payerId, account_id, transactionType, amount, service_name = "international_bank_transfer", channel_name = "bank_account") => {
    try {
        // const wallet = await Wallet.findOne({ _id: walletId }).populate('account');
        const accountDetails = await Account.findOne({ _id: account_id, active: true })
        console.log({ level: accountDetails.level, account_id }, 'accountDetails');
        // const { currency: { code: wallet_currency }, balance: { available: balance }, account: { country, level: { _id: account_level_id } } } = wallet;
        const walletCurrency = 'USD'

        // console.log(payerId, account_id, transactionType, amount, service_name, channel_name, 'calculatePayerRatesLogic');

        let receivingCountryFee = await ReceiverFee.findOne({ country: accountDetails.country, service_name: channel_name });
        let feeDetails = await Fee.findOne({ $and: [{ service_name }, { account_level: accountDetails.level }] }).populate('account_level');

        // console.log({ receivingCountryFee, feeDetails }, "receivingCountryFee");

        const thune_currency = THUNES_CURRENCY;
        let wallet_to_thune_exchangerate = 1;
        let wallet_to_thune_currency_amount = amount;

        if (walletCurrency !== thune_currency) {
            wallet_to_thune_exchangerate = await convertCurrency(walletCurrency, thune_currency, 1);
            wallet_to_thune_exchangerate = parseFloat(wallet_to_thune_exchangerate.toFixed(2));
            wallet_to_thune_currency_amount = amount * wallet_to_thune_exchangerate;
        }

        const fee_type = receivingCountryFee?.fee_type || feeDetails?.fee_type;
        const flat_fee = receivingCountryFee?.flat_fee || feeDetails?.flat_fee;
        const percentage_fee = receivingCountryFee?.percentage_fee || feeDetails?.percentage_fee;
        const fee_currency = receivingCountryFee?.fee_currency || feeDetails?.fee_currency;
        const sending_limit = feeDetails?.account_level.transaction_amount_limit;
        const daily_sending_limit = feeDetails?.account_level.daily_sending_limit;
        const monthly_sending_limit = feeDetails?.account_level.monthly_sending_limit;
        const yearly_sending_limit = feeDetails?.account_level.yearly_sending_limit;

        console.log({ fee_type, flat_fee, percentage_fee, fee_currency, sending_limit, daily_sending_limit, monthly_sending_limit, yearly_sending_limit }, "calculatePayerRatesLogic");

        const API_URL = `${process.env.THUNES_PROD_URL}/v2/money-transfer/payers/${payerId}/rates`;
        const rates = await makeApiRequest(API_URL);
        const { destination_currency, rates: ratesData } = rates;

        if (!ratesData[transactionType]) {
            return { error: "Transaction Type Not Supported by Payer" };
        }

        let { source_amount_max: Max_Amount, source_amount_min: Min_Amount, wholesale_fx_rate: exchange_rate } = ratesData[transactionType][thune_currency][0];
        const parsed_exchange_rate = parseFloat(exchange_rate.toFixed(2));

        let fee = await calculateFee(fee_type, fee_currency, walletCurrency, flat_fee, percentage_fee, amount);
        let exchange_rate_with_markup = await calculateExchangeRateWithMarkup(receivingCountryFee?.markup_type, receivingCountryFee?.markup_currency, thune_currency, parsed_exchange_rate, receivingCountryFee?.flat_markup);

        if (Max_Amount === null) Max_Amount = 100000;
        if (Min_Amount === null) Min_Amount = 0;

        let converted_amount = wallet_to_thune_currency_amount * exchange_rate_with_markup;
        let converted_max_amount = Max_Amount * exchange_rate_with_markup;
        let converted_min_amount = Min_Amount * exchange_rate_with_markup;
        let total = fee + amount;

        console.log({ fee, amount, total, converted_amount, converted_max_amount, converted_min_amount }, "calculatePayerRatesLogic");

        // let limitCheck1 = limitCheck(total, feeDetails.account_level, 'sending');
        // console.log(limitCheck1, "limitCheck1")

        // if (!limitCheck1.status) {
        //     return {
        //         error: limitCheck1.code
        //     }
        // }

        // if (total > balance) {
        //     return { error: `Insufficient Balance, your current balance in this wallet is ${balance}` };
        // }

        const amount_to_thune = converted_amount / exchange_rate;
        const our_markup = wallet_to_thune_currency_amount - amount_to_thune;

        return {
            success: true,
            Supported_Transaction_Types: Object.keys(ratesData),
            api_response: {
                thunes_exchange_rate: parsed_exchange_rate,
                exchange_rate: exchange_rate_with_markup,
                walletCurrency,
                destination_currency,
                converted_amount: parseFloat(converted_amount.toFixed(3)),
                converted_max_amount: parseFloat(converted_max_amount.toFixed(3)),
                converted_min_amount: parseFloat(converted_min_amount.toFixed(3)),
                fee: parseFloat(fee.toFixed(3)),
                total: parseFloat(total.toFixed(3)),
                original_converted_amount: parseFloat(wallet_to_thune_currency_amount.toFixed(3)),
                amount_to_thune: parseFloat(amount_to_thune.toFixed(3)),
                our_markup: parseFloat(our_markup.toFixed(3))
            }
        };
    } catch (error) {
        console.error('Error calculating payer rates:', error);
        return { error: 'Internal Server Error' };
    }
};

async function thunesBalance() {
    const BALANCES_API_URL = `${process.env.THUNES_PROD_URL}/v2/money-transfer/balances`;
    const config = {
        headers: {
            'Authorization': `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`,
        }
    };

    const response = await axios.get(BALANCES_API_URL, config);
    const balances = response.data;

    return { status: true, thunes: balances }

}

function formatDecimalNumbersWithLimit(number, limit = 2) {

    if (!number) {
        return null;
    }
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
    let significantDecimalPart = decimalPart.slice(0, firstNonZeroIndex + limit);

    // Combine the integer part with the significant decimal part
    let formattedNumberString = `${integerPart}.${significantDecimalPart}`;

    // Convert the formatted string back to a number
    return parseFloat(formattedNumberString);
}

module.exports = { calculatePayerRatesLogic, thunesBalance, formatDecimalNumbersWithLimit };
