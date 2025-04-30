require("dotenv").config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const shortid = require('shortid');
const { encryption, decryption } = require('../configurations/Encryption');
const Country = require("../models/Country.model");
const PayoutChannels = require("../models/PayoutChannels");
const Wallet = require("../models/Wallet.model");
const Fee = require("../models/Fee.model");
const moment = require('moment');

// const Thunes_KEY = process.env.APIKEY;
// const Thunes_SECRET = process.env.APISECRET;
const Thunes_KEY = process.env.API_KEY_PROD;
const Thunes_SECRET = process.env.API_SECRET_PROD;
const secretKey = process.env.jwtKey;

const whitelevelHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJuakFJWGpBcjZtQmpKek9zbDBsVnhUb05GRVlhUzlLRVdid0NscUJaZFcwIn0.eyJleHAiOjE3MDYwNTY4MzksImlhdCI6MTcwNjAyMDgzOSwianRpIjoiYzhjNjUyZjMtMGRmMC00NzhhLTkzMTktNDM3Yjg2OTIxOTNmIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLmRldi53aGl0ZWxldmVsLmV1L2F1dGgvcmVhbG1zL3ZvdWNoIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6IjkxMGE1NzI4LWFiZDctNDA0Ni04NTBkLWNlNGM2NjI5YjVlNiIsInR5cCI6IkJlYXJlciIsImF6cCI6InZvdWNoX2NsaWVudCIsInNlc3Npb25fc3RhdGUiOiJhYWJiMGZhMi04MDQ5LTQyNTgtOWNjMS1hM2MxYTgzODM2ZjMiLCJhY3IiOiIxIiwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbImRlZmF1bHQtcm9sZXMtdm91Y2giLCJvZmZsaW5lX2FjY2VzcyIsInVtYV9hdXRob3JpemF0aW9uIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsiYWNjb3VudCI6eyJyb2xlcyI6WyJtYW5hZ2UtYWNjb3VudCIsIm1hbmFnZS1hY2NvdW50LWxpbmtzIiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiJlbWFpbCBwcm9maWxlIiwic2lkIjoiYWFiYjBmYTItODA0OS00MjU4LTljYzEtYTNjMWE4MzgzNmYzIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5hbWUiOiJSb21hbiBQZW5keWtob3YiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJyb21hbiIsImdpdmVuX25hbWUiOiJSb21hbiIsImZhbWlseV9uYW1lIjoiUGVuZHlraG92IiwiZW1haWwiOiJyb21hY2pAbWFpbC5ydSJ9.jghhGOtGNXQowSElM-Ie0n2KWA5C8lJv4nIpB1MVN4ZJ6-uCX6RFrTgrNaCXZwDby8-CyWjSt4vytVwIz7Yo-592qre2FLAT530J4B75vJ89oZxpFdjjUNOSNFoPCXm5YQdu8Dxjc3v-0MWbl2IgnvZle6yP-1CFmTQetLjAF3NrB5lua_krISvK0BXaH3grDIuwbkM7vJssSiv7ONMTqzVNRK9HZo4r7sGZziowYgtRk6GNoR4ZNA3EpLX0JLmw1qZYhwWf4dJfT1xr32WX8VwspDnsLD1XxPZbsYbCz0Q3h7bNzy82CytcJny1mrUc01Efxk34SThVzselJwr-9A',
};

const getWhitelevelCountries = async () => {
    const url = `${process.env.WHITE_LEVEL_URL}/country/list`;
    const body = {
        "limit": 226,
        "offset": 0,
        "filterGroups": [],
        "sortBy": "",
        "orderBy": "ASC"
    };

    const response = await axios.post(url, body, {
        headers: whitelevelHeaders
    });

    return response.data;
};

const getWhitelevelServices = async () => {
    const url = `${process.env.WHITE_LEVEL_URL}/payout-format/list`;


    const response = await axios.get(url, {
        headers: whitelevelHeaders
    });

    return response.data;
};

const getThunesCountries = async () => {
    const API_URL = `${process.env.THUNES_URL}/money-transfer/countries`;
    const perPage = 100;

    const config = {
        headers: {
            'Authorization': `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`,
        },
        params: {
            per_page: perPage,
        },
    };

    const response = await axios.get(API_URL, config);
    return response.data;
};

const getThunesServices = async (requestedCountry) => {
    const API_URL = `${process.env.THUNES_URL}/money-transfer/services`;
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
    // console.log(response.data)
    return response.data;
};

module.exports.getAllCountries = async (req, res) => {
    try {
        const whitelevelCountries = await getWhitelevelCountries();
        const thunesCountries = await getThunesCountries();
        const systemCountries = await Country.find();

        const systemCountryData = systemCountries.map(country => {
            return {
                country_name: country.country_name,
                country_iso_code: country.country_iso_code,
            };
        });

        const filteredCountries = systemCountries.filter(systemCountry => {
            const isInWhitelevel = whitelevelCountries?.items?.some(whitelevelCountry =>
                whitelevelCountry.a3Code === systemCountry.country_iso_code
            );
            const isInThunes = thunesCountries?.some(thunesCountry =>
                thunesCountry.iso_code === systemCountry.country_iso_code
            );

            return isInWhitelevel || isInThunes;
        });

        let ciphertext = await encryption({
            status: true,
            message: "Countries found!",
            countries: filteredCountries
        });

        res.status(200).send(ciphertext);

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!",
        });
        res.status(500).send(error);
    }
};

const getPayerInfo = async (data) => {
    try {
        const requestedService = data.service_id;
        const requestedCountry = data.iso_code;

        // there are no results for more than 100 payers in the API for any country & service code so have not used any logic to check beyond page 1
        const API_URL = `${process.env.THUNES_PROD_URL}/v2/money-transfer/payers`;
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

        console.log(requestedCountry, requestedService)

        const response = await axios.get(API_URL, config);
        console.log(response.data, "response")
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

        return transformedServices;

    } catch (error) {
        console.error('Error fetching payers:', error);
    }
};

// a function which uses the api which gives the covnersion rate
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

const calculatePayerRatesLogic = async (payerId, walletId, transactionType, amount) => {

    const wallet = await Wallet.findOne({ _id: walletId }).populate('account');
    const wallet_currency = wallet.currency.code //'EUR'
    const balance = wallet.balance.available;
    const fees = await Fee.findOne({ account_level: wallet.account.level._id }).populate('account_level');
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

    const API_URL = `${process.env.THUNES_PROD_URL}/v2/money-transfer/payers/${payerId}/rates`;

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
        thunes_exchange_rate: roundedExchangeRate,
        exchange_rate: roundedExchangeRateWithMarkup,
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

    return {
        success: true,
        Supported_Transaction_Types: keys,
        api_response: api_response
    };
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
module.exports.getAllServices = async (req, res) => {
    try {
        const { country_iso_code } = req.params;
        if (!country_iso_code) {
            let error = await encryption({
                status: false,
                message: "required fields are empty."
            });
            return res.status(400).send(error);
        }

        const whitelevelServices = [
            { id: 1, name: "Cash" },
            { id: 2, name: "Account" },
            { id: 3, name: "Card" },
            { id: 4, name: "Cash Pickup" },
            { id: 5, name: "Bank Deposit" },
            { id: 6, name: "PIX Payment" },
            { id: 7, name: "Cash Collection" },
            { id: 8, name: "Card Transfer" },
            { id: 9, name: "Mobile Transfer" }
        ];
        // const whitelevelServices = await getWhitelevelServices();
        const thunesServices = await getThunesServices(country_iso_code);
        const country = await Country.find({ country_iso_code });

        const serviceAliases = {
            "BankAccount": "Bank Deposit",
            "MobileWallet": "Mobile Transfer"
        };

        const servicesMap = {};

        const addToMap = (service, source) => {
            for (const item of service) {
                const serviceName = serviceAliases[item.name] || item.name;
                if (!(serviceName in servicesMap)) {
                    servicesMap[serviceName] = { ...item, source };
                }
            }
        };

        addToMap(whitelevelServices, 'whitelevel');
        addToMap(thunesServices, 'thunes');

        const combinedServices = Object.values(servicesMap);

        // console.log(whitelevelServices)
        // console.log(thunesServices)

        let ciphertext = await encryption({
            status: true,
            message: "Services found!",
            // country,
            // whitelevel: whitelevelServices,
            // thunes: thunesServices,
            combinedServices
        });

        res.status(200).send(ciphertext);

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!",
        });
        res.status(500).send(error);
    }
}

module.exports.getChannels = async (req, res) => {
    try {
        const { service_id, iso_code } = req.params
        console.log(service_id)
        if (!service_id) {
            let error = await encryption({
                status: false,
                message: "required fields are empty."
            });
            return res.status(400).send(error);
        }

        const payoutChannel = await PayoutChannels.findOne({ id: service_id });
        const country = await Country.findOne({ country_iso_code: iso_code });
        console.log(payoutChannel?.name, "payoutChannel.name")
        console.log(country[payoutChannel.name], "payoutChannel.name")
        // checking priority
        let payerInfoThunes;
        if (country[payoutChannel.name].thunes < country[payoutChannel.name].swiss_remit) {
            payerInfoThunes = await getPayerInfo({ iso_code, service_id });
            console.log(payerInfoThunes, "payerInfoThunes")
        } else {
            console.log("thunes")
        }

        // console.log(country)

        let ciphertext = await encryption({
            status: true,
            message: "Channels found!",
            channels: payerInfoThunes ?? [],
        });

        res.status(200).send(ciphertext);

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!",
        });
        res.status(500).send(error);
    }
}

module.exports.getThunesRates = async (req, res) => {
    try {
        const requestbody = req.body.data;
        const data = requestbody //await decryption(requestbody);
        let payerId = parseInt(req.params.payer_id);
        const wallet_id = data.wallet_id;
        const transaction_type = data.transaction_type;
        const amount = data.amount;

        const result = await calculatePayerRatesLogic(payerId, wallet_id, transaction_type, amount);
        if (result.success) {

            const payload = {
                result: result.api_response
            };

            const options = {
                expiresIn: '1h',
            };         // not expiring the token right now

            const token = jwt.sign(payload, secretKey);

            const encryptedRates = await encryption({ result: result.api_response, token: token, Supported_Transaction_Types: result.Supported_Transaction_Types });
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

exports.createQuotation = async (req, res) => {
    try {
        const external_id1 = shortid.generate()
        const API_URL = `${process.env.THUNES_PROD_URL}/v2/money-transfer/quotations`;
        const Thunes_Currency = 'USD'  // AS WE ONLY HAVE USD FOR NOW SO HARDCODING IT 
        const Thunes_Country = 'USA'  // AS WE ONLY HAVE USD FOR NOW SO HARDCODING IT, YOU CAN CHANGE IT TO ANY COUNTRY

        // const decryptedData = req.body;
        const requestedData = req.body.data;
        const decryptedData = req.body//await decryption(requestedData);
        const {
            wallet_id,
            payer_id,
            transaction_type,
            amount,
            token
            // destination: { currency: destinationCurrency }
        } = decryptedData;

        const decodedToken = jwt.verify(token, secretKey);

        const result = await calculatePayerRatesLogic(payer_id, wallet_id, transaction_type, amount);
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

            const difference = findDifferences(decodedToken.result, result.api_response);

            if (difference === "difference") {
                const output = await encryption('There has been a change in the exchagne rate');
                res.status(400).json(output);
            }

            if (difference === "fees changed") {
                const output = await encryption('Fees has been updaated.');
                res.status(400).json(output);

            }
            if (difference === "no changes") {

                // THE REQUEST DATA WE SENDING ,  IT HAS AMOUNT IN DESTINATION, WHICH CANT BE EMPTY AND IS SET TO NULL(PUTTING A VALUE IN IT DOESNT DO ANYTHING)
                const requestData = {
                    external_id: external_id1,
                    payer_id: payer_id,
                    mode: mode,
                    transaction_type: transaction_type,
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

                // console.log(getBalance, "getBalance")
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
        console.error('Error creating quotation:', error.response.data);
        const encryptedError = await encryption('An error occurred while creating the quotation');
        res.status(500).send(encryptedError);
        //  }
    }
};