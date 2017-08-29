try {
    require('dotenv').config();

    // depedencies
    let cfb = require('cfb-data');
    let fs = require('fs');
    let json2csv = require('json2csv');
    let RateLimiter = require('limiter').RateLimiter;
    let Promise = require('bluebird');
    let google = require('googleapis');
    let googleAuth = require('google-auth-library');
    let schedule = require('node-schedule');

    let redis = require('redis');
    let redisClient = require('./lib/redis')(redis, Promise);
    let driveClient = require('./lib/google')(RateLimiter, google, googleAuth, Promise, redisClient, json2csv, fs);
    let gamesClient = require('./lib/games')(cfb, driveClient, redisClient);

    let job = schedule.scheduleJob("* * * * *", gamesClient.syncGames);

} catch (err) {
    console.error(err);
}