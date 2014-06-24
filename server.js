var util = require("util");

// var WebSocketServer = require('ws').Server;
// var wss = new WebSocketServer({port: 8000});

var players;


var io = require('socket.io')();

io.listen(3000);

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


var setEventHandlers = function() {
    io.on("connection", onSocketConnection);
};

function onSocketConnection(client) {
  // Listen for client disconnected
  client.on("disconnect", onClientDisconnect);

  // Listen for new player message
  client.on("new player", onNewPlayer);

  // Listen for move player message
  client.on("move player", onMovePlayer);
};

function onClientDisconnect() {
  var removePlayer = playerById(this.id);
  console.log(this.id)
  // Player not found
  if (!removePlayer) {
    return;
  };

  // Remove player from players array
  players.splice(players.indexOf(removePlayer), 1);

  // Broadcast removed player to connected socket clients
  this.broadcast.emit("remove player", {id: this.id});
};

function onNewPlayer(data) {
  // Create a new player
  var newPlayer = new Player(data.x, data.y, this.id);

  // Broadcast new player to connected socket clients
  this.broadcast.emit("new player", {id: data.id, x: data.x, y: data.y});

  // Send existing players to the new player
  for (var i = 0; i < players.length; i++) {
    this.emit("new player", {x: players[i].x, y: players[i].y});
  };

  // Add new player to the players array
  players.push(newPlayer);
  console.log(players.length)
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
      movePlayer.setX(movePlayer.getX() + 1);
      break;
    case 'west':
      movePlayer.setX(movePlayer.getX() - 1);
      break;
    case 'north':
      movePlayer.setY(movePlayer.getY() + 1);
      break;
    case 'south':
      movePlayer.setY(movePlayer.getY() - 1);
      break;
  }

  // Broadcast updated position to connected socket clients
  this.broadcast.emit("move player", {playerId: this.id, x: movePlayer.getX(), y: movePlayer.getY()});
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