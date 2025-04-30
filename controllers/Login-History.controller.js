const Account = require('../models/Account.model');
const LoginHistory = require('../models/Login-History.model');
const { encryption, decryption } = require('../configurations/Encryption');


const createLoginHistory = async (req, res) => {
    try {
        let { browser_name, browser_version, is_mobile_user, IPv4, city, country_code, country_name, latitude, longitude, postal, state, platform, accountId } = await decryption(req.body.data)
        if (!accountId) {
            let error = await encryption({
                status: false,
                message: "Required field are empty!"
            })
            return res.status(400).send(error)
        } else {
            Account.findById(accountId, { _id: true }).then(async (acountFound) => {
                if (!acountFound) {
                    let error = await encryption({
                        status: false,
                        message: "User not found!"
                    })
                    return res.status(404).send(error)
                } else {
                    let createObj = {
                        browser_name: browser_name ? browser_name : '',
                        browser_version: browser_version ? browser_version : '',
                        is_mobile_user: is_mobile_user ? JSON.parse(is_mobile_user) : false,
                        location: {
                            IPv4: IPv4 ? IPv4 : '',
                            city: city ? city : '',
                            country_code: country_code ? country_code : '',
                            country_name: country_name ? country_name : '',
                            latitude: latitude ? latitude.toString() : '',
                            longitude: longitude ? longitude.toString() : '',
                            postal: postal ? postal.toString() : '',
                            state: state ? state : ''
                        },
                        platform: platform ? platform : '',
                        account: acountFound._id
                    }
                    LoginHistory.create(createObj).then(async (historyCreated) => {
                        let error = await encryption({
                            status: true,
                            message: "Login history added!"
                        })
                        return res.status(200).send(error)
                    }).catch(async (err) => {
                        console.log(err);
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while creating history!"
                        })
                        return res.status(400).send(error)
                    });
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while finding user account!"
                })
                return res.status(400).send(error)
            });
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

const getLoginHistory = async (req, res) => {
    try {
        const { acountId } = req.params;
        if (!acountId) {
            let error = await encryption({
                status: false,
                message: "Required fields are empty!"
            })
            res.status(400).send(error)
        } else {
            Account.findById(acountId, { _id: true }).then(async (result) => {
                if (!result) {
                    let error = await encryption({
                        status: false,
                        message: "User not found!"
                    })
                    res.status(404).send(error)
                } else {
                    LoginHistory.find({ account: result._id }).then(async (history) => {
                        if (!history || history.length <= 0) {
                            let error = await encryption({
                                status: false,
                                message: "You don't have login history!"
                            })
                            res.status(404).send(error)
                        } else {
                            let error = await encryption({
                                status: true,
                                message: "You don't have login history!",
                                history
                            })
                            res.status(200).send(error)
                        }
                    }).catch(async (err) => {
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while finding history!"
                        })
                        res.status(400).send(error)
                    });
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while finding user!"
                })
                res.status(400).send(error)
            });
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
module.exports = {
    createLoginHistory,
    getLoginHistory
}