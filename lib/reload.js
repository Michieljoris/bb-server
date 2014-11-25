var browsers = [];
var reload =  {
    message: function (websocket, message, clientId) {
        if (message.indexOf('browser') === 0) {
            console.log('Browser connected', clientId);
            browsers[clientId] =  websocket;
            websocket.send('Connected to bb-server');
            // setTimeout(function() {
            //     delete browsers[clientId];
            //     console.log('Browser connection ' + clientId + ' closed');
            // }, 10*3600*1000);
        } 
    
        if (message === 'reload') {
            console.log('Sending reload msg to browser');
            if (browsers.length === 0) console.log('No browser connected');
            else Object.keys(browsers).forEach(function(k) {
	        console.log(k, browsers[k]._socket ? browsers[k]._socket.writable: ' no socket');
	        if (!browsers[k]._socket) delete browsers[k];
	        else browsers[k].send("reload");   
            });
        }
    
    },
    close: function(clientId) {
        if (browsers[clientId]) {
            delete browsers[clientId];
            console.log('Browser connection ' + clientId + ' closed');
        }
    }
    ,id: 'reload'
};

module.exports = reload; 
