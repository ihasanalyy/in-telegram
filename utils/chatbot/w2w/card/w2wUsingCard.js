const { quickMessage, quickReply, sendTemplate, w2wPaymentMethodsTemplateCard, somethingWentWrongQuickReply } = require("../../../instaChatbotUtils");
const CryptoJS = require("crypto-js");
const lang = require('../../../languages/languages.json');
const PanModel = require("../../../../models/Pan.model");
const Wallet = require("../../../../models/Wallet.model");
const { balanceLimitCheck, limitCheck, featureCheck, getExchangeRatesToUSD, calculateExchangeAndFees, fetchLocalOrDefaultWalletConditionally, validateCardExpiry } = require("../../../helpers");
const { topUpFeeCalculation, generatePayload } = require("../../../../controllers/Trust-Payment.controller");
const Transaction = require("../../../../models/Transaction.model");
const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const { checkTransactionLimitsForSender } = require('../../../conversion');
const { formattedAmount } = require("../../../InstaChatbotHelpers");
const { handleOTPGeneration, validateOTP, invalidMessage } = require("../../../instaChatbotOTP");
const w2wCardSchedule = require("./w2wCardSchedule");
const topupTransactionDataTokenKey = "bac6723rd@#dn#aFw%%Y%VSV"
const countriesIso = require('../../../countries_iso2.json');
const w2wCardSubscription = require("./w2wCardSubscription");
const { formatDecimalNumbersWithLimit } = require("../../../payerRates");

const initiateTopUpSavedCard = async (wallet_id, amount, pan, w2w_data) => {
    try {
        let ref = 'tr_' + Date.now().toString();
        console.log(wallet_id, amount, pan, 'w2w_data')
        if (!wallet_id || !amount || !pan) {
            return { status: false, message: "Required fields are missing." };
        }
        amount = parseInt(amount)

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


async function w2wUsingCard(senderId, payload, account, bot, text, selectedLanguage) {

    const data = {
        sender: {
            id: senderId
        }
    }

    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReply(data, lang[selectedLanguage].NO_DEFAULT_WALLET_SET);
    }

    if (payload === "updated_w2w_card_payment") {
        const pans = await PanModel.find({ account: account._id });
        console.log(pans)

        let quickReplies = []

        if (pans.length !== 0) {

            for (let i = 0; i < pans.length; i++) {
                quickReplies.push({
                    content_type: "text",
                    title: `💳 *******${pans[i].last4}`,
                    payload: `updated_w2w_card_payment_select_card-${pans[i]._id}`
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
    else if (payload?.includes("updated_w2w_card_payment_select_card")) {

        const cardId = payload.split("-")[1]
        const expiryValidation = await validateCardExpiry(cardId);
        if (!expiryValidation.status) {
            // Handle expired or invalid card
            const pans = await PanModel.find({ account: account._id });
            if (pans.length !== 0) {
                const message = "The card you selected has expired and is now removed from your InstaPay account.\n\n" +
                    "To continue with this transaction, please choose an alternative payment method."

                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].PAYMENT_CARD, payload: "updated_w2w_card_payment" },
                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "w2w_instapay_wallets" },
                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "w2w_paypal" },
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                ]

                await quickReply(data, message, quickReplies, "4");

            } else {
                const message = "The card you selected has expired and is now removed from your InstaPay account.\n\n" +
                    "To continue with this transaction, please choose an alternative payment method."

                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "w2w_instapay_wallets" },
                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "w2w_paypal" },
                    { content_type: "text", title: lang[selectedLanguage].ADD_PAYMENT_CARD, payload: "add_payment_card-change_payment_method_w2w" },
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                ]

                await quickReply(data, message, quickReplies, "4");
            }
            return;
        }
        bot.wallet_transactions.pan = cardId
        await bot.save()

        const message = lang[selectedLanguage].ENTER_AMOUNT_CURRENCY.replace('{{currency}}', defaultWallet?.currency.code);

        await quickMessage(data, message, "updated_w2w_card_payment_amount");
    }

    // user has entered amount
    else if (bot?.last_message === "updated_w2w_card_payment_amount" && !payload && text) {

        const digitRegex = /^\d+(\.\d+)?$/;
        const isNumber = digitRegex.test(text)
        const amount = parseFloat(text);

        if (isNumber && amount >= 0.1) {
            bot.wallet_transactions.amount = amount
            await bot.save()

            console.log(bot.wallet_transactions)

            const receivingWallet = await Wallet.findOne({ wallet_id: bot.qr_receiving_wallet })

            const { exchange_rate, fee, totalAmountWithFee, recipient_amount } = await calculateExchangeAndFees(defaultWallet.currency.code, receivingWallet.currency.code, amount, "wallet_to_wallet", account?.level._id, "card", defaultWallet, "instant");

            let exchangedAmountSender = await getExchangeRatesToUSD(defaultWallet.currency.code, 'USD', totalAmountWithFee)

            const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, defaultWallet, 'sending')

            if (!sender_limits_check.status) {
                await quickMessage(entry.messaging[0], sender_limits_check.message, "updated_w2w_card_payment_amount");
                return

            }
            // return

            const amountToSendText = lang[selectedLanguage].AMOUNT_TO_SEND;
            const exchangeRateText = lang[selectedLanguage].EXCHANGE_RATE;
            const feeText = lang[selectedLanguage].FEE;
            const recipientGetsText = lang[selectedLanguage].RECIPIENT_GETS;
            const totalAmountText = lang[selectedLanguage].TOTAL_AMOUNT;
            let message;

            if (defaultWallet?.currency?.code !== receivingWallet?.currency.code) {
                message = `
${amountToSendText}: ${formattedAmount(parseFloat(text))} ${defaultWallet?.currency?.code}

${exchangeRateText}: 1.00 ${defaultWallet?.currency?.code} = ${exchange_rate} ${receivingWallet?.currency.code}
${feeText}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}

${recipientGetsText} ${formattedAmount(recipient_amount)} ${receivingWallet?.currency.code} 

${totalAmountText}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${defaultWallet?.currency?.code}
`;
            } else {
                message = `
${amountToSendText}: ${formattedAmount(parseFloat(text))} ${defaultWallet?.currency?.code}

${feeText}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}

${recipientGetsText} ${formattedAmount(recipient_amount)} ${receivingWallet?.currency.code} 

${totalAmountText}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${defaultWallet?.currency?.code}
`;

            }

            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].PROCEED_TO_TRANSFER, payload: "updated_w2w_card_payment-proceed" },
                { content_type: "text", title: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, payload: "updated_w2w_card_payment-adjust" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
            ]

            await quickReply(data, message, quickReplies);
        } else if (amount <= 0.1) {
            await quickMessage(data, lang[selectedLanguage].MINIMUM_AMOUNT);
        } else {
            await quickMessage(data, lang[selectedLanguage].ENTER_AMOUNT_DIGITS);
        }

    }

    // user has selected to adjust amount
    else if (payload === "updated_w2w_card_payment-adjust") {
        bot.wallet_transactions.amount = null
        await bot.save()

        const message = lang[selectedLanguage].UPDATED_AMOUNT;
        await quickMessage(data, message, "updated_w2w_card_payment_amount");

    }

    // user has proceeded with payment
    else if (payload === "updated_w2w_card_payment-proceed") {
        await w2wPaymentMethodsTemplateCard(data, senderId, selectedLanguage);
    }

    // if user has selected instant w2w with card
    else if (payload === "updated_w2w_card_payment_type-instant") {
        await handleOTPGeneration(selectedLanguage, senderId, "updated_w2w_card_payment-otp", "updated_w2w_card_payment-otp", "Transaction OTP");
    }
    // user has selected payment type
    else if (payload?.includes("updated_w2w_card_payment_type-")) {
        console.log(payload)
        const paymentType = payload.split("-")[1]
        console.log(paymentType)

        if (paymentType === "subsription") {
            await w2wCardSubscription(senderId, payload, account, bot, text, selectedLanguage)

        } else if (paymentType === "schedule") {
            await w2wCardSchedule(senderId, payload, account, bot, text, selectedLanguage)
        } else {
            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
            ]
            await quickReply(data, lang[selectedLanguage].TRANSACTION_ERROR_MESSAGE, quickReplies, "4");
        }

    }

    // user has entered otp for instant
    else if (bot?.last_message === "updated_w2w_card_payment-otp" && !payload && text) {
        const otpValidationResult = await validateOTP(senderId, text, "updated_w2w_card_payment-otp");

        if (otpValidationResult.status) {

            const receivingWallet = await Wallet.findOne({ wallet_id: bot.qr_receiving_wallet })

            const { fee, totalAmountWithFee, recipient_amount, feeType, markup, original_rate, exchange_rate, topupFee, feeToSendingRate } = await calculateExchangeAndFees(defaultWallet.currency.code, receivingWallet.currency.code, bot.wallet_transactions.amount, "wallet_to_wallet", account?.level._id, "card", defaultWallet, "instant");

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
                amount: bot.wallet_transactions.amount,
                type: "instant",
                payment_type: "wallet_to_wallet",
                description: "",
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

                await invalidMessage(data, "updated_w2w_card_payment-otp", selectedLanguage, bot?.otpType);
            }
        }
    }

    // if user is proceeding with subscription method
    else if (payload?.includes("updated_w2w_card_payment_subs") || bot.last_message.includes("updated_w2w_card_payment_subs")) {
        await w2wCardSubscription(senderId, payload, account, bot, text, selectedLanguage)
    }

    // if user is proceeding with subscription method
    else if (payload?.includes("updated_w2w_card_payment-sched") || bot.last_message.includes("updated_w2w_card_payment-sched")) {
        await w2wCardSchedule(senderId, payload, account, bot, text, selectedLanguage)
    }

}

module.exports.w2wUsingCard = w2wUsingCard
module.exports.initiateTopUpSavedCard = initiateTopUpSavedCard