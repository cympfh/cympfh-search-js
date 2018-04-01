const expandTilde = require('expand-tilde');
const express = require('express');
const fs = require('fs');
const http = require('http');
const url = require('url');
const yaml = require('node-yaml');
const {execFile} = require('child_process');

const config = yaml.readSync('config.yml');
console.assert(config.repo);
console.assert(config.repo.path);
console.assert(config.memo);
console.assert(config.memo.url);
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

function exec(res, file, args, cont) {
    execFile(file, args, (err, stdout, stderr) => {
        if (stdout) {
            res.send(cont(stdout));
        } else {
            res.send([]);
        }
    });
}

app.get('/search/memo', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    let query = url.parse(req.url, true).query;
    if (query.q) {
        let words = query.q.split(',');
        let args = [config.memo.url].concat(words);
        exec(res, 'bin/memo', args, (data) =>
            data.split('\n').filter(line => line.length > 0)
                .reverse()
                .slice(0, 20)
                .map(line => {
                    let fs = line.split('\t');
                    return {date: fs[0], text: fs[1]};
                })
        );
    } else {
        res.send([]);
    }
});

app.get('/search/aiura', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    let query = url.parse(req.url, true).query;
    if (query.q) {
        let words = query.q.split(',');
        let args = [config.repo.path].concat(words);
        exec(res, 'bin/aiura', args, (data) => {
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
});

app.get('/search/taglibro', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    let query = url.parse(req.url, true).query;
    if (query.q) {
        let words = query.q.split(',');
        let args = [config.repo.path].concat(words);
        exec(res, 'bin/taglibro', args, (data) => {
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
});

app.get('/search', (req, res) => {
    fs.readFile("./index.html", (err, data) => {
        data = data.toString().replace(/@MYSELF/, `http://${myself}:${config.port}`);
        res.writeHead(200);
        res.end(data);
    });
});

app.listen(config.port);
