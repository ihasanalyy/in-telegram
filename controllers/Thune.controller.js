require("dotenv").config();
const axios = require('axios');
const moment = require('moment');
const momenttz = require('moment-timezone');
const User = require('../models/User.model');
const Beneficiary = require('../models/Beneficiary.model');
const Account = require('../models/Account.model');
const Company = require('../models/Company.model');
const { encryption, decryption } = require('../configurations/Encryption');
const mongoose = require('mongoose');
const isoCountries = require('i18n-iso-countries');
isoCountries.registerLocale(require("i18n-iso-countries/langs/en.json"));
const Wallet = require('../models/Wallet.model');
const Fee = require('../models/Fee.model');
const shortid = require('shortid');
const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
const { limitCheck, createQuotationHelper, featureCheck, getPayerRatesHelper, sendSMSTemplate, calculateAge, getCountryName, generateUniqueInteger } = require("../utils/helpers");
const Transaction = require("../models/Transaction.model");

const multer = require('multer');
const ReceiverFee = require("../models/ReceiverFee.model");
const { updateUsedLimits, formatDecimalNumbers, topUpFeeCalculation } = require("../utils/conversion");
const CountryModel = require("../models/Country.model");
const AccountLevelModel = require("../models/Account-Level.model");
const { formatDecimalNumbersWithLimit } = require("../utils/payerRates");
const CommissionModel = require("../models/Commission.model");
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});
const supportedCurrencies = require("../utils/paypalSupportedCurrencies.json")

const s3 = new AWS.S3();

// const Thunes_KEY = process.env.APIKEY;
// const Thunes_SECRET = process.env.APISECRET;
const Thunes_KEY = process.env.API_KEY_PROD;
const Thunes_SECRET = process.env.API_SECRET_PROD;

//jwt token key 
const secretKey = process.env.jwtKey;

const authHeaders = `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`;
const productionUrl = process.env.THUNES_PROD_URL
const sandboxUrl = process.env.THUNES_PROD_URL

// const sandboxUrl = `https://api-mt.pre.thunes.com`

// a function which uses the api which gives the covnersion rate
async function convertCurrency(from, to, amount) {
  const exchangeRateKey = process.env.EXCHANGE_RATE_KEY;
  const apiUrl = `https://api.exchangeratesapi.io/v1/convert?access_key=${exchangeRateKey}&from=${from}&to=${to}&amount=${amount}&format=1`;

  try {
    const response = await axios.get(apiUrl);
    return formatDecimalNumbersWithLimit(response.data.result, 6);
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

  // here i have replaced percentage_markup with markup_fee as it was undefined
  if (markup_type === 'percentage') {
    markup = (exchange_rate - ((markup_fee / 100) * exchange_rate))
    exchange_rate_with_markup = markup
  }

  return exchange_rate_with_markup;
}

// to get our balance in thunes account
exports.getBalances = async (req, res) => {
  try {
    const BALANCES_API_URL = `${sandboxUrl}/v2/money-transfer/balances`;
    const config = {
      headers: {
        'Authorization': authHeaders,
      }
    };

    const response = await axios.get(BALANCES_API_URL, config);
    const balances = response.data;

    const simplifiedBalances = balances.map(entry => {
      return {
        currency: entry.currency,
        balance: entry.balance,

      };
    });


    const output = await encryption({ Thunes: simplifiedBalances[0] })
    res.status(200).send(output);
  } catch (error) {
    console.error('Error fetching balance:', error);
    const output = await encryption('Internal Server ErrOr')
    res.status(500).send(output);
  }
};

exports.getThunesBalanceInCurrency = async (req, res) => {
  try {
    const { currency: wallet_currency } = await decryption(req.body.data);
    const fee_currency = "USD";

    const balanceResponse = await thunesBalance();

    if (!balanceResponse.status || !balanceResponse.thunes.length) {
      throw new Error("No balance data available");
    }

    const usdBalance = balanceResponse.thunes[0].balance;

    let convertedBalance = usdBalance;

    // convert balance if requested currency is different from USD
    if (wallet_currency && wallet_currency !== fee_currency) {
      convertedBalance = await convertCurrency(fee_currency, wallet_currency, usdBalance);
    }

    const simplifiedBalances = {
      currency: wallet_currency || fee_currency,
      balance: formatDecimalNumbersWithLimit(convertedBalance)
    };

    const output = await encryption({ status: true, message: "Balance fetched successfully", data: simplifiedBalances });
    res.status(200).send(output);

  } catch (error) {
    console.error('Error fetching balance:', error);
    const output = await encryption({ status: false, message: 'Internal Server Error' });
    res.status(500).send(output);
  }
};


async function thunesBalance() {
  const BALANCES_API_URL = `${sandboxUrl}/v2/money-transfer/balances`;
  const config = {
    headers: {
      'Authorization': authHeaders,
    }
  };

  const response = await axios.get(BALANCES_API_URL, config);
  const balances = response.data;

  return { status: true, thunes: balances }

}

// to get all the supported countires in our thunes
exports.getCountries = async (req, res) => {
  try {
    const API_URL = `${sandboxUrl}/v2/money-transfer/countries`;
    // const API_URL = `${productionUrl}/v2/money-transfer/countries`;
    const perPage = 270;   // currently there are only 45 countires but if they increase we wont have to add pagination logic until they are more then 100

    const config = {
      headers: {
        'Authorization': authHeaders,
      },
      params: {
        per_page: perPage,
      },
    };

    const response = await axios.get(API_URL, config);
    const countries = response.data;

    const transformedData = countries.map(country => ({
      countryIsoCode: country.iso_code,
      countryName: country.name
    }));

    const output = await encryption(transformedData)
    res.json(output);

  } catch (error) {
    console.error('Error fetching countries:', error);
    const output = await encryption('Internal Server Error')
    res.status(500).send(output);
  }
};


// get all the services available in that country
exports.getServices = async (req, res) => {
  try {

    // const requestedCountry2 = req.body;
    // // const requestedCountry1 = req.body.data;
    // // const requestedCountry2 = await decryption(requestedCountry1);
    // const requestedCountry = requestedCountry2.country;

    const requestedCountry = req.params.country_iso_code
    console.log(requestedCountry)

    const API_URL = `${sandboxUrl}/v2/money-transfer/services`;
    // const API_URL = `${productionUrl}/v2/money-transfer/services`;
    const perPage = 100;

    const config = {
      headers: {
        'Authorization': authHeaders,
      },
      params: {
        per_page: perPage,
        country_iso_code: requestedCountry
      },
    };

    const response = await axios.get(API_URL, config);
    const services = response.data;

    const output = await encryption(services)
    res.json(output);

  } catch (error) {
    console.error('Error fetching payers:', error?.response?.data?.errors ?? error);
    const output = await encryption('Internal Server Error')
    res.status(500).send(output);
  };
}


// to gett all the information about a payer on the basis of country and the id of the selected service mobilewallet:1 bankaccount:2
exports.getPayerInfo = async (req, res) => {
  try {
    const data = req.body.data;
    // const requestedService2 = req.body;
    const requestedService2 = await decryption(data);
    const requestedService = requestedService2.id;
    const requestedCountry = requestedService2.country;

    // there are no results for more then 100 payers in the api for any country & service code so have not used any logic to check beyond page 1
    const API_URL = `${sandboxUrl}/v2/money-transfer/payers`;
    // const API_URL = `${productionUrl}/v2/money-transfer/payers`;
    const perPage = 200;

    const config = {
      headers: {
        'Authorization': authHeaders,
      },
      params: {
        per_page: perPage,
        country_iso_code: requestedCountry,
        service_id: requestedService
      },
    };

    console.log(requestedCountry, requestedService)

    const response = await axios.get(API_URL, config);
    const payers = response.data;

    const transformedServices = payers.map(service => ({
      country_iso_code: service.country_iso_code,
      currency: service.currency,
      id: service.id,
      increment: service.increment,
      name: service.name,
      precision: service.precision,
      transaction_types: {
        C2C: {
          maximum_transaction_amount: service.transaction_types.C2C.maximum_transaction_amount,
          minimum_transaction_amount: service.transaction_types.C2C.minimum_transaction_amount,
          purpose_of_remittance_values_accepted: service.transaction_types.C2C.purpose_of_remittance_values_accepted,
          required_documents: service.transaction_types.C2C.required_documents
        }
      }
    }));

    const output = await encryption(payers)
    res.json(output);

  } catch (error) {
    console.error('Error fetching payers:', error);
    const output = await encryption('Internal Server Error')
    res.status(500).send(output);
  }
};




// function to get the rate
const calculatePayerRatesLogic = async (payerId, walletId, transactionType, amount, service_name = "international_bank_transfer", channel_name = "bank_account") => {

  const wallet = await Wallet.findOne({ _id: walletId }).populate('account');
  const wallet_currency = wallet.currency.code //'EUR'
  const balance = wallet.balance.available;

  let receivingCountryFee = await ReceiverFee.findOne({ country: wallet.account.country, service_name: channel_name })
  let feeDetails = await Fee.findOne({ $and: [{ service_name }, { account_level: wallet.account.level._id }] }).populate('account_level');

  console.log(feeDetails, "feeDetails")
  const fees = await Fee.findOne({ account_level: wallet.account.level._id }).populate('account_level');
  // console.log(fees, "fees")
  const thune_currency = 'USD'; // As we only have USD in account right now, this will later need to be updated depending 
  let wallet_to_thune_exchangerate = 1;
  let wallet_to_thune_currency_amount

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

  const fee_type = receivingCountryFee ? receivingCountryFee.fee_type : feeDetails?.fee_type;
  const flat_fee = receivingCountryFee ? receivingCountryFee.flat_fee : feeDetails?.flat_fee;
  const percentage_fee = receivingCountryFee ? receivingCountryFee.percentage_fee : feeDetails?.percentage_fee;
  const fee_currency = receivingCountryFee ? receivingCountryFee.fee_currency : feeDetails?.fee_currency;

  const sending_limit = feeDetails?.account_level.transaction_amount_limit
  const daily_sending_limit = feeDetails?.account_level.daily_sending_limit
  const monthly_sending_limit = feeDetails?.account_level.monthly_sending_limit
  const yearly_sending_limit = feeDetails?.account_level.yearly_sending_limit
  var fee = 0;

  const markup_fee = receivingCountryFee ? receivingCountryFee.flat_markup : feeDetails?.flat_markup;
  const markup_type = receivingCountryFee ? receivingCountryFee.markup_type : feeDetails?.markup_type;
  const percentage_markup = receivingCountryFee ? receivingCountryFee.percentage_markup : feeDetails?.percentage_markup;
  const markup_currency = receivingCountryFee ? receivingCountryFee.markup_currency : feeDetails?.markup_currency;
  var markup = 0;
  var exchange_rate_with_markup = 0;

  const API_URL = `${sandboxUrl}/v2/money-transfer/payers/${payerId}/rates`;

  const config = {
    headers: {
      'Authorization': authHeaders,
    }
  };

  let Max_Amount
  let Min_Amount
  let exchange_rate

  const response = await axios.get(API_URL, config);
  const rates = response.data;
  let destination_currency = rates.destination_currency;

  console.log(rates, "rates")

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

  console.log(exchange_rate_with_markup, "exchange_rate_with_markup")

  let converted_amount = wallet_to_thune_currency_amount * exchange_rate_with_markup;
  // console.log(wallet_to_thune_currency_amount, "wallet_to_thune_currency_amount")
  // console.log(exchange_rate_with_markup)
  // console.log(converted_amount)


  let converted_max_amount = Max_Amount * exchange_rate_with_markup;
  let converted_min_amount = Min_Amount * exchange_rate_with_markup;
  let total = fee + amount;

  console.log(total, "converted_max_amount")

  console.log(feeDetails.account_level, "feeDetails.account_level")


  let limitCheck1 = limitCheck(total, feeDetails.account_level, 'sending');
  console.log(limitCheck1, "limitCheck1")

  if (!limitCheck1.status) {
    return {
      error: limitCheck1.code
    }
  }

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

  // if (total > sending_limit) {
  //   return {
  //     error: "Total is more than sending limit"
  //   };
  // }

  // if (total > daily_sending_limit) {
  //   return {
  //     error: "Total is more than daily sending limit"
  //   };
  // }

  // if (total > monthly_sending_limit) {
  //   return {
  //     error: "Total is more than monthly sending limit"
  //   };
  // }

  // if (total > yearly_sending_limit) {
  //   return {
  //     error: "Total is more than yearly sending limit"
  //   };
  // }

  if (total > balance) {
    return {
      error: `Insufficient Balance, your current balance in this wallet is ${balance}`
    };
  }



  const amount_to_thune = converted_amount / exchange_rate;
  console.log(amount_to_thune, "amount_to_thune", converted_amount, "converted_amount", exchange_rate, "exchange_rate")
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

  const front_exchange_rate = await convertCurrency(wallet.currency.code, destination_currency, 1)

  // returning everything so it is easy to understand(output will need to be changed later)
  let api_response = {
    thunes_exchange_rate: roundedExchangeRate, // it returns USD to destination currency exchange rate
    exchange_rate: roundedExchangeRateWithMarkup, // it returns USD to destination currency exchange rate
    actual_exchange_rate: front_exchange_rate, // it returns source curreny(from front) to destination currency exchange rate
    wallet_currency: wallet_currency,
    destination_currency: destination_currency,
    converted_amount: roundedConvertedAmount,                  // value in destination currency
    converted_max_amount: roundedConvertedMaxAmount,           // value in destination currency
    converted_min_amount: roundedConvertedMinAmount,           // value in destination currency
    fee: roundedFee,              // these values are in source currency
    total: roundedTotal,          // value in source currency
    original_converted_amount: roundedOriginalConvertedAmount,    // value in thunes account currency
    amount_to_thune: roundedAmountToThune,                       // value in thunes account currency
    our_markup: roundedOurMarkup                                // value in thunes account currency
  };

  console.log(roundedTotal, "api_response")

  return {
    success: true,
    Supported_Transaction_Types: keys,
    api_response: api_response
  };
}

const processExchangeRates = async (
  {
    transaction_type,
    amount,
    service_name,
    wallet_id,
    channel_name,
    payerId,
    external_id,
    service_id,
    country,
    avoid_balance,
    account_id,
    currency_code,
    avoid_top_up_fee
  }) => {
  console.log("processExchangeRates", {
    transaction_type,
    amount,
    service_name,
    wallet_id,
    channel_name,
    payerId,
    external_id,
    service_id,
    country,
    avoid_balance,
    account_id,
    currency_code
  }
  )
  try {
    let walletDetails;

    if (wallet_id) {
      walletDetails = await Wallet.findById(wallet_id).populate([{ path: 'account', populate: [{ path: 'level' }] }])
    } else {
      console.log("i have ran")
      walletDetails = await Wallet.findOne({ account: account_id, wallet_type: "insta" }).populate([{ path: 'account', populate: [{ path: 'level' }] }])
    }
    if (!walletDetails) {
      return {
        message: "Wallet not found",
        status: false
      }
    }

    amount = formatDecimalNumbersWithLimit(amount);

    const receivingCountryFee = await ReceiverFee.findOne({ country, service_name: channel_name });

    const user_wallet_details = walletDetails.account.level
    let feeDetails
    let accountLevel
    if (user_wallet_details.level_no === 1) {
      accountLevel = await AccountLevelModel.findOne({ $and: [{ level_no: 2 }, { country: walletDetails.account.country }, { category: user_wallet_details.category }, { account_type: "individual" }] });
      feeDetails = await Fee.findOne({ $and: [{ service_name }, { account_level: accountLevel._id }] }).populate('account_level');
      console.log(feeDetails, "feeDetails")
    } else {
      accountLevel = user_wallet_details
      feeDetails = await Fee.findOne({ $and: [{ service_name }, { account_level: user_wallet_details._id }] }).populate('account_level');
    }
    // const feeDetails = await Fee.findOne({ $and: [{ service_name }, { account_level: walletDetails.account.level._id }] }).populate('account_level');


    let fee_type = receivingCountryFee ? receivingCountryFee.fee_type : feeDetails?.fee_type;
    let flat_fee = receivingCountryFee ? receivingCountryFee.flat_fee : feeDetails?.flat_fee;
    let percentage_fee = receivingCountryFee ? receivingCountryFee.percentage_fee : feeDetails?.percentage_fee;
    let fee_currency = receivingCountryFee ? receivingCountryFee.fee_currency : feeDetails?.fee_currency;

    // let markup_fee = receivingCountryFee ? receivingCountryFee.flat_markup : feeDetails?.flat_markup;
    let markup_type = receivingCountryFee ? receivingCountryFee.markup_type : feeDetails?.markup_type;
    let percentage_markup = receivingCountryFee ? receivingCountryFee.percentage_markup : feeDetails?.percentage_markup;
    // let markup_currency = receivingCountryFee ? receivingCountryFee.markup_currency : feeDetails?.markup_currency;

    let exchangedAmountSender = await convertCurrency(currency_code, 'USD', amount)


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

    if (!avoid_balance && walletDetails.balance.available < amount) {
      return {
        status: false,
        message: "Insufficient balance!"
      };
    }

    // const API_URL = `${sandboxUrl}/v2/money-transfer/payers/${payerId}/rates`;

    // const config = {
    //   headers: {
    //     'Authorization': authHeaders,
    //   }
    // };

    // console.log(config, "config", API_URL);
    // const response = await axios.get(API_URL, config);
    // let response;
    // let rates_status = false
    // axios.get(API_URL, config).then((response) => {
    //   response = response.data
    //   rates_status = true
    //   console.log("response", response.data);
    // }).catch((error) => {
    //   rates_status = false
    //   response = error?.response?.data?.errors ?? error
    //   console.log("error", error.response.data);
    // })

    // if (!rates_status) {
    //   return {
    //     status: false,
    //     message: response
    //   };
    // }
    const getPayerRates = await getPayerRatesHelper(payerId);
    const response = getPayerRates.data

    if (!getPayerRates?.status) {
      return { status: false, message: response?.data }
    }

    console.log(response?.data, "responseingetrates")

    console.log({ fee_type, flat_fee, percentage_fee, fee_currency, percentage_markup, markup_type, fromCurrency: currency_code, toCurrency: response.data.destination_currency, amount });

    const mode = 'DESTINATION_AMOUNT';
    const Thunes_Currency = 'USD';
    const Thunes_Country = 'USA';
    const destinationCurrency = response.data.destination_currency;
    const min_max_values = response.data.rates[transaction_type][Thunes_Currency][0]
    let Max_Amount;
    let Min_Amount;

    console.log(response.data.rates[transaction_type][Thunes_Currency][0], "response.data.rates[transaction_type][Thunes_Currency][0]")

    let feeExchange;

    if (fee_type === 'flat') {
      fee = flat_fee;
      feeExchange = await convertCurrency(fee_currency, currency_code, fee);
    } else {
      feeExchange = amount * (percentage_fee / 100);
    }

    feeExchange = formatDecimalNumbersWithLimit(feeExchange);
    let exchange_rate_temp = await convertCurrency(currency_code, destinationCurrency, 1);
    exchange_rate_temp = formatDecimalNumbers(exchange_rate_temp);
    let wallet_to_thunes_rate = await convertCurrency(currency_code, Thunes_Currency, 1);
    wallet_to_thunes_rate = formatDecimalNumbers(wallet_to_thunes_rate);
    let system_to_thunes_rate = await convertCurrency(fee_currency, currency_code, 1);
    system_to_thunes_rate = formatDecimalNumbers(system_to_thunes_rate);

    console.log(response.data, "response")


    let exchange_rate;
    let markupReceived;

    console.log(fee_currency)

    if (destinationCurrency !== currency_code) {
      exchange_rate = formatDecimalNumbers(exchange_rate_temp - ((percentage_markup / 100) * exchange_rate_temp));
      markupReceived = {
        markup_type: markup_type,
        exchange_rate_markup: formatDecimalNumbers(exchange_rate_temp - ((percentage_markup / 100) * exchange_rate_temp)),
        markup: formatDecimalNumbers(percentage_markup),
        currency: currency_code,
      };
    } else {
      exchange_rate = 1;
      markupReceived = {
        markup_type: "N/A",
        exchange_rate_markup: exchange_rate_temp,
        markup: 0,
        currency: currency_code,
      };
    }

    // if (Max_Amount === null) {
    //   Max_Amount = 100000;
    // }

    // if (Min_Amount === null) {
    //   Min_Amount = 0;
    // }


    // let converted_max_amount = Max_Amount * wallet_to_thunes_rate;
    // let converted_min_amount = Min_Amount * wallet_to_thunes_rate;

    const limitedAmountCheck = amount - feeExchange
    let converted_amount = limitedAmountCheck * wallet_to_thunes_rate;

    console.log({ limitedAmountCheck, exchange_rate, converted_amount, feeExchange, amount })

    // if (Max_Amount <= converted_amount) {
    //   return { status: false, message: "Amount exceeds maximum allowed" }
    // }

    // if (converted_amount <= Min_Amount) {
    //   return { status: false, message: "Amount is below the minimum allowed" }
    // }

    // let destinationAmount;
    // if(destinationCurrency !== currency_code) {
    //   destinationAmount = formatDecimalNumbersWithLimit(amount, 0);
    // }else{
    //   destinationAmount = formatDecimalNumbersWithLimit((amount * exchange_rate), 0);
    // }

    // getting minimum and maximum values from thunes
    const config = {
      headers: {
        'Authorization': authHeaders,
      }
    };
    const payer_rates = await axios.get(`${process.env.THUNES_PROD_URL}/v2/money-transfer/payers/${payerId}`, config)

    console.log("payerDetails", payer_rates.data)

    const min_thunes_value = payer_rates?.data?.transaction_types[transaction_type]?.minimum_transaction_amount
    const max_thunes_value = payer_rates?.data?.transaction_types[transaction_type]?.maximum_transaction_amount

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

    console.log(formatDecimalNumbersWithLimit((amount * exchange_rate), 3), "amountinquot")


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

    console.log(requestData, "requestDatainquot")

    const quotationResult = await createQuotationHelper(requestData);

    if (!quotationResult?.status) {
      return { status: false, message: quotationResult?.data }
    }

    console.log(quotationResult, "quotationResult")

    // NEW Calculation
    const sending_currency = currency_code
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

    // if fixed fee, then max + fee, and min + fee for min
    // 100 ka jo bhi percentage fee nikla, us mein add krwa dena
    // min ki jo bhi value arahi h, * 2 min aae gi

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


    let convertedThunesFee = await convertCurrency(Thunes_Currency, currency_code, thunes_fee);
    convertedThunesFee = formatDecimalNumbersWithLimit(convertedThunesFee);

    let totalFeeConverted = formatDecimalNumbersWithLimit(convertedThunesFee + feeExchange);
    console.log({ thunes_fee, feeExchange, convertedThunesFee, totalFeeConverted });

    let amountAfterFee = formatDecimalNumbersWithLimit(amount - totalFeeConverted);

    console.log(exchange_rate, "exchange_rate")


    console.log(amountAfterFee, "amountAfterFee");

    // minimum value work

    // calculating top up fee
    let topupFee = await topUpFeeCalculation(walletDetails, amount, 'topup_card_payment')
    console.log(topupFee, "topupFee")

    let minimum_value;
    let calculated_minimum
    if (avoid_top_up_fee) {
      calculated_minimum = converted_thunes_fee + feeExchange
    } else {
      calculated_minimum = converted_thunes_fee + feeExchange + parseFloat(topupFee)
    }
    calculated_minimum = calculated_minimum * 2;
    let converted_calculated_minium = wallet_to_thunes_rate * calculated_minimum

    // comparing thuness_fee + instapay fee + 2% and thunes min and setting the minimum value accordingly
    // if (converted_calculated_minium > Min_Amount) {
    //   minimum_value = converted_calculated_minium
    // } else {
    //   minimum_value = Min_Amount
    // }
    let destination_to_sending_minimum = await convertCurrency(destinationCurrency, sending_currency, Min_Amount || 1)
    if (converted_calculated_minium > destination_to_sending_minimum) {
      minimum_value = converted_calculated_minium
    } else {
      minimum_value = destination_to_sending_minimum
    }

    console.log({ minimum_value, amount, Min_Amount, destination_to_sending_minimum, calculated_minimum, wallet_to_thunes_rate, converted_calculated_minium })

    if (calculated_minimum >= amount) {
      console.log("yesyesiran")
      return { status: false, message: `Amount is below the minimum allowed`, value: calculated_minimum }
    }

    if (amountAfterFee <= 0) {
      console.log("yesyesiran12")
      return { status: false, message: `Amount is below the minimum allowed`, value: calculated_minimum }
    }

    // maximum amount work
    // get sending limit, amount per transaction, and thunes max value, then sending max value accordingly
    let daily_sending_limit_used = walletDetails.account.used_limits.daily_sending_limit || 0
    let monthly_sending_limit_used = walletDetails.account.used_limits.monthly_sending_limit || 0
    let yearly_sending_limit_used = walletDetails.account.used_limits.yearly_sending_limit || 0

    let daily_receiving_limit = accountLevel.daily_receiving_limit;
    let monthly_receiving_limit = accountLevel.monthly_receiving_limit;
    let yearly_receiving_limit = accountLevel.yearly_receiving_limit;

    let transaction_amount_limit = accountLevel.transaction_amount_limit;

    let daily_sending_limit = accountLevel.daily_sending_limit;
    let monthly_sending_limit = accountLevel.monthly_sending_limit;
    let yearly_sending_limit = accountLevel.yearly_sending_limit;

    if (walletDetails.account.is_external_limit) {
      daily_sending_limit = walletDetails.account.external_limits.daily_sending_limit;
      monthly_sending_limit = walletDetails.account.external_limits.monthly_sending_limit;
      yearly_sending_limit = walletDetails.account.external_limits.yearly_sending_limit;

      transaction_amount_limit = walletDetails.account.external_limits.transaction_amount_limit;

      daily_receiving_limit = walletDetails.account.external_limits.daily_receiving_limit;
      monthly_receiving_limit = walletDetails.account.external_limits.monthly_receiving_limit;
      yearly_receiving_limit = walletDetails.account.external_limits.yearly_receiving_limit;
    }

    // getting the minimum sending limit from daily, monthly, yearly
    let minimum_sending_limit = Math.min(daily_sending_limit - daily_sending_limit_used, monthly_sending_limit - monthly_sending_limit_used, yearly_sending_limit - yearly_sending_limit_used);
    // per transaction limit
    minimum_sending_limit = Math.min(minimum_sending_limit, transaction_amount_limit);
    // minimum_sending_limit = sending_to_thunes_fx * minimum_sending_limit;
    // minimum from thunes and system limit found
    minimum_sending_limit = Math.min(minimum_sending_limit, !Max_Amount ? minimum_sending_limit : Max_Amount)

    console.log({ minimum_sending_limit, converted_amount })

    let max_value_in_sending_curr = await convertCurrency(Thunes_Currency, currency_code, minimum_sending_limit)

    if (converted_amount > minimum_sending_limit) {
      return { status: false, message: `Amount is above the maximum allowed`, value: max_value_in_sending_curr }
    }




    let exchange_rate_limits = await convertCurrency(fee_currency, currency_code, 1)


    // thunes fee + hamari fee = will be minimum
    // then we have two condition
    // 1) two minimums we have, then we have to found, which is maximum from both of them then we have to return the maximum from them as a min on front
    // 2) we have entered 1000 from 1000 balance, but the 

    let totalAmountConverted = formatDecimalNumbersWithLimit(amountAfterFee * thunes_rate);
    let totalAmountConvertedWithMarkup = formatDecimalNumbersWithLimit(amountAfterFee * exchange_rate);

    let recipientReceivingAmount = await convertCurrency(currency_code, destinationCurrency, totalAmountConvertedWithMarkup);


    console.log({ totalAmountConverted, totalAmountConvertedWithMarkup, thunes_rate, exchange_rate_with_markup: exchange_rate, amountAfterFeeDedection: amountAfterFee, recipientReceivingAmount });
    // limits to show for the frontend
    let daily_receiving_limit_used = walletDetails.account.used_limits.daily_receiving_limit || 0
    let monthly_receiving_limit_used = walletDetails.account.used_limits.monthly_receiving_limit || 0
    let yearly_receiving_limit_used = walletDetails.account.used_limits.yearly_receiving_limit || 0

    daily_sending_limit_used = exchange_rate_limits * daily_sending_limit_used
    monthly_sending_limit_used = exchange_rate_limits * monthly_sending_limit_used
    yearly_sending_limit_used = exchange_rate_limits * yearly_sending_limit_used

    daily_receiving_limit_used = exchange_rate_limits * daily_receiving_limit_used
    monthly_receiving_limit_used = exchange_rate_limits * monthly_receiving_limit_used
    yearly_receiving_limit_used = exchange_rate_limits * yearly_receiving_limit_used

    daily_sending_limit = exchange_rate_limits * daily_sending_limit
    monthly_sending_limit = exchange_rate_limits * monthly_sending_limit
    yearly_sending_limit = exchange_rate_limits * yearly_sending_limit

    daily_receiving_limit = exchange_rate_limits * daily_receiving_limit
    monthly_receiving_limit = exchange_rate_limits * monthly_receiving_limit
    yearly_receiving_limit = exchange_rate_limits * yearly_receiving_limit

    const limits = {
      daily_sending_limit_used,
      monthly_sending_limit_used,
      yearly_sending_limit_used,
      daily_receiving_limit_used,
      monthly_receiving_limit_used,
      yearly_receiving_limit_used,
      daily_sending_limit,
      monthly_sending_limit,
      yearly_sending_limit,
      daily_receiving_limit,
      monthly_receiving_limit,
      yearly_receiving_limit
    }

    const result = {
      exchanged_rate: {
        value: final_exchange_rate,
        currency: destinationCurrency,
      },
      fee: {
        // value: totalFeeConverted,
        value: formatDecimalNumbersWithLimit(calculated_fee),
        currency: currency_code,
      },
      recipient: {
        // value: formatDecimalNumbersWithLimit(totalAmountConvertedWithMarkup),
        value: formatDecimalNumbersWithLimit(destination_amount),
        currency: destinationCurrency,
      },
      total: {
        value: formatDecimalNumbersWithLimit(amount),
        currency: currency_code,
      },
      limits,
      max_amount: max_value_in_sending_curr,
      min_amount: calculated_minimum,
    }

    return {
      result,
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
        max_amount: max_value_in_sending_curr,
        min_amount: calculated_minimum,
        precision: payer_rates.data.precision,
      },
      payload: {
        result,
        extras: {
          markup_value,
          fee_type,
          exchange_rate_with_markup: final_exchange_rate
        }
      },
      status: true,
    };

  } catch (err) {
    console.error("Error in processExchangeRates:", err.message ?? err);
    return { status: false, message: err.message ?? err };
  }
};

exports.getExchangeRates = async (req, res) => {
  try {
    // const decrypted = req.body;
    const data = req.body.data;
    const decrypted = await decryption(data);
    const {
      transaction_type,
      amount,
      service_name,
      wallet_id,
      channel_name,
      service_id,
      iso_code,
      avoid_balance,
      avoid_top_up_fee,
      account_id,
      currency_code } = decrypted;
    let payerId = parseInt(req.params.payerId);
    const external_id1 = shortid.generate()

    const country = await CountryModel.findOne({ country_iso_code: iso_code })

    const result = await processExchangeRates({
      transaction_type,
      amount,
      service_name,
      wallet_id,
      channel_name,
      payerId,
      external_id: external_id1,
      service_id,
      country: country._id,
      avoid_balance,
      avoid_top_up_fee,
      account_id,
      currency_code
    });

    if (result.status === false) {
      let response = { status: false, message: result.message ?? "Something went wrong while getting exchange rates" }
      if (result?.value) {
        response['value'] = result.value
      }
      const error = await encryption(response)

      return res.status(500).send(error);
    }

    const token = jwt.sign(result?.payload, secretKey, { expiresIn: '1h' })

    const ciphertext = await encryption({
      status: true,
      message: "Exchange rate found",
      data: {
        result: result.result,
        token
      }

    });
    res.status(200).send(ciphertext);

  } catch (err) {
    console.log(err);
    const error = await encryption({
      status: false,
      message: err.message ?? "Something went wrong while getting exchange rates",
    })

    return res.status(500).send(error);
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

// to only get the excahnge rate on thunes for the selected payer
exports.getPayerRates = async (req, res) => {
  try {
    const decrypted_request_body = req.body;
    const requestbody = req.body.data;
    // const decrypted_request_body = await decryption(requestbody);
    let payerId = parseInt(req.params.payerId);
    const wallet_id = decrypted_request_body.wallet_id;
    const transaction_type = decrypted_request_body.transaction_type;
    const amount = decrypted_request_body.amount;
    const service_name = decrypted_request_body.service_name;
    const external_id1 = shortid.generate()

    // const walletDetails = await Wallet.findById(wallet_id).populate('account');

    const result = await calculatePayerRatesLogic(payerId, wallet_id, transaction_type, amount, service_name);

    const mode = 'DESTINATION_AMOUNT'
    const Thunes_Currency = 'USD'  // AS WE ONLY HAVE USD FOR NOW SO HARDCODING IT 
    const Thunes_Country = 'USA'  // AS WE ONLY HAVE USD FOR NOW SO HARDCODING IT 
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
        amount,
        currency: result.api_response.destination_currency
      }
    };


    const quotationResult = await createQuotationHelper(requestData);
    let prev_total = result['api_response']['total'];

    // updating the total amount with thunes fee
    result['api_response']['total'] = quotationResult.fee.amount + prev_total;
    result['api_response']['thunes_fee'] = quotationResult.fee.amount

    if (result.success) {

      const payload = {
        result: result.api_response,
        thunes_fee: quotationResult.fee.amount
      };

      console.log(payload, "payload");

      const options = {
        expiresIn: '1h',
      };         // not expiring the token right now

      const token = jwt.sign(payload, secretKey);


      const encryptedRates = await encryption({
        result: result.api_response,
        token: token,
        Supported_Transaction_Types: result.Supported_Transaction_Types,
        thunes_fee: quotationResult.fee.amount
      });
      console.log(encryptedRates, "encryptedRates");
      res.json(encryptedRates);
    } else {
      const encryptedError = await encryption(result.error);
      res.status(404).json(encryptedError); // You can change the status code as needed
    }
  } catch (error) {
    console.error('Error fetching payer rates:', error);
    const output = await encryption('Internal Server Error');
    res.status(500).json(output);
  }
}

function setAmountBasedOnPrecision(amount, precision) {
  return Number(amount.toFixed(precision));
}
exports.createQuotationNew = async (req, res) => {
  try {

    // const decryptedData = req.body;
    const external_id = shortid.generate()

    const decryptedData = await decryption(req.body.data);

    const {
      token,
      transaction_type,
      amount,
      service_name,
      wallet_id,
      channel_name,
      payerId,
      service_id,
      iso_code,
      avoid_balance,
      avoid_top_up_fee,
      account_id,
      currency_code
    } = decryptedData;

    console.log(decryptedData, "decryptedData");
    const country = await CountryModel.findOne({ country_iso_code: iso_code })


    const result = await processExchangeRates({
      transaction_type,
      amount,
      service_name,
      wallet_id,
      channel_name,
      payerId,
      external_id,
      service_id,
      country: country._id,
      avoid_balance,
      avoid_top_up_fee,
      account_id,
      currency_code
    });

    console.log({ result })

    if (result.status === false) {
      const error = await encryption({
        status: false,
        message: result?.message ?? "Something went wrong while getting exchange rates!",
      })

      return res.status(500).send(error);
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
    //   const error = await encryption({
    //     status: false,
    //     message: "Difference in exchange rates",
    //   })
    //   return res.status(500).send(error);
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
        amount: setAmountBasedOnPrecision(obj1.result.recipient.value, result.extras.precision),
        currency: obj2.result.exchanged_rate.currency
      },
    };

    console.log(requestData, "requestData");
    const quotationResult = await createQuotationHelper(requestData);
    console.log({ quotationResult })

    const data = await encryption({
      status: true,
      message: "Quotation created successfully",
      QuotationID: external_id1,
      token,
    })
    res.status(200).send(data);

  } catch (error) {
    console.error('Error creating quotation:', error);
    const output = await encryption('Internal Server Error');
    res.status(500).json(output);
  }
}


// gives the exchange rate, a Quotationid which is used to create a transaction
exports.createQuotation = async (req, res) => {
  try {
    const external_id1 = shortid.generate()
    const API_URL = `${sandboxUrl}/v2/money-transfer/quotations`;
    const Thunes_Currency = 'USD'  // AS WE ONLY HAVE USD FOR NOW SO HARDCODING IT 
    const Thunes_Country = 'USA'  // AS WE ONLY HAVE USD FOR NOW SO HARDCODING IT 

    // REQBODY FROM POSTMAN
    // const decryptedData = req.body;
    const requestedData = req.body;
    // const decryptedData = await decryption(requestedData);
    const {
      wallet_id,
      payer_id,
      transaction_type,
      amount,
      token,
      service_id,
      service_name,
      channel_name
      // destination: { currency: destinationCurrency }
    } = requestedData;

    const decodedToken = jwt.verify(token, secretKey);
    console.log(decodedToken, 'decodedToken')

    let result = await calculatePayerRatesLogic(payer_id, wallet_id, transaction_type, amount, service_name, channel_name);
    if (result.success) {
      const mode = 'SOURCE_AMOUNT'

      // console.log(decodedToken.result);
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

      // updating the total value as we have not inckuded the thunes fee in result variable coming from calculatepayerslogic function
      // result['api_response']['total'] = result['api_response']['total'] + decodedToken.result['thunes_fee'];
      result['api_response']['thunes_fee'] = decodedToken.result['thunes_fee'];
      result['api_response']['total'] = result['api_response']['total'] + decodedToken.result['thunes_fee'];

      result['api_response']['actual_exchange_rate'] = parseFloat(result['api_response']['actual_exchange_rate']?.toFixed(3))
      decodedToken.result['actual_exchange_rate'] = parseFloat(decodedToken.result['actual_exchange_rate']?.toFixed(3))

      const difference = findDifferences(decodedToken.result, result.api_response);
      console.log(decodedToken.result, result.api_response, difference);

      // if (difference === "difference") {
      //   const output = await encryption('There has been a change in the exchagne rate');
      //   res.status(400).json(output);
      // }

      // if (difference === "fees changed") {
      //   const output = await encryption('Fees has been updaated.');
      //   res.status(400).json(output);

      // }
      if (true) {

        // THE REQUEST DATA WE SENDING ,  IT HAS AMOUNT IN DESTINATION, WHICH CANT BE EMPTY AND IS SET TO NULL(PUTTING A VALUE IN IT DOESNT DO ANYTHING)
        const requestData = {
          external_id: external_id1,
          payer_id: payer_id,
          mode: "DESTINATION_AMOUNT",//mode,
          transaction_type: transaction_type,
          source: {
            amount: null,
            currency: Thunes_Currency,
            country_iso_code: Thunes_Country
          },
          destination: {
            amount: 1100,
            currency: result.api_response.destination_currency
          }
        };

        const config = {
          headers: {
            'Authorization': authHeaders,
            'Content-Type': 'application/json'
          }
        };

        console.log(requestData, "requestDatainQuotation")
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

        const output = await encryption(filteredResponse)
        res.json(output);
      }

    }
    else {
      const encryptedError = await encryption(result.error);
      res.status(404).json(encryptedError);
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
    const encryptedError = await encryption('An error occurred while creating the quotation');
    res.status(500).send(encryptedError);
    //  }
  }
};



exports.createTransaction = async (req, res, next) => {
  try {
    const { Quotation_ID } = req.params;
    // const decryptedData = req.body.data;
    const requestedData = req.body.data;
    const decryptedData = await decryption(requestedData);

    // required information to make a transaction
    const {
      wallet_id,
      additional_information,
      purpose_of_remittance,
      user_id,             // right now this is taken in request body, later it will be taken from token, so needs to be updated
      beneficiary_id,
      service,
      bank_id,
      mobile_wallet_id,
      transaction_type,
      token,
      type
    } = decryptedData;

    const user = await User.findById(user_id).populate("account")
    console.log(user, "user")
    const beneficiary = await Beneficiary.findById(beneficiary_id);
    console.log(beneficiary, "beneficiary")
    console.log(decryptedData, "token")
    console.log(service, "service")
    const service_id = service.id;

    const credit_party_identifier = {
    };

    let document_type = '';
    let document_number = '';
    let bank_details
    // hardcoding values for now, since this data isnt in the database
    if (mobile_wallet_id) {
      const mobile_wallet = await beneficiary.mobile_wallet.find(bl => bl._id == mobile_wallet_id)
      // credit_party_identifier.bank_account_number = "0123456789"
      // credit_party_identifier.swift_bic_code = "ABCDEFGH"
      credit_party_identifier.msisdn = mobile_wallet?.wallet_account_number// "272715638100" //beneficiary.mobile_wallet_account_number
      credit_party_identifier.account_number = mobile_wallet?.extras?.account_number //|| "0123456789"
      credit_party_identifier.iban = mobile_wallet?.extras?.iban //|| "AT351111111111111100"
      credit_party_identifier.email = beneficiary?.email || ``
      credit_party_identifier.bank_account_number = mobile_wallet?.extras?.account_number //|| "0123456789"
      credit_party_identifier.account_type = mobile_wallet?.extras?.account_type //|| "SAVINGS"
      // console.log(credit_party_identifier.msisdn, "credit_party_identifier.msisdn")
    } else if (bank_id) {
      bank_details = await beneficiary.bank_details.find(bl => bl._id == bank_id)
      credit_party_identifier.bank_account_number = bank_details?.account_number //"272715638100" //beneficiary.bank_details.account_number
      credit_party_identifier.account_number = bank_details?.account_number //"272715638100" //beneficiary.bank_details.account_number
      credit_party_identifier.iban = bank_details?.iban //"AT351111111111111100"; //beneficiary.bank_swift_code
      credit_party_identifier.cbu = bank_details?.extras?.cbu
      credit_party_identifier.account_type = bank_details?.extras?.account_type
      credit_party_identifier.bsb_number = bank_details?.extras?.bsb_number
      credit_party_identifier.branch_number = bank_details?.extras?.branch_number
      credit_party_identifier.swift_bic_code = bank_details?.extras?.swift_bic_code
      credit_party_identifier.routing_code = bank_details?.extras?.routing_code
      credit_party_identifier.entity_tt_id = bank_details?.extras?.entity_tt_id
      credit_party_identifier.ifs_code = bank_details?.extras?.ifs_code
      credit_party_identifier.clabe = bank_details?.extras?.clabe
      credit_party_identifier.msisdn = beneficiary?.phone
      credit_party_identifier.sort_code = bank_details?.extras?.sort_code
      // console.log(credit_party_identifier.bank_account_number)
      // console.log(credit_party_identifier.iban)
    } else if (service_id === 3) {
      credit_party_identifier.msisdn = beneficiary.phone// "272715638100" //beneficiary.mobile_wallet_account_number
      document_type = beneficiary.cash_pickup[0].document_type
      document_number = beneficiary.cash_pickup[0].document_number
    } else if (service_id === 4) {
      credit_party_identifier.card_number = '4111254101010100'
      credit_party_identifier.bank_account_number = '272715638100'
    }
    console.log(bank_details?.account_holder_name || beneficiary?.first_name + ' ' + beneficiary?.last_name, bank_details, bank_details?.account_holder_name)

    const API_URL = `${sandboxUrl}/v2/money-transfer/quotations/ext-${Quotation_ID}/transactions`;
    console.log(credit_party_identifier, bank_details, "bank_details", API_URL);
    // const API_URL = `${productionUrl}/v2/money-transfer/quotations/ext-${Quotation_ID}/transactions`;
    let t_id = `instapay_t_id_${Date.now()}`
    const transactionExternalID = t_id;
    // const transactionExternalID = shortid.generate().replace(/[_-]/g, '');

    //console.log(transaction_type)

    first_type = transaction_type[0] // to see if the sender is individual or business
    second_type = transaction_type[2] // to see if the reciever is individual or business
    let requestData
    let sender_obj
    let documentType = user?.extras?.documentType === "id-card" ?
      "NATIONAL_ID" : user?.extras?.documentType === "passport" ?
        "PASSPORT" : user?.extras?.documentType === "driving-license" ?
          "DRIVING_LICENSE" : "RESIDENT_CARD"
    // all the fields of a individual 
    if (first_type === 'C') {
      sender_obj = {
        firstname: user?.first_name || '',
        lastname: user?.last_name || '',
        nationality: user?.account?.user_nationaility || '',
        address: user?.account?.address || '',
        id_expiration_date: user?.extras?.dateOfExpiry || '',
        country_of_birth_iso_code: user?.account?.user_nationaility || "",
        source_of_funds: user?.source_of_funds || "",
        date_of_birth: user?.account?.dob?.split("-")?.reverse()?.join("-"),
        country_iso_code: user?.account?.country_iso_code || "",
        beneficiary_relationship: beneficiary?.relation?.toUpperCase() || "",
        nativename: "",
        id_country_iso_code: user?.account?.user_nationaility || '',
        email: user?.account?.email || '',
        city: user?.account?.city || '',
        postal_code: user?.account?.postal_code || '',
        id_type: documentType,
        id_number: user?.extras?.idNumber,
        gender: user?.account?.gender ?
          (user?.account?.gender?.toLowerCase() === "male" ? "MALE" : "FEMALE") : "",
        code: user?.extras?.idNumber || Math.floor(10000 + Math.random() * 90000),
        id_delivery_date: user?.extras?.dateOfIssue || "",
        middlename: '',
        occupation: user?.occupation || "",
        province_state: user?.account?.country_iso_code || "",
        msisdn: user?.account?.phone || "",
        nationality_country_iso_code: user?.account?.user_nationaility || "",
      }

    }


    //console.log(sender_obj)

    let beneficiary_obj
    if (second_type === "C") {
      // all fields of individual beneficiary
      beneficiary_obj = {
        firstname: beneficiary?.first_name,
        // middlename: beneficiary?.extras?.middle_name || "middlename",
        lastname: beneficiary?.last_name,
        bank_account_holder_name: bank_details?.account_holder_name || beneficiary?.first_name + ' ' + beneficiary?.last_name,
        id_expiration_date: "",
        lastname2: "",
        date_of_birth: beneficiary?.extras?.date_of_birth || "",
        country_iso_code: bank_id
          ? beneficiary?.extras?.country_iso_code || beneficiary?.country_iso_code
          : beneficiary?.country_iso_code || '',
        // lastname: beneficiary?.last_name,
        nativename: "",
        id_country_iso_code: "",
        email: beneficiary?.email || '',
        city: beneficiary?.city || '',
        postal_code: beneficiary?.postal_code || '',
        id_type: beneficiary?.extras?.id_type || "",
        address: beneficiary?.address || '',
        id_number: beneficiary?.extras?.id_number || "",
        gender: beneficiary?.extras?.gender ?
          (beneficiary?.extras?.gender?.toLowerCase() === "male" ? "MALE" : "FEMALE") : "",
        code: beneficiary?.extras?.id_number || null,
        id_delivery_date: "",
        occupation: beneficiary?.extras?.occupation || "",
        province_state: beneficiary?.extras?.province_state || "",
        country_of_birth_iso_code: "",
        msisdn: beneficiary?.phone || "",
        nationality_country_iso_code: beneficiary?.extras?.nationality || ""
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
        retail_fee_currency: "",
        credit_party_identifier: credit_party_identifier,
        retail_fee: "",
        external_id: transactionExternalID,
        sender: sender_obj,
        beneficiary: beneficiary_obj,

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
        retail_fee_currency: "",
        credit_party_identifier: credit_party_identifier,
        retail_fee: "",
        external_id: transactionExternalID,
        sending_business: sending_business,
        beneficiary: beneficiary_obj,

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
        retail_fee_currency: "",
        credit_party_identifier: credit_party_identifier,
        retail_fee: "",
        external_id: transactionExternalID,
        sending_business: sending_business,
        receiving_business: receiving_business,
        document_reference_number: 123,       // hardcoded for now

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
        retail_fee_currency: "",
        credit_party_identifier: credit_party_identifier,
        retail_fee: "",
        external_id: transactionExternalID,
        sender: sender_obj,
        receiving_business: receiving_business,

      };
    }

    const config = {
      headers: {
        'Authorization': authHeaders,
        'Content-Type': 'application/json'
      }
    };

    requestData['callback_url'] = 'https://fontawesomev23.com/api/webhook/thunes-transaction-status'
    requestData['external_code'] = user.account._id;

    console.log(requestData, "requestDatainintl", API_URL, config)

    const response = await axios.post(API_URL, requestData, config);
    const transactionResult = response.data;

    console.log(transactionResult, "transactionResult")

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
    console.log(decodedToken, "tokencheck")

    const transactionDetails = {
      calculations: decodedToken.result,
      extras: decodedToken.extras,
      purpose: purpose_of_remittance,
      description: additional_information,
      service_id,
      beneficiary_id,
      credit_party_identifier

    }

    const payload = {
      data: {
        TransactionID: transactionExternalID,
        wallet_id: wallet_id,
        status_message: transactionResult.status_message,
        user_id: user_id,
        transactionDetails
      },
      type,
    };

    console.log(payload, "payload")
    const encryptedData = await encryption(payload);

    req.body = encryptedData;

    next();

    // const options = {
    //   expiresIn: '1h',
    // };         // not expiring the token right now

    // const new_token = jwt.sign(payload, secretKey);

    // const output = await encryption({ Message: "Transaction Created", token: new_token });
    // res.json(output);

  } catch (error) {
    console.error('Error creating transaction:', error);

    if (error.response && error.response.data && error.response.data.errors) {

      // not showing the error messages by thunes thats why commented
      const errorMessages = error.response.data.errors
        .map(error => `${error.code}: ${error.message}`)
        .join(', ');
      console.log({ errorMessages })
      // const encryptedError = await encryption(errorMessages);

      const errorCodes = error.response.data.errors.map(error => error.code).join(', ');

      const encryptedError = await encryption(`Error Codes: ${errorCodes}. An internal server error occurred.`);

      res.status(error.response.status).send(encryptedError);
    } else {
      const encryptedError = await encryption('An error occurred while creating the transaction');
      res.status(500).send(encryptedError);
    }
  }
};

const uploadAttachments = async (TransactionID, file, type = "invoice", name = "invoice") => {
  const config = {
    headers: {
      'Authorization': authHeaders,
      'Content-Type': 'multipart/form-data'
    }
  };

  const formData = new FormData();
  const API_ATTACHMENT_URL = `${sandboxUrl}/v2/money-transfer/transactions/ext-${TransactionID}/attachments`;

  // for (const file of reqFiles) {
  const blob = new Blob([file.buffer], { type: file.mimetype });

  formData.append('file', blob, file.originalname);
  formData.append('type', type);
  formData.append('name', name);
  // }

  try {
    const response = await axios.post(API_ATTACHMENT_URL, formData, config);
    return response.data;
  } catch (error) {
    if (error.response && error.response.data && error.response.data.errors) {
      console.error("errorinside", error.response.data.errors);
    } else {
      return { status: false, message: 'An error occurred while uploading attachments' }
    }
  }
};

async function commissionCalculator(recipientId) {
  let followersCount = 0;
  try {
    const userInfo = await userInstaInfo(recipientId);
    if (userInfo) {
      followersCount = userInfo.follower_count;
    }
  } catch (error) {
    console.error('Error fetching user info, defaulting followersCount to 0');
  }

  let commission = 0;
  if (followersCount >= 0 && followersCount <= 100000) {
    commission = 0.03;
  } else if (followersCount >= 100001 && followersCount <= 1000000) {
    commission = 0.045;
  } else {
    commission = 0.06;
  }

  return commission;
}

async function userInstaInfo(recipientId) {
  try {
    const response = await axios.get(`https://graph.facebook.com/v19.0/${recipientId}?fields=username,name,follower_count&access_token=${process.env.facebook_access_token}`);
    console.log(response.data, "userInstaInfo")

    return response.data;
  } catch (err) {
    console.error('Error fetching info');
    return null;

  }
}

// In thunes we have to use this function after creating a transaction to confirm it 
const UAParser = require('ua-parser-js');
const { formattedAmount } = require("../utils/InstaChatbotHelpers");

exports.confirmTransaction = async (req, res) => {
  try {
    const decodedToken = req.body;
    console.log('token', decodedToken);

    const {
      TransactionID,
      wallet_id,
      user_id,
      withdrawal,
      transactionDetails
    } = decodedToken;

    const calculations = transactionDetails.calculations;
    const extras = transactionDetails.extras;

    const wallet = await Wallet.findOne({ _id: wallet_id }).populate('account')
    if (!wallet) {
      const output = await encryption("Wallet not found");
      return res.json(output);
    }

    const account = await Account.findOne({ _id: wallet.account.id }).populate("user")
    if (!account) {
      const output = await encryption("account not found");
      return res.json(output);
    }

    if (req?.files?.length > 3) {
      return res.status(400).json({ status: false, message: 'Maximum 3 files allowed' });
    }

    const thunesDetails = await thunesBalance()
    const USDBalance = thunesDetails.thunes.filter((item) => item.currency === "USD")

    let exchangedTotalWithFeeToUSD = await convertCurrency(calculations.recipient.currency, 'USD', calculations.recipient.value)

    if (exchangedTotalWithFeeToUSD > USDBalance[0].balance) {
      return res.status(400).json({ status: false, message: 'Insufficient Balance in thunes' });
    }

    let attachments = [];
    if (req?.files && req?.files?.length > 0) {
      const bucketName = process.env.AWS_BUCKET_NAME;
      for (const file of req.files) {
        if (file.mimetype.split("/")[0] === "image") {
          const params = {
            Bucket: bucketName,
            Key: `transaction_images/${account.username}_${TransactionID}/${file.originalname}`,
            Body: file.buffer
          }
          const uploadResult = await s3.upload(params).promise();
          if (uploadResult?.Location && uploadResult?.Key && uploadResult?.ETag) {
            attachments.push({
              key: uploadResult.Key,
              url: uploadResult.Location,
              ETag: uploadResult.ETag
            });
          }
          else {
            return res.status(500).json({ status: false, message: 'Something went wrong while uploading the image' });
          }
        } else {
          return res.status(400).json({ status: false, message: 'Only image files are allowed' });
        }
      }
    }

    const transactionId = decodedToken.TransactionID;
    if (attachments.length > 0) {
      for (const file of req.files) {
        const attachmentResponse = await uploadAttachments(transactionId, file, "invoice", "invoice");
        console.log(attachmentResponse, "attachmentResponse");
      }
    }

    const balance = wallet.balance.available
    const total = calculations.total.value

    if (total > balance) {
      const output = await encryption(`Insufficient Balance, your current balance in this wallet is ${balance}`);
      return res.json(output);
    }

    const config = {
      headers: {
        'Authorization': authHeaders,
        'Content-Type': 'application/json'
      }
    };

    console.log({ transactionId });
    const transactionDetailsUrl = `${sandboxUrl}/v2/money-transfer/transactions/ext-${transactionId}`;
    const transactionDetailsResponse = await axios.get(transactionDetailsUrl, config);
    const transactionDetailsData = transactionDetailsResponse.data;
    console.log({ transactionDetailsData });

    const vespiaTxId = generateUniqueInteger(TransactionID);

    // Parse user-agent header using ua-parser-js
    const userAgent = req.headers['user-agent'];
    const parser = new UAParser();
    const browserDetails = parser.setUA(userAgent).getResult();

    let paymentType;
    const serviceId = decodedToken.transactionDetails.service_id
    if (serviceId === 1) {
      paymentType = 'international_mobile_wallet';
    } else if (serviceId === 2) {
      paymentType = 'international_bank_transfer';
    } else if (serviceId === 3) {
      paymentType = 'international_cash_pickup';
    } else {
      paymentType = 'international_card_payment';
    }

    console.log(transactionDetailsData.beneficiary.country_iso_code, account?.country_iso_code)
    // Trigger Vespia API
    const vespiaRequestBody = {
      user_id: user_id,
      timestamp: new Date().toISOString().replace("T", " ").split(".")[0] + ".000",
      type: "TRANSFER",
      amount: transactionDetailsData.sent_amount.amount.toString(),
      currency: transactionDetailsData.sent_amount.currency,
      receiver_id: transactionDetails.beneficiary_id,
      tx_id: vespiaTxId.toString(),
      customer_age: calculateAge(account.dob).toString(),
      description: "International transaction",
      direction: "Outgoing",
      status: "Pending",
      document_expiration: account.user?.extras?.dateOfExpiry ?
        `${account.user.extras.dateOfExpiry} 12:00:00` : null,
      last_email_change: null,
      last_phone_change: null,
      is_instapay_member: true,
      sender_country: getCountryName(account?.country_iso_code) || "Unknown",
      receiver_country: getCountryName(transactionDetailsData.beneficiary.country_iso_code) || "Unknown",
      user_ip: req.ip === "::1"
        ? "192.168.1.1"
        : req.ip.startsWith("::ffff:")
          ? req.ip.split("::ffff:")[1]
          : req.ip,
      user_email: account?.email || "Unknown",
      user_passport: account.user?.extras?.idNumber || "Unknown",
      user_phone: account.phone.startsWith("+") ? account.phone : `+${account.phone}`, // Format phone
      payment_card: serviceId === 3 ? "1234-5678-9012-3456" : null,
      user_wallet_balance: balance,
      crypto_type: null,
      payment_method: serviceId === 1 ? "Mobile Wallet" : serviceId === 2 ? "Bank Account" : serviceId === 3 ? "Cash Pickup" : "Credit Card",
      industry_type: null,
      business_size: null,
      browser_name: browserDetails?.browser?.name || "Unknown",
      platform: browserDetails?.os?.name || "Unknown",
      browser_version: browserDetails?.browser?.version || "Unknown",
      is_mobile_user: browserDetails?.device?.type === 'mobile'
    };

    console.log({ vespiaRequestBody })

    const vespiaResponse = await axios.post('http://ec2-15-188-72-2.eu-west-3.compute.amazonaws.com:5000/handle_data', vespiaRequestBody, {
      headers: {
        'Authorization': `Bearer ${process.env.vespiaToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(vespiaResponse.data, "Vespia API Response");

    const senderTimezone = wallet.account.timezone || "UTC";
    const senderCurrentTime = momenttz().tz(senderTimezone).format();

    const senderTransactionObj = {
      reference_id: `tr_${Date.now()}`,
      external_reference: transactionId,
      type: 'instant',
      transaction_type: 'debit',
      service_type: `${withdrawal ? 'withdrawal' : 'international'}`,
      payment_type: paymentType,
      status: 'INITIATED',
      channel_details: transactionDetails.credit_party_identifier,
      purpose: decodedToken.transactionDetails.purpose,
      description: decodedToken.transactionDetails.description,
      currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
      amount: total - calculations.fee.value,
      recipient_received_amount: calculations.recipient.value,
      recipient_received_currency: calculations.recipient.currency,
      fee: calculations.fee.value,
      fee_type: extras.fee_type,
      vendor: { name: "thunes", fee: extras?.thunes_fee || 0, rate: extras?.thunes_rate },
      ip_fee: calculations.fee.value - extras.thunes_fee || 0,
      markup: withdrawal ? extras?.percentage_markup : extras?.markup_value,
      markup_currency: wallet.currency.code,
      exchange_rate: extras?.original_exchange_rate,
      exchange_rate_markup: extras?.exchange_rate_with_markup,
      feeToSendingRate: extras?.feeToSendingRate,
      total: total,
      wallet_id: wallet.wallet_id,
      wallet: wallet._id,
      account: wallet.account._id,
      sender: wallet.account._id,
      beneficiary: transactionDetails.beneficiary_id || null,
      receiver: null,
      current_balance: wallet.balance.available,
      new_balance: wallet.balance.available - total,
      attachments,
      timeline: [
        {
          status: 'INITIATED',
          date: senderCurrentTime,
        }
      ],
      payment_id: vespiaTxId // Using this ID in vespia callback to track the transaction
    };

    const transaction = await Transaction.create(senderTransactionObj);
    console.log(transaction, "Transaction created with status CHECKED");

    // deducting the balcen from wallet
    wallet.balance.available = wallet.balance.available - total;
    await wallet.save()

    let USDTotal;
    if (wallet.currency.code !== 'USD') {
      USDTotal = await convertCurrency(wallet.currency.code, 'USD', total);
    } else {
      USDTotal = total;
    }

    // Updating the used limits object
    await updateUsedLimits(wallet.account, null, USDTotal, null);

    const outputData = {
      TransactionID: transactionId,
      reference_id: transaction.reference_id,
      beneficiary: {
        first_name: transactionDetailsData.beneficiary.firstname,
        last_name: transactionDetailsData.beneficiary.lastname,
      },
    };

    res.status(200).send(await encryption({ status: true, message: 'Transaction initiated succesfully.', data: outputData }));

  } catch (error) {
    console.error('Error confirming transaction:', error?.response?.data || error);
    res.status(500).send(await encryption({ status: false, message: 'Something went wrong while confirming the transaction' }));
  }
};

exports.confirmTransactionTopup = async (req, res) => {
  try {

    const data = req.body.data

    const decrypted = await decryption(data)

    const { token } = decrypted

    // decoding token and throwing error if invalid or expired
    const decodedToken = jwt.verify(token, process.env.jwtKey);

    if (!decodedToken) {
      const output = await encryption("Invalid or expired token");
      return res.json(output);
    }
    const {
      TransactionID,
      wallet_id,
      withdrawal,
      transactionDetails
    } = decodedToken;

    const calculations = transactionDetails.calculations;
    const extras = transactionDetails.extras;


    const wallet = await Wallet.findOne({ _id: wallet_id }).populate('account')
    if (!wallet) {
      const output = await encryption("Wallet not found");
      return res.json(output);
    }

    const account = await Account.findOne({ _id: wallet.account.id })
    if (!account) {
      const output = await encryption("account not found");
      return res.json(output);
    }

    if (req?.files?.length > 3) {
      return res.status(400).json({ status: false, message: 'Maximum 3 files allowed' });
    }

    const thunesDetails = await thunesBalance()

    console.log(thunesDetails, "thunesDetails")
    const USDBalance = thunesDetails.thunes.filter((item) => item.currency === "USD")
    console.log(USDBalance, "USDBalance",)

    let exchangedTotalWithFeeToUSD = await convertCurrency(calculations.recipient.currency, 'USD', calculations.recipient.value)

    if (exchangedTotalWithFeeToUSD > USDBalance[0].balance) {
      return res.status(400).json({ status: false, message: 'Insufficient Balance in thunes' });
    }


    let attachments = [];

    if (req?.files && req?.files?.length > 0) {
      const bucketName = process.env.AWS_BUCKET_NAME;

      for (const file of req.files) {
        if (file.mimetype.split("/")[0] === "image") {
          const params = {
            Bucket: bucketName,
            Key: `transaction_images/${account.username}_${TransactionID}/${file.originalname}`,
            Body: file.buffer
          }

          const uploadResult = await s3.upload(params).promise();

          if (uploadResult?.Location && uploadResult?.Key && uploadResult?.ETag) {
            attachments.push({
              key: uploadResult.Key,
              url: uploadResult.Location,
              ETag: uploadResult.ETag
            });
          }
          else {
            return res.status(500).json({ status: false, message: 'Something went wrong while uploading the image' });
          }
        } else {
          return res.status(400).json({ status: false, message: 'Only image files are allowed' });
        }
      }
    }

    const config1 = {
      headers: {
        'Authorization': authHeaders,
        'Content-Type': 'multipart/form-data'
      }
    };

    const transactionId = decodedToken.TransactionID;
    if (attachments.length > 0) {
      for (const file of req.files) {

        const attachmentResponse = await uploadAttachments(transactionId, file, "invoice", "invoice");

        console.log(attachmentResponse, "attachmentResponse");
      }

    }

    const balance = wallet.balance.available
    const total = calculations.total.value
    // const daily_limit= account.daily_limit.sending_limit_used
    // const monthly_limit= account.monthly_limit.sending_limit_used
    // const yearly_limit= account.yearly_limit.sending_limit_used

    if (total > balance) {
      const output = await encryption(`Insufficient Balance, your current balance in this wallet is ${balance}`);
      return res.json(output);
    }

    //   if (total > daily_limit) {
    //     const output = await encryption(`Amount is more than the reamining daily sending limit`);
    //     return res.json(output);
    // }

    // if (total > monthly_limit) {
    //   const output = await encryption(`Amount is more than the reamining monthly sending limit`);
    //   return res.json(output);
    // }

    // if (total > yearly_limit) {
    //   const output = await encryption(`Amount is more than the reamining yearly sending limit`);
    //   return res.json(output);
    // }
    // const transactionDetails = decodedToken.transactionDetails;

    const config = {
      headers: {
        'Authorization': authHeaders,
        'Content-Type': 'application/json'
      }
    };
    const API_URL = `${sandboxUrl}/v2/money-transfer/transactions/ext-${transactionId}/confirm`;
    // const API_URL = `${productionUrl}/v2/money-transfer/transactions/ext-${transactionId}/confirm`;

    const response = await axios.post(API_URL, {}, config);
    console.log(response.data, "response.data");
    const confirmationResult = response.data;

    // converting the creation time in readable format
    const humanReadableCreationDate = moment(confirmationResult.creation_date).format('MMMM Do YYYY, h:mm a');

    // // only keeping important fields
    const outputData = {
      TransactionID: transactionId,
      status_message: confirmationResult.status_message,
      additional_information_1: confirmationResult.additional_information_1,
      sender: {
        ...confirmationResult.sender,
      },
      beneficiary: {
        ...confirmationResult.beneficiary,
      },
      creation_date: humanReadableCreationDate,
      credit_party_identifier: {
        ...confirmationResult.credit_party_identifier,
      },
      destination: {
        ...confirmationResult.destination,
      },
      payer: {
        ...confirmationResult.payer,
      },
      purpose_of_remittance: confirmationResult.purpose_of_remittance,
      sent_amount: {
        ...confirmationResult.sent_amount,
      },
      source: {
        ...confirmationResult.source,
      },
      transaction_type: confirmationResult.transaction_type,
      wholesale_fx_rate: confirmationResult.wholesale_fx_rate,
    };


    if (confirmationResult.status_class_message === 'CONFIRMED') {
      wallet.balance.available = balance - total;
      await wallet.save();

      // const beneficiary = await Beneficiary.findById(transactionDetails.beneficiary_id);

      let paymentType;
      if (decodedToken.transactionDetails.service_id === 1) {
        paymentType = 'international_mobile_wallet';
      } else if (decodedToken.transactionDetails.service_id === 2) {
        paymentType = 'international_bank_transfer';
      } else if (decodedToken.transactionDetails.service_id === 3) {
        paymentType = 'international_cash_pickup';
      } else {
        paymentType = 'international_card_payment';
      }
      const senderTimezone = wallet.account.timezone || "UTC"
      const senderCurrentTime = momenttz().tz(senderTimezone).format();

      const senderTransactionObj = {
        reference_id: `tr_${Date.now()}`,
        external_reference: transactionId,
        type: 'instant',
        transaction_type: 'debit',
        service_type: `${withdrawal ? 'withdrawal' : 'international'}`,
        payment_type: paymentType,
        status: 'INITIATED',
        channel_details: transactionDetails.credit_party_identifier,
        purpose: decodedToken.transactionDetails.purpose,
        description: decodedToken.transactionDetails.description,
        currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
        amount: total - calculations.fee.value,
        fee: calculations.fee.value,
        fee_type: extras.fee_type,
        markup: extras?.markup_value,
        markup_currency: calculations.recipient.currency,
        exchange_rate: extras?.exchange_rate_with_markup,
        exchange_rate_markup: extras?.exchange_rate_with_markup,
        total: total,
        wallet_id: wallet.wallet_id,
        wallet: wallet._id,
        account: wallet.account._id,
        sender: wallet.account._id,
        beneficiary: transactionDetails.beneficiary_id || null,
        receiver: null,
        current_balance: wallet.balance.available,
        attachments,
        timeline: [
          {
            status: 'INITIATED',
            date: senderCurrentTime,
          }
        ]
      };

      console.log(senderTransactionObj, "senderTransactionObj")

      Transaction.create(senderTransactionObj).then(async (senderTransaction) => {
        // updating the limits used
        let USDTotal;
        if (wallet.currency.code !== 'USD') {
          USDTotal = await convertCurrency(wallet.currency.code, 'USD', total);
        } else {
          USDTotal = total
        }

        // Updating the used limits object
        await updateUsedLimits(wallet.account, null, USDTotal, null);

        // commission work, only if transaction is not withdrawal
        if (wallet?.account?.parentId && !withdrawal) {
          const parent = await Account.findById(wallet.account.parentId).populate('insta_recipient_id');
          const commission = await commissionCalculator(parent.insta_recipient_id?.recipient);
          console.log("Commission", commission)
          let commissionObj = {
            parent: wallet.account.parentId,
            child: wallet.account._id,
            commission: commission,
            currency: 'USD',
          }

          console.log(parent.commission, "commission")
          parent.commission = (parent.commission || 0) + commission
          await parent.save()

          const newCommission = new CommissionModel(commissionObj);

          await newCommission.save()
        }

        // if cash pickup, send the payer_transaction_code to the recipient
        if (decodedToken.transactionDetails.service_id === 3) {
          const verificationCode = confirmationResult?.payer_transaction_code
          const destination = confirmationResult?.destination
          const message = `${wallet.account?.first_name} ${wallet.account?.last_name} has sent you ${destination?.amount} ${destination?.currency} with instapay. Your verification code is ${verificationCode}.\nYou can collect amount from the given below InstaPay partners.\n\nhttps://www.instapay.com/`;

          console.log(message, "message")
          const check = await sendSMSTemplate(confirmationResult?.credit_party_identifier?.msisdn, message);
        }
        const output = await encryption(outputData);
        res.status(200).json(output);
      }).catch(err => {
        console.log(err);
        res.status(400).json(err);
      })

      // account.daily_limit.sending_limit_used = daily_limit + total
      // account.monthly_limit.sending_limit_used = monthly_limit + total
      // account.yearly_limit.sending_limit_used = yearly_limit + total
      // await account.save();

    } else {
      res.status(400).json({ message: "Transaction Failed" });
    }

  } catch (error) {
    console.error('Error confirming transaction:', error, 'error', error?.response?.data);

    // if (error.response && error.response.data && error.response.data.errors) {

    //   //  not showing the error messages by thunes thats why commented
    //   //   const errorMessages = error.response.data.errors
    //   //       .map(error => `${error.code}: ${error.message}`)
    //   //       .join(', ');

    //   //   const encryptedError = await encryption(errorMessages);

    //   const errorCodes = error.response.data.errors.map(error => error.code); // Extract all error codes by thunes

    //   const encryptedError = await encryption(errorCodes.join(', '));

    //   res.status(error.response.status).send(encryptedError);
    // } else {
    //   const encryptedError = await encryption('An error occurred while confirming the transaction');
    res.status(500).send(error);
    // }
  }
};


// get the status of the transaction
exports.getStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const API_URL = `${sandboxUrl}/v2/money-transfer/transactions/ext-${transactionId}`;

    const config = {
      headers: {
        'Authorization': authHeaders,
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

    const output = await encryption(outputData);
    res.json(output);


  } catch (error) {
    console.error('Error getting status:', error);

    if (error.response && error.response.data && error.response.data.errors) {

      //  not showing the error messages by thunes thats why commented
      //   const errorMessages = error.response.data.errors
      //       .map(error => `${error.code}: ${error.message}`)
      //       .join(', ');

      //   const encryptedError = await encryption(errorMessages);

      const errorCodes = error.response.data.errors.map(error => error.code); // Extract all error codes by thunes

      const encryptedError = await encryption(errorCodes.join(', '));

      res.status(error.response.status).send(encryptedError);
    } else {
      const encryptedError = await encryption('An error occurred while getting the status');
      res.status(500).send(encryptedError);
    }
  }
};

// NEW APIS
// // // // // // // // // // // // // // // // // // // // // // // // // // // // //

async function getExchangeRate(from, to, amount) {
  try {
    if (to !== from) {
      let exchangeRate = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`);

      if (exchangeRate.data.success) {
        console.log(exchangeRate.data)
        let rate = formatDecimalNumbersWithLimit(exchangeRate.data.info.rate, 6);
        let convertedAmount = formatDecimalNumbersWithLimit(exchangeRate.data.result, 2);
        return { rate, convertedAmount };
      } else {
        return null;
      }
    } else {
      return { rate: 1, convertedAmount: amount };
    }
  } catch (err) {
    console.error(err);
    return null;
  }
}

exports.getMarkupExchangeRate = async (req, res) => {
  const { from, to, amount, fromOrTo, service_name, account_id, payer_id, service_id } = req.query;
  const receivingCurrency = fromOrTo === 'from' ? to : from;
  try {

    if (!from || !to || !amount || !fromOrTo || !payer_id || !service_id) {
      const error = await encryption({
        status: false,
        message: "Invalid data",
        currency: receivingCurrency
      });
      return res.status(400).send(error);
    }

    const accountDetails = await Account.findById(account_id).populate("level");

    let feeDetails
    let accountLevel = accountDetails.level
    if (accountLevel.level_no === 1) {
      accountLevel = await AccountLevelModel.findOne({ $and: [{ level_no: 2 }, { country: accountDetails.country }, { category: accountLevel.category }, { account_type: "individual" }] });
      feeDetails = await Fee.findOne({ $and: [{ service_name }, { account_level: accountLevel._id }] })
      console.log(feeDetails, "feeDetails")
    } else {
      accountLevel = accountLevel
      feeDetails = await Fee.findOne({ $and: [{ service_name }, { account_level: accountLevel._id }] })
    }

    let paymentType;
    let channelName
    if (service_id == 1) {
      paymentType = 'mobile_money';
      channelName = "mobile_money";
    } else if (service_id == 2) {
      paymentType = 'bank';
      channelName = "bank_account";
    } else if (service_id == 3) {
      paymentType = 'cash_pickup';
      channelName = "cash_pickup";
    } else {
      paymentType = 'card_payment';
      channelName = "card_payment"
    }

    let featureCheck1 = await featureCheck("international_transfer", paymentType, accountLevel);

    if (!featureCheck1) {
      const error = await encryption({
        status: false,
        message: "Feature not available in your country!",
        currency: receivingCurrency
      });
      return res.status(400).send(error);
    }

    // getting minimum and maximum values from thunes
    const config = {
      headers: {
        'Authorization': authHeaders,
      }
    };
    const payer_rates = await axios.get(`${process.env.THUNES_PROD_URL}/v2/money-transfer/payers/${payer_id}`, config)

    console.log("payerDetails", payer_rates.data)

    // fetching receiving country fee
    const country = await CountryModel.findOne({ country_iso_code: payer_rates.data.country_iso_code });
    const receivingCountryFee = await ReceiverFee.findOne({ country, service_name: channelName });

    const min_thunes_value = payer_rates?.data?.transaction_types['C2C']?.minimum_transaction_amount
    let max_thunes_value = payer_rates?.data?.transaction_types['C2C']?.maximum_transaction_amount

    console.log({ max_thunes_value }, payer_rates?.data?.transaction_types['C2C'])

    // Convert minimum USD amount to the sending currency
    const Thunes_Currency = "USD";
    const min_usd_value = 2; // Set minimum to 2 USD
    let converted_min_usd_to_from_currency = await convertCurrency("USD", from, min_usd_value);
    console.log("converted_min_usd_to_from_currency", converted_min_usd_to_from_currency)

    // Determine the final minimum value based on Thunes or 2 USD
    let final_minimum_value;
    if (min_thunes_value) {
      let converted_thunes_min_value = await convertCurrency(to, from, min_thunes_value);
      console.log("converted_thunes_min_value", converted_thunes_min_value, min_thunes_value)
      if (converted_min_usd_to_from_currency < converted_thunes_min_value) {
        final_minimum_value = converted_thunes_min_value;
      } else {
        final_minimum_value = converted_min_usd_to_from_currency;
      }
    } else {
      final_minimum_value = converted_min_usd_to_from_currency;
    }

    // finding rates and recipient amount based on markup
    const markup = receivingCountryFee?.percentage_markup || feeDetails.percentage_markup

    let exchangeData = await getExchangeRate(from, to, amount);

    if (!exchangeData) {
      const error = await encryption({
        status: false,
        message: "FX not found",
        currency: receivingCurrency
      });
      return res.status(400).send(error);
    }
    const { rate, convertedAmount } = exchangeData;

    // If the currencies are the same, no markup is applied
    let markupExchangeRate = rate;
    if (from !== to) {
      const percentageMarkup = (markup / 100) * rate;
      markupExchangeRate = rate - percentageMarkup;
    }

    console.log({ markupExchangeRate, convertedAmount, rate, amount, markup })


    // calculatng recipient amount based on fromOrTo
    let recipientAmount;
    if (fromOrTo === 'from') {
      recipientAmount = (convertedAmount * (markupExchangeRate / rate)).toFixed(2);
    } else if (fromOrTo === 'to') {
      recipientAmount = (amount / markupExchangeRate).toFixed(2);
    } else {
      const error = await encryption({
        status: false,
        message: "Invalid from or to",
        currency: receivingCurrency
      });
      return res.status(400).send(error);
    }

    if (fromOrTo === 'from' && amount < final_minimum_value) {
      const error = await encryption(
        { status: false, message: `Amount is below the minimum allowed`, value: final_minimum_value, currency: receivingCurrency }
      )

      return res.status(400).send(error)
    } else if (fromOrTo === 'to' && recipientAmount < final_minimum_value) {
      const error = await encryption(
        { status: false, message: `Amount is below the minimum allowed`, value: final_minimum_value, currency: receivingCurrency }
      )
      return res.status(400).send(error)
    }

    let daily_sending_limit_used = formatDecimalNumbersWithLimit(accountDetails.used_limits.daily_sending_limit) || 0;
    let monthly_sending_limit_used = formatDecimalNumbersWithLimit(accountDetails.used_limits.monthly_sending_limit) || 0;
    let yearly_sending_limit_used = formatDecimalNumbersWithLimit(accountDetails.used_limits.yearly_sending_limit) || 0;

    let daily_sending_limit = accountDetails.level.daily_sending_limit;
    let monthly_sending_limit = accountDetails.level.monthly_sending_limit;
    let yearly_sending_limit = accountDetails.level.yearly_sending_limit;

    let transaction_amount_limit = accountDetails.level.transaction_amount_limit;

    if (accountDetails?.is_external_limit) {
      daily_sending_limit = accountDetails.external_limits.daily_sending_limit;
      monthly_sending_limit = accountDetails.external_limits.monthly_sending_limit;
      yearly_sending_limit = accountDetails.external_limits.yearly_sending_limit;

      transaction_amount_limit = accountDetails.external_limits.transaction_amount_limit;
    }

    // RATE TO FIND THE LIMITS
    exchange_rate_in_usd = formatDecimalNumbersWithLimit(await convertCurrency('USD', from, 1), 6)

    if (from !== 'USD') {
      daily_sending_limit_used = exchange_rate_in_usd * daily_sending_limit_used;
      monthly_sending_limit_used = exchange_rate_in_usd * monthly_sending_limit_used;
      yearly_sending_limit_used = exchange_rate_in_usd * yearly_sending_limit_used;

      daily_sending_limit = exchange_rate_in_usd * daily_sending_limit;
      monthly_sending_limit = exchange_rate_in_usd * monthly_sending_limit;
      yearly_sending_limit = exchange_rate_in_usd * yearly_sending_limit;

      transaction_amount_limit = exchange_rate_in_usd * transaction_amount_limit;
    }

    max_thunes_value = max_thunes_value ? await convertCurrency(to, from, max_thunes_value) : max_thunes_value

    // finding the maximum amount
    let minimum_sending_limit = Math.min(daily_sending_limit - daily_sending_limit_used, monthly_sending_limit - monthly_sending_limit_used, yearly_sending_limit - yearly_sending_limit_used);
    minimum_sending_limit = Math.min(minimum_sending_limit, transaction_amount_limit);
    minimum_sending_limit = Math.min(minimum_sending_limit, !max_thunes_value ? minimum_sending_limit : max_thunes_value)

    console.log({ minimum_sending_limit })

    // let max_value_in_sending_currency = formatDecimalNumbersWithLimit(await convertCurrency(Thunes_Currency, from, minimum_sending_limit))

    if (fromOrTo === 'from' && amount > minimum_sending_limit) {
      const error = await encryption(
        { status: false, message: `Amount is above the maximum allowed`, value: minimum_sending_limit, currency: receivingCurrency }
      )
      return res.status(400).send(error)
    } else if (fromOrTo === 'to' && recipientAmount > minimum_sending_limit) {
      const error = await encryption(
        { status: false, message: `Amount is above the maximum allowed`, value: minimum_sending_limit, currency: receivingCurrency }
      )
      return res.status(400).send(error)
    }

    // TOKEN for preserving the amount
    const payload = {
      preserved_amount: parseFloat(recipientAmount),
      local_currency: from,
    }

    const token = jwt.sign(payload, secretKey, { expiresIn: '1h' });

    const data = {
      recipientAmount: parseFloat(recipientAmount),
      exchangeRate: formatDecimalNumbersWithLimit(markupExchangeRate, 6),
      minimumValue: formatDecimalNumbersWithLimit(final_minimum_value),
      maximumValue: formatDecimalNumbersWithLimit(minimum_sending_limit),
      limits_used: {
        daily_sending_limit_used,
        monthly_sending_limit_used,
        yearly_sending_limit_used
      },
      limits: {
        daily_sending_limit,
        monthly_sending_limit,
        yearly_sending_limit
      },
      token
    };

    const ciphertext = await encryption({
      status: true,
      message: "Rates with markup",
      data,
    });

    res.status(200).send(ciphertext);
  } catch (error) {
    console.log(error?.response?.data?.errors || error)
    const err = await encryption({
      status: false,
      message: "Internal server error!",
      currency: receivingCurrency
    });
    return res.status(400).send(err);
  }
};

async function calculateThunesMarkup({ totalAmount, destination_currency, thunes_rate }) {
  const googleRateFromUSDtoDestinationCurrency = await convertCurrency('USD', destination_currency, 1);
  const dividend = (thunes_rate / googleRateFromUSDtoDestinationCurrency) * 100;
  const thunesMarkupInPercents = 100 - dividend;
  const percentageAmountOfThunesMarkupFromSendingAmount = (thunesMarkupInPercents / 100) * totalAmount;

  console.log({
    dividend,
    googleRateFromUSDtoDestinationCurrency,
    thunes_rate,
    thunesMarkupInPercents,
    percentageAmountOfThunesMarkupFromSendingAmount
  });

  return {
    feeMarkup: percentageAmountOfThunesMarkupFromSendingAmount,
    updatedTotalAmount: totalAmount + percentageAmountOfThunesMarkupFromSendingAmount
  };
}

async function getWithdrawalFXHelper(data) {
  try {
    const {
      transaction_type,
      amount,
      service_name,
      wallet_id,
      channel_name,
      service_id,
      iso_code,
      currency_code,
      payerId,
    } = data;

    const walletDetails = await Wallet.findById(wallet_id).populate([{ path: 'account', populate: [{ path: 'level' }] }]);
    if (!walletDetails) return { status: 400, message: "Wallet not found", success: false };

    const formatted_amount = formatDecimalNumbersWithLimit(amount);
    const external_id1 = shortid.generate();
    // const country = await CountryModel.findOne({ country_iso_code: iso_code });
    // const receivingCountryFee = await ReceiverFee.findOne({ country, service_name: channel_name });
    const userWalletLevel = walletDetails.account.level;

    const accountLevel = userWalletLevel.level_no === 1
      ? await AccountLevelModel.findOne({ level_no: 2, country: walletDetails.account.country, category: userWalletLevel.category, account_type: "individual" })
      : userWalletLevel;

    const feeDetails = await Fee.findOne({ service_name, account_level: accountLevel._id }).populate('account_level');
    const { fee_type, flat_fee, percentage_fee, fee_currency, markup_type, percentage_markup } = feeDetails;

    const paymentType = service_id == 1 ? 'mobile_money' : service_id == 2 ? 'bank' : service_id == 3 ? 'cash_pickup' : 'card_payment';

    const featureCheck1 = await featureCheck("international_transfer", paymentType, accountLevel);
    if (!featureCheck1) return { status: 400, message: "This feature is not available your country!", success: false };

    const config = { headers: { 'Authorization': authHeaders } };
    const payer_rates = await axios.get(`${process.env.THUNES_PROD_URL}/v2/money-transfer/payers/${payerId}`, config);

    const { currency: destination_currency, transaction_types: { C2C: { maximum_transaction_amount, minimum_transaction_amount } } } = payer_rates.data;

    // console.log(payer_rates.data)

    let Min_Value = minimum_transaction_amount || 0;
    let Max_Value = maximum_transaction_amount || null;

    console.log({ Max_Value })

    if (Max_Value !== null) {
      Max_Value = await convertCurrency(destination_currency, walletDetails.currency.code, Max_Value);
    }

    if (Min_Value !== 0) {
      Min_Value = await convertCurrency(destination_currency, walletDetails.currency.code, Min_Value);
    }

    // minimum value related work
    let minimumThresholdUSD = 10;
    let minimumSendingThreshold = await convertCurrency('USD', walletDetails.currency.code, minimumThresholdUSD);
    let totalMinimumThreshold = formatDecimalNumbersWithLimit(minimumSendingThreshold + Min_Value);

    console.log({
      totalMinimumThreshold,
      Min_Value,
      minimumSendingThreshold,
      minimumThresholdUSD,
      formatted_amount,
      Max_Value
    });

    // Check if totalAmount meets the minimum threshold
    if (formatted_amount < totalMinimumThreshold) {
      return {
        status: 400,
        message: `This amount is less than the required minimum of ${formatDecimalNumbersWithLimit(totalMinimumThreshold)} ${walletDetails.currency.code}.`,
        success: false,
        value: formatDecimalNumbersWithLimit(totalMinimumThreshold),
      };
    }

    // maximum related work
    let daily_sending_limit_used = walletDetails.account.used_limits.daily_sending_limit || 0;
    let monthly_sending_limit_used = walletDetails.account.used_limits.monthly_sending_limit || 0;
    let yearly_sending_limit_used = walletDetails.account.used_limits.yearly_sending_limit || 0;

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

    let remaining_daily_limit = daily_sending_limit - daily_sending_limit_used;
    let remaining_monthly_limit = monthly_sending_limit - monthly_sending_limit_used;
    let remaining_yearly_limit = yearly_sending_limit - yearly_sending_limit_used;

    let calculated_sending_limit = Math.min(
      remaining_daily_limit,
      remaining_monthly_limit,
      remaining_yearly_limit,
      transaction_amount_limit
    );

    // Compare with Thunes maximum transaction amount if available
    let effective_max_limit = Max_Value ? Math.min(calculated_sending_limit, Max_Value) : calculated_sending_limit;

    // Convert the maximum limit to the sending currency
    let max_value_in_sending_currency = formatDecimalNumbersWithLimit(await convertCurrency('USD', currency_code, effective_max_limit));

    if (formatted_amount > max_value_in_sending_currency) {
      return {
        status: 400,
        message: `This amount is greater than the required maximum of ${formatDecimalNumbersWithLimit(max_value_in_sending_currency)} ${currency_code}.`,
        success: false,
        value: formatDecimalNumbersWithLimit(max_value_in_sending_currency),
      };
    }

    // FEE Calculation
    let feeExchange, feeToSendingRate

    if (fee_type === "flat") {
      const { rate, convertedAmount } = await getExchangeRate(fee_currency, currency_code, flat_fee)
      feeExchange = convertedAmount
      feeToSendingRate = rate
      console.log({ rate, convertedAmount })
    } else {
      feeExchange = formatted_amount * (percentage_fee / 100);
    }

    feeExchange = formatDecimalNumbersWithLimit(feeExchange);

    const quotationResult = await createQuotationHelper({
      external_id: external_id1,
      payer_id: payerId,
      mode: 'DESTINATION_AMOUNT',
      transaction_type,
      source: { amount: null, currency: 'USD', country_iso_code: 'USA' },
      destination: { amount: 1 > Min_Value ? 1 : Min_Value, currency: destination_currency },
    });
    if (!quotationResult.status) {
      return { status: 500, message: "Something went wrong while finding the rates. Please try again.", success: false };
    }

    const { fee: { amount: fee_thunes }, wholesale_fx_rate: thunes_rate } = quotationResult.data;
    const converted_thunes_fee_into_sending = await convertCurrency('USD', walletDetails.currency.code, fee_thunes);

    let totalFee = 0
    // CASE (Sending === Recipient)
    if (walletDetails.currency.code === destination_currency) {

      console.log(`Case 1: ${walletDetails.currency.code} = ${destination_currency}`)

      const { feeMarkup, updatedTotalAmount } = await calculateThunesMarkup({
        totalAmount: formatted_amount,
        destination_currency,
        thunes_rate
      });

      totalFee += feeMarkup;
      console.log({ feeMarkup, updatedTotalAmount })

    }

    const rates_sending_to_destination = await getExchangeRate(walletDetails.currency.code, destination_currency, formatted_amount);
    if (!rates_sending_to_destination) return { status: 400, message: "FX not found!", success: false };

    const { rate, convertedAmount } = rates_sending_to_destination;
    // markup FX
    let markupExchangeRate = formatDecimalNumbersWithLimit(rate, 6);
    if (walletDetails.currency.code !== destination_currency) {
      const percentageMarkup = (percentage_markup / 100) * rate;
      markupExchangeRate = formatDecimalNumbersWithLimit(rate - percentageMarkup, 6);
    }

    // CALCULATION

    totalFee += feeExchange + formatDecimalNumbersWithLimit(converted_thunes_fee_into_sending);
    let sendingAmount = formatDecimalNumbersWithLimit(formatted_amount - totalFee);

    // Prevent negative sendingAmount
    if (sendingAmount < 0) return { status: 400, message: "Insufficient amount after fee deduction", success: false };

    const total_converted_in_system_currency = await convertCurrency(walletDetails.currency.code, 'USD', formatted_amount);
    let recipientAmount = formatDecimalNumbersWithLimit(sendingAmount * markupExchangeRate)

    const limitCheck1 = limitCheck(total_converted_in_system_currency, accountLevel, walletDetails.account, 'sending');
    if (!limitCheck1.status) return { status: 400, message: limitCheck1.code, success: false };

    const result = {
      exchanged_rate: { value: markupExchangeRate, currency: destination_currency },
      fee: { value: formatDecimalNumbersWithLimit(totalFee), currency: currency_code },
      recipient: { value: formatDecimalNumbersWithLimit(recipientAmount), currency: destination_currency },
      total: { value: formatDecimalNumbersWithLimit(formatted_amount), currency: currency_code },
      sending: { value: sendingAmount, currency: currency_code },
      min_amount: totalMinimumThreshold,
      max_amount: max_value_in_sending_currency
    };

    const payload = {
      result,
      extras: {
        markup_value: percentage_markup,
        fee_type,
        thunes_fee: fee_thunes,
        original_exchange_rate: rate,
        exchange_rate_with_markup: markupExchangeRate,
        precision: payer_rates.data.precision,
      }
    };

    const newToken = jwt.sign(payload, secretKey, { expiresIn: '1h' });

    return { status: 200, data: { result, token: newToken }, success: true };

  } catch (err) {
    console.error(err);
    return { status: 500, message: err?.message || "Something went wrong while getting exchange rates", success: false };
  }
}

async function getIntlFXHelper(data) {
  try {
    const {
      transaction_type,
      amount,
      service_name,
      wallet_id,
      channel_name,
      service_id,
      iso_code,
      currency_code,
      payment_method,
      payerId,
      chatbot,
      token
    } = data;

    const walletDetails = await Wallet.findById(wallet_id).populate([{ path: 'account', populate: [{ path: 'level' }] }]);

    if (!walletDetails) return { status: 400, message: "Wallet not found", success: false };

    const formatted_amount = formatDecimalNumbersWithLimit(parseFloat(amount));
    const external_id1 = shortid.generate();
    const country = await CountryModel.findOne({ country_iso_code: iso_code });
    const receivingCountryFee = await ReceiverFee.findOne({ country, service_name: channel_name });
    const userWalletLevel = walletDetails.account.level;

    const accountLevel = userWalletLevel.level_no === 1
      ? await AccountLevelModel.findOne({ level_no: 2, country: walletDetails.account.country, category: userWalletLevel.category, account_type: "individual" })
      : userWalletLevel;

    const feeDetails = await Fee.findOne({ service_name, account_level: accountLevel._id }).populate('account_level');
    const { fee_type, flat_fee, percentage_fee, fee_currency, markup_type, percentage_markup } = receivingCountryFee || feeDetails;

    const paymentType = service_id == 1 ? 'mobile_money' : service_id == 2 ? 'bank' : service_id == 3 ? 'cash_pickup' : 'card_payment';

    const featureCheck1 = await featureCheck("international_transfer", paymentType, accountLevel);
    if (!featureCheck1) return { status: 400, message: "Feature not available!", success: false };

    const config = { headers: { 'Authorization': authHeaders } };
    const payer_rates = await axios.get(`${process.env.THUNES_PROD_URL}/v2/money-transfer/payers/${payerId}`, config);

    const { currency: destination_currency, transaction_types: { C2C: { maximum_transaction_amount, minimum_transaction_amount } } } = payer_rates.data;

    let Min_Value = minimum_transaction_amount || 0;
    let Max_Value = maximum_transaction_amount || null;

    console.log({ Min_Value, Max_Value })

    const Thunes_Currency = "USD";
    const min_usd_value = 2; // Set minimum to 2 USD
    let converted_min_usd_to_from_currency = await convertCurrency("USD", walletDetails.currency.code, min_usd_value);
    console.log("converted_min_usd_to_from_currency", converted_min_usd_to_from_currency)

    // Determine the final minimum value based on Thunes or 2 USD
    let final_minimum_value;
    if (Min_Value) {
      let converted_thunes_min_value = await convertCurrency(destination_currency, walletDetails.currency.code, Min_Value);
      console.log("converted_thunes_min_value", converted_thunes_min_value, Min_Value)
      if (converted_min_usd_to_from_currency < converted_thunes_min_value) {
        final_minimum_value = converted_thunes_min_value;
      } else {
        final_minimum_value = converted_min_usd_to_from_currency;
      }
    } else {
      final_minimum_value = converted_min_usd_to_from_currency;
    }

    // if amount is below the minimum amount
    if (formatted_amount < formatDecimalNumbersWithLimit(final_minimum_value)) {
      return { status: 400, message: `Amount is less than the minimum value: ${formattedAmount(formatDecimalNumbersWithLimit(final_minimum_value))} ${walletDetails.currency.code}`, success: false, value: formatDecimalNumbersWithLimit(final_minimum_value), currency: walletDetails.currency.code };
    }

    // maximum amount work
    let daily_sending_limit_used = formatDecimalNumbersWithLimit(walletDetails.account.used_limits.daily_sending_limit) || 0;
    let monthly_sending_limit_used = formatDecimalNumbersWithLimit(walletDetails.account.used_limits.monthly_sending_limit) || 0;
    let yearly_sending_limit_used = formatDecimalNumbersWithLimit(walletDetails.account.used_limits.yearly_sending_limit) || 0;

    let daily_sending_limit = walletDetails.account.level.daily_sending_limit;
    let monthly_sending_limit = walletDetails.account.level.monthly_sending_limit;
    let yearly_sending_limit = walletDetails.account.level.yearly_sending_limit;

    let transaction_amount_limit = walletDetails.account.level.transaction_amount_limit;

    if (walletDetails.account?.is_external_limit) {
      daily_sending_limit = walletDetails.account.external_limits.daily_sending_limit;
      monthly_sending_limit = walletDetails.account.external_limits.monthly_sending_limit;
      yearly_sending_limit = walletDetails.account.external_limits.yearly_sending_limit;

      transaction_amount_limit = walletDetails.account.external_limits.transaction_amount_limit;
    }

    // RATE TO FIND THE LIMITS
    exchange_rate_in_usd = formatDecimalNumbersWithLimit(await convertCurrency('USD', walletDetails.currency.code, 1), 6)

    if (walletDetails.currency.code !== 'USD') {
      daily_sending_limit_used = exchange_rate_in_usd * daily_sending_limit_used;
      monthly_sending_limit_used = exchange_rate_in_usd * monthly_sending_limit_used;
      yearly_sending_limit_used = exchange_rate_in_usd * yearly_sending_limit_used;

      daily_sending_limit = exchange_rate_in_usd * daily_sending_limit;
      monthly_sending_limit = exchange_rate_in_usd * monthly_sending_limit;
      yearly_sending_limit = exchange_rate_in_usd * yearly_sending_limit;

      transaction_amount_limit = exchange_rate_in_usd * transaction_amount_limit;
    }

    max_thunes_value = Max_Value ? await convertCurrency(destination_currency, walletDetails.currency.code, Max_Value) : Max_Value

    // finding the maximum amount
    let minimum_sending_limit = Math.min(daily_sending_limit - daily_sending_limit_used, monthly_sending_limit - monthly_sending_limit_used, yearly_sending_limit - yearly_sending_limit_used);
    minimum_sending_limit = Math.min(minimum_sending_limit, transaction_amount_limit);
    minimum_sending_limit = Math.min(minimum_sending_limit, !max_thunes_value ? minimum_sending_limit : max_thunes_value)

    console.log({ minimum_sending_limit })

    // let max_value_in_sending_currency = formatDecimalNumbersWithLimit(await convertCurrency(Thunes_Currency, walletDetails.currency.code, minimum_sending_limit))

    // console.log({ max_value_in_sending_currency })

    if (formatted_amount > minimum_sending_limit) {
      return {
        status: 400,
        message: `Amount is greater than the maximum value: ${formattedAmount(formatDecimalNumbersWithLimit(minimum_sending_limit))} ${walletDetails.currency.code}`,
        success: false,
        value: formatDecimalNumbersWithLimit(minimum_sending_limit),
        currency: walletDetails.currency.code
      }
    }


    let feeExchange, feeToSendingRate

    if (fee_type === "flat") {
      console.log({ fee_currency, currency_code, flat_fee })
      const { rate, convertedAmount } = await getExchangeRate(fee_currency, currency_code, flat_fee)
      feeExchange = convertedAmount
      feeToSendingRate = rate
      console.log({ rate, convertedAmount })
    } else {
      feeExchange = formatted_amount * (percentage_fee / 100);

    }

    feeExchange = formatDecimalNumbersWithLimit(feeExchange);

    const quotationResult = await createQuotationHelper({
      external_id: external_id1,
      payer_id: payerId,
      mode: 'DESTINATION_AMOUNT',
      transaction_type,
      source: { amount: null, currency: 'USD', country_iso_code: 'USA' },
      destination: { amount: 1 > Min_Value ? 1 : Min_Value, currency: destination_currency },
    });
    console.log({ quotationResult, Max_Value })
    if (!quotationResult.status) {
      return { status: 500, message: quotationResult.data, success: false };
    }

    const { fee: { amount: fee_thunes }, wholesale_fx_rate: thunes_rate } = quotationResult.data;
    console.log({ quotationResult: quotationResult.data })
    const converted_thunes_fee_into_sending = formatDecimalNumbersWithLimit(await convertCurrency('USD', walletDetails.currency.code, fee_thunes), 2);

    console.log(walletDetails.currency.code, destination_currency, formatted_amount)

    const rates_sending_to_destination = await getExchangeRate(walletDetails.currency.code, destination_currency, formatted_amount);
    if (!rates_sending_to_destination) return { status: 400, message: "FX not found", success: false };

    const { rate, convertedAmount } = rates_sending_to_destination;

    let markupExchangeRate = formatDecimalNumbersWithLimit(rate, 6);
    if (walletDetails.currency.code !== destination_currency) {
      const percentageMarkup = formatDecimalNumbersWithLimit((percentage_markup / 100) * rate, 6);
      markupExchangeRate = formatDecimalNumbersWithLimit(rate - percentageMarkup, 6);
    }

    console.log({ markupExchangeRate, convertedAmount, rate, percentage_markup })

    let recipientAmount = formatDecimalNumbersWithLimit(convertedAmount * (markupExchangeRate / rate), 2);
    let totalFee = formatDecimalNumbersWithLimit(feeExchange + converted_thunes_fee_into_sending, 2);
    let topupFee;
    let totalAmount = formatDecimalNumbersWithLimit(formatted_amount + totalFee, 2);
    let paypalConverted, paypalRate, currencySupported;

    if (payment_method === "paypal") {
      const paypalFeeDetails = await getPaypalFeeHelper(walletDetails, formatted_amount, totalAmount);
      console.log({ paypalFeeDetails })
      topupFee = paypalFeeDetails.fee
      totalFee += topupFee;
      totalAmount += topupFee;
      paypalConverted = paypalFeeDetails.converted_amount;
      paypalRate = paypalFeeDetails.rate;
      currencySupported = paypalFeeDetails.currencySupported;
    } else if (payment_method === "card") {
      topupFee = await topUpFeeCalculation(walletDetails, totalAmount, 'topup_card_payment');
      console.log({ topupFee })
      totalFee += parseFloat(topupFee);
      totalAmount += parseFloat(topupFee);
    }

    console.log("after", totalAmount, topupFee, totalFee)

    // PORTAL CASES
    if (token && !chatbot) {

      let decoded;

      try {
        decoded = jwt.verify(token, secretKey);
      } catch (err) {
        console.log(err)
        return { status: 400, message: "Invalid token", success: false };
      }

      const { local_currency, preserved_amount } = decoded;
      // finding the thunes difference - Case 1 (Local = Wallet = Recipient)
      console.log(local_currency, walletDetails.currency.code, walletDetails.currency.code, destination_currency)
      if (local_currency === walletDetails.currency.code && walletDetails.currency.code === destination_currency) {

        console.log(`Case 1: ${local_currency} = ${walletDetails.currency.code} = ${destination_currency}`)

        const { feeMarkup, updatedTotalAmount } = await calculateThunesMarkup({
          totalAmount,
          destination_currency,
          thunes_rate
        });

        totalFee += feeMarkup;
        totalAmount = updatedTotalAmount;

      }

      // setting the preserved amount in the recipient and converting the preserved into sending value with markup
      // Case 2 (Wallet !== (Local = Recipient))
      else if (local_currency !== walletDetails.currency.code && local_currency === destination_currency) {

        console.log(`Case 2: ${local_currency} !== ${walletDetails.currency.code} = ${destination_currency}`)
        recipientAmount = preserved_amount;

        const ratesFromWalletToLocal = await getExchangeRate(walletDetails.currency.code, local_currency, 1)
        const { rate } = ratesFromWalletToLocal;
        const markupValue = (rate / 100) * percentage_markup
        const newMarkupRate = rate - markupValue
        var sendingUpdatedAmount = formatDecimalNumbersWithLimit(recipientAmount / newMarkupRate)

        console.log({ ratesFromWalletToLocal })

        totalAmount -= formatted_amount
        totalAmount += sendingUpdatedAmount

      }

      // setting the preserved amount in the receipient and finding the difference between preserved amount and sending amount
      // Case 3 ((Recipient = Wallet) !== Local)
      else if (local_currency !== walletDetails.currency.code && destination_currency === walletDetails.currency.code) {
        console.log(`Case 3: ${local_currency} !== ${walletDetails.currency.code} === ${destination_currency}`)

        recipientAmount = preserved_amount;
        const difference = Math.abs(formatted_amount - preserved_amount);

        console.log({ difference })

        totalFee += difference;
        totalAmount += difference;
      }

      // Case 4 ((Local = Wallet) !== Recipient) ignore
      else if (local_currency === walletDetails.currency.code && walletDetails.currency.code !== destination_currency) {
        console.log(`Case 4: ${local_currency} === ${walletDetails.currency.code} !== ${destination_currency}`)
      }
      // Case 5 (Local !=== Recipient !== Wallet) ignore
      else if ((local_currency !== walletDetails.currency.code && destination_currency !== walletDetails.currency.code)) {
        console.log(`Case 5: ${local_currency} !== ${walletDetails.currency.code} !== ${destination_currency}`)
      }
      // Case 6 with else
      // preserved_amount will be set in the recipient and we will convert preserved_amount into sending value with markup
      else {
        console.log(`Case 6: local: ${local_currency}, wallet: ${walletDetails.currency.code}, recipient: ${destination_currency}`)
        recipientAmount = preserved_amount;

        const { feeMarkup, updatedTotalAmount } = await calculateThunesMarkup({
          totalAmount,
          destination_currency,
          thunes_rate
        });

        totalFee += feeMarkup;
        totalAmount = updatedTotalAmount;

      }

      console.log(!chatbot, local_currency, walletDetails.currency.code, destination_currency, sendingUpdatedAmount)

    }
    // else if (!chatbot && payment_method === "paypal" || payment_method === "card") {

    //   if (walletDetails.currency.code === destination_currency) {

    //     const { feeMarkup, updatedTotalAmount } = await calculateThunesMarkup({
    //       formatted_amount,
    //       destination_currency,
    //       thunes_rate
    //     });

    //     totalFee += feeMarkup;
    //     totalAmount = updatedTotalAmount;
    //   }
    // }

    // CHATBOT CASES
    if (chatbot && walletDetails.currency.code === destination_currency) {
      // Case - 1: if wallet = local = recipient
      console.log(`Chatbot Case 1: ${walletDetails.currency.code}  = ${destination_currency}`)

      const { feeMarkup, updatedTotalAmount } = await calculateThunesMarkup({
        totalAmount,
        destination_currency,
        thunes_rate
      });

      totalFee += feeMarkup;
      totalAmount = updatedTotalAmount;

    }

    // minimum and maximum validation
    if (Min_Value) {
      if (recipientAmount < Min_Value) {
        return {
          status: 400,
          message: `Recipient amount is less than minimum value of ${Min_Value} ${destination_currency}`,
          success: false
        }
      }
    }

    if (Max_Value) {
      if (recipientAmount > Max_Value) {
        return {
          status: 400,
          message: `Recipient amount is greater than maximum value of ${Max_Value} ${destination_currency}`,
          success: false
        }
      }
    }

    const external_id2 = shortid.generate();

    // creating the quotation so we can find the source amount, and make sure the sending amount from thunes does not exceed the sending amount from user
    const quotationResult2 = await createQuotationHelper({
      external_id: external_id2,
      payer_id: payerId,
      mode: 'DESTINATION_AMOUNT',
      transaction_type,
      source: { amount: null, currency: 'USD', country_iso_code: 'USA' },
      destination: { amount: setAmountBasedOnPrecision(recipientAmount, payer_rates.data.precision), currency: destination_currency },
    });
    console.log({ sourceAmount: quotationResult2.data.source })
    if (!quotationResult2.status) {
      return { status: 500, message: quotationResult2.data, success: false };
    }

    const usdToSendingRate = await convertCurrency('USD', walletDetails.currency.code, 1);
    const convertedSourceAmountIntoSending = formatDecimalNumbersWithLimit(quotationResult2.data.source.amount * usdToSendingRate, 2);

    console.log({ convertedSourceAmountIntoSending, usdToSendingRate })

    // if thunes amount is greater than total amount, we will update the fee and total manually after calculating the difference between those amount
    const comparisonSendingValue = sendingUpdatedAmount || formatted_amount
    if (convertedSourceAmountIntoSending > comparisonSendingValue) {
      console.log({ convertedSourceAmountIntoSending, comparisonSendingValue, totalAmount })

      const difference = convertedSourceAmountIntoSending - comparisonSendingValue;
      totalFee += difference;
      totalAmount += difference;

      console.log({ difference, totalAmount })
    }


    // limit check
    const total_converted_in_system_currency = formatDecimalNumbersWithLimit(await convertCurrency(currency_code, 'USD', totalAmount), 2);

    const limitCheck1 = limitCheck(total_converted_in_system_currency, accountLevel, walletDetails.account, 'sending');
    if (!limitCheck1.status) return { status: 400, message: limitCheck1.code, success: false };

    const result = {
      exchanged_rate: { value: formatDecimalNumbersWithLimit(markupExchangeRate, 6), currency: destination_currency },
      fee: { value: formatDecimalNumbersWithLimit(totalFee), currency: currency_code },
      recipient: { value: formatDecimalNumbersWithLimit(recipientAmount), currency: destination_currency },
      total: { value: formatDecimalNumbersWithLimit(totalAmount), currency: currency_code },
      sending: { value: sendingUpdatedAmount || formatted_amount, currency: currency_code },
      ...(payment_method === "paypal") && {
        paypal: {
          paypal_converted: { value: paypalConverted || null, currency: "USD" },
          paypal_rate: { value: paypalRate || null, currency: "USD" },
          paypal_currency_supported: currencySupported,
          fee: { value: topupFee || null, currency: currency_code },

        },
      },
      min_amount: Min_Value,
    };

    const payload = {
      result,
      extras: {
        markup_value: percentage_markup,
        fee_type,
        thunes_fee: fee_thunes,
        original_exchange_rate: rate,
        exchange_rate_with_markup: markupExchangeRate,
        precision: payer_rates.data.precision,
        feeToSendingRate,
        thunes_rate
      }
    };

    const newToken = jwt.sign(payload, secretKey, { expiresIn: '1h' });

    return { status: 200, data: { result, token: newToken }, success: true };

  } catch (err) {
    console.error(err);
    return { status: 500, message: err.message || "Something went wrong while getting exchange rates", success: false };
  }
}

async function getPaypalFeeHelper(wallet, amount, totalAmount) {
  try {
    let feeDetails = await topUpFeeCalculation(wallet, amount, 'topup_paypal');

    const finalAmount = formatDecimalNumbersWithLimit(totalAmount + parseFloat(feeDetails), 2);

    let amountInUSD = amount;
    let rate = 1;
    let currencySupported = true;

    if (!supportedCurrencies.includes(wallet.currency.code)) {
      currencySupported = false;
      amountInUSD = await convertCurrency(wallet.currency.code, "USD", finalAmount);
      rate = formatDecimalNumbersWithLimit(await convertCurrency(wallet.currency.code, "USD", 1));
    }

    return {
      fee: parseFloat(feeDetails),
      original_amount: amount,
      converted_amount: amountInUSD,
      rate,
      original_currency: wallet.currency.code,
      currencySupported
    };

  } catch (error) {
    throw new Error(error.message || 'Failed to calculate PayPal fee');
  }
}


exports.getIntlFX = async (req, res) => {

  // const data = req.body
  const data = await decryption(req.body.data);
  const payerId = parseInt(req.params.payerId);

  data.payerId = payerId;
  const result = await getIntlFXHelper(data);

  if (!result.success) {
    return res.status(result.status).send(await encryption({ message: result.message, status: false }));
  }

  const ciphertext = await encryption(result);

  return res.status(result.status).send(ciphertext);
}

exports.getWithdrawalFX = async (req, res) => {

  // const data = req.body
  const data = await decryption(req.body.data);
  const payerId = parseInt(req.params.payerId);

  data.payerId = payerId;
  const result = await getWithdrawalFXHelper(data);

  if (!result.success) {
    const responsePayload = {
      message: result.message,
      status: false
    };
    if (result.value !== undefined) {
      responsePayload.value = result.value;
    }
    return res.status(result.status).send(await encryption(responsePayload));
  }

  const ciphertext = await encryption(result);

  return res.status(result.status).send(ciphertext);
}

async function createQuotationNewHelper({ token, payerId, transaction_type, wallet_id, payment_method }) {
  try {

    let decoded
    jwt.verify(token, secretKey, async function (err, payload) {
      if (err) {
        console.log(err)
        return {
          status: false,
          message: "Invalid Token"
        };
      } else {
        decoded = payload
      }
    })
    // const decoded = await new Promise((resolve, reject) => {
    //   jwt.verify(token, secretKey, (err, data) => {
    //     if (err) {
    //       console.log(err)
    //       reject({ status: false, message: err.message || "Invalid Token or Token Expired" });
    //     } else {
    //       resolve(data);
    //     }
    //   });
    // });

    const { result, extras } = decoded;

    // Check wallet balance if user is paying with Instapay wallet
    const walletDetails = await Wallet.findById(wallet_id).populate([{ path: 'account', populate: { path: 'level' } }]);
    if (payment_method === "wallet") {
      if (result.total.value > walletDetails.balance.available) {
        return {
          status: false,
          message: "Insufficient balance"
        };
      }
    }

    // limit check
    const total_converted_in_system_currency = await convertCurrency(walletDetails.currency.code, 'USD', result.total.value);
    const limitCheck1 = limitCheck(total_converted_in_system_currency, walletDetails.account.level, walletDetails.account, 'sending');
    if (!limitCheck1.status) {
      return {
        status: false,
        message: limitCheck1.code
      };
    }

    // Create quotation
    const external_id = shortid.generate();
    const mode = 'DESTINATION_AMOUNT';
    const Thunes_Currency = 'USD';
    const Thunes_Country = 'USA';
    const requestData = {
      external_id,
      payer_id: payerId,
      mode,
      transaction_type: transaction_type,
      source: {
        amount: null,
        currency: Thunes_Currency,
        country_iso_code: Thunes_Country
      },
      destination: {
        amount: setAmountBasedOnPrecision(result.recipient.value, extras.precision),
        currency: result.recipient.currency
      },
    };

    console.log({ requestData })

    const quotationResult = await createQuotationHelper(requestData);

    console.log(quotationResult, "quotationResult")

    if (quotationResult.status) {
      const payload = {
        result,
        extras
      };
      const updatedToken = jwt.sign(payload, secretKey, { expiresIn: '1h' });
      return {
        status: true,
        message: "Quotation created successfully",
        QuotationID: external_id,
        token: updatedToken
      };
    } else {
      return {
        status: false,
        message: "Something went wrong creating a quotation"
      };
    }

  } catch (err) {
    console.error(err);
    return {
      status: false,
      message: "Internal server error"
    };
  }
}

exports.createQuotationNew1 = async (req, res) => {
  try {
    const data = await decryption(req.body.data);
    // const data = req.body
    const { token, payerId, transaction_type, wallet_id, payment_method } = data;

    const response = await createQuotationNewHelper({
      token,
      payerId,
      transaction_type,
      wallet_id,
      payment_method,
    });

    console.log(response, "response")

    if (response.status) {
      const data = await encryption(response);
      return res.status(200).send(data);
    } else {
      const error = await encryption(response);
      return res.status(400).send(error);
    }

  } catch (err) {
    console.log(err);
    const error = await encryption({
      status: false,
      message: "Internal server error"
    });
    res.status(500).send(error);
  }
};


const extractRequiredFields = (data, transactionType) => {
  const mergedFields = {
    required_receiving_entity_fields: new Set(),
    required_sending_entity_fields: new Set(),
    credit_party_identifiers_accepted: new Set(),
    credit_party_information: new Set(),
    credit_party_verification: new Set()
  };

  data.forEach(item => {
    const transactionData = item.transaction_types[transactionType];
    if (!transactionData) return;

    const {
      required_receiving_entity_fields,
      required_sending_entity_fields,
      credit_party_identifiers_accepted,
      credit_party_information,
      credit_party_verification
    } = transactionData;

    required_receiving_entity_fields.forEach(fields => fields.forEach(field => mergedFields.required_receiving_entity_fields.add(field)));
    required_sending_entity_fields.forEach(fields => fields.forEach(field => mergedFields.required_sending_entity_fields.add(field)));
    credit_party_identifiers_accepted.forEach(fields => fields.forEach(field => mergedFields.credit_party_identifiers_accepted.add(field)));
    credit_party_information.credit_party_identifiers_accepted.forEach(fields => fields.forEach(field => mergedFields.credit_party_information.add(field)));
    credit_party_verification.credit_party_identifiers_accepted.forEach(fields => fields.forEach(field => mergedFields.credit_party_verification.add(field)));
  });

  return {
    required_receiving_entity_fields: Array.from(mergedFields.required_receiving_entity_fields),
    required_sending_entity_fields: Array.from(mergedFields.required_sending_entity_fields),
    credit_party_identifiers_accepted: Array.from(mergedFields.credit_party_identifiers_accepted),
    credit_party_information: Array.from(mergedFields.credit_party_information),
    credit_party_verification: Array.from(mergedFields.credit_party_verification)
  };
};

async function fetchCashPickupLocations(payerId) {
  try {
    const config = { headers: { 'Authorization': authHeaders } };
    const url = `${process.env.THUNES_PROD_URL}/v2/money-transfer/payers/${payerId}/pickup_locations`;

    const response = await axios.get(url, config);

    console.log(response.data, "payer_rates.data");
    return response.data;
  } catch (error) {
    console.error("Error fetching payer rates:", error);
    throw error;
  }
}

exports.getPayerRatesInfo = async (req, res) => {
  try {
    const { payerId } = req.query;

    if (!payerId) {
      const error = await encryption({
        status: false,
        message: "payerId is required",
      });
      return res.status(400).send(error);
    }

    const config = { headers: { 'Authorization': authHeaders } };
    const payer_rates = await axios.get(`${process.env.THUNES_PROD_URL}/v2/money-transfer/payers/${payerId}`, config);

    const {
      currency: destination_currency,
      transaction_types: {
        C2C: {
          maximum_transaction_amount,
          minimum_transaction_amount,
          required_receiving_entity_fields
        }
      },
      country_iso_code
    } = payer_rates.data;

    const data = {
      destination_currency,
      maximum_transaction_amount,
      minimum_transaction_amount,
      country_iso_code,
      payer_required_fields: required_receiving_entity_fields
    };

    const encryptedResponse = await encryption({
      status: true,
      message: "Payer details retrieved successfully",
      data
    });

    res.status(200).send(encryptedResponse);

  } catch (error) {
    console.error('Error fetching payer rates:', error?.response?.data?.errors ?? error);

    const encryptedError = await encryption({
      status: false,
      message: "Internal server error!",
    });
    return res.status(500).send(encryptedError);
  }
};

exports.getRequiredFieldsByCountry = async (req, res) => {
  try {
    const { country_iso_code, service_id, transaction_type } = req.params

    const API_URL = `${sandboxUrl}/v2/money-transfer/payers?country_iso_code=${country_iso_code}&service_id=${service_id}`;

    const config = {
      headers: {
        'Authorization': authHeaders,
        'Content-Type': 'application/json'
      }
    };

    const response = await axios.get(API_URL, config);

    const filteredData = extractRequiredFields(response.data, transaction_type);

    const ciphertext = await encryption({
      status: true,
      message: "Country's Required fields",
      data: filteredData
    })

    return res.status(200).send(ciphertext)

  } catch (err) {
    console.log(err)
    const error = await encryption({
      status: false,
      message: "Internal Server Error"
    })
    res.status(500).send(error)
  }
}

module.exports.commissionCalculator = commissionCalculator
module.exports.getIntlFXHelper = getIntlFXHelper
module.exports.createQuotationNewHelper = createQuotationNewHelper
module.exports.getWithdrawalFXHelper = getWithdrawalFXHelper