// User view and controller
  
function UserMenu(form, target) {
  this._form = form;
  this._target = target;
  var _this = this;
  var userMenuTemplate = Handlebars.compile(`
    <a href="#" class="dropdown-toggle" data-toggle="dropdown">
      <span class="glyphicon glyphicon-user"></span>
      <strong>Hello, {{nick}}</strong>
      <span class="glyphicon glyphicon-chevron-down"></span>
     </a>
     <ul class="dropdown-menu">
      <li><a href="#" id="account">My account</a></li>
     </ul>
  `);
  
  _this._target.on("click", "#account", function(e) {
    console.log("clicked account");
    e.preventDefault();
    _this._form.render();
  });
  
  this.show = function() {
    firebase.database().ref(pathToUser).child('nick').once('value',
      function (snapshot) {
        var htmlUI = userMenuTemplate({nick: snapshot.val()})
        _this._target.html(htmlUI);
      }
    );  
  }
  
  this.hide = function() {
    console.log("Hiding user menu")
    _this._target.empty();
  }
}

// Initialize account form
function UserAccountForm(target) {
  var _this = this;
  this._target = target;
  
  var userAccountForm = `
    <div class="modal fade" id="userAccountModal" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <button type="button" class="close" data-dismiss="modal" aria-label="Close">
            <span aria-hidden="true">&times;</span>
            <span class="sr-only">Close</span>
          </button>
          <h4 class="modal-title" id="myModalLabel">My account</h4>
        </div>
        <div class="modal-body">
          <form id="userAccountForm" role="form" data-toggle="validator">
            <div class="form-group">
              <label for="userName">Name</label>
                <input class="form-control" id="userName"  required />
            </div>
            <div class="form-group">
              <label for="userNick">Nickname</label>
                <input class="form-control" id="userNick"  required />
            </div>

            <div class="panel-footer clearfix">
              <button type="submit" class="btn btn-primary pull-right">Submit</button>
            </div>
          </form>
        </div>
      </div>
    </div>
    `;
  
  this._target.append(userAccountForm);
  this._target.on('submit', '#userAccountForm', function(e) {
     e.preventDefault();
     _this.submitHandler();
  });
   
  this.render = function() {
    firebase.database().ref(pathToUser).once('value').then(
      function (snapshot) {
        var user = snapshot.val();
        if (user) {
          $("#userName").val(user.name);
          $('#userNick').val(user.nick);
        }
        $("#userAccountModal").modal('show');  
      }
    );
  };
  
  this.submitHandler = function() {
    console.log("submitted");
    var name =  $("#userName").val();
    var nick = $("#userNick").val();

    
    var update = {}; 
    $("#userAccountModal").modal('hide');
    update["name"] = name;
    update["nick"] = nick;
    firebase.database().ref(pathToUser).update(update);   
  };
}

function SignUp() {
    var _this = this;
    var signUpForm = `
      <div id="user-sign-up">
        <div class="container">
          <h2>User sign up</h2>
          <form id="user-sign-up-form" role="form" data-toggle="validator">
            <div class="form-group">
              <label for="email">Email</label>
                <input type="email" class="form-control email"  required />
            </div>
            <div class="form-group">
              <label for="password">Password</label>
                <input type="password" class="form-control password"  required />
            </div>
            <div class="form-group">
              <label for="userName">Name</label>
                <input class="form-control userName"  required />
            </div>
            <div class="form-group">
              <label for="userNick">Nickname</label>
                <input class="form-control userNick"  required />
            </div>
            <div class="form-group">
              <button type="submit" class="btn btn-primary">Submit</button>
              <button id="user-form-cancel" class="btn btn-danger">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;
  this.render = function() {  
    $("body").append(signUpForm);
    $("#user-sign-up-form").on('submit', function (e){
      e.preventDefault();
      _this.submitHandler()
    });
    $("#user-form-cancel").on("click", function() {
      console.log("Cancelled");
      $("#user-sign-up").remove();
      $("#login").show('fast');
    })
  }

  this.submitHandler = function() {
    console.log("submitted");
    var email = $("#user-sign-up-form .email").val();
    var password = $("#user-sign-up-form .password").val();
    var name =  $("#user-sign-up-form .userName").val();
    var nick = $("#user-sign-up-form .userNick").val();

    console.log(email + password + name + nick );
    firebase.auth().createUserWithEmailAndPassword(email, password).then(
      function success(user) {
        console.log("new user id " + user.uid);
        $("#user-sign-up").remove();
        $("#login").show('fast');
        
        var update = {}; 

        update["name"] = name;
        update["nick"] = nick;
        firebase.database().ref('users/'+user.uid).update(update); 
      },
      function failure(error) {
        bootbox.alert({
          message: "Error creating the account: "+error.message,
          callback: function () {
            $("#user-sign-up").remove();
            $("#login").show('fast');
          }
        });
      }
    );
  };    
}

function UserPasswordReset() {
  var _this = this;
  var userResetForm = `
    <div id="user-password-reset">
      <div class="container">
        <h4>Password reset</h4>
        <form id="user-password-reset-form" role="form" data-toggle="validator">
          <div class="form-group">
            <label for="email">Email</label>
              <input type="email" class="form-control email"  required />
          </div>
          <div class="form-group">
            <button type="submit" class="btn btn-primary">Submit</button>
            <button id="user-form-cancel" class="btn btn-danger">Cancel</button>
          </div>
        </form>
      </div>
    </div>
    `;
  this.render = function() {  
    $("body").append(userResetForm);
    
    $("#user-password-reset").show()
    $("#user-password-reset-form").on('submit', function (e){
      e.preventDefault();
      _this.submitHandler()
    });
    $("#user-form-cancel").on("click", function() {
      console.log("Cancelled");
      $("#user-password-reset").remove();
      $("#login").show('fast');
    })
  };
  
  this.submitHandler = function() {
    console.log("submitted");
    var email = $("#user-password-reset-form .email").val();

    console.log(email);
    firebase.auth().sendPasswordResetEmail(email).then(
      function success() {
        $("#user-password-reset").remove();
        $("#login").show('fast');
      },
      function failure(error) {
        bootbox.alert({
          message: "Error: "+error.message,
          callback: function () {
            $("#user-password-reset").remove();
            $("#login").show('fast');
          }
        });
      }
    );
  };   
}