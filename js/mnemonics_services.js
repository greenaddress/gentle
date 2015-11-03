angular.module('gentleApp.mnemonics_services', [])
.factory('mnemonics', ['$q', '$http', function($q, $http) {

    var mnemonics = {};
    var english_txt;
    var getEnglishTxt = function() {
        var deferred = $q.defer();
        if (english_txt) deferred.resolve(english_txt);
        else {
            $http.get('lib/gait/english.txt').success(function(data) {
                english_txt = data;
                deferred.resolve(english_txt);
            });
        }
        return deferred.promise;
    };
    var getMnemonicMap = function() {
        var deferred = $q.defer();
        getEnglishTxt().then(function(data) {
            var words = data.split('\n');
            var mapping = {};
            for (var i = 0; i < words.length; i++) {
                mapping[words[i]] = i;
            }
            deferred.resolve(mapping);
        });
        return deferred.promise;
    };
    mnemonics.getMnemonicMap = getMnemonicMap;
    mnemonics.validateMnemonic = function(mnemonic) {
        var deferred = $q.defer();
        var words = mnemonic.split(" ");
        if (words.length % 3 > 0){
            deferred.reject("Invalid number of words");
            return deferred.promise;
        }
        getMnemonicMap().then(function(mapping) {
            var indices = [];
            for (var i = 0; i < words.length; i++) {
                if (mapping[words[i]] === undefined) {
                    deferred.reject("Unknown word '" + words[i] + "'");
                    return;
                }
                indices.push(mapping[words[i]]);
            }
            var binary = '';
            for (var i = 0; i < indices.length; i++) {
                var binPart = new Bitcoin.BigInteger(indices[i].toString()).toRadix(2);
                while (binPart.length < 11) binPart = '0' + binPart;
                binary += binPart;
            }
            var bits = words.length*11 - words.length/3;
            var retval = new Bitcoin.BigInteger(binary.substr(0, bits), 2).toByteArrayUnsigned();
            while (retval.length < bits/8) retval.unshift(0);
	    //bcjs 0.2 made sure values were non-negative while 2.1.2 doesn't, so we must do here
            for (var i=0; i< retval.length; i++) {
                retval[i] = (retval[i]<0) ? retval[i] + 256 : retval[i];
	    }
            var checksum = binary.substr(bits);
            var wordArray = new Bitcoin.CryptoJS.lib.WordArray.init(BitcoinAux.bytesToWords(retval), retval.length);
            var hash = BitcoinAux.wordsToBytes(Bitcoin.CryptoJS.SHA256(wordArray).words);
            var binHash = '';
            for(var i = 0; i < hash.length; i++) {
                var binPart = new Bitcoin.BigInteger(hash[i].toString()).toRadix(2);
                while (binPart.length < 8) binPart = '0' + binPart;
                binHash += binPart;
            }

            if (binHash.substr(0, words.length/3) != checksum) return deferred.reject('Checksum does not match');  // checksum
            deferred.resolve(retval);
        });
        return deferred.promise;
    };
    mnemonics.fromMnemonic = function(mnemonic) {
        var bytes = mnemonics.validateMnemonic(mnemonic);
        var deferred = $q.defer();
        bytes.then(function(bytes) {
            deferred.resolve(bytes);
        }, function(e) {
            deferred.reject("Invalid mnemonic: " + e);
        });
        return deferred.promise;
    };
    mnemonics.toMnemonic = function(data) {
        var deferred = $q.defer();
        getEnglishTxt().then(function(response) {
            var words = response.split('\n');
            if(words.length != 2048) {
                throw("Wordlist should contain 2048 words, but it contains "+words.length+" words.");
            }

            var binary = Bitcoin.BigInteger.fromByteArrayUnsigned(data).toRadix(2);
            while (binary.length < data.length * 8) { binary = '0' + binary; }

            var bytes = Bitcoin.CryptoJS.SHA256(BitcoinAux.bytesToWordArray(data));
            bytes = BitcoinAux.wordArrayToBytes(bytes);

            var hash = Bitcoin.BigInteger.fromByteArrayUnsigned(bytes).toRadix(2);
            while (hash.length < 256) { hash = '0' + hash; }
            binary += hash.substr(0, data.length / 4);  // checksum

            var mnemonic = [];
            for (var i = 0; i < binary.length / 11; ++i) {
                var index = new Bitcoin.BigInteger(binary.slice(i*11, (i+1)*11), 2);
                mnemonic.push(words[index[0]]);
            }
            deferred.resolve(mnemonic.join(' '));
        });
        return deferred.promise;
    };
    mnemonics.toSeed = function(mnemonic) {
        var deferred = $q.defer();
        var k = 'mnemonic';
        var m = mnemonic;
        var worker = new Worker("lib/gait/mnemonic_seed_worker.js");
        worker.postMessage({k: k, m: m});
        worker.onmessage = function(message) {
            if(message.data.type == 'seed') {
                deferred.resolve(message.data.seed);
            } else {
                deferred.notify(message.data.progress);
            }
        };
        return deferred.promise;
    };
    return mnemonics;
}]);
