function MidiSystem(midiAccess) {
  
  this.midiAccess = midiAccess;
  this.selectedMidiInput = {};
  this.selectedMidiOutput = {};
  // Events fired by this object
  this.stateChange = new SpEvent(this);
  var _this = this;


  this.getInputs = function() {
    var midiInputIDs = [];
    this.midiAccess.inputs.forEach(function(port){
      midiInputIDs.push(port.id);
    });
    if (midiInputIDs[0]) {
      this.selectedMidiInput = this.midiAccess.inputs.get(midiInputIDs[0]);
      $("#midiin").html(_this.selectedMidiInput.name);
      document.querySelector("#midi-menu").style ="";
    } else {
      this.selectedMidiInput = {};
      $("#midiin").html("Disconnected");
      document.querySelector("#midi-menu").style.color = "red";
    }
  };

  this.getOutputs= function() {
    var midiOutputsIDs = [];
    this.midiAccess.outputs.forEach(function(port){
      midiOutputsIDs.push(port.id);
    });
    if (midiOutputsIDs[0]) {
      this.selectedMidiOutput = this.midiAccess.outputs.get(midiOutputsIDs[0]);
      $("#midiout").html(_this.selectedMidiOutput.name);
      document.querySelector("#midi-menu").style ="";
    } else {
      this.selectedMidiOutput = {};
      $("#midiout").html("Disconnected");
      document.querySelector("#midi-menu").style.color ="red";
    }
  };
  
  
  this.MIDIStateChange= function(event) {
    _this.getInputs();
    _this.getOutputs();
    console.log("MIDI State Change on port: "+event.port);
    console.log("MIDI State Change state: "+event.port.state);
    _this.stateChange.notify(event); // receivers need to check event.port.type (input, output)
                                  //and event.port.state (when state changes, something got disconnected 
  };
  
  this.init= function() {
    this.getInputs();
    this.getOutputs();
    this.midiAccess.onstatechange = _this.MIDIStateChange;
    this.stateChange.notify();
  }

}

