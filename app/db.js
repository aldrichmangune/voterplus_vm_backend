const config = require('./config');
const MongoClient = require('mongodb').MongoClient;
const uri = config.constants.db.uri;

const mongoose = require('mongoose');

//const collectionName = config.constants.db.collection;
const Promise = require('promise');

// Database Names
const dbName = config.constants.db.dbName;
const votes = "votes";

// Collection Names
const issues = "issues";

// MongoClient Connection
let connection = null;

function connect(){
  return new Promise((resolve, reject) => {
    MongoClient.connect(uri, function(err, db) {
      if (err) { reject(err); return; };
      resolve(db);
      connection = db;
    });
  })
}

function submitVote(issue, guid, ris, choice, signature, rtv){
  // Submit vote to votes and Update issues option count
  var vote = {guid: guid, ris: ris, choice: choice, signature: signature, vote_string: rtv, date_added: Date.now()}
  //console.log("Vote to add:", vote)
  var issue_to_update = {code_name: issue}
  var collection = connection.db(votes).collection(issue.toLowerCase());
  var ins_result = collection.insertOne(vote);
  console.log(ins_result);
  if(ins_result){
    collection = connection.db(dbName).collection(issues);
    console.log(issue_to_update, choice)
    collection.updateOne(issue_to_update, {$inc : {vote_count: 1}})
  }
;
}

function getVotes(issue){
  return(new Promise((resolve, reject) => {
    var collection = connection.db(votes).collection(issue.toLowerCase());
    collection.find().toArray().then(res => {
      //console.log(res)
      resolve(res)
    })
  }))
}

async function getIssueWithCode(code_name){
  let query = {code_name: code_name}

  return(new Promise((resolve, reject) => {
      var collection = connection.db(dbName).collection(issues);
      collection.findOne(query).then(res => {
        resolve(res);
      })
    })
  )
}

function findDuplicate(issue, vote_guid){
  let query = {guid: vote_guid}

  return(new Promise((resolve, reject) => {
    var collection = connection.db(votes).collection(issue.toLowerCase());
    collection.findOne(query).then(res => {
      resolve(res)
    })
  }))
}

async function getIssues(query){
  // TODO: Fix options and remove vote_count?
  return(new Promise((resolve, reject) => {
    var collection = connection.db(dbName).collection(issues);
    collection.find(query).toArray().then(results => {
      //console.log(results);
      var fmtRes = [];
      results.forEach((res) => {
        let issue = {
          ...res,
          options: Object.keys(res.options)
        }
        //console.log(issue);    
        fmtRes.push(issue);
      });
      resolve(fmtRes)
    })
  }))
}

module.exports = {
  connect,
  getVotes,
  getIssueWithCode,
  findDuplicate,
  submitVote,
  getIssues
}