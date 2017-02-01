// Global variables

var receiverUid; // stores the uid of Alice, the party receiving the offer 

// WebRTC variables
var cfg = {'iceServers': [{'urls': 'stun:23.21.150.121'}]},
  con = { 'optional': [{'DtlsSrtpKeyAgreement': true}] };

/* THIS IS ALICE, THE CALLER/SENDER */

var pc1 = new RTCPeerConnection(cfg, con),
  dc1 = null, tn1 = null
  
var localTracks, localStream;
var negotiate = true;

// Since the same JS file contains code for both sides of the connection,
// activedc tracks which of the two possible datachannel variables we're using.
var activedc

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
  receiverUid = uid;
  console.log('video1')
  navigator.mediaDevices.getUserMedia({video: true, audio: true})
  .then(function (stream) {
    localTracks = stream.getTracks();
    localStream = stream;
    negotiate = true;
    var video = document.getElementById('localVideo')
    video.srcObject = stream;
    video.play()
    // Chrome does not yet support this: stream.getTracks().forEach(track => pc1.addTrack(track, stream));
    pc1.addStream(stream)
    // console.log(stream)
    console.log('adding stream to pc1')
    setupDC1()
    return pc1.createOffer();
  })
  .then(function (desc) {
      return pc1.setLocalDescription(desc);
  })
  .then (function (desc) {
    console.log('created local offer', desc)

    // Create a MIDI listener
    midisystem.selectedMidiInput.onmidimessage = onMidiMessage;
    console.log('created midi listener for ' + midisystem.selectedMidiInput.name)

  })
  .catch(function (error) {
    console.log('Error somewhere in chain: ' + error)
  })
}

// Sets up a data stream to Bob
function setupDC1 () {
  try {
    dc1 = pc1.createDataChannel('test', {reliable: true})
    activedc = dc1  // declared in another file
    console.log('Created datachannel (pc1)')
    dc1.onopen = function (e) {
      console.log('data channel connect')
    }
    dc1.onmessage = function (e) {
      console.log('Got message (pc1)', e.data);
      if (e.data.size) {

      } else {
        if (e.data.charCodeAt(0) == 2) {
          // The first message we get from Firefox (but not Chrome)
          // is literal ASCII 2 and I don't understand why -- if we
          // leave it in, JSON.parse() will barf.
          return
        }
        console.log(e)
        var data = JSON.parse(e.data);
        if (data.type === 'message') {
          writeToChatLog(data.message, 'text-info')
          // Scroll chat text area to the bottom on new input.
          $('#chatlog').scrollTop($('#chatlog')[0].scrollHeight)
        } else {
          writeToMIDILog(JSON.stringify(data.message), 'text-info');
          // Scroll MIDI log text area to the bottom on new input.
          $('#midilog').scrollTop($('#midilog')[0].scrollHeight)
        }
      }
    }
  } catch (e) { console.warn('No data channel (pc1)', e); }
}

// This gets triggered when the local offer is ready. It creates an entry in the signaling node 
pc1.onicecandidate = function (e) {
  console.log('ICE candidate (pc1)', e);
}

// Triggered when adding stream from Bob
function handleOnaddstream (e) {
  console.log('Got remote stream', e.stream)
  var el = document.getElementById('remoteVideo')
  el.autoplay = true
  attachMediaStream(el, e.stream)
}

pc1.onaddstream = handleOnaddstream

//function handleOnconnection () {
//  console.log('Datachannel connected')
//  writeToChatLog('Datachannel connected', 'text-success')
//  $('#waitForConnection').modal('hide')
//  // If we didn't call remove() here, there would be a race on pc2:
//  //   - first onconnection() hides the dialog, then someone clicks
//  //     on answerSentBtn which shows it, and it stays shown forever.
//  $('#waitForConnection').remove()
//  $('#showLocalAnswer').modal('hide')
//  $('#messageTextBox').focus()
//}
//  DEPRECATED
//pc1.onconnection = handleOnconnection

function onsignalingstatechange (state) {
  console.info('signaling state change:', state)
}

function oniceconnectionstatechange (state) {
  console.info('ice connection state change:', state)
}

function onicegatheringstatechange (state) {
  console.info('ice gathering state change:', state)
}

function onnegotiationneeded (state) {
  if (negotiate) {
    console.log("Negotiate is true");
    var update = {};
    var localDescript = pc1.localDescription;
    localDescript['offerer'] = currentUserInfo.nick;
    update[pathToSignaling + '/' + receiverUid] = {offer: {localdescription: pc1.localDescription, offerer: currentUserInfo.nick}} ; 
    firebase.database().ref().update(update);
    console.log(JSON.stringify(pc1.localDescription));
    
    // create a listener for an answer from Bob
    firebase.database().ref(pathToSignaling + '/' + receiverUid + '/answer').on('value', answerListener);
  }
  console.info('Negotiation needed:', state)
}

pc1.onsignalingstatechange = onsignalingstatechange
pc1.oniceconnectionstatechange = oniceconnectionstatechange
pc1.onicegatheringstatechange = onicegatheringstatechange
pc1.onnegotiationneeded = onnegotiationneeded;


// Gets triggered when Bob creates an answer. Triggered by firebase answer listener 
function answerListener(snapshot) {
  if (snapshot.val()) {
    console.log("Answer received " + JSON.stringify(snapshot.val()));
    bootbox.hideAll();
    var answer = snapshot.val();
    var answerDesc = new RTCSessionDescription(answer);
    console.log('Received remote answer: ', answerDesc);
    writeToChatLog('Received remote answer', 'text-success');
    pc1.setRemoteDescription(answerDesc)
    .then (function() {
      console.log('Successfully added the remote description to pc1');
      firebase.database().ref(pathToSignaling + '/' + receiverUid + '/answer').off('value', answerListener);
    })
    .catch (function(error) {console.log("Problem setting the remote description for PC1 " + error)});
  }
}



//function handleCandidateFromPC2 (iceCandidate) {
//  pc1.addIceCandidate(iceCandidate)
//}



/* ---------  BOB  ---------*/


var pc2 = new RTCPeerConnection(cfg, con),
  dc2 = null

// var pc2icedone = false

// Handler for when someone creates an offer to you in the firebase database. Listener is defined right after log in
function offerReceived(snapshot) {
  var snap = snapshot.val();
  if (snapshot.val()) {
    console.log('offer received! '+ JSON.stringify(snap));
    bootbox.confirm({
      message: "You just got a call from " + snap.offerer,
        buttons: {
          confirm: {
            label: 'Accept',
            className: 'btn-success'
          },
          cancel: {
            label: 'Reject',
            className: 'btn-danger'
          },
        },
      callback: function(result) {
        if (result) {
          console.log(snap);
          answerTheOffer(snap.localdescription);
        } else {
          console.log("Call rejected");
          // enter a -1 for answer to the offer
          var update ={answer: -1};
          firebase.database().ref(pathToSignaling + "/" + currentUser.uid).update(update);
        }
      }
    }); 
  }  
}


function answerTheOffer(offer) {
  var offerDesc = new RTCSessionDescription(offer);
  pc2.setRemoteDescription(offerDesc).then(function() {
    writeToChatLog('Received remote offer','text-success');
    return navigator.mediaDevices.getUserMedia({video: true, audio: true});
  })
  .then(function (stream) {
    localTracks = stream.getTracks();
    localStream = stream;
    var video = document.getElementById('localVideo')
    video.srcObject = stream;
    video.play;
    // Chrome does not yet support this: stream.getTracks().forEach(track => pc2.addTrack(track, stream));
    pc2.addStream(stream);
    return pc2.createAnswer();
  })
  .then (function(answerDesc) {
    writeToChatLog('Created local answer', 'text-success')
    console.log('Created local answer: ', answerDesc)
    return pc2.setLocalDescription(answerDesc)
  })
  .then (function() {
    update = {};
    update[pathToSignaling + '/' + currentUser.uid + '/answer'] =  pc2.localDescription; 
    firebase.database().ref().update(update);
    console.log("Created node with answer " + JSON.stringify(pc2.localDescription))
    
    // Add MIDI listener
    midisystem.selectedMidiInput.onmidimessage = onMidiMessage;

  })
  .catch (function (error) {
    console.log("Error in the answertheoffer chain " + error)
  });
}

// This is triggered when the answer is ready to go
pc2.onicecandidate = function (e) {
  console.log("old onicecandidate called");
}

pc2.ondatachannel = function (e) {
  var datachannel = e.channel || e; // Chrome sends event, FF sends raw channel
  console.log('Received datachannel (pc2)', arguments)
  dc2 = datachannel
  activedc = dc2
  dc2.onopen = function (e) {
    console.log('data channel connect')
  }
  dc2.onmessage = function (e) {
    console.log('Got message (pc2)', e.data)
    if (e.data.size) {

    } else {
      var data = JSON.parse(e.data)
      if (data.type === 'message') {
        writeToChatLog(data.message, 'text-info')
        // Scroll chat text area to the bottom on new input.
        $('#chatlog').scrollTop($('#chatlog')[0].scrollHeight)
      } else {
        writeToMIDILog(JSON.stringify(data.message), 'text-info');
        // Scroll MIDI log text area to the bottom on new input.
        $('#midilog').scrollTop($('#midilog')[0].scrollHeight)
      }
    }
  }
}


pc2.onsignalingstatechange = onsignalingstatechange
pc2.oniceconnectionstatechange = oniceconnectionstatechange
pc2.onicegatheringstatechange = onicegatheringstatechange

pc2.onaddstream = handleOnaddstream

function sendMessage () {
  if ($('#messageTextBox').val()) {
    var channel = activedc;
    writeToChatLog($('#messageTextBox').val(), 'text-success')
    channel.send(JSON.stringify({message: $('#messageTextBox').val(), type: 'message'}));
    $('#messageTextBox').val('')

    // Scroll chat text area to the bottom on new input.
    $('#chatlog').scrollTop($('#chatlog')[0].scrollHeight)
  }

  return false
}


