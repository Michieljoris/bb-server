/*global __dirname:false module:false require:false */
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
    recaster = require('recaster'),
    // fileSender = require('./fileSender'),
    cache = require('cachejs').lru(),
    send = require('./sendMisc')

;

var options, debug;
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

function stripBust(path, oPath) {
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
    
    if (!options.trueUrls)  {
        var baseName = Path.basename(path);
        path = pathMap[path];
        if (!path) {
            var dot = baseName.lastInDexof('.');
            if (validSignature(baseName.slice(dot))) {
                path = baseName.slice(0, dot);
            }
            else path = oPath;
            pathMap[oPath] = path;
        }
    }
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
    fileSender(req, res);
}

//Since this is the default handler for a get request, the only thing
//we can do with this request is send a file, interpreting the path as
//a path on the hard disk, possibly sending a directory or a 
function handleRequest(req, res) {
    // debug(sys.inspect(req.url));
    req.$options = options;
    
    //prepend root, normalize and remove trailing slashes:
    options.root = Path.resolve(options.root);
    var path = Path.join(options.root, req.url.pathname);
    if (!path.startsWith(options.root))
        path = options.root;
    req.$path = req.$oPath = Path.resolve(path);
    
    // cache(req.$oPath, function(data) {
    //     if (data.validate) ;//??????????????????????
    //     res.writeHead(200, data.headers);
    //     res.end(data.value);
    // });
    
    // if (cache) return;
    // req.$cache = cache;
    
    
    path = req.$path = stripBust(req.$path, req.$oPath);
    
    fs.stat(path, function(err, stat) {
        if (err) {
            delete pathMap[path];
            send.missing(req, res, path);   
            // cache.cancel(path);
        }
        else {
            if (stat.isDirectory()) {
                sendDirectory(req, res, path);
                // cache.cancel(path);
            }
            else {
                req.$GMTdate = stat.mtime;
                sendFile(req, res);   
            }
        }  
        
    }); 
        
    
}

module.exports.get = function(someOptions) {
    options = someOptions;
    debug = options.debug;
    send.init(options);
    return handleRequest;
};
