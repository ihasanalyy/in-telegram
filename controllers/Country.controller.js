const Country = require('../models/Country.model');

const { encryption, decryption } = require('../configurations/Encryption');

module.exports.CountryAddToWhiteList = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        var { country_iso_code, countryName } = data
        if (!countryName || !country_iso_code) {
            let error = await encryption({
                message: "Required fields are empty!",
                status: 404
            });
            res.status(404).send(error);
        } else {
            Country.create({
                country_name: countryName,
                country_iso_code,
                status: 'inactive'
            }).then(async (result) => {
                let data = await encryption({
                    message: "Successfully added to country list",
                    status: 200
                })
                res.status(200).send(data)
            }).catch(async (err) => {
                let error = await encryption({
                    message: "Something went wrong while adding this country!",
                    status: 400,
                    err
                });
                res.status(400).send(error);
            });
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            message: "Internal server error!",
            status: 500,
            err
        });
        res.status(500).send(error);
    }
}

module.exports.getAllActiveCountry = async (req, res) => {
    try {
        Country.find({ $and: [{ status: 'active' }, { $or: [{ delete: { $exists: false } }, { delete: false }] }] }, { country_name: 1, country_iso_code: 1, _id: 1 }).then(async (result) => {
            if (!result || result.length <= 0) {
                let error = await encryption({
                    message: "Your system don't have white list countries!",
                    status: 404
                });
                res.status(404).send(error);
            } else {
                let data = await encryption({
                    message: "countries list.",
                    status: 200,
                    Countries: result
                });
                res.status(200).send(data)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                message: "Something went wrong while getting list countries!",
                status: 400,
                err
            });
            res.status(400).send(error);
        });

    } catch (err) {
        console.log(err);
        let error = await encryption({
            message: "Internal server error!",
            status: 500,
            err
        });
        res.status(500).send(error);
    }
}

module.exports.getAllActiveCountriesPublic = async (req, res) => {
    try {
        Country.find({ $and: [{ status: 'active' }, { $or: [{ delete: { $exists: false } }, { delete: false }] }] }, { country_name: 1, country_iso_code: 1, _id: 1 }).then(async (result) => {
            if (!result || result.length <= 0) {
                let error = await encryption({
                    message: "Your system don't have white list countries!",
                    status: 404
                });
                res.status(404).send(error);
            } else {
                let data = await encryption({
                    message: "countries list.",
                    status: 200,
                    Countries: result
                });
                res.status(200).send(data)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                message: "Something went wrong while getting list countries!",
                status: 400,
                err
            });
            res.status(400).send(error);
        });

    } catch (err) {
        console.log(err);
        let error = await encryption({
            message: "Internal server error!",
            status: 500,
            err
        });
        res.status(500).send(error);
    }
}

module.exports.getAllWhiteListedCountry = async (req, res) => {
    try {
        Country.find({ $or: [{ delete: { $exists: false } }, { delete: false }] }, { country_name: 1, country_iso_code: 1, _id: 1 }).then(async (result) => {
            if (!result || result.length <= 0) {
                let error = await encryption({
                    message: "Your system don't have white list countries!",
                    status: "404"
                });
                res.status(404).send(error);
            } else {
                let data = await encryption({
                    message: "These are white listed countries",
                    status: true,
                    whiteListedCountries: result
                });
                res.status(200).send(data)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                message: "Something went wrong while finding white list countries!",
                status: "500",
                err
            });
            res.status(400).send(error);
        });

    } catch (err) {
        console.log(err);
        let error = await encryption({
            message: "Internal server error!",
            status: "500",
            err
        });
        res.status(400).send(error);
    }
}

module.exports.getAllReceivingCountry = async (req, res) => {
    try {
        Country.find({ $and: [{ status: 'active', receivingActive: true }, { $or: [{ delete: { $exists: false } }, { delete: false }] }] }, { country_name: 1, country_iso_code: 1, _id: 1 }).then(async (result) => {
            if (!result || result.length <= 0) {
                let error = await encryption({
                    message: "Your system don't have receiving active countries!",
                    status: 404
                });
                res.status(404).send(error);
            } else {
                let data = await encryption({
                    message: "countries list.",
                    status: 200,
                    Countries: result
                });
                res.status(200).send(data)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                message: "Something went wrong while getting list countries!",
                status: 400,
                err
            });
            res.status(400).send(error);
        });

    } catch (err) {
        console.log(err);
        let error = await encryption({
            message: "Internal server error!",
            status: 500,
            err
        });
        res.status(500).send(error);
    }
}

module.exports.getIndividualRegistrationCountries = async (req, res) => {
    try {
        Country.find({ $and: [{ status: 'active', individual_registration_active: true }, { $or: [{ delete: { $exists: false } }, { delete: false }] }] }, { country_name: 1, country_iso_code: 1, _id: 1 }).then(async (result) => {
            if (!result || result.length <= 0) {
                let error = await encryption({
                    message: "No country found!",
                    status: 404
                });
                res.status(404).send(error);
            } else {
                let data = await encryption({
                    message: "countries list.",
                    status: 200,
                    Countries: result
                });
                res.status(200).send(data)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                message: "Something went wrong while getting list countries!",
                status: 400,
                err
            });
            res.status(400).send(error);
        });

    } catch (err) {
        console.log(err);
        let error = await encryption({
            message: "Internal server error!",
            status: 500,
            err
        });
        res.status(500).send(error);
    }
}

module.exports.getBusinessRegistrationCountries = async (req, res) => {
    try {
        Country.find({ $and: [{ status: 'active', business_registration_active: true }, { $or: [{ delete: { $exists: false } }, { delete: false }] }] }, { country_name: 1, country_iso_code: 1, _id: 1 }).then(async (result) => {
            if (!result || result.length <= 0) {
                let error = await encryption({
                    message: "No country found!",
                    status: 404
                });
                res.status(404).send(error);
            } else {
                let data = await encryption({
                    message: "countries list.",
                    status: 200,
                    Countries: result
                });
                res.status(200).send(data)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                message: "Something went wrong while getting list countries!",
                status: 400,
                err
            });
            res.status(400).send(error);
        });

    } catch (err) {
        console.log(err);
        let error = await encryption({
            message: "Internal server error!",
            status: 500,
            err
        });
        res.status(500).send(error);
    }
}

module.exports.updateCountrySettings = async (req, res) => {
    try {
        const countryId = req.params.country_id
        const data = await decryption(req.body.data);
        // const data = req.body
        if (data.country_name || data.country_iso_code || data?.country_name == '' || data?.country_iso_code == '') {
            let error = await encryption({
                message: "Cannot update country!",
                status: false
            });
            return res.status(400).send(error);
        } else {
            Country.findById(countryId).then(async (country) => {
                if (!country) {
                    let error = await encryption({
                        message: "Country not found!",
                        status: false
                    });
                    return res.status(404).send(error);
                } else {
                    Country.findByIdAndUpdate(country._id, data, { new: true }).then(async (result) => {
                        let data = await encryption({
                            message: "Updated successfully!",
                            status: true,
                            countryDetails: result
                        });
                        res.status(200).send(data);
                    }).catch(async (err) => {
                        console.log(err);
                        let error = await encryption({
                            message: "Something went wrong while updating country policy!",
                            status: false,
                            err
                        });
                        res.status(500).send(error);
                    });
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    message: "Something went wrong while finding country!",
                    status: false
                });
                res.status(500).send(error);
            });
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            message: "Internal server error!",
            status: false,
            err
        });
        res.status(500).send(error);
    }
}

module.exports.deleteCountry = async (req, res) => {
    try {
        const countryId = req.params.country_id
        // const data = await decryption(req.body.data);
        // const data = req.body
        if (!countryId) {
            let error = await encryption({
                message: "Cannot delete country!",
                status: false
            });
            return res.status(400).send(error);
        } else {
            Country.findById(countryId).then(async (country) => {
                if (!country) {
                    let error = await encryption({
                        message: "Country not found!",
                        status: false
                    });
                    return res.status(404).send(error);
                } else {
                    Country.findByIdAndUpdate(country._id, { delete: true, delete_time: new Date() }, { new: true }).then(async (result) => {
                        let data = await encryption({
                            message: "Deleted successfully!",
                            status: true
                        });
                        res.status(200).send(data);
                    }).catch(async (err) => {
                        console.log(err);
                        let error = await encryption({
                            message: "Something went wrong while updating country policy!",
                            status: false,
                            err
                        });
                        res.status(500).send(error);
                    });
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    message: "Something went wrong while finding country!",
                    status: false
                });
                res.status(500).send(error);
            });
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            message: "Internal server error!",
            status: false,
            err
        });
        res.status(500).send(error);
    }
}

module.exports.getSpecificCountryDetails = async (req, res) => {
    try {
        // const countryName = req.query.countryName || null;
        const countryId = req.params.country_id || null;
        if (countryId) {
            Country.findById(countryId).then(async (country) => {
                if (!country) {
                    let error = await encryption({
                        message: "Country not found!",
                        status: false
                    });
                    return res.status(404).send(error);
                } else {
                    let sendData = await encryption({
                        message: "Country details!",
                        status: true,
                        data: country
                    });
                    res.status(200).send(sendData);
                }
            }).catch(async (err) => {
                console.log(err)
                let error = await encryption({
                    message: "Something went wrong while finding country!",
                    status: false
                });
                res.status(400).send(error);
            });
        } else {
            let error = await encryption({
                message: "Something is missing!",
                status: false
            });
            res.status(400).send(error);
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            message: "Internal server error!",
            status: false,
            err
        });
        res.status(500).send(error);
    }
}

module.exports.getSpecificCountryDetailsPublic = async (req, res) => {
    try {
        // const countryName = req.query.countryName || null;
        const countryId = req.params.country_id || null;
        if (countryId) {
            Country.findById(countryId).then(async (country) => {
                if (!country) {
                    let error = await encryption({
                        message: "Country not found!",
                        status: false
                    });
                    return res.status(404).send(error);
                } else {
                    let sendData = await encryption({
                        message: "Country details!",
                        status: true,
                        data: country
                    });
                    res.status(200).send(sendData);
                }
            }).catch(async (err) => {
                console.log(err)
                let error = await encryption({
                    message: "Something went wrong while finding country!",
                    status: false
                });
                res.status(400).send(error);
            });
        } else {
            let error = await encryption({
                message: "Something is missing!",
                status: false
            });
            res.status(400).send(error);
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            message: "Internal server error!",
            status: false,
            err
        });
        res.status(500).send(error);
    }
}