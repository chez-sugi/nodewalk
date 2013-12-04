var pg = require('pg');
var pager = require('./pg_pager');
var encoder = require("./path_encoder");
var config = require('config').config;
var url = require('url');
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index');
};

var EARTH_RADIUS = 6370986;
var SRID = 4326;

exports.search = function(req, res){
    pg.connect(config.dbConnection, function (err, client, done) {
	var order_hash = {
	    "new_first"   : "date desc",
	    "old_first"   : "date",
	    "long_first"  : "length desc",
	    "short_first" : "length",
	    "east_first"  : "xmax(PATH) desc",
	    "west_first"  : "xmin(PATH)",
	    "south_first" : "ymin(PATH)",
	    "north_first" : "ymax(PATH) desc"
	};
	var order = order_hash[req.query.order] || 'date desc';
	
	var where, values;
	if (req.query.id) {
	    where = 'id = $1';
	    values = [req.query.id];
	}
	else if (req.query.date) {
	    where = 'date = $1';
	    values = [req.query.date];
	}
	else if (req.query.type == 'neighbor') {
	    where = "st_setsrid(st_makebox2d(st_point($1, $2), st_point($3, $4)), $5) && path and st_distance_sphere(path, st_setsrid(st_point($6, $7),$5)) <= $8";
	    var latitude  = parseFloat(req.query.latitude);
	    var longitude = parseFloat(req.query.longitude);
	    var radius    = parseFloat(req.query.radius);
	    var dlat      = radius*180/Math.PI/EARTH_RADIUS;
	    var dlon      = dlat/Math.cos(longitude/180*Math.PI);
	    values = [longitude-dlon, latitude-dlat, longitude+dlon, latitude+dlat, SRID, longitude, latitude, radius];
	}
	else if (req.query.type == 'areas') {
	    var areas = req.query.areas;
	    if (typeof areas == 'string') areas = [areas];
	    where = "EXISTS (select * from areas WHERE jcode::int in (" + areas.join(',') + ") AND path && the_geom AND ST_Intersects(path, the_geom))";
	    values = [];
	}
	else if (req.query.type == 'cross') {
	    var path = encoder.decode(req.query.searchPath);
	    var pathStr = path.map(function (p) {
		return p[0] + " " + p[1];
	    }).join(',');
	    where = "path && ST_SetSRID(ST_LineFromText('LINESTRING(" + pathStr + ")'), $1) AND ST_Intersects(path, ST_SetSRID(ST_LineFromText('LINESTRING(" + pathStr + ")'), $1))";
	    values = [SRID];
	}
	else {
	    where = null;
	    values = [];
	}
	pager.paginate(client, { 
	    order  : order, 
	    select : ['id', 'date::varchar', 'start', '"end"', 'ST_AsGeoJson(path) as path', 'length'],
	    table  : 'walks',
	    where  : where,
	    values : values,
	    page   : req.query.page || 1,
	    page_size : req.query.per_page || 20,
	}, function (err, result) {
	    done();
	    if (result.total_count > req.query.per_page * (result.current_page + 1)) {
		var q = Object.keys(req.query).filter(function (e) { return e != 'page';}).map( function (e) { return e + '=' + req.query[e]; });
		q.push("page=" +  (result.current_page + 1));
		result.params = q.join('&');
	    }
	    if (result.total_count == 1) {
		var obj = JSON.parse(result.items[0].path);
		result.items[0].path = encoder.encode(obj.coordinates);
	    }
	    else {
		result.items = result.items.map(function (row) {
		    delete row.path;
		    return row;
		});
	    }
	    res.json(result);
	});
    });
};

exports.add_area = function(req, res){
    var latitude  = parseFloat(req.query.latitude);
    var longitude = parseFloat(req.query.longitude);

    pg.connect(config.dbConnection, function (err, client, done) {
	client.query("SELECT jcode, ST_AsGeoJson(the_geom) as geom  FROM areas WHERE ST_Contains(the_geom, ST_SetSRID(ST_Point($1, $2), $3))",
		     [longitude, latitude, SRID],
		     function (err, result) {
			 done();
			 var geom = JSON.parse(result.rows[0].geom);
			 var str = geom.coordinates.map(function (polygones) {
			     return encoder.encode(polygones[0]);
			 }).join(' ');
			 res.json({jcode : result.rows[0].jcode, the_geom : str});
		     });

    });
};

exports.show = function(req, res) {
    var ids = req.params.id || req.body.id;

    if (typeof ids == "string") {
	ids = [ids];
    }
    pg.connect(config.dbConnection, function (err, client, done) {
	client.query("SELECT id, date::varchar, start, \"end\", length, ST_AsGeoJson(path) as path FROM walks WHERE id in (" + ids.join(',') + ")",
		     function (err, result) {
			 done();
			 res.json(result.rows.map(function (row) {
			     row.path = encoder.encode(JSON.parse(row.path).coordinates);
			     return row;
			 }));
		     });
    });
};

exports.save = function(req, res) {
    var path = encoder.decode(req.body.path);

    var pathStr = path.map(function (p) {
	return p[0] + " " + p[1];
    }).join(',');
    var sql, values;
    if (req.body.id) {
	sql = "UPDATE walks SET date = $1, start = $2, \"end\" = $3,  path = ST_SetSRID(ST_LineFromText('LINESTRING(" + pathStr + ")'), $4), length =  length_spheroid(ST_SetSRID(ST_LineFromText('LINESTRING(" + pathStr + ")'), $4),'SPHEROID[\"WGS 84\",6378137,298.257223563]')/1000, updated_at = NOW() WHERE id = $5 RETURNING (id, length)";
	values = [req.body.date, req.body.start, req.body.end, SRID];
    }
    else {
	sql = "INSERT INTO walks (date, start, \"end\", path, length, created_at, updated_at) VALUES($1, $2, $3, ST_SetSRID(ST_LineFromText('LINESTRING(" + pathStr + ")'), $4), length_spheroid(ST_SetSRID(ST_LineFromText('LINESTRING(" + pathStr + ")'), $4),'SPHEROID[\"WGS 84\",6378137,298.257223563]')/1000), NOW(), NOW() RETURNING(id, length)";
	values = [req.body.date, req.body.start, req.body.end, SRID];
    }
    pg.connect(config.dbConnection, function (err, client, done) {
	client.query(sql, values,
		     function (err, result) {
			 done();
			 res.json({id: result.rows[0].id, date: req.body.date, start: req.body.start, end: req.body.end, length: result.rows[0].length});
		     });
    });
};

exports.destroy = function(req, res) {
    pg.connect(config.dbConnection, function (err, client, done) {
	client.query("DELETE FROM walks WHERE id = $1", [req.params.id],
		     function (err, result) {
			 done();
			 res.end('');
		     });
    });
};

exports.export = function(req, res) {
    pg.connect(config.dbConnection, function (err, client, done) {
	client.query("select ST_AsGeoJson(path) AS path FROM walks WHERE ID = $1",
		     [req.params.id],
		     function (err, result) {
			 done();
			 res.type('application/json');
			 res.attachment(req.params.id + ".json");
			 res.end(result.rows[0].path);
		     })
    });
};

exports.atom = function(req, res) {
    domain = req.protocol + '://' + req.get('host');
    pg.connect(config.dbConnection, function (err, client, done) {
	client.query("select id, date::varchar, start, \"end\", length, created_At, updated_at FROM walks ORDER BY date DESC LIMIT 15",
		     function (err, result) {
			 done();
			 res.type('application/atom+xml');
			 res.render('atom', {
			     config: config,
			     walks: result.rows,
			     req: req,
			     domain: domain
			 })
		     })
    });


};
