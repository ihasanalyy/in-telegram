const axios = require('axios');
const CryptoJS = require("crypto-js");
const Account = require('../models/Account.model');
const jwt = require('jsonwebtoken');
const countries = require('../utils/countryIso.json');
const moment = require('moment-timezone');
const facebook_access_token = process.env.facebook_access_token//"EAAGOMUlfR7cBO6n48Rrs2plzu65R0vuF04cbFZBwwXo3GlHLgUWNLFx4SPJUTnZBGZAgAaIL7N4N9m4xldOv6K5GnxYZBKONlyRec10qhmz8Q3Fm1lxrl9yUdouq22r3rX1HYOV0399MH7eRsgRsOplDebRvFYoQzJQsUrplZAvQR9swgyLPRya2yC4tvX0ZCF"//"EAAKsyIWCvBEBO1QxjMLOWjfUUb5aQZB3HgkQLxDYvPe0aXWLtlKxreGpu1QzV6I4YNZBSFTzMiliVMMa3PrmstgMT7PjTqPziUsg1cXUHHYsZBpvdgP3JfViRWLA8qwo4HxuSaflA2tnexobjE8egttZCS7HIjvm7OmTP9CoXcQUJX5EY37KBGZCcs7V80te6"
const facebook_page_id = "206463389213262"//"211768592028127"
const secretKey = process.env.BOT_SECRET_TOKEN_KEY;;
const { encryption, decryption } = require('../configurations/Encryption');
const InstaChatbotModel = require('../models/InstaChatbot.model');
const lang = require('../utils/languages/languages.json');
const Wallet = require('../models/Wallet.model');
const { availableCurrencies, requestCurrency, verifyQrCode, walletToWalletTransaction, schedulePaymentW2W, subscribePaymentW2W, getCountries, getServices, getPayerNames, createTransaction, confirmTransaction, requestPayment, buyerToSellerReview, sellerToBuyerReview, sellerToBuyerReply, getReviewsBySeller, addQuotation, bargain, revise, numberVerificationAirtime, getSubservices, getProductsofSubservices, getProductsPrice, createAirtimeTransaction, declineQuotation, declinePaymentRequest, subscribeRequestPaymentW2W, scheduleRequestPaymentW2W, createAirtimeFixedTransaction, confirmAirtimeFixedTransaction, uploadToS3, formattedAmount, getExchangeRates, createWithdrawalTransaction, confirmAirtimeTransaction, walletOverviewText } = require('../utils/InstaChatbotHelpers');
const Beneficiary = require('../models/Beneficiary.model');
const User = require('../models/User.model');
const RequestPayment = require('../models/Request-Payment.model');
const RequestReview = require('../models/RequestReview.model');
const Transaction = require('../models/Transaction.model');
const Quotation = require('../models/Quotation.model');
const Schedule = require('../models/Schedule.model');
const Withdrawal = require('../models/User-Withdrawal.model');

const currencyToEmoji = require('../utils/currencyEmojis.json');
const countryToEmoji = require('../utils/countryEmojis.json');
const { sendPrivateMessage } = require('../utils/websocket');
const { sendEmail, sendMailsExport } = require('../utils/sendEmail');
const { getExchangeRatesToUSD, gettingExchangeRates, createQuotationNew, checkTransactionLimitsForSender } = require('../utils/conversion');
const { handleOTPGeneration, invalidMessage, validateOTP, sendSMSTemplate } = require('../utils/instaChatbotOTP');
const { searchUsersAndWallets, getDistinctObjects, userLimitsMessage, usersFeatureMessage, validateAttachments, findDefaultPayoutChannel, fetchWithdrawalsCounties, userKYCVerificationTemplate, getAvailableCountries, fetchCountriesFromThunes, formatDateToDDMMYYYY, getCountryNameByCode, balanceLimitCheck, generateToken, paymentErrorMessage, createWithdrawalDataObject, isTimeDifferenceGreaterThan30Minutes, generateRatingStars, createTransactionInfo } = require('../utils/instaChatbotUtils');
const handleRegistration = require('../utils/chatbot/accountRegisteration');
const PanModel = require('../models/Pan.model');
const { w2wUsingCard } = require('../utils/chatbot/w2w/card/w2wUsingCard');
const { getIntlFXHelper, createQuotationNewHelper, getWithdrawalFXHelper } = require('./Thune.controller');
const { intlUsingCard } = require('../utils/chatbot/intl/intlTransferUsingCard');
const { calculateExchangeAndFees, getGeocodeData, getCardDetails } = require('../utils/helpers');
const handleAirtimeUsingW2W = require('../utils/chatbot/airtime/airtimeUsingWallet');
const handleAirtimeUsingPaypal = require('../utils/chatbot/airtime/airtimeUsingPaypal');
const intlUsingPaypal = require('../utils/chatbot/intl/intlTransferUsingPaypal');
const { w2wUsingPaypal } = require('../utils/chatbot/w2w/paypal/w2wUsingPaypal');
const w2wQrPayPaypal = require('../utils/chatbot/w2w/paypal/w2wQrPayPaypal');
const w2wQuotationPaypal = require('../utils/chatbot/w2w/paypal/w2wQuotationPaypal');
const w2wRequestPaypal = require('../utils/chatbot/w2w/paypal/w2wRequestPaypal');
const w2wCardQRPay = require('../utils/chatbot/w2w/card/w2wCardQRPay');
const w2wCardRequest = require('../utils/chatbot/w2w/card/w2wCardRequest');
const CountryModel = require('../models/Country.model');
const { sendMails } = require('./Account.controller');
const { VVCCreationInsta } = require('../utils/chatbot/vcc/cardCreation');
const VirtualCardModel = require('../models/Virtual-Card.model');
const { cardToCardTransfer } = require('../utils/chatbot/vcc/cardToCardTransfer');
const { addFunds } = require('../utils/chatbot/vcc/addFunds');
const { handleAddFunds } = require('../utils/chatbot/addFunds');
const { handleAirtimeUsingCard } = require('../utils/chatbot/airtime/airtimeUsingCard');

// let selectedLanguage;

// GRAPH API FUNCTIONS
async function quickReply(data, message, quickReplies, lastMessage) {
    try {
        const requestBody = {
            recipient: { id: data?.sender?.id },
            messaging_type: "RESPONSE",
            message: { text: message, quick_replies: quickReplies }
        };
        console.log(requestBody, "requestBody")
        const response = await axios.post(`https://graph.facebook.com/v8.0/me/messages?access_token=${facebook_access_token}`, requestBody);
        console.log('Quick reply Message sent successfully:', response.data);
        if (lastMessage) {
            await updateLastMessage(data, lastMessage);
        }
    } catch (error) {
        console.error('Error sending message:', error.response.data);
    }
}

async function quickMessage(data, message, tag, lastMessage) {
    try {
        const requestBody = {
            recipient: { id: data?.sender?.id },
            messaging_type: "MESSAGE_TAG",
            message: { text: message },
            tag,
        };
        const response = await axios.post(`https://graph.facebook.com/v19.0/${facebook_page_id}/messages?access_token=${facebook_access_token}`, requestBody, {
            headers: { Authorization: `Bearer 752927186795537` }
        });
        console.log('Message sent successfully:', response.data);
        if (lastMessage) {

            await updateLastMessage(data, lastMessage);
        }
    } catch (error) {
        console.error('Error sending message:', error.response.data);
    }
}

async function sendTemplate(data, recipientId, templatePayload, lastMessage) {
    console.log(recipientId, "recipientId")
    const url = `https://graph.facebook.com/v12.0/me/messages`;
    const body = {
        recipient: {
            id: recipientId,
        },
        message: {
            attachment: {
                type: "template",
                payload: templatePayload,
            },
        },
    };

    try {
        const response = await axios.post(url, body, {
            params: {
                access_token: facebook_access_token,
            },
        });
        console.log('Template message sent successfully:', response.data);
        if (lastMessage) {

            await updateLastMessage(data, lastMessage);
        }
    } catch (error) {
        console.error('Error sending template message:', error.response ? error.response.data : error.message);
    }
}

async function sendVideoImage(url, recipientId, type) {
    try {
        const requestBody = {
            recipient: { id: recipientId },
            message: {
                attachment: {
                    type: type,
                    payload: {
                        url,
                        is_reusable: true
                    }
                }
            }
        }
        const config = {
            params: {
                access_token: facebook_access_token
            }
        };
        const response = await axios.post(`https://graph.facebook.com/v19.0/${facebook_page_id}/messages`, requestBody, config)
        console.log(response.data, "message sent")
    } catch (err) {
        console.log(err)
    }
}

async function userInstaInfo(recipientId) {
    try {
        const response = await axios.get(`https://graph.facebook.com/v19.0/${recipientId}?fields=username,name&access_token=${facebook_access_token}`);

        return response.data;
    } catch (err) {
        console.error('Error fetching infor', err);

    }
}

// GENERAL FUNCTIONS

async function updateLastMessage(data, lastMessage) {
    try {
        console.log(data, lastMessage, "datainside")
        // const timestamp = data?.timestamp;
        const timesStamp = new Date();
        // const timesStamp = timestamp ? new Date(timestamp) : new Date();
        console.log(timesStamp, "timesStamp")
        let instaChatbot = await InstaChatbotModel.findOne({ recipient: data?.sender?.id });
        if (instaChatbot) {
            instaChatbot.last_message = lastMessage;
            // instaChatbot.last_message_time = timesStamp
            await instaChatbot.save();
        } else {
            await new InstaChatbotModel({ recipient: data?.sender?.id, last_message: lastMessage, last_message_time: timesStamp }).save();
        }
    } catch (error) {
        console.error('Error updating last message:', error);
    }
}

async function mainMenuMessage(data, recipientId, instaChatbot, selectedLanguage) {

    await quickMessage(data, lang[selectedLanguage].WELCOME_BACK, "CONFIRMED_EVENT_UPDATE");
    const templatePayload = {
        template_type: "generic",
        elements: [
            {

                title: lang[selectedLanguage].VIEW_BALANCE,
                image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/Wallet-Overview%20%282%29.png",
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].WALLET_OVERVIEW,
                        payload: "wallet_overview",
                    },

                ],
            },
            {

                title: lang[selectedLanguage].SEND_MONEY,
                image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/initiate.png",
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].INITIATE_PAYMENT,
                        payload: "initiate_payment",
                    },

                ],
            },
            {

                title: 'My Mastercard Menu',
                image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Payment%20Card.png",
                buttons: [
                    {
                        type: "postback",
                        title: "💳 My Mastercard",
                        payload: "vcc_menu",
                    },

                ],
            },
            {

                title: lang[selectedLanguage].REVIEW_TRANSACTIONS,
                image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/My-Transactions%20%282%29.png",
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].MY_TRANSACTIONS,
                        payload: "my_transactions",
                    },

                ],
            },
            {

                title: lang[selectedLanguage].PAY_QR_CODE,
                image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/qr_pay.png",
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].QR_QUICKPAY,
                        payload: "qr_quickpay",
                    },

                ],
            },
            {

                title: lang[selectedLanguage].GENERATE_QR_CODE,
                image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/my_qr.png",
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].MY_QR_CODE,
                        payload: "my_qrcode",
                    },

                ],
            },
            {

                title: lang[selectedLanguage].DISCOVER_SERVICES,
                image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/explore_more.png",
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].EXPLORE_MORE,
                        payload: "explore_more",
                    },

                ],
            },
            {

                title: lang[selectedLanguage].ADJUST_LANGUAGE_SETTINGS,
                image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/change_language.png",
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].CHANGE_LANGUAGE,
                        payload: "language_change",
                    },

                ],
            },
            {
                title: lang[selectedLanguage].START_LIVE_CHAT,
                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Register.png",
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].CHAT_WITH_US,
                        payload: "chat_with_us",
                    },

                ],
            },
            {
                title: "Logout your session.",
                image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/Login.png",
                buttons: [
                    {
                        type: "postback",
                        title: "Logout",
                        payload: "logout",
                    },

                ],
            },

        ]
    };

    await sendTemplate(data, recipientId, templatePayload, "4")

    instaChatbot.flowFlag = false;
    instaChatbot.flowId = "";
    instaChatbot.payment_request = {}
    instaChatbot.request_details = {}
    instaChatbot.subscriptionTimezone = ""
    instaChatbot.scheduleTimezone = ""
    instaChatbot.intl = {}
    instaChatbot.mobile_airtime = {}
    instaChatbot.quotation = {}
    instaChatbot.conversion = {}
    instaChatbot.withdrawal = {}
    instaChatbot.topup = {}
    instaChatbot.intl_beneficiaries = []
    instaChatbot.vcc = {}

    await instaChatbot.save()
}

async function w2wPaymentMethodsTemplate(data, recipientId, selectedLanguage) {
    const templatePayload = {
        template_type: "generic",
        elements: [
            {

                title: lang[selectedLanguage].INSTANT_TITLE,
                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Instant.png",
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].INSTANT,
                        payload: "w2w_p_instant",
                    },
                    {
                        type: "postback",
                        title: `⬅️  ${lang[selectedLanguage].BACK_BUTTON_TITLE}`,
                        payload: "w2w_back",
                    },

                ],
            },
            {

                title: lang[selectedLanguage].SUBSCRIPTION_TITLE,
                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Subscrption.png",
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].SUBSCRIPTION,
                        payload: "w2w_p_subsription",
                    },
                    {
                        type: "postback",
                        title: `🗃️ ${lang[selectedLanguage].MAIN_MENU}`,
                        payload: "main_menu",
                    },

                ],
            },
            {

                title: lang[selectedLanguage].SCHEDULE_TITLE,
                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Schedule%20Payments.png",
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].SCHEDULE,
                        payload: "w2w_p_schedule",
                    },
                    {
                        type: "postback",
                        title: `🗃️ ${lang[selectedLanguage].MAIN_MENU_TITLE}`,
                        payload: "main_menu",
                    },

                ],
            },
        ]
    };

    await sendTemplate(data, recipientId, templatePayload, "4")
}

async function sendRequestPaymentTemplate(data, recipientId, selectedLanguage) {
    const templatePayload = {
        template_type: "generic",
        elements: [
            {
                title: lang[selectedLanguage].INSTANT_REQUEST_TITLE,
                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Instant.png",
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].INSTANT,
                        payload: `req_instant`,
                    },
                    {
                        type: "postback",
                        title: `⬅️  ${lang[selectedLanguage].BACK_BUTTON_TITLE}`,
                        payload: "request_money",
                    },
                ],
            },
            {
                title: lang[selectedLanguage].SUBSCRIPTION_REQUEST_TITLE,
                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Subscrption.png",
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].SUBSCRIPTION,
                        payload: `req_subs`,
                    },
                    {
                        type: "postback",
                        title: `🗃️ ${lang[selectedLanguage].MAIN_MENU_TITLE}`,
                        payload: "main_menu",
                    },
                ],
            },
            {
                title: lang[selectedLanguage].SCHEDULE_REQUEST_TITLE,
                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Schedule%20Payments.png",
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].SCHEDULE,
                        payload: `req_sched`,
                    },
                    {
                        type: "postback",
                        title: `🗃️ ${lang[selectedLanguage].MAIN_MENU_TITLE}`,
                        payload: "main_menu",
                    },
                ],
            },
            // {
            //     title: lang[selectedLanguage].SECURE_PAY_REQUEST_TITLE,
            //     image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Security%20Deposit.png",
            //     buttons: [
            //         {
            //             type: "postback",
            //             title: lang[selectedLanguage].SECUREPAY_DEPOSIT,
            //             payload: "main_menu",//`req_secure_pay`,
            //         },
            //     ],
            // },
            // {
            //     title: lang[selectedLanguage].INSTALLMENT_REQUEST_TITLE,
            //     image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Installment.png",
            //     buttons: [
            //         {
            //             type: "postback",
            //             title: lang[selectedLanguage].INSTALMENT,
            //             payload: `main_menu`//,`req_instlm`,
            //         },
            //     ],
            // },
            // {
            //     title: lang[selectedLanguage].SPLIT_PAYMENT_REQUEST_TITLE,
            //     image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Split.png",
            //     buttons: [
            //         {
            //             type: "postback",
            //             title: lang[selectedLanguage].SPLIT_PAYMENT,
            //             payload: `main_menu`,//`req_split`,
            //         },
            //     ],
            // },
        ]
    };
    await sendTemplate(data, recipientId, templatePayload)
}

// add here
async function updateLanguage(data, recipientId, language, instaChatbot) {
    instaChatbot.active_language = language;
    await instaChatbot.save();

    console.log(instaChatbot?.last_message === "0", instaChatbot?.last_message?.startsWith("register"), instaChatbot?.last_message)
    if (instaChatbot?.last_message === "0" || instaChatbot?.last_message?.startsWith("register")) {
        await registerTemplate(language, data, recipientId);
    } else {
        await mainMenuMessage(data, recipientId, instaChatbot, language)
    }
}

async function convertSchedulesToMessages(schedules) {
    const MAX_CHARACTERS_PER_MESSAGE = 1000;
    let currentMessage = '';
    let messages = [];

    for (let schedule of schedules) {
        let date = schedule.date;
        let time = schedule.time;
        let description = schedule.request_payment.description;
        let amount = schedule.request_payment.amount;
        let currencyCode = schedule.request_payment.currency.code;
        let purpose = schedule.request_payment.purpose;

        let scheduleText =
            `📅 Date: ${date}
⏰ Time: ${time}
💼 Description: ${description}
💲 Amount: ${amount} ${currencyCode}`;

        if (purpose) {
            scheduleText += `\nPurpose: ${purpose}`;
        }

        scheduleText += '\n------------------------\n\n';

        if (currentMessage.length + scheduleText.length > MAX_CHARACTERS_PER_MESSAGE) {
            messages.push(currentMessage);
            currentMessage = scheduleText;
        } else {
            currentMessage += scheduleText;
        }
    }

    if (currentMessage.length > 0) {
        messages.push(currentMessage);
    }

    return messages;
}

async function processIntlProceedTransfer(entry, instaChatbot, account, countryISO, selectedLanguage) {
    const beneficiaries = await Beneficiary.find({ account: account?._id });
    let filteredBeneficiaries;

    if (instaChatbot.intl_payout_method === "1") {
        filteredBeneficiaries = beneficiaries?.filter(beneficiary => beneficiary.account_type.includes('mobile') && beneficiary.country_iso_code?.toLowerCase() === countryISO.toLowerCase());
    } else if (instaChatbot.intl_payout_method === "2") {
        console.log(beneficiaries[1].country_name, beneficiaries[1].first_name, "counrtyajs", countryISO)
        filteredBeneficiaries = beneficiaries?.filter(beneficiary => beneficiary.account_type.includes('bank') && beneficiary.country_iso_code?.toLowerCase() === countryISO.toLowerCase());
    } else {
        filteredBeneficiaries = beneficiaries?.filter(beneficiary => beneficiary.account_type.includes('cash') && beneficiary.country_iso_code?.toLowerCase() === countryISO.toLowerCase());
    }


    console.log(filteredBeneficiaries, "beneficiaries", beneficiaries);

    if (filteredBeneficiaries?.length > 0) {
        const numberOfBeneficiariesPerPage = 8;
        let currentPage = 1;
        const startIndex = (currentPage - 1) * numberOfBeneficiariesPerPage;
        const endIndex = startIndex + numberOfBeneficiariesPerPage;

        const beneficiariesToDisplay = filteredBeneficiaries.slice(startIndex, endIndex);

        const beneficiaryList = beneficiariesToDisplay.map((beneficiary, index) => ({
            content_type: "text",
            title: `${beneficiary?.first_name} ${beneficiary?.last_name}`,
            payload: `select_benef_${beneficiary._id}`
        }));

        const message = lang[selectedLanguage].SELECT_BENEFICIARY;
        // ${beneficiaryList.map(beneficiary => beneficiary.title).join('\n')}

        const quickReplies = [
            ...beneficiaryList,
            { content_type: "text", title: lang[selectedLanguage].ADD_BENEFICIARY, payload: `add_beneficiary` },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` }
        ];

        // Check if there are more beneficiaries available for "Next" quick reply
        if (filteredBeneficiaries.length > endIndex) {
            quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `next_beneficiaries_${currentPage + 1}` });
        }

        // Check if "Prev" quick reply should be shown
        if (currentPage > 1) {
            quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `prev_beneficiaries_${currentPage - 1}` });
        }
        instaChatbot.intl_beneficiaries = filteredBeneficiaries;
        await instaChatbot.save();
        await quickReply(entry.messaging[0], message, quickReplies, "4.3.4");
    } else {
        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].ADD_NEW, payload: `add_beneficiary` },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` }
        ];
        await quickReply(entry.messaging[0], lang[selectedLanguage].NO_BENEFICIARIES, quickReplies, "4");
    }
}

async function handleCountrySelection(entry, countryCode, selectedLanguage) {
    const availableServices = await getServices(countryCode);

    const serviceTitles = {
        MobileWallet: lang[selectedLanguage].MOBILE_WALLET,
        BankAccount: lang[selectedLanguage].BANK_ACCOUNT,
        CashPickup: lang[selectedLanguage].CASH_PICKUP
    };

    let quickReplies = [];
    const allowedServices = ["MobileWallet", "BankAccount", "CashPickup"];

    for (const serviceKey of allowedServices) {
        if (availableServices.hasOwnProperty(serviceKey) && availableServices[serviceKey].status === 'true') {
            quickReplies.push({
                content_type: "text",
                title: serviceTitles[serviceKey],
                payload: `intl_p-${availableServices[serviceKey]?.id}`
            });
        }
    }

    quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })

    await quickReply(entry.messaging[0], lang[selectedLanguage].RECEIVE_FUNDS, quickReplies, "4");
}

function getPayoutChannelName(payerList, serialNumber, maxLines) {
    const regex = new RegExp(`^${serialNumber}\\..*`, 'gm'); // Regular expression to match the line with the serial number
    const linesToSearch = payerList.payers.split('\n').slice(0, maxLines).join('\n'); // Limit lines to search
    const match = linesToSearch.match(regex);
    if (match) {
        return match[0].replace(/^\d+\.\s*/, ''); // Remove the serial number from the matched line
    }
    return null;
}

const checkBusinessBeneficiary = async (email) => {
    const data = { email }
    if (email) {
        const encrypted = encryption(data)
        try {
            const res = await axios.post('https://ip-dev-85ba34ddc4a3.herokuapp.com/api/account/account-check/business', {
                data: encrypted
            })
            return decryption(res.data.data).status
        } catch (error) {
            return decryption(error.response.data.data).status
        }
    }
}

const checkIndividualBeneficiary = async (email, phone) => {
    const data = { email, phone }
    if (email && phone) {
        const encrypted = encryption(data)
        try {
            const res = await axios.post('https://ip-dev-85ba34ddc4a3.herokuapp.com/api/account/account-check/individual', {
                data: encrypted
            })
            return decryption(res.data.data).status
        } catch (error) {
            return decryption(error.response.data.data).status
        }
    }
}

async function checkRegisteredBenficiaries(beneficiaries) {
    if (beneficiaries.length > 0) {
        Promise.all(beneficiaries.map(async (benef) => {
            if (benef.beneficiary_type === "individual") {
                const isNotRegistered = await checkIndividualBeneficiary(benef.email, benef.phone);
                // console.log(benef.email, benef.beneficiary_type, benef.phone, "not registered", isNotRegistered);
                return !isNotRegistered;
            } else {
                const isNotRegistered = await checkBusinessBeneficiary(benef.email);
                // console.log(benef.email, "not registered", isNotRegistered);
                return !isNotRegistered;
            }
        })).then((results) => {
            const filtered = beneficiaries.filter((_, index) => results[index]);
            console.log(filtered, "filtered")
            return filtered;
        }).catch((error) => {
            console.error("An error occurred while checking beneficiaries:", error);
            return []
        });
    };
}

async function handleBeneficiariesRequest(account, entry, lastMessage, payloadPrefix, selectedLanguage, currentPage = 1) {
    const beneficiaries = await Beneficiary.find({ account: account?._id });
    const filteredBeneficiaries = await Promise.all(beneficiaries.map(async (benef) => {
        if (benef.beneficiary_type === 'individual') {
            const benefAccount = await Account.findOne({ phone: benef.phone });
            if (benefAccount) {
                return benef;
            }
        } else {
            const benefAccount = await Account.findOne({ email: benef.email });
            if (benefAccount) {
                return benef;
            }
        }
        return null;
    }));

    const registeredBeneficiaries = filteredBeneficiaries.filter(benef => benef !== null);

    // Pagination logic
    const numberOfBeneficiariesPerPage = 8;
    const startIndex = (currentPage - 1) * numberOfBeneficiariesPerPage;
    const endIndex = startIndex + numberOfBeneficiariesPerPage;
    const displayedBeneficiaries = registeredBeneficiaries.slice(startIndex, endIndex);

    const quickReplies = displayedBeneficiaries.map(benef => ({
        content_type: "text",
        title: `${benef.first_name} ${benef.last_name}`,
        payload: `${payloadPrefix}-${benef._id}`
    }));

    // Add pagination controls
    if (currentPage > 1) {
        quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `${payloadPrefix}_prev_${currentPage - 1}` });
    }

    if (registeredBeneficiaries.length > endIndex) {
        quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `${payloadPrefix}_next_${currentPage + 1}` });
    }

    quickReplies.push({ content_type: "text", title: lang[selectedLanguage].INVITE_SOMEONE, payload: "benef_invite_req" });
    quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" });

    let message;
    if (payloadPrefix === "pay_req") {
        message = lang[selectedLanguage].REQUEST_MONEY_PROMPT
    } else {
        message = lang[selectedLanguage].QUOTE_RECIPIENT_PROMPT
    }
    await quickReply(entry.messaging[0], message, quickReplies, lastMessage);
}

async function referralTxt(data, recipientId, selectedLanguage) {
    const message = lang[selectedLanguage].REFER_EARN_MESSAGE
    const templatePayload = {
        template_type: "generic",
        elements: [
            {
                title: message,
                buttons: [
                    {
                        type: "web_url",
                        title: lang[selectedLanguage].SHARE_REFER_LINK,
                        url: `https://insta-pay.ch/`,
                        webview_height_ratio: "full"
                    },
                    {
                        type: "web_url",
                        title: lang[selectedLanguage].TRACK_EARNING,
                        url: `https://insta-pay.ch/`,
                        webview_height_ratio: "full"
                    },
                    {
                        type: "web_url",
                        title: lang[selectedLanguage].LEARN_MORE,
                        url: `https://insta-pay.ch/`,
                        webview_height_ratio: "full"
                    },
                ],
            }
        ]
    };
    await sendTemplate(data, recipientId, templatePayload)
}

async function sendMultipleImages(attachments, recipientId) {
    try {
        for (const attachment of attachments) {
            const url = attachment.url;

            const fileName = attachment.key.split('/').pop();
            const fileType = fileName.split('.').pop();

            if (fileType === "mp4") {
                await sendVideoImage(url, recipientId, 'video');
            } else {
                await sendVideoImage(url, recipientId, 'image');

            }
        }
        console.log("All images sent successfully.");
    } catch (err) {
        console.error("Error sending images:", err);
    }
}

// async function sendMultipleVideoImage(urls, recipientId) {
//     try {
//         const attachments = urls.map(url => ({
//             type: 'image',
//             payload: {
//                 url,
//                 is_reusable: true
//             }
//         }));

//         console.log(attachments, "attachments")

//         const requestBody = {
//             recipient: { id: recipientId },
//             message: {
//                 attachment: [
//                     {
//                         type: 'image',
//                         payload: {
//                             url: 'https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/payment_request/650c6a738cbb0e261107b00c/1714418267978-57562.jpg',
//                             is_reusable: true
//                         }
//                     }
//                 ],
//             }
//         };

//         // const requestBody = {
//         //     recipient: { id: recipientId },
//         //     message: {
//         //         attachment: {
//         //             type: type,
//         //             payload: {
//         //                 url,
//         //                 is_reusable: true
//         //             }
//         //         }
//         //     }
//         // }

//         const config = {
//             params: { access_token: facebook_access_token }
//         };

//         const response = await axios.post(`https://graph.facebook.com/v19.0/${facebook_page_id}/messages`, requestBody, config);
//         console.log(response.data, "message sent");
//     } catch (err) {
//         console.error("Error sending message:", err);
//     }
// }

async function processRequestPayment(entry, messaging, account, instaChatbot, selectedLanguage) {

    let data = {
        amount: instaChatbot?.request_details?.request_amount,
        wallet_id: instaChatbot?.request_details?.requesting_wallet,
        purpose: instaChatbot?.request_details?.purpose ?? "",
        sender: account._id,
        receiver: instaChatbot?.request_details?.beneficiary,
        payment_type: "payment_request",
        attachments: instaChatbot.request_details.attachements,
        description: instaChatbot.request_details.desc,
    };
    // finding the location
    const geoData = await getGeocodeData(instaChatbot.payment_request?.lat, instaChatbot.payment_request?.long);
    if (instaChatbot.payment_request?.lat && instaChatbot.payment_request?.long) {

        if (!geoData.status) {
            console.log("location not found")
        } else {
            data.lat = geoData.data.lat
            data.long = geoData.data.lon
            data.display_name = geoData.data.display_name
            data.address = geoData.data?.address || undefined
        }
    }

    console.log(data, "datainsiderequestpayment");
    const requestDetails = await requestPayment(data);
    console.log(requestDetails, "requestDetailschceck");
    if (requestDetails?.status) {
        const benefAccount = await Account.findById(instaChatbot?.request_details?.beneficiary).populate(['insta_recipient_id', 'user', 'company']);
        const senderAccount = await Account.findById(account._id).populate(['user', 'company']);
        console.log(senderAccount, "senderAccountsenderAccount")
        const recipientName = benefAccount.account_type === "individual" ? benefAccount.user.first_name + " " + benefAccount.user.last_name :
            benefAccount?.company?.company_name
        const senderName = senderAccount.account_type === "individual" ? senderAccount.user.first_name + " " + senderAccount.user.last_name :
            senderAccount?.company?.company_name
        const message = `Request successfully dispatched!`
        const subtitles = `
Request ID: ${requestDetails?.requestDetails?.reference_id}
Recipient Name: ${recipientName}
${lang[selectedLanguage].AMOUNT}: ${instaChatbot?.request_details?.request_amount.toFixed(2)} ${requestDetails?.requestDetails?.currency?.code}
Country: ${benefAccount?.country_name}
`

        const templatePayload = {
            template_type: "generic",
            elements: [
                {
                    title: message,
                    subtitle: subtitles,
                    image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Request%20Sent.png",
                    buttons: [
                        {
                            type: "postback",
                            title: lang[selectedLanguage].SEND_ANOTHER,
                            payload: `request_money`,
                        },
                        {
                            type: "postback",
                            title: lang[selectedLanguage].MAIN_MENU,
                            payload: "main_menu",
                        },

                    ],
                },
            ]
        };

        await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4");
        console.log(benefAccount, "benefAccount");

        const subtitle2 = `
Request ID: ${requestDetails?.requestDetails?.reference_id}
Sender Name: ${senderName}
${lang[selectedLanguage].AMOUNT}: ${formattedAmount(requestDetails?.requestDetails?.amount?.toFixed(2))} ${requestDetails?.requestDetails?.currency?.code}
Country: ${account.country_name}

`

        const addressMessage = `The above payment request originated from the below address  👇

${geoData?.data?.display_name || 'Unknown'}
`
        // ${lang[selectedLanguage].AMOUNT}: ${formattedAmount(requestDetails?.requestDetails?.amount?.toFixed(2))}  ${requestDetails?.requestDetails?.currency?.code}

        if (benefAccount?.insta_recipient_id) {
            const benefLang = benefAccount?.insta_recipient_id?.active_language || benefAccount?.language || "en"
            const templatePayload = {
                template_type: "generic",
                elements: [
                    {
                        title: `${lang[benefLang].RECEIVED_PAYMENT_REQUEST} ${account.username}!`,
                        subtitle: subtitle2,
                        image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Send%20Money.png",

                        buttons: [
                            {
                                type: "postback",
                                title: lang[benefLang].ACCEPT,
                                payload: `accept_req_pay-${requestDetails?.requestDetails?._id}`,
                            },
                            {
                                type: "postback",
                                title: lang[benefLang].DECLINE,
                                payload: `decline_req_pay-${requestDetails?.requestDetails?._id}`,
                            },
                            {
                                type: "web_url",
                                title: lang[benefLang].VIEW_PROFILE_BUTTON,
                                url: `https://my.insta-pay.ch/profile/${account?.username}`,
                                webview_height_ratio: "full"
                            },

                        ],
                    },
                ]
            };
            const data = {
                sender: { id: benefAccount?.insta_recipient_id?.recipient },
            };
            await sendTemplate(data, benefAccount?.insta_recipient_id?.recipient, templatePayload, "4");

            const addressPayload = {
                template_type: "generic",
                elements: [
                    {
                        title: addressMessage,

                        buttons: [
                            {
                                type: "web_url",
                                title: "View Pin Location📍",
                                url: `https://my.insta-pay.ch/chatbot/payment-request?longitude=${geoData.data.lon}&latitude=${geoData.data.lat}`,
                                webview_height_ratio: "full"
                            }
                        ],
                    },
                ]
            }
            await sendTemplate(data, benefAccount?.insta_recipient_id?.recipient, addressPayload, "4");

            if (instaChatbot?.request_details?.attachements?.length > 0 || instaChatbot?.request_details?.desc) {

                const message = `
Attached are details with the payment request 👇

${instaChatbot?.request_details?.desc ? "Note: " + instaChatbot?.request_details?.desc : ""}
`;

                await quickMessage(data, message, "CONFIRMED_EVENT_UPDATE");

                if (instaChatbot?.request_details?.attachements?.length > 0) {

                    const attachments = instaChatbot?.request_details?.attachements;

                    await sendMultipleImages(attachments, benefAccount?.insta_recipient_id?.recipient);

                }

            }


        }

        instaChatbot.request_details.desc = "";
        instaChatbot.request_details.attachements = []

        await instaChatbot.save()
    } else {
        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].TRY_ANOTHER, payload: "request_money" },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }
        ];
        await quickReply(entry.messaging[0], lang[selectedLanguage].SOMETHING_WENT_WRONG_REQUEST, quickReplies, "4");
        instaChatbot.request_details.desc = "";
        instaChatbot.request_details.attachements = []

        await instaChatbot.save()
    }

}

async function registerTemplate(selectedLanguage, data, senderId) {
    const templatePayload = {
        template_type: "generic",
        elements: [
            {
                title: lang[selectedLanguage].CREATE_INSTAPAY_ACCOUNT_MESSAGE,
                subtitle: `${lang[selectedLanguage].STEP} 1️⃣`,
                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Register.png",
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].REGISTER_BUTTON_TITLE,
                        payload: "register_1",
                    },
                ],
            },
            {
                title: lang[selectedLanguage].CONNECT_INSTAGRAM_MESSAGE,
                subtitle: `${lang[selectedLanguage].STEP} 2️⃣`,
                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Coonect%20to%20instapay.png",
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].CONNECT_BUTTON_TITLE,
                        payload: "connect_1",
                    },
                ],
            },
            {
                title: lang[selectedLanguage].ADJUST_LANGUAGE_SETTINGS,
                image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/change_language.png",
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].CHANGE_LANGUAGE,
                        payload: "language_change",
                    },
                ],
            },
        ]
    };

    const userInstaDetails = await userInstaInfo(senderId)

    await quickMessage(data, `${lang[selectedLanguage].HELLO} ${userInstaDetails?.name} 👋! ${lang[selectedLanguage].WELCOME_MESSAGE}`, "CONFIRMED_EVENT_UPDATE", "0");
    await sendTemplate(data, senderId, templatePayload);
}

// MAIN FUNCTION
const replyToText = async (data) => {
    if (data && Array.isArray(data.entry)) {
        const entry = data.entry[0];
        if (entry && Array.isArray(entry.messaging)) {
            const thirtyMinutesInMillis = 30 * 60 * 1000;
            const messaging = entry.messaging[0];
            console.log(messaging, "messaging")

            let text = messaging?.message?.text
            let quick_reply = messaging?.message?.quick_reply

            console.log(messaging?.sender?.id, "sender_id")
            let instaChatbot = await InstaChatbotModel.findOne({ recipient: messaging?.sender?.id });
            // console.log(instaChatbot, "instaChatbot")


            let account;
            let selectedLanguage = instaChatbot?.active_language || account?.language || "en";


            if (instaChatbot && instaChatbot?.instabot_connected && instaChatbot?.username) {
                account = await Account.findOne({ username: instaChatbot?.username }).populate(['country', 'level'])

                if (!account) {
                    instaChatbot.registeration = {}
                    instaChatbot.account_username = ""
                    instaChatbot.insta_username = ""
                    instaChatbot.instabot_connected = false
                    instaChatbot.username = ""
                    instaChatbot.last_message = "0"

                    await instaChatbot.save()

                    console.log('1st cindition running', instaChatbot?.last_message === "0", text, text !== '', !quick_reply)
                    return await registerTemplate(selectedLanguage, entry.messaging[0], messaging?.sender?.id);
                }
            }


            // console.log(account, "account", instaChatbot)
            // console.log(instaChatbot && instaChatbot?.instabot_connected && instaChatbot?.registeration.source === "bot" && !instaChatbot?.username)
            // console.log(account?.username && account?.insta_bot)
            if (instaChatbot && instaChatbot?.instabot_connected && instaChatbot?.registeration.source === "bot" && !instaChatbot?.username) {
                console.log("i ran2", instaChatbot?.registeration?.phone_number?.replace(/\+/g, ""))
                account = await Account.findOne({ phone: instaChatbot?.registeration?.phone_number?.replace(/\+/g, "") }).populate(['country', 'level'])

                console.log("i ran", account)
                if (account?.username && account?.insta_bot) {
                    console.log("i ra3")
                    const updateBot = await InstaChatbotModel.findOneAndUpdate({ recipient: messaging?.sender?.id }, { account_username: account?.username, username: account?.username }, { new: true })
                    console.log("i ra4")
                    await mainMenuMessage(entry.messaging[0], messaging?.sender?.id, instaChatbot, selectedLanguage)
                    return
                }
            }
            // LANGUAGE-CHANGE //
            else if (quick_reply?.payload === "language_change" || messaging?.postback?.payload === "language_change") {
                let lastMessage = ""
                if (instaChatbot?.last_message === "0" || instaChatbot?.last_message?.startsWith("register") || instaChatbot?.last_message?.startsWith("3") || !instaChatbot?.last_message) {
                    lastMessage = "0"
                } else {
                    lastMessage = "4"
                }
                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].ENGLISH, payload: "language_change-en" },
                    { content_type: "text", title: lang[selectedLanguage].SPANISH, payload: "language_change-es" },
                    { content_type: "text", title: lang[selectedLanguage].FRENCH, payload: "language_change-fr" },
                    { content_type: "text", title: lang[selectedLanguage].GERMAN, payload: "language_change-de" },
                    { content_type: "text", title: lang[selectedLanguage].HINDI, payload: "language_change-hi" },
                    { content_type: "text", title: lang[selectedLanguage].CHINESE, payload: "language_change-zh" },
                    { content_type: "text", title: lang[selectedLanguage].VIEW_MORE, payload: "more_languages_1" },
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: lastMessage === "4" ? "main_menu" : "template_signup" }
                ];


                await quickReply(entry.messaging[0], lang[selectedLanguage].SELECT_LANGUAGE, quickReplies, lastMessage);
                return text = ""
            }
            else if (quick_reply?.payload === "more_languages_1") {
                let lastMessage = ""
                if (instaChatbot?.last_message === "0" || instaChatbot?.last_message?.startsWith("register") || instaChatbot?.last_message?.startsWith("3") || !instaChatbot?.last_message) {
                    lastMessage = "0"
                } else {
                    lastMessage = "4"
                }
                const quickReplies = [
                    { content_type: "text", title: "🔙", payload: "language_change" },
                    { content_type: "text", title: lang[selectedLanguage].INDONESIAN, payload: "language_change-id" },
                    { content_type: "text", title: lang[selectedLanguage].ITALIAN, payload: "language_change-it" },
                    { content_type: "text", title: lang[selectedLanguage].SWAHILI, payload: "language_change-sw" },
                    { content_type: "text", title: lang[selectedLanguage].DUTCH, payload: "language_change-nl" },
                    { content_type: "text", title: lang[selectedLanguage].YORUBA, payload: "language_change-yo" },
                    { content_type: "text", title: lang[selectedLanguage].URDU, payload: "language_change-ur" },
                    { content_type: "text", title: lang[selectedLanguage].VIEW_MORE, payload: "more_languages_2" },
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: lastMessage === "4" ? "main_menu" : "template_signup" }
                ];

                return await quickReply(entry.messaging[0], lang[selectedLanguage].SELECT_LANGUAGE, quickReplies);
            }
            else if (quick_reply?.payload === "more_languages_2") {
                let lastMessage = ""
                if (instaChatbot?.last_message === "0" || instaChatbot?.last_message?.startsWith("register") || instaChatbot?.last_message?.startsWith("3") || !instaChatbot?.last_message) {
                    lastMessage = "0"
                } else {
                    lastMessage = "4"
                }
                const quickReplies = [
                    { content_type: "text", title: "🔙", payload: "more_languages_1" },
                    { content_type: "text", title: lang[selectedLanguage].POLISH, payload: "language_change-pl" },
                    { content_type: "text", title: lang[selectedLanguage].HAUSA, payload: "language_change-ha" },
                    { content_type: "text", title: lang[selectedLanguage].PORTOGUESE, payload: "language_change-pt" },
                    { content_type: "text", title: lang[selectedLanguage].RUSSIAN, payload: "language_change-ru" },
                    { content_type: "text", title: lang[selectedLanguage].TURKISH, payload: "language_change-tr" },
                    { content_type: "text", title: lang[selectedLanguage].UKRAINIAN, payload: "language_change-uk" },
                    { content_type: "text", title: lang[selectedLanguage].ARABIC, payload: "language_change-ar" },
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: lastMessage === "4" ? "main_menu" : "template_signup" }
                ];
                await quickReply(entry.messaging[0], lang[selectedLanguage].SELECT_LANGUAGE, quickReplies);

                return

            }
            // if there is a request for language change
            else if (quick_reply?.payload.includes("language_change-")) {
                console.log("yes i ran till here")
                let languageCode = quick_reply?.payload.split('-')[1]
                selectedLanguage = languageCode
                await updateLanguage(entry.messaging[0], messaging?.sender?.id, languageCode, instaChatbot)
                text = ""

                return
            }
            // console.log(account, "instachatbot")
            // console.log(messaging?.postback?.payload, instaChatbot?.last_message, "message")

            // if webhook is requested for new user (here webhook request is thrown twice because of which bot responds twice)
            if (messaging?.pass_thread_control) {
                return
            }

            if (quick_reply?.payload === "template_signup") {
                return await registerTemplate(selectedLanguage, entry.messaging[0], messaging?.sender?.id);
            }

            if (!messaging?.message?.is_echo && !messaging?.read) {

                // ----- USER'S ACCOUNT REGISTERATION -----
                if (messaging?.postback?.payload?.startsWith("register") || quick_reply?.payload?.startsWith("register") || (instaChatbot?.last_message?.includes("register") && text && !quick_reply?.payload)) {
                    await handleRegistration(
                        messaging.sender.id,
                        messaging?.postback?.payload || quick_reply?.payload,
                        account,
                        instaChatbot,
                        text,
                        selectedLanguage
                    );
                    return
                }

                if (instaChatbot) {
                    const currentTime = new Date();

                    if (instaChatbot?.chatbotBannedUntil && instaChatbot?.chatbotBannedUntil > currentTime) {
                        // User is currently banned
                        return;
                    }
                    // Check if account is active
                    if (account) {
                        if (!account?.active || account?.status !== "active") {
                            await quickMessage(entry.messaging[0], 'This InstaPay account is not active right now!', "CONFIRMED_EVENT_UPDATE");
                            return;
                        }
                    }

                    // LOGOUT //
                    if ((messaging?.postback?.payload === "logout" || quick_reply?.payload === "logout") && !instaChatbot?.loggedOut) {
                        let lastMessage = ""
                        if (instaChatbot?.last_message === "0" || instaChatbot?.last_message?.startsWith("register") || instaChatbot?.last_message?.startsWith("3") || !instaChatbot?.last_message) {
                            lastMessage = "0"
                        } else {
                            lastMessage = "4"
                        }

                        instaChatbot.loggedOut = true;
                        await instaChatbot.save()
                        return await quickMessage(entry.messaging[0], 'You have been logged out successfully.', "CONFIRMED_EVENT_UPDATE", lastMessage);
                    }
                    // Check if the time difference is greater than 30 minutes, then reset the last_message
                    const lastMessageCheck = isTimeDifferenceGreaterThan30Minutes(instaChatbot.last_message_time)
                    console.log(lastMessageCheck, "lastMessageCheck")


                    if (
                        instaChatbot &&
                        !instaChatbot.instabot_connected &&
                        lastMessageCheck
                    ) {
                        await quickMessage(entry.messaging[0], 'Your session has been expired!', "CONFIRMED_EVENT_UPDATE", "0");

                    } else if (instaChatbot &&
                        instaChatbot.instabot_connected &&
                        ((instaChatbot?.loggedOut ?? false) || lastMessageCheck)
                    ) {

                        if (account?.pin && account?.pin_status) {
                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: "Session Expired!",
                                        subtitle: "For security reasons, your chatbot session has been terminated. Please tap below to enter your PIN and reactivate your session securely.",
                                        buttons: [
                                            {
                                                type: "web_url",
                                                title: "Enter PIN",
                                                url: `https://my.insta-pay.ch/verify-bot-pin/${account._id}/instagram`,
                                            }
                                        ],
                                    },
                                ],
                            };

                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4");
                            return
                        } else {
                            // const quickReplies = [
                            //     { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                            // ]
                            // return await quickReply(entry.messaging[0], "To continue using InstaPay services, please set a secure 4-digit PIN for your account. This will help keep your transactions safe and secure.", quickReplies);

                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: "Pin Setup Required!",
                                        subtitle: "To continue using InstaPay services, please set a secure 4-digit PIN for your account. This will help keep your transactions safe and secure.",
                                        buttons: [
                                            {
                                                type: "web_url",
                                                title: "Setup PIN",
                                                url: `https://my.insta-pay.ch/set-account-pin/${account._id}/instagram`,
                                            }
                                        ],
                                    },
                                ],
                            };

                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4");
                            return
                        }
                    }

                    // saving the last message time from user to our chatbot
                    instaChatbot.last_message_time = currentTime
                    await instaChatbot.save()

                    // handling the resending the OTP
                    if (quick_reply?.payload && quick_reply?.payload.startsWith("resend_otp_") && account?.pin && account?.pin_status) {

                        const context = quick_reply.payload.replace("resend_otp_", "");

                        await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, context, "", context === "confirm_verification" ? "Signup OTP Code" : "Transaction OTP", true);
                        return
                    }
                    //--- INSTA CHATBOT CONNECTION ---//
                    // if it is the random text and user is not connected
                    if (instaChatbot?.last_message === "0" && text && text !== '' && !quick_reply) {
                        console.log('1st cindition running', instaChatbot?.last_message === "0", text, text !== '', !quick_reply)
                        await registerTemplate(selectedLanguage, entry.messaging[0], messaging?.sender?.id);
                        return text = ""
                    }
                    else if (messaging?.postback?.payload === "connect_social_accounts") {
                        const message = lang[selectedLanguage].MORE_SOCIAL_ACCOUNTS

                        const quickReplies = [
                            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                        ];

                        await quickReply(entry.messaging[0], message, quickReplies, "4");
                    }

                    // user has clicked on submit_code
                    else if (messaging?.postback?.payload === 'connect_1' && (instaChatbot?.last_message === "0" || instaChatbot?.last_message?.startsWith("register") || !instaChatbot?.last_message)) {
                        await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_USERNAME_MESSAGE, "CONFIRMED_EVENT_UPDATE", "3");
                    }
                    // user has entered instapay username
                    else if (instaChatbot?.last_message === "3" && text && !quick_reply?.payload) {
                        console.log("4th running")
                        const accountDetails = await Account.findOne({ username: text.toLowerCase() });

                        if (!accountDetails) {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_USERNAME_MESSAGE, "CONFIRMED_EVENT_UPDATE", "3");
                        } else if (accountDetails?.insta_bot) {
                            await quickMessage(entry.messaging[0], "This InstaPay account has already been linked", "CONFIRMED_EVENT_UPDATE", "3");
                        } else {
                            instaChatbot.account_username = text.toLowerCase();
                            instaChatbot.username = text.toLowerCase();
                            await instaChatbot.save()
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].LINK_INSTAGRAM, "CONFIRMED_EVENT_UPDATE", "3.1");
                            // await instaCodeVerification(text, messaging?.sender?.id, "sarfaraz_ahmed95", entry.messaging[0])
                        }
                    }
                    // user has entered code
                    else if (instaChatbot?.last_message === "3.1" && text && !quick_reply?.payload) {
                        await instaCodeVerification(text, messaging?.sender?.id, entry.messaging[0], instaChatbot.account_username, selectedLanguage)
                        return

                    }
                    // last message is set to the 3 when user has succesfully entered instapay code
                    else if (instaChatbot?.last_message === "3.2" && text && !quick_reply?.payload) {
                        // const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "confirm_verification");

                        // if (otpValidationResult.status) {

                        console.log("4th ran", messaging)
                        const userInstaDetails = await userInstaInfo(messaging?.sender?.id)
                        await instaAccountVerification(text, messaging?.sender?.id, userInstaDetails.username, entry.messaging[0], selectedLanguage)
                        // } else {
                        //     if (otpValidationResult.message === "max_attempts_exceeded") {

                        //         await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                        //     } else {

                        //         await invalidMessage(entry.messaging[0], "confirm_verification", selectedLanguage, instaChatbot?.otpType);
                        //     }
                        // }

                    }
                    // if user is connected
                    else if (instaChatbot?.instabot_connected) {

                        if (!account?.pin || !account?.pin_status) {

                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: "Pin Setup Required!",
                                        subtitle: "To continue using InstaPay services, please set a secure 4-digit PIN for your account. This will help keep your transactions safe and secure.",
                                        buttons: [
                                            {
                                                type: "web_url",
                                                title: "Setup PIN",
                                                url: `https://my.insta-pay.ch/set-account-pin/${account._id}/instagram`,
                                            }
                                        ],
                                    },
                                ],
                            };

                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4");

                            return
                        }

                        // if user has requested main manu at the time of live chat
                        if ((quick_reply?.payload === "main_menu" || messaging?.postback?.payload === "main_menu") && instaChatbot?.live_chat) {
                            instaChatbot.live_chat = false;
                            instaChatbot.live_chat_until = null
                            await instaChatbot.save();

                            await quickMessage(entry.messaging[0], lang[selectedLanguage].LIVE_CHAT_CLOSED, "CONFIRMED_EVENT_UPDATE");

                            await mainMenuMessage(entry.messaging[0], messaging?.sender?.id, instaChatbot, selectedLanguage)
                        }
                        // if user has requested main manu
                        else if ((quick_reply?.payload === "main_menu" || messaging?.postback?.payload === "main_menu")) {
                            await mainMenuMessage(entry.messaging[0], messaging?.sender?.id, instaChatbot, selectedLanguage)
                        }

                        // if user wants to close the live chat
                        else if ((quick_reply?.payload === "close_live_chat" || messaging?.postback?.payload === "close_live_chat") && instaChatbot?.live_chat) {
                            instaChatbot.live_chat = false;
                            instaChatbot.live_chat_until = null
                            await instaChatbot.save();

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].OPEN_LIVE_CHAT, payload: "chat_with_us" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                            ]

                            await quickReply(entry.messaging[0], lang[selectedLanguage].LIVE_CHAT_CLOSED, quickReplies);

                        }

                        // if user wants to close the live chat
                        else if ((quick_reply?.payload === "close_live_chat" || messaging?.postback?.payload === "close_live_chat") && !instaChatbot?.live_chat) {


                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].OPEN_LIVE_CHAT, payload: "chat_with_us" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                            ]

                            await quickReply(entry.messaging[0], lang[selectedLanguage].LIVE_CHAT_CLOSED, quickReplies);

                        }

                        // if live chat is enabled
                        else if (instaChatbot?.live_chat) {
                            return
                        }

                        // if user has asked for live chat
                        else if ((quick_reply?.payload === "chat_with_us" || messaging?.postback?.payload === "chat_with_us") && !instaChatbot?.live_chat) {
                            instaChatbot.live_chat = true;
                            instaChatbot.live_chat_until = new Date()
                            await instaChatbot.save();

                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: lang[selectedLanguage].LIVE_CHAT_ENDED,
                                        buttons: [
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].CLOSE_LIVE_CHAT,
                                                payload: "close_live_chat",
                                            },
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MAIN_MENU,
                                                payload: "main_menu",
                                            },
                                        ],
                                    },

                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload)
                        }

                        // if user has asked for live chat while live chat session is opened
                        else if ((quick_reply?.payload === "chat_with_us" || messaging?.postback?.payload === "chat_with_us") && instaChatbot?.live_chat) {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].LIVE_SESSION_ACTIVE, "CONFIRMED_EVENT_UPDATE");
                        }

                        // if user has entered a text and the last message is set for main menu
                        else if (instaChatbot?.last_message === "4" && text && text !== '' && !quick_reply && !messaging?.postback?.payload) {
                            await mainMenuMessage(entry.messaging[0], messaging?.sender?.id, instaChatbot, selectedLanguage)
                        }


                        else if (instaChatbot?.flowFlag &&
                            (
                                instaChatbot?.flowId === "my_trans"
                                || instaChatbot?.flowId === "accept_reqs"
                                || instaChatbot?.flowId === "add_req" ||
                                instaChatbot?.flowId === "accept_q_flag" ||
                                instaChatbot?.flowId === "bargain_q_flag" ||
                                instaChatbot?.flowId === "revise_q_flag"


                            )
                            && (
                                messaging?.postback?.payload === "explore_more" ||
                                messaging?.postback?.payload === "initiate_payment" ||
                                messaging?.postback?.payload === "send_money" ||
                                messaging?.postback?.payload === "e_sim" ||
                                messaging?.postback?.payload === "send_crypto" ||
                                messaging?.postback?.payload === "airtm_confirm_suggested_country" ||
                                messaging?.postback?.payload === "mobile_airtime" ||
                                messaging?.postback?.payload === "wallet_to_wallet" ||
                                messaging?.postback?.payload === "wallet_to_wallet_yes" ||
                                messaging?.postback?.payload === "w2w_back" ||
                                messaging?.postback?.payload === "w2w_p_methods" ||
                                messaging?.postback?.payload === "w2w_p_instant" ||
                                messaging?.postback?.payload === "w2w_p_subsription" ||
                                messaging?.postback?.payload === "w2w_proceed_schedule" ||
                                messaging?.postback?.payload === "w2w_p_schedule" ||
                                messaging?.postback?.payload === "itl_confirm_suggested_country" ||
                                messaging?.postback?.payload === "intl_transfer" ||
                                messaging?.postback?.payload === "req_money_document" ||
                                messaging?.postback?.payload === "req_money_note" ||
                                messaging?.postback?.payload === "req_instant" ||
                                messaging?.postback?.payload === "cont_benef_req" ||
                                messaging?.postback?.payload === "request_money" ||
                                messaging?.postback?.payload === "schedule_req_document" ||
                                messaging?.postback?.payload === "pr_proceed_schedule" ||
                                messaging?.postback?.payload === "req_sched" ||
                                messaging?.postback?.payload === "req_subs" ||
                                messaging?.postback?.payload === "confirm_req_instant" ||
                                messaging?.postback?.payload === "schedule_req_document" ||
                                messaging?.postback?.payload === "rescan_qr_pay" ||
                                messaging?.postback?.payload === "qr_pay_alpha" ||
                                messaging?.postback?.payload === "cont_benef_quot" ||
                                messaging?.postback?.payload === "send_quotation"
                            )) {
                            await mainMenuMessage(entry.messaging[0], messaging?.sender?.id, instaChatbot, selectedLanguage)
                        }
                        else if (instaChatbot?.flowFlag && instaChatbot?.flowId === "intl_flow" && (
                            messaging?.postback?.payload === "explore_more" ||
                            messaging?.postback?.payload === "initiate_payment" ||
                            messaging?.postback?.payload === "send_money" ||
                            messaging?.postback?.payload === "e_sim" ||
                            messaging?.postback?.payload === "send_crypto" ||
                            messaging?.postback?.payload === "airtm_confirm_suggested_country" ||
                            messaging?.postback?.payload === "mobile_airtime" ||
                            messaging?.postback?.payload === "wallet_to_wallet" ||
                            messaging?.postback?.payload === "wallet_to_wallet_yes" ||
                            messaging?.postback?.payload === "w2w_back" ||
                            messaging?.postback?.payload === "w2w_p_methods" ||
                            messaging?.postback?.payload === "w2w_p_instant" ||
                            messaging?.postback?.payload === "w2w_p_subsription" ||
                            messaging?.postback?.payload === "w2w_proceed_schedule" ||
                            messaging?.postback?.payload === "w2w_p_schedule" ||
                            // messaging?.postback?.payload === "itl_confirm_suggested_country" ||
                            // messaging?.postback?.payload === "intl_transfer" ||
                            messaging?.postback?.payload === "req_money_document" ||
                            messaging?.postback?.payload === "req_money_note" ||
                            messaging?.postback?.payload === "req_instant" ||
                            messaging?.postback?.payload === "cont_benef_req" ||
                            messaging?.postback?.payload === "request_money" ||
                            messaging?.postback?.payload === "schedule_req_document" ||
                            messaging?.postback?.payload === "pr_proceed_schedule" ||
                            messaging?.postback?.payload === "req_sched" ||
                            messaging?.postback?.payload === "req_subs" ||
                            messaging?.postback?.payload === "confirm_req_instant" ||
                            messaging?.postback?.payload === "schedule_req_document" ||
                            messaging?.postback?.payload === "rescan_qr_pay" ||
                            messaging?.postback?.payload === "qr_pay_alpha" ||
                            messaging?.postback?.payload === "cont_benef_quot" ||
                            messaging?.postback?.payload === "send_quotation"
                        )) {
                            await mainMenuMessage(entry.messaging[0], messaging?.sender?.id, instaChatbot, selectedLanguage)
                        }
                        else if (instaChatbot?.flowFlag && instaChatbot?.flowId === "req_mon" && (
                            messaging?.postback?.payload === "explore_more" ||
                            messaging?.postback?.payload === "initiate_payment" ||
                            messaging?.postback?.payload === "send_money" ||
                            messaging?.postback?.payload === "e_sim" ||
                            messaging?.postback?.payload === "send_crypto" ||
                            messaging?.postback?.payload === "airtm_confirm_suggested_country" ||
                            messaging?.postback?.payload === "mobile_airtime" ||
                            messaging?.postback?.payload === "wallet_to_wallet" ||
                            messaging?.postback?.payload === "wallet_to_wallet_yes" ||
                            messaging?.postback?.payload === "w2w_back" ||
                            messaging?.postback?.payload === "w2w_p_methods" ||
                            messaging?.postback?.payload === "w2w_p_instant" ||
                            messaging?.postback?.payload === "w2w_p_subsription" ||
                            messaging?.postback?.payload === "w2w_proceed_schedule" ||
                            messaging?.postback?.payload === "w2w_p_schedule" ||
                            messaging?.postback?.payload === "itl_confirm_suggested_country" ||
                            messaging?.postback?.payload === "intl_transfer" ||
                            // messaging?.postback?.payload === "req_money_document" ||
                            // messaging?.postback?.payload === "req_money_note" ||
                            // messaging?.postback?.payload === "req_instant" ||
                            // messaging?.postback?.payload === "cont_benef_req" ||
                            // // messaging?.postback?.payload === "request_money" ||
                            // messaging?.postback?.payload === "schedule_req_document" ||
                            // messaging?.postback?.payload === "pr_proceed_schedule" ||
                            // messaging?.postback?.payload === "req_sched" ||
                            // messaging?.postback?.payload === "req_subs" ||
                            // messaging?.postback?.payload === "confirm_req_instant" ||
                            // messaging?.postback?.payload === "schedule_req_document" ||
                            messaging?.postback?.payload === "rescan_qr_pay" ||
                            messaging?.postback?.payload === "qr_pay_alpha" ||
                            messaging?.postback?.payload === "cont_benef_quot" ||
                            messaging?.postback?.payload === "send_quotation"
                        )) {
                            await mainMenuMessage(entry.messaging[0], messaging?.sender?.id, instaChatbot, selectedLanguage)
                        }
                        else if (instaChatbot?.flowFlag && instaChatbot?.flowId === "quot_flag" && (
                            messaging?.postback?.payload === "explore_more" ||
                            messaging?.postback?.payload === "initiate_payment" ||
                            messaging?.postback?.payload === "send_money" ||
                            messaging?.postback?.payload === "e_sim" ||
                            messaging?.postback?.payload === "send_crypto" ||
                            messaging?.postback?.payload === "airtm_confirm_suggested_country" ||
                            messaging?.postback?.payload === "mobile_airtime" ||
                            messaging?.postback?.payload === "wallet_to_wallet" ||
                            messaging?.postback?.payload === "wallet_to_wallet_yes" ||
                            messaging?.postback?.payload === "w2w_back" ||
                            messaging?.postback?.payload === "w2w_p_methods" ||
                            messaging?.postback?.payload === "w2w_p_instant" ||
                            messaging?.postback?.payload === "w2w_p_subsription" ||
                            messaging?.postback?.payload === "w2w_proceed_schedule" ||
                            messaging?.postback?.payload === "w2w_p_schedule" ||
                            messaging?.postback?.payload === "itl_confirm_suggested_country" ||
                            messaging?.postback?.payload === "intl_transfer" ||
                            messaging?.postback?.payload === "req_money_document" ||
                            messaging?.postback?.payload === "req_money_note" ||
                            messaging?.postback?.payload === "req_instant" ||
                            messaging?.postback?.payload === "cont_benef_req" ||
                            messaging?.postback?.payload === "request_money" ||
                            messaging?.postback?.payload === "schedule_req_document" ||
                            messaging?.postback?.payload === "pr_proceed_schedule" ||
                            messaging?.postback?.payload === "req_sched" ||
                            messaging?.postback?.payload === "req_subs" ||
                            messaging?.postback?.payload === "confirm_req_instant" ||
                            messaging?.postback?.payload === "schedule_req_document" ||
                            messaging?.postback?.payload === "rescan_qr_pay" ||
                            messaging?.postback?.payload === "qr_pay_alpha"
                            // messaging?.postback?.payload === "cont_benef_quot" ||
                            // messaging?.postback?.payload === "send_quotation"
                        )) {
                            await mainMenuMessage(entry.messaging[0], messaging?.sender?.id, instaChatbot, selectedLanguage)
                        }
                        else if (instaChatbot?.flowFlag && instaChatbot?.flowId === "w2w_flow" && (
                            messaging?.postback?.payload === "explore_more" ||
                            messaging?.postback?.payload === "initiate_payment" ||
                            messaging?.postback?.payload === "send_money" ||
                            messaging?.postback?.payload === "e_sim" ||
                            messaging?.postback?.payload === "send_crypto" ||
                            messaging?.postback?.payload === "airtm_confirm_suggested_country" ||
                            messaging?.postback?.payload === "mobile_airtime" ||
                            // messaging?.postback?.payload === "wallet_to_wallet" ||
                            // messaging?.postback?.payload === "wallet_to_wallet_yes" ||
                            // messaging?.postback?.payload === "w2w_back" ||
                            // messaging?.postback?.payload === "w2w_p_methods" ||
                            // messaging?.postback?.payload === "w2w_p_instant" ||
                            // messaging?.postback?.payload === "w2w_p_subsription" ||
                            // messaging?.postback?.payload === "w2w_proceed_schedule" ||
                            // messaging?.postback?.payload === "w2w_p_schedule" ||
                            messaging?.postback?.payload === "itl_confirm_suggested_country" ||
                            messaging?.postback?.payload === "intl_transfer" ||
                            messaging?.postback?.payload === "req_money_document" ||
                            messaging?.postback?.payload === "req_money_note" ||
                            messaging?.postback?.payload === "req_instant" ||
                            messaging?.postback?.payload === "cont_benef_req" ||
                            messaging?.postback?.payload === "request_money" ||
                            messaging?.postback?.payload === "schedule_req_document" ||
                            messaging?.postback?.payload === "pr_proceed_schedule" ||
                            messaging?.postback?.payload === "req_sched" ||
                            messaging?.postback?.payload === "req_subs" ||
                            messaging?.postback?.payload === "confirm_req_instant" ||
                            messaging?.postback?.payload === "schedule_req_document" ||
                            messaging?.postback?.payload === "rescan_qr_pay" ||
                            messaging?.postback?.payload === "qr_pay_alpha" ||
                            messaging?.postback?.payload === "cont_benef_quot" ||
                            messaging?.postback?.payload === "send_quotation"
                        )) {
                            await mainMenuMessage(entry.messaging[0], messaging?.sender?.id, instaChatbot, selectedLanguage)
                        }

                        // --EXPLORE MORE-- //
                        else if (quick_reply?.payload === "explore_more" || messaging?.postback?.payload === "explore_more") {
                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: lang[selectedLanguage].TOP_UP_PHONES_TITLE,
                                        image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Explore%20More.png",
                                        buttons: [
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MOBILE_AIRTIME_BUTTON_TITLE,
                                                payload: "mobile_airtime",
                                            },
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].E_SIM,
                                                payload: "e_sim",
                                            },
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MAIN_MENU,
                                                payload: "main_menu",
                                            },
                                        ],
                                    },

                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload)
                        }

                        else if (quick_reply?.payload.includes("cancel_")) {
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]

                            await quickReply(entry.messaging[0], lang[selectedLanguage].TRANSACTION_CANCELLED, quickReplies, "4");
                        }

                        // Handle OTP generation with email/sms
                        else if (quick_reply?.payload === "send_code_via_sms") {
                            const lastMessage = instaChatbot?.last_message;
                            console.log(lastMessage, "lastMessage")

                            if (lastMessage === "5.4") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "proceed_req_instant", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "4.3.5") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_intl", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "7.7") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_airtime_fixed", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "7.5") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_airtime_bundle", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "7.6") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_airtime", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "4.2.3") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_w2w_schedule", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "4.2.5") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "w2w_subs", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "4.3") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_w2w", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "5.9.2") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "pr_confirm_subs", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "5.9.3") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "process_req_sub", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "5.5") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "accept_req", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "6.6.2") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "proceed_subs_req", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "6.6") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "proceed_quot", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "6.7") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_quot", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "6.9") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_bargain", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "6.11") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_revision", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "11") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_withdrawal", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "11.11") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_default_withdrawal", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "11.2") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_anoth_withdrawal", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "8.2") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_conversion", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "10") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_qr_pay", lastMessage, "Transaction OTP", true);

                            } else if (lastMessage === "updated_w2w_card_payment-otp") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "updated_w2w_card_payment-otp", lastMessage, "Transaction OTP", true);

                            } else if (lastMessage === "updated_w2w_card_payment-sched-otp") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "updated_w2w_card_payment-sched-otp", lastMessage, "Transaction OTP", true);

                            } else if (lastMessage === "updated_w2w_card_payment_subs-otp") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "updated_w2w_card_payment_subs-otp", lastMessage, "Transaction OTP", true);

                            } else if (lastMessage === "intl_card_payment-otp") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "intl_card_payment-otp", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "intl_paypal_payment-otp") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "intl_paypal_payment-otp", lastMessage, "Transaction OTP", true);
                            } else if (lastMessage?.startsWith("airtime_wallets_flow_confirm_purchase-otp")) {
                                const airtimeType = lastMessage?.split("-").pop()
                                console.log(airtimeType, "airtimeType")
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, `airtime_wallets_flow_confirm_purchase-otp-${airtimeType}`, lastMessage, "Transaction OTP", true);
                            } else if (lastMessage?.startsWith("airtime_paypal_flow_confirm_purchase-otp")) {
                                const airtimeType = lastMessage?.split("-").pop()
                                console.log(airtimeType, "airtimeType")
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, `airtime_paypal_flow_confirm_purchase-otp-${airtimeType}`, lastMessage, "Transaction OTP", true);
                            } else if (lastMessage?.startsWith("airtime_card_flow_confirm_purchase-otp")) {
                                const airtimeType = lastMessage?.split("-").pop()
                                console.log(airtimeType, "airtimeType")
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, `airtime_card_flow_confirm_purchase-otp-${airtimeType}`, lastMessage, "Transaction OTP", true);
                            } else if (lastMessage === "w2w_paypal_payment-otp") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "w2w_paypal_payment-otp", lastMessage, "Transaction OTP", true);

                            } else if (lastMessage === "w2w_paypal_payment-sched-otp") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "w2w_paypal_payment-sched-otp", lastMessage, "Transaction OTP", true);

                            } else if (lastMessage === "w2w_paypal_payment_subs-otp") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "w2w_paypal_payment_subs-otp", lastMessage, "Transaction OTP", true);
                            }
                            else if (lastMessage === "activate_vcc_v_s_a_ip_w-otp") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "activate_vcc_v_s_a_ip_w-otp", lastMessage, "Transaction OTP", true);
                            }
                            else if (lastMessage === "activate_vcc_v_p_a_ip_w-otp") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "activate_vcc_v_p_a_ip_w-otp", lastMessage, "Transaction OTP", true);
                            }
                            else if (lastMessage === "activate_vcc_v_s_a_ppl-otp") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "activate_vcc_v_s_a_ppl-otp", lastMessage, "Transaction OTP", true);
                            }
                            else if (lastMessage === "activate_vcc_v_p_a_ppl-otp") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "activate_vcc_v_p_a_ppl-otp", lastMessage, "Transaction OTP", true);
                            }
                            else if (lastMessage === "vcc_add_funds_ip-otp") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "vcc_add_funds_ip-otp", lastMessage, "Transaction OTP", true);
                            }
                            else if (lastMessage === "vcc_transfer-otp") {
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "vcc_transfer-otp", lastMessage, "Transaction OTP", true);
                            }
                        }

                        // --- ADD-FUNDS --- //
                        else if (messaging?.postback?.payload?.startsWith("add_funds") || quick_reply?.payload?.startsWith("add_funds") || (instaChatbot?.last_message?.startsWith("add_funds") && text && !quick_reply?.payload)) {
                            await handleAddFunds(
                                messaging.sender.id,
                                messaging?.postback?.payload || quick_reply?.payload,
                                account,
                                instaChatbot,
                                text,
                                selectedLanguage
                            )

                            return
                        }


                        //--- MY-TRANSACTIONS --- //
                        else if (quick_reply?.payload === "my_transactions" || messaging?.postback?.payload === "my_transactions") {
                            const limit = 5;
                            const transactions = await Transaction.find({ account: account._id, $or: [{ hidden: { $exists: false } }, { hidden: false }] }).sort({ createdAt: -1 }).limit(limit).populate([
                                {
                                    path: 'account',
                                    select: 'user company',
                                    populate: [
                                        { path: 'user', select: 'first_name last_name' },
                                        { path: 'company', select: 'company_name' }
                                    ]
                                },
                                {
                                    path: 'sender',
                                    select: 'user company first_name last_name',
                                    populate: [
                                        { path: 'user', select: 'first_name last_name' },
                                        { path: 'company', select: 'company_name' }
                                    ]
                                },
                                {
                                    path: 'receiver',
                                    select: 'user company first_name last_name',
                                    populate: [
                                        { path: 'user', select: 'first_name last_name' },
                                        { path: 'company', select: 'company_name' }
                                    ]
                                }
                            ]);

                            const totalTransactions = await Transaction.countDocuments({ account: account._id });

                            const transactionsInfoPromises = transactions.map(transaction => createTransactionInfo(transaction, selectedLanguage));
                            const transactionsInfo = await Promise.all(transactionsInfoPromises);
                            console.log(transactionsInfo, "transactions");
                            const message = `
${lang[selectedLanguage].TRANSACTIONS_MESSAGE}
                        
${transactionsInfo.join('\n')}
                            `;

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                            ];

                            if (totalTransactions > limit) {
                                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `next_transactions-${limit}-${limit}` });
                            }

                            await quickReply(entry.messaging[0], message, quickReplies);

                            // const templatePayload = {
                            //     template_type: "generic",
                            //     elements: [
                            //         {
                            //             title: "📊 Open Dashboard",
                            //             buttons: [
                            //                 {
                            //                     type: "web_url",
                            //                     title: 'Click here',
                            //                     url: `https://my.insta-pay.ch/login`,
                            //                     webview_height_ratio: "full"
                            //                 },

                            //             ],
                            //         },

                            //     ]
                            // };

                            // await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload)

                            instaChatbot.flowFlag = true;
                            instaChatbot.flowId = "my_trans";
                            await instaChatbot.save();

                        } else if (quick_reply?.payload.includes("next_transactions-") || quick_reply?.payload.includes("prev_transactions-")) {
                            const payloadParts = quick_reply.payload.split('-');
                            const skip = parseInt(payloadParts[1]);
                            const limit = parseInt(payloadParts[2]);

                            const transactions = await Transaction.find({ account: account._id, $or: [{ hidden: { $exists: false } }, { hidden: false }] }).sort({ createdAt: -1 }).limit(limit).populate([
                                {
                                    path: 'account',
                                    select: 'user company first_name last_name',
                                    populate: [
                                        { path: 'user', select: 'first_name last_name' },
                                        { path: 'company', select: 'company_name' }
                                    ]
                                },
                                {
                                    path: 'sender',
                                    select: 'user company first_name last_name',
                                    populate: [
                                        { path: 'user', select: 'first_name last_name' },
                                        { path: 'company', select: 'company_name' }
                                    ]
                                },
                                {
                                    path: 'receiver',
                                    select: 'user company first_name last_name',
                                    populate: [
                                        { path: 'user', select: 'first_name last_name' },
                                        { path: 'company', select: 'company_name' }
                                    ]
                                }
                            ]);

                            const totalTransactions = await Transaction.countDocuments({ account: account._id });

                            const transactionsInfoPromises = transactions.map(transaction => createTransactionInfo(transaction, selectedLanguage));

                            const transactionsInfo = await Promise.all(transactionsInfoPromises);
                            const message = `
${transactionsInfo.join('\n')}
                            `;

                            let nextQuickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                            ];

                            if (skip > 0) {
                                nextQuickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `prev_transactions-${skip - limit > 0 ? skip - limit : 0}-${limit}` });
                            }

                            if (totalTransactions > skip + limit) {
                                nextQuickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `next_transactions-${skip + limit}-${limit}` });
                            }

                            await quickReply(entry.messaging[0], message, nextQuickReplies);

                            instaChatbot.flowFlag = true;
                            instaChatbot.flowId = "my_trans";
                            await instaChatbot.save();
                        }

                        // MY-MASTERCARD-FLOW --- //
                        else if (messaging?.postback?.payload === "vcc_menu" || quick_reply?.payload === "vcc_menu") {
                            const vvcs = await VirtualCardModel.find({ account: account._id });

                            if (vvcs.length !== 0) {

                                await quickMessage(entry.messaging[0], '🌟 Welcome to Your MasterCard Menu! 🌟\nEffortlessly manage your MasterCard and perform transactions. 💳✨', "CONFIRMED_EVENT_UPDATE");

                                const templatePayload = {
                                    template_type: "generic",
                                    elements: [
                                        {
                                            "title": "📋 Card Overview",
                                            // "subtitle": "Check your card details, status, and available balance in one place.",
                                            "image_url": "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/card%20overview.png",
                                            "buttons": [
                                                {
                                                    "type": "postback",
                                                    "title": "Card Overview",
                                                    "payload": "vcc_overview"
                                                }
                                            ]
                                        },

                                        {
                                            title: "💰 Add Funds to Your Card",
                                            // subtitle: "Securely top up your MasterCard balance.",
                                            image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/add%20funds%20to%20card.png",
                                            buttons: [
                                                {
                                                    type: "postback",
                                                    title: "Add Funds",
                                                    payload: "vcc_add_funds"
                                                }
                                            ]
                                        },
                                        {
                                            title: "🔄 Card to Card Transfer",
                                            // subtitle: "Transfer funds between your cards instantly.",
                                            image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/card%20to%20card%20transfer.png",
                                            buttons: [
                                                {
                                                    type: "postback",
                                                    title: "Transfer Funds",
                                                    payload: "vcc_transfer"
                                                }
                                            ]
                                        },
                                        {
                                            title: "💳 Card to Wallet Transfer",
                                            // subtitle: "Move funds from your card to your wallet easily.",
                                            image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/card%20to%20wallet%20transfer.png",
                                            buttons: [
                                                {
                                                    type: "postback",
                                                    title: "Transfer to Wallet",
                                                    payload: "vcc_wallet_transfer"
                                                }
                                            ]
                                        },
                                        {
                                            title: "📜 View Transactions",
                                            // subtitle: "Check your recent transactions and spending history.",
                                            image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/View%20transaction.png",
                                            buttons: [
                                                {
                                                    type: "postback",
                                                    title: "View Transactions",
                                                    payload: "vcc_transactions"
                                                }
                                            ]
                                        },
                                        {
                                            title: "➕ Add Additional Card",
                                            // subtitle: "Activate a new MasterCard for more flexibility.",
                                            image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/Add%C2%A0Additional%C2%A0Card.png",
                                            buttons: [
                                                {
                                                    type: "postback",
                                                    title: "Add Card",
                                                    payload: "activate_vcc_11"
                                                }
                                            ]
                                        }
                                    ]
                                };
                                await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload);
                            } else {
                                // No cards found, prompt to activate
                                const templatePayload = {
                                    template_type: "generic",
                                    elements: [
                                        {
                                            title: "💳 Choose Your InstaPay Card!",
                                            subtitle: `Instant global transactions, flexible payment options, and Apple Pay readiness—anytime, anywhere!

🔹 Accepted worldwide – Use your card wherever Mastercard is accepted 🌍
🔹 Instant card-to-card transfers – Send money seamlessly in seconds
🔹 International money transfers – Send and receive funds globally 💳
🔹 Apple Pay Ready – Tap & pay instantly from your iPhone 📲
🔹 Google Pay coming soon! Stay tuned for Android users 

🔥 Activate now & experience borderless payments!🔥`,
                                            image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Payment%20Card.png",
                                            buttons: [
                                                {
                                                    type: "postback",
                                                    title: "Choose & Activate! 🚀",
                                                    payload: "activate_vcc"
                                                },
                                                {
                                                    type: "postback",
                                                    title: "Go back 🔙",
                                                    payload: "main_menu"
                                                }
                                            ]
                                        }
                                    ]
                                };
                                await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload);
                            }
                            return
                        }

                        // vcc overview
                        else if (messaging?.postback?.payload === "vcc_overview") {
                            const vvcs = await VirtualCardModel.find({ account: account._id });

                            if (vvcs.length !== 0) {
                                let cardOverviewText = "";
                                let validCards = 0; // to track if we have at least one valid card

                                for (const card of vvcs) {
                                    const cardDetails = await getCardDetails(card._id);
                                    console.log({ cardDetails });

                                    if (!cardDetails.status) continue; // skip if details are not available

                                    validCards++; // increment for valid cards (valid cards are those that have a response from vccdaddy api)

                                    cardOverviewText += `🌟 Card Type: ${cardDetails.subscription_type === "virtual" ? "Virtual" : "Physical"}\n`;
                                    cardOverviewText += `💳 Card Package: ${cardDetails.type === "premium" ? "Premium" : "Standard"}\n`;
                                    cardOverviewText += `🔢 Card Number: *****${cardDetails.last4}\n`;
                                    cardOverviewText += `💱 Card Currency: ${cardDetails.currency}\n`;
                                    cardOverviewText += `💰 Card Balance: ${formattedAmount(cardDetails.balance)} ${cardDetails.currency}\n`;
                                    cardOverviewText += `\n-----------------------\n\n`;
                                }

                                if (validCards > 0) {
                                    const quickReplies = [
                                        {
                                            content_type: "text",
                                            title: "My MasterCard",
                                            payload: "vcc_menu"
                                        },
                                        {
                                            content_type: "text",
                                            title: lang[selectedLanguage].MAIN_MENU,
                                            payload: "main_menu"
                                        }
                                    ];
                                    await quickReply(entry.messaging[0], cardOverviewText, quickReplies, "vcc_overview");
                                } else {
                                    const quickReplies = [
                                        {
                                            content_type: "text",
                                            title: "Go back 🔙",
                                            payload: "vcc_menu"
                                        }
                                    ];
                                    await quickReply(entry.messaging[0], "No valid cards found!", quickReplies);
                                }
                            } else {
                                const quickReplies = [
                                    {
                                        content_type: "text",
                                        title: "Go back 🔙",
                                        payload: "vcc_menu"
                                    }
                                ];
                                await quickReply(entry.messaging[0], "No cards found!", quickReplies);
                            }
                            return;
                        }

                        // activate vcc
                        else if (messaging?.postback?.payload === "activate_vcc_11") {
                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: "💳 Expand Your InstaPay Experience! 🌟",
                                        subtitle: `Easily generate an additional InstaPay MasterCard for your friends and family or to use for specific transactions. Whether you want to share financial flexibility with loved ones or keep your expenses organized, creating a new card is quick and hassle-free! 🚀✨  

Get started now and enjoy seamless payments with InstaPay! 🔥`,
                                        image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Payment%20Card.png",
                                        buttons: [
                                            {
                                                type: "postback",
                                                title: "Get Started!",
                                                payload: "activate_vcc"
                                            },
                                            {
                                                type: "postback",
                                                title: "My Mastercard",
                                                payload: "vcc_menu"
                                            }
                                        ]
                                    }
                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload);
                        }
                        else if (messaging?.postback?.payload?.includes("activate_vcc")
                            || quick_reply?.payload?.includes("activate_vcc")
                            || (instaChatbot?.last_message?.includes("activate_vcc") && text && !quick_reply?.payload)
                        ) {
                            await VVCCreationInsta(
                                messaging.sender.id,
                                messaging?.postback?.payload || quick_reply?.payload,
                                account,
                                instaChatbot,
                                text,
                                selectedLanguage,
                            );
                            return
                        }

                        // card to card transfer
                        else if (messaging?.postback?.payload?.startsWith("vcc_transfer")
                            || quick_reply?.payload?.startsWith("vcc_transfer")
                            || (instaChatbot?.last_message?.startsWith("vcc_transfer") && text && !quick_reply?.payload)
                        ) {
                            await cardToCardTransfer(
                                messaging.sender.id,
                                messaging?.postback?.payload || quick_reply?.payload,
                                account,
                                instaChatbot,
                                text,
                                selectedLanguage,
                            );
                            return
                        }

                        // vcc add funds
                        else if (messaging?.postback?.payload?.startsWith("vcc_add_funds")
                            || quick_reply?.payload?.startsWith("vcc_add_funds")
                            || (instaChatbot?.last_message?.startsWith("vcc_add_funds") && text && !quick_reply?.payload)
                        ) {
                            await addFunds(
                                messaging.sender.id,
                                messaging?.postback?.payload || quick_reply?.payload,
                                account,
                                instaChatbot,
                                text,
                                selectedLanguage,
                            );
                            return
                        }


                        //--- INITIATE-PAYMENT --- //
                        // -------------------------------------------------------------------------------------- //
                        else if (quick_reply?.payload === "initiate_payment" || messaging?.postback?.payload === "initiate_payment") {
                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: lang[selectedLanguage].SEND_MONEY_TITLE,
                                        subtitle: lang[selectedLanguage].SEND_MONEY_SUBTITLE,
                                        image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Send%20Money.png",
                                        buttons: [
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].SEND_MONEY_BUTTON_TITLE,
                                                payload: "send_money",
                                            },
                                            {
                                                type: "postback",
                                                title: `🗃️ ${lang[selectedLanguage].MAIN_MENU_TITLE}`,
                                                payload: "main_menu",
                                            },
                                        ],
                                    },
                                    {
                                        title: lang[selectedLanguage].REQUEST_MONEY_TITLE,
                                        subtitle: lang[selectedLanguage].REQUEST_MONEY_SUBTITLE,
                                        image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Recieve%20Funds.png",
                                        buttons: [
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].REQUEST_MONEY_BUTTON_TITLE,
                                                payload: "request_money",
                                            },
                                        ],
                                    },
                                    {
                                        title: lang[selectedLanguage].SEND_QUOTE_TITLE,
                                        subtitle: lang[selectedLanguage].SEND_QUOTE_SUBTITLE,
                                        image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Send%20A%20Quote.png",
                                        buttons: [
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].SEND_QUOTE_BUTTON_TITLE,
                                                payload: "send_quotation",
                                            },
                                        ],
                                    },
                                    {
                                        title: lang[selectedLanguage].SEND_CRYPTO_TITLE,
                                        subtitle: lang[selectedLanguage].SEND_CRYPTO_SUBTITLE,
                                        image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Frame%2025.png",
                                        buttons: [
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].SEND_CRYPTO_BUTTON_TITLE,
                                                payload: "send_crypto",
                                            },
                                        ],
                                    },
                                ]
                            };
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].HOW_CAN_I_SERVE, "CONFIRMED_EVENT_UPDATE");
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload)

                        }

                        //--- INITIATE-PAYMENT --- => --- SEND-MONEY --- //
                        // If send money is selected from initiate payment
                        else if ((messaging?.postback?.payload === "send_money" || quick_reply?.payload === "send_money")) {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].MANAGE_MONEY_TRANSFERS, "CONFIRMED_EVENT_UPDATE");

                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: lang[selectedLanguage].INTL_TRANSFER_TITLE,
                                        image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/International%20Payments.png",
                                        buttons: [
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].INTL_TRANSFER_BUTTON_TITLE,
                                                payload: "intl_transfer",
                                            },
                                            {
                                                type: "postback",
                                                title: `⬅️ ${lang[selectedLanguage].BACK_BUTTON_TITLE}`,
                                                payload: "initiate_payment",
                                            },
                                        ],
                                    },
                                    {
                                        title: lang[selectedLanguage].WALLET_TO_WALLET_TITLE,
                                        image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/Wallet%20to%20Wallet.png",
                                        // image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Wallet%20to%20Wallet.png",
                                        buttons: [
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].WALLET_TO_WALLET_BUTTON_TITLE,
                                                payload: "wallet_to_wallet",
                                            },
                                            {
                                                type: "postback",
                                                title: `🗃️ ${lang[selectedLanguage].MAIN_MENU_TITLE}`,
                                                payload: "main_menu",
                                            },
                                        ],
                                    },
                                    {
                                        title: lang[selectedLanguage].MOBILE_AIRTIME_TITLE,
                                        image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/airtime.jpeg",
                                        buttons: [
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MOBILE_AIRTIME_BUTTON_TITLE,
                                                payload: "mobile_airtime",
                                            },
                                        ],
                                    },
                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload)
                        }

                        //--- INITIATE-PAYMENT --- => --- SEND-MONEY --- ==> E-Sim //
                        else if (messaging?.postback?.payload === "e_sim" || quick_reply?.payload === "e_sim") {
                            const message = lang[selectedLanguage].E_SIM_MESSAGE;
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_TITLE, payload: "main_menu" }
                            ];
                            await quickReply(entry.messaging[0], message, quickReplies, "4");
                        }
                        //--- INITIATE-PAYMENT --- => --- SEND-MONEY --- ==> CRYPTO //
                        else if (messaging?.postback?.payload === "send_crypto" || quick_reply?.payload === "send_crypto") {
                            const message = lang[selectedLanguage].CRYPTO_MESSAGE;
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_TITLE, payload: "main_menu" }
                            ];
                            await quickReply(entry.messaging[0], message, quickReplies, "4");
                        }

                        //--- INITIATE-PAYMENT --- => --- SEND-MONEY --- ==> MOBILE-AIRTIME //
                        else if ((messaging?.postback?.payload === "mobile_airtime" || quick_reply?.payload === "mobile_airtime")) {

                            await quickMessage(entry.messaging[0], lang[selectedLanguage].TOP_UP_PROMPT, "CONFIRMED_EVENT_UPDATE", "7.2");
                        }
                        // user has entered country name
                        else if (instaChatbot?.last_message === "7.1" && text && !quick_reply?.payload) {
                            const countryStatus = await getCountries(text);
                            const countryNameToISO = {};

                            for (const country of countries) {
                                countryNameToISO[country.name.toLowerCase()] = country.code;
                            }

                            const countryCode = countryNameToISO[countryStatus?.Name?.toLowerCase()];
                            instaChatbot.mobile_airtime.country_code = countryCode;
                            instaChatbot.mobile_airtime.country = countryStatus?.Name;
                            await instaChatbot.save()

                            if (countryStatus.country === "supported") {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].COUNTRY_CONFIRM_MESSAGE, "CONFIRMED_EVENT_UPDATE", "7.2");

                            } else if (countryStatus.country === "suggestion") {


                                const message = `${lang[selectedLanguage].COUNTRY_MISSPELLED_MESSAGE_PART1}\n\n${lang[selectedLanguage].COUNTRY_MISSPELLED_MESSAGE_PART2}\n\n${lang[selectedLanguage].COUNTRY_MISSPELLED_MESSAGE_PART3} '${countryName}'`;
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].CONFIRM_TITLE, payload: "airtm_confirm_suggested_country" },
                                    { content_type: "text", title: lang[selectedLanguage].REENTER_COUNTRY_TITLE, payload: "mobile_airtime" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];
                                instaChatbot.mobile_airtime.country = countryStatus?.Name;
                                await instaChatbot.save()
                                await quickReply(entry.messaging[0], message, quickReplies);
                                console.log(countryStatus, "suggestion");

                            } else {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].REENTER_COUNTRY_TITLE, payload: "mobile_airtime" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];
                                await quickReply(entry.messaging[0], lang[selectedLanguage].SEND_NOT_SUPPORTED, quickReplies);
                            }
                        }
                        // user has confirmed the country name
                        else if ((messaging?.postback?.payload === "airtm_confirm_suggested_country" || quick_reply?.payload === "airtm_confirm_suggested_country")) {
                            const message = `${lang[selectedLanguage].PHONE_NUMBER_ENTER_MESSAGE_PART1}\n\n${lang[selectedLanguage].PHONE_NUMBER_ENTER_MESSAGE_PART2}`;

                            await quickMessage(entry.messaging[0], message, "CONFIRMED_EVENT_UPDATE", "7.2");
                        }

                        // user has entered the phone number
                        else if (instaChatbot?.last_message === "7.2" && text && !quick_reply?.payload) {
                            const numberDetails = await numberVerificationAirtime(text)
                            console.log(numberDetails.message, "numberDetails")
                            if (numberDetails.status) {
                                if (numberDetails.message?.length !== 0) {

                                    instaChatbot.mobile_airtime.operator_id = numberDetails.message[0]?.id;
                                    instaChatbot.mobile_airtime.country_code = numberDetails.message[0]?.country?.iso_code;
                                    instaChatbot.mobile_airtime.country = numberDetails.message[0]?.country?.name;
                                    instaChatbot.mobile_airtime.operator = numberDetails.message[0]?.name ?? "N/A";
                                    instaChatbot.mobile_airtime.phone_number = text;
                                    await instaChatbot.save()

                                    const message = `
${lang[selectedLanguage].CONFIRM_NUMBER_DETAILS}
    
${lang[selectedLanguage].COUNTRY_LABEL}: ${numberDetails.message[0]?.country?.name ?? "N/A"}
${lang[selectedLanguage].OPERATOR}: ${numberDetails.message[0]?.name ?? "N/A"}
${lang[selectedLanguage].PHONE}: ${text}
                                    `

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].CONFIRM_TITLE, payload: "airtm_confirm_number" },
                                        { content_type: "text", title: lang[selectedLanguage].EDIT_NUMBER, payload: "mobile_airtime" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ]
                                    // const wallets = await Wallet.find({ account: account?._id, wallet_type: 'insta' });
                                    // const slicedWallets = wallets.slice(0, 8)

                                    // const quickReplies = slicedWallets?.map((wallet) => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `mbl_sub_wallet-${wallet._id}` } })

                                    // const message = lang[selectedLanguage].PICK_CURRENCY_MESSAGE;
                                    await quickReply(entry.messaging[0], message, quickReplies);                                // const data = {
                                    //     isoCode: numberDetails.message[0]?.country?.iso_code,
                                    //     operator_id: numberDetails.message[0]?.id,
                                    //     serviceId: 1
                                    // }
                                    // const subServices = await getSubservices(data)
                                    // if (subServices?.status) {
                                    //     const message = 'Select the mobile service below'
                                    //     const quickReplies = subServices?.message?.map(service => { return { content_type: "text", title: service.name, payload: `mbl_sub_serv-${service.id}` } });
                                    //     instaChatbot?.mobile_airtime?.operator_id = numberDetails.message[0]?.id
                                    //     await instaChatbot?.save()
                                    //     await quickReply(entry.messaging[0], message, quickReplies);
                                    // } else {
                                    //     const message = 'No services found for this country'
                                    //     const quickReplies = [{ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` }];
                                    //     await quickReply(entry.messaging[0], message, quickReplies);
                                    // }
                                } else {
                                    const quickReplies = [{ content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: `main_menu` }];
                                    await quickReply(entry.messaging[0], "We couldn't identify the operator for this number, please enter the valid phone number.", quickReplies);
                                }
                            } else {
                                const quickReplies = [{ content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: `main_menu` }];
                                await quickReply(entry.messaging[0], lang[selectedLanguage].INVALID_NUMBER_MESSAGE, quickReplies);
                            }
                        }
                        // user has confirmed the number
                        else if (quick_reply?.payload === "airtm_confirm_number" || quick_reply?.payload?.startsWith("airtime_wallets_flow") || (instaChatbot?.last_message?.includes("airtime_wallets_flow") && text && !quick_reply?.payload)) {

                            await handleAirtimeUsingW2W(
                                messaging.sender.id,
                                messaging?.postback?.payload || quick_reply?.payload,
                                account,
                                instaChatbot,
                                text,
                                selectedLanguage
                            )

                            return
                        }
                        // user has proceeded the airtime transaction with the paypal
                        else if (quick_reply?.payload?.startsWith("airtime_paypal_flow") || (instaChatbot?.last_message?.includes("airtime_paypal_flow") && text && !quick_reply?.payload)) {

                            await handleAirtimeUsingPaypal(
                                messaging.sender.id,
                                messaging?.postback?.payload || quick_reply?.payload,
                                account,
                                instaChatbot,
                                text,
                                selectedLanguage
                            )

                            return
                        }
                        // user has proceeded airtimw with card
                        else if (quick_reply?.payload?.startsWith("airtime_card_flow") || (instaChatbot?.last_message?.includes("airtime_card_flow") && text && !quick_reply?.payload)) {

                            // const message = `The selected payment method is currently unavailable and will be available soon. Thank you for your patience`;

                            // const quickReplies = [
                            //     { content_type: "text", title: "Select another", payload: "airtm_confirm_number" },
                            //     { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            // ]

                            // await quickReply(entry.messaging[0], message, quickReplies, "4");
                            await handleAirtimeUsingCard(
                                messaging.sender.id,
                                messaging?.postback?.payload || quick_reply?.payload,
                                account,
                                instaChatbot,
                                text,
                                selectedLanguage
                            )

                            return

                        }

                        //--- INITIATE-PAYMENT --- => --- SEND-MONEY --- => --- WALLET-TO-WALLET ---//
                        // If selected Wallet to Wallet
                        else if ((messaging?.postback?.payload === "wallet_to_wallet" || quick_reply?.payload === "wallet_to_wallet")) {

                            instaChatbot.qr_receiving_wallet = "";
                            instaChatbot.flowFlag = true;
                            instaChatbot.flowId = "w2w_flow";
                            await instaChatbot.save();

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },

                            ]

                            await quickReply(entry.messaging[0], lang[selectedLanguage].RECIPIENT_DETAILS_PROMPT, quickReplies, "4.1");

                        }

                        else if (instaChatbot?.last_message === "4.1" && text && !quick_reply?.payload) {
                            const accountsWithWallets = await searchUsersAndWallets(text.toLowerCase());

                            const uniqueResults = await getDistinctObjects(accountsWithWallets);

                            if (uniqueResults.length > 0) {
                                const filteredAccount = uniqueResults[0];

                                if (filteredAccount?._id?.toString() === account?._id?.toString()) {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]
                                    return await quickReply(entry.messaging[0], lang[selectedLanguage].SEND_MONEY_TO_SELF, quickReplies)
                                }

                                // if the sender and recipient same
                                const userName = filteredAccount.account_type === "individual" ? `${filteredAccount.first_name} ${filteredAccount.last_name}` : filteredAccount.company_name;

                                // if wallets lenth is more than 1, show wallets with quick replies
                                if (filteredAccount?.wallets?.length > 1) {
                                    const subtitleMsg = `
${lang[selectedLanguage].USERNAME_LABEL}: ${filteredAccount.username}
${lang[selectedLanguage].COUNTRY_LABEL}: ${filteredAccount.country_name}
${lang[selectedLanguage].ABOUT_ME}: ${filteredAccount.about_me}
`;

                                    const elements = [
                                        {
                                            title: `${userName}`,
                                            image_url: filteredAccount.profileImage,
                                            subtitle: subtitleMsg,
                                            buttons: [
                                                {
                                                    type: "web_url",
                                                    title: lang[selectedLanguage].VIEW_PROFILE_BUTTON,
                                                    url: `https://my.insta-pay.ch/profile/${filteredAccount.username}`,
                                                    webview_height_ratio: "full"
                                                }
                                            ],
                                        }
                                    ];
                                    const quickReplies = filteredAccount.wallets.map(wallet => ({
                                        content_type: "text",
                                        title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`,
                                        payload: `receiving_w2w-${wallet.wallet_id}`
                                    }));
                                    quickReplies.push(
                                        { content_type: "text", title: lang[selectedLanguage].ENTER_AGAIN, payload: "wallet_to_wallet" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    );

                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, { template_type: "generic", elements });
                                    await quickReply(entry.messaging[0], lang[selectedLanguage].SELECT_WALLET, quickReplies, "4");
                                }
                                // else show a single wallet inside template
                                else if (filteredAccount?.wallets?.length === 1) {
                                    const wallet = filteredAccount.wallets[0];
                                    const subtitleMsg = `
${lang[selectedLanguage].USERNAME_LABEL}: ${filteredAccount.username}
${lang[selectedLanguage].COUNTRY_LABEL}: ${filteredAccount.country_name}
${lang[selectedLanguage].WALLET_ID} ${wallet.wallet_id}
${lang[selectedLanguage].CURRENCY}: ${wallet.currency.code}
`;

                                    const elements = [
                                        {
                                            title: `${userName}`,
                                            image_url: filteredAccount.profileImage,
                                            subtitle: subtitleMsg,
                                            buttons: [
                                                {
                                                    type: "web_url",
                                                    title: lang[selectedLanguage].VIEW_PROFILE_BUTTON,
                                                    url: `https://my.insta-pay.ch/profile/${filteredAccount.username}`,
                                                    webview_height_ratio: "full"
                                                }
                                            ],
                                        }
                                    ];


                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].PROCEED_BUTTON, payload: "wallet_to_wallet_yes" },
                                        { content_type: "text", title: lang[selectedLanguage].ENTER_AGAIN, payload: "wallet_to_wallet" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ];

                                    instaChatbot.qr_receiving_wallet = wallet.wallet_id;
                                    await instaChatbot.save();
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, { template_type: "generic", elements });
                                    await quickReply(entry.messaging[0], lang[selectedLanguage].IS_CORRECT_MESSAGE, quickReplies, "4");
                                } else {
                                    const message = lang[selectedLanguage].NO_WALLETS_FOUND;

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].ENTER_AGAIN, payload: "wallet_to_wallet" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ];

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");
                                }
                            } else {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].ENTER_AGAIN, payload: "wallet_to_wallet" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ];
                                await quickReply(entry.messaging[0], lang[selectedLanguage].NO_USER_FOUND.replace('{{NAME}}', text), quickReplies);
                            }
                        }

                        else if (quick_reply?.payload.includes("receiving_w2w-")) {
                            const walletID = quick_reply?.payload?.split('-')[1]
                            instaChatbot.qr_receiving_wallet = walletID;
                            await instaChatbot.save();

                            // showing different payment methods
                            const pans = await PanModel.find({ account: account._id });

                            if (pans.length !== 0) {
                                const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].PAYMENT_CARD, payload: "updated_w2w_card_payment" },
                                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "w2w_instapay_wallets" },
                                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "w2w_paypal" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]

                                await quickReply(entry.messaging[0], message, quickReplies, "4");

                            } else {
                                const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "w2w_instapay_wallets" },
                                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "w2w_paypal" },
                                    { content_type: "text", title: lang[selectedLanguage].ADD_PAYMENT_CARD, payload: "add_payment_card-w2w_methods" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]

                                await quickReply(entry.messaging[0], message, quickReplies, "4");

                            }

                            // const wallets = await Wallet.find({ account: account?._id, wallet_type: 'insta', status: "active" });
                            // const slicedWallets = wallets.slice(0, 8)
                            // const quickReplies = slicedWallets?.map((wallet) => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `wallet_to_wallet-${wallet._id}` } })
                            // quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })

                            // await quickReply(entry.messaging[0], lang[selectedLanguage].SELECT_WALLET_CURRENCY, quickReplies, "4");
                        }

                        else if (quick_reply?.payload === "w2w_methods" || messaging?.postback?.payload === "w2w_methods") {
                            const pans = await PanModel.find({ account: account._id });

                            if (pans.length !== 0) {
                                const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].PAYMENT_CARD, payload: "updated_w2w_card_payment" },
                                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "w2w_instapay_wallets" },
                                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "w2w_paypal" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]

                                await quickReply(entry.messaging[0], message, quickReplies, "4");

                            } else {
                                const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "w2w_instapay_wallets" },
                                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "w2w_paypal" },
                                    { content_type: "text", title: lang[selectedLanguage].ADD_PAYMENT_CARD, payload: "add_payment_card-w2w_methods" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]

                                await quickReply(entry.messaging[0], message, quickReplies, "4");

                            }
                        }

                        else if (quick_reply?.payload === "w2w_instapay_wallets") {
                            const wallets = await Wallet.find({ account: account?._id, wallet_type: 'insta', status: "active" });
                            const slicedWallets = wallets.slice(0, 8)
                            const quickReplies = slicedWallets?.map((wallet) => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `wallet_to_wallet-${wallet._id}` } })
                            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })

                            await quickReply(entry.messaging[0], lang[selectedLanguage].SELECT_WALLET_CURRENCY, quickReplies, "4");
                        }

                        // if user has selected w2w with Payment Card
                        else if (messaging?.postback?.payload?.includes("updated_w2w_card_payment") || quick_reply?.payload?.includes("updated_w2w_card_payment") || (instaChatbot?.last_message?.includes("updated_w2w_card_payment") && text && !quick_reply?.payload)) {
                            console.log("did i ran?")
                            await w2wUsingCard(
                                messaging.sender.id,
                                messaging?.postback?.payload || quick_reply?.payload,
                                account,
                                instaChatbot,
                                text,
                                selectedLanguage
                            );
                            return
                        }

                        // if user has selected w2w with PayPal
                        else if (messaging?.postback?.payload?.includes("w2w_paypal") || quick_reply?.payload?.includes("w2w_paypal") || (instaChatbot?.last_message?.includes("w2w_paypal") && text && !quick_reply?.payload)) {
                            console.log("did i ran?")
                            await w2wUsingPaypal(
                                messaging.sender.id,
                                messaging?.postback?.payload || quick_reply?.payload,
                                account,
                                instaChatbot,
                                text,
                                selectedLanguage
                            );
                            return
                        }

                        // user has requested add payment card
                        else if (quick_reply?.payload?.includes("add_payment_card")) {

                            const backButton = quick_reply?.payload?.split("-")[1]

                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: lang[selectedLanguage].SECURITY_ADVISORY,
                                        buttons: [
                                            {
                                                type: "web_url",
                                                title: lang[selectedLanguage].LOGIN,
                                                url: "https://my.insta-pay.ch/login",
                                            },
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].BACK_TITLE,
                                                payload: backButton || "main_menu",
                                            },
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                payload: `main_menu`,
                                            },

                                        ],
                                    },


                                ],

                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                        }

                        // user has selected change payment method
                        else if (quick_reply?.payload === "change_payment_method_w2w" || messaging?.postback?.payload === "change_payment_method_w2w") {
                            const pans = await PanModel.find({ account: account._id });

                            if (pans.length !== 0) {
                                const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].PAYMENT_CARD, payload: "updated_w2w_card_payment" },
                                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "w2w_instapay_wallets" },
                                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "w2w_paypal" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]

                                await quickReply(entry.messaging[0], message, quickReplies, "4");

                            } else {
                                const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "w2w_instapay_wallets" },
                                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "w2w_paypal" },
                                    { content_type: "text", title: lang[selectedLanguage].ADD_PAYMENT_CARD, payload: "add_payment_card-change_payment_method_w2w" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]

                                await quickReply(entry.messaging[0], message, quickReplies, "4");

                            }

                            // const wallets = await Wallet.find({ account: account?._id, wallet_type: 'insta', status: "active" });
                            // const slicedWallets = wallets.slice(0, 8)
                            // const quickReplies = slicedWallets?.map((wallet) => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `wallet_to_wallet-${wallet._id}` } })
                            // quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })

                            // await quickReply(entry.messaging[0], lang[selectedLanguage].SELECT_WALLET_CURRENCY, quickReplies, "4");
                        }

                        // user has clicked on confirm details 
                        else if (quick_reply?.payload === "wallet_to_wallet_yes" || messaging?.postback?.payload === "wallet_to_wallet_yes") {

                            // showing different payment methods
                            const pans = await PanModel.find({ account: account._id });

                            if (pans.length !== 0) {
                                const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].PAYMENT_CARD, payload: "updated_w2w_card_payment" },
                                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "w2w_instapay_wallets" },
                                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "w2w_paypal" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]

                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            } else {
                                const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "w2w_instapay_wallets" },
                                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "w2w_paypal" },
                                    { content_type: "text", title: lang[selectedLanguage].ADD_PAYMENT_CARD, payload: "add_payment_card-wallet_to_wallet_yes" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]

                                await quickReply(entry.messaging[0], message, quickReplies, "4");

                            }

                            // const wallets = await Wallet.find({ account: account?._id, wallet_type: 'insta', status: "active" });
                            // const slicedWallets = wallets.slice(0, 8)
                            // const quickReplies = slicedWallets?.map((wallet) => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `wallet_to_wallet-${wallet._id}` } })
                            // quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })

                            // await quickReply(entry.messaging[0], lang[selectedLanguage].SELECT_WALLET_CURRENCY, quickReplies, "4");
                        }
                        // user has selected some currency to proceed with W2W
                        else if ((quick_reply?.payload.includes('wallet_to_wallet-')) || quick_reply?.payload === "adjust_amount_w2w") {
                            let walletDetails;
                            if (quick_reply?.payload !== "adjust_amount_w2w") {

                                const walletID = quick_reply?.payload?.split('-')[1]
                                walletDetails = await Wallet.findById(walletID);
                                instaChatbot.qr_sending_currency = walletID;
                                await instaChatbot.save()
                                console.log(walletDetails)
                            } else {
                                walletDetails = await Wallet.findById(instaChatbot.qr_sending_currency);
                            }

                            const message = lang[selectedLanguage].TRANSFER_MESSAGE
                                .replace('{{formattedAmount}}', formattedAmount(walletDetails?.balance?.available))
                                .replace('{{currencyCode}}', walletDetails.currency.code);

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].CHANGE_WALLET, payload: "wallet_to_wallet_yes" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]

                            await quickReply(entry.messaging[0], message, quickReplies, "4.2");
                        }
                        // user has entered amount to be sent using W2W
                        else if (instaChatbot?.last_message === "4.2" && text && !quick_reply?.payload) {
                            const digitRegex = /^\d+(\.\d+)?$/;
                            const isNumber = digitRegex.test(text)
                            const walletDetails = await Wallet.findById(instaChatbot.qr_sending_currency);
                            const amount = parseFloat(text);
                            console.log(walletDetails, 'walletDetails')
                            if (isNumber && amount >= 0.1) {
                                if (parseFloat(text) > walletDetails?.balance?.available) {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].CHANGE_PAYMENT_METHOD, payload: "wallet_to_wallet_yes" },
                                        { content_type: "text", title: lang[selectedLanguage].ADD_FUNDS, payload: "add_funds" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]
                                    await quickReply(entry.messaging[0], lang[selectedLanguage].INSUFFICIENT_BALANCE, quickReplies);
                                } else {

                                    const receiverWalletDetails = await Wallet.findOne({ wallet_id: instaChatbot?.qr_receiving_wallet }).populate([
                                        {
                                            path: 'account',
                                            populate: [
                                                { path: 'level' }
                                            ]
                                        }
                                    ])
                                    const senderWalletDetails = await Wallet.findById(instaChatbot.qr_sending_currency).populate([
                                        {
                                            path: 'account',
                                            populate: [

                                                { path: 'level' }
                                            ]
                                        }
                                    ]);

                                    const { exchange_rate, fee, totalAmountWithFee, recipient_amount } = await calculateExchangeAndFees(senderWalletDetails.currency.code, receiverWalletDetails.currency.code, parseFloat(text), "wallet_to_wallet", senderWalletDetails.account.level._id, "wallet", senderWalletDetails);

                                    let exchangedAmountSender = await getExchangeRatesToUSD(senderWalletDetails.currency.code, 'USD', totalAmountWithFee)

                                    const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, senderWalletDetails, 'sending')

                                    if (!sender_limits_check.status) {
                                        await quickMessage(entry.messaging[0], sender_limits_check.message, "CONFIRMED_EVENT_UPDATE");
                                        return

                                    }

                                    instaChatbot.w2w_sending_amount = amount;
                                    await instaChatbot.save()

                                    const amountToSendText = lang[selectedLanguage].AMOUNT_TO_SEND;
                                    const exchangeRateText = lang[selectedLanguage].EXCHANGE_RATE;
                                    const feeText = lang[selectedLanguage].FEE;
                                    const recipientGetsText = lang[selectedLanguage].RECIPIENT_GETS;
                                    const totalAmountText = lang[selectedLanguage].TOTAL_AMOUNT;
                                    let message;
                                    if (senderWalletDetails?.currency?.code !== receiverWalletDetails?.currency.code) {

                                        message = `
${amountToSendText}: ${formattedAmount(parseFloat(text))} ${senderWalletDetails?.currency?.code}
${exchangeRateText}: 1.00 ${senderWalletDetails?.currency?.code} = ${formattedAmount(exchange_rate, 6)} ${receiverWalletDetails?.currency.code}
${feeText}: ${formattedAmount(fee)} ${senderWalletDetails?.currency?.code}
${recipientGetsText} ${formattedAmount(recipient_amount)} ${receiverWalletDetails?.currency.code} 
${totalAmountText}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${senderWalletDetails?.currency?.code}
       `;
                                    } else {
                                        message = `
${amountToSendText}: ${formattedAmount(parseFloat(text))} ${senderWalletDetails?.currency?.code}
${feeText}: ${formattedAmount(fee)} ${senderWalletDetails?.currency?.code}
${recipientGetsText} ${formattedAmount(recipient_amount)} ${receiverWalletDetails?.currency.code} 
${totalAmountText}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${senderWalletDetails?.currency?.code}
       `;
                                    }

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].PROCEED_TO_TRANSFER, payload: "wallet_to_wallet_proceed" },
                                        { content_type: "text", title: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, payload: "adjust_amount_w2w" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },

                                    ]

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");
                                }
                            } else if (amount <= 0.1) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].MINIMUM_AMOUNT, "CONFIRMED_EVENT_UPDATE");
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_AMOUNT_DIGITS, "CONFIRMED_EVENT_UPDATE");
                            }

                        }
                        // user has selected proceed to transfer
                        else if (quick_reply?.payload === 'wallet_to_wallet_proceed') {

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].PERSONAL_SUPPORT, payload: "wallet_to_wallet_purpose-family_support" },
                                { content_type: "text", title: lang[selectedLanguage].BUSINESS_TRADE, payload: "wallet_to_wallet_purpose-business_trade" },
                                { content_type: "text", title: lang[selectedLanguage].OPERATIONAL_COSTS, payload: "wallet_to_wallet_purpose-operational_costs" },
                                { content_type: "text", title: lang[selectedLanguage].PURCHASES, payload: "wallet_to_wallet_purpose-purchases" },
                                { content_type: "text", title: lang[selectedLanguage].CHARITY_DONATIONS, payload: "wallet_to_wallet_purpose-charity" },
                                { content_type: "text", title: lang[selectedLanguage].OTHER_REASONS, payload: "wallet_to_wallet_purpose-other_reasons" },
                                { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "wallet_to_wallet" },
                                // { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ];

                            await quickReply(entry.messaging[0], `${lang[selectedLanguage].TRANSFER_REASON_MESSAGE} ${lang[selectedLanguage].SELECT_PURPOSE} 👇`, quickReplies, "4");
                        }
                        // user has selected purpose of transaction
                        else if ((quick_reply?.payload.includes('wallet_to_wallet_purpose-')) || messaging?.postback?.payload === "w2w_back") {
                            instaChatbot.transaction_purpose = messaging?.message?.text;
                            await instaChatbot.save();

                            const quickReplies = [

                                { content_type: "text", title: lang[selectedLanguage].ADD_NOTE_BUTTON, payload: "w2w_note" },
                                { content_type: "text", title: lang[selectedLanguage].ATTACH_DOCUMENT_BUTTON, payload: "w2w_document" },
                                { content_type: "text", title: lang[selectedLanguage].SKIP, payload: "w2w_p_methods" },
                            ];

                            await quickReply(entry.messaging[0], lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, quickReplies, "4");

                        }
                        // user has selected option of W2W payment methods like instant, subscribed
                        else if ((messaging?.postback?.payload === "w2w_p_methods" || quick_reply?.payload === 'w2w_p_methods')) {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].PAYMENT_TYPE_PROMPT, "CONFIRMED_EVENT_UPDATE");
                            await w2wPaymentMethodsTemplate(entry.messaging[0], messaging?.sender?.id, selectedLanguage)
                        }
                        //attachement and note flow for W2W
                        else if (quick_reply?.payload === 'w2w_document') {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ATTACH_DOCUMENT_PROMPT, "CONFIRMED_EVENT_UPDATE", "4.2.1");
                        }

                        // W2W note flow
                        else if (quick_reply?.payload === 'w2w_note') {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].TYPE_MESSAGE, "CONFIRMED_EVENT_UPDATE", "4.2.2");
                        }
                        // user is entering the notes description
                        else if (instaChatbot?.last_message === "4.2.2" && !quick_reply?.payload && text) {

                            instaChatbot.w2w_note = text;
                            await instaChatbot.save()
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].YES, payload: "w2w_p_add_attch" },
                                { content_type: "text", title: lang[selectedLanguage].NO, payload: "w2w_p_no_attch" },
                            ]

                            await quickReply(entry.messaging[0], lang[selectedLanguage].ATTACH_DOCUMENT, quickReplies, "4");
                        }
                        else if (quick_reply?.payload === 'w2w_p_add_attch') {

                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ATTACH_DOCUMENT_ASK, "CONFIRMED_EVENT_UPDATE", "4.2.1.1");
                        }
                        else if (messaging?.message?.attachments && instaChatbot?.last_message === "4.2.1.1" && !quick_reply?.payload) {
                            const { validCount, allImagesAndVideos } = validateAttachments(messaging.message.attachments);

                            if (!validCount) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].FILE_ATTACHMENT_LIMIT, "CONFIRMED_EVENT_UPDATE");
                                return;
                            }

                            if (allImagesAndVideos) {

                                const uploadedImages = await uploadToS3("transaction_images", account._id, messaging.message.attachments);
                                console.log(uploadedImages, "uploadedImages")
                                if (uploadedImages.status) {
                                    for (const image of uploadedImages.uploadedFiles) {
                                        instaChatbot.w2w_attachments.push({
                                            key: image.key,
                                            url: image.url,
                                            ETag: image.ETag
                                        })
                                    }
                                    await instaChatbot.save();

                                    await quickMessage(entry.messaging[0], lang[selectedLanguage].PAYMENT_TYPE_PROMPT, "CONFIRMED_EVENT_UPDATE");
                                    await w2wPaymentMethodsTemplate(entry.messaging[0], messaging?.sender?.id, selectedLanguage)
                                } else {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ];

                                    await quickReply(entry.messaging[0], uploadedImages.message, quickReplies);
                                }
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                            }

                        }
                        else if ((messaging?.message?.is_unsupported || text) && (instaChatbot?.last_message === "4.2.1.1" || instaChatbot?.last_message === "4.2.1") && !quick_reply?.payload) {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                        }
                        // user has entered an image to be sent an attachement
                        else if (messaging?.message?.attachments && instaChatbot?.last_message === "") {
                            if (instaChatbot?.instabot_connected && !quick_reply?.payload && messaging?.message?.attachments[0]?.type === "image") {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].YES, payload: "w2w_p_add_note" },
                                    { content_type: "text", title: lang[selectedLanguage].NO, payload: "w2w_p_no_note" },
                                ]

                                await quickReply(entry.messaging[0], lang[selectedLanguage].ATTACH_NOTE_PROMPT, quickReplies, "4");
                            }
                        }

                        else if (messaging?.message?.attachments && instaChatbot?.last_message === "4.2.1" && !quick_reply?.payload) {
                            const { validCount, allImagesAndVideos } = validateAttachments(messaging.message.attachments);

                            if (!validCount) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].FILE_ATTACHMENT_LIMIT, "CONFIRMED_EVENT_UPDATE");
                                return;
                            }
                            if (allImagesAndVideos) {

                                const uploadedImages = await uploadToS3("transaction_images", account._id, messaging.message.attachments);
                                console.log(uploadedImages, "uploadedImages")
                                if (uploadedImages.status) {
                                    for (const image of uploadedImages.uploadedFiles) {
                                        instaChatbot.w2w_attachments.push({
                                            key: image.key,
                                            url: image.url,
                                            ETag: image.ETag
                                        })
                                    }
                                    await instaChatbot.save();
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].YES, payload: "w2w_p_add_note" },
                                        { content_type: "text", title: lang[selectedLanguage].NO, payload: "w2w_p_no_note" },
                                    ];

                                    await quickReply(entry.messaging[0], lang[selectedLanguage].ATTACH_NOTE_PROMPT, quickReplies, "4");
                                } else {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ];

                                    await quickReply(entry.messaging[0], uploadedImages.message, quickReplies);
                                }
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                            }

                        }
                        else if (quick_reply?.payload === 'w2w_p_add_note') {

                            await quickMessage(entry.messaging[0], lang[selectedLanguage].TYPE_MESSAGE, "CONFIRMED_EVENT_UPDATE", "4.2.2.1");
                        }
                        else if (!quick_reply?.payload && text && instaChatbot?.last_message === "4.2.2.1") {
                            instaChatbot.w2w_note = text;
                            await instaChatbot.save()
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].PAYMENT_TYPE_PROMPT, "CONFIRMED_EVENT_UPDATE");
                            await w2wPaymentMethodsTemplate(entry.messaging[0], messaging?.sender?.id, selectedLanguage)
                        }
                        else if (quick_reply?.payload === 'w2w_p_no_attch' || quick_reply?.payload === "w2w_p_no_note") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].PAYMENT_TYPE_PROMPT, "CONFIRMED_EVENT_UPDATE");
                            await w2wPaymentMethodsTemplate(entry.messaging[0], messaging?.sender?.id, selectedLanguage)
                        }
                        //--- INITIATE-PAYMENT --- => --- SEND-MONEY --- => --- WALLET-TO-WALLET --- => --- INSTANT ---//
                        // user has selected instant payment method
                        else if (messaging?.postback?.payload === "w2w_p_instant") {
                            const receiverWalletDetails = await Wallet.findOne({ wallet_id: instaChatbot?.qr_receiving_wallet }).populate([
                                {
                                    path: 'account',
                                    populate: [
                                        { path: 'user' },
                                        { path: 'company' },
                                    ]
                                }
                            ]);

                            const senderWalletDetails = await Wallet.findById(instaChatbot.qr_sending_currency).populate([
                                {
                                    path: 'account',
                                    populate: [

                                        { path: 'level' }
                                    ]
                                }
                            ]);

                            const { totalAmountWithFee } = await calculateExchangeAndFees(senderWalletDetails.currency.code, receiverWalletDetails.currency.code, instaChatbot?.w2w_sending_amount, "wallet_to_wallet", senderWalletDetails.account.level._id, "wallet", senderWalletDetails);


                            const userName = receiverWalletDetails?.account?.account_type === "individual" ? receiverWalletDetails?.account?.user?.first_name + " " + receiverWalletDetails?.account?.user?.last_name : receiverWalletDetails?.account?.company?.company_name


                            const message = `
${lang[selectedLanguage].CONFIRM_TRANSFER_MESSAGE} ${formattedAmount(totalAmountWithFee)} ${senderWalletDetails?.currency.code} ${lang[selectedLanguage].TO_MESSAGE} ${userName}.

${lang[selectedLanguage].IS_CORRECT_MESSAGE}
`

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].CONFIRM_TRANSFER_TITLE, payload: "w2w_p_confirm" },
                                { content_type: "text", title: lang[selectedLanguage].CANCEL_TRANSACTION_TITLE, payload: "cancel_w2w_transs" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]

                            await quickReply(entry.messaging[0], message, quickReplies, "4");
                        }

                        //--- INITIATE-PAYMENT --- => --- SEND-MONEY --- => --- WALLET-TO-WALLET --- => --- SCHEDULED ---//
                        // user has selected schedule method
                        else if (messaging?.postback?.payload === "w2w_p_schedule" || quick_reply?.payload === "w2w_p_schedule") {
                            const token = generateToken(messaging.sender.id, instaChatbot._id);

                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: lang[selectedLanguage].CHOOSE_DATE_TIME,
                                        buttons: [
                                            {
                                                type: "web_url",
                                                title: lang[selectedLanguage].SELECT_DATE_TIME,
                                                url: `https://my.insta-pay.ch/chatbot/scheduled/${token}?default=${account?.timezone}`,
                                                webview_height_ratio: "full"
                                            },
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].BACK_TITLE,
                                                payload: 'w2w_p_methods',
                                            },
                                        ],
                                    },
                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload)

                            // const quickReplies = [
                            //     { content_type: "text", title: lang[selectedLanguage].ENTER_AGAIN, payload: "w2w_proceed_subsription" },
                            //     { content_type: "text", title: lang[selectedLanguage].BACK_TITLE, payload: "w2w_p_methods" },
                            //     { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" },
                            // ];

                            // await quickReply(entry.messaging[0], 'Kindly choose the date and time 📆⏰ for your scheduled payment.', quickReplies);

                        }
                        // user has selected proceed with schedule method
                        else if (messaging?.postback?.payload === "w2w_proceed_schedule" || quick_reply?.payload === "w2w_proceed_schedule") {
                            await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_w2w_schedule", "4.2.3", "Transaction OTP");

                        }
                        // user has entered OTP for scheduled payment
                        else if (instaChatbot?.last_message === "4.2.3" && text && !quick_reply?.payload) {
                            const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "confirm_w2w_schedule");

                            if (otpValidationResult.status) {
                                const data = {
                                    receiver_wallet_id: instaChatbot?.qr_receiving_wallet,
                                    sender_wallet_id: instaChatbot?.qr_sending_currency,
                                    purpose: instaChatbot?.transaction_purpose,
                                    amount: instaChatbot?.w2w_sending_amount,
                                    date: instaChatbot?.scheduleDate,
                                    time: instaChatbot?.scheduleTime,
                                    timezone: instaChatbot?.scheduleTimezone || account?.timezone,
                                    attachments: instaChatbot.w2w_attachments,
                                    description: instaChatbot.w2w_note,
                                    reserved: true
                                }

                                console.log(data, "datainsched2")

                                const scheduleDetails = await schedulePaymentW2W(data)
                                if (scheduleDetails.status) {
                                    const receiverWalletDetails = await Wallet.findOne({ wallet_id: instaChatbot?.qr_receiving_wallet }).populate([
                                        {
                                            path: 'account',
                                            populate: [
                                                { path: 'user' },
                                                { path: 'company' },
                                                { path: 'insta_recipient_id' },
                                            ]
                                        }
                                    ]);
                                    const senderWalletDetails = await Wallet.findById(instaChatbot.qr_sending_currency)
                                    // Check sender wallet balance
                                    if (senderWalletDetails.balance.available < instaChatbot?.w2w_sending_amount) {
                                        const schedule = await Schedule.findById(scheduleDetails?.subscribtionDetails?._id);
                                        schedule.status = "declined";
                                        schedule.reserved = false;
                                        await schedule.save();

                                        const templatePayload = {
                                            template_type: "generic",
                                            elements: [
                                                {
                                                    title: lang[selectedLanguage].INSUFFICIENT_FUNDS_SCHEDULE,
                                                    image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Declined.png",
                                                    buttons: [
                                                        {
                                                            type: "postback",
                                                            title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                            payload: "main_menu",
                                                        },
                                                    ],
                                                },
                                            ]
                                        };
                                        await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4");
                                        return;
                                    }

                                    // Reserve the amount if sufficient balance is available
                                    senderWalletDetails.balance.reserved = senderWalletDetails.balance?.reserved || 0;
                                    senderWalletDetails.balance.reserved += instaChatbot?.w2w_sending_amount;
                                    senderWalletDetails.balance.available -= instaChatbot?.w2w_sending_amount;
                                    await senderWalletDetails.save();

                                    const userName = receiverWalletDetails?.account?.account_type === "individual" ? receiverWalletDetails?.account?.user?.first_name + " " + receiverWalletDetails?.account?.user?.last_name : receiverWalletDetails?.account?.company?.company_name
                                    const subtitles = `
${lang[selectedLanguage].BENEFICIARY}: ${userName}
${lang[selectedLanguage].SCHEDULE}: ${data.time}, ${data.date}
${lang[selectedLanguage].TIMEZONE}: ${instaChatbot?.scheduleTimezone || account?.timezone}
${lang[selectedLanguage].WALLET_ID}: ${receiverWalletDetails.wallet_id}
${lang[selectedLanguage].STATUS}: ${lang[selectedLanguage].PENDING}`
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `Your scheduled payment of ${formattedAmount(instaChatbot?.w2w_sending_amount?.toFixed(2))} ${senderWalletDetails?.currency?.code} is all set up.`,
                                                subtitle: subtitles,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: "main_menu",
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")

                                    if (receiverWalletDetails?.account?.insta_recipient_id) {
                                        const receiverLang = receiverWalletDetails?.account?.insta_recipient_id?.active_language || receiverWalletDetails?.account?.language || "en"
                                        // recipients side message
                                        const subtitle1 = `
${lang[receiverLang].COUNTRY_LABEL}: ${account?.country_name}
${lang[selectedLanguage].SCHEDULE}: ${data.time}, ${data.date}
${lang[selectedLanguage].TIMEZONE}: ${instaChatbot?.scheduleTimezone || account?.timezone}
${lang[selectedLanguage].WALLET_ID}: ${receiverWalletDetails.wallet_id}
`
                                        const templatePayload1 = {
                                            template_type: "generic",
                                            elements: [
                                                {
                                                    title: `${account?.username} has set a scheduled payment of ${formattedAmount(instaChatbot?.w2w_sending_amount?.toFixed(2))} ${senderWalletDetails?.currency?.code} for you.`,
                                                    image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Schedule%20Payments.png",
                                                    subtitle: subtitle1,
                                                    buttons: [
                                                        {
                                                            type: "web_url",
                                                            title: lang[selectedLanguage].VIEW_PROFILE_BUTTON,
                                                            url: `https://my.insta-pay.ch/profile/${account?.username}`,
                                                            webview_height_ratio: "full"
                                                        },
                                                        {
                                                            type: "postback",
                                                            title: lang[selectedLanguage].MAIN_MENU,
                                                            payload: 'main_menu',
                                                        },
                                                    ],
                                                },
                                            ]
                                        };

                                        const data1 = {
                                            sender: { id: receiverWalletDetails?.account?.insta_recipient_id?.recipient },
                                        }
                                        await sendTemplate(data1, receiverWalletDetails?.account?.insta_recipient_id?.recipient, templatePayload1, "4")
                                    }
                                } else {
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: lang[selectedLanguage].SCHEDULE_ERROR_TITLE,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/System%20Error.png",
                                                subtitle: lang[selectedLanguage].SCHEDULE_ERROR_SUBTITLE,
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: "main_menu",
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                }
                                instaChatbot.qr_sending_currency = null;
                                instaChatbot.qr_receiving_wallet = "";
                                instaChatbot.w2w_sending_amount = null;
                                instaChatbot.transaction_purpose = ""
                                instaChatbot.w2w_transaction_type = ""
                                instaChatbot.scheduleTime = ""
                                instaChatbot.scheduleDate = ""
                                instaChatbot.flowFlag = false;
                                instaChatbot.flowId = "";
                                instaChatbot.scheduleTimezone = ""
                                instaChatbot.w2w_note = ""
                                instaChatbot.w2w_attachments = []
                                await instaChatbot.save();
                            }
                            else {
                                if (otpValidationResult.message === "max_attempts_exceeded") {

                                    await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                                } else {

                                    await invalidMessage(entry.messaging[0], "confirm_w2w_schedule", selectedLanguage, instaChatbot?.otpType);
                                }
                            }
                        }
                        //--- INITIATE-PAYMENT --- => --- SEND-MONEY --- => --- WALLET-TO-WALLET --- => --- SUBSCRIPTION ---//
                        // user has selected subscribed method
                        else if (messaging?.postback?.payload === "w2w_p_subsription" || quick_reply?.payload === "w2w_p_subsription") {
                            const message = lang[selectedLanguage].FINAL_AMOUNT_INFO

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].CONTINUE, payload: "continue_w2w_subs" },
                                { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "cancel_w2w_transs" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ];
                            await quickReply(entry.messaging[0], message, quickReplies, "4");

                        }

                        // user has continues the subs transaction
                        else if (quick_reply?.payload === "continue_w2w_subs") {
                            const token = generateToken(messaging.sender.id, instaChatbot._id);

                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: lang[selectedLanguage].SET_START_DATE,
                                        buttons: [
                                            {
                                                type: "web_url",
                                                title: lang[selectedLanguage].SELECT_STARTING_DATE,
                                                url: `https://my.insta-pay.ch/chatbot/subscription/${token}?default=${account?.timezone}`,
                                                webview_height_ratio: "full"
                                            },
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].BACK_TITLE,
                                                payload: 'w2w_p_methods',
                                            },
                                        ],
                                    },
                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload)
                        }

                        // user has proceed with until I stop
                        else if (quick_reply?.payload === "w2w_until_stop") {
                            const receiverWalletDetails = await Wallet.findOne({ wallet_id: instaChatbot?.qr_receiving_wallet }).populate([
                                {
                                    path: 'account',
                                    populate: [
                                        { path: 'user' },
                                        { path: 'company' },
                                    ]
                                }
                            ]);
                            instaChatbot.subscriptionUntilIStop = true;
                            await instaChatbot.save()
                            const senderWalletDetails = await Wallet.findById(instaChatbot.qr_sending_currency)
                            const userName = receiverWalletDetails?.account?.account_type === "individual" ? receiverWalletDetails?.account?.user?.first_name + " " + receiverWalletDetails?.account?.user?.last_name : receiverWalletDetails?.account?.company?.company_name


                            const message = lang[selectedLanguage].SUBSCRIPTION_INITIATION
                                .replace("{{amount}}", formattedAmount(instaChatbot?.w2w_sending_amount?.toFixed(2)))
                                .replace("{{currency}}", senderWalletDetails?.currency?.code)
                                .replace("{{recipient}}", userName)
                                .replace("{{start_date}}", instaChatbot?.subscriptionDate);

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].CONFIRM_TRANSFER_TITLE, payload: "w2w_proceed_subs_until" },
                                { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "cancel_w2w_transs" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ];
                            await quickReply(entry.messaging[0], message, quickReplies, "4");

                        }
                        // user has proceed with cycles
                        else if (quick_reply?.payload === "w2w_cycles") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_SUBSCRIPTION_MONTHS, "CONFIRMED_EVENT_UPDATE", "4.2.1.4");
                        }
                        // user has entered the number of cycles
                        else if (instaChatbot?.last_message === "4.2.1.4" && text && !quick_reply?.payload) {
                            const digitRegex = /^\d+$/;
                            const isNumber = digitRegex.test(text)
                            if (isNumber) {
                                instaChatbot.subscriptionCycles = parseInt(text);
                                await instaChatbot.save()

                                const receiverWalletDetails = await Wallet.findOne({ wallet_id: instaChatbot?.qr_receiving_wallet }).populate([
                                    {
                                        path: 'account',
                                        populate: [
                                            { path: 'user' },
                                            { path: 'company' },
                                        ]
                                    }
                                ]);
                                const senderWalletDetails = await Wallet.findById(instaChatbot.qr_sending_currency)
                                const userName = receiverWalletDetails?.account?.account_type === "individual" ? receiverWalletDetails?.account?.user?.first_name + " " + receiverWalletDetails?.account?.user?.last_name : receiverWalletDetails?.account?.company?.company_name


                                const message = lang[selectedLanguage].SUBSCRIPTION_INITIATION_DURATION
                                    .replace("{{amount}}", formattedAmount(instaChatbot?.w2w_sending_amount?.toFixed(2)))
                                    .replace("{{currency}}", senderWalletDetails?.currency?.code)
                                    .replace("{{recipient}}", userName)
                                    .replace("{{duration}}", parseInt(text))
                                    .replace("{{start_date}}", instaChatbot?.subscriptionDate);

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].CONFIRM_TITLE, payload: "w2w_proceed_subs_cycle" },
                                    { content_type: "text", title: lang[selectedLanguage].CHANGE_DETAILS, payload: "w2w_cycles" },
                                    { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "cancel_w2w_transs" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ];

                                await quickReply(entry.messaging[0], message, quickReplies, "4");

                            } else {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].ENTER_AGAIN, payload: "w2w_cycles" },
                                    { content_type: "text", title: lang[selectedLanguage].BACK_TITLE, payload: "w2w_p_methods" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" },
                                ];

                                await quickReply(entry.messaging[0], lang[selectedLanguage].INVALID_CYCLES_MESSAGE, quickReplies, "4");
                            }
                        }

                        // user has proceeded with selecting a end date
                        else if (quick_reply?.payload === "w2w_end_date") {
                            const token = generateToken(messaging.sender.id, instaChatbot._id);
                            const encryptedDate = await CryptoJS.AES.encrypt(instaChatbot?.subscriptionDate, "subscription_date_encryption").toString()


                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: lang[selectedLanguage].SELECT_END_DATE_TITLE,
                                        buttons: [
                                            {
                                                type: "web_url",
                                                title: lang[selectedLanguage].SELECT_DATE_TITLE,
                                                url: `https://my.insta-pay.ch/chatbot/subscription-end-date/${token}/${encryptedDate}?default=${account?.timezone}`,
                                                webview_height_ratio: "full"
                                            },
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                payload: 'main_menu',
                                            },
                                        ],
                                    },
                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload)
                        }

                        // user has entered no of cycles or selected an end date
                        else if (quick_reply?.payload === "w2w_proceed_subsription_ed" || quick_reply?.payload === "w2w_proceed_subs_cycle" || quick_reply?.payload === "w2w_proceed_subs_until") {

                            const walletDetails = await Wallet.findById(instaChatbot?.qr_sending_currency);
                            if (walletDetails.balance.available >= instaChatbot?.w2w_sending_amount) {

                                // walletDetails.balance.reserved = instaChatbot?.w2w_sending_amount
                                // await walletDetails.save()

                                const message = lang[selectedLanguage].RESERVE_AMOUNT_MESSAGE
                                    .replace('{{amount}}', formattedAmount(instaChatbot?.w2w_sending_amount))
                                    .replace('{{currency}}', walletDetails.currency.code);

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].CONTINUE, payload: "confirm_w2w_subs" },
                                    { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "cancel_w2w_transs" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];

                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            } else {
                                const message = `Insufficient balance. Your current balance is ${formattedAmount(walletDetails.balance.available)} ${walletDetails.currency.code}. You need at least ${formattedAmount(instaChatbot?.w2w_sending_amount)} ${walletDetails.currency.code} to proceed with this transaction.`;

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].ADD_FUNDS, payload: "add_funds" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];

                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            }


                        }

                        else if (quick_reply?.payload === "confirm_w2w_subs") {
                            await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "w2w_subs", "4.2.5", "Transaction OTP");
                        }
                        // user has entered otp for subscribed payment
                        else if (instaChatbot?.last_message === "4.2.5" && text && !quick_reply?.payload) {
                            const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "w2w_subs");

                            if (otpValidationResult.status) {
                                const data = {
                                    receiver_wallet_id: instaChatbot?.qr_receiving_wallet,
                                    sender_wallet_id: instaChatbot?.qr_sending_currency,
                                    purpose: instaChatbot?.transaction_purpose,
                                    amount: instaChatbot?.w2w_sending_amount,
                                    date: instaChatbot?.subscriptionDate,
                                    next_date: instaChatbot?.subscriptionDate,
                                    nextCycles: instaChatbot?.subscriptionCycles ?? 0,
                                    cycles: instaChatbot?.subscriptionCycles ?? 0,
                                    untilIStop: instaChatbot.subscriptionUntilIStop ?? false,
                                    timezone: instaChatbot?.subscriptionTimezone || account?.timezone,
                                    attachments: instaChatbot.w2w_attachments,
                                    description: instaChatbot.w2w_note,
                                    reserved: true
                                }

                                console.log(data, "datainsubsw2w")
                                const subscriptionDetails = await subscribePaymentW2W(data)
                                if (subscriptionDetails.status) {
                                    const receiverWalletDetails = await Wallet.findOne({ wallet_id: instaChatbot?.qr_receiving_wallet }).populate([
                                        {
                                            path: 'account',
                                            populate: [
                                                { path: 'user' },
                                                { path: 'company' },
                                            ]
                                        }
                                    ]);
                                    const senderWalletDetails = await Wallet.findById(instaChatbot.qr_sending_currency)
                                    console.log(subscriptionDetails, "subscriptionDetails")

                                    // reserving the amount - checking balance
                                    if (senderWalletDetails.balance.available < instaChatbot?.w2w_sending_amount) {
                                        const schedule = await Schedule.findById(subscriptionDetails?.subscribtionDetails?._id)
                                        schedule.status = "declined"
                                        schedule.reserved = false
                                        await schedule.save()

                                        const templatePayload = {
                                            template_type: "generic",
                                            elements: [
                                                {
                                                    title: "Your subscription payment could not be processed due to insufficient funds. Please top up your wallet and try again.",
                                                    // subtitle: subtitles,
                                                    image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Declined.png",

                                                    buttons: [
                                                        {
                                                            type: "postback",
                                                            title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                            payload: "main_menu",
                                                        },
                                                    ],
                                                },
                                            ]
                                        };
                                        await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                        return
                                    }

                                    // if enough balance available then reserving the amount
                                    senderWalletDetails.balance.reserved = senderWalletDetails.balance?.reserved || 0;
                                    senderWalletDetails.balance.reserved += instaChatbot?.w2w_sending_amount
                                    senderWalletDetails.balance.available -= instaChatbot?.w2w_sending_amount
                                    await senderWalletDetails.save()

                                    const userName = receiverWalletDetails?.account?.account_type === "individual" ? receiverWalletDetails?.account?.user?.first_name + " " + receiverWalletDetails?.account?.user?.last_name : receiverWalletDetails?.account?.company?.company_name
                                    const subtitles = `
${lang[selectedLanguage].BENEFICIARY}: ${userName}
From: ${data.date}
${instaChatbot?.subscriptionCycles ? `For: ${instaChatbot?.subscriptionCycles} ${instaChatbot?.subscriptionCycles === 1 ? 'month' : 'months'}` : instaChatbot?.subscriptionEndDate ? `To: ${instaChatbot?.subscriptionEndDate}` : 'To: Until Cancelled'}
${lang[selectedLanguage].WALLET_ID}: ${receiverWalletDetails.wallet_id}
${lang[selectedLanguage].STATUS}: ${lang[selectedLanguage].PENDING}
                                `
                                    let message;

                                    if (instaChatbot?.subscriptionCycles) {
                                        message = `
${lang[selectedLanguage].SUBSCRIPTION_SUCCESS_PREFIX} from ${data.date} ${lang[selectedLanguage].WITH} ${data.cycles} ${lang[selectedLanguage].CYCLES} and of ${formattedAmount(instaChatbot?.w2w_sending_amount?.toFixed(2))} ${senderWalletDetails?.currency?.code}
    `;
                                    } else if (instaChatbot?.subscriptionUntilIStop === true) {
                                        message = `
${lang[selectedLanguage].SUBSCRIPTION_SUCCESS_PREFIX} from ${data.date} to until you stop of ${formattedAmount(instaChatbot?.w2w_sending_amount?.toFixed(2))} ${senderWalletDetails?.currency?.code}
    `;
                                    } else {
                                        message = `
${lang[selectedLanguage].SUBSCRIPTION_SUCCESS_PREFIX} from ${data.date} to ${instaChatbot?.subscriptionEndDate} of ${formattedAmount(instaChatbot?.w2w_sending_amount?.toFixed(2))} ${senderWalletDetails?.currency?.code}
    `;
                                    }
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `Your subscription payment of ${formattedAmount(instaChatbot?.w2w_sending_amount?.toFixed(2))} ${senderWalletDetails?.currency?.code} is all set up.`,
                                                subtitle: subtitles,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",

                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: "main_menu",
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")

                                    instaChatbot.qr_sending_currency = null;
                                    instaChatbot.qr_receiving_wallet = "";
                                    instaChatbot.w2w_sending_amount = null;
                                    instaChatbot.transaction_purpose = ""
                                    instaChatbot.w2w_transaction_type = ""
                                    instaChatbot.subscriptionCycles = null;
                                    instaChatbot.subscriptionDate = ""
                                    instaChatbot.subscriptionUntilIStop = null
                                    instaChatbot.flowFlag = false;
                                    instaChatbot.flowId = "";
                                    instaChatbot.subscriptionTimezone = ""
                                    instaChatbot.w2w_note = ""
                                    instaChatbot.w2w_attachments = []
                                    await instaChatbot.save();
                                } else {
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: lang[selectedLanguage].SCHEDULE_ERROR_TITLE,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/System%20Error.png",
                                                subtitle: lang[selectedLanguage].SCHEDULE_ERROR_SUBTITLE,
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: "main_menu",
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")

                                    instaChatbot.qr_sending_currency = null;
                                    instaChatbot.qr_receiving_wallet = "";
                                    instaChatbot.w2w_sending_amount = null;
                                    instaChatbot.transaction_purpose = ""
                                    instaChatbot.w2w_transaction_type = ""
                                    instaChatbot.subscriptionCycles = null;
                                    instaChatbot.subscriptionDate = ""
                                    instaChatbot.subscriptionUntilIStop = null
                                    instaChatbot.flowFlag = false;
                                    instaChatbot.flowId = "";
                                    instaChatbot.subscriptionTimezone = ""
                                    instaChatbot.w2w_note = ""
                                    instaChatbot.w2w_attachments = []
                                    await instaChatbot.save();
                                }
                            }
                            else {
                                if (otpValidationResult.message === "max_attempts_exceeded") {

                                    await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                                } else {

                                    await invalidMessage(entry.messaging[0], "w2w_subs", selectedLanguage, instaChatbot?.otpType);
                                }
                            }
                        }
                        // W2W transaction has been confirmed
                        else if (quick_reply?.payload === 'w2w_p_confirm') {

                            await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_w2w", "4.3", "Transaction OTP");

                        }

                        else if (quick_reply?.payload === 'assistance') {

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].LOGIN_ISSUES, payload: "assitance-login" },
                                { content_type: "text", title: lang[selectedLanguage].TRANSACTION_QUERY, payload: "assitance-trans" },
                                { content_type: "text", title: lang[selectedLanguage].PROFILE_SETUP_HELP, payload: "assitance-profile" },
                                { content_type: "text", title: lang[selectedLanguage].OTHER_ISSUES, payload: "assitance-others" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                            ];

                            await quickReply(entry.messaging[0], lang[selectedLanguage].ASSISTANCE_QUERY, quickReplies, "4");
                        }
                        else if (quick_reply?.payload?.includes("assitance-")) {
                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: lang[selectedLanguage].REPRESENTATIVE_RESPONSE,
                                        buttons: [
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MAIN_MENU,
                                                payload: "main_menu",
                                            },
                                        ],
                                    },
                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                        }
                        // user has entered OTP for W2W transaction
                        else if (instaChatbot?.last_message === "4.3" && text && !quick_reply?.payload) {
                            const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "confirm_w2w");

                            if (otpValidationResult.status) {
                                const data = {
                                    receiver_wallet_id: instaChatbot?.qr_receiving_wallet,
                                    sender_wallet_id: instaChatbot?.qr_sending_currency,
                                    purpose: instaChatbot?.transaction_purpose,
                                    amount: instaChatbot?.w2w_sending_amount,
                                    type: "",
                                    payment_type: "wallet_to_wallet",
                                    description: instaChatbot.w2w_note,
                                    attachments: instaChatbot.w2w_attachments,
                                    transaction_method: "wallet"
                                }
                                const walletToWaletResponse = await walletToWalletTransaction(data)
                                console.log(walletToWaletResponse, "walletToWaletResponse")

                                if (walletToWaletResponse?.status) {
                                    console.log('transaction successful')

                                    const wallet = await Wallet.findOne({ wallet_id: instaChatbot?.qr_receiving_wallet }).populate([
                                        {
                                            path: 'account',
                                            populate: [
                                                { path: 'user' },
                                                { path: 'company' },
                                                { path: 'insta_recipient_id' }
                                            ]
                                        }
                                    ]);
                                    const sendingWallet = await Wallet.findById(instaChatbot?.qr_sending_currency).populate([
                                        {
                                            path: 'account',
                                            populate: [
                                                { path: 'user' },
                                                { path: 'company' },
                                            ]
                                        }
                                    ])
                                    const receiverName = wallet.account.account_type === "individual" ? wallet.account.user.first_name + " " + wallet.account.user.last_name :
                                        wallet?.account?.company?.company_name

                                    const senderName = sendingWallet.account.account_type === "individual" ? sendingWallet.account.user.first_name + " " + sendingWallet.account.user.last_name :
                                        sendingWallet?.account?.company?.company_name

                                    const subtitles = `
${lang[selectedLanguage].TRANSACTION_ID} ${walletToWaletResponse?.data?.reference_id}
${lang[selectedLanguage].STATUS}: ${lang[selectedLanguage].COMPLETED}`
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: lang[selectedLanguage].PAYMENT_DISPATCH.replace('{{receiverName}}', receiverName),
                                                subtitle: subtitles,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Succesful.png",
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].SEND_ANOTHER,
                                                        payload: `send_money`,
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU,
                                                        payload: "main_menu",
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")

                                    const templatePayload1 = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: lang[selectedLanguage].TRANSACTION_RECEIVED.replace('{{senderName}}', senderName),
                                                subtitle: subtitles,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Succesful.png",
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].CASH_OUT_NOW,
                                                        payload: `cash_out_id_${walletToWaletResponse?.exchanged?._id}`,
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU,
                                                        payload: "main_menu",
                                                    },
                                                ],
                                            },
                                        ]
                                    };

                                    const data1 = {
                                        sender: {
                                            id: wallet?.account?.insta_recipient_id?.recipient
                                        }
                                    }

                                    await sendTemplate(data1, wallet?.account?.insta_recipient_id?.recipient, templatePayload1, "4")

                                    instaChatbot.qr_sending_currency = null;
                                    instaChatbot.qr_receiving_wallet = "";
                                    instaChatbot.w2w_sending_amount = null;
                                    instaChatbot.transaction_purpose = ""
                                    instaChatbot.flowFlag = false;
                                    instaChatbot.flowId = "";
                                    instaChatbot.w2w_note = ""
                                    instaChatbot.w2w_attachments = []

                                    await instaChatbot.save();


                                } else if (walletToWaletResponse?.message.includes("feature_not_available")) {
                                    const featureType = walletToWaletResponse?.message?.split("_")[3]
                                    const message = usersFeatureMessage(featureType)

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");
                                }
                                else if (walletToWaletResponse?.message.includes("limit_")) {
                                    const limitCode = walletToWaletResponse?.message?.split("_")[1]
                                    const sendingAmounts = walletToWaletResponse?.sendingAmounts

                                    const message = userLimitsMessage(limitCode, sendingAmounts)

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");
                                }
                                else {
                                    console.log('transaction failed')
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: walletToWaletResponse?.message,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png",
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU,
                                                        payload: "main_menu",
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")

                                    instaChatbot.qr_sending_currency = null;
                                    instaChatbot.qr_receiving_wallet = "";
                                    instaChatbot.w2w_sending_amount = null;
                                    instaChatbot.transaction_purpose = ""
                                    instaChatbot.flowFlag = false;
                                    instaChatbot.flowId = "";
                                    instaChatbot.w2w_note = ""
                                    instaChatbot.w2w_attachments = []

                                    await instaChatbot.save();
                                }
                            }
                            else {
                                if (otpValidationResult.message === "max_attempts_exceeded") {

                                    await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                                } else {

                                    await invalidMessage(entry.messaging[0], "confirm_w2w", selectedLanguage, instaChatbot?.otpType);
                                }
                            }

                        }
                        //--- INITIATE-PAYMENT --- => --- SEND-MONEY --- => --- INTERNATIONAL ---//
                        // user has selected international payment option
                        else if ((messaging?.postback?.payload === "intl_transfer" || quick_reply?.payload === "intl_transfer")) {
                            instaChatbot.flowFlag = true;
                            instaChatbot.flowId = "intl_flow";
                            instaChatbot.intl = undefined
                            await instaChatbot.save()
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].LUCKY_RECIPIENT, "CONFIRMED_EVENT_UPDATE", "4.3.1");
                        }

                        // user has types country name in text
                        else if (instaChatbot?.last_message === "4.3.1" && text && !quick_reply?.payload) {
                            if (text.length < 4) {
                                return await quickMessage(entry.messaging[0], lang[selectedLanguage].COUNTRY_NAME_VALIDATION, "CONFIRMED_EVENT_UPDATE", "4.3.1");
                            }
                            const availableCountries = await getAvailableCountries(text, selectedLanguage)
                            console.log(availableCountries)

                            if (!availableCountries) {
                                const quickReplies = [{ content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }]

                                return await quickReply(entry.messaging[0], lang[selectedLanguage].NO_COUNTRY_FOUND, quickReplies, "4.3.1");
                            }

                            let quickReplies = availableCountries
                                .slice(0, 8)
                                .map(country => {
                                    return {
                                        content_type: "text",
                                        title: `${countryToEmoji[country.country_iso_code] ?? ''}` + country.country_name,
                                        payload: `intl_country-${country.country_iso_code}`
                                    };
                                });
                            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" })
                            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].ENTER_AGAIN, payload: "intl_transfer" })

                            await quickReply(entry.messaging[0], lang[selectedLanguage].SELECT_DESTINATION_COUNTRY, quickReplies, "4");

                        }

                        // user has selected some country
                        else if (quick_reply?.payload.includes("intl_country-")) {
                            const iso_code = quick_reply?.payload?.split("-")[1]

                            const list = await fetchCountriesFromThunes();

                            const selectedCountry = list.find(country =>
                                country.iso_code === iso_code
                            );

                            instaChatbot.intl_country_code = selectedCountry.iso_code;
                            instaChatbot.intl_country = selectedCountry?.name;
                            await instaChatbot.save()

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].PROCEED_TITLE, payload: "intl_country_proceed" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },

                            ]

                            await quickReply(entry.messaging[0], lang[selectedLanguage].SELECTED_COUNTRY_CONFIRMATION.replace(
                                "{{country}}", selectedCountry?.name),
                                quickReplies, "4");

                        }

                        // user has proceeded with country code
                        else if (quick_reply?.payload === "intl_country_proceed") {
                            await handleCountrySelection(entry, instaChatbot.intl_country_code, selectedLanguage);
                        }

                        // user has entered some country name
                        else if (instaChatbot?.last_message === "4.3.1" && text && !quick_reply?.payload) {

                            const countryStatus = await getCountries(text);
                            // console.log(countryStatus, "countryStatus")
                            const countryNameToISO = {};

                            for (const country of countries) {
                                countryNameToISO[country.name.toLowerCase()] = country.code;
                            }

                            const countryCode = countryNameToISO[countryStatus?.Name?.toLowerCase()];
                            instaChatbot.intl_country_code = countryCode;
                            instaChatbot.intl_country = countryStatus?.Name;
                            await instaChatbot.save()

                            if (countryStatus.country === "supported") {

                                await handleCountrySelection(entry, countryCode, selectedLanguage);

                            } else if (countryStatus.country === "suggestion") {

                                const message = `${lang[selectedLanguage].COUNTRY_MISSPELLED_MESSAGE_PART1}\n\n${lang[selectedLanguage].COUNTRY_MISSPELLED_MESSAGE_PART2}\n\n${lang[selectedLanguage].COUNTRY_MISSPELLED_MESSAGE_PART3} '${countryStatus?.Name}'`;

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].CONFIRM_TITLE, payload: "itl_confirm_suggested_country" },
                                    { content_type: "text", title: lang[selectedLanguage].REENTER_COUNTRY_TITLE, payload: "intl_transfer" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];
                                instaChatbot.intl_country = countryStatus?.Name;
                                await instaChatbot.save()
                                await quickReply(entry.messaging[0], message, quickReplies);
                                // console.log(countryStatus, "suggestion");

                            } else {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].REENTER_COUNTRY_TITLE, payload: "intl_transfer" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];
                                await quickReply(entry.messaging[0], lang[selectedLanguage].SEND_NOT_SUPPORTED, quickReplies);
                            }
                        }
                        else if ((messaging?.postback?.payload === "itl_confirm_suggested_country" || quick_reply?.payload === "itl_confirm_suggested_country")) {
                            const countryNameToISO = {};

                            for (const country of countries) {
                                countryNameToISO[country.name.toLowerCase()] = country.code;
                            }
                            // check if country is being saved properly,and user is now going to select the payout channel below
                            const countryCode = countryNameToISO[instaChatbot.intl_country?.toLowerCase()];
                            instaChatbot.intl_country_code = countryCode;
                            await instaChatbot.save()
                            await handleCountrySelection(entry, countryCode, selectedLanguage);
                        }
                        else if (quick_reply?.payload.includes("intl_p-")) {
                            const serviceId = quick_reply?.payload.split("-")[1];
                            const payerList = await getPayerNames(serviceId, instaChatbot?.intl_country_code);

                            console.log(payerList, "payers_list");

                            instaChatbot.intl_payout_method = serviceId;
                            await instaChatbot.save();

                            const numberOfChannelsPerPage = 8;
                            const currentPage = 1;
                            const startIndex = (currentPage - 1) * numberOfChannelsPerPage;
                            const endIndex = startIndex + numberOfChannelsPerPage;

                            let payoutChannels = payerList.payers.split('\n').filter(line => line.trim() !== '').slice(startIndex, endIndex).join('\n');

                            const allPayers = payerList.servicesWithIds;
                            const displayedPayers = allPayers.slice(startIndex, endIndex);
                            const payerIndexList = displayedPayers.map((payer, index) => ({
                                content_type: "text",
                                title: (startIndex + index + 1).toString(), // Payer index number
                                payload: `payer_${payer.id}` // Payload with payer ID
                            }));

                            let selectMessage;
                            if (serviceId === "1") {
                                selectMessage = lang[selectedLanguage].SELECT_PROVIDER
                            } else if (serviceId === "2") {
                                selectMessage = lang[selectedLanguage].SELECT_BANK
                            } else {
                                selectMessage = lang[selectedLanguage].SELECT_PAYER
                            }
                            const message = `${selectMessage}\n\n${payoutChannels}\n`;

                            let quickReplies = [
                                ...payerIndexList,
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` }
                            ];

                            if (serviceId === "1" || serviceId === "2") {
                                quickReplies = [{ content_type: "text", title: lang[selectedLanguage].SEARCH_PAYER, payload: "search_payer" }, ...quickReplies];
                            }

                            if (currentPage > 1) {
                                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `prev_payers_${currentPage - 1}` });
                            }

                            // Check if there are more payers available
                            if (allPayers.length > endIndex) {
                                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `next_payers_${currentPage + 1}_${serviceId}` });
                            }

                            await quickReply(entry.messaging[0], message, quickReplies, "4.3.2");
                        }


                        // Handle "Next" quick reply for payers
                        else if (quick_reply?.payload.includes("next_payers")) {
                            const currentPage = parseInt(quick_reply?.payload.split("_")[2]);
                            const serviceId = parseInt(quick_reply?.payload.split("_")[3]);
                            const payerList = await getPayerNames(serviceId, instaChatbot?.intl_country_code);

                            const numberOfChannelsPerPage = 8;
                            const startIndex = (currentPage - 1) * numberOfChannelsPerPage;
                            const endIndex = startIndex + numberOfChannelsPerPage;

                            let payoutChannels = payerList.payers.split('\n').filter(line => line.trim() !== '').slice(startIndex, endIndex).join('\n');

                            const allPayers = payerList.servicesWithIds;
                            const displayedPayers = allPayers.slice(startIndex, endIndex);
                            const payerIndexList = displayedPayers.map((payer, index) => ({
                                content_type: "text",
                                title: (startIndex + index + 1).toString(), // Payer index number
                                payload: `payer_${payer.id}` // Payload with payer ID
                            }));

                            let selectMessage;
                            if (serviceId === "1") {
                                selectMessage = lang[selectedLanguage].SELECT_PROVIDER
                            } else if (serviceId === "2") {
                                selectMessage = lang[selectedLanguage].SELECT_BANK
                            } else {
                                selectMessage = lang[selectedLanguage].SELECT_PROVIDER
                            }

                            const message = `${selectMessage}\n\n${payoutChannels}\n`;

                            let quickReplies = [
                                ...payerIndexList,
                            ];

                            // Conditionally add the lang[selectedLanguage].SEARCH_PAYER quick reply only if serviceId is 1 or 2
                            if (serviceId === "1" || serviceId === "2") {
                                quickReplies = [{ content_type: "text", title: lang[selectedLanguage].SEARCH_PAYER, payload: "search_payer" }, ...quickReplies];
                            }

                            if (currentPage === 2) {
                                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `re_select_payout` });
                            }
                            else if (currentPage > 1) {
                                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `next_payers_${currentPage - 1}_${serviceId}` });
                            }

                            // Check if there are more payers available
                            if (allPayers.length > endIndex) {
                                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `next_payers_${currentPage + 1}_${serviceId}` });
                                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` }
                                );
                            } else {
                                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` }
                                )
                            }

                            await quickReply(entry.messaging[0], message, quickReplies, "4");
                        }

                        // handle search payer functionaility
                        else if (quick_reply?.payload === "search_payer") {

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }
                            ];

                            await quickReply(entry.messaging[0], lang[selectedLanguage].ENTER_PAYER_NAME, quickReplies, "search_payer_msg");
                        }

                        // user has searched some payer name
                        else if (instaChatbot?.last_message === "search_payer_msg" && text && !quick_reply?.payload) {
                            const searchQuery = text.toLowerCase();
                            const payerList = await getPayerNames(instaChatbot.intl_payout_method, instaChatbot?.intl_country_code);

                            // console.log(payerList, "payerList")
                            const searchResults = payerList.servicesWithIds.filter(payer => payer.name.toLowerCase().includes(searchQuery))

                            console.log(searchResults, "searchResults")
                            if (searchResults.length === 0) {

                                await quickReply(entry.messaging[0], lang[selectedLanguage].NO_PAYERS_FOUND.replace("{{searchQuery}}", searchQuery), [{ content_type: "text", title: lang[selectedLanguage].SEARCH_AGAIN, payload: "search_payer" }], "4");
                            } else {
                                instaChatbot.intl.search_results = searchResults;
                                await instaChatbot.save();

                                // Show the first page of results (max 8 payers)
                                const numberOfChannelsPerPage = 8;
                                const currentPage = 1;
                                const startIndex = (currentPage - 1) * numberOfChannelsPerPage;
                                const endIndex = startIndex + numberOfChannelsPerPage;
                                const displayedPayers = searchResults.slice(startIndex, endIndex);

                                const payerIndexList = displayedPayers.map((payer, index) => ({
                                    content_type: "text",
                                    title: (startIndex + index + 1).toString(),
                                    payload: `payer_${payer.id}`
                                }));

                                const payerListText = displayedPayers
                                    .map((payer, index) => `${startIndex + index + 1}. ${payer.name}`)
                                    .join('\n');

                                const message = lang[selectedLanguage].SEARCH_RESULTS
                                    .replace("{{searchQuery}}", searchQuery)
                                    .replace("{{payerList}}", payerListText);
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].SEARCH_AGAIN, payload: "search_payer" },
                                    ...payerIndexList,
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }
                                ];

                                // Add pagination if more than 8 results
                                if (searchResults.length > endIndex) {
                                    quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `next_search_results_${currentPage + 1}` });
                                }

                                await quickReply(entry.messaging[0], message, quickReplies);
                            }
                        }

                        // Handle "Next" quick reply for search results
                        else if (quick_reply?.payload.includes("next_search_results")) {
                            const currentPage = parseInt(quick_reply?.payload.split("_")[3]);
                            const searchResults = instaChatbot.intl.search_results; // Get search results from the chatbot state

                            const numberOfChannelsPerPage = 8;
                            const startIndex = (currentPage - 1) * numberOfChannelsPerPage;
                            const endIndex = startIndex + numberOfChannelsPerPage;
                            const displayedPayers = searchResults.slice(startIndex, endIndex);

                            const payerIndexList = displayedPayers.map((payer, index) => ({
                                content_type: "text",
                                title: (startIndex + index + 1).toString(),
                                payload: `payer_${payer.id}`
                            }));

                            lang[selectedLanguage].SEARCH_RESULTS_PAGE
                                .replace("{{currentPage}}", currentPage)
                                .replace("{{payerList}}", displayedPayers.map((payer, index) => `${startIndex + index + 1}. ${payer.name}`).join('\n'));

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].SEARCH_AGAIN, payload: "search_payer" },
                                ...payerIndexList,
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }
                            ];

                            if (currentPage > 1) {
                                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `prev_search_results_${currentPage - 1}` });
                            }

                            if (searchResults.length > endIndex) {
                                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `next_search_results_${currentPage + 1}` });
                            }

                            await quickReply(entry.messaging[0], message, quickReplies);
                        }

                        // Handle "Previous" quick reply for search results
                        else if (quick_reply?.payload.includes("prev_search_results")) {
                            const currentPage = parseInt(quick_reply?.payload.split("_")[3]);
                            const searchResults = instaChatbot.intl.search_results;

                            const numberOfChannelsPerPage = 8;
                            const startIndex = (currentPage - 1) * numberOfChannelsPerPage;
                            const endIndex = startIndex + numberOfChannelsPerPage;
                            const displayedPayers = searchResults.slice(startIndex, endIndex);

                            const payerIndexList = displayedPayers.map((payer, index) => ({
                                content_type: "text",
                                title: (startIndex + index + 1).toString(),
                                payload: `payer_${payer.id}`
                            }));

                            lang[selectedLanguage].SEARCH_RESULTS_PAGE
                                .replace("{{currentPage}}", currentPage)
                                .replace("{{payerList}}", displayedPayers.map((payer, index) => `${startIndex + index + 1}. ${payer.name}`).join('\n'));

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].SEARCH_AGAIN, payload: "search_payer" },
                                ...payerIndexList,
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }
                            ];

                            if (currentPage > 1) {
                                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `prev_search_results_${currentPage - 1}` });
                            }

                            if (searchResults.length > endIndex) {
                                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `next_search_results_${currentPage + 1}` });
                            }

                            await quickReply(entry.messaging[0], message, quickReplies);
                        }


                        // user has selected payout channel
                        else if (quick_reply?.payload.includes("payer_")) {
                            const payerId = quick_reply?.payload.split("_")[1];
                            instaChatbot.intl_payer_id = payerId;
                            instaChatbot.intl = []
                            await instaChatbot.save();

                            const payerList = await getPayerNames(instaChatbot.intl_payout_method, instaChatbot?.intl_country_code);

                            const payerChannel = payerList?.servicesWithIds?.filter((item) => {
                                return item.id.toString() === payerId
                            })

                            if (payerChannel) {
                                const message = lang[selectedLanguage].CONFIRM_SENDING.replace("{{WALLET_PROVIDER}}", payerChannel[0].name)
                                    .replace("{{COUNTRY}}", instaChatbot?.intl_country);

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].YES_CONTINUE_TITLE, payload: "continue_intl_payout" },
                                    { content_type: "text", title: lang[selectedLanguage].BACK_BUTTON_TITLE, payload: "re_select_payout" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }
                                ];

                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            } else {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].RESELECT_CHANNEL_TITLE, payload: "re_select_payout" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }
                                ];

                                await quickReply(entry.messaging[0], lang[selectedLanguage].INVALID_PAYOUT_CHANNEL_MESSAGE, quickReplies, "4");
                            }


                        }
                        else if (quick_reply?.payload === "re_select_payout") {

                            const payerList = await getPayerNames(instaChatbot.intl_payout_method, instaChatbot?.intl_country_code);
                            console.log(payerList, "payers_list");

                            const numberOfChannelsPerPage = 8;
                            const currentPage = 1;
                            const startIndex = (currentPage - 1) * numberOfChannelsPerPage;
                            const endIndex = startIndex + numberOfChannelsPerPage;

                            let payoutChannels = payerList.payers.split('\n').filter(line => line.trim() !== '').slice(startIndex, endIndex).join('\n');

                            const allPayers = payerList.servicesWithIds;
                            const displayedPayers = allPayers.slice(startIndex, endIndex);
                            const payerIndexList = displayedPayers.map((payer, index) => ({
                                content_type: "text",
                                title: (startIndex + index + 1).toString(), // Payer index number
                                payload: `payer_${payer.id}` // Payload with payer ID
                            }));

                            let selectMessage;
                            if (instaChatbot.intl_payout_method === "1") {
                                selectMessage = lang[selectedLanguage].SELECT_PROVIDER
                            } else if (instaChatbot.intl_payout_method === "2") {
                                selectMessage = lang[selectedLanguage].SELECT_BANK
                            } else {
                                selectMessage = lang[selectedLanguage].SELECT_PROVIDER

                            }

                            const message = `${selectMessage}\n\n${payoutChannels}\n`;

                            const quickReplies = [
                                ...payerIndexList,
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` }
                            ];

                            // Check if there are more payers available
                            if (allPayers.length > endIndex) {
                                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `next_payers_${currentPage + 1}_${instaChatbot.intl_payout_method}` });
                            }

                            await quickReply(entry.messaging[0], message, quickReplies, "4.3.2");

                        }
                        // user has selected payout channel
                        else if (instaChatbot?.last_message === "4.3.2" && text && !quick_reply?.payload) {
                            if (text === "0") {
                                await mainMenuMessage(entry.messaging[0], messaging?.sender?.id, instaChatbot, selectedLanguage)
                            } else {
                                instaChatbot.intl_payout_channel = text;
                                await instaChatbot.save()

                                const payerList = await getPayerNames(instaChatbot.intl_payout_method, instaChatbot?.intl_country_code)
                                console.log(payerList, "payerList")
                                // text is the payout channel number, 15 is the max limit of searching the payout channels
                                const payoutChannelName = getPayoutChannelName(payerList, text, 18)
                                const selectedPayer = payerList?.servicesWithIds?.find(service => {
                                    return service.name.replace(/\s/g, '') === payoutChannelName.replace(/\s/g, '');
                                });
                                console.log('IDtest:', selectedPayer);
                                instaChatbot.intl_payer_id = selectedPayer?.id;
                                await instaChatbot.save()

                                if (payoutChannelName) {
                                    const message = lang[selectedLanguage].CONFIRM_SENDING.replace("{{WALLET_PROVIDER}}", payoutChannelName)
                                        .replace("{{COUNTRY}}", instaChatbot?.intl_country);
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].YES_CONTINUE_TITLE, payload: "continue_intl_payout" },
                                        { content_type: "text", title: lang[selectedLanguage].BACK_BUTTON_TITLE, payload: "re_select_payout" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");
                                } else {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].RESELECT_CHANNEL_TITLE, payload: "re_select_payout" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], lang[selectedLanguage].INVALID_PAYOUT_CHANNEL_MESSAGE, quickReplies, "4");
                                }

                            }
                        }

                        else if (quick_reply?.payload.includes("continue_intl_payout") || quick_reply?.payload === "change_payment_method_intl" || messaging?.postback?.payload === "continue_back_intl_payout") {

                            // showing different payment methods
                            const pans = await PanModel.find({ account: account._id });

                            if (pans.length !== 0) {
                                const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].PAYMENT_CARD, payload: "intl_card_payment" },
                                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "intl_using_w2w" },
                                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "intl_paypal_payment" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]

                                await quickReply(entry.messaging[0], message, quickReplies, "4");

                            } else {
                                const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "intl_using_w2w" },
                                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "intl_paypal_payment" },
                                    { content_type: "text", title: lang[selectedLanguage].ADD_PAYMENT_CARD, payload: "add_payment_card-continue_back_intl_payout" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]

                                await quickReply(entry.messaging[0], message, quickReplies, "4");

                            }

                            // const wallets = await Wallet.find({ account: account._id, wallet_type: 'insta', status: "active" });
                            // const limitedWallets = wallets.slice(0, 8)
                            // const quickReplies = limitedWallets.map(wallet => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `intl_select_wallet-${wallet._id}` } })
                            // quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })
                            // const message = "Select the currency you'd like to use for this transaction:"
                            // await quickReply(entry.messaging[0], message, quickReplies, "4")
                        }
                        // if user is proceesing intl transaction with Payment Card
                        else if (messaging?.postback?.payload?.includes("intl_card_payment") || quick_reply?.payload?.includes("intl_card_payment") || (instaChatbot?.last_message?.includes("intl_card_payment") && text && !quick_reply?.payload) || (instaChatbot?.last_message?.includes("intl_card_payment") && (messaging?.message?.attachments || messaging?.message?.is_unsupported))) {
                            await intlUsingCard(
                                messaging.sender.id,
                                messaging?.postback?.payload || quick_reply?.payload,
                                account,
                                instaChatbot,
                                text,
                                selectedLanguage,
                                messaging?.message
                            );
                            return
                        }
                        // if user is proceesing intl transaction with Payment Card
                        else if (messaging?.postback?.payload?.includes("intl_paypal_payment") || quick_reply?.payload?.includes("intl_paypal_payment") || (instaChatbot?.last_message?.includes("intl_paypal_payment") && text && !quick_reply?.payload) || (instaChatbot?.last_message?.includes("intl_paypal_payment") && (messaging?.message?.attachments || messaging?.message?.is_unsupported))) {
                            console.log("yes i have ran")
                            await intlUsingPaypal(
                                messaging.sender.id,
                                messaging?.postback?.payload || quick_reply?.payload,
                                account,
                                instaChatbot,
                                text,
                                selectedLanguage,
                                messaging?.message
                            );
                            return
                        }
                        // user selects continue international payment with selected payout channel 
                        else if (quick_reply?.payload === "intl_using_w2w") {
                            const wallets = await Wallet.find({ account: account._id, wallet_type: 'insta', status: "active" });
                            const limitedWallets = wallets.slice(0, 8)
                            const quickReplies = limitedWallets.map(wallet => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `intl_select_wallet-${wallet._id}` } })
                            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })

                            await quickReply(entry.messaging[0], lang[selectedLanguage].SELECT_CURRENCY_BALANCE_MESSAGE, quickReplies, "4");
                        }
                        // user has selected a currency for international payment
                        else if ((quick_reply?.payload.includes("intl_select_wallet-"))) { //|| quick_reply?.payload === "intl_adjust_amount"
                            const walletID = quick_reply?.payload.split('-')[1]
                            const walletDetails = await Wallet.findById(walletID);
                            instaChatbot.intl_sending_currency = walletID
                            await instaChatbot.save()
                            console.log(walletDetails)

                            const message = lang[selectedLanguage].TRANSFER_MESSAGE
                                .replace('{{formattedAmount}}', formattedAmount(walletDetails?.balance?.available))
                                .replace('{{currencyCode}}', walletDetails.currency.code);

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].ANOTHER_WALLET_TITLE, payload: "continue_intl_payout" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]

                            await quickReply(entry.messaging[0], message, quickReplies, "4.3.3");
                        }
                        // user has entered amount for international payment
                        else if (instaChatbot?.last_message === "4.3.3" && text && !quick_reply?.payload) {

                            const digitRegex = /^\d+(\.\d+)?$/;
                            const isNumber = digitRegex.test(text)
                            const amount = parseFloat(text);
                            const walletDetails = await Wallet.findById(instaChatbot.intl_sending_currency).populate([
                                {
                                    path: 'account',
                                    populate: [

                                        { path: 'level' }
                                    ]
                                }
                            ]);
                            if (!isNumber) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_AMOUNT_DIGITS, "CONFIRMED_EVENT_UPDATE");
                            }
                            else if (amount < 1) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_AMOUNT_MORE_THAN_1.replace("{{currency}}", walletDetails.currency.code), "CONFIRMED_EVENT_UPDATE");
                            }
                            else if (parseFloat(text) > walletDetails?.balance?.available) {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].ADD_FUNDS, payload: "add_funds" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], lang[selectedLanguage].INSUFFICIENT_BALANCE, quickReplies);
                            }
                            else {

                                // const exchangedRates = await getExchangeRates({ , wallet_id:   amount: parseInt(text), , iso_code: instaChatbot?.intl_country_code })

                                let channel_name, service_name;
                                if (instaChatbot.intl_payout_method === "1") {
                                    channel_name = "mobile_money";
                                    service_name = "international_mobile_wallet";
                                } else {
                                    channel_name = "bank_account";
                                    service_name = "international_bank_transfer";
                                }

                                const ratesData = {
                                    transaction_type: "C2C",
                                    wallet_id: instaChatbot?.intl_sending_currency.toString(),
                                    amount: parseFloat(text),
                                    service_id: instaChatbot.intl_payout_method,
                                    channel_name,
                                    service_name,
                                    payerId: instaChatbot.intl_payer_id,
                                    iso_code: instaChatbot.intl_country_code,
                                    currency_code: walletDetails.currency.code,
                                    payment_method: "wallet",
                                    chatbot: true
                                }

                                const exchangedRates = await getIntlFXHelper(ratesData)

                                if (exchangedRates?.success) {
                                    const rates = exchangedRates?.data?.result

                                    console.log(exchangedRates, "exchangedRates")

                                    let exchangedAmountSender = await getExchangeRatesToUSD(walletDetails.currency.code, 'USD', rates?.total?.value)
                                    console.log(walletDetails.account.level, "walletDetails.account.level")

                                    const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, walletDetails, 'sending')

                                    if (!sender_limits_check.status) {
                                        await quickMessage(entry.messaging[0], sender_limits_check.message, "CONFIRMED_EVENT_UPDATE");
                                        return
                                    }

                                    await quickMessage(entry.messaging[0], lang[selectedLanguage].SENDING_AMOUNT
                                        .replace("{{amount}}", formattedAmount(amount))
                                        .replace("{{currency}}", rates?.total?.currency ?? "N/A"), "CONFIRMED_EVENT_UPDATE");

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
                                        { content_type: "text", title: lang[selectedLanguage].PROCEED_TO_TRANSFER, payload: "intl_proceed_transfer" },
                                        { content_type: "text", title: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, payload: "intl_adjust_amount" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");

                                    instaChatbot.intl_amount = amount;
                                    instaChatbot.intl_exchngrate_token = exchangedRates?.data?.token
                                    await instaChatbot.save()
                                } else {
                                    const errorMessage = Array.isArray(exchangedRates?.message) ? exchangedRates?.message?.find(msg =>
                                        msg?.message?.toLowerCase().includes('payer is currently unavailable')
                                    ) : null

                                    let message, lastMessage = null;
                                    if (errorMessage) {
                                        const payerList = await getPayerNames(instaChatbot.intl_payout_method, instaChatbot?.intl_country_code)

                                        const payerChannel = payerList?.servicesWithIds?.filter((item) => {
                                            return item.id.toString() === instaChatbot.intl_payer_id
                                        })

                                        message = lang[selectedLanguage].UNABLE_TO_SEND.replace(
                                            "{{payerName}}",
                                            payerChannel?.name
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
                                        await quickReply(entry.messaging[0], message, quickReplies, "4");
                                    } else {
                                        await quickReply(entry.messaging[0], message, quickReplies);
                                    }
                                }

                            }

                        }
                        else if (quick_reply?.payload === "intl_adjust_amount") {

                            const quickReplies = [
                                { content_type: "text", title: "Another wallet", payload: "continue_intl_payout" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]

                            await quickReply(entry.messaging[0], lang[selectedLanguage].INPUT_TRANSFER_AMOUNT_MESSAGE, quickReplies, "4.3.3");
                        }
                        else if (quick_reply?.payload === "intl_proceed_transfer") {
                            if (account?.level?.level_no === 1) {
                                await userKYCVerificationTemplate(entry.messaging[0], messaging?.sender?.id, selectedLanguage)
                            } else {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].PERSONAL_SUPPORT, payload: "intl_purpose-FAMILY_SUPPORT" },
                                    { content_type: "text", title: lang[selectedLanguage].EDUCATION, payload: "intl_purpose-EDUCATION" },
                                    { content_type: "text", title: lang[selectedLanguage].MEDICAL_TREATMENTS, payload: "intl_purpose-MEDICAL_TREATMENT" },
                                    { content_type: "text", title: lang[selectedLanguage].OPERATIONAL_COSTS, payload: "intl_purpose-SERVICE_CHARGES" },
                                    { content_type: "text", title: lang[selectedLanguage].CHARITY_DONATIONS, payload: "intl_purpose-GIFT_AND_DONATION" },
                                    { content_type: "text", title: lang[selectedLanguage].OTHER_REASONS, payload: "intl_purpose-OTHER" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ];

                                await quickReply(entry.messaging[0], `${lang[selectedLanguage].TRANSFER_REASON_MESSAGE} ${lang[selectedLanguage].SELECT_PURPOSE} 👇`, quickReplies, "4");
                            }
                        }
                        // user has selected a purpose
                        else if (quick_reply?.payload.includes("intl_purpose-")) {
                            const purpose = quick_reply?.payload.split("-")[1];
                            instaChatbot.intl.purpose = purpose
                            await instaChatbot.save()

                            const quickReplies = [

                                { content_type: "text", title: lang[selectedLanguage].ADD_NOTE_BUTTON, payload: "intl_note" },
                                { content_type: "text", title: lang[selectedLanguage].ATTACH_DOCUMENT_BUTTON, payload: "intl_doc" },
                                { content_type: "text", title: lang[selectedLanguage].SKIP, payload: "intl_without_doc" },
                            ];

                            await quickReply(entry.messaging[0], `${lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE}`, quickReplies, "4");
                        }
                        // ask user to enter a note for intl transfer
                        else if (quick_reply?.payload === "intl_note") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "CONFIRMED_EVENT_UPDATE", "4.3.3.1");
                        }
                        // user has entered a note
                        else if (instaChatbot?.last_message === "4.3.3.1" && text && !quick_reply?.payload) {

                            instaChatbot.intl.intl_note = text
                            await instaChatbot.save()

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].YES, payload: "intl_add_attch" },
                                { content_type: "text", title: lang[selectedLanguage].NO, payload: "intl_no_attch" },
                            ]

                            await quickReply(entry.messaging[0], lang[selectedLanguage].ATTACH_DOCUMENT, quickReplies, "4");

                        }
                        // user has also proceeded with adding an attachement
                        else if (quick_reply?.payload === "intl_add_attch") {

                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ATTACH_DOCUMENT_ASK, "CONFIRMED_EVENT_UPDATE", "4.3.3.2");
                            // await quickMessage(entry.messaging[0], "Attach any relevant documents. Supported format jpeg, png",  "4.3.3.2");
                        }
                        // user has not proceeded with adding an attachement
                        else if (quick_reply?.payload === "intl_no_attch" || quick_reply?.payload === "intl_no_note" || quick_reply?.payload === "intl_without_doc") {
                            await processIntlProceedTransfer(entry, instaChatbot, account, instaChatbot?.intl_country_code, selectedLanguage);
                        }
                        // user has uploaded an image
                        // else if (messaging?.message?.attachments && instaChatbot?.last_message === "4.3.3.2") {
                        //     if (instaChatbot?.instabot_connected && !quick_reply?.payload && messaging?.message?.attachments[0]?.type === "image") {
                        //         await processIntlProceedTransfer(entry, instaChatbot, account, instaChatbot?.intl_country);
                        //     }
                        // }
                        else if (messaging?.message?.attachments && instaChatbot?.last_message === "4.3.3.2" && !quick_reply?.payload) {
                            const { validCount, allImagesAndVideos } = validateAttachments(messaging.message.attachments);

                            if (!validCount) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].FILE_ATTACHMENT_LIMIT, "CONFIRMED_EVENT_UPDATE");
                                return;
                            }
                            if (allImagesAndVideos) {

                                const uploadedImages = await uploadToS3("transaction_images", account._id, messaging.message.attachments);
                                console.log(uploadedImages, "uploadedImages")
                                if (uploadedImages.status) {
                                    for (const image of uploadedImages.uploadedFiles) {
                                        instaChatbot.intl.intl_attachments.push({
                                            key: image.key,
                                            url: image.url,
                                            ETag: image.ETag
                                        })
                                    }
                                    await instaChatbot.save();
                                    await processIntlProceedTransfer(entry, instaChatbot, account, instaChatbot?.intl_country_code, selectedLanguage);

                                } else {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ];

                                    await quickReply(entry.messaging[0], uploadedImages.message, quickReplies);
                                }
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                            }

                        }
                        // if user has entered invalid file type or multiple image files
                        else if ((messaging?.message?.is_unsupported || text) && instaChatbot?.last_message === "4.3.3.2" && !quick_reply?.payload) {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                        }
                        // user has attached an image as a document
                        else if (quick_reply?.payload === "intl_doc") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ATTACH_DOCUMENT_PROMPT, "CONFIRMED_EVENT_UPDATE", "4.3.3.3");
                        }
                        // user has attached an image as a document
                        // else if (messaging?.message?.attachments && instaChatbot?.last_message === "4.3.3.3") {
                        //     if (instaChatbot?.instabot_connected && !quick_reply?.payload && messaging?.message?.attachments[0]?.type === "image") {

                        //     }
                        // }
                        else if (messaging?.message?.attachments && instaChatbot?.last_message === "4.3.3.3" && !quick_reply?.payload) {
                            const { validCount, allImagesAndVideos } = validateAttachments(messaging.message.attachments);

                            if (!validCount) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].FILE_ATTACHMENT_LIMIT, "CONFIRMED_EVENT_UPDATE");
                                return;
                            }
                            if (allImagesAndVideos) {

                                const uploadedImages = await uploadToS3("transaction_images", account._id, messaging.message.attachments);
                                console.log(uploadedImages, "uploadedImages")
                                if (uploadedImages.status) {
                                    for (const image of uploadedImages.uploadedFiles) {
                                        instaChatbot.intl.intl_attachments.push({
                                            key: image.key,
                                            url: image.url,
                                            ETag: image.ETag
                                        })
                                    }
                                    await instaChatbot.save();
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].YES, payload: "intl_add_note" },
                                        { content_type: "text", title: lang[selectedLanguage].NO, payload: "intl_no_note" },
                                    ]

                                    await quickReply(entry.messaging[0], lang[selectedLanguage].ATTACH_NOTE_PROMPT, quickReplies, "4");
                                } else {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ];

                                    await quickReply(entry.messaging[0], uploadedImages.message, quickReplies);
                                }
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                            }

                        }
                        // user has uploaded invalid image
                        else if ((messaging?.message?.is_unsupported || text) && instaChatbot?.last_message === "4.3.3.3" && !quick_reply?.payload) {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                        }
                        // user has proceeded with additional note request
                        else if (quick_reply?.payload === "intl_add_note") {
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].SKIP, payload: "intl_no_attch" },
                                { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "main_menu" },
                            ]
                            await quickReply(entry.messaging[0], lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, quickReplies, "4.3.3.4");

                            // await quickMessage(entry.messaging[0],  lang[selectedLanguage].PLEASE_DESCRIBE_PURPOSE, "CONFIRMED_EVENT_UPDATE", "4.3.3.4");
                        }
                        // has added the note
                        else if (instaChatbot?.last_message === "4.3.3.4" && text && !quick_reply?.payload) {
                            instaChatbot.intl.intl_note = text
                            await instaChatbot.save()
                            // show beneficiaries here
                            await processIntlProceedTransfer(entry, instaChatbot, account, instaChatbot?.intl_country_code, selectedLanguage);
                        }
                        // /////////////////////////////////////////////////////////////
                        // else if (quick_reply?.payload === "intl_proceed_transfer") {
                        //     // if(instaChatbot.intl_payout_method === )
                        //     await processIntlProceedTransfer(entry, instaChatbot, account, instaChatbot?.intl_country);
                        // }
                        else if (quick_reply?.payload.includes("next_beneficiaries")) {
                            const currentPage = parseInt(quick_reply?.payload.split("_")[2]);
                            const beneficiaries = instaChatbot.intl_beneficiaries;
                            const numberOfBeneficiariesPerPage = 8;
                            const startIndex = (currentPage - 1) * numberOfBeneficiariesPerPage;
                            const endIndex = startIndex + numberOfBeneficiariesPerPage;

                            const beneficiariesToDisplay = beneficiaries.slice(startIndex, endIndex);

                            const beneficiaryList = beneficiariesToDisplay.map((beneficiary, index) => ({
                                content_type: "text",
                                title: `${beneficiary?.first_name} ${beneficiary?.last_name}`,
                                payload: `select_benef_${beneficiary._id}`
                            }));

                            const message = lang[selectedLanguage].SELECT_BENEFICIARY;

                            const quickReplies = [
                                ...beneficiaryList,
                                { content_type: "text", title: lang[selectedLanguage].ADD_BENEFICIARY, payload: `add_beneficiary` },

                            ];
                            if (currentPage === 2) {
                                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `intl_no_attch` },)
                                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` })
                            } else {
                                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `prev_beneficiaries_${currentPage}` },)
                                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` })

                            }

                            // Check if there are more beneficiaries available for "Next" quick reply
                            if (beneficiaries.length > endIndex) {
                                quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `next_beneficiaries_${currentPage + 1}` });
                            }

                            await quickReply(entry.messaging[0], message, quickReplies, "4.3.4");
                        }
                        // user is selecting the beneficiary number
                        else if (quick_reply?.payload.includes("select_benef_")) {
                            const benefeciaryId = quick_reply?.payload?.split("_")[2]
                            // const beneficiaries = await Beneficiary.find({ account: account?._id });
                            const senderWallet = await Wallet.findById(instaChatbot?.intl_sending_currency);
                            // const beneficiary = instaChatbot?.intl_beneficiaries[parseInt(text) - 1]
                            // console.log(instaChatbot?.intl_beneficiaries, "instaChatbot?.intl_beneficiaries")
                            const beneficiary = await Beneficiary.findById(benefeciaryId);
                            const benefName = `${beneficiary?.first_name} ${beneficiary?.last_name}`
                            instaChatbot.intl_benef_id = beneficiary?._id;
                            await instaChatbot.save()

                            const data = {
                                payerId: instaChatbot.intl_payer_id,
                                wallet_id: senderWallet?._id.toString(),
                                transaction_type: beneficiary?.beneficiary_type === "individual" ? "C2C" : "B2C",
                                token: instaChatbot?.intl_exchngrate_token,
                                payment_method: "wallet"

                            }

                            console.log("datainsidecondition", data);

                            const quotationDetails = await createQuotationNewHelper(data)
                            // const quotationDetails = await createQuotationNew(data)

                            console.log(quotationDetails, "quotationDetails")
                            if (quotationDetails?.status) {

                                console.log(quotationDetails, "quotationDetails");

                                instaChatbot.intl_exchngrate_token = quotationDetails?.token;
                                instaChatbot.intl_quotation_id = quotationDetails?.QuotationID
                                await instaChatbot.save();

                                const message = `
                                    ${lang[selectedLanguage].CONFIRM_SEND_MESSAGE} ${formattedAmount(instaChatbot?.intl_amount?.toFixed(2))} ${senderWallet?.currency.code} ${lang[selectedLanguage].TO} ${benefName}?
                                    `;

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].YES_CONTINUE_TITLE, payload: "intl_confirm_beneficiary" },
                                    { content_type: "text", title: lang[selectedLanguage].CHANGE_BENEFICIARY, payload: "intl_no_attch" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];
                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            }
                            else if (quotationDetails?.message === "Differences in exchange rates") {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].SEND_ANOTHER, payload: "intl_transfer" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];

                                const message = `There has been exchange rate differences. Please try again.`
                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            }
                            else {
                                await paymentErrorMessage(selectedLanguage, entry.messaging[0])
                            }


                        }
                        else if (quick_reply?.payload === "intl_confirm_beneficiary") {
                            const user = await User.findOne({ account: account._id })
                            const beneficiary = await Beneficiary.findById(instaChatbot?.intl_benef_id);

                            const data = {
                                wallet_id: instaChatbot?.intl_sending_currency,
                                additional_information: instaChatbot.intl.intl_note || "Others",
                                purpose_of_remittance: instaChatbot.intl.purpose, //  addhere
                                user_id: user._id,
                                beneficiary_id: instaChatbot?.intl_benef_id,
                                service: {
                                    id: parseInt(instaChatbot?.intl_payout_method)
                                },
                                bank_id: beneficiary?.bank_details[0]?._id ?? "",
                                mobile_wallet_id: beneficiary?.mobile_wallet[0]?._id ?? "",
                                transaction_type: beneficiary?.beneficiary_type === "individual" ? "C2C" : "B2C",
                                token: instaChatbot?.intl_exchngrate_token,
                                Quotation_ID: instaChatbot?.intl_quotation_id

                            }
                            console.log(data, "datainsidecreatetransa");

                            const createTransactionDetails = await createTransaction(data)
                            if (createTransactionDetails?.status) {
                                // const exchangeRates = await getPayerRates({ payerId: instaChatbot.intl_payer_id, wallet_id: instaChatbot?.intl_sending_currency.toString(), transaction_type: "C2C", amount: instaChatbot?.intl_amount })
                                // const exchangeRate = exchangeRates?.rates?.result;
                                // const exchangedRates = await getExchangeRates({ payerId: instaChatbot.intl_payer_id, wallet_id: instaChatbot?.intl_sending_currency.toString(), transaction_type: "C2C", amount: instaChatbot?.intl_amount, payout_method: instaChatbot.intl_payout_method, iso_code: instaChatbot?.intl_country_code })

                                let channel_name, service_name;
                                if (instaChatbot.intl_payout_method === "1") {
                                    channel_name = "mobile_money";
                                    service_name = "international_mobile_wallet";
                                } else {
                                    channel_name = "bank_account";
                                    service_name = "international_bank_transfer";
                                }

                                const walletDetails = await Wallet.findById(instaChatbot?.intl_sending_currency)
                                const ratesData = {
                                    transaction_type: "C2C",
                                    wallet_id: instaChatbot?.intl_sending_currency.toString(),
                                    amount: instaChatbot.intl_amount,
                                    service_id: instaChatbot.intl_payout_method,
                                    channel_name,
                                    service_name,
                                    payerId: instaChatbot.intl_payer_id,
                                    iso_code: instaChatbot.intl_country_code,
                                    currency_code: walletDetails.currency.code,
                                    payment_method: "wallet",
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
                                        const payerList = await getPayerNames(instaChatbot.intl_payout_method, instaChatbot?.intl_country_code)

                                        const payerChannel = payerList?.servicesWithIds?.filter((item) => {
                                            return item.id.toString() === instaChatbot.intl_payer_id
                                        })
                                        message = lang[selectedLanguage].UNABLE_TO_SEND.replace(
                                            "{{payerName}}",
                                            payerChannel[0].name
                                        );
                                    } else {
                                        message = lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR
                                    }

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");

                                }
                                const payerList = await getPayerNames(instaChatbot.intl_payout_method, instaChatbot?.intl_country_code)

                                const payerChannel = payerList?.servicesWithIds?.filter((item) => {
                                    return item.id.toString() === instaChatbot.intl_payer_id
                                })
                                // text is the payout channel number, 15 is the max limit of searching the payout channels
                                // const payoutChannelName = getPayoutChannelName(payerList, instaChatbot?.intl_payout_channel, 15)
                                const beneficiary = await Beneficiary.findById(instaChatbot?.intl_benef_id)

                                //                                 const message = `
                                // ${lang[selectedLanguage].REVIEW_TRANSACTION_DETAILS}

                                // ${lang[selectedLanguage].COUNTRY}: ${instaChatbot?.intl_country}
                                // ${lang[selectedLanguage].BANK}: ${payerChannel[0].name}
                                // ${lang[selectedLanguage].BENEFICIARY}: ${beneficiary?.first_name} ${beneficiary?.last_name}

                                // ${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(instaChatbot?.intl_amount?.toFixed(2))} ${exchangeRate?.wallet_currency}
                                // ${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${exchangeRate?.wallet_currency} = ${exchangeRate?.exchange_rate}${exchangeRate?.destination_currency}
                                // ${lang[selectedLanguage].FEE}: ${exchangeRate?.fee?.toFixed(2)} ${exchangeRate?.wallet_currency}

                                // ${lang[selectedLanguage].BENEFICIARY_GETS}: ${exchangeRate?.converted_amount} ${exchangeRate?.destination_currency}

                                // ${lang[selectedLanguage].TOTAL_AMOUNT}: ${exchangeRate?.total?.toFixed(2)} ${exchangeRate?.wallet_currency}
                                // `;
                                const message = `
${lang[selectedLanguage].REVIEW_TRANSACTION_DETAILS}

${lang[selectedLanguage].COUNTRY}: ${instaChatbot?.intl_country}
${lang[selectedLanguage].PAYMENT_METHOD}: ${instaChatbot?.intl_payout_method === "1" ? lang[selectedLanguage].MOBILE_WALLET : lang[selectedLanguage].BANK_ACCOUNT}
${lang[selectedLanguage].PAYER_NAME}: ${payerChannel[0]?.name || "N/A"}
${lang[selectedLanguage].BENEFICIARY}: ${beneficiary?.first_name} ${beneficiary?.last_name}

${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(rates.total.value)} ${rates.total.currency}
${rates.total.currency !== rates.exchanged_rate.currency ? `${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${rates.total.currency} = ${formattedAmount(rates.exchanged_rate.value, 6)} ${rates.exchanged_rate.currency}\n` : ''}
${lang[selectedLanguage].FEE}: ${formattedAmount(rates.fee.value)} ${rates.total.currency}

${lang[selectedLanguage].BENEFICIARY_GETS}: ${formattedAmount(rates.recipient.value)} ${rates.exchanged_rate.currency}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(rates.total.value)} ${rates.total.currency}
`;
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].CONFIRM_TRANSACTION, payload: "intl_confirm_transaction" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];
                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                                instaChatbot.intl_exchngrate_token = createTransactionDetails?.token;
                                await instaChatbot.save()
                            } else {
                                await paymentErrorMessage(selectedLanguage, entry.messaging[0])
                            }
                        }
                        else if (quick_reply?.payload === "add_beneficiary") {
                            const message = lang[selectedLanguage].ADD_BENEFICIARY_MESSAGE
                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: message,
                                        buttons: [
                                            {
                                                type: "web_url",
                                                title: lang[selectedLanguage].LOGIN,
                                                url: `https://my.insta-pay.ch/login`,
                                                webview_height_ratio: "full"
                                            },
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                payload: "main_menu",
                                            },

                                        ],
                                    },

                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                        }
                        else if (quick_reply?.payload === "intl_confirm_transaction") {

                            await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_intl", "4.3.5", "Transaction OTP");
                        }
                        // if user has entered the otp for confirming the transaction
                        else if (instaChatbot?.last_message === "4.3.5" && text && !quick_reply?.payload) {
                            const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "confirm_intl");

                            if (otpValidationResult.status) {


                                const confirmTransactionDetails = await confirmTransaction(instaChatbot.intl_exchngrate_token, instaChatbot.intl, false);
                                console.log(confirmTransactionDetails)

                                if (confirmTransactionDetails.status) {
                                    const subtitles = `
${lang[selectedLanguage].TID} ${confirmTransactionDetails?.message?.TransactionID}
${lang[selectedLanguage].BENEFICIARY}: ${confirmTransactionDetails?.message?.beneficiary?.firstname || "N/A"} ${confirmTransactionDetails?.message?.beneficiary?.lastname || "N/A"}
${lang[selectedLanguage].STATUS}: ${lang[selectedLanguage].PROCESSING}
                                `
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: lang[selectedLanguage].PAYMENT_SUCCESS_INTL
                                                    .replace("{{amount}}", formattedAmount(confirmTransactionDetails?.message?.total?.toFixed(2)))
                                                    .replace("{{currency}}", confirmTransactionDetails?.message?.currency_code),
                                                subtitle: subtitles,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: "main_menu",
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: "Track Status",
                                                        payload: "my_transactions",
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                    instaChatbot.flowFlag = false;
                                    instaChatbot.flowId = "";
                                    instaChatbot.intl = {}
                                    await instaChatbot.save()
                                } else {
                                    console.log("did i ran")
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: lang[selectedLanguage].TRANSACTION_FAILED,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/System%20Error.png",
                                                subtitle: lang[selectedLanguage].TRY_AGAIN_OR_CONTACT_SUPPORT_SUBTITLE,
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: "main_menu",
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                    instaChatbot.flowFlag = false;
                                    instaChatbot.flowId = "";
                                    instaChatbot.intl = {}
                                    await instaChatbot.save()
                                }

                            }
                            else {
                                if (otpValidationResult.message === "max_attempts_exceeded") {

                                    await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                                } else {

                                    await invalidMessage(entry.messaging[0], "confirm_intl", selectedLanguage, instaChatbot?.otpType);
                                }
                            }
                        }

                        // INTERNATIOL -TRANSFER ENDED //
                        // INVITE SOMEONE FLOW //
                        // user has proceeded with invite someone
                        else if (quick_reply?.payload === "benef_invite_req") {
                            instaChatbot.invitation.message = ""
                            await instaChatbot.save()
                            const message = lang[selectedLanguage].INVITE_MESSAGE
                            const quickReplies = [
                                { content_type: "text", title: `📞 ${lang[selectedLanguage].PHONE_NUMBER_TITLE}`, payload: "invite_phone" },
                                { content_type: "text", title: `📧 ${lang[selectedLanguage].EMAIL_TITLE}`, payload: "invite_email" }]

                            await quickReply(entry.messaging[0], message, quickReplies, "4");
                        }
                        // user has selected phone number
                        else if (quick_reply?.payload === "invite_phone") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].INPUT_PHONE_NUMBER, "CONFIRMED_EVENT_UPDATE", "5.1.1")
                        }
                        // user has entered phone number
                        else if (instaChatbot?.last_message === "5.1.1" && !quick_reply?.payload && text) {
                            const phoneRegex = /^\+\d{6,14}\d$/;
                            if (phoneRegex.test(text)) {
                                instaChatbot.invitation.phone = text
                                await instaChatbot.save()
                                const message = `
${lang[selectedLanguage].INVITE_MESSAGE_TITLE}\n\nmy.insta-pay.ch/auth/signup/${account?.username}
                                `
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].SEND_INVITATION, payload: "invite_phone_proc" },
                                    { content_type: "text", title: lang[selectedLanguage].PERSONALIZE_MESSAGE, payload: "prsnlz_msg" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ]

                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_PHONE, "CONFIRMED_EVENT_UPDATE")
                            }
                        }
                        else if (quick_reply?.payload === "invite_phone_proc") {
                            let message;
                            if (instaChatbot.invitation.message) {
                                message = instaChatbot.invitation.message + "\n\n" + `my.insta-pay.ch/auth/signup/${account?.username}`
                            } else {
                                message = `${lang[selectedLanguage].INVITE_MESSAGE_TITLE}\n\nmy.insta-pay.ch/auth/signup/${account?.username}`
                            }
                            const check = await sendSMSTemplate(instaChatbot.invitation.phone, message);
                            console.log(check, "check")
                            let templatePayload
                            if (check) {
                                templatePayload = {
                                    template_type: "generic",
                                    elements: [
                                        {
                                            title: lang[selectedLanguage].INVITATION_SENT.replace("{{number}}", instaChatbot?.invitation?.phone),
                                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Request%20A%20Quote.png",
                                            buttons: [
                                                {
                                                    type: "postback",
                                                    title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                    payload: "main_menu",
                                                },
                                            ],
                                        },
                                    ]
                                };
                            } else {
                                templatePayload = {
                                    template_type: "generic",
                                    elements: [
                                        {
                                            title: lang[selectedLanguage].INVITE_ERROR.replace("{{number}}", instaChatbot?.invitation?.phone),
                                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/System%20Error.png",
                                            buttons: [
                                                {
                                                    type: "postback",
                                                    title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                    payload: "main_menu",
                                                },
                                            ],
                                        },
                                    ]
                                };
                            }
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                            if (check) {
                                await referralTxt(entry.messaging[0], messaging?.sender?.id, selectedLanguage)
                            }

                            instaChatbot.flowFlag = false;
                            instaChatbot.flowId = "";
                            await instaChatbot.save()
                        }
                        // user has selected a personalize message option
                        else if (quick_reply?.payload === "prsnlz_msg") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].PERSONALIZED_MESSAGE, "CONFIRMED_EVENT_UPDATE", "5.1.2")
                        }
                        // user has typed personalized message
                        else if (instaChatbot?.last_message === "5.1.2" && !quick_reply?.payload && text) {
                            if (text.length > 110) {
                                const message1 = lang[selectedLanguage].SHORTEN_MESSAGE
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].ENTER_AGAIN, payload: "prsnlz_msg" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ]
                                return await quickReply(entry.messaging[0], message1, quickReplies)
                            }
                            instaChatbot.invitation.message = text
                            await instaChatbot.save()

                            const message = `
${lang[selectedLanguage].PERSONALIZED_MESSAGE_PREVIEW}

${text}

my.insta-pay.ch/auth/signup/${account?.username}
                            `
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].EDIT, payload: "prsnlz_msg" },
                                { content_type: "text", title: lang[selectedLanguage].SEND_INVITATION, payload: "invite_phone_proc" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                            ]

                            await quickReply(entry.messaging[0], message, quickReplies, "4");
                        }
                        // user has selected email
                        else if (quick_reply?.payload === "invite_email") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].INPUT_EMAIL_INVITE, "CONFIRMED_EVENT_UPDATE", "5.2.1");
                        }
                        // user has entered email
                        else if (instaChatbot?.last_message === "5.2.1" && !quick_reply?.payload && text) {
                            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                            if (emailRegex.test(text)) {

                                const message = `
${lang[selectedLanguage].INVITE_MESSAGE_TITLE}

my.insta-pay.ch/auth/signup/${account?.username}
        `;
                                instaChatbot.invitation.email = text;
                                await instaChatbot.save();
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].SEND_INVITATION, payload: "invite_email_proc" },
                                    { content_type: "text", title: lang[selectedLanguage].PERSONALIZE_MESSAGE, payload: "prsnlz_msg_email" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];
                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_EMAIL, "CONFIRMED_EVENT_UPDATE");
                            }
                        }
                        else if (quick_reply?.payload === "invite_email_proc") {
                            let message;
                            if (instaChatbot.invitation.message) {
                                message = instaChatbot.invitation.message + "\n\nmy.insta-pay.ch/auth/signup/" + account?.username
                            } else {
                                message = `${lang[selectedLanguage].INVITE_MESSAGE_TITLE}\n\nmy.insta-pay.ch/auth/signup/${account?.username}`
                            }

                            const check = await sendMails(instaChatbot?.invitation?.email, message, "InstaPay Invitation")
                            // const check = await sendMailsExport(instaChatbot?.invitation?.email, message, "InstaPay Invitation", templateId = "", {})
                            let templatePayload
                            if (check) {
                                templatePayload = {
                                    template_type: "generic",
                                    elements: [
                                        {
                                            title: lang[selectedLanguage].INVITATION_SENT.replace("{{number}}", instaChatbot?.invitation?.email),
                                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Request%20A%20Quote.png",
                                            buttons: [
                                                {
                                                    type: "postback",
                                                    title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                    payload: "main_menu",
                                                },
                                            ],
                                        },
                                    ]
                                };
                            } else {
                                templatePayload = {
                                    template_type: "generic",
                                    elements: [
                                        {
                                            title: lang[selectedLanguage].INVITE_ERROR.replace("{{number}}", instaChatbot?.invitation?.email),
                                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/System%20Error.png",
                                            buttons: [
                                                {
                                                    type: "postback",
                                                    title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                    payload: "main_menu",
                                                },
                                            ],
                                        },
                                    ]
                                };
                            }
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4");
                            if (check) {
                                await referralTxt(entry.messaging[0], messaging?.sender?.id, selectedLanguage)
                            }

                            instaChatbot.flowFlag = false;
                            instaChatbot.flowId = "";
                            await instaChatbot.save()

                        }
                        // user has selected to personalize email message
                        else if (quick_reply?.payload === "prsnlz_msg_email") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].PERSONALIZED_MESSAGE, "CONFIRMED_EVENT_UPDATE", "5.2.2");
                        }

                        // user has typed personalized email message
                        else if (instaChatbot?.last_message === "5.2.2" && !quick_reply?.payload && text) {
                            if (text.length > 500) {
                                const message1 = lang[selectedLanguage].SHORTEN_MESSAGE
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].ENTER_AGAIN, payload: "prsnlz_msg_email" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ]
                                return await quickReply(entry.messaging[0], message1, quickReplies)
                            }
                            instaChatbot.invitation.message = text;
                            await instaChatbot.save();
                            const message = `
${lang[selectedLanguage].PERSONALIZED_EMAIL_PREVIEW}

${text}

my.insta-pay.ch/auth/signup/${account?.username}
    `;
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].EDIT, payload: "prsnlz_msg_email" },
                                { content_type: "text", title: lang[selectedLanguage].SEND_INVITATION, payload: "invite_email_proc" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                            ];
                            await quickReply(entry.messaging[0], message, quickReplies, "4");
                        }
                        // INVITE SOMEONE FLOW END
                        ///////////////////////////////////

                        //--- INITIATE-PAYMENT --- => --- REQUEST-MONEY ---//
                        else if ((quick_reply?.payload === "request_money" || messaging?.postback?.payload === "request_money")) {
                            instaChatbot.flowFlag = true;
                            instaChatbot.flowId = "req_mon";
                            instaChatbot.payment_request = {}
                            await instaChatbot.save();
                            await handleBeneficiariesRequest(account, entry, "5.1", "pay_req", selectedLanguage, 1);
                        }
                        else if (quick_reply?.payload.startsWith("pay_req_next_") || quick_reply?.payload.startsWith("pay_req_prev_")) {
                            const pageNumber = parseInt(quick_reply.payload.split("_").pop());
                            await handleBeneficiariesRequest(account, entry, "5.1", "pay_req", selectedLanguage, pageNumber);
                        }
                        // user has selected benef from quick reply for reques payment
                        else if (quick_reply?.payload.includes("pay_req-")) {
                            const benefId = quick_reply?.payload.split("-")[1]
                            console.log(benefId)
                            const benefDetails = await Beneficiary.findById(benefId);
                            const benefAccount = await Account.findOne({ phone: benefDetails?.phone })

                            if (benefAccount?._id?.toString() === account?._id?.toString()) {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                return await quickReply(entry.messaging[0], lang[selectedLanguage].SEND_MONEY_TO_SELF, quickReplies)
                            }

                            console.log(benefDetails)
                            const reviews = await getReviewsBySeller(benefAccount?._id)
                            let userReviews
                            if (reviews?.status) {
                                userReviews = reviews?.message?.slice(0, 3)?.map((review) => {
                                    return `💎 ${review.comment}`
                                })
                            }
                            console.log(reviews, userReviews)
                            const formattedUserReviews = userReviews ? userReviews.join('\n') : '';

                            const subtitleMsg = `
${lang[selectedLanguage].BENEFICIARY_NAME}: ${benefDetails?.first_name} ${benefDetails?.last_name},
${lang[selectedLanguage].BENEFICIARY_COUNTRY}: ${benefDetails.country_name}
`;
                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: `${benefAccount?.first_name} ${benefAccount?.last_name} `,
                                        image_url: benefAccount?.profileImage?.url,
                                        subtitle: subtitleMsg,
                                        buttons: [
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].CONTINUE,
                                                payload: `cont_benef_req`,
                                            },
                                            {
                                                type: "web_url",
                                                title: lang[selectedLanguage].VIEW_PROFILE_BUTTON,
                                                url: `https://my.insta-pay.ch/profile/${benefAccount.username}`,
                                                webview_height_ratio: "full"
                                            },

                                        ],
                                    },
                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")

                            const accountDetails = `
${userReviews ? `Some recent reviews:` : lang[selectedLanguage].SELECT_OPTION}`;

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].SELECT_ANOTHER, payload: "request_money" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }
                            ]

                            if (userReviews) {
                                await quickMessage(entry.messaging[0], `${accountDetails}`, "CONFIRMED_EVENT_UPDATE");

                                userReviews?.forEach(async (review, index) => {
                                    await quickReply(entry.messaging[0], `${review}`, quickReplies, "4");

                                })
                            } else {
                                await quickReply(entry.messaging[0], `${accountDetails}`, quickReplies, "4");
                            }

                            instaChatbot.request_details.beneficiary = benefAccount?._id;
                            await instaChatbot.save()
                        }
                        // instead of choosing beneficiary from quick replies, user has entered some account info: username, email, phone
                        else if (instaChatbot?.last_message === "5.1" && text && !quick_reply?.payload) {
                            const user = await Account.findOne({
                                $or: [
                                    { username: { $regex: new RegExp(text, "i") } },
                                    { email: { $regex: new RegExp(text, "i") } },
                                    { phone: { $regex: new RegExp(text, "i") } },
                                    { insta_username: { $regex: new RegExp(text, "i") } }
                                ]
                            }).populate(["user", "company"]);
                            if (user) {
                                if (user?._id?.toString() === account?._id?.toString()) {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]
                                    return await quickReply(entry.messaging[0], lang[selectedLanguage].SEND_MONEY_TO_SELF, quickReplies)
                                }
                                const reviews = await getReviewsBySeller(user?._id)
                                const subtitleMsg = `
${lang[selectedLanguage].USERNAME}: ${user.username}
${lang[selectedLanguage].COUNTRY}: ${user.country_name}
`;
                                const templatePayload = {
                                    template_type: "generic",
                                    elements: [
                                        {
                                            title: `${user?.user?.first_name} ${user?.user?.last_name} `,
                                            image_url: user?.profileImage?.url,
                                            subtitle: subtitleMsg,
                                            buttons: [
                                                {
                                                    type: "postback",
                                                    title: lang[selectedLanguage].CONTINUE,
                                                    payload: `cont_benef_req`,
                                                },
                                                {
                                                    type: "web_url",
                                                    title: lang[selectedLanguage].VIEW_PROFILE_BUTTON,
                                                    url: `https://my.insta-pay.ch/profile/${user.username}`,
                                                    webview_height_ratio: "full"
                                                },

                                            ],
                                        },
                                    ]
                                };
                                await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                let userReviews
                                if (reviews?.status) {
                                    userReviews = reviews?.message?.slice(0, 3)?.map((review) => {
                                        return `💎 ${review.comment}`
                                    })
                                }
                                console.log(reviews, userReviews)

                                const formattedUserReviews = userReviews ? userReviews.join('\n') : '';

                                console.log(formattedUserReviews, "formattedUserReviews")

                                const accountDetails = `
${userReviews ? `Some recent reviews:` : lang[selectedLanguage].SELECT_OPTION}`;

                                // userReviews?.forEach(async (review, index) => {
                                //     await quickMessage(entry.messaging[0], `${review}`, "CONFIRMED_EVENT_UPDATE");

                                // })

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].SELECT_ANOTHER, payload: "request_money" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }
                                ]

                                if (userReviews) {
                                    await quickMessage(entry.messaging[0], `${accountDetails}`, "CONFIRMED_EVENT_UPDATE");

                                    userReviews?.forEach(async (review, index) => {
                                        await quickReply(entry.messaging[0], `${review}`, quickReplies, "4");

                                    })
                                } else {
                                    await quickReply(entry.messaging[0], `${accountDetails}`, quickReplies, "4");
                                }
                                instaChatbot.request_details.beneficiary = user?._id;
                                await instaChatbot.save()
                            } else {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].SELECT_ANOTHER, payload: "request_money" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }]

                                await quickReply(entry.messaging[0], lang[selectedLanguage].INVALID_USER, quickReplies, "4");
                            }
                        }
                        // user has confirmed the benef
                        else if (quick_reply?.payload === "cont_benef_req" || messaging?.postback?.payload === "cont_benef_req") {
                            const wallets = await Wallet.find({ account: account._id, wallet_type: 'insta', status: "active" });
                            const slicedWallets = wallets.slice(0, 8)

                            const quickReplies = slicedWallets?.map((wallet) => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `pay_req_w-${wallet._id}` } })
                            console.log(quickReplies, 'quickReplies')
                            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })
                            await quickReply(entry.messaging[0], lang[selectedLanguage].RECEIVE_CURRENCY_PROMPT, quickReplies, "4");
                        }
                        // user has selected the wallet
                        else if (quick_reply?.payload.includes("pay_req_w-")) {
                            const wallet_id = quick_reply?.payload.split("-")[1]
                            console.log(wallet_id, "wallet_id")
                            instaChatbot.request_details.requesting_wallet = wallet_id
                            await instaChatbot.save();

                            // const walletDetails = await Wallet.findById(wallet_id);

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].ANOTHER_WALLET_TITLE, payload: "cont_benef_req" },
                                // { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "send_money" },
                                // { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]

                            await quickReply(entry.messaging[0], lang[selectedLanguage].ENTER_AMOUNT, quickReplies, "5.2");

                        }
                        // user has entered some amount to request
                        else if (instaChatbot?.last_message === "5.2" && text && !quick_reply?.payload) {
                            const digitRegex = /^\d+(\.\d+)?$/;
                            const isNumber = digitRegex.test(text)
                            const amount = parseFloat(text);
                            // const walletDetails = await Wallet.findById(instaChatbot?.request_details?.requesting_wallet);
                            if (isNumber && amount >= 0.1) {

                                // receiver's account balance check
                                const receivingWallet = await Wallet.findById(instaChatbot.request_details.requesting_wallet)
                                const receiverBalanceCheck = await balanceLimitCheck(amount, account, receivingWallet);
                                console.log({ receiverBalanceCheck })

                                if (!receiverBalanceCheck?.status && receiverBalanceCheck?.remainingBalance) {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ];
                                    if (account.level.level_no === 1) {
                                        quickReplies.push({ content_type: "text", title: "Identity Verification", payload: "kyc_verification" },)
                                        await quickReply(entry.messaging[0], `Completing this transaction will exceed your balance limit. Your remaining balance is ${formattedAmount(receiverBalanceCheck?.remainingBalance)} ${receivingWallet?.currency.code}. Please enter an amount within your balance limit or complete KYC verification to increase your balance limit.`, quickReplies);
                                    } else {
                                        await quickReply(entry.messaging[0], `Completing this transaction will exceed your balance limit. Your remaining balance is ${formattedAmount(receiverBalanceCheck?.remainingBalance)} ${receivingWallet?.currency.code}. Please enter an amount within your balance limit.`, quickReplies);
                                    }
                                    return
                                } else if (!receiverBalanceCheck?.status) {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ];

                                    await quickReply(entry.messaging[0], `Something went wrong while checking your balance limit. Please try again.`, quickReplies);
                                    return
                                }
                                instaChatbot.request_details.request_amount = amount;
                                await instaChatbot.save();

                                await quickMessage(entry.messaging[0], lang[selectedLanguage].TRANSACTION_TYPE, "CONFIRMED_EVENT_UPDATE", "4");
                                await sendRequestPaymentTemplate(entry.messaging[0], messaging?.sender?.id, selectedLanguage)

                            } else if (amount <= 0.1) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].MINIMUM_AMOUNT, "CONFIRMED_EVENT_UPDATE");
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_AMOUNT_DIGITS, "CONFIRMED_EVENT_UPDATE");
                            }
                        }
                        // user has selected instant
                        else if (messaging?.postback?.payload === "req_instant") {
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].ADD_NOTE_BUTTON, payload: "req_money_note" },
                                { content_type: "text", title: lang[selectedLanguage].ATTACH_DOCUMENT_BUTTON, payload: "req_money_document" },
                                { content_type: "text", title: lang[selectedLanguage].SKIP, payload: "skip_req_instant" },
                            ];

                            await quickReply(entry.messaging[0], lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, quickReplies, "4");
                        }
                        // ask user to enter a note for request
                        else if (messaging?.postback?.payload === "req_money_note" || quick_reply?.payload === "req_money_note") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].TYPE_MESSAGE, "CONFIRMED_EVENT_UPDATE", "5.3.1");
                        }
                        // user has entered a text as a note for the request
                        else if (instaChatbot?.last_message === "5.3.1" && text && !quick_reply?.payload) {
                            instaChatbot.request_details.desc = text;
                            await instaChatbot.save()

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].YES, payload: "pm_req_add_attch" },
                                { content_type: "text", title: lang[selectedLanguage].NO, payload: "pm_req_no_attch" },
                            ]

                            await quickReply(entry.messaging[0], lang[selectedLanguage].ATTACH_DOCUMENT, quickReplies, "4");

                        }
                        // user has also proceeded with adding an attachement
                        else if (quick_reply?.payload === "pm_req_add_attch") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ATTACH_DOCUMENT_ASK, "CONFIRMED_EVENT_UPDATE", "5.3.1.1");
                        }

                        // if user has entered invalid file type or multiple image files
                        else if ((messaging?.message?.is_unsupported || text) && instaChatbot?.last_message === "5.3.1.1" && !quick_reply?.payload) {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                        }
                        // user has attached an image as a document
                        else if (messaging?.postback?.payload === "req_money_document" || quick_reply?.payload === "req_money_document") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ATTACH_DOCUMENT_PROMPT, "CONFIRMED_EVENT_UPDATE", "5.3.2");
                        }
                        else if (messaging?.message?.attachments && instaChatbot?.last_message === "5.3.2" && !quick_reply?.payload) {
                            const { validCount, allImagesAndVideos } = validateAttachments(messaging.message.attachments);

                            if (!validCount) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].FILE_ATTACHMENT_LIMIT, "CONFIRMED_EVENT_UPDATE");
                                return;
                            }

                            if (allImagesAndVideos) {

                                const uploadedImages = await uploadToS3("payment_request", account._id, messaging.message.attachments);
                                console.log(uploadedImages, "uploadedImages")
                                if (uploadedImages.status) {
                                    for (const image of uploadedImages.uploadedFiles) {
                                        instaChatbot.request_details.attachements.push({
                                            key: image.key,
                                            url: image.url,
                                            ETag: image.ETag
                                        })
                                    }
                                    await instaChatbot.save();
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].YES, payload: "pm_req_add_note" },
                                        { content_type: "text", title: lang[selectedLanguage].NO, payload: "pm_req_no_note" },
                                    ];

                                    await quickReply(entry.messaging[0], 'Do you wish to attach a note to this payment request?', quickReplies, "4");
                                } else {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ];

                                    await quickReply(entry.messaging[0], uploadedImages.message, quickReplies, "4");
                                }
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                            }

                        }
                        // user has uploaded invalid image
                        else if ((messaging?.message?.is_unsupported || text) && instaChatbot?.last_message === "5.3.2" && !quick_reply?.payload) {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                        }
                        // user has proceeded with additional note request
                        else if (quick_reply?.payload === "pm_req_add_note") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].TYPE_MESSAGE, "CONFIRMED_EVENT_UPDATE", "5.3.2.1");
                        }

                        else if (
                            quick_reply?.payload === "skip_req_instant" || quick_reply?.payload === "pm_req_no_attch" || quick_reply?.payload === "pm_req_no_note"
                            || (messaging?.message?.attachments && instaChatbot?.last_message === "5.3.1.1" && !quick_reply?.payload)
                            || (instaChatbot?.last_message === "5.3.2.1" && text && !quick_reply?.payload)
                        ) {
                            // If the user has entered a note
                            if (text && !quick_reply?.payload) {
                                instaChatbot.request_details.desc = text;
                                await instaChatbot.save()
                            }

                            // if user has attached a document
                            if (messaging?.message?.attachments && !quick_reply?.payload) {
                                const { validCount, allImagesAndVideos } = validateAttachments(messaging.message.attachments);

                                if (!validCount) {
                                    await quickMessage(entry.messaging[0], lang[selectedLanguage].FILE_ATTACHMENT_LIMIT, "CONFIRMED_EVENT_UPDATE");
                                    return;
                                }

                                if (allImagesAndVideos) {
                                    const uploadedImages = await uploadToS3("payment_request", account._id, messaging.message.attachments);
                                    console.log(uploadedImages, "uploadedImages")
                                    if (uploadedImages.status) {
                                        for (const image of uploadedImages.uploadedFiles) {
                                            instaChatbot.request_details.attachements.push({
                                                key: image.key,
                                                url: image.url,
                                                ETag: image.ETag
                                            })
                                        }
                                        await instaChatbot.save();
                                    }
                                    else {
                                        const quickReplies = [
                                            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                        ];

                                        await quickReply(entry.messaging[0], uploadedImages.message, quickReplies);
                                        return;
                                    }
                                } else {
                                    await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                                    return;
                                }

                            }
                            const walletDetails = await Wallet.findById(instaChatbot?.request_details?.requesting_wallet);
                            const receiverDetails = await Account.findById(instaChatbot?.request_details?.beneficiary).populate(['user', 'company'])

                            const userName = receiverDetails?.account_type === "individual" ? receiverDetails?.user?.first_name + " " + receiverDetails?.user?.last_name : receiverDetails?.company?.company_name

                            const message = `
${lang[selectedLanguage].INITIATING_REQUEST
                                    .replace("{{amount}}", formattedAmount(instaChatbot?.request_details?.request_amount?.toFixed(2)))
                                    .replace("{{currency}}", walletDetails?.currency?.code)
                                    .replace("{{name}}", userName)}

${lang[selectedLanguage].PROCEED}
                            `

                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: message,
                                        buttons: [
                                            {
                                                type: "postback",
                                                title: "Confirm",
                                                payload: 'confirm_req_instant',
                                            },
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MAIN_MENU,
                                                payload: 'main_menu',
                                            },
                                        ],
                                    },
                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")

                        }

                        // user has proceeded with the payment request, so proceeding with the map selection
                        else if (messaging?.postback?.payload === "confirm_req_instant") {

                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: lang[selectedLanguage].SEND_PAYMENT_REQUEST,
                                        buttons: [
                                            {
                                                type: "web_url",
                                                title: lang[selectedLanguage].SHARE_LOCATION,
                                                url: `https://my.insta-pay.ch/chatbot/get-location?recipient_id=${messaging?.sender?.id}`,
                                                webview_height_ratio: "full"
                                            },
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].CANCEL,
                                                payload: 'main_menu',
                                            },
                                        ],
                                    },
                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "location_selection")
                        }

                        else if (messaging?.postback?.payload === "proceed_request_location" && instaChatbot?.last_message === "location_selection") {
                            await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "proceed_req_instant", "5.4", "Transaction OTP");
                        }

                        // user has sent instant payment request
                        else if ((instaChatbot?.last_message === "5.4" && text && !quick_reply?.payload)) {
                            const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "proceed_req_instant");

                            if (otpValidationResult.status) {
                                await processRequestPayment(entry, messaging, account, instaChatbot, selectedLanguage);

                                instaChatbot.flowFlag = false;
                                instaChatbot.flowId = "";
                                await instaChatbot.save()
                            }
                            else {
                                if (otpValidationResult.message === "max_attempts_exceeded") {

                                    await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                                } else {

                                    await invalidMessage(entry.messaging[0], "proceed_req_instant", selectedLanguage, instaChatbot?.otpType);
                                }
                            }
                        }

                        // user has selected subscribed payment request
                        else if (messaging?.postback?.payload === "req_subs" || quick_reply?.payload === 'req_subs') {
                            const token = generateToken(messaging.sender.id, instaChatbot._id);

                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: lang[selectedLanguage].SET_START_DATE,
                                        buttons: [
                                            {
                                                type: "web_url",
                                                title: lang[selectedLanguage].SELECT_DATE_TITLE,
                                                url: `https://my.insta-pay.ch/chatbot/request-subscription/${token}?default=${account?.timezone}`,
                                                webview_height_ratio: "full"
                                            },
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                payload: 'main_menu',
                                            },
                                        ],
                                    },
                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                        }
                        // user has selected scheduled payment request
                        else if (messaging?.postback?.payload === "req_sched" || quick_reply?.payload === 'req_sched') {
                            const token = generateToken(messaging.sender.id, instaChatbot._id);

                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: lang[selectedLanguage].INPUT_DATE_TIME_SCHEDULED_PAYMENT_REQUEST,
                                        buttons: [
                                            {
                                                type: "web_url",
                                                title: lang[selectedLanguage].SELECT_DATE_TIME,
                                                url: `https://my.insta-pay.ch/chatbot/request-scheduled/${token}?default=${account?.timezone}`,
                                                webview_height_ratio: "full"
                                            },
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                payload: 'main_menu',
                                            },
                                        ],
                                    },
                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                        }

                        // subscription code starts from here
                        // user has proceed with cycles
                        else if (quick_reply?.payload === "pr_cycles") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_SUBSCRIPTION_MONTHS, "CONFIRMED_EVENT_UPDATE", "4.2.1.pr");
                        }

                        // user has proceeded with selecting an end date
                        else if (quick_reply?.payload === "pr_end_date") {
                            const token = generateToken(messaging.sender.id, instaChatbot._id);
                            const encryptedDate = await CryptoJS.AES.encrypt(instaChatbot.payment_request.subscriptionDate, "subscription_date_encryption").toString()

                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: lang[selectedLanguage].SELECT_END_DATE_TITLE,
                                        buttons: [
                                            {
                                                type: "web_url",
                                                title: lang[selectedLanguage].SELECT_DATE_TITLE,
                                                url: `https://my.insta-pay.ch/chatbot/subscription-request-end-date/${token}/${encryptedDate}?default=${account?.timezone}`,
                                                webview_height_ratio: "full"
                                            },
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                payload: 'main_menu',
                                            },
                                        ],
                                    },
                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                        }

                        else if (quick_reply?.payload === "pr_until_stop") {
                            instaChatbot.payment_request.subscriptionRequestUntilIStop = true;
                            instaChatbot.payment_request.subscriptionCycles = null;
                            await instaChatbot.save()

                            const beneficiary = await Account.findById(instaChatbot?.request_details?.beneficiary).populate(['user', 'company']);
                            const sendingWalletDetails = await Wallet.findById(instaChatbot?.request_details?.requesting_wallet);
                            const userName = beneficiary?.account_type === "individual" ? beneficiary?.user?.first_name + " " + beneficiary?.user?.last_name : beneficiary?.company?.company_name

                            const message = lang[selectedLanguage].OPEN_ENDED_SUBSCRIPTION_INITIATION
                                .replace("{{amount}}", formattedAmount(instaChatbot?.request_details?.request_amount?.toFixed(2)))
                                .replace("{{currency}}", sendingWalletDetails?.currency?.code)
                                .replace("{{recipient}}", userName)
                                .replace("{{start_date}}", instaChatbot?.payment_request?.subscriptionDate);

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].CONFIRM_TITLE, payload: "pr_until_stop_proceed" },
                                { content_type: "text", title: lang[selectedLanguage].CHANGE_DATE, payload: "req_subs" },
                                { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "cancel_w2w_transs" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]

                            await quickReply(entry.messaging[0], message, quickReplies, "4");
                        }

                        else if (
                            quick_reply?.payload === "pr_until_stop_proceed"
                            || (instaChatbot?.last_message === "4.2.1.pr" && text && !quick_reply?.payload)
                            || quick_reply?.payload === "pr_proceed_subsription_ed"
                        ) {
                            if (quick_reply?.payload === "pr_until_stop_proceed") {
                                console.log("1st ran")
                                instaChatbot.payment_request.subscriptionRequestUntilIStop = true;
                                instaChatbot.payment_request.subscriptionCycles = null;
                                await instaChatbot.save()
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].ADD_NOTE_BUTTON, payload: "pr_subs_note" },
                                    { content_type: "text", title: lang[selectedLanguage].ATTACH_DOCUMENT_BUTTON, payload: "pr_subs_document" },
                                    { content_type: "text", title: lang[selectedLanguage].SKIP, payload: "skip_req_sub" },
                                ];

                                await quickReply(entry.messaging[0], lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, quickReplies, "4");
                            } else if (quick_reply?.payload === "pr_proceed_subsription_ed") {
                                instaChatbot.payment_request.subscriptionCycles = null;
                                instaChatbot.payment_request.subscriptionRequestUntilIStop = null;
                                await instaChatbot.save()
                                console.log("here")
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].ADD_NOTE_BUTTON, payload: "pr_subs_note" },
                                    { content_type: "text", title: lang[selectedLanguage].ATTACH_DOCUMENT_BUTTON, payload: "pr_subs_document" },
                                    { content_type: "text", title: lang[selectedLanguage].SKIP, payload: "skip_req_sub" },
                                ];

                                await quickReply(entry.messaging[0], lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, quickReplies, "4");
                            } else {
                                console.log("2nd ran")
                                const digitRegex = /^\d+$/;
                                const isNumber = digitRegex.test(text)
                                if (isNumber) {
                                    instaChatbot.payment_request.subscriptionCycles = parseInt(text);
                                    instaChatbot.payment_request.subscriptionRequestUntilIStop = null;
                                    await instaChatbot.save()
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].ADD_NOTE_BUTTON, payload: "pr_subs_note" },
                                        { content_type: "text", title: lang[selectedLanguage].ATTACH_DOCUMENT_BUTTON, payload: "pr_subs_document" },
                                        { content_type: "text", title: lang[selectedLanguage].SKIP, payload: "skip_req_sub" },
                                    ];

                                    await quickReply(entry.messaging[0], lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, quickReplies, "4");
                                } else {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].ENTER_AGAIN, payload: "pr_cycles" },
                                        { content_type: "text", title: lang[selectedLanguage].BACK_TITLE, payload: "request_money" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" },
                                    ];

                                    await quickReply(entry.messaging[0], lang[selectedLanguage].INVALID_CYCLES_MESSAGE, quickReplies, "4");
                                }
                            }
                        }
                        // ask user to enter a note for request
                        else if (quick_reply?.payload === "pr_subs_note") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].TYPE_MESSAGE, "CONFIRMED_EVENT_UPDATE", "5.3.1.pr_sb");
                        }
                        // user has entered a text as a note for the request
                        else if (instaChatbot?.last_message === "5.3.1.pr_sb" && text && !quick_reply?.payload) {
                            instaChatbot.request_details.desc = text;
                            await instaChatbot.save()

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].YES, payload: "pr_subs_add_attch" },
                                { content_type: "text", title: lang[selectedLanguage].NO, payload: "pr_subs_no_attch" },
                            ]

                            await quickReply(entry.messaging[0], lang[selectedLanguage].ATTACH_DOCUMENT, quickReplies, "4");

                        }
                        // user has also proceeded with adding an attachement
                        else if (quick_reply?.payload === "pr_subs_add_attch") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ATTACH_DOCUMENT_ASK, "CONFIRMED_EVENT_UPDATE", "5.3.1.1.sub");
                        }

                        // if user has entered invalid file type or multiple image files
                        else if ((messaging?.message?.is_unsupported || text) && instaChatbot?.last_message === "5.3.1.1.sub" && !quick_reply?.payload) {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                        }
                        // user has attached an image as a document
                        else if (quick_reply?.payload === "pr_subs_document") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ATTACH_DOCUMENT_PROMPT, "CONFIRMED_EVENT_UPDATE", "5.3.2.sub");
                        }
                        // else if (messaging?.message?.attachments && instaChatbot?.last_message === "5.3.2.sub") {
                        //     if (instaChatbot?.instabot_connected && !quick_reply?.payload && messaging?.message?.attachments[0]?.type === "image") {
                        //         const quickReplies = [
                        //             { content_type: "text", title: lang[selectedLanguage].YES, payload: "pr_subs_add_note" },
                        //             { content_type: "text", title: lang[selectedLanguage].NO, payload: "pr_subs_no_note" },
                        //         ]

                        //         await quickReply(entry.messaging[0], 'Do you wish to attach a note to this payment request?', quickReplies);
                        //     }
                        // }
                        else if (messaging?.message?.attachments && instaChatbot?.last_message === "5.3.2.sub" && !quick_reply?.payload) {
                            const { validCount, allImagesAndVideos } = validateAttachments(messaging.message.attachments);

                            if (!validCount) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].FILE_ATTACHMENT_LIMIT, "CONFIRMED_EVENT_UPDATE");
                                return;
                            }
                            if (allImagesAndVideos) {

                                const uploadedImages = await uploadToS3("payment_request", account._id, messaging.message.attachments);
                                console.log(uploadedImages, "uploadedImages")
                                if (uploadedImages.status) {
                                    for (const image of uploadedImages.uploadedFiles) {
                                        instaChatbot.request_details.attachements.push({
                                            key: image.key,
                                            url: image.url,
                                            ETag: image.ETag
                                        })
                                    }
                                    await instaChatbot.save();
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].YES, payload: "pr_subs_add_note" },
                                        { content_type: "text", title: lang[selectedLanguage].NO, payload: "pr_subs_no_note" },
                                    ];

                                    await quickReply(entry.messaging[0], 'Do you wish to attach a note to this payment request?', quickReplies, "4");
                                } else {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ];

                                    await quickReply(entry.messaging[0], uploadedImages.message, quickReplies);
                                }
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                            }

                        }
                        // user has uploaded invalid image
                        else if ((messaging?.message?.is_unsupported || text) && instaChatbot?.last_message === "5.3.2.sub" && !quick_reply?.payload) {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                        }

                        // user has proceeded with additional note request
                        else if (quick_reply?.payload === "pr_subs_add_note") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].TYPE_MESSAGE, "CONFIRMED_EVENT_UPDATE", "5.3.2.1.sub");
                        }

                        /////////////////////////////////////////////////////////////////////
                        else if (
                            quick_reply?.payload === "skip_req_sub" || quick_reply?.payload === "pr_subs_no_attch" || quick_reply?.payload === "pr_subs_no_note"
                            || (messaging?.message?.attachments && instaChatbot?.last_message === "5.3.1.1.sub" && !quick_reply?.payload)
                            || (instaChatbot?.last_message === "5.3.2.1.sub" && text && !quick_reply?.payload)
                        ) {

                            if (text) {
                                instaChatbot.request_details.desc = text;
                                await instaChatbot.save()
                            }

                            // if user has attached a document
                            if (messaging?.message?.attachments && !quick_reply?.payload) {
                                const { validCount, allImagesAndVideos } = validateAttachments(messaging.message.attachments);

                                if (!validCount) {
                                    await quickMessage(entry.messaging[0], lang[selectedLanguage].FILE_ATTACHMENT_LIMIT, "CONFIRMED_EVENT_UPDATE");
                                    return;
                                }

                                if (allImagesAndVideos) {
                                    const uploadedImages = await uploadToS3("payment_request", account._id, messaging.message.attachments);
                                    console.log(uploadedImages, "uploadedImages")
                                    if (uploadedImages.status) {
                                        for (const image of uploadedImages.uploadedFiles) {
                                            instaChatbot.request_details.attachements.push({
                                                key: image.key,
                                                url: image.url,
                                                ETag: image.ETag
                                            })
                                        }
                                        await instaChatbot.save();
                                    }
                                    else {
                                        const quickReplies = [
                                            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                        ];

                                        await quickReply(entry.messaging[0], uploadedImages.message, quickReplies);
                                        return;
                                    }
                                } else {
                                    await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                                    return;
                                }

                            }
                            const beneficiary = await Account.findById(instaChatbot?.request_details?.beneficiary).populate(['user', 'company']);
                            const sendingWalletDetails = await Wallet.findById(instaChatbot?.request_details?.requesting_wallet);
                            const userName = beneficiary?.account_type === "individual" ? beneficiary?.user?.first_name + " " + beneficiary?.user?.last_name : beneficiary?.company?.company_name
                            let message;

                            if (instaChatbot?.payment_request?.subscriptionCycles) {

                                message = lang[selectedLanguage].SUBSCRIPTION_INITIATION_DURATION.replace("{{amount}}", formattedAmount(instaChatbot?.request_details?.request_amount?.toFixed(2)))
                                    .replace("{{currency}}", sendingWalletDetails?.currency?.code)
                                    .replace("{{recipient}}", userName)
                                    .replace("{{duration}}", instaChatbot?.payment_request?.subscriptionCycles)
                                    .replace("{{start_date}}", instaChatbot?.payment_request?.subscriptionDate);
                            } else if (instaChatbot?.payment_request?.subscriptionRequestUntilIStop === true) {

                                message = lang[selectedLanguage].OPEN_ENDED_SUBSCRIPTION_INITIATION
                                    .replace("{{amount}}", formattedAmount(instaChatbot?.request_details?.request_amount?.toFixed(2)))
                                    .replace("{{currency}}", sendingWalletDetails?.currency?.code)
                                    .replace("{{recipient}}", userName)
                                    .replace("{{start_date}}", instaChatbot?.payment_request?.subscriptionDate);
                            } else {
                                message = lang[selectedLanguage].SUBSCRIPTION_INITIATION_WITH_END_DATE
                                    .replace("{{amount}}", formattedAmount(instaChatbot?.request_details?.request_amount?.toFixed(2)))
                                    .replace("{{currency}}", sendingWalletDetails?.currency?.code)
                                    .replace("{{recipient}}", userName)
                                    .replace("{{start_date}}", instaChatbot?.payment_request?.subscriptionDate)
                                    .replace("{{end_date}}", instaChatbot?.payment_request?.subscriptionEndDate);
                            }

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].CONFIRM_TITLE, payload: "pr_proceed_subs" },
                                { content_type: "text", title: lang[selectedLanguage].CHANGE_DETAILS, payload: "req_subs" },
                                { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "cancel_w2w_transs" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ];

                            // if (!instaChatbot?.payment_request?.subscriptionCycles || instaChatbot?.payment_request?.subscriptionRequestUntilIStop !== true) {

                            // }

                            await quickReply(entry.messaging[0], message, quickReplies, "4"); // add4here

                        }
                        else if (quick_reply?.payload === "pr_proceed_subs") {
                            await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "pr_confirm_subs", "5.9.2", "Transaction OTP");
                        }
                        // user has entered otp for subscribed payment request
                        else if (instaChatbot?.last_message === "5.9.2" && text && !quick_reply?.payload) {
                            const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "pr_confirm_subs");

                            if (otpValidationResult.status) {
                                const data = {
                                    amount: instaChatbot?.request_details?.request_amount,
                                    wallet_id: instaChatbot?.request_details?.requesting_wallet,
                                    purpose: instaChatbot?.request_details?.purpose ?? "",
                                    sender: account._id,
                                    receiver: instaChatbot?.request_details?.beneficiary,
                                    date: instaChatbot?.payment_request?.subscriptionDate,
                                    next_date: instaChatbot?.payment_request?.subscriptionDate,
                                    nextCycles: instaChatbot?.subscriptionCycles ?? 0,
                                    cycles: instaChatbot?.payment_request.subscriptionCycles,
                                    timezone: instaChatbot?.payment_request?.subscriptionTimezone || account?.timezone,
                                    attachments: instaChatbot.request_details.attachements,
                                    description: instaChatbot.request_details.desc
                                }


                                const subscribeRequestDetails = await subscribeRequestPaymentW2W(data)

                                console.log(subscribeRequestDetails, "subscribeRequestDetails")
                                if (subscribeRequestDetails.status) {

                                    const beneficiary = await Account.findById(instaChatbot?.request_details?.beneficiary).populate(['user', 'company', 'insta_recipient_id']);
                                    const sendingWalletDetails = await Wallet.findById(instaChatbot?.request_details?.requesting_wallet);
                                    const userName = beneficiary?.account_type === "individual" ? beneficiary?.user?.first_name + " " + beneficiary?.user?.last_name : beneficiary?.company?.company_name
                                    // let message, messageRecipient;

                                    //                                     if (instaChatbot?.payment_request?.subscriptionCycles) {
                                    //                                         message = `
                                    // ${lang[selectedLanguage].SUBSCRIPTION_SUCCESS_PREFIX} from ${data.date} ${lang[selectedLanguage].WITH} ${data.cycles} ${lang[selectedLanguage].CYCLES} and of ${formattedAmount(instaChatbot?.request_details?.request_amount?.toFixed(2))} ${sendingWalletDetails?.currency?.code}
                                    //         `;
                                    //                                         messageRecipient = `
                                    // ${account?.username} has set this subscription starting from ${data.date} with ${data.cycles} cycles of ${formattedAmount(instaChatbot?.request_details?.request_amount?.toFixed(2))} ${sendingWalletDetails?.currency?.code}.
                                    //             `;
                                    //                                     } else if (instaChatbot?.payment_request?.subscriptionRequestUntilIStop === true) {
                                    //                                         message = `
                                    // ${lang[selectedLanguage].SUBSCRIPTION_SUCCESS_PREFIX} from ${data.date} to until you stop of ${formattedAmount(instaChatbot?.request_details?.request_amount?.toFixed(2))} ${sendingWalletDetails?.currency?.code}
                                    //         `;
                                    //                                         messageRecipient = `
                                    // ${account?.username} has set this subscription starting from ${data.date} and will continue until it is stopped, for an amount of ${formattedAmount(instaChatbot?.request_details?.request_amount?.toFixed(2))} ${sendingWalletDetails?.currency?.code}.
                                    //             `;
                                    //                                     } else {
                                    //                                         message = `
                                    // ${lang[selectedLanguage].SUBSCRIPTION_SUCCESS_PREFIX} from ${data.date} to ${instaChatbot?.payment_request?.subscriptionEndDate} of ${formattedAmount(instaChatbot?.request_details?.request_amount?.toFixed(2))} ${sendingWalletDetails?.currency?.code}
                                    //         `;
                                    //                                         messageRecipient = `
                                    // ${account?.username} has set this subscription starting from ${data.date} until ${instaChatbot?.payment_request?.subscriptionEndDate}, for an amount of ${formattedAmount(instaChatbot?.request_details?.request_amount?.toFixed(2))} ${sendingWalletDetails?.currency?.code}.
                                    //             `;
                                    //                                     }
                                    const subtitle = `
${lang[selectedLanguage].BENEFICIARY}: ${userName}
From: ${data.date}
${instaChatbot?.payment_request?.subscriptionCycles ? `For: ${instaChatbot?.payment_request?.subscriptionCycles} months` : instaChatbot?.payment_request?.subscriptionEndDate ? `To: ${instaChatbot?.payment_request?.subscriptionEndDate}` : 'To: Until Cancelled'}
${lang[selectedLanguage].STATUS}: ${lang[selectedLanguage].PENDING}                                `

                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `Your subscription payment request of ${formattedAmount(instaChatbot?.request_details?.request_amount?.toFixed(2))} ${sendingWalletDetails?.currency?.code} is all set up.`,
                                                subtitle,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                                                buttons: [

                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: `main_menu`,
                                                    },


                                                ]
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")

                                    if (beneficiary?.insta_recipient_id) {
                                        const receiverLang = beneficiary?.insta_recipient_id?.active_language || beneficiary?.language || "en"
                                        // recipients side message
                                        const subtitle1 = `
${lang[receiverLang].COUNTRY_LABEL}: ${account?.country_name}
From: ${data.date}
${instaChatbot?.payment_request?.subscriptionCycles ? `For: ${instaChatbot?.payment_request?.subscriptionCycles} months` : instaChatbot?.payment_request?.subscriptionEndDate ? `To: ${instaChatbot?.payment_request?.subscriptionEndDate}` : 'For: Until Cancelled'}
${lang[selectedLanguage].STATUS}: ${lang[selectedLanguage].PENDING}`
                                        const templatePayload1 = {
                                            template_type: "generic",
                                            elements: [
                                                {
                                                    title: `${account?.username} has set a subscription payment request of ${formattedAmount(instaChatbot?.request_details?.request_amount?.toFixed(2))} ${sendingWalletDetails?.currency?.code} for you.`,
                                                    image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Subscrption.png",
                                                    subtitle: subtitle1,
                                                    buttons: [
                                                        {
                                                            type: "web_url",
                                                            title: lang[selectedLanguage].VIEW_PROFILE_BUTTON,
                                                            url: `https://my.insta-pay.ch/profile/${account?.username}`,
                                                            webview_height_ratio: "full"
                                                        },
                                                        {
                                                            type: "postback",
                                                            title: lang[selectedLanguage].MAIN_MENU,
                                                            payload: 'main_menu',
                                                        },
                                                    ],
                                                },
                                            ]
                                        };

                                        const data1 = {
                                            sender: { id: beneficiary?.insta_recipient_id?.recipient },
                                        }
                                        await sendTemplate(data1, beneficiary?.insta_recipient_id?.recipient, templatePayload1)
                                    }
                                    instaChatbot.payment_request.subscriptionCycles = null;
                                    instaChatbot.payment_request.subscriptionRequestUntilIStop = null;
                                    instaChatbot.payment_request = {}
                                    instaChatbot.request_details = {}
                                    instaChatbot.flowFlag = false;
                                    instaChatbot.flowId = "";
                                    await instaChatbot.save()


                                } else {
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: lang[selectedLanguage].SOMETHING_WENT_WRONG_REQUEST,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/System%20Error.png",
                                                buttons: [

                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: `main_menu`,
                                                    },


                                                ]
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                    instaChatbot.payment_request.subscriptionCycles = null;
                                    instaChatbot.payment_request.subscriptionRequestUntilIStop = null;
                                    instaChatbot.payment_request = {}
                                    instaChatbot.request_details = {}
                                    instaChatbot.flowFlag = false;
                                    instaChatbot.flowId = "";
                                    await instaChatbot.save()
                                }
                            } else {
                                if (otpValidationResult.message === "max_attempts_exceeded") {

                                    await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                                } else {

                                    await invalidMessage(entry.messaging[0], "pr_confirm_subs", selectedLanguage, instaChatbot?.otpType);
                                }
                            }
                        }
                        // user has proceed with scheduled payment request
                        else if ((messaging?.postback?.payload === "pr_proceed_schedule" || quick_reply?.payload === 'pr_proceed_schedule')) {

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].ADD_NOTE_BUTTON, payload: "schedule_req_note" },
                                { content_type: "text", title: lang[selectedLanguage].ATTACH_DOCUMENT_BUTTON, payload: "schedule_req_document" },
                                { content_type: "text", title: lang[selectedLanguage].SKIP, payload: "schedule_req_skip" },
                            ];

                            await quickReply(entry.messaging[0], lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, quickReplies, "4");
                        }
                        else if (quick_reply?.payload === "schedule_req_note") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].TYPE_MESSAGE, "CONFIRMED_EVENT_UPDATE", "5.3.1.s");
                        }
                        else if (instaChatbot?.last_message === "5.3.1.s" && text && !quick_reply?.payload) {
                            instaChatbot.request_details.desc = text;
                            await instaChatbot.save();

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].YES, payload: "sch_req_add_attch" },
                                { content_type: "text", title: lang[selectedLanguage].NO, payload: "sch_req_no_attch" },
                            ];

                            await quickReply(entry.messaging[0], lang[selectedLanguage].ATTACH_DOCUMENT, quickReplies, "4");

                        }
                        else if (quick_reply?.payload === "sch_req_add_attch") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ATTACH_DOCUMENT_ASK, "CONFIRMED_EVENT_UPDATE", "5.3.2.s");
                        }
                        // user has uploaded invalid image
                        else if ((messaging?.message?.is_unsupported || text) && instaChatbot?.last_message === "5.3.2.s" && !quick_reply?.payload) {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                        }
                        // user has attached an image as a document
                        else if (messaging?.postback?.payload === "schedule_req_document" || quick_reply?.payload === "schedule_req_document") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ATTACH_DOCUMENT_PROMPT, "CONFIRMED_EVENT_UPDATE", "5.3.2.d");
                        }
                        else if (messaging?.message?.attachments && instaChatbot?.last_message === "5.3.2.d" && !quick_reply?.payload) {
                            const { validCount, allImagesAndVideos } = validateAttachments(messaging.message.attachments);

                            if (!validCount) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].FILE_ATTACHMENT_LIMIT, "CONFIRMED_EVENT_UPDATE");
                                return;
                            }
                            if (allImagesAndVideos) {

                                const uploadedImages = await uploadToS3("payment_request", account._id, messaging.message.attachments);
                                console.log(uploadedImages, "uploadedImages")
                                if (uploadedImages.status) {
                                    for (const image of uploadedImages.uploadedFiles) {
                                        instaChatbot.request_details.attachements.push({
                                            key: image.key,
                                            url: image.url,
                                            ETag: image.ETag
                                        })
                                    }
                                    await instaChatbot.save();
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].YES, payload: "pm_sh_req_add_note" },
                                        { content_type: "text", title: lang[selectedLanguage].NO, payload: "pm_sh_req_no_note" },
                                    ];

                                    await quickReply(entry.messaging[0], 'Do you wish to attach a note to this payment request?', quickReplies, "4");
                                } else {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ];

                                    await quickReply(entry.messaging[0], uploadedImages.message, quickReplies);
                                }
                            }
                            else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                            }
                        }
                        // else if (messaging?.message?.attachments && instaChatbot?.last_message === "5.3.2.d") {
                        //     if (instaChatbot?.instabot_connected && !quick_reply?.payload && messaging?.message?.attachments[0]?.type === "image") {
                        //         const quickReplies = [
                        //             { content_type: "text", title: lang[selectedLanguage].YES, payload: "pm_sh_req_add_note" },
                        //             { content_type: "text", title: lang[selectedLanguage].NO, payload: "pm_sh_req_no_note" },
                        //         ]

                        //         await quickReply(entry.messaging[0], 'Do you wish to attach a note to this payment request?', quickReplies);
                        //     }
                        // }
                        // user has uploaded invalid image
                        else if ((messaging?.message?.is_unsupported || text) && instaChatbot?.last_message === "5.3.2.d" && !quick_reply?.payload) {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                        }
                        // user has proceeded with additional note request
                        else if (quick_reply?.payload === "pm_sh_req_add_note") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].TYPE_MESSAGE, "CONFIRMED_EVENT_UPDATE", "5.3.2.n");
                        }
                        // befor otp code
                        else if (
                            quick_reply?.payload === "sch_req_no_attch" || quick_reply?.payload === "schedule_req_skip" || quick_reply?.payload === "pm_sh_req_no_note"
                            || (messaging?.message?.attachments && instaChatbot?.last_message === "5.3.2.s" && !quick_reply?.payload)
                            || (instaChatbot?.last_message === "5.3.2.n" && text && !quick_reply?.payload)
                        ) {
                            if (text) {
                                instaChatbot.request_details.desc = text;
                                await instaChatbot.save()
                            }
                            // if user has attached a document
                            if (messaging?.message?.attachments && !quick_reply?.payload) {
                                const { validCount, allImagesAndVideos } = validateAttachments(messaging.message.attachments);

                                if (!validCount) {
                                    await quickMessage(entry.messaging[0], lang[selectedLanguage].FILE_ATTACHMENT_LIMIT, "CONFIRMED_EVENT_UPDATE");
                                    return;
                                }

                                if (allImagesAndVideos) {
                                    const uploadedImages = await uploadToS3("payment_request", account._id, messaging.message.attachments);
                                    console.log(uploadedImages, "uploadedImages")
                                    if (uploadedImages.status) {
                                        for (const image of uploadedImages.uploadedFiles) {
                                            instaChatbot.request_details.attachements.push({
                                                key: image.key,
                                                url: image.url,
                                                ETag: image.ETag
                                            })
                                        }
                                        await instaChatbot.save();
                                    }
                                    else {
                                        const quickReplies = [
                                            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                        ];

                                        await quickReply(entry.messaging[0], uploadedImages.message, quickReplies);
                                        return;
                                    }
                                } else {
                                    await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                                    return;
                                }

                            }
                            const walletDetails = await Wallet.findById(instaChatbot?.request_details?.requesting_wallet);
                            const receiverDetails = await Account.findById(instaChatbot?.request_details?.beneficiary).populate(['user', 'company'])

                            const userName = receiverDetails?.account_type === "individual" ? receiverDetails?.user?.first_name + " " + receiverDetails?.user?.last_name : receiverDetails?.company?.company_name

                            const message = `
Review your scheduled payment:

${lang[selectedLanguage].BENEFICIARY}: ${userName} 
${lang[selectedLanguage].AMOUNT}: ${formattedAmount(instaChatbot?.request_details?.request_amount?.toFixed(2))} ${walletDetails?.currency?.code}
Date: ${instaChatbot.payment_request.scheduleDate}
Time: ${instaChatbot.payment_request.scheduleTime}

Ready to send it?
                            `

                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: message,
                                        buttons: [
                                            {
                                                type: "postback",
                                                title: "Confirm",
                                                payload: 'confirm_req_sub',
                                            },
                                            {
                                                type: "postback",
                                                title: "Edit Details",
                                                payload: 'req_sched',
                                            },
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MAIN_MENU,
                                                payload: 'main_menu',
                                            },
                                        ],
                                    },
                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload)

                        }

                        else if (messaging?.postback?.payload === "confirm_req_sub") {
                            await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "process_req_sub", "5.9.3", "Transaction OTP");
                        }
                        // user has entered otp for scheduled payment request
                        else if (instaChatbot?.last_message === "5.9.3" && text && !quick_reply?.payload) {
                            const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "process_req_sub");

                            if (otpValidationResult.status) {

                                const data = {
                                    amount: instaChatbot?.request_details?.request_amount,
                                    wallet_id: instaChatbot?.request_details?.requesting_wallet,
                                    purpose: instaChatbot?.request_details?.purpose ?? "",
                                    sender: account._id,
                                    receiver: instaChatbot?.request_details?.beneficiary,
                                    date: instaChatbot?.payment_request?.scheduleDate,
                                    time: instaChatbot?.payment_request?.scheduleTime,
                                    timezone: instaChatbot?.payment_request?.scheduleTimezone || account?.timezone,
                                    attachments: instaChatbot.request_details.attachements,
                                    description: instaChatbot.request_details.desc,
                                }
                                console.log(data, "data")
                                const scheduleRequestDetails = await scheduleRequestPaymentW2W(data)

                                console.log(scheduleRequestDetails, "scheduleRequestDetails")

                                const receiverDetails = await Account.findById(scheduleRequestDetails?.subscribtionDetails?.request_payment?.receiver).populate(['user', 'company', 'insta_recipient_id']);

                                const userName = receiverDetails?.account_type === "individual" ? receiverDetails?.user?.first_name + " " + receiverDetails?.user?.last_name : receiverDetails?.company?.company_name

                                if (scheduleRequestDetails?.status) {
                                    const subtitle = `
${lang[selectedLanguage].BENEFICIARY}: ${userName}
${lang[selectedLanguage].SCHEDULE}: ${scheduleRequestDetails?.subscribtionDetails?.time}, ${scheduleRequestDetails?.subscribtionDetails?.date}
${lang[selectedLanguage].TIMEZONE}: ${instaChatbot?.payment_request?.scheduleTimezone || account?.timezone}
${lang[selectedLanguage].STATUS}: ${lang[selectedLanguage].PENDING}`
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `Your scheduled payment request of ${formattedAmount(scheduleRequestDetails?.subscribtionDetails?.request_payment?.amount?.toFixed(2)) ?? "N/A"} ${scheduleRequestDetails?.subscribtionDetails?.request_payment?.currency?.code ?? "N/A"} is all set up.
`,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Request%20Sent.png",
                                                subtitle,
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU,
                                                        payload: 'main_menu',
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload)

                                    if (receiverDetails?.insta_recipient_id) {
                                        const receiverLang = receiverDetails?.insta_recipient_id?.active_language || receiverDetails?.language || "en"
                                        // recipients side message
                                        const subtitle1 = `
${lang[selectedLanguage].COUNTRY_LABEL}: ${account?.country_name}
${lang[selectedLanguage].SCHEDULE}: ${scheduleRequestDetails?.subscribtionDetails?.time}, ${scheduleRequestDetails?.subscribtionDetails?.date}
${lang[selectedLanguage].TIMEZONE}: ${instaChatbot?.payment_request?.scheduleTimezone || account?.timezone}`
                                        const templatePayload1 = {
                                            template_type: "generic",
                                            elements: [
                                                {
                                                    title: `${account?.username} has set a scheduled payment request of ${formattedAmount(data?.amount)} ${scheduleRequestDetails?.subscribtionDetails?.request_payment?.currency?.code} for you.`,
                                                    image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Schedule%20Payments.png",
                                                    subtitle: subtitle1,
                                                    buttons: [
                                                        {
                                                            type: "web_url",
                                                            title: lang[selectedLanguage].VIEW_PROFILE_BUTTON,
                                                            url: `https://my.insta-pay.ch/profile/${account?.username}`,
                                                            webview_height_ratio: "full"
                                                        },
                                                        {
                                                            type: "postback",
                                                            title: lang[selectedLanguage].MAIN_MENU,
                                                            payload: 'main_menu',
                                                        },
                                                    ],
                                                },
                                            ]
                                        };

                                        const data1 = {
                                            sender: { id: receiverDetails?.insta_recipient_id?.recipient },
                                        }
                                        await sendTemplate(data1, receiverDetails?.insta_recipient_id?.recipient, templatePayload1)
                                    }


                                    instaChatbot.payment_request = {}
                                    instaChatbot.request_details = {}
                                    instaChatbot.flowFlag = false;
                                    instaChatbot.flowId = "";
                                    await instaChatbot.save()

                                } else {

                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: lang[selectedLanguage].SOMETHING_WENT_WRONG_REQUEST,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/System%20Error.png",
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: `main_menu`,
                                                    },
                                                ]
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")

                                    instaChatbot.payment_request = {}
                                    instaChatbot.request_details = {}
                                    instaChatbot.flowFlag = false;
                                    instaChatbot.flowId = "";
                                    await instaChatbot.save()

                                }
                            }
                            else {
                                if (otpValidationResult.message === "max_attempts_exceeded") {

                                    await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                                } else {

                                    await invalidMessage(entry.messaging[0], "process_req_sub", selectedLanguage, instaChatbot?.otpType);
                                }
                            }
                        }
                        else if (quick_reply?.payload === "view_w2w_schedules") {
                            const pendingSchedules = await Schedule.find({ $and: [{ account: account._id }, { recursive: false, type: 'request' }] });
                            console.log(pendingSchedules, "pendingSchedules")
                            const scheduleMessages = await convertSchedulesToMessages(pendingSchedules)

                            for (let message of scheduleMessages) {
                                const quickReplies = [
                                    { content_type: "text", title: 'Schedule Again', payload: "wallet_to_wallet" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ];
                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            }
                        }

                        // SETTING UP PAYMENT REQUEST FLOW ENDED //
                        // user has clicked on accept payment request
                        else if ((messaging?.postback?.payload.includes("accept_req_pay-"))) {
                            const request_id = messaging?.postback?.payload.split("-")[1];
                            const paymentRequest = await RequestPayment.findById(request_id);
                            if (paymentRequest?.status === "pending") {

                                console.log(request_id, "request_id")
                                instaChatbot.request_details.request_id = request_id;
                                await instaChatbot.save();

                                const pans = await PanModel.find({ account: account._id });

                                if (pans.length !== 0) {
                                    const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].PAYMENT_CARD, payload: "request_card" },
                                        { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "select_req_send_wall" },
                                        { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "request_paypal" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");

                                } else {
                                    const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "select_req_send_wall" },
                                        { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "request_paypal" },
                                        { content_type: "text", title: lang[selectedLanguage].ADD_PAYMENT_CARD, payload: "add_payment_card-back_request" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");
                                }

                            } else if (paymentRequest?.status === "completed") {

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], lang[selectedLanguage].PAYMENT_REQUEST_COMPLETED, quickReplies, "4");
                            } else if (paymentRequest?.status === "cancelled") {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], lang[selectedLanguage].PAYMENT_REQUEST_CANCELLED, quickReplies, "4");
                            }
                            instaChatbot.flowFlag = true;
                            instaChatbot.flowId = "accept_reqs";
                            await instaChatbot.save()
                        }

                        // user has proceeded with the paypal for payment
                        else if (quick_reply?.payload === "request_paypal" || messaging?.postback?.payload?.includes("request_paypal") || quick_reply?.payload?.includes("request_paypal") || (instaChatbot?.last_message?.includes("request_paypal") && text && !quick_reply?.payload)) {
                            await w2wRequestPaypal(
                                messaging.sender.id,
                                messaging?.postback?.payload || quick_reply?.payload,
                                account,
                                instaChatbot,
                                text,
                                selectedLanguage,
                            );
                            return
                        }

                        else if (quick_reply?.payload === "back_request") {
                            const pans = await PanModel.find({ account: account._id });

                            if (pans.length !== 0) {
                                const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].PAYMENT_CARD, payload: "request_card" },
                                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "select_req_send_wall" },
                                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "request_paypal" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]

                                await quickReply(entry.messaging[0], message, quickReplies, "4");

                            } else {
                                const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "select_req_send_wall" },
                                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "request_paypal" },
                                    { content_type: "text", title: lang[selectedLanguage].ADD_PAYMENT_CARD, payload: "add_payment_card-back_request" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]

                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            }
                        }

                        else if (quick_reply?.payload === "request_card" || messaging?.postback?.payload?.includes("request_card") || quick_reply?.payload?.includes("request_card") || (instaChatbot?.last_message?.includes("request_card") && text && !quick_reply?.payload)) {
                            await w2wCardRequest(
                                messaging.sender.id,
                                messaging?.postback?.payload || quick_reply?.payload,
                                account,
                                instaChatbot,
                                text,
                                selectedLanguage,
                            );
                            return
                        }

                        // user has proceeded with the wallets for payment
                        else if (quick_reply?.payload === "select_req_send_wall") {
                            const wallets = await Wallet.find({ account: account?._id, wallet_type: 'insta', status: "active" });
                            const slicedWallets = wallets.slice(0, 8)

                            const quickReplies = slicedWallets?.map((wallet) => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `pay_req_s_wallet-${wallet._id}` } })
                            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })

                            await quickReply(entry.messaging[0], lang[selectedLanguage].PICK_CURRENCY_MESSAGE, quickReplies, "4");
                        }
                        // user has clicked on select wallet / another wallet
                        else if (quick_reply?.payload.includes("pay_req_s_wallet-")) {
                            const sendingWalletId = quick_reply?.payload.split("-")[1]

                            console.log(sendingWalletId, "sendingWalletId")
                            const walletDetails = await Wallet.findById(sendingWalletId).populate([
                                {
                                    path: 'account',
                                    populate: [

                                        { path: 'level' }
                                    ]
                                }
                            ]);

                            const requestDetails = await RequestPayment.findById(instaChatbot.request_details.request_id).populate('wallet')

                            const { exchange_rate, fee, totalAmountWithFee } = await calculateExchangeAndFees(walletDetails.currency.code, requestDetails?.wallet?.currency?.code, parseFloat(requestDetails.amount), "payment_request", account?.level._id, "wallet", walletDetails, "request");

                            let exchangedAmountSender = await getExchangeRatesToUSD(walletDetails.currency.code, 'USD', totalAmountWithFee)

                            const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, walletDetails, 'sending')

                            if (!sender_limits_check.status) {
                                await quickMessage(entry.messaging[0], sender_limits_check.message, "CONFIRMED_EVENT_UPDATE");
                                return

                            }

                            let message;
                            if (totalAmountWithFee > walletDetails.balance.available) {
                                if (walletDetails.currency.code !== requestDetails?.wallet?.currency?.code) {

                                    message = `
Wallet Balance: ${formattedAmount(walletDetails.balance.available)} ${walletDetails.currency.code}

${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}

${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${walletDetails.currency.code} = ${formattedAmount(exchange_rate, 6)} ${requestDetails?.wallet?.currency?.code}
       
${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(parseFloat(requestDetails.amount))} ${requestDetails?.wallet?.currency?.code}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}

       `
                                } else {
                                    message = `
                                    Wallet Balance: ${formattedAmount(walletDetails.balance.available)} ${walletDetails.currency.code}

${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}

${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}

${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(parseFloat(requestDetails.amount))} ${requestDetails?.wallet?.currency?.code}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}
    `

                                }
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].ADD_FUNDS, payload: "add_funds" },
                                    { content_type: "text", title: lang[selectedLanguage].ANOTHER_WALLET_TITLE, payload: "select_req_send_wall" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickMessage(entry.messaging[0], message, "CONFIRMED_EVENT_UPDATE")
                                return await quickReply(entry.messaging[0], 'Insufficient Balance! Please topup your wallet.', quickReplies, "4");
                            }
                            instaChatbot.request_details.sending_wallet = sendingWalletId;
                            await instaChatbot.save()

                            const message1 = `${lang[selectedLanguage].CURRENTLY_HAVE.replace('{{amount}}', formattedAmount(walletDetails?.balance?.available)).replace('{{currency}}', walletDetails.currency.code)}\n\n${lang[selectedLanguage].PROCEED_OR_SELECT_WALLET}`;
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].PROCEED_TITLE, payload: "req_money_w_proceed" },
                                { content_type: "text", title: lang[selectedLanguage].ANOTHER_WALLET_TITLE, payload: "select_req_send_wall" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]

                            await quickReply(entry.messaging[0], message1, quickReplies, "4");

                        }
                        // user has clicked on continue with this wallet
                        else if (quick_reply?.payload === "req_money_w_proceed") {
                            console.log("i have rannn")
                            const walletDetails = await Wallet.findById(instaChatbot.request_details.sending_wallet)

                            const requestDetails = await RequestPayment.findById(instaChatbot.request_details.request_id).populate('wallet')

                            const { exchange_rate, fee, totalAmountWithFee } = await calculateExchangeAndFees(walletDetails.currency.code, requestDetails?.wallet?.currency?.code, parseFloat(requestDetails.amount), "payment_request", account?.level._id, "wallet", walletDetails, "request");

                            let message

                            if (walletDetails.currency.code !== requestDetails?.wallet?.currency?.code) {

                                message = `
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}

${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}

${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${walletDetails.currency.code} = ${formattedAmount(exchange_rate, 6)} ${requestDetails?.wallet?.currency?.code}
   
${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(parseFloat(requestDetails.amount))} ${requestDetails?.wallet?.currency?.code}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}

   `
                            } else {
                                message = `
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}

${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}

${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(parseFloat(requestDetails.amount))} ${requestDetails?.wallet?.currency?.code}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}
`
                            }
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].YES_CONTINUE_TITLE, payload: "req_money_w_continue" },
                                { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "main_menu" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]

                            await quickReply(entry.messaging[0], message, quickReplies, "4");
                        }


                        else if (quick_reply?.payload === "req_money_w_continue") {
                            await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "accept_req", "5.5", "Transaction OTP");
                        }
                        // user is entering the otp for confirmig the request payment
                        else if (instaChatbot?.last_message === "5.5" && text && !quick_reply?.payload) {

                            const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "accept_req");

                            if (otpValidationResult.status) {

                                const requestDetails = await RequestPayment.findOne({ $and: [{ _id: instaChatbot?.request_details?.request_id }, { status: 'pending' }] })
                                console.log(requestDetails, "requestDetails")
                                if (!requestDetails) {
                                    await quickMessage(entry.messaging[0], lang[selectedLanguage].PAYMENT_REQUEST_STATUS, "CONFIRMED_EVENT_UPDATE", "4");
                                    return
                                }

                                const files = requestDetails?.attachments.map(image => ({
                                    key: image.key,
                                    url: image.url,
                                    ETag: image.ETag,
                                    status: true
                                }));

                                let data = {
                                    sender_wallet_id: instaChatbot?.request_details?.sending_wallet,
                                    receiver_wallet_id: requestDetails?.wallet_id,
                                    amount: requestDetails.amount,
                                    purpose: requestDetails?.purpose || "",
                                    type: 'wallet_to_wallet',
                                    payment_type: 'payment_request',
                                    link_id: requestDetails._id,
                                    description: requestDetails.description || "",
                                    attachments: files,
                                    transaction_type: "request",
                                    transaction_method: "wallet"
                                }

                                console.log(data, "dta")

                                const walletToWaletResponse = await walletToWalletTransaction(data)

                                console.log(walletToWaletResponse, "walletToWaletResponse")

                                if (walletToWaletResponse?.status) {
                                    let newSenderBalance = await RequestPayment.updateOne({ _id: requestDetails._id }, { $set: { "status": 'completed' } })
                                    const subtitle = `
${lang[selectedLanguage].TRANSACTION_ID} ${walletToWaletResponse?.data?.reference_id}
                                `
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: lang[selectedLanguage].PAYMENT_ACCEPTED_MESSAGE,
                                                subtitle,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20%20Request%20Accepted.png",

                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].LEAVE_REVIEW,
                                                        payload: `add_req_review-${requestDetails?._id}`,
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: `main_menu`,
                                                    },


                                                ]
                                            },
                                        ]
                                    };

                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")

                                    const requestingUser = await RequestPayment.findById(instaChatbot?.request_details?.request_id).populate([{
                                        path: 'sender',
                                        populate: 'insta_recipient_id'
                                    }])

                                    const requestingUserLang = requestingUser?.sender?.insta_recipient_id?.active_language || requestingUser?.sender?.language || "en"
                                    console.log(instaChatbot?.request_details?.request_id, "instaChatbot?.request_details?.request_id")

                                    console.log(requestingUser?.sender?.insta_recipient_id, "requestingUser?.account?.")

                                    const templatePayload1 = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `Excellent! ${account?.username} has accepted your payment request! Funds received.`,
                                                subtitle,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20%20Request%20Accepted.png",

                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[requestingUserLang].CASH_OUT_NOW,
                                                        payload: `cash_out_id_${walletToWaletResponse?.exchanged?._id}`,
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: lang[requestingUserLang].MAIN_MENU_MESSAGE,
                                                        payload: `main_menu`,
                                                    },


                                                ]
                                            },
                                        ]
                                    };
                                    const data = {
                                        sender: {
                                            id: requestingUser?.sender?.insta_recipient_id?.recipient
                                        }
                                    }
                                    await sendTemplate(data, requestingUser?.sender?.insta_recipient_id?.recipient, templatePayload1, "4")

                                }
                                else if (walletToWaletResponse?.message.includes("feature_not_available")) {
                                    const featureType = walletToWaletResponse?.message?.split("_")[3]
                                    const message = usersFeatureMessage(featureType)

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");
                                }
                                else if (walletToWaletResponse?.message.includes("limit_")) {
                                    const limitCode = walletToWaletResponse?.message?.split("_")[1]
                                    const sendingAmounts = walletToWaletResponse?.sendingAmounts

                                    const message = userLimitsMessage(limitCode, sendingAmounts)

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");
                                }
                                else {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]

                                    await quickReply(entry.messaging[0], "Something went wrong while accepting the payment request. Please try again!", quickReplies, "4");
                                }
                                instaChatbot.flowFlag = false;
                                instaChatbot.flowId = "";
                                await instaChatbot.save()
                            } else {
                                if (otpValidationResult.message === "max_attempts_exceeded") {

                                    await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                                } else {

                                    await invalidMessage(entry.messaging[0], "accept_req", selectedLanguage, instaChatbot?.otpType);
                                }
                            }
                        }

                        // --- SUBSCRIBED PAYMENT REQUEST ACCEPTANCE --- //
                        // user has clicked on accept subscribed payment request
                        else if (messaging?.postback?.payload.includes("accept_subs_req-")) {
                            const subscriptionId = messaging?.postback?.payload.split("-")[1];
                            instaChatbot.payment_request.subscriptionId = subscriptionId
                            await instaChatbot?.save()

                            const wallets = await Wallet.find({ account: account._id, wallet_type: 'insta', status: "active" });
                            const limitedWallets = wallets.slice(0, 8)
                            const quickReplies = limitedWallets.map(wallet => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `accept_subs_req_wallet-${wallet._id}` } })
                            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })
                            await quickReply(entry.messaging[0], lang[selectedLanguage].SELECT_WALLET_CURRENCY, quickReplies, "4");

                        }
                        // user has clicked on select another wallet
                        else if (quick_reply?.payload === "accept_subs_req_wallet_another") {
                            const wallets = await Wallet.find({ account: account._id, wallet_type: 'insta', status: "active" });
                            const limitedWallets = wallets.slice(0, 8)
                            const quickReplies = limitedWallets.map(wallet => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `accept_subs_req_wallet-${wallet._id}` } })
                            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })
                            await quickReply(entry.messaging[0], lang[selectedLanguage].SELECT_WALLET_CURRENCY, quickReplies, "4");
                        }
                        // user has selected a currency for subscription
                        else if (quick_reply?.payload.includes("accept_subs_req_wallet-")) {
                            const walletId = quick_reply?.payload.split("-")[1];
                            const walletDetails = await Wallet.findById(walletId);
                            instaChatbot.payment_request.subscriptionWalletId = walletId
                            await instaChatbot?.save()

                            const message = `${lang[selectedLanguage].CURRENTLY_HAVE.replace('{{amount}}', formattedAmount(walletDetails?.balance?.available)).replace('{{currency}}', walletDetails.currency.code)}\n\n${lang[selectedLanguage].PROCEED_OR_SELECT_WALLET}`;
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].PROCEED_TITLE, payload: "accept_subs_req_wallet_proceed" },
                                { content_type: "text", title: lang[selectedLanguage].ANOTHER_WALLET_TITLE, payload: "accept_subs_req_wallet_another" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]

                            await quickReply(entry.messaging[0], message, quickReplies, "4");
                        }
                        // user has confirmed the currency
                        else if (quick_reply?.payload === "accept_subs_req_wallet_proceed") {
                            await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "proceed_subs_req", "6.6.2", "Transaction OTP");
                        }
                        // user has entered an OTP for subscription payment request
                        else if (instaChatbot?.last_message === "6.6.2" && text && !quick_reply?.payload) {
                            const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "proceed_subs_req");

                            if (otpValidationResult.status) {

                                const scheduleDetails = await Schedule.findById(instaChatbot?.payment_request?.subscriptionId);
                                console.log(scheduleDetails, "scheduleDetails")
                                const senderDetails = await Account.findById(scheduleDetails?.request_payment?.sender).populate(['user', 'company', 'insta_recipient_id']);
                                const receiverDetails = await Account.findById(scheduleDetails?.request_payment?.receiver).populate(['user', 'company']);
                                console.log(receiverDetails, senderDetails, "senderdeafa")
                                const sender_name = senderDetails?.user ?
                                    senderDetails?.user?.first_name + " " + senderDetails?.user?.last_name :
                                    senderDetails?.company?.company_name
                                const receiver_name = receiverDetails.user ?
                                    receiverDetails.user?.first_name + " " + receiverDetails.user?.last_name :
                                    receiverDetails.company?.company_name

                                const senderMessage = `
Your subscribed payment request of ${formattedAmount(scheduleDetails.request_payment?.amount.toFixed(2))} ${scheduleDetails.request_payment?.currency?.code} has been accepted from ${receiver_name}
                                `
                                const receiverMessage = `
You have successfully accepted a subscribed payment request of ${formattedAmount(scheduleDetails.request_payment?.amount.toFixed(2))} ${scheduleDetails.request_payment?.currency?.code} sent from ${sender_name}
                                `
                                const subtitle = `
${lang[selectedLanguage].SUBSCRIPTION} Date: ${scheduleDetails.date}
${lang[selectedLanguage].CYCLES}: ${scheduleDetails.cycles}
${lang[selectedLanguage].PURPOSE ?? "Purpose"}: ${scheduleDetails.request_payment?.purpose}`

                                const templatePayload = {
                                    template_type: "generic",
                                    elements: [
                                        {
                                            title: receiverMessage,
                                            subtitle,
                                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Request%20Sent.png",
                                            buttons: [
                                                {
                                                    type: "postback",
                                                    title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                    payload: "main_menu",
                                                },
                                            ],
                                        },
                                    ]
                                };
                                await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                const templatePayload1 = {
                                    template_type: "generic",
                                    elements: [
                                        {
                                            title: senderMessage,
                                            subtitle,
                                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Subscription%20Request%20Received.png",
                                            buttons: [
                                                {
                                                    type: "postback",
                                                    title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                    payload: "main_menu",
                                                },
                                            ],
                                        },
                                    ]
                                };
                                const data = {
                                    sender: { id: senderDetails?.insta_recipient_id?.recipient },
                                }
                                await sendTemplate(data, senderDetails?.insta_recipient_id?.recipient, templatePayload1, "4")
                            }
                            else {
                                if (otpValidationResult.message === "max_attempts_exceeded") {

                                    await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                                } else {

                                    await invalidMessage(entry.messaging[0], "proceed_subs_req", selectedLanguage, instaChatbot?.otpType);
                                }
                            }
                        }

                        // -- SCHEDULED PAYMENT REQUEST ACCEPTANCE -- //
                        // user has clicked on accept scheduled payment request
                        else if (messaging?.postback?.payload.includes("accept_sched_req-")) {
                            const subscriptionId = messaging?.postback?.payload.split("-")[1];
                            instaChatbot.payment_request.scheduleId = subscriptionId
                            await instaChatbot?.save()

                            const wallets = await Wallet.find({ account: account._id, wallet_type: 'insta', status: "active" });
                            const limitedWallets = wallets.slice(0, 8)
                            const quickReplies = limitedWallets.map(wallet => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `accept_sched_req_wallet-${wallet._id}` } })
                            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })
                            await quickReply(entry.messaging[0], lang[selectedLanguage].SELECT_WALLET_CURRENCY, quickReplies, "4");
                        }
                        // user has clicked on select another wallet
                        else if (quick_reply?.payload === "accept_sched_req_wallet_another") {
                            const wallets = await Wallet.find({ account: account._id, wallet_type: 'insta', status: "active" });
                            const limitedWallets = wallets.slice(0, 8)
                            const quickReplies = limitedWallets.map(wallet => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `accept_sched_req_wallet-${wallet._id}` } })
                            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })
                            await quickReply(entry.messaging[0], lang[selectedLanguage].SELECT_WALLET_CURRENCY, quickReplies, "4");
                        }
                        // user has selected a currency for scheduled payment request
                        else if (quick_reply?.payload.includes("accept_sched_req_wallet-")) {
                            const walletId = quick_reply?.payload.split("-")[1];
                            const walletDetails = await Wallet.findById(walletId);
                            instaChatbot.payment_request.subscriptionWalletId = walletId
                            await instaChatbot?.save()

                            const message = `${lang[selectedLanguage].CURRENTLY_HAVE.replace('{{amount}}', formattedAmount(walletDetails?.balance?.available)).replace('{{currency}}', walletDetails.currency.code)}\n\n${lang[selectedLanguage].PROCEED_OR_SELECT_WALLET}`;
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].PROCEED_TITLE, payload: "accept_sched_req_wallet_proceed" },
                                { content_type: "text", title: lang[selectedLanguage].ANOTHER_WALLET_TITLE, payload: "accept_sched_req_wallet_another" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]

                            await quickReply(entry.messaging[0], message, quickReplies, "4");
                        }
                        // user has confirmed the currency
                        else if (quick_reply?.payload === "accept_sched_req_wallet_proceed") {
                            await sendVideoImage("https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/otp.jpeg", messaging?.sender?.id, "image")
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_CODE_MESSAGE, "CONFIRMED_EVENT_UPDATE", "6.6.3");
                        }
                        // user has entered an OTP for scheduled payment request
                        else if (instaChatbot?.last_message === "6.6.3" && text && !quick_reply?.payload) {
                            const scheduleDetails = await Schedule.findById(instaChatbot?.payment_request?.scheduleId);
                            console.log(scheduleDetails, "scheduleDetails")
                            const senderDetails = await Account.findById(scheduleDetails?.request_payment?.sender).populate(['user', 'company', 'insta_recipient_id']);
                            const receiverDetails = await Account.findById(scheduleDetails?.request_payment?.receiver).populate(['user', 'company']);
                            console.log(receiverDetails, senderDetails, "senderdeafa")
                            const sender_name = senderDetails?.user ?
                                senderDetails?.user?.first_name + " " + senderDetails?.user?.last_name :
                                senderDetails?.company?.company_name
                            const receiver_name = receiverDetails.user ?
                                receiverDetails.user?.first_name + " " + receiverDetails.user?.last_name :
                                receiverDetails.company?.company_name

                            const senderMessage = `
Your scheduled payment request of  ${formattedAmount(scheduleDetails.request_payment?.amount?.toFixed(2))} ${scheduleDetails.request_payment?.currency?.code} has been accepted from ${receiver_name}
                                `
                            const receiverMessage = `
You have successfully accepted a scheduled payment request of ${formattedAmount(scheduleDetails.request_payment?.amount?.toFixed(2))} ${scheduleDetails.request_payment?.currency?.code} sent from ${sender_name}
                                `
                            const subtitle = `
Date and Time: ${scheduleDetails.date}/${scheduleDetails.time}
${lang[selectedLanguage].PURPOSE ?? "Purpose"}: ${scheduleDetails.request_payment?.purpose}`

                            console.log(senderMessage, receiverMessage, subtitle, "subtitle")

                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: receiverMessage,
                                        subtitle,
                                        image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Request%20Sent.png",
                                        buttons: [
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                payload: "main_menu",
                                            },
                                        ],
                                    },
                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                            const templatePayload1 = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: senderMessage,
                                        subtitle,
                                        image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Subscription%20Request%20Received.png",
                                        buttons: [
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                payload: "main_menu",
                                            },
                                        ],
                                    },
                                ]
                            };
                            const data = {
                                sender: { id: senderDetails?.insta_recipient_id?.recipient },
                            }
                            await sendTemplate(data, senderDetails?.insta_recipient_id?.recipient, templatePayload1, "4")

                        }

                        // user has clicked to add a review
                        else if (messaging?.postback?.payload.includes("add_req_review-")) {
                            const reviewId = messaging?.postback?.payload.split("-")[1];
                            instaChatbot.request_details.request_id = reviewId
                            instaChatbot.flowFlag = true;
                            instaChatbot.flowId = "add_req";
                            await instaChatbot?.save()
                            const message = lang[selectedLanguage].SHARE_EXPERIENCE
                            await quickMessage(entry.messaging[0], message, "CONFIRMED_EVENT_UPDATE", "5.6");
                        }
                        // user has entered a description
                        else if (instaChatbot?.last_message === "5.6" && text && !quick_reply?.payload) {
                            instaChatbot.request_details.review = text
                            await instaChatbot?.save()

                            const message = "Rate out of 5 ⭐"
                            const quickReplies = [
                                { content_type: "text", title: "1 ⭐", payload: "rate_s-1" },
                                { content_type: "text", title: "2 ⭐", payload: "rate_s-2" },
                                { content_type: "text", title: "3 ⭐", payload: "rate_s-3" },
                                { content_type: "text", title: "4 ⭐", payload: "rate_s-4" },
                                { content_type: "text", title: "5 ⭐", payload: "rate_s-5" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }
                            ]

                            await quickReply(entry.messaging[0], message, quickReplies, "5.7");


                        }
                        // user has entered a rating
                        else if (quick_reply?.payload.includes("rate_s-")) {
                            const rating = quick_reply?.payload.split("-")[1];

                            instaChatbot.request_details.rating = parseInt(rating)
                            await instaChatbot?.save()

                            const data = {
                                comment: instaChatbot?.request_details?.review,
                                rating: parseInt(rating),
                                type: "instant",
                                request_id: instaChatbot?.request_details?.request_id
                            }
                            const buyerToSellerComment = await buyerToSellerReview(data)

                            console.log(buyerToSellerComment, "buyerToSellerComment")
                            if (buyerToSellerComment?.status) {


                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" },
                                ];
                                await quickReply(entry.messaging[0], lang[selectedLanguage].THANK_YOU_MESSAGE, quickReplies, "4");

                                const requestingUser = await RequestPayment.findById(instaChatbot?.request_details?.request_id).populate([{
                                    path: 'sender',
                                    populate: 'insta_recipient_id'
                                }])

                                const sendingUser = await RequestPayment.findById(instaChatbot?.request_details?.request_id).populate([
                                    {
                                        path: 'receiver',
                                        populate: [
                                            { path: 'user' },
                                            { path: 'company' },
                                        ]
                                    }
                                ]);

                                const data1 = {
                                    sender: {
                                        id: requestingUser?.sender?.insta_recipient_id?.recipient
                                    }
                                }
                                const receiverName = sendingUser.receiver.account_type === "individual" ? sendingUser.receiver.user.first_name + " " + sendingUser.receiver.user.last_name : sendingUser.receiver?.company?.company_name

                                // addhere
                                const message1 = `
${lang[selectedLanguage].REVIEW_ADDED_MESSAGE_FROM} from ${receiverName} ${lang[selectedLanguage].FOR_THE_PAYMENT_REQUEST} ${sendingUser?.reference_id} ${lang[selectedLanguage].OF} ${formattedAmount(sendingUser?.amount?.toFixed(2))} ${sendingUser?.currency.code}
    `;
                                // Review: ${text}
                                // Rating: ${instaChatbot?.request_details?.rating}
                                const quickReplies1 = [
                                    { content_type: "text", title: "Give a review", payload: `req_rev_2-${instaChatbot?.request_details?.request_id}` },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(data1, message1, quickReplies1, "4");

                            } else {
                                const message = "Review could not be added, please contact the administrator"
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" },
                                ];
                                await quickReply(entry.messaging[0], buyerToSellerComment?.message, quickReplies, "4");
                            }
                            instaChatbot.flowFlag = false;
                            instaChatbot.flowId = "";
                            await instaChatbot.save()
                        }

                        else if (instaChatbot?.last_message === "5.7" && ((text && !quick_reply?.payload) || messaging?.message?.attachments)) {
                            const quickReplies = [
                                { content_type: "text", title: "1 ⭐", payload: "rate_s-1" },
                                { content_type: "text", title: "2 ⭐", payload: "rate_s-2" },
                                { content_type: "text", title: "3 ⭐", payload: "rate_s-3" },
                                { content_type: "text", title: "4 ⭐", payload: "rate_s-4" },
                                { content_type: "text", title: "5 ⭐", payload: "rate_s-5" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }
                            ]

                            await quickReply(entry.messaging[0], lang[selectedLanguage].ENTER_VALID_RATING, quickReplies, "4");
                        }
                        // seller to buyer review
                        else if (quick_reply?.payload.includes("req_rev_2-")) {
                            console.log("second rev ran")
                            const requestId = quick_reply?.payload.split("-")[1];
                            instaChatbot.request_details.request_id = requestId;
                            await instaChatbot?.save()

                            const message = lang[selectedLanguage].ADD_DESCRIPTION_AS_REVIEW
                            await quickMessage(entry.messaging[0], message, "CONFIRMED_EVENT_UPDATE", "5.8");
                        }
                        // user has entered a description
                        else if (instaChatbot?.last_message === "5.8" && text && !quick_reply?.payload) {
                            instaChatbot.request_details.review = text
                            await instaChatbot?.save();
                            const message = "Rate out of 5 ⭐"
                            const quickReplies = [
                                { content_type: "text", title: "1 ⭐", payload: "rate-1" },
                                { content_type: "text", title: "2 ⭐", payload: "rate-2" },
                                { content_type: "text", title: "3 ⭐", payload: "rate-3" },
                                { content_type: "text", title: "4 ⭐", payload: "rate-4" },
                                { content_type: "text", title: "5 ⭐", payload: "rate-5" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }
                            ]
                            await quickReply(entry.messaging[0], message, quickReplies, "5.9");

                        }
                        else if (instaChatbot?.last_message === "5.9" && ((text && !quick_reply?.payload) || messaging?.message?.attachments)) {
                            const quickReplies = [
                                { content_type: "text", title: "1 ⭐", payload: "rate-1" },
                                { content_type: "text", title: "2 ⭐", payload: "rate-2" },
                                { content_type: "text", title: "3 ⭐", payload: "rate-3" },
                                { content_type: "text", title: "4 ⭐", payload: "rate-4" },
                                { content_type: "text", title: "5 ⭐", payload: "rate-5" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }
                            ]

                            await quickReply(entry.messaging[0], lang[selectedLanguage].ENTER_VALID_RATING, quickReplies, "4");
                        }
                        // user has entered a rating
                        else if (quick_reply?.payload.includes("rate-")) {
                            const rating = quick_reply?.payload.split("-")[1];

                            instaChatbot.request_details.rating = parseInt(rating)
                            console.log(rating, "rating")
                            await instaChatbot?.save()

                            const data = {
                                comment: instaChatbot?.request_details?.review,
                                rating: parseInt(rating),
                                type: "instant",
                                request_id: instaChatbot?.request_details?.request_id

                            }
                            const sellerToBuyer = await sellerToBuyerReview(data)
                            console.log(sellerToBuyer, "sellerToBuyer")

                            if (sellerToBuyer?.status) {
                                const requestingUser = await RequestPayment.findById(instaChatbot?.request_details?.request_id)
                                    .populate([
                                        {
                                            path: 'receiver',
                                            populate: 'insta_recipient_id'
                                        },
                                        {
                                            path: 'buyer_comment',
                                        }
                                    ]);

                                const message = `
${lang[selectedLanguage].REVIEW_ADDED_MESSAGE}
                                        
${lang[selectedLanguage].REQUEST_REFERENCE}: ${requestingUser?.reference_id}
${lang[selectedLanguage].BUYER_REVIEW}: ${requestingUser?.buyer_comment?.comment}
${lang[selectedLanguage].BUYER_RATING}: ${generateRatingStars(requestingUser?.buyer_comment?.rating)}
                                        `;

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].REPLY_TO_REVIEW, payload: `req_repl-${requestingUser?.buyer_comment?._id}` },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" },
                                ];
                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                                console.log(requestingUser?.receiver?.insta_recipient_id?.recipient, "instaChatbot?.request_details?.request_id")

                                const sendingUser = await RequestPayment.findById(instaChatbot?.request_details?.request_id).populate('sender')

                                const data1 = {
                                    sender: {
                                        id: requestingUser?.receiver?.insta_recipient_id?.recipient
                                    }
                                }

                                const message1 = `
${lang[selectedLanguage].REVIEW_ADDED_PAYMENT_REQUEST} ${sendingUser?.sender?.username}.
    
${lang[selectedLanguage].REVIEW}: ${instaChatbot?.request_details?.review}
${lang[selectedLanguage].RATING}: ${generateRatingStars(parseInt(rating))}
    `;
                                console.log(message1, "masd1")
                                const quickReplies1 = [
                                    // { content_type: "text", title: "Give a reply", payload: `req_repl-${sellerToBuyer?.message?._id}` },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(data1, message1, quickReplies1, "4");
                            }
                            else {
                                const message = "Review could not be added, please contact the administrator"
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" },
                                ];
                                await quickReply(entry.messaging[0], sellerToBuyer?.message, quickReplies, "4");
                            }



                        }
                        // a reply to review button has been clicked
                        else if (quick_reply?.payload.includes("req_repl-")) {
                            const commentId = quick_reply?.payload?.split("-")[1]
                            instaChatbot.request_details.comment_to_reply = commentId
                            console.log(commentId, "commentId")
                            await instaChatbot?.save()

                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ADD_REPLY_BELOW, "CONFIRMED_EVENT_UPDATE", "5.10");
                        }
                        // a reply to review has been added
                        else if (instaChatbot?.last_message === "5.10" && text && !quick_reply?.payload) {
                            const data = {
                                reply: text,
                                buyer_comment_id: instaChatbot?.request_details?.comment_to_reply
                            }
                            console.log(data, "dataforreply")
                            const replyToBuyer = await sellerToBuyerReply(data)
                            console.log(replyToBuyer, "replyToBuyer")

                            if (replyToBuyer?.status) {
                                const requestedReview = await RequestReview.findById(data?.buyer_comment_id).populate([{
                                    path: 'buyer',
                                    populate: 'insta_recipient_id'
                                }, {
                                    path: 'seller',
                                    populate: 'insta_recipient_id'
                                }])
                                // const requestingUser = await RequestPayment.findById(instaChatbot?.request_details?.comment_to_reply).populate([{
                                //     path: 'receiver',
                                //     populate: 'insta_recipient_id'
                                // }]);
                                // const sendingUser = await RequestPayment.findById(instaChatbot?.request_details?.comment_to_reply).populate('sender')

                                console.log("starts", requestedReview, "end")
                                const data1 = {
                                    sender: {
                                        id: requestedReview?.buyer?.insta_recipient_id?.recipient
                                    }
                                }
                                // const data2 = {
                                //     sender: {
                                //         id: requestedReview?.seller?.insta_recipient_id?.recipient
                                //     }
                                // }

                                const message1 = `
${lang[selectedLanguage].REVIEW_REPLY_ADDED} ${requestedReview?.seller?.username}.

${lang[selectedLanguage].YOUR_REVIEW}: ${requestedReview?.comment}
${lang[selectedLanguage].YOUR_RATING}: ${generateRatingStars(requestedReview?.rating)}
Reply: ${text}
`;

                                // addhere ^
                                const message2 = lang[selectedLanguage].REPLY_ADDED;
                                console.log(message1, "masd1")
                                console.log(message2, "masd2")
                                const quickReplies1 = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(data1, message1, quickReplies1, "4");
                                await quickReply(entry.messaging[0], message2, quickReplies1, "4");
                            }
                            else {
                                const message = "Reply could not be added, please contact the administrator"
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" },
                                ];
                                await quickReply(entry.messaging[0], replyToBuyer?.message, quickReplies, '4');
                            }
                        }
                        // user has declined the request payment
                        else if (messaging?.postback?.payload.includes("decline_req_pay-")) {
                            const requestId = messaging?.postback?.payload.split('-')[1]

                            const paymentRequest = await RequestPayment.findById(requestId).populate([{
                                path: 'sender',
                                populate: 'insta_recipient_id'
                            }])
                            console.log(paymentRequest, "paymentRequest")

                            if (paymentRequest?.status === "completed") {

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], lang[selectedLanguage].PAYMENT_REQUEST_COMPLETED, quickReplies, "4");
                            } else if (paymentRequest?.status === "cancelled") {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], lang[selectedLanguage].PAYMENT_REQUEST_CANCELLED, quickReplies, "4");
                            } else {
                                const declinedQuotationDetails = await declinePaymentRequest(requestId);
                                if (declinedQuotationDetails.status) {
                                    // const message = 'You have declined this payment request'
                                    // const quickReplies = [
                                    //     { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    // ]
                                    // await quickReply(entry.messaging[0], message, quickReplies, "4");
                                    // current user

                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: lang[selectedLanguage].DECLINED_CONFIRMATION_MESSAGE,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Request%20Declined.png",
                                                buttons: [

                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: `main_menu`,
                                                    },


                                                ]
                                            },
                                        ]
                                    };

                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")

                                    // second user
                                    const message1 = `${lang[selectedLanguage].PAYMENT_REQUEST_DECLINED_MESSAGE} ${account.username}!`
                                    const templatePayload1 = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: message1,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Request%20Declined.png",
                                                buttons: [

                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: `main_menu`,
                                                    },


                                                ]
                                            },
                                        ]
                                    };
                                    const data = {
                                        sender: { id: paymentRequest?.sender?.insta_recipient_id?.recipient },
                                    }
                                    await sendTemplate(data, paymentRequest?.sender?.insta_recipient_id?.recipient, templatePayload1, "4")
                                } else {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]
                                    await quickReply(entry.messaging[0], lang[selectedLanguage].DECLINE_ERROR_MESSAGE, quickReplies, "4");
                                }
                            }

                        }

                        //--- INITIATE-PAYMENT --- => --- SEND-QUOTATION --- //
                        else if (messaging?.postback?.payload === "send_quotation" || quick_reply?.payload === "send_quotation") {

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].create_quote, payload: "create_quote" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }]

                            await quickReply(entry.messaging[0], lang[selectedLanguage].SEND_QUOTE_PROMPT, quickReplies, "4");
                        }

                        else if (quick_reply?.payload === "create_quote") {
                            instaChatbot.quotation = {};
                            instaChatbot.flowFlag = true;
                            instaChatbot.flowId = "quot_flag";
                            await instaChatbot.save();
                            await handleBeneficiariesRequest(account, entry, "6.1", "send_quot_benf", selectedLanguage, 1);
                        }

                        else if (quick_reply?.payload.startsWith("send_quot_benf_next_") || quick_reply?.payload.startsWith("send_quot_benf_prev_")) {
                            const pageNumber = parseInt(quick_reply.payload.split("_").pop());
                            await handleBeneficiariesRequest(account, entry, "6.1", "send_quot_benf", selectedLanguage, pageNumber);
                        }

                        // user has selected beneficiary from quick reply
                        else if (quick_reply?.payload.includes("send_quot_benf")) {
                            const benefId = quick_reply?.payload.split("-")[1]
                            console.log(benefId)
                            const benefDetails = await Beneficiary.findById(benefId);
                            const benefAccount = await Account.findOne({ phone: benefDetails?.phone })
                            if (benefAccount?._id?.toString() === account?._id?.toString()) {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                return await quickReply(entry.messaging[0], lang[selectedLanguage].SEND_MONEY_TO_SELF, quickReplies)
                            }
                            console.log(benefAccount)
                            const subtitleMsg = `
${lang[selectedLanguage].USERNAME_LABEL}: ${benefAccount?.username}
${lang[selectedLanguage].COUNTRY_LABEL}: ${benefAccount?.country_name}
                        `
                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: `${benefDetails?.first_name} ${benefDetails?.last_name}`,
                                        image_url: benefAccount?.profileImage?.url,
                                        subtitle: subtitleMsg,

                                        buttons: [
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].CONTINUE,
                                                payload: "cont_benef_quot",
                                            },
                                            {
                                                type: "web_url",
                                                title: lang[selectedLanguage].VIEW_PROFILE_BUTTON,
                                                url: `https://my.insta-pay.ch/profile/${benefAccount?.username}`,
                                                webview_height_ratio: "full"
                                            },
                                            // {
                                            //     type: "postback",
                                            //     title: "Select Different User",
                                            //     payload: "create_quote",
                                            // },

                                        ],
                                    },
                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "6.1.1")
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].SELECT_DIFFERENT_USER, payload: "create_quote" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" },

                            ]

                            await quickReply(entry.messaging[0], lang[selectedLanguage].SELECT_OPTIONS_BELOW, quickReplies);
                            instaChatbot.quotation.beneficiary = benefAccount?._id;
                            await instaChatbot.save()
                        }

                        // user has typed information regarding user to search in quotation flow
                        else if (instaChatbot?.last_message === "6.1" && text && !quick_reply?.payload) {
                            const user = await Account.findOne({
                                $or: [
                                    { username: { $regex: new RegExp(text, "i") } },
                                    { email: { $regex: new RegExp(text, "i") } },
                                    { phone: { $regex: new RegExp(text, "i") } },
                                    { insta_username: { $regex: new RegExp(text, "i") } }
                                ]
                            }).populate(["user", "company"]);
                            if (user) {
                                if (user?._id?.toString() === account?._id?.toString()) {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]
                                    return await quickReply(entry.messaging[0], lang[selectedLanguage].SEND_MONEY_TO_SELF, quickReplies)
                                }
                                console.log(user)

                                const subtitleMsg = `
${lang[selectedLanguage].USERNAME_LABEL}: ${user.username}
${lang[selectedLanguage].COUNTRY_LABEL}: ${user.country_name}
                        `
                                const templatePayload = {
                                    template_type: "generic",
                                    elements: [
                                        {
                                            title: `${user?.user?.first_name} ${user?.user?.last_name}`,
                                            image_url: user?.profileImage?.url,
                                            subtitle: subtitleMsg,

                                            buttons: [
                                                {
                                                    type: "postback",
                                                    title: lang[selectedLanguage].CONTINUE, payload: "cont_benef_quot",
                                                },
                                                {
                                                    type: "web_url",
                                                    title: lang[selectedLanguage].VIEW_PROFILE_BUTTON,
                                                    url: `https://my.insta-pay.ch/profile/${user?.username}`,
                                                    webview_height_ratio: "full"
                                                },
                                                // {
                                                //     type: "postback",
                                                //     title: "Select Different User",
                                                //     payload: "create_quote",
                                                // },

                                            ],
                                        },
                                    ]
                                };
                                await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "6.1.1")
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].SELECT_DIFFERENT_USER, payload: "create_quote" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" },

                                ]

                                await quickReply(entry.messaging[0], "Or select options below", quickReplies);
                                instaChatbot.quotation.beneficiary = user?._id;
                                await instaChatbot.save()

                            } else {
                                const message = lang[selectedLanguage].INVALID_USER
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].SELECT_ANOTHER, payload: "send_quotation" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" }]

                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            }
                        }

                        // user has continued the beneficiary
                        else if (instaChatbot?.last_message === "6.1.1" && (messaging?.postback?.payload === "cont_benef_quot" || quick_reply?.payload === "cont_benef_quot")) {
                            const wallets = await Wallet.find({ account: account?._id, wallet_type: "insta" });
                            const slicedWallets = wallets.slice(0, 5)

                            const quickReplies = slicedWallets?.map((wallet) => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `quot_send_wallet-${wallet._id}` } })
                            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })

                            await quickReply(entry.messaging[0], lang[selectedLanguage].RECEIVE_CURRENCY_PROMPT, quickReplies, "4");
                        }

                        // user has selected a wallet
                        else if (quick_reply?.payload.includes('quot_send_wallet-')) {
                            const walletId = quick_reply?.payload.split('-')[1]
                            instaChatbot.quotation.currency = walletId;
                            await instaChatbot.save()

                            await quickMessage(entry.messaging[0], "Please enter the amount of your quote.\nExample: 100", "CONFIRMED_EVENT_UPDATE", "6.4");
                        }

                        // user has entered amount
                        else if (instaChatbot?.last_message === "6.4" && text && !quick_reply?.payload) {
                            const digitRegex = /^\d+(\.\d+)?$/;
                            const isNumber = digitRegex.test(text)
                            const amount = parseFloat(text);
                            if (isNumber && amount >= 0.1) {
                                // receiver's account balance check
                                const receivingWallet = await Wallet.findById(instaChatbot.quotation.currency)
                                const receiverBalanceCheck = await balanceLimitCheck(amount, account, receivingWallet);
                                console.log({ receiverBalanceCheck })

                                if (!receiverBalanceCheck?.status && receiverBalanceCheck?.remainingBalance) {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ];
                                    if (account.level.level_no === 1) {
                                        quickReplies.push({ content_type: "text", title: "Identity Verification", payload: "kyc_verification" },)
                                        await quickReply(entry.messaging[0], `Completing this transaction will exceed your balance limit. Your remaining balance is ${formattedAmount(receiverBalanceCheck?.remainingBalance)} ${receivingWallet?.currency.code}. Please enter an amount within your balance limit or complete KYC verification to increase your balance limit.`, quickReplies);
                                    } else {
                                        await quickReply(entry.messaging[0], `Completing this transaction will exceed your balance limit. Your remaining balance is ${formattedAmount(receiverBalanceCheck?.remainingBalance)} ${receivingWallet?.currency.code}. Please enter an amount within your balance limit.`, quickReplies);
                                    }
                                    return
                                } else if (!receiverBalanceCheck?.status) {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ];

                                    await quickReply(entry.messaging[0], `Something went wrong while checking your balance limit. Please try again.`, quickReplies);
                                    return
                                }


                                instaChatbot.quotation.amount = amount;
                                await instaChatbot?.save()

                                await quickMessage(entry.messaging[0], "Add a title for your quote", "CONFIRMED_EVENT_UPDATE", "6.2");
                            } else if (amount <= 0.1) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].MINIMUM_AMOUNT, "CONFIRMED_EVENT_UPDATE");
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_AMOUNT_DIGITS, "CONFIRMED_EVENT_UPDATE");
                            }
                        }

                        // user has entered a title
                        else if ((instaChatbot?.last_message === "6.2" && text && !quick_reply?.payload) || quick_reply?.payload === "quot_back_btn") {
                            if (quick_reply?.payload !== "quot_back_btn") {
                                instaChatbot.quotation.title = text;
                                await instaChatbot?.save()
                            }

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].ADD_NOTE_BUTTON, payload: "quot_add_note" },
                                { content_type: "text", title: lang[selectedLanguage].ATTACH_DOCUMENT_BUTTON, payload: "quot_images_yes" },
                                { content_type: "text", title: lang[selectedLanguage].SKIP, payload: "quot_skip_attch" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ];
                            await quickReply(entry.messaging[0], lang[selectedLanguage].ADD_TRANSACTION_DETAILS_TITLE, quickReplies, "4");
                        }

                        // user has selected the "Add Note" option
                        else if (quick_reply?.payload === "quot_add_note") {
                            await quickMessage(entry.messaging[0], "Please type your note below to add additional details to your quote.", "CONFIRMED_EVENT_UPDATE", "6.2.3.1");
                        }

                        // user is entering the notes description
                        else if (instaChatbot?.last_message === "6.2.3.1" && !quick_reply?.payload && text) {
                            instaChatbot.quotation.desc = text;
                            await instaChatbot.save();

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].YES, payload: "quot_images_yes_1" },
                                { content_type: "text", title: lang[selectedLanguage].NO, payload: "quot_skip_attch" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ];
                            await quickReply(entry.messaging[0], lang[selectedLanguage].ATTACH_DOCUMENT, quickReplies, "4");
                        }

                        else if (quick_reply?.payload === 'quot_images_yes_1') {

                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ATTACH_DOCUMENT_ASK, "CONFIRMED_EVENT_UPDATE", "6.2.1.1");
                        }

                        // if user has entered invalid file type
                        else if ((messaging?.message?.is_unsupported || text) && instaChatbot?.last_message === "6.2.1.1" && !quick_reply?.payload) {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                        }
                        else if (messaging?.message?.attachments && instaChatbot?.last_message === "6.2.1.1" && !quick_reply?.payload) {
                            const { validCount, allImagesAndVideos } = validateAttachments(messaging.message.attachments);

                            if (!validCount) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].FILE_ATTACHMENT_LIMIT, "CONFIRMED_EVENT_UPDATE");
                                return;
                            }

                            if (allImagesAndVideos) {

                                const uploadedImages = await uploadToS3("transaction_images", account._id, messaging.message.attachments);
                                console.log(uploadedImages, "uploadedImages")
                                if (uploadedImages.status) {
                                    for (const image of uploadedImages.uploadedFiles) {
                                        instaChatbot.quotation.images.push({
                                            key: image.key,
                                            url: image.url,
                                            ETag: image.ETag
                                        })
                                    }
                                    await instaChatbot.save();


                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].YES, payload: "bargain_yes" },
                                        { content_type: "text", title: lang[selectedLanguage].NO, payload: "bargain_no" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ];

                                    await quickReply(entry.messaging[0], lang[selectedLanguage].BARGAIN_PROMPT, quickReplies, "4");
                                } else {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ];

                                    await quickReply(entry.messaging[0], uploadedImages.message, quickReplies);
                                }
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                            }

                        }

                        // user has proceeded with additional note request
                        else if (quick_reply?.payload === "quot_add_note_1") {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].TYPE_MESSAGE, "CONFIRMED_EVENT_UPDATE", "6.3.n");
                        }

                        // user is entering the notes description
                        else if (instaChatbot?.last_message === "6.3.n" && !quick_reply?.payload && text) {
                            instaChatbot.quotation.desc = text;
                            await instaChatbot.save();

                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].YES, payload: "bargain_yes" },
                                { content_type: "text", title: lang[selectedLanguage].NO, payload: "bargain_no" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ];

                            await quickReply(entry.messaging[0], lang[selectedLanguage].BARGAIN_PROMPT, quickReplies, "4");
                        }

                        // user is adding images
                        else if (quick_reply?.payload === "quot_images_yes") {
                            const quickReplies = [
                                { content_type: "text", title: `⬅️ ${lang[selectedLanguage].BACK_BUTTON_TITLE}`, payload: "quot_back_btn" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },

                            ];
                            await quickReply(entry.messaging[0], lang[selectedLanguage].ATTACH_DOCUMENT_ASK, quickReplies, "6.5");
                        }

                        // if user has entered invalid file type
                        else if ((messaging?.message?.is_unsupported || text) && instaChatbot?.last_message === "6.5" && !quick_reply?.payload) {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                        }

                        // user has proceeded with attachments
                        else if (messaging?.message?.attachments && instaChatbot?.last_message === "6.5" && !quick_reply?.payload) {
                            const { validCount, allImagesAndVideos } = validateAttachments(messaging.message.attachments);

                            if (!validCount) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].FILE_ATTACHMENT_LIMIT, "CONFIRMED_EVENT_UPDATE");
                                return;
                            }

                            if (allImagesAndVideos) {

                                const uploadedImages = await uploadToS3("payment_request", account._id, messaging.message.attachments);
                                console.log(uploadedImages, "uploadedImages")
                                if (uploadedImages.status) {
                                    for (const image of uploadedImages.uploadedFiles) {
                                        instaChatbot.quotation.images.push({
                                            key: image.key,
                                            url: image.url,
                                            ETag: image.ETag
                                        })
                                    }
                                    await instaChatbot.save();
                                    // const quickReplies = [
                                    //     { content_type: "text", title: lang[selectedLanguage].YES, payload: "bargain_yes" },
                                    //     { content_type: "text", title: lang[selectedLanguage].NO, payload: "bargain_no" },
                                    //     { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    // ];

                                    // await quickReply(entry.messaging[0], lang[selectedLanguage].BARGAIN_PROMPT, quickReplies, "4");
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].YES, payload: "quot_add_note_1" },
                                        { content_type: "text", title: lang[selectedLanguage].NO, payload: "quot_skip_attch" },
                                    ]

                                    await quickReply(entry.messaging[0], lang[selectedLanguage].ATTACH_NOTE_PROMPT, quickReplies, "4");
                                } else {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ];

                                    await quickReply(entry.messaging[0], uploadedImages.message, quickReplies, "4");
                                }
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].INVALID_ATTACHMENT_TYPE, "CONFIRMED_EVENT_UPDATE");
                            }
                        }

                        else if (quick_reply?.payload === "quot_skip_attch") {
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].YES, payload: "bargain_yes" },
                                { content_type: "text", title: lang[selectedLanguage].NO, payload: "bargain_no" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ];

                            await quickReply(entry.messaging[0], lang[selectedLanguage].BARGAIN_PROMPT, quickReplies, "4");
                        }

                        else if (quick_reply?.payload === "bargain_yes" || quick_reply?.payload === "bargain_no") {
                            if (quick_reply?.payload === "bargain_yes") {
                                instaChatbot.quotation.bargain = true;
                                await instaChatbot?.save()
                            } else {
                                instaChatbot.quotation.bargain = false;
                                await instaChatbot?.save()
                            }

                            const quotationWallet = await Wallet.findById(instaChatbot.quotation.currency)
                            const quotationReceiver = await Account.findById(instaChatbot.quotation.beneficiary).populate(['user', 'company'])

                            const message = `
${lang[selectedLanguage].QUOTE_REQUEST_INITIATION
                                    .replace("{{amount}}", formattedAmount(instaChatbot?.quotation?.amount))
                                    .replace("{{currency}}", quotationWallet.currency.code)
                                    .replace("{{user}}", quotationReceiver?.username)
                                } 

${lang[selectedLanguage].PROCEED} `


                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].SEND_QUOTE, payload: "continue_quot" },
                                { content_type: "text", title: lang[selectedLanguage].EDIT_QUOTE, payload: "create_quote" },
                                { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "cancel_quot" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]

                            await quickReply(entry.messaging[0], message, quickReplies, "4");

                        }

                        // user has cancelled the quotation
                        else if (quick_reply?.payload === "cancel_quot") {
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]

                            await quickReply(entry.messaging[0], 'Your quotation has been cancelled as per your request.', quickReplies, "4");
                        }

                        // user has continued quotation
                        else if (quick_reply?.payload === "continue_quot") {
                            await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "proceed_quot", "6.6", "Transaction OTP");
                        }

                        // user has confirmed the quotation
                        else if (instaChatbot?.last_message === "6.6" && text && !quick_reply?.payload) {

                            const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "proceed_quot");

                            if (otpValidationResult.status) {

                                const quotation = instaChatbot?.quotation;

                                const data = {
                                    account_id: account?._id,
                                    reciever_id: quotation?.beneficiary,
                                    title: quotation?.title,
                                    desc: quotation?.desc,
                                    amount: quotation?.amount,
                                    bargain: quotation?.bargain,
                                    sender_wallet_id: quotation?.currency,
                                    images: quotation?.images
                                }
                                console.log(data)
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].CREATING_QUOTATION, "CONFIRMED_EVENT_UPDATE");

                                const quotDetails = await addQuotation(data)
                                console.log(quotDetails, "quotDetails")
                                if (quotDetails?.status) {
                                    const quotationDetails = quotDetails?.message;
                                    console.log(quotationDetails?.reciever)
                                    const quotationReceiver = await Account.findById(quotationDetails?.reciever).populate(['user', 'insta_recipient_id'])
                                    const walletDetails = await Wallet.findById(quotationDetails?.amount_reciever_currency)

                                    const senderTimezone = account?.timezone || "UTC"

                                    const senderCurrentTime = moment().tz(senderTimezone).format();

                                    // quotation creating message
                                    const message = `Your quote has been sent! Quotation ID: ${quotationDetails?.reference_id}`

                                    const quotationInfo = `
${lang[selectedLanguage].AMOUNT}: ${formattedAmount(quotationDetails?.amount?.toFixed(2))} ${walletDetails?.currency?.code}
${lang[selectedLanguage].BENEFICIARY}: ${quotationReceiver?.user?.first_name} ${quotationReceiver?.user?.last_name}
Date sent: ${formatDateToDDMMYYYY(senderCurrentTime)}
${lang[selectedLanguage].TITLE}: ${quotationDetails?.title}
`;
                                    // ${lang[selectedLanguage].BARGAIN}: ${quotationDetails?.bargain ? lang[selectedLanguage].ALLOWED : lang[selectedLanguage].NOT_ALLOWED}
                                    const templatePayload1 = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: message,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Quote%20Sent.png",
                                                subtitle: quotationInfo,

                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: `main_menu`,
                                                    },


                                                ]
                                            },
                                        ]
                                    };

                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload1, "4")

                                    // quotation receiving message
                                    const data1 = {
                                        sender: { id: quotationReceiver?.insta_recipient_id?.recipient }
                                    }

                                    const receiverLang = quotationReceiver?.insta_recipient_id?.active_language || quotationReceiver?.language || "en"

                                    const buttons = [
                                        {
                                            type: "postback",
                                            title: "Accept Quote",
                                            payload: `accept_quot-${quotationDetails?._id}`,
                                        },
                                        {
                                            type: "postback",
                                            title: lang[receiverLang].DECLINE,
                                            payload: `decline_quot-${quotationDetails?._id}`,
                                        },
                                    ];
                                    if (quotationDetails?.bargain) {
                                        buttons.push({
                                            type: "postback",
                                            title: "Negotiate",
                                            payload: `bargain_quot-${quotationDetails?._id}`,
                                        },)
                                    }
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `You've received a new quote from ${account?.username}`,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Send%20A%20Quote.png",
                                                subtitle: `${lang[receiverLang].COUNTRY_LABEL}: ${getCountryNameByCode(account?.user_nationaility)}\n${lang[receiverLang].AMOUNT}: ${formattedAmount(quotationDetails?.amount?.toFixed(2))} ${walletDetails?.currency?.code}
                                                `,
                                                // ${lang[receiverLang].BARGAIN}: ${quotationDetails?.bargain ? lang[receiverLang].ALLOWED : lang[receiverLang].NOT_ALLOWED}
                                                // ${lang[receiverLang].TITLE}: ${quotationDetails?.title}
                                                // ${lang[receiverLang].DESCRIPTION}: ${quotationDetails?.desc}

                                                buttons,
                                            },
                                        ]
                                    };
                                    await sendTemplate(data1, quotationReceiver?.insta_recipient_id?.recipient, templatePayload, "4")

                                    // view details template
                                    const templatePayload2 = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `Click below to view details`,
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: "View details",
                                                        payload: `view_quot_details-${quotationDetails._id}`,
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: lang[receiverLang].MAIN_MENU_MESSAGE,
                                                        payload: "main_menu",
                                                    },

                                                ]
                                            },
                                        ]
                                    };
                                    await sendTemplate(data1, quotationReceiver?.insta_recipient_id?.recipient, templatePayload2, "4")
                                    // if (quotationDetails?.images?.length > 0) {

                                    //     const data1 = {
                                    //         sender: { id: quotationReceiver?.insta_recipient_id?.recipient },
                                    //     };

                                    //     await quickMessage(data1, "Attached are details with the quotation 👇", "CONFIRMED_EVENT_UPDATE");

                                    //     const attachments = quotationDetails?.images;

                                    //     await sendMultipleImages(attachments, quotationReceiver?.insta_recipient_id?.recipient);

                                    // }
                                } else {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" },
                                    ];
                                    await quickReply(entry.messaging[0], lang[selectedLanguage].CREATE_QUOTATION_ERROR, quickReplies, "4");
                                }

                                instaChatbot.flowFlag = false;
                                instaChatbot.flowId = "";
                                await instaChatbot.save()
                            } else {
                                if (otpValidationResult.message === "max_attempts_exceeded") {

                                    await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                                } else {

                                    await invalidMessage(entry.messaging[0], "proceed_quot", selectedLanguage, instaChatbot?.otpType);
                                }
                            }
                        }

                        // user has clicked on view quotation details
                        else if (messaging?.postback?.payload.includes("view_quot_details-")) {
                            const quotationId = messaging?.postback?.payload.split("-")[1]
                            const quotation = await Quotation.findById(quotationId).populate("amount_reciever_currency")

                            console.log({ quotation })

                            const message = `
Quotation ID: ${quotation?.reference_id}\n
${lang[selectedLanguage].AMOUNT}: ${formattedAmount(quotation?.revised_amount || quotation?.amount)} ${quotation.amount_reciever_currency.currency.code}\n
${lang[selectedLanguage].TITLE}: ${quotation?.title}\n
${lang[selectedLanguage].DESCRIPTION}: ${quotation?.desc}\n                   
${lang[selectedLanguage].BARGAIN}: ${quotation?.bargain ? lang[selectedLanguage].ALLOWED : lang[selectedLanguage].NOT_ALLOWED}
                            `

                            await quickMessage(entry.messaging[0], message, "CONFIRMED_EVENT_UPDATE", "4")

                            if (quotation?.images?.length > 0) {

                                const attachments = quotation?.images;

                                await sendMultipleImages(attachments, messaging?.sender?.id);

                            }
                        }

                        // second has user clicked on accept quotation
                        else if (messaging?.postback?.payload.includes("accept_quot-") || quick_reply?.payload === "back_quot") {
                            let quotation
                            let quotationId
                            if (quick_reply?.payload !== "back_quot") {
                                quotationId = messaging?.postback?.payload.split('-')[1]

                                quotation = await Quotation.findById(quotationId);
                            } else {
                                quotation = await Quotation.findById(instaChatbot.quotation.accepting_quotation);
                            }

                            // validate if the current quotation belongs to the current account
                            if (quotation?.reciever.toString() !== account._id.toString()) {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], "The quotation does not belong to you.", quickReplies, "4")

                                return;
                            }
                            // if user has already accepted the quotation
                            if (quotation?.status !== "sent" && quotation?.status !== "bargain-accepted" && quotation?.status !== "revise") {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], "The quotation has already been accepted, declined, or is currently in process.", quickReplies, "4");
                            } else {
                                const pans = await PanModel.find({ account: account._id });

                                if (pans.length !== 0) {
                                    const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].PAYMENT_CARD, payload: "quotation_card_payment" },
                                        { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "quotation_wallets_payment" },
                                        { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "quotation_paypal" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");

                                } else {
                                    const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "quotation_wallets_payment" },
                                        { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "quotation_paypal" },
                                        { content_type: "text", title: lang[selectedLanguage].ADD_PAYMENT_CARD, payload: "add_payment_card-back_quot" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");
                                }

                                if (quotation) {
                                    instaChatbot.quotation.accepting_quotation = quotationId;
                                    await instaChatbot?.save();

                                    instaChatbot.flowFlag = true;
                                    instaChatbot.flowId = "accept_q_flag";
                                    await instaChatbot.save()
                                }
                            }
                        }

                        // if user is proceeding the quotation accepting with paypal
                        else if (quick_reply?.payload === "quotation_paypal" || messaging?.postback?.payload?.includes("quotation_paypal") || quick_reply?.payload?.includes("quotation_paypal") || (instaChatbot?.last_message?.includes("quotation_paypal") && text && !quick_reply?.payload)) {
                            console.log("did i ran?")
                            await w2wQuotationPaypal(
                                messaging.sender.id,
                                messaging?.postback?.payload || quick_reply?.payload,
                                account,
                                instaChatbot,
                                text,
                                selectedLanguage,
                            );
                            return
                        }
                        else if (quick_reply?.payload === "quotation_card_payment" || messaging?.postback?.payload?.includes("quotation_card_payment") || quick_reply?.payload?.includes("quotation_card_payment") || (instaChatbot?.last_message?.includes("quotation_card_payment") && text && !quick_reply?.payload)) {
                            const message = `The selected payment method is currently unavailable and will be available soon. Thank you for your patience`;

                            const quickReplies = [
                                { content_type: "text", title: "Select another", payload: "back_quot" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]

                            await quickReply(entry.messaging[0], message, quickReplies, "4");
                        }

                        // if user has selected accepting quotation with instapay wallets
                        else if (quick_reply?.payload === "quotation_wallets_payment") {
                            const wallets = await Wallet.find({ account: account._id, wallet_type: 'insta', status: "active" });
                            const limitedWallets = wallets.slice(0, 8)
                            const quickReplies = limitedWallets.map(wallet => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `accept_quot_wallet-${wallet._id}` } })
                            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })

                            const message = "Select the Wallet currency you would like to pay with."
                            await quickReply(entry.messaging[0], message, quickReplies, "4");
                        }
                        // user has proceeded with Payment Card
                        // if user has selected w2w with Payment Card
                        // else if (quick_reply?.payload === "updated_w2w_card_payment_quot" || messaging?.postback?.payload?.includes("updated_w2w_card_payment") || quick_reply?.payload?.includes("updated_w2w_card_payment") || (instaChatbot?.last_message?.includes("updated_w2w_card_payment") && text)) {
                        //     console.log("did i ran?")
                        //     await w2wUsingCard(
                        //         messaging.sender.id,
                        //         messaging?.postback?.payload || quick_reply?.payload,
                        //         account,
                        //         instaChatbot,
                        //         text,
                        //         selectedLanguage,
                        //         "quotation"
                        //     );
                        //     return
                        // }

                        // second user has selected wallet
                        else if (quick_reply?.payload.includes("accept_quot_wallet-")) {
                            const walletId = quick_reply?.payload.split('-')[1]
                            const walletDetails = await Wallet.findById(walletId);
                            console.log(walletDetails, "walletDetails")
                            const quotation = await Quotation.findById(instaChatbot.quotation.accepting_quotation).populate("amount_reciever_currency")

                            console.log(quotation, "quotation")

                            const { exchange_rate, fee, totalAmountWithFee } = await calculateExchangeAndFees(walletDetails.currency.code, quotation.amount_reciever_currency.currency.code, parseFloat(quotation?.revised_amount || quotation?.amount), "quotation", account?.level._id, "wallet", walletDetails, "request");

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
    
       `
                                } else {
                                    message = `
Wallet Balance: ${formattedAmount(walletDetails.balance.available)} ${walletDetails.currency.code}

${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}

${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}

${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(quotation?.revised_amount || quotation.amount)} ${quotation.amount_reciever_currency.currency.code}
    
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}
    `
                                }

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].ADD_FUNDS, payload: "add_funds" },
                                    { content_type: "text", title: lang[selectedLanguage].ANOTHER_WALLET_TITLE, payload: "another_quot_wallet" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickMessage(entry.messaging[0], message, "CONFIRMED_EVENT_UPDATE")
                                return await quickReply(entry.messaging[0], 'Insufficient Balance! Please topup your wallet.', quickReplies, "4");
                            }

                            instaChatbot.quotation.accepting_currency = walletId;
                            await instaChatbot?.save();

                            const message1 = `${lang[selectedLanguage].CURRENTLY_HAVE.replace('{{amount}}', formattedAmount(walletDetails?.balance?.available)).replace('{{currency}}', walletDetails.currency.code)}\n\n${lang[selectedLanguage].PROCEED_OR_SELECT_WALLET}`;
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].PROCEED_TITLE, payload: "quot_proceed" },
                                { content_type: "text", title: lang[selectedLanguage].ANOTHER_WALLET_TITLE, payload: "another_quot_wallet" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]

                            await quickReply(entry.messaging[0], message1, quickReplies, "4");

                        }

                        else if (quick_reply?.payload === "another_quot_wallet") {
                            const wallets = await Wallet.find({ account: account?._id, wallet_type: 'insta', status: "active" });
                            const slicedWallets = wallets.slice(0, 8)

                            const quickReplies = slicedWallets?.map((wallet) => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `accept_quot_wallet-${wallet._id}` } })
                            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })

                            await quickReply(entry.messaging[0], lang[selectedLanguage].PICK_CURRENCY_MESSAGE, quickReplies, "4");
                        }

                        // second user has proceed with the wallet
                        else if (quick_reply?.payload === "quot_proceed") {
                            const walletDetails = await Wallet.findById(instaChatbot.quotation.accepting_currency)

                            const quotation = await Quotation.findById(instaChatbot.quotation.accepting_quotation).populate("amount_reciever_currency")

                            const { exchange_rate, fee, totalAmountWithFee } = await calculateExchangeAndFees(walletDetails.currency.code, quotation.amount_reciever_currency.currency.code, parseFloat(quotation?.revised_amount || quotation.amount), "quotation", account?.level._id, "wallet", walletDetails, "request");

                            let message

                            if (walletDetails.currency.code !== quotation.amount_reciever_currency.currency.code) {

                                message = `
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${walletDetails.currency.code} = ${formattedAmount(exchange_rate, 6)} ${quotation.amount_reciever_currency.currency.code}
   
${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(quotation?.revised_amount || quotation.amount)} ${quotation.amount_reciever_currency.currency.code}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}

   `
                            } else {
                                message = `
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}

${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(quotation?.revised_amount || quotation.amount)} ${quotation.amount_reciever_currency.currency.code}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}
`
                            }
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].YES_CONTINUE_TITLE, payload: "quo_proceed_trans" },
                                { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "main_menu" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]

                            await quickReply(entry.messaging[0], message, quickReplies, "4");
                        }

                        // second user has proceed with the transaction
                        else if (quick_reply?.payload === "quo_proceed_trans") {
                            await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_quot", "6.7", "Transaction OTP");
                        }

                        // second user has entered otp for accepting the quotation
                        else if (instaChatbot?.last_message === "6.7" && text && !quick_reply?.payload) {
                            const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "confirm_quot");

                            if (otpValidationResult.status) {


                                const quotationDetails = await Quotation.findOne({
                                    _id: instaChatbot?.quotation?.accepting_quotation,
                                    status: { $nin: ['accepted', 'declined'] }
                                });

                                if (!quotationDetails) {
                                    await quickMessage(entry.messaging[0], lang[selectedLanguage].QUOTATION_ALREADY_PROCESSED, "CONFIRMED_EVENT_UPDATE", "4");
                                    return
                                }
                                // console.log(data)
                                let amount;
                                if (quotationDetails.revised_amount) {
                                    amount = quotationDetails.revised_amount
                                } else {
                                    amount = quotationDetails.amount
                                }

                                const receiver_Wallet = await Wallet.findById(quotationDetails.amount_reciever_currency);

                                const files = quotationDetails?.images.map(image => ({
                                    key: image.key,
                                    url: image.url,
                                    ETag: image.ETag,
                                    status: true
                                }));

                                console.log(receiver_Wallet?.wallet_id, instaChatbot?.quotation?.accepting_currency, "quotationDetails.amount_reciever_currency")

                                let data = {
                                    sender_wallet_id: instaChatbot?.quotation?.accepting_currency,
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
                                }

                                const walletToWaletResponse = await walletToWalletTransaction(data)

                                console.log(walletToWaletResponse, "walletToWaletResponse")

                                // const acceptDetails = await acceptQuotation(data)
                                if (walletToWaletResponse.status) {

                                    console.log(quotationDetails)

                                    await Quotation.findByIdAndUpdate(instaChatbot?.quotation?.accepting_quotation, { $set: { status: 'accepted' } });
                                    // const quotationDetails = acceptDetails?.message;
                                    const quotationSender = await Account.findById(quotationDetails?.sender).populate('insta_recipient_id')
                                    console.log(quotationSender, "quotationSender")
                                    const currencyDetails = await Wallet.findById(quotationDetails?.amount_reciever_currency)

                                    const quotationInfo = `
Quotation ID: ${quotationDetails.reference_id}
${lang[selectedLanguage].AMOUNT}: ${quotationDetails?.revised_amount ? formattedAmount(quotationDetails?.revised_amount?.toFixed(2)) : formattedAmount(quotationDetails?.amount?.toFixed(2))} ${currencyDetails?.currency.code}
Username: ${quotationSender?.username}
${lang[selectedLanguage].TITLE}: ${quotationDetails?.title}
                                `

                                    // accepting message
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `You've accepted the quote. The payment will be processed per the agreed terms.`,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Quote%20Accepted.png",
                                                subtitle: quotationInfo,

                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: `main_menu`,
                                                    },


                                                ]
                                            },
                                        ]
                                    };

                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")

                                    // receiver message
                                    const receiverLang = quotationSender?.insta_recipient_id?.active_language || quotationSender?.language || "en"

                                    const message1 = `Excellent! ${account?.username} has accepted your quote!`
                                    const templatePayload1 = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: message1,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Quote%20Approved.png",
                                                subtitle: quotationInfo,

                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[receiverLang].CASH_OUT_NOW,
                                                        payload: `cash_out_id_${walletToWaletResponse?.exchanged?._id}`,
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: lang[receiverLang].MAIN_MENU_MESSAGE,
                                                        payload: `main_menu`,
                                                    },


                                                ]
                                            },
                                        ]
                                    };
                                    const data = {
                                        sender: { id: quotationSender?.insta_recipient_id?.recipient },
                                    }
                                    await sendTemplate(data, quotationSender?.insta_recipient_id?.recipient, templatePayload1)
                                }
                                else if (walletToWaletResponse?.message.includes("feature_not_available")) {
                                    const featureType = walletToWaletResponse?.message?.split("_")[3]
                                    const message = usersFeatureMessage(featureType)

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");
                                }
                                else if (walletToWaletResponse?.message.includes("limit_")) {
                                    const limitCode = walletToWaletResponse?.message?.split("_")[1]
                                    const sendingAmounts = walletToWaletResponse?.sendingAmounts

                                    const message = userLimitsMessage(limitCode, sendingAmounts)

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");
                                }
                                else {
                                    const quickReplies = [
                                        // { content_type: "text", title: "Proceed", payload: "quot_proceed" },
                                        { content_type: "text", title: "Check Wallet Balance", payload: "wallet_overview" },
                                        { content_type: "text", title: "Contact Support", payload: "assistance" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]
                                    await quickReply(entry.messaging[0], "The transaction could not be processed. Please review your wallet balance or try again later", quickReplies, "4");
                                }

                                instaChatbot.flowFlag = false;
                                instaChatbot.flowId = "";
                                await instaChatbot.save()

                            } else {
                                if (otpValidationResult.message === "max_attempts_exceeded") {

                                    await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                                } else {

                                    await invalidMessage(entry.messaging[0], "confirm_quot", selectedLanguage, instaChatbot?.otpType);
                                }
                            }

                        }

                        // user has selected for bargain
                        else if (messaging?.postback?.payload.includes("bargain_quot-")) {
                            const quotationId = messaging?.postback?.payload.split('-')[1]

                            const quotation = await Quotation.findById(quotationId).populate("amount_reciever_currency")

                            if (quotation?.status === "accepted") {
                                const message = lang[selectedLanguage].QUOTATION_ALREADY_ACCEPTED
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            } else if (quotation?.status === "bargain" || quotation?.status === "revise") {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], lang[selectedLanguage].BARGAIN_AMOUNT_ALREADY_ADDED, quickReplies, "4");

                            } else {
                                instaChatbot.quotation.accepting_quotation = quotationId;
                                await instaChatbot?.save();

                                await quickMessage(entry.messaging[0], `Enter your counter offer in ${quotation?.amount_reciever_currency?.currency.code}, and we'll send it back for approval.`, "CONFIRMED_EVENT_UPDATE", "6.8");
                            }
                            instaChatbot.flowFlag = true;
                            instaChatbot.flowId = "bargain_q_flag";
                            await instaChatbot.save()
                        }
                        // user has entered bargaining amount
                        else if (instaChatbot?.last_message === "6.8" && text && !quick_reply?.payload) {
                            const digitRegex = /^\d+(\.\d+)?$/;
                            const isNumber = digitRegex.test(text)
                            const amount = parseFloat(text);
                            if (isNumber && amount >= 0.1) {
                                instaChatbot.quotation.bargain_amount = amount;
                                await instaChatbot.save()
                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_bargain", "6.9", "Transaction OTP");
                            } else if (amount <= 0.1) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].MINIMUM_AMOUNT, "CONFIRMED_EVENT_UPDATE");
                            }
                            else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_AMOUNT_DIGITS, "CONFIRMED_EVENT_UPDATE");
                            }
                        }

                        // user has entered otp for bargaining amount
                        else if (instaChatbot?.last_message === "6.9" && text && !quick_reply?.payload) {
                            const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "confirm_bargain");

                            if (otpValidationResult.status) {

                                const data = {
                                    revised_amount: instaChatbot.quotation.bargain_amount,
                                    quotation_id: instaChatbot.quotation.accepting_quotation
                                }
                                const quotationDetails = await bargain(data)

                                if (quotationDetails?.status) {
                                    const quotation = quotationDetails?.quotation;
                                    console.log(quotation, "quotation")

                                    const quotationSender = await Account.findById(quotation?.sender).populate('insta_recipient_id')
                                    const currencyDetails = await Wallet.findById(quotation?.amount_reciever_currency)

                                    const quotationInfo = `
Quotation ID: ${quotation.reference_id}
${lang[selectedLanguage].BARGAINING_AMOUNT}: ${formattedAmount(quotation?.revised_amount)} ${currencyDetails?.currency.code}
${lang[selectedLanguage].TITLE}: ${quotation?.title}
${lang[selectedLanguage].STATUS}: Negotiation in Progress

`;


                                    // accepting message
                                    const message = `
You have successfully submitted a counteroffer in ${currencyDetails?.currency.code} for the quote sent by ${quotationSender?.username}.
${quotationInfo}`

                                    const quickReplies = [
                                        // // { content_type: "text", title: "Another wallet", payload: "quot_another_w" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]
                                    await quickReply(entry.messaging[0], message, quickReplies, "4");

                                    // receiver message
                                    const data = {
                                        sender: { id: quotationSender?.insta_recipient_id?.recipient },
                                    }

                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `${account?.username} has proposed a new amount. Review and respond.`,
                                                // image_url: benefAccount?.profileImage?.url,
                                                subtitle: quotationInfo,

                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: "Accept New Amount",
                                                        payload: `accept_new_amount-${quotation?._id}`,
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: "Re-negotiate",
                                                        payload: `revise_quot-${quotation?._id}`,
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].DECLINE,
                                                        payload: `decline_quot_sender-${quotation?._id}`,
                                                    },

                                                ]
                                            },
                                        ]
                                    };

                                    await sendTemplate(data, quotationSender?.insta_recipient_id?.recipient, templatePayload, "4")

                                } else {
                                    const quickReplies = [
                                        // { content_type: "text", title: "Proceed", payload: "quot_proceed" },
                                        // // { content_type: "text", title: "Another wallet", payload: "quot_another_w" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]
                                    await quickReply(entry.messaging[0], lang[selectedLanguage].BARGAINING_AMOUNT_FAILED, quickReplies, "4");
                                }
                                instaChatbot.flowFlag = false;
                                instaChatbot.flowId = "";
                                await instaChatbot.save()
                            } else {
                                if (otpValidationResult.message === "max_attempts_exceeded") {

                                    await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                                } else {

                                    await invalidMessage(entry.messaging[0], "confirm_bargain", selectedLanguage, instaChatbot?.otpType);
                                }
                            }
                        }

                        // user has proceed with revision of the bargained amount
                        else if (messaging?.postback?.payload.includes("revise_quot-")) {

                            const quotationId = messaging?.postback?.payload.split('-')[1]

                            const quotation = await Quotation.findById(quotationId);

                            if (quotation?.status === "accepted") {
                                const message = lang[selectedLanguage].QUOTATION_ALREADY_ACCEPTED
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            } else if (quotation?.status === "revise") {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], lang[selectedLanguage].REVISED_AMOUNT_ALREADY_ADDED, quickReplies, "4");

                            } else {
                                instaChatbot.quotation.accepting_quotation = quotationId;
                                await instaChatbot?.save();

                                await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_REVISION_AMOUNT, "CONFIRMED_EVENT_UPDATE", "6.10");
                            }

                            instaChatbot.flowFlag = true;
                            instaChatbot.flowId = "revise_q_flag";
                            await instaChatbot.save()
                        }

                        // user has entered the revision amount
                        else if (instaChatbot?.last_message === "6.10" && text && !quick_reply?.payload) {
                            const digitRegex = /^\d+(\.\d+)?$/;
                            const isNumber = digitRegex.test(text)
                            const amount = parseFloat(text);
                            if (isNumber && amount >= 0.1) {
                                instaChatbot.quotation.revised_amount = amount;
                                await instaChatbot.save()

                                await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_revision", "6.11", "Transaction OTP");
                            } else if (amount <= 0.1) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].MINIMUM_AMOUNT, "CONFIRMED_EVENT_UPDATE");
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_AMOUNT_DIGITS, "CONFIRMED_EVENT_UPDATE");
                            }
                        }

                        // user has entered the otp for revision amount
                        else if (instaChatbot?.last_message === "6.11" && text && !quick_reply?.payload) {
                            const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "confirm_revision");

                            if (otpValidationResult.status) {

                                const data = {
                                    revised_amount: instaChatbot.quotation.revised_amount,
                                    quotation_id: instaChatbot.quotation.accepting_quotation
                                }
                                const quotationDetails = await revise(data)

                                if (quotationDetails?.status) {
                                    const quotation = quotationDetails?.quotation;
                                    console.log(quotation, "quotation")

                                    const quotationReceiver = await Account.findById(quotation?.reciever).populate('insta_recipient_id')
                                    const currencyDetails = await Wallet.findById(quotation?.amount_reciever_currency)

                                    const quotationInfo = `
Quotation ID: ${quotation.reference_id}
${lang[selectedLanguage].AMOUNT}: ${formattedAmount(quotation?.revised_amount)} ${currencyDetails?.currency.code}
${lang[selectedLanguage].TITLE}: ${quotation?.title}
${lang[selectedLanguage].STATUS}: ${quotation?.status}
                                `


                                    // accepting message
                                    const message = `
${lang[selectedLanguage].YOU_HAVE_ADDED_REVISION_AMOUNT} ${quotationReceiver?.username}.
${quotationInfo}
                                `

                                    const quickReplies = [
                                        // // { content_type: "text", title: "Another wallet", payload: "quot_another_w" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]
                                    await quickReply(entry.messaging[0], message, quickReplies, "4");

                                    // receiver message
                                    const data = {
                                        sender: { id: quotationReceiver?.insta_recipient_id?.recipient },
                                    }

                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `${lang[selectedLanguage].REVISION_AMOUNT_ADDED} ${account?.username}.`,
                                                // image_url: benefAccount?.profileImage?.url,
                                                subtitle: quotationInfo,

                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].ACCEPT,
                                                        payload: `accept_quot-${quotation?._id}`,
                                                    },
                                                    // {
                                                    //     type: "postback",
                                                    //     title: 'Revise Amount',
                                                    //     payload: `revise_quot-${quotation?._id}`,
                                                    // },
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].DECLINE,
                                                        payload: `decline_quot-${quotation?._id}`,
                                                    },

                                                ]
                                            },
                                        ]
                                    };

                                    await sendTemplate(data, quotationReceiver?.insta_recipient_id?.recipient, templatePayload, "4")

                                } else {
                                    const quickReplies = [
                                        // { content_type: "text", title: "Proceed", payload: "quot_proceed" },
                                        // // { content_type: "text", title: "Another wallet", payload: "quot_another_w" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]
                                    await quickReply(entry.messaging[0], lang[selectedLanguage].REVISION_AMOUNT_FAILED, quickReplies, "4");
                                }

                                instaChatbot.flowFlag = false;
                                instaChatbot.flowId = "";
                                await instaChatbot.save()

                            } else {
                                if (otpValidationResult.message === "max_attempts_exceeded") {

                                    await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                                } else {

                                    await invalidMessage(entry.messaging[0], "confirm_revision", selectedLanguage, instaChatbot?.otpType);
                                }
                            }
                        }

                        // user has accepted the new quotation amount from receiver
                        else if (messaging?.postback?.payload.includes("accept_new_amount-")) {
                            const quotationId = messaging?.postback?.payload.split('-')[1]

                            const quotation = await Quotation.findById(quotationId)
                                .populate([
                                    { path: "reciever", populate: { path: "insta_recipient_id" } },
                                    { path: "sender" },
                                    { path: "amount_sender_currency" },
                                    { path: "amount_reciever_currency" }
                                ]);

                            // console.log(quotation.reciever, quotation.sender)

                            if (quotation?.status === "accepted") {
                                const message = lang[selectedLanguage].QUOTATION_ALREADY_ACCEPTED
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            } else if (quotation?.status === "declined") {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], lang[selectedLanguage].QUOTATION_ALREADY_DECLINED, quickReplies, "4");
                            } else if (quotation?.status === "revise") {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], lang[selectedLanguage].REVISED_AMOUNT_ALREADY_ADDED, quickReplies, "4");
                            } else {
                                quotation.status = "bargain-accepted"
                                await quotation.save()
                                const quotationInfo = `
Quotation ID: ${quotation.reference_id}
${lang[selectedLanguage].AMOUNT}: ${formattedAmount(quotation?.revised_amount)} ${quotation.amount_reciever_currency.currency.code}
${lang[selectedLanguage].TITLE}: ${quotation?.title}`
                                const templatePayload = {
                                    template_type: "generic",
                                    elements: [
                                        {
                                            title: `You've accepted the counter offer of ${formattedAmount(quotation.revised_amount)} ${quotation.amount_reciever_currency.currency.code}`,
                                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                                            subtitle: quotationInfo,

                                            buttons: [
                                                {
                                                    type: "postback",
                                                    title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                    payload: `main_menu`,
                                                },


                                            ]
                                        },
                                    ]
                                };

                                await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")

                                // recipient message
                                if (quotation?.reciever?.insta_recipient_id) {
                                    const receiverLang = quotation?.reciever?.insta_recipient_id?.active_language || quotation?.reciever?.language || "en"

                                    const templatePayload1 = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `Your counteroffer of ${formattedAmount(quotation.revised_amount)} ${quotation.amount_reciever_currency.currency.code} has been accepted. Please proceed.`,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                                                subtitle: quotationInfo,

                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: "Accept Quote",
                                                        payload: `accept_quot-${quotation?._id}`,
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: lang[receiverLang].DECLINE,
                                                        payload: `decline_quot-${quotation?._id}`,
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: `main_menu`,
                                                    },
                                                ]
                                            },
                                        ]
                                    };

                                    const data = {
                                        sender: { id: quotation?.reciever?.insta_recipient_id?.recipient },
                                    }

                                    await sendTemplate(data, quotation?.reciever?.insta_recipient_id?.recipient, templatePayload1, "4")
                                }
                            }
                        }

                        // quotation sender is declining the quotation
                        else if (messaging?.postback?.payload.includes("decline_quot_sender-")) {
                            const quotationId = messaging?.postback?.payload.split('-')[1]

                            const quotation = await Quotation.findById(quotationId);

                            if (quotation?.status === "accepted") {
                                const message = lang[selectedLanguage].QUOTATION_ALREADY_ACCEPTED
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            } else if (quotation?.status === "declined") {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], lang[selectedLanguage].QUOTATION_ALREADY_DECLINED, quickReplies, "4");
                            } else {
                                const declinedQuotationDetails = await declineQuotation(quotationId);
                                if (declinedQuotationDetails.status) {
                                    const quotationSender = await Account.findById(quotation?.sender).populate('insta_recipient_id')
                                    const quotationReceiver = await Account.findById(quotation?.reciever).populate('insta_recipient_id')
                                    const currencyDetails = await Wallet.findById(quotation?.amount_reciever_currency)
                                    const quotationInfo = `
Quotation ID: ${quotation?.reference_id}
${lang[selectedLanguage].AMOUNT}: ${formattedAmount(quotation?.revised_amount) ? formattedAmount(quotation?.revised_amount?.toFixed(2)) : formattedAmount(quotationDetails?.amount?.toFixed(2))} ${currencyDetails?.currency.code}
${lang[selectedLanguage].TITLE}: ${quotation?.title}
                                `

                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `You've declined the quote sent to ${quotationReceiver?.username}. No payment will be processed.`,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Quote%20Declined.png",
                                                subtitle: quotationInfo,

                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: "Send New Quote",
                                                        payload: `send_quotation`,
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: `main_menu`,
                                                    },


                                                ]
                                            },
                                        ]
                                    };

                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                    // receiver message
                                    if (quotationReceiver?.insta_recipient_id?.recipient) {
                                        const message1 = `A quote sent to you by ${account?.username} has been declined.`
                                        const templatePayload1 = {
                                            template_type: "generic",
                                            elements: [
                                                {
                                                    title: message1,
                                                    image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Quote%20Declined.png",
                                                    subtitle: quotationInfo,

                                                    buttons: [
                                                        {
                                                            type: "postback",
                                                            title: "Quote Details",
                                                            payload: `view_quot_details-${quotationId}`,
                                                        },
                                                        {
                                                            type: "postback",
                                                            title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                            payload: `main_menu`,
                                                        },
                                                    ]
                                                },
                                            ]
                                        };

                                        const data = {
                                            sender: { id: quotationReceiver?.insta_recipient_id?.recipient },
                                        }

                                        await sendTemplate(data, quotationReceiver?.insta_recipient_id?.recipient, templatePayload1, "4")
                                    }
                                } else {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]
                                    await quickReply(entry.messaging[0], lang[selectedLanguage].DECLINING_QUOTATION_FAILED, quickReplies, "4");
                                }

                            }
                        }

                        // user has declined the quotation
                        else if (messaging?.postback?.payload.includes("decline_quot-")) {
                            const quotationId = messaging?.postback?.payload.split('-')[1]

                            const quotation = await Quotation.findById(quotationId);

                            if (quotation?.status === "accepted") {
                                const message = lang[selectedLanguage].QUOTATION_ALREADY_ACCEPTED
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            } else if (quotation?.status === "declined") {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], lang[selectedLanguage].QUOTATION_ALREADY_DECLINED, quickReplies, "4");
                            } else {

                                const declinedQuotationDetails = await declineQuotation(quotationId);
                                if (declinedQuotationDetails.status) {
                                    const quotationDetails = await Quotation.findById(quotationId)
                                    const quotationSender = await Account.findById(quotationDetails?.sender).populate('insta_recipient_id')
                                    const currencyDetails = await Wallet.findById(quotationDetails?.amount_reciever_currency)
                                    const quotationInfo = `
Quotation ID: ${quotationDetails.reference_id}
${lang[selectedLanguage].AMOUNT}: ${quotationDetails?.revised_amount ? formattedAmount(quotationDetails?.revised_amount?.toFixed(2)) : formattedAmount(quotationDetails?.amount?.toFixed(2))} ${currencyDetails?.currency.code}
${lang[selectedLanguage].TITLE}: ${quotationDetails?.title}
                                `

                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `You've declined the quote from ${quotationSender?.username}. No payment will be processed.`,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Quote%20Declined.png",
                                                subtitle: quotationInfo,

                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: `main_menu`,
                                                    },


                                                ]
                                            },
                                        ]
                                    };

                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                    // receiver message
                                    const message1 = `Heads up! ${account?.username} has declined your quote.`
                                    const templatePayload1 = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: message1,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Quote%20Declined.png",
                                                subtitle: quotationInfo,

                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: "Send New Quote",
                                                        payload: `send_quotation`,
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: "Quote Details",
                                                        payload: `view_quot_details-${quotationId}`,
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: `main_menu`,
                                                    },
                                                ]
                                            },
                                        ]
                                    };

                                    const data = {
                                        sender: { id: quotationSender?.insta_recipient_id?.recipient },
                                    }

                                    await sendTemplate(data, quotationSender?.insta_recipient_id?.recipient, templatePayload1, "4")
                                } else {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]
                                    await quickReply(entry.messaging[0], lang[selectedLanguage].DECLINING_QUOTATION_FAILED, quickReplies, "4");
                                }
                            }
                        }

                        /////////////////////////////////////////////////////////////
                        // CASH OUT FLOW //

                        else if (messaging?.postback?.payload.includes("cash_out_id") || quick_reply?.payload.includes("cash_out_id")) {

                            // first checking if user has any withdrawal channel
                            const countries = await fetchWithdrawalsCounties(account._id)

                            console.log(countries, "countries")

                            if (countries?.countries?.length === 0) {
                                const message = lang[selectedLanguage].NO_WITHDRAWAL_ACCOUNT_STEPS

                                const templatePayload = {
                                    template_type: "generic",
                                    elements: [
                                        {
                                            title: message,
                                            buttons: [
                                                {
                                                    type: "web_url",
                                                    title: lang[selectedLanguage].OPEN_INSTAPAY_APP,
                                                    url: "https://my.insta-pay.ch/login",
                                                },
                                                {
                                                    type: "postback",
                                                    title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                    payload: `main_menu`,
                                                },

                                            ],
                                        },


                                    ],

                                };
                                // await quickMessage(entry.messaging[0], message, "CONFIRMED_EVENT_UPDATE");
                                await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")

                                // const quickReplies = [
                                //     { content_type: "text", title: 'Add Channel', payload: "add_withdrawal" },
                                //     { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                // ]
                                // await quickReply(entry.messaging[0], message, quickReplies, "4");

                                return
                            }

                            let transaction_id;

                            if (quick_reply?.payload) {
                                const parts = quick_reply.payload.split('_');
                                if (parts.length > 3) {
                                    transaction_id = parts[3];
                                }
                            } else if (messaging?.postback?.payload) {
                                const parts = messaging.postback.payload.split('_');
                                if (parts.length > 3) {
                                    transaction_id = parts[3];
                                }
                            }

                            console.log(transaction_id, "transaction_id")

                            // account validation if transactions' account and current account matches
                            const transactionDetails = await Transaction.findById(transaction_id);

                            if (transactionDetails.account.toString() !== account._id.toString()) {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ];

                                return await quickReply(entry.messaging[0], `This transaction does not belong to you`, quickReplies);
                            }

                            instaChatbot.withdrawal.transaction_id = transaction_id
                            await instaChatbot.save()

                            let message = "Where would you like to cash out?"

                            const quickReplies = [
                                { content_type: "text", title: 'Default Account', payload: "withdrawal_default" },
                                { content_type: "text", title: 'Specify Account', payload: "withdrawal_specify" }
                            ]

                            await quickReply(entry.messaging[0], message, quickReplies, "4");

                        }

                        // user has selected default payout channel
                        else if (quick_reply?.payload === "withdrawal_default") {

                            const transactionDetails = await Transaction.findById(instaChatbot.withdrawal.transaction_id)

                            const defaultPayoutChannel = await findDefaultPayoutChannel(account._id)

                            if (!defaultPayoutChannel?.status) {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ]

                                return await quickReply(entry.messaging[0], "Something went wrong while getting the default payout channel. Please makre sure you have one.", quickReplies, "4");
                            }

                            const walletDetails = await Wallet.findById(transactionDetails.wallet).populate([
                                {
                                    path: 'account',
                                    populate: [

                                        { path: 'level' }
                                    ]
                                }
                            ]);

                            console.log(defaultPayoutChannel, "defaultPayoutChannel", transactionDetails)

                            const channelDetails = defaultPayoutChannel?.channelDetails

                            let exchangedAmountSender = await getExchangeRatesToUSD(transactionDetails.currency.code, 'USD', transactionDetails.amount)

                            const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, walletDetails, 'sending', true)

                            if (!sender_limits_check.status) {
                                await quickMessage(entry.messaging[0], sender_limits_check.message, "CONFIRMED_EVENT_UPDATE");
                                return
                            }

                            // let channel_name, service_name;
                            // if (channelDetails.service_id === "1") {
                            //     channel_name = "mobile_money";
                            //     service_name = "withdrawal_mobile_wallet";
                            // } else if (channelDetails.service_id === "2") {
                            //     channel_name = "bank_account";
                            //     service_name = "withdrawal_bank_transfer";
                            // } else if (channelDetails.service_id === "3") {
                            //     channel_name = "cash_pickup";
                            //     service_name = "withdrawal_cash_pickup";
                            // } else {
                            //     channel_name = "card_payment";
                            //     service_name = "withdrawal_card_payment";
                            // }

                            // const data = {
                            //     wallet_id: transactionDetails.wallet,
                            //     channel_name,
                            //     service_name,
                            //     amount: transactionDetails.amount,
                            //     transaction_type: "C2C",
                            //     service_id: channelDetails.service_id,
                            //     iso_code: account?.country_iso_code,
                            //     currency_code: walletDetails.currency.code,
                            //     payerId: parseInt(channelDetails.payer_id)
                            // }
                            const data = createWithdrawalDataObject(transactionDetails.amount, channelDetails.service_id, channelDetails.payer_id, defaultPayoutChannel?.country?.country_iso_code, walletDetails)

                            console.log({ data })

                            const exchangedRates = await getWithdrawalFXHelper(data)

                            console.log(exchangedRates, "exchangedRates")

                            // const exchangedRates = await getExchangeRates({ payerId: , wallet_id: transactionDetails.wallet, transaction_type: "C2C", amount: transactionDetails.amount, payout_method: channelDetails.service_id, iso_code: account?.country_iso_code })

                            if (exchangedRates.success) {
                                const rates = exchangedRates?.data?.result

                                let message

                                if (defaultPayoutChannel?.channelType === "bank_details") {
                                    message = `You are requesting to cash out ${transactionDetails.amount} ${transactionDetails.currency.code} via Bank deposit to account number ${channelDetails?.iban || channelDetails?.account_number} in ${defaultPayoutChannel?.country?.country_name}.`
                                } else if (defaultPayoutChannel?.channelType === "mobile_wallet") {
                                    message = `You are requesting to cash out ${transactionDetails.amount} ${transactionDetails.currency.code} via Mobile Wallet to ${channelDetails?.wallet_account_number} in ${defaultPayoutChannel?.country?.country_name}.`
                                } else if (defaultPayoutChannel?.channelType === "cash_pickup") {
                                    message = `You are requesting to cash out ${transactionDetails.amount} ${transactionDetails.currency.code} via Cash Pickup to ${channelDetails?.document_number} in ${defaultPayoutChannel?.country?.country_name}.`
                                }

                                let message2

                                if (rates?.total?.currency !== rates?.recipient?.currency) {
                                    message2 = `
${message}\n
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${rates?.total?.currency ?? "N/A"} = ${rates?.exchanged_rate?.value ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}\n
${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}\n
You'll receive: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}
                                    `
                                } else {
                                    message2 = ` 
${message}\n      
${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}\n
You'll receive: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}
                                    `
                                }
                                instaChatbot.withdrawal.fx_token = exchangedRates.data.token
                                instaChatbot.withdrawal.default_withdrawal = defaultPayoutChannel?.withdrawalId
                                instaChatbot.withdrawal.channel = channelDetails

                                await instaChatbot.save()

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].PROCEED_TO_TRANSFER, payload: "proceed_withdrawal_default" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];

                                await quickReply(entry.messaging[0], message2, quickReplies);
                                console.log(message, "message")
                            } else {
                                const quickReplies = [

                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];

                                await quickReply(entry.messaging[0], exchangedRates?.message, quickReplies, "4");
                            }


                        }

                        // creating quotation and transaction
                        else if (quick_reply?.payload === "proceed_withdrawal_default" || quick_reply?.payload === "proceed_specified_withdrawal" || quick_reply?.payload === "proceed_anoth_withdrawal_default") {
                            if (account?.level?.level_no === 1) {
                                await userKYCVerificationTemplate(entry.messaging[0], messaging?.sender?.id, selectedLanguage)
                                return
                            }
                            await quickMessage(entry.messaging[0], "Creating your transaction...", "CONFIRMED_EVENT_UPDATE");

                            let transactionDetails
                            const another = quick_reply?.payload === "proceed_anoth_withdrawal_default"
                            if (quick_reply?.payload !== "proceed_anoth_withdrawal_default") {

                                transactionDetails = await Transaction.findById(instaChatbot.withdrawal.transaction_id)
                            }

                            const data = {
                                payerId: instaChatbot.withdrawal.channel.payer_id,
                                wallet_id: !another ? transactionDetails.wallet.toString() : instaChatbot.withdrawal.currency,
                                transaction_type: "C2C",
                                token: instaChatbot?.withdrawal?.fx_token,
                                payment_method: "wallet"
                            }

                            console.log(data, "datainsidecreatequotation")

                            const quotationDetails = await createQuotationNewHelper(data)

                            console.log({ quotationDetails })

                            if (quotationDetails?.status) {
                                instaChatbot.withdrawal.fx_token = quotationDetails?.token;
                                instaChatbot.withdrawal.quotation_id = quotationDetails?.QuotationID
                                await instaChatbot.save();

                                const data = {
                                    wallet_id: !another ? transactionDetails.wallet.toString() : instaChatbot.withdrawal.currency,
                                    additional_information: "Withdrawal",
                                    purpose_of_remittance: "FAMILY_SUPPORT",
                                    user_id: account?.user?._id,
                                    account_id: account?._id,
                                    service_id: instaChatbot.withdrawal.channel.service_id,
                                    payer_id: instaChatbot.withdrawal.channel.payer_id,
                                    transaction_type: "C2C",
                                    token: instaChatbot?.withdrawal?.fx_token,
                                    quotation_id: instaChatbot?.withdrawal?.quotation_id,
                                    withdrawal_id: instaChatbot.withdrawal.default_withdrawal

                                }
                                console.log(data, "datainsidecreatetransa");

                                const createTransactionDetails = await createWithdrawalTransaction(data)

                                console.log(createTransactionDetails, "createTransactionDetails")

                                if (createTransactionDetails?.status) {

                                    instaChatbot.withdrawal.fx_token = createTransactionDetails?.token;
                                    await instaChatbot.save()

                                    await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_withdrawal", "11.11", "Transaction OTP");
                                } else {
                                    await paymentErrorMessage(selectedLanguage, entry.messaging[0])
                                }

                            } else {
                                if (quotationDetails?.message?.includes("Insufficient")) {

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].ADD_FUNDS, payload: "add_funds" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]
                                    return await quickReply(entry.messaging[0], 'Insufficient Balance! Please topup your wallet.', quickReplies, "4");
                                } else {

                                    await paymentErrorMessage(selectedLanguage, entry.messaging[0])
                                }
                            }
                        }

                        // confirming the transaction by validating the OTP
                        else if (instaChatbot?.last_message === "11.11" && text && !quick_reply?.payload) {
                            console.log("otp", text)
                            const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "confirm_withdrawal");

                            if (!otpValidationResult.status) {

                                const confirmTransactionDetails = await confirmTransaction(instaChatbot.withdrawal.fx_token, {}, true)
                                console.log(confirmTransactionDetails)

                                if (confirmTransactionDetails.status) {
                                    const subtitles = `
${lang[selectedLanguage].TID} ${confirmTransactionDetails?.message?.TransactionID}
${lang[selectedLanguage].STATUS}: ${lang[selectedLanguage].PROCESSING}
                                `
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `You have successfully withdrew ${formattedAmount(confirmTransactionDetails?.message?.total?.toFixed(2))} ${confirmTransactionDetails?.message?.currency_code}`,
                                                subtitle: subtitles,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: "main_menu",
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: "Another withdrawal",
                                                        payload: "another_withdrawal",
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: "Track Status",
                                                        payload: "my_transactions",
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                    instaChatbot.flowFlag = false;
                                    instaChatbot.flowId = "";
                                    instaChatbot.intl = {}
                                    await instaChatbot.save()
                                } else {
                                    console.log("did i ran")
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: lang[selectedLanguage].TRANSACTION_FAILED,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/System%20Error.png",
                                                subtitle: lang[selectedLanguage].TRY_AGAIN_OR_CONTACT_SUPPORT_SUBTITLE,
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: "main_menu",
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                    instaChatbot.flowFlag = false;
                                    instaChatbot.flowId = "";
                                    instaChatbot.intl = {}
                                    await instaChatbot.save()
                                }

                            }
                            else {
                                if (otpValidationResult.message === "max_attempts_exceeded") {

                                    await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                                } else {

                                    await invalidMessage(entry.messaging[0], "confirm_withdrawal", selectedLanguage, instaChatbot?.otpType);
                                }
                            }
                        }

                        // DEFAULT FLOW ENDED
                        // CUSTOM CHANNEL FLOW STARTED
                        // user has selected the specify payout channel
                        else if (quick_reply?.payload === "withdrawal_specify") {
                            const countries = await fetchWithdrawalsCounties(account._id)

                            let quickReplies = countries?.countries?.map((country) => { return { content_type: "text", title: `${countryToEmoji[country.country_iso_code] ?? '🌐'} ${country.country_name}`, payload: `withdrawal_specify-${country._id}` } })
                            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })

                            const message = "Select country:";
                            await quickReply(entry.messaging[0], message, quickReplies);

                        }

                        else if (quick_reply?.payload.includes("withdrawal_specify-")) {
                            const countryId = quick_reply?.payload?.split("-")[1]

                            const userWithdrawal = await Withdrawal.findOne({ account: account._id, country: countryId })

                            instaChatbot.withdrawal.default_withdrawal = userWithdrawal?._id
                            await instaChatbot.save()

                            const allowedServices = await getServices(account?.country_iso_code);
                            console.log(userWithdrawal, "userwithdrawal", allowedServices);

                            let quickReplies = []

                            if (userWithdrawal) {
                                if (allowedServices.MobileWallet.status === 'true') {
                                    if (userWithdrawal?.account_type?.includes("mobile")) {
                                        quickReplies.push({ content_type: "text", title: '✔️ Mobile Wallet', payload: `cash_out-mbl-${countryId}` });
                                    } else {
                                        quickReplies.push({ content_type: "text", title: '➕ Mobile Wallet', payload: "cash_out_add-mbl" });
                                    }
                                }

                                if (allowedServices.BankAccount.status === 'true') {
                                    if (userWithdrawal?.account_type?.includes("bank")) {
                                        quickReplies.push({ content_type: "text", title: '✔️ Bank Account', payload: `cash_out-bank-${countryId}` });
                                    } else {
                                        quickReplies.push({ content_type: "text", title: '➕ Bank Account', payload: "cash_out_add-bank" });
                                    }
                                }

                                if (allowedServices.PaymentCard && allowedServices.PaymentCard.status === 'true') {
                                    if (userWithdrawal?.account_type?.includes("card")) {
                                        quickReplies.push({ content_type: "text", title: '✔️ Payment Card', payload: `cash_out-card-${countryId}` });
                                    } else {
                                        quickReplies.push({ content_type: "text", title: '➕ Payment Card', payload: "cash_out_add-card" });
                                    }
                                }

                                if (allowedServices.CashPickup.status === 'true') {
                                    if (userWithdrawal?.account_type?.includes("cash")) {
                                        quickReplies.push({ content_type: "text", title: '✔️ Cash', payload: `cash_out-cash-${countryId}` });
                                    } else {
                                        quickReplies.push({ content_type: "text", title: '➕ Cash', payload: "cash_out_add-cash" });
                                    }
                                }
                            } else {
                                if (allowedServices.MobileWallet.status === 'true') {
                                    quickReplies.push({ content_type: "text", title: '➕ Mobile Wallet', payload: "cash_out_add-mbl" });
                                }
                                if (allowedServices.BankAccount.status === 'true') {
                                    quickReplies.push({ content_type: "text", title: '➕ Bank Account', payload: "cash_out_add-bank" });
                                }
                                if (allowedServices.PaymentCard && allowedServices.PaymentCard.status === 'true') {
                                    quickReplies.push({ content_type: "text", title: '➕ Payment Card', payload: "cash_out_add-card" });
                                }
                                if (allowedServices.CashPickup.status === 'true') {
                                    quickReplies.push({ content_type: "text", title: '➕ Cash', payload: "cash_out_add-cash" });
                                }
                            }

                            let message = "Choose where you would like to receive your funds:"

                            if (quickReplies.length === 0) {
                                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" });
                                message = 'No payout channels found for your country. Please contact the administrator.'
                            }

                            await quickReply(entry.messaging[0], message, quickReplies);
                        }

                        // if user do not have the current payout channel added and wants to add it
                        else if (quick_reply?.payload.includes("cash_out_add-") || quick_reply?.payload === "add_withdrawal") {

                            const message = `
${quick_reply?.payload === "add_withdrawal" ? "" : "This withdrawal channel is not set up in your account yet."}

Please follow the below steps to set up the withdrawal channel. 👇

1⃣ Login to InstaPay web.
2️⃣ Navigate to the Settings page.
3⃣ Select the "Withdrawal Channels" option from the sub-menu. 
4⃣ Enter the channel details and click save.`
                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: "Tap below to login and set the withdrawal channel or you can always go to the Main Menu for more options 🙌",
                                        buttons: [
                                            {
                                                type: "web_url",
                                                title: lang[selectedLanguage].LOGIN,
                                                url: "https://my.insta-pay.ch/login",
                                            },
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                payload: `main_menu`,
                                            },

                                        ],
                                    },


                                ],

                            };
                            await quickMessage(entry.messaging[0], message, "CONFIRMED_EVENT_UPDATE");
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                        }

                        // user has selected a payout channel for cash out
                        else if (quick_reply?.payload.includes("cash_out-")) {
                            const cashOutChannel = quick_reply?.payload.split("-")[1];
                            const countryId = quick_reply?.payload.split("-")[2];
                            let channel
                            const userWithdrawal = await Withdrawal.findOne({ account: account._id, country: countryId }).populate("country")
                            console.log(userWithdrawal, "userWithdrawal", cashOutChannel, countryId)
                            if (cashOutChannel === "mbl") {
                                channel = userWithdrawal.mobile_wallet[0]
                                instaChatbot.withdrawal.channel = channel || {}
                                await instaChatbot.save()
                            } else if (cashOutChannel === "bank") {
                                channel = userWithdrawal.bank_details[0]
                                instaChatbot.withdrawal.channel = channel || {}
                                await instaChatbot.save()
                            } else if (cashOutChannel === "card") {
                                channel = userWithdrawal.card_card[0]
                                instaChatbot.withdrawal.channel = channel || {}
                                await instaChatbot.save()
                            } else if (cashOutChannel === "cash") {
                                channel = userWithdrawal.cash_pickup[0]
                                instaChatbot.withdrawal.channel = channel || {}
                                await instaChatbot.save()
                            }

                            const transactionDetails = await Transaction.findById(instaChatbot.withdrawal.transaction_id)
                            const walletDetails = await Wallet.findById(transactionDetails.wallet).populate([
                                {
                                    path: 'account',
                                    populate: [

                                        { path: 'level' }
                                    ]
                                }
                            ]);
                            console.log({ payerId: parseInt(channel.payer_id), wallet_id: transactionDetails.wallet, transaction_type: "C2C", amount: transactionDetails.amount, payout_method: channel.service_id, iso_code: account?.country_iso_code })
                            if (transactionDetails.amount > walletDetails?.balance?.available) {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].ADD_FUNDS, payload: "add_funds" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                return await quickReply(entry.messaging[0], 'Insufficient Balance! Please topup your wallet.', quickReplies, "4");
                            }
                            let exchangedAmountSender = await getExchangeRatesToUSD(walletDetails.currency.code, 'USD', transactionDetails.amount)

                            const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, walletDetails, 'sending', true)

                            if (!sender_limits_check.status) {
                                await quickMessage(entry.messaging[0], sender_limits_check.message, "CONFIRMED_EVENT_UPDATE", "4");
                                return
                            }

                            const data = createWithdrawalDataObject(transactionDetails.amount, channel.service_id, channel.payer_id, userWithdrawal?.country?.country_iso_code, walletDetails)

                            console.log({ data })

                            const exchangedRates = await getWithdrawalFXHelper(data)

                            console.log(exchangedRates, "exchangedRates")
                            // const exchangedRates = await getExchangeRates({ payerId: parseInt(), wallet_id: transactionDetails.wallet, transaction_type: "C2C", amount: transactionDetails.amount, payout_method: channel.service_id, iso_code: account?.country_iso_code })

                            // console.log(exchangedRates, "exchangedRates")

                            if (exchangedRates?.success) {

                                const rates = exchangedRates?.data?.result
                                let message

                                if (cashOutChannel === "bank") {
                                    message = `You are requesting to cash out ${transactionDetails.amount} ${transactionDetails.currency.code} via Bank deposit to account number ${channel?.iban || channel?.account_number} in ${userWithdrawal?.country?.country_name}.`
                                } else if (cashOutChannel === "mbl") {
                                    message = `You are requesting to cash out ${transactionDetails.amount} ${transactionDetails.currency.code} via Mobile Wallet to ${channel?.wallet_account_number} in ${userWithdrawal?.country?.country_name}.`
                                } else if (cashOutChannel === "cash") {
                                    message = `You are requesting to cash out ${transactionDetails.amount} ${transactionDetails.currency.code} via Cash Pickup to ${channel?.document_number} in ${userWithdrawal?.country?.country_name}.`
                                }

                                let message2

                                if (rates?.total?.currency !== rates?.recipient?.currency) {
                                    message2 = `
${message}\n
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${rates?.total?.currency ?? "N/A"} = ${rates?.exchanged_rate?.value ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}\n
${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}\n
You'll receive: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}
                                `
                                } else {
                                    message2 = ` 
${message}\n      
${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}\n
You'll receive: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}
                                `
                                }
                                console.log(message, "message")
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].PROCEED_TO_TRANSFER, payload: "proceed_specified_withdrawal" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];

                                await quickReply(entry.messaging[0], message2, quickReplies, "4");

                                instaChatbot.withdrawal.fx_token = exchangedRates.data.token
                                await instaChatbot.save()
                            } else {
                                const quickReplies = [

                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];

                                await quickReply(entry.messaging[0], exchangedRates?.message, quickReplies, "4");
                            }
                        }

                        else if (quick_reply?.payload === "proceed_withdrawal") {
                            const transactionDetails = await Transaction.findById(instaChatbot.withdrawal.transaction_id)

                            const data = {
                                payerId: instaChatbot.withdrawal.channel.payer_id,
                                wallet_id: transactionDetails.wallet.toString(),
                                payout_method: instaChatbot.withdrawal.channel.service_id,
                                transaction_type: "C2C",
                                amount: transactionDetails.amount,
                                token: instaChatbot?.withdrawal?.fx_token,
                                iso_code: account?.country_iso_code
                            }

                            console.log("datainsidecondition", data);

                            const quotationDetails = await createQuotationNew(data)

                            console.log(quotationDetails, "quotationDetails")

                            if (quotationDetails?.status) {

                                instaChatbot.withdrawal.fx_token = quotationDetails?.message?.token;
                                instaChatbot.withdrawal.quotation_id = quotationDetails?.message?.QuotationID
                                await instaChatbot.save();

                                const channelName = instaChatbot?.withdrawal?.channel?.service_id === "1" ? instaChatbot?.withdrawal?.channel?.wallet_name : instaChatbot?.withdrawal?.channel?.name
                                const channelNumber = instaChatbot?.withdrawal?.channel?.service_id === "1" ? instaChatbot?.withdrawal?.channel?.wallet_account_number : instaChatbot?.withdrawal?.channel?.account_number

                                const message = `
Do you confirm the withdrawal of ${formattedAmount(transactionDetails.amount)} through ${channelName} - ${channelNumber}?
                                    `;

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].YES_CONTINUE_TITLE, payload: "confirm_channel" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];
                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            }
                            else {
                                await paymentErrorMessage(selectedLanguage, entry.messaging[0])
                            }
                        }

                        else if (quick_reply?.payload === "confirm_channel") {
                            const user = await User.findOne({ account: account._id })
                            const transactionDetails = await Transaction.findById(instaChatbot.withdrawal.transaction_id)

                            const data = {
                                wallet_id: transactionDetails.wallet.toString(),
                                additional_information: "Withdrawal",
                                purpose_of_remittance: "FAMILY_SUPPORT",
                                user_id: user._id,
                                account_id: account?._id,
                                service_id: instaChatbot.withdrawal.channel.service_id,
                                payer_id: instaChatbot.withdrawal.channel.payer_id,
                                transaction_type: "C2C",
                                token: instaChatbot?.withdrawal?.fx_token,
                                quotation_id: instaChatbot?.withdrawal?.quotation_id,
                                withdrawal_id: instaChatbot.withdrawal.default_withdrawal

                            }
                            console.log(data, "datainsidecreatetransa");

                            const createTransactionDetails = await createWithdrawalTransaction(data)

                            if (createTransactionDetails?.status) {
                                const transactionDetails = await Transaction.findById(instaChatbot.withdrawal.transaction_id)
                                const exchangedRates = await getExchangeRates({ payerId: parseInt(instaChatbot?.withdrawal?.channel?.payer_id), wallet_id: transactionDetails.wallet, transaction_type: "C2C", amount: transactionDetails.amount, payout_method: instaChatbot?.withdrawal?.channel?.service_id, iso_code: account?.country_iso_code })

                                if (!exchangedRates?.status) {
                                    const quickReplies = [

                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR, quickReplies, "4");
                                }
                                console.log(exchangedRates, "exchangedRatesexchangedRates")


                                const channelName = instaChatbot?.withdrawal?.channel?.service_id === "1" ? instaChatbot?.withdrawal?.channel?.wallet_name : instaChatbot?.withdrawal?.channel?.name
                                const channelNumber = instaChatbot?.withdrawal?.channel?.service_id === "1" ? instaChatbot?.withdrawal?.channel?.wallet_account_number : instaChatbot?.withdrawal?.channel?.account_number

                                const rates = exchangedRates.rates
                                const message = `
${lang[selectedLanguage].REVIEW_TRANSACTION_DETAILS}

${lang[selectedLanguage].COUNTRY}: ${account?.country_iso_code}
${lang[selectedLanguage].PAYMENT_METHOD}: ${instaChatbot?.withdrawal?.channel?.service_id === "1" ? lang[selectedLanguage].MOBILE_WALLET : lang[selectedLanguage].BANK_ACCOUNT}
Payment Channel: ${channelName} - ${channelNumber}

${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(rates.total.value)} ${rates.total.currency}
${rates.total.currency !== rates.exchanged_rate.currency ? `
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${rates.total.currency} = ${formattedAmount(rates.exchanged_rate.value, 6)} ${rates.exchanged_rate.currency}
` : ''}
${lang[selectedLanguage].FEE}: ${formattedAmount(rates.fee.value)} ${rates.total.currency}

${lang[selectedLanguage].BENEFICIARY_GETS}: ${formattedAmount(rates.recipient.value)} ${rates.exchanged_rate.currency}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(rates.total.value)} ${rates.total.currency}
`;
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].CONFIRM_TRANSACTION, payload: "withdrawal_confirm_transaction" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];
                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                                instaChatbot.withdrawal.fx_token = createTransactionDetails?.token;
                                await instaChatbot.save()
                            } else {
                                await paymentErrorMessage(selectedLanguage, entry.messaging[0])
                            }
                        }
                        else if (quick_reply?.payload === "withdrawal_confirm_transaction") {

                            await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_withdrawal", "11.11", "Transaction OTP");
                        }
                        else if (instaChatbot?.last_message === "11.11" && text && !quick_reply?.payload) {
                            console.log("otp", text)
                            const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "confirm_withdrawal");

                            if (otpValidationResult.status) {

                                const confirmTransactionDetails = await confirmTransaction(instaChatbot.withdrawal.fx_token, {}, true)
                                console.log(confirmTransactionDetails)

                                if (confirmTransactionDetails.status) {
                                    const subtitles = `
${lang[selectedLanguage].TID} ${confirmTransactionDetails?.message?.TransactionID}
${lang[selectedLanguage].STATUS}: ${lang[selectedLanguage].PROCESSING}
                                `
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `You have successfully withdrew ${formattedAmount(confirmTransactionDetails?.message?.total?.toFixed(2))} ${confirmTransactionDetails?.message?.currency_code}`,
                                                subtitle: subtitles,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: "main_menu",
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: "Another withdrawal",
                                                        payload: "another_withdrawal",
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: "Track Status",
                                                        payload: "my_transactions",
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                    instaChatbot.flowFlag = false;
                                    instaChatbot.flowId = "";
                                    instaChatbot.intl = {}
                                    await instaChatbot.save()
                                } else {
                                    console.log("did i ran")
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: lang[selectedLanguage].TRANSACTION_FAILED,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/System%20Error.png",
                                                subtitle: lang[selectedLanguage].TRY_AGAIN_OR_CONTACT_SUPPORT_SUBTITLE,
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: "main_menu",
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                    instaChatbot.flowFlag = false;
                                    instaChatbot.flowId = "";
                                    instaChatbot.intl = {}
                                    await instaChatbot.save()
                                }

                            }
                            else {
                                if (otpValidationResult.message === "max_attempts_exceeded") {

                                    await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                                } else {

                                    await invalidMessage(entry.messaging[0], "confirm_withdrawal", selectedLanguage, instaChatbot?.otpType);
                                }
                            }
                        }

                        // CUSTOM CHANNEL FLOW ENDED
                        // user has clicked on another witdrawal
                        else if (quick_reply?.payload === "another_withdrawal" || messaging?.postback?.payload === "another_withdrawal") {
                            let message = "Where would you like to cash out?"

                            const quickReplies = [
                                { content_type: "text", title: 'Default Account', payload: "withdrawal_another_default" },
                                { content_type: "text", title: 'Specify Account', payload: "withdrawal_another_specify" }
                            ]

                            await quickReply(entry.messaging[0], message, quickReplies, "4");
                        }
                        // ANOTHER WITHDRAWAL - DEFAULT FLOW
                        else if (quick_reply?.payload === "withdrawal_another_default") {
                            const defaultPayoutChannel = await findDefaultPayoutChannel(account._id)

                            if (!defaultPayoutChannel?.status) {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ]

                                return await quickReply(entry.messaging[0], "Something went wrong while getting the default payout channel. Please makre sure you have one.", quickReplies, "4");
                            }

                            instaChatbot.withdrawal.default_withdrawal = defaultPayoutChannel?.withdrawalId
                            await instaChatbot?.save();

                            const wallets = await Wallet.find({ account: account?._id, wallet_type: 'insta', status: "active" });
                            const slicedWallets = wallets.slice(0, 8)

                            const quickReplies = slicedWallets?.map((wallet) => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `another_w_withdrawal-default-${wallet._id}` } })

                            const message = lang[selectedLanguage].PICK_CURRENCY_MESSAGE;
                            await quickReply(entry.messaging[0], message, quickReplies, "4");
                        }

                        // else if (quick_reply?.payload === "another_withdrawal" || messaging?.postback?.payload === "another_withdrawal") {
                        //     const wallets = await Wallet.find({ account: account?._id, wallet_type: 'insta', status: "active" });
                        //     const slicedWallets = wallets.slice(0, 8)

                        //     const quickReplies = slicedWallets?.map((wallet) => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `withdrawal-${wallet._id}` } })

                        //     const message = lang[selectedLanguage].PICK_CURRENCY_MESSAGE;
                        //     await quickReply(entry.messaging[0], message, quickReplies, "4");

                        // }
                        else if (quick_reply?.payload.includes("another_w_withdrawal-")) {

                            const walletId = quick_reply?.payload.split('-')[2]
                            const withdrawalFlow = quick_reply?.payload.split('-')[1]
                            const walletDetails = await Wallet.findById(walletId);

                            instaChatbot.withdrawal.currency = walletId;
                            instaChatbot.withdrawal.withdrawal_flow = withdrawalFlow;
                            await instaChatbot?.save();

                            const message = `${lang[selectedLanguage].CURRENTLY_HAVE.replace('{{amount}}', formattedAmount(walletDetails?.balance?.available)).replace('{{currency}}', walletDetails.currency.code)}\n\n${lang[selectedLanguage].PROCEED_OR_SELECT_WALLET}`;
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].PROCEED_TITLE, payload: `another_with_${withdrawalFlow}_proceed` },
                                { content_type: "text", title: "Another Wallet", payload: "another_withdrawal" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]

                            await quickReply(entry.messaging[0], message, quickReplies, "4");
                        }

                        else if (quick_reply?.payload === "another_with_default_proceed") {
                            const message = 'Please enter your amount in digits to withdraw.'

                            await quickMessage(entry.messaging[0], message, "CONFIRMED_EVENT_UPDATE", "12");
                        }

                        else if (instaChatbot?.last_message === "12" && text && !quick_reply?.payload) {
                            const digitRegex = /^\d+(\.\d+)?$/;
                            const isNumber = digitRegex.test(text)
                            const walletDetails = await Wallet.findById(instaChatbot.withdrawal.currency)
                                .populate([
                                    {
                                        path: 'account',
                                        populate: [

                                            { path: 'level' }
                                        ]
                                    }
                                ]);
                            const amount = parseFloat(text);

                            if (isNumber && amount >= 0.1) {
                                const defaultPayoutChannel = await findDefaultPayoutChannel(account._id)

                                if (!defaultPayoutChannel?.status) {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ]

                                    return await quickReply(entry.messaging[0], "Something went wrong while getting the default payout channel. Please makre sure you have one.", quickReplies, "4");
                                }

                                console.log(defaultPayoutChannel, "defaultPayoutChannel", walletDetails)

                                const channelDetails = defaultPayoutChannel?.channelDetails

                                let exchangedAmountSender = await getExchangeRatesToUSD(walletDetails.currency.code, 'USD', amount)

                                const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, walletDetails, 'sending', true)

                                if (!sender_limits_check.status) {
                                    await quickMessage(entry.messaging[0], sender_limits_check.message, "CONFIRMED_EVENT_UPDATE", "4");
                                    return
                                }

                                // const exchangedRates = await getExchangeRates({ payerId: parseInt(channelDetails.payer_id), wallet_id: walletDetails._id, transaction_type: "C2C", amount: amount, payout_method: channelDetails.service_id, iso_code: account?.country_iso_code })
                                // const rates = exchangedRates?.rates
                                // console.log(exchangedRates, "exchangedRates")

                                const data = createWithdrawalDataObject(amount, channelDetails.service_id, channelDetails.payer_id, defaultPayoutChannel?.country?.country_iso_code, walletDetails)

                                console.log({ data })

                                const exchangedRates = await getWithdrawalFXHelper(data)

                                console.log(exchangedRates, "exchangedRates")
                                if (exchangedRates?.success) {

                                    const rates = exchangedRates?.data?.result

                                    let message

                                    if (defaultPayoutChannel?.channelType === "bank_details") {
                                        message = `You are requesting to cash out ${amount} ${walletDetails.currency.code} via Bank deposit to account number ${channelDetails?.iban || channelDetails?.account_number} in ${defaultPayoutChannel?.country?.country_name}.`
                                    } else if (defaultPayoutChannel?.channelType === "mobile_wallet") {
                                        message = `You are requesting to cash out ${amount} ${walletDetails.currency.code} via Mobile Wallet to ${channelDetails?.wallet_account_number} in ${defaultPayoutChannel?.country?.country_name}.`
                                    } else if (defaultPayoutChannel?.channelType === "cash_pickup") {
                                        message = `You are requesting to cash out ${amount} ${walletDetails.currency.code} via Cash Pickup to ${channelDetails?.document_number} in ${defaultPayoutChannel?.country?.country_name}.`
                                    }

                                    let message2

                                    if (rates?.total?.currency !== rates?.recipient?.currency) {
                                        message2 = `
${message}\n
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${rates?.total?.currency ?? "N/A"} = ${rates?.exchanged_rate?.value ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}\n
${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}\n
You'll receive: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}
                                        `
                                    } else {
                                        message2 = ` 
${message}\n      
${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}\n
You'll receive: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}
                                        `
                                    }
                                    instaChatbot.withdrawal.fx_token = exchangedRates.data.token
                                    instaChatbot.withdrawal.default_withdrawal = defaultPayoutChannel?.withdrawalId
                                    instaChatbot.withdrawal.amount = amount;
                                    instaChatbot.withdrawal.channel = channelDetails

                                    await instaChatbot.save()

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].PROCEED_TO_TRANSFER, payload: "proceed_anoth_withdrawal_default" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], message2, quickReplies);
                                    console.log(message, "message")
                                } else {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], exchangedRates?.message, quickReplies);
                                }

                            } else if (amount <= 0.1) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].MINIMUM_AMOUNT, "CONFIRMED_EVENT_UPDATE");
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_AMOUNT_DIGITS, "CONFIRMED_EVENT_UPDATE");
                            }
                        }

                        // default flow - another withdrawal ends here

                        // custom channel flow - another flow starts here
                        else if (quick_reply?.payload === "withdrawal_another_specify") {
                            const countries = await fetchWithdrawalsCounties(account._id)

                            const quickReplies = countries?.countries?.map((country) => { return { content_type: "text", title: `${countryToEmoji[country.country_iso_code] ?? '🌐'} ${country.country_name}`, payload: `withdrawal_anoth_c_specify-${country._id}` } })

                            const message = "Select country";
                            await quickReply(entry.messaging[0], message, quickReplies);
                        }

                        else if (quick_reply?.payload?.includes("withdrawal_anoth_c_specify")) {
                            const countryId = quick_reply?.payload?.split("-")[1]

                            console.log(countryId, "countryId")
                            const userWithdrawal = await Withdrawal.findOne({ account: account._id, country: countryId })

                            const allowedServices = await getServices(account?.country_iso_code);

                            instaChatbot.withdrawal.default_withdrawal = userWithdrawal?._id
                            await instaChatbot.save()
                            console.log(userWithdrawal, "userwithdrawal", allowedServices);

                            let quickReplies = []

                            if (userWithdrawal) {
                                if (allowedServices.MobileWallet.status === 'true') {
                                    if (userWithdrawal?.account_type?.includes("mobile")) {
                                        quickReplies.push({ content_type: "text", title: '✔️ Mobile Wallet', payload: `cash_anoth_out-mbl-${countryId}` });
                                    } else {
                                        quickReplies.push({ content_type: "text", title: '➕ Mobile Wallet', payload: "cash_out_add-mbl" });
                                    }
                                }

                                if (allowedServices.BankAccount.status === 'true') {
                                    if (userWithdrawal?.account_type?.includes("bank")) {
                                        quickReplies.push({ content_type: "text", title: '✔️ Bank Account', payload: `cash_anoth_out-bank-${countryId}` });
                                    } else {
                                        quickReplies.push({ content_type: "text", title: '➕ Bank Account', payload: "cash_out_add-bank" });
                                    }
                                }

                                if (allowedServices.PaymentCard && allowedServices.PaymentCard.status === 'true') {
                                    if (userWithdrawal?.account_type?.includes("card")) {
                                        quickReplies.push({ content_type: "text", title: '✔️ Payment Card', payload: `cash_anoth_out-card-${countryId}` });
                                    } else {
                                        quickReplies.push({ content_type: "text", title: '➕ Payment Card', payload: "cash_out_add-card" });
                                    }
                                }

                                if (allowedServices.CashPickup.status === 'true') {
                                    if (userWithdrawal?.account_type?.includes("cash")) {
                                        quickReplies.push({ content_type: "text", title: '✔️ Cash', payload: `cash_anoth_out-cash-${countryId}` });
                                    } else {
                                        quickReplies.push({ content_type: "text", title: '➕ Cash', payload: "cash_out_add-cash" });
                                    }
                                }
                            } else {
                                if (allowedServices.MobileWallet.status === 'true') {
                                    quickReplies.push({ content_type: "text", title: '➕ Mobile Wallet', payload: "cash_out_add-mbl" });
                                }
                                if (allowedServices.BankAccount.status === 'true') {
                                    quickReplies.push({ content_type: "text", title: '➕ Bank Account', payload: "cash_out_add-bank" });
                                }
                                if (allowedServices.PaymentCard && allowedServices.PaymentCard.status === 'true') {
                                    quickReplies.push({ content_type: "text", title: '➕ Payment Card', payload: "cash_out_add-card" });
                                }
                                if (allowedServices.CashPickup.status === 'true') {
                                    quickReplies.push({ content_type: "text", title: '➕ Cash', payload: "cash_out_add-cash" });
                                }
                            }

                            let message = "Choose where you would like to receive your funds:"

                            if (quickReplies.length === 0) {
                                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" });
                                message = 'No payout channels found for your country. Please contact the administrator.'
                            }

                            await quickReply(entry.messaging[0], message, quickReplies);
                        }

                        else if (quick_reply?.payload?.includes("cash_anoth_out")) {
                            const cashOutChannel = quick_reply?.payload.split("-")[1];
                            const countryId = quick_reply?.payload.split("-")[2];
                            instaChatbot.withdrawal.country = countryId

                            let channel
                            const userWithdrawal = await Withdrawal.findOne({ account: account._id, country: countryId }).populate("country")
                            if (cashOutChannel === "mbl") {
                                channel = userWithdrawal.mobile_wallet[0]
                                instaChatbot.withdrawal.channel = channel || {}
                                await instaChatbot.save()
                            } else if (cashOutChannel === "bank") {
                                channel = userWithdrawal.bank_details[0]
                                instaChatbot.withdrawal.channel = channel || {}
                                await instaChatbot.save()
                            } else if (cashOutChannel === "card") {
                                channel = userWithdrawal.card_card[0]
                                instaChatbot.withdrawal.channel = channel || {}
                                await instaChatbot.save()
                            } else if (cashOutChannel === "cash") {
                                channel = userWithdrawal.cash_pickup[0]
                                instaChatbot.withdrawal.channel = channel || {}
                                await instaChatbot.save()
                            }

                            const wallets = await Wallet.find({ account: account?._id, wallet_type: 'insta', status: "active" });
                            const slicedWallets = wallets.slice(0, 8)

                            const quickReplies = slicedWallets?.map((wallet) => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `another_w_withdrawal-specify-${wallet._id}` } })

                            const message = lang[selectedLanguage].PICK_CURRENCY_MESSAGE;
                            await quickReply(entry.messaging[0], message, quickReplies, "4");
                        }

                        else if (quick_reply?.payload === "another_with_specify_proceed") {
                            const message = 'Please enter your amount in digits to withdraw.'

                            await quickMessage(entry.messaging[0], message, "CONFIRMED_EVENT_UPDATE", "13");
                        }

                        else if (instaChatbot?.last_message === "13" && text && !quick_reply?.payload) {
                            const digitRegex = /^\d+(\.\d+)?$/;
                            const isNumber = digitRegex.test(text)
                            const walletDetails = await Wallet.findById(instaChatbot.withdrawal.currency)
                                .populate([
                                    {
                                        path: 'account',
                                        populate: [

                                            { path: 'level' }
                                        ]
                                    }
                                ]);
                            const amount = parseFloat(text);

                            if (isNumber && amount >= 0.1) {

                                const channelDetails = instaChatbot.withdrawal.channel

                                let exchangedAmountSender = await getExchangeRatesToUSD(walletDetails.currency.code, 'USD', amount)

                                const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, walletDetails, 'sending', true)

                                if (!sender_limits_check.status) {
                                    await quickMessage(entry.messaging[0], sender_limits_check.message, "CONFIRMED_EVENT_UPDATE", "4");
                                    return
                                }

                                const countryDetails = await CountryModel.findById(instaChatbot.withdrawal.country)

                                // const exchangedRates = await getExchangeRates({ payerId: parseInt(channelDetails.payer_id), wallet_id: walletDetails._id, transaction_type: "C2C", amount: amount, payout_method: channelDetails.service_id, iso_code: account?.country_iso_code })

                                // const rates = exchangedRates.rates

                                const data = createWithdrawalDataObject(amount, channelDetails.service_id, channelDetails.payer_id, countryDetails.country_iso_code, walletDetails)

                                console.log({ data })

                                const exchangedRates = await getWithdrawalFXHelper(data)

                                console.log(exchangedRates, "exchangedRates")
                                if (exchangedRates?.success) {

                                    const rates = exchangedRates?.data?.result

                                    const withdrawalDetails = await Withdrawal.findById(instaChatbot.withdrawal.default_withdrawal).populate("country")
                                    console.log(withdrawalDetails, "withdrawalDetails")

                                    let message

                                    if (channelDetails?.service_id == 2) {
                                        message = `You are requesting to cash out ${amount} ${walletDetails.currency.code} via Bank deposit to account number ${channelDetails?.iban || channelDetails?.account_number} in ${withdrawalDetails?.country?.country_name}.`
                                    } else if (channelDetails?.service_id == 1) {
                                        message = `You are requesting to cash out ${amount} ${walletDetails.currency.code} via Mobile Wallet to ${channelDetails?.wallet_account_number} in ${withdrawalDetails?.country?.country_name}.`
                                    } else if (channelDetails?.service_id == 3) {
                                        message = `You are requesting to cash out ${amount} ${walletDetails.currency.code} via Cash Pickup to ${channelDetails?.document_number} in ${withdrawalDetails?.country?.country_name}.`
                                    }

                                    let message2

                                    if (rates?.total?.currency !== rates?.recipient?.currency) {
                                        message2 = `
${message}\n
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${rates?.total?.currency ?? "N/A"} = ${rates?.exchanged_rate?.value ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}\
${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}\n
You'll receive: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}
                                        `
                                    } else {
                                        message2 = ` 
${message}\n      
${lang[selectedLanguage].FEE}: ${formattedAmount(rates?.fee?.value) ?? "N/A"} ${rates?.fee?.currency ?? "N/A"}\n
You'll receive: ${formattedAmount(rates?.recipient?.value?.toFixed(2)) ?? "N/A"} ${rates?.recipient?.currency ?? "N/A"}
                                        `
                                    }
                                    instaChatbot.withdrawal.fx_token = exchangedRates.data.token
                                    instaChatbot.withdrawal.amount = amount;
                                    instaChatbot.withdrawal.channel = channelDetails

                                    await instaChatbot.save()

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].PROCEED_TO_TRANSFER, payload: "proceed_anoth_withdrawal_default" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], message2, quickReplies);
                                    console.log(message, "message")
                                } else {
                                    const quickReplies = [

                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], exchangedRates?.message, quickReplies, "4");
                                }
                            } else if (amount <= 0.1) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].MINIMUM_AMOUNT, "CONFIRMED_EVENT_UPDATE");
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_AMOUNT_DIGITS, "CONFIRMED_EVENT_UPDATE");
                            }
                        }

                        // no flow from here
                        else if (quick_reply?.payload === "another_with_proceed") {
                            const message = 'Please enter your amount in digits to withdraw'

                            await quickMessage(entry.messaging[0], message, "CONFIRMED_EVENT_UPDATE", "11.1");

                        }
                        else if (instaChatbot?.last_message === "11.1" && text && !quick_reply?.payload) {
                            const digitRegex = /^\d+(\.\d+)?$/;
                            const isNumber = digitRegex.test(text)
                            const walletDetails = await Wallet.findById(instaChatbot.withdrawal.currency);
                            const amount = parseFloat(text);
                            console.log(walletDetails, 'walletDetails')
                            if (isNumber && amount >= 0.1) {
                                if (parseFloat(text) > walletDetails?.balance?.available) {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].ADD_FUNDS, payload: "add_funds" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]
                                    await quickReply(entry.messaging[0], lang[selectedLanguage].INSUFFICIENT_BALANCE, quickReplies);
                                } else {
                                    const message = "Choose where you would like to receive your funds:"

                                    const userWithdrawal = await Withdrawal.findOne({ account: account._id })
                                    const allowedServices = await getServices(account?.country_iso_code);
                                    instaChatbot.withdrawal.amount = amount;
                                    await instaChatbot.save()
                                    console.log(userWithdrawal, "userwithdrawal")

                                    console.log(userWithdrawal?.account_type?.includes("mobile"), userWithdrawal?.account_type?.includes("bank"), userWithdrawal?.account_type?.includes("card"), userWithdrawal?.account_type?.includes("mobile"))

                                    let quickReplies = []

                                    if (userWithdrawal) {
                                        if (allowedServices.MobileWallet.status === 'true') {
                                            if (userWithdrawal?.account_type?.includes("mobile")) {
                                                quickReplies.push({ content_type: "text", title: '✔️ Mobile Wallet', payload: "cash_out_anoth-mbl" });
                                            } else {
                                                quickReplies.push({ content_type: "text", title: '➕ Mobile Wallet', payload: "cash_out_add-mbl" });
                                            }
                                        }

                                        if (allowedServices.BankAccount.status === 'true') {
                                            if (userWithdrawal?.account_type?.includes("bank")) {
                                                quickReplies.push({ content_type: "text", title: '✔️ Bank Account', payload: "cash_out_anoth-bank" });
                                            } else {
                                                quickReplies.push({ content_type: "text", title: '➕ Bank Account', payload: "cash_out_add-bank" });
                                            }
                                        }

                                        if (allowedServices.PaymentCard && allowedServices.PaymentCard.status === 'true') {
                                            if (userWithdrawal?.account_type?.includes("card")) {
                                                quickReplies.push({ content_type: "text", title: '✔️ Payment Card', payload: "cash_out_anoth-card" });
                                            } else {
                                                quickReplies.push({ content_type: "text", title: '➕ Payment Card', payload: "cash_out_add-card" });
                                            }
                                        }

                                        if (allowedServices.CashPickup.status === 'true') {
                                            if (userWithdrawal?.account_type?.includes("cash")) {
                                                quickReplies.push({ content_type: "text", title: '✔️ Cash', payload: "cash_out_anoth-cash" });
                                            } else {
                                                quickReplies.push({ content_type: "text", title: '➕ Cash', payload: "cash_out_add-cash" });
                                            }
                                        }
                                    } else {
                                        if (allowedServices.MobileWallet.status === 'true') {
                                            quickReplies.push({ content_type: "text", title: '➕ Mobile Wallet', payload: "cash_out_add-mbl" });
                                        }
                                        if (allowedServices.BankAccount.status === 'true') {
                                            quickReplies.push({ content_type: "text", title: '➕ Bank Account', payload: "cash_out_add-bank" });
                                        }
                                        if (allowedServices.PaymentCard && allowedServices.PaymentCard.status === 'true') {
                                            quickReplies.push({ content_type: "text", title: '➕ Payment Card', payload: "cash_out_add-card" });
                                        }
                                        if (allowedServices.CashPickup.status === 'true') {
                                            quickReplies.push({ content_type: "text", title: '➕ Cash', payload: "cash_out_add-cash" });
                                        }
                                    }

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");

                                }
                            } else if (amount <= 0.1) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].MINIMUM_AMOUNT, "CONFIRMED_EVENT_UPDATE");
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_AMOUNT_DIGITS, "CONFIRMED_EVENT_UPDATE");
                            }
                        }
                        else if (quick_reply?.payload.includes("cash_out_anoth-")) {
                            const cashOutChannel = quick_reply?.payload.split("-")[1];
                            let channel
                            const userWithdrawal = await Withdrawal.findOne({ account: account._id });
                            if (cashOutChannel === "mbl") {
                                channel = userWithdrawal.mobile_wallet[0]
                                instaChatbot.withdrawal.channel = channel || {}
                                await instaChatbot.save()
                            } else if (cashOutChannel === "bank") {
                                channel = userWithdrawal.bank_details[0]
                                instaChatbot.withdrawal.channel = channel || {}
                                await instaChatbot.save()
                            } else if (cashOutChannel === "card") {
                                channel = userWithdrawal.card_card[0]
                                instaChatbot.withdrawal.channel = channel || {}
                                await instaChatbot.save()
                            } else if (cashOutChannel === "cash") {
                                channel = userWithdrawal.cash_pickup[0]
                                instaChatbot.withdrawal.channel = channel || {}
                                await instaChatbot.save()
                            }

                            const amount = instaChatbot?.withdrawal?.amount
                            const walletDetails = await Wallet.findById(instaChatbot.withdrawal.currency).populate([
                                {
                                    path: 'account',
                                    populate: [

                                        { path: 'level' }
                                    ]
                                }
                            ]);
                            console.log({ payerId: parseInt(channel.payer_id), wallet_id: instaChatbot.withdrawal.currency, transaction_type: "C2C", amount: amount, payout_method: channel.service_id, iso_code: account?.country_iso_code })
                            if (amount > walletDetails?.balance?.available) {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].ADD_FUNDS, payload: "add_funds" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                return await quickReply(entry.messaging[0], 'Insufficient Balance! Please topup your wallet.', quickReplies, "4");
                            }
                            let exchangedAmountSender = await getExchangeRatesToUSD(walletDetails.currency.code, 'USD', amount)

                            const sender_limits_check = await checkTransactionLimitsForSender(exchangedAmountSender, walletDetails, 'sending', true)

                            if (!sender_limits_check.status) {
                                await quickMessage(entry.messaging[0], sender_limits_check.message, "CONFIRMED_EVENT_UPDATE", "4");
                                return
                            }

                            // herehere
                            const exchangedRates = await getExchangeRates({ payerId: parseInt(channel.payer_id), wallet_id: instaChatbot.withdrawal.currency, transaction_type: "C2C", amount: amount, payout_method: channel.service_id, iso_code: account?.country_iso_code })

                            console.log(exchangedRates, "exchangedRates")

                            if (exchangedRates?.status) {

                                const rates = exchangedRates.rates
                                await quickMessage(entry.messaging[0], `You're withdrawing ${formattedAmount(amount)} ${rates?.total?.currency ?? "N/A"}. Please review the details:`, "CONFIRMED_EVENT_UPDATE");

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
                                    { content_type: "text", title: lang[selectedLanguage].PROCEED_TO_TRANSFER, payload: "proceed_anoth_withdrawal" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];

                                await quickReply(entry.messaging[0], message, quickReplies, "4");

                                instaChatbot.withdrawal.fx_token = exchangedRates.token
                                await instaChatbot.save()
                            } else {
                                const quickReplies = [

                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];

                                await quickReply(entry.messaging[0], exchangedRates?.message, quickReplies, "4");
                            }
                        }
                        else if (quick_reply?.payload === "proceed_anoth_withdrawal") {

                            const data = {
                                payerId: instaChatbot.withdrawal.channel.payer_id,
                                wallet_id: instaChatbot.withdrawal.currency.toString(),
                                payout_method: instaChatbot.withdrawal.channel.service_id,
                                transaction_type: "C2C",
                                amount: instaChatbot.withdrawal.amount,
                                token: instaChatbot?.withdrawal?.fx_token,
                                iso_code: account?.country_iso_code
                            }

                            console.log("datainsidecondition", data);

                            const quotationDetails = await createQuotationNew(data)

                            console.log(quotationDetails, "quotationDetails")

                            if (quotationDetails?.status) {

                                instaChatbot.withdrawal.fx_token = quotationDetails?.message?.token;
                                instaChatbot.withdrawal.quotation_id = quotationDetails?.message?.QuotationID
                                await instaChatbot.save();

                                const channelName = instaChatbot?.withdrawal?.channel?.service_id === "1" ? instaChatbot?.withdrawal?.channel?.wallet_name : instaChatbot?.withdrawal?.channel?.name
                                const channelNumber = instaChatbot?.withdrawal?.channel?.service_id === "1" ? instaChatbot?.withdrawal?.channel?.wallet_account_number : instaChatbot?.withdrawal?.channel?.account_number

                                const message = `
Do you confirm the withdrawal of ${formattedAmount(instaChatbot.withdrawal.amount)} through ${channelName} - ${channelNumber}?
                                    `;

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].YES_CONTINUE_TITLE, payload: "confirm_anoth_channel" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];
                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            }
                            else {
                                await paymentErrorMessage(selectedLanguage, entry.messaging[0])
                            }
                        }
                        else if (quick_reply?.payload === "confirm_anoth_channel") {
                            const user = await User.findOne({ account: account._id })

                            const data = {
                                wallet_id: instaChatbot.withdrawal.currency.toString(),
                                additional_information: "Withdrawal",
                                purpose_of_remittance: "FAMILY_SUPPORT",
                                user_id: user._id,
                                account_id: account?._id,
                                service_id: instaChatbot.withdrawal.channel.service_id,
                                payer_id: instaChatbot.withdrawal.channel.payer_id,
                                transaction_type: "C2C",
                                token: instaChatbot?.withdrawal?.fx_token,
                                quotation_id: instaChatbot?.withdrawal?.quotation_id,
                                withdrawal_id: instaChatbot.withdrawal.default_withdrawal

                            }
                            console.log(data, "datainsidecreatetransa");

                            const createTransactionDetails = await createWithdrawalTransaction(data)

                            if (createTransactionDetails?.status) {
                                const exchangedRates = await getExchangeRates({ payerId: parseInt(instaChatbot?.withdrawal?.channel?.payer_id), wallet_id: instaChatbot.withdrawal.currency, transaction_type: "C2C", amount: instaChatbot.withdrawal.amount, payout_method: instaChatbot?.withdrawal?.channel?.service_id, iso_code: account?.country_iso_code })

                                if (!exchangedRates?.status) {
                                    const quickReplies = [

                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], lang[selectedLanguage].TRANSACTION_PROCESSING_ERROR, quickReplies, "4");
                                }
                                console.log(exchangedRates, "exchangedRatesexchangedRates")


                                const channelName = instaChatbot?.withdrawal?.channel?.service_id === "1" ? instaChatbot?.withdrawal?.channel?.wallet_name : instaChatbot?.withdrawal?.channel?.name
                                const channelNumber = instaChatbot?.withdrawal?.channel?.service_id === "1" ? instaChatbot?.withdrawal?.channel?.wallet_account_number : instaChatbot?.withdrawal?.channel?.account_number

                                const rates = exchangedRates.rates
                                const message = `
${lang[selectedLanguage].REVIEW_TRANSACTION_DETAILS}

${lang[selectedLanguage].COUNTRY}: ${account?.country_iso_code}
${lang[selectedLanguage].PAYMENT_METHOD}: ${instaChatbot?.withdrawal?.channel?.service_id === "1" ? lang[selectedLanguage].MOBILE_WALLET : lang[selectedLanguage].BANK_ACCOUNT}
Payment Channel: ${channelName} - ${channelNumber}

${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(rates.total.value)} ${rates.total.currency}
${rates.total.currency !== rates.exchanged_rate.currency ? `${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${rates.total.currency} = ${formattedAmount(rates.exchanged_rate.value, 6)} ${rates.exchanged_rate.currency}\n` : ''}
${lang[selectedLanguage].FEE}: ${formattedAmount(rates.fee.value)} ${rates.total.currency}

${lang[selectedLanguage].BENEFICIARY_GETS}: ${formattedAmount(rates.recipient.value)} ${rates.exchanged_rate.currency}

${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(rates.total.value)} ${rates.total.currency}
`;
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].CONFIRM_TRANSACTION, payload: "withdrawal_anoth_confirm_transaction" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ];
                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                                instaChatbot.withdrawal.fx_token = createTransactionDetails?.token;
                                await instaChatbot.save()
                            } else {
                                await paymentErrorMessage(selectedLanguage, entry.messaging[0])
                            }
                        }
                        else if (quick_reply?.payload === "withdrawal_anoth_confirm_transaction") {

                            await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_withdrawal", "11.11", "Transaction OTP");
                        }
                        else if (instaChatbot?.last_message === "11.11" && text && !quick_reply?.payload) {
                            console.log("otp", text)
                            const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "confirm_withdrawal");

                            if (otpValidationResult.status) {

                                const confirmTransactionDetails = await confirmTransaction(instaChatbot.withdrawal.fx_token, {}, true)
                                console.log(confirmTransactionDetails)

                                if (confirmTransactionDetails.status) {
                                    const subtitles = `
${lang[selectedLanguage].TID} ${confirmTransactionDetails?.message?.TransactionID}
${lang[selectedLanguage].STATUS}: ${lang[selectedLanguage].PROCESSING}
                                `
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `You have successfully withdrew ${formattedAmount(confirmTransactionDetails?.message?.total?.toFixed(2))} ${confirmTransactionDetails?.message?.currency_code}`,
                                                subtitle: subtitles,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: "main_menu",
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: "Another withdrawal",
                                                        payload: "another_withdrawal",
                                                    },
                                                    {
                                                        type: "postback",
                                                        title: "Track Status",
                                                        payload: "my_transactions",
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                    instaChatbot.flowFlag = false;
                                    instaChatbot.flowId = "";
                                    instaChatbot.intl = {}
                                    await instaChatbot.save()
                                } else {
                                    console.log("did i ran")
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: lang[selectedLanguage].TRANSACTION_FAILED,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/System%20Error.png",
                                                subtitle: lang[selectedLanguage].TRY_AGAIN_OR_CONTACT_SUPPORT_SUBTITLE,
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: "main_menu",
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                    instaChatbot.flowFlag = false;
                                    instaChatbot.flowId = "";
                                    instaChatbot.intl = {}
                                    await instaChatbot.save()
                                }

                            }
                            else {
                                if (otpValidationResult.message === "max_attempts_exceeded") {

                                    await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                                } else {

                                    await invalidMessage(entry.messaging[0], "confirm_withdrawal", selectedLanguage, instaChatbot?.otpType);
                                }
                            }
                        }


                        // WALLET-DETAILS //
                        else if (quick_reply?.payload === "wallet_overview" || messaging?.postback?.payload === "wallet_overview") {
                            const wallets = await Wallet.find({ account: account._id, wallet_type: 'insta', status: "active" });
                            console.log({ wallets })
                            if (wallets.length > 0) {

                                // const slicedWallets = wallets.slice(0, 10);
                                const messages = await walletOverviewText(wallets, selectedLanguage);

                                for (let message of messages) {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].ADD_FUNDS, payload: "add_funds" },
                                        { content_type: "text", title: lang[selectedLanguage].CONVERT_FUNDS, payload: "convert_funds" },
                                        { content_type: "text", title: lang[selectedLanguage].ADD_CURRENCY, payload: "add_currency" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ];
                                    await quickReply(entry.messaging[0], message, quickReplies, "4");
                                }
                            } else {
                                const message = "Your InstaPay Digital Wallets are being created. Please try again later.\nIf the issue persists, please reach out to our support team"
                                const quickReplies = [
                                    { content_type: "text", title: "Contact Support", payload: "assistance" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                ]
                                await quickReply(entry.messaging[0], message, quickReplies, "4")
                            }
                        }

                        // WALLET-DETAILS => CONVERT FUNDS //
                        else if (quick_reply?.payload === "convert_funds") {
                            const wallets = await Wallet.find({ account: account?._id, wallet_type: 'insta', status: "active" });
                            const slicedWallets = wallets.slice(0, 7)

                            if (wallets?.length > 1) {
                                const quickReplies = slicedWallets?.map((wallet) => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `w2w_exchng1-${wallet._id}` } })
                                quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })

                                await quickReply(entry.messaging[0], lang[selectedLanguage].PICK_CURRENCY_PROMPT, quickReplies, "4");
                            } else {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].ADD_CURRENCY, payload: "add_currency" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ];

                                await quickReply(entry.messaging[0], "You do not have multiple currencies available for conversion!\nPlease add your desired currency by clicking below", quickReplies, "4");
                            }

                        }
                        // user has selected first currency
                        else if (quick_reply?.payload.includes('w2w_exchng1-')) {
                            const walletId = quick_reply?.payload.split('-')[1]
                            console.log(walletId);
                            const walletDetails = await Wallet.findById(walletId);
                            console.log(walletDetails)

                            instaChatbot.conversion.sending_currency = walletId;
                            await instaChatbot.save()
                            const message = `${lang[selectedLanguage].CURRENTLY_HAVE.replace('{{amount}}', formattedAmount(walletDetails?.balance?.available)).replace('{{currency}}', walletDetails.currency.code)}\n\n${lang[selectedLanguage].PROCEED_OR_SELECT_WALLET}`;
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].PROCEED_TITLE, payload: "w2w_exchng1_proceed" },
                                // { content_type: "text", title: "Another wallet", payload: "select_req_send_wall" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]
                            await quickReply(entry.messaging[0], message, quickReplies, "4");

                        }
                        // user has proceed with first currency
                        else if (quick_reply?.payload.includes('w2w_exchng1_proceed')) {
                            const wallets = await Wallet.find({ account: account?._id, wallet_type: 'insta', status: "active" });
                            const slicedWallets = wallets.slice(0, 8)

                            const filteredWallets = slicedWallets.filter(wallet => {
                                return !instaChatbot?.conversion?.sending_currency.equals(wallet._id);
                            });
                            console.log(filteredWallets, "filteredWallets", instaChatbot.conversion.sending_currency)

                            const quickReplies = filteredWallets?.map((wallet) => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `w2w_exchng2-${wallet._id}` } })
                            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })

                            await quickReply(entry.messaging[0], lang[selectedLanguage].PICK_DEBIT_CURRENCY_PROMPT, quickReplies, "4");
                        }
                        // user has proceeded with second exchange currency
                        else if (quick_reply?.payload.includes('w2w_exchng2-')) {
                            const walletId = quick_reply?.payload.split('-')[1]
                            console.log(walletId);
                            const walletDetails = await Wallet.findById(walletId);
                            console.log(walletDetails)

                            instaChatbot.conversion.receiving_currency = walletId;
                            await instaChatbot.save()

                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_AMOUNT_MESSAGE, "CONFIRMED_EVENT_UPDATE", "8.1");

                        }
                        else if (instaChatbot?.last_message === "8.1" && text && !quick_reply?.payload) {
                            const digitRegex = /^\d+(\.\d+)?$/;
                            const isNumber = digitRegex.test(text)
                            const amount = parseFloat(text);
                            if (isNumber && amount >= 0.1) {
                                const senderWalletDetails = await Wallet.findById(instaChatbot.conversion.sending_currency)
                                const receiverWalletDetails = await Wallet.findById(instaChatbot.conversion.receiving_currency)

                                instaChatbot.conversion.amount = amount
                                await instaChatbot.save()

                                // const data = {
                                //     from: sendingWallet?.currency.code,
                                //     to: receivingWallet?.currency?.code,
                                //     type: 'conversion',
                                //     level_id: account?.level,
                                //     amount: parseInt(text)
                                // }
                                // const exchangeDetails = await getExchangeCurrencyRates(data)

                                // const exchangeRates = await gettingExchangeRates(sendingWallet?.currency.code, receivingWallet?.currency?.code, parseFloat(text), account?.level._id, 'conversion')
                                const { exchange_rate, fee, totalAmountWithFee, recipient_amount } = await calculateExchangeAndFees(senderWalletDetails.currency.code, receiverWalletDetails.currency.code, amount, "conversion", account?.level._id, "wallet", senderWalletDetails, "instant");


                                if (senderWalletDetails?.currency?.code !== receiverWalletDetails?.currency.code) {
                                    const amountToSendText = lang[selectedLanguage].AMOUNT_TO_SEND;
                                    const exchangeRateText = lang[selectedLanguage].EXCHANGE_RATE;
                                    const feeText = lang[selectedLanguage].FEE;
                                    const recipientGetsText = lang[selectedLanguage].RECIPIENT_GETS;
                                    const totalAmountText = lang[selectedLanguage].TOTAL_AMOUNT;

                                    message = `
${amountToSendText}: ${formattedAmount(totalAmountWithFee - fee)} ${senderWalletDetails?.currency?.code}

${exchangeRateText}: 1.00 ${senderWalletDetails?.currency?.code} = ${formattedAmount(exchange_rate, 6)} ${receiverWalletDetails?.currency.code}
${feeText}: ${formattedAmount(fee)} ${senderWalletDetails?.currency?.code}

${recipientGetsText} ${formattedAmount(recipient_amount)} ${receiverWalletDetails?.currency.code} 

${totalAmountText}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${senderWalletDetails?.currency?.code}
   `;
                                } else {
                                    message = `
${amountToSendText}: ${formattedAmount(totalAmountWithFee - fee)} ${senderWalletDetails?.currency?.code}

${feeText}: ${formattedAmount(fee)} ${senderWalletDetails?.currency?.code}

${recipientGetsText} ${formattedAmount(recipient_amount)} ${receiverWalletDetails?.currency.code} 

${totalAmountText}: ${formattedAmount(parseFloat(totalAmountWithFee))} ${senderWalletDetails?.currency?.code}
   `;
                                }
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].PROCEED_TITLE, payload: "w2w_exchng_proceed" },
                                    { content_type: "text", title: lang[selectedLanguage].ADJUST_AMOUNT_TITLE, payload: "w2w_exchng_adjust" },
                                    { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "wallet_overview" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]

                                if (totalAmountWithFee > senderWalletDetails.balance.available) {
                                    await quickMessage(entry.messaging[0], message, "CONFIRMED_EVENT_UPDATE", "4");

                                    const quickReplies1 = [
                                        { content_type: "text", title: lang[selectedLanguage].ADD_FUNDS, payload: "add_funds" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]

                                    return await quickReply(entry.messaging[0], lang[selectedLanguage].INSUFFICIENT_BALANCE, quickReplies1);
                                }
                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            } else if (amount <= 0.1) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].MINIMUM_AMOUNT, "CONFIRMED_EVENT_UPDATE");
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_AMOUNT_DIGITS, "CONFIRMED_EVENT_UPDATE");
                            }
                        }
                        else if (quick_reply?.payload === 'w2w_exchng_adjust') {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_AMOUNT_MESSAGE, "CONFIRMED_EVENT_UPDATE", "8.1");
                        }
                        else if (quick_reply?.payload === 'w2w_exchng_proceed') {
                            await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_conversion", "8.2", "Transaction OTP");
                        }
                        else if (instaChatbot?.last_message === "8.2" && text && !quick_reply?.payload) {

                            const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "confirm_conversion");

                            if (otpValidationResult.status) {


                                const receivingDetails = await Wallet.findById(instaChatbot?.conversion?.receiving_currency)

                                const data = {
                                    receiver_wallet_id: receivingDetails?.wallet_id,
                                    sender_wallet_id: instaChatbot.conversion.sending_currency,
                                    purpose: "",
                                    amount: instaChatbot.conversion.amount,
                                    type: "",
                                    payment_type: "conversion",
                                    description: "",
                                    attachments: [],
                                    transaction_method: "wallet"
                                }

                                const walletToWaletResponse = await walletToWalletTransaction(data)

                                console.log(walletToWaletResponse, "walletToWaletResponse")

                                // const conversionDetails = await instaWalletToWalletConversion(data)
                                // console.log(conversionDetails, "conversionDetails")

                                const subtitles = `
${lang[selectedLanguage].TRANSACTION_ID} ${walletToWaletResponse?.data?.reference_id}
Conversion: ${walletToWaletResponse?.data?.currency.code} to ${walletToWaletResponse?.exchanged?.currency.code}
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${walletToWaletResponse?.data?.currency.code} = ${formattedAmount(walletToWaletResponse?.data?.exchange_rate_markup, 6)}
Sending: ${walletToWaletResponse?.data?.amount.toFixed(2)} ${walletToWaletResponse?.data?.currency.code}
Receiving: ${walletToWaletResponse?.exchanged?.amount.toFixed(2)} ${walletToWaletResponse?.exchanged?.currency.code}
${lang[selectedLanguage].STATUS}: ${lang[selectedLanguage].COMPLETED}`

                                if (walletToWaletResponse.status) {
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: lang[selectedLanguage].CONVERSION_SUCCESS_TITLE,
                                                subtitle: subtitles,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: "main_menu",
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                }
                                else if (walletToWaletResponse?.message.includes("feature_not_available")) {
                                    const featureType = walletToWaletResponse?.message?.split("_")[3]
                                    const message = usersFeatureMessage(featureType)

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");
                                }
                                else if (walletToWaletResponse?.message.includes("limit_")) {
                                    const limitCode = walletToWaletResponse?.message?.split("_")[1]
                                    const sendingAmounts = walletToWaletResponse?.sendingAmounts
                                    const message = userLimitsMessage(limitCode, sendingAmounts)

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");
                                }
                                else {
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: lang[selectedLanguage].CONVERSION_FAILED_TITLE,
                                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/System%20Error.png",
                                                subtitle: lang[selectedLanguage].TRY_AGAIN_OR_CONTACT_SUPPORT_SUBTITLE,
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU_MESSAGE,
                                                        payload: "main_menu",
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                }

                            } else {
                                if (otpValidationResult.message === "max_attempts_exceeded") {

                                    await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                                } else {

                                    await invalidMessage(entry.messaging[0], "confirm_conversion", selectedLanguage, instaChatbot?.otpType);
                                }
                            }
                        }
                        // qr codes flow //
                        else if (quick_reply?.payload === "my_qrcode" || messaging?.postback?.payload === "my_qrcode") {
                            const wallets = await Wallet.find({ account: account?._id, wallet_type: 'insta', status: "active" });
                            const slicedWallets = wallets.slice(0, 8)

                            const quickReplies = slicedWallets?.map((wallet) => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `my_qrcode-${wallet.wallet_id}` } })

                            await quickReply(entry.messaging[0], lang[selectedLanguage].PICK_CURRENCY_MESSAGE, quickReplies, "4");

                        }
                        else if (quick_reply?.payload.includes('my_qrcode-')) {
                            const walletName = quick_reply?.payload.split('-')[1]
                            console.log(walletName);
                            const walletDetails = await Wallet.findOne({ wallet_id: walletName });
                            console.log(walletDetails)

                            if (walletDetails?.qrCode?.url) {
                                await sendVideoImage(walletDetails?.qrCode?.url, messaging?.sender?.id, "image");

                                const templatePayload = {
                                    template_type: "generic",
                                    elements: [
                                        {
                                            title: `${walletDetails.currency.code} ${lang[selectedLanguage].QR_Code} ☝`,
                                            // image_url: walletDetails?.qrCode?.url,
                                            buttons: [
                                                {
                                                    type: "postback",
                                                    title: lang[selectedLanguage].MAIN_MENU,
                                                    payload: "main_menu",
                                                },
                                            ],
                                        },
                                    ]
                                };
                                await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload)
                            } else {
                                const tokenPayload = {
                                    wallet_id: walletDetails?.wallet_id,
                                    account_id: account._id
                                };

                                const token = jwt.sign(tokenPayload, secretKey, { expiresIn: '10m' });
                                const activationUrl = `https://my.insta-pay.ch/qr-activate?token=${token}`;
                                const message = `Your QR code for ${walletDetails?.currency.code} is not activated yet.`
                                const templatePayload = {
                                    template_type: "generic",
                                    elements: [
                                        {
                                            title: message,
                                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Setting.png",
                                            subtitle: "Please click below to activate it.",
                                            buttons: [
                                                {
                                                    type: "web_url",
                                                    title: `Activate ${walletDetails?.currency.code} QR code`,
                                                    url: activationUrl,
                                                    webview_height_ratio: "full"
                                                },
                                                {
                                                    type: "postback",
                                                    title: lang[selectedLanguage].MAIN_MENU,
                                                    payload: "main_menu",
                                                },
                                            ],
                                        },
                                    ]
                                };
                                await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload)
                            }
                        }
                        // qrpay flow //
                        else if (quick_reply?.payload === "qr_quickpay" || messaging?.postback?.payload === "qr_quickpay") {
                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: lang[selectedLanguage].QR_PROMPT_MESSAGE,
                                        image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/QR%20QuickPay.png",
                                        buttons: [

                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].ALPHANUMERIC_CODE_TITLE,
                                                payload: "qr_pay_alpha",
                                            },
                                            {
                                                title: lang[selectedLanguage].SCAN_QR_CODE_TITLE,
                                                type: "web_url",
                                                url: `https://my.insta-pay.ch/quick-qrpay?bot=instagram&bot_id=${messaging?.sender?.id}`,
                                                webview_height_ratio: "full"
                                            },
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MAIN_MENU,
                                                payload: "main_menu",
                                            },
                                        ],
                                    },
                                ]
                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload)
                            // const quickReplies = [
                            //     { content_type: "text", title: lang[selectedLanguage].ALPHANUMERIC_CODE_TITLE, payload: "qr_pay_alpha" },
                            //     { content_type: "text", title: lang[selectedLanguage].SCAN_QR_CODE_TITLE, payload: "qr_pay_code" },
                            //     { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            // ]
                            // await quickReply(entry.messaging[0], lang[selectedLanguage].MAIN_MENU, quickReplies);
                        }
                        // if qr is alpha numeric
                        else if ((quick_reply?.payload === "qr_pay_alpha" || messaging?.postback?.payload === "qr_pay_alpha")) {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_ALPHANUMERIC_CODE_MESSAGE, "CONFIRMED_EVENT_UPDATE", "6");
                        }
                        // alpha numeric has been selected as the last message is "6"
                        else if (instaChatbot?.last_message === "6" && text && !quick_reply?.payload) {
                            console.log("6 condition ran")
                            const wallet = await Wallet.findOne({ wallet_id: text.toUpperCase() }).populate([
                                {
                                    path: 'account',
                                    populate: [
                                        { path: 'user' },
                                        { path: 'company' },
                                    ]
                                }
                            ]);
                            if (wallet) {
                                if (wallet?.account?._id.toString() === account?._id.toString()) {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].ENTER_AGAIN, payload: "qr_pay_alpha" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]
                                    return await quickReply(entry.messaging[0], lang[selectedLanguage].SEND_MONEY_TO_SELF, quickReplies);
                                }
                                const userName = wallet?.account?.account_type === "individual" ? wallet?.account?.user?.first_name + " " + wallet?.account?.user?.last_name : wallet?.account?.company?.company_name
                                const walletInfo = `
${lang[selectedLanguage].USERNAME_LABEL}: ${userName}
${lang[selectedLanguage].COUNTRY_LABEL}: ${wallet.account.country_name}
${lang[selectedLanguage].WALLET_NAME}: ${wallet.wallet_id}
${lang[selectedLanguage].WALLET_CURRENCY_LABEL}: ${wallet.currency.code}
`;
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].YES, payload: "qr_pay_code_yes" },
                                    { content_type: "text", title: lang[selectedLanguage].NO, payload: "qr_pay_alpha" },
                                    { content_type: "text", title: lang[selectedLanguage].SEND_AGAIN, payload: "qr_pay_alpha" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },

                                ]
                                instaChatbot.qr_receiving_wallet = wallet.wallet_id;
                                await instaChatbot.save();
                                await quickReply(entry.messaging[0], walletInfo, quickReplies, "4");

                            } else {
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].SEND_AGAIN, payload: "qr_pay_alpha" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                await quickReply(entry.messaging[0], lang[selectedLanguage].INVALID_CODE, quickReplies, "4");
                            }
                        }

                        else if (instaChatbot.qr_receiving_wallet && quick_reply?.payload === "qr_pay_code_no") {
                            instaChatbot.qr_receiving_wallet = "";
                            await instaChatbot.save()
                            await mainMenuMessage(entry.messaging[0], messaging?.sender?.id, instaChatbot, selectedLanguage)
                        }

                        // //////////////////////////////////////////////////////////////////////////////
                        // if qr is qr code
                        else if ((quick_reply?.payload === "qr_pay_code" || messaging?.postback?.payload === "qr_pay_code" || messaging?.postback?.payload === "rescan_qr_pay")) {
                            await quickMessage(entry.messaging[0], lang[selectedLanguage].SUBMIT_QR_CODE_IMAGE, "CONFIRMED_EVENT_UPDATE", "7");
                        }
                        // if there is an qr code image (NOTE: this flow is deprecated, now qr code is being scanned from browser)
                        else if (messaging?.message?.attachments) {
                            if (instaChatbot?.instabot_connected && instaChatbot?.last_message === "7" && !quick_reply?.payload && messaging?.message?.attachments[0]?.type === "image") {
                                const walletVerification = await verifyQrCode(messaging?.message?.attachments[0]?.payload?.url)
                                if (walletVerification?.status) {

                                    const wallet = await Wallet.findOne({ wallet_id: walletVerification?.walletId }).populate([
                                        {
                                            path: 'account',
                                            populate: [
                                                { path: 'user' },
                                                { path: 'company' },
                                            ]
                                        }
                                    ]);
                                    if (wallet) {
                                        if (wallet?.account?._id.toString() === account?._id.toString()) {
                                            const quickReplies = [
                                                { content_type: "text", title: lang[selectedLanguage].SCAN_AGAIN, payload: "qr_pay_code" },
                                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                            ]
                                            return await quickReply(entry.messaging[0], lang[selectedLanguage].SEND_MONEY_TO_SELF, quickReplies);
                                        }
                                        const userName = wallet?.account?.account_type === "individual" ? wallet?.account?.user?.first_name + " " + wallet?.account?.user?.last_name : wallet?.account?.company?.company_name
                                        const walletInfo = `${lang[selectedLanguage].PROCEED}`;

                                        const quickReplies = [
                                            { content_type: "text", title: lang[selectedLanguage].YES, payload: "qr_pay_code_yes" },
                                            { content_type: "text", title: lang[selectedLanguage].NO, payload: "qr_pay_code_no" },
                                            { content_type: "text", title: lang[selectedLanguage].SCAN_AGAIN, payload: "qr_pay_code" },
                                            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                        ]
                                        instaChatbot.qr_receiving_wallet = walletVerification?.walletId;
                                        await instaChatbot.save()

                                        const subtitleMsg = `
${lang[selectedLanguage].USERNAME_LABEL}: ${wallet?.account?.username}
${lang[selectedLanguage].COUNTRY_LABEL}: ${wallet?.account?.country_name}
${lang[selectedLanguage].WALLET_ID}: ${wallet.wallet_id}
${lang[selectedLanguage].WALLET_CURRENCY_LABEL}: ${wallet.currency.code}
`;

                                        const templatePayload = {
                                            template_type: "generic",
                                            elements: [
                                                {
                                                    title: userName,
                                                    subtitle: subtitleMsg,
                                                    image_url: wallet?.account?.profileImage?.url,
                                                    buttons: [
                                                        {
                                                            type: "web_url",
                                                            title: lang[selectedLanguage].VIEW_PROFILE_BUTTON,
                                                            url: `https://my.insta-pay.ch/profile/${wallet?.account?.username}`,
                                                            webview_height_ratio: "full"
                                                        }
                                                    ],
                                                },
                                            ]
                                        };
                                        await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                        await quickReply(entry.messaging[0], walletInfo, quickReplies);

                                    } else {
                                        const quickReplies = [
                                            // { content_type: "text", title: lang[selectedLanguage].SEND_AGAIN, payload: "qr_pay_alpha" },
                                            { content_type: "text", title: lang[selectedLanguage].SCAN_AGAIN, payload: "qr_pay_code" },
                                            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                        ]
                                        await quickReply(entry.messaging[0], lang[selectedLanguage].INVALID_QR_CODE, quickReplies, "4");
                                    }
                                } else {
                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].ALPHANUMERIC_CODE_TITLE, payload: "qr_pay_alpha" },
                                        { content_type: "text", title: lang[selectedLanguage].SCAN_AGAIN, payload: "qr_pay_code" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]
                                    await quickReply(entry.messaging[0], lang[selectedLanguage].INVALID_QR_CODE, quickReplies, "4");
                                }

                            }
                        }

                        // if user confirms the message for qr code payment
                        else if (instaChatbot.qr_receiving_wallet && quick_reply?.payload === "qr_pay_code_yes") {
                            const pans = await PanModel.find({ account: account._id });

                            if (pans.length !== 0) {
                                const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].PAYMENT_CARD, payload: "qr_pay_card" },
                                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "qr_pay_wallets_payment" },
                                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "qr_pay_paypal" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]

                                await quickReply(entry.messaging[0], message, quickReplies, "4");

                            } else {
                                const message = lang[selectedLanguage].SELECT_PAYMENT_METHOD

                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].INSTAPAY_WALLETS, payload: "qr_pay_wallets_payment" },
                                    { content_type: "text", title: lang[selectedLanguage].PAYPAL, payload: "qr_pay_paypal" },
                                    { content_type: "text", title: lang[selectedLanguage].ADD_PAYMENT_CARD, payload: "add_payment_card-qr_pay_code_yes" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]

                                await quickReply(entry.messaging[0], message, quickReplies, "4");
                            }
                        }

                        // if user proceeds with the paypal 
                        // if user has selected w2w with Payment Card
                        else if (messaging?.postback?.payload?.includes("qr_pay_paypal") || quick_reply?.payload?.includes("qr_pay_paypal") || (instaChatbot?.last_message?.includes("qr_pay_paypal") && text && !quick_reply?.payload)) {
                            await w2wQrPayPaypal(
                                messaging.sender.id,
                                messaging?.postback?.payload || quick_reply?.payload,
                                account,
                                instaChatbot,
                                text,
                                selectedLanguage
                            );
                            return
                        }

                        else if (messaging?.postback?.payload?.includes("qr_pay_card") || quick_reply?.payload?.includes("qr_pay_card") || (instaChatbot?.last_message?.includes("qr_pay_card") && text && !quick_reply?.payload)) {
                            await w2wCardQRPay(
                                messaging.sender.id,
                                messaging?.postback?.payload || quick_reply?.payload,
                                account,
                                instaChatbot,
                                text,
                                selectedLanguage
                            );
                            return
                        }

                        // if user proceeds with instapay wallets
                        else if (instaChatbot.qr_receiving_wallet && quick_reply?.payload === "qr_pay_wallets_payment") {

                            const wallets = await Wallet.find({ account: account?._id, wallet_type: 'insta', status: "active" });
                            const slicedWallets = wallets.slice(0, 8)

                            const quickReplies = slicedWallets?.map((wallet) => { return { content_type: "text", title: `${currencyToEmoji[wallet.currency.code]} ${wallet.currency.code}`, payload: `send_qr-${wallet._id}` } })
                            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })

                            await quickReply(entry.messaging[0], lang[selectedLanguage].PICK_CURRENCY_DEBITED, quickReplies, "4");
                        }
                        // if user declines the message for qr code payment
                        else if (instaChatbot.qr_receiving_wallet && quick_reply?.payload === "qr_pay_code_no") {
                            instaChatbot.qr_receiving_wallet = "";
                            await instaChatbot.save()
                            await mainMenuMessage(entry.messaging[0], messaging?.sender?.id, instaChatbot, selectedLanguage)
                        }
                        // if user selects the currency to make the qr payment
                        else if (quick_reply?.payload.includes("send_qr-")) {
                            const wallet_id = quick_reply?.payload.split("send_qr-")[1]
                            instaChatbot.qr_sending_currency = wallet_id
                            await instaChatbot.save();

                            const receiverWallet = await Wallet.findOne({ wallet_id: instaChatbot.qr_receiving_wallet })

                            await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_AMOUNT_CURRENCY.replace('{{currency}}', receiverWallet.currency.code), "CONFIRMED_EVENT_UPDATE", "9");

                        }
                        // if user sends the amount to make the qr payment
                        else if (instaChatbot?.last_message === "9" && instaChatbot?.qr_sending_currency && instaChatbot?.qr_receiving_wallet && text) {
                            const digitRegex = /^\d+(\.\d+)?$/;
                            const isNumber = digitRegex.test(text)
                            const amount = parseFloat(text);
                            const walletDetails = await Wallet.findById(instaChatbot.qr_sending_currency)
                            const receivingWallet = await Wallet.findOne({ wallet_id: instaChatbot.qr_receiving_wallet })
                            if (isNumber && amount >= 0.1) {
                                instaChatbot.qr_sending_amount = amount;
                                await instaChatbot.save()

                                // const exchangeRates = await gettingExchangeRates(wallet.currency.code, receivingWallet?.currency?.code, parseFloat(text), account?.level._id, 'qr_pay', "request")
                                // console.log(exchangeRates, "exchangeDetails")

                                const { exchange_rate, fee, totalAmountWithFee } = await calculateExchangeAndFees(walletDetails.currency.code, receivingWallet?.currency?.code, amount, "qr_pay", account?.level._id, "wallet", walletDetails, "request");

                                let message

                                if (walletDetails.currency.code !== receivingWallet.currency.code) {

                                    message = `
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}
${lang[selectedLanguage].EXCHANGE_RATE}: 1.00 ${walletDetails.currency.code} = ${formattedAmount(exchange_rate, 6)} ${receivingWallet.currency.code}
       
${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(amount)} ${receivingWallet.currency.code}
    
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}
    
       `
                                } else {
                                    message = `
${lang[selectedLanguage].AMOUNT_TO_SEND}: ${formattedAmount(totalAmountWithFee - fee)} ${walletDetails.currency.code}
${lang[selectedLanguage].FEE}: ${formattedAmount(fee)} ${walletDetails.currency.code}
    
${lang[selectedLanguage].RECIPIENT_GETS} ${formattedAmount(amount)} ${receivingWallet.currency.code}
    
${lang[selectedLanguage].TOTAL_AMOUNT}: ${formattedAmount(totalAmountWithFee)} ${walletDetails.currency.code}
    `
                                }

                                if (totalAmountWithFee > walletDetails.balance.available) {
                                    await quickMessage(entry.messaging[0], message, "CONFIRMED_EVENT_UPDATE", "4");

                                    const quickReplies1 = [
                                        { content_type: "text", title: lang[selectedLanguage].ADD_FUNDS, payload: "add_funds" },
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                    ]

                                    return await quickReply(entry.messaging[0], lang[selectedLanguage].INSUFFICIENT_BALANCE, quickReplies1);
                                }
                                const quickReplies = [
                                    { content_type: "text", title: lang[selectedLanguage].YES_CONTINUE_TITLE, payload: "proceed_qr_pay" },
                                    { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "main_menu" },
                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]

                                await quickReply(entry.messaging[0], message, quickReplies, "4");

                            } else if (amount <= 0.1) {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].MINIMUM_AMOUNT, "CONFIRMED_EVENT_UPDATE");
                            } else {
                                await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_AMOUNT_DIGITS, "CONFIRMED_EVENT_UPDATE");

                            }
                        }
                        else if (quick_reply?.payload === "proceed_qr_pay") {
                            await handleOTPGeneration(selectedLanguage, messaging?.sender?.id, "confirm_qr_pay", "10", "Transaction OTP");
                        }
                        // last message 10 means, otp for qr payment transaction has been received
                        else if (instaChatbot?.last_message === "10" && instaChatbot?.qr_sending_currency && instaChatbot?.qr_receiving_wallet && text) {
                            const otpValidationResult = await validateOTP(messaging?.sender?.id, text, "confirm_qr_pay");

                            if (otpValidationResult.status) {

                                const data = {
                                    receiver_wallet_id: instaChatbot?.qr_receiving_wallet,
                                    sender_wallet_id: instaChatbot?.qr_sending_currency,
                                    purpose: "",
                                    amount: instaChatbot?.qr_sending_amount,
                                    type: "wallet_to_wallet",
                                    payment_type: "qr_pay",
                                    transaction_type: "request",
                                    transaction_method: "wallet"
                                }
                                const walletToWaletResponse = await walletToWalletTransaction(data)
                                console.log(walletToWaletResponse)
                                if (walletToWaletResponse?.status === true) {
                                    console.log('transaction successful')

                                    const wallet = await Wallet.findOne({ wallet_id: instaChatbot?.qr_receiving_wallet }).populate([
                                        {
                                            path: 'account',
                                            populate: [
                                                { path: 'user' },
                                                { path: 'company' },
                                            ]
                                        }
                                    ]);
                                    const sendingWallet = await Wallet.findById(instaChatbot?.qr_sending_currency)
                                    const receiverName = wallet.account.account_type === "individual" ? wallet.account.user.first_name + " " + wallet.account.user.last_name :
                                        wallet?.account?.company?.company_name
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `You have succesfully sent ${formattedAmount(instaChatbot?.qr_sending_amount)} ${wallet?.currency.code} to ${receiverName}`,
                                                image_url: "https://my.insta-pay.ch/static/media/chips_in_left.3898cd344de2a6cfda6c.png",
                                                buttons: [

                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU,
                                                        payload: "main_menu",
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                                }
                                else if (walletToWaletResponse?.message.includes("feature_not_available")) {
                                    const featureType = walletToWaletResponse?.message?.split("_")[3]
                                    const message = usersFeatureMessage(featureType)

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");

                                }
                                else if (walletToWaletResponse?.message.includes("limit_")) {
                                    const limitCode = walletToWaletResponse?.message?.split("_")[1]
                                    const sendingAmounts = walletToWaletResponse?.sendingAmounts

                                    const message = userLimitsMessage(limitCode, sendingAmounts)

                                    const quickReplies = [
                                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
                                    ];

                                    await quickReply(entry.messaging[0], message, quickReplies, "4");
                                }
                                else {
                                    console.log('transaction failed')
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: walletToWaletResponse?.message,
                                                image_url: "https://my.insta-pay.ch/static/media/chips_in_left.3898cd344de2a6cfda6c.png",
                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: lang[selectedLanguage].MAIN_MENU,
                                                        payload: "main_menu",
                                                    },
                                                ],
                                            },
                                        ]
                                    };
                                    await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload)
                                }
                                instaChatbot.qr_sending_currency = null;
                                instaChatbot.qr_receiving_wallet = "";
                                instaChatbot.qr_sending_amount = null;
                                await instaChatbot.save();
                            } else {
                                if (otpValidationResult.message === "max_attempts_exceeded") {

                                    await quickMessage({ sender: { id: messaging?.sender?.id } }, lang[selectedLanguage].ACCOUNT_TEMP_BLOCKED, "CONFIRMED_EVENT_UPDATE", "4");
                                } else {

                                    await invalidMessage(entry.messaging[0], "confirm_qr_pay", selectedLanguage, instaChatbot?.otpType);
                                }
                            }
                        }

                        // // // // // // // // // // // // // // // // // // // // // // // // // // // 
                        // KYC Verification start flow
                        else if (messaging?.postback?.payload === "kyc_verification" || quick_reply?.payload === "kyc_verification") {
                            const message = `
To verify your identity, please follow the below steps.

1⃣ Login to InstaPay web portal.\n
2️⃣ Go to settings page and select "Identity verification" option from sub-menu.\n
3⃣ Type in the requested information and click "Start verification" button.
`

                            await quickMessage(entry.messaging[0], message, "CONFIRMED_EVENT_UPDATE", "4");
                            const templatePayload = {

                                template_type: "generic",
                                elements: [
                                    {
                                        title: lang[selectedLanguage].CLICK_TO_LOG_IN,
                                        buttons: [
                                            {
                                                type: "web_url",
                                                title: lang[selectedLanguage].LOGIN,
                                                url: "https://my.insta-pay.ch/login",
                                            },
                                            {
                                                type: "postback",
                                                title: lang[selectedLanguage].MAIN_MENU,
                                                payload: "main_menu",
                                            },

                                        ],
                                    },


                                ],

                            };
                            await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                        }

                        // // // // // // // // // // // // // // // // // // // // // // // // // // // 
                        // currency request flow
                        else if (quick_reply?.payload === "add_currency") {
                            const currencies = await availableCurrencies();

                            if (!currencies?.length) {
                                const quickReplies = [

                                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                                ]
                                return await quickReply(entry.messaging[0], "Unfortunately, there are no currencies available for now.", quickReplies, "4");
                            }

                            const wallets = await Wallet.find({ account: account._id, wallet_type: 'insta', status: "active" });
                            const availableCurrenciesUser = currencies.filter((currency) => !wallets.some((wallet) => wallet.currency.code === currency.code));
                            const quickReplies = availableCurrenciesUser.map(currency => { return { content_type: "text", title: currency.code, payload: `currency_request-${currency.code}` } })
                            quickReplies.push({ content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: "main_menu" })
                            await quickReply(entry.messaging[0], lang[selectedLanguage].SELECT_CURRENCY, quickReplies, "4");
                        }
                        else if (quick_reply?.payload.includes("currency_request-")) {
                            const currency = quick_reply?.payload.split('-')[1];
                            instaChatbot.requested_currency = currency;
                            await instaChatbot.save()
                            await quickMessage(entry.messaging[0], `${lang[selectedLanguage].REQUEST_REASON_PART1} ${currency} ${lang[selectedLanguage].CURRENCY}`, "CONFIRMED_EVENT_UPDATE", "5");
                            // console.log(status, message)
                        }
                        else if (instaChatbot?.last_message === "5" && text && !quick_reply?.payload) {
                            instaChatbot.currency_description = text;
                            await instaChatbot.save()
                            // const { status, message } = await requestCurrency(account._id, currency);
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].YES, payload: "currency_request_yes" },
                                { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "wallet_overview" },
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]
                            await quickReply(entry.messaging[0], lang[selectedLanguage].CONFIRM_REQUEST_CURRENCY, quickReplies, "4");
                        }
                        else if (quick_reply?.payload === "currency_request_yes") {

                            const { status, message, savedRequestedCurrency } = await requestCurrency(account, instaChatbot?.requested_currency, account.country);
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]
                            console.log(status, message, savedRequestedCurrency, instaChatbot?.requested_currency, "savedRequestedCurrency")

                            if (status) {
                                const templatePayload = {
                                    template_type: "generic",
                                    elements: [
                                        {
                                            title: `Your ${savedRequestedCurrency?.code} currency requested has been accepted.`,
                                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                                            buttons: [
                                                {
                                                    type: "postback",
                                                    title: 'Main Menu',
                                                    payload: "main_menu",
                                                },
                                            ],
                                        },
                                    ]
                                };
                                await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")

                                return
                            }
                            let newMessage;
                            if (message.includes("already been requested")) {
                                newMessage = lang[selectedLanguage].ALREADY_REQUESTED;
                            } else if (message.includes("has been requested!")) {
                                newMessage = `${lang[selectedLanguage].YOUR} ${savedRequestedCurrency?.code} ${lang[selectedLanguage].SUCCESS_REQUESTED}`;
                            } else if (message.includes("available")) {
                                newMessage = lang[selectedLanguage].NOT_AVAILABLE;
                            } else if (message.includes("pending")) {
                                newMessage = lang[selectedLanguage].PENDING_REQUEST;
                            } else if (message.includes("already accepted!")) {
                                newMessage = lang[selectedLanguage].ACCEPTED_REQUEST;
                            } else if (message.includes("declined")) {
                                newMessage = lang[selectedLanguage].DECLINED_BY_ADMIN;
                            } else {
                                newMessage = message
                            }
                            await quickReply(entry.messaging[0], newMessage, quickReplies, "4");

                        }
                        else if (quick_reply?.payload === "currency_request_no") {
                            const quickReplies = [
                                { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                            ]
                            await quickReply(entry.messaging[0], lang[selectedLanguage].PICK_CURRENCY_MESSAGE, quickReplies, "4");
                        }
                        // user has clicked on add funds
                        //                         else if (messaging?.postback?.payload === "add_funds" || quick_reply?.payload === "add_funds") {
                        //                             const message = `
                        // To add funds, please follow the below steps.

                        // 1⃣ Login to InstaPay web portal.\n
                        // 2️⃣ Go to wallets page and select "Add funds" option from Wallet Management menu.\n
                        // `

                        //                             await quickMessage(entry.messaging[0], message, "CONFIRMED_EVENT_UPDATE", "4");
                        //                             const templatePayload = {

                        //                                 template_type: "generic",
                        //                                 elements: [
                        //                                     {
                        //                                         title: "Click below to Login Now",
                        //                                         buttons: [
                        //                                             {
                        //                                                 type: "web_url",
                        //                                                 title: lang[selectedLanguage].LOGIN,
                        //                                                 url: "https://my.insta-pay.ch/login",
                        //                                             },
                        //                                             {
                        //                                                 type: "postback",
                        //                                                 title: lang[selectedLanguage].MAIN_MENU,
                        //                                                 payload: "main_menu",
                        //                                             },

                        //                                         ],
                        //                                     },


                        //                                 ],

                        //                             };
                        //                             await sendTemplate(entry.messaging[0], messaging?.sender?.id, templatePayload, "4")
                        //                         }
                        // if user is connected, and it is a random text
                        else if (instaChatbot?.last_message !== "0" && text && text !== '' && !quick_reply && !messaging?.postback?.payload) {
                            console.log("it is a random text")
                            await mainMenuMessage(entry.messaging[0], messaging?.sender?.id, instaChatbot, selectedLanguage)
                            text = ""
                        }
                    }
                    else {
                        await registerTemplate(selectedLanguage, entry.messaging[0], messaging?.sender?.id);
                        return text = ""
                    }
                } else {
                    if (messaging?.postback?.payload === "connect_1" && (instaChatbot?.last_message === "0" || instaChatbot?.last_message?.startsWith("register") || !instaChatbot?.last_message)) {
                        return await quickMessage(entry.messaging[0], lang[selectedLanguage].ENTER_USERNAME_MESSAGE, "CONFIRMED_EVENT_UPDATE", "3");
                    } else {
                        console.log("else ran")
                        await registerTemplate(selectedLanguage, entry.messaging[0], messaging?.sender?.id);
                        return text = ""
                    }
                }

            }
        }
    }
}

async function instaCodeVerification(code, recipientId, data, username, selectedLanguage) {
    try {
        console.log(data, "codeinsideverification");

        const instaBot = await InstaChatbotModel.findOne({ recipient: recipientId });
        console.log(instaBot, "instaBotinstaBot")

        Account.findOne({ $and: [{ username }, { active: true }] }, { insta_bot: true, username: true, instaBotToken: true, account_type: true, user: true, company: true, level: true, chatbotBannedUntil: true, chatbotFailedAttempts: true, chatbotFirstFailedAttempt: true })
            .populate([
                { path: 'user', select: 'first_name last_name' },
                { path: 'company', select: 'company_name' }
            ])
            .then(async (user) => {
                console.log(user);
                if (user) {
                    const currentTime = new Date();

                    if (instaBot?.chatbotBannedUntil && instaBot?.chatbotBannedUntil > currentTime) {
                        // User is currently banned
                        await quickMessage(data, `Your account has been temporarly banned. Please try again later.`, "CONFIRMED_EVENT_UPDATE", "0");
                        return;
                    }

                    if (user.instaBotToken) {
                        console.log("1st condition ran")
                        if (!user.insta_bot) {
                            console.log("2nd condition ran")
                            jwt.verify(user.instaBotToken, process.env.INSTA_CHATBOT_LINK_KEY, async function (err, token_data) {
                                console.log("3rd condition ran")
                                if (err || !(code == token_data.link_code.split(":")[1] && user._id == token_data.account_id)) {
                                    console.log("4th condition ran")
                                    let chatbotFailedAttempts = instaBot?.chatbotFailedAttempts || 0;
                                    let chatbotFirstFailedAttempt = instaBot?.chatbotFirstFailedAttempt || currentTime;

                                    // Reset failed attempts if more than 10 minutes have passed since the first failed attempt
                                    if (currentTime - new Date(chatbotFirstFailedAttempt) > 10 * 60000) {
                                        chatbotFailedAttempts = 0;
                                        chatbotFirstFailedAttempt = currentTime;
                                    }

                                    chatbotFailedAttempts += 1;

                                    if (chatbotFailedAttempts > 3) {
                                        console.log("5th condition ran")
                                        const banExpiryTime = new Date(currentTime.getTime() + 10 * 60000); // 10 minutes in milliseconds
                                        await InstaChatbotModel.updateOne({ _id: instaBot._id }, { $set: { chatbotBannedUntil: banExpiryTime, chatbotFailedAttempts: 0, chatbotFirstFailedAttempt: null } });


                                        await quickMessage(data, `Your account has been temporarly banned. Please try again later.`, "CONFIRMED_EVENT_UPDATE", "0");
                                    } else {
                                        console.log("5th running")
                                        InstaChatbotModel.updateOne({ _id: instaBot._id }, { $set: { chatbotFailedAttempts, chatbotFirstFailedAttempt } }).then(async (updated) => {
                                            console.log("updated", updated)
                                        }).catch((err) => {
                                            console.log(err, "someting went wrong")
                                        })

                                        await quickMessage(data, `${lang[selectedLanguage].CODE_VERIFICATION_FAILURE_MESSAGE} ${lang[selectedLanguage].ENTER_AGAIN}.`, "CONFIRMED_EVENT_UPDATE");
                                    }
                                } else {
                                    // await Account.updateOne({ _id: user._id }, { $set: { insta_username: username, insta_subscriber_id: recipientId, insta_bot: true, chatbotFailedAttempts: 0, chatbotFirstFailedAttempt: null } });
                                    // await InstaChatbotModel.updateOne({ recipient: recipientId }, { $set: { username } });
                                    const userInstaDetails = await userInstaInfo(recipientId)
                                    await instaAccountVerification(code, recipientId, userInstaDetails.username, data, selectedLanguage)
                                    // await handleOTPGeneration(recipientId, "confirm_verification", "3.2", "Signup OTP Code");
                                }
                            });
                        } else {
                            await quickMessage(data, lang[selectedLanguage].ACCOUNT_LINKED_MESSAGE, "CONFIRMED_EVENT_UPDATE", "0");
                        }
                    } else {
                        await quickMessage(data, `${lang[selectedLanguage].CODE_VERIFICATION_FAILURE_MESSAGE} ${lang[selectedLanguage].ENTER_AGAIN}.`, "CONFIRMED_EVENT_UPDATE");
                    }
                } else {
                    await quickMessage(data, `${lang[selectedLanguage].CODE_VERIFICATION_FAILURE_MESSAGE} ${lang[selectedLanguage].ENTER_AGAIN}.`, "CONFIRMED_EVENT_UPDATE");
                }
            })
            .catch(async (err) => {
                console.log(err);
                await quickMessage(data, lang[selectedLanguage].ACCOUNT_LINKING_FAILURE_MESSAGE, "CONFIRMED_EVENT_UPDATE", "0");
            });
    } catch (err) {
        console.log(err);
        await quickMessage(data, lang[selectedLanguage].ACCOUNT_LINKING_FAILURE_MESSAGE, "CONFIRMED_EVENT_UPDATE", "0");
    }
}

async function instaAccountVerification(code, recipientId, insta_username, data, selectedLanguage) {
    try {
        console.log({ code, recipientId, insta_username, data })
        let instaChatbot = await InstaChatbotModel.findOne({ recipient: recipientId });
        console.log(instaChatbot, "instaChatbot")
        Account.updateOne({ username: instaChatbot.account_username }, { $set: { insta_username: insta_username, insta_subscriber_id: recipientId, insta_bot: true, insta_recipient_id: instaChatbot._id } })
            .then(async (account) => {
                if (account) {
                    instaChatbot.instabot_connected = true;
                    await instaChatbot.save()
                    const templatePayload = {
                        template_type: "generic",
                        elements: [
                            {
                                title: lang[selectedLanguage].CONGRATULATIONS_MESSAGE,
                                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                            },

                        ]
                    };
                    const message = lang[selectedLanguage].SYNC_SUCCESS_MESSAGE;
                    await sendTemplate(data, recipientId, templatePayload)
                    const quickReplies = [
                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" },
                    ];
                    await quickReply(data, message, quickReplies, "4");
                    sendPrivateMessage(account?._id, "Your InstaPay account is now connected with Instagram chatbot!");

                }
            }).catch(async (err) => {
                console.log(err)
                await quickMessage(data, lang[selectedLanguage].ACCOUNT_LINKING_FAILURE_MESSAGE, "CONFIRMED_EVENT_UPDATE", "0");
            })
    } catch (err) {
        console.log(err)
        await quickMessage(data, lang[selectedLanguage].ACCOUNT_LINKING_FAILURE_MESSAGE, "CONFIRMED_EVENT_UPDATE", "0");

    }
}

module.exports = { replyToText, sendTemplate, instaCodeVerification, sendVideoImage, quickMessage, quickReply, sendMultipleImages };
