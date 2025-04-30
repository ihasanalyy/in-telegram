const axios = require('axios');

const { quickMessage, quickReply, sendTemplate, somethingWentWrongQuickReply } = require('../../../instaChatbotUtils');
const lang = require('../../../languages/languages.json');
const Wallet = require("../../../../models/Wallet.model");
const { getExchangeRatesToUSD, calculateExchangeAndFees, fetchLocalOrDefaultWalletConditionally, validateCardExpiry } = require("../../../helpers");
const Transaction = require("../../../../models/Transaction.model");
const jwt = require('jsonwebtoken');
const { checkTransactionLimitsForSender } = require('../../../conversion');
const { formattedAmount } = require("../../../InstaChatbotHelpers");
const { handleOTPGeneration, validateOTP, invalidMessage } = require("../../../instaChatbotOTP");
const PanModel = require("../../../../models/Pan.model");
const { initiateTopUpSavedCard } = require('./w2wUsingCard');

async function w2wCardQRPay(senderId, payload, account, bot, text, selectedLanguage) {

    const data = {
        sender: {
            id: senderId
        }
    }

    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReply(data, lang[selectedLanguage].NO_DEFAULT_WALLET);
    }

    if (payload === "qr_pay_card") {
        const pans = await PanModel.find({ account: account._id });
        console.log(pans)

        let quickReplies = []

        if (pans.length !== 0) {

            for (let i = 0; i < pans.length; i++) {
                quickReplies.push({
                    content_type: "text",
                    title: `💳 *******${pans[i].last4}`,
                    payload: `qr_pay_card_payment_select_card-${pans[i]._id}`
                })
            }

            quickReplies.push({
                content_type: "text",
                title: lang[selectedLanguage].CHANGE_PAYMENT_METHOD,
                payload: `change_payment_method_w2w`
            })

            quickReplies.push({
                content_type: "text",
                title: `☰ ${lang[selectedLanguage].MAIN_MENU}`,
                payload: `main_menu`
            })

            await quickReply(data, lang[selectedLanguage].SELECT_YOUR_TOPUP_CHANNEL, quickReplies, "4");
        } else {
            quickReplies.push({
                content_type: "text",
                title: `☰ ${lang[selectedLanguage].MAIN_MENU}`,
                payload: `main_menu`
            })
            await quickReply(data, lang[selectedLanguage].NO_CARD_SAVED, quickReplies, "4");
        }
    }

    // user has selected topup channel
    else if (payload?.includes("qr_pay_card_payment_select_card")) {

        const cardId = payload.split("-")[1]

        const expiryValidation = await validateCardExpiry(cardId);

        if (!expiryValidation.status) {
            const pans = await PanModel.find({ account: account._id });
            const message = "The card you selected has expired and is now removed from your InstaPay account.\n\n" +
                "To continue with this transaction, please choose an alternative payment method."
            if (pans.length !== 0) {

                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].PAYMENT_CARD, payload: "qr_pay_card" },
                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "qr_pay_wallets_payment" },
                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "qr_pay_paypal" },
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                ]

                await quickReply(data, message, quickReplies, "4");

            } else {

                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "qr_pay_wallets_payment" },
                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "qr_pay_paypal" },
                    { content_type: "text", title: lang[selectedLanguage].ADD_PAYMENT_CARD, payload: "add_payment_card-qr_pay_code_yes" },
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                ]

                await quickReply(data, message, quickReplies, "4");
            }
            return
        }

        bot.wallet_transactions.pan = cardId
        await bot.save()

        const receiverWallet = await Wallet.findOne({ wallet_id: bot.qr_receiving_wallet })

        await quickMessage(data, lang[selectedLanguage].ENTER_AMOUNT_CURRENCY.replace('{{currency}}', receiverWallet.currency.code), "qr_pay_card_payment_amount");
    }

    // user has selected to adjust amount
    else if (payload === "qr_pay_card_payment-adjust") {
        bot.qr_sending_amount = null
        await bot.save()

        await quickMessage(data, lang[selectedLanguage].UPDATED_AMOUNT, "qr_pay_card_payment_amount");
    }

    // user has entered amount
    else if (bot?.last_message === "qr_pay_card_payment_amount" && !payload && text) {

        const digitRegex = /^\d+(\.\d+)?$/;
        const isNumber = digitRegex.test(text)
        const amount = parseFloat(text);

        if (isNumber && amount >= 0.1) {
            bot.qr_sending_amount = amount;
            await bot.save()

            const receivingWallet = await Wallet.findOne({ wallet_id: bot.qr_receiving_wallet })

            const { exchange_rate, fee, totalAmountWithFee, recipient_amount, paypal } = await calculateExchangeAndFees(defaultWallet.currency.code, receivingWallet.currency.code, amount, "qr_pay", account?.level._id, "card", defaultWallet, "request");

            console.log({ exchange_rate, fee, totalAmountWithFee, recipient_amount, paypal })

            let exchangedAmountSender = await getExchangeRatesToUSD(defaultWallet.currency.code, 'USD', totalAmountWithFee)
            console.log({ exchangedAmountSender })

            const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, defaultWallet, 'sending')

            if (!sender_limits_check.status) {
                await quickMessage(data, sender_limits_check.message, "qr_pay_card_payment_amount");
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

            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].PROCEED_TO_TRANSFER, payload: "qr_pay_card_payment-proceed" },
                { content_type: "text", title: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, payload: "qr_pay_card_payment-adjust" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
            ]

            await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");

        } else if (amount <= 0.1) {
            await quickMessage(data, lang[selectedLanguage].MINIMUM_AMOUNT);
        } else {
            await quickMessage(data, lang[selectedLanguage].ENTER_AMOUNT_DIGITS);
        }

    }

    // user has proceeded
    else if (payload === "qr_pay_card_payment-proceed") {
        await handleOTPGeneration(selectedLanguage, senderId, "qr_pay_card_payment-otp", "qr_pay_card_payment-otp", "Transaction OTP");
    }

    // user has entered otp for instant
    else if (bot?.last_message === "qr_pay_card_payment-otp" && !payload && text) {
        const otpValidationResult = await validateOTP(senderId, text, "qr_pay_card_payment-otp");

        if (otpValidationResult.status) {

            const receivingWallet = await Wallet.findOne({ wallet_id: bot.qr_receiving_wallet })

            const { fee, totalAmountWithFee, recipient_amount, feeType, markup, original_rate, exchange_rate, topupFee, feeToSendingRate } = await calculateExchangeAndFees(defaultWallet.currency.code, receivingWallet.currency.code, bot.wallet_transactions.amount, "qr_pay", account?.level._id, "card", defaultWallet, "request");

            const extrasPayload = {
                extras: {
                    exchange_rate,
                    fee,
                    totalAmountWithFee,
                    recipient_amount,
                    feeType,
                    markup,
                    original_rate,
                    topupFee,
                    feeToSendingRate
                }
            }

            const token = jwt.sign(extrasPayload, process.env.jwtKey, { expiresIn: "10m" });

            let w2w_data = {
                receiver_wallet_id: bot.qr_receiving_wallet,
                sender_wallet_id: defaultWallet?._id,
                purpose: "OTHERS",
                amount: bot.qr_sending_amount,
                type: "instant",
                payment_type: "qr_pay",
                description: "",
                transaction_method: "card",
                token
            }

            const transactionDetails = await initiateTopUpSavedCard(defaultWallet._id, parseFloat(totalAmountWithFee) * 100, bot.wallet_transactions.pan, w2w_data)
            console.log({ transactionDetails })

            if (transactionDetails?.status) {

                const title = lang[selectedLanguage].VERIFY_CARD

                const subtitle = `
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${defaultWallet?.currency?.code}
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
                                    url: `https://my.insta-pay.ch/chatbot/pan-transaction?token=${transactionDetails?.data?.token}&transaction_id=${transactionDetails?.data?.transaction_id}&reference_id=${transactionDetails?.data?.reference_id}&w2w_token=${transactionDetails?.data?.w2w_data}&slug=confirm-chatbot-w2w-pan-topup`,
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
                await quickReply(data, lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR, quickReplies, "4");
            }


        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await quickMessage(data, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {

                await invalidMessage(data, "qr_pay_card_payment-otp", selectedLanguage, bot?.otpType);
            }
        }
    }

}

module.exports = w2wCardQRPay