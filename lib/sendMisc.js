/*global __dirname:false module:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/ 

var escapeHtml = require('escape-html'),
    sys = require('sys')
    // fs = require('fs-extra')

;

var out;
var options;


//send favicon set in options with customized max-age or by default
//send favicon included with server with max-age = 1 hour, or put
//favicon in root dir and max-age will be 0
function sendFavicon(req, res) {
    if (options.favicon && options.favicon.icon) {
        res.writeHead(200, options.favicon.icon.headers);
        res.end(options.favicon.icon.body);
    }
    else sendMissing(req, res, req.url.pathname);
    return true;
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
    out('500 Internal Server Error');
    out(sys.inspect(error));
}


function sendMissing(req, res, path) {
    // console.log('in sendmissing', path);
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
    out('404 Not Found: ' + path);
}


function sendForbidden(req, res, path) {
    // path = path.substring(1);
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
    out('403 Forbidden: ' + path);
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
    out('301 Moved Permanently: ' + redirectUrl);
}

module.exports = function(someOptions) {
    options = someOptions;
    out = options.out;
    return {
        missing: sendMissing,
        redirect: sendRedirect,
        error: sendError,
        forbidden: sendForbidden,
        favicon: sendFavicon
    };
};

