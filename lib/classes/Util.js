let crypto = require('crypto'),
    eccrypto = require('eccrypto');

export class Util {
    static generateKeyPair () {
        let privateKey = crypto.randomBytes(32),
            publicKey = eccrypto.getPublic(privateKey);

        return {privateKey, publicKey};
    }

    static createHash (string, encoding='utf8', hashFunction='sha256') {
        const buffer = new Buffer(string, encoding);
        return crypto.createHash(hashFunction).update(buffer).digest();
    }

    static async sign (privateKey, message) {
        return await eccrypto.sign(privateKey, message);
    }

    static async verify (publicKey, message, signature) {
        return await eccrypto.verify(publicKey, message, signature);
    }
}