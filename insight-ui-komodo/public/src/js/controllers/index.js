"use strict";

var TRANSACTION_DISPLAYED = 10;
var BLOCKS_DISPLAYED = 10;

angular
  .module("insight.system")
  .controller("IndexController", function (
    $scope,
    Global,
    getSocket,
    Blocks,
    Block
  ) {
    $scope.global = Global;

    var _getBlocks = function () {
      Blocks.get({
          limit: BLOCKS_DISPLAYED
        },
        function (res) {

          Block.get({
            blockHash: res.blocks[0].hash
          }, function (block) {
            $scope.lastNotarizedHeight = block.lastNotarizedHeight;
          }, function (e) {
            if (e.status === 400) {
              //  $rootScope.flashMessage = 'Invalid Transaction ID: ' + $routeParams.txId;
            } else if (e.status === 503) {
              $rootScope.flashMessage = 'Backend Error. ' + e.data;
            } else {
              //   $rootScope.flashMessage = 'Block Not Found';
            }

          });

          $scope.blocks = res.blocks;
          $scope.blocksLength = res.length;
        }
      );
    };

    var socket = getSocket($scope);

    var _startSocket = function () {
      socket.emit("subscribe", "inv");
      socket.on("tx", function (tx) {
        $scope.txs.unshift(tx);
        if (
          parseInt($scope.txs.length, 10) >= parseInt(TRANSACTION_DISPLAYED, 10)
        ) {
          $scope.txs = $scope.txs.splice(0, TRANSACTION_DISPLAYED);
        }
      });

      socket.on("block", function () {
        _getBlocks();
      });
    };

    socket.on("connect", function () {
      _startSocket();
    });

    $scope.humanSince = function (time) {
      var m = moment.unix(time);
      return moment.min(m).fromNow();
    };

    $scope.index = function () {
      _getBlocks();
      _startSocket();
    };

    $scope.txs = [];
    $scope.blocks = [];
  });
