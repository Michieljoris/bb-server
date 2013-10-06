/*global process:false require:false exports:false*/
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:7 maxlen:150 devel:true newcap:false*/ 

var
    sys = require('sys'),
    http = require('http'),
    fs = require('fs'),
    url = require('url'),
    https = require('https'),
    Sessions = require("./sessions"),
    defaultHandler = require("./defaultHandler")
// ,events = require('events')
;

var options, log, sessions, server;


function error(response, err, reason, code) {
    log('Error '+code+': '+err+' ('+reason+').');
    response.writeHead(code, { 'Content-Type': 'application/json' });
    response.write(JSON.stringify({ err: err, reason: reason }));
    response.end();
}

//The next two functions let us forward requests to another server,
//conditional on the path
function forwardRequest(inRequest, inResponse, uri) {
    
    function unknownError(response, e) {
        log(e.stack);
        error(response, 'unknown', 'Unexpected error.', 500);
    }
    
    log(inRequest.method + ' ' + uri);

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
    if (!options.forward) return false;
    urlString = url.parse(urlString);
    for (var i = 0; i < options.forward.length; i++) { 
        // console.log(options.forward[i]);
        var prefix = options.forward[i].prefix;
        // console.log(u.pathname.substring(1,prefix.length+1));
        if (urlString.pathname.substring(1, prefix.length + 1) === prefix) 
            return options.forward[i].target +
            urlString.pathname.substring(prefix.length+1) +
            (urlString.search||'');
    }
    return false;
}


//Deal with posts
function handlePost(req, res) {
    //we ignore posts if they are not desired
    if (!options.postHandlers) return;
    console.log("[200] " + req.method + " to " , req.url);
    var path = req.url.pathname;
    var postHandler = options.postHandlers[path];
    if (postHandler) postHandler.handlePost(req, res);
    //do nothing if no handler found
}

//Deal with gets
function handleGet(req, res) {
    var pathname = req.url.pathname;
    var handler;
    if (options.getHandlers &&
        (handler = options.getHandlers[pathname])) {
        
        handler.handleGet(req, res);
    }
    else defaultHandler(req,res);
}

function getIp(req){
    if (req.ip) return req.ip;
    var sock = req.socket;
    if (sock.socket) return sock.socket.remoteAddress;
    return sock.remoteAddress;
}

function handleRequest(req, res) {
    var logData;
    req._startTime = Date.now();
    if (options.log) {
        logData = {
            date: new Date().toString() //.toUTCString()
            ,method: req.method
            ,ip: getIp(req)
            ,remoteAddress:  req.connection.remoteAddress
            ,'forwarded-for' :(req.headers['x-forwarded-for'] || '').split(',')[0] || '' 
            ,url: req.originalUrl || req.url
            ,UA: req.headers['user-agent']
            ,referrer: req.headers.referer || req.headers.referrer || ''
            ,'http-version': req.httpVersionMajor + '.' + req.httpVersionMinor
            
            ,status: 0 //res.statusCode
            ,'content-length': 0
            ,'response-time': 0 //new Date - req._startTime
            // req.headers[field.toLowerCase()];
            // (res._headers || {})[field.toLowerCase()];
            // colored output
            // to stdOut or file
            // see  http://www.senchalabs.org/connect/logger.html
        };
        
    }
    log(sys.inspect(req.headers));
    log(sys.inspect(logData));
    // var logEntry = req.method + ' ' + req.url;

    process.stdout.write(".");
    var urlString = req.url;
    
    var parsed = url.parse(urlString);
    parsed.pathname = url.resolve('/', parsed.pathname);
    req.url = url.parse(url.format(parsed), true);

    //if we're forwarding based on a path we're done here
    var forwardingUrl =  getForwardingUrl(urlString);
    if (forwardingUrl) {
        forwardRequest(req, res, forwardingUrl);
        return;
    }
    
    //Pick a handler based on method specified in the request
        var handler = {
            'GET': handleGet,
            'HEAD': defaultHandler,
            'POST': handlePost
        }[req.method];
    
    //we're done if there's no handler
    if (!handler) {
        log(req.method);
        res.writeHead(501);
        res.end();
        return;
    } 
    
    //if using sessions add it to the req and then pass everything on to the handler
    //visits is an example of how to persist data tied to a session
    if (sessions) {
        var data = { visits:0 }; //I think this only gets used first time
        sessions.httpRequest(req, res, data, function(err, session) {
            if (err) {
		res.end("session error");
                return;
	    }
            req.session = session;
            session.get('visits', function(error, visits ) {
                // log('visits: ', visits+1);
                session.set('visits', visits+1, function() {
                    handler(req, res);
                });
            });
        });
    }
    else handler(req, res);
}

//Configure the server
exports.createServer = function (someOptions) {
    options = someOptions || {};

    //make sure we serve from somewhere
    if (!options.root) {
        try {
            fs.lstatSync('./public');
            options.root = './public';
        }
        catch (err) {
            options.root = './';
        }
    }
    
    //instantiate sessions if desired
    if (options.sessions) {
        sessions = new Sessions(
            options.sessions.store, options.sessions.opts, options.sessions.storeOpts
        );
    }
    
    log =  options.silent ?  function () {}: function() {
        console.log.apply(console, arguments);
    };
    
    options.gzip = (typeof options.gzip === 'boolean' && options.gzip) ?
        /text|javascript|json/ : options.gzip;
    if (options.gzip && !options.gzip.test) throw new Error('option gzip must be a regular expression');
    
    defaultHandler = defaultHandler.get(options);

    if (!options.secure) server = http.createServer(handleRequest);
    else {
        var ssl = {
            key: fs.readFileSync(options.privatekey),
            cert: fs.readFileSync(options.certificate) };
        server = https.createServer(ssl, handleRequest);
    }
    
    server.root = options.root;
    
    return server;
};

process.on('uncaughtException', function(e) {
    console.log(e.stack);
});

