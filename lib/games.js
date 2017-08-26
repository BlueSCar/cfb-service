module.exports = (cfb, driveClient, redisClient) => {
    let syncGames = () => {
        getNewCompletedGames()
        .then((games) => {
            // do stuff
        });
    }

    let getNewCompletedGames = () => {
        return cfb.scoreboard.getScoreboard({
            groups: 80
        }).then((result) => {
            let year = result.season.year;
            let week = result.week.number;

            return updateWeek(year, week)
                .then(() => {
                    return redisClient.getGames();
                })
                .then((games) => {
                    let completedGames = result.events.filter(e => e.status.type.completed == true && games.indexOf(e.id) == -1);
                    return completedGames;
                });
        });
    }

    let updateWeek = (year, week) => {
        let updated = false;

        return redisClient
            .getYear()
            .then((result) => {
                if (result != year) {
                    redisClient.setYear(year);
                    updated = true;
                }
            })
            .then(() => {
                return redisClient.getWeek();
            })
            .then((result) => {
                if (result != week) {
                    redisClient.setWeek(week);
                    updated = true;
                }
            })
            .then(() => {
                if (updated) {
                    return driveClient.setFolders(year, week);
                }
            });
    }

    return {
        syncGames: syncGames
    }
}