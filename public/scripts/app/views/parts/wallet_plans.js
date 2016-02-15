// wallet_plans.js
App.Views.Parts.WalletPlans = Backbone.View.extend({

	templateName: 'parts/wallet_plans',
	events: {},
	areStatsReady: false,
	initialize: function() {
		console.log('views/parts/wallet_plans.js | Initializing Wallet Plans view');
		if (!this.model || !this.id)
			console.error('views/parts/wallet_plans.js | model and dom id should be provided for this view');

		this.areStatsReady = false;
		var that = this;
		this.listenToOnce(this.model, 'plansloaded', function() {
			that.invokeStatsLoading();
		});
		this.listenTo(this.model, 'plansloaded', this.render);
		this.model.getPlans();
	},
	wakeUp: function() {
		console.error('views/parts/wallet_plans.js | Waking up');
	},
	invokeStatsLoading: function() {
		var that = this;
		var complete = _.invoke(this.model.plans.models, 'getStats');
		$.when.apply($, complete).done(function() {
			that.areStatsReady = true;
			that.render();
		});
	},
	render: function() {
		console.log('views/parts/wallet_plans.js | Rendering');
		this.setElement($('#' + this.id));

		var plans = [];
		for (var i = 0; i < this.model.plans.length; i++) {
			var allowedToSpend = null;
			if (this.areStatsReady)
				allowedToSpend = this.model.plans.at(i).getPlanForToday();
			plans.push({
				plan: this.model.plans.at(i).toJSON(),
				allowedToSpend: allowedToSpend
			});
		}

		var data = {
			wallet: this.model.toJSON(),
			plans: plans,
			areStatsReady: this.areStatsReady
		};
		var that = this;
		App.templateManager.fetch(this.templateName, data, function(html) {
			that.$el.html(html);
			that.trigger('render');
			that.trigger('loaded');
		});
	}
});