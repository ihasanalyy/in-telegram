const Wallet = require("../../../models/Wallet.model");
const lang = require("../../languages/languages.json");
const currencyToEmoji = require('../../currencyEmojis.json');
const { checkTransactionLimitsForSender } = require("../../conversion");
const { calculateExchangeAndFees, getExchangeRatesToUSD, getUserActiveWallets, getMaxValidExpiryDateVCC, getActiveWalletById, fetchLocalOrDefaultWalletConditionally, limitCheck, featureCheck, getActiveWallet, balanceLimitCheck } = require("../../helpers");
const { formattedAmount, walletToWalletTransaction } = require("../../InstaChatbotHelpers");
const { validateAmount, usersFeatureMessage, userLimitsMessage, generateToken } = require("../../instaChatbotUtils");
const { sendButtons, sendMessage, invalidInputResponse, w2wMethods, processVideoUploads, processImageUploads, sendPhoto, somethingWentWrongQuickReplyTelegram } = require("../../telegramBotUtils");
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler");
const Schedule = require("../../../models/Schedule.model");
const FeeModel = require("../../../models/Fee.model");
const { formatDecimalNumbersWithLimit } = require("../../payerRates");
const supportedCurrencies = require("../../paypalSupportedCurrencies.json");
const Transaction = require("../../../models/Transaction.model");
const jwt = require("jsonwebtoken")
const paypalUrl = process.env.PAYPAL_URL
const iso2Countries = require("../../countries_iso2.json");
const moment = require('moment-timezone');

const axios = require("axios")
async function premiumCardCreationUsingPaypal(chatId, payload, chat, text, selectedLanguage, data, image_payloads, video_payloads) {
    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(chat.account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReplyTelegram(chatId, lang[selectedLanguage].NO_DEFAULT_WALLET_SET, selectedLanguage);
    }
    // user has selected paypal
    if (payload === "activate_vcc_v_p_a_ppl" && chat?.last_message === "activate_vcc_v_p_a_payment_method") {
        const walletDetails = await getActiveWalletById(defaultWallet._id);

        let serviceName;
        if (chat.vcc?.isPremiumPlus) {
            serviceName = "vcc_premium_plus_virtual";
        } else {
            serviceName = "vcc_premium_virtual";
        }

        const vccFee = await FeeModel.findOne({ $and: [{ service_name: serviceName }, { account_level: chat.account.level._id }] });

        const convertedFee = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD('USD', walletDetails.currency.code, vccFee.flat_fee));

        let message = lang[selectedLanguage].CONFIRM_CARD_DETAILS_PREMIUM.replace("{{currency}}", walletDetails.currency.code).replace("{{amount}}", formattedAmount(convertedFee));

        let paypalMessage = "";
        let payload = {
            fee: convertedFee,
            currency: walletDetails.currency.code,
        }

        if (!supportedCurrencies.includes(walletDetails.currency.code)) {
            const paypalFX = await getExchangeRatesToUSD(walletDetails.currency.code, 'USD', 1);

            payload.currency_supported = false;
            payload.converted_fee = formatDecimalNumbersWithLimit(paypalFX * convertedFee);
            payload.paypal_rate = formattedAmount(paypalFX, 6);

            paypalMessage = `
${lang[selectedLanguage].PAYPAL_CURRENCY_NOT_SUPPORTED.replace('{{currency}}', walletDetails.currency.code)}\n
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${walletDetails.currency.code} = ${formattedAmount(paypalFX, 6)} USD
${lang[selectedLanguage].AMOUNT_IN_USD} ${formattedAmount(formatDecimalNumbersWithLimit(paypalFX * convertedFee))} USD`;
        }

        const token = jwt.sign(payload, process.env.jwtKey, { expiresIn: "10m" });
        chat.vcc.token = token;
        await chat.save()

        const buttons = [
            [{ text: lang[selectedLanguage].CONFIRM, callback_data: "activate_vcc_v_p_a_ppl_confirm" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
        ];

        if (paypalMessage) {
            await sendMessage(chatId, message);
            await sendButtons(chatId, paypalMessage, buttons, "activate_vcc_v_p_a_ppl_confirm");
        } else {
            await sendButtons(chatId, message, buttons, "activate_vcc_v_p_a_ppl_confirm");
        }
    }

    // user has confirmed
    else if (payload === "activate_vcc_v_p_a_ppl_confirm" && chat?.last_message === "activate_vcc_v_p_a_ppl_confirm") {
        await handleOTPGenerationTG(selectedLanguage, chat, "activate_vcc_v_p_a_ppl-otp", "activate_vcc_v_p_a_ppl-otp", "Transaction OTP");
    }

    // User has entered OTP for instant transfer
    else if (chat.last_message === "activate_vcc_v_p_a_ppl-otp" && !payload && text) {
        const otpValidationResult = await validateOTPTG(chatId, text, "activate_vcc_v_p_a_ppl-otp");

        if (otpValidationResult.status) {
            jwt.verify(chat.vcc.token, process.env.jwtKey, async function (err, payload) {
                if (err) {
                    return await sendButtons(chatId, lang[selectedLanguage].TRANSACTION_EXPIRED, [[{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]], "4");
                }

                let serviceName;
                if (chat.vcc?.isPremiumPlus) {
                    serviceName = "vcc_premium_plus_virtual";
                } else {
                    serviceName = "vcc_premium_virtual";
                }

                const { fee, currency, currency_supported, converted_fee, paypal_rate } = payload;

                const vccToken = jwt.sign({ expdate: getMaxValidExpiryDateVCC(), currency: 'USD', cardType: serviceName, apple_pay: true, google_pay: false }, process.env.jwtKey, { expiresIn: "10m" });

                const transaction = await initiateCardCreationPaypalHelper({ wallet_id: defaultWallet.wallet_id, fee, currency, currency_supported, converted_fee, paypal_rate, card_type: serviceName, token: vccToken, platform: "telegram" });

                if (transaction?.status) {
                    const message = `
${lang[selectedLanguage].VERIFY_PAYPAL_ACCOUNT}
    
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(fee)} ${defaultWallet?.currency?.code}
                `;

                    const buttons = [
                        [{ text: lang[selectedLanguage].VERIFY, url: transaction?.url }],
                        [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                    ];

                    await sendButtons(chatId, message, buttons);
                } else {
                    const buttons = [
                        [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                    ];
                    await sendButtons(chatId, transaction?.message || lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR, buttons);
                }

            })
        }
        else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessageTG(chatId, "activate_vcc_v_p_a_ppl-otp", selectedLanguage, chat?.otpType);
            }
        }
    }
}

async function initiateCardCreationPaypalHelper({ wallet_id, fee, currency, currency_supported, converted_fee, paypal_rate, card_type, token, platform }) {
    try {
        // return console.log(data)
        const ref = 'tr_' + Date.now().toString();

        const receiverWallet = await getActiveWallet(wallet_id);

        if (!receiverWallet) {
            return { status: false, message: "Topup Wallet not found." };
        }

        const featureChecked = featureCheck('topup_channel', 'paypal', receiverWallet.account.level);
        if (!featureChecked) {
            return { status: false, message: "This service is not allowed." };
        }

        const paypalAmount = currency_supported
            ? fee
            : converted_fee;
        const paypalCurrency = currency_supported
            ? currency
            : "USD";

        let amountInUSD

        if (currency_supported) {
            amountInUSD = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(
                currency,
                'USD',
                fee
            ));
        } else {
            amountInUSD = converted_fee;
        }

        const balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account);
        const limitChecked = limitCheck(parseFloat(amountInUSD), receiverWallet.account.level, receiverWallet.account, 'topup');

        if (!limitChecked.status || !balanceLimitChecked) {
            return {
                status: false,
                message: !limitChecked.status
                    ? "Transaction limit exceeded."
                    : "Balance limit exceeded."
            };
        }

        const api = `${paypalUrl}/oauth2/token`;
        const tokenResponse = await axios.post(api, 'grant_type=client_credentials', {
            auth: {
                username: process.env.PAYPAL_CLIENT_ID,
                password: process.env.PAYPAL_SECRET
            }
        });

        const paymentApi = `${paypalUrl}/payments/payment`;
        const paymentObj = {
            intent: "sale",
            payer: { payment_method: "paypal" },
            transactions: [{
                amount: {
                    total: paypalAmount.toFixed(2),
                    currency: paypalCurrency
                },
                description: receiverWallet.account.username,
                custom: receiverWallet.wallet_id,
                item_list: {
                    shipping_address: {
                        recipient_name: `${receiverWallet.account.first_name} ${receiverWallet.account.last_name}`,
                        line1: receiverWallet.account.address || receiverWallet.account.country_iso_code,
                        city: receiverWallet.account.city || "",
                        country_code: iso2Countries[receiverWallet.account.country_iso_code] || "CH",
                        postal_code: receiverWallet.account.postal_code || "",
                        phone: receiverWallet.account.phone || ""
                    }
                }
            }],
            redirect_urls: {
                return_url: `https://my.insta-pay.ch/chatbot/paypal-transaction/success/${ref}?flow=${card_type}${platform ? `&platform=${platform}` : ''}`,
                cancel_url: `https://my.insta-pay.ch/chatbot/paypal-transaction/failed/${ref}?flow=${card_type}${platform ? `&platform=${platform}` : ''}`
            }
        };

        const resp1 = await axios.post(paymentApi, paymentObj, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + tokenResponse.data.access_token
            }
        });

        if (resp1.data.state !== 'created') {
            return { status: false, message: "Transaction failed during PayPal processing." };
        }

        const transaction = await Transaction.create({
            reference_id: ref,
            type: 'instant',
            transaction_type: 'credit',
            service_type: 'mastercard',
            payment_type: 'paypal',
            status: 'INITIATED',
            description: 'Topup by Paypal - Master Card',
            payment_id: resp1.data.id,
            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
            replacement_currency: { code: paypalCurrency, value: paypalAmount.toFixed(2), rate: paypal_rate },
            amount: fee,
            fee: fee,
            total: fee,
            wallet_id: receiverWallet.wallet_id,
            wallet: receiverWallet._id,
            account: receiverWallet.account._id,
            receiver: receiverWallet.account._id,
            current_balance: receiverWallet.balance.available,
            hidden: true,
            external_token: {
                token,
                type: `vcc_creation_${card_type.includes("vcc_premium_plus") ? "premium_plus" :
                    card_type.includes("vcc_standard") ? "standard" : "premium"}_bot_${platform}`
            },
            notificationNotSent: true,
            timeline: [{ status: 'INITIATED', date: moment().tz(receiverWallet.account.timezone || "UTC").format() }]
        });

        const link = resp1.data.links.find(l => l.rel === 'approval_url');
        return {
            status: true,
            message: "Transaction initiated successfully.",
            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
            transaction_id: transaction._id,
            transaction_ref: transaction.reference_id,
            url: link ? link.href : ''
        };

    } catch (err) {
        console.error(err);
        return { status: false, message: "Internal server error!", error: err };
    }
};

module.exports = { premiumCardCreationUsingPaypal, initiateCardCreationPaypalHelper }