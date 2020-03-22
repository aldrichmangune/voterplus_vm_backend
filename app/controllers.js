const config = require('./config');
const blindSigs = require('blind-signatures')
const db = require('./db')
const Vote = require('./Vote').Vote
const constants = config.constants;
const utils = require('./utils.js');

function verifyVote(socket){
    //console.log(`Socketid:${socket.id}. Received ${args}`);
    const govKey = constants.keys.getKey();
    const myKey = constants.keys.myKey();

    return async ({signature, rtv, issue, choice}) => {
        //console.log({signature, rtv, issue, choice})

        let {guid:parsed_guid, issue:parsed_issue, idenHashes:parsed_idenHashes} = Vote.parseVote(rtv);
        socket.vote_id = parsed_guid;
        // socket.issue = parsed_issue;
        // socket.choice = choice;
        // socket.signature = signature;
        // socket.rtv = rtv;

        // Verify Governmint signature
        // console.log(parsed_guid, parsed_issue, parsed_idenHashes)
        console.log("Signature: ",signature)
        console.log("RTV: ", rtv)
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
        if(!db_issue.options.includes(choice)) {
            console.log(`Choice is not valid. Vote ${parsed_guid} is not casted to an existing candidate.`);
            return undefined;
        } 

        // Attach the listener after verifying the vote, ensuring order
        socket.on('get_ris_response', async (data) => {
            // Check for duplicates from socket.vote_id
            // [0] = Left [1] = Right
            console.log("Checking if vote guid exists in database (duplicate)")
            let existing_vote = await db.findDuplicate(parsed_issue, parsed_guid)
            
            // If there is an existing vote, identify the cheater
            if (existing_vote){
                // console.log(existing_vote)
                console.log("Vote exists in database")
                return undefined
                // TODO Test reveal Cheater
                // var identityString = "IDENTITY STRING"
                // utils.revealCheater(existing_vote.ris, data, //identity string)
            }
            console.log("Adding vote")
            
            // Add vote to database
            db.submitVote(parsed_issue, parsed_guid, data, choice, signature, rtv);
            
            // TODO generate proper strings for vote receipts
            receipt = {
                receiptNum: `VR-123456789`, // Random string
                voteGuid: socket.vote_id,
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
            console.log("Receipt:", receipt)
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
    }
}

async function sendVotes(req, res, next){
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
            receiptNum: "VR-123456789" // TODO Retrieve receipt number from db
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
}

module.exports = {
    verifyVote
}