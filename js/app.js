'use strict';


// Declare app level module which depends on filters, and services
angular.module('gentleApp', [
  'ngRoute',
  'gentleApp.filters',
  'gentleApp.services',
  'gentleApp.directives',
  'gentleApp.controllers',
  'ngCsv',
  'ngSanitize',
  'ja.qr'
]).
config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/view1', {templateUrl: 'partials/partial1.html', controller: 'MyCtrl1'});
  $routeProvider.otherwise({redirectTo: '/view1'});
}]).
config(['$httpProvider', function($httpProvider) {
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With']}]);
