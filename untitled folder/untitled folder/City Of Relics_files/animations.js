function loadPlayerAnimations(){
    
    //player movement animations
    player.animations.add('east', [16,17,18,19,20,21,22,23], 8, true);
    player.animations.add('north', [0,1,2,3,4,5,6,7], 8, true);
    player.animations.add('west', [48,49,50,51,52,53,54,55], 8, true);
     player.animations.add('south', [32,33,34,35,36,37,38, 39], 8, true);
}

function  loadZoneOneEnemyAnimations(enemy){
     enemy.animations.add('east', [16,17,18,19,20,21,22,23], 8, true);
     enemy.animations.add('north', [0,1,2,3,4,5,6,7], 8, true);
     enemy.animations.add('west', [48,49,50,51,52,53,54,55], 8, true);
     enemy.animations.add('south', [32,33,34,35,36,37,38, 39], 8, true);
     enemy.animations.add('northEast', [9,10,11,12,13,14,15,16], 8, true);
     enemy.animations.add('northWest', [56,57,58,59,60,61,62,63], 8, true);
     enemy.animations.add('southWest', [40,41,42,43,44,45,46,47], 8, true);
     enemy.animations.add('southEast', [24,25,26,27,28,29,30,31], 8, true);
}
