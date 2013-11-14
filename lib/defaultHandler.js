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
mime.default_type = false;

var send, options, pathMap = {}, debug;

var dev = process.env.BB_SERVER_DEV;
// var dev = false;


//Prepare standard, cache, gzip and custom headers
function createHeaders(src) {
    //default headers ------------------------------------
    var mimeType =  src.mimeType || 'text/plain';
    var headers = { 'Content-Type': mimeType
                    ,Server: 'bb-server/' + options.version };
    
    if (src.encoding)
    {  headers['Content-Encoding']= src.encoding;
       headers.Vary = 'Accept-Encoding';  }

    //cache headers---------------------------------
    //if a file request came in with a time stamp send the file
    //out with the stamp cache headers, (high expiresIn probably)
    src.cacheSettings = (function() {
        if (options.cache) {
            if (src.prerender) return options.cache.prerender;
            else if (src.stamped) return options.cache.stamped;
            else return options.cache.other;
        }
        else return {
            cacheControl: "nostore, nocache, max-age=0, must-revalidate",
            expiresIn: 0 };
    })();
    headers['Cache-Control'] = src.cacheSettings.cacheControl;
    if (src.cacheSettings.expiresIn)
        headers.Expires = new Date(Date.now() + src.cacheSettings.expiresIn).toString();
    headers['Last-Modified'] = new Date().toString(); //src.GMTdate.toString();

    //add any custom headers ------------------------------------------
    Object.keys(options.headers).forEach(function(k){
        headers[k] = options.headers[k];
    });
    return headers;
}

function acceptEncoding(req) {
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
    if (options.zip && encoding && options.zip.test(req.$mimeType) &&
        !(~ua.indexOf('MSIE 6') && !~ua.indexOf('SV1')) &&
        req.method !== 'HEAD')
        return encoding;
    else return '';
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
            var dot = baseName.lastIndexOf('.');
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
    //from https://developers.google.com/webmasters/ajax-crawling/docs/specification:
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
    
    //path = pathname + hashbang without query or final hash
    if (options.prerender) {
        req.$fromBot = options.bot ? testUasForBot(req) : false;
        var url = req.url;
        if (options.fragment &&  url.query &&
            url.query._escaped_fragment_ !== undefined) {
            var fragment = unescape( url.query._escaped_fragment_);
            return  url.pathname + (fragment.length ? '#!' + fragment: '');
        }
        else if (options.hashbang && req.$fromBot && req.url.hash &&
                 req.url.hash.startsWith('#!')) {
            return req.url.pathname + '#!' + Url.parse(req.url.hash.slice(2)).pathname;
        }
    }
    return false;
}

function recast() {
    var vow = VOW.make();
    var src = this;
    //prepend root, normalize and remove trailing slashes, to
    //produce a file path:
    var srcPath = Path.join(options.root, src.path);
    recaster.recast({ srcPath: srcPath, encoding: src.encoding })
        .when(
            function(data) {
                var headers = createHeaders(src);
                vow.keep({ value: { status: 200,
                                    headers: headers,
                                    body: data.recast },
                           source: srcPath,
                           maxAge: src.cacheSettings.expiresIn
                         });
            }
            ,vow.breek
        );
    return vow.promise; 
}

function prerender() {
    var vow = VOW.make();
    var src = this;
    var href = options.seoServer ?
        Url.resolve(src.href, src.path) :
        Url.resolve('http://localhost:' + options.port, src.path);
    
    wash(href, { phantomPath: options.phantomPath,
                 seoServer: options.seoServer })
        .when(
            function(result) {
                src.mimeType = result.headers.contentType;
                src.status = result.status;
                return recaster.recast({ srcData: result.html, type: 'html',
                                         encoding: src.encoding //gzip or deflate
                                       });
            }) 
        .when(
            function(data) {
                var headers = createHeaders(src);
                vow.keep({ value: { status: src.status,
                                    headers: headers,
                                    body: data.recast },
                           maxAge: src.cacheSettings.expiresIn
                         });
            }
            ,vow.breek
        );
    return vow.promise; 
}

function source(req, res) {
    var vow = VOW.make(); 
    var prerenderKey = isPrerender(req);
    if (prerenderKey) {
        vow.keep({ href: req.url.href, path: prerenderKey, prerender: true, fetch: prerender });
    }
    else {
        var path = stripStamp(req.url.pathname);
        var stamped = path !== req.url.pathname;
        var mimeType = mime.lookup(Path.extname(path));
        if (mimeType)
            vow.keep({ path: path, mimeType: mimeType, stamped: stamped, fetch: recast });
        else if (options.spa) {
            if (req.$fromBot)
                vow.keep({ href: req.url.href, path: path, prerender: true, fetch: prerender });
            else vow.keep({ path: options.spa, mimeType: options.spaMimeType, fetch: recast });
        }
        //no spa:;
        else if (listableDir(path)) {
            var srcPath = Path.join(options.root, path);
            fs.stat(srcPath, function(err, stat) {
                if (err) {
                    delete pathMap[path];
                    //ERROR in retrieving path..
                    send.error(req, res, err);
                    vow.keep();
                }
                else {
                    if (stat.isDirectory()) { 
                        if (path[path.length-1] !== '/') {
                            send.redirect(req, res, path + '/' );
                            vow.keep();
                        }
                        else send.dir(req, res, srcPath, function(path) {
                            //if autoindex=true and index.html is
                            //found in the dir we send it: (memoryleak if no autoindex?)
                            if (path)
                                vow.keep({ path: path, mimeType: mime.lookup(path), fetch: recast });
                            else vow.keep();
                        });
                    }
                    //this would be a path to a mimeless file. Since
                    //it is in the listableDir path we send it over.
                    else vow.keep({ path: path, fetch: recast });
                }
            });
        }
        //ERROR
        else { send.forbidden(req, res, path);   
               vow.keep(); }
    }
    return vow.promise;
}

function handleRequest(req, res) {
    if (req.originalUrl === '/favicon.ico') {
        send.favicon(req, res);
        return;
    }
    //make sure the path is absolute from /:
    req.url.pathname = Path.normalize(req.url.pathname);
    //make sure path and href are properly set as well then:
    req.url = Url.parse(Url.format(req.url));
    source(req, res).when(
        function(src) {
            if (src)  {
                req.$mimeType = src.mimeType;
                //src.path is the actual relative path to the resource
                //requested, so without the stamp and redirected if a spa.
                src.encoding = acceptEncoding(req); //gzip or deflate
                console.log('enconding', src.encoding);
                //modify key if gzip or deflate is required
                if (options.cache)  {
                    var key = src.path + (src.encoding ? '.' + src.encoding : '');
                    //cache promises to get the value for the key. It
                    //calls the 2nd parameter to fetch it if it
                    //doesn't have it. This function has to return the
                    //promise of the value.
                    return cache(key, function() {
                        return src.fetch();
                    });
                }
                else return src.fetch();
            }
            else return VOW.kept();
        }).when(
            function(data) {
                // console.log(data);
                if (data) { 
                    var ifModifiedSince = req.headers["if-modified-since"];
                    if (!dev && ifModifiedSince && data.cached && Date.parse(ifModifiedSince) > data.cached)  {
                        res.writeHead(304, {});
                        res.end();
                    }
                    else {
                        var value = data.value;
                        res.writeHead(value.status, value.headers);
                        res.end(value.body);
                        debug('Sent ' + req.url.pathname);
                    }
                }
                debug('Finished request for:', req.url.href);
            } 
            ,function(err) {
                //the cache was unable to fetch the value for the key
                //data file read error, transpile error, or compression error
                if (err.missing) send.missing(req, res, err.srcPath);
                else send.error(req, res, err.recastError ? err.recastError : err );
                
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
    cache = cache(options.root, './cache', options.debug);
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
