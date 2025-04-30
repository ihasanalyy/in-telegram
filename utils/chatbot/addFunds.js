const { quickMessage, quickReply, sendTemplate, validateAmount } = require("../instaChatbotUtils");
const CryptoJS = require("crypto-js");
const currencyToEmoji = require('../currencyEmojis.json');
const lang = require('../languages/languages.json');
const PanModel = require("../../models/Pan.model");
const Wallet = require("../../models/Wallet.model");
const { balanceLimitCheck, limitCheck, featureCheck, getExchangeRatesToUSD, getTopupLimitMessage, validateCardExpiry } = require("../helpers");
const { topUpFeeCalculation, generatePayload } = require("../../controllers/Trust-Payment.controller");
const Transaction = require("../../models/Transaction.model");
const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const { formatDecimalNumbersWithLimit } = require("../payerRates");
const { formattedAmount } = require("../InstaChatbotHelpers");

const initiateTopup = async (data) => {
    try {
        var { wallet_id, amount, pan } = data;
        let ref = 'tr_' + Date.now().toString();

        let receiverWallet = await Wallet.findOne({
            $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])
        // console.log(receiverWallet.account._id, req.user._id);

        let panDetails = await PanModel.findOne({ $and: [{ _id: pan }, { account: receiverWallet.account._id }] })
        if (!panDetails) {
            return { status: false, message: "Invalid card" }
        }
        let bytes = await CryptoJS.AES.decrypt(panDetails.panData, process.env.PAN_ENCRYPTION_KEY);
        let panDataObj = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

        console.log(panDataObj);
        let feeDetails = await topUpFeeCalculation(receiverWallet, amount / 100, 'topup_card_payment')

        let featureChecked = await featureCheck('topup_channel', 'card_payment', receiverWallet.account.level)
        // console.log(amountInUSD);
        if (featureChecked && feeDetails >= 0) {
            let amountInUSD = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount / 100)
            // console.log(amountInUSD);
            let balanceLimitChecked = await balanceLimitCheck(parseInt(amountInUSD), receiverWallet.account)
            let limitChecked = limitCheck(parseFloat(amountInUSD), receiverWallet.account.level, receiverWallet.account, 'topup')
            // console.log(limitChecked);
            if (limitChecked.status && balanceLimitChecked) {

                const receiverTimezone = receiverWallet.account?.timezone || "UTC"
                const receiverCurrentTime = moment().tz(receiverTimezone).format();

                let receiverTransactionObj = {
                    reference_id: ref,
                    type: 'trust_payment',
                    transaction_type: 'credit',
                    service_type: 'topup',
                    payment_type: 'card',
                    status: 'INITIATED',
                    purpose: '',
                    description: 'Topup by Saved Card',
                    currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                    amount: (amount / 100) - feeDetails,
                    fee: feeDetails,
                    total: (amount / 100),
                    wallet_id: receiverWallet.wallet_id,
                    wallet: receiverWallet._id,
                    account: receiverWallet.account._id,
                    receiver: receiverWallet.account._id,
                    current_balance: receiverWallet.balance.available,
                    external_token: {
                        token: undefined,
                        type: "telegram"
                    },
                    timeline: [
                        {
                            status: 'INITIATED',
                            date: receiverCurrentTime,
                        }
                    ]
                }

                const transaction = await Transaction.create(receiverTransactionObj);

                let iat = Math.floor(Date.now() / 1000)
                const payload = generatePayload(amount / 100, receiverWallet, panDataObj, transaction, iat, true, false, "instagram");

                console.log(payload);
                const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;

                // Create a JWT
                const header = { "alg": "HS256", "typ": "JWT" };
                const secret = secretKey;

                const token = jwt.sign(payload, secret, { header });
                if (token) {
                    return {
                        status: true,
                        message: "Transaction initiated successfully.",
                        currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                        transaction_id: transaction._id,
                        transaction_ref: transaction.reference_id,
                        token
                    }
                } else {
                    return {
                        status: false,
                        message: "Transaction failed."
                    }
                }


            } else {
                if (!limitChecked.status && balanceLimitChecked) {
                    return { status: false, message: limitChecked }
                }
                if (limitChecked.status && !balanceLimitChecked) {
                    return { status: false, message: 'ble400' }
                }
                if (!limitChecked.status && !balanceLimitChecked) {
                    return { status: false, message: limitChecked }
                }
            }
        } else {
            return { status: false, message: "Service not allowed." }
        }

    } catch (err) {
        console.log(err);
        return { status: false, message: "Transaction failed." }
    }
}

async function handleAddFunds(senderId, payload, account, bot, text, selectedLanguage) {

    console.log({ senderId, payload, account, bot, text });

    const data = {
        sender: {
            id: senderId
        }
    }

    if (payload === "add_funds") {
        const pans = await PanModel.find({ account: account._id });
        console.log(pans)

        let quickReplies = []

        if (pans.length !== 0) {

            for (let i = 0; i < pans.length; i++) {
                quickReplies.push({
                    content_type: "text",
                    title: `💳 *******${pans[i].last4}`,
                    payload: `add_funds_select_card-${pans[i]._id}`
                })
            }
        }

        quickReplies.push({
            content_type: "text",
            title: `🇵 ${lang[selectedLanguage].PAYPAL}`,
            payload: "add_funds_select_paypal"
        })

        quickReplies.push({
            content_type: "text",
            title: `🇬 ${lang[selectedLanguage].GOOGLE_PAY}`,
            payload: "add_funds_select_google"
        })

        quickReplies.push({
            content_type: "text",
            title: `🇦 ${lang[selectedLanguage].APPLE_PAY}`,
            payload: "add_funds_select_apple"
        })

        quickReplies.push({
            content_type: "text",
            title: lang[selectedLanguage].OTHER_PAYMENT_METHOD,
            payload: "add_funds_other_methods"
        })

        quickReplies.push({
            content_type: "text",
            title: `☰ ${lang[selectedLanguage].MAIN_MENU}`,
            payload: "main_menu"
        })

        await quickReply({ sender: { id: senderId } }, lang[selectedLanguage].SELECT_YOUR_TOPUP_CHANNEL, quickReplies, "4");

    }

    // user has selected paypal
    else if (payload === "add_funds_select_paypal" || payload === "add_funds_select_google" || payload === "add_funds_select_apple") {

        const quickReplies = [

            { content_type: "text", title: lang[selectedLanguage].CHANGE_METHOD, payload: "add_funds" },
            { content_type: "text", title: `☰ ${lang[selectedLanguage].MAIN_MENU}`, payload: "main_menu" },
        ]

        await quickReply({ sender: { id: senderId } }, lang[selectedLanguage].PAYOUT_CHANNEL_UNAVAILABLE, quickReplies, "4");

    }

    // user has selected other methods
    else if (payload === "add_funds_other_methods") {

        await quickMessage(data, lang[selectedLanguage].ADD_FUNDS_STEPS, "4");
        const templatePayload = {

            template_type: "generic",
            elements: [
                {
                    title: lang[selectedLanguage].CLICK_TO_LOG_IN,
                    buttons: [
                        {
                            type: "web_url",
                            title: lang[selectedLanguage].LOGIN,
                            url: "https://my.insta-pay.ch/login",
                        },
                        {
                            type: "postback",
                            title: `${lang[selectedLanguage].MAIN_MENU}`,
                            payload: "main_menu",
                        },

                    ],
                },


            ],

        };
        await sendTemplate(data, senderId, templatePayload)
    }
    // user has selected topup channel
    else if (payload?.includes("add_funds_select_card")) {

        const cardId = payload.split("-")[1]

        const expiryValidation = await validateCardExpiry(cardId);

        if (!expiryValidation.status) {
            const pans = await PanModel.find({ account: account._id });
            console.log(pans)

            let quickReplies = []

            if (pans.length !== 0) {

                for (let i = 0; i < pans.length; i++) {
                    quickReplies.push({
                        content_type: "text",
                        title: `💳 *******${pans[i].last4}`,
                        payload: `add_funds_select_card-${pans[i]._id}`
                    })
                }
            }

            quickReplies.push({
                content_type: "text",
                title: `🇵 ${lang[selectedLanguage].PAYPAL}`,
                payload: "add_funds_select_paypal"
            })

            quickReplies.push({
                content_type: "text",
                title: `🇬 ${lang[selectedLanguage].GOOGLE_PAY}`,
                payload: "add_funds_select_google"
            })

            quickReplies.push({
                content_type: "text",
                title: `🇦 ${lang[selectedLanguage].APPLE_PAY}`,
                payload: "add_funds_select_apple"
            })

            quickReplies.push({
                content_type: "text",
                title: lang[selectedLanguage].OTHER_PAYMENT_METHOD,
                payload: "add_funds_other_methods"
            })

            quickReplies.push({
                content_type: "text",
                title: `☰ ${lang[selectedLanguage].MAIN_MENU}`,
                payload: "main_menu"
            })

            return await quickReply({ sender: { id: senderId } }, "The card you selected has expired and is now removed from your InstaPay account.\n\n" +
                "To continue with this transaction, please choose an alternative payment method.", quickReplies, "4");
        }

        bot.topup.pan = cardId
        await bot.save()

        const wallets = await Wallet.find({ account: account?._id, wallet_type: 'insta', status: "active" });
        const slicedWallets = wallets.slice(0, 8)

        const quickReplies = slicedWallets?.map((wallet) => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `add_funds_card_wallet-${wallet._id}` } })
        quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" })

        const message = lang[selectedLanguage].SELECT_WALLET_CURRENCY;
        await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
    }

    // user has selected wallet
    else if (payload?.includes("add_funds_card_wallet")) {
        const walletId = payload.split("-")[1]

        bot.topup.wallet = walletId
        await bot.save()

        const message = lang[selectedLanguage].ENTER_AMOUNT_TOPUP;
        await quickMessage(data, message, "add_funds_card_amount");
    }

    // user has entered amount
    else if (bot?.last_message === "add_funds_card_amount" && !payload && text) {
        const validation = validateAmount(text, selectedLanguage);

        if (!validation.status) {
            await quickMessage(data, validation.message);
            return;
        }

        const amount = validation.amount;
        bot.topup.amount = amount
        await bot.save()

        const panDetails = await PanModel.findById(bot.topup.pan)
        const card = panDetails.last4

        const walletDetails = await Wallet.findById(bot.topup.wallet)

        const initiateTopupDetails = await initiateTopup({ wallet_id: walletDetails._id, amount: parseFloat(text) * 100, pan: panDetails._id })

        console.log({ initiateTopupDetails })

        if (initiateTopupDetails.status) {

            const title = lang[selectedLanguage].VERIFY_CARD

            const subtitle = `
${lang[selectedLanguage].CARD}: *******${card}
${lang[selectedLanguage].AMOUNT}: ${formatDecimalNumbersWithLimit(formattedAmount(text))} ${walletDetails.currency.code}
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
                                url: `https://my.insta-pay.ch/chatbot/pan-transaction?token=${initiateTopupDetails?.token}&transaction_id=${initiateTopupDetails?.transaction_id}&reference_id=${initiateTopupDetails.reference_id}&slug=confirm-chatbot-pan-topup`,
                                webview_height_ratio: "full"
                            },
                            {
                                type: "postback",
                                title: lang[selectedLanguage].MODIFY_DETAILS,
                                payload: "add_funds",
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
                { content_type: "text", title: `☰ ${lang[selectedLanguage].MAIN_MENU}`, payload: "main_menu" },
            ]
            if (initiateTopupDetails?.message === "ble400") {
                await quickReply({ sender: { id: senderId } }, lang[selectedLanguage].EXCEED_BALANCE_LIMIT_TRANS, quickReplies);
            }
            // else if message contains rdl400, rml400, ryl400
            else if (initiateTopupDetails?.message?.code === "tal400" || initiateTopupDetails?.message?.code === "tpl400" || initiateTopupDetails?.message?.code === "rdl400" || initiateTopupDetails?.message?.code === "rml400" || initiateTopupDetails?.message?.code === "ryl400") {
                const topUpValues = await getTopupLimitMessage(initiateTopupDetails?.message?.code, walletDetails.currency.code, account);
                let message;
                if (initiateTopupDetails?.message?.code === "tpl400") {
                    message = lang[selectedLanguage].TOPUP_LIMIT_EXCEEDED
                        .replace('{{min_amount}}', formattedAmount(topUpValues.value.min))
                        .replace('{{max_amount}}', formattedAmount(topUpValues.value.max))
                        .replace(/{{currencyCode}}/g, walletDetails.currency.code);
                }
                else if (initiateTopupDetails?.message?.code === "tal400") {
                    message = lang[selectedLanguage].TRANSACTION_AMOUNT_LIMIT_EXCEEDED
                        .replace('{{amount}}', formattedAmount(topUpValues.value))
                        .replace(/{{currency}}/g, walletDetails.currency.code);
                }
                else if (initiateTopupDetails?.message?.code === "rdl400") {
                    message = lang[selectedLanguage].DAILY_LIMIT_REACHED_RECEIVING
                        .replace('{{amount}}', formattedAmount(topUpValues.value))
                        .replace(/{{currencyCode}}/g, walletDetails.currency.code);
                } else if (initiateTopupDetails?.message?.code === "rml400") {
                    message = lang[selectedLanguage].MONTHLY_LIMIT_REACHED_RECEIVING
                        .replace('{{amount}}', formattedAmount(topUpValues.value))
                        .replace(/{{currencyCode}}/g, walletDetails.currency.code);
                } else if (initiateTopupDetails?.message?.code === "ryl400") {
                    message = lang[selectedLanguage].YEARLY_LIMIT_REACHED_RECEIVING
                        .replace('{{amount}}', formattedAmount(topUpValues.value))
                        .replace(/{{currencyCode}}/g, walletDetails.currency.code);
                }
                console.log({ topUpValues }, message)
                await quickReply({ sender: { id: senderId } }, message, quickReplies);
            } else {
                await quickReply({ sender: { id: senderId } }, lang[selectedLanguage].TRANSACTION_ERROR_MESSAGE, quickReplies, "4");
            }
        }

    }
}

module.exports.handleAddFunds = handleAddFunds
module.exports.initiateTopup = initiateTopup