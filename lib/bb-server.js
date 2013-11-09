/*global __dirname:false exports:false process:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:20 maxlen:150 devel:true newcap:false*/ 

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

function parseExpiresIn(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    var number = str.slice(0, str.length-1);
    var periond = str.slice(str.length-1);
    var multiplier = { m:60, h: 60*60, d: 24*60*60, w: 7*24*60*60, y: 52*7*24*60*60};
    return multiplier[periond] * number;
}    

function calcCache(cache) {
    var expiresIn = parseExpiresIn(cache.expiresIn); //seconds
    var cacheControl = "max-age=" + expiresIn;
    if (cache['private'])
        cacheControl += ", private";
    else if (cache['public'] === undefined || cache['public'])
        cacheControl += ", public";
    cache['Cache-Control'] = cacheControl;
    cache.expiresIn = (expiresIn ? expiresIn : -1000000000) * 1000;
}

function listen(port, argv) {
    var sessions;
    
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
        //prerender: argv.prerender,
        // seoServer: argv.seoServer,
        // phantomPath: argv.phantomPath,
        // bot: argv.bot, 
        // hashbang: argv.hashbang, 
        // fragment: argv.fragment, 
        
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
    
    //setting default values:
    var host = argv.a || argv.address || process.env.HTTPSERVER_IPADDR || '0.0.0.0';
    
    if (argv.sessions) {
        sessions = {
            store: argv.sessions.store,
            storeOpts: argv.sessions.storeOpts,
            opts: argv.sessions
        };
    }
    
    if (typeof argv.dir === 'undefined') argv.dir = true;
    if (typeof argv.bust === 'undefined') argv.bust = true;
    
    // if (typeof argv.fragment === 'undefined') argv.fragment = true;
    // if (typeof argv.bot === 'undefined') argv.bot = true;
    // if (typeof argv.hashbang === 'undefined') argv.hashbang = true;
    
    if (argv.index && typeof argv.index === 'boolean') argv.index = 'index.html';
    if (argv.spa && typeof argv.spa === 'boolean') argv.spa = 'index.html';
    
    argv.zip = (typeof argv.zip === 'boolean' && argv.zip) ?
        /text|javascript|json/ : argv.zip;
    
    if (argv.zip && !argv.zip.test)
        throw new Error('option zip must be a regular expression');

    if (!argv.recast) {
        argv.recast = {
            transpile: argv.transpile ?
                ['jade', 'less', 'stylus', 'sweetjs', 'typescript', 'coffeescript',
                 'markdown', 'regenerators'] : [], 
            minify: argv.minify ? ['js', 'css', 'html'] : [],
            zip: argv.zip,
            verbose: true
        };
    }
    
    if (argv.cache) {
        //all stamped files are sent with default 1 year maxage cachecontrol
        argv.cacheStamped.expiresIn = argv.cacheStamped.expiresIn || '1y'; 
        calcCache(argv.cacheStamped);
        argv.cachePrerender.expiresIn = argv.cachePrerender.expiresIn || '1d'; 
        calcCache(argv.cachePrerender);
        argv.cacheDefault.expiresIn = argv.cacheDefault.expiresIn || '0m'; 
        calcCache(argv.cacheDefault);
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
    
    var log = (argv.q || argv.quiet) ? function () {} : console.log;
    
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
        
    });
    
}

exports.go = function(argv) {
    if (process.platform !== 'win32') {
        // Signal handlers don't work on Windows.
        process.on('SIGINT', function () {
            console.log('http-server stopped.'.red);
            process.exit();
        });
    }
    
    var port = argv.p || argv.port || Number(process.env.HTTPSERVER_PORT);
    if (!port) {
        portfinder.basePort = 8080;
        portfinder.getPort(function (err, port) {
            if (err) throw err;
            listen(port, argv);
        });
    } else {
        listen(port, argv);
    }
};
