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
app.get('/issues', controllers.getVMIssues);

// GET Governmint Issues
app.get('/govIssues', controllers.getGovIssues);

// Endpoint to submit votes to Governmint
app.get('/issues/:codename/submit', controllers.sendVotes);
const serverPromise = new Promise((resolve, reject) => {
	db.connect()
			.then((db) => {
        console.log('DB connected')
        config.loadKeys(() => {
          console.log("keys loaded")
					server.listen(port, host, console.log(`listening on http://${host}:${port}`))
					resolve(server)
        })
      })
			.catch((e) => {
					console.error(e);
          reject(e)
					// Always hard exit on a database connection error
					process.exit(1);
			});

})


    //async function initApp (expApp, httpServer)

module.exports = serverPromise//, config.sqlPoolConfig, config.mongoUrl, config.mongoCollection, config.port, config.on)