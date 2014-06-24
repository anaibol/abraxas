function rnd(min,max)
{
    return Math.floor(Math.random()*(max-min+1)+min);
}

var screenWidth = 800;
var screenHeight = 600;

var tileSize = 32;

var minMapX = 0;
var minMapY = 0;
var maxMapX = 100;
var maxMapY = 100;

var viewPortTileWidth = screenWidth / tileSize;
var viewPortTileHeight = screenHeight / tileSize;

var maxX = maxMapX * tileSize;
var maxY = maxMapY * tileSize;

var phaser = {
  preload: preload,
  create: create,
  update: update,
  render: render
};

var game = new Phaser.Game(screenWidth, screenHeight, Phaser.AUTO, '', phaser);
 
// var map;
var me;
var newPlayer;
var him;
var player;
var cursors;

var grass;

var currentSpeed;

var mapData = [];

for (var x = 0; x < maxMapX; x++) {
  mapData[x] = [];
}

//window.addEventListener("deviceorientation", handleOrientation, true);


// function handleOrientation(e) {
//     var x = e.gamma;    var y = e.beta;     player.body.velocity.x -= x*2;
//     player.body.velocity.y -= y*4;
// }

function preload() {
    game.load.image('grass', 'img/grass.png');
    game.load.spritesheet('player', 'img/dude.png', 27, 49);
}
 
function create() {
    game.world.setBounds(0, 0, maxX, maxY);
    game.add.sprite(0, 0, 'grass');

    grass = game.add.tileSprite(0, 0, maxX, maxY, 'grass');
    grass.fixedToCamera = true;

    // game.camera.focusOnXY(0, 0);

    cursors = game.input.keyboard.createCursorKeys();
}

function update() {
  if (!me) return;
  // game.physics.arcade.overlap(player, null, this);

  checkKeys();
}


function render() {
   // game.debug.text('FPS: ' + game.time.fps, 32, 32);
   // game.debug.text('HP: ' + player.minHP + ' / ' + player.maxHp, 32, 32);
    // game.debug.text('X: ' + grass.tilePosition.x + ' Y: ' + grass.tilePosition.y, 32, 64);

    if (me) {

    game.debug.text(game.time.physicsElapsed, 32, 32);
    game.debug.body(me.player);
    game.debug.bodyInfo(me.player, 16, 24);
    }

    if (newPlayer) {
    game.debug.text(game.time.physicsElapsed, 32, 32);
    game.debug.body(me.player);
    game.debug.bodyInfo(me.player, 16, 24);
    }

}


function Player(x, y, id) {
  this.x = x;
  this.y = y;
  this.id = id;


  //game.world.width / tileSize / 2

  this.player = game.add.sprite(this.x * tileSize, this.y * tileSize, 'player');

  this.player.animations.add('east', [16,17,18,19,20,21,22,23], 8, true);
  this.player.animations.add('north', [0,1,2,3,4,5,6,7], 8, true);
  this.player.animations.add('west', [48,49,50,51,52,53,54,55], 8, true);
  this.player.animations.add('south', [32,33,34,35,36,37,38, 39], 8, true);

  return this;
};

function createMe() {
  mapData[5][5] = 1;
  me = new Player(rnd(1, 5), rnd(1, 5), 1); //game.world.width / 2, y: game.world.height / 2

  game.physics.enable(me.player, Phaser.Physics.ARCADE);
  me.player.body.drag.set(0.2);
  me.player.body.maxVelocity.setTo(200, 200);
  me.player.body.collideWorldBounds = true;
  me.player.body.setSize(32, 32, 5, 16);
  game.camera.follow(me.player);

  // player.bringToTop();  
}

var move_to_x;
var move_to_y;

function checkKeys() {
  // console.log(me.player.x )


  if (!checkBounds()) {
    stopPlayer();
    return;
  };


  // console.log(grass.tilePosition.x)
  // console.log(game.camera.x)
  // console.log(game.camera.x % tileSize)

  if (cursors.right.isDown) {
      me.player.angle = 0;
      moveMe('east');

  } else if (cursors.left.isDown) {
      me.player.angle = 180;
      moveMe('west');

  } else if (cursors.up.isDown) {       
      me.player.angle = 270;
      moveMe('north');
  } else if (cursors.down.isDown) {       
      me.player.angle = 90;
      moveMe('south');

  } else {
    switch (me.direction) {
      case 'east':
        if(me.player.x >= move_to_x){
          stopPlayer()
        }

        break;
      case 'west':
        if(me.player.x <= move_to_x){
          stopPlayer()
        }

        break;
      case 'north':
        if(me.player.y >= move_to_y){
          stopPlayer()
        }

        break;
      case 'south':
        if(me.player.y <= move_to_y){
          stopPlayer()
        }

        break;
    }
  }


  // console.log(game.camera.x)
  // console.log(game.camera.x % tileSize)

}

function moveMe(direction) {
  switch (direction) {
    case 'east':
      me.x++
      game.camera.x++
      move_to_x = me.player.x + 32;

      break;
    case 'west':
      me.x--
      game.camera.x--
      move_to_x = me.player.x - 32;

      break;
    case 'north':
      me.y++
      game.camera.y++
      move_to_y = me.player.y + 32;

      break;
    case 'south':
      me.y++
      game.camera.y--
      move_to_y = me.player.y - 32;

      break;
  }

  if (!me.moving || me.direction !== direction) {
    me.moving = true;
    me.direction = direction;
    socket.emit('move player', {x: me.x, y: me.y});


    currentSpeed = 32;
    me.player.animations.play(me.direction);
    game.physics.arcade.velocityFromRotation(me.player.rotation, currentSpeed, me.player.body.velocity);
    grass.tilePosition.x = -game.camera.x;
    grass.tilePosition.y = -game.camera.y;
  }
}

function stopPlayer() {
  me.moving = false;
  me.player.animations.stop();
  currentSpeed = 0;
  game.physics.arcade.velocityFromRotation(me.player.rotation, currentSpeed, me.player.body.velocity);
  // me.player.frame = 0;
}

function checkBounds() {
  return !(me.x < minMapX || me.x > maxMapX || me.y < minMapY || me.y > maxMapY);
}


var socket = io('http://localhost:3000');

remotePlayers = []

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

  createMe();
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
  newPlayer = new Player(data.x, data.y);

  game.physics.enable(newPlayer.player, Phaser.Physics.ARCADE);
  newPlayer.player.body.drag.set(0.2);
  newPlayer.player.body.maxVelocity.setTo(200, 200);
  newPlayer.player.body.setSize(32, 32, 5, 16);

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

function onRemovePlayer(data) {
  var removePlayer = playerById(data.id);

  // Player not found
  if (!removePlayer) {
    console.log("Player not found: "+data.id);
    return;
  };

  // Remove player from array
  remotePlayers.splice(remotePlayers.indexOf(removePlayer), 1);

  newPlayer.player.kill()
};