var rfr = require('rfr');
var db = rfr('includes/models');
var errors = rfr('includes/errors.js');
var api = rfr('includes/api.js');

exports.route = '/api/wallets/:wallet_id/transactions';
exports.method = 'post';

exports.handler = function(req, res, next){

    var body = req.body || {};
	var wallet_id = parseInt(body.wallet_id, 10) || 0;
	var amount = parseFloat(body.amount, 10) || 0;
	var description = body.description || '';
	var subtype = body.subtype || 'confirmed';

	api.requireSignedIn(req, function(user){
		db.Wallet.findOne({ where: {id: wallet_id, user_id: user.id}})
		.then(function(wallet){
			if (!wallet) throw new errors.HaveNoRightsError();	
			if (subtype == 'setup')
				return wallet.setTotalTo({description: description, amount: amount});
			else
				return wallet.insertTransaction({description: description, amount: amount});
		}).then(function(transaction){
			res.send(transaction);
			next();
		});
	});
	
};


