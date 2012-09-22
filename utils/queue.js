/* 
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

DED.Queue = function() {
   
   // elements of the queue
   this.queue = [];
   
   // ?
   this.onComplete = new DED.util.Observer();
   this.onFailure = new DED.util.Observer();
   this.onFlush = new DED.util.Observer();
   this.onRetry = new DED.util.Observer();
   
   //base of the queueing system
   this.retryCount = 3;
   this.currentRetry = 0;
   this.paused = false;
   this.timeout = 5000;
   this.conn = {};
   this.timer = {};
};

//DED.Queue.method('flush2', function(){
//    console.log(this);
//});

DED.Queue.method('flush', function(){
    
    var that = this;
    var abort = function(){
        that.conn.abort();
        if (that.currentRetry === that.retryCount){
            that.onFailure.fire(that);
            that.queue.shift();
            that.currentRetry = 0;
        } else {
            that.onRetry.fire(that)
        }
        that.flush();
    };

    if(!this.queue.length > 0){
        
        return;
    }
    
    if (this.paused){
        this.paused = false;
        
        return;
    }
    
    this.currentRetry++;
    this.timer = window.setTimeout(abort, this.timeout);
    
    var callback = function(o){
        window.clearTimeout(that.timer);
        that.currentRetry = 0;
        that.dequeue();
        that.onFlush.fire(that);
        if (that.queue.length === 0){
            that.onComplete.fire(that);
            return;
        }
        // recursive cal
        that.flush();
    };
    this.conn = new DAD.util.asyncRequest(
        this.queue[0]['method'],
        this.queue[0]['uri'],
        callback,
        this.queue[0]['params']
    );
}).
    method('setRetryCount', function(count){
    this.retryCount = parseInt(count);
}).
    method('setTomeout', function(time){
    this.timeout = parseInt(time);
}).
    method('add', function(o){
    this.queue.push(o);
}).
    method('pause', function(){
    this.paused = true;
}).
    method('dequeue', function(){
    this.queue.pop();
}).
    method('dequeue', function(){
    this.queue.shift();
}).
    method('clear', function(){
    this.queue = [];
});

