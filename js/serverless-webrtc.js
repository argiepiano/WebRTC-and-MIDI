/* MIDI STUFF */
// Initialize the MIDI system
$("#main").hide();

var midisystem;

// start midi system
navigator.requestMIDIAccess && navigator.requestMIDIAccess().then(
  function success(midiAccess) {                
        // Initialize MIDI system
        midisystem = new MidiSystem(midiAccess);
        midisystem.init();
        console.log("Input "+midisystem.selectedMidiInput.name);
        console.log("Output "+midisystem.selectedMidiOutput.name);
  },
  function failure (err) {// Failed accessing MIDI
        console.log("Error initializing MIDI!");
        // @TODO Warn user that MIDI is not available. Stop app?
  }
); 

// Handler for incoming midi messages
function onMidiMessage(receivedEvent) {
  if ((receivedEvent.data[0] & 0xF0) != 0xF0) { // filter out SysEx messages, Active Sensing and other undesired messages.
    console.log("Sent midi: " + JSON.stringify(receivedEvent.data));
    var channel = activedc;
    channel.send(JSON.stringify({
      message: receivedEvent.data,
      type: "midi"
    }));
  }
}

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
  console.log("Before unload");
  pc1.close();
  pc2.close();
  activedc.close();
  $("#localVideo").attr('src', null);
  $("#remoteVideo").attr('src', null);
  if (!receiverUid) {
    receiverUid = 'dummy';
  }
  var update = {};
  update[pathToSignaling + "/" + receiverUid]  = null;
  firebase.database().ref().update(update)
  .then(function() {
    firebase.auth().signOut();
  });
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
  console.log('firebase state change: ' + user);
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
      if (snapshot.val()) {
        currentUserInfo = snapshot.val();
        console.log("Current user " + JSON.stringify(currentUserInfo));
      }
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
