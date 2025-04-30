const { sendButtons, sendMessage, handleCountrySelection, invalidInputResponse, sendPhoto, somethingWentWrongQuickReplyTelegram } = require("../../telegramBotUtils");
const lang = require("../../../utils/languages/languages.json");
const { getAvailableCountries, fetchCountriesFromThunes, getPayoutChannelName, searchUsersAndWallets, getDistinctObjects } = require("../../instaChatbotUtils");
const { getCountries, getPayerNames, numberVerificationAirtime, formattedAmount, getSubservices } = require("../../InstaChatbotHelpers");
const countries = require('../../../utils/countryIso.json');
const countryToEmoji = require('../../../utils/countryEmojis.json');
const PanModel = require("../../../models/Pan.model");
const currencyToEmoji = require('../../../utils/currencyEmojis.json');
const Wallet = require("../../../models/Wallet.model");
const { getItemsFromSubServicesHelper, fetchRangedAirtimeRatesHelper, getRatesHelper, fetchItemDetailsHelper, createTransactionRangedHelper, createTransactionFixedHelper, initiateAirtimePaypalTransactionHelper, initiateAirtimeFixedPaypalTransactionHelper } = require("../../dtOneHelpers");
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler");
const jwt = require("jsonwebtoken");
const { formatDecimalNumbersWithLimit } = require("../../payerRates");
const { fetchLocalOrDefaultWalletConditionally, validateCardExpiry } = require("../../helpers");
const { initiateTopUpSavedCard } = require("../../chatbot/airtime/airtimeUsingCard");

async function airtimeCard(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(chat.account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReplyTelegram(chatId, lang[selectedLanguage].NO_DEFAULT_WALLET_SET, selectedLanguage);
    }

    if (payload === "airtime_card") {
        const pans = await PanModel.find({ account: chat.account._id });
        console.log(pans);

        let buttons = [];

        if (pans.length !== 0) {
            // Add card buttons
            for (let i = 0; i < pans.length; i++) {
                buttons.push([
                    {
                        text: `💳 *******${pans[i].last4}`,
                        callback_data: `airtime_card_select_card-${pans[i]._id}`
                    }
                ]);
            }

            buttons.push([
                {
                    text: lang[selectedLanguage].CHANGE_PAYMENT_METHOD,
                    callback_data: `airtime_confirm_number`
                }
            ]);

            // Add main menu button
            buttons.push([
                {
                    text: `☰ ${lang[selectedLanguage].MAIN_MENU}`,
                    callback_data: `main_menu`
                }
            ]);

            await sendButtons(chatId, lang[selectedLanguage].SELECT_YOUR_TOPUP_CHANNEL, buttons, "airtime_card");
        } else {
            buttons.push([
                {
                    text: `☰ ${lang[selectedLanguage].MAIN_MENU}`,
                    callback_data: `main_menu`
                }
            ]);
            await sendButtons(chatId, lang[selectedLanguage].NO_CARD_SAVED, buttons, "airtime_card");
        }
    }
    // User has selected topup channel
    else if (payload?.includes("airtime_card_select_card") && chat.last_message === "airtime_card") {
        const cardId = payload.split("-")[1];

        const expiryValidation = await validateCardExpiry(cardId);
        if (!expiryValidation.status) {
            // Handle expired or invalid card
            const pans = await PanModel.find({ account: chat.account._id });
            let buttons = [];

            if (pans.length !== 0) {
                const message = lang[selectedLanguage].EXPIRED_CARD;

                buttons = [
                    [{ text: lang[selectedLanguage].PAYMENT_CARD, callback_data: "airtime_card" }],
                    [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "airtime_wallets_flow_wallets" }],
                    [{ text: lang[selectedLanguage].PAYPAL, callback_data: "airtime_paypal_flow" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];

                await sendButtons(chatId, message, buttons);
            } else {
                const message = lang[selectedLanguage].EXPIRED_CARD;

                buttons = [
                    [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "airtime_wallets_flow_wallets" }],
                    [{ text: lang[selectedLanguage].PAYPAL, callback_data: "airtime_paypal_flow" }],
                    [{ text: lang[selectedLanguage].ADD_PAYMENT_CARD, callback_data: "add_payment_card-airtm_confirm_number" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];

                await sendButtons(chatId, message, buttons);
            }
            return;
        }

        chat.airtime.pan = cardId;
        await chat.save();

        const subServiceData = {
            isoCode: chat.airtime.country_code,
            operator_id: chat.airtime.operator_id,
            serviceId: 1
        };
        console.log(subServiceData, "subServiceDataingetsubservices");

        const subServices = await getSubservices(subServiceData);
        console.log(subServices, "subServices");

        if (subServices?.status) {
            let buttons = subServices?.message?.map(service => {
                let title;
                if (service.name.includes("Bundle")) {
                    title = lang[selectedLanguage].BUNDLE;
                } else if (service.name.includes("Airtime")) {
                    title = lang[selectedLanguage].AIRTIME;
                } else if (service.name.includes("Data")) {
                    title = lang[selectedLanguage].DATA_INTERNET;
                } else {
                    title = service.name;
                }
                return [{
                    text: title,
                    callback_data: `airtime_card_service-${service.id}`
                }];
            });

            // Add main menu button
            buttons.push([{
                text: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                callback_data: `main_menu`
            }]);

            await sendButtons(chatId, lang[selectedLanguage].SELECT_SERVICE, buttons);
        } else {
            const buttons = [
                [{
                    text: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                    callback_data: `main_menu`
                }]
            ];
            await sendButtons(chatId, lang[selectedLanguage].NO_SERVICES_FOUND_MESSAGE, buttons);
        }
    }
    else if (payload?.includes("airtime_card_service-")) {
        const subService = payload.split("-")[1];
        console.log(subService, "subService");

        const getItemsdata = {
            wallet_id: defaultWallet._id,
            isoCode: chat.airtime.country_code,
            operator_id: chat?.airtime?.operator_id,
            serviceId: '1',
            subservice_id: subService,
            userId: chat.account._id
        };

        let productList = await getItemsFromSubServicesHelper(getItemsdata);
        console.log(productList, "productList");

        if (!productList.status) {
            // clearing the data
            chat.airtime = undefined;
            await chat.save();

            await sendMessage(chatId, lang[selectedLanguage].FETCH_PRODUCTS_ERROR);
            return;
        }

        // if productList.data is not an array then we will not sort else will sort
        if (Array.isArray(productList?.data)) {
            productList = productList?.data.sort((a, b) => a.prices.amount - b.prices.amount);
        } else {
            productList = productList?.data;
        }

        if (subService == 12 || subService == 13) {
            const numberOfProductsPerPage = 6;
            let currentPage = 1;
            const startIndex = (currentPage - 1) * numberOfProductsPerPage;
            const endIndex = startIndex + numberOfProductsPerPage;

            const displayedProducts = productList.slice(startIndex, endIndex);

            let buttons = [];
            let productNames = displayedProducts.map((product, index) =>
                `${startIndex + index + 1}. ${product.name} || ${formattedAmount(product.prices.amount)} ${product.prices.unit}`
            ).join('\n');

            let selectMessage = subService == 12 ? lang[selectedLanguage].CHOOSE_BUNDLE_PACKAGE : lang[selectedLanguage].CHOOSE_DATA_PACKAGE;
            const message = `${selectMessage}\n\n${productNames}\n`;

            // Add product buttons
            displayedProducts.forEach((product, index) => {
                buttons.push([
                    {
                        text: (startIndex + index + 1).toString(),
                        callback_data: `airtime_card_product-${product.id}-bundle`
                    }
                ]);
            });

            // Add navigation and menu buttons
            if (currentPage > 1) {
                buttons.unshift([
                    {
                        text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE,
                        callback_data: `airtime_card_prev_products-${currentPage - 1}-${subService}`
                    }
                ]);
            }

            if (productList.length > endIndex) {
                buttons.push([
                    {
                        text: lang[selectedLanguage].NEXT_BUTTON_TITLE,
                        callback_data: `airtime_card_next_products-${currentPage + 1}-${subService}`
                    }
                ]);
            }

            buttons.push([
                {
                    text: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                    callback_data: `main_menu`
                }
            ]);

            await sendButtons(chatId, message, buttons);
        } else {
            if (Array.isArray(productList)) {
                const numberOfProductsPerPage = 6;
                let currentPage = 1;
                const startIndex = (currentPage - 1) * numberOfProductsPerPage;
                const endIndex = startIndex + numberOfProductsPerPage;

                const displayedProducts = productList.slice(startIndex, endIndex);

                let buttons = [];
                const message = lang[selectedLanguage].SELECT_AIRTIME_AMOUNT;

                // Add product buttons
                displayedProducts.forEach((product) => {
                    buttons.push([
                        {
                            text: `${formattedAmount(product.prices.amount)} ${product.prices.unit}`,
                            callback_data: `airtime_card_product-${product.id}-fixed`
                        }
                    ]);
                });

                // Add navigation buttons
                if (currentPage > 1) {
                    buttons.unshift([
                        {
                            text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE,
                            callback_data: `airtime_card_prev_products-${currentPage - 1}-${subService}`
                        }
                    ]);
                }

                if (productList.length > endIndex) {
                    buttons.push([
                        {
                            text: lang[selectedLanguage].NEXT_BUTTON_TITLE,
                            callback_data: `airtime_card_next_products-${currentPage + 1}-${subService}`
                        }
                    ]);
                }

                buttons.push([
                    {
                        text: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                        callback_data: `main_menu`
                    }
                ]);

                await sendButtons(chatId, message, buttons);
            } else {
                console.log({ asd: productList });
                const baseAmount = productList.baseAmount;
                const unit = productList.unit;

                await sendMessage(
                    chatId,
                    lang[selectedLanguage].enter_airtime_amount
                        .replace('{{min_amount}}', formattedAmount((baseAmount?.min)) ?? "N/A")
                        .replace('{{max_amount}}', formattedAmount((baseAmount?.max)) ?? "N/A")
                        .replace(/{{currency}}/g, unit ?? "N/A"),
                    "airtime_card_airtime-amount"
                );
            }
        }
    }

    // Handle "Next" quick reply for products
    else if (payload?.includes("airtime_card_next_products")) {
        const [_, currentPageStr, subService] = payload.split("-");
        let currentPage = parseInt(currentPageStr);
        const getItemsData = {
            wallet_id: defaultWallet._id,
            isoCode: chat.airtime.country_code,
            operator_id: chat?.airtime?.operator_id,
            serviceId: '1',
            subservice_id: subService,
            userId: chat.account._id
        };

        let productList = await getItemsFromSubServicesHelper(getItemsData);
        if (!productList.status) {
            // clearing the data
            chat.airtime = undefined;
            await chat.save();

            await sendMessage(chatId, lang[selectedLanguage].FETCH_PRODUCTS_ERROR);
            return;
        }
        productList = productList?.data.sort((a, b) => a.prices.amount - b.prices.amount);

        if (subService == 12 || subService == 13) {
            const numberOfProductsPerPage = 6;
            const startIndex = (currentPage - 1) * numberOfProductsPerPage;
            const endIndex = startIndex + numberOfProductsPerPage;

            const displayedProducts = productList.slice(startIndex, endIndex);

            let buttons = [];
            let productNames = displayedProducts.map((product, index) =>
                `${startIndex + index + 1}. ${product.name} || ${formattedAmount(product.prices.amount)} ${product.prices.unit}`
            ).join('\n');

            let selectMessage = subService == 12 ? lang[selectedLanguage].CHOOSE_BUNDLE_PACKAGE : lang[selectedLanguage].CHOOSE_DATA_PACKAGE;
            const message = `${selectMessage}\n\n${productNames}\n`;

            // Add product buttons
            displayedProducts.forEach((product, index) => {
                buttons.push([
                    {
                        text: (startIndex + index + 1).toString(),
                        callback_data: `airtime_card_product-${product.id}-bundle`
                    }
                ]);
            });

            // Add navigation buttons
            if (currentPage > 1) {
                buttons.unshift([
                    {
                        text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE,
                        callback_data: `airtime_card_prev_products-${currentPage - 1}-${subService}`
                    }
                ]);
            }

            if (productList.length > endIndex) {
                buttons.push([
                    {
                        text: lang[selectedLanguage].NEXT_BUTTON_TITLE,
                        callback_data: `airtime_card_next_products-${currentPage + 1}-${subService}`
                    }
                ]);
            }

            buttons.push([
                {
                    text: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                    callback_data: `main_menu`
                }
            ]);

            await sendButtons(chatId, message, buttons);
        } else {
            const numberOfProductsPerPage = 6;
            const startIndex = (currentPage - 1) * numberOfProductsPerPage;
            const endIndex = startIndex + numberOfProductsPerPage;

            const displayedProducts = productList.slice(startIndex, endIndex);

            let buttons = [];
            const message = lang[selectedLanguage].SELECT_AIRTIME_AMOUNT;

            // Add product buttons
            displayedProducts.forEach((product) => {
                buttons.push([
                    {
                        text: `${formattedAmount(product.prices.amount)} ${product.prices.unit}`,
                        callback_data: `airtime_card_product-${product.id}-fixed`
                    }
                ]);
            });

            // Add navigation buttons
            if (currentPage > 1) {
                buttons.unshift([
                    {
                        text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE,
                        callback_data: `airtime_card_prev_products-${currentPage - 1}-${subService}`
                    }
                ]);
            }

            if (productList.length > endIndex) {
                buttons.push([
                    {
                        text: lang[selectedLanguage].NEXT_BUTTON_TITLE,
                        callback_data: `airtime_card_next_products-${currentPage + 1}-${subService}`
                    }
                ]);
            }

            buttons.push([
                {
                    text: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                    callback_data: `main_menu`
                }
            ]);

            await sendButtons(chatId, message, buttons);
        }
    }

    // Handle "Previous" quick reply for products
    else if (payload?.includes("airtime_card_prev_products")) {
        const [_, currentPageStr, subService] = payload.split("-");
        let currentPage = parseInt(currentPageStr);
        const getItemsData = {
            wallet_id: defaultWallet._id,
            isoCode: chat.airtime.country_code,
            operator_id: chat?.airtime?.operator_id,
            serviceId: '1',
            subservice_id: subService,
            userId: chat.account._id
        };

        let productList = await getItemsFromSubServicesHelper(getItemsData);
        if (!productList.status) {
            // clearing the data
            chat.airtime = undefined;
            await chat.save();

            await somethingWentWrongQuickReplyTelegram(chatId, lang[selectedLanguage].FETCH_PRODUCTS_ERROR, selectedLanguage);
            return;
        }
        productList = productList?.data.sort((a, b) => a.prices.amount - b.prices.amount);

        if (subService == 12 || subService == 13) {
            const numberOfProductsPerPage = 6;
            const startIndex = (currentPage - 1) * numberOfProductsPerPage;
            const endIndex = startIndex + numberOfProductsPerPage;

            const displayedProducts = productList.slice(startIndex, endIndex);
            const productButtons = displayedProducts.map((product, index) => [
                {
                    text: (startIndex + index + 1).toString(),
                    callback_data: `airtime_card_product-${product.id}-bundle`
                }
            ]);

            let selectMessage = subService == 12 ? lang[selectedLanguage].CHOOSE_BUNDLE_PACKAGE : lang[selectedLanguage].CHOOSE_DATA_PACKAGE;
            let productNames = displayedProducts.map((product, index) => `${startIndex + index + 1}. ${product.name} || ${formattedAmount(product.prices.amount)} ${product.prices.unit}`).join('\n');
            const message = `${selectMessage}\n\n${productNames}\n`;

            let buttons = [...productButtons];

            if (currentPage > 1) {
                buttons.unshift([{
                    text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE,
                    callback_data: `airtime_card_prev_products-${currentPage - 1}-${subService}`
                }]);
            }

            if (productList.length > endIndex) {
                buttons.push([{
                    text: lang[selectedLanguage].NEXT_BUTTON_TITLE,
                    callback_data: `airtime_card_next_products-${currentPage + 1}-${subService}`
                }]);
                buttons.push([{
                    text: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                    callback_data: `main_menu`
                }]);
            } else {
                buttons.push([{
                    text: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                    callback_data: `main_menu`
                }]);
            }

            await sendButtons(chatId, message, buttons);
        } else {
            const numberOfProductsPerPage = 6;
            const startIndex = (currentPage - 1) * numberOfProductsPerPage;
            const endIndex = startIndex + numberOfProductsPerPage;

            const displayedProducts = productList.slice(startIndex, endIndex);
            const productButtons = displayedProducts.map((product) => [
                {
                    text: `${formattedAmount(product.prices.amount)} ${product.prices.unit}`,
                    callback_data: `airtime_card_product-${product.id}-fixed`
                }
            ]);

            let message = lang[selectedLanguage].SELECT_AIRTIME_AMOUNT;

            let buttons = [...productButtons];

            if (currentPage > 1) {
                buttons.unshift([{
                    text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE,
                    callback_data: `airtime_card_prev_products-${currentPage - 1}-${subService}`
                }]);
            }

            if (productList.length > endIndex) {
                buttons.push([{
                    text: lang[selectedLanguage].NEXT_BUTTON_TITLE,
                    callback_data: `airtime_card_next_products-${currentPage + 1}-${subService}`
                }]);
                buttons.push([{
                    text: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                    callback_data: `main_menu`
                }]);
            } else {
                buttons.push([{
                    text: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                    callback_data: `main_menu`
                }]);
            }

            await sendButtons(chatId, message, buttons);
        }
    }

    // User has typed airtime amount
    else if (chat?.last_message === "airtime_card_airtime-amount" && !payload && text) {
        const digitRegex = /^\d+(\.\d+)?$/;
        const isNumber = digitRegex.test(text);
        const amount = parseFloat(text);

        const getItemsData = {
            wallet_id: defaultWallet._id,
            isoCode: chat.airtime.country_code,
            operator_id: chat?.airtime?.operator_id,
            serviceId: '1',
            subservice_id: "11",
            userId: chat.account._id
        };

        let productList = await getItemsFromSubServicesHelper(getItemsData);
        if (!productList.status) {
            // clearing the data
            chat.airtime = undefined;
            await chat.save();

            await somethingWentWrongQuickReplyTelegram(chatId, lang[selectedLanguage].FETCH_PRODUCTS_ERROR, selectedLanguage);
            return;
        }

        const baseAmount = productList.data.baseAmount;
        const unit = productList.data.unit;

        if (isNumber && amount >= formatDecimalNumbersWithLimit(baseAmount.min, 2) && amount <= formatDecimalNumbersWithLimit(baseAmount.max, 2)) {
            const rangedRatesData = {
                product_id: productList.data.id,
                wallet_id: defaultWallet._id,
                local_wallet_id: defaultWallet._id,
                amount,
                sub_service_id: "11",
                payment_method: "card"
            };

            const rangedRates = await fetchRangedAirtimeRatesHelper(rangedRatesData);
            if (!rangedRates.status) {
                // clearing the data
                chat.airtime = undefined;
                await chat.save();

                await somethingWentWrongQuickReplyTelegram(chatId, lang[selectedLanguage].FETCH_PRODUCTS_ERROR, selectedLanguage);
                return;
            }

            chat.airtime.airtime_token = rangedRates.data.token;
            await chat.save();

            const rates = rangedRates.data;
            const message = `${lang[selectedLanguage].REVIEW_AIRTIME_DETAILS}
            
${lang[selectedLanguage].COUNTRY_LABEL}: ${chat.airtime.country ?? "N/A"}
${lang[selectedLanguage].OPERATOR}: ${chat.airtime.operator ?? "N/A"}
${lang[selectedLanguage].PHONE}: ${chat.airtime.phone_number}\n

${lang[selectedLanguage].SERVICE}: ${lang[selectedLanguage].AIRTIME}

${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value)} ${rates?.fee?.currency}
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(rates?.sending?.value)} ${rates?.sending?.currency}

${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(rates?.recipient?.value)} ${rates?.recipient?.currency}
${lang[selectedLanguage].TOTAL_COST} ${formattedAmount(rates?.total?.value)} ${rates?.total?.currency}
`;

            const buttons = [
                [{
                    text: lang[selectedLanguage].CONFIRM_PURCHASE,
                    callback_data: `airtime_card_confirm_purchase-ranged`
                }],
                [{
                    text: lang[selectedLanguage].MAIN_MENU,
                    callback_data: `main_menu`
                }]
            ];

            await sendButtons(chatId, message, buttons);
        }
        // else if amount is less than the minimum
        else if (amount < formatDecimalNumbersWithLimit(baseAmount.min, 2)) {
            await sendMessage(
                chatId,
                lang[selectedLanguage].ENTER_AMOUNT_MORE_THAN
                    .replace('{{amount}}', formattedAmount(formatDecimalNumbersWithLimit(baseAmount.min, 2)))
                    .replace('{{currency}}', unit)
            );
        }
        else if (amount > formatDecimalNumbersWithLimit(baseAmount.max, 2)) {
            await sendMessage(
                chatId,
                lang[selectedLanguage].ENTER_AMOUNT_LESS_THAN
                    .replace('{{amount}}', formattedAmount(formatDecimalNumbersWithLimit(baseAmount.max, 2)))
                    .replace('{{currency}}', unit)
            );
        } else {
            await sendMessage(chatId, lang[selectedLanguage].ENTER_AMOUNT_DIGITS);
        }
    }

    // user has selected airtime fixed amount or bundle
    else if (payload?.includes("airtime_card_product")) {
        console.log({ payload, text });
        const [_, productId, subService] = payload.split("-");
        console.log({ productId, subService });

        const productDetails = await fetchItemDetailsHelper({
            productId,
            walletId: defaultWallet._id
        });

        if (!productDetails.status) {
            // clearing the data
            chat.airtime = undefined;
            await chat.save();

            await sendMessage(chatId, lang[selectedLanguage].FETCH_PRODUCT_DETAILS_ERROR);
            return;
        }

        const getRatesData = {
            payment_method: "card",
            wallet_id: defaultWallet._id,
            sub_service_id: subService === "fixed" ? "11" : "12",
            local_wallet_id: defaultWallet._id,
            token: productDetails?.data?.token
        };

        console.log({ getRatesData }, subService === "11", subService);
        const rates = await getRatesHelper(getRatesData);

        console.log({ rates });
        if (!rates.status) {
            // clearing the data
            chat.airtime = undefined;
            await chat.save();

            await sendMessage(chatId, lang[selectedLanguage].FINDING_RATES_ERROR);
            return;
        }

        const actualRates = rates.data.converted;
        chat.airtime.airtime_token = rates?.data.token;
        await chat.save();

        console.log({ rates: rates.data.converted, ratess: rates.data });

        const message = `
${subService === "fixed" ? `${lang[selectedLanguage].REVIEW_FIXED_AIRTIME_DETAILS}` : `${lang[selectedLanguage].REVIEW_BUNDLE_DETAILS}`}\n
${lang[selectedLanguage].COUNTRY_LABEL}: ${chat.airtime.country ?? "N/A"}
${lang[selectedLanguage].OPERATOR}: ${chat.airtime.operator ?? "N/A"}
${lang[selectedLanguage].PHONE}: ${chat.airtime.phone_number}\n
${lang[selectedLanguage].SERVICE} ${subService === "fixed" ? lang[selectedLanguage].AIRTIME : lang[selectedLanguage].BUNDLE}
${subService !== "fixed" ? `\n${lang[selectedLanguage].BUNDLE_NAME}: ${productDetails?.data?.name}` : ""}
${subService !== "fixed" ? `\n${lang[selectedLanguage].BUNDLE_DESCRIPTION}: ${productDetails?.data?.description}\n` : ""}
${lang[selectedLanguage].BUNDLE_PRICE}: ${actualRates?.sending?.value} ${actualRates?.sending?.currency}
${lang[selectedLanguage].FEE}: ${actualRates?.fee?.value} ${actualRates?.fee?.currency}
${lang[selectedLanguage].TOTAL_COST} ${actualRates?.total?.value} ${actualRates?.total?.currency}`;

        const buttons = [
            [
                {
                    text: lang[selectedLanguage].CONFIRM_PURCHASE,
                    callback_data: `airtime_card_confirm_purchase-${subService === "fixed" ? "fixed" : "bundle"}`
                }
            ],
            [
                {
                    text: lang[selectedLanguage].MAIN_MENU,
                    callback_data: `main_menu`
                }
            ]
        ];

        await sendButtons(chatId, message, buttons);
    }
    // user has confirmed fixed airtime
    else if (payload?.includes("airtime_card_confirm_purchase")) {
        const airtimeType = payload.split("-")[1];
        await handleOTPGenerationTG(selectedLanguage, chat, `airtime_card_confirm_purchase-otp-${airtimeType}`, `airtime_card_confirm_purchase-otp-${airtimeType}`, "Transaction OTP");
    }

    // user has entered OTP
    else if (chat?.last_message?.includes("airtime_card_confirm_purchase-otp") && !payload && text) {
        const airtimeType = chat?.last_message?.split("-")[2];
        const otpValidationResult = await validateOTPTG(chatId, text, `airtime_card_confirm_purchase-otp-${airtimeType}`);
        console.log({ airtimeType }, chat?.last_message);

        if (otpValidationResult.status) {
            let decoded;
            try {
                decoded = jwt.verify(chat.airtime.airtime_token, process.env.jwtKey);
            } catch (err) {
                console.log(err);

                // clearing the data
                chat.airtime = undefined;
                await chat.save();

                const buttons = [
                    [
                        { text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }
                    ]
                ];

                await sendButtons(chatId, lang[selectedLanguage].CONFIRM_TRANSACTION_ERROR, buttons);
                return;
            }

            console.log({ decoded });

            const calculations = airtimeType === "ranged" ? decoded : decoded.converted;

            const { exp, ...restOfDecoded } = decoded; // destructure to exclude exp
            const payload = {
                ...restOfDecoded,
                wallet_id: defaultWallet._id,
                number: chat.airtime.phone_number
            };

            const token = jwt.sign(payload, process.env.jwtKey, { expiresIn: '10m' });

            const initiateTransaction = await initiateTopUpSavedCard(defaultWallet._id, parseFloat(calculations.total.value) * 100, chat.airtime.pan, token, airtimeType);

            console.log({ initiateTransaction });
            console.log(`https://my.insta-pay.ch/chatbot/pan-transaction?token=${initiateTransaction?.data?.token}&transaction_id=${initiateTransaction?.data?.transaction_id}&reference_id=${initiateTransaction?.data?.reference_id || "_"}&slug=confirm-chatbot-pan-airtime-topup-telegram`);

            if (initiateTransaction?.status) {
                const title = lang[selectedLanguage].VERIFY_CARD;
                const message = `
${title}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(calculations.total.value)} ${defaultWallet?.currency?.code}
            `;

                const buttons = [
                    [
                        {
                            text: lang[selectedLanguage].VERIFY,
                            url: `https://my.insta-pay.ch/chatbot/pan-transaction?token=${initiateTransaction?.data?.token}&transaction_id=${initiateTransaction?.data?.transaction_id}&reference_id=${initiateTransaction?.data?.reference_id || "_"}&slug=confirm-chatbot-pan-airtime-topup-telegram`
                        }
                    ],
                    [
                        { text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }
                    ]
                ];

                await sendButtons(chatId, message, buttons);
            } else {
                const buttons = [
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];
                await sendButtons(chatId, lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR, buttons);
            }

            // clearing the data
            chat.airtime = undefined;
            await chat.save();
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                // clearing the data
                chat.airtime = undefined;
                await chat.save();

                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessageTG(chatId, `airtime_card_confirm_purchase-otp-${airtimeType}`, selectedLanguage, chat?.otpType);
            }
        }
    }
}

module.exports = { airtimeCard }