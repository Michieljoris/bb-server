/*global module:false require:false*/
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:7 maxlen:150 devel:true newcap:false*/ 

//TODO needs to be tested!!!!

var http = require('http');
var url = require('url');
var options;

function error(response, err, reason, code) {
    console.log('Error '+code+': '+err+' ('+reason+').');
    response.writeHead(code, { 'Content-Type': 'application/json' });
    response.write(JSON.stringify({ err: err, reason: reason }));
    response.end();
}


//The next two functions let us forward requests to another server,
//conditional on the path
function forwardRequest(inRequest, inResponse, uri) {
    
    function unknownError(response, e) {
        console.log(e.stack);
        error(response, 'unknown', 'Unexpected error.', 500);
    }
    
    console.log(inRequest.method + ' ' + uri);

    uri = url.parse(uri);
    var out = http.createClient(uri.port||80, uri.hostname);
    var path = uri.pathname + (uri.search || '');
    var headers = inRequest.headers;
    headers.host = uri.hostname + ':' + (uri.port||80);
    headers['x-forwarded-for'] = inRequest.connection.remoteAddress;
    headers.referer = 'http://' + uri.hostname + ':' + (uri.port||80) + '/';

    var outRequest = out.request(inRequest.method, path, headers);

    out.on('error', function(e) { unknownError(inResponse, e); });
    outRequest.on('error', function(e) { unknownError(inResponse, e); });

    inRequest.on('data', function(chunk) { outRequest.write(chunk); });
    inRequest.on('end', function() {
        outRequest.on('response', function(outResponse) {
            // nginx does not support chunked transfers for proxied requests
            delete outResponse.headers['transfer-encoding'];

            if (outResponse.statusCode === 503) {
                error(inResponse, 'db_unavailable', 'Database server not available.', 502);
            }

            inResponse.writeHead(outResponse.statusCode, outResponse.headers);
            outResponse.on('data', function(chunk) { inResponse.write(chunk); });
            outResponse.on('end', function() { inResponse.end(); });
        });
        outRequest.end();
    });
}

function getForwardingUrl(urlString) {
    var urlParsed = url.parse(urlString);
    for (var i = 0; i < options.forward.length; i++) { 
        // console.log(options.forward[i]);
        var prefix = options.forward[i].prefix;
        // console.log(u.pathname.substring(1,prefix.length+1));
        if (urlParsed.pathname.substring(1, prefix.length + 1) === prefix) 
            return options.forward[i].target +
            urlParsed.pathname.substring(prefix.length+1) +
            (urlParsed.search||'');
    }
    return false;
}

module.exports = function(req, res, someOptions) {
    options = someOptions;
    var forwardingUrl =  getForwardingUrl(req.url);
    if (forwardingUrl) {
        forwardRequest(req, res, forwardingUrl);
        return true;
    }
    else return false;
};
