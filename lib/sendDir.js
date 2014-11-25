/*global __dirname:false module:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/ 

var
// sys = require('sys'),
    fs = require('fs'),
    send = require('./sendMisc'),
    escapeHtml = require('escape-html')
;

var out, options;

function writeDirectoryIndex(req, res, path, files) {
    path = path.substring(1);
    res.writeHead(200, {
        'Content-Type': 'text/html'
    });
    if (req.method === 'HEAD') {
        res.end();
        return;
    }
    res.write('<!doctype html>\n');
    res.write('<title>' + escapeHtml(path) + '</title>\n');
    res.write('<style>\n');
    res.write('  ol { list-style-type: none; font-size: 1.2em; }\n');
    res.write('</style>\n');
    res.write('<h1>Directory: ' + escapeHtml(path) + '</h1>');
    res.write('<ol>');
    files.forEach(function(fileName) {
        if (fileName.charAt(0) !== '.') {
            res.write('<li><a href="' +
                      escapeHtml(fileName) + '">' +
                      escapeHtml(fileName) + '</a></li>');
        }
    });
    res.write('</ol>');
    res.end();
}

function sendDirectory(req, res, path, cb) {
    fs.readdir(path, function(err, files) {
        if (err) {
            send.error(req, res, err);
            cb();
            return;
        }

        if (!files.length) {
            writeDirectoryIndex(req, res, path, []);
            cb();
            return;
        }

        var remaining = files.length;
        var done;
        //TODO: does a stat on every file in the list even when index.html is in the list.
        files.forEach(function(fileName, index) {
            fs.stat(path + '/' + fileName, function(err, stat) {
                if (done) return;
                if (err) {
                    // return self.sendError_(req, res, err);
                    files[index] = '-->' + fileName + '';
                }
                else if (stat.isDirectory()) {
                    files[index] = fileName + '/';
                }
                if (options.index && fileName === options.index) {
                    out('Sending ' + options.index + ' and not the directory!!! ') ;
                    cb(fileName);
                    done = true;
                }
                else if (!(--remaining)) {
                    writeDirectoryIndex(req, res, path, files);
                    cb();
                }
            });
        });
    });
}


module.exports = function (someOptions) {
    options = someOptions;
    out = options.out;
    return {
        dir: sendDirectory
    };
};

