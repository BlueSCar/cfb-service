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
                });
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
        let results = [];

        let getNext = (data) => {};
        // {
        //     if (data.length > 0) {
        //         console.log(`Grabbed ${year} page ${page}`);
        //         results = results.concat(data);
        //         page++;
        //         console.log(`Moving onto ${year} page ${page}`);

        //         cfb.recruiting.getSchoolRankings({
        //                 year: year,
        //                 page: page
        //             })
        //             .then(getNext);
        //     } else {
        //         console.log(`Data grabbed for ${year}! Writing files...`);

        //         for (var i = 1; i <= results.length; i++) {
        //             results[i - 1].ranking = i;
        //         }

        //         fs.writeFile(dir + `JSON\\${year} School Rankings.json`, JSON.stringify(results));

        //         var csv = json2csv({
        //             data: results
        //         });

        //         fs.writeFile(dir + `CSV\\${year} School Rankings.csv`, csv);

        //         console.log(`Data written for ${year}`);
        //     }
        // };

        cfb.games.getPlayByPlay(games[0].id)
            .then(writeData)
            .then(getNext);
    }

    let writeData = (data) => {
        let gameId = data.id;
        let homeTeam = data.teams.filter(t => t.homeAway == "home")[0].team;
        let awayTeam = data.teams.filter(t => t.homeAway == "away")[0].team;

        if (!data.drives || !data.drives.previous) {
            console.log('Missing PBP: ' + data.id + ' (' + year + ' Week ' + week + ' ' + team1 + '-' + team2 + ')');
            return new Promise();
        }

        let flattened = getFlattenedData(data, homeTeam, awayTeam);

        return driveClient.writeJSON(``, data, flattened)
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
                    isScore: playData.isScore,
                    quarter: playData.period.number,
                    clock: playData.clock.displayValue,
                    wallclock: playData.wallclock,
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