module.exports = (redis, Promise) => {
    let client = redis.createClient();

    let setWeek = (week) => {
        client.set("seasonWeek", week);
    }

    let getWeek = () => {
        return Promise.fromCallback((cb) => client.get("seasonWeek", cb));
    }

    let setYear = (year) => {
        client.set("seasonYear", year);
    }

    let getYear = () => {
        return Promise.fromCallback((cb) => client.get("seasonYear", cb));
    }

    let clearGames = () => {
        client.del("gameIds");
    }

    let addGame = (gameId) => {
        client.sadd("gameIds", gameId);
    }

    let isGameAdded = (gameId) => {
        return Promise.fromCallback((cb) => client.sismember("gameIds", gameId, cb));
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