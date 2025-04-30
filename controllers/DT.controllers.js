const axios = require('axios');
require("dotenv").config();
const { encryption, decryption } = require('../configurations/Encryption');
const Wallet = require('../models/Wallet.model');
const Fee = require('../models/Fee.model');
const Transaction = require('../models/Transaction.model');
const User = require('../models/User.model');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { updateUsedLimits, limitCheck } = require('../utils/conversion');
const NotificationsStatusModel = require('../models/NotificationsStatus.model');
const Account = require('../models/Account.model');
const { formatDecimalNumbersWithLimit } = require('../utils/payerRates');
const { topUpFeeCalculation } = require('./Trust-Payment.controller');
const { getPaypalFeeHelper, getActiveWalletById } = require('../utils/helpers');
const { confirmTransctionFixed, confirmTransctionRanged, confirmTransctionESim } = require('../utils/dtOneHelpers');
const { formattedAmount } = require('../utils/InstaChatbotHelpers');
//jwt token key for transaction api
const secretKey = process.env.jwtKey;

// this is for production 
const username = process.env.user; //'5f48f059-efc6-435f-8a2c-28aa15846c96' //process.env.user;
const password = process.env.password; //'ce6e3b99-4211-45a7-9226-1b0fcf51fed0' 
const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

console.log(authHeader, "authHeader")

// this for preprod
const pre_username = process.env.pre_user; //'5f48f059-efc6-435f-8a2c-28aa15846c96' //process.env.user;
const pre_password = process.env.pre_password; //'ce6e3b99-4211-45a7-9226-1b0fcf51fed0' 
const pre_authHeader = `Basic ${Buffer.from(`${pre_username}:${pre_password}`).toString('base64')}`;

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


// TO GENERATE A UNIQUEID ExternalID For Transactions
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





// gets all the countries DTone supports
exports.getCountires = async (req, res) => {
    try {
        //const apiUrl = 'https://preprod-dvs-api.dtone.com/v1/countries';  // preprod 
        const apiUrl = 'https://dvs-api.dtone.com/v1/countries'
        const perPage = 100;
        let currentPage = 1;
        let allCountries = [];

        const makeApiCall = async (page) => {
            const response = await axios.get(apiUrl, {
                params: {
                    page: page,
                    per_page: perPage
                },
                headers: {
                    'Authorization': authHeader
                }
            });

            return response.data;
        };

        // As of now in DTone there are only two total pages for the countries so calling the get api concurrently two times
        const [firstPageData, secondPageData] = await Promise.all([
            makeApiCall(1),
            makeApiCall(2)
        ]);

        allCountries = allCountries.concat(firstPageData, secondPageData);

        const output = await encryption(allCountries);
        res.json(output);

    } catch (error) {
        console.error('Error getting status:', error);

        //returns the error which we get from DTone
        if (error.response && error.response.data && error.response.data.errors) {
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');

            const encryptedError = await encryption(errorMessages);
            res.status(error.response.status).send(encryptedError);
        } else {
            // returns error if there is a problem on our end and not the service
            const encryptedError = await encryption('An error occurred while getting the status');
            res.status(500).send(encryptedError);
        }
    }
};

// CHECKS IF ANY ONE OF THE SERVICES IS AVAILABLE IN A COUNTRY BY CHECKING IF PRODUCTS EXIST FOR ANY OF THE SERVICE OR NOT
// WE CALL THE PRODUCT API AND FILTER IT TO GET THE ID & NAMEOF THE SERVICE 
exports.getServicesByCountry = async (req, res) => {
    try {
        //const apiUrl = 'https://preprod-dvs-api.dtone.com/v1/products';   //pre prod
        const apiUrl = 'https://dvs-api.dtone.com/v1/products'
        const isoCode = req.params.isoCode;
        const perPage = 1;   // ONE SINCE WE ARE USING IT TO JUST CHECK IF A SUBSERVICE EXISTS OR NOT


        // FUNCTION WHICH TAKES SERVICE ID AND MAKES A GET REQUEST USING THE SERVICE ID AND OTHER PARAMETERS PROVIDED IN THE PARAMS
        async function fetchServiceData(serviceId) {
            try {
                const response = await axios.get(apiUrl, {
                    params: {
                        country_iso_code: isoCode,
                        per_page: perPage,
                        service_id: serviceId,
                    },
                    headers: {
                        'Authorization': authHeader,
                    },
                });

                return response.data;
            } catch (error) {
                // ERROR 1003001 MEANS THE SERVICE DOESNT EXIST IN THE COUNTRY AND WE RETURN A NULL VALUE 
                if (error.response && error.response.data && error.response.data.errors) {
                    if (error.response.data.errors.some(err => err.code === 1003001)) {
                        return null;
                    }
                }
                throw error;
            }
        }
        // CONCURRENLTY WE MAKE THREE REQUESTS WITH DIFFERENT SERVICE_IDS       
        const responses = await Promise.all([fetchServiceData(1), fetchServiceData(3), fetchServiceData(4)]);

        //BOOLEAN WHICH CHECKS NULL VALUE
        const allNullResponses = responses.every(response => response === null);

        // MESSAGE IS RETURNED IF ALL VALUES ARE NULL
        if (allNullResponses) {
            const output = await encryption('No Services');
            return res.status(400).json(output);

        }

        // WE FILTER EVERYTHING AND ONLY RETURN THE NAME OF THE SERVICE AND ID FROM THE PRODUCT INFO
        const serviceInfoArray = responses
            .filter(response => response !== null)
            .map(responseData => ({
                id: responseData[0].service.id,
                name: responseData[0].service.name
            }));

        const output = await encryption(serviceInfoArray);
        res.json(output);

    } catch (error) {
        console.error('Error:', error);

        let errorMessage;
        if (error.message) {
            errorMessage = await encryption(error.message);
        } else {
            errorMessage = await encryption('An error occurred while getting the status');
        }

        res.status(500).send({ data: errorMessage });
    }
};

// returns the operator id and name of the number
exports.getMobileNumberDetails = async (req, res) => {
    const number = req.params.number;
    //const apiUrl = `https://preprod-dvs-api.dtone.com/v1/lookup/mobile-number/${number}`;  // pre prod
    const apiUrl = `https://dvs-api.dtone.com/v1/lookup/mobile-number/${number}`;


    try {
        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': authHeader
            }
        });

        const responseData = response.data

        //retruns the object of the identified network only
        const identifiedObjects = responseData.filter(item => item.identified === true);

        const output = await encryption(identifiedObjects)
        res.json(output);


    } catch (error) {
        console.error('Error getting status:', error);

        if (error.response && error.response.data && error.response.data.errors) {
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');

            const encryptedError = await encryption(errorMessages);
            res.status(error.response.status).send(encryptedError);
        } else {
            const encryptedError = await encryption('An error occurred while getting the status');
            res.status(500).send(encryptedError);
        }
    }
};

exports.getMobileNumberDetailsPublic = async (req, res) => {
    const data = await decryption(req.body.data)
    // const data = req.body
    const number = data.number;
    const apiUrl = `https://dvs-api.dtone.com/v1/lookup/mobile-number/${number}`;


    try {
        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': authHeader
            }
        });

        const responseData = response.data

        //retruns the object of the identified network only
        const identifiedObjects = responseData.filter(item => item.identified === true);

        const output = await encryption(identifiedObjects)
        res.json(output);


    } catch (error) {
        console.error('Error getting status:', error);

        if (error.response && error.response.data && error.response.data.errors) {
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');

            const encryptedError = await encryption(errorMessages);
            res.status(error.response.status).send(encryptedError);
        } else {
            const encryptedError = await encryption('An error occurred while getting the status');
            res.status(500).send(encryptedError);
        }
    }
};

// get country operators
exports.getCountryOperators = async (req, res) => {
    const isoCode = req.params.isoCode;

    const apiUrl = `https://dvs-api.dtone.com/v1/operators`;

    try {
        const response = await axios.get(apiUrl,
            {
                params: {
                    country_iso_code: isoCode,
                    per_page: 100,
                    service_id: 1,
                    // subservice_id: subServiceId,
                },
                headers: {
                    'Authorization': authHeader
                }
            });

        const operators = response.data

        const ciphertext = await encryption({
            status: true,
            message: 'Operators fetched successfully',
            data: operators
        });

        res.status(200).send(ciphertext)


    } catch (error) {
        console.error('Error getting status:', error);

        if (error.response && error.response.data && error.response.data.errors) {
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');

            const encryptedError = await encryption(errorMessages);
            res.status(error.response.status).send(encryptedError);
        } else {
            const encryptedError = await encryption('An error occurred while getting the status');
            res.status(500).send(encryptedError);
        }
    }
}

// get country promotions
exports.getCountryPromotions = async (req, res) => {
    const isoCode = req.params.isoCode;

    const apiUrl = `https://dvs-api.dtone.com/v1/promotions`;

    try {
        const response = await axios.get(apiUrl,
            {
                params: {
                    country_iso_code: isoCode,
                    per_page: 100,
                    // product_id: 11322,
                    // service_id: 1,
                    // subservice_id: subServiceId,
                },
                headers: {
                    'Authorization': authHeader
                }
            });

        const operators = response.data

        const ciphertext = await encryption({
            status: true,
            message: 'Promotions fetched successfully',
            data: operators
        });

        res.status(200).send(ciphertext)


    } catch (error) {
        console.error('Error getting status:', error);

        if (error.response && error.response.data && error.response.data.errors) {
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');

            const encryptedError = await encryption(errorMessages);

            res.status(error.response.status).send(encryptedError);
        } else {
            const encryptedError = await encryption('An error occurred while getting the status');
            res.status(500).send(encryptedError);
        }
    }
}

// 

// CHECKS IF ANY ONE OF THE SUB-SERVICES IS AVAILABLE IN A COUNTRY BY CHECKING IF PRODUCTS EXIST FOR ANY OF THE SUB-SERVICE OR NOT
// WE CALL THE PRODUCT API AND FILTER IT TO GET THE ID & NAME OF THE SUBSERVICE 
exports.getSubservices = async (req, res) => {
    try {
        const apiUrl = 'https://dvs-api.dtone.com/v1/products';
        //const apiUrl = 'https://preprod-dvs-api.dtone.com/v1/products';  // pre prod
        const isoCode = req.params.isoCode;
        const operator_id = req.params.operator_id;
        const perPage = 1;     // ONE SINCE WE ARE USING IT TO JUST CHECK IF A SUBSERVICE EXISTS OR NOT
        const serviceId = req.params.serviceId;

        // FUNCTION WHICH TAKES SUB-SERVICE_ID AND MAKES A GET REQUEST USING THE SUB-SERVICE_ID AND OTHER PARAMETERS PROVIDED IN THE PARAMS
        async function fetchSubServiceData(subServiceId) {
            try {
                const response = await axios.get(apiUrl, {
                    params: {
                        country_iso_code: isoCode,
                        operator_id: operator_id,
                        per_page: perPage,
                        service_id: serviceId,
                        subservice_id: subServiceId,
                    },
                    headers: {
                        'Authorization': authHeader,
                    },
                });

                return response.data;

            } catch (error) {
                // ERROR 1003001 MEANS THE SERVICE DOESNT EXIST IN THE COUNTRY AND WE RETURN A NULL VALUE 
                if (error.response && error.response.data && error.response.data.errors) {
                    if (error.response.data.errors.some(err => err.code === 1003001)) {
                        return null;
                    }
                }
                throw error;
            }
        }

        let response = null;



        // CONCURRENLTY WE MAKE THREE REQUESTS WITH DIFFERENT SERVICE_IDS   
        if (serviceId === '1') {
            responses = await Promise.all([fetchSubServiceData(11), fetchSubServiceData(12), fetchSubServiceData(13)]);

        }

        if (serviceId === '3') {
            responses = await Promise.all([fetchSubServiceData(34), fetchSubServiceData(36), fetchSubServiceData(37)]);
        }

        // we check for every subservice of gitcards one by one since we cant make more then 3 requests at a time we get a error for 429 that is too many requests   
        if (serviceId === '4') {
            let allResponses = [];

            let responseOne = await fetchSubServiceData(41);
            allResponses[0] = responseOne

            let responseTwo = await fetchSubServiceData(43);
            allResponses[1] = responseTwo

            let responseThree = await fetchSubServiceData(45);
            allResponses[2] = responseThree

            let responseFour = await fetchSubServiceData(46);
            allResponses[3] = responseFour

            responses = allResponses

            // // old approach of concurrently fetching

            // responsesone = await Promise.all([fetchSubServiceData(41),fetchSubServiceData(43)]);
            // responsestwo = await Promise.all([fetchSubServiceData(45),fetchSubServiceData(46)]);
            // responses = responsesone.concat(responsestwo);

        }

        //BOOLEAN WHICH CHECKS NULL VALUE
        const allNullResponses = responses.every(response => response === null);

        // MESSAGE IS RETURNED IF ALL VALUES ARE NULL
        if (allNullResponses) {
            const output = await encryption('No Sub-Services For This Service_ID');
            return res.status(400).json(output);
        }

        // WE FILTER EVERYTHING AND ONLY RETURN THE NAME OF THE SERVICE AND ID FROM THE PRODUCT INFO
        const subServiceInfoArray = responses
            .filter(response => response !== null)
            .map(responseData => ({
                id: responseData[0].service.subservice.id,
                name: responseData[0].service.subservice.name
            }));

        const output = await encryption(subServiceInfoArray);
        res.json(output);

    } catch (error) {
        console.error('Error getting status:', error);
        // RETURNS THE ERROR WE GET FROM DTONE
        if (error.response && error.response.data && error.response.data.errors) {
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');

            const encryptedError = await encryption(errorMessages);
            res.status(error.response.status).send(encryptedError);
        } else {
            // RETURNS THIS ERROR IF THERE IS A PROBLEM IN OUT CODE 
            const encryptedError = await encryption('An error occurred while getting the status');
            res.status(500).send(encryptedError);
        }
    }
};


// returns all the producsts of the subservices
exports.ProductsOfSubServices = async (req, res) => {
    try {
        const apiUrl = 'https://preprod-dvs-api.dtone.com/v1/products';
        const isoCode = req.params.isoCode;
        //const operator_id = req.params.operator_id;
        const perPage = 100;     // ONE SINCE WE ARE USING IT TO JUST CHECK IF A SUBSERVICE EXISTS OR NOT
        const serviceId = req.params.serviceId;
        //const subservice_id = req.params.subservice_id

        // FUNCTION WHICH TAKES SUB-SERVICE_ID AND MAKES A GET REQUEST USING THE SUB-SERVICE_ID AND OTHER PARAMETERS PROVIDED IN THE PARAMS
        async function fetchSubServiceData(subservice_id) {
            try {
                const response = await axios.get(apiUrl, {
                    params: {
                        country_iso_code: isoCode,
                        //operator_id: operator_id,
                        per_page: perPage,
                        service_id: serviceId,
                        subservice_id: subservice_id,
                    },
                    headers: {
                        'Authorization': authHeader,
                    },
                });

                return response.data;

            } catch (error) {
                // ERROR 1003001 MEANS THE SERVICE DOESNT EXIST IN THE COUNTRY AND WE RETURN A NULL VALUE 
                if (error.response && error.response.data && error.response.data.errors) {
                    if (error.response.data.errors.some(err => err.code === 1003001)) {
                        return null;
                    }
                }
                throw error;
            }
        }

        let response = null;

        // CONCURRENLTY WE MAKE THREE REQUESTS WITH DIFFERENT SERVICE_IDS   
        if (serviceId === '1') {
            responses = await Promise.all([fetchSubServiceData(11), fetchSubServiceData(12), fetchSubServiceData(13)]);
        }

        if (serviceId === '3') {
            responses = await Promise.all([fetchSubServiceData(34), fetchSubServiceData(36), fetchSubServiceData(37)]);
            console.log(responses)
        }

        if (serviceId === '4') {
            responses = await Promise.all([fetchSubServiceData(41), fetchSubServiceData(43), fetchSubServiceData(45), fetchSubServiceData(46)]);

            //responsesone = await Promise.all([fetchSubServiceData(41),fetchSubServiceData(43)]);

            // setTimeout(() => {
            //     console.log("Timeout finished after 3000 milliseconds");
            //   }, 2000);
            // responsestwo = await Promise.all([fetchSubServiceData(45),fetchSubServiceData(46)]);
            // responses = responsesone.concat(responsestwo);


        }


        //BOOLEAN WHICH CHECKS NULL VALUE
        const allNullResponses = responses.every(response => response === null);

        // MESSAGE IS RETURNED IF ALL VALUES ARE NULL
        if (allNullResponses) {
            const output = await encryption('No Sub-Services For This Service_ID');
            return res.status(400).json(output);
        }

        // WE FILTER EVERYTHING AND ONLY RETURN THE NAME OF THE SERVICE AND ID FROM THE PRODUCT INFO
        const subServiceInfoArray = responses
            .filter(response => response !== null)
            .map(responseData => ({
                id: responseData[0].service.subservice.id,
                name: responseData[0].service.subservice.name
            }));

        const output = await encryption(subServiceInfoArray);
        res.json(output);

    } catch (error) {
        console.error('Error getting status:', error);
        // RETURNS THE ERROR WE GET FROM DTONE
        if (error.response && error.response.data && error.response.data.errors) {
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');

            const encryptedError = await encryption(errorMessages);
            res.status(error.response.status).send(encryptedError);
        } else {
            // RETURNS THIS ERROR IF THERE IS A PROBLEM IN OUT CODE 
            const encryptedError = await encryption('An error occurred while getting the status');
            res.status(500).send(encryptedError);
        }
    }
};













//returns products of the sub_services
exports.getProductsofSubservices = async (req, res) => {
    try {

        const requestedData = req.body.data;
        const decryptedData = await decryption(requestedData);
        // const decryptedData = req.body;

        const wallet_id = decryptedData.wallet_id
        const wallet = await Wallet.findOne({ _id: wallet_id });

        let currency = wallet.currency.code

        const apiUrl = `https://dvs-api.dtone.com/v1/products`;
        const isoCode = req.params.isoCode;
        const operator_id = req.params.operator_id;
        const perPage = 100;
        const serviceId = req.params.serviceId;
        const subservice_id = req.params.subservice_id;
        let totalPages = 0

        // hardcoded for now
        const markup_fee = 1;
        const markup_type = 'flat'
        const percentage_markup = 6.5
        const markup_currency = 'USD'
        let markup = 0

        async function fetchProductsByPage(pageNumber) {

            try {
                const response = await axios.get(apiUrl, {
                    params: {
                        country_iso_code: isoCode,
                        operator_id: operator_id,
                        per_page: perPage,
                        service_id: serviceId,
                        subservice_id: subservice_id,
                        page: pageNumber,
                    },
                    headers: {
                        'Authorization': authHeader
                    }
                });

                if (pageNumber == 1) {
                    const paginationHeaders = response.headers;
                    totalPages = parseInt(paginationHeaders['x-total-pages']);
                }

                return response.data;

            } catch (error) {

                if (error.response && error.response.data && error.response.data.errors) {
                    if (error.response.data.errors.some(err => err.code === 1000400)) { // this error is if page doesnt exist
                        return null;
                    }
                }
                throw error;
            }
        }

        async function fetchProductsByPageANDType(pageNumber, type) {
            try {
                const response = await axios.get(apiUrl, {
                    params: {
                        country_iso_code: isoCode,
                        operator_id: operator_id,
                        per_page: perPage,
                        service_id: serviceId,
                        subservice_id: subservice_id,
                        page: pageNumber,
                        type: type
                    },
                    headers: {
                        'Authorization': authHeader
                    }
                });

                if (pageNumber == 1) {
                    const paginationHeaders = response.headers;
                    totalPages = parseInt(paginationHeaders['x-total-pages']);
                }

                return response.data;

            } catch (error) {

                if (error.response && error.response.data && error.response.data.errors) {
                    if (error.response.data.errors.some(err => err.code === 1003001)) { // this error is if Product is not available in our account
                        return null;
                    }
                }
                throw error;
            }
        }
        if (subservice_id == 11) {
            let response = await fetchProductsByPageANDType(1, "RANGED_VALUE_RECHARGE");
            if (response != null) {

                const unitInBenefits = response[0].benefits[0].unit;

                let exchangerate = await convertCurrency(unitInBenefits, currency, 1)
                exchangerate = exchangerate.toFixed(3)

                const products = response.map(item => {
                    const originalMax = item.benefits[0].amount.base.max;
                    const originalMin = item.benefits[0].amount.base.min;

                    const adjustedMax = ((originalMax * 0.98) * exchangerate).toFixed(3)  // decreasing by 2% 
                    const adjustedMin = ((originalMin * 1.02) * exchangerate).toFixed(3)  // increasing by 2% 

                    const extractedItem = {
                        name: item.name,
                        id: item.id,
                        baseAmount: {
                            max: parseFloat(adjustedMax),
                            min: parseFloat(adjustedMin)
                        },
                        unit: currency //item.benefits[0].unit the original curency
                    };

                    return extractedItem;
                });

                //console.log(extractedDataWithAdjustedValues);
                //return  res.json(response);

                const output = await encryption({ products });
                return res.json(output);

            }

        }
        responses = await Promise.all([fetchProductsByPage(1), fetchProductsByPage(2), fetchProductsByPage(3)]);

        const allNullResponses = responses.every(response => response === null);

        // MESSAGE IS RETURNED IF ALL VALUES ARE NULL
        if (allNullResponses) {
            const output = await encryption('No Products');
            return res.status(400).json(output);
        }

        // WE FILTER NULL Values
        const response = responses
            .filter(response => response !== null)

        if (totalPages > 3) {
            for (let pageNumber = 4; pageNumber <= totalPages; pageNumber++) {
                const pageResponse = await fetchProductsByPage(pageNumber);
                if (pageResponse) {
                    response.push(pageResponse);
                    console.log(pageNumber)
                }
            }
        }

        flatarray = response.flat() // easier to fitler if we flat the array


        // getting the unit of the source currency 
        const SourceCurrencyUnit = flatarray[0].source.unit;

        // getting the exchange rate and saving it to use for conversions
        let exchangerate = await convertCurrency(SourceCurrencyUnit, currency, 1)
        exchangerate = exchangerate.toFixed(3)


        //calculating the markup
        if (markup_type === 'flat') {
            if (markup_currency === currency) {
                markup = markup_fee
            } else {
                if (markup_currency === SourceCurrencyUnit) {
                    markup = markup_fee * exchangerate
                }
                else {
                    const exchangeratefee = await convertCurrency(markup_currency, currency, 1)
                    markup = markup_fee * exchangeratefee

                }
            }


        }

        const products = flatarray.map(rechargeOption => {
            const convertedAmount = rechargeOption.prices.retail.amount !== 0
                ? (rechargeOption.prices.retail.amount * exchangerate).toFixed(3)   // if retail price is not 0 then this this
                : (rechargeOption.prices.wholesale.amount * exchangerate).toFixed(3)  //  if retail prive is 0 then this


            if (markup_type === 'percentage') {
                const percentage_markup_amount = (percentage_markup / 100) * convertedAmount;
                markup = percentage_markup_amount;
            }
            //console.log(markup)

            const new_amount = markup + parseFloat(convertedAmount)

            const prices = {
                amount: parseFloat(new_amount),
                unit: currency,
                unit_type: rechargeOption.prices.retail.unit_type
            };

            return {
                id: rechargeOption.id,
                name: rechargeOption.name,
                description: rechargeOption.description,
                prices: prices,
                message: rechargeOption?.pin?.usage_info[0] || ""
            };
        });

        console.log(products, "productsinside")

        const output = await encryption({ products });
        res.json(output);

    } catch (error) {
        if (error.response) {
            const statusCode = error.response.status;
            const errorMessage = error.response.statusText;
            console.error(`Error getting status: ${statusCode} - ${errorMessage}`);

            const err = statusCode + " " + errorMessage
            const encryptedError = await encryption(err);
            res.status(500).send(encryptedError);

        }
        else {
            console.log("error:" + error)
            const encryptedError = await encryption('An error occurred');
            res.status(500).send(encryptedError);
        }


    }
};



// uses product id to return price & fees
exports.getPrice = async (req, res) => {
    try {
        // const decryptedData = req.body;
        const requestedData = req.body.data;
        const decryptedData = await decryption(requestedData);

        const wallet_id = decryptedData.wallet_id
        const avoid_balance = decryptedData.avoid_balance
        const wallet = await Wallet.findOne({ _id: wallet_id }).populate([{ path: 'account', populate: [{ path: 'level' }] }])
        if (!wallet) {
            return res.status(404).json({ message: "Wallet not found" });
        }
        // console.log(wallet)
        const accountLevelId = wallet.account.level._id
        const balance = wallet.balance.available

        const fees = await Fee.findOne({ $and: [{ service_name: "airtime" }, { account_level: wallet.account.level._id }] }).populate('account_level');

        const fee_type = fees.fee_type
        const flat_fee = fees.flat_fee
        const percentage_fee = fees.percentage_fee
        const fee_currency = fees.fee_currency                 // currency of the fee
        const sending_limit = !wallet.account.is_external_limit ? fees.account_level.sending_limit : wallet.account.external_limits.transaction_amount_limit
        const daily_sending_limit = !wallet.account.is_external_limit ? fees.account_level.daily_sending_limit : wallet.account.external_limits.daily_sending_limit
        const monthly_sending_limit = !wallet.account.is_external_limit ? fees.account_level.monthly_sending_limit : wallet.account.external_limits.monthly_sending_limit
        const yearly_sending_limit = !wallet.account.is_external_limit ? fees.account_level.yearly_sending_limit : wallet.account.external_limits.yearly_sending_limit

        console.log({
            fee_type, flat_fee, percentage_fee, fee_currency, sending_limit, daily_sending_limit, monthly_sending_limit, yearly_sending_limit
        })

        const markup_fee = 1;
        // const markup_type = 'flat'
        // const percentage_markup = 6.5
        const markup_currency = 'USD'


        let markup_type = fees?.markup_type;
        let percentage_markup = fees?.percentage_markup;

        console.log({ percentage_markup })

        console.log(markup_type, "markup_type")

        // //console.log(fees);
        //  console.log(fee_type);
        //   console.log(flat_fee);
        //   console.log(percentage_fee);
        //   console.log(fee_currency);
        //   console.log(sending_limit);

        let fee = 0
        let covnerted_fee = 0
        let markup = 0
        let convertedAmount
        let exchangerate_markup
        let exchangeratefee

        let currency = wallet.currency.code // currency of user wallet

        const product_id = req.params.product_id;
        const apiUrl = `https://dvs-api.dtone.com/v1/products/${product_id}`

        // function to make the api call
        const makeApiCall = async () => {
            const response = await axios.get(apiUrl, {
                headers: {
                    'Authorization': authHeader
                }
            });

            return response.data;
        };

        let responseData = await makeApiCall();
        console.log(responseData, responseData.benefits[0].amount, "responseDatainproducts")
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

            console.log("beforefee", fee)
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

            console.log("afterfee", fee)
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

            console.log("aftermarkup", markup)


            // user has selected the fixed airtime product
            if (responseData.type === "FIXED_VALUE_PIN_PURCHASE" || responseData.type === "FIXED_VALUE_RECHARGE") {
                convertedAmount = responseData.prices.retail.amount !== 0
                    ? (responseData.prices.retail.amount * exchangerate).toFixed(3)   // if retail price is not 0 then this this
                    : (responseData.prices.wholesale.amount * exchangerate).toFixed(3)


                let amount = responseData.destination.amount;
                let exchangeTotal;

                if (markup_type === 'percentage') {
                    const percentage_markup_amount = (percentage_markup / 100) * convertedAmount;
                    markup = percentage_markup_amount;
                }

                const new_amount = markup + parseFloat(convertedAmount)

                const prices = {
                    amount: parseFloat(new_amount),
                    unit: currency,
                    unit_type: responseData.prices.retail.unit_type
                };

                if (fee_type === 'percentage') {
                    const percentage_fee_amount = (percentage_fee / 100) * new_amount;
                    fee = percentage_fee_amount;
                }
                total_now = ((convertedDTOneFee + fee) + prices.amount).toFixed(3)
                console.log(new_amount, "new_amount", markup, total_now, "total_now")

                // converting total into USD, to compare it with the limits

                const convertedTotalIntoUsd = await convertCurrency(wallet.currency.code, 'USD', total_now)

                let limitCheck1 = limitCheck(convertedTotalIntoUsd, wallet.account.level, wallet.account, 'sending');
                if (!limitCheck1.status) {
                    const output = await encryption({
                        status: false,
                        code: limitCheck1.code
                    });
                    return res.status(400).json(output);
                }

                // if the exchangeTotal amount is more than the balance then this will be returned 
                if (total_now > balance) {
                    return { status: false, message: `Insufficient Balance, you current balance in this wallet is ${balance}` };
                }

                const response = {
                    id: responseData.id,
                    sending_amount: amount,
                    exchangeAmount: formatDecimalNumbersWithLimit(total_now - markup),
                    unit: currency,
                    fee: formatDecimalNumbersWithLimit(fee + convertedDTOneFee),
                    // fee_type: fee_type,
                    total: formatDecimalNumbersWithLimit(total_now),
                    // markup: markup,
                    name: responseData.name,
                    desc: responseData.description,
                    // operator: responseData.operator,
                    airtimeFixed: true
                }

                const payload = {
                    id: responseData.id,
                    sending_amount: amount,
                    exchangeAmount: formatDecimalNumbersWithLimit(total_now - markup),
                    unit: currency,
                    fee: formatDecimalNumbersWithLimit(fee + convertedDTOneFee),
                    fee_type: fee_type,
                    total: formatDecimalNumbersWithLimit(total_now),
                    markup: markup,
                    markup_currency: markup_currency,
                    exchange_rate: exchangerate,
                    exchange_rate_markup: exchangerate - markup,
                    name: responseData.name,
                    desc: responseData.description,
                    // operator: responseData.operator,
                    airtimeFixed: true
                }
                // const filteredData = extractedDataWithAdjustedValues.map(item => ({
                //     id: item.id, //
                //     name: item.name, //
                //     baseAmount: {
                //         max: item.baseAmount.max,
                //         min: item.baseAmount.min,
                //     },
                //     unit: item.unit, //
                //     sending_amount: item.sending_amount, //
                //     fee: item.fee,
                //     fee_type: item.fee_type,
                //     total: item.total
                // }));
                const token = jwt.sign(payload, secretKey, { expiresIn: '60m' });

                const output = await encryption({ response, token });
                return res.json(output);

            }
            // user has typed an amount to be sent as airtime
            else {

                let amount = decryptedData.amount   // the amount the user wants to send

                if (!amount) {
                    const output = await encryption('amount not given');
                    return res.status(400).json(output);

                }

                let responseDataArray = [responseData]  // objects are being returned, keeping it in a array so filtering is similar to the all the other api outputs


                if (markup_type === 'percentage') {
                    const percentage_markup_amount = (percentage_markup / 100) * parseInt(amount);
                    markup = percentage_markup_amount;

                }

                console.log(markup, "afteraftermarkup")

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



                    const totalAmount = (convertedDTOneFee + fee) + parseFloat(amount);
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
                        total: parseFloat(decryptedData.amount),
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

                    console.log(extractedItem, "extractedItem")
                    return extractedItem;
                });


                const total = extractedDataWithAdjustedValues[0].total

                // converting total into USD, to compare it with the limits
                const convertedTotal = await convertCurrency(currency, 'USD', total)

                console.log(convertedTotal, "convertedTotal", total, "total")

                let limitCheck1 = limitCheck(convertedTotal, wallet.account.level, wallet.account, 'sending');
                if (!limitCheck1.status) {
                    const output = await encryption({
                        status: false,
                        code: limitCheck1.code
                    });
                    return res.status(400).json(output);
                }
                // if the total amount is more than the balance then this will be returned 
                if (!avoid_balance && total > balance) {
                    const output = await encryption(`Insufficient Balance, you current balance in this wallet is ${balance}`);
                    return res.status(400).json(output);

                }

                if (extractedDataWithAdjustedValues[0].sending_amount > extractedDataWithAdjustedValues[0].baseAmount.max) {
                    const output = await encryption(`Amount entered is more than the maximum `);
                    return res.status(400).json(output);

                }

                if (extractedDataWithAdjustedValues[0].sending_amount < extractedDataWithAdjustedValues[0].baseAmount.min) {
                    const output = await encryption(`Amount entered is less than the minimum amount allowed `);
                    return res.status(400).json(output);

                }

                console.log(extractedDataWithAdjustedValues, "extractedDataWithAdjustedValues")


                const filteredData = extractedDataWithAdjustedValues.map(item => ({
                    id: item.id,
                    name: item.name,
                    baseAmount: {
                        max: item.baseAmount.max,
                        min: item.baseAmount.min,
                    },
                    unit: item.unit,
                    sending_amount: item.sending_amount,
                    fee: item.fee,
                    fee_type: item.fee_type,
                    total: formatDecimalNumbersWithLimit(item.total),
                }));

                const payload = {
                    extractedDataWithAdjustedValues
                };
                const token = jwt.sign(payload, secretKey, { expiresIn: '60m' });

                const output = await encryption({ filteredData, token });
                res.json(output);
            }


        }

        // for data and bundle pacakages
        if (sub_service_id != 11) {

            const DT_ONE_FEE = responseData.prices.wholesale.fee
            let convertedDTOneFee
            const source = responseData.source
            const DT_ONE_Currency = source.unit;
            if (DT_ONE_FEE <= 0) {
                convertedDTOneFee = 0
            } else {
                convertedDTOneFee = await convertCurrency(DT_ONE_Currency, currency, DT_ONE_FEE)
            }
            // currency of the service (Dtone)  
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

                console.log(rechargeOption, "rechargeOption")
                convertedAmount = rechargeOption.prices.retail.amount !== 0
                    ? (rechargeOption.prices.retail.amount * exchangerate).toFixed(3)   // if retail price is not 0 then this this
                    : (rechargeOption.prices.wholesale.amount * exchangerate).toFixed(3) //  if retail prive is 0 then this


                if (markup_type === 'percentage') {
                    const percentage_markup_amount = (percentage_markup / 100) * convertedAmount;
                    markup = percentage_markup_amount;
                }

                const new_amount = markup + parseFloat(convertedAmount)
                console.log(new_amount, "new_amount")
                const prices = {
                    amount: parseFloat(new_amount),
                    unit: currency,
                    unit_type: rechargeOption.prices.retail.unit_type
                };

                if (fee_type === 'percentage') {
                    const percentage_fee_amount = (percentage_fee / 100) * new_amount;
                    fee = percentage_fee_amount;
                }
                total_now = ((convertedDTOneFee + fee) + prices.amount).toFixed(3)

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

            // converting total into USD, to compare it with the limits
            const convertedTotal = await convertCurrency(currency, 'USD', total)


            console.log(filteredDataWithCurrency, "filteredDataWithCurrency", convertedTotal)

            let limitCheck1 = limitCheck(convertedTotal, wallet.account.level, wallet.account, 'sending');
            if (!limitCheck1.status) {
                const output = await encryption({
                    status: false,
                    code: limitCheck1.code
                });
                return res.status(400).json(output);
            }

            // if the total amount is more than the balance then this will be returned 
            if (!avoid_balance && total > balance) {
                const output = await encryption(`Insufficient Balance, you current balance in this wallet is ${balance}`);
                return res.status(400).json(output);

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
                total: formatDecimalNumbersWithLimit(item.total),
            }));


            const payload = {
                filteredDataWithCurrency
            };

            const token = jwt.sign(payload, secretKey, { expiresIn: '60m' });

            const output = await encryption({ filteredData, token });
            res.json(output);

        }

    } catch (error) {
        console.error('Error getting status:', error);

        //returns the error which we get from DTone
        if (error.response && error.response.data && error.response.data.errors) {
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');

            const encryptedError = await encryption(errorMessages);
            res.status(error.response.status).send(encryptedError);
        } else {
            // returns error if there is a problem on our end and not the service
            const encryptedError = await encryption('An error occurred while getting the status');
            res.status(500).send(encryptedError);
        }
    }
};















// create a transaction
exports.transactions = async (req, res, next) => {
    try {
        // const decryptedData = req.body.data
        const requestedData = req.body.data;
        const decryptedData = await decryption(requestedData);
        const wallet_id = decryptedData.wallet_id
        const auth_type = decryptedData.type
        console.log(decryptedData, "decryptedData")
        const wallet = await Wallet.findOne({ _id: wallet_id }).populate([{ path: 'account', populate: [{ path: 'level' }] }])
        const accountLevelId = wallet.account.level._id
        const fees = await Fee.findOne({ $and: [{ service_name: "airtime" }, { account_level: wallet.account.level._id }] }).populate('account_level');
        let currency = wallet.currency.code   // the currency of the wallet

        // checking the status of the wallet
        if (wallet.status !== 'active') {
            const output = await encryption('This wallet is not active');
            return res.status(400).json(output);
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
                const encryptedError = await encryption('Token has expired');
                res.status(401).send(encryptedError);
            } else {
                console.error('JWT Verification Error:', jwtError);
                const encryptedError = await encryption('Invalid token');
                res.status(401).send(encryptedError);
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
                const output = await encryption('amount not given');
                return res.status(400).json(output);

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
            if (!limitCheck1.status) {
                const output = await encryption({
                    status: false,
                    code: limitCheck1.code
                });
                return res.status(400).json(output);
            }

            // if the total amount is more than the balance then this will be returned 
            if (total > balance) {
                const output = await encryption(`Insufficient Balance, you current balance in this wallet is ${balance}`);
                return res.status(400).json(output);

            }

            if (extractedDataWithAdjustedValues[0].sending_amount > extractedDataWithAdjustedValues[0].baseAmount.max) {
                const output = await encryption(`Amount entered is more than the maximum`);
                return res.status(400).json(output);

            }

            if (extractedDataWithAdjustedValues[0].sending_amount < extractedDataWithAdjustedValues[0].baseAmount.min) {
                const output = await encryption(`Amount entered is less than the minimum amount allowed `);
                return res.status(400).json(output);

            }

            console.log(extractedDataWithAdjustedValues, "extractedDataWithAdjustedValues")

            const jsonString1 = JSON.stringify(extractedDataWithAdjustedValues);
            const jsonString2 = JSON.stringify(decoded.extractedDataWithAdjustedValues);

            console.log("JSON strings:", jsonString1, jsonString2);

            if (jsonString1 === jsonString2) {
                console.log("The arrays are equal.");

                let converted_amount = await convertCurrency(extractedDataWithAdjustedValues[0].unit, SourceCurrency, extractedDataWithAdjustedValues[0].sending_amount)
                converted_amount = converted_amount.toFixed(3)

                console.log(converted_amount, "converted_amount", SourceCurrency, "SourceCurrency")

                // responseData = await TransactionForAirtime(converted_amount, SourceCurrency)
                responseData = await TransactionForAirtime(extractedDataWithAdjustedValues[0].sending_amount, extractedDataWithAdjustedValues[0].unit)

                //return res.json(responseData)

                transaction_id = responseData.id


                const payload = {
                    data: {
                        Wallet_Id: wallet_id,
                        Transaction_ID: transaction_id,
                        Sub_Service_id: sub_service_id,
                        extractedDataWithAdjustedValues,
                        number
                    },
                    type: auth_type,
                };

                // const token = jwt.sign(payload, secretKey, { expiresIn: '60m' });

                // const output = await encryption({ "token": token });
                // res.json(output);

                const encryptedData = await encryption(payload);
                req.body = encryptedData;

                next();



            } else {
                const error = await encryption({
                    status: false,
                    message: "Rates have changed so please select the product again"
                })
                return res.status(400).send(error)

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
                const output = await encryption({
                    status: false,
                    code: limitCheck1.code
                });
                return res.status(400).json(output);
            }
            // if the total amount is more than the balance then this will be returned 
            if (total > balance) {
                const output = await encryption(`Insufficient Balance, you current balance in this wallet is ${balance}`);
                return res.status(400).json(output);

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
            if (jsonString1 === jsonString2) {
                console.log("The arrays are equal.");

                responseData = await TransactionAPI()

                //res.json(responseData);


                transaction_id = responseData.id

                const payload = {
                    data: {
                        Wallet_Id: wallet_id,
                        Transaction_ID: transaction_id,
                        Sub_Service_id: sub_service_id,
                        filteredDataWithCurrency,
                        number
                    },
                    type: auth_type,
                };

                // const token = jwt.sign(payload, secretKey, { expiresIn: '60m' });

                // const output = await encryption({ "token": token });
                // res.json(output);

                const encryptedData = await encryption(payload);
                req.body = encryptedData;

                next();

            } else {
                const error = await encryption({
                    status: false,
                    message: "Rates have changed so please select the product again"
                })
                return res.status(400).send(error)
            }

        }
    } catch (error) {
        console.error('Error getting status:', error);

        //returns the error which we get from DTone
        if (error.response && error.response.data && error.response.data.errors) {
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');

            const encryptedError = await encryption(errorMessages);
            res.status(error.response.status).send(encryptedError);
        } else {
            // returns error if there is a problem on our end and not the service
            const encryptedError = await encryption('An error occurred while getting the status');
            res.status(500).send(encryptedError);
        }
    }

}


exports.createAirtimeTransactions = async (req, res, next) => {
    const requestedData = req.body.data;
    const decryptedData = await decryption(requestedData);
    // const decryptedData = req.body
    const wallet_id = decryptedData.wallet_id
    const auth_type = decryptedData.type
    const wallet = await Wallet.findOne({ _id: wallet_id }).populate([{ path: 'account', populate: [{ path: 'level' }] }])
    const accountLevelId = wallet.account.level._id
    const fees = await Fee.findOne({ account_level: accountLevelId }).populate('account_level');
    let currency = wallet.currency.code   // the currency of the wallet

    // checking the status of the wallet
    if (wallet.status !== 'active') {
        return { status: false, message: 'This wallet is not active' };

    }



    const number = decryptedData.number
    product_id = decryptedData.product_id

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
    console.log(decoded, "decoed")
    const url = 'https://dvs-api.dtone.com/v1/async/transactions';
    // product_id = decoded.id

    console.log(number, "numbernside")

    let t_id = `${wallet.account._id}_${Date.now()}`

    let externalId = t_id

    const requestBody = {

        external_id: externalId,
        // calculation_mode: "RANGED_VALUE_PIN_PURCHASE",
        // source: {
        //     unit_type: "CURRENCY",
        //     unit: SourceCurrency,
        //     amount: amount_to_send
        // },
        product_id: product_id,
        // auto_confirm: false,
        credit_party_identifier: {
            mobile_number: number
        },
        callback_url: 'https://fontawesomev23.com/api/webhook/dtone-transaction-status',
    }

    console.log(requestBody, "requestBodyinairtime")

    const response = await axios.post(url, requestBody, {
        headers: {
            'Authorization': authHeader,
        },
    });

    console.log(response.data, "response.data")
    // return res.json(response.data);
    if (response.data.status.class.message === "CREATED") {
        const payload = {
            data: {
                transactionID: response.data.id,
                decoded: decoded,
                wallet_id,
                number: number,
            },
            type: auth_type,
        };
        console.log(payload, "payload")

        // const output = await encryption(payload);
        // res.status(200).json(output);

        const encryptedData = await encryption(payload);
        req.body = encryptedData;

        next();
    } else {
        const encryptedError = await encryption('Something went wrong!');
        res.status(500).send(encryptedError);
    }

}


exports.confirmAirtimeTransaction = async (req, res) => {
    try {
        // const decryptedData = req.body;
        // const requestedData = req.body.data;
        // const decryptedData = await decryption(requestedData);

        // const token = decryptedData.token

        const decryptedData = req.body;
        let decoded = decryptedData.decoded
        const wallet = await Wallet.findOne({ _id: decryptedData.wallet_id }).populate([{ path: 'account', populate: [{ path: 'level' }] }])

        console.log(decryptedData, "token")

        const convertedTotal = await convertCurrency(wallet.currency.code, 'USD', decoded.total)

        console.log(convertedTotal, "converted total", decoded.total)

        let limitCheck1 = limitCheck(convertedTotal, wallet.account.level, wallet.account, 'sending');
        if (!limitCheck1.status) {
            const output = await encryption({
                status: false,
                code: limitCheck1.code
            });
            return res.status(400).json(output);
        }

        // if the total amount is more than the balance then this will be returned 
        const balance = wallet.balance.available
        if (decoded.total > balance) {
            const output = await encryption(`Insufficient Balance, your current balance in this wallet is ${balance}`);
            return res.status(400).json(output);

        }


        // try {
        //     decoded = jwt.verify(token, secretKey);
        // }
        // catch (jwtError) {
        //     if (jwtError instanceof jwt.TokenExpiredError) {
        //         return { status: false, message: 'Token has expired' };

        //     } else {
        //         console.error('JWT Verification Error:', jwtError);
        //         return { status: false, message: 'Invalid token' };
        //     }
        // }

        console.log(decoded, "decodeded")
        const transactionId = decryptedData.transactionID

        console.log(transactionId, "transactionId")

        const apiUrl = `https://dvs-api.dtone.com/v1/async/transactions/${transactionId}/confirm`;
        // const apiUrl = `https://preprod-dvs-api.dtone.com/v1/async/transactions/${transactionId}/confirm`

        // let ciphertext = await encryption({
        //     status: true,
        //     message: "Airtime transaction successfully confirmed",
        //     // data: response.data
        // });
        // return res.status(200).send(ciphertext)

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

            const ciphertext = await encryption({
                status: true,
                message: "Transaction Successful",
                type: "PIN",
                type_message: `Follow the instructions received via SMS on ${decryptedData.number} to activate the airtime.`
            })

            return res.status(200).json(ciphertext)

        } else {
            let error = await encryption({
                status: false,
                message: "Transaction failed"
            });
            return res.status(400).send(error);
        }

    }
    catch (error) {
        console.log(error)
        const encryptedError = await encryption('Something went wrong!');
        res.status(500).send(encryptedError);
    }
}




exports.confirmtransaction = async (req, res) => {
    try {
        // const requestedData = req.body.data;
        // const decryptedData = await decryption(requestedData);
        const decryptedData = req.body;
        let decoded = decryptedData

        console.log(decryptedData, "token")

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

        // try {
        //     decoded = jwt.verify(token, secretKey);
        // }
        // catch (jwtError) {
        //     if (jwtError instanceof jwt.TokenExpiredError) {
        //         const encryptedError = await encryption('Token has expired');
        //         res.status(401).send(encryptedError);
        //     } else {
        //         console.error('JWT Verification Error:', jwtError);
        //         const encryptedError = await encryption('Invalid token');
        //         res.status(401).send(encryptedError);
        //     }
        // }
        const Sub_Service_id = decoded.Sub_Service_id
        const Transaction_ID = decoded.Transaction_ID
        console.log(Transaction_ID)
        const wallet_id = decoded.Wallet_Id
        const wallet = await Wallet.findOne({ _id: wallet_id }).populate([{ path: 'account', populate: [{ path: 'level' }] }])
        if (!wallet) {
            return res.status(404).json({ message: "Wallet not found" });
        }

        let currency = wallet.currency.code

        const balance = wallet.balance.available
        const accountLevelId = wallet.account.level._id
        const fees = await Fee.findOne({ $and: [{ service_name: "airtime" }, { account_level: wallet.account.level._id }] }).populate('account_level');


        if (Sub_Service_id == 11) {


            const fee = decoded.extractedDataWithAdjustedValues[0].fee        // the fee we keeping 
            const total = decoded.extractedDataWithAdjustedValues[0].total    // the total amount  

            const convertedTotal = await convertCurrency(currency, 'USD', total)

            console.log(convertedTotal, "converted total", total)

            let limitCheck1 = limitCheck(convertedTotal, wallet.account.level, wallet.account, 'sending');
            if (!limitCheck1.status) {
                const output = await encryption({
                    status: false,
                    code: limitCheck1.code
                });
                return res.status(400).json(output);
            }

            // if the total amount is more than the balance then this will be returned 
            if (total > balance) {
                const output = await encryption(`Insufficient Balance, you current balance in this wallet is ${balance}`);
                return res.status(400).json(output);

            }

            const response = await confirmTransactionForAirtime(Transaction_ID);

            console.log(decoded, "decoded")

            // let response = {
            //     status: {
            //         code: 200,
            //         message: 'CONFIRMED'
            //     }
            // }

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

                const ciphertext = await encryption({
                    status: true,
                    message: "Transaction Successful"
                })

                return res.status(200).json(ciphertext)
            }
            else {
                return res.status(404).json("Transaction Failed");

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
                const output = await encryption({
                    status: false,
                    code: limitCheck1.code
                });
                return res.status(400).json(output);
            }

            // if the total amount is more than the balance then this will be returned 
            if (total > balance) {
                const output = await encryption(`Insufficient Balance, you current balance in this wallet is ${balance}`);
                return res.status(400).json(output);

            }

            const response = await confirmTransaction(Transaction_ID);

            // let response = {
            //     status: {
            //         code: 200,
            //         message: 'CONFIRMED'
            //     }
            // }

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

                const ciphertext = await encryption({
                    status: true,
                    message: "Transaction Successful"
                })

                return res.status(200).json(ciphertext)
            }
            else {
                return res.status(404).json({ message: "Transaction Failed" });

            }
        }

    } catch (error) {
        console.error('Error getting status:', error);

        //returns the error which we get from DTone
        if (error.response && error.response.data && error.response.data.errors) {
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');

            const encryptedError = await encryption(errorMessages);
            res.status(error.response.status).send(encryptedError);
        } else {
            // returns error if there is a problem on our end and not the service
            const encryptedError = await encryption('An error occurred while getting the status');
            res.status(500).send(encryptedError);
        }
    }
}



// NEW APIS
exports.getItemsFromSubServices = async (req, res) => {
    try {

        // const data = req.body;
        const data = await decryption(req.body.data);

        const wallet_id = data.wallet_id;
        const wallet = await Wallet.findOne({ _id: wallet_id });
        const account = await Account.findById(req.user._id).populate('level');

        if (!account || !wallet_id) {
            return res.status(404).json({
                status: false,
                message: "Wallet or account not found!"
            });
        }

        const isoCode = req.params.isoCode;
        const operator_id = req.params.operator_id;
        const serviceId = req.params.serviceId;
        const subservice_id = req.params.subservice_id;
        const perPage = 100;
        const apiUrl = `https://dvs-api.dtone.com/v1/products`;


        let allProducts = [];
        let currentPage = 1;
        let totalPages = 1;

        const exchangeRate = formatDecimalNumbersWithLimit(await convertCurrency("CHF", wallet.currency.code, 1), 6)

        // Fetch products from the external API with pagination
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

        // if airtime (recharge)
        if (subservice_id == 11) {
            // Check if there are items with type RANGED_VALUE_RECHARGE
            const rangedValueRechargeItems = allProducts.filter(product => product.type === "RANGED_VALUE_RECHARGE");
            if (rangedValueRechargeItems.length > 0) {
                fixedProduct = rangedValueRechargeItems[0];
                filteredProducts = {
                    name: fixedProduct.name,
                    id: fixedProduct.id,
                    baseAmount: {
                        max: formatDecimalNumbersWithLimit(fixedProduct.prices.wholesale.amount.max * exchangeRate),
                        min: formatDecimalNumbersWithLimit(fixedProduct.prices.wholesale.amount.min * exchangeRate)
                    },
                    unit: wallet.currency.code,
                    rate: exchangeRate
                }
            } else {
                // filteredProducts = allProducts;
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
        }
        // if bundles (packages)
        else if (subservice_id == 12) {
            // filteredProducts = allProducts;
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

        } else {
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

        // if (subservice_id == 12) {
        //     const result = filteredProducts.map(product => ({
        //         id: product.id,
        //         name: product.name,
        //         description: product.description,
        //         prices: {
        //             amount: product.prices.wholesale.amount,
        //             unit: product.prices.wholesale.unit,
        //             unit_type: product.prices.wholesale.unit_type
        //         },
        //         message: ""
        //     }));

        //     return res.json(result);
        // }

        const ciphertext = await encryption({
            status: true,
            data: filteredProducts
        })

        return res.status(200).send(ciphertext)


    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({
            status: false,
            message: "An error occurred while fetching products.",
            error: error.message
        });
    }
};

exports.fetchItemDetails = async (req, res) => {
    try {
        const productId = req.params.product_id
        const wallet_id = req.params.wallet_id
        const wallet = await Wallet.findOne({ _id: wallet_id });

        const apiUrl = `https://dvs-api.dtone.com/v1/products/${productId}`

        const apiResponse = await axios.get(apiUrl, {
            headers: {
                'Authorization': authHeader
            }
        });

        const productDetails = apiResponse.data

        // return res.json(productDetails)

        const dtRate = productDetails.prices.wholesale.amount
        const dtFee = productDetails.prices.wholesale.fee

        const exchangeRate = formatDecimalNumbersWithLimit(await convertCurrency("CHF", wallet.currency.code, 1), 6)

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
        }

        const token = jwt.sign(payload, secretKey, { expiresIn: '2h' });

        const response = {
            ...payload,
            token
        }

        const ciphertext = await encryption({
            status: false,
            data: response
        })

        return res.status(200).send(ciphertext)

    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({
            status: false,
            message: "An error occurred while fetching products.",
            error: error.message
        });
    }
}

exports.getRates = async (req, res) => {
    try {
        // const data = req.body
        const data = await decryption(req.body.data)
        const { product_id, payment_method, wallet_id, sub_service_id, local_wallet_id, token } = data;

        if (!product_id || !payment_method || !wallet_id || !sub_service_id || !local_wallet_id || !token) {
            const error = await encryption({
                status: false,
                message: "Required fields are missing!"
            });
            return res.status(400).send(error);
        }

        let decoded;
        try {
            decoded = jwt.verify(token, secretKey);
        } catch (err) {
            const error = await encryption({
                status: false,
                message: "Invalid token!"
            });
            return res.status(400).send(error);
        }

        console.log({ decoded })
        const wallet = await Wallet.findById(wallet_id).populate({ path: "account", populate: { path: "level" } });
        const localWallet = await Wallet.findById(local_wallet_id);

        if (!wallet || !localWallet) {
            const error = await encryption({
                status: false,
                message: "Wallet not found!"
            });
            return res.status(404).send(error);
        }

        const serviceName = sub_service_id == 11 ? "airtime" : "bundle";
        const feeDetails = await Fee.findOne({ $and: [{ service_name: serviceName }, { account_level: wallet.account.level._id }] }).populate('account_level');

        const exchangeRateResponse = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${localWallet.currency.code}&to=${wallet.currency.code}&amount=1&format=1`);
        if (!exchangeRateResponse.data.success) {
            const error = await encryption({
                status: false,
                message: "Exchange Rates not found!"
            });
            return res.status(404).send(error);
        }

        const newRate = formatDecimalNumbersWithLimit(exchangeRateResponse.data.info.rate, 6);
        const exchange_rate = localWallet.currency.code !== wallet.currency.code
            ? formatDecimalNumbersWithLimit(newRate - (feeDetails.percentage_markup / 100) * newRate, 6)
            : newRate;

        // FEE CALCULATION
        const convertedAmountFromLocalToCurrent = formatDecimalNumbersWithLimit(decoded.prices.amount * exchange_rate, 2);
        let fee;
        if (feeDetails.fee_type === 'flat') {
            fee = formatDecimalNumbersWithLimit(await convertCurrency(feeDetails.fee_currency || 'USD', wallet.currency.code, feeDetails.flat_fee), 2);
        } else {
            fee = formatDecimalNumbersWithLimit(convertedAmountFromLocalToCurrent * (feeDetails.percentage_fee / 100), 2);
        }

        // Add top-up fee for card payments or paypal
        let topupFee = 0;
        const convertedDTOneFee = formatDecimalNumbersWithLimit(decoded.fee.amount * exchange_rate, 2); // DTOne fee
        if (payment_method === 'card') {
            topupFee = parseFloat(await topUpFeeCalculation(wallet, formatDecimalNumbersWithLimit(convertedAmountFromLocalToCurrent + convertedDTOneFee + fee, 2), 'topup_card_payment'));
            fee += topupFee;
        } else if (payment_method === 'paypal') {
            console.log({ convertedAmountFromLocalToCurrent, convertedDTOneFee, fee })
            const paypalFeeDetails = await getPaypalFeeHelper(wallet, convertedAmountFromLocalToCurrent, formatDecimalNumbersWithLimit(convertedAmountFromLocalToCurrent + fee + convertedDTOneFee, 2));
            console.log({ paypalFeeDetails })
            topupFee = paypalFeeDetails.fee;
            fee += topupFee;
            var paypalConverted = formatDecimalNumbersWithLimit(paypalFeeDetails.converted_amount, 2);
            var paypalRate = formatDecimalNumbersWithLimit(paypalFeeDetails.rate, 6);
            var currencySupported = paypalFeeDetails.currencySupported;
        }

        console.log({ convertedAmountFromLocalToCurrent, convertedDTOneFee, fee })
        const totalAmount = formatDecimalNumbersWithLimit(convertedAmountFromLocalToCurrent + convertedDTOneFee + fee, 2);
        const totalFee = formatDecimalNumbersWithLimit(convertedDTOneFee + fee, 2);

        // console.log({ totalAmount, totalFee, fee, convertedDTOneFee, convertedAmountFromLocalToCurrent, exchange_rate, feee: decoded.fee.amount })

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
                accountId: wallet.account._id
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

        const response1 = {
            ...response,
            token: newToken
        };

        const ciphertext = await encryption({
            status: true,
            data: response1
        });

        return res.status(200).send(ciphertext);

    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).send(await encryption({
            status: false,
            message: "An error occurred while fetching products.",
            error: error.message
        }));
    }
};

exports.createTransction = async (req, res) => {
    try {
        console.log(req.body)
        const { number, token, wallet_id } = req.body;

        if (!number || !token || !wallet_id) {
            const error = await encryption({
                status: false,
                message: "Missing required fields!"
            });
            return res.status(400).send(error);
        }

        const wallet = await Wallet.findById(wallet_id).populate({ path: "account", populate: { path: "level" } });

        if (!wallet) {
            const error = await encryption({
                status: false,
                message: "Wallet not found!"
            });
            return res.status(404).send(error);
        }

        let decoded;
        try {
            decoded = jwt.verify(token, secretKey);
        } catch (err) {
            const error = await encryption({
                status: false,
                message: "Invalid token!"
            });
            return res.status(400).send(error);
        }

        console.log({ decoded })

        // balance check
        if (wallet.balance.available < decoded.converted.total.value) {
            const error = await encryption({
                status: false,
                message: "Insufficient balance!"
            });
            return res.status(400).send(error);
        }

        // limit check
        let sendingAmountInUSD = await convertCurrency(wallet.currency.code, 'USD', decoded.converted.total.value)

        let limitCheck1 = limitCheck(sendingAmountInUSD, wallet.account.level, wallet.account, 'sending');

        if (!limitCheck1.status) {
            const error = await encryption({
                status: false,
                code: limitCheck1.code
            });
            return res.status(400).send(error);
        }

        const url = 'https://dvs-api.dtone.com/v1/async/transactions';

        let t_id = `${wallet.account._id}_${Date.now()}`

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
        }

        console.log({ requestBody })

        axios.post(url, requestBody, {
            headers: {
                'Authorization': authHeader,
            },
        }).then(async (response) => {
            console.log('Transaction created successfully:', response);

            if (response.status === 201) {

                const transctionId = response.data.id

                const data = {
                    wallet,
                    number,
                    decoded,
                    transctionId,
                    t_id
                }
                const confirmTransaction = await confirmTransctionFixed(data)

                if (!confirmTransaction.status) {
                    const error = await encryption({
                        status: false,
                        message: "An error occurred while confirming the transaction.",
                    })
                    return res.status(500).send(error)
                } else {
                    const ciphertext = await encryption({
                        status: true,
                        message: "Transaction confirmed successfully",
                    });
                    return res.status(200).send(ciphertext)
                }
            } else {
                const error = await encryption({
                    status: false,
                    message: "An error occurred while creating transaction.",
                })

                return res.status(500).send(error)
            }
        }).catch(async (error) => {
            console.error('Error creating transaction:', error?.response?.data?.errors || error);
            return res.status(500).send(await encryption({
                status: false,
                message: "An error occurred while creating transaction.",
                error: error.message
            }));
        });


    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).send(await encryption({
            status: false,
            message: "An error occurred while creating transaction.",
            error: error.message
        }));
    }
}

// RANGED AIRTIME
exports.fetchRangedAirtimeRates = async (req, res) => {
    try {
        // const data = req.body;
        const data = await decryption(req.body.data)
        const { product_id, wallet_id, local_wallet_id, amount, sub_service_id, payment_method } = data;

        const wallet = await Wallet.findById(wallet_id).populate({ path: "account", populate: { path: "level" } });
        const localWallet = await Wallet.findById(local_wallet_id);

        const apiUrl = `https://dvs-api.dtone.com/v1/products/${product_id}`
        const apiResponse = await axios.get(apiUrl, {
            headers: { 'Authorization': authHeader }
        });

        const productDetails = apiResponse.data
        const sourceCurrency = productDetails.source.unit
        const dtOneRates = formatDecimalNumbersWithLimit(productDetails.rates.base, 6)
        const destinationCurrency = productDetails.destination.unit
        const serviceName = sub_service_id == 11 ? "airtime" : "bundle";

        const feeDetails = await Fee.findOne({
            $and: [{ service_name: serviceName }, { account_level: wallet.account.level._id }]
        }).populate('account_level');

        const exchangeRateResponse = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${localWallet.currency.code}&to=${wallet.currency.code}&amount=1&format=1`);
        if (!exchangeRateResponse.data.success) {
            const error = await encryption({
                status: false,
                message: "Exchange Rates not found!"
            });
            return res.status(404).send(error);
        }

        const newRate = formatDecimalNumbersWithLimit(parseFloat(exchangeRateResponse.data.info.rate), 6);
        const exchange_rate = localWallet.currency.code !== wallet.currency.code
            ? formatDecimalNumbersWithLimit(newRate - (parseFloat(feeDetails.percentage_markup) / 100) * newRate, 6)
            : newRate;

        const convertedIntoCurrentWallet = formatDecimalNumbersWithLimit(parseFloat(amount) * parseFloat(exchange_rate), 2);
        const localConvertedIntoSource = await convertCurrency(localWallet.currency.code, sourceCurrency, amount);
        const recipientGets = formatDecimalNumbersWithLimit(parseFloat(localConvertedIntoSource) * parseFloat(dtOneRates), 2);

        // Fee calculation
        let fee = 0;
        if (feeDetails.fee_type === 'flat') {
            fee = parseFloat(feeDetails.flat_fee);
            fee = await convertCurrency(feeDetails.fee_currency || 'USD', wallet.currency.code, fee);
        } else {
            fee = formatDecimalNumbersWithLimit(parseFloat(amount) * (parseFloat(feeDetails.percentage_fee) / 100), 2);
        }

        // Rate conversion from DTOne currency to current wallet currency
        const ratesFromDTOneToCurrent = await convertCurrency(sourceCurrency, wallet.currency.code, 1);

        // Top-up fee calculation for card payments or PayPal
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
        }

        const token = jwt.sign(response, secretKey, { expiresIn: '1h' });

        const ciphertext = await encryption({
            status: true,
            data: {
                ...response,
                token
            }
        })

        return res.status(200).send(ciphertext);

    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({
            status: false,
            message: "Internal server error",
        });
    }
}

exports.createTransctionRanged = async (req, res) => {
    try {
        console.log(req.body)
        const { number, token, wallet_id } = req.body;

        if (!number || !token || !wallet_id) {
            const error = await encryption({
                status: false,
                message: "Missing required fields!"
            });
            return res.status(400).send(error);
        }

        const wallet = await Wallet.findById(wallet_id).populate({ path: "account", populate: { path: "level" } });

        if (!wallet) {
            const error = await encryption({
                status: false,
                message: "Wallet not found!"
            });
            return res.status(404).send(error);
        }

        let decoded;
        try {
            decoded = jwt.verify(token, secretKey);
        } catch (err) {
            const error = await encryption({
                status: false,
                message: "Invalid token!"
            });
            return res.status(400).send(error);
        }
        console.log({ decoded })

        // balance check
        if (wallet.balance.available < decoded.total.value) {
            const error = await encryption({
                status: false,
                message: "Insufficient balance!"
            });
            return res.status(400).send(error);
        }

        // limit check
        let sendingAmountInUSD = await convertCurrency(wallet.currency.code, 'USD', decoded.total.value)

        let limitCheck1 = limitCheck(sendingAmountInUSD, wallet.account.level, wallet.account, 'sending');

        if (!limitCheck1.status) {
            const error = await encryption({
                status: false,
                code: limitCheck1.code
            });
            return res.status(400).send(error);
        }

        const productDetails = decoded.product_details

        const url = 'https://dvs-api.dtone.com/v1/async/transactions';

        let t_id = `${wallet.account._id}_${Date.now()}`

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
        }

        console.log({ requestBody })

        axios.post(url, requestBody, {
            headers: {
                'Authorization': authHeader,
            },
        }).then(async (response) => {
            console.log('Transaction created successfully:', response);

            if (response.status === 201) {

                const transctionId = response.data.id

                const data = {
                    wallet,
                    number,
                    decoded,
                    transctionId,
                    t_id
                }

                // return res.json(response.data)
                const confirmTransaction = await confirmTransctionRanged(data)

                if (!confirmTransaction.status) {
                    const error = await encryption({
                        status: false,
                        message: "An error occurred while confirming the transaction.",
                    })
                    return res.status(500).send(error)
                } else {
                    const ciphertext = await encryption({
                        status: true,
                        message: "Transaction confirmed successfully",
                    });
                    return res.status(200).send(ciphertext)
                }
            } else {
                const error = await encryption({
                    status: false,
                    message: "An error occurred while creating transaction.",
                })

                return res.status(500).send(error)
            }
        }).catch(async (error) => {
            console.error('Error creating transaction:', error?.response?.data?.errors || error);
            const err = await encryption({
                status: false,
                message: "An error occurred while creating transaction.",
            })
            return res.status(500).send(err)
        });


    } catch (error) {
        console.error('Error fetching products:', error);
        const err = await encryption({
            status: false,
            message: "Internal server error.",
        })
        res.status(500).send(err)
    }
}

const cleanResponse = (data) => {
    return data.map((item) => ({
        productId: item.id,
        operatorId: item.operator?.id || null,
        name: item.name,
        description: item.description,
        availableZones: item.availability_zones || [],
        operator: item.operator?.name || "N/A",
        country: item.operator?.country?.name || "N/A",
        dataAmount: item.benefits?.[0]?.amount?.base || "N/A",
        dataUnit: item.benefits?.[0]?.unit || "N/A",
        daysValidity: item.validity?.quantity || item.pin?.validity?.quantity || "N/A",
        unitValidity: item.validity?.unit || item.pin?.validity?.unit || "DAY",
        price: formattedAmount(item.destination?.amount) || "N/A",
        currency: item.destination?.unit || "USD",
        wholesalePrice: item.source?.amount || "N/A",
        wholesalePriceUnit: item.source?.unit || "N/A",
        retailPrice: item.prices?.retail || null,
        usageInfo: item.pin?.usage_info || [],
        type: item.type || "N/A",
        service: item.service?.name || "eSIM",
    }));
};

exports.getEsimProducts = async (req, res) => {
    try {
        const { code } = req.query;

        const response = await axios.get("https://dvs-api.dtone.com/v1/products", {
            params: { country_iso_code: code, service_id: '13' },
            headers: {
                'Authorization': authHeader,
            },
        });

        const cleanedOutput = cleanResponse(response.data);

        console.log(response.data[0])

        const ciphertext = await encryption({
            status: true,
            message: "eSIM products fetched successfully.",
            data: cleanedOutput,
        });

        return res.status(200).send(ciphertext);
    } catch (error) {
        console.error("Error fetching eSIM products:", error.response?.data || error.message);
        const err = await encryption({
            status: false,
            message: "Failed to fetch eSIM products.",
        })
        return res.status(500).send(err);
    }
};

exports.confirmEsimTransaction = async (req, res) => {
    try {
        console.log(req.body)
        const { token, wallet_id, number, email } = req.body;

        if (!token || !wallet_id) {
            const error = await encryption({
                status: false,
                message: "Missing required fields!"
            });
            return res.status(400).send(error);
        }

        const wallet = await getActiveWalletById(wallet_id);

        if (!wallet) {
            const error = await encryption({
                status: false,
                message: "Wallet not found!"
            });
            return res.status(404).send(error);
        }


        let decoded;
        try {
            decoded = jwt.verify(token, secretKey);
        } catch (err) {
            const error = await encryption({
                status: false,
                message: "Invalid token!"
            });
            return res.status(400).send(error);
        }

        console.log({ decoded })
        if (req.user._id.toString() !== decoded.converted.feeDetails.accountId) {
            const error = await encryption({
                status: false,
                message: "Unauthorized to confirm this transaction!"
            });
            return res.status(400).send(error);
        }

        // balance check
        if (wallet.balance.available < decoded.converted.total.value) {
            const error = await encryption({
                status: false,
                message: "Insufficient balance!"
            });
            return res.status(400).send(error);
        }

        // limit check
        let sendingAmountInUSD = await convertCurrency(wallet.currency.code, 'USD', decoded.converted.total.value)

        let limitCheck1 = limitCheck(sendingAmountInUSD, wallet.account.level, wallet.account, 'sending');

        if (!limitCheck1.status) {
            const error = await encryption({
                status: false,
                code: limitCheck1.code
            });
            return res.status(400).send(error);
        }

        const url = 'https://dvs-api.dtone.com/v1/async/transactions';

        let t_id = `${wallet.account._id}_${Date.now()}`

        const requestBody = {
            external_id: t_id,
            product_id: decoded.id,
            auto_confirm: false,
            sender: {
                last_name: wallet.account?.last_name || '',
                first_name: wallet.account?.first_name || '',
                mobile_number: number || wallet.account.phone || '',
                email: email || wallet.account?.email || ''
            },
            beneficiary: {
                last_name: wallet.account?.last_name || '',
                first_name: wallet.account?.first_name || '',
                mobile_number: number || wallet.account.phone || '',
                email: email || wallet.account?.email || ''
            },

            callback_url: "https://fontawesomev23.com/api/webhook/dtone-transaction-status"
        }

        console.log({ requestBody })

        axios.post(url, requestBody, {
            headers: {
                'Authorization': authHeader,
            },
        }).then(async (response) => {
            console.log('Transaction created successfully:', response);

            if (response.status === 201) {

                const transctionId = response.data.id

                const data = {
                    wallet,
                    decoded,
                    transctionId,
                    t_id
                }
                const confirmTransaction = await confirmTransctionESim(data)

                if (!confirmTransaction.status) {
                    const error = await encryption({
                        status: false,
                        message: "An error occurred while confirming the transaction.",
                    })
                    return res.status(500).send(error)
                } else {
                    const ciphertext = await encryption({
                        status: true,
                        message: "Transaction confirmed successfully",
                        data: confirmTransaction.response
                    });
                    return res.status(200).send(ciphertext)
                }
            } else {
                const error = await encryption({
                    status: false,
                    message: "An error occurred while creating transaction.",
                })

                return res.status(500).send(error)
            }
        }).catch(async (error) => {
            console.error('Error creating transaction:', error?.response?.data?.errors || error);
            return res.status(500).send(await encryption({
                status: false,
                message: "An error occurred while creating transaction.",
                error: error.message
            }));
        });


    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).send(await encryption({
            status: false,
            message: "An error occurred while creating transaction.",
            error: error.message
        }));
    }
}
