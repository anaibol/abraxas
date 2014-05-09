function playerHP(){
   hp = 100;
   return hp;
}

function enemyHP(){
   hp = 25;
   return hp;
}


function attack(weaponMod, playerHP, attack, enemyHP, enemy){
    
   enemy.hp = playerAttack(weaponMod, enemyHP);
    if (enemy.hp <= 0){
        enemy.hp = 0;
        death(enemy);
    }
    
  player.hp = enemyAttack(attack, playerHP);
    
    if (player.hp <= 0){
       player.hp = 0;
        death(player);
    }
    
    randomID.innerHTML = "player = " + player.hp + " enemy = " + enemy.hp;
}

function playerAttack(weaponMod, enemyHP){
 var baseHit = 10;
 hit = baseHit + playerLevel + weaponMod;
 
 var newEnemyHP = enemyHP - hit;
 
 return newEnemyHP;
    
}

function enemyAttack(attack, playerHP){
 var  newPlayerHP = playerHP - attack;
    return newPlayerHP;
}

function death(sprite){
   /*play death animation
    * wait 5 seconds then kill sprite
    */
    sprite.kill();
}