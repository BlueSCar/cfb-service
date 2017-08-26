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
        client.authorize((err, tokens) => {
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

            jsonWeekSubfoldersPromise.then((result) => {
                let jsonFullId = result.files.find(f => f.name == "full").id;
                let jsonFlattenedId = result.files.find(f => f.name == "flattened");

                redisClient.setFolderId("JSONFull", jsonFullId);
                redisClient.setFolderId("JSONFlat", jsonFlattenedId);
            });
        });
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

    return {
        setFolders: setFolders
    }
}