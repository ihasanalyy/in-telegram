const { sendButtons, somethingWentWrongQuickReplyTelegram, sendMessage, userKYCVerificationTemplateTelegram, showBeneficiaries, processImageUploads, processVideoUploads, sendPhoto } = require("../../telegramBotUtils");
const lang = require("../../../utils/languages/languages.json");
const { getUserActiveWallets } = require("../../helpers");
const { checkTransactionLimitsForSender, getExchangeRatesToUSD } = require("../../conversion");
const { getIntlFXHelper, createQuotationNewHelper } = require("../../../controllers/Thune.controller");
const { validateAmount } = require("../../instaChatbotUtils");
const { getPayerNames, createTransaction, confirmTransaction, formattedAmount } = require("../../InstaChatbotHelpers");
const BeneficiaryModel = require("../../../models/Beneficiary.model");
const User = require("../../../models/User.model");
const { handleOTPGenerationTG, validateOTPTG } = require("../telegramOTPHandler");
const Wallet = require("../../../models/Wallet.model");
const currencyToEmoji = require('../../../utils/currencyEmojis.json');


const secretKey = process.env.jwtKey;

async function intlTransferWallet(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    if (payload === "intl_transfer_w2w") {
        const wallets = await getUserActiveWallets(chat.account._id)
        const limitedWallets = wallets.slice(0, 8)

        const buttons = [
            ...limitedWallets.map(wallet => [
                {
                    text: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`,
                    callback_data: `intl_transfer_w2w_w-${wallet._id}`
                }
            ]),
            [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].SELECT_CURRENCY_BALANCE_MESSAGE, buttons);
    }

    // User has selected a currency for international payment
    else if (payload?.startsWith("intl_transfer_w2w_w-")) {
        const walletID = payload.split('-')[1];
        const walletDetails = await Wallet.findById(walletID);

        // wallet account validation
        if (walletDetails.account.toString() !== chat.account._id.toString()) {
            return await sendButtons(chatId, lang[selectedLanguage].WALLET_ERROR, [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]]);
        }

        chat.international_transfer.intl_sending_currency = walletID;
        await chat.save();

        console.log(walletDetails);

        const message = lang[selectedLanguage].TRANSFER_MESSAGE
            .replace('{{formattedAmount}}', formattedAmount(walletDetails?.balance?.available))
            .replace('{{currencyCode}}', walletDetails.currency.code);

        const buttons = [
            [{ text: lang[selectedLanguage].ANOTHER_WALLET_TITLE, callback_data: "intl_transfer_w2w" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "intl_transfer_w2w_amount");
    }

    // user has asked to adjusted the amount
    else if (payload === "intl_transfer_w2w_adjust_amount") {
        const walletDetails = await Wallet.findById(chat.international_transfer.intl_sending_currency);

        const message = lang[selectedLanguage].TRANSFER_MESSAGE
            .replace('{{formattedAmount}}', formattedAmount(walletDetails?.balance?.available))
            .replace('{{currencyCode}}', walletDetails.currency.code);

        const buttons = [
            [{ text: lang[selectedLanguage].ANOTHER_WALLET_TITLE, callback_data: "intl_transfer_w2w" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "intl_transfer_w2w_amount");
    }

    // User has entered amount for international payment
    else if (chat?.last_message === "intl_transfer_w2w_amount" && text) {
        const { status, message: validationMessage, amount } = validateAmount(text, selectedLanguage);

        const walletDetails = await Wallet.findById(chat.international_transfer.intl_sending_currency).populate([
            { path: 'account', populate: [{ path: 'level' }] }
        ]);

        if (!status) {
            await sendMessage(chatId, validationMessage);
            return;
        }

        let channel_name, service_name;
        if (chat.international_transfer.intl_payout_method === "1") {
            channel_name = "mobile_money";
            service_name = "international_mobile_wallet";
        } else {
            channel_name = "bank_account";
            service_name = "international_bank_transfer";
        }

        const ratesData = {
            transaction_type: "C2C",
            wallet_id: chat.international_transfer.intl_sending_currency.toString(),
            amount: amount,
            service_id: chat.international_transfer.intl_payout_method,
            channel_name,
            service_name,
            payerId: chat.international_transfer.intl_payer_id,
            iso_code: chat.international_transfer.intl_country_code,
            currency_code: walletDetails.currency.code,
            payment_method: "wallet",
            chatbot: true
        };

        const exchangedRates = await getIntlFXHelper(ratesData);

        if (exchangedRates?.success) {
            const rates = exchangedRates?.data?.result;

            let exchangedAmountSender = await getExchangeRatesToUSD(walletDetails.currency.code, 'USD', rates?.total?.value);
            const senderLimitsCheck = await checkTransactionLimitsForSender(exchangedAmountSender, walletDetails, 'sending');

            if (!senderLimitsCheck.status) {
                await sendMessage(chatId, senderLimitsCheck.message);
                return;
            }

            await sendMessage(chatId, lang[selectedLanguage].SENDING_AMOUNT
                .replace("{{amount}}", formattedAmount(amount))
                .replace("{{currency}}", rates?.total?.currency ?? "N/A")
            );

            let message;
            if (rates?.total?.currency !== rates?.recipient?.currency) {
                message = `${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${rates?.total?.currency ?? "N/A"} = ${rates?.exchanged_rate?.value ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}\n
${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}\n
${lang[selectedLanguage].RECIPIENT_RECEIVES}: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}\n
${lang[selectedLanguage].TOTAL_MESSAGE}: ${formattedAmount(rates?.total?.value) ?? "N/A"} ${rates?.total?.currency ?? "N/A"}`;
            } else {
                message = `${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}\n
${lang[selectedLanguage].RECIPIENT_RECEIVES}: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}\n
${lang[selectedLanguage].TOTAL_MESSAGE}: ${formattedAmount(rates?.total?.value) ?? "N/A"} ${rates?.total?.currency ?? "N/A"}`;
            }

            if (rates?.total?.value > walletDetails?.balance?.available) {
                await sendMessage(chatId, lang[selectedLanguage].INSUFFICIENT_BALANCE);
                message += `\n\n${lang[selectedLanguage].WALLET_BALANCE}: ${formattedAmount(walletDetails?.balance?.available ?? 0)} ${walletDetails?.currency?.code ?? "N/A"}`;
            }

            const buttons = [
                [{ text: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, callback_data: "intl_transfer_w2w_adjust_amount" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
            let lastMessage;
            if (rates?.total?.value > walletDetails?.balance?.available) {
                lastMessage = "";
                buttons.unshift([{ text: lang[selectedLanguage].ADD_FUNDS, callback_data: "add_funds" }])
            } else {
                lastMessage = "intl_transfer_w2w_proceed_transfer";
                buttons.unshift([{ text: lang[selectedLanguage].PROCEED_TO_TRANSFER, callback_data: "intl_transfer_w2w_proceed_transfer" }])
            }

            await sendButtons(chatId, message, buttons, lastMessage);

            chat.international_transfer.intl_amount = amount;
            chat.international_transfer.intl_exchngrate_token = exchangedRates?.data?.token;
            await chat.save();
        } else {
            let message, lastMessage;
            if (exchangedRates?.message?.includes("payer is currently unavailable")) {
                const payerList = await getPayerNames(chat.international_transfer.intl_payout_method, chat.international_transfer.intl_country_code);
                const payerChannel = payerList?.servicesWithIds?.find(item => item.id.toString() === chat.international_transfer.intl_payer_id);
                message = lang[selectedLanguage].UNABLE_TO_SEND.replace("{{payerName}}", payerChannel?.name);
                lastMessage = "4"
            } else if (exchangedRates?.message?.includes("minimum")) {
                message = lang[selectedLanguage].BELOW_MINIMUM_LIMIT.replace("{{minAmount}}", exchangedRates?.value).replace("{{currency}}", exchangedRates?.currency);
            } else if (exchangedRates?.message?.includes("maximum")) {
                message = lang[selectedLanguage].EXCEEDS_MAXIMUM_LIMIT.replace("{{maxAmount}}", exchangedRates?.value).replace("{{currency}}", exchangedRates?.currency);
            } else {
                message = lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR;
                lastMessage = "4"
            }

            const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];

            if (lastMessage) {
                await sendButtons(chatId, message, buttons, "4");
            } else {
                await sendButtons(chatId, message, buttons);
            }
        }
    }

    else if (payload === "intl_transfer_w2w_proceed_transfer" && chat.last_message === "intl_transfer_w2w_proceed_transfer") {
        if (chat?.account?.level?.level_no === 1) {
            await userKYCVerificationTemplateTelegram(chatId, selectedLanguage);
        } else {
            const buttons = [
                [{ text: lang[selectedLanguage].PERSONAL_SUPPORT, callback_data: "intl_transfer_w2w_purpose-FAMILY_SUPPORT" }],
                [{ text: lang[selectedLanguage].EDUCATION, callback_data: "intl_transfer_w2w_purpose-EDUCATION" }],
                [{ text: lang[selectedLanguage].MEDICAL_TREATMENTS, callback_data: "intl_transfer_w2w_purpose-MEDICAL_TREATMENT" }],
                [{ text: lang[selectedLanguage].OPERATIONAL_COSTS, callback_data: "intl_transfer_w2w_purpose-SERVICE_CHARGES" }],
                [{ text: lang[selectedLanguage].CHARITY_DONATIONS, callback_data: "intl_transfer_w2w_purpose-GIFT_AND_DONATION" }],
                [{ text: lang[selectedLanguage].OTHER_REASONS, callback_data: "intl_transfer_w2w_purpose-OTHER" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];

            await sendButtons(
                chatId,
                `${lang[selectedLanguage].TRANSFER_REASON_MESSAGE} ${lang[selectedLanguage].SELECT_PURPOSE} 👇`,
                buttons,
                "intl_transfer_w2w_purpose"
            );
        }
    }

    // user has selected a purpose
    else if (payload?.includes("intl_transfer_w2w_purpose-") && chat?.last_message === "intl_transfer_w2w_purpose") {
        const purpose = payload.split("-")[1];
        chat.international_transfer.purpose = purpose;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].ADD_NOTE_BUTTON, callback_data: "intl_transfer_w2w_note" }],
            [{ text: lang[selectedLanguage].ATTACH_DOCUMENT_BUTTON, callback_data: "intl_transfer_w2w_doc" }],
            [{ text: lang[selectedLanguage].SKIP, callback_data: "intl_transfer_w2w_without_doc" }],
        ];

        await sendButtons(chatId, `${lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE}`, buttons, "intl_transfer_w2w_attch");
    }

    // ask user to enter a note for intl transfer
    else if (payload === "intl_transfer_w2w_note" && chat?.last_message === "intl_transfer_w2w_attch") {
        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "intl_transfer_w2w_note");
    }
    // user has entered a note
    else if (chat?.last_message === "intl_transfer_w2w_note" && text && !payload) {
        chat.international_transfer.intl_note = text;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].YES, callback_data: "intl_transfer_w2w_add_attch" }],
            [{ text: lang[selectedLanguage].NO, callback_data: "intl_transfer_w2w_no_attch" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, buttons, "intl_transfer_w2w_note_added");
    }
    // user has also proceeded with adding an attachment
    else if (payload === "intl_transfer_w2w_add_attch" && chat?.last_message === "intl_transfer_w2w_note_added") {
        const buttons = [
            [{ text: lang[selectedLanguage].SKIP, callback_data: "intl_transfer_w2w_no_attch" }],
            [{ text: lang[selectedLanguage].IMAGES_OPTIONS, callback_data: "intl_transfer_w2w_attch_images" }],
            [{ text: lang[selectedLanguage].VIDEOS_OPTIONS, callback_data: "intl_transfer_w2w_attch_videos" }],
            [{ text: lang[selectedLanguage].BOTH_OPTIONS, callback_data: "intl_transfer_w2w_attch_both" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].ATTACH_MESSAGE, buttons, "intl_transfer_w2w_attachments");
    }

    // user has not proceeded with adding an attachement
    else if (payload === "intl_transfer_w2w_no_attch" || payload === "intl_transfer_w2w_without_doc") {
        await showBeneficiaries(chat, chat.international_transfer.intl_country_code, "intl_transfer_w2w", selectedLanguage);
    }

    // user has asked to upload the images
    else if (payload === "intl_transfer_w2w_attch_images" && chat?.last_message === "intl_transfer_w2w_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_IMAGES, buttons, "intl_transfer_w2w_images");
    }

    // bot is expecting images when last message is "intl_transfer_w2w_images"
    else if (chat?.last_message === "intl_transfer_w2w_images" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, lang[selectedLanguage].IMG_LIMIT);
            return;
        }
        const uploadedImageUrls = await processImageUploads(image_payloads);

        for (const image of uploadedImageUrls) {
            chat.international_transfer.intl_attachments.push({
                key: image.key,
                url: image.url,
                ETag: image.ETag
            })
        }

        await chat.save();

        await showBeneficiaries(chat, chat.international_transfer.intl_country_code, "intl_transfer_w2w", selectedLanguage);

    }

    // user has been asked to upload the video
    else if (payload === "intl_transfer_w2w_attch_videos" && chat?.last_message === "intl_transfer_w2w_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_VIDEO, buttons, "intl_transfer_w2w_video");
    }

    // bot is expecting a video when last message is "intl_transfer_w2w_video"
    else if (chat?.last_message === "intl_transfer_w2w_video" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, lang[selectedLanguage].VIDEO_LIMIT);
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.international_transfer.intl_attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        await showBeneficiaries(chat, chat.international_transfer.intl_country_code, "intl_transfer_w2w", selectedLanguage);
    }

    else if (payload === "intl_transfer_w2w_attch_both" && chat?.last_message === "intl_transfer_w2w_attachments") {
        const message = lang[selectedLanguage].MAX_FILES

        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "intl_transfer_w2w_images_both");
    }

    // if the last message is set to intl_transfer_w2w_images_both, the bot is expecting images
    else if (chat?.last_message === "intl_transfer_w2w_images_both" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, lang[selectedLanguage].IMG_LIMIT);
            return;
        }
        const uploadedImageUrls = await processImageUploads(image_payloads);
        console.log({ uploadedImageUrls })

        for (const image of uploadedImageUrls) {
            chat.international_transfer.intl_attachments.push({
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

        await sendButtons(chatId, message, buttons, "intl_transfer_w2w_video_both");
    }

    // if the last message is set to intl_transfer_w2w_video_both, the bot is expecting a video
    else if (chat?.last_message === "intl_transfer_w2w_video_both" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, lang[selectedLanguage].VIDEO_LIMIT);
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.international_transfer.intl_attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        await showBeneficiaries(chat, chat.international_transfer.intl_country_code, "intl_transfer_w2w", selectedLanguage);
    }

    // second option
    else if (payload === "intl_transfer_w2w_doc" && chat?.last_message === "intl_transfer_w2w_attch") {
        const buttons = [
            [{ text: lang[selectedLanguage].SKIP, callback_data: "intl_transfer_w2w_no_attch" }],
            [{ text: lang[selectedLanguage].IMAGES_OPTIONS, callback_data: "intl_transfer_w2w_attch_images_1" }],
            [{ text: lang[selectedLanguage].VIDEOS_OPTIONS, callback_data: "intl_transfer_w2w_attch_videos_1" }],
            [{ text: lang[selectedLanguage].BOTH_OPTIONS, callback_data: "intl_transfer_w2w_attch_both_1" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].ATTACH_MESSAGE, buttons, "intl_transfer_w2w_attachments");
    }

    // user has asked to upload the images
    else if (payload === "intl_transfer_w2w_attch_images_1" && chat?.last_message === "intl_transfer_w2w_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_IMAGES, buttons, "intl_transfer_w2w_attch_images_1");
    }

    // bot is expecting images when last message is "intl_transfer_w2w_attch_images_1"
    else if (chat?.last_message === "intl_transfer_w2w_attch_images_1" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, lang[selectedLanguage].IMG_LIMIT);
            return;
        }

        const uploadedImageUrls = await processImageUploads(image_payloads);

        for (const image of uploadedImageUrls) {
            chat.international_transfer.intl_attachments.push({
                key: image.key,
                url: image.url,
                ETag: image.ETag
            })
        }

        await chat.save();

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "intl_transfer_w2w_note_1");
    }

    // user has asked to upload the video
    else if (payload === "intl_transfer_w2w_attch_videos_1" && chat?.last_message === "intl_transfer_w2w_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_VIDEO, buttons, "intl_transfer_w2w_attch_videos_1");
    }

    // bot is expecting a video when last message is "intl_transfer_w2w_attch_videos_1"
    else if (chat?.last_message === "intl_transfer_w2w_attch_videos_1" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, lang[selectedLanguage].VIDEO_LIMIT);
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.international_transfer.intl_attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "intl_transfer_w2w_note_1");
    }

    // when last message is "intl_transfer_w2w_note_1" and user has entered a note
    else if (chat?.last_message === "intl_transfer_w2w_note_1" && text && !payload) {
        chat.international_transfer.intl_note = text;
        await chat.save();

        await showBeneficiaries(chat, chat.international_transfer.intl_country_code, "intl_transfer_w2w", selectedLanguage);
    }

    else if (payload === "intl_transfer_w2w_attch_both_1" && chat?.last_message === "intl_transfer_w2w_attachments") {
        const message = lang[selectedLanguage].MAX_FILES

        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "intl_transfer_w2w_images_both_1");
    }

    // if the last message is set to intl_transfer_w2w_images_both, the bot is expecting images
    else if (chat?.last_message === "intl_transfer_w2w_images_both_1" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, lang[selectedLanguage].IMG_LIMIT);
            return;
        }
        const uploadedImageUrls = await processImageUploads(image_payloads);

        for (const image of uploadedImageUrls) {
            chat.international_transfer.intl_attachments.push({
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

        await sendButtons(chatId, message, buttons, "intl_transfer_w2w_video_both_1");
    }

    // if the last message is set to intl_transfer_w2w_video_both, the bot is expecting a video
    else if (chat?.last_message === "intl_transfer_w2w_video_both_1" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, lang[selectedLanguage].VIDEO_LIMIT);
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.international_transfer.intl_attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "intl_transfer_w2w_note_1");
    }

    // user has started beneficiary selection process
    else if (payload?.includes("intl_transfer_w2w_next_beneficiaries")) {
        const currentPage = parseInt(payload.split("_")[5]);
        const beneficiaries = chat.international_transfer.intl_beneficiaries;
        const numberOfBeneficiariesPerPage = 8;
        const startIndex = (currentPage - 1) * numberOfBeneficiariesPerPage;
        const endIndex = startIndex + numberOfBeneficiariesPerPage;

        const beneficiariesToDisplay = beneficiaries.slice(startIndex, endIndex);

        const beneficiaryList = beneficiariesToDisplay.map((beneficiary) => ({
            text: `${beneficiary?.first_name} ${beneficiary?.last_name}`,
            callback_data: `intl_transfer_w2w_sb_${beneficiary._id}`
        }));

        const message = lang[selectedLanguage].SELECT_BENEFICIARY;

        const buttons = [
            ...beneficiaryList.map((beneficiary) => [{ text: beneficiary.text, callback_data: beneficiary.callback_data }]),
            [{ text: lang[selectedLanguage].ADD_BENEFICIARY, callback_data: "add_beneficiary" }]
        ];

        if (currentPage === 2) {
            buttons.push([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: "intl_transfer_w2w_no_attch" }]);
            buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);
        } else {
            buttons.push([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: `intl_transfer_w2w_prev_beneficiaries_${currentPage}` }]);
            buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);
        }

        if (beneficiaries.length > endIndex) {
            buttons.unshift([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `intl_transfer_w2w_next_beneficiaries_${currentPage + 1}` }]);
        }

        await sendButtons(chatId, message, buttons);
    }
    else if (payload?.includes("intl_transfer_w2w_prev_beneficiaries")) {
        const currentPage = parseInt(payload.split("_")[5]);
        const beneficiaries = chat.international_transfer.intl_beneficiaries;
        const numberOfBeneficiariesPerPage = 8;
        const startIndex = (currentPage - 1) * numberOfBeneficiariesPerPage;
        const endIndex = startIndex + numberOfBeneficiariesPerPage;

        const beneficiariesToDisplay = beneficiaries.slice(startIndex, endIndex);

        const beneficiaryList = beneficiariesToDisplay.map((beneficiary) => ({
            text: `${beneficiary?.first_name} ${beneficiary?.last_name}`,
            callback_data: `intl_transfer_w2w_sb_${beneficiary._id}`
        }));

        const message = lang[selectedLanguage].SELECT_BENEFICIARY;

        const buttons = [
            ...beneficiaryList.map((beneficiary) => [{ text: beneficiary.text, callback_data: beneficiary.callback_data }]),
            [{ text: lang[selectedLanguage].ADD_BENEFICIARY, callback_data: "add_beneficiary" }]
        ];

        if (currentPage > 1) {
            buttons.unshift([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: `intl_transfer_w2w_prev_beneficiaries_${currentPage - 1}` }]);
        }

        if (beneficiaries.length > endIndex) {
            buttons.unshift([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `intl_transfer_w2w_next_beneficiaries_${currentPage + 1}` }]);
        }

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);

        await sendButtons(chatId, message, buttons);
    }

    // User selects a beneficiary
    else if (payload?.includes("intl_transfer_w2w_sb_")) {
        const beneficiaryId = payload?.split("_")[4];
        console.log(beneficiaryId, "beneficiaryId");

        const beneficiary = await BeneficiaryModel.findById(beneficiaryId);
        const benefName = `${beneficiary?.first_name} ${beneficiary?.last_name}`;
        chat.international_transfer.intl_benef_id = beneficiary?._id;
        await chat.save();

        const walletDetails = await Wallet.findById(chat.international_transfer.intl_sending_currency)

        const quotationData = {
            payerId: chat.international_transfer.intl_payer_id,
            wallet_id: walletDetails?._id.toString(),
            transaction_type: beneficiary?.beneficiary_type === "individual" ? "C2C" : "B2C",
            token: chat.international_transfer.intl_exchngrate_token,
            payment_method: "wallet"
        };

        console.log("quotationData inside condition", quotationData);

        const quotationDetails = await createQuotationNewHelper(quotationData);

        console.log(quotationDetails, "quotationDetails");

        if (quotationDetails?.status) {
            chat.international_transfer.intl_exchngrate_token = quotationDetails?.token;
            chat.international_transfer.intl_quotation_id = quotationDetails?.QuotationID;
            await chat.save();

            const message = `
                ${lang[selectedLanguage].CONFIRM_SEND_MESSAGE} ${formattedAmount(chat.international_transfer.intl_amount)} ${walletDetails?.currency.code} ${lang[selectedLanguage].TO} ${benefName}?
            `;

            const buttons = [
                [{ text: lang[selectedLanguage].YES_CONTINUE_TITLE, callback_data: "intl_transfer_w2w_confirm_beneficiary" }],
                [{ text: lang[selectedLanguage].CHANGE_BENEFICIARY, callback_data: "intl_transfer_w2w_no_attch" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
            await sendButtons(chatId, message, buttons);
        } else if (quotationDetails?.message === "Differences in exchange rates") {
            const message = lang[selectedLanguage].EXCHANGE_ERROR;
            const buttons = [
                [{ text: lang[selectedLanguage].SEND_ANOTHER, callback_data: "intl_transfer" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
            await sendButtons(chatId, message, buttons);
        } else {
            const message = lang[selectedLanguage].PAYMENT_ISSUE_MESSAGE;
            const buttons = [
                [{ text: lang[selectedLanguage].SEND_ANOTHER, callback_data: "intl_transfer" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
            await sendButtons(chatId, message, buttons, "4");
        }
    }

    // User has confirmed beneficiary
    else if (payload === "intl_transfer_w2w_confirm_beneficiary") {
        const user = await User.findOne({ account: chat.account._id });
        const beneficiary = await BeneficiaryModel.findById(chat?.international_transfer.intl_benef_id);

        const walletDetails = await Wallet.findById(chat.international_transfer.intl_sending_currency)

        const transactionData = {
            wallet_id: walletDetails?._id?.toString(),
            additional_information: chat.international_transfer.intl_note || "Others",
            purpose_of_remittance: chat.international_transfer.purpose,
            user_id: user._id,
            beneficiary_id: chat.international_transfer.intl_benef_id,
            service: {
                id: parseInt(chat.international_transfer?.intl_payout_method)
            },
            bank_id: beneficiary?.bank_details[0]?._id ?? "",
            mobile_wallet_id: beneficiary?.mobile_wallet[0]?._id ?? "",
            transaction_type: beneficiary?.beneficiary_type === "individual" ? "C2C" : "B2C",
            token: chat.international_transfer.intl_exchngrate_token,
            Quotation_ID: chat.international_transfer.intl_quotation_id
        };

        console.log(transactionData, "transactionDatainsidecreatetransa");

        const createTransactionDetails = await createTransaction(transactionData);
        if (createTransactionDetails?.status) {
            let channel_name, service_name;
            switch (chat.international_transfer.intl_payout_method) {
                case "1":
                    channel_name = "mobile_money";
                    service_name = "international_mobile_wallet";
                    break;
                case "2":
                    channel_name = "bank_account";
                    service_name = "international_bank_transfer";
                    break;
                case "3":
                    channel_name = "cash_pickup";
                    service_name = "international_cash_pickup";
                    break;
                default:
                    channel_name = "card_payment";
                    service_name = "international_card_payment";
            }

            const ratesData = {
                transaction_type: "C2C",
                wallet_id: walletDetails?._id?.toString(),
                amount: chat.international_transfer.intl_amount,
                service_id: chat.international_transfer.intl_payout_method,
                channel_name,
                service_name,
                payerId: chat.international_transfer.intl_payer_id,
                iso_code: chat.international_transfer.intl_country_code,
                currency_code: walletDetails.currency.code,
                payment_method: "wallet",
                chatbot: true
            };

            const exchangedRates = await getIntlFXHelper(ratesData);
            const rates = exchangedRates?.data?.result;

            console.log(exchangedRates, "exchangedRates");
            if (!exchangedRates?.success) {
                const errorMessage = Array.isArray(exchangedRates?.message)
                    ? exchangedRates?.message?.find(msg =>
                        msg?.message?.toLowerCase().includes('payer is currently unavailable')
                    )
                    : null;

                let message;
                if (errorMessage) {
                    const payerList = await getPayerNames(chat.international_transfer.intl_payout_method, chat.international_transfer.intl_country_code);
                    const payerChannel = payerList?.servicesWithIds?.filter(item => {
                        return item.id.toString() === chat.international_transfer.intl_payer_id;
                    });

                    message = lang[selectedLanguage].UNABLE_TO_SEND.replace(
                        "{{payerName}}",
                        payerChannel[0]?.name || "N/A"
                    );
                } else if (exchangedRates?.message?.includes("minimum")) {
                    message = lang[selectedLanguage].BELOW_MINIMUM_LIMIT.replace(
                        "{{minAmount}}",
                        exchangedRates?.value
                    ).replace("{{currency}}", exchangedRates?.currency);
                } else if (exchangedRates?.message?.includes("maximum")) {
                    message = lang[selectedLanguage].EXCEEDS_MAXIMUM_LIMIT.replace(
                        "{{maxAmount}}",
                        exchangedRates?.value
                    ).replace("{{currency}}", exchangedRates?.currency);
                } else {
                    message = lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR;
                }

                const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
                return await sendButtons(chatId, message, buttons);
            }

            const payerList = await getPayerNames(chat.international_transfer.intl_payout_method, chat.international_transfer.intl_country_code);
            const payerChannel = payerList?.servicesWithIds?.filter(item => {
                return item.id.toString() === chat.international_transfer.intl_payer_id;
            });

            const message = `
${lang[selectedLanguage].REVIEW_TRANSACTION_DETAILS}

${lang[selectedLanguage].COUNTRY}: ${chat.international_transfer?.intl_country}
${lang[selectedLanguage].PAYMENT_METHOD}: ${chat.international_transfer?.intl_payout_method === "1"
                    ? lang[selectedLanguage].MOBILE_WALLET
                    : lang[selectedLanguage].BANK_ACCOUNT
                }
Payment Channel: ${payerChannel[0]?.name || "N/A"}
${lang[selectedLanguage].BENEFICIARY}: ${beneficiary?.first_name} ${beneficiary?.last_name}

${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(rates.sending.value)} ${rates.total.currency}
${rates.total.currency !== rates.exchanged_rate.currency
                    ? `${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${rates.total.currency} = ${formattedAmount(rates.exchanged_rate.value, 6)} ${rates.exchanged_rate.currency}\n`
                    : ''
                }${lang[selectedLanguage].FEE}: ${formattedAmount(rates.fee.value)} ${rates.total.currency}

${lang[selectedLanguage].BENEFICIARY_GETS}: ${formattedAmount(rates.recipient.value)} ${rates.exchanged_rate.currency}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(rates.total.value)} ${rates.total.currency}
`;

            const buttons = [
                [{ text: lang[selectedLanguage].CONFIRM_TRANSACTION, callback_data: "intl_transfer_w2w_confirm_transaction" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
            await sendButtons(chatId, message, buttons);
            chat.international_transfer.intl_exchngrate_token = createTransactionDetails?.token;
            await chat.save();
        } else {
            const message = lang[selectedLanguage].PAYMENT_ISSUE_MESSAGE;
            const buttons = [
                [{ text: lang[selectedLanguage].SEND_ANOTHER, callback_data: "intl_transfer" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
            await sendButtons(chatId, message, buttons, "4");
        }
    }

    // user has proceeded with payment
    else if (payload === "intl_transfer_w2w_confirm_transaction") {
        await handleOTPGenerationTG(selectedLanguage, chat, "intl_transfer_w2w-otp", "intl_transfer_w2w-otp", "Transaction OTP");
    }

    if (chat?.last_message === "intl_transfer_w2w-otp" && text && !payload) {
        const otpValidationResult = await validateOTPTG(chatId, text, "intl_transfer_w2w-otp");

        if (otpValidationResult.status) {
            const confirmTransactionDetails = await confirmTransaction(chat.international_transfer.intl_exchngrate_token, chat.international_transfer, false);
            console.log(confirmTransactionDetails);

            if (confirmTransactionDetails.status) {
                const subtitles = `
${lang[selectedLanguage].TID}: ${confirmTransactionDetails?.message?.TransactionID}
${lang[selectedLanguage].BENEFICIARY}: ${confirmTransactionDetails?.message?.beneficiary?.firstname || "N/A"} ${confirmTransactionDetails?.message?.beneficiary?.lastname || "N/A"}
${lang[selectedLanguage].STATUS}: ${lang[selectedLanguage].PROCESSING}
                `;

                const buttons = [
                    [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }],
                    [{ text: lang[selectedLanguage].TRACK_STATUS, callback_data: "my_transactions" }]
                ];

                await sendPhoto(
                    chatId,
                    "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png"
                );

                await sendButtons(chatId, lang[selectedLanguage].PAYMENT_SUCCESS_INTL
                    .replace("{{amount}}", formattedAmount(confirmTransactionDetails?.message?.total?.toFixed(2)))
                    .replace("{{currency}}", confirmTransactionDetails?.message?.currency_code) +
                    "\n" + subtitles, buttons, "4");

            } else {
                const buttons = [
                    [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
                ];

                await sendPhoto(
                    chatId,
                    "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png",
                );

                await sendButtons(chatId, lang[selectedLanguage].TRANSACTION_FAILED + "\n" + lang[selectedLanguage].TRY_AGAIN_OR_CONTACT_SUPPORT_SUBTITLE, buttons, "4")

            }
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await sendMessage(chatId, lang[selectedLanguage].INVALID_OTP_MESSAGE);
            }
        }
    }


}

module.exports = { intlTransferWallet }