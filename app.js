/*jshint esversion: 6 */
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
const Room = require('./room.js');
const DEFAULT_OPTIONS = {};
//Gets around issue of this being overridden in callback functions
var _this = this;

///////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
//Get homepage
app.get('/', function(req, res) {
    res.sendfile('index.html');
});
//Get game resources
app.use(express.static('public'));
//Manage direct connect to rooms
app.get('/r/*', function(req, res) {
    //Send them index but replace some code
    //To io send them automatically to room
    //UNLESS ip is banned from room
    res.sendfile('resources/destroyed.jpg');
});
app.get('/testFile.html', function(req, res) {
    res.sendfile('testFile.html');
});
app.get('/displayStuff.html', function(req, res) {
    res.sendfile('displayStuff.html');
});
/////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
//Gross workaround for users leaving rooms BEFORE disconnect event is fired
var playerRoomNames = new Map();
var rooms = new Map();
io.on('connection', function(socket) {
    socket.on('play_game', function(data) {
        //Assign user to lowest non-full room
        data = data.slice(0, 25);
        let roomName = Object.keys(socket.rooms)[1];
        if (roomName == undefined && data.trim() != "") {
            //User not in a room yet
            //Put him in one
            roomName = findGame(socket.id);
            joinRoom(socket, roomName, data, true);
        } else {
            console.log("WARN: Player already in a room or no name entered.");
        }
    });
    socket.on('leave_room', function(data) {
        let roomName = Object.keys(socket.rooms)[1];
        if (roomName != null) {
            leaveRoom(socket);
        }
    });
    socket.on('guess_submit', function(data) {
        //Cut the string to be shorter
        //TODO: Figure out the length for this
        data = data.slice(0, 180);
        console.log("player submitted a guess");
        //Log data
        let roomName = Object.keys(socket.rooms)[1];

        if (roomName != null) {
            let room = rooms.get(roomName);
            //Verify a submission i
            room.submitData(socket.id, data);
            //check if round is over
            if (room.isRoundDone()) {
                finishGameTurn(room);
            }

        }

    });
    socket.on('drawing_submit', function(data) {
        console.log("player submitted a drawing");
        //Check if room is finished
        //Log data
        //TODO: Handle not actual drawing data
        let roomName = Object.keys(socket.rooms)[1];
        if (roomName != null) {
            let room = rooms.get(roomName);
            room.submitData(socket.id, data);

            if (room.isRoundDone()) {
                finishGameTurn(room);
            }
        }
    });
    socket.on("create_room_request", function(data) {
        //check if already in room
        if (Object.keys(socket.rooms)[1] != null) {
            socket.emit('failed_room_create', 'Already in a room');
            return;
        }
        //check for valid name
        if (data.playerName == null || data.playerName.trim() == "") {
            socket.emit('failed_room_create', 'Player name invalid');
            return;
        }
        if (data.roomName == null || data.roomName.trim() == "") {
            socket.emit('failed_room_create', 'Room name invalid');
            return;
        }
        //TODO: Check for valid options


        //Check if room is already created
        let roomName = data.roomName;
        if (rooms.get(roomName) == undefined) {
            socket.join(roomName, function(err) {
                rooms.set(roomName, new Room(roomName, false, data.options));
                socket.emit('host_changed', true);
                joinRoom(socket, roomName, data.playerName, false);
            });
        } else {
            socket.emit('failed_room_create', 'Room already exists');
        }
    });
    socket.on("join_room_request", function(data) {
        //check if already in room
        if (Object.keys(socket.rooms)[1] != null) {
            socket.emit('join', 'Already in room');
            return;
        }
        if (data.playerName == null || data.playerName.slice(0, 20).trim() == "") {
            socket.emit('failed_room_join', 'Player name invalid');
            return;
        }

        let roomName = data.roomName.slice(0, 20);
        if (rooms.get(roomName) != null) {
            joinRoom(socket, roomName, data.playerName, false);
        } else {
            socket.emit("failed_room_join", "Room doesn't exist");
        }

    });
    socket.on("disconnect", function() {
        leaveRoom(socket);
    });
    socket.on('start_game', function(data) {
        //Check if actually in lobby,
        //lobby is private, and actually hosting
        //start game
        console.log(socket.rooms);
        let roomName = Object.keys(socket.rooms)[1];
        let room = rooms.get(roomName);
        console.log("Game starting:" + roomName);
        if (roomName !== undefined && !room.publicGame && room.host == socket.id) {
            //Depends on room options
            room.startGame(_this);
            let options = room.options;
            socket.to(roomName).emit('game_start', options);
            socket.emit('game_start', options);
        }
    });
    socket.on('next_book_ready', function() {
        //check if in private room or not
        console.log('hey');
        let roomName = Object.keys(socket.rooms)[1];
        let room = rooms.get(roomName);
        if (roomName !== undefined && !room.publicGame && room.gameOver) {
            room.setPlayerVoted(socket.id);
            console.log("bigger hey");
            if (room.isVotingDone()) {
                io.in(roomName).emit('vote_book_finished');
                room.resetVotes();
            }
        }
    });
    socket.on('chat_message', function(message) {
        let roomName = Object.keys(socket.rooms)[1];
        if (roomName !== undefined) {
            let data = {
                socketID: socket.id,
                message: message
            };
            socket.to(roomName).emit('chat_message', data);
        }
    });
});
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

http.listen(3000, function() {
    console.log('listening on localhost:3000');
});

//Finds the room # to join
function findGame(socketID) {
    let possibleRooms = rooms.values();
    for (let element of possibleRooms) {
        if (element.publicGame && element.playerCount < 9) {
            return element.roomName;
        }
    }
    //No public room found, make a new one
    //The one is necessary because they're already in a room of their socketID
    let room = new Room(socketID + "1", true, DEFAULT_OPTIONS);
    rooms.set(socketID + "1", room);
    return socketID + "1";
}

function joinRoom(socket, roomName, playerName, publicGame) {
    socket.join(roomName, function(err) {
        let room = rooms.get(roomName);
        socket.emit("join_room_success", { roomName: roomName, players: Array.from(room.playersNames), publicGame: publicGame });
        socket.to(roomName).emit('player_joined_room', { id: socket.id, name: playerName });
        room.addPlayer(socket.id, playerName);
        playerRoomNames.set(socket.id, roomName);
    });
}

//TODO: This should probably be refactored into the room.js
function finishGameTurn(room) {
    //Pass books to each person
    console.log('Round finished. Starting next one');
    //Update any books that receieved no submission with blanks
    let gameOver = room.endRound(_this);
    let playersBooks = room.playersBooks();
    //Send updated book information to players
    if (gameOver) {
        // so that they may display it
        //saveToFile(room.roomName, room.playersBooks());
        io.in(room.roomName).emit('game_end', JSON.stringify(Array.from(playersBooks)));
        //reset room
        room.resetRoom();
        //if public lobby set a timer to reset game
        //if private lobby just wait for the host to start again
        if (room.publicGame) {
            //TODO: timer
        }
    } else {
        let playersArray = room.playersPlaying();
        playersArray.forEach((player) => {
            let book = room.playerData(player.playersBookId);
            io.to(player.id).emit("book_info", book[book.length - 1]);
        });
    }
}

function leaveRoom(socket) {
    let roomName = playerRoomNames.get(socket.id);
    if (roomName !== undefined) {
        let room = rooms.get(roomName);
        socket.to(roomName).emit("player_left_room", socket.id);
        room.removePlayer(socket.id);
        playerRoomNames.delete(socket.id);
        socket.leave(roomName);
        if (room.playerCount == 0) {
            room.clearRoundTimer();
            rooms.delete(roomName);
        }
    }
}

function saveToFile(roomName, data) {
    //save book texts to public file
    fs.writeFile(roomName, JSON.stringify(Array.from(data)), function(err, data) {
        if (err) console.log(err);
        console.log("Successfully Written to File.");
    });
    //Allow client to parse these into an image

    //Once we finish, emit an event to allow them to look


    //Notes for client parser:
    //Should stitch together the guesses and images
    //Should show who drew/guessed each thing
    //Horizontally stitch each book together
    //Account for people leaving could be one less submission
    //open in a new tab
}