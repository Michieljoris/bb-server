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

//minify 
//js
,UglifyJS = require("uglify-js2") //https://github.com/mishoo/UglifyJS2
//html
,minifyHtml = require('html-minifier') //http://perfectionkills.com/experimenting-with-html-minifier/
//css
,csso = require('csso')//http://bem.info/tools/csso/usage/
,cleanCSS = require('clean-css') //https://github.com/GoalSmashers/clean-css

,util = require('util')
;

function Typeof(v) {
    var type = {}.toString.call(v);
    return type.slice(8, type.length-1);
}


var options = {
    //transpilers
    less: 'less',
    stylus: 'stylus',
    coffee: 'coffee',
    jade: 'jade',
    //minifiers
    js: 'uglify-js2',
    css: 'clean-css',
    html: 'html-minifier',
   //compressors
    gzip: true,
    disk: 'path/to/dir'
}

var result;
var dest;
//Takes a file or array of files and optionally writes it to dest,
//otherwise returns the result.
function pack(src, someDest) {
    dest = someDest;
    src = (typeof src === 'string')  ? [src] : src;
    // src.forEach(process);
}



//EXAMPLES:
// var source = 'a{font-weight:bold;}';
// var minimized = cleanCSS.process(source);
// console.log(minimized);

// // console.log(util.inspect(minifyHtml));
// var input = '<!-- foo --><div>baz</div><!-- bar\n\n moo -->';
// var html = minifyHtml.minify(input, { removeComments: true }); // '<div>baz</div>'
// console.log(html);

var zipper = {
    gzip: zlib.createGzip
    , deflate: zlib.createDeflate
};
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

function gzip(filename,  transform, method, success, error) {
    fs.readFile(decodeURI(filename), function (err, data) {
        if (err) {
            console.log(err);
            return;
        } 
        data = transform(data.toString());
        console.log(method, zipper[method]());
        zipper[method]()(data, function(err, result) {
            console.log(result);
            if (err) {
                console.log(err);
                return;
            }
            else success(result);
        });
    });
}

var identityPath = Path.resolve(__dirname , 'image.js');
var transform = function(data) {
    return data;
};

gzip(identityPath, transform, 'gzip',og(err);
            return
    function(data) {
        console.log(data);
        // fs.writeFile(path, data, function(err) {
        //     if (err) sendError(req, res, err);
        //     else send();
        // });
    }); 

exports.module = {
    zipperMethods: Object.keys(zipper)
    ,pack: pack
}

