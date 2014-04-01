/*global module:false require:false*/
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:7 maxlen:150 devel:true newcap:false*/ 


var http = require('http');
var url = require('url');
var persona = require('./persona_server');
var options = {};

var handlers = {
    GET: {
    },
    POST: {
        //Persona
        'signin': persona.signin,
        'signout' : persona.signout
    }
};

module.exports.init = function(someOptions) {
    options = someOptions;
    persona.init(options);
    var apiPath = '/' + options.api + '/';
    // console.log('API', apiPath);
    return function(method, path) {
        if (path.indexOf(apiPath) !== 0) return false;
        path = path.slice(7);
        return handlers[method] ? handlers[method][path] : undefined;
    };
};

