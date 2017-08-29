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

    let getGames = () => {
        return Promise.fromCallback((cb) => client.smembers("gamesIds", cb));
    }

    let addGame = (gameId) => {
        client.sadd("gameIds", gameId);
    }

    let setFolderId = (folder, id) => {
        return Promise.fromCallback((cb) => client.set(`${folder}Folder`, id, cb));
    }

    let getFolderId = (folder) => {
        return Promise.fromCallback((cb) => client.get(`${folder}Folder`, cb));
    }

    let setFileId = (file, id) => {
        client.set(`${file}File`, id);
    }

    let getFileId = (file) => {
        return Promise.fromCallback((cb) => client.get(`${file}File`, cb));
    }

    return {
        setWeek: setWeek,
        setYear: setYear,
        getWeek: getWeek,
        getYear: getYear,
        clearGames: clearGames,
        addGame: addGame,
        getGames: getGames,
        setFolderId: setFolderId,
        getFolderId: getFolderId
    }
}