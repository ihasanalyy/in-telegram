const { sendButtons, sendMessage, invalidInputResponse, sendPhoto } = require("../../telegramBotUtils");
const lang = require("../../../utils/languages/languages.json");
const { usersFeatureMessage, generateRatingStars } = require("../../instaChatbotUtils");
const { formattedAmount, walletToWalletTransaction, buyerToSellerReview, sellerToBuyerReview, sellerToBuyerReply } = require("../../InstaChatbotHelpers");
const currencyToEmoji = require('../../../utils/currencyEmojis.json');
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler");
const { getUserActiveWallets, getActiveWalletById, calculateExchangeAndFees } = require("../../helpers");
const TelegramBotModel = require("../../../models/TelegramBot.model");
const RequestPayment = require("../../../models/Request-Payment.model");
const PanModel = require("../../../models/Pan.model");
const { getExchangeRatesToUSD, checkTransactionLimitsForSender } = require("../../conversion");
const RequestReview = require("../../../models/RequestReview.model");
const { acceptRequestPaypal } = require("./acceptRequestPaypal");
const { acceptRequestCard } = require("./acceptRequestCard");

async function acceptRequest(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    if (payload && payload.startsWith("accept_req_pay-")) {
        const request_id = payload.split("-")[1];
        const paymentRequest = await RequestPayment.findById(request_id);

        if (paymentRequest?.status === "pending") {

            chat.request.request_id = request_id;
            await chat.save();

            const pans = await PanModel.find({ account: chat.account._id });

            const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD;

            let buttons = [];

            if (pans.length !== 0) {
                buttons = [
                    [{ text: lang[selectedLanguage].PAYMENT_CARD, callback_data: "accept_req_pay_card" }],
                    [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "accept_req_pay_wallet" }],
                    [{ text: lang[selectedLanguage].PAYPAL, callback_data: "accept_req_pay_ppl" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                ];
            } else {
                buttons = [
                    [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "accept_req_pay_wallet" }],
                    [{ text: lang[selectedLanguage].PAYPAL, callback_data: "accept_req_pay_ppl" }],
                    [{ text: lang[selectedLanguage].ADD_PAYMENT_CARD, callback_data: "add_payment_card-accept_req_pay_back" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                ];
            }

            await sendButtons(chatId, message, buttons, "accept_req_pay");
        } else if (paymentRequest?.status === "completed") {
            const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
            await sendButtons(chatId, lang[selectedLanguage].PAYMENT_REQUEST_COMPLETED, buttons);
        } else if (paymentRequest?.status === "cancelled") {
            const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
            await sendButtons(chatId, lang[selectedLanguage].PAYMENT_REQUEST_CANCELLED, buttons);
        }
    }
    else if (payload === "accept_req_pay_back") {
        const pans = await PanModel.find({ account: chat.account._id });

        const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD;
        let buttons = [];

        if (pans.length !== 0) {
            buttons = [
                [{ text: lang[selectedLanguage].PAYMENT_CARD, callback_data: "accept_req_pay_card" }],
                [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "accept_req_pay_wallet" }],
                [{ text: lang[selectedLanguage].PAYPAL, callback_data: "accept_req_pay_ppl" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
            ];
        } else {
            buttons = [
                [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "accept_req_pay_wallet" }],
                [{ text: lang[selectedLanguage].PAYPAL, callback_data: "accept_req_pay_ppl" }],
                [{ text: lang[selectedLanguage].ADD_PAYMENT_CARD, callback_data: "add_payment_card-accept_req_pay_back" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
            ];
        }

        await sendButtons(chatId, message, buttons);
    }

    // user has proceeded with accepting request with paypal
    else if ((text && chat.last_message?.startsWith("accept_req_pay_ppl"))
        || (payload?.startsWith("accept_req_pay_ppl") && chat.last_message?.startsWith("accept_req_pay_ppl"))
        || (payload === "accept_req_pay_ppl")
        || (chat.last_message?.startsWith("accept_req_pay_ppl") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await acceptRequestPaypal(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads)
        return
    }
    // user has proceeded with accepting request with card
    else if ((text && chat.last_message?.startsWith("accept_req_pay_card"))
        || (payload?.startsWith("accept_req_pay_card") && chat.last_message?.startsWith("accept_req_pay_card"))
        || (payload === "accept_req_pay_card")
        || (chat.last_message?.startsWith("accept_req_pay_card") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await acceptRequestCard(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads)
        return
    }

    // user has proceeded with accepting request with wallets
    else if (payload === "accept_req_pay_wallet") {
        const wallets = await getUserActiveWallets(chat.account._id);
        const slicedWallets = wallets.slice(0, 8);

        let buttons = slicedWallets.map((wallet) => [
            {
                text: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`,
                callback_data: `accept_req_pay_wallet-${wallet._id}`,
            },
        ]);

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);

        await sendButtons(chatId, lang[selectedLanguage].PICK_CURRENCY_MESSAGE, buttons);
    }

    else if (payload && payload.startsWith("accept_req_pay_wallet-")) {
        const sendingWalletId = payload.split("-")[1];

        const walletDetails = await getActiveWalletById(sendingWalletId);

        const requestDetails = await RequestPayment.findById(chat.request.request_id).populate('wallet');

        const { exchange_rate, fee, totalAmountWithFee } = await calculateExchangeAndFees(
            walletDetails.currency.code,
            requestDetails?.wallet?.currency?.code,
            parseFloat(requestDetails.amount),
            "payment_request",
            chat.account?.level._id,
            "wallet",
            walletDetails,
            "request"
        );

        let exchangedAmountSender = await getExchangeRatesToUSD(walletDetails.currency.code, 'USD', totalAmountWithFee);

        const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, walletDetails, 'sending');

        if (!sender_limits_check.status) {
            await sendMessage(chatId, sender_limits_check.message);
            return;
        }

        let message;
        if (totalAmountWithFee > walletDetails.balance.available) {
            if (walletDetails.currency.code !== requestDetails?.wallet?.currency?.code) {
                message = `
Wallet Balance: ${formattedAmount(walletDetails.balance.available)} ${walletDetails.currency.code}
    
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}
    
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${walletDetails.currency.code} = ${exchange_rate} ${requestDetails?.wallet?.currency?.code}
           
${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(parseFloat(requestDetails.amount))} ${requestDetails?.wallet?.currency?.code}
    
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}
           `;
            } else {
                message = `
Wallet Balance: ${formattedAmount(walletDetails.balance.available)} ${walletDetails.currency.code}
    
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}
    
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}
    
${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(parseFloat(requestDetails.amount))} ${requestDetails?.wallet?.currency?.code}
    
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}
           `;
            }

            const buttons = [
                [{ text: lang[selectedLanguage].ADD_FUNDS, callback_data: "add_funds" }],
                [{ text: lang[selectedLanguage].ANOTHER_WALLET_TITLE, callback_data: "accept_req_pay_wallet" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];

            await sendMessage(chatId, message);
            return await sendButtons(chatId, lang[selectedLanguage].INSUFFICIENT_BALANCE_MESSAGE, buttons);
        }

        chat.request.sending_wallet = sendingWalletId;
        await chat.save();

        const message1 = `${lang[selectedLanguage].CURRENTLY_HAVE.replace('{{amount}}', formattedAmount(walletDetails?.balance?.available)).replace('{{currency}}', walletDetails.currency.code)}\n\n${lang[selectedLanguage].PROCEED_OR_SELECT_WALLET}`;
        const buttons = [
            [{ text: lang[selectedLanguage].PROCEED_TITLE, callback_data: "accept_req_pay_wallet_proceed" }],
            [{ text: lang[selectedLanguage].ANOTHER_WALLET_TITLE, callback_data: "accept_req_pay_wallet" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message1, buttons);
    }


    // User has clicked on "Continue with this wallet"
    else if (payload === "accept_req_pay_wallet_proceed") {

        const walletDetails = await getActiveWalletById(chat.request.sending_wallet);
        const requestDetails = await RequestPayment.findById(chat.request.request_id).populate("wallet");

        const { exchange_rate, fee, totalAmountWithFee } = await calculateExchangeAndFees(
            walletDetails.currency.code,
            requestDetails?.wallet?.currency?.code,
            parseFloat(requestDetails.amount),
            "payment_request",
            chat.account?.level._id,
            "wallet",
            walletDetails,
            "request"
        );

        let message;

        if (walletDetails.currency.code !== requestDetails?.wallet?.currency?.code) {
            message = `
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}

${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}

${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${walletDetails.currency.code} = ${formattedAmount(exchange_rate, 6)} ${requestDetails?.wallet?.currency?.code}

${lang[selectedLanguage].RECIPIENT_GETS}: ${formattedAmount(parseFloat(requestDetails.amount))} ${requestDetails?.wallet?.currency?.code}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}
`;
        } else {
            message = `
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}

${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}

${lang[selectedLanguage].RECIPIENT_GETS}: ${formattedAmount(parseFloat(requestDetails.amount))} ${requestDetails?.wallet?.currency?.code}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}
`;
        }

        const buttons = [
            [{ text: lang[selectedLanguage].YES_CONTINUE_TITLE, callback_data: "accept_req_pay_wallet_continue" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, message, buttons, "accept_req_pay_wallet_continue");
    }
    // User has clicked on accept_req_pay_wallet_continue
    else if (chat?.last_message === "accept_req_pay_wallet_continue" && payload === "accept_req_pay_wallet_continue") {
        await handleOTPGenerationTG(selectedLanguage, chat, "accept_req_pay_wallet-otp", "accept_req_pay_wallet-otp", "Transaction OTP");
    }
    else if (chat.last_message === "accept_req_pay_wallet-otp" && text && !payload) {
        const otpValidationResult = await validateOTPTG(chatId, text, "accept_req_pay_wallet-otp");

        if (otpValidationResult.status) {
            const requestDetails = await RequestPayment.findOne({ $and: [{ _id: chat.request?.request_id }, { status: 'pending' }] });

            if (!requestDetails) {
                await sendMessage(chatId, lang[selectedLanguage].PAYMENT_REQUEST_STATUS);
                return;
            }

            const files = requestDetails?.attachments.map(image => ({
                key: image.key,
                url: image.url,
                ETag: image.ETag,
                status: true
            }));

            let data = {
                sender_wallet_id: chat.request?.sending_wallet,
                receiver_wallet_id: requestDetails.wallet_id,
                amount: requestDetails.amount,
                purpose: requestDetails?.purpose || "",
                type: 'wallet_to_wallet',
                payment_type: 'payment_request',
                link_id: requestDetails._id,
                description: requestDetails.description || "",
                attachments: files,
                transaction_type: "request",
                transaction_method: "wallet"
            };

            const walletToWalletResponse = await walletToWalletTransaction(data);

            if (walletToWalletResponse?.status) {
                await RequestPayment.updateOne({ _id: requestDetails._id }, { $set: { "status": 'completed' } });
                const subtitle = `${lang[selectedLanguage].TRANSACTION_ID} ${walletToWalletResponse?.data?.reference_id}`;

                await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", lang[selectedLanguage].PAYMENT_ACCEPTED_MESSAGE);
                await sendButtons(chatId, subtitle, [
                    [{ text: lang[selectedLanguage].LEAVE_REVIEW, callback_data: `accept_req_pay_rv-${requestDetails?._id}` }],
                    [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
                ], "4");

                const requestingUser = await RequestPayment.findById(chat.request?.request_id).populate('sender');
                if (requestingUser?.sender?.telegram_id && requestingUser?.sender?.telegram_bot) {
                    const requestingUserBot = await TelegramBotModel.findOne({ recipient: requestingUser?.sender?.telegram_id });
                    const requestingUserLang = requestingUserBot.selected_language || requestingUser?.sender?.language || "en";
                    const userName = chat.account?.username;

                    await sendPhoto(requestingUser?.sender?.telegram_id, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Instant.png");
                    await sendButtons(requestingUser?.sender?.telegram_id, lang[selectedLanguage].PAYMENT_ACCEPTED.replace("{{USERNAME}}", userName), [
                        [{ text: lang[requestingUserLang].CASH_OUT_NOW, callback_data: `cash_out_id_${walletToWalletResponse?.exchanged?._id}` }],
                        [{ text: lang[requestingUserLang].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
                    ], "4");
                }

            }
            else if (walletToWalletResponse?.message.includes("feature_not_available")) {
                const featureType = walletToWalletResponse?.message?.split("_")[3];
                const message = usersFeatureMessage(featureType);

                await sendButtons(chatId, message, [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]]);
            }
            else if (walletToWalletResponse?.message.includes("limit_")) {
                const limitCode = walletToWalletResponse?.message?.split("_")[1];
                const sendingAmounts = walletToWalletResponse?.sendingAmounts;
                const message = userLimitsMessage(limitCode, sendingAmounts);

                await sendButtons(chatId, message, [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]]);
            }
            else {
                await sendButtons(chatId, lang[selectedLanguage].PAYMENT_ERROR, [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]]);
            }

        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessageTG(chatId, "accept_req_pay_wallet-otp", selectedLanguage, chat?.otpType);
            }
        }
    }

    // User has clicked to add a review
    else if (payload && payload.startsWith("accept_req_pay_rv-")) {
        // TODO: add validation here that review can be added only if there is no existing review
        const reviewId = payload.split("-")[1];

        chat.request.request_id = reviewId;
        await chat.save();

        const message = lang[selectedLanguage].SHARE_EXPERIENCE;
        await sendMessage(chatId, message, "accept_req_pay_rv-1");
    }

    // User has entered a description
    else if (text && chat.last_message === "accept_req_pay_rv-1") {
        chat.request.review = text;
        await chat.save();

        const message = "Rate out of 5 ⭐";
        const buttons = [
            [{ text: "1 ⭐", callback_data: "accept_req_pay_rv-1" },
            { text: "2 ⭐", callback_data: "accept_req_pay_rv-2" },
            { text: "3 ⭐", callback_data: "accept_req_pay_rv-3" },
            { text: "4 ⭐", callback_data: "accept_req_pay_rv-4" },
            { text: "5 ⭐", callback_data: "accept_req_pay_rv-5" },]
            [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "accept_req_pay_rt");
    }
    // User has entered a rating
    else if (payload && payload.startsWith("accept_req_pay_rv-") && chat?.last_message === "accept_req_pay_rt") {
        const rating = parseInt(payload.split("-")[1]);

        chat.request.rating = rating;
        await chat.save();

        const data = {
            comment: chat?.request?.review,
            rating: rating,
            type: "instant",
            request_id: chat?.request?.request_id,
        };

        const buyerToSellerComment = await buyerToSellerReview(data);

        console.log(buyerToSellerComment, "buyerToSellerComment");

        if (buyerToSellerComment?.status) {
            const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]];
            await sendButtons(chatId, lang[selectedLanguage].THANK_YOU_MESSAGE, buttons);

            const requestDetails = await RequestPayment.findById(chat?.request?.request_id).populate([
                { path: "sender" },
                {
                    path: "receiver",
                    populate: [{ path: "user" }, { path: "company" }]
                }
            ]);



            if (requestDetails?.sender?.telegram_id && requestDetails?.sender?.telegram_bot) {

                const receiverName =
                    requestDetails?.receiver.account_type === "individual"
                        ? `${requestDetails?.receiver.user.first_name} ${requestDetails?.receiver.user.last_name}`
                        : requestDetails?.receiver?.company?.company_name;

                const message1 = `
${lang[selectedLanguage].REVIEW_ADDED_MESSAGE_FROM} from ${receiverName} ${lang[selectedLanguage].FOR_THE_PAYMENT_REQUEST} ${requestDetails?.reference_id} ${lang[selectedLanguage].OF} ${formattedAmount(requestDetails?.amount?.toFixed(2))} ${requestDetails?.currency.code}
        `;

                const buttons1 = [
                    [{ text: "Give a review", callback_data: `accept_req_pay_rv2-${chat?.request?.request_id}` }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                ];
                await sendButtons(requestDetails?.sender?.telegram_id, message1, buttons1);
            }
        } else {
            const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]];
            await sendButtons(chatId, buyerToSellerComment?.message, buttons);
        }
    }
    // Seller to Buyer Review
    else if (payload && payload.startsWith("accept_req_pay_rv2-")) {
        console.log("Second review flow triggered");

        const requestId = payload.split("-")[1];
        chat.request.request_id = requestId;
        await chat.save();

        const message = lang[selectedLanguage].ADD_DESCRIPTION_AS_REVIEW;
        await sendMessage(chatId, message, "accept_req_pay_rt2");
    }
    // User has entered a description
    else if (chat.last_message === "accept_req_pay_rt2" && text) {
        chat.request.review = text;
        await chat.save();

        const message = "Rate out of 5 ⭐";
        const buttons = [
            [{ text: "1 ⭐", callback_data: "accept_req_pay_rate-1" }],
            [{ text: "2 ⭐", callback_data: "accept_req_pay_rate-2" }],
            [{ text: "3 ⭐", callback_data: "accept_req_pay_rate-3" }],
            [{ text: "4 ⭐", callback_data: "accept_req_pay_rate-4" }],
            [{ text: "5 ⭐", callback_data: "accept_req_pay_rate-5" }],
            [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "accept_req_pay_rt2_1");
    }
    // User has entered a rating
    else if (payload && payload.startsWith("accept_req_pay_rate-") && chat?.last_message === "accept_req_pay_rt2_1") {
        const rating = parseInt(payload.split("-")[1]);

        chat.request.rating = rating;
        console.log(rating, "rating");
        await chat.save();

        const data = {
            comment: chat?.request?.review,
            rating: rating,
            type: "instant",
            request_id: chat?.request?.request_id
        };

        const sellerToBuyer = await sellerToBuyerReview(data);
        console.log(sellerToBuyer, "sellerToBuyer");

        if (sellerToBuyer?.status) {
            const requestingUser = await RequestPayment.findById(chat?.request?.request_id)
                .populate(['receiver', 'buyer_comment']);

            const message = `
${lang[selectedLanguage].REVIEW_ADDED_MESSAGE}

${lang[selectedLanguage].REQUEST_REFERENCE}: ${requestingUser?.reference_id}
${lang[selectedLanguage].BUYER_REVIEW}: ${requestingUser?.buyer_comment?.comment || "N/A"}
${lang[selectedLanguage].BUYER_RATING}: ${generateRatingStars(requestingUser?.buyer_comment?.rating)}
        `;

            const buttons = [
                [{ text: lang[selectedLanguage].REPLY_TO_REVIEW, callback_data: `accept_req_pay_rply-${requestingUser?.buyer_comment?._id}` }],
                [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
            ];
            await sendButtons(chatId, message, buttons);

            if (requestingUser?.receiver?.telegram_id && requestingUser?.receiver?.telegram_bot) {
                const sendingUser = await RequestPayment.findById(chat?.request?.request_id).populate("sender");

                const message1 = `
    ${lang[selectedLanguage].REVIEW_ADDED_PAYMENT_REQUEST} ${sendingUser?.sender?.username}.
    
    ${lang[selectedLanguage].REVIEW}: ${chat?.request?.review}
    ${lang[selectedLanguage].RATING}: ${generateRatingStars(rating)}
        `;

                console.log(message1, "message1");

                const buttons1 = [
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];

                await sendButtons(requestingUser?.receiver?.telegram_id, message1, buttons1);
            }

        } else {
            const message = lang[selectedLanguage].REVIEW_ERROR;
            const buttons = [
                [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
            ];
            await sendButtons(chatId, sellerToBuyer?.message || message, buttons);
        }
    }
    // A reply to review button has been clicked
    else if (payload && payload.startsWith("accept_req_pay_rply-")) {
        const commentId = payload.split("-")[1];
        chat.request.comment_to_reply = commentId;
        console.log(commentId, "commentId");

        await chat.save();

        await sendMessage(chatId, lang[selectedLanguage].ADD_REPLY_BELOW, "accept_req_pay_rply");
    }
    // A reply to review has been added
    else if (chat.last_message === "accept_req_pay_rply" && text) {
        const data = {
            reply: text,
            buyer_comment_id: chat?.request?.comment_to_reply
        };
        console.log(data, "dataforreply");

        const replyToBuyer = await sellerToBuyerReply(data);
        console.log(replyToBuyer, "replyToBuyer");

        if (replyToBuyer?.status) {
            const requestedReview = await RequestReview.findById(data?.buyer_comment_id).populate(["buyer", "seller"]);
            // const buyerTelegramId = await TelegramBotModel.findOne({ recipient:  });

            console.log("starts", requestedReview, "end");

            const message1 = `
${lang[selectedLanguage].REVIEW_REPLY_ADDED} ${requestedReview?.seller?.username}.

${lang[selectedLanguage].YOUR_REVIEW}: ${requestedReview?.comment}
${lang[selectedLanguage].YOUR_RATING}: ${generateRatingStars(requestedReview?.rating)}
Reply: ${text}
        `;

            const message2 = lang[selectedLanguage].REPLY_ADDED;

            const buttons = [
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];

            await sendMessage(requestedReview?.buyer?.telegram_id, message1);
            await sendButtons(chatId, message2, buttons);
        } else {
            const message = lang[selectedLanguage].REPLY_ERROR;
            const buttons = [
                [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
            ];
            await sendButtons(chatId, replyToBuyer?.message || message, buttons);
        }
    }


}

module.exports = { acceptRequest }