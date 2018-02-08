/** 
@module ninejs/core/ext/Evented 
@author Eduardo Burgos <eburgos@gmail.com>
*/
(function() {
	'use strict';
	var isAmd = (typeof(define) !== 'undefined') && define.amd,
		isDojo = isAmd && define.amd.vendor === 'dojotoolkit.org',
		isNode = (typeof(window) === 'undefined');

	function evented(on, aspect) {
		var after = aspect.after;
		return {
			on: function(type, listener){
				return on.parse(this, type, listener, function(target, type){
					return after(target, 'on' + type, listener, true);
				});
			},
			emit: function(/*type, event*/){
				var args = [this];
				args.push.apply(args, arguments);
				return on.emit.apply(on, args);
			}
		};
	}

	if (isAmd) { //AMD
		define(['../on', '../aspect'], evented);
	} else {
		//If it's node then Evented is the same as EventEmitter
		module.exports = evented(require('../on'), require('../aspect'));
	}
})();