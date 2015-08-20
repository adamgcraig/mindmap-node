'use strict';

//https://github.com/primus/primus
var Primus = require('primus');
var mindmap = require('./index.js');

var primusOptions = {
  port: 8080,
  pathname: '/primus',
  parser: 'JSON',
  transformer: 'websockets',
  iknowhttpsisbetter: true//disables warning when not using HTTPS
};

console.log("starting server");

//We use the Primus library to wrap real-time client-server communication.
//ws implements the underlying WebSocket protocol.
var primusServer = Primus.createServer(primusOptions);

mindmap.init(primusServer, 'edit-histories', 'views');

//Get client-side library as string.
//var clientSideLib = primus.library();
//Save a new one on each redeployment in case settings change.
//synchronous:
var clientDir = 'client/primus.js';
primusServer.save(clientDir);
console.log("saved client-side script to "+clientDir);