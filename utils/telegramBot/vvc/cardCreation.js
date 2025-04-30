const lang = require("../../../languages")
const Country = require("../../../models/Country.model")
const FeeModel = require("../../../models/Fee.model")
const VirtualCardModel = require("../../../models/Virtual-Card.model")
const { formattedAmount } = require("../../InstaChatbotHelpers")
const { sendPhoto, sendMessage, sendButtons, sendAnimation } = require("../../telegramBotUtils")
const { VVCPremiumCreation } = require("./premiumCardCreation")
const { VVCStandardCreation } = require("./standardCardCreation")

async function VVCCreation(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    if (payload && payload === "activate_vcc") {
        const vvcs = await VirtualCardModel.find({ account: chat.account._id })

        if (vvcs.length >= 3) {
            await sendMessage(chatId, lang[selectedLanguage].MAX_VIRTUAL_CARDS)
            return
        }

        const message = lang[selectedLanguage].CARD_FITS;


        return await sendButtons(chatId, message, [
            [{ text: lang[selectedLanguage].VIRTUAL_CARD, callback_data: `activate_vcc_v` }],
            [{ text: lang[selectedLanguage].PHYSICAL_CARD, callback_data: "activate_vcc_p" }]
        ], "activate_vcc")
    }
    // user has selected physical card
    else if (payload === "activate_vcc_p" && chat.last_message === "activate_vcc") {
        await sendButtons(chatId, lang[selectedLanguage].COMING_SOON, [
            [{ text: lang[selectedLanguage].BACK, callback_data: `activate_vcc` }],
        ])
    }
    // user has selected virtual card
    else if (payload === "activate_vcc_v" && (chat.last_message === "activate_vcc" || chat.last_message === "activate_vcc_v_s" || chat.last_message === "activate_vcc_v_p" || chat.last_message === "activate_vcc_v_p_get")) {
        const vvcFeePremium = await FeeModel.findOne({ $and: [{ service_name: "vcc_premium_virtual" }, { account_level: chat.account.level._id }] })
        const vvcFeeStandard = await FeeModel.findOne({ $and: [{ service_name: "vcc_standard_virtual" }, { account_level: chat.account.level._id }] })
        const vvcFeesStandard = formattedAmount(vvcFeeStandard.flat_fee); // for new var
        const vvcFeesPremium = formattedAmount(vvcFeePremium.flat_fee); // for new var
        const message = lang[selectedLanguage].VIRTUAL_CARD_PACKAGE.replace("{{vvcFeesStandard}}", vvcFeesStandard).replace("{{vvcFeesPremium}}", vvcFeesPremium);
        await sendButtons(chatId, message, [
            [{ text: lang[selectedLanguage].STANDARD_CARD, callback_data: `activate_vcc_v_s` }],
            [{ text: lang[selectedLanguage].PREMIUM_CARD, callback_data: `activate_vcc_v_p` }],
        ], "activate_vcc_v")
    }

    // user has selected virtual premium card
    else if (payload === "activate_vcc_v_p" && chat.last_message === "activate_vcc_v") {
        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/premium.png")
        const message = lang[selectedLanguage].PREMIUM_CARD_LOOK;
        await sendButtons(chatId, message, [
            [{ text: lang[selectedLanguage].YES_, callback_data: `activate_vcc_v_p_get_yes` }],
            [{ text: lang[selectedLanguage].NO_, callback_data: `activate_vcc_v_p_get_no` }],
            [{ text: lang[selectedLanguage].BACK, callback_data: `activate_vcc_v` }],
        ], "activate_vcc_v_get")
    }

    // user has selected virtual standard card
    else if (payload === "activate_vcc_v_s" && chat.last_message === "activate_vcc_v") {
        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/standard.png")
        await sendButtons(chatId, lang[selectedLanguage].STANDARD_CARD_LOOK, [
            [{ text: lang[selectedLanguage].GET_STANDARD_CARD, callback_data: `activate_vcc_v_s_get` }],
            [{ text: lang[selectedLanguage].BACK, callback_data: `activate_vcc_v` }],
        ], "activate_vcc_v_get")
    }

    // checking user's verification status
    else if ((payload === "activate_vcc_v_s_get" || payload === "activate_vcc_v_p_get_yes" || payload === "activate_vcc_v_p_get_no") && chat.last_message === "activate_vcc_v_get") {
        await sendMessage(chatId, lang[selectedLanguage].SECURITY_COMPLIANCE)
        await sendAnimation(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/search.gif", "Checking your verification status...")

        let serviceName, cardType;
        if (payload === "activate_vcc_v_s_get") {
            serviceName = "vcc_standard_virtual"
            cardType = "Standard"
        }
        else {
            if (payload === "activate_vcc_v_p_get_yes") {
                serviceName = "vcc_premium_plus_virtual";
            } else {
                serviceName = "vcc_premium_virtual";
            }
            cardType = "Premium";
        }
        const vvcFee = await FeeModel.findOne({ $and: [{ service_name: serviceName }, { account_level: chat.account.level._id }] })

        if (chat.account.level.level_no === 1) {
            let countryDetails = await Country.findOne({ _id: chat.account.country }, { status: true, kyc_fee: true, country_iso_code: true })
            const totalFee = vvcFee.flat_fee + countryDetails.kyc_fee;
            const buttons = [
                [{ text: lang[selectedLanguage].I_CONFIRM, callback_data: `activate_vcc_kyc` }]
                [{ text: lang[selectedLanguage].BACK, callback_data: `activate_vcc_v` }],
            ]

            const message = lang[selectedLanguage].VERIFY_IDENTITY_REQ.replace("{{totalFee}}", totalFee).replace("{{cardType}}", cardType) //Hassan

            await sendButtons(chatId, message, buttons, "activate_vcc_kyc")
        }
        else {
            const buttons = [
                [{ text: lang[selectedLanguage].I_CONFIRM, callback_data: `${cardType === "Premium" && serviceName === "vcc_premium_plus_virtual" ? "activate_vcc_v_p_a_plus" : cardType === "Premium" ? "activate_vcc_v_p_a" : "activate_vcc_v_s_a"}` }],
                [{ text: lang[selectedLanguage].BACK, callback_data: `activate_vcc_v` }]
            ]
            await sendButtons(chatId, lang[selectedLanguage].VERIFIED.replace("{{cardType}}", cardType).replace("{{vvcFee.flat_fee}}",formattedAmount(vvcFee.flat_fee)), buttons) //Hasssan
        }
    }

    else if (payload === "activate_vcc_kyc" && chat.last_message === "activate_vcc_kyc") {
        const buttons = [
            [{ text: lang[selectedLanguage].VERIFY, callback_data: "kyc_verification" }],
            [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
        ];

        const message = lang[selectedLanguage].VERIFY_IDENTITY_CARD;

        await sendButtons(chatId, message, buttons, "4");
    }

    // user has selected activate_vcc_v_p_a (activate virtual premium card)
    else if ((text && chat.last_message?.startsWith("activate_vcc_v_p_a"))
        || (payload?.startsWith("activate_vcc_v_p_a") && chat.last_message?.startsWith("activate_vcc_v_p_a"))
        || (payload === "activate_vcc_v_p_a")
        || (payload === "activate_vcc_v_p_a_plus")
        || (chat.last_message?.startsWith("activate_vcc_v_p_a") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await VVCPremiumCreation(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads)
        return
    }
    // user has selected activate_vcc_v_s_a (activate virtual standard card)
    else if ((text && chat.last_message?.startsWith("activate_vcc_v_s_a"))
        || (payload?.startsWith("activate_vcc_v_s_a") && chat.last_message?.startsWith("activate_vcc_v_s_a"))
        || (payload === "activate_vcc_v_s_a")
        || (chat.last_message?.startsWith("activate_vcc_v_s_a") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await VVCStandardCreation(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads)
        return
    }

}

module.exports = { VVCCreation }