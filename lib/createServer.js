/*global process:false require:false exports:false*/
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:10 maxlen:150 devel:true newcap:false*/ 

var
    // sys = require('sys'),
    http = require('http'),
    fs = require('fs'),
    url = require('url'),
    defaultHandler = require("./defaultHandler"),
    logger, forwarder, sessions
;

var options, server, handlers;

function notImplemented501(req, res) {
    res.writeHead(501);
    res.end();
}

function handleRequest(req, res) {
    logger(req, res);
    
    //we could forward based on domain as well but http-proxy is
    //doing that for us already
    //if we're forwarding based on a path we're done here
    if (forwarder(req, res, options)) return;
    
    //make req.url easier to use
    //also make it safe, have to look at this more carefully
    //legacy code
    req.originalUrl = req.url;
    var parsed = url.parse(req.url);
    parsed.pathname = url.resolve('/', parsed.pathname);
    req.url = url.parse(url.format(parsed), true);
    //Pick a handler based on method specified in the request
    var handler = handlers[req.method];
    if (!handler) notImplemented501(req, res);
    
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
            // handler(req, res);
            //example:
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
    
    logger = options.log ?
        require("./logger")(options.log) : function() {};
    
    forwarder = options.forward ?
        require('./forwarder') : function() { return false; };
    
    if (options.sessions) 
        sessions = new require("./sessions")(
            options.sessions.store, options.sessions.opts, options.sessions.storeOpts
        );
    
    defaultHandler = defaultHandler.get(options);
    
    handlers = {
        'GET': Object.keys(options.getHandlers).length ?
            function(req, res) {
                (options.getHandlers[req.url.pathname] || defaultHandler)(req, res);
            } : defaultHandler,
        'POST': Object.keys(options.postHandlers).length ?
            function (req, res) {
                (options.postHandlers[req.url.pathname] || function() {})(req, res);
            }: function() {},
        'HEAD': defaultHandler
        ,'OPTIONS': notImplemented501
        ,'PUT': notImplemented501
        ,'DELETE': notImplemented501
        ,'TRACE': notImplemented501
        ,'CONNECT': notImplemented501
    };

    if (!options.secure) server = http.createServer(handleRequest);
    else {
        var https = require('https');
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

