var  cache = require('cachejs').lru()


var util = require('util');
console.log(util.inspect(cache));

cache.put('a','a');
console.log(cache.list());
