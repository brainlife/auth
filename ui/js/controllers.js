'use strict';

app.controller('HeaderController', 
function($scope, appconf, $route, toaster, $http, menu, scaSettingsMenu) {
    $scope.title = appconf.title;
    //serverconf.then(function(_c) { $scope.serverconf = _c; });
    $scope.menu = menu;
    $scope.appconf = appconf;
    $scope.settings_menu = scaSettingsMenu;
});

app.controller('SigninController', 
function($scope, $route, toaster, $http, jwtHelper, $routeParams, $location, scaMessage, $sce) {
    $scope.$parent.active_menu = 'signin';
    scaMessage.show(toaster);

    if($routeParams.msg) {
        toaster.error($routeParams.msg);
    }

    function handle_success(res) {
        scaMessage.success(res.data.message || "Welcome back!");
        localStorage.setItem($scope.appconf.jwt_id, res.data.jwt);
        sessionStorage.removeItem('auth_redirect');
        document.location = redirect;
    }

    function handle_error(res) {
        if(res.data && res.data.path) {
            //console.log("path requested "+res.data.path);
            $location.path(res.data.path);
            if(res.data.message) scaMessage.error(res.data.message);
        } else {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText || "Oops.. unknown authentication error");
        }
    }

    //decide where to go after auth
    var redirect = sessionStorage.getItem('auth_redirect');
    //TODO - try if user sent us redirect url via query param?
    if(!redirect) redirect = document.referrer;
    if(!redirect) redirect = $scope.appconf.default_redirect_url;
    sessionStorage.setItem('auth_redirect', redirect); //save it for iucas login which needs this later

    $scope.userpass = {};
    $scope.submit = function() {
        var url = "";
        //ldap auth takes precedence
        if($scope.appconf.show.local) url = $scope.appconf.api+"/local/auth";
        if($scope.appconf.show.ldap) url = $scope.appconf.api+"/ldap/auth";
        $http.post(url, $scope.userpass).then(handle_success, handle_error);
    }

    $scope.begin_iucas = function() {
        //I can't pass # for callback somehow (I don't know how to make it work, or iucas removes it)
        //so let's let another html page handle the callback, do the token validation through iucas and generate the jwt 
        //and either redirect to profile page (default) or force user to setup user/pass if it's brand new user
        var casurl = window.location.origin+window.location.pathname+'iucascb.html';
        window.location.href = $scope.appconf.iucas_url+'?cassvc=IU&casurl='+casurl;
    }

    $scope.begin = function(type) {
        //need to redirect - so that user can interact with github
        window.location.href = "/api/auth/"+type+"/signin"; 
    }

    $scope.begin_x509 = function() {
        $http.get($scope.appconf.x509api+"/x509/auth") //, {headers: null})
        .then(handle_success, handle_error);
    }

    function getQueryVariable(variable) {
        var query = window.location.search.substring(1);
        var vars = query.split('&');
        for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split('=');
            if (decodeURIComponent(pair[0]) == variable) {
                return decodeURIComponent(pair[1]);
            }
        }
        console.log('Query variable %s not found', variable);
    }
});

app.controller('SuccessController', 
function($scope, $route, $http, jwtHelper, $routeParams, $location, scaMessage, $sce) {
    scaMessage.success("Welcome back!");
    localStorage.setItem($scope.appconf.jwt_id, $routeParams.jwt);
    var redirect = sessionStorage.getItem('auth_redirect');
    window.location = redirect; 
});

app.controller('SignoutController', 
function($scope, $route, $http, jwtHelper, $routeParams, menu, $location, scaMessage) {
    scaMessage.success("Good Bye!");
    localStorage.removeItem($scope.appconf.jwt_id);
    menu.user = null; //scaMenubar watches for this and re-init
    $location.path("/signin");
});

app.controller('SignupController', 
function($scope, $route, toaster, $http, jwtHelper, $routeParams, scaMessage, $location) {
    $scope.$parent.active_menu = 'signup';
    scaMessage.show(toaster);
    $scope.form = {};

    //decide where to go after signup
    var redirect = sessionStorage.getItem('auth_redirect');
    if(!redirect) redirect = document.referrer;
    if(!redirect) redirect = $scope.appconf.default_redirect_url;

    $scope.submit = function() {
        $http.post($scope.appconf.api+'/signup', $scope.form)
        .then(function(res, status, headers, config) {
            localStorage.setItem($scope.appconf.jwt_id, res.data.jwt);

            //let's post auth profile for the first time
            $http.put($scope.appconf.api+'/profile/'/*+res.data.sub*/, {
                //email: $scope.form.email,
                fullname: $scope.form.fullname,
            })
            .then(function(_res) {
                if(res.data.message) scaMessage.success(res.data.message);
                else scaMessage.success("Successfully signed up!");

                //redirect to somewhere..
                if(res.data.path) $location.path(res.data.path); //maybe .. email_confirmation
                else {
                    sessionStorage.removeItem('auth_redirect');
                    document.location = redirect;
                }
            }, function(res) {
                if(res.data && res.data.message) toaster.error(res.data.message);
                else toaster.error(res.statusText);
            });
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });         
    }
});

//allow user to complete registration *after* successful initial 3rd party login
//TODO - I believe this is deprecated - now that we redirect to profile page after initial successful login
/*
app.controller('RegisterController', function($scope, $route, toaster, $http, jwtHelper, $routeParams, scaMessage) {
    $scope.$parent.active_menu = 'complete';
    scaMessage.show(toaster);
    var jwt = localStorage.getItem($scope.appconf.jwt_id);
    var user = jwtHelper.decodeToken(jwt);
    
    //stores form
    $scope.form = {};

    $http.get($scope.appconf.api+'/me')
    .then(function(res, status, headers, config) {
        $scope.form.username = res.data.username;
        $scope.form.email = res.data.email;
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    }); 

    //decide where to go after setting password
    var redirect = sessionStorage.getItem('auth_redirect');
    if(!redirect) redirect = document.referrer;
    if(!redirect) redirect = $scope.appconf.default_redirect_url;

    function put_profile(cb) {
        $http.put($scope.appconf.api+'/local/setprofile/', {
            //email: $scope.form.email,
            fullname: $scope.form.fullname,
        }).then(function(res) {
            cb(res);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }
    function set_pass(cb) {
        $http.put($scope.appconf.api+'/local/setpass', {password: $scope.form.password})
        .then(function(res) {
            cb(res);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });         
    }
    function alldone() {
        scaMessage.success("Registration Complete!");
        sessionStorage.removeItem('auth_redirect');
        document.location = redirect;
    }
    $scope.submit = function() {
        if($scope.form.password) {
            set_pass(function(res) {
                put_profile(function(res) {
                    alldone();
                });
            });
        } else {
            put_profile(function(res) {
                alldone();
            });
        }
    }
});
*/

app.controller('AccountController', 
function($scope, $route, toaster, $http, jwtHelper, scaMessage) {
    $scope.$parent.active_menu = 'user';
    $scope.user = null;
    $scope.form_password = {};
    scaMessage.show(toaster);

    var jwt = localStorage.getItem($scope.appconf.jwt_id);
    var user = jwtHelper.decodeToken(jwt);
    $scope.user = user;
    $scope.debug = {jwt: user};

    $http.get($scope.appconf.api+'/me').then(function(res) { 
        $scope.user = res.data; 
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    });

    $scope.submit_profile = function() {
        $http.put($scope.appconf.api+'/profile', $scope.user)
        .then(function(res, status, headers, config) {
            toaster.success(res.data.message);
            //TODO - why can't put request return updated object?
            $http.get($scope.appconf.api+'/me').then(function(res) { 
                $scope.user = res.data; 
            }, function(res) {
                if(res.data && res.data.message) toaster.error(res.data.message);
                else toaster.error(res.statusText);
            });
        }, function(res, status, headers, config) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }
    $scope.submit_password = function() {
        $http.put($scope.appconf.api+'/local/setpass', {password_old: $scope.form_password.old, password: $scope.form_password.new})
        .then(function(res, status, headers, config) {
            toaster.success(res.data.message);

            //TODO - why can't put request return updated object?
            $http.get($scope.appconf.api+'/me').then(function(res) { 
                $scope.user = res.data; 
            }, function(res) {
                if(res.data && res.data.message) toaster.error(res.data.message);
                else toaster.error(res.statusText);
            }); //why do I need to do this?

            //reset the password reset form (mainly to give user visual feedback)
            $scope.form_password = {};
        }, function(res, status, headers, config) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }

    $scope.disconnect = function(type, data) {
        $http.put($scope.appconf.api+'/'+type+'/disconnect', data)
        .then(function(res) {
            toaster.success(res.data.message);
            $scope.user = res.data.user;
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }

    $scope.iucas_connect = function() {
        sessionStorage.setItem('auth_redirect', window.location.href); 
        var casurl = window.location.origin+window.location.pathname+'iucascb.html';
        window.location = $scope.appconf.iucas_url+'?cassvc=IU&casurl='+casurl;
    }
    $scope.connect = function(type) {
        window.location = "/api/auth/"+type+"/associate/"+jwt;
    }
    $scope.x509_connect = function() {
        $http.get($scope.appconf.x509api+'/x509/connect') //, {headers: null})
        .then(function(res, status, headers, config) {
            toaster.success(res.data.message);
            $scope.user = res.data.user;
        }, function(res, status, headers, config) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        }); 
    }
});

app.controller('ForgotpassController', function($scope, $route, toaster, $http, jwtHelper, $routeParams, $location, scaMessage) {
    $scope.$parent.active_menu = 'user'; //TODO - is there a better menu?
    scaMessage.show(toaster);
});

app.directive('passwordStrength', function() {
    return {
        scope: {
            password: "=password",
          
            //optional attributes to make password more secure
            profile: "=profile",
            user: "=user",
        },
        templateUrl: 't/passwordstrength.html',
        link: function(scope, element, attributes) {
            scope.password_strength = {};
            scope.$watch('password', function(newv, oldv) {
                if(newv) {
                    //gather strings that we don't want user to use as password (like user's own fullname, etc..)
                    var used = [];
                    if(scope.profile) used.push(scope.profile.fullname);
                    if(scope.user) { 
                        used.push(scope.user.username);
                        used.push(scope.user.email);
                    }
                    //https://blogs.dropbox.com/tech/2012/04/zxcvbn-realistic-password-strength-estimation/
                    var st = zxcvbn(newv, used);
                    scope.password_strength = st;
                }
            });
        }
    };
});

app.controller('AdminUsersController', function($scope, $route, toaster, $http, jwtHelper, scaMessage, scaAdminMenu, $location) {
    scaMessage.show(toaster);
    $scope.$parent.active_menu = 'admin';
    $scope.admin_menu = scaAdminMenu;

    $http.get($scope.appconf.api+'/users')
    .then(function(res) { 
        $scope.users = res.data; 
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    });
    $scope.edit = function(id) {
        $location.path("/admin/user/"+id);
    }
});

app.controller('AdminUserController', 
function($scope, $route, toaster, $http, jwtHelper, scaMessage, scaAdminMenu, $routeParams, $location, $window) {
    scaMessage.show(toaster);
    $scope.$parent.active_menu = 'admin';
    $scope.admin_menu = scaAdminMenu;

    $http.get($scope.appconf.api+'/user/'+$routeParams.id)
    .then(function(res) { 
        $scope.user = res.data; 
        if($scope.user.x509dns) $scope.x509dns = JSON.stringify($scope.user.x509dns, null, 4);
        if($scope.user.scopes) $scope.scopes = JSON.stringify($scope.user.scopes, null, 4);
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    });

    $scope.cancel = function() {
        $window.history.back();
    }

    $scope.submit = function() {
        $scope.user.x509dns = JSON.parse($scope.x509dns);
        $scope.user.scopes = JSON.parse($scope.scopes);

        $http.put($scope.appconf.api+'/user/'+$routeParams.id, $scope.user)
        .then(function(res) { 
            $location.path("/admin/users");
            toaster.success(res.data.message);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }
});

app.controller('GroupsController', function($scope, $route, toaster, $http, jwtHelper, scaMessage, profiles, $location) {
    $scope.$parent.active_menu = 'groups';
    scaMessage.show(toaster);

    profiles.then(function(_users) { 
        $scope.users = _users;
        $http.get($scope.appconf.api+'/groups')
        .then(function(res) { 
            $scope.groups = res.data; 
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    });
    $scope.edit = function(id) {
        $location.path("/group/"+id);
    }
});

app.controller('GroupController', function($scope, $route, toaster, $http, jwtHelper, scaMessage, $routeParams, $location, profiles) {
    scaMessage.show(toaster);
    $scope.$parent.active_menu = 'groups';
    var jwt = localStorage.getItem($scope.appconf.jwt_id);
    var user = jwtHelper.decodeToken(jwt);
    $scope.group = {};
    $scope.admins = [];
    $scope.members = [];

    profiles.then(function(_users) { 
        $scope.users = _users;
        if($routeParams.id != 'new') {
            load_group($routeParams.id);
        } else {
            //add the user as first admin
            _users.forEach(function(_user) {
                if(_user.id == user.sub) {
                    $scope.admins.push(_user);
                } 
            });
        }
    });

    function load_group(id) {
        $http.get($scope.appconf.api+'/group/'+id)
        .then(function(res) { 
            $scope.group = res.data; 

            $scope.admins = [];
            $scope.group.Admins.forEach(function(admin) {
                $scope.users.forEach(function(user) {
                    if(admin.id == user.id) $scope.admins.push(user);
                });
            });
 
            $scope.members = [];
            $scope.group.Members.forEach(function(member) {
                $scope.users.forEach(function(user) {
                    if(member.id == user.id) $scope.members.push(user);
                });
            });
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }

    $scope.submit = function() {
        var admins = [];
        $scope.admins.forEach(function(admin) {
            admins.push(admin.id);
        });
        var members = [];
        $scope.members.forEach(function(member) {
            members.push(member.id);
        });
        var body = {
            group: $scope.group,
            admins: admins,
            members: members,
        }

        //ui-select require doesn't work so I need to have this
        if(admins.length == 0) {
            toaster.error("Please specify at least 1 admin");
            return; 
        }

        if($routeParams.id == "new") {
            //new
            $http.post($scope.appconf.api+'/group', body)
            .then(function(res) { 
                $location.path("/groups");
                toaster.success(res.data.message);
            }, function(res) {
                if(res.data && res.data.message) toaster.error(res.data.message);
                else toaster.error(res.statusText);
            });
        } else {
            //update
            $http.put($scope.appconf.api+'/group/'+$routeParams.id, body)
            .then(function(res) { 
                $location.path("/groups");
                toaster.success(res.data.message);
            }, function(res) {
                if(res.data && res.data.message) toaster.error(res.data.message);
                else toaster.error(res.statusText);
            });
        }
    }
    $scope.cancel = function() {
        $location.path("/groups");
    }
});

app.controller('SendEmailConfirmationController', function($scope, $route, toaster, $http, jwtHelper, scaMessage, scaAdminMenu, $routeParams, $location) {
    scaMessage.show(toaster);
    $scope.$parent.active_menu = 'user';
});

app.controller('ConfirmEmailController', function($scope, $route, toaster, $http, jwtHelper, scaMessage, scaAdminMenu, $routeParams, $location) {
    scaMessage.show(toaster);
    $scope.$parent.active_menu = 'user';
    $scope.sub = $routeParams.sub;

    $scope.resend = function() {
        $http.post($scope.appconf.api+'/send_email_confirmation', {sub: $scope.sub})
        .then(function(res) { 
            toaster.success(res.data.message);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }

    //this page also handles the actual confirmation request back from the email
    if($routeParams.t) {
        $http.post($scope.appconf.api+'/confirm_email', {token: $routeParams.t})
        .then(function(res) { 
            console.log("email confirmation successfull");
            scaMessage.success(res.data.message);
            $location.path("/"); 
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }
});


