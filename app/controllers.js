const config = require('./config');
const blindSigs = require('blind-signatures')
const db = require('./db')
const Vote = require('./Vote')
const constants = config.constants;

function verifyVote(socket){
    console.log(`Socketid:${socket.id}. Received ${args}`);

    const {
        issue,
        selection,
        rtv
        } = args
    console.log(issue, selection, rtv);
    }

module.exports = {
    verifyVote
}