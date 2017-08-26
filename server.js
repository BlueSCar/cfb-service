try {
    require('dotenv').config();

    // depedencies
    let cfb = require('cfb-data');
    let RateLimiter = require('limiter').RateLimiter;
    let Promise = require('bluebird');
    let google = require('googleapis');
    let googleAuth = require('google-auth-library');

    let redis = require('redis');
    let redisClient = require('./lib/redis')(redis, Promise);

    let driveClient = require('./lib/google')(RateLimiter, google, googleAuth, Promise, redisClient);
    driveClient.setFolders(2017, 1);

} catch (err) {
    console.error(err);
}