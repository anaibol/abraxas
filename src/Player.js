import Char from './Char'

class Player extends Char {
  constructor(game, id, x, y) {
    super()

    this.game = game

    this.id = id
  }
}

export default Player
