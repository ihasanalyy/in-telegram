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

async function w2wQrPayPaypal(senderId, payload, account, bot, text, selectedLanguage) {

    const data = {
        sender: {
            id: senderId
        }
    }

    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReply(data, lang[selectedLanguage].NO_DEFAULT_WALLET);
    }

    if (payload === "qr_pay_paypal") {

        const receiverWallet = await Wallet.findOne({ wallet_id: bot.qr_receiving_wallet })

        await quickMessage(data, lang[selectedLanguage].ENTER_AMOUNT_CURRENCY.replace('{{currency}}', receiverWallet.currency.code), "qr_pay_paypal_payment_amount");
    }

    // user has entered amount
    else if (bot?.last_message === "qr_pay_paypal_payment_amount" && !payload && text) {

        const digitRegex = /^\d+(\.\d+)?$/;
        const isNumber = digitRegex.test(text)
        const amount = parseFloat(text);

        if (isNumber && amount >= 0.1) {
            bot.qr_sending_amount = amount;
            await bot.save()

            const receivingWallet = await Wallet.findOne({ wallet_id: bot.qr_receiving_wallet })

            const { exchange_rate, fee, totalAmountWithFee, recipient_amount, paypal } = await calculateExchangeAndFees(defaultWallet.currency.code, receivingWallet.currency.code, amount, "qr_pay", account?.level._id, "paypal", defaultWallet, "request");

            console.log({ exchange_rate, fee, totalAmountWithFee, recipient_amount, paypal })

            let exchangedAmountSender = await getExchangeRatesToUSD(defaultWallet.currency.code, 'USD', totalAmountWithFee)
            console.log({ exchangedAmountSender })

            const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, defaultWallet, 'sending')

            if (!sender_limits_check.status) {
                await quickMessage(data, sender_limits_check.message, "qr_pay_paypal_payment_amount");
                return
            }

            const amountToSendText = lang[selectedLanguage].AMOUNT_TO_SEND;
            const exchangeRateText = lang[selectedLanguage].EXCHANGE_RATE;
            const feeText = lang[selectedLanguage].FEE;
            const recipientGetsText = lang[selectedLanguage].RECIPIENT_GETS;
            const totalAmountText = lang[selectedLanguage].TOTAL_AMOUNT;
            let message;

            if (defaultWallet?.currency?.code !== receivingWallet?.currency.code) {
                message = `
${amountToSendText}: ${formattedAmount(totalAmountWithFee - fee)} ${defaultWallet?.currency.code}

${exchangeRateText}: 1.00 ${defaultWallet?.currency?.code} = ${exchange_rate} ${receivingWallet?.currency.code}
${feeText}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}

${recipientGetsText} ${formattedAmount(recipient_amount)} ${receivingWallet?.currency.code} 

${totalAmountText}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${defaultWallet?.currency?.code}
`;
            } else {
                message = `
${amountToSendText}: ${formattedAmount(totalAmountWithFee - fee)} ${defaultWallet?.currency.code}

${feeText}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}

${recipientGetsText} ${formattedAmount(recipient_amount)} ${receivingWallet?.currency.code} 

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
                { content_type: "text", title: lang[selectedLanguage].PROCEED_TO_TRANSFER, payload: "qr_pay_paypal_payment-proceed" },
                { content_type: "text", title: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, payload: "qr_pay_paypal_payment-adjust" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
            ]
            // Determine if paypalMessage is required
            if (paypalMessage) {
                await quickMessage({ sender: { id: senderId } }, message, "4");
                await quickReply({ sender: { id: senderId } }, paypalMessage, quickReplies, "4");
            } else {
                await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
            }


        } else if (amount <= 0.1) {
            await quickMessage(data, lang[selectedLanguage].MINIMUM_AMOUNT);
        } else {
            await quickMessage(data, lang[selectedLanguage].ENTER_AMOUNT_DIGITS);
        }

    }

    // user has selected to adjust amount
    else if (payload === "qr_pay_paypal_payment-adjust") {
        bot.qr_sending_amount = null
        await bot.save()

        const message = lang[selectedLanguage].UPDATED_AMOUNT;
        await quickMessage(data, message, "qr_pay_paypal_payment_amount");

    }

    // user has proceeded
    else if (payload === "qr_pay_paypal_payment-proceed") {
        await handleOTPGeneration(selectedLanguage, senderId, "qr_pay_paypal_payment-otp", "qr_pay_paypal_payment-otp", "Transaction OTP");
    }

    // user has entered otp for instant
    else if (bot?.last_message === "qr_pay_paypal_payment-otp" && !payload && text) {
        const otpValidationResult = await validateOTP(senderId, text, "qr_pay_paypal_payment-otp");

        if (otpValidationResult.status) {

            const receivingWallet = await Wallet.findOne({ wallet_id: bot.qr_receiving_wallet })

            const rates = await calculateExchangeAndFees(defaultWallet.currency.code, receivingWallet.currency.code, bot.qr_sending_amount, "qr_pay", account?.level._id, "paypal", defaultWallet, "request");

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
                receiver_wallet_id: bot.qr_receiving_wallet,
                sender_wallet_id: defaultWallet?._id,
                purpose: "GIFT_AND_DONATION",
                amount: bot.qr_sending_amount,
                type: "instant",
                payment_type: "qr_pay",
                description: "",
                token
            }

            const JWTToken = jwt.sign(w2w_data, process.env.jwtKey, { expiresIn: '10m' });

            console.log({ rates, w2w_data })
            const initiateDetails = await initiateW2WPaypalTransactionHelper(rates, w2w_data, JWTToken, "qr_pay");
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

                await sendTemplate(data, senderId, templatePayload, "4");
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

                await invalidMessage(data, "qr_pay_paypal_payment-otp", selectedLanguage, bot?.otpType);
            }
        }
    }

}

module.exports = w2wQrPayPaypal