try {
    require('dotenv').config();

    // depedencies
    let cfb = require('cfb-data');
    let RateLimiter = require('limiter').RateLimiter;
    let Promise = require('bluebird');
    let google = require('google');
    let googleAuth = require('google-auth-library');

    

} catch (err) {
    console.error(error);
}