/*global __dirname:false exports:false process:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:7 maxlen:150 devel:true newcap:false*/ 

// var sys = require('sys');
var
    colors = require('colors'),
    httpServer = require('./createServer.js'),
    portfinder = require('portfinder'),
    wsServer = require('./webSocketServer.js'),
    fs = require('fs')
    // forever = require('forever-monitor');
;

function Typeof(v) {
    var type = {}.toString.call(v);
    return type.slice(8, type.length-1);
}

var version = JSON.parse(fs.readFileSync(__dirname + "/../package.json")).version;

function getOptionString(o) {
    return (o ? 'yes'.green : 'no'.red) ;
}


function listen(log, host, port, argv) {
    var sessions;
    if (argv.sessions) {
        sessions = {
            store: argv.sessions.store,
            storeOpts: argv.sessions.storeOpts,
            opts: argv.sessions
        };
    }
    
    argv = {
        root: (argv._ && argv._[0]) || argv.root || './',
        dir: !(argv.b || argv.block),
        index: argv.i || argv.index,
        gzip: argv.g || argv.gzip,
        minify: argv.m || argv.minify,
        transpile: argv.t || argv.transpile,
        cache: argv.c || argv.cache,
        favicon:  argv.f || argv.favicon, //true or { path:'a/b'[, maxAge: '1h'] }
	silent: argv.q || argv.quiet,
        markdown: !(argv.nomarkdown),
        wsServer: argv.w || argv.websocket,
        log: argv.l || argv.log,
        
        escaped: argv.e || argv.escaped,
        bot: argv.e === 'bot' || argv.escaped === 'bot',
        
        //config file only
        headers: argv.headers || {},
        cacheSettings: argv.cacheSettings || {},
        postHandlers: argv.postHandlers || {},
        getHandlers: argv.getHandlers || {},
        version: version
    };
    
    function parseExpiresIn(str) {
        if (!str) return 0;
        if (typeof str === 'number') return str;
        var number = str.slice(0, str.length-1);
        var periond = str.slice(str.length-1);
        var multiplier = { m:60, h: 60*60, d: 24*60*60, w: 7*24*60*60, y: 52*7*24*60*60};
        return multiplier[periond] * number;
    }    
    
    if (argv.cache) {
        var expiresIn = parseExpiresIn(argv.expiresIn); //seconds
        var cacheControl = "max-age=" + expiresIn;
        if (argv.cache['private'])
            cacheControl += ", private";
        else if (argv.cache['public'] === undefined || argv.cache['public'])
            cacheControl += ", public";
        argv.cache['Cache-Control'] = cacheControl;
        argv.cache.expiresIn = (expiresIn ? expiresIn : -1000000000) * 1000;
    }
    
    argv.favicon = argv.favicon || {
        path: __dirname + "/../favicon.ico",
        maxAge: '1h'
    };
    
    var faviconPath = argv.favicon.path;
    fs.readFileSync(faviconPath, function(err, buf){
        if (err) {
            log("Can't find favicon.ico");
            delete argv.favicon;
        } else
            argv.favicion.icon = {
                headers: {
                    'Content-Type': 'image/x-icon'
                    , 'Content-Length': buf.length
                    , 'Cache-Control': 'public, max-age=' +
                        parseExpiresIn(argv.favicon.maxAge) 
                },
                body: buf
            };
    });
    
    if (argv.log) {
        switch (Typeof(argv.log))
        {
          case 'Boolean':
            argv.log = {}; //uses defaults (stdout, default format)
            break;
          case 'String':  //path
            argv.log = {
                stream: argv.log
            };
            break;
          case 'Object': 
            break;
        default: 
            throw new Error('option log must be a boolean, string or object');
        }
        if (typeof argv.log.stream === 'string')
            argv.log.stream = fs.createWriteStream(argv.log.stream);
    }
    
    argv.transpile = (typeof argv.transpile === 'boolean' && argv.transpile) ?
        /markdown/ : argv.transpile;
    
    if (argv.transpile && !argv.transpile.test)
        throw new Error('option transpile must be a regular expression');
    
    argv.minify = (typeof argv.minify === 'boolean' && argv.minify) ?
        /javascript|css/ : argv.minify;
    
    if (argv.minify && !argv.minify.test)
        throw new Error('option minify must be a regular expression');
    
    argv.gzip = (typeof argv.gzip === 'boolean' && argv.gzip) ?
        /text|javascript|json/ : argv.gzip;
    
    if (argv.gzip && !argv.gzip.test)
        throw new Error('option gzip must be a regular expression');
    
    if (argv.forward) {
        argv.forward = [ {
            prefix: argv.prefix || 'db',
            target: argv.target || 'http://localhost:5984'
        } ];
    } 
    
    //make sure we serve from somewhere
    if (!argv.root) {
        try {
            fs.lstatSync('./public');
            argv.root = './public';
        }
        catch (err) {
            argv.root = './';
        }
    }
    var server = httpServer.createServer(argv);
    
    if (argv.wsServer) {
        wsServer.init(server); 
    }
    
    server.listen(port, host, function() {
        log('Version ' + argv.version);
        log('Starting up http-server, serving '.yellow +
            server.root.cyan +
            ' on: '.yellow +
            (host + ':' + port).cyan);
        log('Listing dir contents : '.grey + getOptionString(argv.dir));
        log('Auto show index.htm[l]: '.grey + getOptionString(argv.index));
        log('Gzip: '.grey + (argv.gzip ? String(argv.gzip).green : 'no'.red));
        log('Minify: '.grey + (argv.minify ? String(argv.minify).green : 'no'.red));
        log('Compile: '.grey + (argv.compile ? String(argv.compile).green : 'no'.red));
        log('Cache: '.grey + getOptionString(argv.cache));
        log('True urls: '.grey + getOptionString(!argv.trueUrls));
        log('Favicon: '.grey + getOptionString(argv.favicon));
        log('Fragments '.grey +
            (typeof argv.fragment === 'string' ?
             argv.fragment.green : getOptionString(argv.fragment)));
        log('Https server: '.grey + getOptionString(argv.https));
        log('Forward: '.grey + getOptionString(argv.forward));//
        if (argv.forward) console.log(argv.forward);
        log('Websocket server '.grey + getOptionString(argv.wsServer));//
        log('Sessions: '.grey + getOptionString(argv.sessions));//
        if (argv.sessions) {
            log(argv.sessions);
        }
        if (Object.keys(argv.getHandlers).length) {
            log('getHandlers:'.grey, Object.keys(argv.getHandlers));
        }
        if (Object.keys(argv.postHandlers).length) {
            log('postHandlers:'.grey, Object.keys(argv.postHandlers));
        }
        
        log('Log '.grey + (typeof argv.log === 'string' ?
                           argv.log.green : getOptionString(argv.log)));
        // log('Hit CTRL-C to stop the server');
        
        
        if (argv.cacheSettings.path) {
            var paths = argv.cacheSettings.path;
            Object.keys(paths).forEach(function(p){
                var maxAge = paths[p]['max-age'];
                if (maxAge && Number(maxAge.slice(0, maxAge.length-1)) !== 0)
                { log('WARNING: max-age set to bigger than 0 on path '.red + (p+'').yellow); }
            });
        }
        if (argv.cacheSettings.mimeType) {
            var mimeTypes = argv.cacheSettings.mimeType;
            Object.keys(mimeTypes).forEach(function(m){
                var maxAge = mimeTypes[m]['max-age'];
                if (maxAge && Number(maxAge.slice(0, maxAge.length-1)) !== 0)
                { log('WARNING: max-age set to bigger than 0 on mimetype '.red + m.yellow); }
            });
        }
    
    });
    
}


exports.go = function(argv) {
    
    if (process.platform !== 'win32') {
        //
        // Signal handlers don't work on Windows.
        //
        process.on('SIGINT', function () {
            log('http-server stopped.'.red);
            process.exit();
        });
    }
    
    var port = argv.p || argv.port || Number(process.env.HTTPSERVER_PORT),
    host = argv.a || argv.address || process.env.HTTPSERVER_IPADDR || '0.0.0.0',
    log = (argv.q || argv.quiet) ? function () {} : console.log;

    if (!port) {
        portfinder.basePort = 8080;
        portfinder.getPort(function (err, port) {
            if (err) throw err;
            listen(log, host, port, argv);
        });
    } else {
        listen(log, host, port, argv);
    }
    
};
