const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');
const Fuse = require('fuse.js');
const crypto = require('crypto');
const moment = require('moment-timezone');

const facebook_access_token = process.env.facebook_access_token//"EAAGOMUlfR7cBO6n48Rrs2plzu65R0vuF04cbFZBwwXo3GlHLgUWNLFx4SPJUTnZBGZAgAaIL7N4N9m4xldOv6K5GnxYZBKONlyRec10qhmz8Q3Fm1lxrl9yUdouq22r3rX1HYOV0399MH7eRsgRsOplDebRvFYoQzJQsUrplZAvQR9swgyLPRya2yC4tvX0ZCF"//"EAAKsyIWCvBEBO1QxjMLOWjfUUb5aQZB3HgkQLxDYvPe0aXWLtlKxreGpu1QzV6I4YNZBSFTzMiliVMMa3PrmstgMT7PjTqPziUsg1cXUHHYsZBpvdgP3JfViRWLA8qwo4HxuSaflA2tnexobjE8egttZCS7HIjvm7OmTP9CoXcQUJX5EY37KBGZCcs7V80te6"
const facebook_page_id = "206463389213262"//"211768592028127"
const lang = require('../utils/languages/languages.json');
const countries = require('../utils/countryIso.json');
const citiesData = require('../utils/countries/CitiesData.json')
var Hashids = require('hashids');
const countryCurrencyJson = require('../utils/countries/country.json')

const InstaChatbotModel = require('../models/InstaChatbot.model');
const AccountModel = require('../models/Account.model');
const WalletModel = require('../models/Wallet.model');
const UserWithdrawalModel = require('../models/User-Withdrawal.model');
const Beneficiary = require('../models/Beneficiary.model');
const Country = require('../models/Country.model');
const { getExchangeRatesToUSD } = require('./conversion');
// const { createWallet } = require('../controllers/Account.controller');
const Category = require('../models/Category.model');
const AccountLevelModel = require('../models/Account-Level.model');
const UserModel = require('../models/User.model');
const { formatDecimalNumbersWithLimit } = require('./payerRates');

const Thunes_KEY = process.env.API_KEY_PROD;
const Thunes_SECRET = process.env.API_SECRET_PROD;
const authHeadersThunes = `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`;
const sandboxUrl = process.env.THUNES_PROD_URL
const secretKey = process.env.BOT_SECRET_TOKEN_KEY;


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

async function quickMessage(data, message, lastMessage) {
    try {
        const requestBody = {
            recipient: { id: data?.sender?.id },
            messaging_type: "MESSAGE_TAG",
            message: { text: message },
            tag: "CONFIRMED_EVENT_UPDATE",
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
        console.log(err?.response?.data?.error || err, "err")
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
async function updateLastMessage(data, lastMessage) {
    try {
        console.log(data, lastMessage, "datainside")
        const timestamp = data?.timestamp;
        const timesStamp = timestamp ? new Date(timestamp) : new Date();
        console.log(timesStamp, "timesStamp")
        let instaChatbot = await InstaChatbotModel.findOne({ recipient: data?.sender?.id });
        if (instaChatbot) {
            instaChatbot.last_message = lastMessage;
            instaChatbot.last_message_time = timesStamp
            await instaChatbot.save();
        } else {
            await new InstaChatbotModel({ recipient: data?.sender?.id, last_message: lastMessage, last_message_time: timesStamp }).save();
        }
    } catch (error) {
        console.error('Error updating last message:', error);
    }
}

async function mainMenuMessage(data, recipientId, instaChatbot, selectedLanguage) {

    await quickMessage(data, 'Welcome back! Need to make a transaction? Select from the options below.', "CONFIRMED_EVENT_UPDATE");
    const templatePayload = {
        template_type: "generic",
        elements: [
            {

                title: "View your balance and recent activity.",
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

                title: "Send money quickly and securely.",
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

                title: "Review your past transactions.",
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

                title: "Pay using QR code instantly.",
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

                title: "Generate your personal QR for receiving payments.",
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

                title: "Discover more services and features.",
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
                title: "Adjust language settings.",
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
    await instaChatbot.save()
}

async function w2wPaymentMethodsTemplateCard(data, recipientId, selectedLanguage) {
    const templatePayload = {
        template_type: "generic",
        elements: [
            {

                title: lang[selectedLanguage].INSTANT_TITLE,
                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Instant.png",
                buttons: [
                    {
                        type: "postback",
                        title: "Instant",
                        payload: "updated_w2w_card_payment_type-instant",
                    },
                    {
                        type: "postback",
                        title: "⬅️ Back",
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
                        title: "Subscription",
                        payload: "updated_w2w_card_payment_type-subsription",
                    },
                    {
                        type: "postback",
                        title: "🗃️ Main Menu",
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
                        title: "Schedule",
                        payload: "updated_w2w_card_payment_type-schedule",
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

async function w2wPaymentMethodsTemplate(data, recipientId, selectedLanguage, payload) {
    const templatePayload = {
        template_type: "generic",
        elements: [
            {

                title: lang[selectedLanguage].INSTANT_TITLE,
                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Instant.png",
                buttons: [
                    {
                        type: "postback",
                        title: "Instant",
                        payload: `${payload}-instant`,
                    },
                    {
                        type: "postback",
                        title: "⬅️ Back",
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
                        title: "Subscription",
                        payload: `${payload}_type-subscription`,
                    },
                    {
                        type: "postback",
                        title: "🗃️ Main Menu",
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
                        title: "Schedule",
                        payload: `${payload}_type-schedule`,
                    },

                ],
            },
        ]
    };

    await sendTemplate(data, recipientId, templatePayload, "4")
}

const searchUsersAndWallets = async (query) => {
    if (!query) {
        console.log("no query!")
        return
    }

    const accounts = await AccountModel.aggregate([
        {
            $match: {
                $or: [
                    { username: query },
                    { email: query, isEmailSearch: true },
                    { phone: query, isPhoneSearch: true },
                    { insta_username: query, }
                ]
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'user'
            }
        },
        {
            $lookup: {
                from: 'companies',
                localField: 'company',
                foreignField: '_id',
                as: 'company'
            }
        },
        {
            $lookup: {
                from: 'wallets',
                let: { accountId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$account', '$$accountId'] },
                                    { $eq: ['$wallet_type', 'insta'] },
                                    { $eq: ['$status', 'active'] }
                                ]
                            }
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            wallet_type: 1,
                            status: 1,
                            currency: 1,
                            wallet_id: 1,
                            default: 1
                        }
                    }
                ],
                as: 'wallets'
            }
        },
        {
            $unwind: {
                path: '$user',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $unwind: {
                path: '$company',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                _id: 1,
                username: 1,
                email: 1,
                phone: 1,
                account_type: 1,
                first_name: '$user.first_name',
                last_name: '$user.last_name',
                company_name: '$company.company_name',
                country_name: 1,
                profileImage: '$profileImage.url',
                about_me: 1,
                wallets: 1
            }
        }
    ]);

    if (accounts.length === 0) {
        const wallets = await WalletModel.aggregate([
            {
                $match: {
                    $expr: {
                        $eq: [{ $toUpper: '$wallet_id' }, query.toUpperCase()]
                    }
                }
            },
            {
                $lookup: {
                    from: 'accounts',
                    localField: 'account',
                    foreignField: '_id',
                    as: 'account'
                }
            },
            {
                $unwind: '$account'
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'account.user',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $lookup: {
                    from: 'companies',
                    localField: 'account.company',
                    foreignField: '_id',
                    as: 'company'
                }
            },
            {
                $unwind: {
                    path: '$user',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $unwind: {
                    path: '$company',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: '$account._id',
                    username: '$account.username',
                    email: '$account.email',
                    phone: '$account.phone',
                    account_type: '$account.account_type',
                    first_name: '$user.first_name',
                    last_name: '$user.last_name',
                    company_name: '$company.company_name',
                    country_name: '$account.country_name',
                    profileImage: '$account.profileImage.url',
                    about_me: '$account.about_me',
                    wallets: [{
                        _id: '$_id',
                        wallet_type: '$wallet_type',
                        status: '$status',
                        currency: '$currency',
                        default: '$default',
                        // balance: '$balance',
                        wallet_id: '$wallet_id',
                        // createdAt: '$createdAt'
                    }]
                }
            }
        ]);

        return wallets;
    }

    return accounts;
};

function getDistinctObjects(arr) {
    const uniqueIds = new Set();
    return arr.filter(obj => {
        const strId = obj._id.toString();
        if (!uniqueIds.has(strId)) {
            uniqueIds.add(strId);
            return true;
        }
        return false;
    });
}

function userLimitsMessage(limitCode, sendingAmounts) {
    if (limitCode === "sdl400") {
        return `Your daily transaction limit has been exceeded of ${sendingAmounts?.convertedDailyLimit?.toFixed(2) ?? "N/A"} ${sendingAmounts?.code}. Please proceed the flow again with the amount less than the limit left.`
    }
    else if (limitCode === "sml400") {
        return `Your monthly transaction limit has been exceeded of ${sendingAmounts?.convertedMonthlyLimit?.toFixed(2) ?? "N/A"} ${sendingAmounts?.code}. Please proceed the flow again with the amount less than the limit left.`
    }
    else if (limitCode === "syl400") {
        return `Your yearly transaction limit has been exceeded of ${sendingAmounts?.convertedYearlyLimit?.toFixed(2) ?? "N/A"} ${sendingAmounts?.code}. Please proceed the flow again with the amount less than the limit left.`
    }
    else if (limitCode === "tal400") {
        return `You can send the maximum of ${sendingAmounts?.convertedSenderLimit?.toFixed(2) ?? "N/A"} ${sendingAmounts?.code} per transaction. Please proceed the flow again with the amount less than the limit left.`
    }
    else if (limitCode === "dtc400") {
        return `Your daily transaction count has exceeded the limit`
    }
    else if (limitCode === "mtc400") {
        return `Your monthly transaction count has exceeded the limit`
    }
    else if (limitCode === "ytc400") {
        return `Your yearly transaction count has exceeded the limit`
    } else {
        return `Your recipient's transaction has exceeded the limit`
    }
}

function usersFeatureMessage(featureCode) {
    if (featureCode === "1") {
        return "This feature is not available in your country. Kindly contact the Insta-Pay administrator or select any other payout channel."
    } else {
        return "This feature is not available in your recipient's country. Kindly contact the Insta-Pay administrator."
    }
}

function validateAttachments(attachments) {
    let imageCount = 0;
    let videoCount = 0;

    for (const attachment of attachments) {
        if (attachment?.type === "image") {
            imageCount++;
        } else if (attachment?.type === "video") {
            videoCount++;
        }
    }

    const totalAttachments = attachments.length;
    const validCount = imageCount <= 4 && videoCount <= 1 && totalAttachments <= 5;
    const allImagesAndVideos = attachments.every(att => att.type === "image" || att.type === "video");

    return {
        validCount,
        allImagesAndVideos,
        imageCount,
        videoCount,
        totalAttachments
    };
}

async function findDefaultPayoutChannel(userId) {
    try {
        const withdrawals = await UserWithdrawalModel.find({ account: userId }).populate("country");

        for (const withdrawal of withdrawals) {
            const defaultChannelTypes = ['bank_details', 'mobile_wallet', 'cash_pickup', 'card', 'crypto'];

            for (const type of defaultChannelTypes) {
                const defaultChannel = withdrawal[type].find(detail => detail.default);
                if (defaultChannel) {
                    return {
                        status: true,
                        channelType: type,
                        channelDetails: defaultChannel,
                        country: withdrawal.country,
                        withdrawalId: withdrawal._id
                    };
                }
            }
        }

        return { status: false, message: "No default payout channel found." };
    } catch (err) {
        console.error('Error in findDefaultPayoutChannel:', err);
        return { status: false, message: "Something went wrong while finding default payout channel." };
    }
}

async function fetchWithdrawalsCounties(accountId) {
    try {
        const withdrawals = await UserWithdrawalModel.find({ account: accountId }).populate("country");

        const countries = new Set()

        withdrawals.forEach((withdrawal) => {
            if (withdrawal?.country) {
                countries.add(withdrawal.country)
            }
        })

        return {
            status: true,
            countries: Array.from(countries)
        }
    } catch (err) {
        console.log(err)
        return { status: false, message: "Something went wrong while fetching withdrawals countries." }
    }
}

async function userKYCVerificationTemplate(data, recipientId, selectedLanguage) {
    const templatePayload = {
        template_type: "generic",
        elements: [
            {

                title: 'Please verify your identity to make an international transfer.',
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].VERIFY,
                        payload: "kyc_verification",
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

    await sendTemplate(data, recipientId, templatePayload, "4")
}

async function processIntlProceedTransfer(data, instaChatbot, account, countryISO, context, selectedLanguage) {
    const beneficiaries = await Beneficiary.find({ account: account?._id });
    let filteredBeneficiaries;

    if (instaChatbot.intl_payout_method === "1") {
        filteredBeneficiaries = beneficiaries?.filter(beneficiary => beneficiary.account_type.includes('mobile') && beneficiary.country_iso_code?.toLowerCase() === countryISO.toLowerCase());
    } else if (instaChatbot.intl_payout_method === "2") {
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
            payload: `${context}_select_benef_${beneficiary._id}`
        }));

        const message = lang[selectedLanguage].SELECT_BENEFICIARY;

        const quickReplies = [
            ...beneficiaryList,
            { content_type: "text", title: lang[selectedLanguage].ADD_BENEFICIARY, payload: `add_beneficiary` },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` }
        ];

        // Check if there are more beneficiaries available for "Next" quick reply
        if (filteredBeneficiaries.length > endIndex) {
            quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].NEXT_BUTTON_TITLE, payload: `${context}_next_beneficiaries_${currentPage + 1}` });
        }

        // Check if "Prev" quick reply should be shown
        if (currentPage > 1) {
            quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, payload: `${context}_prev_beneficiaries_${currentPage - 1}` });
        }
        instaChatbot.intl_beneficiaries = filteredBeneficiaries;
        await instaChatbot.save();
        await quickReply(data, message, quickReplies, "4");
    } else {
        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].ADD_NEW, payload: `add_beneficiary` },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU_MESSAGE, payload: `main_menu` }
        ];
        await quickReply(data, lang[selectedLanguage].NO_BENEFICIARIES, quickReplies, "4");
    }
}

const fetchCountriesFromThunes = async () => {
    const API_URL = `${sandboxUrl}/v2/money-transfer/countries`;
    // const API_URL = `${productionUrl}/v2/money-transfer/countries`;
    const perPage = 270;

    const config = {
        headers: {
            'Authorization': authHeadersThunes,
        },
        params: {
            per_page: perPage,
        },
    };

    try {
        const response = await axios.get(API_URL, config);
        // console.log(response, "respons")

        const countries = response.data;
        return countries;
    } catch (error) {
        console.error('Error fetching countries from Thunes API:', error);
        throw error;
    }
};

async function getAvailableCountries(userInput, lang) {
    const list1 = await Country.find({ status: "active", receivingActive: true }, 'country_iso_code country_name -_id');
    const list2 = await fetchCountriesFromThunes();
    let combinedResults = [];

    try {
        // load the language-specific country file
        const langFilePath = path.join(__dirname, `../utils/languages/countries/${lang}.json`);
        const langJsonData = await fs.readFile(langFilePath, 'utf-8');
        const langCountries = JSON.parse(langJsonData);

        const normalizedInput = userInput.toLowerCase();

        // first filter matches from the language file
        const langMatches = langCountries.filter(country =>
            country.name.toLowerCase().includes(normalizedInput)
        );

        // check if the matched countries' ISO codes exist in both list1 and list2
        const validLangMatches = langMatches.filter(country => {
            const isoCode = country.alpha3;
            return list1.some(c => c.country_iso_code === isoCode) &&
                list2.some(c => c.iso_code === isoCode);
        });

        if (validLangMatches.length > 0) {
            return validLangMatches.map(matchedCountry => ({
                country_name: matchedCountry.name,
                country_iso_code: matchedCountry.alpha3
            }));
        }

        // if not found in language fies, filter matches in list1 and list2
        const list1Matches = list1.filter(country =>
            country.country_name.toLowerCase().includes(normalizedInput)
        );
        const list2Matches = list2.filter(country =>
            country.name.toLowerCase().includes(normalizedInput)
        );

        // combine results from both lists
        list1Matches.forEach(countryInList1 => {
            const correspondingCountryInList2 = list2.find(country =>
                country.iso_code === countryInList1.country_iso_code
            );
            if (correspondingCountryInList2 && !combinedResults.some(c => c.country_iso_code === countryInList1.country_iso_code)) {
                combinedResults.push({
                    country_name: countryInList1.country_name,
                    country_iso_code: countryInList1.country_iso_code
                });
            }
        });

        list2Matches.forEach(countryInList2 => {
            const correspondingCountryInList1 = list1.find(country =>
                country.country_iso_code === countryInList2.iso_code
            );
            if (correspondingCountryInList1 && !combinedResults.some(c => c.country_iso_code === countryInList2.iso_code)) {
                combinedResults.push({
                    country_name: countryInList2.name,
                    country_iso_code: countryInList2.iso_code
                });
            }
        });

        // fuzzy matching if no exact matches are found
        if (combinedResults.length === 0) {
            const fuse = new Fuse(langCountries.concat(list1, list2), {
                keys: ['name', 'country_name'],
                threshold: 0.4
            });

            const fuzzyResults = fuse.search(userInput);

            fuzzyResults.forEach(({ item }) => {
                const isoCode = item.alpha3 || item.iso_code || item.country_iso_code;

                // after fuzzy matching also search if the ISO code exists in both list1 and list2
                const existsInList1 = list1.some(country => country.country_iso_code === isoCode);
                const existsInList2 = list2.some(country => country.iso_code === isoCode);

                if (existsInList1 && existsInList2 && !combinedResults.some(c => c.country_iso_code === isoCode)) {
                    combinedResults.push({
                        country_name: item.name || item.country_name,
                        country_iso_code: isoCode
                    });
                }
            });
        }

    } catch (error) {
        console.error(`Error reading ${lang}.json file:`, error);
    }

    return combinedResults.length > 0 ? combinedResults : null;
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

// (async () => {
//     console.log(await getAvailableCountries("پاکستانی", "ur"));
//     console.log(await getAvailableCountries("Conakry", "fr"));
// })();

function formatDateToDDMMYYYY(dateString) {
    // Create a new Date object from the ISO string
    const date = new Date(dateString);

    // Extract day, month, year, hour, and minute
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');

    // Determine AM/PM
    const ampm = hours >= 12 ? 'PM' : 'AM';

    // Convert hours to 12-hour format
    hours = hours % 12 || 12; // Converts 0 to 12 for midnight

    // Return formatted date in DD/MM/YYYY, HH:MM AM/PM format
    return `${day}/${month}/${year}, ${hours}:${minutes} ${ampm}`;
}

// Function to find country by code
function getCountryNameByCode(code) {
    const country = countries.find(country => country.code === code);
    return country ? country.name : "Country not found";
}

async function balanceLimitCheck(amount, userData, wallet) {
    try {
        console.log({ amount, userData, wallet })
        let userWallets = await WalletModel.find({ $and: [{ account: userData._id }, { wallet_type: "insta" }] });
        console.log(userData._id)
        console.log({ userWallets })
        let arrayOfPromises = [];
        userWallets.map(async (al) => {
            console.log({ code: al.currency.code.toUpperCase(), balance: al.balance.available })
            arrayOfPromises.push(getExchangeRatesToUSD(al.currency.code.toUpperCase(), 'USD', al.balance.available))
        })
        let response = await Promise.all(arrayOfPromises)
        console.log({ response })
        let totalBalanceInUsd = 0;
        await response.map(al => totalBalanceInUsd += al)
        console.log({ totalBalanceInUsd })
        let balanceLimit = userData.level.account_balance_limit
        console.log({ balanceLimit })
        if (userData.is_external_limit) {
            balanceLimit = userData.external_limits.account_balance_limit;
        }
        const usdFx = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(wallet.currency.code, 'USD', 1), 6);
        console.log({ balanceLimit, totalBalanceInUsd, amount, new: formatDecimalNumbersWithLimit(amount * usdFx) })

        if (balanceLimit >= totalBalanceInUsd + formatDecimalNumbersWithLimit(amount * usdFx)) {
            return { status: true };
        } else {
            const convertedLimitInReceivingWallet = formatDecimalNumbersWithLimit((balanceLimit - totalBalanceInUsd) / usdFx)
            return { status: false, totalBalanceInUsd, balanceLimit, remainingBalance: convertedLimitInReceivingWallet };
        }
    } catch (err) {
        console.log(err)
        return false;
    }
}

function generateRatingStars(rating) {
    const glowStar = '🌟';
    const grayStar = '★';

    const glowCount = Math.min(rating, 5)
    const grayCount = Math.max(5 - glowCount, 0)

    const glowingStars = glowStar.repeat(glowCount);
    const grayStars = grayStar.repeat(grayCount)

    const ratingStars = glowingStars + grayStars;

    return ratingStars;
}

function generateToken(senderId, instaChatbotId) {
    const payload = {
        senderId: senderId,
        instaChatbotId: instaChatbotId
    };
    const token = jwt.sign(payload, secretKey, { expiresIn: 30 * 600 });
    return token;
}

async function somethingWentWrongQuickReply(data, message) {
    await quickReply(data, message, [{ content_type: "text", title: "Main Menu", payload: "main_menu" }], "4");
}

async function paymentErrorMessage(selectedLanguage, data) {
    const quickReplies = [
        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
    ];

    const message = lang[selectedLanguage].PAYMENT_ISSUE_MESSAGE
    await quickReply(data, message, quickReplies, "4");
}

function createWithdrawalDataObject(amount, service_id, payer_id, iso_code, walletDetails) {
    let channel_name, service_name;

    switch (service_id) {
        case "1":
            channel_name = "mobile_money";
            service_name = "withdrawal_mobile_wallet";
            break;
        case "2":
            channel_name = "bank_account";
            service_name = "withdrawal_bank_transfer";
            break;
        case "3":
            channel_name = "cash_pickup";
            service_name = "withdrawal_cash_pickup";
            break;
        default:
            channel_name = "card_payment";
            service_name = "withdrawal_card_payment";
    }

    return {
        wallet_id: walletDetails._id,
        channel_name,
        service_name,
        amount: amount,
        transaction_type: "C2C",
        service_id: service_id,
        iso_code,
        currency_code: walletDetails.currency.code,
        payerId: parseInt(payer_id, 10),
    };
}

function validateAmount(text, selectedLanguage) {
    const digitRegex = /^\d+(\.\d+)?$/;
    const isNumber = digitRegex.test(text);
    const amount = formatDecimalNumbersWithLimit(parseFloat(text));

    if (!isNumber) {
        return { status: false, message: lang[selectedLanguage].ENTER_AMOUNT_DIGITS };
    }

    if (amount < 0.1) {
        return { status: false, message: lang[selectedLanguage].MINIMUM_AMOUNT };
    }

    return { status: true, amount };
}
// function for the numbers starting from 1 or +1, handled individually because multiple countries contain +1 as country code
const areaCodeMapping = {
    US: {
        countryName: "United States",
        isoCode: "USA",
        areaCodes: [
            "201", "202", "203", "205", "206", "207", "208", "209", "210", "212", "213", "214", "215", "216", "217",
            "218", "219", "220", "224", "225", "228", "229", "231", "234", "239", "240", "248", "251", "252", "253",
            "254", "256", "260", "262", "267", "269", "270", "272", "274", "276", "278", "281", "283", "301", "302",
            "303", "304", "305", "307", "308", "309", "310", "312", "313", "314", "315", "316", "317", "318", "319",
            "320", "321", "323", "325", "326", "330", "331", "332", "334", "336", "337", "339", "341", "346", "347",
            "351", "352", "360", "361", "364", "369", "380", "385", "386", "401", "402", "404", "405", "406", "407",
            "408", "409", "410", "412", "413", "414", "415", "417", "419", "423", "424", "425", "430", "432", "434",
            "435", "440", "442", "443", "447", "458", "463", "464", "469", "470", "475", "478", "479", "480", "484",
            "501", "502", "503", "504", "505", "507", "508", "509", "510", "512", "513", "515", "516", "518", "520",
            "530", "531", "534", "539", "540", "541", "551", "559", "561", "562", "563", "564", "567", "570", "571",
            "573", "574", "575", "580", "585", "586", "601", "602", "603", "605", "606", "607", "608", "609", "610",
            "612", "614", "615", "616", "617", "618", "619", "620", "623", "626", "628", "629", "630", "631", "636",
            "646", "650", "651", "657", "660", "661", "662", "667", "669", "678", "681", "682", "689", "701", "702",
            "703", "704", "706", "707", "708", "712", "713", "714", "715", "716", "717", "718", "719", "720", "724",
            "725", "727", "731", "732", "734", "737", "740", "743", "747", "754", "757", "760", "762", "763", "765",
            "769", "770", "772", "773", "774", "775", "779", "781", "785", "786", "801", "802", "803", "804", "805",
            "806", "808", "810", "812", "813", "814", "815", "816", "817", "818", "828", "830", "831", "832", "835",
            "843", "845", "847", "848", "850", "854", "856", "857", "858", "859", "860", "862", "863", "864", "865",
            "870", "872", "878", "901", "903", "904", "906", "907", "908", "909", "910", "912", "913", "914", "915",
            "916", "917", "918", "919", "920", "925", "928", "929", "930", "931", "935", "936", "937", "938", "940",
            "941", "945", "947", "949", "951", "952", "954", "956", "959", "970", "971", "972", "973", "978", "979",
            "980", "984", "985", "986", "989"
        ]
    },
    CA: {
        countryName: "Canada",
        isoCode: "CAN",
        areaCodes: [
            "204", "226", "236", "249", "250", "289", "306", "343", "354", "365", "387", "403", "416", "418", "431",
            "437", "438", "450", "506", "514", "519", "548", "579", "581", "587", "604", "613", "639", "647", "672",
            "705", "709", "742", "778", "782", "807", "819", "825", "867", "873", "902", "905", "983"
        ]
    },
    Caribbean: {
        "242": { countryName: "Bahamas", isoCode: "BHS" },
        "246": { countryName: "Barbados", isoCode: "BRB" },
        "264": { countryName: "Anguilla", isoCode: "AIA" },
        "268": { countryName: "Antigua and Barbuda", isoCode: "ATG" },
        "284": { countryName: "British Virgin Islands", isoCode: "VGB" },
        "340": { countryName: "US Virgin Islands", isoCode: "VIR" },
        "345": { countryName: "Cayman Islands", isoCode: "CYM" },
        "441": { countryName: "Bermuda", isoCode: "BMU" },
        "473": { countryName: "Grenada", isoCode: "GRD" },
        "649": { countryName: "Turks and Caicos Islands", isoCode: "TCA" },
        "664": { countryName: "Montserrat", isoCode: "MSR" },
        "758": { countryName: "Saint Lucia", isoCode: "LCA" },
        "767": { countryName: "Dominica", isoCode: "DMA" },
        "784": { countryName: "Saint Vincent and the Grenadines", isoCode: "VCT" },
        "809": { countryName: "Dominican Republic", isoCode: "DOM" },
        "829": { countryName: "Dominican Republic", isoCode: "DOM" },
        "849": { countryName: "Dominican Republic", isoCode: "DOM" },
        "868": { countryName: "Trinidad and Tobago", isoCode: "TTO" },
        "869": { countryName: "Saint Kitts and Nevis", isoCode: "KNA" },
        "876": { countryName: "Jamaica", isoCode: "JAM" },
        "939": { countryName: "Puerto Rico", isoCode: "PRI" }
    }

};

// Function to identify the country from the phone number
function identifyCountry(phoneNumber) {
    // Remove non-digit characters and leading + sign
    const cleanedNumber = phoneNumber.replace(/\D/g, '');

    // Check if the number starts with 1 (NANP country code)
    if (!cleanedNumber.startsWith("1")) {
        return null;  // Invalid phone number for NANP
    }

    // Extract the area code (first 3 digits after the country code)
    const areaCode = cleanedNumber.substring(1, 4);

    // Check for a match in the United States area codes
    if (areaCodeMapping.US.areaCodes.includes(areaCode)) {
        return {
            countryName: areaCodeMapping.US.countryName,
            isoCode: areaCodeMapping.US.isoCode
        };
    }

    // Check for a match in the Canada area codes
    if (areaCodeMapping.CA.areaCodes.includes(areaCode)) {
        return {
            countryName: areaCodeMapping.CA.countryName,
            isoCode: areaCodeMapping.CA.isoCode
        };
    }

    // Check for a match in the Caribbean area codes
    if (areaCodeMapping.Caribbean[areaCode]) {
        return {
            countryName: areaCodeMapping.Caribbean[areaCode].countryName,
            isoCode: areaCodeMapping.Caribbean[areaCode].isoCode
        };
    }

    return null;  // Area code not recognized within the NANP
}


function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hash the OTP
function hashOTP(otp) {
    return crypto.createHash('sha256').update(otp).digest('hex');
}

// Validate the OTP
async function validateOTP(storedHash, userInputOTP) {
    console.log(`Stored hash: ${storedHash}, User input: ${userInputOTP}`);
    const hashedInput = hashOTP(userInputOTP);
    return storedHash === hashedInput;
}

// generate 12 digits password
function generateTempPassword(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*=';
    let password = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        password += chars[randomIndex];
    }

    // Truncate any spaces that might have accidentally been included
    password = password.replace(/\s/g, '');

    // If the password ends up shorter than the desired length, regenerate missing characters
    while (password.length < length) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        password += chars[randomIndex];
    }

    return password;
}

// Function to search for the closest matching city
function searchCity(cityName, countryIso3) {
    const countryData = citiesData.find(country => country.iso3 === countryIso3);
    if (!countryData) return { exactMatch: null, suggestions: [] };

    const cities = countryData.cities.map(city => city.name.toLowerCase());

    const options = {
        includeScore: true,
        threshold: 0.3, // threshold for matching
        keys: ['name']
    };

    const fuse = new Fuse(cities, options);

    const result = fuse.search(cityName.toLowerCase());
    const exactMatch = cities.includes(cityName.toLowerCase()) ? cityName : null;
    const suggestions = result.map(res => res.item).slice(0, 10); // Limit to top 10 suggestions

    return { exactMatch, suggestions };
};

async function createNewUserAfterVerification(data) {
    try {
        const {
            phone, first_name, last_name, password,
            country_iso_code, country_name, country, chatId, username, dob
        } = data;

        console.log(data, "data")
        let createAccountObj = {
            first_name,
            last_name,
            password,
            // isTempPassword: true,
            phone,
            account_type: 'individual',
            is_external_limit: false,
            purpose: "",
            sms_verification: true,
            active: true,
            status: 'active',
            country_name,
            country_iso_code,
            country,
            source: 'chatbot',
            telegram_bot: true,
            telegram_id: chatId,
            telegram_username: username,
            dob
        };

        // if (email) {
        //     createAccountObj['email'] = email.toLowerCase();
        // }

        let categoryDetails = await Category.findOne({
            business_type: 'individual_accounts',
            account_type: 'individual'
        }, { business_type: true });

        let countryDetails = await Country.findOne({
            country_iso_code,
            status: 'active',
            individual_registration_active: true
        }, { country_name: true, country_iso_code: true });

        if (!categoryDetails || !countryDetails) {
            return {
                status: false,
                message: "Account registration failed!",
            };
        }

        let level = await AccountLevelModel.findOne({
            country: countryDetails._id,
            category: categoryDetails._id,
            level_no: 1,
            account_type: 'individual'
        }, { account_type: true });

        if (!level) {
            return {
                status: false,
                message: "Account registration failed!",
            };
        }

        createAccountObj['level'] = level._id;
        createAccountObj['category'] = categoryDetails._id;

        let accData = await AccountModel.create(createAccountObj);

        let userData = await UserModel.create({
            first_name,
            last_name,
            account: accData._id
        });

        let accountData = await AccountModel.findByIdAndUpdate(
            accData._id,
            { user: userData._id },
            { new: true }
        );

        const createdWallet = await createWallet(accData._id, countryDetails)

        return {
            status: true,
            message: "Account has been registered!",
            accountData
        };
    } catch (err) {
        console.error(err);
        return {
            status: false,
            message: "Account registration failed!",
            error: err.message
        };
    }
}

async function createWallet(account_id, country) {
    let currentArr = [{ code: 'BTC', symbol: '₿' }, { code: 'USDT', symbol: '₮' }, { code: 'ETH', symbol: 'Ξ' }]
    let currency = countryCurrencyJson.find(cc => cc.country_code.toLowerCase() == country.country_iso_code.toLowerCase())
    if (currency) {
        currentArr.push({ code: currency.currency_code, symbol: currency.currency_symbol })
    }
    let walletArr = [];
    let obj = {
        wallet_type: 'crypto',
        status: 'active',
        limit_used: 0,
        balance: {
            available: 0,
            pending: 0,
            total: 0,
        },
        account: account_id
    }
    await currentArr.map((cl, i) => {
        obj['default'] = false;
        if (i > 2) {
            obj['wallet_type'] = 'insta';
            obj['default'] = true;
        }
        obj['currency'] = cl;
        walletArr.push({ ...obj })
    })
    WalletModel.insertMany(walletArr).then(async (walletList) => {
        // console.log(walletList);
        walletList.map(async (l, i) => {
            let hashids = new Hashids(i.toString() + l._id.toString(), 8, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890');
            let id = hashids.encode(1, 2, 3)
            console.log(id.toString());
            let updt = await WalletModel.updateOne({ _id: l._id }, { $set: { wallet_id: id.toString() } })
            // console.log(updt);
        })
    }).catch(err => {
        console.log(err);
    })
    // Wallet.find().then(async (walletList) => {
    //     console.log(walletList);
    //     walletList.map(async (l, i) => {
    //         let hashids = new Hashids(i.toString() + l._id.toString(), 8, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890');
    //         let id = await hashids.encode(1, 2, 3)
    //         console.log(id.toString());
    //         let updt = await Wallet.updateOne({ _id: l._id }, { $set: { wallet_id: id.toString() } })
    //     })
    // }).catch(err => {
    //     console.log(err);
    // })
}

function isTimeDifferenceGreaterThan30Minutes(givenTime) {
    const givenDateTime = new Date(givenTime);

    const currentTime = new Date();

    const timeDifferenceMs = currentTime - givenDateTime;

    const timeDifferenceMinutes = timeDifferenceMs / (1000 * 60);

    console.log(timeDifferenceMinutes, "timeDifferenceMinutes")

    return timeDifferenceMinutes > 30;
}

function formatCurrency(currency) {
    return currency.symbol;
}

function formatDate(date) {
    return moment(date).format('M/D/YYYY h:mm:ss A');
}

function formatAmount(amount, currency, transactionType) {
    const sign = transactionType === 'credit' ? '+' : '-';

    return `${sign}${formatCurrency(currency)}${Math.abs(amount).toFixed(2)} `;
}
function formatPaymentType(payment_type, selectedLanguage) {
    let paymentTypeText = '';
    if (payment_type === 'payment_request') {
        paymentTypeText = 'Payment Request';
    } else if (payment_type === 'quotation') {
        paymentTypeText = 'Quotation';
    } else if (payment_type === 'payment_address') {
        paymentTypeText = 'Payment Address';
    } else if (payment_type === 'qr_pay') {
        paymentTypeText = 'QR Payment';
    } else if (payment_type.includes('bank')) {
        paymentTypeText = 'Bank Transfer';
    } else if (payment_type.includes('mobile')) {
        paymentTypeText = 'Mobile Money';
    } else if (payment_type === "airtime") {
        paymentTypeText = 'Airtime';
    }
    else {
        paymentTypeText = lang[selectedLanguage].WALLET_TO_WALLET_BUTTON_TITLE;
    }
    return paymentTypeText;
}


async function createTransactionInfo(transaction, selectedLanguage) {
    console.log(transaction, "transactionin", selectedLanguage);
    const { sender, receiver, amount, total, fee, createdAt, transaction_type, payment_type, service_type, airtime_number, reference_id, currency, wallet_id, beneficiary } = transaction;
    const formattedDate = formatDate(createdAt);
    const formattedAmount = formatAmount(total, currency, transaction_type);
    const paymentTypeText = formatPaymentType(payment_type, selectedLanguage);
    const formattedFee = formatAmount(fee, currency, transaction_type);

    let partyName;

    if (service_type === "airtime") {
        partyName = airtime_number || "N/A";
    } else if (transaction_type === 'debit') {
        if (service_type === "withdraw_by_admin") {
            partyName = "Admin";
        } else if (service_type === "kyc_verification") {
            partyName = "InstaPay";
        } else if (service_type === "withdrawal") {
            partyName = `${sender?.first_name} ${sender?.last_name}`;
        } else if (receiver) {
            partyName = `${receiver?.first_name} ${receiver?.last_name}`;
        } else if (beneficiary) {
            console.log(beneficiary, "beneficiarycheck")
            const internationalReceiver = await Beneficiary.findById(beneficiary);
            if (internationalReceiver) {
                partyName = `${internationalReceiver.first_name} ${internationalReceiver.last_name}`;
            } else {
                partyName = "N/A";
            }
        } else {
            partyName = "N/A";
        }
    } else if (service_type === "topup") {
        if (receiver) {
            partyName = `${receiver?.first_name} ${receiver?.last_name}`;
        } else {
            partyName = "N/A";
        }
    } else {
        partyName = `${sender?.first_name} ${sender?.last_name}`;
    }

    const transactionType = transaction_type === 'debit' ? lang[selectedLanguage].Debit : lang[selectedLanguage].Credit

    let transactionInfoText = `${new Date(createdAt).toLocaleString()}\n${lang[selectedLanguage].AMOUNT}: ${formattedAmount}\n${transaction_type === 'debit' ? `${lang[selectedLanguage].FEE}: ${formattedFee}\n` : ""}${lang[selectedLanguage].TYPE}: ${transactionType}\n${paymentTypeText}\n`;

    if (transaction_type === 'debit') {
        transactionInfoText += `${lang[selectedLanguage].RECEIVER_NAME} ${partyName}\n${lang[selectedLanguage].TRANSACTION_ID} ${reference_id}\n`;
    } else {
        transactionInfoText += `${lang[selectedLanguage].SENDER_NAME} ${partyName}\n${lang[selectedLanguage].TRANSACTION_ID} ${reference_id}\n`;
    }

    return transactionInfoText;
}

module.exports = {
    quickReply,
    quickMessage,
    sendTemplate,
    sendVideoImage,
    userInstaInfo,
    generateToken,
    mainMenuMessage,
    getDistinctObjects,
    searchUsersAndWallets,
    userLimitsMessage,
    usersFeatureMessage,
    validateAttachments,
    findDefaultPayoutChannel,
    fetchWithdrawalsCounties,
    userKYCVerificationTemplate,
    processIntlProceedTransfer,
    getAvailableCountries,
    fetchCountriesFromThunes,
    formatDateToDDMMYYYY,
    getCountryNameByCode,
    balanceLimitCheck,
    w2wPaymentMethodsTemplateCard,
    generateToken,
    somethingWentWrongQuickReply,
    w2wPaymentMethodsTemplate,
    paymentErrorMessage,
    createWithdrawalDataObject,
    validateAmount,
    generateOTP,
    validateOTP,
    hashOTP,
    generateTempPassword,
    identifyCountry,
    createNewUserAfterVerification,
    searchCity,
    isTimeDifferenceGreaterThan30Minutes,
    getPayoutChannelName,
    generateRatingStars,
    createTransactionInfo,
    formatDate
}