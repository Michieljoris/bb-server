var fs = require('fs-extra');
var Path = require('path');
var vow = { keep: function(a) { console.log(a);}
          ,breek: function(a) { console.log(a); }}
function readData(path, data, type) {
    if (data) vow.keep({ srcData: data.toString(), type: type });
    else {
        type = Path.extname(path).slice(1);
        // if (!type) vow.breek('Extension missing: ' + path);
        fs.readFile(decodeURI(path), function(err, data) {
            if (err) vow.breek({ path: path, missing: true, recastError: 'Error reading file ' + path + ': ' + err});
            else vow.keep({ srcData: data.toString(), type: type});
        });
    }
}

readData('/home/michieljoris/temp/bla')


// var Path = require('path');
// var r = Path.join('/a/b/root' ,'/../../');

// console.log(r);


// var mime = require('mime');
// mime.default_type = false;
// var m = mime.lookup('.js');
// console.log('mime thype:', m);


// var Path = require('path');
// var r = Path.resolve('/a/../b/../c');
// console.log(r);


// var d = Date.parse(undefined);
// console.log(d>Infinity);
// console.log(undefined !== null);

// var 
//     extend = require('extend'),
//     Url = require('url');
// // var a = extend({}, {a:1}, {a:12});
// // console.log(a);

// var r = Url.parse('bla?a=b#hash#h2');
// // console.log(r);

// var arguments = [1,2,3]

// // function test() {
// //     var args = Array.prototype.slice.call(arguments);
// //     args = [5,6].concat(args);
// //     console.log(args);
// // }
// // test(1,2,3);

// function bind(f, req, res) {
//     return function() {
//         var args = Array.prototype.slice.call(arguments);
//         args = [ req, res ].concat(args);
//         f.apply(this, args);
//     };
// }

// function test(a,b,c,d) {
//     console.log(a,b,c,d);
//     console.log('this:', this);
// }

// // test(1,2,3,4);
// var o = { 'bla': 1 };
// o.t2 = bind(test, 5,6);
// o.t2(7,8);
