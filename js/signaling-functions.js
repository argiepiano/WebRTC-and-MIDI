// Global variables

var receiverUid; // stores the uid of Bob, the party receiving the offer. This global is ONLY used if you are Alice, the offerer 

// WebRTC variables
var cfg = {"iceServers": [
            {"urls": 'stun:stun.l.google.com:19302'},
//            {urls: 'stun:stun1.l.google.com:19302'},
            //{urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
            //  credential: 'webrtc',
            //  username: 'webrtc'}
          ]}

var pc1=null ,  dc1 = null;
          
/* THIS IS ALICE, THE CALLER/SENDER */
var localTracks, localStream;


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
  pc1.onsignalingstatechange = function(state) {console.log("PC1 signaling state change", pc1.signalingState)};
  pc1.oniceconnectionstatechange = function (e) {
    console.log("Ice connection state change", e.target.iceConnectionState);

  };
  pc1.onconnectionstatechange = function (e) {

    console.info('connection state change:', e);
  };

  pc1.onicecandidate = function (e) {
        console.log("ICE gathering state: ", e.target.iceGatheringState);
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
    // Create a Firebase listener for ICE candidates sent by pc2
  firebase.database().ref(pathToSignaling + '/' + receiverUid + '/ice-to-offerer').on('child_added', iceReceivedPc1);
  // Create a Firebase listener for status (we will use this mostly for hanging up)
  firebase.database().ref(pathToSignaling + '/' + receiverUid + '/connection-status').off();
  firebase.database().ref(pathToSignaling + '/' + receiverUid + '/connection-status').on('value', connectionStatusListener);
  
  // Set up data channel.
  setupDC1();
  

  // Get camera stream for offerer (local video)
  console.log("About to get local user nedia");
  navigator.mediaDevices.getUserMedia({video: { width: {max: 320}, height: {max: 240} }, audio: false})
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
    
    if (typeof pc1.addTrack !== 'undefined') {
      // Firefox already supports addTrack. Chrome not yet
        stream.getTracks().forEach(track => pc1.addTrack(track, stream));
        console.log("added stream to pc1:", stream);
    } else {
      // Adding the stream will trigger a negotiationneeded event
      pc1.addStream(stream);
      console.log("added stream to pc1:", stream);
    }
    pc1.createOffer()
    .then(function (desc) {
       // Limit bandwidth
       console.log("pc1 created offer with description", desc)
      desc.sdp = updateBandwidthRestriction(desc.sdp, 250);
      return pc1.setLocalDescription(desc);
    })
    .then (function () {
      console.log('created local offer', pc1.localDescription);
      // add the new offer to firebase. By pushing it, we actually keep previous offers (avoid overwriting old offers, in case they are not yet processed by Bob)
      var offerRef = firebase.database().ref(pathToSignaling + '/' + receiverUid + '/offers').push();
      descString = JSON.stringify(pc1.localDescription);
      offerRef.set({localdescription: descString, offerer: currentUserInfo.nick});
      
      // Update Firebase connection status
      firebase.database().ref(pathToSignaling + '/' + receiverUid + '/connection-status').set('offer-sent');
      
      // Create event listener for hangup button for the offerer
      $('#hangUp').on("click",function(){
        $(this).off('click');
        firebase.database().ref(pathToSignaling + '/' + receiverUid + '/connection-status').set('disconnected');
      });
    })
    .catch(function (error) {
      console.log('Error somewhere in chain: ' + error);
    });
  });
}

// Sets up a data channel to Bob
function setupDC1 () {
  console.log("About to set up data channel");
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
  remoteVideo.src = window.URL.createObjectURL(e.streams[0]);
  remoteVideo.play();
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

// Gets triggered when Bob creates an answer. Triggered by firebase answer listener 
function answerListener(snapshot) {
  console.log('prelim answer', snapshot.val());
  if (snapshot.val()) {
    bootbox.hideAll();
    var answer = JSON.parse(snapshot.val());
    if (answer != -1) { // The -1 was there when the answere had the option to reject. Not used anymore in this version
      var answerDesc = answer;
      writeToChatLog('Received remote answer', 'text-success');

      // Limit bandwidth
      answerDesc.sdp = updateBandwidthRestriction(answerDesc.sdp, 250);
      
      pc1.setRemoteDescription(answerDesc)
      .then (function() {
        console.log('Successfully added the remote description to pc1');
        
        // Update Firebase connection status
        firebase.database().ref(pathToSignaling + '/' + receiverUid + '/connection-status').set('connected');
        
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

// Listens for connection status changes in the Firebase database. At this point used only for hanging up
// This is used by both, Alice and Bob!

function connectionStatusListener(snapshot) {
  if (snapshot.val() == 'disconnected') {
    // user or partner chose to terminate call
    // kill hangup button listener (this is especially important if the other party terminated the call)
    $("#hangUp").off('click');
    hangUp();
  }
}
/* ---------  BOB, the answerer  ---------*/


var pc2=null,
  dc2 = null;


// Handler for when someone creates an offer to you in the firebase database. Listener is defined right after log in
function offerReceived(snapshot) {
  if (snapshot.val()) {
  
    var snap = snapshot.val();

    // first thing: get the user local media!
    
    if (localTracks) {
      console.log("localtracks", localTracks);
      console.log("stopping usermedia tracks previously acquired");  // we don't want to end up with two sets of local usermedia
      localTracks.forEach(function (track) {
        track.stop();  
      });
    }
    console.log("About to get local user nedia");
    
    // Get stream from user camera
    navigator.mediaDevices.getUserMedia({video: { width: {max: 320}, height: {max: 240} }, audio: false})
    .then(function(stream) {
      // Store tracks and stream in globals to kill them when hanging up
      localTracks = stream.getTracks();
      console.log('assigned localTracks variable', localTracks);
      localStream = stream; // we store localStream to add it to the pc2 later...
      
       // Attach stream to video element 
      var video = document.getElementById('localVideo');
      video.srcObject = localStream;
      
      // Now we can safely proceed to answer the offer
      answerTheOffer(snap.localdescription);
    }); 
  }
}

function answerTheOffer(offerString) {
  
    // Stop ICE listeners in case they were added before (we don't want several listeners to the same thing)
    firebase.database().ref(pathToSignaling + '/' + currentUser.uid + '/ice-to-answerer').off('child_added');
    // Add listener for ICE candidates from pc1
    firebase.database().ref(pathToSignaling + '/' + currentUser.uid + '/ice-to-answerer').on('child_added', iceReceivedPc2);
    
    // Stop and create a new listener for connection status. At this point this is used only for terminating the connection (hanging up)
    firebase.database().ref(pathToSignaling + '/' + currentUser.uid + '/connection-status').off('value');
    firebase.database().ref(pathToSignaling + '/' + currentUser.uid + '/connection-status').on('value', connectionStatusListener);
  
  if (!pc2) { // pc2 has not been created before...
    pc2 = new RTCPeerConnection(cfg);
    pc2.ontrack = handleOnaddstream;
    pc2.onsignalingstatechange = function(state) {console.log("PC2 signaling state change", pc2.signalingState)};
    pc2.oniceconnectionstatechange = function (e) {
      console.info('ice connection state change:', e.target.iceConnectionState);
         // I have to check if the following lines work at all
    };
    pc2.onconnectionstatechange = function (e) {
      console.info('connection state change:', e);
    };
    pc2.ondatachannel = handleOnDataChannel; 
  }
  
  // Listener to get my ICE candidates and send to offerer
  pc2.onicecandidate = function (e) {
    console.log("ICE gathering state: ", e.target.iceGatheringState);
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

  // ---------Start the process of creating an answer-----------------------
  var offerDesc = JSON.parse(offerString);
  // Limit bandwidth
  offerDesc.sdp = updateBandwidthRestriction(offerDesc.sdp, 250);
  
  pc2.setRemoteDescription(offerDesc)
  .then(function() {
    writeToChatLog('Received remote offer','text-success');
    console.log("Just set up the PC2 remote description")

    // Set online status to unavailable
    myStatus = 0;
    var update = {};
    update[pathToOnline + "/" + currentUser.uid +"/status"] = 0;
    firebase.database().ref().update(update);
    
    console.log("About to add stream to PC2. The length of local stream array", pc2.getLocalStreams().length)
    if (typeof pc2.addTrack !== 'undefined') {
      // Firefox already supports addTrack. Chrome not yet
        localStream.getTracks().forEach(track => pc2.addTrack(track, localStream));
    } else {
      // Adding the stream will trigger a negotiationneeded event
      pc2.addStream(localStream);
    }
    
    // Create answer
    return pc2.createAnswer();
  })
  .then (function(answerDesc) {
    writeToChatLog('Created local answer', 'text-success');
    console.log('Created local answer: ', answerDesc);
    // Limit bandwidth
    answerDesc.sdp = updateBandwidthRestriction(answerDesc.sdp, 250);
    return pc2.setLocalDescription(answerDesc);
  })
  .then (function() {
    // Add an answer to firebase
    console.log("About to add an answer to Firebase");
    var answerRef = firebase.database().ref(pathToSignaling + '/' + currentUser.uid + '/answers').push();
    answerRef.set(JSON.stringify(pc2.localDescription));
    
    // Update the Firebase status
    firebase.database().ref(pathToSignaling + '/' + currentUser.uid + '/connection-status').set('answer-sent');
    
    // Create listener for hangup button
    $('#hangUp').on("click", function() {
      $(this).off("click");
      firebase.database().ref(pathToSignaling + '/' + currentUser.uid + '/connection-status').set('disconnected');
    });
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
  console.log('Received datachannel (pc2)', e);
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

// Borrowed from https://github.com/webrtc/samples/tree/gh-pages/src/content/peerconnection/bandwidth

function updateBandwidthRestriction(sdp, bandwidth) {
  if (sdp.indexOf('b=AS:') === -1) {
    // insert b=AS after c= line.
    sdp = sdp.replace(/c=IN IP4 (.*)\r\n/,
                      'c=IN IP4 $1\r\nb=AS:' + bandwidth + '\r\n');
  } else {
    sdp = sdp.replace(/b=AS:(.*)\r\n/, 'b=AS:' + bandwidth + '\r\n');
  }
  return sdp;
}


