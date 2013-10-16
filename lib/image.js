/*global exports:false __dirname:false module:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/ 


var fs = require('fs-extra'),
    path = require('path'),
    util = require('util'),
    child_process = require('child_process'),
    spawn = child_process.spawn,
    smushit = require('node-smushit'),
    gm = require('gm'),
    tmp  = require('tmp'),
    Which = require('which'),
    VOW = require('./vow'),
    filesize = require('filesize')

;

var log;
var  png = [".png", ".bmp", ".gif", ".pnm", ".tiff"],
    jpegs = [".jpg", "jpeg"],
    cmds = {
        //jpeg
        jpegtran: { cmd: 'jpegtran'},
        jpegoptim: { cmd: 'jpegoptim' },
        //png
        pngquant: { cmd: 'pngquant' },
        optipng: { cmd: 'optipng' },
        pngout: { cmd: 'pngout-static' },
        resize: { cmd: ''}
    }
;

function getCmdPath(cmd) { 
    var vow = VOW.make();
    Which(cmds[cmd].cmd, function(err, path) {
        if (!err) {
            cmds[cmd].path = path;
            vow.keep(path);   
        }
        else vow.breek(err);
    });
    return vow.promise;
}

function initCmds() {
    var vows = [];
    Object.keys(cmds).forEach(function(c) {
        vows.push(getCmdPath(c));
    });
    return VOW.any(vows);
}



var sizes = [];
var totalSize = 0;

var log;
function debug() {
    console.log.apply(console, arguments);
    log.push(arguments);
}

function not_installed(cmd, cb) {
    debug('[Running ' + cmd + '...](error)');
    debug([
        'In order for this task to work properly, :cmd must be',
        'installed and in the system PATH (if you can run ":cmd" at',
        'the command line, this task should work)'
    ].join(' ').replace(/:cmd/g, cmd));
    debug('Skiping ' + cmd + ' task');
    if (cb) cb();
};

function recurse(dir, callback) {
    fs.readdirSync(dir).forEach(function(fileName) {
        var filePath = path.join(dir, fileName);
        try{
            var stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
                if (options.recurse) recurse(filePath, callback);
            } else {
                callback(filePath, fileName, stats.size);
            }
        } catch(e) {
            console.log("ERROR",e);
           }
    });

}

function getTmpFile() {
    var vow = VOW.make();
    tmp.file(function(err, path, fd) {
        if (err) {
                console.log("Couldn't create temp file..", err);
            vow.breek(err);
            return;
        }
        vow.keep(path);
    }); 
    return vow.promise;
}

function cp(a, b) {
    var vow = VOW.make();
    fs.copy(a, b, function(err) {
        if (err) { vow.breek(err); return; }
        vow.keep(b);
    });
    return vow.promise;
}


function optimize(cmd, file, cb) {
    var vow = VOW.make();
    
    getTmpFile()
        .when(
            function(tmp) {
                return cp(file, tmp);
            })
        .when(
            cmd.exec
        )
        .when(
            function(tmp) {
                return cp(tmp, options.out ? path.join(options.out, path.basename(file)) : file);
            }
        );
    
    return vow.promise;
}

var pngFiles = [];
var jpgFiles = [];

function getImagePaths(dir) {
    // var vow = VOW.make();
    if (!Array.isArray(dir)) dir = [dir];
    dir.forEach(function(d) {
        recurse(d, function(filePath, fileName, size) {
            // console.log(filePath, fileName); 
            if (!!~png.indexOf(path.extname(fileName).toLowerCase())) pngFiles.push({file: filePath, size: size} );
            else if (!!~jpegs.indexOf(path.extname(fileName).toLowerCase())) jpgFiles.push({file: filePath, size: size});
        }); 
        
    }); 
    console.log(pngFiles, jpgFiles);
    // return vow.promise;
    
}

function process(dir, someOptions) {
    options = someOptions || options;
    initCmds()
        .when(
            function(data) {
                console.log(data);
                getImagePaths(dir);
                if (options.smushit)
                    return doSmushit(pngFiles.concat(jpgFiles));
                else return 'bla';
            })
        .when(
            function (result) {
                console.log(result);
            },
            function(err) {
                console.log(err);
            });
    // var src = file;
    // var tmpDest = '';
    // var realDest; 
    // var oldFile = fs.statSync(src).size,
    //     newFile = fs.statSync(tmpDest).size,
    //     savings = Math.floor((oldFile - newFile) / oldFile * 100);
    // //TODO cp file to readDest and delete tmpDest
    // if(savings >= 0) {
    //     debug('Optimized ' + realDest.cyan +
    //           ' [saved ' + savings + ' % - ' + filesize(oldFile, 1, false) + ' → ' + filesize(newFile, 1, false) + ']');
    //     sizes.push(savings);
    //     totalSize += oldFile - newFile;
    // }
    // else {
    //     // grunt.file.copy(src, realDest);
    //     debug('Optimization would increase file size by ' + (savings * -1) + ' % so optimization was skipped on file ' + src.yellow);
    //     sizes.push(0);
    // }
}

function doSmushit(files) {
    var vow = VOW.make(); 
    //smash images and register callbacks
    smushit.smushit(files, {
        recursive: options.recurse,
        onItemStart: function(item){
            console.log('start:', item);
        },
        onItemComplete: function(e, item, response){
            console.log('item complete:', item, e , response);
        },
        onComplete: function(reports){
            console.log('complete:', reports);
            vow.keep(reports);
        }
        // service: 'http://my-custom-domain-service/'
    });
    return vow.promise;
}

// Resize the image.

// options
// %, @, !, < or > see the GraphicsMagick docs for details
// gm("img.png").resize(width [, height [, options]])
// To resize an image to a width of 40px while maintaining aspect ratio: gm("img.png").resize(40)

// To resize an image to a height of 50px while maintaining aspect ratio: gm("img.png").resize(null, 50)

// To resize an image to a fit a 40x50 rectangle while maintaining aspect ratio: gm("img.png").resize(40, 50)

// To override the image's proportions and force a resize to 40x50: gm("img.png").resize(40, 50, "!")


cmds.resize.exec = function(src) {
    var resize = options.resize;
    var vow = VOW.make();
    debug('Resizing: ', src);
    gm(src)
        .autoOrient()
        .resize(resize)
        .write(dest, function (err) {
            if (err) { debug(err); }
            debug('Resized ' + src);
        });
    return vow.promise;
};

cmd.jpegtran.exec = function(src) {
    var vow = VOW.make();
    
    return vow.promise;
}

cmd.jpegoptim.exec = function(src) {
    var vow = VOW.make();
    
    return vow.promise;
}

cmd.optipng.exec = function(src) {
    var vow = VOW.make();
    
    return vow.promise;
}

cmd.pngquant.exec = function(src) {
    var vow = VOW.make();
    
    return vow.promise;
}

cmd.pngout.exec = function(src) {
    var vow = VOW.make();
    
    return vow.promise;
}
process('/home/michieljoris/www/sites/firstdoor/www/images');










// var ImageOptimzer, exec, exists, fs, path, smushit, spawn, sysPath, _ref;

// _ref = require('child_process'), spawn = _ref.spawn, exec = _ref.exec;

// fs = require("fs");

// path = require("path");

// sysPath = require('path');

// smushit = require('node-smushit');

// exists = fs.exists || path.exists;

// module.exports = ImageOptimzer = (function() {

//   ImageOptimzer.prototype.brunchPlugin = true;

//   ImageOptimzer.prototype.png = [".png", ".bmp", ".gif", ".pnm", ".tiff"];

//   ImageOptimzer.prototype.jpegs = [".jpg", "jpeg"];

//   ImageOptimzer.prototype._PNGBin = 'optipng';

//   ImageOptimzer.prototype._JPGBin = 'jpegtran';

//   ImageOptimzer.prototype.imagePath = 'images';

//   function ImageOptimzer(config) {
//     var _ref1, _ref2,
//       _this = this;
//     this.config = config;
//     if ((_ref1 = this.config.imageoptimizer) != null ? _ref1.path : void 0) {
//       this.imagePath = this.config.imageoptimizer.path;
//     }
//     this.imagePath = sysPath.join(this.config.paths["public"], this.imagePath);
//     if (!((_ref2 = this.config.imageoptimizer) != null ? _ref2.smushit : void 0)) {
//       exec("" + this._PNGBin + " --version", function(error, stdout, stderr) {
//         if (error) {
//           return console.error("You need to have optipng and jpegtran on your system");
//         }
//       });
//     }
//     null;
//   }

//   ImageOptimzer.prototype.onCompile = function(generatedFiles) {
//     var files, filesjpeg, _ref1,
//       _this = this;
//     if (!this.config.optimize) {
//       return;
//     }
//     if (!fs.existsSync(this.imagePath)) {
//       return;
//     }
//     if ((_ref1 = this.config.imageoptimizer) != null ? _ref1.smushit : void 0) {
//       return smushit.smushit(this.imagePath, {
//         recursive: true
//       });
//     } else {
//       files = this.readDirSync(this.imagePath);
//       if (files.png.length) {
//         this.optimizePNG(files.png, function(error, result) {
//           return console.log("Compressed " + files.png.length + " png files via " + _this._PNGBin);
//         });
//       }
//       if (files.jpeg.length) {
//         filesjpeg = files.jpeg.slice(0);
//         return this.optimizeJPG(files.jpeg, function(error, result) {
//           return console.log("Compressed " + filesjpeg.length + " jpeg files via " + _this._JPGBin);
//         });
//       }
//     }
//   };

//   ImageOptimzer.prototype.calculateSizeFromImages = function(files) {
//     var size;
//     size = 0;
//     files.forEach(function(file) {
//       return size += fs.statSync(file).size;
//     });
//     return size;
//   };

//   ImageOptimzer.prototype.readDirSync = function(baseDir) {
//     var fileList, readdirSyncRecursive,
//       _this = this;
//     baseDir = baseDir.replace(/\/$/, "");
//     fileList = {
//       png: [],
//       jpeg: []
//     };
//     readdirSyncRecursive = function(baseDir) {
//       var curFiles, files, isDir, nextDirs, prependBaseDir;
//       files = [];
//       isDir = function(fname) {
//         return fs.statSync(sysPath.join(baseDir, fname)).isDirectory();
//       };
//       prependBaseDir = function(fname) {
//         return sysPath.join(baseDir, fname);
//       };
//       curFiles = fs.readdirSync(baseDir);
//       nextDirs = curFiles.filter(isDir);
//       curFiles = curFiles.map(prependBaseDir);
//       files = files.concat(curFiles);
//       while (nextDirs.length) {
//         files = files.concat(readdirSyncRecursive(sysPath.join(baseDir, nextDirs.shift())));
//       }
//       return files;
//     };
//     readdirSyncRecursive(baseDir).forEach(function(filepath) {
//       if (!!~_this.png.indexOf(path.extname(filepath).toLowerCase())) {
//         fileList.png.push(filepath);
//       }
//       if (!!~_this.jpegs.indexOf(path.extname(filepath).toLowerCase())) {
//         return fileList.jpeg.push(filepath);
//       }
//     });
//     return fileList;
//   };

//   ImageOptimzer.prototype.optimizeJPG = function(files, callback) {
//     var clean, error, options, result, run, tmpfile,
//       _this = this;
//     error = null;
//     result = '';
//     tmpfile = 'jpgtmp.jpg';
//     options = ['-copy', 'none', '-optimize', '-outfile', 'jpgtmp.jpg'];
//     (run = function(file) {
//       var args, jpegtran, wStream;
//       if (!file) {
//         return clean();
//       }
//       args = options.concat(file);
//       wStream = null;
//       jpegtran = spawn(_this._JPGBin, args);
//       return jpegtran.on('exit', function(code) {
//         if (code) {
//           return;
//         }
//         fs.writeFileSync(file, fs.readFileSync(tmpfile));
//         return run(files.shift());
//       });
//     })(files.shift());
//     clean = function() {
//       return exists(tmpfile, function(exists) {
//         if (!exists) {
//           return callback(result, error);
//         }
//         return fs.unlink(tmpfile, function(err) {
//           return callback(result, error);
//         });
//       });
//     };
//     return this;
//   };

//   ImageOptimzer.prototype.optimizePNG = function(files, callback) {
//     var args, error, onExit, options, optipng, result;
//     error = null;
//     result = '';
//     options = [];
//     args = options.concat(files);
//     optipng = spawn(this._PNGBin, args);
//     optipng.stderr.on('data', function(buffer) {
//       return result += buffer.toString();
//     });
//     onExit = function(code) {
//       return callback(error);
//     };
//     optipng.on('close', onExit);
//     return null;
//   };

//   return ImageOptimzer;

// })();


var options = {
    destDir: '',
    overwrite: false,
    // recurse: true,
    resize: {w: 100, h: 100},
    lossy: false,
    smushit: false
};

module.exports = process;




// tmp.file({postfix: '.txt' }, function _tempFileCreated(err, path, fd) {

//   if (err) throw err;

//   console.log("File: ", path);
//   console.log("Filedescriptor: ", fd);
// });
// console.log(filesize(1000000, {base: 10})   );
// tmp.tmpName({ template: '/tmp/bla-XXXXXX' }, function _tempNameGenerated(err, path) {
//     if (err) throw err;

//     console.log("Created temporary filename: ", path);
// });



//jpg remove metadata!!!



//     // var spawn = require('child_process').spawn;
//     // var args = ['-convert' , 'testin.jpg', "-quality", "50", 'spawn.jpg' ];
//     // var ls = spawn('gm', args);
//     // // debug(composite);
//     // ls.stdout.on('data', function (data) {
//     //     debug('stdout: ' + data);
//     // });

//     // ls.stderr.on('data', function (data) {
//     //     debug('stderr: ' + data);
//     // });

//     // ls.on('close', function (code) {
//     //     debug('child process exited with code ' + code);
//     // });
// }

// function compress(file, quality, callback) {
//     "use strict";
//     gm()
//         .compress()['in'](file)
//         .out('JPEG', '-quality', quality.toString())
//         .write(file, function (err) {
//             callback(err);
//         });
        


// function compressFiles(pathIn, someFiles, pathOut, quality, done) {
    
//     "use strict";
//     debug('Resizing..');
//     var compressed = 0;
//     var files = [];
//     someFiles.forEach(function(f) {
//         files.push(f);
//     });
    
//     function r(f, cb) {
//         if (!f) cb();
//         else compress(pathOut + f, quality,  function(err) {
//             if (err) { debug(err); }
//             else {
//                 debug('Compressed ' + f);
//                 compressed++; }
//             r(files.pop(), cb);
//         });
//     }
    
//     r(files.pop(), function() {
//         debug('Compressed ' + compressed + ' images of ' + someFiles.length);
//         done();
//     });
// }

// function processImages(pathIn, files, pathOut, resize, quality, aLog, done) {
//     "use strict";
//     // log = [];
//     log = aLog;
//     debug('Processing ' + files.length + ' images.');
//     resizeFiles(pathIn, files, pathOut, resize, function() {
//         compressFiles(pathIn, files, pathOut, quality, function() {
//             done(log);
//         });
//     }
//     ) ;
// } 



// exports.process = processImages;
