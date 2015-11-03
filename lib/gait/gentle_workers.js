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
        for (var i = 0; i < tx.parsed.ins.length; ++i) {
            var in_ = tx.parsed.ins[i];
            if (tx.json.prevout_subaccounts && tx.json.prevout_subaccounts[i]) {
                // subaccounts - branch 3
                var master = hdwallet.deriveHardened(3);
                // priv-derived subaccount:
                master = master.deriveHardened(tx.json.prevout_subaccounts[i]);
                master = master.derive(1)
            } else {
                var master = hdwallet.derive(1);
            }
            var key = master.derive(tx.json.prevout_pointers[i]);
            if (i == 0) privkey = key;
            var script = new Bitcoin.script.compile(Bitcoin.script.decompile(in_.script)[3]);
            var sign = key.sign(tx.parsed.hashForSignature(i, script, 0x01));
	    var decompiled = Bitcoin.script.decompile(in_.script);
            var builder = Bitcoin.script.multisigInput([decompiled[1],sign],decompiled[3]);

	    in_.script = Bitcoin.script.compile([Bitcoin.script.decompile(builder), decompiled[3]]);
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
