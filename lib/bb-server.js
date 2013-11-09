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
        dir: argv.d || argv.dir, //send directory listing page, true, array or regexp
        index: argv.i || argv.index, //autoindex true or string, default index.html
        cache: argv.c || argv.cache, //true or false
        bust: argv.b || argv.bust,
        favicon:  argv.f || argv.favicon, //true or { path:'a/b'[, maxAge: '1h'] }
        spa: argv.s || argv.spa, //single page app. Boolean or string, if true defaults to 'index.html'
        wsServer: argv.w || argv.websocket,
        
        //recast:
        zip: argv.z || argv.zip, 
        minify: argv.m || argv.minify,
        transpile: argv.t || argv.transpile,
        
        //crawlers:
        // bot: argv.bot, //truthy, list of bots or function
        // hashbang: argv.hashbang, //falsy, truthy or list
        // fragment: argv.fragment, //falsy, truthy or list,
        
        //forward, target, prefix
        
	silent: argv.q || argv.quiet,
        log: argv.l || argv.log,
        
        //config file only
        headers: argv.headers || {},
        // recast: argv.recast,
        
        postHandlers: argv.postHandlers || {},
        getHandlers: argv.getHandlers || {},
        version: version
    };
    if (typeof argv.dir === 'undefined') argv.dir = true;
    if (typeof argv.bust === 'undefined') argv.bust = true;
    
    if (argv.index && typeof argv.index === 'boolean') argv.index = 'index.html';
    if (argv.spa && typeof argv.spa === 'boolean') argv.spa = 'index.html';
    if (!argv.recast) {
        argv.recast = {
            transpile: argv.transpile ?
                ['jade', 'less', 'stylus', 'sweetjs', 'typescript', 'coffeescript', 'markdown', 'regenerators'] : [], 
            minify: argv.minify ? ['js', 'css', 'html'] : [],
            zip: argv.zip,
            verbose: true
        };
    }
    
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
    
    argv.zip = (typeof argv.zip === 'boolean' && argv.zip) ?
        /text|javascript|json/ : argv.zip;
    
    if (argv.zip && !argv.zip.test)
        throw new Error('option zip must be a regular expression');
    
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
        log('Zip: '.grey + (argv.zip ? String(argv.zip).green : 'no'.red));
        log('Minify: '.grey + (argv.minify ? String(argv.minify).green : 'no'.red));
        log('Transpile: '.grey + (argv.compile ? String(argv.transpile).green : 'no'.red));
        log('Cache headers: '.grey + getOptionString(argv.cache));
        log('Strip bust '.grey + getOptionString(!argv.bust));
        log('Favicon: '.grey + getOptionString(argv.favicon));
        log('Prerender '.grey + (
            typeof argv.prerender === 'string' ? argv.prerender.green :getOptionString(argv.prerender)
        ));
        log('Fragments '.grey + getOptionString(argv.fragment));
        log('Bots '.grey + getOptionString(argv.bots));
        log('Hashbangs '.grey + getOptionString(argv.hashbang));
        log('Spa '.grey + getOptionString(argv.spa));
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
        log('Hit CTRL-C to stop the server'.green);
        
        
        // if (argv.cacheSettings.path) {
        //     var paths = argv.cacheSettings.path;
        //     Object.keys(paths).forEach(function(p){
        //         var maxAge = paths[p]['max-age'];
        //         if (maxAge && Number(maxAge.slice(0, maxAge.length-1)) !== 0)
        //         { log('WARNING: max-age set to bigger than 0 on path '.red + (p+'').yellow); }
        //     });
        // }
        // if (argv.cacheSettings.mimeType) {
        //     var mimeTypes = argv.cacheSettings.mimeType;
        //     Object.keys(mimeTypes).forEach(function(m){
        //         var maxAge = mimeTypes[m]['max-age'];
        //         if (maxAge && Number(maxAge.slice(0, maxAge.length-1)) !== 0)
        //         { log('WARNING: max-age set to bigger than 0 on mimetype '.red + m.yellow); }
        //     });
        // }
    
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
