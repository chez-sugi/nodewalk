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

exports.Walk = sequelize.define('walks', {
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
        decodePath: function (path) {
            var json = { type: 'LineString', coordinates: encoder.decode(path) };
            return util.format('SRID=%d;%s', SRID, wktwriter.write(jsonreader.read(json)));
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
                updated_at: this.updated_at
	    };
	}
    }
});

exports.Area = sequelize.define('areas', {
    jcode:	Sequelize.INTEGER,
    the_geom:   Sequelize.BLOB
}, {
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
			

