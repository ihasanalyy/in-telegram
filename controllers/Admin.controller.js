const Admin = require('../models/Admin.model')
const jwt = require('jsonwebtoken');
const CryptoJS = require("crypto-js");
// const axios = require('axios');
const PASSWORD_ENCRYPTION_KEY = 'secretOfTheInstaPaySystemAdminPassword'
const TOKEN_KEY = 'secretOfTheInstaPaySystemAdminAccountTOKEN'
var Hashids = require('hashids');

const AccountLevel = require('../models/Account-Level.model');
const Wallet = require('../models/Wallet.model');
const Account = require('../models/Account.model');
const User = require('../models/User.model');
const Company = require('../models/Company.model');

const { encryption, decryption } = require('../configurations/Encryption');

module.exports.setAdmin = async (req, res) => {
    try {
        // let data = req.body
        let data = await decryption(req.body.data);
        var { name, email, phone, role, password, status } = data
        let obj = { name, email, phone, role, password, status }
        if (!name || !email || !phone || !role.length || !password || !status) {
            let error = await encryption({
                status: false,
                message: "Required field are missing"
            })
            return res.status(400).send(error);
        }
        if (role.find(rl => rl == "superadmin")) {
            let error = await encryption({
                status: false,
                message: "Invalid admin role."
            })
            return res.status(400).send(error);
        }
        obj['password'] = CryptoJS.AES.encrypt(obj.password, PASSWORD_ENCRYPTION_KEY).toString();
        obj['email'] = obj.email.toLowerCase();
        Admin.findOne({ email: obj.email }).then(async (adminFound) => {
            if (!adminFound) {
                Admin.create(obj).then(async (admin) => {
                    // res.status(200).send(admin);
                    let resObj = {
                        status: true,
                        message: "Admin account created successfully",
                        admin: admin
                    }
                    var ciphertext = await encryption(resObj)
                    res.status(200).send(ciphertext)
                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Admin not created."
                    })
                    res.status(400).send(error)
                })
            } else {
                let error = await encryption({
                    status: false,
                    message: "Email already exist!"
                })
                res.status(400).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while creating admin."
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

module.exports.getAdminDetails = (req, res) => {
    try {
        let admin_id = req.params.admin_id
        Admin.findOne({ _id: admin_id })
            .then(async (adm) => {
                let resObj = {
                    status: true,
                    message: "Admin account created successfully",
                    adminList: adm
                }
                var ciphertext = await encryption(resObj)
                res.status(200).send(ciphertext)
            })
            .catch(err => {
                res.status(500).send(err)
            })
    } catch (err) {
        res.status(500).send({
            message: "Internal server error!",
            status: "500",
            err
        })
    }
}

module.exports.getAdmin = async (req, res) => {
    try {
        Admin.find().then(async (adm) => {
            if (adm.length) {
                let resObj = {
                    status: true,
                    message: "Admin account created successfully.",
                    adminList: adm
                }
                var ciphertext = await encryption(resObj)
                res.status(200).send(ciphertext)
            } else {
                let resObj = {
                    status: false,
                    message: "No admin found.",
                    adminList: []
                }
                var ciphertext = await encryption(resObj)
                res.status(404).send(ciphertext)
            }
        }).catch(async (err) => {
            var error = await encryption({
                status: false,
                message: "Something went wrong while getting admin list.",
            });
            res.status(400).send(error);
        })
    } catch (err) {
        var error = await encryption({
            message: "Internal server error!",
            status: "500",
            err
        });
        res.status(400).send(error);
    }
}

module.exports.updateAdmin = async (req, res) => {
    try {
        // let data = req.body
        let data = await decryption(req.body.data)
        var { name, phone, role, status } = data
        let obj = { name, phone, role, status };
        let admin_id = req.params.admin_id

        Admin.findByIdAndUpdate({ _id: admin_id }, obj, { new: true }).then(async (adm) => {
            let resObj = {
                status: true,
                message: "Admin updated successfully.",
                admin: adm
            }
            var ciphertext = await encryption(resObj);
            res.status(200).send(ciphertext);
        }).catch(async (err) => {
            var error = await encryption({
                status: false,
                message: "Something went wrong while updating admin details.",
            });
            res.status(400).send(error);
        })
    } catch (err) {
        var error = await encryption({
            message: "Internal server error!",
            status: "500",
            err
        });
        res.status(400).send(error);
    }
}

module.exports.deleteAdmin = async (req, res) => {
    try {
        admin_id = req.params.admin_id
        Admin.findByIdAndRemove({ _id: admin_id })
            .then(async (adm) => {
                let resObj = {
                    status: true,
                    message: "Admin deleted successfully.",
                    admin: adm
                }
                var ciphertext = await encryption(resObj);
                res.status(200).send(ciphertext);
            })
            .catch(async (err) => {
                var error = await encryption({
                    status: false,
                    message: "Something went wrong while deleting admin.",
                });
                res.status(400).send(error);
            })
    } catch (err) {
        var error = await encryption({
            message: "Internal server error!",
            status: "500",
            err
        });
        res.status(400).send(error);
    }
}

module.exports.login = async (req, res) => {
    // let data = await decryption(req.body.data)
    // console.log(data);

    try {
        let data = await decryption(req.body.data)
        // let data = req.body
        // console.log(data);
        var { email, password } = data;
        Admin.findOne({ email: email.toLowerCase() })
            .then(async (user) => {
                if (!user) {
                    var error = await encryption({
                        status: false,
                        message: "Email address not found.",
                    });
                    res.status(404).send(error);
                } else {
                    var bytes = CryptoJS.AES.decrypt(user.password, PASSWORD_ENCRYPTION_KEY);
                    var pass = bytes.toString(CryptoJS.enc.Utf8);
                    if (pass === password) {
                        const JWTToken = jwt.sign(
                            {
                                email: user.email,
                                password: user.password,
                                _id: user._id
                            },
                            TOKEN_KEY,
                            {
                                expiresIn: '1d'
                            }
                        )
                        var ciphertext = await encryption({
                            success: true,
                            token: JWTToken
                        })

                        return res.status(200).send(ciphertext);
                    } else {
                        var error = await encryption({
                            status: false,
                            message: "Incorrect password",
                        });
                        res.status(404).send(error);
                    }
                }
            }).catch(async (error) => {
                console.log(error);
                var error = await encryption({
                    status: false,
                    message: "Something went wrong while finding this email.",
                });
                res.status(400).send(error);
            })
    } catch (err) {
        console.log(err);
        var error = await encryption({
            message: "Internal server error!",
            status: "500",
            err
        });
        res.status(400).send(error);
    }
}

module.exports.currentAdmin = async (req, res) => {
    try {
        jwt.verify(req.params.token, TOKEN_KEY, function (err, payload) {
            if (err) {
                throw new Error('unauthorized admin')
            } else {
                Admin.findOne({ _id: payload._id })
                    .then(async (user) => {
                        if (user?.password == payload.password) {

                            var ciphertext = await encryption({
                                status: true,
                                user
                            })

                            res.status(200).send(ciphertext);
                        } else {
                            var error = await encryption({
                                status: false,
                                message: "Unauthorized!",
                            });
                            res.status(401).send(error)
                        }
                    })
                    .catch(async (error) => {
                        var error = await encryption({
                            status: false,
                            message: "Invalid token!",
                        });
                        res.status(401).send(error);
                    })
            }
        })
    } catch (err) {
        console.log(err);
        var error = await encryption({
            message: "Internal server error!",
            status: "500",
            err
        });
        res.status(400).send(error);
    }
}

