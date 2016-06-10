'use strict';

var request = require('request');
var fs = require('fs');

var sca = "https://soichi7.ppa.iu.edu/api";

var jwt = fs.readFileSync('/home/hayashis/git/sca/config/sca.jwt', {encoding: 'ascii'}).trim();

//register new user
//using SCA local username and password
request.get({
    url: sca+"/auth/users", json: true, 
    headers: { 'Authorization': 'Bearer '+jwt },
    qs: {
        gids: true, //load gid
        where: JSON.stringify({
            id: 1,
        })
    },
}, function(err, res, users) {
    if(err) throw err;
    console.log(res.statusCode+" "+res.statusMessage);
    console.dir(users);
});
