'use strict';

//var fs = require('fs');

//properties of an edit object:
var INDEX = 'index';//its cannonical inex in the edit history, assigned by the server
var TIMESTAMP = 'timestamp';//the approximate time at which the index was assigned, assigned by the server
var AUTHOR = 'author';//the name of the user who created the edit, assigned by the server
var TYPE = 'type';//the kind of thing to edit, assigned by the client
var VALUE = 'value';//the value to which to set the thing edited, assigned by the client

var inited = false;
var primusServer = null;
var editHistoryPath = null;
var viewPath = null;
var users = null;
var views = null;

function viewWithName(viewName) {
  function nameMatches(view) {
    return view.getName() === viewName;
  }// end of function nameMatches
  var matches = views.filter(nameMatches);
  if (matches.length > 0) {
    if(matches.length > 1) {
      console.error("mindmap-node has multiple views with the same name, name: ", viewName, ", views: ", matches);
    }
    return matches[0];
  }// end of if view with this name found
  else {
    var newView = new View(viewName);
    views.push(newView);
    return newView;
  }
}// end of function viewWithName

function User (spark) {
  
  var user = this;// for use in functions not explicitly made object methods
  var name = 'anonymous';
  var view = null;
  
  function setView (newView) {
    // The user can only edit one view at a time.
    if (view !== null) {
      view.removeUser(user);
    }// end of if old view !== null
    if (newView !== null) {
      newView.addUser(user);
    }// end of if new view !== null
    view = newView;
  }// end of function setView
  
  function onData (edit) {
    
    if ( !edit.hasOwnProperty(TYPE) ) {
      console.error("User sent edit without type, user: ", name, ", edit: ", edit);
      return;
    }
    
    if (edit[TYPE] == 'userNAME') {
      name = edit[VALUE];
    }
    else if (edit[TYPE] == 'viewName') {
      setView( viewWithName(edit[VALUE]) );
      console.log( "user set view, user: ", name, ", view: ", view.getName() );
    }
    else {
      if ( view !== null ) {
        view.addEdit(edit);
      }
    }//end of if edit is not setting the user name or view
    
  }// end of function onData
  
  spark.on('data', onData);
  
  function onEnd () {
    // Remove this user from any view it is editing:
    setView(null);
    console.log("connection ended: ", spark);
  }// end of function onEnd
  
  spark.on('end', onEnd);
  
  this.write = function (data) {
    console.log("writing data to user, user: ", name, ", data: ", data);
    spark.write(data);
  };// end of this.write
  
  // reason should be a string
  this.end = function (reason) {
    // Remove this user from any view it is editing:
    setView(null);
    // Since we already removed the view, we will not do the onEnd shutdown.
    spark.removeListener('end', onEnd);
    spark.removeListener('data',onData);
    spark.end(reason);
  };// end of this.end
  
}// end of function User

function View (name) {
  
  var view = this;// for use in functions not explicitly made object methods
  var editingUsers = [];
  var edits = [];
  
  this.getName = function () {
    return name;
  };// end of this.getName
  
  this.addUser = function (user) {
    if(editingUsers.indexOf(user) !== -1) {
      console.error("mindmap-node tried to add user to view more than once, user: ", user, ", view: ", view);
      return;
    }
    console.log("adding user to view, user: ", user, ", view: ", view);
    // Add this user to the end of the array.
    editingUsers.push(user);
  };// end of this.addUser
  
  this.removeUser = function (user) {
    var index = editingUsers.indexOf(user);
    if(editingUsers.indexOf === -1) {
      console.error("mindmap-node tried to remove user from view it was not editing, user: ", user, ", view: ", view);
      return;
    }
    // Delete this user from the array:
    editingUsers.splice(index, 1);
  };// end of this.removeUser
  
  this.addEdit = function (edit) {
    // Note that this is where we determine what the canonical order of edits is.
    // If two users try to edit a node simultaneously, 
    // the edit that gets here first happened first,
    // regardless of which user clicked the what first on either client.
    // This includes cases where the one user's edit would render the other's meaningless,
    // as when a user deletes a node and another tries to edit its text. 
    edits.push(edit);
    // Keep track of both the index in the complete array of edits and the timestamp.
    // The index tells the client the canonical order of edits.
    edit['index'] = edits.indexOf(edit);
    // The timestamp helps human users inspect who did what when in the edit history.
    edit['timestamp'] = Date.now();
    // Send the edit to every user editing this view, including the one who sent it.
    // The edit does not get implemented in the local user's view until it receives the edit from the server.
    // This improves the chances that the user will receive edits in the canonical order.
    console.log("view distributing edit, view: ", name, ", edit: ", edit, ", editingUsers: ", editingUsers);
    function writeEdit (user, index, userArray) {
      user.write(edit);
    }// end of function writeEdit
    editingUsers.forEach(writeEdit);
  };// end of this.addEdit
  
}// end of function View

// onConnection, onError, and onDisconnection are event handlers for the events,
// 'connection', 'error', and 'disconnection' from the primus server instance, 
// respectively.

function onConnection (spark) {
  console.log('connection opened: ', spark);
  users.push( new User(spark) );
}// end of function onConnection

function onError (err) {
  console.error('error from primus: ', err);
}// end of function onError

function onDisconnection (spark) {
  console.log('connection closed: ', spark);
}// end of function onDisconnection

// newPrimusServer: a server returned by
// primus.createServer(...) or new Primus(...)
// editHistory: a string describing the path to the edit history files
// The primus parser should be set to 'JSON', the default.
// None of the other options matter for the code in this module.
// viewPath: a string describing the path to the view SVG files 
exports.init = function (newPrimusServer, newEditHistoryPath, newViewPath) {
  if (inited) {
    throw( new Error("init called while mindmap-node is initiated.") );
  }
  primusServer = newPrimusServer;
  editHistoryPath = newEditHistoryPath;
  viewPath = newViewPath;
  views = [];
  users = [];
  primusServer.on('connection', onConnection);
  primusServer.on('error', onError);
  primusServer.on('disconnection', onDisconnection);
  inited = true;
};//end of exports.init

exports.destroy = function () {
  if (!inited) {
    throw( new Error("destroy called while mindmap-node is not initiated.") );
  }
  inited = false;
  function endBecauseServerDestroyed (user) {
    user.end("mindmap-node server is shutting down.");
  }// end of function endBecauseServerDestroyed
  users.forEach(endBecauseServerDestroyed);
  primusServer.removeListener('disconnection', onDisconnection);
  primusServer.removeListener('error', onError);
  primusServer.removeListener('connection', onConnection);
  users = null;
  views = null;
  viewPath = null;
  editHistoryPath = null;
  primusServer = null;
};//end of exports.destroy