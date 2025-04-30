const { sendButtons, sendMessage, sendPhoto, processVideoUploads, processImageUploads, handleBeneficiaries } = require("../../telegramBotUtils");
const lang = require("../../../utils/languages/languages.json");
const { validateAmount, balanceLimitCheck, formatDateToDDMMYYYY, getCountryNameByCode, usersFeatureMessage, userLimitsMessage } = require("../../instaChatbotUtils");
const { formattedAmount, addQuotation, bargain, declineQuotation, walletToWalletTransaction } = require("../../InstaChatbotHelpers");
const countries = require('../../../utils/countryIso.json');
const countryToEmoji = require('../../../utils/countryEmojis.json');
const PanModel = require("../../../models/Pan.model");
const currencyToEmoji = require('../../../utils/currencyEmojis.json');
const Beneficiary = require("../../../models/Beneficiary.model");
const Account = require("../../../models/Account.model");
const { getUserActiveWallets, getActiveWalletById, calculateExchangeAndFees } = require("../../helpers");
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler");
const TelegramBotModel = require("../../../models/TelegramBot.model");
const moment = require('moment-timezone');
const Quotation = require("../../../models/Quotation.model");
const Wallet = require("../../../models/Wallet.model");
const { acceptQuotationPaypal } = require("./quotationAcceptPaypal");
const { acceptQuotationCard } = require("./quotationAcceptCard");

async function acceptQuotation(chatId, payload, chat, text, selectedLanguage) {
    if (payload?.startsWith("quotation_accept-")) {

        const quotation = await Quotation.findById(payload.split("-")[1]);

        // validate if the current quotation belongs to you
        if (quotation?.reciever.toString() !== chat.account._id.toString()) {
            await sendButtons(chatId, lang[selectedLanguage].QUOTE_NOT_BELONG, [
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ]);
            return;
        }

        chat.quotation.accepting_quotation = quotation._id
        await chat.save()

        if (
            quotation?.status !== "sent" &&
            quotation?.status !== "bargain-accepted" &&
            quotation?.status !== "revise"
        ) {
            await sendMessage(chatId, lang[selectedLanguage].QUOTE_IN_PROCESS);
            await sendButtons(chatId, lang[selectedLanguage].CHOOSE_OPTION, [
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ]);
        }
        else {
            const pans = await PanModel.find({ account: chat.account._id });
            let buttons = [];

            if (pans.length !== 0) {
                buttons = [
                    [{ text: lang[selectedLanguage].PAYMENT_CARD, callback_data: "quotation_accept_card" }],
                    [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "quotation_accept_wallets_payment" }],
                    [{ text: lang[selectedLanguage].PAYPAL, callback_data: "quotation_accept_paypal" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];
            } else {
                buttons = [
                    [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "quotation_accept_wallets_payment" }],
                    [{ text: lang[selectedLanguage].PAYPAL, callback_data: "quotation_accept_paypal" }],
                    [{ text: lang[selectedLanguage].ADD_PAYMENT_CARD, callback_data: "add_payment_card-back_quot]" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];
            }

            await sendButtons(chatId, lang[selectedLanguage].SELECT_PAYMENT_METHOD, buttons, "quotation_accept_methods");

        }
    }

    // user has selected to accept the quotation using paypal
    else if ((text && chat.last_message?.startsWith("quotation_accept_paypal"))
        || (payload?.startsWith("quotation_accept_paypal") && chat.last_message?.startsWith("quotation_accept_paypal"))
        || (payload === "quotation_accept_paypal")
        || (chat.last_message?.startsWith("quotation_accept_paypal") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await acceptQuotationPaypal(chatId, payload, chat, text, selectedLanguage)
    }

    // user has selected to accept the quotation using card
    else if ((text && chat.last_message?.startsWith("quotation_accept_card"))
        || (payload?.startsWith("quotation_accept_card") && chat.last_message?.startsWith("quotation_accept_card"))
        || (payload === "quotation_accept_card")
        || (chat.last_message?.startsWith("quotation_accept_card") && (image_payloads.length > 0 || video_payloads.length > 0))) {
        await acceptQuotationCard(chatId, payload, chat, text, selectedLanguage)
    }

    // If user has selected accepting quotation with InstaPay wallets
    else if (payload === "quotation_accept_wallets_payment" && chat?.last_message === "quotation_accept_methods") {
        const wallets = await getUserActiveWallets(chat.account._id)
        const limitedWallets = wallets.slice(0, 8);

        let buttons = limitedWallets.map((wallet) => [
            { text: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, callback_data: `quotation_accept_wallet-${wallet._id}` },
        ]);

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]);

        const message = lang[selectedLanguage].SELECT_WALLET_PAY;
        await sendButtons(chatId, message, buttons, 'quotation_accept_wallets_payment');
    }

    // Second user has selected wallet
    else if (payload && payload.startsWith("quotation_accept_wallet-") && (chat?.last_message === "quotation_accept_wallets_payment" || chat?.last_message === "quotation_accept_proceed")) {
        const walletId = payload.split("-")[1];
        const walletDetails = await getActiveWalletById(walletId);
        console.log(walletDetails, "walletDetails");

        const quotation = await Quotation.findById(chat.quotation.accepting_quotation).populate("amount_reciever_currency");
        console.log(quotation, "quotation");

        const { exchange_rate, fee, totalAmountWithFee } = await calculateExchangeAndFees(
            walletDetails.currency.code,
            quotation.amount_reciever_currency.currency.code,
            parseFloat(quotation?.revised_amount || quotation?.amount),
            "quotation",
            chat.account?.level._id,
            "wallet",
            walletDetails,
            "request"
        );

        let message;
        if (totalAmountWithFee > walletDetails.balance.available) {
            if (walletDetails.currency.code !== quotation.amount_reciever_currency.currency.code) {
                message = `
Wallet Balance: ${formattedAmount(walletDetails.balance.available)} ${walletDetails.currency.code}

${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}

${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${walletDetails.currency.code} = ${formattedAmount(exchange_rate, 6)} ${quotation.amount_reciever_currency.currency.code}
       
${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(quotation?.revised_amount || quotation.amount)} ${quotation.amount_reciever_currency.currency.code}
    
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}
            `;
            } else {
                message = `
Wallet Balance: ${formattedAmount(walletDetails.balance.available)} ${walletDetails.currency.code}

${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}

${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}

${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(quotation?.revised_amount || quotation.amount)} ${quotation.amount_reciever_currency.currency.code}
    
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}
            `;
            }

            const buttons = [
                [{ text: lang[selectedLanguage].ADD_FUNDS, callback_data: "w_add_funds" }],
                [{ text: lang[selectedLanguage].ANOTHER_WALLET_TITLE, callback_data: "quotation_accept_another_wallet" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
            ];

            await sendMessage(chatId, message);
            return await sendButtons(chatId, lang[selectedLanguage].INSUFFICIENT_BALANCE_MESSAGE, buttons);
        }

        chat.quotation.accepting_currency = walletId;
        await chat.save();

        const message1 = `${lang[selectedLanguage].CURRENTLY_HAVE.replace("{{amount}}", formattedAmount(walletDetails?.balance?.available)).replace("{{currency}}", walletDetails.currency.code)}\n\n${lang[selectedLanguage].PROCEED_OR_SELECT_WALLET}`;

        const buttons = [
            [{ text: lang[selectedLanguage].PROCEED_TITLE, callback_data: "quotation_accept_proceed" }],
            [{ text: lang[selectedLanguage].ANOTHER_WALLET_TITLE, callback_data: "quotation_accept_another_wallet" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, message1, buttons, "quotation_accept_proceed");
    }

    else if (payload === "quotation_accept_another_wallet" && (chat?.last_message === "quotation_accept_wallets_payment" || chat?.last_message === "quotation_accept_proceed")) {
        const wallets = await getUserActiveWallets(chat.account_id);
        const slicedWallets = wallets.slice(0, 8);

        let buttons = slicedWallets.map((wallet) => {
            return [
                {
                    text: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`,
                    callback_data: `quotation_accept_wallet-${wallet._id}`,
                },
            ];
        });

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]);

        await sendButtons(chatId, lang[selectedLanguage].PICK_CURRENCY_MESSAGE, buttons);
    }

    else if (payload === "quotation_accept_proceed" && chat?.last_message === "quotation_accept_proceed") {
        const walletDetails = await getActiveWalletById(chat.quotation.accepting_currency);

        const quotation = await Quotation.findById(chat.quotation.accepting_quotation)
            .populate("amount_reciever_currency");

        const { exchange_rate, fee, totalAmountWithFee } = await calculateExchangeAndFees(
            walletDetails.currency.code,
            quotation.amount_reciever_currency.currency.code,
            parseFloat(quotation?.revised_amount || quotation.amount),
            "quotation",
            chat.account?.level._id,
            "wallet",
            walletDetails,
            "request"
        );

        let message;

        if (walletDetails.currency.code !== quotation.amount_reciever_currency.currency.code) {
            message = `
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${walletDetails.currency.code} = ${formattedAmount(exchange_rate, 6)} ${quotation.amount_reciever_currency.currency.code}
    
${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(quotation?.revised_amount || quotation.amount)} ${quotation.amount_reciever_currency.currency.code}
    
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}
            `;
        } else {
            message = `
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}
    
${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(quotation?.revised_amount || quotation.amount)} ${quotation.amount_reciever_currency.currency.code}
    
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}
            `;
        }

        const buttons = [
            [{ text: lang[selectedLanguage].YES_CONTINUE_TITLE, callback_data: "quotation_accept_confirm" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "quotation_accept_confirm");
    }
    else if (payload === "quotation_accept_confirm" && chat?.last_message === "quotation_accept_confirm") {
        await handleOTPGenerationTG(selectedLanguage, chat, "quotation_accept_w-otp", "quotation_accept_w-otp", "Transaction OTP");
    }

    else if (chat.last_message === "quotation_accept_w-otp" && text) {
        const otpValidationResult = await validateOTPTG(chatId, text, "quotation_accept_w-otp");

        if (otpValidationResult.status) {
            const quotationDetails = await Quotation.findOne({
                _id: chat.quotation.accepting_quotation,
                status: { $nin: ['accepted', 'declined'] }
            });

            if (!quotationDetails) {
                await sendMessage(chatId, lang[selectedLanguage].QUOTATION_ALREADY_PROCESSED, "4");
                return;
            }

            let amount = quotationDetails.revised_amount || quotationDetails.amount;
            const receiver_Wallet = await getActiveWalletById(quotationDetails.amount_reciever_currency);

            const files = quotationDetails?.images.map(image => ({
                key: image.key,
                url: image.url,
                ETag: image.ETag,
                status: true
            }));

            let data = {
                sender_wallet_id: chat.quotation.accepting_currency,
                receiver_wallet_id: receiver_Wallet?.wallet_id,
                amount,
                purpose: quotationDetails.purpose || "",
                type: 'wallet_to_wallet',
                payment_type: 'quotation',
                link_id: quotationDetails._id,
                description: quotationDetails.desc,
                attachments: files,
                transaction_type: "request",
                transaction_method: "wallet"
            };

            const walletToWalletResponse = await walletToWalletTransaction(data);

            if (walletToWalletResponse.status) {
                await Quotation.findByIdAndUpdate(chat.quotation.accepting_quotation, { $set: { status: 'accepted' } });
                const quotationSender = await Account.findById(quotationDetails?.sender);
                const currencyDetails = await Wallet.findById(quotationDetails?.amount_reciever_currency);

                const quotationInfo = `\nQuotation ID: ${quotationDetails.reference_id}\n${lang[selectedLanguage].AMOUNT}: ${formattedAmount(amount.toFixed(2))} ${currencyDetails?.currency.code}\nUsername: ${quotationSender?.username}\n${lang[selectedLanguage].TITLE}: ${quotationDetails?.title}\n`;

                await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", lang[selectedLanguage].QUOTE_ACCEPTED)
                await sendButtons(chatId, quotationInfo, [
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ], "4");

                if (quotationSender?.telegram_id && quotationSender?.telegram_bot) {
                    const senderBot = await TelegramBotModel.findOne({ recipient: quotationSender?.telegram_id });
                    const receiverLang = senderBot?.selected_language || quotationSender?.language || "en";
                    const userName = chat.account?.username;
                    const receiverMessage = lang[selectedLanguage].QUOTE_ACCEPTED_SUCCESS.replace("{{username}}", userName); //Hassan
                    await sendPhoto(quotationSender?.telegram_id, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", receiverMessage);
                    await sendButtons(quotationSender?.telegram_id, quotationInfo, [
                        [{ text: lang[receiverLang].CASH_OUT_NOW, callback_data: `cash_out_id_${walletToWalletResponse?.exchanged?._id}` }],
                        [{ text: lang[receiverLang].MAIN_MENU, callback_data: "main_menu" }]
                    ], "4");
                }

            }
            else if (walletToWalletResponse?.message.includes("feature_not_available")) {
                const featureType = walletToWalletResponse?.message?.split("_")[3];
                const message = usersFeatureMessage(featureType);
                await sendButtons(chatId, message, [
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ], "4");
            }
            else if (walletToWalletResponse?.message.includes("limit_")) {
                const limitCode = walletToWalletResponse?.message?.split("_")[1];
                const sendingAmounts = walletToWalletResponse?.sendingAmounts;
                const message = userLimitsMessage(limitCode, sendingAmounts);
                await sendButtons(chatId, message, [
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ], "4");
            }
            else {
                await sendButtons(chatId, lang[selectedLanguage].TRANSACTION_ERROR, [
                    [{ text: lang[selectedLanguage].CHECK_WALLET_BALANCE, callback_data: "wallet_overview" }],
                    [{ text: lang[selectedLanguage].CONTACT_SUPPORT, callback_data: "assistance" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ], "4");
            }

        }
        else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {
                await invalidMessageTG(chatId, "quotation_accept_w-otp", selectedLanguage, chat?.otpType);
            }
        }
    }

}

module.exports = { acceptQuotation }