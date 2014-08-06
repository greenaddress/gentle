'use strict';

/* Controllers */

angular.module('gentleApp.controllers', ['gentleApp.mnemonics_services']).
    controller('MyCtrl1', ['$scope', 'mnemonics', function($scope, mnemonics) {
        var gentle = $scope.gentle = {};
        var signTx = function(tx, seed) {
            var hdwallet = new GAHDWallet({seed_hex: seed});
            var privkey;
            for (var i = 0; i < tx.parsed.ins.length; ++i) {
                var in_ = tx.parsed.ins[i];
                if (tx.json.prevout_subaccounts && tx.json.prevout_subaccounts[i]) {
                    // subaccounts - branch 3
                    var master = hdwallet.subkey(3, false, true);
                    // priv-derived subaccount:
                    master = master.subkey(tx.json.prevout_subaccounts[i], true, true);
                } else {
                    var master = hdwallet.subkey(1, false, true);
                }
                var key = master.subkey(tx.json.prevout_pointers[i], false, true);
                key = new Bitcoin.ECKey(key.secret_exponent);
                if (i == 0) privkey = key;
                var script = new Bitcoin.Script(in_.script.chunks[3]);
                var sign = key.sign(tx.parsed.hashTransactionForSignature(script, i, SIGHASH_ALL));
                sign = Bitcoin.ECDSA.serializeSig(sign.r, sign.s);
                sign.push(SIGHASH_ALL);

                var in_script = new Bitcoin.Script();
                in_script.writeOp(0);
                in_script.writeBytes(in_.script.chunks[1]);  // ga sig
                in_script.writeBytes(sign);  // user's sig
                in_script.writeBytes(in_.script.chunks[3]);  // 2of2 outscript
                in_.script = in_script;
            }
            tx.rawtx = Crypto.util.bytesToHex(tx.parsed.serialize());

            var wif = privkey.priv.toByteArrayUnsigned();
            while (wif.length < 32) wif.unshift(0);
            wif.unshift(0x80);
            wif.push(0x01)  // compressed;
            var checksum = Crypto.SHA256(Crypto.SHA256(wif, {asBytes: true}), {asBytes: true});
            wif = wif.concat(checksum.slice(0, 4));
            tx.privkey = B58.encode(wif);

            tx.pointer = tx.json.prevout_pointers[0];
            tx.subaccount = tx.json.prevout_subaccounts && tx.json.prevout_subaccounts[0];
        }
        var process = function() {
            gentle.validating = true;
            gentle.transactions = [];
            mnemonics.validateMnemonic(gentle.mnemonic).then(function() {
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

                    // 3. Parse transaction
                    try {
                        var tx = decode_raw_tx(Crypto.util.hexToBytes(json.tx));
                    } catch (e) {
                        failed = true;
                        gentle.err = "Incorrect transaction: " + e.message;
                        break;
                    }

                    gentle.transactions.push({json: json, parsed: tx});
                }
                
                if (!failed) {
                    var do_transactions = function() {
                        for (var i = 0; i < gentle.transactions.length; i++) {
                            signTx(gentle.transactions[i], gentle.seed);
                        }
                        gentle.transactions.sort(function(a, b) { return a.parsed.lock_time - b.parsed.lock_time; })
                        gentle.validating = false;
                    };
                    
                    if (gentle.seed && gentle.seed_for == gentle.mnemonic) {
                        do_transactions();
                    } else {
                        mnemonics.toSeed(gentle.mnemonic).then(function(data) {
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
        }
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
        }
        $scope.$watch('gentle.mnemonic', watchFun);
    }])
    .controller('MyCtrl2', [function() {

    }]);
