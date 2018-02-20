(function (factory) {
	'use strict';
	var isAmd = typeof (define) === 'function' && define.amd;
	if (isAmd ) {
		define([], factory);
	}
	else if (typeof(exports) === 'object') {
		module.exports = factory();
	}
})(function () {
	return {
		"root" : {
			"alwaysFalse" : "ALWAYS FALSE",
			"alwaysTrue" : "ALWAYS TRUE",
			"ambiguousExpression": "AMBIGUOUS EXPRESSION",
			"and" : "AND",
			"averageOf" : "The average of",
			"contains" : "Contains",
			"countOf" : "The count of",
			"endsWith" : "Ends with",
			"equals" : "Equals",
			"every" : "Every",
			"greaterThan" : "Greater than",
			"greaterThanOrEquals" : "Greater or equal than",
			"invalidExpression" : "INCOMPLETE CONDITION",
			"lessThan" : "Less than",
			"lessThanOrEquals" : "Less or equal than",
			"not" : "NOT",
			"notEquals" : "Not Equals",
			"or" : "OR",
			"some" : "Some",
			"startsWith" : "Starts with",
			"sumOf" : "The sum of",
			"valueOf" : "The value of",
			"whereCaps": "WHERE"
		}
	};
});