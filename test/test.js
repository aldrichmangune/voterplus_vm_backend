var io = require('socket.io-client')
, assert = require('assert')
, should = require('chai').should();

const supertest = require('supertest')
app = require('../app/server')
var request = supertest.agent(app)

const axios = require('axios');
const Vote = require('../app/Vote.js').Vote
//, expect = require('expect.js');

const config = require('../app/config');
const constants = config.constants;

before(function (done) {
	app.on("appStarted", function(){
		done();
	})
})

describe('Suite of unit tests', function() {

	var socket;
	
	describe('Front-end Endpoint tests', async function() {

		
		it('Gets Issues', async (done) =>
		{
			// this.timeout(15000)
			// const app = await require('../app/server')
			// request = supertest(app)

			request
				.get('/issues')
				.expect(res =>
				{
					console.log('Response from get issues', res.body)
				})
				.expect(200)
				.expect('Content-Type', /json/)
				.end(done)
		})
	})

	describe('Governmint communication tests', function(){
		it('Tests sending COMDOM votes to governmint', function() {
			axios.get('https://voterplus-backend-votemachine--hassib.repl.co/issues/COMDOM/submit').then(function(response) {
				//console.log(response.data)
				response.status.should.equal(200)
				//done()
			})
		})
	})

	describe('Vote verification test', function() {
		beforeEach(function(done) {
			// Setup
			socket = io.connect('http://localhost:4000', {
				'reconnection delay' : 0
				, 'reopen delay' : 0
				, 'force new connection' : true
			});
			socket.on('connect', function() {
				console.log('worked...');
				done();
			});
			socket.on('disconnect', function() {
				console.log('disconnected...');
			})
		});

		afterEach(function(done) {
			// Cleanup
			if(socket.connected) {
				console.log('disconnecting...');
				socket.disconnect();
			} else {
				// There will not be a connection unless you have done() in beforeEach, socket.on('connect'...)
				console.log('no connection to break...');
			}
			done();
		});

		const vote = "This is one voting right for:COMDOM,E,N,61fcceefaa55cae60f54aa404037b6c583165e93e0768cac4518f12f224146df3512d3b49607befeca944b7c81b0436e,59f32b948f9d0a3dba5d64c527053ed9b9d810d852e0af30fee0f142d953c1d3-3ea34f3bbd4c6fb189ee43f2228796126f3657910118329ecdbc2e3bd2f6c753-39787d76126728bf593e74eec263f45e89182046b2f8447ff340e19494c3985d-c66184a7700b296bd8c092b06ed2fc02f5fda2a2c2e93ba00e99c9b958f7ef7e-90611d8ad7f1f5b7e9f0a785b34b33d8559baff8b2d5483f8b8d8707336fca2c-7746f7e149bfbab0c6f536eceb51a38bdaca7c3932160af94890b749e14682cd-afbdc15b301298898cbe71317c0e3444bed8b369539c8c194aec69fc905a7065-4bfe704aaf78a2ef0d5b007a279fd4a1a5498cc4ed450a980e3648ca75c96044-ecbde53c3da76508e26ca3c61fb4c7a60bd913971122a90d966f79fabdab605a-82795b7be1ce4f3d75fb3eb3065119d7b0eb0d665c90245645d1be15aacd574d,ef03717603a3e869798be433d1a1181d7cc59d6cec18a3216c46f6be3e3b5043-25a50e3bc8a3e0a931182a44e6eee2e721f2e193baa692c639bae3a4cac7da58-f96a1c16322e2e8756d7b511359329f4deee4031a80abbe77f47c151b4663f51-9faf67a9984c404a25b483a2e8938bdf4ee9097cc4eaff8c4e80ff46d8d9e978-654102450ae496aed70483fb4af81817dc2d20ab3b883ef45d4e454a7650d196-7cfd3ee2157c54fa87eb9af48a45203005b8afcd1481b757cd0b8dea1c5fccd9-f68b6b77137de4bc868856548822c722b3adbc288ca37192976a6b1b019036d5-1e171886f6b331d0c1c84d35c055b63d40b5a04f3a3e2dbd17cd73b3e6a200bc-3523bec72ddf498d39cb374b2683d0dc579115923c2cac3687fc20b2bdcd350f-988f8bccfe6c50971876c01047bda1c1af165c9971a889ed61e3c490f2e2d63b|735908736525937731878420862269480912586476265879509466354118554117157806883176415752934336493094892735133457182628025238323088587430898485707594071973681946610866555629333223896721381586267546603743802344011842455303670975307375830998650374544892749682446767589204299281630046085134009136482100839234636600800124495695771242405823027936451177702669878661295751202635435585546877560794971693295525862974228994610476234816412046725691755364764510481823579367542880345486428901246994912951013817325757995967911634960891455425137521687495124063019121496789954413455975402097678795241949201104980144341636381489406867131"
		const [ rtv, signature ] = vote.split('|');
		const constructedRisArray = []

		it('Testing Verify Vote', function(done) {
			socket.emit('vote', {issue:'COMDOM', choice:'optiona', rtv:rtv,signature: signature })
			socket.on('get_ris', ({ ris_req, error: rtvError = undefined }) => {
					ris_req.should.be.an('array')

					let { guid, issue: voteIssue, E: voteE, N: voteN, idenHashes: [ leftHash, rightHash ] } = Vote.parseVote(rtv);
					let currentVote = new Vote(null, null, null, null, signature, rtv, leftHash, rightHash);

					for (let i in ris_req) {
						let tempRis = currentVote.getRis(ris_req[i], i);        
						constructedRisArray.push(tempRis);
					}
					socket.emit('get_ris_response', constructedRisArray);
					socket.on('receipt', ({ receipt, error: receiptError = null }) => {
						// if (!!receiptError) {
						// handleError(socket, 'receipt', receiptError);
						// return;
						// }
						// console.log(receipt)
						// socket.off('receipt');
						receipt.receiptNum.should.equal('VR-123456789');
						done()
					});
				})
			})
		});
});