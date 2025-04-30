const Admin = require('../models/Admin.model')
const AWS = require('aws-sdk');
const multer = require("multer");
const jwt = require('jsonwebtoken');
const CryptoJS = require("crypto-js");
const ct = require('countries-and-timezones');
const moment = require('moment-timezone');
const axios = require('axios');
const PASSWORD_ENCRYPTION_KEY = 'secretOfTheInstaPaySystemAccountPassword'
const TOKEN_KEY = 'secretOfTheInstaPaySystemAccountTOKEN'
var Hashids = require('hashids');

const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const crypto = require('crypto');
const OTPAuth = require("otpauth");
const encode = require("hi-base32");
const QRCode = require('qrcode');

const countryCurrencyJson = require('../utils/countries/country.json')
const LoginToken = require('../models/LoginToken.model');
const AuthSecret = require('../models/Auth-Secret.model');
const Document = require('../models/Document.model');
const RequestPayment = require('../models/Request-Payment.model');
const AccountLevel = require('../models/Account-Level.model');
const Wallet = require('../models/Wallet.model');
const Account = require('../models/Account.model');
const User = require('../models/User.model');
const Company = require('../models/Company.model');
const Transaction = require('../models/Transaction.model');
const Session = require('../models/Login-History.model');
const Category = require('../models/Category.model');
const Country = require('../models/Country.model');
const AuthUser = require('../models/Auth-User.model');

const countriesIso = require('../utils/countries_iso2.json')

const { encryption, decryption } = require('../configurations/Encryption');
const e = require('express');
const path = require('path');

const sendEmail = require('../utils/sendEmail');
const Quotation = require('../models/Quotation.model');
const Report = require('../models/Report.model');
const RequestedTimezones = require('../models/RequestedTimezones.model');

const { sendMailsHelper, getTemplateId, getTimezonesWithGmt, getCountrySpecificTimezoneWithGMT, getGmtOffset, sendWhatsAppMessage } = require('../utils/helpers');
const { quickMessage } = require('../utils/instaChatbotUtils');

// const sgMail = require('@sendgrid/mail');
// // sgMail.setApiKey(process.env.SENDGRID_API_KEY)
// sgMail.setApiKey('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');

const accountSid = `${process.env.TWILIO_ACCOUNT_SID}`;//'ACd27647d39bbcec466a22096459a14297'
const authToken = `${process.env.TWILIO_AUTH_TOKEN}`;//'932acb397d9d66f41d076f5a2b873143'

const rpID = 'my.insta-pay.ch'
const expectedOrigin = "https://my.insta-pay.ch"

// const accountSid = 'ACadf8d67d3b9c73a55fa95b050b52e92d'
// const authToken = '95adc04ff6d6082e98775593e5c4e45e'

const client = require('twilio')(accountSid, authToken);

function generateRandomString(length) {
    const hashids = new Hashids('', length);

    const currentTime = Math.floor(Date.now() / 1000);
    const inputNumber = currentTime * 1000000 + Math.floor(Math.random() * 1000000);
    const randomString = hashids.encode(inputNumber);

    return randomString.slice(0, length);
}


function getDistinctObjects(arr) {
    const uniqueIds = new Set();
    return arr.filter(obj => {
        const strId = obj._id.toString();
        if (!uniqueIds.has(strId)) {
            uniqueIds.add(strId);
            return true;
        }
        return false;
    });
}

module.exports.individualAccountCheck = async (req, res) => {
    try {
        // let data = req.body
        let data = await decryption(req.body.data)
        // console.log(data);
        if (!data.phone) {
            let error = await encryption({
                status: false,
                message: "Required field is missing!"
            })
            return res.status(404).send(error)
        }
        let emailCheck;
        let phoneCheck = await Account.findOne({ phone: data.phone })//.then(async (usr) => {
        // console.log(usr)
        if (data.email) {
            emailCheck = await Account.findOne({ email: data.email.toLowerCase() })//.then(async (usr) => {
        }

        if (phoneCheck || emailCheck) {
            let error = await encryption({
                status: false,
                message: "Phone number or Email already exist!"
            })
            res.status(400).send(error)
        } else {
            let resp = await encryption({
                status: true,
                message: "Account not found!"
            })
            res.status(200).send(resp)
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.businessAccountCheck = async (req, res) => {
    try {
        // let data = req.body
        let data = await decryption(req.body.data)
        // console.log(data);
        if (!data.email) {
            let error = await encryption({
                status: false,
                message: "Required field is missing!"
            })
            return res.status(404).send(error)
        }
        let phoneCheck;
        let emailCheck = await Account.findOne({ email: data.email.toLowerCase() })//.then(async (usr) => {
        // console.log(usr)
        if (data.phone) {
            phoneCheck = await Account.findOne({ phone: data.phone })//.then(async (usr) => {
        }

        if (phoneCheck || emailCheck) {
            let error = await encryption({
                status: false,
                message: "Phone number or Email already exist!"
            })
            res.status(400).send(error)
        } else {
            let resp = await encryption({
                status: true,
                message: "Account not found!"
            })
            res.status(200).send(resp)
        }
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.userNameCheck = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        // console.log(data);

        Account.findOne({ username: data.username.toLowerCase() }).then(async (usr) => {
            // console.log(usr)
            if (!usr) {
                let resp = await encryption({
                    status: true,
                    message: "Username available"
                })
                res.status(200).send(resp)
            } else {
                let error = await encryption({
                    status: false,
                    message: "Username already exist!"
                })
                res.status(400).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "An error occurred while searching for username!"
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

async function createWallet(account_id, country) {
    let currentArr = [{ code: 'BTC', symbol: '₿' }, { code: 'USDT', symbol: '₮' }, { code: 'ETH', symbol: 'Ξ' }]
    let currency = countryCurrencyJson.find(cc => cc.country_code.toLowerCase() == country.country_iso_code.toLowerCase())
    if (currency) {
        currentArr.push({ code: currency.currency_code, symbol: currency.currency_symbol })
    }
    let walletArr = [];
    let obj = {
        wallet_type: 'crypto',
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
        obj['default'] = false;
        if (i > 2) {
            obj['wallet_type'] = 'insta';
            obj['default'] = true;
        }
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

module.exports.individualAccountRegisteration = async (req, res) => {
    // createWallet('64d4c2dd8e363d8c47ea0bb5');
    // console.log(req);
    try {
        // let data = req.body;
        let data = await decryption(req.body.data)
        var { phone, email, first_name, last_name, password, country_iso_code, country_name, country, purpose, ref_code } = data;

        if (!phone || !first_name || !last_name || !password || !country_iso_code || !country_name || !country) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            })
            return res.status(404).send(error)
        }
        if (ref_code) {
            let parent = await Account.findOne({ username: ref_code }, { username: true })
            if (!parent) {
                let error = await encryption({
                    status: false,
                    message: "Invalid referral code!"
                })
                return res.status(404).send(error)
            }
        }

        data['password'] = CryptoJS.AES.encrypt(data.password, PASSWORD_ENCRYPTION_KEY).toString();

        let emailCheck;
        let phoneCheck = await Account.findOne({ phone: data.phone })//.then(async (usr) => {
        // console.log(usr)
        if (data.email) {
            emailCheck = await Account.findOne({ email: data.email.toLowerCase() })//.then(async (usr) => {
        }
        // Account.findOne({ $or: [{ email: data.email.toLowerCase() }, { phone: data.phone }] }).then(async (usr) => {
        // console.log(usr)
        if (phoneCheck || emailCheck) {
            let error = await encryption({
                status: false,
                message: "Phone number or Email already exist!"
            })
            res.status(400).send(error)
        } else {
            const otpTokenKey = 'thisisforotponly'

            let createObj = { data };

            const countryTimezone = ct.getCountry(countriesIso[country_iso_code]);
            if (countryTimezone?.timezones.length > 1) {
                createObj.data.timezone = null;
            } else {
                createObj.data.timezone = countryTimezone?.timezones[0];
            }

            const smsOtp = `${Math.floor(100000 + Math.random() * 900000)}`;
            const emailOtp = `${Math.floor(100000 + Math.random() * 900000)}`;

            let emailSend = 'failed';
            let phoneSend = 'failed';

            if (data.phone) {
                createObj['isPhone'] = true;
                let check;
                // If country iso code is "ARE", send WhatsApp message instead of SMS
                if (country_iso_code === "ARE") {
                    check = await sendWhatsAppMessage(data.phone, smsOtp);
                } else {
                    check = await sendSMSTemplate(data.phone, `Instapay mobile number verification OTP: ${smsOtp}`);
                }                // console.log(check);
                if (check) { phoneSend = 'success'; createObj['sms_otp'] = smsOtp; } else { phoneSend = 'failed'; }
            } else { createObj['isPhone'] = false; }

            if (email) {
                createObj['isEmail'] = true;

                const language = 'english';
                const templateName = 'Signup OTP Code';

                const templateId = getTemplateId(language, templateName);

                const dynamicData = {
                    otp: emailOtp,
                };

                const check = await sendMailsHelper(email, 'Test message', 'Test Subject', templateId, dynamicData);

                // const check = await sendMails(email, `Hi ${first_name},\n\nYour instapay email verification OTP: ${emailOtp}`, "Email Verification");
                // const check = await sendMails(email, "d-2d5f929ed89847d693ab15621b95890f", emailLoginOtp, first_name);
                if (check) { emailSend = 'success'; createObj['email_otp'] = emailOtp; } else { emailSend = 'failed'; }
            } else { createObj['isEmail'] = false; }
            // console.log(createObj, phoneSend);

            if (phoneSend == 'failed') {
                const data = await encryption({
                    status: false,
                    message: "Something went wrong while sending sms!",
                });
                return res.status(400).send(data);
            } else if (emailSend == 'failed' && email) {
                const data = await encryption({
                    status: false,
                    message: "Something went wrong while sending mail!",
                });
                return res.status(400).send(data);
            } else {
                if (ref_code) { createObj['ref_code'] = ref_code }
                console.log(createObj);

                const JWTToken = jwt.sign(createObj, otpTokenKey, { expiresIn: '2m' })
                const data = await encryption({
                    status: true,
                    message: "OTP send successfully!",
                    token: JWTToken
                });
                return res.status(200).send(data);
            }
        }
        // }).catch(async (err) => {
        //     let error = await encryption({
        //         status: false,
        //         message: "Account registration failed!"
        //     })
        //     res.status(400).send(error)
        // })
    } catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.verifyIndividualAccountRegisteration = async (req, res) => {
    try {
        // let data = req.body;
        let data = await decryption(req.body.data)
        var { token, sms_otp } = data;
        const otpTokenKey = 'thisisforotponly'
        jwt.verify(token, otpTokenKey, async function (err, payload) {
            if (err) {
                let error = await encryption({
                    status: false,
                    message: "Verification failed!"
                })
                return res.status(403).send(error)
            }
            let isEmail = false;
            let isPhone = false;
            if (payload.isPhone && sms_otp == payload.sms_otp) { isPhone = true; }
            if (payload.isEmail) { isEmail = true; }
            // console.log(payload, isEmail, isPhone);

            var { phone, email, first_name, last_name, password, country_iso_code, country_name, country, purpose, timezone } = payload.data;

            let emailCheck;
            let phoneCheck = await Account.findOne({ phone: phone })//.then(async (usr) => {
            if (email) {
                emailCheck = await Account.findOne({ email: email.toLowerCase() })//.then(async (usr) => {
            }

            if (phoneCheck || emailCheck) {
                let error = await encryption({
                    status: false,
                    message: "Phone number or Email already exist!"
                })
                return res.status(400).send(error)
            }

            if (isPhone && !isEmail) {
                if (isPhone == payload.isPhone) {

                    let createAccountObj = {
                        first_name: first_name,
                        last_name: last_name,
                        password: password,
                        phone: phone,
                        account_type: 'individual',
                        is_external_limit: false,
                        purpose: purpose ? purpose : '',
                        sms_verification: isPhone ? true : false,
                        // email_verification: isEmail ? true : false,// false`,
                        active: true,
                        status: 'active',
                        country_name: country_name,
                        country_iso_code: country_iso_code,
                        country: country,
                        timezone,
                        source: 'web'
                    }
                    if (payload.ref_code) {
                        let parent = await Account.findOne({ username: payload.ref_code }, { username: true })
                        if (parent) {
                            createAccountObj['parentId'] = parent._id
                        }
                    }
                    // if (email) { createAccountObj['email'] = email.toLowerCase() }
                    let categoryDetails = await Category.findOne({ $and: [{ business_type: 'individual_accounts' }, { account_type: 'individual' }] }, { business_type: true })
                    let countryDetails = await Country.findOne({ $and: [{ country_iso_code: country_iso_code }, { status: 'active' }, { individual_registration_active: true }] }, { country_name: true, country_iso_code: true })
                    if (!categoryDetails || !countryDetails) {
                        let error = await encryption({
                            status: false,
                            message: "Account registration failed!"
                        })
                        return res.status(400).send(error)
                    }
                    let level = await AccountLevel.findOne({ $and: [{ country: countryDetails._id }, { category: categoryDetails._id }, { level_no: 1 }, { account_type: 'individual' }] }, { account_type: true })
                    if (!level) {
                        let error = await encryption({
                            status: false,
                            message: "Account registration failed!"
                        })
                        return res.status(400).send(error)
                    }
                    if (level) { createAccountObj['level'] = level._id }
                    if (categoryDetails) { createAccountObj['category'] = categoryDetails._id }
                    // data['email'] = data.email.toLowerCase()
                    Account.create(createAccountObj).then(async (accData) => {
                        // console.log(accData);
                        createWallet(accData._id, countryDetails);
                        User.create({
                            first_name: first_name,
                            last_name: last_name,
                            account: accData._id
                        }).then(async (userData) => {
                            // console.log(userData);
                            Account.findByIdAndUpdate({ _id: accData._id }, { user: userData._id }, { new: true }).then(async (accountData) => {
                                accountData['user'] = userData;
                                // console.log(accountData);
                                var ciphertext = await encryption({
                                    status: true,
                                    message: "Account has been registered!",
                                    im: jwt.sign({ account_id: accData._id }, otpTokenKey, { expiresIn: '1m' }),
                                    // accountData
                                })
                                res.status(200).send(ciphertext)
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
                    let error = await encryption({
                        status: false,
                        message: "Verification failed!"
                    })
                    return res.status(403).send(error)
                }
            } else if (isPhone && isEmail) {
                if (isPhone == payload.isPhone) {
                    let tokenObj = {
                        data: payload.data,
                        isEmail: payload.isEmail,
                        email_otp: payload.email_otp,
                        isPhoneVerified: true
                    }
                    const JWTToken = jwt.sign(tokenObj, otpTokenKey, { expiresIn: '15m' })
                    const data = await encryption({
                        status: true,
                        message: "OTP verified successfully!",
                        token: JWTToken
                    });
                    return res.status(200).send(data);
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Verification failed!"
                })
                return res.status(403).send(error)
            }
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.verifyEmailIndividualAccountRegisteration = async (req, res) => {
    try {
        // let data = req.body;
        let data = await decryption(req.body.data)
        var { token, email_otp } = data;
        const otpTokenKey = 'thisisforotponly'
        jwt.verify(token, otpTokenKey, async function (err, payload) {
            if (err) {
                let error = await encryption({
                    status: false,
                    message: "Verification failed!"
                })
                return res.status(403).send(error)
            }
            let isEmail = false;
            let isPhoneVerified = false;
            // if (payload.isPhone && sms_otp == payload.sms_otp) { isPhone = true; }
            if (payload.isEmail && email_otp == payload.email_otp) { isEmail = true; }
            if (payload.isPhoneVerified) { isPhoneVerified = true }
            // console.log(payload, isEmail, isPhone);
            var { phone, email, first_name, last_name, password, country_iso_code, country_name, country, purpose, timezone } = payload.data;
            let emailCheck;
            let phoneCheck = await Account.findOne({ phone: phone })//.then(async (usr) => {
            if (email) {
                emailCheck = await Account.findOne({ email: email.toLowerCase() })//.then(async (usr) => {
            }

            if (phoneCheck || emailCheck) {
                let error = await encryption({
                    status: false,
                    message: "Phone number or Email already exist!"
                })
                return res.status(400).send(error)
            }

            if (isPhoneVerified && isEmail) {
                // if (isPhone == payload.isPhone) {

                let createAccountObj = {
                    first_name: first_name,
                    last_name: last_name,
                    password: password,
                    phone: phone,
                    account_type: 'individual',
                    is_external_limit: false,
                    purpose: purpose ? purpose : '',
                    sms_verification: isPhoneVerified ? true : false,
                    email_verification: isEmail ? true : false,// false,
                    active: true,
                    status: 'active',
                    country_name: country_name,
                    country_iso_code: country_iso_code,
                    country: country,
                    timezone,
                    source: 'web'
                }
                if (payload.ref_code) {
                    let parent = await Account.findOne({ username: payload.ref_code }, { username: true })
                    if (parent) {
                        createAccountObj['parentId'] = parent._id
                    }
                }
                if (email) { createAccountObj['email'] = email.toLowerCase() }
                let categoryDetails = await Category.findOne({ $and: [{ business_type: 'individual_accounts' }, { account_type: 'individual' }] }, { business_type: true })
                let countryDetails = await Country.findOne({ $and: [{ country_iso_code: country_iso_code }, { status: 'active' }, { individual_registration_active: true }] }, { country_name: true, country_iso_code: true })
                if (!categoryDetails || !countryDetails) {
                    let error = await encryption({
                        status: false,
                        message: "Account registration failed!"
                    })
                    return res.status(400).send(error)
                }
                let level = await AccountLevel.findOne({ $and: [{ country: countryDetails._id }, { category: categoryDetails._id }, { level_no: 1 }, { account_type: 'individual' }] }, { account_type: true })
                if (!level) {
                    let error = await encryption({
                        status: false,
                        message: "Account registration failed!"
                    })
                    return res.status(400).send(error)
                }
                if (level) { createAccountObj['level'] = level._id }
                if (categoryDetails) { createAccountObj['category'] = categoryDetails._id }
                // data['email'] = data.email.toLowerCase()
                Account.create(createAccountObj).then(async (accData) => {
                    // console.log(accData);
                    createWallet(accData._id, countryDetails);
                    User.create({
                        first_name: first_name,
                        last_name: last_name,
                        account: accData._id
                    }).then(async (userData) => {
                        // console.log(userData);
                        Account.findByIdAndUpdate({ _id: accData._id }, { user: userData._id }, { new: true }).then(async (accountData) => {
                            accountData['user'] = userData;
                            // console.log(accountData);
                            var ciphertext = await encryption({
                                status: true,
                                message: "Account has been registered!",
                                im: jwt.sign({ account_id: accData._id }, otpTokenKey, { expiresIn: '1m' }),
                                // accountData
                            })
                            res.status(200).send(ciphertext)
                        }).catch(async (err) => {
                            console.log(err);
                            let error = await encryption({
                                status: false,
                                message: "Account registration failed!"
                            })
                            res.status(400).send(error)
                        })
                    }).catch(async (err) => {
                        // console.log(err);
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
                // } else {
                //     let error = await encryption({
                //         status: false,
                //         message: "Verification failed!"
                //     })
                //     return res.status(403).send(error)
                // }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Verification failed!"
                })
                return res.status(403).send(error)
            }
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.businessAccountRegisteration = async (req, res) => {
    // console.log(req.body);
    try {
        // let data = req.body;
        let data = await decryption(req.body.data)
        var { phone, email, company_name, password, country_iso_code, country_name, country, category_id, ref_code } = data;

        if (!email || !company_name || !password || !country_iso_code || !country_name || !country || !category_id) {
            let error = await encryption({
                status: false,
                message: "Required field is missing!"
            })
            return res.status(404).send(error)
        }
        if (ref_code) {
            let parent = await Account.findOne({ username: ref_code }, { username: true })
            if (!parent) {
                let error = await encryption({
                    status: false,
                    message: "Invalid referral code!"
                })
                return res.status(404).send(error)
            }
        }
        data['password'] = CryptoJS.AES.encrypt(data.password, PASSWORD_ENCRYPTION_KEY).toString();

        let phoneCheck;
        let emailCheck = await Account.findOne({ email: data.email.toLowerCase() });
        if (data.phone) {
            phoneCheck = await Account.findOne({ phone: data.phone });
        }

        if (phoneCheck || emailCheck) {
            let error = await encryption({
                status: false,
                message: "Phone number or Email already exist!"
            })
            res.status(400).send(error)
        } else {
            const otpTokenKey = 'thisisforotponly'

            let createObj = { data };

            const countryTimezone = ct.getCountry(countriesIso[country_iso_code]);
            if (countryTimezone?.timezones.length > 1) {
                createObj.data.timezone = null;
            } else {
                createObj.data.timezone = countryTimezone?.timezones[0];
            }

            const smsOtp = `${Math.floor(100000 + Math.random() * 900000)}`;
            const emailOtp = `${Math.floor(100000 + Math.random() * 900000)}`;

            let emailSend = 'failed';
            let phoneSend = 'failed';

            if (data.phone) {
                createObj['isPhone'] = true;
                let check;
                // If country iso code is "ARE", send WhatsApp message instead of SMS
                if (country_iso_code === "ARE") {
                    check = await sendWhatsAppMessage(data.phone, smsOtp);
                } else {
                    check = await sendSMSTemplate(data.phone, `Instapay mobile number verification OTP: ${smsOtp}`);
                }
                // console.log(check);
                if (check) { phoneSend = 'success'; createObj['sms_otp'] = smsOtp; } else { phoneSend = 'failed'; }
            } else { createObj['isPhone'] = false; }

            if (email) {
                createObj['isEmail'] = true;

                const language = 'english';
                const templateName = 'Signup OTP Code';

                const templateId = getTemplateId(language, templateName);

                const dynamicData = {
                    otp: emailOtp,
                };

                const check = await sendMailsHelper(email, 'Test message', 'Test Subject', templateId, dynamicData);

                // const check = await sendMails(email, `Hi ${company_name},\n\nYour instapay email verification OTP: ${emailOtp}`, "Email Verification");
                // const check = await sendMails(email, "d-2d5f929ed89847d693ab15621b95890f", emailLoginOtp, first_name);
                if (check) { emailSend = 'success'; createObj['email_otp'] = emailOtp; } else { emailSend = 'failed'; }
            } else { createObj['isEmail'] = false; }
            console.log(createObj, phoneSend);

            if (phoneSend == 'failed' && phone) {
                const data = await encryption({
                    status: false,
                    message: "Something went wrong while sending sms!",
                });
                return res.status(400).send(data);
            } else if (emailSend == 'failed') {
                const data = await encryption({
                    status: false,
                    message: "Something went wrong while sending mail!",
                });
                return res.status(400).send(data);
            } else {
                if (ref_code) { createObj['ref_code'] = ref_code }

                const JWTToken = jwt.sign(createObj, otpTokenKey, { expiresIn: '1h' })
                const data = await encryption({
                    status: true,
                    message: "OTP send successfully!",
                    token: JWTToken
                });
                return res.status(200).send(data);
            }
        }
        // }).catch (async (err) => {
        //     let error = await encryption({
        //         status: false,
        //         message: "Account registration failed!"
        //     })
        //     res.status(400).send(error)
        // })
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.verifyBusinessAccountRegisteration = async (req, res) => {
    try {
        // let data = req.body;
        let data = await decryption(req.body.data)
        var { token, sms_otp, email_otp } = data;
        const otpTokenKey = 'thisisforotponly'
        jwt.verify(token, otpTokenKey, async function (err, payload) {
            if (err) {
                let error = await encryption({
                    status: false,
                    message: "Verification failed!"
                })
                return res.status(403).send(error)
            }
            let isEmail = false;
            let isPhone = false;
            if (payload.isPhone && sms_otp == payload.sms_otp) { isPhone = true; }
            if (payload.isEmail && email_otp == payload.email_otp) { isEmail = true; }
            // console.log(payload, isEmail, isPhone);

            if (isEmail || isPhone) {
                if (isEmail == payload.isEmail && isPhone == payload.isPhone) {
                    var { phone, email, company_name, password, country_iso_code, country_name, country, category_id, purpose, timezone } = payload.data;

                    let createAccountObj = {
                        company_name: company_name,
                        password: password,
                        email: email.toLowerCase(),
                        account_type: 'business',
                        is_external_limit: false,
                        purpose: purpose ? purpose : '',
                        active: true,
                        email_verification: true,
                        status: 'active',
                        country_name: country_name,
                        country_iso_code: country_iso_code,
                        country: country,
                        timezone,
                        source: 'web'
                    }
                    if (payload.ref_code) {
                        let parent = await Account.findOne({ username: payload.ref_code }, { username: true })
                        if (parent) {
                            createAccountObj['parentId'] = parent._id
                        }
                    }
                    if (phone) { createAccountObj['phone'] = phone }
                    let categoryDetails = await Category.findOne({ $and: [{ _id: category_id }, { account_type: 'business' }] }, { business_type: true })
                    let countryDetails = await Country.findOne({ $and: [{ country_iso_code: country_iso_code }, { status: 'active' }, { business_registration_active: true }] }, { country_name: true, country_iso_code: true })
                    if (!categoryDetails || !countryDetails) {
                        let error = await encryption({
                            status: false,
                            message: "Account registration failed!"
                        })
                        return res.status(400).send(error)
                    }
                    // let level = await AccountLevel.findOne({ $and: [{ country: countryDetails._id }, { category: categoryDetails._id }, { level_no: 1 }, { account_type: 'individual' }] }, { account_type: true })
                    let level = await AccountLevel.findOne({ $and: [{ country: countryDetails._id }, { category: categoryDetails._id }, { level_no: 1 }, { account_type: 'business' }] }, { account_type: true })
                    if (level) { createAccountObj['level'] = level._id }
                    if (!level) {
                        let error = await encryption({
                            status: false,
                            message: "Account registration failed!"
                        })
                        return res.status(400).send(error)
                    }
                    if (categoryDetails) { createAccountObj['category'] = categoryDetails._id }
                    Account.create(createAccountObj).then(async (accData) => {
                        createWallet(accData._id, countryDetails);
                        // console.log(accData);
                        Company.create({
                            company_name: company_name,
                            account: accData._id
                        }).then(async (companyData) => {

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
                    let error = await encryption({
                        status: false,
                        message: "Verification failed!"
                    })
                    return res.status(403).send(error)
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Verification failed!"
                })
                return res.status(403).send(error)
            }
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

module.exports.sendEmailOtp = async (req, res) => {
    try {
        // let data = req.body;
        let data = await decryption(req.body.data)
        var { email, account_id } = data;
        email = email.toLowerCase();
        if (!email) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            })
            return res.status(404).send(error)
        }
        console.log(req.user_role);
        if (account_id == req.user._id) {
            let emailCheck = await Account.findOne({ email: data.email.toLowerCase() })
            Account.findOne({ $and: [{ _id: req.user._id }, { active: true }] }).then(async (accountDetails) => {
                if (accountDetails) {
                    if (emailCheck) {
                        let error = await encryption({
                            status: false,
                            message: "Email already exist!"
                        })
                        res.status(400).send(error)
                    } else {
                        const otpTokenKey = 'thisisforotponly'

                        let createObj = { email, account_id: accountDetails._id };

                        const emailOtp = `${Math.floor(100000 + Math.random() * 900000)}`;

                        let emailSend = 'failed';

                        if (email) {
                            createObj['isEmail'] = true;

                            const language = 'english';
                            const templateName = 'Login OTP Code';

                            const templateId = getTemplateId(language, templateName);

                            const dynamicData = {
                                otp: emailOtp,
                            };

                            const check = await sendMailsHelper(email, 'Test message', 'Test Subject', templateId, dynamicData);

                            // const check = await sendMails(email, `Hi ${accountDetails?.first_name},\n\nYour instapay email verification OTP: ${emailOtp}`, "Email Verification");
                            // const check = await sendMails(email, "d-2d5f929ed89847d693ab15621b95890f", emailLoginOtp, first_name);
                            if (check) { emailSend = 'success'; createObj['email_otp'] = emailOtp; } else { emailSend = 'failed'; }
                        } else { createObj['isEmail'] = false; }

                        if (emailSend == 'failed' && email) {
                            const data = await encryption({
                                status: false,
                                message: "Something went wrong while sending mail!",
                            });
                            return res.status(400).send(data);
                        } else {
                            const JWTToken = jwt.sign(createObj, otpTokenKey, { expiresIn: '125s' })
                            const data = await encryption({
                                status: true,
                                message: "OTP send successfully!",
                                token: JWTToken
                            });
                            return res.status(200).send(data);
                        }
                    }
                } else {
                    let error = await encryption({
                        status: false,
                        message: "Account not exsit!"
                    })
                    res.status(400).send(error)
                }
            }).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Email registration failed!"
                })
                res.status(400).send(error)
            })
        } else {
            let error = await encryption({
                status: false,
                message: "Unauthorized access!"
            })
            res.status(400).send(error)
        }
    } catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.verifyEmailOtp = async (req, res) => {
    try {
        // let data = req.body;
        let data = await decryption(req.body.data)
        var { token, otp, email, account_id } = data;
        email = email.toLowerCase();

        if (!email || !token || !otp) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            })
            return res.status(404).send(error)
        }

        if (account_id == req.user._id) {
            let emailCheck = await Account.findOne({ email: data.email.toLowerCase() })
            Account.findOne({ $and: [{ _id: req.user._id }, { active: true }] }).then(async (accountDetails) => {
                if (accountDetails) {
                    if (emailCheck) {
                        let error = await encryption({
                            status: false,
                            message: "Email already exist!"
                        })
                        res.status(400).send(error)
                    } else {
                        const otpTokenKey = 'thisisforotponly'
                        jwt.verify(token, otpTokenKey, async function (err, payload) {
                            console.log(err, payload);
                            if (err) {
                                let error = await encryption({
                                    status: false,
                                    message: "Verification failed!"
                                })
                                return res.status(403).send(error)
                            }

                            if (email == payload.email && otp == payload.email_otp && account_id == payload.account_id) {

                                Account.findByIdAndUpdate({ _id: accountDetails._id }, { email }, { new: true }).then(async (accData) => {
                                    var ciphertext = await encryption({
                                        status: true,
                                        message: "Email updated successfully!",
                                        // accountData: accData
                                    })
                                    res.status(200).send(ciphertext)
                                }).catch(async (err) => {
                                    let error = await encryption({
                                        status: false,
                                        message: "Verification failed!"
                                    })
                                    res.status(400).send(error)
                                })
                            } else {
                                let error = await encryption({
                                    status: false,
                                    message: "Verification failed!"
                                })
                                return res.status(403).send(error)
                            }

                        })
                    }
                } else {
                    let error = await encryption({
                        status: false,
                        message: "Account not exsit!"
                    })
                    res.status(400).send(error)
                }
            }).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Email registration failed!"
                })
                res.status(400).send(error)
            })
        } else {
            let error = await encryption({
                status: false,
                message: "Unauthorized access!"
            })
            res.status(400).send(error)
        }
    } catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.sendPhoneOtp = async (req, res) => {
    try {
        // let data = req.body;
        let data = await decryption(req.body.data)
        var { phone, account_id } = data;
        phone = phone.toLowerCase();
        console.log(data);
        if (!phone) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            })
            return res.status(404).send(error)
        }
        if (account_id == req.user._id) {
            let phoneCheck = await Account.findOne({ phone: data.phone.toLowerCase() })
            Account.findOne({ $and: [{ _id: req.user._id }, { active: true }] }).then(async (accountDetails) => {
                if (accountDetails) {
                    if (phoneCheck) {
                        let error = await encryption({
                            status: false,
                            message: "Phone No already exist!"
                        })
                        res.status(400).send(error)
                    } else {
                        const otpTokenKey = 'thisisforotponly'

                        let createObj = { phone, account_id: accountDetails._id };

                        const smsOtp = `${Math.floor(100000 + Math.random() * 900000)}`;

                        let phoneSend = 'failed';
                        // console.log(smsOtp);
                        // if (phone) {
                        //     const check = await sendMails(email, `Hi ${accountDetails?.first_name},\n\nYour instapay email verification OTP: ${emailOtp}`, "Email Verification");
                        //     // const check = await sendMails(email, "d-2d5f929ed89847d693ab15621b95890f", emailLoginOtp, first_name);
                        //     if (check) { emailSend = 'success'; createObj['email_otp'] = emailOtp; } else { emailSend = 'failed'; }
                        // } else { createObj['isEmail'] = false; }

                        if (phone) {
                            const check = await sendSMSTemplate(phone, `Instapay mobile number verification OTP: ${smsOtp}`)
                            if (check) { phoneSend = 'success'; createObj['sms_otp'] = smsOtp; } else { phoneSend = 'failed'; }
                        } else { createObj['isPhone'] = false; }

                        if (phoneSend == 'failed' && phone) {
                            const data = await encryption({
                                status: false,
                                message: "Something went wrong while sending sms!",
                            });
                            return res.status(400).send(data);
                        } else {
                            const JWTToken = jwt.sign(createObj, otpTokenKey, { expiresIn: '125s' })
                            const data = await encryption({
                                status: true,
                                message: "OTP send successfully!",
                                token: JWTToken
                            });
                            return res.status(200).send(data);
                        }
                    }
                } else {
                    let error = await encryption({
                        status: false,
                        message: "Account not exsit!"
                    })
                    res.status(400).send(error)
                }
            }).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Phone registration failed!"
                })
                res.status(400).send(error)
            })
        } else {
            let error = await encryption({
                status: false,
                message: "Unauthorized access!"
            })
            res.status(400).send(error)
        }
    } catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.verifyPhoneOtp = async (req, res) => {
    try {
        // let data = req.body;
        let data = await decryption(req.body.data)
        var { token, otp, phone, account_id } = data;
        phone = phone.toLowerCase();

        if (!phone || !token || !otp) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            })
            return res.status(404).send(error)
        }

        if (account_id == req.user._id) {
            let phoneCheck = await Account.findOne({ phone: data.phone })
            Account.findOne({ $and: [{ _id: req.user._id }, { active: true }] }).then(async (accountDetails) => {
                if (accountDetails) {
                    if (phoneCheck) {
                        let error = await encryption({
                            status: false,
                            message: "Phone No already exist!"
                        })
                        res.status(400).send(error)
                    } else {
                        const otpTokenKey = 'thisisforotponly'
                        jwt.verify(token, otpTokenKey, async function (err, payload) {
                            // console.log(err, payload);
                            if (err) {
                                let error = await encryption({
                                    status: false,
                                    message: "Verification failed!"
                                })
                                return res.status(403).send(error)
                            }

                            if (phone == payload.phone && otp == payload.sms_otp && account_id == payload.account_id) {

                                Account.findByIdAndUpdate({ _id: accountDetails._id }, { phone }, { new: true }).then(async (accData) => {
                                    var ciphertext = await encryption({
                                        status: true,
                                        message: "Phone No updated successfully!",
                                        // accountData: accData
                                    })
                                    res.status(200).send(ciphertext)
                                }).catch(async (err) => {
                                    let error = await encryption({
                                        status: false,
                                        message: "Verification failed!"
                                    })
                                    res.status(400).send(error)
                                })
                            } else {
                                let error = await encryption({
                                    status: false,
                                    message: "Verification failed!"
                                })
                                return res.status(403).send(error)
                            }

                        })
                    }
                } else {
                    let error = await encryption({
                        status: false,
                        message: "Account not exsit!"
                    })
                    res.status(400).send(error)
                }
            }).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Phone No registration failed!"
                })
                res.status(400).send(error)
            })
        } else {
            let error = await encryption({
                status: false,
                message: "Unauthorized access!"
            })
            res.status(400).send(error)
        }
    } catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.enable2fa = async (req, res) => {
    // console.log(req.body);
    try {
        // let data = await decryption(req.body.data)
        var { account_id } = req.params;
        Account.findOne({ _id: account_id }).then(async (account) => {
            // console.log(account);
            if (!account) {
                let error = await encryption({
                    status: false,
                    message: "Account not found!"
                })
                res.status(404).send(error)
            } else {
                if (account_id != req.user._id) {
                    let error = await encryption({
                        status: false,
                        message: "Unauthorized!"
                    })
                    return res.status(403).send(error)
                }
                if (account?.status === 'inactive') {
                    let error = await encryption({
                        status: false,
                        message: "Account inactive"
                    })
                    return res.status(404).send(error)
                } else if (account?.status === 'onhold') {
                    let error = await encryption({
                        status: false,
                        message: "Account is on hold"
                    })
                    return res.status(404).send(error)
                }

                let auth_secret = await AuthSecret.findOne({ account: account._id })
                if (auth_secret && account.tfa) {
                    let error = await encryption({
                        status: false,
                        message: "Two-Factor Authentication already enabled."
                    })
                    return res.status(404).send(error)
                }
                // Generate a secret key for the user
                // const base32_secret = generateBase32Secret();

                // user.secret = base32_secret;
                let label = '';
                if (account.account_type == 'individual') { label = account.phone }
                if (account.account_type == 'business') { label = account.email }
                // // Generate a QR code URL for the user to scan


                // Generate secret and QR Code URL
                const secret = generateBase64Secret();
                const accountName = label;
                const issuer = 'InstaPay';
                // let totp = new OTPAuth.TOTP({
                //     issuer: "InstaPay",
                //     label: label,
                //     algorithm: "SHA1",
                //     digits: 6,
                //     secret: secret,
                // });
                const qrCodeUrl = generateQRCodeURL(secret, accountName, issuer);
                // const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrCodeUrl)}`
                // let otpauth_url = totp.toString();
                // Generate and send the QR code as a response
                console.log(qrCodeUrl);
                QRCode.toDataURL(qrCodeUrl, async (err, qrUrl) => {
                    if (err) {
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong please try again after a while."
                        })
                        return res.status(400).send(error)
                    }
                    if (auth_secret && !account.tfa) {
                        let updt = await AuthSecret.updateOne({ _id: auth_secret._id }, { $set: { value: secret } })
                        if (updt.modifiedCount == 1) {
                            let ciphertext = await encryption({
                                status: true,
                                data: {
                                    qrCodeUrl: qrUrl,
                                    secret: secret
                                }
                            })
                            res.status(200).send(ciphertext)
                        } else {
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong please try again after a while."
                            })
                            return res.status(400).send(error)
                        }
                    } else {
                        let authSecretObj = {
                            value: secret,
                            account: account._id
                        }

                        AuthSecret.create(authSecretObj).then(async (authSecretCreated) => {
                            let ciphertext = await encryption({
                                status: true,
                                data: {
                                    qrCodeUrl: qrUrl,
                                    secret: secret
                                }
                            })
                            res.status(200).send(ciphertext)
                        }).catch(async (err) => {
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong please try again after a while."
                            })
                            return res.status(400).send(error)
                        })
                    }
                    // res.json({
                    //     status: "success",
                    //     data: {
                    //         qrCodeUrl: qrUrl,
                    //         secret: secret
                    //     }
                    // })
                })

            }
        }).catch(async (err) => {
            let error = await encryption({
                stack: err.stack,
                code: err.code,
                message: err.message
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

function generateBase64Secret(length = 32) {
    const buffer = crypto.randomBytes(length);
    buffer.toString('base64');
    const base32 = encode.encode(buffer).replace(/=/g, "").substring(0, 24);
    return base32
}

// Function to generate QR Code URL
function generateQRCodeURL(secret, accountName, issuer) {
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?issuer=${encodeURIComponent(issuer)}&secret=${secret}&algorithm=SHA1&digits=6&period=30`;
}


// const generateBase32Secret = () => {
//     const buffer = crypto.randomBytes(20);
//     const base32 = encode.encode(buffer).replace(/=/g, "").substring(0, 24);
//     console.log(base32);
//     return base32;
// };

module.exports.verifyEnable2fa = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        // let data = req.body;
        const { account_id, code } = data;
        let accountDetails = await Account.findOne({ _id: account_id })
        if (!accountDetails) {
            let error = await encryption({
                status: false,
                message: "Account not found!"
            })
            res.status(404).send(error)
        }
        let authSecretDetails = await AuthSecret.findOne({ account: account_id })
        if (!authSecretDetails) {
            let error = await encryption({
                status: false,
                message: "Authentication failed!"
            })
            res.status(404).send(error)
        }
        if (account_id != req.user._id) {
            let error = await encryption({
                status: false,
                message: "Unauthorized!"
            })
            return res.status(403).send(error)
        }
        // Verify the token
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

        // let delta = totp.validate({ token: code });
        const secret = authSecretDetails.value;
        const userProvidedToken = code;
        const isValid = await verifyTOTP(userProvidedToken, secret);

        if (isValid) {
            let updt = await Account.updateOne({ _id: accountDetails._id }, { $set: { tfa: true } })
            let ciphertext = await encryption({
                status: true,
                message: "Authentication successful"
            })
            return res.status(200).send(ciphertext)
            // res.json({
            //     status: "success",
            //     message: "Authentication successful"
            // })
        } else {
            let error = await encryption({
                status: false,
                message: "Authentication failed!"
            })
            return res.status(400).send(error)
            // res.status(401).json({
            //     status: "fail",
            //     message: "Authentication failed"
            // })
        }
    } catch (err) {

        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        return res.status(500).send(error)
    }
}

// Function to convert Base32 to Hex
const base32toHex = (base32) => {
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    let hex = '';

    for (let i = 0; i < base32.length; i++) {
        const val = base32Chars.indexOf(base32.charAt(i).toUpperCase());
        bits += val.toString(2).padStart(5, '0');
    }

    for (let i = 0; i + 4 <= bits.length; i += 4) {
        const chunk = bits.substr(i, 4);
        hex = hex + parseInt(chunk, 2).toString(16);
    }

    return hex;
};

// Function to generate HOTP
const generateHOTP = (key, counter) => {
    const keyHex = base32toHex(key);
    const counterHex = counter.toString(16).padStart(16, '0');

    const hmac = crypto.createHmac('sha1', Buffer.from(keyHex, 'hex'));
    hmac.update(Buffer.from(counterHex, 'hex'));

    const hmacResult = hmac.digest('hex');
    const offset = parseInt(hmacResult.substr(hmacResult.length - 1), 16);

    const binary =
        ((parseInt(hmacResult.substr(offset * 2, 8), 16) & 0x7fffffff) % 1000000).toString();

    return binary.padStart(6, '0');
};

// Function to generate TOTP
const generateTOTP = (secret, window = 1) => {
    const epoch = Math.floor(new Date().getTime() / 1000);
    const timeStep = Math.floor(epoch / 30);
    const steps = [];

    for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
        steps.push(timeStep + errorWindow);
    }

    return steps.map((step) => generateHOTP(secret, step));
};

// Function to verify TOTP
const verifyTOTP = async (token, secret, window = 1) => {
    const generatedTOTPs = generateTOTP(secret, window);
    console.log(generatedTOTPs);
    return generatedTOTPs.find(v => v.toString() == token.toString());
};


module.exports.accountLogin = async (req, res) => {
    // console.log(req.body);
    try {
        let data = await decryption(req.body.data)
        var { email, phone, password } = data;

        if (email) {
            Account.findOne({ email: data.email.toLowerCase() }).then(async (account) => {
                if (!account) {
                    let error = await encryption({
                        status: false,
                        message: "Account not found!"
                    })
                    res.status(404).send(error)
                } else {
                    if (account?.status === 'inactive') {
                        let error = await encryption({
                            status: false,
                            message: "Account inactive"
                        })
                        return res.status(404).send(error)
                    } else if (account?.status === 'onhold') {
                        let error = await encryption({
                            status: false,
                            message: "Account is on hold"
                        })
                        return res.status(404).send(error)
                    }
                    var bytes = await CryptoJS.AES.decrypt(account.password, PASSWORD_ENCRYPTION_KEY);
                    var pass = bytes.toString(CryptoJS.enc.Utf8);
                    // console.log(pass, data);
                    if (pass === data.password) {
                        const JWTToken = jwt.sign({
                            email: account.email,
                            password: account.password,
                            account_type: account.account_type,
                            _id: account._id
                        }, TOKEN_KEY, { expiresIn: '60m' })
                        var ciphertext = await encryption({
                            success: true,
                            token: JWTToken
                        })
                        res.status(200).send(ciphertext)
                    } else {
                        let error = await encryption({
                            status: false,
                            message: "Incorrect Password!"
                        })
                        res.status(400).send(error)
                    }
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    stack: err.stack,
                    code: err.code,
                    message: err.message
                })
                res.status(400).send(error)
            })
        } else if (phone) {
            Account.findOne({ phone: data.phone.toLowerCase() }).then(async (account) => {
                if (!account) {
                    let error = await encryption({
                        status: false,
                        message: "Account not found!"
                    })
                    res.status(404).send(error)
                } else {
                    if (account?.status === 'inactive') {
                        let error = await encryption({
                            status: false,
                            message: "Account inactive"
                        })
                        return res.status(404).send(error)
                    } else if (account?.status === 'onhold') {
                        let error = await encryption({
                            status: false,
                            message: "Account is on hold"
                        })
                        return res.status(404).send(error)
                    }
                    var bytes = await CryptoJS.AES.decrypt(account.password, PASSWORD_ENCRYPTION_KEY);
                    var pass = bytes.toString(CryptoJS.enc.Utf8);
                    // console.log(pass, data);
                    if (pass === data.password) {
                        const JWTToken = jwt.sign({
                            phone: account.phone,
                            password: account.password,
                            account_type: account.account_type,
                            _id: account._id
                        }, TOKEN_KEY, { expiresIn: '60m' })
                        var ciphertext = await encryption({
                            success: true,
                            token: JWTToken
                        })
                        res.status(200).send(ciphertext)
                    } else {
                        let error = await encryption({
                            status: false,
                            message: "Incorrect Password!"
                        })
                        res.status(400).send(error)
                    }
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    stack: err.stack,
                    code: err.code,
                    message: err.message
                })
                res.status(400).send(error)
            })
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.currentUser = async (req, res) => {
    try {
        jwt.verify(req.params.token, TOKEN_KEY, async function (err, payload) {
            if (err) {
                let error = await encryption({
                    status: false,
                    message: "Invalid token"
                })
                res.status(500).send(error)
            } else {
                Account.findOne({ _id: payload._id }, { instaBotToken: 0, insta_subscriber_id: 0, whatsAppBotToken: 0 }).populate(['user', 'company', 'country', 'category', 'level'])
                    .then(async (user) => {
                        if (user?.password == payload.password) {
                            // res.status(200).send(user)
                            var ciphertext = await encryption(user)
                            res.status(200).send(ciphertext)
                        } else {
                            let error = await encryption({
                                status: false,
                                message: "Invalid token"
                            })
                            res.status(500).send(error)
                        }
                    })
                    .catch(async (err) => {
                        let error = await encryption({
                            status: false,
                            message: "Invalid token"
                        })
                        res.status(500).send(error)
                    })
            }
        })
    } catch (err) {
        console.log(err);
        res.status(500).send({
            message: "Internal server error!",
            status: "500",
            err
        })
    }
}

module.exports.updateTfaSettings = async (req, res) => {
    try {
        let account_id = req.params.account_id;
        if (req.user._id != account_id) {
            let error = await encryption({
                message: "Unauthorized user.",
                status: false,
            })
            return res.status(401).send(error)
        }
        // let data = req.body;
        let data = await decryption(req.body.data)
        var { sms_verification, email_verification } = data;

        if (!sms_verification && !email_verification) {
            let error = await encryption({
                message: "Cannot inactive both.",
                status: false,
            })
            return res.status(401).send(error)
        }

        Account.findOne({ $and: [{ _id: account_id }, { account_type: 'individual' }, { active: true }] }).then(async (user) => {
            if (user && !user?.delete) {
                if (sms_verification && !user.phone) {
                    let error = await encryption({
                        message: "Phone number not exist",
                        status: false,
                    })
                    return res.status(401).send(error)
                }
                let accUpdate = await Account.findByIdAndUpdate({ _id: account_id }, { sms_verification, email_verification }, { new: true })
                let ciphertext = await encryption({
                    status: true,
                    account: accUpdate,
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found"
                })
                res.status(500).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Invalid token"
            })
            res.status(500).send(error)
        })


    } catch (err) {
        console.log(err);
        res.status(500).send({
            message: "Internal server error!",
            status: "500",
            err
        })
    }
}

module.exports.updateIndividualAccount = async (req, res) => {
    try {
        let account_id = req.params.account_id;
        if (req.user._id != account_id) {
            let error = await encryption({
                message: "Unauthorized user.",
                status: false,
            })
            return res.status(401).send(error)
        }
        // let data = req.body;
        let data = await decryption(req.body.data)
        var { first_name, last_name, address, city, country, postal_code, about_me, timezone, dob, gender, tfa } = data;
        let objUser = {}
        let objAccount = { tfa }
        if (first_name) { objUser['first_name'] = first_name }
        if (last_name) { objUser['last_name'] = last_name }
        if (first_name) { objAccount['first_name'] = first_name }
        if (last_name) { objAccount['last_name'] = last_name }
        if (address) { objAccount['address'] = address }
        if (city) { objAccount['city'] = city }
        if (country) { objAccount['country'] = country }
        if (postal_code) { objAccount['postal_code'] = postal_code }
        if (about_me) { objAccount['about_me'] = about_me }
        if (timezone) { objAccount['timezone'] = timezone }
        if (dob) { objAccount['dob'] = dob }
        if (gender) { objAccount['gender'] = gender }

        // profile completion checking
        let completedFields = 0
        let totalBasicFields = 0
        let basicFields = {}

        const checkFields = (fieldName, value) => {
            totalBasicFields++;
            if (value) {
                completedFields++
                basicFields[fieldName] = true
            } else {
                basicFields[fieldName] = false
            }
        }


        Account.findOne({ $and: [{ _id: account_id }, { account_type: 'individual' }, { active: true }] }).populate(['user']).then(async (user) => {
            if (user) {
                let accUpdate = await Account.findByIdAndUpdate({ _id: account_id }, objAccount, { new: true })
                let userUpdate = user.user;
                if (objUser.first_name || objUser.last_name) {
                    userUpdate = await User.findByIdAndUpdate({ _id: user.user._id }, objUser, { new: true })
                }

                // profile completion check
                checkFields('first_name', userUpdate.first_name);
                checkFields('last_name', userUpdate.last_name);
                checkFields('address', accUpdate.address);
                checkFields('city', accUpdate.city);
                checkFields('country', accUpdate.country);
                checkFields('postal_code', accUpdate.postal_code);
                checkFields('about_me', accUpdate.about_me);
                checkFields('timezone', accUpdate.timezone);
                checkFields('dob', accUpdate.dob);

                let securityQuestionsCount = 0;
                const checkSecurityQuestions = (questionNumber, answer) => {
                    if (questionNumber && answer) {
                        securityQuestionsCount++;
                    }
                };

                checkSecurityQuestions(userUpdate.question1, userUpdate.answer1);
                checkSecurityQuestions(userUpdate.question2, userUpdate.answer2);
                checkSecurityQuestions(userUpdate.question3, userUpdate.answer3);

                let profileCompleted = (completedFields === totalBasicFields && securityQuestionsCount === 3);

                user.profileCompleted = profileCompleted;
                await user.save()

                let ciphertext = await encryption({
                    status: true,
                    account: accUpdate,
                    user: userUpdate
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found"
                })
                res.status(500).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Invalid token"
            })
            res.status(500).send(error)
        })


    } catch (err) {
        console.log(err);
        res.status(500).send({
            message: "Internal server error!",
            status: "500",
            err
        })
    }
}

module.exports.updateBusinessAccount = async (req, res) => {
    try {
        let account_id = req.params.account_id;
        if (req.user._id != account_id) {
            let error = await encryption({
                message: "Unauthorized user.",
                status: false,
            })
            return res.status(401).send(error)
        }
        // let data = req.body;
        let data = await decryption(req.body.data)
        var { company_name, address, city, country, postal_code, about_me, timezone, tfa } = data;
        let objCompany = {}
        let objAccount = { tfa }
        if (company_name) { objCompany['company_name'] = company_name }
        if (company_name) { objAccount['company_name'] = company_name }
        if (address) { objAccount['address'] = address }
        if (city) { objAccount['city'] = city }
        if (country) { objAccount['country'] = country }
        if (postal_code) { objAccount['postal_code'] = postal_code }
        if (about_me) { objAccount['about_me'] = about_me }
        if (timezone) { objAccount['timezone'] = timezone }

        // profile completion checking
        let completedFields = 0
        let totalBasicFields = 0
        let basicFields = {}

        const checkFields = (fieldName, value) => {
            totalBasicFields++;
            if (value) {
                completedFields++
                basicFields[fieldName] = true
            } else {
                basicFields[fieldName] = false
            }
        }

        Account.findOne({ $and: [{ _id: account_id }, { account_type: 'business' }, { active: true }] }).populate(['company']).then(async (user) => {
            if (user) {
                let accUpdate = await Account.findByIdAndUpdate({ _id: account_id }, objAccount, { new: true })
                let companyUpdate = user.company;
                if (company_name) {
                    companyUpdate = await Company.findByIdAndUpdate({ _id: user.company._id }, objCompany, { new: true })
                }

                // profile completion check
                checkFields('company_name', companyUpdate.company_name);
                checkFields('address', accUpdate.address);
                checkFields('city', accUpdate.city);
                checkFields('country', accUpdate.country);
                checkFields('postal_code', accUpdate.postal_code);
                checkFields('about_me', accUpdate.about_me);
                checkFields('timezone', accUpdate.timezone);

                let securityQuestionsCount = 0;
                const checkSecurityQuestions = (questionNumber, answer) => {
                    if (questionNumber && answer) {
                        securityQuestionsCount++;
                    }
                };

                checkSecurityQuestions(companyUpdate.question1, companyUpdate.answer1);
                checkSecurityQuestions(companyUpdate.question2, companyUpdate.answer2);
                checkSecurityQuestions(companyUpdate.question3, companyUpdate.answer3);

                let profileCompleted = (completedFields === totalBasicFields && securityQuestionsCount === 3);

                user.profileCompleted = profileCompleted;
                await user.save()

                let ciphertext = await encryption({
                    status: true,
                    account: accUpdate,
                    company: companyUpdate
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found"
                })
                res.status(500).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Invalid token"
            })
            res.status(500).send(error)
        })

    } catch (err) {
        console.log(err);
        res.status(500).send({
            message: "Internal server error!",
            status: "500",
            err
        })
    }
}

module.exports.getAllAccounts = async (req, res) => {
    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        if (skip < 1) { skip = 1; }
        skip = (skip - 1) * 50;
        if (limit > 100) {
            limit = 100;
        }
        Account.find().populate(['user', 'company']).skip(skip).limit(limit).then(async (accountsList) => {
            // console.log(accountsList)
            if (accountsList.length) {
                let resp = await encryption({
                    status: true,
                    message: "User's Account",
                    accountsList
                })
                res.status(200).send(resp)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No user found"
                })
                res.status(404).send(error)

            }
        }).catch(async (err) => {
            console.log(err)
            let error = await encryption({
                status: false,
                message: "Account not found!"
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

module.exports.getUserSendPaymentRequest = async (req, res) => {
    try {
        let user_id = req.params.user_id
        RequestPayment.find({ sender: user_id }).populate([{
            path: 'sender',
            populate: (['user', 'company'])
        }, {
            path: 'receiver',
            populate: (['user', 'company'])
        }]).then(async (paymentRequests) => {
            if (paymentRequests.length) {
                let resp = await encryption({
                    status: true,
                    message: "User's Payment request",
                    paymentRequests
                })
                res.status(200).send(resp)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No reequest found"
                })
                res.status(404).send(error)

            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting request list!"
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

module.exports.getUserReceivePaymentRequest = async (req, res) => {
    try {

        console.log('dd');
        let user_id = req.params.user_id
        RequestPayment.find({ receiver: user_id }).populate([{
            path: 'sender',
            populate: (['user', 'company'])
        }, {
            path: 'receiver',
            populate: (['user', 'company'])
        }]).then(async (paymentRequests) => {
            if (paymentRequests.length) {
                let resp = await encryption({
                    status: true,
                    message: "User's Payment request",
                    paymentRequests
                })
                res.status(200).send(resp)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No reequest found"
                })
                res.status(404).send(error)

            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting request list!"
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

module.exports.updateAccountStatus = async (req, res) => {
    try {
        let account_id = req.params.account_id;
        let status = req.params.status;
        Account.findOne({ _id: account_id }).then(async (account) => {
            if (account) {
                if (status === 'inactive' || status === 'onhold' || status === 'delete') {
                    account.active = false;
                    account.status = status;
                    account.deleted = true;
                } else if (status === 'active') {
                    account.active = true;
                    account.status = status;
                    account.deleted = false;
                } else {
                    let error = await encryption({
                        status: false,
                        message: "Invalid Status"
                    })
                    return res.status(400).send(error)
                }

                account.save().then(async (account) => {
                    let resp = await encryption({
                        status: true,
                        message: "Account activated successfully.",
                        account
                    })
                    res.status(200).send(resp)
                }).catch(async (err) => {
                    console.log(err);
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while account updation!."
                    })
                    res.status(404).send(error)
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
                message: "Something went wrong while activating account."
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

module.exports.activateAccount = async (req, res) => {
    try {
        let account_id = req.params.account_id
        Account.findByIdAndUpdate({ _id: account_id }, { active: true }, { new: true }).then(async (accountsList) => {
            console.log(accountsList);
            if (accountsList) {
                let resp = await encryption({
                    status: true,
                    message: "Account activated successfully."
                })
                res.status(200).send(resp)
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account activation failed."
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while activating account."
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

module.exports.deactivateAccount = async (req, res) => {
    try {
        let account_id = req.params.account_id
        Account.findByIdAndUpdate({ _id: account_id }, { active: false }, { new: true }).then(async (accountsList) => {
            if (accountsList) {
                let resp = await encryption({
                    status: true,
                    message: "Account deactivated successfully."
                })
                res.status(200).send(resp)
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account deactivation failed."
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while deactivating account."
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

module.exports.updateIndividualAccountByAdmin = async (req, res) => {
    try {
        let account_id = req.params.account_id;

        // let data = req.body;
        let data = await decryption(req.body.data)
        var { first_name, last_name, username, phone, email, address, city, country, country_name, country_iso_code, postal_code, about_me } = data;
        let objUser = {}
        let objAccount = {}
        if (first_name) { objUser['first_name'] = first_name }
        if (last_name) { objUser['last_name'] = last_name }
        if (first_name) { objAccount['first_name'] = first_name }
        if (last_name) { objAccount['last_name'] = last_name }
        if (email) { objAccount['email'] = email }
        if (phone) { objAccount['phone'] = phone }
        if (address) { objAccount['address'] = address }
        if (city) { objAccount['city'] = city }
        if (country) { objAccount['country'] = country }
        if (country_name) { objAccount['country_name'] = country_name }
        if (country_iso_code) { objAccount['country_iso_code'] = country_iso_code }
        if (postal_code) { objAccount['postal_code'] = postal_code }
        if (about_me) { objAccount['about_me'] = about_me }
        if (username) { objAccount['username'] = username }

        Account.findOne({ $and: [{ _id: account_id }, { account_type: 'individual' }] }).populate(['user']).then(async (user) => {
            if (user) {
                let accUpdate = await Account.findByIdAndUpdate({ _id: account_id }, objAccount, { new: true })
                let userUpdate = user.user;
                if (objUser.first_name || objUser.last_name) {
                    userUpdate = await User.findByIdAndUpdate({ _id: user.user._id }, objUser, { new: true })
                }

                let ciphertext = await encryption({
                    status: true,
                    account: accUpdate,
                    user: userUpdate
                })
                res.status(200).send(ciphertext)
            } else {
                console.log(user);
                let error = await encryption({
                    status: false,
                    message: "Account not found"
                })
                res.status(500).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account."
            })
            res.status(500).send(error)
        })

    } catch (err) {
        console.log(err);
        res.status(500).send({
            message: "Internal server error!",
            status: "500",
            err
        })
    }
}

module.exports.updateBusinessAccountByAdmin = async (req, res) => {
    try {
        let account_id = req.params.account_id;

        // let data = req.body;
        let data = await decryption(req.body.data)
        var { company_name, address, email, city, country, country_name, country_iso_code, postal_code, about_me } = data;
        let objCompany = {}
        let objAccount = {}
        if (company_name) { objCompany['company_name'] = company_name }
        if (company_name) { objAccount['company_name'] = company_name }
        if (email) { objAccount['email'] = email }
        if (address) { objAccount['address'] = address }
        if (city) { objAccount['city'] = city }
        if (country) { objAccount['country'] = country }
        if (country_name) { objAccount['country_name'] = country_name }
        if (country_iso_code) { objAccount['country_iso_code'] = country_iso_code }
        if (postal_code) { objAccount['postal_code'] = postal_code }
        if (about_me) { objAccount['about_me'] = about_me }

        Account.findOne({ $and: [{ _id: account_id }, { account_type: 'business' }] }).populate(['company']).then(async (user) => {
            if (user) {
                let accUpdate = await Account.findByIdAndUpdate({ _id: account_id }, objAccount, { new: true })
                let companyUpdate = user.company;
                if (company_name) {
                    companyUpdate = await Company.findByIdAndUpdate({ _id: user.company._id }, objCompany, { new: true })
                }

                let ciphertext = await encryption({
                    status: true,
                    account: accUpdate,
                    company: companyUpdate
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found"
                })
                res.status(500).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Invalid token"
            })
            res.status(500).send(error)
        })

    } catch (err) {
        console.log(err);
        res.status(500).send({
            message: "Internal server error!",
            status: "500",
            err
        })
    }
}

module.exports.updateAccountSettings = async (req, res) => {
    try {
        let account_id = req.params.account_id;

        // let data = req.body;
        let data = await decryption(req.body.data)

        const externalLimits = {
            account_balance_limit: data.account_balance_limit,
            wallet_limit_conversion: data.wallet_limit_conversion,
            transaction_amount_limit: data.transaction_amount_limit,
            topup_min_amount: data.topup_min_amount,
            topup_max_amount: data.topup_max_amount,
            daily_sending_limit: data.daily_sending_limit,
            monthly_sending_limit: data.monthly_sending_limit,
            yearly_sending_limit: data.yearly_sending_limit,
            daily_receiving_limit: data.daily_receiving_limit,
            monthly_receiving_limit: data.monthly_receiving_limit,
            yearly_receiving_limit: data.yearly_receiving_limit,
            daily_transaction_count: data.daily_transaction_count,
            monthly_transaction_count: data.monthly_transaction_count,
            yearly_transaction_count: data.yearly_transaction_count,
        };

        const updatedAccount = await Account.findByIdAndUpdate(
            account_id,
            {
                $set: {
                    external_limits: externalLimits,
                    is_external_limit: data.is_external_limit,
                    level: data.level,
                }
            },
            { new: true }
        );

        if (!updatedAccount) {
            const error = await encryption({
                status: false,
                message: "Account not found!"
            })
            return res.status(404).send(error);
        }

        const ciphertext = await encryption({
            status: true,
            account: updatedAccount
        });

        res.status(200).send(ciphertext);

    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.updateUsername = async (req, res) => {
    try {
        let account_id = req.params.account_id;
        // let data = req.body;
        let data = await decryption(req.body.data)
        var { username } = data;

        if (req.user._id != account_id) {
            let error = await encryption({
                message: "Unauthorized user.",
                status: false,
            })
            return res.status(401).send(error)
        }

        if (!username) {
            let error = await encryption({
                message: "Required field are missing.",
                status: false,
            })
            return res.status(401).send(error)
        }

        // checking username validation and also the minimum and maximum limit
        if (username.length < 6 || username.length > 30) {
            let error = await encryption({
                message: "Username should be between 3 and 30 characters.",
                status: false,
            })
            return res.status(401).send(error)
        }



        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).populate(['level']).then(async (user) => {
            if (user) {
                let accFound = await Account.findOne({ username: username.toLowerCase() })
                if (accFound) {
                    let error = await encryption({
                        message: "This username is already taken.",
                        status: false,
                    })
                    return res.status(400).send(error)
                } else {
                    let accUpdate = await Account.findByIdAndUpdate({ _id: account_id }, { username }, { new: true })

                    let ciphertext = await encryption({
                        status: true,
                        account: accUpdate
                    })
                    res.status(200).send(ciphertext)
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found"
                })
                res.status(500).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account."
            })
            res.status(500).send(error)
        })

    } catch (err) {
        // console.log(err);
        res.status(500).send({
            message: "Internal server error!",
            status: "500",
            err
        })
    }
}

module.exports.getInstaChatbotLinkCode = async (req, res) => {
    try {
        let code = Math.floor(1000 + Math.random() * 9000);
        let account_id = req.params.account_id;
        // if (req.user._id != account_id) {
        //     let error = await encryption({
        //         message: "Unauthorized user.",
        //         status: false,
        //     })
        //     return res.status(401).send(error)
        // }

        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).then(async (user) => {
            if (user) {
                if (user.username) {
                    link_code = user.username + ':' + code.toString();
                    let tokenBody = {
                        link_code,
                        account_id
                    }
                    var token = jwt.sign(tokenBody, process.env.INSTA_CHATBOT_LINK_KEY, {
                        expiresIn: '120s'
                    });

                    let updt = await Account.updateOne({ _id: user._id }, { $set: { instaBotToken: token } })
                    console.log(updt);
                    let ciphertext = await encryption({
                        status: true,
                        link_code
                    })
                    res.status(200).send(ciphertext)
                } else {
                    let error = await encryption({
                        status: false,
                        message: "Username not found"
                    })
                    res.status(500).send(error)
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found"
                })
                res.status(500).send(error)
            }
        }).catch(async (err) => {

        })
    } catch (err) {
        res.status(500).send({
            message: "Internal server error!",
            status: "500",
            err
        })
    }
}

module.exports.getTelegramChatbotLinkCode = async (req, res) => {
    try {
        let code = Math.floor(1000 + Math.random() * 9000);
        let account_id = req.params.account_id;
        // if (req.user._id != account_id) {
        //     let error = await encryption({
        //         message: "Unauthorized user.",
        //         status: false,
        //     })
        //     return res.status(401).send(error)
        // }

        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).then(async (user) => {
            if (user) {
                if (user.username) {
                    link_code = user.username + ':' + code.toString();
                    let tokenBody = {
                        link_code,
                        account_id
                    }
                    var token = jwt.sign(tokenBody, process.env.TELEGRAM_CHATBOT_LINK_KEY, {
                        expiresIn: '120s'
                    });

                    let updt = await Account.updateOne({ _id: user._id }, { $set: { telegramBotToken: token } })
                    console.log(updt);
                    let ciphertext = await encryption({
                        status: true,
                        link_code
                    })
                    res.status(200).send(ciphertext)
                } else {
                    let error = await encryption({
                        status: false,
                        message: "Username not found"
                    })
                    res.status(500).send(error)
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found"
                })
                res.status(500).send(error)
            }
        }).catch(async (err) => {

        })
    } catch (err) {
        res.status(500).send({
            message: "Internal server error!",
            status: "500",
            err
        })
    }
}

module.exports.verifyCode = async (req, res) => {
    try {
        var token = req.body.token;
        if (token) {
            jwt.verify(token, 'secretOfTheAFOVerificationEmail', function (err, token_data) {
                if (err) {
                    res.status(403).send({ success: false });
                } else {
                    let obj = token_data;
                    if (req.body.code == token_data.code && req.body.email == token_data.email) {
                        res.status(200).send({ success: true });
                    } else {
                        res.status(403).send({ success: false });
                    }
                }
            });
        } else {
            res.status(403).send({ error: 'No token' });
        }
    } catch (err) {
        res.status(500).send({
            message: "Internal server error!",
            status: "500",
            err
        })
    }
}

// async function updateDuplicateEmailsAndPhones(email) {
//     try {
//         // Find all users with the specified email
//         const users = await Account.find({ email: "selle403@gmail.com" }).sort({ createdAt: 1 }); // Sort by creation date to get the oldest one first

//         if (users.length <= 1) {
//             console.log("No duplicates found, only one user with this email.");
//             return;
//         }

//         // Skip the first entry (keep it unchanged), start updating from the second entry
//         for (let i = 1; i < users.length; i++) {
//             const user = users[i];
//             const duplicateIndex = i; // Start with 1 for first duplicate

//             // Update email with `duplicate_1`, `duplicate_2`, etc.
//             const emailParts = user.email.split('@');
//             const updatedEmail = `${emailParts[0]}_duplicate_${duplicateIndex}@${emailParts[1]}`;

//             // Update phone number by appending `0001`, `0002`, etc.
//             const updatedPhone = `${user.phone}000${duplicateIndex}`;

//             // Perform the update
//             await Account.updateOne(
//                 { _id: user._id },
//                 {
//                     $set: {
//                         email: updatedEmail,
//                         phone: updatedPhone,
//                     },
//                 }
//             );

//             console.log(`Updated user ${user._id}: ${updatedEmail}, ${updatedPhone}`);
//         }

//         console.log("Duplicate entries updated successfully.");
//     } catch (error) {
//         console.error("Error updating duplicates:", error);
//     }
// }

// // Example usage
// updateDuplicateEmailsAndPhones('selle403@gmail.com');

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    console.log(file.mimetype.split("/"))
    if (file.mimetype.split("/")[0] === "image") {
        cb(null, true);
    }
    // else if (file.mimetype.split("/")[0] === "video") {
    //     cb(null, true);
    // } 
    // else if (file.mimetype.split("/")[0] === "application") {
    //     cb(null, true);
    // }
    //  else if (file.mimetype.split("/")[1] === "document") {
    //     cb(null, true);
    // }
    // else if (file.mimetype.split("/")[1] === "xlxs" || file.mimetype.split("/")[1] === "csv") {
    //     cb(null, true);
    // }
    else {
        cb(null, false);
    }
};

module.exports.uploadImageCheck = multer({
    storage,
    fileFilter,
    limits: { fileSize: 1073741824 } // 1024 MB in bytes
});

module.exports.profileImageUploadByToken = async (req, res) => {
    try {
        if (!req.file || req.file <= 0) {
            let error = await encryption({
                status: false,
                message: "Please provide a image."
            });
            res.status(400).send(error);
        } else {
            const otpTokenKey = 'thisisforotponly'
            jwt.verify(req.params.token, otpTokenKey, async function (err, payload) {
                if (err) {
                    let error = await encryption({
                        status: false,
                        message: "Verification failed!"
                    })
                    return res.status(403).send(error)
                }

                Account.findById(payload.account_id).then(async (userAccountFound) => {
                    if (!userAccountFound) {
                        let error = await encryption({
                            status: false,
                            message: "User not found."
                        });
                        res.status(404).send(error);
                    } else {
                        const data = req.file;
                        if (userAccountFound?.profileImage?.key) {
                            // console.log(1)
                            const bucketName = process.env.AWS_BUCKET_NAME;
                            await s3.deleteObject({ Bucket: bucketName, Key: userAccountFound.profileImage.key }).promise();
                            let createDeleteObj = {
                                key: '',
                                url: '',
                                ETag: '',
                            }
                            Account.findByIdAndUpdate(userAccountFound._id, { profileImage: createDeleteObj }).then(async accountUpdateAfterdeleted => {
                                if (accountUpdateAfterdeleted) {
                                    if (data.mimetype.split("/")[0] === "image") {
                                        const bucketName = process.env.AWS_BUCKET_NAME;
                                        const params = {
                                            Bucket: bucketName,
                                            Key: `profile_images/${userAccountFound._id}/${data.originalname}`,
                                            Body: data.buffer
                                        };
                                        s3.upload(params, async (err, data) => {
                                            if (err) {
                                                console.error('Error uploading file:', err);
                                                let error = await encryption({
                                                    status: false,
                                                    message: "Something went wrong while uploading image."
                                                });
                                                res.status(400).send(error);
                                            } else {
                                                console.log('File uploaded successfully. File URL:', data);
                                                if (data?.key) {
                                                    const createObj = {
                                                        key: data?.key,
                                                        url: data?.Location,
                                                        ETag: data?.ETag,
                                                    };
                                                    Account.findByIdAndUpdate(userAccountFound._id, { profileImage: createObj }).then(async (userUpdated) => {
                                                        if (userUpdated) {
                                                            let data = await encryption({
                                                                status: true,
                                                                message: "profile image uplaoded successfully."
                                                            });
                                                            res.status(200).send(data);
                                                        } else {
                                                            let error = await encryption({
                                                                status: false,
                                                                message: "Something went wrong while updating user."
                                                            });
                                                            res.status(400).send(error);
                                                        }
                                                    }).catch(async (err) => {
                                                        console.log(err);
                                                        let error = await encryption({
                                                            status: false,
                                                            message: "Something went wrong while updating user."
                                                        });
                                                        res.status(400).send(error);
                                                    });
                                                } else {
                                                    console.log(s3UploadResult);
                                                    let error = await encryption({
                                                        status: false,
                                                        message: "Something went wrong while uploading profile image user."
                                                    });
                                                    res.status(400).send(error);
                                                }
                                            }
                                        });
                                    } else {
                                        let error = await encryption({
                                            status: false,
                                            message: "Please provide a image not other type documents."
                                        });
                                        res.status(400).send(error);
                                    }
                                } else {
                                    let error = await encryption({
                                        status: false,
                                        message: "Something went wrong while deleting previous profile Image."
                                    });
                                    res.status(500).send(error);
                                }
                            }).catch(async err => {
                                console.log(err);
                                let error = await encryption({
                                    status: false,
                                    message: "Something went wrong while deleting previous profile Image."
                                });
                                res.status(500).send(error);
                            })
                        } else {
                            console.log(2)
                            if (data.mimetype.split("/")[0] === "image") {
                                const bucketName = process.env.AWS_BUCKET_NAME;
                                const params = {
                                    Bucket: bucketName,
                                    Key: `profile_images/${userAccountFound._id}/${data.originalname}`,
                                    Body: data.buffer
                                };
                                s3.upload(params, async (err, data) => {
                                    if (err) {
                                        console.error('Error uploading file:', err);
                                        let error = await encryption({
                                            status: false,
                                            message: "Something went wrong while uploading image."
                                        });
                                        res.status(400).send(error);
                                    } else {
                                        console.log('File uploaded successfully. File URL:', data);
                                        if (data?.key) {
                                            const createObj = {
                                                key: data?.key,
                                                url: data?.Location,
                                                ETag: data?.ETag,
                                            };
                                            Account.findByIdAndUpdate(userAccountFound._id, { profileImage: createObj }).then(async (userUpdated) => {
                                                if (userUpdated) {
                                                    let data = await encryption({
                                                        status: true,
                                                        message: "profile image uplaoded successfully."
                                                    });
                                                    res.status(200).send(data);
                                                } else {
                                                    let error = await encryption({
                                                        status: false,
                                                        message: "Something went wrong while updating user."
                                                    });
                                                    res.status(400).send(error);
                                                }
                                            }).catch(async (err) => {
                                                console.log(err);
                                                let error = await encryption({
                                                    status: false,
                                                    message: "Something went wrong while updating user."
                                                });
                                                res.status(400).send(error);
                                            });
                                        } else {
                                            console.log(s3UploadResult);
                                            let error = await encryption({
                                                status: false,
                                                message: "Something went wrong while uploading profile image user."
                                            });
                                            res.status(400).send(error);
                                        }
                                    }
                                });
                            } else {
                                let error = await encryption({
                                    status: false,
                                    message: "Please provide a image not other type documents."
                                });
                                res.status(400).send(error);
                            }
                        }
                    }
                }).catch(async (err) => {
                    console.log(err);
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while finding user."
                    });
                    res.status(500).send(error);
                });
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


module.exports.profileImageUploader = async (req, res) => {
    try {
        if (!req.file || req.file <= 0) {
            let error = await encryption({
                status: false,
                message: "Please provide a image."
            });
            res.status(400).send(error);
        } else {
            Account.findById(req.params.accountId).then(async (userAccountFound) => {
                if (!userAccountFound) {
                    let error = await encryption({
                        status: false,
                        message: "User not found."
                    });
                    res.status(404).send(error);
                } else {
                    const data = req.file;
                    if (userAccountFound?.profileImage?.key) {
                        // console.log(1)
                        const bucketName = process.env.AWS_BUCKET_NAME;
                        await s3.deleteObject({ Bucket: bucketName, Key: userAccountFound.profileImage.key }).promise();
                        let createDeleteObj = {
                            key: '',
                            url: '',
                            ETag: '',
                        }
                        Account.findByIdAndUpdate(userAccountFound._id, { profileImage: createDeleteObj }).then(async accountUpdateAfterdeleted => {
                            if (accountUpdateAfterdeleted) {
                                if (data.mimetype.split("/")[0] === "image") {
                                    const bucketName = process.env.AWS_BUCKET_NAME;
                                    const params = {
                                        Bucket: bucketName,
                                        Key: `profile_images/${userAccountFound._id}/${data.originalname}`,
                                        Body: data.buffer
                                    };
                                    s3.upload(params, async (err, data) => {
                                        if (err) {
                                            console.error('Error uploading file:', err);
                                            let error = await encryption({
                                                status: false,
                                                message: "Something went wrong while uploading image."
                                            });
                                            res.status(400).send(error);
                                        } else {
                                            console.log('File uploaded successfully. File URL:', data);
                                            if (data?.key) {
                                                const createObj = {
                                                    key: data?.key,
                                                    url: data?.Location,
                                                    ETag: data?.ETag,
                                                };
                                                Account.findByIdAndUpdate(userAccountFound._id, { profileImage: createObj }).then(async (userUpdated) => {
                                                    if (userUpdated) {
                                                        let data = await encryption({
                                                            status: true,
                                                            message: "profile image uplaoded successfully."
                                                        });
                                                        res.status(200).send(data);
                                                    } else {
                                                        let error = await encryption({
                                                            status: false,
                                                            message: "Something went wrong while updating user."
                                                        });
                                                        res.status(400).send(error);
                                                    }
                                                }).catch(async (err) => {
                                                    console.log(err);
                                                    let error = await encryption({
                                                        status: false,
                                                        message: "Something went wrong while updating user."
                                                    });
                                                    res.status(400).send(error);
                                                });
                                            } else {
                                                console.log(s3UploadResult);
                                                let error = await encryption({
                                                    status: false,
                                                    message: "Something went wrong while uploading profile image user."
                                                });
                                                res.status(400).send(error);
                                            }
                                        }
                                    });
                                } else {
                                    let error = await encryption({
                                        status: false,
                                        message: "Please provide a image not other type documents."
                                    });
                                    res.status(400).send(error);
                                }
                            } else {
                                let error = await encryption({
                                    status: false,
                                    message: "Something went wrong while deleting previous profile Image."
                                });
                                res.status(500).send(error);
                            }
                        }).catch(async err => {
                            console.log(err);
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while deleting previous profile Image."
                            });
                            res.status(500).send(error);
                        })
                    } else {
                        console.log(2)
                        if (data.mimetype.split("/")[0] === "image") {
                            const bucketName = process.env.AWS_BUCKET_NAME;
                            const params = {
                                Bucket: bucketName,
                                Key: `profile_images/${userAccountFound._id}/${data.originalname}`,
                                Body: data.buffer
                            };
                            s3.upload(params, async (err, data) => {
                                if (err) {
                                    console.error('Error uploading file:', err);
                                    let error = await encryption({
                                        status: false,
                                        message: "Something went wrong while uploading image."
                                    });
                                    res.status(400).send(error);
                                } else {
                                    console.log('File uploaded successfully. File URL:', data);
                                    if (data?.key) {
                                        const createObj = {
                                            key: data?.key,
                                            url: data?.Location,
                                            ETag: data?.ETag,
                                        };
                                        Account.findByIdAndUpdate(userAccountFound._id, { profileImage: createObj }).then(async (userUpdated) => {
                                            if (userUpdated) {
                                                let data = await encryption({
                                                    status: true,
                                                    message: "profile image uplaoded successfully."
                                                });
                                                res.status(200).send(data);
                                            } else {
                                                let error = await encryption({
                                                    status: false,
                                                    message: "Something went wrong while updating user."
                                                });
                                                res.status(400).send(error);
                                            }
                                        }).catch(async (err) => {
                                            console.log(err);
                                            let error = await encryption({
                                                status: false,
                                                message: "Something went wrong while updating user."
                                            });
                                            res.status(400).send(error);
                                        });
                                    } else {
                                        console.log(s3UploadResult);
                                        let error = await encryption({
                                            status: false,
                                            message: "Something went wrong while uploading profile image user."
                                        });
                                        res.status(400).send(error);
                                    }
                                }
                            });
                        } else {
                            let error = await encryption({
                                status: false,
                                message: "Please provide a image not other type documents."
                            });
                            res.status(400).send(error);
                        }
                    }
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while finding user."
                });
                res.status(500).send(error);
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
}

module.exports.coverImageUploader = async (req, res) => {
    try {
        if (!req.file || req.file <= 0) {
            let error = await encryption({
                status: false,
                message: "Please provide a image."
            });
            return res.status(400).send(error);
        } else {
            Account.findById(req.params.accountId).then(async (userAccountFound) => {
                if (!userAccountFound) {
                    let error = await encryption({
                        status: false,
                        message: "User not found."
                    });
                    return res.status(404).send(error);
                } else {
                    const data = req.file;
                    if (userAccountFound?.coverImage?.key) {
                        console.log(1)
                        const bucketName = process.env.AWS_BUCKET_NAME;
                        await s3.deleteObject({ Bucket: bucketName, Key: userAccountFound.coverImage.key }).promise();
                        let createDeleteObj = {
                            key: '',
                            url: '',
                            ETag: '',
                        }
                        Account.findByIdAndUpdate(userAccountFound._id, { coverImage: createDeleteObj }).then(async accountUpdateAfterdeleted => {
                            if (accountUpdateAfterdeleted) {
                                if (data.mimetype.split("/")[0] === "image") {
                                    const bucketName = process.env.AWS_BUCKET_NAME;
                                    const params = {
                                        Bucket: bucketName,
                                        Key: `cover_images/${userAccountFound._id}/${data.originalname}`,
                                        Body: data.buffer
                                    };
                                    s3.upload(params, async (err, data) => {
                                        if (err) {
                                            console.error('Error uploading file:', err);
                                            let error = await encryption({
                                                status: false,
                                                message: "Something went wrong while uploading image."
                                            });
                                            res.status(400).send(error);
                                        } else {
                                            console.log('File uploaded successfully. File URL:', data);
                                            if (data?.key) {
                                                const createObj = {
                                                    key: data?.key,
                                                    url: data?.Location,
                                                    ETag: data?.ETag,
                                                };
                                                Account.findByIdAndUpdate(userAccountFound._id, { coverImage: createObj }).then(async (userUpdated) => {
                                                    if (userUpdated) {
                                                        let data = await encryption({
                                                            status: true,
                                                            message: "cover image uplaoded successfully."
                                                        });
                                                        res.status(200).send(data);
                                                    } else {
                                                        let error = await encryption({
                                                            status: false,
                                                            message: "Something went wrong while updating user."
                                                        });
                                                        res.status(400).send(error);
                                                    }
                                                }).catch(async (err) => {
                                                    console.log(err);
                                                    let error = await encryption({
                                                        status: false,
                                                        message: "Something went wrong while updating user."
                                                    });
                                                    res.status(400).send(error);
                                                });
                                            } else {
                                                console.log(s3UploadResult);
                                                let error = await encryption({
                                                    status: false,
                                                    message: "Something went wrong while uploading cover image user."
                                                });
                                                res.status(400).send(error);
                                            }
                                        }
                                    });
                                } else {
                                    let error = await encryption({
                                        status: false,
                                        message: "Please provide a image not other type documents."
                                    });
                                    res.status(400).send(error);
                                }
                            } else {
                                let error = await encryption({
                                    status: false,
                                    message: "Something went wrong while deleting previous cover Image."
                                });
                                res.status(500).send(error);
                            }
                        }).catch(async err => {
                            console.log(err);
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while deleting previous cover Image."
                            });
                            res.status(500).send(error);
                        })
                    } else {
                        console.log(2)
                        if (data.mimetype.split("/")[0] === "image") {
                            const bucketName = process.env.AWS_BUCKET_NAME;
                            const params = {
                                Bucket: bucketName,
                                Key: `cover_images/${userAccountFound._id}/${data.originalname}`,
                                Body: data.buffer
                            };
                            s3.upload(params, async (err, data) => {
                                if (err) {
                                    console.error('Error uploading file:', err);
                                    let error = await encryption({
                                        status: false,
                                        message: "Something went wrong while uploading image."
                                    });
                                    res.status(400).send(error);
                                } else {
                                    console.log('File uploaded successfully. File URL:', data);
                                    if (data?.key) {
                                        const createObj = {
                                            key: data?.key,
                                            url: data?.Location,
                                            ETag: data?.ETag,
                                        };
                                        Account.findByIdAndUpdate(userAccountFound._id, { coverImage: createObj }).then(async (userUpdated) => {
                                            if (userUpdated) {
                                                let data = await encryption({
                                                    status: true,
                                                    message: "cover image uplaoded successfully."
                                                });
                                                res.status(200).send(data);
                                            } else {
                                                let error = await encryption({
                                                    status: false,
                                                    message: "Something went wrong while updating user."
                                                });
                                                res.status(400).send(error);
                                            }
                                        }).catch(async (err) => {
                                            console.log(err);
                                            let error = await encryption({
                                                status: false,
                                                message: "Something went wrong while updating user."
                                            });
                                            res.status(400).send(error);
                                        });
                                    } else {
                                        console.log(s3UploadResult);
                                        let error = await encryption({
                                            status: false,
                                            message: "Something went wrong while uploading cover image user."
                                        });
                                        res.status(400).send(error);
                                    }
                                }
                            });
                        } else {
                            let error = await encryption({
                                status: false,
                                message: "Please provide a image not other type documents."
                            });
                            res.status(400).send(error);
                        }
                    }
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while finding user."
                });
                res.status(500).send(error);
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
}

module.exports.deleteProfileImage = async (req, res) => {
    try {
        const { accountId } = req.params;
        if (!accountId) {
            let error = await encryption({
                status: false,
                message: "Something is missing."
            });
            res.status(400).send(error);
        } else {
            Account.findById(accountId).then(async (userAccountFound) => {
                if (userAccountFound?.profileImage?.key) {
                    const bucketName = process.env.AWS_BUCKET_NAME;
                    await s3.deleteObject({ Bucket: bucketName, Key: userAccountFound.profileImage.key }).promise();
                    let createDeleteObj = {
                        key: '',
                        url: '',
                        ETag: '',
                    }
                    Account.findByIdAndUpdate(userAccountFound._id, { profileImage: createDeleteObj }).then(async (userUpdated) => {
                        if (userUpdated) {
                            let error = await encryption({
                                status: true,
                                message: "Successfully deleted."
                            });
                            res.status(200).send(error);
                        } else {
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while updating user."
                            });
                            res.status(400).send(error);
                        }
                    }).catch(async (err) => {
                        console.log(err);
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while updating user."
                        });
                        res.status(400).send(error);
                    });
                } else {
                    let error = await encryption({
                        status: false,
                        message: "you don't have profile picture."
                    });
                    res.status(400).send(error);
                }
            }).catch(async (err) => {
                console.log(err)
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while finding user."
                });
                res.status(400).send(error);
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
}

module.exports.deleteCoverImage = async (req, res) => {
    try {
        const { accountId } = req.params;
        if (!accountId) {
            let error = await encryption({
                status: false,
                message: "Something is missing."
            });
            res.status(400).send(error);
        } else {
            Account.findById(accountId).then(async (userAccountFound) => {
                if (userAccountFound?.coverImage?.key) {
                    const bucketName = process.env.AWS_BUCKET_NAME;
                    await s3.deleteObject({ Bucket: bucketName, Key: userAccountFound.coverImage.key }).promise();
                    let createDeleteObj = {
                        key: '',
                        url: '',
                        ETag: '',
                    }
                    Account.findByIdAndUpdate(userAccountFound._id, { coverImage: createDeleteObj }).then(async (userUpdated) => {
                        if (userUpdated) {
                            let error = await encryption({
                                status: true,
                                message: "Cover image successfully deleted."
                            });
                            res.status(200).send(error);
                        } else {
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while updating user."
                            });
                            res.status(400).send(error);
                        }
                    }).catch(async (err) => {
                        console.log(err);
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while updating user."
                        });
                        res.status(400).send(error);
                    });
                } else {
                    let error = await encryption({
                        status: false,
                        message: "you don't have cover picture."
                    });
                    res.status(400).send(error);
                }
            }).catch(async (err) => {
                console.log(err)
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while finding user."
                });
                res.status(400).send(error);
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
}

module.exports.uploadDocumentsCheck = multer({
    storage,
    limits: { fileSize: 20000000 },
});
module.exports.uploadDocuments = async (req, res) => {
    try {
        const { accountId } = req.params;
        const description = req.body.description;
        const title = req.body.title;
        const file_type = req.body.file_type;
        console.log(accountId, description, title, file_type)
        if (!accountId || !file_type || !title || !description) {
            let error = await encryption({
                status: false,
                message: "Something is missing."
            });
            return res.status(400).send(error);
        } else {
            Account.findById(accountId).then(async (userAccountFound) => {
                if (!userAccountFound) {
                    let error = await encryption({
                        status: false,
                        message: "User not found."
                    });
                    return res.status(404).send(error);
                } else {
                    if (!req.file || req.file <= 0) {
                        let error = await encryption({
                            status: false,
                            message: "Please provide a document"
                        });
                        return res.status(400).send(error);
                    } else {
                        const data = req.file;
                        Document.find({ account: accountId }).then(async documentFound => {

                            let fileName = data.originalname;
                            const fileExtension = path.extname(fileName);
                            const baseName = path.basename(fileName, fileExtension);
                            let finalFileName = fileName;

                            // Check if a file with the same name or numbered name already exists
                            let counter = 1;
                            let fileExists = documentFound.some(obj => obj.document_details.key?.includes(fileName));

                            while (fileExists) {
                                finalFileName = `${baseName}_${counter}${fileExtension}`; // Append _1, _2, etc. before the extension
                                fileExists = documentFound.some(obj => obj.document_details.key?.includes(finalFileName));
                                counter++; // Increment counter for the next attempt
                            }

                            if (documentFound.length > 20) {
                                let error = await encryption({
                                    status: false,
                                    message: "Your 20 files limit is exceeded."
                                });
                                return res.status(400).send(error);
                            } else {
                                const bucketName = process.env.AWS_BUCKET_NAME;
                                const params = {
                                    Bucket: bucketName,
                                    Key: `portfolios/${userAccountFound.username}/${finalFileName}`, // Use the updated unique file name
                                    Body: data.buffer
                                };

                                s3.upload(params, async (err, resOfS3) => {
                                    if (err) {
                                        console.error('Error uploading file:', err);
                                        let error = await encryption({
                                            status: false,
                                            message: "Something went wrong while uploading the file."
                                        });
                                        return res.status(400).send(error);
                                    } else {
                                        console.log('File uploaded successfully. File URL:', resOfS3);
                                        if (resOfS3?.key) {
                                            const createObj = {
                                                key: resOfS3?.key,
                                                url: resOfS3?.Location,
                                                ETag: resOfS3?.ETag,
                                            };
                                            Document.create({
                                                account: userAccountFound._id,
                                                description: description,
                                                document_details: createObj,
                                                file_type: file_type,
                                                title: title
                                            }).then(async (createDocument) => {
                                                if (createDocument) {
                                                    let success = await encryption({
                                                        status: true,
                                                        message: "Document uploaded successfully."
                                                    });
                                                    return res.status(200).send(success);
                                                } else {
                                                    let error = await encryption({
                                                        status: false,
                                                        message: "Something went wrong while creating the document."
                                                    });
                                                    return res.status(400).send(error);
                                                }
                                            }).catch(async (err) => {
                                                console.log(err);
                                                let error = await encryption({
                                                    status: false,
                                                    message: "Something went wrong while creating the document."
                                                });
                                                return res.status(400).send(error);
                                            });
                                        } else {
                                            console.log(resOfS3);
                                            let error = await encryption({
                                                status: false,
                                                message: "Something went wrong while uploading the document."
                                            });
                                            return res.status(400).send(error);
                                        }
                                    }
                                })
                            }
                        }).catch(async err => {
                            console.log(err)
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while finding documents."
                            });
                            return res.status(400).send(error);
                        })
                    }
                }
            }).catch(async (err) => {
                console.log(err);
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
        return res.status(500).send(error);
    }
}

module.exports.deleteDocumentsFromPortfolio = async (req, res) => {
    try {
        const { documentId } = req.params;
        if (!documentId) {
            let error = await encryption({
                status: false,
                message: "required fields are empty."
            });
            return res.status(400).send(error);
        }
        Document.findById(documentId).then(async (documentFound) => {
            if (!documentFound) {
                let error = await encryption({
                    status: false,
                    message: "Document not found."
                });
                return res.status(404).send(error);
            }
            const fileType = documentFound.file_type;
            const bucketName = process.env.AWS_BUCKET_NAME;

            if (fileType.includes('audio') || fileType.includes('video')) {
                // Delete from JW Player
                const siteId = process.env.JW_SITE_ID;
                const mediaId = documentFound.jw_media.mediaId;
                const jwPlayerApiKey = process.env.JW_API_KEY;

                const jwPlayerUrl = `https://api.jwplayer.com/v2/sites/${siteId}/media/${mediaId}/`;

                try {
                    await axios.delete(jwPlayerUrl, {
                        headers: {
                            Authorization: `Bearer ${jwPlayerApiKey}`
                        }
                    });

                    await Document.findByIdAndDelete(documentFound._id);

                    let success = await encryption({
                        status: true,
                        message: "Deleted successfully from JW Player."
                    });
                    return res.status(200).send(success);
                } catch (err) {
                    console.error("Error deleting from JW Player: ", err);
                    let error = await encryption({
                        status: false,
                        message: "Failed to delete from JW Player."
                    });
                    return res.status(400).send(error);
                }

            } else {
                // Delete from S3 for other file types
                try {
                    await s3.deleteObject({ Bucket: bucketName, Key: documentFound.document_details.key }).promise();

                    await Document.findByIdAndDelete(documentFound._id);

                    let success = await encryption({
                        status: true,
                        message: "Deleted successfully from S3."
                    });
                    return res.status(200).send(success);
                } catch (err) {
                    console.error("Error deleting from S3: ", err);
                    let error = await encryption({
                        status: false,
                        message: "Failed to delete from S3."
                    });
                    return res.status(400).send(error);
                }
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while finding documents."
            });
            res.status(400).send(error);
        });

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error."
        });
        return res.status(500).send(error);
    }
}

module.exports.getAllDocuments = async (req, res) => {
    try {
        const { accountId } = req.params;
        if (!accountId) {
            let error = await encryption({
                status: false,
                message: "required fields are empty."
            });
            res.status(400).send(error);
        } else {
            Document.find({ account: accountId }).then(async (result) => {
                if (!result || result.length <= 0) {
                    let error = await encryption({
                        status: false,
                        message: "You don't have documents."
                    });
                    res.status(400).send(error);
                } else {
                    let error = await encryption({
                        status: true,
                        message: "Documents Found.",
                        result
                    });
                    res.status(200).send(error);
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while finding documents."
                });
                res.status(400).send(error);
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
}

module.exports.getSpecificDocumentDetails = async (req, res) => {
    try {
        const { documentId } = req.params;
        if (!documentId) {
            let error = await encryption({
                status: false,
                message: "Something is missing."
            });
            res.status(400).send(error);
        } else {
            Document.findById(documentId).then(async (documentFound) => {
                if (!documentFound) {
                    let error = await encryption({
                        status: false,
                        message: "Documnet not found."
                    });
                    res.status(404).send(error);
                } else {
                    let error = await encryption({
                        status: true,
                        message: "Documnet Found.",
                        document: documentFound
                    });
                    res.status(200).send(error);
                }
            }).catch(async (err) => {
                console.log(err)
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while finding document."
                });
                res.status(400).send(error);
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
}

module.exports.updateSpecificDocument = async (req, res) => {
    try {
        const { documentId } = req.params;
        const description = req.body.description;
        const title = req.body.title;
        // const file_type = documnetFound?.file_type;
        if (!documentId || !description || !title) {
            let error = await encryption({
                status: false,
                message: "Something is missing."
            });
            res.status(400).send(error);
        } else {
            Document.findById(documentId).then(async (documnetFound) => {
                if (!documnetFound) {
                    let error = await encryption({
                        status: false,
                        message: "Document not found."
                    });
                    res.status(404).send(error);
                } else {
                    const bucketName = process.env.AWS_BUCKET_NAME;
                    let updateQuery = {};
                    updateQuery['description'] = description;
                    updateQuery['title'] = title;
                    if (!req.file || req.file <= 0) {
                        const file_type = documnetFound?.file_type;
                        updateQuery['file_type'] = file_type;
                        updateQuery['document_details'] = documnetFound?.document_details;
                        Document.findByIdAndUpdate(documnetFound._id, updateQuery, { new: true }).then(async (documentUpaded) => {
                            let error = await encryption({
                                status: true,
                                message: "Document update successfully.",
                                documentUpaded
                            });
                            res.status(200).send(error);
                        }).catch(async (err) => {
                            console.log(err)
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while updating document."
                            });
                            res.status(400).send(error);
                        });
                    } else {
                        const data = req.file;
                        Document.find({ account: documnetFound.account }).then(async (documentsFound) => {
                            const findFileAlreadyExist = await documentsFound.filter(obj => obj.document_details.key.includes(data.originalname))
                            console.log(findFileAlreadyExist, "check")
                            if (findFileAlreadyExist.length > 0) {
                                let error = await encryption({
                                    status: false,
                                    message: "This file already exist."
                                });
                                res.status(400).send(error);
                            } else {
                                await s3.deleteObject({ Bucket: bucketName, Key: documnetFound.document_details.key }).promise();
                                const params = {
                                    Bucket: bucketName,
                                    Key: `portfolios/${documnetFound.account}/${data.originalname}`,
                                    Body: data.buffer
                                };
                                s3.upload(params, async (err, resOfS3) => {
                                    if (err) {
                                        console.error('Error uploading file:', err);
                                        let error = await encryption({
                                            status: false,
                                            message: "Something went wrong while uploading image."
                                        });
                                        res.status(400).send(error);
                                    } else {
                                        console.log('File uploaded successfully. File URL:', resOfS3);
                                        if (resOfS3?.key) {
                                            const createObj = {
                                                key: resOfS3?.key,
                                                url: resOfS3?.Location,
                                                ETag: resOfS3?.ETag,
                                            };
                                            updateQuery['document_details'] = createObj;
                                            updateQuery['file_type'] = req.body.file_type;//data.mimetype.split("/")[1];
                                            Document.findByIdAndUpdate(documnetFound._id, updateQuery, { new: true }).then(async (createDocument) => {
                                                if (createDocument) {
                                                    let error = await encryption({
                                                        status: true,
                                                        message: "Document uploaded."
                                                    });
                                                    res.status(200).send(error);
                                                } else {
                                                    let error = await encryption({
                                                        status: false,
                                                        message: "Something went wrong while creating documents."
                                                    });
                                                    res.status(400).send(error);
                                                }
                                            }).catch(async (err) => {
                                                console.log(err)
                                                let error = await encryption({
                                                    status: false,
                                                    message: "Something went wrong while creating documents."
                                                });
                                                res.status(400).send(error);
                                            });
                                        } else {
                                            console.log(resOfS3);
                                            let error = await encryption({
                                                status: false,
                                                message: "Something went wrong while uploading documents."
                                            });
                                            res.status(400).send(error);
                                        }
                                    }
                                })
                            }
                        }).catch(async (err) => {
                            console.log(err);
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while finding previous Documents."
                            });
                            res.status(400).send(error);
                        });
                    }
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while finding document."
                });
                res.status(400).send(error);
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
}

module.exports.deleteAccount = async (req, res) => {
    try {
        const account_id = req.params.account_id

        Account.findOneAndUpdate({ _id: account_id, active: true }, { $set: { deletedAt: Date.now() } }, { new: true }).then(async (account) => {
            if (!account) {
                let error = await encryption({
                    status: false,
                    message: "Account not found!"
                });
                res.status(404).send(error);
            } else {
                let ciphertext = await encryption({
                    status: false,
                    message: "Account deleted successfully",
                    account
                });
                res.status(200).send(ciphertext);
            }
        }).catch(async (err) => {
            console.log(err)
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting the account details"
            });
            res.status(500).send(error);
        })

    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error."
        });
        res.status(500).send(error);
    }
}

module.exports.deleteAccountAdmin = async (req, res) => {
    try {
        const account_id = req.params.account_id

        Account.findOneAndUpdate({ _id: account_id, active: true }, { $set: { deleted: true } }, { new: true }).then(async (account) => {
            if (!account) {
                let error = await encryption({
                    status: false,
                    message: "Account not found or not active!"
                });
                res.status(404).send(error);
            } else {
                let ciphertext = await encryption({
                    status: false,
                    message: "Account deleted successfully",
                    account
                });
                res.status(200).send(ciphertext);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting the account details"
            });
            res.status(500).send(error);
        })

    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error."
        });
        res.status(500).send(error);
    }
}

const searchByAccount = async (query) => {
    const accounts = await Account.aggregate([
        {
            $match: {
                $and: [
                    // { active: true },
                    // { isEmailSearch: true, isPhoneSearch: true },

                    {
                        $or: [
                            { username: { $regex: new RegExp(`^${query}`, 'i') } },
                            { email: { $regex: new RegExp(`^${query}`, 'i') }, isEmailSearch: true },
                            { phone: { $regex: new RegExp(`^${query}`, 'i') }, isPhoneSearch: true },
                            { first_name: { $regex: new RegExp(`^${query}`, 'i') } },
                            { last_name: { $regex: new RegExp(`^${query}`, 'i') } },
                            { company_name: { $regex: new RegExp(`^${query}`, 'i') } },
                            { insta_username: { $regex: new RegExp(`^${query}`, 'i') } },
                        ]
                    }
                ]
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'user'
            }
        },
        {
            $lookup: {
                from: 'companies',
                localField: 'company',
                foreignField: '_id',
                as: 'company'
            }
        },
        {
            $unwind: {
                path: '$user',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $unwind: {
                path: '$company',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $match: {
                username: { $exists: true, $ne: null }
            }
        },
        {
            $project: {
                _id: 1,
                username: 1,
                email: 1,
                phone: 1,
                account_type: 1,
                first_name: '$user.first_name',
                last_name: '$user.last_name',
                company_name: '$company.company_name',
                country_name: 1,
                profileImage: '$profileImage.url',
                // 'profileImage.url': 1,
                about_me: 1,
            }
        }
    ]);

    return accounts;
};

// const searchByUser1 = async (query) => {
//     const users = await User.aggregate([
//         {
//             $match: {
//                 $and: [
//                     {
//                         $or: [
//                             { first_name: { $regex: new RegExp(`^${query}`, 'i') } },
//                             { last_name: { $regex: new RegExp(`^${query}`, 'i') } },
//                             {
//                                 $expr: {
//                                     $regexMatch: {
//                                         input: { $concat: ['$first_name', ' ', '$last_name'] },
//                                         regex: new RegExp(`^${query}`, 'i'),
//                                     }
//                                 }
//                             },
//                         ]
//                     },
//                     // { 'account.active': true }
//                 ]
//             }
//         },
//         {
//             $lookup: {
//                 from: 'accounts',
//                 localField: 'account',
//                 foreignField: '_id',
//                 as: 'account'
//             }
//         },
//         {
//             $unwind: '$account'
//         },
//         {
//             $match: {
//                 'account.username': { $exists: true, $ne: null }
//             }
//         },
//         {
//             $project: {
//                 _id: '$account._id',
//                 first_name: 1,
//                 last_name: 1,
//                 email: '$account.email',
//                 phone: '$account.phone',
//                 account_type: '$account.account_type',
//                 username: '$account.username',
//                 country_name: '$account.country_name',
//                 profileImage: '$account.profileImage.url',
//                 about_me: '$account.about_me',
//             }
//         }
//     ]);

//     return users;
// };


// const searchByCompany1 = async (query) => {
//     const companies = await Company.aggregate([
//         {
//             $match: {
//                 $and: [
//                     { company_name: { $regex: new RegExp(`^${query}`, 'i') } },
//                     // { 'account.active': true }
//                 ]
//             }
//         },
//         {
//             $lookup: {
//                 from: 'accounts',
//                 localField: 'account',
//                 foreignField: '_id',
//                 as: 'account'
//             }
//         },
//         {
//             $unwind: '$account'
//         },
//         {
//             $match: {
//                 'account.username': { $exists: true, $ne: null }
//             }
//         },
//         {
//             $project: {
//                 _id: '$account._id',
//                 company_name: 1,
//                 email: '$account.email',
//                 phone: '$account.phone',
//                 account_type: '$account.account_type',
//                 username: '$account.username',
//                 country_name: '$account.country_name',
//                 profileImage: '$account.profileImage.url',
//                 about_me: '$account.about_me',
//             }
//         }
//     ]);

//     return companies;
// };

module.exports.searchUsers = async (req, res) => {
    try {
        const query = req.params.query;

        if (!query) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        const contactInfoResults = await searchByAccount(query);

        const unique = await getDistinctObjects(contactInfoResults);

        let ciphertext = await encryption({
            status: true,
            message: "Users found successfully!",
            users: unique
        });
        res.status(200).send(ciphertext);
    } catch (err) {
        console.error("Error:", err);
        let error = await encryption({
            status: false,
            message: "Internal server error."
        });
        res.status(500).send(error);
    }
};

module.exports.setSearchUserChecks = async (req, res) => {
    const { email, phone, account_id } = await decryption(req.body.data);
    try {
        Account.findById(account_id).then(async (account) => {
            if (!account) {
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while getting account details"
                });
                return res.status(500).send(error);
            } else {
                account.isPhoneSearch = phone;
                account.isEmailSearch = email;

                await account.save()

                let ciphertext = await encryption({
                    status: true,
                    message: "Checks Updated!",
                    account
                });
                res.status(200).send(ciphertext);
            }
        }).catch(async (err) => {
            console.error("Error:", err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details"
            });
            res.status(500).send(error);

        })
    } catch (err) {
        console.error("Error:", err);
        let error = await encryption({
            status: false,
            message: "Internal server error."
        });
        res.status(500).send(error);
    }

}

module.exports.searchUsersAdmin = async (req, res) => {
    // let data = await decryption(req.body.data)
    // res.send(data)
    try {
        let { skip, limit, query } = req.params;

        if (skip < 1) { skip = 1 }
        if (limit > 100) {
            limit = 100;
        }
        skip = (skip - 1) * limit

        if (query) {
            const regexQuery = new RegExp(`^${query}`, 'i');
            Account.find({
                $or: [
                    { 'first_name': { $regex: regexQuery } },
                    { 'last_name': { $regex: regexQuery } },
                    { 'company_name': { $regex: regexQuery } },
                    { 'email': { $regex: regexQuery } },
                    { 'phone': { $regex: regexQuery } },
                    { 'country_name': { $regex: regexQuery } },
                    { 'username': { $regex: regexQuery } }
                ],
            }, { used_limits: false, external_limits: false }).populate(['user', 'company', {
                path: 'level',
                select: 'level_no'
            }]).skip(parseInt(skip)).limit(parseInt(limit)).then(async (userList) => {
                const totalUsers = await Account.countDocuments()
                let ciphertext = await encryption({
                    status: true,
                    message: "Users List",
                    userList: userList,
                    totalUsers
                });
                res.status(200).send(ciphertext);
            }).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while searching users!"
                });
                res.status(400).send(error);
            })

        } else {
            let userList = await Account.find({}, { used_limits: false, external_limits: false }).populate(['user', 'company', {
                path: 'level',
                select: 'level_no'
            }]).skip(parseInt(skip)).limit(parseInt(limit));

            const totalUsers = await Account.countDocuments()

            let ciphertext = await encryption({
                status: true,
                message: "Users List",
                userList: userList,
                totalUsers,

            });
            res.status(200).send(ciphertext);
        }

        // let userList = await Account.find().populate(['user', 'company'])

        // userList.map(async (ul) => {
        //     if (ul?.user?.first_name && ul?.user?.last_name) {
        //         console.log({ first_name: ul?.user?.first_name, last_name: ul?.user?.last_name });
        //         let a = await Account.updateOne({ _id: ul._id }, { $set: { first_name: ul.user.first_name, last_name: ul.user.last_name } })
        //     } else if (ul?.company?.company_name) {
        //         console.log({ company_name: ul?.company?.company_name });
        //         let a = await Account.updateOne({ _id: ul._id }, { $set: { company_name: ul.company.company_name } })
        //     }
        // })
        // const totalUsers = await Account.countDocuments();

        // if (!query || query.trim() === '') {
        //     const users = await Account.find()
        //         .skip(parseInt(skip))
        //         .limit(parseInt(limit))
        //         .populate({
        //             path: 'user',
        //         })
        //         .populate({
        //             path: 'company',
        //         })
        //         .sort({ createdAt: -1 });

        //     let ciphertext = await encryption({
        //         status: true,
        //         message: "Users found",
        //         users,
        //         totalUsers
        //     });
        //     return res.status(200).send(ciphertext);
        // }

        // const regexQuery = new RegExp(`^${query}`, 'i');

        // const searchCriteria = {
        //     // $and: [{
        //     $or: [
        //         { 'email': { $regex: regexQuery } },
        //         { 'phone': { $regex: regexQuery } },
        //         { 'country_name': { $regex: regexQuery } },
        //         { 'username': { $regex: regexQuery } },
        //         // { user: { $ne: null } },
        //         // { company: { $exists: true, $ne: null } }
        //         // { 'user.first_name': { $regex: regexQuery } },
        //         // { 'user.last_name': { $regex: regexQuery } },
        //         // { 'company.company_name': { $regex: regexQuery } }
        //     ],
        //     user: {
        //         $exists: true,  // Ensure that the 'user' field exists
        //         $ne: null,      // Ensure that the 'user' field is not null
        //     },
        //     // },
        //     // {
        //     //     $or: [
        //     //         { user: { $ne: null } },
        //     //         { company: { $ne: null } }
        //     //     ]
        //     // }
        //     // ]
        // };

        // const users = await Account.find(searchCriteria, { user: true, company: true, country_name: true, username: true, email: true })
        //     // .sort({ createdAt: -1 })
        //     .populate({
        //         path: 'user',
        //         match: {
        //             $or: [
        //                 { 'first_name': { $regex: regexQuery } },
        //                 { 'last_name': { $regex: regexQuery } }
        //             ]
        //         }
        //     })
        //     .populate({
        //         path: 'company',
        //         match: {
        //             'company_name': { $regex: regexQuery }
        //         }
        //     })
        //     .skip(parseInt(skip))
        //     .limit(parseInt(limit))
        //     // const users = await Account.aggregate([
        //     //     {
        //     //         $lookup: {
        //     //             from: "user",          // name of the foreign collection
        //     //             localField: "user",   // field from the input documents
        //     //             foreignField: "_id",    // field from the foreign collection
        //     //             as: "user"              // output array field
        //     //         }
        //     //     },
        //     //     // {
        //     //     //     $unwind: "$user"  // unwind the array (optional, depends on your use case)
        //     //     // },
        //     //     {
        //     //         $project: {
        //     //             "email": { $regex: regexQuery },
        //     //             "phone": { $regex: regexQuery },
        //     //             "country_name": { $regex: regexQuery },
        //     //             "user_name": { $regex: regexQuery },
        //     //             "user.first_name": { $regex: regexQuery },  // include specific fields from the populated schema
        //     //         }
        //     //     }
        //     // ])
        //     .then(async (rep) => {
        //         console.log(rep);

        //         let ciphertext = await encryption({
        //             status: true,
        //             message: "Users found",
        //             users: rep,
        //             totalUsers
        //         });
        //         res.status(200).send(ciphertext);
        //     })

    } catch (err) {
        console.error(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.userVerification = async (req, res) => {
    const otpTokenKey = 'thisisforotponly'
    try {
        // let data = req.body;
        let data = await decryption(req.body.data)
        const { account_id, password } = data;
        if (!account_id || !password) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            });
            return res.status(400).send(error);
        }
        else {
            let user = await Account.findOne({ _id: account_id });

            if (user) {
                if (['inactive', 'onhold', 'delete'].includes(user.status)) {
                    let error = await encryption({
                        status: false,
                        message: `Account status is ${user.status}. Login is not allowed.`
                    });
                    return res.status(403).send(error);
                }

                const now = Date.now();

                if (user.account_locked && user.lock_until && user.lock_until > now) {
                    const timeLeft = Math.ceil((user.lock_until - now) / 1000);
                    const minutes = Math.floor(timeLeft / 60);
                    const seconds = timeLeft % 60;
                    let error = await encryption({
                        status: false,
                        message: `Account is locked. Try again in ${minutes}:${seconds < 10 ? '0' : ''}${seconds} minutes.`
                    });
                    return res.status(403).send(error);
                } else if (user.account_locked && user.lock_until && user.lock_until <= now) {
                    user.account_locked = false;
                    user.account_locked_count = 0;
                    user.lock_until = null;
                    await user.save();
                }

                var bytes = await CryptoJS.AES.decrypt(user.password, PASSWORD_ENCRYPTION_KEY);
                var pass = bytes.toString(CryptoJS.enc.Utf8);
                // console.log(pass);
                if (pass != password) {
                    const lock_duration = 10 * 60 * 1000; // 10 Minutes
                    user.account_locked_count = (user.account_locked_count || 0) + 1;
                    if (user.account_locked_count > 3) {
                        user.account_locked = true;
                        user.lock_until = new Date(now + lock_duration);
                    }
                    await user.save();

                    let error = await encryption({
                        status: false,
                        message: "Incorrect Password!"
                    })
                    return res.status(400).send(error)
                } else {

                    user.account_locked_count = 0;
                    user.lock_until = null;
                    await user.save();

                    const data = await encryption({
                        status: true,
                        message: "password verification successful!",
                    });
                    return res.status(200).send(data);
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "User not found!"
                });
                return res.status(404).send(error);
            }
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        return res.status(500).send(error);
    }
};

module.exports.sendLoginOtp = async (req, res) => {
    const otpTokenKey = 'thisisforotponly'
    try {
        // let data = req.body;
        let data = await decryption(req.body.data)
        const { email, phone, password, authenticator, platform } = data;
        if ((!email && !phone) || (email && phone) || !password) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            });
            return res.status(400).send(error);
        } else {

            let user = null
            let createObj = {};
            if (email) {
                user = await Account.findOne({ email: email }).populate({ path: "insta_recipient_id", select: "last_message_time" })
                createObj['login_type'] = 'email';
            }

            if (phone) {
                user = await Account.findOne({ phone: phone }).populate({ path: "insta_recipient_id", select: "last_message_time" })
                createObj['login_type'] = 'phone';
            }

            if (user) {
                if (['inactive', 'onhold', 'delete'].includes(user.status)) {
                    let error = await encryption({
                        status: false,
                        message: `Account status is ${user.status}. Login is not allowed.`
                    });
                    return res.status(403).send(error);
                }
                const now = Date.now();
                const instaLastIntercationTimeDifference = now - new Date(user?.insta_recipient_id?.last_message_time).getTime();
                const timeLimit = (23 * 60 * 60 * 1000) + (50 * 60 * 1000); // 23 hours 50 minutes in milliseconds

                const hasBiometric = user.passkeys && user.passkeys.some(passkey => passkey.enabled);

                if (user.account_locked && user.lock_until && user.lock_until > now) {

                    const timeLeft = Math.ceil((user.lock_until - now) / 1000);
                    const minutes = Math.floor(timeLeft / 60);
                    const seconds = timeLeft % 60;
                    let error = await encryption({
                        status: false,
                        message: `Account is locked. Try again in ${minutes}:${seconds < 10 ? '0' : ''}${seconds} minutes.`
                    });
                    return res.status(403).send(error);

                } else if (user.account_locked && user.lock_until && user.lock_until <= now) {
                    user.account_locked = false;
                    user.account_locked_count = 0;
                    user.lock_until = null;
                    await user.save();
                }
                createObj['user_id'] = user._id;
                createObj['password'] = password;

                var bytes = await CryptoJS.AES.decrypt(user.password, PASSWORD_ENCRYPTION_KEY);
                var pass = bytes.toString(CryptoJS.enc.Utf8);
                // console.log(pass);
                if (pass != password) {
                    const lock_duration = 10 * 60 * 1000; // 10 Minutes
                    user.account_locked_count = (user.account_locked_count || 0) + 1;
                    if (user.account_locked_count > 3) {
                        user.account_locked = true;
                        user.lock_until = new Date(now + lock_duration);
                    }
                    await user.save();

                    let error = await encryption({
                        status: false,
                        message: "Incorrect Password!"
                    })
                    return res.status(400).send(error)
                }

                if (user.tfa && authenticator) {
                    const JWTToken = jwt.sign(createObj, otpTokenKey, { expiresIn: '2m' })

                    let ciphertext = await encryption({
                        status: true,
                        authenticator: true,
                        tfa: user.tfa ? true : false,
                        instagram: user?.insta_bot && user?.insta_recipient_id?.last_message_time && instaLastIntercationTimeDifference <= timeLimit ? true : false,
                        biometric: hasBiometric,
                        token: JWTToken
                    });
                    return res.status(200).send(ciphertext);
                }
                // if (filteredPassKeys.length !== 0 && biometric) {
                //     const JWTToken = jwt.sign(createObj, otpTokenKey, { expiresIn: '2m' })
                //     const ciphertext = await encryption({
                //         status: true,
                //         authenticator: true,
                //         tfa: user.tfa ? true : false,
                //         instagram: user?.insta_bot && user?.insta_recipient_id?.last_message_time && instaLastIntercationTimeDifference <= timeLimit ? true : false,
                //         biometric: true,
                //         token: JWTToken
                //     })
                //     return res.status(200).send(ciphertext);
                // }
                // resetting the account lock values
                user.account_locked_count = 0;
                user.lock_until = null;
                await user.save();

                const loginOtp = `${Math.floor(100000 + Math.random() * 900000)}`;

                if (platform && platform === "instagram" && user?.insta_bot && user?.insta_recipient_id?.last_message_time && instaLastIntercationTimeDifference <= timeLimit) {
                    createObj['otp'] = loginOtp;
                    createObj['insta_bot'] = true;

                    const data = {
                        sender: {
                            id: user?.insta_subscriber_id,
                        }
                    }

                    const chatbotMessage = await quickMessage(data, `Your InstaPay login OTP is: ${loginOtp}. Please use this code to access your account securely.`, "4");

                    const JWTToken = jwt.sign(createObj, otpTokenKey, { expiresIn: '2m' })

                    const ciphertext = await encryption({
                        status: true,
                        authenticator: false,
                        tfa: user.tfa ? true : false,
                        instagram: user?.insta_bot && user?.insta_recipient_id?.last_message_time && instaLastIntercationTimeDifference <= timeLimit ? true : false,
                        biometric: hasBiometric,
                        message: "OTP send successfully!",
                        token: JWTToken
                    });
                    return res.status(200).send(ciphertext);

                }
                let emailSend = '';
                let phoneSend = '';


                createObj['otp'] = loginOtp;
                // console.log(user, loginOtp)

                if (user?.phone && user.sms_verification) {
                    createObj['phone'] = user.phone;
                    createObj['isPhone'] = true;
                    let check;
                    // If country iso code is "ARE", send WhatsApp message instead of SMS
                    if (user?.country_iso_code === "ARE") {
                        check = await sendWhatsAppMessage(user.phone, loginOtp);
                    } else {
                        check = await sendSMSTemplate(user.phone, `Your InstaPay login OTP is: ${loginOtp}. Please use this code to access your account securely.`);
                    }

                    if (check) { phoneSend = 'success'; } else { phoneSend = 'failed'; }
                } else { createObj['isPhone'] = false; }


                if (user?.email && user.email_verification) {
                    createObj['email'] = user.email;
                    createObj['isEmail'] = true;
                    // const check = await sendMails(user.email, "d-2d5f929ed89847d693ab15621b95890f", loginOtp, user.username);
                    const language = 'english';
                    const templateName = 'Login OTP Code';

                    const templateId = getTemplateId(language, templateName);

                    const dynamicData = {
                        otp: loginOtp,
                    };

                    const check = await sendMailsHelper(user.email, 'Test message', 'Test Subject', templateId, dynamicData);
                    // const check = await sendMails(user.email, `Hi${user.username}\n\nYour instapay login OTP: ${loginOtp}`, "Login Verification");
                    if (check) { emailSend = 'success'; } else { emailSend = 'failed'; }
                } else { createObj['isEmail'] = false; }


                if (emailSend == 'failed' && phoneSend == 'failed') {
                    const data = await encryption({
                        status: false,
                        message: "Something went wrong while sending mails or sms!",
                    });
                    return res.status(400).send(data);
                } else {
                    const JWTToken = jwt.sign(createObj, otpTokenKey, { expiresIn: '2m' })
                    const data = await encryption({
                        status: true,
                        authenticator: false,
                        tfa: user.tfa ? true : false,
                        instagram: user?.insta_bot && user?.insta_recipient_id?.last_message_time && instaLastIntercationTimeDifference <= timeLimit ? true : false,
                        biometric: hasBiometric,
                        message: "OTP send successfully!",
                        token: JWTToken
                    });
                    return res.status(200).send(data);
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "User not found!"
                });
                return res.status(404).send(error);
            }
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        return res.status(500).send(error);
    }
};

module.exports.sendMails = async (to, message, subject) => {
    try {

        const sgMail = require('@sendgrid/mail');
        // sgMail.setApiKey(process.env.SENDGRID_API_KEY)
        sgMail.setApiKey('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');
        const msg = {
            from: 'noreply@insta-pay.ch',
            to: to,
            subject: subject,
            text: message,
            trackingSettings: {
                clickTracking: {
                    enable: true,
                    enableText: true
                },
                openTracking: {
                    enable: true
                }
            },
        }

        let send = await sgMail.send(msg)
        // console.log(send);
        console.log('Email sent successfully');
        return true;

    } catch (error) {

        console.error(error.toString());
        return false;

    }

    // const msg = {
    //     to: 'mhunain.y15@gmail.com',
    //     // from: 'noreply@insta-pay.ch',
    //     from: {
    //         email: 'noreply@insta-pay.ch',
    //         name: 'InstaPay'
    //     },
    //     templateId: 'd-fe41f6e52bd0464381424cf9015eaa0e',
    //     version_id: "French",
    //     dynamic_template_data: {
    //         otp: '124124'
    //     },
    // };

    // sgMail.send(msg).then(sg => {
    //     console.log('done', sg);
    // }).catch(err => {
    //     console.log('err', err);
    // })
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
        console.log('SMS sent successfully', send);

        // let messageDetails = await client.messages(send.sid).fetch();
        // console.log('Message Details:', messageDetails);
        return true;
    } catch (error) {
        console.error(error.toString());
        return false;
    }
}

// module.exports.verifyLoginOtp = async (req, res) => {
//     const otpTokenKey = 'thisisforotponly'
//     try {
//         // let data = req.body;
//         let data = await decryption(req.body.data)
//         const { code, email, phone, password, token } = data;
//         if (!code || (!email && !phone) || (email && phone) || !token) {
//             let error = await encryption({
//                 status: false,
//                 message: "Required fields are missing!"
//             });
//             return res.status(400).send(error);
//         }
//         jwt.verify(token, otpTokenKey, async function (err, payload) {
//             if (err) {
//                 let error = await encryption({
//                     status: false,
//                     message: "Invalid token"
//                 })
//                 res.status(400).send(error)
//             } else {
//                 console.log(payload);
//                 Account.findOne({ $and: [{ _id: payload.user_id }, { active: true }, { $or: [{ delete: { $exists: false } }, { delete: false }] }] })
//                     .then(async (user) => {
//                         var bytes = await CryptoJS.AES.decrypt(user.password, PASSWORD_ENCRYPTION_KEY);
//                         var pass = bytes.toString(CryptoJS.enc.Utf8);
//                         if (code == payload.otp) {
//                             if (pass == payload.password && pass == password) {
//                                 const JWTToken = jwt.sign({
//                                     // email: user.email,
//                                     password: user.password,
//                                     account_type: user.account_type,
//                                     _id: user._id
//                                 }, TOKEN_KEY, { expiresIn: '60m' })
//                                 var ciphertext = await encryption({
//                                     success: true,
//                                     token: JWTToken
//                                 })
//                                 res.status(200).send(ciphertext)
//                             } else {
//                                 let error = await encryption({
//                                     status: false,
//                                     message: "Incorrect password."
//                                 })
//                                 res.status(400).send(error)
//                             }
//                         } else {
//                             let error = await encryption({
//                                 status: false,
//                                 message: "Incorrect OTP."
//                             })
//                             res.status(400).send(error)
//                         }
//                     })
//                     .catch(async (err) => {
//                         console.log(err);
//                         let error = await encryption({
//                             status: false,
//                             message: "Something went wrong."
//                         })
//                         res.status(400).send(error)
//                     })
//             }
//         })
//     } catch (err) {
//         console.log(err);
//         res.status(500).send({
//             message: "Internal server error!",
//             status: "500",
//             err
//         })
//     }
// };

module.exports.verifyLoginOtp = async (req, res) => {
    try {
        // let data = req.body;
        let data = await decryption(req.body.data)
        const { code, email, phone, password, token } = data;
        if (!code || (!email && !phone) || (email && phone) || !token) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            });
            return res.status(400).send(error);
        }

        const otpTokenKey = 'thisisforotponly'
        const lock_duration = 10 * 60 * 1000; // 10 minutes in milliseconds

        jwt.verify(token, otpTokenKey, async (err, payload) => {
            // if tokn is expired
            if (err) {
                let error = await encryption({
                    status: false,
                    message: "Invalid or expired token"
                });
                return res.status(400).send(error);
            } else {
                try {
                    let user = await Account.findOne({
                        _id: payload.user_id,
                        active: true,
                        $or: [{ delete: { $exists: false } }, { delete: false }]
                    });

                    if (!user) {
                        let error = await encryption({
                            status: false,
                            message: "User not found."
                        });
                        return res.status(404).send(error);
                    }

                    const now = Date.now();

                    // if account is locked, and there is still time to be unlocked
                    if (user.account_locked && user.lock_until && user.lock_until > now) {
                        const timeLeft = Math.ceil((user.lock_until - now) / 1000);
                        const minutes = Math.floor(timeLeft / 60);
                        const seconds = timeLeft % 60;
                        let error = await encryption({
                            status: false,
                            message: `Account is locked. Try again in ${minutes}:${seconds < 10 ? '0' : ''}${seconds} minutes.`
                        });
                        return res.status(403).send(error);
                    }
                    // if account is locked, and time has been expired
                    else if (user.account_locked && user.lock_until && user.lock_until <= now) {
                        user.account_locked = false;
                        user.account_locked_count = 0;
                        user.lock_until = null;
                        await user.save();
                    }

                    var bytes = await CryptoJS.AES.decrypt(user.password, PASSWORD_ENCRYPTION_KEY);
                    var decryptedPassword = bytes.toString(CryptoJS.enc.Utf8);

                    if (code == payload.otp) {
                        if (decryptedPassword === payload.password && decryptedPassword === password) {
                            // Reset account_locked_count on successful OTP verification
                            user.account_locked_count = 0;
                            user.lock_until = null;
                            await user.save();

                            const JWTToken = jwt.sign({
                                password: user.password,
                                account_type: user.account_type,
                                _id: user._id
                            }, TOKEN_KEY, { expiresIn: '60m' });
                            // let authObj = {
                            //     account: user._id,
                            //     token: JWTToken
                            // }
                            AuthUser.findOneAndUpdate(
                                { account: user._id }, // Filter to match the document
                                { $set: { token: JWTToken } }, // Update operation
                                {
                                    upsert: true,                  // Insert a new document if no match is found
                                    new: true        // Return the updated document (use "before" to return the original)
                                }
                            ).then(async (authResponse) => {
                                if (authResponse) {
                                    var ciphertext = await encryption({
                                        success: true,
                                        token: JWTToken
                                    });
                                    res.status(200).send(ciphertext);
                                } else {
                                    let error = await encryption({
                                        status: false,
                                        message: "Something went wrong."
                                    });
                                    res.status(400).send(error);
                                }
                            }).catch(async (err) => {
                                let error = await encryption({
                                    status: false,
                                    message: "Something went wrong."
                                });
                                res.status(400).send(error);
                            })
                        } else {
                            let error = await encryption({
                                status: false,
                                message: "Incorrect password."
                            });
                            res.status(400).send(error);
                        }
                    } else {
                        // if OTP is incorrect, then we increase the account_locked_count
                        user.account_locked_count += 1;
                        if (user.account_locked_count > 3) {
                            user.account_locked = true;
                            user.lock_until = new Date(now + lock_duration);
                        }
                        await user.save();
                        let error = await encryption({
                            status: false,
                            message: "Incorrect OTP."
                        });
                        res.status(400).send(error);
                    }
                } catch (err) {
                    console.log(err);
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong."
                    });
                    res.status(400).send(error);
                }
            }
        });
    } catch (err) {
        console.log(err);
        res.status(500).send({
            message: "Internal server error!",
            status: "500",
            err
        });
    }
};

module.exports.verifyLoginAuth = async (req, res) => {
    try {
        // let data = req.body;
        let data = await decryption(req.body.data)
        const { code, email, phone, password, token } = data;
        if (!code || (!email && !phone) || (email && phone) || !token) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            });
            return res.status(400).send(error);
        }

        const otpTokenKey = 'thisisforotponly'
        const lock_duration = 10 * 60 * 1000; // 10 minutes in milliseconds

        jwt.verify(token, otpTokenKey, async (err, payload) => {
            // if tokn is expired
            if (err) {
                let error = await encryption({
                    status: false,
                    message: "Invalid or expired token"
                });
                return res.status(400).send(error);
            } else {
                try {
                    let user = await Account.findOne({
                        _id: payload.user_id,
                        active: true,
                        $or: [{ delete: { $exists: false } }, { delete: false }]
                    });

                    if (!user) {
                        let error = await encryption({
                            status: false,
                            message: "User not found."
                        });
                        return res.status(404).send(error);
                    }

                    const now = Date.now();

                    // if account is locked, and there is still time to be unlocked
                    if (user.account_locked && user.lock_until && user.lock_until > now) {
                        const timeLeft = Math.ceil((user.lock_until - now) / 1000);
                        const minutes = Math.floor(timeLeft / 60);
                        const seconds = timeLeft % 60;
                        let error = await encryption({
                            status: false,
                            message: `Account is locked. Try again in ${minutes}:${seconds < 10 ? '0' : ''}${seconds} minutes.`
                        });
                        return res.status(403).send(error);
                    }
                    // if account is locked, and time has been expired
                    else if (user.account_locked && user.lock_until && user.lock_until <= now) {
                        user.account_locked = false;
                        user.account_locked_count = 0;
                        user.lock_until = null;
                        await user.save();
                    }

                    var bytes = await CryptoJS.AES.decrypt(user.password, PASSWORD_ENCRYPTION_KEY);
                    var decryptedPassword = bytes.toString(CryptoJS.enc.Utf8);

                    let authSecretDetails = await AuthSecret.findOne({ account: user._id })
                    if (!authSecretDetails) {
                        let error = await encryption({
                            status: false,
                            message: "Authentication failed!"
                        })
                        res.status(404).send(error)
                    }

                    // let totp = new OTPAuth.TOTP({
                    //     issuer: "InstaPay",
                    //     label: user.username,
                    //     algorithm: "SHA1",
                    //     digits: 6,
                    //     secret: authSecretDetails.value,
                    // });

                    // let delta = totp.validate({ token: code });
                    const secret = authSecretDetails.value;
                    const userProvidedToken = code;
                    const isValid = await verifyTOTP(userProvidedToken, secret);
                    // console.log(isValid, decryptedPassword, payload.password, password, data);
                    // if (code == payload.otp) {
                    if (isValid) {
                        if (decryptedPassword === payload.password && decryptedPassword === password) {
                            // Reset account_locked_count on successful OTP verification
                            user.account_locked_count = 0;
                            user.lock_until = null;
                            await user.save();

                            const JWTToken = jwt.sign({
                                password: user.password,
                                account_type: user.account_type,
                                _id: user._id
                            }, TOKEN_KEY, { expiresIn: '60m' });

                            AuthUser.findOneAndUpdate(
                                { account: user._id }, // Filter to match the document
                                { $set: { token: JWTToken } }, // Update operation
                                {
                                    upsert: true,                  // Insert a new document if no match is found
                                    new: true        // Return the updated document (use "before" to return the original)
                                }
                            ).then(async (authResponse) => {
                                if (authResponse) {
                                    var ciphertext = await encryption({
                                        success: true,
                                        token: JWTToken
                                    });
                                    res.status(200).send(ciphertext);
                                } else {
                                    let error = await encryption({
                                        status: false,
                                        message: "Something went wrong."
                                    });
                                    res.status(400).send(error);
                                }
                            }).catch(async (err) => {
                                let error = await encryption({
                                    status: false,
                                    message: "Something went wrong."
                                });
                                res.status(400).send(error);
                            })
                        } else {
                            let error = await encryption({
                                status: false,
                                message: "Incorrect password."
                            });
                            res.status(400).send(error);
                        }
                    } else {
                        // if OTP is incorrect, then we increase the account_locked_count
                        user.account_locked_count += 1;
                        if (user.account_locked_count > 3) {
                            user.account_locked = true;
                            user.lock_until = new Date(now + lock_duration);
                        }
                        await user.save();
                        let error = await encryption({
                            status: false,
                            message: "Incorrect OTP."
                        });
                        res.status(400).send(error);
                    }
                } catch (err) {
                    console.log(err);
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong."
                    });
                    res.status(400).send(error);
                }
            }
        });
    } catch (err) {
        console.log(err);
        res.status(500).send({
            message: "Internal server error!",
            status: "500",
            err
        });
    }
};

// module.exports.searchUsers = async (req, res) => {
//     try {
//         const query = req.params.query;

//         if (!query) {
//             let error = await encryption({
//                 status: false,
//                 message: "Required fields are missing"
//             });
//             return res.status(400).send(error);
//         }

//         // Find user IDs matching the search criteria
//         const userMatches = await User.find({
//             $or: [
//                 { first_name: { $regex: new RegExp(`${query}`, 'i') } },
//                 { last_name: { $regex: new RegExp(`${query}`, 'i') } },
//             ]
//         }).select('_id');

//         // Find company IDs matching the search criteria
//         const companyMatches = await Company.find({
//             company_name: { $regex: new RegExp(`${query}`, 'i') }
//         }).select('_id');

//         // Find accounts matching the search criteria
//         const users = await Account.find({
//             $and: [
//                 { active: true },
//                 {
//                     $or: [
//                         { username: { $regex: new RegExp(`^${query}`, 'i') } },
//                         { email: { $regex: new RegExp(`^${query}`, 'i') } },
//                         { phone: { $regex: new RegExp(`^${query}`, 'i') } },
//                         { 'user': { $in: userMatches.map(user => user._id) } },
//                         { 'company': { $in: companyMatches.map(company => company._id) } },
//                     ]
//                 }
//             ]
//         })
//             .select('username email phone user company');

//         // Populate user and company data
//         const populatedUsers = await Account.populate(users, [
//             {
//                 path: 'user',
//                 select: 'first_name last_name'
//             },
//             {
//                 path: 'company', // Correct path for company information
//                 select: 'company_name'
//             }
//         ]);


//         let ciphertext = await encryption({
//             status: true,
//             message: "Users found successfully!",
//             data: populatedUsers
//         });
//         res.status(200).send(ciphertext);
//     } catch (err) {
//         console.error("Error:", err);
//         let error = await encryption({
//             status: false,
//             message: "Internal server error."
//         });
//         res.status(500).send(error);
//     }
// };

module.exports.multipleAccountRegisteration = async (req, res) => {
    try {
        let data = await decryption(req.body.data)

        Account.findOne({ $or: [{ email: data.email.toLowerCase() }, { phone: data.phone }] }).then(async (usr) => {
            if (!usr) {
                const passwordToken = generateRandomString(70)
                let createAccountObj = {
                    email: data.email.toLowerCase(),
                    phone: data.phone,
                    account_type: data.account_type,
                    is_external_limit: false,
                    active: true,
                    isPassword: false,
                    passwordToken
                }
                let level = await AccountLevel.findOne({ $and: [{ level_no: 1 }, { account_type: data.account_types }] }, { account_type: true })
                if (level) { createAccountObj['level'] = level._id }
                data['email'] = data.email.toLowerCase()
                Account.create(createAccountObj).then(async (accData) => {
                    console.log(accData);
                    createWallet(accData._id);
                    User.create({
                        first_name: data.first_name ? data.first_name : '',
                        last_name: data.last_name ? data.last_name : '',
                        account: accData._id,
                        kyc_status: data.kyc_status === "approved" ? "approved" : ""
                    }).then(async (userData) => {
                        console.log(userData);
                        Account.findByIdAndUpdate({ _id: accData._id }, { user: userData._id }, { new: true }).then(async (accountData) => {
                            accountData['user'] = userData;
                            const link = `https://my.insta-pay.ch/broadcast/user-verification/${passwordToken}`;

                            const options = {
                                email: data.email.toLowerCase(),
                                message: link,
                                subject: "Set your Instapay Password"
                            }
                            sendEmail(options)
                            var ciphertext = await encryption({
                                status: true,
                                message: "Account has been registered!",
                                accountData
                            })
                            res.status(200).send(ciphertext)
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
                if (usr.email.toLowerCase() == data.email.toLowerCase()) {
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
    } catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}
// password decryption
console.log(CryptoJS.AES.decrypt("U2FsdGVkX19dEo4ZSM+tqKzUPHBp7rbIyagvn/gHuMGa55tkApZvwd7LKYXAlw+w", PASSWORD_ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8))
module.exports.changePassword = async (req, res) => {
    try {
        const data = req.body
        const { accountId, oldPassword, newPassword } = data;

        if (!accountId || !oldPassword || !newPassword) {
            const error = await encryption({
                status: false,
                message: "Required fields are missing!"
            });
            return res.status(404).send(error);
        }

        const user = await Account.findOne({ _id: accountId, active: true });
        if (!user) {
            const error = await encryption({
                status: false,
                message: "User not found!"
            });
            return res.status(404).send(error);
        }

        const decryptedOldPassword = CryptoJS.AES.decrypt(user.password, PASSWORD_ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
        console.log(decryptedOldPassword, "decryptedOldPassword")
        if (decryptedOldPassword !== oldPassword) {
            const error = await encryption({
                status: false,
                message: "Old password is incorrect!"
            });
            return res.status(400).send(error);
        }

        const encryptedNewPassword = CryptoJS.AES.encrypt(newPassword, PASSWORD_ENCRYPTION_KEY).toString();
        user.password = encryptedNewPassword;
        await user.save();

        const passwordSendLanguage = 'english';
        const passwordSendtemplateName = 'Password Updated';
        const templateIdSending = getTemplateId(passwordSendLanguage, passwordSendtemplateName);

        const date = new Date();
        const formattedDate = moment(date).format('YYYY-MM-DD');

        const sendingDetails = {
            toEmail: user.email,
            message: 'Password Changed',
            subject: 'Password Changed',
            templateId: templateIdSending,
            phoneNumber: user.phone,
            phoneMessage: `Your InstaPay account password has been changed!`,
            dynamicData: {
                date_updated: formattedDate,
                account_email: user.email
            }
        }

        // email, phone and push notifications
        sendEmail.sendNotifications(accountId, 'password', sendingDetails)

        const success = await encryption({
            status: true,
            message: "Password changed successfully!"
        });
        return res.status(200).send(success);

    } catch (err) {
        console.error(err);
        const error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        return res.status(500).send(error);
    }
};

module.exports.setPassword = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        const { password, token } = data;

        const account = await Account.findOne({ passwordToken: token });

        if (!account) {
            let error = await encryption({
                status: false,
                message: "Invalid token or passwordToken"
            });
            return res.status(400).send(error);
        }

        if (account.isPassword) {
            let message = await encryption({
                status: true,
                message: "Password is already set for this account"
            });
            return res.status(200).send(message);
        }

        const encryptedPassword = CryptoJS.AES.encrypt(password, PASSWORD_ENCRYPTION_KEY).toString();

        const updatedAccount = await Account.findOneAndUpdate(
            { passwordToken: token },
            { password: encryptedPassword, isPassword: true, passwordToken: "" },
            { new: true }
        );

        let ciphertext = await encryption({
            status: true,
            message: "Password set successfully",
            account: updatedAccount
        });

        res.status(200).send(ciphertext);
    } catch (err) {
        console.error(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.getQuotAndReportCount = async (req, res) => {
    try {
        const accountId = req.params.account_id;

        const account = await Account.findById(accountId);

        if (!account) {
            let error = await encryption({
                status: false,
                message: "Account not found"
            });
            return res.status(400).send(error);
        }

        const quotationCounts = await Quotation.countDocuments({
            $and: [

                { reciever: account._id },

                {
                    $or: [
                        { status: "sent" },
                        { status: "bargain" },
                        { status: "revise" },
                    ]
                }
            ]
        });

        const reportCounts = await Report.countDocuments({
            $and: [

                { to: account._id },

                {
                    $or: [
                        { status: "NEW" },
                        { status: "PENDING" },
                    ]
                }
            ]
        });

        const paymentCounts = await RequestPayment.countDocuments({
            $and: [

                { receiver: account._id },

                {
                    status: "pending"
                }
            ]
        });


        const ciphertext = await encryption({
            status: true,
            message: "Pendings",
            reportCounts,
            paymentCounts,
            quotationCounts
        })
        res.status(200).send(ciphertext);


    } catch (err) {
        console.error(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

// timezone functions

module.exports.getTimezones = async (req, res) => {
    try {
        const countryTimezone = ct.getCountry(countriesIso[req.params.country_iso_code]);
        if (!countryTimezone || countryTimezone?.timezones?.length === 0) {
            let error = await encryption({
                status: false,
                message: "Timezone not found"
            });
            return res.status(400).send(error);
        } else {
            const timezonesWithGMT = countryTimezone.timezones.map((tz) => {
                return `${tz} ${getGmtOffset(tz)}`
            })

            const ciphertext = await encryption({
                status: true,
                message: "Timezones found",
                timezones: timezonesWithGMT
            })
            res.status(200).send(ciphertext);
        }
    } catch (err) {
        console.error(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

// module.exports.getTimezones = async (req, res) => {
//     try {
//         const timezones = await getCountrySpecificTimezoneWithGMT("PK")

//         if (timezones.length === 0) {
//             let error = await encryption({
//                 status: false,
//                 message: "Timezones not found"
//             });
//             return res.status(400).send(error);
//         }

//         const ciphertext = await encryption({
//             status: true,
//             message: "Timezones found",
//             timezones: timezones
//         })
//         res.status(200).send(ciphertext);
//     }
//     catch (err) {
//         console.error(err);
//         let error = await encryption({
//             status: false,
//             message: "Internal server error!"
//         });
//         res.status(500).send(error);
//     }
// }

module.exports.getAllTimezones1 = async (req, res) => {
    try {
        const timezones = await getTimezonesWithGmt()

        if (timezones.length === 0) {
            let error = await encryption({
                status: false,
                message: "Timezones not found"
            });
            return res.status(400).send(error);
        }

        const ciphertext = await encryption({
            status: true,
            message: "Timezones found",
            timezones: timezones
        })
        res.status(200).send(ciphertext);
    }
    catch (err) {
        console.error(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

function getCountriesWithTimezones(data) {
    const countriesWithTimezones = [];

    Object.values(data).forEach(country => {
        country.timezones.forEach(timezone => {
            countriesWithTimezones.push({ name: country.name, timezone });
        });
    });

    return countriesWithTimezones;
}

module.exports.getAllTimezones = async (req, res) => {
    try {
        const countries = ct.getAllCountries();
        const countriesWithTimezones = getCountriesWithTimezones(countries);

        const timeZonesWithGMT = countriesWithTimezones.map((tz) => {
            return { name: tz.name, timezone: `${tz.timezone} ${getGmtOffset(tz.timezone)}` }
        })

        const ciphertext = await encryption({
            status: true,
            message: "Timezones found",
            timeZonesWithGMT
        })
        res.status(200).send(ciphertext);
    } catch (err) {
        console.error(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

module.exports.requestTimezone = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        const { account_id, timezone } = data;

        if (!account_id || !timezone) {
            let error = await encryption({
                status: false,
                message: "Required field are missing!"
            });
            return res.status(400).send(error);
        }

        const account = await Account.findById(account_id);

        if (!account) {
            let error = await encryption({
                status: false,
                message: "Account not found"
            });
            return res.status(400).send(error);
        }

        const timezones = await RequestedTimezones.findOne({ account: account_id, timezone, status: "pending" });

        if (timezones) {
            let error = await encryption({
                status: false,
                message: "Timezone already requested"
            });
            return res.status(400).send(error);
        }

        RequestedTimezones.create({ timezone, account: account_id, status: "pending" }).then(async (timezone) => {
            const ciphertext = await encryption({
                status: true,
                message: "Timezone requested",
                timezone
            })
            res.status(200).send(ciphertext);
        }).catch(async (err) => {
            console.error(err);
            let error = await encryption({
                status: false,
                message: "Internal server error!"
            })
            res.status(500).send(error);
        })

    } catch (err) {
        console.error(err);
        let error = encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }

}

module.exports.requestedTimezones = async (req, res) => {
    try {
        const requestedTimezones = await RequestedTimezones.find();

        let ciphertext = await encryption({
            status: true,
            message: "Requested timezones found",
            requestedTimezones
        });

        res.status(200).send(ciphertext);
    } catch (err) {
        console.error(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

module.exports.acceptTimezoneRequest = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        const { timezone_id } = data;

        const requestedTimezone = await RequestedTimezones.findByIdAndUpdate(
            timezone_id,
            { $set: { status: 'accepted' } },
            { new: true }
        );

        console.log(requestedTimezone, "requested")

        if (!requestedTimezone) {
            let error = await encryption({
                status: false,
                message: "Requested timezone not found"
            });
            return res.status(404).send(error);
        }

        const updatedAccount = await Account.findByIdAndUpdate(
            requestedTimezone.account,
            { timezone: requestedTimezone.timezone },
            { new: true }
        );

        if (!updatedAccount) {
            let error = await encryption({
                status: false,
                message: "Account not found"
            });
            return res.status(404).send(error);
        }

        let ciphertext = await encryption({
            status: true,
            message: "Timezone request updated successfully",
            requestedTimezone,
        });

        res.status(200).send(ciphertext);
    } catch (err) {
        console.error(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

module.exports.setLanguage = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        const { account_id, language } = data;

        if (!account_id || !language) {
            let error = await encryption({
                status: false,
                message: "Required field are missing!"
            });
            return res.status(400).send(error);
        }

        const account = await Account.findById(account_id);

        if (!account) {
            let error = await encryption({
                status: false,
                message: "Account not found"
            });
            return res.status(400).send(error);
        }

        const updatedAccount = await Account.findByIdAndUpdate(account_id, { language }, { new: true });

        if (!updatedAccount) {
            let error = await encryption({
                status: false,
                message: "Account not found"
            });
            return res.status(404).send(error);
        }
        else {
            let ciphertext = await encryption({
                status: true,
                message: "Language updated successfully",
                updatedAccount
            });
            res.status(200).send(ciphertext);
        }


    } catch (err) {
        console.error(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}


module.exports.sendForgotPasswordOtp = async (req, res) => {
    const otpTokenKey = 'thisisforotponly'
    try {
        // let data = req.body;
        let data = await decryption(req.body.data)
        const { email, phone } = data;
        if ((!email && !phone) || (email && phone)) {
            let error = await encryption({
                status: false,
                message: "Invalid fields!"
            });
            return res.status(400).send(error);
        }
        else {
            let user = null
            let createObj = {};
            if (email) {
                user = await Account.findOne({ email: email, active: true, $or: [{ delete: { $exists: false } }, { delete: false }] });
                createObj['otp_type'] = 'email';
            }
            if (phone) {
                user = await Account.findOne({ phone: phone, active: true, $or: [{ delete: { $exists: false } }, { delete: false }] });
                createObj['otp_type'] = 'phone';
            }
            if (user) {
                const now = Date.now();

                if (user.account_locked && user.lock_until && user.lock_until > now) {

                    const timeLeft = Math.ceil((user.lock_until - now) / 1000);
                    const minutes = Math.floor(timeLeft / 60);
                    const seconds = timeLeft % 60;
                    let error = await encryption({
                        status: false,
                        message: `Account is locked. Try again in ${minutes}:${seconds < 10 ? '0' : ''}${seconds} minutes.`
                    });
                    return res.status(403).send(error);

                }
                // else if (user.account_locked && user.lock_until && user.lock_until <= now) {
                //     user.account_locked = false;
                //     user.account_locked_count = 0;
                //     user.lock_until = null;
                //     await user.save();
                // }

                let emailSend = '';
                let phoneSend = '';

                createObj['user_id'] = user._id;

                const forgotPassOtp = `${Math.floor(100000 + Math.random() * 900000)}`;
                createObj['otp'] = forgotPassOtp;
                // console.log(user, forgotPassOtp)

                if (user?.phone && user.sms_verification) {
                    createObj['phone'] = user.phone;
                    createObj['isPhone'] = true;
                    const check = await sendSMSTemplate(user.phone, `this is your instapay Forgot Password OTP: ${forgotPassOtp}`)

                    if (check) { phoneSend = 'success'; } else { phoneSend = 'failed'; }
                } else { createObj['isPhone'] = false; }


                if (user?.email && user.email_verification) {
                    createObj['email'] = user.email;
                    createObj['isEmail'] = true;
                    // const check = await sendMails(user.email, "d-2d5f929ed89847d693ab15621b95890f", forgotPassOtp, user.username);
                    const language = 'english';
                    const templateName = 'Password Reset';

                    const templateId = getTemplateId(language, templateName);

                    const dynamicData = {
                        otp: forgotPassOtp,
                    };

                    const check = await sendMailsHelper(user.email, 'Test message', 'Test Subject', templateId, dynamicData);
                    // const check = await sendMails(user.email, `Hi${user.username}\n\nYour instapay login OTP: ${forgotPassOtp}`, "Login Verification");
                    if (check) { emailSend = 'success'; } else { emailSend = 'failed'; }
                } else { createObj['isEmail'] = false; }


                if (emailSend == 'failed' && phoneSend == 'failed') {
                    const data = await encryption({
                        status: false,
                        message: "Something went wrong while sending mails or sms!",
                    });
                    return res.status(400).send(data);
                } else {
                    const JWTToken = jwt.sign(createObj, otpTokenKey, { expiresIn: '1h' })
                    const data = await encryption({
                        status: true,
                        message: "OTP send successfully!",
                        token: JWTToken
                    });
                    return res.status(200).send(data);
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "User not found!"
                });
                return res.status(404).send(error);
            }
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        return res.status(500).send(error);
    }
};


module.exports.verifyForgotPasswordOtp = async (req, res) => {
    try {
        // let data = req.body;
        let data = await decryption(req.body.data)
        const { code, email, phone, token } = data;
        if (!code || (!email && !phone) || (email && phone) || !token) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            });
            return res.status(400).send(error);
        }

        const otpTokenKey = 'thisisforotponly'
        const lock_duration = 10 * 60 * 1000; // 10 minutes in milliseconds

        jwt.verify(token, otpTokenKey, async (err, payload) => {
            // if tokn is expired
            if (err) {
                let error = await encryption({
                    status: false,
                    message: "Invalid or expired token"
                });
                return res.status(400).send(error);
            } else {
                try {
                    // let newPassword = CryptoJS.AES.encrypt(password, PASSWORD_ENCRYPTION_KEY).toString();
                    let user = await Account.findOne({
                        _id: payload.user_id,
                        active: true,
                        $or: [{ delete: { $exists: false } }, { delete: false }]
                    });

                    if (!user) {
                        let error = await encryption({
                            status: false,
                            message: "User not found."
                        });
                        return res.status(404).send(error);
                    }

                    const now = Date.now();

                    // if account is locked, and there is still time to be unlocked
                    if (user.account_locked && user.lock_until && user.lock_until > now) {
                        const timeLeft = Math.ceil((user.lock_until - now) / 1000);
                        const minutes = Math.floor(timeLeft / 60);
                        const seconds = timeLeft % 60;
                        let error = await encryption({
                            status: false,
                            message: `Account is locked. Try again in ${minutes}:${seconds < 10 ? '0' : ''}${seconds} minutes.`
                        });
                        return res.status(403).send(error);
                    }
                    // if account is locked, and time has been expired
                    else if (user.account_locked && user.lock_until && user.lock_until <= now) {
                        user.account_locked = false;
                        user.account_locked_count = 0;
                        user.lock_until = null;
                        await user.save();
                    }

                    if (code == payload.otp) {
                        // Reset account_locked_count on successful OTP verification
                        user.account_locked_count = 0;
                        user.lock_until = null;
                        await user.save();

                        let createObj = { payload, otp: 'success' }
                        const JWTToken = jwt.sign(createObj, otpTokenKey, { expiresIn: '800s' })

                        const ciphertext = await encryption({
                            status: true,
                            message: "OTP verified successfully!",
                            token: JWTToken
                        });
                        res.status(200).send(ciphertext);

                    } else {
                        // if OTP is incorrect, then we increase the account_locked_count
                        user.account_locked_count += 1;
                        if (user.account_locked_count > 3) {
                            user.account_locked = true;
                            user.lock_until = new Date(now + lock_duration);
                        }
                        await user.save();
                        let error = await encryption({
                            status: false,
                            message: "Incorrect OTP."
                        });
                        res.status(400).send(error);
                    }
                } catch (err) {
                    console.log(err);
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong."
                    });
                    res.status(400).send(error);
                }
            }
        });
    } catch (err) {
        console.log(err);
        res.status(500).send({
            message: "Internal server error!",
            status: "500",
            err
        });
    }
};


module.exports.resetForgotPassword = async (req, res) => {
    try {
        // let data = req.body;
        let data = await decryption(req.body.data)
        const { code, email, phone, token, password } = data;
        if (!code || (!email && !phone) || (email && phone) || !token || !password) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            });
            return res.status(400).send(error);
        }

        const otpTokenKey = 'thisisforotponly'
        const lock_duration = 10 * 60 * 1000; // 10 minutes in milliseconds

        jwt.verify(token, otpTokenKey, async (err, payload) => {
            // if tokn is expired
            if (err) {
                let error = await encryption({
                    status: false,
                    message: "Invalid or expired token"
                });
                return res.status(400).send(error);
            } else {
                try {
                    let newPassword = CryptoJS.AES.encrypt(password, PASSWORD_ENCRYPTION_KEY).toString();
                    let user = await Account.findOne({
                        _id: payload.payload.user_id,
                        active: true,
                        $or: [{ delete: { $exists: false } }, { delete: false }]
                    });

                    if (!user) {
                        let error = await encryption({
                            status: false,
                            message: "User not found."
                        });
                        return res.status(404).send(error);
                    }

                    const now = Date.now();

                    // if account is locked, and there is still time to be unlocked
                    if (user.account_locked && user.lock_until && user.lock_until > now) {
                        const timeLeft = Math.ceil((user.lock_until - now) / 1000);
                        const minutes = Math.floor(timeLeft / 60);
                        const seconds = timeLeft % 60;
                        let error = await encryption({
                            status: false,
                            message: `Account is locked. Try again in ${minutes}:${seconds < 10 ? '0' : ''}${seconds} minutes.`
                        });
                        return res.status(403).send(error);
                    }
                    // if account is locked, and time has been expired
                    else if (user.account_locked && user.lock_until && user.lock_until <= now) {
                        user.account_locked = false;
                        user.account_locked_count = 0;
                        user.lock_until = null;
                        await user.save();
                    }

                    if (code == payload.payload.otp && payload.otp == 'success') {
                        // Reset account_locked_count on successful OTP verification
                        user.account_locked_count = 0;
                        user.lock_until = null;
                        user.password = newPassword;
                        await user.save();

                        if (user?.email) {
                            const language = 'english';
                            const templateName = 'Password Updated';
                            const templateId = getTemplateId(language, templateName);
                            let dynamicData = {
                                date_updated: new Date().toISOString().
                                    replace(/T/, ' ').      // replace T with a space
                                    replace(/\..+/, '').split(' ')[0],
                                account_email: email
                            }
                            const check = await sendMailsHelper(user.email, 'Test message', 'Test Subject', templateId, dynamicData);
                        } else if (user?.phone) {
                            const check = await sendSMSTemplate(user.phone, `Your Instapay password reset successfully.`)
                        }

                        const ciphertext = await encryption({
                            status: true,
                            message: "Password reset successfully!",
                        });
                        res.status(200).send(ciphertext);

                    } else {
                        // if OTP is incorrect, then we increase the account_locked_count
                        user.account_locked_count += 1;
                        if (user.account_locked_count > 3) {
                            user.account_locked = true;
                            user.lock_until = new Date(now + lock_duration);
                        }
                        await user.save();
                        let error = await encryption({
                            status: false,
                            message: "Incorrect OTP."
                        });
                        res.status(400).send(error);
                    }
                } catch (err) {
                    console.log(err);
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong."
                    });
                    res.status(400).send(error);
                }
            }
        });
    } catch (err) {
        console.log(err);
        res.status(500).send({
            message: "Internal server error!",
            status: "500",
            err
        });
    }
};

async function userInstaInfo(recipientId) {
    try {
        const response = await axios.get(`https://graph.facebook.com/v19.0/${recipientId}?fields=username,name,follower_count&access_token=${process.env.facebook_access_token}`);
        return response.data;
    } catch (err) {
        console.error('Error fetching info', err);
        return null;
    }
}

async function getUserSocialMediaFollowers(account) {
    const socialMediaFollowers = {
        instagram: null,
        facebook: 'not connected',
        twitter: 'not connected',
        whatsapp: 'not connected',
        tiktok: 'not connected',
        telegram: 'not connected'
    };

    try {
        const userInfo = await userInstaInfo(account.insta_recipient_id.recipient);
        if (userInfo) {
            socialMediaFollowers.instagram = userInfo.follower_count;
        } else {
            socialMediaFollowers.instagram = 'not connected';
        }
    } catch (error) {
        console.error('Error fetching Instagram user info, defaulting followersCount to 0', error);
        socialMediaFollowers.instagram = 'not connected';
    }

    return socialMediaFollowers;
}

module.exports.getSocialMediaDetails = async (req, res) => {
    try {
        const { account_id } = req.params;

        if (!account_id) {
            let error = {
                status: false,
                message: "Account ID is missing!"
            };
            return res.status(400).send(error);
        }

        const account = await Account.findById(account_id).populate('insta_recipient_id')

        if (!account) {
            let error = {
                status: false,
                message: "Account not found!"
            };
            return res.status(404).send(error);
        }

        const socialMediaFollowers = await getUserSocialMediaFollowers(account);
        const ciphertext = await encryption({
            status: true,
            message: "Fetched social media followers successfully!",
            data: socialMediaFollowers
        })
        return res.status(200).send(ciphertext);

    } catch (err) {
        console.error(err);
        const error = {
            status: false,
            message: "Something went wrong!"
        };
        return res.status(500).send(error);
    }
};
module.exports.getSocialMediaDetailsPublic = async (req, res) => {
    try {
        const { username } = req.params;

        if (!username) {
            let error = {
                status: false,
                message: "Account ID is missing!"
            };
            return res.status(400).send(error);
        }

        const account = await Account.findOne({ username }).populate('insta_recipient_id')

        if (!account) {
            let error = {
                status: false,
                message: "Account not found!"
            };
            return res.status(404).send(error);
        }

        const socialMediaFollowers = await getUserSocialMediaFollowers(account);
        const ciphertext = await encryption({
            status: true,
            message: "Fetched social media followers successfully!",
            data: socialMediaFollowers
        })
        return res.status(200).send(ciphertext);

    } catch (err) {
        console.error(err);
        const error = {
            status: false,
            message: "Something went wrong!"
        };
        return res.status(500).send(error);
    }
};

module.exports.securityQuestionCheck = async (req, res) => {
    try {
        const { account_id } = req.params;

        if (!account_id) {
            return res.status(400).send({
                status: false,
                message: "Required fields are missing!"
            });
        }

        const account = await Account.findById(account_id).populate(["user", "company"]);

        if (!account) {
            return res.status(404).send({
                status: false,
                message: "User not found!"
            });
        }

        const currentDate = new Date();
        const createdAt = new Date(account.createdAt);
        const lastCheckDate = new Date(account?.lastCheckDate || account.createdAt);
        const daysSinceCreation = Math.floor((currentDate - createdAt) / (1000 * 60 * 60 * 24));
        const daysSinceLastCheck = Math.floor((currentDate - lastCheckDate) / (1000 * 60 * 60 * 24));

        console.log(daysSinceCreation, daysSinceLastCheck, currentDate, createdAt, lastCheckDate);

        let currentCheck = false;
        let thirtyDaysCheck = false;

        if (daysSinceLastCheck >= 3) {
            currentCheck = true;
            account.lastCheckDate = currentDate;
            await account.save();
        }

        if (daysSinceCreation > 30) {
            thirtyDaysCheck = true;
        }

        const securityQuestionsSet = (account.account_type === "individual" && account.user.answer1 && account.user.answer2 && account.user.answer3) ||
            (account.account_type === "business" && account.company.answer1 && account.company.answer2 && account.company.answer3);

        if (securityQuestionsSet) {
            return res.status(200).send({
                status: true,
                message: "Security questions are set successfully!"
            });
        } else {
            return res.status(200).send({
                status: true,
                message: "Security questions are not set!",
                currentCheck,
                thirtyDaysCheck
            });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).send({
            status: false,
            message: "Something went wrong!"
        });
    }
}

module.exports.getJWMediaStatus = async (req, res) => {
    try {
        const data = await decryption(req.body.data)
        // const data = req.body
        const { media_id, file_type, account_id } = data

        if (req.user._id != account_id) {
            let error = await encryption({
                message: "Unauthorized user.",
                status: false,
            })
            return res.status(401).send(error)
        }

        const headers = {
            Authorization: `Bearer ${process.env.JW_API_KEY}`,
        };

        const url = `https://api.jwplayer.com/v2/sites/${process.env.JW_SITE_ID}/media/${media_id}`;

        // const url2 = `https://api.jwplayer.com/v2/sites/${process.env.JW_SITE_ID}/thumbnails/xyhqpj88`

        const response = await axios.get(url, { headers });


        // return res.json(response.data)

        if (response.status !== 200) {
            const error = await encryption({
                status: false,
                message: "Media status not found!",
            })

            return res.status(404).send(error);
        }

        const jwData = response.data

        const newDocument = new Document({
            account: account_id,
            file_type: file_type,
            jw_media: {
                mediaId: media_id,
                status: jwData.status
            },
            description: jwData.metadata.description,
            title: jwData.metadata.title
        })

        await newDocument.save()

        const ciphertext = await encryption({
            status: true,
            message: "Media status",
            data: jwData
        })

        res.status(200).send(ciphertext)
    } catch (err) {
        console.error(err?.response?.data?.errors || err);
        const error = {
            status: false,
            message: "Something went wrong!"
        };
        return res.status(500).send(error);
    }
};

module.exports.addPortfolioItem = async (req, res) => {
    try {
        const data = await decryption(req.body.data)
        // const data = req.body
        const { title, description, file_type, username, language } = data;

        if (req.user.username !== username) {
            let error = await encryption({
                message: "Unauthorized user.",
                status: false,
            })
            return res.status(401).send(error)
        }

        const account = await Account.findById(req.user._id);

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.JW_API_KEY}`,
        };

        const url = `https://api.jwplayer.com/v2/sites/${process.env.JW_SITE_ID}/media`;

        const body = {
            upload: {
                mime_type: file_type ?? 'video/mp4',
                method: 'direct',
            },
            metadata: {
                title: title,
                description: description,
                author: username ?? 'InstaPay',
                category: 'Movies',
                tags: ['InstaPay'],
                language: language ?? 'en',
                external_id: `ip_${Date.now()}`,
                custom_params: {
                    first_name: account?.first_name,
                    last_name: account?.last_name,
                    email: account?.email ?? 'N/A',
                    username: account?.username,
                    phone: account?.phone ?? 'N/A',
                    country: account?.country_name,
                    city: account?.city ?? 'N/A',
                }
            },
        };

        const response = await axios.post(url, body, { headers });

        if (response.status !== 200 && response.status !== 201) {
            const error = await encryption({
                status: false,
                message: 'Portfolio video upload failed!',
            });

            return res.status(response.status).send(error);
        }

        const jwData = response.data;
        console.log(jwData);

        const ciphertext = await encryption({
            status: true,
            message: 'Portfolio video added successfully!',
            data: jwData,
        });

        res.status(200).send(ciphertext);
    } catch (error) {
        console.error(error?.response?.data?.errors || error);
        const errResponse = await encryption({
            status: false,
            message: 'Something went wrong!',
        });
        return res.status(500).send(errResponse);
    }
};

module.exports.setAccountPin = async (req, res) => {
    try {
        // const { account_id, pin } = req.body;
        const { account_id, pin } = await decryption(req.body.data)

        if (!/^\d{4}$/.test(pin)) {
            const error = await encryption({
                status: false,
                message: "PIN must be exactly 4 digits."
            })
            return res.status(400).send(error);
        }

        const account = await Account.findById(account_id);
        if (!account) {
            const error = await encryption({
                status: false,
                message: "Account not found."
            })
            return res.status(404).send(error);
        }

        const encryptedPin = CryptoJS.AES.encrypt(pin, PASSWORD_ENCRYPTION_KEY).toString();

        account.pin = encryptedPin;
        account.pin_status = true;
        await account.save();

        res.status(200).send(await encryption({
            status: true,
            message: "PIN set successfully!"
        }));
    } catch (error) {
        console.error(error);
        const errResponse = await encryption({
            status: false,
            message: 'Something went wrong!',
        });
        return res.status(500).send(errResponse);
    }
}

module.exports.changePinStatus = async (req, res) => {
    try {
        const { account_id, status } = req.body;
        // const { account_id, status } = await decryption(req.body.data);

        if (typeof status !== "boolean") {
            const error = await encryption({
                status: false,
                message: "Status must be a boolean value (true or false)."
            });
            return res.status(400).send(error);
        }

        const account = await Account.findById(account_id);
        if (!account) {
            const error = await encryption({
                status: false,
                message: "Account not found."
            });
            return res.status(404).send(error);
        }

        account.pin_status = status;
        await account.save();

        res.status(200).send(await encryption({
            status: true,
            message: `PIN status ${status ? "enabled" : "disabled"} successfully.`
        }));
    } catch (error) {
        console.error(error);
        const errResponse = await encryption({
            status: false,
            message: 'Something went wrong!',
        });
        return res.status(500).send(errResponse);
    }
};

module.exports.changeAccountPin = async (req, res) => {
    try {
        // const { account_id, new_pin } = await decryption(req.body.data);
        const { account_id, new_pin } = req.body;

        if (!/^\d{4}$/.test(new_pin)) {
            const error = await encryption({
                status: false,
                message: "New PIN must be exactly 4 digits."
            });
            return res.status(400).send(error);
        }

        const account = await Account.findById(account_id);
        if (!account) {
            const error = await encryption({
                status: false,
                message: "Account not found."
            });
            return res.status(404).send(error);
        }

        // Decrypt the stored PIN
        // const decryptedStoredPin = CryptoJS.AES.decrypt(account.pin, PASSWORD_ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);

        // if (decryptedStoredPin !== old_pin) {
        //     const error = await encryption({
        //         status: false,
        //         message: "Old PIN is incorrect."
        //     });
        //     return res.status(401).send(error);
        // }

        // Encrypt and set the new PIN
        const encryptedNewPin = CryptoJS.AES.encrypt(new_pin, PASSWORD_ENCRYPTION_KEY).toString();
        account.pin = encryptedNewPin;
        await account.save();

        res.status(200).send(await encryption({
            status: true,
            message: "PIN changed successfully!"
        }));
    } catch (error) {
        console.error(error);
        const errResponse = await encryption({
            status: false,
            message: 'Something went wrong!',
        });
        return res.status(500).send(errResponse);
    }
};


// BIOMETRIC SETUP APIS

module.exports.registerChallenge = async (req, res) => {
    const { account_id } = req.body;
    // const { account_id } = await decryption(req.body.data);

    try {
        const user = await Account.findById(account_id);
        if (!user) {
            const errResponse = await encryption({
                status: false,
                message: 'User not found!',
            });
            return res.status(404).send(errResponse);

        }

        const challengePayload = await generateRegistrationOptions({
            rpID,
            rpName: 'Instapay Authentication',
            userID: account_id,
            userName: user.username,
            attestationType: 'none',
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
                authenticatorAttachment: 'platform'
            },
            timeout: 60000,
        });

        user.challenge = challengePayload.challenge;
        await user.save();

        const encryptedResponse = await encryption({
            status: true,
            options: challengePayload,
        });
        return res.json(encryptedResponse);

    } catch (error) {
        console.error(error);
        const errResponse = await encryption({
            status: false,
            message: 'Something went wrong!',
        });
        return res.status(500).send(errResponse);
    }
};

module.exports.registerVerify = async (req, res) => {
    try {
        // const { account_id, credentials } = req.body;
        const { account_id, credentials, device_name } = await decryption(req.body.data);

        if (!credentials || !account_id || !device_name) {
            const errResponse = await encryption({
                status: false,
                message: 'Required fields are missing',
            });
            return res.status(400).send(errResponse);
        }

        const user = await Account.findById(account_id);
        if (!user) {
            const errResponse = await encryption({
                status: false,
                message: 'User not found!',
            });
            return res.status(404).send(errResponse);

        }

        // user can only set maximum of three devices
        if (user?.passkeys?.length >= 3) {
            const errResponse = await encryption({
                status: false,
                message: 'Maximum number of devices reached',
            });
            return res.status(400).send(errResponse);
        }

        const verification = await verifyRegistrationResponse({
            response: credentials,
            expectedChallenge: user.challenge,
            expectedOrigin,
            expectedRPID: rpID,
            requireUserVerification: false
        });

        if (verification.verified) {
            const { registrationInfo } = verification;

            const newPasskey = {
                credentialID: Buffer.from(registrationInfo.credentialID),
                credentialPublicKey: Buffer.from(registrationInfo.credentialPublicKey),
                counter: registrationInfo.counter,
                deviceName: device_name || 'Unknown Device',
            };

            user.passkeys.push(newPasskey);
            await user.save();

            const successResponse = await encryption({
                status: true,
                registeredDevices: user.passkeys.map(p => ({
                    deviceName: p.deviceName,
                }))
            });
            return res.send(successResponse);

        } else {
            const errorResponse = await encryption({
                status: false,
                message: 'Verification failed',
            });
            return res.status(400).send(errorResponse);

        }
    } catch (error) {
        console.error(error);
        const errResponse = await encryption({
            status: false,
            message: 'Something went wrong!',
        });
        return res.status(500).send(errResponse);
    }
};

module.exports.loginChallenge = async (req, res) => {
    try {
        // const { account_id, username } = req.body;
        const { account_id, username } = await decryption(req.body.data);

        if (!account_id || !username) {
            const error = await encryption({
                status: false,
                message: "Account ID and username are required."
            });
            return res.status(400).send(error);

        }

        const user = await Account.findById(account_id);

        if (!user) {
            const errResponse = await encryption({
                status: false,
                message: 'User not found!',
            });
            return res.status(404).send(errResponse);

        }

        if (user.username !== username) {
            const errResponse = await encryption({
                status: false,
                message: 'Invalid username',
            });
            return res.status(400).send(errResponse);

        }

        const filteredPassKeys = Object.keys(user?.passkey || {}).filter(key => user.passkey[key] !== undefined);

        if (filteredPassKeys.length === 0) {
            const errResponse = await encryption({
                status: false,
                message: 'No passkey registered for this user',
            });
            return res.status(400).send(errResponse);

        }

        const opts = await generateAuthenticationOptions({
            rpID,
            allowCredentials: [{
                id: user.passkey.credentialID,
                type: 'public-key',
                transports: ['internal'],
            }],
            userVerification: 'preferred',
        });

        user.challenge = opts.challenge;
        await user.save();

        const successResponse = await encryption({
            status: true,
            options: opts,
        });
        return res.status(200).send(successResponse);

    } catch (error) {
        console.error(error);
        const errResponse = await encryption({
            status: false,
            message: 'Something went wrong!',
        });
        return res.status(500).send(errResponse);
    }
};

module.exports.loginVerify = async (req, res) => {
    try {
        // const { account_id, credentials } = req.body;
        const { account_id, credentials } = await decryption(req.body.data);

        const user = await Account.findById(account_id);
        if (!user) {
            const errResponse = await encryption({
                status: false,
                message: 'User not found!',
            });
            return res.status(404).send(errResponse);

        }

        const verification = await verifyAuthenticationResponse({
            response: credentials,
            expectedChallenge: user.challenge,
            expectedOrigin,
            expectedRPID: rpID,
            authenticator: user.passkey,
            requireUserVerification: false
        });

        if (verification.verified) {
            user.passkey.counter = verification.authenticationInfo.newCounter;
            await user.save();
            const successResponse = await encryption({
                success: true,
                account_id,
            });
            return res.status(200).send(successResponse);
            ;
        } else {
            const errResponse = await encryption({
                status: false,
                message: 'Verification failed',
            });
            return res.status(400).send(errResponse);

        }
    } catch (error) {
        console.error(error);
        const errResponse = await encryption({
            status: false,
            message: 'Something went wrong!',
        });
        return res.status(500).send(errResponse);
    }
};

module.exports.deleteChallenge = async (req, res) => {
    try {
        const { account_id } = req.body;

        if (!account_id) {
            const errResponse = await encryption({
                status: false,
                message: 'Required fields are missing',
            });
            return res.status(400).send(errResponse);
        }

        const user = await Account.findByIdAndUpdate(
            account_id,
            { $unset: { challenge: "", passkey: "" } },
            { new: true }
        );

        if (!user) {
            const errResponse = await encryption({
                status: false,
                message: 'User not found',
            });
            return res.status(404).send(errResponse);
        }

        res.status(200).send(await encryption({ status: true, message: 'Challenge deleted successfully' }));
    } catch (error) {
        console.error(error);
        const errResponse = await encryption({
            status: false,
            message: 'Something went wrong!',
        });
        return res.status(500).send(errResponse);
    }
}

// LOGIN WITH BIOMETRIC APIS

module.exports.loginBiometricChallenge = async (req, res) => {
    const { phone, email } = await decryption(req.body.data);

    try {
        let user;
        if (phone) {
            user = await Account.findOne({ phone });
        } else if (email) {
            user = await Account.findOne({ email });
        } else {
            const errResponse = await encryption({
                status: false,
                message: 'Required fields are missing',
            });
            return res.status(400).send(errResponse);
        }
        if (!user) {
            const errResponse = await encryption({
                status: false,
                message: 'User not found!',
            });
            return res.status(400).send(errResponse);
        }

        // const filteredPassKeys = Object.keys(user?.passkey || {}).filter(key => user.passkey[key] !== undefined);

        // if (filteredPassKeys.length === 0) {
        //     const errResponse = await encryption({
        //         status: false,
        //         message: 'No passkey registered for this user',
        //     });
        //     return res.status(400).send(errResponse);
        // }

        // Generate authentication options for biometric login
        const opts = await generateAuthenticationOptions({
            rpID,
            allowCredentials: user.passkeys.map(passkey => ({
                id: passkey.credentialID,
                type: 'public-key',
                transports: ['internal'],
            })),
            userVerification: 'preferred',
        });

        // Save the challenge for later verification
        user.challenge = opts.challenge;
        await user.save();

        const ciphertext = await encryption({
            status: true,
            message: 'Biometric login challenge generated successfully',
            options: opts,
            account_id: user._id
        });
        return res.status(200).send(ciphertext);
    } catch (error) {
        console.error('Biometric login challenge error:', error);
        const errResponse = await encryption({
            status: false,
            message: 'Something went wrong!',
        });
        return res.status(500).send(errResponse);
    }
};

module.exports.loginBiometricVerify = async (req, res) => {
    const { account_id, credentials } = await decryption(req.body.data);

    if (!account_id || !credentials) {
        const errResponse = await encryption({
            status: false,
            message: 'Required fields are missing',
        });
        return res.status(400).send(errResponse);
    }

    try {
        const user = await Account.findById(account_id);
        if (!user) {
            const errResponse = await encryption({
                status: false,
                message: 'User not found!',
            });
            return res.status(400).send(errResponse);
        }

        // Find matching passkey
        const credentialId = Buffer.from(credentials.id, 'base64url');
        const passkey = user.passkeys.find(p => p.credentialID.equals(credentialId) && p?.enabled);
        if (!passkey) {
            const errResponse = await encryption({
                status: false,
                message: 'Passkey not found!',
            });
            return res.status(400).send(errResponse);
        }

        // const filteredPassKeys = Object.keys(user?.passkey || {}).filter(key => user.passkey[key] !== undefined);

        // if (filteredPassKeys.length === 0) {
        //     const errResponse = await encryption({
        //         status: false,
        //         message: 'No passkey registered for this user',
        //     });
        //     return res.status(400).send(errResponse);
        // }

        // Verify the biometric response
        const verification = await verifyAuthenticationResponse({
            response: credentials,
            expectedChallenge: user.challenge,
            expectedOrigin,
            expectedRPID: rpID,
            authenticator: passkey,
            requireUserVerification: false, // Ensure biometric verification
        });

        if (verification.verified) {
            // Update the stored counter
            passkey.counter = verification.authenticationInfo.newCounter;
            await user.save();

            const JWTToken = jwt.sign(
                {
                    password: user.password,
                    account_type: user.account_type,
                    _id: user._id,
                },
                TOKEN_KEY,
                { expiresIn: '60m' }
            );

            await AuthUser.findOneAndUpdate(
                { account: user._id },
                { $set: { token: JWTToken } },
                { upsert: true, new: true }
            );

            const ciphertext = await encryption({
                status: false,
                message: 'User verified succesfully!',
                token: JWTToken
            });
            return res.status(200).send(ciphertext);
        } else {
            const errResponse = await encryption({
                status: false,
                message: 'Biometric verification failed',
            });
            return res.status(400).send(errResponse);
        }
    } catch (error) {
        console.error('Biometric login verification error:', error);
        const errResponse = await encryption({
            status: false,
            message: 'Something went wrong!',
        });
        return res.status(500).send(errResponse);
    }
};

module.exports.getBiometricDevices = async (req, res) => {
    try {
        const { account_id } = await decryption(req.body.data);
        const user = await Account.findById(account_id).select('passkeys');

        if (!user) {
            return res.status(404).send(await encryption({
                status: false,
                message: 'User not found'
            }));
        }

        const devices = user.passkeys.map(p => ({
            deviceName: p.deviceName,
            credentialId: p.credentialID.toString('base64url'),
            registeredAt: p.registeredAt,
            enabled: p.enabled
        }));

        return res.send(await encryption({
            status: true,
            devices
        }));

    } catch (error) {
        console.error(error);
        return res.status(500).send(await encryption({
            status: false,
            message: 'Something went wrong!'
        }));
    }
};

module.exports.removeBiometricDevice = async (req, res) => {
    try {
        const { account_id, credentialId } = await decryption(req.body.data);
        const user = await Account.findById(account_id);

        if (!user) {
            return res.status(404).send(await encryption({
                status: false,
                message: 'User not found'
            }));
        }

        // Convert string back to Buffer
        const credentialIdBuffer = Buffer.from(credentialId, 'base64url');

        // Filter out the device
        const initialLength = user.passkeys.length;
        user.passkeys = user.passkeys.filter(p =>
            !p.credentialID.equals(credentialIdBuffer)
        );

        if (initialLength === user.passkeys.length) {
            return res.status(404).send(await encryption({
                status: false,
                message: 'Device not found'
            }));
        }

        await user.save();
        return res.send(await encryption({
            status: true,
            message: 'Device removed successfully',
            remainingDevices: user.passkeys.length
        }));

    } catch (error) {
        console.error(error);
        return res.status(500).send(await encryption({
            status: false,
            message: 'Something went wrong!'
        }));
    }
};

module.exports.enableDisableBiometricDevice = async (req, res) => {
    try {
        const { account_id, credentialId, enable } = await decryption(req.body.data);
        const user = await Account.findById(account_id);

        if (!user) {
            return res.status(404).send(await encryption({
                status: false,
                message: 'User not found'
            }));
        }

        const passkey = user.passkeys.find(p => p.credentialID.equals(Buffer.from(credentialId, 'base64url')));

        if (!passkey) {
            return res.status(404).send(await encryption({
                status: false,
                message: 'Device not found'
            }));
        }

        passkey.enabled = enable;
        await user.save();

        return res.send(await encryption({
            status: true,
            message: `Device ${enable ? 'enabled' : 'disabled'} successfully`
        }));

    } catch (error) {
        console.error('Enable/Disable Biometric Device Error:', error);
        return res.status(500).send(await encryption({
            status: false,
            message: 'Something went wrong!'
        }));
    }
};


module.exports.verifyTOTP = verifyTOTP;
module.exports.createWallet = createWallet
