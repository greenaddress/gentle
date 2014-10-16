'use strict';

/* Directives */


angular.module('gentleApp.directives', []).
  directive('appVersion', ['version', function(version) {
    return function(scope, elm, attrs) {
      elm.text(version);
    };
  }])
.directive('modalTransclude', function () {
    return {
      link: function($scope, $element, $attrs, controller, $transclude) {
        var parentPlusModal = $scope.$parent.$new();
        parentPlusModal.modal_scope = $scope;
        $transclude(parentPlusModal, function(clone) {
          $element.empty();
          $element.append(clone);
        });
      }
    };
  })
.directive('modalDialog', function() {
    return {
        restrict: 'E',
        scope: {
            show: '='
        },
        replace: true, // Replace with the template below
        transclude: true, // we want to insert custom content inside the directive
        link: function(scope, element, attrs) {
            scope.dialogStyle = {};
            if (attrs.width)
                scope.dialogStyle.width = attrs.width;
            if (attrs.height)
                scope.dialogStyle.height = attrs.height;
            scope.hideModal = function() {
                scope.show = false;
            };
        },
        template: "<div class='ng-modal' ng-show='show'><div class='ng-modal-overlay' ng-click='hideModal()'></div>" +
            "<div class='ng-modal-dialog' ng-style='dialogStyle'><div class='ng-modal-close' ng-click='hideModal()'>x</div>" +
            "<div class='ng-modal-dialog-content' modal-transclude></div></div></div>"
    };
});