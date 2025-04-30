const { fetchLocalOrDefaultWalletConditionally, vccTopupFeeCalculation, convertCurrency } = require("../../../helpers");
const { somethingWentWrongQuickReplyTelegram, sendButtons, sendMessage } = require("../../../telegramBotUtils");
const lang = require("../../../languages/languages.json");
const PanModel = require("../../../../models/Pan.model");
const { validateAmount } = require("../../../instaChatbotUtils");
const VirtualCardModel = require("../../../../models/Virtual-Card.model");
const { formatDecimalNumbersWithLimit } = require("../../../payerRates");
const { formattedAmount } = require("../../../InstaChatbotHelpers");
const jwt = require("jsonwebtoken");
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../../telegramOTPHandler");
const supportedCurrencies = require("../../../paypalSupportedCurrencies.json");
const VCCTransactionModel = require("../../../../models/VCC-Transaction.model");
const paypalUrl = process.env.PAYPAL_URL
const iso2Countries = require("../../../countries_iso2.json");
const axios = require("axios")
const moment = require('moment-timezone');

async function topupUsingPaypal(chatId, payload, chat, text, selectedLanguage) {

    if (payload === "vcc_add_funds_ppl" && chat?.last_message === "vcc_add_funds_channel") {
        const cardDetails = await VirtualCardModel.findById(chat.vcc.card);
        // Get the top-up fee and markup in CARD'S currency
        const { fee, feeType } = await vccTopupFeeCalculation(
            cardDetails.currency,
            chat.account.level._id,
            chat.vcc.amount,
            `topup_paypal_vcc_${cardDetails.type?.includes("premium") ? "premium" : "standard"}_${cardDetails.subscription_type}`
        );

        console.log({ fee, feeType });

        if (!fee) {
            return await sendMessage(chatId, lang[selectedLanguage].SOMETHING_WENT_WRONG, "4");
        }

        // Check if the entered amount is lower than the top-up fee
        const minRequiredAmount = fee + fee * 0.1; // Top-up fee + 10%
        const minimumAmount = formattedAmount(minRequiredAmount); // new var
        if (chat.vcc.amount < minRequiredAmount) {
            return await sendMessage(
                chatId,
                lang[selectedLanguage].MIN_AMOUNT_LOW.replace("{{minimumAmount}}", minimumAmount).replace("{{currency}}", cardDetails.currency), //Hassan
                "vcc_add_funds_ppl_min_amount"
            );
        }

        let amountInUSD = chat.vcc.amount;
        let paypalRate = 1;
        let currencySupported = true;

        // Check if card's currency is supported by PayPal
        if (!supportedCurrencies.includes(cardDetails.currency)) {
            currencySupported = false;
            paypalRate = formatDecimalNumbersWithLimit(await convertCurrency(cardDetails.currency, "USD", 1), 6);
            console.log({ paypalRate })
            amountInUSD = formatDecimalNumbersWithLimit(paypalRate * chat.vcc.amount, 2);

            // Send message about unsupported currency
            const unsupportedMessage = `
${lang[selectedLanguage].PAYPAL_CURRENCY_NOT_SUPPORTED.replace('{{currency}}', cardDetails.currency)}
    
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${cardDetails.currency} = ${formattedAmount(paypalRate, 6)} USD
${lang[selectedLanguage].AMOUNT_IN_USD} ${formattedAmount(amountInUSD)} USD
            `;
            await sendMessage(chatId, unsupportedMessage);
        }

        const message = `
Amount to Topup: ${formattedAmount(chat.vcc.amount)} ${cardDetails.currency}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${cardDetails.currency}
You'll get: ${formattedAmount(formatDecimalNumbersWithLimit(chat.vcc.amount - fee))} ${cardDetails.currency}
`.trim();

        const dataPayload = {
            amount: chat.vcc.amount,
            fee: fee,
            feeType,
            cardId: cardDetails.card_id,
            converted_amount: amountInUSD,
            original_currency: cardDetails.currency,
            currencySupported
        };

        const token = jwt.sign(dataPayload, process.env.jwtKey, { expiresIn: "10m" });
        chat.vcc.topup_transaction_token = token;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].PROCEED_TITLE, callback_data: "vcc_add_funds_ppl_confirm" }],
            [{ text: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, callback_data: "vcc_add_funds_ppl_adjust" }],
            [{ text: lang[selectedLanguage].MY_MASTERCARD, callback_data: "vcc_menu" }],
        ];

        await sendButtons(chatId, message, buttons, "vcc_add_funds_ppl_confirm");
    }

    // user has asked to adjust the amount
    else if (payload === "vcc_add_funds_ppl_adjust" && chat?.last_message === "vcc_add_funds_ppl_confirm") {
        await sendMessage(chatId, lang[selectedLanguage].ENTER_AMOUNT_TOPUP, "vcc_add_funds_ppl_min_amount");
    }

    // user has adjusted the amount
    else if (chat.last_message === "vcc_add_funds_ppl_min_amount" && text && !payload) {
        const { status, message: amountValidationMessage, amount } = validateAmount(text, selectedLanguage);

        if (!status) {
            await sendMessage(chatId, amountValidationMessage);
            return;
        }

        chat.vcc.amount = amount;
        await chat.save();

        const cardDetails = await VirtualCardModel.findById(chat.vcc.card);
        // Get the top-up fee and markup in CARD'S currency
        const { fee, feeType } = await vccTopupFeeCalculation(
            cardDetails.currency,
            chat.account.level._id,
            chat.vcc.amount,
            `topup_paypal_vcc_${cardDetails.type?.includes("premium") ? "premium" : "standard"}_${cardDetails.subscription_type}`
        );

        console.log({ fee, feeType });

        if (!fee) {
            return await sendMessage(chatId, lang[selectedLanguage].SOMETHING_WENT_WRONG, "4");
        }

        // Check if the entered amount is lower than the top-up fee
        const minRequiredAmount = fee + fee * 0.1; // Top-up fee + 10%
        const minimumAmount = formattedAmount(minRequiredAmount);

        if (chat.vcc.amount < minRequiredAmount) {
            return await sendMessage(
                chatId,
                lang[selectedLanguage].MIN_AMOUNT_LOW.replace("{{minimumAmount}}", minimumAmount).replace("{{currency}}", cardDetails.currency),
                "vcc_add_funds_ppl_min_amount"
            );
        }

        let amountInUSD = chat.vcc.amount;
        let paypalRate = 1;
        let currencySupported = true;

        // Check if card's currency is supported by PayPal
        if (!supportedCurrencies.includes(cardDetails.currency)) {
            currencySupported = false;
            paypalRate = formatDecimalNumbersWithLimit(await convertCurrency(cardDetails.currency, "USD", 1), 6);
            console.log({ paypalRate })
            amountInUSD = formatDecimalNumbersWithLimit(paypalRate * chat.vcc.amount, 2);

            // Send message about unsupported currency
            const unsupportedMessage = `
${lang[selectedLanguage].PAYPAL_CURRENCY_NOT_SUPPORTED.replace('{{currency}}', cardDetails.currency)}
    
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${cardDetails.currency} = ${formattedAmount(paypalRate, 6)} USD
${lang[selectedLanguage].AMOUNT_IN_USD} ${formattedAmount(amountInUSD)} USD
            `;
            await sendMessage(chatId, unsupportedMessage);
        }

        const message = `
Amount to Topup: ${formattedAmount(chat.vcc.amount)} ${cardDetails.currency}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${cardDetails.currency}
You'll get: ${formattedAmount(formatDecimalNumbersWithLimit(chat.vcc.amount - fee))} ${cardDetails.currency}
`.trim();

        const dataPayload = {
            amount: chat.vcc.amount,
            fee: fee,
            feeType,
            cardId: cardDetails.card_id,
            converted_amount: amountInUSD,
            original_currency: cardDetails.currency,
            currencySupported
        };

        const token = jwt.sign(dataPayload, process.env.jwtKey, { expiresIn: "10m" });
        chat.vcc.topup_transaction_token = token;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].PROCEED_TITLE, callback_data: "vcc_add_funds_ppl_confirm" }],
            [{ text: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, callback_data: "vcc_add_funds_ppl_adjust" }],
            [{ text: lang[selectedLanguage].MY_MASTERCARD, callback_data: "vcc_menu" }],
        ];

        await sendButtons(chatId, message, buttons, "vcc_add_funds_ppl_confirm");
    }
    else if (payload === "vcc_add_funds_ppl_confirm" && chat?.last_message === "vcc_add_funds_ppl_confirm") {
        await handleOTPGenerationTG(selectedLanguage, chat, "vcc_add_funds_ppl-otp", "vcc_add_funds_ppl-otp", "Transaction OTP");
    }

    else if (chat.last_message === "vcc_add_funds_ppl-otp" && text && !payload) {
        const otpValidationResult = await validateOTPTG(chatId, text, "vcc_add_funds_ppl-otp");

        if (otpValidationResult.status) {
            // decodeding the token
            let decoded
            try {
                decoded = jwt.verify(chat.vcc.topup_transaction_token, process.env.jwtKey);
            } catch (error) {
                // transaction expiry message
                return await sendButtons(chatId, lang[selectedLanguage].TRANSACTION_EXPIRED, [[{ text: lang[selectedLanguage].MY_MASTERCARD, callback_data: "vcc_menu" }]], "4");

            }

            const api = `${paypalUrl}/oauth2/token`;
            const tokenResponse = await axios.post(api, 'grant_type=client_credentials', {
                auth: {
                    username: process.env.PAYPAL_CLIENT_ID,
                    password: process.env.PAYPAL_SECRET
                }
            });

            const redirect_url_type = "vcc_topup"
            const ref = 'tr_' + Date.now().toString()
            const paypalAmount = decoded.converted_amount
            const paypalCurrency = decoded.currencySupported ? decoded.original_currency : "USD"
            const paymentApi = `${paypalUrl}/payments/payment`;
            const paymentObj = {
                intent: "sale",
                payer: { payment_method: "paypal" },
                transactions: [{
                    amount: {
                        total: paypalAmount.toFixed(2),
                        currency: paypalCurrency
                    },
                    description: chat.account?.username,
                    custom: decoded.cardId,
                    item_list: {
                        shipping_address: {
                            recipient_name: `${chat.account?.first_name} ${chat.account?.last_name}`,
                            line1: chat.account?.address || chat.account?.country_iso_code,
                            city: chat.account?.city || "",
                            country_code: iso2Countries[chat.account?.country_iso_code] || "CH",
                            postal_code: chat.account?.postal_code || "",
                            phone: chat.account?.phone || ""
                        }
                    }
                }],
                redirect_urls: {
                    return_url: `https://my.insta-pay.ch/chatbot/paypal-transaction/success/${ref}?flow=${redirect_url_type}${`&platform=telegram`}`,
                    cancel_url: `https://my.insta-pay.ch/chatbot/paypal-transaction/failed/${ref}?flow=${redirect_url_type}${`&platform=telegram`}`
                }
            };

            console.log({ paymentObj })

            const resp1 = await axios.post(paymentApi, paymentObj, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + tokenResponse.data.access_token
                }
            });

            if (resp1.data.state !== 'created') {
                return { status: false, message: "Transaction failed during PayPal processing." };
            }

            const timezone = chat.account?.timezone || "UTC"

            const currentTime = moment().tz(timezone).format();

            const vccTransaction = await VCCTransactionModel.create({
                cardNo: decoded.cardId,
                accountId: chat.account._id,
                authCode: resp1.data.id,
                transactionId: ref,
                billAmount: decoded.amount,
                txAmount: decoded.amount,
                currency: decoded.original_currency,
                fee: decoded.fee,
                status: 'INITIATED',
                merchantName: 'Card Top-Up By Paypal',
                merchantCategory: "topup_by_paypal",
                transaction_type: 'mastercard_topup',
                type: "credit",
                timeline: [
                    {
                        date: currentTime,
                        status: "INITIATED",
                    }
                ],
                external_token: {
                    type: "mastercard_topup_bot_telegram",
                    token: chat.vcc.topup_transaction_token
                }
            });

            const link = resp1.data.links.find(l => l.rel === 'approval_url');

            const title = lang[selectedLanguage].VERIFY_PAYPAL_ACCOUNT

            const subtitle = `
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(decoded.converted_amount)} ${decoded.currencySupported ? decoded.original_currency : "USD"}`

            const buttons = [
                [
                    {
                        text: lang[selectedLanguage].VERIFY,
                        url: link.href
                    }
                ],
                [
                    { text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }
                ]
            ];

            await sendButtons(chatId, `${title}\n${subtitle}`, buttons, "4");

        }
        else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {
                await invalidMessageTG(chatId, "vcc_add_funds_ppl-otp", selectedLanguage, chat?.otpType);
            }
        }
    }
}

module.exports = { topupUsingPaypal };