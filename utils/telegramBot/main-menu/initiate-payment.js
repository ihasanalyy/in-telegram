const { sendButtons, sendPhoto } = require("../../telegramBotUtils");
const lang = require("../../../utils/languages/languages.json");
async function initiatePayment(chatId, payload, chat, text, selectedLanguage, isInitiatePayment) {
    if (payload === "initiate_payment" || isInitiatePayment) {
        const buttons = [
            [{ text: lang[selectedLanguage].SEND_MONEY_BUTTON_TITLE, callback_data: "initiate_payment_send_money" }],
            [{ text: lang[selectedLanguage].REQUEST_MONEY_BUTTON_TITLE, callback_data: "req_pay" }],
            [{ text: lang[selectedLanguage].SEND_QUOTE_BUTTON_TITLE, callback_data: "quotation" }],
            [{ text: lang[selectedLanguage].SEND_CRYPTO_BUTTON_TITLE, callback_data: "initiate_payment_send_crypto" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ]

        await sendButtons(chatId, lang[selectedLanguage].HOW_CAN_I_SERVE, buttons);
    } else if (payload === "initiate_payment_send_money") {
        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Instant.png", lang[selectedLanguage].SEND_MONEY_TITLE)
        await sendButtons(chatId, lang[selectedLanguage].SEND_MONEY_SUBTITLE, [
            [{ text: lang[selectedLanguage].CONTINUE, callback_data: "initiate_payment_sm_continue" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ]);
    }
    else if (payload === "initiate_payment_sm_continue") {
        const buttons = [
            [{ text: lang[selectedLanguage].INTL_TRANSFER_BUTTON_TITLE, callback_data: "intl_transfer" }],
            [{ text: lang[selectedLanguage].WALLET_TO_WALLET_BUTTON_TITLE, callback_data: "w2w" }],
            [{ text: lang[selectedLanguage].MOBILE_AIRTIME_BUTTON_TITLE, callback_data: "airtime" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ]

        await sendButtons(chatId, "Please choose your preferred payment method.", buttons);
    }
}

module.exports = { initiatePayment }