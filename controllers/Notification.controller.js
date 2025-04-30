const Account = require('../models/Account.model');
const Notification = require('../models/Notification.model');

const { encryption, decryption } = require('../configurations/Encryption');
const AdminNotification = require('../models/AdminNotification.model');

const moment = require('moment-timezone');
const Country = require('../models/Country.model');

module.exports.getNotificationsReciever = async (req, res) => {
    try {
        const account_id = req.params.account_id;

        if (!account_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).then(async (account) => {
            if (!account) {
                let error = await encryption({
                    status: false,
                    message: "Account not found!"
                });
                res.status(400).send(error);
            } else {
                Notification.find({ to: account_id }).then(async (notification) => {
                    if (notification) {
                        let ciphertext = await encryption({
                            status: true,
                            message: "Notifications found!",
                            notification
                        });
                        res.status(200).send(ciphertext);
                    } else {
                        let error = await encryption({
                            status: false,
                            message: "No notifications found!",
                            notification
                        });
                        res.status(400).send(error);
                    }
                })
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details."
            });
            res.status(400).send(error);
        });
    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.updateNotificationStatus = async (req, res) => {
    try {
        const notification_id = req.params.notification_id;

        if (!notification_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        Notification.findById(notification_id).then(async (notification) => {
            if (!notification) {
                let error = await encryption({
                    status: false,
                    message: "Required fields are missing"
                });
                return res.status(400).send(error);
            } else {
                notification.status = "read";
                notification.save().then(async (savedNotification) => {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Notification status updated successfully",
                        notification: savedNotification
                    });
                    res.status(200).send(ciphertext);
                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while updating notification.."
                    });
                    res.status(400).send(error);
                });
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details."
            });
            res.status(400).send(error);
        });

    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.getNotificationsAdmin = async (req, res) => {
    try {

        AdminNotification.find().then(async (notification) => {
            if (notification) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Notifications found!",
                    notification
                });
                res.status(200).send(ciphertext);
            } else {
                let error = await encryption({
                    status: false,
                    message: "No notifications found!",
                    notification
                });
                res.status(400).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting notification."
            });
            res.status(400).send(error);
        });
    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.updateNotificationStatusAdmin = async (req, res) => {
    try {
        const notification_id = req.params.notification_id;

        if (!notification_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        AdminNotification.findById(notification_id).then(async (notification) => {
            if (!notification) {
                let error = await encryption({
                    status: false,
                    message: "Required fields are missing"
                });
                return res.status(400).send(error);
            } else {
                notification.status = "read";
                notification.save().then(async (savedNotification) => {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Notification status updated successfully",
                        notification: savedNotification
                    });
                    res.status(200).send(ciphertext);
                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while updating notification.."
                    });
                    res.status(400).send(error);
                });
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details."
            });
            res.status(400).send(error);
        });

    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}
