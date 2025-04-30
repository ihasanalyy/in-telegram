const Account = require('../../../models/Account.model');
const TelegramBotModel = require('../../../models/TelegramBot.model');
const lang = require('../../languages/languages.json');
const { sendPhoto, sendButtons, sendMessage, invalidInputResponse } = require('../../telegramBotUtils');
const jwt = require('jsonwebtoken');

async function telegramCodeVerification(code, chatId, username, selectedLanguage, data) {
    try {

        console.log({ chatId })
        const telegramBot = await TelegramBotModel.findOne({ recipient: chatId });
        console.log(telegramBot, "telegramBottelegramBot")

        Account.findOne({ $and: [{ username }, { active: true }] }, { telegram_bot: true, username: true, telegramBotToken: true, account_type: true, user: true, company: true, level: true })
            .populate([
                { path: 'user', select: 'first_name last_name' },
                { path: 'company', select: 'company_name' }
            ])
            .then(async (user) => {
                console.log({ user });
                if (user) {
                    const currentTime = new Date();

                    if (telegramBot?.chatbotBannedUntil && telegramBot?.chatbotBannedUntil > currentTime) {
                        // User is currently banned
                        await sendMessage(chatId, `Your account has been temporarly banned. Please try again later.`, "connect");
                        return;
                    }

                    if (user.telegramBotToken) {
                        console.log("1st condition ran")
                        if (!user.telegram_bot) {
                            console.log("2nd condition ran")
                            jwt.verify(user.telegramBotToken, process.env.TELEGRAM_CHATBOT_LINK_KEY, async function (err, token_data) {
                                console.log("3rd condition ran")
                                if (err || !(code == token_data.link_code.split(":")[1] && user._id == token_data.account_id)) {
                                    console.log("4th condition ran")
                                    let chatbotFailedAttempts = telegramBot?.chatbotFailedAttempts || 0;
                                    let chatbotFirstFailedAttempt = telegramBot?.chatbotFirstFailedAttempt || currentTime;

                                    // Reset failed attempts if more than 10 minutes have passed since the first failed attempt
                                    if (currentTime - new Date(chatbotFirstFailedAttempt) > 10 * 60000) {
                                        chatbotFailedAttempts = 0;
                                        chatbotFirstFailedAttempt = currentTime;
                                    }

                                    chatbotFailedAttempts += 1;

                                    if (chatbotFailedAttempts > 3) {
                                        console.log("5th condition ran")
                                        const banExpiryTime = new Date(currentTime.getTime() + 10 * 60000); // 10 minutes in milliseconds
                                        await TelegramBotModel.updateOne({ _id: telegramBot._id }, { $set: { chatbotBannedUntil: banExpiryTime, chatbotFailedAttempts: 0, chatbotFirstFailedAttempt: null } });


                                        await sendMessage(chatId, `Your account has been temporarly banned. Please try again later.`, "connect");
                                    } else {
                                        console.log("5th running")
                                        TelegramBotModel.updateOne({ _id: telegramBot._id }, { $set: { chatbotFailedAttempts, chatbotFirstFailedAttempt } }).then(async (updated) => {
                                            console.log("updated", updated)
                                        }).catch((err) => {
                                            console.log(err, "someting went wrong")
                                        })

                                        await sendMessage(chatId, `${lang[selectedLanguage].CODE_VERIFICATION_FAILURE_MESSAGE} ${lang[selectedLanguage].ENTER_AGAIN}.`);
                                    }
                                } else {
                                    Account.updateOne({ username: user.username }, { $set: { telegram_bot: true, telegram_id: chatId, telegram_username: data?.message?.chat?.username || data?.message?.chat?.first_name + " " + data?.message?.chat?.last_name || "" } })
                                        .then(async (updated) => {
                                            console.log("updated", updated)
                                            TelegramBotModel.updateOne({ _id: telegramBot._id }, { $set: { account_connected: true, last_message: "4", loggedOut: false } }).then(async (updated) => {
                                                const buttons = [
                                                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
                                                ]
                                                await sendButtons(chatId, "Great Job! Your telegram is now synced with InstaPay✔️.Tap below to head back to the Main menu.", buttons, "4");
                                            }).catch(async (err) => {
                                                console.log(err, "someting went wrong")
                                                const buttons = [
                                                    [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "register_template" }],
                                                ]
                                                await sendButtons(chatId, lang[selectedLanguage].ACCOUNT_LINKING_FAILURE_MESSAGE, buttons, "connect");
                                            })
                                        }).catch(async (err) => {
                                            console.log(err, "someting went wrong")
                                            const buttons = [
                                                [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "register_template" }],
                                            ]
                                            await sendButtons(chatId, lang[selectedLanguage].ACCOUNT_LINKING_FAILURE_MESSAGE, buttons, "connect");
                                        })
                                }
                            });
                        } else {
                            await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_LINKED_MESSAGE, "connect");
                        }
                    } else {
                        await sendMessage(chatId, `${lang[selectedLanguage].CODE_VERIFICATION_FAILURE_MESSAGE} ${lang[selectedLanguage].ENTER_AGAIN}.`);
                    }
                } else {
                    await sendMessage(chatId, `${lang[selectedLanguage].CODE_VERIFICATION_FAILURE_MESSAGE} ${lang[selectedLanguage].ENTER_AGAIN}.`);
                }
            })
            .catch(async (err) => {
                console.log(err);
                await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_LINKING_FAILURE_MESSAGE, "connect");
            });
    } catch (err) {
        console.log(err);
        await sendMessage(chatId, lang[selectedLanguage].ACCOUNT_LINKING_FAILURE_MESSAGE, "connect");
    }
}

async function telegramConnection(chatId, payload, chat, text, selectedLanguage, data, isTelegramConnection) {
    console.log({ chatId, payload, chat, text, selectedLanguage, chat: data?.message?.chat })

    if (chat.account_connected && chat?.account?.telegram_bot) {
        const message = "Your account is already connected to the InstaPay Telegram channel! ✅";
        const buttons = [
            [{ text: lang[selectedLanguage].MAIN_MENU, callback_data: "main_menu" }],
        ]
        return await sendButtons(chatId, message, buttons, "4");
    }

    if ((!payload && text && chat.last_message === "connect") || payload === "connect" || isTelegramConnection) {
        if (chat?.registeration && Object.keys(chat?.registeration).length > 0) {
            chat.registeration = {}
            await chat.save()
        }
        const buttonText = "How can we help you today? Let's get started!🚀👇"
        const message = `Hi ${data?.message?.chat?.first_name || data?.callback_query?.message?.chat?.first_name}! 🎉 Welcome to the InstaPay Telegram channel! 💬`;
        const buttons = [
            [{ text: lang[selectedLanguage].CONNECT_BUTTON_TITLE, callback_data: "connect_account" }],
            [{ text: lang[selectedLanguage].REGISTER_BUTTON_TITLE, callback_data: "register" }],
            [{ text: lang[selectedLanguage].CHANGE_LANGUAGE, callback_data: "language_change" }],
        ];
        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/welcome1.png", message);
        await sendButtons(chatId, buttonText, buttons);

    } else if (payload === "connect_account" && chat.last_message === "connect") {

        await sendPhoto(chatId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/welcome-TG.png", "Please type in your InstaPay username to get started. 😊✨", "connect_username");
    }
    // user has entered username
    else if (!payload && text && chat.last_message === "connect_username") {

        const accountDetails = await Account.findOne({ username: text.toLowerCase(), status: "active", active: true });

        if (!accountDetails) {
            await sendMessage(chatId, lang[selectedLanguage].INVALID_USERNAME_MESSAGE);
        } else if (accountDetails?.telegram_bot) {
            await sendMessage(chatId, "This InstaPay account has already been linked");
        } else {
            chat.account = accountDetails._id;
            await chat.save()
            await sendMessage(chatId, "To link your Telegram account with InstaPay, please follow these steps:\n1. Open InstaPay and go to the Settings section.\n2. Select Social Network Accounts.\n3. Enable Telegram.\n4. Enter the InstaPay code displayed there to complete the linking process.", "connect_code");
        }
    }

    // user has entered code
    else if (!payload && text && chat.last_message === "connect_code") {
        const account = await Account.findById(chat.account);

        // return console.log(jwt.sign({ account: account._id, link_code: "123456" }, process.env.TELEGRAM_CHATBOT_LINK_KEY))
        await telegramCodeVerification(text, chatId, account.username, selectedLanguage, data)
    }
    // else default response of invalid command
    else {
        await invalidInputResponse(selectedLanguage, chat);
    }
}

module.exports = telegramConnection