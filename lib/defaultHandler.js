/*global process:false unescape:false module:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:9 maxlen:150 devel:true newcap:false*/

/**
 * Handles static content.
 */

var
// sys = require('sys'),
    fs = require('fs'),
    mime = require("mime"),
    Path = require('path'),
    Url = require('url'),
    recaster = require('recaster'),
    wash = require('url_washer'),
    cache = require('./cache'),
    sendMisc = require('./sendMisc'),
    sendDir = require('./sendDir'),
    extend = require('extend'),
    VOW = require('dougs_vow')

;
mime.default_type = 'unknown';

var send, options, pathMap = {}, debug;


var dev = process.env.BB_SERVER_DEV;
// var dev = false;


//Prepare standard, cache, gzip and custom headers
function createHeaders(req) {
    //default headers ------------------------------------
    var mimeType =  req.$mimeType || 'text/plain';
    var headers = { 'Content-Type': mimeType
                    ,Server: 'bb-server/' + options.version };

    //cache headers---------------------------------
    //if a file request came in with a time stamp send the file
    //out with the stamp cache headers, (high expiresIn probably)
    var cacheSettings = (function() {
            if (options.cache) {
                if (req.$prerender) return options.cachePrerender;
                else if (req.$stamped) return options.cacheStamped;
                else return options.cacheDefault;
            }
        else return {
            cacheControl: "nostore, nocache, max-age=0, must-revalidate",
            expiresIn: '0m' };
    })();

    headers['Cache-Control'] = cacheSettings.cacheControl;
    if (cacheSettings.expiresIn)
        headers.Expires = new Date(Date.now() + cache.expiresIn).toString();
    headers['Last-Modified'] = req.$GMTdate.toString();

    //gzip headers -------------------------------------
    var ua = req.headers['user-agent'] || '',
    accept = req.headers['accept-encoding'] || '';

    // Note: this is not a conformant accept-encoding parser.
    // See http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
    var encoding;
    if ('*' === accept.trim()) encoding = 'gzip';
    else {
        for (var i = 0, len = recaster.zipperMethods.length; i < len; ++i)
            if (~accept.indexOf(recaster.zipperMethods[i])) {
                encoding = recaster.zipperMethods[i];
                break;  }
    }

    if (options.gzip && encoding && options.gzip.test(mimeType) &&
        !(~ua.indexOf('MSIE 6') && !~ua.indexOf('SV1')) &&
        req.method !== 'HEAD')
    {  headers['Content-Encoding']= encoding;
       headers.Vary = 'Accept-Encoding';  }

    //add any custom headers ------------------------------------------
    Object.keys(options.headers).forEach(function(k){
        headers[k] = options.headers[k];
    });

    return headers;
}

//TODO use date number for stamp iso written out date
function stripStamp(path) {
    var oPath = path;
    //strip the signature of the filename if present:
    //as redundant as I can make it and the shortest route for the
    // most common case (repeat request of valid path)
    // as long as no dir or file name ends with _stamp_ this will
    // work
    function validSignature(str) {
        //you could check whether the date is parseable better, because
        //Date.parse is -very- forgiving, but as long as no file starts
        //with '_stamp_' there will be no false positives.
        if (str.length < 49 || str.slice(0, 8) !== '_stamp_' ||
            typeof Date.parse(str.slice(8, 47)) !== 'number') return false;
        return true;
    }
    if (options.bust)  {
        path = pathMap[oPath];
        if (!path) {
            var baseName = Path.basename(path);
            var dot = baseName.lastInDexof('.');
            if (validSignature(baseName.slice(dot))) {
                path = baseName.slice(0, dot);
            }
            else path = oPath;
            pathMap[oPath] = path;
        }
    }
    return path;
}

function listableDir(path) {
    var dirs = options.dir;
    if (!dirs) return false;
    if (typeof dirs === 'boolean') return true;
    return dirs.some(function(d) {
        return path.indexOf(d) === 0;
    });
}
//finds out if the request is for a fragment or from a bot and for a
//hashbang url, (if options allow for this), modifies req.url if
//necessary.
function isPrerender(req) {
    // Mapping from _escaped_fragment_ format to #! format

    // Any URL whose query parameters contain the special token
    // _escaped_fragment_ as the last query parameter is considered an
    // _escaped_fragment_ URL. Further, there must only be one
    // _escaped_fragment_ in the URL, and it must be the last query
    // parameter. The corresponding #! URL can be derived with the
    // following steps: the

    // 1 Remove from the URL all tokens beginning with _escaped_fragment_=
    // (Note especially that the = must be removed as well).

    // 2 Remove from the URL the trailing ? or & (depending on whether the
    // URL had query parameters other than _escaped_fragment_).

    // 3 Add to the URL the tokens #!.

    // 4 Add to the URL all tokens after _escaped_fragment_= after
    // unescaping them.

    // Note: As is explained below, there is a special syntax for pages
    // without hash fragments, but that still contain dynamic Ajax
    // content. For those pages, to map from the _escaped_fragment_ URL to
    // the original URL, omit steps 3 and 4 above.
    function testUasForBot(req) {
        //Elaborate version use:
        // https://npmjs.org/package/uas-parser
        //But for now:
        var bots=new RegExp("robot|spider|crawler|curl|slurp|bot|baiduspider|80legs|" +
                            "ia_archiver|voyager|curl|wget|yahoo! slurp|mediapartners-google" ,"i");
        var ua = req.headers['user-agent'] || '';
            return bots.test(ua);
    }
    if (options.prerender) {
        req.$fromBot = options.bot ? testUasForBot(req) : false;
        var url = req.url;
        if (options.fragment &&  url.query &&
            url.query._escaped_fragment_ !== undefined) {
            var newUrl = {
                protocol:  url.protocol,
                auth:  url.auth,
                pathname:  url.pathname,
                query:  url.query
            };
            var fragment = unescape( url.query._escaped_fragment_);
            delete newUrl.query._escaped_fragment_;
            newUrl.hash =(fragment.length ? '!' + fragment: '') + ( url.hash || '');
            req.url = newUrl;
            return  url.pathname + (fragment.length ? '#!' + fragment: '');
        }
        else if (options.hashbang && req.$fromBot && req.url.hash &&
                 req.url.hash.startsWith('#!')) {
            //key = pathname + hashbang without final hash
            return req.url.pathname + '#!' + Url.parse(req.url.hash.slice(2)).pathname;
        }
    }
    return false;
}



function bind(f, req, res) {
    return function() {
        var args = Array.prototype.slice.call(arguments);
        args = [ req, res ].concat(args);
        f.apply(this, args);
    };
}


function recast(req, res, cb) {
    //stamped, mimeType
    var response = {};
    response.headers = createHeaders(req);
    //prepend root, normalize and remove trailing slashes, to
    //produce a file path:
    recaster.recast({ srcFile: path,
                      zip: response.headers['Content-Encoding'],
                      type: ''})
        .when(
            function(data) {
                cb({
                    
                });
                
            }
            ,function(err) {}
        );
    cb(response);
    
}

function prerender(req, res, cb) {
    wash(req.url, { phantomPath: options.phantomPath,
                seoServer: options.seoServer }).when(
                    function(html) {
                        recast
                        cb({ headers: 'be', body: html });
                    },
                    function(err) {
                    });
   
}

function sendValue(req, res, value) {
    if (!dev && Date.parse(req.headers["if-modified-since"]) < value.cached)  {
        res.writeHead(value.status, value.headers);
        res.end(value.body);
    }
    else {
        res.writeHead(304, {});
        res.end();
    }
}

function getKey(req, res) {
    var vow = VOW.make(); 
    var prerenderKey = isPrerender(req);
    if (prerenderKey) {
        vow.keep({ key: prerenderKey, fetch: prerender });
    }
    else {
        var path = stripStamp(req.$path);
        req.$stamped = path !== req.$path;
        var mimeType = mime.lookup(Path.extname(path));
        req.$mimeType = mimeType;
        if (mimeType) {
            vow.keep({ key: path, fetch: recast });
        }
        else if (options.spa) {
            if (req.$fromBot) {
                vow.keep({ key: path, fetch: prerender });
            }
            else {
                vow.keep({ key: options.spa, fetch: recast });
            }
        }
        //no spa:;
        else if (listableDir(path)) {
            fs.stat(path, function(err, stat) {
                if (err) {
                    delete pathMap[path];
                    sendMisc.missing(req, res, path);
                    vow.breek();
                }
                else {
                    if (stat.isDirectory()) {
                        send.dir(req, res, path, function(key) {
                            //key is autoindex
                            vow.keep({ key: key, fetch: recast });
                        });
                    }
                             
   else {
                        vow.keep({ key: path, fetch: recast });
                    }
                }
            });
        }
        else {
            //send 404
            sendMisc.missing(req, res, path);
            vow.breek();
        }

    }
    return vow.promise;
}

function handleRequest(req, res) {
    //strip any stamps, and set req.$stamped
    
    var path = Path.join(options.root, req.url.pathname);
    if (!path.startsWith(options.root))
        path = options.root;
    req.$path = path;
    getKey(req, res).when(
        function(key) {
            cache(key.key, bind(key.fetch, req, res), bind(sendValue, req, res));
        }
        ,function() {
            //request has been dealt with already.
        }
    );
}


module.exports.get = function(someOptions) {
    options = someOptions;
    debug = options.debug;
    recaster.init(options.recast);
    sendMisc.init(options);
    sendDir.init(options);
    send = extend({}, sendMisc, sendDir);
    return handleRequest;
};



//TEST:
// options = {};
// prerenderOptions = {
//     seoServer : "someseo/server"
// };
// options.prerender = true;
// var Url = require('url');
// // var url = "http://user:pass@host.com:8080/p/a/t/h?query=string&abc=123#!/some/other/path#hash";
// // var url = "http://user:pass@host.com:8080/p/a/t/h?query=string&abc=123&_escaped_fragment_=/some/other/path#hash";
// var url = "http://user:pass@host.com:8080/p/a/t/h?query=string&abc=123&_escaped_fragment_=#myhash";
// var parsed = Url.parse(url, true);
// var newurl = isRequestFromBot(parsed);
// console.log(newurl);
// console.log(parsed);
// console.log(typeof parsed.query);
// console.log(parsed.query);
// { protocol: 'http:',
//   slashes: true,
//   auth: 'user:pass',
//   host: 'host.com:8080',
//   port: '8080',
//   hostname: 'host.com',
//   hash: '#!/some/other/path#hash',
//   search: '?query=string',
//   query: 'query=string',
//   pathname: '/p/a/t/h',
//   path: '/p/a/t/h?query=string',
//   href: 'http://user:pass@host.com:8080/p/a/t/h?query=string#!/some/other/path#hash' }



// // mime.default_type = 'bla';
// var p = '/a/b/c/jss';
// var path = Path.extname(p);
// console.log('ext:', path);
// var m = mime.lookup(path);

// console.log(m);
