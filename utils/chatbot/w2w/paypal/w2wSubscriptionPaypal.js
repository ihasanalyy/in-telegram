const axios = require('axios');
const { quickMessage, quickReply, sendTemplate, w2wPaymentMethodsTemplateCard, generateToken, somethingWentWrongQuickReply } = require("../../../instaChatbotUtils");
const CryptoJS = require("crypto-js");
const lang = require('../../../languages/languages.json');
const PanModel = require("../../../../models/Pan.model");
const Wallet = require("../../../../models/Wallet.model");
const { balanceLimitCheck, limitCheck, featureCheck, getExchangeRatesToUSD, calculateExchangeAndFees, fetchLocalOrDefaultWalletConditionally } = require("../../../helpers");
const { topUpFeeCalculation } = require("../../../../controllers/Trust-Payment.controller");
const Transaction = require("../../../../models/Transaction.model");
const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const { formattedAmount } = require("../../../InstaChatbotHelpers");
const { handleOTPGeneration, validateOTP, invalidMessage } = require("../../../instaChatbotOTP");
const topupTransactionDataTokenKey = "bac6723rd@#dn#aFw%%Y%VSV"
const countriesIso = require('../../../countries_iso2.json')
// const paypalUrl = "https://api-m.sandbox.paypal.com/v1"
const iso2Countries = require("../../../countries_iso2.json");
const { formatDecimalNumbersWithLimit } = require('../../../payerRates');
const paypalUrl = "https://api-m.paypal.com/v1"
const initiateW2WPaypalScheduleHelper = async (rates, wallet_id, w2wToken, type) => {
    try {
        // return console.log(data)
        const ref = 'tr_' + Date.now().toString();

        const receiverWallet = await Wallet.findOne({
            $and: [
                { _id: wallet_id },
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

        const amountInUSD = formatDecimalNumbersWithLimit(
            await getExchangeRatesToUSD(
                receiverWallet.currency.code,
                'USD',
                rates.totalAmountWithFee - paypal.fee.value
            )
        );
        const amountInUSDTotal = formatDecimalNumbersWithLimit(
            await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', rates.totalAmountWithFee)
        );

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
                return_url: `https://my.insta-pay.ch/chatbot/paypal-transaction/success/${ref}?flow=w2w_instant`,
                cancel_url: `https://my.insta-pay.ch/chatbot/paypal-transaction/failed/${ref}?flow=w2w_instant`
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
            external_token: { token: w2wToken, type: `wallet_to_wallet_intant_bot-${type}` },
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

async function w2wSubscriptionPaypal(senderId, payload, account, bot, text, selectedLanguage) {
    const data = {
        sender: {
            id: senderId
        }
    }

    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReply(data, lang[selectedLanguage].NO_DEFAULT_WALLET);
    }

    if (payload === "w2w_paypal_payment_type-subscription") {
        const message = lang[selectedLanguage].FINAL_AMOUNT_INFO

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].CONTINUE, payload: "w2w_paypal_payment_subs" },
            { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "cancel_w2w_transs" },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
        ];
        await quickReply(data, message, quickReplies, "4");

    } else if (payload === "w2w_paypal_payment_subs") {
        const token = generateToken(senderId, bot._id);

        const templatePayload = {
            template_type: "generic",
            elements: [
                {
                    title: lang[selectedLanguage].SET_START_DATE,
                    buttons: [
                        {
                            type: "web_url",
                            title: lang[selectedLanguage].SELECT_STARTING_DATE,
                            url: `https://my.insta-pay.ch/chatbot/subscription/${token}?default=${account?.timezone}&method=paypal`,
                            webview_height_ratio: "full"
                        },
                        {
                            type: "postback",
                            title: lang[selectedLanguage].BACK_TITLE,
                            payload: 'w2w_paypal_payment-proceed',
                        },
                    ],
                },
            ]
        };
        await sendTemplate(data, senderId, templatePayload, "4")
    }
    // user has proceed with until I stop
    else if (payload === "w2w_paypal_payment_subs-until") {
        const receiverWalletDetails = await Wallet.findOne({ wallet_id: bot?.qr_receiving_wallet }).populate([
            {
                path: 'account',
                populate: [
                    { path: 'user' },
                    { path: 'company' },
                ]
            }
        ]);

        bot.subscriptionUntilIStop = true;
        await bot.save()
        const userName = receiverWalletDetails?.account?.account_type === "individual" ? receiverWalletDetails?.account?.user?.first_name + " " + receiverWalletDetails?.account?.user?.last_name : receiverWalletDetails?.account?.company?.company_name


        const message = lang[selectedLanguage]["OPEN_ENDED_SUBSCRIPTION_INITIATION"]
            .replace("{{amount}}", formattedAmount(bot.wallet_transactions.amount))
            .replace("{{currency}}", defaultWallet?.currency?.code)
            .replace("{{recipient}}", userName)
            .replace("{{start_date}}", bot?.subscriptionDate);


        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].CONFIRM_TRANSFER_TITLE, payload: "w2w_paypal_payment_subs-until_confirm" },
            { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "cancel_w2w_transs" },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
        ];
        await quickReply(data, message, quickReplies, "4");

    }
    // user has proceed with cycles
    else if (payload === "w2w_paypal_payment_subs-cycles") {
        await quickMessage(data, lang[selectedLanguage].ENTER_SUBSCRIPTION_MONTHS, "w2w_paypal_payment_subs-cycles");
    }
    // user has entered the number of cycles
    else if (bot?.last_message === "w2w_paypal_payment_subs-cycles" && text && !payload) {
        const digitRegex = /^\d+$/;
        const isNumber = digitRegex.test(text)
        if (isNumber) {
            bot.subscriptionCycles = parseInt(text);
            await bot.save()

            const receiverWalletDetails = await Wallet.findOne({ wallet_id: bot?.qr_receiving_wallet }).populate([
                {
                    path: 'account',
                    populate: [
                        { path: 'user' },
                        { path: 'company' },
                    ]
                }
            ]);
            const userName = receiverWalletDetails?.account?.account_type === "individual" ? receiverWalletDetails?.account?.user?.first_name + " " + receiverWalletDetails?.account?.user?.last_name : receiverWalletDetails?.account?.company?.company_name


            const message = lang[selectedLanguage]["SUBSCRIPTION_INITIATION_DURATION"]
                .replace("{{amount}}", formattedAmount(bot.wallet_transactions.amount))
                .replace("{{currency}}", defaultWallet?.currency?.code)
                .replace("{{recipient}}", userName)
                .replace("{{duration}}", parseInt(text))
                .replace("{{start_date}}", bot?.subscriptionDate);


            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].CONFIRM_TITLE, payload: "w2w_paypal_payment_subs-confirm_cycle" },
                { content_type: "text", title: lang[selectedLanguage].CHANGE_DETAILS, payload: "w2w_paypal_payment_subs-cycles" },
                { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "cancel_w2w_transs" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
            ];

            await quickReply(data, message, quickReplies, "4");

        } else {
            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].ENTER_AGAIN, payload: "w2w_paypal_payment_subs-cycles" },
                { content_type: "text", title: lang[selectedLanguage].BACK_TITLE, payload: "w2w_paypal_payment-proceed" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" },
            ];

            await quickReply(data, lang[selectedLanguage].INVALID_CYCLES_MESSAGE, quickReplies, "4");
        }
    }

    // user has proceeded with selecting an end date
    else if (payload === "w2w_paypal_payment_subs-end") {
        const token = generateToken(senderId, bot._id);
        const encryptedDate = CryptoJS.AES.encrypt(bot?.subscriptionDate, "subscription_date_encryption").toString();

        const templatePayload = {
            template_type: "generic",
            elements: [
                {
                    title: lang[selectedLanguage].SELECT_END_DATE_TITLE,
                    buttons: [
                        {
                            type: "web_url",
                            title: lang[selectedLanguage].SELECT_DATE_TITLE,
                            url: `https://my.insta-pay.ch/chatbot/subscription-end-date/${token}/${encryptedDate}?default=${account?.timezone}&method=paypal`,
                            webview_height_ratio: "full"
                        },
                        {
                            type: "postback",
                            title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                            payload: 'main_menu',
                        },
                    ],
                },
            ]
        };
        await sendTemplate(data, senderId, templatePayload, "4");
    }

    // proceeding with the transaction
    else if (payload === "w2w_paypal_payment_subs-end-confirm" || payload === "w2w_paypal_payment_subs-confirm_cycle" || payload === "w2w_paypal_payment_subs-until_confirm") {

        const receivingWallet = await Wallet.findOne({ wallet_id: bot.qr_receiving_wallet })

        const { totalAmountWithFee } = await calculateExchangeAndFees(defaultWallet.currency.code, receivingWallet.currency.code, bot.wallet_transactions.amount, "wallet_to_wallet", account?.level._id, "paypal", defaultWallet, "instant");

        const message = lang[selectedLanguage].RESERVE_AMOUNT_MESSAGE_PAYPAL
            .replace('{{amount}}', formattedAmount(totalAmountWithFee))
            .replace('{{currency}}', defaultWallet.currency.code);

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].CONTINUE, payload: "w2w_paypal_payment_subs-confirm" },
            { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "cancel_w2w_transs" },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
        ];

        await quickReply(data, message, quickReplies, "4");
    }

    // user has proceeded with paypal payment
    else if (payload === "w2w_paypal_payment_subs-confirm") {
        await handleOTPGeneration(selectedLanguage, senderId, "w2w_paypal_payment_subs-otp", "w2w_paypal_payment_subs-otp", "Transaction OTP");
    }

    // user has entered OTP
    else if (bot?.last_message === "w2w_paypal_payment_subs-otp" && !payload && text) {
        const otpValidationResult = await validateOTP(senderId, text, "w2w_paypal_payment_subs-otp");

        if (otpValidationResult.status) {

            const receivingWallet = await Wallet.findOne({ wallet_id: bot.qr_receiving_wallet })

            const rates = await calculateExchangeAndFees(defaultWallet.currency.code, receivingWallet.currency.code, bot.wallet_transactions.amount, "wallet_to_wallet", account?.level._id, "paypal", defaultWallet, "instant");

            let subscription_data = {
                receiver_wallet_id: bot?.qr_receiving_wallet,
                sender_wallet_id: bot?.qr_sending_currency,
                purpose: bot?.transaction_purpose || "",
                amount: bot.wallet_transactions.amount,
                date: bot?.subscriptionDate,
                next_date: bot?.subscriptionDate,
                nextCycles: bot?.subscriptionCycles ?? 0,
                cycles: bot?.subscriptionCycles ?? 0,
                untilIStop: bot.subscriptionUntilIStop ?? false,
                timezone: bot?.subscriptionTimezone || account?.timezone,
                attachments: bot.w2w_attachments,
                description: bot.w2w_note,
                type: "subscription"
            }

            const JWTToken = jwt.sign(subscription_data, process.env.jwtKey, { expiresIn: '10m' });

            console.log({ subscription_data, rates })

            const transactionDetails = await initiateW2WPaypalScheduleHelper(rates, defaultWallet._id, JWTToken, "subscription");
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

module.exports.w2wSubscriptionPaypal = w2wSubscriptionPaypal
module.exports.initiateW2WPaypalScheduleHelper = initiateW2WPaypalScheduleHelper