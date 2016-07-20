'use strict';

//just a service to load all users from auth service
app.factory('serverconf', ['appconf', '$http', function(appconf, $http) {
    return $http.get(appconf.api+'/config')
    .then(function(res) {
        return res.data;
    });
}]);

app.controller('HeaderController', ['$scope', 'appconf', '$route', 'toaster', '$http', 'serverconf', 'menu',
function($scope, appconf, $route, toaster, $http, serverconf, menu) {
    $scope.title = appconf.title;
    serverconf.then(function(_c) { $scope.serverconf = _c; });
    //menu.then(function(_menu) { $scope.menu = _menu; });
    $scope.menu = menu;
}]);

app.controller('SigninController', ['$scope', 'appconf', '$route', 'toaster', '$http', 'jwtHelper', '$routeParams', '$location', 'scaMessage', '$sce', 'serverconf',
function($scope, appconf, $route, toaster, $http, jwtHelper, $routeParams, $location, scaMessage, $sce, serverconf) {
    $scope.$parent.active_menu = 'signin';
    $scope.appconf = appconf;
    serverconf.then(function(_c) { $scope.serverconf = _c; });
    scaMessage.show(toaster);

    //decide where to go after auth
    var redirect = sessionStorage.getItem('auth_redirect');
    //TODO - try if user sent us redirect url via query param?
    if(!redirect) redirect = document.referrer;
    if(!redirect) redirect = appconf.default_redirect_url;
    sessionStorage.setItem('auth_redirect', redirect); //save it for iucas login which needs this later

    $scope.userpass = {};

    $scope.submit = function() {
        //ldap auth takes precedence
        var url = "";
        if($scope.serverconf.local) url = appconf.api+"/local/auth";
        if($scope.serverconf.ldap) url = appconf.api+"/ldap/auth";
        $http.post(url, $scope.userpass).then(function(res) {
            scaMessage.success(res.data.message);
            localStorage.setItem(appconf.jwt_id, res.data.jwt);
            sessionStorage.removeItem('auth_redirect');
            document.location = redirect;
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
            var hash = handle_auth_issues(res);
            if(hash) document.location = hash;
        }); 
    }

    $scope.begin_iucas = function() {
        //I can't pass # for callback somehow (I don't know how to make it work, or iucas removes it)
        //so let's let another html page handle the callback, do the token validation through iucas and generate the jwt 
        //and either redirect to profile page (default) or force user to setup user/pass if it's brand new user
        var casurl = window.location.origin+window.location.pathname+'iucascb.html';
        window.location.href = appconf.iucas_url+'?cassvc=IU&casurl='+casurl;
    }

    $scope.begin_x509 = function() {
        $http.get(appconf.x509api+'/x509/auth') //, {headers: null})
        .then(function(res) {
            scaMessage.success("Welcome back!");
            localStorage.setItem(appconf.jwt_id, res.data.jwt);
            var redirect = sessionStorage.getItem('auth_redirect');
            window.location = redirect; 
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
            var hash = handle_auth_issues(res);
            if(hash) document.location = hash;
        }); 
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
}]);

app.controller('SignoutController', ['$scope', 'appconf', '$route', 'toaster', '$http', 'jwtHelper', '$routeParams', 'menu',
function($scope, appconf, $route, toaster, $http, jwtHelper, $routeParams, menu) {
    localStorage.removeItem(appconf.jwt_id);
    toaster.success("Good Bye!");
    menu.user = null; //scaMenubar watches for this and re-init
    window.location = "#/signin";
}]);

app.controller('SignupController', ['$scope', 'appconf', '$route', 'toaster', '$http', 'jwtHelper', '$routeParams', 'scaMessage', 
function($scope, appconf, $route, toaster, $http, jwtHelper, $routeParams, scaMessage) {
    $scope.$parent.active_menu = 'signup';
    scaMessage.show(toaster);
    $scope.form = {};

    //decide where to go after signup
    var redirect = sessionStorage.getItem('auth_redirect');
    if(!redirect) redirect = document.referrer;
    if(!redirect) redirect = appconf.default_redirect_url;

    $scope.submit = function() {
        $http.post(appconf.api+'/signup', $scope.form)
        .then(function(res, status, headers, config) {
            localStorage.setItem(appconf.jwt_id, res.data.jwt);

            //let's post public profile for the first time
            $http.put(appconf.api+'/local/setprofile/'/*+res.data.sub*/, {
                //email: $scope.form.email,
                fullname: $scope.form.fullname,
            })
            .then(function(_res) {
                if(res.data.code) {
                    //need a bit more work (like confirming email)
                    var hash = handle_auth_issues(res);
                    document.location = hash;
                } else {
                    scaMessage.success("Successfully signed up!");
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
}]);

app.controller('CompleteController', ['$scope', 'appconf', '$route', 'toaster', '$http', 'jwtHelper', '$routeParams', 'scaMessage', 'serverconf', 
function($scope, appconf, $route, toaster, $http, jwtHelper, $routeParams, scaMessage, serverconf) {
    $scope.$parent.active_menu = 'complete';
    scaMessage.show(toaster);
    var jwt = localStorage.getItem(appconf.jwt_id);
    var user = jwtHelper.decodeToken(jwt);
    serverconf.then(function(_serverconf) { $scope.serverconf = _serverconf; });
    
    //stores form
    $scope.form = {};

    $http.get(appconf.api+'/me')
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
    if(!redirect) redirect = appconf.default_redirect_url;

    function put_profile(cb) {
        $http.put(appconf.api+'/local/setprofile/'/*+user.sub*/, {
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
        //console.dir($scope.form);
        $http.put(appconf.api+'/local/setpass', {password: $scope.form.password})
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
}]);

app.controller('AccountController', ['$scope', 'appconf', '$route', 'toaster', '$http', 'serverconf', 'jwtHelper', 'scaMessage', 'scaSettingsMenu',
function($scope, appconf, $route, toaster, $http, serverconf, jwtHelper, scaMessage, scaSettingsMenu) {
    $scope.$parent.active_menu = 'user';
    $scope.appconf = appconf;
    $scope.user = null;
    $scope.form_password = {};
    scaMessage.show(toaster);

    var jwt = localStorage.getItem(appconf.jwt_id);
    var user = jwtHelper.decodeToken(jwt);
    $scope.user = user;
    $scope.settings_menu = scaSettingsMenu;
    $scope.debug = {jwt: user};

    serverconf.then(function(_serverconf) { $scope.serverconf = _serverconf; });
    $http.get(appconf.api+'/me').success(function(info) { $scope.user = info; });

    $scope.submit_profile = function() {
        $http.put(appconf.api+'/profile', $scope.user)
        .then(function(res, status, headers, config) {
            toaster.success(res.data.message);
            $http.get(appconf.api+'/me').success(function(info) { $scope.user = info; });
        }, function(res, status, headers, config) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }
    $scope.submit_password = function() {
        $http.put(appconf.api+'/local/setpass', {password_old: $scope.form_password.old, password: $scope.form_password.new})
        .then(function(res, status, headers, config) {
            toaster.success(res.data.message);
            $http.get(appconf.api+'/me').success(function(info) { $scope.user = info; });
        }, function(res, status, headers, config) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }

    $scope.disconnect = function(type, data) {
        $http.put(appconf.api+'/'+type+'/disconnect', data)
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
        window.location = appconf.iucas_url+'?cassvc=IU&casurl='+casurl;
    }
    $scope.git_connect = function() {
        toaster.info("git_connect todo");
    }
    $scope.google_connect = function() {
        toaster.info("google_connect todo");
    }
    $scope.x509_connect = function() {
        $http.get(appconf.x509api+'/x509/connect') //, {headers: null})
        .then(function(res, status, headers, config) {
            toaster.success(res.data.message);
            $scope.user = res.data.user;
        }, function(res, status, headers, config) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        }); 
    }
}]);

app.controller('ForgotpassController', ['$scope', 'appconf', '$route', 'toaster', '$http', 'jwtHelper', '$routeParams', '$location', 'scaMessage', 
function($scope, appconf, $route, toaster, $http, jwtHelper, $routeParams, $location, scaMessage) {
    $scope.$parent.active_menu = 'user'; //TODO - is there a better menu?
    scaMessage.show(toaster);
    $scope.appconf = appconf;
}]);

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

app.controller('AdminUsersController', ['$scope', 'appconf', '$route', 'toaster', '$http', 'serverconf', 'jwtHelper', 'scaMessage', 'scaAdminMenu',
function($scope, appconf, $route, toaster, $http, serverconf, jwtHelper, scaMessage, scaAdminMenu) {
    scaMessage.show(toaster);
    $scope.$parent.active_menu = 'admin';
    $scope.admin_menu = scaAdminMenu;

    $http.get(appconf.api+'/users')
    .then(function(res) { 
        $scope.users = res.data; 
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    });
    $scope.edit = function(id) {
        window.location = "#/admin/user/"+id;
    }
}]);

app.controller('AdminUserController', ['$scope', 'appconf', '$route', 'toaster', '$http', 'serverconf', 'jwtHelper', 'scaMessage', 'scaAdminMenu', '$routeParams', '$location',
function($scope, appconf, $route, toaster, $http, serverconf, jwtHelper, scaMessage, scaAdminMenu, $routeParams, $location) {
    scaMessage.show(toaster);
    $scope.$parent.active_menu = 'admin';
    $scope.admin_menu = scaAdminMenu;
    serverconf.then(function(_serverconf) { $scope.serverconf = _serverconf; });

    $http.get(appconf.api+'/user/'+$routeParams.id)
    .then(function(res) { 
        $scope.user = res.data; 
        if($scope.user.x509dns) $scope.x509dns = JSON.stringify($scope.user.x509dns, null, 4);
        if($scope.user.scopes) $scope.scopes = JSON.stringify($scope.user.scopes, null, 4);
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    });

    $scope.submit = function() {
        $scope.user.x509dns = JSON.parse($scope.x509dns);
        $scope.user.scopes = JSON.parse($scope.scopes);

        $http.put(appconf.api+'/user/'+$routeParams.id, $scope.user)
        .then(function(res) { 
            window.location = "#/admin/users"
            toaster.success(res.data.message);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }
}]);

app.controller('GroupsController', ['$scope', 'appconf', '$route', 'toaster', '$http', 'serverconf', 'jwtHelper', 'scaMessage', 'profiles',
function($scope, appconf, $route, toaster, $http, serverconf, jwtHelper, scaMessage, profiles) {
    scaMessage.show(toaster);
    $scope.$parent.active_menu = 'groups';

    profiles.then(function(_users) { 
        $scope.users = _users;
        $http.get(appconf.api+'/groups')
        .then(function(res) { 
            $scope.groups = res.data; 
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    });
    //$scope.admin_menu = scaAdminMenu;
    $scope.edit = function(id) {
        window.location = "#/group/"+id;
    }
}]);

app.controller('GroupController', ['$scope', 'appconf', '$route', 'toaster', '$http',  'serverconf', 'jwtHelper', 'scaMessage', '$routeParams', '$location', 'profiles',
function($scope, appconf, $route, toaster, $http, serverconf, jwtHelper, scaMessage, $routeParams, $location, profiles) {
    scaMessage.show(toaster);
    $scope.$parent.active_menu = 'groups';
    serverconf.then(function(_serverconf) { $scope.serverconf = _serverconf; });
    var jwt = localStorage.getItem(appconf.jwt_id);
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
        $http.get(appconf.api+'/group/'+id)
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
            $http.post(appconf.api+'/group', body)
            .then(function(res) { 
                window.location = "#/groups"
                toaster.success(res.data.message);
            }, function(res) {
                if(res.data && res.data.message) toaster.error(res.data.message);
                else toaster.error(res.statusText);
            });
        } else {
            //update
            $http.put(appconf.api+'/group/'+$routeParams.id, body)
            .then(function(res) { 
                window.location = "#/groups"
                toaster.success(res.data.message);
            }, function(res) {
                if(res.data && res.data.message) toaster.error(res.data.message);
                else toaster.error(res.statusText);
            });
        }
    }
    $scope.cancel = function() {
        window.location = "#/groups";
    }
}]);

app.controller('SendEmailConfirmationController', ['$scope', 'appconf', '$route', 'toaster', '$http', 'serverconf', 'jwtHelper', 'scaMessage', 'scaAdminMenu', '$routeParams', '$location',
function($scope, appconf, $route, toaster, $http, serverconf, jwtHelper, scaMessage, scaAdminMenu, $routeParams, $location) {
    scaMessage.show(toaster);
    $scope.$parent.active_menu = 'user';
}]);

app.controller('ConfirmEmailController', ['$scope', 'appconf', '$route', 'toaster', '$http', 'serverconf', 'jwtHelper', 'scaMessage', 'scaAdminMenu', '$routeParams', '$location',
function($scope, appconf, $route, toaster, $http, serverconf, jwtHelper, scaMessage, scaAdminMenu, $routeParams, $location) {
    scaMessage.show(toaster);
    $scope.$parent.active_menu = 'user';
    //$scope.admin_menu = scaAdminMenu;
    //serverconf.then(function(_serverconf) { $scope.serverconf = _serverconf; });

    $scope.resend = function() {
        $http.post(appconf.api+'/send_email_confirmation', {sub: $routeParams.sub})
        .then(function(res) { 
            toaster.success(res.data.message);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }

    //$scope.token = $routeParams.t;
    if($routeParams.t) {
        window.location = "#/";
        $http.post(appconf.api+'/confirm_email', {token: $routeParams.t})
        .then(function(res) { 
            toaster.success(res.data.message);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }
}]);


