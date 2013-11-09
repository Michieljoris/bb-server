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

// TODO:filename. _stamp_1381286525690_maybe instead?

//Prepare standard, cache, gzip and custom headers
function createHeaders(req, res, mimeType, GMTdate) {
    //default headers
    mimeType =  mimeType || 'text/plain';
    var headers = 
        {
            'Content-Type': mimeType
            ,Server: 'bb-server/' + options.version
        };
    
    //cache headers
    //if a file request came in with a time stamp send the file
    //out with the stamp cache headers, (high expiresIn probably)
    var cacheSettings = options.cache ?
        ( req.$path !== req.$oPath ?
          options.cache_ :
          { cacheControl: "max-age=0, public",
            expiresIn: '0m' }
        ): { cacheControl: "nostore, nocache, max-age=0, must-revalidate",
             expiresIn: '0m' };
    
    headers['Cache-Control'] = cacheSettings.cacheControl;
    if (cacheSettings.expiresIn)
        headers.Expires = new Date(Date.now() + cache.expiresIn).toString();
    headers['Last-Modified'] = GMTdate.toString();
    
    //gzip headers
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

function stripStamp(path, oPath) {
    //strip the signature of the filename if present: 
    //as redundant as I can make it and the shortest route for the
    // most common case (repeat request of valid path)
    // as long as no dir or file name ends with _stamp_ this will
    // work
    function validSignature(str) {
        //you could check whether the date is parseable better, because
        //Date.parse is -very- forgiving, but as long as no file starts
        //with '_stamp_' there will be no false positives.
        if (str.length < 49 || str.slice(0, 8) !== '_stamp_' ||
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


function handleRequest(req, res) {
    // debug(sys.inspect(req.url));
    req.$options = options;
    
    //prepend root, normalize and remove trailing slashes:
    options.root = Path.resolve(options.root);
    var path = Path.join(options.root, req.url.pathname);
    if (!path.startsWith(options.root))
        path = options.root;
    req.$path = req.$oPath = Path.resolve(path);
    //stamp cache:
    
    //1: hardcoded time stamp on request for files, this can be done
    //at site build time
    
    //2: cache control
    //3: always check
    if (!dev && Date.parse(req.headers["if-modified-since"]) >= Date.parse(GMTdate))  {}
    // cache(req.$oPath, function(data) {
    //     if (data.validate) ;//??????????????????????
    //     res.writeHead(200, data.headers);
    //     res.end(data.value);
    // });
    
    // if (cache) return;
    // req.$cache = cache;
    
    
    path = req.$path = stripStamp(req.$path, req.$oPath);
    
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
