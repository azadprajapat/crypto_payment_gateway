const EC = require("elliptic").ec, ec = new EC("secp256k1");


for (let index = 0; index < 10; index++) {
    const keyPair = ec.genKeyPair();
    const publicKey = keyPair.getPublic('hex');
    const privateKey = keyPair.getPrivate('hex');

    console.log("keys: ");
    console.log("private: ",privateKey);
    console.log("public: ",publicKey);
    
}