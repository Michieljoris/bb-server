var scriptInjector = require('script-injector');
var fs = require('fs-extra');

// Then do something like this somewhere else
// var JSONStream = require('JSONStream');

// var stringify = JSONStream.stringify();
  
// stringify.pipe(process.stdout);
  
// fs.createReadStream('./test.html')
//   .pipe()
//   .pipe(process.stdout);
// var res = scriptInjector(function test() {});
// res.on('end', function(data) {
// console.log(data);
    
// })

var stream = require('stream');
function streamify(text) {
    var s = new stream.Readable();
    s.push(text);
    s.push(null);
    return s;
}
 
var buffer = '';
var result = streamify('<head></head><body></body>').pipe(scriptInjector(function test() {}));
result.on('data', function(data) {
    buffer += data;
});

result.on('end', function(data) {
    console.log('end:\n', buffer);
});

