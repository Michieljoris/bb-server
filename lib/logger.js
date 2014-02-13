/*global require:false process:false module:false */
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:10 maxlen:150 devel:true newcap:false*/ 

//Adapted and condensed from connect - logger

var bytes = require('bytes');

//Log buffer
var buf = [];
var formats = {};
var tokens = {};

var defaultBufferDuration = 1000;

//TODO option to append on restart of server?
//TODO manage log file size
//Maybe start a new file once it reaches a certain size?
//Or a logfile per day? And delete oldest to make more space?
//With a maximum size, when reached switch to a file per hour?
//maybe compress it?
//use logrotate
// http://linuxers.org/howto/howto-use-logrotate-manage-log-files

/**
 * Logger:
 *
 * Log requests with the options defined in the server config file. 
 *
 * Options:
 *
 *   - `format`  Predefined format or custom format string, see below for tokens
 *   - `stream`  Output stream, defaults to _stdout_
 *   - `buffer`  Buffer duration, defaults to 1000ms when _true_
 *   - `immediate`  Write log line on request instead of response (for response times)
 *
 *   Pre-defined formats that ship with connect:
 *
 *    - `default` ':remote-addr - - [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
 *    - `short` ':remote-addr - :method :url HTTP/:http-version :status :res[content-length] - :response-time ms'
 *    - `tiny`  ':method :url :status :res[content-length] - :response-time ms'
 *    - `dev` concise output colored by response status for development use
 *
 *  Or build a new format string with:
 *
 * Tokens:
 *
 *   - `:req[header]` ex: `:req[Accept]`
 *   - `:res[header]` ex: `:res[Content-Length]`
 *   - `:http-version`
 *   - `:response-time`
 *   - `:remote-addr`
 *   - `:date`
 *   - `:method`
 *   - `:url`
 *   - `:referrer`
 *   - `:user-agent`
 *   - `:status`
 *
 *   Define new tokens in this file (see below)
 *
 *   Pre-define new formats in this file as well (see below)
 *
 */


function compile(fmt) {
    fmt = fmt.replace(/"/g, '\\"');
    var js = '  return "' +
        fmt.replace(/:([-\w]{2,})(?:\[([^\]]+)\])?/g,
        // fmt.replace(/:([\-\w]{2,})(?:\[([^\]]+)\])?/g,
                    function(_, name, arg){
                        return '"\n    + (tokens["' +
                            name + '"](req, res, "' +
                            arg + '") || "-") + "';
                    }) +
        '";';
    return new Function('tokens, req, res', js);
}
        
module.exports = function(options) {
    
    if ('object' === typeof options) {
        options = options || {};
    } else if (options) {
        options = { format: options };
    } else {
        options = {};
    }

    // output on request instead of response
    var immediate = options.immediate;

    // format name
    var fmt = formats[options.format] || options.format || formats['default'];

    // compile format
    if ('function' !== typeof fmt) fmt = compile(fmt);

    // options
    var stream = options.stream || process.stdout
    , buffer = options.buffer;

    // buffering support
    if (buffer) {
        var realStream = stream
        ,interval = 'number' === typeof buffer ?
            buffer
            : defaultBufferDuration;

        // flush interval
        setInterval(function(){
            if (buf.length) {
                realStream.write(buf.join(''));
                buf.length = 0;
            }
        }, interval); 

        // swap the stream
        stream = {
            write: function(str){
                buf.push(str);
            }
        };
    }    
    
    
    return function logger(req, res) {
        req._startTime = Date.now();

        // immediate
        if (immediate) {
            var line = fmt(tokens, req, res);
            if (null === line) return;
            stream.write(line + '\n');
            // proxy end to output logging
        } else {
            var end = res.end;
            res.end = function(chunk, encoding){
                res.end = end;
                res.end(chunk, encoding);
                var line = fmt(tokens, req, res);
                if (null === line) return;
                stream.write(line + '\n');
            };
        }
    };
}; 

//Predefined formats-----------------------------------------
formats['default'] = ':remote-addr - - [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';

formats.short =':remote-addr - :method :url HTTP/:http-version :status :res[content-length] - :response-time ms';

formats.tiny = ':method :url :status :res[content-length] - :response-time ms';

formats.dev = function(tokens, req, res){
    var status = res.statusCode
    , len = parseInt(res.getHeader('Content-Length'), 10)
    , color = 32;

    if (status >= 500) color = 31;
    else if (status >= 400) color = 33;
    else if (status >= 300) color = 36;

    len = isNaN(len) ?
        '' : len = ' - ' + bytes(len);

    return tokens.ip(req) + ' \x1b[90m' + req.method +
        ' ' + (req.originalUrl || req.url) + ' ' +
        '\x1b[' + color + 'm' + res.statusCode +
        ' \x1b[90m' +
        (Date.now() - req._startTime) +
        'ms' + len +
        '\x1b[0m';
};


//Predefined tokens----------------------------------------------------
tokens.url = function(req){
  return req.originalUrl || req.url;
};

tokens.method = function(req){
  return req.method;
};

tokens['response-time'] = function(req){
  return Date.now() - req._startTime;
};

tokens.date = function(){
  // return new Date().toUTCString();
  return new Date().toString();
};

tokens.status = function(req, res){
  return res.statusCode;
};

tokens.referrer = function(req){
  return req.headers.referer || req.headers.referrer;
};

tokens.ip = function(req){
    var ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    if (ip) return ip;
    var sock = req.socket;
    if (sock.socket) return sock.socket.remoteAddress;
    return sock.remoteAddress;
};

tokens['remote-addr'] = function(req){
    if (req.ip) return req.ip;
    var sock = req.socket;
    if (sock.socket) return sock.socket.remoteAddress;
    return sock.remoteAddress;
};

tokens.remoteAddress = function(req){
    return req.connection.remoteAddress;
};

tokens['forwarded-for'] = function(req){
    return(req.headers['x-forwarded-for'] || '').split('] =')[0] || '';
};

tokens['http-version'] = function(req){
  return req.httpVersionMajor + '.' + req.httpVersionMinor;
};

tokens['user-agent'] = function(req){
  return req.headers['user-agent'];
};

tokens.req = function(req, res, field){
  return req.headers[field.toLowerCase()];
};

tokens.res = function(req, res, field){
  return res._headers || {}[field.toLowerCase()];
};


