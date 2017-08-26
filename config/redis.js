module.exports = (redis, Promise) => {
    this.client = redis.createClient();

    let setWeek = (week) => {
        this.client.set("seasonWeek", week);
    }

    let getWeek = () => {
        return Promise.fromCallback((cb) => this.client.get("seasonWeek", cb));
    }

    let setYear = (year) => {
        client.set("seasonYear", year);
    }

    let getYear = () => {
        return Promise.fromCallback((cb) => this.client.get("seasonYear", cb));
    }

    let clearGames = () => {
        this.client.del("gameIds");
    }

    let addGame = (gameId) => {
        this.client.sadd("gameIds", gameId);
    }

    let isGameAdded = (gameId) => {
        return Promise.fromCallback((cb) => this.client.sismember("gameIds", gameId, cb));
    }

    return {
        setWeek: setWeek,
        setYear: setYear,
        getWeek: getWeek,
        getYear: getYear,
        clearGames: clearGames,
        addGame: addGame,
        isGameAdded: isGameAdded
    }
}