
/**
 * Module dependencies.
 */

var express    = require('express');
var bodyParser = require('body-parser');
var router     = require('./lib/router.js');
var http       = require('http');
var path       = require('path');
var config     = require('config');
var morgan     = require('morgan');
var app        = express();

// all environments
app.set('port', config.port || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(morgan());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, '../web')));

if ('development' == app.get('env')) {
    var errorhandler = require('errorhandler');
    app.use(errorhandler());
}

app.use('/', router);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
