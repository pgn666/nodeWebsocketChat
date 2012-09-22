/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
Function.prototype.method = function(name, fn){
    this.prototype[name] = fn;
    return this;
};

// observer system
window.DED = window.DED || {};
DED.util = DED.util || {};
DED.util.Observer = function(){
    this.fns = [];
}
DED.util.Observer.prototype = {
    
    subscribe: function(fn){
        this.fns.push(fn);
    },
    
    unSubscribe: function(fn){
        this.fns = this.fns.filter(
            function(el){
                if (el !== fn){
                    return el;
                }
            }
        );
    },
    
    fire: function(o){
        this.fns.forEach(
            function(el){
                el(o);
            }
        );
    }
}

//ajax request
DAD.util.asyncRequest = (function(){
    
    function handelRedyState(o, callback){
        var pull = window.setInterval(
            function(){
                if (o && o.readyState == 4){
                    window.clearInterval(pull);
                    if(callback){
                        callback(o);
                    }
                }
            }, 
            50
        );
    };
    
    return function(method, uri, callback, postData){
        var http = new XMLHttpRequest();
        http.uri = uri;
        http.open(method, uri, true);
        handelRedyState(http, callback);
        http.send(postData || null);
        
        return http;
    }
})();