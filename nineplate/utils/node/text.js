'use strict';
/* jshint unused: true */
function load(name, req, onLoad/*, config*/) {
	var r = { req: require }
	var fs = r.req('fs');
	fs.readFile(name, 'utf8', function(error, data) {
		if (error) {
			throw new Error(error);
		}
		else {
			onLoad(data);
		}
	});
}
exports.load = load;