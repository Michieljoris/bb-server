/*global __dirname:false exports:false process:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:20 maxlen:150 devel:true newcap:false*/ 

// var sys = require('sys');
var
    colors = require('colors'),
    httpServer = require('./createServer.js'),
    portfinder = require('portfinder'),
    fs = require('fs'),
    Path = require('path'),
    mime = require('mime')
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

function calcCache(cacheSettings) {
    cacheSettings.expiresInString = cacheSettings.expiresIn;
    var expiresIn = parseExpiresIn(cacheSettings.expiresIn); //seconds
    var cacheControl = "max-age=" + expiresIn;
    if (cacheSettings['private'])
        cacheControl += ", private";
    else if (cacheSettings['public'] === undefined || cacheSettings['public'])
        cacheControl += ", public";
    cacheSettings.cacheControl = cacheControl;
    cacheSettings.expiresIn = (expiresIn ? expiresIn : -1000000000) * 1000;
}

function listen(port, argv) {
    var sessions;
    
    if (argv.sessions) {
        sessions = {
            store: argv.sessions.store,
            storeOpts: argv.sessions.storeOpts,
            opts: argv.sessions
        };
    }
    
    var options = {
        root: (argv._ && argv._[0]) || argv.root || './',
        port:port,
        dir: argv.d || argv.dir, //send directory listing page, true, array or regexp
        index: argv.i || argv.index, //autoindex true or string, default index.html
        cache: argv.c || argv.cache, //true or false
        bust: argv.b || argv.bust,
        spa: argv.s || argv.spa, //single page app. Boolean or string, if true defaults to 'index.html'
        favicon:  argv.f || argv.favicon, //true or { path:'a/b'[, maxAge: '1h'] }
        wsServer: argv.w || argv.websocket,
        
        //recast:
        zip: argv.z || argv.zip, 
        minify: argv.m || argv.minify,
        transpile: argv.t || argv.transpile,
        
        //crawlers:
        prerender: argv.prerender,
        seoServer: argv.seoServer,
        phantomPath: argv.phantomPath,

        forward: argv.forward,
        target: argv.target,
        prefix: argv.prefix,
        
        log: argv.l || argv.log,
        
        //config file only
        headers: argv.headers || {},
        recast: argv.recast,
        
        postHandlers: argv.postHandlers || {},
        getHandlers: argv.getHandlers || {},
        
	quiet: argv.q || argv.quiet,
        version: version
    };
    
    //setting default values:
    var host = argv.a || argv.address || process.env.HTTPSERVER_IPADDR || '0.0.0.0';
    
    
    if (typeof options.dir === 'undefined') options.dir = true;
    else if (typeof options.dir === 'string') options.dir = [options.dir];
    if (typeof options.bust === 'undefined') options.bust = true;
    
    // if (typeof options.fragment === 'undefined') options.fragment = true;
    // if (typeof options.bot === 'undefined') options.bot = true;
    // if (typeof options.hashbang === 'undefined') options.hashbang = true;
    
    if (options.index && typeof options.index === 'boolean') options.index = 'index.html';
    if (options.spa && typeof options.spa === 'boolean') options.spa = 'index.html';
    if (options.spa) options.spaMimeType = mime.lookup(options.spa);
    
    options.zip = (typeof options.zip === 'boolean' && options.zip) ?
        /text|javascript|json/ : options.zip;
    
    if (options.zip && !options.zip.test)
        throw new Error('option zip must be a regular expression');

    if (!options.recast) {
        options.recast = {
            transpile: options.transpile ?
                ['jade', 'less', 'stylus', 'sweetjs', 'typescript', 'coffeescript',
                 'markdown', 'regenerators'] : [], 
            minify: options.minify ? [ 'js', 'css' ] : [],
            zip: options.zip
        };
    }
    else {
       options.zip = options.recast.zip; 
        options.minify = options.recast.minify;
        options.transpile = options.recast.transpile;
    }
    if (options.cache) {
        options.cache = typeof options.cache === 'boolean' ? {} : options.cache;
        //all stamped files are sent with default 1 year maxage cachecontrol
        options.cache.stamped = options.cache.stamped || { expiresIn: '1y' };
        calcCache(options.cache.stamped);
        //all prerendered data s sent with default 1 day maxage cachecontrol
        options.cache.prerender = options.cache.prerender || { expiresIn: '1d' };
        calcCache(options.cache.prerender);
        //all other files are sent with max-age=0 cachecontrol
        options.cache.other = { expiresIn: options.cache.other || '0m' };
        calcCache(options.cache.other);
    }
    options.favicon = options.favicon || {
        path: __dirname + "/../favicon.ico",
        maxAge: '1h'
    };
    var faviconPath = options.favicon.path;
    var buf = fs.readFileSync(Path.resolve(faviconPath));
    if (!buf) {
        out("Can't find favicon.ico");
        delete options.favicon;
    } else
        options.favicon.icon = {
            headers: {
                'Content-Type': 'image/x-icon'
                , 'Content-Length': buf.length
                , 'Cache-Control': 'public, max-age=' +
                    parseExpiresIn(options.favicon.maxAge) 
            },
            body: buf
        };
    
    if (options.forward) {
        options.forward = [ {
            prefix: options.prefix || 'db',
            target: options.target || 'http://localhost:5984'
        } ];
    } 
    
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
    options.root = Path.resolve(options.root);
    
    if (options.wsServer) {
        require('./webSocketServer.js').wsServer.init(server); 
    }
    
    
    if (options.log) {
        switch (Typeof(options.log))
        {
          case 'Boolean':
            options.log = {}; //uses defaults (stdout, default format)
            break;
          case 'String':  //path
            options.log = {
                stream: options.log
            };
            break;
          case 'Object': 
            break;
        default: 
            throw new Error('option log must be a boolean, string or object');
        }
        if (typeof options.log.stream === 'string')
            options.log.stream = fs.createWriteStream(options.log.stream);
    }
    
    
    var out = options.out =  options.quiet ?  function () {}: function() {
        console.log.apply(console, arguments);
    };
    
    httpServer.createServer(options)
        .listen(port, host, function() {
            out('Version ' + options.version);
            out('Starting up http-server, serving '.yellow +
                this.root.cyan +
                ' on: '.yellow +
                (host + ':' + port).cyan);
            out('Listing dir contents : '.grey + getOptionString(options.dir));
            out('Auto show '.grey +  (typeof options.index === 'string' ? options.index : 'index.html') + ' ' +  
                getOptionString(options.index));
            out('Favicon: '.grey + getOptionString(options.favicon));
            out('Log '.grey + (typeof options.log === 'string' ?
                               options.log.green : getOptionString(options.log)));
            
            out('Cache: '.grey + getOptionString(options.cache));
            if (options.cache) {
                out(' stamped', options.cache.stamped.expiresInString);
                out(' prerendered', options.cache.prerender.expiresInString);
                out(' other', options.cache.other.expiresInString);
            }
        
            if (options.sessions) {out(options.sessions);}
            out('Transpile: '.grey + (options.compile ? String(options.transpile).green : 'no'.red));
            out('Prerender '.grey + (
                typeof options.prerender === 'string' ? options.prerender.green :getOptionString(options.prerender)
            ));
            out('Minify: '.grey + (options.minify ? String(options.minify).green : 'no'.red));
            out('Compress: '.grey + (options.zip ? String(options.zip).green : 'no'.red));
            out('Strip stamp '.grey + getOptionString(options.bust));
            out('Sessions: '.grey + getOptionString(options.sessions));//
            out('Spa '.grey + getOptionString(options.spa));
            out('Https server: '.grey + getOptionString(options.https));
            out('Websocket server '.grey + getOptionString(options.wsServer));//
            out('Forward: '.grey + getOptionString(options.forward));//
            if (options.forward) console.log(options.forward);
            if (Object.keys(options.getHandlers).length) {
                out('getHandlers:'.grey, Object.keys(options.getHandlers));
            }
            if (Object.keys(options.postHandlers).length) {
                out('postHandlers:'.grey, Object.keys(options.postHandlers));
            }
        
        
            out('Hit CTRL-C to stop the server'.green);
        
        });
    
}

exports.go = function(argv) {
    if (process.platform !== 'win32') {
        // Signal handlers don't work on Windows.
        process.on('SIGINT', function () {
            console.log('http-server stopped on SIGINT.'.red);
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

//TEST:
// exports.go({});
