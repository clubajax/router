/* UMD.define */ (function (root, factory) {
    if (typeof customLoader === 'function'){ customLoader(factory, 'router'); }
    else if (typeof define === 'function' && define.amd){ define([], factory); }
    else if(typeof exports === 'object'){ module.exports = factory(); }
    else{ root.returnExports = factory();
        window.router = factory(); }
}(this, function () {

    var
        router,
        returnHash,
        uidCount = 0,
        currentState = {},
        callbacks = {},
        wildbacks = {},
        beforebacks = {},
        leavebacks = {},
        notFound = {},
        initTimer,
        initialize = function () {
            clearTimeout(initTimer);
            initTimer = setTimeout(function () {
                window.addEventListener('hashchange', function (event) {
                    // IE does not have URLs in the event, so use previous
                    var prev = router.current ? router.current.url : '';
                    router.emit(parse(event.newURL || location.href, prev));
                });
                router.emit(parse(location.href));
                initialize = function () {};
            },100);
        };

    function uid () {
        uidCount++;
        return 'route-' + uidCount;
    }

    // TODO:
    // more than one on('/route')
    // more than one REST param
    // nested routes? like for tabs?
    // wildcards? any? So route can be inspected

    function addCallback (object, route, callback, prop) {
        var id = uid();
        object[route] = object[route] || {};
        object[route][id] = {
            callback: callback,
            prop: prop
        };
        return {
            remove: function () {
                delete object[route][id];
                if(!Object.keys(object[route]).length){
                    delete object[route];
                }
            }
        };
    }

    router = {

        on: function (route, callback) {
            initialize();
            var id;
            if(route === 'not-found'){
                id = uid();
                notFound[id] = {
                    callback: callback
                };
                return {
                    remove: function () {
                        delete callbacks[id];
                    }
                };
            }

            // /worksheet/employees/:id
            // /worksheet/employees/Mike123456
            if(route.indexOf(':') > -1){
                return addCallback(wildbacks, route.split('/:')[0], callback, route.split('/:')[1]);
            }

            return addCallback(callbacks, route, callback);
        },

        before: function (route, callback) {
            initialize();
            return addCallback(beforebacks, route, callback);
        },

        leave: function (route, callback) {
            initialize();
            return addCallback(leavebacks, route, callback);
        },

        emit: function (eventDetail, skipBeforeBacks, skipLeaveBacks) {

            var
                hash = eventDetail.hash,
                phash = eventDetail.previous.hash,
                wildCardUrl,
                lastPath = getLastPath(hash);

            if(returnHash === hash){
                returnHash = null;
                return;
            }
            returnHash = null;

            this.hash = hash;


            if(!skipLeaveBacks && phash){
                if(leavebacks[phash]) {
                    Object.keys(leavebacks[phash]).forEach(function (route) {
                        if(leavebacks[phash][route] && leavebacks[phash][route].callback) {
                            leavebacks[phash][route].callback(eventDetail, function (result) {
                                if (hash === currentState.hash) {
                                    if (result) {
                                        // continue
                                        router.emit(eventDetail, false, true);
                                        router.current = eventDetail;
                                    }
                                    else if (eventDetail.previous.hash) {
                                        // reject
                                        returnHash = phash;
                                        location.hash = phash;
                                    }
                                }
                                else {
                                    console.warn('Hash has changed - cannot continue with `leave` action');
                                }
                            });
                        }else{
                            console.warn('router: callback missing for route', phash, route);
                        }
                    });

                    return;
                }
            }

            if(!skipBeforeBacks){
                if(beforebacks[hash]) {
                    Object.keys(beforebacks[hash]).forEach(function (route) {
                        beforebacks[hash][route].callback(eventDetail, function (result) {
                            if(hash === currentState.hash){
                                if(result) {
                                    router.emit(eventDetail, true);
                                    router.current = eventDetail;
                                }else if(eventDetail.previous.hash){
                                    location.hash = eventDetail.previous.hash;
                                }
                            }
                            else{
                                console.warn('Hash has changed - cannot continue with `before` action');
                            }
                        });
                    });

                    return;
                }
            }

            router.current = eventDetail;

            if(callbacks[hash]){
                Object.keys(callbacks[hash]).forEach(function (route) {
                    callbacks[hash][route].callback(eventDetail);
                });
                return;
            }

            wildCardUrl = removeLastPath(hash);
            if(wildbacks[wildCardUrl]){

                Object.keys(wildbacks[wildCardUrl]).forEach(function (route) {
                    eventDetail[wildbacks[wildCardUrl][route].prop] = lastPath;
                    wildbacks[wildCardUrl][route].callback(eventDetail);
                });

                return;
            }

            if(Object.keys(notFound).length) {
                Object.keys(notFound).forEach(function (key) {
                    notFound[key].callback(eventDetail);
                });
            }else{
                console.log('no route found (404)', hash);
            }

        }
    };

    function parse(newUrl, oldUrl){

        currentState = urlToObject(newUrl);
        // FIXME: either remove previous or stub it for IE
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
        function split(url) {
            if(url.indexOf('?')>-1){
                return url.split('?');
            }else if(url.indexOf('&')>-1){
                return [
                    url.substring(0, url.indexOf('&')),
                    url.substring(url.indexOf('&') + 1)
                ];
            }
            return [url];
        }
        var
            params = paramsToObject(split(url)[1]),
            hash = split(url)[0].split('#')[1] || '/',
            paths = hash ? hash.split('/') : [],
            map = {};

        paths.forEach(function (path) {
            map[path] = true;
        });

        if(hash.indexOf('/') !== 0){
            // should start with slash
            hash = '/';
        }
        return {
            url: url,
            hash: hash,
            paths: paths,
            map: map,
            params: params
        };
    }

    function getLastPath (url) {
        if(!url) { return ''; }
        var paths = url.split('/');
        return paths[paths.length - 1];
    }

    function removeLastPath (url) {
        if(!url) { return ''; }
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