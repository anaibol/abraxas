var width = 800;
var height = 600;

var phaser = {
  preload: preload,
  create: create,
  update: update,
  render: render
};

var game = new Phaser.Game(width, height, Phaser.AUTO, '', phaser);
 
var map;
var layer;

var me;
var player;
var players = [];
var cursors; 

var minX = 0;
var minY = 0;
var maxX = 1400;
var maxY = 1400;

var grass;

// window.addEventListener("deviceorientation", handleOrientation, true);


function handleOrientation(e) {
  var x = e.gamma;    var y = e.beta;
  player.body.velocity.x -= x*2;
  player.body.velocity.y -= y*4;
}

function preload() {

  game.load.tilemap('desert', 'map.json', null, Phaser.Tilemap.TILED_JSON);
  game.load.image('grass', 'img/grass.png');
  game.load.spritesheet('player', 'img/dude.png', 27, 49);
}



function create() {
  // game.world.setBounds(minX, minY, maxX, maxY);
  // game.add.sprite(0, 0, 'grass');

  // map = game.add.tileSprite(0, 0, width, height, 'grass');


  map = game.add.tilemap('grass');
  map.addTilesetImage('Grass');

  layer = map.createLayer('Ground');
  layer.resizeWorld();

  // grass = map.createLayer('grass');
  // grass.resizeWorld();


  // map.fixedToCamera = true;

  me = new Player({x: game.world.width / 2, y: game.world.height / 2, id: 1}); //game.world.width / 2, y: game.world.height / 2

  me.player.anchor.setTo(0.5, 0.5);
  me.player.animations.add('east', [16,17,18,19,20,21,22,23], 8, true);
  me.player.animations.add('north', [0,1,2,3,4,5,6,7], 8, true);
  me.player.animations.add('west', [48,49,50,51,52,53,54,55], 8, true);
  me.player.animations.add('south', [32,33,34,35,36,37,38, 39], 8, true);


  //  This will force it to decelerate and limit its speed
  game.physics.enable(me.player, Phaser.Physics.ARCADE);
  me.player.body.drag.set(0.2);
  me.player.body.maxVelocity.setTo(400, 400);
  me.player.body.collideWorldBounds = true;

  // player.bringToTop();

  game.camera.follow(me.player);
  // game.camera.focusOnXY(0, 0);

  cursors = game.input.keyboard.createCursorKeys();
}
 
function update() {
  // game.physics.arcade.overlap(player, null, this);
   
  currentSpeed = 200

  if (cursors.right.isDown) {
      me.player.angle = 0;
      me.player.animations.play('east');
      socket.emit('move player', 'east');
  } else if (cursors.left.isDown) {
      me.player.angle = 180;
      me.player.animations.play('west');
      socket.emit('move player', 'west');
  } else if (cursors.up.isDown) {       
      me.player.angle = 270;
      me.player.animations.play('north');
      socket.emit('move player', 'north');
  } else if (cursors.down.isDown) {       
      me.player.angle = 90;
      me.player.animations.play('south');
      socket.emit('move player', 'south');
  } else {
      me.player.animations.stop();
      currentSpeed = 0;
  }

  if (currentSpeed > 0) {
    game.physics.arcade.velocityFromRotation(me.player.rotation, currentSpeed, me.player.body.velocity);
    grass.tilePosition.x = -game.camera.x;
    grass.tilePosition.y = -game.camera.y;
  }
}


function render() {
  game.debug.text('FPS: ' + game.time.fps, 32, 32);
  // game.debug.text('HP: ' + player.minHP + ' / ' + player.maxHp, 32, 32);
  game.debug.text('X: ' + me.x + ' Y: ' + me.y, 32, 64);
}

socket = io.connect("http://localhost", {port: 8000, transports: ["websocket"]});

remotePlayers = [];

setEventHandlers();

function setEventHandlers() {
  socket.on("connect", onSocketConnected);
  socket.on("disconnect", onSocketDisconnect);
  socket.on("new player", onNewPlayer);
  socket.on("move player", onMovePlayer);
  socket.on("remove player", onRemovePlayer);
};


// Socket connected
function onSocketConnected() {
  console.log("Connected to socket server");

  me = new Player({x: game.world.width / 2, y: game.world.height / 2, id: 1}); //game.world.width / 2, y: game.world.height / 2
  socket.emit("new player", {x: me.x, y: me.y});
};

// Socket disconnected
function onSocketDisconnect() {
  console.log("Disconnected from socket server");
};

// New player
function onNewPlayer(data) {
  console.log("New player connected: "+data.id);
  // Initialise the new player
  var newPlayer = new Player(data);

  // Add new player to the remote players array
  remotePlayers.push(newPlayer);
};

// Move player
function onMovePlayer(data) {
  var movePlayer = playerById(data.id);

  // Player not found
  if (!movePlayer) {
    console.log("Player not found: "+data.id);
    return;
  };

  // Update player position
  movePlayer.x = data.x;
  movePlayer.y = data.y;
};

// Remove player
function onRemovePlayer(data) {
  var removePlayer = playerById(data.id);

  // Player not found
  if (!removePlayer) {
    console.log("Player not found: "+data.id);
    return;
  };

  // Remove player from array
  remotePlayers.splice(remotePlayers.indexOf(removePlayer), 1);
};

Player = function(data) {
  this.id = data.id;
  this.x = data.x;
  this.y = data.y;

  this.player = game.add.sprite(data.x, data.y, 'player');

  this.player.animations.add('east', [16,17,18,19,20,21,22,23], 8, true);
  this.player.animations.add('north', [0,1,2,3,4,5,6,7], 8, true);
  this.player.animations.add('west', [48,49,50,51,52,53,54,55], 8, true);
  this.player.animations.add('south', [32,33,34,35,36,37,38, 39], 8, true);

  return this;
};