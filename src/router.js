/* UMD.define */ (function (root, factory) {
    if (typeof customLoader === 'function'){ customLoader(factory, 'router'); }
    else if (typeof define === 'function' && define.amd){ define([], factory); }
    else if(typeof exports === 'object'){ module.exports = factory(); }
    else{ root.returnExports = factory();
        window.router = factory(); }
}(this, function () {

    var
        router,
        currentState = {},
        callbacks = {},
        wildbacks = {},
        initTimer,
        initialize = function () {
            clearTimeout(initTimer);
            initTimer = setTimeout(function () {
                window.addEventListener('hashchange', function (event) {
                    //console.log('event', event);
                    router.emit(parse(event.newURL, event.oldURL));
                });
                router.emit(parse(location.href));
                initialize = function () {};
            },100);
        };

    // TODO:
    // more than one on('/route')
    // more than one REST param
    // nested routes? like for tabs?
    // wildcards? any? So route can be inspected

    router = {

        on: function (route, callback) {
            initialize();
            if(route.indexOf(':') > -1){
                // /worksheet/employees/:id
                // /worksheet/employees/Mike123456


                var id = route.split('/:')[0];
                wildbacks[id] = {
                    callback: callback,
                    prop: route.split('/:')[1]
                };
                return {
                    remove: function () {
                        delete wildbacks[id];
                    }
                };
            }

            callbacks[route] = callback;
            return {
                remove: function () {
                    delete callbacks[route];
                }
            };
        },

        emit: function (eventDetail) {

            var
                hash = eventDetail.hash,
                wildCardUrl,
                lastPath = getLastPath(hash);

            if(callbacks[hash]){
                callbacks[hash](eventDetail);
                return;
            }

            wildCardUrl = removeLastPath(hash);
            if(wildbacks[wildCardUrl]){
                eventDetail[wildbacks[wildCardUrl].prop] = lastPath;
                wildbacks[wildCardUrl].callback(eventDetail);
                return;
            }

            console.log('no route found (404)', hash);
        }
    };

    function parse(newUrl, oldUrl){

        currentState = urlToObject(newUrl);
        currentState.previous = urlToObject(oldUrl);
        currentState.oldUrl = currentState.previous.url;

        return currentState;
    }

    function paramsToObject (params) {
        if(!params){ return null; }
        params = params.split('&');
        var o = {};
        params.forEach(function (param) {
            o[param.split('=')[0]] = normalize(param.split('=')[1]);
        });
        return o;
    }

    function urlToObject (url) {
        if(!url){
            return {};
        }
        var
            params = paramsToObject(url.split('?')[1]),
            hash = url.split('?')[0].split('#')[1] || '/',
            paths = hash ? hash.split('/') : [],
            map = {};
        paths.forEach(function (path) {
            map[path] = true;
        });

        return {
            url: url,
            hash: hash,
            paths: paths,
            map: map,
            params: params
        };
    }

    function getLastPath (url) {
        var paths = url.split('/');
        return paths[paths.length - 1];
    }

    function removeLastPath (url) {
        var paths = url.split('/');
        paths.pop();
        return paths.join('/');
    }

    function normalize(val){
        if(val === 'false'){
            return false;
        }else if(val === 'true'){
            return true;
        }
        if(!isNaN(parseFloat(val))){
            return parseFloat(val);
        }
        return val;
    }

    return router;
}));