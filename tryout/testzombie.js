var Chimera = require('chimera').Chimera;

var c = new Chimera();
c.perform({
  url: "http://www.google.com",
  locals: {

  },
  run: function(callback) {
    callback(null, "success");
  },
  callback: function(err, result) {

  }
});



// var Browser = require("zombie")lassert = require("assert");

// // Load the page from localhost
// Browser.debug = true;
// browser = new Browser()
// // browser.visit("http://localhost:8081/")
// // .then(function() {
// //     assert.equal(browser.text("H1"), "Deferred zombies");
// //   }).
// //   fail(function(error) {
// //     console.log("Oops", error);
// //     console.log(browser);
// //   );
// browser.debug = true;

// browser.visit("http://localhost:6001/index.html#!/aboutus#vision", function () {
//     console.log(browser.html());
//   assert.ok(browser.success);
//   if (browser.error )
//     console.dir("Errors reported:", browser.errors);
// })


// Receiving errors
// :
// Cannot read property 'className' of undefined TypeError: Cannot read property 'className' of undefined
//     at parselist (unknown source)
//     at selectnav (unknown source)
//     at unknown source
//     at unknown source
//     at unknown source
//     at sandbox.run (/home/michieljoris/mysrc/javascript/bb-server/node_modules/zombie/node_modules/jsdom/node_modules/contextify/lib/contextify.js:12:24)
//     at Object.module.exports.window._evaluate (/home/michieljoris/mysrc/javascript/bb-server/node_modules/zombie/lib/zombie/window.js:187:25)
//     at Object.HTML.languageProcessors.javascript (/home/michieljoris/mysrc/javascript/bb-server/node_modules/zombie/lib/zombie/scripts.js:23:21)
//     at Object.define.proto._eval (/home/michieljoris/mysrc/javascript/bb-server/node_modules/zombie/node_modules/jsdom/lib/jsdom/level2/html.js:1475:47)
//     at Object.HTML.resourceLoader.load.loaded (/home/michieljoris/mysrc/javascript/bb-server/node_modules/zombie/lib/zombie/scripts.js:74:23)
// Running..
