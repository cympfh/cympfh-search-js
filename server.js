const expandTilde = require('expand-tilde');
const express = require('express');
const fs = require('fs');
const http = require('http');
const url = require('url');
const yaml = require('node-yaml');
const morgan = require('morgan');
const {execFile} = require('child_process');

const config = yaml.readSync('config.yml');
console.assert(config.repo);
console.assert(config.repo.path);
console.assert(config.longinus);
console.assert(config.longinus.url);
config.repo.path = expandTilde(config.repo.path);
config.repo.pull_after = !!config.repo.pull_after;
config.port = config.port || 10030;

var myself = null;
http.get('http://httpbin.org/ip', (response) => {
    let data = '';
    response.on('data', chunk => { data += chunk; });
    response.on('end', () => {
        myself = JSON.parse(data).origin;
        console.log(`I am ${myself}`);
        console.log(`Listen on ${myself}:${config.port}`);
    });
});

var app = express();
app.use(morgan((tokens, req, res) =>
    [
        tokens.method(req, res),
        decodeURIComponent(tokens.url(req, res)),
        tokens.status(req, res),
        tokens.res(req, res, 'content-length'), '-',
        tokens['response-time'](req, res), 'ms'
    ].join(' ')));

function exec(res, file, args, cont) {
    execFile(file, args, (err, stdout, stderr) => {
        if (stdout) {
            res.send(cont(stdout));
        } else {
            res.send([]);
        }
    });
}

function parse(request_url) {
    let query = url.parse(request_url, true).query;
    if (query.q === undefined || query.q === '') return false;
    let words = query.q.split(',').filter(w => w.length > 0);
    if (words.length == 0) return false;
    return words
}

/*
 * Search in longinus memo
 */

app.get('/search/longinus', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    let words = parse(req.url);
    if (words) {
        let args = [config.longinus.url].concat(words);
        exec(res, 'bin/longinus', args, (data) =>
            data.split('\n').filter(line => line.length > 0)
                .reverse()
                .map(line => {
                    let fs = line.split('\t');
                    return {date: fs[0], text: fs[1]};
                })
        );
    } else {
        res.send([]);
    }
});

/*
 * Search in repository
 */

function get_repository(file) {
    return (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        let words = parse(req.url);
        if (words) {
            let args = [config.repo.path].concat(words);
            exec(res, file, args, (data) => {
                let lines = data.split('\n');
                let ret = [];
                for (var i = 0; i + 2 < lines.length; i += 3) {
                    let subs = lines[i+2].split('\t').filter(a => a.length>0);
                    ret.push({filename: lines[i], title: lines[i+1], subtitles: subs});
                }
                return ret;
            });
        } else {
            res.send([]);
        }
    };
}

app.get('/search/memo', get_repository('bin/memo'));
app.get('/search/aiura', get_repository('bin/aiura'));
app.get('/search/taglibro', get_repository('bin/taglibro'));

/*
 * index.html
 */

app.get('/search', (req, res) => {
    fs.readFile("./index.html", (err, data) => {
        data = data.toString().replace(/@MYSELF/, `http://${myself}:${config.port}`);
        res.writeHead(200);
        res.end(data);
    });
});

app.listen(config.port);
