const PanModel = require("../../../../models/Pan.model");
const VirtualCardModel = require("../../../../models/Virtual-Card.model");
const { validateCardExpiry, vccTopupFeeCalculation, fetchLocalOrDefaultWalletConditionally } = require("../../../helpers");
const lang = require("../../../languages/languages.json")
const { formattedAmount } = require("../../../InstaChatbotHelpers");
const { quickMessage, quickReply, sendTemplate, somethingWentWrongQuickReply, validateAmount } = require("../../../instaChatbotUtils")
const jwt = require("jsonwebtoken");
const { handleOTPGeneration, validateOTP, invalidMessage } = require("../../../instaChatbotOTP");
const CryptoJS = require("crypto-js");
const moment = require('moment-timezone');
const VCCTransactionModel = require("../../../../models/VCC-Transaction.model");
const { generatePayload } = require("../../../../controllers/Trust-Payment.controller");


async function topupUsingCard(senderId, payload, account, bot, text, selectedLanguage) {
    const data = {
        sender: {
            id: senderId
        }
    }
    if (payload === "vcc_add_funds_card" && bot?.last_message === "vcc_add_funds_channel") {
        const pans = await PanModel.find({ account: account._id });
        console.log(pans);

        let quickReplies = [];

        if (pans.length !== 0) {
            for (let i = 0; i < pans.length; i++) {
                quickReplies.push({
                    content_type: "text",
                    title: `💳 *******${pans[i].last4}`,
                    payload: `vcc_add_funds_card-${pans[i]._id}`
                });
            }

            quickReplies.push({
                content_type: "text",
                title: lang[selectedLanguage].CHANGE_PAYMENT_METHOD,
                payload: "vcc_add_funds_methods"
            });

            quickReplies.push({
                content_type: "text",
                title: `☰ ${lang[selectedLanguage].MAIN_MENU}`,
                payload: "main_menu"
            });

            await quickReply(data, lang[selectedLanguage].SELECT_YOUR_TOPUP_CHANNEL, quickReplies, "vcc_add_funds_card");
        } else {
            quickReplies.push({
                content_type: "text",
                title: `☰ ${lang[selectedLanguage].MAIN_MENU}`,
                payload: "main_menu"
            });
            await quickReply(data, lang[selectedLanguage].NO_CARD_SAVED, quickReplies);
        }
    }

    // user has selected a card from the list
    else if (payload?.includes("vcc_add_funds_card-") && bot?.last_message === "vcc_add_funds_card") {
        const cardId = payload.split("-")[1];
        const expiryValidation = await validateCardExpiry(cardId);

        if (!expiryValidation.status) {
            const pans = await PanModel.find({ account: account._id });
            const message = "The card you selected has expired and is now removed from your InstaPay account.\n\n" +
                "To continue with this transaction, please choose an alternative payment method.";

            let quickReplies = [];
            if (pans.length !== 0) {
                quickReplies = [
                    {
                        content_type: "text",
                        title: lang[selectedLanguage].PAYMENT_CARD,
                        payload: "vcc_add_funds_card"
                    },
                    {
                        content_type: "text",
                        title: lang[selectedLanguage].INSTAPAY_WALLETS,
                        payload: "vcc_add_funds_ip"
                    },
                    {
                        content_type: "text",
                        title: lang[selectedLanguage].PAYPAL,
                        payload: "vcc_add_funds"
                    },
                    {
                        content_type: "text",
                        title: lang[selectedLanguage].MAIN_MENU,
                        payload: "main_menu"
                    }
                ];
            } else {
                quickReplies = [
                    {
                        content_type: "text",
                        title: lang[selectedLanguage].INSTAPAY_WALLETS,
                        payload: "vcc_add_funds_ip"
                    },
                    {
                        content_type: "text",
                        title: lang[selectedLanguage].PAYPAL,
                        payload: "vcc_add_funds"
                    },
                    {
                        content_type: "text",
                        title: lang[selectedLanguage].ADD_PAYMENT_CARD,
                        payload: "add_payment_card-vcc_add_funds_methods"
                    },
                    {
                        content_type: "text",
                        title: lang[selectedLanguage].MAIN_MENU,
                        payload: "main_menu"
                    }
                ];
            }

            return await quickReply(data, message, quickReplies, "vcc_add_funds_channel");
        }

        bot.vcc.pan = cardId;
        const cardDetails = await VirtualCardModel.findById(bot.vcc.card);

        // Fetch fee and markup in VCC's currency (no exchange rate needed)
        const { fee, feeType } = await vccTopupFeeCalculation(
            cardDetails.currency,
            account.level._id,
            bot.vcc.amount,
            `topup_card_payment_vcc_${cardDetails.type?.includes("premium") ? "premium" : "standard"}_${cardDetails.subscription_type}`
        );

        if (!fee) {
            return await quickMessage(data, "Something went wrong. Please try again. If the problem persists, contact our support team.");
        }

        // Check if the entered amount is lower than the top-up fee
        const minRequiredAmount = fee + fee * 0.1; // Top-up fee + 10%
        if (bot.vcc.amount < minRequiredAmount) {
            return await quickMessage(
                data,
                `The amount entered is too low. The minimum amount required for a top-up is ${formattedAmount(minRequiredAmount)} ${cardDetails.currency}. Please enter a higher amount.`,
                "vcc_add_funds_card_min_amount"
            );
        }

        const message = `
Amount to Topup: ${formattedAmount(bot.vcc.amount)} ${cardDetails.currency}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${cardDetails.currency}
You'll get: ${formattedAmount(bot.vcc.amount - fee)} ${cardDetails.currency}
`.trim();

        const dataPayload = {
            amount: bot.vcc.amount,
            fee,
            cardId: cardDetails.card_id,
            feeType,
            currency: cardDetails.currency,
        };

        const token = jwt.sign(dataPayload, process.env.jwtKey, { expiresIn: "10m" });
        bot.vcc.topup_transaction_token = token;
        await bot.save();

        const quickReplies = [
            {
                content_type: "text",
                title: lang[selectedLanguage].PROCEED_TITLE,
                payload: "vcc_add_funds_card_confirm"
            },
            {
                content_type: "text",
                title: lang[selectedLanguage].ADJUST_AMOUNT_TITLE,
                payload: "vcc_add_funds_card_adjust"
            },
            {
                content_type: "text",
                title: "My MasterCard",
                payload: "vcc_menu"
            }
        ];

        await quickReply(data, message, quickReplies, "vcc_add_funds_card_confirm");
    }

    // user has selected to adjust the amount
    else if (payload === "vcc_add_funds_card_adjust") {
        const data = {
            sender: {
                id: senderId
            }
        };
        await quickMessage(data, lang[selectedLanguage].ENTER_AMOUNT_TOPUP, "vcc_add_funds_card_min_amount");
    }

    // user is entering the adjusted amount
    else if (bot?.last_message === "vcc_add_funds_card_min_amount" && !payload && text) {
        const { status, message: amountValidationMessage, amount } = validateAmount(text, selectedLanguage);

        if (!status) {
            await quickMessage(data, amountValidationMessage);
            return;
        }

        bot.vcc.amount = amount;
        await bot.save();

        const cardDetails = await VirtualCardModel.findById(bot.vcc.card);

        // Fetch fee and markup in VCC's currency
        const { fee, feeType } = await vccTopupFeeCalculation(
            cardDetails.currency,
            account.level._id,
            amount,
            `topup_card_payment_vcc_${cardDetails.type?.includes("premium") ? "premium" : "standard"}_${cardDetails.subscription_type}`
        );

        if (!fee) {
            return await somethingWentWrongQuickReply(data, "Something went wrong. Please try again. If the problem persists, contact our support team.");
        }

        // Check minimum amount requirement
        const minRequiredAmount = fee + fee * 0.1;
        if (amount < minRequiredAmount) {
            const message = `The amount entered is too low. The minimum amount required for a top-up is ${formattedAmount(minRequiredAmount)} ${cardDetails.currency}. Please enter a higher amount.`;
            await quickMessage(data, message, "vcc_add_funds_card_min_amount");
            return;
        }

        const message = `
Amount to Topup: ${formattedAmount(amount)} ${cardDetails.currency}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${cardDetails.currency}
You'll get: ${formattedAmount(amount - fee)} ${cardDetails.currency}
`.trim();

        const dataPayload = {
            amount: amount,
            fee,
            cardId: cardDetails.card_id,
            feeType,
            currency: cardDetails.currency,
        };

        const token = jwt.sign(dataPayload, process.env.jwtKey, { expiresIn: "10m" });
        bot.vcc.topup_transaction_token = token;
        await bot.save();

        const quickReplies = [
            {
                content_type: "text",
                title: lang[selectedLanguage].PROCEED_TITLE,
                payload: "vcc_add_funds_card_confirm"
            },
            {
                content_type: "text",
                title: lang[selectedLanguage].ADJUST_AMOUNT_TITLE,
                payload: "vcc_add_funds_card_adjust"
            },
            {
                content_type: "text",
                title: "My MasterCard",
                payload: "vcc_menu"
            }
        ];

        await quickReply(data, message, quickReplies, "vcc_add_funds_card_confirm");
    }

    // user confirms the top-up
    else if (payload === "vcc_add_funds_card_confirm") {
        await handleOTPGeneration(selectedLanguage, senderId, "vcc_add_funds_card-otp", "vcc_add_funds_card-otp", "Transaction OTP");
    }

    else if (bot?.last_message === "vcc_add_funds_card-otp" && !payload && text) {
        const otpValidationResult = await validateOTP(senderId, text, "vcc_add_funds_card-otp");

        if (otpValidationResult.status) {
            // decoding the token
            let decoded;
            try {
                decoded = jwt.verify(bot.vcc.topup_transaction_token, process.env.jwtKey);
            } catch (error) {
                // transaction expiry message
                const quickReplies = [
                    { content_type: "text", title: "My MasterCard", payload: "vcc_menu" }
                ];
                return await quickReply(data, "Your transaction has been expired. Please try again.", quickReplies, "4");
            }

            let panDetails = await PanModel.findOne({ $and: [{ _id: bot.vcc.pan }, { account: account._id }] });
            if (!panDetails) {
                return await somethingWentWrongQuickReply(data, "Invalid Card Details.");
            }

            let bytes = CryptoJS.AES.decrypt(panDetails.panData, process.env.PAN_ENCRYPTION_KEY);
            let panDataObj = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

            const timezone = account?.timezone || "UTC";
            const currentTime = moment().tz(timezone).format();

            const vccTransaction = await VCCTransactionModel.create({
                cardNo: decoded.cardId,
                accountId: account._id,
                transactionId: 'tr_' + Date.now().toString(),
                billAmount: decoded.amount,
                txAmount: decoded.amount,
                currency: decoded.currency,
                fee: decoded.fee,
                status: 'INITIATED',
                merchantName: 'Card Top-Up By Card',
                merchantCategory: "topup_by_card",
                transaction_type: 'mastercard_topup',
                type: "credit",
                timeline: [
                    {
                        date: currentTime,
                        status: "INITIATED",
                    }
                ],
            });

            const iat = Math.floor(Date.now() / 1000);
            const defaultWallet = await fetchLocalOrDefaultWalletConditionally(account._id);
            const payload = generatePayload(decoded.amount, defaultWallet, panDataObj, vccTransaction, iat, true, false, "instagram");
            console.log({ payload });

            const token = jwt.sign(payload, process.env.TRUST_PAYMENT_SECRET, { algorithm: 'HS256' });

            const title = lang[selectedLanguage].VERIFY_CARD;
            const subtitle = `
    ${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(parseFloat(decoded.amount))} ${decoded.currency}
            `;

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
                                url: `https://my.insta-pay.ch/chatbot/pan-transaction?token=${token}&transaction_id=${vccTransaction._id}&reference_id=${vccTransaction.transactionId}&intl_token=${bot.vcc.topup_transaction_token}&slug=confirm-chatbot-vcc-topup-instagram`,
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

            await sendTemplate(data, senderId, templatePayload, "4");

        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await quickMessage(data, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {
                await invalidMessage(data, "vcc_add_funds_card-otp", selectedLanguage, bot?.otpType);
            }
        }
    }
}

module.exports = { topupUsingCard }