
/**
 * Module dependencies.
 */

var express    = require('express');
var bodyParser = require('body-parser');
var routes     = require('./routes.js');
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
app.use(express.static(path.join(__dirname, 'public')));

if ('development' == app.get('env')) {
    var errorhandler = require('errorhandler');
    app.use(errorhandler());
}

app.get('/', routes.index);
app.get('/search', routes.search);
app.get('/add_city', routes.add_city);
app.get('/show/:id', routes.show);
app.get('/destroy/:id', routes.destroy);
app.post('/show', routes.show);
app.post('/save', routes.save);
app.get('/export/:id', routes.export);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
