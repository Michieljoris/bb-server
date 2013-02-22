http-server
===========

Basic node server with forwarding to couchdb to get around the
Access-Control-Allow-Origin, cobbled together from a few basic html
servers written by other people. The couchdb forwarding comes from a
cloudant faq, the commandline interface from
[http-server](https://github.com/nodeapps/http-server), the basic
server I've forgotten where it came from. 

I've adapted it here and there to suit my purposes which is a quick
and dirty node html server. You can have this server forward requests
to a couchdb server, which is handy because now you can interface with
a couchdb that's from a different origin than your website/app.

usage: http-server [path] [options]

    options:
      -p                 Port to use [HTTPSERVER_PORT || 8080]
      -a                 Address to use [HTTPSERVER_IPADDR || 0.0.0.0]
      -d                 Display directories
      -i                 Show index.htm[l] when present in directory
      -f --forward       Forward url/prefix to target
      --prefix          [db]
      --target          [http://localhost:5984]
      -s --silent        Suppress log messages from output
      -h --help          Print this list and exit.
