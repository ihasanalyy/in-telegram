const qrCode = require('qrcode-reader');
const Jimp = require('jimp');
const fs = require('fs').promises;
const jsQR = require('jsqr');
// const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const mime = require('mime-types');
const CryptoJS = require("crypto-js");
const countryData = require('country-data');
const stringSimilarity = require('string-similarity');
const jwt = require('jsonwebtoken');
const shortid = require('shortid');
const moment = require('moment');
const momenttz = require('moment-timezone');

const AvailableCurrency = require("../models/Available-Currency.model");
const RequestedCurrency = require('../models/Requested-Currency.model');
const Fee = require('../models/Fee.model');
const Wallet = require('../models/Wallet.model');
const Transaction = require('../models/Transaction.model');
const Schedule = require('../models/Schedule.model');
const User = require('../models/User.model');
const Beneficiary = require('../models/Beneficiary.model');
const Account = require('../models/Account.model');
const RequestPayment = require('../models/Request-Payment.model');
const RequestReview = require('../models/RequestReview.model');
const Quotation = require('../models/Quotation.model');
const ReceiverFee = require("../models/ReceiverFee.model");
const Withdrawal = require('../models/User-Withdrawal.model');

const { addNotificationAdmin, addNotification } = require("./generateNotification");
const { sendPrivateMessage } = require('./websocket');
const { sendNotifications } = require('./sendEmail');
// const { createQuotationHelper } = require('./helpers')

const AWS = require('aws-sdk');
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();
const multer = require('multer');
const { featureCheck, limitCheck, updateUsedLimits, processExchangeRates } = require('./conversion');
const { thunesBalance, formatDecimalNumbersWithLimit } = require('./payerRates');
const CountryModel = require('../models/Country.model');
const { userInstaInfo, sendTemplate, fetchCountriesFromThunes, balanceLimitCheck } = require('./instaChatbotUtils');
const CommissionModel = require('../models/Commission.model');
const { sendSMSTemplate, calculateExchangeAndFees, logError, getCountryName, calculateAge, generateUniqueInteger, getTemplateId, whatsappMessageHelper } = require('./helpers');
const { createWallet } = require('../controllers/Requested-Currency.controller');
const TelegramBotModel = require('../models/TelegramBot.model');
const storage = multer.memoryStorage();
module.exports.uploadCheck = multer({ storage: storage });
module.exports.uploadDocumentsCheck = multer({
    storage,
    limits: { fileSize: 2000000 },
});

const currencyToEmoji = require('../utils/currencyEmojis.json');
const lang = require('../utils/languages/languages.json');
const loginHistory = require('../models/Login-History.model');

// const Thunes_KEY = process.env.APIKEY;
// const Thunes_SECRET = process.env.APISECRET;
const Thunes_KEY = process.env.API_KEY_PROD;
const Thunes_SECRET = process.env.API_SECRET_PROD;

const authHeadersThunes = `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`;
const productionUrl = process.env.THUNES_PROD_URL
// const sandboxUrl = 'https://api-mt.pre.thunes.com'
const sandboxUrl = process.env.THUNES_PROD_URL
//jwt token key 
const secretKey = process.env.jwtKey;
const username = process.env.user; //'5f48f059-efc6-435f-8a2c-28aa15846c96' //process.env.user;
const password = process.env.password; //'ce6e3b99-4211-45a7-9226-1b0fcf51fed0' 
const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`

// this for preprod
const pre_username = '5f48f059-efc6-435f-8a2c-28aa15846c96' //process.env.pre_user; //'5f48f059-efc6-435f-8a2c-28aa15846c96' //process.env.user;
const pre_password = 'ce6e3b99-4211-45a7-9226-1b0fcf51fed0' //process.env.pre_password; //'ce6e3b99-4211-45a7-9226-1b0fcf51fed0' 
const pre_authHeader = `Basic ${Buffer.from(`${pre_username}:${pre_password}`).toString('base64')}`;

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const apiTelegramUrl = `https://api.telegram.org/bot${telegramToken}`;


async function uploadToS3(documentType, user_id, files) {
    const uploadedFiles = [];
    const bucketName = process.env.AWS_BUCKET_NAME;

    for (const file of files) {
        try {
            console.log("Downloading file:", file.payload.url);
            const response = await axios.get(file.payload.url, { responseType: 'arraybuffer' });

            let fileExtension = 'jpg';

            if (file.type === 'video') {
                fileExtension = 'mp4';
            }

            // 25 MB = 25 * 1024 * 1024 bytes
            if (file.type === "video" && response.data.byteLength > 25 * 1024 * 1024) {
                console.error("Video file is too large:", file.payload.url);
                return { status: false, message: "It looks like the video file you are trying to upload exceeds the maximum authorized size of 25MB. Please upload a smaller video file or reduce the file size and try again." };
            }

            const params = {
                Bucket: bucketName,
                Key: `${documentType}/${user_id}/${Date.now()}-${Math.floor(Math.random() * 100000)}.${fileExtension}`,
                Body: response.data
            };
            const uploadResult = await s3.upload(params).promise();

            if (uploadResult?.Key) {
                console.log("File uploaded successfully:", uploadResult.Location);
                uploadedFiles.push({
                    key: uploadResult.Key,
                    url: uploadResult.Location,
                    ETag: uploadResult.ETag
                });
            }
        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.error("File not found:", file.payload.url);
            } else {
                console.error("Error uploading file to S3:", error);
            }

            return { status: false, message: "Something went wrong while uploading the files, please try again!" };
        }
    }

    return { status: true, uploadedFiles };
}

// async function uploadToS3(documentType, user_id, files) {
//     const uploadedFiles = [];
//     const bucketName = process.env.AWS_BUCKET_NAME;

//     for (const file of files) {
//         const extension = file.type === "video" ? "mp4" : "jpg";
//         const key = `${documentType}/${user_id}/${Date.now()}-${Math.floor(Math.random() * 100000)}.${extension}`;
//         const params = {
//             Bucket: bucketName,
//             Key: key,
//             Body: null
//         };

//         try {
//             console.log("Downloading file:", file.payload.url);
//             const response = await axios.get(file.payload.url, { responseType: 'arraybuffer' });
//             params.Body = response.data;

//             const uploadResult = await s3.upload(params).promise();

//             if (uploadResult?.Key) {
//                 console.log("File uploaded successfully:", uploadResult.Location);
//                 uploadedFiles.push({
//                     key: uploadResult.Key,
//                     url: uploadResult.Location,
//                     ETag: uploadResult.ETag
//                 });
//             }
//         } catch (error) {
//             if (error.response && error.response.status === 404) {
//                 console.error("File not found:", file.payload.url);
//             } else {
//                 console.error("Error uploading file to S3:", error);
//             }

//             // Attempt to delete the file if it was partially uploaded
//             try {
//                 await s3.deleteObject({ Bucket: bucketName, Key: key }).promise();
//                 console.log("Partially uploaded file deleted:", key);
//             } catch (deleteError) {
//                 console.error("Error deleting partially uploaded file:", deleteError);
//             }

//             return { status: false, message: "Something went wrong while uploading the files, please try again!" };
//         }
//     }

//     return { status: true, uploadedFiles };
// }

function formattedAmount(amount, limit = 2) {
    try {
        if (!amount) {
            return "0.00"
        }
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


// QR PAY Related functions //
async function downloadImage(url, filename) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        await fs.writeFile(filename, response.data);
        console.log('Image downloaded successfully!');
    } catch (err) {
        console.error('Error downloading image:', err);
        throw err;
    }
}

function extractLastStringFromURL(url) {
    const parts = url.split("q/");
    console.log(parts, "parts", parts[1]);
    // const lastString = parts[parts.length - 1];
    return parts[1];
}

async function readQRCodeFromFile(imagePath) {
    try {
        const image = await Jimp.read(imagePath);
        const { data, width, height } = image.bitmap;

        const qrCode = jsQR(data, width, height);
        if (qrCode) {
            return qrCode.data;
        } else {
            throw new Error('QR code not found');
        }
    } catch (err) {
        console.error('Error processing image:', err);
        throw err;
    }
}

async function verifyQrCode(url) {
    const timestamp = Date.now().toString(36);
    const randomString = Math.random().toString(36).substring(2, 8);
    const uniquePath = `utils/qrcodes/${timestamp}${randomString}.jpg`;

    try {
        await downloadImage(url, uniquePath);

        const qrCodeResult = await readQRCodeFromFile(uniquePath);
        const walletID = extractLastStringFromURL(qrCodeResult);
        // const decryptedBytes = CryptoJS.AES.decrypt(token, "QRCodeEncryption");
        // const decryptedWalletID = decryptedBytes.toString(CryptoJS.enc.Utf8);

        console.log('QR Code Decoded:', qrCodeResult);
        console.log('Decrypted Wallet ID:', walletID);

        await fs.unlink(uniquePath);
        console.log(`File ${uniquePath} has been deleted.`);

        return {
            status: true,
            walletId: walletID,
        };
    } catch (error) {
        console.error('Error reading QR code:', error);
        try {
            await fs.access(uniquePath);
            await fs.unlink(uniquePath);
            console.log(`File ${uniquePath} has been deleted.`);
        } catch (fsError) {
            console.error(`Error deleting file ${uniquePath}:`, fsError);
        }
        return {
            status: false,
            message: "Invalid QR Code",
        };
    }
}

// Transaction related functions //

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

async function exchangeRateApi(from, to, amount = 12, level_id, type) {
    try {
        console.log(from, to, amount, level_id, type)
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
        return err;
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
            let new_amount = amount / markupReceived.exchange_rate_markup
            new_amount = new_amount + feeExchange

            console.log(markupReceived, "markupReceived", feeReceived, "feeReceived", new_amount, amount, markupReceived.exchange_rate_markup, feeExchange);


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

// Request new currency related functions //
async function availableCurrencies() {
    const currencies = await AvailableCurrency.find();
    return currencies;
}

async function requestCurrency(account, currency) {
    try {
        const availableCurrency = await AvailableCurrency.findOne({ code: currency });

        if (!availableCurrency) {
            return {
                status: false,
                message: "Requested currency is not available!"
            };
        } else {
            const existingRequest = await RequestedCurrency.findOne({
                account: account._id,
                currency: availableCurrency._id,
            })

            if (existingRequest) {
                let status = existingRequest.status;
                if (status === "requested") {
                    return {
                        status: false,
                        message: "This currency has already been requested by the user!"
                    };
                } else if (status === "not-eligible") {
                    return {
                        status: false,
                        message: "This currency has been declined by the admin!"
                    };
                } else if (status === "pending") {
                    return {
                        status: false,
                        message: "Currency request is in pending!"
                    };
                } else if (status === "accepted") {
                    return {
                        status: false,
                        message: "Currency request is already accepted!"
                    };
                }
            }

            const requestedCurrency = new RequestedCurrency({
                code: currency,
                account: account._id,
                currency: availableCurrency._id,
                status: "requested"
            });

            const savedRequestedCurrency = await requestedCurrency.save();

            if (savedRequestedCurrency) {
                const notificationObj = {
                    title: 'Currency Request Notification',
                    desc: 'New Currency has been requested',
                    type: 'currency',
                    status: 'unread',
                    from: account._id,
                    link_id: savedRequestedCurrency._id,
                };
                addNotificationAdmin(notificationObj);
                await createWallet(account, availableCurrency.code, availableCurrency.symbol);

                return {
                    status: true,
                    message: `Your ${currency} currency has accepted`,
                    savedRequestedCurrency
                };
            } else {
                return {
                    status: false,
                    message: "Something went wrong while requesting currency"
                };
            }
        }
    } catch (err) {
        console.log(err);
        return {
            status: false,
            message: "Internal server error."
        };
    }
}

// WALLET TO WALLET RELATED FUNCTIONS //
async function walletToWalletTransaction(data) {
    try {
        let { receiver_wallet_id, sender_wallet_id, purpose, amount, type, payment_type, service_type, attachments, description, transaction_method, transaction_type } = data;
        console.log({ receiver_wallet_id, sender_wallet_id, purpose, amount, type, payment_type, transaction_method })

        let senderWallet = await Wallet.findOne({
            $and: [{ _id: sender_wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
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
                    { path: 'level' }
                ]
            }
        ]);

        let receiverWallet = await Wallet.findOne({
            $and: [{ wallet_id: receiver_wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
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
                    { path: 'level' }
                ]
            }
        ]);

        if (!senderWallet) {
            return { status: false, message: "Invalid Sender!" };
        }

        if (!receiverWallet) {
            return { status: false, message: "Invalid Receiver!" };
        }

        if (!senderWallet.account.active) {//senderWallet.account._id.toString() != data.sender_id.toString() || ) {
            return { status: false, message: "Invalid Sender!" };
        }

        if (!receiverWallet.account.active) {
            return { status: false, message: "Invalid Receiver!" };
        }

        const receivingCountry = await CountryModel.findById(receiverWallet?.account?.country)

        console.log(receivingCountry, "receivingCountry")

        if (!receivingCountry.receivingActive) {
            return {
                status: false,
                message: "Receiving not active for the receiver country."
            }
        }

        // let excRate = await exchangeRateApi(senderWallet.currency.code, receiverWallet.currency.code, amount, senderWallet.account.level._id, payment_type);
        // console.log(excRate, "excRate")
        // let exchangedRate = await gettingExchangeRates(senderWallet.currency.code, receiverWallet.currency.code, amount, senderWallet.account.level._id, payment_type, data.transaction_type)
        // console.log(exchangedRate, "exchangedRate")

        // if (!exchangedRate) {
        //     return {
        //         status: false,
        //         message: "Exchange Rate Not Found"
        //     }
        // }

        const { exchange_rate, fee, totalAmountWithFee, recipient_amount, feeType, markup, original_rate } = await calculateExchangeAndFees(senderWallet.currency.code, receiverWallet.currency.code, amount, payment_type, senderWallet.account.level._id, transaction_method, senderWallet, transaction_type);

        console.log({ exchange_rate, fee, totalAmountWithFee, recipient_amount, feeType, markup, original_rate })
        if (totalAmountWithFee > senderWallet.balance.available) {
            return {
                status: false,
                message: "Insufficient Balance!"
            };
        }


        // let exchangedAmountSender = await getExchangeRatesToUSD(senderWallet.currency.code, 'USD', data.amount)
        // let exchagnedAmountReceiver = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', exchangedRate.recipient.value - exchangedRate.fee.exchange_fee)

        // let exchangedAmountSender
        // let exchagnedAmountReceiver
        // if (data.transaction_type === "request") {
        //     exchangedAmountSender = await getExchangeRatesToUSD(senderWallet.currency.code, 'USD', exchangedRate.total.value)
        //     exchagnedAmountReceiver = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', data.amount)
        // } else {
        //     exchangedAmountSender = await getExchangeRatesToUSD(senderWallet.currency.code, 'USD', data.amount)
        //     exchagnedAmountReceiver = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', exchangedRate.recipient.value - exchangedRate.fee.exchange_fee)
        // }

        let exchangedAmountSender
        let exchagnedAmountReceiver
        // if (data.transaction_type === "request") {
        exchangedAmountSender = await getExchangeRatesToUSD(senderWallet.currency.code, 'USD', totalAmountWithFee)
        exchagnedAmountReceiver = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', recipient_amount)
        // console.log(receiverWallet.currency.code, senderWallet.currency.code, data.transaction_type, exchangedRate.recipient.value, exchangedRate.fee.exchange_fee, data.amount, "chekinggg", exchangedRate)

        // features check
        let featureCheck1, featureCheck2;
        if (data.payment_type === "conversion") {
            featureCheck1 = await featureCheck('wallet_to_wallet', 'conversion', senderWallet.account.level);
            featureCheck2 = await featureCheck('wallet_to_wallet', 'conversion', receiverWallet.account.level);
        } else {
            featureCheck1 = await featureCheck(data.payment_type, 'send', senderWallet.account.level);
            featureCheck2 = await featureCheck(data.payment_type, 'receive', receiverWallet.account.level);
        }

        if (!featureCheck1) {
            return {
                status: false,
                message: "feature_not_available_1"
            };
        }
        if (!featureCheck2) {
            return {
                status: false,
                message: "feature_not_available_2"
            };
        }


        // limits checking
        if (data.payment_type !== "conversion") {
            let limitCheck1 = limitCheck(exchangedAmountSender, senderWallet.account.level, senderWallet.account, 'sending');
            let limitCheck2 = limitCheck(exchagnedAmountReceiver, receiverWallet.account.level, receiverWallet.account, 'receiving');

            console.log(limitCheck1, limitCheck2)

            let convertedSenderLimit
            let convertedDailyLimit
            let convertedMonthlyLimit
            let convertedYearlyLimit

            if (!limitCheck1.status || !limitCheck2.status) {
                let senderLimit = senderWallet.account.level.transaction_amount_limit;
                let senderDailyLimit = senderWallet.account.level.daily_sending_limit;
                let senderMonthlyLimit = senderWallet.account.level.monthly_sending_limit;
                let senderYearlyLimit = senderWallet.account.level.yearly_sending_limit;

                convertedSenderLimit = await getExchangeRatesToUSD('USD', senderWallet.currency.code, senderLimit)
                convertedDailyLimit = await getExchangeRatesToUSD('USD', senderWallet.currency.code, senderDailyLimit)
                convertedMonthlyLimit = await getExchangeRatesToUSD('USD', senderWallet.currency.code, senderMonthlyLimit)
                convertedYearlyLimit = await getExchangeRatesToUSD('USD', senderWallet.currency.code, senderYearlyLimit)
            }

            if (!limitCheck1.status) {
                return {
                    status: false,
                    message: `limit_${limitCheck1.code}`,
                    sendingAmounts: {
                        convertedSenderLimit,
                        convertedDailyLimit,
                        convertedMonthlyLimit,
                        convertedYearlyLimit,
                        code: senderWallet.currency.code
                    }
                }
            }

            if (!limitCheck2.status) {
                return {
                    status: false,
                    message: `limit_${limitCheck2.code}`,
                    receivingAmounts: {
                        convertedSenderLimit,
                        convertedDailyLimit,
                        convertedMonthlyLimit,
                        convertedYearlyLimit,
                        code: senderWallet.currency.code
                    }
                }
            }
        }

        // let limitCheck1 = limitCheck(exchangedAmountSender, senderWallet.account.level, 'sending');
        // let limitCheck2 = limitCheck(exchagnedAmountReceiver, receiverWallet.account.level, 'receiving');

        // if (!limitCheck1.status) {
        //     return {
        //         status: false,
        //         message: limitCheck1.code
        //     }
        // }

        // if (!limitCheck2.status) {
        //     return {
        //         status: false,
        //         message: limitCheck2.code
        //     }
        // }

        // let totalAmount = exchangedAmountSender + excRate?.fee.exchange_fee;


        // if (senderWallet.balance.available < (amount + excRate.fee.exchange_fee)) {
        //     return { status: false, message: "Insufficient balance!" };
        // }

        // if (senderLimit < totalAmount) {
        //     return { status: false, message: `Your Sending limit is ${senderWallet?.currency?.symbol}${senderDailyLimit}!` };
        // }
        // if (senderDailyLimit < totalAmount) {
        //     return { status: false, message: `Your Daily sending limit is ${senderWallet?.currency?.symbol}${senderDailyLimit}!` };
        // }
        // if (senderMonthlyLimit < totalAmount) {
        //     return { status: false, message: `Your Monthly sending limit is ${senderWallet?.currency?.symbol}${senderMonthlyLimit}!` };
        // }
        // if (senderYearlyLimit < totalAmount) {
        //     return { status: false, message: `Your Yearly sending limit is ${senderWallet?.currency?.symbol}${senderYearlyLimit}!` };
        // }
        // if (senderLimit < totalAmount) {
        //     return { status: false, message: "Sending limit exceeded!" };
        // }

        // if (receiverLimit < excRate.exchanged_amount) {
        //     return { status: false, message: "Receiver account receiving limit exceeded!" };
        // }
        // if (receiverDailyLimit < excRate.exchanged_amount) {
        //     return { status: false, message: `Daily receiving limit for receiver is ${receiverWallet?.currency?.symbol}${receiverDailyLimit}!` };
        // }
        // if (receiverMonthlyLimit < excRate.exchanged_amount) {
        //     return { status: false, message: `Monthly receiving limit for receiver is ${receiverWallet?.currency?.symbol}${receiverMonthlyLimit}!` };
        // }
        // if (receiverYearlyLimit < excRate.exchanged_amount) {
        //     return { status: false, message: `Yearly receiving limit for receiver is ${receiverWallet?.currency?.symbol}${receiverYearlyLimit}!` };
        // }

        // receiver's account balance check
        if (data.payment_type !== "conversion") {

            const receiverBalanceCheck = await balanceLimitCheck(recipient_amount, receiverWallet.account, receiverWallet);

            if (!receiverBalanceCheck?.status && receiverBalanceCheck?.remainingBalance) {
                return {
                    status: false,
                    message: `Completing this transaction will exceed receiever's balance limit of ${formattedAmount(receiverBalanceCheck?.remainingBalance)} ${receiverWallet?.currency.code}. Please perform the transaction within the limit.`
                }
            } else if (!receiverBalanceCheck?.status) {
                return {
                    status: false,
                    message: "Something went wrong. Please try again later."
                }
            }
        }

        const senderTimezone = senderWallet.account?.timezone || "UTC"
        const receiverTimezone = receiverWallet.account?.timezone || "UTC"

        const senderCurrentTime = moment().tz(senderTimezone).format();
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        let senderBalance;
        let receiverBalance;

        senderBalance = senderWallet.balance.available - totalAmountWithFee
        receiverBalance = receiverWallet.balance.available + recipient_amount;

        let ref = 'tr_' + Date.now().toString();
        let senderTransactionObj = {
            reference_id: ref,
            type: 'instant',
            transaction_type: 'debit',
            service_type: service_type ? service_type : 'wallet_to_wallet',
            payment_type,
            status: 'COMPLETED',
            purpose: purpose,
            description,
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount: totalAmountWithFee - fee,
            fee: fee,
            fee_type: feeType,
            markup,
            markup_currency: senderWallet.currency.code,
            exchange_rate: original_rate,
            exchange_rate_markup: exchange_rate,
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
            attachments: data.attachments,
            timeline: [
                {
                    status: 'COMPLETED',
                    date: senderCurrentTime,
                }
            ]
        };
        let receiverTransactionObj = {
            reference_id: ref,
            type: 'instant',
            transaction_type: 'credit',
            service_type: 'wallet_to_wallet',
            payment_type,
            status: 'COMPLETED',
            purpose: purpose,
            description,
            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
            amount: recipient_amount,
            fee: 0,
            fee_type: feeType,
            markup,
            markup_currency: senderWallet.currency.code,
            exchange_rate: original_rate,
            exchange_rate_markup: exchange_rate,
            total: recipient_amount,
            wallet_id: receiverWallet.wallet_id,
            wallet: receiverWallet._id,
            account: receiverWallet.account._id,
            sender: senderWallet.account._id,
            receiver: receiverWallet.account._id,
            current_balance: receiverWallet.balance.available,
            new_balance: receiverWallet.balance.available + recipient_amount,
            attachments: data.attachments,
            timeline: [
                {
                    status: 'COMPLETED',
                    date: receiverCurrentTime,
                }
            ]
        };

        let newSenderBalance = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderBalance } });
        if (newSenderBalance.acknowledged && newSenderBalance.modifiedCount == 1) {
            let supdt = await Transaction.create(senderTransactionObj);
            if (supdt) {
                let newReceiverBalance = await Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } });
                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                    let rupdt = await Transaction.create(receiverTransactionObj);
                    if (rupdt) {
                        // updating the limits used
                        await updateUsedLimits(senderWallet.account, receiverWallet.account, exchangedAmountSender, exchagnedAmountReceiver);
                        const notificationObj = {
                            title: 'Wallet to Wallet transaction',
                            desc: 'You have received a transaction!',
                            type: 'wallet_to_wallet',
                            status: 'unread',
                            from: senderWallet.account,
                            to: receiverWallet.account,
                            link_id: rupdt._id,
                        };
                        const sender_name = senderWallet?.account?.user ?
                            senderWallet?.account?.user?.first_name + senderWallet?.account?.user?.first_name :
                            senderWallet?.account?.company?.company_name;
                        const receiver_name = receiverWallet?.account.user ?
                            receiverWallet?.account?.user?.first_name + receiverWallet?.account?.user?.first_name :
                            receiverWallet?.account?.company?.company_name;
                        addNotification(notificationObj);
                        sendPrivateMessage(receiverWallet?.account?._id, "You have received a transaction.");
                        const senderOptions = {
                            toEmail: senderWallet?.account?.email ?? "",
                            phoneNumber: senderWallet?.account?.phone ?? "",
                            instaUsername: senderWallet?.account?.insta_username ?? "",
                            message: `You have sent a transaction of ${totalAmountWithFee} ${senderWallet?.currency?.code} to ${receiver_name}`,
                            subject: "You have sent a transaction in your Instapay Account!",
                            templateId: "d-2d5f929ed89847d693ab15621b95890f",
                            phoneMessage: `Transaction sent of ${totalAmountWithFee} ${senderWallet?.currency?.code} to ${receiver_name}`
                        };
                        const receiverOptions = {
                            toEmail: receiverWallet?.account?.email ?? "",
                            phoneNumber: receiverWallet?.account?.phone ?? "",
                            instaUsername: receiverWallet?.account?.insta_username ?? "",
                            message: `You have recieved a transaction of ${recipient_amount} ${receiverWallet?.currency?.code} from ${sender_name}`,
                            subject: "You have received a transaction in your Instapay Account!",
                            templateId: "d-2d5f929ed89847d693ab15621b95890f",
                            phoneMessage: `Transaction recieved of ${recipient_amount} ${receiverWallet?.currency?.code} from ${sender_name}`
                        };
                        // sendNotifications(senderWallet.account, 'payments', senderOptions);
                        // sendNotifications(receiverWallet.account, 'payments', receiverOptions);
                        return { status: true, message: "Transaction successfull.", data: supdt, exchanged: rupdt };
                    } else {
                        let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id });
                        let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } });
                        let wrupdt = await Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverWallet.balance.available } });
                        return { status: false, message: "Transaction Failed." };
                    }
                } else {
                    let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id });
                    let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } });
                    return { status: false, message: "Transaction Failed." };
                }
            } else {
                let wupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } });
                return { status: false, message: "Transaction Failed." };
            }
        } else {
            return { status: false, message: "Transaction Failed." };
        }
    } catch (err) {
        console.log(err);
        return { status: false, message: "Internal server error!" };
    }
};

async function schedulePaymentW2W(data) {
    try {
        let { receiver_wallet_id, sender_wallet_id, purpose, amount, date, time, timezone, attachments, description, reserved } = data;

        let senderWallet = await Wallet.findOne({ _id: sender_wallet_id, wallet_type: "insta", status: 'active' }).populate('account');
        let receiverWallet = await Wallet.findOne({ wallet_id: receiver_wallet_id, wallet_type: "insta", status: 'active' }).populate('account');

        if (!senderWallet || !receiverWallet || !senderWallet.account.active || !receiverWallet.account.active) {
            return {
                status: false,
                message: "Invalid sender or receiver!"
            };
        }

        let payObj = {
            purpose: purpose,
            description,
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount: amount,
            sender_wallet_id: senderWallet.wallet_id,
            sender_wallet: senderWallet._id,
            sender: senderWallet.account._id,
            reciever_wallet_id: receiverWallet.wallet_id,
            reciever_wallet: receiverWallet._id,
            receiver: receiverWallet.account._id,
            account: senderWallet.account._id
        };

        let objSch = {
            date: date,
            time: time,
            type: 'payment',
            active: true,
            status: 'processing',
            recursive: false,
            account: senderWallet.account._id,
            payment: payObj,
            timezone,
            attachments,
            reserved,
        };

        const subscribtionDetails = await Schedule.create(objSch);

        // notification
        const notificationObj = {
            title: 'Wallet to Wallet transaction',
            desc: 'You have received a scheduled transaction!',
            type: 'wallet_to_wallet',
            status: 'unread',
            from: senderWallet.account,
            to: receiverWallet.account,
            link_id: subscribtionDetails._id,
        };

        addNotification(notificationObj);
        // socket
        sendPrivateMessage(receiverWallet.account._id, "You have received a scheduled transaction.");

        return {
            status: true,
            message: "Payment scheduled successfully.",
            subscribtionDetails
        };
    } catch (err) {
        console.log(err);
        return {
            status: false,
            message: "Internal server error!"
        };
    }
};

async function subscribePaymentW2W(data) {
    try {

        let { receiver_wallet_id, sender_wallet_id, purpose, amount, date, next_date, cycles, nextCycles, untilIstop, timezone, attachments, description, reserved } = data;

        let senderWallet = await Wallet.findOne({ _id: sender_wallet_id, wallet_type: "insta", status: 'active' }).populate('account');
        let receiverWallet = await Wallet.findOne({ wallet_id: receiver_wallet_id, wallet_type: "insta", status: 'active' }).populate('account');

        if (!senderWallet || !receiverWallet || !senderWallet.account.active || !receiverWallet.account.active) {
            return {
                status: false,
                message: "Invalid sender or receiver!"
            };
        }

        let payObj = {
            purpose: purpose,
            description,
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount: amount,
            sender_wallet_id: senderWallet.wallet_id,
            sender_wallet: senderWallet._id,
            sender: senderWallet.account._id,
            reciever_wallet_id: receiverWallet.wallet_id,
            reciever_wallet: receiverWallet._id,
            receiver: receiverWallet.account._id,
            account: senderWallet.account._id
        };

        let objSch = {
            date: date,
            next_date: date,
            cycles: cycles,
            nextCycles: cycles,
            type: 'payment',
            active: true,
            status: 'processing',
            untilIstop,
            recursive: true,
            account: senderWallet.account._id,
            payment: payObj,
            timezone,
            attachments,
            reserved
        };

        console.log(objSch, "objShech")

        const subscribtionDetails = await Schedule.create(objSch);

        // notification
        const notificationObj = {
            title: 'Wallet to Wallet transaction',
            desc: 'You have received a subscribed transaction!',
            type: 'wallet_to_wallet',
            status: 'unread',
            from: senderWallet.account,
            to: receiverWallet.account,
            link_id: subscribtionDetails._id,
        };

        addNotification(notificationObj);
        // socket
        sendPrivateMessage(receiverWallet.account._id, "You have received a subscribed transaction.");

        return {
            status: true,
            message: "Payment subscribed successfully.",
            subscribtionDetails
        };
    } catch (err) {
        console.log(err);
        return {
            status: false,
            message: "Internal server error!"
        };
    }
};

// International payment related functions //

async function createQuotationHelper(data) {

    const API_URL = `${sandboxUrl}/v2/money-transfer/quotations`;
    const authHeader = authHeadersThunes;
    const config = {
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
        }
    };

    const response = await axios.post(API_URL, data, config);

    return response.data;
}

async function getCountries(country_name) {
    try {
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
            console.log(countries, "countrisinthunes")

            // to check if the country is supported by thunes or not
            const supportedCountry = countries.find(
                (country) => country.name === exactMatch.name
            );

            if (supportedCountry) {
                return { status: true, country: "supported", Name: exactMatch.name, iso_code: supportedCountry.iso_code };
            } else {
                return { status: false, country: "unsupported" };
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
                    return { status: true, country: "suggestion", Name: supportedCountry.name, iso_code: supportedCountry.iso_code };
                } else {
                    return { status: false, country: "unsupported" };
                }
            } else {
                return { status: false, country: "unsupported" };
            }
        }

    } catch (error) {
        console.error('Error fetching countries:', error);
        return { status: false, message: 'Internal Server Error' };
        //res.status(500).send({Error: 'Internal Server Error'});
    }
};

// get all the services available in that country
async function getServices(requestedCountry) {
    try {
        console.log(requestedCountry, "requestedCountry")
        const API_URL = `${sandboxUrl}/v2/money-transfer/services`;
        const perPage = 100;

        const config = {
            headers: {
                'Authorization': authHeadersThunes,
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


        return { Status: true, MobileWallet: MobileWallet, BankAccount: BankAccount, CashPickup: CashPickup }
        //res.json(services);


    } catch (error) {
        console.error('Error fetching countries:', error?.response?.data?.errors || error);
        return { status: false, message: 'Internal Server Error' };
    };
}

// we use this to only return the names of the payers
async function getPayerNames(requestedService, requestedCountry) {
    try {

        const API_URL = `${sandboxUrl}/v2/money-transfer/payers`;
        const perPage = 200;

        const config = {
            headers: {
                'Authorization': authHeadersThunes,
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

        const servicesWithIds = payers.map(service => ({
            // country_iso_code: service.country_iso_code,
            // currency: service.currency,
            id: service.id,
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
        return { status: true, payers: formattedList, servicesWithIds };

    } catch (error) {
        console.error('Error fetching payers:', error);
        message = 'Internal Server Error'
        return { status: false, message };

    }
};

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

const calculatePayerRatesLogic = async (payerId, walletId, transactionType, amount, channel_name = "bank_account") => {
    console.log(payerId, walletId, transactionType, amount, "bodyinsdecalculatePayerRatesLogic")
    const wallet = await Wallet.findOne({ _id: walletId }).populate('account');
    const wallet_currency = wallet.currency.code //'EUR'
    const balance = wallet.balance.available;

    const fees = await Fee.findOne({ account_level: wallet.account.level._id }).populate('account_level');
    let receivingCountryFee = await ReceiverFee.findOne({ country: wallet.account.country, service_name: channel_name })

    console.log(fees, "fees")
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

    // const fee_type = fees.fee_type;
    // const flat_fee = fees.flat_fee;
    // const percentage_fee = fees.percentage_fee;
    // const fee_currency = fees.fee_currency;

    const fee_type = receivingCountryFee ? receivingCountryFee.fee_type : fees?.fee_type;
    const flat_fee = receivingCountryFee ? receivingCountryFee.flat_fee : fees?.flat_fee;
    const percentage_fee = receivingCountryFee ? receivingCountryFee.percentage_fee : fees?.percentage_fee;
    const fee_currency = receivingCountryFee ? receivingCountryFee.fee_currency : fees?.fee_currency;

    const sending_limit = fees.account_level.transaction_amount_limit;
    const daily_sending_limit = fees.account_level.daily_sending_limit;
    const monthly_sending_limit = fees.account_level.monthly_sending_limit;
    const yearly_sending_limit = fees.account_level.yearly_sending_limit;
    var fee = 0;

    // const markup_fee = 0.05;
    // const markup_type = 'flat';
    // const percentage_markup = 10;
    // const markup_currency = 'USD';

    const markup_fee = receivingCountryFee ? receivingCountryFee.flat_markup : fees?.flat_markup;
    const markup_type = receivingCountryFee ? receivingCountryFee.markup_type : fees?.markup_type;
    const percentage_markup = receivingCountryFee ? receivingCountryFee.percentage_markup : fees?.percentage_markup;
    const markup_currency = receivingCountryFee ? receivingCountryFee.markup_currency : fees?.markup_currency;

    var markup = 0;
    var exchange_rate_with_markup = 0;

    const API_URL = `${sandboxUrl}/v2/money-transfer/payers/${payerId}/rates`;

    const config = {
        headers: {
            'Authorization': authHeadersThunes,
        }
    };

    let Max_Amount
    let Min_Amount
    let exchange_rate
    console.log('iranas', API_URL, config)
    const response = await axios.get(API_URL, config);
    console.log('iranas', response.data)
    const rates = response.data;
    let destination_currency = rates.destination_currency;

    const keys = Object.keys(rates.rates);  // extracting the transaction types supported by payer,  this infor is not shown in the get payer info so extracting it here

    if (keys.includes(transactionType)) {
        Max_Amount = rates.rates[transactionType][thune_currency][0]?.source_amount_max;
        Min_Amount = rates.rates[transactionType][thune_currency][0]?.source_amount_min;
        exchange_rate = parseFloat((rates.rates[transactionType][thune_currency][0]?.wholesale_fx_rate).toFixed(2))
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
            error: "Entered amount exceeds your maximum amount limit"
        };
    }

    if (converted_amount <= converted_min_amount) {
        return {
            error: "Entered amount is less than your minimum amount limit"
        };
    }

    if (total > sending_limit) {
        return {
            error: `Entered amount exceeds your sending limit ${wallet.currency.symbol}${sending_limit}`
        };
    }

    if (total > daily_sending_limit) {
        return {
            error: "Entered amount exceeds your daily sending limit"
        };
    }

    if (total > monthly_sending_limit) {
        return {
            error: "Entered amount exceeds your monthly sending limit"
        };
    }

    if (total > yearly_sending_limit) {
        return {
            error: "Entered amount exceeds your yearly sending limit"
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
    const roundedOriginalConvertedAmount = parseFloat(wallet_to_thune_currency_amount?.toFixed(3));
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
// to get the exchange rates based on payer id
async function getPayerRates(data) {
    try {
        let payerId = parseInt(data.payerId);
        const wallet_id = data.wallet_id;
        const transaction_type = data.transaction_type;
        const amount = data.amount;
        // console.log(payerId, wallet_id, transaction_type, amount, "datainsidegetPayerRates")

        const external_id1 = shortid.generate()

        const walletDetails = await Wallet.findById(wallet_id).populate('account');

        const result = await calculatePayerRatesLogic(payerId, wallet_id, transaction_type, amount);

        const mode = 'SOURCE_AMOUNT'
        const Thunes_Currency = 'USD'  // AS WE ONLY HAVE USD FOR NOW SO HARDCODING IT 
        const Thunes_Country = 'USA'  // AS WE ONLY HAVE USD FOR NOW SO HARDCODING IT 
        let requestData = {
            external_id: external_id1,
            payer_id: payerId,
            mode,
            transaction_type: transaction_type,
            source: {
                amount,
                currency: Thunes_Currency,
                country_iso_code: Thunes_Country
            },
            destination: {
                amount: null,
                currency: result.api_response.destination_currency
            }
        };

        // console.log(requestData, "requestData")

        const quotationResult = await createQuotationHelper(requestData);
        console.log(result, "resultlol")
        if (result.success) {

            const payload = {
                result: result.api_response,
                thunes_fee: quotationResult.fee.amount
            };

            const options = {
                expiresIn: '1h',
            };         // not expiring the token right now

            const token = jwt.sign(payload, secretKey);

            const rates = { result: result.api_response, token: token, Supported_Transaction_Types: result.Supported_Transaction_Types, thunes_fee: quotationResult.fee.amount };
            return { status: true, rates }
        } else {
            const error = result.error
            return { status: false, error }

            // res.status(404).json(encryptedError); // You can change the status code as needed
        }
    } catch (error) {
        console.error('Error fetching payer rates:', error);
        return { status: false, message: 'Internal server error' }

    }
}

const getExchangeRates = async (data) => {
    try {
        const { wallet_id, transaction_type, amount, service_id, payerId, payout_method, iso_code } = data;

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
        const external_id1 = shortid.generate()

        console.log("datainsideexchangerates", wallet_id, transaction_type, amount, payerId, payout_method, channel_name, service_name)

        const result = await processExchangeRates({
            transaction_type,
            amount,
            service_name,
            wallet_id,
            channel_name,
            payerId,
            external_id: external_id1,
            service_id: payout_method,
            country: country?._id
        });

        console.log(result, "resultincheck")

        if (result.status === false) {

            return {
                status: false, message: result.message.includes("minimum") ?
                    `Entered amount is too low! Minimum amount is ${result.value.toFixed(2)} ${result.currency}` :
                    result.message.includes("maximum") ? `Entered amount is too high! Maximum amount is ${result.value.toFixed(2)} ${result.currency}`
                        : "Something went wrong while getting exchange rates"
            }
        }

        const token = jwt.sign(result, secretKey, { expiresIn: '1h' })

        return { status: true, rates: result.result, token }

    } catch (err) {
        console.log(err);
        return { status: false, message: "Something went wrong while getting exchange rates" }
    }
};

// creating the transaction
async function createQuotation(data) {
    try {
        const external_id1 = shortid.generate()
        const API_URL = `${sandboxUrl}/v2/money-transfer/quotations`;
        const Thunes_Currency = 'USD'  // AS WE ONLY HAVE USD FOR NOW SO HARDCODING IT 
        const Thunes_Country = 'USA'  // AS WE ONLY HAVE USD FOR NOW SO HARDCODING IT 

        const {
            wallet_id,
            payer_id,
            transaction_type,
            amount,
            token,
            service_id,
            channel_name
            // destination: { currency: destinationCurrency }
        } = data;


        console.log(data, "datainsidecreateQuotation")

        const decodedToken = jwt.verify(token, secretKey);

        const result = await calculatePayerRatesLogic(payer_id, wallet_id, transaction_type, amount, channel_name);
        if (result.success) {
            const mode = 'SOURCE_AMOUNT'

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
            console.log(decodedToken.result, result.api_response, "tokenresponse")
            const difference = findDifferences(decodedToken.result, result.api_response);

            if (difference === "difference") {
                return { status: false, message: 'There has been a change in the exchagne rate' }
            }

            if (difference === "fees changed") {
                return { status: false, message: 'Fees has been updaated.' }
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

                const authHeader = authHeadersThunes;
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

                return { status: true, message: filteredResponse }

            }

        }
        else {
            return { status: false, message: result.error }

        }

    } catch (error) {
        console.error('Error creating quotation:', error);

        return { status: false, message: 'An error occurred while creating the quotation' }

    }
};

async function createTransaction(data) {
    try {
        // required information to make a transaction
        let {
            wallet_id = wallet_id.toString(),
            additional_information,
            purpose_of_remittance,
            user_id,             // right now this is taken in request body, later it will be taken from token, so needs to be updated
            beneficiary_id,
            service,
            bank_id,
            mobile_wallet_id,
            transaction_type,
            token,
            Quotation_ID
        } = data;

        console.log(data, "datainsidecreatfunctionamdbank_id", data.bank_id);


        const user = await User.findById(user_id).populate("account")
        const beneficiary = await Beneficiary.findById(beneficiary_id);
        // console.log(user, beneficiary, "datacheck")

        const service_id = service.id;

        const credit_party_identifier = {
        };

        let document_type = '';
        let document_number = '';
        let bank_details
        console.log(service_id, bank_id, "service_id, bank_id")
        // hardcoding values for now, since this data isnt in the database
        if (service_id == 1 && data.mobile_wallet_id) {
            const mobile_wallet = await beneficiary.mobile_wallet.find(bl => bl._id.equals(mobile_wallet_id))
            credit_party_identifier.msisdn = mobile_wallet?.wallet_account_number// "272715638100" //beneficiary.mobile_wallet_account_number
            credit_party_identifier.account_number = mobile_wallet?.extras?.account_number //|| "0123456789"
            credit_party_identifier.iban = mobile_wallet?.extras?.iban //|| "AT351111111111111100"
            credit_party_identifier.email = beneficiary?.email || ''
            credit_party_identifier.bank_account_number = mobile_wallet?.extras?.account_number //|| "0123456789"
            credit_party_identifier.account_type = mobile_wallet?.extras?.account_type //|| "SAVINGS"
            console.log(beneficiary.mobile_wallet, data.mobile_wallet_id, "1stcondition")
        } else if (service_id == 2 && data.bank_id) {
            bank_details = await beneficiary.bank_details.find(bl => bl._id.equals(data.bank_id))
            console.log(bank_id, beneficiary.bank_details, bank_details, "bankdetails")

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
            console.log("i have ran")
        } else if (service_id == 3) {
            credit_party_identifier.msisdn = beneficiary.phone// "272715638100" //beneficiary.mobile_wallet_account_number
            document_type = beneficiary.cash_pickup[0]?.document_type
            document_number = beneficiary.cash_pickup[0]?.document_number
        } else if (service_id == 4) {
            credit_party_identifier.card_number = '4111254101010100'
            credit_party_identifier.bank_account_number = '272715638100'

        }

        console.log(bank_details?.account_holder_name || beneficiary?.first_name + ' ' + beneficiary?.last_name, bank_details, bank_details?.account_holder_name)

        console.log(credit_party_identifier, bank_details, "bank_details");
        const API_URL = `${sandboxUrl}/v2/money-transfer/quotations/ext-${Quotation_ID}/transactions`;
        let t_id = `instapay_t_id_${Date.now()}`
        const transactionExternalID = t_id;

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
                id_delivery_date: user?.extras?.dateOfIssue,
                // middlename: "",
                occupation: user?.occupation || "",
                province_state: user?.account?.country_iso_code,
                msisdn: user?.account?.phone || "",
                nationality_country_iso_code: user?.account?.user_nationaility || "",
            }

        }

        console.log(sender_obj, "sender_obj")

        let beneficiary_obj
        if (second_type === "C") {
            // all fields of individual beneficiary
            beneficiary_obj = {
                firstname: beneficiary?.first_name,
                lastname: beneficiary?.last_name,
                bank_account_holder_name: bank_details?.account_holder_name || beneficiary?.first_name + ' ' + beneficiary?.last_name,
                id_expiration_date: "",
                date_of_birth: beneficiary?.extras?.date_of_birth || "",
                country_iso_code: bank_id
                    ? beneficiary?.extras?.country_iso_code || beneficiary?.country_iso_code
                    : beneficiary?.country_iso_code || '',
                // lastname: beneficiary?.last_name,
                nativename: "",
                id_country_iso_code: '',
                email: beneficiary?.email,
                city: beneficiary?.city || '',
                postal_code: beneficiary?.postal_code || '',
                id_type: beneficiary?.extras?.id_type || "",
                address: beneficiary?.address || '',
                id_number: beneficiary?.extras?.id_number || "",
                gender: beneficiary?.extras?.gender ?
                    (beneficiary.extras.gender.toLowerCase() === "male" ? "MALE" : "FEMALE") : "",
                code: beneficiary?.extras?.id_number || null,
                id_delivery_date: "",
                middlename: "",
                occupation: beneficiary?.extras?.occupation || "",
                province_state: beneficiary?.extras?.province_state,
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
                address: user.account.address || 'Malir Karachi',
                city: user.account.city || 'CITY',
                postal_code: user.account.postal_code || 'POSTAL_CODE',
                country_iso_code: user.account.country_iso_code,
                registration_number: "123"   //hardcoded for now
            }
        }

        let receiving_business
        if (second_type === 'B') {
            // things hardcoded which are not in database
            receiving_business = {
                registered_name: beneficiary.first_name,
                trading_name: beneficiary.first_name,
                address: beneficiary.address || 'ADDRESS',
                postal_code: "12345",
                city: beneficiary.city,
                country_iso_code: beneficiary.country_iso_code,
                tax_id: 1234567,
                date_of_incorporation: "",
                representative_lastname: beneficiary.first_name,
                representative_firstname: beneficiary.first_name,
                representative_id_type: "",
                representative_id_country_iso_code: beneficiary.country_iso_code
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

        console.log(requestData, "requestdataforapi")

        const authHeader = authHeadersThunes;
        const config = {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        };

        requestData['callback_url'] = 'https://fontawesomev23.com/api/webhook/thunes-transaction-status'
        requestData['external_code'] = user.account._id;

        console.log(requestData, "requestDatainchatbot")
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
        let total = decodedToken.result.total + decodedToken.thunes_fee

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
            TransactionID: transactionExternalID,
            wallet_id: wallet_id,
            status_message: transactionResult.status_message,
            user_id: user_id,
            transactionDetails
        };

        const options = {
            expiresIn: '1h',
        };         // not expiring the token right now

        const new_token = jwt.sign(payload, secretKey, { expiresIn: '10m' });

        return { status: true, message: "Transaction Created", token: new_token }

    } catch (error) {

        if (error.response && error.response.data && error.response.data.errors) {
            console.error('Error creating transaction:', error.response && error.response.data && error.response.data.errors);

            // not showing the error messages by thunes thats why commented
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');
            // const encryptedError = await encryption(errorMessages);

            //     const errorCodes = error.response.data.errors.map(error => error.code); // Extract all error codes by thunes

            //   const encryptedError = await encryption(errorCodes.join(', '));

            return { status: false, message: "Something went wrong!", }

        } else {
            return { status: false, message: "An error occurred while creating the transaction" }
        }
    }
};

async function createWithdrawalTransaction(data) {
    try {

        const {
            wallet_id,
            additional_information,
            purpose_of_remittance,
            account_id,
            service_id,
            payer_id,
            transaction_type,
            token,
            quotation_id,
            withdrawal_id
        } = data;

        const withdrawalDetails = await Withdrawal.findById(withdrawal_id)
        const accountDetails = await Account.findById(account_id).populate(["user", "company"])

        console.log(withdrawalDetails, service_id, withdrawalDetails?.bank_details[0], "withdrawalDetails")

        let credit_party_identifier = {
        };
        let document_type = "";
        let document_number = "";

        if (service_id == 1) {
            // credit_party_identifier.bank_account_number = withdrawalDetails.bank_details[0]?.account_number//"0123456789"
            // credit_party_identifier.swift_bic_code = withdrawalDetails.bank_details[0]?.swift_code//"ABCDEFGH"
            credit_party_identifier.msisdn = withdrawalDetails.mobile_wallet[0]?.wallet_account_number//mobile_wallet.wallet_account_number// "272715638100" //beneficiary.mobile_wallet_account_number
            // console.log(credit_party_identifier.msisdn, "credit_party_identifier.msisdn")
        } else if (service_id == 2) {
            credit_party_identifier.bank_account_number = withdrawalDetails?.bank_details[0]?.account_number// bank_details?.account_number //"272715638100" //beneficiary.bank_details.account_number
            credit_party_identifier.iban = withdrawalDetails?.bank_details[0]?.iban//"PK73BAHL1116180400568001"// bank_details?.iban //"AT351111111111111100"; //beneficiary.bank_swift_code
            credit_party_identifier.account_number = withdrawalDetails?.bank_details[0]?.account_number //"272715638100" //beneficiary.bank_details.account_number

        } else if (service_id == 3) {
            credit_party_identifier.msisdn = withdrawalDetails.cash_pickup[0]?.document_number//beneficiary.phone// "272715638100" //beneficiary.mobile_wallet_account_number
            document_type = withdrawalDetails.cash_pickup[0]?.document_type//beneficiary.cash_pickup[0]?.document_type
            document_number = withdrawalDetails.cash_pickup[0]?.document_number//beneficiary.cash_pickup[0]?.document_number
        } else if (service_id == 4) {
            credit_party_identifier.card_number = withdrawalDetails.card[0]?.card_number//'4111254101010100'
        }

        const API_URL = `${process.env.THUNES_PROD_URL}/v2/money-transfer/quotations/ext-${quotation_id}/transactions`;
        let t_id = `instapay_t_id_${Date.now()}`
        const transactionExternalID = t_id;

        first_type = transaction_type[0] // to see if the sender is individual or business
        second_type = transaction_type[2] // to see if the reciever is individual or business
        let requestData
        let sender_obj_individual, sending_business, receiving_business;
        let documentType = accountDetails?.user?.extras?.documentType === "id-card" ?
            "NATIONAL_ID" : accountDetails?.user?.extras?.documentType === "passport" ?
                "PASSPORT" : accountDetails?.user?.extras?.documentType === "driving-license" ?
                    "DRIVING_LICENSE" : "RESIDENT_CARD"
        if (transaction_type === 'C2C') {
            // sender_obj_individual = {
            //     firstname: withdrawalDetails?.first_name || 'first_name',
            //     lastname: withdrawalDetails?.last_name || 'last_name',
            //     nationality: withdrawalDetails?.nationality || '',
            //     address: withdrawalDetails?.address || 'my_address',
            //     date_of_birth: withdrawalDetails?.dob || '',
            //     id_expiration_date: "",
            //     country_of_birth_iso_code: "",
            //     source_of_funds: "BUSINESS",
            //     date_of_birth: "",
            //     country_iso_code: "TZA",       // not in database so hardocing this value for now
            //     beneficiary_relationship: "BROTHER", //beneficiary.relation || '',   // from bene db (these need to be in a format which is acceptable by thunes, so do check)
            //     nativename: "",
            //     id_country_iso_code: "",
            //     email: "",
            //     city: withdrawalDetails?.city || "my_city",
            //     postal_code: "",
            //     id_type: document_type,
            //     id_number: document_number,
            //     gender: "",
            //     code: "",
            //     id_delivery_date: "",
            //     middlename: "",
            //     occupation: "",
            //     province_state: "",
            //     msisdn: "272715638100",
            //     nationality_country_iso_code: "",
            // }
            sender_obj_individual = {
                firstname: accountDetails?.user?.first_name || 'FIRST_NAME',
                lastname: accountDetails?.user?.last_name || 'LAST_NAME',
                nationality: accountDetails?.country_iso_code || 'FRA',
                address: accountDetails?.address || 'ADDRESS',
                date_of_birth: accountDetails?.dob || "1992-01-01",
                id_expiration_date: accountDetails?.user?.extras?.dateOfExpiry || 'DATE_OF_EXPIRY',
                country_of_birth_iso_code: accountDetails?.country_iso_code || "FRA",
                source_of_funds: accountDetails?.user?.source_of_funds || "",
                date_of_birth: accountDetails?.dob?.split("-")?.reverse()?.join("-") || "DATE_OF_BIRTH",
                country_iso_code: accountDetails?.country_iso_code || "FRA",
                beneficiary_relationship: "SELF",
                nativename: "",
                id_country_iso_code: accountDetails?.country_iso_code || 'FRA',
                email: accountDetails?.email || 'EMAIL',
                city: accountDetails?.city || 'CITY',
                postal_code: accountDetails?.postal_code || 'POSTAL_CODE',
                id_type: documentType,
                id_number: accountDetails?.user?.extras?.idNumber,
                gender: accountDetails?.gender ?
                    (accountDetails?.gender?.toLowerCase() === "male" ? "MALE" : "FEMALE") : "",
                code: "5024",
                id_delivery_date: accountDetails?.user?.extras?.dateOfIssue || "DATE_OF_ISSUE",
                middlename: "",
                occupation: accountDetails?.user?.occupation || "OCCUPATION",
                province_state: "",
                msisdn: accountDetails?.phone || "MOBILE_NUMBER",
                nationality_country_iso_code: accountDetails?.country_iso_code || "FRA",
            }
        } else {
            sending_business = {
                registered_name: withdrawalDetails?.first_name || 'first_name',
                trading_name: withdrawalDetails?.first_name || 'first_name',
                address: withdrawalDetails?.address || 'my_address',
                postal_code: "123",
                city: withdrawalDetails?.city || "my_city",
                country_iso_code: "FRA",
                registration_number: "123"
            }
            receiving_business = {
                registered_name: withdrawalDetails?.first_name || 'first_name',
                trading_name: withdrawalDetails?.first_name || 'first_name',
                address: withdrawalDetails?.address || 'my_address',
                postal_code: "12345",
                city: withdrawalDetails?.city || "my_city",
                country_iso_code: "SGP",
                tax_id: 1234567,
                date_of_incorporation: "",
                representative_lastname: withdrawalDetails?.last_name || 'last_name',
                representative_firstname: withdrawalDetails?.first_name || 'first_name',
                representative_id_type: "",
                representative_id_country_iso_code: ""
            }
        }

        if (transaction_type === 'C2C') {
            const formatAddress = (bankDetails) => {
                if (!bankDetails) return '';

                const addressParts = [
                    bankDetails?.name,
                    bankDetails?.branch_name,
                    bankDetails?.branch_street,
                    bankDetails?.city,
                    bankDetails?.province
                ].filter(Boolean);

                return addressParts.join(', ');
            };
            const beneficiary_obj = {
                ...sender_obj_individual,
                bank_account_holder_name: withdrawalDetails?.bank_details[0]?.account_holder_name || accountDetails?.first_name + " " + accountDetails?.last_name || "",
                address: service_id === 2 ? formatAddress(withdrawalDetails?.bank_details[0]) : '',
                id_country_iso_code: service_id !== 2 ? '' : accountDetails?.user_nationaility || '',
                postal_code: service_id === 2 ? (withdrawalDetails?.bank_details[0]?.postal_code || '') || '' : '',
                city: service_id === 2 ? (withdrawalDetails?.bank_details[0]?.city || '') || '' : '',
                nationality: service_id !== 2 ? (accountDetails?.user_nationaility || '') || '' : '',
                country_iso_code: service_id !== 2 ? (accountDetails?.country_iso_code || '') || '' : '',
                id_type: service_id !== 2 ? (documentType || '') || '' : '',
                id_number: service_id !== 2 ? (accountDetails?.user?.extras?.idNumber || '') || '' : '',
                id_expiration_date: service_id !== 2 ? (accountDetails?.user?.extras?.dateOfExpiry || '') || '' : '',
                id_delivery_date: service_id !== 2 ? (accountDetails?.user?.extras?.dateOfIssue || '') || '' : '',
                code: service_id !== 2 ? (accountDetails?.user?.extras?.idNumber || Math.floor(10000 + Math.random() * 90000)) || '' : Math.floor(10000 + Math.random() * 90000),
                province_state: service_id !== 2 ? (accountDetails?.country_iso_code || '') || '' : '',
            };
            requestData = {
                additional_information_1: additional_information,
                purpose_of_remittance: purpose_of_remittance,
                credit_party_identifier: credit_party_identifier,
                external_id: transactionExternalID,
                sender: sender_obj_individual,
                beneficiary: beneficiary_obj,
            };
        } else {
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
                document_reference_number: 123,
            };
        }

        const authHeader = `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`;
        const config = {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        };

        requestData['callback_url'] = 'https://fontawesomev23.com/api/webhook/thunes-transaction-status'
        requestData['external_code'] = accountDetails._id;


        console.log(requestData, "requestDatainwithdr", API_URL, config)
        const response = await axios.post(API_URL, requestData, config)
        console.log(response, "response")
        const transactionResult = response.data;

        console.log(transactionResult);

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
            credit_party_identifier
        }

        const payload = {
            TransactionID: transactionExternalID,
            wallet_id: wallet_id,
            status_message: transactionResult.status_message,
            user_id: accountDetails._id,
            withdrawal: true,
            transactionDetails
        };

        console.log(payload, "payload")

        const new_token = jwt.sign(payload, secretKey);

        return { status: true, message: "Transaction Created", token: new_token }

    } catch (err) {
        console.log(err?.response?.data?.errors || err)
        return { status: false, message: "An error occurred while creating the transaction" }
    }
}

// async function commissionCalculator(recipientId) {
//     let followersCount = 0;
//     try {
//         const userInfo = await userInstaInfo(recipientId);
//         if (userInfo) {
//             followersCount = userInfo.follower_count;
//         }
//     } catch (error) {
//         console.error('Error fetching user info, defaulting followersCount to 0');
//     }

//     let commission = 0;
//     if (followersCount >= 0 && followersCount <= 100000) {
//         commission = 0.03;
//     } else if (followersCount >= 100001 && followersCount <= 1000000) {
//         commission = 0.045;
//     } else {
//         commission = 0.06;
//     }

//     return commission;
// }

const fetchImageBuffer = async (imageUrl) => {
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');
        return buffer;
    } catch (error) {
        console.error('Error fetching image buffer:', error);
        throw error;
    }
};

const uploadAttachments = async (TransactionID, file, type = "invoice", name = "invoice") => {
    console.log("i have ran");
    const config = {
        headers: {
            'Authorization': authHeadersThunes,
            'Content-Type': 'multipart/form-data'
        }
    };

    const formData = new FormData();
    const API_ATTACHMENT_URL = `${sandboxUrl}/v2/money-transfer/transactions/ext-${TransactionID}/attachments`;

    const fileExtension = file.url.split('.').pop();
    const fileType = mime.lookup(fileExtension); // Get the correct MIME type

    try {
        const buffer = await fetchImageBuffer(file.url);
        console.log(buffer, "type");

        formData.append('file', buffer, {
            filename: `file.${fileExtension}`,
            contentType: fileType
        });
        formData.append('type', type);
        formData.append('name', name);

        const response = await axios.post(API_ATTACHMENT_URL, formData, config);
        return response.data;
    } catch (error) {
        console.error("Full error response:", error.response ? error.response : error);
        if (error.response && error.response.data && error.response.data.errors) {
            console.error("errorinside", error.response.data.errors);
        } else {
            return { status: false, message: 'An error occurred while uploading attachments' }
        }
    }
};

async function confirmTransaction(token, data, withdrawal) {
    try {
        console.log(token, "token", data, "data", withdrawal, "withdrawal")
        const decodedToken = jwt.verify(token, secretKey);
        const {
            TransactionID,
            wallet_id,
            user_id,
            transactionDetails
        } = decodedToken;

        const calculations = transactionDetails.calculations;
        const extras = transactionDetails.extras;

        console.log(calculations, "calculations", extras, "extras", decodedToken, "decodedToken", calculations.recipient.currency, decodedToken.transactionDetails.purpose)

        const wallet = await Wallet.findOne({ _id: wallet_id }).populate('account')
        if (!wallet) {
            return { status: false, message: "Wallet not found" }
        }

        const balance = wallet.balance.available

        const account = await Account.findOne({ _id: wallet.account.id }).populate("user")
        if (!account) {
            return { status: false, message: "Account not found" }
        }

        if (data?.intl_attachments > 3) {
            return { status: false, message: 'Maximum 3 files allowed' };
        }

        const thunesDetails = await thunesBalance()

        console.log(thunesDetails, "thunesDetails")
        const USDBalance = thunesDetails.thunes.filter((item) => item.currency === "USD")
        console.log(USDBalance, "USDBalance",)

        let exchangedTotalWithFeeToUSD = await convertCurrency(calculations.recipient.currency, 'USD', calculations.recipient.value)

        if (exchangedTotalWithFeeToUSD > USDBalance[0]?.balance) {
            return { status: false, message: "Insufficient Balance in thunes" }
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

        const transactionId = TransactionID;

        if (data?.intl_attachments?.length > 0) {
            for (const file of data?.intl_attachments) {

                const attachmentResponse = await uploadAttachments(transactionId, file, "invoice", "invoice");

                console.log(attachmentResponse, "attachmentResponse");
            }

        }

        const total = calculations.total.value
        // const daily_limit= account.daily_limit.sending_limit_used
        // const monthly_limit= account.monthly_limit.sending_limit_used
        // const yearly_limit= account.yearly_limit.sending_limit_used

        if (total > balance) {
            return { status: false, message: `Insufficient Balance, your current balance in this wallet is ${balance}` }
        }

        // Get transaction details from Thunes
        const transactionDetailsUrl = `${sandboxUrl}/v2/money-transfer/transactions/ext-${transactionId}`;
        const config = {
            headers: {
                'Authorization': authHeadersThunes,
                'Content-Type': 'application/json'
            }
        };
        const transactionDetailsResponse = await axios.get(transactionDetailsUrl, config);
        const transactionDetailsData = transactionDetailsResponse.data;
        console.log({ transactionDetailsData });

        const vespiaTxId = generateUniqueInteger(TransactionID);

        let paymentType;
        const serviceId = transactionDetails.service_id
        if (serviceId === 1) {
            paymentType = 'international_mobile_wallet';
        } else if (serviceId === 2) {
            paymentType = 'international_bank_transfer';
        } else if (serviceId === 3) {
            paymentType = 'international_cash_pickup';
        } else {
            paymentType = 'international_card_payment';
        }

        const userLoginHistory = await loginHistory.findOne({ account: account._id }).sort({ createdAt: -1 }).exec()
        console.log({ userLoginHistory })
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
            user_ip: userLoginHistory?.location?.IPv4 || "192.168.1.1",
            user_email: account?.email || "Unknown",
            user_passport: account.user?.extras?.idNumber || "Unknown",
            user_phone: account.phone.startsWith("+") ? account.phone : `+${account.phone}`, // Format phone
            payment_card: serviceId === 3 ? "1234-5678-9012-3456" : null,
            user_wallet_balance: balance,
            crypto_type: null,
            payment_method: serviceId === 1 ? "Mobile Wallet" : serviceId === 2 ? "Bank Account" : serviceId === 3 ? "Cash Pickup" : "Credit Card",
            industry_type: null,
            business_size: null,
            browser_name: userLoginHistory?.browser_name || "Unknown",
            platform: userLoginHistory?.platform || "Unknown",
            browser_version: userLoginHistory?.browser_version || "Unknown",
            is_mobile_user: userLoginHistory?.is_mobile_user
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
            recipient_received_amount: calculations?.recipient?.value,
            recipient_received_currency: calculations.recipient.currency,
            fee: calculations.fee.value,
            fee_type: extras.fee_type,
            vendor: { name: "thunes", fee: extras?.thunes_fee || 0, rate: extras?.thunes_rate },
            ip_fee: calculations.fee.value - extras.thunes_fee || 0,
            markup: withdrawal ? extras?.percentage_markup : extras?.markup_value,
            markup_currency: wallet.currency.code,
            exchange_rate: extras?.original_exchange_rate,
            feeToSendingRate: extras?.feeToSendingRate,
            exchange_rate_markup: extras?.exchange_rate_with_markup,
            total: total,
            wallet_id: wallet.wallet_id,
            wallet: wallet._id,
            account: wallet.account._id,
            sender: wallet.account._id,
            beneficiary: transactionDetails.beneficiary_id || null,
            receiver: null,
            current_balance: wallet.balance.available,
            new_balance: wallet.balance.available - total,
            attachments: data?.intl_attachments || null,
            timeline: [{ status: 'INITIATED', date: senderCurrentTime }],
            payment_id: vespiaTxId // Using this ID in vespia callback to track the transaction
        };

        console.log(senderTransactionObj, "senderTransactionObj");

        const senderTransaction = await Transaction.create(senderTransactionObj)

        wallet.balance.available = balance - total;
        await wallet.save();

        // updating the limits used
        let USDTotal;
        if (wallet.currency.code !== 'USD') {
            USDTotal = await convertCurrency(wallet.currency.code, 'USD', total);
        } else {
            USDTotal = total
        }
        await updateUsedLimits(wallet.account, null, USDTotal, null);

        const outputData = {
            TransactionID: senderTransaction.reference_id,
            beneficiary: {
                firstname: transactionDetailsData.beneficiary.firstname,
                lastname: transactionDetailsData.beneficiary.lastname,
            },
            total,
            currency_code: wallet.currency.code
        };

        return { status: true, message: outputData }


    } catch (error) {
        console.error('Error confirming transaction:', error);

        if (error.response && error.response.data && error.response.data.errors) {

            //  not showing the error messages by thunes thats why commented
            //   const errorMessages = error.response.data.errors
            //       .map(error => `${error.code}: ${error.message}`)
            //       .join(', ');

            //   const encryptedError = await encryption(errorMessages);

            const errorCodes = error.response.data.errors.map(error => error.code); // Extract all error codes by thunes

            console.log(errorCodes)
            return { status: false, message: 'Something went wrong while confirming the transaction' }
        } else {
            return { status: false, message: 'An error occurred while confirming the transaction' }
        }
    }
};

async function sendButtons(chatId, text, buttons, lastMessage) {
    try {
        const response = await axios.post(`${apiTelegramUrl}/sendMessage`, {
            chat_id: chatId,
            text: text,
            reply_markup: {
                inline_keyboard: buttons,
            },
        });
        console.log('Buttons sent:', response.data);
        if (lastMessage) {
            await updateLastMessage(chatId, lastMessage);
        }
    } catch (error) {
        console.error('Error sending buttons:', error.response?.data || error.message);
    }
}

async function updateLastMessage(chatId, lastMessage) {
    try {

        let telegramBot = await TelegramBotModel.findOne({ recipient: chatId });
        if (telegramBot) {
            telegramBot.last_message = lastMessage;
            await telegramBot.save();
        } else {
            await new TelegramBotModel({ recipient: chatId, last_message: lastMessage }).save();
        }
    } catch (error) {
        console.error('Error updating last message:', error);
    }
}

async function confirmTransactionTopupHelper(req, res) {
    console.log(req.botId, req.token, "req.botId, req.token")
    const botId = req.botId
    const transaction_id = req.transaction_id
    let botName;

    if (req?.chatbot) {
        botName = req.chatbot
    }

    let chatbotData;
    if (botName) {
        chatbotData = {
            sender: { id: botId },
        }
    }

    try {

        const token = req.token
        const decodedToken = jwt.verify(token, secretKey);
        const {
            TransactionID,
            wallet_id,
            user_id,
            transactionDetails
        } = decodedToken;

        const calculations = transactionDetails.calculations;
        const extras = transactionDetails.extras;

        console.log(calculations, "calculations", extras, "extras", decodedToken, "decodedToken", calculations.recipient.currency, decodedToken.transactionDetails.purpose)

        const wallet = await Wallet.findOne({ _id: wallet_id }).populate('account')
        const balance = wallet.balance.available

        const account = await Account.findOne({ _id: wallet.account.id }).populate("user")

        const thunesDetails = await thunesBalance()

        console.log(thunesDetails, "thunesDetails")
        const USDBalance = thunesDetails.thunes.filter((item) => item.currency === "USD")
        console.log(USDBalance, "USDBalance",)

        let exchangedTotalWithFeeToUSD = await convertCurrency(calculations.recipient.currency, 'USD', calculations.recipient.value)

        const total = calculations.total.value

        if (!wallet) {
            console.log("Wallet not found")
            await logError(
                `Wallet not found`,
                "topup_trust_payment_intl_helper_ch",
                null,
                transaction_id || null,
            );
            // return { status: false, message: "Wallet not found" }
            if (botName === "telegram") {
                await sendButtons(botId, "Error: Transaction failed.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");
            } else {
                await sendBotTemplate(chatbotData, "Error: Transaction failed!", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
            }

            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/failed`);

        } else if (!account) {
            console.log("account not found")
            await logError(
                `account not found`,
                "topup_trust_payment_intl_helper_ch",
                null,
                transaction_id || null,
            );
            // return { status: false, message: "Account not found" }
            if (botName === "telegram") {
                await sendButtons(botId, "Error: Transaction failed.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");
            } else {
                await sendBotTemplate(chatbotData, "Error: Transaction failed!", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
            }
            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/failed`);

        } else if (exchangedTotalWithFeeToUSD > USDBalance[0]?.balance) {
            console.log("Insufficient Balance in thunes")
            await logError(
                `Insufficient Balance in thunes`,
                "topup_trust_payment_intl_helper_ch",
                null,
                transaction_id || null,
            );
            if (botName === "telegram") {
                await sendButtons(botId, "Error: Transaction failed.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");
            } else {
                await sendBotTemplate(chatbotData, "Error: Transaction failed!", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
            }
            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/failed`);
            // return { status: false, message: "Insufficient Balance in thunes" }

        } else if (total > balance) {
            await logError(
                `Insufficient Balance`,
                "topup_trust_payment_intl_helper_ch",
                null,
                transaction_id || null,
                { values: total, balance }
            );
            if (botName === "telegram") {
                await sendButtons(botId, "Error: Insufficient Balance to make an international transfer!", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");
            } else {
                await sendBotTemplate(chatbotData, "Error: Insufficient Balance to make an international transfer!", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
            }
            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/failed`);
            // return { status: false, message: `Insufficient Balance, your current balance in this wallet is ${balance}` }
        }
        // if (data?.intl_attachments?.length > 0) {
        //     for (const file of data?.intl_attachments) {

        //         const attachmentResponse = await uploadAttachments(transactionId, file, "invoice", "invoice");

        //         console.log(attachmentResponse, "attachmentResponse");
        //     }

        // }
        const transactionId = TransactionID;
        // Get transaction details from Thunes
        const transactionDetailsUrl = `${sandboxUrl}/v2/money-transfer/transactions/ext-${transactionId}`;
        const config = {
            headers: {
                'Authorization': authHeadersThunes,
                'Content-Type': 'application/json'
            }
        };
        const transactionDetailsResponse = await axios.get(transactionDetailsUrl, config);
        const transactionDetailsData = transactionDetailsResponse.data;
        console.log({ transactionDetailsData });

        const vespiaTxId = generateUniqueInteger(TransactionID);

        let paymentType;
        const serviceId = transactionDetails.service_id
        if (serviceId === 1) {
            paymentType = 'international_mobile_wallet';
        } else if (serviceId === 2) {
            paymentType = 'international_bank_transfer';
        } else if (serviceId === 3) {
            paymentType = 'international_cash_pickup';
        } else {
            paymentType = 'international_card_payment';
        }

        const userLoginHistory = await loginHistory.findOne({ account: account._id }).sort({ createdAt: -1 }).exec()
        console.log({ userLoginHistory })
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
            user_ip: userLoginHistory?.location?.IPv4 || "192.168.1.1",
            user_email: account?.email || "Unknown",
            user_passport: account.user?.extras?.idNumber || "Unknown",
            user_phone: account.phone.startsWith("+") ? account.phone : `+${account.phone}`, // Format phone
            payment_card: serviceId === 3 ? "1234-5678-9012-3456" : null,
            user_wallet_balance: balance,
            crypto_type: null,
            payment_method: serviceId === 1 ? "Mobile Wallet" : serviceId === 2 ? "Bank Account" : serviceId === 3 ? "Cash Pickup" : "Credit Card",
            industry_type: null,
            business_size: null,
            browser_name: userLoginHistory?.browser_name || "Unknown",
            platform: userLoginHistory?.platform || "Unknown",
            browser_version: userLoginHistory?.browser_version || "Unknown",
            is_mobile_user: userLoginHistory?.is_mobile_user
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
            service_type: `international`,
            payment_type: paymentType,
            status: 'INITIATED',
            channel_details: transactionDetails.credit_party_identifier,
            purpose: decodedToken.transactionDetails.purpose,
            description: decodedToken.transactionDetails.description,
            currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
            amount: total - calculations.fee.value,
            fee: calculations.fee.value,
            fee_type: extras.fee_type,
            vendor: { name: "thunes", fee: extras?.thunes_fee || 0 },
            ip_fee: calculations.fee.value - extras.thunes_fee || 0,
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
            attachments: null,
            timeline: [
                {
                    status: 'INITIATED',
                    date: senderCurrentTime,
                }
            ],
            payment_id: vespiaTxId // Using this ID in vespia callback to track the transaction
        };

        console.log(senderTransactionObj, "senderTransactionObj");

        const senderTransaction = await Transaction.create(senderTransactionObj)

        wallet.balance.available = balance - total;
        await wallet.save();

        // updating the limits used
        let USDTotal;
        if (wallet.currency.code !== 'USD') {
            USDTotal = await convertCurrency(wallet.currency.code, 'USD', total);
        } else {
            USDTotal = total
        }
        await updateUsedLimits(wallet.account, null, USDTotal, null);


        const subtitles = `
TID: ${senderTransactionObj.reference_id}
Recipient: ${transactionDetailsData.beneficiary.firstname || "N/A"} ${transactionDetailsData.beneficiary.lastname || "N/A"}
Status: Processing
                                `

        const message = `Your payment of ${formattedAmount(senderTransactionObj.total)} ${senderTransactionObj.currency.code} has been successfully processed.`
        // return { status: true, message: outputData }
        if (botName === "telegram") {
            await sendButtons(botId, `${message}\n\n${subtitles}`, [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");
        } else {
            await sendBotTemplate(chatbotData, message, "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png", subtitles);
        }

        // return res.status(200).send(await encryption(response));
        return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/success/0`);


    } catch (error) {
        await logError(
            `${error?.response?.data?.errors || error} (catch: intl_topup_helper)`,
            "topup_trust_payment_intl_helper_ch",
            null,
            transaction_id || null,
        );
        console.error('Error confirming transaction:', error?.response?.data?.errors || error);

        if (botName === "telegram") {
            await sendButtons(botId, "Error: Transaction failed.", [[{ text: "Main Menu", callback_data: "main_menu" }]], "4");
        } else {
            await sendBotTemplate(chatbotData, "Error: Transaction failed!", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");
        }
        return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/failed`);

    }
};

async function sendBotTemplate(chatbotData, title, imageUrl, subtitle) {
    const templatePayload = {
        template_type: "generic",
        elements: [
            {
                title: title,
                subtitle: subtitle || "",
                image_url: imageUrl,
                buttons: [{ type: "postback", title: "Main Menu", payload: "main_menu" }]
            }
        ]
    };
    await sendTemplate(chatbotData, chatbotData?.sender?.id, templatePayload, "4");
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

async function getExchangeRatesForRequest(data) {
    try {
        // let additional = 2;
        let fee = 0;
        // let data = req.body
        var { request_id, currency } = data;
        console.log(data, "data")

        let requestDetails = await RequestPayment.findById(request_id)
        if (!requestDetails) {
            return { status: false, message: "Request not found!" };

        }

        let walletDetails = await Wallet.findOne({ $and: [{ account: requestDetails.receiver }, { "currency.code": currency.toUpperCase() }, { status: 'active' }] }).populate([{ path: 'account', select: 'level', populate: (['level']) }])
        let recieverWalletDetails = await Wallet.findOne({ $and: [{ _id: requestDetails.wallet }, { status: 'active' }] })
        let to = walletDetails.currency.code;
        let from = recieverWalletDetails.currency.code;
        let amount = requestDetails.amount;
        let level_id = walletDetails.account.level._id

        const feeDetails = await Fee.findOne({ $and: [{ service_name: 'wallet_to_wallet' }, { account_level: level_id }] });

        if (feeDetails) {
            const exchangeRate = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`)
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

                let data = {
                    insufficient_balance: (feeExchange + exchangeRate.data.result) > walletDetails?.balance.available ? true : false,
                    total: feeExchange + exchangeRate.data.result,
                    exchangeRate: exchangeRate.data,
                    walletDetails
                }
                console.log(data)
                return { status: true, message: data };
            } else {
                return { status: false, message: "Exchange Rates not found!" };

            }
        } else {
            return { status: false, message: "Fee details not found" };
        }

        // Fee.findOne({ $and: [{ service_name: 'wallet_to_wallet' }, { account_level: level_id }] }).then(async (feeDetails) => {
        //     if (feeDetails) {
        //         axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`).then(async (exchangeRate) => {
        //             if (exchangeRate.data.success) {
        //                 let newRate = exchangeRate.data.info.rate //+ (exchangeRate.data.info.rate * (additional / 100))
        //                 let exchangedAmount = newRate * amount;
        //                 // exchangeRate.data['new_rate'] = newRate;
        //                 exchangeRate.data['exchanged_amount'] = exchangedAmount;
        //                 let fee_currency = feeDetails ? feeDetails.fee_currency : 'USD'
        //                 if (feeDetails) {
        //                     if (feeDetails.fee_type == 'flat') { fee = feeDetails.flat_fee }
        //                     else { fee = amount * (feeDetails.percentage_fee / 100) }
        //                 }
        //                 let feeExchange = await getExchangeRatesToUSD(fee_currency, to, fee)
        //                 // console.log(feeExchange);
        //                 exchangeRate.data['fee'] = {
        //                     fee_type: feeDetails?.fee_type,
        //                     exchange_fee: feeExchange,
        //                     fee: fee,
        //                     currency: to
        //                 }

        //                 let data = {
        //                     insufficient_balance: (feeExchange + exchangeRate.data.result) > walletDetails?.balance.available ? true : false,
        //                     total: feeExchange + exchangeRate.data.result,
        //                     exchangeRate: exchangeRate.data,
        //                     walletDetails
        //                 }
        //                 console.log(data)
        //                 return { status: true, message: data };
        //             } else {

        //                 return { status: false, message: "Exchange Rates not found!" };

        //             }
        //         }).catch(async (err) => {
        //             console.log(err);
        //             return { status: false, message: "Something went wrong!" };

        //         })
        //     } else {
        //         return { status: false, message: "Fee details not found" };

        //     }

        // }).catch(async (err) => {
        //     console.log("err1", err);
        //     return { status: false, message: "Something went wrong!" };

        // })
    } catch (err) {
        console.log("err2", err);
        return { status: false, message: "Something went wrong!" };

    }
}

// PAYMENT REQUEST RELATED FUNCTIONS

async function requestPayment(data) {
    try {

        var { amount, wallet_id, purpose, sender, receiver, attachments, description, lat, long, display_name, address } = data;
        console.log(amount, wallet_id, purpose, sender, receiver)

        let senderWallet = await Wallet.findOne({ $and: [{ _id: wallet_id.toString() }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level']) }])
        let receiverDetails = await Account.findOne({ $and: [{ _id: receiver }, { active: true }] }).populate(['user', 'company'])
        let senderDetails = await Account.findOne({ $and: [{ _id: sender }, { active: true }] }).populate(['user', 'company'])

        console.log(senderWallet, "senderWallet")
        console.log(receiverDetails, "receiverDetails")
        console.log(senderDetails, "senderDetails")
        if (!senderWallet) {
            return { status: false, message: 'Request failed' };
        }
        if (!senderWallet?.account?.active || !senderDetails) {
            console.log(senderWallet.account.active, senderDetails);

            return { status: false, message: 'Request failed' };
        }

        if (!receiverDetails) {
            return { status: false, message: "Receiver not found!" };
        }

        let ref = 'rq_' + Date.now().toString();
        let objReq = {
            reference_id: ref,
            type: 'payment_request',
            service_type: 'wallet_to_wallet',
            status: 'pending',
            purpose: purpose,
            description,
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount,
            wallet_id: senderWallet.wallet_id,
            wallet: senderWallet._id,
            sender: senderWallet.account._id,
            receiver: receiverDetails._id,
            attachments,
            lat, long, display_name, address
        }

        const requestDetails = await RequestPayment.create(objReq);
        if (requestDetails) {

            try {
                const notificationObj = {
                    title: 'Payment Request',
                    desc: 'You have received a payment request!',
                    type: 'payment_request',
                    status: 'unread',
                    from: senderWallet.account,
                    to: receiverDetails._id,
                    link_id: requestDetails._id,
                }

                addNotification(notificationObj)
                // socket
                sendPrivateMessage(receiverDetails._id, "You have received a payment request")


                const sender_name = senderDetails?.user ?
                    senderDetails?.user?.first_name + " " + senderDetails?.user?.last_name :
                    senderDetails?.company?.company_name

                const quotationSendLanguage = 'english';
                const quotationSendtemplateName = 'Request Money(Standard Payment Request) - Sent';

                const templateIdSending = getTemplateId(quotationSendLanguage, quotationSendtemplateName);

                const date = new Date();
                const formattedDate = momenttz(date).format('YYYY-MM-DD');

                const dynamicDataSending = {
                    request_id: requestDetails?.reference_id,
                    sender_name: sender_name,
                    date_requested: `${formattedDate}`,
                    amount: `${formattedAmount(formatDecimalNumbersWithLimit(amount))} ${senderWallet?.currency?.code}`,
                    purpose_of_payment: purpose ?? "N/A",
                    sender_profile_link: `https://my.insta-pay.ch/profile/${senderWallet.account.username}`,
                    sender_country: senderWallet?.account?.country_name,

                }

                console.log(dynamicDataSending)

                const senderTemplateDetails = {
                    toEmail: receiverDetails?.email,
                    templateId: templateIdSending,
                    phoneNumber: receiverDetails?.phone,
                    phoneMessage: `You have received a payment request of ${formattedAmount(formatDecimalNumbersWithLimit(amount))} ${senderWallet?.currency?.code} from ${sender_name}. Please review and respond accordingly.`,
                    dynamicData: dynamicDataSending
                }

                // email, phone and push notifications
                await sendNotifications(senderWallet.account, 'payments', senderTemplateDetails)

                // whatsapp notification
                await whatsappMessageHelper(
                    receiverDetails?.phone,
                    'payment_request3',
                    'en',
                    [
                        { parameter_name: 'username', text: senderDetails?.username },
                        { parameter_name: 'reqid', text: ref },
                        { parameter_name: 'name', text: sender_name },
                        { parameter_name: 'amount', text: formattedAmount(amount) },
                        { parameter_name: 'currency', text: senderWallet?.currency?.code },
                        { parameter_name: 'country', text: senderDetails?.country_name },
                        { parameter_name: 'address', text: display_name || "N/A" }
                    ]
                );
            } catch (err) {
                console.log(err)
            }
            return { status: true, message: 'success', requestDetails };
        } else {
            return { status: false, message: 'Request failed' };
        }
        // RequestPayment.create(objReq).then(async (requestDetails) => {
        //     if (requestDetails) {

        //         // notification
        //         const notificationObj = {
        //             title: 'Payment Request Notification',
        //             desc: 'You have received a Payment Request.',
        //             type: 'payment_request',
        //             status: 'unread',
        //             from: senderWallet.account._id,
        //             to: receiverDetails._id,
        //             link_id: requestDetails._id,
        //         }

        //         return { status: true, message: "success" }
        //         // addNotification(notificationObj)
        //         // // socket message
        //         // sendPrivateMessage(receiverDetails._id, "You have received a Payment Request.")
        //         // console.log(senderDetails.user)
        //         // console.log(receiverDetails.user)

        //         // if (senderDetails.user && receiverDetails.user) {

        //         //     const sender_name = senderDetails?.user ?
        //         //         senderDetails?.user?.first_name + " " + senderDetails?.user?.last_name :
        //         //         senderDetails?.company?.company_name
        //         //     const receiver_name = receiverDetails.user ?
        //         //         receiverDetails.user?.first_name + " " + receiverDetails.user?.last_name :
        //         //         receiverDetails?.company?.company_name

        //         //     const sendingCurrency = senderWallet?.currency?.code;

        //         //     const receiverCurrency = senderWallet?.currency?.code;

        //         //     const senderOptions = {
        //         //         toEmail: senderDetails?.email ?? "",
        //         //         phoneNumber: senderDetails?.phone ?? "",
        //         //         instaUsername: senderDetails?.insta_username ?? "",
        //         //         message: `Hi, you have sent a payment request ${amount} ${receiverCurrency} to ${receiver_name}`,
        //         //         subject: "You have sent a payment request!",
        //         //         templateId: "d-2d5f929ed89847d693ab15621b95890f",
        //         //         phoneMessage: `You have sent a payment request ${amount} ${receiverCurrency} to ${receiver_name}`
        //         //     }
        //         //     const receiverOptions = {
        //         //         toEmail: receiverDetails?.email ?? "",
        //         //         phoneNumber: receiverDetails?.phone ?? "",
        //         //         instaUsername: receiverDetails?.insta_username ?? "",
        //         //         message: `You have received a payment request of ${amount} ${sendingCurrency} from ${sender_name}`,
        //         //         subject: "You have received a payment request",
        //         //         templateId: "d-2d5f929ed89847d693ab15621b95890f",
        //         //         phoneMessage: `You have received a payment request of ${amount} ${sendingCurrency} from ${sender_name}`
        //         //     }

        //         //     // email, phone and push notifications

        //         //     console.log("optionstest", senderOptions, receiverOptions)

        //     sendNotifications(senderWallet?.account?._id, 'payment_requests', senderOptions)
        //     sendNotifications(receiverDetails?._id, 'payment_requests', receiverOptions)
        //         //     console.log("this block ran")
        //         //     return { status: false, message: "Success" };
        //         // }


        //     } else {

        //         return { status: false, message: 'No account found.' };
        //     }
        // }).catch(async (err) => {
        //     console.log(err)

        //     return { status: false, message: 'Request failed' };
        // })
    } catch (err) {
        console.log(err);
        return { status: false, message: 'Request failed' };

    }
}
async function acceptPaymentRequest(data) {
    try {
        var { request_id, account_id, sender_wallet_id, purpose, payment_type } = data;
        console.log(data, "datainside")
        if (!request_id || !account_id || !sender_wallet_id) {
            return { status: false, message: "Required field are missing!" };
        }
        let requestDetails = await RequestPayment.findOne({ $and: [{ _id: request_id }, { status: 'pending' }] })
        if (!requestDetails) {
            return { status: false, message: "Request not found!" };
        }

        console.log(requestDetails, "requestDetails")
        let receiver_wallet_id = requestDetails.wallet_id;
        let amount = requestDetails.amount;
        let type = 'payment_request';

        let senderWallet = await Wallet.findOne({ $and: [{ _id: sender_wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])
        let receiverWallet = await Wallet.findOne({ $and: [{ wallet_id: receiver_wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])
        console.log(senderWallet, receiverWallet);
        if (!senderWallet) {

            return { status: false, message: "Invalid Sender!" };

        }
        if (!receiverWallet) {
            return { status: false, message: "Invalid Receiver!" };

        }
        if (!senderWallet.account.active) {
            return { status: false, message: "Invalid Sender!" };

        }
        if (!receiverWallet.account.active) {
            return { status: false, message: "Invalid Receiver!" };
        }
        let senderLimit = senderWallet.account.level.transaction_amount_limit;
        let receiverLimit = receiverWallet.account.level.receiving_limit;
        if (senderWallet.account.is_external_limit) {
            senderLimit = senderWallet.account.transaction_amount_limit
        }
        if (receiverWallet.account.is_external_limit) {
            receiverLimit = senderWallet.account.receiving_limit
        }
        let excRate = await requestExchangeRateApi(receiverWallet.currency.code, senderWallet.currency.code, amount, senderWallet.account.level._id, 'wallet_to_wallet')
        // console.log(excRate);
        let totalAmount = excRate.exchanged_amount + excRate.fee.exchange_fee;

        if (senderWallet.balance.available < (excRate.exchanged_amount + excRate.fee.exchange_fee)) {
            return { status: false, message: "You have insufficient balance for this transaction!" };
        }
        if (senderLimit < totalAmount) {
            return { status: false, message: "Your sending transaction limit exceeded!" };

        }
        if (receiverLimit < amount) {
            return { status: false, message: "Receiver's account's receiving transaction limit exceeded!" };
        }

        let senderBalance = senderWallet.balance.available - (excRate.exchanged_amount + excRate.fee.exchange_fee)
        let receiverBalance = receiverWallet.balance.available + amount
        let ref = 'tr_' + Date.now().toString();
        let senderTransactionObj = {
            reference_id: ref,
            type: 'payment_request',
            transaction_type: 'debit',
            service_type: 'wallet_to_wallet',
            payment_type,
            status: 'completed',
            purpose: purpose,
            description: requestDetails.description,
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount: excRate.exchanged_amount,
            fee: excRate.fee.exchange_fee,
            total: excRate.exchanged_amount + excRate.fee.exchange_fee,
            wallet_id: senderWallet.wallet_id,
            wallet: senderWallet._id,
            account: senderWallet.account._id,
            sender: senderWallet.account._id,
            receiver: receiverWallet.account._id,
            current_balance: senderWallet.balance.available,
            attachments: requestDetails.attachments,
            timeline: [
                {
                    status: 'COMPLETED',
                    date: Date.now(),
                }
            ]
        }
        let receiverTransactionObj = {
            reference_id: ref,
            type: 'payment_request',
            transaction_type: 'credit',
            service_type: 'wallet_to_wallet',
            payment_type,
            status: 'completed',
            purpose: purpose,
            description: requestDetails.description,
            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
            amount: amount,
            fee: 0,
            total: amount,
            wallet_id: receiverWallet.wallet_id,
            wallet: receiverWallet._id,
            account: receiverWallet.account._id,
            sender: senderWallet.account._id,
            receiver: receiverWallet.account._id,
            current_balance: receiverWallet.balance.available,
            attachments: requestDetails.attachments,
            timeline: [
                {
                    status: 'COMPLETED',
                    date: Date.now(),
                }
            ]
        }
        const newSenderBalance = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderBalance } });
        if (newSenderBalance.acknowledged && newSenderBalance.modifiedCount == 1) {
            let supdt = await Transaction.create(senderTransactionObj)
            if (supdt) {
                const newReceiverBalance = await Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } });
                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                    let rupdt = await Transaction.create(receiverTransactionObj)
                    if (rupdt) {
                        let newSenderBalance = await RequestPayment.updateOne({ _id: requestDetails._id }, { $set: { "status": 'completed' } })
                        return { status: true, message: "Transaction successfull." };
                    } else {
                        let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
                        let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                        let wrupdt = await Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverWallet.balance.available } })
                        return { status: false, message: "Transaction failed. Please try again!" };
                    }
                } else {
                    let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
                    let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                    return { status: false, message: "Transaction failed. Please try again!" };
                }
            }
            else {
                let wupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                return { status: false, message: "Transaction failed. Please try again!" };
            }
        }
        else {
            // let updt = Transaction.updateOne({ _id: supdt._id }, { $set: { status: 'failed' } })
            return { status: false, message: "Transaction failed. Please try again!" };
        }



    } catch (err) {
        return { status: false, message: "Transaction failed. Please try again!" };
    }
}

async function declinePaymentRequest(request_id) {
    try {
        let requestDetails = await RequestPayment.findOne({ $and: [{ _id: request_id }, { status: 'pending' }] })
            .populate([
                { path: 'receiver', populate: (['user', 'company']) },
                { path: 'sender', populate: (['user', 'company']) },
                { path: 'wallet' }
            ]);
        let newSenderBalance = await RequestPayment.updateOne({ _id: requestDetails?._id }, { $set: { "status": 'cancelled' } })

        if (requestDetails.sender.insta_subscriber_id && requestDetails.sender.insta_bot) {
            let senderName = '';
            if (requestDetails.receiver.account_type == 'individual') { senderName = requestDetails.receiver?.user?.first_name + ' ' + requestDetails.receiver?.user?.last_name }
            if (requestDetails.receiver.account_type == 'business') { senderName = requestDetails.receiver?.company?.company_name }
        }

        // notification
        const notificationObj = {
            title: 'Payment Request Notification',
            desc: 'Payment Request declined.',
            type: 'payment_request',
            status: 'unread',
            from: requestDetails.sender,
            to: requestDetails.receiver,
            link_id: requestDetails._id,
        }

        addNotification(notificationObj)
        // socket message
        sendPrivateMessage(requestDetails.receiver, "Payment Request declined.")

        if (requestDetails.sender?.user && requestDetails.receiver?.user) {

            const sender_name = requestDetails.sender?.user ?
                requestDetails.sender?.user?.first_name + " " + requestDetails.sender?.user?.last_name :
                requestDetails.sender?.company?.company_name
            const receiver_name = requestDetails.receiver?.user ?
                requestDetails.receiver?.user?.first_name + " " + requestDetails.receiver?.user?.last_name :
                requestDetails.receiver?.company?.company_name

            const sendingCurrency = requestDetails.wallet?.currency.code;

            const receiverCurrency = requestDetails.wallet?.currency.code;

            const senderOptions = {
                toEmail: requestDetails.sender?.email ?? "",
                phoneNumber: requestDetails.sender?.phone ?? "",
                instaUsername: requestDetails.sender?.insta_username ?? "",
                message: `Hi, you have declined payment request of ${requestDetails.amount} ${receiverCurrency} to ${receiver_name}`,
                subject: "You have declined a payment request!",
                templateId: "d-2d5f929ed89847d693ab15621b95890f",
                phoneMessage: `You have declined payment request of ${requestDetails.amount} ${receiverCurrency} to ${receiver_name}`
            }
            const receiverOptions = {
                toEmail: requestDetails.receiver?.email ?? "",
                phoneNumber: requestDetails.receiver?.phone ?? "",
                instaUsername: requestDetails.receiver?.insta_username ?? "",
                message: `Your payment request of ${requestDetails.amount} ${sendingCurrency} has been declined from ${sender_name}`,
                subject: "Your payment request has been declined!",
                templateId: "d-2d5f929ed89847d693ab15621b95890f",
                phoneMessage: `Your payment request of ${requestDetails.amount} ${sendingCurrency} has been declined from ${sender_name}`
            }

            console.log("optionstest", senderOptions, receiverOptions)

            // email, phone and push notifications
            // sendNotifications(requestDetails?.sender?._id, 'payment_requests', senderOptions)
            // sendNotifications(requestDetails?.receiver?._id, 'payment_requests', receiverOptions)
        }

        return { status: true, message: "Payment request declined!" }


    } catch (err) {
        console.log(err);
        return { status: false, message: "Internal server error!" }

    }
}

async function subscribeRequestPaymentW2W(data) {
    try {

        let { amount, wallet_id, purpose, sender, receiver, date, cycles, timezone, attachments, description } = data;

        let senderWallet = await Wallet.findOne({ $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level']) }])
        let receiverDetails = await Account.findOne({ $and: [{ _id: receiver }, { active: true }] }).populate(['user', 'company'])
        let senderDetails = await Account.findOne({ $and: [{ _id: sender }, { active: true }] }).populate(['user', 'company'])

        if (!senderWallet) {
            return { status: false, message: "Sender Wallet not valid!" };
        }
        if (!senderWallet?.account?.active || !senderDetails) {
            console.log(senderWallet.account.active, senderDetails);
            return { status: false, message: "Invalid sender" };
        }

        if (!receiverDetails) {
            return { status: false, message: "Invalid receiver" };
        }

        let objReq = {
            type: 'payment_request',
            service_type: 'wallet_to_wallet',
            status: 'pending',
            purpose: purpose,
            description,
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount,
            wallet_id: senderWallet.wallet_id,
            wallet: senderWallet._id,
            sender: senderWallet.account._id,
            receiver: receiverDetails._id
        }

        // RequestPayment.create(objReq).then(async (requestDetails) => {
        //     if (requestDetails) {

        let objSch = {
            date: date,
            next_date: date,
            cycles: cycles,
            nextCycles: cycles,
            type: 'request',
            active: true,
            status: 'processing',
            recursive: true,
            account: senderWallet.account._id,
            request_payment: objReq,
            timezone,
            attachments
        }

        console.log(objSch, "objSchreq")

        const subscribtionDetails = await Schedule.create(objSch);

        if (subscribtionDetails) {
            return { status: true, message: 'success', subscribtionDetails };
        } else {
            return { status: false, message: 'Request failed' };
        }

        // Schedule.create(objSch).then(async (subscribtionDetails) => {

        //     // notification
        //     const notificationObj = {
        //         title: 'Payment Request Notification',
        //         desc: 'You have received a Subscribed Payment Request.',
        //         type: 'payment_request',
        //         status: 'unread',
        //         from: senderWallet.account._id,
        //         to: receiverDetails._id,
        //         link_id: subscribtionDetails._id,
        //     }

        //     addNotification(notificationObj)
        //     // socket message
        //     sendPrivateMessage(receiverDetails._id, "You have received a Subscribed Payment Request.")

        //     console.log(senderDetails.user, receiverDetails.user)

        //     if (senderDetails?.user && receiverDetails?.user) {

        //         const sender_name = senderDetails?.user ?
        //             senderDetails?.user?.first_name + " " + senderDetails?.user?.last_name :
        //             senderDetails?.company?.company_name
        //         const receiver_name = receiverDetails.user ?
        //             receiverDetails.user?.first_name + " " + receiverDetails.user?.last_name :
        //             receiverDetails.company?.company_name

        //         const sendingCurrency = senderWallet?.currency?.code;

        //         const receiverCurrency = senderWallet?.currency?.code;

        //         const senderOptions = {
        //             toEmail: senderDetails?.email ?? "",
        //             phoneNumber: senderDetails?.phone ?? "",
        //             instaUsername: senderDetails?.insta_username ?? "",
        //             message: `Hi, you have sent a subscribed payment request ${amount} ${receiverCurrency} to ${receiver_name}`,
        //             subject: "You have sent a payment request!",
        //             templateId: "d-2d5f929ed89847d693ab15621b95890f",
        //             phoneMessage: `You have sent a subscribed payment request ${amount} ${receiverCurrency} to ${receiver_name}`
        //         }
        //         const receiverOptions = {
        //             toEmail: receiverDetails?.email ?? "",
        //             phoneNumber: receiverDetails?.phone ?? "",
        //             instaUsername: receiverDetails?.insta_username ?? "",
        //             message: `You have sent a subscribed payment request ${amount} ${sendingCurrency} to ${sender_name}`,
        //             subject: "You have received a payment request!",
        //             templateId: "d-2d5f929ed89847d693ab15621b95890f",
        //             phoneMessage: `You have sent a subscribed payment request ${amount} ${sendingCurrency} to ${sender_name}`
        //         }

        //         console.log("optionstest", senderOptions, receiverOptions)

        //         // email, phone and push notifications

        // sendNotifications(senderWallet.account._id, 'payment_requests', senderOptions)
        // sendNotifications(receiverDetails._id, 'payment_requests', receiverOptions)
        //     }

        //     let resp = await encryption({
        //         status: "true",
        //         message: "Request details.",
        //         subscribtionDetails
        //     })
        //     res.status(200).send(resp);
        // }).catch(async (err) => {
        //     let error = await encryption({
        //         status: "false",
        //         message: "Something went wrong while getting account details"
        //     })
        //     res.status(400).send(error);
        // })


        //     } else {
        //         let error = await encryption({
        //             status: "false",
        //             message: "No account found."
        //         })
        //         res.status(404).send(error);
        //     }
        // }).catch(async (err) => {
        //     let error = await encryption({
        //         status: "false",
        //         message: "Something went wrong while getting account details"
        //     })
        //     res.status(400).send(error);
        // })
    } catch (err) {
        console.log(err);
        return {
            status: false,
            message: "Internal server error!"
        }
    }
}

async function scheduleRequestPaymentW2W(data) {
    try {

        var { amount, wallet_id, purpose, sender, receiver, date, time, timezone, attachments, description } = data;

        let senderWallet = await Wallet.findOne({ $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level']) }])
        let receiverDetails = await Account.findOne({ $and: [{ _id: receiver }, { active: true }] }).populate(['user', 'company'])
        let senderDetails = await Account.findOne({ $and: [{ _id: sender }, { active: true }] }).populate(['user', 'company'])
        if (!senderWallet) {
            return { status: false, message: "Sender Wallet not valid!" }
        }
        if (!senderWallet?.account?.active || !senderDetails) {
            console.log(senderWallet.account.active, senderDetails);
            return { status: false, message: "Invalid Sender!" }
        }

        if (!receiverDetails) {
            return { status: false, message: "Receiver not found!" }
        }


        let objReq = {
            type: 'payment_request',
            service_type: 'wallet_to_wallet',
            status: 'pending',
            purpose: purpose,
            description,
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount,
            wallet_id: senderWallet.wallet_id,
            wallet: senderWallet._id,
            sender: senderWallet.account._id,
            receiver: receiverDetails._id
        }

        let objSch = {
            date: date,
            time: time,
            timezone: timezone,
            cycles: 0,
            type: 'request',
            active: true,
            status: 'processing',
            recursive: false,
            account: senderWallet.account._id,
            request_payment: objReq,
            attachments
        }

        const subscribtionDetails = await Schedule.create(objSch);
        if (subscribtionDetails) {
            return {
                status: true,
                message: "Request details.",
                subscribtionDetails
            }
        } else {
            return {
                status: false,
                message: "Request not created.",
            }
        }
        // Schedule.create().then(async (subscribtionDetails) => {
        //     let resp = await encryption({
        //         status: "true",
        //         message: "Request details.",
        //         subscribtionDetails
        //     })
        //     res.status(200).send(resp);
        //     // notification
        //     const notificationObj = {
        //         title: 'Payment Request Notification',
        //         desc: 'You have received a Scheduled Payment Request.',
        //         type: 'payment_request',
        //         status: 'unread',
        //         from: senderWallet.account._id,
        //         to: receiverDetails._id,
        //         link_id: subscribtionDetails._id,
        //     }

        //     addNotification(notificationObj)
        //     // socket message
        //     sendPrivateMessage(receiverDetails._id, "You have received a Scheduled Payment Request.")

        //     console.log(senderDetails.user, receiverDetails.user)


        //     if (senderDetails?.user && receiverDetails?.user) {

        //         const sender_name = senderDetails?.user ?
        //             senderDetails?.user?.first_name + " " + senderDetails?.user?.last_name :
        //             senderDetails?.company?.company_name
        //         const receiver_name = receiverDetails?.user ?
        //             receiverDetails?.user?.first_name + " " + receiverDetails?.user?.last_name :
        //             receiverDetails?.company?.company_name

        //         const sendingCurrency = senderWallet?.currency?.code;

        //         const receiverCurrency = senderWallet?.currency?.code;

        //         const senderOptions = {
        //             toEmail: senderDetails?.email ?? "",
        //             phoneNumber: senderDetails?.phone ?? "",
        //             instaUsername: senderDetails?.insta_username ?? "",
        //             message: `Hi, you have sent a scheduled payment request ${amount} ${receiverCurrency} to ${receiver_name}`,
        //             subject: "You have sent a payment request!",
        //             templateId: "d-2d5f929ed89847d693ab15621b95890f",
        //             phoneMessage: `You have sent a scheduled payment request ${amount} ${receiverCurrency} to ${receiver_name}`
        //         }
        //         const receiverOptions = {
        //             toEmail: receiverDetails?.email ?? "",
        //             phoneNumber: receiverDetails?.phone ?? "",
        //             instaUsername: receiverDetails?.insta_username ?? "",
        //             message: `You have received a scheduled payment request ${amount} ${sendingCurrency} to ${sender_name}`,
        //             subject: "You have received a payment request!",
        //             templateId: "d-2d5f929ed89847d693ab15621b95890f",
        //             phoneMessage: `You have received a scheduled payment request ${amount} ${sendingCurrency} to ${sender_name}`
        //         }

        //         console.log("optionstest", senderOptions, receiverOptions)

        //         // email, phone and push notifications

        // sendNotifications(senderWallet.account._id, 'payment_requests', senderOptions)
        // sendNotifications(receiverDetails._id, 'payment_requests', receiverOptions)
        //     }

        // }).catch(async (err) => {
        //     let error = await encryption({
        //         status: "false",
        //         message: "Something went wrong while getting account details"
        //     })
        //     res.status(400).send(error);
        // })
    } catch (err) {
        console.log(err);
        return {
            status: false,
            message: "Internal server error!"
        }
    }
}

// reviews functions for payment requests
async function buyerToSellerReview(data) {
    try {
        const { comment, rating, type, request_id } = data;

        const paymentRequest = await RequestPayment.findOne({ _id: request_id, status: "completed" });

        if (paymentRequest) {
            const seller = paymentRequest.sender;
            const buyer = paymentRequest.receiver;
            const existingReview = await RequestReview.findOne({
                review_type: "buyer_to_seller",
                buyer: buyer,
                request: request_id,
            });

            if (existingReview) {
                return { status: false, message: "A review with the same buyer already exists." }
            }
            const newReview = {
                comment,
                request_type: type,
                review_type: "buyer_to_seller",
                rating,
                seller: seller,
                buyer: buyer,
                request: paymentRequest,
            };
            const reviewCreated = await RequestReview.create(newReview);

            const reviewId = reviewCreated._id;

            const updateRequestPayment = await RequestPayment.updateOne({ _id: request_id }, { buyer_comment: reviewId });

            if (updateRequestPayment) {
                return { status: true, message: reviewCreated }
            }
            // RequestReview.create(newReview)
            //     .then(async (reviewCreated) => {
            //         // newly created reveiw
            //         const reviewId = reviewCreated._id;

            //         RequestPayment.updateOne({ _id: request_id }, { buyer_comment: reviewId })
            //             .then(async () => {
            //                 const notificationObj = {
            //                     title: 'Request Review Notification',
            //                     desc: 'Review added successfully.',
            //                     type: 'request_review',
            //                     status: 'unread',
            //                     from: buyer,
            //                     to: seller,
            //                     link_id: request_id,
            //                 }

            //                 addNotification(notificationObj)
            //                 sendPrivateMessage(seller, "Review added successfully.!")
            //                 let ciphertext = await encryption({
            //                     status: true,
            //                     message: "Review created successfully.",
            //                     review: reviewCreated
            //                 });
            //                 res.status(200).send(ciphertext);
            //             })
            //             .catch(async (err) => {
            //                 console.log(err);
            //                 let error = await encryption({
            //                     status: false,
            //                     message: "Something went wrong while updating the PaymentRequest."
            //                 });
            //                 res.status(400).send(error);
            //             });
            //     })
            //     .catch(async (err) => {
            //         console.log(err);
            //         let error = await encryption({
            //             status: false,
            //             message: "Something went wrong while creating the review."
            //         });
            //         res.status(400).send(error);
            //     });
        } else {
            return { status: false, message: "Payment request not completed" }
        }
    } catch (err) {
        console.log(err);
        return { status: false, message: "Something went wrong!" }

    }
};

async function sellerToBuyerReview(data) {
    try {

        const { comment, rating, type, request_id } = data

        const paymentRequest = await RequestPayment.findOne({ _id: request_id, status: "completed" });

        if (paymentRequest) {
            const seller = paymentRequest.sender;
            const buyer = paymentRequest.receiver;
            const buyer_comment_id = paymentRequest.buyer_comment;

            const existingReview = await RequestReview.findOne({
                review_type: "seller_to_buyer",
                seller: seller,
                request: request_id,
            });

            if (existingReview) {
                return { status: false, message: "A review with the same seller and request id already exists." }
            }

            const newReview = {
                comment,
                review_type: "seller_to_buyer",
                request_type: type,
                rating,
                seller: seller,
                buyer: buyer,
                request: paymentRequest,
                linked_review: buyer_comment_id,

            };

            const reviewCreated = await RequestReview.create(newReview);

            const updateReview = await RequestReview.updateOne(
                { _id: buyer_comment_id },
                { linked_review: reviewCreated._id }
            )

            const updateRequest = await RequestPayment.updateOne(
                { _id: request_id },
                { seller_comment: reviewCreated._id }
            )

            if (updateRequest) {
                return { status: true, message: reviewCreated }
            }
            // RequestReview.create(newReview)
            //     .then(async (reviewCreated) => {

            //         // Update the linked_review in the found Review based on buyer_comment_id
            //         RequestReview.updateOne(
            //             { _id: buyer_comment_id },
            //             { linked_review: reviewCreated._id }
            //         )
            //             .then(() => {
            //                 // Update the PaymentRequest with the seller_comment
            //                 RequestPayment.updateOne(
            //                     { _id: request_id },
            //                     { seller_comment: reviewCreated._id }
            //                 )
            //                     .then(async () => {
            //                         let ciphertext = await encryption({
            //                             status: true,
            //                             message: "Review created successfully.",
            //                             review: reviewCreated
            //                         });
            //                         res.status(200).send(ciphertext);
            //                         const notificationObj = {
            //                             title: 'Request Review Notification',
            //                             desc: 'Review added successfully.',
            //                             type: 'request_review',
            //                             status: 'unread',
            //                             from: seller,
            //                             to: buyer,
            //                             link_id: request_id,
            //                         }

            //                         addNotification(notificationObj)
            //                         sendPrivateMessage(buyer, "Review has been added.")
            //                     })
            //                     .catch(async () => {

            //                         return { status: false, message: "Something went wrong while updating the PaymentRequest." }

            //                     });
            //             })
            //             .catch(async () => {
            //                 return { status: false, message: "Something went wrong while updating the linked_review." }

            //             });
            //     })
            //     .catch(async () => {
            //         return { status: false, message: "Something went wrong while creating the review." }

            //     });
        } else {
            return { status: false, message: "Payment request not found or not completed!" }
        }
    } catch (err) {
        console.log(err);
        return { status: false, message: "Something went wrong!" }
    }
};

async function sellerToBuyerReply(data) {
    try {
        const { reply, buyer_comment_id } = data;

        const buyerReview = await RequestReview.findOne({ _id: buyer_comment_id, review_type: "buyer_to_seller" });


        if (buyerReview) {
            if (buyerReview.reply) {
                return { status: false, message: "Reply already exists.", };
            }
            const requestReviewUpdt = await RequestReview.updateOne(
                { _id: buyer_comment_id },
                { reply: reply }
            );

            if (requestReviewUpdt) {
                return { status: true, message: "Reply added successfully." }
            } else {
                return { status: false, message: "Something went wrong while adding the Reply." }
            }
        } else {
            return {
                status: false, message: "Buyer comment could not be found!"
            }

        }

        // if (buyerReview) {
        //     RequestReview.updateOne(
        //         { _id: buyer_comment_id },
        //         { reply: reply }
        //     ).then(async () => {
        //         let ciphertext = await encryption({
        //             status: true,
        //             message: "Reply added successfully.",
        //         });
        //         res.status(200).send(ciphertext);
        //         const notificationObj = {
        //             title: 'Request Review Notification',
        //             desc: 'Reply has been added.',
        //             type: 'request_review',
        //             status: 'unread',
        //             from: buyerReview.seller,
        //             to: buyerReview.buyer,
        //             link_id: buyer_comment_id,
        //         }

        //         addNotification(notificationObj)
        //         sendPrivateMessage(buyerReview.buyer, "Review added successfully.!")
        //     })
        //         .catch(async () => {
        //             let error = await encryption({
        //                 status: false,
        //                 message: "Something went wrong while adding the Reply."
        //             });
        //             res.status(400).send(error);
        //         });
        // }
        // else {
        //     let error = await encryption({
        //         status: false,
        //         message: "Buyer comment could not be found!"
        //     });
        //     res.status(400).send(error);
        // }

    } catch (err) {
        console.log(err);
        return { status: false, message: "Something went wrong!" }

    }
};

async function getReviewsBySeller(seller_id) {

    try {
        const reviews = await RequestReview.find({
            seller: seller_id,
            review_type: "seller_to_buyer",
            delete_status: false
        }).sort({ createdAt: -1 })

        console.log(reviews, "reviews")

        if (reviews.length === 0) {
            return { status: false, message: "No reviews found for the specified seller." }
        }

        return { status: true, message: reviews.reverse() }

    } catch (err) {
        console.log(err);
        return { status: false, message: 'Something went wrong' }

    }
};

// QUOTATION RELATED HELPERS
async function getImageBuffer(imageUrl) {
    const axios = require('axios');
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
}

// create quotation
async function addQuotation(data) {
    try {
        const { account_id, reciever_id, title, desc, amount, bargain, sender_wallet_id, images } = data;
        console.log(data, "consolecheck")

        const user = await Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).populate('user').populate('company');

        if (!user) {
            return { status: false, message: "User not found!" };
        }

        const wallet = await Wallet.findById(sender_wallet_id);

        if (!wallet) {
            return { status: false, message: "Wallet not found!" };
        }

        const newQuotation = new Quotation({
            reference_id: 'qa_' + Date.now().toString(),
            title,
            desc,
            amount,
            bargain,
            sender: account_id,
            reciever: reciever_id,
            amount_reciever_currency: sender_wallet_id,
            status: "sent",
            images,
        });

        // const bucketName = process.env.AWS_BUCKET_NAME;

        // for (const imageUrl of images) {
        //     const params = {
        //         Bucket: bucketName,
        //         Key: `quotations/${user._id}/${Date.now()}-${Math.floor(Math.random() * 100000)}.jpg`,
        //         Body: await getImageBuffer(imageUrl?.url),
        //         ContentType: 'image/jpeg'
        //     };

        //     try {
        //         const uploadResult = await s3.upload(params).promise();
        //         newQuotation.images.push({
        //             key: uploadResult.Key,
        //             url: uploadResult.Location,
        //             ETag: uploadResult.ETag
        //         });
        //     } catch (error) {
        //         console.error("Error uploading image to S3:", error);
        //         return { status: false, message: 'Something went wrong' };

        //     }
        // }

        const createdQuotation = await newQuotation.save();

        const receiver = await Account.findOne({ $and: [{ _id: reciever_id }, { active: true }] }).populate('user').populate('company');
        console.log(receiver, "receivertest")

        if (createdQuotation) {

            const notificationObj = {
                title: 'Quotation Notification',
                desc: 'Quotation has been created',
                type: 'quotation',
                status: 'unread',
                from: account_id,
                to: reciever_id,
                link_id: createdQuotation._id,
            }

            addNotification(notificationObj)

            if (user?.user && receiver?.user) {

                const sender_name = user?.user ?
                    user?.user?.first_name + " " + user?.user?.last_name :
                    user?.company?.company_name
                const receiver_name = receiver.user ?
                    receiver?.user?.first_name + " " + receiver?.user?.last_name :
                    receiver?.company?.company_name

                const senderOptions = {
                    toEmail: user?.email ?? "",
                    phoneNumber: user?.phone ?? "",
                    instaUsername: user?.insta_username ?? "",
                    message: `Hi, you have successfully created a quotation of ${amount} ${wallet.currency.code} to ${receiver_name}`,
                    subject: "You have sent a quotation in your Instapay Account!",
                    templateId: "d-2d5f929ed89847d693ab15621b95890f",
                    phoneMessage: `Quotation amount sent of ${amount} ${wallet.currency.code} to ${receiver_name}`
                }
                const receiverOptions = {
                    toEmail: receiver?.email ?? "",
                    phoneNumber: receiver?.phone ?? "",
                    instaUsername: receiver?.insta_username ?? "",
                    message: `Hi, you have successfully received a quotation of ${amount} ${wallet.currency.code} from ${sender_name}`,
                    subject: "You have received a quotation in your Instapay Account!",
                    templateId: "d-2d5f929ed89847d693ab15621b95890f",
                    phoneMessage: `Quotation recieved of ${amount} ${wallet.currency.code} from ${sender_name}`
                }

                console.log(senderOptions, receiverOptions, "receiverOptions")
                // email, phone and push notifications
                // sendNotifications(account_id, 'quotation', senderOptions)
                // sendNotifications(reciever_id, 'quotation', receiverOptions)
                // socket notification
                sendPrivateMessage(reciever_id, "You have received a quotation")
                sendPrivateMessage(account_id, "You have sent a quotation.")


            }
        }

        return { status: true, message: createdQuotation };

    } catch (err) {
        console.log(err);
        return { status: false, message: err };

    }
};

// accept quotation
async function acceptQuotation(data) {
    try {
        const { receiver_wallet_id, quotation_id } = data;
        let amount;
        const quotation = await Quotation.findById(quotation_id);
        console.log(quotation, quotation_id, "quotation_id")
        if (quotation.revised_amount) {
            amount = quotation.revised_amount;
        } else {
            amount = quotation.amount;
        }

        let senderWallet = await Wallet.findOne({
            $and: [
                { _id: receiver_wallet_id },
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
        })
            .populate([
                {
                    path: 'account',
                    populate: [
                        { path: 'user' },
                        { path: 'company' },
                        { path: 'level' }
                    ]
                }
            ]);

        let receiverWallet = await Wallet.findOne({
            $and: [
                { _id: quotation.amount_reciever_currency },
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
        })
            .populate([
                {
                    path: 'account',
                    populate: [
                        { path: 'user' },
                        { path: 'company' },
                        { path: 'level' }
                    ]
                }
            ]);

        if (!senderWallet) {
            return { status: false, message: "Invalid Sender!" };
        }

        if (!receiverWallet) {
            return { status: false, message: "Invalid Receiver!" };
        }

        // if (senderWallet.account._id.toString() !== req.user._id.toString() || !senderWallet.account.active) {
        //     return { status: false, message: "Invalid Sender!" };
        // }

        if (!receiverWallet.account.active) {
            return { status: false, message: "Invalid Receiver!" };
        }

        let senderLimit = senderWallet.account.level.sending_limit;
        let receiverLimit = receiverWallet.account.level.receiving_limit;
        if (senderWallet.account.is_external_limit) {
            senderLimit = senderWallet.account.sending_limit;
        }
        if (receiverWallet.account.is_external_limit) {
            receiverLimit = senderWallet.account.receiving_limit;
        }

        let excRate = await exchangeRateApi(senderWallet.currency.code, receiverWallet.currency.code, amount, senderWallet.account.level._id, 'wallet_to_wallet');
        let totalAmount = amount + excRate.fee.exchange_fee;

        if (senderWallet.balance.available < (amount + excRate.fee.exchange_fee)) {
            return { status: false, message: "Insufficient balance!" };
        }

        if (senderLimit < totalAmount) {
            return { status: false, message: "Sending limit exceeded!" };
        }

        if (receiverLimit < excRate.exchanged_amount) {
            return { status: false, message: "Receiver account receiving limit exceeded!" };
        }

        let senderBalance = senderWallet.balance.available - (amount + excRate.fee.exchange_fee);
        let receiverBalance = receiverWallet.balance.available + excRate.exchanged_amount;
        let ref = 'tr_' + Date.now().toString();
        let senderTransactionObj = {
            reference_id: ref,
            type: 'transfer',
            transaction_type: 'debit',
            service_type: 'wallet_to_wallet',
            payment_type: "quotation",
            status: 'completed',
            purpose: quotation.title,
            description: quotation.desc,
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
        };
        let receiverTransactionObj = {
            reference_id: ref,
            type: 'transfer',
            transaction_type: 'credit',
            service_type: 'wallet_to_wallet',
            payment_type: "quotation",
            status: 'completed',
            purpose: quotation.title,
            description: quotation.desc,
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
        };

        const newSenderBalance = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderBalance } });
        if (newSenderBalance.acknowledged && newSenderBalance.modifiedCount == 1) {
            let supdt = await Transaction.create(senderTransactionObj);
            if (supdt) {
                const newReceiverBalance = await Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } });
                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                    let rupdt = await Transaction.create(receiverTransactionObj);
                    if (rupdt) {
                        await Quotation.findByIdAndUpdate(quotation_id, { $set: { status: 'accepted' } });
                        const notificationObj = {
                            title: 'Quotation Notification',
                            desc: 'Quotation amount recieved succesfully!',
                            type: 'quotation',
                            status: 'unread',
                            from: quotation.reciever,
                            to: quotation.sender,
                            link_id: quotation._id,
                        }

                        if (senderWallet?.account?.user && receiverWallet?.account?.user) {

                            const sender_name = senderWallet?.account?.user ?
                                senderWallet?.account?.user?.first_name + senderWallet?.account?.user?.last_name :
                                senderWallet?.account?.company?.company_name
                            const receiver_name = receiverWallet?.account?.user ?
                                receiverWallet?.account?.user?.first_name + receiverWallet?.account?.user?.last_name :
                                receiverWallet?.account?.company?.company_name
                            const senderOptions = {
                                toEmail: senderWallet?.account?.email ?? "",
                                phoneNumber: senderWallet?.account?.phone ?? "",
                                instaUsername: senderWallet?.account?.insta_username ?? "",
                                message: `You have sent a quotation of ${amount} ${senderWallet?.currency.code} to ${receiver_name}`,
                                subject: "You have sent a quotation in your Instapay Account!",
                                templateId: "d-2d5f929ed89847d693ab15621b95890f",
                                phoneMessage: `Quotation amount sent of ${amount} ${senderWallet?.currency.code} to ${receiver_name}`
                            }
                            const receiverOptions = {
                                toEmail: receiverWallet?.account?.email ?? "",
                                phoneNumber: receiverWallet?.account?.phone ?? "",
                                instaUsername: receiverWallet?.account?.insta_username ?? "",
                                message: `You have recieved a quotation of ${excRate.exchanged_amount} ${receiverWallet?.currency?.code} from ${sender_name}`,
                                subject: "You have received a quotation in your Instapay Account!",
                                templateId: "d-2d5f929ed89847d693ab15621b95890f",
                                phoneMessage: `Quotation recieved of ${excRate.exchanged_amount} ${receiverWallet?.currency?.code} from ${sender_name}`
                            }
                            console.log(senderOptions, "receiver", receiverOptions)

                            // email, phone and push notifications
                            // sendNotifications(senderWallet?.account, 'quotation', senderOptions)
                            // sendNotifications(receiverWallet?.account, 'quotation', receiverOptions)
                        }


                        // system notification
                        addNotification(notificationObj)

                        // socket message
                        sendPrivateMessage(quotation.sender, "You have received the quotation amount succesfully!")
                        sendPrivateMessage(quotation.reciever, "You have sent the quotation amount succesfully!")
                        console.log(quotation.reciever, "quotation.reciever", quotation.sender, "quotation.sender")


                        return { status: true, message: quotation };
                    } else {
                        let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id });
                        let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } });
                        let wrupdt = await Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverWallet.balance.available } });
                        return { status: false, message: "Transaction failed!" };
                    }
                } else {
                    let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id });
                    let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } });
                    return { status: false, message: "Transaction failed!" };
                }
            }

        } else {
            return { status: false, message: "Transaction failed!" };
        }
    } catch (err) {
        console.log(err);
        return { status: false, message: "Transaction failed!" };
    }
}

// bargain the quotation
async function bargain(data) {
    try {
        const { revised_amount, quotation_id } = data;

        const quotation = await Quotation.findOne({ $and: [{ _id: quotation_id }, { bargain: true }] })
            .populate({ path: 'sender', populate: { path: 'user', select: 'first_name last_name' } })
            .populate({ path: 'reciever', populate: { path: 'user', select: 'first_name last_name' } })
            .populate('amount_sender_currency')
            .populate('amount_reciever_currency');

        if (!quotation) {
            return { status: false, message: "Quotation not found!" };
        } else {
            quotation.revised_amount = revised_amount;
            quotation.status = "bargain";
            await quotation.save();

            const notificationObj = {
                title: 'Quotation Notification',
                desc: 'Bargain amount has been added',
                type: 'quotation',
                status: 'unread',
                from: quotation.reciever,
                to: quotation.sender,
                link_id: quotation._id
            }

            addNotification(notificationObj);
            sendPrivateMessage(quotation.sender._id, "Bargaining amount has been added!");
            sendPrivateMessage(quotation.reciever._id, "You have added the bargain amount!");
            console.log(quotation.reciever, "quotation.reciever", quotation.sender, "quotation.sender")


            if (quotation?.sender?.user && quotation?.reciever?.user) {
                const sender_name = quotation?.sender?.user ? quotation?.sender?.user.first_name + " " + quotation?.sender?.user?.last_name : quotation?.sender?.company?.company_name;
                const receiver_name = quotation?.reciever?.user ? quotation?.reciever?.user?.first_name + " " + quotation?.reciever?.user?.last_name : quotation?.reciever?.company?.company_name;
                const sendingCurrency = quotation?.amount_reciever_currency?.currency.code;
                const receiverCurrency = quotation?.amount_reciever_currency?.currency.code;

                const senderOptions = {
                    toEmail: quotation?.reciever?.email ?? "",
                    phoneNumber: quotation?.reciever?.phone ?? "",
                    instaUsername: quotation?.reciever?.insta_username ?? "",
                    message: `Hi, you have successfully entered a bargaining amount of ${revised_amount} ${sendingCurrency} to ${sender_name}`,
                    subject: "You have sent a bargaining amount!",
                    templateId: "d-2d5f929ed89847d693ab15621b95890f",
                    phoneMessage: `You have requested a bargaining amount of ${revised_amount} ${sendingCurrency} to ${sender_name}`
                }
                const receiverOptions = {
                    toEmail: quotation?.sender?.email ?? "",
                    phoneNumber: quotation?.sender?.phone ?? "",
                    instaUsername: quotation?.sender?.insta_username ?? "",
                    message: `Hi, you have been requested a bargained amount of ${revised_amount} ${receiverCurrency} from ${receiver_name}`,
                    subject: "You have been requested a bargained amount in your Instapay Account!",
                    templateId: "d-2d5f929ed89847d693ab15621b95890f",
                    phoneMessage: `You have been requested a bargained amount of ${revised_amount} ${receiverCurrency} from ${receiver_name}`
                }

                // sendNotifications(quotation?.reciever, 'quotation', senderOptions);
                // sendNotifications(quotation?.sender, 'quotation', receiverOptions);
            }

            return { status: true, message: "Bargain amount added successfully", quotation: quotation };
        }
    } catch (err) {
        console.log(err);
        return { status: false, message: "Internal server error!" };
    }
}

// revise the bargained amount
async function revise(data) {
    try {
        const { revised_amount, quotation_id } = data;

        const quotation = await Quotation.findOne({ $and: [{ _id: quotation_id }, { bargain: true }] })
            .populate({ path: 'sender', populate: { path: 'user', select: 'first_name last_name' } })
            .populate({ path: 'reciever', populate: { path: 'user', select: 'first_name last_name' } })
            .populate('amount_sender_currency')
            .populate('amount_reciever_currency');

        if (!quotation) {
            return { status: false, message: "Quotation not found!" };
        } else {
            quotation.revised_amount = revised_amount;
            quotation.status = "revise";

            await quotation.save();

            const notificationObj = {
                title: 'Quotation Notification',
                desc: 'Revised amount has been added',
                type: 'quotation',
                status: 'unread',
                from: quotation.sender,
                to: quotation.reciever,
                link_id: quotation._id,
            }

            addNotification(notificationObj);
            console.log(quotation.reciever, "quotation.reciever")
            sendPrivateMessage(quotation.reciever._id, "Revised amount has been added!");
            sendPrivateMessage(quotation.sender._id, "You have added the revised amount!");
            console.log(quotation.reciever, "quotation.reciever", quotation.sender, "quotation.sender")



            if (quotation?.sender?.user && quotation?.reciever?.user) {
                const sender_name = quotation?.sender?.user ? quotation?.sender?.user?.first_name + " " + quotation?.sender?.user?.last_name : quotation?.sender?.company?.company_name;
                const receiver_name = quotation?.reciever?.user ? quotation?.reciever?.user?.first_name + " " + quotation?.reciever?.user?.last_name : quotation?.reciever?.company?.company_name;
                const sendingCurrency = quotation?.amount_reciever_currency?.currency.code;
                const receiverCurrency = quotation?.amount_reciever_currency?.currency.code;

                const senderOptions = {
                    toEmail: quotation?.sender?.email ?? "",
                    phoneNumber: quotation?.sender?.phone ?? "",
                    instaUsername: quotation?.sender?.insta_username ?? "",
                    message: `Hi, you have successfully entered a revised amount of ${revised_amount} ${receiverCurrency} to ${receiver_name}`,
                    subject: "You have sent a revised amount!",
                    templateId: "d-2d5f929ed89847d693ab15621b95890f",
                    phoneMessage: `You have requested a revised amount of ${revised_amount} ${receiverCurrency} to ${receiver_name}`
                }
                const receiverOptions = {
                    toEmail: quotation?.reciever?.email ?? "",
                    phoneNumber: quotation?.reciever?.phone ?? "",
                    instaUsername: quotation?.reciever?.insta_username ?? "",
                    message: `Hi, you have been requested a revised amount of ${revised_amount} ${sendingCurrency} from ${sender_name}`,
                    subject: "You have been requested a revised amount in your Instapay Account!",
                    templateId: "d-2d5f929ed89847d693ab15621b95890f",
                    phoneMessage: `You have been requested a revised amount of ${revised_amount} ${sendingCurrency} from ${sender_name}`
                }

                // sendNotifications(quotation?.reciever, 'quotation', senderOptions);
                // sendNotifications(quotation?.sender, 'quotation', receiverOptions);
            }

            return { status: true, message: "Quotation revised successfully", quotation: quotation };
        }
    } catch (err) {
        console.log(err);
        return { status: false, message: "Internal server error!" };
    }
};

async function declineQuotation(quotation_id) {
    try {

        const updatedQuotation = await Quotation.findByIdAndUpdate(quotation_id, { $set: { decline_status: true, status: 'declined' } }, { new: true })
            .populate({ path: 'sender', populate: { path: 'user', select: 'first_name last_name' } })
            .populate({ path: 'reciever', populate: { path: 'user', select: 'first_name last_name' } })
            .populate('amount_sender_currency')
            .populate('amount_reciever_currency');

        const notificationObj = {
            title: 'Quotation Notification',
            desc: 'Quotation has been declined',
            type: 'quotation',
            status: 'unread',
            from: updatedQuotation?.sender,
            to: updatedQuotation?.reciever,
            link_id: updatedQuotation?._id,
        }

        addNotification(notificationObj)
        sendPrivateMessage(updatedQuotation?.reciever, "Quotation has been declined")

        if (updatedQuotation?.reciever?.user && updatedQuotation?.sender?.user) {
            console.log(updatedQuotation?.sender?.user, updatedQuotation?.reciever?.user)
            const sender_name = updatedQuotation?.sender?.user ?
                updatedQuotation?.sender?.user?.first_name + " " + updatedQuotation?.sender?.user?.last_name :
                updatedQuotation?.sender?.company?.company_name
            const receiver_name = updatedQuotation?.reciever?.user ?
                updatedQuotation?.reciever?.user?.first_name + " " + updatedQuotation?.reciever?.user?.last_name :
                updatedQuotation?.reciever?.company?.company_name
            const sendingCurrency = updatedQuotation?.amount_reciever_currency?.currency?.code;

            const receiverCurrency = updatedQuotation?.amount_reciever_currency?.currency?.code;

            const senderOptions = {
                toEmail: updatedQuotation?.reciever?.email ?? "",
                phoneNumber: updatedQuotation?.reciever?.phone ?? "",
                instaUsername: updatedQuotation?.reciever?.insta_username ?? "",
                message: `Hi, you have declined a quotation of ${updatedQuotation?.revised_amount} ${sendingCurrency} to ${sender_name}`,
                subject: "You have declined a quotation!",
                templateId: "d-2d5f929ed89847d693ab15621b95890f",
                phoneMessage: `You have declined a quotation of ${updatedQuotation?.revised_amount} ${sendingCurrency} to ${sender_name}`
            }
            const receiverOptions = {
                toEmail: updatedQuotation?.sender?.email ?? "",
                phoneNumber: updatedQuotation?.sender?.phone ?? "",
                instaUsername: updatedQuotation?.sender?.insta_username ?? "",
                message: `Your quotation of ${updatedQuotation?.revised_amount} ${receiverCurrency} has been declined from ${receiver_name}`,
                subject: "Your quotation has been declined!",
                templateId: "d-2d5f929ed89847d693ab15621b95890f",
                phoneMessage: `Your quotation of ${updatedQuotation?.revised_amount} ${receiverCurrency} has been declined from ${receiver_name}`
            }


            // email, phone and push notifications
            // sendNotifications(updatedQuotation?.reciever, 'quotation', senderOptions)
            // sendNotifications(updatedQuotation?.sender, 'quotation', receiverOptions)
        }


        if (!updatedQuotation) {
            return { status: false, message: "Quotation not found!" }
        }

        return { status: true, message: "Quotation decline!" }
    } catch (err) {
        console.log(err);
        return { status: false, message: "Internal server error" }

    }
};

// AIRTIME Functions

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
// number verification function
async function numberVerificationAirtime(number) {
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

        return { status: true, message: identifiedObjects }


    } catch (error) {
        console.error('Error getting status:', error);

        if (error.response && error.response.data && error.response.data.errors) {
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');

            return { status: false, message: errorMessages }

        } else {
            return { status: true, message: 'An error occurred while getting the status' }

        }
    }
};

// sub services
async function getSubservices(data) {
    try {
        const apiUrl = 'https://dvs-api.dtone.com/v1/products';
        //const apiUrl = 'https://preprod-dvs-api.dtone.com/v1/products';  // pre prod
        const isoCode = data.isoCode;
        const operator_id = data.operator_id;
        const perPage = 1;     // ONE SINCE WE ARE USING IT TO JUST CHECK IF A SUBSERVICE EXISTS OR NOT
        const serviceId = data.serviceId.toString();

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

        let responses = null;



        // CONCURRENLTY WE MAKE THREE REQUESTS WITH DIFFERENT SERVICE_IDS   
        if (serviceId === '1') {
            responses = await Promise.all([fetchSubServiceData(11), fetchSubServiceData(12), fetchSubServiceData(13)]);
            console.log("1 ran", responses)

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
        const allNullResponses = responses?.every(response => response === null);

        // MESSAGE IS RETURNED IF ALL VALUES ARE NULL
        if (allNullResponses) {
            return { status: false, message: "No Sub-Services For This Service_ID" }
        }

        // WE FILTER EVERYTHING AND ONLY RETURN THE NAME OF THE SERVICE AND ID FROM THE PRODUCT INFO
        const subServiceInfoArray = responses
            ?.filter(response => response !== null)
            ?.map(responseData => ({
                id: responseData[0]?.service.subservice.id,
                name: responseData[0]?.service.subservice.name
            }));

        console.log(subServiceInfoArray, "subServiceInfoArray")
        return { status: true, message: subServiceInfoArray }

    } catch (error) {
        console.error('Error getting status:', error);
        // RETURNS THE ERROR WE GET FROM DTONE
        if (error.response && error.response.data && error.response.data.errors) {
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');

            return { status: false, message: errorMessages }

        } else {
            // RETURNS THIS ERROR IF THERE IS A PROBLEM IN OUT CODE 
            return { status: true, message: 'An error occurred while getting the status' }

        }
    }
};

// get products
async function getProductsofSubservices(data) {
    try {

        const wallet_id = data.wallet_id
        const wallet = await Wallet.findOne({ _id: wallet_id });

        let currency = wallet.currency.code

        const apiUrl = `https://dvs-api.dtone.com/v1/products`;
        const isoCode = data.isoCode;
        const operator_id = data.operator_id;
        const perPage = 100;
        const serviceId = data.serviceId;
        const subservice_id = data.subservice_id;
        let totalPages = 0

        console.log(subservice_id, serviceId, operator_id, isoCode, "subservice_id, serviceId, operator_id, isoCode")

        // hardcoded for now
        const markup_fee = 1;
        const markup_type = 'flat'
        const percentage_markup = 6.5
        const markup_currency = 'USD'
        // let markup = 0

        // const markup_fee = fees?.flat_markup;
        // const markup_type = fees?.markup_type;
        // const percentage_markup = fees?.percentage_markup;
        // const markup_currency = fees?.markup_currency;

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

                const unitInBenefits = response[0]?.benefits[0]?.unit;

                let exchangerate = await convertCurrency(unitInBenefits, currency, 1)
                exchangerate = exchangerate.toFixed(3)

                const products = response.map(item => {
                    const originalMax = item.benefits[0]?.amount.base.max;
                    const originalMin = item.benefits[0]?.amount.base.min;

                    const adjustedMax = ((originalMax * 0.98) * exchangerate).toFixed(3)  // decreasing by 2% 
                    const adjustedMin = ((originalMin * 1.02) * exchangerate).toFixed(3)  // increasing by 2% 

                    const extractedItem = {
                        name: item.name,
                        id: item.id,
                        baseAmount: {
                            max: parseFloat(adjustedMax),
                            min: parseFloat(adjustedMin)
                        },
                        unit: currency //item.benefits[0]?.unit the original curency
                    };

                    return extractedItem;
                });

                //console.log(extractedDataWithAdjustedValues);
                //return  res.json(response);

                // const output = await encryption({ products });
                return { status: true, message: { products } }


            }

        }
        responses = await Promise.all([fetchProductsByPage(1), fetchProductsByPage(2), fetchProductsByPage(3)]);

        const allNullResponses = responses.every(response => response === null);
        console.log(responses, "responsess")
        // MESSAGE IS RETURNED IF ALL VALUES ARE NULL
        if (allNullResponses) {
            return { status: false, message: 'No Products' }

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
        const SourceCurrencyUnit = flatarray[0]?.source.unit;

        // getting the exchange rate and saving it to use for conversions
        let exchangerate = await convertCurrency(SourceCurrencyUnit, currency, 1)
        exchangerate = exchangerate.toFixed(3)


        //calculating the markup
        if (markup_type === 'flat') {
            if (markup_currency === currency) {
                markup = markup_fee
            } else {
                if (markup_currency === 'USD') { // I have changed it into USD as it was undefined here
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
                prices: prices
            };
        });

        return { status: true, message: { products } }


    } catch (error) {
        if (error.response) {
            const statusCode = error.response.status;
            const errorMessage = error.response.statusText;
            console.error(`Error getting status: ${statusCode} - ${errorMessage}`);

            const err = statusCode + " " + errorMessage
            return { status: false, message: err }


        }
        else {
            console.log("error:" + error)
            return { status: false, message: "an error occured" }
        }


    }
};

// get selected product's price
async function getProductsPrice(data) {
    try {
        const wallet_id = data.wallet_id
        const wallet = await Wallet.findOne({ _id: wallet_id }).populate([{ path: 'account', populate: [{ path: 'level' }] }])
        if (!wallet) {
            return { status: false, message: "Wallet not found" };
        }
        console.log(data, "data")
        // console.log(wallet)
        const accountLevelId = wallet.account.level._id
        const balance = wallet.balance.available

        // const fees = await Fee.findOne({ account_level: accountLevelId }).populate('account_level');

        const fees = await Fee.findOne({ $and: [{ service_name: data.service || 'airtime' }, { account_level: wallet.account.level._id }] }).populate('account_level');

        const fee_type = fees.fee_type
        const flat_fee = fees.flat_fee
        const percentage_fee = fees.percentage_fee
        const fee_currency = fees.fee_currency                 // currency of the fee
        const sending_limit = !wallet.account.is_external_limit ? fees.account_level.sending_limit : wallet.account.external_limits.transaction_amount_limit
        const daily_sending_limit = !wallet.account.is_external_limit ? fees.account_level.daily_sending_limit : wallet.account.external_limits.daily_sending_limit
        const monthly_sending_limit = !wallet.account.is_external_limit ? fees.account_level.monthly_sending_limit : wallet.account.external_limits.monthly_sending_limit
        const yearly_sending_limit = !wallet.account.is_external_limit ? fees.account_level.yearly_sending_limit : wallet.account.external_limits.yearly_sending_limit

        const markup_fee = 1;
        const markup_type = 'flat'
        const percentage_markup = 6.5
        const markup_currency = 'USD'

        // const markup_fee = fees?.flat_markup;
        // const markup_type = fees?.markup_type;
        // const percentage_markup = fees?.percentage_markup;
        // const markup_currency = fees?.markup_currency;

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

        const product_id = data.product_id;
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
        console.log(responseData, "responseData", responseData.service.subservice.id)
        const sub_service_id = responseData.service.subservice.id


        if (sub_service_id == 11) {
            console.log("subservice is running")
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
            const SourceCurrencyUnit = responseData.benefits[0]?.unit;
            let exchangerate = await convertCurrency(SourceCurrencyUnit, currency, 1);
            exchangerate = exchangerate.toFixed(3);


            // currency of the service (Dtone)  
            const SourceCurrency = responseData.source.unit;

            console.log(fee_type, "fee_typeinprod")
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

            console.log(fee, "feeinprod", flat_fee)

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
                console.log(limitCheck1, "limitCheck1")
                if (!limitCheck1.status) {
                    // if the total amount is more than the sending limit then this will be returned 
                    if (limitCheck1.code === "tal400") {
                        return { status: false, message: 'Entered amount is more than your allowed sending limit' };

                    }
                    // if the exchangeTotal amount is more than the daily sending limit then this will be returned 
                    if (limitCheck1.code === "sdl400") {
                        return { status: false, message: 'Entered amount is more than daily allowed sending limit' };

                    }
                    // if the exchangeTotal amount is more than the monthly sending limit then this will be returned 
                    if (limitCheck1.code === "sml400") {
                        return { status: false, message: 'Entered amount is more than monthly allowed sending limit' };

                    }
                    // if the exchangeTotal amount is more than the yearly sending limit then this will be returned 
                    if (limitCheck1.code === "syl400") {
                        return { status: false, message: 'Entered amount is more than yearly allowed sending limit' };

                    }
                    if (limitCheck1.code === "dtc400") {
                        return { status: false, message: 'Your daily transaction count limit is exceeded!' };
                    }
                    if (limitCheck1.code === "mtc400") {
                        return { status: false, message: 'Your monthly transaction count limit is exceeded!' };
                    }
                    if (limitCheck1.code === "ytc400") {
                        return { status: false, message: 'Your yearly transaction count limit is exceeded!' };
                    }
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

                return { status: true, message: { payload: response, token } }
            } else {
                let amount = data.amount   // the amount the user wants to send

                if (!amount) {
                    return { status: false, message: 'amount not given' };
                }

                let responseDataArray = [responseData]  // objects are being returned, keeping it in a array so filtering is similar to the all the other api outputs


                if (markup_type === 'percentage') {
                    const percentage_markup_amount = (percentage_markup / 100) * parseInt(amount);
                    markup = percentage_markup_amount;
                }

                if (fee_type === 'percentage') {
                    const percentage_fee_amount = (percentage_fee / 100) * parseInt(amount);
                    fee = percentage_fee_amount;
                }
                console.log(fee, "feeinprofucts1", parseFloat(fee), Number(parseFloat(fee).toFixed(3)))

                // extracting important data from the api response and filtering and adding fees & total
                const extractedDataWithAdjustedValues = responseDataArray.map(item => {
                    const originalMax = item.benefits[0]?.amount.base.max;
                    const originalMin = item.benefits[0]?.amount.base.min;

                    let adjustedMax = ((originalMax * 0.98) * exchangerate).toFixed(3);  // decreasing by 2% 
                    let adjustedMin = ((originalMin * 1.02) * exchangerate).toFixed(3); // increasing by 2% 

                    sending_amount = amount;

                    amount_dtone = sending_amount - markup

                    adjustedMax = parseFloat(adjustedMax) + markup;
                    adjustedMin = parseFloat(adjustedMin) + markup;



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
                        total: parseFloat(data.amount),
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

                const total = extractedDataWithAdjustedValues[0]?.total

                const convertedTotal = await convertCurrency(currency, 'USD', total)

                console.log(convertedTotal, "convertedTotal", total, "total")

                let limitCheck1 = limitCheck(convertedTotal, wallet.account.level, wallet.account, 'sending');
                if (!limitCheck1.status) {
                    // if the total amount is more than the sending limit then this will be returned 
                    if (limitCheck1.code === "tal400") {
                        return { status: false, message: 'Entered amount is more than your allowed sending limit' };

                    }
                    // if the exchangeTotal amount is more than the daily sending limit then this will be returned 
                    if (limitCheck1.code === "sdl400") {
                        return { status: false, message: 'Entered amount is more than daily allowed sending limit' };

                    }
                    // if the exchangeTotal amount is more than the monthly sending limit then this will be returned 
                    if (limitCheck1.code === "sml400") {
                        return { status: false, message: 'Entered amount is more than monthly allowed sending limit' };

                    }
                    // if the exchangeTotal amount is more than the yearly sending limit then this will be returned 
                    if (limitCheck1.code === "syl400") {
                        return { status: false, message: 'Entered amount is more than yearly allowed sending limit' };

                    }
                    if (limitCheck1.code === "dtc400") {
                        return { status: false, message: 'Your daily transaction count limit is exceeded!' };
                    }
                    if (limitCheck1.code === "mtc400") {
                        return { status: false, message: 'Your monthly transaction count limit is exceeded!' };
                    }
                    if (limitCheck1.code === "ytc400") {
                        return { status: false, message: 'Your yearly transaction count limit is exceeded!' };
                    }
                }
                // if the total amount is more than the balance then this will be returned 
                if (total > balance) {
                    return { status: false, message: `Insufficient Balance, you current balance in this wallet is ${balance}` };
                }

                if (extractedDataWithAdjustedValues[0]?.sending_amount > extractedDataWithAdjustedValues[0]?.baseAmount.max) {
                    return { status: false, message: 'Entered amount is more than the maximum' };
                }

                console.log(extractedDataWithAdjustedValues[0]?.sending_amount, extractedDataWithAdjustedValues[0]?.baseAmount.min, "this is the data to be sent to the user")
                if (extractedDataWithAdjustedValues[0]?.sending_amount < extractedDataWithAdjustedValues[0]?.baseAmount.min) {
                    return { status: false, message: 'Entered amount is less than the minimum amount allowed' };
                }


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
                    total: formatDecimalNumbersWithLimit(item.total)
                }));

                const payload = {
                    extractedDataWithAdjustedValues
                };
                console.log(filteredData, "extractedDataWithAdjustedValues")
                const token = jwt.sign(payload, secretKey, { expiresIn: '60m' });

                return { status: true, message: { filteredData, token } }


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
                convertedAmount = rechargeOption.prices.retail.amount !== 0
                    ? (rechargeOption.prices.retail.amount * exchangerate).toFixed(3)   // if retail price is not 0 then this this
                    : (rechargeOption.prices.wholesale.amount * exchangerate).toFixed(3) //  if retail prive is 0 then this


                if (markup_type === 'percentage') {
                    const percentage_markup_amount = (percentage_markup / 100) * convertedAmount;
                    markup = percentage_markup_amount;
                }

                const new_amount = markup + parseFloat(convertedAmount)
                const prices = {
                    amount: parseFloat(new_amount),
                    unit: currency,
                    unit_type: rechargeOption.prices.retail.unit_type
                };

                if (fee_type === 'percentage') {
                    const percentage_fee_amount = (percentage_fee / 100) * new_amount;
                    fee = percentage_fee_amount;
                }
                total_now = (fee + prices.amount).toFixed(3)
                console.log(total_now, "total_now", fee, "fee", prices.amount, "prices.amount")

                return {
                    id: rechargeOption.id,
                    name: rechargeOption.name,
                    description: rechargeOption.description,
                    prices: prices,
                    fee: Number(parseFloat(fee).toFixed(3)),
                    // fee: parseFloat(fee),
                    fee_type: fee_type,
                    total: parseFloat(total_now),
                    // markup: parseFloat(markup),
                    markup: Number(parseFloat(markup).toFixed(3)),
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

            const total = filteredDataWithCurrency[0]?.total

            // if the total amount is more than the sending limit then this will be returned 
            if (total > sending_limit) {
                return { status: false, message: 'Entered amount is more than allowed sending limit' }

            }
            // if the total amount is more than the daily sending limit then this will be returned 
            if (total > daily_sending_limit) {
                return { status: false, message: 'Entered amount is more than daily allowed sending limit' }

            }
            // if the total amount is more than the monthly sending limit then this will be returned 
            if (total > monthly_sending_limit) {

                return { status: false, message: 'Entered amount is more than monthly allowed sending limit' }

            }
            // if the total amount is more than the yearly sending limit then this will be returned 
            if (total > yearly_sending_limit) {
                return { status: false, message: 'Entered amount is more than yearly allowed sending limit' }

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
                    amount: Number(parseFloat(item.prices.amount).toFixed(3)),
                    // amount: item.prices.amount,
                    unit: item.prices.unit,
                    unit_type: item.prices.unit_type
                },
                fee: Number(parseFloat(item.fee).toFixed(3)),
                // fee: item.fee,
                total: item.total
            }));


            const payload = {
                filteredDataWithCurrency
            };

            const token = jwt.sign(payload, secretKey, { expiresIn: '60m' });

            return { status: true, message: { filteredData, token } }


        }

    } catch (error) {
        console.error('Error getting status:', error);

        //returns the error which we get from DTone
        if (error.response && error.response.data && error.response.data.errors) {
            const errorMessages = error.response.data.errors
                .map(error => `${error.code}: ${error.message}`)
                .join(', ');

            return { status: false, message: errorMessages }

        } else {
            // returns error if there is a problem on our end and not the service
            return { status: false, message: "An error occurred while getting the status" }
        }
    }
};

// create transaction
async function createAirtimeTransaction(data) {
    try {

        const wallet_id = data.wallet_id
        const wallet = await Wallet.findOne({ _id: wallet_id }).populate('account')
        const accountLevelId = wallet.account.level._id
        // const fees = await Fee.findOne({ account_level: accountLevelId }).populate('account_level');
        const fees = await Fee.findOne({ $and: [{ service_name: data.service || 'airtime' }, { account_level: accountLevelId }] }).populate('account_level');

        let currency = wallet.currency.code   // the currency of the wallet

        // checking the status of the wallet
        if (wallet.status !== 'active') {
            return { status: false, message: 'This wallet is not active' };

        }

        const fee_type = fees.fee_type
        const flat_fee = fees.flat_fee
        const percentage_fee = fees.percentage_fee
        const fee_currency = fees.fee_currency
        const sending_limit = fees.account_level.sending_limit

        const number = data.number
        let amount = data.amount   // the amount the user wants to send
        const balance = wallet.balance.available

        let fee = 0;
        let dtone_currency
        let amount_converted

        const markup_fee = 1;
        const markup_type = 'flat'
        const percentage_markup = 6.5
        const markup_currency = 'USD'

        const daily_sending_limit = fees.account_level.daily_sending_limit
        const monthly_sending_limit = fees.account_level.monthly_sending_limit
        const yearly_sending_limit = fees.account_level.yearly_sending_limit

        let covnerted_fee = 0
        let markup = 0
        let convertedAmount
        let exchangerate_markup
        let exchangeratefee

        const token = data.token
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
            product_id = decoded.filteredDataWithCurrency[0]?.id
        } else if (decoded && Array.isArray(decoded.extractedDataWithAdjustedValues)) {
            product_id = decoded.extractedDataWithAdjustedValues[0]?.id
        } else {
            product_id = decoded.id
        }

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

            externalId = `${wallet.account._id}_${Date.now()}`

            const requestBody = {
                external_id: externalId,
                product_id: product_id,
                auto_confirm: false,
                credit_party_identifier: {
                    mobile_number: number
                },
                callback_url: "https://fontawesomev23.com/api/webhook/dtone-transaction-status"
            }

            console.log(requestBody, "requestBody", pre_authHeader)

            const response = await axios.post(url, requestBody, {
                headers: {
                    'Authorization': authHeader,
                },
            });
            return response.data
        }

        const TransactionForAirtime = async (amount_to_send, SourceCurrency) => {

            const url = 'https://dvs-api.dtone.com/v1/async/transactions';

            externalId = `${wallet.account._id}_${Date.now()}`
            console.log(amount_to_send, "amount_to_send")

            const requestBody = {

                external_id: externalId,
                calculation_mode: "SOURCE_AMOUNT",
                source: {
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

            console.log(requestBody, "requestBody")

            const response = await axios.post(url, requestBody, {
                headers: {
                    'Authorization': authHeader,
                },
            });
            return response.data
        }

        let responseData = await makeApiCall();
        console.log([responseData], "responseDataincreate")
        const sub_service_id = responseData.service.subservice.id

        if (sub_service_id == 11) {

            // currency of the service (Dtone)  
            const SourceCurrencyUnit = responseData.benefits[0]?.unit;
            let exchangerate = await convertCurrency(SourceCurrencyUnit, currency, 1);
            exchangerate = exchangerate.toFixed(3);

            // currency of the service (Dtone)  
            const SourceCurrency = responseData.source.unit;


            console.log(fee_type, "fee_typeinfunc")
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
                console.log(fee, "fee", fee_currency, flat_fee, SourceCurrencyUnit, exchangeratefee, exchangerate)

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

            let amount = data.amount   // the amount the user wants to send

            if (!amount) {
                return { status: false, message: 'amount not given' };


            }

            let responseDataArray = [responseData]  // objects are being returned, keeping it in a array so filtering is similar to the all the other api outputs



            if (markup_type === 'percentage') {
                const percentage_markup_amount = (percentage_markup / 100) * parseInt(amount);
                markup = percentage_markup_amount;
            }

            if (fee_type === 'percentage') {
                const percentage_fee_amount = (percentage_fee / 100) * parseInt(amount);
                console.log(percentage_fee_amount, "percentage_fee_amount", percentage_fee, "percentage_fee", amount, "amount")
                fee = percentage_fee_amount;
            }

            console.log(fee, "feeincreate")

            // extracting important data from the api response and filtering and adding fees & total
            const extractedDataWithAdjustedValues = responseDataArray.map(item => {
                const originalMax = item.benefits[0]?.amount.base.max;
                const originalMin = item.benefits[0]?.amount.base.min;

                let adjustedMax = ((originalMax * 0.98) * exchangerate).toFixed(3);;  // decreasing by 2% 
                let adjustedMin = ((originalMin * 1.02) * exchangerate).toFixed(3);; // increasing by 2% 

                sending_amount = amount;

                amount_dtone = sending_amount - markup

                adjustedMax = parseFloat(adjustedMax) + markup;
                adjustedMin = parseFloat(adjustedMin) + markup;



                // const totalAmount = fee + parseFloat(amount);
                const totalAmount = parseFloat(amount);
                const extractedItem = {
                    name: item.name,
                    id: item.id,
                    baseAmount: {
                        max: parseFloat(adjustedMax),
                        min: parseFloat(adjustedMin)
                    },
                    unit: currency,
                    sending_amount: parseFloat(sending_amount),
                    fee: parseFloat(fee),
                    fee_type: fee_type,
                    total: parseFloat(totalAmount),
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

            const total = extractedDataWithAdjustedValues[0]?.total

            // if the total amount is more than the sending limit then this will be returned 
            if (total > sending_limit) {
                return { status: false, message: 'Entered amount is more than allowed sending limit' };
            }
            // if the total amount is more than the daily sending limit then this will be returned 
            if (total > daily_sending_limit) {
                return { status: false, message: 'Entered amount is more than daily allowed sending limit' };
            }
            // if the total amount is more than the monthly sending limit then this will be returned 
            if (total > monthly_sending_limit) {
                return { status: false, message: 'Entered amount is more than monthly allowed sending limit' };
            }
            // if the total amount is more than the yearly sending limit then this will be returned 
            if (total > yearly_sending_limit) {
                return { status: false, message: 'Entered amount is more than yearly allowed sending limit' };
            }

            // if the total amount is more than the balance then this will be returned 
            if (total > balance) {
                return { status: false, message: `Insufficient Balance, your current balance in this wallet is ${balance}` };
            }

            if (extractedDataWithAdjustedValues[0]?.sending_amount > extractedDataWithAdjustedValues[0]?.baseAmount.max) {
                return { status: false, message: 'Entered amount is more than the maximum' };
            }

            if (extractedDataWithAdjustedValues[0]?.sending_amount < extractedDataWithAdjustedValues[0]?.baseAmount.min) {
                return { status: false, message: 'Entered amount is less than the minimum amount allowed' };
            }

            const jsonString1 = JSON.stringify(extractedDataWithAdjustedValues);
            const jsonString2 = JSON.stringify(decoded.extractedDataWithAdjustedValues);
            console.log(jsonString1, jsonString2)

            if (true) {
                console.log("The arrays are equal.");

                let converted_amount = await convertCurrency(extractedDataWithAdjustedValues[0]?.unit, SourceCurrency, extractedDataWithAdjustedValues[0]?.amount_to_send)
                converted_amount = converted_amount.toFixed(3)

                responseData = await TransactionForAirtime(converted_amount, SourceCurrency)

                //return res.json(responseData)

                transaction_id = responseData.id


                const payload = {
                    Wallet_Id: wallet_id,
                    Transaction_ID: transaction_id,
                    Sub_Service_id: sub_service_id,
                    extractedDataWithAdjustedValues,
                    number: data.number,
                };

                const token = jwt.sign(payload, secretKey, { expiresIn: '60m' });

                return { status: true, message: token };
            } else {
                return { status: false, message: 'Rates have been changed!' };
            }

        }


        if (sub_service_id != 11) {

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

                if (fee_type === 'percentage') {
                    const percentage_fee_amount = (percentage_fee / 100) * new_amount;
                    fee = percentage_fee_amount;
                }

                total_now = (fee + prices.amount).toFixed(3)
                console.log(total_now, "total_now", fee, "fee", prices.amount, "prices.amount")

                return {
                    id: rechargeOption.id,
                    name: rechargeOption.name,
                    description: rechargeOption.description,
                    prices: prices,
                    // fee: parseFloat(fee),
                    fee: Number(parseFloat(fee).toFixed(3)),
                    fee_type: fee_type,
                    total: parseFloat(total_now),
                    // markup: parseFloat(markup),
                    markup: Number(parseFloat(markup).toFixed(3)),
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

            const total = filteredDataWithCurrency[0]?.total

            // if the total amount is more than the sending limit then this will be returned 
            if (total > sending_limit) {
                return { status: false, message: 'Entered amount is more than allowed sending limit' };
            }
            // if the total amount is more than the daily sending limit then this will be returned 
            if (total > daily_sending_limit) {
                return { status: false, message: 'Entered amount is more than daily allowed sending limit' };
            }
            // if the total amount is more than the monthly sending limit then this will be returned 
            if (total > monthly_sending_limit) {
                return { status: false, message: 'Entered amount is more than monthly allowed sending limit' };
            }
            // if the total amount is more than the yearly sending limit then this will be returned 
            if (total > yearly_sending_limit) {
                return { status: false, message: 'Entered amount is more than yearly allowed sending limit' };
            }

            // if the total amount is more than the balance then this will be returned 
            if (total > balance) {
                return { status: false, message: `Insufficient Balance, your current balance in this wallet is ${balance}` };
            }


            const filteredData = filteredDataWithCurrency.map(item => ({
                id: item.id,
                name: item.name,
                description: item.description,
                prices: {
                    amount: item.prices.amount,
                    unit: item.prices.unit,
                    unit_type: item.prices.unit_type
                },
                fee: item.fee,
                total: item.total
            }));


            // Convert the arrays to JSON strings
            const jsonString1 = JSON.stringify(filteredDataWithCurrency);
            const jsonString2 = JSON.stringify(decoded.filteredDataWithCurrency);

            console.log(jsonString1, jsonString2, "jsonString1, jsonString2")

            // Compare the JSON strings
            // if (jsonString1 === jsonString2) {
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
                    number: data.number,
                };

                const token = jwt.sign(payload, secretKey, { expiresIn: '60m' });

                return { status: true, message: token };


            } else {
                return { status: false, message: 'Rates have changed' };
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

async function createAirtimeFixedTransaction(data) {
    const wallet_id = data.wallet_id
    const wallet = await Wallet.findOne({ _id: wallet_id }).populate([{ path: 'account', populate: [{ path: 'level' }] }])
    const accountLevelId = wallet.account.level._id
    // const fees = await Fee.findOne({ account_level: accountLevelId }).populate('account_level');
    const fees = await Fee.findOne({ $and: [{ service_name: 'airtime' }, { account_level: accountLevelId }] }).populate('account_level');

    // checking the status of the wallet
    if (wallet.status !== 'active') {
        return { status: false, message: 'This wallet is not active' };

    }

    const number = data.number
    const token = data.token
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
    // return
    const url = 'https://dvs-api.dtone.com/v1/async/transactions';
    product_id = decoded.id

    console.log(number, "numbernside")

    externalId = `${wallet.account._id}_${Date.now()}`

    const requestBody = {

        external_id: externalId,
        product_id: product_id,
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

    console.log(response.data, "response.data")
    if (response.data.status.class.message === "CREATED") {
        const payload = {
            transactionID: response.data.id,
            wallet_id,
            decoded: decoded,
            number: number,
        }
        const token = jwt.sign(payload, secretKey, { expiresIn: '60m' });

        return { status: true, message: { token, data: response.data } };
    } else {
        return { status: false, message: "Something went wrong!" };
    }

}

async function confirmAirtimeFixedTransaction(data) {
    const token = data.token

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

    console.log(decoded, "decodeded")
    const wallet = await Wallet.findOne({ _id: decoded.wallet_id }).populate([{ path: 'account', populate: [{ path: 'level' }] }])
    const transactionId = decoded.transactionID

    const convertedTotal = await convertCurrency(wallet.currency.code, 'USD', decoded.decoded.total)

    console.log(convertedTotal, "converted total", decoded.decoded.total)

    let limitCheck1 = limitCheck(convertedTotal, wallet.account.level, wallet.account, 'sending');
    if (!limitCheck1.status) {
        const output = await encryption(limitCheck1.code);
        return res.status(400).json(output);
    }

    // if the total amount is more than the balance then this will be returned 
    const balance = wallet.balance.available
    if (decoded.decoded.total > balance) {
        const output = await encryption(`Insufficient Balance, your current balance in this wallet is ${balance}`);
        return res.status(400).json(output);

    }

    // const apiUrl = `https://dvs-api.dtone.com/v1/async/transactions/${transactionId}/confirm`;
    const apiUrl = `https://dvs-api.dtone.com/v1/async/transactions/${transactionId}/confirm`

    const response = await axios.post(apiUrl, null, {
        headers: {
            'Authorization': authHeader,
        },
    });

    if (response.data.status.message === "CONFIRMED") {
        const newAvailableBalance = wallet.balance.available - decoded.decoded.total;
        wallet.balance.available = newAvailableBalance;
        await wallet.save();

        // updating the limits used
        let USDTotal;
        if (wallet.currency.code !== 'USD') {
            USDTotal = await convertCurrency(wallet.currency.code, 'USD', decoded.decoded.total);
        } else {
            USDTotal = decoded.decoded.total
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
            description: `${decoded.decoded.name} - ${decoded.decoded.desc}`,
            airtime_number: decoded.number,
            currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
            amount: decoded.decoded.total - decoded.decoded.fee,
            fee: decoded.decoded.fee,
            fee_type: decoded.decoded.fee_type,
            markup: decoded.decoded.markup,
            markup_currency: decoded.decoded.markup_currency,
            exchange_rate: decoded.decoded.fee_exchangerate,
            exchange_rate_markup: decoded.decoded.exchange_rate_markup,
            total: decoded.decoded.total,
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

        return { status: true, message: { data: senderTransactionObj.reference_id } };
    } else {
        return { status: false, message: "Something went wrong!" };
    }
}

// confirm transaction
async function confirmAirtimeTransaction(data) {
    try {

        const token = data.token
        let decoded

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
                        'Authorization': pre_authHeader,
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
        console.log(decoded, "decodedlol")
        const Sub_Service_id = decoded.Sub_Service_id
        const Transaction_ID = decoded.Transaction_ID
        console.log(Transaction_ID)
        const wallet_id = decoded.Wallet_Id
        const wallet = await Wallet.findOne({ _id: wallet_id }).populate('account')
        if (!wallet) {
            return { status: false, message: 'Wallet not found' };
        }

        let currency = wallet.currency.code

        const balance = wallet.balance.available
        const accountLevelId = wallet.account.level._id
        const fees = await Fee.findOne({ account_level: accountLevelId }).populate('account_level');

        const sending_limit = fees.account_level.sending_limit
        const daily_sending_limit = fees.account_level.daily_sending_limit
        const monthly_sending_limit = fees.account_level.monthly_sending_limit
        const yearly_sending_limit = fees.account_level.yearly_sending_limit


        if (Sub_Service_id == 11) {


            const fee = decoded.extractedDataWithAdjustedValues[0]?.fee        // the fee we keeping 
            const total = decoded.extractedDataWithAdjustedValues[0]?.total    // the total amount  

            if (total > sending_limit) {
                return { status: false, message: 'Entered amount is more than allowed sending limit' };
            }
            if (total > daily_sending_limit) {
                return { status: false, message: 'Entered amount is more than daily allowed sending limit' };
            }
            if (total > monthly_sending_limit) {
                return { status: false, message: 'Entered amount is more than monthly allowed sending limit' };
            }
            if (total > yearly_sending_limit) {
                return { status: false, message: 'Entered amount is more than yearly allowed sending limit' };
            }
            if (total > balance) {
                return { status: false, message: `Insufficient Balance, your current balance in this wallet is ${balance}` };
            }

            const response = await confirmTransactionForAirtime(Transaction_ID);

            console.log(response, "responseforairtime")

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

                const senderCurrentTime = momenttz().tz(senderTimezone).format();

                console.log(decoded, "decoded")

                let senderTransactionObj = {
                    reference_id: `tr_${Transaction_ID}`,
                    type: 'instant',
                    transaction_type: 'debit',
                    service_type: 'airtime',
                    payment_type: "airtime",
                    status: 'INITIATED',
                    purpose: "",
                    description: "",
                    airtime_number: decoded.number,
                    currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
                    amount: total - decoded.extractedDataWithAdjustedValues[0]?.fee,
                    fee: decoded.extractedDataWithAdjustedValues[0]?.fee,
                    fee_type: decoded.extractedDataWithAdjustedValues[0]?.fee_type,
                    markup: decoded.extractedDataWithAdjustedValues[0]?.markup,
                    markup_currency: decoded.extractedDataWithAdjustedValues[0]?.markup_currency,
                    exchange_rate: decoded.extractedDataWithAdjustedValues[0]?.fee_exchangerate,
                    exchange_rate_markup: decoded.extractedDataWithAdjustedValues[0]?.fee_exchangerate - decoded.extractedDataWithAdjustedValues[0]?.markup,
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

                console.log(senderTransactionObj, "senderTransactionObj")


                // const newTransaction = new Transaction({
                //     transaction_id: Transaction_ID,
                //     reference_id: 'TRE_',
                //     type: 'MobileLoad',         // take from response 
                //     transaction_type: 'Debit',
                //     service_type: 'Airtime',    // take from response
                //     status: 'CONFIRMED',
                //     description: '',            // take from response 
                //     currency: {
                //         code: currency
                //     },
                //     amount: total,
                //     wallet_id: "",
                //     // wallet: walletObjectId,
                // });

                // await newTransaction.save()

                const newTransaction = new Transaction(senderTransactionObj);

                await newTransaction.save()

                return { status: true, message: 'Transaction Successful', data: senderTransactionObj };
            }
            else {
                return { status: false, message: 'Transaction Failed' };

            }

        }

        if (Sub_Service_id != 11) {

            const fee = decoded.filteredDataWithCurrency[0]?.fee        // the fee we keeping 
            const total = decoded.filteredDataWithCurrency[0]?.total    // the total amount  

            // if the total amount is more than the sending limit then this will be returned 
            if (total > sending_limit) {
                return { status: false, message: 'Entered amount is more than allowed sending limit' };
            }
            if (total > daily_sending_limit) {
                return { status: false, message: 'Entered amount is more than daily allowed sending limit' };
            }
            if (total > monthly_sending_limit) {
                return { status: false, message: 'Entered amount is more than monthly allowed sending limit' };
            }
            if (total > yearly_sending_limit) {
                return { status: false, message: 'Entered amount is more than yearly allowed sending limit' };
            }
            if (total > balance) {
                return { status: false, message: `Insufficient Balance, your current balance in this wallet is ${balance}` };
            }


            const response = await confirmTransaction(Transaction_ID);
            console.log(response, "response")

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
                console.log(decoded, "senderTransactionObj")

                let senderTransactionObj = {
                    reference_id: `tr_${Transaction_ID}`,
                    type: 'instant',
                    transaction_type: 'debit',
                    service_type: 'airtime',
                    payment_type: "airtime",
                    status: 'INITIATED',
                    purpose: "",
                    airtime_number: decoded.number,
                    description: `${decoded.filteredDataWithCurrency[0]?.name} - ${decoded.filteredDataWithCurrency[0]?.description}`,
                    currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
                    amount: total - decoded.filteredDataWithCurrency[0]?.fee,
                    fee: decoded.filteredDataWithCurrency[0]?.fee,
                    fee_type: decoded.filteredDataWithCurrency[0]?.fee_type,
                    markup: decoded.filteredDataWithCurrency[0]?.markup,
                    markup_currency: decoded.filteredDataWithCurrency[0]?.markup_currency,
                    exchange_rate: decoded.filteredDataWithCurrency[0]?.fee_exchangerate,
                    exchange_rate_markup: decoded.filteredDataWithCurrency[0]?.fee_exchangerate - decoded.filteredDataWithCurrency[0]?.markup,
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

                console.log(senderTransactionObj, "senderTransactionObj")

                const newTransaction = new Transaction(senderTransactionObj);

                await newTransaction.save()


                // const currentDateTime = Date.now();

                // const newTransaction = new Transaction({
                //     transaction_id: Transaction_ID,
                //     reference_id: `tr_${currentDateTime}`,
                //     type: 'Mobile',         // take from response 
                //     transaction_type: 'Debit',
                //     service_type: '',    // take from response
                //     status: 'CONFIRMED',
                //     description: '',            // take from response 
                //     currency: {
                //         code: currency
                //     },
                //     amount: total,
                //     wallet_id: wallet_id
                // });

                // await newTransaction.save()





                return { status: true, message: 'Transaction Successful', data: senderTransactionObj };
            }
            else {
                return { status: false, message: 'Transaction Failed' };

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

// EXCHANGE CURRENCY FUNCTIONS

async function getExchangeCurrencyRates(data) {
    try {
        // let additional = 2;
        let fee = 0;
        let from = data.from;
        let to = data.to;
        let type = data.type;
        let level_id = data.level_id;
        let amount = data.amount;
        // console.log(req.query);

        const feeDetails = await Fee.findOne({ $and: [{ service_name: type }, { account_level: level_id }] })
        if (feeDetails) {
            const exchangeRate = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`)
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
                return { status: true, message: exchangeRate.data }
            }
            else {
                return { status: false, message: 'Exchange rate not found!' }
            }

        } else {
            return { status: false, message: 'Fee details not found!' }
        }
    } catch (err) {
        return { status: false, message: 'Internal server error!' }
    }
}

async function instaWalletToWalletConversion(data) {
    try {
        console.log(data);
        let { receiver_wallet_id, sender_wallet_id, amount } = data

        let senderWallet = await Wallet.findOne({
            $and: [{ _id: sender_wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])
        let receiverWallet = await Wallet.findOne({
            $and: [{ _id: receiver_wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])
        // console.log(senderWallet.account._id, req.user._id, senderWallet.account.active);
        if (!senderWallet) {
            return { status: false, message: 'Invalid sender' }
        }
        if (!receiverWallet) {
            return { status: false, message: 'Invalid receiver' }
        }

        // if (senderWallet.account._id.toString() != req.user._id.toString() || receiverWallet.account._id.toString() != req.user._id.toString() || !req.user.active) {
        //     let error = await encryption({
        //         status: false,
        //         message: "Invalid Account!"
        //     })
        //     return res.status(400).send(error);
        // }

        let excRate = await exchangeRateApi(senderWallet.currency.code, receiverWallet.currency.code, amount, senderWallet.account.level._id, 'conversion')
        console.log(excRate, "excRate");

        if (senderWallet.balance.available < (amount + excRate.fee.exchange_fee)) {
            return { status: false, message: 'Insuficient balance' }
        }

        let senderBalance = senderWallet.balance.available - (amount + excRate.fee.exchange_fee)
        let receiverBalance = receiverWallet.balance.available + excRate.exchanged_amount
        // console.log(senderBalance);
        let ref = 'tr_' + Date.now().toString();
        let senderTransactionObj = {
            reference_id: ref,
            type: 'transfer',
            transaction_type: 'debit',
            service_type: 'conversion',
            status: 'completed',
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
            service_type: 'conversion',
            status: 'completed',
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
        const newSenderBalance = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderBalance } });
        console.log(newSenderBalance)
        if (newSenderBalance.acknowledged && newSenderBalance.modifiedCount == 1) {
            let supdt = await Transaction.create(senderTransactionObj);
            if (supdt) {
                let newReceiverBalance = await Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } });
                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                    let rupdt = await Transaction.create(receiverTransactionObj);
                    if (rupdt) {
                        const notificationObj = {
                            title: 'Wallet to Wallet transaction',
                            desc: 'You have received a transaction!',
                            type: 'wallet_to_wallet',
                            status: 'unread',
                            from: senderWallet.account,
                            to: receiverWallet.account,
                            link_id: rupdt._id,
                        };
                        const sender_name = senderWallet?.account?.user ?
                            senderWallet?.account?.user?.first_name + senderWallet?.account?.user?.first_name :
                            senderWallet?.account?.company?.company_name;
                        const receiver_name = receiverWallet?.account.user ?
                            receiverWallet?.account?.user?.first_name + receiverWallet?.account?.user?.first_name :
                            receiverWallet?.account?.company?.company_name;
                        addNotification(notificationObj);
                        sendPrivateMessage(receiverWallet?.account?._id, "You have received a transaction.");
                        const senderOptions = {
                            toEmail: senderWallet?.account?.email ?? "",
                            phoneNumber: senderWallet?.account?.phone ?? "",
                            instaUsername: senderWallet?.account?.insta_username ?? "",
                            message: `You have sent a transaction of ${amount} ${senderWallet?.currency?.code} to ${receiver_name}`,
                            subject: "You have sent a transaction in your Instapay Account!",
                            templateId: "d-2d5f929ed89847d693ab15621b95890f",
                            phoneMessage: `Transaction sent of ${amount} ${senderWallet?.currency?.code} to ${receiver_name}`
                        };
                        const receiverOptions = {
                            toEmail: receiverWallet?.account?.email ?? "",
                            phoneNumber: receiverWallet?.account?.phone ?? "",
                            instaUsername: receiverWallet?.account?.insta_username ?? "",
                            message: `You have recieved a transaction of ${excRate.exchanged_amount} ${receiverWallet?.currency?.code} from ${sender_name}`,
                            subject: "You have received a transaction in your Instapay Account!",
                            templateId: "d-2d5f929ed89847d693ab15621b95890f",
                            phoneMessage: `Transaction recieved of ${excRate.exchanged_amount} ${receiverWallet?.currency?.code} from ${sender_name}`
                        };
                        // sendNotifications(senderWallet.account, 'payments', senderOptions);
                        // sendNotifications(receiverWallet.account, 'payments', receiverOptions);
                        return { status: true, message: "Transaction successfull.", data: supdt };
                    } else {
                        let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id });
                        let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } });
                        let wrupdt = await Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverWallet.balance.available } });
                        return { status: false, message: "Transaction Failed." };
                    }
                } else {
                    let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id });
                    let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } });
                    return { status: false, message: "Transaction Failed." };
                }
            } else {
                let wupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } });
                return { status: false, message: "Transaction Failed." };
            }
        } else {

            return { status: false, message: "Transaction Failed." };
        }
    } catch (err) {
        console.log(err);
        return { status: false, message: 'Internal server error!' }

    }
}

async function walletOverviewText(wallets, selectedLanguage) {

    const MAX_CHARACTERS_PER_MESSAGE = 1000;
    let currentMessage = '';
    let messages = [];

    for (let wallet of wallets) {
        let currencyCode = wallet.currency.code;
        let countryEmoji = currencyToEmoji[currencyCode] ?? '🌐';
        let currencySymbol = wallet.currency.symbol;
        let walletBalance = formattedAmount(wallet.balance?.available.toFixed(2) || 0);

        let walletText =
            `${countryEmoji} ${lang[selectedLanguage].WALLET_CURRENCY} ${currencyCode}
💳 ${lang[selectedLanguage].WALLET_ID} ${wallet.wallet_id}
💰 ${lang[selectedLanguage].WALLET_BALANCE} ${currencySymbol}${walletBalance}
------------------------\n\n`;

        if (currentMessage.length + walletText.length > MAX_CHARACTERS_PER_MESSAGE) {
            messages.push(currentMessage);
            currentMessage = walletText;
        } else {
            currentMessage += walletText;
        }
    }

    if (currentMessage.length > 0) {
        messages.push(currentMessage);
    }

    return messages;
}

// // downloadImage('https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=7223798887696307&signature=AbwYiO-Qd53Ce2DtT9YVCnZmxDHMuPgk0k4ccYLrtdeTqJMveJkk0OsyNavrEqOO1IsSZNafGCddhWmP6H5y3amhrRv3ZA2lW4ZZSV7txr2MeYm1UNt3oOOIGn9Zlbtrv_mKTtOW8-ng_Pnx3gfSQ5L0K9gpHSDH2rG-uzYqtzO6ii4YVOvvIRE7fxXq_cLxEdK3W_ygqatDwxj2cIHyNIa7oQihSA', 'image.jpg');
// const imageURL = 'https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=7223798887696307&signature=AbwYiO-Qd53Ce2DtT9YVCnZmxDHMuPgk0k4ccYLrtdeTqJMveJkk0OsyNavrEqOO1IsSZNafGCddhWmP6H5y3amhrRv3ZA2lW4ZZSV7txr2MeYm1UNt3oOOIGn9Zlbtrv_mKTtOW8-ng_Pnx3gfSQ5L0K9gpHSDH2rG-uzYqtzO6ii4YVOvvIRE7fxXq_cLxEdK3W_ygqatDwxj2cIHyNIa7oQihSA';
// const imagePath = '1G0TEI7M.png';
// readQRCodeFromFile(imagePath)
//     .then(qrCodeResult => {
//         console.log('QR Code Decoded:', qrCodeResult);
//     })
//     .catch(error => {
//         console.error('Error reading QR code:', error);
//     });

module.exports = {
    availableCurrencies,
    requestCurrency,
    verifyQrCode,
    walletToWalletTransaction,
    schedulePaymentW2W,
    subscribePaymentW2W,
    getCountries,
    getServices,
    getPayerNames,
    getPayerRates,
    createQuotation,
    createTransaction,
    createWithdrawalTransaction,
    confirmTransaction,
    requestPayment,
    acceptPaymentRequest,
    getExchangeRatesForRequest,
    buyerToSellerReview,
    sellerToBuyerReview,
    sellerToBuyerReply,
    getReviewsBySeller,
    addQuotation,
    acceptQuotation,
    bargain,
    revise,
    numberVerificationAirtime,
    getSubservices,
    getProductsofSubservices,
    getExchangeCurrencyRates,
    instaWalletToWalletConversion,
    getProductsPrice,
    createAirtimeTransaction,
    createAirtimeFixedTransaction,
    confirmAirtimeFixedTransaction,
    confirmAirtimeTransaction,
    declineQuotation,
    declinePaymentRequest,
    subscribeRequestPaymentW2W,
    scheduleRequestPaymentW2W,
    uploadToS3,
    formattedAmount,
    getExchangeRates,
    confirmTransactionTopupHelper,
    walletOverviewText,
    downloadImage,
    readQRCodeFromFile,
    extractLastStringFromURL
}