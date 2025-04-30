const { encryption, decryption } = require("../configurations/Encryption");
const AccountModel = require("../models/Account.model");
const UserPaymentPreferenceModel = require("../models/User-Payment-Preference.model");

// Middleware for validation of preferences
module.exports.validatePreferences = async (req, res, next) => {
    const { checks } = await decryption(req.body.data);

    if (!Array.isArray(checks)) {
        const error = await encryption({
            status: false,
            message: "`checks` must be an array",
        });
        return res.status(400).send(error);
    }


    for (const check of checks) {
        if (!check.isoCode || typeof check.isoCode !== "string") {
            const error = await encryption({
                status: false,
                message: "`isoCode` is required and should be a string",
            })
            return res.status(400).send(error);
        }

        if (!Array.isArray(check.reason) || check.reason.some(reason => !['payment_request_live', 'payment_request_origin'].includes(reason))) {
            const error = await encryption({
                status: false,
                message: "`reason` must be an array of 'payment_request_live' or 'payment_request_origin'",
            })
            return res.status(400).send(error);
        }
    }

    next();
};


module.exports.updatePreferences = async (req, res) => {
    try {
        const account_id = req.params.account_id
        // const data = req.body
        const data = await decryption(req.body.data)
        const { checks } = data

        let preferences = await UserPaymentPreferenceModel.findOne({ account: account_id });

        if (!preferences) {
            preferences = new UserPaymentPreferenceModel({
                account: account_id,
            })
        }

        preferences.checks = checks;
        await preferences.save();

        let ciphertext = await encryption({
            status: true,
            message: "Preferences updated successfully",
            data: preferences
        })

        res.status(200).send(ciphertext)

    }
    catch (err) {
        console.log(err)
        const error = await encryption({
            status: false,
            message: "Internal server error",
        })

        res.status(500).send(error)
    }
}

module.exports.getUserPrefernces = async (req, res) => {
    try {
        const { account_id, isoCode } = req.params;
        const account = await AccountModel.findById(account_id);

        const preferences = await UserPaymentPreferenceModel.findOne({ account: account._id })
            .lean()
            .select("checks");

        if (!preferences || !preferences.checks) {
            const error = {
                status: false,
                message: "Preferences not found",
            }
            return res.status(404).json(error);
        }

        const result = preferences.checks
            .filter(check => check.isoCode === isoCode)
            .map(check => ({
                isoCode: check.isoCode,
                reason: check.reason
            }))

        if (result.length === 0) {
            const error = {
                status: false,
                message: "Preferences not found",
            }
            return res.status(404).json(error);
        }

        let ciphertext = await encryption({
            status: true,
            message: "Preferences fetched successfully",
            data: result
        })

        res.status(200).send(ciphertext)
    } catch (err) {
        console.log(err)
        const error = await encryption({
            status: false,
            message: "Internal server error",
        })

        res.status(500).send(error)
    }
}

module.exports.getPreferences = async (req, res) => {
    try {
        const account_id = req.params.account_id

        const preferences = await UserPaymentPreferenceModel.findOne({ account: account_id })

        if (!preferences || !preferences.checks) {
            const error = {
                status: false,
                message: "Preferences not found",
            }
            return res.status(404).json(error);
        }

        let ciphertext = await encryption({
            status: true,
            message: "Preferences fetched successfully",
            data: preferences
        })

        res.status(200).send(ciphertext)
    } catch (err) {
        console.log(err)
        const error = await encryption({
            status: false,
            message: "Internal server error",
        })

        res.status(500).send(error)
    }
}

