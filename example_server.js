/*global process:false require:false exports:false*/
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:7 maxlen:150 devel:true newcap:false*/ 

var server = require('./lib/bb-server.js'),
    // testMail = require("./testSendMail"),
    testGet = require("./testGet")
;

 
var options = { 
    "forward": [
	{ "prefix": "local",
	  "target": "http://localhost:5984" },
	{ "prefix": "iris",
          "target": "https://somedb.iriscouch.com"}
    ]
    ,"dir": false
    ,"index": false
    ,"silent": false
    ,"port": 7090
    ,cacheSettings: {
        mimeType: {
            'js': { "max-age": "1m" }
            ,'css': { "max-age": "0m" }
            ,'json': { "max-age": "0m" }
            ,'png': { "max-age": "0m" }
            ,'jpeg': { "max-age": "0m" }
            ,'txt': { "max-age": "0m" }
            ,'ico': { "max-age": "0m" }
    }}
    ,postHandlers: {
        // "/sendmail" : testMail
    }
    
    ,getHandlers: {
        "/testget" : testGet,
        "/testGet" : testGet
    }
    ,sessions: {
        expires: 30
        // ,store: 'mysql'
        ,store: 'memory'
        // ,storeOpts: {
        //     //options for mysql, memory doesn't need any
        // }
    }
    ,log: {
        'format': '',  //Format string, see below for tokens,
        'stream': '',  //Output stream, defaults to _stdout_
        'buffer': '', //Buffer duration, defaults to 1000ms when _true_
        'immediate': ''  //Write log line on request instead of response (for response times)
    }
};

server.go(options);
