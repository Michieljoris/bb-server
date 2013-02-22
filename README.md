http-server
===========

Basic node server with forwarding to couchdb to get around the Access-Control-Allow-Origin.

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
