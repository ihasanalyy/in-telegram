const { sendButtons, sendPhoto, getFileFromTelegram, verifyQrCodeTelegram, sendMessage, somethingWentWrongQuickReplyTelegram } = require("../../telegramBotUtils");
const lang = require("../../../utils/languages/languages.json");
const currencyToEmoji = require('../../../utils/currencyEmojis.json');

const { getUserActiveWallets, getActiveWalletById, fetchLocalOrDefaultWalletConditionally, getExchangeRatesToUSD, getTopupLimitMessage, validateCardExpiry } = require("../../helpers");
const { formattedAmount } = require("../../InstaChatbotHelpers");
const PanModel = require("../../../models/Pan.model");
const { usersFeatureMessage, userLimitsMessage, validateAmount } = require("../../instaChatbotUtils");
const { checkTransactionLimitsForSender } = require("../../conversion");
const jwt = require("jsonwebtoken");
const { formatDecimalNumbersWithLimit } = require("../../payerRates");
const { initiateTopup } = require("../../chatbot/addFunds");

async function w2wAddFunds(chatId, payload, chat, text, selectedLanguage) {
    if (payload === "w_add_funds") {
        const pans = await PanModel.find({ account: chat.account._id });
        console.log(pans);

        let buttons = [];

        if (pans.length !== 0) {
            for (let i = 0; i < pans.length; i++) {
                buttons.push([{ text: `💳 *******${pans[i].last4}`, callback_data: `w_add_funds_card-${pans[i]._id}` }]);
            }
        }

        buttons.push([{ text: `🇵 ${lang[selectedLanguage].PAYPAL}`, callback_data: "w_add_funds_paypal" }]);
        buttons.push([{ text: `🇬 ${lang[selectedLanguage].GOOGLE_PAY}`, callback_data: "w_add_funds_google" }]);
        buttons.push([{ text: `🇦 ${lang[selectedLanguage].APPLE_PAY}`, callback_data: "w_add_funds_apple" }]);
        buttons.push([{ text: lang[selectedLanguage].OTHER_PAYMENT_METHOD, callback_data: "w_add_funds_other_methods" }]);
        buttons.push([{ text: `☰ ${lang[selectedLanguage].MAIN_MENU}`, callback_data: "main_menu" }]);

        console.log(buttons);

        await sendButtons(chatId, lang[selectedLanguage].SELECT_YOUR_TOPUP_CHANNEL, buttons, "w_add_funds");
    }

    // User has selected PayPal, Google Pay, or Apple Pay
    else if (["w_add_funds_paypal", "w_add_funds_google", "w_add_funds_apple"].includes(payload)) {
        const buttons = [
            [{ text: lang[selectedLanguage].CHANGE_METHOD, callback_data: "w_add_funds" }],
            [{ text: `☰ ${lang[selectedLanguage].MAIN_MENU}`, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].PAYOUT_CHANNEL_UNAVAILABLE, buttons);
    }

    // User has selected other methods
    else if (payload === "w_add_funds_other_methods") {
        await sendMessage(chatId, lang[selectedLanguage].ADD_FUNDS_STEPS);

        const buttons = [
            [{ text: lang[selectedLanguage].LOGIN, url: "https://my.insta-pay.ch/login" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].CLICK_TO_LOG_IN, buttons);
    }

    // User has selected top-up channel
    else if (payload?.startsWith("w_add_funds_card-")) {
        const cardId = payload.split("-")[1];

        //  Validate card expiry using
        const expiryValidation = await validateCardExpiry(cardId);

        if (!expiryValidation.status) {
            // Handle expired or invalid card
            const pans = await PanModel.find({ account: chat.account._id });

            let buttons = [];

            if (pans.length !== 0) {
                for (let i = 0; i < pans.length; i++) {
                    buttons.push([{ text: `💳 *******${pans[i].last4}`, callback_data: `w_add_funds_card-${pans[i]._id}` }]);
                }
            }

            buttons.push([{ text: `🇵 ${lang[selectedLanguage].PAYPAL}`, callback_data: "w_add_funds_paypal" }]);
            buttons.push([{ text: `🇬 ${lang[selectedLanguage].GOOGLE_PAY}`, callback_data: "w_add_funds_google" }]);
            buttons.push([{ text: `🇦 ${lang[selectedLanguage].APPLE_PAY}`, callback_data: "w_add_funds_apple" }]);
            buttons.push([{ text: lang[selectedLanguage].OTHER_PAYMENT_METHOD, callback_data: "w_add_funds_other_methods" }]);
            buttons.push([{ text: `☰ ${lang[selectedLanguage].MAIN_MENU}`, callback_data: "main_menu" }]);

            console.log(buttons);


            await sendButtons(
                chatId,
                "The card you selected has expired and is now removed from your InstaPay account.\n\n" +
                "To continue with this transaction, please choose an alternative payment method.",
                buttons,
                "w_add_funds"
            );
            return;
        }

        chat.topup.pan = cardId;
        await chat.save();

        const wallets = await getUserActiveWallets(chat.account._id);
        const slicedWallets = wallets.slice(0, 8);

        let buttons = slicedWallets.map((wallet) => {
            return [
                {
                    text: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`,
                    callback_data: `w_add_funds_card_wallet-${wallet._id}`,
                },
            ];
        });

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]);

        const message = lang[selectedLanguage].SELECT_WALLET_CURRENCY;
        await sendButtons(chatId, message, buttons);
    }

    // User has selected wallet
    else if (payload?.includes("w_add_funds_card_wallet")) {
        const walletId = payload.split("-")[1];
        chat.topup.wallet = walletId;
        await chat.save();

        const message = lang[selectedLanguage].ENTER_AMOUNT_TOPUP;
        await sendMessage(chatId, message, "w_add_funds_card_amount");

    }

    // User has entered amount
    else if (chat?.last_message === "w_add_funds_card_amount" && text) {
        const validation = validateAmount(text, selectedLanguage);
        if (!validation.status) {
            await sendMessage(chatId, validation.message);
            return;
        }

        const amount = validation.amount;
        chat.topup.amount = amount;
        await chat.save();

        const panDetails = await PanModel.findById(chat.topup.pan);
        const card = panDetails.last4;
        const walletDetails = await getActiveWalletById(chat.topup.wallet);

        const initiateTopupDetails = await initiateTopup({
            wallet_id: walletDetails._id,
            amount: parseFloat(amount) * 100,
            pan: panDetails._id,
            platform: "telegram"
        });

        if (initiateTopupDetails.status) {
            const title = lang[selectedLanguage].VERIFY_CARD;
            const subtitle = `
${lang[selectedLanguage].CARD}: *******${card}
${lang[selectedLanguage].AMOUNT}: ${formatDecimalNumbersWithLimit(formattedAmount(amount))} ${walletDetails.currency.code}
                `;

            await sendButtons(chatId, `${title}\n${subtitle}`, [
                [{ text: lang[selectedLanguage].VERIFY, url: `https://my.insta-pay.ch/chatbot/pan-transaction?token=${initiateTopupDetails?.token}&transaction_id=${initiateTopupDetails?.transaction_id}&reference_id=${initiateTopupDetails.reference_id}&slug=confirm-chatbot-pan-topup` }],
                [{ text: lang[selectedLanguage].MODIFY_DETAILS, callback_data: "add_funds" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ]);
        } else {
            if (initiateTopupDetails?.message === "ble400") {
                await sendButtons(chatId, lang[selectedLanguage].EXCEED_BALANCE_LIMIT_TRANS, [
                    [{ text: `☰ ${lang[selectedLanguage].MAIN_MENU}`, callback_data: "main_menu" }]
                ]);
            } else if (["tpl400", "rdl400", "rml400", "ryl400", "tal400"].includes(initiateTopupDetails?.message?.code)) {
                const topUpValues = await getTopupLimitMessage(initiateTopupDetails?.message?.code, walletDetails.currency.code, chat.account);
                let message;
                if (initiateTopupDetails?.message?.code === "tpl400") {
                    message = lang[selectedLanguage].TOPUP_LIMIT_EXCEEDED
                        .replace('{{min_amount}}', formattedAmount(topUpValues.value.min))
                        .replace('{{max_amount}}', formattedAmount(topUpValues.value.max))
                        .replace(/{{currencyCode}}/g, walletDetails.currency.code);
                } else if (initiateTopupDetails?.message?.code === "tal400") {
                    message = lang[selectedLanguage].TRANSACTION_AMOUNT_LIMIT_EXCEEDED
                        .replace('{{amount}}', formattedAmount(topUpValues.value))
                        .replace(/{{currency}}/g, walletDetails.currency.code);
                } else if (initiateTopupDetails?.message?.code === "rdl400") {
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
                await sendButtons(chatId, message, [
                    [{ text: `☰ ${lang[selectedLanguage].MAIN_MENU}`, callback_data: "main_menu" }]
                ]);
            } else {
                await sendButtons(chatId, lang[selectedLanguage].TRANSACTION_ERROR_MESSAGE, [
                    [{ text: `☰ ${lang[selectedLanguage].MAIN_MENU}`, callback_data: "main_menu" }]
                ]);
            }
        }
    }



}

module.exports = { w2wAddFunds }