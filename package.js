// This file is the source for constructing a `package.json` file.
// JSON is a wonderful interchange format, but due to the fact that the
// [JSON Specification](http://json.org) does not allow for comments, I find
// it horrid for self documenting examples.
//
// JavaScript allows for comments and inherently allows JSON. This file will
// act as the source for building a `package.json` file that also manages this
// package.
//
// It is the closest I can get to a self-documenting `package.json` file.

// Manually install fs-extra and doccoh before running this file.


// The `package.json` file always consists of one top level object, which is
// what we export here in a [Node.js](http://nodejs.org) friendly way that
// will allow us to build our `package.json` file. A real `package.json` file
// will not contain the `exports = ` definition, nor any of these comments.
module.exports = {
    // Many of the following `package.json` parameters are optional depending
    // on whether or not this package will ever be published, and depending
    // on how much management we want to delegate to npm. I did not mark
    // optional vs. not-optional for the parameters, as a `package.json` file
    // is by its nature always optional.
    
    // Our npm package name needs to be unique only if we are going to publish
    // our package into an npm registry. If we aren't going to publish the 
    // package the name can be anything we want.
    //
    // Leave off redundant affixes like `node-package` or `package-js`. 
    // We know it is JavaScript for Node.
    "name": "bb-server",
    // A single line, or sometimes slightly longer, description of our package.
    "description": "A bare bones http server",
    // [npm](http://npmjs.org) enforces the X.Y.Z semantic version 
    // scheme that is described at [http://semver.org/](http://semver.org/)
    // and we should follow this versioning for our package.
    "version": "0.4.7",
    // URL to the homepage for this package.
    "homepage": "https://github.com/michieljoris/bb-server",
    // An array of keywords used to describe this package to search engines,
    // mainly for people searching within the npm universe.
    "keywords": [
        "server"
    ],
    // Where is the source of truth for this code, and what type of repo is it?
    "repository": {
        "type": "git",
        "url": "https://github.com/michieljoris/bb-server.git"
    },
    // Every package should have at least one author. There are a couple of
    // formats for the author. I prefer the explicit object format as follows:
    "author": {
        "name": "Michiel van Oosten",
        "email": "mail@axion5.net",
        "url": "http://blog.axion5.net/"
    },
    // What licenses govern this code, and where is the license associated
    // with this code?
    // The complex form, "licenses", is an array of objects.
    // The simplest form is "license", and may point to just a string that
    // represents the standard name of the license, like "MIT".
    "licenses": [
        {
            "type": "MIT",
            "url": "http://github.com/michieljoris/url_washer/blob/master/LICENSE.txt"
        }
    ],
    // If there is a file that should be loaded when require()ing this 
    // folder-as-a-package, declare this file here, relative to our package 
    // structure.
    "main": "lib/bb-server",
    // Essentially, which Node.js platforms do we support? These are glob
    // like expressions supported by the 
    // [npm semantic version parser](https://npmjs.org/doc/semver.html), 
    // and the below version means what it looks like: 
    //
    // require a Node.js installation that is greater than or equal to version 0.10.0
    "engines": {
        "node": ">= 0.10.x"
    },
    // What other modules/libraries do we require for our own module?
    // The beauty of this dependencies block is that these modules will
    // be downloaded magically when we run npm install from within our
    // directory. npm itself will sort out any dependency conflicts within
    // our own dependencies and we can be pretty much assured that the
    // modules we need will be ready to run.
    //
    // **NOTE:** We don't have any dependencies for this module. See the
    // `devDependencies` block for the way to include dependencies.
    "dependencies": {
	"websocket": "1.0.x",
	"nodemailer": "0.5.x", 
	"colors": "*",
	"optimist": "0.2.x", //0.6.0
	"portfinder": "~0.2.1",
	"forever-monitor": "1.2.x",
	"mime": "1.2.x",
	"mysql": "0.9.6",
	"bytes": "0.2.x",
        "fs-extra": "0.8.x",
        "escape-html": "1.0.x",
        "MD5": "1.1.x", //1.1.0
        extend: "1.2.x", //1.2.1
        "recaster": "0.2.x", //0.2.1
        "cachejs": "0.1.x",
        "url_washer": "0.2.x",
        "dougs_vow": "0.1.x",
        "node_cloudflare": "0.0.2"
    },
    // What dependencies are useful only for developers?
    // Installed when we `npm install` in our working directory, but not 
    // when people require our package in their own package.json. This is the 
    // usual and accepted place to put test frameworks and documentation
    // tools.
    //
    // The packages we depend on for development:
    //
    // * **fs-extra**: Mixin for the fs (filesystem) module.
    // * **doccoh**: Documentation utility for this code.
    "devDependencies": {
        "fs-extra": "0.3.x",
        "doccoh": "0.4.1"
    },
    // Should this package be prevented from accidental publishing by npm?
    // The default is false (not hidden), but I include this here for doc
    // purposes.
    "private": false,
    // npm has can manage a set of standard and non-standard scripts. The
    // standard set of scripts can be run with: 
    // 
    //     npm standard-script-name
    //
    // The non-standard scripts can be run with:
    // 
    //     npm run-script script-name
    //
    // `dist` is a non-standard script, and can be run with:
    //
    //     npm run-script dist
    "scripts": {
	"start": "./bin/bb-server"
    }
    //commandline:
    ,"bin": {
	"bb-server": "./bin/bb-server"
    }
    // ,"preferGlobal": "true"
};

var pjs = require('./package.json');
var v = pjs.version;
var s = v.split('.');
v = [s[0],s[1],parseInt(s[2]) + 1].join('.');
module.exports.version = v;
console.log(module.exports);

// Small script used to write the package.json file out from the package.js
// file.

var fs = require("fs-extra");
var packagejson = require("./package.js");

console.log("Writing the package.json file out from package.js...");
fs.writeJSONFile("package.json", packagejson, function(err){
    if (err) {
        console.log("Error writing package.json");
        console.log(err);
        console.log("");
    }
    else {
        console.log("package.json written successfully.");
        console.log("");
    }
});
