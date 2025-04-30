const RequestedCurrency = require('../models/Requested-Currency.model')
const AvailableCurrency = require('../models/Available-Currency.model')
const { encryption, decryption } = require('../configurations/Encryption');
const Account = require('../models/Account.model');
const Wallet = require('../models/Wallet.model');
var Hashids = require('hashids');
const { addNotificationAdmin, addNotification } = require('../utils/generateNotification');
const { sendPrivateMessage } = require('../utils/websocket');
const InstaChatbot = require('../models/InstaChatbot.model');
const { sendTemplate } = require('../utils/instaChatbotUtils');
// const { sendTemplate } = require('./InstaChatbot.controller');

const createWallet = async (account_id, currency, symbol) => {
    let obj = {
        wallet_type: 'insta',
        status: 'active',
        limit_used: 0,
        balance: {
            available: 0,
            pending: 0,
            total: 0,
        },
        account: account_id,
        currency: { code: currency, symbol: symbol }
    };

    if (['BTC', 'USDT', 'ETH'].includes(currency)) {
        obj['wallet_type'] = 'crypto';
    }

    const wallet = new Wallet(obj);

    try {
        const walletDoc = await wallet.save();
        const hashids = new Hashids(walletDoc._id.toString(), 8, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890');
        const id = await hashids.encode(1, 2, 3);
        console.log(id.toString());
        const updateResult = await Wallet.updateOne({ _id: walletDoc._id }, { $set: { wallet_id: id.toString() } });
        const data = {
            _id: walletDoc._id,
            wallet_id: id.toString(),
        }
        return { status: true, data: data };
    } catch (err) {
        console.log(err);
        return { status: false, error: err };
    }
};

module.exports.requestCurrency = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        // const data = req.body.data
        const currency_id = req.params.currency_id
        const { code, account_id, desc } = data
        if (!currency_id || !code || !account_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!",
            });
            return res.status(400).send(error);
        }

        const walletList = await Wallet.find({ account: account_id });

        if (walletList.length >= 8) {
            let error = await encryption({
                status: false,
                message: "You can only have 8 wallets!",
            })
            return res.status(400).send(error);
        }

        const availableCurrency = await AvailableCurrency.findById(currency_id);

        if (!availableCurrency) {
            let error = await encryption({
                status: false,
                message: "Requested currency is not available!",
            });
            return res.status(404).send(error);
        }

        // checking if currency already exists for the user
        const existingWallet = await Wallet.findOne({ account: account_id, 'currency.code': code });
        if (existingWallet) {
            let error = await encryption({ status: false, message: "Wallet already exists!" });
            return res.status(400).send(error);
        }

        const existingRequest = await RequestedCurrency.findOne({
            account: account_id,
            currency: currency_id,
        })

        if (existingRequest) {
            let errorMessage;
            switch (existingRequest.status) {
                case "requested":
                    errorMessage = "Currency has already been requested by the user!";
                    break;
                case "not-eligible":
                    errorMessage = "Currency has been declined by the admin!";
                    break;
                case "pending":
                    errorMessage = "Currency request is pending!";
                    break;
                case "accepted":
                    errorMessage = "Currency request is already accepted!";
                    break;
            }
            let error = await encryption({ status: false, message: errorMessage });
            return res.status(400).send(error);
        }

        const requestedCurrency = new RequestedCurrency({
            code,
            account: account_id,
            currency: currency_id,
            description: desc,
            status: "accepted",
        });

        const savedRequestedCurrency = await requestedCurrency.save();
        if (savedRequestedCurrency) {
            // Check for previously default admin-blocked wallet
            const adminBlockedDefaultWallet = await Wallet.findOne({
                account: account_id,
                wallet_type: "insta",
                default: true,
                admin_blocked: true,
            });

            const newWallet = await createWallet(account_id, availableCurrency.code, availableCurrency.symbol);

            if (newWallet?.status) {
                // If a previously default wallet is admin blocked, set it to default: false and set new wallet to default: true
                if (adminBlockedDefaultWallet) {
                    await Wallet.findByIdAndUpdate(adminBlockedDefaultWallet._id, { default: false });
                    await Wallet.findByIdAndUpdate(newWallet?.data._id, { default: true });
                }

                const notificationObj = {
                    title: 'Currency Request Notification',
                    desc: `Your ${availableCurrency.code} wallet has been accepted`,
                    type: 'currency',
                    status: 'unread',
                    to: account_id,
                    link_id: savedRequestedCurrency._id,
                };

                addNotification(notificationObj);
                sendPrivateMessage(account_id, `Congratulations! Your ${availableCurrency.code} wallet request has been accepted.`);

                let ciphertext = await encryption({
                    status: true,
                    message: "Currency has been accepted!",
                    walletDetails: newWallet?.data,
                });
                return res.status(200).send(ciphertext);
            } else {
                let error = await encryption({ status: false, message: "Something went wrong while requesting currency" });
                return res.status(500).send(error);
            }
        } else {
            let error = await encryption({ status: false, message: "Something went wrong while requesting currency" });
            return res.status(500).send(error);
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({ status: false, message: "Internal server error." });
        res.status(500).send(error);
    }
}
module.exports.acceptCurrencyRequest = async (req, res) => {
    try {
        const { account_id, currency_id } = req.params;
        if (!account_id || !currency_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!",
            });
            return res.status(400).send(error);
        }

        Account.findOne({ _id: account_id, active: true }).then(async (account) => {
            if (!account) {
                let error = await encryption({
                    status: false,
                    message: "Account not found or not active!",
                });
                return res.status(400).send(error);
            } else {
                AvailableCurrency.findById(currency_id).then(async (currency) => {
                    if (!currency) {
                        let error = await encryption({
                            status: false,
                            message: "Currency not found!",
                        });
                        return res.status(400).send(error);
                    } else {
                        // checking if currency already exists for the user
                        const existingWallet = await Wallet.findOne({ account: account_id, 'currency.code': currency.code })

                        if (existingWallet) {
                            let error = await encryption({
                                status: false,
                                message: "Wallet already exists!",
                            });
                            return res.status(400).send(error);
                        }

                        // function to generate wallet based on currency
                        createWallet(account_id, currency.code, currency.symbol);
                        RequestedCurrency.findOneAndUpdate(
                            { currency: currency_id },
                            { $set: { status: "accepted" } },
                            { new: true }
                        ).then(async (requestedCurrency) => {
                            if (!requestedCurrency) {
                                let error = await encryption({
                                    status: false,
                                    message: "Requested currency not found!",
                                });
                                return res.status(400).send(error);
                            } else {
                                if (account.insta_bot && account.insta_recipient_id) {
                                    const instaChatBot = await InstaChatbot.findById(account.insta_recipient_id);
                                    console.log(instaChatBot)
                                    if (instaChatBot) {
                                        // instaChatBot.requested_currency = "";
                                        // instaChatBot.currency_description = "";
                                        // await instaChatBot.save();
                                        const templatePayload = {
                                            template_type: "generic",
                                            elements: [
                                                {
                                                    title: `Your ${currency.code} currency requested has been accepted`,
                                                    image_url: "https://my.insta-pay.ch/static/media/chips_in_left.3898cd344de2a6cfda6c.png",
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


                                        await sendTemplate(data = { sender: { id: instaChatBot.recipient } }, instaChatBot.recipient, templatePayload)
                                    }
                                }
                                const notificationObj = {
                                    title: 'Currency Request Notification',
                                    desc: `Your ${currency.code} wallet has been accepted`,
                                    type: 'currency',
                                    status: 'unread',
                                    to: account_id,
                                    link_id: requestedCurrency._id,
                                }
                                addNotification(notificationObj)
                                // socket
                                sendPrivateMessage(account_id, `Congratulations! Your ${currency.code} wallet request has been accepted.`)
                                let ciphertext = await encryption({
                                    status: true,
                                    message: "Currency request accepted!",
                                });
                                return res.status(200).send(ciphertext);
                            }
                        }).catch(async (err) => {
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while getting requested currency details.",
                            });
                            res.status(500).send(error);
                        })
                    }
                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while getting currency details.",
                    });
                    res.status(500).send(error);
                })
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details.",
            });
            res.status(500).send(error);
        })
    } catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error.",
        });
        res.status(500).send(error);
    }
}

module.exports.getAllRequestedCurrencies = async (req, res) => {
    try {
        RequestedCurrency.find().populate({
            path: 'account',
            select: 'user company',
            populate: [
                {
                    path: 'user',
                    select: 'first_name last_name',
                },
                {
                    path: 'company',
                    select: 'company_name',
                }
            ]
        })
            .populate({ path: 'currency' }).then(async (currencies) => {
                if (currencies) {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Requested currencies found!",
                        currencies
                    });
                    return res.status(200).send(ciphertext);
                } else {
                    let error = await encryption({
                        status: false,
                        message: "No currencies found!",
                    });
                    return res.status(400).send(error);
                }
            }).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while getting currencies",
                });
                return res.status(500).send(error);
            })

    } catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error.",
        });
        res.status(500).send(error);
    }
}

module.exports.statusCurrencyRequest = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        const { requested_currency_id, account_id } = req.params;
        const { status } = data

        if (!requested_currency_id || !account_id || !status) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!",
            });
            return res.status(400).send(error);
        }
        const account = await Account.findById(account_id);
        RequestedCurrency.findByIdAndUpdate(requested_currency_id, { $set: { status } }, { new: true }).then(async (updatedCurrency) => {
            if (!updatedCurrency) {
                let error = await encryption({
                    status: false,
                    message: "Requested currency not found!",
                });
                return res.status(400).send(error);
            } else {
                if (status === "declined") {
                    const notificationObj = {
                        title: 'Currency Request Notification',
                        desc: `Your ${updatedCurrency.code} wallet request has been declined`,
                        type: 'currency',
                        status: 'unread',
                        to: account_id,
                        link_id: requested_currency_id,
                    }
                    addNotification(notificationObj)
                    // socket
                    sendPrivateMessage(account_id, `Your ${updatedCurrency.code} wallet request has been declined!`)
                    if (account.insta_bot && account.insta_recipient_id) {
                        const instaChatBot = await InstaChatbot.findById(account.insta_recipient_id);
                        if (instaChatBot) {
                            const templatePayload = {
                                template_type: "generic",
                                elements: [
                                    {
                                        title: `Your ${updatedCurrency.code} currency request's has been declined`,
                                        image_url: "https://my.insta-pay.ch/static/media/chips_in_left.3898cd344de2a6cfda6c.png",
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
                            // await sendTemplate(data = {}, instaChatBot.recipient, templatePayload)
                        }
                    }
                }

                let ciphertext = await encryption({
                    status: true,
                    message: "Requested currency status updated!",
                    updatedCurrency
                });
                return res.status(200).send(ciphertext);
            }
        }).catch(async (err) => {
            console.log(err)
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting requested currencies",
            });
            return res.status(500).send(error);
        })
    } catch (err) {
        console.error(err);
        let error = await encryption({
            status: false,
            message: "Internal server error.",
        });
        res.status(500).send(error);
    }
};

module.exports.deleteCurrencyRequest = async (req, res) => {
    try {
        const { requested_currency_id, account_id } = req.params;

        if (!requested_currency_id || !account_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!",
            });
            return res.status(400).send(error);
        }

        RequestedCurrency.findByIdAndRemove(requested_currency_id).then(async (removedCurrency) => {
            if (!removedCurrency) {
                let error = await encryption({
                    status: false,
                    message: "Requested currency not found!",
                });
                return res.status(400).send(error);
            } else {
                let ciphertext = await encryption({
                    status: true,
                    message: "Requested currency deleted successfully!",
                    removedCurrency
                });
                return res.status(200).send(ciphertext);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while deleting requested currency",
            });
            return res.status(500).send(error);
        });
    } catch (err) {
        console.error(err);
        let error = await encryption({
            status: false,
            message: "Internal server error.",
        });
        res.status(500).send(error);
    }
};

module.exports.createWallet = createWallet