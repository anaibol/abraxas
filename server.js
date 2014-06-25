var express = require('express');
var app = express();

app.use(express.static(__dirname + '/'));

app.listen(process.env.PORT || 3000);

var util = require("util");

// var WebSocketServer = require('ws').Server;
// var wss = new WebSocketServer({port: 8000});

var players;

// var db = require('monk')('localhost/mydb')
//   , users = db.get('users')

// users.index('name last');
// users.insert({ name: 'Tobi', bigdata: {} });
// users.find({ name: 'Loki' }, '-bigdata', function () {
//   // exclude bigdata field
// });

// db.close();

// Socket.io: Setting up event handlers for all the messages that come
// in from the client (check out /public/js/game.js and /views/game.jade
// for that).

Player = require("./player").Player;

function init() {
  // Create an empty array to store players
  players = [];

  // Start listening for events
  setEventHandlers();
};


var io = require('socket.io')();


 io.set('log level', 1); 

io.listen(3000);

var setEventHandlers = function() {
    io.on("connection", onSocketConnection);
};

function onSocketConnection(client) {
  client.on("log in", onClientLogin);
  client.on("disconnect", onClientDisconnect);
  client.on("move player", onMovePlayer);
};

function onClientLogin(data) {
  var newPlayer = new Player(this.id, data.x, data.y);

  this.broadcast.emit("new player", {id: this.id, x: data.x, y: data.y});

  this.emit("logged in", {id: this.id, x: data.x, y: data.y});

  // Send existing players to the new player

  for (var i = 0; i < players.length; i++) {
    this.emit("new player", {id: players[i].id, x: players[i].x, y: players[i].y});
  };

  // Add new player to the players array
  players.push(newPlayer);
};

function onClientDisconnect() {
  var removePlayer = playerById(this.id);

  // Player not found
  if (!removePlayer) {
    return;
  };

  // Remove player from players array
  players.splice(players.indexOf(removePlayer), 1);

  // Broadcast removed player to connected socket clients
  this.broadcast.emit("remove player", {id: this.id});
};

function onMovePlayer(direction) {
  // Find player in array

  var movePlayer = playerById(this.id);
  
  // Player not found
  if (!movePlayer) {
    return;
  };


  // Update player position

  switch (direction) {
    case 'east':
      movePlayer.x++

      break;
    case 'west':
      movePlayer.x--

      break;
    case 'north':
      movePlayer.y++

      break;
    case 'south':
      movePlayer.y--

      break;
  }

  // io.sockets.socket('4NomV7rh6MMetdPgAAAA').emit('');

  // Broadcast updated position to connected socket clients
  this.broadcast.emit("move player", {id: this.id, direction: direction});
  // this.broadcast.emit("move player", {id: this.id, x: movePlayer.x, y: movePlayer.y});
};

function playerById(id) {
  var i;

  for (i = 0; i < players.length; i++) {
    if (players[i].id == id)
    return players[i];
  };

  return false;
};

init();