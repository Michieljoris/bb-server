/*global unescape:false _dirname:false module:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/ 

/**
 * Handles static content.
 */

var
// sys = require('sys'),
    fs = require('fs'),
    mime = require("mime"),
    Path = require('path'),
    Url = require('url'),
    VOW = require('dougs_vow'),
    recaster = require('recaster'),
    wash = require('url_washer'),
    cache = require('./cache'),
    sendMisc = require('./sendMisc')

// fileSender = require('./fileSender'),

;
mime.default_type = 'unknown';
var options, debug;
    var prerenderOptions;
// var dev = process.env.BB_SERVER_DEV;
var dev = false;
var pathMap = {};

function sendDirectory(req, res, path) {
    function send(f) {
        if (!options.dir) {
            send.forbidden(req,res, path);
        }
        else f();
    }
    fs.readdir(path, function(err, files) {
        if (err) {
            send(function() {return send.error(req, res, err);});
            return;
        }

        if (!files.length) {
            send(function() {return send.directoryIndex(req, res, path, []);});
            return;
        }

        var remaining = files.length;
        files.forEach(function(fileName, index) {
            fs.stat(path + '/' + fileName, function(err, stat) {
                if (err) {
                    // return self.sendError_(req, res, err);
                    files[index] = '-->' + fileName + '';
                }
                else if (stat.isDirectory()) {
                    files[index] = fileName + '/';
                }
                if (options.index && (fileName === 'index.html' ||
                                      fileName === 'index.htm')) {
                    log('Sending index.html and not the directory!!! ') ;
                    req.$path = path + '/' + fileName;
                    sendFile(req, res);   
                }
                else if (!(--remaining))
                    send(function() {return send.directoryIndex(req, res, path, files);});
            });
        });
    });
}

function parseExpiresIn(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    var number = str.slice(0, str.length-1);
    var periond = str.slice(str.length-1);
        var multiplier = { m:60, h: 60*60, d: 24*60*60, w: 7*24*60*60, y: 52*7*24*60*60};
        return multiplier[periond] * number;
}

function createCacheHeaders(req, path, mimeType, options, cache) {
    //Get cache settings for the requested path or otherwise its mimetype, or bust
    var cacheControl = cache.cacheControl, expiresIn;
    var cacheSettings =
            options.cache.path[path] ||
            options.cache.mimeType[mimeType] ||
        (req.$path !== req.$oPath ? options.cache._bust_ : undefined);
    if (cacheSettings && cacheSettings['Cache-Control'])  
        return {
            cacheControl : cacheSettings['Cache-Control'],
            expiresIn : cacheSettings.expiresIn //ms
        };
    //only executed first time for the particular path or
    //mimetype or if bust 
    expiresIn = parseExpiresIn(cacheSettings.expiresIn); //seconds
    cacheControl = "max-age=" + expiresIn;
    if (cacheSettings['private'])
        cacheControl += ", private";
    else if (cacheSettings['public'] === undefined || cacheSettings['public'])
        cacheControl += ", public";
    //cache the cache control...
    cacheSettings['Cache-Control'] = cacheControl;
    cacheSettings.expiresIn = (expiresIn ? expiresIn : -1000000000) * 1000;
    return { cacheControl: cacheControl, expiresIn: expiresIn };
    //TODO?? don't set public , but set private for files that have cookie headers set
}


//to use cachebusting:
// real = false or undefined
// cache = { expiresIn: '1y' }
// and send requests for files like: _bust_Sun Jan 31 1982 10:55:34 GMT+1000 (EST)_filename
// TODO: _bust_1381286525690_filename maybe instead?

function createHeaders(req, res, mimeType, GMTdate, path) {
    //default headers
    mimeType =  mimeType || 'text/plain';
    var headers = 
        {
            'Content-Type': mimeType
            ,Server: 'bb-server/' + options.version
        };
    
    //set cache headers
    var cache = {
        cacheControl: "nostore, nocache, max-age=0, must-revalidate"
    };
    if (options.cache)
        cache = createCacheHeaders(req, path, mimeType, options, {
            cacheControl: "public, max-age=0"   
        });
    
    headers['Cache-Control'] = cache.cacheControl;
    if (cache.expiresIn)
        headers.Expires = new Date(Date.now() + cache.expiresIn).toString();
    headers['Last-Modified'] = GMTdate.toString();
    
    //set gzip headers
    var ua = req.headers['user-agent'] || '',
    accept = req.headers['accept-encoding'] || '';
    
    // Note: this is not a conformant accept-encoding parser.
    // See http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
    var encoding;
    if ('*' === accept.trim()) encoding = 'gzip';
    else {
            for (var i = 0, len = recaster.zipperMethods.length; i < len; ++i) 
                if (~accept.indexOf(recaster.zipperMethods[i])) {
                    encoding = recaster.zipperMethods[i];
                    break;  }
    }
    
    if (options.gzip && encoding && options.gzip.test(mimeType) && 
        !(~ua.indexOf('MSIE 6') && !~ua.indexOf('SV1')) &&
        req.method !== 'HEAD') 
    {  headers['Content-Encoding']= encoding;
       headers.Vary = 'Accept-Encoding';  }
    
    //add any custom headers
    Object.keys(options.headers).forEach(function(k){
        headers[k] = options.headers[k];
    });
    
    return headers;
}

function stripStamp(req) {
    var oPath = req.url.pathname;
    var path = oPath;
    //strip the signature of the filename if present: 
        //as redundant as I can make it and the shortest route for the
    // most common case (repeat request of valid path)
    // as long as no dir or file name ends with _bust_ this will
    // work
    function validSignature(str) {
        //you could check whether the date is parseable better, because
        //Date.parse is -very- forgiving, but as long as no file starts
        //with '_bust_' there will be no false positives.
        if (str.length < 49 || str.slice(0, 8) !== '_bust_' ||
            typeof Date.parse(str.slice(8, 47)) !== 'number') return false;
        return true;
    }
    
    if (options.bust)  {
        path = pathMap[oPath];
        if (!path) {
            var baseName = Path.basename(path);
            var dot = baseName.lastInDexof('.');
            if (validSignature(baseName.slice(dot))) {
                path = baseName.slice(0, dot);
            }
            else path = oPath;
            pathMap[oPath] = path;
        }
    }
    req.$stamped = path !== oPath;
    return path;
}


//Do some prep work then send off the req to the fileSender module to
//retrieve and send the file
//Prep:
//1 Send a 304 not modified if appropriate instead
//2 Create all the headers
//3 Finish up if only the HEAD is requested
//4 Forward the req to the fileSender module
function sendFile(req, res) {
    var path = req.$path;
    var GMTdate = req.$GMTdate;
    if (!dev && Date.parse(req.headers["if-modified-since"]) >= Date.parse(GMTdate))  {
        // if (!dev && req.headers["if-modified-since"] === GMTdate.toString()) {
        res.writeHead(304, {});
        res.end();
        return;
    }
    var mimeType = mime.lookup(path);
    req.$mimeType = mimeType;
        
    var headers = createHeaders(req, res, mimeType, GMTdate, path);
    
    if (req.method === 'HEAD') {
        res.writeHead(200, headers);
        res.end();
        return;
    }
    
    req.$headers = headers;
    // fileSender(req, res);
}

function testUasForBot(req) {
    //Elaborate version use:
    // https://npmjs.org/package/uas-parser
    //But for now:
    var bots = /robot|spider|crawler|curl|slurp or: bot|crawler|baiduspider|80legs|ia_archiver|voyager|curl|wget|yahoo! slurp|mediapartners-google/;
    var ua = req.headers['user-agent'] || '';
    return bots.test(ua);
} 

function prerender(url, res) {
    if (prerenderOptions.seoServer) {
        wash(prerenderOptions, url).when(
            function(html) {
                //send with the proper headers and compression etc
                //TODO done....
            },
            function(err) {
                //TODO ???
            }
        );
        return false;
    }
    return function(key, cb) {
        wash(prerenderOptions, url).when(
            function(html) {
                cb(html);
                //send with the proper headers and compression etc
                //TODO done....
            },
            function(err) {
                //TODO ???
            });
    };
}

function handleRequest(req, res) {
    var fetch;
    var url = isFromBot(req);
    if (url) {
        fetch = prerender(req, res);   
        if (!fetch) return;
    }
    //if this is a request from a bot either have a seo server deal
    //with it or prerender it ourselves
    else {
        var path = stripStamp(req);
        var mimeType = mime.lookup(Path.extname(path));
        req.$mimeType = mimeType;
        if (mimeType) {
            //TODO...
            fetch = function() {};
        }
        else if (options.spa) {
            if (req.$fromBot) {
                fetch = prerender(req.url, res);
                if (!fetch) return;
            }
            else {
                fetch = function(key, cb) {
                    //get index.html from the disk
                };
            }
        }
        //no spa:
        else if (listableDir(path)) {
            fs.stat(path, function(err, stat) {
                if (err) {
                    delete pathMap[path];
                    sendMisc.missing(req, res, path);   
                }
                else {
                    if (stat.isDirectory()) sendDirectory(req, res, path);
                    else {
                     // fetch = ...   
                    }
                }  

            }); 
            
        }
        else {
            //send 404
            sendMisc.missing(req, res, path);   
        }

        //Since this is the default handler for a get request, the
        //only thing we can do with this request now is send a file,
        //interpreting the path as a path on the hard disk, possibly
        //sending a directory.
        
        //prepend root, normalize and remove trailing slashes, to
        //produce a file path:
        options.root = Path.resolve(options.root);
        //strip any stamps, and set req.$stamped

        //check if path is a path to a directory that we allow to be
        //listed. If so return a page with the listing and be done
        //create file path:
        path = Path.join(options.root, path);
        if (!path.startsWith(options.root))
            path = options.root;
        
    }
} 



function listableDir(path) {
    var dirs = options.dir;
    if (!dirs) return false;
    if (typeof dirs === 'boolean') return true;
    return dirs.some(function(d) {
        return path.indexOf(d) === 0;
    });
}


// Mapping from _escaped_fragment_ format to #! format

// Any URL whose query parameters contain the special token
// _escaped_fragment_ as the last query parameter is considered an
// _escaped_fragment_ URL. Further, there must only be one
// _escaped_fragment_ in the URL, and it must be the last query
// parameter. The corresponding #! URL can be derived with the
// following steps:

// 1 Remove from the URL all tokens beginning with _escaped_fragment_=
// (Note especially that the = must be removed as well).

// 2 Remove from the URL the trailing ? or & (depending on whether the
// URL had query parameters other than _escaped_fragment_).

// 3 Add to the URL the tokens #!.

// 4 Add to the URL all tokens after _escaped_fragment_= after
// unescaping them.

// Note: As is explained below, there is a special syntax for pages
// without hash fragments, but that still contain dynamic Ajax
// content. For those pages, to map from the _escaped_fragment_ URL to
// the original URL, omit steps 3 and 4 above.

function isFromBot(req) {
    if (!options.prerender) return false;
    req.$fromBot = testUasForBot(req);
    var url = req.url;
    if (options.hashbang && url.query && url.query._escaped_fragment_ !== undefined) {
        var newUrl = {
            protocol: url.protocol,
            auth: url.auth,
            host: prerenderOptions.seoServer ? url.host: 'localhost',
            port: prerenderOptions.seoServer ? url.prot: options.port,
            pathname: url.pathname,
            query: url.query
        };
        var fragment = unescape(url.query._escaped_fragment_);
        delete newUrl.query._escaped_fragment_;
        newUrl.hash =(fragment.length ? '!' + fragment: '') + (url.hash || '');
        return Url.format(newUrl);
    }
    if (options.bot && req.$fromBot && url.hash && url.hash.startsWith('#!'))  return url;
    return false;
}

module.exports.get = function(someOptions) {
    options = someOptions;
    prerenderOptions = {};
    if (typeof options.prerender === 'string')
        prerenderOptions.seoServer = options.prerender;
    
    debug = options.debug;
    sendMisc.init(options);
    return handleRequest;
};



//TEST:
// options = {};
// prerenderOptions = {
//     seoServer : "someseo/server"
// };
// options.prerender = true;
// var Url = require('url');
// // var url = "http://user:pass@host.com:8080/p/a/t/h?query=string&abc=123#!/some/other/path#hash";
// // var url = "http://user:pass@host.com:8080/p/a/t/h?query=string&abc=123&_escaped_fragment_=/some/other/path#hash";
// var url = "http://user:pass@host.com:8080/p/a/t/h?query=string&abc=123&_escaped_fragment_=#myhash";
// var parsed = Url.parse(url, true);
// var newurl = isRequestFromBot(parsed);
// console.log(newurl);
// console.log(parsed);
// console.log(typeof parsed.query);
// console.log(parsed.query);
// { protocol: 'http:',
//   slashes: true,
//   auth: 'user:pass',
//   host: 'host.com:8080',
//   port: '8080',
//   hostname: 'host.com',
//   hash: '#!/some/other/path#hash',
//   search: '?query=string',
//   query: 'query=string',
//   pathname: '/p/a/t/h',
//   path: '/p/a/t/h?query=string',
//   href: 'http://user:pass@host.com:8080/p/a/t/h?query=string#!/some/other/path#hash' }



// // mime.default_type = 'bla';
// var p = '/a/b/c/jss';
// var path = Path.extname(p);
// console.log('ext:', path);
// var m = mime.lookup(path);

// console.log(m);
