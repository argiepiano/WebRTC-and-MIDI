/* See also:
    http://www.html5rocks.com/en/tutorials/webrtc/basics/
    https://code.google.com/p/webrtc-samples/source/browse/trunk/apprtc/index.html

    https://webrtc-demos.appspot.com/html/pc1.html
*/
// version 6


/* MIDI STUFF */
// Initialize the MIDI system
$("#main").hide();

var midiInput, midiOutput, midi, midiInputConnectionState, midiOutputConnectionState;

//navigator.requestMIDIAccess()
//  .then(
//    onsuccesscallback,
//    function onerrorcallback( err ) {
//      console.log("uh-oh! Something went wrong!  Error code: " + err.code );
//    }
//  );
//  
//function onsuccesscallback(midiAccess) {
//  if (midiAccess) {
//    midi = midiAccess;
//    midi.onstatechange = onMidiStateChange;
//    initMIDIOutput();
//    initMIDIInput();
//    
//  }
//  else {alert("Something is very wrong")}
//}
//
//function onMidiStateChange(event) {
//  var port = event.port;
//  console.log("Type: " +port.type);
//  console.log("State: " + port.state);
//  console.log("Connection: "+port.connection);
//  if (port.type == "input") {   
//    if (midiInputConnectionState != port.state)  {  // when midi listener is established, the statechange fires with the same state
//      console.log("Re-init MIDI input");
//      initMIDIInput();
//    }
//  }
//  if (port.type == "output") {
//    if (midiOutputConnectionState != port.state)  {
//      console.log("Re-init MIDI output");
//      initMIDIOutput();
//    }
//  }
//}
//
//// Initialize input port
//function initMIDIInput() {
//  var midiInputIDs = [];
//  $("#midi-inputs").empty();
//  midi.inputs.forEach(function(port){
//    console.log("Available input:", port.name);
//    midiInputIDs.push(port.id);
//    $("#midi-inputs").append($("<option />", {
//        value: port.id,
//        html: port.name
//    }));
//  });
//  midiInput = midi.inputs.get(midiInputIDs[0]);
//  if (midiInput) {
//    midiInputConnectionState = midiInput.state;
//    console.log("Selected input:", midiInput.name);
////     midiInput.onmidimessage = onMidiMessage;  // this listener should only be enabled after there is a connection
//  } else {
//     console.log("No MIDI input devices connected.");
//  }
//}       
//function initMIDIOutput() {
//  midiOutputIDs = [];
//  $("#midi-outputs").empty();
// // get midiOutputs
//  midi.outputs.forEach(function(port){
//    console.log("Available output:", port.name);
//    midiOutputIDs.push(port.id);
//    $("#midi-outputs").append($("<option />", {
//      value: port.id,
//      html: port.name
//    }));
//  });
//  midiOutput = midi.outputs.get(midiOutputIDs[0]);
//  if (midiOutput) {
//    midiOutputConnectionState = midiOutput.state;
//    console.log("Selected output:", midiOutput.name);
//  } else {
//     console.log("No MIDI output devices connected.");
//  }
//}
//
//// Handler for incoming midi messages
//function onMidiMessage(receivedEvent) {
//  if ((receivedEvent.data[0] & 0xf0) != 0xF0) { // filter out SysEx messages, Active Sensing and other undesired messages.
//    console.log("Sent midi: " + JSON.stringify(receivedEvent.data));
//    var channel = new RTCMultiSession();
//    channel.send({
//      message: receivedEvent.data,
//      type: "midi"
//    });
//  }
//}

/* End of MIDI Stuff */


/*  --------FIREBASE STUFF--------- */

// Initialize Firebase
var config = {
    apiKey: "AIzaSyDW7EytZnIQCH_45G3e7UobA17XAyJ5HGE",
    authDomain: "webrtc-6c37f.firebaseapp.com",
    databaseURL: "https://webrtc-6c37f.firebaseio.com",
//    storageBucket: "webrtc-6c37f.appspot.com",
    messagingSenderId: "779896271251"
};
firebase.initializeApp(config);
  
// Listener to log out firebase user when closing window
window.addEventListener("beforeunload", function() {
  firebase.auth().signOut();
});

// Add listener to log in form.
$('#login').on('submit',function(e) {
  e.preventDefault();
  var username=$("#username").val();
  var passw = $("#password").val()
  firebase.auth().signInWithEmailAndPassword(username, passw).catch(function(error) {
    bootbox.alert("<strong>Error:</strong> "+error.message + " (Error code: " + error.code+")");
  });
});

// Global firebase variables
var pathToUser, currentUser, currentUserInfo, 
  pathToOnline = 'online';
  pathToSignaling = 'signaling';

/* Detects log in */ 
firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    $("#login").hide();
    $("#main").show();
    currentUser = user; // user object
    pathToUser = 'users/' + currentUser.uid;
    var onlineUsersModel = new userHandlingModel();
    var onlineUsersView = new userHandlingView(onlineUsersModel, $('#userlist'));
    var onlineUsersController = new userHandlingController(onlineUsersModel, onlineUsersView);
    
    // Load user info database node into global variable
    firebase.database().ref(pathToUser).on('value', function (snapshot) {
      currentUserInfo = snapshot.val();
    });

    // Create listener for offers from someone else
    firebase.database().ref(pathToSignaling + "/" + currentUser.uid + "/offer").on('value', offerReceived);
  }
}, function(error) { // handle errors 
  console.log(error);
});





function getTimestamp () {
  var totalSec = new Date().getTime() / 1000
  var hours = parseInt(totalSec / 3600) % 24
  var minutes = parseInt(totalSec / 60) % 60
  var seconds = parseInt(totalSec % 60)

  var result = (hours < 10 ? '0' + hours : hours) + ':' +
    (minutes < 10 ? '0' + minutes : minutes) + ':' +
    (seconds < 10 ? '0' + seconds : seconds)

  return result
}

function writeToChatLog (message, message_type) {
  document.getElementById('chatlog').innerHTML += '<p class="' + message_type + '">' + '[' + getTimestamp() + '] ' + message + '</p>'
}

function writeToMIDILog (message, message_type) {
  document.getElementById('midilog').innerHTML += '<p class="' + message_type + '">' + '[' + getTimestamp() + '] ' + message + '</p>'
}
