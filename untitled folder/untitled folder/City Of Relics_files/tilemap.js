function loadZoneOneImages() {
    game.load.image('floor', 'assets/enviroment/floor.jpg');

    game.load.tilemap('town', 'assets/levels/town.json', null, Phaser.Tilemap.TILED_JSON);
    game.load.image('walls', 'assets/levels/walls.png');
    game.load.image('broken', 'assets/levels/brokenWall.png');
    game.load.image('towers', 'assets/levels/towers.png');
    game.load.image('house', 'assets/levels/house.png');
    game.load.image('grass', 'assets/enviroment/grass01.png');
     game.load.image('castleWall', 'assets/levels/castleWall.png');
}

function loadZoneOneMaps() {

    map = game.add.tilemap('town');
    map.addTilesetImage('walls');
   map.addTilesetImage('broken');
   map.addTilesetImage('towers');
    map.addTilesetImage('house');
   map.addTilesetImage('grass');
   map.setCollisionBetween(1,20);
   map.setCollisionBetween(25,28);
   map.setCollisionBetween(33,48);
   map.addTilesetImage('castleWall');
  
   
    grassLayer = map.createLayer('grass');
    layer = map.createLayer('walls', 800, 600);
     
    
  
 // layer.resizeWorld();
   
}

function destoryZoneOne() {

}

