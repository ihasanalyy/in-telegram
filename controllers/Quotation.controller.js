const { encryption, decryption } = require('../configurations/Encryption')
const axios = require('axios');
const moment = require('moment');

const Quotation = require('../models/Quotation.model');
const Account = require('../models/Account.model')
const Wallet = require('../models/Wallet.model');
const Transaction = require('../models/Transaction.model');
const Fee = require('../models/Fee.model');
const User = require('../models/User.model')
const AWS = require('aws-sdk');
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();
const multer = require('multer');
const { addNotification } = require('../utils/generateNotification');
const { sendPrivateMessage } = require('../utils/websocket');
const { sendNotifications } = require('../utils/sendEmail');
const { quickMessage, quickReply, sendTemplate } = require('./InstaChatbot.controller');
const { walletToWalletTransactionHelper, getTemplateId } = require('../utils/helpers');
const { formattedAmount } = require('../utils/InstaChatbotHelpers');

const storage = multer.memoryStorage();
module.exports.uploadCheck = multer({ storage: storage });
module.exports.uploadDocumentsCheck = multer({
    storage,
    limits: { fileSize: 2000000 },
});

async function exchangeRateApi(from, to, amount, level_id, type) {
    try {
        let fee = 0;
        // let from = req.query.from;
        // let to = req.query.to;
        // let type = req.query.type;
        // let level_id = req.query.level_id;
        // let amount = req.query.amount;
        if (!to || !from || !type || !level_id || !amount) {
            return null;
        }
        console.log(from, to, amount, level_id, type);
        let feeDetails = await Fee.findOne({ $and: [{ service_name: type }, { account_level: level_id }] })
        if (feeDetails) {
            let exchangeRate = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`)
            if (exchangeRate.data.success) {
                let newRate = exchangeRate.data.info.rate //+ (exchangeRate.data.info.rate * (additional / 100))
                let exchangedAmount = newRate * amount;
                exchangeRate.data['new_rate'] = newRate;
                exchangeRate.data['exchanged_amount'] = exchangedAmount;
                let fee_currency = feeDetails ? feeDetails.fee_currency : 'USD'
                if (feeDetails) {
                    if (feeDetails.fee_type == 'flat') { fee = feeDetails.flat_fee }
                    else { fee = amount * (feeDetails.percentage_fee / 100) }
                }
                let feeExchange = await getExchangeRatesToUSD(fee_currency, from, fee)
                // console.log(feeDetails);
                exchangeRate.data['fee'] = {
                    fee_type: feeDetails.fee_type,
                    exchange_fee: feeExchange,
                    fee: fee,
                    currency: from
                }
                return exchangeRate.data;
            } else {
                return null;
            }
        } else {
            return null;
        }
    } catch (err) {
        console.log(err);
        return null;
    }
}

async function getExchangeRatesToUSD(from, to, amount) {
    try {
        if (to != from) {
            let exchangeRate = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`)
            if (exchangeRate.data.success) {
                let rate = exchangeRate.data.result;
                // console.log(rate);
                return rate;
            } else {
                return null;
            }
        } else {
            return amount;
        }
    } catch (err) {
        // console.log(err);
        return amount;
    }
}

module.exports.quotationByReciever = async (req, res) => {
    try {

        const reciever_id = req.params.reciever_id

        if (!reciever_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            })
            return res.status(400).send(error)
        }

        const user = await User.findOne({ account: reciever_id });

        Account.findOne({ $and: [{ _id: reciever_id }, { active: true }] }).then(async (account) => {
            if (!account) {
                let error = await encryption({
                    status: false,
                    message: "Reciever not found!"
                })
                return res.status(400).send(error)
            } else {
                Quotation.find({ $and: [{ reciever: reciever_id }] }).populate([
                    {
                        path: 'sender',
                        select: 'user company account_type username',
                        populate: [
                            {
                                path: 'user',
                                model: 'user',
                                select: 'first_name last_name'
                            },
                            {
                                path: 'company',
                                model: 'company',
                                select: 'company_name '
                            }
                        ]
                    },
                    // {
                    //     path: 'reciever',
                    //     select: 'user company account_type username',
                    //     populate: [
                    //         {
                    //             path: 'user',
                    //             model: 'user',
                    //             select: 'first_name last_name'
                    //         },
                    //         {
                    //             path: 'company',
                    //             model: 'company',
                    //             select: 'company_name '
                    //         }
                    //     ]
                    // },
                    {
                        path: 'amount_sender_currency',
                        select: 'currency',

                    },
                    {
                        path: 'amount_reciever_currency',
                        select: 'currency',

                    }
                ]).then(async (quotation) => {
                    if (!quotation) {
                        let error = await encryption({
                            status: false,
                            message: "Quotation not found for this reciever"
                        })
                        return res.status(400).send(error)
                    } else {
                        let ciphertext = await encryption({
                            status: true,
                            message: "Quotation found!",
                            quotation,
                            receiver: {
                                account_type: account.account_type,
                                first_name: user.first_name,
                                last_name: user.last_name,
                            }
                        })
                        return res.status(200).send(ciphertext)
                    }
                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while getting quotation"
                    });
                    res.status(500).send(error);
                });
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details"
            });
            res.status(500).send(error);
        });
    }
    catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!",
        });
        res.status(500).send(error);
    }
}

module.exports.quotationBySender = async (req, res) => {
    try {
        const sender_id = req.params.sender_id

        if (!sender_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            })
            return res.status(400).send(error)
        }

        const user = await User.findOne({ account: sender_id });


        Account.findOne({ $and: [{ _id: sender_id }, { active: true }] }).then(async (account) => {
            if (!account) {
                let error = await encryption({
                    status: false,
                    message: "Reciever not found!"
                })
                return res.status(400).send(error)
            } else {
                Quotation.find({ $and: [{ sender: sender_id }] })
                    .populate([
                        // {
                        //     path: 'sender',
                        //     select: 'user company account_type username',
                        //     populate: [
                        //         {
                        //             path: 'user',
                        //             model: 'user',
                        //             select: 'first_name last_name'
                        //         },
                        //         {
                        //             path: 'company',
                        //             model: 'company',
                        //             select: 'company_name '
                        //         }
                        //     ]
                        // },
                        {
                            path: 'reciever',
                            select: 'user company account_type username',
                            populate: [
                                {
                                    path: 'user',
                                    model: 'user',
                                    select: 'first_name last_name'
                                },
                                {
                                    path: 'company',
                                    model: 'company',
                                    select: 'company_name '
                                }
                            ]
                        },
                        {
                            path: 'amount_sender_currency',
                            select: 'currency',

                        },
                        {
                            path: 'amount_reciever_currency',
                            select: 'currency',

                        }
                    ]).then(async (quotation) => {
                        if (!quotation) {
                            let error = await encryption({
                                status: false,
                                message: "Quotation not found for this reciever"
                            })
                            return res.status(400).send(error)
                        } else {
                            let ciphertext = await encryption({
                                status: true,
                                message: "Quotation found!",
                                quotation,
                                sender: {
                                    account_type: account.account_type,
                                    first_name: user.first_name,
                                    last_name: user.last_name,
                                }
                            })
                            return res.status(200).send(ciphertext)
                        }
                    }).catch(async (err) => {
                        console.log(err)

                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while getting quotation"
                        });
                        res.status(500).send(error);
                    });
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details"
            });
            res.status(500).send(error);
        });
    }
    catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!",
        });
        res.status(500).send(error);
    }
}

module.exports.createQuotation = async (req, res) => {
    try {
        // let data = await decryption(req.body.data)
        const { account_id, reciever_id, title, desc, amount, bargain, sender_wallet_id } = req.body;
        console.log(account_id, reciever_id, sender_wallet_id, req.body, "consolecheck", req.files)


        if (req.files.length > 5) {
            let error = await encryption({
                status: false,
                message: "Your images limit is exceeded!"
            })
            return res.status(400).send(error)
        }
        if (!account_id || !reciever_id || !title || !desc || !amount || bargain === undefined || !sender_wallet_id) {
            let error = await encryption({
                status: false,
                message: "Required field are missing!"
            })
            return res.status(400).send(error)
        }

        if (account_id === reciever_id) {
            let error = await encryption({
                status: false,
                message: "You can't send quotation to yourself!"
            })
            return res.status(400).send(error)
        }

        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).populate('user').populate('company').then(async (user) => {
            if (!user) {
                let error = await encryption({
                    status: false,
                    message: "User not found!"
                })
                return res.status(500).send(error)
            } else {
                Wallet.findById(sender_wallet_id).then(async (wallet) => {
                    if (!wallet) {
                        let error = await encryption({
                            status: false,
                            message: "Sender wallet not found!"
                        })
                        return res.status(500).send(error)
                    } else {
                        const newQuotation = new Quotation({
                            reference_id: 'qa_' + Date.now().toString(),
                            title,
                            desc,
                            amount,
                            bargain,
                            sender: account_id,
                            reciever: reciever_id,
                            amount_reciever_currency: sender_wallet_id,
                            status: "sent",
                            images: []
                        });

                        const bucketName = process.env.AWS_BUCKET_NAME;

                        for (const file of req.files) {
                            if (file.mimetype.split("/")[0] === "image") {
                                const params = {
                                    Bucket: bucketName,
                                    Key: `quotations/${user._id}/${file.originalname}`,
                                    Body: file.buffer
                                };

                                const uploadResult = await s3.upload(params).promise();

                                if (uploadResult?.key) {
                                    newQuotation.images.push({
                                        key: uploadResult.Key,
                                        url: uploadResult.Location,
                                        ETag: uploadResult.ETag
                                    });
                                }
                            }
                            else {
                                let error = await encryption({
                                    status: false,
                                    message: "Please provide image files",

                                });
                                return res.status(400).send(error);
                            }
                        }

                        // instachatbot notification


                        sendPrivateMessage(reciever_id, "Quotation created succesfully")

                        newQuotation.save()
                            .then(async (quotation) => {
                                if (quotation) {
                                    const receiver = await Account.findOne({ $and: [{ _id: reciever_id }, { active: true }] }).populate('user').populate('company').populate('insta_recipient_id');
                                    console.log(receiver, "receivertest")

                                    const notificationObj = {
                                        title: 'Quotation Notification',
                                        desc: 'Quotation has been created',
                                        type: 'quotation',
                                        status: 'unread',
                                        from: account_id,
                                        to: reciever_id,
                                        link_id: quotation._id,
                                    }

                                    addNotification(notificationObj)

                                    if (user?.user && receiver?.user) {

                                        const sender_name = user?.user ?
                                            user?.user?.first_name + " " + user?.user?.last_name :
                                            user?.company?.company_name
                                        const receiver_name = receiver.user ?
                                            receiver?.user?.first_name + " " + receiver?.user?.last_name :
                                            receiver?.company?.company_name

                                        // const senderOptions = {
                                        //     toEmail: user?.email ?? "",
                                        //     phoneNumber: user?.phone ?? "",
                                        //     instaUsername: user?.insta_username ?? "",
                                        //     message: `Hi, you have successfully created a quotation of ${amount} ${wallet.currency.code} to ${receiver_name}`,
                                        //     subject: "You have sent a quotation in your Instapay Account!",
                                        //     templateId: "d-2d5f929ed89847d693ab15621b95890f",
                                        //     phoneMessage: `Quotation amount sent of ${amount} ${wallet.currency.code} to ${receiver_name}`
                                        // }
                                        // const receiverOptions = {
                                        //     toEmail: receiver?.email ?? "",
                                        //     phoneNumber: receiver?.phone ?? "",
                                        //     instaUsername: receiver?.insta_username ?? "",
                                        //     message: `Hi, you have successfully received a quotation of ${amount} ${wallet.currency.code} from ${sender_name}`,
                                        //     subject: "You have received a quotation in your Instapay Account!",
                                        //     templateId: "d-2d5f929ed89847d693ab15621b95890f",
                                        //     phoneMessage: `Quotation recieved of ${amount} ${wallet.currency.code} from ${sender_name}`
                                        // }

                                        const quotationSendLanguage = 'english';
                                        const quotationSendtemplateName = 'Send quotation';

                                        const date = new Date();
                                        const formattedDate = moment(date).format('YYYY-MM-DD');

                                        const templateIdSending = getTemplateId(quotationSendLanguage, quotationSendtemplateName);

                                        const quotationReceiverLanguage = 'english';
                                        const quotationReceivertemplateName = 'Recieved quotation';

                                        const templateIdReceiving = getTemplateId(quotationReceiverLanguage, quotationReceivertemplateName);

                                        const dynamicDataSending = {
                                            quote_id: quotation._id,
                                            client_name: receiver_name,
                                            date_sent: formattedDate,
                                            total_amount: `${amount} ${wallet.currency.code}`,
                                            bargaining_status: bargain ? "Yes" : "No",
                                            service_description: desc || "N/A"
                                        };

                                        const dynamicDataReceiving = {
                                            quote_id: quotation._id,
                                            sender_name: sender_name,
                                            date_sent: formattedDate,
                                            total_amount: `${amount} ${wallet.currency.code}`,
                                            bargaining_status: bargain ? "Yes" : "No",
                                            service_description: desc || "N/A"
                                        }

                                        const sendingDetails = {
                                            toEmail: user.email,
                                            message: "Quotation Message",
                                            subject: "Quotation Subject",
                                            templateId: templateIdSending,
                                            phoneNumber: user.phone,
                                            phoneMessage: `Quotation amount sent of ${amount} ${wallet.currency.code} to ${receiver_name}`,
                                            dynamicData: dynamicDataSending
                                        }

                                        const receiverDetails = {
                                            toEmail: receiver.email,
                                            message: "Quotation Message",
                                            subject: "Quotation Subject",
                                            templateId: templateIdReceiving,
                                            phoneNumber: receiver.phone,
                                            phoneMessage: `Quotation recieved of ${amount} ${wallet.currency.code} from ${sender_name}`,
                                            dynamicData: dynamicDataReceiving
                                        }

                                        // email, phone and push notifications
                                        sendNotifications(account_id, 'quotation', sendingDetails)
                                        sendNotifications(reciever_id, 'quotation', receiverDetails)
                                    }

                                    // if instagram bot is enabled
                                    if (user?.insta_bot && user?.insta_recipient_id) {
                                        const data1 = {
                                            sender: { id: receiver?.insta_recipient_id?.recipient }
                                        }
                                        console.log(receiver, receiver?.insta_recipient_id?.recipient)
                                        const walletDetails = await Wallet.findById(quotation?.amount_reciever_currency)


                                        const buttons = [
                                            {
                                                type: "postback",
                                                title: 'Accept',
                                                payload: `accept_quot-${quotation?._id}`,
                                            },
                                            {
                                                type: "postback",
                                                title: 'Decline',
                                                payload: `decline_quot-${quotation?._id}`,
                                            },

                                            {
                                                type: "postback",
                                                title: 'Main menu',
                                                payload: "main_menu",
                                            },
                                        ];
                                        if (quotation?.bargain) {
                                            buttons.pop()
                                            buttons.push({
                                                type: "postback",
                                                title: 'Bargain',
                                                payload: `bargain_quot-${quotation?._id}`,
                                            },)
                                        }
                                        const templatePayload = {
                                            template_type: "generic",
                                            elements: [
                                                {
                                                    title: `A quotation has been created for you from ${user?.username}`,
                                                    subtitle: `Title: ${quotation?.title}.
Description: ${quotation?.desc}.
Amount: ${walletDetails?.currency?.symbol}${formattedAmount(quotation?.amount)}
Bargain: ${quotation?.bargain ? 'Allowed' : 'Not allowed'}
                                                `,

                                                    buttons,
                                                },
                                            ]
                                        };
                                        await sendTemplate(data1, receiver?.insta_recipient_id?.recipient, templatePayload)
                                    }
                                    let ciphertext = await encryption({
                                        status: true,
                                        message: "Quotation created successfully",
                                        quotation
                                    });
                                    res.status(200).send(ciphertext);

                                }
                            })
                            .catch(async (err) => {
                                console.log(err)
                                let error = await encryption({
                                    status: false,
                                    message: "Error while creating quotation"
                                });
                                res.status(500).send(error);
                            });
                    }
                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Error while finding sender wallet!"
                    });
                    res.status(500).send(error);
                });

            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details"
            });
            res.status(500).send(error);
        });
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!",
        });
        res.status(500).send(error);
    }
};

module.exports.bargain = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        const { revised_amount, quotation_id } = data
        Quotation.findOne({ $and: [{ _id: quotation_id }, { bargain: true }] })
            .populate({ path: 'sender', populate: [{ path: 'user', select: 'first_name last_name' }, { path: 'insta_recipient_id' }] })
            .populate({ path: 'reciever', populate: [{ path: 'user', select: 'first_name last_name' }, { path: 'insta_recipient_id' }] })
            .populate('amount_sender_currency')
            .populate('amount_reciever_currency')
            .then(async (quotation) => {
                if (!quotation) {
                    let error = await encryption({
                        status: false,
                        message: "Quotation not found!",
                    });
                    res.status(400).send(error);
                } else {
                    quotation.revised_amount = revised_amount;
                    quotation.status = "bargain";
                    quotation.save().then(async (updatedQuotation) => {
                        const notificationObj = {
                            title: 'Quotation Notification',
                            desc: 'Bargain amount has been added',
                            type: 'quotation',
                            status: 'unread',
                            from: quotation.reciever,
                            to: quotation.sender,
                            link_id: quotation._id
                        }

                        addNotification(notificationObj)
                        sendPrivateMessage(quotation.sender, "Bargain amount has been added!")

                        if (quotation?.sender?.user && quotation?.reciever?.user) {

                            // const receiver = await Account.findOne({ $and: [{ _id: quotation.sender }, { active: true }] }).populate('user').populate('company');
                            // const sender = await Account.findOne({ $and: [{ _id: quotation.reciever }, { active: true }] }).populate('user').populate('company');

                            const sender_name = quotation?.sender?.user ?
                                quotation?.sender?.user.first_name + " " + quotation?.sender?.user?.last_name :
                                quotation?.sender?.company?.company_name
                            const receiver_name = quotation?.reciever?.user ?
                                quotation?.reciever?.user?.first_name + " " + quotation?.reciever?.user?.last_name :
                                quotation?.reciever?.company?.company_name
                            const sendingCurrency = quotation?.amount_reciever_currency?.currency.code;

                            const receiverCurrency = quotation?.amount_reciever_currency?.currency.code;

                            // const senderOptions = {
                            //     toEmail: quotation?.reciever?.email ?? "",
                            //     phoneNumber: quotation?.reciever?.phone ?? "",
                            //     instaUsername: quotation?.reciever?.insta_username ?? "",
                            //     message: `Hi, you have successfully entered a bargaining amount of ${formattedAmount(revised_amount)} ${sendingCurrency} to ${sender_name}`,
                            //     subject: "You have sent a bargaining amount!",
                            //     templateId: "d-2d5f929ed89847d693ab15621b95890f",
                            //     phoneMessage: `You have requested a bargaining amount of ${formattedAmount(revised_amount)} ${sendingCurrency} to ${sender_name}`
                            // }
                            // const receiverOptions = {
                            //     toEmail: quotation?.sender?.email ?? "",
                            //     phoneNumber: quotation?.sender?.phone ?? "",
                            //     instaUsername: quotation?.sender?.insta_username ?? "",
                            //     message: `Hi, you have been requested a bargained amount of ${formattedAmount(revised_amount)} ${receiverCurrency} from ${receiver_name}`,
                            //     subject: "You have been requested a bargained amount in your Instapay Account!",
                            //     templateId: "d-2d5f929ed89847d693ab15621b95890f",
                            //     phoneMessage: `You have been requested a bargained amount of ${formattedAmount(revised_amount)} ${receiverCurrency} from ${receiver_name}`
                            // }

                            const quotationSendLanguage = 'english';
                            const quotationSendtemplateName = 'Request bargained amount';

                            const date = new Date();
                            const formattedDate = moment(date).format('YYYY-MM-DD');

                            const templateIdSending = getTemplateId(quotationSendLanguage, quotationSendtemplateName);

                            const quotationReceiverLanguage = 'english';
                            const quotationReceivertemplateName = 'Bargained amount request received';

                            const templateIdReceiving = getTemplateId(quotationReceiverLanguage, quotationReceivertemplateName);

                            const dynamicDataSending = {
                                quote_id: quotation._id,
                                sender_name: receiver_name,
                                date_submitted: formattedDate,
                                new_amount: `${formattedAmount(revised_amount)} ${receiverCurrency}`,
                                orignal_amount: `${formattedAmount(quotation.amount)} ${receiverCurrency}`,
                                service_description: quotation.desc || "N/A"
                            };

                            const dynamicDataReceiving = {
                                quote_id: quotation._id,
                                receiver_name: sender_name,
                                date_counteroffered: formattedDate,
                                new_amount: `${formattedAmount(revised_amount)} ${receiverCurrency}`,
                                original_amount: `${formattedAmount(quotation.amount)} ${receiverCurrency}`,
                                service_description: quotation.desc || "N/A"
                            }

                            const sendingDetails = {
                                toEmail: quotation?.reciever?.email,
                                message: "Bargain Message",
                                subject: "Bargain Subject",
                                templateId: templateIdSending,
                                phoneNumber: quotation?.reciever?.phone,
                                phoneMessage: `You have requested a bargaining amount of ${formattedAmount(revised_amount)} ${sendingCurrency} to ${sender_name}`,
                                dynamicData: dynamicDataSending
                            }

                            const receiverDetails = {
                                toEmail: quotation?.sender?.email,
                                message: "Bargain Message",
                                subject: "Bargain Subject",
                                templateId: templateIdReceiving,
                                phoneNumber: quotation?.sender.phone,
                                phoneMessage: `You have been requested a bargained amount of ${formattedAmount(revised_amount)} ${receiverCurrency} from ${receiver_name}`,
                                dynamicData: dynamicDataReceiving
                            }

                            // email, phone and push notifications
                            sendNotifications(quotation?.reciever._id, 'quotation', sendingDetails)
                            sendNotifications(quotation?.sender._id, 'quotation', receiverDetails)

                        }
                        // instachatbot message
                        if (quotation?.sender?.insta_bot && quotation?.sender?.insta_recipient_id) {
                            const data = {
                                sender: { id: quotation?.sender?.insta_recipient_id?.recipient },
                            }
                            const currencyDetails = await Wallet.findById(quotation?.amount_reciever_currency)

                            const quotationInfo = `
Title: ${quotation?.title}
Description: ${quotation?.desc}
Bargaining amount: ${currencyDetails?.currency.symbol}${formattedAmount(quotation?.revised_amount)}
Status: ${quotation?.status}
                                `
                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: `A bargaining amount has been added for the quotation from ${quotation?.reciever?.user?.first_name} ${quotation?.reciever?.user?.last_name}.`,
                                        // image_url: benefAccount?.profileImage?.url,
                                        subtitle: quotationInfo,

                                        buttons: [
                                            {
                                                type: "postback",
                                                title: 'Accept',
                                                payload: `accept_new_amount-${quotation?._id}`,
                                            },
                                            {
                                                type: "postback",
                                                title: 'Revise Amount',
                                                payload: `revise_quot-${quotation?._id}`,
                                            },
                                            {
                                                type: "postback",
                                                title: 'Decline',
                                                payload: `decline_quot-${quotation?._id}`,
                                            },

                                        ]
                                    },
                                ]
                            };

                            await sendTemplate(data, data.sender?.id, templatePayload)
                        }

                        let ciphertext = await encryption({
                            status: true,
                            message: "Bargain amount added successfully",
                            quotation: updatedQuotation,
                        });
                        res.status(200).send(ciphertext);
                    })
                        .catch(async (err) => {
                            console.log(err);
                            let error = await encryption({
                                status: false,
                                message: "Error while updating quotation"
                            });
                            res.status(500).send(error);
                        });
                }
            }).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while getting the quotation!"
                })
                res.status(200).send(error)
            })


    }
    catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!",
        });
        res.status(500).send(error);
    }
};
module.exports.acceptBargain = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        const { quotation_id } = data;
        Quotation.findOne({ $and: [{ _id: quotation_id }, { bargain: true }, { status: 'bargain' }] })
            .populate({ path: 'sender', populate: [{ path: 'user', select: 'first_name last_name' }, { path: 'insta_recipient_id' }] })
            .populate({ path: 'reciever', populate: [{ path: 'user', select: 'first_name last_name' }, { path: 'insta_recipient_id' }] })
            .populate('amount_sender_currency')
            .populate('amount_reciever_currency')
            .then(async (quotation) => {
                if (!quotation) {
                    let error = await encryption({
                        status: false,
                        message: "Quotation not found!",
                    });
                    res.status(400).send(error);
                } else {
                    quotation.status = "bargain-accepted";
                    quotation.save().then(async (updatedQuotation) => {
                        const notificationObj = {
                            title: 'Quotation Notification',
                            desc: 'Bargained amount has been accepted',
                            type: 'quotation',
                            status: 'unread',
                            from: quotation.sender,
                            to: quotation.reciever,
                            link_id: quotation._id
                        };

                        addNotification(notificationObj);
                        sendPrivateMessage(quotation.reciever, "Your bargained amount has been accepted!");

                        if (quotation?.sender?.user && quotation?.reciever?.user) {
                            const sender_name = quotation?.sender?.user ?
                                quotation?.sender?.user.first_name + " " + quotation?.sender?.user?.last_name :
                                quotation?.sender?.company?.company_name;

                            const receiver_name = quotation?.reciever?.user ?
                                quotation?.reciever?.user?.first_name + " " + quotation?.reciever?.user?.last_name :
                                quotation?.reciever?.company?.company_name;

                            const receiverCurrency = quotation?.amount_reciever_currency?.currency.code;

                            const quotationSendLanguage = 'english';
                            const quotationSendtemplateName = 'Bargained amount accepted';

                            const date = new Date();
                            const formattedDate = moment(date).format('YYYY-MM-DD');

                            const templateIdSending = getTemplateId(quotationSendLanguage, quotationSendtemplateName);

                            const dynamicDataSending = {
                                quote_id: quotation._id,
                                sender_name: sender_name,
                                date_submitted: formattedDate,
                                accepted_amount: `${formattedAmount(quotation.revised_amount)} ${receiverCurrency}`,
                                orignal_amount: `${formattedAmount(quotation.amount)} ${receiverCurrency}`,
                                service_description: quotation.desc || "N/A"
                            };

                            const sendingDetails = {
                                toEmail: quotation?.sender?.email,
                                message: "Bargain Accepted Message",
                                subject: "Bargain Accepted",
                                templateId: templateIdSending,
                                phoneNumber: quotation?.sender?.phone,
                                phoneMessage: `The bargained amount of ${formattedAmount(quotation.revised_amount)} ${receiverCurrency} has been accepted by ${receiver_name}`,
                                dynamicData: dynamicDataSending
                            };

                            sendNotifications(quotation?.sender._id, 'quotation', sendingDetails);
                        }

                        // Insta chatbot message notification
                        if (quotation?.reciever?.insta_bot && quotation?.reciever?.insta_recipient_id) {
                            const data = {
                                sender: { id: quotation?.reciever?.insta_recipient_id?.recipient },
                            };
                            const currencyDetails = await Wallet.findById(quotation?.amount_reciever_currency);

                            const quotationInfo = `
Title: ${quotation?.title}
Description: ${quotation?.desc}
Accepted amount: ${currencyDetails?.currency.symbol}${formattedAmount(quotation?.revised_amount)}
Status: Bargain Accepted
                                `;
                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: `The bargaining amount has been accepted for the quotation from ${quotation?.sender?.user?.first_name} ${quotation?.sender?.user?.last_name}.`,
                                        subtitle: quotationInfo,
                                        buttons: [
                                            {
                                                type: "postback",
                                                title: 'View Quotation',
                                                payload: `view_quot_details-${quotation?._id}`,
                                            },
                                            {
                                                type: "postback",
                                                title: 'Accept',
                                                payload: `accept_quot-${quotation?._id}`,
                                            },
                                            {
                                                type: "postback",
                                                title: 'Decline',
                                                payload: `decline_quot-${quotation?._id}`,
                                            },
                                        ]
                                    },
                                ]
                            };

                            await sendTemplate(data, data.sender?.id, templatePayload);
                        }

                        let ciphertext = await encryption({
                            status: true,
                            message: "Bargained amount accepted successfully",
                            quotation: updatedQuotation,
                        });
                        res.status(200).send(ciphertext);
                    })
                        .catch(async (err) => {
                            console.log(err);
                            let error = await encryption({
                                status: false,
                                message: "Error while updating quotation"
                            });
                            res.status(500).send(error);
                        });
                }
            }).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while getting the quotation!"
                });
                res.status(200).send(error);
            });
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!",
        });
        res.status(500).send(error);
    }
};


module.exports.reviseQuotation = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        const { revised_amount, quotation_id } = data;

        Quotation.findOne({ $and: [{ _id: quotation_id }, { bargain: true }] })
            .populate({ path: 'sender', populate: [{ path: 'user', select: 'first_name last_name' }, { path: 'insta_recipient_id' }] })
            .populate({ path: 'reciever', populate: [{ path: 'user', select: 'first_name last_name' }, { path: 'insta_recipient_id' }] })
            .populate('amount_sender_currency')
            .populate('amount_reciever_currency')
            .then(async (quotation) => {
                if (!quotation) {
                    let error = await encryption({
                        status: false,
                        message: "Quotation not found!",
                    });
                    res.status(400).send(error);
                } else {
                    quotation.revised_amount = revised_amount;
                    quotation.status = "revise";

                    quotation.save().then(async (updatedQuotation) => {
                        const notificationObj = {
                            title: 'Quotation Notification',
                            desc: 'Revised amount has been added',
                            type: 'quotation',
                            status: 'unread',
                            from: quotation.sender,
                            to: quotation.reciever,
                            link_id: quotation._id,
                        }

                        addNotification(notificationObj)
                        sendPrivateMessage(quotation.reciever, "Revised amount has been added!")

                        if (quotation?.sender?.user && quotation?.reciever?.user) {

                            const sender_name = quotation?.sender?.user ?
                                quotation?.sender?.user?.first_name + " " + quotation?.sender?.user?.last_name :
                                quotation?.sender?.company?.company_name
                            const receiver_name = quotation?.reciever?.user ?
                                quotation?.reciever?.user?.first_name + " " + quotation?.reciever?.user?.last_name :
                                quotation?.reciever?.company?.company_name
                            const sendingCurrency = quotation?.amount_reciever_currency?.currency.code;

                            const receiverCurrency = quotation?.amount_reciever_currency?.currency.code;

                            const senderOptions = {
                                toEmail: quotation?.sender?.email ?? "",
                                phoneNumber: quotation?.sender?.phone ?? "",
                                instaUsername: quotation?.sender?.insta_username ?? "",
                                message: `Hi, you have successfully entered a revised amount of ${formattedAmount(revised_amount)} ${receiverCurrency} to ${receiver_name}`,
                                subject: "You have sent a revised amount!",
                                templateId: "d-2d5f929ed89847d693ab15621b95890f",
                                phoneMessage: `You have requested a revised amount of ${formattedAmount(revised_amount)} ${receiverCurrency} to ${receiver_name}`
                            }
                            const receiverOptions = {
                                toEmail: quotation?.reciever?.email ?? "",
                                phoneNumber: quotation?.reciever?.phone ?? "",
                                instaUsername: quotation?.reciever?.insta_username ?? "",
                                message: `Hi, you have been requested a revised amount of ${formattedAmount(revised_amount)} ${sendingCurrency} from ${sender_name}`,
                                subject: "You have been requested a revised amount in your Instapay Account!",
                                templateId: "d-2d5f929ed89847d693ab15621b95890f",
                                phoneMessage: `You have been requested a revised amount of ${formattedAmount(revised_amount)} ${sendingCurrency} from ${sender_name}`
                            }


                            // email, phone and push notifications

                            sendNotifications(quotation?.reciever, 'quotation', senderOptions)
                            sendNotifications(quotation?.sender, 'quotation', receiverOptions)
                        }
                        console.log(quotation?.sender, quotation?.reciever, "quotation?.sender")

                        // instachatbot message
                        if (quotation?.reciever?.insta_bot && quotation?.reciever?.insta_recipient_id) {
                            const data = {
                                sender: { id: quotation?.reciever?.insta_recipient_id?.recipient },
                            }
                            const currencyDetails = await Wallet.findById(quotation?.amount_reciever_currency)
                            const receiver_name = quotation?.reciever?.user ?
                                quotation?.reciever?.user?.first_name + " " + quotation?.reciever?.user?.last_name :
                                quotation?.reciever?.company?.company_name;
                            const sender_name = quotation?.sender?.user ?
                                quotation?.sender?.user?.first_name + " " + quotation?.sender?.user?.last_name :
                                quotation?.sender?.company?.company_name
                            const quotationInfo = `
Title: ${quotation?.title}
Description: ${quotation?.desc}
Bargaining amount: ${currencyDetails?.currency.symbol}${formattedAmount(quotation?.revised_amount)}
Status: ${quotation?.status}
                                `
                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: `A revised amount has been added for the quotation from ${sender_name}.`,
                                        // image_url: benefAccount?.profileImage?.url,
                                        subtitle: quotationInfo,

                                        buttons: [
                                            {
                                                type: "postback",
                                                title: 'Accept',
                                                payload: `accept_quot-${quotation?._id}`,
                                            },
                                            // {
                                            //     type: "postback",
                                            //     title: 'Revise Amount',
                                            //     payload: `revise_quot-${quotation?._id}`,
                                            // },
                                            {
                                                type: "postback",
                                                title: 'Decline',
                                                payload: `decline_quot-${quotation?._id}`,
                                            },

                                        ]
                                    },
                                ]
                            };

                            await sendTemplate(data, data.sender?.id, templatePayload)
                        }

                        let ciphertext = await encryption({
                            status: true,
                            message: "Quotation revised successfully",
                            quotation: updatedQuotation
                        });
                        res.status(200).send(ciphertext);
                    })
                        .catch(async (err) => {
                            let error = await encryption({
                                status: false,
                                message: "Error while updating quotation"
                            });
                            res.status(500).send(error);
                        });
                }
            })
            .catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while getting the quotation!"
                });
                res.status(500).send(error);
            });
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!",
        });
        res.status(500).send(error);
    }
};

module.exports.walletToWalletTransaction = async (req, res) => {
    try {
        // let data = req.body.data
        console.log(req.body, "req.body")
        const data = req.body;
        // let data = await decryption(req.body.data)
        const { receiver_wallet_id, quotation_id, } = data
        console.log(data, "data")
        let amount;
        const quotation = await Quotation.findOne({ _id: quotation_id, status: { $in: ['sent', 'revise', 'bargain-accepted'] } }).populate({
            path: 'sender',
            populate: {
                path: 'insta_recipient_id'
            }
        })
        if (!quotation) {
            return res.status(400).send(await encryption({
                status: false,
                message: "Quotation not found or already accepted!"
            }))
        }
        if (quotation.revised_amount) {
            amount = quotation.revised_amount
        } else {
            amount = quotation.amount
        }

        const receiver_Wallet = await Wallet.findById(quotation.amount_reciever_currency);

        let dataObj = {
            sender_wallet_id: receiver_wallet_id,
            receiver_wallet_id: receiver_Wallet?.wallet_id,
            amount,
            purpose: quotation.purpose,
            service_type: 'wallet_to_wallet',
            payment_type: 'quotation',
            link_id: quotation._id,
            description: quotation.desc,
            transaction_type: "request"
        }

        const files = quotation?.images.map(image => ({
            key: image.key,
            url: image.url,
            ETag: image.ETag,
            status: true
        }));

        console.log(files, "filesss")

        const response = await walletToWalletTransactionHelper(dataObj, req, files)
        // return res.status(response.status ? 200 : 400).send(await encryption(response));

        if (response.status) {
            await Quotation.findByIdAndUpdate(quotation_id, { $set: { status: 'accepted' } });
            return res.status(200).send(await encryption(response));
        } else {
            return res.status(400).send(await encryption(response));
        }


        let senderWallet = await Wallet.findOne({
            $and: [{ _id: receiver_wallet_id }, { wallet_type: "insta" }, { status: 'active' },
            {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }
            ]
        })
            .populate([
                {
                    path: 'account',
                    populate: [
                        { path: 'user' },
                        { path: 'company' },
                        { path: 'level' }
                    ]
                }
            ]);
        let receiverWallet = await Wallet.findOne({
            $and: [{
                _id: quotation.amount_reciever_currency
            }, { wallet_type: "insta" }, { status: 'active' },
            {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }
            ]
        })
            .populate([
                {
                    path: 'account',
                    populate: [
                        { path: 'user' },
                        { path: 'company' },
                        { path: 'level' }
                    ]
                }
            ]);


        console.log(senderWallet, "senderw")
        if (!senderWallet) {
            let error = await encryption({
                status: false,
                message: "Invalid Sender!"
            })
            return res.status(400).send(error);
        }
        console.log(receiverWallet, "senderw")

        if (!receiverWallet) {
            let error = await encryption({
                status: false,
                message: "Invalid Receiver!"
            })
            return res.status(400).send(error);
        }
        console.log('i ran')



        if (senderWallet.account._id.toString() != req.user._id.toString() || !senderWallet.account.active) {
            let error = await encryption({
                status: false,
                message: "Invalid Sender!"
            })
            return res.status(400).send(error);
        }

        if (!receiverWallet.account.active) {
            let error = await encryption({
                status: false,
                message: "Invalid Receiver!"
            })
            return res.status(400).send(error);
        }
        let senderLimit = senderWallet.account.level.sending_limit;
        let receiverLimit = receiverWallet.account.level.receiving_limit;
        if (senderWallet.account.is_external_limit) {
            senderLimit = senderWallet.account.sending_limit
        }
        if (receiverWallet.account.is_external_limit) {
            receiverLimit = senderWallet.account.receiving_limit
        }
        let excRate = await exchangeRateApi(senderWallet.currency.code, receiverWallet.currency.code, amount, senderWallet.account.level._id, 'wallet_to_wallet')
        // console.log(excRate);
        let totalAmount = amount + excRate.fee.exchange_fee;

        if (senderWallet.balance.available < (amount + excRate.fee.exchange_fee)) {
            let error = await encryption({
                status: false,
                message: "Insufficient balance!"
            })
            return res.status(400).send(error);
        }
        if (senderLimit < totalAmount) {
            let error = await encryption({
                status: false,
                message: "Sending limit exceeded!"
            })
            return res.status(400).send(error);
        }
        if (receiverLimit < excRate.exchanged_amount) {
            let error = await encryption({
                status: false,
                message: "Receiver account receiving limit exceeded!"
            })
            return res.status(400).send(error);
        }

        let senderBalance = senderWallet.balance.available - (amount + excRate.fee.exchange_fee)
        let receiverBalance = receiverWallet.balance.available + excRate.exchanged_amount
        let ref = 'tr_' + Date.now().toString();
        let senderTransactionObj = {
            reference_id: ref,
            type: 'transfer',
            transaction_type: 'debit',
            service_type: 'wallet_to_wallet',
            payment_type: "quotation",
            status: 'completed',
            purpose: quotation.title,
            description: quotation.desc,
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount: amount,
            fee: excRate.fee.exchange_fee,
            total: amount + excRate.fee.exchange_fee,
            wallet_id: senderWallet.wallet_id,
            wallet: senderWallet._id,
            account: senderWallet.account._id,
            sender: senderWallet.account._id,
            receiver: receiverWallet.account._id,
            current_balance: senderWallet.balance.available
        }
        let receiverTransactionObj = {
            reference_id: ref,
            type: 'transfer',
            transaction_type: 'credit',
            service_type: 'wallet_to_wallet',
            payment_type: "quotation",
            status: 'completed',
            purpose: quotation.title,
            description: quotation.desc,
            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
            amount: excRate.exchanged_amount,
            fee: 0,
            total: excRate.exchanged_amount,
            wallet_id: receiverWallet.wallet_id,
            wallet: receiverWallet._id,
            account: receiverWallet.account._id,
            sender: senderWallet.account._id,
            receiver: receiverWallet.account._id,
            current_balance: receiverWallet.balance.available
        }
        Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderBalance } }).then(async (newSenderBalance) => {
            if (newSenderBalance.acknowledged && newSenderBalance.modifiedCount == 1) {
                let supdt = await Transaction.create(senderTransactionObj)
                if (supdt) {
                    Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                        if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                            let rupdt = await Transaction.create(receiverTransactionObj)
                            if (rupdt) {
                                await Quotation.findByIdAndUpdate(quotation_id, { $set: { status: 'accepted' } });

                                const notificationObj = {
                                    title: 'Quotation Notification',
                                    desc: 'Quotation amount recieved succesfully!',
                                    type: 'quotation',
                                    status: 'unread',
                                    from: quotation.reciever,
                                    to: quotation.sender,
                                    link_id: quotation._id,
                                }
                                const sender_name = senderWallet?.account?.user ?
                                    senderWallet?.account?.user?.first_name + senderWallet?.account?.user?.last_name :
                                    senderWallet?.account?.company?.company_name
                                const receiver_name = receiverWallet?.account?.user ?
                                    receiverWallet?.account?.user?.first_name + receiverWallet?.account?.user?.last_name :
                                    receiverWallet?.account?.company?.company_name
                                if (senderWallet?.account?.user && receiverWallet?.account?.user) {


                                    const senderOptions = {
                                        toEmail: senderWallet?.account?.email ?? "",
                                        phoneNumber: senderWallet?.account?.phone ?? "",
                                        instaUsername: senderWallet?.account?.insta_username ?? "",
                                        message: `You have sent a quotation of ${amount} ${senderWallet?.currency.code} to ${receiver_name}`,
                                        subject: "You have sent a quotation in your Instapay Account!",
                                        templateId: "d-2d5f929ed89847d693ab15621b95890f",
                                        phoneMessage: `Quotation amount sent of ${amount} ${senderWallet?.currency.code} to ${receiver_name}`
                                    }
                                    const receiverOptions = {
                                        toEmail: receiverWallet?.account?.email ?? "",
                                        phoneNumber: receiverWallet?.account?.phone ?? "",
                                        instaUsername: receiverWallet?.account?.insta_username ?? "",
                                        message: `You have recieved a quotation of ${excRate.exchanged_amount} ${receiverWallet?.currency?.code} from ${sender_name}`,
                                        subject: "You have received a quotation in your Instapay Account!",
                                        templateId: "d-2d5f929ed89847d693ab15621b95890f",
                                        phoneMessage: `Quotation recieved of ${excRate.exchanged_amount} ${receiverWallet?.currency?.code} from ${sender_name}`
                                    }
                                    console.log(senderOptions, "receiver", receiverOptions)

                                    // email, phone and push notifications
                                    sendNotifications(senderWallet?.account, 'quotation', senderOptions)
                                    sendNotifications(receiverWallet?.account, 'quotation', receiverOptions)
                                }


                                // system notification
                                addNotification(notificationObj)

                                // socket message
                                sendPrivateMessage(quotation.sender, "Quotation amount recieved succesfully!")

                                // insta chatbot notification
                                if (quotation?.sender?.insta_bot && quotation?.sender?.insta_recipient_id) {
                                    console.log(quotation?.sender?.insta_bot)
                                    const quotationInfo = `
Title: ${quotation?.title}
Description: ${quotation?.desc}
Amount: ${senderWallet?.currency.symbol}${quotation?.revised_amount ? quotation?.revised_amount : quotation?.amount}
Status: accepted
                                `
                                    const message1 = `
Your quotation has been accepted from ${sender_name}.
${quotationInfo}
    `
                                    const data = {
                                        sender: { id: quotation?.sender?.insta_recipient_id?.recipient },
                                    }
                                    const quickReplies1 = [
                                        // { content_type: "text", title: "Proceed", payload: "quot_proceed" },
                                        // // { content_type: "text", title: "Another wallet", payload: "quot_another_w" },
                                        { content_type: "text", title: "Return to Main Menu", payload: "main_menu" },
                                    ]
                                    await quickReply(data, message1, quickReplies1);
                                }



                                // let updtr = Transaction.updateOne({ _id: supdt._id }, { $set: { status: 'completed' } })
                                let error = await encryption({
                                    status: true,
                                    message: "Transaction successfull.",
                                    data: supdt
                                })
                                res.status(200).send(error);
                            } else {
                                console.log("1st condition failed")
                                let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
                                let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                                let wrupdt = await Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverWallet.balance.available } })
                                let error = await encryption({
                                    status: false,
                                    message: "Transaction Failed."
                                })
                                res.status(400).send(error);
                            }
                        } else {
                            console.log("2nd condition failed")

                            let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
                            let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                            let error = await encryption({
                                status: false,
                                message: "Transaction Failed."
                            })
                            res.status(400).send(error);
                        }
                    }).catch(async (err) => {
                        console.log("3rd condition failed", err)

                        let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
                        let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                        let error = await encryption({
                            status: false,
                            message: "Transaction Failed."
                        })
                        res.status(400).send(error);
                    })
                } else {
                    console.log("4th condition failed")

                    let wupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                    let error = await encryption({
                        status: false,
                        message: "Transaction Failed."
                    })
                    res.status(400).send(error);
                }
            } else {
                console.log("5th condition failed")

                // let updt = Transaction.updateOne({ _id: supdt._id }, { $set: { status: 'failed' } })
                let error = await encryption({
                    status: false,
                    message: "Transaction Failed."
                })
                res.status(200).send(error);
            }
        }).catch(async (err) => {
            console.log("6th condition failed")

            // let updt = Transaction.updateOne({ _id: supdt._id }, { $set: { status: 'failed' } })
            let error = await encryption({
                status: false,
                message: "Transaction Failed."
            })
            res.status(400).send(error);
        })

    } catch (err) {
        console.log("7th condition failed")

        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.declineQuotation = async (req, res) => {
    try {
        const { quotation_id } = req.params;

        if (!quotation_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing."
            });
            return res.status(400).send(error);
        }

        const updatedQuotation = await Quotation.findByIdAndUpdate(quotation_id, { $set: { decline_status: true, status: 'declined' } }, { new: true })
            .populate({ path: 'sender', populate: { path: 'user', select: 'first_name last_name' } })
            .populate({ path: 'reciever', populate: { path: 'user', select: 'first_name last_name' } })
            .populate('amount_sender_currency')
            .populate('amount_reciever_currency');

        const notificationObj = {
            title: 'Quotation Notification',
            desc: 'Quotation has been declined',
            type: 'quotation',
            status: 'unread',
            from: updatedQuotation?.sender,
            to: updatedQuotation?.reciever,
            link_id: updatedQuotation?._id,
        }

        addNotification(notificationObj)
        sendPrivateMessage(updatedQuotation?.reciever, "Quotation has been declined")

        console.log(updatedQuotation)

        if (updatedQuotation?.reciever?.user && updatedQuotation?.sender?.user) {
            console.log(updatedQuotation?.sender?.user, updatedQuotation?.reciever?.user)
            const sender_name = updatedQuotation?.sender?.user ?
                updatedQuotation?.sender?.user?.first_name + " " + updatedQuotation?.sender?.user?.last_name :
                updatedQuotation?.sender?.company?.company_name
            const receiver_name = updatedQuotation?.reciever?.user ?
                updatedQuotation?.reciever?.user?.first_name + " " + updatedQuotation?.reciever?.user?.last_name :
                updatedQuotation?.reciever?.company?.company_name
            const sendingCurrency = updatedQuotation?.amount_reciever_currency?.currency?.code;

            const receiverCurrency = updatedQuotation?.amount_reciever_currency?.currency?.code;

            // const senderOptions = {
            //     toEmail: updatedQuotation?.reciever?.email ?? "",
            //     phoneNumber: updatedQuotation?.reciever?.phone ?? "",
            //     instaUsername: updatedQuotation?.reciever?.insta_username ?? "",
            //     message: `Hi, you have declined a quotation of ${updatedQuotation?.revised_amount} ${sendingCurrency} to ${sender_name}`,
            //     subject: "You have declined a quotation!",
            //     templateId: "d-2d5f929ed89847d693ab15621b95890f",
            //     phoneMessage: `You have declined a quotation of ${updatedQuotation?.revised_amount} ${sendingCurrency} to ${sender_name}`
            // }
            // const receiverOptions = {
            //     toEmail: updatedQuotation?.sender?.email ?? "",
            //     phoneNumber: updatedQuotation?.sender?.phone ?? "",
            //     instaUsername: updatedQuotation?.sender?.insta_username ?? "",
            //     message: `Your quotation of ${updatedQuotation?.revised_amount} ${receiverCurrency} has been declined from ${receiver_name}`,
            //     subject: "Your quotation has been declined!",
            //     templateId: "d-2d5f929ed89847d693ab15621b95890f",
            //     phoneMessage: `Your quotation of ${updatedQuotation?.revised_amount} ${receiverCurrency} has been declined from ${receiver_name}`
            // }


            const quotationSendLanguage = 'english';
            const quotationSendtemplateName = 'Quotation declined';

            const date = new Date();
            const formattedDate = moment(date).format('YYYY-MM-DD');

            const templateIdSending = getTemplateId(quotationSendLanguage, quotationSendtemplateName);

            const quotationReceiverLanguage = 'english';
            const quotationReceivertemplateName = 'Quotation declined';

            const templateIdReceiving = getTemplateId(quotationReceiverLanguage, quotationReceivertemplateName);

            // const dynamicDataSending = {
            //     quote_id: quotation._id,
            //     sender_name: receiver_name,
            //     date_submitted: formattedDate,
            //     new_amount: `${formattedAmount(revised_amount)} ${receiverCurrency}`,
            //     orignal_amount: `${formattedAmount(quotation.amount)} ${receiverCurrency}`,
            //     service_description: quotation.desc || "N/A"
            // };

            const dynamicDataReceiving = {
                quote_id: updatedQuotation._id,
                receiver_name: receiver_name,
                data_declined: formattedDate,
                total_amount: `${formattedAmount(updatedQuotation?.revised_amount || updatedQuotation?.amount)} ${receiverCurrency}`,
                service_description: updatedQuotation.desc || "N/A",
                receiver_feedback: "N/A"
            }

            // const sendingDetails = {
            //     toEmail: quotation?.reciever?.email,
            //     message: "Bargain Message",
            //     subject: "Bargain Subject",
            //     templateId: templateIdSending,
            //     phoneNumber: quotation?.reciever?.phone,
            //     phoneMessage: `You have declined a quotation of ${updatedQuotation?.revised_amount} ${sendingCurrency} to ${sender_name}`,
            //     dynamicData: dynamicDataSending
            // }

            const receiverDetails = {
                toEmail: updatedQuotation?.sender?.email,
                message: "Decline Message",
                subject: "Decline Subject",
                templateId: templateIdReceiving,
                phoneNumber: updatedQuotation?.sender.phone,
                phoneMessage: `Your quotation of ${formattedAmount(updatedQuotation?.revised_amount || updatedQuotation?.amount)} ${receiverCurrency} has been declined from ${receiver_name}`,
                dynamicData: dynamicDataReceiving
            }

            console.log(receiverDetails)

            // email, phone and push notifications
            // sendNotifications(updatedQuotation?.reciever._id, 'quotation', sendingDetails)
            sendNotifications(updatedQuotation?.sender._id, 'quotation', receiverDetails)
        }


        if (!updatedQuotation) {
            let error = await encryption({
                status: false,
                message: "Quotation not found."
            });
            return res.status(404).send(error);
        }

        let ciphertext = await encryption({
            status: true,
            message: "Quotation declined successfully.",
            data: updatedQuotation
        });
        res.status(200).send(ciphertext);
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};
