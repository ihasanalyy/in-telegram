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

const RequestPayment = require('../../../../models/Request-Payment.model');
const PanModel = require("../../../../models/Pan.model");
const { initiateTopUpSavedCard } = require('./w2wUsingCard');

async function w2wCardRequest(senderId, payload, account, bot, text, selectedLanguage) {

    const data = {
        sender: {
            id: senderId
        }
    }

    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReply(data, lang[selectedLanguage].NO_DEFAULT_WALLET_SET);
    }

    if (payload === "request_card") {
        const pans = await PanModel.find({ account: account._id });
        console.log(pans)

        let quickReplies = []

        if (pans.length !== 0) {

            for (let i = 0; i < pans.length; i++) {
                quickReplies.push({
                    content_type: "text",
                    title: `💳 *******${pans[i].last4}`,
                    payload: `request_card_payment_select_card-${pans[i]._id}`
                })
            }

            quickReplies.push({
                content_type: "text",
                title: lang[selectedLanguage].CHANGE_PAYMENT_METHOD,
                payload: `back_request`
            })

            quickReplies.push({
                content_type: "text",
                title: `☰ ${lang[selectedLanguage].MAIN_MENU}`,
                payload: `main_menu`
            })

            await quickReply(data, lang[selectedLanguage].SELECT_YOUR_TOPUP_CHANNEL, quickReplies, "4")
        } else {
            quickReplies.push({
                content_type: "text",
                title: `☰ ${lang[selectedLanguage].MAIN_MENU}`,
                payload: `main_menu`
            })
            await quickReply(data, lang[selectedLanguage].NO_CARD_SAVED, quickReplies, "4")
        }
    }
    // user has selected a card
    else if (payload?.includes("request_card_payment_select_card")) {

        const cardId = payload.split("-")[1]
        const expiryValidation = await validateCardExpiry(cardId);

        if (!expiryValidation.status) {
            const pans = await PanModel.find({ account: account._id });
            const message = "The card you selected has expired and is now removed from your InstaPay account.\n\n" +
                "To continue with this transaction, please choose an alternative payment method."
            if (pans.length !== 0) {

                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].PAYMENT_CARD, payload: "request_card" },
                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "select_req_send_wall" },
                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "request_paypal" },
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                ]

                await quickReply(data, message, quickReplies, "4");

            } else {

                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "select_req_send_wall" },
                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "request_paypal" },
                    { content_type: "text", title: lang[selectedLanguage].ADD_PAYMENT_CARD, payload: "add_payment_card-back_request" },
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                ]

                await quickReply(data, message, quickReplies, "4");
            }
            return
        }
        bot.wallet_transactions.pan = cardId
        await bot.save()

        const requestDetails = await RequestPayment.findById(bot.request_details.request_id).populate('wallet')

        const { exchange_rate, fee, totalAmountWithFee, recipient_amount } = await calculateExchangeAndFees(defaultWallet.currency.code, requestDetails?.wallet?.currency?.code, parseFloat(requestDetails.amount), "payment_request", account?.level._id, "card", defaultWallet, "request");

        console.log({ exchange_rate, fee, totalAmountWithFee, recipient_amount })

        let exchangedAmountSender = await getExchangeRatesToUSD(defaultWallet.currency.code, 'USD', totalAmountWithFee)

        const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, defaultWallet, 'sending')

        if (!sender_limits_check.status) {
            await quickMessage(data, sender_limits_check.message, "request_card_payment_amount");
            return
        }

        const amountToSendText = lang[selectedLanguage].AMOUNT_TO_SEND;
        const exchangeRateText = lang[selectedLanguage].EXCHANGE_RATE;
        const feeText = lang[selectedLanguage].FEE;
        const recipientGetsText = lang[selectedLanguage].RECIPIENT_GETS;
        const totalAmountText = lang[selectedLanguage].TOTAL_AMOUNT;
        let message;

        if (defaultWallet?.currency?.code !== requestDetails?.wallet?.currency?.code) {
            message = `
${amountToSendText}: ${formattedAmount(totalAmountWithFee - fee)} ${defaultWallet?.currency?.code}

${exchangeRateText}: 1.00 ${defaultWallet?.currency?.code} = ${exchange_rate} ${requestDetails?.wallet?.currency?.code}
${feeText}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}

${recipientGetsText} ${formattedAmount(recipient_amount)} ${requestDetails?.wallet?.currency?.code} 

${totalAmountText}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${defaultWallet?.currency?.code}
`;
        } else {
            message = `
${amountToSendText}: ${formattedAmount(totalAmountWithFee - fee)} ${defaultWallet?.currency?.code}

${feeText}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}

${recipientGetsText} ${formattedAmount(recipient_amount)} ${requestDetails?.wallet?.currency?.code} 

${totalAmountText}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${defaultWallet?.currency?.code}
`;
        }

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].PROCEED_TO_TRANSFER, payload: "request_card_payment-proceed" },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
        ]

        await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");

    }

    // user has proceeded
    else if (payload === "request_card_payment-proceed") {
        await handleOTPGeneration(selectedLanguage, senderId, "request_card_payment-otp", "request_card_payment-otp", "Transaction OTP");
    }

    // user has entered otp for instant
    else if (bot?.last_message === "request_card_payment-otp" && !payload && text) {
        const otpValidationResult = await validateOTP(senderId, text, "request_card_payment-otp");

        if (otpValidationResult.status) {

            const requestDetails = await RequestPayment.findOne({ $and: [{ _id: bot?.request_details?.request_id }, { status: 'pending' }] })
            console.log(requestDetails, "requestDetails")
            if (!requestDetails) {
                await quickMessage(data, lang[selectedLanguage].PAYMENT_REQUEST_STATUS, "4");
                return
            }

            const receivingWallet = await Wallet.findOne({ wallet_id: requestDetails.wallet_id })

            const rates = await calculateExchangeAndFees(defaultWallet.currency.code, receivingWallet.currency.code, parseFloat(requestDetails.amount), "payment_request", account?.level._id, "card", defaultWallet, "request");

            const files = requestDetails?.attachments.map(image => ({
                key: image.key,
                url: image.url,
                ETag: image.ETag,
                status: true
            }));

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
                amount: requestDetails.amount,
                purpose: requestDetails?.purpose || "",
                type: 'wallet_to_wallet',
                payment_type: 'payment_request',
                link: requestDetails._id,
                description: requestDetails.description || "",
                attachments: files,
                transaction_type: "request",
                transaction_method: "card",
                token,
                request_id: requestDetails._id
            }

            console.log({ rates, w2w_data })
            const transactionDetails = await initiateTopUpSavedCard(defaultWallet._id, parseFloat(rates.totalAmountWithFee) * 100, bot.wallet_transactions.pan, w2w_data)
            console.log({ transactionDetails })

            if (transactionDetails?.status) {

                const title = lang[selectedLanguage].VERIFY_CARD

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
                await quickReply(data, initiateDetails?.message || lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR, quickReplies, "4");
            }


        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await quickMessage(data, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {

                await invalidMessage(data, "request_card_payment-otp", selectedLanguage, bot?.otpType);
            }
        }
    }

}

module.exports = w2wCardRequest