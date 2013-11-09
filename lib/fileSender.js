/*global __dirname:false module:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/ 
//redundant..
var
    fs = require('fs')
    // ,sys = require('sys')
    // ,url = require('url')
    ,md = require("node-markdown").Markdown
    ,mime = require("mime")
    // Path = require('path'),
    ,exec = require('child_process').exec
    ,cache = require('cachejs').lru(),
    packager = require('./packager'),
    launder = require('.launder') //the js from the html..
;



//Do some prep work then send off the req to the fileSender module to
//retrieve and send the file
//Prep:
//1 Send a 304 not modified if appropriate instead
//2 Create all the headers
//3 Finish up if only the HEAD is requested
//4 Forward the req to the fileSender module
function sendFile(req, res) {
    var path = req.$path;
    var GMTdate = req.$GMTdate;
    if (!dev && Date.parse(req.headers["if-modified-since"]) >= Date.parse(GMTdate))  {
        // if (!dev && req.headers["if-modified-since"] === GMTdate.toString()) {
        res.writeHead(304, {});
        res.end();
        return;
    }
    var mimeType = mime.lookup(path);
    req.$mimeType = mimeType;
        
    var headers = createHeaders(req, res, mimeType, GMTdate, path);
        
    if (req.method === 'HEAD') {
        res.writeHead(200, headers);
        res.end();
        return;
    }
    
    req.$headers = headers;
    // fileSender(req, res);
}





function fileSender(req, res) {
// function fileSender(req, res, headers, path, options, GMTdate, mimeType, sendError) {
    //we know it's a file, we know it exists.
    
    function send() {
        res.writeHead(200, headers);
        fs.createReadStream(path).pipe(res);
    }
    
    var zipMethod = headers['Content-Encoding'];
    if (zipMethod) {
        // //on the fly gzipping:
        // fs.createReadStream(path).pipe(zipper[zipMethod]).pipe(res);
        // cached gzipping: (on disk not memory)
        var identityPath = path;
        path = path + '.' + Number(GMTdate) +  '.gz';
        //do we have a gzipped version with this modified date?
        fs.stat(path, function(err, stat) {
            if (err && err.code === 'ENOENT' && stat.size > options.gzipThreshold) {
               //no
                // Remove any old gz file
                exec('rm ' + path + '.*.gz', function() {
                    var transform = function(data) { return data; };
                    if (mimeType && options.markdown && /markdown/.test(mimeType)) {
                        headers['Content-Type'] = mime.lookup('.html');
                        transform = function (data) { return md(data); };
                    } 
                    // Gzipped file doesn't exist, so make it then send
                    
                    
                    gzip(identityPath, transform, zipMethod,
                         function(data) {
                             fs.writeFile(path, data, function(err) {
                                 if (err) sendError(req, res, err);
                                 else send();
                             });
                         },
                         function(err) {
                             sendError(req, res, err);
                         });
                });
            } else if (err) {
                delete headers['Content-Encoding'];
                delete headers.Vary;
                path = identityPath;       
                send();
            } else {
                send();
            }
        });
        return;
    }
    else  {
        if (mimeType && options.markdown && /markdown/.test(mimeType)) {
            //you could abstract this and have plugin transformers based
            //for example on mimetype, but for now inline
            headers['Content-Type'] = mime.lookup('.html');
            fs.readFile(decodeURI(path), function (err, data) {
                if (err) sendError(err);
                else {
                    res.writeHead(200, headers);
                    res.end(md(data.toString()));
                }
            });
            
        } 
        else send();
    } 
}


module.exports = {
    fileSender: fileSender
};
