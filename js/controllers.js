'use strict';

/* Controllers */

angular.module('gentleApp.controllers', ['gentleApp.mnemonics_services']).
    controller('MyCtrl1', ['$scope', 'mnemonics', function($scope, mnemonics) {
        var gentle = $scope.gentle = {};
        var signTx = function(json, tx, seed) {
            gentle.validating = false;
            var hdwallet = new GAHDWallet({seed_hex: seed});
            var master = hdwallet.subkey(1, false, true);
            var privkey;
            for (var i = 0; i < tx.ins.length; ++i) {
                var in_ = tx.ins[i];
                var key = master.subkey(json.prevout_pointers[i], false, true);
                key = new Bitcoin.ECKey(key.secret_exponent);
                if (i == 0) privkey = key;
                var script = new Bitcoin.Script(in_.script.chunks[3]);
                var sign = key.sign(tx.hashTransactionForSignature(script, i, SIGHASH_ALL));
                sign = Bitcoin.ECDSA.serializeSig(sign.r, sign.s);
                sign.push(SIGHASH_ALL);

                var in_script = new Bitcoin.Script();
                in_script.writeOp(0);
                in_script.writeBytes(in_.script.chunks[1]);  // ga sig
                in_script.writeBytes(sign);  // user's sig
                in_script.writeBytes(in_.script.chunks[3]);  // 2of2 outscript
                console.log(in_script);
                in_.script = in_script;
            }
            gentle.rawtx = Crypto.util.bytesToHex(tx.serialize());
            gentle.privkey = privkey.toString();
        }
        var process = function() {
            gentle.validating = true;
            mnemonics.validateMnemonic(gentle.mnemonic).then(function() {
                gentle.err = undefined;
                var failed = false, json, tx;
                try {
                    json = JSON.parse(gentle.json);
                } catch (e) {
                    failed = true;
                    gentle.err = e.message;                       
                }
                if (!failed) {
                    if (!json.prevout_pointers) {
                        failed = true;
                        gentle.err = "Missing prevout_pointers"
                    }
                    if (!json.tx) {
                        failed = true;
                        gentle.err = "Missing tx"
                    }
                    if (!failed) {
                        try {
                            tx = decode_raw_tx(Crypto.util.hexToBytes(json.tx));
                            console.log(tx);
                        } catch (e) {
                            failed = true;
                            gentle.err = "Incorrect transaction: " + e.message;
                        }
                    }
                }
                if (!failed) {
                    if (gentle.seed && gentle.seed_for == gentle.mnemonic) {
                        signTx(json, tx, gentle.seed)
                    } else {
                        mnemonics.toSeed(gentle.mnemonic).then(function(data) {
                            gentle.seed = data;
                            gentle.seed_for = gentle.mnemonic;
                            signTx(json, tx, data);
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
        if (gentle.mnemonic && gentle.json) {
            process();
        }
        var watchFun = function(newValue, oldValue) {
            if (newValue == oldValue) return;
            if (gentle.mnemonic && gentle.json) {
                process();
            }
        }
        $scope.$watch('gentle.mnemonic', watchFun);
        $scope.$watch('gentle.json', watchFun);
    }])
    .controller('MyCtrl2', [function() {

    }]);
