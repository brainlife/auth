
const fs = require('fs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const uuid = require('node-uuid');
const amqp = require('amqp');
const os = require('os');
const bcrypt = require('bcryptjs');
const zxcvbn = require('zxcvbn');
const redis = require('redis');

const config = require('./config');
const db = require('./models');

exports.redisClient = redis.createClient(config.redis);
exports.redisClient.on('error', console.error);
exports.connectRedis = async function(cb) {
    console.log("connecting to redis");
    await exports.redisClient.connect();
    if(cb) cb(); //for client using cb
}

let amqp_conn;
let auth_ex;
exports.connectAMQP = function(cb) {

    if(!config.event) return cb();

    get_amqp_connection((err, conn)=>{
        if(err) throw err;
        console.debug("creating auth amqp exchange");
        conn.exchange("auth", {autoDelete: false, durable: true, type: 'topic', confirm: true}, (ex)=>{
            auth_ex = ex;
            cb();
        });
    });

    function get_amqp_connection(cb) {
        if(amqp_conn) return cb(null, amqp_conn); //already connected
        amqp_conn = amqp.createConnection(config.event.amqp, {reconnectBackoffTime: 1000*10});
        amqp_conn.once("ready", ()=>{
            console.debug("connected to amqp");
            cb(null, amqp_conn);
        });
        amqp_conn.on("error", err=>{
            console.error(err);
        });
    }
}


exports.publish = (key, message, cb)=>{
    message.timestamp = (new Date().getTime())/1000; //it's crazy that amqp doesn't set this?
    console.debug(key, message);
    if(auth_ex) auth_ex.publish(key, message, {}, cb);
}

exports.createClaim = async function(user, cb) {

    const adminGroups = await db.mongo.Group.find({active: true, admins: user._id});
    const adminGids = adminGroups.map(group=>group.id);
    const memberGroups = await db.mongo.Group.find({active: true, members: user._id});
    const memberGids = memberGroups.map(group=>group.id);

    /*
    const gids = [...adminGids, ...memberGids];
    const dedupedGids = [...new Set(gids)];
    */

    const gids = [...adminGids, 0]; //0 separates admin ids from member ids. nobody should be a member of 0
    memberGids.forEach(gid=>{
        if(!gids.includes(gid)) gids.push(gid);
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
        //"iat": (Date.now())/1000, //this gets set automatically
        iss: config.auth.iss,
        exp: (Date.now() + config.auth.ttl)/1000,
        scopes: user.scopes,

        //can't use user.username which might not be set
        sub: user.sub, 

        gids,

        /* http header becomes too big with this
        //new gids lists..
        adminGids: adminGids, //number[]
        memberGids: memberGids, //number[[]
        */

        //store a bit of important profile information in jwt..
        profile: { 
            username: user.username,
            email: user.email,
            fullname: user.fullname,

            aup: user.profile.private.aup,
        },
    });
}

exports.signJwt = function(claim) {
    return jwt.sign(claim, config.auth.private_key, config.auth.sign_opt);
}

function do_send_email_confirmation(url, user, cb) {

    let text = "Hello!\n\nIf you have created a new account, please visit the following URL to confirm your email address.\n\n";
    text+= url+"#!/confirm_email/"+user.sub+"/"+user.email_confirmation_token;

    console.log("sending email.. to", user.email);
    console.dir(config.local.email_confirmation);
    console.log(text);

    var transporter = nodemailer.createTransport(config.local.mailer); 
    transporter.sendMail({
        from: config.local.email_confirmation.from,
        to: user.email,
        subject: config.local.email_confirmation.subject,
        text,
        //html:  ejs.render(html_template, params),
    }, function(err, info) {
        if(err) return cb(err);
        if(info && info.response) console.info("notification sent: "+info.response);
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
        if(info && info.response) console.info("notification sent: "+info.response);
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


exports.hash_password= async function(password) {
    let strength = await zxcvbn(password);
    //0 # too guessable: risky password. (guesses < 10^3)
    //1 # very guessable: protection from throttled online attacks. (guesses < 10^6)
    //2 # somewhat guessable: protection from unthrottled online attacks. (guesses < 10^8)
    //3 # safely unguessable: moderate protection from offline slow-hash scenario. (guesses < 10^10)
    //4 # very unguessable: strong protection from offline slow-hash scenario. (guesses >= 10^10)
    if(strength.score == 0) {
        throw new Error(strength.feedback.warning + " - " + strength.feedback.suggestions.toString() + 
        ". Please choose a stronger password and try again.");
    }

    /* cost of computation https://www.npmjs.com/package/bcrypt
    * rounds=10: ~10 hashes/sec
    * rounds=13: ~1 sec/hash
    * rounds=25: ~1 hour/hash
    * rounds=31: 2-3 days/hash
    */
    try {
        let salt = await bcrypt.genSalt(10);
        let hash = await bcrypt.hash(password, salt);
        return hash;
    } catch (err) {
        throw new Error("An error occurred while hashing the password. Please try again later.");
    }
}

exports.check_password = function(user, password) {
    if(!user.password_hash) return false; //no password, no go
    return bcrypt.compareSync(password, user.password_hash);
}

exports.checkUser = function(user, req) {
    let error = null;
    if(!user.active) 
        error = {message: "Account is disabled. Please contact the administrator.", code: "inactive"};
    if(config.local && config.local.email_confirmation && user.email_confirmed !== true) 
        error = {message: "Email is not confirmed yet", path: "/confirm_email/"+user.sub, code: "un_confirmed"};

    //record to failedlogin collection
    if(error) {
        const audit = new db.mongo.FailedLogin({user_id: user.id, code: error.code, headers: req.headers});
        audit.save();
    }

    return error;
}

exports.get_nextsub = async function() {
    let last_user = await db.mongo.User.findOne({}).sort('-_id'); //to find the next sub (TODO not concurrency safe..)
    if(!last_user) return 1; //very first user!?
    return last_user.sub+1;
}

exports.has_scope = function(req, role) {
    if(!req.user) return false;
    if(!req.user.scopes) return false;
    if(!req.user.scopes.auth) return false;
    if(!~req.user.scopes.auth.indexOf(role)) return false;
    return true;
}

exports.scope = function(role) {
    return function(req, res, next) {
        if(exports.has_scope(req, role)) next();
        else res.status(401).send(role+" role required");
    }
}

