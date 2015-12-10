var rfr = require('rfr');
var db = rfr('includes/models');
var ValidationError = rfr('includes/errors.js');
var api = rfr('includes/api.js');

exports.route = '/api/users';
exports.method = 'post';
exports.docs = {
	description: "Register new user",
	params: {
		"email": {
			required: true,
			description: 'Email',
			type: 'string'
		},
		"login": {
			required: true,
			description: 'Login or Username',
			type: 'string'
		},
		"type": {
			required: false,
			description: 'User type',
			type: 'string'
		},
		"password": {
			required: true,
			description: 'Password',
			type: 'string'
		}
	},
	returns: {
		description: "User record with auth_code property. Use this auth_code for signing next API calls. Also sets logged_in_user cookie to auth_code in response headers.",
		sample: '{"id": 23, "email": "example@gmail.com","login": "userlogin","is_demo": 0,"auth_code": "017957d841c8f6927c612ea1d6602c3f"}'
	}
};

exports.handler = function(req, res, next) {

	var body = req.body || {};

	var login = body.login || '';
	var type = body.type || 'default';
	var password = body.password || '';
	var email = body.email || '';

	var ip = api.getVisitorIp(req);

	var gotUser = null;

	db.User.removeOldDemoAccounts();

	db.User.register({
		login: login,
		type: type,
		password: password,
		email: email,
		ip: ip
	}).then(function(user) {
		gotUser = user;
		return user.auth();
	}).then(function(authentication) {
		res.setCookie('logged_in_user', authentication.auth_code, {
			path: '/',
			maxAge: 365 * 24 * 60 * 60
		});
		res.setCookie('is_logged_in_user', '1', {
			path: '/',
			maxAge: 365 * 24 * 60 * 60
		});

		res.send({
			id: gotUser.id,
			email: gotUser.email,
			login: gotUser.login,
			is_demo: gotUser.is_demo,
			auth_code: authentication.auth_code
		});

		next();
	}).catch(function(e) {
		throw e;
	});

	return true;
};