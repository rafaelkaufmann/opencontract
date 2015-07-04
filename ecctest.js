var crypto = require("crypto");
var eccrypto = require("eccrypto");

async function test() {
// A new random 32-byte private key.
    var privateKey = crypto.randomBytes(32);
// Corresponding uncompressed (65-byte) public key.
    var publicKey = eccrypto.getPublic(privateKey);

    var str = "message to sign";
// Always hash you message to sign!
    var msg = crypto.createHash("sha256").update(str).digest();

//eccrypto.sign(privateKey, msg).then(function(sig) {
//    console.log("Signature in DER format:", sig);
//    eccrypto.verify(publicKey, msg, sig).then(function() {
//        console.log("Signature is OK");
//    }).catch(function() {
//        console.log("Signature is BAD");
//    });
//});

    let sig = await eccrypto.sign(privateKey, msg);
    console.log(sig);
    let ser = sig.toJSON(),
        sig2 = new Buffer(ser);

    try {
        var verify = await eccrypto.verify(publicKey, msg, sig2);
        console.log(verify);
    } catch (e) {
        console.log(e);
        console.log('Fuuu');
    }
}

test().catch(console.trace.bind(console));