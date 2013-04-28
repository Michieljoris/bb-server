/*global process:false require:false exports:false*/
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:7 maxlen:150 devel:true newcap:false*/ 

var server = require('./bb-server.js'),
    testMail = require("./testSendMail"),
    greenglass = require("./greenglass")
;

 
var options = { 
    "forward": [
	{ "prefix": "local",
	  "target": "http://localhost:5984" },
	{ "prefix": "iris",
          "target": "https://michieljoris.iriscouch.com"}
]
    ,"dir": false
    ,"index": false
    ,"silent": false
    ,"port": 7090
    ,postHandlers: {
        "/greenglass" : greenglass,
        "/sendmail" : testMail
        }
};

server.go(options);
