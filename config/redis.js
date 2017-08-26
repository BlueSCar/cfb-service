module.exports = (redis, Promise) => {
    let redis = redis;
    let Promise = Promise;

    let client = redis.createClient();

    this.setWeek = (week) => {
        client.set("seasonWeek", week);
    }

    this.getWeek = () => {
        return Promise.fromCallback((cb) => client.get("seasonWeek", cb));
    }

    this.setYear = (year) => {
        client.set("seasonYear", year);
    }

    this.getYear = () => {
        return Promise.fromCallback((cb) => client.get("seasonYear", cb));
    }

    this.clearGames = () => {
        client.del("gameIds");
    }

    this.addGame = (gameId) => {
        client.sadd("gameIds", gameId);
    }

    this.isGameAdded = (gameId) => {
        return Promise.fromCallback((cb) => client.sismember("gameIds", gameId, cb));
    }
}