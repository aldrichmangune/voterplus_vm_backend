const blindSigs = require('blind-signatures')
const fs = require('fs').promises

const env = process.env.NODE_ENV;

govKey = undefined
myPriv = undefined
async function loadKeys (cb) {
  console.log('started loading the pub key')
  const keyText = await fs.readFile('./keys/pub.pem')
  const pubKey = blindSigs.keyGeneration()
  govKey = pubKey.importKey(keyText, 'pkcs1-public-pem')

  const myKeyText = await fs.readFile('./keys/vm_priv.pem')
  const myPrivKey = blindSigs.keyGeneration()
  myPriv = myPrivKey.importKey(myKeyText, 'pkcs1-private-pem')

  console.log('loaded the public key')
  console.log(`N: ${govKey.keyPair.n}`)
  console.log(`E: ${govKey.keyPair.e}`)
  cb()
}

// // generate keys
// const genKey = blindSigs.keyGeneration();
// const PUB_KEY = genKey.exportKey('pkcs1-public-pem')
// const PRIV_KEY = genKey.exportKey('pkcs1-private-pem')
// // write to the file system
// fs.writeFile('vm_pub.pem',PUB_KEY)
// .then(sucess => {
//   log.info('Successfully wrote public key to the file')
// })
// .catch(reason => {
//   log.error("Problem writing public keys to the file")
// })
// fs.writeFile('vm_priv.pem',PRIV_KEY)
// .then(sucess => {
//   log.info('Successfully wrote private key to the file')
// })
// .catch(reason => {
//   log.error("Problem writing private key to the file")
// })


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
        uri: "mongodb://localhost:27017/issues",
        //uri: "mongodb+srv://aldrich:aldrich@voterplus-vm-cnriu.mongodb.net/test?retryWrites=true&w=majority", // MongoDB server
        dbName: "issues",
        collection: "issues"
    },
    keys: {
        govKey: govKey,
        getKey: () => govKey,
        myKey: () => myPriv
        //n: govKey.keyPair.n, 
        //e: govKey.keyPair.e
    },
    vote: {
        getRisLen: () => 10,
    }
}

/* const prod = {
    This will contain production configurations
} */


const config = {
    dev
};

//module.exports = config[env]
module.exports = {
    constants: config[env],
    loadKeys: loadKeys  
}