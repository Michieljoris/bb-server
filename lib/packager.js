/*global exports:false __dirname:false module:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/

var zlib = require('zlib'),
fs = require('fs-extra'),
Path = require('path')
//transpile:
//to css
,less = require('less') // http://lesscss.org/#usage
,stylus = require('stylus') // http://learnboost.github.io/stylus/docs/js.html
//to html
,jade = require('jade') //http://jade-lang.com/api/
,marked = require('marked') //https://npmjs.org/package/marked
//to js
,Compiler = require('coffeescript-compiler') //https://npmjs.org/package/coffeescript-compiler

,transformEs6 = require('regenerator') //https://github.com/facebook/regenerator
,sjs = require('sweet.js') //http://sweetjs.org/

//minify
//js
,UglifyJS = require("uglify-js2") //https://github.com/mishoo/UglifyJS2
//html
,minifyHtml = require('html-minifier') //http://perfectionkills.com/experimenting-with-html-minifier/
//css
,csso = require('csso')//http://bem.info/tools/csso/usage/
,cleanCSS = require('clean-css') //https://github.com/GoalSmashers/clean-css

,Path = require('path')
,VOW = require('dougs_vow')
,util = require('util')
;

require('./regen-runtime');

// var log = [];
function debug() {
    if (options.verbose) console.log.apply(console, arguments);
    // log.push(arguments);
}


function Typeof(v) {
    var type = {}.toString.call(v);
    return type.slice(8, type.length-1);
}


var options = {
    //transpilers
    less: 'less',
    stylus: 'stylus',
    coffee: 'coffee',
    // jade: 'jade',
    // sweet: 'sjs',
    // es6: false,
    //minifiers
    js: 'uglify-js2',
    css: 'clean-css',
    // css: 'csso',
    html: false,
    // html: 'html-minifier',
    //compressors
    gzip: true,
    //?
    disk: 'path/to/dir',

    verbose: true
}

var result;
var dest;

var zipper = {
    gzip: zlib.createGzip
    , deflate: zlib.createDeflate
};

var gz = zipper.gzip;
// console.log(gzip);

function gzip(filename,  transform, method, success, error) {
    fs.readFile(decodeURI(Path.resolve(process.cwd(), filename)), function (err, data) {
        if (err) {
            console.log("ERROR");
            return;
        }
        data = transform(data.toString());
        console.log(data);
        // console.log(method, zipper[method]());
        // zipper[method]()(data, function(err, result) {
      gz(data, function(err, result) {
            if (err) {
                console.log('ERROR', err);
                return;
            }
            else success(result);
        });
    });
}

// gzip('./example.sjs', function(d) { return d;}, 'gzip',
//      function(data){ console.log('DATA:', data.length);
//                      zlib.gunzip(data
//                    },
//     function(err) { console.log('error', err); });


// gzip(identityPath, transform, 'gzip',og(err)
//             return
//     function(data) {
//         console.log(data);
//         // fs.writeFile(path, data, function(err) {
//         //     if (err) sendError(req, res, err);
//         //     else send();
//         // });
//     })
function readData(src) {
    var vow = VOW.make();
    fs.readFile(decodeURI(src), function(err, data) {
        if (err) vow.breek(err);
        else vow.keep({src: src, data: data});
        });
    return vow.promise;
}

function transpile(data) {
    var vow = VOW.make();
    var ext = Path.extname(data.src).slice(1);
    if (!ext) vow.breek('Extension missing: ' + data.src);
    
    return vow.promise;
}

function minify(data) {
    var vow = VOW.make();
    return vow.promise;
}

function zip(data) {
    var vow = VOW.make();
    return vow.promise;
}

function zip(data) {
    var vow = VOW.make();
    return vow.promise;
}

//Takes a file and optionally writes it to dest,
//otherwise returns the result.
function pack(src, dest) {
    var vow = VOW.make();
    readData(src)
        .when(transpile)
        .when(minify)
        .when(zip)
        .when(
            function(data) {
                return writeData(data, dest);
            })
        .when(
            function(data) {
                vow.keep(data);}
            ,function(err) {
                vow.breek(err);   
            });
    return vow.promise;
}

pack('hellocoffee');
exports.module = {
    zipperMethods: Object.keys(zipper)
    ,pack: pack
};

//EXAMPLES:
// var source = 'a{font-weight:bold;}';
// var minimized = cleanCSS.process(source);
// console.log(minimized);

// // console.log(util.inspect(minifyHtml));
// var input = '<!-- foo --><div>baz</div><!-- bar\n\n moo -->';
// var html = minifyHtml.minify(input, { removeComments: true }); // '<div>baz</div>'
// console.log(html);


// var result = UglifyJS.minify("var b = function () {};", {fromString: true});
// console.log(result);

// less.render('.class { width: (1 + 1) }', function (e, css) {
//     console.log(css);
// });

// stylus.render("body {font: 12px Helvetica, Arial, sans-serif;}", function(err, css){
//     if (err) throw err;
//     console.log(css);
// });

// css = '.test, .test { color: rgb(255, 255, 255) }';

// console.log(csso.justDoIt(css));


// // Compile a function
// var fn = jade.compile('string of jade', {});

// // Render the function
// var locals = {};
// var html = fn(locals);
// console.log(html);
// // => '<string>of jade</string>'

// // Set default options
// marked.setOptions({
//   gfm: true,
//   tables: true,
//   breaks: false,
//   pedantic: false,
//   sanitize: true,
//   smartLists: true,
//   langPrefix: 'language-',
//   highlight: function(code, lang) {
//     if (lang === 'js') {
//       return highlighter.javascript(code);
//     }
//     return code;
//   }
// });
// console.log(marked('i am using __markdown__.'));

// var cc = new Compiler(process.cwd() + '/../node_modules/coffee-script/bin/coffee');

// cc.compile('a = 5', function (status, output) {
//     if (status === 0) {
//         console.log(output);
//         // JavaScript available as a string in the `output` variable
//     }
// });

// var identityPath = Path.resolve(__dirname , 'image.js');
// var transform = function(data) {
//     return data;
// };

// var src = fs.readFileSync('./regen.js').toString();
// // console.log(src.toString());
// var es5Source = transformEs6(src);
// // console.log(es5Source);
// eval(es5Source);

// // var es5SourceWithRuntime = require("regenerator")("", { includeRuntime: true });
// // console.log(es5SourceWithRuntime);
// // eval(es5SourceWithRuntime);

// var tsc = require('../node_modules/node-typescript/lib/compiler');//https://npmjs.org/package/node-typescript
// var compiler = tsc.compiler;

// tsc.initDefault();

// var code = '\
// class Greeter {\
//     greeting: string;\
//     constructor(message: string) {\
//         this.greeting = message;\
//     }\
//     greet() {\
//         return "Hello, " + this.greeting;\
//     }\
// }\
// var greeter = new Greeter("world");\
// var button = document.createElement("button");\
// button.innerText = "Say Hello";\
// button.onclick = function() {\
//     alert(greeter.greet());\
// };\
// document.body.appendChild(button);\
// ';

// tsc.resolve(__dirname + '/xxx.ts', code, compiler);

// compiler.typeCheck();

// var stdout = new tsc.EmitterIOHost();
// compiler.emit(stdout);
// console.log(stdout.fileCollection['/home/michieljoris/mysrc/javascript/bb-server/lib/xxx.js'].lines.join(''));
// Get the javascript output in stdout.fileCollection. To this example the javascript output is:

// { '.../xxx.js':
//    { lines:
//       [ 'var Greeter = (function () {',
//         '    function Greeter(message) {',
//         '        this.greeting = message;',
//         '    }',
//         '    Greeter.prototype.greet = function () {',
//         '        return "Hello, " + this.greeting;',
//         '    };',
//         '    return Greeter;',
//         '})();',
//         'var greeter = new Greeter("world");',
//         'var button = document.createElement("button");',
//         'button.innerText = "Say Hello";',
//         'button.onclick = function () {',
//         '    alert(greeter.greet());',
//         '};',
//         'document.body.appendChild(button);' ],
//      currentLine: '' } }




// console.log(sjs);
// var src = fs.readFileSync('./example.sjs').toString();
// var js = sjs.compile(src);
// // console.log(js);
// eval(js);
// // or require directly in other modules on node:
// // require('sweet.js');
// // example = require('./example.sjs');
// // console.log(example.one);
