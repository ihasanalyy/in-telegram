const Country = require("../models/Country.model");
const cron = require('node-cron');
const countries_iso2 = require('../utils/countries_iso2.json')
const ct = require('countries-and-timezones');
const moment = require('moment-timezone');
const Schedule = require("../models/Schedule.model");
const WalletModel = require("../models/Wallet.model");
const Account = require("../models/Account.model");
const RequestPaymentModel = require("../models/Request-Payment.model");
const { addNotification } = require('../utils/generateNotification');
const { sendPrivateMessage } = require('../utils/websocket');

const { sendNotifications } = require('../utils/sendEmail');
const { quickReply, sendTemplate, sendMultipleImages } = require('../controllers/InstaChatbot.controller')
const { walletToWalletTransactionHelper } = require('../utils/helpers');
const InstaChatbotModel = require("../models/InstaChatbot.model");
const { formattedAmount } = require("./InstaChatbotHelpers");
const { quickMessage } = require("./instaChatbotUtils");

async function requestPayment(data, files) {
    try {

        let { amount, wallet_id, purpose, sender, receiver, type, description } = data;
        console.log(amount, wallet_id, purpose, sender, receiver)

        let senderWallet = await WalletModel.findOne({ $and: [{ _id: wallet_id.toString() }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level']) }])
        let receiverDetails = await Account.findOne({ $and: [{ _id: receiver }, { active: true }] }).populate(['user', 'company', 'insta_recipient_id'])
        let senderDetails = await Account.findOne({ $and: [{ _id: sender }, { active: true }] }).populate(['user', 'company'])

        console.log(senderWallet, "senderWallet")
        console.log(receiverDetails, "receiverDetails")
        console.log(senderDetails, "senderDetails")
        if (!senderWallet) {
            return { status: false, message: 'Request failed' };
        }
        if (!senderWallet?.account?.active || !senderDetails) {
            console.log(senderWallet?.account?.active, senderDetails);

            return { status: false, message: 'Request failed' };
        }

        if (!receiverDetails) {
            return { status: false, message: "Receiver not found!" };
        }
        let ref = 'rq_' + Date.now().toString();

        let objReq = {
            reference_id: ref,
            type: 'payment_request',
            service_type: 'wallet_to_wallet',
            status: 'pending',
            purpose: purpose,
            description: description,
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount,
            wallet_id: senderWallet.wallet_id,
            wallet: senderWallet._id,
            sender: senderWallet.account._id,
            receiver: receiverDetails._id,
            attachments: files,
        }

        const requestDetails = await RequestPaymentModel.create(objReq);
        if (requestDetails) {
            const notificationObj = {
                title: 'Payment Request Notification',
                desc: 'You have received a Payment Request.',
                type: 'payment_request',
                status: 'unread',
                from: senderWallet.account._id,
                to: receiverDetails._id,
                link_id: requestDetails._id,
            }
            addNotification(notificationObj)
            // socket message
            sendPrivateMessage(receiverDetails._id, "You have received a Payment Request.")
            console.log(senderDetails.user)
            console.log(receiverDetails.user)

            const sender_name = senderDetails?.user ?
                senderDetails?.user?.first_name + " " + senderDetails?.user?.last_name :
                senderDetails?.company?.company_name
            const receiver_name = receiverDetails.user ?
                receiverDetails.user?.first_name + " " + receiverDetails.user?.last_name :
                receiverDetails?.company?.company_name

            const sendingCurrency = senderWallet?.currency?.code;

            const receiverCurrency = senderWallet?.currency?.code;

            const senderOptions = {
                toEmail: senderDetails?.email ?? "",
                phoneNumber: senderDetails?.phone ?? "",
                instaUsername: senderDetails?.insta_username ?? "",
                message: `Hi, you have sent a payment request ${formattedAmount(amount)} ${receiverCurrency} to ${receiver_name}`,
                subject: "You have sent a payment request!",
                templateId: "d-2d5f929ed89847d693ab15621b95890f",
                phoneMessage: `You have sent a payment request ${formattedAmount(amount)} ${receiverCurrency} to ${receiver_name}`
            }
            const receiverOptions = {
                toEmail: receiverDetails?.email ?? "",
                phoneNumber: receiverDetails?.phone ?? "",
                instaUsername: receiverDetails?.insta_username ?? "",
                message: `You have received a payment request of ${formattedAmount(amount)} ${sendingCurrency} from ${sender_name}`,
                subject: "You have received a payment request",
                templateId: "d-2d5f929ed89847d693ab15621b95890f",
                phoneMessage: `You have received a payment request of ${formattedAmount(amount)} ${sendingCurrency} from ${sender_name}`
            }

            // email, phone and push notifications

            // console.log("optionstest", senderOptions, receiverOptions)

            sendNotifications(senderWallet?.account?._id, 'payment_requests', senderOptions)
            sendNotifications(receiverDetails?._id, 'payment_requests', receiverOptions)

            console.log(receiverDetails?.insta_recipient_id, "instarecipientid")

            if (receiverDetails?.insta_recipient_id && receiverDetails?.insta_bot) {
                const subtitle = `
Request ID: ${requestDetails?.reference_id || "N/A"}
Sender Name: ${senderWallet?.account?.username}
Amount: ${formattedAmount(amount)} ${sendingCurrency}
Country: ${senderWallet?.account.country_name}
`
                const templatePayload = {
                    template_type: "generic",
                    elements: [
                        {
                            title: `You've Received a Payment Request from ${sender_name}.`,
                            subtitle,
                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Send%20Money.png",

                            buttons: [
                                {
                                    type: "postback",
                                    title: "Accept",
                                    payload: `accept_req_pay-${requestDetails?._id}`,
                                },
                                {
                                    type: "postback",
                                    title: "Decline",
                                    payload: `decline_req_pay-${requestDetails?._id}`,
                                },
                                {
                                    type: "postback",
                                    title: "Main Menu",
                                    payload: "main_menu",
                                },

                            ],
                        },
                    ]
                };
                const data = {
                    sender: { id: receiverDetails?.insta_recipient_id?.recipient },
                };
                console.log(data, "datainsendtemplate")
                await sendTemplate(data, receiverDetails?.insta_recipient_id?.recipient, templatePayload, "4");

                if (files?.length > 0 || description) {

                    const message = `
Attached are details with the payment request 👇

${description ? "Note: " + description : ""}
`

                    await quickMessage(data, message, "CONFIRMED_EVENT_UPDATE");

                    if (files?.length > 0) {

                        const attachments = files;

                        await sendMultipleImages(attachments, receiverDetails?.insta_recipient_id?.recipient);

                    }

                }


            }

            return { status: true, message: 'success', requestDetails };

        }
        else {
            return { status: false, message: 'Request failed' };
        }
    } catch (err) {
        console.log(err);
        return { status: false, message: 'Request failed' };

    }
}

function formatDigit(number) {
    // Add leading zero if the number is less than 10 and doesn't already contain a leading zero
    return number < 10 && number.toString().length === 1 ? '0' + number : number;
}


const checkSchedules = async () => {
    const countries = await Country.find({ status: "active" });

    const countriesIso = countries.map((country) => {
        return country.country_iso_code
    })

    // fetching iso2_code
    function filterJsonData(countries, jsonData) {
        const filteredData = {};
        countries.forEach(code => {
            if (jsonData.hasOwnProperty(code)) {
                filteredData[code] = jsonData[code];
            }
        });
        return filteredData;
    }

    const filteredJsonData = filterJsonData(countriesIso, countries_iso2);

    function getSchedules(filteredJsonData) {
        const schedules = [];
        for (const countryCode in filteredJsonData) {
            const country = filteredJsonData[countryCode];
            const countryData = ct.getCountry(country);
            if (countryData) {
                const { id, name, timezones } = countryData;

                const schedule = '*/30 * * * * *';

                const scheduleObj = {
                    country: name,
                    timezones: timezones,
                    schedule: schedule
                };
                schedules.push(scheduleObj);
            }
        }
        return schedules;
    }

    const schedules = getSchedules(filteredJsonData);
    // console.log(schedules, "schedules");

    async function sendScheduledMessage(schedule) {
        const { country, timezones } = schedule;
        // const currentTime = moment().format();

        for (const timezone of timezones) {
            // console.log(timezone, "timezone");
            const currentTime = moment.tz(timezone).format();
            // console.log(currentTime, "currentTime");
            const schedules = await Schedule.find({
                timezone,
                status: "processing",
                $or: [
                    { type: { $ne: "payment" } },  // if type is not "payment", no need to check reserved
                    { type: "payment", reserved: true }  // if type is "payment", check reserved is true
                ]
            });
            schedules.forEach(async (record) => {
                if (record.recursive && record.nextCycles > 0) {
                    const { date, next_date, cycles, request_payment, nextCycles, type } = record;
                    // console.log(date, "date", next_date, "next_date", cycles, "cycles", payment, "request_payment");
                    // console.log(record, "record");
                    let date_used;

                    if (next_date) {
                        date_used = next_date
                    } else {
                        date_used = date
                    }
                    const [day, month, year] = date_used.split('-').map(Number);
                    const formattedDate = `${year}-${formatDigit(month)}-${formatDigit(day)}`;
                    const currentDate = moment().tz(timezone).format('YYYY-MM-DD');
                    const [day1, month1, year1] = date.split('-').map(Number);
                    const originalFormattedDate = `${year1}-${formatDigit(month1)}-${formatDigit(day1)}`;

                    // console.log(currentDate, "currentDate", formattedDate, "formattedDate", originalFormattedDate, "originalDate");

                    if (currentDate === formattedDate) {
                        if (type === "request") {
                            const data = {
                                amount: request_payment.amount,
                                wallet_id: request_payment.wallet,
                                purpose: request_payment?.purpose ?? "",
                                sender: request_payment.sender,
                                receiver: request_payment.receiver,
                                type: "subscribed",
                                description: request_payment.description ?? "",
                            };

                            const files = record?.attachments?.map(image => ({
                                key: image.key,
                                url: image.url,
                                ETag: image.ETag,
                            }));

                            const scheduleDetails = await requestPayment(data, files);
                            if (scheduleDetails.status) {
                                if (nextCycles - 1 === 0) {
                                    await Schedule.findOneAndUpdate({ _id: record._id }, { nextCycles: nextCycles - 1, status: "completed" });
                                } else {
                                    if (cycles === nextCycles) {

                                        const newDate = moment(originalFormattedDate).add(1, 'months').format('DD-MM-YYYY');
                                        await Schedule.findOneAndUpdate({ _id: record._id }, { $set: { nextCycles: nextCycles - 1, next_date: newDate } });
                                    } else {
                                        const newDate = moment(originalFormattedDate).add(cycles - nextCycles, 'months').format('DD-MM-YYYY');
                                        await Schedule.findOneAndUpdate({ _id: record._id }, { $set: { nextCycles: nextCycles - 1, next_date: newDate } });
                                    }
                                }
                            } else {
                                console.log("schedule failed");
                            }
                        } else if (type === "payment") {
                            let paymentDetails = record.payment;
                            let data = {
                                sender_wallet_id: paymentDetails.sender_wallet,
                                receiver_wallet_id: paymentDetails.reciever_wallet_id,
                                amount: paymentDetails.amount,
                                purpose: paymentDetails?.purpose,
                                service_type: 'wallet_to_wallet',
                                paymentDetails_type: 'wallet_to_wallet',
                                link_id: record._id,
                                type: 'subscription',
                                description: paymentDetails.description,
                                payment_type: "wallet_to_wallet"
                            }

                            const files = record?.attachments?.map(image => ({
                                key: image.key,
                                url: image.url,
                                ETag: image.ETag,
                                status: true
                            }));

                            console.log(data, "datainsidew2w", files);

                            const response = await walletToWalletTransactionHelper(data, req = {}, files)

                            if (response.status) {
                                if (nextCycles - 1 === 0) {
                                    await Schedule.findOneAndUpdate({ _id: record._id }, { nextCycles: nextCycles - 1, status: "completed" });
                                } else {
                                    if (cycles === nextCycles) {

                                        const newDate = moment(originalFormattedDate).add(1, 'months').format('DD-MM-YYYY');
                                        await Schedule.findOneAndUpdate({ _id: record._id }, { $set: { nextCycles: nextCycles - 1, next_date: newDate } });
                                    } else {
                                        const newDate = moment(originalFormattedDate).add(cycles - nextCycles, 'months').format('DD-MM-YYYY');
                                        await Schedule.findOneAndUpdate({ _id: record._id }, { $set: { nextCycles: nextCycles - 1, next_date: newDate } });
                                    }
                                }
                            }


                        }

                    }
                } else if (!record.recursive) {
                    // console.log("unrecursive_record", record);
                    const { date, time } = record;
                    const [day, month, year] = date.split('-').map(Number);
                    // console.log(time, "time", date, year, month, day);
                    // console.log(record, "record");
                    const [timeString, ampm] = time.split(' '); // Extracting time string and AM/PM indicator

                    let [hour, minute] = timeString.split(':').map(Number);

                    // let [hour, minute] = timeString.split(':').map(Number);

                    // console.log(hour, "hours")

                    // Converting to 24-hour format if time is PM
                    const isPM = time.includes('PM');

                    // Converting to 24-hour format if time is PM and not 12:00 PM
                    if (isPM && hour !== 12) {
                        hour += 12;
                    }

                    // Adjusting hour for midnight (12:-- AM)
                    if (hour === 12 && !isPM) {
                        hour = 0;
                    }





                    // console.log("Record Date:", date, timeString);
                    // console.log("Parsed Date:", year, month, day);
                    // console.log("Time:", time);
                    // console.log("Parsed Time:", hour, minute);
                    // console.log("Timezone:", timezone);
                    // console.log("Current Time:", currentTime);


                    // console.log(hour, "hour", minute, "minute", ampm, "ampm", year, "year", month, "month", day, "day", timezone, "timezone");
                    //YYYY-MM-DD HH:mm
                    // const scheduleTime = moment.tz(`${ year } -${ month } -${ day } ${ hour }:${ minute } `, timezone).format();
                    // console.log("scheduleTime", `${ year } -0${ month } -${ day } ${ hour }:${ minute } `, timezone, "timezone");
                    const dateAndTime = `${year}-${formatDigit(month)}-${formatDigit(day)} ${formatDigit(hour)}:${formatDigit(minute)}`;
                    var scheduleTime = moment.tz(dateAndTime, timezone).format();

                    // console.log(currentTime, "currentTime", scheduleTime, "scheduleTime");
                    if (moment(scheduleTime, 'YYYY-MM-DD HH:mm').isValid()) {

                        if (currentTime >= scheduleTime) {

                            if (record.type === "request") {
                                const requestDetails = record.request_payment;
                                console.log(requestDetails, "requestDetails", record);
                                const data = {
                                    amount: requestDetails.amount,
                                    wallet_id: requestDetails.wallet,
                                    purpose: requestDetails?.purpose ?? "",
                                    sender: requestDetails.sender,
                                    receiver: requestDetails.receiver,
                                    type: 'scheduled',
                                    description: requestDetails.description ?? "",
                                };

                                const files = record?.attachments.map(image => ({
                                    key: image.key,
                                    url: image.url,
                                    ETag: image.ETag,
                                }));

                                console.log("i ran with asdl lol", data, files)
                                const scheduleDetails = await requestPayment(data, files);
                                console.log(scheduleDetails, "scheduleDetails")
                                if (scheduleDetails.status) {
                                    await Schedule.findOneAndUpdate({ _id: record._id }, { status: "completed" });
                                } else {
                                    console.log("schedule failed");
                                }
                                console.log(`Sending scheduled message for ${country} at ${scheduleTime} (Current time: ${currentTime})`);

                            } else if (record.type === "payment") {

                                let paymentDetails = record.payment;
                                console.log(paymentDetails, "paymentDetails");
                                let data = {
                                    sender_wallet_id: paymentDetails.sender_wallet,
                                    receiver_wallet_id: paymentDetails.reciever_wallet_id,
                                    amount: paymentDetails.amount,
                                    purpose: paymentDetails?.purpose,
                                    service_type: 'wallet_to_wallet',
                                    payment_type: 'wallet_to_wallet',
                                    link_id: record._id,
                                    type: 'schedule',
                                    description: paymentDetails.description,
                                    transaction_type: "payment"
                                }

                                const files = record?.attachments?.map(image => ({
                                    key: image.key,
                                    url: image.url,
                                    ETag: image.ETag,
                                    status: true
                                }));

                                console.log(data, "datainsidew2wschedule");

                                const response = await walletToWalletTransactionHelper(data, req = {}, files)

                                if (response.status) {
                                    await Schedule.findOneAndUpdate({ _id: record._id }, { status: "completed" });
                                } else {
                                    console.log("schedule failed");
                                }
                                console.log(`Sending scheduled message for w2w ${country} at ${scheduleTime} (Current time: ${currentTime})`);
                            }
                        }
                    }
                    else {
                        // console.log("Invalid schedule time:", scheduleTime);
                    }
                }
            });

        }
    }

    schedules.forEach(schedule => {
        cron.schedule(schedule.schedule, () => {
            sendScheduledMessage(schedule);
        });
    });

    // console.log('Scheduled messages for multiple countries.');
}

async function resetAccountValues() {
    try {
        // console.log("reset account values ran")
        const currentDate = moment();

        const activeAccounts = await Account.find().populate('level');

        activeAccounts.forEach(async (account) => {

            const timezone = account.timezone;
            // const dailySendingLimit = account.level.daily_sending_limit;
            // const monthlySendingLimit = account.level.monthly_sending_limit;
            // const yearlySendingLimit = account.level.yearly_sending_limit;

            // const dailyReceivingLimit = account.level.daily_receiving_limit;
            // const monthlyReceivingLimit = account.level.monthly_receiving_limit;
            // const yearlyReceivingLimit = account.level.yearly_receiving_limit;


            // const dailyTransactionCount = account.level.daily_transaction_count;
            // const monthlyTransactionCount = account.level.monthly_transaction_count;
            // const yearlyTransactionCount = account.level.yearly_transaction_count;

            // console.log("timezone", timezone, "dailySendingLimit", dailySendingLimit, "monthlySendingLimit", monthlySendingLimit, "yearlySendingLimit", yearlySendingLimit)

            if (timezone) {
                const currentDateInTimezone = moment.tz(currentDate, timezone);

                // console.log(currentDateInTimezone, currentDateInTimezone.hours(), currentDateInTimezone.minutes(), currentDateInTimezone.date(), currentDateInTimezone.month(), "currentDateInTimezone")

                // if a day is passed
                if (currentDateInTimezone.hours() === 0 && currentDateInTimezone.minutes() === 0) {
                    await Account.findOneAndUpdate(
                        { _id: account._id },
                        {
                            $set: {
                                'used_limits.daily_sending_limit': 0,
                                'used_limits.daily_receiving_limit': 0,
                                'used_limits.daily_transaction_count': 0
                            }
                        }


                    );
                }

                // a month is passed
                if (currentDateInTimezone.date() === 1 && currentDateInTimezone.hours() === 0 && currentDateInTimezone.minutes() === 0) {
                    await Account.findOneAndUpdate(
                        { _id: account._id },
                        {
                            $set: {
                                'used_limits.monthly_sending_limit': 0,
                                'used_limits.monthly_receiving_limit': 0,
                                'used_limits.monthly_transaction_count': 0
                            }
                        }
                    );
                }

                // year is passed
                if (currentDateInTimezone.month() === 0 && currentDateInTimezone.date() === 1 && currentDateInTimezone.hours() === 0 && currentDateInTimezone.minutes() === 0) {
                    await Account.findOneAndUpdate(
                        { _id: account._id },
                        {
                            $set: {
                                'used_limits.yearly_sending_limit': 0,
                                'used_limits.yearly_receiving_limit': 0,
                                'used_limits.yearly_transaction_count': 0
                            }
                        }
                    );
                }
            }
        });
    } catch (error) {
        console.error('Error resetting account values:', error);
    }
}

async function expireLiveBotChats() {
    // getting the bots in which live chat is active and checking it has been exceeded more than 15 minutes
    const currentTime = new Date();

    const currentTimeMinus15 = new Date(currentTime.getTime() - 15 * 60 * 1000);

    const expiredChats = await InstaChatbotModel.find({
        live_chat: true,
        live_chat_until: { $lt: currentTimeMinus15 }
    });

    // console.log("expiredChats", expiredChats)

    for (const chat of expiredChats) {
        try {

            chat.live_chat = false
            await chat.save()
            const data = {
                sender: { id: chat?.recipient },
            }

            const quickReplies = [
                {
                    content_type: 'text',
                    title: 'Open Live Chat',
                    payload: 'live_chat',
                },
                {
                    content_type: "text",
                    title: "Main Menu",
                    payload: "main_menu"
                }
            ];

            await quickReply(data, 'Your live chat session has been expired. Please, click below to open it again.', quickReplies);
        } catch (err) {
            console.log("rrror expiring live chat", err)
        }
    }
}

cron.schedule('*/30 * * * * *', () => {
    resetAccountValues();
    expireLiveBotChats();
});

module.exports = { checkSchedules }