/*global phantom:false require:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:8 maxlen:150 devel:true newcap:false*/ 
var page = require('webpage').create();
page.viewportSize = { width: 1900, height: 1200};
page.settings.loadImages = false;
// page.settings.javascriptEnabled = false;

var system = require('system');
var lastReceived = new Date().getTime();
var requestCount = 0;
var responseCount = 0;
var requestIds = [];
var minResponses = 0;
var debug = true;
//TODO use system.env to set some variables, but for now:
var delay = 100;

// var initialRequest = null; //not used
var initialResponse = null;
var startTime = new Date().getTime();

page.onResourceRequested = function (request) {
    // console.log('Request (#' + request.id + '): ' + JSON.stringify(request));
  // initialRequest = initialRequest || request;
  if(requestIds.indexOf(request.id) === -1) {
    requestIds.push(request.id);
    requestCount++;
  }
};
page.onResourceReceived = function (response) {
  initialResponse = initialResponse || response;
  if(requestIds.indexOf(response.id) !== -1) {
      if (responseCount === 1) { // second response
          minResponses = requestCount;
      }
    lastReceived = new Date().getTime();
    responseCount++;
    requestIds[requestIds.indexOf(response.id)] = null;
  }
};

page.open(system.args[1]);

var checkComplete = function () {
    var timeDiff = new Date().getTime() - lastReceived;
    if(responseCount >= minResponses &&
       timeDiff > delay &&
       requestCount === responseCount ||
       new Date().getTime() - startTime > 5000)  {
        clearInterval(checkCompleteInterval);
        console.log(JSON.stringify(initialResponse) + "\n\n");
        if(initialResponse && initialResponse.contentType === "text/plain") {
            console.log(page.plainText);
        } else {
            console.log(page.content);
        }
        phantom.exit();
    } else {
        if (timeDiff > delay) {
            if (debug) {
                console.error(
                    'requestCount: ' + requestCount +
                        ' !== responseCount: ' + responseCount + '.' +
                        ' You might have a synchronous ajax call that is NOT being captured by onResourceReceived.' +
                        ' See: https://github.com/ariya/phantomjs/issues/11284'
                );
                console.error('FORCED EXIT STATUS 10. Incomplete in ' + timeDiff + ' seconds.');
            }
            phantom.exit(10);
        }
        
        
        }
};

var checkCompleteInterval = setInterval(checkComplete, 100);
