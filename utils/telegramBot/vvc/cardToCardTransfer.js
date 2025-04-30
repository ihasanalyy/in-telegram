const Account = require("../../../models/Account.model")
const VirtualCardModel = require("../../../models/Virtual-Card.model")
const { formattedAmount } = require("../../InstaChatbotHelpers")
const { sendPhoto, sendMessage, sendButtons, somethingWentWrongQuickReplyTelegram } = require("../../telegramBotUtils")

const lang = require("../../../utils/languages/languages.json");
const { formatDecimalNumbersWithLimit } = require("../../payerRates")
const { validateAmount, formatDate, sendTemplate } = require("../../instaChatbotUtils")
const { getCardDetails, cardToCardTransactionHelper, sendSMSTemplate, vccTopupFeeCalculation } = require("../../helpers")
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler")
const moment = require('moment-timezone');
const { addNotification } = require("../../generateNotification")
const jwt = require("jsonwebtoken");
const { getExchangeRatesToUSD } = require("../../conversion");
async function cardToCardTransfer(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    if (payload === "vcc_transfer") {
        await sendPhoto(
            chatId,
            "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Send%20Money.png",
            "🔢 Please enter the last 4 digits of the recipient's card number or type in the username. ⬇️",
            "vcc_transfer_number"
        );
    }

    // User has entered the username or card digits
    else if (chat?.last_message === "vcc_transfer_number" && text) {
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
                chat.vcc.account = account._id;
                chat.vcc.receiver_card = cardId;
                await chat.save();

                // Send account details and request amount
                await sendPhoto(
                    chatId,
                    account?.profileImage?.url || "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/welcome-TG.png"
                );

                const message = `
${lang[selectedLanguage].BENEFICIARY_NAME}: ${account?.first_name} ${account?.last_name}
${lang[selectedLanguage].USERNAME}: ${account?.username}
${lang[selectedLanguage].COUNTRY}: ${account?.country_name}
                `;

                await sendButtons(
                    chatId,
                    message,
                    [
                        [{ text: lang[selectedLanguage].VIEW_PROFILE_BUTTON, url: `https://my.insta-pay.ch/profile/${account?.username}` }],
                        [{ text: lang[selectedLanguage].CONTINUE, callback_data: "vcc_transfer_sender_card" }],
                        [{ text: lang[selectedLanguage].SEARCH_AGAIN, callback_data: "vcc_transfer" }],
                    ]
                );
            } else {
                // Multiple cards found via username, ask to continue
                chat.vcc.account = account._id;
                await chat.save();

                await sendPhoto(
                    chatId,
                    account?.profileImage?.url || "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/welcome-TG.png"
                );

                const message = `
${lang[selectedLanguage].BENEFICIARY_NAME}: ${account?.first_name} ${account?.last_name}
${lang[selectedLanguage].USERNAME}: ${account?.username}
${lang[selectedLanguage].COUNTRY}: ${account?.country_name}
                `;

                const buttons = [
                    [{ text: lang[selectedLanguage].VIEW_PROFILE_BUTTON, url: `https://my.insta-pay.ch/profile/${account?.username}` }],
                    [{ text: lang[selectedLanguage].CONTINUE, callback_data: "vcc_transfer_continue" }],
                    [{ text: lang[selectedLanguage].SEARCH_AGAIN, callback_data: "vcc_transfer" }],
                ];

                await sendButtons(chatId, message, buttons, "vcc_transfer_continue");
            }
        } else {
            // No account found
            await sendButtons(
                chatId,
                "No account found for this card number or username. Please try again.",
                [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "vcc_menu" }]]
            );
        }
    }

    // Existing handlers for continue, card selection, and amount entry...
    else if (payload === "vcc_transfer_continue" && chat?.last_message === "vcc_transfer_continue") {
        const vccs = await VirtualCardModel.find({ account: chat.vcc.account });
        const receiver = await Account.findById(chat.vcc.account);

        if (vccs.length === 0) {
            await sendButtons(chatId, 'No Cards found for this account.', [[{ text: 'Main Menu', callback_data: 'vcc_menu' }]], '4');
        } else {
            let message = `💳 *${receiver?.first_name} ${receiver?.last_name} has multiple Virtual Cards.*\nPlease select the one you would like to use.`;
            let buttons = vccs.map(card => [
                { text: `USD ****${card.last4.slice(-4)}`, callback_data: `vcc_transfer_card-${card._id}` }
            ]);
            buttons.push([{ text: "Back", callback_data: "vcc_transfer" }, { text: "My Mastercard", callback_data: "vcc_menu" }]);
            await sendButtons(chatId, message, buttons, "vcc_transfer_card");
        }
    }

    else if (payload?.startsWith("vcc_transfer_card-") && chat?.last_message === "vcc_transfer_card") {
        const cardId = payload.split("-")[1];
        chat.vcc.receiver_card = cardId;
        await chat.save();

        const vccs = await VirtualCardModel.find({ account: chat.account._id });

        if (vccs.length === 0) {
            await sendButtons(chatId, 'No Cards found in your account.', [[{ text: 'Main Menu', callback_data: 'vcc_menu' }]], '4');
        } else {
            let buttons = vccs.map((card) => [
                { text: `USD ****${card.last4.slice(-4)}`, callback_data: `vcc_transfer_sender_card-${card._id}` }
            ])
            buttons.push([{ text: "Back", callback_data: "vcc_transfer" }], [{ text: "My Mastercard", callback_data: "vcc_menu" }]);

            await sendButtons(chatId, "Please select the card you would like to send from.", buttons, "vcc_transfer_sender_card");
        }
    }

    else if (payload === "vcc_transfer_sender_card") {
        const vccs = await VirtualCardModel.find({ account: chat.account._id });

        if (vccs.length === 0) {
            await sendButtons(chatId, 'No Cards found in your account.', [[{ text: 'Main Menu', callback_data: 'vcc_menu' }]], '4');
        } else {
            let buttons = vccs.map((card) => [
                { text: `USD ****${card.last4.slice(-4)}`, callback_data: `vcc_transfer_sender_card-${card._id}` }
            ])
            buttons.push([{ text: "Back", callback_data: "vcc_transfer" }], [{ text: "My Mastercard", callback_data: "vcc_menu" }]);

            await sendButtons(chatId, "Please select the card you would like to send from.", buttons, "vcc_transfer_sender_card");
        }
    }

    // user has selected a card from the list
    else if (payload?.includes("vcc_transfer_sender_card-") && (chat?.last_message === "vcc_transfer_sender_card" || chat?.last_message === "vcc_transfer_amount")) {
        const card_id = payload.split("-")[1]
        chat.vcc.card = card_id
        await chat.save()

        const cardDetails = await getCardDetails(card_id);

        const message = `You currently have ${formattedAmount(cardDetails.balance)} ${cardDetails.currency} in your *****${cardDetails.last4?.slice(-4)} card.

Please enter the amount in ${cardDetails.currency} to send. i.e 10, 50 etc`

        const buttons = [
            [{ text: "Select another card", callback_data: "vcc_transfer_sender_card" }],
            [{ text: "Back", callback_data: "vcc_transfer" }],
            [{ text: "My Mastercard", callback_data: "vcc_menu" }]
        ]

        await sendButtons(chatId, message, buttons, "vcc_transfer_amount");
    }

    // user has typed the amount
    else if (chat?.last_message === "vcc_transfer_amount" && text && !payload) {
        const { status, message: validationMessage, amount } = validateAmount(text, selectedLanguage);
        if (!status) {
            await sendMessage(chatId, validationMessage);
            return;
        }

        const senderCardDetails = await getCardDetails(chat.vcc.card); // Fetch sender's card details
        if (!senderCardDetails) {
            await sendMessage(chatId, "⚠️ Error fetching card details. Please try again.");
            return;
        }

        if (amount > senderCardDetails.balance) {
            await sendMessage(chatId, "Insufficient balance! Please enter a valid amount.");
            return;
        }
        chat.vcc.amount = amount
        await chat.save()

        const message = "Would you like to add a note? ✏️"
        const buttons = [
            [{ text: "Yes", callback_data: "vcc_transfer_note" }],
            [{ text: "No", callback_data: "vcc_transfer_proceed" }],
        ]

        await sendButtons(chatId, message, buttons, "vcc_transfer_note");
    }

    else if (payload === "vcc_transfer_note" && chat?.last_message === "vcc_transfer_note") {
        const message = "📝 Please type in a note for the recipient."
        await sendButtons(chatId, message, [[{ text: "My Mastercard", callback_data: "vcc_menu" }]], "vcc_transfer_note_type");
    }

    // user has typed the note
    else if ((chat?.last_message === "vcc_transfer_note_type" && text && !payload) || (payload === "vcc_transfer_proceed" && chat?.last_message === "vcc_transfer_note")) {
        if (text && !payload) {
            chat.vcc.note = text
            await chat.save()
        }

        const receiverCard = await VirtualCardModel.findById(chat.vcc.receiver_card).populate([{ path: "account", select: "first_name last_name" }]);
        const sendingCard = await VirtualCardModel.findById(chat.vcc.card).populate({ path: "account", populate: "level" })


        const feeKey = `${sendingCard?.type}_card_to_card`

        // Get fee in CARD'S currency
        const feeDetails = await vccTopupFeeCalculation(
            sendingCard.currency,
            sendingCard.account.level,
            chat.vcc.amount,
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

        const totalAmount = formatDecimalNumbersWithLimit(chat.vcc.amount + feeDetails.fee, 2);
        const recipientAmount = formatDecimalNumbersWithLimit(chat.vcc.amount * exchangeRate, 2);

        const message = `✅ Please confirm the details below:

Recipient Name: ${receiverCard.account.first_name} ${receiverCard.account.last_name}
Recipient Card Number: *****${receiverCard.last4?.slice(-4)}  
Amount to Send: ${formattedAmount(recipientAmount)} ${receiverCard.currency}
${sendingCard.currency !== receiverCard.currency ? `Exchange Rate: 1.00 ${sendingCard.currency} = ${formattedAmount(exchangeRate)} ${receiverCard.currency}` : ""}
Fee: ${formattedAmount(feeDetails.fee)} ${sendingCard.currency}  
Sender Card Number: *****${sendingCard.last4?.slice(-4)}  

💵 Total Amount: ${formattedAmount(totalAmount)} ${sendingCard.currency}`;

        const tokenPayload = {
            exchangeRate,
            feeDetails,
            recipientAmount,
            totalAmount,
            amount: chat.vcc.amount,
            from: sendingCard.currency,
            to: receiverCard.currency,
        }

        const token = jwt.sign(tokenPayload, process.env.jwtKey, { expiresIn: "10m" });
        chat.vcc.token = token;
        await chat.save();

        const buttons = [
            [{ text: "I Confirm", callback_data: "vcc_transfer_confirm" }],
            [{ text: "My Mastercard", callback_data: "vcc_menu" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ]
        await sendButtons(chatId, message, buttons, "vcc_transfer_confirm");

    }

    // user has confirmed
    else if (payload === "vcc_transfer_confirm" && chat?.last_message === "vcc_transfer_confirm") {
        await handleOTPGenerationTG(selectedLanguage, chat, "vcc_transfer-otp", "vcc_transfer-otp", "Transaction OTP");
    }

    // User has entered OTP for instant transfer
    else if (chat.last_message === "vcc_transfer-otp" && !payload && text) {
        const otpValidationResult = await validateOTPTG(chatId, text, "vcc_transfer-otp");

        if (otpValidationResult.status) {
            try {
                const decoded = jwt.verify(chat.vcc.token, process.env.jwtKey);
            } catch (error) {
                // transaction expiry message
                return await somethingWentWrongQuickReplyTelegram(chatId, "Your transaction has been expired. Please try again.", selectedLanguage);
            }

            const transactionResult = await cardToCardTransactionHelper({
                senderCardId: chat.vcc.card,
                receiverCardId: chat.vcc.receiver_card,
                amount: chat.vcc.amount,
                note: chat.vcc?.note,
                token: chat.vcc.token
            });

            const receiverCard = await VirtualCardModel.findById(chat.vcc.receiver_card).populate([{ path: "account", select: "first_name last_name username phone telegram_bot telegram_id insta_bot insta_subscriber_id" }]);
            const senderCard = await VirtualCardModel.findById(chat.vcc.card).populate("account")

            const senderTimezone = senderCard.account?.timezone || "UTC"
            const senderCurrentTime = moment().tz(senderTimezone).format();

            if (transactionResult.status) {
                await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png");
                const message = `
                ✅ Transaction Successful! 🎉   

💵 ${formattedAmount(chat.vcc.amount)} ${senderCard.currency} has been successfully sent to ${receiverCard?.account.first_name} ${receiverCard?.account.last_name} on card ****${receiverCard?.last4?.slice(-4)} from your card ****${senderCard.last4?.slice(-4)}.

#️⃣ Transaction ID: ${transactionResult.data.transction_id}  
📅 Date & Time:  ${formatDate(senderCurrentTime)}

Thank you for using InstaPay! 🚀`

                await sendButtons(chatId, message, [[{ text: "My Mastercard", callback_data: "vcc_menu" }], [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]], "4");

                // recipient notifications
                let notificationObj = {
                    title: 'Card to Card Transaction',
                    desc: `You have received a transaction of ${formattedAmount(chat.vcc.amount)} ${senderCard.currency}!`,
                    type: 'card_to_card',
                    status: 'unread',
                    from: senderCard.account._id,
                    to: receiverCard.account._id,
                    link_id: transactionResult.data.transction_id,
                };
                // system notification
                await addNotification(notificationObj);
                const phoneMsg = `You have received ${formattedAmount(chat.vcc.amount)} ${senderCard.currency} from ${senderCard.account.username} on card ****${senderCard.last4?.slice(-4)}`;
                await sendSMSTemplate(receiverCard.account.phone, phoneMsg);

                // if recipient has active telegram chatbot
                if (receiverCard.account.telegram_id && receiverCard.account.telegram_bot) {
                    const chatId = receiverCard.account.telegram_id;
                    await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png");
                    await sendButtons(chatId, phoneMsg, [[{ text: "My Mastercard", callback_data: "vcc_menu" }], [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]], "4");
                }

                // if recipient has active instagram chatbot
                if (receiverCard.account.insta_subscriber_id && receiverCard.account.insta_bot) {
                    const templatePayload = {
                        template_type: "generic",
                        elements: [
                            {
                                title: phoneMsg,
                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                                buttons: [
                                    {
                                        type: "postback",
                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                        payload: `main_menu`,
                                    },

                                ],
                            },
                        ],

                    };
                    const chatbotData = { sender: { id: receiverCard.account.insta_subscriber_id } };
                    await sendTemplate(chatbotData, receiverCard.account.insta_subscriber_id, templatePayload, "4")
                }
            } else {
                await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png");
                let message;
                if (transactionResult.message === "insufficient_funds") {
                    message = `❌ Transaction Failed

We're sorry, but your transaction could not be completed due to insufficient funds.`
                } else if (transactionResult.message?.includes("expired")) {
                    message = `❌ Transaction Failed\n\nWe're sorry, but your transaction could not be completed due to transaction expiry.`;
                }
                else {
                    message = `❌ Transaction Failed  
    
We're sorry, but your transaction could not be completed.  
    
Details: 
🔹 Recipient Name: ${receiverCard?.account.first_name} ${receiverCard?.account.last_name}
🔹 Recipient Card Number: ****${receiverCard?.last4?.slice(-4)}  
🔹 Amount: ${formattedAmount(chat.vcc.amount)} ${senderCard.currency}  
🔹 Date & Time: ${formatDate(senderCurrentTime)}  
    
Please check your payment details and try again. If the issue persists, contact our support team for assistance. 📞💬
                    `
                }
                await sendButtons(chatId, message, [
                    [{ text: "Try Again", callback_data: "vcc_transfer" }],
                    [{ text: "My Mastercard", callback_data: "vcc_menu" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ], "4");
            }

            chat.vcc = {};
            await chat.save();
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessageTG(chatId, "vcc_transfer-otp", selectedLanguage, chat?.otpType);
            }
        }
    }

}

module.exports = { cardToCardTransfer };