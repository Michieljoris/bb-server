/*global module:false*/
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/ 

//simple LRU implementation using arrays:
// http://www.senchalabs.org/connect/staticCache.html

//lru implementation using doubly linked lists:

//TODO remove large entries over a certain threshold before lru
//TODO keep a value in cache no matter what if its flag is set

function getCache(someMaxLen, someMaxSize){
    
    var lookup;
    var cache;
    var mru, lru;
    
    var maxLen, maxSize;
    maxLen = someMaxLen;
    maxSize = someMaxSize;
    var length = 0;

    function bridge(val) {
        var prev = val.prev;
        var next = val.next;
        if (prev !== undefined) cache[prev].next = next;
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
    
    function has(key){
        var index = lookup[key];
        if (index === undefined) return undefined;
        return cache[index];
    }
    

    function put(key, val, size){
        if (size > maxSize) return undefined;
        var index = lookup[key];
        if (index !== undefined) {
            cache[index].val = val;   
            touch(index, cache[index]);
            return 'updated';
        }
        else {
            val = {
                key: key,
                val: val,
                size: size
            };
            index = cache.length;
            if (index < maxLen) cache.push(val);
            else {
                var lruVal = cache[lru];
                index = lruVal.prev;
                if (index !== undefined) {
                    lruVal.prev = cache[index].prev;
                    if (lruVal.prev !== undefined) cache[lruVal.prev].next = lru;
                }
                else {
                    delete lookup[lruVal.key];
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
        length++;
        return 'added';
    }

    function del(key) {
        var index = lookup[key];
        if (index === undefined) return undefined;
        delete lookup[key];
        var val = cache[index];
        delete val.val;
        bridge(val);
        if (lru === index) lru = val.next;
        var lruVal = cache[lru];
        val.prev = lruVal.prev;
        lruVal.prev = index;
        val.next = lru;
        if (val.prev) cache[val.prev].next = index;
        length--;
        return key;
    }
    
    function Typeof(v) {
        var type = {}.toString.call(v);
        return type.slice(8, type.length-1);
    }
    
    //str, array, or regexp
    function delWrapper(keys){
        if (!keys) return;
        if (Typeof(keys) === 'RegExp') {
            keys = Object.keys(lookup).filter(function(k) {
                return keys.test(k) ;
            });
        }
        else if (typeof keys === 'string') keys = [keys]; 
        keys.forEach(function(k) {
            del(k);
        });
    }

    function flush(){
        lookup = {};
        cache = [];
        mru = -1, lru = 0;
    }

    function list(regExp){
        // console.log('lru', lru);
        // console.log('mru', mru);
        // console.log(lookup);
        // console.log(cache);
        regExp = regExp || /.*/;
        var result = [];
        var prev = mru;
        if (prev === -1) return [];
        var i=0;
        while (i < maxLen) {
            var entry = cache[prev];
            if (regExp.test(entry.key)) result.push(entry.key);
            i++;
            if (prev === lru) return result;
            prev = entry.prev;
        }
        return result;
    }

    function stats(){
        return {
            len: Object.keys(lookup).length,
            size: (function() {
                return cache.reduce(function(s, e) {
                    return (e.size || 0) + s; 
                }, 0);
            })()
        };
    }
    
    function delLru() {
        // var index = lru;
        // var val = cache[index];
        // var key = val.key;
        // delete lookup[key];
        // // val.deleted = true;
        // // delete val.key;
        // delete val.val;
        // bridge(val);
        // var lruVal = cache[lru];
        // val.prev = lruVal.prev;
        // lruVal.prev = index;
        // val.next = lru;
        // if (val.prev) cache[val.prev].next = index;
        // length--;
        // return key;
        // or:
        var val = cache[lru];
        return del(val.key);
    }

    flush();
    
    return {
        get: get,
        put: put,
        del: delWrapper,
        flush: flush,
        list: list,
        stats: stats,
        length: function() { return length; },
        delLru: delLru,
        has: has
    };
}

module.exports = getCache;
