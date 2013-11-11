/*global module:false require:false __dirname:false*/
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/ 

var fs = require('fs-extra'),
    md5 = require('MD5'),
    Path = require('path'),
    memCache = require('cachejs').lru()
;

var requesters = {};
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
    debug(value);
    if (value === undefined) cb(false);
    //set value.maxAge to Infinity to always validate
    else if (value.cached + value.maxAge * 1000 > Date.now()) {
     cb(true);    
    }
    else if (!value.source) cb(true);
    else fs.stat(Path.resolve(__dirname, srcPath, value.source), function(err, stat) {
        if (err) cb(true);
        else {
            debug(typeof stat.mtime, stat.mtime.getTime(), value.cached);
            if (stat.mtime > value.cached) cb(false);
            else cb(true);
        } 
    });
}

function respond(key, value) {
    if (requesters[key]) {
        requesters[key].forEach(function(cb) {
            cb(value);
        });
        delete requesters[key];
    }
}

function cache(key, fetch, cb) {
    // if (fetch === undefined && cb === undefined) {
    //     fs.deleteSync(Path.resolve(__dirname, cachePath, md5(key)));
    //     delete requesters[key];
    //     return;
    // } 
    requesters[key] =  requesters[key] || [];
    requesters[key].push(cb);
    if (requesters[key].length > 1) return;
    
    var value = memCache.get(key);
    debug(key + ' ' + 'from memcache:', value ? value.value : value);
    
    validate(value, function(validated) {
        if (validated) respond(key, value.value);
        else {
            debug(key + ' ' + 'get from disk then:', key);
            //from disk then..
            fs.readJson(Path.resolve(__dirname, cachePath, md5(key)), function(err, value) {
                if (err) value = undefined;
                validate(value, function(validated) {
                    debug(key + ' ' + 'validated from disk?', validated);
                    if (validated) {
                        memCache.cache(key, value);   
                        respond(key, value.value);
                    }
                    else {
                        debug(key + ' ' + 'fetching:', key);
                        fetch(function(args) {
                            var value = args.value,
                                nocache = args.nocache;
                            // source = args.source,
                            debug(key + ' ' + 'fetched:', key);
                            if (nocache) {
                                memCache.del(key);
                                respond(key, value.value);   
                            }
                            else {
                                args.maxAge = args.maxAge || 0,
                                args.cached = Date.now(),
                                fs.outputJson(Path.resolve(__dirname, cachePath, md5(key)),
                                              value,
                                              function(err) {
                                                  if (err) {
                                                      debug(key + ' ' + 'ERROR: can\'t save cache item to disk!!!', err, key) ;
                                                  }
                                                  memCache.cache(key, value);   
                                                  debug(key + ' ' + 'responding:', value);
                                                  respond(key, args);
                                              });
                            }
                        });
                    }
                });
            });
        }
    });
} 

    
module.exports = function(someSrcPath, someCacheDir, someDebug) {
    cachePath = someCacheDir;
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


