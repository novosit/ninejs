define([], function () {
    'use strict';
    var w = (typeof(window) !== 'undefined') ? window : this;
    return ((((w.require || {}).s || {}).contexts || {})._ || {}).config || {};
});