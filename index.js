// In the program there are 2 API end points
// One is /auth where user can go through OAuth2 process
// One is /auth/sendmail where user can send mail 

const fs = require('fs');
const { google } = require('googleapis');
const express = require('express');
const app = express();
const port = 3002;
const url = require('url');
const querystring = require('querystring');
const SCOPES = ['https://mail.google.com/', 'https://www.googleapis.com/auth/userinfo.email'];
const TOKEN_PATH = 'token.json';
const axios = require("axios");
let oAuth2Client;

class oAuthClientClass {
    oAuth2Client;
    constructor() {
    }
    setOAuth2Client(oAuth2Client) {
        this.oAuth2Client = oAuth2Client;
    }
}

let oAuthObj = new oAuthClientClass();

// Calling api to get the user mailID
function getEmail(access_token) {
    axios.get('https://www.googleapis.com/oauth2/v1/userinfo', {
        params: {
            access_token: access_token
        }
    })
        .then(res => {
            console.log(res.data.email);
            return res.data.email
        })
        .catch(err => {
            console.log(err);
        })
}
 // Function to make email Body
function makeBody(to, from, subject, message) {
    var str = ["Content-Type: text/plain; charset=\"UTF-8\"\n",
        "MIME-Version: 1.0\n",
        "Content-Transfer-Encoding: 7bit\n",
        "to: ", to, "\n",
        "from: ", from, "\n",
        "subject: ", subject, "\n\n",
        message
    ].join('')

    var encodedMail = Buffer.from(str).toString("base64").replace(/\+/g, '-').replace(/\//g, '_');
    return encodedMail;
}

app.get('/auth', (req, res) => {
    // Load client secrets from a local file
    fs.readFile('credentials.json', (err, content) => {
        if (err) return console.log('Error loading client secret file:', err);
        // Authorize a client with credentials, then call the Gmail API.
        else {
            // Creating an OAuth2 client with the given credentials
            credentials = JSON.parse(content);
            var clientSecret = credentials.installed.client_secret;
            var clientId = credentials.installed.client_id;
            var redirectUrl = credentials.installed.redirect_uris[0];


            oAuth2Client = new google.auth.OAuth2(
                clientId, clientSecret, redirectUrl);
            oAuthObj.setOAuth2Client(oAuth2Client);

            // Check if we have previously stored a token.
            fs.readFile(TOKEN_PATH, (err, token) => {
                if (err) {
                    const authUrl = oAuthObj.oAuth2Client.generateAuthUrl({
                        access_type: 'offline',
                        scope: SCOPES,
                    });
                    res.redirect(authUrl);
                }
                else {
                    oAuth2Client.setCredentials(JSON.parse(token));
                    res.send("Already Authenticated")
                }
            });
        }
    });
});

app.get('/auth/oauthcallback', (req, res) => {
    // Extracting the code value from the URL for getting token

    const query = url.parse(req.url).query
    const q = querystring.parse(query)
    const code = q.code

    oAuthObj.oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error('Error retrieving access token', err);
        oAuthObj.oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
            if (err) return console.error(err);
            console.log('Token stored to', TOKEN_PATH);
        });
    })
    // IF authenticated then redirect to success
    res.redirect('/auth/success');
})

app.get('/auth/success', (req, res) => {
    res.send("Oauth Sucessfully Done")
})


// API for sending the mail
app.get('/auth/sendmail', (req, res) => {
    let email;
    // Checking if There is token i.e. User is authorized or not
    fs.readFile('token.json', (err, token) => {
        if (err) res.send("Not Aunthenticated")
        let data = JSON.parse(token);
        console.log(data.access_token);
        email = getEmail(data.access_token);
    })
    // Please do enter a reciever mail Id below
    // Using the authorized user sending a mail 
    var raw = makeBody('enteryourmail@gmail.com', email, 'test subject', 'test message');
    const gmail = google.gmail({ version: 'v1', auth: oAuthObj.oAuth2Client });
    gmail.users.messages.send({
        auth: oAuthObj.oAuth2Client,
        userId: 'me',
        resource: {
            raw: raw
        }
    }, (err, res) => {
        if (err) return console.log(err);
        console.log(res);
    })
})

app.listen(port, () => {
    console.log(`Listening to port ${port}`);
})