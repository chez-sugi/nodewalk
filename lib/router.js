var express = require('express')
,   config  = require('config')
,   url     = require('url')
,   util    = require('util')
,   models  = require('./models')
,   fs      = require('fs')
,   Walk    = models.sequelize.models.walks
,   Area    = models.sequelize.models.areas;

/*
* GET home page.
*/

var router = express.Router();
module.exports = router;

router.get('/version', function(req, res){
    fs.readFile('package.json', function (err, data) {
        var json = JSON.parse(data);
        res.json({
            app_version: json.version,
            app_env: process.env.NODE_ENV,
            twiter_hashtags: config.twitter_hashtags
        });
    });
});


router.get('/search', function(req, res){
    var order_hash = {
        "newest_first"       : "date desc",
        "oldest_first"       : "date",
        "longest_first"      : "length desc",
        "shortest_first"     : "length",
        "easternmost_first"  : "xmax(PATH) desc",
        "westernmost_first"  : "xmin(PATH)",
        "southernmost_first" : "ymin(PATH)",
        "northernmost_first" : "ymax(PATH) desc",
        "nearest_first"      : "distance"
    };
    var where, exprs = [], values = [];
    var order = order_hash[req.query.order] || 'date desc';

    var attributes = ['id', 'date', 'start', 'end', 'path', "length"];

    if (req.query.id) {
        exprs.push('id = ?');
        values.push(req.query.id);
    }
    else if (req.query.date) {
        exprs.push('date = ?');
        values.push(req.query.date);
    }
    else {
        if (req.query.year) {
            exprs.push('extract(year from DATE) = ?');
            values.push(parseInt(req.query.year));
        }
        if (req.query.month) {
            exprs.push('extract(month from DATE) = ?');
            values.push(parseInt(req.query.month));
        }

        if (req.query.filter == 'circle') {
            var latitude  = parseFloat(req.query.latitude);
            var longitude = parseFloat(req.query.longitude);
            var radius    = parseFloat(req.query.radius);
            var dlat      = radius*180/Math.PI/models.EARTH_RADIUS;
            var mlat      = latitude > 0 ? latitude + dlat : latitude - dlat;
            var dlon      = dlat/Math.cos(mlat/180*Math.PI);
            var center    = Walk.getPoint(longitude, latitude);
            var lb        = Walk.getPoint(longitude-dlon, latitude-dlat);
            var rt        = Walk.getPoint(longitude+dlon, latitude+dlat);
            attributes.push([ util.format("st_distance(path, '%s', true)/1000", center), 'distance' ]);
            exprs.push('st_makebox2d(?, ?) && path', 'st_distance(path, ?, TRUE) <= ?');
            values.push(lb, rt,  center, radius);
        }
        else if (req.query.filter == 'cities') {
            var cities = req.query.cities.split(/,/).map(function (elm) { return "'" + elm + "'"; }).join(',');
            exprs.push("EXISTS (SELECT * FROM areas WHERE jcode IN (" + cities + ") AND path && the_geom AND ST_Intersects(path, the_geom))");
        }
        else if (req.query.filter == 'crossing') {
            var linestring = Walk.decodePath(req.query.searchPath);
            exprs.push("path && ?", "ST_Intersects(path, ?)");
            values.push(linestring, linestring);
        }
        else if (req.query.filter == 'hausdorff') {
            var max_distance = req.query.max_distance || 4000;
            linestring = Walk.decodePath(req.query.searchPath);
            extent     = Walk.getPathExtent(req.query.searchPath);
            dlat       = max_distance*180/Math.PI/models.EARTH_RADIUS;
            mlat       = Math.max(Math.abs(extent.ymax + dlat), Math.abs(extent.ymin-dlat));
            dlon       = dlat/Math.cos(mlat/180*Math.PI);
            lb         = Walk.getPoint(extent.xmin-dlon, extent.ymin-dlat);
            rt         = Walk.getPoint(extent.xmax+dlon, extent.ymax+dlat);

            attributes.push([util.format("ST_HausdorffDistance(ST_Transform(path, %d), ST_Transform('%s', %d))/1000", models.SRID_FOR_SIMILAR_SEARCH, linestring, models.SRID_FOR_SIMILAR_SEARCH), 'distance']);
            exprs.push('ST_Within(path, ST_SetSRID(ST_MakeBox2d(?, ?), ?))',
                'ST_HausdorffDistance(ST_Transform(path, ?), ST_Transform(?, ?)) < ?');
            values.push(lb, rt, models.SRID, models.SRID_FOR_SIMILAR_SEARCH, linestring, models.SRID_FOR_SIMILAR_SEARCH, max_distance);
        }
    }
    where = [exprs.map(function (e) { return '(' + e + ')';}).join(' AND ')].concat(values);
    var limit  = parseInt(req.query.limit) || 20;
    var offset = parseInt(req.query.offset) || 0;
    Walk.findAndCountAll({
        attributes : attributes,
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
            rows:  result.rows.map(function (row) { return row.asObject(result.count == 1); })
        });
    });
});

router.get('/add_city', function(req, res){
    var latitude  = parseFloat(req.query.latitude);
    var longitude = parseFloat(req.query.longitude);
    Area.find({
        where  : ['ST_Contains(the_geom, ST_SetSRID(ST_Point(?, ?), ?))', longitude, latitude, models.SRID],
    }).success(function (result) {
        res.json(result.asObject());
    });
});

function showPaths(req, res) {
    var ids = req.params.id || req.body.id;

    if (typeof ids == "string") {
        ids = [ids];
    }
    Walk.findAll({
        attributes : ['id', 'date', 'start', 'end','path', 'length'],
        where  : { id : ids },
    }).success(function ( result) {
        res.json(result.map(function (row) {
            return row.asObject(true);
        }));
    });
}
router.get('/show/:id', showPaths);
router.post('/show', showPaths);

router.post('/save', function(req, res) {
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
    models.sequelize.query(query, Walk.build(), {raw : true}, values).success(function (row) {
        res.json(row.asObject.call(row, false));
    });

});

router.get('/destroy/:id', function(req, res) {
    Walk.destroy({ id : req.params.id }).success(function () {
        res.end('');
    });
});

router.get('/export/:id', function(req, res) {
    Walk.find({id : req.params.id }).success(function (row) {
        res.type('application/json');
        res.attachment(req.params.id + ".json");
        res.json(row.pathJSON());
    });
});
