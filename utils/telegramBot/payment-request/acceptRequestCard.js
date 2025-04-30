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
const { getGeocodeData, getUserActiveWallets, getActiveWalletById, calculateExchangeAndFees, fetchLocalOrDefaultWalletConditionally, validateCardExpiry } = require("../../helpers");
const TelegramBotModel = require("../../../models/TelegramBot.model");
const RequestPayment = require("../../../models/Request-Payment.model");
const PanModel = require("../../../models/Pan.model");
const { getExchangeRatesToUSD, checkTransactionLimitsForSender } = require("../../conversion");
const RequestReview = require("../../../models/RequestReview.model");
const { initiateW2WPaypalTransactionHelper } = require("../../chatbot/w2w/paypal/w2wUsingPaypal");
const jwt = require("jsonwebtoken");
const { initiateTopUpSavedCard } = require("../../chatbot/w2w/card/w2wUsingCard");


async function acceptRequestCard(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(chat.account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReplyTelegram(chatId, lang[selectedLanguage].NO_DEFAULT_WALLET_SET, selectedLanguage);
    }

    if (payload === "accept_req_pay_card") {
        const pans = await PanModel.find({ account: chat.account._id });
        console.log(pans);

        let buttons = [];

        if (pans.length !== 0) {
            for (let i = 0; i < pans.length; i++) {
                buttons.push([
                    {
                        text: `💳 *******${pans[i].last4}`,
                        callback_data: `accept_req_pay_card-${pans[i]._id}`
                    }
                ]);
            }

            buttons.push([{ text: lang[selectedLanguage].CHANGE_PAYMENT_METHOD, callback_data: "back_request" }]);
            buttons.push([{ text: `☰ ${lang[selectedLanguage].MAIN_MENU}`, callback_data: "main_menu" }]);

            await sendButtons(chatId, lang[selectedLanguage].SELECT_YOUR_TOPUP_CHANNEL, buttons, "accept_req_pay_card");
        } else {
            buttons.push([{ text: `☰ ${lang[selectedLanguage].MAIN_MENU}`, callback_data: "main_menu" }]);
            await sendButtons(chatId, lang[selectedLanguage].NO_CARD_SAVED, buttons);
        }
    }

    // User has selected a card
    else if (payload?.startsWith("accept_req_pay_card-") && chat?.last_message === "accept_req_pay_card") {
        const cardId = payload.split("-")[1];
        const cardDetails = await PanModel.findById(cardId);

        // Account validation
        if (cardDetails.account.toString() !== chat?.account._id.toString()) {
            await sendMessage(chatId, lang[selectedLanguage].CARD_NOT_BELONG);
            return;
        }

        //  Validate card expiry using
        const expiryValidation = await validateCardExpiry(cardId);

        if (!expiryValidation.status) {
            // Handle expired or invalid card
            const pans = await PanModel.find({ account: chat?.account._id });

            let buttons = [];

            if (pans.length !== 0) {
                buttons = [
                    [{ text: lang[selectedLanguage].PAYMENT_CARD, callback_data: "accept_req_pay_card" }],
                    [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "accept_req_pay_wallet" }],
                    [{ text: lang[selectedLanguage].PAYPAL, callback_data: "accept_req_pay_ppl" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                ];
            } else {
                buttons = [
                    [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "accept_req_pay_wallet" }],
                    [{ text: lang[selectedLanguage].PAYPAL, callback_data: "accept_req_pay_ppl" }],
                    [{ text: lang[selectedLanguage].ADD_PAYMENT_CARD, callback_data: "add_payment_card-accept_req_pay_back" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                ];
            }

            await sendButtons(
                chatId,
                lang[selectedLanguage].SELECTED_CARD_EXPIRED,
                buttons,
                "accept_req_pay"
            );
            return;
        }
        chat.wallet_to_wallet.card.pan = cardId;
        await chat.save();

        const requestDetails = await RequestPayment.findById(chat.request.request_id).populate('wallet');

        const { exchange_rate, fee, totalAmountWithFee, recipient_amount } = await calculateExchangeAndFees(
            defaultWallet.currency.code,
            requestDetails?.wallet?.currency?.code,
            parseFloat(requestDetails.amount),
            "payment_request",
            chat.account?.level._id,
            "card",
            defaultWallet,
            "request"
        );

        console.log({ exchange_rate, fee, totalAmountWithFee, recipient_amount });

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

        const buttons = [
            [{ text: lang[selectedLanguage].PROCEED_TO_TRANSFER, callback_data: "accept_req_pay_card-proceed" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "accept_req_pay_card-proceed");
    }
    // User has clicked on accept_req_pay_card-proceed
    else if (chat?.last_message === "accept_req_pay_card-proceed" && payload === "accept_req_pay_card-proceed") {
        await handleOTPGenerationTG(selectedLanguage, chat, "accept_req_pay_card-otp", "accept_req_pay_card-otp", "Transaction OTP");
    }
    else if (chat.last_message === "accept_req_pay_card-otp" && !payload && text) {
        const otpValidationResult = await validateOTPTG(chatId, text, "accept_req_pay_card-otp");

        if (otpValidationResult.status) {
            const requestDetails = await RequestPayment.findOne({
                $and: [{ _id: chat.request?.request_id }, { status: 'pending' }]
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
                "card",
                defaultWallet,
                "request"
            );

            const files = requestDetails?.attachments.map(image => ({
                key: image.key,
                url: image.url,
                ETag: image.ETag,
                status: true
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
                    feeToSendingRate: rates.feeToSendingRate
                }
            };

            const token = jwt.sign(extrasPayload, process.env.jwtKey, { expiresIn: "10m" });

            let w2w_data = {
                sender_wallet_id: defaultWallet?._id,
                receiver_wallet_id: receivingWallet?.wallet_id,
                amount: requestDetails.amount,
                purpose: requestDetails?.purpose || "",
                type: 'wallet_to_wallet',
                payment_type: 'payment_request',
                link: requestDetails._id,
                description: requestDetails.description || "",
                attachments: files,
                transaction_type: "request",
                transaction_method: "card",
                token,
                request_id: requestDetails._id
            };

            const transactionDetails = await initiateTopUpSavedCard(
                defaultWallet._id,
                parseFloat(rates.totalAmountWithFee) * 100,
                chat.wallet_to_wallet.card.pan,
                w2w_data
            );

            console.log({ transactionDetails })

            if (transactionDetails?.status) {
                const message = `${lang[selectedLanguage].VERIFY_CARD}\n\n${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(rates.totalAmountWithFee)} ${defaultWallet?.currency?.code}`;

                const buttons = [
                    [{
                        text: lang[selectedLanguage].VERIFY,
                        url: `https://my.insta-pay.ch/chatbot/pan-transaction?token=${transactionDetails?.data?.token}&transaction_id=${transactionDetails?.data?.transaction_ref}&reference_id=${transactionDetails?.data?.reference_id}&w2w_token=${transactionDetails?.data?.w2w_data}&slug=confirm-chatbot-w2w-pan-topup-telegram`
                    }],
                    [{
                        text: lang[selectedLanguage].MAIN_MENU,
                        callback_data: "main_menu"
                    }]
                ];
                await sendButtons(chatId, message, buttons);
            } else {
                const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
                await sendButtons(chatId, transactionDetails?.message || lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR, buttons);
            }
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessageTG(chatId, "accept_req_pay_card-otp", selectedLanguage, chat?.otpType);
            }
        }
    }

}

module.exports = { acceptRequestCard }