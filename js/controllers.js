'use strict';


/* Controllers */
angular.module('gentleApp.controllers', ['gentleApp.mnemonics_services']).
    controller('MyCtrl1', ['$scope', 'mnemonics', 'gentle_services', '$timeout', '$q',  function($scope, mnemonics, gentle_services, $timeout, $q) {
        var gentle = $scope.gentle = {'fetched_block': null,
                                      'txs': {},
                                      'unparsed_rtimes': [],
                                      'unparsed_rdates': [],
                                      'show_transactions': [],
                                      'push_selected': [],
                                      'select_all_txs': false,
                                      'enable_push': false,
                                      'txs_index': {},
                                      'remaining_time_push': '',
                                      'redeemable': []
        };

        var fetchblock_promise = gentle_services.setFetchBlockInterval();
        fetchblock_promise.then(function(block) {
            gentle.fetched_block = block;
            for (var i = 0; i < gentle['unparsed_rtimes'].length; i++) {
                set_redeem_time(gentle.unparsed_rtimes[i]);
            }
            for (var i = 0; i < gentle['unparsed_rdates'].length; i++) {
                set_redeem_date(gentle.unparsed_rdates[i]);
            }
        }, function(e) {
            gentle.err = e;
        });

        var set_redeem_time = function(tx) {
            var block = tx.parsed.locktime;
            var text = ''; var hours = 0; var days = 0; var minutes = 0;
            var remainings = block - gentle.fetched_block;
            if (remainings <= 0) {
                text = 'Reedemable'
            } else if (remainings <= 9) {
                text = remainings * 10 + ' minutes left'
            } else if (remainings <= 144) {
                hours = (remainings / 6).toFixed();
                minutes = (remainings % 6);
                if (minutes > 0) {
                    text = hours + ' hour' + ((hours > 1) ? 's, ' : ', ') + minutes*10 + ' minutes left'
                } else {
                    text = hours + ' hour'+ ((hours > 1) ? 's ' : ' ') + 'left'
                }
            } else {
                days = (remainings / 144).toFixed();
                hours = 1*((remainings % 144) / 6).toFixed()
                if (hours > 0) {
                    text = days + ' day' + ((days > 1) ? 's, ' : ', ') + hours + ' hour' + ((hours > 1) ? 's ' : ' ') + 'left'
                } else {
                    text = days + ' day'+ ((days > 1) ? 's ' : ' ') + 'left'
                }
                gentle.redeemable.push(tx)
            }
            tx.redeem_countdown = text;
        };

        var set_redeem_date = function(tx) {
            var block = tx.parsed.locktime;
            var d = 0;  var locktime = 0; var lockdate = 0;
            var remainings = block - gentle.fetched_block;
            d = 1*(Date.now()/1000).toFixed()
            locktime = 600 * remainings;
            if (remainings <= 0) {
                lockdate = (new Date((d + locktime)*1000)).toUTCString()
            } else {
                lockdate = (new Date((d - locktime)*1000)).toUTCString()
            }
            tx.redeem_date = lockdate;
        };

        var showTx = function(index, tx) {
            gentle.total_signed = gentle.show_transactions.length + '/' + gentle.transactions.length;
            gentle.txs[tx.rawtx] = tx;
            var csv = {'key': tx.b58privkey, 'hash': tx.rawtx, 'locktime': tx.parsed.locktime};
            gentle.csv.push(csv);
            if (gentle.fetched_block) {
                set_redeem_time(tx);
                set_redeem_date(tx);
            } else {
                tx.redeem_countdown = tx.redeem_date = '...';
                gentle.unparsed_rtimes.push(tx);
                gentle.unparsed_rdates.push(tx);
            }
            tx.status = tx.redeem_countdown;
            $scope.$apply(function() {
                gentle.transactions[index] = tx;
                gentle.show_transactions[index] = tx;
            });
        };

        var process = function() {
            gentle.validating = true;
            gentle.transactions = [];
            var mnemonic_words = gentle.mnemonic.split(' ');
            var last_word = mnemonic_words[mnemonic_words.length-1];
            // BTChip seed ends with 'X':
            if (last_word.indexOf('X') == last_word.length-1) {
                var validate_d = $q.when(true);
            } else {
                var validate_d = $q.when(mnemonics.validateMnemonic(gentle.mnemonic));
            }
            validate_d.then(function() {
                gentle.err = undefined;
                var failed = false, parsed_txs = [];
                for (var i = 0; i < gentle.in_transactions.length; i++) {
                    var json_unparsed = gentle.in_transactions[i];
                    // 1. Parse JSON
                    try {
                        var json = JSON.parse(json_unparsed);
                    } catch (e) {
                        failed = true;
                        gentle.err = e.message;
                        break;
                    }

                    // 2. Verify all required attributes are present
                    if (!json.prevout_pointers) {
                        failed = true;
                        gentle.err = "Missing prevout_pointers";
                        break;
                    }
                    if (!json.tx) {
                        failed = true;
                        gentle.err = "Missing tx";
                        break;
                    }

                    //3. Parse transaction
                    try {
                        var tx = Bitcoin.Transaction.deserialize(json.tx);
                        var locktime = tx.locktime;
                    } catch (e) {
                        failed = true;
                        gentle.err = "Incorrect transaction: " + e.message;
                        break;
                    }

                    gentle.transactions.push({json: json, parsed: tx, locktime: tx.locktime});
                }
                gentle.transactions.sort(function(a, b) { return a.locktime - b.locktime; });
                if (!failed) {
                    var do_transactions = function() {
                        var pool = [];
                        gentle['csv'] = [];
                        var totals = 0 ;
                        gentle.total_signed = '0/' + gentle.transactions.length;
                        gentle.signing_transactions = true;
                        for (var i = 0; i < gentle.transactions.length; i++) {
                            gentle_services.parseTx(i, gentle.transactions[i], gentle.seed, showTx);
                        }
                        gentle.validating = false;
                    };

                    if (gentle.seed && gentle.seed_for == gentle.mnemonic) {
                        do_transactions();
                    } else {
                        if (last_word.indexOf('X') == last_word.length-1) {
                            var seed_d = $q.when(last_word.slice(0, -1));
                        } else {
                            var seed_d = mnemonics.toSeed(gentle.mnemonic);
                        }
                        seed_d.then(function(data) {
                            gentle.progress = 100;
                            gentle.seed = data;
                            gentle.seed_for = gentle.mnemonic;
                            do_transactions();
                        }, undefined, function(progress) {
                            gentle.progress = progress;
                        });
                    }
                } else {
                    gentle.validating = false;
                }
            }, function(err) {
                console.log(err);
                gentle.validating = false;
                gentle.progress = 0;
                gentle.err = err;
            });
        };

        var watchFun = function(newValue, oldValue) {
            if (newValue == oldValue) return;
            if (gentle.mnemonic && gentle.in_transactions) {
                process();
            }
        };

        $scope.file_changed = function(element) {
            var reader = new FileReader();
            reader.onload = function(ev) {
                gentle.in_transactions = [];
                try {
                    // var dateBefore = new Date();
                    var zip = new JSZip(ev.target.result);
                    // var dateAfter = new Date();
                    // console.log("zip file parsed in " + (dateAfter - dateBefore) + "ms");
                    for (var i in zip.files) {
                        var zip_entry = zip.files[i];
                        // console.log(zip_entry.name);
                        gentle.in_transactions.push(zip_entry.asText());
                    }
                    if (gentle.mnemonic && gentle.in_transactions) {
                        process();
                    }
                } catch(e) {
                    gentle.err = "Error reading " + element.files[0].name + ": " + e.message
                }
            };
            reader.readAsArrayBuffer(element.files[0]);
        };

        $scope.$watch('gentle.mnemonic', watchFun);
        $scope.modal = {'qrcode': null};
        $scope.modalShown = false;
        $scope.confirmPush = false;
        $scope.pushTx = function(raw_tx) {
            $scope.modal.push_message = '';
            var promise = gentle_services.push_tx(raw_tx, 0);
            promise.then(function(value) {
                if (value['status'] == 'fail') {
                    $scope.modal.push_message = 'Push failed: ' + value['data']
                    var tstatus = '<b>Push failed</b>'
                } else if (value['status'] == 'success') {
                    $scope.modal.push_message = 'Push successful, hash: <a target="_blank" href="http://btc.blockr.io/tx/info/'+value['data']+'">' + value['data'] + '</a>'
                    var tstatus = '<b>Pushed</b>'
                } else {
                    $scope.modal.push_message = 'Unknown response, see console log';
                    var tstatus = '<b>Push failed</b>'
                }
                for (var i = 0; i < gentle.show_transactions.length; i++) {
                    if (gentle.show_transactions[i].rawtx == raw_tx) {
                        gentle.show_transactions[i].status = tstatus;
                        return 0
                    }
                }
            })
        };

        $scope.toggleModal = function(rawtx) {
            var push_res = function() {
                var value = gentle.txs[rawtx].push_response;
                if (value['status'] == 'fail') {
                    var push_message = 'Push failed: ' + value['data']
                } else if (value['status'] == 'success') {
                    var push_message = 'Push successful, hash: <a target="_blank" href="http://btc.blockr.io/tx/info/'+value['data']+'">' + value['data'] + '</a>'
                } else {
                    var push_message = 'Unknown response, see console log';
                }
                return push_message
            };
            $scope.modal.tx = gentle['txs'][rawtx];
            $scope.modal.qrcode = $scope.modal.tx.b58privkey;
            $scope.modal.push_message = gentle['txs'][rawtx].push_response ? push_res() : '';
            $scope.modal.show_rawtx = false;
            $scope.modalShown = !$scope.modalShown;
        };

        $scope.confirmPushModalShown = false;
        $scope.confirmPushModal = function() {
            $scope.confirmPushModalShown = !$scope.confirmPushModalShown;
        };

        $scope.selectTx = function(rawtx) {
            if (gentle.txs[rawtx].parsed.locktime < gentle.fetched_block) {
                if (gentle.txs[rawtx].push) {
                    gentle.push_selected.push(gentle.txs[rawtx].rawtx);
                } else {
                    var index = gentle.push_selected.indexOf(gentle.txs[rawtx].rawtx);
                    gentle.push_selected.splice(index, 1);
                }
            }
        };

        $scope.selectAllTxs = function() {
            var status = gentle.select_all_txs;
            for (var key in gentle.txs) {
                if (gentle.txs[key].parsed.locktime < gentle.fetched_block) {
                    gentle.txs[key].push = status;
                    if (status) {
                        gentle.push_selected.push(gentle.txs[key].rawtx)
                    } else {
                        gentle.push_selected = []
                    }
                }
            }
            console.log(gentle.push_selected)
        };

        $scope.pushSelectedTxs = function() {
            var push_pool = [];
            var cb = function(i, value) {
                if (value['status'] == 'fail') {
                    gentle.show_transactions[i].status = '<b>Push failed</b>';
                    gentle.show_transactions[i].push_response = value
                } else if (value['status'] == 'success') {
                    gentle.show_transactions[i].status = '<b>Pushed</b>';
                    gentle.show_transactions[i].push_response = value
                } else {
                    gentle.show_transactions[i].status = '<b>Push failed</b>';
                    gentle.show_transactions[i].push_response = value;
                }
            };

            for (var i = 0; i < gentle.push_selected.length; i++) {
                push_pool.push(gentle.show_transactions[i].rawtx);
                gentle.show_transactions[i].status = 'Queued';
            }
            gentle_services.push_txs(push_pool, cb);
            $scope.setPushRemaining(Date.now()+((push_pool.length-1)*20000));
        };

        $scope.setPushRemaining = function(timeout) {
            var timeleft = timeout - Date.now();
            gentle.pushing = true;
            gentle.remaining_time_push = (timeleft/1000).toFixed();
            var interval = function() {
                $timeout(function() {
                    var timeleft = timeout - Date.now();
                    if (timeleft >= 0) {
                        $scope.$apply(function() {
                            gentle.pushing = true;
                            gentle.remaining_time_push = (timeleft/1000).toFixed();
                            interval()
                        })
                    } else {
                        $scope.$apply(function() {
                            gentle.pushing = false;
                            gentle.remaining_time_push = 0
                        });
                    }
                }, 1000)
            };
            interval()
        };

    }]);
