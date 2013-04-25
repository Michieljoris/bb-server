/*global process:false require:false exports:false*/
/*jshint strict:false unused:true smarttabs:true eqeqeq:true immed: true undef:true*/
/*jshint maxparams:7 maxcomplexity:7 maxlen:150 devel:true newcap:false*/ 

var nodemailer = require("nodemailer");

// create reusable transport method (opens pool of SMTP connections)
var smtpTransport = nodemailer.createTransport("SMTP",{
    service: "Gmail",
    auth: {
        user: "michieljoris@gmail.com",
        pass: "Thismy1aosp."
    }
});


// send mail with defined transport object
function sendMail(mailOptions) {
    smtpTransport.sendMail(mailOptions, function(error, response){
        if(error){
            console.log(error);
        }else{
            console.log("Message sent: " + response.message);
        }

        // if you don't want to use this transport object anymore, uncomment following line
        //smtpTransport.close(); // shut down the connection pool, no more messages
    });
    
}

exports.send = function (data) {
    console.log("Sending email!!!!");
    var text = data.username + " with email address " + "<a href='mailto:" + data.email + "'>" + data.email + "</a>" +
        " sent the following message: <p>" + data.textmessage;
    // setup e-mail data with unicode symbols
    var mailOptions = {
        from: "Firstdoor Server", // sender address
        to: "firstdoortraining@gmail.com", // list of receivers
        subject: data.username + " has used the Greendoor contact us form!", // Subject line
        // text: data.message // plaintext body
        html: text // html body
    };
    sendMail(mailOptions);
};
