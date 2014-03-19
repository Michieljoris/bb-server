var scriptInjector = require('script-injector');
var fs = require('fs-extra');

// Then do something like this somewhere else
// var JSONStream = require('JSONStream');

// var stringify = JSONStream.stringify();
  
// stringify.pipe(process.stdout);
  
fs.createReadStream('./test.html')
  .pipe(scriptInjector("function test() {}"))
  .pipe(process.stdout);
