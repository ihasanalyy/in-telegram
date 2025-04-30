const { sendButtons, sendMessage, handleCountrySelection, invalidInputResponse } = require("../../telegramBotUtils");
const lang = require("../../../utils/languages/languages.json");
const { getAvailableCountries, fetchCountriesFromThunes, getPayoutChannelName } = require("../../instaChatbotUtils");
const { getCountries, getPayerNames } = require("../../InstaChatbotHelpers");
const countries = require('../../../utils/countryIso.json');
const countryToEmoji = require('../../../utils/countryEmojis.json');
const PanModel = require("../../../models/Pan.model");
const { intlTransferUsingCard } = require("./intlUsingCard");
const { intlTransferPaypal } = require("./intlUsingPaypal");
const { intlTransferWallet } = require("./intlTransferUsingWallets");

async function initiateIntlTransfer(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    if (payload === "intl_transfer") {
        await sendMessage(chatId, lang[selectedLanguage].LUCKY_RECIPIENT, "intl_transfer");
    }

    else if (text && chat.last_message === "intl_transfer") {
        if (text.length < 4) {
            return await sendMessage(chatId, lang[selectedLanguage].COUNTRY_NAME_VALIDATION);
        }

        const availableCountries = await getAvailableCountries(text, selectedLanguage)
        console.log(availableCountries)

        if (!availableCountries) {
            const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]]

            return await sendButtons(chatId, lang[selectedLanguage].NO_COUNTRY_FOUND, buttons);
        }

        let buttons = availableCountries.slice(0, 8).map((country) => {
            return [
                {
                    text: `${countryToEmoji[country.country_iso_code] ?? ''}${country.country_name}`,
                    callback_data: `intl_transfer_country-${country.country_iso_code}`,
                },
            ];
        });

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]);
        buttons.push([{ text: lang[selectedLanguage].ENTER_AGAIN, callback_data: "intl_transfer" }]);

        await sendButtons(chatId, lang[selectedLanguage].SELECT_DESTINATION_COUNTRY, buttons);
    }

    // User has selected some country
    else if (payload && payload.startsWith("intl_transfer_country-") && chat.last_message === "intl_transfer") {
        const iso_code = payload.split("-")[1];

        const list = await fetchCountriesFromThunes();

        const selectedCountry = list.find((country) => country.iso_code === iso_code);

        chat.international_transfer.intl_country_code = selectedCountry.iso_code;
        chat.international_transfer.intl_country = selectedCountry?.name;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].PROCEED_TITLE, callback_data: "intl_transfer_country_proceed" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ];

        await sendButtons(
            chatId,
            lang[selectedLanguage].SELECTED_COUNTRY_CONFIRMATION.replace("{{country}}", selectedCountry?.name),
            buttons,
            "intl_transfer_country_proceed"
        );
    }
    // User has proceeded with country code
    else if (payload === "intl_transfer_country_proceed" && chat.last_message === "intl_transfer_country_proceed") {
        await handleCountrySelection(chatId, chat.international_transfer.intl_country_code, selectedLanguage);
    }
    // User has entered some country name
    // else if (chat.last_message === "intl_transfer" && text) {
    //     const countryStatus = await getCountries(text);

    //     const countryNameToISO = {};
    //     for (const country of countries) {
    //         countryNameToISO[country.name.toLowerCase()] = country.code;
    //     }

    //     const countryCode = countryNameToISO[countryStatus?.Name?.toLowerCase()];
    //     chat.international_transfer.intl_country_code = countryCode;
    //     chat.international_transfer.intl_country = countryStatus?.Name;
    //     await chat.save();

    //     if (countryStatus.country === "supported") {
    //         await handleCountrySelection(chatId, countryCode, selectedLanguage);
    //     } else if (countryStatus.country === "suggestion") {
    //         const message = `${lang[selectedLanguage].COUNTRY_MISSPELLED_MESSAGE_PART1}\n\n${lang[selectedLanguage].COUNTRY_MISSPELLED_MESSAGE_PART2}\n\n${lang[selectedLanguage].COUNTRY_MISSPELLED_MESSAGE_PART3} '${countryStatus?.Name}'`;

    //         const buttons = [
    //             [{ text: lang[selectedLanguage].CONFIRM_TITLE, callback_data: "intl_transfer_confirm_suggested_country" }],
    //             [{ text: lang[selectedLanguage].REENTER_COUNTRY_TITLE, callback_data: "intl_transfer" }],
    //             [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
    //         ];

    //         chat.international_transfer.intl_country = countryStatus?.Name;
    //         await chat.save();
    //         await sendButtons(chatId, message, buttons);
    //     } else {
    //         const buttons = [
    //             [{ text: lang[selectedLanguage].REENTER_COUNTRY_TITLE, callback_data: "intl_transfer" }],
    //             [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
    //         ];
    //         await sendButtons(chatId, lang[selectedLanguage].SEND_NOT_SUPPORTED, buttons);
    //     }
    // }

    // // User confirms suggested country
    // else if (payload === "intl_transfer_confirm_suggested_country") {
    //     const countryNameToISO = {};
    //     for (const country of countries) {
    //         countryNameToISO[country.name.toLowerCase()] = country.code;
    //     }

    //     const countryCode = countryNameToISO[chat.international_transfer.intl_country?.toLowerCase()];
    //     chat.international_transfer.intl_country_code = countryCode;
    //     await chat.save();

    //     await handleCountrySelection(chatId, countryCode, selectedLanguage);
    // }

    else if (payload?.includes("intl_transfer_service-") && chat.last_message === "intl_transfer_service") {
        const serviceId = payload.split("-")[1];
        const payerList = await getPayerNames(serviceId, chat.international_transfer?.intl_country_code);

        console.log(payerList, "payers_list");

        chat.international_transfer.intl_payout_method = serviceId;
        await chat.save();

        const numberOfChannelsPerPage = 8;
        const currentPage = 1;
        const startIndex = (currentPage - 1) * numberOfChannelsPerPage;
        const endIndex = startIndex + numberOfChannelsPerPage;

        let payoutChannels = payerList.payers.split('\n').filter(line => line.trim() !== '').slice(startIndex, endIndex).join('\n');

        const allPayers = payerList.servicesWithIds;
        const displayedPayers = allPayers.slice(startIndex, endIndex);
        const buttons = displayedPayers.map((payer, index) => [
            {
                text: (startIndex + index + 1).toString(), // Payer index number
                callback_data: `intl_transfer_payer_${payer.id}` // Callback data with payer ID
            }
        ]);

        let selectMessage;
        if (serviceId === "1") {
            selectMessage = lang[selectedLanguage].SELECT_PROVIDER;
        } else if (serviceId === "2") {
            selectMessage = lang[selectedLanguage].SELECT_BANK;
        } else {
            selectMessage = lang[selectedLanguage].SELECT_PAYER;
        }

        const message = `${selectMessage}\n\n${payoutChannels}\n`;

        if (serviceId === "1" || serviceId === "2") {
            buttons.unshift([{ text: lang[selectedLanguage].SEARCH_PAYER, callback_data: "intl_transfer_search_payer" }]);
        }

        if (currentPage > 1) {
            buttons.unshift([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: `intl_transfer_prev_payers_${currentPage - 1}` }]);
        }

        // Check if there are more payers available
        if (allPayers.length > endIndex) {
            buttons.push([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `intl_transfer_next_payers_${currentPage + 1}_${serviceId}` }]);
        }

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);

        await sendButtons(chatId, message, buttons, "intl_transfer_payer");
    }
    // Handle "Next" callback for payers
    else if (payload && payload.startsWith("intl_transfer_next_payers") && chat.last_message === "intl_transfer_payer") {
        const currentPage = parseInt(payload.split("_")[4]);
        const serviceId = parseInt(payload.split("_")[5]);

        // const [_, currentPageStr, serviceId] = payload.split("_");
        // const currentPage = parseInt(currentPageStr, 10);
        const payerList = await getPayerNames(serviceId, chat.international_transfer.intl_country_code);

        const numberOfChannelsPerPage = 8;
        const startIndex = (currentPage - 1) * numberOfChannelsPerPage;
        const endIndex = startIndex + numberOfChannelsPerPage;

        const payoutChannels = payerList.payers
            .split('\n')
            .filter(line => line.trim() !== '')
            .slice(startIndex, endIndex)
            .join('\n');

        const allPayers = payerList.servicesWithIds;
        const displayedPayers = allPayers.slice(startIndex, endIndex);
        const buttons = displayedPayers.map((payer, index) => [
            {
                text: (startIndex + index + 1).toString(), // Payer index number
                callback_data: `intl_transfer_payer_${payer.id}` // Callback data with payer ID
            }
        ]);

        let selectMessage;
        if (serviceId === "1") {
            selectMessage = lang[selectedLanguage].SELECT_PROVIDER;
        } else if (serviceId === "2") {
            selectMessage = lang[selectedLanguage].SELECT_BANK;
        } else {
            selectMessage = lang[selectedLanguage].SELECT_PROVIDER;
        }

        const message = `${selectMessage}\n\n${payoutChannels}\n`;

        if (serviceId === "1" || serviceId === "2") {
            buttons.unshift([{ text: lang[selectedLanguage].SEARCH_PAYER, callback_data: "intl_transfer_search_payer" }]);
        }

        if (currentPage === 2) {
            buttons.unshift([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: "intl_transfer_re_select_payout" }]);
        } else if (currentPage > 1) {
            buttons.unshift([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: `intl_transfer_next_payers_${currentPage - 1}_${serviceId}` }]);
        }

        if (allPayers.length > endIndex) {
            buttons.push([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `intl_transfer_next_payers_${currentPage + 1}_${serviceId}` }]);
        }

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);

        await sendButtons(chatId, message, buttons);
    }

    // Handle "intl_transfer_search_payer" callback functionality
    else if (payload === "intl_transfer_search_payer" && chat.last_message === "intl_transfer_payer") {
        const buttons = [
            [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].ENTER_PAYER_NAME, buttons, "intl_transfer_search_payer_msg");
    }
    else if (chat.last_message === "intl_transfer_search_payer_msg" && text && !payload) {
        const searchQuery = text.toLowerCase();
        const payerList = await getPayerNames(chat.international_transfer.intl_payout_method, chat.international_transfer.intl_country_code);

        const searchResults = payerList.servicesWithIds.filter(payer => payer.name.toLowerCase()?.includes(searchQuery));

        console.log(searchResults, "searchResults");
        if (searchResults.length === 0) {
            const buttons = [[{ text: lang[selectedLanguage].SEARCH_AGAIN, callback_data: "intl_transfer_search_payer" }]];

            return await sendButtons(chatId, lang[selectedLanguage].NO_PAYERS_FOUND.replace("{{searchQuery}}", searchQuery), buttons);
        } else {
            chat.international_transfer.search_results = searchResults;
            await chat.save();

            // Show the first page of results (max 8 payers)
            const numberOfChannelsPerPage = 8;
            const currentPage = 1;
            const startIndex = (currentPage - 1) * numberOfChannelsPerPage;
            const endIndex = startIndex + numberOfChannelsPerPage;
            const displayedPayers = searchResults.slice(startIndex, endIndex);

            const payerIndexList = displayedPayers.map((payer, index) => ([
                { text: (startIndex + index + 1).toString(), callback_data: `intl_transfer_payer_${payer.id}` }
            ]));

            const payerListText = displayedPayers
                .map((payer, index) => `${startIndex + index + 1}. ${payer.name}`)
                .join('\n');

            const message = lang[selectedLanguage].SEARCH_RESULTS
                .replace("{{searchQuery}}", searchQuery)
                .replace("{{payerList}}", payerListText);
            const buttons = [
                [{ text: lang[selectedLanguage].SEARCH_AGAIN, callback_data: "intl_transfer_search_payer" }],
                ...payerIndexList,
                [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
            ];

            // Add pagination if more than 8 results
            if (searchResults.length > endIndex) {
                buttons.unshift([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `intl_transfer_next_search_results_${currentPage + 1}` }]);
            }

            return await sendButtons(chatId, message, buttons);
        }
    }

    else if (payload?.includes("intl_transfer_next_search_results") && chat.last_message === "intl_transfer_search_payer_msg") {
        const currentPage = parseInt(payload.split("_")[3]);
        const searchResults = chat.international_transfer.search_results; // Get search results from the chatbot state

        const numberOfChannelsPerPage = 8;
        const startIndex = (currentPage - 1) * numberOfChannelsPerPage;
        const endIndex = startIndex + numberOfChannelsPerPage;
        const displayedPayers = searchResults.slice(startIndex, endIndex);

        const payerIndexList = displayedPayers.map((payer, index) => ([
            { text: (startIndex + index + 1).toString(), callback_data: `intl_transfer_payer_${payer.id}` }
        ]));

        const message = lang[selectedLanguage].SEARCH_RESULTS_PAGE
            .replace("{{currentPage}}", currentPage)
            .replace("{{payerList}}", displayedPayers.map((payer, index) => `${startIndex + index + 1}. ${payer.name}`).join('\n'));

        const buttons = [
            [{ text: lang[selectedLanguage].SEARCH_AGAIN, callback_data: "intl_transfer_search_payer" }],
            ...payerIndexList,
            [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
        ];

        if (currentPage > 1) {
            buttons.unshift([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: `intl_transfer_prev_search_results_${currentPage - 1}` }]);
        }

        if (searchResults.length > endIndex) {
            buttons.push([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `intl_transfer_next_search_results_${currentPage + 1}` }]);
        }

        return await sendButtons(chatId, message, buttons);
    }

    else if (payload?.includes("intl_transfer_prev_search_results") && chat.last_message === "intl_transfer_search_payer_msg") {
        const currentPage = parseInt(payload.split("_")[3]);
        const searchResults = chat.international_transfer.search_results; // Get search results from the chatbot state

        const numberOfChannelsPerPage = 8;
        const startIndex = (currentPage - 1) * numberOfChannelsPerPage;
        const endIndex = startIndex + numberOfChannelsPerPage;
        const displayedPayers = searchResults.slice(startIndex, endIndex);

        const payerIndexList = displayedPayers.map((payer, index) => ([
            { text: (startIndex + index + 1).toString(), callback_data: `intl_transfer_payer_${payer.id}` }
        ]));

        const message = lang[selectedLanguage].SEARCH_RESULTS_PAGE
            .replace("{{currentPage}}", currentPage)
            .replace("{{payerList}}", displayedPayers.map((payer, index) => `${startIndex + index + 1}. ${payer.name}`).join('\n'));

        const buttons = [
            [{ text: lang[selectedLanguage].SEARCH_AGAIN, callback_data: "intl_transfer_search_payer" }],
            ...payerIndexList,
            [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
        ];

        if (currentPage > 1) {
            buttons.unshift([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: `intl_transfer_prev_search_results_${currentPage - 1}` }]);
        }

        if (searchResults.length > endIndex) {
            buttons.push([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `intl_transfer_next_search_results_${currentPage + 1}` }]);
        }

        return await sendButtons(chatId, message, buttons);
    }

    else if (payload?.includes("intl_transfer_payer_") && (chat.last_message === "intl_transfer_search_payer_msg" || chat.last_message === "intl_transfer_payer")) {
        console.log("intl_transfer_payer_")
        const payerId = payload.split("_")[3];
        console.log({ payerId })
        chat.international_transfer.intl_payer_id = payerId;
        await chat.save();

        const payerList = await getPayerNames(chat.international_transfer.intl_payout_method, chat.international_transfer.intl_country_code);

        const payerChannel = payerList?.servicesWithIds?.filter((item) => {
            return item.id.toString() === payerId;
        });

        if (payerChannel && payerChannel.length > 0) {
            const message = lang[selectedLanguage].CONFIRM_SENDING
                .replace("{{WALLET_PROVIDER}}", payerChannel[0].name)
                .replace("{{COUNTRY}}", chat?.international_transfer.intl_country);

            const buttons = [
                [{ text: lang[selectedLanguage].YES_CONTINUE_TITLE, callback_data: "intl_transfer_continue_intl_payout" }],
                [{ text: lang[selectedLanguage].BACK_BUTTON_TITLE, callback_data: "intl_transfer_re_select_payout" }],
                [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
            ];

            return await sendButtons(chatId, message, buttons);
        } else {
            const buttons = [
                [{ text: lang[selectedLanguage].RESELECT_CHANNEL_TITLE, callback_data: "intl_transfer_re_select_payout" }],
                [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
            ];

            return await sendButtons(chatId, lang[selectedLanguage].INVALID_PAYOUT_CHANNEL_MESSAGE, buttons);
        }
    }

    // else if (payload === "intl_transfer_continue_intl_payout" && (chat.last_message === "intl_transfer_search_payer_msg" || chat.last_message === "intl_transfer_payer")) {

    //     const payerList = await getPayerNames(chat.international_transfer.intl_payout_method, chat.international_transfer.intl_country_code);
    //     console.log(payerList, "payers_list");

    //     const numberOfChannelsPerPage = 8;
    //     const currentPage = 1;
    //     const startIndex = (currentPage - 1) * numberOfChannelsPerPage;
    //     const endIndex = startIndex + numberOfChannelsPerPage;

    //     let payoutChannels = payerList.payers.split('\n').filter(line => line.trim() !== '').slice(startIndex, endIndex).join('\n');

    //     const allPayers = payerList.servicesWithIds;
    //     const displayedPayers = allPayers.slice(startIndex, endIndex);
    //     const payerIndexList = displayedPayers.map((payer, index) => ([
    //         { text: `${startIndex + index + 1}`, callback_data: `intl_transfer_payer_${payer.id}` } // Payer index and ID
    //     ]));

    //     let selectMessage;
    //     if (chat.international_transfer.intl_payout_method === "1") {
    //         selectMessage = lang[selectedLanguage].SELECT_PROVIDER;
    //     } else if (chat.international_transfer.intl_payout_method === "2") {
    //         selectMessage = lang[selectedLanguage].SELECT_BANK;
    //     } else {
    //         selectMessage = lang[selectedLanguage].SELECT_PROVIDER;
    //     }

    //     const message = `${selectMessage}\n\n${payoutChannels}\n`;

    //     const buttons = [
    //         ...payerIndexList,
    //         [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
    //     ];

    //     // Check if there are more payers available
    //     if (allPayers.length > endIndex) {
    //         buttons.unshift([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `intl_transfer_next_payers_${currentPage + 1}_${chat.international_transfer.intl_payout_method}` }]);
    //     }

    //     return await sendButtons(chatId, message, buttons);
    // }

    else if (payload === "intl_transfer_re_select_payout" && (chat.last_message === "intl_transfer_search_payer_msg" || chat.last_message === "intl_transfer_payer")) {
        const payerList = await getPayerNames(chat?.international_transfer.intl_payout_method, chat?.international_transfer.intl_country_code);
        console.log(payerList, "payers_list");

        const numberOfChannelsPerPage = 8;
        const currentPage = 1;
        const startIndex = (currentPage - 1) * numberOfChannelsPerPage;
        const endIndex = startIndex + numberOfChannelsPerPage;

        const payoutChannels = payerList.payers.split('\n').filter(line => line.trim() !== '').slice(startIndex, endIndex).join('\n');

        const allPayers = payerList.servicesWithIds;
        const displayedPayers = allPayers.slice(startIndex, endIndex);
        const payerButtons = displayedPayers.map((payer, index) => ({
            text: (startIndex + index + 1).toString(), // Payer index number
            callback_data: `intl_transfer_payer_${payer.id}` // Callback data with payer ID
        }));

        let selectMessage;
        if (chat?.international_transfer.intl_payout_method === "1") {
            selectMessage = lang[selectedLanguage].SELECT_PROVIDER;
        } else if (chat?.international_transfer.intl_payout_method === "2") {
            selectMessage = lang[selectedLanguage].SELECT_BANK;
        } else {
            selectMessage = lang[selectedLanguage].SELECT_PROVIDER;
        }

        const message = `${selectMessage}\n\n${payoutChannels}\n`;

        let buttons = [
            ...payerButtons.map(button => [{ text: button.text, callback_data: button.callback_data }]),
            [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: `main_menu` }]
        ];

        // Check if there are more payers available
        if (allPayers.length > endIndex) {
            buttons.unshift([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `intl_transfer_next_payers_${currentPage + 1}_${chat?.international_transfer.intl_payout_method}` }]);
        }

        await sendButtons(entry.messaging[0].sender.id, message, buttons);
    }

    // user has selected payout channel // chck
    else if (chat?.last_message === "4.3.2" && text && !payload) {
        if (text === "0") {
            await mainMenuMessage(entry.messaging[0], messaging?.sender?.id, chat, selectedLanguage);
        } else {
            chat.international_transfer.intl_payout_channel = text;
            await chat.save();

            const payerList = await getPayerNames(chat.international_transfer.intl_payout_method, chat.international_transfer.intl_country_code);
            console.log(payerList, "payerList");

            const payoutChannelName = getPayoutChannelName(payerList, text, 18);
            const selectedPayer = payerList?.servicesWithIds?.find(service => {
                return service.name.replace(/\s/g, '') === payoutChannelName.replace(/\s/g, '');
            });
            console.log('IDtest:', selectedPayer);
            chat.international_transfer.intl_payer_id = selectedPayer?.id;
            await chat.save();

            if (payoutChannelName) {
                const message = lang[selectedLanguage].CONFIRM_SENDING.replace("{{WALLET_PROVIDER}}", payoutChannelName)
                    .replace("{{COUNTRY}}", chat?.international_transfer.intl_country);
                const buttons = [
                    [{ text: lang[selectedLanguage].YES_CONTINUE_TITLE, callback_data: "intl_transfer_continue_intl_payout" }],
                    [{ text: lang[selectedLanguage].BACK_BUTTON_TITLE, callback_data: "intl_transfer_re_select_payout" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
                ];

                await sendButtons(messaging?.sender?.id, message, buttons);
            } else {
                const buttons = [
                    [{ text: lang[selectedLanguage].RESELECT_CHANNEL_TITLE, callback_data: "intl_transfer_re_select_payout" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
                ];

                await sendButtons(messaging?.sender?.id, lang[selectedLanguage].INVALID_PAYOUT_CHANNEL_MESSAGE, buttons);
            }
        }
    }

    else if (payload === "intl_transfer_continue_intl_payout" && (chat?.last_message === "intl_transfer_payer" || chat?.last_message === "intl_transfer_payment_method")) {

        const pans = await PanModel.find({ account: chat?.account._id });

        let message = lang[selectedLanguage].SELECT_PAYMENT_METHOD;
        let buttons = [];

        if (pans.length !== 0) {
            buttons = [
                [{ text: lang[selectedLanguage].PAYMENT_CARD, callback_data: "intl_transfer_card_payment" }],
                [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "intl_transfer_w2w" }],
                [{ text: lang[selectedLanguage].PAYPAL, callback_data: "intl_transfer_paypal_payment" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
            ];
        } else {
            buttons = [
                [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "intl_transfer_w2w" }],
                [{ text: lang[selectedLanguage].PAYPAL, callback_data: "intl_transfer_paypal_payment" }],
                [{ text: lang[selectedLanguage].ADD_PAYMENT_CARD, callback_data: "add_payment_card-intl_transfer_continue_intl_payout" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
            ];
        }

        await sendButtons(chatId, message, buttons, "intl_transfer_payment_method");
    }

    // user has selected payment for international with card
    else if (
        (payload?.includes("intl_transfer_card_payment") || payload === "intl_transfer_card_payment") &&
        (chat?.last_message === "intl_transfer_payment_method" || chat?.last_message?.startsWith("intl_transfer_card_payment")) ||
        (image_payloads.length > 0 || video_payloads.length > 0) && chat?.last_message?.startsWith("intl_transfer_card_payment") ||
        (text && !payload && chat?.last_message?.startsWith("intl_transfer_card_payment"))
    ) {
        await intlTransferUsingCard(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads);
    }

    // user has selected payment for international with paypal
    else if (
        (payload?.includes("intl_transfer_paypal_payment") || payload === "intl_transfer_paypal_payment") &&
        (chat?.last_message === "intl_transfer_payment_method" || chat?.last_message?.startsWith("intl_transfer_paypal_payment")) ||
        (image_payloads.length > 0 || video_payloads.length > 0) && chat?.last_message?.startsWith("intl_transfer_paypal_payment") ||
        (text && !payload && chat?.last_message?.startsWith("intl_transfer_paypal_payment"))
    ) {
        await intlTransferPaypal(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads);
    }

    // user has selected payment for international with instapay wallets
    else if (
        (payload?.includes("intl_transfer_w2w") || payload === "intl_transfer_w2w") &&
        (chat?.last_message === "intl_transfer_payment_method" || chat?.last_message?.startsWith("intl_transfer_w2w")) ||
        (image_payloads.length > 0 || video_payloads.length > 0) && chat?.last_message?.startsWith("intl_transfer_w2w") ||
        (text && !payload && chat?.last_message?.startsWith("intl_transfer_w2w"))
    ) {
        await intlTransferWallet(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads);
    }

    // else default response of invalid command
    else {
        await invalidInputResponse(selectedLanguage, chat);
    }


}

module.exports = { initiateIntlTransfer }