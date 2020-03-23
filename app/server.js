const config = require('./config');
const blindSigs = require('blind-signatures')
const express = require('express');
const Promise = require('promise');
const utils = require('./utils.js');
const cors = require('cors');
const controllers = require('./controllers.js');
const Vote = require('./Vote.js').Vote;
const axios = require('axios');

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
})

io.on('connection', (socket) => {

    console.log('New socket connected', socket.id)

    socket.on('vote', controllers.verifyVote(socket))

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
    // TODO look at Hassib's code for supertesting
    let issue = req.params.codename;
    let votes = await db.getVotes(issue.toLowerCase());
    let count = await db.getIssueWithCode(issue);

    console.log("Number of votes:", votes.length)
    console.log("Vote count under issue:", count["vote_count"])
    
    if (votes.length == 0){
        res.status(400).send({err: `No votes to submit for issue ${issue}`})
    }

    let governmint_endpoint = "http://10.42.0.228:4000/votes";

    // Pre-processing of votes
    let preProcessedVotes = []

    for (const vote of votes){
        preProcessedVotes.push({
            guid: vote.guid,
            choice: vote.choice,
            ris: vote.ris,
            voteStr: vote.vote_string,
            signature: vote.signature,
            receiptNum: vote.receipt
        })
    }

    if (res.statusCode == 200){
        axios.post(governmint_endpoint, {
            issue: issue,
            count: count["vote_count"],
            votes: preProcessedVotes
        }).then(function(response) {
            mess = `Got Response Code ${response.status} Message: ${JSON.stringify(response.data)}`
            console.log(mess)
            res.status(200).send({mess})
            //console.log(response.data)
        }).catch(function (error) {
            mess = `Request failed with code ${error.response.status} Message: ${error.response.data.err}`
            console.log(mess);
            res.status(error.response.status).send({mess: `Governmint responded with ${error.response.data.err}`})
        });
    }

    //res.json({issue: issue, count: count["vote_count"], votes: preProcessedVotes})
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
