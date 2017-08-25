try {
    require('dotenv').config();

    // depedencies
    let cfb = require('cfb-data');
    let RateLimiter = require('limiter').RateLimiter;
    let Promise = require('bluebird');
    let google = require('googleapis');
    let googleAuth = require('google-auth-library');

    let redis = require('redis');
    let client = redis.createClient();

    client.sadd("gameIds", "game1");
    client.sadd("gameIds", "game2");
    client.sadd("gameIds", "game3");

    Promise.fromCallback((cb) => client.smembers("gameIds", cb)).then((result) => {
        console.log(result);
    });

} catch (err) {
    console.error(err);
}