var
    // sys = require('sys'),
    http = require('http'),
    fs = require('fs'),
    Url = require('url'),
    api = require('./api'),
    fileHandler = require("./fileHandler"),
    sendMisc = require('./sendMisc'),
    reqlogger, forwarder, sessions,
    Path = require('path')
;

var options, server, handlers, out;

function notImplemented501(req, res) {
    res.writeHead(501);
    res.end();
}

function handleRequest(req, res) {
    // console.log('HEADERS:', req['headers']);
    reqlogger(req, res);
    //we could forward based on domain as well but http-proxy is
    //doing that for us already
    //if we're forwarding based on a path we're done here
    if (forwarder(req, res, options)) return;

    //make req.url easier to use
    //also make it safe, have to look at this more carefully
    req.originalUrl = req.url;
    
    req.url = Url.parse(req.url, true);
    
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
            //example:
            session.get('visits', function(error, visits ) {
                // console.log('visits: ', visits+1);
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
    
    var send = sendMisc(someOptions);
    
    //request logger:
    reqlogger = options.log ?
        require("./logger")(options.log) : function() {};
    
    var apiHandler = api.init(options);
    
    //console logger:
    //TODO merge these logs with the request log
    // debug = options.debug =  options.quiet ?  function () {}: function() {
    //     console.log.apply(console, arguments);
    // };
    out = options.out;
    
    forwarder = options.forward ?
        require('./forwarder') : function() { return false; };
    
    if (options.sessions) {
        var Sessions = require('./sessions');
        sessions = new Sessions(
            options.sessions.store, options.sessions.opts, options.sessions.storeOpts
        );
    }
    // console.log('Created sessions object', sessions);
    fileHandler = fileHandler.get(options);
    
    handlers = {
        'GET': Object.keys(options.getHandlers).length ?
            function(req, res) {
                var path = req.url.pathname;
                (apiHandler('GET', path) ||
                 options.getHandlers[path] ||
                 fileHandler)(req, res);
            } : fileHandler,
        'POST': Object.keys(options.postHandlers).length ?
            function (req, res) {
                var path = req.url.pathname;
                (apiHandler('POST', path) ||
                 options.postHandlers[req.url.pathname] ||
                 function() { send.forbidden(req, res, req.url.path); })(req, res);
            }: function() {},
        'HEAD': fileHandler
        // ,'OPTIONS': notImplemented501
        // ,'PUT': notImplemented501
        // ,'DELETE': notImplemented501
        // ,'TRACE': notImplemented501
        // ,'CONNECT': notImplemented501
    };

    if (!options.https) server = http.createServer(handleRequest);
    else {
        var https = require('https');
        var ssl = {
            key: fs.readFileSync(Path.resolve(process.cwd(), options.https.privatekey)),
            cert: fs.readFileSync(Path.resolve(process.cwd(), options.https.certificate)) };
        server = https.createServer(ssl, handleRequest);
    }
    
    server.root = options.root;
    
    return server;
};

process.on('uncaughtException', function(e) {
    
    console.log(e.stack);
});

