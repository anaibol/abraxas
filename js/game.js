var width = 800;
var height = 600;

var game = new Phaser.Game(width, height, Phaser.AUTO, '', { preload: preload, create: create, update: update, render: render });
 
var map;
var tileset;
var layer;
var player;
var cursors; 


var playerSpeed = 450;
var playerLevel = 1;

var minX = 0;
var minY = 0;
var maxX = 1400;
var maxY = 1400;

function preload() {
    game.load.image('grass', 'img/grass.png');
    // game.load.spritesheet('dude', 'img/dude.png', 32, 48);

    // game.load.tilemap("map", "map.json", null, Phaser.Tilemap.TILED_JSON);
    // game.load.tileset("tiles", "img/grass.png", 32, 32);


     game.load.spritesheet('player', 'img/dude.png', 32, 32);
}
 
function create() {
    // game.stage.backgroundColor = '#000000';
    game.world.setBounds(minX, minY, maxX, maxY);

    cursors = game.input.keyboard.createCursorKeys();

    game.add.sprite(0, 0, 'grass');

    grass = game.add.tileSprite(0, 0, maxX, maxY, 'grass');

    // map = game.add.tilemap('map');
    // map.addTilesetImage('grass');

    // layer = map.createLayer('Ground');
    // console.log(layer)
    // layer.resizeWorld();

    player = game.add.sprite(game.world.width / 2  , game.world.height / 2, 'player');

     player.anchor.setTo(0.5, 0.5); // set an anchor for our camera to grab
  // //  player.body.setRectangle(-32,0,64,64);
    // player.body.immovable = true;

    player.animations.add('east', [16,17,18,19,20,21,22,23], 8, true);
    player.animations.add('north', [0,1,2,3,4,5,6,7], 8, true);
    player.animations.add('west', [48,49,50,51,52,53,54,55], 8, true);
     player.animations.add('south', [32,33,34,35,36,37,38, 39], 8, true);

29
47
    game.camera.follow(player);

    //game.add.sprite(300, 200, 'player');
    //  Un-comment this on to see the collision tiles
    // layer.debug = true;
    // layerGround.resizeWorld();
}
 
function update() {
   //  game.physics.startSystem(Phaser.Physics.P2JS);
   // game.physics.collide(player);



    // console.log(player.body)
    // console.log(player.body.velocity)
    //  player.body.velocity.x = 0;
    //  player.body.velocity.y = 0;
     
   if (cursors.right.isDown)
    {       
        // player.body.velocity.x = playerSpeed; 
        player.animations.play('east');
    }else if (cursors.left.isDown)
    {       
        // player.body.velocity.x = -playerSpeed; 
        player.animations.play('west');
    }else if (cursors.up.isDown)
    {       
        // player.body.velocity.y = -playerSpeed; 
        player.animations.play('north');
    }else if (cursors.down.isDown)
    {       
        // player.body.velocity.y = playerSpeed; 
        player.animations.play('south');
    }else {
        
        //stop the animation but keep player facing same direction
        player.animations.stop();
        
    }

}


function render() {
   game.debug.text('FPS: ' + game.time.fps, 32, 32);
   game.debug.text('HP: ' + player.minHP + ' / ' + player.maxHp, 32, 32);
}