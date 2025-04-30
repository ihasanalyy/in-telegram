const Admin = require('../models/Admin.model')
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const CryptoJS = require("crypto-js");
const axios = require('axios');
const PASSWORD_ENCRYPTION_KEY = 'secretOfTheInstaPaySystemAccountPassword'
const TOKEN_KEY = 'secretOfTheInstaPaySystemAccountTOKEN'

const AccountLevel = require('../models/Account-Level.model');
const Account = require('../models/Account.model');
const User = require('../models/User.model');
const Company = require('../models/Company.model');
const VCCTransactionModel = require('../models/VCC-Transaction.model');

const { encryption, decryption } = require('../configurations/Encryption');
const Partner = require('../models/Partner.model');
const { replyToText, sendTemplate, quickReply } = require('./InstaChatbot.controller');
const { telegramWebhook } = require('./Telegram.controller')
const InstaChatbot = require('../models/InstaChatbot.model');
const Wallet = require('../models/Wallet.model');
const Transaction = require('../models/Transaction.model');
const fs = require('fs')
const path = require('path');
const VirtualCardModel = require('../models/Virtual-Card.model');
const FeeModel = require('../models/Fee.model');
// const moment = require('moment');
const moment = require('moment-timezone');
const { getTemplateId, fetchLocalOrDefaultWalletConditionally, sendSMSTemplate, convertCurrency } = require('../utils/helpers');
const { sendMailsExport } = require('../utils/sendEmail');
const { cancelTransaction } = require('../utils/thunesHelpers');
const { commissionCalculator } = require('./Thune.controller');
const CommissionModel = require('../models/Commission.model');
const Document = require('../models/Document.model');
const { formattedAmount } = require('../utils/InstaChatbotHelpers');
const { revertUsedLimits } = require('../utils/conversion');
const lang = require('../utils/languages/languages.json');
const TelegramBotModel = require('../models/TelegramBot.model');
const { sendButtons } = require('../utils/telegramBotUtils');
const { encryptDataVCC, decryptDataVCC } = require('../configurations/EncryptionVCC');
const { formatDecimalNumbersWithLimit } = require('../utils/payerRates');

const thunesAcceptUsername = process.env.THUNES_ACCEPT_APIKEY
const thunesAcceptPassword = process.env.THUNES_ACCEPT_APISECRET
const thunesAcceptURL = "https://api-col.limonetikqualif.com/v1/payment"

const Thunes_KEY = process.env.API_KEY_PROD;
const Thunes_SECRET = process.env.API_SECRET_PROD;

const authHeaders = `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`;
const prodUrl = process.env.THUNES_PROD_URL


// function to find the month differences between two dats
function monthDiff(d1, d2) {
    var months;
    months = (d2.getFullYear() - d1.getFullYear()) * 12;
    months -= d1.getMonth();
    months += d2.getMonth();
    return months <= 0 ? 0 : months;
}

function formatDOB(dob) {
    const [year, month, day] = dob.split('-')
    return `${day}-${month}-${year}`
}

function calculateCompleteMonths(startDate, endDate) {
    // Split the date strings into day, mnth, and year components
    const [startDay, startMonth, startYear] = startDate.split('-').map(Number);
    const [endDay, endMonth, endYear] = endDate.split('-').map(Number);

    const startMoment = new Date(startYear, startMonth - 1, startDay);
    const endMoment = new Date(endYear, endMonth - 1, endDay);

    // Calculate the difference in months
    const diffMonths = monthDiff(startMoment, endMoment);

    // Adjust for partial month
    if (startMoment.getDate() !== endMoment.getDate()) {
        return diffMonths - 1;
    }

    return diffMonths;
}

// checkin user verification
module.exports.getIdWebhook = async (req, res) => {
    try {
        var { processingState, servicesResults, application, overallResult, metadata } = req.body;
        let external_id;
        if (metadata?.externalId) {
            external_id = metadata?.externalId.split("_")[1]
        }
        let userDetails = await User.findById(external_id).populate('account')
        console.log(overallResult, metadata, processingState, external_id, "req.bodyingetid")
        if (processingState == 'processing') {
            userDetails.kyc_status = 'processing'
            userDetails.kyc_ids.application_id = req.body.id;

            const KYCSubmissionLanguage = 'english';
            const KYCSubmissiontemplateName = 'KYC Submission';

            const templateIdReceiving = getTemplateId(KYCSubmissionLanguage, KYCSubmissiontemplateName);

            await sendMailsExport(userDetails?.account?.email, "InstaPay KYC Submission", "InstaPay KYC Submission", templateIdReceiving, {})
        }
        if (processingState == 'done') {

            if (overallResult?.status && external_id) {
                let accountDetails = await Account.findOne({ user: external_id }, { country: true })
                accountDetails.kyc_verification_paid = false
                // update the account level if the status is approved
                if (overallResult?.status === "approved") {
                    let level = await AccountLevel.findOne({ $and: [{ level_no: 2 }, { country: accountDetails.country }, { account_type: 'individual' }] }, { account_type: true })
                    let accountUpdate = await Account.updateOne({ user: external_id }, { level: level._id }, { new: true })
                }

                // update basic details only if the status is approved/needs-review
                if (overallResult?.status === "approved" || overallResult?.status === "needs-review") {
                    let exctractedFirstName = "";
                    let exctractedLastName = "";
                    let exctractedNationality = ""
                    let exctractedAddress = ""
                    let exctractedDOB = ""
                    let exctractedGender = ""

                    servicesResults.docCheck.extracted.ocr.forEach(item => {
                        if (item.category === "First name") {
                            exctractedFirstName = item.content;
                        }
                        if (item.category === "Last name") {
                            exctractedLastName = item.content;
                        }
                        if (item.category === "Country") {
                            exctractedNationality = item.content;
                        }
                        if (item.category === "Address") {
                            exctractedAddress = item.content;
                        } else {
                            exctractedAddress = servicesResults.poa.fields.address.value
                        }
                        if (item.category === "Date of birth") {
                            exctractedDOB = item.content
                        }
                        if (item.category === "Gender") {
                            exctractedGender = item.content
                        }
                    });

                    // let exctractedCity = metadata?.city;
                    let exctractedPostCode = servicesResults.poa.fields.postcode.value

                    // extra infrmation
                    let documentDetails = servicesResults.docCheck.extracted.ocr.reduce((details, item) => {
                        if (item.category === "Document number") details.idNumber = item.content;
                        if (item.category === "Document type") details.documentType = item.content;
                        if (item.category === "Date of issue") details.dateOfIssue = item.content;
                        if (item.category === "Date of expiry") details.dateOfExpiry = item.content;
                        return details;
                    }, {});

                    // Check if "Document number" is not set and set "Tax number" as idNumber
                    if (!documentDetails?.idNumber) {
                        let taxNumber = servicesResults.docCheck.extracted.ocr.find(item => item.category === "Tax number");
                        if (taxNumber) {
                            documentDetails.idNumber = taxNumber.content;
                        }
                    }

                    let obj = {
                        first_name: exctractedFirstName,
                        last_name: exctractedLastName,
                        kyc_status: overallResult?.status,
                        kyc_all_status: {
                            faceMatching: servicesResults.faceMatching.status,
                            poa: servicesResults.poa.status,
                            profileCheck: servicesResults.profileCheck.status,
                            livenessCheck: servicesResults.livenessCheck.status,
                            docCheck: servicesResults.docCheck.status
                        },
                        kyc_all_comments: {
                            faceMatching: servicesResults.faceMatching?.results[0]?.selfieQuality?.considers,
                            poa: servicesResults.poa?.fieldsCheck?.considers,
                            profileCheck: servicesResults.profileCheck?.formCompare?.considers,
                            livenessCheck: servicesResults.livenessCheck?.livenessCheck?.considers,
                            docCheck: [
                                ...(Array.isArray(servicesResults.docCheck?.dataExtractionConsistency?.considers) ? servicesResults.docCheck.dataExtractionConsistency.considers : []),
                                ...(Array.isArray(servicesResults.docCheck?.documentPhotoQuality?.considers) ? servicesResults.docCheck.documentPhotoQuality.considers : []),
                                ...(Array.isArray(servicesResults.docCheck?.fraudAssessment?.considers) ? servicesResults.docCheck.fraudAssessment.considers : [])
                            ]
                        },
                        extras: documentDetails
                    }
                    let userUpdate = await User.findByIdAndUpdate(external_id, obj, { new: true })

                    accountDetails.first_name = exctractedFirstName
                    accountDetails.last_name = exctractedLastName
                    accountDetails.user_nationaility = exctractedNationality
                    accountDetails.address = exctractedAddress
                    accountDetails.dob = formatDOB(exctractedDOB)
                    // accountDetails.city = exctractedCity
                    accountDetails.gender = exctractedGender
                    accountDetails.postal_code = exctractedPostCode

                }

                // if declined
                if (overallResult?.status === "declined") {
                    let obj = {
                        kyc_status: overallResult?.status,
                        kyc_all_status: {
                            faceMatching: servicesResults.faceMatching.status,
                            poa: servicesResults.poa.status,
                            profileCheck: servicesResults.profileCheck.status,
                            livenessCheck: servicesResults.livenessCheck.status,
                            docCheck: servicesResults.docCheck.status
                        },
                        kyc_all_comments: {
                            faceMatching: servicesResults.faceMatching?.results[0]?.selfieQuality?.considers,
                            poa: servicesResults.poa?.fieldsCheck?.considers,
                            profileCheck: servicesResults.profileCheck?.formCompare?.considers,
                            livenessCheck: servicesResults.livenessCheck?.livenessCheck?.considers,
                            docCheck: [
                                ...(Array.isArray(servicesResults.docCheck?.dataExtractionConsistency?.considers) ? servicesResults.docCheck.dataExtractionConsistency.considers : []),
                                ...(Array.isArray(servicesResults.docCheck?.documentPhotoQuality?.considers) ? servicesResults.docCheck.documentPhotoQuality.considers : []),
                                ...(Array.isArray(servicesResults.docCheck?.fraudAssessment?.considers) ? servicesResults.docCheck.fraudAssessment.considers : [])
                            ]
                        },
                    }
                    let userUpdate = await User.findByIdAndUpdate(external_id, obj, { new: true })
                }

                await accountDetails.save()

                // sending notification
                let message;
                if (overallResult?.status === "approved") {
                    message = `Congrats, ${userDetails?.first_name} ${userDetails?.last_name}! Your InstaPay KYC is approved. 🎉 Enjoy higher limits and instant transfers!`
                } else if (overallResult?.status === "declined") {
                    message = `Sorry, ${userDetails?.first_name} ${userDetails?.last_name}. Your InstaPay KYC wasn't approved. Please check your details against your ID in Identity Verification, then resubmit.`
                } else if (overallResult?.status === "needs-review") {
                    message = `Hi ${userDetails?.first_name} ${userDetails?.last_name}, your InstaPay KYC is under review. We'll notify you once the process is complete. Thank you for your patience!`
                }
                if (message) {
                    await sendSMSTemplate(userDetails.account?.phone, message)
                }
            }
        }

        console.log(processingState, servicesResults, application, "req.bodyingetidtwo")
        if (processingState == 'done' || processingState == 'processing') {
            let files = [];
            application.documents.forEach(doc => {
                doc.files.forEach(file => {
                    files.push({
                        document_type: doc.documentType,
                        kind: file.kind,
                        mediaType: file.mediaType,
                        url: file.uri,
                        issuingCountry: doc.issuingCountry,
                    });
                });
            });

            application.selfie.files.forEach(file => {
                files.push({
                    document_type: 'selfie',
                    kind: file.kind,
                    mediaType: file.mediaType,
                    url: file.uri,
                });
            });

            if (application.poa.file) {
                files.push({
                    document_type: 'proof-of-address',
                    kind: application.poa.file.kind,
                    mediaType: application.poa.file.mediaType,
                    url: application.poa.file.uri,
                });
            }
            userDetails.kyc_documents = files
            await userDetails.save()

        }

        res.status(200).send(true);
        // if (processingState == 'done') {
        //     var { overallResult, metadata } = req.body;
        //     let external_id = metadata?.externalId.split("_")
        //     if (overallResult?.status && external_id.length) {
        //         let accountDetails = await Account.findOne({ user: external_id[1] }, { country: true })
        //         if (external_id[0].toLowerCase() == 'user') {
        //             let level = await AccountLevel.findOne({ $and: [{ level_no: 2 }, { country: accountDetails.country }, { account_type: 'individual' }] }, { account_type: true })
        //             let obj = {
        //                 kyc_status: overallResult?.status,
        //                 kyc_all_status: {
        //                     faceMatching: servicesResults.faceMatching.status,
        //                     poa: servicesResults.poa.status,
        //                     profileCheck: servicesResults.profileCheck.status,
        //                     livenessCheck: servicesResults.livenessCheck.status,
        //                     docCheck: servicesResults.docCheck.status
        //                 },
        //                 kyc_all_comments: {
        //                     faceMatching: servicesResults.faceMatching?.results[0]?.selfieQuality?.considers,
        //                     poa: servicesResults.poa?.fieldsCheck?.considers,
        //                     profileCheck: servicesResults.profileCheck?.formCompare?.considers,
        //                     livenessCheck: servicesResults.livenessCheck?.livenessCheck?.considers,
        //                     docCheck: [
        //                         ...servicesResults.docCheck?.dataExtractionConsistency?.considers,
        //                         ...servicesResults.docCheck?.documentPhotoQuality?.considers,
        //                         ...servicesResults.docCheck?.fraudAssessment?.considers
        //                     ]
        //                 }
        //             }
        //             let userUpdate = await User.findByIdAndUpdate({ _id: external_id[1] }, obj, { new: true })
        //             if (level && obj.kyc_status == 'approved') {
        //                 let accountUpdate = await Account.updateOne({ user: external_id[1] }, { level: level._id }, { new: true })
        //             }
        //         } else if (external_id[0].toLowerCase() == 'company') {
        //             let level = await AccountLevel.findOne({ $and: [{ level_no: 2 }, { country: accountDetails.country }, { account_type: 'business' }] }, { account_type: true })
        //             let userUpdate = await Company.findByIdAndUpdate({ _id: external_id[1] }, { kyc_status: overallResult?.status }, { new: true })
        //             if (level) {
        //                 let accountUpdate = await Account.updateOne({ company: external_id[1] }, { level: level._id }, { new: true })
        //             }
        //         } else if (external_id[0].toLowerCase() == 'partner') {
        //             let obj = {
        //                 kyc_status: overallResult?.status,
        //                 kyc_all_status: {
        //                     faceMatching: servicesResults.faceMatching.status,
        //                     poa: servicesResults.poa.status,
        //                     profileCheck: servicesResults.profileCheck.status,
        //                     livenessCheck: servicesResults.livenessCheck.status,
        //                     docCheck: servicesResults.docCheck.status
        //                 },
        //                 kyc_all_comments: {
        //                     faceMatching: servicesResults.faceMatching?.results[0]?.selfieQuality?.considers,
        //                     poa: servicesResults.poa?.fieldsCheck?.considers,
        //                     profileCheck: servicesResults.profileCheck?.formCompare?.considers,
        //                     livenessCheck: servicesResults.livenessCheck?.livenessCheck?.considers,
        //                     docCheck: [
        //                         ...servicesResults.docCheck?.dataExtractionConsistency?.considers,
        //                         ...servicesResults.docCheck?.documentPhotoQuality?.considers,
        //                         ...servicesResults.docCheck?.fraudAssessment?.considers
        //                     ]
        //                 }
        //             }
        //             let partnerUpdate = await Partner.findByIdAndUpdate({ _id: external_id[1] }, obj, { new: true })
        //         }
        //     }
        // }
    } catch (err) {
        console.log(err)
        res.status(500).send(false);
    }
}

// trust payment
module.exports.trustPayment = async (req, res) => {
    console.log(req.body)
    res.status(200).send(true);
}


// facebooks developers
module.exports.getInstagramNotification = async (req, res) => {
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];

    console.log(req.query)

    res.status(200).send(challenge);
}

module.exports.setInstagramNotification = async (req, res) => {
    let body = req.body;

    console.log(`\u{1F7EA} Received webhook:`);
    console.dir(body, { depth: null });
    // console.log(body, { depth: null });
    if (body.object === "instagram") {
        await replyToText(body)
        res.status(200).send("EVENT_RECEIVED");

        // Determine which webhooks were triggered and get sender PSIDs and locale, message content and more.

    } else {
        // Return a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }
}

// Thunes sending
module.exports.getThunesTransactionStatus = async (req, res) => {
    let body = req.body;
    let type = req.query?.type

    console.log(`\u{1F7EA} Received thunes webhook:`);
    console.dir(body, { depth: null });

    const transaction_id = `tr_${body.external_id}`

    if (!mongoose.Types.ObjectId.isValid(body.external_code)) {
        console.log('invalid external code')
        return res.status(200).send("EVENT_RECEIVED");
    }

    const accountDetails = await Account.findById(body.external_code)

    const transactionDetails = await Transaction.findOne({ external_reference: body.external_id }).populate("account")

    console.log(transactionDetails, "transactionDetails")

    if (transactionDetails) {
        let timezone = accountDetails?.timezone || "UTC"

        const currentTime = moment.tz(timezone).format();

        if (body.status_class_message === "COMPLETED") {
            transactionDetails.timeline.push({
                date: currentTime,
                status: body.status_class_message
            })
            transactionDetails.status = body.status_class_message
            transactionDetails.external_status = `thunes_${body.status}`

            await transactionDetails.save()

            // commission work, and transaction is not withdrawal
            if (transactionDetails?.account?.parentId && !type) {
                const parent = await Account.findById(transactionDetails?.account?.parentId).populate('insta_recipient_id');
                const commission = await commissionCalculator(parent.insta_recipient_id?.recipient);
                console.log("Commission", commission)
                let commissionObj = {
                    parent: transactionDetails?.account?.parentId,
                    child: transactionDetails?.account?._id,
                    commission: commission,
                    currency: 'USD',
                    account_type: transactionDetails?.account?.account_type,
                    iso3: transactionDetails?.account?.country_iso_code
                }

                console.log(parent.commission, "commission")
                parent.commission = (parent.commission || 0) + commission
                await parent.save()

                const newCommission = new CommissionModel(commissionObj);

                await newCommission.save()
            }

            // sending cash pickup message to the recipient
            if (transactionDetails.payment_type === "international_cash_pickup") {
                const config = {
                    headers: {
                        'Authorization': authHeaders,
                        'Content-Type': 'application/json'
                    }
                };

                const transactionDetailsUrl = `${prodUrl}/v2/money-transfer/transactions/ext-${transactionDetails.external_reference}`;
                const transactionDetailsResponse = await axios.get(transactionDetailsUrl, config);
                const transactionDetailsData = transactionDetailsResponse.data;
                const verificationCode = transactionDetailsData?.payer_transaction_code
                const destination = transactionDetailsData?.destination
                const message = `${transactionDetails?.account?.first_name} ${transactionDetails?.account?.last_name} has sent you ${destination?.amount} ${destination?.currency} with instapay. Your verification code is ${verificationCode}.\nYou can collect amount from the given below InstaPay partners.\n\nhttps://www.instapay.com/`;

                console.log(message, "message")
                const check = await sendSMSTemplate(transactionDetailsData?.credit_party_identifier?.msisdn, message);
            }

        } else if (body.status_class_message === "DECLINED" || body.status_class_message === "CANCELLED" || body.status_class_message === "REJECTED" || body.status_class_message === "REVERSED") {
            const walletDetails = await Wallet.findOne({ _id: transactionDetails.wallet })

            walletDetails.balance.available = walletDetails.balance.available + transactionDetails.total
            await walletDetails.save()

            transactionDetails.timeline.push({
                date: currentTime,
                status: body.status_class_message
            })
            transactionDetails.status = body.status_class_message
            transactionDetails.external_status = `thunes_${body.status}`

            await transactionDetails.save()

            // reverting the account limits
            let USDTotal;
            if (transactionDetails.currency.code !== 'USD') {
                USDTotal = await convertCurrency(transactionDetails.currency.code, 'USD', transactionDetails.total);
            } else {
                USDTotal = transactionDetails.total
            }

            // Updating the used limits object
            await revertUsedLimits(transactionDetails.account, null, USDTotal, null);

        } else {
            transactionDetails.timeline.push({
                date: currentTime,
                status: body?.status_class_message || "UNKNOWN"
            })
            transactionDetails.status = body.status_class_message
            transactionDetails.external_status = `thunes_${body.status}`

            await transactionDetails.save()
        }


        res.status(200).send("EVENT_RECEIVED");
    } else {
        console.log("Transaction not found")
        res.status(200).send("EVENT_RECEIVED");
    }

    console.log(transactionDetails, "transactionDetailsupdated")
}

// dt one - airtime
module.exports.getDtoneTransactionStatus = async (req, res) => {
    let body = req.body;
    console.log(`\u{1F7EA} Received dtone webhook:`);
    console.log(body, { depth: null });

    const account_id = body.external_id.split("_")[0]

    if (!mongoose.Types.ObjectId.isValid(account_id)) {
        console.log('invalid external code')
        return res.status(200).send("EVENT_RECEIVED");
    }

    const accountDetails = await Account.findById(account_id);
    const transactionDetails = await Transaction.findOne({ external_reference: body.external_id });
    console.log(transactionDetails, "transactionDetails", accountDetails)

    if (transactionDetails) {
        let timezone = accountDetails?.timezone || "UTC"

        const currentTime = moment.tz(timezone).format();

        if (body.status.message === "COMPLETED") {
            transactionDetails.timeline.push({
                date: currentTime,
                status: body.status.message
            })
            transactionDetails.status = body.status.message
            transactionDetails.external_status = `dtone_${body.status.id}`

            await transactionDetails.save()
        }
        else if (body.status.message === "DECLINED" || body.status.message === "CANCELLED" || body.status.message === "REJECTED" || body.status.message === "REVERSED") {
            const walletDetails = await Wallet.findOne({ _id: transactionDetails.wallet })

            walletDetails.balance.available = walletDetails.balance.available + transactionDetails.total
            await walletDetails.save()

            transactionDetails.timeline.push({
                date: currentTime,
                status: body.status.message
            })
            transactionDetails.status = body.status.message
            transactionDetails.external_status = `dtone_${body.status.id}`

            await transactionDetails.save()
        }
        else {
            transactionDetails.timeline.push({
                date: currentTime,
                status: body.status.message || "UNKNOWN"
            })
            transactionDetails.status = body.status.message
            transactionDetails.external_status = `dtone_${body.status.id}`

            await transactionDetails.save()
        }
    }
    res.status(200).send("EVENT_RECEIVED");
}

// chatbot schedule
module.exports.setCalendarSchedule = async (req, res) => {
    try {
        // let data = await decryption(req.body.data)
        const { date, time, timezone, token, type } = req.body.data;
        const decoded = jwt.verify(token, process.env.BOT_SECRET_TOKEN_KEY);
        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
            let error = await encryption({
                message: "Token expired!",
                status: "false",
            });
            return res.status(400).send(error);
        }
        if (decoded) {
            const senderId = decoded.senderId;
            const instaChatbotId = decoded.instaChatbotId;

            console.log(decoded, "decoded")
            InstaChatbot.findById(instaChatbotId).then(async (chatbot) => {
                if (chatbot) {
                    chatbot.scheduleDate = date;
                    chatbot.scheduleTime = time;
                    chatbot.scheduleTimezone = timezone;
                    await chatbot.save()

                    const receiverWalletDetails = await Wallet.findOne({ wallet_id: chatbot?.qr_receiving_wallet }).populate([
                        {
                            path: 'account',
                            populate: [
                                { path: 'user' },
                                { path: 'company' },
                            ]
                        }
                    ]);
                    let senderWalletDetails
                    if (type == "card" || type == "paypal") {
                        const account = await Account.findOne({ username: chatbot.account_username })
                        senderWalletDetails = await fetchLocalOrDefaultWalletConditionally(account._id)
                        if (!senderWalletDetails) {
                            return res.status(400).send(await encryption({ status: false, message: "Local or Default Wallet not found!" }))
                        }

                    } else {
                        senderWalletDetails = await Wallet.findById(chatbot.qr_sending_currency)

                    }
                    const userName = receiverWalletDetails?.account?.account_type === "individual" ? receiverWalletDetails?.account?.user?.first_name + " " + receiverWalletDetails?.account?.user?.last_name : receiverWalletDetails?.account?.company?.company_name

                    const selectedLanguage = chatbot?.active_language || "en"

                    const message = lang[selectedLanguage].SCHEDULE_PAYMENT_INFO
                        .replace(
                            "{{amount}}",
                            formattedAmount(
                                type === "card" || type === "paypal"
                                    ? chatbot?.wallet_transactions?.amount
                                    : chatbot?.w2w_sending_amount
                            )
                        )
                        .replace("{{currency}}", senderWalletDetails?.currency?.code)
                        .replace("{{time}}", time)
                        .replace("{{date}}", date)
                        .replace("{{userName}}", userName);

                    const quickReplies = [
                        { content_type: "text", title: lang[selectedLanguage].CONFIRM_TRANSFER_TITLE, payload: `${type === "card" ? "updated_w2w_card_payment-schedule-confirm" : type === "paypal" ? "w2w_paypal_payment-schedule-confirm" : "w2w_proceed_schedule"}` },
                        { content_type: "text", title: lang[selectedLanguage].CHANGE_SCHEDULE, payload: `${type === "card" ? "updated_w2w_card_payment_schedule-change" : type === "paypal" ? "w2w_paypal_payment_schedule-change" : "w2w_p_schedule"}` },
                        { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: `${type === "card" ? "updated_w2w_card_payment_schedule-cancel" : type === "paypal" ? "w2w_paypal_payment_schedule-cancel" : "cancel_w2w_transs"}` },
                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                    ];

                    const data = {
                        sender: {
                            id: senderId
                        }
                    }
                    await quickReply(data, message, quickReplies);

                    let ciphertext = await encryption({
                        message: "Sheduled time set succesfully",
                        status: "true",
                    });
                    res.status(200).send(ciphertext);
                } else {
                    let error = await encryption({
                        message: "Chatbot not found!",
                        status: "false",
                    });
                    res.status(404).send(error);
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    message: "Something went wrong while finding chatbot!",
                    status: "false",
                });
                res.status(500).send(error);
            })
        }
        else {
            let error = await encryption({
                message: "Invalid Token!",
                status: "false",
            });
            res.status(400).send(error);
        }


    } catch (err) {
        console.log(err);
        let error = await encryption({
            message: "Internal server error!",
            status: "false",
        });
        res.status(400).send(error);
    }
}

module.exports.setPaymentRequestSchedule = async (req, res) => {
    try {
        // let data = await decryption(req.body.data)
        const { date, time, timezone, token } = req.body.data;
        const decoded = jwt.verify(token, process.env.BOT_SECRET_TOKEN_KEY);

        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
            let error = await encryption({
                message: "Token expired!",
                status: "false",
            });
            return res.status(400).send(error);
        }
        if (decoded) {
            const senderId = decoded.senderId;
            const instaChatbotId = decoded.instaChatbotId;
            console.log(decoded, "decoded")
            InstaChatbot.findById(instaChatbotId).then(async (chatbot) => {
                if (chatbot) {
                    chatbot.payment_request.scheduleDate = date;
                    chatbot.payment_request.scheduleTime = time;
                    chatbot.payment_request.scheduleTimezone = timezone
                    await chatbot.save()

                    const receiverDetails = await Account.findById(chatbot?.request_details?.beneficiary).populate(['user', 'company'])
                    const senderWalletDetails = await Wallet.findById(chatbot?.request_details?.requesting_wallet).populate('account')
                    const userName = receiverDetails?.account_type === "individual" ? receiverDetails?.user?.first_name + " " + receiverDetails?.user?.last_name : receiverDetails?.company?.company_name

                    const selectedLanguage = chatbot?.active_language || senderWalletDetails?.account?.language || "en"

                    const message = lang[selectedLanguage].SCHEDULED_PAYMENT_REQUEST_INFO
                        .replace("{{amount}}", chatbot?.request_details?.request_amount?.toFixed(2))
                        .replace("{{currency}}", senderWalletDetails?.currency?.code)
                        .replace("{{userName}}", userName)
                        .replace("{{date}}", date)
                        .replace("{{time}}", time);

                    const quickReplies = [
                        { content_type: "text", title: lang[selectedLanguage].CONFIRM, payload: "pr_proceed_schedule" },
                        { content_type: "text", title: lang[selectedLanguage].CHANGE_SCHEDULE, payload: "req_sched" },
                        { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "canel_pr_sched" },
                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                    ]
                    const data = {
                        sender: {
                            id: senderId
                        }
                    }
                    await quickReply(data, message, quickReplies);

                    let ciphertext = await encryption({
                        message: "Sheduled time set succesfully",
                        status: "true",
                    });
                    res.status(200).send(ciphertext);
                } else {
                    let error = await encryption({
                        message: "Chatbot not found!",
                        status: "false",
                    });
                    res.status(404).send(error);
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    message: "Something went wrong while finding chatbot!",
                    status: "false",
                });
                res.status(500).send(error);
            })
        }
        else {
            let error = await encryption({
                message: "Invalid Token!",
                status: "false",
            });
            res.status(400).send(error);
        }


    } catch (err) {
        console.log(err);
        let error = await encryption({
            message: "Internal server error!",
            status: "false",
        });
        res.status(400).send(error);
    }
}

module.exports.setCalendarSubscription = async (req, res) => {
    try {
        // let data = await decryption(req.body.data)
        const { date, timezone, token, type } = req.body.data;
        const decoded = jwt.verify(token, process.env.BOT_SECRET_TOKEN_KEY);
        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
            let error = await encryption({
                message: "Token expired!",
                status: "false",
            });
            return res.status(400).send(error);
        }
        if (decoded) {
            const senderId = decoded.senderId;
            const instaChatbotId = decoded.instaChatbotId;
            console.log(decoded, "decoded")
            InstaChatbot.findById(instaChatbotId).then(async (chatbot) => {
                if (chatbot) {
                    chatbot.subscriptionDate = date;
                    chatbot.subscriptionTimezone = timezone;
                    await chatbot.save()

                    const account = await Account.findOne({ username: chatbot.username })
                    const selectedLanguage = chatbot?.active_language || account?.language || "en"

                    const quickReplies = [
                        { content_type: "text", title: lang[selectedLanguage].SET_NUMBER_OF_MONTHS, payload: `${type === "card" ? "updated_w2w_card_payment_subs-cycles" : type === "paypal" ? "w2w_paypal_payment_payment_subs-cycles" : "w2w_cycles"}` },
                        { content_type: "text", title: lang[selectedLanguage].SET_END_DATE, payload: `${type === "card" ? "updated_w2w_card_payment_subs-end" : type === "paypal" ? "w2w_paypal_payment_payment_subs-end" : "w2w_end_date"}` },
                        { content_type: "text", title: lang[selectedLanguage].UNTIL_CANCELED, payload: `${type === "card" ? "updated_w2w_card_payment_subs-until" : type === "paypal" ? "w2w_paypal_payment_payment_subs-until" : "w2w_until_stop"}` },
                        { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: `${type === "card" ? "updated_w2w_card_payment_subs" : type === "paypal" ? "w2w_paypal_payment_payment_subs" : "cancel_w2w_transs"}` },
                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                    ];
                    const data = {
                        sender: {
                            id: senderId
                        }
                    }
                    await quickReply(data, lang[selectedLanguage].DEFINE_SUBSCRIPTION_DURATION, quickReplies);


                    let ciphertext = await encryption({
                        message: "Sheduled time set succesfully",
                        status: "true",
                    });
                    res.status(200).send(ciphertext);
                } else {
                    let error = await encryption({
                        message: "Chatbot not found!",
                        status: "false",
                    });
                    res.status(404).send(error);
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    message: "Something went wrong while finding chatbot!",
                    status: "false",
                });
                res.status(500).send(error);
            })
        }
        else {
            let error = await encryption({
                message: "Invalid Token!",
                status: "false",
            });
            res.status(400).send(error);
        }


    } catch (err) {
        console.log(err);
        let error = await encryption({
            message: "Internal server error!",
            status: "false",
        });
        res.status(400).send(error);
    }
}

module.exports.setCalendarSubscriptionEndDate = async (req, res) => {
    try {
        // let data = await decryption(req.body.data)
        const { date, token, type } = req.body.data;
        const decoded = jwt.verify(token, process.env.BOT_SECRET_TOKEN_KEY);
        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
            let error = await encryption({
                message: "Token expired!",
                status: "false",
            });
            return res.status(400).send(error);
        }
        if (decoded) {
            const senderId = decoded.senderId;
            const instaChatbotId = decoded.instaChatbotId;
            console.log(decoded, "decoded")
            InstaChatbot.findById(instaChatbotId).then(async (chatbot) => {
                if (chatbot) {

                    chatbot.subscriptionEndDate = date;
                    await chatbot.save()
                    const account = await Account.findOne({ username: chatbot.username })
                    const selectedLanguage = chatbot?.active_language || account?.language || "en"

                    const receiverWalletDetails = await Wallet.findOne({ wallet_id: chatbot?.qr_receiving_wallet }).populate([
                        {
                            path: 'account',
                            populate: [
                                { path: 'user' },
                                { path: 'company' },
                            ]
                        }
                    ]);

                    let senderWalletDetails
                    if (type == "card" || type == "paypal") {
                        const account = await Account.findOne({ username: chatbot.account_username })
                        senderWalletDetails = await fetchLocalOrDefaultWalletConditionally(account._id)
                        if (!senderWalletDetails) {
                            return res.status(400).send(await encryption({ status: false, message: "Local or Default Wallet not found!" }))
                        }
                    } else {
                        senderWalletDetails = await Wallet.findById(chatbot.qr_sending_currency)

                    }
                    const userName = receiverWalletDetails?.account?.account_type === "individual" ? receiverWalletDetails?.account?.user?.first_name + " " + receiverWalletDetails?.account?.user?.last_name : receiverWalletDetails?.account?.company?.company_name

                    const message = lang[selectedLanguage]["SUBSCRIPTION_INITIATION_WITH_END_DATE"]
                        .replace("{{amount}}", formattedAmount(type == "card" || type == "paypal" ? chatbot?.wallet_transactions.amount : chatbot?.w2w_sending_amount))
                        .replace("{{currency}}", senderWalletDetails?.currency.code)
                        .replace("{{recipient}}", userName)
                        .replace("{{start_date}}", chatbot?.subscriptionDate)
                        .replace("{{end_date}}", date);
                    const quickReplies = [
                        { content_type: "text", title: lang[selectedLanguage].CONFIRM_TITLE, payload: `${type === "card" ? "updated_w2w_card_payment_subs-end-confirm" : type === "paypal" ? "w2w_paypal_payment_subs-end-confirm" : "w2w_proceed_subsription_ed"}` },
                        { content_type: "text", title: lang[selectedLanguage].CHANGE_DATE, payload: `${type === "card" ? "updated_w2w_card_payment_subs-change-end-date" : type === "paypal" ? "w2w_paypal_payment_subs-change-end-date" : "w2w_end_date"}` },
                        { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: `${type === "card" ? "updated_w2w_card_payment_subs-cancel" : type === "paypal" ? "w2w_paypal_payment_subs-cancel" : "cancel_w2w_transs"}` },
                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                    ];

                    const data = {
                        sender: {
                            id: senderId
                        }
                    }
                    await quickReply(data, message, quickReplies);


                    let ciphertext = await encryption({
                        message: "Sheduled time set succesfully",
                        status: "true",
                    });
                    res.status(200).send(ciphertext);
                } else {
                    let error = await encryption({
                        message: "Chatbot not found!",
                        status: "false",
                    });
                    res.status(404).send(error);
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    message: "Something went wrong while finding chatbot!",
                    status: "false",
                });
                res.status(500).send(error);
            })
        }
        else {
            let error = await encryption({
                message: "Invalid Token!",
                status: "false",
            });
            res.status(400).send(error);
        }


    } catch (err) {
        console.log(err);
        let error = await encryption({
            message: "Internal server error!",
            status: "false",
        });
        res.status(400).send(error);
    }
}

module.exports.setRequestSubscriptionEndDate = async (req, res) => {
    try {
        // let data = await decryption(req.body.data)
        const { date, token } = req.body.data;
        const decoded = jwt.verify(token, process.env.BOT_SECRET_TOKEN_KEY);
        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
            let error = await encryption({
                message: "Token expired!",
                status: "false",
            });
            return res.status(400).send(error);
        }
        if (decoded) {
            const senderId = decoded.senderId;
            const instaChatbotId = decoded.instaChatbotId;
            console.log(decoded, "decoded")
            InstaChatbot.findById(instaChatbotId).then(async (chatbot) => {
                if (chatbot) {
                    // no of cycles calculation
                    const numCompleteMonths = calculateCompleteMonths(chatbot?.payment_request?.subscriptionDate, date);
                    chatbot.payment_request.subscriptionEndDate = date;
                    chatbot.payment_request.subscriptionCycles = numCompleteMonths;
                    await chatbot.save()

                    const account = await Account.findOne({ username: chatbot.username })
                    const selectedLanguage = chatbot?.active_language || account?.language || "en"

                    // const data = {
                    //     amount: .request_amount,
                    //     wallet_id: instaChatbot?.request_details?.requesting_wallet,
                    //     purpose: instaChatbot?.request_details?.purpose ?? "",
                    //     sender: account._id,
                    //     receiver: instaChatbot?.request_details?.beneficiary,
                    //     date: instaChatbot ?,
                    //     cycles: instaChatbot.payment_request.subscriptionCycles,
                    // }

                    const requestingWallet = await Wallet.findById(chatbot?.request_details?.requesting_wallet).populate([
                        {
                            path: 'account',
                            populate: [
                                { path: 'user' },
                                { path: 'company' },
                            ]
                        }
                    ]);
                    const beneficiary = await Account.findById(chatbot?.request_details?.beneficiary).populate([
                        'user',
                        'company',
                    ])
                    const userName = beneficiary?.account_type === "individual" ? beneficiary?.user?.first_name + " " + beneficiary?.user?.last_name : beneficiary?.company?.company_name

                    const message = lang[selectedLanguage]["SUBSCRIPTION_INITIATION_WITH_END_DATE"]
                        .replace("{{amount}}", chatbot?.request_details?.request_amount?.toFixed(2))
                        .replace("{{currency}}", requestingWallet?.currency.code)
                        .replace("{{recipient}}", userName)
                        .replace("{{start_date}}", chatbot?.payment_request?.subscriptionDate)
                        .replace("{{end_date}}", date);

                    const quickReplies = [
                        { content_type: "text", title: lang[selectedLanguage].CONFIRM_TITLE, payload: "pr_proceed_subsription_ed" },
                        { content_type: "text", title: lang[selectedLanguage].CHANGE_DATE, payload: "pr_end_date" },
                        { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "cancel_w2w_transs" },
                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                    ]
                    const data = {
                        sender: {
                            id: senderId
                        }
                    }
                    await quickReply(data, message, quickReplies);


                    let ciphertext = await encryption({
                        message: "Sheduled time set succesfully",
                        status: "true",
                    });
                    res.status(200).send(ciphertext);
                } else {
                    let error = await encryption({
                        message: "Chatbot not found!",
                        status: "false",
                    });
                    res.status(404).send(error);
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    message: "Something went wrong while finding chatbot!",
                    status: "false",
                });
                res.status(500).send(error);
            })
        }
        else {
            let error = await encryption({
                message: "Invalid Token!",
                status: "false",
            });
            res.status(400).send(error);
        }


    } catch (err) {
        console.log(err);
        let error = await encryption({
            message: "Internal server error!",
            status: "false",
        });
        res.status(400).send(error);
    }
}

module.exports.setPaymentRequestSubscription = async (req, res) => {
    try {
        // let data = await decryption(req.body.data)
        const { date, timezone, token } = req.body.data;
        const decoded = jwt.verify(token, process.env.BOT_SECRET_TOKEN_KEY);
        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
            let error = await encryption({
                message: "Token expired!",
                status: "false",
            });
            return res.status(400).send(error);
        }
        if (decoded) {
            const senderId = decoded.senderId;
            const instaChatbotId = decoded.instaChatbotId;
            console.log(decoded, "decoded")
            InstaChatbot.findById(instaChatbotId).then(async (chatbot) => {
                if (chatbot) {
                    chatbot.payment_request.subscriptionDate = date;
                    chatbot.payment_request.subscriptionTimezone = timezone;
                    await chatbot.save()

                    const account = await Account.findOne({ username: chatbot.username })
                    const selectedLanguage = chatbot?.active_language || account?.language || "en"

                    // const templatePayload = {
                    //     template_type: "generic",
                    //     elements: [
                    //         {

                    //             title: `You have selected ${date} for your subscribed payment`,
                    //             buttons: [
                    //                 {
                    //                     type: "postback",
                    //                     title: "Proceed",
                    //                     payload: "pr_proceed_subsription",
                    //                 },
                    //                 {
                    //                     type: "postback",
                    //                     title: "Change Date",
                    //                     payload: "req_subs",
                    //                 },
                    //                 {
                    //                     type: "postback",
                    //                     title: "Main Menu",
                    //                     payload: "main_menu",
                    //                 },

                    //             ],
                    //         },

                    //     ]
                    // };
                    // await sendTemplate(data = {}, senderId, templatePayload)

                    const quickReplies = [
                        { content_type: "text", title: lang[selectedLanguage].SET_NUMBER_OF_MONTHS, payload: "pr_cycles" },
                        { content_type: "text", title: lang[selectedLanguage].SET_END_DATE, payload: "pr_end_date" },
                        { content_type: "text", title: lang[selectedLanguage].UNTIL_CANCELED, payload: "pr_until_stop" },
                        { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "cancel_w2w_transs" },
                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                    ];
                    const data = {
                        sender: {
                            id: senderId
                        }
                    }
                    await quickReply(data, lang[selectedLanguage].DEFINE_SUBSCRIPTION_DURATION, quickReplies);

                    let ciphertext = await encryption({
                        message: "Sheduled time set succesfully",
                        status: "true",
                    });
                    res.status(200).send(ciphertext);
                } else {
                    let error = await encryption({
                        message: "Chatbot not found!",
                        status: "false",
                    });
                    res.status(404).send(error);
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    message: "Something went wrong while finding chatbot!",
                    status: "false",
                });
                res.status(500).send(error);
            })
        }
        else {
            let error = await encryption({
                message: "Invalid Token!",
                status: "false",
            });
            res.status(400).send(error);
        }


    } catch (err) {
        console.log(err);
        let error = await encryption({
            message: "Internal server error!",
            status: "false",
        });
        res.status(400).send(error);
    }
}

// telegram schedule webhooks
module.exports.setCalendarScheduleTelegram = async (req, res) => {
    try {
        // let data = await decryption(req.body.data)
        const { date, time, timezone, token, type } = req.body.data;
        const decoded = jwt.verify(token, process.env.BOT_SECRET_TOKEN_KEY);
        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
            let error = await encryption({
                message: "Token expired!",
                status: "false",
            });
            return res.status(400).send(error);
        }
        if (decoded) {
            const senderId = decoded.senderId;
            const telegramId = decoded.instaChatbotId;

            console.log(decoded, "decoded")
            TelegramBotModel.findById(telegramId).then(async (chatbot) => {
                if (chatbot) {

                    if (chatbot.schedule.scheduleDate || chatbot.schedule.scheduleTime || chatbot.schedule.scheduleTimezone) {
                        return res.status(400).send(await encryption({ status: false, message: "Schedule already set!" }))
                    }

                    chatbot.schedule.scheduleDate = date;
                    chatbot.schedule.scheduleTime = time;
                    chatbot.schedule.scheduleTimezone = timezone;
                    await chatbot.save()

                    const receiverWalletDetails = await Wallet.findOne({ wallet_id: chatbot?.wallet_to_wallet.receiving_wallet }).populate([
                        {
                            path: 'account',
                            populate: [
                                { path: 'user' },
                                { path: 'company' },
                            ]
                        }
                    ]);
                    let senderWalletDetails
                    if (type == "card" || type == "paypal") {
                        const account = await Account.findOne({ username: chatbot.account_username })
                        senderWalletDetails = await fetchLocalOrDefaultWalletConditionally(account._id)
                        if (!senderWalletDetails) {
                            return res.status(400).send(await encryption({ status: false, message: "Local or Default Wallet not found!" }))
                        }

                    } else {
                        senderWalletDetails = await Wallet.findById(chatbot.wallet_to_wallet.sending_wallet)

                    }
                    const userName = receiverWalletDetails?.account?.account_type === "individual" ? receiverWalletDetails?.account?.user?.first_name + " " + receiverWalletDetails?.account?.user?.last_name : receiverWalletDetails?.account?.company?.company_name

                    const selectedLanguage = chatbot?.active_language || "en"

                    const message = lang[selectedLanguage].SCHEDULE_PAYMENT_INFO
                        .replace(
                            "{{amount}}",
                            formattedAmount(
                                type === "card" || type === "paypal"
                                    ? chatbot?.wallet_transactions?.amount
                                    : chatbot?.wallet_to_wallet.amount
                            )
                        )
                        .replace("{{currency}}", senderWalletDetails?.currency?.code)
                        .replace("{{time}}", time)
                        .replace("{{date}}", date)
                        .replace("{{userName}}", userName);

                    console.log({ message })

                    const buttons = [
                        [{ text: lang[selectedLanguage].CONFIRM_TRANSFER_TITLE, callback_data: `${type === "card" ? "updated_w2w_card_payment-schedule-confirm" : type === "paypal" ? "w2w_paypal_payment-schedule-confirm" : "w2w_ip_w_schedule_proceed"}` }],
                        [{ text: lang[selectedLanguage].CHANGE_SCHEDULE, callback_data: `${type === "card" ? "updated_w2w_card_payment_schedule-change" : type === "paypal" ? "w2w_paypal_payment_schedule-change" : "w2w_ip_w_schedule"}` }],
                        [{ text: lang[selectedLanguage].CANCEL, callback_data: `${type === "card" ? "updated_w2w_card_payment_schedule-cancel" : type === "paypal" ? "w2w_paypal_payment_schedule-cancel" : "cancel_w2w_transs"}` }],
                        [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
                    ];


                    await sendButtons(senderId, message, buttons);

                    let ciphertext = await encryption({
                        message: "Sheduled time set succesfully",
                        status: "true",
                    });
                    res.status(200).send(ciphertext);
                } else {
                    let error = await encryption({
                        message: "Chatbot not found!",
                        status: "false",
                    });
                    res.status(404).send(error);
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    message: "Something went wrong while finding chatbot!",
                    status: "false",
                });
                res.status(500).send(error);
            })
        }
        else {
            let error = await encryption({
                message: "Invalid Token!",
                status: "false",
            });
            res.status(400).send(error);
        }


    } catch (err) {
        console.log(err);
        let error = await encryption({
            message: "Internal server error!",
            status: "false",
        });
        res.status(400).send(error);
    }
}
// thunes collection
module.exports.thunesAcceptPayment = async (req, res) => {
    try {
        console.log(`\u{1F7EA} thunes collection webhook ${req.url}`)
        const reference_id = req.query.ref

        const transactionDetails = await Transaction.findOne({ reference_id, status: "INITIATED" }).populate("account")
        console.log(transactionDetails, "transactionDetails")

        if (!transactionDetails) {
            return console.log("no transaction")
        }

        const paymentOrderId = transactionDetails.external_reference

        // getting payment order details
        const url = `${thunesAcceptURL}/payment-orders/${paymentOrderId}`

        const paymentDetails = await axios.get(url, {
            auth: {
                username: thunesAcceptUsername,
                password: thunesAcceptPassword,
            }
        })

        const paymentOrder = paymentDetails.data

        console.log(paymentOrder, "paymentOrder")

        if (!paymentOrder) {
            return console.log("no payment order")
        }

        let timezone = transactionDetails?.account?.timezone || "UTC"

        const currentTime = moment.tz(timezone).format();

        if (paymentOrder.status === "CHARGED") {
            const walletDetails = await Wallet.findById(transactionDetails.wallet)
            transactionDetails.current_balance = walletDetails.balance.available

            walletDetails.balance.available += transactionDetails.amount
            await walletDetails.save()

            transactionDetails.timeline.push({
                date: currentTime,
                status: "COMPLETED"
            })
            transactionDetails.status = "COMPLETED"
            transactionDetails.new_balance = walletDetails.balance.available

            if (transactionDetails.hidden) {
                transactionDetails.hidden = false
            }

            await transactionDetails.save()

        } else if (paymentOrder.status === "AUTHORIZING" || paymentOrder.status === "AUTHORIZED") {
            if (transactionDetails.hidden) {
                transactionDetails.hidden = false
                await transactionDetails.save()
            }
        }
        else if (paymentOrder.status === "ABORTED" || paymentOrder.status === "REFUSED" || paymentOrder.status === "ERROR") {

            transactionDetails.timeline.push({
                date: currentTime,
                status: paymentOrder.status
            })
            transactionDetails.status = paymentOrder.status

            if (transactionDetails.hidden) {
                transactionDetails.hidden = false
            }

            await transactionDetails.save()
        }
        // else {
        //     transactionDetails.timeline.push({
        //         date: currentTime,
        //         status: paymentOrder.status
        //     })
        //     transactionDetails.status = paymentOrder.status

        //     await transactionDetails.save()
        // }

        return res.status(200).send("EVENT_RECEIVED")


    } catch (err) {
        console.log(err?.response?.data?.errors || err, "error in thunes accept webhook")
        return res.status(200).send("EVENT_RECEIVED")
    }
}

// jw player
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));  // function for delay

module.exports.getJWPlayer = async (req, res) => {
    try {
        const { event, media_id, thumbnail_id } = req.body;
        console.log(`\u{1F7EA} JW Player webhook ${{ event, media_id, thumbnail_id }}`)

        const updateMediaStatus = async (mediaId, status, url) => {
            const document = await Document.findOne({ "jw_media.mediaId": mediaId });

            if (document) {
                // document.jw_media.status = status;
                document.jw_media.thumbnail_url = url || "";
                await document.save();
                console.log(`Updated mediaId: ${mediaId}, status: ${status}`);
            } else {
                console.log(`MediaId ${mediaId} not found in the system.`);
            }
        };

        switch (event) {
            case 'media_created':
                console.log("break")
                // await updateMediaStatus(media_id, 'created');
                break;

            case 'media_available':
                let availableRetry = 0;
                let mediaFound = false;

                while (availableRetry < 2 && !mediaFound) {
                    const document = await Document.findOne({ "jw_media.mediaId": media_id });
                    if (document) {
                        document.jw_media.status = 'ready';
                        await document.save();
                        console.log(`MediaId ${media_id} marked as ready.`);
                        mediaFound = true;
                    } else {
                        console.log(`MediaId ${media_id} not found. delayinnnnnng`);
                        availableRetry++;
                        await delay(60000);
                    }
                }
                break;

            case 'thumbnail_created':
                try {
                    const thumbnailUrl = `https://api.jwplayer.com/v2/sites/${process.env.JW_SITE_ID}/thumbnails/${thumbnail_id}`;
                    const headers = {
                        Authorization: `Bearer ${process.env.JW_API_KEY}`,
                    };

                    // fetch thumbnail data from JW Player API
                    const thumbnailResponse = await axios.get(thumbnailUrl, { headers });

                    console.log(thumbnailResponse)

                    if (thumbnailResponse.status === 200) {
                        const { delivery_url } = thumbnailResponse.data;

                        let thumbnailRetry = 0;
                        let thumbnailFound = false;

                        while (thumbnailRetry < 2 && !thumbnailFound) {
                            const document = await Document.findOne({ "jw_media.mediaId": media_id });
                            if (document) {
                                await updateMediaStatus(media_id, 'thumbnail_created', delivery_url);
                                thumbnailFound = true;
                            } else {
                                console.log(`MediaId ${media_id} not found for thumbnail. delayinnnnnng`);
                                thumbnailRetry++;
                                await delay(60000);
                            }
                        }
                    } else {
                        console.log(`Failed to fetch thumbnail data for thumbnail_id ${thumbnail_id}.`);
                    }
                } catch (error) {
                    console.error(`Error fetching thumbnail data for thumbnail_id ${thumbnail_id}:`, error.message);
                }
                break;

            default:
                console.log(`Unhandled event: ${event}`);
                break;
        }

        return res.status(200).send("EVENT_RECEIVED")
    } catch (err) {
        console.error(err);
        return res.status(200).send("EVENT_RECEIVED")
    }
};

module.exports.getTelegramNotifications = async (req, res) => {
    let body = req.body;

    console.log(`\u{1F7EA} Received Telegram webhook:`);
    console.dir(body, { depth: null });

    await telegramWebhook(body)
    res.status(200).send("EVENT_RECEIVED");
}

module.exports.getVccdaddyNotifications = async (req, res) => {
    const body = req.body;

    console.log(`\u{1F7EA} Received vccdaddy webhook:`);
    console.dir(body, { depth: null });

    const filePath = path.join(__dirname, 'vcc.txt');
    const logEntry = `Timestamp: ${new Date().toISOString()}\n${JSON.stringify(body, null, 2)}\n\n`;

    fs.appendFile(filePath, logEntry, (err) => {
        if (err) console.error("Error saving webhook data:", err);
        else console.log("Webhook data saved successfully.");
    });

    try {
        const virtualCard = await VirtualCardModel.findOne({ card_id: body?.cardId })
            .populate({ path: 'account', select: 'level', populate: { path: 'level', select: '_id' } });

        let serviceName;
        if (virtualCard) {
            serviceName = `card_trx_${virtualCard.type}_${virtualCard.subscription_type}`;
        }

        const feeDetails = await FeeModel.findOne({
            service_name: serviceName,
            account_level: virtualCard?.account?.level?._id
        });

        console.log({ feeDetails })

        let totalFeeInUSD = calculateFee(feeDetails, body?.billAmt, serviceName);
        let feeConvertedIntoCardCurrency = await convertFeeCurrency(totalFeeInUSD, body?.txnCcy);

        if (virtualCard) {
            try {
                const cardBalance = await getCardBalance(virtualCard.card_id);
                console.log({ cardBalance, feeConvertedIntoCardCurrency });
                if (cardBalance >= feeConvertedIntoCardCurrency) {
                    await withdrawFromCard(virtualCard.card_id, feeConvertedIntoCardCurrency, body?.txnCcy);
                } else {
                    console.log("Insufficient card balance. Trying wallet deduction...");
                    await deductFromWallet(
                        virtualCard.account._id,
                        feeConvertedIntoCardCurrency,
                        body?.txnCcy,
                        body?.txnId

                    );
                }
            } catch (error) {
                console.error("Payment processing error:", error);
            }
        }

        await saveTransaction(body, virtualCard, feeConvertedIntoCardCurrency);
        console.log('Transaction saved successfully');

    } catch (error) {
        console.error('Error processing transaction:', error);
    }

    res.status(200).send("EVENT_RECEIVED");
};

// Helper functions fro VCC
async function getCardBalance(cardId) {
    const response = await axios.post(`${process.env.vccdaddyURL}/openapi/card/hk/info`, {
        data: encryptDataVCC({ cardId })
    }, {
        headers: { 'Content-Type': 'application/json', 'oaToken': process.env.vccToken }
    });

    if (response.data.code === 1) {
        return parseFloat(decryptDataVCC(response.data.data).cardBal);
    }
    throw new Error("Failed to fetch card balance");
}

async function withdrawFromCard(cardId, amount, currency) {
    const response = await axios.post(`${process.env.vccdaddyURL}/openapi/card/withdraw`, {
        data: encryptDataVCC({ cardId, amount, currency })
    }, {
        headers: { 'Content-Type': 'application/json', 'oaToken': process.env.vccToken }
    });

    if (response.data.code !== 1) {
        throw new Error("Withdrawal failed: " + response.data);
    }
}

async function deductFromWallet(accountId, feeAmount, transactionCurrency, external_id) {
    // First get all wallets sorted by:
    // 1. Same currency as transaction (highest priority)
    // 2. Default wallet (secondary priority)
    // 3. Others
    const wallets = await Wallet.find({ account: accountId })
        .sort({
            default: -1,
            'currency.code': transactionCurrency === '$currency.code' ? -1 : 1,
        });

    const sameCurrencyWallet = wallets.find(w =>
        w.currency.code === transactionCurrency &&
        w.balance.available >= feeAmount
    );

    if (sameCurrencyWallet) {
        const previousBalance = sameCurrencyWallet.balance.available;
        sameCurrencyWallet.balance.available -= feeAmount;
        await sameCurrencyWallet.save();

        console.log(`Deducted ${feeAmount} ${transactionCurrency} from same-currency wallet ${sameCurrencyWallet._id}`);

        // Save wallet transaction
        await saveWalletTransaction({
            wallet: sameCurrencyWallet,
            amount: feeAmount,
            currency: transactionCurrency,
            previousBalance,
            newBalance: sameCurrencyWallet.balance.available,
            external_id
        });

        return true;
    }

    // If no same-currency wallet with enough balance, try others
    for (const wallet of wallets) {
        try {
            const walletCurrency = wallet.currency.code;
            let amountToDeduct = feeAmount;

            if (walletCurrency !== transactionCurrency) {
                amountToDeduct = formatDecimalNumbersWithLimit(
                    await convertCurrency(transactionCurrency, walletCurrency, feeAmount)
                );
            }

            if (wallet.balance.available >= amountToDeduct) {
                const previousBalance = wallet.balance.available;
                wallet.balance.available -= amountToDeduct;
                await wallet.save();

                console.log(`Deducted ${amountToDeduct} ${walletCurrency} from wallet ${wallet._id}`);

                // Save wallet transaction
                await saveWalletTransaction({
                    wallet,
                    amount: amountToDeduct,
                    currency: walletCurrency,
                    previousBalance,
                    newBalance: wallet.balance.available,
                    external_id,
                    convertedFrom: walletCurrency !== transactionCurrency ? transactionCurrency : undefined,
                    originalAmount: walletCurrency !== transactionCurrency ? feeAmount : undefined
                });

                return true;
            }
        } catch (error) {
            console.error(`Error processing wallet ${wallet._id}:`, error);
        }
    }

    console.log("Insufficient balance in all wallets");
    return false;
}

async function saveWalletTransaction({
    wallet,
    amount,
    currency,
    previousBalance,
    newBalance,
    external_id,
    convertedFrom,
    originalAmount
}) {
    const transactionObj = {
        reference_id: 'tr_' + Date.now().toString(),
        type: "debit",
        transaction_type: "card_fee_payment",
        service_type: "card_transaction_fee",
        payment_type: "wallet_payment",
        status: "COMPLETED",
        // purpose: "Virtual card transaction fee",
        description: "Deduction for virtual card transaction fee",
        currency: { code: currency, symbol: wallet.currency.symbol },
        amount: amount,
        fee: 0,
        total: amount,
        wallet_id: wallet.wallet_id,
        wallet: wallet._id,
        account: wallet.account,
        current_balance: previousBalance,
        new_balance: newBalance,
        external_reference: external_id,
        timeline: [{
            status: 'COMPLETED',
            date: new Date()
        }]
    };

    // Add conversion details if currency was converted
    if (convertedFrom && originalAmount) {
        transactionObj.exchange_rate = amount / originalAmount;
        // transactionObj.original_currency = convertedFrom;
        // transactionObj.original_amount = originalAmount;
    }

    try {
        await Transaction.create(transactionObj);
        console.log('Wallet transaction record saved successfully');
    } catch (error) {
        console.error('Error saving wallet transaction:', error);
    }
}

function calculateFee(feeDetails, billAmt, serviceName) {
    if (serviceName?.includes("premium_plus")) {
        return feeDetails.flat_fee + (parseFloat(billAmt) * (feeDetails.percentage_fee / 100));
    }
    return feeDetails.fee_type === 'percentage'
        ? parseFloat(billAmt) * (feeDetails.percentage_fee / 100)
        : feeDetails.flat_fee;
}

async function convertFeeCurrency(totalFeeInUSD, transactionCurrency) {
    return transactionCurrency === 'USD'
        ? totalFeeInUSD
        : formatDecimalNumbersWithLimit(await convertCurrency('USD', transactionCurrency, totalFeeInUSD));
}

async function saveTransaction(body, virtualCard, fee) {
    const transactionData = {
        cardNo: body?.cardId,
        authCode: body?.authCode || undefined,
        transactionId: body?.txnId,
        fee,
        billAmount: parseFloat(body?.billAmt),
        txAmount: parseFloat(body?.txnAmt),
        currency: body?.txnCcy,
        merchantName: body?.merchName,
        merchantCategory: body?.mcc,
        merchantCountry: body?.merchCtry,
        status: body?.txnStatus === '1' ? 'COMPLETED' : 'FAILED',
        reason: body?.declineReason || (body?.rspCode !== '00' ? `RspCode: ${body?.rspCode || "N/A"}` : ""),
        type: "debit",
        transaction_type: "card_to_merchant",
        accountId: virtualCard?.account
    };

    await new VCCTransactionModel(transactionData).save();
}

module.exports.getVespiaNotifications = async (req, res) => {
    const body = req.body;
    const { status, tx_id, folder_id, aml_link, rule_id, alerts } = body;

    console.log(`\u{1F7EA} Received VESPIA webhook:`);
    console.dir(body, { depth: null });

    // Find the transaction by payment_id (tx_id from VESPIA)
    const transaction = await Transaction.findOne({ payment_id: tx_id, status: 'INITIATED' });

    if (!transaction) {
        console.error("Transaction not found");
        return res.status(200).send("EVENT_RECEIVED");
    }

    const wallet = await Wallet.findById(transaction.wallet);
    if (!wallet) {
        console.error("Wallet not found");
        return res.status(200).send("EVENT_RECEIVED");
    }

    try {
        // Save VESPIA details inside the transaction schema
        transaction.vespia = {
            folder_id,
            aml_link,
            rule_id,
            status,
            alerts
        };
        await transaction.save();

        if (status === 'CLEAR') {
            const config = {
                headers: {
                    'Authorization': authHeaders,
                    'Content-Type': 'application/json'
                }
            };
            const API_URL = `${prodUrl}/v2/money-transfer/transactions/ext-${transaction.external_reference}/confirm`;
            const response = await axios.post(API_URL, {}, config);
            const confirmationResult = response.data;
            console.log(confirmationResult);

            if (confirmationResult.status_class_message === 'CONFIRMED') {
                console.log("Transaction successful");
            } else {
                wallet.balance.available += transaction.total;
                await wallet.save();
                transaction.status = 'FAILED';
                await transaction.save();
                console.error('Thunes confirmation failed');
            }
        } else if (status === "RISKY") {
            wallet.balance.available += transaction.total;
            await wallet.save();
            transaction.status = 'RISKY';
            await transaction.save();
            console.error('Transaction marked as risky');
        }
    } catch (err) {
        console.error('Error handling VESPIA callback:', err);
        wallet.balance.available += transaction.total;
        await wallet.save();
        transaction.status = 'FAILED';
        await transaction.save();
        console.error('Internal server error');
    }

    return res.status(200).send("EVENT_RECEIVED");
};
