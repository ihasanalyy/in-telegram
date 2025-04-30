const { sendButtons, sendMessage, sendPhoto, processVideoUploads, processImageUploads, handleBeneficiaries } = require("../../telegramBotUtils");
const lang = require("../../../utils/languages/languages.json");
const { validateAmount, balanceLimitCheck, formatDateToDDMMYYYY, getCountryNameByCode } = require("../../instaChatbotUtils");
const { formattedAmount, addQuotation, bargain, declineQuotation } = require("../../InstaChatbotHelpers");
const countries = require('../../../utils/countryIso.json');
const countryToEmoji = require('../../../utils/countryEmojis.json');
const PanModel = require("../../../models/Pan.model");
const currencyToEmoji = require('../../../utils/currencyEmojis.json');
const Beneficiary = require("../../../models/Beneficiary.model");
const Account = require("../../../models/Account.model");
const { getUserActiveWallets, getActiveWalletById } = require("../../helpers");
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler");
const TelegramBotModel = require("../../../models/TelegramBot.model");
const moment = require('moment-timezone');
const Quotation = require("../../../models/Quotation.model");

async function quotation(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    if (payload === "quotation") {
        const buttons = [
            [{ text: lang[selectedLanguage].create_quote, callback_data: "quotation_create" }],
            [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].SEND_QUOTE_PROMPT, buttons, "quotation");
    }
    else if (payload === "quotation_create" && (chat?.last_message === 'quotation' || chat?.last_message === 'quotation_continue' || chat?.last_message === 'quotation_send_continue')) {
        await handleBeneficiaries(chat?.account._id, chatId, "quotation", "quotation", selectedLanguage, 1);
    }
    else if ((payload?.startsWith("quotation_next_") || payload?.startsWith("quotation_prev_")) && chat?.last_message === "quotation") {
        const pageNumber = parseInt(payload.split("_").pop());
        await handleBeneficiaries(chat?.account._id, chatId, "", "quotation", selectedLanguage, pageNumber);
    }
    else if (payload && payload.startsWith("quotation-")) {
        const benefId = payload.split("-")[1];
        console.log(benefId);

        const benefDetails = await Beneficiary.findById(benefId);
        const benefAccount = await Account.findOne({ phone: benefDetails?.phone });

        console.log(benefAccount?._id?.toString(), chat.account?._id?.toString(), benefAccount?._id, chat.account?._id);
        if (benefAccount?._id?.toString() === chat.account?._id?.toString()) {
            const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
            return await sendButtons(chatId, lang[selectedLanguage].SEND_MONEY_TO_SELF, buttons);
        }

        await sendPhoto(
            chatId,
            benefAccount?.profileImage?.url || "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/welcome-TG.png",
            `${benefDetails?.first_name} ${benefDetails?.last_name}`
        )
        const subtitleMsg = `
${lang[selectedLanguage].USERNAME_LABEL}: ${benefAccount?.username}
${lang[selectedLanguage].COUNTRY_LABEL}: ${benefAccount?.country_name}
        `;

        chat.quotation.beneficiary = benefAccount?._id;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].CONTINUE, callback_data: "quotation_continue" }],
            [{ text: lang[selectedLanguage].VIEW_PROFILE_BUTTON, url: `https://my.insta-pay.ch/profile/${benefAccount?.username}` }],
            [{ text: lang[selectedLanguage].SELECT_DIFFERENT_USER, callback_data: "quotation" }],
            [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, subtitleMsg, buttons, "quotation_continue");

    }

    // User has typed information regarding user to search in quotation flow
    else if (chat.last_message === "quotation" && text && !payload) {
        const user = await Account.findOne({
            $or: [
                { username: { $regex: new RegExp(text, "i") } },
                { email: { $regex: new RegExp(text, "i") } },
                { phone: { $regex: new RegExp(text, "i") } },
                { insta_username: { $regex: new RegExp(text, "i") } }
            ]
        }).populate(["user", "company"]);

        if (user) {
            if (user._id.toString() === chat.account._id.toString()) {
                const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
                return await sendButtons(chatId, lang[selectedLanguage].SEND_MONEY_TO_SELF, buttons);
            }

            console.log(user);

            await sendPhoto(
                chatId,
                user?.profileImage?.url || "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/welcome-TG.png",
                `${user?.first_name} ${user?.last_name}`
            )
            const subtitleMsg = `
${lang[selectedLanguage].USERNAME_LABEL}: ${user?.username}
${lang[selectedLanguage].COUNTRY_LABEL}: ${user?.country_name}
    `;

            chat.quotation.beneficiary = user._id;
            await chat.save();

            const buttons = [
                [{ text: lang[selectedLanguage].CONTINUE, callback_data: "quotation_continue" }],
                [{ text: lang[selectedLanguage].VIEW_PROFILE_BUTTON, url: `https://my.insta-pay.ch/profile/${user?.username}` }],
                [{ text: lang[selectedLanguage].SELECT_DIFFERENT_USER, callback_data: "quotation_create" }],
                [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
            ];

            await sendButtons(chatId, subtitleMsg, buttons, "quotation_continue");

        } else {
            const message = lang[selectedLanguage].INVALID_USER;
            const buttons = [
                [{ text: lang[selectedLanguage].SELECT_ANOTHER, callback_data: "send_quotation" }],
                [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
            ];

            await sendButtons(chatId, message, buttons);
        }
    }

    else if (chat.last_message === "quotation_continue" && (payload === "quotation_continue")) {
        const wallets = await getUserActiveWallets(chat.account._id);
        const slicedWallets = wallets.slice(0, 5);

        let buttons = slicedWallets.map((wallet) => [
            {
                text: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`,
                callback_data: `quotation_send_wallet-${wallet._id}`,
            },
        ]);

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);

        await sendButtons(chatId, lang[selectedLanguage].RECEIVE_CURRENCY_PROMPT, buttons, "quotation_send_wallet");
    }

    // User has selected a wallet
    else if (payload && payload.startsWith("quotation_send_wallet-") && chat.last_message === "quotation_send_wallet") {
        const walletId = payload.split("-")[1];

        chat.quotation.currency = walletId;
        await chat.save();

        await sendMessage(chatId, lang[selectedLanguage].ENTER_QUOTE_AMOUNT, "quotation_amount");
    }
    // User has entered amount
    else if (chat.last_message === "quotation_amount" && text) {

        const { status, message: validationMessage, amount } = validateAmount(text, selectedLanguage);

        if (!status) {
            await sendMessage(chatId, validationMessage);
            return;
        }

        // Receiver's account balance check
        const receivingWallet = await getActiveWalletById(chat.quotation.currency);
        const receiverBalanceCheck = await balanceLimitCheck(amount, chat.account, receivingWallet);
        console.log({ receiverBalanceCheck });

        if (!receiverBalanceCheck?.status && receiverBalanceCheck?.remainingBalance) {
            let buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];

            if (chat.account.level.level_no === 1) {
                buttons.push([{ text: lang[selectedLanguage].IDENTITY_VERIFICATION, callback_data: "kyc_verification" }]);
                await sendButtons(
                    chatId,
                    lang[selectedLanguage].BALANCE_LIMIT.replace("{{amount}}", formattedAmount(receiverBalanceCheck?.remainingBalance)).replace("{{currency}}", receivingWallet?.currency.code), // Hassan 
                    // `Completing this transaction will exceed your balance limit. Your remaining balance is ${formattedAmount(receiverBalanceCheck?.remainingBalance)} ${receivingWallet?.currency.code}. Please enter an amount within your balance limit or complete KYC verification to increase your balance limit.`,
                    buttons
                );
            } else {
                await sendButtons(
                    chatId,
                    `Completing this transaction will exceed your balance limit. Your remaining balance is ${formattedAmount(receiverBalanceCheck?.remainingBalance)} ${receivingWallet?.currency.code}. Please enter an amount within your balance limit.`,
                    buttons
                );
            }
            return;
        } else if (!receiverBalanceCheck?.status) {
            let buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
            await sendButtons(chatId, lang[selectedLanguage].BALANCE_CHECK_ERROR, buttons);
            return;
        }

        chat.quotation.amount = amount;
        await chat.save();

        await sendMessage(chatId, lang[selectedLanguage].QUOTE_TITLE, "quotation_title");
    }

    // User has entered a title
    else if ((chat.last_message === "quotation_title" && text)) {
        chat.quotation.title = text;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].ADD_NOTE_BUTTON, callback_data: "quotation_note" }],
            [{ text: lang[selectedLanguage].ATTACH_DOCUMENT_BUTTON, callback_data: "quotation_document" }],
            [{ text: lang[selectedLanguage].SKIP, callback_data: "quotation_no_attch" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, buttons, "quotation_attch");
    }

    // attachments flow
    // ask user to enter a note for intl transfer
    else if (payload === "quotation_note" && chat?.last_message === "quotation_attch") {
        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "quotation_note");
    }
    // user has entered a note
    else if (chat?.last_message === "quotation_note" && text && !payload) {
        chat.quotation.desc = text;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].YES, callback_data: "quotation_add_attch" }],
            [{ text: lang[selectedLanguage].NO, callback_data: "quotation_no_attch" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, buttons, "quotation_note_added");
    }
    // user has also proceeded with adding an attachment
    else if (payload === "quotation_add_attch" && chat?.last_message === "quotation_note_added") {
        const buttons = [
            [{ text: lang[selectedLanguage].SKIP, callback_data: "quotation_no_attch" }],
            [{ text: lang[selectedLanguage].IMAGES_OPTIONS, callback_data: "quotation_attch_images" }],
            [{ text: lang[selectedLanguage].VIDEOS_OPTIONS, callback_data: "quotation_attch_videos" }],
            [{ text: lang[selectedLanguage].BOTH_OPTIONS, callback_data: "quotation_attch_both" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].ATTACH_MESSAGE, buttons, "quotation_attachments");
    }

    // user has not proceeded with adding an attachement
    else if (payload === "quotation_no_attch" || payload === "quotation_without_doc") {
        const buttons = [
            [{ text: lang[selectedLanguage].YES, callback_data: "quotation_bargain_yes" }],
            [{ text: lang[selectedLanguage].NO, callback_data: "quotation_bargain_no" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].BARGAIN_PROMPT, buttons);

    }

    // user has asked to upload the images
    else if (payload === "quotation_attch_images" && chat?.last_message === "quotation_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_IMAGES, buttons, "quotation_images");
    }

    // bot is expecting images when last message is "quotation_images"
    else if (chat?.last_message === "quotation_images" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, lang[selectedLanguage].IMG_LIMIT);
            return;
        }
        const uploadedImageUrls = await processImageUploads(image_payloads);

        for (const image of uploadedImageUrls) {
            chat.quotation.attachments.push({
                key: image.key,
                url: image.url,
                ETag: image.ETag
            })
        }

        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].YES, callback_data: "quotation_bargain_yes" }],
            [{ text: lang[selectedLanguage].NO, callback_data: "quotation_bargain_no" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].BARGAIN_PROMPT, buttons);
    }

    // user has been asked to upload the video
    else if (payload === "quotation_attch_videos" && chat?.last_message === "quotation_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_VIDEO, buttons, "quotation_video");
    }

    // bot is expecting a video when last message is "quotation_video"
    else if (chat?.last_message === "quotation_video" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, lang[selectedLanguage].VIDEO_LIMIT);
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.quotation.attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].YES, callback_data: "quotation_bargain_yes" }],
            [{ text: lang[selectedLanguage].NO, callback_data: "quotation_bargain_no" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].BARGAIN_PROMPT, buttons);

    }

    else if (payload === "quotation_attch_both" && chat?.last_message === "quotation_attachments") {
        const message = lang[selectedLanguage].MAX_FILES

        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "quotation_images_both");
    }

    // if the last message is set to quotation_images_both, the bot is expecting images
    else if (chat?.last_message === "quotation_images_both" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, lang[selectedLanguage].IMG_LIMIT);
            return;
        }
        const uploadedImageUrls = await processImageUploads(image_payloads);
        console.log({ uploadedImageUrls })

        for (const image of uploadedImageUrls) {
            chat.quotation.attachments.push({
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

        await sendButtons(chatId, message, buttons, "quotation_video_both");
    }

    // if the last message is set to quotation_video_both, the bot is expecting a video
    else if (chat?.last_message === "quotation_video_both" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, lang[selectedLanguage].VIDEO_LIMIT);
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.quotation.attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].YES, callback_data: "quotation_bargain_yes" }],
            [{ text: lang[selectedLanguage].NO, callback_data: "quotation_bargain_no" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].BARGAIN_PROMPT, buttons);

    }

    // second option
    else if (payload === "quotation_document" && chat?.last_message === "quotation_attch") {
        const buttons = [
            [{ text: lang[selectedLanguage].SKIP, callback_data: "quotation_no_attch" }],
            [{ text: lang[selectedLanguage].IMAGES_OPTIONS, callback_data: "quotation_attch_images_1" }],
            [{ text: lang[selectedLanguage].VIDEOS_OPTIONS, callback_data: "quotation_attch_videos_1" }],
            [{ text: lang[selectedLanguage].BOTH_OPTIONS, callback_data: "quotation_attch_both_1" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].ATTACH_MESSAGE, buttons, "quotation_attachments");
    }

    // user has asked to upload the images
    else if (payload === "quotation_attch_images_1" && chat?.last_message === "quotation_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_IMAGES, buttons, "quotation_attch_images_1");
    }

    // bot is expecting images when last message is "quotation_attch_images_1"
    else if (chat?.last_message === "quotation_attch_images_1" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, lang[selectedLanguage].IMG_LIMIT);
            return;
        }

        const uploadedImageUrls = await processImageUploads(image_payloads);

        for (const image of uploadedImageUrls) {
            chat.quotation.attachments.push({
                key: image.key,
                url: image.url,
                ETag: image.ETag
            })
        }

        await chat.save();

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "quotation_note_1");
    }

    // user has asked to upload the video
    else if (payload === "quotation_attch_videos_1" && chat?.last_message === "quotation_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_VIDEO, buttons, "quotation_attch_videos_1");
    }

    // bot is expecting a video when last message is "quotation_attch_videos_1"
    else if (chat?.last_message === "quotation_attch_videos_1" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, lang[selectedLanguage].VIDEO_LIMIT);
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.quotation.attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "quotation_note_1");
    }

    // when last message is "quotation_note_1" and user has entered a note
    else if (chat?.last_message === "quotation_note_1" && text && !payload) {
        chat.quotation.desc = text;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].YES, callback_data: "quotation_bargain_yes" }],
            [{ text: lang[selectedLanguage].NO, callback_data: "quotation_bargain_no" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].BARGAIN_PROMPT, buttons);

    }

    else if (payload === "quotation_attch_both_1" && chat?.last_message === "quotation_attachments") {
        const message = lang[selectedLanguage].MAX_FILES

        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "quotation_images_both_1");
    }

    // if the last message is set to quotation_images_both, the bot is expecting images
    else if (chat?.last_message === "quotation_images_both_1" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, lang[selectedLanguage].IMG_LIMIT);
            return;
        }
        const uploadedImageUrls = await processImageUploads(image_payloads);

        for (const image of uploadedImageUrls) {
            chat.quotation.attachments.push({
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

        await sendButtons(chatId, message, buttons, "quotation_video_both_1");
    }

    // if the last message is set to quotation_video_both, the bot is expecting a video
    else if (chat?.last_message === "quotation_video_both_1" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, lang[selectedLanguage].VIDEO_LIMIT);
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.quotation.attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "quotation_note_1");
    }

    else if (payload === "quotation_bargain_yes" || payload === "quotation_bargain_no") {
        chat.quotation.bargain = payload === "quotation_bargain_yes";
        await chat.save();

        const quotationWallet = await getActiveWalletById(chat.quotation.currency);
        const quotationReceiver = await Account.findById(chat.quotation.beneficiary).populate(['user', 'company']);

        const message = `
${lang[selectedLanguage].QUOTE_REQUEST_INITIATION
                .replace("{{amount}}", formattedAmount(chat?.quotation?.amount))
                .replace("{{currency}}", quotationWallet.currency.code)
                .replace("{{user}}", quotationReceiver?.username)
            } 
    
${lang[selectedLanguage].PROCEED} `;

        const buttons = [
            [{ text: lang[selectedLanguage].SEND_QUOTE, callback_data: "quotation_send_continue" }],
            [{ text: lang[selectedLanguage].EDIT_QUOTE, callback_data: "quotation_create" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "quotation_cancel" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "quotation_send_continue");
    }

    // User has cancelled the quotation
    else if (payload === "quotation_cancel") {
        const buttons = [
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].QUOTE_CANCELLED, buttons, "4");
    }

    else if (payload === "quotation_send_continue" && chat?.last_message === "quotation_send_continue") {
        await handleOTPGenerationTG(selectedLanguage, chat, "quotation_confirm-otp", "quotation_confirm-otp", "Transaction OTP");
    }

    else if (chat.last_message === "quotation_confirm-otp" && text) {
        const otpValidationResult = await validateOTPTG(chatId, text, "quotation_confirm-otp");

        if (otpValidationResult.status) {
            const quotation = chat.quotation;
            const data = {
                account_id: chat.account?._id,
                reciever_id: quotation?.beneficiary,
                title: quotation?.title,
                desc: quotation?.desc,
                amount: quotation?.amount,
                bargain: quotation?.bargain,
                sender_wallet_id: quotation?.currency,
                images: quotation?.attachments
            };
            console.log(data);

            await sendMessage(chatId, lang[selectedLanguage].CREATING_QUOTATION);

            const quotDetails = await addQuotation(data);
            if (quotDetails?.status) {
                const quotationDetails = quotDetails?.message;
                const quotationReceiver = await Account.findById(quotationDetails?.reciever).populate(['user', 'insta_recipient_id']);
                const walletDetails = await getActiveWalletById(quotationDetails?.amount_reciever_currency);

                const senderTimezone = chat.account?.timezone || "UTC";
                const senderCurrentTime = moment().tz(senderTimezone).format();
                const quotation = quotationDetails?.reference_id;
                const message = lang[selectedLanguage].QUOTE_SENT.replace("{{id}}", quotation);
                await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", message)
                const quotationInfo = `${lang[selectedLanguage].AMOUNT}: ${formattedAmount(quotationDetails?.amount?.toFixed(2))} ${walletDetails?.currency?.code}\n${lang[selectedLanguage].BENEFICIARY}: ${quotationReceiver?.user?.first_name} ${quotationReceiver?.user?.last_name}\nDate sent: ${formatDateToDDMMYYYY(senderCurrentTime)}\n${lang[selectedLanguage].TITLE}: ${quotationDetails?.title}`;

                await sendButtons(chatId, quotationInfo, [
                    [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
                ], "4");

                // telegram notification
                if (quotationReceiver?.telegram_id && quotationReceiver?.telegram_bot) {
                    const telegramBot = await TelegramBotModel.findOne({ recipient: quotationReceiver?.telegram_id });
                    const receiverLang = telegramBot?.selected_language || quotationReceiver?.language || "en";
                    const buttons = [
                        [{ text: lang[receiverLang].ACCEPT, callback_data: `quotation_accept-${quotationDetails?._id}` }],
                        [{ text: lang[receiverLang].DECLINE, callback_data: `quotation_decline-${quotationDetails?._id}` }]
                    ];

                    if (quotationDetails?.bargain) {
                        buttons.push([{ text: lang[selectedLanguage].NEGOTIATE, callback_data: `quotation_bargain-${quotationDetails?._id}` }]);
                    }

                    // await sendButtons(quotationReceiver?.telegram_id, `You've received a new quote from ${chat.account?.username}\n${lang[receiverLang].COUNTRY_LABEL}: ${getCountryNameByCode(chat.account?.user_nationaility)}\n${lang[receiverLang].AMOUNT}: ${formattedAmount(quotationDetails?.amount?.toFixed(2))} ${walletDetails?.currency?.code}`, buttons);
                    await sendButtons(quotationReceiver?.telegram_id,lang[selectedLanguage].NEW_QUOTE_RECEIVED.replace("{{username}}", chat.account?.username).replace("{{country}}", getCountryNameByCode(chat.account?.user_nationaility)).replace("{{amount}}", formattedAmount(quotationDetails?.amount?.toFixed(2))).replace("{{currency}}", walletDetails?.currency?.code), buttons);

                    await sendButtons(quotationReceiver?.telegram_id, lang[selectedLanguage].VIEW_QUOTE, [
                        [{ text: lang[selectedLanguage].VIEW_DETAILS, callback_data: `quotation_details-${quotationDetails._id}` }],
                        [{ text: lang[receiverLang].MAIN_MENU, callback_data: "main_menu" }]
                    ], "4");
                }
            } else {
                await sendButtons(chatId, lang[selectedLanguage].CREATE_QUOTATION_ERROR, [
                    [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
                ], "4");
            }
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {
                await invalidMessageTG(chatId, "quotation_confirm-otp", selectedLanguage, chat?.otpType);
            }
        }
    }

    // User has selected for bargain
    else if (payload?.startsWith("quotation_bargain-")) {
        const quotationId = payload.split('-')[1];

        const quotation = await Quotation.findById(quotationId).populate("amount_reciever_currency");

        if (quotation?.status === "accepted") {
            const message = lang[selectedLanguage].QUOTATION_ALREADY_ACCEPTED;
            const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
            await sendButtons(chatId, message, buttons);
        } else if (quotation?.status === "bargain" || quotation?.status === "revise") {
            const message = lang[selectedLanguage].BARGAIN_AMOUNT_ALREADY_ADDED;
            const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
            await sendButtons(chatId, message, buttons);
        } else {
            chat.quotation.accepting_quotation = quotationId;
            await chat.save();
            const counterOffer = quotation?.amount_reciever_currency?.currency?.code;

            const message = lang[selectedLanguage].COUNTER_OFFER.replace("{{currency}}", counterOffer);
            await sendMessage(chatId, message, "quotation_bargain_amount");
        }
    }

    // User has entered bargaining amount
    else if (chat.last_message === "quotation_bargain_amount" && text && !payload) {
        const { status, message: validationMessage, amount } = validateAmount(text, selectedLanguage);

        if (!status) {
            await sendMessage(chatId, validationMessage);
            return;
        }

        chat.quotation.bargain_amount = amount;
        await chat.save();

        await handleOTPGenerationTG(selectedLanguage, chatId, "quotation_bargain-otp", "quotation_bargain-otp", "Transaction OTP");
    }

    else if (chat.last_message === "quotation_bargain-otp" && text) {
        const otpValidationResult = await validateOTPTG(chatId, text, "quotation_bargain-otp");

        if (otpValidationResult.status) {
            const data = {
                revised_amount: chat.quotation.bargain_amount,
                quotation_id: chat.quotation.accepting_quotation
            };
            const quotationDetails = await bargain(data);

            if (quotationDetails?.status) {
                const quotation = quotationDetails?.quotation;
                console.log(quotation, "quotation");

                const quotationSender = await Account.findById(quotation?.sender);
                const currencyDetails = await Wallet.findById(quotation?.amount_reciever_currency);

                const quotationInfo = `
Quotation ID: ${quotation.reference_id}
${lang[selectedLanguage].BARGAINING_AMOUNT}: ${formattedAmount(quotation?.revised_amount)} ${currencyDetails?.currency.code}
${lang[selectedLanguage].TITLE}: ${quotation?.title}
${lang[selectedLanguage].STATUS}: Negotiation in Progress
    `;
                const currencyCode = currencyDetails?.currency.code; // New variable for currency code
                const userName = quotationSender?.username; // New variable for username

                // Accepting message
                const message = lang[selectedLanguage].COUNTER_OFFER_SUBMITTED.replace("{{currencycode}}", currencyCode).replace("{{username}}", userName).replace("{{quotationInfo}}", quotationInfo); //Hassan

                const buttons = [
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];
                await sendButtons(chatId, message, buttons);

                // Receiver message
                const chatAccountUsername = chat.account?.username; // New variable for chat account username
                const receiverMessage = lang[selectedLanguage].NEW_AMOUNT_PROPOSED.replace("{{username}}", chatAccountUsername).replace("{{quotationInfo}}", quotationInfo); //Hassan
                const receiverButtons = [
                    [{ text: lang[selectedLanguage].ACCEPT_NEW_AMOUNT, callback_data: `quotation_new_amount_accept-${quotation?._id}` }],
                    [{ text: lang[selectedLanguage].RE_NEGOTIATE, callback_data: `quotation_revise_quot-${quotation?._id}` }],
                    [{ text: lang[selectedLanguage].DECLINE, callback_data: `quotation_decline_sender-${quotation?._id}` }]
                ];
                await sendButtons(quotationSender?.telegram_id, receiverMessage, receiverButtons);
            } else {
                const errorButtons = [
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];
                await sendButtons(chatId, lang[selectedLanguage].BARGAINING_AMOUNT_FAILED, errorButtons);
            }
        }
        else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {
                await invalidMessageTG(chatId, "quotation_bargain-otp", selectedLanguage, chat?.otpType);
            }
        }
    }

    else if (payload && payload.startsWith("quotation_new_amount_accept-")) {
        const quotationId = payload.split("-")[1];

        const quotation = await Quotation.findById(quotationId).populate([
            { path: "reciever", populate: { path: "insta_recipient_id" } },
            { path: "sender" },
            { path: "amount_sender_currency" },
            { path: "amount_reciever_currency" }
        ]);

        if (!quotation) {
            return await sendMessage(chatId, lang[selectedLanguage].QUOTATION_NOT_FOUND);
        }

        if (quotation.status === "accepted") {
            const message = lang[selectedLanguage].QUOTATION_ALREADY_ACCEPTED;
            const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
            return await sendButtons(chatId, message, buttons);
        } else if (quotation.status === "declined") {
            const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
            return await sendButtons(chatId, lang[selectedLanguage].QUOTATION_ALREADY_DECLINED, buttons);
        } else if (quotation.status === "revise") {
            const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
            return await sendButtons(chatId, lang[selectedLanguage].REVISED_AMOUNT_ALREADY_ADDED, buttons);
        }

        quotation.status = "bargain-accepted";
        await quotation.save();

        const quotationInfo = `
    ${lang[selectedLanguage].QUOTATION_ID}: ${quotation.reference_id}
    ${lang[selectedLanguage].AMOUNT}: ${formattedAmount(quotation.revised_amount)} ${quotation.amount_reciever_currency.currency.code}
    ${lang[selectedLanguage].TITLE}: ${quotation.title}`;

        const message = `${lang[selectedLanguage].YOU_ACCEPTED_OFFER} ${formattedAmount(quotation.revised_amount)} ${quotation.amount_reciever_currency.currency.code}`;

        const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]];

        await sendButtons(chatId, message + "\n\n" + quotationInfo, buttons);

        // Notify recipient
        if (quotation.reciever?.telegram_id && quotation.reciever?.telegram_bot) {
            const telegramBot = await TelegramBotModel.findOne({ recipient: quotation.reciever?.telegram_id });
            const receiverLang = telegramBot?.selected_language || quotation.reciever?.language || "en";

            const receiverMessage = `${lang[receiverLang].YOUR_COUNTER_OFFER_ACCEPTED} ${formattedAmount(quotation.revised_amount)} ${quotation.amount_reciever_currency.currency.code}. ${lang[receiverLang].PLEASE_PROCEED}`;

            const receiverButtons = [
                [{ text: lang[receiverLang].ACCEPT, callback_data: `quotation_accept-${quotation._id}` }],
                [{ text: lang[receiverLang].DECLINE, callback_data: `quotation_decline-${quotation._id}` }],
                [{ text: lang[receiverLang].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
            ];

            await sendButtons(quotation.reciever?.telegram_id, receiverMessage + "\n\n" + quotationInfo, receiverButtons);
        }
    }

    else if (payload && payload.startsWith("quotation_revise_quot-")) {
        const quotationId = payload.split("-")[1];

        const quotation = await Quotation.findById(quotationId);

        if (quotation?.status === "accepted") {
            const message = lang[selectedLanguage].QUOTATION_ALREADY_ACCEPTED;
            const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];

            await sendButtons(chatId, message, buttons);
        } else if (quotation?.status === "revise") {
            const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];

            await sendButtons(chatId, lang[selectedLanguage].REVISED_AMOUNT_ALREADY_ADDED, buttons);
        } else {
            chat.quotation.accepting_quotation = quotationId;
            await chat.save();

            await sendMessage(chatId, lang[selectedLanguage].ENTER_REVISION_AMOUNT, "quotation_revise_quot_amount");
        }
    }
    // User has entered the revision amount
    else if (chat.last_message === "quotation_revise_quot_amount" && text) {
        const { status, message: validationMessage, amount } = validateAmount(text, selectedLanguage);

        if (!status) {
            await sendMessage(chatId, validationMessage);
            return;
        }

        chat.quotation.revised_amount = amount;
        await chat.save();

        await handleOTPGenerationTG(selectedLanguage, chatId, "quotation_revise_quot-otp", "quotation_revise_quot-otp", "Transaction OTP");
    }

    else if (chat.last_message === "quotation_revise_quot-otp" && text) {
        const otpValidationResult = await validateOTPTG(chatId, text, "quotation_revise_quot-otp");

        if (otpValidationResult.status) {
            const data = {
                revised_amount: chat.quotation.revised_amount,
                quotation_id: chat.quotation.accepting_quotation
            };
            const quotationDetails = await revise(data);

            if (quotationDetails?.status) {
                const quotation = quotationDetails.quotation;
                console.log(quotation, "quotation");

                const quotationReceiver = await Account.findById(quotation?.reciever);
                const currencyDetails = await Wallet.findById(quotation?.amount_reciever_currency);

                const quotationInfo = `
    Quotation ID: ${quotation.reference_id}
${lang[selectedLanguage].AMOUNT}: ${formattedAmount(quotation?.revised_amount)} ${currencyDetails?.currency.code}
${lang[selectedLanguage].TITLE}: ${quotation?.title}
${lang[selectedLanguage].STATUS}: ${quotation?.status}
                `;

                // Sending message to sender
                const message = `
${lang[selectedLanguage].YOU_HAVE_ADDED_REVISION_AMOUNT} ${quotationReceiver?.username}.
${quotationInfo}
                `;
                const buttons = [
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];
                await sendButtons(chat.user_id, message, buttons);

                if (quotationReceiver?.telegram_id && quotationReceiver?.telegram_bot) {
                    // Sending message to receiver
                    const receiverMessage = `${lang[selectedLanguage].REVISION_AMOUNT_ADDED} ${chat.username}.
${quotationInfo}`;
                    const receiverButtons = [
                        [{ text: lang[selectedLanguage].ACCEPT, callback_data: `quotation_accept-${quotation?._id}` }],
                        [{ text: lang[selectedLanguage].DECLINE, callback_data: `quotation_decline-${quotation?._id}` }]
                    ];
                    await sendButtons(quotationReceiver?.telegram_id, receiverMessage, receiverButtons);
                }
            } else {
                await sendButtons(chat.user_id, lang[selectedLanguage].REVISION_AMOUNT_FAILED, [
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ]);
            }
        }
        else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {
                await invalidMessageTG(chatId, "quotation_revise_quot-otp", selectedLanguage, chat?.otpType);
            }
        }
    }

    // quotation sender is declining the quotation
    else if (payload?.startsWith("quotation_decline_sender-")) {
        const quotationId = payload.split('-')[1];
        const quotation = await Quotation.findById(quotationId);

        if (quotation?.status === "accepted") {
            const message = lang[selectedLanguage].QUOTATION_ALREADY_ACCEPTED;
            const buttons = [
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
            await sendButtons(chatId, message, buttons);
        } else if (quotation?.status === "declined") {
            const message = lang[selectedLanguage].QUOTATION_ALREADY_DECLINED;
            const buttons = [
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
            await sendButtons(chatId, message, buttons);
        } else {
            const declinedQuotationDetails = await declineQuotation(quotationId);
            if (declinedQuotationDetails.status) {
                const quotationSender = await Account.findById(quotation?.sender);
                const quotationReceiver = await Account.findById(quotation?.reciever);
                const currencyDetails = await getActiveWalletById(quotation?.amount_reciever_currency)

                const quotationInfo = `
    Quotation ID: ${quotation?.reference_id}
${lang[selectedLanguage].AMOUNT}: ${formattedAmount(quotation?.revised_amount?.toFixed(2))} ${currencyDetails?.currency.code}
${lang[selectedLanguage].TITLE}: ${quotation?.title}
                `;
                const userName = quotationReceiver?.username; // New variable for username

                const message = lang[selectedLanguage].QUOTE_DECLINED.replace("{{username}}", userName); //Hassan
                const buttons = [
                    [{ text: lang[selectedLanguage].SEND_NEW_QUOTE, callback_data: "quotation" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
                ];

                await sendButtons(chatId, message + '\n' + quotationInfo, buttons, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png");

                // Notify receiver
                if (quotationReceiver?.telegram_id && quotationReceiver?.telegram_bot) {

                    const userName = quotationSender?.username; // New variable for username
                    const receiverMessage = lang[selectedLanguage].QUOTE_SENT_DECLINED.replace("{{username}}", userName) //Hassan
                    const receiverButtons = [
                        [{ text: lang[selectedLanguage].QUOTE_DETAILS, callback_data: `quotation_details-${quotationId}` }],
                        [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
                    ];

                    await sendButtons(quotationReceiver?.telegram_id, receiverMessage + '\n' + quotationInfo, receiverButtons, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png");
                }
            } else {
                const message = lang[selectedLanguage].DECLINING_QUOTATION_FAILED;
                const buttons = [
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];
                await sendButtons(chatId, message, buttons);
            }
        }
    }

    else if (payload?.startsWith("quotation_decline-")) {

        const quotationId = payload.split("-")[1];
        const quotation = await Quotation.findById(quotationId);

        if (quotation?.status === "accepted") {
            await sendButtons(chatId, lang[selectedLanguage].QUOTATION_ALREADY_ACCEPTED, [
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ]);
        } else if (quotation?.status === "declined") {
            await sendButtons(chatId, lang[selectedLanguage].QUOTATION_ALREADY_DECLINED, [
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ]);
        } else {
            const declinedQuotationDetails = await declineQuotation(quotationId);
            if (declinedQuotationDetails.status) {
                const quotationDetails = await Quotation.findById(quotationId);
                const quotationSender = await Account.findById(quotationDetails?.sender);
                const currencyDetails = await Wallet.findById(quotationDetails?.amount_reciever_currency);
                const quotationInfo = `\nQuotation ID: ${quotationDetails.reference_id}\n${lang[selectedLanguage].AMOUNT}: ${quotationDetails?.revised_amount ? formattedAmount(quotationDetails?.revised_amount?.toFixed(2)) : formattedAmount(quotationDetails?.amount?.toFixed(2))} ${currencyDetails?.currency.code}\n${lang[selectedLanguage].TITLE}: ${quotationDetails?.title}\n`;
                const userName = quotationSender?.username; // New variable for username

                // User who declined the quotation
                await sendButtons(chatId, lang[selectedLanguage].QUOTE_DECLINED_SENDER.replace("{{username}}",userName).replace("{{quotationInfo}}", quotationInfo), [ //Hassan
                    [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
                ], "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png");

                // Sender notification
                if (quotationSender?.telegram_id && quotationSender?.telegram_bot) {
                    const userName = chat.account?.username; // New variable for username
                    const message1 = lang[selectedLanguage].QUOTE_DECLINED_HEADS_UP.replace("{{username}}", userName); //Hassan
                    await sendButtons(quotationSender.telegram_id, `${message1}\n${quotationInfo}`, [
                        [{ text: lang[selectedLanguage].SEND_NEW_QUOTE, callback_data: "quotation" }],
                        [{ text: lang[selectedLanguage].QUOTE_DETAILS, callback_data: `quotation_details-${quotationId}` }],
                        [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
                    ], "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png");
                }
            } else {
                await sendButtons(chatId, lang[selectedLanguage].DECLINING_QUOTATION_FAILED, [
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ]);
            }
        }
    }
}

module.exports = { quotation };