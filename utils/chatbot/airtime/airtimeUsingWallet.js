const { quickMessage, quickReply, sendTemplate, somethingWentWrongQuickReply } = require("../../instaChatbotUtils");
const currencyToEmoji = require('../../currencyEmojis.json');
const lang = require('../../languages/languages.json');
const PanModel = require("../../../models/Pan.model");
const Wallet = require("../../../models/Wallet.model");
const jwt = require('jsonwebtoken');
const { getSubservices, formattedAmount } = require("../../InstaChatbotHelpers");
const { getItemsFromSubServicesHelper, fetchItemDetailsHelper, getRatesHelper, createTransactionRangedHelper, createTransactionFixedHelper, fetchRangedAirtimeRatesHelper } = require("../../dtOneHelpers");
const { handleOTPGeneration, invalidMessage, validateOTP } = require("../../instaChatbotOTP");
const { formatDecimalNumbersWithLimit } = require("../../payerRates");
const secretKey = process.env.jwtKey;

async function handleAirtimeUsingW2W(senderId, payload, account, bot, text, selectedLanguage) {
    console.log({ senderId, payload, account, bot, text });

    const data = {
        sender: {
            id: senderId
        }
    }
    if (payload === "airtm_confirm_number") {

        const pans = await PanModel.find({ account: account._id });

        if (pans.length !== 0) {
            const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].PAYMENT_CARD, payload: "airtime_card_flow" },
                { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "airtime_wallets_flow_wallets" },
                { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "airtime_paypal_flow" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
            ]

            await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");

        } else {
            const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "airtime_wallets_flow_wallets" },
                { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "airtime_paypal_flow" },
                { content_type: "text", title: lang[selectedLanguage].ADD_PAYMENT_CARD, payload: "add_payment_card-airtm_confirm_number" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
            ]

            await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");

        }
    } else if (payload === "airtime_wallets_flow_wallets") {
        const wallets = await Wallet.find({ account: account?._id, wallet_type: 'insta', status: "active" });
        const slicedWallets = wallets.slice(0, 8)

        const quickReplies = slicedWallets?.map((wallet) => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `airtime_wallets_flow_wallet-${wallet._id}` } })
        quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" })

        const message = lang[selectedLanguage].SELECT_WALLET_CURRENCY;
        await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
    }
    // user has selected a wallet
    else if (payload?.startsWith("airtime_wallets_flow_wallet-")) {
        const walletId = payload.split("-")[1];
        const walletDetails = await Wallet.findById(walletId);
        bot.mobile_airtime.currency = walletId
        await bot.save()

        const message = `${lang[selectedLanguage].CURRENTLY_HAVE.replace('{{amount}}', formattedAmount(walletDetails?.balance?.available)).replace('{{currency}}', walletDetails.currency.code)}\n\n${lang[selectedLanguage].PROCEED_OR_SELECT_WALLET}`;

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].PROCEED_TITLE, payload: "airtime_wallets_flow_wallets_proceed" },
            { content_type: "text", title: lang[selectedLanguage].ANOTHER_WALLET_TITLE, payload: "airtime_wallets_flow_wallets" },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
        ]

        await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
    }
    // user has proceeded the selected currency
    else if (payload === "airtime_wallets_flow_wallets_proceed") {
        const getServiceData = {
            isoCode: bot.mobile_airtime.country_code,
            operator_id: bot.mobile_airtime.operator_id,
            serviceId: 1
        }
        console.log(getServiceData, "getServiceDataingetsubservices")
        const subServices = await getSubservices(getServiceData)
        console.log(subServices, "subServices")
        if (subServices?.status) {
            const quickReplies = subServices?.message?.map(service => {
                let title;
                if (service.name.includes("Bundle")) {
                    title = lang[selectedLanguage].BUNDLE;
                } else if (service.name.includes("Airtime")) {
                    title = lang[selectedLanguage].AIRTIME;
                } else if (service.name.includes("Data")) {
                    title = lang[selectedLanguage].DATA_INTERNET;
                }
                return { content_type: "text", title: title, payload: `airtime_wallets_flow_service-${service.id}` };
            });
            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` });
            // bot.mobile_airtime.operator_id = numberDetails.message[0]?.id
            // await bot.save()
            await quickReply({ sender: { id: senderId } }, lang[selectedLanguage].SELECT_SERVICE, quickReplies);
        } else {
            const quickReplies = [{ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` }];
            await quickReply({ sender: { id: senderId } }, lang[selectedLanguage].NO_SERVICES_FOUND_MESSAGE, quickReplies, "4");
        }
    }

    else if (payload?.includes("airtime_wallets_flow_service-")) {
        const subService = payload.split("-")[1];
        console.log(subService, "subService");

        const getItemsData = {
            wallet_id: bot?.mobile_airtime?.currency,
            isoCode: bot.mobile_airtime.country_code,
            operator_id: bot?.mobile_airtime?.operator_id,
            serviceId: '1',
            subservice_id: subService,
            userId: account._id
        };

        let productList = await getItemsFromSubServicesHelper(getItemsData);
        console.log(productList, "productList");

        if (!productList.status) {

            // clearing the data
            bot.mobile_airtime = undefined
            await bot.save()

            console.log(data, "data")
            await somethingWentWrongQuickReply(data, lang[selectedLanguage].FETCH_PRODUCTS_ERROR);
            return
        }

        // if productList.data is not an array then we will not sort else will sort
        if (Array.isArray(productList?.data)) {
            productList = productList?.data.sort((a, b) => a.prices.amount - b.prices.amount);
        } else {
            productList = productList?.data
        }

        if (subService == 12 || subService == 13) {
            const numberOfProductsPerPage = 6;
            let currentPage = 1;
            const startIndex = (currentPage - 1) * numberOfProductsPerPage;
            const endIndex = startIndex + numberOfProductsPerPage;

            const displayedProducts = productList.slice(startIndex, endIndex);
            const productIndexList = displayedProducts.map((product, index) => ({
                content_type: "text",
                title: `${(startIndex + index + 1).toString()}`,
                payload: `airtime_wallets_flow_product-${product.id}-bundle`
            }));

            let selectMessage = subService == 12 ? lang[selectedLanguage].CHOOSE_BUNDLE_PACKAGE : lang[selectedLanguage].CHOOSE_DATA_PACKAGE;
            let productNames = displayedProducts.map((product, index) => `${startIndex + index + 1}. ${product.name} || ${formattedAmount(product.prices.amount)} ${product.prices.unit}`).join('\n');
            const message = `${selectMessage}\n\n${productNames}\n`;

            let quickReplies = [
                ...productIndexList,
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` }
            ];

            if (currentPage > 1) {
                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `airtime_wallets_flow_prev_products-${currentPage - 1}-${subService}` });
            }

            if (productList.length > endIndex) {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `airtime_wallets_flow_next_products-${currentPage + 1}-${subService}` });
            }

            await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
        } else {
            if (Array.isArray(productList)) {
                const numberOfProductsPerPage = 6;
                let currentPage = 1;
                const startIndex = (currentPage - 1) * numberOfProductsPerPage;
                const endIndex = startIndex + numberOfProductsPerPage;

                const displayedProducts = productList.slice(startIndex, endIndex);
                const productIndexList = displayedProducts.map((product, index) => ({
                    content_type: "text",
                    title: `${formattedAmount(product.prices.amount)} ${product.prices.unit}`,
                    payload: `airtime_wallets_flow_product-${product.id}-fixed`
                }));

                const message = lang[selectedLanguage].SELECT_AIRTIME_AMOUNT
                let quickReplies = [
                    ...productIndexList,
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` }
                ];

                if (currentPage > 1) {
                    quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `airtime_wallets_flow_prev_products-${currentPage - 1}-${subService}` });
                }

                if (productList.length > endIndex) {
                    quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `airtime_wallets_flow_next_products-${currentPage + 1}-${subService}` });
                }

                await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
            } else {

                console.log({ asd: productList })
                const baseAmount = productList.baseAmount
                const unit = productList.unit

                await quickMessage({ sender: { id: senderId } },
                    lang[selectedLanguage].enter_airtime_amount
                        .replace('{{min_amount}}', formattedAmount((baseAmount?.min)) ?? "N/A")
                        .replace('{{max_amount}}', formattedAmount((baseAmount?.max)) ?? "N/A")
                        .replace(/{{currency}}/g, unit ?? "N/A"),
                    "airtime_wallets_flow_airtime-amount");
            }

        }
    }


    // Handle "Next" quick reply for products
    else if (payload?.includes("airtime_wallets_flow_next_products")) {
        const [_, currentPageStr, subService] = payload.split("-");
        let currentPage = parseInt(currentPageStr);
        const getItemsData = {
            wallet_id: bot?.mobile_airtime?.currency,
            isoCode: bot.mobile_airtime.country_code,
            operator_id: bot?.mobile_airtime?.operator_id,
            serviceId: '1',
            subservice_id: subService,
            userId: account._id
        };

        let productList = await getItemsFromSubServicesHelper(getItemsData);
        if (!productList.status) {

            // clearing the data
            bot.mobile_airtime = undefined
            await bot.save()

            await somethingWentWrongQuickReply(data, lang[selectedLanguage].FETCH_PRODUCTS_ERROR);
            return
        }
        productList = productList?.data.sort((a, b) => a.prices.amount - b.prices.amount);

        if (subService == 12 || subService == 13) {
            const numberOfProductsPerPage = 6;
            const startIndex = (currentPage - 1) * numberOfProductsPerPage;
            const endIndex = startIndex + numberOfProductsPerPage;

            const displayedProducts = productList.slice(startIndex, endIndex);
            const productIndexList = displayedProducts.map((product, index) => ({
                content_type: "text",
                title: (startIndex + index + 1).toString(),
                payload: `airtime_wallets_flow_product-${product.id}-bundle`
            }));

            let selectMessage = subService == 12 ? lang[selectedLanguage].CHOOSE_BUNDLE_PACKAGE : lang[selectedLanguage].CHOOSE_DATA_PACKAGE;
            let productNames = displayedProducts.map((product, index) => `${startIndex + index + 1}. ${product.name} || ${formattedAmount(product.prices.amount)} ${product.prices.unit}`).join('\n');
            const message = `${selectMessage}\n\n${productNames}\n`;

            let quickReplies = [
                ...productIndexList,
            ];

            if (currentPage > 1) {
                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `airtime_wallets_flow_prev_products-${currentPage - 1}-${subService}` });
            }

            if (productList.length > endIndex) {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `airtime_wallets_flow_next_products-${currentPage + 1}-${subService}` });
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` });
            } else {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` });
            }

            await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
        } else {

            const numberOfProductsPerPage = 6;
            const startIndex = (currentPage - 1) * numberOfProductsPerPage;
            const endIndex = startIndex + numberOfProductsPerPage;

            const displayedProducts = productList.slice(startIndex, endIndex);

            const productIndexList = displayedProducts.map((product, index) => ({
                content_type: "text",
                title: `${formattedAmount(product.prices.amount)} ${product.prices.unit}`,
                payload: `airtime_wallets_flow_product-${product.id}-fixed`
            }));

            let message = lang[selectedLanguage].SELECT_AIRTIME_AMOUNT
            let quickReplies = [
                ...productIndexList,
            ];

            if (currentPage > 1) {
                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `airtime_wallets_flow_prev_products-${currentPage - 1}-${subService}` });
            }

            if (productList.length > endIndex) {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `airtime_wallets_flow_next_products-${currentPage + 1}-${subService}` });
            }
            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` });

            await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
        }

    }

    // Handle "Previous" quick reply for products
    else if (payload?.includes("airtime_wallets_flow_prev_products")) {
        const [_, currentPageStr, subService] = payload.split("-");
        let currentPage = parseInt(currentPageStr);
        const getItemsData = {
            wallet_id: bot?.mobile_airtime?.currency,
            isoCode: bot.mobile_airtime.country_code,
            operator_id: bot?.mobile_airtime?.operator_id,
            serviceId: '1',
            subservice_id: subService,
            userId: account._id
        };

        let productList = await getItemsFromSubServicesHelper(getItemsData);
        if (!productList.status) {

            // clearing the data
            bot.mobile_airtime = undefined
            await bot.save()

            await somethingWentWrongQuickReply(data, lang[selectedLanguage].FETCH_PRODUCTS_ERROR);
            return
        }
        productList = productList?.data.sort((a, b) => a.prices.amount - b.prices.amount);

        if (subService == 12 || subService == 13) {
            const numberOfProductsPerPage = 6;
            const startIndex = (currentPage - 1) * numberOfProductsPerPage;
            const endIndex = startIndex + numberOfProductsPerPage;

            const displayedProducts = productList.slice(startIndex, endIndex);
            const productIndexList = displayedProducts.map((product, index) => ({
                content_type: "text",
                title: (startIndex + index + 1).toString(),
                payload: `airtime_wallets_flow_product-${product.id}-bundle`
            }));

            let selectMessage = subService == 12 ? lang[selectedLanguage].CHOOSE_BUNDLE_PACKAGE : lang[selectedLanguage].CHOOSE_DATA_PACKAGE;
            let productNames = displayedProducts.map((product, index) => `${startIndex + index + 1}. ${product.name} || ${formattedAmount(product.prices.amount)} ${product.prices.unit}`).join('\n');
            const message = `${selectMessage}\n\n${productNames}\n`;

            let quickReplies = [
                ...productIndexList,
            ];

            if (currentPage > 1) {
                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `airtime_wallets_flow_prev_products-${currentPage - 1}-${subService}` });
            }

            if (productList.length > endIndex) {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `airtime_wallets_flow_next_products-${currentPage + 1}-${subService}` });
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` });
            } else {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` });
            }

            await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
        } else {
            const numberOfProductsPerPage = 6;
            const startIndex = (currentPage - 1) * numberOfProductsPerPage;
            const endIndex = startIndex + numberOfProductsPerPage;

            const displayedProducts = productList.slice(startIndex, endIndex);

            const productIndexList = displayedProducts.map((product, index) => ({
                content_type: "text",
                title: `${formattedAmount(product.prices.amount)} ${product.prices.unit}`,
                payload: `airtime_wallets_flow_product-${product.id}-fixed`
            }));

            let message = lang[selectedLanguage].SELECT_AIRTIME_AMOUNT
            let quickReplies = [
                ...productIndexList,
            ];

            if (currentPage > 1) {
                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `airtime_wallets_flow_prev_products-${currentPage - 1}-${subService}` });
            }

            if (productList.length > endIndex) {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `airtime_wallets_flow_next_products-${currentPage + 1}-${subService}` });
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` });
            } else {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` });
            }

            await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
        }
    }

    // user has typed airtime amount
    else if (bot?.last_message === "airtime_wallets_flow_airtime-amount" && !payload && text) {
        const digitRegex = /^\d+(\.\d+)?$/;
        const isNumber = digitRegex.test(text)
        const amount = parseFloat(text);

        const getItemsData = {
            wallet_id: bot?.mobile_airtime?.currency,
            isoCode: bot.mobile_airtime.country_code,
            operator_id: bot?.mobile_airtime?.operator_id,
            serviceId: '1',
            subservice_id: "11",
            userId: account._id
        };

        let productList = await getItemsFromSubServicesHelper(getItemsData);
        if (!productList.status) {

            // clearing the data
            bot.mobile_airtime = undefined
            await bot.save()

            await somethingWentWrongQuickReply(data, lang[selectedLanguage].FETCH_PRODUCTS_ERROR);
            return
        }
        console.log(productList, "productList");
        const baseAmount = productList.data.baseAmount
        const unit = productList.data.unit

        if (isNumber && amount >= formatDecimalNumbersWithLimit(baseAmount.min, 2) && amount <= formatDecimalNumbersWithLimit(baseAmount.max, 2)) {
            const walletDetails = await Wallet.findById(bot?.mobile_airtime?.currency)
            if (amount > walletDetails?.balance?.available) {
                const quickReplies = [
                    // { content_type: "text", title: lang[selectedLanguage].CHANGE_PAYMENT_METHOD, payload: "wallet_to_wallet_yes" },
                    { content_type: "text", title: lang[selectedLanguage].ADD_FUNDS, payload: "add_funds" },
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                ]
                await quickReply(data, lang[selectedLanguage].INSUFFICIENT_BALANCE, quickReplies);
            } else {
                const rangedRatesData = {
                    product_id: productList.data.id,
                    wallet_id: bot?.mobile_airtime?.currency,
                    local_wallet_id: bot?.mobile_airtime?.currency,
                    amount,
                    sub_service_id: "11",
                    payment_method: "wallet"
                }
                const rangedRates = await fetchRangedAirtimeRatesHelper(rangedRatesData)
                if (!rangedRates.status) {

                    // clearing the data
                    bot.mobile_airtime = undefined
                    await bot.save()

                    await somethingWentWrongQuickReply(data, lang[selectedLanguage].FETCH_PRODUCTS_ERROR);
                    return
                }

                const rates = rangedRates.data

                const totalValue = rates?.total?.value;

                // if total amount is exceeding the balance
                if (totalValue > walletDetails?.balance?.available) {
                    const quickReplies = [
                        { content_type: "text", title: lang[selectedLanguage].ADD_FUNDS, payload: "add_funds" },
                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                    ]

                    const message = `${lang[selectedLanguage].INSUFFICIENT_BALANCE}
                
${lang[selectedLanguage].BALANCE_MESSAGE_PART1}: ${formattedAmount(walletDetails?.balance?.available)} ${walletDetails?.currency?.code}
${lang[selectedLanguage].TOTAL_COST} ${formattedAmount(rates?.total?.value)} ${rates?.total?.currency}
${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value)} ${rates?.fee?.currency}
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(rates?.sending?.value)} ${rates?.sending?.currency}
${lang[selectedLanguage].SERVICE}: ${lang[selectedLanguage].AIRTIME}

${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(rates?.recipient?.value)} ${rates?.recipient?.currency}

${lang[selectedLanguage].COUNTRY_LABEL}: ${bot.mobile_airtime.country ?? "N/A"}
${lang[selectedLanguage].OPERATOR}: ${bot.mobile_airtime.operator ?? "N/A"}
${lang[selectedLanguage].PHONE}: ${bot.mobile_airtime.phone_number}
                    `;
                    return await quickReply(data, message, quickReplies);
                }

                bot.mobile_airtime.airtime_token = rangedRates.data.token
                await bot.save()
                console.log(rangedRates, "rangedRates")

                const message = `${lang[selectedLanguage].REVIEW_AIRTIME_DETAILS}
                
${lang[selectedLanguage].TOTAL_COST} ${formattedAmount(rates?.total?.value)} ${rates?.total?.currency}
${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value)} ${rates?.fee?.currency}
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(rates?.sending?.value)} ${rates?.sending?.currency}
${lang[selectedLanguage].SERVICE}: ${lang[selectedLanguage].AIRTIME}

${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(rates?.recipient?.value)} ${rates?.recipient?.currency}

${lang[selectedLanguage].COUNTRY_LABEL}: ${bot.mobile_airtime.country ?? "N/A"}
${lang[selectedLanguage].OPERATOR}: ${bot.mobile_airtime.operator ?? "N/A"}
${lang[selectedLanguage].PHONE}: ${bot.mobile_airtime.phone_number}
                    `;

                const quickReplies = [
                    {
                        content_type: "text", title: lang[selectedLanguage].CONFIRM_PURCHASE, payload: `airtime_wallets_flow_confirm_purchase-ranged`,
                    },
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: `main_menu` }];

                await quickReply({ sender: { id: senderId } }, message, quickReplies);
            }
        }
        // else if amount is less than the minimum
        else if (amount < formatDecimalNumbersWithLimit(baseAmount.min, 2)) {
            await quickMessage(data, lang[selectedLanguage].ENTER_AMOUNT_MORE_THAN.replace('{{amount}}', formattedAmount(formatDecimalNumbersWithLimit(baseAmount.min, 2))).replace('{{currency}}', unit));
        }
        else if (amount > formatDecimalNumbersWithLimit(baseAmount.max, 2)) {
            await quickMessage(data, lang[selectedLanguage].ENTER_AMOUNT_LESS_THAN.replace('{{amount}}', formattedAmount(formatDecimalNumbersWithLimit(baseAmount.max, 2))).replace('{{currency}}', unit));
        } else {
            await quickMessage(data, lang[selectedLanguage].ENTER_AMOUNT_DIGITS);
        }
    }
    // user has selected airtime fixed amount or bundle
    else if (payload?.includes("airtime_wallets_flow_product")) {

        console.log({ payload, text })
        const [_, productId, subService] = payload.split("-");
        console.log({ productId, subService })

        const productDetails = await fetchItemDetailsHelper({
            productId,
            walletId: bot?.mobile_airtime?.currency
        });
        if (!productDetails.status) {

            // clearing the data
            bot.mobile_airtime = undefined
            await bot.save()

            await somethingWentWrongQuickReply(data, lang[selectedLanguage].FETCH_PRODUCT_DETAILS_ERROR);
            return
        }

        const ratesData = {
            payment_method: "wallet",
            wallet_id: bot?.mobile_airtime?.currency,
            sub_service_id: subService === "fixed" ? "11" : "12",
            local_wallet_id: bot?.mobile_airtime?.currency,
            token: productDetails?.data?.token
        }
        const rates = await getRatesHelper(ratesData)

        if (!rates.status) {

            // clearing the data
            bot.mobile_airtime = undefined
            await bot.save()

            await somethingWentWrongQuickReply(data, lang[selectedLanguage].FINDING_RATES_ERROR);
        }

        const actualRates = rates.data.converted
        console.log(rates?.data.token, "rates?.data.token")
        bot.mobile_airtime.airtime_token = rates?.data.token;
        await bot.save()

        console.log({ rates: rates.data.converted, ratess: rates.data })

        const message = `
${subService === "fixed" ? `${lang[selectedLanguage].REVIEW_FIXED_AIRTIME_DETAILS}` : `${lang[selectedLanguage].REVIEW_BUNDLE_DETAILS}`}\n
${lang[selectedLanguage].COUNTRY_LABEL}: ${bot.mobile_airtime.country ?? "N/A"}
${lang[selectedLanguage].OPERATOR}: ${bot.mobile_airtime.operator ?? "N/A"}
${lang[selectedLanguage].PHONE}: ${bot.mobile_airtime.phone_number}\n
${lang[selectedLanguage].SERVICE} ${subService === "fixed" ? lang[selectedLanguage].AIRTIME : lang[selectedLanguage].BUNDLE}
${subService !== "fixed" ? `\n${lang[selectedLanguage].BUNDLE_NAME}: ${productDetails?.data?.name}` : ""}
${subService !== "fixed" ? `\n${lang[selectedLanguage].BUNDLE_DESCRIPTION}: ${productDetails?.data?.description}\n` : ""}
${lang[selectedLanguage].BUNDLE_PRICE}: ${actualRates?.sending?.value} ${actualRates?.sending?.currency}
${lang[selectedLanguage].FEE}: ${actualRates?.fee?.value} ${actualRates?.fee?.currency}
${lang[selectedLanguage].TOTAL_COST}: ${actualRates?.total?.value} ${actualRates?.total?.currency}`;


        const quickReplies = [
            {
                content_type: "text", title: lang[selectedLanguage].CONFIRM_PURCHASE, payload: `airtime_wallets_flow_confirm_purchase-${subService === "fixed" ? "fixed" : "bundle"}`,
            },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: `main_menu` }];

        await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
    }
    // user has confirmed fixed airtime
    else if (payload?.includes("airtime_wallets_flow_confirm_purchase")) {
        const airtimeType = payload.split("-")[1];
        await handleOTPGeneration(selectedLanguage, senderId, `airtime_wallets_flow_confirm_purchase-otp-${airtimeType}`, `airtime_wallets_flow_confirm_purchase-otp-${airtimeType}`, "Transaction OTP");
    }
    // user has entered OTP
    else if (bot?.last_message?.includes("airtime_wallets_flow_confirm_purchase-otp") && !payload && text) {
        const airtimeType = bot?.last_message?.split("-")[2]
        const otpValidationResult = await validateOTP(senderId, text, `airtime_wallets_flow_confirm_purchase-otp-${airtimeType}`);

        console.log({ airtimeType }, bot?.last_message)
        console.log({ otpValidationResult })
        if (otpValidationResult.status) {
            let decoded;
            try {
                decoded = jwt.verify(bot.mobile_airtime.airtime_token, secretKey);
            } catch (err) {
                console.log(err)

                // clearing the data
                bot.mobile_airtime = undefined
                await bot.save()

                await somethingWentWrongQuickReply(data, lang[selectedLanguage].CONFIRM_TRANSACTION_ERROR);

            }
            console.log({ decoded })
            if (airtimeType === "ranged") {
                const rangedAirtimeTransaction = await createTransactionRangedHelper({ number: bot.mobile_airtime.phone_number, decoded, wallet_id: bot?.mobile_airtime?.currency })
                console.log(rangedAirtimeTransaction)
                if (!rangedAirtimeTransaction.status) {

                    // clearing the data
                    bot.mobile_airtime = undefined
                    await bot.save()

                    if (rangedAirtimeTransaction.message === "Insufficient") {

                        return await somethingWentWrongQuickReply(data, lang[selectedLanguage].INSUFFICIENT_FUNDS_ERROR);
                    }
                    await somethingWentWrongQuickReply(data, lang[selectedLanguage].CONFIRM_TRANSACTION_ERROR);
                } else {

                    subtitle = `
${lang[selectedLanguage].TID} ${rangedAirtimeTransaction.data.reference_id}
${lang[selectedLanguage].AMOUNT}: ${formattedAmount(decoded.total.value)} ${decoded.total.currency}
${lang[selectedLanguage].BENEFICIARY}: ${formattedAmount(decoded.recipient.value)} ${decoded.recipient.currency}
                        `

                    const templatePayload = {
                        template_type: "generic",
                        elements: [
                            {
                                title: lang[selectedLanguage].SUCCESSFUL_CHARGE.replace('{{number}}', bot?.mobile_airtime?.phone_number),
                                subtitle,
                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Request%20A%20Quote.png",
                                buttons: [
                                    {
                                        type: "postback",
                                        title: "New Transaction",
                                        payload: "mobile_airtime",
                                    },
                                    {
                                        type: "postback",
                                        title: lang[selectedLanguage].MAIN_MENU,
                                        payload: "main_menu",
                                    }

                                ],
                            },
                        ]
                    };

                    // clearing the data
                    bot.mobile_airtime = undefined
                    await bot.save()

                    await sendTemplate(data, senderId, templatePayload)
                }

            } else if (airtimeType === "fixed" || airtimeType === "bundle") {
                const fixedAirtimeTransaction = await createTransactionFixedHelper({ number: bot.mobile_airtime.phone_number, decoded, wallet_id: bot?.mobile_airtime?.currency })
                console.log(fixedAirtimeTransaction)
                if (!fixedAirtimeTransaction.status) {

                    // clearing the data
                    bot.mobile_airtime = undefined
                    await bot.save()

                    if (fixedAirtimeTransaction.message?.includes("Insufficient")) {
                        return await somethingWentWrongQuickReply(data, lang[selectedLanguage].INSUFFICIENT_FUNDS_ERROR);

                    }
                    await somethingWentWrongQuickReply(data, lang[selectedLanguage].CONFIRM_TRANSACTION_ERROR);
                } else {
                    let title
                    if (decoded.type === "FIXED_VALUE_PIN_PURCHASE") {
                        title = lang[selectedLanguage].SUCCESSFUL_CHARGE_FIXED_AMOUNT
                            .replace(/{{number}}/g, bot?.mobile_airtime?.phone_number);
                    } else {
                        title = lang[selectedLanguage].SUCCESSFUL_CHARGE_BUNDLE
                            .replace('{{number}}', bot?.mobile_airtime?.phone_number);
                    }

                    let subtitle;
                    if (decoded.type === "FIXED_VALUE_PIN_PURCHASE") {
                        subtitle = `
${lang[selectedLanguage].TID} ${fixedAirtimeTransaction.data.reference_id}
${lang[selectedLanguage].AMOUNT}: ${formattedAmount(decoded.converted.total.value)} ${decoded.converted.total.currency}
${lang[selectedLanguage].BENEFICIARY}: ${decoded.name}
                        `
                    } else {
                        subtitle = `
${lang[selectedLanguage].TID} ${fixedAirtimeTransaction.data.reference_id}
${lang[selectedLanguage].AMOUNT}: ${formattedAmount(decoded.converted.total.value)} ${decoded.converted.total.currency}
${lang[selectedLanguage].BUNDLE_NAME}: ${decoded.name}
                        `
                    }
                    console.log({ subtitle })
                    const templatePayload = {
                        template_type: "generic",
                        elements: [
                            {
                                title,
                                subtitle,
                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Request%20A%20Quote.png",
                                buttons: [
                                    {
                                        type: "postback",
                                        title: "New Transaction",
                                        payload: "mobile_airtime",
                                    },
                                    {
                                        type: "postback",
                                        title: lang[selectedLanguage].MAIN_MENU,
                                        payload: "main_menu",
                                    }

                                ],
                            },
                        ]
                    };


                    // clearing the data
                    bot.mobile_airtime = undefined
                    await bot.save()

                    await sendTemplate(data, senderId, templatePayload)
                }
            }
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {

                // clearing the data
                bot.mobile_airtime = undefined
                await bot.save()

                await quickMessage(data, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {

                await invalidMessage(data, `airtime_wallets_flow_confirm_purchase-otp-${airtimeType}`, selectedLanguage, bot?.otpType);
            }
        }
    }
}

module.exports = handleAirtimeUsingW2W