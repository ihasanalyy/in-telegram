const { quickMessage, quickReply, sendTemplate, somethingWentWrongQuickReply } = require("../../instaChatbotUtils");
const currencyToEmoji = require('../../currencyEmojis.json');
const lang = require('../../languages/languages.json');
const PanModel = require("../../../models/Pan.model");
const Wallet = require("../../../models/Wallet.model");
const jwt = require('jsonwebtoken');
const { getSubservices, formattedAmount } = require("../../InstaChatbotHelpers");
const { getItemsFromSubServicesHelper, fetchItemDetailsHelper, getRatesHelper, initiateAirtimeFixedPaypalTransactionHelper, fetchRangedAirtimeRatesHelper, initiateAirtimePaypalTransactionHelper } = require("../../dtOneHelpers");
const { handleOTPGeneration, invalidMessage, validateOTP } = require("../../instaChatbotOTP");
const { formatDecimalNumbersWithLimit } = require("../../payerRates");
const { fetchLocalOrDefaultWalletConditionally } = require("../../helpers");
const secretKey = process.env.jwtKey;

async function handleAirtimeUsingPaypal(senderId, payload, account, bot, text, selectedLanguage) {
    console.log({ senderId, payload, account, bot, text });

    const data = {
        sender: {
            id: senderId
        }
    }

    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(account._id)

    if (!defaultWallet) {
        return await somethingWentWrongQuickReply(data, lang[selectedLanguage].NO_DEFAULT_WALLET);

    }

    if (payload === "airtime_paypal_flow") {
        const subServiceData = {
            isoCode: bot.mobile_airtime.country_code,
            operator_id: bot.mobile_airtime.operator_id,
            serviceId: 1
        }
        console.log(subServiceData, "subServiceDataingetsubservices")
        const subServices = await getSubservices(subServiceData)
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
                } else {
                    title = service.name;
                }
                return { content_type: "text", title: title, payload: `airtime_paypal_flow_service-${service.id}` };
            }); quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` });
            await quickReply({ sender: { id: senderId } }, lang[selectedLanguage].SELECT_SERVICE, quickReplies);
        } else {
            const quickReplies = [{ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` }];
            await quickReply({ sender: { id: senderId } }, lang[selectedLanguage].NO_SERVICES_FOUND_MESSAGE, quickReplies, "4");
        }
    }

    else if (payload?.includes("airtime_paypal_flow_service-")) {
        const subService = payload.split("-")[1];
        console.log(subService, "subService");

        const getItemsdata = {
            wallet_id: defaultWallet._id,
            isoCode: bot.mobile_airtime.country_code,
            operator_id: bot?.mobile_airtime?.operator_id,
            serviceId: '1',
            subservice_id: subService,
            userId: account._id
        };

        let productList = await getItemsFromSubServicesHelper(getItemsdata);
        console.log(productList, "productList");

        if (!productList.status) {

            // clearing the data
            bot.mobile_airtime = undefined
            await bot.save()

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
                payload: `airtime_paypal_flow_product-${product.id}-bundle`
            }));

            let selectMessage = subService == 12 ? lang[selectedLanguage].CHOOSE_BUNDLE_PACKAGE : lang[selectedLanguage].CHOOSE_DATA_PACKAGE;
            let productNames = displayedProducts.map((product, index) => `${startIndex + index + 1}. ${product.name} || ${formattedAmount(product.prices.amount)} ${product.prices.unit}`).join('\n');
            const message = `${selectMessage}\n\n${productNames}\n`;

            let quickReplies = [
                ...productIndexList,
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` }
            ];

            if (currentPage > 1) {
                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `airtime_paypal_flow_prev_products-${currentPage - 1}-${subService}` });
            }

            if (productList.length > endIndex) {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `airtime_paypal_flow_next_products-${currentPage + 1}-${subService}` });
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
                    payload: `airtime_paypal_flow_product-${product.id}-fixed`
                }));

                const message = lang[selectedLanguage].SELECT_AIRTIME_AMOUNT;

                let quickReplies = [
                    ...productIndexList,
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` }
                ];

                if (currentPage > 1) {
                    quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `airtime_paypal_flow_prev_products-${currentPage - 1}-${subService}` });
                }

                if (productList.length > endIndex) {
                    quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `airtime_paypal_flow_next_products-${currentPage + 1}-${subService}` });
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
                    "airtime_paypal_flow_airtime-amount");
            }

        }
    }


    // Handle "Next" quick reply for products
    else if (payload?.includes("airtime_paypal_flow_next_products")) {
        const [_, currentPageStr, subService] = payload.split("-");
        let currentPage = parseInt(currentPageStr);
        const getItemsData = {
            wallet_id: defaultWallet._id,
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
                payload: `airtime_paypal_flow_product-${product.id}-bundle`
            }));

            let selectMessage = subService == 12 ? lang[selectedLanguage].CHOOSE_BUNDLE_PACKAGE : lang[selectedLanguage].CHOOSE_DATA_PACKAGE;
            let productNames = displayedProducts.map((product, index) => `${startIndex + index + 1}. ${product.name} || ${formattedAmount(product.prices.amount)} ${product.prices.unit}`).join('\n');
            const message = `${selectMessage}\n\n${productNames}\n`;

            let quickReplies = [
                ...productIndexList,
            ];

            if (currentPage > 1) {
                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `airtime_paypal_flow_prev_products-${currentPage - 1}-${subService}` });
            }

            if (productList.length > endIndex) {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `airtime_paypal_flow_next_products-${currentPage + 1}-${subService}` });
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
                payload: `airtime_paypal_flow_product-${product.id}-fixed`
            }));

            let message = lang[selectedLanguage].SELECT_AIRTIME_AMOUNT;

            let quickReplies = [
                ...productIndexList,
            ];

            if (currentPage > 1) {
                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `airtime_paypal_flow_prev_products-${currentPage - 1}-${subService}` });
            }

            if (productList.length > endIndex) {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `airtime_paypal_flow_next_products-${currentPage + 1}-${subService}` });
            }
            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` });

            await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
        }

    }

    // Handle "Previous" quick reply for products
    else if (payload?.includes("airtime_paypal_flow_prev_products")) {
        const [_, currentPageStr, subService] = payload.split("-");
        let currentPage = parseInt(currentPageStr);
        const getItemsData = {
            wallet_id: defaultWallet._id,
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
                payload: `airtime_paypal_flow_product-${product.id}-bundle`
            }));

            let selectMessage = subService == 12 ? lang[selectedLanguage].CHOOSE_BUNDLE_PACKAGE : lang[selectedLanguage].CHOOSE_DATA_PACKAGE;
            let productNames = displayedProducts.map((product, index) => `${startIndex + index + 1}. ${product.name} || ${formattedAmount(product.prices.amount)} ${product.prices.unit}`).join('\n');
            const message = `${selectMessage}\n\n${productNames}\n`;

            let quickReplies = [
                ...productIndexList,
            ];

            if (currentPage > 1) {
                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `airtime_paypal_flow_prev_products-${currentPage - 1}-${subService}` });
            }

            if (productList.length > endIndex) {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `airtime_paypal_flow_next_products-${currentPage + 1}-${subService}` });
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
                payload: `airtime_paypal_flow_product-${product.id}-fixed`
            }));

            let message = lang[selectedLanguage].SELECT_AIRTIME_AMOUNT;

            let quickReplies = [
                ...productIndexList,
            ];

            if (currentPage > 1) {
                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `airtime_paypal_flow_prev_products-${currentPage - 1}-${subService}` });
            }

            if (productList.length > endIndex) {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `airtime_paypal_flow_next_products-${currentPage + 1}-${subService}` });
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` });
            } else {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` });
            }

            await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
        }
    }

    // user has typed airtime amount
    else if (bot?.last_message === "airtime_paypal_flow_airtime-amount" && !payload && text) {
        const digitRegex = /^\d+(\.\d+)?$/;
        const isNumber = digitRegex.test(text)
        const amount = parseFloat(text);

        const getItemsData = {
            wallet_id: defaultWallet._id,
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

            const rangedRatesData = {
                product_id: productList.data.id,
                wallet_id: defaultWallet._id,
                local_wallet_id: defaultWallet._id,
                amount,
                sub_service_id: "11",
                payment_method: "paypal"
            }
            const rangedRates = await fetchRangedAirtimeRatesHelper(rangedRatesData)
            if (!rangedRates.status) {

                // clearing the data
                bot.mobile_airtime = undefined
                await bot.save()

                await somethingWentWrongQuickReply(data, lang[selectedLanguage].FETCH_PRODUCTS_ERROR);
                return
            }
            bot.mobile_airtime.airtime_token = rangedRates.data.token
            await bot.save()
            console.log(rangedRates, "rangedRates")

            const rates = rangedRates.data
            const message = `${lang[selectedLanguage].REVIEW_AIRTIME_DETAILS}
                
${lang[selectedLanguage].COUNTRY_LABEL}: ${bot.mobile_airtime.country ?? "N/A"}
${lang[selectedLanguage].OPERATOR}: ${bot.mobile_airtime.operator ?? "N/A"}
${lang[selectedLanguage].PHONE}: ${bot.mobile_airtime.phone_number}\n

${lang[selectedLanguage].SERVICE}: ${lang[selectedLanguage].AIRTIME}

${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value)} ${rates?.fee?.currency}
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(rates?.sending?.value)} ${rates?.sending?.currency}

${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(rates?.recipient?.value)} ${rates?.recipient?.currency}
${lang[selectedLanguage].TOTAL_COST}: ${formattedAmount(rates?.total?.value)} ${rates?.total?.currency}
`;

            let paypalMessage = "";

            // Check if PayPal supports the currency
            if (!rates?.paypal?.paypal_currency_supported) {
                paypalMessage = `
${lang[selectedLanguage].PAYPAL_CURRENCY_NOT_SUPPORTED.replace('{{currency}}', rates?.sending?.currency)}\n
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${rates?.sending?.currency} = ${formattedAmount(rates?.paypal?.paypal_rate.value, 6)} ${rates?.paypal?.paypal_rate.currency}\n
${lang[selectedLanguage].AMOUNT_IN_USD}: ${formattedAmount(rates?.paypal?.paypal_converted.value)} ${rates?.paypal?.paypal_converted.currency}
`;
            }

            const quickReplies = [
                {
                    content_type: "text",
                    title: lang[selectedLanguage].CONFIRM_PURCHASE,
                    payload: `airtime_paypal_flow_confirm_purchase-ranged`,
                },
                {
                    content_type: "text",
                    title: lang[selectedLanguage].MAIN_MENU,
                    payload: `main_menu`
                }
            ];

            // Determine if paypalMessage is required
            if (paypalMessage) {
                await quickMessage({ sender: { id: senderId } }, message, "4");
                await quickReply({ sender: { id: senderId } }, paypalMessage, quickReplies, "4");
            } else {
                await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
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
    else if (payload?.includes("airtime_paypal_flow_product")) {

        console.log({ payload, text })
        const [_, productId, subService] = payload.split("-");
        console.log({ productId, subService })

        const productDetails = await fetchItemDetailsHelper({
            productId,
            walletId: defaultWallet._id
        });
        if (!productDetails.status) {

            // clearing the data
            bot.mobile_airtime = undefined
            await bot.save()

            await somethingWentWrongQuickReply(data, lang[selectedLanguage].FETCH_PRODUCT_DETAILS_ERROR);
            return
        }

        const getRatesData = {
            payment_method: "paypal",
            wallet_id: defaultWallet._id,
            sub_service_id: subService === "fixed" ? "11" : "12",
            local_wallet_id: defaultWallet._id,
            token: productDetails?.data?.token
        }
        console.log({ getRatesData }, subService === "11", subService)
        const rates = await getRatesHelper(getRatesData)

        console.log({ rates })
        if (!rates.status) {

            // clearing the data
            bot.mobile_airtime = undefined
            await bot.save()

            await somethingWentWrongQuickReply(data, lang[selectedLanguage].FINDING_RATES_ERROR);
        }

        const actualRates = rates.data.converted
        console.log(actualRates.paypal, "rates?.data.token")
        bot.mobile_airtime.airtime_token = rates?.data.token;
        await bot.save()

        console.log({ rates: rates.data.converted, ratess: rates.data })

        const message = `
${subService === "fixed" ? `${lang[selectedLanguage].REVIEW_FIXED_AIRTIME_DETAILS}` : `${lang[selectedLanguage].REVIEW_BUNDLE_DETAILS}`}\n
${lang[selectedLanguage].COUNTRY_LABEL}: ${bot.mobile_airtime.country ?? "N/A"}
${lang[selectedLanguage].OPERATOR}: ${bot.mobile_airtime.operator ?? "N/A"}
${lang[selectedLanguage].PHONE}: ${bot.mobile_airtime.phone_number}\n
${lang[selectedLanguage].SERVICE} ${subService === "fixed" ? lang[selectedLanguage].AIRTIME : "Bundle"}
${subService !== "fixed" ? `\n${lang[selectedLanguage].BUNDLE_NAME}: ${productDetails?.data?.name}` : ""}
${subService !== "fixed" ? `\n${lang[selectedLanguage].BUNDLE_DESCRIPTION}: ${productDetails?.data?.description}\n` : ""}
${lang[selectedLanguage].BUNDLE_PRICE}: ${actualRates?.sending?.value} ${actualRates?.sending?.currency}
${lang[selectedLanguage].FEE}: ${actualRates?.fee?.value} ${actualRates?.fee?.currency}
${lang[selectedLanguage].TOTAL_COST}: ${actualRates?.total?.value} ${actualRates?.total?.currency}`;

        let paypalMessage = "";

        if (!actualRates?.paypal?.paypal_currency_supported) {
            paypalMessage = `
${lang[selectedLanguage].PAYPAL_CURRENCY_NOT_SUPPORTED.replace('{{currency}}', actualRates?.sending?.currency)}\n
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${actualRates?.sending?.currency} = ${formattedAmount(actualRates?.paypal?.paypal_rate.value, 6)} ${actualRates?.paypal?.paypal_rate.currency}\n
${lang[selectedLanguage].AMOUNT_IN_USD}: ${formattedAmount(actualRates?.paypal?.paypal_converted.value)} ${actualRates?.paypal?.paypal_converted.currency}
`;
        }

        const quickReplies = [
            {
                content_type: "text",
                title: lang[selectedLanguage].CONFIRM_PURCHASE,
                payload: `airtime_paypal_flow_confirm_purchase-${subService === "fixed" ? "fixed" : "bundle"}`,
            },
            {
                content_type: "text",
                title: lang[selectedLanguage].MAIN_MENU,
                payload: `main_menu`
            }
        ];

        // Determine if paypalMessage is required
        if (paypalMessage) {
            await quickMessage({ sender: { id: senderId } }, message, "4");
            await quickReply({ sender: { id: senderId } }, paypalMessage, quickReplies, "4");
        } else {
            await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
        }

    }
    // user has confirmed fixed airtime
    else if (payload?.includes("airtime_paypal_flow_confirm_purchase")) {
        const airtimeType = payload.split("-")[1];
        await handleOTPGeneration(selectedLanguage, senderId, `airtime_paypal_flow_confirm_purchase-otp-${airtimeType} `, `airtime_paypal_flow_confirm_purchase-otp-${airtimeType}`, "Transaction OTP");
    }
    // user has entered OTP
    else if (bot?.last_message?.includes("airtime_paypal_flow_confirm_purchase-otp") && !payload && text) {
        const airtimeType = bot?.last_message?.split("-")[2]
        const otpValidationResult = await validateOTP(senderId, text, `airtime_paypal_flow_confirm_purchase-otp-${airtimeType}`);

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

            const paypalDetails = airtimeType === "ranged" ? decoded.paypal : decoded.converted.paypal
            if (airtimeType === "ranged") {
                const initiateData = {
                    number: bot.mobile_airtime.phone_number,
                    token: bot.mobile_airtime.airtime_token,
                    wallet_id: defaultWallet._id
                };
                const initiateRangedAirtime = await initiateAirtimePaypalTransactionHelper(initiateData);

                if (initiateRangedAirtime?.status) {
                    const title = lang[selectedLanguage].VERIFY_PAYPAL_ACCOUNT;

                    const subtitle = `
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(paypalDetails?.paypal_currency_supported ? decoded?.total.value : paypalDetails?.paypal_converted.value)} ${paypalDetails?.paypal_currency_supported ? defaultWallet?.currency?.code : paypalDetails?.paypal_converted.currency}
        `;

                    const templatePayload = {
                        template_type: "generic",
                        elements: [
                            {
                                title,
                                subtitle,
                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Request%20A%20Quote.png",
                                buttons: [
                                    {
                                        type: "web_url",
                                        title: lang[selectedLanguage].VERIFY,
                                        url: initiateRangedAirtime?.url,
                                        webview_height_ratio: "full"
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

                    await sendTemplate(data, senderId, templatePayload, "4");
                }

            } else if (airtimeType === "fixed" || airtimeType === "bundle") {
                const initiateData = {
                    number: bot.mobile_airtime.phone_number, token: bot.mobile_airtime.airtime_token, wallet_id: defaultWallet._id
                }
                const initiateFixedAirtime = await initiateAirtimeFixedPaypalTransactionHelper(initiateData)

                if (initiateFixedAirtime?.status) {
                    const title = lang[selectedLanguage].VERIFY_PAYPAL_ACCOUNT

                    const subtitle = `
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(paypalDetails?.paypal_currency_supported ? decoded.converted.total.value : paypalDetails?.paypal_converted.value)} ${paypalDetails?.paypal_currency_supported ? defaultWallet?.currency?.code : paypalDetails?.paypal_converted.currency}
        `

                    const templatePayload = {
                        template_type: "generic",
                        elements: [
                            {
                                title,
                                subtitle,
                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Request%20A%20Quote.png",
                                buttons: [
                                    {
                                        type: "web_url",
                                        title: lang[selectedLanguage].VERIFY,
                                        url: initiateFixedAirtime?.url,
                                        webview_height_ratio: "full"
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

                    await sendTemplate(data, senderId, templatePayload, "4")
                }

                return console.log({ initiateFixedAirtime })
            }
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {

                // clearing the data
                bot.mobile_airtime = undefined
                await bot.save()

                await quickMessage(data, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {

                await invalidMessage(data, "updated_w2w_card_payment-otp", selectedLanguage, bot?.otpType);
            }
        }
    }
}

module.exports = handleAirtimeUsingPaypal