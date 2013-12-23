var encoder = require("./path_encoder")
,   config  = require('config')
,   url     = require('url')
,   util    = require('util')
,   models  = require('./models')
,   geos    = require('geos')
,   fs      = require('fs')
,   Walk    = models.Walk
,   Area    = models.Area;

/*
 * GET home page.
 */

exports.index = function(req, res){
    fs.readFile('package.json', function (err, data) {
	var json = JSON.parse(data);
	res.render('index', {
	    app_version: json.version,
	    app_env: process.env.NODE_ENV,
	    twitter_hashtags: config.twitter_hashtags
	});
    });
};


exports.search = function(req, res){
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
	
    var where;
    if (req.query.id) {
	where = ['id = ?', req.query.id];
    }
    else if (req.query.date) {
	where = ['date = ?', req.query.date];
    }
    else if (req.query.type == 'neighbor') {
	var latitude  = parseFloat(req.query.latitude);
	var longitude = parseFloat(req.query.longitude);
	var radius    = parseFloat(req.query.radius);
	var dlat      = radius*180/Math.PI/models.EARTH_RADIUS;
	var dlon      = dlat/Math.cos(longitude/180*Math.PI);

	where = ["st_setsrid(st_makebox2d(st_point(?, ?), st_point(?, ?)), ?) && path and st_distance_sphere(path, st_setsrid(st_point(?, ?),?)) <= ?",
		 longitude-dlon, latitude-dlat, longitude+dlon, latitude+dlat, models.SRID, longitude, latitude, models.SRID, radius];
    }
    else if (req.query.type == 'areas') {
	var areas = req.query.areas.split(/,/).map(function (elm) { return "'" + elm + "'"; }).join(',');
	where = ["EXISTS (SELECT * FROM areas WHERE jcode IN (" + areas + ") AND path && the_geom AND ST_Intersects(path, the_geom))"];
    }
    else if (req.query.type == 'cross') {
	var linestring = Walk.decodePath(req.query.searchPath);
	where = ["path && ? AND ST_Intersects(path, ?)", linestring, linestring ];
    }
    else {
	where = null;
    }
    var limit  = parseInt(req.query.limit) || 20;
    var offset = parseInt(req.query.offset) || 0;
    Walk.findAndCountAll({
	order  : order, 
	where  : where,
	offset : offset,
	limit  : limit
    }).success(function ( result) {
        var params = null;
	if (result.count > offset + limit) {
	    var q = Object.keys(req.query).filter(function (e) { return e != 'offset';}).map( function (e) { return e + '=' + req.query[e]; });
	    q.push("offset=" +  (offset + limit));
	    params = q.join('&');
	}
	res.json({
	    count: result.count,
            params: params,
	    rows:  result.rows.map(function (row) { return row.asObject(result.count > 1); })
	});
    });
};

exports.add_area = function(req, res){
    var latitude  = parseFloat(req.query.latitude);
    var longitude = parseFloat(req.query.longitude);
    Area.find({
	where  : ['ST_Contains(the_geom, ST_SetSRID(ST_Point(?, ?), ?))', longitude, latitude, models.SRID],
    }).success(function (result) {
	res.json(result.asObject());
    });
};

exports.show = function(req, res) {
    var ids = req.params.id || req.body.id;

    if (typeof ids == "string") {
	ids = [ids];
    }
    Walk.findAll({
	where  : { id : ids },
    }).success(function ( result) {
	res.json(result.map(function (row) {
	    return row.asObject(false);
	}));
    });
};
exports.save = function(req, res) {
    var walk;
    var saveCallback = function (row) {
	res.json(row.asObject());
    };
    var linestring = Walk.decodePath(req.body.path);
    var query;
    var values;
    if (req.body.id) {
	query = "UPDATE walks SET date = ?, start = ?, \"end\" = ?, path = ?, length = ST_LENGTH(?, TRUE)/1000, updated_at = NOW() WHERE id = ? RETURNING *";
	values = [req.body.date, req.body.start, req.body.end, linestring, linestring, req.body.id]
    }
    else {
	query = "INSERT INTO walks (date, start, \"end\", path, length, created_at, updated_at) VALUES(?, ?, ?, ?, ST_LENGTH(?, TRUE)/1000, NOW(), NOW()) RETURNING *";
	values = [req.body.date, req.body.start, req.body.end, linestring, linestring];
    }
    models.sequelize.query(query, Walk, {raw : true}, values).success(function (row) {
	res.json(row.options.instanceMethods.asObject.call(row, true));
    });

};

exports.destroy = function(req, res) {
    Walk.destroy({ id : req.params.id }).success(function () {
       res.end('');
    });
};

exports.export = function(req, res) {
    Walk.find({id : req.params.id }).success(function (row) {
        res.type('application/json');
        res.attachment(req.params.id + ".json");
        res.json(row.pathJSON());
    });
};

