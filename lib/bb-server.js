/*global __dirname:false exports:false process:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:20 maxlen:150 devel:true newcap:false*/ 

// var sys = require('sys');
var
    colors = require('colors'),
    httpServer = require('./createServer.js'),
    portfinder = require('portfinder'),
    fs = require('fs-extra'),
    Path = require('path'),
    mime = require('mime'),
    extend = require('extend')
    // forever = require('forever-monitor');
;


var scripts = {
    // url: "websocket_url ='ws://localhost:9001';",
    reload: function () {
        var probe;
        function getConnection() {
            var connection = new WebSocket(websocket_url, []);
    
            // When the connection is open, send some data to the server
            connection.onopen = function () {
                connection.send('browser ' + navigator.userAgent); // Send the message 'Ping' to the server
                clearTimeout(probe);
                probe = false;
            };

            // Log errors
            connection.onerror = function (error) {
                // console.log('WebSocket Error ' , error);
            };

            // Log messages from the server
            connection.onmessage = function (e) {
                clearTimeout(probe);
                console.log('Server: ' , e.data);
                if (e.data === "reload") {
                    location.reload();
                }
            };
            connection.onclose = function (e) {
                if (!probe)
                    probe = setInterval(function() {
                        console.log('Trying to connect to bb-server');
                        connection = getConnection();
                    },1000);
            };
        }
        getConnection();
    },
    test: function() { console.log('Injected script loaded')}
}; 


    
mime.define({'text/javascript': ['coffee']});
mime.define({'text/event-stream': ['es']});
//TODO add defines for the other mimetypes:
// ['jade', 'less', 'stylus', 'sweetjs', 'typescript', 'coffeescript',
//  'markdown', 'regenerators'] : [], 

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
    var expiresIn = parseExpiresIn(cacheSettings.expiresIn); //seconds
    var cacheControl = "max-age=" + expiresIn;
    if (cacheSettings['private'])
        cacheControl += ", private";
    else if (cacheSettings['public'] === undefined || cacheSettings['public'])
        cacheControl += ", public";
    return {
        expiresInString: cacheSettings.expiresIn,
        cacheControl : cacheControl,
        expiresIn : (expiresIn ? expiresIn : -1000000000) * 1000
    };
}

function parseProps(settings) {
    var result = {};
    Object.keys(settings).forEach(function(s) {
        var value = settings[s];
        // console.log(s, value);
        var keys = s.split(' ')
            .filter(function(t) { return t; })
            .forEach(function(t) { result[t] = calcCache(value); }); 
    });
    return result;
}

function listen(port, argv) {
    var options = {
        root: (argv._ && argv._[0]) || argv.root || './',
        port:port,
        dir: argv.d || argv.dir, //send directory listing page, true, array or regexp
        index: argv.i || argv.index, //autoindex true or string, default index.html
        cache: argv.c || argv.cache, //true or false
        stamp: argv.stamp,
        spa: argv.s || argv.spa, //single page app. Boolean or string, if true defaults to 'index.html'
        favicon:  argv.f || argv.favicon, //true or { path:'a/b'[, maxAge: '1h'] }
        wsHandlers: argv.wsHandlers || [],
        https: argv.https,
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
        inject : argv.inject,
        persona : argv.persona,
        api: argv.api,
        
	quiet: argv.q || argv.quiet,
        version: version,
        reload: argv.reload,
        host: argv.host || 'localhost',
        verbose: argv.verbose
    };
    if (options.persona && ! argv.sessions) {
        argv.sessions = {
            expires: 10,
            store: 'memory'
        };
    }
    
    if (argv.sessions) {
        options.sessions = {
            store: argv.sessions.store,
            storeOpts: argv.sessions.storeOpts,
            opts: argv.sessions
        };
    }

    
    if (options.sessions && options.sessions.opts.expires) options.sessions.opts.expires *= 60;
    // console.log(options.sessions);
    
    //setting default values:
    var host = argv.a || argv.address || process.env.HTTPSERVER_IPADDR || '0.0.0.0';
    
    
    if (typeof options.dir === 'undefined') options.dir = true;
    else if (typeof options.dir === 'string') options.dir = [options.dir];
    if (typeof options.stamp === 'undefined') options.stamp = false;
    if (options.stamp) {
        if (typeof options.stamp === 'boolean') {
            options.stamp = {
                prefix: '', length: 10
            };
        }
    }
    
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
                 'markdown', 'regenerators', 'denodify', 'inject'] : [], 
            minify: options.minify ? [ 'js', 'css' ] : [],
            zip: options.zip
        };
    }
    else {
        options.zip = options.recast.zip; 
        options.minify = options.recast.minify;
        options.transpile = options.recast.transpile;
    }
    options.recast.scripts = options.recast.scripts || { test: scripts.test };
    
    
    if (options.reload) {
        if (typeof options.reload === 'boolean')
            options.reload = 'index.html';
        if (options.wsHandlers.indexOf('reload') === -1)
            options.wsHandlers.push('reload');
        if (options.recast.transpile.indexOf('inject') === -1)
            options.recast.transpile.push('inject');
        options.recast.inject = options.recast.inject || {};    
        options.recast.inject[options.reload] =
            options.recast.inject[options.reload] || [];
        if (options.recast.inject[options.reload].indexOf('reload') === -1)
            options.recast.inject[options.reload].push('url');
            options.recast.inject[options.reload].push('reload');
        options.recast.scripts.reload = scripts.reload;
        options.recast.scripts.url = "websocket_url = 'ws://" + options.host + ":" + port + "';";
    }
    
    options.wsHandlers = options.wsHandlers.map(function(h) {
        if (typeof h === 'string') return require('./' + h);
        else return h;
    });
    
    
    if (options.cache) {
        var settings = typeof options.cache === 'boolean' ? {} : options.cache;
        
        options.cacheDir = settings.cacheDir || Path.join(process.cwd(), "./cache");
        
        options.cache = {
            //all stamped files are sent with default 1 year maxage cachecontrol
            stamped : calcCache(settings.stamped || { expiresIn: '1y' }),
            //all prerendered data s sent with default 1 day maxage cachecontrol
            prerender : calcCache(settings.prerender || { expiresIn: '1d' }),
            //all other files are sent with max-age=0 cachecontrol
            other :  calcCache(settings.other || '0m')
        };
        delete settings.stamped, delete settings.prerender,
        delete settings.other, delete settings.cacheDir;
        options.cache = extend(options.cache, parseProps(settings));
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
    
    if (options.https) {
        if (typeof options.https === 'boolean') {
            options.https = {
                privatekey: 'certs/privatekey.pem',
                certificate: 'certs/certificate.pem'
            };
        }
    }
    
    var out = options.out =  options.quiet ?  function () {}: function() {
        console.log.apply(console, arguments);
    };
    
    var server = httpServer.createServer(options)
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
                // out(' stamped', options.cache.stamped.expiresInString);
                // out(' prerendered', options.cache.prerender.expiresInString);
                // out(' other', options.cache.other.expiresInString);
                Object.keys(options.cache).forEach(function(c) {
                    out(' ', c, options.cache[c].expiresInString);
                });
                var cacheDir = options.cacheDir.indexOf(process.cwd()) === 0 ?
                    '.' + options.cacheDir.slice(process.cwd().length) : options.cacheDir;
                out('Cache dir: '.grey + cacheDir);
                
            }
            out('Recast:'.grey);
            out('  Transpile: '.grey + (options.transpile ? String(options.transpile.slice(0, options.transpile.length-1)).green : 'no'.red));
            out('  Minify: '.grey + (options.minify ? String(options.minify).green : 'no'.red));
            out('  Compress: '.grey + (options.zip ? String(options.zip).green : 'no'.red));
            out('  Inject: '.grey, options.recast.inject);
            out('Strip stamp '.grey + getOptionString(options.stamp));
            out('Sessions: '.grey + getOptionString(options.sessions));//
            if (options.sessions) {out(options.sessions);}
            out('Persona: '.grey + getOptionString(options.persona));//
            if (options.persona) {out(options.persona);}
            out('Spa '.grey + getOptionString(options.spa));
            out('Prerender '.grey + (
                typeof options.prerender === 'string' ? options.prerender.green :getOptionString(options.prerender)
            ));
            out('Https server: '.grey + getOptionString(options.https));
            if (options.https) {out(options.https);}
            out('Websocket server '.grey + getOptionString(options.wsHandlers.length));//
            if (options.wsHandlers.length)
                out('Handlers: ', options.wsHandlers.map(function(h) { return h.id || h }));//
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
    
    if (options.wsHandlers.length) {
        // console.log('wsServer');
        require('./webSocketServer.js').init(server, { verbose: options.verbose , handlers: options.wsHandlers}); 
    }
    
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
