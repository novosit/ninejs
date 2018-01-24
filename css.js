(function (factory) {
    'use strict';
    var req = require,
        isAmd = typeof (define) === 'function' && define.amd;
    if (isAmd) {
        define(['./core/extend', './core/deferredUtils', './css/builder', './request', './css/style'], factory);
    }
    else if (typeof(exports) === 'object') {
        module.exports = factory(require('./core/extend'), require('./core/deferredUtils'), require('./css/builder'), require('./request'), require('./css/style'));
    }
})(function (extend, def, builder, request, style) {
    'use strict';
    var result = {},
        isAmd = (typeof(define) !== 'undefined') && define.amd,
        isDojo = isAmd && define.amd.vendor === 'dojotoolkit.org',
        buildStyleObject = style.buildStyleObject;
    
    function loadStyle(data, path, prefixes, baseUrl, autoEnable, load) {
        function processCallback(processResult) {
            
            var r = buildStyleObject(processResult);
            if (autoEnable) {
                r.handle = r.enable();
            }
            
            load(r);
        }
        
        if (!data) {
            processCallback({path: path});
        }
        else {
            builder.processCss(data, path, path, prefixes, baseUrl, {}, processCallback);
        }
    }
    
    result.style = buildStyleObject;
    
    result.loadFromString = function (css, uniqueId) {
        var packages;
        if (isDojo) {
            packages = window.dojoConfig.packages;
        }
        else {
            packages = window.requirejs.s.contexts._.config.packages;
        }
        var defer = def.defer();
        loadStyle(css, uniqueId, packages, '', true, function (styleObj) {
            defer.resolve(styleObj);
        });
        return defer.promise;
    };
    
    function isUrl(fname){
        return (fname.indexOf('http:') === 0) || (fname.indexOf('https:') === 0);
    }
    
    result.load = function (id, require, load) {
        /* jshint unused: true */
        // id: String
        //		Path to the resource.
        // require: Function
        //		Object that include the function toUrl with given id returns a valid URL from which to load the text.
        // load: Function
        //		Callback function which will be called, when the loading finished.
        var parts = id.split('!');
        var fname = parts[0];
        var autoEnable = false;
        if (parts[1] && parts[1] === 'enable') {
            autoEnable = true;
        }
        var isDojo = (define.amd && define.amd.vendor === 'dojotoolkit.org');
        
        var name;
        if (require.cache) {
            if (require.cache[(parts[0] + '.ncss')]) {
                name = (parts[0] + '.ncss');
            }
            else {
                name = parts[0];
            }
        }
        
        if (isDojo && require.cache[name]) {
            require([name], function (styleModule) {
                if (autoEnable) {
                    styleModule.enable();
                }
                load(styleModule);
            });
        }
        else {
            if (isUrl(fname)) {
                loadStyle(null, fname, require.rawConfig.packages, '', autoEnable, load);
            } else {
                var extIdx = fname.lastIndexOf('.');
                if (extIdx < 0) {
                    fname = fname + '.css';
                }
                var path = require.toUrl(parts[0]);
                if (isDojo) { //Dojo Toolkit
                    require.getText(path, false, function (data) {
                        loadStyle(data, path, require.rawConfig.packages, require.rawConfig.baseUrl, autoEnable, load);
                    });
                }
                else {
                    request.get(path, {type: 'html'}).then(function (data) {
                        if ((typeof(window) !== 'undefined') && (data instanceof window.XMLHttpRequest)) { //Sometimes reqwest returns xhr object when response is empty
                            data = data.responseText;
                        }
                        var packages;
                        if (isDojo) {
                            packages = window.dojoConfig.packages;
                        }
                        else {
                            packages = window.requirejs.s.contexts._.config.packages;
                        }
                        loadStyle(data, path, packages, '', autoEnable, load);
                    });
                }
            }
        }
    };
    result.pitch = function (filePath) {
        function buildCssModule(text) {
            var cssBuilder = require('./css/build/dojo-amd');
            var path = require('path');
            var baseUrl = filePath;
            var sourcePath = filePath;
            var cssPrefixes = {};
            return cssBuilder.buildAppender(text, path.relative(baseUrl || '', sourcePath).split('\\').join('/'), sourcePath, cssPrefixes || {}, path.dirname(sourcePath), {}, true)
        }
        return new Promise(function (resolve) {
            if (isUrl(filePath)) {
                request.get(filePath, {}, function (text) {
                    resolve(buildCssModule(text));
                });
            }
            else if (isDojo) {
                require.getText(filePath, false, function (text) {
                    resolve(buildCssModule(text));
                });
            }
            else {
                var requireText = require('require-text');
                var text = requireText(filePath, require);
                resolve(buildCssModule(text));
            }
        });
    };
    return result;
});