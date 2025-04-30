const axios = require('axios');
const { encryption, decryption } = require('../configurations/Encryption');
const countryIso3 = require('../utils/countries_iso2.json')
let tokenBody = null;
let lastTokenTime = Date.now();
let lastRefreshTokenTime = Date.now();

module.exports.getDetailsBySwiftCode = async (req, res) => {
    try {
        let bic = req.params.bic
        let token = await getToken();
        if (token) {
            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            }
            let validityUrl = `${process.env.SWIFT_API_URL}/bics/${bic}/validity`
            axios.get(validityUrl, config).then(async (bicValidity) => {
                if (bicValidity.data.bic) {
                    let bicDetailsUrl = `${process.env.SWIFT_API_URL}/bics/${bic}`
                    axios.get(bicDetailsUrl, config).then(async (bicDetails) => {
                        if (bicDetails.data) {
                            console.log(bicDetails.data);
                            let countryIso2 = bicDetails.data?.structured_address?.country_code

                            let countryIso3Code = Object.keys(countryIso3).find(key => countryIso3[key] === countryIso2)

                            if (countryIso3Code && bicDetails.data?.structured_address) {
                                bicDetails.data.structured_address.country_code = countryIso3Code;
                                bicDetails.data.structured_address.country_code_iso2 = countryIso2;
                            }

                            console.log({ countryIso3Code, keys: Object.keys(countryIso3) });
                            let ciphertext = await encryption({
                                status: true,
                                message: "Bic details.",
                                bicDetails: bicDetails.data
                            })
                            res.status(200).send(ciphertext)
                        } else {
                            let error = await encryption({
                                status: false,
                                message: "Unknown Error."
                            })
                            res.status(400).send(error)
                        }
                    }).catch(async (err) => {
                        let error = await encryption({
                            status: false,
                            message: err?.response?.data?.errors?.user_message,
                            error: err?.response?.data
                        })
                        res.status(400).send(error)
                    })
                } else {
                    let error = await encryption({
                        status: false,
                        message: "Unknown Error."
                    })
                    res.status(400).send(error)
                }
            }).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: err?.response?.data?.errors?.user_message,
                    error: err?.response?.data
                })
                res.status(400).send(error)
            })
        } else {
            let error = await encryption({
                status: false,
                message: "Invalid token!"
            })
            res.status(400).send(error)
        }
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.getDetailsByIban = async (req, res) => {
    try {
        let iban = req.params.iban
        let token = await getToken();
        if (token) {
            const config = {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            }
            let validityUrl = `${process.env.SWIFT_API_URL}/ibans/${iban}/validity`
            axios.get(validityUrl, config).then(async (ibanValidity) => {
                if (ibanValidity.data.iban) {
                    let ibanDetailsUrl = `${process.env.SWIFT_API_URL}/ibans/${iban}`
                    axios.get(ibanDetailsUrl, config).then(async (ibanDetails) => {
                        if (ibanDetails.data.iban) {
                            let ibanBicUrl = `${process.env.SWIFT_API_URL}/ibans/${iban}/bic`
                            axios.get(ibanBicUrl, config).then(async (ibanBic) => {
                                if (ibanBic.data.bic) {
                                    let bicDetailsUrl = `${process.env.SWIFT_API_URL}/bics/${ibanBic.data.bic}`
                                    axios.get(bicDetailsUrl, config).then(async (bicDetails) => {
                                        if (bicDetails.data.bic) {
                                            console.log(ibanValidity.data,
                                                ibanBic.data)
                                            let countryIso2 = bicDetails.data?.structured_address?.country_code

                                            let countryIso3Code = Object.keys(countryIso3).find(key => countryIso3[key] === countryIso2)

                                            if (countryIso3Code && bicDetails.data?.structured_address) {
                                                bicDetails.data.structured_address.country_code = countryIso3Code;
                                                bicDetails.data.structured_address.country_code_iso2 = countryIso2;
                                            }

                                            console.log({ countryIso3Code, keys: Object.keys(countryIso3) });
                                            let ciphertext = await encryption({
                                                status: true,
                                                message: "iban details.",
                                                bicDetails: bicDetails.data,
                                                ibanDetails: ibanDetails.data,

                                            })
                                            res.status(200).send(ciphertext)
                                        } else {
                                            let error = await encryption({
                                                status: false,
                                                message: "Unknown Error."
                                            })
                                            res.status(400).send(error)
                                        }
                                    }).catch(async (err) => {
                                        console.log(err)
                                        let error = await encryption({
                                            status: false,
                                            message: err?.response?.data?.errors?.user_message,
                                            error: err?.response?.data
                                        })
                                        res.status(400).send(error)
                                    })
                                } else {
                                    let error = await encryption({
                                        status: false,
                                        message: "Unknown Error."
                                    })
                                    res.status(400).send(error)
                                }
                            }).catch(async (err) => {
                                console.log(err)
                                let error = await encryption({
                                    status: false,
                                    message: err?.response?.data?.errors?.user_message,
                                    error: err?.response?.data
                                })
                                res.status(400).send(error)
                            })
                        } else {
                            let error = await encryption({
                                status: false,
                                message: "Unknown Error."
                            })
                            res.status(400).send(error)
                        }
                    }).catch(async (err) => {
                        console.log(err)
                        let error = await encryption({
                            status: false,
                            message: err?.response?.data?.errors?.user_message,
                            error: err?.response?.data
                        })
                        res.status(400).send(error)
                    })
                } else {
                    let error = await encryption({
                        status: false,
                        message: "Unknown Error."
                    })
                    res.status(400).send(error)
                }
            }).catch(async (err) => {
                console.log(err)
                let error = await encryption({
                    status: false,
                    message: err?.response?.data?.errors?.user_message,
                    error: err?.response?.data
                })
                res.status(400).send(error)
            })
        } else {
            let error = await encryption({
                status: false,
                message: "Invalid token!"
            })
            res.status(400).send(error)
        }
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

async function getToken() {
    let time = Date.now();
    try {
        const config = {
            headers: {
                'Authorization': `Basic ${Buffer.from(`${process.env.SWIFT_CONSUMER_KEY}:${process.env.SWIFT_CONSUMER_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
        if (tokenBody == null) {
            const params = new URLSearchParams();
            params.append('username', 'sandbox-id');
            params.append('password', 'sandbox-key');
            params.append('grant_type', 'password');

            tokenBody = await axios.post(`${process.env.SWIFT_TOKEN_API_URL}`, params, config)
            tokenBody = tokenBody.data;
            lastTokenTime = Date.now()
            lastRefreshTokenTime = lastTokenTime;
            return tokenBody.access_token
        } else {
            let refreshTokenDiff = (time - lastRefreshTokenTime) / 1000;
            if (refreshTokenDiff > (tokenBody.refresh_token_expires_in - 10)) {
                const params = new URLSearchParams();
                params.append('username', 'sandbox-id');
                params.append('password', 'sandbox-key');
                params.append('grant_type', 'password');

                tokenBody = await axios.post(`${process.env.SWIFT_TOKEN_API_URL}`, params, config)
                tokenBody = tokenBody.data;
                lastTokenTime = Date.now()
                lastRefreshTokenTime = lastTokenTime;
                return tokenBody.access_token
            } else {
                let tokenDiff = (time - lastTokenTime) / 1000;
                if (tokenDiff > (tokenBody.expires_in - 10)) {
                    const params = new URLSearchParams();
                    params.append('refresh_token', token.refresh_token);
                    params.append('grant_type', 'refresh_token');

                    tokenBody = await axios.post(`${process.env.SWIFT_TOKEN_API_URL}`, params, config)
                    tokenBody = tokenBody.data;
                    lastTokenTime = Date.now();
                    return tokenBody.access_token
                } else {
                    return tokenBody.access_token
                }
            }
        }
    } catch (err) {
        tokenBody = null
        return null
    }

}
