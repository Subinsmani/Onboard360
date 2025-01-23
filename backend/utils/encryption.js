const crypto = require('crypto');
require('dotenv').config();

const algorithm = 'aes-256-cbc';

// Ensure the encryption key is exactly 32 bytes
const secretKey = process.env.ENCRYPTION_KEY;
if (!secretKey || secretKey.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be exactly 32 characters long (256 bits)");
}

// IV should be exactly 16 bytes (128 bits)
const generateIV = () => crypto.randomBytes(16);

// **🔹 Encrypt Password Before Storing**
const encryptPassword = (password) => {
    const iv = generateIV();
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey, 'utf-8'), iv);
    let encrypted = cipher.update(password, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
};

// **🔹 Decrypt Password for LDAP Sync**
const decryptPassword = (encryptedPassword) => {
    try {
        const parts = encryptedPassword.split(':');
        if (parts.length !== 2) throw new Error("Invalid encrypted password format");

        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');

        const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey, 'utf-8'), iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf-8');
        decrypted += decipher.final('utf-8');
        
        return decrypted;
    } catch (error) {
        console.error("Error decrypting password:", error);
        return null;
    }
};

module.exports = { encryptPassword, decryptPassword };
