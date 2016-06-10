'use strict';

var request = require('request');
var fs = require('fs');

var sca = "https://soichi7.ppa.iu.edu/api";

var jwt = fs.readFileSync('/home/hayashis/.sca/keys/cli.jwt', {encoding: 'ascii'}).trim();

//register new user
//using SCA local username and password
request.post({
    url: sca+"/auth/refresh", json: true, 
    headers: { 'Authorization': 'Bearer '+jwt },
}, function(err, res, body) {
    if(err) throw err;
    console.dir(body);
});
