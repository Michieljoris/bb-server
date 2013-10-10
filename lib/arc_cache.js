/*global module:false require:false*/
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/ 

// paper:
// http://domino.research.ibm.com/library/cyberdig.nsf/papers/D6FE9A14C67AB32E85256CE500621A9A/$File/rj10284.pdf
// wikipedia:
// http://en.wikipedia.org/wiki/Adaptive_Replacement_Cache
// overview with slides:
// http://u.cs.biu.ac.il/~wiseman/2os/2os/os2.pdf
// articles:
// http://dbs.uni-leipzig.de/file/ARC.pdf
// https://www.dropbox.com/sh/9ii9sc7spcgzrth/Zf2HHzyXFS/Papers/oneup.pdf
// https://www.dropbox.com/sh/9ii9sc7spcgzrth/VcpfMCYyWF/Papers/arcfast.pdf

// javascript implementation:
// https://gist.github.com/kriskowal/4409155
// python implementation:
// http://code.activestate.com/recipes/576532/

var cache = require('./lru_cache');

var c = 10;
var l = c/2;
var t1 = cache(l);
var t2 = cache(l);
var b1 = cache(l);
var b2 = cache(l);
var p = 0; //0<p<c

function replace(key) {
    if (t1.length() &&
        ((b2.has(key) && t1.length() === p) ||
         (t1.length() > p))
       )
    // if (t1.length() && t1.length() >= target)
        b1.put(t1.delLru());
    else b2.put(t2.delLru());
}


function get(key) {
    var val = t1.has(key);
    if (val){
        t2.put(key, val.val);
        t1.del(key); 
        return val.val;
    }
    else {
        val = t2.get(key);
        if (val) return val;
    }
    if (b1.has(key)) {
        p = Math.min(p + Math.min(b2.length()/b1.length(), 1), c);
        replace(key);
    }
    else if (b2.has(key)) {
        p = Math.max(p - Math.max(b1.length()/b2.length(), 1), 0);
        replace(key);
    }
    
}

function put(key, value) {
    var val = t1.has(key);
    if (val){
        t2.put(key, val);
        t1.del(key); 
        return;
    }
    else {
        val = t2.has(key);
        if (val) { t2.put(key, val);
                   return;
                 } 
    }
    if (b1.has(key)) {
        //moves p more to the right the bigger b2 is compared to b1
        p = Math.min(p + Math.max(b2.length()/b1.length(), 1), c);
        replace(key);
        b1.del(key);
        t2.put(key,val);
    }
    else if (b2.has(key)) {
        //moves p more to the left the bigger b1 is compared to b2
        p = Math.max(p - Math.max(b1.length()/b2.length(), 1), 0);
        replace(key);
        b2.del(key);
        t2.put(key,val);
    }
   ////// 
     if (t1.length()() + b1.length()() === c) {
        if (t1.length() < c) {
            b1.delLru();
            replace(key);
        } else {
            t1.delLru();
        }
     } else {
         var total = t1.length() + b1.length() + t2.length() + b2.length();
         if (total >= c) {
             if (total === c * 2) {
                 b2.delLru();
             }
             replace(key);
         }
    t1.put(key, value);
}

module.exports = {
    
};
