const Waitlist = require('../models/Waitlist.model');

const { encryption, decryption } = require('../configurations/Encryption');
const AdminNotification = require('../models/AdminNotification.model');

module.exports.addToWaitlist = async (req, res) => {
    try {
        // let data = req.body
        let data = await decryption(req.body.data)
        var { first_name, last_name, email, phone, tag, country_name, country_iso_code, country } = data;
        if (!first_name || !last_name || !email || !phone || !tag || !country_name || !country_iso_code || !country) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            })
            return res.status(404).send(error)
        }

        let found = await Waitlist.findOne({ $or: [{ email: email.toLowerCase() }, { phone: phone }] })
        if (found) {
            let error = await encryption({
                status: false,
                message: "This email or phone number already exist!"
            })
            return res.status(400).send(error)
        }
        let obj = { first_name, last_name, email: email.toLowerCase(), phone, tag, country_name, country_iso_code, country };
        Waitlist.create(obj).then(async (wlData) => {
            let resp = await encryption({
                status: true,
                message: "Successfully added to waitlist."
            })
            return res.status(200).send(resp)
        }).catch(async (err) => {
            let resp = await encryption({
                status: true,
                message: "failed!"
            })
            return res.status(400).send(resp)
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}
