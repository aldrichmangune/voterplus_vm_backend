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

const vars = {
    app: {
        port: process.env.APP_PORT,
        host: process.env.APP_HOST,
        vmName: process.env.VM_NAME,
        governmintVotesEndpoint: process.env.GOVERNMINT_ENDPOINT,
        supportedIssues: {
            code_name: {
                $in: process.env.SUPPORTED_ISSUES.split(','), // Example supported issues on this vm
                //deadline: { $gt: Current timestmp}
            }
        }
    },
    db: {
        uri: process.env.DB_URI, // MongoDB server
        issuesDB: process.env.DB_ISSUESDB,
        issuesCol: process.env.DB_ISSUESCOL,
        votesDB: process.env.DB_VOTESDB
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

// const config = {
//     vars
// };

//module.exports = config[env]
module.exports = {
    constants: vars,
    loadKeys: loadKeys
}