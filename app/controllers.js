const config = require('./config');
const blindSigs = require('blind-signatures')
const db = require('./db')
const Vote = require('./Vote').Vote
const constants = config.constants;
const utils = require('./utils.js');
const { v4: uuidv4 } = require('uuid');

const NodeRSA = require('node-rsa')
const fs = require('fs').promises

function verifyVote(socket){
	const govKey = constants.keys.getKey();
	const myKey = constants.keys.myKey();

	const idenString = "This is one voting right for";
	console.log(idenString)

	return async ({signature, rtv, issue, choice}) => {
		//console.log({signature, rtv, issue, choice})
		
		// Check if valid rtv
		if(!rtv.includes(idenString)){
			let error = new Error(`Did not submit a valid GovernMint issued voting right`)
			console.log(error);
			socket.emit('get_ris', {error: error.message})
			return undefined;
		}

		let {guid:parsed_guid, issue:parsed_issue, idenHashes:parsed_idenHashes} = Vote.parseVote(rtv);
		socket.vote_id = parsed_guid;

		// Verify Governmint signature
		if(!signature){
			let error = new Error(`Vote does not have a Governmint signature`)
			console.log(`vote does not have a Governmint signature`);
			socket.emit('get_ris', {error: error.message})
			return undefined;
		}

		if(!blindSigs.verify({unblinded: signature, N: govKey.keyPair.n, E: govKey.keyPair.e, message: rtv})) {
			let error = new Error(`vote ${parsed_guid} does not have correct governmint signature`)
			console.log(`vote ${parsed_guid} does not have correct governmint signature`);
			socket.emit('get_ris', {error: error.message})
			return undefined;
		}

		// Check if the client issue matches vote issue
		console.log("Governmint signature verified, checking issue");
		if(issue != parsed_issue) {
			let error = new Error(`Vote ${parsed_guid.slice(5)} is for ${parsed_issue} and is being used for the ${issue} issue`)
			console.log(error);
			socket.emit('get_ris', {error: error.message})
			return undefined;
		}

		// Verify choice
		console.log("Issues match, checking if choice matches")
		let db_issue = await db.getIssueWithCode(issue)
		if(!db_issue.options.includes(choice)) {
			let error = new Error(`Option is not valid. Vote ${choice} is not casted to an existing option.`)
			console.log(error);
			socket.emit('get_ris', {error: error.message})
			return undefined;
		} 

		// Attach the listener after verifying the vote, ensuring order
		socket.on('get_ris_response', async (data) => {
			// Check for duplicates from socket.vote_id
			// [0] = Left [1] = Right
			console.log("Checking if vote guid exists in database")
			let existing_vote = await db.findDuplicate(parsed_issue, parsed_guid)
			
			// If there is an existing vote, identify the cheater
			if (existing_vote){
				// console.log(existing_vote)
				let error = new Error("RTV has a recorded vote in database")
				console.log(error)
				var identityString = idenString
				console.log(existing_vote.ris)
				console.log(data)
				try {
					const cheater = utils.revealCheater(existing_vote.ris, data, identityString)
					console.log('Identified cheater:', {cheater})
				}
				catch (error) {
					console.log("RTV has a recorded vote in database: ", error)
				}
				socket.emit('receipt', {error: error.message})
				return undefined
				// TODO Test reveal Cheater

			}
			
			// Generate Receipt
			receipt = {
				receiptNum: uuidv4(), // Random string
				voteGuid: socket.vote_id,
				vm: constants.app.vmName,
				issue: parsed_issue,
				choice: choice,
				timeStamp: Date.now(),      // Change to date added from database
			};

			// Sign receipt
			console.log("Signing")
			receipt.signature = myKey.sign(`${receipt.receiptNum},${receipt.voteGuid},${receipt.vm},${receipt.timeStamp},${receipt.choice}`, 'hex');

			// Use this to verify the signature
			// const pubKeyText = `-----BEGIN RSA PUBLIC KEY-----
			// 										MIIBCgKCAQEAiN19r5yAEWPL64CGbZMaGnlcsRthgNefey3VF5PpUgH8fst4dGQj
			// 										11xRUZZXx0Q3CP/jDwdnQdlR0UBAvORGOdnOi0dQ5lO/p4AEJw/1sThTNUyOMl7B
			// 										TuLVReYn8rOkuvopMHB+IhAZSJcvEK6nNMWJo+D2ZkpF+wqFq+m83VKeJAiyufHQ
			// 										aqpOH8s80hL5epm5QepRbDXCHKr2ixUfSC62M+NMgWO19PxYhawsO6HUb5/itXBp
			// 										AeyomW069U56FTAlvbGNcUECoJE0hOhglBMcah0nqtyNkInUev3aaf/9lfiIL3S5
			// 										N+lRG4sojKk4Bp7lXxIT420bF+tOGG4GUwIDAQAB
			// 										-----END RSA PUBLIC KEY-----`
			// const pubKey = new NodeRSA()
			// pubKey.importKey(pubKeyText, 'pkcs1-public-pem')
			// console.log("testing rsa signature: ", pubKey.verify(`${receipt.receiptNum},${receipt.voteGuid},${receipt.vm},${receipt.timeStamp},${receipt.choice}`, receipt.signature))

			// Add vote to database
			console.log("Adding vote")
			db.submitVote(parsed_issue, parsed_guid, data, choice, signature, rtv, receipt.receiptNum);

			//console.log("Receipt:", receipt)
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
}

module.exports = {
	verifyVote
}