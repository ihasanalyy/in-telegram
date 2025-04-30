const { quickMessage, quickReply, sendTemplate, userKYCVerificationTemplate, validateAttachments, processIntlProceedTransfer, somethingWentWrongQuickReply } = require("../../instaChatbotUtils");
const CryptoJS = require("crypto-js");
const lang = require('../../languages/languages.json');
const PanModel = require("../../../models/Pan.model");
const Wallet = require("../../../models/Wallet.model");
const { balanceLimitCheck, limitCheck, featureCheck, getExchangeRatesToUSD, fetchLocalOrDefaultWalletConditionally, validateCardExpiry } = require("../../helpers");
const { topUpFeeCalculation, generatePayload } = require("../../../controllers/Trust-Payment.controller");

const Transaction = require("../../../models/Transaction.model");
const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const { checkTransactionLimitsForSender } = require('../../conversion');
const { formattedAmount, uploadToS3, createTransaction, getPayerNames } = require("../../InstaChatbotHelpers");
const { handleOTPGeneration, validateOTP, invalidMessage } = require("../../instaChatbotOTP");
const { getIntlFXHelper, createQuotationNewHelper } = require("../../../controllers/Thune.controller");
const Beneficiary = require("../../../models/Beneficiary.model");
const User = require("../../../models/User.model");
const topupTransactionDataTokenKey = "bac6723rd@#dn#aFw%%Y%VSV"
const countriesIso = require('../../countries_iso2.json');

const secretKey = process.env.jwtKey;

const initiateTopUpSavedCard = async (wallet_id, amount, pan) => {
    try {
        let ref = 'tr_' + Date.now().toString();
        console.log(wallet_id, amount, pan, 'w2w_data')
        if (!wallet_id || !amount || !pan) {
            return { status: false, message: "Required fields are missing." };
        }
        amount = parseInt(amount)

        let receiverWallet = await Wallet.findOne({
            $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] },
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] },
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] },
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] }
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }]);

        if (!receiverWallet) {
            return { status: false, message: "Wallet not found or inactive." };
        }

        let panDetails = await PanModel.findOne({ $and: [{ _id: pan }, { account: receiverWallet.account._id }] });
        if (!panDetails) {
            return { status: false, message: "Invalid Card Details." };
        }

        console.log({ panDetails })
        let bytes = await CryptoJS.AES.decrypt(panDetails.panData, process.env.PAN_ENCRYPTION_KEY);
        let panDataObj = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        console.log({ panDataObj })
        let amountInUSD = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount / 100);

        let feeDetails = await topUpFeeCalculation(receiverWallet, amount / 100, 'topup_card_payment');
        let featureChecked = await featureCheck('topup_channel', 'card_payment', receiverWallet.account.level);

        if (featureChecked && feeDetails >= 0) {
            let balanceLimitChecked = await balanceLimitCheck(parseInt(amountInUSD), receiverWallet.account);
            let limitChecked = limitCheck(parseFloat(amountInUSD), receiverWallet.account.level, receiverWallet.account, 'topup');

            if (limitChecked.status && balanceLimitChecked) {
                const receiverTimezone = receiverWallet.account?.timezone || "UTC";
                const receiverCurrentTime = moment().tz(receiverTimezone).format();

                let receiverTransactionObj = {
                    reference_id: ref,
                    type: 'trust_payment',
                    transaction_type: 'credit',
                    service_type: 'topup',
                    payment_type: 'card',
                    status: 'INITIATED',
                    description: 'Topup by Saved Card - International Transaction',
                    currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                    amount: (amount / 100) - feeDetails,
                    fee: feeDetails,
                    total: amount / 100,
                    wallet_id: receiverWallet.wallet_id,
                    wallet: receiverWallet._id,
                    account: receiverWallet.account._id,
                    receiver: receiverWallet.account._id,
                    current_balance: receiverWallet.balance.available,
                    hidden: true,
                    timeline: [{ status: 'INITIATED', date: receiverCurrentTime }]
                };

                let transaction = await Transaction.create(receiverTransactionObj);

                const iat = Math.floor(Date.now() / 1000);

                const payload = generatePayload(amount / 100, receiverWallet, panDataObj, transaction, iat, true, false, "instagram");

                console.log({ payload })
                const token = jwt.sign(payload, process.env.TRUST_PAYMENT_SECRET, { algorithm: 'HS256' });

                if (token) {
                    return {
                        status: true,
                        message: "Transaction initiated successfully.",
                        data: {
                            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                            transaction_id: transaction._id,
                            transaction_ref: transaction.reference_id,
                            token
                        }
                    };
                } else {
                    return { status: false, message: "Transaction failed." };
                }
            } else {
                let errorMsg = !limitChecked.status ? "Limit check failed." : "Balance limit exceeded.";
                return { status: false, message: errorMsg };
            }
        } else {
            return { status: false, message: "This service is not allowed." };
        }
    } catch (err) {
        console.log(err);
        return { status: false, message: "Internal server error!" };
    }
};

async function intlUsingCard(senderId, payload, account, bot, text, selectedLanguage, attachments) {

    const data = {
        sender: {
            id: senderId
        }
    }

    // const defaultWallet = await Wallet.findOne({ account: account._id, default: true }).populate([{ path: "account", populate: "level" }])
    const defaultWallet = await fetchLocalOrDefaultWalletConditionally(account._id)
    if (!defaultWallet) {
        return await somethingWentWrongQuickReply(data, lang[selectedLanguage].NO_DEFAULT_WALLET_SET);
    }

    if (payload === "intl_card_payment") {
        const pans = await PanModel.find({ account: account._id });
        console.log(pans)

        let quickReplies = []

        if (pans.length !== 0) {

            for (let i = 0; i < pans.length; i++) {
                quickReplies.push({
                    content_type: "text",
                    title: `💳 *******${pans[i].last4}`,
                    payload: `intl_card_payment_select_card-${pans[i]._id}`
                })
            }

            quickReplies.push({
                content_type: "text",
                title: lang[selectedLanguage].CHANGE_PAYMENT_METHOD,
                payload: `change_payment_method_intl`
            })

            quickReplies.push({
                content_type: "text",
                title: `☰ ${lang[selectedLanguage].MAIN_MENU}`,
                payload: `main_menu`
            })

            await quickReply(data, lang[selectedLanguage].SELECT_YOUR_TOPUP_CHANNEL, quickReplies, "4");
        } else {
            quickReplies.push({
                content_type: "text",
                title: `☰ ${lang[selectedLanguage].MAIN_MENU}`,
                payload: `main_menu`
            })
            await quickReply(data, lang[selectedLanguage].NO_CARD_SAVED, quickReplies, "4");
        }
    }

    // user has selected topup channel
    else if (payload?.includes("intl_card_payment_select_card")) {
        const cardId = payload.split("-")[1];

        const expiryValidation = await validateCardExpiry(cardId);

        if (!expiryValidation.status) {
            const pans = await PanModel.find({ account: account._id });

            if (pans.length !== 0) {
                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].PAYMENT_CARD, payload: "intl_card_payment" },
                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "intl_using_w2w" },
                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "intl_paypal_payment" },
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                ];
                await quickReply(
                    data,
                    "The card you selected has expired and is now removed from your InstaPay account.\n\n" +
                    "To continue with this transaction, please choose an alternative payment method.",
                    quickReplies,
                    "4"
                );
            } else {
                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "intl_using_w2w" },
                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "intl_paypal_payment" },
                    { content_type: "text", title: lang[selectedLanguage].ADD_PAYMENT_CARD, payload: "add_payment_card-continue_back_intl_payout" },
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                ];
                await quickReply(
                    data,
                    "The card you selected has expired and is now removed from your InstaPay account.\n\n" +
                    "To continue with this transaction, please choose an alternative payment method.",
                    quickReplies,
                    "4"
                );
            }
            return;
        }

        bot.intl.card_payment.pan = cardId
        await bot.save()

        const message = lang[selectedLanguage].ENTER_AMOUNT_CURRENCY.replace(
            '{{currency}}',
            defaultWallet?.currency.code
        )
        await quickMessage(data, message, "intl_card_payment_amount")
    }

    // user has entered amount
    else if (bot?.last_message === "intl_card_payment_amount" && !payload && text) {
        console.log(text)

        const digitRegex = /^\d+(\.\d+)?$/;
        const isNumber = digitRegex.test(text)
        const amount = parseFloat(text);

        if (isNumber && amount >= 1) {

            bot.intl.card_payment.amount = amount

            let channel_name, service_name;
            if (bot.intl_payout_method === "1") {
                channel_name = "mobile_money";
                service_name = "international_mobile_wallet";
            } else if (bot.intl_payout_method === "2") {
                channel_name = "bank_account";
                service_name = "international_bank_transfer";
            } else if (bot.intl_payout_method === "3") {
                channel_name = "cash_pickup";
                service_name = "international_cash_pickup";
            } else {
                channel_name = "card_payment";
                service_name = "international_card_payment";
            }


            const ratesData = {
                transaction_type: "C2C",
                wallet_id: defaultWallet._id.toString(),
                amount,
                service_id: bot.intl_payout_method,
                channel_name,
                service_name,
                payerId: bot.intl_payer_id,
                iso_code: bot.intl_country_code,
                currency_code: defaultWallet.currency.code,
                payment_method: "card",
                chatbot: true
            }

            const exchangedRates = await getIntlFXHelper(ratesData)

            if (exchangedRates?.success) {

                const rates = exchangedRates?.data?.result

                console.log(exchangedRates, "exchangedRates")

                let exchangedAmountSender = await getExchangeRatesToUSD(defaultWallet.currency.code, 'USD', rates?.total?.value)
                console.log(defaultWallet.account.level, "defaultWallet.account.level")

                const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, defaultWallet, 'sending')

                if (!sender_limits_check.status) {
                    await quickMessage(data, sender_limits_check.message,);
                    return
                }

                await quickMessage(data, lang[selectedLanguage].SENDING_AMOUNT
                    .replace("{{amount}}", formattedAmount(rates?.total?.value))
                    .replace("{{currency}}", rates?.total?.currency ?? "N/A"));


                let message;
                if (rates?.total?.currency !== rates?.recipient?.currency) {
                    message = `    
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${rates?.total?.currency ?? "N/A"} = ${rates?.exchanged_rate?.value ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}
        
${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}
        
${lang[selectedLanguage].RECIPIENT_RECEIVES}: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}
        
${lang[selectedLanguage].TOTAL_MESSAGE}: ${formattedAmount(rates?.total?.value) ?? "N/A"} ${rates?.total?.currency ?? "N/A"}
        `;
                } else {
                    message = `            
${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}
        
${lang[selectedLanguage].RECIPIENT_RECEIVES}: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}
        
${lang[selectedLanguage].TOTAL_MESSAGE}: ${formattedAmount(rates?.total?.value) ?? "N/A"} ${rates?.total?.currency ?? "N/A"}
        `;
                }
                console.log(message, "message")
                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].PROCEED_TO_TRANSFER, payload: "intl_card_payment_proceed_transfer" },
                    { content_type: "text", title: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, payload: "intl_card_payment_adjust_amount" },
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                ];

                await quickReply(data, message, quickReplies, "4");

                bot.intl.card_payment.intl_exchngrate_token = exchangedRates?.data?.token
                await bot.save()
            } else {

                const errorMessage = Array.isArray(exchangedRates?.message) ? exchangedRates?.message?.find(msg =>
                    msg?.message?.toLowerCase().includes('payer is currently unavailable')
                ) : null

                let message, lastMessage = null;
                if (errorMessage) {
                    const payerList = await getPayerNames(bot.intl_payout_method, bot?.intl_country_code)

                    const payerChannel = payerList?.servicesWithIds?.filter((item) => {
                        return item.id.toString() === bot.intl_payer_id
                    })

                    message = lang[selectedLanguage].UNABLE_TO_SEND.replace(
                        "{{payerName}}",
                        payerChannel[0].name
                    );
                } else {
                    if (exchangedRates?.message?.includes("minimum")) {
                        message = lang[selectedLanguage].BELOW_MINIMUM_LIMIT.replace(
                            "{{minAmount}}",
                            exchangedRates?.value
                        ).replace("{{currency}}", exchangedRates?.currency);
                    } else if (exchangedRates?.message?.includes("maximum")) {
                        message = lang[selectedLanguage].EXCEEDS_MAXIMUM_LIMIT.replace(
                            "{{maxAmount}}",
                            exchangedRates?.value
                        ).replace("{{currency}}", exchangedRates?.currency);
                    } else {
                        message = lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR
                        lastMessage = "4"
                    }
                }

                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                ];

                if (lastMessage) {
                    await quickReply(data, message, quickReplies, "4");
                } else {
                    await quickReply(data, message, quickReplies);
                }
            }

        } else if (amount <= 1) {
            await quickMessage(data, lang[selectedLanguage].ENTER_AMOUNT_MORE_THAN_1.replace("{{currency}}", defaultWallet.currency.code));
        } else {
            await quickMessage(data, lang[selectedLanguage].ENTER_AMOUNT_DIGITS);
        }

    }

    // user has asked to adjust the amount
    else if (payload === "intl_card_payment_adjust_amount") {
        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
        ]
        await quickReply(data, lang[selectedLanguage].ENTER_AMOUNT_DIGITS, quickReplies, "intl_card_payment_amount");
    }
    // user has proceeded with the details
    else if (payload === "intl_card_payment_proceed_transfer") {
        if (account?.level?.level_no === 1) {
            await userKYCVerificationTemplate(data, data?.sender?.id, selectedLanguage)
        } else {
            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].PERSONAL_SUPPORT, payload: "intl_card_payment_purpose-FAMILY_SUPPORT" },
                { content_type: "text", title: lang[selectedLanguage].EDUCATION, payload: "intl_card_payment_purpose-EDUCATION" },
                { content_type: "text", title: lang[selectedLanguage].MEDICAL_TREATMENTS, payload: "intl_card_payment_purpose-MEDICAL_TREATMENT" },
                { content_type: "text", title: lang[selectedLanguage].OPERATIONAL_COSTS, payload: "intl_card_payment_purpose-SERVICE_CHARGES" },
                { content_type: "text", title: lang[selectedLanguage].CHARITY_DONATIONS, payload: "intl_card_payment_purpose-GIFT_AND_DONATION" },
                { content_type: "text", title: lang[selectedLanguage].OTHER_REASONS, payload: "intl_card_payment_purpose-OTHER" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
            ];

            await quickReply(data, `${lang[selectedLanguage].TRANSFER_REASON_MESSAGE} ${lang[selectedLanguage].SELECT_PURPOSE} 👇`, quickReplies, "4");
        }
    }

    // user has selected a purpose
    else if (payload?.includes("intl_card_payment_purpose-")) {
        const purpose = payload.split("-")[1];
        bot.intl.purpose = purpose
        await bot.save()

        const quickReplies = [

            { content_type: "text", title: lang[selectedLanguage].ADD_NOTE_BUTTON, payload: "intl_card_payment_note" },
            { content_type: "text", title: lang[selectedLanguage].ATTACH_DOCUMENT_BUTTON, payload: "intl_card_payment_doc" },
            { content_type: "text", title: lang[selectedLanguage].SKIP, payload: "intl_card_payment_without_doc" },
        ];

        await quickReply(data, `${lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE}`, quickReplies, "4");
    }
    // ask user to enter a note for intl transfer
    else if (payload === "intl_card_payment_note") {
        await quickMessage(data, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "intl_card_payment_note");
    }
    // user has entered a note
    else if (bot?.last_message === "intl_card_payment_note" && text && !payload) {

        bot.intl.intl_note = text
        await bot.save()

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].YES, payload: "intl_card_payment_add_attch" },
            { content_type: "text", title: lang[selectedLanguage].NO, payload: "intl_card_payment_no_attch" },
        ]

        await quickReply(data, lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, quickReplies, "4");

    }
    // user has also proceeded with adding an attachement
    else if (payload === "intl_card_payment_add_attch") {
        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].SKIP, payload: "intl_card_payment_no_attch" },
            { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "main_menu" },
        ]

        await quickReply(data, lang[selectedLanguage].ATTACH_DOCUMENT_PROMPT, quickReplies, "intl_card_payment_attachments");
    }
    // user has not proceeded with adding an attachement
    else if (payload === "intl_card_payment_no_attch" || payload === "intl_card_payment_no_note" || payload === "intl_card_payment_without_doc") {
        await processIntlProceedTransfer(data, bot, account, bot?.intl_country_code, "intl_card_payment", selectedLanguage);
    }

    else if (attachments?.attachments && bot?.last_message === "intl_card_payment_attachments" && !payload) {
        const { validCount, allImagesAndVideos } = validateAttachments(attachments.attachments);

        if (!validCount) {
            await quickMessage(data, lang[selectedLanguage].FILE_ATTACHMENT_LIMIT,);
            return;
        }
        if (allImagesAndVideos) {

            const uploadedImages = await uploadToS3("transaction_images", account._id, attachments.attachments);
            console.log(uploadedImages, "uploadedImages")
            if (uploadedImages.status) {
                for (const image of uploadedImages.uploadedFiles) {
                    bot.intl.intl_attachments.push({
                        key: image.key,
                        url: image.url,
                        ETag: image.ETag
                    })
                }
                await bot.save();
                await processIntlProceedTransfer(data, bot, account, bot?.intl_country_code, "intl_card_payment", selectedLanguage);

            } else {
                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                ];

                await quickReply(data, uploadedImages.message, quickReplies);
            }
        } else {
            await quickMessage(data, lang[selectedLanguage].INVALID_ATTACHMENT_TYPE,);
        }

    }
    // if user has entered invalid file type or multiple image files
    else if ((attachments?.is_unsupported || text) && bot?.last_message === "intl_card_payment_attachments" && !payload) {
        await quickMessage(data, lang[selectedLanguage].INVALID_ATTACHMENT_TYPE,);
    }
    // user has attached an image as a document
    else if (payload === "intl_card_payment_doc") {
        await quickMessage(data, lang[selectedLanguage].ATTACH_DOCUMENT_PROMPT, "intl_card_payment_attachments1");
    }

    else if (attachments?.attachments && bot?.last_message === "intl_card_payment_attachments1" && !payload) {
        const { validCount, allImagesAndVideos } = validateAttachments(attachments.attachments);

        if (!validCount) {
            await quickMessage(data, lang[selectedLanguage].FILE_ATTACHMENT_LIMIT,);
            return;
        }
        if (allImagesAndVideos) {

            const uploadedImages = await uploadToS3("transaction_images", account._id, attachments.attachments);
            console.log(uploadedImages, "uploadedImages")
            if (uploadedImages.status) {
                for (const image of uploadedImages.uploadedFiles) {
                    bot.intl.intl_attachments.push({
                        key: image.key,
                        url: image.url,
                        ETag: image.ETag
                    })
                }
                await bot.save();
                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].YES, payload: "intl_card_payment_add_note" },
                    { content_type: "text", title: lang[selectedLanguage].NO, payload: "intl_card_payment_no_note" },
                ]

                await quickReply(data, lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, quickReplies, "4");
            } else {
                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                ];

                await quickReply(data, uploadedImages.message, quickReplies);
            }
        } else {
            await quickMessage(data, lang[selectedLanguage].INVALID_ATTACHMENT_TYPE,);
        }

    }
    // user has uploaded invalid image
    else if ((attachments?.is_unsupported || text) && bot?.last_message === "intl_card_payment_attachments1" && !payload) {
        await quickMessage(data, lang[selectedLanguage].INVALID_ATTACHMENT_TYPE,);
    }
    // user has proceeded with additional note request
    else if (payload === "intl_card_payment_add_note") {
        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].SKIP, payload: "intl_card_payment_no_attch" },
            { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "main_menu" },
        ]
        await quickReply(data, lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, quickReplies, "intl_card_payment_note1");

        // await quickMessage(data,  lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "intl_card_payment_note1");
    }
    // has added the note
    else if (bot?.last_message === "intl_card_payment_note1" && text && !payload) {
        bot.intl.intl_note = text
        await bot.save()
        // show beneficiaries here
        await processIntlProceedTransfer(data, bot, account, bot?.intl_country_code, "intl_card_payment", selectedLanguage);
    }
    else if (payload?.includes("intl_card_payment_next_beneficiaries")) {
        const currentPage = parseInt(payload.split("_")[5]);
        const beneficiaries = bot.intl_beneficiaries;
        const numberOfBeneficiariesPerPage = 8;
        const startIndex = (currentPage - 1) * numberOfBeneficiariesPerPage;
        const endIndex = startIndex + numberOfBeneficiariesPerPage;

        const beneficiariesToDisplay = beneficiaries.slice(startIndex, endIndex);

        const beneficiaryList = beneficiariesToDisplay.map((beneficiary, index) => ({
            content_type: "text",
            title: `${beneficiary?.first_name} ${beneficiary?.last_name}`,
            payload: `intl_card_payment_select_benef_${beneficiary._id}`
        }));

        const message = lang[selectedLanguage].SELECT_BENEFICIARY;

        const quickReplies = [
            ...beneficiaryList,
            { content_type: "text", title: lang[selectedLanguage].ADD_BENEFICIARY, payload: `add_beneficiary` },

        ];
        if (currentPage === 2) {
            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `intl_card_payment_no_attch` })
            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` })
        } else {
            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `intl_card_payment_prev_beneficiaries_${currentPage}` },)
            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` })

        }

        // Check if there are more beneficiaries available for "Next" quick reply
        if (beneficiaries.length > endIndex) {
            quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `intl_card_payment_next_beneficiaries_${currentPage + 1}` });
        }

        await quickReply(data, message, quickReplies, "4");
    }
    // user is selecting the beneficiary number
    else if (payload?.includes("intl_card_payment_select_benef_")) {
        const benefeciaryId = payload?.split("_")[5]
        console.log(benefeciaryId, "benefeciaryId")

        const beneficiary = await Beneficiary.findById(benefeciaryId);
        const benefName = `${beneficiary?.first_name} ${beneficiary?.last_name}`
        bot.intl_benef_id = beneficiary?._id;
        await bot.save()

        const quotationData = {
            payerId: bot.intl_payer_id,
            wallet_id: defaultWallet?._id.toString(),
            transaction_type: beneficiary?.beneficiary_type === "individual" ? "C2C" : "B2C",
            token: bot.intl.card_payment.intl_exchngrate_token,
            payment_method: "card"
        }

        console.log("quotationDatainsidecondition", quotationData);

        const quotationDetails = await createQuotationNewHelper(quotationData)
        // const quotationDetails = await createQuotationNew(quotationData)

        console.log(quotationDetails, "quotationDetails")
        if (quotationDetails?.status) {

            console.log(quotationDetails, "quotationDetails");

            bot.intl.card_payment.intl_exchngrate_token = quotationDetails?.token;
            bot.intl.card_payment.intl_quotation_id = quotationDetails?.QuotationID
            await bot.save();

            const message = `
                ${lang[selectedLanguage].CONFIRM_SEND_MESSAGE} ${formattedAmount(bot.intl.card_payment.amount)} ${defaultWallet?.currency.code} ${lang[selectedLanguage].TO} ${benefName}?
                `;

            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].YES_CONTINUE_TITLE, payload: "intl_card_payment_confirm_beneficiary" },
                { content_type: "text", title: lang[selectedLanguage].CHANGE_BENEFICIARY, payload: "intl_card_payment_no_attch" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
            ];
            await quickReply(data, message, quickReplies, "4");
        }
        else if (quotationDetails?.message === "Differences in exchange rates") {
            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].SEND_ANOTHER, payload: "intl_transfer" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
            ];

            const message = `There has been exchange rate differences. Please try again.`
            await quickReply(data, message, quickReplies, "4");
        }
        else {
            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].SEND_ANOTHER, payload: "intl_transfer" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
            ];

            const message = lang[selectedLanguage].PAYMENT_ISSUE_MESSAGE
            await quickReply(data, message, quickReplies, "4");
        }
    }

    // user has confirmed beneficiary
    else if (payload === "intl_card_payment_confirm_beneficiary") {
        const user = await User.findOne({ account: account._id })
        const beneficiary = await Beneficiary.findById(bot?.intl_benef_id);

        const transactionData = {
            wallet_id: defaultWallet?._id?.toString(),
            additional_information: bot.intl.intl_note || "Others",
            purpose_of_remittance: bot.intl.purpose,
            user_id: user._id,
            beneficiary_id: bot?.intl_benef_id,
            service: {
                id: parseInt(bot?.intl_payout_method)
            },
            bank_id: beneficiary?.bank_details[0]?._id ?? "",
            mobile_wallet_id: beneficiary?.mobile_wallet[0]?._id ?? "",
            transaction_type: beneficiary?.beneficiary_type === "individual" ? "C2C" : "B2C",
            token: bot.intl.card_payment.intl_exchngrate_token,
            Quotation_ID: bot.intl.card_payment.intl_quotation_id

        }
        console.log(transactionData, "transactionDatainsidecreatetransa");

        const createTransactionDetails = await createTransaction(transactionData)
        if (createTransactionDetails?.status) {

            let channel_name, service_name;
            if (bot.intl_payout_method === "1") {
                channel_name = "mobile_money";
                service_name = "international_mobile_wallet";
            } else if (bot.intl_payout_method === "2") {
                channel_name = "bank_account";
                service_name = "international_bank_transfer";
            } else if (bot.intl_payout_method === "3") {
                channel_name = "cash_pickup";
                service_name = "international_cash_pickup";
            } else {
                channel_name = "card_payment";
                service_name = "international_card_payment";
            }

            const ratesData = {
                transaction_type: "C2C",
                wallet_id: defaultWallet?._id?.toString(),
                amount: bot.intl.card_payment.amount,
                service_id: bot.intl_payout_method,
                channel_name,
                service_name,
                payerId: bot.intl_payer_id,
                iso_code: bot.intl_country_code,
                currency_code: defaultWallet.currency.code,
                payment_method: "card",
                chatbot: true
            }

            const exchangedRates = await getIntlFXHelper(ratesData)
            const rates = exchangedRates?.data?.result

            console.log(exchangedRates, "exchangedRates")
            if (!exchangedRates?.success) {
                const errorMessage = Array.isArray(exchangedRates?.message) ? exchangedRates?.message?.find(msg =>
                    msg?.message?.toLowerCase().includes('payer is currently unavailable')
                ) : null

                let message;
                if (errorMessage) {
                    const payerList = await getPayerNames(bot.intl_payout_method, bot?.intl_country_code)

                    const payerChannel = payerList?.servicesWithIds?.filter((item) => {
                        return item.id.toString() === bot.intl_payer_id
                    })

                    message = lang[selectedLanguage].UNABLE_TO_SEND.replace(
                        "{{payerName}}",
                        payerChannel[0].name
                    );

                } else {
                    if (exchangedRates?.message?.includes("minimum")) {
                        message = lang[selectedLanguage].BELOW_MINIMUM_LIMIT.replace(
                            "{{minAmount}}",
                            exchangedRates?.value
                        ).replace("{{currency}}", exchangedRates?.currency);
                    } else if (exchangedRates?.message?.includes("maximum")) {
                        message = lang[selectedLanguage].EXCEEDS_MAXIMUM_LIMIT.replace(
                            "{{maxAmount}}",
                            exchangedRates?.value
                        ).replace("{{currency}}", exchangedRates?.currency);
                    } else {
                        message = lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR
                    }
                }

                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                ];

                await quickReply(data, message, quickReplies, "4");

            }
            const payerList = await getPayerNames(bot.intl_payout_method, bot?.intl_country_code)

            const payerChannel = payerList?.servicesWithIds?.filter((item) => {
                return item.id.toString() === bot.intl_payer_id
            })

            const beneficiary = await Beneficiary.findById(bot?.intl_benef_id)

            const message = `
${lang[selectedLanguage].REVIEW_TRANSACTION_DETAILS}

${lang[selectedLanguage].COUNTRY}: ${bot?.intl_country}
${lang[selectedLanguage].PAYMENT_METHOD}: ${bot?.intl_payout_method === "1" ? lang[selectedLanguage].MOBILE_WALLET : lang[selectedLanguage].BANK_ACCOUNT}
${lang[selectedLanguage].PAYMENT_NAME}: ${payerChannel[0]?.name || "N/A"}
${lang[selectedLanguage].BENEFICIARY}: ${beneficiary?.first_name} ${beneficiary?.last_name}

${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(rates.sending.value)} ${rates.total.currency}
${rates.total.currency !== rates.exchanged_rate.currency ? `${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${rates.total.currency} = ${formattedAmount(rates.exchanged_rate.value, 6)} ${rates.exchanged_rate.currency}\n` : ''}
${lang[selectedLanguage].FEE}: ${formattedAmount(rates.fee.value)} ${rates.total.currency}

${lang[selectedLanguage].BENEFICIARY_GETS}: ${formattedAmount(rates.recipient.value)} ${rates.exchanged_rate.currency}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(rates.total.value)} ${rates.total.currency}
`;
            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].CONFIRM_TRANSACTION, payload: "intl_card_payment_confirm_transaction" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
            ];
            await quickReply(data, message, quickReplies, "4");
            bot.intl.card_payment.intl_exchngrate_token = createTransactionDetails?.token;
            await bot.save()
        } else {
            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].SEND_ANOTHER, payload: "intl_transfer" },
                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
            ];

            const message = lang[selectedLanguage].PAYMENT_ISSUE_MESSAGE
            await quickReply(data, message, quickReplies, "4");
        }
    }

    // user has proceeded with payment
    else if (payload === "intl_card_payment_confirm_transaction") {
        await handleOTPGeneration(selectedLanguage, senderId, "intl_card_payment-otp", "intl_card_payment-otp", "Transaction OTP");
    }
    // user has entered otp
    else if (bot?.last_message === "intl_card_payment-otp" && !payload && text) {
        const otpValidationResult = await validateOTP(senderId, text, "intl_card_payment-otp");

        if (otpValidationResult.status) {

            const decodedToken = jwt.verify(bot.intl.card_payment.intl_exchngrate_token, secretKey);
            console.log(decodedToken, "decodedToken")

            const calculations = decodedToken.transactionDetails.calculations

            console.log(calculations, "calculations")

            const transactionDetails = await initiateTopUpSavedCard(defaultWallet, parseFloat(calculations.total.value) * 100, bot.intl.card_payment.pan, bot.intl.card_payment.intl_exchngrate_token)
            console.log({ transactionDetails })

            if (transactionDetails?.status) {

                const title = lang[selectedLanguage].VERIFY_CARD

                const subtitle = `
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(parseFloat(calculations.total.value))} ${defaultWallet?.currency?.code}
                        `

                const templatePayload = {
                    template_type: "generic",
                    elements: [
                        {
                            title,
                            subtitle,
                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Request%20A%20Quote.png",
                            buttons: [
                                {
                                    type: "web_url",
                                    title: lang[selectedLanguage].VERIFY,
                                    url: `https://my.insta-pay.ch/chatbot/pan-transaction?token=${transactionDetails?.data?.token}&transaction_id=${transactionDetails?.data?.transaction_id}&reference_id=${transactionDetails?.data?.reference_id}&intl_token=${bot.intl.card_payment.intl_exchngrate_token}&slug=confirm-chatbot-intl-pan-topup`,
                                    webview_height_ratio: "full"
                                },
                                {
                                    type: "postback",
                                    title: lang[selectedLanguage].MAIN_MENU,
                                    payload: "main_menu",
                                }

                            ],
                        },
                    ]
                };

                await sendTemplate(data, senderId, templatePayload, "4")
            } else {
                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                ]
                await quickReply(data, lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR, quickReplies, "4");
            }
        } else {
            if (otpValidationResult.message === "max_attempts_exceeded") {
                await quickMessage(data, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "4");
            } else {
                await invalidMessage(data, "updated_w2w_card_payment-otp", selectedLanguage, bot?.otpType);
            }
        }
    }


}

module.exports = { intlUsingCard, initiateTopUpSavedCard }