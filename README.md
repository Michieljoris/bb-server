bb-server
===========

Status: still testing features and getting rid of little bugs.

Basic server, configurable by setting commandline options or by requiring
it. The options can then be passed to the server as an object.

It's basically a static assets server however over time I've rewritten it a
couple of times and added some more features.

I am aiming for simplicity. The server can be started without any options and
will serve up its working directory. Any features required can be turned on by
setting options. The whole app is around 2000 lines including comments, the main
logic for serving files less than 400.

Some features:
-----

* Caching of all static resources, in memory (LRU) and on disk.

* Transpiling, minifying and compressing of these assets on the fly, combine
this with caching and only modified assets will be transformed on a request.

* Prerendering. A phantomjs rendered version of a page will be served if page
comes with a query for an escaped fragment. These are also cached then.

* Can serves a single page application

* Start a websocket and/or a https server alongside your http server

* Support for sessions

* You can plugin your own GET and POST handlers triggered by route.

* Deals with favicon.ico requests

* Customized logging of all requests to a log file

* Cache busting by automatically removing stamps

* Standard server features such as setting cache headers and giving a 304
  response to a if-not-modified-since header.
  
* Most options can be set on the command line, all of them using a json configuration
  file. 
  
* Wrapping of js files from a modules directory to denodify them.

The server works really well as a development server since it will only
transform and send files that have changed, and sends a 304 otherwise.

If you turn caching and stamps on, and stamp your requests (as
[html-builder](http://github.com/michieljoris/html-builder) does) does) the
server will only get hit for unstamped files, such as a index.html file, and any
files that have not been cached by the browser or internet. And even then it
will get the files from its memory and disk caches if the resource has not been
changed since it was cached by bb-server.

The difference between this server and other build tools is that files are only
transformed once they are requested, not when the resource gets saved. This is
not inefficient because the resulting js/css/html file is cached by the browser,
proxies on the net and ultimately by the server itself using a
[LRU cache](http://github.com/michieljoris/cachejs) memory cache. If it's not in
its memory cache it will get it from its disk cache, and if not there either
only then will the server retransform the file. For instance from source.coffee,
to source.js to source.js (minified) to source.js (gzipped).

The cool thing is that you can request for instance coffee files directly in
your html, as long as you set the type, for instance:

    <script type="text/javascript" src="scripts/test.coffee"></script>
	
Same goes for for instance sass and jade files. You could even serve a
index.jade file by default, just set the index option to 'index.jade'.

There's not much difference between production and development mode, except
perhaps you don't want to minify your assets when developing.

To play around with the server set up a [js-project](https://github.com/michieljoris/js-project).
	
Install
----

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
		  
See the example-server.js file for an example of requiring the server in your
own module and [documentation](http://rawgithub.com/Michieljoris/bb-server/master/docs/example-server.html) for most of the options.

TODO:
* enable source maps
* transforming is one to one at the moment. When a transform depends on multiple
  files to produce the requested file (like sass) changes in the dependent files won't
  trigger a recompile (see
  [brocoli](http://www.solitr.com/blog/2014/02/broccoli-first-release/)). This
  could be fixed however.
* optimize images on the fly
* api/ui for viewing/retrieving server logs and status
* rewrite async logic using generators and promises
* make sure to send 404's when prerendering generates a 404 page
* security
* send cors headers?
* add auth support (sign in with google, github, persona etc)
* unify log messages into one system, use logrotate and/or winston
* serve fancy dir
* send script to refresh browser from emacs, or on save etc
* see bb-server.org

Ideas:
* send diffs of files?
* share js files between server and client

