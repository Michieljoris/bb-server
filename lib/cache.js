/*global __dirname:false module:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/ 

var util = require('util');


var max = 5;


function Typeof(v) {
    var type = {}.toString.call(v);
    return type.slice(8, type.length-1);
}

function init(dir, maxObjects, maxObjSize, maxMemObjects, maxMemObjSize){
    
    
}

var lookup = {};
var cache = [];
var mru = -1, lru = 0;

function bridge(val) {
    var prev = val.prev;
    var next = val.next;
    if (prev !== undefined) cache[prev].next = next;
    else lru = next;
    if (next !== undefined) cache[next].prev = prev;
    else mru = prev;
}

function touch(index, val) {
    if (index === mru) return;
    bridge(val);
    val.prev = mru;
    delete val.next;
    cache[mru].next = mru = index;
}

function get(key){
    var index = lookup[key];
    if (index === undefined) return undefined;
    var val = cache[index];
    touch(index, val);
    return val;
}


function put(key, val){
    var index = lookup[key];
    if (index !== undefined) {
        cache[index].val = val;   
        touch(index, cache[index]);
    }
    else {
        val = {
            key: key,
            val: val
        };
        index = cache.length;
        if (index < max) cache.push(val);
        else {
            var lruVal = cache[lru];
            index = lruVal.prev;
            if (index !== undefined) {
                lruVal.prev = cache[index].prev;
                if (lruVal.prev !== undefined) cache[lruVal.prev].next = lru;
            }
            else {
                index = lru;
                lru = cache[lru].next;
                delete cache[lru].prev;
            }
            cache[index] = val;
        }
        if (mru !== -1) {
            val.prev = mru;
            cache[mru].next = index;
        }
        lookup[key] = mru = index;
    }
}

function del(key) {
    var index = lookup[key];
    if (index === undefined) return;
    delete lookup[key];
    var val = cache[index];
    val.deleted = true;
    delete val.key;
    delete val.val;
    bridge(val);
    var lruVal = cache[lru];
    val.prev = lruVal.prev;
    lruVal.prev = index;
    val.next = lru;
    if (val.prev) cache[val.prev].next = index;
}


function out() {
    console.log('mru:', mru);
    console.log('lru:', lru);
    console.log('\nlookup:');
    console.log(util.inspect(lookup));
    console.log('\ncache:\n', util.inspect(cache));
    console.log('\nmru:');
    var prev = mru;
    var i=0;
    while (prev !== undefined && i<20) {
        console.log(i, cache[prev]);
        prev = cache[prev].prev;
        i++;
    }
}
put('a', 'a');
put('b', 'b');
put('c', 'c');
put('d', 'd');
put('e', 'e');
console.log('\ngetting a', get('a'));
console.log('\ngetting e', get('e'));
console.log('\ngetting c', get('c'));
// put('f', 6);
del('a');
del('e');
out();
put('f', 'f');
put('g', 'g');
get('d');
put('h', 'h');
out();

// //str, array, or regexp
// function del(keys){
//     if (!keys) return;
//     if (Typeof(keys) === 'RegExp') {
//         keys = Object.keys(lookup).filter(function(k) {
//             return keys.test(k) ;
//         });
//     }
//     else if (typeof keys === 'string') keys = [keys]; 
//     keys.forEach(function(k) {
//         delete lookup[k];
//     });
// }

// console.log(util.inspect(lookup));

function flush(){
    
}

function list(regExp){
    regExp = regExp || /.*/;
    
}

function stats(){
    return {
        size: Object.keys(lookup).length
    };
}

module.exports = {
    init: init,
    get: get,
    put: put,
    del: del,
    flush: flush,
    list: list,
    stats: stats
};





