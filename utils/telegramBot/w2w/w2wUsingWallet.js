const Wallet = require("../../../models/Wallet.model");
const lang = require("../../../utils/languages/languages.json");
const currencyToEmoji = require('../../../utils/currencyEmojis.json');
const { checkTransactionLimitsForSender } = require("../../conversion");
const { calculateExchangeAndFees, getExchangeRatesToUSD, getUserActiveWallets } = require("../../helpers");
const { formattedAmount, walletToWalletTransaction } = require("../../InstaChatbotHelpers");
const { validateAmount, usersFeatureMessage, userLimitsMessage, generateToken } = require("../../instaChatbotUtils");
const { sendButtons, sendMessage, invalidInputResponse, w2wMethods, processVideoUploads, processImageUploads, sendPhoto } = require("../../telegramBotUtils");
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler");
const Schedule = require("../../../models/Schedule.model");

async function w2wUsingWallet(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    if (payload === "w2w_ip_w" && (chat?.last_message === "w2w_payment_method" || chat?.last_message === "w2w_ip_w_amount")) {
        const wallets = await getUserActiveWallets(chat.account._id)
        const slicedWallets = wallets.slice(0, 8);

        let buttons = [slicedWallets.map((wallet) => (
            { text: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, callback_data: `w2w_ip_w-${wallet._id}` }
        ))];

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);

        await sendButtons(chatId, lang[selectedLanguage].SELECT_WALLET_CURRENCY, buttons, "w2w_ip_w_wallets");
    }
    // User has selected a currency to proceed with W2W
    else if ((payload?.includes('w2w_ip_w-') || payload === "w2w_ip_w_adjust_amount") && (chat?.last_message === "w2w_ip_w_wallets" || chat?.last_message === "w2w_ip_w_amount")) {
        let walletDetails;

        if (payload !== "w2w_ip_w_adjust_amount") {
            const walletID = payload.split('-')[1];
            walletDetails = await Wallet.findById(walletID);
            chat.wallet_to_wallet.sending_wallet = walletID;
            await chat.save();
            console.log(walletDetails);
        } else {
            walletDetails = await Wallet.findById(chat.wallet_to_wallet.sending_wallet);
        }

        const message = lang[selectedLanguage].TRANSFER_MESSAGE
            .replace('{{formattedAmount}}', formattedAmount(walletDetails?.balance?.available))
            .replace('{{currencyCode}}', walletDetails.currency.code);

        const buttons = [
            [{ text: lang[selectedLanguage].CHANGE_WALLET, callback_data: "w2w_ip_w" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "w2w_ip_w_amount");
    }

    // User has entered amount to be sent using W2W
    else if (chat?.last_message === "w2w_ip_w_amount" && text && !payload) {
        const { status, message: validationMessage, amount } = validateAmount(text, selectedLanguage);

        if (!status) {
            await sendMessage(chatId, validationMessage);
            return;
        }

        const walletDetails = await Wallet.findById(chat.wallet_to_wallet.sending_wallet);

        if (amount > walletDetails?.balance?.available) {
            const buttons = [
                [{ text: lang[selectedLanguage].CHANGE_PAYMENT_METHOD, callback_data: "w2w_methods" }],
                [{ text: lang[selectedLanguage].ADD_FUNDS, callback_data: "add_funds" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
            await sendButtons(chatId, lang[selectedLanguage].INSUFFICIENT_BALANCE, buttons);
        } else {
            const receiverWalletDetails = await Wallet.findOne({ wallet_id: chat.wallet_to_wallet.receiving_wallet })
            const senderWalletDetails = await Wallet.findById(chat.wallet_to_wallet.sending_wallet)
                .populate([{ path: 'account', populate: [{ path: 'level' }] }]);

            const { exchange_rate, fee, totalAmountWithFee, recipient_amount } = await calculateExchangeAndFees(
                senderWalletDetails.currency.code,
                receiverWalletDetails.currency.code,
                amount,
                "wallet_to_wallet",
                senderWalletDetails.account.level._id,
                "wallet",
                senderWalletDetails
            );

            let exchangedAmountSender = await getExchangeRatesToUSD(senderWalletDetails.currency.code, 'USD', totalAmountWithFee);
            const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, senderWalletDetails, 'sending');

            if (!sender_limits_check.status) {
                await sendMessage(chatId, sender_limits_check.message);
                return;
            }

            chat.wallet_to_wallet.amount = amount;
            await chat.save();

            let message;
            if (senderWalletDetails?.currency?.code !== receiverWalletDetails?.currency.code) {
                message = `
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(amount)} ${senderWalletDetails?.currency?.code}
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${senderWalletDetails?.currency?.code} = ${exchange_rate} ${receiverWalletDetails?.currency.code}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${senderWalletDetails?.currency?.code}
${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(recipient_amount)} ${receiverWalletDetails?.currency.code}
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${senderWalletDetails?.currency?.code}
            `;
            } else {
                message = `
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(amount)} ${senderWalletDetails?.currency?.code}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${senderWalletDetails?.currency?.code}
${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(recipient_amount)} ${receiverWalletDetails?.currency.code}
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${senderWalletDetails?.currency?.code}
            `;
            }

            const buttons = [
                [{ text: lang[selectedLanguage].PROCEED_TO_TRANSFER, callback_data: "w2w_ip_w_proceed" }],
                [{ text: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, callback_data: "w2w_ip_w_adjust_amount" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];

            await sendButtons(chatId, message, buttons);
        }
    }

    // User has selected "Proceed to Transfer"
    else if (payload === 'w2w_ip_w_proceed' && chat?.last_message === "w2w_ip_w_amount") {
        const buttons = [
            [{ text: lang[selectedLanguage].PERSONAL_SUPPORT, callback_data: "w2w_ip_w_purpose-family_support" }],
            [{ text: lang[selectedLanguage].BUSINESS_TRADE, callback_data: "w2w_ip_w_purpose-business_trade" }],
            [{ text: lang[selectedLanguage].OPERATIONAL_COSTS, callback_data: "w2w_ip_w_purpose-operational_costs" }],
            [{ text: lang[selectedLanguage].PURCHASES, callback_data: "w2w_ip_w_purpose-purchases" }],
            [{ text: lang[selectedLanguage].CHARITY_DONATIONS, callback_data: "w2w_ip_w_purpose-charity" }],
            [{ text: lang[selectedLanguage].OTHER_REASONS, callback_data: "w2w_ip_w_purpose-other_reasons" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "w2w" }]
        ];

        await sendButtons(chatId, `${lang[selectedLanguage].TRANSFER_REASON_MESSAGE} ${lang[selectedLanguage].SELECT_PURPOSE} 👇`, buttons, "w2w_ip_w_purpose");
    }

    // User has selected purpose of transaction
    else if (payload?.includes('w2w_ip_w_purpose-') && chat?.last_message === "w2w_ip_w_purpose") {

        const purpose = payload?.split("-")[1];
        chat.wallet_to_wallet.purpose = purpose;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].ADD_NOTE_BUTTON, callback_data: "w2w_ip_w_note" }],
            [{ text: lang[selectedLanguage].ATTACH_DOCUMENT_BUTTON, callback_data: "w2w_ip_w_document" }],
            [{ text: lang[selectedLanguage].SKIP, callback_data: "w2w_ip_w_no_attch" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, buttons, "w2w_ip_w_attch");
    }

    // attachments flow
    // ask user to enter a note for intl transfer
    else if (payload === "w2w_ip_w_note" && chat?.last_message === "w2w_ip_w_attch") {
        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "w2w_ip_w_note");
    }
    // user has entered a note
    else if (chat?.last_message === "w2w_ip_w_note" && text && !payload) {
        chat.wallet_to_wallet.note = text;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].YES, callback_data: "w2w_ip_w_add_attch" }],
            [{ text: lang[selectedLanguage].NO, callback_data: "w2w_ip_w_no_attch" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, buttons, "w2w_ip_w_note_added");
    }
    // user has also proceeded with adding an attachment
    else if (payload === "w2w_ip_w_add_attch" && chat?.last_message === "w2w_ip_w_note_added") {
        const buttons = [
            [{ text: lang[selectedLanguage].SKIP, callback_data: "w2w_ip_w_no_attch" }],
            [{ text: lang[selectedLanguage].IMAGES_OPTIONS, callback_data: "w2w_ip_w_attch_images" }],
            [{ text: lang[selectedLanguage].VIDEOS_OPTIONS, callback_data: "w2w_ip_w_attch_videos" }],
            [{ text: lang[selectedLanguage].BOTH_OPTIONS, callback_data: "w2w_ip_w_attch_both" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].ATTACH_MESSAGE, buttons, "w2w_ip_w_attachments");
    }

    // user has not proceeded with adding an attachement
    else if (payload === "w2w_ip_w_no_attch" || payload === "w2w_ip_w_without_doc") {
        await w2wMethods(chatId, selectedLanguage, "w2w_ip_w");
    }

    // user has asked to upload the images
    else if (payload === "w2w_ip_w_attch_images" && chat?.last_message === "w2w_ip_w_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_IMAGES, buttons, "w2w_ip_w_images");
    }

    // bot is expecting images when last message is "w2w_ip_w_images"
    else if (chat?.last_message === "w2w_ip_w_images" && image_payloads.length > 0) {

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

        await w2wMethods(chatId, selectedLanguage, "w2w_ip_w");

    }

    // user has been asked to upload the video
    else if (payload === "w2w_ip_w_attch_videos" && chat?.last_message === "w2w_ip_w_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_VIDEO, buttons, "w2w_ip_w_video");
    }

    // bot is expecting a video when last message is "w2w_ip_w_video"
    else if (chat?.last_message === "w2w_ip_w_video" && video_payloads.length > 0) {

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

        await w2wMethods(chatId, selectedLanguage, "w2w_ip_w");
    }

    else if (payload === "w2w_ip_w_attch_both" && chat?.last_message === "w2w_ip_w_attachments") {
        const message = lang[selectedLanguage].MAX_FILES

        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "w2w_ip_w_images_both");
    }

    // if the last message is set to w2w_ip_w_images_both, the bot is expecting images
    else if (chat?.last_message === "w2w_ip_w_images_both" && image_payloads.length > 0) {

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

        await sendButtons(chatId, message, buttons, "w2w_ip_w_video_both");
    }

    // if the last message is set to w2w_ip_w_video_both, the bot is expecting a video
    else if (chat?.last_message === "w2w_ip_w_video_both" && video_payloads.length > 0) {

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

        await w2wMethods(chatId, selectedLanguage, "w2w_ip_w");
    }

    // second option
    else if (payload === "w2w_ip_w_document" && chat?.last_message === "w2w_ip_w_attch") {
        const buttons = [
            [{ text: lang[selectedLanguage].SKIP, callback_data: "w2w_ip_w_no_attch" }],
            [{ text: lang[selectedLanguage].IMAGES_OPTIONS, callback_data: "w2w_ip_w_attch_images_1" }],
            [{ text: lang[selectedLanguage].VIDEOS_OPTIONS, callback_data: "w2w_ip_w_attch_videos_1" }],
            [{ text: lang[selectedLanguage].BOTH_OPTIONS, callback_data: "w2w_ip_w_attch_both_1" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].ATTACH_MESSAGE, buttons, "w2w_ip_w_attachments");
    }

    // user has asked to upload the images
    else if (payload === "w2w_ip_w_attch_images_1" && chat?.last_message === "w2w_ip_w_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_IMAGES, buttons, "w2w_ip_w_attch_images_1");
    }

    // bot is expecting images when last message is "w2w_ip_w_attch_images_1"
    else if (chat?.last_message === "w2w_ip_w_attch_images_1" && image_payloads.length > 0) {

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

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "w2w_ip_w_note_1");
    }

    // user has asked to upload the video
    else if (payload === "w2w_ip_w_attch_videos_1" && chat?.last_message === "w2w_ip_w_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_VIDEO, buttons, "w2w_ip_w_attch_videos_1");
    }

    // bot is expecting a video when last message is "w2w_ip_w_attch_videos_1"
    else if (chat?.last_message === "w2w_ip_w_attch_videos_1" && video_payloads.length > 0) {

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

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "w2w_ip_w_note_1");
    }

    // when last message is "w2w_ip_w_note_1" and user has entered a note
    else if (chat?.last_message === "w2w_ip_w_note_1" && text && !payload) {
        chat.wallet_to_wallet.note = text;
        await chat.save();

        await w2wMethods(chatId, selectedLanguage, "w2w_ip_w");
    }

    else if (payload === "w2w_ip_w_attch_both_1" && chat?.last_message === "w2w_ip_w_attachments") {
        const message = lang[selectedLanguage].MAX_FILES

        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "w2w_ip_w_images_both_1");
    }

    // if the last message is set to w2w_ip_w_images_both, the bot is expecting images
    else if (chat?.last_message === "w2w_ip_w_images_both_1" && image_payloads.length > 0) {

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

        await sendButtons(chatId, message, buttons, "w2w_ip_w_video_both_1");
    }

    // if the last message is set to w2w_ip_w_video_both, the bot is expecting a video
    else if (chat?.last_message === "w2w_ip_w_video_both_1" && video_payloads.length > 0) {

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

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "w2w_ip_w_note_1");
    }

    else if (payload === "w2w_ip_w_instant" && chat?.last_message === "w2w_ip_w_payment_type") {
        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Instant.png")
        await sendButtons(chatId, lang[selectedLanguage].INSTANT_TITLE, [
            [{ text: lang[selectedLanguage].CONTINUE, callback_data: "w2w_ip_w_instant_cont" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ]);
    }
    else if (payload === "w2w_ip_w_schedule" && chat?.last_message === "w2w_ip_w_payment_type") {
        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Schedule%20Payments.png")
        await sendButtons(chatId, lang[selectedLanguage].SCHEDULE_TITLE, [
            // [{ text: lang[selectedLanguage].CONTINUE, callback_data: "w2w_ip_w_instant_cont" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ]);
    }
    else if (payload === "w2w_ip_w_subscription" && chat?.last_message === "w2w_ip_w_payment_type") {
        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Subscrption%20%281%29.png")
        await sendButtons(chatId, lang[selectedLanguage].SUBSCRIPTION_TITLE, [
            // [{ text: lang[selectedLanguage].CONTINUE, callback_data: "w2w_ip_w_instant_cont" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ]);
    }
    // if user has selected instant w2w
    else if (payload === "w2w_ip_w_instant_cont" && chat?.last_message === "w2w_ip_w_payment_type") {
        const receiverWalletDetails = await Wallet.findOne({ wallet_id: chat.wallet_to_wallet.receiving_wallet }).populate([
            {
                path: "account",
                populate: [
                    { path: "user" },
                    { path: "company" },
                ],
            },
        ]);

        const senderWalletDetails = await Wallet.findById(chat.wallet_to_wallet.sending_wallet).populate([
            {
                path: "account",
                populate: [{ path: "level" }],
            },
        ]);

        const { totalAmountWithFee } = await calculateExchangeAndFees(
            senderWalletDetails.currency.code,
            receiverWalletDetails.currency.code,
            chat.wallet_to_wallet.amount,
            "wallet_to_wallet",
            senderWalletDetails.account.level._id,
            "wallet",
            senderWalletDetails
        );

        const userName =
            receiverWalletDetails?.account?.account_type === "individual"
                ? `${receiverWalletDetails?.account?.user?.first_name} ${receiverWalletDetails?.account?.user?.last_name}`
                : receiverWalletDetails?.account?.company?.company_name;

        const message = `
${lang[selectedLanguage].CONFIRM_TRANSFER_MESSAGE} ${formattedAmount(totalAmountWithFee)} ${senderWalletDetails?.currency.code} ${lang[selectedLanguage].TO_MESSAGE} ${userName}.
    
${lang[selectedLanguage].IS_CORRECT_MESSAGE}
    `;

        const buttons = [
            [{ text: lang[selectedLanguage].CONFIRM_TRANSFER_TITLE, callback_data: "w2w_ip_w_instant_confirm" }],
            [{ text: lang[selectedLanguage].CANCEL_TRANSACTION_TITLE, callback_data: "cancel_w2w" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, message, buttons, "w2w_ip_w_instant_confirm");
    }

    // user has proceeded with w2w instant transaction
    else if (payload === "w2w_ip_w_instant_confirm" && chat?.last_message === "w2w_ip_w_instant_confirm") {
        await handleOTPGenerationTG(selectedLanguage, chat, "w2w_ip_w_instant_confirm-otp", "w2w_ip_w_instant_confirm-otp", "Transaction OTP");
    }

    else if (chat.last_message === "w2w_ip_w_instant_confirm-otp" && text) {
        const otpValidationResult = await validateOTPTG(chatId, text, "w2w_ip_w_instant_confirm-otp");

        if (otpValidationResult.status) {
            const data = {
                receiver_wallet_id: chat.wallet_to_wallet.receiving_wallet,
                sender_wallet_id: chat.wallet_to_wallet.sending_wallet,
                purpose: chat.wallet_to_wallet.purpose,
                amount: chat.wallet_to_wallet.amount,
                type: "",
                payment_type: "wallet_to_wallet",
                description: chat.wallet_to_wallet.note,
                attachments: chat.wallet_to_wallet.attachments,
                transaction_method: "wallet"
            };
            const walletToWalletResponse = await walletToWalletTransaction(data);

            if (walletToWalletResponse?.status) {
                const wallet = await Wallet.findOne({ wallet_id: chat.wallet_to_wallet.receiving_wallet }).populate({ path: 'account', populate: ['user', 'company'] });
                const sendingWallet = await Wallet.findById(chat.wallet_to_wallet.sending_wallet).populate({ path: 'account', populate: ['user', 'company'] });

                const receiverName = wallet.account.account_type === "individual" ? `${wallet.account.user.first_name} ${wallet.account.user.last_name}` : wallet.account.company.company_name;
                const senderName = sendingWallet.account.account_type === "individual" ? `${sendingWallet.account.user.first_name} ${sendingWallet.account.user.last_name}` : sendingWallet.account.company.company_name;

                const subtitles = `\n${lang[selectedLanguage].TRANSACTION_ID} ${walletToWalletResponse?.data?.reference_id}\n${lang[selectedLanguage].STATUS}: ${lang[selectedLanguage].COMPLETED}`;

                const message = `${lang[selectedLanguage].PAYMENT_DISPATCH.replace('{{receiverName}}', receiverName)}\n${subtitles}`;

                const buttons = [
                    [{ text: lang[selectedLanguage].SEND_ANOTHER, callback_data: "send_money" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];
                await sendButtons(chatId, message, buttons, "4");

                const receiverMessage = `${lang[selectedLanguage].TRANSACTION_RECEIVED.replace('{{senderName}}', senderName)}\n${subtitles}`;
                const receiverButtons = [
                    [{ text: lang[selectedLanguage].CASH_OUT_NOW, callback_data: `cash_out_id_${walletToWalletResponse?.exchanged?._id}` }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];
                await sendButtons(wallet.account.telegram_id, receiverMessage, receiverButtons, "4");

            } else if (walletToWalletResponse?.message.includes("feature_not_available")) {
                const featureType = walletToWalletResponse?.message?.split("_")[3];
                await sendMessage(chatId, usersFeatureMessage(featureType), [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }], "4");
            } else if (walletToWalletResponse?.message.includes("limit_")) {
                const limitCode = walletToWalletResponse?.message?.split("_")[1];
                await sendMessage(chatId, userLimitsMessage(limitCode, walletToWalletResponse?.sendingAmounts), [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }], "4");
            } else {
                await sendMessage(chatId, walletToWalletResponse?.message, [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }], "4");
            }
            chat.wallet_to_wallet = undefined
            await chat.save();
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {
                await invalidMessageTG(chatId, "w2w_ip_w_instant_confirm-otp", selectedLanguage, chat?.otpType);
            }
        }
    }

    // user has proceeded with schedule transaction
    if (payload === "w2w_ip_w_schedule") {
        const token = generateToken(chatId, chat._id);

        const url = `https://my.insta-pay.ch/chatbot/scheduled/${token}?default=${chat.account?.timezone}&platform=telegram`;

        const buttons = [
            [{ text: lang[selectedLanguage].SELECT_DATE_TIME, url: url }],
            [{ text: lang[selectedLanguage].BACK_TITLE, callback_data: "w2w_p_methods" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].CHOOSE_DATE_TIME, buttons);
    }

    // User has selected proceed with schedule method
    if (payload === "w2w_ip_w_schedule_proceed" && chat?.last_message === "w2w_ip_w_payment_type") {
        await handleOTPGenerationTG(selectedLanguage, chat, "w2w_ip_w_schedule-otp", "w2w_ip_w_schedule-otp", "Transaction OTP");
    }
    // User has entered OTP for scheduled payment
    else if (chat.last_message === "w2w_ip_w_schedule-otp" && text) {
        const otpValidationResult = await validateOTPTG(chatId, text, "w2w_ip_w_schedule-otp");

        if (otpValidationResult.status) {
            const data = {
                receiver_wallet_id: chat.wallet_to_wallet.receiving_wallet,
                sender_wallet_id: chat.wallet_to_wallet.sending_wallet,
                purpose: chat.wallet_to_wallet.purpose,
                amount: chat.wallet_to_wallet.amount,
                date: chat.schedule.scheduleDate,
                time: chat.schedule.scheduleTime,
                timezone: chat.schedule.scheduleTimezone || account?.timezone,
                description: chat.wallet_to_wallet.note,
                attachments: chat.wallet_to_wallet.attachments,
                reserved: true
            };

            console.log(data, "datainsched2");

            const scheduleDetails = await schedulePaymentW2W(data);
            if (scheduleDetails.status) {
                const receiverWalletDetails = await Wallet.findOne({ wallet_id: chat.international_transfer.qr_receiving_wallet }).populate([
                    {
                        path: 'account',
                        populate: [
                            { path: 'user' },
                            { path: 'company' },
                            { path: 'insta_recipient_id' },
                        ]
                    }
                ]);
                const senderWalletDetails = await Wallet.findById(chat.international_transfer.qr_sending_currency);

                // Check sender wallet balance
                if (senderWalletDetails.balance.available < chat.international_transfer.w2w_sending_amount) {
                    const schedule = await Schedule.findById(scheduleDetails?.subscribtionDetails?._id);
                    schedule.status = "declined";
                    schedule.reserved = false;
                    await schedule.save();

                    await sendMessage(chat.id, lang[selectedLanguage].INSUFFICIENT_FUNDS_SCHEDULE, [
                        { text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }
                    ]);
                    return;
                }

                // Reserve the amount if sufficient balance is available
                senderWalletDetails.balance.reserved = senderWalletDetails.balance?.reserved || 0;
                senderWalletDetails.balance.reserved += chat.international_transfer.w2w_sending_amount;
                senderWalletDetails.balance.available -= chat.international_transfer.w2w_sending_amount;
                await senderWalletDetails.save();

                const userName = receiverWalletDetails?.account?.account_type === "individual"
                    ? receiverWalletDetails?.account?.user?.first_name + " " + receiverWalletDetails?.account?.user?.last_name
                    : receiverWalletDetails?.account?.company?.company_name;

                const subtitles = `\n${lang[selectedLanguage].BENEFICIARY}: ${userName}\n${lang[selectedLanguage].SCHEDULE}: ${data.time}, ${data.date}\n${lang[selectedLanguage].TIMEZONE}: ${chat.international_transfer.scheduleTimezone || account?.timezone}\n${lang[selectedLanguage].WALLET_ID}: ${receiverWalletDetails.wallet_id}\n${lang[selectedLanguage].STATUS}: ${lang[selectedLanguage].PENDING}`;

                await sendMessage(chat.id, `Your scheduled payment of ${formattedAmount(chat.international_transfer.w2w_sending_amount.toFixed(2))} ${senderWalletDetails?.currency?.code} is all set up.\n${subtitles}`, [
                    { text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }
                ]);

                if (receiverWalletDetails?.account?.insta_recipient_id) {
                    const receiverLang = receiverWalletDetails?.account?.insta_recipient_id?.active_language || receiverWalletDetails?.account?.language || "en";
                    const subtitle1 = `\n${lang[receiverLang].COUNTRY_LABEL}: ${account?.country_name}\n${lang[selectedLanguage].SCHEDULE}: ${data.time}, ${data.date}\n${lang[selectedLanguage].TIMEZONE}: ${chat.international_transfer.scheduleTimezone || account?.timezone}\n${lang[selectedLanguage].WALLET_ID}: ${receiverWalletDetails.wallet_id}`;

                    await sendMessage(receiverWalletDetails?.account?.insta_recipient_id?.recipient, `${account?.username} has set a scheduled payment of ${formattedAmount(chat.international_transfer.w2w_sending_amount.toFixed(2))} ${senderWalletDetails?.currency?.code} for you.\n${subtitle1}`, [
                        { text: lang[selectedLanguage].VIEW_PROFILE_BUTTON, url: `https://my.insta-pay.ch/profile/${account?.username}` },
                        { text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }
                    ]);
                }
            } else {
                await sendMessage(chat.id, lang[selectedLanguage].SCHEDULE_ERROR_TITLE, [
                    { text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }
                ]);
            }

            chat.wallet_to_wallet = undefined;
            chat.schedule = undefined;

            await chat.save();
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chat.id, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessageTG(chat.id, "w2w_ip_w_schedule-otp", selectedLanguage, chat.otpType);
            }
        }
    }
}

module.exports = { w2wUsingWallet }