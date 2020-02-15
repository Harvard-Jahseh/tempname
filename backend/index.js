require('dotenv').config();

const express = require("express");
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const jwt = require('jsonwebtoken');
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json())

var knex = require('knex')({
  client: 'pg',
  connection: process.env.DB_CONNECTION
});

// initialize tables
knex.schema.hasTable('users').then(function(exists){
  if(!exists) knex.schema.createTable('users', function(table){
    table.increments('id');
    table.string('email');
    table.string('password');
  })
  .then(function(){
    console.log("Successfully created 'users' table");
  });
});

var verifyToken = function(req, res, next){
  var token = req.headers['x-access-token'];
  if (!token) return res.status(401).send({ auth: false, message: 'No token provided.' });
  jwt.verify(token, process.env.JWT_SECRET, function(err, decoded) {
    if (err) return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
    knex.from("users")
      .select("id", "email")
      .where("email", decoded.id)
      .then(function(result){
        if(!result) return res.status(404).send("No user found.");
        else {
          req.user = result;
          next();
        }
      })
      .catch(function(){
        return res.status(500).send("There was a problem finding the user.");
      });
  });
};

//ROUTING

//User routing
app.post("/signup", function(req, res) {
  create user, assign token, and send them to app
  with help from link in verifyToken
  knex("users").select("*").where("email", req.body.email).then((response) => {
    if (!response.length){
      knex("users").insert({
        email: req.body['email'],
        password: bcrypt.hashSync(req.body.password)
      }).then(function() {
        var token = jwt.sign({ id: req.body.email }, process.env.JWT_SECRET);
        res.status(200).send({ auth: true, token: token });
      })
    } else {
      return res.status(500).send({ auth: 'false', error: 'That email is already taken'});
    }
  })
  res.send(req.body);
})

app.post('/login', function(req, res, next) {
  // find user from table, assign token, then send them to app
  // with help from link in verifyToken
  knex("users").select("*").where("email", req.body.email)
  .then(function(response){
    if(bcrypt.compareSync(req.body.password, response[0].password)){
      var token = jwt.sign({ id: req.body.email }, process.env.JWT_SECRET);
      res.status(200).send({ auth: true, token: token });
    }
    else return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
  });
});

//gets details of current user
app.get("/user/current", verifyToken, function(req, res, next) {
  res.status(200).send(req.user)
})

app.get("/users/", function(req, res) {
  knex.from("users").select("*").then(function(results){
    res.json(results);
  })
})

app.get("/users/:id", function(req, res) {
  knex.from("users").where("id", req.params.id).then(function(results){
    res.json(results);
  })
})


app.listen(process.env.PORT || 3000, function(){
  console.log("Listening on port " + (process.env.PORT || 3000));
});
