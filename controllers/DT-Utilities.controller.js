const axios = require('axios');
require("dotenv").config();
const Wallet = require('../models/Wallet.model');
const { encryption, decryption } = require('../configurations/Encryption');
const Fee = require('../models/Fee.model');


// this is for production 
const username = process.env.user; //'5f48f059-efc6-435f-8a2c-28aa15846c96' //process.env.user;
const password = process.env.password; //'ce6e3b99-4211-45a7-9226-1b0fcf51fed0' 
const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

// this for preprod
const pre_username = process.env.pre_user; //'5f48f059-efc6-435f-8a2c-28aa15846c96' //process.env.user;
const pre_password = process.env.pre_password; //'ce6e3b99-4211-45a7-9226-1b0fcf51fed0' 
const pre_authHeader = `Basic ${Buffer.from(`${pre_username}:${pre_password}`).toString('base64')}`;

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
  
  
// CHECKS IF ANY ONE OF THE SUB-SERVICES IS AVAILABLE IN A COUNTRY BY CHECKING IF PRODUCTS EXIST FOR ANY OF THE SUB-SERVICE OR NOT
// WE CALL THE DT-ONE PRODUCT API AND FILTER IT TO GET THE ID & NAME OF THE SUBSERVICE 
exports.getSubservices = async (req, res) => {
    try {        
        const apiUrl = 'https://dvs-api.dtone.com/v1/products';
        const isoCode = req.params.isoCode;
        const perPage = 1;        // ONE SINCE WE ARE USING IT TO JUST CHECK IF A SUBSERVICE EXISTS OR NOT
        const serviceId = 3; 

// FUNCTION WHICH TAKES SUB-SERVICE_ID AND MAKES A GET REQUEST USING THE SUB-SERVICE_ID AND OTHER PARAMETERS PROVIDED IN THE PARAMS
        async function fetchSubServiceData(subServiceId) {
            try {
                const response = await axios.get(apiUrl, {
                    params: {
                        country_iso_code : isoCode,
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

 // CONCURRENLTY WE MAKE THREE REQUESTS WITH DIFFERENT SUB_SERVICE_IDS   
 let responses = await Promise.all([fetchSubServiceData(32),fetchSubServiceData(31),fetchSubServiceData(33),fetchSubServiceData(34),fetchSubServiceData(35),fetchSubServiceData(36),fetchSubServiceData(37)]);

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
           const encryptedError = await encryption('An error occurred while getting the status');
           res.status(500).send(encryptedError);
       
   }
};





//returns products of the sub_services
exports.getProductsofSubservices = async (req, res) => {
    try { 
      const requestedData = req.body.data; 
      const decryptedData = await decryption(requestedData);

      const wallet_id= decryptedData.wallet_id
      const wallet = await Wallet.findOne({ _id: wallet_id }).populate('account')
      const wallet_currency = wallet.currency.code
      
    const apiUrl = `https://dvs-api.dtone.com/v1/products`;
    const isoCode = req.params.isoCode;
    const subservice_id = '32'//req.params.subservice_id;
    let totalPages = 0
    let ranged_products_exist =true

  // hardcoded for now
  const markup_fee = 1;
  const markup_type='flat'
  const percentage_markup=6.5
  const markup_currency='USD'

  const accountLevelId=wallet.account.level._id
  const fees = await Fee.findOne({ account_level: accountLevelId }).populate('account_level');

  const fee_type = fees.fee_type
  const flat_fee = fees.flat_fee
  const percentage_fee = fees.percentage_fee
  console.log(percentage_fee)
  const fee_currency = fees.fee_currency                 // currency of the fee
  const sending_limit = fees.account_level.sending_limit
  const daily_sending_limit = fees.account_level.daily_sending_limit
  const monthly_sending_limit = fees.account_level.monthly_sending_limit
  const yearly_sending_limit = fees.account_level.yearly_sending_limit

async function rangedtypeproducts(){

async function fetchProductsByPage(pageNumber) {  
        try {
          const response = await axios.get(apiUrl, {
            params: {
              country_iso_code: isoCode,
              per_page: 100,
              service_id: 3,
              subservice_id: subservice_id,
              page: pageNumber,
              type:'RANGED_VALUE_PAYMENT'
            },
            headers: {
              'Authorization': authHeader 
            }
          });

          if(pageNumber == 1){
            const paginationHeaders = response.headers;
             totalPages = parseInt(paginationHeaders['x-total-pages']);
          }
          return response.data;
      
        } catch (error) {
            
                           if (error.response && error.response.data && error.response.data.errors) {
                                if (error.response.data.errors.some(err => err.code === 1000400)) { // this error is if page doesnt exist
                                    return null;
                                }
                                if (error.response.data.errors.some(err => err.code === 1003001)) { // if subservice_product is not available in the country
                                    return null;
                                }
                            }
                            //throw error;
                        }
      }
      // concurrently fetching the products fo different pages
      let responses = await Promise.all([fetchProductsByPage(1),fetchProductsByPage(2)]);    
      const allNullResponses = responses.every(response => response === null);

      // MESSAGE IS RETURNED IF ALL VALUES ARE NULL
      if (allNullResponses) {
          const output = await encryption('No Products');
          ranged_products_exist=false;
          fixed_products()
          //return res.status(400).json(output);
        }

        if(ranged_products_exist){
        // WE FILTER NULL Values
        const response = responses
            .filter(response => response !== null)

// most products dont need more then 2 pages but if they do so i am using this, i havent added more request in the Promise.all function since we have limited number of requests
            if (totalPages > 2) {
                for (let pageNumber = 3; pageNumber <= totalPages; pageNumber++) {
                  const pageResponse = await fetchProductsByPage(pageNumber);
                  if (pageResponse) {
                    response.push(pageResponse);
                  }
                }
              }
              
             flatarray=response.flat() // easier to fitler if we flat the array

             // getting the curency fo the source and getting the exchange rate 
             console.log(flatarray)
             const product_currency = flatarray[0].benefits[0].unit;
             console.log(product_currency)
             let exchangerate_product_to_wallet= await convertCurrency(product_currency,wallet_currency,1)
             exchangerate_product_to_wallet= exchangerate_product_to_wallet
             console.log(exchangerate_product_to_wallet)

const products = flatarray.map(item => {
    const originalMax = item.benefits[0].amount.base.max;
    const originalMin = item.benefits[0].amount.base.min;

    const adjustedMax = (originalMax*exchangerate_product_to_wallet)  
    const adjustedMin = (originalMin*exchangerate_product_to_wallet)
  
    const extractedItem = {
      name: item.name,
      description: item.description,
      id: item.id,
      baseAmount: {
        max: parseFloat(adjustedMax),
        min: parseFloat(adjustedMin)
      },
      unit: wallet_currency // replacing with the wallet currency // item.benefits[0].unit 
    };
    
    return extractedItem;
  });

     const output = await encryption({products});
      res.json(output);

}
 }

async function fixed_products(){
async function fetchProductsByPageWithoutType(pageNumber) {
  try {
    const response = await axios.get(apiUrl, {
      params: {
        country_iso_code: isoCode,
        per_page: 100,
        service_id: 3,
        subservice_id: '32',//subservice_id,
        page: pageNumber,
      },
      headers: {
        'Authorization': authHeader 
      }
    });

    if (pageNumber === 1) {
      const paginationHeaders = response.headers;
      totalPages = parseInt(paginationHeaders['x-total-pages']);
    }
    return response.data;

  } catch (error) {
    if (error.response && error.response.data && error.response.data.errors) {
      if (error.response.data.errors.some(err => err.code === 1000400)) {
        return null;
      }
      if (error.response.data.errors.some(err => err.code === 1003001)) {
        return null;
      }
    }
    // Handle other errors here if needed
    throw error;
  }
}

     let responsesTwo = await Promise.all([fetchProductsByPageWithoutType(1),fetchProductsByPageWithoutType(2)]);   

       // WE FILTER NULL Values
        responsesTwo = responsesTwo.filter(response => response !== null)

        // most products dont need more then 2 pages but if they do so i am using this, i havent added more request in the Promise.all function since we have limited number of requests
        if (totalPages > 2) {
          for (let pageNumber = 3; pageNumber <= totalPages; pageNumber++) {
            const pageResponse = await fetchProductsByPage(pageNumber);
            if (pageResponse) {
              responsesTwo.push(pageResponse);
            }
          }
        }
        
       flatarray=responsesTwo.flat()  // easier to fitler if we flat the array

       console.log(flatarray)

       const dtone_currency=flatarray[0].source.unit
       let exchangerate_dtone_currency_to_wallet=1
       if(dtone_currency !== wallet_currency ){
       exchangerate_dtone_currency_to_wallet= parseFloat((await convertCurrency(dtone_currency,wallet_currency,1)).toFixed(2))
       }

       let markup=0
    //calculating the markup
    if(markup_type=== 'flat'){
      if(markup_currency===wallet_currency){
          markup = markup_fee
      } else{
      if(markup_currency===dtone_currency){
          exchangerate_markup=exchangerate_dtone_currency_to_wallet
          markup=markup_fee*exchangerate_markup
          }
          else{
              exchangerate_markup = await convertCurrency(markup_currency,wallet_currency,1)
              markup=markup_fee*exchangerate_markup
          }
      }       
  }

  markup=await calculateMarkup(markup_type, markup_currency, wallet_currency, dtone_currency, markup_fee, exchangerate_dtone_currency_to_wallet)
  let fee= await calculateFee(fee_type, fee_currency, flat_fee,percentage_fee, dtone_currency, exchangerate_dtone_currency_to_wallet, wallet_currency)
        const filteredData = flatarray.map(item => {
        const converted_amount = parseFloat((item.source.amount * exchangerate_dtone_currency_to_wallet).toFixed(2));

       if(markup_type === 'percentage') {
          const percentage_markup_amount = (percentage_markup / 100) * converted_amount;
          markup = parseFloat(percentage_markup_amount.toFixed(2));
      }

      if (fee_type === 'percentage') { 
            const percentageFeeAmount = (percentage_fee/ 100) * converted_amount;
            fee = percentageFeeAmount;
        }

    total= parseFloat((converted_amount + markup + fee).toFixed(2))
        return {
            id: item.id,
            name: item.name,
            description: item.description,
            benefits: {
                total_excluding_tax: item.benefits[0].amount.total_excluding_tax,
                total_including_tax: item.benefits[0].amount.total_including_tax,
                unit: item.benefits[0].unit
            },
            operator: {
                id: item.operator.id,
                name: item.operator.name
            },
            source: {
            //  source_amount:item.source.amount,          // just fro testing , so its easier to see all values,fees,markup
            //  sourve_amount_currency:dtone_currency,
            //  amout_without_markup:converted_amount,
            //  markup:markup,
                amount: parseFloat((converted_amount + markup).toFixed(2)),
                unit: wallet_currency,
                fee:fee,
                total:total
            },
            type: item.type
        };
    });


async function calculateMarkup(markup_type, markup_currency, wallet_currency, dtone_currency, markup_fee, exchangerate_dtone_currency_to_wallet) {
  let markup = 0;

  if (markup_type === 'flat') {
    if (markup_currency === wallet_currency) {
      markup = markup_fee;
    } else {
      if (markup_currency === dtone_currency) {
        exchangerate_markup = exchangerate_dtone_currency_to_wallet;
        markup = markup_fee * exchangerate_markup;
      } else {
        exchangerate_markup = await convertCurrency(markup_currency, wallet_currency, 1);
        markup = markup_fee * exchangerate_markup;
      }
    }
  }

  return markup;
}


    async function calculateFee(fee_type, fee_currency, flat_fee,percentage_fee, dtone_currency, exchangerate_dtone_currency_to_wallet, wallet_currency) {
      let fee = 0;
      
      if (fee_type === 'flat') {
          if (fee_currency === wallet_currency) {
              fee = flat_fee;
          } else {
              if (fee_currency === dtone_currency) {
                  const exchangerateFee = exchangerate_dtone_currency_to_wallet;
                  fee = flat_fee * exchangerateFee;
              } else {
                  const exchangerateFee = await convertCurrency(fee_currency, wallet_currency, 1);
                  fee = flat_fee * exchangerateFee;
              }
          }
       } 
      
      return fee;
  }

       return res.json(filteredData);
}

rangedtypeproducts()
  
    } catch (error) {
            console.log("error:" + error)
            const encryptedError = await encryption('An error occurred');
            res.status(500).send(encryptedError);
          }
        

}
   

// statement api
exports.statemnet_inquiry = async (req, res) => {
  const apiUrl = 'https://dvs-api.dtone.com/v1/lookup/statement-inquiry';

  const requestedData = req.body.data; 
  const decryptedData = await decryption(requestedData);

  const { product_id, account_number } = decryptedData

//api doesnt work so i am just putting the response as sent in the pdf file
    // const requestData = {
    //   product_id: product_id,
    //   account_number: account_number,
    // };
    // try {
    //   console.log('Sending request with data:', requestData);
    
    //   const response = await axios.post(apiUrl, requestData, {
    //     headers: {
    //       'Authorization': authHeader
    //     },
    //   });
    
    //   console.log('Response received:', response.data);

    try{
    response=[
      {
      "balance": {
      "amount": 2.6,
      "unit": "USD",
      "unit_type":
     "CURRENCY"
      },
      "dates": {
      "statement":
     "2021-07-19"
      },
      "reference": "CARLOS MESIAS AGUDO"
      }
     ]
    
      const statements = response;
      res.json(statements);
    
    } catch (error) {
      console.error("Error inquiring statements:", error);
      const encryptedError = await encryption('An error occurred');
      res.status(500).send(encryptedError);
    }
};

  

// transaction 
exports.createTransaction = async (req, res) => {

    const requestedData = req.body.data; 
    const decryptedData = await decryption(requestedData);

    const product_id= decryptedData.product_id
    const account_number= decryptedData.account_number
    const amount = decryptedData.amount

    const wallet_id= decryptedData.wallet_id
    const wallet = await Wallet.findOne({ _id: wallet_id });
    const wallet_currency = wallet.currency.code

    const external_id = generateUniqueID();

        try {
          const transactionData = {
            external_id: external_id,
            product_id: product_id,
            auto_confirm: false,
            calculation_mode:"SOURCE_AMOUNT",
            source: {
                unit_type: 'CURRENCY',
                unit: 'CHF',
                amount:amount
            },
            credit_party_identifier: {
            account_number: account_number
            }
          }
          
          const apiUrl = 'https://dvs-api.dtone.com/v1/async/transactions';

        const response = await axios.post(apiUrl, transactionData, {
            headers: {
                'Authorization': authHeader // Replace with your actual header
            }
        });          

          const output = await encryption(response.data);
          res.json(output);

        } catch (error) {
            console.log("error:" + error)
            const encryptedError = await encryption('An error occurred');
            res.status(500).send(encryptedError);
        }


}