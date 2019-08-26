'use strict';

app.controller('HeaderController', 
function($scope, appconf, $route, $location, toaster, $http, menu, scaSettingsMenu) {
    $scope.title = appconf.title;
    $scope.menu = menu;
    $scope.appconf = appconf;
    $scope.settings_menu = scaSettingsMenu;

    //console.dir(appconf);
    //console.log("params");
    let app = $location.search().app;
    switch(app) {
    case "localhost":
        console.log("reconfiguring for local development");
        sessionStorage.setItem('auth_redirect', 'http://localhost:8080');
        sessionStorage.setItem('jwt_on_url', true);
        break;
    }
});

app.controller('SigninController', 
function($scope, $route, toaster, $http, $routeParams, $location, scaMessage, $sce, $rootScope) {
    $scope.$parent.active_menu = 'signin';
    scaMessage.show(toaster);
    if($routeParams.msg) toaster.error($routeParams.msg);

    $scope.userpass = {};
    $scope.submit = async function() {
        var url = "";
        //ldap auth takes precedence
        if($scope.appconf.show.local) url = $scope.appconf.api+"/local/auth";
        if($scope.appconf.show.ldap) url = $scope.appconf.api+"/ldap/auth";
        try {
            let res = await $http.post(url, $scope.userpass);
            localStorage.setItem($scope.appconf.jwt_id, res.data.jwt);
            $rootScope.$broadcast("jwt_update", res.data.jwt)

            /*
            if($scope.appconf.profile) {
                let profile = JSON.parse(localStorage.getItem("public.profile"));
                await $http.put($scope.appconf.profile.api+'/public/'+res.data.sub, profile, {
                    Authorization: 'Bearer '+res.data.jwt, //use newly issued temp jwt.. 
                })
                localStorage.removeItem("public.profile");
                console.log("published public profile");
            }
            */

            handle_redirect($scope.appconf);
        } catch(res) {
            console.log("failed to login");
            if(res.data && res.data.path) {
                //console.log("path requested "+res.data.path);
                $location.path(res.data.path);
                if(res.data.message) scaMessage.error(res.data.message);
            } else {
                //console.dir(res);
                if(res.data && res.data.message) toaster.error(res.data.message);
                else toaster.error(res.statusText || "Oops.. unknown authentication error");
            }
        }
    }

    $scope.begin_iucas = function() {
        //I can't pass # for callback somehow (I don't know how to make it work, or iucas removes it)
        //so let's let another html page handle the callback, do the token validation through iucas and generate the jwt 
        //and either redirect to profile page (default) or force user to setup user/pass if it's brand new user
        var casurl = window.location.origin+window.location.pathname+'iucascb.html';
        window.location = $scope.appconf.iucas_url+'?cassvc=IU&casurl='+casurl;
    }

    $scope.begin = function(type) {
        window.location = "/api/auth/"+type+"/signin"; 
    }

    $scope.begin_x509 = function() {
        window.location = $scope.appconf.x509api+"/x509/signin";
    }
    $scope.begin_oidc = function(idp) {
        window.location = "/api/auth/oidc/signin?idp="+encodeURIComponent(idp); 
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

    $scope.refreshIDPs = function(query) {
        if(!query) {
            $scope.oidc_idps = [];
            return;
        }
        console.log("refreshing idps", query);
        $http.get($scope.appconf.api+"/oidc/idp", {params: {q: query}}) 
        .then(function(res) {
            $scope.oidc_idps = res.data;
        })
        .catch(function(res) {
            toaster.error("failed to load IDP list");
            console.error(res);
        });
    }
});

function handle_redirect(appconf) {
    var redirect = sessionStorage.getItem('auth_redirect');
    sessionStorage.removeItem('auth_redirect');
    let path = redirect||appconf.default_redirect_url||'/';

    //pass jwt via url for cross domain authentication
    if(sessionStorage.getItem('jwt_on_url')) {
        path += "?jwt="+localStorage.getItem(appconf.jwt_id);
        sessionStorage.removeItem('jwt_on_url');
    }

    window.location = path;
}

//used by oauth2 callbacks (github, etc..) to set the jwt and redirect
app.controller('SuccessController', 
function($scope, $route, $http, $routeParams, $location, scaMessage, $sce, $rootScope) {
    console.log("successcontroller called");
    //scaMessage.success("Welcome back!");
    localStorage.setItem($scope.appconf.jwt_id, $routeParams.jwt);
    $rootScope.$broadcast("jwt_update", $routeParams.jwt);
    handle_redirect($scope.appconf);
});

app.controller('SignoutController', 
function($scope, $route, $http, $routeParams, menu, $location, scaMessage) {
    //scaMessage.success("Good Bye!");
    localStorage.removeItem($scope.appconf.jwt_id);
    menu.user = null; //scaMenubar watches for this and re-init
    $location.path("/signin");
});

app.controller('SignupController', 
function($scope, $route, toaster, $http, $routeParams, scaMessage, $location, $rootScope, jwtHelper, $sce) {
    $scope.$parent.active_menu = 'signup';
    scaMessage.show(toaster);
    $scope.form = {};

    var postconfig = {};

    //register_new sometimes forwards temp jwt to finish registration (like setting up email - for 3rd part registration?)
    if($routeParams.jwt) {
        $scope.jwt = $routeParams.jwt; //to let UI now that we are *completing* signup
        var user = jwtHelper.decodeToken($routeParams.jwt);

        //pull defaults
        if(user._default.username) $scope.form.username = user._default.username;
        if(user._default.email) $scope.form.email = user._default.email;
        if(user._default.fullname) $scope.form.fullname = user._default.fullname;
        if(user._default.institution) {
            $scope.form.profile = {};
            $scope.form.profile['institution'] = user._default.institution;
        }
        
        //localStorage.setItem($scope.appconf.jwt_id, $routeParams.jwt);
        postconfig.headers =  {
            'Authorization': 'Bearer '+$routeParams.jwt
        }
    }

    $scope.cancel = function() {
        window.location = "#"; //back to login form
    }

    //$scope.aup = $sce.trustAsResourceUrl($scope.appconf.aup);
    $scope.aup = "##hello";

    $scope.submit = async function() {
        //new registration (or do registration complete with temp jwt)
        try {
            let res = await $http.post($scope.appconf.api+'/signup', $scope.form, postconfig)
            if(res.data.jwt) {
                //set the real jwt! (in case email confirmation is disabled)
                localStorage.setItem($scope.appconf.jwt_id, res.data.jwt);
                $rootScope.$broadcast("jwt_update", res.data.jwt);
            }
            if(res.data.message) scaMessage.success(res.data.message);

            /*
            //store public profile (to be posted to profile service when user login for the first time)
            if($scope.form.profile) {
                localStorage.setItem("public.profile", JSON.stringify($scope.form.profile));
            } else {
                localStorage.removeItem("public.profile"); //just in case..
            }
            */
        
            //redirect to somewhere..
            if(res.data.path) $location.path(res.data.path); //maybe .. email_confirmation
            else handle_redirect($scope.appconf);
        } catch(err) {
            console.dir(err);
            if(err.data) toaster.error(err.data.message || err.data);
            else toaster.error(err);
        }
    }
});

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
            $scope.user = res.data; 
            toaster.success("Profile updated successfully");
            $scope.profile_form.$setPristine();
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
        sessionStorage.setItem('auth_redirect', window.location); 
        var casurl = window.location.origin+window.location.pathname+'iucascb.html';
        window.location = $scope.appconf.iucas_url+'?cassvc=IU&casurl='+casurl;
    }
    $scope.connect = function(type) {
        window.location = "/api/auth/"+type+"/associate/"+jwt;
    }
    $scope.x509_connect = function() {
        window.location = $scope.appconf.x509api+'/x509/associate/'+jwt;
    }
});

//public interface
app.controller('ForgotpassController', function($scope, $route, toaster, $http, scaMessage, $routeParams, $location) {
    scaMessage.show(toaster);
    $scope.form = {};

    if($routeParams.token) {
        $scope.state = "reset";
    } else {    
        $scope.state = "init";
    }

    $scope.submit_email = function() {
        $http.post($scope.appconf.api+'/local/resetpass', {email: $scope.form.email})
        .then(function(res) { 
            toaster.success(res.data.message);
            $scope.state = "pending";
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }

    $scope.submit_reset = function() {
        $http.post($scope.appconf.api+'/local/resetpass', {token: $routeParams.token, password: $scope.form.password})
        .then(function(res) { 
            scaMessage.success(res.data.message);
            //$location.path("/");
            handle_redirect($scope.appconf);
        }, function(res) {
            //if(res.data && res.data.message) toaster.error(res.data.message);
            //else toaster.error(res.statusText);
            scaMessage.error("Failed to reset password. Please make sure you are using the same browser you have used to request the password reset.");
            $location.path("/forgotpass");
        });
    }

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

app.controller('AdminUsersController', function($scope, $route, toaster, $http, scaMessage, scaAdminMenu, $location) {
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
function($scope, $route, toaster, $http, scaMessage, scaAdminMenu, $routeParams, $location, $window) {
    scaMessage.show(toaster);
    $scope.$parent.active_menu = 'admin';
    $scope.admin_menu = scaAdminMenu;

    $http.get($scope.appconf.api+'/user/'+$routeParams.sub)
    .then(function(res) { 
        $scope.user = res.data; 
        $scope.x509dns = JSON.stringify($scope.user.ext.x509dns, null, 4);
        $scope.openids = JSON.stringify($scope.user.ext.openids, null, 4);
        $scope.scopes = JSON.stringify($scope.user.scopes, null, 4);
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    });

    $scope.cancel = function() {
        $window.history.back();
    }

    $scope.submit = function() {
        $scope.user.ext.x509dns = JSON.parse($scope.x509dns);
        $scope.user.ext.openids = JSON.parse($scope.openids);
        $scope.user.scopes = JSON.parse($scope.scopes);
        $http.put($scope.appconf.api+'/user/'+$routeParams.sub, $scope.user)
        .then(function(res) { 
            $location.path("/admin/users");
            toaster.success(res.data.message);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }
});

app.controller('GroupsController', function($scope, $route, toaster, $http, scaMessage, profiles, $location) {
    $scope.$parent.active_menu = 'groups';
    scaMessage.show(toaster);

    profiles.then(function(_users) { 
        $scope.users = _users;
        $http.get($scope.appconf.api+'/groups')
        .then(res=>{ 
            res.data.sort((a,b)=>{
                if(a.id < b.id) return -1;
                if(a.id > b.id) return 1;
                return 0
            });
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
    $scope.group = {
        active: true,
    };
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
            $scope.group.admins.forEach(function(admin) {
                $scope.users.forEach(function(user) {
                    if(admin._id == user._id) $scope.admins.push(user);
                });
            });
 
            $scope.members = [];
            $scope.group.members.forEach(function(member) {
                $scope.users.forEach(function(user) {
                    if(member._id == user._id) $scope.members.push(user);
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
            admins.push(admin.sub);
        });
        var members = [];
        $scope.members.forEach(function(member) {
            members.push(member.sub);
        });
        var body = {
            name: $scope.group.name,
            desc: $scope.group.desc,
            active: $scope.group.active,
            admins,
            members,
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

app.controller('SendEmailConfirmationController', function($scope, $route, toaster, $http, scaMessage, scaAdminMenu, $routeParams, $location) {
    scaMessage.show(toaster);
    $scope.$parent.active_menu = 'user';
});

app.controller('ConfirmEmailController', function($scope, $route, toaster, $http, scaMessage, scaAdminMenu, $routeParams, $location) {
    scaMessage.show(toaster);
    $scope.$parent.active_menu = 'user';

    if($routeParams.sub) {
        setTimeout(()=>{
            $scope.$apply(function() {
                $scope.sub = $routeParams.sub;
            });
        }, 2000);
    }

    $scope.resend = function() {
        $http.post($scope.appconf.api+'/send_email_confirmation', {sub: $scope.sub})
        .then(function(res) { 
            toaster.success(res.data.message);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }

    if($routeParams.token) {
        $http.post($scope.appconf.api+'/confirm_email', {token: $routeParams.token})
        .then(function(res) { 
            //console.log("email confirmation successfull");
            scaMessage.success(res.data.message);
            $location.path("/"); //I need to redirect user to login after email confirmation
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }
});


