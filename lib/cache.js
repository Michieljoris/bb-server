/*global Buffer:false module:false require:false __dirname:false*/
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/ 

var fs = require('fs-extra'),
    md5 = require('MD5'),
    Path = require('path'),
    memCache = require('cachejs').lru(),
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
    //set value.maxAge to Infinity to always validate
    else if (value.cached + value.maxAge * 1000 > Date.now()) {
     cb(true);    
    }
    else if (value.source) {
        fs.stat(Path.resolve(__dirname, srcPath, value.source), function(err, stat) {
            if (err) cb(true);
            else {
                // debug(typeof stat.mtime, stat.mtime, new Date(value.cached));
                if (stat.mtime > value.cached) cb(false);
                else cb(true);
            } 
        });
    } 
    else cb(false);
    
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

function cache(key, fetch) {
    var vow = VOW.make();
    // if (fetch === undefined && cb === undefined) {
    //     fs.deleteSync(Path.resolve(__dirname, cachePath, md5(key)));
    //     delete requesters[key];
    //     return;
    // } 
    vows[key] =  vows[key] || [];
    vows[key].push(vow);
    if (vows[key].length === 1) {
        var value = memCache.get(key);
        validate(value, function(validated) {
            if (validated) {
                debug('retrieved value from memory cache');
                keepVows(key, value);   
            }
            else {
                //from disk then..
                fs.readFile(Path.resolve(__dirname, cachePath, md5(key)), function(err, buff) {
                    var data;
                    if (!err) {
                        var dataBufferLength = buff.readUInt32BE(0);
                        var dataString = buff.slice(4, 4 + dataBufferLength).toString();
                        data = JSON.parse(dataString);
                        data.value.body = buff.slice(4 + dataBufferLength);
                    }
                    validate(data, function(validated) {
                        debug(key + ' ' + 'validated from disk?', validated);
                        if (validated) {
                            debug('retrieved value from disk cache');
                            memCache.cache(key, data);   
                            keepVows(key, data);
                        }
                        else {
                            debug('fetching:', key);
                            fetch().when(
                                function(data) {
                                    debug('fetched:', key);
                                    data.cached = Date.now();
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
                                    fs.outputFile(Path.resolve(__dirname, cachePath, md5(key)),
                                                  buf,
                                                  function(err) {
                                                      if (err) {
                                                          debug(key + ' ' + 'ERROR: can\'t save cache item to disk!!!', err, key) ;
                                                      }
                                                      memCache.cache(key, data);   
                                                      keepVows(key, data);
                                                  });
                                    // }
                                },
                                function(err) {
                                    breakVows(key, err); return; }

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
    srcPath = someSrcPath;
    if (someDebug) debug = someDebug;
    return cache; 
};

//test
fs.deleteSync('./cache');

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


