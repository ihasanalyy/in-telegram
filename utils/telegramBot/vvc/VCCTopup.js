const lang = require("../../languages/languages.json");
const FeeModel = require("../../../models/Fee.model")
const VirtualCardModel = require("../../../models/Virtual-Card.model")
const { getUserActiveWallets, getActiveWalletById, getExchangeRatesToUSD, walletToCardTransactionHelper, vccTopupFeeCalculation } = require("../../helpers")
const { formattedAmount } = require("../../InstaChatbotHelpers")
const { validateAmount } = require("../../instaChatbotUtils")
const { sendButtons, sendMessage, sendPhoto } = require("../../telegramBotUtils")
const currencyToEmoji = require('../../currencyEmojis.json');
const { formatDecimalNumbersWithLimit } = require("../../payerRates");
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler");
const jwt = require("jsonwebtoken");
const PanModel = require("../../../models/Pan.model");
const { topupUsingCard } = require("./topup/topupUsingCard");
const { topupUsingPaypal } = require("./topup/topupUsingPaypal");
async function VCCTopup(chatId, payload, chat, text, selectedLanguage) {
    if (payload === "vcc_add_funds") {
        const vccs = await VirtualCardModel.find({ account: chat.account._id })
        console.log({ vccs })
        if (vccs.length === 0) {
            await sendButtons(chatId, lang[selectedLanguage].INACTIVE_CARDS, [[{ text: 'Main Menu', callback_data: 'main_menu' }]], '4');
        } else {

            // if single card, proceed the user to next step
            if (vccs.length === 1) {
                chat.vcc.card === vccs[0]._id
                await chat.save()

                await sendButtons(chatId, lang[selectedLanguage].TOPUP_AMOUNT, [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }], "vcc_add_funds_ip_amount");

            } else {
                const message = lang[selectedLanguage].SELECT_CARD_TO_TOPUP;
                const buttons = vccs.map((vvc) => [{ text: `${vvc.last4}`, callback_data: `vcc_add_funds_w-${vvc._id}` }])
                buttons.push([{ text: lang[selectedLanguage].BACK, callback_data: "vcc_menu" }]);

                await sendButtons(chatId, message, buttons, "vcc_add_funds_w");
            }
        }
    }

    // user has selected a card from the list
    else if (payload?.includes("vcc_add_funds_w-") && chat?.last_message === "vcc_add_funds_w") {
        const card_id = payload.split("-")[1]
        chat.vcc.card = card_id
        await chat.save()

        await sendButtons(chatId, lang[selectedLanguage].USD_TOPUP, [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]], "vcc_add_funds_ip_amount");
    }

    // // user has asked to adjust the amount
    else if (payload?.includes("vcc_add_funds_adjust") && chat?.last_message === "vcc_add_funds_ip_confirm") {
        await sendButtons(chatId, lang[selectedLanguage].USD_TOPUP, [[{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]], "vcc_add_funds_ip_adjust_amount");
    }

    // user has entered the amount
    else if (chat?.last_message === "vcc_add_funds_ip_amount" && text && !payload) {

        const { status, message, amount } = validateAmount(text, selectedLanguage);

        if (!status) {
            await sendMessage(chatId, message);
            return;
        }

        chat.vcc.amount = amount
        await chat.save()

        const pans = await PanModel.find({ account: chat.account._id });

        let buttons;
        if (pans.length !== 0) {
            buttons = [
                [{ text: lang[selectedLanguage].PAYMENT_CARD, callback_data: "vcc_add_funds_card" }],
                [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "vcc_add_funds_ip" }],
                [{ text: lang[selectedLanguage].PAYPAL, callback_data: "vcc_add_funds_ppl" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
            ];
        } else {
            buttons = [
                [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "vcc_add_funds_ip" }],
                [{ text: lang[selectedLanguage].PAYPAL, callback_data: "vcc_add_funds_ppl" }],
                [{ text: lang[selectedLanguage].ADD_PAYMENT_CARD, callback_data: "add_payment_card-vcc_add_funds_methods" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
            ];
        }

        await sendButtons(chatId, lang[selectedLanguage].SELECT_YOUR_TOPUP_CHANNEL, buttons, "vcc_add_funds_channel")
    }

    else if (payload === "vcc_add_funds_methods") {
        const pans = await PanModel.find({ account: chat.account._id });

        let buttons;
        if (pans.length !== 0) {
            buttons = [
                [{ text: lang[selectedLanguage].PAYMENT_CARD, callback_data: "vcc_add_funds_card" }],
                [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "vcc_add_funds_ip" }],
                [{ text: lang[selectedLanguage].PAYPAL, callback_data: "vcc_add_funds_ppl" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
            ];
        } else {
            buttons = [
                [{ text: lang[selectedLanguage].INSTAPAY_WALLETS, callback_data: "vcc_add_funds_ip" }],
                [{ text: lang[selectedLanguage].PAYPAL, callback_data: "vcc_add_funds_ppl" }],
                [{ text: lang[selectedLanguage].ADD_PAYMENT_CARD, callback_data: "add_payment_card-vcc_add_funds_methods" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
            ];
        }

        await sendButtons(chatId, lang[selectedLanguage].SELECT_YOUR_TOPUP_CHANNEL, buttons, "vcc_add_funds_channel")
    }

    // user has selected card payment
    else if (
        (text && chat.last_message?.startsWith("vcc_add_funds_card")) ||
        (payload?.startsWith("vcc_add_funds_card") && chat?.last_message?.startsWith("vcc_add_funds_card")) ||
        (payload === "vcc_add_funds_card" && chat?.last_message === "vcc_add_funds_channel")
    ) {
        await topupUsingCard(chatId, payload, chat, text, selectedLanguage);
    }

    // user has selected paypal
    else if (
        (text && chat.last_message?.startsWith("vcc_add_funds_ppl")) ||
        (payload?.startsWith("vcc_add_funds_ppl") && chat?.last_message?.startsWith("vcc_add_funds_ppl")) ||
        (payload === "vcc_add_funds_ppl" && chat?.last_message === "vcc_add_funds_channel")
    ) {
        await topupUsingPaypal(chatId, payload, chat, text, selectedLanguage);
    }

    // user has selected topup using ip wallets
    else if (payload === "vcc_add_funds_ip" && (chat?.last_message === "vcc_add_funds_channel" || chat?.last_message === "vcc_add_funds_ip_proceed")) {
        const wallets = await getUserActiveWallets(chat.account._id)
        const limitedWallets = wallets.slice(0, 8)

        const buttons = [
            ...limitedWallets.map(wallet => [
                {
                    text: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`,
                    callback_data: `vcc_add_funds_ip-${wallet._id}`
                }
            ]),
            [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, lang[selectedLanguage].SELECT_CURRENCY_BALANCE_MESSAGE, buttons, "vcc_add_funds_ip");
    }

    // user has selected some wallet
    else if (payload?.includes("vcc_add_funds_ip-") && chat?.last_message === "vcc_add_funds_ip") {
        const walletId = payload?.split("-")[1]
        const walletDetails = await getActiveWalletById(walletId);

        chat.vcc.wallet = walletId
        await chat.save()

        const message = lang[selectedLanguage].CURRENTLY_HAVE
            .replace('{{amount}}', formattedAmount(walletDetails?.balance?.available))
            .replace('{{currency}}', walletDetails.currency.code);

        const buttons = [
            [{ text: lang[selectedLanguage].CHANGE_WALLET, callback_data: "vcc_add_funds_ip" }],
            [{ text: lang[selectedLanguage].PROCEED_TITLE, callback_data: "vcc_add_funds_ip_proceed" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, message, buttons, "vcc_add_funds_ip_proceed");
    }

    // User has proceeded
    else if (payload === "vcc_add_funds_ip_proceed" && chat?.last_message === "vcc_add_funds_ip_proceed") {
        const cardDetails = await VirtualCardModel.findById(chat.vcc.card);
        const walletDetails = await getActiveWalletById(chat.vcc.wallet);

        // Get the top-up fee and markup in CARD'S currency
        const { fee, markup, feeType } = await vccTopupFeeCalculation(
            cardDetails.currency,
            chat.account.level._id,
            chat.vcc.amount,
            `topup_ip_wallet_vcc_${cardDetails.type?.includes("premium") ? "premium" : "standard"}_${cardDetails.subscription_type}`
        );

        // Get exchange rate from CARD CURRENCY to WALLET CURRENCY
        const rate = await getExchangeRatesToUSD(
            cardDetails.currency,
            walletDetails.currency.code,
            1
        );

        // Apply markup to the exchange rate
        let markupExchangeRate = formatDecimalNumbersWithLimit(rate, 6);
        if (walletDetails.currency.code !== cardDetails.currency) {
            const percentageMarkup = (markup / 100) * rate;
            markupExchangeRate = formatDecimalNumbersWithLimit(rate - percentageMarkup, 6);
        }

        if (!fee) {
            return await sendMessage(chatId, lang[selectedLanguage].SOMETHING_WENT_WRONG);
        }

        // Check if the entered amount is lower than the top-up fee
        const minRequiredAmount = fee + fee * 0.1; // Top-up fee + 10%
        const minimumAmount = formattedAmount(minRequiredAmount);
        if (chat.vcc.amount < minRequiredAmount) {
            return await sendMessage(
                chatId,
                lang[selectedLanguage].MIN_AMOUNT_LOW.replace("{{minimumAmount}}", minimumAmount).replace("{{currency}}", cardDetails.currency), //Hassan,
                "vcc_add_funds_ip_min_amount"
            );
        }

        // Calculate total amount in wallet currency
        const totalAmount = formatDecimalNumbersWithLimit(
            markupExchangeRate * (chat.vcc.amount)
        );

        const feeInLocalCurrency = formatDecimalNumbersWithLimit(fee * markupExchangeRate);

        // Balance check
        if (totalAmount > walletDetails.balance.available) {
            const buttons = [
                [{ text: lang[selectedLanguage].MY_MASTERCARD, callback_data: "vcc_menu" }],
            ];
            return await sendButtons(
                chatId,
                lang[selectedLanguage].INSUFFICIENT_BALANCE_AMOUNT_MESSAGE.replace("{{amount}}", formattedAmount(walletDetails.balance.available)).replace("{{currency}}", walletDetails.currency.code).replace("{{totalAmount}}", formattedAmount(totalAmount)).replace("{{currency}}", walletDetails.currency.code),
                buttons
            );
        }

        const message = `
Amount to Topup: ${formattedAmount(chat.vcc.amount)} ${cardDetails.currency}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${cardDetails.currency}
You'll get: ${formattedAmount(chat.vcc.amount - fee)} ${cardDetails.currency}
${walletDetails?.currency.code !== cardDetails.currency ? `${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${cardDetails.currency} = ${markupExchangeRate} ${walletDetails?.currency.code}` : ""}
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmount)} ${walletDetails.currency.code}
`.trim();

        const dataPayload = {
            amount: chat.vcc.amount,
            fee: fee,
            amountToTopup: formatDecimalNumbersWithLimit(chat.vcc.amount - fee),
            feeInLocalCurrency,
            markup_rate: markupExchangeRate,
            markup,
            local_amount: totalAmount,
            fee_type: feeType,
            original_rate: rate,
            cardId: chat.vcc.card
        }
        const token = jwt.sign(dataPayload, process.env.jwtKey, { expiresIn: "10m" });
        chat.vcc.topup_transaction_token = token
        await chat.save()

        const buttons = [
            [{ text: lang[selectedLanguage].PROCEED_TITLE, callback_data: "vcc_add_funds_ip_confirm" }],
            [{ text: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, callback_data: "vcc_add_funds_adjust" }],
            [{ text: lang[selectedLanguage].MY_MASTERCARD, callback_data: "vcc_menu" }],
        ];

        await sendButtons(chatId, message, buttons, "vcc_add_funds_ip_confirm");
    }

    // user has adjusted the amount
    else if (chat?.last_message === "vcc_add_funds_ip_adjust_amount" && text && !payload) {
        const { status, message, amount } = validateAmount(text, selectedLanguage);

        if (!status) {
            await sendMessage(chatId, message);
            return;
        }

        const cardDetails = await VirtualCardModel.findById(chat.vcc.card);
        const walletDetails = await getActiveWalletById(chat.vcc.wallet);

        // Get the top-up fee and markup in CARD'S currency
        const { fee, markup, feeType } = await vccTopupFeeCalculation(
            cardDetails.currency,
            chat.account.level._id,
            amount,
            `topup_ip_wallet_vcc_${cardDetails.type?.includes("premium") ? "premium" : "standard"}_${cardDetails.subscription_type}`
        );

        // Get exchange rate from CARD CURRENCY to WALLET CURRENCY
        const rate = await getExchangeRatesToUSD(cardDetails.currency, walletDetails.currency.code, 1);

        // Apply markup to the exchange rate
        let markupExchangeRate = formatDecimalNumbersWithLimit(rate, 6);
        if (walletDetails.currency.code !== cardDetails.currency) {
            const percentageMarkup = (markup / 100) * rate;
            markupExchangeRate = formatDecimalNumbersWithLimit(rate - percentageMarkup, 6);
        }

        if (!fee) {
            return await sendMessage(chatId, lang[selectedLanguage].SOMETHING_WENT_WRONG);
        }

        // Check if the entered amount is lower than the top-up fee
        const minRequiredAmount = fee + fee * 0.1; // Top-up fee + 10%
        const minimumAmount = formattedAmount(minRequiredAmount);
        if (amount < minRequiredAmount) {
            return await sendMessage(
                chatId,
                lang[selectedLanguage].MIN_AMOUNT_LOW.replace("{{minimumAmount}}", minimumAmount).replace("{{currency}}", cardDetails.currency) //Hassan
            );
        }

        // Calculate total amount in wallet currency
        const totalAmount = formatDecimalNumbersWithLimit(markupExchangeRate * (amount));
        const feeInLocalCurrency = formatDecimalNumbersWithLimit(fee * markupExchangeRate);

        // balance check
        if (totalAmount > walletDetails.balance.available) {
            const buttons = [
                [{ text: lang[selectedLanguage].MY_MASTERCARD, callback_data: "vcc_menu" }],
            ]
            return await sendButtons(
                chatId,
                lang[selectedLanguage].INSUFFICIENT_BALANCE_AMOUNT_MESSAGE.replace("{{amount}}", formattedAmount(walletDetails.balance.available)).replace("{{currency}}", walletDetails.currency.code).replace("{{totalAmount}}", formattedAmount(totalAmount)).replace("{{currency}}", walletDetails.currency.code),
                buttons);
        }

        // Construct message with correct calculations
        const ratesMessage = `
Amount to Topup: ${formattedAmount(amount)} ${cardDetails.currency}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${cardDetails.currency}
You'll get: ${formattedAmount(amount - fee)} ${cardDetails.currency}
${walletDetails?.currency.code !== cardDetails.currency ? `${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${cardDetails.currency} = ${markupExchangeRate} ${walletDetails?.currency.code}` : ""}
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmount)} ${walletDetails.currency.code}
`.trim();

        const dataPayload = {
            amount,
            fee: fee,
            amountToTopup: formatDecimalNumbersWithLimit(chat.vcc.amount - fee),
            feeInLocalCurrency,
            markup_rate: markupExchangeRate,
            markup,
            local_amount: totalAmount,
            fee_type: feeType,
            original_rate: rate,
            cardId: chat.vcc.card
        }

        const token = jwt.sign(dataPayload, process.env.jwtKey, { expiresIn: "10m" });
        chat.vcc.amount = amount
        chat.vcc.topup_transaction_token = token
        await chat.save()

        const buttons = [
            [{ text: lang[selectedLanguage].PROCEED_TITLE, callback_data: "vcc_add_funds_ip_confirm" }],
            [{ text: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, callback_data: "vcc_add_funds_adjust" }],
            [{ text: lang[selectedLanguage].MY_MASTERCARD, callback_data: "vcc_menu" }],
        ];

        await sendButtons(chatId, ratesMessage, buttons, "vcc_add_funds_ip_confirm");
    }

    else if (payload === "vcc_add_funds_ip_confirm" && chat?.last_message === "vcc_add_funds_ip_confirm") {
        await handleOTPGenerationTG(selectedLanguage, chat, "vcc_add_funds_ip-otp", "vcc_add_funds_ip-otp", "Transaction OTP");
    }

    else if (chat.last_message === "vcc_add_funds_ip-otp" && text && !payload) {
        const otpValidationResult = await validateOTPTG(chatId, text, "vcc_add_funds_ip-otp");

        if (otpValidationResult.status) {
            const data = {
                sender_wallet_id: chat.vcc.wallet,
                token: chat.vcc.topup_transaction_token,
                account: chat.account._id
            }
            const transaction = await walletToCardTransactionHelper(data)
            console.log({ transaction })

            if (transaction.status) {
                // const message = `Your topup of ${formattedAmount(chat.vcc.amount)} USD was successful.`
                const message = lang[selectedLanguage].TOPUP_SUCCESS.replace("{{amount}}", formattedAmount(chat.vcc.amount)); //Hasssan

                await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", message, "4");
                const buttons = [
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                    [{ text: lang[selectedLanguage].MY_MASTERCARD, callback_data: "vcc_menu" }],
                ];
                await sendButtons(chatId, `${lang[selectedLanguage].TRANSACTION_ID} ${transaction.data.transactionId}`, buttons, "4");
            } else {
                await sendMessage(chatId, lang[selectedLanguage].SOMETHING_WENT_WRONG, "4");
            }
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {
                await invalidMessageTG(chatId, "vcc_add_funds_ip-otp", selectedLanguage, chat?.otpType);
            }
        }
    }
}

module.exports = { VCCTopup }