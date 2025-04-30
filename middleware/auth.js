const jwt = require('jsonwebtoken');
const asynHandler = require('../middleware/async');
const LoginToken = require('../models/LoginToken.model');
const AuthUser = require('../models/Auth-User.model');
const Account = require('../models/Account.model');
const Admin = require('../models/Admin.model');
const ErrorResponse = require('../utils/errorResponse');
const USER_TOKEN_KEY = 'secretOfTheInstaPaySystemAccountTOKEN'
const ADMIN_TOKEN_KEY = 'secretOfTheInstaPaySystemAdminAccountTOKEN'
const { encryption, decryption } = require('../configurations/Encryption');
const AuthSecretModel = require('../models/Auth-Secret.model');
const OTPAuth = require("otpauth");
const { verifyTOTP } = require('../controllers/Account.controller');

exports.protect = asynHandler(async (req, res, next) => {
    let token;
    let source;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
        source = req.headers.source;
    }

    if (!token || !source) {
        let error = await encryption({
            status: false,
            message: "Unauthorize to access this route."
        })
        return res.status(401).send(error)
    }

    try {
        // console.log(token, source);
        if (source == 'user') {
            const decoded = jwt.verify(token, USER_TOKEN_KEY);
            // console.log(decoded);
            let user = await Account.findOne({ _id: decoded._id }).populate(['user', 'company'])
            let authUser = await AuthUser.findOne({ $and: [{ account: user._id }, { token }] })
            if (user && authUser) {
                // let lt = await LoginToken.findOne({ token: token })
                req.user_role = 'user';
                req.user = user;
                next();
            } else {
                let error = await encryption({
                    status: false,
                    message: "Unauthorize to access this route."
                })
                return res.status(401).send(error)
            }
        } else if (source == 'administer') {
            const decoded = jwt.verify(token, ADMIN_TOKEN_KEY);
            // console.log(decoded);
            let user = await Admin.findOne({ _id: decoded._id }, { _id: true });
            if (user) {

                req.user_role = 'admin';
                req.user = user;
                next();
            } else {
                let error = await encryption({
                    status: false,
                    message: "Unauthorize to access this route."
                })
                return res.status(401).send(error)
            }
        }
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Unauthorize to access this route."
        })
        return res.status(401).send(error)
    }
    // console.log(req.user);
});

exports.verifyOtp = asynHandler(async (req, res, next) => {

    let data;
    const user = req.user;

    if (req.body.data) {
        data = await decryption(req.body.data);
    } else {
        data = req.body
    }

    const { token, otp, type } = data;

    if (!token || !otp || !type) {
        let error = await encryption({ status: false, message: "Required fields are missing!" });
        return res.status(400).send(error);
    }

    try {
        const otpTokenKey = 'thisisforotponly'
        const decoded = jwt.verify(token, otpTokenKey);

        // if otp is for sms/email
        if (type === "sms") {
            const lock_duration = 10 * 60 * 1000; // 10 minutes in milliseconds
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

            console.log(decoded, "decoded");
            if (decoded.otp != otp) {

                user.account_locked_count += 1;
                if (user.account_locked_count >= 3) {
                    user.account_locked = true;
                    user.lock_until = new Date(now + lock_duration);
                }
                await user.save();

                let error = await encryption({ status: false, message: "Invalid OTP!" });
                return res.status(400).send(error);
            }
            user.account_locked_count = 0;
            user.lock_until = null;
            await user.save();

            const decodedData = decoded.data;
            req.body = decodedData;
            next();
        } else {
            const user = req.user

            if (!user?.tfa) {
                let error = await encryption({
                    status: false,
                    message: "Authentication not enabled!"
                })

                return res.status(400).send(error)
            }
            let authSecretDetails = await AuthSecretModel.findOne({ account: user._id })
            if (!authSecretDetails) {
                let error = await encryption({
                    status: false,
                    message: "Authentication failed!"
                })
                return res.status(404).send(error)
            }

            const secret = authSecretDetails.value;
            const userProvidedToken = otp;
            const isValid = await verifyTOTP(userProvidedToken, secret);

            if (!isValid) {
                let error = await encryption({
                    status: false,
                    message: "Authentication failed!"
                })
                return res.status(400).send(error)
            } else {
                const decodedData = decoded.data;
                req.body = decodedData;
                next();
            }
        }

    } catch (err) {
        console.log(err);
        let error = await encryption({ status: false, message: "Invalid token!" });
        return res.status(400).send(error);
    }
});

exports.verifyTopupW2WOtp = asynHandler(async (req, res, next) => {

    let data;
    const user = req.user;

    if (req.body.data) {
        data = await decryption(req.body.data);
    } else {
        data = req.body
    }

    console.log(data, "datainsideverifytopupw2wotp")

    const { token, otp } = data.w2w_data.body;

    if (!token || !otp) {
        let error = await encryption({ status: false, message: "Required fields are missing!" });
        return res.status(400).send(error);
    }

    try {
        const otpTokenKey = 'thisisforotponly'
        const decoded = jwt.verify(token, otpTokenKey);

        let validation = false

        if (data.type === "sms") {
            const lock_duration = 10 * 60 * 1000; // 10 minutes in milliseconds
            const now = Date.now();

            validation = true

            // Check if account is locked
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

            console.log(decoded)

            // Validate OTP for SMS
            if (decoded.otp != otp) {
                user.account_locked_count += 1;
                if (user.account_locked_count >= 3) {
                    user.account_locked = true;
                    user.lock_until = new Date(now + lock_duration);
                }
                await user.save();

                let error = await encryption({ status: false, message: "Invalid OTP!" });
                return res.status(400).send(error);
            }

            user.account_locked_count = 0;
            user.lock_until = null;
            await user.save();

        } else if (data.type === "authenticator") {
            validation = true
            // Check for 2FA (authenticator) setup
            if (!user?.tfa) {
                let error = await encryption({
                    status: false,
                    message: "Authentication not enabled!"
                });
                return res.status(400).send(error);
            }

            let authSecretDetails = await AuthSecretModel.findOne({ account: user._id });
            if (!authSecretDetails) {
                let error = await encryption({
                    status: false,
                    message: "Authentication failed!"
                });
                return res.status(404).send(error);
            }

            const secret = authSecretDetails.value;
            const userProvidedToken = otp;
            const isValid = await verifyTOTP(userProvidedToken, secret);

            if (!isValid) {
                let error = await encryption({
                    status: false,
                    message: "Authentication failed!"
                });
                return res.status(400).send(error);
            }
        }

        if (!validation) {
            let error = await encryption({ status: false, message: "Invalid token!!" });
            return res.status(400).send(error);
        }

        // Proceed if OTP is valid
        const decodedData = decoded.data;
        data['w2w_data']['body'] = decodedData
        req.body = data;
        next();

    } catch (err) {
        console.log(err);
        let error = await encryption({ status: false, message: "Invalid token!" });
        return res.status(400).send(error);
    }
});

exports.verifyIntlTopupOtp = asynHandler(async (req, res, next) => {

    let data;
    const user = req.user;

    if (req.body?.data) {
        data = await decryption(req.body.data);
    } else {
        data = req.body
    }

    console.log(data, "data")

    const { token, otp, type, panData } = data;

    if (!token || !otp || !type) {
        let error = await encryption({ status: false, message: "Required fields are missing!" });
        return res.status(400).send(error);
    }

    try {
        const otpTokenKey = 'thisisforotponly'
        console.log("ran here")
        const decoded = jwt.verify(token, otpTokenKey);
        console.log("ran here1")

        // if otp is for sms/email
        if (type === "sms") {
            const lock_duration = 10 * 60 * 1000; // 10 minutes in milliseconds
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

            console.log(decoded, "decoded");
            if (decoded.otp != otp) {

                user.account_locked_count += 1;
                if (user.account_locked_count >= 3) {
                    user.account_locked = true;
                    user.lock_until = new Date(now + lock_duration);
                }
                await user.save();

                let error = await encryption({ status: false, message: "Invalid OTP!" });
                return res.status(400).send(error);
            }
            user.account_locked_count = 0;
            user.lock_until = null;
            await user.save();

            const decodedData = decoded.data;
            req.body = decodedData;
            req.panData = panData
            next();
        } else {
            const user = req.user

            if (!user?.tfa) {
                let error = await encryption({
                    status: false,
                    message: "Authentication not enabled!"
                })

                return res.status(400).send(error)
            }
            let authSecretDetails = await AuthSecretModel.findOne({ account: user._id })
            if (!authSecretDetails) {
                let error = await encryption({
                    status: false,
                    message: "Authentication failed!"
                })
                return res.status(404).send(error)
            }

            const secret = authSecretDetails.value;
            const userProvidedToken = otp;
            const isValid = await verifyTOTP(userProvidedToken, secret);

            if (!isValid) {
                let error = await encryption({
                    status: false,
                    message: "Authentication failed!"
                })
                return res.status(400).send(error)
            } else {
                const decodedData = decoded.data;
                req.body = decodedData;
                req.panData = panData;
                next();
            }
        }

    } catch (err) {
        console.log(err);
        let error = await encryption({ status: false, message: "Invalid token!" });
        return res.status(400).send(error);
    }
});

// Grant access to specific roles
exports.authorize = (roles, emailTemplateName) => {
    return (req, res, next) => {
        console.log(req.user_role, roles)
        if (!roles.includes(req.user_role)) {
            return next(
                new ErrorResponse(
                    `User is not authorized to access this route`,
                    403
                )
            );
        }
        req.emailTemplateName = emailTemplateName;
        next();
    };
};