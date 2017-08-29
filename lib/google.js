module.exports = (RateLimiter, google, googleAuth, Promise, redisClient) => {
    let limiter = new RateLimiter(1, 100);

    let auth = new googleAuth();
    let oauth2Client = new auth.OAuth2();

    let SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.file'];
    let key = require(process.env.TOKEN_PATH);

    let drive = google.drive('v3');
    let client = new google.auth.JWT(
        key.client_email,
        null,
        key.private_key,
        SCOPES
    );

    let setFolders = (year, week) => {

        authorize.then((err, tokens) => {
            if (err) {
                console.log(err);
                return;
            }

            oauth2Client.setCredentials({
                access_token: tokens.access_token
            });

            let rootFolderPromise = findRootFolder();
            let pbpFolderPromise = rootFolderPromise.then((result) => {
                let id = result.files[0].id;

                return findPlayByPlayFolder(id);
            });

            let yearFolderPromise = pbpFolderPromise.then((result) => {
                let id = result.files[0].id;

                return findYearFolder(year, id);
            });

            let yearSubFoldersPromise = yearFolderPromise.then((result) => {
                let id = result.files[0].id;

                return findYearSubFolders(id);
            });

            let jsonWeekFolderPromise = yearSubFoldersPromise.then((result) => {
                let jsonFolderId = result.files.find(f => f.name == "JSON").id;
                let csvFolderId = result.files.find(f => f.name == "CSV").id;

                redisClient.setFolderId("JSON", jsonFolderId);
                redisClient.setFolderId("CSV", csvFolderId);

                return findJSONWeekFolder(week, jsonFolderId);
            });

            let jsonWeekSubfoldersPromise = jsonWeekFolderPromise.then((result) => {
                let id = result.files[0].id;
                redisClient.setFolderId("JSONWeek", id);

                return findJSONWeekSubfolders(id);
            });

            return jsonWeekSubfoldersPromise.then((result) => {
                let jsonFullId = result.files.find(f => f.name == "full").id;
                let jsonFlattenedId = result.files.find(f => f.name == "flattened");

                return redisClient.setFolderId("JSONFull", jsonFullId)
                    .then(() => {
                        return redisClient.setFolderId("JSONFlat", jsonFlattenedId);
                    });
            });
        });
    }

    let authorize = () => {
        return Promise.fromCallback(cb => client.authorize(cb));
    }

    let findRootFolder = () => {
        var limiterPromise = Promise.fromCallback((cb) => limiter.removeTokens(1, cb));
        return limiterPromise.then(() => {
            return Promise.fromCallback((cb) => drive.files.list({
                auth: oauth2Client,
                q: "mimeType='application/vnd.google-apps.folder' and name='CFB'"
            }, cb));
        });
    }

    let findPlayByPlayFolder = (rootId) => {
        var limiterPromise = Promise.fromCallback((cb) => limiter.removeTokens(1, cb));
        return limiterPromise.then(() => {
            return Promise.fromCallback((cb) => drive.files.list({
                auth: oauth2Client,
                q: `mimeType='application/vnd.google-apps.folder' and name='Play By Play' and '${rootId}' in parents`
            }, cb));
        });
    }

    let findYearFolder = (year, pbpId) => {
        var limiterPromise = Promise.fromCallback((cb) => limiter.removeTokens(1, cb));
        return limiterPromise.then(() => {
            return Promise.fromCallback((cb) => drive.files.list({
                auth: oauth2Client,
                q: `mimeType='application/vnd.google-apps.folder' and name='${year}' and '${pbpId}' in parents`
            }, cb));
        });
    }

    let findYearSubFolders = (yearId) => {
        var limiterPromise = Promise.fromCallback((cb) => limiter.removeTokens(1, cb));
        return limiterPromise.then(() => {
            return Promise.fromCallback((cb) => drive.files.list({
                auth: oauth2Client,
                q: `mimeType='application/vnd.google-apps.folder' and '${yearId}' in parents`
            }, cb));
        });
    }

    let findJSONWeekFolder = (week, jsonId) => {
        var limiterPromise = Promise.fromCallback((cb) => limiter.removeTokens(1, cb));
        return limiterPromise.then(() => {
            return Promise.fromCallback((cb) => drive.files.list({
                auth: oauth2Client,
                q: `mimeType='application/vnd.google-apps.folder' and name='Week ${week}' and '${jsonId}' in parents`
            }, cb));
        });
    }

    let findJSONWeekSubfolders = (jsonWeekId) => {
        var limiterPromise = Promise.fromCallback((cb) => limiter.removeTokens(1, cb));
        return limiterPromise.then(() => {
            return Promise.fromCallback((cb) => drive.files.list({
                auth: oauth2Client,
                q: `mimeType='application/vnd.google-apps.folder' and '${jsonWeekId}' in parents`
            }, cb));
        });
    }

    let writeJSON = (filename, full, flattened) => {
        return redisClient.getFolderId('JSONFull')
            .then((id) => {
                client.authorize((err, tokens) => {
                    if (err) {
                        console.log(err);
                        return;
                    }

                    oauth2Client.setCredentials({
                        access_token: tokens.access_token
                    });

                    let Readable = require('stream').Readable;
                    let stream = new Readable();
                    stream.push(JSON.stringify(full, null, '\t'));
                    stream.push(null);

                    return Promise.fromCallback((cb) => limiter.removeTokens(1, cb))
                        .then(() => {
                            return Promise.fromCallback((cb) => drive.files.create({
                                auth: oauth2Client,
                                resource: {
                                    'name': filename,
                                    parents: [id]
                                },
                                media: {
                                    mimeType: 'application/json',
                                    body: stream
                                },
                                fields: 'id'
                            }, cb));
                        })
                        .then(() => {
                            return Promise.fromCallback((cb) => limiter.removeTokens(1, cb));
                        })
                        .then(() => {
                            return redisClient.getFolderId('JSONFlat');
                        })
                        .then((flatId) => {
                            let Readable = require('stream').Readable;
                            let flatStream = new Readable();
                            flatStream.push(JSON.stringify(flattened, null, '\t'));
                            flatStream.push(null);

                            return Promise.fromCallback((cb) => drive.files.create({
                                auth: oauth2Client,
                                resource: {
                                    'name': filename,
                                    parents: [flatId]
                                },
                                media: {
                                    mimeType: 'application/json',
                                    body: flatStream
                                },
                                fields: 'id'
                            }, cb));
                        });
                });
            });
    }

    return {
        setFolders: setFolders,
        writeJSON: writeJSON
    }
}