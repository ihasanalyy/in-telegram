const { sendSMSTemplate, generateOTPToken } = require('../instaChatbotOTP');
const AuthSecretModel = require('../../models/Auth-Secret.model');
const { sendMailsExport } = require('../sendEmail');
const { getTemplateId, sendWhatsAppMessage } = require('../helpers');
const Account = require('../../models/Account.model');
const TelegramBotModel = require('../../models/TelegramBot.model');
const lang = require('../../utils/languages/languages.json');
const { sendPhoto, sendButtons } = require('../telegramBotUtils');
const { verifyTOTP } = require('../../controllers/Account.controller');
const jwt = require("jsonwebtoken")

const secretKey = "insta_chat_bot_token_key"
async function handleOTPGenerationTG(selectedLang, chat, context, lastMessage, templateName, viaSms) {
    let otpType = 'email_sms';
    // const user = await Account.findOne({ telegram_id: chat.recipient });

    if (viaSms || !chat.account?.tfa) {
        const { otp, token } = generateOTPToken(chat.recipient, context);

        let updateData = { otpToken: token, otpAttemptCount: 0, otpType: otpType };
        if (lastMessage) {
            updateData.last_message = lastMessage;
        }
        const telegramBot = await TelegramBotModel.findOneAndUpdate({ recipient: chat.recipient }, updateData);
        const phoneCheck = chat.account.sms_verification;
        const emailCheck = chat.account.email_verification;

        let emailSend = false;
        let phoneSend = false;

        if (emailCheck) {
            const language = 'english';
            const template_name = templateName;
            const templateId = getTemplateId(language, template_name);
            const userName = chat.account?.username;

            const emailStatus = await sendMailsExport(chat.account?.email,
                lang[selectedLang].OTP_MESSAGE.replace('{{OTP}}', otp).replace('{{USERNAME}}', userName), //Hassan
                "Transaction Verification",
                templateId,
                { otp });

            emailSend = !!emailStatus;
        }

        if (phoneCheck) {
            // send whatsapp message to the country "ARE"
            const smsStatus = chat.account?.country_iso_code === "ARE"
                ? await sendWhatsAppMessage(chat.account.phone, otp)
                : await sendSMSTemplate(chat.account.phone, lang[selectedLang].INSTA_PAY_OTP.replace('{{OTP}}', otp));

            phoneSend = !!smsStatus;
        }

        console.log({ otp })
        await sendPhoto(chat.recipient, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/otp%20%284%29.png");

        let message;
        if (emailCheck && !phoneSend) {
            message = lang[selectedLang].ENTER_CODE_SENT_EMAIL;
        } else if (!emailCheck && phoneSend) {
            message = lang[selectedLang].ENTER_CODE_SENT_NUMBER;
        } else {
            message = lang[selectedLang].ENTER_CODE_SENT_NUMBER_EMAIL;
        }

        const buttons = [
            [{ text: lang[selectedLang].RESEND_OTP, callback_data: `resend_otp_${context}` }],
            [{ text: lang[selectedLang].ASSISTANCE_REQUIRED, callback_data: "assistance" }],
            [{ text: lang[selectedLang].CANCEL, callback_data: `cancel_${context}` }],
            [{ text: lang[selectedLang].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chat.recipient, message, buttons);
    } else {
        otpType = 'authenticator';
        await TelegramBotModel.findOneAndUpdate({ recipient: chat.recipient }, { otpType: otpType, last_message: lastMessage });

        await sendPhoto(chat.recipient, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/otp%20%284%29.png");

        const buttons = [
            [{ text: lang[selectedLang].SEND_VIA_SMS_EMAIL, callback_data: `send_code_via_sms` }],
            [{ text: lang[selectedLang].ASSISTANCE_REQUIRED, callback_data: "assistance" }],
            [{ text: lang[selectedLang].CANCEL, callback_data: `cancel_${context}` }],
            [{ text: lang[selectedLang].MAIN_MENU, callback_data: "main_menu" }]
        ];

        await sendButtons(chat.recipient, lang[selectedLang].ENTER_AUTH_CODE, buttons);
    }
}

async function maximumAttemptsExceeded(userId) {
    const telegramBot = await TelegramBotModel.findOne({ recipient: userId }).populate('account')

    telegramBot.account.active = false;
    await telegramBot.account.save();
}

async function validateOTPTG(userId, enteredOTP, context) {
    const telegramBot = await TelegramBotModel.findOne({ recipient: userId }).populate("account")
    console.log(telegramBot.otpType, "telegramBot.otpType")
    if (telegramBot.otpType === 'email_sms') {
        // if max attempts reached of otp entered
        if (telegramBot.otpAttemptCount >= 3) {
            await maximumAttemptsExceeded(userId);
            return { status: false, message: "max_attempts_exceeded" };
        }

        try {
            const decoded = jwt.verify(telegramBot.otpToken, secretKey);
            if (decoded.otp === enteredOTP && decoded.context === context) {
                telegramBot.otpAttemptCount = 0; // Reset attempt count on successful otp
                await telegramBot.save();
                return { status: true, message: "otp_valid" };
            } else {
                telegramBot.otpAttemptCount += 1; // Increment attempt count on failure
                await telegramBot.save();
                return { status: false, message: "invalid_otp" };
            }
        } catch (error) {
            console.log(error)
            telegramBot.otpAttemptCount += 1; // Increment attempt count on some error
            await telegramBot.save();
            return { status: false, message: "invalid_otp" };
        }
    }
    // else check for authenticator
    else {
        // const accountDetails = await Account.findOne({ insta_recipient_id: telegramBot._id });
        const authSecretDetails = await AuthSecretModel.findOne({ account: telegramBot.account._id })

        const secret = authSecretDetails.value;
        const userProvidedToken = enteredOTP;
        const isValid = await verifyTOTP(userProvidedToken, secret);

        if (isValid) {
            return { status: true, message: "otp_valid" };
        } else {
            return { status: false, message: "invalid_otp" };
        }
    }
}

async function invalidMessageTG(chatId, context, selectedLanguage, otpType) {
    const message = lang[selectedLanguage].INVALID_OTP;

    let buttons = [
        [{ text: lang[selectedLanguage].ASSISTANCE_REQUIRED, callback_data: "assistance" }],
        [{ text: lang[selectedLanguage].CANCEL, callback_data: `cancel_${context}` }],
        [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
    ];

    if (otpType === 'email_sms') {
        buttons.unshift([{ text: lang[selectedLanguage].RESEND_OTP, callback_data: `resend_otp_${context}` }]);
    }

    await sendButtons(chatId, message, buttons);
}


module.exports = {
    handleOTPGenerationTG,
    validateOTPTG,
    invalidMessageTG
}