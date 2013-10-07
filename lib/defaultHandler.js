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
    md = require("node-markdown").Markdown,
    mime = require("mime"),
    Path = require('path'),
    exec = require('child_process').exec,
    zlib = require('zlib')

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

var icon;
function sendFavicon(req, res, sendMissing) {
    if (req.originalUrl !== '/favicon.ico') return false;
    if (icon) {
        res.writeHead(200, icon.headers);
        res.end(icon.body);
    }
    else {
        var favicon = typeof favicon === 'string' ?
            favicon : __dirname + "/../favicon.ico";
        fs.readFile(favicon, function(err, buf){
            if (err) {
                log("Can't find favicon.ico");
                sendMissing(req, res, favicon);
                return;
            }
            icon = {
                headers: {
                    'Content-Type': 'image/x-icon'
                    , 'Content-Length': buf.length
                    , 'Cache-Control': 'public, max-age=' + 3600
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

function parseMaxAge(str) {
    var number = str.slice(0, str.length-1);
    var periond = str.slice(str.length-1);
    var multiplier = { m:60, h: 60*60, d: 24*60*60, w: 7*24*60*60 };
    return multiplier[periond] * number;
}


function createHeaders(req, res, mimeType, GMTdate, path) {
    //default headers
    mimeType =  mimeType || 'text/plain';
    var headers = 
        {
            'Content-Type': mimeType
            ,Server: 'bb-server/' + options.version
        };
    
    // set cache headers
    if (dev || !options.cache) {
        //Don'use cache, always go to the server for the original:
        headers['Cache-Control'] = "private, no-cache, no-store, must-revalidate";
	headers.Expires = new Date(0).toString();
    }
    else if (!options.cacheSettings) {
        //use cache but always revalidate:
        headers['Cache-Control'] = "public, max-age=0";
	headers['Last-Modified'] = GMTdate.toString();
	headers.Expires = new Date(0).toString();
    }
    else {
        //Get cache settings for the requested path or otherwise its mimetype:
        var cacheSettings =
            options.cacheSettings.path[path] ||
            cacheSettings.mimeType[mimeType] || {};
            
        if (typeof cacheSettings === 'function')
            //set your own cache headers
            cacheSettings(headers);
        else {
            //process settings:
            var maxAge;
            if (cacheSettings['Cache-Control'])  {
                headers['Cache-Control'] = cacheSettings['Cache-Control'];
                maxAge = cacheSettings['max-agems'];
            }
            else {
                //only executed first time for the particular path or mimetype
                maxAge = parseMaxAge(cacheSettings['max-age'] || '0m');
                var cacheControl = "max-age=" + maxAge;
                if (cacheSettings['private'])
                    cacheControl += ", private";
                else if (cacheSettings['public'] === undefined || cacheSettings['public'])
                    cacheControl += ", public";
                //cache the cache control...
                cacheSettings['Cache-Control'] = cacheControl;
                cacheSettings['max-agems'] = maxAge * 1000;
            }
                
            headers.Expires = maxAge === 0 ?
                new Date(0).toString() : new Date(new Date().getTime() + maxAge).toString();
                
	    headers['Last-Modified'] = GMTdate.toString();
            //TODO?? don't set public , but set private for files that have cookie headers set
            //TODO add versioning to html-builder, and also merging and minifying of course..
        }
    }

    //set gzip headers
    var ua = req.headers['user-agent'] || '',
    accept = req.headers['accept-encoding'] || '';
    
    // Note: this is not a conformant accept-encoding parser.
    // See http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
    if (options.gzip && (~accept.indexOf('gzip') || ~accept.indexOf('*')) &&
        options.gzip.test(mimeType) && 
        !(~ua.indexOf('MSIE 6') && !~ua.indexOf('SV1')) &&
        req.method !== 'HEAD'
       ) 
    {
        headers['Content-Encoding']='gzip';
        headers.Vary = 'Accept-Encoding';
    }
    
    //add any custom headers
    Object.keys(options.headers).forEach(function(k){
        headers[k] = options.headers[k];
    });
    
    return headers;
}

function gzip(filename,  transform, success, error) {
    fs.readFile(decodeURI(filename), function (err, data) {
        if (err) error(err);
        data = transform(data.toString());
        zlib.gzip(data, function(err, result) {
            if (err) error(err);
            else success(result);
        });
    });
}

function sendFile(req, res, path, GMTdate) {
    if (!dev && Date.parse(req.headers["if-modified-since"]) >= Date.parse(GMTdate))  {
        // if (!dev && req.headers["if-modified-since"] === GMTdate.toString()) {
        res.writeHead(304, {});
        res.end();
        return;
    }
    var mimeType = mime.lookup(path);
    
    var headers = createHeaders(req, res, mimeType, GMTdate, path);
    
    if (req.method === 'HEAD') {
        res.writeHead(200, headers);
        res.end();
        return;
    }
    
    function send() {
        res.writeHead(200, headers);
        fs.createReadStream(path).pipe(res);
    }
    
    if (headers['Content-Encoding'] === 'gzip') {
        // //on the fly gzipping:
        // fs.createReadStream(path).pipe(gzip).pipe(res);
        // cached gzipping: (on disk not memory)
        var identityPath = path;
        path = path + '.' + Number(GMTdate) +  '.gz';
        fs.stat(path, function(err) {
            if (err && err.code === 'ENOENT') {
                // Remove any old gz file
                exec('rm ' + path + '.*.gz', function() {
                    var transform = function(data) { return data; };
                    if (mimeType && options.markdown && /markdown/.test(mimeType)) {
                        headers['Content-Type'] = mime.lookup('.html');
                        transform = function (data) { return md(data); };
                    } 
                    // Gzipped file doesn't exist, so make it then send
                    gzip(identityPath, transform, 
                         function(data) {
                             fs.writeFile(path, data, function(err) {
                                 if (err) sendError(req, res, err);
                                 else send();
                             });
                         },
                         function(err) {
                             sendError(req, res, err);
                         });
                });
            } else if (err) {
                delete headers['Content-Encoding'];
                delete headers.Vary;
                path = identityPath;       
                send();
            } else {
                send();
            }
        });
        return;
    }
    else  {
        if (mimeType && options.markdown && /markdown/.test(mimeType)) {
            //you could abstract this and have plugin transformers based
            //for example on mimetype, but for now inline
            headers['Content-Type'] = mime.lookup('.html');
            fs.readFile(decodeURI(path), function (err, data) {
                if (err) sendError(err);
                else {
                    res.writeHead(200, headers);
                    res.end(md(data.toString()));
                }
            });
            
        } 
        else send();
    } 
    
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
                    sendFile(req, res, path + '/' + fileName);   
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


var UUIDLength = 48;
//'_signed_'.length + Date().length + '_'.length == 8 + 39 + 1 = 48

function validSign(str) {
    //you could check whether the date is parseable better, because
    //Date.parse is -very- forgiving, but as long as no file starts
    //with '_signed_' there will be no false positives.
    if (str.length < 49 || str.slice(0, 8) !== '_signed_' ||
        typeof Date.parse(str.slice(8, 47)) !== 'number') return false;
    return true;
}

function handleRequest(req, res) {
    // var path = (options.root + req.url.pathname).replace('//','/').replace(/%(..)/g, function(match, hex){
    //     return String.fromCharCode(parseInt(hex, 16));
    // });
    
    var path = Path.join(options.root, req.url.pathname);
    // console.log(sys.inspect(req.url));
    // path = Path.resolve(path);
    var originalPath = (path = Path.resolve(path));
    
    // var parts = path.split('/'); if
    // (parts[parts.length-1].charAt(0) === '.')  sendForbidden(req,
    // res, path);
    
    //strip the sign of the filename: 
    //as redundant as I can make it and the shortest route for the
    // most common case (repeat request of valid path)
    // as long as no dir or file name starts with _signed_ this will
    // work
    var baseName = Path.basename(path);
    if (!options.noStrip)  {
        path = pathMap[path];
        if (!path && validSign(baseName.slice(0, UUIDLength)))     
            path = baseName.slice(0, UUIDLength);
        else path = originalPath;
            
    }
    fs.stat(path, function(err, stat) {
        if (err) sendMissing(req, res, path);
        else {
            pathMap[path] = path;
            if (stat.isDirectory())
                sendDirectory(req, res, path);
            else sendFile(req, res, path, stat.mtime);
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
