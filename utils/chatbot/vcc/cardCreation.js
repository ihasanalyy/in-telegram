const { quickMessage, quickReply, sendTemplate } = require("../../instaChatbotUtils");
const lang = require('../../languages/languages.json');
const FeeModel = require("../../../models/Fee.model");
const { formattedAmount } = require("../../InstaChatbotHelpers");
const VirtualCardModel = require("../../../models/Virtual-Card.model");
const { VVCCreationPremium } = require("./cardCreationPremium");
const { VVCCreationStandard } = require("./cardCreationStandard");

async function VVCCreationInsta(senderId, payload, account, bot, text, selectedLanguage) {
    const data = {
        sender: {
            id: senderId
        }
    }
    if (payload && payload === "activate_vcc") {
        const vvcs = await VirtualCardModel.find({ account: account._id });

        // Check if the user has already created 3 virtual cards
        if (vvcs.length >= 3) {
            const quickReplies = [
                {
                    content_type: "text",
                    title: "My Mastercard",
                    payload: "vcc_menu"
                },
                {
                    content_type: "text",
                    title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                    payload: "main_menu"
                },
            ]
            await quickReply(data, "You have already created 3 Virtual Cards. You cannot create more.", quickReplies);
            return;
        }

        const message = `👉 Which card fits your needs best?

🔹 Virtual Card (Instant use, online & mobile payments)
🔹 Physical Card (Coming Soon – Stay tuned!)`;

        const quickReplies = [
            {
                content_type: "text",
                title: "Virtual Card",
                payload: "activate_vcc_v"
            },
            {
                content_type: "text",
                title: "Physical Card",
                payload: "activate_vcc_p"
            }
        ];

        await quickReply(data, message, quickReplies, "activate_vcc");
    }

    // User has selected Physical Card
    else if (payload === "activate_vcc_p" && bot.last_message === "activate_vcc") {

        const quickReplies = [
            {
                content_type: "text",
                title: "Back",
                payload: "activate_vcc"
            }
        ];

        await quickReply(data, "Coming Soon ❕", quickReplies);
    }

    // User has selected virtual card
    else if (payload === "activate_vcc_v") {
        const vvcFeePremium = await FeeModel.findOne({ $and: [{ service_name: "vcc_premium_virtual" }, { account_level: account.level._id }] });
        const vvcFeeStandard = await FeeModel.findOne({ $and: [{ service_name: "vcc_standard_virtual" }, { account_level: account.level._id }] });

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

💡 Get premium benefits, higher limits & seamless global payments!`;

        const quickReplies = [
            {
                content_type: "text",
                title: "Standard Card",
                payload: "activate_vcc_v_s"
            },
            {
                content_type: "text",
                title: "Premium Card",
                payload: "activate_vcc_v_p"
            }
        ];

        await quickReply(data, message, quickReplies, "activate_vcc_v");
    }
    // User has selected virtual premium card
    else if (payload === "activate_vcc_v_p" && bot.last_message === "activate_vcc_v") {
        const message = `☝️ This is how your Premium Card looks like.\n\nWould you like to add Apple Pay support to your premium card?

⚠ Please note:

• A fee of $0.35 applies per transaction attempt.

• A 0.5% fee applies to successful transactions made with an Apple Pay-supported card.`
        // Send Premium Card image and message
        const templatePayload = {
            template_type: "generic",
            elements: [
                {
                    title: message,
                    image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/premium.png",
                    buttons: [
                        {
                            type: "postback",
                            title: "Yes",
                            payload: "activate_vcc_v_p_get_yes"
                        },
                        {
                            type: "postback",
                            title: "No",
                            payload: "activate_vcc_v_p_get_no"
                        },
                        {
                            type: "postback",
                            title: "Back",
                            payload: "activate_vcc_v"
                        }
                    ]
                }
            ]
        };
        await sendTemplate(data, senderId, templatePayload, "activate_vcc_v_get");
    }

    // User has selected virtual standard card
    else if (payload === "activate_vcc_v_s" && bot.last_message === "activate_vcc_v") {
        // Send Standard Card image and message
        const templatePayload = {
            template_type: "generic",
            elements: [
                {
                    title: "☝️ This is how your Standard Card looks like.",
                    image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/telegram_bot_images/standard.png",
                    buttons: [
                        {
                            type: "postback",
                            title: "Get Standard Card",
                            payload: "activate_vcc_v_s_get"
                        },
                        {
                            type: "postback",
                            title: "Back",
                            payload: "activate_vcc_v"
                        }
                    ]
                }
            ]
        };
        await sendTemplate(data, senderId, templatePayload, "activate_vcc_v_get");
    }
    // Checking user's verification status
    else if ((payload === "activate_vcc_v_s_get" || payload === "activate_vcc_v_p_get_yes" || payload === "activate_vcc_v_p_get_no") && bot.last_message === "activate_vcc_v_get") {
        await quickMessage(data, "💡 For security and compliance, all InstaPay Virtual Card users must verify their identity.");

        await quickMessage(data, "Checking your verification status...");

        let serviceName, cardType;
        if (payload === "activate_vcc_v_s_get") {
            serviceName = "vcc_standard_virtual";
            cardType = "Standard";
        } else {
            if (payload === "activate_vcc_v_p_get_yes") {
                serviceName = "vcc_premium_plus_virtual";
            } else {
                serviceName = "vcc_premium_virtual";
            }
            cardType = "Premium";
        }

        const vvcFee = await FeeModel.findOne({ $and: [{ service_name: serviceName }, { account_level: account.level._id }] });

        if (account.level.level_no === 1) {
            // User needs KYC verification
            let countryDetails = await Country.findOne({ _id: account.country }, { status: true, kyc_fee: true, country_iso_code: true });
            const totalFee = vvcFee.flat_fee + countryDetails.kyc_fee;

            const quickReplies = [
                { content_type: "text", title: "I Confirm", payload: "activate_vcc_kyc" },
                { content_type: "text", title: "Back", payload: "activate_vcc_v" }
            ];

            const message = `❗ You need to verify your identity before activating your card.
👉 Let's complete your identity verification now! We'll need your ID and proof of address.

Please confirm the details below:  

💳 Card Type: Virtual  
🌟 Card Package: ${cardType}  
💰 Fee: $${formattedAmount(totalFee)}`;

            await quickReply(data, message, quickReplies, "activate_vcc_kyc");
        } else {
            // User is already verified
            const quickReplies = [
                { content_type: "text", title: "I Confirm", payload: `${cardType === "Premium" && serviceName === "vcc_premium_plus_virtual" ? "activate_vcc_v_p_a_plus" : cardType === "Premium" ? "activate_vcc_v_p_a" : "activate_vcc_v_s_a"}` },
                { content_type: "text", title: "Back", payload: "activate_vcc_v" }
            ];

            const message = `✅ You're verified! Now, let's proceed with your card activation.
💰 Pay the one-time card issuance fee to get started.

Please confirm the details below:  

💳 Card Type: Virtual  
🌟 Card Package: ${cardType}
💰 Fee: $${formattedAmount(vvcFee.flat_fee)}`;

            await quickReply(data, message, quickReplies);
        }
    }

    // User has selected KYC verification
    else if (payload === "activate_vcc_kyc" && bot.last_message === "activate_vcc_kyc") {
        const templatePayload = {
            template_type: "generic",
            elements: [
                {

                    title: 'Please verify your identity to activate your card.',
                    buttons: [
                        {
                            type: "postback",
                            title: lang[selectedLanguage].VERIFY,
                            payload: "kyc_verification",
                        },
                        {
                            type: "postback",
                            title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                            payload: "main_menu",
                        },
                    ],
                },

            ]
        };

        await sendTemplate(data, recipientId, templatePayload, "4")
    }

    // user has selected premium 
    else if (payload?.includes("activate_vcc_v_p_a")
        || (bot?.last_message?.includes("activate_vcc_v_p_a") && text && !payload)
    ) {
        await VVCCreationPremium(senderId, payload, account, bot, text, selectedLanguage);
        return
    }

    // user has selected standard
    else if (payload?.includes("activate_vcc_v_s_a")
        || (bot?.last_message?.includes("activate_vcc_v_s_a") && text && !payload)
    ) {
        await VVCCreationStandard(senderId, payload, account, bot, text, selectedLanguage);
        return
    }
}

module.exports = { VVCCreationInsta }
