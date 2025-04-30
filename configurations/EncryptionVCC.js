const crypto = require('crypto');

const IV = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F]);

function encryptDataVCC(data) {
    const cipher = crypto.createCipheriv('aes-128-cbc', process.env.VCC_AES_KEY, IV);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
}

function decryptDataVCC(encryptedData) {
    const decipher = crypto.createDecipheriv('aes-128-cbc', process.env.VCC_AES_KEY, IV);
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
}

module.exports = { encryptDataVCC, decryptDataVCC };
