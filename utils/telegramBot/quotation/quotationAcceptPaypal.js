const { sendButtons, sendMessage, sendPhoto, processVideoUploads, processImageUploads, handleBeneficiaries, somethingWentWrongQuickReplyTelegram } = require("../../telegramBotUtils");
const lang = require("../../../utils/languages/languages.json");
const { validateAmount, balanceLimitCheck, formatDateToDDMMYYYY, getCountryNameByCode, usersFeatureMessage, userLimitsMessage } = require("../../instaChatbotUtils");
const { formattedAmount, addQuotation, bargain, declineQuotation, walletToWalletTransaction } = require("../../InstaChatbotHelpers");
const countries = require('../../../utils/countryIso.json');
const countryToEmoji = require('../../../utils/countryEmojis.json');
const PanModel = require("../../../models/Pan.model");
const currencyToEmoji = require('../../../utils/currencyEmojis.json');
const Beneficiary = require("../../../models/Beneficiary.model");
const Account = require("../../../models/Account.model");
const { getUserActiveWallets, getActiveWalletById, calculateExchangeAndFees, fetchLocalOrDefaultWalletConditionally, getExchangeRatesToUSD } = require("../../helpers");
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler");
const TelegramBotModel = require("../../../models/TelegramBot.model");
const moment = require('moment-timezone');
const Quotation = require("../../../models/Quotation.model");
const Wallet = require("../../../models/Wallet.model");
const { initiateW2WPaypalTransactionHelper } = require("../../chatbot/w2w/paypal/w2wUsingPaypal");
const { checkTransactionLimitsForSender } = require("../../conversion");
const jwt = require("jsonwebtoken")
async function acceptQuotationPaypal(chatId, payload, chat, text, selectedLanguage) {
    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(chat.account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReplyTelegram(chatId, lang[selectedLanguage].NO_DEFAULT_WALLET);
    }

    else if (payload === "quotation_accept_paypal") {
        const quotation = await Quotation.findById(chat.quotation.accepting_quotation).populate("amount_reciever_currency");

        const { exchange_rate, fee, totalAmountWithFee, recipient_amount, paypal } = await calculateExchangeAndFees(
            defaultWallet.currency.code,
            quotation.amount_reciever_currency.currency.code,
            parseFloat(quotation?.revised_amount || quotation?.amount),
            "quotation",
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

        if (defaultWallet?.currency?.code !== quotation.amount_reciever_currency.currency.code) {
            message = `
${amountToSendText}: ${formattedAmount(totalAmountWithFee - fee)} ${defaultWallet?.currency?.code}
    
${exchangeRateText}: 1.00 ${defaultWallet?.currency?.code} = ${exchange_rate} ${quotation.amount_reciever_currency.currency.code}
${feeText}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}
    
${recipientGetsText} ${formattedAmount(recipient_amount)} ${quotation.amount_reciever_currency.currency.code} 
    
${totalAmountText}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${defaultWallet?.currency?.code}
    `;
        } else {
            message = `
${amountToSendText}: ${formattedAmount(totalAmountWithFee - fee)} ${defaultWallet?.currency?.code}
    
${feeText}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}
    
${recipientGetsText} ${formattedAmount(recipient_amount)} ${quotation.amount_reciever_currency.currency.code} 
    
${totalAmountText}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${defaultWallet?.currency?.code}
    `;
        }

        let paypalMessage = "";

        // Check if PayPal supports the currency
        if (!paypal?.paypal_currency_supported) {
            paypalMessage = `
${lang[selectedLanguage].PAYPAL_CURRENCY_NOT_SUPPORTED.replace('{{currency}}', defaultWallet?.currency?.code)}\n
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${defaultWallet?.currency?.code} = ${formattedAmount(paypal?.paypal_rate.value, 6)} ${paypal?.paypal_rate.currency}
${lang[selectedLanguage].AMOUNT_IN_USD}: ${formattedAmount(paypal?.paypal_converted.value)} ${paypal?.paypal_converted.currency}
    `;
        }

        const buttons = [
            [{ text: lang[selectedLanguage].PROCEED_TO_TRANSFER, callback_data: "quotation_accept_paypal-proceed" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        if (paypalMessage) {
            await sendMessage(chatId, message);
            await sendButtons(chatId, paypalMessage, buttons, "quotation_accept_paypal");
        } else {
            await sendButtons(chatId, message, buttons, "quotation_accept_paypal");
        }
    }

    else if (payload === "quotation_accept_paypal-proceed" && chat?.last_message === "quotation_accept_paypal") {
        await handleOTPGenerationTG(selectedLanguage, chat, "quotation_accept_paypal-otp", "quotation_accept_paypal-otp", "Transaction OTP");
    }

    else if (chat.last_message === "quotation_accept_paypal-otp" && text) {
        const otpValidationResult = await validateOTPTG(chatId, text, "quotation_accept_paypal-otp");

        if (otpValidationResult.status) {
            const quotationDetails = await Quotation.findOne({
                _id: chat.quotation?.accepting_quotation,
                status: { $nin: ['accepted', 'declined'] }
            }).populate("amount_reciever_currency");

            if (!quotationDetails) {
                await sendMessage(chatId, lang[selectedLanguage].QUOTATION_ALREADY_PROCESSED);
                return;
            }

            const receivingWallet = await Wallet.findById(quotationDetails.amount_reciever_currency);
            const rates = await calculateExchangeAndFees(defaultWallet.currency.code, quotationDetails.amount_reciever_currency.currency.code, parseFloat(quotationDetails?.revised_amount || quotationDetails?.amount), "quotation", chat.account?.level._id, "paypal", defaultWallet, "request");

            let amount = quotationDetails.revised_amount || quotationDetails.amount;

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
                amount,
                purpose: quotationDetails.purpose || "",
                type: 'wallet_to_wallet',
                payment_type: 'quotation',
                link: quotationDetails._id,
                description: quotationDetails.desc,
                attachments: [],
                transaction_type: "request",
                transaction_method: "wallet",
                token
            };

            const JWTToken = jwt.sign(w2w_data, process.env.jwtKey, { expiresIn: '10m' });

            const initiateDetails = await initiateW2WPaypalTransactionHelper(rates, w2w_data, JWTToken, "quotation", "telegram");

            if (initiateDetails?.status) {
                const title = lang[selectedLanguage].VERIFY_PAYPAL_ACCOUNT;
                const subtitle = `${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(rates.totalAmountWithFee)} ${defaultWallet?.currency?.code}`;

                const buttons = [
                    [{ text: lang[selectedLanguage].VERIFY, url: initiateDetails?.url }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];

                await sendButtons(chatId, `${title}\n\n${subtitle}`, buttons, "4");
            } else {
                await sendButtons(chatId, initiateDetails?.message || lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR, [
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ], "4");
            }
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {
                await invalidMessageTG(chatId, "quotation_accept_paypal-otp", selectedLanguage, chat?.otpType);
            }
        }
    }

}

module.exports = { acceptQuotationPaypal }