var buf = [ 31, 139, 8, 0, 0, 0, 0, 0, 0, 3, 149, 84, 193, 110, 156, 48, 16, 189, 231, 43, 16, 199, 42, 107, 216, 182, 91, 169, 145, 26, 181, 106, 114, 136, 212, 109, 15, 237, 173, 170, 34, 219, 204, 130, 19, 240, 80, 219, 203, 130, 162, 244, 219, 107, 27, 86, 224, 117, 246, 16, 46, 160, 153, 121, 243, 158, 223, 140, 121, 186, 72, 236, 147, 74, 218, 64, 122, 149, 164, 140, 173, 52, 168, 14, 84, 122, 57, 38, 10, 208, 92, 137, 214, 8, 148, 46, 255, 37, 97, 84, 65, 194, 80, 130, 78, 42, 99, 218, 36, 44, 183, 159, 122, 42, 205, 201, 123, 146, 31, 227, 21, 54, 208, 210, 210, 115, 56, 152, 190, 202, 178, 82, 152, 106, 207, 8, 199, 38, 107, 4, 175, 4, 212, 15, 168, 132, 206, 34, 13, 143, 48, 28, 80, 21, 218, 130, 127, 251, 136, 143, 78, 53, 62, 240, 103, 170, 84, 208, 162, 22, 6, 213, 96, 107, 159, 230, 90, 51, 180, 158, 218, 82, 78, 77, 125, 120, 175, 234, 87, 9, 34, 14, 239, 225, 207, 19, 33, 221, 155, 10, 85, 72, 118, 244, 114, 59, 246, 72, 58, 42, 147, 31, 168, 13, 200, 37, 55, 52, 84, 120, 118, 247, 254, 76, 123, 235, 218, 134, 72, 56, 167, 207, 202, 99, 53, 150, 100, 46, 204, 66, 37, 181, 224, 32, 53, 132, 38, 205, 170, 2, 27, 182, 119, 191, 22, 52, 47, 80, 157, 115, 194, 86, 221, 31, 168, 174, 64, 57, 53, 44, 107, 168, 61, 150, 202, 190, 221, 125, 189, 253, 254, 243, 150, 152, 126, 178, 199, 11, 11, 38, 99, 79, 233, 183, 162, 22, 44, 30, 48, 200, 82, 72, 47, 125, 105, 35, 22, 94, 236, 245, 167, 36, 39, 235, 156, 244, 225, 121, 11, 104, 65, 22, 32, 185, 56, 5, 114, 202, 43, 120, 112, 193, 244, 205, 210, 205, 3, 48, 141, 252, 209, 90, 108, 51, 107, 226, 58, 94, 134, 116, 110, 20, 160, 198, 229, 221, 132, 105, 142, 53, 170, 184, 39, 218, 155, 209, 8, 109, 70, 204, 219, 16, 211, 162, 50, 59, 97, 69, 250, 150, 255, 92, 126, 189, 204, 239, 80, 129, 117, 97, 213, 160, 116, 59, 59, 202, 58, 233, 209, 136, 113, 153, 226, 196, 160, 255, 214, 35, 237, 71, 242, 97, 153, 97, 131, 129, 88, 233, 78, 175, 160, 55, 138, 70, 9, 123, 193, 105, 11, 171, 202, 52, 245, 139, 198, 40, 224, 126, 202, 17, 112, 123, 179, 137, 98, 243, 130, 68, 169, 2, 247, 165, 190, 239, 240, 16, 43, 232, 237, 221, 40, 198, 240, 201, 140, 187, 155, 179, 99, 94, 30, 40, 39, 239, 66, 209, 5, 114, 142, 213, 241, 55, 180, 14, 219, 182, 74, 116, 212, 56, 91, 119, 180, 214, 48, 69, 199, 255, 220, 9, 137, 54, 84, 249, 225, 146, 140, 9, 185, 216, 220, 160, 33, 243, 187, 189, 128, 205, 117, 103, 161, 23, 207, 255, 1, 206, 76, 181, 213, 123, 5, 0, 0] 
;


var l = new Buffer(4);
l.writeUInt32BE(1921166000,  0);
console.log('l', l);
var r = l.readUInt32BE(0);
console.log(r);
var fs = require('fs-extra');
buf = new Buffer("☃");

console.log(buf, buf.length);
buf = new Buffer(buf);
console.log(buf);
var s = buf.toString();
console.log(s);
// var d = new Buffer(s);
// console.log(d);

var json = {
    a: 'hello',
    b: s
}
// var t = '\u001f';
// console.log(t);
console.log(json);

// fs.outputJson('./bufftest',
//               s,
//               function(err) {
//                   if (err) {
//                       console.log('err', err) ;
//                   }
//                   console.log('done');
//               });
// }
var j2 = fs.readJsonSync('./bufftest');
console.log(new Buffer(s).toString());

// console.log(new Date().toString());

// var Url = require('url');
// var r = Url.resolve('http://localhost:8000', 'hello');
// console.log(r);



// var fs = require('fs-extra');
// var Path = require('path');
// var vow = { keep: function(a) { console.log(a);}
//           ,breek: function(a) { console.log(a); }}
// function readData(path, data, type) {
//     if (data) vow.keep({ srcData: data.toString(), type: type });
//     else {
//         type = Path.extname(path).slice(1);
//         // if (!type) vow.breek('Extension missing: ' + path);
//         fs.readFile(decodeURI(path), function(err, data) {
//             if (err) vow.breek({ path: path, missing: true, recastError: 'Error reading file ' + path + ': ' + err});
//             else vow.keep({ srcData: data.toString(), type: type});
//         });
//     }
// }

// readData('/home/michieljoris/temp/bla')


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
