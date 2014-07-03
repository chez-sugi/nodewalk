var Sequelize = require('sequelize');
var config    = require('config');
var encoder = require("./path_encoder");
var geos    = require("geos");
var util    = require("util");
require('date-utils');

var EARTH_RADIUS = 6370986;
var SRID = 4326;

exports.SRID = SRID;
exports.EARTH_RADIUS = EARTH_RADIUS;
exports.SRID_FOR_SIMILAR_SEARCH = 32662;

var wkbreader  = new geos.WKBReader();
var jsonwriter = new geos.GeoJSONWriter();
var jsonreader = new geos.GeoJSONReader();
var wktwriter  = new geos.WKTWriter();
var sequelize = new Sequelize(config.dbConnection, {
    dialect: 'postgres',
    omitNull: true,
    native: false
});

exports.sequelize = sequelize;

sequelize.define('walks', {
    id:	        Sequelize.INTEGER,
    date:       Sequelize.STRING,
    start: 	Sequelize.STRING,
    end:	Sequelize.STRING,
    length:     {
	type: Sequelize.FLOAT,
    },
    path: {
	type : Sequelize.TEXT,
    }
}, {
    underscored: true,
    classMethods: {
	getPoint: function (x, y) {
	   return util.format('SRID=%d;POINT(%d %d)', SRID, x, y);
	},
        decodePath: function (path) {
            var json = { type: 'LineString', coordinates: encoder.decode(path) };
            return util.format('SRID=%d;%s', SRID, wktwriter.write(jsonreader.read(json)));
        },
	getPathExtent: function (path) {
	    var points = encoder.decode(path);
	    return points.reduce(function (pv, cv) {
		if (pv.xmax === undefined || pv.xmax < cv[0] ) pv.xmax = cv[0];
		if (pv.xmin === undefined || pv.xmin > cv[0] ) pv.xmin = cv[0];
		if (pv.ymax === undefined || pv.ymax < cv[1] ) pv.ymax = cv[1];
		if (pv.ymin === undefined || pv.ymin > cv[1] ) pv.ymin = cv[1];
		return pv;
	    }, {});
	}
    },
    instanceMethods: {
        pathJSON : function () {
            return jsonwriter.write(wkbreader.readHEX(this.path));
        },
    	encodedPath: function () {
    	    return encoder.encode(this.pathJSON().coordinates);
    	},
    	asObject: function (omitPath) {
    	    return {
    		id: this.id,
    		date : this.date.toFormat('YYYY-MM-DD'),
    		start: this.start,
    		end: this.end,
    		length : this.length,
    		path : omitPath ? null : this.encodedPath(),
                    created_at: this.created_at,
                    updated_at: this.updated_at,
    		distance: this.distance
    	    };
    	}
    }
});

sequelize.define('areas', {
    jcode:	{
        type:       Sequelize.INTEGER,
        primaryKey: true
    },
    the_geom:   Sequelize.BLOB
}, {
    timestamps:  false,
    underscored: true,
    instanceMethods: {
    	encodedGeom: function () {
    	    var obj = jsonwriter.write(wkbreader.readHEX(this.the_geom));
    	    return  obj.coordinates.map(function (polygones) {
    		return encoder.encode(polygones[0]);
    	    }).join(' ');
    	},
    	asObject: function () {
    	    return {
    		jcode:     this.jcode,
    		the_geom : this.encodedGeom()
    	    };
    	}
    }
});
