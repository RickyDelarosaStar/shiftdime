var rfr = require('rfr');
var db = rfr('includes/models');

// GET: 
exports.handler = function(req, res, next){
    res.setHeader('Access-Control-Allow-Origin', '*');
	res.send([]);
	return next();
};

exports.route = '/api/i18n/bycode/en';
exports.method = 'get';