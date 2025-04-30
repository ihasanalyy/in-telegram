const axios = require('axios');

const { quickMessage, quickReply, sendTemplate, somethingWentWrongQuickReply } = require('../../../instaChatbotUtils');
const lang = require('../../../languages/languages.json');
const Wallet = require("../../../../models/Wallet.model");
const { getExchangeRatesToUSD, calculateExchangeAndFees, fetchLocalOrDefaultWalletConditionally } = require("../../../helpers");
const Transaction = require("../../../../models/Transaction.model");
const jwt = require('jsonwebtoken');
const { checkTransactionLimitsForSender } = require('../../../conversion');
const { formattedAmount } = require("../../../InstaChatbotHelpers");
const { handleOTPGeneration, validateOTP, invalidMessage } = require("../../../instaChatbotOTP");

const { initiateW2WPaypalTransactionHelper } = require('./w2wUsingPaypal');
const QuotationModel = require('../../../../models/Quotation.model');

async function w2wQuotationPaypal(senderId, payload, account, bot, text, selectedLanguage) {

    const data = {
        sender: {
            id: senderId
        }
    }

    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReply(data, lang[selectedLanguage].NO_DEFAULT_WALLET);
    }

    else if (payload === "quotation_paypal") {

        const quotation = await QuotationModel.findById(bot.quotation.accepting_quotation).populate("amount_reciever_currency")

        const { exchange_rate, fee, totalAmountWithFee, recipient_amount, paypal } = await calculateExchangeAndFees(defaultWallet.currency.code, quotation.amount_reciever_currency.currency.code, parseFloat(quotation?.revised_amount || quotation?.amount), "quotation", account?.level._id, "paypal", defaultWallet, "request");

        console.log({ exchange_rate, fee, totalAmountWithFee, recipient_amount, paypal })

        let exchangedAmountSender = await getExchangeRatesToUSD(defaultWallet.currency.code, 'USD', totalAmountWithFee)

        const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, defaultWallet, 'sending')

        if (!sender_limits_check.status) {
            await quickMessage(data, sender_limits_check.message, "quotation_paypal_payment_amount");
            return
        }

        const amountToSendText = lang[selectedLanguage].AMOUNT_TO_SEND;
        const exchangeRateText = lang[selectedLanguage].EXCHANGE_RATE;
        const feeText = lang[selectedLanguage].FEE;
        const recipientGetsText = lang[selectedLanguage].RECIPIENT_GETS;
        const totalAmountText = lang[selectedLanguage].TOTAL_AMOUNT;
        let message;

        if (defaultWallet?.currency?.code !== quotation.amount_reciever_currency.currency.code) {
            message = `
${amountToSendText}: ${formattedAmount(totalAmountWithFee - fee)} ${defaultWallet?.currency?.code}

${exchangeRateText}: 1.00 ${defaultWallet?.currency?.code} = ${exchange_rate} ${quotation.amount_reciever_currency.currency.code}
${feeText}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}

${recipientGetsText} ${formattedAmount(recipient_amount)} ${quotation.amount_reciever_currency.currency.code} 

${totalAmountText}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${defaultWallet?.currency?.code}
`;
        } else {
            message = `
${amountToSendText}: ${formattedAmount(totalAmountWithFee - fee)} ${defaultWallet?.currency?.code}

${feeText}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}

${recipientGetsText} ${formattedAmount(recipient_amount)} ${quotation.amount_reciever_currency.currency.code} 

${totalAmountText}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${defaultWallet?.currency?.code}
`;
        }

        let paypalMessage = "";

        // Check if PayPal supports the currency
        if (!paypal?.paypal_currency_supported) {
            paypalMessage = `
${lang[selectedLanguage].PAYPAL_CURRENCY_NOT_SUPPORTED.replace('{{currency}}', defaultWallet?.currency?.code)}\n
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${defaultWallet?.currency?.code} = ${formattedAmount(paypal?.paypal_rate.value, 6)} ${paypal?.paypal_rate.currency}
${lang[selectedLanguage].AMOUNT_IN_USD}  ${formattedAmount(paypal?.paypal_converted.value)} ${paypal?.paypal_converted.currency}
`;
        }

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].PROCEED_TO_TRANSFER, payload: "quotation_paypal_payment-proceed" },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
        ]
        // Determine if paypalMessage is required
        if (paypalMessage) {
            await quickMessage({ sender: { id: senderId } }, message, "4");
            await quickReply({ sender: { id: senderId } }, paypalMessage, quickReplies, "4");
        } else {
            await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
        }




    }

    // user has proceeded
    else if (payload === "quotation_paypal_payment-proceed") {
        await handleOTPGeneration(selectedLanguage, senderId, "quotation_paypal_payment-otp", "quotation_paypal_payment-otp", "Transaction OTP");
    }

    // user has entered otp for instant
    else if (bot?.last_message === "quotation_paypal_payment-otp" && !payload && text) {
        const otpValidationResult = await validateOTP(senderId, text, "quotation_paypal_payment-otp");

        if (otpValidationResult.status) {

            const quotationDetails = await QuotationModel.findOne({
                _id: bot?.quotation?.accepting_quotation,
                status: { $nin: ['accepted', 'declined'] }
            }).populate("amount_reciever_currency")


            if (!quotationDetails) {
                await quickMessage(data, lang[selectedLanguage].QUOTATION_ALREADY_PROCESSED, "4");
                return
            }

            const receivingWallet = await Wallet.findById(quotationDetails.amount_reciever_currency)
            const rates = await calculateExchangeAndFees(defaultWallet.currency.code, quotationDetails.amount_reciever_currency.currency.code, parseFloat(quotationDetails?.revised_amount || quotationDetails?.amount), "quotation", account?.level._id, "paypal", defaultWallet, "request");

            let amount;
            if (quotationDetails.revised_amount) {
                amount = quotationDetails.revised_amount
            } else {
                amount = quotationDetails.amount
            }

            const extrasPayload = {
                extras: {
                    exchange_rate: rates.exchange_rate,
                    fee: rates.fee,
                    totalAmountWithFee: rates.totalAmountWithFee,
                    recipient_amount: rates.recipient_amount,
                    feeType: rates.feeType,
                    markup: rates.markup,
                    original_rate: rates.original_rate,
                    topupFee: rates.topupFee,
                    feeToSendingRate: rates.feeToSendingRate
                }
            }

            const token = jwt.sign(extrasPayload, process.env.jwtKey, { expiresIn: "10m" });

            let w2w_data = {
                sender_wallet_id: defaultWallet?._id,
                receiver_wallet_id: receivingWallet?.wallet_id,
                amount,
                purpose: quotationDetails.purpose || "",
                type: 'wallet_to_wallet',
                payment_type: 'quotation',
                link: quotationDetails._id,
                description: quotationDetails.desc,
                attachments: [],
                transaction_type: "request",
                transaction_method: "wallet",
                token
            }

            const JWTToken = jwt.sign(w2w_data, process.env.jwtKey, { expiresIn: '10m' });

            console.log({ rates, w2w_data })
            const initiateDetails = await initiateW2WPaypalTransactionHelper(rates, w2w_data, JWTToken, "quotation");
            console.log({ initiateDetails })

            if (initiateDetails?.status) {

                const title = lang[selectedLanguage].VERIFY_PAYPAL_ACCOUNT

                const subtitle = `
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(rates.totalAmountWithFee)} ${defaultWallet?.currency?.code}
                        `

                const templatePayload = {
                    template_type: "generic",
                    elements: [
                        {
                            title,
                            subtitle,
                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Request%20A%20Quote.png",
                            buttons: [
                                {
                                    type: "web_url",
                                    title: lang[selectedLanguage].VERIFY,
                                    url: initiateDetails?.url,
                                    webview_height_ratio: "full"
                                },
                                {
                                    type: "postback",
                                    title: lang[selectedLanguage].MAIN_MENU,
                                    payload: "main_menu",
                                }

                            ],
                        },
                    ]
                };

                await sendTemplate(data, senderId, templatePayload, "4")
            } else {
                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                ]
                await quickReply(data, initiateDetails?.message || lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR, quickReplies, "4");
            }


        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await quickMessage(data, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {

                await invalidMessage(data, "quotation_paypal_payment-otp", selectedLanguage, bot?.otpType);
            }
        }
    }

}

module.exports = w2wQuotationPaypal