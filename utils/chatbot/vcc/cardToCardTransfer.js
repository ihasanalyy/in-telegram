const { quickMessage, quickReply, sendTemplate, validateAmount, formatDate, somethingWentWrongQuickReply } = require("../../instaChatbotUtils");
const lang = require('../../languages/languages.json');
const { formattedAmount } = require("../../InstaChatbotHelpers");
const VirtualCardModel = require("../../../models/Virtual-Card.model");
const Account = require("../../../models/Account.model");
const { handleOTPGeneration, validateOTP, invalidMessage } = require("../../instaChatbotOTP");
const { getCardDetails, cardToCardTransactionHelper, sendSMSTemplate, vccTopupFeeCalculation } = require("../../helpers");
const { formatDecimalNumbersWithLimit } = require("../../payerRates");
const { addNotification } = require("../../generateNotification");
const moment = require('moment-timezone');
const { getExchangeRatesToUSD } = require("../../conversion");
const jwt = require("jsonwebtoken")

async function cardToCardTransfer(senderId, payload, account, bot, text, selectedLanguage) {
    const data = {
        sender: {
            id: senderId
        }
    }
    if (payload === "vcc_transfer") {
        const templatePayload = {
            template_type: "generic",
            elements: [
                {
                    title: "🔢 Please enter the last 4 digits of the recipient's card number or type in the username. ⬇️",
                    image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Send%20Money.png",
                    buttons: [
                        {
                            type: "postback",
                            title: lang[selectedLanguage].MAIN_MENU,
                            payload: "main_menu"
                        }
                    ]
                }
            ]
        };
        await sendTemplate(data, senderId, templatePayload, "vcc_transfer_number");
    }

    // User has entered the username or card digits
    else if (bot?.last_message === "vcc_transfer_number" && text) {
        let account = await Account.findOne({ username: text.toLowerCase() });
        let card;

        // If no account found by username, search by card's last4
        if (!account) {
            card = await VirtualCardModel.findOne({ last4: { $regex: text + "$" } });
            if (card) {
                account = await Account.findById(card.account);
            }
        }

        if (account) {
            let foundViaCard = !!card;
            let cardId = foundViaCard ? card._id : null;

            // If found via username, check the number of cards
            if (!foundViaCard) {
                const vccs = await VirtualCardModel.find({ account: account._id });
                if (vccs.length === 1) {
                    cardId = vccs[0]._id;
                }
            }

            // Proceed directly to amount if card is identified
            if (foundViaCard || cardId) {
                bot.vcc.account = account._id;
                bot.vcc.receiver_card = cardId;
                await bot.save();

                // Send account details and request amount
                const templatePayload = {
                    template_type: "generic",
                    elements: [
                        {
                            title: `${lang[selectedLanguage].BENEFICIARY_NAME}: ${account?.first_name} ${account?.last_name}`,
                            subtitle: `
${lang[selectedLanguage].USERNAME}: ${account?.username}
${lang[selectedLanguage].COUNTRY}: ${account?.country_name}
                                `,
                            image_url: account?.profileImage?.url || "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/welcome-TG.png",
                            buttons: [
                                {
                                    type: "web_url",
                                    title: lang[selectedLanguage].VIEW_PROFILE_BUTTON,
                                    url: `https://my.insta-pay.ch/profile/${account?.username}`,
                                    webview_height_ratio: "full"
                                },
                                {
                                    type: "postback",
                                    title: lang[selectedLanguage].CONTINUE,
                                    payload: "vcc_transfer_sender_card"
                                },
                                {
                                    type: "postback",
                                    title: lang[selectedLanguage].SEARCH_AGAIN,
                                    payload: "vcc_transfer"
                                }
                            ]
                        }
                    ]
                };
                await sendTemplate(data, senderId, templatePayload, "vcc_transfer_sender_card");
            } else {
                // Multiple cards found via username, ask to continue
                bot.vcc.account = account._id;
                await bot.save();

                const templatePayload = {
                    template_type: "generic",
                    elements: [
                        {
                            title: `${lang[selectedLanguage].BENEFICIARY_NAME}: ${account?.first_name} ${account?.last_name}`,
                            subtitle: `
${lang[selectedLanguage].USERNAME}: ${account?.username}
${lang[selectedLanguage].COUNTRY}: ${account?.country_name}
                                `,
                            image_url: account?.profileImage?.url || "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/welcome-TG.png",
                            buttons: [
                                {
                                    type: "web_url",
                                    title: lang[selectedLanguage].VIEW_PROFILE_BUTTON,
                                    url: `https://my.insta-pay.ch/profile/${account?.username}`,
                                    webview_height_ratio: "full"
                                },
                                {
                                    type: "postback",
                                    title: lang[selectedLanguage].CONTINUE,
                                    payload: "vcc_transfer_continue"
                                },
                                {
                                    type: "postback",
                                    title: lang[selectedLanguage].SEARCH_AGAIN,
                                    payload: "vcc_transfer"
                                }
                            ]
                        }
                    ]
                };
                await sendTemplate(data, senderId, templatePayload, "vcc_transfer_continue");
            }
        } else {
            // No account found
            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "vcc_menu" }
            ];
            await quickReply(data, "No account found for this card number or username. Please try again.", quickReplies, "vcc_menu");
        }
    }

    else if (payload === "vcc_transfer_continue" && bot?.last_message === "vcc_transfer_continue") {
        const vccs = await VirtualCardModel.find({ account: bot.vcc.account });
        const receiver = await Account.findById(bot.vcc.account);

        if (vccs.length === 0) {
            const quickReplies = [
                { content_type: "text", title: "Main Menu", payload: "vcc_menu" }
            ];
            await quickReply(data, 'No Cards found for this account.', quickReplies, "4");
        } else {
            let message = `💳 ${receiver?.first_name} ${receiver?.last_name} has multiple Virtual Cards.\nPlease select the one you would like to use.`;
            let quickReplies = vccs.map(card => ({
                content_type: "text",
                title: `USD ****${card.last4.slice(-4)}`,
                payload: `vcc_transfer_card-${card._id}`
            }));
            quickReplies.push(
                { content_type: "text", title: "Back", payload: "vcc_transfer" },
                { content_type: "text", title: "My Mastercard", payload: "vcc_menu" }
            );
            await quickReply(data, message, quickReplies, "vcc_transfer_card");
        }
    }

    else if (payload?.startsWith("vcc_transfer_card-") && bot?.last_message === "vcc_transfer_card") {
        const cardId = payload.split("-")[1];
        bot.vcc.receiver_card = cardId;
        await bot.save();

        const vccs = await VirtualCardModel.find({ account: account._id });

        if (vccs.length === 0) {
            const quickReplies = [
                { content_type: "text", title: "Main Menu", payload: "vcc_menu" }
            ];
            await quickReply(data, 'No Cards found in your account.', quickReplies, "4");
        } else {
            let quickReplies = vccs.map(card => ({
                content_type: "text",
                title: `USD ****${card.last4.slice(-4)}`,
                payload: `vcc_transfer_sender_card-${card._id}`
            }));
            quickReplies.push(
                { content_type: "text", title: "Back", payload: "vcc_transfer" },
                { content_type: "text", title: "My Mastercard", payload: "vcc_menu" }
            );

            await quickReply(data, "Please select the card you would like to send from.", quickReplies, "vcc_transfer_sender_card");
        }
    }
    else if (payload === "vcc_transfer_sender_card") {
        const vccs = await VirtualCardModel.find({ account: account._id });

        if (vccs.length === 0) {
            const quickReplies = [
                { content_type: "text", title: "Main Menu", payload: "vcc_menu" }
            ];
            await quickReply(data, 'No Cards found in your account.', quickReplies, "4");
        } else {
            let quickReplies = vccs.map((card) => ({
                content_type: "text",
                title: `USD ****${card.last4.slice(-4)}`,
                payload: `vcc_transfer_sender_card-${card._id}`
            }));
            quickReplies.push(
                { content_type: "text", title: "Back", payload: "vcc_transfer" },
                { content_type: "text", title: "My Mastercard", payload: "vcc_menu" }
            );

            await quickReply(data, "Please select the card you would like to send from.", quickReplies, "vcc_transfer_sender_card");
        }
    }

    // User has selected a card from the list
    else if (payload?.includes("vcc_transfer_sender_card-") && (bot?.last_message === "vcc_transfer_sender_card" || bot?.last_message === "vcc_transfer_amount")) {
        const card_id = payload.split("-")[1];
        bot.vcc.card = card_id;
        await bot.save();

        const cardDetails = await getCardDetails(card_id);

        const message = `You currently have ${formattedAmount(cardDetails.balance)} ${cardDetails.currency} in your ****${cardDetails.last4?.slice(-4)} card.
    
Please enter the amount in ${cardDetails.currency} to send. i.e 10, 50 etc`;

        const quickReplies = [
            { content_type: "text", title: "Select another card", payload: "vcc_transfer_sender_card" },
            { content_type: "text", title: "Back", payload: "vcc_transfer" },
            { content_type: "text", title: "My Mastercard", payload: "vcc_menu" }
        ];

        await quickReply(data, message, quickReplies, "vcc_transfer_amount");
    }

    // User has typed the amount
    else if (bot?.last_message === "vcc_transfer_amount" && text && !payload) {
        const { status, message: validationMessage, amount } = validateAmount(text, selectedLanguage);
        if (!status) {
            await quickMessage(data, validationMessage);
            return;
        }

        const senderCardDetails = await getCardDetails(bot.vcc.card); // Fetch sender's card details
        if (!senderCardDetails) {
            await quickMessage(data, "⚠️ Error fetching card details. Please try again.");
            return;
        }

        if (amount > senderCardDetails.balance) {
            await quickMessage(data, "Insufficient balance! Please enter a valid amount.");
            return;
        }

        bot.vcc.amount = amount;
        await bot.save();

        const message = "Would you like to add a note? ✏️";
        const quickReplies = [
            { content_type: "text", title: "Yes", payload: "vcc_transfer_note" },
            { content_type: "text", title: "No", payload: "vcc_transfer_proceed" }
        ];

        await quickReply(data, message, quickReplies, "vcc_transfer_note");
    }

    else if (payload === "vcc_transfer_note" && bot?.last_message === "vcc_transfer_note") {
        const message = "📝 Please type in a note for the recipient.";
        const quickReplies = [
            { content_type: "text", title: "My Mastercard", payload: "vcc_menu" }
        ];
        await quickReply(data, message, quickReplies, "vcc_transfer_note_type");
    }

    // User has typed the note
    else if ((bot?.last_message === "vcc_transfer_note_type" && text && !payload) || (payload === "vcc_transfer_proceed" && bot?.last_message === "vcc_transfer_note")) {
        if (text && !payload) {
            bot.vcc.note = text;
            await bot.save();
        }

        const receiverCard = await VirtualCardModel.findById(bot.vcc.receiver_card).populate([{ path: "account", select: "first_name last_name" }]);
        const sendingCard = await VirtualCardModel.findById(bot.vcc.card).populate({ path: "account", populate: "level" })

        const feeKey = `${sendingCard?.type}_card_to_card`

        // Get fee in CARD'S currency
        const feeDetails = await vccTopupFeeCalculation(
            sendingCard.currency,
            sendingCard.account.level,
            bot.vcc.amount,
            feeKey
        );

        let exchangeRate;
        if (sendingCard.currency === receiverCard.currency) {
            exchangeRate = 1
        } else {
            let newRate = await getExchangeRatesToUSD(sendingCard.currency, receiverCard.currency, 1);
            newRate = formatDecimalNumbersWithLimit(newRate, 6);
            exchangeRate = formatDecimalNumbersWithLimit(newRate - (feeDetails.percentage_markup / 100) * newRate, 6);
        }

        const totalAmount = formatDecimalNumbersWithLimit(bot.vcc.amount + feeDetails.fee, 2);
        const recipientAmount = formatDecimalNumbersWithLimit(bot.vcc.amount * exchangeRate, 2);

//         const message = `✅ Please confirm the details below:
    
// Recipient Name: ${receiverCard.account.first_name} ${receiverCard.account.last_name}
// Recipient Card Number: ****${receiverCard.last4?.slice(-4)}  
// Amount to Send: ${formattedAmount(recipientAmount)} ${receiverCard.currency}
// ${sendingCard.currency !== receiverCard.currency ? `Exchange Rate: 1.00 ${sendingCard.currency} = ${formattedAmount(exchangeRate)} ${receiverCard.currency}` : ""}
// Fee: ${formattedAmount(feeDetails.fee)} ${sendingCard.currency}  
// Sender Card Number: ****${sendingCard.last4?.slice(-4)}  

// 💵 Total Amount: ${formattedAmount(totalAmount)} ${sendingCard.currency}`;
const message = lang[selectedLanguage].CONFIRM_DETAILS_TELEGRAM.replace("{{recipientName}}", `${receiverCard.account.first_name} ${receiverCard.account.last_name}`)
            .replace("{{recipientCard}}", `****${receiverCard.last4?.slice(-4)}`)
            .replace("{{amount}}", `${formattedAmount(recipientAmount)} ${receiverCard.currency}`)
            .replace("{{exchangeRate}}", sendingCard.currency !== receiverCard.currency ? `1.00 ${sendingCard.currency} = ${formattedAmount(exchangeRate)} ${receiverCard.currency}` : "")
            .replace("{{fee}}", `${formattedAmount(feeDetails.fee)} ${sendingCard.currency}`)
            .replace("{{senderCard}}", `****${sendingCard.last4?.slice(-4)}`)
            .replace("{{totalAmount}}", `${formattedAmount(totalAmount)} ${sendingCard.currency}`)

        const tokenPayload = {
            exchangeRate,
            feeDetails,
            recipientAmount,
            totalAmount,
            amount: bot.vcc.amount,
            from: sendingCard.currency,
            to: receiverCard.currency,
        }

        const token = jwt.sign(tokenPayload, process.env.jwtKey, { expiresIn: "10m" });
        bot.vcc.token = token;
        await bot.save();

        const quickReplies = [
            { content_type: "text", title: "I Confirm", payload: "vcc_transfer_confirm" },
            { content_type: "text", title: "My Mastercard", payload: "vcc_menu" },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
        ];
        await quickReply(data, message, quickReplies, "vcc_transfer_confirm");
    }

    // User has confirmed
    else if (payload === "vcc_transfer_confirm" && bot?.last_message === "vcc_transfer_confirm") {
        await handleOTPGeneration(selectedLanguage, senderId, "vcc_transfer-otp", "vcc_transfer-otp", "Transaction OTP");
    }

    // User has entered OTP for instant transfer
    else if (bot.last_message === "vcc_transfer-otp" && !payload && text) {

        const otpValidationResult = await validateOTP(senderId, text, "vcc_transfer-otp");

        if (otpValidationResult.status) {
            try {
                const decoded = jwt.verify(bot.vcc.token, process.env.jwtKey);
            } catch (error) {
                // transaction expiry message
                return await somethingWentWrongQuickReply(data, "Your transaction has been expired. Please try again.");
            }

            const transactionResult = await cardToCardTransactionHelper({
                senderCardId: bot.vcc.card,
                receiverCardId: bot.vcc.receiver_card,
                note: bot.vcc?.note,
                amount: bot.vcc.amount,
                token: bot.vcc.token
            });

            const receiverCard = await VirtualCardModel.findById(bot.vcc.receiver_card).populate([{ path: "account", select: "first_name last_name username phone telegram_bot telegram_id insta_bot insta_subscriber_id" }]);
            const senderCard = await VirtualCardModel.findById(bot.vcc.card).populate("account");

            const senderTimezone = senderCard.account?.timezone || "UTC";
            const senderCurrentTime = moment().tz(senderTimezone).format();

            if (transactionResult.status) {
                const templatePayload = {
                    template_type: "generic",
                    elements: [
                        {
                            title: "✅ Transaction Successful! 🎉",
                            subtitle: `💵 ${formattedAmount(bot.vcc.amount)} ${senderCard.currency} has been successfully sent to ${receiverCard?.account.first_name} ${receiverCard?.account.last_name} on card ****${receiverCard?.last4?.slice(-4)} from your card ****${senderCard.last4?.slice(-4)}.\n\n#️⃣ Transaction ID: ${transactionResult.data.transction_id}\n📅 Date & Time: ${formatDate(senderCurrentTime)}\n\nThank you for using InstaPay! 🚀`,
                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                            buttons: [
                                { type: "postback", title: "My Mastercard", payload: "vcc_menu" },
                                { type: "postback", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                            ]
                        }
                    ]
                };
                await sendTemplate(data, senderId, templatePayload, "4");

                // Recipient notifications
                let notificationObj = {
                    title: 'Card to Card Transaction',
                    desc: `You have received a transaction of ${formattedAmount(bot.vcc.amount)} ${senderCard.currency}!`,
                    type: 'card_to_card',
                    status: 'unread',
                    from: senderCard.account._id,
                    to: receiverCard.account._id,
                    link_id: transactionResult.data.transction_id,
                };
                // System notification
                await addNotification(notificationObj);
                const phoneMsg = `You have received ${formattedAmount(bot.vcc.amount)} ${senderCard.currency} from ${senderCard.account.username} on card ****${senderCard.last4?.slice(-4)}`;
                await sendSMSTemplate(receiverCard.account.phone, phoneMsg);

                // If recipient has active Instagram chatbot
                if (receiverCard.account.insta_subscriber_id && receiverCard.account.insta_bot) {
                    const recipientTemplatePayload = {
                        template_type: "generic",
                        elements: [
                            {
                                title: phoneMsg,
                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                                buttons: [
                                    { type: "postback", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }
                                ]
                            }
                        ]
                    };
                    const recipientData = { sender: { id: receiverCard.account.insta_subscriber_id } };
                    await sendTemplate(recipientData, receiverCard.account.insta_subscriber_id, recipientTemplatePayload, "4");
                }
            } else {
                let message;
                if (transactionResult.message === "insufficient_funds") {
                    message = `❌ Transaction Failed\n\nWe're sorry, but your transaction could not be completed due to insufficient funds.`;
                } else if (transactionResult.message?.includes("expired")) {
                    message = lang[selectedLanguage].TRANSACTION_FAILED_EXPIRED;
                }
                else {
                    message = `❌ Transaction Failed\n\nWe're sorry, but your transaction could not be completed.\n\nDetails:\n🔹 Recipient Name: ${receiverCard?.account.first_name} ${receiverCard?.account.last_name}\n🔹 Recipient Card Number: ****${receiverCard?.last4?.slice(-4)}\n🔹 Amount: ${formattedAmount(bot.vcc.amount)} ${senderCard.currency}\n🔹 Date & Time: ${formatDate(senderCurrentTime)}\n\nPlease check your payment details and try again. If the issue persists, contact our support team for assistance. 📞💬`;
                }

                const quickReplies = [
                    { content_type: "text", title: "Try Again", payload: "vcc_transfer" },
                    { content_type: "text", title: "My Mastercard", payload: "vcc_menu" },
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                ];
                await quickReply(data, message, quickReplies, "4");
            }
            bot.vcc = {};
            await bot.save();
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await quickMessage(data, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {
                await invalidMessage(data, "vcc_transfer-otp", selectedLanguage, bot?.otpType);
            }
        }
    }
}

module.exports = { cardToCardTransfer }