const AvailableCurrency = require('../models/Available-Currency.model')
const { encryption, decryption } = require('../configurations/Encryption');

module.exports.addCurrencyAdmin = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        const { code, symbol, name } = data;
        if (!code || !symbol || !name) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!",
            });
            return res.status(400).send(error);
        }

        const existingCurrency = await AvailableCurrency.findOne({ code });

        if (existingCurrency) {
            let error = await encryption({
                status: false,
                message: "Currency with this code already exists!",
            });
            return res.status(409).send(error);
        }

        const newCurrency = new AvailableCurrency({
            code, symbol, name
        })

        const savedCurrency = await newCurrency.save();

        if (savedCurrency) {
            let ciphertext = await encryption({
                status: true,
                message: "Currency added successfully!",
                currency: savedCurrency,
            });
            return res.status(201).send(ciphertext);
        } else {
            let error = await encryption({
                status: false,
                message: "Failed to add currency.",
            });
            return res.status(500).send(error);
        }

    } catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error.",
        });
        res.status(500).send(error);
    }
}
module.exports.deleteCurrencyAdmin = async (req, res) => {
    try {
        const { currency_id } = req.params;
        if (!currency_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!",
            });
            return res.status(400).send(error);
        }

        AvailableCurrency.findByIdAndDelete(currency_id).then(async (deletedCurrency) => {
            if (deletedCurrency) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Currency deleted successfully",
                });
                return res.status(200).send(ciphertext);
            } else {
                let error = await encryption({
                    status: false,
                    message: "No currency found to be deleted!",
                });
                return res.status(400).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while deleting currency",
            });
            return res.status(500).send(error);
        })

    } catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error.",
        });
        res.status(500).send(error);
    }
}
module.exports.getAllCurrencies = async (req, res) => {
    try {
        AvailableCurrency.find().then(async (currencies) => {
            if (currencies) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Currencies found!",
                    currencies
                });
                return res.status(200).send(ciphertext);
            } else {
                let error = await encryption({
                    status: false,
                    message: "No currencies found!",
                });
                return res.status(400).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting currencies",
            });
            return res.status(500).send(error);
        })

    } catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error.",
        });
        res.status(500).send(error);
    }
}



