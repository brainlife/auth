#!/usr/bin/node

const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser'); //google auth uses this
const bodyParser = require('body-parser');
const passport = require('passport');
const cors = require('cors');
const nocache = require('nocache');

const config = require('./config');
const db = require('./models');
const common = require('./common');

//prevent startup if config is old
if(config.auth.default_scopes) {
    throw new Error("default_scopes is replaced by default object in config.");
}

const app = express();
app.use(cors());
app.use(nocache());
app.use(bodyParser.json()); //parse application/json
app.use(bodyParser.urlencoded({extended: false})); //parse application/x-www-form-urlencoded //TODO - do we need this?
app.use(cookieParser());
app.use(passport.initialize());//needed for express-based application

app.use('/', require('./controllers'));

//error handling
app.use(function(err, req, res, next) {
    if(typeof err == "string") err = {message: err};
    if(err instanceof Error) err = {message: err.toString()};

    console.error(err);

    if(err.name) switch(err.name) {
    case "UnauthorizedError":
        console.log(req.headers); //dump headers for debugging purpose..
        break;
    }
    if(err.stack) err.stack = "hidden"; //don't sent call stack to UI - for security reason
    res.status(err.status || 500);
    res.json(err);

});

process.on('uncaughtException', function (err) {
    //TODO report this to somewhere!
    console.error((new Date).toUTCString() + ' uncaughtException:', err.message)
    console.error(err.stack)
})

exports.app = app;
exports.start = function(cb) {

    db.init(err=>{
        if(err) throw err;
        console.debug("connected to db");

        common.connectRedis(err=>{
            if(err) throw err;
            console.log("connected to redis");

            common.connectAMQP(err=>{
                if(err) throw err;
                console.debug("connected to amqp");

                var port = process.env.PORT || config.express.port || '8080';
                var host = process.env.HOST || config.express.host || 'localhost';

                app.listen(port, host, function(err) {
                    if(err) return cb(err);

                    console.log("Express server listening on %s:%d", host, port);
                    cb(null);
                });
            });
        });
    });
}


