try {
    require('dotenv').config();

    // depedencies
    let cfb = require('cfb-data');
    let RateLimiter = require('limiter').RateLimiter;
    let Promise = require('bluebird');
    let google = require('googleapis');
    let googleAuth = require('google-auth-library');

    let redis = require('redis');

    let redisClient = require('./config/redis')(redis, Promise);

    redisClient.setWeek(1);
    redisClient.setYear(2017);
    redisClient.getWeek().then((result) => console.log(result));
    redisClient.getYear().then((result) => console.log(result));

    redisClient.addGame("123123");
    redisClient.isGameAdded("123123").then((result) => console.log(result));
    redisClient.clearGames();

    client.sadd("gameIds", "game1");
    client.sadd("gameIds", "game2");
    client.sadd("gameIds", "game3");

} catch (err) {
    console.error(err);
}