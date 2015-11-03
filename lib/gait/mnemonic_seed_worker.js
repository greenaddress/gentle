importScripts('bitcoinjs.min.js');
importScripts('aux_funcs.js');
importScripts('mnemonic_seed.js');


onmessage = function(message) {
    var seed = calcSeed(message.data.k, message.data.m, function(progress){
        postMessage({type: 'progress', progress: progress})
    });
    postMessage({type: 'seed', seed: seed});
}
