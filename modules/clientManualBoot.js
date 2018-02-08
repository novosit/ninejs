(function (factory) {
	'use strict';
	function isWebpackRunning() {
        return (typeof(process) !== 'undefined') && process.env && (process.env.npm_lifecycle_event === 'webpack');
	}
	var isAmd = typeof (define) === 'function' && define.amd;
	if (isAmd) {
        define([
        	'./config', 
        	'./moduleRegistry', 
        	'./Module', 
        	'../core/extend', 
        	'../core/deferredUtils', 
        	'./client/router', 
        	'./ninejs-client', 
        	'./client/container', 
        	'./client/singlePageContainer'
        ], factory);
	}
	else {
        module.exports = factory(
        	require('./config'), 
        	require('./moduleRegistry'), 
        	require('./Module'), 
        	require('../core/extend'), 
        	require('../core/deferredUtils'), 
        	require('./client/router'), 
        	require('./ninejs-client'), 
        	require('./client/container'), 
        	require('./client/singlePageContainer')
        );
	}
})(function (clientConfig, registry, Module, extend, def, router, client, container, singlePageContainer) {
	'use strict';
	return {
		init: function (dependencies) {
			var cnt,
				current,
				allUnitsCfg = {},
				unitCfg;
			var modules = ((clientConfig.ninejs || {}).ninejs || {}).modules || {},
			moduleArray = [];
			for (var p in modules) {
				if (modules.hasOwnProperty(p)) {
					moduleArray.push(p);
				}
			}
			for (cnt = 0; cnt < dependencies.length; cnt += 1) {
				registry.addModule(dependencies[cnt]);
			}
			for (cnt = 0; cnt < dependencies.length; cnt += 1) {
				current = dependencies[cnt];
				unitCfg = modules[moduleArray[cnt]];
				extend.mixinRecursive(allUnitsCfg, unitCfg);
			}
			extend.mixinRecursive(clientConfig, { units: {} });
			extend.mixinRecursive(allUnitsCfg, clientConfig.units);
			extend.mixinRecursive(clientConfig.units, allUnitsCfg);
			for (cnt = 0; cnt < dependencies.length; cnt += 1) {
				current = modules[cnt];
				Module.prototype.enable.call(current, clientConfig.units);
			}
		},
		enableModules: function () {
			return registry.enableModules();
		}
	};
});