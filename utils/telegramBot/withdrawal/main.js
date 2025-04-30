const { sendButtons, sendMessage, handleCountrySelection, invalidInputResponse, sendPhoto, userKYCVerificationTemplateTelegram, paymentErrorMessageTG } = require("../../telegramBotUtils");
const lang = require("../../../utils/languages/languages.json");
const { getAvailableCountries, fetchCountriesFromThunes, getPayoutChannelName, searchUsersAndWallets, getDistinctObjects, findDefaultPayoutChannel, createWithdrawalDataObject, fetchWithdrawalsCounties, validateAmount } = require("../../instaChatbotUtils");
const { formattedAmount, createWithdrawalTransaction, confirmTransaction, getServices } = require("../../InstaChatbotHelpers");
const Transaction = require("../../../models/Transaction.model");
const countryToEmoji = require('../../../utils/countryEmojis.json');
const { getActiveWalletById, getUserActiveWallets } = require("../../helpers");
const { getExchangeRatesToUSD, checkTransactionLimitsForSender } = require("../../conversion");
const { getWithdrawalFXHelper, createQuotationNewHelper } = require("../../../controllers/Thune.controller");
const currencyToEmoji = require('../../../utils/currencyEmojis.json');
const { handleOTPGenerationTG, validateOTPTG, invalidMessageTG } = require("../telegramOTPHandler");
const Withdrawal = require("../../../models/User-Withdrawal.model");

async function withdrawal(chatId, payload, chat, text, selectedLanguage) {
    if (payload === "withdrawal_default") {

        if (!chat.withdrawal.transaction_id) {
            return await sendButtons(chatId, lang[selectedLanguage].NO_TRANSACTION_FOUND, [
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ]);
        }
        const transactionDetails = await Transaction.findById(chat.withdrawal.transaction_id);
        const defaultPayoutChannel = await findDefaultPayoutChannel(chat.account._id);

        if (!defaultPayoutChannel?.status) {
            return await sendButtons(chatId, lang[selectedLanguage].WRONG_PAYOUT_CHANNEL, [
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ]);
        }

        const walletDetails = await getActiveWalletById(transactionDetails.wallet);

        const channelDetails = defaultPayoutChannel?.channelDetails;
        let exchangedAmountSender = await getExchangeRatesToUSD(transactionDetails.currency.code, 'USD', transactionDetails.amount);
        const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, walletDetails, 'sending', true);

        if (!sender_limits_check.status) {
            return await sendMessage(chatId, sender_limits_check.message);
        }

        const data = createWithdrawalDataObject(
            transactionDetails.amount,
            channelDetails.service_id,
            channelDetails.payer_id,
            defaultPayoutChannel?.country?.country_iso_code,
            walletDetails
        );

        const exchangedRates = await getWithdrawalFXHelper(data);

        if (exchangedRates.success) {
            const rates = exchangedRates?.data?.result;
            let message;

            if (defaultPayoutChannel?.channelType === "bank_details") {
                message = `You are requesting to cash out ${transactionDetails.amount} ${transactionDetails.currency.code} via Bank deposit to account number ${channelDetails?.iban || channelDetails?.account_number} in ${defaultPayoutChannel?.country?.country_name}.`;
            } else if (defaultPayoutChannel?.channelType === "mobile_wallet") {
                message = `You are requesting to cash out ${transactionDetails.amount} ${transactionDetails.currency.code} via Mobile Wallet to ${channelDetails?.wallet_account_number} in ${defaultPayoutChannel?.country?.country_name}.`;
            } else if (defaultPayoutChannel?.channelType === "cash_pickup") {
                message = `You are requesting to cash out ${transactionDetails.amount} ${transactionDetails.currency.code} via Cash Pickup to ${channelDetails?.document_number} in ${defaultPayoutChannel?.country?.country_name}.`;
            }

            let message2;
            if (rates?.total?.currency !== rates?.recipient?.currency) {
                message2 = `\n${message}\n\n${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${rates?.total?.currency ?? "N/A"} = ${rates?.exchanged_rate?.value ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}\n\n${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}\n\nYou'll receive: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}`;
            } else {
                message2 = `\n${message}\n\n${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}\n\nYou'll receive: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}`;
            }

            chat.withdrawal.fx_token = exchangedRates.data.token;
            chat.withdrawal.default_withdrawal = defaultPayoutChannel?.withdrawalId;
            chat.withdrawal.channel = channelDetails;

            await chat.save();

            await sendButtons(chatId, message2, [
                [{ text: lang[selectedLanguage].PROCEED_TO_TRANSFER, callback_data: "withdrawal_default_proceed" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ], "withdrawal_default_proceed");
        } else {
            await sendButtons(chatId, exchangedRates?.message, [
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ]);
        }
    }

    else if (
        (payload === "withdrawal_default_proceed" || payload === "withdrawal_proceed_specified" || payload === "withdrawal_proceed_anoth_default")
        && (chat?.last_message === "withdrawal_default_proceed" || chat?.last_message === "withdrawal_proceed_anoth_default")
    ) {
        if (chat.account?.level?.level_no === 1) {
            await userKYCVerificationTemplateTelegram(chatId, selectedLanguage);
            return;
        }

        await sendMessage(chatId, lang[selectedLanguage].CREATING_TRANSACTION);

        let transactionDetails;
        const another = payload === "withdrawal_proceed_anoth_default";

        if (!another) {
            transactionDetails = await Transaction.findById(chat.withdrawal.transaction_id);
        }

        const data = {
            payerId: chat.withdrawal.channel.payer_id,
            wallet_id: !another ? transactionDetails.wallet.toString() : chat.withdrawal.currency,
            transaction_type: "C2C",
            token: chat?.withdrawal?.fx_token,
            payment_method: "wallet"
        };

        console.log(data, "datainsidecreatequotation");

        const quotationDetails = await createQuotationNewHelper(data);

        console.log({ quotationDetails });

        if (quotationDetails?.status) {
            chat.withdrawal.fx_token = quotationDetails?.token;
            chat.withdrawal.quotation_id = quotationDetails?.QuotationID;
            await chat.save();

            const transactionData = {
                wallet_id: !another ? transactionDetails.wallet.toString() : chat.withdrawal.currency,
                additional_information: "Withdrawal",
                purpose_of_remittance: "FAMILY_SUPPORT",
                account_id: chat.account?._id,
                service_id: chat.withdrawal.channel.service_id,
                payer_id: chat.withdrawal.channel.payer_id,
                transaction_type: "C2C",
                token: chat?.withdrawal?.fx_token,
                quotation_id: chat?.withdrawal?.quotation_id,
                withdrawal_id: chat.withdrawal.default_withdrawal
            };

            console.log(transactionData, "datainsidecreatetransa");

            const createTransactionDetails = await createWithdrawalTransaction(transactionData);

            console.log(createTransactionDetails, "createTransactionDetails");

            if (createTransactionDetails?.status) {
                chat.withdrawal.fx_token = createTransactionDetails?.token;
                await chat.save();

                await handleOTPGenerationTG(selectedLanguage, chat, "withdrawal_default-otp", "withdrawal_default-otp", "Transaction OTP");
            } else {
                await paymentErrorMessageTG(selectedLanguage, chatId);
            }

        } else {
            if (quotationDetails?.message?.includes("Insufficient")) {
                const buttons = [
                    [{ text: lang[selectedLanguage].ADD_FUNDS, callback_data: "add_funds" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                ];
                return await sendButtons(chatId, lang[selectedLanguage].INSUFFICIENT_BALANCE_MESSAGE, buttons);
            } else {
                await paymentErrorMessageTG(selectedLanguage, chatId);
            }
        }
    }

    // Confirming the transaction by validating the OTP
    else if (chat.last_message === "withdrawal_default-otp" && text) {
        console.log("otp", text);
        const otpValidationResult = await validateOTPTG(chatId, text, "withdrawal_default-otp");

        if (!otpValidationResult.status) {
            const confirmTransactionDetails = await confirmTransaction(chat.withdrawal.fx_token, {}, true);
            console.log(confirmTransactionDetails);

            if (confirmTransactionDetails.status) {
                const messageText = lang[selectedLanguage].SUCESSFUL_WITHDRAWAL.replace("{{totalAmount}}",formattedAmount(confirmTransactionDetails?.message?.total?.toFixed(2))).replace("{{currency}}",confirmTransactionDetails?.message?.currency_code) +
                    `${lang[selectedLanguage].TID}: ${confirmTransactionDetails?.message?.TransactionID}\n` +
                    `${lang[selectedLanguage].STATUS}: ${lang[selectedLanguage].PROCESSING}`;

                const buttons = [
                    [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }],
                    [{ text: lang[selectedLanguage].ANOTHER_WITHDRAWAL, callback_data: "withdrawal_another" }],
                    [{ text: lang[selectedLanguage].TRACK_STATUS, callback_data: "my_transactions" }]
                ];

                await sendButtons(chatId, messageText, buttons);
                chat.withdrawal = {}
                await chat.save();
            } else {
                console.log("Transaction failed");

                const messageText = `${lang[selectedLanguage].TRANSACTION_FAILED}\n\n${lang[selectedLanguage].TRY_AGAIN_OR_CONTACT_SUPPORT_SUBTITLE}`;

                const buttons = [
                    [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
                ];

                await sendButtons(chatId, messageText, buttons);
                chat.withdrawal = {}
                await chat.save();
            }
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED);
            } else {
                await invalidMessageTG(chatId, "withdrawal_default-otp", selectedLanguage, chat.otpType);
            }
        }
    }

    // CUSTOM CHANNEL FLOW STARTED
    // User has selected the specify payout channel
    else if (payload === "withdrawal_specify") {
        const countries = await fetchWithdrawalsCounties(chat.account._id);

        let buttons = countries?.countries?.map((country) => {
            return [
                {
                    text: `${countryToEmoji[country.country_iso_code] ?? '🌐'} ${country.country_name}`,
                    callback_data: `withdrawal_specify-${country._id}`,
                },
            ];
        });

        buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);

        const message = lang[selectedLanguage].SELECT_COUNTRY;
        await sendButtons(chatId, message, buttons, "withdrawal_specify");
    }

    else if (payload && payload.startsWith("withdrawal_specify-") && chat?.last_message === "withdrawal_specify") {
        const countryId = payload.split("-")[1];

        const userWithdrawal = await Withdrawal.findOne({ account: chat.account._id, country: countryId });

        chat.withdrawal.default_withdrawal = userWithdrawal?._id;
        await chat.save();

        console.log("chat.account?.country_iso_code", chat.account?.country_iso_code)
        const allowedServices = await getServices(chat.account?.country_iso_code);
        console.log(userWithdrawal, "userWithdrawal", allowedServices);

        let buttons = [];

        if (userWithdrawal) {
            if (allowedServices.MobileWallet.status === "true") {
                if (userWithdrawal?.account_type?.includes("mobile")) {
                    buttons.push([{ text: `✔️${lang[selectedLanguage].MOBILE_WALLET_EMOJI}`, callback_data: `withdrawal_cash_out-mbl-${countryId}` }]);
                } else {
                    buttons.push([{ text: `➕${lang[selectedLanguage].MOBILE_WALLET_EMOJI}`, callback_data: "withdrawal_cash_out_add-mbl" }]);
                }
            }

            if (allowedServices.BankAccount.status === "true") {
                if (userWithdrawal?.account_type?.includes("bank")) {
                    buttons.push([{ text: `✔️${lang[selectedLanguage].BANK_ACCOUNT_EMOJI}`, callback_data: `withdrawal_cash_out-bank-${countryId}` }]);
                } else {
                    buttons.push([{ text: `➕${lang[selectedLanguage].BANK_ACCOUNT_EMOJI}`, callback_data: "withdrawal_cash_out_add-bank" }]);
                }
            }

            if (allowedServices.PaymentCard && allowedServices.PaymentCard.status === "true") {
                if (userWithdrawal?.account_type?.includes("card")) {
                    buttons.push([{ text: `✔️${lang[selectedLanguage].PAYMENT_CARD_EMOJI}`, callback_data: `withdrawal_cash_out-card-${countryId}` }]);
                } else {
                    buttons.push([{ text: `➕${lang[selectedLanguage].PAYMENT_CARD_EMOJI}`, callback_data: "withdrawal_cash_out_add-card" }]);
                }
            }

            if (allowedServices.CashPickup.status === "true") {
                if (userWithdrawal?.account_type?.includes("cash")) {
                    buttons.push([{ text: `✔️${lang[selectedLanguage].CASH}`, callback_data: `withdrawal_cash_out-cash-${countryId}` }]);
                } else {
                    buttons.push([{ text: `➕${lang[selectedLanguage].CASH}`, callback_data: "withdrawal_cash_out_add-cash" }]);
                }
            }
        } else {
            if (allowedServices.MobileWallet.status === "true") {
                buttons.push([{ text: `➕${lang[selectedLanguage].MOBILE_WALLET_EMOJI}`, callback_data: "withdrawal_cash_out_add-mbl" }]);
            }
            if (allowedServices.BankAccount.status === "true") {
                buttons.push([{ text: `➕${lang[selectedLanguage].BANK_ACCOUNT_EMOJI}`, callback_data: "withdrawal_cash_out_add-bank" }]);
            }
            if (allowedServices.PaymentCard && allowedServices.PaymentCard.status === "true") {
                buttons.push([{ text: `➕${lang[selectedLanguage].PAYMENT_CARD_EMOJI}`, callback_data: "withdrawal_cash_out_add-card" }]);
            }
            if (allowedServices.CashPickup.status === "true") {
                buttons.push([{ text: `➕${lang[selectedLanguage].CASH}`, callback_data: "withdrawal_cash_out_add-cash" }]);
            }
        }

        let message = "Choose where you would like to receive your funds:";
        let lastMessage;

        if (buttons.length === 0) {
            buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);
            message = "No payout channels found for your country. Please contact the administrator.";
            lastMessage = "4"
        } else {
            lastMessage = "withdrawal_cash_out"
        }



        await sendButtons(chatId, message, buttons);
    }

    else if (payload?.includes("withdrawal_cash_out-") && chat.last_message === "withdrawal_cash_out") {
        const [_, cashOutChannel, countryId] = payload.split("-");
        let channel;
        const userWithdrawal = await Withdrawal.findOne({ account: chat.account._id, country: countryId }).populate("country");

        if (cashOutChannel === "mbl") {
            channel = userWithdrawal.mobile_wallet[0];
        } else if (cashOutChannel === "bank") {
            channel = userWithdrawal.bank_details[0];
        } else if (cashOutChannel === "card") {
            channel = userWithdrawal.card_card[0];
        } else if (cashOutChannel === "cash") {
            channel = userWithdrawal.cash_pickup[0];
        }

        chat.withdrawal.channel = channel || {};
        await chat.save();

        const transactionDetails = await Transaction.findById(chat.withdrawal.transaction_id);
        const walletDetails = await getActiveWalletById(transactionDetails.wallet)

        if (transactionDetails.amount > walletDetails?.balance?.available) {
            const buttons = [
                [{ text: lang[selectedLanguage].ADD_FUNDS, callback_data: "add_funds" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
            ];
            return await sendButtons(chatId, lang[selectedLanguage].INSUFFICIENT_BALANCE_MESSAGE, buttons);
        }

        let exchangedAmountSender = await getExchangeRatesToUSD(walletDetails.currency.code, 'USD', transactionDetails.amount);
        const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, walletDetails, 'sending', true);

        if (!sender_limits_check.status) {
            return await sendMessage(chatId, sender_limits_check.message);
        }

        const data = createWithdrawalDataObject(
            transactionDetails.amount,
            channel.service_id,
            channel.payer_id,
            userWithdrawal?.country?.country_iso_code,
            walletDetails
        );

        const exchangedRates = await getWithdrawalFXHelper(data);

        if (exchangedRates?.success) {
            const rates = exchangedRates?.data?.result;
            let message;

            if (cashOutChannel === "bank") {
                message = `You are requesting to cash out ${transactionDetails.amount} ${transactionDetails.currency.code} via Bank deposit to account number ${channel?.iban || channel?.account_number} in ${userWithdrawal?.country?.country_name}.`;
            } else if (cashOutChannel === "mbl") {
                message = `You are requesting to cash out ${transactionDetails.amount} ${transactionDetails.currency.code} via Mobile Wallet to ${channel?.wallet_account_number} in ${userWithdrawal?.country?.country_name}.`;
            } else if (cashOutChannel === "cash") {
                message = `You are requesting to cash out ${transactionDetails.amount} ${transactionDetails.currency.code} via Cash Pickup to ${channel?.document_number} in ${userWithdrawal?.country?.country_name}.`;
            }

            let message2;

            if (rates?.total?.currency !== rates?.recipient?.currency) {
                message2 = `${message}\n\n${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${rates?.total?.currency ?? "N/A"} = ${formattedAmount(rates?.exchanged_rate?.value) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}\n${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}\nYou'll receive: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}`;
            } else {
                message2 = `${message}\n\n${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}\nYou'll receive: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}`;
            }

            const buttons = [
                [{ text: lang[selectedLanguage].PROCEED_TO_TRANSFER, callback_data: "withdrawal_proceed_specified" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];

            await sendButtons(chatId, message2, buttons, "withdrawal_default_proceed");

            chat.withdrawal.fx_token = exchangedRates.data.token;
            await chat.save();
        } else {
            await sendButtons(chatId, exchangedRates?.message, [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]);
        }
    }

    else if (payload && (payload?.startsWith("withdrawal_cash_out_add-") || payload === "withdrawal_add")) {
        const message = `
    ${payload === "add_withdrawal" ? "" : "This withdrawal channel is not set up in your account yet."}
    
Please follow the below steps to set up the withdrawal channel. 👇
    
1⃣ Login to InstaPay web.
 2️⃣ Navigate to the Settings page.
3⃣ Select the "Withdrawal Channels" option from the sub-menu. 
4⃣ Enter the channel details and click save.`;

        await sendMessage(chatId, message);

        const buttons = [
            [{ text: lang[selectedLanguage].LOGIN, url: "https://my.insta-pay.ch/login" }],
            [{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]
        ];

        await sendButtons(chatId, "Tap below to login and set the withdrawal channel or you can always go to the Main Menu for more options 🙌", buttons);
    }

    // ANOTHER WITHDRAWAL FLOW
    else if (payload === "withdrawal_another") {
        let message = "Where would you like to cash out?";

        const buttons = [
            [{ text: "Default Account", callback_data: "withdrawal_another_default" }],
            [{ text: "Specify Account", callback_data: "withdrawal_another_specify" }],
        ];

        await sendButtons(chatId, message, buttons, "withdrawal_another");
    }

    // ANOTHER WITHDRAWAL - DEFAULT FLOW
    else if (payload === "withdrawal_another_default" && chat?.last_message === "withdrawal_another") {
        const defaultPayoutChannel = await findDefaultPayoutChannel(chat.account._id);

        if (!defaultPayoutChannel?.status) {
            const buttons = [
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ];

            return await sendButtons(chatId, lang[selectedLanguage].WRONG_PAYOUT_CHANNEL, buttons);
        }

        chat.withdrawal.default_withdrawal = defaultPayoutChannel?.withdrawalId;
        await chat.save();

        const wallets = await getUserActiveWallets(chat.account._id);
        const slicedWallets = wallets.slice(0, 8);

        const buttons = slicedWallets.map((wallet) => {
            return [
                {
                    text: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`,
                    callback_data: `withdrawal_w_another-default-${wallet._id}`,
                },
            ];
        });

        await sendButtons(chatId, lang[selectedLanguage].PICK_CURRENCY_MESSAGE, buttons, "withdrawal_w_another");
    }

    else if (payload?.startsWith("withdrawal_w_another-") && chat?.last_message === "withdrawal_w_another") {
        const [_, withdrawalFlow, walletId] = payload.split('-');
        const walletDetails = await getActiveWalletById(walletId);

        chat.withdrawal.currency = walletId;
        chat.withdrawal.withdrawal_flow = withdrawalFlow;
        await chat.save();

        const message = `${lang[selectedLanguage].CURRENTLY_HAVE.replace('{{amount}}', formattedAmount(walletDetails?.balance?.available)).replace('{{currency}}', walletDetails.currency.code)}\n\n${lang[selectedLanguage].PROCEED_OR_SELECT_WALLET}`;

        const buttons = [
            [{ text: lang[selectedLanguage].PROCEED_TITLE, callback_data: `withdrawal_another_${withdrawalFlow}_proceed` }],
            [{ text: "Another Wallet", callback_data: "another_withdrawal" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ];

        await sendButtons(chatId, message, buttons, `withdrawal_another_${withdrawalFlow}`);
    }

    else if (payload === "withdrawal_another_default_proceed" && chat?.last_message === "withdrawal_another_default") {
        const message = "Please enter your amount in digits to withdraw.";

        await sendMessage(chatId, message, "withdrawal_another_default_proceed");
    }

    else if (chat.last_message === "withdrawal_another_default_proceed" && text) {
        const { status, message: validationMessage, amount } = validateAmount(text, selectedLanguage);

        if (!status) {
            await sendMessage(chatId, validationMessage);
            return;
        }

        const walletDetails = await getActiveWalletById(chat.withdrawal.currency)

        const defaultPayoutChannel = await findDefaultPayoutChannel(chat.account._id);
        if (!defaultPayoutChannel?.status) {
            return await sendButtons(chatId, lang[selectedLanguage].WRONG_PAYOUT_CHANNEL, [
                { text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }
            ]);
        }

        console.log(defaultPayoutChannel, "defaultPayoutChannel", walletDetails);
        const channelDetails = defaultPayoutChannel?.channelDetails;
        let exchangedAmountSender = await getExchangeRatesToUSD(walletDetails.currency.code, 'USD', amount);
        const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, walletDetails, 'sending', true);

        if (!sender_limits_check.status) {
            return await sendMessage(chatId, sender_limits_check.message);
        }

        const data = createWithdrawalDataObject(amount, channelDetails.service_id, channelDetails.payer_id, defaultPayoutChannel?.country?.country_iso_code, walletDetails);
        console.log({ data });
        const exchangedRates = await getWithdrawalFXHelper(data);
        console.log(exchangedRates, "exchangedRates");

        if (exchangedRates?.success) {
            const rates = exchangedRates?.data?.result;
            let message;

            if (defaultPayoutChannel?.channelType === "bank_details") {
                message = `You are requesting to cash out ${amount} ${walletDetails.currency.code} via Bank deposit to account number ${channelDetails?.iban || channelDetails?.account_number} in ${defaultPayoutChannel?.country?.country_name}.`;
            } else if (defaultPayoutChannel?.channelType === "mobile_wallet") {
                message = `You are requesting to cash out ${amount} ${walletDetails.currency.code} via Mobile Wallet to ${channelDetails?.wallet_account_number} in ${defaultPayoutChannel?.country?.country_name}.`;
            } else if (defaultPayoutChannel?.channelType === "cash_pickup") {
                message = `You are requesting to cash out ${amount} ${walletDetails.currency.code} via Cash Pickup to ${channelDetails?.document_number} in ${defaultPayoutChannel?.country?.country_name}.`;
            }

            let message2;
            if (rates?.total?.currency !== rates?.recipient?.currency) {
                message2 = `\n${message}\n\n${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${rates?.total?.currency ?? "N/A"} = ${rates?.exchanged_rate?.value ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}\n${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}\nYou'll receive: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}`;
            } else {
                message2 = `\n${message}\n\n${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}\nYou'll receive: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}`;
            }

            chat.withdrawal.fx_token = exchangedRates.data.token;
            chat.withdrawal.default_withdrawal = defaultPayoutChannel?.withdrawalId;
            chat.withdrawal.amount = amount;
            chat.withdrawal.channel = channelDetails;
            await chat.save();

            await sendButtons(chatId, message2, [
                [{ text: lang[selectedLanguage].PROCEED_TO_TRANSFER, callback_data: "withdrawal_proceed_anoth_default" }],
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ], "withdrawal_proceed_anoth_default");
            console.log(message, "message");
        } else {
            await sendButtons(chatId, exchangedRates?.message, [
                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            ]);
        }

    }

    // ANOTHER WITHDRAWAL - CUSTOM FLOW
    // Custom channel flow - another flow starts here
    else if (payload === "withdrawal_another_specify" && chat?.last_message === "withdrawal_another") {
        const countries = await fetchWithdrawalsCounties(chat.account._id);

        if (!countries?.countries?.length) {
            return await sendMessage(chatId, "No countries available.");
        }

        const buttons = countries.countries.map((country) => [
            {
                text: `${countryToEmoji[country.country_iso_code] ?? '🌐'} ${country.country_name}`,
                callback_data: `withdrawal_anoth_c_specify-${country._id}`,
            },
        ]);

        await sendButtons(chatId, "Select country", buttons, "withdrawal_anoth_c_specify_country");
    }
    else if (payload && payload.startsWith("withdrawal_anoth_c_specify") && chat?.last_message === "withdrawal_anoth_c_specify_country") {
        const countryId = payload.split("-")[1];

        console.log(countryId, "countryId");
        const userWithdrawal = await Withdrawal.findOne({ account: chat.account._id, country: countryId });

        const allowedServices = await getServices(chat.account?.country_iso_code);

        chat.withdrawal.default_withdrawal = userWithdrawal?._id;
        await chat.save();
        console.log(userWithdrawal, "userWithdrawal", allowedServices);

        let buttons = [];

        if (userWithdrawal) {
            if (allowedServices.MobileWallet.status === "true") {
                if (userWithdrawal?.account_type?.includes("mobile")) {
                    buttons.push([{ text: `✔️${lang[selectedLanguage].MOBILE_WALLET_EMOJI}` , callback_data: `withdrawal_cash_anoth_out-mbl-${countryId}` }]);
                } else {
                    buttons.push([{ text: `➕${lang[selectedLanguage].MOBILE_WALLET_EMOJI}` , callback_data: "withdrawal_cash_out_add-mbl" }]);
                }
            }

            if (allowedServices.BankAccount.status === "true") {
                if (userWithdrawal?.account_type?.includes("bank")) {
                    buttons.push([{ text: `✔️${lang[selectedLanguage].BANK_ACCOUNT_EMOJI}`, callback_data: `withdrawal_cash_anoth_out-bank-${countryId}` }]);
                } else {
                    buttons.push([{ text: `➕${lang[selectedLanguage].BANK_ACCOUNT_EMOJI}`, callback_data: "withdrawal_cash_out_add-bank" }]);
                }
            }

            if (allowedServices.PaymentCard && allowedServices.PaymentCard.status === "true") {
                if (userWithdrawal?.account_type?.includes("card")) {
                    buttons.push([{ text: `✔️${lang[selectedLanguage].PAYMENT_CARD_EMOJI}`, callback_data: `withdrawal_cash_anoth_out-card-${countryId}` }]);
                } else {
                    buttons.push([{ text: `➕${lang[selectedLanguage].PAYMENT_CARD_EMOJI}`, callback_data: "withdrawal_cash_out_add-card" }]);
                }
            }

            if (allowedServices.CashPickup.status === "true") {
                if (userWithdrawal?.account_type?.includes("cash")) {
                    buttons.push([{ text: `✔️${lang[selectedLanguage].CASH}`, callback_data: `withdrawal_cash_anoth_out-cash-${countryId}` }]);
                } else {
                    buttons.push([{ text: `➕${lang[selectedLanguage].CASH}`, callback_data: "withdrawal_cash_out_add-cash" }]);
                }
            }
        } else {
            if (allowedServices.MobileWallet.status === "true") {
                buttons.push([{ text: `➕${lang[selectedLanguage].MOBILE_WALLET_EMOJI}`, callback_data: "withdrawal_cash_out_add-mbl" }]);
            }
            if (allowedServices.BankAccount.status === "true") {
                buttons.push([{ text: `➕${lang[selectedLanguage].BANK_ACCOUNT_EMOJI}`, callback_data: "withdrawal_cash_out_add-bank" }]);
            }
            if (allowedServices.PaymentCard && allowedServices.PaymentCard.status === "true") {
                buttons.push([{ text: `➕${lang[selectedLanguage].PAYMENT_CARD_EMOJI}`, callback_data: "withdrawal_cash_out_add-card" }]);
            }
            if (allowedServices.CashPickup.status === "true") {
                buttons.push([{ text: "➕ Cash", callback_data: "withdrawal_cash_out_add-cash" }]);
            }
        }

        let message = "Choose where you would like to receive your funds:";
        let lastMessage;
        if (buttons.length === 0) {
            buttons.push([{ text: lang[selectedLanguage].MAIN_MENU_MESSAGE, callback_data: "main_menu" }]);
            message = "No payout channels found for your country. Please contact the administrator.";
            lastMessage = "4"
        } else {
            lastMessage = "withdrawal_cash_anoth_out"
        }

        await sendButtons(chatId, message, buttons, lastMessage);
    }

    else if (payload?.startsWith("withdrawal_cash_anoth_out") && chat?.last_message === "withdrawal_cash_anoth_out") {
        const [, cashOutChannel, countryId] = payload.split("-");
        chat.withdrawal.country = countryId;

        let channel;
        const userWithdrawal = await Withdrawal.findOne({ account: chat.account._id, country: countryId }).populate("country");

        if (cashOutChannel === "mbl") {
            channel = userWithdrawal.mobile_wallet[0];
        } else if (cashOutChannel === "bank") {
            channel = userWithdrawal.bank_details[0];
        } else if (cashOutChannel === "card") {
            channel = userWithdrawal.card_card[0];
        } else if (cashOutChannel === "cash") {
            channel = userWithdrawal.cash_pickup[0];
        }

        chat.withdrawal.channel = channel || {};
        await chat.save();

        const wallets = await getUserActiveWallets(chat.account._id);
        const slicedWallets = wallets.slice(0, 8);

        const buttons = slicedWallets.map(wallet => [
            { text: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, callback_data: `withdrawal_w_another-specify-${wallet._id}` }
        ]);

        const message = lang[selectedLanguage].PICK_CURRENCY_MESSAGE;
        await sendButtons(chatId, message, buttons, "withdrawal_w_another");
    }

    else if (payload === "withdrawal_another_specify_proceed" && chat?.last_message === "withdrawal_another_specify") {
        const message = "Please enter your amount in digits to withdraw.";

        await sendMessage(chatId, message, "withdrawal_another_specify_proceed");
    }

    else if (chat.last_message === "withdrawal_another_specify_proceed" && text) {

        const { status, message: validationMessage, amount } = validateAmount(text, selectedLanguage);

        if (!status) {
            await sendMessage(chatId, validationMessage);
            return;
        }

        const walletDetails = await getActiveWalletById(chat.withdrawal.currency)


        const channelDetails = chat.withdrawal.channel;
        let exchangedAmountSender = await getExchangeRatesToUSD(walletDetails.currency.code, 'USD', amount);

        const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, walletDetails, 'sending', true);

        if (!sender_limits_check.status) {
            await sendMessage(chat.id, sender_limits_check.message);
            return;
        }

        const countryDetails = await CountryModel.findById(chat.withdrawal.country);
        const data = createWithdrawalDataObject(amount, channelDetails.service_id, channelDetails.payer_id, countryDetails.country_iso_code, walletDetails);

        const exchangedRates = await getWithdrawalFXHelper(data);

        if (exchangedRates?.success) {
            const rates = exchangedRates?.data?.result;
            const withdrawalDetails = await Withdrawal.findById(chat.withdrawal.default_withdrawal).populate("country");

            let message;
            if (channelDetails?.service_id == 2) {
                message = `You are requesting to cash out ${amount} ${walletDetails.currency.code} via Bank deposit to account number ${channelDetails?.iban || channelDetails?.account_number} in ${withdrawalDetails?.country?.country_name}.`;
            } else if (channelDetails?.service_id == 1) {
                message = `You are requesting to cash out ${amount} ${walletDetails.currency.code} via Mobile Wallet to ${channelDetails?.wallet_account_number} in ${withdrawalDetails?.country?.country_name}.`;
            } else if (channelDetails?.service_id == 3) {
                message = `You are requesting to cash out ${amount} ${walletDetails.currency.code} via Cash Pickup to ${channelDetails?.document_number} in ${withdrawalDetails?.country?.country_name}.`;
            }

            let message2;
            if (rates?.total?.currency !== rates?.recipient?.currency) {
                message2 = `${message}\n\nExchange Rate: 1.00 ${rates?.total?.currency ?? "N/A"} = ${rates?.exchanged_rate?.value ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}\nFee: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}\nYou'll receive: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}`;
            } else {
                message2 = `${message}\n\nFee: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}\nYou'll receive: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}`;
            }

            chat.withdrawal.fx_token = exchangedRates.data.token;
            chat.withdrawal.amount = amount;
            chat.withdrawal.channel = channelDetails;
            await chat.save();

            const buttons = [
                [{ text: "Proceed to Transfer", callback_data: "withdrawal_proceed_anoth_default" }],
                [{ text: "Main Menu", callback_data: "main_menu" }]
            ];

            await sendButtons(chat.id, message2, buttons, "withdrawal_proceed_anoth_default");
        } else {
            const buttons = [[{ text: "Main Menu", callback_data: "main_menu" }]];
            await sendButtons(chat.id, exchangedRates?.message, buttons);
        }

    }

}

module.exports = { withdrawal }