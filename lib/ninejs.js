(function(global) {
	'use strict';
	var isAmd = (typeof(define) !== 'undefined') && define.amd,
		isNode = (typeof(window) === 'undefined'),
		req = require,
		path;
	function moduleExport(nineplate, deferredUtils, extend, Evented, i18n, moduleDefine) {
		nineplate = nineplate.default;
		moduleDefine = moduleDefine.define;
		extend = extend.default;
		Evented = Evented.default;

		var args = {
				Nineplate: nineplate,
				moduleDefine: moduleDefine
			};
		if (isNode) {
			var cluster = require('cluster'),
				isWin = /^win/.test(process.platform);
			if (!process.env.NODE_PATH) {
				process.env.NODE_PATH = path.resolve(process.cwd(), 'node_modules');
			}
			else {
				process.env.NODE_PATH = (isWin?';':',') + path.resolve(process.cwd(), 'node_modules');
			}
			extend.mixinRecursive(args, {
				start: function() {
					if (!cluster.worker) {
						req('fs').writeFileSync(path.resolve(process.cwd(), 'ninejs.pid'), JSON.stringify({ pid: process.pid }));
					}
					console.log(i18n.getResource().startingNineJs + ' ' + ((cluster.worker || {}).id || ''));
					var promise = req('../modules/serverBoot').default;
					return deferredUtils.when(promise, function() {
						this.emit('log', { message: i18n.getResource().nineJsStarted });
						return njs;
					}.bind(this));
				},
				build: function(target) {
					var promise = req('./build').build(target);
					return deferredUtils.when(promise, function() {
						this.emit('log', { message: i18n.getResource().nineJsBuilt });
						return njs;
					}.bind(this));
				},
				cluster: function() {
					var self = this,
						args = arguments;
					require('./cluster')(function() {
						self.start.apply(self, args);
					});
				},
				run: function(args) {
					var argv = [],
						cnt,
						len = args.length;
					for (cnt = 0; cnt < len; cnt += 1) {
						argv.push(args[cnt]);
					}
					if (!argv.length) {
						argv.push('start');
					}
					switch (argv[0]) {
					case 'start':
						this.start(argv);
						break;
					case 'cluster':
						this.cluster.apply(this, arguments);
						break;
					case 'build':
						this.build.apply(this, [argv[1]].concat(argv));
						break;
					case 'windows':
						this.windows.apply(this, argv.slice(1));
						break;
					default:
						break;
					}
				},
				windows: function(argv) {
					require('./windows').run(argv);
				}
			});
		}
		var NineJs = extend(Evented, args);
		if (isNode) {
			NineJs = NineJs.extend(function() {
				this.locale = process.env.NINEJSLOCALE;
				i18n.setLocale(this.locale);
			});
		}
		var njs = new NineJs();

		return njs;
	}
	if (isAmd) {
		define(['../nineplate', '../core/deferredUtils', '../core/extend', '../core/ext/Evented', '../core/i18n!./nls/strings.json', '../modules/moduleDefine'], moduleExport);
	}
	else if (isNode) {
		path = req('path');
		module.exports = moduleExport(req('../nineplate'), req('../core/deferredUtils'), req('../core/extend'), req('../core/ext/Evented'), req('../core/i18n').getResource(path.resolve(__dirname, './nls/strings.json')), req('../modules/moduleDefine'));
	}
	else {
		//must include extend, deferredUtils, Evented, nineplate, i18n in that order
		global.ninejs.ninejs = moduleExport(global.ninejs.nineplate, global.ninejs.core.deferredUtils, global.ninejs.core.extend, global.ninejs.core.ext.Evented, global.ninejs.core.i18n.getResource('./nls/strings.json'));
	}
})(this);