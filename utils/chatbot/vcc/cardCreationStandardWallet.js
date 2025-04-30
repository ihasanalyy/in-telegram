const { quickMessage, quickReply, sendTemplate, userKYCVerificationTemplate, validateAttachments, somethingWentWrongQuickReply } = require("../../instaChatbotUtils");
const CryptoJS = require("crypto-js");
const currencyToEmoji = require('../../currencyEmojis.json');
const lang = require('../../languages/languages.json');
const PanModel = require("../../../models/Pan.model");
const Wallet = require("../../../models/Wallet.model");
const { balanceLimitCheck, limitCheck, featureCheck, getExchangeRatesToUSD, fetchLocalOrDefaultWalletConditionally, getUserActiveWallets, getMaxValidExpiryDateVCC, getActiveWalletById } = require("../../helpers");
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
const { formatDecimalNumbersWithLimit } = require("../../payerRates");
const { createVVCHelper } = require("../../../controllers/Virtual-Card.controller");

const secretKey = process.env.jwtKey;
async function standardCardCreationUsingWallet(senderId, payload, account, bot, text, selectedLanguage) {
    const data = {
        sender: {
            id: senderId
        }
    }
    // User is shown a list of wallets
    if (payload === "activate_vcc_v_s_a_ip_w") {
        const wallets = await getUserActiveWallets(account._id);
        const slicedWallets = wallets.slice(0, 8);

        let quickReplies = slicedWallets.map((wallet) => ({
            content_type: "text",
            title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`,
            payload: `activate_vcc_v_s_a_ip_w-${wallet._id}`
        }));

        quickReplies.push({
            content_type: "text",
            title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
            payload: "main_menu"
        });

        await quickReply(data, lang[selectedLanguage].SELECT_WALLET_CURRENCY, quickReplies, "activate_vcc_v_s_a_ip_w_wallets");
    }

    // User has selected a currency
    else if (payload?.includes('activate_vcc_v_s_a_ip_w-') && bot?.last_message === "activate_vcc_v_s_a_ip_w_wallets") {
        const walletID = payload.split('-')[1];
        const walletDetails = await getActiveWalletById(walletID);

        bot.vcc.wallet = walletID;
        await bot.save();

        const message = lang[selectedLanguage].CURRENTLY_HAVE
            .replace('{{amount}}', formattedAmount(walletDetails?.balance?.available))
            .replace('{{currency}}', walletDetails.currency.code);

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].CHANGE_WALLET, payload: "activate_vcc_v_s_a_ip_w" },
            { content_type: "text", title: lang[selectedLanguage].PROCEED_TITLE, payload: "activate_vcc_v_s_a_ip_w_proceed" },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
        ];

        await quickReply(data, message, quickReplies, "activate_vcc_v_s_a_ip_w_proceed");
    }

    // User has selected proceed
    else if (payload === "activate_vcc_v_s_a_ip_w_proceed" && bot?.last_message === "activate_vcc_v_s_a_ip_w_proceed") {
        const walletDetails = await getActiveWalletById(bot.vcc.wallet);
        const vvcFee = await FeeModel.findOne({ $and: [{ service_name: "vcc_standard_virtual" }, { account_level: account.level._id }] });

        const convertedFee = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD('USD', walletDetails.currency.code, vvcFee.flat_fee));

        const message = `
🔍 Please confirm the details below:  

💳 Card Type: Virtual  
🌟 Card Package: Standard  
💰 Fee: ${formattedAmount(convertedFee)} ${walletDetails.currency.code}`;

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].CONFIRM, payload: "activate_vcc_v_s_a_ip_w_confirm" },
            { content_type: "text", title: lang[selectedLanguage].CHANGE_WALLET, payload: "activate_vcc_v_s_a_ip_w" },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
        ];

        await quickReply(data, message, quickReplies, "activate_vcc_v_s_a_ip_w_confirm");
    }

    // User has confirmed, we will check the balance validation too
    else if (payload === "activate_vcc_v_s_a_ip_w_confirm" && bot?.last_message === "activate_vcc_v_s_a_ip_w_confirm") {
        const walletDetails = await getActiveWalletById(bot.vcc.wallet);
        const vvcFee = await FeeModel.findOne({ $and: [{ service_name: "vcc_standard_virtual" }, { account_level: account.level._id }] });

        const convertedFee = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD('USD', walletDetails.currency.code, vvcFee.flat_fee));

        // Balance validation
        if (walletDetails.balance.available < convertedFee) {
            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].CHANGE_WALLET, payload: "activate_vcc_v_s_a_ip_w" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
            ];

            await quickReply(data, lang[selectedLanguage].INSUFFICIENT_BALANCE, quickReplies, "activate_vcc_v_s_a_ip_w_balance_insufficient");
        } else {
            await handleOTPGeneration(selectedLanguage, senderId, "activate_vcc_v_s_a_ip_w-otp", "activate_vcc_v_s_a_ip_w-otp", "Transaction OTP");
        }
    }

    // User has entered OTP
    else if (bot.last_message === "activate_vcc_v_s_a_ip_w-otp" && text && !payload) {
        const otpValidationResult = await validateOTP(senderId, text, "activate_vcc_v_s_a_ip_w-otp");

        if (otpValidationResult.status) {
            const walletDetails = await getActiveWalletById(bot.vcc.wallet);
            const data = {
                currency: "USD",
                expdate: getMaxValidExpiryDateVCC(),
                account_id: account._id,
                wallet_id: walletDetails.wallet_id,
                cardType: "vcc_standard_virtual"
            };
            console.log({ data });

            const vvcCreation = await createVVCHelper(data);

            if (vvcCreation.status) {
                const templatePayload = {
                    template_type: "generic",
                    elements: [
                        {
                            title: "🎉 Done! Your InstaPay Virtual Card is ready to use! 🚀",
                            subtitle: `👉 iPhone Users: Add your card to Apple Wallet for instant tap-to-pay convenience!
👉 Android Users: Google Pay support is coming soon! Stay tuned.`,
                            image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Standard1.png",
                            buttons: [
                                {
                                    type: "postback",
                                    title: "Card Management Menu",
                                    payload: "vcc_menu"
                                }
                            ]
                        }
                    ]
                };
                await sendTemplate(data, senderId, templatePayload, "4");

                const templatePayload1 = {
                    template_type: "generic",
                    elements: [
                        {
                            title: "🌍 Want to explore more card features? Visit our InstaPay Guide for detailed information! 🔗",
                            buttons: [
                                {
                                    type: "web_url",
                                    title: "📖 InstaPay Guide",
                                    url: `https://instapay.gitbook.io/kemit-kingdom-sa/8CXSlU3g9aU7Li42DHE4/faq/faq/instapay-mastercard-virtual-prepaid-card`,
                                    webview_height_ratio: "full"
                                },
                                {
                                    type: "postback",
                                    title: "🔄 Need more help? Let’s chat!",
                                    payload: "chat_with_us"
                                }
                            ]
                        }
                    ]
                };
                await sendTemplate(data, senderId, templatePayload1);
            } else {
                let message;
                if (vvcCreation.message?.includes("Insufficient")) {
                    message = lang[selectedLanguage].INSUFFICIENT_BALANCE;
                } else if (vvcCreation.message?.includes("maximum")) {
                    message = lang[selectedLanguage].LIMIT_VIRTUAL_CARDS;
                } else {
                    message = lang[selectedLanguage].SOMETHING_WENT_WRONG_;
                }

                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }
                ];
                await quickReply(data, message, quickReplies, "4");
            }
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await quickMessage(data, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessage(data, "activate_vcc_v_s_a_ip_w-otp", selectedLanguage, bot?.otpType);
            }
        }
    }
}

module.exports = {
    standardCardCreationUsingWallet
}