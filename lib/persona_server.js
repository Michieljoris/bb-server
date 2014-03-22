/*global process:false require:false exports:false*/
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:7 maxlen:150 devel:true newcap:false*/ 

require('colors');
var https = require('https');

var querystring = require('querystring');
var VOW = require('dougs_vow');
var audience = process.env.AUDIENCE;
var sendMisc = require('./sendMisc');
// var authorizedEmails = require('./authorized_emails').list;

var send; 

function debug() {
    console.log.apply(console, arguments);
}

// var server = require('nano')('http://localhost:5984');
// var db = server.use('personalinfo');

// var db = require('nano')(
//   { "url"             : "http://localhost:5984/personalinfo_users"
//   // { "url"             : "http://michieljoris.iriscouch.com/personalinfo_users"
//   // , "request_defaults" : { "proxy" : "http://someproxy" }
//   , "log"             : function (id, args) { 
//       debug(id, args);
//     }
//   });
var options = {};

var personaOptions = {
    hostname: 'verifier.login.persona.org',
    port: 443,
    path: '/verify',
    method: 'POST'
};

function verifyReq(assertion) {
    var vow = VOW.make();
    var data = querystring.stringify({
        assertion: assertion,
        audience: audience ? audience : 'localhost'
    });
    
    personaOptions.headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': data.length
    };
    
    var req = https.request(personaOptions, function(res) {
        // debug('STATUS: ' + res.statusCode);
        // debug('HEADERS: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        var data = "";
        res.on('data', function (chunk) { data += chunk; });
        res.on('end', function () { 
            // debug('BODY: ' + data);
            try {
                data = JSON.parse(data);
                vow.keep(data);
            } catch(e) {
                debug("non-JSON response from verifier");
                // bogus response from verifier!
                vow['break']("bogus response from verifier!");
            }
        });
    });

    req.on('error', function(e) {
        debug('problem with request: ' + e.message, e);
        vow['break']('problem with request: ' + e.message);
    });
    
    req.write(data);
    req.end();
    return vow.promise;
}

function sendResponse(res, obj) {
    var headers = {'Content-Type': 'text/html'};
    var returnCode = 403;
    var descr = obj.reason;
    if (obj.success) {
        var expireDate = new Date(new Date().getTime() + 24*60*60).toUTCString();
        // headers['Set-Cookie'] = 'persona=' +obj.email + '; expires=' + expireDate;
        returnCode = 200; 
        descr = "OK";
    }
    res.writeHead(returnCode, descr, headers);
    res.write(JSON.stringify(obj));
    res.end();
}

function isValid(data, session) {
    var vow = VOW.make();
    debug(data);
    var valid = data && data.status === 'okay';
    var email = valid ? data.email : null;
    if (valid) {
        debug('assertion verified succesfully for email:', email);
        vow.keep(email);
    }
    else {
        debug("failed to verify assertion:", data.reason);   
        // sendResponse(res, { success: false, reason: data.reason});
        vow['break'](data.reason);
    }
    return vow.promise;
}

function authorizeUser(email) {
    // var vow = VOW.make();
    debug('Checking user\'s email: ' + email);
    try {
    if (options.persona.authorized.indexOf(email) !== -1) {
        debug('Yes, this is an authorized email!!');
        return VOW.kept(email);   
    }
    else {
        debug('Sadly, this email is not authorized..');
        return VOW.broken('Unauthorized email');  
    } 
       } catch(e) {
           debug(e);
       } 
    // db.get(email, function(err, doc, header) {
    //     if (err) {
    //         db.insert({ lastLogin: new Date() }, email, function(err, body, header) {
    //             if (err) { vow['break']("Couldn't add ' + email ' to the user database!! ' + err.reaon"); } 
    
    //             else vow.keep(email);
    //         });
    //     }
    //     else {
    //         doc.lastLogin = new Date();
    //         db.insert(doc, email, function(err, doc, header) {
    //             if (err) { vow['break']("Couldn't add ' + email ' to the user database!! ' + err.reaon"); } 
    //             else vow.keep(email);
    //         });
    //     }
    // });
    
}

function setSession(session, email) {
    var vow = VOW.make();
    if (session) {
        session.set({
            email: email,
            verified: true
        }, function(err) {
            if (!err) {
                debug('session is set for:', email);
                vow.keep(email);
            }
            else {
                debug('Could not save session data!!');
                vow['break']('Could not save session data!!');
            }
        });
    }
    else vow['break']('sessions is not enabled in the server');
    return vow.promise;
}               

function verify(session, assertion, res) {
    verifyReq(assertion).when(
        function(data) {
            return isValid(data, session, res);
        }).when (
            authorizeUser
        ).when(
            function(email) {
                return setSession(session, email);
            }
        ).when(
            function(email) {
                debug('sending success response for email:' , email);
                sendResponse(res, { success: true, email: email });
            },
            function(error) {
                debug('sending failure response');
                sendResponse(res, { success: false, reason: error });
            }
        );
}

module.exports.signin = function(req, res) {
    debug('Signin is handling post!!');
    if (!options.persona) send.forbidden(req, res);
    // debug('x-forwarded-for:' + req.headers['x-forwarded-for']);
    if (!req.session) {
        debug("Please enable sessions for this server to use authentication ".red);
        send.error(req, res, 'Sessions need to be enabled for persona to work');
        return;
    }
    
    req.session.get('email').when(function(email) {
        debug('session email is: ' , email);
    });
    
    var data = '';
    req.on('data', function(chunk) {
        data+=chunk;
    });
    
    req.on('end', function() {
        try {
            data = JSON.parse(data);
            verify(req.session, data.assertion, res);
        } catch(e) {
            sendResponse(res, { success:false, error:'non-JSON received!!!' });
            // res.end();
        } 
    });
        
    req.on('error', function(e) {
        sendResponse(res, { success: false, reason: e });
    });
    
    debug('Verifying assertion!!!');
};

module.exports.signout = function(req, res, options) {
    debug('Signout is handling post!!');
    // debug(req.headers['x-forwarded-for']);
    
    res.writeHead(200, "OK", {'Content-Type': 'text/html'});
    
    var data = '';
    req.on('data', function(chunk) {
        data+=chunk;
    });
    
    req.on('end', function() {
        if (req.session) req.session.expire();
        res.write(JSON.stringify({ success:true }));
        // data = JSON.parse(data);
        // debug(data.assertion);
        res.end();
    });
    
    req.on('error', function(e) {
        req.session.expire();
        res.write(JSON.stringify({ success:true, error:e }));
        res.end();
    });
    
};

module.exports.init = function(someOptions) {
    options = someOptions;
    send = sendMisc(options);
    if (!options.persona.verbose) debug = function() {};
};
