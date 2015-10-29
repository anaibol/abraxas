import config from './config'

class Game extends Phaser.Game {
	constructor() {
    super(config.SCREEN_WIDTH, config.SCREEN_HEIGHT, Phaser.Canvas, config.RENDER_ID)
	}
}

export default Game
