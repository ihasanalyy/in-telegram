const { sendButtons, sendMessage, handleCountrySelection, invalidInputResponse, handleBeneficiaries, sendPhoto, processVideoUploads, processImageUploads, sendVideo } = require("../../telegramBotUtils");
const lang = require("../../../utils/languages/languages.json");
const { getAvailableCountries, fetchCountriesFromThunes, getPayoutChannelName, balanceLimitCheck, validateAmount } = require("../../instaChatbotUtils");
const { getCountries, getPayerNames, getReviewsBySeller, formattedAmount, requestPayment } = require("../../InstaChatbotHelpers");
const countries = require('../../../utils/countryIso.json');
const countryToEmoji = require('../../../utils/countryEmojis.json');
const Beneficiary = require("../../../models/Beneficiary.model");
const Account = require("../../../models/Account.model");
const Wallet = require("../../../models/Wallet.model");
const currencyToEmoji = require('../../../utils/currencyEmojis.json');
const { formatDecimalNumbersWithLimit } = require("../../payerRates");
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler");
const { getGeocodeData } = require("../../helpers");
const TelegramBotModel = require("../../../models/TelegramBot.model");

async function sendRequestPaymentTemplate(chatId, selectedLanguage) {
    const buttons = [
        [
            { text: lang[selectedLanguage].INSTANT, callback_data: "req_pay_instant" },
        ],
        [
            { text: lang[selectedLanguage].SUBSCRIPTION, callback_data: "req_pay_subs" },
        ],
        [
            { text: lang[selectedLanguage].SCHEDULE, callback_data: "req_pay_sched" },
        ],
        [
            { text: `🗃️ ${lang[selectedLanguage].MAIN_MENU_TITLE}`, callback_data: "main_menu" }
        ]
    ];


    await sendButtons(chatId, lang[selectedLanguage].TRANSACTION_TYPE, buttons, "req_pay_type");
}

async function processRequestPayment(chatId, account, chat, selectedLanguage) {
    let data = {
        amount: chat?.request.amount,
        wallet_id: chat?.request?.requesting_wallet,
        purpose: "",
        sender: account._id,
        receiver: chat?.request?.beneficiary,
        payment_type: "payment_request",
        attachments: chat.request.attachments,
        description: chat.request.note,
    };

    const geoData = await getGeocodeData(chat.request?.lat, chat.request?.long);
    if (chat.request?.lat && chat.request?.long && geoData.status) {
        data = {
            ...data,
            lat: geoData.data.lat,
            long: geoData.data.lon,
            display_name: geoData.data.display_name,
            address: geoData.data?.address
        };
    }

    console.log(data, "datainsiderequestpayment");
    const requestDetails = await requestPayment(data);
    console.log({ requestDetails });

    if (requestDetails?.status) {
        const benefAccount = await Account.findById(chat?.request?.beneficiary);
        const senderAccount = await Account.findById(account._id);

        const recipientName = benefAccount.account_type === "individual" ? benefAccount.first_name + " " + benefAccount.last_name : benefAccount?.company_name;
        const senderName = senderAccount.account_type === "individual" ? senderAccount.first_name + " " + senderAccount.last_name : senderAccount?.company_name;

        const message = `Request successfully dispatched!\n\nRequest ID: ${requestDetails?.requestDetails?.reference_id}\nRecipient Name: ${recipientName}\n${lang[selectedLanguage].AMOUNT}: ${chat?.request.amount.toFixed(2)} ${requestDetails?.requestDetails?.currency?.code}\nCountry: ${benefAccount?.country_name}`;

        const buttons = [
            [{ text: lang[selectedLanguage].SEND_ANOTHER, callback_data: `req_pay` }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "4");

        if (benefAccount?.telegram_bot) {
            const recipientTelegramBot = await TelegramBotModel.findOne({ recipient: benefAccount?.telegram_id });
            const benefLang = recipientTelegramBot?.selected_language || benefAccount?.language || "en";
            const recipientMessage = `${lang[benefLang].RECEIVED_PAYMENT_REQUEST} ${account.username}!\n\nRequest ID: ${requestDetails?.requestDetails?.reference_id}\nSender Name: ${senderName}\n${lang[benefLang].AMOUNT}: ${formattedAmount(requestDetails?.requestDetails?.amount?.toFixed(2))} ${requestDetails?.requestDetails?.currency?.code}\nCountry: ${account.country_name}`;

            const recipientButtons = [
                [{ text: lang[benefLang].ACCEPT, callback_data: `accept_req_pay-${requestDetails?.requestDetails?._id}` }],
                [{ text: lang[benefLang].DECLINE, callback_data: `decline_req_pay-${requestDetails?.requestDetails?._id}` }],
                [{ text: lang[benefLang].VIEW_PROFILE_BUTTON, url: `https://my.insta-pay.ch/profile/${account?.username}` }]
            ];

            await sendButtons(benefAccount?.telegram_id, recipientMessage, recipientButtons, "4");

            if (geoData.status) {
                const addressMessage = `The above payment request originated from the below address 👇\n\n${geoData?.data?.display_name || 'Unknown'}`;
                const addressButton = [[{ text: "View Pin Location📍", url: `https://my.insta-pay.ch/chatbot/payment-request?longitude=${geoData.data.lon}&latitude=${geoData.data.lat}` }]];
                await sendButtons(benefAccount?.telegram_id, addressMessage, addressButton);
            }

            if (chat.request.attachments?.length > 0 || chat.request.note) {
                const detailsMessage = `Attached are details with the payment request 👇\n\n${chat.request.note ? "Note: " + chat.request.note : ""}`;
                await sendMessage(benefAccount?.telegram_id, detailsMessage);

                if (chat.request.attachments?.length > 0) {
                    for (const attachment of chat.request.attachments) {
                        const fileName = attachment.key.split('/').pop();
                        const fileType = fileName.split('.').pop();
                        if (fileType === "mp4") {
                            await sendVideo(benefAccount?.telegram_id, attachment?.url);
                        } else {
                            await sendPhoto(benefAccount?.telegram_id, attachment?.url);
                        }
                    }
                }
            }
        }
    } else {
        const failMessage = lang[selectedLanguage].SOMETHING_WENT_WRONG_REQUEST;
        const failButtons = [
            [{ text: lang[selectedLanguage].TRY_ANOTHER, callback_data: "req_pay" }],
            [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
        ];
        await sendButtons(chatId, failMessage, failButtons, "4");
    }
    chat.request = {};
    await chat.save();
}


async function requestMoney(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    if (payload === "req_pay") {
        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Split.png", lang[selectedLanguage].REQUEST_MONEY_TITLE)
        await sendButtons(chatId, lang[selectedLanguage].REQUEST_MONEY_SUBTITLE, [
            [{ text: lang[selectedLanguage].CONTINUE, callback_data: "req_pay_continue" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ], "req_pay_continue");
    }
    else if (payload === "req_pay_continue" && chat?.last_message === "req_pay_continue") {
        await handleBeneficiaries(chat?.account._id, chatId, "req_pay", "req_pay", selectedLanguage, 1);
    }
    else if ((payload?.startsWith("req_pay_next_") || payload?.startsWith("req_pay_prev_")) && chat?.last_message === "req_pay") {
        const pageNumber = parseInt(payload.split("_").pop());
        await handleBeneficiaries(chat?.account._id, chatId, "", "req_pay", selectedLanguage, pageNumber);

    }
    else if (payload?.startsWith("req_pay-")) {
        // TODO: set a condition that the selected beneficiary belongs to the current account
        const benefId = payload.split("-")[1];
        console.log(benefId);
        const benefDetails = await Beneficiary.findById(benefId);
        const benefAccount = await Account.findOne({ phone: benefDetails?.phone });

        if (benefAccount?._id?.toString() === chat.account?._id?.toString()) {
            return await sendButtons(chatId, lang[selectedLanguage].SEND_MONEY_TO_SELF, [
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ]);
        }

        const reviews = await getReviewsBySeller(benefAccount?._id);
        let userReviews = [];
        if (reviews?.status) {
            userReviews = reviews?.message?.slice(0, 3)?.map((review) => `💎 ${review.comment}`);
        }
        console.log(reviews, userReviews);

        if (benefAccount?.profileImage?.url) {
            await sendPhoto(chatId, benefAccount?.profileImage?.url)
        }

        const subtitleMsg = `
${lang[selectedLanguage].BENEFICIARY_NAME}: ${benefDetails?.first_name} ${benefDetails?.last_name},
${lang[selectedLanguage].BENEFICIARY_COUNTRY}: ${benefDetails.country_name}
    `;

        await sendButtons(chatId, `${subtitleMsg}`, [
            [{ text: lang[selectedLanguage].CONTINUE, callback_data: "req_pay_cont" }],
            [{ text: lang[selectedLanguage].VIEW_PROFILE_BUTTON, url: `https://my.insta-pay.ch/profile/${benefAccount.username}` }]
        ]);

        const accountDetails = userReviews.length ? `Some recent reviews:` : lang[selectedLanguage].SELECT_OPTION;
        if (userReviews.length) {
            await sendMessage(chatId, accountDetails);
        } else {
            await sendButtons(chatId, accountDetails, [
                [{ text: lang[selectedLanguage].SELECT_ANOTHER, callback_data: "req_pay" }],
                [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
            ])
        }

        for (const review of userReviews) {
            await sendButtons(chatId, review, [
                [{ text: lang[selectedLanguage].SELECT_ANOTHER, callback_data: "req_pay" }],
                [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
            ]);
        }

        chat.request.beneficiary = benefAccount?._id;
        await chat.save();
    }
    // Instead of choosing beneficiary, user enters account info: username, email, phone
    else if (chat.last_message === "req_pay" && text && !payload) {
        const user = await Account.findOne({
            $or: [
                { username: { $regex: new RegExp(text, "i") } },
                { email: { $regex: new RegExp(text, "i") } },
                { phone: { $regex: new RegExp(text, "i") } },
                { telegram_username: { $regex: new RegExp(text, "i") } }
            ]
        }).populate(["user", "company"]);

        if (user) {
            if (user?._id?.toString() === chat.account?._id?.toString()) {
                return await sendButtons(chatId, lang[selectedLanguage].SEND_MONEY_TO_SELF, [
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ]);
            }

            const reviews = await getReviewsBySeller(user?._id);
            let userReviews = [];
            if (reviews?.status) {
                userReviews = reviews?.message?.slice(0, 3)?.map((review) => `💎 ${review.comment}`);
            }

            if (user?.profileImage?.url) {
                await sendPhoto(chatId, user?.profileImage?.url)
            }

            const subtitleMsg = `
${lang[selectedLanguage].USERNAME}: ${user.username}
${lang[selectedLanguage].COUNTRY}: ${user.country_name}
    `;

            await sendButtons(chatId, subtitleMsg, [
                [{ text: lang[selectedLanguage].CONTINUE, callback_data: "req_pay_cont" }],
                [{ text: lang[selectedLanguage].VIEW_PROFILE_BUTTON, url: `https://my.insta-pay.ch/profile/${user.username}` }]
            ]);

            const accountDetails = userReviews.length ? `Some recent reviews:` : lang[selectedLanguage].SELECT_OPTION;
            if (userReviews.length) {
                await sendMessage(chatId, accountDetails);
            } else {
                await sendButtons(chatId, accountDetails, [
                    [{ text: lang[selectedLanguage].SELECT_ANOTHER, callback_data: "req_pay" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
                ])
            }

            for (const review of userReviews) {
                await sendButtons(chatId, review, [
                    [{ text: lang[selectedLanguage].SELECT_ANOTHER, callback_data: "req_pay" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
                ]);
            }

            chat.request.beneficiary = user?._id;
            await chat.save();
        } else {
            await sendButtons(chatId, lang[selectedLanguage].INVALID_USER, [
                [{ text: lang[selectedLanguage].SELECT_ANOTHER, callback_data: "req_pay" }],
                [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
            ]);
        }
    }
    // User has confirmed the beneficiary
    else if (payload === "req_pay_cont") {
        const wallets = await Wallet.find({ account: chat.account._id, wallet_type: 'insta', status: "active" });
        const slicedWallets = wallets.slice(0, 8);

        let buttons = slicedWallets.map((wallet) => {
            return [
                {
                    text: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`,
                    callback_data: `req_pay_w-${wallet._id}`,
                },
            ];
        });

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);

        await sendButtons(chatId, lang[selectedLanguage].RECEIVE_CURRENCY_PROMPT, buttons);
    }

    // User has selected the wallet
    else if (payload && payload.startsWith("req_pay_w-")) {
        const wallet_id = payload.split("-")[1];
        console.log(wallet_id, "wallet_id");

        chat.request.requesting_wallet = wallet_id;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].ANOTHER_WALLET_TITLE, callback_data: "req_pay_cont" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].ENTER_AMOUNT, buttons, "req_pay_amount");
    }

    // User has entered some amount to request
    else if (text && chat.last_message === "req_pay_amount") {
        const validation = validateAmount(text, selectedLanguage);

        if (!validation.status) {
            await sendMessage(chatId, validation.message);
            return;
        }

        const amount = validation.amount;

        // Receiver's account balance check
        const receivingWallet = await Wallet.findById(chat.request.requesting_wallet);
        const receiverBalanceCheck = await balanceLimitCheck(amount, chat.account, receivingWallet);
        console.log({ receiverBalanceCheck });

        if (!receiverBalanceCheck?.status && receiverBalanceCheck?.remainingBalance) {
            let buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];

            if (chat.account.level.level_no === 1) {
                buttons.push([{ text: "Identity Verification", callback_data: "kyc_verification" }]);
                await sendButtons(
                    chatId,
                    `Completing this transaction will exceed your balance limit. Your remaining balance is ${formattedAmount(receiverBalanceCheck?.remainingBalance)} ${receivingWallet?.currency.code}. Please enter an amount within your balance limit or complete KYC verification to increase your balance limit.`,
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

            await sendButtons(chatId, "Something went wrong while checking your balance limit. Please try again.", buttons);
            return;
        }

        chat.request.amount = amount;
        await chat.save();

        // await sendRequestPaymentTemplate(chatId, selectedLanguage);
        const buttons = [
            [{ text: lang[selectedLanguage].ADD_NOTE_BUTTON, callback_data: "req_pay_note" }],
            [{ text: lang[selectedLanguage].ATTACH_DOCUMENT_BUTTON, callback_data: "req_pay_document" }],
            [{ text: lang[selectedLanguage].SKIP, callback_data: "req_pay_no_attch" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, buttons, "req_pay_attch");
    }
    // attachments flow
    // ask user to enter a note for intl transfer
    else if (payload === "req_pay_note" && chat?.last_message === "req_pay_attch") {
        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "req_pay_note");
    }
    // user has entered a note
    else if (chat?.last_message === "req_pay_note" && text && !payload) {
        chat.request.note = text;
        await chat.save();

        const buttons = [
            [{ text: lang[selectedLanguage].YES, callback_data: "req_pay_add_attch" }],
            [{ text: lang[selectedLanguage].NO, callback_data: "req_pay_no_attch" }],
        ];

        await sendButtons(chatId, lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, buttons, "req_pay_note_added");
    }
    // user has also proceeded with adding an attachment
    else if (payload === "req_pay_add_attch" && chat?.last_message === "req_pay_note_added") {
        const buttons = [
            [{ text: lang[selectedLanguage].SKIP, callback_data: "req_pay_no_attch" }],
            [{ text: "Images", callback_data: "req_pay_attch_images" }],
            [{ text: "Video", callback_data: "req_pay_attch_videos" }],
            [{ text: "Both", callback_data: "req_pay_attch_both" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, "What do you want to attach? You can only attach up to 4 images and 1 video, totaling 5 files. ", buttons, "req_pay_attachments");
    }

    // user has not proceeded with adding an attachement
    else if (payload === "req_pay_no_attch" || payload === "req_pay_without_doc") {
        await sendRequestPaymentTemplate(chatId, selectedLanguage);
    }

    // user has asked to upload the images
    else if (payload === "req_pay_attch_images" && chat?.last_message === "req_pay_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, "Please upload up to 4 images.", buttons, "req_pay_images");
    }

    // bot is expecting images when last message is "req_pay_images"
    else if (chat?.last_message === "req_pay_images" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, "You can only attach up to 4 images.");
            return;
        }
        const uploadedImageUrls = await processImageUploads(image_payloads);

        for (const image of uploadedImageUrls) {
            chat.request.attachments.push({
                key: image.key,
                url: image.url,
                ETag: image.ETag
            })
        }

        await chat.save();

        await sendRequestPaymentTemplate(chatId, selectedLanguage);

    }

    // user has been asked to upload the video
    else if (payload === "req_pay_attch_videos" && chat?.last_message === "req_pay_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, "Please upload a video.", buttons, "req_pay_video");
    }

    // bot is expecting a video when last message is "req_pay_video"
    else if (chat?.last_message === "req_pay_video" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, "You can only attach up to 1 video.");
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.request.attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        await sendRequestPaymentTemplate(chatId, selectedLanguage);
    }

    else if (payload === "req_pay_attch_both" && chat?.last_message === "req_pay_attachments") {
        const message = "Alright! You can first upload images and then videos. Let’s start with the images. You can upload up to 4 images."

        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "req_pay_images_both");
    }

    // if the last message is set to req_pay_images_both, the bot is expecting images
    else if (chat?.last_message === "req_pay_images_both" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, "You can only attach up to 4 images.");
            return;
        }
        const uploadedImageUrls = await processImageUploads(image_payloads);
        console.log({ uploadedImageUrls })

        for (const image of uploadedImageUrls) {
            chat.request.attachments.push({
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

        await sendButtons(chatId, message, buttons, "req_pay_video_both");
    }

    // if the last message is set to req_pay_video_both, the bot is expecting a video
    else if (chat?.last_message === "req_pay_video_both" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, "You can only attach up to 1 video.");
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.request.attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        await sendRequestPaymentTemplate(chatId, selectedLanguage);
    }

    // second option
    else if (payload === "req_pay_document" && chat?.last_message === "req_pay_attch") {
        const buttons = [
            [{ text: lang[selectedLanguage].SKIP, callback_data: "req_pay_no_attch" }],
            [{ text: "Images", callback_data: "req_pay_attch_images_1" }],
            [{ text: "Video", callback_data: "req_pay_attch_videos_1" }],
            [{ text: "Both", callback_data: "req_pay_attch_both_1" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, "What do you want to attach? You can only attach up to 4 images and 1 video, totaling 5 files. ", buttons, "req_pay_attachments");
    }

    // user has asked to upload the images
    else if (payload === "req_pay_attch_images_1" && chat?.last_message === "req_pay_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, "Please upload up to 4 images.", buttons, "req_pay_attch_images_1");
    }

    // bot is expecting images when last message is "req_pay_attch_images_1"
    else if (chat?.last_message === "req_pay_attch_images_1" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, "You can only attach up to 4 images.");
            return;
        }

        const uploadedImageUrls = await processImageUploads(image_payloads);

        for (const image of uploadedImageUrls) {
            chat.request.attachments.push({
                key: image.key,
                url: image.url,
                ETag: image.ETag
            })
        }

        await chat.save();

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "req_pay_note_1");
    }

    // user has asked to upload the video
    else if (payload === "req_pay_attch_videos_1" && chat?.last_message === "req_pay_attachments") {
        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, "Please upload a video.", buttons, "req_pay_attch_videos_1");
    }

    // bot is expecting a video when last message is "req_pay_attch_videos_1"
    else if (chat?.last_message === "req_pay_attch_videos_1" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, "You can only attach up to 1 video.");
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.request.attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "req_pay_note_1");
    }

    // when last message is "req_pay_note_1" and user has entered a note
    else if (chat?.last_message === "req_pay_note_1" && text && !payload) {
        chat.request.note = text;
        await chat.save();

        await sendRequestPaymentTemplate(chatId, selectedLanguage);
    }

    else if (payload === "req_pay_attch_both_1" && chat?.last_message === "req_pay_attachments") {
        const message = "Alright! You can first upload images and then videos. Let’s start with the images. You can upload up to 4 images."

        const buttons = [
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "req_pay_images_both_1");
    }

    // if the last message is set to req_pay_images_both, the bot is expecting images
    else if (chat?.last_message === "req_pay_images_both_1" && image_payloads.length > 0) {

        if (image_payloads.length > 4) {
            await sendMessage(chatId, "You can only attach up to 4 images.");
            return;
        }
        const uploadedImageUrls = await processImageUploads(image_payloads);

        for (const image of uploadedImageUrls) {
            chat.request.attachments.push({
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

        await sendButtons(chatId, message, buttons, "req_pay_video_both_1");
    }

    // if the last message is set to req_pay_video_both, the bot is expecting a video
    else if (chat?.last_message === "req_pay_video_both_1" && video_payloads.length > 0) {

        if (video_payloads.length > 1) {
            await sendMessage(chatId, "You can only attach up to 1 video.");
            return;
        }

        const uploadedVideoUrls = await processVideoUploads(video_payloads);

        chat.request.attachments.push({
            key: uploadedVideoUrls.key,
            url: uploadedVideoUrls.url,
            ETag: uploadedVideoUrls.ETag
        })

        await chat.save();

        await sendMessage(chatId, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "req_pay_note_1");
    }

    // user has asked for instant request
    else if (payload === "req_pay_instant" && chat?.last_message === "req_pay_type") {
        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Instant.png")
        await sendButtons(chatId, lang[selectedLanguage].INSTANT_REQUEST_TITLE, [
            [{ text: lang[selectedLanguage].CONTINUE, callback_data: "req_pay_instant_cont" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ]);
    }
    // user has asked for scheduled request
    else if (payload === "req_pay_schedule" && chat?.last_message === "req_pay_type") {
        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Schedule%20Payments.png")
        await sendButtons(chatId, lang[selectedLanguage].SCHEDULE_REQUEST_TITLE, [
            // [{ text: lang[selectedLanguage].CONTINUE, callback_data: "req_pay_instant_cont" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ]);
    }
    // user has asked for instant request
    else if (payload === "req_pay_subscription" && chat?.last_message === "req_pay_type") {
        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Subscrption%20%281%29.png")
        await sendButtons(chatId, lang[selectedLanguage].SUBSCRIPTION_REQUEST_TITLE, [
            // [{ text: lang[selectedLanguage].CONTINUE, callback_data: "req_pay_instant_cont" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ]);
    }

    // user has asked for instant request
    else if (payload === "req_pay_instant_cont" && chat?.last_message === "req_pay_type") {
        const walletDetails = await Wallet.findById(chat?.request?.requesting_wallet);
        const receiverDetails = await Account.findById(chat?.request?.beneficiary).populate(["user", "company"]);

        const userName =
            receiverDetails?.account_type === "individual"
                ? `${receiverDetails?.user?.first_name} ${receiverDetails?.user?.last_name}`
                : receiverDetails?.company?.company_name;

        const message = `
${lang[selectedLanguage].INITIATING_REQUEST
                .replace("{{amount}}", formattedAmount(formatDecimalNumbersWithLimit(chat?.request?.amount)))
                .replace("{{currency}}", walletDetails?.currency?.code)
                .replace("{{name}}", userName)}

${lang[selectedLanguage].PROCEED}
`;

        const buttons = [
            [{ text: lang[selectedLanguage].CONFIRM_TITLE, callback_data: "req_pay_instant_confirm" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, message, buttons, "req_pay_instant");
    }
    // User has proceeded with the payment request, so proceeding with the map selection
    else if (payload === "req_pay_instant_confirm" && chat?.last_message === "req_pay_instant") {
        const buttons = [
            [{
                text: lang[selectedLanguage].SHARE_LOCATION,
                url: `https://my.insta-pay.ch/chatbot/get-location?recipient_id=${chatId}&platform=telegram`
            }],
            [{
                text: lang[selectedLanguage].CANCEL,
                callback_data: "main_menu"
            }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].SEND_PAYMENT_REQUEST, buttons, "req_pay_location_selection");
    }

    else if (chat?.last_message === "req_pay_location_selection" && payload === "req_pay_location_proceed") {
        await handleOTPGenerationTG(selectedLanguage, chat, "req_pay-otp", "req_pay-otp", "Transaction OTP");
    }
    // User has entered the OTP
    else if (chat?.last_message === "req_pay-otp" && !payload && text) {
        const otpValidationResult = await validateOTPTG(chatId, text, "req_pay-otp");
        if (otpValidationResult.status) {
            await processRequestPayment(chatId, chat.account, chat, selectedLanguage);

        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessageTG(chatId, "req_pay-otp", selectedLanguage, chat?.otpType);
            }
        }
    }

}

module.exports = { requestMoney }