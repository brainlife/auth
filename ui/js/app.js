'use strict';

var app = angular.module('app', [
    'app.config',
    'ngRoute',
    'ngAnimate',
    'ngCookies',
    'toaster',
    'angular-loading-bar',
    'angular-jwt',
    'ui.bootstrap',
    'sca-shared',
    'ui.gravatar',
    'ui.select'
]);

//http://wijmo.com/easy-form-validation-in-angularjs/
//note - error message only shows when user submit the form
app.directive('match', function () {
  return {
    require: 'ngModel',
    link: function (scope, elm, attrs, ctl) {
      scope.$watch(attrs['match'], function (errorMsg) {
        elm[0].setCustomValidity(errorMsg);
        ctl.$setValidity('match', errorMsg ? false : true);
      });
    }
  };
});
app.directive('validjson', function () {
  return {
    require: 'ngModel',
    link: function (scope, elm, attrs, ctrl) {
        /*
        scope.$watch(elm[0].value, function (errorMsg) {
            console.log("validating");
            console.log(elm[0].value);
            elm[0].setCustomValidity("invalid for whatever");
            ctl.$setValidity('validjson', false);
        });
        */
        ctrl.$parsers.unshift(function(value) {
            var valid = true;
            try {
                JSON.parse(value);
                elm[0].setCustomValidity('');
            } catch (e) {
                elm[0].setCustomValidity("Couldn't parse JSON");
                valid = false;
            }
            ctrl.$setValidity('validjson', valid);
            return valid ? value : undefined;
        });
    }
  };
});

app.factory('profiles', ['appconf', '$http', 'jwtHelper', 'toaster', function(appconf, $http, jwtHelper, toaster) {
    return $http.get(appconf.api+'/profiles')
    .then(function(res) {
        return res.data;
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    });
}]);

/*replaced by scaRedirector
//redirecto to whevever user needs to go after auccessful login
app.factory('redirector', ['$location', '$routeParams', 'appconf', 
function($location, $routeParams, appconf) {
    if(!localStorage.getItem('post_auth_redirect')) {
        if($routeParams.redirect) {
            localStorage.setItem('post_auth_redirect', $routeParams.redirect);
        } else if(document.referrer) {
            console.log("referrer set to "+document.referrer);
            localStorage.setItem('post_auth_redirect', document.referrer);
        } else {
            //last resort.. just forward some preconfigured location
            localStorage.setItem('post_auth_redirect', appconf.default_redirect_url);
        }
    }

    return {
        //redirect to specified url
        //returns true if redirecting out of the page
        go: function() {
            var redirect = localStorage.getItem('post_auth_redirect');
            localStorage.removeItem('post_auth_redirect');
            window.location = redirect;

            //if url starts with #, then it's internal redirect
            if(redirect[0] == "#") return false;
            return true;
        }
    }
}]);
*/

/*
app.factory('cookie2toaster', ['$cookies', 'toaster', function($cookies, toaster) {
    //sometime we get error messages via cookie (like iucas registration failurer)
    var messages = $cookies.get("messages");
    if(messages) {
        JSON.parse(messages).forEach(function(message) {
            if(message.type == "error") {
                //make it sticky (show close button and no-timeout)
                toaster.pop({
                    type: message.type, 
                    title: message.title, 
                    body: message.message, 
                    showCloseButton: true, timeout: 0
                });
            } else {
                toaster.pop(message.type, message.title, message.message);
            }
        });
        //why path="/"? Without it, it tries to remove cookie under just /auth path and not find messges
        //that comes from other apps. (make sure to set cookie under "/" on your other apps)
        $cookies.remove("messages", {path: "/"}); 
    }
    return null;
}]);
*/

/*
//use this service if you want to keep renewing jwt
app.factory('jwt_refresher', ['appconf', '$http', 'toaster', 'jwtHelper', function(appconf, $http, toaster, jwtHelper) {
    var refresher = setInterval(function() {
        var jwt = localStorage.getItem('jwt');
        if(jwt) {
            console.log("renewing jwt");
            $http.get(appconf.api+'/refresh')
            .success(function(data, status, headers, config) {
                localStorage.setItem(appconf.jwt_id, data.jwt);
                
                //debug
                var token = jwtHelper.decodeToken(data.jwt);
                console.log(token);
            })
            .error(function(data, status, headers, config) {
                toaster.error(data.message);
            }); 
        }
    }, 1000*60); //every minutes?
    return refresher;
}]);
*/

//show loading bar at the top
app.config(['cfpLoadingBarProvider', function(cfpLoadingBarProvider) {
    cfpLoadingBarProvider.includeSpinner = false;
}]);

//set allowed jwt provider
app.config(function(appconf, $httpProvider, jwtOptionsProvider) {
    jwtOptionsProvider.config({
      whiteListedDomains: appconf.jwt_whitelist,
    });
});

//configure route
app.config(['$routeProvider', 'appconf', function($routeProvider, appconf) {
    $routeProvider.
    when('/signin', {
        templateUrl: 't/signin.html',
        controller: 'SigninController'
    }).
    when('/success/:jwt', {
        template: '',
        controller: 'SuccessController'
    })
    .when('/signout', {
        template: '',
        controller: 'SignoutController'
    })
    .when('/register', {
        templateUrl: 't/register.html',
        controller: 'RegisterController',
        requiresLogin: true
    })
    .when('/forgotpass', {
        templateUrl: 't/forgotpass.html',
        controller: 'ForgotpassController'
    })
    .when('/signup', {
        templateUrl: 't/signup.html',
        controller: 'SignupController'
    })
    .when('/settings/account', {
        templateUrl: 't/account.html',
        controller: 'AccountController',
        requiresLogin: true
    })
    .when('/admin/users', {
        templateUrl: 't/adminusers.html',
        controller: 'AdminUsersController',
        requiresLogin: true
    })
    .when('/admin/user/:id', {
        templateUrl: 't/adminuser.html',
        controller: 'AdminUserController',
        requiresLogin: true
    })
    .when('/groups', {
        templateUrl: 't/groups.html',
        controller: 'GroupsController',
        requiresLogin: true
    })
    .when('/group/:id', {
        templateUrl: 't/group.html',
        controller: 'GroupController',
        requiresLogin: true
    })
    .when('/inactive', {
        templateUrl: 't/inactive.html',
        //controller: 'AdminUserController',
    })
    .when('/confirm_email', {
        templateUrl: 't/confirm_email.html',
        controller: 'ConfirmEmailController',
    })
    .otherwise({
        redirectTo: '/signin'
    });
    
    //console.dir($routeProvider);
}]).run(['$rootScope', '$location', 'toaster', 'jwtHelper', 'appconf', function($rootScope, $location, toaster, jwtHelper, appconf) {
    $rootScope.$on("$routeChangeStart", function(event, next, current) {
        //console.log("route changed from "+current+" to :"+next);
        //redirect to /login if user hasn't authenticated yet
        if(next.requiresLogin) {
            var jwt = localStorage.getItem(appconf.jwt_id);
            if(jwt == null || jwtHelper.isTokenExpired(jwt)) {
                toaster.warning("Please singin first");
                sessionStorage.setItem('auth_redirect', '#'+next.originalPath);
                $location.path("/signin");
                event.preventDefault();
            }
        }
    });
}]);

//configure httpProvider to send jwt unless skipAuthorization is set in config (not tested yet..)
app.config(['appconf', '$httpProvider', 'jwtInterceptorProvider', 
function(appconf, $httpProvider, jwtInterceptorProvider) {
    jwtInterceptorProvider.tokenGetter = function(jwtHelper, $http) {
        //don't send jwt for template requests
        //if (config.url.substr(config.url.length - 5) == '.html') return null;
        return localStorage.getItem(appconf.jwt_id);
    }
    $httpProvider.interceptors.push('jwtInterceptor');
}]);

app.factory('menu', ['appconf', '$http', 'jwtHelper', '$sce', 'scaMessage', 'scaMenu', 'toaster',
function(appconf, $http, jwtHelper, $sce, scaMessage, scaMenu, toaster) {
    var jwt = localStorage.getItem(appconf.jwt_id);
    var menu = {
        header: {
            //label: appconf.title,
        },
        top: scaMenu,
        user: null, //to-be-loaded
        _profile: null, //to-be-loaded
    };
    if(appconf.icon_url) menu.header.icon = $sce.trustAsHtml("<img src=\""+appconf.icon_url+"\">");
    if(appconf.home_url) menu.header.url = appconf.home_url

    var jwt = localStorage.getItem(appconf.jwt_id);
    if(jwt) {
        try {
            var expdate = jwtHelper.getTokenExpirationDate(jwt);
        } catch (e) {
            toaster.error(e);
            localStorage.removeItem(appconf.jwt_id);
        }
        var ttl = expdate - Date.now();
        if(ttl < 0) {
            toaster.error("Your login session has expired. Please re-sign in");
            localStorage.removeItem(appconf.jwt_id);
        } else {
            menu.user = jwtHelper.decodeToken(jwt);
            if(ttl < 3600*1000) {
                //jwt expring in less than an hour! refresh!
                console.log("jwt expiring in an hour.. refreshing first");
                $http({
                    url: appconf.auth_api+'/refresh',
                    //skipAuthorization: true,  //prevent infinite recursion
                    //headers: {'Authorization': 'Bearer '+jwt},
                    method: 'POST'
                }).then(function(response) {
                    var jwt = response.data.jwt;
                    localStorage.setItem(appconf.jwt_id, jwt);
                    menu.user = jwtHelper.decodeToken(jwt);
                });
            }
        }
    }

    if(menu.user) {
        //$http.get(appconf.profile_api+'/public/'+menu.user.sub).then(function(res) {
        $http.get(appconf.api+'/me/').then(function(res) {
            //console.dir(res.data);
            menu._profile = res.data;
        });
    }
    return menu;
}]);

/*
app.filter('pullcn', function() {
    return function(input) {
        var pos = input.indexOf("/CN=");
        return input.substr(pos);
    };
});
*/

//http://plnkr.co/edit/juqoNOt1z1Gb349XabQ2?p=preview
/**
 * AngularJS default filter with the following expression:
 * "person in people | filter: {name: $select.search, age: $select.search}"
 * performs a AND between 'name: $select.search' and 'age: $select.search'.
 * We want to perform a OR.
 */
app.filter('propsFilter', function() {
  return function(items, props) {
    var out = [];

    if (angular.isArray(items)) {
      items.forEach(function(item) {
        var itemMatches = false;

        var keys = Object.keys(props);
        for (var i = 0; i < keys.length; i++) {
          var prop = keys[i];
          var text = props[prop].toLowerCase();
          if (item[prop] && item[prop].toString().toLowerCase().indexOf(text) !== -1) {
            itemMatches = true;
            break;
          }
        }

        if (itemMatches) {
          out.push(item);
        }
      });
    } else {
      // Let the output be the input untouched
      out = items;
    }

    return out;
  };
});

app.directive('userlist', function() {
    return {
        scope: { users: '=', },
        templateUrl: 't/userlist.html',
    }
});

