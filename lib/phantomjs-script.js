var page = require("webpage").create();
var homePage = "http://localhost:6001";
var fs = require("fs");
// page.settings.javascriptEnabled = false;
page.settings.loadImages = false;
page.open(homePage);
page.onLoadFinished = function(status) {
    var url = page.url;
    console.log("Status:  " + status);
    console.log("Loaded:  " + url);
    var file = fs.open("output.htm", "w");
 
    file.write(page.content);
    file.close();
    page.render("google.png");
    phantom.exit();
};
