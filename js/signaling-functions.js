// Global variables

var receiverUid; // stores the uid of Alice, the party receiving the offer 

// WebRTC variables
var cfg = {iceServers: [
            {urls: 'stun:stun.l.google.com:19302'},
            {urls: 'stun:stun1.l.google.com:19302'},
            {urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
              credential: 'webrtc',
              username: 'webrtc'}
          ]}

/* THIS IS ALICE, THE CALLER/SENDER */

var pc1 ,  dc1 = null;



var localTracks, localStream;
var negotiate = true;
var myStatus = 1; // Available by default

// Since the same JS file contains code for both sides of the connection,
// activedc tracks which of the two possible datachannel variables we're using.
var activedc;

// var sdpConstraints = {
//   optional: [],
//   mandatory: {
//     OfferToReceiveAudio: true,
//     OfferToReceiveVideo: true
//   }
// }



/* -------  OFFER (Alice) ---------- */

// Creates a local offer to be sent via firebase to the receiver. uid is the id of the receiver. Called when you click the nickname in the chatroom
function createLocalOffer (uid) {
  
  // If my online status is "unavailable", the abort
  
  if (myStatus == 0) {
    bootbox.alert("You are currently on a call.");
    return false;
  }
  
  receiverUid = uid;
  pc1 = new RTCPeerConnection(cfg);
  pc1.ontrack = handleOnaddstream;
  pc1.onsignalingstatechange = onsignalingstatechange;
  pc1.oniceconnectionstatechange = function (e) {
      if (pc1.iceConnectionState == 'disconnected') {
      hangUp();
  }
  console.info('ice connection state change:', e);
  };
  pc1.onconnectionstatechange = function (e) {

    console.info('connection state change:', e);
  };
  pc1.onnegotiationneeded = onnegotiationneeded;

  pc1.onicecandidate = function (e) {
    console.log('ICE candidate (pc1)', e);
    if (!e.candidate) {
      console.log('returning cause not candidate',e);
      return;
    }
    // send ice candidate to answere
    console.log('The actual ice candidate is', e.candidate);
    setTimeout(function() {
      var iceRef = firebase.database().ref(pathToSignaling + '/' + receiverUid + '/ice-to-answerer').push();
      iceRef.set(JSON.stringify(e.candidate));
    },1000);
  };
  
    // Create a listener for an answer from Bob
  firebase.database().ref(pathToSignaling + '/' + receiverUid + '/answers').on('child_added', answerListener);
  
  // set up data channel for chat and midi
  setupDC1();
    
  // Get camera stream for offerer (local video)
  navigator.mediaDevices.getUserMedia({video: { width: {exact: 640}, height: {exact: 480} }, audio: false})
  .then(function (stream) {
    localTracks = stream.getTracks();
    localStream = stream;
    negotiate = true;
    var video = document.getElementById('localVideo');
    video.srcObject = stream;
    video.play();
  
    // Set online status to "unavailable"
    myStatus = 0; // global variable
    var update = {};
    update[pathToOnline + "/" + currentUser.uid +"/status"] = 0;
    firebase.database().ref().update(update);
    
    // Adding the stream will trigger a negotiationneeded event
    pc1.addStream(stream);
  });
}

// Sets up a data stream to Bob
function setupDC1 () {
  try {
    dc1 = pc1.createDataChannel('test', {reliable: false});
    activedc = dc1;  // declared in another file
    console.log('Created datachannel (pc1)');
    dc1.onopen = function () {
      console.log('data channel connect');
    };
    dc1.onmessage = function (e) {
      //console.log('Got message (pc1)', e.data);
      // console.log(e);
      var data = JSON.parse(e.data);
      if (data.type === 'message') {
        writeToChatLog(data.message, 'text-info');
        // Scroll chat text area to the bottom on new input.
        $('#chatlog').scrollTop($('#chatlog')[0].scrollHeight);
      } else {
        midisystem.selectedMidiOutput.send([data.message[0], data.message[1], data.message[2]]);
      }
    };
  } catch (e) { console.warn('No data channel (pc1)', e); }
}

// Triggered when adding stream from Bob 
function handleOnaddstream (e) {
  console.log('Got remote stream', e.streams);
  var remoteVideo = document.getElementById('remoteVideo');
  remoteVideo.srcObject = e.streams[0];
}

function onsignalingstatechange (state) {
  console.info('signaling state change:', state);
}


// Triggered when we receive an ice candidate from pc2 through Firebase
function iceReceivedPc1(snapshot) {
  console.log('Adding ICE from pc2',snapshot.val());
  var can = new RTCIceCandidate(JSON.parse(snapshot.val()));
  pc1.addIceCandidate(can)
  .catch(function(error) {console.log("error when adding ice pc1", error);});
  
}

// This is triggered when we add (or remove) a stream to pc1 and also when setting the data channel
function onnegotiationneeded (state) {
  if (negotiate) { // this semaphore is here to avoid sending an offer when hanging up
    console.info('Negotiation needed:', state);
    pc1.createOffer()
    .then(function (desc) {
      return pc1.setLocalDescription(desc);
    })
    .then (function () {
      console.log('created local offer', pc1.localDescription);
      // add the new offer to firebase. By pushing it, we actually keep previous offers (avoid overwriting old offers, in case they are not yet processed by Bob)
      var offerRef = firebase.database().ref(pathToSignaling + '/' + receiverUid + '/offers').push();
      descString = JSON.stringify(pc.localDescription);
      offerRef.set({localdescription: descString, offerer: currentUserInfo.nick})
    })
    .catch(function (error) {
      console.log('Error somewhere in chain: ' + error);
    });

  } else {
    console.log('skip negotiation because we are hanging up');
  }
}

// Gets triggered when Bob creates an answer. Triggered by firebase answer listener 
function answerListener(snapshot) {
  console.log('prelim answer', snapshot.val());
  if (snapshot.val()) {
    bootbox.hideAll();
    var answer = JSON.parse(snapshot.val());
    if (answer != -1) { // The -1 was there when the answere had the option to reject. Not used anymore in this version
      var answerDesc = new RTCSessionDescription(answer);
      writeToChatLog('Received remote answer', 'text-success');
      pc1.setRemoteDescription(answerDesc)
      .then (function() {
        // Create a Firebase listener for ICE candidates sent by pc2
        firebase.database().ref(pathToSignaling + '/' + receiverUid + '/ice-to-offerer').on('child_added', iceReceivedPc1);
        console.log('Successfully added the remote description to pc1');
      })
      .catch (function(error) {console.log("Problem setting the remote description for PC1 " + error);});
    } else {
      // call rejected. This is not an option anymore. DELETE!
      firebase.database().ref(pathToSignaling+'/'+receiverUid+'/answer').off();
      var update = {};
      update.offer = null;
      firebase.database().ref(pathToSignaling + '/' + receiverUid).update(update);
      bootbox.alert("Call rejected");
    }
  }
}


/* ---------  BOB, the answerer  ---------*/


var pc2,
  dc2 = null;


// Handler for when someone creates an offer to you in the firebase database. Listener is defined right after log in
function offerReceived(snapshot) {
  if (snapshot.val()) {
    var snap = snapshot.val();

    answerTheOffer(snap.localdescription);
    
      // Now we DON'T have the option to reject offer!!! DELETE
      //bootbox.confirm({
      //  message: "You just got a call from " + snap.offerer,
      //    buttons: {
      //      confirm: {
      //        label: 'Accept',
      //        className: 'btn-success'
      //      },
      //      cancel: {
      //        label: 'Reject',
      //        className: 'btn-danger'
      //      },
      //    },
      //  callback: function(result) {
      //    if (result) {
      //      // console.log(snap);
      //      answerTheOffer(snap.localdescription);
      //    } else {
      //      console.log("Call rejected");
      //      // enter a -1 for answer to the offer
      //      var update ={answer: -1};
      //      firebase.database().ref(pathToSignaling + "/" + currentUser.uid).update(update);
      //    }
      //  }
      //}); 

    
  }
}

function answerTheOffer(offerString) {

  // Since this function is called twice (once when Alice creates a datachannel, and then when Alice adds a stream to her pc1),
  // we need to STOP the local camera stream if it already exists, since a new stream is created here for a second time.
  // Otherwise we end up with the 2 local streams for the local camera, which makes it impossible to "kill" when hanging up
  // Only ONE stream of the camera must exist
  
  if (localTracks) {
    localTracks.forEach(function (track) {
      track.stop();  
    });
  } 
  
  pc2 = new RTCPeerConnection(cfg);
  pc2.ontrack = handleOnaddstream;
  pc2.onsignalingstatechange = onsignalingstatechange;
  pc2.oniceconnectionstatechange = function (e) {
    // I have to check if the following lines work at all
    //if (pc2.iceConnectionState == 'disconnected') {
    //  hangUp();
    //}
   console.info('ice connection state change:', e);
  };
  pc2.onconnectionstatechange = function (e) {
    console.info('connection state change:', e);
  };
  
  pc2.ondatachannel = handleOnDataChannel; 

  pc2.onicecandidate = function (e) {
    console.log('ICE candidate (pc2)', e);
    if (!e.candidate) {
      console.log('returning cause not candidate',e);
      return;
    }
    // send ice candidate to offerer through Firebase. TImeout seems to work well here to give time for initial connection to be established 
    setTimeout(function() {
      var iceRef = firebase.database().ref(pathToSignaling + '/' + currentUser.uid + '/ice-to-offerer').push();
      iceRef.set(JSON.stringify(e.candidate)); 
    }, 1000);
   
  };
  
  
  var offerDesc = new RTCSessionDescription(JSON.parse(offerString));
  
  pc2.setRemoteDescription(offerDesc)
  .then(function() {
    writeToChatLog('Received remote offer','text-success');
    return navigator.mediaDevices.getUserMedia({video: { width: {exact: 640}, height: {exact: 480} }, audio: false});
  })
  .then(function (stream) {
    // Set online status to unavailable
    myStatus = 0;
    var update = {};
    update[pathToOnline + "/" + currentUser.uid +"/status"] = 0;
    firebase.database().ref().update(update);
    
    // Store tracks and stream in globals to kill them when hanging up
    localTracks = stream.getTracks();
    localStream = stream;
    
    // Attach stream to video element 
    var video = document.getElementById('localVideo');
    video.srcObject = stream;
    
    // Add (local) stream to peer connection
    pc2.addStream(stream);
    
    // Create answer
    return pc2.createAnswer();
  })
  .then (function(answerDesc) {
    writeToChatLog('Created local answer', 'text-success');
    console.log('Created local answer: ', answerDesc);
    return pc2.setLocalDescription(answerDesc);
  })
  .then (function() {
    // Add an answer to firebase
    var answerRef = firebase.database().ref(pathToSignaling + '/' + currentUser.uid + '/answers').push();
    answerRef.set(JSON.stringify(pc2.localDescription));
    
    // Add listener for ICE candidates from pc1
    firebase.database().ref(pathToSignaling + '/' + currentUser.uid + '/ice-to-answerer').on('child_added', iceReceivedPc2);

  })
  .catch (function (error) {
    console.log("Error in the answer-the-offer chain", error);
  });
}

function iceReceivedPc2(snapshot) {
  console.log('Received ICe from PC1', snapshot.val());
  var can = new RTCIceCandidate(JSON.parse(snapshot.val()));
  pc2.addIceCandidate(can)
  .catch(function(error) {console.log("error when adding ice pc2", error);});
}

function handleOnDataChannel (e) {
  var datachannel = e.channel || e; // Chrome sends event, FF sends raw channel
  console.log('Received datachannel (pc2)', arguments);
  dc2 = datachannel;
  activedc = dc2;
  dc2.onopen = function () {
    console.log('data channel connect');
  };
  dc2.onmessage = function (e) {
    var data = JSON.parse(e.data);
    if (data.type === 'message') {
      writeToChatLog(data.message, 'text-info');
      // Scroll chat text area to the bottom on new input.
      $('#chatlog').scrollTop($('#chatlog')[0].scrollHeight);
    } else { // we got a midi message!
      midisystem.selectedMidiOutput.send([data.message[0], data.message[1], data.message[2]]);
    }    
  };
}

// Function used by both Alice and Bob to send text messages once the connection is established

function sendMessage () {
  if ($('#messageTextBox').val()) {
    writeToChatLog($('#messageTextBox').val(), 'text-success');
    activedc.send(JSON.stringify({message: $('#messageTextBox').val(), type: 'message'}));
    $('#messageTextBox').val('');

    // Scroll chat text area to the bottom on new input.
    $('#chatlog').scrollTop($('#chatlog')[0].scrollHeight);
  }
  return false;
}


