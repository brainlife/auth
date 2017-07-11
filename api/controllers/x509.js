
//contrib
var express = require('express');
var router = express.Router();
var request = require('request');
var winston = require('winston');
var jwt = require('express-jwt');

//mine
var config = require('../config');
var logger = new winston.Logger(config.logger.winston);

var common = require('../common');
var db = require('../models');

function finduserByDN(dn, done) {
    db.User.findOne({where: {x509dns: {$like: "%\""+dn+"\"%"}}}).then(function(user) {
        done(null, user);
    });
}

function issue_jwt(user, dn, cb) {
    common.createClaim(user, function(err, claim) {
        if(err) return cb(err);
        user.updateTime('x509_login:'+dn);
        user.save().then(function() {
            cb(null, common.signJwt(claim));
        });
    });
}

/*
var allowCrossDomain = function(req, res, next) {
    console.log("setting header");
    res.header('Access-Control-Allow-Origin', config.x509.allow_origin||'*'); 
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Pragma,Cache-Control,If-Modified-Since,Authorization');
    next();
}
router.use(allowCrossDomain); //for OPTIONS method
*/

// this endpoint needs to be exposed via webserver that's requiring x509 DN
// unlike /auth, this page will redirect back to #!/success/<jwt>
router.get('/signin', /*jwt({secret: config.auth.public_key, credentialsRequired: false}),*/ function(req, res, next) {
    //logger.debug(req.user);
    //res.header("Access-Control-Allow-Headers", "X-Requested-With");
    //return res.json({status: "ok", dn: req.headers[config.x509.dn_header], /*headers: req.headers*/});
    var dn = req.headers[config.x509.dn_header];
    if(!dn) {
        console.dir(req.headers);
        return next("Couldn't find x509 DN (maybe configuration issue?)");
    }
    finduserByDN(dn, function(err, user) {
        if(err) return next(err); 
        if(!user) return next("Your DN("+dn+") is not yet registered. Please Signup/Signin with your username/password first, then associate your x509 certificate under your account settings.");
        var err = user.check();
        if(err) return next(err);
        
        //all good. issue token
        logger.debug("x509 authentication successful with "+dn);
        issue_jwt(user, dn, function(err, jwt) {
            if(err) return next(err);
            //res.json({jwt:jwt});
            res.redirect(req.headers.referer+"#!/success/"+jwt);
        });
    });
});

// this endpoint needs to be exposed via webserver that's requiring x509 DN
router.get('/associate/:jwt', jwt({secret: config.auth.public_key, getToken: function(req) { return req.params.jwt; }}), 
function(req, res, next) {
//router.get('/connect', jwt({secret: config.auth.public_key}), function(req, res, next) {
    var dn = req.headers[config.x509.dn_header];
    if(!dn) {
        console.dir(req.headers);
        return next("Couldn't find x509 DN (maybe configuration issue?)");
    }
    finduserByDN(dn, function(err, user) {
        if(err) return next(err); 
        if(!user) {
            //associate(req.user, dn, res);
            logger.info("associating user with x509 DN "+dn);
            db.User.findOne({where: {id: req.user.sub}}).then(function(user) {
                if(!user) return next("couldn't find user record with jwt.sub:"+req.user.sub);
                var dns = user.get('x509dns');
                if(!dns) dns = [];
                if(!~dns.indexOf(dn)) dns.push(dn);
                user.set('x509dns', dns);
                user.save().then(function() {
                    var messages = [{type: "success", message: "Successfully associated your DN to your account."}];
                    res.cookie('messages', JSON.stringify(messages)/*, {path: '/'}*/);
                    res.redirect(req.headers.referer+"#!/settings/account");
                });
            });
        } else {
            var messages;
            if(user.id == req.user.sub) {
                messages = [{type: "info", message: "The certificate you have provided("+dn+") is already connected to your account."}];

            } else { 
                messages = [{type: "error", message: "The certificate you have provided("+dn+") is already connected to another account."}];
                //TODO - does user wish to merge 2 accounts into 1?
            }
            res.cookie('messages', JSON.stringify(messages)/*, {path: '/'}*/);
            console.dir(req.headers);
            res.redirect(req.headers.referer+"#!/settings/account");
        }
    });
});

router.put('/disconnect', jwt({secret: config.auth.public_key}), function(req, res, next) {
    var dn = req.body.dn;
    logger.debug("disconnecting "+dn);
    db.User.findOne({
        where: {id: req.user.sub}
    }).then(function(user) {
        if(!user) res.status(401).end();
        var dns = user.get('x509dns');
        var pos = dns.indexOf(dn);
        if(~pos) dns.splice(pos, 1);
        user.set('x509dns', dns);
        user.save().then(function() {
            res.json({message: "Successfully disconnected X509 DN:"+dn, user: user});
        });    
    });
});

module.exports = router;

