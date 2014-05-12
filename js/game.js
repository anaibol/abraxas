var width = 800;
var height = 600;

var game = new Phaser.Game(width, height, Phaser.AUTO, '', { preload: preload, create: create, update: update, render: render });
 
// var map;
var player;
var cursors; 

var minX = 0;
var minY = 0;
var maxX = 1400;
var maxY = 1400;

var grass;

window.addEventListener("deviceorientation", handleOrientation, true);


function handleOrientation(e) {
    var x = e.gamma;    var y = e.beta;     player.body.velocity.x -= x*2;
    player.body.velocity.y -= y*4;
}

function preload() {
    game.load.image('grass', 'img/grass.png');
     game.load.spritesheet('player', 'img/dude.png', 27, 49);
}
 
function create() {
    game.world.setBounds(minX, minY, maxX, maxY);
    game.add.sprite(0, 0, 'grass');

    grass = game.add.tileSprite(0, 0, width, height, 'grass');
    grass.fixedToCamera = true;


    player = game.add.sprite(game.world.width / 2  , game.world.height / 2, 'player');
    player.anchor.setTo(0.5, 0.5);

    player.animations.add('east', [16,17,18,19,20,21,22,23], 8, true);
    player.animations.add('north', [0,1,2,3,4,5,6,7], 8, true);
    player.animations.add('west', [48,49,50,51,52,53,54,55], 8, true);
     player.animations.add('south', [32,33,34,35,36,37,38, 39], 8, true);


    //  This will force it to decelerate and limit its speed
    game.physics.enable(player, Phaser.Physics.ARCADE);
    player.body.drag.set(0.2);
    player.body.maxVelocity.setTo(400, 400);
    player.body.collideWorldBounds = true;

    // player.bringToTop();




    game.camera.follow(player);
    // game.camera.focusOnXY(0, 0);

    cursors = game.input.keyboard.createCursorKeys();
}
 
function update() {

    // game.physics.arcade.overlap(player, null, this);
     
    currentSpeed = 200

   if (cursors.right.isDown)
    {
        player.animations.play('east');
        player.angle = 0;
    }else if (cursors.left.isDown)
    {
        player.angle = 180;
        player.animations.play('west');
    }else if (cursors.up.isDown)
    {       
        player.angle = 270;
        player.animations.play('north');
         
    }else if (cursors.down.isDown)
    {       
        player.angle = 90;
        player.animations.play('south');
    }else {
        
        //stop the animation but keep player facing same direction
        player.animations.stop();
         currentSpeed = 0
        
    }


    game.physics.arcade.velocityFromRotation(player.rotation, currentSpeed, player.body.velocity);

    grass.tilePosition.x = -game.camera.x;
    grass.tilePosition.y = -game.camera.y;

}


function render() {
   game.debug.text('FPS: ' + game.time.fps, 32, 32);
   // game.debug.text('HP: ' + player.minHP + ' / ' + player.maxHp, 32, 32);
    game.debug.text('X: ' + grass.tilePosition.x + ' Y: ' + grass.tilePosition.y, 32, 64);
}