# WebRTC Video and MIDI Streaming
WebRTC video plus MIDI streaming

This is a simple implementation based on [serverless-webrtc] (https://github.com/cjb/serverless-webrtc) (but greatly modified from the original!) with added MIDI streaming. It uses Firebase for initial signal exchange. It's a work in progress.

This will not work in two different tabs in the same browser. You need two devices or two browsers. Notice that MIDI streaming will only work Chrome 50+ (Firefox does not yet implement Web MIDI API - bummer!). 

[Try the demo](https://argiepiano.github.io/WebRTC-and-MIDI/midi-webrtc.html)
