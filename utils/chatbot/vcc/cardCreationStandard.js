const { quickMessage, quickReply, sendTemplate, userKYCVerificationTemplate, validateAttachments, somethingWentWrongQuickReply } = require("../../instaChatbotUtils");
const CryptoJS = require("crypto-js");
const currencyToEmoji = require('../../currencyEmojis.json');
const lang = require('../../languages/languages.json');
const PanModel = require("../../../models/Pan.model");
const Wallet = require("../../../models/Wallet.model");
const { balanceLimitCheck, limitCheck, featureCheck, getExchangeRatesToUSD, fetchLocalOrDefaultWalletConditionally } = require("../../helpers");
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
const { standardCardCreationUsingWallet } = require("./cardCreationStandardWallet");
const { standardCardCreationUsingPaypal } = require("./cardCreationStandardPaypal");

const secretKey = process.env.jwtKey;
async function VVCCreationStandard(senderId, payload, account, bot, text, selectedLanguage) {
    const data = {
        sender: {
            id: senderId
        }
    }
    if (payload === "activate_vcc_v_s_a") {
        const pans = await PanModel.find({ account: account._id });

        const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD;
        let quickReplies = [];

        if (pans.length !== 0) {
            // If cards exist, show payment options including cards
            quickReplies = [
                {
                    content_type: "text",
                    title: lang[selectedLanguage].PAYMENT_CARD,
                    payload: "activate_vcc_v_s_a_card"
                },
                {
                    content_type: "text",
                    title: lang[selectedLanguage].INSTAPAY_WALLETS,
                    payload: "activate_vcc_v_s_a_ip_w"
                },
                {
                    content_type: "text",
                    title: lang[selectedLanguage].PAYPAL,
                    payload: "activate_vcc_v_s_a_ppl"
                },
                {
                    content_type: "text",
                    title: lang[selectedLanguage].MAIN_MENU,
                    payload: "main_menu"
                }
            ];
        } else {
            // If no cards exist, show options without payment card
            quickReplies = [
                {
                    content_type: "text",
                    title: lang[selectedLanguage].INSTAPAY_WALLETS,
                    payload: "activate_vcc_v_s_a_ip_w"
                },
                {
                    content_type: "text",
                    title: lang[selectedLanguage].PAYPAL,
                    payload: "activate_vcc_v_s_a_ppl"
                },
                {
                    content_type: "text",
                    title: lang[selectedLanguage].ADD_PAYMENT_CARD,
                    payload: "add_payment_card-activate_vcc_v_s_a_methods"
                },
                {
                    content_type: "text",
                    title: lang[selectedLanguage].MAIN_MENU,
                    payload: "main_menu"
                }
            ];
        }

        // Send the message with quick replies
        await quickReply(data, message, quickReplies, "activate_vcc_v_s_a_payment_method");
    }

    // user has selected card payment with wallet 
    else if (payload?.includes("activate_vcc_v_s_a_ip_w")
        || (bot?.last_message?.includes("activate_vcc_v_s_a_ip_w") && text && !payload)
    ) {
        await standardCardCreationUsingWallet(senderId, payload, account, bot, text, selectedLanguage);
        return
    }

    // user has selected card payment with paypal
    else if (payload?.includes("activate_vcc_v_s_a_ppl")
        || (bot?.last_message?.includes("activate_vcc_v_s_a_ppl") && text && !payload)
    ) {
        await standardCardCreationUsingPaypal(senderId, payload, account, bot, text, selectedLanguage);
        return
    }
}

module.exports = { VVCCreationStandard }