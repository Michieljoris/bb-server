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
    if (argv.sessions || argv.s) {
        sessions = {
            store: argv.sessions.store,
            storeOpts: argv.sessions.storeOpts,
            opts: argv.sessions
        };
    }
    
    argv = {
        root: (argv._ && argv._[0]) || argv.root || argv.r || './',
        dir: !(argv.b || argv.block),
        index: argv.i || argv.index,
        gzip: argv.g || argv.gzip,
        escaped: argv.e || argv.escaped,
        bot: argv.e === 'bot' || argv.escaped === 'bot',
        forward: argv.f || argv.forward,
        secure: argv.https, 
        cache: argv.c || argv.cache,
        noStrip:  argv.nostrip,
        favicon:  argv.favicon,
	silent: argv.s || argv.silent,
        markdown: !(argv.nomarkdown),
        sessions: sessions,
        wsServer: argv.w || argv.websocket,
        log: argv.l || argv.log,
        
        //config file only
        headers: argv.headers || {},
        cacheSettings: argv.cacheSettings || {},
        postHandlers: argv.postHandlers || {},
        getHandlers: argv.getHandlers || {},
        version: version
    };
    
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
        log('Gzip: '.grey + getOptionString(argv.gzip));
        log('Cache: '.grey + getOptionString(argv.cache));
        log('Strip sign: '.grey + getOptionString(!argv.noStrip));
        log('Favicon: '.grey + getOptionString(argv.favicon));
        log('Fragments '.grey +
            (typeof argv.fragment === 'string' ?
             argv.fragment.green : getOptionString(argv.fragment)));
        log('Convert Markdown: '.grey + getOptionString(argv.markdown));
        log('Https server: '.grey + getOptionString(argv.secure));
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
    log = (argv.s || argv.silent) ? function () {} : console.log;

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
