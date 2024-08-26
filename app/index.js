var express = require('express');
var engine = require('ejs-locals');
var Request = require("request");
var nodemailer = require('nodemailer');
const uuid = require('uuid/v4')
const session = require('express-session')
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const readXlsxFile = require('read-excel-file/node');
var fs = require('fs');
var querystring = require('querystring');
var multer = require('multer')
var upload = multer({ dest: './excels' })
var excel = require('excel4node');

var bodyParser = require('body-parser')

var app = express();

// Chargement de socket.io
var server = require('http').Server(app);
var io = require('socket.io')(server);

app.engine('ejs', engine);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

const baseURL = "http://vps-d12f2153.vps.ovh.net:3000";
const baseURLNoPort = "http://vps-d12f2153.vps.ovh.net";
const baseURLNoPortNoHttp = "vps-d12f2153.vps.ovh.net";

// const baseURL = "http://localhost:3000";
// const baseURLNoPort = "http://localhost";
// const baseURLNoPortNoHttp = "localhost";

passport.use(new LocalStrategy(
    {
        usernameField: 'bannerid',
        passwordField: 'password'
    },
    (bannerid, password, done) => {
        var url = baseURL + "/user/" + bannerid.toUpperCase();
        var promiseUserConnection = Request.get(url, (error, response, body) => {
            if (error) {
                return done(error);
            }

            if (response.statusCode == 404) {
                return done(null, false, { message: "L'utilisateur n'est pas autorisé à entrer dans le CMT" });
            }
            else {

                var user = JSON.parse(body);

                if (user[0].Activated != 1) {
                    return done(null, false, { message: "L'utilisateur n'est pas créé ou n'a pas activé son compte. Créez un compte ou vérifiez vos mails (spams)" });
                }
                else if (user[0].Password !== password) {
                    return done(null, false, { message: "Le BannerID ou le mot de passe est incorect" });
                }

                return done(null, user[0]);
            }

        });
    }
));

// tell passport how to serialize the user
passport.serializeUser((user, done) => {
    done(null, user.BannerID);
});

passport.deserializeUser((bannerid, done) => {
    var url = baseURL + "/user/" + bannerid;
    var promiseUserConnection = Request.get(url, (error, response, body) => {
        if (error) {
            return done(error);
        }

        var user = JSON.parse(body);

        return done(null, user[0]);

    });
});

app.use(session({
    genid: (req) => {
        return uuid() // use UUIDs for session IDs
    },
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true
}))
app.use(passport.initialize());
app.use(passport.session());

app.use(bodyParser.json())

var urlencodedParser = bodyParser.urlencoded({ extended: true })

app.get('/', function (req, res) {

    if (req.isAuthenticated()) {
        return res.redirect('/home');
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});

app.get('/admin', function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            var url = baseURL + "/studies/";
            var promiseStudies = Request.get(url, (error, response, body) => {
                if (error) {
                    return console.dir(error);
                }

                if (response.statusCode === 404) {
                    res.send("404 not found");
                }
                var studies = JSON.parse(body);

                return res.render("admin/admin-home.ejs", { studies: studies });
            });
        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});


app.get('/admin/users', function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            res.render("admin/users/users-home.ejs", { info: "", error: "" });
        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});

app.get('/admin/users/new-one', function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            res.render("admin/users/create-one.ejs");
        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});

app.post('/admin/users/new-one', urlencodedParser, function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            var http = require('http');

            var bodyString = querystring.stringify({
                bannerID: req.body.bannerid.toUpperCase(),
                prenom: req.body.firstname,
                nom: req.body.lastname
            });

            var headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': bodyString.length
            };

            var options = {
                host: baseURLNoPortNoHttp,
                path: '/user/create/',
                port: 3000,
                method: 'POST',
                headers: headers
            };

            var callback = function (response) {
                var str = '';

                //another chunk of data has been recieved, so append it to `str`
                response.on('data', function (chunk) {
                    str += chunk;
                });

                //the whole response has been recieved, so we just print it out here
                response.on('end', function () {

                    str = JSON.parse(str);
                    if (response.statusCode == 404 || str.n === 0) {
                        return res.render('admin/users/users-home.ejs', { info: "", error: str });
                    }
                    else {
                        return res.render('admin/users/users-home.ejs', { info: { message: "L'utilisateur a bien été créé" }, error: "" });
                    }

                });
            };


            http.request(options, callback).write(bodyString);
        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});

app.get('/admin/studies/new-one', function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            res.render("admin/studies/create-one.ejs");
        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});

app.post('/admin/studies/new-one', urlencodedParser, function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            var http = require('http');

            var bodyString = querystring.stringify({
                trimestre: req.body.trimestre,
                year: req.body.year,
                bdeName: req.body.bdeName
            });

            var headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': bodyString.length
            };

            var options = {
                host: baseURLNoPortNoHttp,
                path: '/studies/create/',
                port: 3000,
                method: 'POST',
                headers: headers
            };

            var callback = function (response) {
                var str = '';

                //another chunk of data has been recieved, so append it to `str`
                response.on('data', function (chunk) {
                    str += chunk;
                });

                //the whole response has been recieved, so we just print it out here
                response.on('end', function () {

                    var study = JSON.parse(str);
                    return res.redirect('/admin/studies/' + study.Identifiant + '/fill/0');
                });
            };
            http.request(options, callback).write(bodyString);


        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});

app.get('/admin/studies/:studyId/modify', function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            var studyId = req.params.studyId;

            var url = baseURL + "/studies/" + studyId;
            var promiseStudy = Request.get(url, (error, response, body) => {
                if (error) {
                    return console.dir(error);
                }

                if (response.statusCode === 404) {
                    res.send("404 not found");
                }
                var study = JSON.parse(body);


                return res.render('admin/studies/modify.ejs', { study: study });
            });

        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }

})

app.post('/admin/studies/:studyId/modify', urlencodedParser, function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            var identifiant = req.params.studyId;
            var trimestre = req.body.trimestre;
            var annee = req.body.year;
            var bde = req.body.bdeName;

            var http = require('http');

            var bodyString = querystring.stringify({
                trimestre: trimestre,
                annee: annee,
                bde: bde
            });

            var headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': bodyString.length
            };

            var options = {
                host: baseURLNoPortNoHttp,
                path: '/studies/' + identifiant + '/modify',
                port: 3000,
                method: 'POST',
                headers: headers
            };

            var callback = function (response) {
                var str = '';

                //another chunk of data has been recieved, so append it to `str`
                response.on('data', function (chunk) {
                    str += chunk;
                });

                //the whole response has been recieved, so we just print it out here
                response.on('end', function () {

                    return res.redirect('/admin/studies/' + identifiant + "/fill/0");
                });
            };

            http.request(options, callback).write(bodyString);


        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});

app.get('/admin/studies/:studyId/fill/:day', function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            var day = req.params.day;
            var studyId = req.params.studyId;

            var url = baseURL + "/studies/" + studyId;
            var promiseStudy = Request.get(url, (error, response, body) => {
                if (error) {
                    return console.dir(error);
                }

                if (response.statusCode === 404) {
                    res.send("404 not found");
                }
                var study = JSON.parse(body);

                var days = ["Intensive", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

                var courses = study[days[day]];

                return res.render('admin/studies/fill-day.ejs', { day: day, studyId: studyId, courses: courses });
            });

        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});

app.post('/admin/studies/:studyId/fill/:day', urlencodedParser, function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            var nbCourse = parseInt(req.body['nbCourse'])
            var courses = [];

            for (var i = 1; i <= nbCourse; i++) {
                var strCodeCourse = "code-course-" + i;
                var strNameCourse = "name-course-" + i;
                var strProfCourse = "prof-course-" + i;
                var strProfAdd1 = "add-prof-" + i + "-1";
                var strProfAdd2 = "add-prof-" + i + "-2";
                var strProfAdd3 = "add-prof-" + i + "-3";

                var codeCourse = req.body[strCodeCourse];
                var nameCourse = req.body[strNameCourse];
                var profCourse = req.body[strProfCourse];
                var profAdd1 = req.body[strProfAdd1];
                var profAdd2 = req.body[strProfAdd2];
                var profAdd3 = req.body[strProfAdd3];

                if (!Array.isArray(profCourse)) {
                    if (profCourse == null) {
                        profCourse = []
                    }
                    else {
                        profCourse = [profCourse];
                    }
                }

                if (profAdd1 != '') {
                    profCourse.push(profAdd1);
                }
                if (profAdd2 != '') {
                    profCourse.push(profAdd2);
                }
                if (profAdd3 != '') {
                    profCourse.push(profAdd3);
                }

                var course = { CodeCours: codeCourse, NomCours: nameCourse, Professeur: profCourse };
                courses.push(course);
            }

            var http = require('http');

            var bodyString = querystring.stringify({
                identifiant: req.params.studyId,
                day: req.params.day,
                courses: JSON.stringify(courses)
            });

            var headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': bodyString.length
            };

            var options = {
                host: baseURLNoPortNoHttp,
                path: '/studies/fillday/',
                port: 3000,
                method: 'POST',
                headers: headers
            };

            var callback = function (response) {
                var str = '';

                //another chunk of data has been recieved, so append it to `str`
                response.on('data', function (chunk) {
                    str += chunk;
                });

                //the whole response has been recieved, so we just print it out here
                response.on('end', function () {

                    var nextDay = Number(req.params.day) + 1;
                    var studyId = req.params.studyId;


                    if (nextDay < 6) {
                        return res.redirect('/admin/studies/' + studyId + "/fill/" + nextDay);
                    }
                    else {
                        return res.redirect('/admin/studies/' + studyId);
                    }
                });
            };

            http.request(options, callback).write(bodyString);


        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});

app.get('/admin/studies/:studyId', function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            var studyId = req.params.studyId;

            var url = baseURL + "/studies/" + studyId;
            var promiseStudy = Request.get(url, (error, response, body) => {
                if (error) {
                    return console.dir(error);
                }

                if (response.statusCode === 404) {
                    res.send("404 not found");
                }
                var study = JSON.parse(body);

                return res.render('admin/studies/see-study.ejs', { study: study });
            });

        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});

app.get('/admin/studies/:studyId/activate', function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            var url = baseURL + "/studies/" + req.params.studyId + '/activate';
            Request.get(url, (error, response, body) => {
                if (error) {
                    return console.dir(error);
                }

                if (response.statusCode === 404) {
                    return res.send("404 not found")
                }

                return res.redirect('/admin');
            });
        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});

app.get('/admin/studies/:studyId/deactivate', function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            var url = baseURL + "/studies/" + req.params.studyId + '/deactivate';
            Request.get(url, (error, response, body) => {
                if (error) {
                    return console.dir(error);
                }

                if (response.statusCode === 404) {
                    return res.send("404 not found")
                }

                return res.redirect('/admin');
            });
        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});

app.get('/admin/users/new-many', function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            return res.render("admin/users/create-many.ejs", { info: "", error: "" });
        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});

app.post('/admin/users/new-many', upload.single('excelFile'), function (req, res, next) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            readXlsxFile(req.file.path).then((rows) => {

                const insertNewUser = ((bannerID, nom, prenom) => {
                    return new Promise((resolve, reject) => {

                        var http = require('http');

                        var bodyString = querystring.stringify({
                            bannerID: bannerID,
                            prenom: prenom,
                            nom: nom
                        });

                        var headers = {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Content-Length': bodyString.length
                        };

                        var options = {
                            host: baseURLNoPortNoHttp,
                            path: '/user/create/',
                            port: 3000,
                            method: 'POST',
                            headers: headers
                        };

                        var callback = function (response) {
                            var str = '';

                            //another chunk of data has been recieved, so append it to `str`
                            response.on('data', function (chunk) {
                                str += chunk;
                            });

                            //the whole response has been recieved, so we just print it out here
                            response.on('end', function () {

                                str = JSON.parse(str);
                                var resp = {
                                    statusCode: response.statusCode,
                                    message: str.message
                                }
                                resolve(resp);
                            });
                        };


                        http.request(options, callback).write(bodyString);

                    })
                })

                const loop = (async () => {
                    try {
                        var numberUsers = rows.length;

                        var nbDone = 0;
                        var nbError = 0;

                        var errors = [];

                        for (var i = 1; i < numberUsers; i++) {
                            var bannerID = rows[i][0].toUpperCase();
                            var nom = rows[i][1];
                            var prenom = rows[i][2];

                            const response = await insertNewUser(bannerID, nom, prenom);

                            if (response.statusCode !== 200) {
                                nbError++;
                                error = {
                                    ligne: i + 1,
                                    bannerID: bannerID,
                                    nom: nom,
                                    prenom: prenom,
                                    erreur: response.message
                                }
                                errors.push(error)
                            }
                            else {
                                nbDone++
                            }
                            io.emit('progressInsertMany', i / (numberUsers - 1));
                        }


                        fs.unlink(req.file.path, (err) => {
                            if (err) throw err;
                        });

                        return res.render('admin/users/report-users-created.ejs', { nbDone: nbDone, errors: errors });

                    } catch (error) {
                        console.error('ERROR:');
                        console.error(error);
                    }
                })

                loop();

            });
        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});

app.get('/study/:studyId', function (req, res) {

    var studyId = req.params.studyId;

    var url = baseURL + "/studies/" + studyId;
    var promiseStudy = Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            res.send("404 not found");
        }
        var study = JSON.parse(body);

        if (study.Activated == 1) {
            return res.render('studies/introduction.ejs', { study: study });
        }
        else {
            return res.render('studies/study-deactivated.ejs');
        }


    });
});

app.get('/study/:studyId/fill', function (req, res) {

    var studyId = req.params.studyId;

    return res.render('studies/fill-study.ejs', { studyId: studyId });
});

app.post('/study/:studyId/fill', urlencodedParser, function (req, res, next) {

    var studyId = req.params.studyId;
    var nomCours = req.body.nomCours;

    var user = req.user != undefined ? req.user.BannerID : '';

    if (nomCours != '') {

        var bodyString = querystring.stringify({
            StudyId: studyId,
            NomCours: nomCours,
            CodeCours: req.body.codeCours,
            Prof1: req.body.prof1,
            Prof2: req.body.prof2,
            Prof3: req.body.prof3,
            Prof4: req.body.prof4,
            CommentCours: req.body.commentCours,
            CommentProf: req.body.commentProf,
            NoteCours: req.body.noteCours,
            NoteProf: req.body.noteProf,
            Jour: req.body.jour,
            Heure: req.body.heure,
            Tour: req.body.tour,
            PointMises: req.body.points,
            Trimestre: req.body.trimestre,
            Annee: req.body.annee,
            BDE: req.body.bde,
            User: user
        });

        var http = require('http');

        var headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': bodyString.length
        };

        var options = {
            host: baseURLNoPortNoHttp,
            path: '/avis/create/',
            port: 3000,
            method: 'POST',
            headers: headers
        };

        var callback = function (response) {
            var str = '';

            //another chunk of data has been recieved, so append it to `str`
            response.on('data', function (chunk) {
                str += chunk;
            });

            //the whole response has been recieved, so we just print it out here
            response.on('end', function () {
                return res.redirect('/study/' + studyId + '/thanks');
            });
        };


        http.request(options, callback).write(bodyString);
    }

});

app.get('/study/:studyId/thanks', function (req, res) {

    var studyId = req.params.studyId;

    return res.render('studies/thanks.ejs', { studyId: studyId });
});

app.get('/admin/study/:studyId/export-excel', function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            var studyId = req.params.studyId;

            var workbook = new excel.Workbook();

            var worksheet = workbook.addWorksheet('Feuille 1');

            worksheet.cell(1, 1).string("Code Cours / Course Code");
            worksheet.cell(1, 2).string("Cours / Course");
            worksheet.cell(1, 3).string("Professeur / Professor");
            worksheet.cell(1, 4).string("Commentaire (Contenu) / Comment (Course Content)");
            worksheet.cell(1, 5).string("Commentaires (Professeur) / Comment (Professor)");
            worksheet.cell(1, 6).string("Note Contenu / Grade Course Content");
            worksheet.cell(1, 7).string("Note Pédagogie / Grade Pedagogy");
            worksheet.cell(1, 8).string("Jour / Day");
            worksheet.cell(1, 9).string("Heure / Time");
            worksheet.cell(1, 10).string("Tour / Round");
            worksheet.cell(1, 11).string("Points misés / Bidding");
            worksheet.cell(1, 12).string("Approuvé / Approved");

            var url = baseURL + "/studies/" + studyId + '/avis';
            Request.get(url, (error, response, body) => {
                if (error) {
                    return console.dir(error);
                }

                if (response.statusCode === 404) {
                    return res.send(body);
                }
                var avisByStudy = JSON.parse(body);

                for (var i = 0; i < avisByStudy.length; i++) {
                    worksheet.cell(i + 2, 1).string(avisByStudy[i].CodeCours);
                    worksheet.cell(i + 2, 2).string(avisByStudy[i].NomCours);
                    worksheet.cell(i + 2, 3).string(avisByStudy[i].Professeur);
                    worksheet.cell(i + 2, 4).string(avisByStudy[i].CommentCours);
                    worksheet.cell(i + 2, 5).string(avisByStudy[i].CommentProf);

                    if (typeof avisByStudy[i].NoteCours === "number") {
                        worksheet.cell(i + 2, 6).number(avisByStudy[i].NoteCours);
                    }
                    else {
                        worksheet.cell(i + 2, 6).string(avisByStudy[i].NoteCours);
                    }

                    if (typeof avisByStudy[i].NoteProf === "number") {
                        worksheet.cell(i + 2, 7).number(avisByStudy[i].NoteProf);
                    }
                    else {
                        worksheet.cell(i + 2, 7).string(avisByStudy[i].NoteProf);
                    }

                    worksheet.cell(i + 2, 8).string(avisByStudy[i].Jour);
                    worksheet.cell(i + 2, 9).string(avisByStudy[i].Heure);
                    worksheet.cell(i + 2, 10).string(avisByStudy[i].Tour);


                    if (typeof avisByStudy[i].PointMises === "number") {
                        worksheet.cell(i + 2, 11).number(avisByStudy[i].PointMises);
                    }
                    else {
                        worksheet.cell(i + 2, 11).string(avisByStudy[i].PointMises);
                    }

                    if (avisByStudy[i].Approved == 1) {
                        worksheet.cell(i + 2, 12).string("Oui");
                    }
                    else {
                        worksheet.cell(i + 2, 12).string("Non");
                    }
                }

                return workbook.write('study-' + studyId + '.xlsx', res);
            });
        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
})

app.get('/admin/users/search-user', function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            res.render("admin/users/search-user.ejs");
        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});

app.get('/admin/users/:bannerID/reset', function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            var url = baseURL + "/user/" + req.params.bannerID + "/reset";
            Request.get(url, (error, response, body) => {
                if (error) {
                    return res.render('admin/users/users-home.ejs', { info: "", error: error });
                }

                if (response.statusCode === 404) {
                    return res.render('admin/users/users-home.ejs', { info: "", error: { message: "L'utilisateur n'existe pas" } });
                }
                else {
                    return res.render('admin/users/users-home.ejs', { info: { message: "Le compte a été réinitialisé" }, error: "" });
                }
            });
        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});

app.get('/admin/users/:bannerID/make-admin', function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            var url = baseURL + "/user/" + req.params.bannerID + "/make-admin";
            Request.get(url, (error, response, body) => {
                if (error) {
                    return res.render('admin/users/users-home.ejs', { info: "", error: error });
                }

                if (response.statusCode === 404) {
                    return res.render('admin/users/users-home.ejs', { info: "", error: { message: "L'utilisateur n'existe pas" } });
                }
                else {
                    return res.render('admin/users/users-home.ejs', { info: { message: "Le compte a est désormais admin" }, error: "" });
                }
            });
        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});


app.get('/admin/avis', function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            res.render("admin/avis-home.ejs");
        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});


app.get('/admin/profs-cours', function (req, res) {

    if (req.isAuthenticated()) {
        if (req.user.Admin === 1) {
            var url = baseURL + "/courses/";
            var promiseSearch = Request.get(url, (error, response, body) => {
                if (error) {
                    return console.dir(error);
                }

                if (response.statusCode === 404) {
                    res.send("404 not found");
                }
                var courses = JSON.parse(body);

                res.render("admin/profs-cours-home.ejs", { courses: courses });
            });
        }
        else {
            return res.send('404 Not Found');
        }
    }
    else {
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: "" });
    }
});

app.post('/signin', urlencodedParser, function (req, res, next) {
    passport.authenticate('local', function (err, user, info) {
        if (err) {
            return res.render('signin.ejs', { infoSignin: "", errorSignin: err, errorSignup: "" });
        }
        if (!user) {
            return res.render('signin.ejs', { infoSignin: "", errorSignin: info, errorSignup: "" });
        }
        req.logIn(user, function (err) {
            if (err) {
                return res.render('signin.ejs', { infoSignin: "", errorSignin: err, errorSignup: "" });
            }

            return res.redirect('/Home');
        });
    })(req, res, next);
});

app.get('/signout', function (req, res) {
    req.logout();
    res.redirect('/');
});

app.get('/search', function (req, res) {

    if (!req.isAuthenticated()) {
        return res.redirect('/');
    }

    const query = req.query.query;

    if (query == "") {
        return res.render('search.ejs', { courses: [], query: query })
    }

    var url = baseURL + "/courses/" + query + "/search";
    var promiseSearch = Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            res.send("404 not found");
        }
        var courses = JSON.parse(body);
        return res.render('search.ejs', { courses: courses, query: query })
    });

});

app.get('/cours/:coursID/avis', function (req, res) {

    if (!req.isAuthenticated()) {
        return res.redirect('/');
    }

    const coursID = req.params.coursID;

    var url = baseURL + "/cours/" + coursID + "/avis";
    var promiseOverallRates = Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            res.send("not found");
        }
        var avis = JSON.parse(body);
        res.render('coursAvis.ejs', { avis: avis })
    });
});

app.get('/cours/:coursID/createAvis', function (req, res) {

    if (!req.isAuthenticated()) {
        return res.redirect('/');
    }

    const coursID = req.params.coursID;

    var url = baseURL + "/courses/" + coursID;
    var promiseCreateCourseAvis = Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            return res.send("not found");
        }
        var course = JSON.parse(body);
        return res.render('createAvis.ejs', { course: course })
    });
});

app.get('/cours', function (req, res) {

    if (!req.isAuthenticated()) {
        return res.redirect('/');
    }

    var url = baseURL + "/cours";
    var promiseAllCourses = Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            res.send("not found");
        }
        var allCourses = JSON.parse(body);
        res.render('allCourses.ejs', { allCourses: allCourses })
    });
});

app.get('/profs', function (req, res) {

    if (!req.isAuthenticated()) {
        return res.redirect('/');
    }

    var url = baseURL + "/profs";
    var promiseAllProfs = Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            res.send("not found");
        }
        var allProfs = JSON.parse(body);
        res.render('allProfs.ejs', { allProfs: allProfs })
    });
});

app.get('/home', function (req, res) {

    if (!req.isAuthenticated()) {
        return res.redirect('/');
    }

    res.render('home.ejs');
});

app.get('/forgotten-password', function (req, res) {

    if (req.isAuthenticated()) {
        return res.redirect('/home');
    }
    else {
        return res.render('forgotten-password.ejs', { info: "", error: "" });
    }
});

app.post('/forgotten-password', urlencodedParser, function (req, res) {
    if (req.isAuthenticated()) {
        return res.redirect('/home');
    }

    if (req.body.bannerid == "") {
        error = { message: "Merci de fournir un BannerID non vide" };
        return res.render('forgotten-password.ejs', { info: "", error: error });
    }

    var http = require('http');

    var bodyString = querystring.stringify({
        bannerID: req.body.bannerid.toUpperCase(),
    });

    var headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': bodyString.length
    };

    var options = {
        host: baseURLNoPortNoHttp,
        path: '/user/' + req.body.bannerid.toUpperCase() + '/create-token',
        port: 3000,
        method: 'PUT',
        headers: headers
    };

    var callback = function (response) {
        var str = '';

        //another chunk of data has been recieved, so append it to `str`
        response.on('data', function (chunk) {
            str += chunk;
        });

        //the whole response has been recieved, so we just print it out here
        response.on('end', function () {

            str = JSON.parse(str);
            if (response.statusCode == 404 || str.n === 0) {
                return res.render('forgotten-password.ejs', { info: "", error: str });
            }
            else {
                var transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: "cmt.bde.essec@gmail.com",
                        pass: "CourtMaisTrash95"
                    }
                });

                var mailTo = str.bannerID + "@essec.edu";


                var mailOptions = {
                    from: '"Contact BDE CMT" <cmt.bde.essec@gmail.com>',
                    to: mailTo,
                    subject: 'Mot de passe oublié CMT - Forgotten Password CMT',
                    text:
                        `Hello !

Tu as oublié ton mot de passe, ce n'est pas grave ! On te propose d'en créer un nouveau.

Il suffit de cliquer sur le lien ci-dessous :
`+ baseURLNoPort + `/user/` + str.bannerID + `/reinitiate-password/` + str.token + `

En cas de soucis, n'hésite pas à envoyer un mail à ulin.cieutat@essec.edu .

Enjoy !

Le BDE Havana`
                };

                transporter.sendMail(mailOptions, function (error, info) {
                    if (error) {
                        var error = { message: "Une erreure est survenue" }
                        return res.render('forgotten-password.ejs', { info: "", error: error });
                    } else {
                        return res.render('password-reset.ejs');
                    }
                });
            }

        });
    };


    http.request(options, callback).write(bodyString);
})

app.get('/user/:bannerID/reinitiate-password/:token', urlencodedParser, function (req, res) {

    const bannerID = req.params.bannerID.toUpperCase();
    const token = req.params.token;

    var http = require('http');

    var url = baseURL + "/user/" + bannerID + "/reinitiate-password/" + token;
    var promiseReinitiatePassword = Request.get(url, (error, response, body) => {
        if (error) {
            return console.log(error);
        }

        if (response.statusCode === 404) {
            var message = JSON.parse(response.body);
            return res.render('signin.ejs', { infoSignin: "", errorSignin: message, errorSignup: "" });
        }
        return res.render('password-reset-form.ejs', { info: "", error: "", bannerID: bannerID, token: token });
    });
});

app.post('/user/:bannerID/reinitiate-password/:token', urlencodedParser, function (req, res) {

    const bannerID = req.params.bannerID.toUpperCase();
    const token = req.params.token;

    if (req.body.password != req.body.repassword) {
        error = { message: "Les mots de passes ne sont pas identiques" };
        return res.render('password-reset-form.ejs', { info: "", error: error, bannerID: bannerID, token: token });
    }
    else if (req.body.password == "") {
        error = { message: "Merci de fournir un mot de passe non vide" };
        return res.render('password-reset-form.ejs', { info: "", error: error, bannerID: bannerID, token: token });
    }

    var http = require('http');

    var bodyString = querystring.stringify({
        bannerID: bannerID,
        password: req.body.password,
    });

    var headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': bodyString.length
    };

    var options = {
        host: baseURLNoPortNoHttp,
        path: '/user/' + bannerID + "/reinitiate-password/" + token,
        port: 3000,
        method: 'PUT',
        headers: headers
    };

    var callback = function (response) {
        var str = '';

        //another chunk of data has been recieved, so append it to `str`
        response.on('data', function (chunk) {
            str += chunk;
        });

        //the whole response has been recieved, so we just print it out here
        response.on('end', function () {

            str = JSON.parse(str);
            if (response.statusCode == 404 || str.n === 0) {
                return res.render('password-reset-form.ejs', { info: "", error: str, bannerID: bannerID, token: token });
            }
            else {
                return res.render('signin.ejs', { infoSignin: { message: "Le mot de passe a bien été modifié" }, errorSignin: "", errorSignup: "" });
            }

        });
    };


    http.request(options, callback).write(bodyString);
});



app.post('/signup', urlencodedParser, function (req, res) {

    if (req.body.password != req.body.repassword) {
        errorSignup = { message: "Les mots de passes ne sont pas identiques" };
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: errorSignup });
    }
    else if (req.body.password == "") {
        errorSignup = { message: "Merci de fournir un mot de passe non vide" };
        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: errorSignup });
    }

    var http = require('http');

    var bodyString = querystring.stringify({
        bannerID: req.body.bannerid.toUpperCase(),
        password: req.body.password,
        pseudo: req.body.pseudo
    });

    var headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': bodyString.length
    };

    var options = {
        host: baseURLNoPortNoHttp,
        path: '/user/' + req.body.bannerid.toUpperCase(),
        port: 3000,
        method: 'PUT',
        headers: headers
    };

    var callback = function (response) {
        var str = '';

        //another chunk of data has been recieved, so append it to `str`
        response.on('data', function (chunk) {
            str += chunk;
        });

        //the whole response has been recieved, so we just print it out here
        response.on('end', function () {

            str = JSON.parse(str);
            if (response.statusCode == 404 || str.n === 0) {
                return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: str });
            }
            else {
                var transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: "cmt.bde.essec@gmail.com",
                        pass: "CourtMaisTrash95"
                    }
                });

                var mailTo = str.bannerID + "@essec.edu";


                var mailOptions = {
                    from: '"Contact BDE CMT" <cmt.bde.essec@gmail.com>',
                    to: mailTo,
                    subject: 'Bienvenue sur le CMT - Welcome to the CMT',
                    text:
                        `Hello !

Tout le BDE te souhaite la bienvenue sur le CMT ! 

C'est la dernière ligne droite pour valider ton compte.

Il suffit de cliquer sur le lien ci-dessous :
`+ baseURLNoPort + `/user/` + str.bannerID + `/activate/` + str.token + `

En cas de soucis, n'hésite pas à envoyer un mail à ulin.cieutat@essec.edu .

Enjoy !

Le BDE Havana`
                };

                transporter.sendMail(mailOptions, function (error, info) {
                    if (error) {
                        var errorInfo = { message: "Une erreure est survenue" }
                        return res.render('signin.ejs', { infoSignin: "", errorSignin: "", errorSignup: errorInfo });
                    } else {
                        return res.render('userCreated.ejs');
                    }
                });
            }

        });
    };


    http.request(options, callback).write(bodyString);
});

app.get('/user/:bannerID/activate/:token', urlencodedParser, function (req, res) {

    const bannerID = req.params.bannerID.toUpperCase();
    const token = req.params.token;

    var http = require('http');

    var bodyString = querystring.stringify({
        bannerID: bannerID,
        token: token,
    });

    var headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': bodyString.length
    };

    var options = {
        host: baseURLNoPortNoHttp,
        path: '/user/' + bannerID + '/activate/' + token,
        port: 3000,
        method: 'PUT',
        headers: headers
    };

    var callback = function (response) {
        var str = '';

        //another chunk of data has been recieved, so append it to `str`
        response.on('data', function (chunk) {
            str += chunk;
        });

        //the whole response has been recieved, so we just print it out here
        response.on('end', function () {

            str = JSON.parse(str);
            if (response.statusCode == 404 || str.n === 0) {
                return res.render('signin.ejs', { infoSignin: "", errorSignin: str, errorSignup: "" });
            }
            else {
                return res.render('signin.ejs', { infoSignin: { message: "L'utilisateur a bien été activé, vous pouvez désormais vous connecter" }, errorSignin: { message: "" }, errorSignup: "" });
            }

        });
    };


    http.request(options, callback).write(bodyString);
});



app.get('/prof/:nomProf/avis', function (req, res) {

    if (!req.isAuthenticated()) {
        return res.redirect('/');
    }

    const nomProf = req.params.nomProf;

    var url = baseURL + "/prof/" + nomProf + "/avis";
    var promiseAvisProf = Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            res.send("not found");
        }
        var avis = JSON.parse(body);
        res.render('profAvis.ejs', { avis: avis, nomProf: nomProf })
    });
});


app.use(express.static(__dirname + '/public')) // Indique que le dossier /public contient des fichiers statiques (middleware chargé de base)


// Quand un client se connecte, on le note dans la console
io.sockets.on('connection', function (socket) {

    socket.on('requestOverallRates', function (coursID) {
        overallRates(socket, coursID);
    });

    socket.on('requestBestCourses', function () {
        bestCourses(socket);
    });

    socket.on('requestWorstCourses', function () {
        worstCourses(socket);
    });

    socket.on('requestBestProfs', function () {
        bestProfs(socket);
    });

    socket.on('requestWorstProfs', function () {
        worstProfs(socket);
    });

    socket.on('requestDetailedRatesByCourse', function (nomProf) {
        detailedRatesByCourse(socket, nomProf);
    });

    socket.on('requestOverallRatesProf', function (nomProf) {
        overallRatesProf(socket, nomProf);
    });

    socket.on('requestSearchUser', function (bannerID) {
        searchUser(socket, bannerID);
    });

    socket.on('requestAllCourses', function () {
        allCourses(socket);
    });

    socket.on('requestStudy', function (studyId) {
        study(socket, studyId);
    });

    socket.on('requestAvisByStudy', function (studyId) {
        avisByStudy(socket, studyId);
    });

    socket.on('requestStatisticsByStudy', function (studyId) {
        statisticsByStudy(socket, studyId);
    });

    socket.on('requestApproveStudyAvis', function (studyId) {
        approveStudyAvis(socket, studyId);
    });

    socket.on('requestApproveAvis', function (avisId) {
        approveAvis(socket, avisId);
    });

    socket.on('requestDisapproveAvis', function (avisId) {
        disapproveAvis(socket, avisId);
    });

    socket.on('requestModifyCourse', function (codeCours, nomCours) {
        modifyCourse(socket, codeCours, nomCours);
    });
});

server.listen(80);

const overallRates = (socket, coursID) => {

    var url = baseURL + "/cours/" + coursID + "/overallRates";
    Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            res.send("not found");
        }
        var overallRates = JSON.parse(body);

        socket.emit('responseOverallRates', overallRates);
    });
}

const bestCourses = (socket) => {

    var url = baseURL + "/bestCourses/";
    Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            res.send("not found");
        }
        var bestCourses = JSON.parse(body);

        socket.emit('responseBestCourses', bestCourses);
    });
}

const worstCourses = (socket) => {

    var url = baseURL + "/worstCourses/";
    Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            res.send("not found");
        }
        var worstCourses = JSON.parse(body);

        socket.emit('responseWorstCourses', worstCourses);
    });
}

const bestProfs = (socket) => {

    var url = baseURL + "/bestProfs/";
    Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            res.send("not found");
        }
        var bestProfs = JSON.parse(body);

        socket.emit('responseBestProfs', bestProfs);
    });
}

const worstProfs = (socket) => {

    var url = baseURL + "/worstProfs/";
    Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            res.send("not found");
        }
        var worstProfs = JSON.parse(body);

        socket.emit('responseWorstProfs', worstProfs);
    });
}

const detailedRatesByCourse = (socket, nomProf) => {

    var url = baseURL + "/prof/" + nomProf + "/detailedRatesByCourse";
    Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            return console.dir("not found");
        }
        var detailedRatesByCourse = JSON.parse(body);

        socket.emit('responseDetailedRatesByCourse', detailedRatesByCourse);
    });
}

const overallRatesByCourse = (socket, nomProf) => {

    var url = baseURL + "/prof/" + nomProf + "/overallRatesByCourse";
    Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            return console.dir("not found");
        }
        var overallRatesByCourse = JSON.parse(body);

        socket.emit('responseOverallRatesByCourse', overallRatesByCourse);
    });
}

const overallRatesProf = (socket, nomProf) => {

    var url = baseURL + "/prof/" + nomProf + "/overallRates";
    Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            return console.dir("not found");
        }
        var overallRatesProf = JSON.parse(body);

        socket.emit('responseOverallRatesProf', overallRatesProf);
    });
}


const searchUser = (socket, bannerID) => {

    var url = baseURL + "/user/" + bannerID;
    Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            socket.emit('responseSearchUser', null);
        }
        var user = JSON.parse(body);

        socket.emit('responseSearchUser', user[0]);
    });
}

const allCourses = (socket) => {

    var url = baseURL + "/courses";
    Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            socket.emit('responseAllCourses', null);
        }
        var allCourses = JSON.parse(body);

        socket.emit('responseAllCourses', allCourses);
    });
}

const study = (socket, studyId) => {

    var url = baseURL + "/studies/" + studyId;
    Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            socket.emit('responseStudy', null);
        }
        var study = JSON.parse(body);

        socket.emit('responseStudy', study);
    });
}

const avisByStudy = (socket, studyId) => {

    var url = baseURL + "/studies/" + studyId + '/avis';
    Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            socket.emit('responseAvisByStudy', null);
        }
        var avisByStudy = JSON.parse(body);

        socket.emit('responseAvisByStudy', avisByStudy);
    });
}

const statisticsByStudy = (socket, studyId) => {

    var url = baseURL + "/studies/" + studyId + '/statistics';
    Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            socket.emit('responseStatisticsByStudy', null);
        }
        var statisticsByStudy = JSON.parse(body);

        socket.emit('responseStatisticsByStudy', statisticsByStudy[0]);
    });
}

const approveStudyAvis = (socket, studyId) => {

    var url = baseURL + "/studies/" + studyId + '/approve';
    Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            socket.emit('responseApproveStudyAvis', null);
        }
        var message = JSON.parse(body);

        socket.emit('responseApproveStudyAvis', message);
    });
}

const approveAvis = (socket, avisId) => {

    var url = baseURL + "/avis/" + avisId + '/approve';
    Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            socket.emit('responseApproveAvis', null);
        }
        var avisId = JSON.parse(body);

        socket.emit('responseApproveAvis', avisId);
    });
}

const disapproveAvis = (socket, avisId) => {

    var url = baseURL + "/avis/" + avisId + '/disapprove';
    Request.get(url, (error, response, body) => {
        if (error) {
            return console.dir(error);
        }

        if (response.statusCode === 404) {
            socket.emit('responseDisapproveAvis', null);
        }
        var avisId = JSON.parse(body);

        socket.emit('responseDisapproveAvis', avisId);
    });
}

const modifyCourse = (socket, codeCours, nomCours) => {

    var http = require('http');

    var bodyString = querystring.stringify({
        nomCours: nomCours
    });

    var headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': bodyString.length
    };

    var options = {
        host: baseURLNoPortNoHttp,
        path: '/courses/' + codeCours + '/modify/',
        port: 3000,
        method: 'POST',
        headers: headers
    };

    var callback = function (response) {
        var str = '';

        //another chunk of data has been recieved, so append it to `str`
        response.on('data', function (chunk) {
            str += chunk;
        });

        //the whole response has been recieved, so we just print it out here
        response.on('end', function () {

            socket.emit('responseModifyCourse', codeCours);

        });
    };


    http.request(options, callback).write(bodyString);
}