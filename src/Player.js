class Player {
  constructor() {
    this.id = id
    this.x = x
    this.y = y


    //game.world.width / tileSize / 2

    this.player = game.add.sprite(this.x * tileSize, this.y * tileSize, 'player')
    //this.player = game.add.sprite(this.x * tileSize, this.y * tileSize, 'player')

    this.player.animations.add('east', [16,17,18,19,20,21,22,23], 8, true)
    this.player.animations.add('north', [0,1,2,3,4,5,6,7], 8, true)
    this.player.animations.add('west', [48,49,50,51,52,53,54,55], 8, true)
    this.player.animations.add('south', [32,33,34,35,36,37,38, 39], 8, true)
  }
}

export default Player
