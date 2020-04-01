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
				vmName: "Development VM",
				governmintHost: "http://voterplus-backend-governmint--hassib.repl.co",
        supportedIssues: {
            code_name: {
                $in: ["POWERNET", "COMDOM", "SCENTRIC", "ZYTREK", "ICOLOGY"], // Example supported issues on this vm
                //deadline: { $gt: ^-.Current timestmp.-^}
            }
        }
    },
    db: {
        uri: process.env.DB_URI,
        issuesDB: "test_issues",
        issuesCol: "issues",
        votesDB: "test_votes"
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
				vmName: "Repl.it VM",
				governmintVotesEndpoint: "https://VoterPlus-backend-governmint--hassib.repl.co/votes",
        supportedIssues: {
            code_name: {
                $in: ["POWERNET", "COMDOM", "SCENTRIC", "ZYTREK", "ICOLOGY"], // Example supported issues on this vm
                //deadline: { $gt: Current timestmp}
            }
        }
    },
    db: {
        uri: process.env.DB_URI, // MongoDB server
				issuesDB: "votemachines",
				issuesCol: "vm-010",
				votesDB: "votes_vm010"
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

const stg2 = {
    app: {
        port: 4000,
        host: "0.0.0.0",
				vmName: "vm-011",
				governmintVotesEndpoint: "https://VoterPlus-backend-governmint--hassib.repl.co/votes",
        supportedIssues: {
            code_name: {
                $in: ["POWERNET", "COMDOM", "SCENTRIC", "ZYTREK", "ICOLOGY"], // Example supported issues on this vm
                //deadline: { $gt: Current timestmp}
            }
        }
    },
    db: {
				issuesDB: "votemachines",
				issuesCol: "vm-011",
				votesDB: "votes_vm011",
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
    stg,
    stg2
};

//module.exports = config[env]
module.exports = {
    constants: config[env],
    loadKeys: loadKeys
}