/*global __dirname:false module:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/ 

/**
 * Handles static content.
 */

var
    sys = require('sys'),
    fs = require('fs'),
    // url = require('url'),
    // md = require("node-markdown").Markdown,
    mime = require("mime"),
    Path = require('path'),
    // exec = require('child_process').exec,
    // zlib = require('zlib'), 
    packager = require('./packager'),
    fileSender = require('./fileSender'),
    cache = require('cachejs').lru(),


    // spawn = require('child_process').spawn;
;
// var gzip = require('zlib').createGzip();


var options, log;
// var dev = process.env.BB_SERVER_DEV;
var dev = false;
var pathMap = {};

function escapeHtml(value) {
    return value.toString().
        replace('<', '&lt;').
        replace('>', '&gt;').
        replace('"', '&quot;');
}

function sendError(req, res, error) {
    res.writeHead(500, {
        'Content-Type': 'text/html'
    });
    res.write('<!doctype html>\n');
    res.write('<title>Internal Server Error</title>\n');
    res.write('<h1>Internal Server Error</h1>');
    res.write('<pre>' + escapeHtml(sys.inspect(error)) + '</pre>');
    res.end();
    log('500 Internal Server Error');
    log(sys.inspect(error));
}


//send favicon set in options with customized max-age or by default send favicon
//included with server with max-age = 1 hour, or put favicon in root dir and set cache headers your self with the options.cache.path["./favicon"] 
var icon;
function sendFavicon(req, res, sendMissing) {
    if (req.originalUrl !== '/favicon.ico') return false;
    if (icon) {
        res.writeHead(200, icon.headers);
        res.end(icon.body);
    }
    else {
        options.favicon = options.favicon || {
            path: __dirname + "/../favicon.ico",
            maxAge: '1h'
        };
        var faviconPath = options.favicon.path;
        fs.readFile(faviconPath, function(err, buf){
            if (err) {
                log("Can't find favicon.ico");
                sendMissing(req, res, faviconPath);
                return;
            }
            icon = {
                headers: {
                    'Content-Type': 'image/x-icon'
                    , 'Content-Length': buf.length
                    , 'Cache-Control': 'public, max-age=' +
                        parseExpiresIn(options.favicon.maxAge) 
                },
                body: buf
            };
            res.writeHead(200, icon.headers);
            res.end(icon.body);
        });  
    }
    return true;
} 

function sendMissing(req, res, path) {
    // path = path.substring(1);
    res.writeHead(404, {
        'Content-Type': 'text/html'
    });
    res.write('<!doctype html>\n');
    res.write('<title>404 Not Found</title>\n');
    res.write('<h1>Not Found</h1>');
    res.write(
        '<p>The requested URL ' +
            escapeHtml(path) +
            ' was not found on this server.</p>'
    );
    res.end();
    log('404 Not Found: ' + path);
}


function sendForbidden(req, res, path) {
    path = path.substring(1);
    res.writeHead(403, {
        'Content-Type': 'text/html'
    });
    res.write('<!doctype html>\n');
    res.write('<title>403 Forbidden</title>\n');
    res.write('<h1>Forbidden</h1>');
    res.write(
        '<p>You do not have permission to access ' +
            escapeHtml(path) + ' on this server.</p>'
    );
    res.end();
    log('403 Forbidden: ' + path);
}

// function sendRedirect(req, res, redirectUrl) {
//     res.writeHead(301, {
//         'Content-Type': 'text/html',
//         'Location': redirectUrl
//     });
//     res.write('<!doctype html>\n');
//     res.write('<title>301 Moved Permanently</title>\n');
//     res.write('<h1>Moved Permanently</h1>');
//     res.write(
//         '<p>The document has moved <a href="' +
//             redirectUrl +
//             '">here</a>.</p>'
//         );
//     res.end();
//     log('301 Moved Permanently: ' + redirectUrl);
// }

function parseExpiresIn(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    var number = str.slice(0, str.length-1);
    var periond = str.slice(str.length-1);
    var multiplier = { m:60, h: 60*60, d: 24*60*60, w: 7*24*60*60, y: 52*7*24*60*60};
    return multiplier[periond] * number;
}


function getCacheHeaders(req, path, mimeType, options, cache) {
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
        cache = getCacheHeaders(req, path, mimeType, options, {
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
        for (var i = 0, len = packager.zipperMethods.length; i < len; ++i) 
            if (~accept.indexOf(packager.zipperMethods[i])) {
                encoding = packager.zipperMethods[i];
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


function sendDirectory(req, res, path) {
    function send(f) {
        if (!options.dir) {
              sendForbidden(req,res, path);
        }
        else f();
    }
    fs.readdir(path, function(err, files) {
        if (err) {
            send(function() {return sendError(req, res, err);});
            return;
        }

        if (!files.length) {
            send(function() {return writeDirectoryIndex(req, res, path, []);});
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
                    send(function() {return writeDirectoryIndex(req, res, path, files);});
            });
        });
    });
}

function writeDirectoryIndex(req, res, path, files) {
    path = path.substring(1);
    res.writeHead(200, {
        'Content-Type': 'text/html'
    });
    if (req.method === 'HEAD') {
        res.end();
        return;
    }
    res.write('<!doctype html>\n');
    res.write('<title>' + escapeHtml(path) + '</title>\n');
    res.write('<style>\n');
    res.write('  ol { list-style-type: none; font-size: 1.2em; }\n');
    res.write('</style>\n');
    res.write('<h1>Directory: ' + escapeHtml(path) + '</h1>');
    res.write('<ol>');
    files.forEach(function(fileName) {
        if (fileName.charAt(0) !== '.') {
            res.write('<li><a href="' +
                      escapeHtml(fileName) + '">' +
                      escapeHtml(fileName) + '</a></li>');
        }
    });
    res.write('</ol>');
    res.end();
}


//'_bust_'.length + Date().length + '_'.length == 6 + 39  = 47

function validSignature(str) {
    //you could check whether the date is parseable better, because
    //Date.parse is -very- forgiving, but as long as no file starts
    //with '_bust_' there will be no false positives.
    if (str.length < 49 || str.slice(0, 8) !== '_bust_' ||
        typeof Date.parse(str.slice(8, 47)) !== 'number') return false;
    return true;
}

function stripBust(path, oPath) {
    //strip the signature of the filename if present: 
    //as redundant as I can make it and the shortest route for the
    // most common case (repeat request of valid path)
    // as long as no dir or file name starts with _bust_ this will
    // work
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
    
    req.$sendError = sendError;
    req.$headers = headers;
    fileSender(req, res);
}


function handleRequest(req, res) {
    req.$options = options;
    // var path = (options.root + req.url.pathname).replace('//','/').replace(/%(..)/g, function(match, hex){
    //     return String.fromCharCode(parseInt(hex, 16));
    // });
    
    var path = Path.join(options.root, req.url.pathname);
    // console.log(sys.inspect(req.url));
    // path = Path.resolve(path);
    req.$path = req.$oPath = Path.resolve(path);
    
    // var parts = path.split('/'); if
    // (parts[parts.length-1].charAt(0) === '.')  sendForbidden(req,
    // res, path);
    
    // cache(req.$oPath, function(data) {
    //     if (data.validate) ;//??????????????????????
    //     res.writeHead(200, data.headers);
    //     res.end(data.value);
    // });
    
    // if (cache) return;
    // req.$cache = cache;
    
    
    path = req.$pat = stripBust(req.$path, req.$oPath);
    
    fs.stat(path, function(err, stat) {
        if (err) {
            delete pathMap[path];
            sendMissing(req, res, path);   
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
    
    if (options.favicon) {
        var sendMissingOld= sendMissing;
        sendMissing = function (req, res, path) {
            if (sendFavicon(req, res, sendMissingOld)) return;
            sendMissingOld(req, res, path);
        };
        
    }

    log =  options.silent ?  function () {}: function() {
        console.log.apply(console, arguments);
    };
    
    return handleRequest;
};
