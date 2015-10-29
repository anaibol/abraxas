class Map extends Phaser.State {
	preload() {
		Game.load.tilemap('tiles', 'assets/maps/1.json', null, Phaser.Tilemap.TILED_JSON)
		Game.load.image('tilesImage', 'assets/img/terrain_atlas.png');
		// Game.load.image('grass', 'assets/img/grass.png')
//
	}
	create() {
		// Game.world.setBounds(0, 0, config.MAX_MAP_X, config.MAX_MAP_Y)

		let map = Game.add.tilemap('tiles')
		map.addTilesetImage('tileSet', 'tilesImage')

		let layer = map.createLayer('floor')
		layer.resizeWorld()
		layer.debug = true
		layer.wrap = true

		this.cursors = Game.input.keyboard.createCursorKeys()

		// grass = Game.add.tileSprite(0, 0, config.MAX_MAP_X, config.MAX_MAP_Y, 'map')
		// grass.fixedToCamera = true

		// Game.camera.focusOnXY(0, 0)
		//
		// this.backgroundlayer = this.map.createLayer('background');
    // this.blockedLayer = this.map.createLayer('blockedLayer');

		// this.map.setCollisionBetween(1, 100, true, 'blockedLayer');

    //resizes the game world to match the layer dimensions
    // this.backgroundlayer.resizeWorld();

		this.coinPickupSound = Game.add.audio('coins',1,true);
		//
		new Player()
	}

	render() {
		Game.debug.text('FPS: ' + Game.time.fps, 32, 32)
	  // Game.debug.text('HP: ' + player.minHP + ' / ' + player.maxHp, 32, 32)
	  // Game.debug.text('X: ' + grass.tilePosition.x + ' Y: ' + grass.tilePosition.y, 32, 64)

	  // if (me) {
	    // Game.debug.text(Game.time.physicsElapsed, 32, 32)
	    // Game.debug.body(me.player)
	    // Game.debug.bodyInfo(me.player, 16, 24)
	  // }

	  // if (newPlayer) {
	  //   Game.debug.text(Game.time.physicsElapsed, 32, 32)
	  //   Game.debug.body(newPlayer.player)
	  //   Game.debug.bodyInfo(newPlayer.player, 16, 24)
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

export default Map
