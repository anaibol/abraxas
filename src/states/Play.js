import Player from '../Player'
import config from '../config'

class Play extends Phaser.State {

	preload() {
		game.load.tilemap('tiles', 'assets/maps/1.json', null, Phaser.Tilemap.TILED_JSON)
		game.load.image('tilesImage', 'assets/img/terrain_atlas.png')
		game.load.spritesheet('player', 'assets/img/dude.png', 27, 49)
	}

	create() {
		// game.world.setBounds(0, 0, config.MAX_MAP_X, config.MAX_MAP_Y)

		const map = game.add.tilemap('tiles')
		map.addTilesetImage('tileSet', 'tilesImage')

		const layer = map.createLayer('floor')
		layer.resizeWorld()
		layer.debug = true
		layer.wrap = true


		game.load.spritesheet('player', 'assets/img/dude.png', 27, 49)

		game.cursors = game.input.keyboard.createCursorKeys()

		const player = new Player(game, 10, 10)

		this.mainSprite = game.add.sprite( this.x * config.TILE_SIZE, this.y * config.TILE_SIZE, 'player')
    // this.mainSprite.animations.add('east', [16,17,18,19,20,21,22,23], 8, true)
    // this.mainSprite.animations.add('north', [0,1,2,3,4,5,6,7], 8, true)
    // this.mainSprite.animations.add('west', [48,49,50,51,52,53,54,55], 8, true)
    // this.mainSprite.animations.add('south', [32,33,34,35,36,37,38, 39], 8, true)

    this.physics.enable(this.mainSprite, Phaser.Physics.ARCADE);
    game.camera.follow(this.mainSprite);

		this.marker = this.game.add.graphics();
		this.marker.lineStyle(2, 0x000000, 1);

		this.input.onDown.add(function(event){
			// this.updateCursorPosition();
			player.moveTo(this.marker.x, this.marker.y, function(path){

			});
		}, this);

		// grass = game.add.tileSprite(0, 0, config.MAX_MAP_X, config.MAX_MAP_Y, 'map')
		// grass.fixedToCamera = true

		// game.camera.focusOnXY(0, 0)
		//
		// this.backgroundlayer = this.map.createLayer('background');
    // this.blockedLayer = this.map.createLayer('blockedLayer');

		// this.map.setCollisionBetween(1, 100, true, 'blockedLayer');

    //resizes the game world to match the layer dimensions
    // this.backgroundlayer.resizeWorld();

		// this.coinPickupSound = game.add.audio('coins',1,true);
		//

	}

	render() {
		game.debug.text('FPS: ' + game.time.fps, 32, 32)
	  // game.debug.text('HP: ' + player.minHP + ' / ' + player.maxHp, 32, 32)
	  // game.debug.text('X: ' + grass.tilePosition.x + ' Y: ' + grass.tilePosition.y, 32, 64)

	  // if (me) {
	    // game.debug.text(game.time.physicsElapsed, 32, 32)
	    // game.debug.body(me.player)
	    // game.debug.bodyInfo(me.player, 16, 24)
	  // }

	  // if (newPlayer) {
	  //   game.debug.text(game.time.physicsElapsed, 32, 32)
	  //   game.debug.body(newPlayer.player)
	  //   game.debug.bodyInfo(newPlayer.player, 16, 24)
	  // }
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
