function loadCamera(){
    game.camera.follow(player);
    game.camera.follow(player, Phaser.Camera.FOLLOW_LOCKON);
    style = 'STYLE_LOCKON';
}

