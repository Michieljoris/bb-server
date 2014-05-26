/*global __dirname:false require:false*/
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:7 maxlen:150 devel:true newcap:false*/ 
var server = require('bb-server'),

    sendMail = require("./firstDoorSendMail.js")
    // ,testSendMail = require("./testSendMail.js")
    // ,sync = require("./sync.js")
    // ,dropbox_authorize = require("./dropbox_authorize.js")
    // ,dropbox_connect = require("./dropbox_connect.js")
    ,editor_save = require('./editor_save.js')
    // testMail = require("./testSendMail"),
    // testGet = require("./testGet")
;

 
var develop_mode = process.env.DEVELOP; 
console.log('develop mode', develop_mode);
// develop_mode = false;
//TODO: limit sending of files to certain mimetypes and/or extensions
//TODO: option to not send mimeless files found in allowable directories.
//TODO: send certain files directly, bypassing cache with certain
//cache control headings, so we can send big files etc
var options = { 
    //Serve all files relative to this root. Defaults to './'.
    root: './www'
    //if not assigned defaults to 8080. If that port's not available
    //the server will try 8081 and so on.
    ,port: 9001
    
    // Assign true to allow listing of directories when the path in
    // the url matches a path on the server relative to the
    // root. Assign an array of paths to limit listing to the listed
    // paths (relative to the root) eg. ['/lib']. Defaults to true. 
    ,dir: false
    
    // If index.html is found in an allowable directory it is sent
    // over instead of the directory listing. Assign a string to look
    // for and send a different default file. Defaults to false and to
    // 'index.html' if assigned true.
    ,index: "index.html"
    
    //if a request for /favicon comes in send the favicon found in the
    //path specified (relative to where this script is executed from), 
    //with a cache control setting of maxAge (in [m]inutes, [h]ours,
    //[d]ays, [w]eeks or [y]ears). Defaults to the favicon.ico bundled
    //with the server with a max age of 1 hour.
    ,favicon: {
        path:  './www/favicon.ico',
        maxAge: '1h' 
    }
    
    // see lib/logger.js for more info. Basically logging all requests to a file.
    // ,log: true
    ,log: {
        'format': 'dev',  //Format string: default, short, tiny, dev, or custom token string
        // 'stream': 'mylog.txt',  //Output stream, defaults to _stdout_
        // 'buffer': '', //Buffer duration, defaults to 1000ms when _true_
        'immediate': ''  //Write log line on request instead of response (false for response times)
    }
    //silence (debug) output on the commandline
    ,"quiet": false
    
    //control caching of resources in terms of what cache-control headers are
    //sent out with them and how long resources are kept in the server cache. If
    //true defaults to ((m)inutes, (h)ours, (d)ays, (w)weeks, (y)ears):
    // ,cache: false
    ,cache: develop_mode ? false : {
        stamped: { expiresIn: '1y' },
        prerender: { expiresIn: '1d'},
        //static resources, should be served from cookieless domain:
        // "css js jpg jpeg gif ico png bmp pict csv doc pdf pls ppt tif tiff eps swf": { expiresIn: "1d" },
        // "midi mid ttf eot woff svg svgz webp docx xlsx xls pptx ps" : { expiresIn: "1d" },
        //but possibly not when going through cloudflare:
        // https://support.cloudflare.com/hc/en-us/articles/200169816-Can-I-serve-a-cookieless-domain-or-subdomain-through-CloudFlare-
        "pdf doc docx": { expiresIn: "2h" },
        other: { expiresIn: '0m'}
        // cacheDir: "./cache"
    }
    
    //if set to true to the server will try to remove a stamp from request paths
    //before processing them. This also enables cache control for the response
    //to these requests. See previous options.
    // Defaults to false.  ,
    // ,stamp: false
    ,stamp: {
        prefix: '__' // or for example: 'stamp-'
        ,length: 10  //32 for md5 and 40 for sha1, but set to 10 by default
    // set length to 13 if you use mtime create the stamp for a resource
    // if 10 is not long enough, in other words, if a resource is not
    // updated and stays cached, up the length property by 1
    }
    
    //files can be transformed (recast) before being sent to the
    // client. If the cache is turned on this will only happen the
    // first time the file is requested. After that the recast file
    // will be sent from the cache. Only when the mtime of the
    // original file is more recent that the date of the cached
    // version the recasting is done again. 
    // recaster is a separate module and can easily be expanded to
    // include more transpilers, minifiers and zippers.
    
    //toggle the following three options to true to enable recasting,
    //all three default to false:
    
    // ,transpile: false 
    // ,minify: true //html, js and css
    // ,zip: true //compress when enconding is accepted by client
    //or for more finegrained control define the recast option instead:
    ,recast: {
        // transpile: ['jade', 'less', 'stylus', 'sweetjs',
        //             // 'typescript', 'coffeescript',
        //              'inject',
        //              'denodify',
        //             'markdown' ], 
        transpile: []  //TODO add all current supported file types
        
        ,minify: !develop_mode ? ['js', 'css' ] : [] //js, css, html
        ,zip:!develop_mode ? /text|javascript|json/ : ''//regex on the mimetype
        ,verbose: develop_mode
        
        // ,inject: {
        //     'index.html': ['test']
        // }
    }
    
    //if spa is true all requests that don't seem to be requests for a file with
    //a mimetype are redirected to a request for just one file. By default this
    //is index.html, but a different filename can get assigned to spa. Use a
    //fragment meta tag in your spa file, or use hashbang in your urls to have
    //google crawl _escaped_fragment_ urls.
    ,spa: true
    
    //the server can prerender requests for _escaped_fragment_ urls. For any
    // prerendering to occur the following option needs to be true. Defaults to
    // false. If set to true, better turn on caching as well, otherwise it will
    // try to prerender the page for every _escaped_fragment_ request, Also
    // either enable phantomPath or seoServer
    ,prerender:true 
    
    //specify a path for phantomjs or set it to truthy. In the last case the
    //server will use the phantomjs module's path or as a last resort
    //'phantomjs'. If falsy, or the phantomjs executable is not found, the
    //seoServer will be called upon.
    ,phantomPath: true
    //if phantomPath is not valid the server will call on the external
    //seoServer. Assign an url. Defaults to false. 
    ,seoServer: false
    
    //forward requests with a certain prefix in the path to another server
    // "forward": [
    //     { "prefix": "local",
    //       "target": "http://localhost:5984" },
    //     { "prefix": "iris",
    //       "target": "https://somedb.iriscouch.com"}
    // ]
    
    //If method and path match the functin will be called with [req, res].
    ,postHandlers: {
        "/__api/save" : editor_save,
        "/contactus_form" : sendMail
        // ,"/contactus_form" : testSendMail
        }
    ,getHandlers: {
        // "/sync": sync,
        // "/dropbox_authorize": dropbox_authorize,
        // "/dropbox_connect": dropbox_connect
    }
    
    
    //start a websocket server and register handlers
    //One built-in handler is reload, include it as a string, otherwise list a home-made module
    //For an example of a handler see lib/reload.js
    // ,wsHandlers:  [ 'reload' ]
    
    ,verbose: true
    //Convenience setting. When true inject will be added to the transpilers,
    //set to inject the reload script into index.html and the reload handler
    //added to wsHandlers with the result that the server will respond to
    //"reload" messages and send a message to connected browsers to reload
    ,reload: develop_mode ? true : false
    //host for the websocket to connect to from the client
    // ,host: 'localhost'
    
    //start a https server
    // ,https: {
    //     privatekey: 'certs/yourdomain.com.key',
    //     certificate: 'certs/yourdomain.com.crt'
    // }
    
    //attaches session data to requests
    ,sessions: {
        expires:30 
        
        // ,store: 'mysql'
        ,store: 'memory'
        // ,storeOpts: {
        //     //options for mysql, memory doesn't need any
        // }
    }
    //use persona to authenticate
    ,persona: {
        authorized: ['mail@axion5.net', 'andrea@firstdoor.com.au']
        ,verbose: true 
        ,audience: develop_mode ? "localhost:9001" : "www.firstdoor.com.au" 
    } 
    
    //server api path:
    ,api: '__api'
    //enable server api, not implemented yet
    ,sitemap: true
    ,html_builder: true
    ,clear_cache: true
    ,files: true
    ,stats: true
};

server.go(options);
