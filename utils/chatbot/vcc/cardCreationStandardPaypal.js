const { quickMessage, quickReply, sendTemplate, userKYCVerificationTemplate, validateAttachments, somethingWentWrongQuickReply } = require("../../instaChatbotUtils");
const CryptoJS = require("crypto-js");
const currencyToEmoji = require('../../currencyEmojis.json');
const lang = require('../../languages/languages.json');
const PanModel = require("../../../models/Pan.model");
const Wallet = require("../../../models/Wallet.model");
const { balanceLimitCheck, limitCheck, featureCheck, getExchangeRatesToUSD, fetchLocalOrDefaultWalletConditionally, getMaxValidExpiryDateVCC, getActiveWalletById } = require("../../helpers");
const { topUpFeeCalculation } = require("../../../controllers/Trust-Payment.controller");

const Transaction = require("../../../models/Transaction.model");
const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const FeeModel = require("../../../models/Fee.model");
const { gettingExchangeRates, checkTransactionLimitsForSender } = require('../../conversion');
const { formattedAmount, uploadToS3, createTransaction, getPayerNames } = require("../../InstaChatbotHelpers");
const { handleOTPGeneration, validateOTP, invalidMessage } = require("../../instaChatbotOTP");
const { getIntlFXHelper, createQuotationNewHelper } = require("../../../controllers/Thune.controller");
const Beneficiary = require("../../../models/Beneficiary.model");
const User = require("../../../models/User.model");
const topupTransactionDataTokenKey = "bac6723rd@#dn#aFw%%Y%VSV"
const countriesIso = require('../../countries_iso2.json');
const VirtualCardModel = require("../../../models/Virtual-Card.model");
const { initiateCardCreationPaypalHelper } = require("../../telegramBot/vvc/paypalPremiumCardCreation");
const { formatDecimalNumbersWithLimit } = require("../../payerRates");
const supportedCurrencies = require("../../paypalSupportedCurrencies.json")

async function standardCardCreationUsingPaypal(senderId, payload, account, bot, text, selectedLanguage) {
    const data = {
        sender: {
            id: senderId
        }
    }
    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(account._id);
    if (!defaultWallet) {
        return await somethingWentWrongQuickReply(data, lang[selectedLanguage].NO_DEFAULT_WALLET_SET);
    }

    // User has selected PayPal
    if (payload === "activate_vcc_v_s_a_ppl" && bot?.last_message === "activate_vcc_v_s_a_payment_method") {
        const walletDetails = await getActiveWalletById(defaultWallet._id);

        const vvcFee = await FeeModel.findOne({ $and: [{ service_name: "vcc_standard_virtual" }, { account_level: account.level._id }] });

        const convertedFee = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD('USD', walletDetails.currency.code, vvcFee.flat_fee));

        let message = `
🔍 Please confirm the details below:  

💳 Card Type: Virtual  
🌟 Card Package: Standard  
💰 Fee: ${formattedAmount(convertedFee)} ${walletDetails.currency.code}`;

        let paypalMessage = "";
        let payloadData = {
            fee: convertedFee,
            currency: walletDetails.currency.code,
        };

        if (!supportedCurrencies.includes(walletDetails.currency.code)) {
            const paypalFX = await getExchangeRatesToUSD(walletDetails.currency.code, 'USD', 1);

            payloadData.currency_supported = false;
            payloadData.converted_fee = formatDecimalNumbersWithLimit(paypalFX * convertedFee);
            payloadData.paypal_rate = formattedAmount(paypalFX, 6);

            paypalMessage = `
${lang[selectedLanguage].PAYPAL_CURRENCY_NOT_SUPPORTED.replace('{{currency}}', walletDetails.currency.code)}\n
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${walletDetails.currency.code} = ${formattedAmount(paypalFX, 6)} USD
${lang[selectedLanguage].AMOUNT_IN_USD} ${formattedAmount(formatDecimalNumbersWithLimit(paypalFX * convertedFee))} USD`;
        }

        const token = jwt.sign(payloadData, process.env.jwtKey, { expiresIn: "5m" });
        bot.vcc.token = token;
        await bot.save();

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].CONFIRM, payload: "activate_vcc_v_s_a_ppl_confirm" },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
        ];

        if (paypalMessage) {
            await quickMessage(data, message);
            await quickReply(data, paypalMessage, quickReplies, "activate_vcc_v_s_a_ppl_confirm");
        } else {
            await quickReply(data, message, quickReplies, "activate_vcc_v_s_a_ppl_confirm");
        }
    }

    // User has confirmed
    else if (payload === "activate_vcc_v_s_a_ppl_confirm" && bot?.last_message === "activate_vcc_v_s_a_ppl_confirm") {
        await handleOTPGeneration(selectedLanguage, senderId, "activate_vcc_v_s_a_ppl-otp", "activate_vcc_v_s_a_ppl-otp", "Transaction OTP");
    }

    // User has entered OTP for instant transfer
    else if (bot.last_message === "activate_vcc_v_s_a_ppl-otp" && !payload && text) {
        const otpValidationResult = await validateOTP(senderId, text, "activate_vcc_v_s_a_ppl-otp");

        if (otpValidationResult.status) {
            jwt.verify(bot.vcc.token, process.env.jwtKey, async function (err, payloadData) {
                if (err) {
                    return await quickReply(data, "Your transaction has been expired. Please try again.", [
                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                    ], "4");
                }

                const { fee, currency, currency_supported, converted_fee, paypal_rate } = payloadData;

                const vccToken = jwt.sign({ expdate: getMaxValidExpiryDateVCC(), currency: 'USD', cardType: "vcc_standard_virtual" }, process.env.jwtKey, { expiresIn: "1h" });

                const transaction = await initiateCardCreationPaypalHelper({ wallet_id: defaultWallet.wallet_id, fee, currency, currency_supported, converted_fee, paypal_rate, card_type: "vcc_standard_virtual", token: vccToken, platform: "instagram" });

                if (transaction?.status) {

                    const templatePayload = {
                        template_type: "generic",
                        elements: [
                            {
                                title: lang[selectedLanguage].VERIFY_PAYPAL_ACCOUNT,
                                subtitle: `${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}`,
                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Request%20A%20Quote.png",
                                buttons: [
                                    {
                                        type: "web_url",
                                        title: lang[selectedLanguage].VERIFY,
                                        url: transaction?.url,
                                        webview_height_ratio: "full"
                                    },
                                    {
                                        type: "postback",
                                        title: lang[selectedLanguage].MAIN_MENU,
                                        payload: "main_menu"
                                    }
                                ]
                            }
                        ]
                    };

                    await sendTemplate(data, senderId, templatePayload);
                } else {
                    await quickReply(data, transaction?.message || lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR, [
                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                    ], "4");
                }
            });
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await quickMessage(data, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessage(data, "activate_vcc_v_s_a_ppl-otp", selectedLanguage, bot?.otpType);
            }
        }
    }
}

module.exports = {
    standardCardCreationUsingPaypal
}