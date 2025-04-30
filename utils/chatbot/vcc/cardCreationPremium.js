const { quickReply } = require("../../instaChatbotUtils");

const lang = require('../../languages/languages.json');
const PanModel = require("../../../models/Pan.model");

const { premiumCardCreationUsingPaypal } = require("./cardCreationPremiumPaypal");
const { premiumCardCreationUsingWallet } = require("./cardCreationPremiumWallet");

async function VVCCreationPremium(senderId, payload, account, bot, text, selectedLanguage) {
    const data = {
        sender: {
            id: senderId
        }
    }
    if (payload === "activate_vcc_v_p_a" || payload === "activate_vcc_v_p_a_plus") {
        const pans = await PanModel.find({ account: account._id });

        const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD;
        let quickReplies = [];

        if (pans.length !== 0) {
            // If cards exist, show payment options including cards
            quickReplies = [
                {
                    content_type: "text",
                    title: lang[selectedLanguage].PAYMENT_CARD,
                    payload: "activate_vcc_v_p_a_card"
                },
                {
                    content_type: "text",
                    title: lang[selectedLanguage].INSTAPAY_WALLETS,
                    payload: "activate_vcc_v_p_a_ip_w"
                },
                {
                    content_type: "text",
                    title: lang[selectedLanguage].PAYPAL,
                    payload: "activate_vcc_v_p_a_ppl"
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
                    payload: "activate_vcc_v_p_a_ip_w"
                },
                {
                    content_type: "text",
                    title: lang[selectedLanguage].PAYPAL,
                    payload: "activate_vcc_v_p_a_ppl"
                },
                {
                    content_type: "text",
                    title: lang[selectedLanguage].ADD_PAYMENT_CARD,
                    payload: "add_payment_card-activate_vcc_v_p_a_methods"
                },
                {
                    content_type: "text",
                    title: lang[selectedLanguage].MAIN_MENU,
                    payload: "main_menu"
                }
            ];
        }

        if (payload === "activate_vcc_v_p_a_plus") {
            bot.vcc.isPremiumPlus = true
            await bot.save()
        }
        // Send the message with quick replies
        await quickReply(data, message, quickReplies, "activate_vcc_v_p_a_payment_method");
    }
    // user has selected card payment with wallet 
    else if (payload?.includes("activate_vcc_v_p_a_ip_w")
        || (bot?.last_message?.includes("activate_vcc_v_p_a_ip_w") && text && !payload)
    ) {
        await premiumCardCreationUsingWallet(senderId, payload, account, bot, text, selectedLanguage);
        return
    }

    // user has selected card payment with paypal
    else if (payload?.includes("activate_vcc_v_p_a_ppl")
        || (bot?.last_message?.includes("activate_vcc_v_p_a_ppl") && text && !payload)
    ) {
        await premiumCardCreationUsingPaypal(senderId, payload, account, bot, text, selectedLanguage);
        return
    }
}

module.exports = { VVCCreationPremium }