function rain(){
    var emitter = game.add.emitter(game.world.centerX, 0, 400);
	emitter.width = game.world.width;
	// emitter.angle = 30; // uncomment to set an angle for the rain.

	emitter.makeParticles('rain');
	emitter.maxParticleScale = 0.5;
	emitter.minParticleScale = 0.1;
	emitter.setYSpeed(300, 500);
	emitter.setXSpeed(-5, 5);
	emitter.minRotation = 0;
	emitter.maxRotation = 0;

	emitter.start(false, 1600, 5, 0);

}

