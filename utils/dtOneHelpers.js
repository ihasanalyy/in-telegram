const axios = require("axios");
const Wallet = require("../models/Wallet.model");
const moment = require('moment-timezone');
const { limitCheck, convertCurrency, getPaypalFeeHelper, featureCheck, balanceLimitCheck, getExchangeRatesToUSD, logError } = require("./helpers");
const FeeModel = require("../models/Fee.model");
const { updateUsedLimits, topUpFeeCalculation } = require("./conversion");
const Transaction = require("../models/Transaction.model");
const jwt = require('jsonwebtoken');
const { formatDecimalNumbersWithLimit } = require("./payerRates");
const paypalUrl = process.env.PAYPAL_URL
const Account = require("../models/Account.model");
const iso2Countries = require("../utils/countries_iso2.json");
const ESimModel = require("../models/E-Sim.model");

// this is for production 
const username = process.env.user; //'5f48f059-efc6-435f-8a2c-28aa15846c96' //process.env.user;
const password = process.env.password; //'ce6e3b99-4211-45a7-9226-1b0fcf51fed0' 
const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const secretKey = process.env.jwtKey;

exports.confirmtransactionAirtime = async (data) => {
    try {
        let decoded = data

        console.log(decoded, "decoded")

        const confirmTransactionForAirtime = async (transactionId) => {
            const apiUrl = `https://dvs-api.dtone.com/v1/async/transactions/${transactionId}/confirm`;

            try {
                const response = await axios.post(apiUrl, null, {
                    headers: {
                        'Authorization': authHeader,
                    },
                });

                return response.data;
            } catch (error) {
                if (axios.isAxiosError(error)) {
                    console.error('AxiosError:', error);
                    // Handle the error in a way that provides useful information to troubleshoot the issue.
                    // You can also inspect error.response for more details.
                    throw error; // Rethrow the error if needed
                } else {
                    console.error('Other error:', error);
                    // Handle other types of errors.
                    throw error; // Rethrow the error if needed
                }
            }
        };

        const confirmTransaction = async (transactionId) => {
            const apiUrl = `https://dvs-api.dtone.com/v1/async/transactions/${transactionId}/confirm`;

            try {
                const response = await axios.post(apiUrl, null, {
                    headers: {
                        'Authorization': authHeader,
                    },
                });

                return response.data;
            } catch (error) {
                if (axios.isAxiosError(error)) {
                    console.error('AxiosError:', error);
                    // Handle the error in a way that provides useful information to troubleshoot the issue.
                    // You can also inspect error.response for more details.
                    throw error; // Rethrow the error if needed
                } else {
                    console.error('Other error:', error);
                    // Handle other types of errors.
                    throw error; // Rethrow the error if needed
                }
            }
        };

        const Sub_Service_id = decoded.Sub_Service_id
        const Transaction_ID = decoded.Transaction_ID
        console.log(Transaction_ID)
        const wallet_id = decoded.Wallet_Id
        const wallet = await Wallet.findOne({ _id: wallet_id }).populate([{ path: 'account', populate: [{ path: 'level' }] }])
        if (!wallet) {
            return { status: false, message: 'Wallet not found' }
        }

        let currency = wallet.currency.code

        const balance = wallet.balance.available
        const accountLevelId = wallet.account.level._id
        const fees = await FeeModel.findOne({ $and: [{ service_name: "airtime" }, { account_level: wallet.account.level._id }] }).populate('account_level');


        if (Sub_Service_id == 11) {


            const fee = decoded.extractedDataWithAdjustedValues[0].fee        // the fee we keeping 
            const total = decoded.extractedDataWithAdjustedValues[0].total    // the total amount  

            const convertedTotal = await convertCurrency(currency, 'USD', total)

            console.log(convertedTotal, "converted total", total)

            let limitCheck1 = limitCheck(convertedTotal, wallet.account.level, wallet.account, 'sending');
            if (!limitCheck1.status) {
                return { status: false, message: limitCheck1.code }
            }

            // if the total amount is more than the balance then this will be returned 
            if (total > balance) {
                return { status: false, message: `Insufficient Balance, you current balance in this wallet is ${balance}` }

            }

            const response = await confirmTransactionForAirtime(Transaction_ID);

            console.log(decoded, "decoded")

            if (response.status.message === "CONFIRMED") {

                const newAvailableBalance = wallet.balance.available - total;
                wallet.balance.available = newAvailableBalance;
                await wallet.save();

                // updating the limits used
                let USDTotal;
                if (wallet.currency.code !== 'USD') {
                    USDTotal = await convertCurrency(wallet.currency.code, 'USD', total);
                } else {
                    USDTotal = total
                }
                await updateUsedLimits(wallet.account, null, USDTotal, null);

                const senderTimezone = wallet.account?.timezone || "UTC"

                const senderCurrentTime = moment().tz(senderTimezone).format();

                let senderTransactionObj = {
                    reference_id: `tr_${Transaction_ID}`,
                    type: 'instant',
                    transaction_type: 'debit',
                    service_type: 'airtime',
                    payment_type: "airtime",
                    status: 'INITIATED',
                    purpose: "",
                    description: "",
                    airtime_number: decryptedData.number,
                    currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
                    amount: total,
                    fee: decoded.extractedDataWithAdjustedValues[0].fee,
                    fee_type: decoded.extractedDataWithAdjustedValues[0].fee_type,
                    markup: decoded.extractedDataWithAdjustedValues[0].markup,
                    markup_currency: decoded.extractedDataWithAdjustedValues[0].markup_currency,
                    exchange_rate: decoded.extractedDataWithAdjustedValues[0].fee_exchangerate,
                    exchange_rate_markup: decoded.extractedDataWithAdjustedValues[0].fee_exchangerate - decoded.extractedDataWithAdjustedValues[0].markup,
                    total: total,
                    wallet_id: wallet.wallet_id,
                    wallet: wallet._id,
                    account: wallet.account._id,
                    sender: wallet.account._id,
                    receiver: null,
                    current_balance: wallet.balance.available,
                    timeline: [
                        {
                            status: 'INITIATED',
                            date: senderCurrentTime,
                        }
                    ]
                };

                const newTransaction = new Transaction(senderTransactionObj);

                await newTransaction.save()

                return { status: true, message: "Transaction Successful", }
            }
            else {
                return { status: false, message: "Transaction Failed", }


            }

        }

        if (Sub_Service_id != 11) {

            // const DT_ONE_FEE = responseData.prices.wholesale.fee
            // let convertedDTOneFee
            // const source = responseData.source
            // const DT_ONE_Currency = source.unit;
            // if (DT_ONE_FEE <= 0) {
            //     convertedDTOneFee = 0
            // } else {
            //     convertedDTOneFee = await convertCurrency(DT_ONE_Currency, currency, DT_ONE_FEE)
            // }

            const fee = decoded.filteredDataWithCurrency[0].fee        // the fee we keeping 
            const total = decoded.filteredDataWithCurrency[0].total    // the total amount  

            const convertedTotal = await convertCurrency(currency, 'USD', total)

            console.log(convertedTotal, "converted total", total, decoded)

            let limitCheck1 = limitCheck(convertedTotal, wallet.account.level, wallet.account, 'sending');
            if (!limitCheck1.status) {
                return { status: false, message: limitCheck1.code }
            }

            // if the total amount is more than the balance then this will be returned 
            if (total > balance) {
                return { status: false, message: `Insufficient Balance, you current balance in this wallet is ${balance}` };

            }

            const response = await confirmTransaction(Transaction_ID);

            if (response.status.message === "CONFIRMED") {
                const newAvailableBalance = wallet.balance.available - total;
                wallet.balance.available = newAvailableBalance;
                await wallet.save();

                // updating the limits used
                let USDTotal;
                if (wallet.currency.code !== 'USD') {
                    USDTotal = await convertCurrency(wallet.currency.code, 'USD', total);
                } else {
                    USDTotal = total
                }
                await updateUsedLimits(wallet.account, null, USDTotal, null);

                const senderTimezone = wallet.account?.timezone || "UTC"

                const senderCurrentTime = moment().tz(senderTimezone).format();

                let senderTransactionObj = {
                    reference_id: `tr_${Transaction_ID}`,
                    type: 'instant',
                    transaction_type: 'debit',
                    service_type: 'airtime',
                    payment_type: "airtime",
                    status: 'INITIATED',
                    purpose: "",
                    airtime_number: decryptedData.number,
                    description: `${decoded.filteredDataWithCurrency[0].name} - ${decoded.filteredDataWithCurrency[0].description}`,
                    currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
                    amount: total,
                    fee: decoded.filteredDataWithCurrency[0].fee,
                    fee_type: decoded.filteredDataWithCurrency[0].fee_type,
                    markup: decoded.filteredDataWithCurrency[0].markup,
                    markup_currency: decoded.filteredDataWithCurrency[0].markup_currency,
                    exchange_rate: decoded.filteredDataWithCurrency[0].fee_exchangerate,
                    exchange_rate_markup: decoded.filteredDataWithCurrency[0].fee_exchangerate - decoded.filteredDataWithCurrency[0].markup,
                    total: total,
                    wallet_id: wallet.wallet_id,
                    wallet: wallet._id,
                    account: wallet.account._id,
                    sender: wallet.account._id,
                    receiver: null,
                    current_balance: wallet.balance.available,
                    timeline: [
                        {
                            status: 'INITIATED',
                            date: senderCurrentTime,
                        }
                    ]
                };

                const newTransaction = new Transaction(senderTransactionObj);

                await newTransaction.save()

                return { status: true, message: "Transaction Successful", }
            }
            else {
                return { status: false, message: "Transaction Failed", }

            }
        }

    } catch (error) {
        console.error('Error getting status:', error);

        //returns the error which we get from DTone
        if (error.response && error.response.data && error.response.data.errors) {
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');

            return { status: false, message: errorMessages };
        } else {
            // returns error if there is a problem on our end and not the service
            return { status: false, message: 'An error occurred while getting the status' };
        }
    }
}

exports.confirmAirtimeTransactionFixed = async (data) => {
    try {

        const decryptedData = data;
        let decoded = decryptedData.decoded
        const wallet = await Wallet.findOne({ _id: decryptedData.wallet_id }).populate([{ path: 'account', populate: [{ path: 'level' }] }])

        console.log(decryptedData, "token")

        const convertedTotal = await convertCurrency(wallet.currency.code, 'USD', decoded.total)

        console.log(convertedTotal, "converted total", decoded.total)

        let limitCheck1 = limitCheck(convertedTotal, wallet.account.level, wallet.account, 'sending');
        if (!limitCheck1.status) {
            return { status: false, message: limitCheck1.code }
        }

        // if the total amount is more than the balance then this will be returned 
        const balance = wallet.balance.available
        if (decoded.total > balance) {
            return { status: false, message: `Insufficient Balance, your current balance in this wallet is ${balance}` }

        }

        console.log(decoded, "decodeded")
        const transactionId = decryptedData.transactionID

        console.log(transactionId, "transactionId")

        const apiUrl = `https://dvs-api.dtone.com/v1/async/transactions/${transactionId}/confirm`;

        const response = await axios.post(apiUrl, null, {
            headers: {
                'Authorization': authHeader,
            },
        });

        if (response.data.status.class.message === "CONFIRMED") {
            const newAvailableBalance = wallet.balance.available - decoded.total;
            wallet.balance.available = newAvailableBalance;
            await wallet.save();

            // updating the limits used
            let USDTotal;
            if (wallet.currency.code !== 'USD') {
                USDTotal = await convertCurrency(wallet.currency.code, 'USD', decoded.total);
            } else {
                USDTotal = total
            }
            await updateUsedLimits(wallet.account, null, USDTotal, null);

            const senderTimezone = wallet.account?.timezone || "UTC"

            const senderCurrentTime = moment().tz(senderTimezone).format();

            let senderTransactionObj = {
                reference_id: `tr_${transactionId}`,
                type: 'instant',
                transaction_type: 'debit',
                service_type: 'airtime',
                payment_type: "airtime",
                status: 'INITIATED',
                purpose: "",
                description: `${decoded.name} - ${decoded.desc}`,
                airtime_number: decryptedData.number,
                currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
                amount: decoded.total,
                fee: decoded.fee,
                fee_type: decoded.fee_type,
                markup: decoded.markup,
                markup_currency: decoded.markup_currency,
                exchange_rate: decoded.fee_exchangerate,
                exchange_rate_markup: decoded.exchange_rate_markup,
                total: decoded.total,
                wallet_id: wallet.wallet_id,
                wallet: wallet._id,
                account: wallet.account._id,
                sender: wallet.account._id,
                receiver: null,
                current_balance: wallet.balance.available,
                timeline: [
                    {
                        status: 'INITIATED',
                        date: senderCurrentTime,
                    }
                ]
            };

            const newTransaction = new Transaction(senderTransactionObj);

            await newTransaction.save()

            const data = {
                status: true,
                message: "Transaction Successful",
                type: "PIN",
                type_message: `Follow the instructions received via SMS on ${decryptedData.number} to activate the airtime.`
            }

            return { status: true, message: data, }

        } else {
            return { status: false, message: "Transaction Failed" }
        }

    }
    catch (error) {
        console.log(error)
        return { status: false, message: "Transaction Failed" }
    }
}

// create a transaction
exports.createTransactions = async (data) => {
    try {

        const decryptedData = data
        const wallet_id = decryptedData.wallet_id
        console.log(decryptedData, "decryptedData")
        const wallet = await Wallet.findOne({ _id: wallet_id }).populate([{ path: 'account', populate: [{ path: 'level' }] }])
        const accountLevelId = wallet.account.level._id
        const fees = await FeeModel.findOne({ $and: [{ service_name: "airtime" }, { account_level: wallet.account.level._id }] }).populate('account_level');
        let currency = wallet.currency.code   // the currency of the wallet

        // checking the status of the wallet
        if (!wallet || wallet.status !== 'active') {
            return { status: false, message: "Wallet not found" };
        }

        const fee_type = fees.fee_type
        const flat_fee = fees.flat_fee
        const percentage_fee = fees.percentage_fee
        const fee_currency = fees.fee_currency

        const number = decryptedData.number
        let amount = decryptedData.amount   // the amount the user wants to send
        const balance = wallet.balance.available

        let fee = 0;
        let dtone_currency
        let amount_converted

        const markup_fee = 1;
        // const markup_type = 'flat'
        // const percentage_markup = 6.5
        const markup_currency = 'USD'

        let markup_type = fees?.markup_type;
        let percentage_markup = fees?.percentage_markup;


        let covnerted_fee = 0
        let markup = 0
        let convertedAmount
        let exchangerate_markup
        let exchangeratefee

        const token = decryptedData.token
        try {
            decoded = jwt.verify(token, secretKey);
        }
        catch (jwtError) {
            if (jwtError instanceof jwt.TokenExpiredError) {
                return { status: false, message: 'Token has expired' };
            } else {
                console.error('JWT Verification Error:', jwtError);
                return { status: false, message: 'Invalid token' };
            }
        }
        let product_id

        if (decoded && Array.isArray(decoded.filteredDataWithCurrency)) {
            product_id = decoded.filteredDataWithCurrency[0].id
        } else if (decoded && Array.isArray(decoded.extractedDataWithAdjustedValues)) {
            product_id = decoded.extractedDataWithAdjustedValues[0].id
        }

        console.log(decoded, "decoded")

        const apiUrl_products = `https://dvs-api.dtone.com/v1/products/${product_id}`

        const makeApiCall = async () => {

            const response = await axios.get(apiUrl_products, {
                headers: {
                    'Authorization': authHeader
                }
            });

            return response.data;
        };


        const TransactionAPI = async () => {

            const url = 'https://dvs-api.dtone.com/v1/async/transactions';

            let t_id = `${wallet.account._id}_${Date.now()}`

            let externalId = t_id

            const requestBody = {
                external_id: externalId,
                product_id: product_id,
                auto_confirm: false,
                credit_party_identifier: {
                    mobile_number: number
                },
                callback_url: "https://fontawesomev23.com/api/webhook/dtone-transaction-status"
            }

            const response = await axios.post(url, requestBody, {
                headers: {
                    'Authorization': authHeader,
                },
            });
            return response.data
        }

        const TransactionForAirtime = async (amount_to_send, SourceCurrency) => {

            const url = 'https://dvs-api.dtone.com/v1/async/transactions';

            let t_id = `${wallet.account._id}_${Date.now()}`

            let externalId = t_id

            const requestBody = {

                external_id: externalId,
                calculation_mode: "DESTINATION_AMOUNT",
                // source: {
                //     unit_type: "CURRENCY",
                //     unit: null,
                //     amount: null
                // },
                destination: {
                    unit_type: "CURRENCY",
                    unit: SourceCurrency,
                    amount: amount_to_send
                },
                product_id: product_id,
                auto_confirm: false,
                credit_party_identifier: {
                    mobile_number: number
                },
                callback_url: "https://fontawesomev23.com/api/webhook/dtone-transaction-status"
            }

            console.log(requestBody, 'requestBodyforConfirmTransactions')

            // axios.post(url, requestBody, {
            //     headers: {
            //         'Authorization': authHeader
            //     }
            // }).then((res) => {
            //     console.log(res.data, "res.data")
            // }).catch((err) => {
            //     console.log(err.response.data.errors)
            // })

            const response = await axios.post(url, requestBody, {
                headers: {
                    'Authorization': authHeader,
                },
            });
            return response.data
        }

        let responseData = await makeApiCall();
        // console.log(responseData, responseData.benefits[0].amount, "responseDataintrans")
        const sub_service_id = responseData.service.subservice.id

        if (sub_service_id == 11) {

            const DT_ONE_FEE = responseData.prices.wholesale.fee
            const source = responseData.source
            const DT_ONE_Currency = source.unit;
            let convertedDTOneFee
            if (DT_ONE_FEE <= 0) {
                convertedDTOneFee = 0
            } else {
                convertedDTOneFee = await convertCurrency(DT_ONE_Currency, currency, DT_ONE_FEE)
            }

            // currency of the service (Dtone)  
            const SourceCurrencyUnit = responseData.benefits[0].unit;
            let exchangerate = await convertCurrency(SourceCurrencyUnit, currency, 1);
            exchangerate = exchangerate.toFixed(3);

            // currency of the service (Dtone)  
            const SourceCurrency = responseData.source.unit;



            //calculating the fee
            if (fee_type === 'flat') {
                if (fee_currency === currency) {
                    fee = flat_fee
                } else {
                    if (fee_currency === SourceCurrencyUnit) {
                        exchangeratefee = exchangerate
                        fee = flat_fee * exchangeratefee
                    }
                    else {
                        exchangeratefee = await convertCurrency(fee_currency, currency, 1)
                        fee = flat_fee * exchangeratefee

                    }
                }


            }

            //calculating the markup
            if (markup_type === 'flat') {
                if (markup_currency === currency) {
                    markup = markup_fee
                } else {
                    if (markup_currency === SourceCurrencyUnit) {
                        exchangerate_markup = exchangerate
                        markup = markup_fee * exchangerate_markup
                    }
                    else {
                        exchangerate_markup = await convertCurrency(markup_currency, currency, 1)
                        markup = markup_fee * exchangerate_markup

                    }
                }

            }

            let amount = decryptedData.amount   // the amount the user wants to send

            if (!amount) {
                return { status: false, message: "Amount not found" }

            }

            let responseDataArray = [responseData]  // objects are being returned, keeping it in a array so filtering is similar to the all the other api outputs


            if (markup_type === 'percentage') {
                const percentage_markup_amount = (percentage_markup / 100) * parseInt(amount);
                markup = percentage_markup_amount;
            }

            console.log(markup, "afteraftermarkuptrans")

            if (fee_type === 'percentage') {
                const percentage_fee_amount = (percentage_fee / 100) * parseInt(amount);
                fee = percentage_fee_amount;
            }

            // extracting important data from the api response and filtering and adding fees & total
            const extractedDataWithAdjustedValues = responseDataArray.map(item => {
                const originalMax = item.benefits[0].amount.base.max;
                const originalMin = item.benefits[0].amount.base.min;


                let adjustedMax = ((originalMax * 0.98) * exchangerate).toFixed(3);;  // decreasing by 2% 
                let adjustedMin = ((originalMin * 1.02) * exchangerate).toFixed(3);; // increasing by 2% 

                sending_amount = amount;

                amount_dtone = sending_amount - markup

                adjustedMax = parseFloat(adjustedMax) + markup;
                adjustedMin = parseFloat(adjustedMin) + markup;

                console.log({ adjustedMax, adjustedMin, originalMax, originalMin, markup });

                const totalAmount = (convertedDTOneFee + fee) + parseFloat(amount)
                const extractedItem = {
                    name: item.name,
                    id: item.id,
                    baseAmount: {
                        max: parseFloat(adjustedMax),
                        min: parseFloat(adjustedMin)
                    },
                    unit: currency,
                    sending_amount: formatDecimalNumbersWithLimit(parseFloat(sending_amount) - (parseFloat(fee) + convertedDTOneFee)),
                    fee: formatDecimalNumbersWithLimit(parseFloat(fee) + convertedDTOneFee),
                    fee_type: fee_type,
                    total: parseFloat(amount),
                    markup: parseFloat(markup),
                    amount_to_send: parseFloat(amount_dtone),
                    fee_exchangerate: parseFloat(exchangeratefee),
                    percentage_fee: percentage_fee,
                    fee_currency: fee_currency,
                    fee_new_currency: parseFloat(currency),
                    flat_fee: parseFloat(flat_fee),
                    markup_fee: parseFloat(markup_fee),
                    markup_type: markup_type,
                    percentage_markup: percentage_markup,
                    markup_currency: markup_currency,
                    markup_exchangerate: parseFloat(exchangerate_markup),
                    markup_new_unit: currency,
                    exchange_rate: parseFloat(exchangerate),
                    dtone_account_currency: SourceCurrency
                };

                return extractedItem;
            });

            console.log(extractedDataWithAdjustedValues, "extractedDataWithAdjustedValues")

            const total = extractedDataWithAdjustedValues[0].total

            const convertedTotal = await convertCurrency(currency, 'USD', total)

            let limitCheck1 = limitCheck(convertedTotal, wallet.account.level, wallet.account, 'sending');
            console.log(limitCheck1, "limitCheck1")
            if (!limitCheck1.status) {
                return { status: false, code: limitCheck1.code };
            }

            // if the total amount is more than the balance then this will be returned 
            if (total > balance) {
                return { status: false, message: `Insufficient Balance, you current balance in this wallet is ${balance}` }

            }

            if (extractedDataWithAdjustedValues[0].sending_amount > extractedDataWithAdjustedValues[0].baseAmount.max) {
                return { status: false, message: `Amount entered is more than the maximum` }

            }

            if (extractedDataWithAdjustedValues[0].sending_amount < extractedDataWithAdjustedValues[0].baseAmount.min) {
                return { status: false, message: `Amount entered is less than the minimum amount allowed` }

            }

            console.log(extractedDataWithAdjustedValues, "extractedDataWithAdjustedValues")

            const jsonString1 = JSON.stringify(extractedDataWithAdjustedValues);
            const jsonString2 = JSON.stringify(decoded.extractedDataWithAdjustedValues);

            console.log("JSON strings:", jsonString1, jsonString2);

            if (true) {
                console.log("The arrays are equal.");

                let converted_amount = await convertCurrency(extractedDataWithAdjustedValues[0].unit, SourceCurrency, extractedDataWithAdjustedValues[0].sending_amount)
                converted_amount = converted_amount.toFixed(3)

                console.log(converted_amount, "converted_amount", SourceCurrency, "SourceCurrency")

                // responseData = await TransactionForAirtime(converted_amount, SourceCurrency)
                responseData = await TransactionForAirtime(extractedDataWithAdjustedValues[0].sending_amount, extractedDataWithAdjustedValues[0].unit)

                //return res.json(responseData)

                transaction_id = responseData.id


                const payload = {

                    Wallet_Id: wallet_id,
                    Transaction_ID: transaction_id,
                    Sub_Service_id: sub_service_id,
                    extractedDataWithAdjustedValues,
                    number

                };

                return { status: true, data: payload }



            } else {
                return { status: false, message: "Rates have changed so please select the product again" }

            }

        }


        if (sub_service_id != 11) {

            const DT_ONE_FEE = responseData.prices.wholesale.fee
            let convertedDTOneFee
            const source = responseData.source
            const DT_ONE_Currency = source.unit;
            console.log(DT_ONE_Currency, "DT_ONE_Currency")
            if (DT_ONE_FEE <= 0) {
                convertedDTOneFee = 0
            } else {
                convertedDTOneFee = await convertCurrency(DT_ONE_Currency, currency, DT_ONE_FEE)
            }

            const SourceCurrencyUnit = responseData.source.unit;
            let exchangerate = await convertCurrency(SourceCurrencyUnit, currency, 1);
            exchangerate = exchangerate.toFixed(3);

            //calculating the fee
            if (fee_type === 'flat') {
                if (fee_currency === currency) {
                    fee = flat_fee
                } else {
                    if (fee_currency === SourceCurrencyUnit) {
                        exchangeratefee = exchangerate
                        fee = flat_fee * exchangeratefee
                    }
                    else {
                        exchangeratefee = await convertCurrency(fee_currency, currency, 1)
                        fee = flat_fee * exchangeratefee

                    }
                }

            }

            //calculating the markup
            if (markup_type === 'flat') {
                if (markup_currency === currency) {
                    markup = markup_fee
                } else {
                    if (markup_currency === SourceCurrencyUnit) {
                        exchangerate_markup = exchangerate
                        markup = markup_fee * exchangerate_markup
                    }
                    else {
                        exchangerate_markup = await convertCurrency(markup_currency, currency, 1)
                        markup = markup_fee * exchangerate_markup
                    }
                }
            }

            const responseDataArray = [responseData];

            const filteredDataWithCurrency = responseDataArray.map(rechargeOption => {
                convertedAmount = rechargeOption.prices.retail.amount !== 0
                    ? (rechargeOption.prices.retail.amount * exchangerate).toFixed(3)   // if retail price is not 0 then this this
                    : (rechargeOption.prices.wholesale.amount * exchangerate).toFixed(3)  //  if retail prive is 0 then this


                if (markup_type === 'percentage') {
                    const percentage_markup_amount = (percentage_markup / 100) * convertedAmount;
                    markup = percentage_markup_amount;
                }

                const new_amount = markup + parseFloat(convertedAmount)

                const prices = {
                    amount: new_amount,
                    unit: currency,
                    unit_type: rechargeOption.prices.retail.unit_type
                };

                total_now = ((convertedDTOneFee + fee) + prices.amount).toFixed(3)

                if (fee_type === 'percentage') {
                    const percentage_fee_amount = (percentage_fee / 100) * new_amount;
                    fee = percentage_fee_amount;
                }

                return {
                    id: rechargeOption.id,
                    name: rechargeOption.name,
                    description: rechargeOption.description,
                    prices: prices,
                    fee: parseFloat(fee) + convertedDTOneFee,
                    fee_type: fee_type,
                    total: parseFloat(total_now),
                    markup: parseFloat(markup),
                    amount_without_markup: parseFloat(convertedAmount),
                    fee_exchangerate: parseFloat(exchangeratefee),
                    percentage_fee: percentage_fee,
                    fee_currency: fee_currency,
                    fee_new_currency: parseFloat(currency),
                    flat_fee: parseFloat(flat_fee),
                    markup_fee: parseFloat(markup_fee),
                    markup_type: markup_type,
                    percentage_markup: percentage_markup,
                    markup_currency: markup_currency,
                    markup_exchangerate: parseFloat(exchangerate_markup),
                    markup_new_unit: currency,
                    exchange_rate: parseFloat(exchangerate),
                    dtone_account_currency: SourceCurrencyUnit

                };
            });

            const total = filteredDataWithCurrency[0].total

            const convertedTotal = await convertCurrency(currency, 'USD', total)

            let limitCheck1 = limitCheck(convertedTotal, wallet.account.level, wallet.account, 'sending');
            if (!limitCheck1.status) {
                return { status: false, message: limitCheck1.code }
            }
            // if the total amount is more than the balance then this will be returned 
            if (total > balance) {
                return { status: false, message: `Insufficient Balance, you current balance in this wallet is ${balance}` }

            }

            const filteredData = filteredDataWithCurrency.map(item => ({
                id: item.id,
                name: item.name,
                description: item.description,
                prices: {
                    amount: formatDecimalNumbersWithLimit(item.prices.amount),
                    unit: item.prices.unit,
                    unit_type: item.prices.unit_type
                },
                fee: formatDecimalNumbersWithLimit(item.fee),
                total: formatDecimalNumbersWithLimit(item.total)
            }));


            // Convert the arrays to JSON strings
            const jsonString1 = JSON.stringify(filteredDataWithCurrency);
            const jsonString2 = JSON.stringify(decoded.filteredDataWithCurrency);
            console.log("JSON strings:", jsonString1, jsonString2);

            // Compare the JSON strings
            if (true) {
                console.log("The arrays are equal.");

                responseData = await TransactionAPI()

                //res.json(responseData);


                transaction_id = responseData.id

                const payload = {
                    Wallet_Id: wallet_id,
                    Transaction_ID: transaction_id,
                    Sub_Service_id: sub_service_id,
                    filteredDataWithCurrency,
                    number
                };

                return { status: true, data: payload }

            } else {
                return { status: false, message: "Rates have changed so please select the product again" }
            }

        }
    } catch (error) {
        console.error('Error getting status:', error);

        //returns the error which we get from DTone
        if (error.response && error.response.data && error.response.data.errors) {
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');

            return { status: false, message: errorMessages };
        } else {
            // returns error if there is a problem on our end and not the service
            return { status: false, message: 'Error getting status. Please try again later.' }
        }
    }

}

// create a fixed airtime transaction
exports.createAirtimeTransactions = async (data) => {
    try {
        const decryptedData = data;
        const wallet_id = decryptedData.wallet_id;
        const auth_type = decryptedData.type;
        const wallet = await Wallet.findOne({ _id: wallet_id }).populate([{ path: 'account', populate: [{ path: 'level' }] }]);
        const accountLevelId = wallet.account.level._id;
        const fees = await FeeModel.findOne({ account_level: accountLevelId }).populate('account_level');
        let currency = wallet.currency.code;  // the currency of the wallet

        // checking the status of the wallet
        if (wallet.status !== 'active') {
            return { status: false, message: 'This wallet is not active' };
        }

        const number = decryptedData.number;
        const product_id = decryptedData.product_id;
        const token = decryptedData.token;

        let decoded;
        try {
            decoded = jwt.verify(token, secretKey);
        } catch (jwtError) {
            if (jwtError instanceof jwt.TokenExpiredError) {
                return { status: false, message: 'Token has expired' };
            } else {
                console.error('JWT Verification Error:', jwtError);
                return { status: false, message: 'Invalid token' };
            }
        }

        console.log(decoded, "decoded");

        const url = 'https://dvs-api.dtone.com/v1/async/transactions';
        let t_id = `${wallet.account._id}_${Date.now()}`;
        let externalId = t_id;

        const requestBody = {
            external_id: externalId,
            product_id: product_id,
            credit_party_identifier: {
                mobile_number: number
            },
            callback_url: 'https://fontawesomev23.com/api/webhook/dtone-transaction-status',
        };

        console.log(requestBody, "requestBody in airtime");

        const response = await axios.post(url, requestBody, {
            headers: {
                'Authorization': authHeader,
            },
        });

        console.log(response.data, "response.data");

        if (response.data.status.class.message === "CREATED") {
            const payload = {
                transactionID: response.data.id,
                decoded: decoded,
                wallet_id,
                number: number,
            };

            console.log(payload, "payload");

            return { status: true, data: payload };
        } else {
            return { status: false, message: "Something went wrong" };
        }
    } catch (error) {
        console.error('Error in createAirtimeTransactions:', error);
        return { status: false, message: 'An error occurred while processing the transaction' };
    }
}

async function confirmTransctionFixed(data) {
    try {
        const { decoded, wallet, number, transctionId, t_id } = data

        console.log(decoded, number, transctionId, "decoded, wallet, number, transctionId")

        const apiUrl = `https://dvs-api.dtone.com/v1/async/transactions/${transctionId}/confirm`;

        const response = await axios.post(apiUrl, null, {
            headers: {
                'Authorization': authHeader,
            },
        })

        if (response.data.status.class.message === "CONFIRMED") {
            const total = decoded.converted.total.value

            const newAvailableBalance = wallet.balance.available - total;
            wallet.balance.available = newAvailableBalance;
            await wallet.save();

            // updating the limits used
            let USDTotal;
            if (wallet.currency.code !== 'USD') {
                USDTotal = await convertCurrency(wallet.currency.code, 'USD', total);
            } else {
                USDTotal = total
            }
            await updateUsedLimits(wallet.account, null, USDTotal, null);

            const senderTimezone = wallet.account?.timezone || "UTC"

            const senderCurrentTime = moment().tz(senderTimezone).format();

            let ref = 'tr_' + Date.now().toString();
            let senderTransactionObj = {
                reference_id: ref,
                external_reference: t_id,
                type: 'instant',
                transaction_type: 'debit',
                service_type: 'airtime',
                payment_type: "instapay_wallet",
                status: 'INITIATED',
                purpose: "",
                description: "",
                airtime_number: number,
                currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
                amount: total - decoded.converted.fee.value,
                fee: decoded.converted.fee.value,
                fee_type: decoded.converted.feeDetails.fee_type,
                markup: decoded.converted.feeDetails.percentage_markup,
                markup_currency: "USD",
                exchange_rate: decoded.converted.feeDetails.actual_rate,
                exchange_rate_markup: decoded.converted.feeDetails.rate_after_markup,
                total: total,
                wallet_id: wallet.wallet_id,
                wallet: wallet._id,
                account: wallet.account._id,
                sender: wallet.account._id,
                receiver: null,
                current_balance: wallet.balance.available,
                new_balance: wallet.balance.available - total,
                timeline: [
                    {
                        status: 'INITIATED',
                        date: senderCurrentTime,
                    }
                ]
            };

            const newTransaction = new Transaction(senderTransactionObj);

            await newTransaction.save();

            return { status: true, message: "Transaction confirmed!", data: newTransaction }
        } else {
            return { status: false, message: "Transaction failed!" }
        }

    } catch (err) {
        console.log(err?.response?.data?.errors || err)
        await logError(
            err?.response?.data?.errors || err,
            "airtime_helper_fixed",
            null,
            data?.topup_transaction_id || null,
        );
        return { status: false, message: "Transaction failed!" }

    }
}

async function confirmTransctionRanged(data) {
    try {
        const { decoded, wallet, number, transctionId, t_id } = data

        console.log(decoded, number, transctionId, "decoded, wallet, number, transctionId")

        const apiUrl = `https://dvs-api.dtone.com/v1/async/transactions/${transctionId}/confirm`;

        const response = await axios.post(apiUrl, null, {
            headers: {
                'Authorization': authHeader,
            },
        })

        if (response.data.status.class.message === "CONFIRMED") {
            const total = decoded.total.value

            const newAvailableBalance = wallet.balance.available - total;
            wallet.balance.available = newAvailableBalance;
            await wallet.save();

            // updating the limits used
            let USDTotal;
            if (wallet.currency.code !== 'USD') {
                USDTotal = await convertCurrency(wallet.currency.code, 'USD', total);
            } else {
                USDTotal = total
            }
            await updateUsedLimits(wallet.account, null, USDTotal, null);

            const senderTimezone = wallet.account?.timezone || "UTC"

            const senderCurrentTime = moment().tz(senderTimezone).format();

            let ref = 'tr_' + Date.now().toString();
            let senderTransactionObj = {
                reference_id: ref,
                external_reference: t_id,
                type: 'instant',
                transaction_type: 'debit',
                service_type: 'airtime',
                payment_type: "instapay_wallet",
                status: 'INITIATED',
                purpose: "",
                description: "",
                airtime_number: number,
                recipient_received_amount: decoded.recipient.value,
                recipient_received_currency: decoded.recipient.currency,
                currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
                amount: formatDecimalNumbersWithLimit(total - decoded.fee.value, 2),
                fee: decoded.fee.value,
                fee_type: decoded.feeDetails.fee_type,
                markup: decoded.feeDetails.percentage_markup,
                markup_currency: "USD",
                exchange_rate: decoded.feeDetails.actual_rate,
                exchange_rate_markup: decoded.feeDetails.rate_after_markup,
                total: total,
                wallet_id: wallet.wallet_id,
                wallet: wallet._id,
                account: wallet.account._id,
                sender: wallet.account._id,
                receiver: null,
                current_balance: wallet.balance.available,
                new_balance: wallet.balance.available - total,
                timeline: [
                    {
                        status: 'INITIATED',
                        date: senderCurrentTime,
                    }
                ]
            };

            const newTransaction = new Transaction(senderTransactionObj);

            await newTransaction.save();

            return { status: true, message: "Transaction confirmed!", data: newTransaction }
        } else {
            return { status: false, message: "Transaction failed!" }
        }

    } catch (err) {
        console.log(err?.response?.data?.errors || err)
        await logError(
            err?.response?.data?.errors || err,
            "airtime_helper_ranged",
            null,
            data?.topup_transaction_id || null,
        );
        return { status: false, message: "Transaction failed!" }

    }
}

async function confirmTransctionESim(data) {
    try {
        const { decoded, wallet, transctionId, t_id } = data

        console.log(decoded, transctionId, "decoded, wallet, transctionId")

        const apiUrl = `https://dvs-api.dtone.com/v1/async/transactions/${transctionId}/confirm`;

        const response = await axios.post(apiUrl, null, {
            headers: {
                'Authorization': authHeader,
            },
        })

        if (response.data.status.class.message === "CONFIRMED") {
            const total = decoded.converted.total.value

            const newAvailableBalance = wallet.balance.available - total;
            wallet.balance.available = newAvailableBalance;
            await wallet.save();

            // updating the limits used
            let USDTotal;
            if (wallet.currency.code !== 'USD') {
                USDTotal = await convertCurrency(wallet.currency.code, 'USD', total);
            } else {
                USDTotal = total
            }
            await updateUsedLimits(wallet.account, null, USDTotal, null);

            const senderTimezone = wallet.account?.timezone || "UTC"

            const senderCurrentTime = moment().tz(senderTimezone).format();

            let ref = 'tr_' + Date.now().toString();
            let senderTransactionObj = {
                reference_id: ref,
                external_reference: t_id,
                type: 'instant',
                transaction_type: 'debit',
                service_type: 'airtime',
                payment_type: "instapay_wallet",
                status: 'INITIATED',
                purpose: "",
                description: "",
                currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
                amount: total - decoded.converted.fee.value,
                fee: decoded.converted.fee.value,
                fee_type: decoded.converted.feeDetails.fee_type,
                markup: decoded.converted.feeDetails.percentage_markup,
                markup_currency: "USD",
                exchange_rate: decoded.converted.feeDetails.actual_rate,
                exchange_rate_markup: decoded.converted.feeDetails.rate_after_markup,
                total: total,
                wallet_id: wallet.wallet_id,
                wallet: wallet._id,
                account: wallet.account._id,
                sender: wallet.account._id,
                receiver: null,
                current_balance: wallet.balance.available,
                new_balance: wallet.balance.available - total,
                timeline: [
                    {
                        status: 'INITIATED',
                        date: senderCurrentTime,
                    }
                ]
            };

            const newTransaction = new Transaction(senderTransactionObj);

            await newTransaction.save();

            const apiUrl = `https://dvs-api.dtone.com/v1/products/${decoded.id}`

            const apiResponse = await axios.get(apiUrl, {
                headers: {
                    'Authorization': authHeader
                }
            });

            const productDetails = apiResponse.data

            const esim = new ESimModel({
                productId: decoded.id,
                productName: productDetails.name,
                productDesc: productDetails.description,
                account: wallet.account._id
            })

            await esim.save()

            return { status: true, message: "Transaction confirmed!", data: newTransaction, response: response.data }
        } else {
            return { status: false, message: "Transaction failed!" }
        }

    } catch (err) {
        console.log(err?.response?.data?.errors || err)
        await logError(
            err?.response?.data?.errors || err,
            "esim",
            null,
            data?.topup_transaction_id || null,
        );
        return { status: false, message: "Transaction failed!" }

    }
}

const createTransactionRangedHelper = async ({ number, decoded, wallet_id, transaction_id }) => {
    try {
        const wallet = await Wallet.findById(wallet_id).populate({ path: "account", populate: { path: "level" } });

        if (!wallet) {
            return { status: false, message: "Wallet not found!" };
        }

        // Balance check
        if (wallet.balance.available < decoded.total.value) {
            return { status: false, message: "Insufficient balance!" };
        }

        // Limit check
        let sendingAmountInUSD = await convertCurrency(wallet.currency.code, 'USD', decoded.total.value);
        let limitCheck1 = limitCheck(sendingAmountInUSD, wallet.account.level, wallet.account, 'sending');

        if (!limitCheck1.status) {
            return { status: false, message: limitCheck1.code };
        }

        const productDetails = decoded.product_details;
        const url = 'https://dvs-api.dtone.com/v1/async/transactions';
        let t_id = `${wallet.account._id}_${Date.now()}`;

        const requestBody = {
            external_id: t_id,
            calculation_mode: "SOURCE_AMOUNT",
            source: {
                unit_type: "CURRENCY",
                unit: productDetails.source_currency,
                amount: productDetails.source_amount
            },
            product_id: productDetails.id,
            auto_confirm: false,
            credit_party_identifier: {
                mobile_number: number
            },
            // sender: {
            //     last_name: wallet.account?.last_name || '',
            //     first_name: wallet.account?.first_name || '',
            //     nationality_country_iso_code: wallet.account?.user_nationaility || '',
            //     mobile_number: wallet.account.phone || '',
            //     email: wallet.account?.email || '',
            //     address_text: wallet.account?.address || '',
            //     address_city: wallet.account?.city || '',
            //     address_country_iso_code: wallet.account?.country_iso_code || '',
            //     address_postal_code: wallet.account?.postal_code || ''
            // },
            callback_url: "https://fontawesomev23.com/api/webhook/dtone-transaction-status"
        };

        try {
            const response = await axios.post(url, requestBody, {
                headers: { 'Authorization': authHeader },
            });

            if (response.status === 201) {
                const transctionId = response.data.id;

                const data = {
                    wallet,
                    number,
                    decoded,
                    transctionId,
                    t_id,
                    topup_transaction_id: transaction_id
                };

                const confirmTransaction = await confirmTransctionRanged(data);

                if (!confirmTransaction.status) {
                    return { status: false, message: "An error occurred while confirming the transaction." };
                } else {
                    return { status: true, message: "Transaction confirmed successfully", data: confirmTransaction.data };
                }
            } else {
                return { status: false, message: "An error occurred while creating transaction." };
            }
        } catch (error) {
            await logError(
                error?.response?.data?.errors || error,
                "airtime_helper_ranged",
                null,
                transaction_id || null,
            );
            console.error('Error creating transaction:', error?.response?.data?.errors || error);
            return { status: false, message: "An error occurred while creating transaction.", error: error.message };
        }
    } catch (error) {
        await logError(
            error?.response?.data?.errors || error,
            "airtime_helper_ranged",
            null,
            transaction_id || null,
        );
        console.error('Error in transaction process:', error);
        return { status: false, message: "An error occurred during the transaction process.", error: error.message };
    }
};

async function createTransactionFixedHelper({ number, decoded, wallet_id, transaction_id }) {
    const wallet = await Wallet.findById(wallet_id).populate({ path: "account", populate: { path: "level" } });

    if (!wallet) {
        return {
            status: false,
            message: "Wallet not found!",
            code: 404
        };
    }

    if (wallet.balance.available < decoded.converted.total.value) {
        return {
            status: false,
            message: "Insufficient balance!",
            code: 400
        };
    }

    const sendingAmountInUSD = await convertCurrency(wallet.currency.code, 'USD', decoded.converted.total.value);
    const limitCheck1 = limitCheck(sendingAmountInUSD, wallet.account.level, wallet.account, 'sending');

    if (!limitCheck1.status) {
        return {
            status: false,
            message: limitCheck1.code,
            code: 400
        };
    }

    const t_id = `${wallet.account._id}_${Date.now()}`;
    const requestBody = {
        external_id: t_id,
        product_id: decoded.id,
        auto_confirm: false,
        credit_party_identifier: {
            mobile_number: number
        },
        // sender: {
        //     last_name: wallet.account?.last_name || '',
        //     first_name: wallet.account?.first_name || '',
        //     nationality_country_iso_code: wallet.account?.user_nationaility || '',
        //     mobile_number: wallet.account.phone || '',
        //     email: wallet.account?.email || '',
        //     address_text: wallet.account?.address || '',
        //     address_city: wallet.account?.city || '',
        //     address_country_iso_code: wallet.account?.country_iso_code || '',
        //     address_postal_code: wallet.account?.postal_code || ''
        // },
        callback_url: "https://fontawesomev23.com/api/webhook/dtone-transaction-status"
    };

    console.log({ requestBody });

    try {
        const response = await axios.post('https://dvs-api.dtone.com/v1/async/transactions', requestBody, {
            headers: { 'Authorization': authHeader },
        });

        if (response.status === 201) {
            const data = { wallet, number, decoded, transctionId: response.data.id, t_id, topup_transaction_id: transaction_id };
            const confirmTransaction = await confirmTransctionFixed(data);

            if (!confirmTransaction.status) {
                return {
                    status: false,
                    message: "An error occurred while confirming the transaction.",
                    code: 500
                };
            }

            return { status: true, message: "Transaction confirmed successfully", data: confirmTransaction.data };
        }

        return {
            status: false,
            message: "An error occurred while creating transaction.",
            code: 500
        };

    } catch (error) {
        console.error('Error creating transaction:', error?.response?.data?.errors || error);
        await logError(
            error?.response?.data?.errors || error,
            "airtime_helper_fixed",
            null,
            transaction_id || null,
        );
        return {
            status: false,
            message: "An error occurred while creating transaction.",
            code: 500,
        };
    }
}

async function createTransactionEsimHelper({ decoded, wallet_id, transaction_id }) {
    const wallet = await Wallet.findById(wallet_id).populate({ path: "account", populate: { path: "level" } });

    if (!wallet) {
        return {
            status: false,
            message: "Wallet not found!",
            code: 404
        };
    }

    if (wallet.balance.available < decoded.converted.total.value) {
        return {
            status: false,
            message: "Insufficient balance!",
            code: 400
        };
    }

    const sendingAmountInUSD = await convertCurrency(wallet.currency.code, 'USD', decoded.converted.total.value);
    const limitCheck1 = limitCheck(sendingAmountInUSD, wallet.account.level, wallet.account, 'sending');

    if (!limitCheck1.status) {
        return {
            status: false,
            message: limitCheck1.code,
            code: 400
        };
    }

    const t_id = `${wallet.account._id}_${Date.now()}`;
    const requestBody = {
        external_id: t_id,
        product_id: decoded.id,
        auto_confirm: false,
        sender: {
            last_name: wallet.account?.last_name || '',
            first_name: wallet.account?.first_name || '',
            mobile_number: decoded?.number || wallet.account.phone || '',
            email: decoded?.email || wallet.account?.email || ''
        },
        beneficiary: {
            last_name: wallet.account?.last_name || '',
            first_name: wallet.account?.first_name || '',
            mobile_number: decoded?.number || wallet.account.phone || '',
            email: decoded?.email || wallet.account?.email || ''
        },

        callback_url: "https://fontawesomev23.com/api/webhook/dtone-transaction-status"
    }

    console.log({ requestBody });

    try {
        const response = await axios.post('https://dvs-api.dtone.com/v1/async/transactions', requestBody, {
            headers: { 'Authorization': authHeader },
        });

        if (response.status === 201) {
            const data = {
                wallet,
                decoded,
                transctionId: response.data.id,
                t_id,
                topup_transaction_id: transaction_id
            }
            const confirmTransaction = await confirmTransctionESim(data)

            if (!confirmTransaction.status) {
                return {
                    status: false,
                    message: "An error occurred while confirming the transaction.",
                    code: 500
                };
            }

            return { status: true, message: "Transaction confirmed successfully", data: confirmTransaction.data };
        }

        return {
            status: false,
            message: "An error occurred while creating transaction.",
            code: 500
        };

    } catch (error) {
        console.error('Error creating transaction:', error?.response?.data?.errors || error);
        await logError(
            error?.response?.data?.errors || error,
            "airtime_helper_fixed",
            null,
            transaction_id || null,
        );
        return {
            status: false,
            message: "An error occurred while creating transaction.",
            code: 500,
        };
    }
}

const getItemsFromSubServicesHelper = async ({ wallet_id, userId, isoCode, operator_id, serviceId, subservice_id }) => {
    try {

        console.log({ wallet_id, userId, isoCode, operator_id, serviceId, subservice_id });
        const wallet = await Wallet.findOne({ _id: wallet_id });
        const account = await Account.findById(userId).populate('level');

        if (!account || !wallet_id) {
            return {
                status: false,
                message: "Wallet or account not found!"
            };
        }

        const perPage = 100;
        const apiUrl = `https://dvs-api.dtone.com/v1/products`;
        let allProducts = [];
        let currentPage = 1;
        let totalPages = 1;

        const exchangeRate = formatDecimalNumbersWithLimit(await convertCurrency("CHF", wallet.currency.code, 1), 6);

        do {
            const response = await axios.get(apiUrl, {
                params: {
                    country_iso_code: isoCode,
                    operator_id: operator_id,
                    per_page: perPage,
                    service_id: serviceId,
                    subservice_id: subservice_id,
                    page: currentPage, // Current page
                },
                headers: {
                    'Authorization': authHeader
                }
            });

            allProducts = allProducts.concat(response.data);
            totalPages = parseInt(response.headers['total-pages'] || '1', 10);
            currentPage++;
        } while (currentPage <= totalPages);

        let filteredProducts;

        if (subservice_id == 11) {
            const rangedValueRechargeItems = allProducts.filter(product => product.type === "RANGED_VALUE_RECHARGE");
            if (rangedValueRechargeItems.length > 0) {
                const fixedProduct = rangedValueRechargeItems[0];
                filteredProducts = {
                    name: fixedProduct.name,
                    id: fixedProduct.id,
                    baseAmount: {
                        max: formatDecimalNumbersWithLimit(fixedProduct.prices.wholesale.amount.max * exchangeRate),
                        min: formatDecimalNumbersWithLimit(fixedProduct.prices.wholesale.amount.min * exchangeRate)
                    },
                    unit: wallet.currency.code,
                    rate: exchangeRate
                };
            } else {
                filteredProducts = allProducts.filter(product => product.type === "FIXED_VALUE_PIN_PURCHASE").map(product => ({
                    id: product.id,
                    name: product.name,
                    description: product.description,
                    prices: {
                        amount: formatDecimalNumbersWithLimit(product.prices.wholesale.amount * exchangeRate),
                        unit: wallet.currency.code,
                        unit_type: product.prices.wholesale.unit_type
                    },
                    message: product.pin.usage_info[0]
                }));
            }
        } else if (subservice_id == 12) {
            filteredProducts = allProducts.map(product => ({
                id: product.id,
                name: product.name,
                description: product.description,
                prices: {
                    amount: formatDecimalNumbersWithLimit(product.prices.wholesale.amount * exchangeRate),
                    unit: wallet.currency.code,
                    unit_type: product.prices.wholesale.unit_type
                },
                message: ""
            }));
        } else if (subservice_id == 13) {
            filteredProducts = allProducts.map(product => ({
                id: product.id,
                name: product.name,
                description: product.description,
                prices: {
                    amount: formatDecimalNumbersWithLimit(product.prices.wholesale.amount * exchangeRate),
                    unit: wallet.currency.code,
                    unit_type: product.prices.wholesale.unit_type
                },
                message: ""
            }));
        }



        return {
            status: true,
            data: filteredProducts
        };
    } catch (error) {
        console.error('Error fetching products:', error?.response?.data?.errors || error);
        return {
            status: false,
            message: "An error occurred while fetching products.",
            error: error.message
        };
    }
};

const fetchItemDetailsHelper = async ({ productId, walletId }) => {
    try {

        console.log({ productId, walletId });
        const wallet = await Wallet.findById(walletId);
        const apiUrl = `https://dvs-api.dtone.com/v1/products/${productId}`;

        const apiResponse = await axios.get(apiUrl, {
            headers: {
                'Authorization': authHeader
            }
        });

        const productDetails = apiResponse.data;
        const dtRate = productDetails.prices.wholesale.amount;
        const dtFee = productDetails.prices.wholesale.fee;

        const exchangeRate = formatDecimalNumbersWithLimit(await convertCurrency("CHF", wallet.currency.code, 1), 6);

        const payload = {
            id: productDetails.id,
            name: productDetails.name,
            type: productDetails.type,
            description: productDetails.description,
            prices: {
                amount: formatDecimalNumbersWithLimit(dtRate * exchangeRate),
                unit: wallet.currency.code,
            },
            actualPrices: {
                amount: formatDecimalNumbersWithLimit(dtRate),
                unit: productDetails.prices.wholesale.unit,
            },
            message: "",
            fee: {
                amount: formatDecimalNumbersWithLimit(dtFee * exchangeRate),
                unit: wallet.currency.code,
            },
            actualFee: {
                amount: formatDecimalNumbersWithLimit(dtFee),
                unit: productDetails.prices.wholesale.unit,
            },
            destination: productDetails.destination
        };

        const token = jwt.sign(payload, secretKey, { expiresIn: '2h' });

        const response = {
            ...payload,
            token
        };

        return {
            status: true,
            data: response,
        };
    }
    catch (err) {
        return {
            status: false,
            message: "An error occurred while fetching products.",
        };
    }
};

const getRatesHelper = async (data) => {
    try {
        const { payment_method, wallet_id, sub_service_id, local_wallet_id, token } = data;

        let decoded;
        try {
            decoded = jwt.verify(token, secretKey);
        } catch {
            return {
                status: false,
                message: "Invalid token!"
            };
        }

        const wallet = await Wallet.findById(wallet_id).populate({ path: "account", populate: { path: "level" } });
        const localWallet = await Wallet.findById(local_wallet_id);

        if (!wallet || !localWallet) {
            return {
                status: false,
                message: "Wallet not found!"
            };
        }

        const serviceName = sub_service_id == 11 ? "airtime" : "bundle";
        const feeDetails = await FeeModel.findOne({ $and: [{ service_name: serviceName }, { account_level: wallet.account.level._id }] }).populate('account_level');

        const exchangeRateResponse = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${localWallet.currency.code}&to=${wallet.currency.code}&amount=1&format=1`);
        if (!exchangeRateResponse.data.success) {
            return {
                status: false,
                message: "Exchange Rates not found!"
            };
        }

        const newRate = formatDecimalNumbersWithLimit(exchangeRateResponse.data.info.rate, 6);
        const exchange_rate = localWallet.currency.code !== wallet.currency.code
            ? formatDecimalNumbersWithLimit(newRate - (feeDetails.percentage_markup / 100) * newRate, 6)
            : newRate;

        const convertedAmountFromLocalToCurrent = formatDecimalNumbersWithLimit(decoded.prices.amount * exchange_rate, 2);
        let fee;
        if (feeDetails.fee_type === 'flat') {
            console.log(feeDetails.fee_currency || 'USD', wallet.currency.code, feeDetails.flat_fee, "feeDetails.fee_currency || 'USD', wallet.currency.code, feeDetails.flat_fee")
            fee = formatDecimalNumbersWithLimit(await convertCurrency(feeDetails.fee_currency || 'USD', wallet.currency.code, feeDetails.flat_fee), 2);
        } else {
            fee = formatDecimalNumbersWithLimit(convertedAmountFromLocalToCurrent * (feeDetails.percentage_fee / 100), 2);
        }

        let topupFee = 0;
        const convertedDTOneFee = formatDecimalNumbersWithLimit(decoded.fee.amount * exchange_rate, 2);
        if (payment_method === 'card') {
            topupFee = parseFloat(await topUpFeeCalculation(wallet, formatDecimalNumbersWithLimit(convertedAmountFromLocalToCurrent + convertedDTOneFee + fee, 2), 'topup_card_payment'));
            fee += topupFee;
        } else if (payment_method === 'paypal') {
            const paypalFeeDetails = await getPaypalFeeHelper(wallet, convertedAmountFromLocalToCurrent, formatDecimalNumbersWithLimit(convertedAmountFromLocalToCurrent + fee + convertedDTOneFee, 2));
            topupFee = paypalFeeDetails.fee;
            fee += topupFee;
            var paypalConverted = formatDecimalNumbersWithLimit(paypalFeeDetails.converted_amount, 2);
            var paypalRate = formatDecimalNumbersWithLimit(paypalFeeDetails.rate, 6);
            var currencySupported = paypalFeeDetails.currencySupported;
        }

        const totalAmount = formatDecimalNumbersWithLimit(convertedAmountFromLocalToCurrent + convertedDTOneFee + fee, 2);
        const totalFee = formatDecimalNumbersWithLimit(convertedDTOneFee + fee, 2);

        const response = {
            total: {
                value: totalAmount,
                currency: wallet.currency.code
            },
            fee: {
                value: totalFee,
                currency: wallet.currency.code
            },
            sending: {
                value: convertedAmountFromLocalToCurrent,
                currency: wallet.currency.code
            },
            feeDetails: {
                fee_type: feeDetails.fee_type,
                fee_currency: feeDetails.fee_currency,
                flat_fee: feeDetails.flat_fee,
                percentage_fee: feeDetails.percentage_fee,
                markup_type: feeDetails.markup_type,
                percentage_markup: feeDetails.percentage_markup,
                actual_rate: exchange_rate,
                rate_after_markup: newRate,
            },
            ...(payment_method === 'paypal' && {
                paypal: {
                    paypal_converted: { value: paypalConverted || null, currency: "USD" },
                    paypal_rate: { value: paypalRate || null, currency: "USD" },
                    paypal_currency_supported: currencySupported,
                    fee: { value: formatDecimalNumbersWithLimit(topupFee || 0, 2), currency: wallet.currency.code }
                }
            })
        };

        const { exp, ...decodedWithoutExp } = decoded;
        const payload = {
            converted: response,
            ...decodedWithoutExp
        };

        const newToken = jwt.sign(payload, secretKey, { expiresIn: '2h' });

        return {
            status: true,
            data: { ...payload, token: newToken }
        };
    } catch (err) {
        console.log(err)
        return {
            status: false,
            message: "An error occurred while fetching products."
        };
    }
};

const fetchRangedAirtimeRatesHelper = async (data) => {
    try {
        const { product_id, wallet_id, local_wallet_id, amount, sub_service_id, payment_method } = data;

        const wallet = await Wallet.findById(wallet_id).populate({ path: "account", populate: { path: "level" } });
        const localWallet = await Wallet.findById(local_wallet_id);

        const apiUrl = `https://dvs-api.dtone.com/v1/products/${product_id}`;
        const apiResponse = await axios.get(apiUrl, {
            headers: { 'Authorization': authHeader }
        });

        const productDetails = apiResponse.data;
        const sourceCurrency = productDetails.source.unit;
        const dtOneRates = formatDecimalNumbersWithLimit(productDetails.rates.base, 6);
        const destinationCurrency = productDetails.destination.unit;
        const serviceName = sub_service_id == 11 ? "airtime" : "bundle";

        const feeDetails = await FeeModel.findOne({
            $and: [{ service_name: serviceName }, { account_level: wallet.account.level._id }]
        }).populate('account_level');

        const exchangeRateResponse = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${localWallet.currency.code}&to=${wallet.currency.code}&amount=1&format=1`);
        if (!exchangeRateResponse.data.success) {
            return {
                status: false,
                message: "Exchange Rates not found!"
            };
        }

        const newRate = formatDecimalNumbersWithLimit(parseFloat(exchangeRateResponse.data.info.rate), 6);
        const exchange_rate = localWallet.currency.code !== wallet.currency.code
            ? formatDecimalNumbersWithLimit(newRate - (parseFloat(feeDetails.percentage_markup) / 100) * newRate, 6)
            : newRate;

        const convertedIntoCurrentWallet = formatDecimalNumbersWithLimit(parseFloat(amount) * parseFloat(exchange_rate), 2);
        const localConvertedIntoSource = await convertCurrency(localWallet.currency.code, sourceCurrency, amount);
        const recipientGets = formatDecimalNumbersWithLimit(parseFloat(localConvertedIntoSource) * parseFloat(dtOneRates), 2);

        let fee = 0;
        if (feeDetails.fee_type === 'flat') {
            fee = parseFloat(feeDetails.flat_fee);
            fee = await convertCurrency(feeDetails.fee_currency || 'USD', wallet.currency.code, fee);
        } else {
            fee = formatDecimalNumbersWithLimit(parseFloat(amount) * (parseFloat(feeDetails.percentage_fee) / 100), 2);
        }

        const ratesFromDTOneToCurrent = await convertCurrency(sourceCurrency, wallet.currency.code, 1);
        let topupFee = 0;
        const convertedDTOneFee = formatDecimalNumbersWithLimit(parseFloat(productDetails.prices.wholesale.fee) * parseFloat(ratesFromDTOneToCurrent), 2);

        if (payment_method === 'card') {
            topupFee = parseFloat(await topUpFeeCalculation(wallet, formatDecimalNumbersWithLimit(convertedIntoCurrentWallet + fee + convertedDTOneFee, 2), 'topup_card_payment'));
            fee = formatDecimalNumbersWithLimit(fee + topupFee, 2);
        } else if (payment_method === 'paypal') {
            const paypalFeeDetails = await getPaypalFeeHelper(wallet, convertedIntoCurrentWallet, formatDecimalNumbersWithLimit(convertedIntoCurrentWallet + fee + convertedDTOneFee, 2));
            topupFee = formatDecimalNumbersWithLimit(parseFloat(paypalFeeDetails.fee), 2);
            fee = formatDecimalNumbersWithLimit(fee + topupFee, 2);

            var paypalConverted = formatDecimalNumbersWithLimit(parseFloat(paypalFeeDetails.converted_amount), 2);
            var paypalRate = formatDecimalNumbersWithLimit(parseFloat(paypalFeeDetails.rate), 6);
            var currencySupported = paypalFeeDetails.currencySupported;
        }

        const totalFee = formatDecimalNumbersWithLimit(convertedDTOneFee + fee, 2);

        const response = {
            total: { value: formatDecimalNumbersWithLimit(convertedIntoCurrentWallet + totalFee, 2), currency: wallet.currency.code },
            fee: { value: totalFee, currency: wallet.currency.code },
            sending: { value: convertedIntoCurrentWallet, currency: wallet.currency.code },
            recipient: { value: recipientGets, currency: destinationCurrency },
            feeDetails: {
                fee_type: feeDetails.fee_type,
                fee_currency: feeDetails.fee_currency,
                flat_fee: feeDetails.flat_fee,
                percentage_fee: feeDetails.percentage_fee,
                markup_type: feeDetails.markup_type,
                percentage_markup: feeDetails.percentage_markup,
                actual_rate: exchange_rate,
                rate_after_markup: newRate,
            },
            product_details: {
                id: productDetails.id,
                name: productDetails.name,
                type: productDetails.type,
                destination: productDetails.destination,
                source_currency: sourceCurrency,
                source_amount: localConvertedIntoSource
            },
            ...(payment_method === 'paypal' && {
                paypal: {
                    paypal_converted: { value: paypalConverted || null, currency: "USD" },
                    paypal_rate: { value: paypalRate || null, currency: "USD" },
                    paypal_currency_supported: currencySupported,
                    fee: { value: formatDecimalNumbersWithLimit(topupFee || 0, 2), currency: wallet.currency.code }
                }
            }),
            ...(payment_method === 'wallet' && {
                exchange_rate: { value: exchange_rate, currency: wallet.currency.code }
            })
        };

        const token = jwt.sign(response, secretKey, { expiresIn: '10m' });

        return {
            status: true,
            data: { ...response, token }
        };

    } catch (error) {
        console.error('Error fetching products:', error);
        return {
            status: false,
            message: "Internal server error"
        };
    }
};

async function initiateAirtimePaypalTransactionHelper(data) {
    try {
        const { number, token, wallet_id } = data;

        let decoded;
        try {
            decoded = jwt.verify(token, secretKey);
        } catch (err) {
            return { status: false, message: "Invalid token." };
        }

        const wallet = await Wallet.findOne({
            $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] },
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] },
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] },
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] }
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }]);

        if (!wallet) {
            return { status: false, message: "Wallet not found or inactive." };
        }

        const featureChecked = await featureCheck('topup_channel', 'paypal', wallet.account.level);
        if (!featureChecked) {
            return { status: false, message: "This service is not allowed." };
        }

        const ref = 'tr_' + Date.now().toString();

        const paypalDetails = decoded.paypal;
        const paypalAmount = paypalDetails.paypal_currency_supported ? decoded.total.value : paypalDetails.paypal_converted.value;
        const paypalCurrency = !paypalDetails.paypal_currency_supported ? "USD" : wallet.currency.code;
        const amountInUSD = await getExchangeRatesToUSD(wallet.currency.code, 'USD', decoded.total.value - paypalDetails.fee.value);
        const balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), wallet.account);
        const limitChecked = limitCheck(parseFloat(amountInUSD), wallet.account.level, wallet.account, 'topup');

        if (!limitChecked.status || !balanceLimitChecked) {
            return { status: false, message: limitChecked.status ? "Balance limit exceeded" : limitChecked.code };
        }

        const authResponse = await axios.post(`${paypalUrl}/oauth2/token`, 'grant_type=client_credentials', {
            auth: { username: process.env.PAYPAL_CLIENT_ID, password: process.env.PAYPAL_SECRET }
        });

        const paymentApi = `${paypalUrl}/payments/payment`;
        const cnfg = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authResponse.data.access_token}`,
            },
        };

        const paymentObj = {
            "intent": "sale",
            "payer": { "payment_method": "paypal" },
            "transactions": [
                {
                    "amount": { "total": formatDecimalNumbersWithLimit(paypalAmount, 2).toFixed(2), "currency": paypalCurrency },
                    "description": wallet.account.username,
                    "custom": wallet.wallet_id,
                    "item_list": {
                        "shipping_address": {
                            "recipient_name": `${wallet.account.first_name} ${wallet.account.last_name}`,
                            "line1": `${wallet.account.address || wallet.account.country_iso_code}`,
                            "city": `${wallet.account.city || ""}`,
                            "country_code": `${iso2Countries[wallet.account.country_iso_code] || "CH"}`,
                            "postal_code": `${wallet.account.postal_code || ""}`,
                            "phone": `${wallet.account.phone || ""}`,
                        }
                    }
                }
            ],
            "redirect_urls": {
                "return_url": `https://my.insta-pay.ch/chatbot/paypal-transaction/success/${ref}?flow=airtime_ranged`,
                "cancel_url": `https://my.insta-pay.ch/chatbot/paypal-transaction/failed/${ref}?flow=airtime_ranged`
            }
        };

        const paymentResponse = await axios.post(paymentApi, paymentObj, cnfg);
        if (paymentResponse.data.state !== 'created') {
            return { status: false, message: "Transaction failed during PayPal initiation." };
        }

        const receiverCurrentTime = moment().tz(wallet.account.timezone || "UTC").format();
        const payload = { ...decoded, wallet_id, number };
        const newToken = jwt.sign(payload, secretKey);

        const transaction = await Transaction.create({
            reference_id: ref,
            type: 'instant',
            transaction_type: 'credit',
            service_type: 'topup',
            payment_type: 'paypal',
            status: 'INITIATED',
            description: 'Topup by Paypal',
            currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
            replacement_currency: { code: paypalCurrency, value: formatDecimalNumbersWithLimit(paypalAmount, 2).toFixed(2), rate: paypalDetails.paypal_rate.value },
            amount: decoded.total.value - paypalDetails.fee.value,
            fee: paypalDetails.fee.value,
            total: decoded.total.value,
            wallet_id: wallet.wallet_id,
            wallet: wallet._id,
            account: wallet.account._id,
            receiver: wallet.account._id,
            current_balance: wallet.balance.available,
            hidden: true,
            external_token: { token: newToken, type: "airtime_ranged_bot" },
            notificationNotSent: true,
            timeline: [{ status: 'INITIATED', date: receiverCurrentTime }]
        });

        const approvalLink = paymentResponse.data.links.find(l => l.rel === 'approval_url');
        return {
            status: true,
            message: "Transaction initiated successfully.",
            currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
            transaction_id: transaction._id,
            transaction_ref: transaction.reference_id,
            url: approvalLink ? approvalLink.href : ''
        };

    } catch (err) {
        console.error("Error initiating transaction:", err);
        return { status: false, message: "Internal server error!" };
    }
}

async function initiateAirtimeFixedPaypalTransactionHelper(data) {
    const { number, token, wallet_id } = data;

    let decoded;
    try {
        decoded = jwt.verify(token, secretKey);
    } catch (err) {
        return {
            status: false,
            message: "Invalid token."
        };
    }

    const wallet = await Wallet.findOne({
        $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
            $or: [
                { $and: [{ admin_blocked: false }, { blocked: false }] },
                { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] },
                { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] },
                { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] }
            ]
        }]
    }).populate([{ path: 'account', populate: (['level']) }]);

    const ref = 'tr_' + Date.now().toString();

    // Feature Check
    const featureChecked = await featureCheck('topup_channel', 'paypal', wallet.account.level);
    if (!featureChecked) {
        return {
            status: false,
            message: "This service is not allowed."
        };
    }

    const paypalDetails = decoded.converted.paypal;
    const paypalAmount = paypalDetails.paypal_currency_supported ? decoded.converted.total.value : paypalDetails.paypal_converted.value;
    const paypalCurrency = !paypalDetails.paypal_currency_supported ? "USD" : wallet.currency.code;
    const amountInUSD = await getExchangeRatesToUSD(wallet.currency.code, 'USD', decoded.converted.total.value - paypalDetails.fee.value);

    const balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), wallet.account);
    const limitChecked = limitCheck(parseFloat(amountInUSD), wallet.account.level, wallet.account, 'topup');

    if (!limitChecked.status || !balanceLimitChecked) {
        return { status: false, message: limitChecked.status ? "Balance limit exceeded" : limitChecked.code };
    }

    try {
        const { data: tokenData } = await axios.post(`${paypalUrl}/oauth2/token`, 'grant_type=client_credentials', {
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
                amount: { total: formatDecimalNumbersWithLimit(paypalAmount, 2)?.toFixed(2), currency: paypalCurrency },
                description: wallet.account.username,
                custom: wallet.wallet_id,
                item_list: {
                    shipping_address: {
                        recipient_name: `${wallet.account.first_name} ${wallet.account.last_name}`,
                        line1: `${wallet.account.address || wallet.account.country_iso_code}`,
                        city: wallet.account.city || "",
                        country_code: iso2Countries[wallet.account.country_iso_code] || "CH",
                        postal_code: wallet.account.postal_code || "",
                        phone: wallet.account.phone || ""
                    }
                }
            }],
            redirect_urls: {
                return_url: `https://my.insta-pay.ch/chatbot/paypal-transaction/success/${ref}?flow=airtime_fixed`,
                cancel_url: `https://my.insta-pay.ch/chatbot/paypal-transaction/failed/${ref}?flow=airtime_fixed`
            }
        };

        const { data: paymentData } = await axios.post(paymentApi, paymentObj, {
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenData.access_token}` }
        });

        if (paymentData.state !== 'created') {
            return { status: false, message: "Transaction failed." };
        }

        const newToken = jwt.sign({ ...decoded, wallet_id, number }, secretKey);
        const receiverTransactionObj = {
            reference_id: ref,
            type: 'instant',
            transaction_type: 'credit',
            service_type: 'topup',
            payment_type: 'paypal',
            status: 'INITIATED',
            payment_id: paymentData.id,
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
            external_token: { token: newToken, type: "airtime_fixed_bot" },
            notificationNotSent: true,
            timeline: [{ status: 'INITIATED', date: moment().tz(wallet.account.timezone || "UTC").format() }]
        };

        const transaction = await Transaction.create(receiverTransactionObj);
        const link = paymentData.links.find(l => l.rel === 'approval_url');

        return {
            status: "true",
            message: "Transaction initiated successfully.",
            currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
            transaction_id: transaction._id,
            transaction_ref: transaction.reference_id,
            url: link ? link.href : ''
        };
    } catch (err) {
        console.error(err);
        return { status: "false", message: "Transaction failed.", error: err };
    }
}
module.exports = {
    confirmTransctionRanged,
    createTransactionRangedHelper,
    confirmTransctionFixed,
    createTransactionFixedHelper,
    getItemsFromSubServicesHelper,
    fetchItemDetailsHelper,
    getRatesHelper,
    fetchRangedAirtimeRatesHelper,
    initiateAirtimeFixedPaypalTransactionHelper,
    initiateAirtimePaypalTransactionHelper,
    confirmTransctionESim,
    createTransactionEsimHelper
}