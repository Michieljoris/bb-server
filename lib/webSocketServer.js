//For more info:
// https://github.com/einaros/ws

function debug() {
    console.log.apply(console, arguments);
}

/**
 * WebSocket server
 */
function init(httpServer, options) {
    "use strict";
    // console.log('Started websocket server');
    if (!options.verbose) debug = function() {};
    var handlers = options.handlers;
    // console.log(handlers.map(function(h) { return h.id; }));
    // WebSocket server is tied to a HTTP server. WebSocket request is just
    // an enhanced HTTP request. For more info http://tools.ietf.org/html/rfc6455#page-6
    var WebSocketServer = require('ws').Server;
    var wss = new WebSocketServer({ server : httpServer } );
    
    // list of currently connected clients (users)
    // var clients = [ ];
    
    var clientId = 0;
    wss.on('connection', function(websocket) {
        // console.log(websocket._socket);
        // var clientId = clients.push(websocket) - 1;
        clientId++;
        
        debug((new Date()) + ' Connection opened: ' + clientId );
        websocket.on('message', function(message) {
            debug('received: %s', message);
            handlers.forEach(function(h) {
                if (h.message) h.message(websocket, message, clientId);
            });
        });
        
        websocket.on('close', function() {
            debug('Connection ' + clientId + ' closed');
            
            handlers.forEach(function(h) {
                if (h.close) h.close(clientId);
            });
        }); 
    
        websocket.on('error', function(e) {
            debug('Error with connection ' + clientId, e.message);
        }); 
    });

}

exports.init = init;

//Example client
// var WebSocket = require('ws');
// var ws = new WebSocket('ws://www.host.com/path');
// ws.on('open', function() {
//     ws.send('something');
// });
// ws.on('message', function(data, flags) {
//     // flags.binary will be set if a binary data is received
//     // flags.masked will be set if the data was masked
// });
