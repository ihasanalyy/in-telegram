const Account = require('../../../models/Account.model');
// const TelegramBotModel = require('../../../models/Telegramchat.model');
const { sendSMSTemplate, getGmtOffset } = require('../../helpers');
const { numberVerificationAirtime } = require('../../InstaChatbotHelpers');
const { identifyCountry, hashOTP, createNewUserAfterVerification, generateTempPassword, validateOTP, searchCity, generateOTP } = require('../../instaChatbotUtils');
const lang = require('../../languages/languages.json');
const ct = require('countries-and-timezones');
const countriesIso = require("../../countries_iso2.json");
const { sendPhoto, sendButtons, sendMessage, invalidInputResponse, mainMenuKeyboardMessage } = require('../../telegramBotUtils');
const jwt = require('jsonwebtoken');
const CountryModel = require('../../../models/Country.model');

const MAX_ATTEMPTS = 3;
const MAX_TEMP_PASS_ATTEMPTS = 3;
const TIMEZONE_PAGE_SIZE = 8;

async function accountRegisteration(chatId, payload, chat, text, selectedLanguage, data, isRegisteration) {

    if ((payload === "register_cancel" && chat.last_message?.startsWith("register")) || isRegisteration) {

        if (chat?.registeration && Object.keys(chat?.registeration).length > 0) {
            chat.registeration = {}
            await chat.save()
        }
        const buttonText = lang[selectedLanguage].REGISTRATION_CANCELLED;
        const buttons = [
            [{ text: lang[selectedLanguage].CONNECT_BUTTON_TITLE, callback_data: "connect_account" }],
            [{ text: lang[selectedLanguage].REGISTER_BUTTON_TITLE, callback_data: "register" }],
            [{ text: lang[selectedLanguage].CHANGE_LANGUAGE, callback_data: "language_change" }],
        ];
        await sendButtons(chatId, buttonText, buttons, "connect");
    }
    else if (payload === "register_template" && chat.last_message?.startsWith("connect")) {
        if (chat?.registeration && Object.keys(chat?.registeration).length > 0) {
            chat.registeration = {}
            await chat.save()
        }
        const buttons = [
            [{ text: lang[selectedLanguage].CONNECT_BUTTON_TITLE, callback_data: "connect_account" }],
            [{ text: lang[selectedLanguage].REGISTER_BUTTON_TITLE, callback_data: "register" }],
            [{ text: lang[selectedLanguage].CHANGE_LANGUAGE, callback_data: "language_change" }],
        ];
        await sendButtons(chatId, lang[selectedLanguage].START_HELP, buttons);
    }

    else if (payload === "register" && chat.last_message === "connect") {
        const buttonText = lang[selectedLanguage].GREAT_REGISTERING_AS;
        const buttons = [
            [{ text: lang[selectedLanguage].INDIVIDUAL, callback_data: "register_acc_ind" }],
            [{ text: lang[selectedLanguage].BUSINESS, callback_data: "register_acc_bus" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "register_cancel" }],
        ];
        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Select.png");

        await sendButtons(chatId, buttonText, buttons, "register_0");
    } else if ((payload === "register_acc_ind" || payload === "register_acc_ind_edit") && (chat.last_message?.startsWith("register") || chat.last_message === "register_0")) {
        let message;
        if (payload === "register_acc_ind_edit") {
            message = lang[selectedLanguage].ENTER_NEW_FIRST_NAME;
        } else {
            await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/enter-details.png");
            message = `${lang[selectedLanguage].START_GETTING_DETAILS}\n\n${lang[selectedLanguage].ENTER_FIRST_NAME}`;
        }

        const buttons = [
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "register_cancel" }],
        ];

        await sendButtons(chatId, message, buttons, "register_0.1");
    } else if (payload === "register_acc_bus" && chat.last_message === "register_0") {
        const message = lang[selectedLanguage].BUSINESS_REGISTRATION_SOON;
        const buttons = [
            [{ text: lang[selectedLanguage].CONTINUE_INDIVIDUAL_ACCOUNT, callback_data: "register_1" }],
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "register_cancel" }],
        ];
        await sendButtons(chatId, message, buttons);
    }
    // if the last message is set 0.1, user is about to type their first name
    else if (chat?.last_message === "register_0.1" && !payload && text) {
        chat.registeration.first_name = text;
        await chat.save();

        const message = lang[selectedLanguage].ENTER_LAST_NAME;
        const buttons = [
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "register_cancel" }],
        ];

        await sendButtons(chatId, message, buttons, "register_0.2");
    }
    // if the last message is set 0.2, user is about to type their last name
    else if (chat?.last_message === "register_0.2" && !payload && text) {
        chat.registeration.last_name = text;
        await chat.save();

        const message = lang[selectedLanguage].DOB_FORMAT;
        const buttons = [
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "register_cancel" }],
        ];

        await sendButtons(chatId, message, buttons, "register_0.2.1");
    }

    else if (chat?.last_message === "register_0.2.1" && !payload && text) {
        // Validate format DD-MM-YYYY
        const dobRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
        if (!dobRegex.test(text)) {
            await sendMessage(chatId, lang[selectedLanguage].INVALID_FORMAT);
            return;
        }

        const [day, month, year] = text.split('-').map(Number);
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();

        // Basic numerical validation
        if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > currentYear) {
            await sendMessage(chatId, lang[selectedLanguage].INVALID_DATE);
            return;
        }

        // Validate actual date existence
        const date = new Date(year, month - 1, day);
        if (
            date.getFullYear() !== year ||
            date.getMonth() + 1 !== month ||
            date.getDate() !== day
        ) {
            await sendMessage(chatId, lang[selectedLanguage].INVALID_DATE);
            return;
        }

        // Age validation (minimum 16 years)
        const age = currentDate.getFullYear() - year;
        const monthDiff = currentDate.getMonth() - (month - 1); // Months are 0-based in JS
        const dayDiff = currentDate.getDate() - day;

        if (age < 16 || (age === 16 && (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)))) {
            await sendMessage(chatId, lang[selectedLanguage].MIN_AGE);
            return;
        }

        // Save valid DOB
        chat.registeration.dob = text;
        await chat.save();

        // Proceed to mobile number input
        const message = lang[selectedLanguage].ASK_MOBILE_NUMBER.replace('{{name}}', chat?.registeration?.first_name);
        const buttons = [
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "register_cancel" }]
        ];

        await sendButtons(chatId, message, buttons, "register_0.3");
    }
    // if the last message is set to "register_0.3", the user is about to type their mobile number
    else if (chat?.last_message === "register_0.3" && !payload && text) {

        if (!text.startsWith("+")) {
            text = `+${text}`;
        }

        // checking if account already exists with the number
        const existingAccount = await Account.findOne({ phone: text?.replace("+", "") });

        if (existingAccount) {
            await sendMessage(chatId, lang[selectedLanguage].PHONE_NUMBER_REGISTERED, "register_0.3");

            return;
        }

        // Clean the number and check if it starts with 1
        const cleanedNumber = text.replace(/\D/g, '');

        if (cleanedNumber.startsWith("1")) {
            const countryDetails = identifyCountry(text);

            if (countryDetails) {
                // Save the phone number and country details in the chat registration
                chat.registeration.phone_number = text;
                chat.registeration.iso_code = countryDetails.isoCode;

                await chat.save();

                const message = `${lang[selectedLanguage].REVIEW_DETAILS}\n
${lang[selectedLanguage].FIRST_NAME}: ${chat.registeration.first_name}
${lang[selectedLanguage].LAST_NAME}: ${chat.registeration.last_name}
Date of Birth: ${chat.registeration.dob}
${lang[selectedLanguage].MOBILE_NUMBER}: ${chat.registeration.phone_number}
${lang[selectedLanguage].COUNTRY}: ${countryDetails.countryName}`;

                const buttons = [
                    [{ text: lang[selectedLanguage].CONFIRM_AND_CONTINUE, callback_data: "register_ask_password" }],
                    [{ text: lang[selectedLanguage].MODIFY_DETAILS, callback_data: "register_acc_ind_edit" }],
                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "register_cancel" }],
                ];
                await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/review.png");

                await sendButtons(chatId, message, buttons, "register_0.3.0");
            } else {
                const message = lang[selectedLanguage].PHONE_NUMBER_INCORRECT;
                await sendButtons(chatId, message, [], "register_0.3");
            }
        } else {
            // using dtone function for numbers other than 1
            const numberDetails = await numberVerificationAirtime(text);

            if (numberDetails.status) {
                if (numberDetails.message?.length !== 0) {
                    chat.registeration.phone_number = text;
                    chat.registeration.iso_code = numberDetails.message?.[0]?.country?.iso_code;

                    await chat.save();

                    const message = `${lang[selectedLanguage].REVIEW_DETAILS}\n
${lang[selectedLanguage].FIRST_NAME}: ${chat.registeration.first_name}
${lang[selectedLanguage].LAST_NAME}: ${chat.registeration.last_name}
Date of Birth: ${chat.registeration.dob}
${lang[selectedLanguage].MOBILE_NUMBER}: ${chat.registeration.phone_number}
${lang[selectedLanguage].COUNTRY}: ${numberDetails.message?.[0]?.country?.name}`;

                    const buttons = [
                        [{ text: lang[selectedLanguage].CONFIRM_AND_CONTINUE, callback_data: "register_ask_password" }],
                        [{ text: lang[selectedLanguage].MODIFY_DETAILS, callback_data: "register_acc_ind_edit" }],
                        [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "register_cancel" }],
                    ];

                    await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/review.png");
                    await sendButtons(chatId, message, buttons, "register_0.3.0");
                } else {
                    const message = lang[selectedLanguage].MOBILE_NUMBER_NOT_FOUND;
                    await sendButtons(chatId, message, [], "register_0.3");
                }
            } else {
                const message = lang[selectedLanguage].PHONE_NUMBER_INCORRECT;
                await sendButtons(chatId, message, [], "register_0.3");
            }
        }
    }

    else if (payload === "register_ask_password" && chat?.last_message === "register_0.3.0") {
        const tokenPayload = {
            platform: "telegram",
            recipient_id: chatId
        }

        const token = jwt.sign(tokenPayload, process.env.jwtKey, { expiresIn: '10m' })

        const buttons = [
            [{ text: lang[selectedLanguage].SET_PASSWORD, url: `https://my.insta-pay.ch/create-password/${token}` }]
        ];

        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/otp%20%284%29.png");
        await sendButtons(chatId, lang[selectedLanguage].SAVE_PASSWORD, buttons, "register_password");
    }

    // if the last message is set to "register_password", the user has proceeded with password
    // user is shown terms and conditions page
    else if (payload === "register_terms" && chat?.last_message === "register_password") {
        const message = lang[selectedLanguage].READ_TERMS_TELEGRAM;
        const buttons = [
            [{ text: lang[selectedLanguage].I_AGREE, callback_data: "register_proceed_terms" }],
            [{ text: lang[selectedLanguage].READ_TERMS, url: "https://insta-pay.ch/terms-and-conditions" }],
        ];

        await sendButtons(chatId, message, buttons, "register_terms");
    }
    // Verification code has been sent if the user clicked on proceed
    else if (payload === "register_proceed_terms" && chat?.last_message === "register_terms") {
        const otp = generateOTP();
        const hashedOTP = hashOTP(otp);
        const expirationTime = Date.now() + 2 * 60 * 1000; // 2 minutes

        chat.registeration.verificationTokenHash = hashedOTP;
        chat.registeration.verificationTokenExpiration = expirationTime;
        chat.registeration.verificationAttempts = 0;
        await chat.save();

        const message = `${lang[selectedLanguage].VERIFICATION_SENT}\n\n${lang[selectedLanguage].ENTER_VERIFICATION_CODE}`;

        const buttons = [
            [{ text: lang[selectedLanguage].RESEND_CODE, callback_data: "register_resend_code" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "register_cancel" }],
        ];

        // Send OTP via SMS
        const smsSent = await sendSMSTemplate(chat.registeration.phone_number, `${lang[selectedLanguage].INSTAPAY_OTP} ${otp}`);

        if (smsSent) {
            await sendButtons(chatId, message, buttons, "register_0.5");
            console.log(otp, "otp"); // Log OTP for debugging purposes
        } else {
            // SMS failed, log the error
            console.log("SMS failed to send");
            await sendMessage(chatId, lang[selectedLanguage].OTP_ERROR);
        }
    }
    // user has requested verification code again
    else if (payload === "register_resend_code" && (chat?.last_message === "register_0.5" || chat?.last_message === "register_terms")) {
        const now = Date.now();
        const cooldownPeriod = 2 * 60 * 1000;

        if (typeof chat.lastResendCodeTime === "undefined") {
            chat.lastResendCodeTime = 0;
        }

        // check if the cooldown period has passed
        if (now - chat.lastResendCodeTime < cooldownPeriod) {
            const remainingTime = Math.ceil((cooldownPeriod - (now - chat.lastResendCodeTime)) / 1000);
            await sendMessage(chatId, lang[selectedLanguage].WAIT_FOR_OTP.replace("{{remainingTime}}", remainingTime));
            return;
        }

        // Proceed with resending OTP
        const otp = generateOTP();
        const hashedOTP = hashOTP(otp);
        const expirationTime = now + 2 * 60 * 1000; // OTP valid for 2 minutes

        chat.registeration.verificationTokenHash = hashedOTP;
        chat.registeration.verificationTokenExpiration = expirationTime;
        chat.registeration.verificationAttempts = 0;
        chat.lastResendCodeTime = now; // Update last resend time
        await chat.save();

        const message = lang[selectedLanguage].ENTER_CODE_VERIFY_ACCOUNT;

        const buttons = [
            [{ text: lang[selectedLanguage].RESEND_CODE, callback_data: "register_resend_code" }],
            [{ text: lang[selectedLanguage].CANCEL, callback_data: "register_cancel" }],
        ];

        // Send OTP via SMS
        const smsSent = await sendSMSTemplate(
            chat.registeration.phone_number,
            `${lang[selectedLanguage].INSTAPAY_OTP} ${otp}`
        );

        if (smsSent) {
            await sendButtons(chatId, message, buttons, "register_0.5");
            console.log(otp, "otp"); // Log OTP for debugging purposes
        } else {
            console.log("SMS failed to send");
            await sendMessage(chatId, lang[selectedLanguage].OTP_ERROR);
        }
    }
    // user has entered the verification code
    else if (chat?.last_message === "register_0.5" && !payload && text) {
        const now = Date.now();

        // Check if OTP has expired
        if (now > chat.registeration.verificationTokenExpiration) {
            const buttons = [
                [{ text: lang[selectedLanguage].RESEND_CODE, callback_data: "register_resend_code" }]
            ];
            await sendButtons(chatId, lang[selectedLanguage].CODE_EXPIRED, buttons, "register_0.5");
            return;
        }

        // Check if max attempts are exceeded
        if (chat.registeration.verificationAttempts >= MAX_ATTEMPTS) {
            const buttons = [
                [{ text: lang[selectedLanguage].RESEND_CODE, callback_data: "register_resend_code" }]
            ];
            await sendButtons(chatId, lang[selectedLanguage].MAX_ATTEMPTS_EXCEEDED, buttons, "register_0.5");
            return;
        }

        const isValid = await validateOTP(chat.registeration.verificationTokenHash, text);

        if (!isValid) {
            chat.registeration.verificationAttempts += 1;
            await chat.save();
            const buttons = [
                [{ text: lang[selectedLanguage].RESEND_CODE, callback_data: "register_resend_code" }]
            ];
            await sendButtons(chatId, lang[selectedLanguage].VERIFICATION_CODE_INCORRECT, buttons, "register_0.5");
        } else {
            // Reset verification details on success
            chat.registeration.verificationAttempts = 0;
            chat.registeration.verificationTokenHash = null;
            chat.registeration.verificationTokenExpiration = null;

            // const tempPassword = generateTempPassword(12);
            // const encryptedPassword = CryptoJS.AES.encrypt(tempPassword, PASSWORD_ENCRYPTION_KEY).toString();
            // chat.registeration.temp_password = tempPassword;
            chat.registeration.source = "bot";
            await chat.save();

            const countryDetails = await CountryModel.findOne({ country_iso_code: chat.registeration.iso_code });

            const payload = {
                phone: chat.registeration.phone_number?.replace(/\+/g, ""),
                first_name: chat.registeration.first_name,
                last_name: chat.registeration.last_name,
                password: chat.registeration.temp_password,
                country_iso_code: chat.registeration.iso_code,
                country_name: countryDetails?.country_name,
                country: countryDetails?._id,
                telegram_bot: true,
                chatId,
                username: data?.message?.chat?.username || (data?.message?.chat?.first_name + " " + (data?.message?.chat?.last_name || "")) || "",
                dob: chat.registeration.dob
            };

            console.log(payload, "payload");

            const newAccount = await createNewUserAfterVerification(payload);

            if (newAccount.status) {
                chat.account = newAccount.accountData._id;
                chat.account_connected = true;
                chat.loggedOut = false
                await chat.save();

                const buttons = [
                    [{ text: lang[selectedLanguage].CONTINUE_CHATBOT, callback_data: "register_bot_continue" }],
                    [{ text: lang[selectedLanguage].INSTAPAY_PORTAL, url: "https://my.insta-pay.ch/login" }],
                ];
                await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png");
                await sendButtons(chatId, lang[selectedLanguage].ACCOUNT_CREATED, buttons, "register_nousername");

            } else {
                await sendMessage(chatId, lang[selectedLanguage].REGISTRATION_ERROR, "connect");
            }
        }
    }
    // user has proceeded with the continuation of using chatbot after setting up basic details
    else if (payload === "register_bot_continue" && chat.last_message === "register_nousername") {
        // first checking if the account has completly setup or user has randomly hit the continue button, so we will redirect to the main menu
        if (chat?.account_connected && chat?.account && chat?.account?.username) {
            // await mainMenuMessage(chatId, chat, selectedLanguage)
            await mainMenuKeyboardMessage(chatId, selectedLanguage, chat)
            return
        }
        await sendMessage(chatId, lang[selectedLanguage].CHOOSE_USERNAME, "register_0.7");
    }
    // User has entered a username
    else if (chat?.last_message === "register_0.7" && !payload && text) {
        const existingAccount = await Account.findOne({ username: text.toLowerCase() });
        console.log({ existingAccount });

        if (existingAccount) {
            await sendMessage(chatId, lang[selectedLanguage].USERNAME_TAKEN);
            return;
        }

        if (text.length < 3 || text.length > 30) {
            await sendMessage(chatId, lang[selectedLanguage].USERNAME_LENGTH);
            return;
        }

        chat.registeration.username = text.toLowerCase();

        const account = await Account.findById(chat.account);

        account.username = text.toLowerCase();
        await account.save();

        // Get country timezone
        const countryTimezone = ct.getCountry(countriesIso[chat.registeration.iso_code]);
        const timezones = countryTimezone.timezones;

        if (timezones.length === 1) {
            // Save the single available timezone
            const selectedTimezone = timezones[0];
            chat.registeration.timezone = selectedTimezone;
            await chat.save();

            account.timezone = selectedTimezone;
            await account.save();

            // Ask for the city name
            await sendMessage(chatId, lang[selectedLanguage].ENTER_CITY, "register_0.8");
        } else {
            // Handle multiple timezones
            chat.registeration.timezonePageIndex = 0;
            chat.registeration.timezones = timezones;
            await chat.save();

            await showTimezones(chatId, chat, 0, selectedLanguage);
        }
    }
    else if (payload?.startsWith("register_timezone_") && !text && chat?.last_message === "register_notimezone") {
        const [_, __, action, index] = payload.split("_");
        const pageIndex = parseInt(index, 10);

        if (action === "next" || action === "prev") {
            const newPageIndex = action === "next" ? chat.registeration.timezonePageIndex + 1 : chat.registeration.timezonePageIndex - 1;
            chat.registeration.timezonePageIndex = newPageIndex;
            await chat.save();
            await showTimezones(chatId, chat, newPageIndex, selectedLanguage);
        } else if (action === "timezone") {
            const selectedTimezone = payload.split("timezone_timezone_")[1];
            chat.registeration.timezone = selectedTimezone;
            await chat.save();

            const account = await Account.findById(chat.account);

            account.timezone = selectedTimezone;
            await account.save();

            await sendMessage(chatId, lang[selectedLanguage].ENTER_CITY, "register_0.8");
        }
    }
    else if (chat?.last_message === "register_nousername" && !payload && text && !chat?.account?.username) {
        await sendMessage(chatId, lang[selectedLanguage].CHOOSE_USERNAME, "register_0.7");
    } else if (chat?.last_message === "register_notimezone" && !payload && text && !chat?.timezone) {
        const countryTimezone = ct.getCountry(countriesIso[chat.registeration.iso_code]);
        const timezones = countryTimezone.timezones;
        chat.registeration.timezonePageIndex = 0;
        chat.registeration.timezones = timezones;
        await chat.save();
        await showTimezones(chatId, chat, 0, selectedLanguage);
    }
    // User is entering the city
    else if (chat?.last_message === "register_0.8" && !payload && text) {

        if (text.length < 3) {
            return await sendMessage(chatId, lang[selectedLanguage].CITY_NAME_LENGTH);
        }
        chat.registeration.city = text;
        await chat.save();

        const userCity = text;
        const countryIso3 = chat.registeration.iso_code;

        const { exactMatch, suggestions } = searchCity(userCity, countryIso3);

        if (exactMatch) {
            chat.registeration.city = exactMatch;
            await chat.save();

            const account = await Account.findById(chat.account);

            account.city = exactMatch;
            await account.save();

            // const buttons = [
            //     [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }]
            // ]

            // await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png");
            // const message = lang[selectedLanguage].CONGRATS_INSTAPAY_READY.replace('{{username}}', chat.registeration.username)

            // await sendButtons(chatId, message, buttons, "4");

            await sendPinSetupMessage(chatId, chat.account, selectedLanguage);
        } else if (suggestions.length > 0) {
            const keyboardOptions = suggestions.map((city) => ({
                text: city,
                callback_data: `register_city_${city}`,
            }));

            // Format keyboardOptions into rows (each button in its own row)
            const inlineKeyboard = keyboardOptions.map((option) => [option]);

            // Add an additional row for the main menu button
            inlineKeyboard.push([
                { text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" },
            ]);

            console.log(inlineKeyboard, "inlineKeyboard");
            console.log(keyboardOptions, "keyboardOptions");

            await sendButtons(
                chatId,
                lang[selectedLanguage].NO_EXACT_MATCH_FOUND.replace("{{text}}", text),
                inlineKeyboard
            );

        } else {
            await sendMessage(
                chatId,
                lang[selectedLanguage].NO_CITIES_FOUND.replace("{{text}}", text)
            );
        }
    }

    // User has selected city from inline keyboard
    else if (payload?.startsWith("register_city_") && chat?.last_message === "register_0.8") {
        const selectedCity = payload.split("register_city_")[1];
        chat.registeration.city = selectedCity;
        await chat.save();

        const account = await Account.findById(chat.account);

        account.city = selectedCity;
        await account.save();

        // const buttons = [
        //     [
        //         { text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }
        //     ]
        // ]

        // await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png");
        // const message = lang[selectedLanguage].CONGRATS_INSTAPAY_READY.replace('{{username}}', chat.registeration.username)

        // await sendButtons(chatId, message, buttons, "4");

        await sendPinSetupMessage(chatId, chat.account, selectedLanguage);
    }
    // else default message of invalid input
    else {
        await invalidInputResponse(selectedLanguage, chat);
    }


}

// handle temp password resend
async function sendTemporaryPassword(chatId, chat, phoneNumber, selectedLanguage) {
    if (!chat.registeration.temp_password_count) {
        chat.registeration.temp_password_count = 0;
    }

    let lastMessage;

    if (chat?.username) {
        lastMessage = "4";
    } else {
        lastMessage = "register_nousername";
    }

    if (chat.registeration.temp_password_count >= MAX_TEMP_PASS_ATTEMPTS) {
        await sendMessage(chatId, lang[selectedLanguage].NO_MORE_REQUESTS_TEMP_PASSWORD);
        return;
    }

    chat.registeration.temp_password_count += 1;
    await chat.save();

    if (chat?.username) {
        const buttons = [
            [
                { text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }
            ]
        ];

        await sendButtons(chatId, lang[selectedLanguage].TEMP_PASSWORD_SENT, buttons, lastMessage);
    } else {
        await sendMessage(chatId, lang[selectedLanguage].TEMP_PASSWORD_SENT);
    }

    // await sendSMSTemplate(phoneNumber, `${lang[selectedLanguage].TEMP_PASSWORD_IS} ${chat?.registeration?.temp_password}`);
}

// Function to show timezones with pagination
async function showTimezones(chatId, chat, pageIndex, selectedLanguage) {
    const account = await Account.findOne({ phone: chat?.registeration?.phone_number?.replace(/\+/g, "") });

    // Check if the timezone is already selected
    if (account?.timezone) {
        const buttons = [
            [
                { text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }
            ]
        ];
        await sendButtons(chatId, lang[selectedLanguage].TIMEZONE_ALREADY_SELECTED, buttons, "4");
        return;
    }

    const timezones = chat.registeration.timezones;

    // Generate timezones with GMT values for display
    const timezonesWithGMT = timezones.map((tz) => {
        const gmtOffset = getGmtOffset(tz); // Assumes getGmtOffset is a utility to fetch GMT offset
        return `(${gmtOffset}) ${tz}`;
    });

    const start = pageIndex * TIMEZONE_PAGE_SIZE;
    const end = Math.min(start + TIMEZONE_PAGE_SIZE, timezones.length);

    // Map buttons with only timezone payload (no GMT values in payload)
    const timezoneButtons = timezones.slice(start, end).map((tz, index) => ({
        text: timezonesWithGMT[start + index], // Display timezone with GMT
        callback_data: `register_timezone_timezone_${tz}` // Payload without GMT
    }));

    let message = lang[selectedLanguage].SELECT_TIMEZONE;
    if (pageIndex > 0) {
        message += `\n\n${lang[selectedLanguage].GO_BACK_CLICK} ${lang[selectedLanguage].PREVIOUS_BUTTON_TITLE}`;
    }
    if (end < timezones.length) {
        message += `\n\n${lang[selectedLanguage].SEE_MORE} ${lang[selectedLanguage].NEXT_BUTTON_TITLE}`;
    }

    const navigationButtons = [
        ...(pageIndex > 0 ? [[{ text: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE, callback_data: `register_timezone_prev_${pageIndex}` }]] : []),
        ...timezoneButtons.map((timezone) => [{ text: timezone.text, callback_data: timezone.callback_data }]),
        ...(end < timezones.length ? [[{ text: lang[selectedLanguage].NEXT_BUTTON_TITLE, callback_data: `register_timezone_next_${pageIndex}` }]] : [])
    ];

    console.log(navigationButtons, "navigationButtons");

    await sendButtons(chatId, message, navigationButtons, "register_notimezone");
}

async function sendPinSetupMessage(chatId, account, selectedLanguage) {
    const buttons = [
        [{ text: lang[selectedLanguage].SET_YOUR_PIN_, url: `https://my.insta-pay.ch/set-account-pin/${account._id}/telegram` }]
    ];

    await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/sshh.png");

    await sendButtons(
        chatId,
        lang[selectedLanguage].SET_PIN,
        buttons,
        "pin_setup"
    );
}


module.exports = accountRegisteration