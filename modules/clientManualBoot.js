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
        	'./ninejs-client'
        ], factory);
	}
	else {
        module.exports = factory(
        	require('./config'), 
        	require('./moduleRegistry'), 
        	require('./Module'), 
        	require('../core/extend'), 
        	require('../core/deferredUtils'),
        	require('./ninejs-client')
        );
	}
})(function (clientConfig, registry, Module, extend, def, client) {
	'use strict';
	return {
		init: function (dependencies) {
			var cnt,
				current,
				allUnitsCfg = {},
				unitCfg,
				tempConfig = (clientConfig.ninejs || clientConfig || {});

			var modules = (tempConfig.ninejs || tempConfig || {}).modules || {},
			moduleArray = [];
			registry.addModule(client);
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
			var ret = def.defer();
			ret.resolve(true);
			return ret.promise;
		},
		enableModules: function () {
			return registry.enableModules();
		}
	};
});