const config = require('./config');
const blindSigs = require('blind-signatures')
const express = require('express');
const Promise = require('promise');
const utils = require('./utils.js');
const cors = require('cors');
const Vote = require('./Vote.js').Vote;

const app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

const port = config.constants.app.port;
const host = config.constants.app.host;

const supportedIssues =  config.constants.app.supportedIssues

const db = require('./db');

const bodyParser = require('body-parser')

console.log("Environment: ", process.env.NODE_ENV);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use(cors());

app.get('/', async (req, res) => {
    res.send({mess:"hello from voting machine"});
    console.log(db.submitVote("test", "test", "test", "test"));
})

io.on('connection', (socket) => {

    console.log('New socket connected', socket.id)
    const govKey = config.constants.keys.getKey();
    const myKey = config.constants.keys.myKey();

    socket.on('vote', async ({signature, rtv, issue, choice}) => {
        //console.log({signature, rtv, issue, choice})

        let {guid:parsed_guid, issue:parsed_issue, idenHashes:parsed_idenHashes} = Vote.parseVote(rtv);
        socket.vote_id = parsed_guid;

        // Verify Governmint signature
        //console.log(parsed_guid, parsed_issue, parsed_idenHashes)
        if(!blindSigs.verify({unblinded: signature, E: govKey.keyPair.e, N: govKey.keyPair.n, message: rtv})) {
            console.log(`vote ${parsed_guid} does not have correct governmint signature`);
            return undefined;
        }

        // Check if the client issue matches vote issue
        console.log("Governmint signature verified, checking issue");
        if(issue != parsed_issue) {
            console.log(`Vote ${parsed_guid.slice(5)} is for ${parsed_issue} and is being used for the ${issue} issue`);
            return undefined;
        }

        // Verify choice
        console.log("Issues match, checking if choice matches")
        let db_issue = await db.getIssueWithCode(issue)
        if(!Object.keys(db_issue.options).includes(choice)) {
            console.log(`Choice is not valid. Vote ${parsed_guid} is not casted to an existing candidate.`);
            return undefined;
        } 

        // attach the listener after receiving the vote first
        // this ensures order
        socket.on('get_ris_response', async (data) => {
            // Check for duplicates from socket.vote_id
            // [0] = Left [1] = Right
            console.log("Checking if vote guid exists in database (duplicate)")
            let existing_vote = await db.findDuplicate(parsed_issue, parsed_guid)
            
            // If there is an existing vote, identify the cheater
            if (existing_vote){
                // console.log(existing_vote)
                console.log("Vote exists in database")
                // var identityString = "IDENTITY STRING"
                // utils.revealCheater(existing_vote.ris, data, //identity string)
            }
            console.log("Adding vote")
            
            // Add vote to database
            db.submitVote(parsed_issue, parsed_guid, data, choice, signature, rtv);

            receipt = {
                receiptNum: `VR-123456789`, // Random string
                voteGuid: parsed_guid,
                vm: 'Test Name change later',
                issue: parsed_issue,
                choice: choice,
                timeStamp: Date.now(),      // Change to date added from database
            };
            // add signature
            console.log("Signing")
            receipt.signature = blindSigs.sign({
                blinded:`${receipt.receiptNum},${receipt.voteGuid},${receipt.vm},${receipt.timeStamp}, ${receipt.choice}`,
                key: myKey
            }).toString();
        	socket.emit('receipt', {receipt})
        })
    
        // Send the left of right options to build ris.
        // [0] = Left [1] = Right
        console.log("Choice matches, constructing ris")
        var ris_req = new Array(config.constants.vote.getRisLen())
        for (var i = 0; i < ris_req.length; i++) {
            ris_req[i] = parseInt(Math.random() * 100) % 2;
        }
    	socket.emit('get_ris', {ris_req});
    })

    // log disconnection
    socket.on('disconnect', () => {
      console.log('socket', socket.id, 'disconnected')
    })
  })

// GET Supported Issues
app.get('/issues', async (req, res) => {
    try {
        //console.log(req)
        let promise = new Promise((resolve, reject) => {
            db.getIssues(supportedIssues).then(data => {
                //console.log(data);
                resolve(data);
            });
        }); 
        let result = await promise;
        console.log("Obtained issues, sending")
        res.json(result);
    } catch (e) {
        console.log(e);
    }   
});

app.post('/issues/:codename/submit', async (req, res) => {
    let issue = req.params.codename;
    let votes = await db.getVotes(issue);
    let count = "count here";
    console.log(issue);
    res.json({issue: issue, count: count, votes: votes})
})

db.connect()
    .then(() => console.log('database connected'))
    .then(config.loadKeys(() => {
        server.listen(port, host, () => console.log(`listening on http://${host}:${port}`))
    }))
    .catch((e) => {
        console.error(e);
        // Always hard exit on a database connection error
        process.exit(1);
    });
