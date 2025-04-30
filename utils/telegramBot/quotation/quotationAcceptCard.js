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

async function acceptQuotationCard(chatId, payload, chat, text, selectedLanguage) {
    if (payload === "quotation_accept_card") {
        const buttons = [
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];
        await sendButtons(chatId, "Updates are going on. Please wait while we process your payment.", buttons, "4");

    }
}

module.exports = { acceptQuotationCard }