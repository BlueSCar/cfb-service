module.exports = (RateLimiter, google, googleAuth, Promise, redisClient, json2csv, fs) => {
    let limiter = new RateLimiter(1, 100);

    let auth = new googleAuth();
    let oauth2Client = new auth.OAuth2();

    let SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.file'];
    let key = require('../googleAuth.json');

    let drive = google.drive('v3');
    let client = new google.auth.JWT(
        key.client_email,
        null,
        key.private_key,
        SCOPES
    );

    let setFolders = (year, week) => {

        return authorize()
            .then(setCredentials)
            .then(findRootFolder)
            .then(findPlayByPlayFolder)
            .then((result) => {
                return new Promise((resolve) => {
                    resolve({
                        year: year,
                        result: result
                    });
                });
            })
            .then(findYearFolder)
            .then(findYearSubFolders)
            .then((result) => {
                return new Promise((resolve) => {
                    resolve({
                        week: week,
                        result: result
                    });
                });
            })
            .then(findJSONWeekFolder)
            .then(findJSONWeekSubFolders)
            .then(storeFolderIds)
            .then(() => {
                return redisClient.getFolderId("CSV");
            })
            .then((id) => {
                return new Promise((resolve) => {
                    resolve({
                        year: year,
                        week: week,
                        id: id
                    });
                });
            })
            .then(createCSVFile)
            .then((result) => {
                return redisClient.setFileId('CSV', result.id);
            });
    }

    let removeTokens = () => {
        return Promise.fromCallback((cb) => limiter.removeTokens(1, cb));
    }

    let authorize = () => {
        return Promise.fromCallback((cb) => client.authorize(cb));
    }

    let setCredentials = (tokens, err) => {
        if (err) {
            console.log(err);
            return;
        }

        oauth2Client.setCredentials({
            access_token: tokens.access_token
        });

        return new Promise((resolve) => resolve({}));
    }

    let findRootFolder = () => {
        let action = () => {
            return Promise.fromCallback((cb) => drive.files.list({
                auth: oauth2Client,
                q: "mimeType='application/vnd.google-apps.folder' and name='CFB'"
            }, cb));
        };

        return removeTokens().then(action);
    }

    let findPlayByPlayFolder = (result) => {
        let rootId = result.files[0].id;
        let action = () => {
            return Promise.fromCallback((cb) => drive.files.list({
                auth: oauth2Client,
                q: `mimeType='application/vnd.google-apps.folder' and name='Play By Play' and '${rootId}' in parents`
            }, cb));
        };

        return removeTokens().then(action);
    }

    let findYearFolder = (result) => {
        let pbpId = result.result.files[0].id;
        let action = () => {
            return Promise.fromCallback((cb) => drive.files.list({
                auth: oauth2Client,
                q: `mimeType='application/vnd.google-apps.folder' and name='${result.year}' and '${pbpId}' in parents`
            }, cb));
        };

        return removeTokens().then(action);
    }

    let findYearSubFolders = (result) => {
        let yearId = result.files[0].id;
        let action = () => {
            return Promise.fromCallback((cb) => drive.files.list({
                auth: oauth2Client,
                q: `mimeType='application/vnd.google-apps.folder' and '${yearId}' in parents`
            }, cb));
        };

        return removeTokens().then(action);
    }

    let findJSONWeekFolder = (result) => {
        let jsonFolderId = result.result.files.find(f => f.name == "JSON").id;
        let csvFolderId = result.result.files.find(f => f.name == "CSV").id;
        let action = () => {
            return Promise.fromCallback((cb) => drive.files.list({
                auth: oauth2Client,
                q: `mimeType='application/vnd.google-apps.folder' and name='Week ${result.week}' and '${jsonFolderId}' in parents`
            }, cb));
        };

        redisClient.setFolderId("JSON", jsonFolderId);
        redisClient.setFolderId("CSV", csvFolderId);

        return removeTokens().then(action);
    }

    let findJSONWeekSubFolders = (result) => {
        let jsonWeekId = result.files[0].id;
        let action = () => {
            return Promise.fromCallback((cb) => drive.files.list({
                auth: oauth2Client,
                q: `mimeType='application/vnd.google-apps.folder' and '${jsonWeekId}' in parents`
            }, cb));
        };

        redisClient.setFolderId("JSONWeek", jsonWeekId);

        return removeTokens().then(action);
    }

    let storeFolderIds = (result) => {
        let jsonFullId = result.files.find(f => f.name == "full").id;
        let jsonFlattenedId = result.files.find(f => f.name == "flattened").id;

        return redisClient.setFolderId("JSONFull", jsonFullId)
            .then(() => {
                return redisClient.setFolderId("JSONFlat", jsonFlattenedId);
            });
    }

    let createCSVFile = (result) => {
        let driveResult;
        let Readable = require('stream').Readable;
        let stream = new Readable();
        stream.push(null);

        let action = () => {
            return Promise.fromCallback((cb) => drive.files.create({
                auth: oauth2Client,
                resource: {
                    'name': `PBP - ${result.year} - Week ${result.week}.csv`,
                    parents: [result.id]
                },
                media: {
                    mimeType: 'text/csv',
                    body: stream
                },
                fields: 'id'
            }, cb));
        };

        return removeTokens()
            .then(action)
            .then((result) => {
                driveResult = result;
                let header = '"gameId","year","week","homeId","homeTeam","homeAbbr","awayId","awayTeam","awayAbbr","driveIndex","playIndex","offenseId","offenseTeam","offenseAbbr","defenseId","defenseTeam","defenseAbbr","homeScore","awayScore","isScoringPlay","quarter","clock","type","down","distance","yardLine","yardsGained","endYardLine","description"';
                return Promise.fromCallback((cb) => fs.writeFile(`${process.env.CSV_PATH}${result.id}.csv`, header, cb));
            })
            .then(() => {
                return new Promise((resolve) => {
                    resolve(driveResult);
                })
            });
    }

    let getReadableStream = (result) => {
        let Readable = require('stream').Readable;
        let stream = new Readable();
        stream.push(JSON.stringify(result.json, null, '\t'));
        stream.push(null);
        result.stream = stream

        return new Promise((resolve) => {
            resolve(result);
        });
    }

    let writeJSONFile = (result) => {
        let action = () => {
            return Promise.fromCallback((cb) => drive.files.create({
                auth: oauth2Client,
                resource: {
                    'name': result.filename,
                    parents: [result.id]
                },
                media: {
                    mimeType: 'application/json',
                    body: result.stream
                },
                fields: 'id'
            }, cb));
        };

        return removeTokens().then(action);
    }

    let updateCSV = (result) => {
        let csv = '\r\n' + json2csv({
            hasCSVColumnTitle: false,
            data: result.json
        });

        return Promise.fromCallback((cb) => fs.appendFile(`${process.env.CSV_PATH}${result.id}.csv`, csv, cb));
    };

    let writeJSON = (filename, full, flattened) => {
        return authorize()
            .then(setCredentials)
            .then(() => redisClient.getFolderId('JSONFull'))
            .then((id) => {
                return new Promise((resolve) => {
                    resolve({
                        filename: filename,
                        id: id,
                        json: full
                    });
                });
            })
            .then(getReadableStream)
            .then(writeJSONFile)
            .then(() => redisClient.getFolderId('JSONFlat'))
            .then((id) => {
                return new Promise((resolve) => {
                    resolve({
                        filename: filename,
                        id: id,
                        json: flattened
                    });
                });
            })
            .then(getReadableStream)
            .then(writeJSONFile)
            .then(() => redisClient.getFileId("CSV"))
            .then((id) => {
                return new Promise((resolve) => {
                    resolve({
                        json: flattened,
                        id: id
                    });
                });
            })
            .then(updateCSV);
    }

    let uploadCSV = (count) => {
        if (count && count > 0) {
            let id;

            return redisClient.getFileId('CSV')
                .then((result) => {
                    id = result;
                    return new Promise(resolve => resolve({}));
                })
                .then(() => {
                    return Promise.fromCallback((cb) => fs.readFile(`${process.env.CSV_PATH}${id}.csv`, 'utf8', cb));
                })
                .then((content) => {
                    let Readable = require('stream').Readable;
                    let stream = new Readable();
                    stream.push(content);
                    stream.push(null);
                
                    return new Promise(resolve => resolve(stream));
                })
                .then((stream) => {
                    return Promise.fromCallback((cb) => drive.files.update({
                        auth: oauth2Client,
                        fileId: id,
                        media: {
                            body: stream
                        }
                    }, cb));
                });
        }
    }

    return {
        setFolders: setFolders,
        writeJSON: writeJSON,
        uploadCSV: uploadCSV
    }
}