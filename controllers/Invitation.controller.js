const CryptoJS = require("crypto-js");
// const axios = require('axios');
const PASSWORD_ENCRYPTION_KEY = 'secretOfTheInstaPaySystemAccountPassword'
const TOKEN_KEY = 'secretOfTheInstaPaySystemAccountTOKEN'
// const Thunes_KEY = process.env.APIKEY;
// const Thunes_SECRET = process.env.APISECRET;
const Thunes_KEY = process.env.API_KEY_PROD;
const Thunes_SECRET = process.env.API_SECRET_PROD;
const secretKey = process.env.jwtKey;
const jwt = require('jsonwebtoken');
var Hashids = require('hashids');

const RequestPayment = require('../models/Request-Payment.model');
const ExternalCommission = require('../models/External-Commission.model');
const AccountLevel = require('../models/Account-Level.model');
const Wallet = require('../models/Wallet.model');
const Account = require('../models/Account.model');
const User = require('../models/User.model');
const Company = require('../models/Company.model');
const axios = require('axios');
const { encryption, decryption } = require('../configurations/Encryption')
const SecurityQuestion = require('../models/Security-Question.model')
const { addNotification } = require('../utils/generateNotification');
const { sendPrivateMessage } = require('../utils/websocket');
const { sendNotifications, sendMailsExport } = require('../utils/sendEmail');
const Commission = require('../models/Commission.model');
const { convertCurrency, sendSMSTemplate, limitCheck } = require('../utils/helpers');
const moment = require('moment-timezone');
const Transaction = require('../models/Transaction.model');
const Withdrawal = require('../models/User-Withdrawal.model');
const { calculatePayerRatesLogic, thunesBalance, formatDecimalNumbersWithLimit } = require('../utils/payerRates');
const FeeModel = require("../models/Fee.model");
const { sendMails } = require("./Account.controller");


const CreateInvitationLink = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(id)
        if (!id) {
            let error = await encryption({
                status: false,
                message: "Required Fields are empty."
            })
            res.status(400).send(error);
        }
        else {
            // User.findById(id, { _id: true }).then(async user => {
            //     console.log(user)
            //     if (!user) {
            //         let error = await encryption({
            //             status: false,
            //             message: "User not found."
            //         })
            //         res.status(404).send(error);
            //     } else {
            Account.findById(id, { username: true })
                .then(async userAccount => {
                    if (!userAccount) {
                        let error = await encryption({
                            status: false,
                            message: "User Account is not found."
                        })
                        res.status(404).send(error);
                    } else {
                        if (!userAccount.username) {
                            let error = await encryption({
                                status: false,
                                message: "Please enter your username first."
                            })
                            res.status(400).send(error);
                        } else {
                            const inviteUrl = `${"https://my.insta-pay.ch/signup/"}${userAccount.username}`;
                            let sendData = await encryption({
                                status: true,
                                message: "Invitation link created successfully.",
                                url: inviteUrl
                            })
                            res.status(200).send(sendData);
                        }
                    }
                })
                .catch(async AccountFindingError => {
                    console.log(AccountFindingError);
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while finding account."
                    })
                    res.status(500).send(error);
                })
            // let name = user.first_name.split(' ').join('');
            // let lastName = user.last_name.split(' ').join('');
            // }
            // }).catch (async userFoundErr => {
            //     console.log(userFoundErr);
            //     let error = await encryption({
            //         status: false,
            //         message: "Something went wrong while finding user."
            //     })
            //     res.status(400).send(error);
            // })
        }

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal Server Error."
        })
        res.status(500).send(error);
    }
}
const invitedSignup = async (req, res) => {
    try {
        const { username } = req.params;
        if (!username) {
            let error = await encryption({
                status: false,
                message: "Required Fields are empty."
            })
            return res.status(400).send(error);
        }
        const parent = await Account.findOne({ username: username });
        if (!parent) {
            let error = await encryption({
                status: false,
                message: "Invitation link is wrong."
            })
            return res.status(400).send(error);
        } else {
            let data = await decryption(req.body.data);
            // let data = req.body;
            data['password'] = CryptoJS.AES.encrypt(data.password, PASSWORD_ENCRYPTION_KEY).toString();
            if (data.type === 'individualAccount') {
                console.log(data.phone, data.email, "data.phone, data.email");
                const query = {};

                if (data.email) {
                    query.email = data.email.toLowerCase();
                }

                if (data.phone) {
                    query.phone = data.phone;
                }
                Account.findOne({ $or: [query] }).then(async (usr) => {
                    // console.log(usr)
                    if (!usr) {
                        let createAccountObj = {
                            email: data.email?.toLowerCase(),
                            password: data.password,
                            phone: data.phone,
                            account_type: 'individual',
                            is_external_limit: false,
                            active: true,
                            parentId: parent._id
                        }
                        let level = await AccountLevel.findOne({ $and: [{ level_no: 1 }, { account_type: 'individual' }] }, { account_type: true })
                        if (level) { createAccountObj['level'] = level._id }
                        data['email'] = data.email?.toLowerCase()
                        Account.create(createAccountObj).then(async (accData) => {
                            // console.log(accData);
                            createWallet(accData._id);
                            User.create({
                                first_name: data.first_name ? data.first_name : '',
                                last_name: data.last_name ? data.last_name : '',
                                // parentId: parent.user ? parent.user : parent.company,
                                account: accData._id
                            }).then(async (userData) => {
                                // console.log(userData);
                                Account.findByIdAndUpdate({ _id: accData._id }, { user: userData._id }, { new: true }).then(async (accountData) => {
                                    accountData['user'] = userData;
                                    // console.log(accountData);
                                    var ciphertext = await encryption({
                                        status: true,
                                        message: "Account has been registered!",
                                        accountData
                                    })
                                    res.status(200).send(ciphertext)
                                    const notificationObj = {
                                        title: 'Referral Registeration',
                                        desc: 'Congratulatoins! Your referral has joined Instapay.',
                                        type: 'referral_signup',
                                        status: 'unread',
                                        from: accountData._id,
                                        to: parent._id,
                                        link_id: accountData._id,
                                    }

                                    addNotification(notificationObj)
                                    sendPrivateMessage(parent._id, "Congratulations! Your referral has joined Instapay.")

                                    const options = {
                                        toEmail: parent.email ?? "",
                                        phoneNumber: parent.phone ?? "",
                                        instaUsername: parent.insta_username ?? "",
                                        message: `Congratulations! Your referral ${data.first_name ? data.first_name : ''} ${data.last_name ? data.last_name : ''} has joined InstaPay!`,
                                        subject: "Your referral joined Instapay Account!",
                                        templateId: "d-2d5f929ed89847d693ab15621b95890f",
                                        phoneMessage: `Congratulations! Your referral ${data.first_name ? data.first_name : ''} ${data.last_name ? data.last_name : ''} has joined InstaPay!`
                                    }

                                    // email, phone and push notifications
                                    sendNotifications(parent._id, 'referrals', options)
                                }).catch(async (err) => {
                                    console.log(err);
                                    let error = await encryption({
                                        status: false,
                                        message: "Account registration failed!"
                                    })
                                    res.status(400).send(error)
                                })
                            }).catch(async (err) => {
                                console.log(err);
                                let error = await encryption({
                                    status: false,
                                    message: "Account registration failed!"
                                })
                                res.status(400).send(error)
                            })
                        }).catch(async (err) => {
                            let error = await encryption({
                                status: false,
                                message: "Account registration failed!"
                            })
                            res.status(400).send(error)
                        })
                    } else {
                        console.log(usr?.email?.toLowerCase(), data?.email?.toLowerCase(), usr)
                        if (usr?.email?.toLowerCase() == data?.email?.toLowerCase()) {
                            let error = await encryption({
                                status: false,
                                message: "Email already exist!"
                            })
                            res.status(400).send(error)
                        } else if (usr.phone == data.phone) {
                            let error = await encryption({
                                status: false,
                                message: "Phone number already exist!"
                            })
                            res.status(400).send(error)
                        }
                    }
                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Account registration failed!"
                    })
                    res.status(400).send(error)
                })
            } else if (data.type === 'businessAccount') {
                console.log(2);
                Account.findOne({ email: data?.email?.toLowerCase() }).then(async (company) => {
                    // console.log(usr)
                    if (!company) {
                        let createAccountObj = {
                            email: data?.email?.toLowerCase(),
                            password: data.password,
                            account_type: 'business',
                            parentId: parent._id
                        }
                        let level = await AccountLevel.findOne({ $and: [{ level_no: 1 }, { account_type: 'business' }] }, { account_type: true })
                        if (level) { createAccountObj['level'] = level._id }
                        data['email'] = data?.email?.toLowerCase()
                        Account.create(createAccountObj).then(async (accData) => {
                            // console.log(accData);
                            Company.create({
                                company_name: data.company_name ? data.company_name : '',
                                // parentId: parent.user ? parent.user : parent.company,
                                account: accData._id
                            }).then(async (companyData) => {
                                // console.log(companyData);
                                Account.findByIdAndUpdate({ _id: accData._id }, { company: companyData._id }, { new: true }).then(async (accountData) => {
                                    accountData['company'] = companyData;
                                    // console.log(accountData);
                                    var ciphertext = await encryption({
                                        status: true,
                                        message: "Account has been registered!",
                                        accountData
                                    })
                                    res.status(200).send(ciphertext)
                                }).catch(async (err) => {
                                    let error = await encryption({
                                        status: false,
                                        message: "Account registration failed!"
                                    })
                                    res.status(400).send(error)
                                })
                            }).catch(async (err) => {
                                let error = await encryption({
                                    status: false,
                                    message: "Account registration failed!"
                                })
                                res.status(400).send(error)
                            })
                        }).catch(async (err) => {
                            let error = await encryption({
                                status: false,
                                message: "Account registration failed!"
                            })
                            res.status(400).send(error)
                        })
                    } else {
                        if (company?.email?.toLowerCase() == data?.email?.toLowerCase()) {
                            let error = await encryption({
                                status: false,
                                message: "Email already exist!"
                            })
                            res.status(400).send(error)
                        }
                    }
                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Account registration failed!"
                    })
                    res.status(400).send(error)
                })
            }
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal Server Error."
        })
        res.status(500).send(error);
    }
}

async function createWallet(account_id) {
    let currentArr = [{ code: 'USD', symbol: '$' }, { code: 'GBP', symbol: '£' }, { code: 'EUR', symbol: '€' }, { code: 'BTC', symbol: '₿' }, { code: 'USDT', symbol: '₮' }, { code: 'ETH', symbol: 'Ξ' }]
    let walletArr = [];
    let obj = {
        wallet_type: 'insta',
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
        if (i > 2) { obj['wallet_type'] = 'crypto' }
        obj['currency'] = cl;
        walletArr.push({ ...obj })
    })
    Wallet.insertMany(walletArr).then(async (walletList) => {
        // console.log(walletList);
        walletList.map(async (l, i) => {
            let hashids = new Hashids(i.toString() + l._id.toString(), 8, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890');
            let id = await hashids.encode(1, 2, 3)
            console.log(id.toString());
            let updt = await Wallet.updateOne({ _id: l._id }, { $set: { wallet_id: id.toString() } })
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

// const getReferralGetUser = async (req, res) => {
//     try {
//         const userId = req.params.userId;
//         console.log(userId)
//         if (!userId) {
//             let error = await encryption({
//                 status: false,
//                 message: "Required feilds are empty."
//             });
//             return res.status(400).send(error);
//         } else {
//             Account.findById(userId).then(async user => {
//                 if (!user) {
//                     let error = await encryption({
//                         status: false,
//                         message: "User not found."
//                     });
//                     return res.status(400).send(error);
//                 } else {
//                     Account.find({ parentId: user?._id }).populate('user').then(async refFound => {//user.user ? user.user : user.company }).then(async refFound => {
//                         // console.log(refFound)

//                         if (!refFound || refFound.length <= 0) {
//                             let data = await encryption({
//                                 status: true,
//                                 message: "You dont have ref."
//                             });
//                             return res.status(200).send(data);
//                         } else {
//                             let data = await encryption({
//                                 status: true,
//                                 message: "Ref found.",
//                                 data: refFound
//                             });
//                             return res.status(200).send(data);
//                         }
//                     }).catch(async refFindingError => {
//                         console.log(refFindingError);
//                         let error = await encryption({
//                             status: false,
//                             message: "Something went wrong while finding user."
//                         });
//                         return res.status(500).send(error);
//                     })
//                 }
//             }).catch(async userFindingError => {
//                 console.log(userFindingError);
//                 let error = await encryption({
//                     status: false,
//                     message: "Something went wrong while finding user."
//                 });
//                 return res.status(500).send(error);
//             })
//         }
//     } catch (err) {
//         console.log(err);
//         let error = await encryption({
//             status: false,
//             message: "Internal server error."
//         });
//         res.status(500).send(error);
//     }
// }

const getReferralGetUser = async (req, res) => {
    try {
        const userId = req.params.userId;
        console.log(userId)
        if (!userId) {
            let error = await encryption({
                status: false,
                message: "Required fields are empty."
            });
            return res.status(400).send(error);
        } else {
            Account.findById(userId).then(async user => {
                if (!user) {
                    let error = await encryption({
                        status: false,
                        message: "User not found."
                    });
                    return res.status(400).send(error);
                } else {
                    // Find all referrals of the user
                    Account.find({ parentId: user._id }).populate(['user', 'company']).select("-password").then(async referrals => {
                        if (!referrals || referrals.length <= 0) {
                            let data = await encryption({
                                status: true,
                                message: "You don't have referrals.",
                                data: []
                            });
                            return res.status(200).send(data);
                        } else {
                            // Fetch commission earned from each referral
                            const commissionPromises = referrals.map(async referral => {
                                const commissions = await Commission.find({ parent: user._id, child: referral._id });
                                const totalCommission = commissions.reduce((acc, curr) => acc + curr.commission, 0);
                                return { referral, totalCommission };
                            });

                            const referralCommissions = await Promise.all(commissionPromises);

                            let data = await encryption({
                                status: true,
                                message: "Referrals found.",
                                data: referralCommissions
                            });
                            return res.status(200).send(data);
                        }
                    }).catch(async referralFindingError => {
                        console.log(referralFindingError);
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while finding referrals."
                        });
                        return res.status(500).send(error);
                    });
                }
            }).catch(async userFindingError => {
                console.log(userFindingError);
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while finding user."
                });
                return res.status(500).send(error);
            });
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error."
        });
        res.status(500).send(error);
    }
};


const getReferralForCompany = async (req, res) => {
    try {
        const companyId = req.params.companyId;
        console.log(companyId);
        if (!companyId) {
            let error = await encryption({
                status: false,
                message: "Required fields are empty."
            });
            return res.status(400).send(error);
        } else {
            Account.findById(companyId).then(async company => {
                if (!company) {
                    let error = await encryption({
                        status: false,
                        message: "Company not found."
                    });
                    return res.status(400).send(error);
                } else {
                    // Find all referrals of the company
                    Account.find({ parentId: company._id }).populate(['company', 'user']).select("-password").then(async referrals => {
                        if (!referrals || referrals.length <= 0) {
                            let data = await encryption({
                                status: true,
                                message: "Company doesn't have referrals.",
                                data: []
                            });
                            return res.status(200).send(data);
                        } else {
                            // Fetch commission earned from each referral
                            const commissionPromises = referrals.map(async referral => {
                                const commissions = await Commission.find({ parent: company._id, child: referral._id });
                                const totalCommission = commissions.reduce((acc, curr) => acc + curr.commission, 0);
                                return { referral, totalCommission };
                            });

                            const referralCommissions = await Promise.all(commissionPromises);

                            let data = await encryption({
                                status: true,
                                message: "Referrals found.",
                                data: referralCommissions
                            });
                            return res.status(200).send(data);
                        }
                    }).catch(async referralFindingError => {
                        console.log(referralFindingError);
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while finding referrals."
                        });
                        return res.status(500).send(error);
                    });
                }
            }).catch(async companyFindingError => {
                console.log(companyFindingError);
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while finding company."
                });
                return res.status(500).send(error);
            });
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error."
        });
        res.status(500).send(error);
    }
};


const referralCode = async (req, res) => {
    try {
        const { username, userId, type } = await decryption(req.body.data);
        if (!username || !userId || !type) {
            let error = await encryption({
                status: false,
                message: "Required Fields are empty."
            })
            return res.status(400).send(error);
        }
        const parent = await Account.findOne({ username: username });
        console.log(parent)
        if (!parent) {
            let error = await encryption({
                status: false,
                message: "Invitation link is wrong."
            })
            return res.status(400).send(error);
        } else {
            if (type === 'individualAccount') {
                console.log(1)
                Account.findById(userId).then(async userFound => {
                    if (!userFound) {
                        let error = await encryption({
                            status: false,
                            message: "User not found."
                        })
                        return res.status(404).send(error);
                    } else {
                        Account.findByIdAndUpdate(userFound._id, { parentId: parent?._id }, { new: true })
                            .then(async userUpdated => {
                                console.log(userUpdated)
                                let data = await encryption({
                                    status: true,
                                    message: "User updated successfully."
                                })
                                return res.status(200).send(data);
                            })
                            .catch(async userUpdatingerror => {
                                console.log(userUpdatingerror);
                                let error = await encryption({
                                    status: false,
                                    message: "Something went wrong while updating the user."
                                })
                                return res.status(500).send(error);
                            })
                    }
                }).catch(async userFindingError => {
                    console.log(userFindingError);
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while finding user."
                    })
                    return res.status(500).send(error);
                })
            } else if (type === 'businessAccount') {
                console.log(2)
                Account.findById(userId).then(async userFound => {
                    if (!userFound) {
                        let error = await encryption({
                            status: false,
                            message: "User not found."
                        })
                        return res.status(404).send(error);
                    } else {
                        Account.findByIdAndUpdate(userFound._id, { parentId: parent?._id }, { new: true })
                            .then(async userUpdated => {
                                let data = await encryption({
                                    status: true,
                                    message: "User updated successfully."
                                })
                                return res.status(200).send(data);
                            })
                            .catch(async userUpdatingerror => {
                                console.log(userUpdatingerror);
                                let error = await encryption({
                                    status: false,
                                    message: "Something went wrong while updating user."
                                })
                                return res.status(500).send(error);
                            })
                    }
                }).catch(async userFindingError => {
                    console.log(userFindingError);
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while finding user."
                    })
                    return res.status(500).send(error);
                })
            }
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error."
        });
        res.status(500).send(error);
    }
}

const referralCodeCheck = async (req, res) => {
    try {
        const refCode = req.params.refCode;
        if (!refCode) {
            let error = await encryption({
                status: false,
                message: "Required Fields are empty."
            })
            return res.status(400).send(error);
        } else {
            Account.findOne({ username: refCode }).then(async userFound => {
                console.log(userFound)
                if (!userFound) {
                    let error = await encryption({
                        status: true,
                        message: "Invalid Referral code."
                    })
                    return res.status(400).send(error);
                } else {
                    let error = await encryption({
                        status: true,
                        message: "Valid Referral code."
                    })
                    return res.status(200).send(error);
                }
            }).catch(async findingUsernameError => {
                console.log("finding username", findingUsernameError);
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while finding user."
                })
                return res.status(500).send(error);
            })
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error."
        });
        res.status(500).send(error);
    }
}

const getUserCommissions = async (req, res) => {
    try {
        const userId = req.params.userId;
        Account.findById(userId).then(async userFound => {
            if (!userFound) {
                let error = await encryption({
                    status: false,
                    message: "User not found."
                });
                return res.status(404).send(error);
            } else {
                console.log(userFound)
                const commissions = await Commission.find({ parent: userFound._id }).populate("child")
                if (commissions.length === 0) {
                    let error = await encryption({
                        status: false,
                        message: "Commissions not found."
                    });
                    return res.status(404).send(error);
                }
                let data = await encryption({
                    status: true,
                    message: "Commissions found.",
                    commission: commissions,
                    availableCommission: userFound.commission
                });
                return res.status(200).send(data);
            }
        }).catch(async err => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while finding user."
            });
            return res.status(500).send(error);
        });
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error."
        });
        res.status(500).send(error);
    }
};

const moveCommissionToAccount = async (req, res) => {
    try {
        const { account_id, amount, receiving_wallet } = req.body

        if (!account_id || !amount || !receiving_wallet) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing."
            })
            return res.status(400).send(error)
        }

        const account = await Account.findOne({ _id: account_id, active: true })

        if (!account) {
            let error = await encryption({
                status: false,
                message: "Account not found."
            })
            return res.status(404).send(error)
        }


        let receivingWalletDetails = await Wallet.findOne({
            $and: [{ _id: receiving_wallet }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate('account')

        console.log(receivingWalletDetails, "receivingWalletDetails")

        if (!receivingWalletDetails) {
            let error = await encryption({
                status: false,
                message: "Receiving wallet not found."
            })
            return res.status(404).send(error)
        }

        // const commission = await Commission.find({ _id: account_id })

        // const sumOfCommissions = commission.reduce((a, b) => a + b.amount, 0)

        if (amount > account.commission) {
            let error = await encryption({
                status: false,
                message: "Insufficient commission."
            })
            return res.status(400).send(error)
        }

        const feeDetails = await FeeModel.findOne({ service_name: "conversion", account_level: account.level });

        const exchangeRateResponse = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=USD&to=${receivingWalletDetails.currency.code}&amount=${amount}&format=1`);
        if (!exchangeRateResponse.data.success) throw new Error("Exchange Rates not found!");

        const originalRate = exchangeRateResponse.data.info.rate;

        const markupRate = feeDetails.percentage_markup / 100;
        const adjustedExchangeRate = receivingWalletDetails.currency.code !== "USD"
            ? formatDecimalNumbersWithLimit(originalRate - (markupRate * originalRate), 6)
            : originalRate;

        const convertedAmount = amount * adjustedExchangeRate;

        receivingWalletDetails.balance.available = receivingWalletDetails.balance.available + convertedAmount

        receivingWalletDetails.save().then(async (wallet) => {

            console.log(wallet, "wallet")

            account.commission = account.commission - amount;
            await account.save();

            let ref = 'tr_' + Date.now().toString();
            let receiverBalance = receivingWalletDetails.balance.available + convertedAmount;

            const senderCurrentTime = moment().tz(receivingWalletDetails.account.timezone).format();

            let transactionObj = {
                reference_id: ref,
                type: 'instant',
                transaction_type: 'credit',
                service_type: 'wallet_to_wallet',
                payment_type: "commission",
                status: 'completed',
                purpose: "",
                description: "",
                currency: { code: receivingWalletDetails.currency.code, symbol: receivingWalletDetails.currency.symbol },
                amount: convertedAmount,
                fee: 0,
                total: convertedAmount,
                wallet_id: receivingWalletDetails.wallet_id,
                wallet: receivingWalletDetails._id,
                account: account_id,
                sender: account_id,
                receiver: account_id,
                current_balance: receiverBalance,
                replacement_currency: { code: "USD", value: amount, rate: formatDecimalNumbersWithLimit(convertedAmount / amount, 6) },
                timeline: [
                    {
                        status: 'COMPLETED',
                        date: senderCurrentTime,
                    }
                ]
            };

            const newTransaction = new Transaction(transactionObj);

            newTransaction.save().then(async (transaction) => {
                let ciphertext = await encryption({
                    status: true,
                    message: "Commission moved successfully.",
                    transaction: transaction
                })
                return res.status(200).send(ciphertext)
            }).catch(async (err) => {
                console.log(err)
                let error = await encryption({
                    status: false,
                    message: "Internal server error."
                })
                return res.status(500).send(error);
            })


        }).catch(async (err) => {
            console.log(err)
            let error = await encryption({
                status: false,
                message: "Internal server error."
            })
            return res.status(500).send(error);
        })
    }

    catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error."
        })
        return res.status(500).send(error);
    }
}


const requestWithdrawalCommission = async (req, res) => {
    try {
        const { account_id, amount, payer_id, service_id } = req.body;
        console.log(account_id, amount);

        if (!account_id || !amount || !payer_id || !service_id) {
            const error = await encryption({
                status: false,
                message: "Something is missing!"
            });
            return res.status(400).send(error);
        }

        const account = await Account.findOne({ _id: account_id, active: true });
        if (!account) {
            const error = await encryption({
                status: false,
                message: "Account not found!"
            });
            return res.status(404).send(error);
        }

        let withdrawalRequest = {
            account: account_id,
            amount: amount,
            payer_id,
            service_id,
            status: "pending"
        };

        let createdRequest;
        try {
            createdRequest = await ExternalCommission.create(withdrawalRequest);
            if (createdRequest) {
                account.commission -= amount;
                account.external_witdrawal_commission = (account.external_witdrawal_commission || 0) + amount;
                await account.save();

                const ciphertext = await encryption({
                    status: true,
                    message: "Successfully requested withdrawal commission!",
                    request: createdRequest
                });
                return res.status(200).send(ciphertext);
            } else {
                const error = await encryption({
                    status: false,
                    message: "Something went wrong while requesting withdrawal commission!"
                });
                return res.status(400).send(error);
            }
        } catch (err) {
            console.log(err);
            if (createdRequest) {
                await ExternalCommission.findByIdAndDelete(createdRequest._id);
            }

            const error = await encryption({
                status: false,
                message: "Something went wrong while requesting withdrawal commission!"
            });
            return res.status(400).send(error);
        }
    } catch (err) {
        console.log(err);
        const error = await encryption({
            status: false,
            message: "Something went wrong while requesting withdrawal commission!"
        });
        return res.status(500).send(error);
    }
};

// const createWithdrawalTransaction = async (req, res, next) => {
//     try {

//         // const data = await decryption(req.body.data);
//         const data = req.body;
//         const {
//             request_id,
//         } = data;

//         const requestDetails = await ExternalCommission.findOne({ _id: request_id, status: "pending" });

//         const service_id = requestDetails.service_id;
//         const payer_id = requestDetails.payer_id;
//         const amount = requestDetails.amount;
//         const additional_information = "N/A";
//         const purpose_of_remittance = "FAMILY_SUPPORT";
//         const account_id = requestDetails.account;

//         console.log(requestDetails, service_id, payer_id, amount, additional_information, purpose_of_remittance, account_id, "requestDetails");

//         if (!requestDetails) {
//             const error = await encryption({
//                 status: false,
//                 message: "Request details not found or already processed!"
//             });
//             return res.status(404).send(error);
//         }

//         const withdrawalDetails = await Withdrawal.findOne({ account: requestDetails.account });
//         const accountDetails = await Account.findOne({ _id: requestDetails.account, active: true });

//         const transaction_type = accountDetails.account_type === "individual" ? "C2C" : "B2B";


//         if (!withdrawalDetails) {
//             const error = await encryption({
//                 status: false,
//                 message: "Withdrawal details not found!"
//             });
//             return res.status(404).send(error);
//         }

//         if (!accountDetails) {
//             const error = await encryption({
//                 status: false,
//                 message: "Account not found!"
//             });
//             return res.status(404).send(error);
//         }

//         const authHeader = `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`;

//         // GETTING PAYERID RATES, AND ALSO FETCHING THE COUNTRY CURRENCY
//         const systemRates = await calculatePayerRatesLogic(payer_id, account_id, transaction_type, amount, service_name = "international_bank_transfer", channel_name = "bank_account")

//         console.log(systemRates, "systemRates")

//         const external_id1 = shortid.generate();
//         const Thunes_Currency = 'USD'
//         const Thunes_Country = 'USA'
//         const mode = 'SOURCE_AMOUNT'

//         const createQuotationRequestData = {
//             external_id: external_id1,
//             payer_id,
//             mode,
//             transaction_type: transaction_type,
//             source: {
//                 amount,
//                 currency: Thunes_Currency,
//                 country_iso_code: Thunes_Country
//             },
//             destination: {
//                 amount: null,
//                 currency: systemRates.api_response.destination_currency
//             }
//         };

//         // creating quotation
//         const quotationResult = await createQuotationHelper(createQuotationRequestData);

//         console.log(quotationResult, 'quotationResult')

//         console.log(withdrawalDetails)

//         // return

//         let credit_party_identifier = {};
//         let document_type = "";
//         let document_number = "";

//         if (service_id == 1) {
//             credit_party_identifier.bank_account_number = withdrawalDetails.bank_details[0].account_number//"0123456789"
//             credit_party_identifier.swift_bic_code = withdrawalDetails.bank_details[0].swift_code//"ABCDEFGH"
//             credit_party_identifier.msisdn = "272715638100"//withdrawalDetails.mobile_wallet[0].wallet_account_number//mobile_wallet.wallet_account_number// "272715638100" //beneficiary.mobile_wallet_account_number
//             // console.log(credit_party_identifier.msisdn, "credit_party_identifier.msisdn")
//         } else if (service_id == 2) {
//             credit_party_identifier.bank_account_number = "272715638100"//withdrawalDetails.bank_details[0].account_number// bank_details?.account_number //"272715638100" //beneficiary.bank_details.account_number
//             credit_party_identifier.iban = "AT351111111111111100"//withdrawalDetails.bank_details[0].iban//"PK73BAHL1116180400568001"// bank_details?.iban //"AT351111111111111100"; //beneficiary.bank_swift_code
//         } else if (service_id == 3) {
//             credit_party_identifier.msisdn = withdrawalDetails.cash_pickup[0].document_number//beneficiary.phone// "272715638100" //beneficiary.mobile_wallet_account_number
//             document_type = withdrawalDetails.cash_pickup[0].document_type//beneficiary.cash_pickup[0].document_type
//             document_number = withdrawalDetails.cash_pickup[0].document_number//beneficiary.cash_pickup[0].document_number
//         } else if (service_id == 4) {
//             credit_party_identifier.card_number = withdrawalDetails.card[0].card_number//'4111254101010100'
//         }

//         const API_URL = `https://api-mt.pre.thunes.com/v2/money-transfer/quotations/ext-${external_id1}/transactions`;
//         // const external_id1 = shortid.generate();

//         first_type = transaction_type[0] // to see if the sender is individual or business
//         second_type = transaction_type[2] // to see if the reciever is individual or business
//         let requestData
//         let sender_obj_individual, sending_business, receiving_business;

//         if (transaction_type === 'C2C') {
//             sender_obj_individual = {
//                 firstname: withdrawalDetails?.first_name || 'first_name',
//                 lastname: withdrawalDetails?.last_name || 'last_name',
//                 nationality: withdrawalDetails?.nationality || '',
//                 address: withdrawalDetails?.address || 'my_address',
//                 date_of_birth: withdrawalDetails?.dob || '',
//                 id_expiration_date: "",
//                 country_of_birth_iso_code: "",
//                 source_of_funds: "BUSINESS",
//                 date_of_birth: "",
//                 country_iso_code: "TZA",       // not in database so hardocing this value for now
//                 beneficiary_relationship: "BROTHER", //beneficiary.relation || '',   // from bene db (these need to be in a format which is acceptable by thunes, so do check)
//                 nativename: "",
//                 id_country_iso_code: "",
//                 email: "",
//                 city: withdrawalDetails?.city || "my_city",
//                 postal_code: "",
//                 id_type: document_type,
//                 id_number: document_number,
//                 gender: "",
//                 code: "",
//                 id_delivery_date: "",
//                 middlename: "",
//                 occupation: "",
//                 province_state: "",
//                 msisdn: "272715638100",
//                 nationality_country_iso_code: "",
//             }
//         } else {
//             sending_business = {
//                 registered_name: withdrawalDetails?.first_name || 'first_name',
//                 trading_name: withdrawalDetails?.first_name || 'first_name',
//                 address: withdrawalDetails?.address || 'my_address',
//                 postal_code: "123",
//                 city: withdrawalDetails?.city || "my_city",
//                 country_iso_code: "FRA",
//                 registration_number: "123"
//             }
//             receiving_business = {
//                 registered_name: withdrawalDetails?.first_name || 'first_name',
//                 trading_name: withdrawalDetails?.first_name || 'first_name',
//                 address: withdrawalDetails?.address || 'my_address',
//                 postal_code: "12345",
//                 city: withdrawalDetails?.city || "my_city",
//                 country_iso_code: "SGP",
//                 tax_id: 1234567,
//                 date_of_incorporation: "",
//                 representative_lastname: withdrawalDetails?.last_name || 'last_name',
//                 representative_firstname: withdrawalDetails?.first_name || 'first_name',
//                 representative_id_type: "",
//                 representative_id_country_iso_code: ""
//             }
//         }

//         if (transaction_type === 'C2C') {
//             requestData = {
//                 additional_information_1: additional_information,
//                 purpose_of_remittance: purpose_of_remittance,
//                 credit_party_identifier: credit_party_identifier,
//                 external_id: external_id1,
//                 sender: sender_obj_individual,
//                 beneficiary: sender_obj_individual,
//             };
//         } else {
//             requestData = {
//                 retail_rate: "",
//                 additional_information_1: additional_information,
//                 purpose_of_remittance: purpose_of_remittance,
//                 retail_fee_currency: "",
//                 credit_party_identifier: credit_party_identifier,
//                 retail_fee: "",
//                 external_id: external_id1,
//                 sending_business: sending_business,
//                 receiving_business: receiving_business,
//                 document_reference_number: 123,
//             };
//         }

//         requestData['callback_url'] = 'https://ip-dev-85ba34ddc4a3.herokuapp.com/api/webhook/thunes-transaction-status'
//         requestData['external_code'] = accountDetails._id.toString();

//         const config = {
//             headers: {
//                 'Authorization': authHeader,
//                 'Content-Type': 'application/json'
//             }
//         };
//         console.log(requestData, "requestDatainwithdr", API_URL, config)
//         const response = await axios.post(API_URL, requestData, config);

//         // axios.post(API_URL, requestData, config).then((response) => {
//         //     console.log(response.data, "response.data")
//         // }).catch((error) => {
//         //     console.log(error.response.data, "error")
//         // })

//         const transactionResult = response.data;

//         // converting the times into human readbale 
//         const humanReadableCreationDate = moment(transactionResult.creation_date).format('MMMM Do YYYY, h:mm a');
//         const humanReadableExpirationDate = moment(transactionResult.expiration_date).format('MMMM Do YYYY, h:mm a');

//         // filtering and keeping the fields which need to be shown
//         const outputData = {
//             TransactionID: external_id1,
//             additional_information_1: transactionResult.additional_information_1,
//             sender: {
//                 ...transactionResult.sender,
//             },
//             beneficiary: {
//                 ...transactionResult.beneficiary,
//             },
//             creation_date: humanReadableCreationDate,
//             credit_party_identifier: {
//                 ...transactionResult.credit_party_identifier,
//             },
//             destination: {
//                 ...transactionResult.destination,
//             },
//             expiration_date: humanReadableExpirationDate,
//             payer: {
//                 ...transactionResult.payer,
//             },
//             purpose_of_remittance: transactionResult.purpose_of_remittance,
//             sent_amount: {
//                 ...transactionResult.sent_amount,
//             },
//             source: {
//                 ...transactionResult.source,
//             },
//             status_message: transactionResult.status_message,
//             transaction_type: transactionResult.transaction_type,
//             wholesale_fx_rate: transactionResult.wholesale_fx_rate,
//         };

//         // const decodedToken = jwt.verify(token, secretKey);
//         // console.log(decodedToken, "tokencheck")
//         // let total = decodedToken.result.total

//         const transactionDetails = {
//             fee: systemRates.api_response.fee + quotationResult.fee.amount,
//             thunes_fee: quotationResult.fee.amount,
//             purpose: purpose_of_remittance,
//             description: additional_information,
//             service_id,
//         }

//         const payload = {
//             TransactionID: external_id1,
//             total: systemRates.api_response.total + quotationResult.fee.amount,
//             status_message: transactionResult.status_message,
//             user_id: accountDetails._id,
//             transactionDetails,
//             request_id
//         };


//         console.log(payload, "payload")

//         const options = {
//             expiresIn: '1h',
//         };

//         const new_token = jwt.sign(payload, secretKey);

//         const output = await encryption({ Message: "Transaction Created", token: new_token });
//         res.json(output);



//     } catch (err) {
//         console.log(err)
//         let error = await encryption({
//             status: false,
//             message: "Internal server error!"
//         })
//         return res.status(500).send(error);
//     }
// }



// const acceptExternalCommissionRequest = async (req, res) => {
//     try {

//         const body = req.body;
//         // const body = await decryption(req.body.data);
//         const { token } = body;

//         let decoded;

//         jwt.verify(token, secretKey, async function (err, data) {
//             if (err) {
//                 let error = await encryption({
//                     status: false,
//                     message: "Invalid token!"
//                 })
//                 return res.status(400).send(error);
//             } else {
//                 decoded = data;
//             }
//         });

//         console.log(decoded, "decoded")

//         const requestDetails = await ExternalCommission.findOne({ _id: decoded.request_id, status: "pending" });

//         if (!requestDetails) {
//             let error = await encryption({
//                 status: false,
//                 message: "Request not found!"
//             })
//             return res.status(400).send(error);
//         }

//         const accountDetails = await Account.findOne({ _id: requestDetails.account });

//         if (!accountDetails) {
//             let error = await encryption({
//                 status: false,
//                 message: "Account not found!"
//             })
//             return res.status(400).send(error);
//         }

//         if (requestDetails.amount > accountDetails.external_witdrawal_commission) {
//             let error = await encryption({
//                 status: false,
//                 message: "Insufficient commission!"
//             })
//             return res.status(400).send(error);
//         }

//         const thunesDetails = await thunesBalance()

//         const USDBalance = thunesDetails.thunes.filter((item) => item.currency === "USD")

//         if (decoded.total > USDBalance[0].balance) {
//             const error = await encryption({
//                 status: false,
//                 message: 'Insufficient Balance in thunes'
//             })
//             return res.status(400).send(error);
//         }

//         const config = {
//             headers: {
//                 'Authorization': `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`,
//                 'Content-Type': 'application/json'
//             }
//         };
//         const API_URL = `https://api-mt.pre.thunes.com/v2/money-transfer/transactions/ext-${decoded.TransactionID}/confirm`;

//         axios.post(API_URL, {}, config).then(async (response) => {
//             if (response.data.status_message === 'CONFIRMED') {
//                 accountDetails.external_witdrawal_commission -= requestDetails.amount;
//                 await accountDetails.save();

//                 requestDetails.status = 'completed';
//                 await requestDetails.save();

//                 const senderCurrentTime = moment().tz(accountDetails.timezone).format();

//                 let paymentType;
//                 if (decoded.transactionDetails.service_id == 1) {
//                     paymentType = 'international_mobile_wallet';
//                 } else if (decoded.transactionDetails.service_id == 2) {
//                     paymentType = 'international_bank_transfer';
//                 } else if (decoded.transactionDetails.service_id == 3) {
//                     paymentType = 'international_cash_pickup';
//                 } else {
//                     paymentType = 'international_card_payment';
//                 }

//                 let transactionObj = {
//                     reference_id: `tr_${decoded.TransactionID}`,
//                     type: 'instant',
//                     transaction_type: 'credit',
//                     service_type: 'commission_withdrawal',
//                     payment_type: paymentType,
//                     status: 'completed',
//                     purpose: "External Commission Transfer",
//                     description: `Transfer of external commission`,
//                     currency: { code: 'USD', symbol: '$' },
//                     amount: decoded.total,
//                     fee: decoded.transactionDetails.fee,
//                     total: decoded.total,
//                     wallet_id: null,
//                     wallet: null,
//                     account: requestDetails.account,
//                     sender: requestDetails.account,
//                     receiver: null,
//                     current_balance: null,
//                     timeline: [
//                         {
//                             status: 'INITIATED',
//                             date: senderCurrentTime,
//                         }
//                     ]
//                 };

//                 const newTransaction = new Transaction(transactionObj);
//                 await newTransaction.save();

//                 const ciphertext = await encryption({
//                     status: true,
//                     message: "External commission request accepted successfully.",
//                     transaction: newTransaction
//                 });

//                 return res.status(200).send(ciphertext);
//             } else {
//                 const error = await encryption({
//                     status: false,
//                     message: 'Transaction Failed'
//                 })
//                 return res.status(400).send(error);
//             }
//         }).catch(async (err) => {
//             console.log(err)
//             const error = await encryption({
//                 status: false,
//                 message: 'Transaction Failed'
//             })
//             return res.status(400).send(error);
//         });

//     } catch (err) {
//         console.log(err);
//         const error = await encryption({
//             status: false,
//             message: "Internal server error."
//         });
//         return res.status(500).send(error);
//     }
// };

const acceptExternalCommissionRequest = async (req, res) => {
    try {
        const data = await decryption(req.body.data);
        // const data = req.body;
        const { request_id } = data;

        if (!request_id) {
            const error = await encryption({
                status: false,
                message: "Request ID is missing."
            });
            return res.status(400).send(error);
        }

        const request = await ExternalCommission.findOne({ _id: request_id, status: 'pending' });

        if (!request) {
            const error = await encryption({
                status: false,
                message: "Request not found or already processed."
            });
            return res.status(404).send(error);
        }

        const account = await Account.findOne({ _id: request.account, active: true });

        if (!account) {
            const error = await encryption({
                status: false,
                message: "Account not found."
            });
            return res.status(404).send(error);
        }

        if (request.amount > account.external_witdrawal_commission) {
            const error = await encryption({
                status: false,
                message: "Insufficient external withdrawal commission."
            });
            return res.status(400).send(error);
        }

        account.external_witdrawal_commission -= request.amount;
        await account.save();

        request.status = 'completed';
        await request.save();

        let paymentType;
        if (request.service_id == 1) {
            paymentType = 'international_mobile_wallet';
        } else if (request.service_id == 2) {
            paymentType = 'international_bank_transfer';
        } else if (request.service_id == 3) {
            paymentType = 'international_cash_pickup';
        } else {
            paymentType = 'international_card_payment';
        }

        let ref = 'tr_' + Date.now().toString();
        const senderCurrentTime = moment().tz(account.timezone).format();

        let transactionObj = {
            reference_id: ref,
            type: 'instant',
            transaction_type: 'debit',
            service_type: 'commission_withdrawal',
            payment_type: paymentType,
            status: 'completed',
            purpose: "External Commission Transfer",
            description: `Transfer of external commission`,
            currency: { code: 'USD', symbol: '$' },
            amount: request.amount,
            fee: 0,
            total: request.amount,
            wallet_id: null,
            wallet: null,
            account: request.account,
            sender: request.account,
            receiver: null,
            current_balance: null,
            timeline: [
                {
                    status: 'COMPLETED',
                    date: senderCurrentTime,
                }
            ]
        };

        const newTransaction = new Transaction(transactionObj);
        await newTransaction.save();

        const successMessage = await encryption({
            status: true,
            message: "External commission request accepted successfully.",
            record: transactionObj
        });

        return res.status(200).send(successMessage);
    } catch (err) {
        console.log(err);
        const error = await encryption({
            status: false,
            message: "Internal server error."
        });
        return res.status(500).send(error);
    }
};



const declineExternalCommissionRequest = async (req, res) => {
    try {
        const data = await decryption(req.body.data);
        const { request_id } = data;

        if (!request_id) {
            const error = await encryption({
                status: false,
                message: "Request ID is missing."
            });
            return res.status(400).send(error);
        }

        const request = await ExternalCommission.findOne({ _id: request_id, status: 'pending' });

        if (!request) {
            const error = await encryption({
                status: false,
                message: "Request not found or already processed."
            });
            return res.status(404).send(error);
        }

        const account = await Account.findOne({ _id: request.account, active: true });

        if (!account) {
            const error = await encryption({
                status: false,
                message: "Account not found."
            });
            return res.status(404).send(error);
        }

        account.commission += request.amount;
        account.external_witdrawal_commission -= request.amount;
        await account.save();

        request.status = 'declined';
        await request.save();

        const successMessage = await encryption({
            status: true,
            message: "External commission request declined successfully."
        });

        return res.status(200).send(successMessage);
    } catch (err) {
        console.log(err);
        const error = await encryption({
            status: false,
            message: "Internal server error."
        });
        return res.status(500).send(error);
    }
};

const fetchAllWithdrawalRequests = async (req, res) => {
    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * 50
        if (limit > 100) {
            limit = 100;
        }

        const requests = await ExternalCommission.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate([{
            path: 'account',
            populate: (['user', 'company'])
        }])

        const encryptedResponse = await encryption({
            status: true,
            message: "Requests fetched successfully",
            data: requests
        });

        return res.status(200).send(encryptedResponse);
    } catch (err) {
        console.log(err);
        const error = await encryption({
            status: false,
            message: "Internal server error."
        });
        return res.status(500).send(error);
    }
};

const fetchUserWithdrawalRequests = async (req, res) => {
    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * 50
        if (limit > 100) {
            limit = 100;
        }

        const requests = await ExternalCommission.find({ account: req.params.account_id }).sort({ createdAt: -1 }).skip(skip).limit(limit).
            populate([{
                path: 'account',
                populate: (['user', 'company'])
            }])

        const encryptedResponse = await encryption({
            status: true,
            message: "Requests fetched successfully",
            data: requests
        });

        return res.status(200).send(encryptedResponse);
    } catch (err) {
        console.log(err);
        const error = await encryption({
            status: false,
            message: "Internal server error."
        });
        return res.status(500).send(error);
    }
};

const inviteUserToInstapay = async (req, res) => {
    try {
        const { account_id, type } = req.params;
        // const data = req.body;
        const data = await decryption(req.body.data);
        const { email, phone, message } = data;

        if (!account_id || !type) {
            const error = await encryption({
                status: false,
                message: "Username or type is missing."
            });
            return res.status(400).send(error);
        }
        if (type === "email" && !email) {
            const error = await encryption({
                status: false,
                message: "Email is missing."
            });
            return res.status(400).send(error);
        }
        if (type === "phone" && !phone) {
            const error = await encryption({
                status: false,
                message: "Phone is missing."
            });
            return res.status(400).send(error);
        }

        const account = await Account.findById(account_id)
        if (!account) {
            const error = await encryption({
                status: false,
                message: "Account not found."
            });
            return res.status(404).send(error);
        }

        const invitationLink = `my.insta-pay.ch/auth/signup/${account?.username}`;
        let finalMessage = message || `You have received an invitation from ${account?.username} to join InstaPay. Click on the link below to join InstaPay.\n\n${invitationLink}`;
        if (message) {
            finalMessage += `\n\n${invitationLink}`;
        }

        let emailSend = "failed";
        let phoneSend = "failed";

        if (type === "email") {
            // const check = await sendMailsExport(email, finalMessage, "InstaPay Invitation", templateId = "", {});
            const check = await sendMails(email, finalMessage, "InstaPay Invitation")
            emailSend = check ? "success" : "failed";
        } else {
            const check = await sendSMSTemplate(phone, finalMessage);
            phoneSend = check ? "success" : "failed";
        }

        if (emailSend === "failed" && phoneSend === "failed") {
            const data = await encryption({
                status: false,
                message: "Failed to send invitation via email and SMS!",
            });
            return res.status(400).send(data);
        }

        if (emailSend === "success" || phoneSend === "success") {
            const cipherText = await encryption({
                status: true,
                message: "Invitation sent successfully!",
            })
            return res.status(200).send(cipherText);
        }

    } catch (err) {
        console.log(err);
        const error = await encryption({
            status: false,
            message: "Internal server error."
        });
        return res.status(500).send(error);
    }
}

const commissionRates = async (req, res) => {
    try {
        let { from, level_id, amount, receiver_wallet_id } = req.params;
        console.log({ from, level_id, amount, receiver_wallet_id });
        amount = parseFloat(amount);

        let receiver = await Wallet.findOne({
            $and: [{ _id: receiver_wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate({
            path: "account",
            populate: { path: 'level' }
        })

        if (!receiver) {
            const error = await encryption({
                status: false,
                message: "Receiver wallet not found!"
            })
            res.status(404).send(error)
        }

        const feeDetails = await FeeModel.findOne({ service_name: "conversion", account_level: level_id });
        if (!feeDetails) {
            const error = await encryption({
                status: false,
                message: "Commission rates not found!"
            })
            res.status(404).send(error)
        }

        const exchangeRateResponse = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${receiver.currency.code}&amount=${amount}&format=1`);
        if (!exchangeRateResponse.data.success) throw new Error("Exchange Rates not found!");

        const newRate = formatDecimalNumbersWithLimit(exchangeRateResponse.data.info.rate, 6);
        exchange_rate = from !== receiver.currency.code ? formatDecimalNumbersWithLimit(newRate - (feeDetails.percentage_markup / 100) * newRate, 6) : newRate;

        const convertedAmount = formatDecimalNumbersWithLimit(amount * exchange_rate, 2);

        const amountInUSD = await convertCurrency(receiver.currency.code, 'USD', convertedAmount);

        let limitChecked = limitCheck(parseFloat(amountInUSD), receiver.account.level, receiver.account, 'topup');
        if (!limitChecked.status) {
            const error = await encryption({
                status: false,
                code: limitChecked.code
            })

            return res.status(400).send(error)
        }

        let daily_receiving_limit_used = receiver.account.used_limits.daily_receiving_limit || 0;
        let monthly_receiving_limit_used = receiver.account.used_limits.monthly_receiving_limit || 0;
        let yearly_receiving_limit_used = receiver.account.used_limits.yearly_receiving_limit || 0;

        let daily_receiving_limit = receiver.account.level.daily_receiving_limit;
        let monthly_receiving_limit = receiver.account.level.monthly_receiving_limit;
        let yearly_receiving_limit = receiver.account.level.yearly_receiving_limit;

        // RATE TO FIND THE LIMITS
        exchange_rate_in_usd = await convertCurrency('USD', receiver.currency.code, 1)

        daily_receiving_limit_used = exchange_rate_in_usd * daily_receiving_limit_used;
        monthly_receiving_limit_used = exchange_rate_in_usd * monthly_receiving_limit_used;
        yearly_receiving_limit_used = exchange_rate_in_usd * yearly_receiving_limit_used;

        daily_receiving_limit = exchange_rate_in_usd * daily_receiving_limit;
        monthly_receiving_limit = exchange_rate_in_usd * monthly_receiving_limit;
        yearly_receiving_limit = exchange_rate_in_usd * yearly_receiving_limit;

        const response = {
            status: true,
            message: "Commission rates fetch successfully!",
            data: {
                recipient: {
                    value: convertedAmount,
                    currency: receiver.currency.code
                },
                exchange_rate: {
                    value: exchange_rate,
                    currency: receiver.currency.code
                },
                limits_used: {
                    daily_receiving_limit_used,
                    monthly_receiving_limit_used,
                    yearly_receiving_limit_used
                },
                limits: {
                    daily_receiving_limit,
                    monthly_receiving_limit,
                    yearly_receiving_limit
                }
            }
        };

        res.status(200).send(await encryption(response))
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal Server Error."
        })
        res.status(500).send(error);
    }
}


module.exports = {
    CreateInvitationLink,
    invitedSignup,
    getReferralGetUser,
    getReferralForCompany,
    referralCodeCheck,
    referralCode,
    getUserCommissions,
    moveCommissionToAccount,
    requestWithdrawalCommission,
    acceptExternalCommissionRequest,
    declineExternalCommissionRequest,
    // createWithdrawalTransaction,
    fetchAllWithdrawalRequests,
    fetchUserWithdrawalRequests,
    inviteUserToInstapay,
    commissionRates
}