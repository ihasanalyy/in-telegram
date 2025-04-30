const Admin = require('../models/Admin.model')
const jwt = require('jsonwebtoken');
const CryptoJS = require("crypto-js");
const axios = require('axios');
const PASSWORD_ENCRYPTION_KEY = 'secretOfTheInstaPaySystemAccountPassword'
const TOKEN_KEY = 'secretOfTheInstaPaySystemAccountTOKEN'

const Account = require('../models/Account.model');
const User = require('../models/User.model');
const Company = require('../models/Company.model');
const Wallet = require('../models/Wallet.model');
const AccountLevel = require('../models/Account-Level.model');
const Transaction = require('../models/Transaction.model');
const TransactionCategory = require('../models/Transaction-Category.model');
const Fee = require('../models/Fee.model');
const Markup = require('../models/Markup.model');

const moment = require('moment-timezone');

const { encryption, decryption } = require('../configurations/Encryption');

module.exports.getAllTransaction = async (req, res) => {

    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * 50
        if (limit > 100) {
            limit = 100;
        }
        Transaction.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate([
            {
                path: 'account',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'sender',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' },
                    { path: 'country', select: 'country_name -_id' }
                ])
            }, {
                path: 'receiver',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' },
                    { path: 'country', select: 'country_name -_id' }
                ])
            }
        ]).then(async (transactionList) => {
            if (transactionList.length) {
                const totalTransactions = await Transaction.countDocuments()
                let ciphertext = await encryption({
                    status: true,
                    message: "Account transactions!",
                    transactionList,
                    totalTransactions
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No transaction found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting transactions!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.getUserTransaction = async (req, res) => {
    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * 50
        if (limit > 100) {
            limit = 100;
        }
        let account_id = req.params.account_id;
        Transaction.find({
            $and: [
                { account: account_id },
                {
                    $or: [
                        { hidden: { $exists: false } },  // hidden chek is not available
                        { hidden: false }                // hidden is false
                    ]
                }
            ]
        }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate([
            {
                path: 'account',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'sender',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'receiver',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }
        ]).then(async (transactionList) => {
            if (transactionList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Account transactions!",
                    transactionList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No transaction found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting transactions!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.getUserTopUpTransaction = async (req, res) => {
    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * 50
        if (limit > 100) {
            limit = 100;
        }
        let account_id = req.params.account_id;
        Transaction.find({ $and: [{ account: account_id }, {}] }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate([
            {
                path: 'account',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'sender',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'receiver',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }
        ]).then(async (transactionList) => {
            if (transactionList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Account transactions!",
                    transactionList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No transaction found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting transactions!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.searchTransaction = async (req, res) => {
    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * 50
        if (limit > 100) {
            limit = 100;
        }
        let query = req.params.query;
        const re = new RegExp(query, 'i');
        let users = await User.find({ $or: [{ first_name: re }, { last_name: re }] }, { account: true })
        users = await users.map(ul => ul.account.toString())
        let company = await Company.find({ company_name: re }, { account: true })
        company = await company.map(ul => ul.account.toString())
        users = users.concat(company)
        console.log(users);
        Transaction.find({
            $or: [
                { transaction_type: { "$regex": re } },
                { reference_id: { "$regex": re } },
                { wallet_id: { "$regex": re } },
                { service_type: { "$regex": re } },
                { type: { "$regex": re } },
                { account: { $in: users } },
                { sender: { $in: users } },
                { receiver: { $in: users } }
            ]
        }).populate([
            {
                path: 'account',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'sender',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' },
                    { path: 'country', select: 'country_name -_id' }
                ])
            }, {
                path: 'receiver',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' },
                    { path: 'country', select: 'country_name -_id' }
                ])
            }
        ]).sort({ createdAt: -1 }).skip(skip).limit(limit).then(async (transactionList) => {
            if (transactionList.length) {
                const totalTransactions = await Transaction.countDocuments()
                let ciphertext = await encryption({
                    status: true,
                    message: "Account transactions!",
                    transactionList,
                    totalTransactions
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No transaction found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting transactions!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.searchAccountTransaction = async (req, res) => {
    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * 50
        if (limit > 100) {
            limit = 100;
        }
        let account_id = req.params.account_id;
        let query = req.params.query;
        const re = new RegExp(query, 'i');
        let users = await User.find({ $or: [{ first_name: re }, { last_name: re }] }, { account: true })
        users = await users.map(ul => ul.account.toString())
        let company = await Company.find({ company_name: re }, { account: true })
        company = await company.map(ul => ul.account.toString())
        users = users.concat(company)
        console.log(users);
        Transaction.find({
            $and: [{ account: account_id }, {
                $or: [
                    { hidden: { $exists: false } }, // Include if hidden field doesn't exist
                    { hidden: false }               // Include if hidden is explicitly false
                ]
            },
            {
                $or: [
                    { transaction_type: { "$regex": re } },
                    { reference_id: { "$regex": re } },
                    { wallet_id: { "$regex": re } },
                    { service_type: { "$regex": re } },
                    { type: { "$regex": re } },
                    { account: { $in: users } },
                    { sender: { $in: users } },
                    { receiver: { $in: users } }
                ]
            }]
        }).populate([
            {
                path: 'account',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'sender',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'receiver',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }
        ]).sort({ createdAt: -1 }).skip(skip).limit(limit).then(async (transactionList) => {
            if (transactionList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Account transactions!",
                    transactionList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No transaction found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting transactions!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.searchTransactionByDate = async (req, res) => {
    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * 50
        if (limit > 100) {
            limit = 100;
        }
        let data = await decryption(req.body.data)
        // let data = req.body;
        var { from, to, query } = data;

        let queryObj = {
            $and: [{
                createdAt: {
                    $gte: new Date(from + "T00:00:00.000Z"),
                    $lte: new Date(to + "T23:59:59.999Z")
                }
            }, {
                $or: [
                    { hidden: { $exists: false } },  // hidden chek is not available
                    { hidden: false }                // hidden is false
                ]
            }]
        };

        const re = new RegExp(query, 'i');
        let users = await User.find({ $or: [{ first_name: re }, { last_name: re }] }, { account: true })
        users = await users.map(ul => ul.account.toString())
        let company = await Company.find({ company_name: re }, { account: true })
        company = await company.map(ul => ul.account.toString())
        users = users.concat(company);
        if (query) {
            queryObj['$and'].push({
                $or: [
                    { transaction_type: { "$regex": re } },
                    { reference_id: { "$regex": re } },
                    { wallet_id: { "$regex": re } },
                    { service_type: { "$regex": re } },
                    { type: { "$regex": re } },
                    { account: { $in: users } },
                    { sender: { $in: users } },
                    { receiver: { $in: users } }
                ]
            })
        }
        Transaction.find(queryObj).populate([
            {
                path: 'account',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'sender',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' },
                    { path: 'country', select: 'country_name -_id' }
                ])
            }, {
                path: 'receiver',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' },
                    { path: 'country', select: 'country_name -_id' }
                ])
            }
        ]).sort({ createdAt: -1 }).skip(skip).limit(limit).then(async (transactionList) => {
            if (transactionList.length) {
                const totalTransactions = await Transaction.countDocuments()
                let ciphertext = await encryption({
                    status: true,
                    message: "Account transactions!",
                    transactionList,
                    totalTransactions
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No transaction found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting transactions!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.searchAccountTransactionByDate = async (req, res) => {
    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * 50
        if (limit > 100) {
            limit = 100;
        }
        let data = await decryption(req.body.data)
        // let data = req.body;
        var { from, to, query } = data;

        let account_id = req.params.account_id;
        let queryObj = {
            $and: [{ account: account_id }, {
                createdAt: {
                    $gte: new Date(from + "T00:00:00.000Z"),
                    $lte: new Date(to + "T23:59:59.999Z")
                }
            },
            {
                $or: [
                    { hidden: { $exists: false } },  // hidden chek is not available
                    { hidden: false }                // hidden is false
                ]
            }
            ]
        };

        const re = new RegExp(query, 'i');
        let users = await User.find({ $or: [{ first_name: re }, { last_name: re }] }, { account: true })
        users = await users.map(ul => ul.account.toString())
        let company = await Company.find({ company_name: re }, { account: true })
        company = await company.map(ul => ul.account.toString())
        users = users.concat(company);
        if (query) {
            queryObj['$and'].push({
                $or: [
                    { transaction_type: { "$regex": re } },
                    { reference_id: { "$regex": re } },
                    { wallet_id: { "$regex": re } },
                    { service_type: { "$regex": re } },
                    { type: { "$regex": re } },
                    { account: { $in: users } },
                    { sender: { $in: users } },
                    { receiver: { $in: users } }
                ]
            })
        }
        Transaction.find(queryObj).populate([
            {
                path: 'account',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'sender',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'receiver',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }
        ]).sort({ createdAt: -1 }).skip(skip).limit(limit).then(async (transactionList) => {
            if (transactionList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Account transactions!",
                    transactionList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No transaction found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting transactions!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.searchTransactionsBasedOnType = async (req, res) => {
    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        let account_id = req.params.account_id;
        let service_name = req.params.service_name;

        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * 50
        if (limit > 100) {
            limit = 100;
        }

        Transaction.find({
            $and: [
                { account: account_id },
                { payment_type: service_name },
                {
                    $or: [
                        { hidden: { $exists: false } },
                        { hidden: false }
                    ]
                }
            ]
        })
            .populate([
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
                    select: 'user company',
                    populate: [
                        { path: 'user', select: 'first_name last_name' },
                        { path: 'company', select: 'company_name' }
                    ]
                },
                {
                    path: 'receiver',
                    select: 'user company',
                    populate: [
                        { path: 'user', select: 'first_name last_name' },
                        { path: 'company', select: 'company_name' }
                    ]
                }
            ])
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .then(async (transactionList) => {
                if (transactionList.length) {
                    const ciphertext = await encryption({
                        status: true,
                        message: "Account transactions!",
                        transactionList
                    });
                    res.status(200).send(ciphertext);
                } else {
                    const error = await encryption({
                        status: false,
                        message: "No transaction found!"
                    });
                    res.status(404).send(error);
                }
            })
            .catch(async (err) => {
                console.log(err);
                const error = await encryption({
                    status: false,
                    message: "Something went wrong while getting transactions!"
                });
                res.status(400).send(error);
            });
    } catch (err) {
        console.log(err);
        const error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

// wallet transactions
module.exports.getAllTransactionByWallet = async (req, res) => {

    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        let walletId = req.params.wallet_id
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * 50
        if (limit > 100) {
            limit = 100;
        }
        Transaction.find({
            $and: [{ wallet_id: walletId },
            {
                $or: [
                    { hidden: { $exists: false } },  // hidden chek is not available
                    { hidden: false }                // hidden is false
                ]
            }
            ]
        }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate([
            {
                path: 'account',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'sender',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'receiver',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }
        ]).then(async (transactionList) => {
            if (transactionList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Account transactions!",
                    transactionList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No transaction found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting transactions!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.getWalletTransactionByDate = async (req, res) => {
    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * 50
        if (limit > 100) {
            limit = 100;
        }
        let data = await decryption(req.body.data)
        // let data = req.body.data;
        var { from, to, query } = data;
        let walletId = req.params.walletId;
        let queryObj = {
            $and: [{ wallet_id: walletId }, {
                createdAt: {
                    $gte: new Date(from + "T00:00:00.000Z"),
                    $lte: new Date(to + "T23:59:59.999Z")
                }
            }, {
                $or: [
                    { hidden: { $exists: false } },  // hidden chek is not available
                    { hidden: false }                // hidden is false
                ]
            }]
        };

        const re = new RegExp(query, 'i');
        let users = await User.find({ $or: [{ first_name: re }, { last_name: re }] }, { account: true })
        users ? users = await users.map(ul => ul.account.toString()) : users = '';
        let company = await Company.find({ company_name: re }, { account: true })
        company ? company = await company.map(ul => ul.account.toString()) : company = '';
        users = users.concat(company);
        if (query) {
            queryObj['$and'].push({
                $or: [
                    { transaction_type: { "$regex": re } },
                    { reference_id: { "$regex": re } },
                    { wallet_id: { "$regex": re } },
                    { service_type: { "$regex": re } },
                    { type: { "$regex": re } },
                    { account: { $in: users } },
                    { sender: { $in: users } },
                    { receiver: { $in: users } }
                ]
            })
        }
        Transaction.find(queryObj).populate([
            {
                path: 'account',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'sender',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'receiver',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }
        ]).sort({ createdAt: -1 }).skip(skip).limit(limit).then(async (transactionList) => {
            if (transactionList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Account transactions!",
                    transactionList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No transaction found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting transactions!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.searchWalletTransaction = async (req, res) => {
    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * 50
        if (limit > 100) {
            limit = 100;
        }
        let wallet_id = req.params.wallet_id;
        let query = req.params.query;
        const re = new RegExp(query, 'i');
        let users = await User.find({ $or: [{ first_name: re }, { last_name: re }] }, { account: true })
        users = await users.map(ul => ul.account.toString())
        let company = await Company.find({ company_name: re }, { account: true })
        company = await company.map(ul => ul.account.toString())
        users = users.concat(company)
        Transaction.find({
            $and: [{ wallet_id: wallet_id },
            {
                $or: [
                    { hidden: { $exists: false } },  // hidden chek is not available
                    { hidden: false }                // hidden is false
                ]
            }, {
                $or: [
                    { transaction_type: { "$regex": re } },
                    { reference_id: { "$regex": re } },
                    { wallet_id: { "$regex": re } },
                    { service_type: { "$regex": re } },
                    { type: { "$regex": re } },
                    { account: { $in: users } },
                    { sender: { $in: users } },
                    { receiver: { $in: users } }
                ]
            }]
        }).populate([
            {
                path: 'account',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'sender',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'receiver',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }
        ]).sort({ createdAt: -1 }).skip(skip).limit(limit).then(async (transactionList) => {
            if (transactionList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Account transactions!",
                    transactionList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No transaction found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting transactions!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}


// module.exports.addUserTransactionCategory = async (req, res) => {
//     try {

//         let data = await decryption(req.body.data)
//         // let data = req.body;
//         var { account_id, name } = data;


//         let categoryObj = { account: account_id, name }

//         Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).then(async (account) => {
//             if (account) {
//                 TransactionCategory.findOne({ $and: [{ account: account_id }, { name: name }] }).then(async (categoryFound) => {
//                     if (!categoryFound) {
//                         TransactionCategory.create(categoryObj).then(async (categoryCreated) => {
//                             let ciphertext = await encryption({
//                                 status: true,
//                                 message: "Transaction category created successfully.",
//                                 transactionCategory: categoryCreated
//                             })
//                             res.status(200).send(ciphertext)
//                         }).catch(async (err) => {
//                             console.log(err);
//                             let error = await encryption({
//                                 status: false,
//                                 message: "Something went wrong while adding new category."
//                             })
//                             res.status(400).send(error)
//                         })
//                     } else {
//                         let error = await encryption({
//                             status: false,
//                             message: "Already exist."
//                         })
//                         res.status(400).send(error)
//                     }
//                 }).catch(async (err) => {
//                     let error = await encryption({
//                         status: false,
//                         message: "Something went wrong while adding new category."
//                     })
//                     res.status(400).send(error)
//                 })
//             } else {
//                 let error = await encryption({
//                     status: false,
//                     message: "Account not found!"
//                 })
//                 res.status(404).send(error)
//             }
//         }).catch(async (err) => {
//             let error = await encryption({
//                 status: false,
//                 message: "Something went wrong while getting account details."
//             })
//             res.status(400).send(error)
//         })
//     } catch (err) {
//         console.log(err);
//         let error = await encryption({
//             status: false,
//             message: "Internal server error!"
//         })
//         res.status(500).send(error)
//     }
// }

// user categories

module.exports.addUserTransactionCategory = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        const { account_id, name, type } = data;

        let categoryObj = { account: account_id, name, type };

        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).then(async (account) => {
            if (account) {
                TransactionCategory.findOne({ $and: [{ account: account_id }, { name: name }] }).then(async (categoryFound) => {
                    if (!categoryFound) {
                        TransactionCategory.create(categoryObj).then(async (categoryCreated) => {
                            let ciphertext = await encryption({
                                status: true,
                                message: "Transaction category created successfully.",
                                transactionCategory: categoryCreated
                            });
                            res.status(200).send(ciphertext);
                        }).catch(async (err) => {
                            console.log(err);
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while adding a new category."
                            });
                            res.status(400).send(error);
                        });
                    } else {
                        let error = await encryption({
                            status: false,
                            message: "Already exists."
                        });
                        res.status(400).send(error);
                    }
                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while adding a new category."
                    });
                    res.status(400).send(error);
                });
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found!"
                });
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details."
            });
            res.status(400).send(error);
        });
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.editUserTransactionCategory = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        const { account_id, newName, categoryId } = data;

        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).then(async (account) => {
            if (account) {
                TransactionCategory.findOne({ _id: categoryId, account: account_id }).then(async (categoryFound) => {
                    if (categoryFound) {
                        TransactionCategory.findOne({ account: account_id, name: newName }).then(async (categoryWithNewName) => {
                            if (!categoryWithNewName || categoryWithNewName._id.equals(categoryFound._id)) {
                                categoryFound.name = newName;
                                categoryFound.save().then(async (categoryUpdated) => {
                                    let ciphertext = await encryption({
                                        status: true,
                                        message: "Transaction category updated successfully.",
                                        transactionCategory: categoryUpdated
                                    });
                                    res.status(200).send(ciphertext);
                                }).catch(async (err) => {
                                    console.log(err);
                                    let error = await encryption({
                                        status: false,
                                        message: "Something went wrong while updating the category."
                                    });
                                    res.status(400).send(error);
                                });
                            } else {
                                let error = await encryption({
                                    status: false,
                                    message: "A category with this name already exists."
                                });
                                res.status(400).send(error);
                            }
                        }).catch(async (err) => {
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while checking the new name."
                            });
                            res.status(400).send(error);
                        });
                    } else {
                        let error = await encryption({
                            status: false,
                            message: "Category not found for the specified account."
                        });
                        res.status(404).send(error);
                    }
                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Category not found for the specified account."
                    });
                    res.status(404).send(error);
                });
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found!"
                });
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details."
            });
            res.status(400).send(error);
        });
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.deleteUserTransactionCategory = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        const { account_id, categoryId, type } = data;

        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).then(async (account) => {
            if (account) {
                TransactionCategory.findOne({ _id: categoryId, account: account_id }).then(async (categoryFound) => {
                    if (categoryFound) {
                        if (categoryFound.type === type) {
                            categoryFound.deleteOne().then(async () => {
                                let ciphertext = await encryption({
                                    status: true,
                                    message: "Transaction category deleted successfully."
                                });
                                res.status(200).send(ciphertext);
                            }).catch(async (err) => {
                                console.log(err);
                                let error = await encryption({
                                    status: false,
                                    message: "Something went wrong while deleting the category."
                                });
                                res.status(400).send(error);
                            });
                        } else {
                            let error = await encryption({
                                status: false,
                                message: "You do not have permission to delete this category."
                            });
                            res.status(403).send(error);
                        }
                    } else {
                        let error = await encryption({
                            status: false,
                            message: "Category not found for the specified account."
                        });
                        res.status(404).send(error);
                    }
                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Category not found for the specified account."
                    });
                    res.status(404).send(error);
                });
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found!"
                });
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details."
            });
            res.status(400).send(error);
        });
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.getUserTransactionCategory = async (req, res) => {
    try {
        let account_id = req.params.account_id
        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).then(async (account) => {
            if (account) {
                TransactionCategory.find({ account: account_id }).then(async (categoryList) => {
                    if (categoryList.length) {
                        let ciphertext = await encryption({
                            status: true,
                            message: "Transaction category list.",
                            transactionCategoryList: categoryList
                        })
                        res.status(200).send(ciphertext)

                    } else {
                        let error = await encryption({
                            status: false,
                            message: "No category found."
                        })
                        res.status(400).send(error)
                    }
                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while adding new category."
                    })
                    res.status(400).send(error)
                })
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details."
            })
            res.status(400).send(error)
        })
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.getAllUserTransactionCategory = async (req, res) => {
    try {
        const account_id = req.params.account_id;
        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).then(async (account) => {
            if (account) {
                TransactionCategory.find({
                    $or: [
                        { $and: [{ account: account_id }, { type: "user" }] },
                        { $and: [{ type: "admin" }] }
                    ]
                }).then(async (categoryList) => {
                    if (categoryList.length) {
                        let ciphertext = await encryption({
                            status: true,
                            message: "Transaction category list.",
                            transactionCategoryList: categoryList
                        });
                        res.status(200).send(ciphertext);
                    } else {
                        let error = await encryption({
                            status: false,
                            message: "No categories found for this account."
                        });
                        res.status(404).send(error);
                    }
                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while fetching categories."
                    });
                    res.status(400).send(error);
                });
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found or not active!"
                });
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details."
            });
            res.status(400).send(error);
        });
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

// admin categories
module.exports.addAdminTransactionCategory = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        const { account_id, name, type } = data;

        let categoryObj = { account: account_id, name, type };

        Admin.findOne({ $and: [{ _id: account_id }] }).then(async (admin) => {
            if (admin) {
                TransactionCategory.findOne({ $and: [{ account: account_id }, { name: name }] }).then(async (categoryFound) => {
                    if (!categoryFound) {
                        TransactionCategory.create(categoryObj).then(async (categoryCreated) => {
                            let ciphertext = await encryption({
                                status: true,
                                message: "Transaction category created successfully.",
                                transactionCategory: categoryCreated
                            });
                            res.status(200).send(ciphertext);
                        }).catch(async (err) => {
                            console.log(err);
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while adding a new category."
                            });
                            res.status(400).send(error);
                        });
                    } else {
                        let error = await encryption({
                            status: false,
                            message: "Already exists."
                        });
                        res.status(400).send(error);
                    }
                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while adding a new category."
                    });
                    res.status(400).send(error);
                });
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found!"
                });
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details."
            });
            res.status(400).send(error);
        });
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.editAdminTransactionCategory = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        const { newName, categoryId } = data;

        TransactionCategory.findOne({ _id: categoryId }).then(async (categoryFound) => {
            if (categoryFound) {
                // Check if the new name already exists
                TransactionCategory.findOne({ _id: categoryId, name: newName }).then(async (categoryWithNewName) => {
                    if (!categoryWithNewName || categoryWithNewName._id.equals(categoryFound._id)) {
                        // Update the category with the new name
                        categoryFound.name = newName;
                        categoryFound.save().then(async (categoryUpdated) => {
                            let ciphertext = await encryption({
                                status: true,
                                message: "Transaction category updated successfully.",
                                transactionCategory: categoryUpdated
                            });
                            res.status(200).send(ciphertext);
                        }).catch(async (err) => {
                            console.log(err);
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while updating the category."
                            });
                            res.status(400).send(error);
                        });
                    } else {
                        let error = await encryption({
                            status: false,
                            message: "A category with this name already exists."
                        });
                        res.status(400).send(error);
                    }
                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while checking the new name."
                    });
                    res.status(400).send(error);
                });
            } else {
                let error = await encryption({
                    status: false,
                    message: "Category not found for the specified account."
                });
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting category details."
            });
            res.status(400).send(error);
        });
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.deleteAdminTransactionCategory = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        const { categoryId } = data;

        TransactionCategory.findOne({ _id: categoryId }).then(async (categoryFound) => {
            if (categoryFound) {
                categoryFound.deleteOne().then(async () => {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Transaction category deleted successfully."
                    });
                    res.status(200).send(ciphertext);
                }).catch(async (err) => {
                    console.log(err);
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while deleting the category."
                    });
                    res.status(400).send(error);
                });
            } else {
                let error = await encryption({
                    status: false,
                    message: "Category not found."
                });
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting category details."
            });
            res.status(400).send(error);
        });
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.getAdminTransactionCategory = async (req, res) => {
    try {
        TransactionCategory.find({ type: "admin" }).then(async (categoryList) => {
            if (categoryList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Admin transaction category list.",
                    transactionCategoryList: categoryList
                });
                res.status(200).send(ciphertext);
            } else {
                let error = await encryption({
                    status: false,
                    message: "No admin categories found."
                });
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while fetching admin categories."
            });
            res.status(400).send(error);
        });
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.getUserTransactionCategoryByUser = async (req, res) => {
    try {
        const account_id = req.params.account_id;

        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).then(async (account) => {
            if (account) {
                TransactionCategory.find({ account: account_id, type: "user" }).then(async (categoryList) => {
                    if (categoryList.length) {
                        let ciphertext = await encryption({
                            status: true,
                            message: "User transaction category list.",
                            transactionCategoryList: categoryList
                        });
                        res.status(200).send(ciphertext);
                    } else {
                        let error = await encryption({
                            status: false,
                            message: "No user categories found for this account."
                        });
                        res.status(404).send(error);
                    }
                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while fetching user categories."
                    });
                    res.status(400).send(error);
                });
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found or not active!"
                });
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details."
            });
            res.status(400).send(error);
        });
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.addTransactionsByCategory = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        const { transaction_id, categories, note } = data;

        if (!transaction_id || categories.length === 0) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }
        Transaction.findById(transaction_id).then(async (transactionFound) => {
            if (!transactionFound) {
                let error = await encryption({
                    status: false,
                    message: "Transaction not found"
                });
                return res.status(404).send(error);
            }
            else {
                const newCategories = categories.filter(category => !transactionFound.categories.includes(category));
                const mergedCategories = [...new Set([...transactionFound.categories, ...newCategories])];

                Transaction.findByIdAndUpdate(transactionFound._id, { categories: mergedCategories, note: note }, { new: true }).then(async (categoryUpdated) => {
                    if (categoryUpdated) {
                        let ciphertext = await encryption({
                            status: true,
                            message: "Categories added succesfully",
                            transactionCategory: mergedCategories
                        });
                        res.status(200).send(ciphertext);
                    }
                    else {
                        let error = await encryption({
                            status: false,
                            message: "Transaction could not be updated!"
                        });
                        res.status(400).send(error);
                    }
                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while updating categories"
                    });
                    res.status(400).send(error);
                });
            }
        })
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

module.exports.getUserTransactionsByCountry = async (req, res) => {
    try {
        const { account_id } = req.params;
        if (!account_id) {
            let error = await encryption({
                status: false,
                message: "Something is missing!"
            });
            res.status(400).send(error);
        } else {
            Account.findById(account_id, { _id: 1 }).then(async (acountFound) => {
                if (!acountFound) {
                    let error = await encryption({
                        status: false,
                        message: "User not found!"
                    });
                    res.status(404).send(error);
                } else {
                    Transaction.find({ sender: acountFound._id }, {
                        receiver: true,
                        amount: true,
                        transaction_type: true,
                        currency: true,
                    }).populate([
                        {
                            path: 'receiver',
                            select: 'user company',
                            populate: ([
                                { path: 'user', select: 'account', populate: { path: 'account', select: 'country_name' } },
                                { path: 'company', select: 'account', populate: { path: 'account', select: 'country_name' } }
                            ])
                        }
                    ])
                        .then(async (transactions) => {
                            const result = {};

                            transactions?.forEach((item) => {
                                const country = item.receiver?.user ? item.receiver?.user?.account?.country_name : item.receiver?.company?.account?.country_name;
                                const amount = item.amount;
                                const transactionType = item.transaction_type;
                                const currencyCode = item.currency?.code;

                                if (!result[country]) {
                                    result[country] = {
                                        CountryName: country,
                                        totalamount: amount,
                                        totaltransaction: 1,
                                        [currencyCode]: {
                                            debit: transactionType === 'debit' ? amount : 0,
                                            credit: transactionType === 'credit' ? amount : 0,
                                        },
                                    };
                                } else {
                                    result[country].totalamount += amount;
                                    result[country].totaltransaction++;
                                    if (!result[country][currencyCode]) {
                                        result[country][currencyCode] = {
                                            debit: transactionType === 'debit' ? amount : 0,
                                            credit: transactionType === 'credit' ? amount : 0,
                                        };
                                    } else {
                                        result[country][currencyCode].debit += transactionType === 'debit' ? amount : 0;
                                        result[country][currencyCode].credit += transactionType === 'credit' ? amount : 0;
                                    }
                                }
                            });

                            const sendData = Object.values(result);
                            let data = await encryption({
                                message: "Countries wise transactions",
                                status: true,
                                sendData
                            });
                            res.status(200).send(data);
                        }).catch(async (err) => {
                            console.log(err);
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while finding transaction!"
                            });
                            res.status(400).send(error);
                        });
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while finding user!"
                });
                res.status(400).send(error);
            });
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

module.exports.getTransactionsByServiceType = async (req, res) => {
    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * 50
        if (limit > 100) {
            limit = 100;
        }
        let data = await decryption(req.body.data)
        // let data = req.body.data;
        var { from, to, query } = data;

        let account_id = req.params.account_id;
        let queryObj = {
            $and: [{ account: account_id }, {
                createdAt: {
                    $gte: new Date(from + "T00:00:00.000Z"),
                    $lte: new Date(to + "T23:59:59.999Z")
                }
            }, {
                $or: [
                    { hidden: { $exists: false } },  // hidden chek is not available
                    { hidden: false }                // hidden is false
                ]
            }]
        };

        const re = new RegExp(query, 'i');
        let users = await User.find({ $or: [{ first_name: re }, { last_name: re }] }, { account: true })
        users = await users.map(ul => ul.account.toString())
        let company = await Company.find({ company_name: re }, { account: true })
        company = await company.map(ul => ul.account.toString())
        users = users.concat(company);
        if (query) {
            queryObj['$and'].push({
                $or: [
                    { transaction_type: { "$regex": re } },
                    { reference_id: { "$regex": re } },
                    { wallet_id: { "$regex": re } },
                    { service_type: { "$regex": re } },
                    { type: { "$regex": re } },
                    { account: { $in: users } },
                    { sender: { $in: users } },
                    { receiver: { $in: users } }
                ]
            })
        }
        Transaction.find(queryObj).populate([
            {
                path: 'account',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'sender',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'receiver',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }
        ]).sort({ createdAt: -1 }).skip(skip).limit(limit).then(async (transactionList) => {
            if (transactionList.length) {
                const transactionsByServiceTypeAndCurrency = {};
                transactionList.forEach(transaction => {
                    const { service_type, currency } = transaction;
                    if (!transactionsByServiceTypeAndCurrency[service_type]) {
                        transactionsByServiceTypeAndCurrency[service_type] = {};
                    }
                    if (!transactionsByServiceTypeAndCurrency[service_type][currency.code]) {
                        transactionsByServiceTypeAndCurrency[service_type][currency.code] = [];
                    }
                    transactionsByServiceTypeAndCurrency[service_type][currency.code].push(transaction);
                });
                let ciphertext = await encryption({
                    status: true,
                    message: "Account transactions by types!",
                    transactionsByServiceTypeAndCurrency
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No transaction found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting transactions!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

const findTransactionsWalletToWallet = async (transactionType, from, to, skip, limit) => {
    const transactions = await Transaction.find({
        service_type: 'wallet_to_wallet',
        transaction_type: transactionType,
        createdAt: {
            $gte: new Date(from + "T00:00:00.000Z"),
            $lte: new Date(to + "T23:59:59.999Z")
        }
    }).sort({ createdAt: -1 }).skip(skip).limit(limit);

    const totalFee = transactions.reduce((acc, transaction) => acc + transaction.fee, 0);
    const totalMarkup = transactions.reduce((acc, transaction) => acc + transaction.markup, 0);

    return { transactions, totalFee, totalMarkup };
};

const findTransactionsConversion = async (transactionType, from, to, skip, limit) => {
    const transactions = await Transaction.find({
        service_type: 'conversion',
        transaction_type: transactionType,
        createdAt: {
            $gte: new Date(from + "T00:00:00.000Z"),
            $lte: new Date(to + "T23:59:59.999Z")
        }
    }).sort({ createdAt: -1 }).skip(skip).limit(limit);

    const totalFee = transactions.reduce((acc, transaction) => acc + transaction.fee, 0);
    const totalMarkup = transactions.reduce((acc, transaction) => acc + transaction.markup, 0);

    return { transactions, totalFee, totalMarkup };
};

const findTransactionsWithdrawByAdmin = async (transactionType, from, to, skip, limit) => {
    const transactions = await Transaction.find({
        service_type: 'withdraw_by_admin',
        transaction_type: transactionType,
        createdAt: {
            $gte: new Date(from + "T00:00:00.000Z"),
            $lte: new Date(to + "T23:59:59.999Z")
        }
    }).sort({ createdAt: -1 }).skip(skip).limit(limit);

    const totalFee = transactions.reduce((acc, transaction) => acc + transaction.fee, 0);
    const totalMarkup = transactions.reduce((acc, transaction) => acc + transaction.markup, 0);

    return { transactions, totalFee, totalMarkup };
};

const findTransactionsDepositeByAdmin = async (transactionType, from, to, skip, limit) => {
    const transactions = await Transaction.find({
        service_type: 'deposite_by_admin',
        transaction_type: transactionType,
        createdAt: {
            $gte: new Date(from + "T00:00:00.000Z"),
            $lte: new Date(to + "T23:59:59.999Z")
        }
    }).sort({ createdAt: -1 }).skip(skip).limit(limit);

    const totalFee = transactions.reduce((acc, transaction) => acc + transaction.fee, 0);
    const totalMarkup = transactions.reduce((acc, transaction) => acc + transaction.markup, 0);

    return { transactions, totalFee, totalMarkup };
};

const findTransactionsQRPay = async (transactionType, from, to, skip, limit) => {
    const transactions = await Transaction.find({
        payment_type: 'qr_payment',
        transaction_type: transactionType,
        createdAt: {
            $gte: new Date(from + "T00:00:00.000Z"),
            $lte: new Date(to + "T23:59:59.999Z")
        }
    }).sort({ createdAt: -1 }).skip(skip).limit(limit);

    const totalFee = transactions.reduce((acc, transaction) => acc + transaction.fee, 0);
    const totalMarkup = transactions.reduce((acc, transaction) => acc + transaction.markup, 0);

    return { transactions, totalFee, totalMarkup };
};

const findTransactionsPaymentRequest = async (transactionType, from, to, skip, limit) => {
    const transactions = await Transaction.find({
        payment_type: 'payment_request',
        transaction_type: transactionType,
        createdAt: {
            $gte: new Date(from + "T00:00:00.000Z"),
            $lte: new Date(to + "T23:59:59.999Z")
        }
    }).sort({ createdAt: -1 }).skip(skip).limit(limit);

    const totalFee = transactions.reduce((acc, transaction) => acc + transaction.fee, 0);
    const totalMarkup = transactions.reduce((acc, transaction) => acc + transaction.markup, 0);

    return { transactions, totalFee, totalMarkup };
};

const findTransactionsPaymentAddress = async (transactionType, from, to, skip, limit) => {
    const transactions = await Transaction.find({
        payment_type: 'payment_address',
        transaction_type: transactionType,
        createdAt: {
            $gte: new Date(from + "T00:00:00.000Z"),
            $lte: new Date(to + "T23:59:59.999Z")
        }
    }).sort({ createdAt: -1 }).skip(skip).limit(limit);

    const totalFee = transactions.reduce((acc, transaction) => acc + transaction.fee, 0);
    const totalMarkup = transactions.reduce((acc, transaction) => acc + transaction.markup, 0);

    return { transactions, totalFee, totalMarkup };
};


module.exports.getTransactionsAdmin = async (req, res) => {
    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        if (skip < 1) { skip = 1; }
        skip = (skip - 1) * 50;
        if (limit > 100) {
            limit = 100;
        }
        let data = await decryption(req.body.data);
        var { from, to } = data;

        const transactions = {
            wallet_to_wallet: { credit: { transactions: [], totalFee: 0, totalMarkup: 0 }, debit: { transactions: [], totalFee: 0, totalMarkup: 0 } },
            conversion: { credit: { transactions: [], totalFee: 0, totalMarkup: 0 }, debit: { transactions: [], totalFee: 0, totalMarkup: 0 } },
            withdraw_by_admin: { credit: { transactions: [], totalFee: 0, totalMarkup: 0 }, debit: { transactions: [], totalFee: 0, totalMarkup: 0 } },
            deposite_by_admin: { credit: { transactions: [], totalFee: 0, totalMarkup: 0 }, debit: { transactions: [], totalFee: 0, totalMarkup: 0 } },
            qr_pay: { credit: { transactions: [], totalFee: 0, totalMarkup: 0 }, debit: { transactions: [], totalFee: 0, totalMarkup: 0 } },
            payment_request: { credit: { transactions: [], totalFee: 0, totalMarkup: 0 }, debit: { transactions: [], totalFee: 0, totalMarkup: 0 } },
            payment_address: { credit: { transactions: [], totalFee: 0, totalMarkup: 0 }, debit: { transactions: [], totalFee: 0, totalMarkup: 0 } },
        };

        const functionsToCall = [
            findTransactionsWalletToWallet('credit', from, to, skip, limit),
            findTransactionsWalletToWallet('debit', from, to, skip, limit),
            findTransactionsConversion('credit', from, to, skip, limit),
            findTransactionsConversion('debit', from, to, skip, limit),
            findTransactionsWithdrawByAdmin('credit', from, to, skip, limit),
            findTransactionsWithdrawByAdmin('debit', from, to, skip, limit),
            findTransactionsDepositeByAdmin('credit', from, to, skip, limit),
            findTransactionsDepositeByAdmin('debit', from, to, skip, limit),
            findTransactionsQRPay('credit', from, to, skip, limit),
            findTransactionsQRPay('debit', from, to, skip, limit),
            findTransactionsPaymentRequest('credit', from, to, skip, limit),
            findTransactionsPaymentRequest('debit', from, to, skip, limit),
            findTransactionsPaymentAddress('credit', from, to, skip, limit),
            findTransactionsPaymentAddress('debit', from, to, skip, limit),
        ];

        const [
            walletToWalletCredit,
            walletToWalletDebit,
            conversionCredit,
            conversionDebit,
            withdrawByAdminCredit,
            withdrawByAdminDebit,
            depositeByAdminCredit,
            depositeByAdminDebit,
            qrPayCredit,
            qrPayDebit,
            paymentRequestCredit,
            paymentRequestDebit,
            paymentAddressCredit,
            paymentAddressDebit
        ] = await Promise.all(functionsToCall);

        transactions.wallet_to_wallet.credit.transactions = walletToWalletCredit.transactions;
        transactions.wallet_to_wallet.credit.totalFee = walletToWalletCredit.totalFee;
        transactions.wallet_to_wallet.credit.totalMarkup = walletToWalletCredit.totalMarkup;
        transactions.wallet_to_wallet.debit.transactions = walletToWalletDebit.transactions;
        transactions.wallet_to_wallet.debit.totalFee = walletToWalletDebit.totalFee;
        transactions.wallet_to_wallet.debit.totalMarkup = walletToWalletDebit.totalMarkup;

        transactions.conversion.credit.transactions = conversionCredit.transactions;
        transactions.conversion.credit.totalFee = conversionCredit.totalFee;
        transactions.conversion.credit.totalMarkup = conversionCredit.totalMarkup;
        transactions.conversion.debit.transactions = conversionDebit.transactions;
        transactions.conversion.debit.totalFee = conversionDebit.totalFee;
        transactions.conversion.debit.totalMarkup = conversionDebit.totalMarkup;

        transactions.withdraw_by_admin.credit.transactions = withdrawByAdminCredit.transactions;
        transactions.withdraw_by_admin.credit.totalFee = withdrawByAdminCredit.totalFee;
        transactions.withdraw_by_admin.credit.totalMarkup = withdrawByAdminCredit.totalMarkup;
        transactions.withdraw_by_admin.debit.transactions = withdrawByAdminDebit.transactions;
        transactions.withdraw_by_admin.debit.totalFee = withdrawByAdminDebit.totalFee;
        transactions.withdraw_by_admin.debit.totalMarkup = withdrawByAdminDebit.totalMarkup;

        transactions.deposite_by_admin.credit.transactions = depositeByAdminCredit.transactions;
        transactions.deposite_by_admin.credit.totalFee = depositeByAdminCredit.totalFee;
        transactions.deposite_by_admin.credit.totalMarkup = depositeByAdminCredit.totalMarkup;
        transactions.deposite_by_admin.debit.transactions = depositeByAdminDebit.transactions;
        transactions.deposite_by_admin.debit.totalFee = depositeByAdminDebit.totalFee;
        transactions.deposite_by_admin.debit.totalMarkup = depositeByAdminDebit.totalMarkup;

        transactions.qr_pay.credit.transactions = qrPayCredit.transactions;
        transactions.qr_pay.credit.totalFee = qrPayCredit.totalFee;
        transactions.qr_pay.credit.totalMarkup = qrPayCredit.totalMarkup;
        transactions.qr_pay.debit.transactions = qrPayDebit.transactions;
        transactions.qr_pay.debit.totalFee = qrPayDebit.totalFee;
        transactions.qr_pay.debit.totalMarkup = qrPayDebit.totalMarkup;

        transactions.payment_request.credit.transactions = paymentRequestCredit.transactions;
        transactions.payment_request.credit.totalFee = paymentRequestCredit.totalFee;
        transactions.payment_request.credit.totalMarkup = paymentRequestCredit.totalMarkup;
        transactions.payment_request.debit.transactions = paymentRequestDebit.transactions;
        transactions.payment_request.debit.totalFee = paymentRequestDebit.totalFee;
        transactions.payment_request.debit.totalMarkup = paymentRequestDebit.totalMarkup;

        transactions.payment_address.credit.transactions = paymentAddressCredit.transactions;
        transactions.payment_address.credit.totalFee = paymentAddressCredit.totalFee;
        transactions.payment_address.credit.totalMarkup = paymentAddressCredit.totalMarkup;
        transactions.payment_address.debit.transactions = paymentAddressDebit.transactions;
        transactions.payment_address.debit.totalFee = paymentAddressDebit.totalFee;
        transactions.payment_address.debit.totalMarkup = paymentAddressDebit.totalMarkup;

        // const allData = {
        //     totalTransactions: 0,
        //     totalAmount: 0,
        // };

        // Object.keys(transactions).forEach((type) => {
        //     const creditTransactions = transactions[type].credit.transactions;
        //     const debitTransactions = transactions[type].debit.transactions;

        //     allData.totalTransactions += creditTransactions.length + debitTransactions.length;

        //     const creditTotalAmount = creditTransactions.reduce((total, transaction) => total + transaction.amount, 0);
        //     const debitTotalAmount = debitTransactions.reduce((total, transaction) => total + transaction.amount, 0);

        //     allData.totalAmount += creditTotalAmount + debitTotalAmount;
        // });

        let ciphertext = await encryption({
            status: true,
            message: "Transaction found!",
            transactions: transactions,
            // allTransactions: allData,
        });

        return res.status(200).send(ciphertext);
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.getUserTransactionsReport = async (req, res) => {
    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        if (skip < 1) { skip = 1; }
        skip = (skip - 1) * 50;
        if (limit > 100) {
            limit = 100;
        }
        let data = await decryption(req.body.data);
        var { from, to, account_id } = data;

        Account.findById(account_id).then(async (account) => {
            if (!account) {
                let error = await encryption({
                    status: false,
                    message: "Something is missing!"
                });
                res.status(400).send(error);
            } else {
                const startWithZeroTime = new Date(from.split('T')[0] + 'T00:00:00Z');
                const endWithZeroTime = new Date(to.split('T')[0] + 'T24:00:00Z');
                let query = {
                    account: account_id,
                    createdAt: {
                        $gte: startWithZeroTime,
                        $lte: endWithZeroTime
                    }
                };
                Transaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).then(async (transactions) => {
                    if (!transactions) {
                        let error = await encryption({
                            status: false,
                            message: "No transactions found!"
                        });
                        res.status(400).send(error);
                    } else {
                        const transactionSummary = {};

                        transactions.forEach(transaction => {
                            // console.log(transaction.payment_type, "paymentye")
                            const currencyCode = transaction.currency?.code;
                            const amount = transaction.amount || 0;
                            const paymentType = transaction.payment_type || 'Uncategorized';

                            if (!transactionSummary[currencyCode]) {
                                transactionSummary[currencyCode] = {};
                            }

                            if (!transactionSummary[currencyCode][paymentType]) {
                                transactionSummary[currencyCode][paymentType] = {
                                    totalTransactions: 0,
                                    totalAmounts: 0,
                                };
                            }

                            transactionSummary[currencyCode][paymentType].totalTransactions++;
                            transactionSummary[currencyCode][paymentType].totalAmounts += amount;

                            // Update overall totals for each currency
                            if (!transactionSummary[currencyCode].total) {
                                transactionSummary[currencyCode].total = {
                                    totalTransactions: 0,
                                    totalAmounts: 0,
                                    creditAmount: 0,
                                    debitAmount: 0,

                                };
                            }

                            transactionSummary[currencyCode].total.totalTransactions++;
                            transactionSummary[currencyCode].total.totalAmounts += amount;

                            if (transaction.transaction_type === 'credit') {
                                transactionSummary[currencyCode].total.creditAmount += amount;
                            } else if (transaction.transaction_type === 'debit') {
                                transactionSummary[currencyCode].total.debitAmount += amount;
                            }
                        });
                        let ciphertext = await encryption({
                            status: true,
                            message: "Transactions found!",
                            transactionSummary
                        });
                        res.status(200).send(ciphertext);
                    }
                })
            }
        }).catch(async (err) => {
            console.log(err)
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting the account details!"
            });
            res.status(400).send(error);
        })

    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

// fail transaction
module.exports.failTransaction = async (req, res) => {
    try {
        const data = await decryption(req.body.data);
        const { transaction_id, reference_id } = data;

        let transactionDetails
        if (transaction_id) {
            transactionDetails = await Transaction.findById(transaction_id).populate('account');
        } else if (reference_id) {
            transactionDetails = await Transaction.findOne({ reference_id }).populate('account');
        } else {
            return res.status(404).send(await encryption({
                status: false,
                message: "Reference id or transaction id is required!"
            }))
        }

        if (!transactionDetails) {
            return res.status(404).send(await encryption({
                status: false,
                message: "Transaction not found!"
            }))
        }

        const accountTimezone = transactionDetails.account?.timezone || "UTC";

        transactionDetails.status = "FAILED";
        transactionDetails.hidden = false;

        const currentTime = moment().tz(accountTimezone).format();

        transactionDetails.timeline.push({
            date: currentTime,
            status: "FAILED"
        });

        await transactionDetails.save();

        const ciphertext = await encryption({
            status: true,
            message: "Transaction status updated successfully!",
            transactionDetails
        })

        return res.status(200).send(ciphertext)
    } catch (error) {
        console.error(error);
        let err = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(err);
    }
};

module.exports.getAllTransactions = async (req, res) => {
    try {
        // const data = req.body
        const data = await decryption(req.body.data);
        let { limit = 50, skip = 1, query = '', from, to } = data
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * limit;
        if (limit > 100) { limit = 100; }

        let queryObj = {}

        if (from && to) {
            queryObj['createdAt'] = {
                $gte: new Date(from + "T00:00:00.000Z"),
                $lte: new Date(to + "T23:59:59.999Z")
            };
        }

        if (query) {
            const re = new RegExp(query, 'i')

            let users = await User.find({ $or: [{ first_name: re }, { last_name: re }] });
            users = await users.map(ul => ul.account.toString());

            let company = await Company.find({ company_name: re }, { account: true });
            company = await company.map(ul => ul.account.toString());

            users = users.concat(company);

            queryObj['$or'] = [
                { transaction_type: { "$regex": re } },
                { reference_id: { "$regex": re } },
                { wallet_id: { "$regex": re } },
                { service_type: { "$regex": re } },
                { type: { "$regex": re } },
                { account: { $in: users } },
                { sender: { $in: users } },
                { receiver: { $in: users } }
            ];

        }

        Transaction.find(queryObj)
            .populate([
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
                    select: 'user company',
                    populate: [
                        { path: 'user', select: 'first_name last_name' },
                        { path: 'company', select: 'company_name' },
                        { path: 'country', select: 'country_name -_id' }
                    ]
                },
                {
                    path: 'receiver',
                    select: 'user company',
                    populate: [
                        { path: 'user', select: 'first_name last_name' },
                        { path: 'company', select: 'company_name' },
                        { path: 'country', select: 'country_name -_id' }
                    ]
                }
            ])
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .then(async (transactionList) => {
                if (transactionList.length) {
                    const totalTransactions = await Transaction.countDocuments(queryObj);
                    let ciphertext = await encryption({
                        status: true,
                        message: "Account transactions!",
                        transactionList,
                        totalTransactions
                    });
                    res.status(200).send(ciphertext);
                } else {
                    let error = await encryption({
                        status: false,
                        message: "No transaction found!"
                    });
                    res.status(404).send(error);
                }
            })
            .catch(async (err) => {
                console.error(err);
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while getting transactions!"
                });
                res.status(400).send(error);
            });

    } catch (err) {
        console.error(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

module.exports.getAccountTransactions = async (req, res) => {
    try {
        // const data = req.body;
        const data = await decryption(req.body.data);
        let { limit = 50, skip = 1, query = '', from, to, account_id } = data
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * limit;
        if (limit > 100) { limit = 100; }

        let queryObj = {
            $and: [
                { account: account_id },
                // {
                //     $or: [
                //         { hidden: { $exists: false } },  // hidden check is not available
                //         { hidden: false }                // hidden is false
                //     ]
                // }
            ]
        };

        if (from && to) {
            queryObj.$and.push({
                createdAt: {
                    $gte: new Date(from + "T00:00:00.000Z"),
                    $lte: new Date(to + "T23:59:59.999Z")
                }
            });
        }

        if (query) {
            const re = new RegExp(query, 'i');
            let users = await User.find({ $or: [{ first_name: re }, { last_name: re }] }, { account: true });
            users = users.map(ul => ul.account.toString());
            let company = await Company.find({ company_name: re }, { account: true });
            company = company.map(ul => ul.account.toString());
            users = users.concat(company);

            queryObj.$and.push({
                $or: [
                    { transaction_type: { "$regex": re } },
                    { reference_id: { "$regex": re } },
                    { wallet_id: { "$regex": re } },
                    { service_type: { "$regex": re } },
                    { type: { "$regex": re } },
                    { account: { $in: users } },
                    { sender: { $in: users } },
                    { receiver: { $in: users } }
                ]
            });
        }

        const transactionCount = await Transaction.countDocuments(queryObj);
        Transaction.find(queryObj).populate([
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
                select: 'user company',
                populate: [
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' },
                    { path: 'country', select: 'country_name -_id' }
                ]
            },
            {
                path: 'receiver',
                select: 'user company',
                populate: [
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' },
                    { path: 'country', select: 'country_name -_id' }
                ]
            }
        ]).sort({ createdAt: -1 }).skip(skip).limit(limit).then(async (transactionList) => {
            if (transactionList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Account transactions!",
                    transactionList,
                    transactionCount
                });
                res.status(200).send(ciphertext);
            } else {
                let error = await encryption({
                    status: false,
                    message: "No transaction found!"
                });
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting transactions!"
            });
            res.status(400).send(error);
        });
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};
