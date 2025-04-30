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
            await sendMessage(chatId, "You have already created 3 Virtual Cards. You cannot create more.")
            return
        }

        const message = `👉 Which card fits your needs best?

🔹 Virtual Card (Instant use, online & mobile payments)
🔹 Physical Card (Coming Soon – Stay tuned!)`


        return await sendButtons(chatId, message, [
            [{ text: "Virtual Card", callback_data: `activate_vcc_v` }],
            [{ text: "Physical Card", callback_data: "activate_vcc_p" }]
        ], "activate_vcc")
    }
    // user has selected physical card
    else if (payload === "activate_vcc_p" && chat.last_message === "activate_vcc") {
        await sendButtons(chatId, "Coming Soon ❕", [
            [{ text: "Back", callback_data: `activate_vcc` }],
        ])
    }
    // user has selected virtual card
    else if (payload === "activate_vcc_v" && (chat.last_message === "activate_vcc" || chat.last_message === "activate_vcc_v_s" || chat.last_message === "activate_vcc_v_p" || chat.last_message === "activate_vcc_v_p_get")) {
        const vvcFeePremium = await FeeModel.findOne({ $and: [{ service_name: "vcc_premium_virtual" }, { account_level: chat.account.level._id }] })
        const vvcFeeStandard = await FeeModel.findOne({ $and: [{ service_name: "vcc_standard_virtual" }, { account_level: chat.account.level._id }] })
        const message = `We offer two exclusive packages for our Mastercard Virtual Card! 💳✨  

🔹 Standard Card 💳
	✔️ Affordable & Accessible
	✔️ Activation Fee: $${formattedAmount(vvcFeeStandard.flat_fee)} USD + KYC fee
	✔️ Up to $25,000 per transaction
	✔️ Hold balances up to $25,000
	✔️ Lower activation fee
	✔️ Access to international transfers & payment requests
	✔️ Standard customer support

🌟 Premium Card 💳
	 ✔️ Exclusive Benefits & High Limits
	 ✔️ Activation Fee: $${formattedAmount(vvcFeePremium.flat_fee)} USD + KYC fee
	 ✔️ Up to $150,000 per transaction
	 ✔️ Hold balances up to $150,000 (after ID verification)
	 ✔️ Crypto-to-fiat conversion
	 ✔️ Priority support & fee-free card-to-card transfers

💡 Get premium benefits, higher limits & seamless global payments!`
        await sendButtons(chatId, message, [
            [{ text: "Standard Card", callback_data: `activate_vcc_v_s` }],
            [{ text: "Premium Card", callback_data: `activate_vcc_v_p` }],
        ], "activate_vcc_v")
    }

    // user has selected virtual premium card
    else if (payload === "activate_vcc_v_p" && chat.last_message === "activate_vcc_v") {
        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/premium.png")
        const message = `☝️ This is how your Premium Card looks like.\n\nWould you like to add Apple Pay support to your premium card?

⚠ Please note:

• A fee of $0.35 applies per transaction attempt.

• A 0.5% fee applies to successful transactions made with an Apple Pay-supported card.`
        await sendButtons(chatId, message, [
            [{ text: "Yes", callback_data: `activate_vcc_v_p_get_yes` }],
            [{ text: "No", callback_data: `activate_vcc_v_p_get_no` }],
            [{ text: "Back", callback_data: `activate_vcc_v` }],
        ], "activate_vcc_v_get")
    }

    // user has selected virtual standard card
    else if (payload === "activate_vcc_v_s" && chat.last_message === "activate_vcc_v") {
        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/standard.png")
        await sendButtons(chatId, "☝️ This is how your Standard Card looks like.", [
            [{ text: "Get Standard Card", callback_data: `activate_vcc_v_s_get` }],
            [{ text: "Back", callback_data: `activate_vcc_v` }],
        ], "activate_vcc_v_get")
    }

    // checking user's verification status
    else if ((payload === "activate_vcc_v_s_get" || payload === "activate_vcc_v_p_get_yes" || payload === "activate_vcc_v_p_get_no") && chat.last_message === "activate_vcc_v_get") {
        await sendMessage(chatId, "💡 For security and compliance, all InstaPay Virtual Card users must verify their identity.")
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
                [{ text: "I Confirm", callback_data: `activate_vcc_kyc` }]
                [{ text: "Back", callback_data: `activate_vcc_v` }],
            ]

            const message = `❗ You need to verify your identity before activating your card.
👉 Let's complete your identity verification now! we'll need your ID and proof of address.

Please confirm the details below:  

💳 Card Type: Virtual  
🌟 Card Package: ${cardType}  
💰 Fee: $${formattedAmount(totalFee)}`

            await sendButtons(chatId, message, buttons, "activate_vcc_kyc")
        }
        else {
            const buttons = [
                [{ text: "I Confirm", callback_data: `${cardType === "Premium" && serviceName === "vcc_premium_plus_virtual" ? "activate_vcc_v_p_a_plus" : cardType === "Premium" ? "activate_vcc_v_p_a" : "activate_vcc_v_s_a"}` }],
                [{ text: "Back", callback_data: `activate_vcc_v` }]
            ]
            await sendButtons(chatId, `✅ You're verified! Now, let's proceed with your card activation.
💰 Pay the one-time card issuance fee to get started.


Please confirm the details below:  

💳 Card Type: Virtual  
🌟 Card Package: ${cardType}  
💰 Fee:  $${formattedAmount(vvcFee.flat_fee)} `, buttons)
        }
    }

    else if (payload === "activate_vcc_kyc" && chat.last_message === "activate_vcc_kyc") {
        const buttons = [
            [{ text: lang[selectedLanguage].VERIFY, callback_data: "kyc_verification" }],
            [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
        ];

        const message = "Please verify your identity to activate your card.";

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