const PanModel = require("../../../../models/Pan.model");
const VirtualCardModel = require("../../../../models/Virtual-Card.model");
const { validateCardExpiry, vccTopupFeeCalculation, fetchLocalOrDefaultWalletConditionally } = require("../../../helpers");
const lang = require("../../../languages/languages.json")
const { formattedAmount } = require("../../../InstaChatbotHelpers");
const { quickMessage, quickReply, sendTemplate, somethingWentWrongQuickReply, validateAmount } = require("../../../instaChatbotUtils")
const jwt = require("jsonwebtoken");
const { handleOTPGeneration, validateOTP, invalidMessage } = require("../../../instaChatbotOTP");
const moment = require('moment-timezone');
const VCCTransactionModel = require("../../../../models/VCC-Transaction.model");
const paypalUrl = process.env.PAYPAL_URL
const iso2Countries = require("../../../countries_iso2.json");
const { formatDecimalNumbersWithLimit } = require("../../../payerRates");
const supportedCurrencies = require("../../../paypalSupportedCurrencies.json");
const axios = require("axios")

async function topupUsingPaypal(senderId, payload, account, bot, text, selectedLanguage) {
    const data = {
        sender: {
            id: senderId
        }
    };

    if (payload === "vcc_add_funds_ppl" && bot?.last_message === "vcc_add_funds_channel") {
        const cardDetails = await VirtualCardModel.findById(bot.vcc.card);

        // Get the top-up fee and markup in CARD'S currency
        const { fee, feeType } = await vccTopupFeeCalculation(
            cardDetails.currency,
            account.level._id,
            bot.vcc.amount,
            `topup_paypal_vcc_${cardDetails.type?.includes("premium") ? "premium" : "standard"}_${cardDetails.subscription_type}`
        );

        if (!fee) {
            return await somethingWentWrongQuickReply(data, "Something went wrong. Please try again. If the problem persists, contact our support team.");
        }

        // Check if the entered amount is lower than the top-up fee
        const minRequiredAmount = fee + fee * 0.1; // Top-up fee + 10%
        if (bot.vcc.amount < minRequiredAmount) {
            return await quickMessage(
                data,
                `The amount entered is too low. The minimum amount required for a top-up is ${formattedAmount(minRequiredAmount)} ${cardDetails.currency}. Please enter a higher amount.`,
                "vcc_add_funds_ppl_min_amount"
            );
        }

        let amountInUSD = bot.vcc.amount;
        let paypalRate = 1;
        let currencySupported = true;

        // Check if card's currency is supported by PayPal
        if (!supportedCurrencies.includes(cardDetails.currency)) {
            currencySupported = false;
            paypalRate = formatDecimalNumbersWithLimit(await convertCurrency(cardDetails.currency, "USD", 1), 6);
            amountInUSD = formatDecimalNumbersWithLimit(paypalRate * bot.vcc.amount, 2);

            // Send message about unsupported currency
            const unsupportedMessage = `
${lang[selectedLanguage].PAYPAL_CURRENCY_NOT_SUPPORTED.replace('{{currency}}', cardDetails.currency)}
    
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${cardDetails.currency} = ${formattedAmount(paypalRate, 6)} USD
${lang[selectedLanguage].AMOUNT_IN_USD} ${formattedAmount(amountInUSD)} USD
            `;
            await quickMessage(data, unsupportedMessage);
        }

        const message = `
Amount to Topup: ${formattedAmount(bot.vcc.amount)} ${cardDetails.currency}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${cardDetails.currency}
You'll get: ${formattedAmount(formatDecimalNumbersWithLimit(bot.vcc.amount - fee))} ${cardDetails.currency}
`.trim();

        const dataPayload = {
            amount: bot.vcc.amount,
            fee: fee,
            feeType,
            cardId: cardDetails.card_id,
            converted_amount: amountInUSD,
            original_currency: cardDetails.currency,
            currencySupported
        };

        const token = jwt.sign(dataPayload, process.env.jwtKey, { expiresIn: "10m" });
        bot.vcc.topup_transaction_token = token;
        await bot.save();

        const quickReplies = [
            {
                content_type: "text",
                title: lang[selectedLanguage].PROCEED_TITLE,
                payload: "vcc_add_funds_ppl_confirm"
            },
            {
                content_type: "text",
                title: lang[selectedLanguage].ADJUST_AMOUNT_TITLE,
                payload: "vcc_add_funds_ppl_adjust"
            },
            {
                content_type: "text",
                title: "My MasterCard",
                payload: "vcc_menu"
            }
        ];

        await quickReply(data, message, quickReplies, "vcc_add_funds_ppl_confirm");
    }

    // user has asked to adjust the amount
    else if (payload === "vcc_add_funds_ppl_adjust" && bot?.last_message === "vcc_add_funds_ppl_confirm") {
        await quickMessage(data, lang[selectedLanguage].ENTER_AMOUNT_TOPUP, "vcc_add_funds_ppl_min_amount");
    }
    // user has adjusted the amount
    else if (bot.last_message === "vcc_add_funds_ppl_min_amount" && text && !payload) {

        const { status, message: amountValidationMessage, amount } = validateAmount(text, selectedLanguage);

        if (!status) {
            await quickMessage(data, amountValidationMessage);
            return;
        }

        bot.vcc.amount = amount;
        await bot.save();

        const cardDetails = await VirtualCardModel.findById(bot.vcc.card);
        // Get the top-up fee and markup in CARD'S currency
        const { fee, feeType } = await vccTopupFeeCalculation(
            cardDetails.currency,
            account.level._id,
            bot.vcc.amount,
            `topup_paypal_vcc_${cardDetails.type?.includes("premium") ? "premium" : "standard"}_${cardDetails.subscription_type}`
        );

        console.log({ fee, feeType });

        if (!fee) {
            return await somethingWentWrongQuickReply(data, "Something went wrong. Please try again. If the problem persists, contact our support team.");
        }

        // Check if the entered amount is lower than the top-up fee
        const minRequiredAmount = fee + fee * 0.1; // Top-up fee + 10%
        if (bot.vcc.amount < minRequiredAmount) {
            const message = `The amount entered is too low. The minimum amount required for a top-up is ${formattedAmount(minRequiredAmount)} ${cardDetails.currency}. Please enter a higher amount.`;
            await quickMessage(data, message, "vcc_add_funds_ppl_min_amount");
            return;
        }

        let amountInUSD = bot.vcc.amount;
        let paypalRate = 1;
        let currencySupported = true;

        // Check if card's currency is supported by PayPal
        if (!supportedCurrencies.includes(cardDetails.currency)) {
            currencySupported = false;
            paypalRate = formatDecimalNumbersWithLimit(await convertCurrency(cardDetails.currency, "USD", 1), 6);
            console.log({ paypalRate })
            amountInUSD = formatDecimalNumbersWithLimit(paypalRate * bot.vcc.amount, 2);

            // Send message about unsupported currency
            const unsupportedMessage = `
${lang[selectedLanguage].PAYPAL_CURRENCY_NOT_SUPPORTED.replace('{{currency}}', cardDetails.currency)}
    
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${cardDetails.currency} = ${formattedAmount(paypalRate, 6)} USD
${lang[selectedLanguage].AMOUNT_IN_USD} ${formattedAmount(amountInUSD)} USD
        `;
            await quickMessage(data, unsupportedMessage);
        }

        const message = `
Amount to Topup: ${formattedAmount(bot.vcc.amount)} ${cardDetails.currency}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${cardDetails.currency}
You'll get: ${formattedAmount(formatDecimalNumbersWithLimit(bot.vcc.amount - fee))} ${cardDetails.currency}
`.trim();

        const dataPayload = {
            amount: bot.vcc.amount,
            fee: fee,
            feeType,
            cardId: cardDetails.card_id,
            converted_amount: amountInUSD,
            original_currency: cardDetails.currency,
            currencySupported
        };

        const token = jwt.sign(dataPayload, process.env.jwtKey, { expiresIn: "10m" });
        bot.vcc.topup_transaction_token = token;
        await bot.save();

        const quickReplies = [
            {
                content_type: "text",
                title: lang[selectedLanguage].PROCEED_TITLE,
                payload: "vcc_add_funds_ppl_confirm"
            },
            {
                content_type: "text",
                title: lang[selectedLanguage].ADJUST_AMOUNT_TITLE,
                payload: "vcc_add_funds_ppl_adjust"
            },
            {
                content_type: "text",
                title: "My MasterCard",
                payload: "vcc_menu"
            }
        ];

        await quickReply(data, message, quickReplies, "vcc_add_funds_ppl_confirm");
    }
    else if (payload === "vcc_add_funds_ppl_confirm" && bot?.last_message === "vcc_add_funds_ppl_confirm") {
        await handleOTPGeneration(selectedLanguage, senderId, "vcc_add_funds_ppl-otp", "vcc_add_funds_ppl-otp", "Transaction OTP");
    }
    else if (bot?.last_message === "vcc_add_funds_ppl-otp" && !payload && text) {
        const otpValidationResult = await validateOTP(senderId, text, "vcc_add_funds_ppl-otp");

        if (otpValidationResult.status) {
            // Decoding the token
            let decoded;
            try {
                decoded = jwt.verify(bot.vcc.topup_transaction_token, process.env.jwtKey);
            } catch (error) {
                // Transaction expiry message
                const quickReplies = [
                    { content_type: "text", title: "My MasterCard", payload: "vcc_menu" }
                ];
                return await quickReply(data, "Your transaction has been expired. Please try again.", quickReplies, "4");
            }

            const api = `${paypalUrl}/oauth2/token`;
            const tokenResponse = await axios.post(api, 'grant_type=client_credentials', {
                auth: {
                    username: process.env.PAYPAL_CLIENT_ID,
                    password: process.env.PAYPAL_SECRET
                }
            });

            const redirect_url_type = "vcc_topup";
            const ref = 'tr_' + Date.now().toString();
            const paypalAmount = decoded.converted_amount;
            const paypalCurrency = decoded.currencySupported ? decoded.original_currency : "USD";
            const paymentApi = `${paypalUrl}/payments/payment`;
            const paymentObj = {
                intent: "sale",
                payer: { payment_method: "paypal" },
                transactions: [{
                    amount: {
                        total: paypalAmount.toFixed(2),
                        currency: paypalCurrency
                    },
                    description: account?.username,
                    custom: decoded.cardId,
                    item_list: {
                        shipping_address: {
                            recipient_name: `${account?.first_name} ${account?.last_name}`,
                            line1: account?.address || account?.country_iso_code,
                            city: account?.city || "",
                            country_code: iso2Countries[account?.country_iso_code] || "CH",
                            postal_code: account?.postal_code || "",
                            phone: account?.phone || ""
                        }
                    }
                }],
                redirect_urls: {
                    return_url: `https://my.insta-pay.ch/chatbot/paypal-transaction/success/${ref}?flow=${redirect_url_type}&platform=instagram`,
                    cancel_url: `https://my.insta-pay.ch/chatbot/paypal-transaction/failed/${ref}?flow=${redirect_url_type}&platform=instagram`
                }
            };

            const resp1 = await axios.post(paymentApi, paymentObj, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + tokenResponse.data.access_token
                }
            });

            if (resp1.data.state !== 'created') {
                return await quickMessage(data, "Transaction failed during PayPal processing.");
            }

            const timezone = account?.timezone || "UTC";
            const currentTime = moment().tz(timezone).format();

            const vccTransaction = await VCCTransactionModel.create({
                cardNo: decoded.cardId,
                accountId: account._id,
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
                    type: "mastercard_topup_bot_instagram",
                    token: bot.vcc.topup_transaction_token
                }
            });

            const link = resp1.data.links.find(l => l.rel === 'approval_url');

            const title = lang[selectedLanguage].VERIFY_PAYPAL_ACCOUNT;
            const subtitle = `${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(decoded.converted_amount)} ${decoded.currencySupported ? decoded.original_currency : "USD"}`;

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
                                url: link.href,
                                webview_height_ratio: "full"
                            },
                            {
                                type: "postback",
                                title: lang[selectedLanguage].MAIN_MENU,
                                payload: "main_menu"
                            }
                        ]
                    }
                ]
            };

            await sendTemplate(data, senderId, templatePayload, "4");
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await quickMessage(data, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessage(data, "vcc_add_funds_ppl-otp", selectedLanguage, bot?.otpType);
            }
        }
    }
}

module.exports = { topupUsingPaypal }