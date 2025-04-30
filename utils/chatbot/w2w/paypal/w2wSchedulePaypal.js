const { quickMessage, quickReply, sendTemplate, w2wPaymentMethodsTemplateCard, generateToken, somethingWentWrongQuickReply } = require("../../../instaChatbotUtils");
const lang = require('../../../languages/languages.json');
const Wallet = require("../../../../models/Wallet.model");
const { calculateExchangeAndFees, fetchLocalOrDefaultWalletConditionally } = require("../../../helpers");
const jwt = require('jsonwebtoken');
const { formattedAmount } = require("../../../InstaChatbotHelpers");
const { handleOTPGeneration, validateOTP, invalidMessage } = require("../../../instaChatbotOTP");
const { initiateW2WPaypalScheduleHelper } = require('./w2wSubscriptionPaypal');

async function w2wPaypalSchedule(senderId, payload, account, bot, text, selectedLanguage) {
    const data = {
        sender: {
            id: senderId
        }
    }

    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReply(data, lang[selectedLanguage].NO_DEFAULT_WALLET);
    }
    if (payload === "w2w_paypal_payment_type-schedule") {
        const message = lang[selectedLanguage].FINAL_AMOUNT_INFO

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].CONTINUE, payload: "w2w_paypal_payment-sched" },
            { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "cancel_w2w_transs" },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
        ];
        await quickReply(data, message, quickReplies, "4");

    } else if (payload === "w2w_paypal_payment-sched") {
        const token = generateToken(senderId, bot._id);

        const templatePayload = {
            template_type: "generic",
            elements: [
                {
                    title: lang[selectedLanguage].CHOOSE_DATE_TIME,
                    buttons: [
                        {
                            type: "web_url",
                            title: lang[selectedLanguage].SELECT_DATE_TIME,
                            url: `https://my.insta-pay.ch/chatbot/scheduled/${token}?default=${account?.timezone}&method=paypal`,
                            webview_height_ratio: "full"
                        },
                        {
                            type: "postback",
                            title: lang[selectedLanguage].BACK_TITLE,
                            payload: 'w2w_p_methods',
                        },
                    ],
                },
            ]
        };
        await sendTemplate(data, senderId, templatePayload, "4");
    }

    // proceeding with the transaction
    else if (payload === "w2w_paypal_payment-schedule-confirm") {

        const receivingWallet = await Wallet.findOne({ wallet_id: bot.qr_receiving_wallet })

        const { totalAmountWithFee } = await calculateExchangeAndFees(defaultWallet.currency.code, receivingWallet.currency.code, bot.wallet_transactions.amount, "wallet_to_wallet", account?.level._id, "paypal", defaultWallet, "instant");

        const message = lang[selectedLanguage].RESERVE_AMOUNT_MESSAGE
            .replace('{{amount}}', formattedAmount(totalAmountWithFee))
            .replace('{{currency}}', defaultWallet.currency.code)
            .replace('your card', 'your PayPal account');
        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].CONTINUE, payload: "w2w_paypal_payment-sched-confirm" },
            { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "cancel_w2w_transs" },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
        ];

        await quickReply(data, message, quickReplies, "4");
    }

    // user has proceeded with card payment
    else if (payload === "w2w_paypal_payment-sched-confirm") {
        await handleOTPGeneration(selectedLanguage, senderId, "w2w_paypal_payment-sched-otp", "w2w_paypal_payment-sched-otp", "Transaction OTP");
    }

    // user has entered OTP
    else if (bot?.last_message === "w2w_paypal_payment-sched-otp" && !payload && text) {
        const otpValidationResult = await validateOTP(senderId, text, "w2w_paypal_payment-sched-otp");

        if (otpValidationResult.status) {

            const receivingWallet = await Wallet.findOne({ wallet_id: bot.qr_receiving_wallet })

            const rates = await calculateExchangeAndFees(defaultWallet.currency.code, receivingWallet.currency.code, bot.wallet_transactions.amount, "wallet_to_wallet", account?.level._id, "paypal", defaultWallet, "instant");

            let subscription_data = {
                receiver_wallet_id: bot?.qr_receiving_wallet,
                sender_wallet_id: defaultWallet?._id,
                purpose: bot?.transaction_purpose,
                amount: bot.wallet_transactions.amount,
                date: bot?.scheduleDate,
                time: bot?.scheduleTime,
                timezone: bot?.scheduleTimezone || account?.timezone,
                attachments: bot.w2w_attachments,
                description: bot.w2w_note,
                type: "schedule"
            }

            const JWTToken = jwt.sign(subscription_data, process.env.jwtKey, { expiresIn: '10m' });

            console.log({ subscription_data, rates })

            const transactionDetails = await initiateW2WPaypalScheduleHelper(rates, defaultWallet._id, JWTToken, "schedule");
            console.log({ transactionDetails })

            if (transactionDetails?.status) {

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
                                    url: transactionDetails?.url,
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
        }
        else if (otpValidationResult.message === "max_attempts_exceeded") {
            await quickMessage(data, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
        } else {

            await invalidMessage(data, "w2w_paypal_payment_subs-otp", selectedLanguage, bot?.otpType);
        }
    }


}

module.exports = w2wPaypalSchedule