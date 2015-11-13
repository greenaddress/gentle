'use strict';

/* Services */

angular.module('gentleApp.services', [])
    .factory('gentle_services', ['$http', '$q', '$timeout', function($http, $q, $timeout) {
        var workerspool = {};
        var gentle_services = {};
        var pool = new Pool(8);
        pool.init();

        function Pool(size) {
            var _this = this;
            this.taskQueue = [];
            this.workerQueue = [];
            this.poolSize = size;

            this.addWorkerTask = function(workerTask) {
                if (_this.workerQueue.length > 0) {
                    var workerThread = _this.workerQueue.shift();
                    workerThread.run(workerTask);
                } else {
                    _this.taskQueue.push(workerTask);
                }
            };

            this.init = function() {
                for (var i = 0 ; i < size ; i++) {
                    _this.workerQueue.push(new WorkerThread(_this));
                }
            };

            this.freeWorkerThread = function(workerThread) {
                if (_this.taskQueue.length > 0) {
                    var workerTask = _this.taskQueue.shift();
                    workerThread.run(workerTask);
                } else {
                    _this.taskQueue.push(workerThread);
                }
            }
        }

        function WorkerThread(parentPool) {

            var _this = this;

            this.parentPool = parentPool;
            this.workerTask = {};

            this.run = function(workerTask) {
                this.workerTask = workerTask;
                if (this.workerTask.script!= null) {
                    var worker = new Worker(workerTask.script);
                    worker.addEventListener('message', dummyCallback, false);
                    worker.postMessage(workerTask.startMessage);
                }
            };

            function dummyCallback(event) {
                _this.workerTask.callback(event);

                _this.parentPool.freeWorkerThread(_this);
            }

        }
        function WorkerTask(script, callback, msg) {

            this.script = script;
            this.callback = callback;
            this.startMessage = msg;
        }


        gentle_services.parseTx = function(index, tx, seed, callback, errback) {
            var deferred = $q.defer();
            var cb = function(res) {
                if (res.data.error) {
                    errback(index, res.data.error);
                    return;
                }
                var transaction = Bitcoin.Transaction.fromHex(res.data.json.tx);
                var output = {'json': res.data.json,
                    'unsigned': res.data.unsigned,
                    'parsed': transaction,
                    'b58privkey': res.data.b58privkey,
                    'pointer': res.data.pointer,
                    'subaccount': res.data.subaccount ? res.data.subaccount : 0,
                    'amount': res.data.amount,
                    'privkey': res.data.privkey,
                    'rawtx': res.data.rawtx,
                    'push': false};
                callback(index, output);
            };
            var workerTask = new WorkerTask("lib/gait/gentle_workers.js", cb, {'message': 'parse', 'tx': tx, 'seed': seed});
            pool.addWorkerTask(workerTask);
            return deferred.promise;
        };

        gentle_services.fetch_block = function(retries, max_retries, deferred) {
            var refetch = function() {
                retries++;
                if (retries <= max_retries) {
                    $timeout(function () {
                        gentle_services.fetch_block(retries, max_retries, deferred)
                    }, 20000)
                } else {
                    deferred.reject('max retries');
                    return false
                }
            };
            $http.get('https://btc.blockr.io/api/v1/block/info/last').success(function(data) {
                try {
                    var res = angular.fromJson(data);
                    if (('data' in res) && ('nb' in res['data'])) {
                        deferred.resolve(data['data']['nb']);
                    } else {
                        refetch()
                    }
                } catch(e) {
                    console.log(e);
                    refetch()
                }
            }).error(function(reason) {
                refetch()
            });
        };

        gentle_services.setFetchBlockInterval = function() {
            var deferred = $q.defer();
            var retries = 0;
            var max_retries = 10;
            gentle_services.fetch_block(retries, max_retries, deferred);
            return deferred.promise
        };

        gentle_services.push_tx = function(raw_tx) {
            var deferred = $q.defer();
            $http.post('https://btc.blockr.io/api/v1/tx/push', 'hex='+raw_tx,
                {headers: {"Content-Type": "application/x-www-form-urlencoded"}
                }).success(function(res) {
                    deferred.resolve({'status': res.status, 'rawtx': raw_tx, 'data': res.data})
                }).error(function(res) {
                    deferred.resolve({'status': res.status, 'rawtx': raw_tx, 'data': res.data})
                });
            return deferred.promise
        };

        gentle_services.push_txs = function(push_pool, cb) {
            var i = 0;
            var push_tx_deferred = function() {
                var promise = gentle_services.push_tx(push_pool[i]);
                promise.then(function(res) {
                    cb(i, res);
                    i += 1;
                    if (i < push_pool.length) {
                        $timeout(function() {
                            push_tx_deferred()
                        }, 20000)
                    }
                })
            };
            push_tx_deferred();
        };

    return gentle_services
    }]
);
