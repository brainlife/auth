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

app.factory('profiles', function(appconf, $http, jwtHelper, toaster) {
    return $http.get(appconf.api+'/profile', {params: {limit: 3000}})
    .then(function(res) {
        return res.data.profiles;
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    });
});

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
    .when('/forgotpass/:token?', {
        templateUrl: 't/forgotpass.html',
        controller: 'ForgotpassController'
    })
    .when('/signup/:jwt?', {
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
    })
    .when('/confirm_email/:sub?/:token?', {
        templateUrl: 't/confirm_email.html',
        controller: 'ConfirmEmailController',
    })
    .otherwise({
        redirectTo: '/signin'
    });
}]).run(['$rootScope', '$location', 'toaster', 'jwtHelper', 'appconf', function($rootScope, $location, toaster, jwtHelper, appconf) {
    $rootScope.$on("$routeChangeStart", function(event, next, current) {
        //redirect to /login if user hasn't authenticated yet
        if(next.requiresLogin) {
            var jwt = localStorage.getItem(appconf.jwt_id);
            if(jwt == null || jwtHelper.isTokenExpired(jwt)) {
                toaster.warning("Please sign in first");
                sessionStorage.setItem('auth_redirect', '#!'+next.originalPath);
                $location.path("/signin");
                event.preventDefault();
            }
        }
    });
}]);

//configure httpProvider to send jwt unless skipAuthorization is set in config (not tested yet..)
app.config(function(appconf, $httpProvider, jwtInterceptorProvider) {
    jwtInterceptorProvider.tokenGetter = function(jwtHelper, $http) {
        //don't send jwt for template requests
        return localStorage.getItem(appconf.jwt_id);
    }
    $httpProvider.interceptors.push('jwtInterceptor');
});

app.factory('menu', function(appconf, $http, jwtHelper, $sce, toaster, $rootScope) {
    var menu = {
        header: {},
        user: null, //to-be-loaded
        _profile: null, //to-be-loaded
    };
    if(appconf.icon_url) menu.header.icon = $sce.trustAsHtml("<img src=\""+appconf.icon_url+"\">");
    if(appconf.home_url) menu.header.url = appconf.home_url
    
    var jwt = localStorage.getItem(appconf.jwt_id);
    if(jwt == undefined) console.log("undefined is");
    if(jwt != undefined) console.log("undefined is not");
    if(jwt) apply_jwt(jwt);
    function apply_jwt(jwt) {
        console.log("applying jwt", jwt);
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
                    method: 'POST'
                }).then(function(response) {
                    var jwt = response.data.jwt;
                    localStorage.setItem(appconf.jwt_id, jwt);
                    menu.user = jwtHelper.decodeToken(jwt);
                });
            }
        }
    }

    //when jwt is updated, I need to re-apply it to update the menu
    $rootScope.$on('jwt_update', function(event, jwt) { 
        console.log("jwt update event", jwt);
        apply_jwt(jwt); 
    });

    return menu;
});

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

