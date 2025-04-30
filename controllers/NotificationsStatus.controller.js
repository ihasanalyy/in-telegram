const Account = require('../models/Account.model');
const Notifications = require('../models/NotificationsStatus.model');

const { encryption, decryption } = require('../configurations/Encryption');

module.exports.updateNotificationsStatus = async (req, res) => {
    try {
        const data = await decryption(req.body.data)
        const account_id = req.params.account_id;
        const {
            payments,
            bulk_payments,
            payment_requests,
            add_funds,
            quotation,
            referrals,
            login
        } = data;

        if (!payments ||
            !bulk_payments ||
            !payment_requests ||
            !add_funds ||
            !login ||
            !quotation ||
            !referrals) {
            let error = await encryption({
                status: false,
                message: "required fields are empty."
            });
            return res.status(400).send(error);
        }

        console.log(data)

        const account = await Account.findById(account_id);

        if (!account) {
            let error = await encryption({
                status: false,
                message: 'Account not found!',
            });
            return res.status(404).send(error);
        }

        const updateObj = {
            payments,
            bulk_payments,
            payment_requests,
            add_funds,
            quotation,
            referrals,
            login
        };

        const updatedNotifications = await Notifications.findOneAndUpdate(
            { account: account_id },
            updateObj,
            { new: true, upsert: true }
        );

        let ciphertext = await encryption({
            status: true,
            message: 'Notification settings updated successfully!',
            data: updatedNotifications,
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
}

module.exports.getNotificationsStatus = async (req, res) => {
    try {
        const account_id = req.params.account_id;
        const account = await Account.findById(account_id);

        if (!account) {
            let error = await encryption({
                status: false,
                message: 'Account not found!',
            });
            return res.status(404).send(error);
        } else {
            Notifications.findOne({ account: account_id }).then(async (notifications) => {
                if (notifications) {

                    let ciphertext = await encryption({
                        status: true,
                        message: 'Notification found successfully!',
                        notifications,
                    });
                    res.status(200).send(ciphertext);
                } else {
                    let error = await encryption({
                        status: false,
                        message: 'Notifications not found!',
                    });
                    return res.status(404).send(error);
                }
            }).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: 'Something went wrong while getting the notifications!',
                });
                return res.status(500).send(error);
            })
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