import config from './config'
// import Boot from './boot'
import Game from './Game'
import Play from './states/Play'

window.game = new Game(config.SCREEN_WIDTH, conofig.SCREEN_HEIGHT)

game.state.add('Play', Play)
game.state.start('Play')
// game.state.start('Char')

// export default function() {

// const rnd = (min,max) => {
//   Math.floor(Math.random()*(max-min+1)+min)
// }


// window.addEventListener("deviceorientation", handleOrientation, true)


// function handleOrientation(e) {
//   const x = e.gamma
//   const y = e.beta
//   player.body.velocity.x -= x*2
//   player.body.velocity.y -= y*4
// }

// function createMe(id, x, y) {
//   mapData[5][5] = 1
//   me = new Player(id, x, y) //game.world.width / 2, y: game.world.height / 2
//
//   game.physics.enable(me.player, Phaser.Physics.ARCADE)
//   me.player.body.drag.set(0.2)
//   me.player.body.maxVelocity.setTo(200, 200)
//   me.player.body.collideWorldBounds = true
//   me.player.body.setSize(32, 32, 5, 16)
//   game.camera.follow(me.player)
//
//   // player.bringToTop()
// }
//
// let move_to_x
// let move_to_y


// function moveMe(direction) {
//   switch (direction) {
//     case 'east':
//     me.x++
//     game.camera.x++
//     move_to_x = me.player.x + 32
//
//     break
//     case 'west':
//     me.x--
//     game.camera.x--
//     move_to_x = me.player.x - 32
//
//     break
//     case 'north':
//     me.y++
//     game.camera.y++
//     move_to_y = me.player.y + 32
//
//     break
//     case 'south':
//     me.y++
//     game.camera.y--
//     move_to_y = me.player.y - 32
//
//     break
//   }
//
//   // if (!me.moving) {
//   //   game.add.tween(me.player).to({x: (me.x + 2) * tileSize, y: (me.y + 2) * tileSize}, 2000, Phaser.Easing.Quadratic.InOut, true).onComplete.add(function() { me.moving = false}, this)
//   //   me.moving = true
//   // }
//
//   if (!me.moving || me.direction !== direction) {
//     me.moving = true
//     me.direction = direction
//
//     socket.emit('move player', direction)
//
//
//     currentSpeed = 32
//     me.player.animations.play(me.direction)
//     game.physics.arcade.velocityFromRotation(me.player.rotation, currentSpeed, me.player.body.velocity)
//     grass.tilePosition.x = -game.camera.x
//     grass.tilePosition.y = -game.camera.y
//   }
// }

// function movePlayer(player, direction) {
//   switch (direction) {
//     case 'east':
//     me.x++
//
//     break
//     case 'west':
//     me.x--
//
//     break
//     case 'north':
//     me.y++
//
//     break
//     case 'south':
//     me.y--
//
//     break
//   }
//
//   // if (!me.moving) {
//   //   game.add.tween(me.player).to({x: (me.x + 2) * tileSize, y: (me.y + 2) * tileSize}, 2000, Phaser.Easing.Quadratic.InOut, true).onComplete.add(function() { me.moving = false}, this)
//   //   me.moving = true
//   // }
//
//   if (!player.moving || player.direction !== direction) {
//     player.moving = true
//     player.direction = direction
//     console.log({x: player.x, y: player.y})
//
//     currentSpeed = 32
//     player.player.animations.play(player.direction)
//     game.physics.arcade.velocityFromRotation(player.player.rotation, currentSpeed, player.player.body.velocity)
//   }
// }

// function stopPlayer(player) {
//   player.moving = false
//   player.player.animations.stop()
//   currentSpeed = 0
//   game.physics.arcade.velocityFromRotation(player.player.rotation, currentSpeed, player.player.body.velocity)
//   // me.player.frame = 0
// }


// const socket = io('http://localhost:3000')

// remotePlayers = []
//
// setEventHandlers()
//
// function setEventHandlers() {
//   socket.on("connect", onSocketConnected)
//   socket.on("disconnect", onSocketDisconnect)
//   socket.on("new player", onNewPlayer)
//   socket.on("move player", onMovePlayer)
//   socket.on("remove player", onRemovePlayer)
//   socket.on("logged in", onLoggedIn)
// }
//
// // Socket connected
// function onSocketConnected() {
//   console.log("Connected to socket server")
//   socket.emit("log in", {x: rnd(0, 10), y: rnd(0, 10)})
// }
//
// // Socket disconnected
// function onSocketDisconnect() {
//   console.log("Disconnected from socket server")
// }
//
// function onLoggedIn(data) {
//   createMe(data.id, data.x, data.y)
//   console.log(data.id)
// }
//
//
// // New player
// function onNewPlayer(data) {
//   console.log("New player connected: " + data.id)
//   newPlayer = new Player(data.id, data.x, data.y)
//
//   game.physics.enable(newPlayer.player, Phaser.Physics.ARCADE)
//   newPlayer.player.body.drag.set(0.2)
//   newPlayer.player.body.maxVelocity.setTo(200, 200)
//   newPlayer.player.body.setSize(32, 32, 5, 16)
//
//   // Add new player to the remote players array
//   remotePlayers.push(newPlayer)
// }

// Move player
// function onMovePlayer(data) {
//   const player = playerById(data.id)
//
//   // Player not found
//   if (!player) {
//     console.log("Player not found: "+data.id)
//     return
//   }
//
//   movePlayer(player, data.direction)
// }
//
// function onRemovePlayer(data) {
//   const removePlayer = playerById(data.id)
//
//   // Player not found
//   if (!removePlayer) {
//     console.log("Player not found: "+data.id)
//     return
//   }
//
//   // Remove player from array
//   remotePlayers.splice(remotePlayers.indexOf(removePlayer), 1)
//
//   newPlayer.player.kill()
//   console.log(remotePlayers.length)
// }


// function playerById(id) {
//   for (let i = 0 i < remotePlayers.length i++) {
//     if (remotePlayers[i].id == id) {
//       return remotePlayers[i]
//     }
//   }
//
//   return false
// }
