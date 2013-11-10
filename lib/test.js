var Path = require('path');
var r = Path.resolve('/a/../b/../c');
console.log(r);


var d = Date.parse(undefined);
console.log(d>Infinity);
console.log(undefined !== null);

var 
    extend = require('extend'),
    Url = require('url');
// var a = extend({}, {a:1}, {a:12});
// console.log(a);

var r = Url.parse('bla?a=b#hash#h2');
// console.log(r);

var arguments = [1,2,3]

// function test() {
//     var args = Array.prototype.slice.call(arguments);
//     args = [5,6].concat(args);
//     console.log(args);
// }
// test(1,2,3);

function bind(f, req, res) {
    return function() {
        var args = Array.prototype.slice.call(arguments);
        args = [ req, res ].concat(args);
        f.apply(this, args);
    };
}

function test(a,b,c,d) {
    console.log(a,b,c,d);
    console.log('this:', this);
}

// test(1,2,3,4);
var o = { 'bla': 1 };
o.t2 = bind(test, 5,6);
o.t2(7,8);
