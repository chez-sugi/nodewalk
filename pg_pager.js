'use strict';

var async = require('async');
exports.paginate = function(client, params, callback) {
    var table     = params['table'];
    var where     = params['where'];
    var select    = params['select'];
    var values    = params['values'];
    var order     = params['order']
    var page_size = params['page_size'];
    var page      = params['page'];
    var query = ["SELECT", "count(*)::int as count", "FROM", table];
    var res;
    if (where) {
	query.push('WHERE', where);
    }
    console.log(query.join(' '));
    async.waterfall([
	function (callback) {
	    client.query(query.join(' '), values, function (err, result) {
		console.log(err);
		var arg = { "total_count" : result.rows[0].count };
		callback(err, arg);
	    });
	},
	function (arg, callback) {
	    query[1] = select.join(',');
	    if (order) {
		query.push('ORDER BY', order);
	    }
	    query.push('LIMIT', page_size);
	    query.push('OFFSET', page_size * (page - 1));
		console.log(query.join(' '));
	    client.query(query.join(' '), values, function (err, result) {
		console.log(err);
		arg["items"] = result.rows;
		arg["current_page"] = page;
		callback(err, arg);
	    });
	}
    ], function (err, result) {
	callback(err, result);
    });
};