import preload fom './states/preload'
import create fom './states/create'
import updaate fom './states/updaate'
import render fom './states/render'

const phaser = { preload, create, update, render }

const screenWidth = 800
const screenHeight = 600

const tileSize = 32

const minMapX = 0
const minMapY = 0
const maxMapX = 100
const maxMapY = 100

const viewPortTileWidth = screenWidth / tileSize
const viewPortTileHeight = screenHeight / tileSize

const maxX = maxMapX * tileSize
const maxY = maxMapY * tileSize

class Game {
  constructor() {
    // Create game object.
    // this.game = new Phaser.Game(Configuration.GAME_WIDTH, Configuration.GAME_HEIGHT, Phaser.Canvas, Configuration.GAME_RENDER_ID)
    this.game = new Phaser.Game(screenWidth, screenHeight, Phaser.AUTO, '', phaser)
  }
}

export default Game;
