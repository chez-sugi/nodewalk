var pg = require('pg');
var conString = "postgres://sugi:freiheit@localhost/walkdb";
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Express' });
};

exports.search = function(req, res){
    pg.connect(conString, function (err, client, done) {
	client.query('SELECT id, date, start, "end", length from walks ORDER BY id DESC LIMIT 20', function (err, result) {
	    done();
	    res.json({"items": result});
	});
    });
};

