var fs = require('fs');
var util = require('util');

fs.stat('./test.json', function(err, stat) {
    console.log(util.inspect(stat));
})



// function Typeof(v) {
//     var type = {}.toString.call(v);
//     return type.slice(8, type.length-1);
// }
// var a = Typeof(new Date());
// // a = toType.call({});
// // a = toType.call(/bla/);
// // a = toType.call(2);
// console.log(a);
