const { sendButtons, sendPhoto, getFileFromTelegram, verifyQrCodeTelegram, sendMessage, somethingWentWrongQuickReplyTelegram } = require("../../telegramBotUtils");
const lang = require("../../../utils/languages/languages.json");
const currencyToEmoji = require('../../../utils/currencyEmojis.json');

const { getActiveWallet, getUserActiveWallets, getActiveWalletById, calculateExchangeAndFees, fetchLocalOrDefaultWalletConditionally, getExchangeRatesToUSD } = require("../../helpers");
const { walletToWalletTransaction, formattedAmount } = require("../../InstaChatbotHelpers");
const PanModel = require("../../../models/Pan.model");
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler");
const { usersFeatureMessage, userLimitsMessage } = require("../../instaChatbotUtils");
const { checkTransactionLimitsForSender } = require("../../conversion");
const jwt = require("jsonwebtoken");
const { initiateW2WPaypalTransactionHelper } = require("../../chatbot/w2w/paypal/w2wUsingPaypal");

async function qrQuickPay(chatId, payload, chat, text, selectedLanguage, data, image_payloads) {

    let defaultWallet;
    if (payload?.includes("paypal") || payload?.includes("card") || chat.last_message?.includes("paypal") || chat.last_message?.includes("card")) {
        defaultWallet = await fetchLocalOrDefaultWalletConditionally(chat.account._id)
    }

    if (payload === "qr_pay_alpha") {
        await sendMessage(chatId, lang[selectedLanguage].ENTER_ALPHANUMERIC_CODE_MESSAGE, "qr_pay_alpha");
    }

    // user has entered alphanumeric code
    else if (!payload && text && chat.last_message === "qr_pay_alpha") {
        const wallet = await getActiveWallet(text.toUpperCase())

        if (wallet) {
            if (wallet?.account?._id.toString() === chat.account?._id.toString()) {
                const buttons = [
                    [{ text: lang[selectedLanguage].SCAN_AGAIN, url: `https://my.insta-pay.ch/quick-qrpay?bot=telegram&bot_id=${chat.recipient}` }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];
                return await sendButtons(chatId, lang[selectedLanguage].SEND_MONEY_TO_SELF, buttons);
            }

            const userName = wallet?.account?.account_type === "individual"
                ? `${wallet?.account?.first_name} ${wallet?.account?.last_name}`
                : wallet?.account?.company_name;

            const walletInfo = `
${lang[selectedLanguage].USERNAME_LABEL}: ${userName}
${lang[selectedLanguage].COUNTRY_LABEL}: ${wallet.account.country_name}
${lang[selectedLanguage].WALLET_NAME}: ${wallet.wallet_id}
${lang[selectedLanguage].WALLET_CURRENCY_LABEL}: ${wallet.currency.code}
            `;

            const buttons = [
                [{ text: lang[selectedLanguage].YES, callback_data: "qr_pay_yes" }],
                [{ text: lang[selectedLanguage].NO, callback_data: "qr_pay" }],
                [{ text: lang[selectedLanguage].SEND_AGAIN, callback_data: "qr_pay_alpha" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];

            chat.wallet_to_wallet.receiving_wallet = wallet.wallet_id;
            await chat.save();
            await sendButtons(chatId, walletInfo, buttons, "qr_pay_yes");
        } else {
            const buttons = [
                [{ text: lang[selectedLanguage].SEND_AGAIN, callback_data: "qr_pay_alpha" }],
                [{ text: lang[selectedLanguage].SCAN_QR_CODE_TITLE, url: `https://my.insta-pay.ch/quick-qrpay?bot=telegram&bot_id=${chat.recipient}` }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];

            await sendButtons(chatId, lang[selectedLanguage].INVALID_CODE, buttons);
        }
    }

    // user has asked to submit qr code
    else if (payload === "qr_pay_code" || payload === "rescan_qr_pay") {
        await sendMessage(chatId, lang[selectedLanguage].SUBMIT_QR_CODE_IMAGE, "qr_pay_code");
    }
    // If there is a QR code image (NOTE: this flow is deprecated, now we are scanning the qr from browser)
    else if (chat?.last_message === "qr_pay_code" && image_payloads.length > 0) {

        const walletVerification = await verifyQrCodeTelegram(image_payloads);

        if (walletVerification?.status) {
            const wallet = await getActiveWallet(walletVerification?.walletId);

            if (wallet) {
                if (wallet?.account?._id.toString() === chat.account?._id.toString()) {
                    return await sendButtons(chatId, lang[selectedLanguage].SEND_MONEY_TO_SELF, [
                        [{ text: lang[selectedLanguage].SCAN_AGAIN, url: `https://my.insta-pay.ch/quick-qrpay?bot=telegram&bot_id=${chat.recipient}` }],
                        [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                    ]);
                }

                const userName = wallet?.account?.account_type === "individual"
                    ? `${wallet?.account?.first_name} ${wallet?.account?.last_name}`
                    : wallet?.account?.company_name;

                const subtitleMsg = `
${lang[selectedLanguage].USERNAME_LABEL}: ${wallet?.account?.username}
${lang[selectedLanguage].COUNTRY_LABEL}: ${wallet?.account?.country_name}
${lang[selectedLanguage].WALLET_ID} ${wallet.wallet_id}
${lang[selectedLanguage].WALLET_CURRENCY_LABEL}: ${wallet.currency.code}
        `;

                chat.wallet_to_wallet.receiving_wallet = walletVerification?.walletId;
                await chat.save();

                await sendButtons(chatId, `${userName}\n${subtitleMsg}\n\n${lang[selectedLanguage].PROCEED}`, [
                    [{ text: lang[selectedLanguage].YES, callback_data: "qr_pay_yes" }],
                    [{ text: lang[selectedLanguage].NO, callback_data: "qr_pay" }],
                    [{ text: lang[selectedLanguage].SCAN_AGAIN, url: `https://my.insta-pay.ch/quick-qrpay?bot=telegram&bot_id=${chat.recipient}` }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                ], "qr_pay_yes");
            } else {
                await sendButtons(chatId, lang[selectedLanguage].INVALID_QR_CODE, [
                    [{ text: lang[selectedLanguage].SCAN_AGAIN, url: `https://my.insta-pay.ch/quick-qrpay?bot=telegram&bot_id=${chat.recipient}` }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                ]);
            }
        } else {
            await sendButtons(chatId, lang[selectedLanguage].INVALID_QR_CODE, [
                [{ text: lang[selectedLanguage].ALPHANUMERIC_CODE_TITLE, callback_data: "qr_pay_alpha" }],
                [{ text: lang[selectedLanguage].SCAN_AGAIN, url: `https://my.insta-pay.ch/quick-qrpay?bot=telegram&bot_id=${chat.recipient}` }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
            ]);
        }

    }
    else if (payload === "qr_pay_yes" && chat?.last_message === "qr_pay_yes") {
        const pans = await PanModel.find({ account: chat.account._id });

        const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD;
        let buttons = [];

        if (pans.length !== 0) {
            buttons = [
                [{ text: lang[selectedLanguage].PAYMENT_CARD, callback_data: "qr_pay_card" }],
                [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "qr_pay_ip" }],
                [{ text: lang[selectedLanguage].PAYPAL, callback_data: "qr_pay_paypal" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
        } else {
            buttons = [
                [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "qr_pay_ip" }],
                [{ text: lang[selectedLanguage].PAYPAL, callback_data: "qr_pay_paypal" }],
                [{ text: lang[selectedLanguage].ADD_PAYMENT_CARD, callback_data: "add_payment_card-qr_pay_yes" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];
        }

        await sendButtons(chatId, message, buttons, "qr_pay_methods");
    }

    // If user proceeds with InstaPay wallets
    else if (chat.last_message === "qr_pay_methods" && payload === "qr_pay_ip") {
        const wallets = await getUserActiveWallets(chat.account._id);
        const slicedWallets = wallets.slice(0, 8);

        let buttons = slicedWallets.map((wallet) => {
            return [
                {
                    text: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`,
                    callback_data: `qr_pay_ip-${wallet._id}`,
                },
            ];
        });

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);

        await sendButtons(chatId, lang[selectedLanguage].PICK_CURRENCY_DEBITED, buttons, "qr_pay_ip");
    }
    else if (payload?.startsWith("qr_pay_ip-") && chat.last_message === "qr_pay_ip") {
        const wallet_id = payload.split("-")[1];
        chat.wallet_to_wallet.sending_wallet = wallet_id;
        await chat.save();

        const receiverWallet = await getActiveWallet(chat.wallet_to_wallet.receiving_wallet);

        await sendMessage(chatId, lang[selectedLanguage].ENTER_AMOUNT_CURRENCY.replace('{{currency}}', receiverWallet.currency.code), "qr_pay_ip_amount");
    }

    // If user sends the amount to make the QR payment
    else if (chat.last_message === "qr_pay_ip_amount" && text && !payload) {
        const digitRegex = /^\d+(\.\d+)?$/;
        const isNumber = digitRegex.test(text);
        const amount = parseFloat(text);
        const walletDetails = await getActiveWalletById(chat.wallet_to_wallet.sending_wallet);
        const receivingWallet = await getActiveWallet(chat.wallet_to_wallet.receiving_wallet);

        if (isNumber && amount >= 0.1) {
            chat.wallet_to_wallet.amount = amount;
            await chat.save();

            const { exchange_rate, fee, totalAmountWithFee } = await calculateExchangeAndFees(
                walletDetails.currency.code,
                receivingWallet?.currency?.code,
                amount,
                "qr_pay",
                chat.account?.level._id,
                "wallet",
                walletDetails,
                "request"
            );

            let message;
            if (walletDetails.currency.code !== receivingWallet.currency.code) {
                message = `
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${walletDetails.currency.code} = ${formattedAmount(exchange_rate, 6)} ${receivingWallet.currency.code}

${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(amount)} ${receivingWallet.currency.code}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}
            `;
            } else {
                message = `
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}

${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(amount)} ${receivingWallet.currency.code}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}
            `;
            }

            if (totalAmountWithFee > walletDetails.balance.available) {
                await sendMessage(chatId, message);
                const buttons1 = [
                    [{ text: lang[selectedLanguage].ADD_FUNDS, callback_data: "add_funds" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                ];
                return await sendButtons(chatId, lang[selectedLanguage].INSUFFICIENT_BALANCE, buttons1);
            }

            const buttons = [
                [{ text: lang[selectedLanguage].YES_CONTINUE_TITLE, callback_data: "qr_pay_ip_proceed" }],
                [{ text: lang[selectedLanguage].CANCEL, callback_data: "main_menu" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
            ];

            await sendButtons(chatId, message, buttons, "qr_pay_ip_proceed");
        } else if (amount <= 0.1) {
            await sendMessage(chatId, lang[selectedLanguage].MINIMUM_AMOUNT);
        } else {
            await sendMessage(chatId, lang[selectedLanguage].ENTER_AMOUNT_DIGITS);
        }
    }

    else if (payload === "qr_pay_ip_proceed" && chat.last_message === "qr_pay_ip_proceed") {
        await handleOTPGenerationTG(selectedLanguage, chat, "qr_pay_ip-otp", "qr_pay_ip-otp", "Transaction OTP");
    }
    else if (chat.last_message === "qr_pay_ip-otp" && text && !payload) {
        const otpValidationResult = await validateOTPTG(chatId, text, "qr_pay_ip-otp");

        if (otpValidationResult.status) {
            const data = {
                receiver_wallet_id: chat.wallet_to_wallet.receiving_wallet,
                sender_wallet_id: chat.wallet_to_wallet.sending_wallet,
                purpose: "",
                amount: chat.wallet_to_wallet.amount,
                type: "wallet_to_wallet",
                payment_type: "qr_pay",
                transaction_type: "request",
                transaction_method: "wallet"
            };

            const walletToWalletResponse = await walletToWalletTransaction(data);
            console.log(walletToWalletResponse);

            if (walletToWalletResponse?.status === true) {
                console.log('Transaction successful');

                const wallet = await getActiveWallet(chat.wallet_to_wallet.receiving_wallet);
                const receiverName = wallet.account.account_type === "individual" ?
                    wallet.account.first_name + " " + wallet.account.last_name :
                    wallet?.account?.company_name;

                await sendPhoto(chatId, 'https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/QR%20QuickPay.png', `You have successfully sent ${formattedAmount(chat.wallet_to_wallet.amount)} ${wallet?.currency.code} to ${receiverName}`, "4")
            }
            else if (walletToWalletResponse?.message.includes("feature_not_available")) {
                const featureType = walletToWalletResponse?.message?.split("_")[3];
                const message = usersFeatureMessage(featureType);

                const buttons = [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }];
                await sendButtons(chatId, message, buttons);
            }
            else if (walletToWalletResponse?.message.includes("limit_")) {
                const limitCode = walletToWalletResponse?.message?.split("_")[1];
                const sendingAmounts = walletToWalletResponse?.sendingAmounts;

                const message = userLimitsMessage(limitCode, sendingAmounts);
                const buttons = [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }];

                await sendButtons(chatId, message, buttons);
            }
            else {
                console.log('Transaction failed');
                const message = walletToWalletResponse?.message;
                const buttons = [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }];

                await sendButtons(chatId, message, buttons);
            }

            chat.wallet_to_wallet = {};
            await chat.save();
        }
        else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessageTG(chatId, "qr_pay_ip-otp", selectedLanguage, chat.otpType);
            }
        }
    }

    // if user has proceeded with paypal
    else if (chat.last_message === "qr_pay_methods" && payload === "qr_pay_paypal") {
        if (!defaultWallet) {
            return await somethingWentWrongQuickReplyTelegram(chatId, lang[selectedLanguage].NO_DEFAULT_WALLET_SET, selectedLanguage);
        }

        const receiverWallet = await getActiveWallet(chat.wallet_to_wallet.receiving_wallet);

        await sendMessage(chatId, lang[selectedLanguage].ENTER_AMOUNT_CURRENCY.replace('{{currency}}', receiverWallet.currency.code), "qr_pay_paypal_amount");
    }

    // user has selected to adjust amount
    else if (payload === "qr_pay_paypal-adjust") {
        chat.wallet_to_wallet.amount = undefined
        await chat.save()

        const message = lang[selectedLanguage].UPDATED_AMOUNT;
        await quickMessage(data, message, "qr_pay_paypal_amount");

    }
    // user has entered amount (paypal)
    else if (chat.last_message === "qr_pay_paypal_amount" && !payload && text) {
        const digitRegex = /^\d+(\.\d+)?$/;
        const isNumber = digitRegex.test(text);
        const amount = parseFloat(text);

        if (isNumber && amount >= 0.1) {
            chat.wallet_to_wallet.amount = amount;
            await chat.save();

            const receivingWallet = await await getActiveWallet(chat.wallet_to_wallet.receiving_wallet);

            const { exchange_rate, fee, totalAmountWithFee, recipient_amount, paypal } =
                await calculateExchangeAndFees(
                    defaultWallet.currency.code,
                    receivingWallet.currency.code,
                    amount,
                    "qr_pay",
                    chat.account?.level._id,
                    "paypal",
                    defaultWallet,
                    "request"
                );

            console.log({ exchange_rate, fee, totalAmountWithFee, recipient_amount, paypal });

            let exchangedAmountSender = await getExchangeRatesToUSD(defaultWallet.currency.code, 'USD', totalAmountWithFee);
            console.log({ exchangedAmountSender });

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
${amountToSendText}: ${formattedAmount(totalAmountWithFee - fee)} ${defaultWallet?.currency.code}

${exchangeRateText}: 1.00 ${defaultWallet?.currency?.code} = ${formattedAmount(exchange_rate, 6)} ${receivingWallet?.currency.code}
${feeText}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}

${recipientGetsText} ${formattedAmount(recipient_amount)} ${receivingWallet?.currency.code}

${totalAmountText}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${defaultWallet?.currency?.code}
`;
            } else {
                message = `
${amountToSendText}: ${formattedAmount(totalAmountWithFee - fee)} ${defaultWallet?.currency.code}

${feeText}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}

${recipientGetsText} ${formattedAmount(recipient_amount)} ${receivingWallet?.currency.code}

${totalAmountText}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${defaultWallet?.currency?.code}
`;
            }

            let paypalMessage = "";

            // Check if PayPal supports the currency
            if (!paypal?.paypal_currency_supported) {
                paypalMessage = `
${lang[selectedLanguage].PAYPAL_CURRENCY_NOT_SUPPORTED.replace('{{currency}}', defaultWallet?.currency?.code)}\n
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${defaultWallet?.currency?.code} = ${formattedAmount(paypal?.paypal_rate.value, 6)} ${paypal?.paypal_rate.currency}
${lang[selectedLanguage].AMOUNT_IN_USD}: ${formattedAmount(paypal?.paypal_converted.value)} ${paypal?.paypal_converted.currency}
`;
            }

            const buttons = [
                [{ text: lang[selectedLanguage].PROCEED_TO_TRANSFER, callback_data: "qr_pay_paypal-proceed" }],
                [{ text: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, callback_data: "qr_pay_paypal-adjust" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
            ];

            if (paypalMessage) {
                await sendMessage(chatId, message);
                await sendButtons(chatId, paypalMessage, buttons, "qr_pay_paypal-proceed");
            } else {
                await sendButtons(chatId, message, buttons, "qr_pay_paypal-proceed");
            }

        } else if (amount <= 0.1) {
            await sendMessage(chatId, lang[selectedLanguage].MINIMUM_AMOUNT);
        } else {
            await sendMessage(chatId, lang[selectedLanguage].ENTER_AMOUNT_DIGITS);
        }
    }
    else if (payload === "qr_pay_paypal-proceed" && chat.last_message === "qr_pay_paypal-proceed") {
        await handleOTPGenerationTG(selectedLanguage, chat, "qr_pay_paypal-otp", "qr_pay_paypal-otp", "Transaction OTP");
    }
    else if (chat.last_message === "qr_pay_paypal-otp" && text && !payload) {
        const otpValidationResult = await validateOTPTG(chatId, text, "qr_pay_paypal-otp");

        if (otpValidationResult.status) {
            const receivingWallet = await await getActiveWallet(chat.wallet_to_wallet.receiving_wallet);

            const rates = await calculateExchangeAndFees(
                defaultWallet.currency.code,
                receivingWallet.currency.code,
                chat.wallet_to_wallet.amount,
                "qr_pay",
                chat.account?.level._id,
                "paypal",
                defaultWallet,
                "request"
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
                    feeToSendingRate: rates.feeToSendingRate,
                },
            };

            const token = jwt.sign(extrasPayload, process.env.jwtKey, { expiresIn: "10m" });

            let w2w_data = {
                receiver_wallet_id: chat.wallet_to_wallet.receiving_wallet,
                sender_wallet_id: defaultWallet?._id,
                purpose: "GIFT_AND_DONATION",
                amount: chat.wallet_to_wallet.amount,
                type: "instant",
                payment_type: "qr_pay",
                description: "",
                token,
            };

            const JWTToken = jwt.sign(w2w_data, process.env.jwtKey, { expiresIn: "10m" });

            console.log({ rates, w2w_data });

            const initiateDetails = await initiateW2WPaypalTransactionHelper(rates, w2w_data, JWTToken, "qr_pay", "telegram");
            console.log({ initiateDetails });

            if (initiateDetails?.status) {
                const title = lang[selectedLanguage].VERIFY_PAYPAL_ACCOUNT;
                const subtitle = `
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(rates.totalAmountWithFee)} ${defaultWallet?.currency?.code}
                `;

                const buttons = [
                    [{ text: lang[selectedLanguage].VERIFY, url: initiateDetails?.url }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                ];

                await sendButtons(chatId, `${title}\n\n${subtitle}`, buttons);
            } else {
                const buttons = [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]];
                await sendButtons(chatId, initiateDetails?.message || lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR, buttons);
            }
        }
        else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessageTG(chatId, "qr_pay_paypal-otp", selectedLanguage, chat.otpType);
            }
        }
    }

    // user has proceeded with qr pay with card
    if (payload === "qr_pay_card") {
        const pans = await PanModel.find({ account: chat.account._id });
        console.log(pans);

        let buttons = [];

        if (pans.length !== 0) {
            // Add card selection buttons
            for (let i = 0; i < pans.length; i++) {
                buttons.push([
                    {
                        text: `💳 *******${pans[i].last4}`,
                        callback_data: `qr_pay_card_select_card-${pans[i]._id}`
                    }
                ]);
            }

            // Add change payment method and main menu buttons
            buttons.push([
                {
                    text: lang[selectedLanguage].CHANGE_PAYMENT_METHOD,
                    callback_data: `change_payment_method_w2w`
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
            // No cards available
            buttons.push([
                {
                    text: `☰ ${lang[selectedLanguage].MAIN_MENU}`,
                    callback_data: `main_menu`
                }
            ]);
            await sendButtons(chatId, lang[selectedLanguage].NO_CARD_SAVED, buttons);
        }
    }

    // User has selected a card
    else if (payload?.startsWith("qr_pay_card_select_card-")) {
        const cardId = payload.split("-")[1];

        // Validate card expiry
        const expiryValidation = await validateCardExpiry(cardId);

        if (!expiryValidation.status) {
            const pans = await PanModel.find({ account: chat.account._id });
            const message = lang[selectedLanguage].SELECTED_CARD_EXPIRED;

            if (pans.length !== 0) {
                const buttons = [
                    [
                        { text: lang[selectedLanguage].PAYMENT_CARD, callback_data: "qr_pay_card" },
                        { text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "qr_pay_wallets_payment" }
                    ],
                    [
                        { text: lang[selectedLanguage].PAYPAL, callback_data: "qr_pay_paypal" },
                        { text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }
                    ]
                ];
                await sendButtons(chatId, message, buttons);
            } else {
                const buttons = [
                    [
                        { text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "qr_pay_wallets_payment" },
                        { text: lang[selectedLanguage].PAYPAL, callback_data: "qr_pay_paypal" }
                    ],
                    [
                        { text: lang[selectedLanguage].ADD_PAYMENT_CARD, callback_data: "add_payment_card-qr_pay_code_yes" },
                        { text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }
                    ]
                ];
                await sendButtons(chatId, message, buttons);
            }
            return;
        }

        // Save selected card and proceed
        chat.wallet_to_wallet.card.pan = cardId;
        await chat.save();

        const receiverWallet = await Wallet.findOne({ wallet_id: chat.wallet_to_wallet.receiving_wallet });
        const message = lang[selectedLanguage].ENTER_AMOUNT_CURRENCY.replace('{{currency}}', receiverWallet.currency.code);

        const buttons = [
            [
                { text: `☰ ${lang[selectedLanguage].MAIN_MENU}`, callback_data: "main_menu" }
            ]
        ];

        await sendButtons(chatId, message, buttons, "qr_pay_card_amount");
    }

    // User has selected to adjust amount
    else if (payload === "qr_pay_card-adjust") {
        chat.qr_sending_amount = null;
        await chat.save();

        const buttons = [
            [{ text: `☰ ${lang[selectedLanguage].MAIN_MENU}`, callback_data: "main_menu" }]
        ];
        await sendButtons(chatId, lang[selectedLanguage].UPDATED_AMOUNT, buttons, "qr_pay_card_amount");
    }

    // User has entered amount
    else if (chat?.last_message === "qr_pay_card_amount" && !payload && text) {
        const validation = validateAmount(text, selectedLanguage);
        const amount = validation.amount;

        if (validation.status && amount >= 0.1) {
            chat.wallet_to_wallet.amount = amount;
            await chat.save();

            const receivingWallet = await Wallet.findOne({ wallet_id: chat.wallet_to_wallet.receiving_wallet });

            const { exchange_rate, fee, totalAmountWithFee, recipient_amount, paypal } = await calculateExchangeAndFees(
                defaultWallet.currency.code,
                receivingWallet.currency.code,
                amount,
                "qr_pay",
                chat.account?.level._id,
                "card",
                defaultWallet,
                "request"
            );

            const exchangedAmountSender = await getExchangeRatesToUSD(
                defaultWallet.currency.code,
                'USD',
                totalAmountWithFee
            );

            const sender_limits_check = await checkTransactionLimitsForSender(
                exchangedAmountSender,
                defaultWallet,
                'sending'
            );

            if (!sender_limits_check.status) {
                await sendMessage(chatId, sender_limits_check.message);
                return;
            }

            let message;
            if (defaultWallet?.currency?.code !== receivingWallet?.currency.code) {
                message = `
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${defaultWallet?.currency.code}
    
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${defaultWallet?.currency?.code} = ${formattedAmount(exchange_rate, 6)} ${receivingWallet?.currency.code}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}
    
${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(recipient_amount)} ${receivingWallet?.currency.code} 
    
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${defaultWallet?.currency?.code}
    `;
            } else {
                message = `
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${defaultWallet?.currency.code}
    
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}
    
${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(recipient_amount)} ${receivingWallet?.currency.code} 
    
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${defaultWallet?.currency?.code}
    `;
            }

            const buttons = [
                [{ text: lang[selectedLanguage].PROCEED_TO_TRANSFER, callback_data: "qr_pay_card-proceed" }],
                [{ text: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, callback_data: "qr_pay_card-adjust" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];

            await sendButtons(chatId, message, buttons);

        } else if (amount <= 0.1) {
            await sendMessage(chatId, lang[selectedLanguage].MINIMUM_AMOUNT);
        } else {
            await sendMessage(chatId, lang[selectedLanguage].ENTER_AMOUNT_DIGITS);
        }
    }

    else if (payload === "qr_pay_card-proceed") {
        const buttons = [
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];
        await sendButtons(chatId, lang[selectedLanguage].UPDATE_IN_PROGRESS, buttons, "4");
    }
}

module.exports = { qrQuickPay }