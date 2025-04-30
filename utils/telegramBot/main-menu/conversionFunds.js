const Wallet = require("../../../models/Wallet.model");
const { sendButtons, sendMessage, sendPhoto } = require("../../telegramBotUtils")
const lang = require("../../../utils/languages/languages.json");
const { getUserActiveWallets, calculateExchangeAndFees } = require("../../helpers");
const currencyToEmoji = require('../../../utils/currencyEmojis.json');
const { formattedAmount, walletToWalletTransaction } = require("../../InstaChatbotHelpers");
const { validateAmount } = require("../../instaChatbotUtils");
const { invalidMessageTG, validateOTPTG, handleOTPGenerationTG } = require("../telegramOTPHandler");

async function convertFunds(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    if (payload === "convert_funds") {
        const wallets = await getUserActiveWallets(chat.account._id);
        const slicedWallets = wallets.slice(0, 7);

        if (wallets.length > 1) {
            const buttons = slicedWallets.map(wallet => [{
                text: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`,
                callback_data: `convert_funds-${wallet._id}`
            }]);
            buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);

            await sendButtons(chatId, lang[selectedLanguage].PICK_CURRENCY_PROMPT, buttons, "convert_funds");
        } else {
            const buttons = [
                [{ text: lang[selectedLanguage].ADD_CURRENCY, callback_data: "add_currency" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];

            await sendButtons(chatId, "You do not have multiple currencies available for conversion!\nPlease add your desired currency by clicking below", buttons);
        }
    }

    else if (payload?.startsWith("convert_funds-") && chat.last_message === "convert_funds") {
        const walletId = payload.split('-')[1];
        const walletDetails = await Wallet.findById(walletId);

        chat.wallet_to_wallet.sending_wallet = walletId;
        await chat.save();

        const message = `${lang[selectedLanguage].CURRENTLY_HAVE.replace('{{amount}}', formattedAmount(walletDetails?.balance?.available)).replace('{{currency}}', walletDetails.currency.code)}\n\n${lang[selectedLanguage].PROCEED_OR_SELECT_WALLET}`;
        const buttons = [
            [{ text: lang[selectedLanguage].PROCEED_TITLE, callback_data: "convert_funds_proceed" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons);
    }

    else if (payload === "convert_funds_proceed") {
        const wallets = await getUserActiveWallets(chat.account._id);
        const slicedWallets = wallets.slice(0, 8);

        const filteredWallets = slicedWallets.filter(wallet => !chat?.wallet_to_wallet?.sending_wallet.equals(wallet._id));

        const buttons = filteredWallets.map(wallet => [{
            text: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`,
            callback_data: `convert_funds2-${wallet._id}`
        }]);
        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);

        await sendButtons(chatId, lang[selectedLanguage].PICK_DEBIT_CURRENCY_PROMPT, buttons);
    }

    else if (payload?.startsWith("convert_funds2-")) {
        const walletId = payload.split('-')[1];

        chat.wallet_to_wallet.converting_wallet = walletId;
        await chat.save();

        await sendMessage(chatId, lang[selectedLanguage].ENTER_AMOUNT_MESSAGE, "convert_funds_amount");
    }

    else if (chat?.last_message === "convert_funds_amount" && text && !payload) {
        const { status, message: validationMessage, amount } = validateAmount(text, selectedLanguage);

        if (!status) {
            await sendMessage(chatId, validationMessage);
            return;
        }

        const senderWalletDetails = await Wallet.findById(chat.wallet_to_wallet.sending_wallet);
        const receiverWalletDetails = await Wallet.findById(chat.wallet_to_wallet.converting_wallet);

        console.log({ senderWalletDetails })

        const { exchange_rate, fee, totalAmountWithFee, recipient_amount } = await calculateExchangeAndFees(
            senderWalletDetails.currency.code, receiverWalletDetails.currency.code, amount, "conversion", chat.account?.level._id, "wallet", senderWalletDetails, "instant"
        );

        if (totalAmountWithFee > senderWalletDetails.balance.available) {
            await sendMessage(chatId, lang[selectedLanguage].INSUFFICIENT_BALANCE);
            const insufficientButtons = [
                [{ text: lang[selectedLanguage].ADD_FUNDS, callback_data: "add_funds" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
            return await sendButtons(chatId, lang[selectedLanguage].INSUFFICIENT_BALANCE, insufficientButtons);
        }

        chat.wallet_to_wallet.amount = amount
        await chat.save()

        let message = `${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${senderWalletDetails.currency.code}\n\n`;

        if (senderWalletDetails.currency.code !== receiverWalletDetails.currency.code) {
            message += `${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${senderWalletDetails.currency.code} = ${exchange_rate} ${receiverWalletDetails.currency.code}\n`;
        }

        message += `${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${senderWalletDetails.currency.code}\n\n`;
        message += `${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(recipient_amount)} ${receiverWalletDetails.currency.code}\n`;
        message += `${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${senderWalletDetails.currency.code}`;

        const buttons = [
            [{ text: lang[selectedLanguage].PROCEED_TITLE, callback_data: "convert_funds_confirm" }],
            [{ text: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, callback_data: "convert_funds_adjust" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "wallet_overview" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "convert_funds_confirm");

    }

    else if (payload === "convert_funds_adjust") {
        await sendMessage(chatId, lang[selectedLanguage].ENTER_AMOUNT_MESSAGE, "convert_funds_amount");
    }

    // user has proceeded with conversion
    else if (payload === "convert_funds_confirm" && chat?.last_message === "convert_funds_confirm") {
        await handleOTPGenerationTG(selectedLanguage, chat, "convert_funds-otp", "convert_funds-otp", "Transaction OTP");
    }
    else if (chat.last_message === "convert_funds-otp" && text) {

        const otpValidationResult = await validateOTPTG(chatId, text, "convert_funds-otp");

        if (otpValidationResult.status) {
            const receivingDetails = await Wallet.findById(chat.wallet_to_wallet.converting_wallet);

            const data = {
                receiver_wallet_id: receivingDetails?.wallet_id,
                sender_wallet_id: chat.wallet_to_wallet.sending_wallet,
                purpose: "",
                amount: chat.wallet_to_wallet.amount,
                type: "",
                payment_type: "conversion",
                description: "",
                attachments: [],
                transaction_method: "wallet"
            };

            const walletToWalletResponse = await walletToWalletTransaction(data);
            console.log(walletToWalletResponse, "walletToWalletResponse");

            const subtitles = `\n${lang[selectedLanguage].TRANSACTION_ID} ${walletToWalletResponse?.data?.reference_id}\nConversion: ${walletToWalletResponse?.data?.currency.code} to ${walletToWalletResponse?.exchanged?.currency.code}\n${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${walletToWalletResponse?.data?.currency.code} = ${formattedAmount(walletToWalletResponse?.data?.exchange_rate_markup, 6)}\nSending: ${formattedAmount(walletToWalletResponse?.data?.amount)} ${walletToWalletResponse?.data?.currency.code}\nReceiving: ${formattedAmount(walletToWalletResponse?.exchanged?.amount)} ${walletToWalletResponse?.exchanged?.currency.code}\n${lang[selectedLanguage].STATUS}: ${lang[selectedLanguage].COMPLETED}`;

            if (walletToWalletResponse.status) {
                await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", lang[selectedLanguage].CONVERSION_SUCCESS_TITLE);
                await sendButtons(chatId, `${subtitles}`, [
                    [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
                ]);
            } else if (walletToWalletResponse?.message.includes("feature_not_available")) {
                const featureType = walletToWalletResponse?.message?.split("_")[3];
                const message = usersFeatureMessage(featureType);
                await sendButtons(chatId, message, [
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ], "4");
            } else if (walletToWalletResponse?.message.includes("limit_")) {
                const limitCode = walletToWalletResponse?.message?.split("_")[1];
                const sendingAmounts = walletToWalletResponse?.sendingAmounts;
                const message = userLimitsMessage(limitCode, sendingAmounts);
                await sendButtons(chatId, message, [
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ], "4");
            } else {
                await sendButtons(chatId, `${lang[selectedLanguage].CONVERSION_FAILED_TITLE}\n\n${lang[selectedLanguage].TRY_AGAIN_OR_CONTACT_SUPPORT_SUBTITLE}`, [
                    [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
                ], "4");
            }
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessageTG(chatId, "convert_funds-otp", selectedLanguage, chat.otpType);
            }
        }
    }


}

module.exports = { convertFunds }