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
    extend = require('extend'),
    VOW = require('dougs_vow'),

    recaster = require('recaster'), //only loads what's needed
    wash, cache;
;

mime.default_type = false;

var send, options, pathMap = {}, out, spaFile, indexFile;

// var dev = process.env.BB_SERVER_DEV;
var dev = false;


//Prepare standard, cache, gzip and custom headers
function createHeaders(file) {
    //default headers ------------------------------------
    var mimeType =  file.mimeType || 'text/plain';
    var headers = { 'Content-Type': mimeType
                    ,Server: 'bb-server/' + options.version };

    if (file.encoding)
    {  headers['Content-Encoding']= file.encoding;
       headers.Vary = 'Accept-Encoding';  }

    //cache headers---------------------------------
    //if a file request came in with a time stamp send the file
    //out with the stamp cache headers, (high expiresIn probably)
    file.cacheSettings = (function() {
        if (options.cache) {
            if (file.prerender) return options.cache.prerender;
            else if (file.stamped) return options.cache.stamped;
            else return options.cache.other;
        }
        else return {
            cacheControl: "nostore, nocache, max-age=0, must-revalidate",
            expiresIn: 0 };
    })();
    headers['Cache-Control'] = file.cacheSettings.cacheControl;
    if (file.cacheSettings.expiresIn)
        headers.Expires = new Date(Date.now() + file.cacheSettings.expiresIn).toString();
    headers['Last-Modified'] = new Date().toString(); //src.GMTdate.toString();

    //add any custom headers ------------------------------------------
    Object.keys(options.headers).forEach(function(k){
        headers[k] = options.headers[k];
    });
    return headers;
}

/*
  Returns required encoding (zipping) if enabled and and accepted and possible,
  otherwise return false.
*/
function acceptEncoding(req, mimeType) {
    //gzip headers -------------------------------------
    var ua = req.headers['user-agent'] || '',
        accept = req.headers['accept-encoding'] || '';

    // Note: this is not a conformant accept-encoding parser.
    // See http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.3
        var encoding;
    if ('*' === accept.trim()) encoding = 'gzip';
    else {
        if (!recaster.zipperMethods.some(function(m) {
            encoding = m;
            return ~accept.indexOf(m);
        })) encoding = false;
        // for (var i = 0, len = recaster.zipperMethods.length; i < len; ++i)
        //     if (~accept.indexOf(recaster.zipperMethods[i])) {
        //         encoding = recaster.zipperMethods[i];
        //         break;  }
    }
    if (options.zip && encoding && options.zip.test(mimeType) &&
        !(~ua.indexOf('MSIE 6') && !~ua.indexOf('SV1')) &&
        req.method !== 'HEAD')
    { return encoding; }
    else return false;
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

/*
  Returns the url of the real page the bot is actually requesting so we can render
  it internally first on phantomjs before sending it back, because bots are dumb
  and can't render the page themselves..
  Returns false if we're not going to prerender at all.

  All the logic for deciding whether to make/send a prerendered page is in this function:
  Finds out if the request is for a fragment or from a bot and for a hashbang url,
  (if options allow for this).

*/
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

    //path = pathname + hashbang without query or final hash
    if (options.prerender) {
        var url = req.url;
        //see if we have an escaped fragment request, triggered either by a
        //hashbang in the original url, or a fragment meta tag on the page:
        if (url.query && url.query._escaped_fragment_ !== undefined) {
                var fragment = unescape( url.query._escaped_fragment_);
                var fragmentIndex = (url.search.indexOf('&_escaped_fragment_='));
                var search =  fragmentIndex === -1 ? '' : url.search.slice(0, fragmentIndex);
            return  url.pathname + search + (fragment.length ? '#!' + fragment: '') + (url.hash ? url.hash : '');
        }
    }
    return false;
}

//test previous function:
// options = { prerender:true, bot: true, fragment: true, hashbang: true };
// var r = isPrerender({
//     headers: { "user-agent": '' }
//     //possibel requests from bots:
//     ,url : Url.parse("http://user:pass@host.com:8080/p/a/t/h?query=string&abc=123&_escaped_fragment_=", true)
//     // >> /p/a/t/h?query=string&abc=123
//     // ,url : Url.parse("http://user:pass@host.com:8080?query=string&abc=123&_escaped_fragment_=some/other/path%23myhash", true)
//     // >> /?query=string&abc=123#!some/other/path#myhash
//     // ,url : Url.parse("http://user:pass@host.com:8080?_escaped_fragment_=/some/other/path%23myhash", true)
//     // >> /#!/some/other/path#myhas
// });
// console.log(r);


//recast and prerender are functions added to a file object so we can create the data that we will be sending to the client and possibly to cache.

//recast potentially transpiles, minifies and compresses, depending on options
//and type of resource requested, and returns a promise of the data created.
function recast() { //fetch function
    var vow = VOW.make();
    //always called from a file object:
    var file = this;

    //prepend root, normalize and remove trailing slashes, to
    //produce a file path:
    var filePath = Path.join(options.root, file.path);
    recaster.recast({ srcPath: filePath, encoding: file.encoding })
        .when(
            function(data) {
                var headers = createHeaders(file);
                vow.keep({ value: { status: 200,
                                    headers: headers,
                                    body: data.recast },
                           source: filePath,
                           maxAge: file.cacheSettings.expiresIn
                         });
            }
            ,vow.breek
        );
    return vow.promise;
}


function retrieveAsIs() { //fetch function
    var vow = VOW.make();
    var file = this;
    var headers = createHeaders(file);
    var filePath = Path.join(options.root, file.path);
    fs.readFile(decodeURI(filePath), function(err, data) {
        if (err) vow.breek({ missing: true,  srcPath: file.path });
        else vow.keep({ value: { status: 200,
                                 headers: headers,
                                 body: data },
                        source: filePath,
                        maxAge: file.cacheSettings.expiresIn
                      });
    });
    return vow.promise;
}



//prerender passes the request on to phantomjs, and then promises the data
//washed clean of javascript, and minified and compressed, if desired.
function prerender() { //fetch function
    out('in prerender');
    var vow = VOW.make();
    //this function is always called from a file object:
    var file = this;
    var href = options.seoServer ?
        Url.resolve(file.href, file.path) :
        Url.resolve('http://localhost:' + options.port, file.path);

    wash(href, { phantomPath: options.phantomPath,
                 seoServer: options.seoServer , verbose: !options.quiet })
        .when(
            function(result) {
                file.mimeType = result.headers.contentType;
                file.status = result.headers.status;
                // console.log(result.links, result.headers);
                return recaster.recast({ srcData: result.html, type: 'html',
                                         encoding: file.encoding //gzip or deflate
                                       });
            })
        .when(
            function(data){
                var headers = createHeaders(file);
                vow.keep({ value: { status: file.status,
                                    headers: headers,
                                    body: data.recast },
                           maxAge: file.cacheSettings.expiresIn,
                           prerendered: true
                         });
            }
            ,function(err) {
                console.log(err);
                vow.breek({ missing: true,  srcPath: file.href });
            }
        );
    return vow.promise;
}

function getFile(req, res) {
    var vow = VOW.make();
        var prerenderKey = isPrerender(req);
    if (prerenderKey) {
        out('prerenderkey:', prerenderKey);
        vow.keep({ href: req.url.href, path: prerenderKey, prerender: true, fetch: prerender });
    }
    else if (options.spa) {
        spaFile.encoding = acceptEncoding(req, spaFile.mimeType);
        vow.keep(spaFile);
    }
    else {
        var path = stripStamp(req.url.pathname);
        var ext = Path.extname(path);
        var mimeType = mime.lookup(ext);
        var file = {
            path: path,
            mimeType: mimeType,
            encoding: acceptEncoding(req, mimeType)
        };
        file.stamped = file.path !== req.url.pathname;

        if (mimeType) {
            file.fetch = (recaster.isRecastable(ext) || file.encoding) ? recast : retrieveAsIs;
            vow.keep(file);
        }
        else if (listableDir(path)) {
                var filePath = Path.join(options.root, path);
            fs.stat(filePath, function(err, stat) {
                if (err) {//ERROR in retrieving path..
                    delete pathMap[path];
                    vow.breek(err);
                }
                else {
                    if (stat.isDirectory()) {
                        if (path[path.length-1] !== '/') {
                            vow.breek({ redirect: true, srcPath: path + '/' });
                        }
                        else send.dir(req, res, filePath, function(path) {
                            //if autoindex=true and index.html is
                            //found in the dir we send it: (memoryleak if no autoindex?)
                            if (path) {
                                indexFile.path = path;
                                indexFile.encoding = acceptEncoding(req, indexFile.mimeType);
                                indexFile.fetch = (recaster.isRecastable(ext) || indexFile.encoding) ? 
                                    recast : retrieveAsIs;
                                vow.keep(indexFile);
                            }
                            else vow.breek({ preempted: true });
                        });
                    }
                    //this would be a path to a mimeless file. Since
                    //it is in the listableDir path we send it over.
                    else vow.keep({ path: path, fetch: retrieveAsIs });
                }
            });
        }
        //ERROR
        else {
            vow.breek({ forbidden: true, srcPath: path }); }
    }
    return vow.promise;
}

function fetch(file) {
    return file.fetch();
} 

function fetchFromCache(file) {
    //file.path is the actual relative path to the resource
    //requested, so without the stamp and redirected if a spa.
        //modify key if gzip or deflate is required
        var key = file.path + (file.encoding ? '.' + file.encoding : '');
        //cache promises to get the value for the key. It calls the
        //fetch function of the 2nd parameter to fetch it if it
        //doesn't have it. This function has to return the promise
        //of the value.
        return cache(key, file);

        // return cache(key,  function() {
        //     return file.fetch();
        // });
}

function handleRequest(req, res) {
    if (req.originalUrl === '/favicon.ico') {
        send.favicon(req, res);
        return;
    }
    //make sure the path is absolute from /:
    req.url.pathname = Path.normalize(req.url.pathname);
    //make sure path and href are properly set as well then:
    // req.url = Url.parse(Url.format(req.url), true);

    //decide what to get, and how to get it:
    getFile(req, res)
        .when(function(file) {
            var vow = VOW.make();
            var filePath = Path.join(options.root, file.path);
            var ifModifiedSince = req.headers["if-modified-since"];
            if (!ifModifiedSince) vow.keep(file);
            else fs.stat(filePath, function(err, stat) {
                if (err) vow.keep(file);
                else {
                    //don't validate if the source file has changed since it was cached:
                    if (stat.mtime > Date.parse(ifModifiedSince))
                    {
                        file.mtime = stat.mtime;
                        vow.keep(file);
                    }
                    else {
                        res.writeHead(304, {});
                        res.end();
                        vow.breek({ preempted: true });
                    }
                } 
            });
            return vow.promise;
        })
        .when(fetch)
        .when(
            function(data) {
                // console.log(data);
                if (data) {
                    if (data.prerendered) out('Prerendered ' + req.url.href);
                    //     var ifModifiedSince = req.headers["if-modified-since"];
                    // console.log(ifModifiedSince, Date(data.cached));
                    // if (!dev && ifModifiedSince && data.cached && Date.parse(ifModifiedSince) > data.cached)  {
                    //     console.log("SENDING #304 REDIRECT");
                    //     res.writeHead(304, {});
                    //     res.end();
                    // }
                    // else {
                    var value = data.value;
                    res.writeHead(value.status, value.headers);
                    res.end(value.body);
                }
            }
            ,function(err) {
                //the cache was unable to fetch the value for the key
                //data file read error, transpile error, or compression error
                if (err.preempted) ;
                else if (err.redirect) send.redirect(req, res, err.srcPath );
                else if (err.forbidden)  send.forbidden(req, res, err.srcPath);
                else if (err.missing) send.missing(req, res, err.srcPath);
                else send.error(req, res, err.recastError ? err.recastError : err );

            }
        );
}

module.exports.get = function(someOptions) {
    var sendDir;
    options = someOptions;
    out = options.out;
    recaster.init(options.recast, options.out);

    if (options.cache)
        cache = require('./cache')(options.root, './cache', options.out);

    if (options.prerender)
        wash = require('url_washer');

    send = extend({}
                  ,require('./sendMisc')(options)
                  ,options.dir ? require('./sendDir')(options) : {}
                 );
    var path = stripStamp(options.spa);
    var ext = Path.extname(path);
    var mimeType = mime.lookup(ext);
    spaFile = {
        path: path,
        mimeType: mimeType,
        fetch: recast
    };

    if (options.index) {
        ext = Path.extname(options.index);
        indexFile = {
            mimeType: mime.lookup(ext)
        };
    }
    
    if (options.cache) fetch = fetchFromCache;

    return handleRequest;
    // return { handleGet :handleRequest };
};
// http://localhost:9000/?_escaped_fragment_=/resources#motivation


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
