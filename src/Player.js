import Char from './Char'

class Player extends Char {
  constructor(id, x, y) {
    super()

    this.game = game

    this.id = id
    this.x = x
    this.y = y

    console.log(this);
    return this
  }
}

export default Player
