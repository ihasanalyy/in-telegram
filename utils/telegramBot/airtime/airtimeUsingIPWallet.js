const { sendButtons, sendMessage, handleCountrySelection, invalidInputResponse, sendPhoto } = require("../../telegramBotUtils");
const lang = require("../../../utils/languages/languages.json");
const { getAvailableCountries, fetchCountriesFromThunes, getPayoutChannelName, searchUsersAndWallets, getDistinctObjects } = require("../../instaChatbotUtils");
const { getCountries, getPayerNames, numberVerificationAirtime, formattedAmount, getSubservices } = require("../../InstaChatbotHelpers");
const countries = require('../../../utils/countryIso.json');
const countryToEmoji = require('../../../utils/countryEmojis.json');
const PanModel = require("../../../models/Pan.model");
const currencyToEmoji = require('../../../utils/currencyEmojis.json');
const Wallet = require("../../../models/Wallet.model");
const { getItemsFromSubServicesHelper, fetchRangedAirtimeRatesHelper, getRatesHelper, fetchItemDetailsHelper, createTransactionRangedHelper, createTransactionFixedHelper } = require("../../dtOneHelpers");
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler");
const jwt = require("jsonwebtoken");
const { formatDecimalNumbersWithLimit } = require("../../payerRates");
async function airtimeIPWallet(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    if (payload === "airtime_ip") {
        const wallets = await Wallet.find({ account: chat.account?._id, wallet_type: 'insta', status: "active" });
        const slicedWallets = wallets.slice(0, 8);

        const buttons = slicedWallets.map((wallet) => [
            {
                text: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`,
                callback_data: `airtime_ip-${wallet._id}`,
            },
        ]);

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]);

        const message = lang[selectedLanguage].SELECT_WALLET_CURRENCY;
        await sendButtons(chatId, message, buttons, "airtime_ip_w");
    }

    // User has selected a wallet
    else if (payload?.startsWith("airtime_ip-") && chat?.last_message === "airtime_ip_w") {
        const walletId = payload.split("-")[1];
        const walletDetails = await Wallet.findById(walletId);
        chat.airtime.currency = walletId;
        await chat.save();

        const message = `${lang[selectedLanguage].CURRENTLY_HAVE.replace('{{amount}}', formattedAmount(walletDetails?.balance?.available)).replace('{{currency}}', walletDetails.currency.code)}\n\n${lang[selectedLanguage].PROCEED_OR_SELECT_WALLET}`;

        const buttons = [
            [{ text: lang[selectedLanguage].PROCEED_TITLE, callback_data: "airtime_ip_proceed" }],
            [{ text: lang[selectedLanguage].ANOTHER_WALLET_TITLE, callback_data: "airtime_ip" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, message, buttons, 'airtime_ip_proceed');
    }

    else if (payload === "airtime_ip_proceed" && chat?.last_message === "airtime_ip_proceed") {
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
                return [{ text: title, callback_data: `airtime_ip_service-${service.id}` }];
            });
            buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);

            await sendButtons(chatId, lang[selectedLanguage].SELECT_SERVICE, buttons, "airtime_ip_service");
        } else {
            await sendButtons(chatId, lang[selectedLanguage].NO_SERVICES_FOUND_MESSAGE,
                [[{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]], "4"
            );
        }
    }

    else if (payload?.includes("airtime_ip_service-") && chat?.last_message === "airtime_ip_service") {
        const subService = payload.split("-")[1];
        console.log(subService, "subService");

        const getItemsData = {
            wallet_id: chat?.airtime?.currency,
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
                callback_data: `airtime_ip_product-${product.id}-bundle`
            }]);

            let selectMessage = subService == 12 ? lang[selectedLanguage].CHOOSE_BUNDLE_PACKAGE : lang[selectedLanguage].CHOOSE_DATA_PACKAGE;
            let productNames = displayedProducts.map((product, index) => `${startIndex + index + 1}. ${product.name} || ${formattedAmount(product.prices.amount)} ${product.prices.unit}`).join('\n');
            const message = `${selectMessage}\n\n${productNames}\n`;

            if (currentPage > 1) {
                buttons.unshift([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: `airtime_ip_prev-${currentPage - 1}-${subService}` }]);
            }

            if (productList.length > endIndex) {
                buttons.push([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `airtime_ip_next-${currentPage + 1}-${subService}` }]);
            }

            buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: `main_menu` }]);

            await sendButtons(chatId, message, buttons, "airtime_ip_product");
        } else {
            if (Array.isArray(productList)) {
                const numberOfProductsPerPage = 6;
                let currentPage = 1;
                const startIndex = (currentPage - 1) * numberOfProductsPerPage;
                const endIndex = startIndex + numberOfProductsPerPage;

                const displayedProducts = productList.slice(startIndex, endIndex);
                const buttons = displayedProducts.map((product) => [{
                    text: `${formattedAmount(product.prices.amount)} ${product.prices.unit}`,
                    callback_data: `airtime_ip_product-${product.id}-fixed`
                }]);

                const message = lang[selectedLanguage].SELECT_AIRTIME_AMOUNT;

                if (currentPage > 1) {
                    buttons.unshift([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: `airtime_ip_prev-${currentPage - 1}-${subService}` }]);
                }

                if (productList.length > endIndex) {
                    buttons.push([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `airtime_ip_next-${currentPage + 1}-${subService}` }]);
                }

                buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: `main_menu` }]);

                await sendButtons(chatId, message, buttons, "airtime_ip_product");
            } else {
                const baseAmount = productList.baseAmount;
                const unit = productList.unit;

                await sendMessage(chatId, lang[selectedLanguage].enter_airtime_amount.replace('{{min_amount}}', formattedAmount((baseAmount?.min)) ?? "N/A")
                    .replace('{{max_amount}}', formattedAmount((baseAmount?.max)) ?? "N/A")
                    .replace(/{{currency}}/g, unit ?? "N/A"), "airtime_ip-amount"
                );
            }
        }
    }

    else if (payload?.startsWith("airtime_ip_next") && chat?.last_message === "airtime_ip_product") {
        const [_, currentPageStr, subService] = payload.split("-");
        let currentPage = parseInt(currentPageStr);
        const getItemsData = {
            wallet_id: chat?.airtime?.currency,
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
                { text: (startIndex + index + 1).toString(), callback_data: `airtime_ip_product-${product.id}-bundle` }
            ]);

        } else {
            buttons = displayedProducts.map((product) => [
                { text: `${formattedAmount(product.prices.amount)} ${product.prices.unit}`, callback_data: `airtime_ip_product-${product.id}-fixed` }
            ]);

            message = lang[selectedLanguage].SELECT_AIRTIME_AMOUNT;
        }

        if (currentPage > 1) {
            buttons.unshift([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: `airtime_ip_prev-${currentPage - 1}-${subService}` }]);
        }

        if (productList.length > endIndex) {
            buttons.push([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `airtime_ip_next-${currentPage + 1}-${subService}` }]);
        }

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);

        await sendButtons(chatId, message, buttons);
    }


    else if (payload?.includes("airtime_ip_prev") && chat?.last_message === "airtime_ip_product") {
        const [_, currentPageStr, subService] = payload.split("-");
        let currentPage = parseInt(currentPageStr);
        const getItemsData = {
            wallet_id: chat?.airtime?.currency,
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
                callback_data: `airtime_ip_product-${product.id}-bundle`
            }]));
        } else {
            message = lang[selectedLanguage].SELECT_AIRTIME_AMOUNT;

            buttons = displayedProducts.map((product) => ([{
                text: `${formattedAmount(product.prices.amount)} ${product.prices.unit}`,
                callback_data: `airtime_ip_product-${product.id}-fixed`
            }]));
        }

        if (currentPage > 1) {
            buttons.unshift([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: `airtime_ip_prev-${currentPage - 1}-${subService}` }]);
        }

        if (productList.length > endIndex) {
            buttons.push([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `airtime_ip_next-${currentPage + 1}-${subService}` }]);
        }

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: `main_menu` }]);

        await sendButtons(chatId, message, buttons);
    }

    else if (chat?.last_message === "airtime_ip-amount" && !payload && text) {
        const digitRegex = /^\d+(\.\d+)?$/;
        const isNumber = digitRegex.test(text);
        const amount = parseFloat(text);

        const getItemsData = {
            wallet_id: chat?.airtime?.currency,
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
            return sendMessage(chatId, lang[selectedLanguage].FETCH_PRODUCTS_ERROR, "4");
        }

        const baseAmount = productList.data.baseAmount;
        const unit = productList.data.unit;

        if (isNumber && amount >= formatDecimalNumbersWithLimit(baseAmount.min) && amount <= formatDecimalNumbersWithLimit(baseAmount.max)) {
            const walletDetails = await Wallet.findById(chat?.airtime?.currency);
            if (amount > walletDetails?.balance?.available) {
                return sendButtons(chatId, lang[selectedLanguage].INSUFFICIENT_BALANCE, [
                    { text: lang[selectedLanguage].ADD_FUNDS, callback_data: "add_funds" },
                    { text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }
                ]);
            }

            const rangedRatesData = {
                product_id: productList.data.id,
                wallet_id: chat?.airtime?.currency,
                local_wallet_id: chat?.airtime?.currency,
                amount,
                sub_service_id: "11",
                payment_method: "wallet"
            };
            const rangedRates = await fetchRangedAirtimeRatesHelper(rangedRatesData);
            if (!rangedRates.status) {
                chat.airtime = undefined;
                await chat.save();
                return sendMessage(chatId, lang[selectedLanguage].FETCH_PRODUCTS_ERROR, "4");
            }

            const rates = rangedRates.data;
            const totalValue = rates?.total?.value;

            if (totalValue > walletDetails?.balance?.available) {
                const message = `${lang[selectedLanguage].INSUFFICIENT_BALANCE}\n\n` +
                    `${lang[selectedLanguage].BALANCE_MESSAGE_PART1}: ${formattedAmount(walletDetails?.balance?.available)} ${walletDetails?.currency?.code}\n` +
                    `${lang[selectedLanguage].TOTAL_COST} ${formattedAmount(rates?.total?.value)} ${rates?.total?.currency}\n` +
                    `${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value)} ${rates?.fee?.currency}\n` +
                    `${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(rates?.sending?.value)} ${rates?.sending?.currency}\n` +
                    `${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(rates?.recipient?.value)} ${rates?.recipient?.currency}`;

                return await sendButtons(chatId, message, [
                    { text: lang[selectedLanguage].ADD_FUNDS, callback_data: "add_funds" },
                    { text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }
                ]);
            }

            chat.airtime.airtime_token = rates.token;
            await chat.save();

            const message = `${lang[selectedLanguage].REVIEW_AIRTIME_DETAILS}\n\n` +
                `${lang[selectedLanguage].TOTAL_COST} ${formattedAmount(rates?.total?.value)} ${rates?.total?.currency}\n` +
                `${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value)} ${rates?.fee?.currency}\n` +
                `${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(rates?.sending?.value)} ${rates?.sending?.currency}\n` +
                `${lang[selectedLanguage].SERVICE}: ${lang[selectedLanguage].AIRTIME}` +

                `\n${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(rates?.recipient?.value)} ${rates?.recipient?.currency}\n` +
                `${lang[selectedLanguage].COUNTRY_LABEL}: ${chat.airtime.country ?? "N/A"}\n
${lang[selectedLanguage].OPERATOR}: ${chat.airtime.operator ?? "N/A"}\n
${lang[selectedLanguage].PHONE}: ${chat.airtime.phone_number}`;

            return await sendButtons(chatId, message, [
                [{ text: lang[selectedLanguage].CONFIRM_PURCHASE, callback_data: `airtime_ip_confirm_purchase-ranged` }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ], "airtime_ip_confirm_purchase");
        }
        else if (amount < baseAmount.min) {
            return sendMessage(chatId, lang[selectedLanguage].ENTER_AMOUNT_MORE_THAN.replace('{{amount}}', baseAmount.min).replace('{{currency}}', unit));
        }
        else if (amount > baseAmount.max) {
            return sendMessage(chatId, lang[selectedLanguage].ENTER_AMOUNT_LESS_THAN.replace('{{amount}}', baseAmount.max).replace('{{currency}}', unit));
        } else {
            return sendMessage(chatId, lang[selectedLanguage].ENTER_AMOUNT_DIGITS);
        }
    }

    else if (payload && payload.startsWith("airtime_ip_product") && chat?.last_message === "airtime_ip_product") {
        console.log({ payload, text });
        const [_, productId, subService] = payload.split("-");
        console.log({ productId, subService });

        const productDetails = await fetchItemDetailsHelper({
            productId,
            walletId: chat?.airtime?.currency
        });

        if (!productDetails.status) {
            // Clearing the data
            chat.airtime = undefined;
            await chat.save();

            await sendMessage(chatId, lang[selectedLanguage].FETCH_PRODUCT_DETAILS_ERROR, "4");
            return;
        }

        const ratesData = {
            payment_method: "wallet",
            wallet_id: chat?.airtime?.currency,
            sub_service_id: subService === "fixed" ? "11" : "12",
            local_wallet_id: chat?.airtime?.currency,
            token: productDetails?.data?.token
        };

        const rates = await getRatesHelper(ratesData);

        if (!rates.status) {
            // Clearing the data
            chat.airtime = undefined;
            await chat.save();

            await sendMessage(chatId, lang[selectedLanguage].FINDING_RATES_ERROR, "4");
            return;
        }

        const actualRates = rates.data.converted;
        console.log(rates?.data.token, "rates?.data.token");
        chat.airtime.airtime_token = rates?.data.token;
        await chat.save();

        console.log({ rates: rates.data.converted, ratess: rates.data });

        // Fetch wallet details to check balance
        const walletDetails = await Wallet.findById(chat?.airtime?.currency);
        const availableBalance = walletDetails?.balance?.available || 0;
        const totalCost = actualRates?.total?.value || 0;

        let insufficientBalanceMessage = "";
        let buttons = [];

        if (availableBalance < totalCost) {
            insufficientBalanceMessage = `${lang[selectedLanguage].INSUFFICIENT_BALANCE.replace('{{amount}}', formattedAmount(availableBalance)).replace('{{currency}}', walletDetails.currency.code)}\n\n`;

            buttons = [
                [{ text: lang[selectedLanguage].ANOTHER_WALLET_TITLE, callback_data: "airtime_ip" }],
                [{ text: lang[selectedLanguage].CHANGE_PAYMENT_METHOD, callback_data: "airtime_confirm_number" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
        } else {
            buttons = [
                [{ text: lang[selectedLanguage].CONFIRM_PURCHASE, callback_data: `airtime_ip_confirm_purchase-${subService === "fixed" ? "fixed" : "bundle"}` }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
        }

        const message = `
${insufficientBalanceMessage}${subService === "fixed" ? lang[selectedLanguage].REVIEW_FIXED_AIRTIME_DETAILS : lang[selectedLanguage].REVIEW_BUNDLE_DETAILS}\n
${lang[selectedLanguage].COUNTRY_LABEL}: ${chat.airtime.country ?? "N/A"}
${lang[selectedLanguage].OPERATOR}: ${chat.airtime.operator ?? "N/A"}
${lang[selectedLanguage].PHONE}: ${chat.airtime.phone_number}\n
${lang[selectedLanguage].SERVICE} ${subService === "fixed" ? lang[selectedLanguage].AIRTIME : lang[selectedLanguage].BUNDLE}
${subService !== "fixed" ? `\n${lang[selectedLanguage].BUNDLE_NAME}: ${productDetails?.data?.name}` : ""}
${subService !== "fixed" ? `\n${lang[selectedLanguage].BUNDLE_DESCRIPTION}: ${productDetails?.data?.description}` : ""}
${lang[selectedLanguage].BUNDLE_PRICE}: ${formattedAmount(actualRates?.sending?.value)} ${actualRates?.sending?.currency}
${lang[selectedLanguage].FEE}: ${formattedAmount(actualRates?.fee?.value)} ${actualRates?.fee?.currency}
${lang[selectedLanguage].TOTAL_COST} ${formattedAmount(totalCost)} ${actualRates?.total?.currency}
   `;

        await sendButtons(chatId, message, buttons, "airtime_ip_confirm_purchase");
    }

    // User has confirmed fixed airtime
    if (payload?.startsWith("airtime_ip_confirm_purchase") && chat?.last_message === "airtime_ip_confirm_purchase") {
        const airtimeType = payload.split("-")[1];

        await handleOTPGenerationTG(
            selectedLanguage,
            chat,
            `airtime_ip_confirm_purchase-otp-${airtimeType}`,
            `airtime_ip_confirm_purchase-otp-${airtimeType}`,
            "Transaction OTP"
        );
    }

    // User has entered OTP
    else if (chat.last_message.includes("airtime_ip_confirm_purchase-otp") && text) {
        const airtimeType = chat.last_message.split("-")[2];
        const otpValidationResult = await validateOTPTG(chatId, text, `airtime_ip_confirm_purchase-otp-${airtimeType}`);

        console.log({ airtimeType }, chat.last_message);
        console.log({ otpValidationResult });

        if (otpValidationResult.status) {
            let decoded;
            try {
                decoded = jwt.verify(chat.airtime.airtime_token, process.env.jwtKey);
            } catch (err) {
                console.log(err);
                chat.airtime = undefined;
                await chat.save();
                return await sendMessage(chatId, lang[selectedLanguage].CONFIRM_TRANSACTION_ERROR, "4");
            }

            console.log({ decoded });

            let transactionResult;
            if (airtimeType === "ranged") {
                transactionResult = await createTransactionRangedHelper({
                    number: chat.airtime.phone_number,
                    decoded,
                    wallet_id: chat?.airtime?.currency
                });
            } else {
                transactionResult = await createTransactionFixedHelper({
                    number: chat.airtime.phone_number,
                    decoded,
                    wallet_id: chat?.airtime?.currency
                });
            }

            console.log({ transactionResult });

            if (!transactionResult.status) {
                chat.airtime = undefined;
                await chat.save();

                if (transactionResult.message?.includes("Insufficient")) {
                    return await sendMessage(chatId, lang[selectedLanguage].INSUFFICIENT_FUNDS_ERROR, "4");
                }
                return await sendMessage(chatId, lang[selectedLanguage].CONFIRM_TRANSACTION_ERROR, "4");
            }

            let title = lang[selectedLanguage].SUCCESSFUL_CHARGE.replace("{{number}}", chat?.airtime?.phone_number);
            let subtitle = `
${lang[selectedLanguage].TID} ${transactionResult.data.reference_id}
${lang[selectedLanguage].AMOUNT}: ${formattedAmount(decoded?.converted?.total?.value || decoded?.total?.value)} ${decoded?.converted?.total?.currency || decoded?.total?.currency}
${lang[selectedLanguage].BENEFICIARY}: ${decoded.recipient?.value || decoded.name}
        `;

            await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", title)
            await sendButtons(chatId, `${subtitle}`, [
                [{ text: "New Transaction", callback_data: "mobile_airtime" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ], "4");

            chat.airtime = undefined;
            await chat.save();
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessageTG(chatId, `airtime_ip_confirm_purchase-otp-${airtimeType}`, selectedLanguage, chat?.otpType);
            }
        }
    }




}

module.exports = { airtimeIPWallet }