const { fetchLocalOrDefaultWalletConditionally, validateCardExpiry, vccTopupFeeCalculation, getExchangeRatesToUSD } = require("../../../helpers");
const { somethingWentWrongQuickReplyTelegram, sendButtons, sendMessage } = require("../../../telegramBotUtils");
const lang = require("../../../languages/languages.json");
const PanModel = require("../../../../models/Pan.model");
const { validateAmount } = require("../../../instaChatbotUtils");
const CryptoJS = require("crypto-js");
const VirtualCardModel = require("../../../../models/Virtual-Card.model");
const { formatDecimalNumbersWithLimit } = require("../../../payerRates");
const { formattedAmount } = require("../../../InstaChatbotHelpers");
const jwt = require("jsonwebtoken");
const { initiateTopUpSavedCard } = require("../../../chatbot/intl/intlTransferUsingCard");
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../../telegramOTPHandler");
const VCCTransactionModel = require("../../../../models/VCC-Transaction.model");
const { generatePayload } = require("../../../../controllers/Trust-Payment.controller");
const moment = require('moment-timezone');

async function topupUsingCard(chatId, payload, chat, text, selectedLanguage) {
    if (payload === "vcc_add_funds_card" && chat?.last_message === "vcc_add_funds_channel") {
        const pans = await PanModel.find({ account: chat.account._id });
        console.log(pans);

        let buttons = [];

        if (pans.length !== 0) {
            for (let i = 0; i < pans.length; i++) {
                buttons.push([
                    {
                        text: `💳 *******${pans[i].last4}`,
                        callback_data: `vcc_add_funds_card-${pans[i]._id}`,
                    },
                ]);
            }

            buttons.push([{ text: lang[selectedLanguage].CHANGE_PAYMENT_METHOD, callback_data: "vcc_add_funds_methods" }]);
            buttons.push([{ text: `☰ ${lang[selectedLanguage].MAIN_MENU}`, callback_data: "main_menu" }]);

            await sendButtons(chatId, lang[selectedLanguage].SELECT_YOUR_TOPUP_CHANNEL, buttons, "vcc_add_funds_card");
        } else {
            buttons.push([{ text: `☰ ${lang[selectedLanguage].MAIN_MENU}`, callback_data: "main_menu" }]);
            await sendButtons(chatId, lang[selectedLanguage].NO_CARD_SAVED, buttons);
        }
    }

    // user has selected a card from the list
    else if (payload?.includes("vcc_add_funds_card-") && chat?.last_message === "vcc_add_funds_card") {
        const cardId = payload.split("-")[1];
        const expiryValidation = await validateCardExpiry(cardId);
        if (!expiryValidation.status) {
            const pans = await PanModel.find({ account: chat.account._id });
            const message = lang[selectedLanguage].SELECTED_CARD_EXPIRED;

            let buttons;
            if (pans.length !== 0) {
                buttons = [
                    [{ text: lang[selectedLanguage].PAYMENT_CARD, callback_data: "vcc_add_funds_card" }],
                    [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "vcc_add_funds_ip" }],
                    [{ text: lang[selectedLanguage].PAYPAL, callback_data: "vcc_add_funds" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                ];
            } else {
                buttons = [
                    [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "vcc_add_funds_ip" }],
                    [{ text: lang[selectedLanguage].PAYPAL, callback_data: "vcc_add_funds" }],
                    [{ text: lang[selectedLanguage].ADD_PAYMENT_CARD, callback_data: "add_payment_card-vcc_add_funds_methods" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                ];
            }

            return await sendButtons(chatId, message, buttons, "vcc_add_funds_channel");
        }

        chat.vcc.pan = cardId;
        const cardDetails = await VirtualCardModel.findById(chat.vcc.card);

        // Fetch fee and markup in VCC's currency (no exchange rate needed)
        const { fee, feeType } = await vccTopupFeeCalculation(
            cardDetails.currency,
            chat.account.level._id,
            chat.vcc.amount,
            `topup_card_payment_vcc_${cardDetails.type?.includes("premium") ? "premium" : "standard"}_${cardDetails.subscription_type}`
        );

        if (!fee) {
            return await sendMessage(chatId, lang[selectedLanguage].SOMETHING_WENT_WRONG);
        }

        // Check if the entered amount is lower than the top-up fee
        const minRequiredAmount = fee + fee * 0.1; // Top-up fee + 10%
        const minimumAmount = formattedAmount(minRequiredAmount);
        if (chat.vcc.amount < minRequiredAmount) {
            return await sendMessage(
                chatId,
                lang[selectedLanguage].MIN_AMOUNT_LOW.replace("{{minimumAmount}}", minimumAmount).replace("{{currency}}", cardDetails.currency), //Hassan
                "vcc_add_funds_card_min_amount"
            );
        }

        const message = `
Amount to Topup: ${formattedAmount(chat.vcc.amount)} ${cardDetails.currency}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${cardDetails.currency}
You'll get: ${formattedAmount(chat.vcc.amount - fee)} ${cardDetails.currency}
`.trim();

        const dataPayload = {
            amount: chat.vcc.amount,
            fee,
            cardId: cardDetails.card_id,
            feeType,
            currency: cardDetails.currency,
        };

        const token = jwt.sign(dataPayload, process.env.jwtKey, { expiresIn: "10m" });
        chat.vcc.topup_transaction_token = token;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].PROCEED_TITLE, callback_data: "vcc_add_funds_card_confirm" }],
            [{ text: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, callback_data: "vcc_add_funds_adjust" }],
            [{ text: lang[selectedLanguage].MY_MASTERCARD, callback_data: "vcc_menu" }],
        ];

        await sendButtons(chatId, message, buttons, "vcc_add_funds_card_confirm");
    }

    // user has selected to adjust the amount
    else if (payload === "vcc_add_funds_adjust" && chat?.last_message === "vcc_add_funds_card_confirm") {
        await sendMessage(chatId, lang[selectedLanguage].ENTER_AMOUNT_TOPUP, "vcc_add_funds_card_min_amount");
    }

    // user is entering the adjusted amount
    else if (chat.last_message === "vcc_add_funds_card_min_amount" && text && !payload) {
        const { status, message: amountValidationMessage, amount } = validateAmount(text, selectedLanguage);

        if (!status) {
            await sendMessage(chatId, amountValidationMessage);
            return;
        }

        chat.vcc.amount = amount;
        await chat.save();

        const cardDetails = await VirtualCardModel.findById(chat.vcc.card);

        // Fetch fee and markup in VCC's currency (no exchange rate needed)
        const { fee, feeType } = await vccTopupFeeCalculation(
            cardDetails.currency,
            chat.account.level._id,
            amount,
            `topup_card_payment_vcc_${cardDetails.type?.includes("premium") ? "premium" : "standard"}_${cardDetails.subscription_type}`
        );

        if (!fee) {
            return await sendMessage(chatId, lang[selectedLanguage].SOMETHING_WENT_WRONG);
        }

        // Check if the entered amount is lower than the top-up fee
        const minRequiredAmount = fee + fee * 0.1; // Top-up fee + 10%
        const minimumAmount = formattedAmount(minRequiredAmount);
        if (amount < minRequiredAmount) {
            return await sendMessage(
                chatId,
                lang[selectedLanguage].MIN_AMOUNT_LOW.replace("{{minimumAmount}}", minimumAmount).replace("{{currency}}", cardDetails.currency), //Hassan
                "vcc_add_funds_card_min_amount"
            );
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
        chat.vcc.topup_transaction_token = token;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].PROCEED_TITLE, callback_data: "vcc_add_funds_card_confirm" }],
            [{ text: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, callback_data: "vcc_add_funds_adjust" }],
            [{ text: lang[selectedLanguage].MY_MASTERCARD, callback_data: "vcc_menu" }],
        ];

        await sendButtons(chatId, message, buttons, "vcc_add_funds_card_confirm");

    }

    else if (payload === "vcc_add_funds_card_confirm" && chat?.last_message === "vcc_add_funds_card_confirm") {
        await handleOTPGenerationTG(selectedLanguage, chat, "vcc_add_funds_card-otp", "vcc_add_funds_card-otp", "Transaction OTP");
    }

    else if (chat.last_message === "vcc_add_funds_card-otp" && text && !payload) {
        const otpValidationResult = await validateOTPTG(chatId, text, "vcc_add_funds_card-otp");

        if (otpValidationResult.status) {
            // decodeding the token
            let decoded
            try {
                decoded = jwt.verify(chat.vcc.topup_transaction_token, process.env.jwtKey);
            } catch (error) {
                // transaction expiry message
                return await sendButtons(chatId, lang[selectedLanguage].TRANSACTION_EXPIRED, [[{ text:lang[selectedLanguage].MY_MASTERCARD, callback_data: "vcc_menu" }]], "4");

            }

            let panDetails = await PanModel.findOne({ $and: [{ _id: chat.vcc.pan }, { account: chat.account._id }] });
            if (!panDetails) {
                return { status: false, message: "Invalid Card Details." };
            }

            let bytes = CryptoJS.AES.decrypt(panDetails.panData, process.env.PAN_ENCRYPTION_KEY);
            let panDataObj = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

            const timezone = chat.account?.timezone || "UTC"
            const currentTime = moment().tz(timezone).format();

            const vccTransaction = await VCCTransactionModel.create({
                cardNo: decoded.cardId,
                accountId: chat.account._id,
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
            const defaultWallet = await fetchLocalOrDefaultWalletConditionally(chat.account._id)
            const payload = generatePayload(decoded.amount, defaultWallet, panDataObj, vccTransaction, iat, true, false, "telegram");
            console.log({ payload })

            const token = jwt.sign(payload, process.env.TRUST_PAYMENT_SECRET, { algorithm: 'HS256' });

            const title = lang[selectedLanguage].VERIFY_CARD;
            const subtitle = `
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(parseFloat(decoded.amount))} ${decoded.currency}
            `;

            const buttons = [
                [
                    {
                        text: lang[selectedLanguage].VERIFY,
                        url: `https://my.insta-pay.ch/chatbot/pan-transaction?token=${token}&transaction_id=${vccTransaction._id}&reference_id=${vccTransaction.transactionId}&intl_token=${chat.vcc.topup_transaction_token}&slug=confirm-chatbot-vcc-topup-telegram`
                    }
                ],
                [
                    { text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }
                ]
            ];

            await sendButtons(chatId, `${title}\n${subtitle}`, buttons, "4");

        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {
                await invalidMessageTG(chatId, "vcc_add_funds_card-otp", selectedLanguage, chat?.otpType);
            }
        }
    }
}

module.exports = { topupUsingCard }