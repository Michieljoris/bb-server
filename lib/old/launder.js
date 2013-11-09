/*global module:false __dirname:false module:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/ 

//Code is based on https://github.com/moviepilot/seoserver which is
//again based on https://github.com/apiengine/seoserver

//TODO we need a server to talk to, and a script in the browser that does the same as phantom.

var spawn = require('child_process').spawn,
    Path = require('path'),
    VOW = require('./vow'),
    Which = require('which'),
    request = require('request')
    ;

var phantomPath;
var seoServer = 'http://localhost:8080';

try {
    phantomPath = require('phantomj').path;
} catch(e) {
    console.log(e); } 

var options = {
    verbose: true
    ,die: 30000
    // ,phantomPath: 'bla'
    ,seoServer: 'http://seoserver.axion5.net'
};

function initPhantom() {
    var vow = VOW.make();
    var path = options.phantomPath || phantomPath || '';
    Which(path, function(err, path) {
        // debug(path);
        if (!err) {
            vow.keep(path);   
        }
        else vow.breek(err);
    });
    return vow.promise;
}


var log = [];

function debug() {
    if (options.verbose) console.log.apply(console, arguments);
    log.push(arguments);
}

function removeScriptTags(content) {
    return content.replace(/<script[\s\S]*?<\/script>/gi, '');
}

function render(url, phantomPath) {
    var vow = VOW.make(); 
    var childArgs = [
        Path.join(__dirname, 'phantomjs-script.js'),
        url, 'testph.html'
    ];
    var html = "";
    var err = [];

    var phantom = spawn(phantomPath, childArgs);
    
    var timeout = setTimeout(function() {
        return phantom.kill();
    }, options.die);
    
    var headers = {};
    phantom.stdout.setEncoding('utf8');
    phantom.stdout.on('data', function (data) {
        data = data.toString();
        var responseHeaders;
        var match = data.match(/(\{.*?\})\n\n/);
        if (match) {
            responseHeaders = JSON.parse(match[1]);
            if (responseHeaders.status) {
                headers.status = responseHeaders.status;
            }
            if (responseHeaders.status === 301) {
                headers.location = responseHeaders.redirectURL;
            }
            headers.contentType = responseHeaders.contentType;
            data = data.replace(/(.*?)\n\n/, '');
            console.log(responseHeaders);
        }
        if (data.match(/^\w*error/i)) {
            headers.status = 503;
            console.log("js error: " + data.toString());
        }
        else html += data;
    });

    phantom.stderr.on('data', function (data) {
        err.push(data.toString());
    });

    // phantom.on('close', function (code) {
    //     if (code) {
    //         vow.breek(code);
    //         return;
    //     }
    //     vow.keep({ html: html, err: err });
    // });
    
    phantom.on('exit', function(code) {
        clearTimeout(timeout);
        if (code) {
            console.log('Error on PhantomJS process');
            vow.breek(code);
        } else {
            //  We chose to remove all script tags,
            //  otherwise if/when google bot will start to parse js
            //  it will lead to duplicate renderings of the page.
            vow.keep({ html: removeScriptTags(html), err: err });
        }
    });
    
    return vow.promise;   
}

function go(url, someOptions) {
    options = someOptions || options;
    initPhantom()
        .when(
            function(phantomPath) {
                return render('http://localhost:6001', phantomPath);
            })
        .when(
            function(result) {
                console.log(result.html, result.err);
            }
            ,function(err) {
                //talk to seoserver!!! 
                console.log('seo', err);
                request({ uri: seoServer
                          ,qs: {
                              someParam: 'and some78*()*()*) value'
                          }
                        }, function (error, response, body) {
                            if (!error && response.statusCode === 200) {
                                console.log('here the body', body); // Print the google web page.
                            }
                });
            }
        );
}
   


module.exports = go;

//testing:
go('http://localhost:6001');
