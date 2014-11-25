// console.log('hello');
// var date;
// for (var i = 0;i<12;i++) {
//     var hour = 3600 * 1000;
//     var day = 24 * hour;
//     var week = 7 * day;
//     var month = (52/12) * week;
    
//     date = new Date( new Date().getTime() + i*day ).toString();
    
//     console.log(date.toString(), date.toString().length);
//     console.log(new Date(Date.parse(date)));
//     console.log('---');
// }


// console.log('   ');
// console.log(Date().length, typeof Date());

// console.log(new Date().toISOString());
// function generateUUID(){
//     var d = Date.now();
//     var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
//         var r = (d + Math.random()*16)%16 | 0;
//         d = Math.floor(d/16);
//         return (c=='x' ? r : (r&0x7|0x8)).toString(16);
//     });
//     return uuid;
// };

// console.log(generateUUID());
// console.log('abc'.slice(10).length)
// var fileName = "filename";
// fileName = 'asdfasdfasasasdfafda' + new Date().toString() + '_' + fileName;
// console.log(fileName.slice(0,39));
// console.log(new Date(Date.parse(fileName.slice(0,39))))

function validSign(str) {
    //you could check whether the date is parseable better, because
    //Date.parse is -very- forgiving, but as long as no file starts
    //with '_signed_' there will be no false positives.
    if (str.length < 49 || str.slice(0, 8) !== '_signed_' ||
        typeof Date.parse(str.slice(8, 47)) !== 'number') return false;
    return true;
}

var fileName = '_signed_' + new Date().toString().slice(3) + '_filename';
console.log(fileName, validSign(fileName));
console.log(typeof new Date);
var a = Date.now();
setTimeout(function() {
    var b = Date.now();
    console.log('nal', b-a);
},100)
console.log('bla',new Date().toUTCString(), new Date());

