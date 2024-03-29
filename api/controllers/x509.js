//NOT TESTED SINCE sequelize to mongo update

var express = require('express');
var router = express.Router();
var request = require('request');
var jwt = require('express-jwt');

var config = require('../config');

var common = require('../common');
var db = require('../models');

function finduserByDN(dn, done) {
    db.mongo.User.findOne({'ext.x509dns': dn}).then(function(user) {
        done(null, user);
    });
}

// this endpoint needs to be exposed via webserver that's requiring x509 DN
// unlike /auth, this page will redirect back to #!/success/<jwt>
router.get('/signin', function(req, res, next) {
    var dn = req.headers[config.x509.dn_header];
    if(!dn) {
        console.dir(req.headers);
        return next("Couldn't find x509 DN (maybe configuration issue?)");
    }
    finduserByDN(dn, function(err, user) {
        if(err) return next(err); 
        if(!user) return next("Your DN("+dn+") is not yet registered. Please Signup/Signin with your username/password first, then associate your x509 certificate under your account settings.");

        const error = common.checkUser(user, req);
        if(error) return next(error);
        common.createClaim(user, function(err, claim) {
            if(err) return next(err);
            const idx = user.ext.x509dns.indexOf(dn);
            if(!user.times.x509_login) user.times.x509_login = [];
            user.times.x509_login[idx] = new Date();
            user.markModified('times');
            user.reqHeaders = req.headers;
            user.save().then(function() {
                common.publish("user.login."+user.sub, {type: "x509", username: user.username, exp: claim.exp, headers: req.headers});
                let jwt = common.signJwt(claim);
                res.redirect(req.headers.referer+"#!/success/"+jwt);
            });
        });
    });
});

// this endpoint needs to be exposed via webserver that's requiring x509 DN
router.get('/associate/:jwt', jwt({
    secret: config.auth.public_key, 
    algorithms: [config.auth.sign_opt.algorithm],
    getToken: function(req) { return req.params.jwt; }
}), function(req, res, next) {
    var dn = req.headers[config.x509.dn_header];
    if(!dn) {
        console.dir(req.headers);
        return next("Couldn't find x509 DN (maybe configuration issue?)");
    }
    finduserByDN(dn, function(err, user) {
        if(err) return next(err); 
        if(!user) {
            //associate(req.user, dn, res);
            console.info("associating user with x509 DN "+dn);
            db.mongo.User.findOne({sub: req.user.sub}).then(function(user) {
                if(!user) return next("couldn't find user record with jwt.sub:"+req.user.sub);
                var dns = user.ext.x509dns;
                if(!dns) dns = [];
                if(!~dns.indexOf(dn)) dns.push(dn);
                user.ext.x509dns = dns;
                user.save().then(function() {
                    var messages = [{type: "success", message: "Successfully associated your DN to your account."}];
                    res.cookie('messages', JSON.stringify(messages)/*, {path: '/'}*/);
                    res.redirect(req.headers.referer+"#!/settings/account");
                });
            });
        } else {
            var messages;
            if(user.sub == req.user.sub) {
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

router.put('/disconnect', jwt({
    secret: config.auth.public_key,
    algorithms: [config.auth.sign_opt.algorithm],
}), function(req, res, next) {
    var dn = req.body.dn;
    console.debug("disconnecting "+dn);
    db.User.findOne({sub: req.user.sub}).then(function(user) {
        if(!user) res.status(401).end();
        var dns = user.ext.x509dns;
        var pos = dns.indexOf(dn);
        if(~pos) dns.splice(pos, 1);
        user.ext.x509dns = dns;
        user.save().then(function() {
            res.json({message: "Successfully disconnected X509 DN:"+dn, user: user});
        });    
    });
});

module.exports = router;

