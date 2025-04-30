const Wallet = require("../../../models/Wallet.model");
const lang = require("../../../utils/languages/languages.json");
const { checkTransactionLimitsForSender } = require("../../conversion");
const { calculateExchangeAndFees, getExchangeRatesToUSD, fetchLocalOrDefaultWalletConditionally, validateCardExpiry } = require("../../helpers");
const { formattedAmount } = require("../../InstaChatbotHelpers");
const { validateAmount } = require("../../instaChatbotUtils");
const { sendButtons, sendMessage, w2wMethods, processVideoUploads, processImageUploads, somethingWentWrongQuickReplyTelegram } = require("../../telegramBotUtils");
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler");
const { initiateTopUpSavedCard } = require("../../chatbot/w2w/card/w2wUsingCard");
const PanModel = require("../../../models/Pan.model");
const jwt = require("jsonwebtoken");

async function w2wUsingCard(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(chat.account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReplyTelegram(chatId, lang[selectedLanguage].NO_DEFAULT_WALLET_SET, selectedLanguage);
    }
    if (payload === "w2w_card" && chat?.last_message === "w2w_payment_method") {
        const pans = await PanModel.find({ account: chat.account._id });
        console.log(pans);

        let buttons = [];

        if (pans.length !== 0) {
            for (let i = 0; i < pans.length; i++) {
                buttons.push([
                    {
                        text: `💳 *******${pans[i].last4}`,
                        callback_data: `w2w_card_select_card-${pans[i]._id}`,
                    },
                ]);
            }

            buttons.push([{ text: lang[selectedLanguage].CHANGE_PAYMENT_METHOD, callback_data: "w2w_methods" }]);
            buttons.push([{ text: `☰ ${lang[selectedLanguage].MAIN_MENU}`, callback_data: "main_menu" }]);

            await sendButtons(chatId, lang[selectedLanguage].SELECT_YOUR_TOPUP_CHANNEL, buttons);
        } else {
            buttons.push([{ text: `☰ ${lang[selectedLanguage].MAIN_MENU}`, callback_data: "main_menu" }]);
            await sendButtons(chatId, lang[selectedLanguage].NO_CARD_SAVED, buttons);
        }
    }

    // User has selected top-up channel
    else if (payload?.startsWith("w2w_card_select_card-") && chat?.last_message === "w2w_payment_method") {
        const cardId = payload.split("-")[1];
        const expiryValidation = await validateCardExpiry(cardId);
        if (!expiryValidation.status) {
            const pans = await PanModel.find({ account: chat.account._id });
            const message = "The card you selected has expired and is now removed from your InstaPay account.\n\n" +
                "To continue with this transaction, please choose an alternative payment method.";

            let buttons;
            if (pans.length !== 0) {
                buttons = [
                    [{ text: lang[selectedLanguage].PAYMENT_CARD, callback_data: "w2w_card" }],
                    [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "w2w_ip_w" }],
                    [{ text: lang[selectedLanguage].PAYPAL, callback_data: "w2w_paypal" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                ];
            } else {
                buttons = [
                    [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "w2w_ip_w" }],
                    [{ text: lang[selectedLanguage].PAYPAL, callback_data: "w2w_paypal" }],
                    [{ text: lang[selectedLanguage].ADD_PAYMENT_CARD, callback_data: "add_payment_card-w2w_methods" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                ];
            }

            return await sendButtons(chatId, message, buttons, "w2w_payment_method");
        }
        chat.wallet_to_wallet.card.pan = cardId;
        await chat.save();

        const message = lang[selectedLanguage].ENTER_AMOUNT_CURRENCY.replace('{{currency}}', defaultWallet?.currency.code);

        await sendMessage(chatId, message, "w2w_card_amount");
    }
    // User has entered amount
    else if (chat?.last_message === "w2w_card_amount" && !payload && text) {
        const { status, message: validationMessage, amount } = validateAmount(text, selectedLanguage);

        if (!status) {
            await sendMessage(chatId, validationMessage);
            return;
        }

        chat.wallet_to_wallet.amount = amount;
        await chat.save();

        const receivingWallet = await Wallet.findOne({ wallet_id: chat.wallet_to_wallet.receiving_wallet });

        const { exchange_rate, fee, totalAmountWithFee, recipient_amount } =
            await calculateExchangeAndFees(
                defaultWallet.currency.code,
                receivingWallet.currency.code,
                amount,
                "wallet_to_wallet",
                chat?.account?.level._id,
                "card",
                defaultWallet,
                "instant"
            );

        let exchangedAmountSender = await getExchangeRatesToUSD(defaultWallet.currency.code, 'USD', totalAmountWithFee);

        const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, defaultWallet, 'sending');

        if (!sender_limits_check.status) {
            await sendMessage(chatId, sender_limits_check.message, "w2w_card_amount");
            return;
        }

        const amountToSendText = lang[selectedLanguage].AMOUNT_TO_SEND;
        const exchangeRateText = lang[selectedLanguage].EXCHANGE_RATE;
        const feeText = lang[selectedLanguage].FEE;
        const recipientGetsText = lang[selectedLanguage].RECIPIENT_GETS;
        const totalAmountText = lang[selectedLanguage].TOTAL_AMOUNT;

        let message;

        if (defaultWallet?.currency?.code !== receivingWallet?.currency.code) {
            message = `
${amountToSendText}: ${formattedAmount(amount)} ${defaultWallet?.currency?.code}
    
${exchangeRateText}: 1.00 ${defaultWallet?.currency?.code} = ${exchange_rate} ${receivingWallet?.currency.code}
${feeText}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}
    
${recipientGetsText} ${formattedAmount(recipient_amount)} ${receivingWallet?.currency.code}
    
${totalAmountText}: ${formattedAmount(totalAmountWithFee)} ${defaultWallet?.currency?.code}
    `;
        } else {
            message = `
${amountToSendText}: ${formattedAmount(amount)} ${defaultWallet?.currency?.code}
    
${feeText}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}
    
${recipientGetsText} ${formattedAmount(recipient_amount)} ${receivingWallet?.currency.code}
    
${totalAmountText}: ${formattedAmount(totalAmountWithFee)} ${defaultWallet?.currency?.code}
    `;
        }

        const buttons = [
            [{ text: lang[selectedLanguage].PROCEED_TO_TRANSFER, callback_data: "w2w_card-proceed" }],
            [{ text: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, callback_data: "w2w_card-adjust" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons);
    }

    // User has selected to adjust amount
    else if (payload === "w2w_card-adjust" && chat?.last_message === "w2w_card_amount") {
        chat.wallet_to_wallet.amount = undefined;
        await chat.save();

        const message = lang[selectedLanguage].UPDATED_AMOUNT;
        await sendMessage(chatId, message, "w2w_card_amount");
    }

    // User has selected "Proceed to Transfer"
    else if (payload === 'w2w_card-proceed' && chat?.last_message === "w2w_card_amount") {
        const buttons = [
            [{ text: lang[selectedLanguage].PERSONAL_SUPPORT, callback_data: "w2w_card_purpose-family_support" }],
            [{ text: lang[selectedLanguage].BUSINESS_TRADE, callback_data: "w2w_card_purpose-business_trade" }],
            [{ text: lang[selectedLanguage].OPERATIONAL_COSTS, callback_data: "w2w_card_purpose-operational_costs" }],
            [{ text: lang[selectedLanguage].PURCHASES, callback_data: "w2w_card_purpose-purchases" }],
            [{ text: lang[selectedLanguage].CHARITY_DONATIONS, callback_data: "w2w_card_purpose-charity" }],
            [{ text: lang[selectedLanguage].OTHER_REASONS, callback_data: "w2w_card_purpose-other_reasons" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "w2w" }]
        ];

        await sendButtons(chatId, `${lang[selectedLanguage].TRANSFER_REASON_MESSAGE} ${lang[selectedLanguage].SELECT_PURPOSE} 👇`, buttons, "w2w_card_purpose");
    }

    // User has selected purpose of transaction
    else if (payload?.includes('w2w_card_purpose-') && chat?.last_message === "w2w_card_purpose") {

        const purpose = payload?.split("-")[1];
        chat.wallet_to_wallet.purpose = purpose;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].ADD_NOTE_BUTTON, callback_data: "w2w_card_note" }],
            [{ text: lang[selectedLanguage].ATTACH_DOCUMENT_BUTTON, callback_data: "w2w_card_document" }],
            [{ text: lang[selectedLanguage].SKIP, callback_data: "w2w_card_no_attch" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, buttons, "w2w_card_attch");
    }

    // attachments flow
    // ask user to enter a note for intl transfer
    else if (payload === "w2w_card_note" && chat?.last_message === "w2w_card_attch") {
        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "w2w_card_note");
    }
    // user has entered a note
    else if (chat?.last_message === "w2w_card_note" && text && !payload) {
        chat.wallet_to_wallet.note = text;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].YES, callback_data: "w2w_card_add_attch" }],
            [{ text: lang[selectedLanguage].NO, callback_data: "w2w_card_no_attch" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, buttons, "w2w_card_note_added");
    }
    // user has also proceeded with adding an attachment
    else if (payload === "w2w_card_add_attch" && chat?.last_message === "w2w_card_note_added") {
        const buttons = [
            [{ text: lang[selectedLanguage].SKIP, callback_data: "w2w_card_no_attch" }],
            [{ text: "Images", callback_data: "w2w_card_attch_images" }],
            [{ text: "Video", callback_data: "w2w_card_attch_videos" }],
            [{ text: "Both", callback_data: "w2w_card_attch_both" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, "What do you want to attach? You can only attach up to 4 images and 1 video, totaling 5 files. ", buttons, "w2w_card_attachments");
    }

    // user has not proceeded with adding an attachement
    else if (payload === "w2w_card_no_attch" || payload === "w2w_card_without_doc") {
        await w2wMethods(chatId, selectedLanguage, "w2w_card");
    }

    // user has asked to upload the images
    else if (payload === "w2w_card_attch_images" && chat?.last_message === "w2w_card_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, "Please upload up to 4 images.", buttons, "w2w_card_images");
    }

    // bot is expecting images when last message is "w2w_card_images"
    else if (chat?.last_message === "w2w_card_images" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, "You can only attach up to 4 images.");
            return;
        }
        const uploadedImageUrls = await processImageUploads(image_payloads);

        for (const image of uploadedImageUrls) {
            chat.wallet_to_wallet.attachments.push({
                key: image.key,
                url: image.url,
                ETag: image.ETag
            })
        }

        await chat.save();

        await w2wMethods(chatId, selectedLanguage, "w2w_card");

    }

    // user has been asked to upload the video
    else if (payload === "w2w_card_attch_videos" && chat?.last_message === "w2w_card_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, "Please upload a video.", buttons, "w2w_card_video");
    }

    // bot is expecting a video when last message is "w2w_card_video"
    else if (chat?.last_message === "w2w_card_video" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, "You can only attach up to 1 video.");
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.wallet_to_wallet.attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        await w2wMethods(chatId, selectedLanguage, "w2w_card");
    }

    else if (payload === "w2w_card_attch_both" && chat?.last_message === "w2w_card_attachments") {
        const message = "Alright! You can first upload images and then videos. Let’s start with the images. You can upload up to 4 images."

        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "w2w_card_images_both");
    }

    // if the last message is set to w2w_card_images_both, the bot is expecting images
    else if (chat?.last_message === "w2w_card_images_both" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, "You can only attach up to 4 images.");
            return;
        }
        const uploadedImageUrls = await processImageUploads(image_payloads);
        console.log({ uploadedImageUrls })

        for (const image of uploadedImageUrls) {
            chat.wallet_to_wallet.attachments.push({
                key: image.key,
                url: image.url,
                ETag: image.ETag
            })
        }

        await chat.save();

        const message = "Got it! Now, please upload up to 1 video."

        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "w2w_card_video_both");
    }

    // if the last message is set to w2w_card_video_both, the bot is expecting a video
    else if (chat?.last_message === "w2w_card_video_both" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, "You can only attach up to 1 video.");
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.wallet_to_wallet.attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        await w2wMethods(chatId, selectedLanguage, "w2w_card");
    }

    // second option
    else if (payload === "w2w_card_document" && chat?.last_message === "w2w_card_attch") {
        const buttons = [
            [{ text: lang[selectedLanguage].SKIP, callback_data: "w2w_card_no_attch" }],
            [{ text: "Images", callback_data: "w2w_card_attch_images_1" }],
            [{ text: "Video", callback_data: "w2w_card_attch_videos_1" }],
            [{ text: "Both", callback_data: "w2w_card_attch_both_1" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, "What do you want to attach? You can only attach up to 4 images and 1 video, totaling 5 files. ", buttons, "w2w_card_attachments");
    }

    // user has asked to upload the images
    else if (payload === "w2w_card_attch_images_1" && chat?.last_message === "w2w_card_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, "Please upload up to 4 images.", buttons, "w2w_card_attch_images_1");
    }

    // bot is expecting images when last message is "w2w_card_attch_images_1"
    else if (chat?.last_message === "w2w_card_attch_images_1" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, "You can only attach up to 4 images.");
            return;
        }

        const uploadedImageUrls = await processImageUploads(image_payloads);

        for (const image of uploadedImageUrls) {
            chat.wallet_to_wallet.attachments.push({
                key: image.key,
                url: image.url,
                ETag: image.ETag
            })
        }

        await chat.save();

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "w2w_card_note_1");
    }

    // user has asked to upload the video
    else if (payload === "w2w_card_attch_videos_1" && chat?.last_message === "w2w_card_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, "Please upload a video.", buttons, "w2w_card_attch_videos_1");
    }

    // bot is expecting a video when last message is "w2w_card_attch_videos_1"
    else if (chat?.last_message === "w2w_card_attch_videos_1" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, "You can only attach up to 1 video.");
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.wallet_to_wallet.attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "w2w_card_note_1");
    }

    // when last message is "w2w_card_note_1" and user has entered a note
    else if (chat?.last_message === "w2w_card_note_1" && text && !payload) {
        chat.wallet_to_wallet.note = text;
        await chat.save();

        await w2wMethods(chatId, selectedLanguage, "w2w_card");
    }

    else if (payload === "w2w_card_attch_both_1" && chat?.last_message === "w2w_card_attachments") {
        const message = "Alright! You can first upload images and then videos. Let’s start with the images. You can upload up to 4 images."

        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "w2w_card_images_both_1");
    }

    // if the last message is set to w2w_card_images_both, the bot is expecting images
    else if (chat?.last_message === "w2w_card_images_both_1" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, "You can only attach up to 4 images.");
            return;
        }
        const uploadedImageUrls = await processImageUploads(image_payloads);

        for (const image of uploadedImageUrls) {
            chat.wallet_to_wallet.attachments.push({
                key: image.key,
                url: image.url,
                ETag: image.ETag
            })
        }

        await chat.save();

        const message = "Got it! Now, please upload up to 1 video."

        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "w2w_card_video_both_1");
    }

    // if the last message is set to w2w_card_video_both, the bot is expecting a video
    else if (chat?.last_message === "w2w_card_video_both_1" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, "You can only attach up to 1 video.");
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.wallet_to_wallet.attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "w2w_card_note_1");
    }

    // if user has selected instant w2w
    else if (payload === "w2w_card_instant" && chat?.last_message === "w2w_card_payment_type") {

        const receiverWalletDetails = await Wallet.findOne({ wallet_id: chat.wallet_to_wallet.receiving_wallet }).populate([{ path: 'account', populate: [{ path: 'user' }, { path: 'company' }] }]);

        const { totalAmountWithFee } = await calculateExchangeAndFees(
            defaultWallet.currency.code,
            receiverWalletDetails.currency.code,
            chat.wallet_to_wallet.amount,
            "wallet_to_wallet",
            chat?.account?.level._id,
            "card",
            defaultWallet,
            "instant"
        );

        const userName =
            receiverWalletDetails?.account?.account_type === "individual"
                ? `${receiverWalletDetails?.account?.user?.first_name} ${receiverWalletDetails?.account?.user?.last_name}`
                : receiverWalletDetails?.account?.company?.company_name;

        const message = `
${lang[selectedLanguage].CONFIRM_TRANSFER_MESSAGE} ${formattedAmount(totalAmountWithFee)} ${defaultWallet?.currency.code} ${lang[selectedLanguage].TO_MESSAGE} ${userName}.
    
${lang[selectedLanguage].IS_CORRECT_MESSAGE}
    `;

        const buttons = [
            [{ text: lang[selectedLanguage].CONFIRM_TRANSFER_TITLE, callback_data: "w2w_card_instant_confirm" }],
            [{ text: lang[selectedLanguage].CANCEL_TRANSACTION_TITLE, callback_data: "cancel_w2w" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, message, buttons);
    }

    // if user has selected instant w2w with card
    else if (payload === "w2w_card_instant_confirm") {
        await handleOTPGenerationTG(selectedLanguage, chat, "w2w_card-otp", "w2w_card-otp", "Transaction OTP");
    }

    // User has entered OTP for instant
    if (chat.last_message === "w2w_card-otp" && !payload && text) {
        const otpValidationResult = await validateOTPTG(chatId, text, "w2w_card-otp");

        if (otpValidationResult.status) {
            const receivingWallet = await Wallet.findOne({ wallet_id: chat.wallet_to_wallet.receiving_wallet });

            const { fee, totalAmountWithFee, recipient_amount, feeType, markup, original_rate, exchange_rate, topupFee, feeToSendingRate } =
                await calculateExchangeAndFees(defaultWallet.currency.code, receivingWallet.currency.code, chat.wallet_to_wallet.amount,
                    "wallet_to_wallet", chat.account?.level._id, "card", defaultWallet, "instant");

            const extrasPayload = {
                extras: {
                    exchange_rate,
                    fee,
                    totalAmountWithFee,
                    recipient_amount,
                    feeType,
                    markup,
                    original_rate,
                    topupFee,
                    feeToSendingRate
                }
            };

            const token = jwt.sign(extrasPayload, process.env.jwtKey, { expiresIn: "10m" });

            let w2w_data = {
                receiver_wallet_id: chat.wallet_to_wallet.receiving_wallet,
                sender_wallet_id: defaultWallet?._id,
                purpose: "OTHERS",
                amount: chat.wallet_to_wallet.amount,
                type: "instant",
                payment_type: "wallet_to_wallet",
                description: "",
                token
            };

            const transactionDetails = await initiateTopUpSavedCard(defaultWallet._id, parseFloat(totalAmountWithFee) * 100, chat.wallet_to_wallet.card.pan, w2w_data);
            console.log({ transactionDetails });

            if (transactionDetails?.status) {
                const title = lang[selectedLanguage].VERIFY_CARD;
                const subtitle = `
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${defaultWallet?.currency?.code}
            `;

                const buttons = [
                    [{ text: lang[selectedLanguage].VERIFY, url: `https://my.insta-pay.ch/chatbot/pan-transaction?token=${transactionDetails?.data?.token}&transaction_id=${transactionDetails?.data?.transaction_id}&reference_id=${transactionDetails?.data?.reference_id}&w2w_token=${transactionDetails?.data?.w2w_data}&slug=confirm-chatbot-w2w-pan-topup-telegram` }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];

                await sendButtons(chatId, `${title}\n\n${subtitle}`, buttons);
            } else {
                const buttons = [
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];
                await sendButtons(chatId, lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR, buttons);
            }
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessageTG(chatId, "w2w_card-otp", selectedLanguage, chat?.otpType);
            }
        }
    }


}

module.exports = { w2wUsingCard }