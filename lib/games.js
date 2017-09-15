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
                })
                .then((completedGames) => {
                    return syncGameResults(completedGames);
                })
                .then(driveClient.uploadCSV);
        });
    }

    let updateWeek = (year, week) => {
        let updated = false;

        return redisClient
            .getYear()
            .then((result) => {
                if (result != year) {
                    updated = true;
                    return redisClient.setYear(year);
                }
            })
            .then(() => {
                return redisClient.getWeek();
            })
            .then((result) => {
                if (result != week) {
                    updated = true;
                    return redisClient.setWeek(week);
                }
            })
            .then(() => {
                if (updated) {
                    return driveClient.setFolders(year, week);
                }
            });
    }

    let syncGameResults = (games) => {
        let index = 0;

        let getNext = () => {
            if (index < games.length) {
                index++;
                return cfb.games.getPlayByPlay(games[index - 1].id)
                    .then(writeData)
                    .then(getNext);
            } else {
                return new Promise((resolve) => resolve({}));
            }
        }

        return getNext()
            .then(() => {
                return new Promise(resolve => resolve(games.length));
            });
    }

    let writeData = (data) => {
        if (data.competitions[0].status.type.state != "post") {
            return Promise.resolve({});
        }

        let gameId = data.id;
        let homeTeam = data.teams.filter(t => t.homeAway == "home")[0].team;
        let awayTeam = data.teams.filter(t => t.homeAway == "away")[0].team;

        if (!data.drives || !data.drives.previous) {
            console.log('Missing PBP: ' + data.id + ' (' + data.season.year + ' Week ' + data.week + ' ' + homeTeam.location + '-' + awayTeam.location + ')');
            return Promise.resolve({});
        }

        let flattened = getFlattenedData(data, homeTeam, awayTeam);

        return driveClient.writeJSON(`${data.id} - ${homeTeam.location} vs ${awayTeam.location}`, data, flattened)
            .then(() => redisClient.addGame(gameId));
    }

    let getFlattenedData = (data, homeTeam, awayTeam) => {
        var plays = [];

        for (index in data.drives.previous) {
            var drive = data.drives.previous[index];

            for (pIndex in drive.plays) {
                var playData = drive.plays[pIndex];
                if (!playData.start.team) {
                    continue;
                }

                var offenseTeam = playData.start.team.id == homeTeam.id ? homeTeam : awayTeam;
                var defenseTeam = playData.start.team.id == homeTeam.id ? awayTeam : homeTeam;

                var play = {
                    gameId: data.id,
                    year: data.season.year,
                    week: data.week,
                    homeId: homeTeam.id,
                    homeTeam: homeTeam.nickname,
                    homeAbbr: homeTeam.abbreviation,
                    awayId: awayTeam.id,
                    awayTeam: awayTeam.nickname,
                    awayAbbr: awayTeam.abbreviation,
                    driveIndex: index,
                    playIndex: pIndex,
                    offenseId: offenseTeam.id,
                    offenseTeam: offenseTeam.nickname,
                    offenseAbbr: offenseTeam.abbreviation,
                    defenseId: defenseTeam.id,
                    defenseTeam: defenseTeam.nickname,
                    defenseAbbr: defenseTeam.abbreviation,
                    homeScore: playData.homeScore,
                    awayScore: playData.awayScore,
                    isScore: playData.scoringPlay,
                    quarter: playData.period.number,
                    clock: playData.clock.displayValue,
                    type: playData.hasOwnProperty('type') ? playData.type.text : '',
                    down: playData.start.down,
                    distance: playData.start.distance,
                    yardLine: playData.start.yardLine,
                    yardsGained: playData.statYardage,
                    endYardLine: playData.end.yardLine,
                    description: playData.text
                };

                plays.push(play);
            }
        }

        return plays;
    };

    return {
        syncGames: syncGames
    }
}