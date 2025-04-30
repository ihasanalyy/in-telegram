const Wallet = require("../../../models/Wallet.model");
const lang = require("../../languages/languages.json");
const currencyToEmoji = require('../../currencyEmojis.json');
const { checkTransactionLimitsForSender } = require("../../conversion");
const { calculateExchangeAndFees, getExchangeRatesToUSD, getUserActiveWallets, getMaxValidExpiryDateVCC, getActiveWalletById, fetchLocalOrDefaultWalletConditionally, limitCheck, featureCheck, getActiveWallet } = require("../../helpers");
const { formattedAmount, walletToWalletTransaction } = require("../../InstaChatbotHelpers");
const { validateAmount, usersFeatureMessage, userLimitsMessage, generateToken } = require("../../instaChatbotUtils");
const { sendButtons, sendMessage, invalidInputResponse, w2wMethods, processVideoUploads, processImageUploads, sendPhoto, somethingWentWrongQuickReplyTelegram } = require("../../telegramBotUtils");
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler");
const Schedule = require("../../../models/Schedule.model");
const FeeModel = require("../../../models/Fee.model");
const { formatDecimalNumbersWithLimit } = require("../../payerRates");
const supportedCurrencies = require("../../paypalSupportedCurrencies.json");
const Transaction = require("../../../models/Transaction.model");
const { initiateCardCreationPaypalHelper } = require("./paypalPremiumCardCreation");

async function standardCardCreationUsingPaypal(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(chat.account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReplyTelegram(chatId, lang[selectedLanguage].NO_DEFAULT_WALLET_SET, selectedLanguage);
    }
    // user has selected paypal
    if (payload === "activate_vcc_v_s_a_ppl" && chat?.last_message === "activate_vcc_v_s_a_payment_method") {
        const walletDetails = await getActiveWalletById(defaultWallet._id);

        const vvcFee = await FeeModel.findOne({ $and: [{ service_name: "vcc_standard_virtual" }, { account_level: chat.account.level._id }] });

        const convertedFee = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD('USD', walletDetails.currency.code, vvcFee.flat_fee));

        let message = lang[selectedLanguage].CONFIRM_CARD_DETAILS_STANDARD.replace("{{currency}}", walletDetails.currency.code).replace("{{amount}}", formattedAmount(convertedFee));


        let paypalMessage = "";
        let payload = {
            fee: convertedFee,
            currency: walletDetails.currency.code,
        }

        if (!supportedCurrencies.includes(walletDetails.currency.code)) {
            const paypalFX = await getExchangeRatesToUSD(walletDetails.currency.code, 'USD', 1);

            payload.currency_supported = false;
            payload.converted_fee = formatDecimalNumbersWithLimit(paypalFX * convertedFee);
            payload.paypal_rate = formattedAmount(paypalFX, 6);

            paypalMessage = `
${lang[selectedLanguage].PAYPAL_CURRENCY_NOT_SUPPORTED.replace('{{currency}}', walletDetails.currency.code)}\n
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${walletDetails.currency.code} = ${formattedAmount(paypalFX, 6)} USD
${lang[selectedLanguage].AMOUNT_IN_USD} ${formattedAmount(formatDecimalNumbersWithLimit(paypalFX * convertedFee))} USD`;
        }

        const token = jwt.sign(payload, process.env.jwtKey, { expiresIn: "5m" });
        chat.vcc.token = token;
        await chat.save()

        const buttons = [
            [{ text: lang[selectedLanguage].CONFIRM, callback_data: "activate_vcc_v_s_a_ppl_confirm" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        if (paypalMessage) {
            await sendMessage(chatId, message);
            await sendButtons(chatId, paypalMessage, buttons, "activate_vcc_v_s_a_ppl_confirm");
        } else {
            await sendButtons(chatId, message, buttons, "activate_vcc_v_s_a_ppl_confirm");
        }
    }

    // user has confirmed
    else if (payload === "activate_vcc_v_s_a_ppl_confirm" && chat?.last_message === "activate_vcc_v_s_a_ppl_confirm") {
        await handleOTPGenerationTG(selectedLanguage, chat, "activate_vcc_v_s_a_ppl-otp", "activate_vcc_v_s_a_ppl-otp", "Transaction OTP");
    }

    // User has entered OTP for instant transfer
    else if (chat.last_message === "activate_vcc_v_s_a_ppl-otp" && !payload && text) {
        const otpValidationResult = await validateOTPTG(chatId, text, "activate_vcc_v_s_a_ppl-otp");

        if (otpValidationResult.status) {
            jwt.verify(chat.vcc.token, process.env.jwtKey, async function (err, payload) {
                if (err) {
                    return await sendButtons(chatId, lang[selectedLanguage].TRANSACTION_EXPIRED, [[{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]], "4");
                }

                const { fee, currency, currency_supported, converted_fee, paypal_rate } = payload;

                const vccToken = jwt.sign({ expdate: getMaxValidExpiryDateVCC(), currency: 'USD', cardType: "vcc_standard_virtual" }, process.env.jwtKey, { expiresIn: "1h" });

                const transaction = await initiateCardCreationPaypalHelper({ wallet_id: defaultWallet.wallet_id, fee, currency, currency_supported, converted_fee, paypal_rate, card_type: "vcc_standard_virtual", token: vccToken, platform: "telegram" });

                if (transaction?.status) {
                    const message = `
    ${lang[selectedLanguage].VERIFY_PAYPAL_ACCOUNT}
    
    ${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}
                `;

                    const buttons = [
                        [{ text: lang[selectedLanguage].VERIFY, url: transaction?.url }],
                        [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                    ];

                    await sendButtons(chatId, message, buttons);
                } else {
                    const buttons = [
                        [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                    ];
                    await sendButtons(chatId, transaction?.message || lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR, buttons);
                }

            })
        }
        else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessageTG(chatId, "activate_vcc_v_s_a_ppl-otp", selectedLanguage, chat?.otpType);
            }
        }
    }
}

module.exports = { standardCardCreationUsingPaypal }