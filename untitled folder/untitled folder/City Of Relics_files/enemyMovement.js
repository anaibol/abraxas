function randomMovement(){
  var random = game.rnd.integerInRange(0, 2);
    return random;
}



function moveEnemy(enemy, i){
   
    if (timer[i] > 32){
       
       enemy.randomX = randomMovement();
       enemy.randomY = randomMovement();
   timer[i] = 0;
      
}
timer[i]++;
 /*
  if(rest[i] > 50){
        enemy.randomX = 0;
        enemy.randomY = 0;
        rest[i] = 0; 
    }
        rest[i]++;

*/

/*
 * 0 = 0 movement
 * 1 = postive movement
 * 2 = negative movement
 */

if (enemy.randomX === 1 && enemy.randomY === 1){
     enemy.body.velocity.x = 75;
     enemy.body.velocity.y = 75;
     enemy.animations.play('southEast');
}else if (enemy.randomX === 1 && enemy.randomY === 0){
     enemy.body.velocity.x = 75;
     enemy.body.velocity.y = 0;
     enemy.animations.play('east');
}else if (enemy.randomX === 1 && enemy.randomY === 2){
     enemy.body.velocity.x = 75;
     enemy.body.velocity.y = -75;
     enemy.animations.play('northEast');
     } else if (enemy.randomX === 0 && enemy.randomY === 1){
     enemy.body.velocity.x = 0;
     enemy.body.velocity.y = 75;
     enemy.animations.play('south');
}else if (enemy.randomX === 0 && enemy.randomY === 2){
     enemy.body.velocity.x = 0;
     enemy.body.velocity.y = -75;
     enemy.animations.play('north');
}else if (enemy.randomX === 2 && enemy.randomY === 1){
     enemy.body.velocity.x = -75;
     enemy.body.velocity.y = 75;
     enemy.animations.play('southWest');
}else if (enemy.randomX === 2 && enemy.randomY === 0){
     enemy.body.velocity.x = -75;
     enemy.body.velocity.y = 0;
     enemy.animations.play('west');
}else if (enemy.randomX === 2 && enemy.randomY === 2){
     enemy.body.velocity.x = -75;
     enemy.body.velocity.y = -75;
     enemy.animations.play('northWest');
}else{
     enemy.body.velocity.x = 0;
     enemy.body.velocity.y = 0;
    enemy.animations.stop();
}


 /*
 switch (enemy.randomX){
        case 2:
           enemy.body.velocity.x = -75;
        break;
    case 1:
        enemy.body.velocity.x = 75;
        break;
    default:
        enemy.body.velocity.x = 0;
    }
    
     switch (enemy.randomY){
        case 2:
            enemy.body.velocity.y = -75;
        break;
    case 1:
        enemy.body.velocity.y = 75;
        break;
    default:
        enemy.body.velocity.y = 0;
    }

     

   
   
    */
}
