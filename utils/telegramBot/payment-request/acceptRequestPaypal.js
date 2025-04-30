const { sendButtons, sendMessage, handleCountrySelection, invalidInputResponse, handleBeneficiaries, sendPhoto, processVideoUploads, processImageUploads, somethingWentWrongQuickReplyTelegram } = require("../../telegramBotUtils");
const lang = require("../../../utils/languages/languages.json");
const { getAvailableCountries, fetchCountriesFromThunes, getPayoutChannelName, balanceLimitCheck, validateAmount, usersFeatureMessage, generateRatingStars } = require("../../instaChatbotUtils");
const { getCountries, getPayerNames, getReviewsBySeller, formattedAmount, requestPayment, walletToWalletTransaction, buyerToSellerReview, sellerToBuyerReview, sellerToBuyerReply } = require("../../InstaChatbotHelpers");
const countries = require('../../../utils/countryIso.json');
const countryToEmoji = require('../../../utils/countryEmojis.json');
const Beneficiary = require("../../../models/Beneficiary.model");
const Account = require("../../../models/Account.model");
const Wallet = require("../../../models/Wallet.model");
const currencyToEmoji = require('../../../utils/currencyEmojis.json');
const { formatDecimalNumbersWithLimit } = require("../../payerRates");
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler");
const { getGeocodeData, getUserActiveWallets, getActiveWalletById, calculateExchangeAndFees, fetchLocalOrDefaultWalletConditionally } = require("../../helpers");
const TelegramBotModel = require("../../../models/TelegramBot.model");
const RequestPayment = require("../../../models/Request-Payment.model");
const PanModel = require("../../../models/Pan.model");
const { getExchangeRatesToUSD, checkTransactionLimitsForSender } = require("../../conversion");
const RequestReview = require("../../../models/RequestReview.model");
const { initiateW2WPaypalTransactionHelper } = require("../../chatbot/w2w/paypal/w2wUsingPaypal");
const jwt = require("jsonwebtoken");


async function acceptRequestPaypal(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(chat.account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReplyTelegram(chatId, lang[selectedLanguage].NO_DEFAULT_WALLET_SET, selectedLanguage);
    }
    else if (payload === "accept_req_pay_ppl") {
        const requestDetails = await RequestPayment.findById(chat.request.request_id).populate('wallet');

        const { exchange_rate, fee, totalAmountWithFee, recipient_amount, paypal } = await calculateExchangeAndFees(
            defaultWallet.currency.code,
            requestDetails?.wallet?.currency?.code,
            parseFloat(requestDetails.amount),
            "payment_request",
            chat.account?.level._id,
            "paypal",
            defaultWallet,
            "request"
        );

        console.log({ exchange_rate, fee, totalAmountWithFee, recipient_amount, paypal });

        let exchangedAmountSender = await getExchangeRatesToUSD(defaultWallet.currency.code, 'USD', totalAmountWithFee);
        const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, defaultWallet, 'sending');

        if (!sender_limits_check.status) {
            await sendMessage(chatId, sender_limits_check.message);
            return;
        }

        const amountToSendText = lang[selectedLanguage].AMOUNT_TO_SEND;
        const exchangeRateText = lang[selectedLanguage].EXCHANGE_RATE;
        const feeText = lang[selectedLanguage].FEE;
        const recipientGetsText = lang[selectedLanguage].RECIPIENT_GETS;
        const totalAmountText = lang[selectedLanguage].TOTAL_AMOUNT;
        let message;

        if (defaultWallet?.currency?.code !== requestDetails?.wallet?.currency?.code) {
            message = `
${amountToSendText}: ${formattedAmount(totalAmountWithFee - fee)} ${defaultWallet?.currency?.code}
    
${exchangeRateText}: 1.00 ${defaultWallet?.currency?.code} = ${exchange_rate} ${requestDetails?.wallet?.currency?.code}
${feeText}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}
    
${recipientGetsText} ${formattedAmount(recipient_amount)} ${requestDetails?.wallet?.currency?.code} 
    
${totalAmountText}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${defaultWallet?.currency?.code}
    `;
        } else {
            message = `
${amountToSendText}: ${formattedAmount(totalAmountWithFee - fee)} ${defaultWallet?.currency?.code}
    
${feeText}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}
    
${recipientGetsText} ${formattedAmount(recipient_amount)} ${requestDetails?.wallet?.currency?.code} 
    
${totalAmountText}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${defaultWallet?.currency?.code}
    `;
        }

        let paypalMessage = "";

        // Check if PayPal supports the currency
        if (!paypal?.paypal_currency_supported) {
            paypalMessage = `
${lang[selectedLanguage].PAYPAL_CURRENCY_NOT_SUPPORTED.replace('{{currency}}', defaultWallet?.currency?.code)}\n
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${defaultWallet?.currency?.code} = ${formattedAmount(paypal?.paypal_rate.value, 6)} ${paypal?.paypal_rate.currency}
${lang[selectedLanguage].AMOUNT_IN_USD}  ${formattedAmount(paypal?.paypal_converted.value)} ${paypal?.paypal_converted.currency}
    `;
        }

        const buttons = [
            [{ text: lang[selectedLanguage].PROCEED_TO_TRANSFER, callback_data: "accept_req_pay_ppl-proceed" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        // Determine if paypalMessage is required
        if (paypalMessage) {
            await sendMessage(chatId, message);
            await sendButtons(chatId, paypalMessage, buttons, "accept_req_pay_ppl-proceed");
        } else {
            await sendButtons(chatId, message, buttons, "accept_req_pay_ppl-proceed");
        }
    }

    // User has clicked on accept_req_pay_ppl-proceed
    else if (chat?.last_message === "accept_req_pay_ppl-proceed" && payload === "accept_req_pay_ppl-proceed") {
        await handleOTPGenerationTG(selectedLanguage, chat, "accept_req_pay_ppl-otp", "accept_req_pay_ppl-otp", "Transaction OTP");
    }

    // User has entered OTP for instant
    if (chat.last_message === "accept_req_pay_ppl-otp" && !payload && text) {
        const otpValidationResult = await validateOTPTG(chatId, text, "accept_req_pay_ppl-otp");

        if (otpValidationResult.status) {
            const requestDetails = await RequestPayment.findOne({
                $and: [{ _id: chat?.request?.request_id }, { status: "pending" }],
            });

            if (!requestDetails) {
                await sendMessage(chatId, lang[selectedLanguage].PAYMENT_REQUEST_STATUS);
                return;
            }

            const receivingWallet = await Wallet.findOne({ wallet_id: requestDetails.wallet_id });

            const rates = await calculateExchangeAndFees(
                defaultWallet.currency.code,
                receivingWallet.currency.code,
                parseFloat(requestDetails.amount),
                "payment_request",
                chat.account?.level._id,
                "paypal",
                defaultWallet,
                "request"
            );

            const files = requestDetails?.attachments.map((image) => ({
                key: image.key,
                url: image.url,
                ETag: image.ETag,
                status: true,
            }));

            const extrasPayload = {
                extras: {
                    exchange_rate: rates.exchange_rate,
                    fee: rates.fee,
                    totalAmountWithFee: rates.totalAmountWithFee,
                    recipient_amount: rates.recipient_amount,
                    feeType: rates.feeType,
                    markup: rates.markup,
                    original_rate: rates.original_rate,
                    topupFee: rates.topupFee,
                    feeToSendingRate: rates.feeToSendingRate,
                },
            };

            const token = jwt.sign(extrasPayload, process.env.jwtKey, { expiresIn: "10m" });

            let w2w_data = {
                sender_wallet_id: defaultWallet?._id,
                receiver_wallet_id: receivingWallet?.wallet_id,
                amount: requestDetails.amount,
                purpose: requestDetails?.purpose || "",
                type: "wallet_to_wallet",
                payment_type: "payment_request",
                link: requestDetails._id,
                description: requestDetails.description || "",
                attachments: files,
                transaction_type: "request",
                transaction_method: "wallet",
                token,
            };

            const JWTToken = jwt.sign(w2w_data, process.env.jwtKey, { expiresIn: "10m" });

            const initiateDetails = await initiateW2WPaypalTransactionHelper(rates, w2w_data, JWTToken, "request", "telegram");

            if (initiateDetails?.status) {
                const message = `
${lang[selectedLanguage].VERIFY_PAYPAL_ACCOUNT}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(rates.totalAmountWithFee)} ${defaultWallet?.currency?.code}
`;

                const buttons = [
                    [{ text: lang[selectedLanguage].VERIFY, url: initiateDetails?.url }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                ];

                await sendButtons(chatId, message, buttons, "4");
            } else {
                const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
                await sendButtons(chatId, initiateDetails?.message || lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR, buttons);
            }
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessageTG(chatId, "accept_req_pay_ppl-otp", selectedLanguage, chat?.otpType);
            }
        }
    }

}

module.exports = { acceptRequestPaypal }