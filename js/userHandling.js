// Contains functions related to creating the UI for the chatroom

function userHandlingModel() {
  var _this = this;
  this.onlineUsers = {}; // contains the online user information to display in the online box

  this.onlineUserChange = new SpEvent(this);
  

  // Create a listener to users listed in the online node
  firebase.database().ref(pathToOnline).on('value', function(snapshot){
    if (snapshot.val()) {
      _this.onlineUsers = snapshot.val();
      _this.onlineUserChange.notify();
    }
  });
}

function userHandlingView (model, target) {
  var _this = this;
  this.target = target;
  model.onlineUserChange.attach(function() {
      if (model.onlineUsers[currentUser.uid]) {
        var self = {}
        self = model.onlineUsers[currentUser.uid];
        self['myid'] = currentUser.uid;
        var usersHTML = selfUserUI(self);
        delete model.onlineUsers[currentUser.uid];
        var users = {users: model.onlineUsers};
        var usersHTML =  usersHTML + userListUI(users);
        _this.target.html(usersHTML);
      }

  });
}

function userHandlingController (model, view) {
  // Listener for status change (select element). Updates firebase status
  view.target.on("change",".selfStatus", function(e) {
    var update = {};
    update[pathToOnline + "/" + e.target.id + "/status"] = e.target.value;
    firebase.database().ref().update(update);
  })
  
  // DOM element link listener - "calling" someone - clicking on the nickname
  view.target.on("click", ".userNick", function(e) {
    if (model.onlineUsers[e.target.id].status == 1) {
      bootbox.dialog({message: "Sending offer to " + e.target.innerHTML + ". This may take up to 1 minute!"});
      createLocalOffer(e.target.id);
    } else {
      bootbox.alert("User not available"); 
    }
  });
}

/* -------   TEMPLATES  ---------*/
// Template for self in online user list
var selfUserUI = Handlebars.compile(`
  <div class="selfUser"><span class="nick">{{nick}} - ME </span>
  <span class="status"> ({{#statusText status}}{{/statusText}})</span>
  </div>
`);

// Template for online users
var userListUI = Handlebars.compile(`
  {{#each users}}
    <div class="onlineUser">
      <a href="#" id={{@key}} class="userNick">{{this.nick}}</a>
      <span class="status"> ({{#statusText this.status}}{{/statusText}})</span>
    </div>
  {{/each}}
`);


// Helper to select the correct status option in Select element
window.Handlebars.registerHelper('select', function( value, options ){
    var $el = $('<select />').html( options.fn(this) );
    $el.find('[value="' + value + '"]').attr({'selected':'selected'});
    return $el.html();
});

// Helper to produce the correct status text
window.Handlebars.registerHelper('statusText', function( value, options ){
    var statusText;
    switch (value) {
      case 0:
        statusText = 'Unavailable';
        break;
      case 1:
        statusText = 'Available';
        break;
      case 2:
        statusText = 'Invisible';
        break;       
    }
    return new Handlebars.SafeString(statusText);
});