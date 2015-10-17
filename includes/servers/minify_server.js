'use strict';

var fs = require('fs');
var zlib = require('zlib');
var path = require('path');

var UglifyJS = require("uglify-js");
var CleanCSS = require('clean-css');

function serve(opts) {
    opts = opts || {};
    var type = opts.type || 'guess';
    var cachePath = opts.cache || {cache: false, gzip: false, raw: false};
    var items = opts.files || [];

    var files = [];

    var __result = '';
    var __raw = '';
    var __gzip = '';

    var need_to_minify = opts.minify;


    var mostRecentMTime = 0;
    var cacheMTime = 0;

    var initialized = false;

    function serve(req, res, next) {

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405);
            res.end('Method not allowed');
            return next();
        }

        var callback = function(){
            doServe(req, res, next);
        };

        if (!initialized)
            init(callback);
        else
            callback();
    }

    function echoContentType(res)
    {
        if (type == 'javascript')
            res.setHeader('Content-Type', 'application/javascript');
        else
        if (type == 'css')
            res.setHeader('Content-Type', 'text/css');
        else
            res.setHeader('Content-Type', 'text/plain');

        return res;
    }

    function doServe(req, res, next)
    {
        if (req.acceptsEncoding('gzip') && need_to_minify)
        {
            res = echoContentType(res);
            res.setHeader('Content-Encoding', 'gzip');
            res.writeHead(200);
            res.end(__gzip);
            console.log('Send '+type+' resources as gzip');
        } else {
            res = echoContentType(res);
            res.writeHead(200);
            if (need_to_minify)
                res.end(__result);
            else
                res.end(__raw);
            console.log('Send '+type+' resources as plain');   
        }

        next();
    }

    function addFile(filename) {
        if (type == 'guess')
        {
            if (filename.slice(-3) == '.js')
                type = 'javascript';
            if (filename.slice(-4) == '.css')
                type = 'css';
        }
        files.push(filename);
    }

    function addFolder(pathname) {
        fs.readdirSync(pathname).forEach(function(file) {
            if (file.slice(-3) !== '.js' && file.slice(-4) !== '.css') 
                return;
            addFile(path.join(pathname, file));
        });
    }

    function getMTimes(callback) {

        var gotMTimeCount = 0;
        var expectedMTimeCount = files.length + 3; /// cached + cached.gz + raw

        var cbReady = function() {
            gotMTimeCount++;
            if (gotMTimeCount == expectedMTimeCount && typeof callback == 'function')
                callback();
        }

        files.forEach(function(file) 
        {
            fs.stat(file, function(err, stats) {
                if (err)
                    return cbReady();
                if (typeof(stats['mtime']) !== 'undefined' && stats['mtime'] > mostRecentMTime)
                    mostRecentMTime = stats['mtime'];
                cbReady();
            });
        });

        var cbCached = function(err, stats)
        {
            if (err)
                return cbReady();
            if (typeof(stats['mtime']) !== 'undefined')
                if (cacheMTime === 0 || stats['mtime'] < cacheMTime)
                    cacheMTime = stats['mtime'];
            cbReady();
        }

        fs.stat(cachePath.cache, cbCached);
        fs.stat(cachePath.gzip, cbCached);
        fs.stat(cachePath.raw, cbCached);
    }

    function generateJSHTML(callback)
    {
        __raw = '';
        __raw+= "function inc_js_file(fname) { var js = document.createElement('script'); js.type = 'text/javascript';";
        __raw+= "js.src = fname; js.async = false; document.body.appendChild(js); }\n";

        files.forEach(function(file){
            file = file.split('./public/').join('/').split('public/').join('/');
            __raw+="inc_js_file(\""+file+"\");\n";
        })
    }

    function minify(callback) {

        if (type == 'javascript')
        {        
            console.log('Minify javascript files...');
            var result = UglifyJS.minify(files, {
                compress: false
            });

            __result = result.code;

            generateJSHTML();

            var buf = new Buffer(__result, 'utf-8');

            zlib.gzip(buf, function (_, res) {
                console.log('Minify javascript files. Done.');
                __gzip = res;

                fs.writeFile(cachePath.cache, __result);
                fs.writeFile(cachePath.gzip, __gzip);
                fs.writeFile(cachePath.raw, __raw);

                if (typeof callback === 'function')
                    callback();
            });
        } else
        if (type == 'css')
        {


            console.log('Minify css files...');
            new CleanCSS({ root: path.join(process.cwd(), 'public'), relativeTo: path.join(process.cwd(), 'public') }).minify(files, function (error, minified) {
                __result = minified.styles;
                var buf = new Buffer(__result, 'utf-8');

                zlib.gzip(buf, function (_, res) {
                    __gzip = res;

                    fs.writeFile(cachePath.cache, __result);
                    fs.writeFile(cachePath.gzip, __gzip);

                    console.log('Minify css files. Done.');
                    if (typeof callback === 'function')
                        callback();
                });
            });
        }
    }

    function loadFromCache(callback)
    {
        var gotCount = 0;
        var expectedCount = 3;
        if (!cachePath.gzip) expectedCount--;
        if (!cachePath.raw) expectedCount--;
        if (!cachePath.cache) expectedCount--;

        var cbReady = function() {
            gotCount++;
            if (gotCount == expectedCount && typeof callback == 'function')
            {
                console.log(type+' loaded');
                callback();            
            }
        };
        

        fs.readFile(cachePath.cache, function read(err, data) {
            if (err)
                return cbReady();
            __result = data;
            cbReady();
        });
        fs.readFile(cachePath.gzip, function read(err, data) {
            if (err)
                return cbReady();
            __gzip = data;
            cbReady();
        });
        fs.readFile(cachePath.raw, function read(err, data) {
            if (err)
                return cbReady();
            __raw = data;
            cbReady();
        });
    }

    function init(callback)
    {
        items.forEach(function(item){
            if (item.slice(-3) === '.js' || item.slice(-4) === '.css')
                addFile(item);
            else
                addFolder(item); 
        });


        getMTimes(function(){
            console.log('Most recent mtime('+type+'): '+mostRecentMTime);
            console.log('Cached recent mtime('+type+'): '+cacheMTime);

            if (mostRecentMTime > cacheMTime)
            {
                console.log('Minify '+type);
                minify(callback);
            } else {
                console.log('Load '+type+' from cache');
                loadFromCache(callback);
            }
        });
        initialized = true;
    }

    return (serve);
}

module.exports = serve;
