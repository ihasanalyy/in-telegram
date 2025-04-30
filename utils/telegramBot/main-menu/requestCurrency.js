const Wallet = require("../../../models/Wallet.model");
const { availableCurrencies, requestCurrency } = require("../../InstaChatbotHelpers");
const { sendButtons, sendMessage, sendPhoto } = require("../../telegramBotUtils")
const lang = require("../../../utils/languages/languages.json");
async function currencyRequest(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    if (payload === "add_currency") {
        const currencies = await availableCurrencies();
        if (currencies?.length === 0) {
            return await sendButtons(chatId, lang[selectedLanguage].NO_CURRENCY, [
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ]);
        }

        const wallets = await Wallet.find({ account: chat.account._id, wallet_type: 'insta', status: "active" });
        const availableCurrenciesUser = currencies.filter(currency => !wallets.some(wallet => wallet.currency.code === currency.code));
        const buttons = availableCurrenciesUser.map(currency => [{ text: currency.code, callback_data: `add_currency_request-${currency.code}` }]);
        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);

        await sendButtons(chatId, lang[selectedLanguage].SELECT_CURRENCY, buttons, "add_currency");
    }

    else if (payload?.startsWith("add_currency_request-") && chat.last_message === "add_currency") {
        const currency = payload.split('-')[1];
        chat.wallet_to_wallet.requested_currency = currency;
        await chat.save();
        await sendMessage(chatId, `${lang[selectedLanguage].REQUEST_REASON_PART1} ${currency} ${lang[selectedLanguage].CURRENCY}`, "add_currency-message");
    }

    else if (chat.last_message === "add_currency-message" && text && !payload) {
        chat.currency_description = text;
        await chat.save();

        await sendButtons(chatId, lang[selectedLanguage].CONFIRM_REQUEST_CURRENCY, [
            [{ text: lang[selectedLanguage].YES, callback_data: "add_currency_request_yes" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "wallet_overview" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ]);
    }

    else if (payload === "add_currency_request_yes") {
        const { status, message, savedRequestedCurrency } = await requestCurrency(chat.account, chat?.wallet_to_wallet.requested_currency, chat.account.country);

        if (status) {
            return await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Explore%20More.png", `Your ${savedRequestedCurrency?.code} currency request has been accepted.`, "4");
        }

        let newMessage;
        if (message.includes("already been requested")) newMessage = lang[selectedLanguage].ALREADY_REQUESTED;
        else if (message.includes("has been requested!")) newMessage = `${lang[selectedLanguage].YOUR} ${savedRequestedCurrency?.code} ${lang[selectedLanguage].SUCCESS_REQUESTED}`;
        else if (message.includes("available")) newMessage = lang[selectedLanguage].NOT_AVAILABLE;
        else if (message.includes("pending")) newMessage = lang[selectedLanguage].PENDING_REQUEST;
        else if (message.includes("already accepted!")) newMessage = lang[selectedLanguage].ACCEPTED_REQUEST;
        else if (message.includes("declined")) newMessage = lang[selectedLanguage].DECLINED_BY_ADMIN;
        else newMessage = message;

        await sendButtons(chatId, newMessage, [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]], "4");
    }

}

module.exports = { currencyRequest }