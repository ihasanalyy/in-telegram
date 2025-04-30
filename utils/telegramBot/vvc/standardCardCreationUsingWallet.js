const Wallet = require("../../../models/Wallet.model");
const lang = require("../../languages/languages.json");
const currencyToEmoji = require('../../currencyEmojis.json');
const { checkTransactionLimitsForSender } = require("../../conversion");
const { calculateExchangeAndFees, getExchangeRatesToUSD, getUserActiveWallets, getMaxValidExpiryDateVCC, getActiveWalletById } = require("../../helpers");
const { formattedAmount, walletToWalletTransaction } = require("../../InstaChatbotHelpers");
const { validateAmount, usersFeatureMessage, userLimitsMessage, generateToken } = require("../../instaChatbotUtils");
const { sendButtons, sendMessage, invalidInputResponse, w2wMethods, processVideoUploads, processImageUploads, sendPhoto } = require("../../telegramBotUtils");
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler");
const Schedule = require("../../../models/Schedule.model");
const FeeModel = require("../../../models/Fee.model");
const { formatDecimalNumbersWithLimit } = require("../../payerRates");
const { createVVCHelper } = require("../../../controllers/Virtual-Card.controller");

async function standardCardCreationUsingWallet(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    // user is shown list of wallets
    if (payload === "activate_vcc_v_s_a_ip_w"
        && (chat?.last_message === "activate_vcc_v_s_a_payment_method"
            || chat?.last_message === "activate_vcc_v_s_a_ip_w_wallets"
            || chat?.last_message === "activate_vcc_v_s_a_ip_w_confirm"
            || chat?.last_message === "activate_vcc_v_s_a_ip_w_balance_insufficient"
            || chat?.last_message === "activate_vcc_v_s_a_ip_w_proceed")
    ) {
        const wallets = await getUserActiveWallets(chat.account._id)
        const slicedWallets = wallets.slice(0, 8);

        let buttons = [slicedWallets.map((wallet) => (
            { text: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, callback_data: `activate_vcc_v_p_a_ip_w-${wallet._id}` }
        ))];

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);

        await sendButtons(chatId, lang[selectedLanguage].SELECT_WALLET_CURRENCY, buttons, "activate_vcc_v_s_a_ip_w_wallets");
    }
    // user has selected a currency
    else if (payload?.includes('activate_vcc_v_p_a_ip_w-') && chat?.last_message === "activate_vcc_v_s_a_ip_w_wallets") {
        const walletID = payload.split('-')[1];
        const walletDetails = await getActiveWalletById(walletID);

        chat.vcc.wallet = walletID;
        await chat.save();

        const message = lang[selectedLanguage].CURRENTLY_HAVE
            .replace('{{amount}}', formattedAmount(walletDetails?.balance?.available))
            .replace('{{currency}}', walletDetails.currency.code);

        const buttons = [
            [{ text: lang[selectedLanguage].CHANGE_WALLET, callback_data: "activate_vcc_v_s_a_ip_w" }],
            [{ text: lang[selectedLanguage].PROCEED_TITLE, callback_data: "activate_vcc_v_s_a_ip_w_proceed" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "activate_vcc_v_s_a_ip_w_proceed");
    }
    // user has selected proceed
    else if (payload === "activate_vcc_v_s_a_ip_w_proceed" && chat?.last_message === "activate_vcc_v_s_a_ip_w_proceed") {
        const walletDetails = await getActiveWalletById(chat.vcc.wallet);

        const vvcFee = await FeeModel.findOne({ $and: [{ service_name: "vcc_standard_virtual" }, { account_level: chat.account.level._id }] })

        const convertedFee = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD('USD', walletDetails.currency.code, vvcFee.flat_fee))

        const message = `
        🔍 Please confirm the details below:  

💳 Card Type: Virtual  
🌟 Card Package: Standard  
💰 Fee: ${formattedAmount(convertedFee)} ${walletDetails.currency.code} `

        const buttons = [
            [{ text: lang[selectedLanguage].CONFIRM, callback_data: "activate_vcc_v_s_a_ip_w_confirm" }],
            [{ text: lang[selectedLanguage].CHANGE_WALLET, callback_data: "activate_vcc_v_s_a_ip_w" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "activate_vcc_v_s_a_ip_w_confirm");

    }
    // user has confirmed, we will check the balance validation too
    else if (payload === "activate_vcc_v_s_a_ip_w_confirm" && chat?.last_message === "activate_vcc_v_s_a_ip_w_confirm") {
        const walletDetails = await getActiveWalletById(chat.vcc.wallet);

        const vvcFee = await FeeModel.findOne({ $and: [{ service_name: "vcc_standard_virtual" }, { account_level: chat.account.level._id }] })

        const convertedFee = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD('USD', walletDetails.currency.code, vvcFee.flat_fee))

        // balance validation
        if (walletDetails.balance.available < convertedFee) {
            const buttons = [
                [{ text: lang[selectedLanguage].CHANGE_WALLET, callback_data: "activate_vcc_v_s_a_ip_w" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];

            await sendButtons(chatId, lang[selectedLanguage].INSUFFICIENT_BALANCE, buttons, "activate_vcc_v_s_a_ip_w_balance_insufficient");
        } else {
            await handleOTPGenerationTG(selectedLanguage, chat, "activate_vcc_v_s_a_ip_w-otp", "activate_vcc_v_s_a_ip_w-otp");
        }
    }

    else if (chat.last_message === "activate_vcc_v_s_a_ip_w-otp" && text && !payload) {
        const otpValidationResult = await validateOTPTG(chatId, text, "activate_vcc_v_s_a_ip_w-otp");

        if (otpValidationResult.status) {

            const walletDetails = await getActiveWalletById(chat.vcc.wallet);
            const data = {
                currency: "USD",
                expdate: getMaxValidExpiryDateVCC(),
                account_id: chat.account._id,
                wallet_id: walletDetails.wallet_id,
                cardType: "vcc_standard_virtual"
            }
            console.log({ data })

            const vvcCreation = await createVVCHelper(data)

            if (vvcCreation.status) {
                await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Standard1.png");

                const message = `🎉 Done! Your InstaPay Virtual Card is ready to use! 🚀


👉 iPhone Users: Add your card to Apple Wallet for instant tap-to-pay convenience!
👉 Android Users: Google Pay support is coming soon! Stay tuned.
`

                await sendButtons(chatId, message, [[{ text: "Card Management Menu", callback_data: "vcc_menu" }]], "4");
                const message1 = `🌍 Want to explore more card features?
Visit our InstaPay Guide for detailed information! 🔗

`

                await sendButtons(chatId, message1, [
                    [{ text: "📖 InstaPay Guide", url: "https://instapay.gitbook.io/kemit-kingdom-sa/8CXSlU3g9aU7Li42DHE4/faq/faq/instapay-mastercard-virtual-prepaid-card" }],
                    [{ text: "🔄 Need more help? Let’s chat!", callback_data: "main_menu" }]
                ]);
            } else {
                let message;
                if (vvcCreation.message?.includes("Insufficient")) {
                    message = lang[selectedLanguage].INSUFFICIENT_BALANCE;
                } else if (vvcCreation.message?.includes("maximum")) {
                    message = "You can only have a maximum of 3 virtual cards.";
                } else {
                    message = "Something went wrong. Please try again later.";
                }

                await sendButtons(chatId, message, [[{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]], "4");
            }

        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {
                await invalidMessageTG(chatId, "activate_vcc_v_s_a_ip_w-otp", selectedLanguage, chat?.otpType);
            }
        }
    }
}

module.exports = { standardCardCreationUsingWallet }