import Player from '../Player'
import config from '../config'

class Play extends Phaser.State {

	preload() {
		game.load.tilemap('tiles', 'assets/maps/1.json', null, Phaser.Tilemap.TILED_JSON)
		game.load.image('tilesImage', 'assets/img/terrain_atlas.png')
		game.load.spritesheet('player', 'assets/img/dude.png', 27, 49)
	}

	create() {
		// game.plugins.add(Phaser.Plugin.Inspector)

		game.world.setBounds(0, 0, config.MAX_MAP_X, config.MAX_MAP_Y)

		const map = game.add.tilemap('tiles')
		map.addTilesetImage('tileSet', 'tilesImage')

		const layer = map.createLayer('floor')
		layer.resizeWorld()
		layer.debug = true
		layer.wrap = true


		game.load.spritesheet('player', 'assets/img/dude.png', 27, 49)

		game.cursors = game.input.keyboard.createCursorKeys()

		// const player = new Player(game, 10, 10)

		this.player = game.add.sprite( this.x * config.TILE_SIZE, this.y * config.TILE_SIZE, 'player')
    // this.player.animations.add('east', [16,17,18,19,20,21,22,23], 8, true)
    // this.player.animations.add('north', [0,1,2,3,4,5,6,7], 8, true)
    // this.player.animations.add('west', [48,49,50,51,52,53,54,55], 8, true)
    // this.player.animations.add('south', [32,33,34,35,36,37,38, 39], 8, true)

		this.physics.arcade.enable(this.player)
		this.player.body.collideWorldBounds = true;
    game.camera.follow(this.player)

		// this.player = Object.assign(this.player, new Player(10, 10))

		this.player.pos = {
			x: config.SCREEN_WIDTH / config.TILE_SIZE / 2,
			y: config.SCREEN_HEIGHT / config.TILE_SIZE / 2
		}

		this.player.x = this.player.pos.x * config.TILE_SIZE
		this.player.y = this.player.pos.y * config.TILE_SIZE
	}

	render() {
		// game.debug.text('FPS: ' + game.time.fps, 32, 32)
	  // game.debug.text('HP: ' + player.minHP + ' / ' + player.maxHp, 32, 32)
	  // game.debug.text('X: ' + this.player.x + ' Y: ' + this.player.y, 32, 64)

	  // if (me) {
	    // game.debug.text(game.time.physicsElapsed, 32, 32)
	    game.debug.body(this.player)
	    game.debug.bodyInfo(this.player, 16, 24)
	  // }

	  // if (newPlayer) {
	  //   game.debug.text(game.time.physicsElapsed, 32, 32)
	  //   game.debug.body(newPlayer.player)
	  //   game.debug.bodyInfo(newPlayer.player, 16, 24)
	  // }
	}

	update() {
		this.checkKeys()
		// this.player.marker.x = this.math.snapToFloor(Math.floor(this.player.x), 32) / 32;
		// this.player.marker.y = this.math.snapToFloor(Math.floor(this.player.y), 32) / 32;

	}

	checkKeys() {
	  if (game.cursors.left.isDown) {
	    this.moveMe(Phaser.LEFT)
	  } else if (game.cursors.right.isDown) {
	    this.moveMe(Phaser.RIGHT)
	  } else if (game.cursors.up.isDown) {
	    this.moveMe(Phaser.UP)
	  } else if (game.cursors.down.isDown) {
	    this.moveMe(Phaser.DOWN)
		} else {
			// this.stopMe()
		}
	}

	moveMe(direction) {
		// if (direction !== this.player.direction) {
		// 	return
		// }

		if (this.player.isMoving) return

	 	let pos = Object.assign({}, this.player.pos)


		switch (direction) {
			case Phaser.LEFT:
				pos.x--
				break

			case Phaser.RIGHT:
				pos.x++
				break

			case Phaser.UP:
				pos.y--
				break

			case Phaser.DOWN:
				pos.y++
				break

		}

		if (pos.x < config.SCREEN_WIDTH / config.TILE_SIZE / 2 * config.MIN_MAP_X - 1 ||
			pos.x > config.SCREEN_WIDTH / config.TILE_SIZE / 2 * config.MAX_MAP_X - 1 ||
			pos.y < config.SCREEN_HEIGHT / config.TILE_SIZE / 2 * config.MIN_MAP_Y - 1 ||
			pos.x > config.SCREEN_HEIGHT / config.TILE_SIZE / 2 * config.MAX_MAP_Y - 1) {
				return
		}

		this.player.pos = pos;

		this.moveChar(this.player)
	}

	stopMe() {
		// this.player.body.velocity.x = 0
		// this.player.body.velocity.y = 0
	}

	moveChar(char) {
		char.isMoving = true

		game.add.tween(char).to({
			x: char.pos.x * config.TILE_SIZE,
			y: char.pos.y * config.TILE_SIZE
		}, config.USERS_MOVE_SPEED, null, true).onComplete.add(function() {
			// Phaser.Easing.Quadratic.InOut
			char.isMoving = false
		}, this)
	}

  // let mapData = []
  //
  // for (let x = 0 x < maxMapX x++) {
  //   mapData[x] = []
  // }


  // function checkBounds() {
  //   return !(me.x < minMapX || me.x > maxMapX || me.y < minMapY || me.y > maxMapY)
  // }
}

export default Play
