const lang = require('../../utils/languages/languages.json');
const { sendButtons, mainMenuKeyboardMessage } = require('../telegramBotUtils');

async function changeLanguage(chatId, payload, chat, text, selectedLanguage, isChangeLanguage) {

    if (payload === "language_change" || isChangeLanguage) {
        let lastMessage = ""
        if (chat?.last_message === "connect" || chat?.last_message?.startsWith("connect") || chat?.last_message?.startsWith("register") || !chat?.last_message) {
            lastMessage = "connect"
        } else {
            lastMessage = "4"
        }

        const buttons = [
            [{ text: lang[selectedLanguage].ENGLISH, callback_data: "language_change-en" }],
            [{ text: lang[selectedLanguage].SPANISH, callback_data: "language_change-es" }],
            [{ text: lang[selectedLanguage].FRENCH, callback_data: "language_change-fr" }],
            [{ text: lang[selectedLanguage].GERMAN, callback_data: "language_change-de" }],
            [{ text: lang[selectedLanguage].HINDI, callback_data: "language_change-hi" }],
            [{ text: lang[selectedLanguage].CHINESE, callback_data: "language_change-zh" }],
            [{ text: lang[selectedLanguage].VIEW_MORE, callback_data: "language_more_1" }],
            [{
                text: lang[selectedLanguage].MAIN_MENU,
                callback_data: lastMessage === "4" ? "main_menu" : "register_template"
            }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].SELECT_LANGUAGE, buttons, lastMessage);
    }

    else if (payload === "language_more_1") {
        if (chat?.last_message === "connect" || chat?.last_message?.startsWith("connect") || chat?.last_message?.startsWith("register") || !chat?.last_message) {
            lastMessage = "connect"
        } else {
            lastMessage = "4"
        }

        const buttons = [
            [{ text: "🔙", callback_data: "language_change" }],
            [{ text: lang[selectedLanguage].INDONESIAN, callback_data: "language_change-id" }],
            [{ text: lang[selectedLanguage].ITALIAN, callback_data: "language_change-it" }],
            [{ text: lang[selectedLanguage].SWAHILI, callback_data: "language_change-sw" }],
            [{ text: lang[selectedLanguage].DUTCH, callback_data: "language_change-nl" }],
            [{ text: lang[selectedLanguage].YORUBA, callback_data: "language_change-yo" }],
            [{ text: lang[selectedLanguage].URDU, callback_data: "language_change-ur" }],
            [{ text: lang[selectedLanguage].VIEW_MORE, callback_data: "language_more_2" }],
            [{
                text: lang[selectedLanguage].MAIN_MENU,
                callback_data: lastMessage === "4" ? "main_menu" : "register_template"
            }]
        ];
        await sendButtons(chatId, lang[selectedLanguage].SELECT_LANGUAGE, buttons);
    }

    else if (payload === "language_more_2") {
        if (chat?.last_message === "connect" || chat?.last_message?.startsWith("connect") || chat?.last_message?.startsWith("register") || !chat?.last_message) {
            lastMessage = "connect"
        } else {
            lastMessage = "4"
        }
        const buttons = [
            [{ text: "🔙", callback_data: "language_more_1" }],
            [{ text: lang[selectedLanguage].POLISH, callback_data: "language_change-pl" }],
            [{ text: lang[selectedLanguage].HAUSA, callback_data: "language_change-ha" }],
            [{ text: lang[selectedLanguage].PORTOGUESE, callback_data: "language_change-pt" }],
            [{ text: lang[selectedLanguage].RUSSIAN, callback_data: "language_change-ru" }],
            [{ text: lang[selectedLanguage].TURKISH, callback_data: "language_change-tr" }],
            [{ text: lang[selectedLanguage].UKRAINIAN, callback_data: "language_change-uk" }],
            [{ text: lang[selectedLanguage].ARABIC, callback_data: "language_change-ar" }],
            [
                {
                    text: lang[selectedLanguage].MAIN_MENU,
                    callback_data: lastMessage === "4" ? "main_menu" : "register_template"
                }
            ]
        ];

        await sendButtons(chatId, lang[selectedLanguage].SELECT_LANGUAGE, buttons);

    }

    // user has selected a language to update
    else if (payload?.startsWith("language_change-")) {
        const selectedLanguage = payload.split("-")[1];
        await updateLanguage(chatId, selectedLanguage, chat)
    }
}

async function updateLanguage(chatId, language, chat) {

    chat.selected_language = language;
    await chat.save();

    console.log({ chat, language })

    if (chat?.last_message?.startsWith("connect") || chat?.last_message?.startsWith("register")) {
        const buttons = [
            [{ text: lang[language].CONNECT_BUTTON_TITLE, callback_data: "connect_account" }],
            [{ text: lang[language].REGISTER_BUTTON_TITLE, callback_data: "register" }],
            [{ text: lang[language].CHANGE_LANGUAGE, callback_data: "language_change" }],
        ];
        await sendButtons(chatId, "How can we help you today? Let's get started!🚀👇", buttons);
    } else {
        // await mainMenuMessage(chatId, language)
        await mainMenuKeyboardMessage(chatId, selectedLanguage, chat)
    }
}

module.exports = changeLanguage