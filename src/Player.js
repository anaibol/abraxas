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


// class Character {
//     constructor(settings) {
//         Object.assign(this, Character.defaultSettings, settings);
//         Object.assign(this, Character.defaultNumbers, settings);
//     }
//
//     resetNumbers() {
//         Object.assign(this, Character.defaultNumbers);
//     }
//
//     static get defaultSettings() {
//         return {
//
//             // Identifier of character, ex. goku, vegeta
//             id: 'unknown',
//
//             // User put his favourite nickname.
//             nickname: 'unknown',
//
//             // Name of character: Son Goku or Vegeta.
//             name: 'unknown'
//         };
//     }
//
//     static get defaultNumbers() {
//         return {
//
//             // Number of lives.
//             up: 0,
//
//             // Percent of health. Decrease. When =0, up -1.
//             hp: 100,
//
//             // Number of skills. Increase. When =100, level +1 and reduce =0.
//             exp: 0,
//
//             // Number of level. Max lvl=100
//             lvl: 1
//         };
//     }
// }
//
// export default Character;
