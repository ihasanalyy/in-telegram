const TelegramBot = require("../models/TelegramBot.model");
const accountRegisteration = require("../utils/telegramBot/account-registeration/accountRegisteration");
const changeLanguage = require("../utils/telegramBot/changeLanguage");
const telegramConnection = require("../utils/telegramBot/connection/connection");
const { sendPhoto, sendButtons, sendMessage, mainMenuKeyboardMessage, sendAnimation, sendVideo, registerMenuKeyboardMessage } = require("../utils/telegramBotUtils");
const lang = require("../utils/languages/languages.json");
const { isTimeDifferenceGreaterThan30Minutes, createTransactionInfo, fetchWithdrawalsCounties } = require("../utils/instaChatbotUtils");
const { initiatePayment } = require("../utils/telegramBot/main-menu/initiate-payment");
const { initiateIntlTransfer } = require("../utils/telegramBot/intl-payment/main");
const { handleOTPGenerationTG } = require("../utils/telegramBot/telegramOTPHandler");
const { initiateW2W } = require("../utils/telegramBot/w2w/main");
const { requestMoney } = require("../utils/telegramBot/payment-request/main");
const { acceptRequest } = require("../utils/telegramBot/payment-request/acceptRequest");
const Transaction = require("../models/Transaction.model");
const { getUserActiveWallets, getActiveWallet, getCardDetails, formatVCCTransaction } = require("../utils/helpers");
const { walletOverviewText, formattedAmount, declinePaymentRequest } = require("../utils/InstaChatbotHelpers");
const { currencyRequest } = require("../utils/telegramBot/main-menu/requestCurrency");
const { convertFunds } = require("../utils/telegramBot/main-menu/conversionFunds");
const VirtualCardModel = require("../models/Virtual-Card.model");
const { VVCCreation } = require("../utils/telegramBot/vvc/cardCreation");
const { VCCTopup } = require("../utils/telegramBot/vvc/VCCTopup");
const { initiateAirtime } = require("../utils/telegramBot/airtime/main");
const currencyToEmoji = require('../utils/currencyEmojis.json');
const jwt = require("jsonwebtoken");
const { qrQuickPay } = require("../utils/telegramBot/main-menu/qrPay");
const { cardToCardTransfer } = require("../utils/telegramBot/vvc/cardToCardTransfer");
const { w2wAddFunds } = require("../utils/telegramBot/w2w-add-funds/main");
const { withdrawal } = require("../utils/telegramBot/withdrawal/main");
const RequestPayment = require("../models/Request-Payment.model");
const { quotation } = require("../utils/telegramBot/quotation/main");
const Quotation = require("../models/Quotation.model");
const { acceptQuotation } = require("../utils/telegramBot/quotation/quotationAccept");
const VCCTransactionModel = require("../models/VCC-Transaction.model");

const telegramWebhook = async (data) => {
    let chatId;
    const currentTime = new Date();

    let text_message = null;
    let callback_query = null;
    let edited_message = null;
    let image_payloads = [];
    let video_payloads = [];

    if (data.message) {
        if (data.message.text) {
            text_message = data.message.text;
            console.log('Text Message:', text_message);
        }
        if (data.message.photo) {
            image_payloads = data.message.photo.map(photo => ({
                file_id: photo.file_id,
                caption: data.message.caption || null
            }));
            console.log('Image Payloads:', image_payloads);
        }
        if (data.message.video) {
            video_payloads = [{
                file_id: data.message.video.file_id,
                caption: data.message.caption || null,
                mime_type: data.message.video.mime_type
            }];
            console.log('Video Payloads:', video_payloads);
        }
        chatId = data.message.chat.id.toString()
    } else if (data.callback_query) {
        callback_query = data.callback_query.data;
        chatId = data.callback_query.message.chat.id.toString()
        console.log('Callback Query:', callback_query);
    }
    // else if (data.edited_message) {
    //     edited_message = data.edited_message.text;
    //     console.log('Edited Message:', edited_message);
    // } else {
    //     console.log('Unknown update type:', data);
    // }

    let chat = await TelegramBot.findOne({ recipient: chatId }).populate([{ path: 'account', populate: "level" }])
    let selectedLanguage = chat?.selected_language || chat?.account?.language || 'en'

    if (chat) {

        // check if account is active
        if (chat?.account) {
            if (!chat?.account?.active || chat?.account?.status !== "active") {
                await sendMessage(chatId, 'This InstaPay account is not active right now!');
                return;
            }
        }

        // time expiry
        const lastMessageCheck = isTimeDifferenceGreaterThan30Minutes(chat.last_message_time)
        console.log({ lastMessageCheck })

        if ((chat?.account_connected && (chat?.loggedOut ?? false)) || lastMessageCheck) {
            //  if the account is not connected, then set the last message to connect
            if (!chat?.account_connected) {
                if (chat?.registeration && Object.keys(chat?.registeration).length > 0) {
                    chat.registeration = {}
                    await chat.save()
                }
                await sendMessage(chatId, 'Your session has been expired!', "connect");
                const buttonText = "How can we help you today? Let's get started!🚀👇"
                const buttons = [
                    [{ text: lang[selectedLanguage].CONNECT_BUTTON_TITLE, callback_data: "connect_account" }],
                    [{ text: lang[selectedLanguage].REGISTER_BUTTON_TITLE, callback_data: "register" }],
                    [{ text: lang[selectedLanguage].CHANGE_LANGUAGE, callback_data: "language_change" }],
                ];
                await sendButtons(chatId, buttonText, buttons);
            } else {
                // if the account is connected, check for PIN requirements
                if (chat?.account?.pin && chat?.account?.pin_status) {
                    // Session Expired: Prompt to enter PIN
                    const message = "Session Expired!\n\nFor security reasons, your chatbot session has been terminated. Please tap below to enter your PIN and reactivate your session securely.";
                    const buttons = [
                        [{
                            text: "Enter PIN",
                            url: `https://my.insta-pay.ch/verify-bot-pin/${chat?.account?._id}/telegram`
                        }]
                    ];
                    await sendButtons(chatId, message, buttons);
                } else {
                    // PIN Setup Required: Prompt to set up PIN
                    const message = "Pin Setup Required!\n\nTo continue using InstaPay services, please set a secure 4-digit PIN for your account. This will help keep your transactions safe and secure.";
                    const buttons = [
                        [{
                            text: "Setup PIN",
                            url: `https://my.insta-pay.ch/set-account-pin/${chat?.account?._id}/telegram`
                        }]
                    ];
                    await sendButtons(chatId, message, buttons);
                }
            }

            // if the user has been logged out by expiry time, then we will set the loggged out flag manually
            if (lastMessageCheck) {
                chat.loggedOut = true
            }

            chat.last_message_time = currentTime;
            await chat.save();
            return
        }

        chat.last_message_time = currentTime;
        await chat.save();
    } else {
        chat = new TelegramBot({
            recipient: chatId,
            last_message_time: currentTime,
            last_message: "connect",
            account_connected: false,
            selected_language: "en",
            registeration: {}
        });
        await chat.save();

        const buttonText = "How can we help you today? Let's get started!🚀👇"
        const message = `Hi ${data?.message?.chat?.first_name || data?.callback_query?.message?.chat?.first_name}! 🎉 Welcome to the InstaPay Telegram channel! 💬`;
        const buttons = [
            [{ text: lang[selectedLanguage].CONNECT_BUTTON_TITLE, callback_data: "connect_account" }],
            [{ text: lang[selectedLanguage].REGISTER_BUTTON_TITLE, callback_data: "register" }],
            [{ text: lang[selectedLanguage].CHANGE_LANGUAGE, callback_data: "language_change" }],
        ];
        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/welcome1.png", message);
        await sendButtons(chatId, buttonText, buttons);
        return
    }

    // connection process
    const isTelegramConnection = Object.keys(lang).some(langKey => text_message === lang[langKey].CONNECT_BUTTON_TITLE);
    if (
        ((text_message && chat.last_message?.startsWith("connect"))
            || (callback_query?.startsWith("connect") && chat.last_message?.startsWith("connect"))
            || isTelegramConnection)
        && !chat?.account_connected
    ) {
        await telegramConnection(chatId, callback_query, chat, text_message, selectedLanguage, data)
        return
    }

    // registeration process
    const isRegisteration = Object.keys(lang).some(langKey => text_message === lang[langKey].REGISTER_BUTTON_TITLE);
    if (
        (text_message && chat.last_message?.startsWith("register") && !chat?.account_connected)
        || (callback_query?.startsWith("register") && ((chat.last_message?.startsWith("register") || chat.last_message === "connect")) && !chat?.account_connected)
        || (chat?.account_connected &&
            ["register_0.7", "register_nousername", "register_0.8", "register_notimezone"].includes(chat.last_message))
        || (!chat?.account_connected &&
            isRegisteration)
    ) {
        await accountRegisteration(chatId, callback_query, chat, text_message, selectedLanguage, data, isRegisteration)
        return
    }

    // change language process
    const isChangeLanguage = Object.keys(lang).some(langKey => text_message === lang[langKey].CHANGE_LANGUAGE);
    if (((text_message && chat.last_message?.startsWith("language")) || callback_query?.startsWith("language")) || isChangeLanguage) {
        await changeLanguage(chatId, callback_query, chat, text_message, selectedLanguage, isChangeLanguage)
        return
    }

    // account check before proceeding to the further main menu options
    if (!chat?.account_connected) {
        if (chat?.registeration && Object.keys(chat?.registeration).length > 0) {
            chat.registeration = {}
            await chat.save()
        }
        const buttonText = "How can we help you today? Let's get started!🚀👇"
        const buttons = [
            [{ text: lang[selectedLanguage].CONNECT_BUTTON_TITLE, callback_data: "connect_account" }],
            [{ text: lang[selectedLanguage].REGISTER_BUTTON_TITLE, callback_data: "register" }],
            [{ text: lang[selectedLanguage].CHANGE_LANGUAGE, callback_data: "language_change" }],
        ];
        return await sendButtons(chatId, buttonText, buttons);
    }


    if (callback_query === "main_menu") {
        return await mainMenuKeyboardMessage(chatId, selectedLanguage, chat)
    }

    // OTP Related process
    if (callback_query === "send_code_via_sms") {
        if (chat.last_message === "intl_transfer_card_payment-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "intl_transfer_card_payment-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "intl_transfer_w2w-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "intl_transfer_w2w-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "intl_transfer_paypal_payment-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "intl_transfer_paypal_payment-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "convert_funds-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "convert_funds-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "accept_req_pay_wallet-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "accept_req_pay_wallet-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "accept_req_pay_card-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "accept_req_pay_card-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "accept_req_pay_ppl-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "accept_req_pay_ppl-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "req_pay-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "req_pay-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "w2w_card-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "w2w_card-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "w2w_paypal-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "w2w_paypal-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "w2w_ip_w_instant_confirm-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "w2w_ip_w_instant_confirm-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "w2w_ip_w_schedule-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "w2w_ip_w_schedule-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "vcc_add_funds_ip-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "vcc_add_funds_ip-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "activate_vcc_v_s_a_ip_w-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "activate_vcc_v_s_a_ip_w-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "activate_vcc_v_p_a_ip_w-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "activate_vcc_v_p_a_ip_w-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "activate_vcc_v_s_a_ppl-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "activate_vcc_v_s_a_ppl-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "activate_vcc_v_p_a_ppl-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "activate_vcc_v_p_a_ppl-otp", chat.last_message, "Transaction OTP", true);
        } else if (chat.last_message?.startsWith("airtime_ip_confirm_purchase-otp")) {
            const airtimeType = chat.last_message?.split("-").pop()
            console.log(airtimeType, "airtimeType")
            await handleOTPGenerationTG(selectedLanguage, chat, `airtime_ip_confirm_purchase-otp-${airtimeType}`, chat.last_message, "Transaction OTP", true);
        } else if (chat.last_message?.startsWith("airtime_paypal_confirm-otp")) {
            const airtimeType = chat.last_message?.split("-").pop()
            console.log(airtimeType, "airtimeType")
            await handleOTPGenerationTG(selectedLanguage, chat, `airtime_paypal_confirm-otp-${airtimeType}`, chat.last_message, "Transaction OTP", true);
        } else if (chat.last_message?.startsWith("airtime_card_confirm_purchase-otp")) {
            const airtimeType = chat.last_message?.split("-").pop()
            console.log(airtimeType, "airtimeType")
            await handleOTPGenerationTG(selectedLanguage, chat, `airtime_card_confirm_purchase-otp-${airtimeType}`, chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "vcc_transfer-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "vcc_transfer-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "quotation_confirm-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "quotation_confirm-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "quotation_bargain-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "quotation_bargain-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "quotation_revise_quot-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "quotation_revise_quot-otp", chat.last_message, "Transaction OTP", true);
        }
        else if (chat.last_message === "withdrawal_default-otp") {
            await handleOTPGenerationTG(selectedLanguage, chat, "withdrawal_default-otp", chat.last_message, "Transaction OTP", true);
        }
        return
    }

    // handling the resending the OTP
    if (callback_query && callback_query?.startsWith("resend_otp_")) {

        const context = callback_query.replace("resend_otp_", "");

        await handleOTPGenerationTG(selectedLanguage, chat, context, "", context === "confirm_verification" ? "Signup OTP Code" : "Transaction OTP", true);
        return
    }

    // logout process
    // const isLogout = Object.keys(lang).some(langKey => text_message === lang[langKey].LOGOUT);
    if ((text_message && text_message === "🔒 Logout")) {
        let lastMessage = ""
        if (chat?.last_message === "connect" || chat?.last_message?.startsWith("connect") || chat?.last_message?.startsWith("register") || !chat?.last_message) {
            lastMessage = "connect"
        } else {
            lastMessage = "4"
        }
        chat.loggedOut = true;
        await chat.save()
        return await sendMessage(chatId, 'You have been logged out successfully.', lastMessage);
    }

    // initiate_payment process
    const isInitiatePayment = Object.keys(lang).some(langKey => text_message === lang[langKey].INITIATE_PAYMENT);
    if ((text_message && (chat.last_message?.startsWith("i_p") || isInitiatePayment))
        || (callback_query?.startsWith("initiate_payment"))
        || (callback_query === "initiate_payment")) {
        await initiatePayment(chatId, callback_query, chat, text_message, selectedLanguage, isInitiatePayment);
        return;
    }

    // international payment process
    if ((text_message && chat.last_message?.startsWith("intl_transfer"))
        || (callback_query?.startsWith("intl_transfer") && chat.last_message?.startsWith("intl_transfer"))
        || (callback_query === "intl_transfer")
        || (chat.last_message?.startsWith("intl_transfer") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await initiateIntlTransfer(chatId, callback_query, chat, text_message, selectedLanguage, data, image_payloads, video_payloads)
        return
    }
    // w2w payment process
    if ((text_message && chat.last_message?.startsWith("w2w"))
        || (callback_query?.startsWith("w2w") && chat.last_message?.startsWith("w2w"))
        || (callback_query === "w2w")
        || (chat.last_message?.startsWith("w2w") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await initiateW2W(chatId, callback_query, chat, text_message, selectedLanguage, data, image_payloads, video_payloads)
        return
    }
    // w2w payment process
    if ((text_message && chat.last_message?.startsWith("airtime"))
        || (callback_query?.startsWith("airtime") && chat.last_message?.startsWith("airtime"))
        || (callback_query === "airtime")
        || (chat.last_message?.startsWith("airtime") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await initiateAirtime(chatId, callback_query, chat, text_message, selectedLanguage, data, image_payloads, video_payloads)
        return
    }

    // declining payment request
    if (callback_query?.startsWith("decline_req_pay-")) {
        const requestId = callback_query.split('-')[1];

        const paymentRequest = await RequestPayment.findById(requestId).populate("sender");

        // checking if the current account and request receiver is authorised to declice the request
        if (paymentRequest?.receiver?.toString() !== chat.account._id.toString()) {
            return await sendButtons(chatId, "You are not authorised to decline this request", [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]]);
        }

        if (paymentRequest?.status === "completed") {
            const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
            await sendButtons(chatId, lang[selectedLanguage].PAYMENT_REQUEST_COMPLETED, buttons);
        } else if (paymentRequest?.status === "cancelled") {
            const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
            await sendButtons(chatId, lang[selectedLanguage].PAYMENT_REQUEST_CANCELLED, buttons);
        } else {
            const declinedQuotationDetails = await declinePaymentRequest(requestId);

            if (declinedQuotationDetails.status) {
                // Notify the user who declined the request
                const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]];
                const message = lang[selectedLanguage].DECLINED_CONFIRMATION_MESSAGE;

                await sendButtons(chatId, message, buttons);

                // Notify the sender
                const senderChatId = paymentRequest?.sender?.telegram_id;
                const senderMessage = `${lang[selectedLanguage].PAYMENT_REQUEST_DECLINED_MESSAGE} ${account.username}!`;

                await sendButtons(senderChatId, senderMessage, buttons);
            } else {
                const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
                await sendButtons(chatId, lang[selectedLanguage].DECLINE_ERROR_MESSAGE, buttons);
            }
        }
        return
    }

    // setting up payment request process
    if ((text_message && chat.last_message?.startsWith("req_pay"))
        || (callback_query?.startsWith("req_pay") && chat.last_message?.startsWith("req_pay"))
        || (callback_query === "req_pay")
        || (chat.last_message?.startsWith("req_pay") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await requestMoney(chatId, callback_query, chat, text_message, selectedLanguage, data, image_payloads, video_payloads)
        return
    }

    // accepting payment request process
    if ((text_message && chat.last_message?.startsWith("accept_req_pay"))
        || (callback_query?.startsWith("accept_req_pay") && chat.last_message?.startsWith("accept_req_pay"))
        || (callback_query?.includes("accept_req_pay-"))
        || (chat.last_message?.startsWith("accept_req_pay") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await acceptRequest(chatId, callback_query, chat, text_message, selectedLanguage, data, image_payloads, video_payloads)
        return
    }

    // quotation view details
    if (callback_query?.startsWith("quotation_details-")) {
        const quotationId = callback_query.split("-")[1];
        const quotation = await Quotation.findById(quotationId).populate(["amount_reciever_currency", "reciever"]);

        console.log({ quotation });

        const message = `
            Quotation ID: ${quotation?.reference_id}\n
${lang[selectedLanguage].AMOUNT}: ${formattedAmount(quotation?.revised_amount || quotation?.amount)} ${quotation.amount_reciever_currency.currency.code}\n
${lang[selectedLanguage].TITLE}: ${quotation?.title}\n
${lang[selectedLanguage].DESCRIPTION}: ${quotation?.desc || "N/A"}\n                   
${lang[selectedLanguage].BARGAIN}: ${quotation?.bargain ? lang[selectedLanguage].ALLOWED : lang[selectedLanguage].NOT_ALLOWED}
            `;

        await sendMessage(quotation?.reciever?.telegram_id, message);

        if (quotation?.images?.length > 0) {
            const attachments = quotation.images;

            if (attachments?.length > 0) {
                for (const attachment of attachments) {
                    const fileName = attachment.key.split('/').pop();
                    const fileType = fileName.split('.').pop();
                    if (fileType === "mp4") {
                        await sendVideo(quotation?.reciever?.telegram_id, attachment?.url);
                    } else {
                        await sendPhoto(quotation?.reciever?.telegram_id, attachment?.url);
                    }
                }
            }
        }

        return
    }

    // setting up the quotation
    if ((text_message && chat.last_message?.startsWith("quotation_accept"))
        || (callback_query?.startsWith("quotation_accept") && chat.last_message?.startsWith("quotation_accept"))
        || (callback_query?.startsWith("quotation_accept-"))
        || (chat.last_message?.startsWith("quotation_accept") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await acceptQuotation(chatId, callback_query, chat, text_message, selectedLanguage, data, image_payloads, video_payloads)
        return
    }

    // setting up the quotation
    if ((text_message && chat.last_message?.startsWith("quotation"))
        || (callback_query?.startsWith("quotation") && chat.last_message?.startsWith("quotation"))
        || (callback_query === ("quotation"))
        || (callback_query === ("quotation_bargain-"))
        || (callback_query === ("quotation_new_amount_accept-"))
        || (chat.last_message?.startsWith("quotation") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await quotation(chatId, callback_query, chat, text_message, selectedLanguage, data, image_payloads, video_payloads)
        return
    }


    // withdrawal request
    if (callback_query && callback_query.includes("cash_out_id")) {
        // First, check if the user has any withdrawal channel
        const countries = await fetchWithdrawalsCounties(chat.account._id);

        console.log(countries, "countries");

        if (!countries?.countries?.length) {
            const message = lang[selectedLanguage].NO_WITHDRAWAL_ACCOUNT_STEPS;

            const buttons = [
                [{ text: lang[selectedLanguage].OPEN_INSTAPAY_APP, url: "https://my.insta-pay.ch/login" }],
                [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }],
            ];

            await sendButtons(chatId, message, buttons);
            return;
        }

        let transaction_id;

        if (callback_query) {
            const parts = callback_query.split("_");
            if (parts.length > 3) {
                transaction_id = parts[3];
            }
        }

        console.log(transaction_id, "transaction_id");

        const transactionDetails = await await Transaction.findById(transaction_id);

        // account validation if transactions' account and current account matches
        if (transactionDetails.account.toString() !== chat.account._id.toString()) {
            return await sendButtons(chatId, "This transaction does not belong to you", [[{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]]);
        }

        chat.withdrawal.transaction_id = transaction_id;
        await chat.save();

        const message = "Where would you like to cash out?";

        const buttons = [
            [{ text: "Default Account", callback_data: "withdrawal_default" }],
            [{ text: "Specify Account", callback_data: "withdrawal_specify" }],
        ];

        return await sendButtons(chatId, message, buttons);
    }

    // accepting payment request process
    if ((text_message && chat.last_message?.startsWith("withdrawal_"))
        || (callback_query?.startsWith("withdrawal_") && chat.last_message?.startsWith("withdrawal_"))
        || (callback_query === "withdrawal_default")
        || (callback_query === "withdrawal_another")
        || (callback_query === "withdrawal_specify")) {
        await withdrawal(chatId, callback_query, chat, text_message, selectedLanguage)
        return
    }

    // KYC verification flow
    else if (callback_query === "kyc_verification") {
        const message = `
To verify your identity, please follow the below steps.
 
1⃣ Login to InstaPay web portal.\n
2️⃣ Go to settings page and select "Identity verification" option from sub-menu.\n
3⃣ Type in the requested information and click "Start verification" button.
 `;

        await sendMessage(chatId, message);

        const buttons = [
            [
                {
                    text: lang[selectedLanguage].LOGIN,
                    url: "https://my.insta-pay.ch/login",
                },
            ],
            [
                {
                    text: lang[selectedLanguage].MAIN_MENU,
                    callback_data: "main_menu",
                },
            ],
        ];

        return await sendButtons(chatId, lang[selectedLanguage].CLICK_TO_LOG_IN, buttons);
    }
    // my mastercard flow
    if (text_message === "💳 My Mastercard" || callback_query === "vcc_menu") {
        const vvcs = await VirtualCardModel.find({ account: chat.account._id })
        if (vvcs.length !== 0) {
            await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Payment%20Card.png",)
            const message = `🌟 Welcome to Your MasterCard Menu!🌟  

Here, you can effortlessly manage your MasterCard and perform a variety of transactions with ease. 💳✨  

Simply select your preferred option below to get started! ⬇️`

            const buttons = [
                [{ text: "Card Overview", callback_data: "vcc_overview" }],
                [{ text: "Add Funds", callback_data: "vcc_add_funds" }],
                [{ text: "Card to Card Transfer", callback_data: "vcc_transfer" }],
                [{ text: "Card to Wallet Transfer", callback_data: "vcc_wallet_transfer" }],
                [{ text: "View Transactions", callback_data: "vcc_transactions" }],
                [{ text: "Add Additonal Card", callback_data: "activate_vcc_11" }],
            ];
            return await sendButtons(chatId, message, buttons, "4")
        } else {
            await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Payment%20Card.png",)
            const message = `💳 Choose Your InstaPay Card! 

Instant global transactions, flexible payment options, and Apple Pay readiness—anytime, anywhere!

🔹 Accepted worldwide – Use your card wherever Mastercard is accepted 🌍
🔹 Instant card-to-card transfers – Send money seamlessly in seconds
🔹 International money transfers – Send and receive funds globally 💳
🔹 Apple Pay Ready – Tap & pay instantly from your iPhone 📲
🔹 Google Pay coming soon! Stay tuned for Android users 

🔥 Activate now & experience borderless payments!🔥`

            const buttons = [
                [{ text: "Choose & Activate! 🚀", callback_data: "activate_vcc" }],
                [{ text: "Go back 🔙", callback_data: "main_menu" }],
            ];
            return await sendButtons(chatId, message, buttons, "4")
        }
    }

    else if (callback_query === "activate_vcc_11") {
        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Payment%20Card.png",)
        const message = `💳 Expand Your InstaPay Experience! 🌟  

Easily generate an additional InstaPay MasterCard for your friends and family or to use for specific transactions. Whether you want to share financial flexibility with loved ones or keep your expenses organized, creating a new card is quick and hassle-free! 🚀✨  

Get started now and enjoy seamless payments with InstaPay! 🔥`

        const buttons = [
            [{ text: "Get Started!", callback_data: "activate_vcc" }],
            [{ text: "My Mastercard", callback_data: "vcc_menu" }],
        ];
        return await sendButtons(chatId, message, buttons)
    }

    // activate card flow
    if ((text_message && chat.last_message?.startsWith("activate_vcc"))
        || (callback_query?.startsWith("activate_vcc") && chat.last_message?.startsWith("activate_vcc"))
        || (callback_query === "activate_vcc")
        || (chat.last_message?.startsWith("activate_vcc") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await VVCCreation(chatId, callback_query, chat, text_message, selectedLanguage, data, image_payloads, video_payloads)
        return
    }

    // add funds in card flow
    if ((text_message && chat.last_message?.startsWith("vcc_add_funds"))
        || (callback_query?.startsWith("vcc_add_funds") && chat.last_message?.startsWith("vcc_add_funds"))
        || (callback_query === "vcc_add_funds")
        || (chat.last_message?.startsWith("vcc_add_funds") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await VCCTopup(chatId, callback_query, chat, text_message, selectedLanguage)
        return
    }

    // VCC Overview
    if (callback_query === "vcc_overview") {
        const vvcs = await VirtualCardModel.find({ account: chat.account._id });

        if (vvcs.length !== 0) {
            let cardOverviewText = "";
            let validCards = 0; // to track if we have at least one valid card

            for (const card of vvcs) {
                const cardDetails = await getCardDetails(card._id);
                console.log({ cardDetails })

                if (!cardDetails.status) continue; // skip if details are not available

                validCards++; // increment for valid cards (valida cards are those that have a response from vccdaddy api)

                cardOverviewText += `🌟 Card Type: ${cardDetails.subscription_type === "virtual" ? "Virtual" : "Physical"}\n`;
                cardOverviewText += `💳 Card Package: ${cardDetails.type?.includes("premium") ? "Premium" : "Standard"}\n`;
                cardOverviewText += `🔢 Card Number: *****${cardDetails.last4?.slice(-4)}\n`;
                cardOverviewText += `💱 Card Currency: ${cardDetails.currency}\n`;
                cardOverviewText += `💰 Card Balance: ${formattedAmount(cardDetails.balance)} ${cardDetails.currency}\n`;
                cardOverviewText += `\n-----------------------\n\n`;
            }

            if (validCards > 0) {
                const buttons = [
                    [{ text: "My MasterCard ", callback_data: "vcc_menu" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];
                await sendButtons(chatId, cardOverviewText, buttons, "vcc_overview");
            } else {
                await sendButtons(chatId, "No valid cards found!", [[{ text: "Go back 🔙", callback_data: "vcc_menu" }]]);
            }
        } else {
            await sendButtons(chatId, "No cards found!", [[{ text: "Go back 🔙", callback_data: "vcc_menu" }]]);
        }
        return
    }

    // VCC transactions
    if (callback_query === "vcc_transactions") {
        const transactions = await VCCTransactionModel.find({ accountId: chat.account._id })
            .populate({
                path: "senderCard",
                select: "last4 expiry type account",
                populate: { path: "account", select: "first_name last_name" }
            })
            .populate({
                path: "receiverCard",
                select: "last4 expiry type account",
                populate: { path: "account", select: "first_name last_name" }
            })
            .sort({ createdAt: -1 })
            .limit(5);

        if (transactions.length !== 0) {
            let message = "Transactions 👇\n\n";
            for (const transaction of transactions) {
                message += await formatVCCTransaction(transaction) + "\n";
            }

            const buttons = [
                [{ text: "My MasterCard ", callback_data: "vcc_menu" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                [{ text: lang[selectedLanguage].LOGIN, url: "https://my.insta-pay.ch/login" }]
            ]

            await sendButtons(chatId, message, buttons);
        } else {
            await sendButtons(chatId, "No transactions found!", [[{ text: "Go back 🔙", callback_data: "vcc_menu" }]]);
        }
        return
    }

    // card to card transfer
    if ((text_message && chat.last_message?.startsWith("vcc_transfer"))
        || (callback_query?.startsWith("vcc_transfer") && chat.last_message?.startsWith("vcc_transfer"))
        || (callback_query === "vcc_transfer")
        || (chat.last_message?.startsWith("vcc_transfer") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await cardToCardTransfer(chatId, callback_query, chat, text_message, selectedLanguage)
        return
    }

    const myQrCodes = Object.keys(lang).some(langKey => text_message === lang[langKey].MY_QR_CODE)
    if (myQrCodes) {
        const wallets = await getUserActiveWallets(chat.account._id)
        const slicedWallets = wallets.slice(0, 8);

        const buttons = slicedWallets.map(wallet => ([{
            text: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`,
            callback_data: `my_qrcode-${wallet.wallet_id}`
        }]));

        return await sendButtons(chatId, lang[selectedLanguage].PICK_CURRENCY_MESSAGE, buttons);
    }

    if (callback_query?.startsWith('my_qrcode-')) {
        const walletName = callback_query.split('-')[1];
        const walletDetails = await getActiveWallet(walletName)

        if (walletDetails?.qrCode?.url) {
            await sendPhoto(chatId, walletDetails?.qrCode?.url, `${walletDetails.currency.code} ${lang[selectedLanguage].QR_Code} ☝`);

            const buttons = [{
                text: lang[selectedLanguage].MAIN_MENU,
                callback_data: "main_menu"
            }];

            return await sendButtons(chatId, lang[selectedLanguage].MAIN_MENU, buttons);
        } else {
            const tokenPayload = {
                wallet_id: walletDetails?.wallet_id,
                account_id: chat.account._id
            };

            const token = jwt.sign(tokenPayload, secretKey, { expiresIn: '10m' });
            const activationUrl = `https://my.insta-pay.ch/qr-activate?token=${token}&platform=telegram`;
            const message = `Your QR code for ${walletDetails?.currency.code} is not activated yet.`;

            const buttons = [
                [{
                    text: `Activate ${walletDetails?.currency.code} QR code`,
                    url: activationUrl
                }],
                [{
                    text: lang[selectedLanguage].MAIN_MENU,
                    callback_data: "main_menu"
                }]
            ];

            return await sendButtons(chatId, message, buttons);
        }
    }

    // qr pay flow
    const qrPay = Object.keys(lang).some(langKey => text_message === lang[langKey].QR_QUICKPAY)
    console.log({ qrPay })
    if (qrPay || callback_query === "qr_pay") {
        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/QR%20QuickPay.png")
        const buttons = [
            [{ text: lang[selectedLanguage].ALPHANUMERIC_CODE_TITLE, callback_data: "qr_pay_alpha" }],
            [{ text: lang[selectedLanguage].SCAN_QR_CODE_TITLE, url: `https://my.insta-pay.ch/quick-qrpay?bot=telegram&bot_id=${chat.recipient}` }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        return await sendButtons(chatId, lang[selectedLanguage].QR_PROMPT_MESSAGE, buttons);
    }

    if ((text_message && chat.last_message?.startsWith("qr_pay"))
        || (callback_query?.startsWith("qr_pay") && chat.last_message?.startsWith("qr_pay"))
        || (callback_query === "qr_pay_alpha")
        || (callback_query === "qr_pay_code")
        || (chat.last_message?.startsWith("qr_pay") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await qrQuickPay(chatId, callback_query, chat, text_message, selectedLanguage, data, image_payloads, video_payloads)
        return
    }


    // my instapay wallets transactions
    const isMyTransactions = Object.keys(lang).some(langKey => text_message === lang[langKey].MY_TRANSACTIONS);
    if (isMyTransactions) {
        const limit = 5;
        const transactions = await Transaction.find({
            account: chat.account._id,
            $or: [{ hidden: { $exists: false } }, { hidden: false }]
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate([
                { path: 'account', select: 'user company', populate: [{ path: 'user', select: 'first_name last_name' }, { path: 'company', select: 'company_name' }] },
                { path: 'sender', select: 'user company first_name last_name', populate: [{ path: 'user', select: 'first_name last_name' }, { path: 'company', select: 'company_name' }] },
                { path: 'receiver', select: 'user company first_name last_name', populate: [{ path: 'user', select: 'first_name last_name' }, { path: 'company', select: 'company_name' }] }
            ]);

        const totalTransactions = await Transaction.countDocuments({ account: chat.account._id });
        const transactionsInfo = await Promise.all(transactions.map(transaction => createTransactionInfo(transaction, selectedLanguage)));
        const message = `${lang[selectedLanguage].TRANSACTIONS_MESSAGE}\n\n${transactionsInfo.join('\n')}`;

        let buttons = [
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        if (totalTransactions > limit) {
            buttons.unshift([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `next_transactions-${limit}-${limit}` }]);
        }

        return await sendButtons(chatId, message, buttons, "my_transactions");
    }
    if ((callback_query?.startsWith("next_transactions-") || callback_query?.startsWith("prev_transactions-")) && chat.last_message === "my_transactions") {
        const [_, skip, limit] = callback_query.split('-').map(Number);

        const transactions = await Transaction.find({
            account: chat.account._id,
            $or: [{ hidden: { $exists: false } }, { hidden: false }]
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate([
                { path: 'account', select: 'user company first_name last_name', populate: [{ path: 'user', select: 'first_name last_name' }, { path: 'company', select: 'company_name' }] },
                { path: 'sender', select: 'user company first_name last_name', populate: [{ path: 'user', select: 'first_name last_name' }, { path: 'company', select: 'company_name' }] },
                { path: 'receiver', select: 'user company first_name last_name', populate: [{ path: 'user', select: 'first_name last_name' }, { path: 'company', select: 'company_name' }] }
            ]);

        const totalTransactions = await Transaction.countDocuments({ account: chat.account._id });
        const transactionsInfo = await Promise.all(transactions.map(transaction => createTransactionInfo(transaction, selectedLanguage)));
        const message = `${transactionsInfo.join('\n')}`;

        let buttons = [
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        if (skip > 0) {
            buttons.unshift([{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: `prev_transactions-${Math.max(skip - limit, 0)}-${limit}` }]);
        }

        if (totalTransactions > skip + limit) {
            buttons.unshift([{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `next_transactions-${skip + limit}-${limit}` }]);
        }

        return await sendButtons(chatId, message, buttons);
    }

    // wallet overview
    const isWalletOverview = Object.keys(lang).some(langKey => text_message === lang[langKey].WALLET_OVERVIEW);
    if (isWalletOverview || callback_query === "wallet_overview") {
        const wallets = await getUserActiveWallets(chat.account._id)

        if (wallets.length > 0) {
            const messages = await walletOverviewText(wallets, selectedLanguage);

            for (let message of messages) {
                const buttons = [
                    [{ text: lang[selectedLanguage].ADD_FUNDS, callback_data: "w_add_funds" }],
                    [{ text: lang[selectedLanguage].CONVERT_FUNDS, callback_data: "convert_funds" }],
                    [{ text: lang[selectedLanguage].ADD_CURRENCY, callback_data: "add_currency" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                ];
                await sendButtons(chatId, message, buttons);
            }
            return
        } else {
            const message =
                "Your InstaPay Digital Wallets are being created. Please try again later.\nIf the issue persists, please reach out to our support team.";

            const buttons = [
                [{ text: "Contact Support", callback_data: "assistance" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
            ];

            return await sendButtons(chatId, message, buttons);
        }
    }

    // add currency flow
    if ((text_message && chat.last_message?.startsWith("add_currency"))
        || (callback_query?.startsWith("add_currency") && chat.last_message?.startsWith("add_currency"))
        || (callback_query === "add_currency")
        || (chat.last_message?.startsWith("add_currency") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await currencyRequest(chatId, callback_query, chat, text_message, selectedLanguage, data, image_payloads, video_payloads)
        return
    }

    // conversion flow
    if ((text_message && chat.last_message?.startsWith("convert_funds"))
        || (callback_query?.startsWith("convert_funds") && chat.last_message?.startsWith("convert_funds"))
        || (callback_query === "convert_funds")
        || (chat.last_message?.startsWith("convert_funds") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await convertFunds(chatId, callback_query, chat, text_message, selectedLanguage, data, image_payloads, video_payloads)
        return
    }

    // conversion flow
    if ((text_message && chat.last_message?.startsWith("w_add_funds"))
        || (callback_query?.startsWith("w_add_funds") && chat.last_message?.startsWith("w_add_funds"))
        || (callback_query === "w_add_funds")
        || (chat.last_message?.startsWith("w_add_funds") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await w2wAddFunds(chatId, callback_query, chat, text_message, selectedLanguage, data, image_payloads, video_payloads)
        return
    }


    // if there is a request to add a payment card
    if (callback_query === "add_payment_card") {
        const backButton = callback_query?.split("-")[1];

        const message = lang[selectedLanguage].SECURITY_ADVISORY;
        const buttons = [
            [{ text: lang[selectedLanguage].LOGIN, url: "https://my.insta-pay.ch/login" }],
            [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }],
        ];

        if (chat.last_message !== "4") {
            buttons.push([{ text: lang[selectedLanguage].BACK_TITLE, callback_data: backButton || "main_menu" }]);
        }

        return await sendButtons(chatId, message, buttons);
    }

    // if there is any random text or button, then show main manu
    if ((text_message && !callback_query && chat.last_message === "4") || (callback_query === "main_menu")) {
        return await mainMenuKeyboardMessage(chatId, selectedLanguage, chat)
    }
}

module.exports = { telegramWebhook }