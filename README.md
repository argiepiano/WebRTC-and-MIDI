# WebRTC-and-MIDI
"Serverless" webRTC (paste offer and answer) plus MIDI streaming

This is a simple implementation based on [serverless-webrtc] (https://github.com/cjb/serverless-webrtc) with added MIDI streaming.

This will not work on one computer (as in two different browser tabs). You need two devices. Currently it streams MIDI data to the peer. The receiver will not send to MIDI output; rather it pastes the received info in the log. 
