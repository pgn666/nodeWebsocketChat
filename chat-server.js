// http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/
"use strict";

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'node-chat';

// Port where we'll run the websocket server
var webSocketsServerPort = 1337;

// websocket and http servers
var webSocketServer = require('websocket').server;
var http = require('http');
var fs = require('fs');

var chatRooms = [];


// Restrics how meny connections can a one chat room handle
var CHATROOM_CAPACITY = 2;

/**
 * Helper function for escaping input strings
 */
function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function replaceURLWithHTMLLinks(text) {
    var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(exp,"<a href='$1' target='_blank'>$1</a>");
}

// Array with some colors
var colors = [ 'red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange' ];



function ChatRoom(id, colors){
    this.id = id; 
    this.logFile = 'logs/msglog_' + id + '.log';
    
    this.colors = colors;
    // latest 100 messages
    this.history = [ ];
    // list of currently connected clients (users)
    this.clients = [ ];
    // list of nick names currently connected clients (users)
    this.usersList = [ ];
    
    // history readed from file
    try {
        this.historyArray = fs.readFileSync(this.logFile).toString().split("\n");
    } catch(err){
        this.historyArray = [];
        console.log(err.data);
    }
                        
    this.readHisory = function(){
        for (var i=0; i < this.historyArray.length; i++) {
            try{
                var msg = JSON.parse(this.historyArray[i]);
                this.history.push(msg);
            } catch(e){
                console.log('index: '+ i);
                console.log('value: '+ this.historyArray[i]);
                console.log('error msg: '+ e.message);
            }
        }
    }
    
    this.brotcastMsg = function(type, data){
        var json = JSON.stringify({
                        type: type,
                        data: data
                    });
        for (var i=0; i < this.clients.length; i++) {
            this.clients[i].sendUTF(json);
        }
        if ('message' === type) {
            fs.appendFile(this.logFile, JSON.stringify(data)+'\n');
        }
    }
}

/**
 * HTTP server
 */
var server = http.createServer(function(request, response) {
    // Not important for us. We're writing WebSocket server, not HTTP server
    });
server.listen(webSocketsServerPort, function() {
    console.log((new Date()) + " Server is listening on port " + webSocketsServerPort);
});

/**
 * WebSocket server
 */
var wsServer = new webSocketServer({
        // WebSocket server is tied to a HTTP server. To be honest I don't understand why.
        httpServer: server
    });
    
// This callback function is called every time someone
// tries to connect to the WebSocket server
wsServer.on('request', function(request) {
    console.log((new Date()) + ' Connection from origin ' + request.origin + '.');

    // accept connection - you should check 'request.origin' to make sure that
    // client is connecting from your website
    // (http://en.wikipedia.org/wiki/Same_origin_policy)
    var chatRoom, userIndex, userName = false, userColor = false, connection = request.accept(null, request.origin); 
    
    //
    // Loop through chat rooms list to find not full one
    chatRooms.forEach(function(el){
        
        console.log('in this chat room there are ' + el.clients.length + ' clients');
        
        if(CHATROOM_CAPACITY > el.clients.length){
            console.log('welcam in chat room with: ' + el.clients.length + ' clents');
            chatRoom = el;
            return;
        }
    });
    
    if(!chatRoom){
        console.log('creating new chat room');
        chatRoom = new ChatRoom(chatRooms.length, colors.slice())
        chatRooms.push(chatRoom);
    }
    
    // we need to know client index to remove them on 'close' event
    userIndex = chatRoom.clients.push(connection) - 1;

    console.log((new Date()) + ' Connection accepted.');
    
    // send back chat id
    connection.sendUTF(JSON.stringify( {
        type: 'chatId', 
        data: chatRoom.id
    } ));

    // send back chat history
    chatRoom.readHisory();
    if (chatRoom.history.length > 0) {
        connection.sendUTF(JSON.stringify( {
            type: 'history', 
            data: chatRoom.history
        } ));
    };
    chatRoom.brotcastMsg('userlist',chatRoom.usersList);

    // user sent some message
    connection.on('message', function(message) {
        if (message.type === 'utf8') { // accept only text
            if (userName === false) { // first message sent by user is their name
                try { //json for reconnecting
                    var json = JSON.parse(message.utf8Data);

                    userName = json.login;
                    userColor = json.color;
                    chatRoom.colors.splice(chatRoom.colors.indexOf(userColor),1);

                } catch (e) {// new user - normal text
                    /// remember user name
                    userName = replaceURLWithHTMLLinks(htmlEntities(message.utf8Data));
                    // get free color and send it back to the user
                    userColor = chatRoom.colors.shift();                  
                }
                connection.sendUTF(JSON.stringify({
                    type:'color', 
                    data: userColor
                }));
                console.log((new Date()) + ' User is known as: ' + userName  + ' with ' + userColor + ' color.');
                
                //update users list
                chatRoom.usersList[userIndex] = {name: userName, color: userColor, time: (new Date())};
                
                //send current users list
                chatRoom.brotcastMsg('userlist', chatRoom.usersList);

            } else { // log and broadcast the message
                console.log((new Date()) + ' Received Message from '
                    + userName + ': ' + message.utf8Data);

                // we want to keep history of all sent messages
                var obj = {
                    time: (new Date()).getTime(),
                    text: replaceURLWithHTMLLinks(htmlEntities(message.utf8Data)),
                    author: userName,
                    color: userColor
                };
                chatRoom.history.push(obj);
                chatRoom.history = chatRoom.history.slice(-100);

                chatRoom.brotcastMsg('message', obj);
            }
        }
    });

    // user disconnected
    connection.on('close', function(connection) {
        if (userName !== false && userColor !== false) {
            console.log((new Date()) + " Peer "
                + connection.remoteAddress + " disconnected.");
            // remove user from the list of connected clients
            chatRoom.clients.splice(userIndex, 1);
            //remove user from users list
            chatRoom.usersList.splice(userIndex, 1);
            // push back user's color to be reused by another user
            chatRoom.colors.push(userColor);
            
            // send msg that user has left
            var obj = {
                    time: (new Date()).getTime(),
                    text: 'User <span style="color: '+userColor+'"><b>' + userName + '</b></span> disconnected',
                    author: 'CHAT',
                    color: 'red'
                };
            chatRoom.brotcastMsg('message', obj);
            
            //send current users list            
            chatRoom.brotcastMsg('userlist', chatRoom.usersList);
        }
    });

});

