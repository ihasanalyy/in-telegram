const { sendButtons, sendMessage, handleCountrySelection, invalidInputResponse, sendPhoto } = require("../../telegramBotUtils");
const lang = require("../../../utils/languages/languages.json");
const { getAvailableCountries, fetchCountriesFromThunes, getPayoutChannelName, searchUsersAndWallets, getDistinctObjects } = require("../../instaChatbotUtils");
const { getCountries, getPayerNames } = require("../../InstaChatbotHelpers");
const countries = require('../../../utils/countryIso.json');
const countryToEmoji = require('../../../utils/countryEmojis.json');
const PanModel = require("../../../models/Pan.model");
const { w2wUsingWallet } = require("./w2wUsingWallet");
const currencyToEmoji = require('../../../utils/currencyEmojis.json');
const { w2wUsingCard } = require("./w2wUsingCard");
const { w2wUsingPaypal } = require("./w2wUsingPaypal");

async function initiateW2W(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {

    const mainMenuButton = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]]

    if (payload === "w2w") {
        await sendButtons(chatId, lang[selectedLanguage].RECIPIENT_DETAILS_PROMPT, mainMenuButton, "w2w");
    } else if (chat.last_message === "w2w" && text && !payload) {
        const accountsWithWallets = await searchUsersAndWallets(text.toLowerCase());
        const uniqueResults = await getDistinctObjects(accountsWithWallets);

        if (uniqueResults.length > 0) {
            const filteredAccount = uniqueResults[0];

            if (filteredAccount?._id?.toString() === chat?.account?._id?.toString()) {
                const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
                return await sendButtons(chatId, lang[selectedLanguage].SEND_MONEY_TO_SELF, buttons);
            }

            const userName = filteredAccount.account_type === "individual"
                ? `${filteredAccount.first_name} ${filteredAccount.last_name}`
                : filteredAccount.company_name;

            if (filteredAccount?.wallets?.length > 1) {
                const subtitleMsg = `
${lang[selectedLanguage].USERNAME_LABEL}: ${filteredAccount.username}
${lang[selectedLanguage].COUNTRY_LABEL}: ${filteredAccount.country_name}
${lang[selectedLanguage].ABOUT_ME}: ${filteredAccount.about_me}
                `;

                const walletButtons = [
                    filteredAccount.wallets.map(wallet => ({
                        text: `${currencyToEmoji[wallet.currency.code] ?? ''}${wallet.currency.code}`,
                        callback_data: `w2w_recv-${wallet.wallet_id}`
                    })),
                    [
                        { text: lang[selectedLanguage].ENTER_AGAIN, callback_data: "w2w" },
                        { text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }
                    ]
                ];

                await sendPhoto(chatId, filteredAccount.profileImage, `${userName}\n${subtitleMsg}`);
                return await sendButtons(chatId, lang[selectedLanguage].SELECT_WALLET, walletButtons, "w2w");
            }
            else if (filteredAccount?.wallets?.length === 1) {
                const wallet = filteredAccount.wallets[0];
                const subtitleMsg = `
${lang[selectedLanguage].USERNAME_LABEL}: ${filteredAccount.username}
${lang[selectedLanguage].COUNTRY_LABEL}: ${filteredAccount.country_name}
${lang[selectedLanguage].WALLET_ID} ${wallet.wallet_id}
${lang[selectedLanguage].CURRENCY}: ${wallet.currency.code}
                `;

                const actionButtons = [
                    [{ text: lang[selectedLanguage].PROCEED_BUTTON, callback_data: "w2w_methods" }],
                    [{ text: lang[selectedLanguage].ENTER_AGAIN, callback_data: "w2w" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }
                    ]
                ];

                chat.wallet_to_wallet.receiving_wallet = wallet.wallet_id;
                await chat.save();

                await sendPhoto(chatId, filteredAccount.profileImage, `${userName}\n${subtitleMsg}`);
                return await sendButtons(chatId, lang[selectedLanguage].IS_CORRECT_MESSAGE, actionButtons, "w2w");
            } else {
                const message = lang[selectedLanguage].NO_WALLETS_FOUND;
                const buttons = [
                    [
                        { text: lang[selectedLanguage].ENTER_AGAIN, callback_data: "w2w" },
                        { text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }
                    ]
                ];
                return await sendButtons(chatId, message, buttons);
            }
        } else {
            const buttons = [
                [
                    { text: lang[selectedLanguage].ENTER_AGAIN, callback_data: "w2w" },
                    { text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }
                ]
            ];
            return await sendButtons(chatId, lang[selectedLanguage].NO_USER_FOUND.replace('{{NAME}}', text), buttons);
        }
    }

    else if (payload?.includes("w2w_recv-") && chat?.last_message === "w2w") {
        const walletID = payload.split('-')[1];
        chat.wallet_to_wallet.receiving_wallet = walletID;
        await chat.save();

        // Fetching different payment methods
        const pans = await PanModel.find({ account: chat.account._id });
        const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD;

        let buttons;
        if (pans.length !== 0) {
            buttons = [
                [{ text: lang[selectedLanguage].PAYMENT_CARD, callback_data: "w2w_card" }],
                [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "w2w_ip_w" }],
                [{ text: lang[selectedLanguage].PAYPAL, callback_data: "w2w_paypal" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
            ];
        } else {
            buttons = [
                [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "w2w_ip_w" }],
                [{ text: lang[selectedLanguage].PAYPAL, callback_data: "w2w_paypal" }],
                [{ text: lang[selectedLanguage].ADD_PAYMENT_CARD, callback_data: "add_payment_card-w2w_methods" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
            ];
        }

        await sendButtons(chatId, message, buttons, "w2w_payment_method");
    }
    else if (payload === "w2w_methods" &&
        (chat?.last_message === "w2w" ||
            chat?.last_message === "w2w_ip_w_amount" ||
            chat?.last_message === "w2w_ip_w_payment_type" ||
            chat?.last_message === "w2w_payment_method")
    ) {
        const pans = await PanModel.find({ account: chat.account._id });

        const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD;
        let buttons = [];

        if (pans.length !== 0) {
            buttons = [
                [{ text: lang[selectedLanguage].PAYMENT_CARD, callback_data: "w2w_card" }],
                [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "w2w_ip_w" }],
                [{ text: lang[selectedLanguage].PAYPAL, callback_data: "w2w_paypal" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
        } else {
            buttons = [
                [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "w2w_ip_w" }],
                [{ text: lang[selectedLanguage].PAYPAL, callback_data: "w2w_paypal" }],
                [{ text: lang[selectedLanguage].ADD_PAYMENT_CARD, callback_data: "add_payment_card-w2w_methods" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
        }

        await sendButtons(chatId, message, buttons, "w2w_payment_method");
    }

    // user has selected payment for w2w with instapay wallets
    else if (
        (payload?.includes("w2w_ip_w") || payload === "w2w_ip_w") &&
        (chat?.last_message === "w2w_payment_method" || chat?.last_message?.startsWith("w2w_ip_w")) ||
        (image_payloads.length > 0 || video_payloads.length > 0) && chat?.last_message?.startsWith("w2w_ip_w") ||
        (text && !payload && chat?.last_message?.startsWith("w2w_ip_w"))
    ) {
        await w2wUsingWallet(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads);
    }

    // user has selected payment for w2w with card
    else if (
        (payload?.includes("w2w_card") || payload === "w2w_card") &&
        (chat?.last_message === "w2w_payment_method" || chat?.last_message?.startsWith("w2w_card")) ||
        (image_payloads.length > 0 || video_payloads.length > 0) && chat?.last_message?.startsWith("w2w_card") ||
        (text && !payload && chat?.last_message?.startsWith("w2w_card"))
    ) {
        await w2wUsingCard(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads);
    }

    // user has selected payment for w2w with paypal
    else if (
        (payload?.includes("w2w_paypal") || payload === "w2w_paypal") &&
        (chat?.last_message === "w2w_payment_method" || chat?.last_message?.startsWith("w2w_paypal")) ||
        (image_payloads.length > 0 || video_payloads.length > 0) && chat?.last_message?.startsWith("w2w_paypal") ||
        (text && !payload && chat?.last_message?.startsWith("w2w_paypal"))
    ) {
        await w2wUsingPaypal(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads);
    }

    // else default response of invalid command
    else {
        await invalidInputResponse(selectedLanguage, chat);
    }


}

module.exports = { initiateW2W }