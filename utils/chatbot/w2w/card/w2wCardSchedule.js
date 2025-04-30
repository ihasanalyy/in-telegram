const { quickMessage, quickReply, sendTemplate, w2wPaymentMethodsTemplateCard, generateToken, somethingWentWrongQuickReply } = require("../../../instaChatbotUtils");
const CryptoJS = require("crypto-js");
const lang = require('../../../languages/languages.json');
const PanModel = require("../../../../models/Pan.model");
const Wallet = require("../../../../models/Wallet.model");
const { balanceLimitCheck, limitCheck, featureCheck, getExchangeRatesToUSD, calculateExchangeAndFees, fetchLocalOrDefaultWalletConditionally } = require("../../../helpers");
const { topUpFeeCalculation, generatePayload } = require("../../../../controllers/Trust-Payment.controller");
const Transaction = require("../../../../models/Transaction.model");
const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const { formattedAmount } = require("../../../InstaChatbotHelpers");
const { handleOTPGeneration, validateOTP, invalidMessage } = require("../../../instaChatbotOTP");
const topupTransactionDataTokenKey = "bac6723rd@#dn#aFw%%Y%VSV"
const countriesIso = require('../../../countries_iso2.json');
const { formatDecimalNumbersWithLimit } = require("../../../payerRates");

const initiateTopUpSavedCard = async (wallet_id, amount, pan, w2w_data) => {
    try {
        let ref = 'tr_' + Date.now().toString();
        console.log(wallet_id, amount, pan, 'w2w_data')
        if (!wallet_id || !amount || !pan) {
            return { status: false, message: "Required fields are missing." };
        }

        let receiverWallet = await Wallet.findOne({
            $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] },
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] },
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] },
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] }
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }]);

        if (!receiverWallet) {
            return { status: false, message: "Wallet not found or inactive." };
        }

        let panDetails = await PanModel.findOne({ $and: [{ _id: pan }, { account: receiverWallet.account._id }] });
        if (!panDetails) {
            return { status: false, message: "Invalid Card Details." };
        }

        let bytes = await CryptoJS.AES.decrypt(panDetails.panData, process.env.PAN_ENCRYPTION_KEY);
        let panDataObj = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

        let feeDetails = await topUpFeeCalculation(receiverWallet, amount / 100, 'topup_card_payment');
        let featureChecked = await featureCheck('topup_channel', 'card_payment', receiverWallet.account.level);

        if (featureChecked && feeDetails >= 0) {
            let amountInUSD = formatDecimalNumbersWithLimit(
                await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', (amount / 100) - feeDetails)
            );
            let amountInUSDTotal = formatDecimalNumbersWithLimit(
                await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount / 100)
            );

            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account);
            let limitChecked = limitCheck(parseFloat(amountInUSDTotal), receiverWallet.account.level, receiverWallet.account, 'topup');


            if (limitChecked.status && balanceLimitChecked) {
                const receiverTimezone = receiverWallet.account?.timezone || "UTC";
                const receiverCurrentTime = moment().tz(receiverTimezone).format();

                let receiverTransactionObj = {
                    reference_id: ref,
                    type: 'trust_payment',
                    transaction_type: 'credit',
                    service_type: 'topup',
                    payment_type: 'card',
                    status: 'INITIATED',
                    description: 'Topup by Saved Card',
                    currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                    amount: (amount / 100) - feeDetails,
                    fee: feeDetails,
                    total: amount / 100,
                    wallet_id: receiverWallet.wallet_id,
                    wallet: receiverWallet._id,
                    account: receiverWallet.account._id,
                    receiver: receiverWallet.account._id,
                    current_balance: receiverWallet.balance.available,
                    hidden: true,
                    timeline: [{ status: 'INITIATED', date: receiverCurrentTime }]
                };

                let transaction = await Transaction.create(receiverTransactionObj);

                w2w_data['transaction_id'] = transaction._id;
                w2w_data['payment_method'] = "subscription";
                const JWTToken = jwt.sign(w2w_data, topupTransactionDataTokenKey, { expiresIn: '120s' });

                const iat = Math.floor(Date.now() / 1000);

                const payload = generatePayload(amount / 100, receiverWallet, panDataObj, transaction, iat, true, false, "instagram");

                const token = jwt.sign(payload, process.env.TRUST_PAYMENT_SECRET, { algorithm: 'HS256' });

                if (token) {
                    return {
                        status: true,
                        message: "Transaction initiated successfully.",
                        data: {
                            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                            transaction_id: transaction._id,
                            transaction_ref: transaction.reference_id,
                            token,
                            w2w_data: JWTToken
                        }
                    };
                } else {
                    return { status: false, message: "Transaction failed." };
                }
            } else {
                let errorMsg = !limitChecked.status ? "Limit check failed." : "Balance limit exceeded.";
                return { status: false, message: errorMsg };
            }
        } else {
            return { status: false, message: "This service is not allowed." };
        }
    } catch (err) {
        console.log(err);
        return { status: false, message: "Internal server error!" };
    }
};

async function w2wCardSchedule(senderId, payload, account, bot, text, selectedLanguage) {
    const data = {
        sender: {
            id: senderId
        }
    }

    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReply(data, lang[selectedLanguage].NO_DEFAULT_WALLET_SET);
    }

    if (payload === "updated_w2w_card_payment_type-schedule") {

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].CONTINUE, payload: "updated_w2w_card_payment-sched" },
            { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "cancel_w2w_transs" },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
        ];
        await quickReply(data, lang[selectedLanguage].FINAL_AMOUNT_MESSAGE, quickReplies, "4");

    } else if (payload === "updated_w2w_card_payment-sched") {
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
                            url: `https://my.insta-pay.ch/chatbot/scheduled/${token}?default=${account?.timezone}&method=card`,
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
    else if (payload === "updated_w2w_card_payment-schedule-confirm") {

        const receivingWallet = await Wallet.findOne({ wallet_id: bot.qr_receiving_wallet })

        const { totalAmountWithFee } = await calculateExchangeAndFees(defaultWallet.currency.code, receivingWallet.currency.code, bot.wallet_transactions.amount, "wallet_to_wallet", account?.level._id, "card", defaultWallet, "instant");

        const message = lang[selectedLanguage].RESERVE_AMOUNT_MESSAGE
            .replace('{{amount}}', formattedAmount(totalAmountWithFee))
            .replace('{{currency}}', defaultWallet.currency.code);

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].CONTINUE, payload: "updated_w2w_card_payment-sched-confirm" },
            { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "cancel_w2w_transs" },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
        ];

        await quickReply(data, message, quickReplies, "4");
    }

    // user has proceeded with card payment
    else if (payload === "updated_w2w_card_payment-sched-confirm") {
        await handleOTPGeneration(selectedLanguage, senderId, "updated_w2w_card_payment-sched-otp", "updated_w2w_card_payment-sched-otp", "Transaction OTP");
    }

    // user has entered OTP
    else if (bot?.last_message === "updated_w2w_card_payment-sched-otp" && !payload && text) {
        const otpValidationResult = await validateOTP(senderId, text, "updated_w2w_card_payment-sched-otp");

        if (otpValidationResult.status) {

            const receivingWallet = await Wallet.findOne({ wallet_id: bot.qr_receiving_wallet })

            const { fee, totalAmountWithFee } = await calculateExchangeAndFees(defaultWallet.currency.code, receivingWallet.currency.code, bot.wallet_transactions.amount, "wallet_to_wallet", account?.level._id, "card", defaultWallet, "instant");

            let subscription_data = {
                receiver_wallet_id: bot?.qr_receiving_wallet,
                sender_wallet_id: bot?.qr_sending_currency,
                purpose: bot?.transaction_purpose,
                amount: totalAmountWithFee,
                date: bot?.scheduleDate,
                time: bot?.scheduleTime,
                timezone: bot?.scheduleTimezone || account?.timezone,
                attachments: bot.w2w_attachments,
                description: bot.w2w_note,
                type: "schedule"
            }

            const transactionDetails = await initiateTopUpSavedCard(defaultWallet, parseFloat(totalAmountWithFee) * 100, bot.wallet_transactions.pan, subscription_data)
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
        }
        else if (otpValidationResult.message === "max_attempts_exceeded") {
            await quickMessage(data, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
        } else {

            await invalidMessage(data, "updated_w2w_card_payment_subs-otp", selectedLanguage, bot?.otpType);
        }
    }


}

module.exports = w2wCardSchedule