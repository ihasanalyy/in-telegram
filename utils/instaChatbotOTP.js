const jwt = require('jsonwebtoken');

const AccountModel = require("../models/Account.model");
const InstaChatbot = require("../models/InstaChatbot.model");

const AuthSecretModel = require('../models/Auth-Secret.model');
const OTPAuth = require("otpauth");

const { sendVideoImage, quickReply, quickMessage } = require("./instaChatbotUtils");
// const { sendMailsHelper } = require("./helpers");
const { sendMailsExport } = require("./sendEmail");
const lang = require('../utils/languages/languages.json');
const templates = require('../utils/emailTemplateIDs.json');
const { verifyTOTP } = require('../controllers/Account.controller');
const { sendWhatsAppMessage } = require('./helpers');

const accountSid = `${process.env.TWILIO_ACCOUNT_SID}`;//'ACd27647d39bbcec466a22096459a14297'
const authToken = `${process.env.TWILIO_AUTH_TOKEN}`;//'932acb397d9d66f41d076f5a2b873143'

const client = require('twilio')(accountSid, authToken);
const secretKey = "insta_chat_bot_token_key"

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendSMSTemplate(to, message) {

    try {
        to.replace('+', '')
        to = '+' + to;
        let obj = {
            body: message,
            messagingServiceSid: process.env.TWILIO_SERVICE_ID,
            to: to
        }
        // console.log(obj);
        let send = await client.messages.create(obj)
        console.log('SMS sent successfully');
        return true;
    } catch (error) {
        console.error(error.toString());
        return false;
    }
}

function getTemplateId(language, name) {
    const languageTemplates = templates[language]
    if (languageTemplates && languageTemplates[name]) {
        return languageTemplates[name]
    } else {
        const englishTemplates = templates['english']
        if (englishTemplates && englishTemplates[name]) {
            return englishTemplates[name]
        } else {
            return null
        }
    }
}

function generateOTPToken(userId, context) {
    const otp = generateOTP();
    const expiry = Math.floor(Date.now() / 1000) + (5 * 60); // 5 minutes expiry

    const token = jwt.sign({ userId, otp, context, exp: expiry }, secretKey);
    return { otp, token };
}

function validateOTPToken(token, otp, context) {
    try {
        const decoded = jwt.verify(token, secretKey);
        console.log(decoded, otp, context);
        if (decoded.otp === otp && decoded.context === context) {
            return true;
        } else {
            return false;
        }
    } catch (err) {
        return false;
    }
}



async function handleOTPGeneration(selectedLang, userId, context, lastMessage, templateName, viaSms) {
    // const otp = generateOTP();

    let otpType = 'email_sms';
    const user = await AccountModel.findOne({ insta_subscriber_id: userId });
    console.log(user, "user")
    if (viaSms || !user?.tfa) {
        const { otp, token } = generateOTPToken(userId, context);

        console.log(otp, "otp")

        let updateData = { otpToken: token, otpAttemptCount: 0, otpType: otpType };
        if (lastMessage) {
            updateData.last_message = lastMessage;
        }
        const instaChatBot = await InstaChatbot.findOneAndUpdate({ recipient: userId }, updateData);
        const account = await AccountModel.findOne({ $or: [{ insta_recipient_id: instaChatBot._id }, { username: instaChatBot.username }] })

        const phoneCheck = account.sms_verification;
        const emailCheck = account.email_verification;

        let emailSend = false;
        let phoneSend = false;

        if (emailCheck) {
            const language = 'english';
            const template_name = templateName;

            const templateId = getTemplateId(language, template_name);

            // const check = await sendMailsHelper(account.email, `Hi ${account.username},\n\nThis is your instapay transaction OTP: ${otp}`, "Transaction Verification");
            const check = await sendMailsExport(account?.email, `Hi ${account?.username || instaChatBot?.username},\n\nThis is your InstaPay transaction OTP: ${otp}`, "Transaction Verification", templateId, { otp })
            if (check) { emailSend = true; } else { emailSend = false; }
        }

        if (phoneCheck) {
            let check;
            if (account.country_iso_code === "ARE") {
                check = await sendWhatsAppMessage(account.phone, otp);
            } else {
                check = await sendSMSTemplate(account.phone, lang[selectedLang].INSTA_PAY_OTP.replace('{{OTP}}', otp));
            }
            phoneSend = check ? true : false;
        }

        await sendVideoImage("https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/otp.jpeg", userId, "image");

        let message

        if (emailCheck && !phoneSend) {
            message = lang[selectedLang].ENTER_CODE_SENT_EMAIL;
        }
        else if (!emailCheck && phoneSend) {
            message = lang[selectedLang].ENTER_CODE_SENT_NUMBER;
        } else {
            message = lang[selectedLang].ENTER_CODE_SENT_NUMBER_EMAIL;
        }

        const quickReplies = [
            { content_type: "text", title: lang[selectedLang].RESEND_OTP, payload: `resend_otp_${context}` },
            { content_type: "text", title: lang[selectedLang].ASSISTANCE_REQUIRED, payload: "assistance" },
            { content_type: "text", title: lang[selectedLang].CANCEL, payload: `cancel_${context}` },
            { content_type: "text", title: lang[selectedLang].MAIN_MENU, payload: "main_menu" }
        ];

        await quickReply({ sender: { id: userId } }, message, quickReplies);
    } else {
        otpType = 'authenticator';
        const instaChatBot = await InstaChatbot.findOneAndUpdate({ recipient: userId }, { otpType: otpType, last_message: lastMessage });
        await sendVideoImage("https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/otp.jpeg", userId, "image");

        const quickReplies = [
            { content_type: "text", title: lang[selectedLang].SEND_VIA_SMS_EMAIL, payload: `send_code_via_sms` },
            { content_type: "text", title: lang[selectedLang].ASSISTANCE_REQUIRED, payload: "assistance" },
            { content_type: "text", title: lang[selectedLang].CANCEL, payload: `cancel_${context}` },
            { content_type: "text", title: lang[selectedLang].MAIN_MENU, payload: "main_menu" }
        ];

        await quickReply({ sender: { id: userId } }, lang[selectedLang].ENTER_AUTH_CODE, quickReplies);
    }
}

// async function validateOTP(userId, enteredOTP) {
//     const user = await InstaChatbot.findOne({ recipient: userId });
//     console.log(user, enteredOTP, user.otp, user.otpExpiry, user.otpExpiry > Date.now());
//     if (user && user.otp === enteredOTP && user.otpExpiry > Date.now()) {
//         user.otp = null;
//         user.otpExpiry = null;
//         await user.save();
//         return true;
//     }
//     return false;
// }

async function maximumAttemptsExceeded(userId) {
    const instaChatbot = await InstaChatbot.findOne({ recipient: userId });
    const account = await AccountModel.findOne({ insta_recipient_id: instaChatbot._id })

    account.active = false;
    await account.save();
}

async function validateOTP(userId, enteredOTP, context) {
    const instaChatBot = await InstaChatbot.findOne({ recipient: userId });
    console.log(instaChatBot.otpType, "instaChatBot.otpType")
    if (instaChatBot.otpType === 'email_sms') {
        // if max attempts reached of otp entered
        if (instaChatBot.otpAttemptCount >= 3) {
            await maximumAttemptsExceeded(userId);
            return { status: false, message: "max_attempts_exceeded" };
        }

        try {
            const decoded = jwt.verify(instaChatBot.otpToken, secretKey);
            if (decoded.otp === enteredOTP && decoded.context === context) {
                instaChatBot.otpAttemptCount = 0; // Reset attempt count on successful otp
                await instaChatBot.save();
                return { status: true, message: "otp_valid" };
            } else {
                instaChatBot.otpAttemptCount += 1; // Increment attempt count on failure
                await instaChatBot.save();
                return { status: false, message: "invalid_otp" };
            }
        } catch (error) {
            instaChatBot.otpAttemptCount += 1; // Increment attempt count on some error
            await instaChatBot.save();
            console.error('OTP validation error:', error);
            return { status: false, message: "invalid_otp" };
        }
    }
    // else check for authenticator
    else {
        const accountDetails = await AccountModel.findOne({ insta_recipient_id: instaChatBot._id });
        const authSecretDetails = await AuthSecretModel.findOne({ account: accountDetails._id })
        console.log("accountDetails", authSecretDetails)

        const secret = authSecretDetails.value;
        const userProvidedToken = enteredOTP;
        const isValid = await verifyTOTP(userProvidedToken, secret);

        console.log(isValid, "isValid")

        // let label = '';
        // if (accountDetails.account_type == 'individual') { label = accountDetails.phone }
        // if (accountDetails.account_type == 'business') { label = accountDetails.email }

        // let totp = new OTPAuth.TOTP({
        //     issuer: "InstaPay",
        //     label: label,
        //     algorithm: "SHA1",
        //     digits: 6,
        //     secret: authSecretDetails.value,
        // });
        // console.log(totp, "totp", authSecretDetails)

        // let delta = totp.validate({ token: enteredOTP });
        // console.log(delta, "delta", enteredOTP)

        if (isValid) {
            return { status: true, message: "otp_valid" };
        } else {
            return { status: false, message: "invalid_otp" };
        }
    }
}

async function invalidMessage(sender, context, selectedLanguage, otpType) {
    console.log(otpType === 'email_sms', otpType, "otpType")
    const message = lang[selectedLanguage].INVALID_OTP;


    let quickReplies = [
        { content_type: "text", title: lang[selectedLanguage].ASSISTANCE_REQUIRED, payload: "assistance" },
        { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: `cancel_${context}` },
        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "main_menu" }
    ];

    if (otpType === 'email_sms') {
        quickReplies.unshift({ content_type: "text", title: lang[selectedLanguage].RESEND_OTP, payload: `resend_otp_${context}` })
    }

    await quickReply(sender, message, quickReplies);
}


module.exports = { handleOTPGeneration, validateOTP, invalidMessage, sendSMSTemplate, generateOTPToken };