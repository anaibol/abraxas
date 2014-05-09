function movePlayer(){
    
    /* start velocity at 0 
    * get movement from key pressed
    * move player with velocity
    * play correct movement animation
    */
    
     player.body.velocity.x = 0;
     player.body.velocity.y = 0;
     
   if (cursors.right.isDown)
    {       
        player.body.velocity.x = playerSpeed; 
        player.animations.play('east');
    }else if (cursors.left.isDown)
    {       
        player.body.velocity.x = -playerSpeed; 
        player.animations.play('west');
    }else if (cursors.up.isDown)
    {       
        player.body.velocity.y = -playerSpeed; 
        player.animations.play('north');
    }else if (cursors.down.isDown)
    {       
        player.body.velocity.y = playerSpeed; 
        player.animations.play('south');
    }else {
        
        //stop the animation but keep player facing same direction
        player.animations.stop();
        
    }
}

function setWorldBounds(){
    player.body.collideWorldBounds = true;
   for (i=0;i<orgeNumber;i++){
       orge[i].body.collideWorldBounds = true;
   }
}