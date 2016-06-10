'use strict';

var fs = require('fs');
var request = require('request');

var sca = "https://soichi7.ppa.iu.edu/api";

var jwt = fs.readFileSync('/home/hayashis/.sca/keys/cli.jwt', {encoding: 'ascii'}).trim();

//register new user
//using SCA local username and password
request.get({
    url: sca+"/auth/users", json: true, 
    headers: { 'Authorization': 'Bearer '+jwt },
    body: {
        //where: todo,
    }
}, function(err, res, body) {
    if(err) throw err;
    console.log(res.statusCode + " " + res.statusMessage);
    console.dir(body);
});
