
const fs = require('fs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const uuid = require('node-uuid');
const winston = require('winston');
const amqp = require('amqp');
const os = require('os');

const config = require('./config');
const logger = winston.createLogger(config.logger.winston);

let amqp_conn;
function get_amqp_connection(cb) {
    if(amqp_conn) return cb(null, amqp_conn); //already connected
    logger.debug("connecting to amqp");
    amqp_conn = amqp.createConnection(config.event.amqp, {reconnectBackoffTime: 1000*10});
    amqp_conn.once("ready", ()=>{
        logger.debug("connected to amqp");
        cb(null, amqp_conn);
    });
    amqp_conn.on("error", err=>{
        logger.error(err);
    });
}

let auth_ex;
get_amqp_connection((err, conn)=>{
    if(err) throw err;
    logger.debug("creating auth amqp exchange");
    conn.exchange("auth", {autoDelete: false, durable: true, type: 'topic', confirm: true}, (ex)=>{
        auth_ex = ex;
    });
});

exports.publish = (key, message, cb)=>{
    //console.log("publishing");
    message.timestamp = (new Date().getTime())/1000; //it's crazy that amqp doesn't set this?
    //console.dir(message);
    auth_ex.publish(key, message, {}, cb);
}

exports.createClaim = async function(user, cb) {
    if(!user.check) return cb("user object does not contain .check()");
    var err = user.check();
    if(err) return cb(err);
    
    //load active groups (using sequelize generated code)
    var gids = []; 
    let groups = await user.getAdminGroups({attributes: ['id', 'active']});
    groups.forEach(group=>{
        if(group.active && !~gids.indexOf(group.id)) gids.push(group.id);  
    });
    groups = await user.getMemberGroups({attributes: ['id', 'active']});
    groups.forEach(group=>{
        if(group.active && !~gids.indexOf(group.id)) gids.push(group.id);  
    });

    /* http://websec.io/2014/08/04/Securing-Requests-with-JWT.html
    iss: The issuer of the token
    aud: The audience that the JWT is intended for
    iat: The timestamp when the JWT was created
    nbf: A "not process before" timestamp defining an allowed start time for processing
    exp: A timestamp defining an expiration time (end time) for the token
    jti: Some kind of unique ID for the token
    typ: A "type" of token. In this case it's URL but it could be a media type like these
    */

    cb(null, {
        iss: config.auth.iss,
        exp: (Date.now() + config.auth.ttl)/1000,
        //"iat": (Date.now())/1000, //this gets set automatically
        scopes: user.scopes,
        
        //can't use user.username which might not be set
        sub: user.id,  //TODO - toString() this!?

        gids, //TODO - toString() this also?
        profile: { 
            username: user.username,
            email: user.email,
            fullname: user.fullname 
        },
    });
}

exports.signJwt = function(claim) {
    return jwt.sign(claim, config.auth.private_key, config.auth.sign_opt);
}

function do_send_email_confirmation(url, user, cb) {
    var fullurl = url+"#!/confirm_email/"+user.id+"/"+user.email_confirmation_token;

    var transporter = nodemailer.createTransport(config.local.mailer); 
    transporter.sendMail({
        from: config.local.email_confirmation.from,
        to: user.email,
        subject: config.local.email_confirmation.subject,
        text: "Hello!\n\nIf you have created a new account, please visit following URL to confirm your email address.\n\n"+ fullurl,
        //html:  ejs.render(html_template, params),
    }, function(err, info) {
        if(err) return cb(err);
        if(info && info.response) logger.info("notification sent: "+info.response);
        cb();
    });
}

exports.send_email_confirmation = function(url, user, cb) {
    //need to generate token if it's not set yet
    if(!user.email_confirmation_token) {
        user.email_confirmation_token = uuid.v4();
        user.save().then(function() {
            do_send_email_confirmation(url, user, cb);
        });
    } else {
        do_send_email_confirmation(url, user, cb);
    }
}

exports.send_resetemail = function(url, user, cb) {
    var transporter = nodemailer.createTransport(config.local.mailer); 
    var fullurl = url+"#!/forgotpass/"+user.password_reset_token;
    transporter.sendMail({
        from: config.local.email_passreset.from,
        to: user.email,
        subject: config.local.email_passreset.subject,
        text: "Hello!\n\nIf you have requested to reset your password, please visit "+fullurl+" to reset your password (using the same browser you've used to send the request",
    }, function(err, info) {
        if(err) return cb(err);
        if(info && info.response) logger.info("notification sent: "+info.response);
        cb();
    });
}

//probbably deprecated
exports.setJwtCookies = function(claim, res) {
    var token = exports.signJwt(claim);
    res.cookie('jwt', token, {domain: '.ppa.iu.edu', httpOnly: true, secure: true, path: '/'});
    res.cookie('XSRF-TOKEN', claim.xsrf, {domain: '.ppa.iu.edu', secure: true, path: '/'});
}

//return scopes that exists in both o1 and o2
exports.intersect_scopes = function(o1, o2) {
    var intersect = {};
    for(var k in o1) {
        var v1 = o1[k];
        if(o2[k] === undefined) continue; //key doesn't exist in o2..
        var v2 = o2[k];
        //if(typeof v1 ! = typeof v2) return; //type doesn't match
        var vs = [];
        v1.forEach(function(v) {
            if(~v2.indexOf(v)) vs.push(v);
        });
        intersect[k] = vs;
    }
    return intersect;
}

/*
//send auditlog to central audit log server
exports.auditlog = function(username, event, detail) {
    let log = { app: "auth", time: new Date().getTime(), hostname: os.hostname(), event, detail };
    if(username) log.username = username; 
}
*/

