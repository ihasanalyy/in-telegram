const Wallet = require("../../../models/Wallet.model");
const lang = require("../../../utils/languages/languages.json");
const { checkTransactionLimitsForSender } = require("../../conversion");
const { calculateExchangeAndFees, getExchangeRatesToUSD, fetchLocalOrDefaultWalletConditionally } = require("../../helpers");
const { formattedAmount } = require("../../InstaChatbotHelpers");
const { validateAmount } = require("../../instaChatbotUtils");
const { sendButtons, sendMessage, w2wMethods, somethingWentWrongQuickReplyTelegram, processVideoUploads, processImageUploads } = require("../../telegramBotUtils");
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler");
const PanModel = require("../../../models/Pan.model");
const jwt = require("jsonwebtoken");
const axios = require('axios');
const { initiateW2WPaypalTransactionHelper } = require("../../chatbot/w2w/paypal/w2wUsingPaypal");

async function w2wUsingPaypal(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(chat.account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReplyTelegram(chatId, lang[selectedLanguage].NO_DEFAULT_WALLET_SET, selectedLanguage);
    }

    if (payload === "w2w_paypal" && chat?.last_message === "w2w_payment_method") {
        const message = lang[selectedLanguage].ENTER_AMOUNT_CURRENCY.replace('{{currency}}', defaultWallet?.currency.code);
        await sendMessage(chatId, message, "w2w_paypal_amount");
    }

    // User has entered amount
    else if (chat?.last_message === "w2w_paypal_amount" && !payload && text) {
        const { status, message: validationMessage, amount } = validateAmount(text, selectedLanguage);

        if (!status) {
            await sendMessage(chatId, validationMessage);
            return;
        }

        chat.wallet_to_wallet.amount = amount;
        await chat.save();

        const receivingWallet = await Wallet.findOne({ wallet_id: chat.wallet_to_wallet.receiving_wallet });

        const { exchange_rate, fee, totalAmountWithFee, recipient_amount, paypal } = await calculateExchangeAndFees(
            defaultWallet.currency.code,
            receivingWallet.currency.code,
            amount,
            "wallet_to_wallet",
            chat.account?.level._id,
            "paypal",
            defaultWallet,
            "instant"
        );

        let exchangedAmountSender = await getExchangeRatesToUSD(defaultWallet.currency.code, 'USD', totalAmountWithFee);
        const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, defaultWallet, 'sending');

        if (!sender_limits_check.status) {
            await sendMessage(chatId, sender_limits_check.message);
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
    
${totalAmountText}: ${formattedAmount(totalAmountWithFee)} ${defaultWallet?.currency?.code}`;
        } else {
            message = `
${amountToSendText}: ${formattedAmount(amount)} ${defaultWallet?.currency?.code}
    
${feeText}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}
    
${recipientGetsText} ${formattedAmount(recipient_amount)} ${receivingWallet?.currency.code}
    
${totalAmountText}: ${formattedAmount(totalAmountWithFee)} ${defaultWallet?.currency?.code}`;
        }

        let paypalMessage = "";

        if (!paypal?.paypal_currency_supported) {
            paypalMessage = `
${lang[selectedLanguage].PAYPAL_CURRENCY_NOT_SUPPORTED.replace('{{currency}}', defaultWallet?.currency?.code)}\n
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${defaultWallet?.currency?.code} = ${formattedAmount(paypal?.paypal_rate.value, 6)} ${paypal?.paypal_rate.currency}
${lang[selectedLanguage].AMOUNT_IN_USD} ${formattedAmount(paypal?.paypal_converted.value)} ${paypal?.paypal_converted.currency}`;
        }

        const buttons = [
            [{ text: lang[selectedLanguage].PROCEED_TO_TRANSFER, callback_data: "w2w_paypal-proceed" }],
            [{ text: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, callback_data: "w2w_paypal-adjust" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        if (paypalMessage) {
            await sendMessage(chatId, message);
            await sendButtons(chatId, paypalMessage, buttons);
        } else {
            await sendButtons(chatId, message, buttons);
        }
    }

    // User has selected to adjust amount
    else if (payload === "w2w_paypal-adjust" && chat?.last_message === "w2w_paypal_amount") {
        chat.international_transfer.amount = null;
        await chat.save();

        const message = lang[selectedLanguage].UPDATED_AMOUNT;
        await sendMessage(chatId, message);
    }

    // User has selected "Proceed to Transfer"
    else if (payload === 'w2w_paypal-proceed') {
        const buttons = [
            [{ text: lang[selectedLanguage].PERSONAL_SUPPORT, callback_data: "w2w_paypal_purpose-family_support" }],
            [{ text: lang[selectedLanguage].BUSINESS_TRADE, callback_data: "w2w_paypal_purpose-business_trade" }],
            [{ text: lang[selectedLanguage].OPERATIONAL_COSTS, callback_data: "w2w_paypal_purpose-operational_costs" }],
            [{ text: lang[selectedLanguage].PURCHASES, callback_data: "w2w_paypal_purpose-purchases" }],
            [{ text: lang[selectedLanguage].CHARITY_DONATIONS, callback_data: "w2w_paypal_purpose-charity" }],
            [{ text: lang[selectedLanguage].OTHER_REASONS, callback_data: "w2w_paypal_purpose-other_reasons" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "w2w" }]
        ];

        await sendButtons(chatId, `${lang[selectedLanguage].TRANSFER_REASON_MESSAGE} ${lang[selectedLanguage].SELECT_PURPOSE} 👇`, buttons, "w2w_paypal_purpose");
    }

    // User has selected purpose of transaction
    else if (payload?.includes('w2w_paypal_purpose-') && chat?.last_message === "w2w_paypal_purpose") {
        const purpose = payload?.split("-")[1];
        chat.wallet_to_wallet.purpose = purpose;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].ADD_NOTE_BUTTON, callback_data: "w2w_paypal_note" }],
            [{ text: lang[selectedLanguage].ATTACH_DOCUMENT_BUTTON, callback_data: "w2w_paypal_document" }],
            [{ text: lang[selectedLanguage].SKIP, callback_data: "w2w_paypal_no_attch" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, buttons, "w2w_paypal_attch");
    }

    // attachments flow
    // ask user to enter a note for intl transfer
    else if (payload === "w2w_paypal_note" && chat?.last_message === "w2w_paypal_attch") {
        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "w2w_paypal_note");
    }
    // user has entered a note
    else if (chat?.last_message === "w2w_paypal_note" && text && !payload) {
        chat.wallet_to_wallet.note = text;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].YES, callback_data: "w2w_paypal_add_attch" }],
            [{ text: lang[selectedLanguage].NO, callback_data: "w2w_paypal_no_attch" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, buttons, "w2w_paypal_note_added");
    }
    // user has also proceeded with adding an attachment
    else if (payload === "w2w_paypal_add_attch" && chat?.last_message === "w2w_paypal_note_added") {
        const buttons = [
            [{ text: lang[selectedLanguage].SKIP, callback_data: "w2w_paypal_no_attch" }],
            [{ text: lang[selectedLanguage].IMAGES_OPTIONS, callback_data: "w2w_paypal_attch_images" }],
            [{ text: lang[selectedLanguage].VIDEOS_OPTIONS, callback_data: "w2w_paypal_attch_videos" }],
            [{ text: lang[selectedLanguage].BOTH_OPTIONS, callback_data: "w2w_paypal_attch_both" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].ATTACH_MESSAGE, buttons, "w2w_paypal_attachments");
    }

    // user has not proceeded with adding an attachement
    else if (payload === "w2w_paypal_no_attch" || payload === "w2w_paypal_without_doc") {
        await w2wMethods(chatId, selectedLanguage, "w2w_paypal");
    }

    // user has asked to upload the images
    else if (payload === "w2w_paypal_attch_images" && chat?.last_message === "w2w_paypal_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_IMAGES, buttons, "w2w_paypal_images");
    }

    // bot is expecting images when last message is "w2w_paypal_images"
    else if (chat?.last_message === "w2w_paypal_images" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, lang[selectedLanguage].IMG_LIMIT);
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

        await w2wMethods(chatId, selectedLanguage, "w2w_paypal");

    }

    // user has been asked to upload the video
    else if (payload === "w2w_paypal_attch_videos" && chat?.last_message === "w2w_paypal_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_VIDEO, buttons, "w2w_paypal_video");
    }

    // bot is expecting a video when last message is "w2w_paypal_video"
    else if (chat?.last_message === "w2w_paypal_video" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, lang[selectedLanguage].VIDEO_LIMIT);
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.wallet_to_wallet.attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        await w2wMethods(chatId, selectedLanguage, "w2w_paypal");
    }

    else if (payload === "w2w_paypal_attch_both" && chat?.last_message === "w2w_paypal_attachments") {
        const message = lang[selectedLanguage].MAX_FILES

        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "w2w_paypal_images_both");
    }

    // if the last message is set to w2w_paypal_images_both, the bot is expecting images
    else if (chat?.last_message === "w2w_paypal_images_both" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, lang[selectedLanguage].IMG_LIMIT);
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

        const message = lang[selectedLanguage].GOT_IT_MESSAGE;

        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "w2w_paypal_video_both");
    }

    // if the last message is set to w2w_paypal_video_both, the bot is expecting a video
    else if (chat?.last_message === "w2w_paypal_video_both" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, lang[selectedLanguage].VIDEO_LIMIT);
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.wallet_to_wallet.attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        await w2wMethods(chatId, selectedLanguage, "w2w_paypal");
    }

    // second option
    else if (payload === "w2w_paypal_document" && chat?.last_message === "w2w_paypal_attch") {
        const buttons = [
            [{ text: lang[selectedLanguage].SKIP, callback_data: "w2w_paypal_no_attch" }],
            [{ text: lang[selectedLanguage].IMAGES_OPTIONS, callback_data: "w2w_paypal_attch_images_1" }],
            [{ text: lang[selectedLanguage].VIDEOS_OPTIONS, callback_data: "w2w_paypal_attch_videos_1" }],
            [{ text: lang[selectedLanguage].BOTH_OPTIONS, callback_data: "w2w_paypal_attch_both_1" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].ATTACH_MESSAGE, buttons, "w2w_paypal_attachments");
    }

    // user has asked to upload the images
    else if (payload === "w2w_paypal_attch_images_1" && chat?.last_message === "w2w_paypal_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_IMAGES, buttons, "w2w_paypal_attch_images_1");
    }

    // bot is expecting images when last message is "w2w_paypal_attch_images_1"
    else if (chat?.last_message === "w2w_paypal_attch_images_1" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, lang[selectedLanguage].IMG_LIMIT);
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

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "w2w_paypal_note_1");
    }

    // user has asked to upload the video
    else if (payload === "w2w_paypal_attch_videos_1" && chat?.last_message === "w2w_paypal_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_VIDEO, buttons, "w2w_paypal_attch_videos_1");
    }

    // bot is expecting a video when last message is "w2w_paypal_attch_videos_1"
    else if (chat?.last_message === "w2w_paypal_attch_videos_1" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, lang[selectedLanguage].VIDEO_LIMIT);
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.wallet_to_wallet.attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "w2w_paypal_note_1");
    }

    // when last message is "w2w_paypal_note_1" and user has entered a note
    else if (chat?.last_message === "w2w_paypal_note_1" && text && !payload) {
        chat.wallet_to_wallet.note = text;
        await chat.save();

        await w2wMethods(chatId, selectedLanguage, "w2w_paypal");
    }

    else if (payload === "w2w_paypal_attch_both_1" && chat?.last_message === "w2w_paypal_attachments") {
        const message = lang[selectedLanguage].MAX_FILES

        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "w2w_paypal_images_both_1");
    }

    // if the last message is set to w2w_paypal_images_both, the bot is expecting images
    else if (chat?.last_message === "w2w_paypal_images_both_1" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, lang[selectedLanguage].IMG_LIMIT);
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

        const message = lang[selectedLanguage].GOT_IT_MESSAGE;

        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "w2w_paypal_video_both_1");
    }

    // if the last message is set to w2w_paypal_video_both, the bot is expecting a video
    else if (chat?.last_message === "w2w_paypal_video_both_1" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, lang[selectedLanguage].VIDEO_LIMIT);
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.wallet_to_wallet.attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "w2w_paypal_note_1");
    }

    // if user has selected instant w2w
    else if (payload === "w2w_paypal_instant" && chat?.last_message === "w2w_paypal_payment_type") {

        const receiverWalletDetails = await Wallet.findOne({ wallet_id: chat.wallet_to_wallet.receiving_wallet }).populate([{ path: 'account', populate: [{ path: 'user' }, { path: 'company' }] }]);

        const { totalAmountWithFee } = await calculateExchangeAndFees(
            defaultWallet.currency.code,
            receiverWalletDetails.currency.code,
            chat.wallet_to_wallet.amount,
            "wallet_to_wallet",
            chat?.account?.level._id,
            "paypal",
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
            [{ text: lang[selectedLanguage].CONFIRM_TRANSFER_TITLE, callback_data: "w2w_paypal_instant_confirm" }],
            [{ text: lang[selectedLanguage].CANCEL_TRANSACTION_TITLE, callback_data: "cancel_w2w" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, message, buttons, "w2w_paypal_instant_confirm");
    }
    // if user has selected instant w2w with paypal
    else if (payload === "w2w_paypal_instant_confirm" && chat?.last_message === "w2w_paypal_instant_confirm") {
        await handleOTPGenerationTG(selectedLanguage, chat, "w2w_paypal-otp", "w2w_paypal-otp", "Transaction OTP");
    }

    // User has entered OTP for instant transfer
    else if (chat.last_message === "w2w_paypal-otp" && !payload && text) {
        const otpValidationResult = await validateOTPTG(chatId, text, "w2w_paypal-otp");

        if (otpValidationResult.status) {
            const receivingWallet = await Wallet.findOne({ wallet_id: chat.wallet_to_wallet.receiving_wallet });

            const rates = await calculateExchangeAndFees(
                defaultWallet.currency.code,
                receivingWallet.currency.code,
                chat.wallet_to_wallet.amount,
                "wallet_to_wallet",
                chat.account?.level._id,
                "paypal",
                defaultWallet,
                "instant"
            );

            const extrasPayload = {
                extras: {
                    exchange_rate: rates.exchange_rate,
                    fee: rates.fee,
                    totalAmountWithFee: rates.totalAmountWithFee,
                    recipient_amount: rates.recipient_amount,
                    feeType: rates.feeType,
                    markup: rates.markup,
                    original_rate: rates.original_rate,
                    topupFee: rates.topupFee,
                    feeToSendingRate: rates.feeToSendingRate
                }
            };

            const token = jwt.sign(extrasPayload, process.env.jwtKey, { expiresIn: "10m" });

            let w2w_data = {
                receiver_wallet_id: chat.wallet_to_wallet.receiving_wallet,
                sender_wallet_id: defaultWallet?._id,
                purpose: chat.wallet_to_wallet.purpose,
                amount: chat.wallet_to_wallet.amount,
                type: "instant",
                payment_type: "wallet_to_wallet",
                description: "",
                token
            };

            const JWTToken = jwt.sign(w2w_data, process.env.jwtKey, { expiresIn: "10m" });

            console.log({ rates, w2w_data });
            const initiateDetails = await initiateW2WPaypalTransactionHelper(rates, w2w_data, JWTToken, "instant", "telegram");
            console.log({ initiateDetails });

            if (initiateDetails?.status) {
                const message = `
${lang[selectedLanguage].VERIFY_PAYPAL_ACCOUNT}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(rates.totalAmountWithFee)} ${defaultWallet?.currency?.code}
            `;

                const buttons = [
                    [{ text: lang[selectedLanguage].VERIFY, url: initiateDetails?.url }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];

                await sendButtons(chatId, message, buttons);
            } else {
                const buttons = [
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];
                await sendButtons(chatId, initiateDetails?.message || lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR, buttons);
            }
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessageTG(chatId, "w2w_paypal-otp", selectedLanguage, chat?.otpType);
            }
        }
    }

}

module.exports = { w2wUsingPaypal }