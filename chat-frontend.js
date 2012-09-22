(function () {
    "use strict";

    // for better performance - to avoid searching in DOM
    var content = $('#content');
    var input = $('#input');
    var status = $('#status');
    var chatId = $('#chatId span');
    var chatList = $('#chatList div');

    // my color assigned by the server
    var myColor = false;
    // my name sent to the server
    var myName = false;
    
    // connection monitors
    var connection, offlineMonitorID, onlineMonitorID;

    function connect(){
        
        // open connection
        var connection = new WebSocket('ws://192.168.1.3:1337');
        
        input.val('Connecting...');

        connection.onopen = function () {
            
            if (myName && myColor){ // reconnectig user
                input.val('Reconnected!');
                connection.send(JSON.stringify({login: myName, color: myColor}));
            } else { // first we want users to enter their names
                input.removeAttr('disabled');
                input.val('').focus();
                status.text('Choose name:');
            }
            clearInterval(onlineMonitorID);
            offlineMonitorID = setInterval(offlineMonitor, 5000);
        };

        connection.onerror = function (error) {
            // just in there were some problems with conenction...
            content.html($('<p>', {text: 'Sorry, but there\'s some problem with your '
                                        + 'connection or the server is down.'} ));
        };

        // most important part - incoming messages
        connection.onmessage = function (message) {
            // try to parse JSON message. Because we know that the server always returns
            // JSON this should work without any problem but we should make sure that
            // the massage is not chunked or otherwise damaged.
            try {
                var json = JSON.parse(message.data);
            } catch (e) {
                console.log('This doesn\'t look like a valid JSON: ', message.data);
                return;
            }

            // NOTE: if you're not sure about the JSON structure
            // check the server source code above
            if (json.type === 'color') { // first response from the server with user's color
                myColor = json.data;
                status.text(myName + ': ').css('color', myColor);
                input.val('').removeAttr('disabled').focus();
                // from now user can start sending messages
            } else if (!myName && json.type === 'history') { // entire message history
                // insert every single message to the chat window
                for (var i=0; i < json.data.length; i++) {
                    addMessage(json.data[i].author, json.data[i].text,
                            json.data[i].color, new Date(json.data[i].time));
                }
            } else if(json.type === 'chatId') {
                chatId.html(json.data);
            } else if (json.type === 'message') { // it's a single message
                input.removeAttr('disabled'); // let the user write another message
                addMessage(json.data.author, json.data.text,
                        json.data.color, new Date(json.data.time));
            } else if (json.type === 'userlist' && typeof json.data === 'object') {
                updateUsersList(json.data);
            } else {
                console.log('Hmm..., I\'ve never seen JSON like this: ', json);
            }
            
        };
        
        return connection;
    }
    
    /**
     * Send mesage when user presses Enter key
     */
    input.keydown(function(e) {
        if (e.keyCode === 13) {
            var msg = $(this).val();
            if (!msg) {
                return;
            }
            // send the message as an ordinary text
            connection.send(msg);
            $(this).val('');
            // disable the input field to make the user wait until server
            // sends back response
            input.attr('disabled', 'disabled');

            // we know that the first message sent from a user is their name
            if (false === myName) {
                myName = msg;
            }
        }
    });
    
     /**
     * Add message to the chat window
     */
    function addMessage(author, message, color, dt) {
        content.append('<p><span style="color:' + color + '">' + author + '</span> @ ' +
             + (dt.getHours() < 10 ? '0' + dt.getHours() : dt.getHours()) + ':'
             + (dt.getMinutes() < 10 ? '0' + dt.getMinutes() : dt.getMinutes())
             + ': ' + message + '</p>');
         //scroll to bottom;
         scroolToBottom(content);
    }
    
    function parseDate(dt){
        
        return (dt.getHours() < 10 ? '0' + dt.getHours() : dt.getHours()) + ':'
            + (dt.getMinutes() < 10 ? '0' + dt.getMinutes() : dt.getMinutes());
    }
    
    function updateUsersList(userlist){
        var html = '', i=0;
        for (i; i < userlist.length; i++) {
            if (userlist[i]){
                html += '<p style="color: ' + userlist[i].color +' ">' + userlist[i].name + ' @ ' + parseDate(new Date(userlist[i].time)) + '</p>';
            }
        }
        chatList.html(html);        
    }

    /**
     * This method is optional. If the server wasn't able to respond to the
     * in 3 seconds then show some error message to notify the user that
     * something is wrong
     */

    function offlineMonitor(){
        console.log('offlineMonitor');
        if (connection && connection.readyState !== 1) {
            status.text('Error');
            input.attr('disabled', 'disabled').val('! Unable to comminucate '
                + 'with the WebSocket server..');
            connection = undefined;
            clearInterval(offlineMonitorID);
            onlineMonitorID = setInterval(onlineMonitor,5000);
        }
        
    };

    function onlineMonitor(){
        console.log('onlineMonitor');
        if (!connection){
            connection = connect();
        } else {
            input.attr('disabled', 'disabled').val('! Unable to comminucate '
                + 'with the WebSocket server..');
            connection = undefined;
        }
        
    };
    
    $('a').live('click', function(e) {
        var href = e.target.href;
        if (href.indexOf('youtube')>-1){
            e.preventDefault();
            var youtubeCcode = href.match(/v=([^&]*)/i);
            console.log(youtubeCcode);
            $('#youtube').html('<object width="600" height="400" data="http://www.youtube.com/v/' + youtubeCcode[1] + '" type="application/x-shockwave-flash"><param name="src" value="http://www.youtube.com/v/' + youtubeCcode[1] + '" /></object>');
        }        
    });
    
    function scroolToBottom(div){
        //div.scrollTop = div.scrollHeight;
        console.log(div.prop('scrollHeight'));
        div.scrollTop(div.prop('scrollHeight'));
    }
    
    window.onbeforeunload = function (evt) {
        if (myName && connection.readyState == 1) { // prevent if user is logged in
            /*
                * On IE, the text must be set in evt.returnValue.
                *
                * On Firefox, it must be returned as a string.
                *
                * On Chrome, it must be returned as a string, but you
                * can't set it on evt.returnValue (it just ignores it).
                */
            var msg = myName + ", If you reload or close you will automatically leave chat.";
            evt = evt || window.event;

            evt.returnValue = msg;
            return msg;
        }
    }
    
    // if user is running mozilla then use it's built-in WebSocket
    window.WebSocket = window.WebSocket || window.MozWebSocket;

    // if browser doesn't support WebSocket, just show some notification and exit
    if (!window.WebSocket) {
        content.html($('<p>', {text: 'Sorry, but your browser doesn\'t '
                                    + 'support WebSockets.'} ));
        input.hide();
        $('span').hide();
        return;
    }
    
    connection = connect();
    offlineMonitorID = setInterval(offlineMonitor, 5000);

})();