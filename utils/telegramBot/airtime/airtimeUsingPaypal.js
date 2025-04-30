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
const { fetchLocalOrDefaultWalletConditionally } = require("../../helpers");

async function airtimePaypal(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(chat.account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReplyTelegram(chatId, lang[selectedLanguage].NO_DEFAULT_WALLET_SET, selectedLanguage);
    }
    if (payload === "airtime_paypal") {
        const getServiceData = {
            isoCode: chat.airtime.country_code,
            operator_id: chat.airtime.operator_id,
            serviceId: 1
        };

        const subServices = await getSubservices(getServiceData);

        if (subServices?.status) {
            const buttons = subServices.message.map(service => {
                let title;
                if (service.name.includes("Bundle")) {
                    title = lang[selectedLanguage].BUNDLE;
                } else if (service.name.includes("Airtime")) {
                    title = lang[selectedLanguage].AIRTIME;
                } else if (service.name.includes("Data")) {
                    title = lang[selectedLanguage].DATA_INTERNET;
                }
                return [{ text: title, callback_data: `airtime_paypal_service-${service.id}` }];
            });
            buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);

            await sendButtons(chatId, lang[selectedLanguage].SELECT_SERVICE, buttons, "airtime_paypal_service");
        } else {
            await sendButtons(chatId, lang[selectedLanguage].NO_SERVICES_FOUND_MESSAGE,
                [[{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]], "4"
            );
        }
    }

    else if (payload?.includes("airtime_paypal_service-") && chat?.last_message === "airtime_paypal_service") {
        const subService = payload.split("-")[1];
        console.log(subService, "subService");

        const getItemsData = {
            wallet_id: defaultWallet._id,
            isoCode: chat.airtime.country_code,
            operator_id: chat?.airtime?.operator_id,
            serviceId: '1',
            subservice_id: subService,
            userId: chat.account._id
        };

        let productList = await getItemsFromSubServicesHelper(getItemsData);
        console.log(productList, "productList");

        if (!productList.status) {
            chat.airtime = undefined;
            await chat.save();

            await sendMessage(chatId, lang[selectedLanguage].FETCH_PRODUCTS_ERROR, "4");
            return;
        }

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
            const buttons = displayedProducts.map((product, index) => [{
                text: `${(startIndex + index + 1).toString()}`,
                callback_data: `airtime_paypal_product-${product.id}-bundle`
            }]);

            let selectMessage = subService == 12 ? lang[selectedLanguage].CHOOSE_BUNDLE_PACKAGE : lang[selectedLanguage].CHOOSE_DATA_PACKAGE;
            let productNames = displayedProducts.map((product, index) => `${startIndex + index + 1}. ${product.name} || ${formattedAmount(product.prices.amount)} ${product.prices.unit}`).join('\n');
            const message = `${selectMessage}\n\n${productNames}\n`;

            if (currentPage > 1) {
                buttons.unshift([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: `airtime_paypal_prev-${currentPage - 1}-${subService}` }]);
            }

            if (productList.length > endIndex) {
                buttons.push([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `airtime_paypal_next-${currentPage + 1}-${subService}` }]);
            }

            buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: `main_menu` }]);

            await sendButtons(chatId, message, buttons, "airtime_paypal_product");
        } else {
            if (Array.isArray(productList)) {
                const numberOfProductsPerPage = 6;
                let currentPage = 1;
                const startIndex = (currentPage - 1) * numberOfProductsPerPage;
                const endIndex = startIndex + numberOfProductsPerPage;

                const displayedProducts = productList.slice(startIndex, endIndex);
                const buttons = displayedProducts.map((product) => [{
                    text: `${formattedAmount(product.prices.amount)} ${product.prices.unit}`,
                    callback_data: `airtime_paypal_product-${product.id}-fixed`
                }]);

                const message = lang[selectedLanguage].SELECT_AIRTIME_AMOUNT;

                if (currentPage > 1) {
                    buttons.unshift([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: `airtime_paypal_prev-${currentPage - 1}-${subService}` }]);
                }

                if (productList.length > endIndex) {
                    buttons.push([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `airtime_paypal_next-${currentPage + 1}-${subService}` }]);
                }

                buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: `main_menu` }]);

                await sendButtons(chatId, message, buttons, "airtime_paypal_product");
            } else {
                const baseAmount = productList.baseAmount;
                const unit = productList.unit;

                await sendMessage(chatId, lang[selectedLanguage].enter_airtime_amount.replace('{{min_amount}}', formattedAmount((baseAmount?.min)) ?? "N/A")
                    .replace('{{max_amount}}', formattedAmount((baseAmount?.max)) ?? "N/A")
                    .replace(/{{currency}}/g, unit ?? "N/A"), "airtime_paypal-amount"
                );
            }
        }
    }

    else if (payload?.startsWith("airtime_paypal_next") && chat?.last_message === "airtime_paypal_product") {
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
            // Clearing the data
            chat.airtime = undefined;
            await chat.save();

            await sendMessage(chatId, lang[selectedLanguage].FETCH_PRODUCTS_ERROR, "4");
            return;
        }

        productList = productList?.data.sort((a, b) => a.prices.amount - b.prices.amount);

        const numberOfProductsPerPage = 6;
        const startIndex = (currentPage - 1) * numberOfProductsPerPage;
        const endIndex = startIndex + numberOfProductsPerPage;
        const displayedProducts = productList.slice(startIndex, endIndex);

        let buttons = [];
        let message;
        if (subService == 12 || subService == 13) {
            let selectMessage = subService == 12 ? lang[selectedLanguage].CHOOSE_BUNDLE_PACKAGE : lang[selectedLanguage].CHOOSE_DATA_PACKAGE;
            let productNames = displayedProducts
                .map((product, index) => `${startIndex + index + 1}. ${product.name} || ${formattedAmount(product.prices.amount)} ${product.prices.unit}`)
                .join("\n");
            message = `${selectMessage}\n\n${productNames}\n`;

            buttons = displayedProducts.map((product, index) => [
                { text: (startIndex + index + 1).toString(), callback_data: `airtime_paypal_product-${product.id}-bundle` }
            ]);

        } else {
            buttons = displayedProducts.map((product) => [
                { text: `${formattedAmount(product.prices.amount)} ${product.prices.unit}`, callback_data: `airtime_paypal_product-${product.id}-fixed` }
            ]);

            message = lang[selectedLanguage].SELECT_AIRTIME_AMOUNT;
        }

        if (currentPage > 1) {
            buttons.unshift([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: `airtime_paypal_prev-${currentPage - 1}-${subService}` }]);
        }

        if (productList.length > endIndex) {
            buttons.push([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `airtime_paypal_next-${currentPage + 1}-${subService}` }]);
        }

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);

        await sendButtons(chatId, message, buttons);
    }

    else if (payload?.includes("airtime_paypal_prev") && chat?.last_message === "airtime_paypal_product") {
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
            // Clearing the data
            chat.airtime = undefined;
            await chat.save();

            await sendMessage(chatId, lang[selectedLanguage].FETCH_PRODUCTS_ERROR, "4");
            return;
        }
        productList = productList?.data.sort((a, b) => a.prices.amount - b.prices.amount);

        const numberOfProductsPerPage = 6;
        const startIndex = (currentPage - 1) * numberOfProductsPerPage;
        const endIndex = startIndex + numberOfProductsPerPage;
        const displayedProducts = productList.slice(startIndex, endIndex);

        let message = "";
        let buttons = [];

        if (subService == 12 || subService == 13) {
            message = subService == 12 ? lang[selectedLanguage].CHOOSE_BUNDLE_PACKAGE : lang[selectedLanguage].CHOOSE_DATA_PACKAGE;

            message += "\n\n" + displayedProducts.map((product, index) => `${startIndex + index + 1}. ${product.name} || ${formattedAmount(product.prices.amount)} ${product.prices.unit}`).join('\n');

            buttons = displayedProducts.map((product, index) => ([{
                text: `${startIndex + index + 1}`,
                callback_data: `airtime_paypal_product-${product.id}-bundle`
            }]));
        } else {
            message = lang[selectedLanguage].SELECT_AIRTIME_AMOUNT;

            buttons = displayedProducts.map((product) => ([{
                text: `${formattedAmount(product.prices.amount)} ${product.prices.unit}`,
                callback_data: `airtime_paypal_product-${product.id}-fixed`
            }]));
        }

        if (currentPage > 1) {
            buttons.unshift([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: `airtime_paypal_prev-${currentPage - 1}-${subService}` }]);
        }

        if (productList.length > endIndex) {
            buttons.push([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `airtime_paypal_next-${currentPage + 1}-${subService}` }]);
        }

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: `main_menu` }]);

        await sendButtons(chatId, message, buttons);
    }

    else if (chat.last_message === "airtime_paypal-amount" && text) {
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
            chat.airtime = undefined;
            await chat.save();
            await sendMessage(chatId, lang[selectedLanguage].FETCH_PRODUCTS_ERROR);
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
                payment_method: "paypal"
            };

            const rangedRates = await fetchRangedAirtimeRatesHelper(rangedRatesData);
            if (!rangedRates.status) {
                chat.airtime = undefined;
                await chat.save();
                await sendMessage(chatId, lang[selectedLanguage].FETCH_PRODUCTS_ERROR);
                return;
            }

            chat.airtime.airtime_token = rangedRates.data.token;
            await chat.save();

            const rates = rangedRates.data;
            const message = `${lang[selectedLanguage].REVIEW_AIRTIME_DETAILS}\n\n` +
                `${lang[selectedLanguage].COUNTRY_LABEL}: ${chat.airtime.country ?? "N/A"}\n` +
                `${lang[selectedLanguage].OPERATOR}: ${chat.airtime.operator ?? "N/A"}\n` +
                `${lang[selectedLanguage].PHONE}: ${chat.airtime.phone_number}\n\n` +
                `${lang[selectedLanguage].SERVICE}: ${lang[selectedLanguage].AIRTIME}\n\n` +
                `${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value)} ${rates?.fee?.currency}\n` +
                `${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(rates?.sending?.value)} ${rates?.sending?.currency}\n\n` +
                `${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(rates?.recipient?.value)} ${rates?.recipient?.currency}\n` +
                `${lang[selectedLanguage].TOTAL_COST} ${formattedAmount(rates?.total?.value)} ${rates?.total?.currency}`;

            let paypalMessage = "";
            if (!rates?.paypal?.paypal_currency_supported) {
                paypalMessage = `\n${lang[selectedLanguage].PAYPAL_CURRENCY_NOT_SUPPORTED.replace('{{currency}}', rates?.sending?.currency)}\n` +
                    `${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${rates?.sending?.currency} = ${formattedAmount(rates?.paypal?.paypal_rate.value, 6)} ${rates?.paypal?.paypal_rate.currency}\n` +
                    `${lang[selectedLanguage].AMOUNT_IN_USD}: ${formattedAmount(rates?.paypal?.paypal_converted.value)} ${rates?.paypal?.paypal_converted.currency}`;
            }

            const buttons = [
                [{ text: lang[selectedLanguage].CONFIRM_PURCHASE, callback_data: "airtime_paypal_confirm-ranged" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];

            if (paypalMessage) {
                await sendMessage(chatId, message);
                await sendButtons(chatId, paypalMessage, buttons);
            } else {
                await sendButtons(chatId, message, buttons);
            }
        }
        else if (amount < formatDecimalNumbersWithLimit(baseAmount.min, 2)) {
            await sendMessage(chatId, lang[selectedLanguage].ENTER_AMOUNT_MORE_THAN.replace('{{amount}}', formattedAmount(formatDecimalNumbersWithLimit(baseAmount.min, 2))).replace('{{currency}}', unit));
        }
        else if (amount > formatDecimalNumbersWithLimit(baseAmount.max, 2)) {
            await sendMessage(chatId, lang[selectedLanguage].ENTER_AMOUNT_LESS_THAN.replace('{{amount}}', formattedAmount(formatDecimalNumbersWithLimit(baseAmount.max, 2))).replace('{{currency}}', unit));
        }
        else {
            await sendMessage(chatId, lang[selectedLanguage].ENTER_AMOUNT_DIGITS);
        }
    }

    if (payload?.includes("airtime_paypal_product") && chat?.last_message === "airtime_paypal_product") {
        console.log({ payload, text });
        const [_, productId, subService] = payload.split("-");
        console.log({ productId, subService });

        const productDetails = await fetchItemDetailsHelper({
            productId,
            walletId: defaultWallet._id
        });

        if (!productDetails.status) {
            chat.airtime = undefined;
            await chat.save();

            await sendMessage(chatId, lang[selectedLanguage].FETCH_PRODUCT_DETAILS_ERROR);
            return;
        }

        const getRatesData = {
            payment_method: "paypal",
            wallet_id: defaultWallet._id,
            sub_service_id: subService === "fixed" ? "11" : "12",
            local_wallet_id: defaultWallet._id,
            token: productDetails?.data?.token
        };

        console.log({ getRatesData }, subService === "11", subService);
        const rates = await getRatesHelper(getRatesData);

        console.log({ rates });

        if (!rates.status) {
            chat.airtime = undefined;
            await chat.save();

            await sendMessage(chatId, lang[selectedLanguage].FINDING_RATES_ERROR);
            return;
        }

        const actualRates = rates.data.converted;
        console.log(actualRates.paypal, "rates?.data.token");

        chat.airtime.airtime_token = rates?.data.token;
        await chat.save();

        console.log({ rates: rates.data.converted, ratess: rates.data });

        const message = `
    ${subService === "fixed" ? `${lang[selectedLanguage].REVIEW_FIXED_AIRTIME_DETAILS}` : `${lang[selectedLanguage].REVIEW_BUNDLE_DETAILS}`}\n
    ${lang[selectedLanguage].COUNTRY_LABEL}: ${chat.airtime.country ?? "N/A"}
    ${lang[selectedLanguage].OPERATOR}: ${chat.airtime.operator ?? "N/A"}
    ${lang[selectedLanguage].PHONE}: ${chat.airtime.phone_number}\n
    ${lang[selectedLanguage].SERVICE} ${subService === "fixed" ? lang[selectedLanguage].AIRTIME : "Bundle"}
    ${subService !== "fixed" ? `\n${lang[selectedLanguage].BUNDLE_NAME}: ${productDetails?.data?.name}` : ""}
    ${subService !== "fixed" ? `\n${lang[selectedLanguage].BUNDLE_DESCRIPTION}: ${productDetails?.data?.description}\n` : ""}
    ${lang[selectedLanguage].BUNDLE_PRICE}: ${formattedAmount(actualRates?.sending?.value)} ${actualRates?.sending?.currency}
    ${lang[selectedLanguage].FEE}: ${formattedAmount(actualRates?.fee?.value)} ${actualRates?.fee?.currency}
    ${lang[selectedLanguage].TOTAL_COST}: ${formattedAmount(actualRates?.total?.value)} ${actualRates?.total?.currency}`;

        let paypalMessage = "";

        if (!actualRates?.paypal?.paypal_currency_supported) {
            paypalMessage = `
    ${lang[selectedLanguage].PAYPAL_CURRENCY_NOT_SUPPORTED.replace('{{currency}}', actualRates?.sending?.currency)}\n
    ${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${actualRates?.sending?.currency} = ${formattedAmount(actualRates?.paypal?.paypal_rate.value, 6)} ${actualRates?.paypal?.paypal_rate.currency}\n
    ${lang[selectedLanguage].AMOUNT_IN_USD}: ${formattedAmount(actualRates?.paypal?.paypal_converted.value)} ${actualRates?.paypal?.paypal_converted.currency}
    `;
        }

        const buttons = [
            [{ text: lang[selectedLanguage].CONFIRM_PURCHASE, callback_data: `airtime_paypal_confirm-${subService === "fixed" ? "fixed" : "bundle"}` }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        if (paypalMessage) {
            await sendMessage(chatId, message);
            await sendButtons(chatId, paypalMessage, buttons);
        } else {
            await sendButtons(chatId, message, buttons);
        }
    }
    // user has confirmed fixed airtime
    else if (payload?.includes("airtime_paypal_confirm")) {
        const airtimeType = payload.split("-")[1];
        await handleOTPGenerationTG(selectedLanguage, chat, `airtime_paypal_confirm-otp-${airtimeType} `, `airtime_paypal_confirm-otp-${airtimeType}`, "Transaction OTP");
    }

    // User has entered OTP
    if (chat.last_message?.includes("airtime_paypal_confirm-otp") && !payload && text) {
        const airtimeType = chat.last_message.split("-")[2];
        const otpValidationResult = await validateOTPTG(chatId, text, `airtime_paypal_confirm-otp-${airtimeType}`);

        console.log({ airtimeType }, chat.last_message);
        console.log({ otpValidationResult });

        if (otpValidationResult.status) {
            let decoded;
            try {
                decoded = jwt.verify(chat.airtime.airtime_token, process.env.jwtKey);
            } catch (err) {
                console.log(err);

                // Clearing the data
                chat.airtime = undefined;
                await chat.save();

                return await sendMessage(chatId, lang[selectedLanguage].CONFIRM_TRANSACTION_ERROR);
            }

            console.log({ decoded });

            const paypalDetails = airtimeType === "ranged" ? decoded.paypal : decoded.converted.paypal;

            if (airtimeType === "ranged") {
                const initiateData = {
                    number: chat.airtime.phone_number,
                    token: chat.airtime.airtime_token,
                    wallet_id: defaultWallet._id,
                };
                const initiateRangedAirtime = await initiateAirtimePaypalTransactionHelper(initiateData);

                if (initiateRangedAirtime?.status) {
                    const message = `
${lang[selectedLanguage].VERIFY_PAYPAL_ACCOUNT}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(paypalDetails?.paypal_currency_supported ? decoded?.total.value : paypalDetails?.paypal_converted.value)} ${paypalDetails?.paypal_currency_supported ? defaultWallet?.currency?.code : paypalDetails?.paypal_converted.currency}
                `;

                    const buttons = [
                        [{ text: lang[selectedLanguage].VERIFY, url: initiateRangedAirtime.url }],
                        [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                    ];

                    await sendButtons(chatId, message, buttons);
                }
            } else if (airtimeType === "fixed" || airtimeType === "bundle") {
                const initiateData = {
                    number: chat.airtime.phone_number,
                    token: chat.airtime.airtime_token,
                    wallet_id: defaultWallet._id,
                };
                const initiateFixedAirtime = await initiateAirtimeFixedPaypalTransactionHelper(initiateData);

                if (initiateFixedAirtime?.status) {
                    const message = `
${lang[selectedLanguage].VERIFY_PAYPAL_ACCOUNT}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(paypalDetails?.paypal_currency_supported ? decoded.converted.total.value : paypalDetails?.paypal_converted.value)} ${paypalDetails?.paypal_currency_supported ? defaultWallet?.currency?.code : paypalDetails?.paypal_converted.currency}
                `;

                    const buttons = [
                        [{ text: lang[selectedLanguage].VERIFY, url: initiateFixedAirtime.url }],
                        [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                    ];

                    await sendButtons(chatId, message, buttons);
                }

                return console.log({ initiateFixedAirtime });
            }
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                // Clearing the data
                chat.airtime = undefined;
                await chat.save();

                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessageTG(chatId, `airtime_paypal_confirm-otp-${airtimeType}`, selectedLanguage, chat?.otpType);
            }
        }
    }


}

module.exports = { airtimePaypal }