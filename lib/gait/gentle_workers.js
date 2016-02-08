importScripts('bitcoinjs.min.js');
importScripts('aux_funcs.js');
importScripts('mnemonic_seed.js');

onmessage = function(message) {
    try {
        var transaction = Bitcoin.Transaction.fromHex(message.data.tx.json.tx);
        var tx = {'json': message.data.tx.json, 'parsed': transaction};
        hdwallet = Bitcoin.HDNode.fromSeedHex(message.data.seed);
        var hash = transaction.getHash();
        var privkey;
        var try_branches = [1, 4];
        for (var i = 0; i < tx.parsed.ins.length; ++i) {
            var in_ = tx.parsed.ins[i];
            var master_parent, master;
            if (tx.json.prevout_subaccounts && tx.json.prevout_subaccounts[i]) {
                // subaccounts - branch 3
                master_parent = hdwallet.deriveHardened(3);
                // priv-derived subaccount:
                master_parent = master_parent.deriveHardened(
                    tx.json.prevout_subaccounts[i]
                );
            } else {
                master_parent = hdwallet
            }
            master = master_parent.derive(1)
            var pointer = tx.json.prevout_pointers[i];
            var key = master.derive(pointer);
            var out_pk_hash = Bitcoin.script.decompile(
                tx.parsed.outs[0].script
            )[2];
            if (i == 0) {
                var this_key_hash = Bitcoin.crypto.hash160(
                    key.keyPair.getPublicKeyBuffer()
                );
                if (out_pk_hash.toString() != this_key_hash.toString()) {
                    var other_key = master_parent.derive(4).derive(pointer);
                    // new implementation - uses a different branch (4)
                    var other_key_hash = Bitcoin.crypto.hash160(
                        other_key.keyPair.getPublicKeyBuffer()
                    );
                    if (out_pk_hash.toString() != other_key_hash.toString()) {
                        postMessage({error: "Output key doesn't match!"});
                        return;
                    } else {
                        // the other key matches
                        privkey = other_key
                    }
                } else {
                    // first key matches - old implementation
                    privkey = key;
                }
            }
            var script = new Bitcoin.script.compile(Bitcoin.script.decompile(in_.script)[3]);
            var sign = key.sign(tx.parsed.hashForSignature(i, script, 0x01)).toScriptSignature(0x01);
            var decompiled = Bitcoin.script.decompile(in_.script);
            var builder = Bitcoin.script.multisigInput([decompiled[1],sign],decompiled[3]);

            in_.script = Bitcoin.script.compile(
                Bitcoin.script.decompile(builder).concat(decompiled[3])
            );
        }
        console.log(tx.parsed);
        tx.rawtx = tx.parsed.toHex();
        var wif = privkey.keyPair.toWIF();
        tx.b58privkey = wif;
        tx.pointer = tx.json.prevout_pointers[0];
        tx.subaccount = tx.json.prevout_subaccounts && tx.json.prevout_subaccounts[0];
        tx.amount = ((Bitcoin.Transaction.fromHex(tx.rawtx)['outs'][0]['value'] / 100000000).toFixed(8)).replace(/0+$/, '') + ' BTC';
        tx.privkey = privkey;
        postMessage(tx);
        close()
    } catch (e) {
        console.log('worker error: ', e)
    }
};
