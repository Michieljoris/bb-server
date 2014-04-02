/*global Buffer:false module:false require:false __dirname:false*/
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/ 

var fs = require('fs-extra'),
    md5 = require('MD5'),
    Path = require('path'),
    memCache = require('cachejs').lru(100),
    VOW = require('dougs_vow')

;

var vows = {};
var cachePath = './cache/';
var srcPath = './test';

var options = {
    // silent: false
    silent: true
};

var debug =  options.silent ?  function () {}: function() {
    console.log.apply(console, arguments);
};

//To clear out unused files..
// fs.deleteSync(cacheDir);

function validate(value, cb) {
    
    if (value === undefined) cb(false);
    //always validate true if not expired yet
    else
    { //debug(value.maxAge);
      if (Date.now() < value.cached + value.maxAge) { //debug('not expired yet..');
                                                      cb(true); }
      else if (value.source) {
          fs.stat(Path.resolve(__dirname, srcPath, value.source), function(err, stat) {
              if (err) cb(true);
              else {
                  //don't validate if the source file has changed since it was cached:
                  if (stat.mtime > value.cached) {
                      // debug(value.source + ' has changed since it was cached!!');
                      cb(false);   
                  }
                  else { cb(true); //debug('source file has not changed..');
                       }
              } 
          });
      } 
      else cb(false);
    }    
}

function keepVows(key, data) {
    if (vows[key]) {
        vows[key].forEach(function(vow) {
            vow.keep(data);
        });
        delete vows[key];
    }
}

function breakVows(key, err) {
    if (vows[key]) {
        vows[key].forEach(function(vow) {
            vow.breek(err);
        });
        delete vows[key];
    }
}


function cache(key, file) {
    
    key = (file.stamp ? file.stamp : '') + key + (file.prerender ? '?_escaped_fragment_=' : '');
    // console.log(file.path, ': stamp = ' + file.stamp);
    var vow = VOW.make();
    // debug(memCache.stats());
    vows[key] =  vows[key] || [];
    vows[key].push(vow);
    if (vows[key].length === 1) {
        var value = memCache.get(key);
        validate(value, function(validated) {
            if (validated) {
                debug('retrieved ' + key + ' from memory cache');
                keepVows(key, value);   
            }
            else {
                //from disk then..
                if (file.fetch.name === 'retrieveAsIs') {
                    file.fetch().when(
                        function(data) {
                            data.cached = Date.now();
                            memCache.cache(key, data, data.length);   
                            keepVows(key, data);
                        },
                        function(err) {
                            breakVows(key, err); }
                    );
                }
               else fs.readFile(Path.resolve(__dirname, cachePath, md5(key)), function(err, buff) {
                    var data;
                    if (!err) {
                        var dataBufferLength = buff.readUInt32BE(0);
                        var dataString = buff.slice(4, 4 + dataBufferLength).toString();
                        data = JSON.parse(dataString);
                        data.value.body = buff.slice(4 + dataBufferLength);
                    }
                    validate(data, function(validated) {
                        // debug(key + ' ' + 'validated from disk?', validated);
                        if (validated) {
                            debug('retrieved ' + key + ' from disk cache');
                            memCache.cache(key, data, dataBufferLength + data.value.body.length);   
                            keepVows(key, data);
                        }
                        else {
                            debug('fetching:', key);
                            file.fetch().when(
                                function(data) {
                                    data.cached = Date.now();
                                    debug('fetched:', key);
                                    var body = data.value.body;
                                    var bodyBuffer = new Buffer(body);
                                    delete data.value.body;
                                    var dataBuffer = new Buffer(JSON.stringify(data));
                                    data.value.body = body;
                                    var dataBufferLength = dataBuffer.length;
                                    var lengthBuffer = new Buffer(4);
                                    lengthBuffer.writeUInt32BE(dataBufferLength,  0);
                                    var buf = Buffer.concat([lengthBuffer, dataBuffer, bodyBuffer],
                                                            4 + bodyBuffer.length + dataBufferLength);
                                    var outPath = Path.resolve(__dirname, cachePath, md5(key));
                                    fs.outputFile(outPath,
                                                  buf,
                                                  function(err) {
                                                      debug('stored ' + key + ' in cache');
                                                      if (err) {
                                                          debug(key + ' ' + 'ERROR: can\'t save cache item to disk!!!', err, key) ;
                                                      }
                                                      memCache.cache(key, data, bodyBuffer.length + dataBufferLength);   
                                                      keepVows(key, data);
                                                  });
                                    // }
                                },
                                function(err) {
                                    breakVows(key, err);  }
                            );
                        }
                    });
                });
            }
        });
    }
    return vow.promise;
} 

    
module.exports = function(someSrcPath, someCacheDir, someDebug) {
    cachePath = someCacheDir;
    console.log('in cache.js:', cachePath);
    srcPath = someSrcPath;
    if (someDebug) debug = someDebug;
    return cache; 
};

//test
// fs.deleteSync('./cache');

// cache('test1',
//       function(key, cb) {
//           debug('asked to fetch ' + key);
//           cb('somevalue');
//       },
//       function(value) {
//         debug('retrieved:', value);  
//       });

// cache('test2',
//       function(key, cb) {
//           debug('asked to fetch ' + key, srcPath);
//           var source = Path.resolve(__dirname , srcPath , key);
//           fs.readFile(source, function(err, data) {
//               debug("read file for key ", key, data.toString());
//               cb(data.toString() + 'RECAST', source, 1000);
//           } );
//       },
//       function(value) {
//         debug('retrieved:', value);  
//       });

// setTimeout(
//     function() {
//         cache('test1',
//               function(key, cb) {
//                   debug('asked to fetch ' + key);
//                   cb('somevalue');
//               },
//               function(value) {
//                   debug('retrieved:', value);  
//               });
    
//     }, 100);

// setTimeout(
//     function() {
//         cache('test2',
//               function(key, cb) {
//                   debug('asked to fetch ' + key);
//                   cb('somevalue');
//               },
//               function(value) {
//                   debug('retrieved:', value);  
//               });
    
//     }, 100);


