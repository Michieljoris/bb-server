/*global __dirname:false module:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/ 

var
// sys = require('sys'),
    fs = require('fs'),
    // mime = require("mime"),
    // Path = require('path'),
    // Url = require('url'),
    // VOW = require('dougs_vow'),
    // recaster = require('recaster'),
    // wash = require('url_washer'),
    // cache = require('./cache'),
    // sendMisc = require('./sendMisc')
;

function sendDirectory(req, res, path) {
    function send(f) {
        if (!options.dir) {
            send.forbidden(req,res, path);
        }
        else f();
    }
    fs.readdir(path, function(err, files) {
        if (err) {
            send(function() {return send.error(req, res, err);});
            return;
        }

        if (!files.length) {
            send(function() {return send.directoryIndex(req, res, path, []);});
            return;
        }

        var remaining = files.length;
        files.forEach(function(fileName, index) {
            fs.stat(path + '/' + fileName, function(err, stat) {
                if (err) {
                    // return self.sendError_(req, res, err);
                    files[index] = '-->' + fileName + '';
                }
                else if (stat.isDirectory()) {
                    files[index] = fileName + '/';
                }
                if (options.index && (fileName === 'index.html' ||
                                      fileName === 'index.htm')) {
                    debug('Sending index.html and not the directory!!! ') ;
                    req.$path = path + '/' + fileName;
                    sendFile(req, res);   
                }
                else if (!(--remaining))
                    send(function() {return send.directoryIndex(req, res, path, files);});
            });
        });
    });
}
