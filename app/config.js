const blindSigs = require('blind-signatures')
const fs = require('fs').promises
const NodeRSA = require('node-rsa')

const env = process.env.NODE_ENV;
const envVars = require('dotenv').config({
	path: ('.' + env + 'env')
})

govKey = undefined
myPriv = undefined
async function loadKeys (cb) {
  console.log('started loading the pub key')
  const keyText = await fs.readFile('./keys/pub.pem')
  const pubKey = new NodeRSA()
  govKey = pubKey.importKey(keyText, 'pkcs1-public-pem')
  console.log('loaded Gov public key')
  console.log(`N: ${govKey.keyPair.n}`)
  console.log(`E: ${govKey.keyPair.e}`)

  const myKeyText = await fs.readFile('./keys/vm_priv.pem')
  const myPrivKey = new NodeRSA()
  myPriv = myPrivKey.importKey(myKeyText, 'pkcs1-private-pem')
  cb()
}

const dev = {
    app: {
        port: 4000,
        host: "0.0.0.0",
        supportedIssues: {
            code_name: {
                $in: ["POWERNET", "COMDOM", "SCENTRIC", "ZYTREK", "ICOLOGY"], // Example supported issues on this vm
                //deadline: { $gt: ^-.Current timestmp.-^}
            }
        }
    },
    db: {
        uri: process.env.DB_URI,
        dbName: "issues",
        collection: "issues"
    },
    keys: {
        govKey: govKey,
        getKey: () => govKey,
        myKey: () => myPriv
    },
    vote: {
        getRisLen: () => 10,
    }
}

const stg = {
    app: {
        port: 4000,
        host: "0.0.0.0",
        supportedIssues: {
            code_name: {
                $in: ["POWERNET", "COMDOM", "SCENTRIC", "ZYTREK", "ICOLOGY"], // Example supported issues on this vm
                //deadline: { $gt: Current timestmp}
            }
        }
    },
    db: {
        uri: process.env.DB_URI, // MongoDB server
    },
    keys: {
        govKey: govKey,
        getKey: () => govKey,
        myKey: () => myPriv
    },
    vote: {
        getRisLen: () => 10,
    }
}

/* const prod = {
    This will contain production configurations
} */


const config = {
    dev,
    stg
};

//module.exports = config[env]
module.exports = {
    constants: config[env],
    loadKeys: loadKeys  
}