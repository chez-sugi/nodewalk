
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes.js');
var http = require('http');
var path = require('path');
var config = require('config');
var app = express();

// all environments
app.set('port', config.port || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/search', routes.search);
app.get('/add_area', routes.add_area);
app.get('/show/:id', routes.show);
app.get('/destroy/:id', routes.destroy);
app.post('/show', routes.show);
app.post('/save', routes.save);
app.get('/export/:id', routes.export);
app.get('/atom', routes.atom);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
