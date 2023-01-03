/*
@author : Thibault GRAND
@date : 2019-05-01
@description : utilisez le drone avec scratch
 */

const http = require("http");
const url = require("url");
const dgram = require("dgram");

const TELLO_HOST = "192.168.10.1"; //default ip address of the tello
const TELLO_PORT = 8889; //default tello port

const SCRATCH_LISTEN_HOST = "127.0.0.1"; //default ip address of the scratch (local pc)
const SCRATCH_LISTEN_PORT = 8001; //default scratch port

const showLog = msg => {
  const dateString = new Date().toISOString();
  console.log(dateString + " " + msg);
};

const showScratchLog = msg => {
  showLog("[Scratch - LOCAL] " + msg);
};

const showTelloLog = msg => {
  showLog("[Tello - provenant du drone] " + msg);
};

// UDP (Helper <-> Tello)
const socket = dgram.createSocket("udp4");

var busyId = null;
var speed = 100.0; // cm/s
var lastCommand ="";
var batteryPower='20';
var polling = "";

socket.on("listening", () => {
  showTelloLog("Ecoute sur le port UDP");
  showLog("TelloScratchHelper.js est pret");
});

socket.on("message", (msg, rinfo) => {
	if ( polling=="poll" ) return;
	if (lastCommand == 'battery?' && !isNaN(msg.toString('utf8'))){
//	 console.log("battery=%s",msg.toString('utf8') );
     batteryPower=msg.toString('utf8');

  }
  showTelloLog("=> " + decodeURIComponent(msg));
  //showTelloLog("=> " + JSON.stringify(rinfo))
});

socket.on("error", (err) => {
    showTelloLog("Erreur lors du lancement: ");
  showTelloLog(err.name + ": " + err.message);
})

socket.on("close", () => {
  showTelloLog("Fermeture du programme.")
})

const sendToTello = msg => {
  socket.send(msg, TELLO_PORT, TELLO_HOST, (error, bytes) => {
	  if (polling=="") {
	  showTelloLog("<= " + msg); }
	lastCommand=msg;
  });
};

socket.bind(TELLO_PORT);



const directionMapping = {
  forward: "f",
  backward: "b",
  left: "l",
  right: "r"
};

// HTTP (Scratch <-> Helper)
http
  .createServer((req, res) => {
    const requestUrl = url.parse(req.url);
    const pathname = decodeURIComponent(requestUrl.pathname);
    const paths = pathname.split("/");

    if (!requestUrl.pathname.startsWith("/poll")) {
      showScratchLog("=> " + pathname);
    }
	if (paths[1] == "poll" ){
	polling = "poll" ; }
	else {
	polling = "" ; 
	}

    switch (paths[1]) {
      case "poll":
        if (busyId == null) {
			sendToTello("command");
			sendToTello("battery?");
			var data = "power " + batteryPower + "\n" + "speed " + speed + "\n"
			res.end(data);
//			console.log("power " + batteryPower + "\n" );
        } else {
          var data = "_busy " + busyId;
          //showScratchLog("<= " + data);
          res.end(data);
        }
        return;

      case "reset_all":
        var data = "dummy 20";
        showScratchLog("<= " + data);
        res.end(data);
        return;

      case "takeoff":
        jobId = paths[2];
        busyId = jobId;
        var data = "OK " + jobId;
        setTimeout(() => (busyId = null), 6000);
        sendToTello("command");
        sendToTello("speed?")
        sendToTello("battery?")
        //sendToTello("speed " + speed);
        sendToTello("takeoff");
        res.end(data);
        showScratchLog("<= " + data);
        return;

      case "land":
        jobId = paths[2];
        busyId = jobId;
        var data = "OK " + jobId;
        setTimeout(() => (busyId = null), 6000);
        sendToTello("land");
        res.end(data);
        showScratchLog("<= " + data);
        return;

      case "up":
      case "down":
      case "left":
      case "right":
      case "forward":
      case "back":
        jobId = paths[2];
        busyId = jobId;
        length = parseInt(paths[3]);

        if (length >= 20 && length <= 500) {
          executionTimeInMillis = (1000 * length / speed) * 1.8;
          setTimeout(() => (busyId = null), executionTimeInMillis);
          sendToTello(paths[1] + " " + paths[3]);
          var data = "OK " + jobId;
          res.end(data);
          showScratchLog("<= " + data);
        } else {
          busyId = null;
          var data = "_problem Length is out of range (20-500)";
          res.end(data);
          showScratchLog("<= " + data);
        }
        return;

      case "cw":
      case "ccw":
        jobId = paths[2];
        busyId = jobId;
        degree = parseInt(paths[3]);
        if (degree >= 1 && degree <= 3600) {
          rotationSpeed = 60; // degree/s
          executionTimeInMillis = 1000 * degree / rotationSpeed + 1000;
          setTimeout(() => (busyId = null), executionTimeInMillis);
          sendToTello(paths[1] + " " + paths[3]);
          var data = "OK " + jobId;
          res.end(data);
          showScratchLog("<= " + data);
        } else {
          busyId = null;
          var data = "_problem Degree is out of range (1-3600)";
          res.end(data);
          showScratchLog("<= " + data);
        }
        return;

      case "flip":
        jobId = paths[2];
        busyId = jobId;
        requestedDirection = paths[3];
        var direction;
        if (requestedDirection in directionMapping) {
          direction = directionMapping[requestedDirection];
        } else {
          direction = requestedDirection;
        }
        setTimeout(() => (busyId = null), 2500);
        sendToTello("flip " + direction);
        var data = "OK " + jobId;
        res.end(data);
        showScratchLog("<= " + data);
        return;

      case "setspeed":
        jobId = paths[2];
        busyId = null;
        requestedSpeed = parseInt(paths[3]);
        if (requestedSpeed >= 1 && requestedSpeed <= 100) {
          speed = requestedSpeed;
        }
        sendToTello("speed " + speed);
        data = "OK";
        res.end(data);
        showScratchLog("<= " + data);
        return;
    }
  })
  .listen(SCRATCH_LISTEN_PORT, SCRATCH_LISTEN_HOST);

showScratchLog(
  "Listening HTTP on " + SCRATCH_LISTEN_HOST + ":" + SCRATCH_LISTEN_PORT
);
