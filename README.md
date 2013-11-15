bb-server
===========

Status: still testing features and getting rid of little bugs.

Basic server, configurable by setting commandline options or by
requiring it. The options can then be passed to the server as an
object.

It's basically a static assets server however over time I've
rewritten it a couple of times and added some more features. 

I am aiming for simplicity. The server can be started without any
options and will serve up its working directory. Any features required
can be turned on by setting options. The whole app is around 2000
lines including comments, the main logic for serving files less than
400.

Some features:

* Caching of all static resources, in memory (LRU) and on disk.

* Transpiling, minifying and compressing of these assets on the fly,
combine this with caching and only modified assets will be transformed
on a request.

* Prerendering based on fragment, hashbangs and bot requests. These are
also cached then.

* Serves a single page application

* Start a websocket and/or a https server alongside your http server

* Support for sessions

* You can plugin your own GET and POST handlers triggered by route.

* Deals with favicon.ico requests

* Customized logging of all requests to a log file

* Cache busting by automatically removing stamps

You can also use npm however that might not be the latest version.

To install clone it, cd into the directory and do:
 
	npm install

Then ./bin/bb-server to run it.

Or do:

	npm install -g bb-server
	
Then bb-server to run.

You can also install it directly from npm:

	npm install bb-server
	
	  
Execute bb-server -h for a list of command line options.
		  
See the example_server.js file for an example of requiring the server
in your own module and documentation for most of the options. 


TODO:
* optimize images on the fly
* api/ui for viewing/retrieving server logs and status
* rewrite async logic using generators and promises
* make sure to send 404's when prerendering generates a 404 page
* bots are regexed, however you could consult a database (
  https://github.com/GUI/uas-parser) and or even idenity googlebot by
  ip
* security
* send cors headers?
* add auth support (sign in with google, github etc)
* unify log messages into one system
* serve fancy dir
* send script to refresh browser from emacs, or on save etc

Ideas:
* send diffs of files?
* share js files between server and client
