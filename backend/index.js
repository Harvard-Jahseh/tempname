require('dotenv').config();

const express = require("express");
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const jwt = require('jsonwebtoken');
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const request = require("request");
const uuidv1 = require("uuid/v1");
const path = require("path");

const app = express();

app.use(express.static(path.join(__dirname,"public")));
app.set('views',__dirname + '/../frontend');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

var knex = require('knex')({
  client: 'pg',
  connection: process.env.DB_CONNECTION
});

knex.schema.dropTable('users');
// initialize tables
knex.schema.hasTable('users').then(function(exists){
  if(!exists) knex.schema.createTable('users', function(table){
    table.increments('id');
    table.string('email');
    table.string('password');
    table.json('profile').nullable();
    table.json('companylist');
  })
  .then(function(){
    console.log("Successfully created 'users' table");
  });
});

knex.schema.hasTable('companies').then(function(exists){
  if(!exists) knex.schema.createTable('companies', function(table){
    table.increments('id');
    table.string('company');
    table.string('password');
    table.string('companykey');
    table.json('userlist');
  })
  .then(function(){
    console.log("Successfully created 'companies' table");
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

app.get('/companysignup', function(req,res){
  res.render('company_register.html');
});

app.get('/companylogin', function(req,res){
  res.render('company_portal.html');
});
//User routing
app.post("/usersignupauth", function(req, res) {
  //create user, assign token, and send them to app
  //with help from link in verifyToken
  knex("users").select("*").where("email", req.body.email).then((response) => {
    if (!response.length){
      let hash = bcrypt.hashSync(req.body.password,10);
      knex("users").insert({
        email: req.body.email,
        password: hash,
        profile: null,
        companylist: JSON.stringify({list:[]})
        /**
        A "companylist" looks like:
        {
          list:
          [
            {companyid: 2, applied_at: Date()},
            {companyid: 4, applied_at: Date()}
          ]
        }
        **/
      }).then(function() {
        var token = jwt.sign({ id: req.body.email }, process.env.JWT_SECRET);
        res.status(200).send({ auth: true, token: token });
      })
    }
  })
})

app.post("/companysignupauth", function(req, res) {
  //create user, assign token, and send them to app
  //with help from link in verifyToken
  knex("companies").select("*").where("company", req.body.company).then((response) => {
    if (!response.length){
      let hash = bcrypt.hashSync(req.body.password,10);
      knex("companies").insert({
        company: req.body.company,
        password: hash,
        companykey: uuidv1(),
        userlist: JSON.stringify({list:[]})
        /**
        A "userlist" looks like:
        {
          list:
          [
            {userid: 2, applied_at: Date()},
            {userid: 4, applied_at: Date()}
          ]
        }
        **/
      }).then(function() {
        var token = jwt.sign({ id: req.body.company }, process.env.JWT_SECRET);
        res.status(200).send({ auth: true, token: token });
      })
    }
  })
})

app.post('/userloginauth', function(req, res, next) {
  // find user from table, assign token, then send them to app
  // with help from link in verifyToken
  console.log(req.body);
  knex("users").select("*").where("email", req.body.email)
  .then(function(response){
    if(bcrypt.compareSync(req.body.password, response[0].password)){
      var token = jwt.sign({ id: req.body.email }, process.env.JWT_SECRET);
      res.status(200).send({ auth: true, token: token });
    }
    else return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
  });
});

app.post('/companyloginauth', function(req, res, next) {
  console.log(req.body);
  knex("companies").select("*").where("company", req.body.company)
  .then(function(response){
    if(bcrypt.compareSync(req.body.password, response[0].password)){
      var token = jwt.sign({ id: req.body.company }, process.env.JWT_SECRET);
      res.status(200).send({ auth: true, token: token });
    }
    else return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
  });
});

app.post('/userapply/s1', function(req, res, next)
{
  //Given a certain companykey, userapply will take user information and add
  //its id to that company's list, should authentication succeed.
  //Stage 1: logging in to provide to companies.
  knex("companies").select("*").where("companykey",req.params['key'])
  .then(function(response){
    res.status(200).send({companyauth: true, key: req.params['key']});
  })
});

app.post('/userapply/s2', function(req, res, next)
{
  //Given a certain companykey, userapply will take user information and add
  //its id to that company's list, should authentication succeed.
  //Stage 2: checking authentication: if it succeeds, add it to the company's database
  knex("companies").select("*").where("companykey",req.params['key'])
  .then(function(companyres){
    knex("users").select("*").where("email",req.body.email)
    .then(function(userres){
      if(bcrypt.compareSync(req.body.password, userres[0].password)){
        var token = jwt.sign({ id: req.body.company }, process.env.JWT_SECRET);
        userlist = userres[0].companylist.toJSON().list;
        console.log(userlist);
        companylist = companyres[0].userlist.toJSON().list;
        console.log(companylist);
        userlist.push(JSON.stringify({companyid: companyres[0].id, applied_at: new Date()}));
        companylist.push(JSON.stringify({userid: userres[0].id, applied_at: new Date()}));
        knex("companies").select("*").where("companykey",req.params['key']).update({userlist: JSON.stringify({list: userlist})});
        knex("users").select("*").where("email",req.body.email).update({companylist: JSON.stringify({list: companylist})});
        res.status(200).send({ auth: true, token: token });
      }else{
        return res.status(500).send({auth: false, message: 'Failed to authenticate token.'});
      }
    });
  })
});
//gets details of current user
app.get("/user/current", verifyToken, function(req, res, next) {
  res.status(200).send(req.user)
});

app.get("/users/", function(req, res) {
  knex.from("users").select("*").then(function(results){
    res.json(results);
  })
});

app.get("/companies/", function(req, res) {
  knex.from("companies").select("*").then(function(results){
    res.json(results);
  })
});

app.get("/users/:id", function(req, res) {
  knex.from("users").where("id", req.params.id).then(function(results){
    res.json(results);
  })
});


app.listen(process.env.PORT || 3000, function(){
  console.log("Listening on port " + (process.env.PORT || 3000));
});
