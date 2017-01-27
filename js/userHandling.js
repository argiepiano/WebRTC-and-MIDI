function userHandlingModel() {
  var _this = this;
  this.onlineUsers = {}; // this is a property that contains object with the online user information to display in the online box
  var onlineSnapshotObject = {};  // this contains the snapshot of the online node
  var userKeyArray = [];
  this.onlineUserChange = new SpEvent(this);
  
  var userHelper = function() {
    var uid = userKeyArray.shift();
    _this.onlineUsers[uid] = {};
    switch (onlineSnapshotObject[uid].status) {
      case 0:
        _this.onlineUsers[uid].status = "Unavailable";
        break;
      case 1:
        _this.onlineUsers[uid].status = "Available";
        break;
      case 2:
        _this.onlineUsers[uid].status = "Invisible";
        break;
    }
    firebase.database().ref('users/' + uid).once('value').then(function(snap){
      var userData = snap.val();
      _this.onlineUsers[uid].name = userData.name + ((currentUser.uid == uid) ? ' ME' : '' );
      _this.onlineUsers[uid].nick = userData.nick;
      if (userKeyArray.length) {
        userHelper();
      } else { // done iterating and building the user list
        _this.onlineUserChange.notify();
      }
    });
  }
  // Create a listener to users listed in the online node
  firebase.database().ref(pathToOnline).on('value', function(snapshot){
    _this.onlineUsers = {};  // initialize
    onlineSnapshotObject = snapshot.val();
    userKeyArray = Object.keys(onlineSnapshotObject);
    userHelper();
  });
}

function userHandlingView (model, target) {
  var _this = this;
  this.target = target;
  model.onlineUserChange.attach(function() {
      var users = {users: model.onlineUsers};
      var usersHTML = userListUI(users);
      _this.target.html(usersHTML);
  });
}

function userHandlingController (model, view) {
  
}

var userListUI = Handlebars.compile(`
  {{#each users}}
    <div id="{{@key}}"><span class="name">{{this.name}} ({{this.status}})</div>
  {{/each}}
`);