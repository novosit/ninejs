/*
Searched for defined client side 9js modules, requires them and initializes with their respective config

modules must have:
{
	mid: 'ninejs/sampleModule' //The AMD moduleID
}
*/
define(['./config', './moduleRegistry', './Module', '../core/extend', '../core/deferredUtils', './clientManualBoot', './client/router', './ninejs-client', './client/container', './client/singlePageContainer'], function(clientConfig, registry, Module, extend, deferredUtils, clientManualBoot) {
	'use strict';
	var modules = clientConfig.modules || {},
		moduleArray = [],
		prefix = clientConfig.prefix || 'ninejs',
		onDemandModules = {
			'ninejs': prefix + '/modules/ninejs-client',
			'router': prefix + '/modules/client/router',
			'container': prefix + '/modules/client/container',
			'singlePageContainer': prefix + '/modules/client/singlePageContainer'
		};
	registry.set('onDemandModules', onDemandModules);
	for (var p in modules) {
		if (modules.hasOwnProperty(p)) {
			moduleArray.push(p);
		}
	}
	var moduleLoadPromise = deferredUtils.defer();
	var r = { req: require };
	r.req(moduleArray, function() {
		var modules = Array.prototype.slice.call(arguments, 0);
		clientManualBoot.init(modules);
		moduleLoadPromise.resolve(true);
	});
	return deferredUtils.when(moduleLoadPromise.promise, function(){
		var defer = deferredUtils.defer();
		deferredUtils.when(registry.enableModules(), function(val) {
			defer.resolve(val);
		}, function (error) {
			console.log(error);
			throw new Error(error);
		});
		return defer.promise;
	}, function(error) {
		console.log(error);
		throw new Error(error);
	});
});