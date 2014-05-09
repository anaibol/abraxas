function loadPlayerImage(){
    game.load.spritesheet('player', 'assets/players/walkingSwordMan.png', 96, 96);
    
}

function loadPlayer(){
    player = game.add.sprite(playerStartX, playerStartY, 'player'); //add our sprite based on what the player picked
     player.anchor.setTo(0.5, 0.5); // set an anchor for our camera to grab
  //  player.body.setRectangle(-32,0,64,64);
    player.body.immovable = true;
}

//call this on level unload
function destoryPlayer(){
    
}

/*
 * setup our functions to load NPCs and enemies by zones
 * destroy our NPCs and ememies by Zones
 */


function loadZoneOneNPC(){
    
}

function loadZoneOneEnemyImages(){
    game.load.spritesheet('orge', 'assets/enemies/GTW.png', 96, 96);
   
}

function loadZoneOneEnemy(){
     
    for (i=0; i < orgeNumber; i++){
    var randomX = game.rnd.integerInRange(minX, maxX);
     var randomY = game.rnd.integerInRange(minY, maxY);     
     
    orge[i] = game.add.sprite(randomX, randomY, 'orge');     
   
       enemyGroup.add(orge[i]);
       
      orge[i].inputEnabled = true;
    orge[i].events.onInputDown.add(actions,this);
 
    }
}

 actions = function(orge){
  
 var distanceX = player.x - orge.x;
 var distanceY = player.y - orge.y;
 
 if (distanceX < 0){
     distanceX = distanceX * -1;
 }
  if (distanceY < 0){
     distanceY = distanceY * -1;
 }
 
 if (distanceX > 150 || distanceY > 150){
     randomID.innerHTML = "Your target is too far way";
 }else{
 
 attack(2, player.hp, 10, orge.hp, orge);
 }
}

function destroyZoneOneNPC(){
    
}

function destoryZoneOneEnemy(){
    
}