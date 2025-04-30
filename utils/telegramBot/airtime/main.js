const { sendButtons, sendMessage, handleCountrySelection, invalidInputResponse, sendPhoto } = require("../../telegramBotUtils");
const lang = require("../../../utils/languages/languages.json");
const { getAvailableCountries, fetchCountriesFromThunes, getPayoutChannelName, searchUsersAndWallets, getDistinctObjects } = require("../../instaChatbotUtils");
const { getCountries, getPayerNames, numberVerificationAirtime } = require("../../InstaChatbotHelpers");
const countries = require('../../../utils/countryIso.json');
const countryToEmoji = require('../../../utils/countryEmojis.json');
const PanModel = require("../../../models/Pan.model");
const currencyToEmoji = require('../../../utils/currencyEmojis.json');
const { airtimeIPWallet } = require("./airtimeUsingIPWallet");
const { airtimePaypal } = require("./airtimeUsingPaypal");
const { airtimeCard } = require("./airtimeUsingCard");

async function initiateAirtime(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    if (payload === "airtime") {
        await sendMessage(chatId, lang[selectedLanguage].TOP_UP_PROMPT, "airtime");
    }

    // User has entered the phone number
    else if (text && chat.last_message === "airtime") {
        const numberDetails = await numberVerificationAirtime(text);
        console.log(numberDetails.message, "numberDetails");

        if (numberDetails.status) {
            if (numberDetails.message?.length !== 0) {
                chat.airtime.operator_id = numberDetails.message[0]?.id;
                chat.airtime.country_code = numberDetails.message[0]?.country?.iso_code;
                chat.airtime.country = numberDetails.message[0]?.country?.name;
                chat.airtime.operator = numberDetails.message[0]?.name ?? "N/A";
                chat.airtime.phone_number = text;
                await chat.save();

                const message = `
${lang[selectedLanguage].CONFIRM_NUMBER_DETAILS}
        
${lang[selectedLanguage].COUNTRY_LABEL}: ${numberDetails.message[0]?.country?.name ?? "N/A"}
${lang[selectedLanguage].OPERATOR}: ${numberDetails.message[0]?.name ?? "N/A"}
${lang[selectedLanguage].PHONE}: ${text}
                `;

                const buttons = [
                    [{ text: lang[selectedLanguage].CONFIRM_TITLE, callback_data: "airtime_confirm_number" }],
                    [{ text: lang[selectedLanguage].EDIT_NUMBER, callback_data: "airtime" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];

                await sendButtons(chatId, message, buttons);
            } else {
                const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
                await sendButtons(chatId, lang[selectedLanguage].INVALID_NUMBER, buttons);
            }
        } else {
            const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
            await sendButtons(chatId, lang[selectedLanguage].INVALID_NUMBER_MESSAGE, buttons);
        }
    }

    else if (payload === "airtime_confirm_number") {
        const pans = await PanModel.find({ account: chat.account._id });

        const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD;
        let buttons;

        if (pans.length !== 0) {
            buttons = [
                [{ text: lang[selectedLanguage].PAYMENT_CARD, callback_data: "airtime_card" }],
                [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "airtime_ip" }],
                [{ text: lang[selectedLanguage].PAYPAL, callback_data: "airtime_paypal" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
        } else {
            buttons = [
                [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "airtime_ip" }],
                [{ text: lang[selectedLanguage].PAYPAL, callback_data: "airtime_paypal" }],
                [{ text: lang[selectedLanguage].ADD_PAYMENT_CARD, callback_data: "add_payment_card-airtime_confirm_number" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
        }

        await sendButtons(chatId, message, buttons);
    }

    // airtime using ip wallet
    else if ((text && chat.last_message?.startsWith("airtime_ip"))
        || (payload?.startsWith("airtime_ip") && chat.last_message?.startsWith("airtime_ip"))
        || (payload === "airtime_ip")
        || (chat.last_message?.startsWith("airtime_ip") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await airtimeIPWallet(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads)
        return
    }
    // airtime using paypal
    else if ((text && chat.last_message?.startsWith("airtime_paypal"))
        || (payload?.startsWith("airtime_paypal") && chat.last_message?.startsWith("airtime_paypal"))
        || (payload === "airtime_paypal")
        || (chat.last_message?.startsWith("airtime_paypal") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await airtimePaypal(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads)
        return
    }
    // airtime using card
    else if ((text && chat.last_message?.startsWith("airtime_card"))
        || (payload?.startsWith("airtime_card") && chat.last_message?.startsWith("airtime_card"))
        || (payload === "airtime_card")
        || (chat.last_message?.startsWith("airtime_card") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await airtimeCard(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads)
        return
    }
}

module.exports = { initiateAirtime }