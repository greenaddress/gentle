importScripts('bitcoinjs.min.js');
importScripts('mnemonic_seed.js');

onmessage = function(message) {
    try {
        var transaction = Bitcoin.Transaction.deserialize(message.data.tx.json.tx);
        var tx = {'json': message.data.tx.json, 'parsed': transaction};
        hdwallet = Bitcoin.HDWallet.fromSeedHex(message.data.seed);
        tx.unsigned = Bitcoin.convert.bytesToHex(tx.parsed.hash);
        var privkey;

        for (var i = 0; i < tx.parsed.ins.length; ++i) {
            var in_ = tx.parsed.ins[i];
            if (tx.json.prevout_subaccounts && tx.json.prevout_subaccounts[i]) {
                // subaccounts - branch 3
                var master = hdwallet.derivePrivate(3);
                // priv-derived subaccount:
                master = master.derivePrivate(tx.json.prevout_subaccounts[i]);
                master = master.derive(1)
            } else {
                var master = hdwallet.derive(1);
            }
            var key = master.derive(tx.json.prevout_pointers[i]);
            key = new Bitcoin.ECKey(key.priv);
            if (i == 0) privkey = key;
            var script = new Bitcoin.Script(in_.script.chunks[3]);
            var sign = key.sign(tx.parsed.hashTransactionForSignature(script, i, 0x01));
            sign.push(0x01);

            var in_script = new Bitcoin.Script();
            in_script.writeOp(0);
            in_script.writeBytes(in_.script.chunks[1]);  // ga sig
            in_script.writeBytes(sign);  // user's sig
            in_script.writeBytes(in_.script.chunks[3]);  // 2of2 outscript
            in_.script = in_script;
        }

        tx.rawtx = Bitcoin.convert.bytesToHex(tx.parsed.serialize());
        var wif = privkey.priv.toByteArrayUnsigned();
        while (wif.length < 32) wif.unshift(0);
        wif.unshift(0x80);
        wif.push(0x01);  // compressed;
        var checksum = Bitcoin.CryptoJS.SHA256(Bitcoin.CryptoJS.SHA256(Bitcoin.convert.bytesToWordArray(wif)));
        checksum = Bitcoin.convert.wordArrayToBytes(checksum);
        wif = wif.concat(checksum.slice(0, 4));
        tx.b58privkey = Bitcoin.base58.encode(wif);
        tx.pointer = tx.json.prevout_pointers[0];
        tx.subaccount = tx.json.prevout_subaccounts && tx.json.prevout_subaccounts[0];
        tx.amount = ((Bitcoin.Transaction.deserialize(tx.rawtx)['outs'][0]['value'] / 100000000).toFixed(8)).replace(/0+$/, '') + ' BTC';
        tx.privkey = privkey;
        postMessage(tx);
        close()
    } catch (e) {
        console.log('worker error: ', e)
    }
};
