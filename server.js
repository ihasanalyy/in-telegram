const express = require('express')
const compression = require('compression')
const bodyParser = require('body-parser')
const multer = require("multer");
const mongoose = require('mongoose')
const cors = require('cors');
const dotenv = require('dotenv').config();
const http = require('http');
const https = require('https');
const fs = require("fs");
// const dotenv = require("dotenv").config();
const cron = require('node-cron');
const app = express()
app.use(compression())
const router = require('./routes/index.routes');
const { encryption, decryption } = require('./configurations/Encryption');
// dotenv.config({ path: './config/config.env' });
const Account = require('./models/Account.model');
// const Country = require('./models/Country.model');
// const SecurityQuestion = require('./models/Security-Question.model');
const SecurityQuestion = require('./models/Security-Question.model');
const sanitizeHtml = require('sanitize-html');
const validator = require('validator');
const { checkSchedules } = require('./utils/schedules');
const { cardCountryValidation } = require('./utils/helpers');


let port = process.env.PORT || 3004
mongoose.connect(process.env.MONGO_URI_PROD, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async (data) => {
        console.log('Connected');
        // if (port == 443) {
        await checkSchedules();

        // let i = await cardCountryValidation('4375851116011862', 'PAK')
        // console.log(i);

        // const CryptoJS = require("crypto-js");
        // const PASSWORD_ENCRYPTION_KEY = 'secretOfTheInstaPaySystemAccountPassword'
        // var bytes = await CryptoJS.AES.decrypt('U2FsdGVkX1/2Oc2cOpqpcVGuzpiV4U0ANtPhJ5YIYqQ=', PASSWORD_ENCRYPTION_KEY);
        // var pass = bytes.toString(CryptoJS.enc.Utf8);
        // console.log(pass);

        // Country.updateMany({}, { $set: { kyc_fee: 3.99, kyb_fee: 3.99 } }).then(rs => {
        //     console.log(rs);
        // })
        // }
        // SecurityQuestion.find({}).sort({ language_code: 1 }).then(sql => {
        //     sql.map(sq => {
        //         let i = 1;
        //         sq['question_no'] = i++;
        //         if (i > 9) { i = 1; }
        //     })
        // })
        // Account.updateMany({ account_type: 'individual' }, { $set: { email_verification: false } }).then(r => { console.log(r); })
        // let arr = [];
        // sq.map(sql => {
        //     sql.questions.map(ql => {
        //         let obj = {
        //             question: ql.question,
        //             language: sql.language,
        //             language_code: sql.language_code
        //         }
        //         arr.push(obj);
        //     })
        // })
        // SecurityQuestion.insertMany().then(sqd => {
        //     console.log(sqd);
        // })
    }).catch(err => {
        console.log('Error')
        console.log(err)
    })

// websocket
const { setupSocketIO } = require('./utils/websocket');

const CORS_CONFIG = {
    methods: ["GET", "POST", "PUT", "DELETE"],
    origin: "*",
    // origin: "https://my.insta-pay.ch",
    credential: true
}
app.options("", cors(CORS_CONFIG))
app.use(cors(CORS_CONFIG))

app.use(cors());
app.use(function (req, res, next) {
    // res.header("Access-Control-Allow-Origin", "https://my.insta-pay.ch");
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
app.use(express.json({ limit: '50mb' }))

// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ limit: '50mb' })); 
app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));
app.use(bodyParser.json());
// app.use(sanitizeRequestBody);
// app.use(sanitizeRequestParams);
// app.use(sanitizeQueryParams);


app.use("/api", router);
app.post("/webhook", (req, res) => {
    let body = req.body;

    console.log(`\u{1F7EA} Received webhook:`);
    console.dir(body, { depth: null });
    if (body.object === "page") {
        // Returns a '200 OK' response to all requests
        res.status(200).send("EVENT_RECEIVED");

        // Determine which webhooks were triggered and get sender PSIDs and locale, message content and more.

    } else {
        // Return a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }
})

//Multer error handle here
app.use(async (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            let error = await encryption({
                status: false,
                message: "File is too big."
            });
            return res.status(400).send(error);
        }

        if (error.code === "LIMIT_FILE_COUNT") {
            let error = await encryption({
                status: false,
                message: "File limit exceed."
            });
            return res.status(400).send(error);
        }

        if (error.code === "LIMIT_UNEXPECTED_FILE") {
            let error = await encryption({
                status: false,
                message: "File must be an image."
            });
            return res.status(400).send(error);
        }
    }
});

const server = http.createServer(app);
setupSocketIO(server);





const privateKey = fs.readFileSync('/etc/letsencrypt/live/fontawesomev23.com-0001/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/fontawesomev23.com-0001/cert.pem', 'utf8');
const ca = fs.readFileSync('/etc/letsencrypt/live/fontawesomev23.com-0001/fullchain.pem', 'utf8');
const credentials = {
    key: privateKey,
    cert: certificate,
    ca: ca
};

https.createServer(credentials, app).listen(443, () => {
    console.log('HTTPS Server running on https');
    port = 443;
});

http.createServer((req, res) => {
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
    res.end();
}).listen(8080, () => { port = 8080; });

// server.listen(port, async function () {
//     console.log('Server is running on Port', port);
//     // Example usage
//     const lastDate = getLastDateOfMonth();
//     console.log('Last date of the current month:', lastDate);
// });

function getLastDateOfMonth() {
    // Get the current date
    const currentDate = new Date();

    // Get the year and month of the current date
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // Note: January is 0, so we add 1

    // Calculate the last date of the next month and subtract one day to get the last date of the current month
    const lastDateOfMonth = new Date(year, month, 0).getDate();

    return lastDateOfMonth;
}


function sanitizeRequestBody(req, res, next) {
    if (req.body) {
        // Sanitize the request body recursively
        sanitizeNestedObjects(req.body);
    }
    next();
}

function sanitizeNestedObjects(obj) {
    // Iterate over each key-value pair in the object
    for (const key in obj) {
        if (Object.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            // Check if the value is an object
            if (typeof value === 'object' && value !== null) {
                // Recursively sanitize nested objects
                sanitizeNestedObjects(value);
            } else if (Array.isArray(value)) {
                // If the value is an array, iterate over each element and sanitize
                for (let i = 0; i < value.length; i++) {
                    if (typeof value[i] === 'object' && value[i] !== null) {
                        // Recursively sanitize nested objects in arrays
                        sanitizeNestedObjects(value[i]);
                    } else {
                        // Sanitize non-object values
                        obj[key][i] = sanitizeHtml(value[i]);
                    }
                }
            } else if (typeof value !== 'boolean' && value !== null) {
                // Sanitize non-object values
                obj[key] = sanitizeHtml(value);
            }
        }
    }
}

// function sanitizeObject(obj) {
//   // Check if the input is an object
//   if (typeof obj === 'object' && obj !== null) {
//     // Iterate over each property of the object
//     for (const key in obj) {
//       if (Object.hasOwnProperty.call(obj, key)) {
//         // Check if the property value is an object
//         if (typeof obj[key] === 'object' && obj[key] !== null) {
//           // If it's an object, recursively sanitize it
//           obj[key] = sanitizeObject(obj[key]);
//         } else {
//           // If it's not an object, sanitize the property value
//           const value = obj[key].toString();
//           if (validator.isAlphanumeric(value)) {
//             obj[key] = sanitizeHtml(value);
//           } else {
//             // Handle invalid values or apply custom sanitization rules
//             obj[key] = ''; // Example: Replace invalid values with an empty string
//           }
//         }
//       }
//     }
//   }
//   return obj;
// }

function sanitizeRequestParams(req, res, next) {
    if (req.params) {
        // Validate and sanitize request parameters
        for (const key in req.params) {
            if (Object.hasOwnProperty.call(req.params, key)) {
                const value = req.params[key];
                if (validator.isAlphanumeric(value)) {
                    req.params[key] = sanitizeHtml(value);
                } else {
                    return res.status(400).send('Invalid request parameters');
                }
            }
        }
    }
    next();
}

function sanitizeQueryParams(req, res, next) {
    if (req.query) {
        // Validate and sanitize query parameters
        for (const key in req.query) {
            if (Object.hasOwnProperty.call(req.query, key)) {
                const value = req.query[key];
                if (validator.isAlphanumeric(value)) {
                    req.query[key] = sanitizeHtml(value);
                } else {
                    return res.status(400).send('Invalid query parameters');
                }
            }
        }
    }
    next();
}

