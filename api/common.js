
const fs = require('fs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const uuid = require('node-uuid');

const config = require('./config');

exports.createClaim = function(user, cb) {
    //load groups (using sequelize generated code)
    user.getGroups({attributes: ['id']}).then(function(groups) {
        var gids = [];
        groups.forEach(function(group) {
            gids.push(group.id);  
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
            "iss": config.auth.iss,
            "exp": (Date.now() + config.auth.ttl)/1000,
            "iat": (Date.now())/1000,
            "scopes": user.scopes,
            "sub": user.id, //can't use user.username because it could be not set
            "gids": gids,
            "profile": { 
                username: user.username,
                email: user.email,
                fullname: user.fullname 
            },
        });
    });
}

exports.signJwt = function(claim) {
    return jwt.sign(claim, config.auth.private_key, config.auth.sign_opt);
}

function do_send_email_confirmation(url, user, cb) {
    var fullurl = url+"#!/confirm_email?t="+user.email_confirmation_token+"&sub="+user.id;

    var transporter = nodemailer.createTransport(); //use direct mx transport
    transporter.sendMail({
        from: config.email_confirmation.from,
        to: user.email,
        subject: config.email_confirmation.subject,
        text: "Hello!\n\nIf you has created a new SCA account, please visit following URL to confirm your email address.\n\n"+ fullurl,
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

//probbably deprecated
exports.setJwtCookies = function(claim, res) {
    var token = exports.signJwt(claim);
    res.cookie('jwt', token, {domain: '.ppa.iu.edu', httpOnly: true, secure: true, path: '/'});
    res.cookie('XSRF-TOKEN', claim.xsrf, {domain: '.ppa.iu.edu', secure: true, path: '/'});
}

