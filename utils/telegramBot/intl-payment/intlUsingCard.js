const { sendButtons, somethingWentWrongQuickReplyTelegram, sendMessage, userKYCVerificationTemplateTelegram, showBeneficiaries, processImageUploads, processVideoUploads } = require("../../telegramBotUtils");
const lang = require("../../../utils/languages/languages.json");
const PanModel = require("../../../models/Pan.model");
const { fetchLocalOrDefaultWalletConditionally, validateCardExpiry } = require("../../helpers");
const { checkTransactionLimitsForSender, getExchangeRatesToUSD } = require("../../conversion");
const { getIntlFXHelper, createQuotationNewHelper } = require("../../../controllers/Thune.controller");
const { validateAmount } = require("../../instaChatbotUtils");
const { getPayerNames, createTransaction, formattedAmount } = require("../../InstaChatbotHelpers");
const BeneficiaryModel = require("../../../models/Beneficiary.model");
const User = require("../../../models/User.model");
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler");
const jwt = require("jsonwebtoken");
const { initiateTopUpSavedCard } = require("../../chatbot/intl/intlTransferUsingCard");
const CryptoJS = require("crypto-js");

const secretKey = process.env.jwtKey;

async function intlTransferUsingCard(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(chat?.account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReplyTelegram(chatId, lang[selectedLanguage].NO_DEFAULT_WALLET_SET, selectedLanguage);
    }

    if (payload === "intl_transfer_card_payment") {
        const pans = await PanModel.find({ account: chat?.account._id });
        console.log(pans);

        let buttons = [];

        if (pans.length !== 0) {
            for (let i = 0; i < pans.length; i++) {
                buttons.push([
                    {
                        text: `💳 *******${pans[i].last4}`,
                        callback_data: `intl_transfer_card_payment_select_card-${pans[i]._id}`
                    }
                ]);
            }

            buttons.push([
                {
                    text: lang[selectedLanguage].CHANGE_PAYMENT_METHOD,
                    callback_data: `intl_transfer_continue_intl_payout`
                }
            ]);

            buttons.push([
                {
                    text: `☰ ${lang[selectedLanguage].MAIN_MENU}`,
                    callback_data: `main_menu`
                }
            ]);

            await sendButtons(chatId, lang[selectedLanguage].SELECT_YOUR_TOPUP_CHANNEL, buttons);
        } else {
            buttons.push([
                {
                    text: `☰ ${lang[selectedLanguage].MAIN_MENU}`,
                    callback_data: `main_menu`
                }
            ]);
            buttons.push([
                {
                    text: lang[selectedLanguage].CHANGE_PAYMENT_METHOD,
                    callback_data: `intl_transfer_continue_intl_payout`
                }
            ]);

            await sendButtons(chatId, lang[selectedLanguage].NO_CARD_SAVED, buttons);
        }
    }

    // User has selected top-up channel
    else if (payload?.includes("intl_transfer_card_payment_select_card")) {
        const cardId = payload.split("-")[1];
        const cardDetails = await PanModel.findById(cardId);

        // Account validation
        if (cardDetails.account.toString() !== chat?.account._id.toString()) {
            await sendMessage(chatId, lang[selectedLanguage].CARD_NOT_BELONG);
            return;
        }

        //  Validate card expiry using
        const expiryValidation = await validateCardExpiry(cardId);

        if (!expiryValidation.status) {
            // Handle expired or invalid card
            const pans = await PanModel.find({ account: chat?.account._id });

            let buttons = [];

            if (pans.length !== 0) {
                buttons = [
                    [{ text: lang[selectedLanguage].PAYMENT_CARD, callback_data: "intl_transfer_card_payment" }],
                    [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "intl_transfer_w2w" }],
                    [{ text: lang[selectedLanguage].PAYPAL, callback_data: "intl_transfer_paypal_payment" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                ];
            } else {
                buttons = [
                    [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "intl_transfer_w2w" }],
                    [{ text: lang[selectedLanguage].PAYPAL, callback_data: "intl_transfer_paypal_payment" }],
                    [{ text: lang[selectedLanguage].ADD_PAYMENT_CARD, callback_data: "add_payment_card-intl_transfer_continue_intl_payout" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                ];
            }

            await sendButtons(chatId, lang[selectedLanguage].SELECTED_CARD_EXPIRED, buttons, "intl_transfer_payment_method");
            return;
        }

        // Proceed with valid card
        chat.international_transfer.card.pan = cardId;
        await chat.save();

        const message = lang[selectedLanguage].ENTER_AMOUNT_CURRENCY.replace(
            '{{currency}}',
            defaultWallet?.currency.code
        );

        const buttons = [
            [{ text: `☰ ${lang[selectedLanguage].MAIN_MENU}`, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "intl_transfer_card_payment_amount");
    }

    // User has entered the amount
    else if (chat?.last_message === "intl_transfer_card_payment_amount" && !payload && text) {

        const validation = validateAmount(text, selectedLanguage);

        if (!validation.status) {
            await sendMessage(chatId, validation.message);
            return;
        }

        const amount = validation.amount;
        chat.international_transfer.card.amount = amount;

        let channel_name, service_name;
        if (chat.international_transfer.intl_payout_method === "1") {
            channel_name = "mobile_money";
            service_name = "international_mobile_wallet";
        } else if (chat.international_transfer.intl_payout_method === "2") {
            channel_name = "bank_account";
            service_name = "international_bank_transfer";
        } else if (chat.international_transfer.intl_payout_method === "3") {
            channel_name = "cash_pickup";
            service_name = "international_cash_pickup";
        } else {
            channel_name = "card_payment";
            service_name = "international_card_payment";
        }

        const ratesData = {
            transaction_type: "C2C",
            wallet_id: defaultWallet._id.toString(),
            amount,
            service_id: chat.international_transfer.intl_payout_method,
            channel_name,
            service_name,
            payerId: chat.international_transfer.intl_payer_id,
            iso_code: chat.international_transfer.intl_country_code,
            currency_code: defaultWallet.currency.code,
            payment_method: "card",
            chatbot: true
        };

        console.log({ ratesData })

        const exchangedRates = await getIntlFXHelper(ratesData);

        if (exchangedRates?.success) {
            const rates = exchangedRates?.data?.result;
            console.log(exchangedRates, "exchangedRates");

            const exchangedAmountSender = await getExchangeRatesToUSD(
                defaultWallet.currency.code,
                'USD',
                rates?.total?.value
            );
            console.log(defaultWallet.account.level, "defaultWallet.account.level");

            const sender_limits_check = await checkTransactionLimitsForSender(
                exchangedAmountSender,
                defaultWallet,
                'sending'
            );

            if (!sender_limits_check.status) {
                await sendMessage(chatId, sender_limits_check.message);
                return;
            }

            await sendMessage(
                chatId,
                lang[selectedLanguage].SENDING_AMOUNT
                    .replace("{{amount}}", formattedAmount(rates?.total?.value))
                    .replace("{{currency}}", rates?.total?.currency ?? "N/A")
            );

            let message;
            if (rates?.total?.currency !== rates?.recipient?.currency) {
                message = `
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${rates?.total?.currency ?? "N/A"} = ${formattedAmount(rates?.exchanged_rate?.value) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}
        
${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}
        
${lang[selectedLanguage].RECIPIENT_RECEIVES}: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}
        
${lang[selectedLanguage].TOTAL_MESSAGE}: ${formattedAmount(rates?.total?.value) ?? "N/A"} ${rates?.total?.currency ?? "N/A"}
            `;
            } else {
                message = `
${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}
        
${lang[selectedLanguage].RECIPIENT_RECEIVES}: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}
        
${lang[selectedLanguage].TOTAL_MESSAGE}: ${formattedAmount(rates?.total?.value) ?? "N/A"} ${rates?.total?.currency ?? "N/A"}
            `;
            }

            console.log(message, "message");

            const buttons = [
                [{ text: lang[selectedLanguage].PROCEED_TO_TRANSFER, callback_data: "intl_transfer_card_payment_proceed_transfer" },],
                [{ text: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, callback_data: "intl_transfer_card_payment_adjust_amount" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];

            await sendButtons(chatId, message, buttons);

            chat.international_transfer.card.intl_exchngrate_token = exchangedRates?.data?.token;
            await chat.save();
        } else {
            const errorMessage = Array.isArray(exchangedRates?.message)
                ? exchangedRates?.message?.find(msg =>
                    msg?.message?.toLowerCase().includes('payer is currently unavailable')
                )
                : null;

            let message, lastMessage;
            if (errorMessage) {
                const payerList = await getPayerNames(chat.international_transfer.intl_payout_method, chat?.intl_country_code);

                const payerChannel = payerList?.servicesWithIds?.filter(item =>
                    item.id.toString() === chat.international_transfer.intl_payer_id
                );

                message = lang[selectedLanguage].UNABLE_TO_SEND.replace(
                    "{{payerName}}",
                    payerChannel[0].name
                );
                lastMessage = "4"
            } else {
                if (exchangedRates?.message?.includes("minimum")) {
                    message = lang[selectedLanguage].BELOW_MINIMUM_LIMIT.replace("{{minAmount}}", exchangedRates?.value).replace("{{currency}}", exchangedRates?.currency);
                } else if (exchangedRates?.message?.includes("maximum")) {
                    message = lang[selectedLanguage].EXCEEDS_MAXIMUM_LIMIT.replace("{{maxAmount}}", exchangedRates?.value).replace("{{currency}}", exchangedRates?.currency);
                } else {
                    message = lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR;
                    lastMessage = "4"
                }

            }
            const buttons = [
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
            if (lastMessage) {
                await sendButtons(chatId, message, buttons, "4");
            } else {
                await sendButtons(chatId, message, buttons);
            }

        }
    }

    // user has asked to adjust the amount
    else if (payload === "intl_transfer_card_payment_adjust_amount" && chat?.last_message === "intl_transfer_card_payment_amount") {
        const buttons = [
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ]
        await sendButtons(chatId, lang[selectedLanguage].ENTER_AMOUNT_DIGITS, buttons, "intl_transfer_card_payment_amount");
    }

    // user has proceeded with the details
    else if (payload === "intl_transfer_card_payment_proceed_transfer" && chat?.last_message === "intl_transfer_card_payment_amount") {
        if (chat?.account?.level?.level_no === 1) {
            await userKYCVerificationTemplateTelegram(chatId, selectedLanguage);
        } else {
            const buttons = [
                [{ text: lang[selectedLanguage].PERSONAL_SUPPORT, callback_data: "intl_transfer_card_payment_purpose-FAMILY_SUPPORT" }],
                [{ text: lang[selectedLanguage].EDUCATION, callback_data: "intl_transfer_card_payment_purpose-EDUCATION" }],
                [{ text: lang[selectedLanguage].MEDICAL_TREATMENTS, callback_data: "intl_transfer_card_payment_purpose-MEDICAL_TREATMENT" }],
                [{ text: lang[selectedLanguage].OPERATIONAL_COSTS, callback_data: "intl_transfer_card_payment_purpose-SERVICE_CHARGES" }],
                [{ text: lang[selectedLanguage].CHARITY_DONATIONS, callback_data: "intl_transfer_card_payment_purpose-GIFT_AND_DONATION" }],
                [{ text: lang[selectedLanguage].OTHER_REASONS, callback_data: "intl_transfer_card_payment_purpose-OTHER" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];

            await sendButtons(
                chatId,
                `${lang[selectedLanguage].TRANSFER_REASON_MESSAGE} ${lang[selectedLanguage].SELECT_PURPOSE} 👇`,
                buttons,
                "intl_transfer_card_payment_purpose"
            );
        }
    }

    // user has selected a purpose
    else if (payload?.includes("intl_transfer_card_payment_purpose-") && chat?.last_message === "intl_transfer_card_payment_purpose") {
        const purpose = payload.split("-")[1];
        chat.international_transfer.purpose = purpose;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].ADD_NOTE_BUTTON, callback_data: "intl_transfer_card_payment_note" }],
            [{ text: lang[selectedLanguage].ATTACH_DOCUMENT_BUTTON, callback_data: "intl_transfer_card_payment_doc" }],
            [{ text: lang[selectedLanguage].SKIP, callback_data: "intl_transfer_card_payment_without_doc" }],
        ];

        await sendButtons(chatId, `${lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE}`, buttons, "intl_transfer_card_payment_attch");
    }

    // ask user to enter a note for intl transfer
    else if (payload === "intl_transfer_card_payment_note") {
        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "intl_transfer_card_payment_note");
    }
    // user has entered a note
    else if (chat?.last_message === "intl_transfer_card_payment_note" && text && !payload) {
        chat.international_transfer.intl_note = text;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].YES, callback_data: "intl_transfer_card_payment_add_attch" }],
            [{ text: lang[selectedLanguage].NO, callback_data: "intl_transfer_card_payment_no_attch" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, buttons, "intl_transfer_card_payment_note_added");
    }
    // user has also proceeded with adding an attachment
    else if (payload === "intl_transfer_card_payment_add_attch" && chat?.last_message === "intl_transfer_card_payment_note_added") {
        const buttons = [
            [{ text: lang[selectedLanguage].SKIP, callback_data: "intl_transfer_card_payment_no_attch" }],
            [{ text: lang[selectedLanguage].IMAGES_OPTIONS, callback_data: "intl_transfer_card_payment_attch_images" }],
            [{ text: lang[selectedLanguage].VIDEOS_OPTIONS, callback_data: "intl_transfer_card_payment_attch_videos" }],
            [{ text: lang[selectedLanguage].BOTH_OPTIONS, callback_data: "intl_transfer_card_payment_attch_both" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].ATTACH_MESSAGE, buttons, "intl_transfer_card_payment_attachments");
    }

    // user has not proceeded with adding an attachement
    else if (payload === "intl_transfer_card_payment_no_attch" || payload === "intl_transfer_card_payment_without_doc") {
        await showBeneficiaries(chat, chat.international_transfer.intl_country_code, "intl_transfer_card_payment", selectedLanguage);
    }

    // user has asked to upload the images
    else if (payload === "intl_transfer_card_payment_attch_images" && chat?.last_message === "intl_transfer_card_payment_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_IMAGES, buttons, "intl_transfer_card_payment_images");
    }

    // bot is expecting images when last message is "intl_transfer_card_payment_images"
    else if (chat?.last_message === "intl_transfer_card_payment_images" && image_payloads.length > 0) {

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

        await showBeneficiaries(chat, chat.international_transfer.intl_country_code, "intl_transfer_card_payment", selectedLanguage);

    }

    // user has been asked to upload the video
    else if (payload === "intl_transfer_card_payment_attch_videos" && chat?.last_message === "intl_transfer_card_payment_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_VIDEO, buttons, "intl_transfer_card_payment_video");
    }

    // bot is expecting a video when last message is "intl_transfer_card_payment_video"
    else if (chat?.last_message === "intl_transfer_card_payment_video" && video_payloads.length > 0) {

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

        await showBeneficiaries(chat, chat.international_transfer.intl_country_code, "intl_transfer_card_payment", selectedLanguage);
    }

    else if (payload === "intl_transfer_card_payment_attch_both" && chat?.last_message === "intl_transfer_card_payment_attachments") {
        const message = lang[selectedLanguage].MAX_FILES

        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "intl_transfer_card_payment_images_both");
    }

    // if the last message is set to intl_transfer_card_payment_images_both, the bot is expecting images
    else if (chat?.last_message === "intl_transfer_card_payment_images_both" && image_payloads.length > 0) {

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

        await sendButtons(chatId, message, buttons, "intl_transfer_card_payment_video_both");
    }

    // if the last message is set to intl_transfer_card_payment_video_both, the bot is expecting a video
    else if (chat?.last_message === "intl_transfer_card_payment_video_both" && video_payloads.length > 0) {

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

        await showBeneficiaries(chat, chat.international_transfer.intl_country_code, "intl_transfer_card_payment", selectedLanguage);
    }

    // second option
    else if (payload === "intl_transfer_card_payment_doc" && chat?.last_message === "intl_transfer_card_payment_attch") {
        const buttons = [
            [{ text: lang[selectedLanguage].SKIP, callback_data: "intl_transfer_card_payment_no_attch" }],
            [{ text: lang[selectedLanguage].IMAGES_OPTIONS, callback_data: "intl_transfer_card_payment_attch_images_1" }],
            [{ text: lang[selectedLanguage].VIDEOS_OPTIONS, callback_data: "intl_transfer_card_payment_attch_videos_1" }],
            [{ text: lang[selectedLanguage].BOTH_OPTIONS, callback_data: "intl_transfer_card_payment_attch_both_1" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].ATTACH_MESSAGE, buttons, "intl_transfer_card_payment_attachments");
    }

    // user has asked to upload the images
    else if (payload === "intl_transfer_card_payment_attch_images_1" && chat?.last_message === "intl_transfer_card_payment_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_IMAGES, buttons, "intl_transfer_card_payment_attch_images_1");
    }

    // bot is expecting images when last message is "intl_transfer_card_payment_attch_images_1"
    else if (chat?.last_message === "intl_transfer_card_payment_attch_images_1" && image_payloads.length > 0) {

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

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "intl_transfer_card_payment_note_1");
    }

    // user has asked to upload the video
    else if (payload === "intl_transfer_card_payment_attch_videos_1" && chat?.last_message === "intl_transfer_card_payment_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].UPLOAD_VIDEO, buttons, "intl_transfer_card_payment_attch_videos_1");
    }

    // bot is expecting a video when last message is "intl_transfer_card_payment_attch_videos_1"
    else if (chat?.last_message === "intl_transfer_card_payment_attch_videos_1" && video_payloads.length > 0) {

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

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "intl_transfer_card_payment_note_1");
    }

    // when last message is "intl_transfer_card_payment_note_1" and user has entered a note
    else if (chat?.last_message === "intl_transfer_card_payment_note_1" && text && !payload) {
        chat.international_transfer.intl_note = text;
        await chat.save();

        await showBeneficiaries(chat, chat.international_transfer.intl_country_code, "intl_transfer_card_payment", selectedLanguage);
    }

    else if (payload === "intl_transfer_card_payment_attch_both_1" && chat?.last_message === "intl_transfer_card_payment_attachments") {
        const message = lang[selectedLanguage].MAX_FILES

        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "intl_transfer_card_payment_images_both_1");
    }

    // if the last message is set to intl_transfer_card_payment_images_both, the bot is expecting images
    else if (chat?.last_message === "intl_transfer_card_payment_images_both_1" && image_payloads.length > 0) {

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

        await sendButtons(chatId, message, buttons, "intl_transfer_card_payment_video_both_1");
    }

    // if the last message is set to intl_transfer_card_payment_video_both, the bot is expecting a video
    else if (chat?.last_message === "intl_transfer_card_payment_video_both_1" && video_payloads.length > 0) {

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

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "intl_transfer_card_payment_note_1");
    }

    // user has started beneficiary selection process
    else if (payload?.includes("intl_transfer_card_payment_next_beneficiaries")) {
        const currentPage = parseInt(payload.split("_")[6]);
        const beneficiaries = chat.international_transfer.intl_beneficiaries;
        const numberOfBeneficiariesPerPage = 8;
        const startIndex = (currentPage - 1) * numberOfBeneficiariesPerPage;
        const endIndex = startIndex + numberOfBeneficiariesPerPage;

        const beneficiariesToDisplay = beneficiaries.slice(startIndex, endIndex);

        const beneficiaryList = beneficiariesToDisplay.map((beneficiary) => ({
            text: `${beneficiary?.first_name} ${beneficiary?.last_name}`,
            callback_data: `intl_transfer_card_payment_sb_${beneficiary._id}`
        }));

        const message = lang[selectedLanguage].SELECT_BENEFICIARY;

        const buttons = [
            ...beneficiaryList.map((beneficiary) => [{ text: beneficiary.text, callback_data: beneficiary.callback_data }]),
            [{ text: lang[selectedLanguage].ADD_BENEFICIARY, callback_data: "add_beneficiary" }]
        ];

        if (currentPage === 2) {
            buttons.push([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: "intl_transfer_card_payment_no_attch" }]);
            buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);
        } else {
            buttons.push([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: `intl_transfer_card_payment_prev_beneficiaries_${currentPage}` }]);
            buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);
        }

        if (beneficiaries.length > endIndex) {
            buttons.unshift([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `intl_transfer_card_payment_next_beneficiaries_${currentPage + 1}` }]);
        }

        await sendButtons(chatId, message, buttons);
    }
    else if (payload?.includes("intl_transfer_card_payment_prev_beneficiaries")) {
        const currentPage = parseInt(payload.split("_")[6]);
        const beneficiaries = chat.international_transfer.intl_beneficiaries;
        const numberOfBeneficiariesPerPage = 8;
        const startIndex = (currentPage - 1) * numberOfBeneficiariesPerPage;
        const endIndex = startIndex + numberOfBeneficiariesPerPage;

        const beneficiariesToDisplay = beneficiaries.slice(startIndex, endIndex);

        const beneficiaryList = beneficiariesToDisplay.map((beneficiary) => ({
            text: `${beneficiary?.first_name} ${beneficiary?.last_name}`,
            callback_data: `intl_transfer_card_payment_sb_${beneficiary._id}`
        }));

        const message = lang[selectedLanguage].SELECT_BENEFICIARY;

        const buttons = [
            ...beneficiaryList.map((beneficiary) => [{ text: beneficiary.text, callback_data: beneficiary.callback_data }]),
            [{ text: lang[selectedLanguage].ADD_BENEFICIARY, callback_data: "add_beneficiary" }]
        ];

        if (currentPage > 1) {
            buttons.unshift([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: `intl_transfer_card_payment_prev_beneficiaries_${currentPage - 1}` }]);
        }

        if (beneficiaries.length > endIndex) {
            buttons.unshift([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `intl_transfer_card_payment_next_beneficiaries_${currentPage + 1}` }]);
        }

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);

        await sendButtons(chatId, message, buttons);
    }

    // User selects a beneficiary
    else if (payload?.includes("intl_transfer_card_payment_sb_")) {
        const beneficiaryId = payload?.split("_")[5];
        console.log(beneficiaryId, "beneficiaryId");

        const beneficiary = await BeneficiaryModel.findById(beneficiaryId);
        const benefName = `${beneficiary?.first_name} ${beneficiary?.last_name}`;
        chat.international_transfer.intl_benef_id = beneficiary?._id;
        await chat.save();

        const quotationData = {
            payerId: chat.international_transfer.intl_payer_id,
            wallet_id: defaultWallet?._id.toString(),
            transaction_type: beneficiary?.beneficiary_type === "individual" ? "C2C" : "B2C",
            token: chat.international_transfer.card.intl_exchngrate_token,
            payment_method: "card"
        };

        console.log("quotationData inside condition", quotationData);

        const quotationDetails = await createQuotationNewHelper(quotationData);

        console.log(quotationDetails, "quotationDetails");

        if (quotationDetails?.status) {
            chat.international_transfer.card.intl_exchngrate_token = quotationDetails?.token;
            chat.international_transfer.card.intl_quotation_id = quotationDetails?.QuotationID;
            await chat.save();

            const message = `
                ${lang[selectedLanguage].CONFIRM_SEND_MESSAGE} ${formattedAmount(chat.international_transfer.card.amount)} ${defaultWallet?.currency.code} ${lang[selectedLanguage].TO} ${benefName}?
            `;

            const buttons = [
                [{ text: lang[selectedLanguage].YES_CONTINUE_TITLE, callback_data: "intl_transfer_card_payment_confirm_beneficiary" }],
                [{ text: lang[selectedLanguage].CHANGE_BENEFICIARY, callback_data: "intl_transfer_card_payment_no_attch" }],
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
            await sendButtons(chatId, message, buttons);
        }
    }

    // User has confirmed beneficiary
    else if (payload === "intl_transfer_card_payment_confirm_beneficiary") {
        const user = await User.findOne({ account: chat.account._id });
        const beneficiary = await BeneficiaryModel.findById(chat?.international_transfer.intl_benef_id);

        const transactionData = {
            wallet_id: defaultWallet?._id?.toString(),
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
            token: chat.international_transfer.card.intl_exchngrate_token,
            Quotation_ID: chat.international_transfer.card.intl_quotation_id
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
                wallet_id: defaultWallet?._id?.toString(),
                amount: chat.international_transfer.card.amount,
                service_id: chat.international_transfer.intl_payout_method,
                channel_name,
                service_name,
                payerId: chat.international_transfer.intl_payer_id,
                iso_code: chat.international_transfer.intl_country_code,
                currency_code: defaultWallet.currency.code,
                payment_method: "card",
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
${lang[selectedLanguage].PAYMENT_NAME}: ${payerChannel[0]?.name || "N/A"}
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
                [{ text: lang[selectedLanguage].CONFIRM_TRANSACTION, callback_data: "intl_transfer_card_payment_confirm_transaction" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
            await sendButtons(chatId, message, buttons);
            chat.international_transfer.card.intl_exchngrate_token = createTransactionDetails?.token;
            await chat.save();
        } else {
            const message = lang[selectedLanguage].PAYMENT_ISSUE_MESSAGE;
            const buttons = [
                [{ text: lang[selectedLanguage].SEND_ANOTHER, callback_data: "intl_transfer" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
            await sendButtons(chatId, message, buttons);
        }
    }

    // user has proceeded with payment
    else if (payload === "intl_transfer_card_payment_confirm_transaction") {
        await handleOTPGenerationTG(selectedLanguage, chat, "intl_transfer_card_payment-otp", "intl_transfer_card_payment-otp", "Transaction OTP");
    }

    // User has entered OTP
    else if (chat?.last_message === "intl_transfer_card_payment-otp" && !payload && text) {
        const otpValidationResult = await validateOTPTG(chatId, text, "intl_transfer_card_payment-otp");

        if (otpValidationResult.status) {
            let decodedToken;
            try {
                decodedToken = jwt.verify(chat.international_transfer.card.intl_exchngrate_token, secretKey);
            } catch (err) {
                console.log(err);
                return await sendButtons(
                    chatId,
                    lang[selectedLanguage].TIMEOUT_EXPIRED,
                    [[{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]]
                );
            }

            console.log(decodedToken, "decodedToken");

            const calculations = decodedToken.transactionDetails.calculations;
            console.log(calculations, "calculations");

            const transactionDetails = await initiateTopUpSavedCard(defaultWallet, parseFloat(calculations.total.value) * 100, chat.international_transfer.card.pan, chat.international_transfer.card.intl_exchngrate_token);
            console.log({ transactionDetails });

            if (transactionDetails?.status) {
                const title = lang[selectedLanguage].VERIFY_CARD;
                const subtitle = `
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(parseFloat(calculations.total.value))} ${defaultWallet?.currency?.code}
            `;

                const buttons = [
                    [
                        {
                            text: lang[selectedLanguage].VERIFY,
                            url: `https://my.insta-pay.ch/chatbot/pan-transaction?token=${transactionDetails?.data?.token}&transaction_id=${transactionDetails?.data?.transaction_id}&reference_id=${transactionDetails?.data?.reference_id}&intl_token=${chat.international_transfer.card.intl_exchngrate_token}&slug=confirm-chatbot-intl-pan-topup-telegram`
                        }
                    ],
                    [
                        { text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }
                    ]
                ];

                await sendButtons(chatId, `${title}\n${subtitle}`, buttons, "4");
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
                await invalidMessageTG(chatId, "updated_w2w_card_payment-otp", selectedLanguage, chat?.otpType);
            }
        }
    }


}

module.exports = { intlTransferUsingCard }