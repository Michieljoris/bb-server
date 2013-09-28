/*global module:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:7 maxlen:150 devel:true newcap:false*/ 

/**
 * Handles static content.
 */

var
    sys = require('sys'),
    fs = require('fs'),
    url = require('url'),
    md = require("node-markdown").Markdown
;

var options, log;

function escapeHtml(value) {
    return value.toString().
        replace('<', '&lt;').
        replace('>', '&gt;').
        replace('"', '&quot;');
}

var MimeMap = {
    'txt': 'text/plain',
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'xml': 'application/xml',
    'json': 'application/json',
    'js': 'application/javascript',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'png': 'image/png',
    'appcache': 'text/cache-manifest',
    'woff': 'application/x-font-woff',
    'markdown': 'text/x-markdown; charset=UTF-8',
    'md': 'text/x-markdown; charset=UTF-8',
    'mp3': 'audio/mpeg;',
    'pdf': 'application/pdf',
    'ogg': 'audio/ogg;'
};

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

function sendRedirect(req, res, redirectUrl) {
    res.writeHead(301, {
        'Content-Type': 'text/html',
        'Location': redirectUrl
    });
    res.write('<!doctype html>\n');
    res.write('<title>301 Moved Permanently</title>\n');
    res.write('<h1>Moved Permanently</h1>');
    res.write(
        '<p>The document has moved <a href="' +
            redirectUrl +
            '">here</a>.</p>'
        );
    res.end();
    log('301 Moved Permanently: ' + redirectUrl);
}

function writeHead(req, res, mimeType, GMTdate) {
    res.writeHead(200, {
        'Content-Type': 
	mimeType || 'text/plain',
	'last-modified': GMTdate
    });
    
    if (req.method === 'HEAD') {
        res.end();
        return true;
    }
    return false;
    
}

function sendFile(req, res, path) {
    var GMTdate = fs.statSync(path).mtime;
    var mimeType = MimeMap[path.split('.').pop()] || 'text/plain';
    if (typeof mimeType === 'undefined') mimeType = 'text/plain';
    // log(GMTdate, mimeType);
    
    if (mimeType && options.markdown && mimeType.indexOf('text/x-markdown') === 0) {
        mimeType = MimeMap.html;
        if (writeHead(req, res, mimeType, GMTdate)) return;
        fs.readFile(path,'utf8', function (err, data) {
            if (err) {
                sendError(req, res, err);
            }
            else {
                var html = md(data); 
                res.end(html);   
            }
        });
        
    
        return;
    }
        
    if (writeHead(req, res, mimeType, GMTdate)) return;
    
    var file = fs.createReadStream(path);
    file.on('data', res.write.bind(res));
    file.on('close', function() {
        res.end();
    });
    file.on('error', function(error) {
        sendError(req, res, error);
    });
}

function sendDirectory(req, res, path) {
    function send(f) {
        if (!options.dir) {
              sendForbidden(req,res, path);
        }
        else f();
    }
    
    if (path.match(/[^\/]$/)) {
        req.url.pathname += '/';
        var redirectUrl = url.format(url.parse(url.format(req.url)));
        send(function(){ return sendRedirect(req, res, redirectUrl);});
        return;
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
};


function handleRequest(req, res) {
    var path = (options.root + req.url.pathname).replace('//','/').replace(/%(..)/g, function(match, hex){
        return String.fromCharCode(parseInt(hex, 16));
    });
    
    // console.log('1 doing fstat on:' + path);
    
    var parts = path.split('/');
    if (parts[parts.length-1].charAt(0) === '.')
        return sendForbidden(req, res, path);
    fs.stat(path, function(err, stat) {
        if (err)
            sendMissing(req, res, path);
        else if (stat.isDirectory())
            sendDirectory(req, res, path);
        else sendFile(req, res, path);
    });
}

module.exports.get = function(someOptions) {
    options = someOptions;
    
    log =  options.silent ?  function () {}: function() {
        console.log.apply(console, arguments);
    };
    
    return handleRequest;
};
