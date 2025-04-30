const Country = require("../../../models/Country.model")
const FeeModel = require("../../../models/Fee.model");
const PanModel = require("../../../models/Pan.model");
const { formattedAmount } = require("../../InstaChatbotHelpers")
const { sendPhoto, sendMessage, sendButtons } = require("../../telegramBotUtils");
const { standardCardCreationUsingPaypal } = require("./paypalStandardCardCreation");
const { standardCardCreationUsingWallet } = require("./standardCardCreationUsingWallet");
const lang = require("../../../utils/languages/languages.json");

async function VVCStandardCreation(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    //     if (payload && payload === "activate_vcc_v_s_a") {
    //         let totalFee;
    //         const vvcFee = await FeeModel.findOne({ $and: [{ service_name: "vcc_standard_virtual" }, { account_level: chat.account.level._id }] })
    //         if (chat.account.level.level_no === 1) {
    //             let countryDetails = await Country.findOne({ _id: chat.account.country }, { status: true, kyc_fee: true, country_iso_code: true })
    //             totalFee = vvcFee.flat_fee + countryDetails.kyc_fee;
    //         } else {
    //             totalFee = vvcFee.flat_fee
    //         }
    //         const message = `
    //         🔍 Please confirm the details below:  

    // 💳 Card Type: Virtual  
    // 🌟 Card Package: Premium  
    // 💰 Fee: ${formattedAmount(totalFee)} ${vvcFee.fee_currency} 

    // Let us know if everything looks good! ✅`

    //         await sendButtons(chatId, message, [
    //             [{ text: " I Confirm", callback_data: `activate_vcc_v_s_a_confirm` }],
    //             [{ text: "Back", callback_data: `activate_vcc` }],
    //         ], "activate_vcc_v_s_a")
    //     }

    //     else if (payload === "activate_vcc_v_s_a_confirm" && chat.last_message === "activate_vcc_v_s_a") {
    //         if (chat.account.level.level_no === 1) {
    //             let countryDetails = await Country.findOne({ _id: chat.account.country }, { status: true, kyc_fee: true, country_iso_code: true })
    //             const vvcFee = await FeeModel.findOne({ $and: [{ service_name: "vcc_standard_virtual" }, { account_level: chat.account.level._id }] })

    //             const message = `To activate your new Mastercard and ensure a secure experience, we kindly ask you to complete a quick identity verification process. 

    // Here’s what you need to know 👇

    // • A one-time activation fee of ${formattedAmount(countryDetails.kyc_fee + vvcFee.flat_fee)} USD applies.

    // • ${formattedAmount(countryDetails.kyc_fee)} USD of this fee covers identity verification.

    // • Should verification be unsuccessful, the remaining  ${formattedAmount(vvcFee.flat_fee)} USD will automatically be credited to your default wallet for future use.

    // Your security is our priority, and this step helps protect your account from unauthorized access. 🔐

    // Ready to get started? 🚀 Click below to verify your identity and activate your card.`

    //             await sendButtons(chatId, message, [
    //                 [{ text: "Verify Identity Now!", callback_data: `activate_vcc_v_s_a_confirm` }],
    //             ])

    //         } else {
    //             const pans = await PanModel.find({ account: chat.account._id });

    //             const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD;
    //             let buttons = [];

    //             if (pans.length !== 0) {
    //                 buttons = [
    //                     [{ text: lang[selectedLanguage].PAYMENT_CARD, callback_data: "activate_vcc_v_s_a_card" }],
    //                     [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "activate_vcc_v_s_a_ip_w" }],
    //                     [{ text: lang[selectedLanguage].PAYPAL, callback_data: "activate_vcc_v_s_a_paypal" }],
    //                     [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
    //                 ];
    //             } else {
    //                 buttons = [
    //                     [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "activate_vcc_v_s_a_ip_w" }],
    //                     [{ text: lang[selectedLanguage].PAYPAL, callback_data: "activate_vcc_v_s_a_paypal" }],
    //                     [{ text: lang[selectedLanguage].ADD_PAYMENT_CARD, callback_data: "add_payment_card-activate_vcc_v_s_a_methods" }],
    //                     [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
    //                 ];
    //             }

    //             await sendButtons(chatId, message, buttons, "activate_vcc_v_s_a_payment_method");
    //         }
    //     }

    if (payload === "activate_vcc_v_s_a") {
        const pans = await PanModel.find({ account: chat.account._id });

        const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD;
        let buttons = [];

        if (pans.length !== 0) {
            buttons = [
                [{ text: lang[selectedLanguage].PAYMENT_CARD, callback_data: "activate_vcc_v_s_a_card" }],
                [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "activate_vcc_v_s_a_ip_w" }],
                [{ text: lang[selectedLanguage].PAYPAL, callback_data: "activate_vcc_v_s_a_ppl" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
        } else {
            buttons = [
                [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "activate_vcc_v_s_a_ip_w" }],
                [{ text: lang[selectedLanguage].PAYPAL, callback_data: "activate_vcc_v_s_a_ppl" }],
                [{ text: lang[selectedLanguage].ADD_PAYMENT_CARD, callback_data: "add_payment_card-activate_vcc_v_s_a_methods" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
        }

        await sendButtons(chatId, message, buttons, "activate_vcc_v_s_a_payment_method");
    }
    // user has selected payment for card creation with instapay wallets
    else if (
        (payload?.includes("activate_vcc_v_s_a_ip_w") || payload === "activate_vcc_v_s_a_ip_w") &&
        (chat?.last_message === "activate_vcc_v_s_a_payment_method" || chat?.last_message?.startsWith("activate_vcc_v_s_a_ip_w")) ||
        (image_payloads.length > 0 || video_payloads.length > 0) && chat?.last_message?.startsWith("activate_vcc_v_s_a_ip_w") ||
        (text && !payload && chat?.last_message?.startsWith("activate_vcc_v_s_a_ip_w"))
    ) {
        await standardCardCreationUsingWallet(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads);
    }
    // user has selected payment for card creation with paypal
    else if (
        (payload?.includes("activate_vcc_v_s_a_ppl") || payload === "activate_vcc_v_s_a_ppl") &&
        (chat?.last_message === "activate_vcc_v_s_a_payment_method" || chat?.last_message?.startsWith("activate_vcc_v_s_a_ppl")) ||
        (image_payloads.length > 0 || video_payloads.length > 0) && chat?.last_message?.startsWith("activate_vcc_v_s_a_ppl") ||
        (text && !payload && chat?.last_message?.startsWith("activate_vcc_v_s_a_ppl"))
    ) {
        await standardCardCreationUsingPaypal(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads);
    }
}

module.exports = { VVCStandardCreation }