var BitcoinAux =  {

  lpad : function(str, padString, length) {
    while (str.length < length) str = padString + str
      return str
  },

  stringToBytes : function(string) {
    return string.split('').map(function(x) {
      return x.charCodeAt(0)
      })
  },

  bytesToWords : function(bytes) {
      var words = []
      for (var i = 0, b = 0; i < bytes.length; i++, b += 8) {
            words[b >>> 5] |= bytes[i] << (24 - b % 32)
      }
      return words
  },

  wordsToBytes : function(words) {
    var bytes = []
    for (var b = 0; b < words.length * 32; b += 8) {
      bytes.push((words[b >>> 5] >>> (24 - b % 32)) & 0xFF)
    }
    return bytes
  },

  bytesToHex : function(bytes) {
  // FIXME: transitionary fix
  //  if (Buffer.isBuffer(bytes)) {
  //    return bytes.toString('hex')
  // }
 
    return bytes.map(function(x) {
      return BitcoinAux.lpad(x.toString(16), '0', 2)
    }).join('')
  },

  hexToBytes : function(hex) {
    return hex.match(/../g).map(function(x) {
      return parseInt(x,16)
    })
  },

  bytesToWordArray : function(bytes) {
    return new Bitcoin.CryptoJS.lib.WordArray.init(BitcoinAux.bytesToWords(bytes), bytes.length)
  },

  wordArrayToBytes : function(wordArray) {
    return BitcoinAux.wordsToBytes(wordArray.words) 
  }

}
