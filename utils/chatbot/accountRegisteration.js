const AccountModel = require("../../models/Account.model");
const { numberVerificationAirtime } = require("../InstaChatbotHelpers");
const { sendSMSTemplate } = require("../instaChatbotOTP");
const { quickMessage, quickReply, sendTemplate, userInstaInfo, mainMenuMessage } = require("../instaChatbotUtils");
const crypto = require('crypto');
const CryptoJS = require("crypto-js");
const jwt = require('jsonwebtoken');
const Fuse = require('fuse.js');
const ct = require('countries-and-timezones');
const countriesIso = require("../countries_iso2.json");
const citiesData = require("../countries/CitiesData.json")
const lang = require('../languages/languages.json');
const UserModel = require("../../models/User.model");
const AccountLevelModel = require("../../models/Account-Level.model");
const CountryModel = require("../../models/Country.model");
const CategoryModel = require("../../models/Category.model");
const { createWallet } = require("../../controllers/Account.controller");
const { getGmtOffset } = require("../helpers");

const MAX_ATTEMPTS = 3;
const MAX_TEMP_PASS_ATTEMPTS = 3;
const TIMEZONE_PAGE_SIZE = 5;
const PASSWORD_ENCRYPTION_KEY = 'secretOfTheInstaPaySystemAccountPassword'


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

// handle temp password resend
async function sendTemporaryPassword(senderId, bot, phoneNumber, selectedLanguage) {
    if (!bot.registeration.temp_password_count) {
        bot.registeration.temp_password_count = 0;
    }

    let lastMessage

    if (bot?.username) {
        lastMessage = "4"
    } else {
        lastMessage = "register_nousername"
    }

    if (bot.registeration.temp_password_count >= MAX_TEMP_PASS_ATTEMPTS) {
        await quickMessage({ sender: { id: senderId } }, lang[selectedLanguage].NO_MORE_REQUESTS_TEMP_PASSWORD, lastMessage);
        return;
    }

    bot.registeration.temp_password_count += 1;
    await bot.save();

    if (bot?.username) {
        const quickReplies = [
            {
                "content_type": "text",
                "title": lang[selectedLanguage].MAIN_MENU,
                "payload": "main_menu"
            }
        ]

        await quickReply({ sender: { id: senderId } }, lang[selectedLanguage].TEMP_PASSWORD_SENT, quickReplies, lastMessage);

    } else {
        await quickMessage({ sender: { id: senderId } }, lang[selectedLanguage].TEMP_PASSWORD_SENT, lastMessage);
    }

    await sendSMSTemplate(phoneNumber, `${lang[selectedLanguage].TEMP_PASSWORD_IS} ${bot?.registeration?.temp_password}`);
}

async function handleRegistration(senderId, payload, account, bot, text, selectedLanguage) {
    console.log(`user: ${senderId} payload: ${payload}`);

    const data = {
        sender: {
            id: senderId
        }
    }

    if (payload === "register_cancel") {
        if (!bot?.instabot_connected) {
            if (bot?.account_username) {
                bot.account_username = "";
            }
            if (bot?.username) {
                bot.username = "";
            }
            await bot.save()
        }
        const message = lang[selectedLanguage].REGISTRATION_CANCELLED

        await quickMessage(data, message, "0");

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

        await sendTemplate(data, senderId, templatePayload, "0")

        bot.registeration = {}
        await bot.save();
    }

    else if (payload === "register_1") {
        if (!bot?.instabot_connected) {
            if (bot?.account_username) {
                bot.account_username = "";
            }
            if (bot?.username) {
                bot.username = "";
            }
            await bot.save()
        }
        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].INDIVIDUAL, payload: "register_acc_ind" },
            { content_type: "text", title: lang[selectedLanguage].BUSINESS, payload: "register_acc_bus" },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "register_cancel" }
        ];

        await quickReply(data, lang[selectedLanguage].GREAT_REGISTERING_AS, quickReplies, "register_0");
    } else if (payload === "register_acc_ind" || payload === "register_acc_ind_edit") {

        let message
        if (payload === "register_acc_ind_edit") {
            message = lang[selectedLanguage].ENTER_NEW_FIRST_NAME;
        } else {
            message = `${lang[selectedLanguage].START_GETTING_DETAILS}\n\n${lang[selectedLanguage].ENTER_FIRST_NAME}`;
        }

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "register_cancel" }
        ]

        await quickReply(data, message, quickReplies, "register_0.1");

    } else if (payload === "register_acc_bus") {

        const message = lang[selectedLanguage].BUSINESS_REGISTRATION_SOON;
        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].CONTINUE_INDIVIDUAL_ACCOUNT, payload: "register_1" },
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "register_cancel" }
        ]
        await quickReply(data, message, quickReplies, "0");

    }
    // if the last message is set 0.1, user is about to type their first name
    else if (bot?.last_message === "register_0.1" && !payload && text) {
        bot.registeration.first_name = text;
        await bot.save()

        const message = lang[selectedLanguage].ENTER_LAST_NAME;

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "register_cancel" }
        ]

        await quickReply(data, message, quickReplies, "register_0.2");
    }

    // if the last message is set 0.2, user is about to type their last name
    else if (bot?.last_message === "register_0.2" && !payload && text) {
        bot.registeration.last_name = text;
        await bot.save();

        const message = "Please enter your date of birth in the format DD-MM-YYYY";
        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "register_cancel" }
        ]

        await quickReply(data, message, quickReplies, "register_0.2.1");
    }

    // if the last message is set to "register_0.2.1", the user is about to type their date of birth
    else if (bot?.last_message === "register_0.2.1" && !payload && text) {
        // Validate format DD-MM-YYYY
        const dobRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
        if (!dobRegex.test(text)) {
            await quickMessage(data, "❌ Invalid format. Please use DD-MM-YYYY (e.g. 17-02-1976)");
            return;
        }

        const [day, month, year] = text.split('-').map(Number);
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();

        // Basic numerical validation
        if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > currentYear) {
            await quickMessage(data, "❌ Invalid date. Please check and try again.");
            return;
        }

        // Validate actual date existence
        const date = new Date(year, month - 1, day);
        if (
            date.getFullYear() !== year ||
            date.getMonth() + 1 !== month ||
            date.getDate() !== day
        ) {
            await quickMessage(data, "❌ Invalid date. Please check and try again.");
            return;
        }

        // Age validation (minimum 16 years)
        const age = currentDate.getFullYear() - year;
        const monthDiff = currentDate.getMonth() - (month - 1);
        const dayDiff = currentDate.getDate() - day;

        if (age < 16 || (age === 16 && (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)))) {
            await quickMessage(data, "❌ You must be at least 16 years old to register.");
            return;
        }

        // Save valid DOB
        bot.registeration.dob = text;
        await bot.save();

        const message = lang[selectedLanguage].ASK_MOBILE_NUMBER.replace('{{name}}', bot?.registeration?.first_name);
        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "register_cancel" }
        ]

        await quickReply(data, message, quickReplies, "register_0.3");
    }

    // if the last message is set to "register_0.3", the user is about to type their mobile number
    else if (bot?.last_message === "register_0.3" && !payload && text) {

        if (!text.startsWith("+")) {
            text = `+${text}`
        }

        // checking if account already exists with the number
        const existingAccount = await AccountModel.findOne({ phone: text?.replace("+", "") })

        if (existingAccount) {
            await quickMessage(data, lang[selectedLanguage].PHONE_NUMBER_REGISTERED, "register_0.3");
            return
        }
        // Clean the number and check if it starts with 1
        const cleanedNumber = text.replace(/\D/g, '');

        if (cleanedNumber.startsWith("1")) {
            const countryDetails = identifyCountry(text);

            if (countryDetails) {
                // Save the phone number and country details in the bot registration
                bot.registeration.phone_number = text;
                bot.registeration.iso_code = countryDetails.isoCode;

                await bot.save();

                const message = `${lang[selectedLanguage].REVIEW_DETAILS}\n
${lang[selectedLanguage].FIRST_NAME}: ${bot.registeration.first_name}
${lang[selectedLanguage].LAST_NAME}: ${bot.registeration.last_name}
Date of Birth: ${bot.registeration.dob}
${lang[selectedLanguage].MOBILE_NUMBER}: ${bot.registeration.phone_number}
${lang[selectedLanguage].COUNTRY}: ${countryDetails.countryName}
            `;

                const quickReplies = [
                    { content_type: "text", title: lang[selectedLanguage].CONFIRM_AND_CONTINUE, payload: "register_ask_password" },
                    { content_type: "text", title: lang[selectedLanguage].MODIFY_DETAILS, payload: "register_acc_ind_edit" },
                    { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "register_cancel" }
                ];
                await quickReply(data, message, quickReplies, "register_0.3");
            } else {
                const message = lang[selectedLanguage].PHONE_NUMBER_INCORRECT;
                await quickMessage(data, message, "register_0.3");
            }
        } else {
            // using dtone function for numbers other than 1
            const numberDetails = await numberVerificationAirtime(text);

            if (numberDetails.status) {
                if (numberDetails.message?.length !== 0) {
                    bot.registeration.phone_number = text;
                    bot.registeration.iso_code = numberDetails.message?.[0]?.country?.iso_code;

                    await bot.save();

                    const message = `${lang[selectedLanguage].REVIEW_DETAILS}\n
${lang[selectedLanguage].FIRST_NAME}: ${bot.registeration.first_name}
${lang[selectedLanguage].LAST_NAME}: ${bot.registeration.last_name}
Date of Birth: ${bot.registeration.dob}
${lang[selectedLanguage].MOBILE_NUMBER}: ${bot.registeration.phone_number}
${lang[selectedLanguage].COUNTRY}: ${numberDetails.message?.[0]?.country?.name}
                `;

                    const quickReplies = [
                        { content_type: "text", title: lang[selectedLanguage].CONFIRM_AND_CONTINUE, payload: "register_ask_password" },
                        { content_type: "text", title: lang[selectedLanguage].MODIFY_DETAILS, payload: "register_acc_ind_edit" },
                        { content_type: "text", title: lang[selectedLanguage].MAIN_MENU, payload: "register_cancel" }

                    ];
                    await quickReply(data, message, quickReplies, "register_0.3");
                } else {
                    const message = lang[selectedLanguage].MOBILE_NUMBER_NOT_FOUND;
                    await quickMessage(data, message, "register_0.3");
                }
            } else {
                const message = lang[selectedLanguage].PHONE_NUMBER_INCORRECT;
                await quickMessage(data, message, "register_0.3");
            }
        }
    }

    else if (payload === "register_ask_password") {
        const tokenPayload = {
            platform: "instagram",
            recipient_id: senderId
        }

        const token = jwt.sign(tokenPayload, process.env.jwtKey, { expiresIn: '10m' })

        const templatePayload = {
            template_type: "generic",
            elements: [
                {
                    title: "Please tap the below button to set the account password.",
                    image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/otp.jpeg",
                    buttons: [
                        {
                            type: "web_url",
                            title: "Set your password",
                            url: `https://my.insta-pay.ch/create-password/${token}`,
                        },

                    ],
                },
            ]
        };

        await sendTemplate(data, senderId, templatePayload);
    }

    // user is shown terms and conditions page
    else if (payload === "register_terms" && bot?.last_message === "register_nousername") {

        const templatePayload = {
            template_type: "generic",
            elements: [
                {

                    title: "Please read the terms and conditions carefully before proceeding. By clicking “I agree” below, you agree to the terms and conditions.",
                    buttons: [
                        {
                            type: "postback",
                            title: "I agree",
                            payload: "register_proceed_terms",
                        },
                        {
                            type: "web_url",
                            title: lang[selectedLanguage].READ_TERMS,
                            url: `https://insta-pay.ch/terms-and-conditions`,
                            webview_height_ratio: "full"
                        },
                    ],
                },

            ]
        };

        await sendTemplate(data, senderId, templatePayload, "0")
    }

    // verification code has been sent if user cliked on proceed
    else if (payload === "register_proceed_terms") {
        const otp = generateOTP();
        const hashedOTP = hashOTP(otp);
        const expirationTime = Date.now() + 2 * 60 * 1000; // 2 minutes

        bot.registeration.verificationTokenHash = hashedOTP;
        bot.registeration.verificationTokenExpiration = expirationTime;
        bot.registeration.verificationAttempts = 0;
        await bot.save();

        const message = `${lang[selectedLanguage].VERIFICATION_SENT}\n\n${lang[selectedLanguage].ENTER_VERIFICATION_CODE}`;

        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].RESEND_CODE, payload: "register_resend_code" },
            { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "register_cancel" }

        ]
        await quickReply(data, message, quickReplies, "register_0.5");

        console.log(otp, "otp")
        // Send OTP via SMS
        await sendSMSTemplate(bot.registeration.phone_number, `${lang[selectedLanguage].INSTAPAY_OTP} ${otp}`);
    }

    // user has requested verification code again
    else if (payload === "register_resend_code") {
        const otp = generateOTP();
        const hashedOTP = hashOTP(otp);
        const expirationTime = Date.now() + 2 * 60 * 1000; // 2 minutes

        bot.registeration.verificationTokenHash = hashedOTP;
        bot.registeration.verificationTokenExpiration = expirationTime;
        bot.registeration.verificationAttempts = 0;
        await bot.save();

        const message = lang[selectedLanguage].ENTER_CODE_VERIFY_ACCOUNT;
        const quickReplies = [
            { content_type: "text", title: lang[selectedLanguage].RESEND_CODE, payload: "register_resend_code" },
            { content_type: "text", title: lang[selectedLanguage].CANCEL, payload: "register_cancel" }
        ]
        await quickReply(data, message, quickReplies, "register_0.5");
        await sendSMSTemplate(bot.registeration.phone_number, `${lang[selectedLanguage].INSTAPAY_OTP} ${otp}`);
    }

    // User enters the OTP code
    else if (bot?.last_message === "register_0.5" && !payload && text) {
        if (Date.now() > bot.registeration.verificationTokenExpiration) {
            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].RESEND_OTP, payload: "register_resend_code" }
            ];
            await quickReply(data, lang[selectedLanguage].CODE_EXPIRED, quickReplies, "register_0.5");
            return;
        }

        if (bot.registeration.verificationAttempts >= MAX_ATTEMPTS) {
            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].RESEND_OTP, payload: "register_resend_code" }
            ];
            await quickReply(data, lang[selectedLanguage].MAX_ATTEMPTS_EXCEEDED, quickReplies, "register_0.5");
            return;
        }

        const isValid = await validateOTP(bot.registeration.verificationTokenHash, text);

        if (!isValid) {
            bot.registeration.verificationAttempts += 1;
            await bot.save();
            const quickReplies = [
                { content_type: "text", title: lang[selectedLanguage].RESEND_OTP, payload: "register_resend_code" }
            ];
            await quickReply(data, lang[selectedLanguage].VERIFICATION_CODE_INCORRECT, quickReplies, "register_0.5");
        } else {
            bot.registeration.verificationAttempts = 0;
            bot.registeration.verificationTokenHash = null;
            bot.registeration.verificationTokenExpiration = null;

            bot.instabot_connected = true;
            bot.registeration.source = "bot"
            await bot.save();

            const countryDetails = await CountryModel.findOne({ country_iso_code: bot.registeration.iso_code });

            const instaDetails = await userInstaInfo(senderId)

            const payload = {
                phone: bot.registeration.phone_number?.replace(/\+/g, ""),
                first_name: bot.registeration.first_name,
                last_name: bot.registeration.last_name,
                password: bot.registeration.temp_password,
                country_iso_code: bot.registeration.iso_code,
                country_name: countryDetails?.country_name,
                country: countryDetails?._id,
                insta_subscriber_id: senderId,
                insta_username: instaDetails?.username,
                insta_recipient_id: bot._id,
                dob: bot.registeration.dob
            }

            console.log(payload, "payload")

            const newAccount = await createNewUserAfterVerification(payload)

            console.log(newAccount, "newAccount")
            if (newAccount.status) {



                const templatePayload = {
                    template_type: "generic",
                    elements: [
                        {
                            title: 'Your account has been created successfully!',
                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                            buttons: [
                                {
                                    type: "postback",
                                    title: lang[selectedLanguage].CONTINUE_CHATBOT,
                                    payload: "register_bot_continue",
                                },
                                {
                                    type: "web_url",
                                    title: lang[selectedLanguage].INSTAPAY_PORTAL,
                                    url: `https://my.insta-pay.ch/login`,
                                },
                            ],
                        },
                    ]
                };

                await sendTemplate(data, senderId, templatePayload, "register_0.6");

                // await sendSMSTemplate(bot.registeration.phone_number, `${lang[selectedLanguage].INSTAPAY_TEMP_PASSWORD} ${tempPassword}`);
            } else {
                await quickMessage(data, lang[selectedLanguage].REGISTRATION_ERROR, "0");
            }
        }
    }
    // handling resend temp password logic 
    // else if (payload === "register_resend_temp_password") {
    //     await sendTemporaryPassword(senderId, bot, bot.registeration.phone_number, selectedLanguage);
    // }
    // user has proceeded with the continuation of using chatbot after setting up basic details
    else if (payload === "register_bot_continue" && bot?.last_message === "register_0.6") {
        // first checking if the account has completly setup and user has randomly hit the continue button, so we will redirect to the main menu
        if (bot?.instabot_connected && bot?.username) {
            await mainMenuMessage(data, senderId, bot, selectedLanguage)
            return
        }
        await quickMessage(data, lang[selectedLanguage].CHOOSE_USERNAME, "register_0.7");
    }
    // user has entered username
    else if (bot?.last_message === "register_0.7" && !payload && text) {
        const existingAccount = await AccountModel.findOne({ username: text.toLowerCase() });
        if (existingAccount) {
            await quickMessage(data, lang[selectedLanguage].USERNAME_TAKEN, "register_0.7");
        } else {
            // username validation for min of 3 charachtes and maximum of 30 charachters
            if (text.length < 3 || text.length > 30) {
                return await quickMessage(data, lang[selectedLanguage].USERNAME_LENGTH, "register_0.7");
            }
            bot.registeration.username = text.toLowerCase();
            bot.username = text.toLowerCase();
            bot.account_username = text.toLowerCase();

            account.username = text.toLowerCase();
            await account.save();

            const countryTimezone = ct.getCountry(countriesIso[bot.registeration.iso_code]);
            console.log(countryTimezone, "countryTimezone")
            const timezones = countryTimezone.timezones;

            // if only one timezone is found, then saving that timezone in default, and processing the registeration flow
            if (timezones.length === 1) {
                // If only one timezone is available, save it directly
                const selectedTimezone = timezones[0];
                bot.registeration.timezone = selectedTimezone;
                await bot.save();

                account.timezone = selectedTimezone;
                await account.save();

                // asking for the city name
                await quickMessage(data, lang[selectedLanguage].ENTER_CITY, "register_0.8");
            } else {

                const timezones = countryTimezone.timezones
                bot.registeration.timezonePageIndex = 0;
                bot.registeration.timezones = timezones;
                await bot.save();
                await showTimezones(data, bot, 0, selectedLanguage);
            }
        }
    }
    // user is proceeding with timezone
    else if (payload?.startsWith("register_timezone_")) {
        const [_, __, action, index] = payload.split("_");
        console.log(action, "action", index, "index", payload, "payload")
        const pageIndex = parseInt(index, 10);
        if (action === "next" || action === "prev") {
            const newPageIndex = action === "next" ? bot.registeration.timezonePageIndex + 1 : bot.registeration.timezonePageIndex - 1;
            bot.registeration.timezonePageIndex = newPageIndex;
            console.log(bot.registeration.timezonePageIndex, newPageIndex, "bot.registeration.timezonePageIndex")
            await bot.save();
            await showTimezones(data, bot, newPageIndex, selectedLanguage);
        } else if (action === "timezone") {

            const selectedTimezone = payload.split("timezone_timezone_")[1];
            console.log(selectedTimezone, "selectedTimezone", payload)
            bot.registeration.timezone = selectedTimezone;
            await bot.save();

            account.timezone = selectedTimezone;
            await account.save();

            await quickMessage(data, lang[selectedLanguage].ENTER_CITY, "register_0.8");
        }
    }
    // if user has left the flow without username
    else if (bot?.last_message === "register_nousername" && !payload && text && !bot?.username) {
        await quickMessage(data, lang[selectedLanguage].CHOOSE_USERNAME, "register_0.7");
    }
    // if user has left the flow without timezone
    else if (bot?.last_message === "register_notimezone" && !payload && text && !bot?.timezone) {
        const countryTimezone = ct.getCountry(countriesIso[bot.registeration.iso_code]);
        console.log(countryTimezone, "countryTimezone")
        const timezones = countryTimezone.timezones
        bot.registeration.timezonePageIndex = 0;
        bot.registeration.timezones = timezones;
        await bot.save();
        await showTimezones(data, bot, 0, selectedLanguage);
    }

    // user is entering the city
    else if (bot?.last_message === "register_0.8" && !payload && text) {

        if (text.length < 3) {
            return await quickMessage(data, lang[selectedLanguage].CITY_NAME_LENGTH);
        }
        bot.registeration.city = text;
        await bot.save();

        const userCity = text;
        const countryIso3 = bot.registeration.iso_code;

        const { exactMatch, suggestions } = searchCity(userCity, countryIso3);

        if (exactMatch) {
            bot.registeration.city = exactMatch;
            await bot.save();

            account.city = exactMatch;
            await account.save();

            // await sendSuccessTemplate(data, senderId, bot, selectedLanguage)
            await sendPinSetupMessage(data, senderId, account);
        } else if (suggestions.length > 0) {
            const quickReplies = suggestions.map((city) => ({
                content_type: "text",
                title: city,
                payload: `register_city_${city}`
            }));

            await quickReply(data, lang[selectedLanguage].NO_EXACT_MATCH_FOUND.replace("{{text}}", text), quickReplies, "register_0.8");
        } else {
            await quickMessage(data, lang[selectedLanguage].NO_CITIES_FOUND.replace("{{text}}", text), "register_0.8");
        }
    }

    // user has selected city from quickReplies
    else if (payload?.startsWith("register_city_")) {
        const selectedCity = payload.split("register_city_")[1];
        bot.registeration.city = selectedCity;
        await bot.save();

        account.city = selectedCity;
        await account.save();

        // await sendSuccessTemplate(data, senderId, bot, selectedLanguage)

        await sendPinSetupMessage(data, senderId, account);
    }
}

// Function to search for the closest matching city
function searchCity(cityName, countryIso3) {
    const countryData = citiesData.find(country => country.iso3 === countryIso3);
    if (!countryData) return { exactMatch: null, suggestions: [] };

    const cities = countryData.cities.map(city => city.name);

    const options = {
        includeScore: true,
        threshold: 0.3, // threshold for matching
        keys: ['name']
    };

    const fuse = new Fuse(cities, options);

    const result = fuse.search(cityName);
    const exactMatch = cities.includes(cityName) ? cityName : null;
    const suggestions = result.map(res => res.item).slice(0, 10); // Limit to top 10 suggestions

    return { exactMatch, suggestions };
};

async function createNewUserAfterVerification(data) {
    try {
        const {
            phone, first_name, last_name, password,
            country_iso_code, country_name, country, insta_subscriber_id, insta_username, insta_recipient_id, dob
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
            insta_bot: true,
            insta_recipient_id,
            insta_username,
            insta_subscriber_id,
            dob
        };

        // if (email) {
        //     createAccountObj['email'] = email.toLowerCase();
        // }

        let categoryDetails = await CategoryModel.findOne({
            business_type: 'individual_accounts',
            account_type: 'individual'
        }, { business_type: true });

        let countryDetails = await CountryModel.findOne({
            country_iso_code,
            status: 'active',
            individual_registration_active: true
        }, { country_name: true, country_iso_code: true });

        console.log(categoryDetails, countryDetails, "categoryDetails, countryDetails")
        if (!categoryDetails || !countryDetails) {
            throw new Error("Account registration failed due to invalid category or country.");
        }

        let level = await AccountLevelModel.findOne({
            country: countryDetails._id,
            category: categoryDetails._id,
            level_no: 1,
            account_type: 'individual'
        }, { account_type: true });

        if (!level) {
            throw new Error("Account registration failed due to invalid account level.");
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

async function showTimezones(data, bot, pageIndex, selectedLanguage) {

    const account = await AccountModel.findOne({ phone: bot?.registeration?.phone_number?.replace(/\+/g, "") });

    if (account?.timezone) {
        const quickReplies = [
            {
                content_type: "text",
                title: lang[selectedLanguage].MAIN_MENU,
                payload: `main_menu`
            }
        ]
        await quickReply(data, lang[selectedLanguage].TIMEZONE_ALREADY_SELECTED, quickReplies, "4");
        return
    }
    const timezones = bot.registeration.timezones;

    // Generate a mapping of timezones with GMT values
    const timezonesWithGMT = timezones.map((tz) => ({
        display: `${getGmtOffset(tz)} ${tz}`,
        original: tz,
    }));

    const start = pageIndex * TIMEZONE_PAGE_SIZE;
    const end = Math.min(start + TIMEZONE_PAGE_SIZE, timezonesWithGMT.length);

    const timezoneList = timezonesWithGMT.slice(start, end).map((tz) => ({
        content_type: "text",
        title: tz.display,
        payload: `register_timezone_timezone_${tz.original}`,
    }));


    let message = lang[selectedLanguage].SELECT_TIMEZONE;
    if (pageIndex > 0) {
        message += `\n\n${lang[selectedLanguage].GO_BACK_CLICK} ${lang[selectedLanguage].PREVIOUS_BUTTON_TITLE}`;
    }
    if (end < timezonesWithGMT.length) {
        message += `\n\n${lang[selectedLanguage].SEE_MORE} ${lang[selectedLanguage].NEXT_BUTTON_TITLE}`;
    }

    const quickReplies = [
        ...(pageIndex > 0
            ? [
                {
                    content_type: "text",
                    title: lang[selectedLanguage].PREVIOUS_BUTTON_TITLE,
                    payload: `register_timezone_prev_${pageIndex}`,
                },
            ]
            : []),
        ...timezoneList,
        ...(end < timezonesWithGMT.length
            ? [
                {
                    content_type: "text",
                    title: lang[selectedLanguage].NEXT_BUTTON_TITLE,
                    payload: `register_timezone_next_${pageIndex}`,
                },
            ]
            : []),
    ];

    await quickReply(data, message, quickReplies, "register_notimezone");
}

// account succesfully completed template
async function sendSuccessTemplate(data, senderId, bot, selectedLanguage) {
    const templatePayload = {
        template_type: "generic",
        elements: [
            {
                title: lang[selectedLanguage].ALL_SET.replace('{{username}}', bot.registeration.username),
                image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Coonect%20to%20instapay.png",
                subtitle: lang[selectedLanguage].CONGRATS_INSTAPAY_READY.replace('{{username}}', bot.registeration.username),
                buttons: [
                    {
                        type: "postback",
                        title: lang[selectedLanguage].MAIN_MENU,
                        payload: "main_menu",
                    },
                    {
                        type: "web_url",
                        title: lang[selectedLanguage].INSTAPAY_PORTAL,
                        url: "https://my.insta-pay.ch/login",
                    },
                    {
                        type: "postback",
                        title: lang[selectedLanguage].CONNECT_SOCIAL_ACCOUNTS,
                        payload: "connect_social_accounts",
                    },
                ],
            },
        ],
    };

    bot.registeration = {};
    await bot.save()

    await sendTemplate(data, senderId, templatePayload, "4");
}

async function sendPinSetupMessage(data, senderId, account) {
    const templatePayload = {
        template_type: "generic",
        elements: [
            {
                title: "To keep your account secure, we need you to set up a 4-digit PIN.\n\n🔐 Simply click the button below to get started:",
                image_url: "https://nodejs-checking-bucket.s3.amazonaws.com/chatbot_images/Login.png",
                buttons: [
                    {
                        type: "web_url",
                        title: "Set Your PIN",
                        url: `https://my.insta-pay.ch/set-account-pin/${account._id}/instagram`,
                    },
                ],
            },
        ],
    };

    await sendTemplate(data, senderId, templatePayload, "4");
}

module.exports = handleRegistration;