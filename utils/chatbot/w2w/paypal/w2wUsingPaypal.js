const axios = require('axios');

const { quickMessage, quickReply, sendTemplate, w2wPaymentMethodsTemplate, somethingWentWrongQuickReply } = require('../../../instaChatbotUtils');
const lang = require('../../../languages/languages.json');
const Wallet = require("../../../../models/Wallet.model");
const { balanceLimitCheck, limitCheck, featureCheck, getExchangeRatesToUSD, calculateExchangeAndFees, fetchLocalOrDefaultWalletConditionally } = require("../../../helpers");
const Transaction = require("../../../../models/Transaction.model");
const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const { checkTransactionLimitsForSender } = require('../../../conversion');
const { formattedAmount } = require("../../../InstaChatbotHelpers");
const { handleOTPGeneration, validateOTP, invalidMessage } = require("../../../instaChatbotOTP");
const paypalUrl = process.env.PAYPAL_URL
const iso2Countries = require("../../../countries_iso2.json");
const { w2wSubscriptionPaypal } = require('./w2wSubscriptionPaypal');
const w2wPaypalSchedule = require('./w2wSchedulePaypal');
const { formatDecimalNumbersWithLimit } = require('../../../payerRates');

const initiateW2WPaypalTransactionHelper = async (rates, data, w2wToken, type, platform) => {
    try {
        // return console.log(data)
        const ref = 'tr_' + Date.now().toString();

        console.log({ data })
        const receiverWallet = await Wallet.findOne({
            $and: [
                { _id: data.sender_wallet_id },
                { wallet_type: "insta" },
                { status: 'active' },
                {
                    $or: [
                        { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                        { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                        { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                        { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                    ]
                }
            ]
        }).populate([{ path: 'account', populate: ['level'] }]);

        console.log(receiverWallet)

        if (!receiverWallet) {
            return { status: false, message: "Wallet not found." };
        }

        const featureChecked = await featureCheck('topup_channel', 'paypal', receiverWallet.account.level);
        if (!featureChecked) {
            return { status: false, message: "This service is not allowed." };
        }

        console.log({ rates })
        const paypal = rates.paypal
        console.log(rates.totalAmountWithFee, paypal.paypal_converted.value, "paypal.paypal_converted.value")
        const paypalAmount = paypal.paypal_currency_supported
            ? rates.totalAmountWithFee
            : paypal.paypal_converted.value;
        const paypalCurrency = paypal.paypal_currency_supported
            ? receiverWallet.currency.code
            : "USD";

        const amountInUSD = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(
            receiverWallet.currency.code,
            'USD',
            rates.totalAmountWithFee - paypal.fee.value
        ));
        const amountInUSDTotal = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(
            receiverWallet.currency.code,
            'USD',
            rates.totalAmountWithFee
        ))
        const balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account);
        const limitChecked = limitCheck(parseFloat(amountInUSDTotal), receiverWallet.account.level, receiverWallet.account, 'topup');

        if (!limitChecked.status || !balanceLimitChecked) {
            return {
                status: false,
                message: !limitChecked.status
                    ? "Transaction limit exceeded."
                    : "Balance limit exceeded."
            };
        }

        const api = `${paypalUrl}/oauth2/token`;
        const tokenResponse = await axios.post(api, 'grant_type=client_credentials', {
            auth: {
                username: process.env.PAYPAL_CLIENT_ID,
                password: process.env.PAYPAL_SECRET
            }
        });

        let redirect_url_type = type === "instant" ? "w2w_instant" : type === "quotation" ? "w2w_quotation" : type === "request" ? "w2w_request" : "w2w_qr_pay"
        const paymentApi = `${paypalUrl}/payments/payment`;
        const paymentObj = {
            intent: "sale",
            payer: { payment_method: "paypal" },
            transactions: [{
                amount: {
                    total: paypalAmount.toFixed(2),
                    currency: paypalCurrency
                },
                description: receiverWallet.account.username,
                custom: receiverWallet.wallet_id,
                item_list: {
                    shipping_address: {
                        recipient_name: `${receiverWallet.account.first_name} ${receiverWallet.account.last_name}`,
                        line1: receiverWallet.account.address || receiverWallet.account.country_iso_code,
                        city: receiverWallet.account.city || "",
                        country_code: iso2Countries[receiverWallet.account.country_iso_code] || "CH",
                        postal_code: receiverWallet.account.postal_code || "",
                        phone: receiverWallet.account.phone || ""
                    }
                }
            }],
            redirect_urls: {
                return_url: `https://my.insta-pay.ch/chatbot/paypal-transaction/success/${ref}?flow=${redirect_url_type}${platform ? `&platform=${platform}` : ''}`,
                cancel_url: `https://my.insta-pay.ch/chatbot/paypal-transaction/failed/${ref}?flow=${redirect_url_type}${platform ? `&platform=${platform}` : ''}`
            }
        };

        const resp1 = await axios.post(paymentApi, paymentObj, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + tokenResponse.data.access_token
            }
        });

        if (resp1.data.state !== 'created') {
            return { status: false, message: "Transaction failed during PayPal processing." };
        }

        let token_type = type === "instant" ? "wallet_to_wallet_instant_bot" :
            type === "quotation" ? "wallet_to_wallet_quotation_bot" :
                type === "request" ? "wallet_to_wallet_request_bot" :
                    "wallet_to_wallet_qr_pay_bot"
        const transaction = await Transaction.create({
            reference_id: ref,
            type: 'instant',
            transaction_type: 'credit',
            service_type: 'topup',
            payment_type: 'paypal',
            status: 'INITIATED',
            description: 'Topup by Paypal',
            payment_id: resp1.data.id,
            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
            replacement_currency: { code: paypalCurrency, value: paypalAmount.toFixed(2), rate: paypal.paypal_rate.value },
            amount: rates.totalAmountWithFee - paypal.fee.value,
            fee: paypal.fee.value,
            total: rates.totalAmountWithFee,
            wallet_id: receiverWallet.wallet_id,
            wallet: receiverWallet._id,
            account: receiverWallet.account._id,
            receiver: receiverWallet.account._id,
            current_balance: receiverWallet.balance.available,
            hidden: true,
            external_token: { token: w2wToken, type: `${token_type}${platform ? `_${platform}` : ''}` },
            notificationNotSent: true,
            timeline: [{ status: 'INITIATED', date: moment().tz(receiverWallet.account.timezone || "UTC").format() }]
        });

        const link = resp1.data.links.find(l => l.rel === 'approval_url');
        return {
            status: true,
            message: "Transaction initiated successfully.",
            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
            transaction_id: transaction._id,
            transaction_ref: transaction.reference_id,
            url: link ? link.href : ''
        };

    } catch (err) {
        console.error(err);
        return { status: false, message: "Internal server error!", error: err };
    }
};
async function w2wUsingPaypal(senderId, payload, account, bot, text, selectedLanguage) {

    const data = {
        sender: {
            id: senderId
        }
    }

    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReply(data, lang[selectedLanguage].NO_DEFAULT_WALLET);
    }

    console.log({ defaultWallet })

    if (payload === "w2w_paypal") {

        const message = lang[selectedLanguage].ENTER_AMOUNT_CURRENCY.replace('{{currency}}', defaultWallet?.currency.code);
        await quickMessage(data, message, "w2w_paypal_payment_amount");
    }

    // user has entered amount
    else if (bot?.last_message === "w2w_paypal_payment_amount" && !payload && text) {

        const digitRegex = /^\d+(\.\d+)?$/;
        const isNumber = digitRegex.test(text)
        const amount = parseFloat(text);

        if (isNumber && amount >= 0.1) {
            bot.wallet_transactions.amount = amount
            await bot.save()

            console.log(bot.wallet_transactions)

            const receivingWallet = await Wallet.findOne({ wallet_id: bot.qr_receiving_wallet })

            const { exchange_rate, fee, totalAmountWithFee, recipient_amount, paypal } = await calculateExchangeAndFees(defaultWallet.currency.code, receivingWallet.currency.code, amount, "wallet_to_wallet", account?.level._id, "paypal", defaultWallet, "instant");

            console.log({ exchange_rate, fee, totalAmountWithFee, recipient_amount, paypal })

            let exchangedAmountSender = await getExchangeRatesToUSD(defaultWallet.currency.code, 'USD', totalAmountWithFee)

            const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, defaultWallet, 'sending')

            if (!sender_limits_check.status) {
                await quickMessage(data, sender_limits_check.message, "w2w_paypal_payment_amount");
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
                { content_type: "text", title: lang[selectedLanguage].PROCEED_TO_TRANSFER, payload: "w2w_paypal_payment-proceed" },
                { content_type: "text", title: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, payload: "w2w_paypal_payment-adjust" },
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
    else if (payload === "w2w_paypal_payment-adjust") {
        bot.wallet_transactions.amount = null
        await bot.save()

        const message = lang[selectedLanguage].UPDATED_AMOUNT;
        await quickMessage(data, message, "w2w_paypal_payment_amount");

    }

    // user has proceeded with payment
    else if (payload === "w2w_paypal_payment-proceed") {
        console.log("yes i ran")
        await w2wPaymentMethodsTemplate(data, senderId, selectedLanguage, "w2w_paypal_payment");
    }

    // if user has selected instant w2w with card
    else if (payload === "w2w_paypal_payment-instant") {
        await handleOTPGeneration(selectedLanguage, senderId, "w2w_paypal_payment-otp", "w2w_paypal_payment-otp", "Transaction OTP");
    }
    // user has selected payment type
    else if (payload?.includes("w2w_paypal_payment_type-")) {
        console.log(payload)
        const paymentType = payload.split("-")[1]
        console.log(paymentType)

        if (paymentType === "subscription") {
            await w2wSubscriptionPaypal(senderId, payload, account, bot, text, selectedLanguage)

        } else if (paymentType === "schedule") {
            await w2wPaypalSchedule(senderId, payload, account, bot, text, selectedLanguage)
        } else {
            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
            ]
            await quickReply(data, lang[selectedLanguage].TRANSACTION_ERROR_MESSAGE, quickReplies, "4");
        }

    }

    // user has entered otp for instant
    else if (bot?.last_message === "w2w_paypal_payment-otp" && !payload && text) {
        const otpValidationResult = await validateOTP(senderId, text, "w2w_paypal_payment-otp");

        if (otpValidationResult.status) {

            const receivingWallet = await Wallet.findOne({ wallet_id: bot.qr_receiving_wallet })

            const rates = await calculateExchangeAndFees(defaultWallet.currency.code, receivingWallet.currency.code, bot.wallet_transactions.amount, "wallet_to_wallet", account?.level._id, "paypal", defaultWallet, "instant");

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
                amount: bot.wallet_transactions.amount,
                type: "instant",
                payment_type: "wallet_to_wallet",
                description: "",
                token
            }

            const JWTToken = jwt.sign(w2w_data, process.env.jwtKey, { expiresIn: '10m' });

            console.log({ rates, w2w_data })
            const initiateDetails = await initiateW2WPaypalTransactionHelper(rates, w2w_data, JWTToken, "instant");
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

                await invalidMessage(data, "w2w_paypal_payment-otp", selectedLanguage, bot?.otpType);
            }
        }
    }

    // if user is proceeding with subscription method
    else if (payload?.includes("w2w_paypal_payment_subs") || bot.last_message.includes("w2w_paypal_payment_subs")) {
        await w2wSubscriptionPaypal(senderId, payload, account, bot, text, selectedLanguage)
    }

    // if user is proceeding with subscription method
    else if (payload?.includes("w2w_paypal_payment-sched") || bot.last_message.includes("w2w_paypal_payment-sched")) {
        await w2wPaypalSchedule(senderId, payload, account, bot, text, selectedLanguage)
    }

}

module.exports.w2wUsingPaypal = w2wUsingPaypal
module.exports.initiateW2WPaypalTransactionHelper = initiateW2WPaypalTransactionHelper