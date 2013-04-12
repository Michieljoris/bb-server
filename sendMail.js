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

exports.send = function () {
    console.log("Sending email!!!!");
    // setup e-mail data with unicode symbols
    var mailOptions = {
        from: "Firstdoor  <firstdoortraining@gmail.com>", // sender address
        to: "michieljoris@gmail.com", // list of receivers
        subject: "Test of sendMail!!!  Hello ✔", // Subject line
        text: "Hello world", // plaintext body
        html: "<b>Hello world ✔</b>" // html body
    };
    sendMail(mailOptions);
};
