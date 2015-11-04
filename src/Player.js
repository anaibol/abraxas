import Char from './Char'
import config from './config'

class Player extends Phaser.Sprite {
  constructor(id, name, x, y) {
    super()

    this.pos = {x, y}

    this.id = id

    this.body = game.add.sprite(x * config.TILE_SIZE, y * config.TILE_SIZE, 'player')


    // game.add.sprite(x, y, 'player')

    // Phaser.Sprite.call(game, x, y, 'bunny');

    return this
  }
}

export default Player
