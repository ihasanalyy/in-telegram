const { quickMessage, quickReply, sendTemplate, validateAmount, formatDate } = require("../../instaChatbotUtils");
const lang = require('../../languages/languages.json');
const { formattedAmount } = require("../../InstaChatbotHelpers");
const VirtualCardModel = require("../../../models/Virtual-Card.model");
const Account = require("../../../models/Account.model");
const { handleOTPGeneration, validateOTP, invalidMessage } = require("../../instaChatbotOTP");
const { getUserActiveWallets, getActiveWalletById, vccTopupFeeCalculation, getExchangeRatesToUSD, walletToCardTransactionHelper } = require("../../helpers");
const { formatDecimalNumbersWithLimit } = require("../../payerRates");
const currencyToEmoji = require('../../currencyEmojis.json');
const jwt = require("jsonwebtoken");
const { topupUsingCard } = require("./topup/topupUsingCard");
const { topupUsingPaypal } = require("./topup/topupUsingPaypal");
const PanModel = require("../../../models/Pan.model");

async function addFunds(senderId, payload, account, bot, text, selectedLanguage) {
    const data = {
        sender: {
            id: senderId
        }
    }
    if (payload === "vcc_add_funds") {
        const vccs = await VirtualCardModel.find({ account: account._id });
        console.log({ vccs });

        if (vccs.length === 0) {
            const quickReplies = [
                { content_type: "text", title: "Main Menu", payload: "main_menu" }
            ];
            await quickReply(data, 'You do not have any active Cards', quickReplies, "4");
        } else {
            // If single card, proceed the user to the next step
            if (vccs.length === 1) {
                bot.vcc.card = vccs[0]._id;
                await bot.save();

                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                ];
                await quickReply(data, `Enter the amount in ${vccs[0].currency}you want to top up in your card`, quickReplies, "vcc_add_funds_ip_amount");
            } else {
                const message = "💳 Please select the card to which you would like to add funds 👇";
                const quickReplies = vccs.map((vcc) => ({
                    content_type: "text",
                    title: `💳 *****${vcc.last4.slice(-4)}`,
                    payload: `vcc_add_funds_w-${vcc._id}`
                }));
                quickReplies.push({
                    content_type: "text",
                    title: "Back",
                    payload: "vcc_menu"
                });

                await quickReply(data, message, quickReplies, "vcc_add_funds_w");
            }
        }
    }

    // User has selected a card from the list
    else if (payload?.includes("vcc_add_funds_w-") && bot?.last_message === "vcc_add_funds_w") {
        const card_id = payload.split("-")[1];
        bot.vcc.card = card_id;
        await bot.save();

        const vcc = await VirtualCardModel.findById(card_id);

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
        ];
        await quickReply(data, `Enter the amount in ${vcc.currency} you want to top up in your card. Example: 150`, quickReplies, "vcc_add_funds_ip_amount");
    }

    // User has asked to adjust the amount
    else if (payload?.includes("vcc_add_funds_adjust") && bot?.last_message === "vcc_add_funds_ip_confirm") {
        const vcc = await VirtualCardModel.findById(bot.vcc.card);
        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
        ];
        await quickReply(data, `Enter the amount in ${vcc.currency} you want to top up in your card. Example: 150`, quickReplies, "vcc_add_funds_ip_adjust_amount");
    }

    // User has entered the amount
    else if (bot?.last_message === "vcc_add_funds_ip_amount" && text && !payload) {
        const { status, message, amount } = validateAmount(text, selectedLanguage);

        if (!status) {
            await quickMessage(data, message);
            return;
        }

        bot.vcc.amount = amount;
        await bot.save();

        const pans = await PanModel.find({ account: account._id });

        let quickReplies;
        if (pans.length !== 0) {
            quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].PAYMENT_CARD, payload: "vcc_add_funds_card" },
                { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "vcc_add_funds_ip" },
                { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "vcc_add_funds_ppl" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
            ];
        } else {
            quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "vcc_add_funds_ip" },
                { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "vcc_add_funds_ppl" },
                { content_type: "text", title: lang[selectedLanguage].ADD_PAYMENT_CARD, payload: "add_payment_card-vcc_add_funds_methods" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
            ];
        }


        await quickReply(data, lang[selectedLanguage].SELECT_YOUR_TOPUP_CHANNEL, quickReplies, "vcc_add_funds_channel");
    }

    else if (payload === "vcc_add_funds_methods" && bot?.last_message === "vcc_add_funds_channel") {
        const pans = await PanModel.find({ account: account._id });

        let quickReplies;
        if (pans.length !== 0) {
            quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].PAYMENT_CARD, payload: "vcc_add_funds_card" },
                { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "vcc_add_funds_ip" },
                { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "vcc_add_funds_ppl" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
            ];
        } else {
            quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "vcc_add_funds_ip" },
                { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "vcc_add_funds_ppl" },
                { content_type: "text", title: lang[selectedLanguage].ADD_PAYMENT_CARD, payload: "add_payment_card-vcc_add_funds_methods" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
            ];
        }


        await quickReply(data, lang[selectedLanguage].SELECT_YOUR_TOPUP_CHANNEL, quickReplies, "vcc_add_funds_channel");
    }

    // user has selected top-up using card 
    else if ((payload?.includes("vcc_add_funds_card") && bot?.last_message?.includes("vcc_add_funds_card"))
        || (payload === "vcc_add_funds_card" && bot?.last_message === "vcc_add_funds_channel")
        || (bot?.last_message?.includes("vcc_add_funds_card") && text && !payload)
    ) {
        await topupUsingCard(senderId, payload, account, bot, text, selectedLanguage);
        return
    }
    // user has selected top-up using Paypal 
    else if ((payload?.includes("vcc_add_funds_ppl") && bot?.last_message?.includes("vcc_add_funds_ppl"))
        || (payload === "vcc_add_funds_ppl" && bot?.last_message === "vcc_add_funds_channel")
        || (bot?.last_message?.includes("vcc_add_funds_ppl") && text && !payload)
    ) {
        await topupUsingPaypal(senderId, payload, account, bot, text, selectedLanguage);
        return
    }
    // User has selected top-up using IP wallets
    else if (payload === "vcc_add_funds_ip" && (bot?.last_message === "vcc_add_funds_channel" || bot?.last_message === "vcc_add_funds_ip_proceed")) {
        const wallets = await getUserActiveWallets(account._id);
        const limitedWallets = wallets.slice(0, 8);

        const quickReplies = [
            ...limitedWallets.map(wallet => ({
                content_type: "text",
                title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`,
                payload: `vcc_add_funds_ip-${wallet._id}`
            })),
            {
                content_type: "text",
                title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                payload: "main_menu"
            }
        ];

        await quickReply(data, lang[selectedLanguage].SELECT_CURRENCY_BALANCE_MESSAGE, quickReplies, "vcc_add_funds_ip");
    }

    // User has selected a wallet
    else if (payload?.includes("vcc_add_funds_ip-") && bot?.last_message === "vcc_add_funds_ip") {
        const walletId = payload?.split("-")[1];
        const walletDetails = await getActiveWalletById(walletId);

        bot.vcc.wallet = walletId;
        await bot.save();

        const message = lang[selectedLanguage].CURRENTLY_HAVE
            .replace('{{amount}}', formattedAmount(walletDetails?.balance?.available))
            .replace('{{currency}}', walletDetails.currency.code);

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].CHANGE_WALLET, payload: "vcc_add_funds_ip" },
            { content_type: "text", title: lang[selectedLanguage].PROCEED_TITLE, payload: "vcc_add_funds_ip_proceed" },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
        ];

        await quickReply(data, message, quickReplies, "vcc_add_funds_ip_proceed");
    }

    // User has proceeded
    else if (payload === "vcc_add_funds_ip_proceed" && bot?.last_message === "vcc_add_funds_ip_proceed") {
        const cardDetails = await VirtualCardModel.findById(bot.vcc.card);
        const walletDetails = await getActiveWalletById(bot.vcc.wallet);

        // Get the top-up fee and markup in CARD'S currency
        const { fee, markup, feeType } = await vccTopupFeeCalculation(
            cardDetails.currency,
            account.level._id,
            bot.vcc.amount,
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
            return await quickMessage(data, "Something went wrong. Please try again. If the problem persists, contact our support team.");
        }

        // Check if the entered amount is lower than the top-up fee
        const minRequiredAmount = fee + fee * 0.1; // Top-up fee + 10%
        if (bot.vcc.amount < minRequiredAmount) {
            return await quickMessage(
                data,
                `The amount entered is too low. The minimum amount required for a top-up is ${formattedAmount(minRequiredAmount)} ${cardDetails.currency}. Please enter a higher amount.`
            );
        }

        // Calculate total amount in wallet currency
        const totalAmount = formatDecimalNumbersWithLimit(
            markupExchangeRate * (bot.vcc.amount)
        );

        const feeInLocalCurrency = formatDecimalNumbersWithLimit(fee * markupExchangeRate);

        // Balance check
        if (totalAmount > walletDetails.balance.available) {
            const quickReplies = [
                { content_type: "text", title: "My MasterCard", payload: "vcc_menu" }
            ];
            return await quickReply(
                data,
                `Insufficient balance! Your available balance is ${formattedAmount(walletDetails.balance.available)} ${walletDetails.currency.code} but required amount is ${formattedAmount(totalAmount)} ${walletDetails.currency.code}`,
                quickReplies
            );
        }

        const message = `
Amount to Topup: ${formattedAmount(bot.vcc.amount)} ${cardDetails.currency}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${cardDetails.currency}
You'll get: ${formattedAmount(bot.vcc.amount - fee)} ${cardDetails.currency}
${walletDetails?.currency.code !== cardDetails.currency ? `${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${cardDetails.currency} = ${markupExchangeRate} ${walletDetails?.currency.code}` : ""}
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmount)} ${walletDetails.currency.code}
`.trim();

        const dataPayload = {
            amount: bot.vcc.amount,
            fee: fee,
            amountToTopup: formatDecimalNumbersWithLimit(bot.vcc.amount - fee),
            feeInLocalCurrency,
            markup_rate: markupExchangeRate,
            markup,
            local_amount: totalAmount,
            fee_type: feeType,
            original_rate: rate,
            cardId: bot.vcc.card
        };
        const token = jwt.sign(dataPayload, process.env.jwtKey, { expiresIn: "10m" });
        bot.vcc.topup_transaction_token = token;
        await bot.save();

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].PROCEED_TITLE, payload: "vcc_add_funds_ip_confirm" },
            { content_type: "text", title: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, payload: "vcc_add_funds_adjust" },
            { content_type: "text", title: "My MasterCard", payload: "vcc_menu" }
        ];

        await quickReply(data, message, quickReplies, "vcc_add_funds_ip_confirm");
    }

    // User has adjusted the amount
    else if (bot?.last_message === "vcc_add_funds_ip_adjust_amount" && text && !payload) {
        const { status, message, amount } = validateAmount(text, selectedLanguage);

        if (!status) {
            await quickMessage(data, message);
            return;
        }

        const cardDetails = await VirtualCardModel.findById(bot.vcc.card);
        const walletDetails = await getActiveWalletById(bot.vcc.wallet);

        // Get the top-up fee and markup in CARD'S currency
        const { fee, markup, feeType } = await vccTopupFeeCalculation(
            cardDetails.currency,
            bot.account.level._id,
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
            return await quickMessage(data, "Something went wrong. Please try again. If the problem persists, contact our support team.");
        }

        // Check if the entered amount is lower than the top-up fee
        const minRequiredAmount = fee + fee * 0.1; // Top-up fee + 10%
        if (amount < minRequiredAmount) {
            return await quickMessage(
                data,
                `The amount entered is too low. The minimum amount required for a top-up is ${formattedAmount(minRequiredAmount)} ${cardDetails.currency}. Please enter a higher amount.`
            );
        }

        // Calculate total amount in wallet currency
        const totalAmount = formatDecimalNumbersWithLimit(markupExchangeRate * (amount));
        const feeInLocalCurrency = formatDecimalNumbersWithLimit(fee * markupExchangeRate);

        // Balance check
        if (totalAmount > walletDetails.balance.available) {
            const quickReplies = [
                { content_type: "text", title: "My MasterCard", payload: "vcc_menu" },
            ];
            return await quickReply(
                data,
                `Insufficient balance! Your available balance is ${formattedAmount(walletDetails.balance.available)} ${walletDetails.currency.code} but required amount is ${formattedAmount(totalAmount)} ${walletDetails.currency.code}`,
                quickReplies
            );
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
            amountToTopup: formatDecimalNumbersWithLimit(bot.vcc.amount - fee),
            feeInLocalCurrency,
            markup_rate: markupExchangeRate,
            markup,
            local_amount: totalAmount,
            fee_type: feeType,
            original_rate: rate,
            cardId: bot.vcc.card,
            currency: cardDetails.currency
        };

        const token = jwt.sign(dataPayload, process.env.jwtKey, { expiresIn: "10m" });
        bot.vcc.amount = amount;
        bot.vcc.topup_transaction_token = token;
        await bot.save();

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].PROCEED_TITLE, payload: "vcc_add_funds_ip_confirm" },
            { content_type: "text", title: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, payload: "vcc_add_funds_adjust" },
            { content_type: "text", title: "My MasterCard", payload: "vcc_menu" },
        ];

        await quickReply(data, ratesMessage, quickReplies, "vcc_add_funds_ip_confirm");
    }

    // User has confirmed the top-up
    else if (payload === "vcc_add_funds_ip_confirm" && bot?.last_message === "vcc_add_funds_ip_confirm") {
        await handleOTPGeneration(selectedLanguage, senderId, "vcc_add_funds_ip-otp", "vcc_add_funds_ip-otp", "Transaction OTP");
    }

    // User has entered OTP
    else if (bot.last_message === "vcc_add_funds_ip-otp" && text && !payload) {
        const otpValidationResult = await validateOTP(senderId, text, "vcc_add_funds_ip-otp");

        if (otpValidationResult.status) {
            const transactionData = {
                sender_wallet_id: bot.vcc.wallet,
                token: bot.vcc.topup_transaction_token,
                account: bot.account._id
            };
            const transaction = await walletToCardTransactionHelper(transactionData);
            console.log({ transaction });

            if (transaction.status) {
                const message = `Your topup of ${formattedAmount(bot.vcc.amount)} ${transaction.data.currency} was successful.`;

                await sendTemplate(data, senderId, {
                    template_type: "generic",
                    elements: [
                        {
                            title: message,
                            subtitle: `${lang[selectedLanguage].TRANSACTION_ID} ${transaction.data.transactionId}`,
                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                            buttons: [
                                { type: "postback", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                { type: "postback", title: "My MasterCard", payload: "vcc_menu" },
                            ],
                        },
                    ],
                });

            } else {
                await quickMessage(data, "Something went wrong. Please try again. If the problem persists, contact our support team.");
            }
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await quickMessage(data, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessage(data, "vcc_add_funds_ip-otp", selectedLanguage, bot?.otpType);
            }
        }
    }
}

module.exports = { addFunds }