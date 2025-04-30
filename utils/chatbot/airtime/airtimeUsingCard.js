const { quickMessage, quickReply, sendTemplate, somethingWentWrongQuickReply } = require("../../instaChatbotUtils");
const CryptoJS = require("crypto-js");
const lang = require('../../languages/languages.json');
const PanModel = require("../../../models/Pan.model");
const Wallet = require("../../../models/Wallet.model");
const { balanceLimitCheck, limitCheck, featureCheck, getExchangeRatesToUSD, fetchLocalOrDefaultWalletConditionally, validateCardExpiry } = require("../../helpers");
const { topUpFeeCalculation, generatePayload } = require("../../../controllers/Trust-Payment.controller");
const Transaction = require("../../../models/Transaction.model");
const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const { formattedAmount, getSubservices } = require("../../InstaChatbotHelpers");
const { getItemsFromSubServicesHelper, fetchItemDetailsHelper, getRatesHelper, fetchRangedAirtimeRatesHelper } = require("../../dtOneHelpers");
const { handleOTPGeneration, validateOTP, invalidMessage } = require("../../instaChatbotOTP");
const countriesIso = require('../../countries_iso2.json');
const { formatDecimalNumbersWithLimit } = require("../../payerRates");
const secretKey = process.env.jwtKey;

const initiateTopUpSavedCard = async (wallet_id, amount, pan, airtimeToken, airtimeType) => {
    try {
        let ref = 'tr_' + Date.now().toString();
        console.log(wallet_id, amount, pan, 'w2w_data')
        if (!wallet_id || !amount || !pan) {
            return { status: false, message: "Required fields are missing." };
        }

        amount = parseInt(amount);

        let receiverWallet = await Wallet.findOne({
            $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] },
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] },
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] },
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] }
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }]);

        if (!receiverWallet) {
            return { status: false, message: "Wallet not found or inactive." };
        }

        let panDetails = await PanModel.findOne({ $and: [{ _id: pan }, { account: receiverWallet.account._id }] });
        if (!panDetails) {
            return { status: false, message: "Invalid Card Details." };
        }

        let bytes = await CryptoJS.AES.decrypt(panDetails.panData, process.env.PAN_ENCRYPTION_KEY);
        let panDataObj = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        let amountInUSD = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount / 100);

        let feeDetails = await topUpFeeCalculation(receiverWallet, amount / 100, 'topup_card_payment');
        let featureChecked = await featureCheck('topup_channel', 'card_payment', receiverWallet.account.level);

        if (featureChecked && feeDetails >= 0) {
            let balanceLimitChecked = await balanceLimitCheck(parseInt(amountInUSD), receiverWallet.account);
            let limitChecked = limitCheck(parseFloat(amountInUSD), receiverWallet.account.level, receiverWallet.account, 'topup');

            if (limitChecked.status && balanceLimitChecked) {
                const receiverTimezone = receiverWallet.account?.timezone || "UTC";
                const receiverCurrentTime = moment().tz(receiverTimezone).format();

                let receiverTransactionObj = {
                    reference_id: ref,
                    type: 'trust_payment',
                    transaction_type: 'credit',
                    service_type: 'topup',
                    payment_type: 'card',
                    status: 'INITIATED',
                    description: 'Topup by Saved Card',
                    currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                    amount: (amount / 100) - feeDetails,
                    fee: feeDetails,
                    total: amount / 100,
                    wallet_id: receiverWallet.wallet_id,
                    wallet: receiverWallet._id,
                    account: receiverWallet.account._id,
                    receiver: receiverWallet.account._id,
                    current_balance: receiverWallet.balance.available,
                    hidden: true,
                    external_token: { token: airtimeToken, type: `card_airtime_bot-${airtimeType === "ranged" ? "ranged" : "fixed"}` },
                    timeline: [{ status: 'INITIATED', date: receiverCurrentTime }]
                };

                let transaction = await Transaction.create(receiverTransactionObj);

                const iat = Math.floor(Date.now() / 1000);

                const payload = generatePayload(amount / 100, receiverWallet, panDataObj, transaction, iat, true, false, "instagram");

                const token = jwt.sign(payload, process.env.TRUST_PAYMENT_SECRET, { algorithm: 'HS256' });

                if (token) {
                    return {
                        status: true,
                        message: "Transaction initiated successfully.",
                        data: {
                            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                            transaction_id: transaction._id,
                            transaction_ref: transaction.reference_id,
                            token,
                        }
                    };
                } else {
                    return { status: false, message: "Transaction failed." };
                }
            } else {
                let errorMsg = !limitChecked.status ? "Limit check failed." : "Balance limit exceeded.";
                return { status: false, message: errorMsg };
            }
        } else {
            return { status: false, message: "This service is not allowed." };
        }
    } catch (err) {
        console.log(err);
        return { status: false, message: "Internal server error!" };
    }
};

async function handleAirtimeUsingCard(senderId, payload, account, bot, text, selectedLanguage) {

    const data = {
        sender: {
            id: senderId
        }
    }

    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(account._id)

    if (!defaultWallet) {
        await somethingWentWrongQuickReply(data, lang[selectedLanguage].NO_DEFAULT_WALLET_SET);
        return
    }
    if (payload === "airtime_card_flow") {
        const pans = await PanModel.find({ account: account._id });
        console.log(pans)

        let quickReplies = []

        if (pans.length !== 0) {

            for (let i = 0; i < pans.length; i++) {
                quickReplies.push({
                    content_type: "text",
                    title: `💳 *******${pans[i].last4}`,
                    payload: `airtime_card_flow_select_card-${pans[i]._id}`
                })
            }

            quickReplies.push({
                content_type: "text",
                title: lang[selectedLanguage].CHANGE_PAYMENT_METHOD,
                payload: `airtm_confirm_number`
            })

            quickReplies.push({
                content_type: "text",
                title: `☰ ${lang[selectedLanguage].MAIN_MENU}`,
                payload: `main_menu`
            })

            await quickReply(data, lang[selectedLanguage].SELECT_YOUR_TOPUP_CHANNEL, quickReplies, "4");
        } else {
            quickReplies.push({
                content_type: "text",
                title: `☰ ${lang[selectedLanguage].MAIN_MENU}`,
                payload: `main_menu`
            })
            await quickReply(data, lang[selectedLanguage].NO_CARD_SAVED, quickReplies, "4");
        }
    }
    // user has selected topup channel
    else if (payload?.includes("airtime_card_flow_select_card")) {

        const cardId = payload.split("-")[1]

        const expiryValidation = await validateCardExpiry(cardId);
        if (!expiryValidation.status) {
            // Handle expired or invalid card
            const pans = await PanModel.find({ account: account._id });
            if (pans.length !== 0) {
                const message = "The card you selected has expired and is now removed from your InstaPay account.\n\n" +
                    "To continue with this transaction, please choose an alternative payment method."

                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].PAYMENT_CARD, payload: "airtime_card_flow" },
                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "airtime_wallets_flow_wallets" },
                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "airtime_paypal_flow" },
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                ]

                await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");

            } else {
                const message = "The card you selected has expired and is now removed from your InstaPay account.\n\n" +
                    "To continue with this transaction, please choose an alternative payment method."

                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "airtime_wallets_flow_wallets" },
                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "airtime_paypal_flow" },
                    { content_type: "text", title: lang[selectedLanguage].ADD_PAYMENT_CARD, payload: "add_payment_card-airtm_confirm_number" },
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                ]

                await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
            }
            return;
        }

        bot.mobile_airtime.pan = cardId
        await bot.save()

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
                return { content_type: "text", title: title, payload: `airtime_card_flow_service-${service.id}` };
            });
            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` });
            await quickReply({ sender: { id: senderId } }, lang[selectedLanguage].SELECT_SERVICE, quickReplies);
        } else {
            const quickReplies = [{ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` }];
            await quickReply({ sender: { id: senderId } }, lang[selectedLanguage].NO_SERVICES_FOUND_MESSAGE, quickReplies, "4");
        }
    }

    else if (payload?.includes("airtime_card_flow_service-")) {
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
                payload: `airtime_card_flow_product-${product.id}-bundle`
            }));

            let selectMessage = subService == 12 ? lang[selectedLanguage].CHOOSE_BUNDLE_PACKAGE : lang[selectedLanguage].CHOOSE_DATA_PACKAGE;
            let productNames = displayedProducts.map((product, index) => `${startIndex + index + 1}. ${product.name} || ${formattedAmount(product.prices.amount)} ${product.prices.unit}`).join('\n');
            const message = `${selectMessage}\n\n${productNames}\n`;

            let quickReplies = [
                ...productIndexList,
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` }
            ];

            if (currentPage > 1) {
                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `airtime_card_flow_prev_products-${currentPage - 1}-${subService}` });
            }

            if (productList.length > endIndex) {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `airtime_card_flow_next_products-${currentPage + 1}-${subService}` });
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
                    payload: `airtime_card_flow_product-${product.id}-fixed`
                }));

                const message = lang[selectedLanguage].SELECT_AIRTIME_AMOUNT;

                let quickReplies = [
                    ...productIndexList,
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` }
                ];

                if (currentPage > 1) {
                    quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `airtime_card_flow_prev_products-${currentPage - 1}-${subService}` });
                }

                if (productList.length > endIndex) {
                    quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `airtime_card_flow_next_products-${currentPage + 1}-${subService}` });
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
                    "airtime_card_flow_airtime-amount");
            }

        }
    }

    // Handle "Next" quick reply for products
    else if (payload?.includes("airtime_card_flow_next_products")) {
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
                payload: `airtime_card_flow_product-${product.id}-bundle`
            }));

            let selectMessage = subService == 12 ? lang[selectedLanguage].CHOOSE_BUNDLE_PACKAGE : lang[selectedLanguage].CHOOSE_DATA_PACKAGE;
            let productNames = displayedProducts.map((product, index) => `${startIndex + index + 1}. ${product.name} || ${formattedAmount(product.prices.amount)} ${product.prices.unit}`).join('\n');
            const message = `${selectMessage}\n\n${productNames}\n`;

            let quickReplies = [
                ...productIndexList,
            ];

            if (currentPage > 1) {
                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `airtime_card_flow_prev_products-${currentPage - 1}-${subService}` });
            }

            if (productList.length > endIndex) {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `airtime_card_flow_next_products-${currentPage + 1}-${subService}` });
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
                payload: `airtime_card_flow_product-${product.id}-fixed`
            }));

            let message = lang[selectedLanguage].SELECT_AIRTIME_AMOUNT;

            let quickReplies = [
                ...productIndexList,
            ];

            if (currentPage > 1) {
                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `airtime_card_flow_prev_products-${currentPage - 1}-${subService}` });
            }

            if (productList.length > endIndex) {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `airtime_card_flow_next_products-${currentPage + 1}-${subService}` });
            }
            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` });

            await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
        }

    }

    // Handle "Previous" quick reply for products
    else if (payload?.includes("airtime_card_flow_prev_products")) {
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
                payload: `airtime_card_flow_product-${product.id}-bundle`
            }));

            let selectMessage = subService == 12 ? lang[selectedLanguage].CHOOSE_BUNDLE_PACKAGE : lang[selectedLanguage].CHOOSE_DATA_PACKAGE;
            let productNames = displayedProducts.map((product, index) => `${startIndex + index + 1}. ${product.name} || ${formattedAmount(product.prices.amount)} ${product.prices.unit}`).join('\n');
            const message = `${selectMessage}\n\n${productNames}\n`;

            let quickReplies = [
                ...productIndexList,
            ];

            if (currentPage > 1) {
                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `airtime_card_flow_prev_products-${currentPage - 1}-${subService}` });
            }

            if (productList.length > endIndex) {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `airtime_card_flow_next_products-${currentPage + 1}-${subService}` });
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
                payload: `airtime_card_flow_product-${product.id}-fixed`
            }));

            let message = lang[selectedLanguage].SELECT_AIRTIME_AMOUNT;

            let quickReplies = [
                ...productIndexList,
            ];

            if (currentPage > 1) {
                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `airtime_card_flow_prev_products-${currentPage - 1}-${subService}` });
            }

            if (productList.length > endIndex) {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `airtime_card_flow_next_products-${currentPage + 1}-${subService}` });
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` });
            } else {
                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` });
            }

            await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
        }
    }

    // user has typed airtime amount
    else if (bot?.last_message === "airtime_card_flow_airtime-amount" && !payload && text) {
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
                payment_method: "card"
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

            const quickReplies = [
                {
                    content_type: "text",
                    title: lang[selectedLanguage].CONFIRM_PURCHASE,
                    payload: `airtime_card_flow_confirm_purchase-ranged`,
                },
                {
                    content_type: "text",
                    title: lang[selectedLanguage].MAIN_MENU,
                    payload: `main_menu`
                }
            ];

            await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");
        }
        if (isNumber && amount >= formatDecimalNumbersWithLimit(baseAmount.min, 2) && amount <= formatDecimalNumbersWithLimit(baseAmount.max, 2)) {

            const rangedRatesData = {
                product_id: productList.data.id,
                wallet_id: defaultWallet._id,
                local_wallet_id: defaultWallet._id,
                amount,
                sub_service_id: "11",
                payment_method: "card"
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

            const quickReplies = [
                {
                    content_type: "text",
                    title: lang[selectedLanguage].CONFIRM_PURCHASE,
                    payload: `airtime_card_flow_confirm_purchase-ranged`,
                },
                {
                    content_type: "text",
                    title: lang[selectedLanguage].MAIN_MENU,
                    payload: `main_menu`
                }
            ];

            await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");


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
    else if (payload?.includes("airtime_card_flow_product")) {

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
            payment_method: "card",
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
                content_type: "text",
                title: lang[selectedLanguage].CONFIRM_PURCHASE,
                payload: `airtime_card_flow_confirm_purchase-${subService === "fixed" ? "fixed" : "bundle"}`,
            },
            {
                content_type: "text",
                title: lang[selectedLanguage].MAIN_MENU,
                payload: `main_menu`
            }
        ];

        await quickReply({ sender: { id: senderId } }, message, quickReplies, "4");


    }
    // user has confirmed fixed airtime
    else if (payload?.includes("airtime_card_flow_confirm_purchase")) {
        const airtimeType = payload.split("-")[1];
        await handleOTPGeneration(selectedLanguage, senderId, `airtime_card_flow_confirm_purchase-otp-${airtimeType}`, `airtime_card_flow_confirm_purchase-otp-${airtimeType}`, "Transaction OTP");
    }

    // user has entered OTP
    else if (bot?.last_message?.includes("airtime_card_flow_confirm_purchase-otp") && !payload && text) {
        const airtimeType = bot?.last_message?.split("-")[2]
        const otpValidationResult = await validateOTP(senderId, text, `airtime_card_flow_confirm_purchase-otp-${airtimeType}`);
        console.log({ airtimeType }, bot?.last_message)
        // console.log({ otpValidationResult })
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

            const calculations = airtimeType === "ranged" ? decoded : decoded.converted

            const { exp, ...restOfDecoded } = decoded; // destructure to exclude exp
            const payload = {
                ...restOfDecoded,
                wallet_id: defaultWallet._id,
                number: bot.mobile_airtime.phone_number
            };

            const token = jwt.sign(payload, secretKey, { expiresIn: '2h' });

            const initiateTransaction = await initiateTopUpSavedCard(defaultWallet._id, parseFloat(calculations.total.value) * 100, bot.mobile_airtime.pan, token, airtimeType);

            console.log({ initiateTransaction })

            console.log(`https://my.insta-pay.ch/chatbot/pan-transaction?token=${initiateTransaction?.data?.token}&transaction_id=${initiateTransaction?.data?.transaction_id}&reference_id=${initiateTransaction?.data?.reference_id}&slug=confirm-chatbot-pan-airtime-topup`)
            if (initiateTransaction?.status) {

                const title = lang[selectedLanguage].VERIFY_CARD

                const subtitle = `
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(calculations.total.value)} ${defaultWallet?.currency?.code}
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
                                    url: `https://my.insta-pay.ch/chatbot/pan-transaction?token=${initiateTransaction?.data?.token}&transaction_id=${initiateTransaction?.data?.transaction_id}&reference_id=${initiateTransaction?.data?.reference_id}&slug=confirm-chatbot-pan-airtime-topup`,
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
            } else {
                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                ]
                await quickReply(data, lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR, quickReplies, "4");
            }
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {

                // clearing the data
                bot.mobile_airtime = undefined
                await bot.save()

                await quickMessage(data, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {

                await invalidMessage(data, `airtime_card_flow_confirm_purchase-otp-${airtimeType}`, selectedLanguage, bot?.otpType);
            }
        }
    }
}

module.exports = { handleAirtimeUsingCard, initiateTopUpSavedCard }
