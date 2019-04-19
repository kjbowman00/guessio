/*jshint esversion: 6 */
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
const Room = require('./room.js');
const DEFAULT_OPTIONS = {};
///////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
//Get homepage
app.get('/', function (req, res) {
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
app.get('/testFile.html', function (req, res) {
	res.sendfile('testFile.html');
});
app.get('/displayStuff.html', function (req, res) {
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
   		if (roomName == undefined) {
   			//User not in a room yet
   			//Put him in one
   			roomName = findGame(socket.id);
   			joinRoom(socket, roomName, data, true);
   		} else {
   			rooms.get(roomName).updatePlayer(socket.id, data, true);
   			let info = {};
   			info.id = socket.id;
   			info.name = data;
   			socket.to(Object.keys(socket.rooms)[1]).emit("player_changed_info", info);
   		}
   	});
	socket.on('leave_room', function (data) {
    let roomName = Object.keys(socket.rooms)[1];
    if (roomName != null) {
      leaveRoom(socket);
    }
	});
	socket.on('guess_submit', function (data){
    //Cut the string to be shorter
    //TODO: Figure out the length for this
    data = data.slice(0, 256);
		console.log("player submitted a guess");
    //Log data
    let roomName = Object.keys(socket.rooms)[1];

    if (roomName != null) {
      let room = rooms.get(roomName);
      //Verify a submission i
      room.submitData(socket.id, data);
        //check if round is over
        if (room.isRoundDone()) {
          finishGameTurn(socket, room);
        }
        
    }

  });
	socket.on('drawing_submit', function (data){
		console.log("player submitted a drawing");
    	//Check if room is finished
    	//Log data
      //TODO: Handle not actual drawing data
    	let roomName = Object.keys(socket.rooms)[1];
      if (roomName != null) {
        let room = rooms.get(roomName);
        room.submitData(socket.id, data);

        if (room.isRoundDone()) {
          finishGameTurn(socket, room);
        }
      }
    });
	socket.on("create_room_request", function(data) {
      //check if already in room
      if (Object.keys(socket.rooms)[1] != null) {
        return;
      }

    	//Check if room is already created
    	let roomName = data.roomName;
    	if (rooms.get(roomName) == undefined) {
    		socket.join(roomName, function (err) {
    			rooms.set(roomName, new Room(roomName, false, data.options));
    			socket.emit('host_changed', true);
    			joinRoom(socket, roomName, "Unnamed", false);
    		});
    	} else {
    		socket.emit('failed_room_create', 'Room already exists');
    	}
    });
	socket.on("join_room_request", function(data){
		let roomName = data.roomName.slice(0, 20);
    if (rooms.get(roomName) != null) {
      joinRoom(socket, roomName, "Unnamed", false);
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
		console.log(room.host);
		if (roomName !== undefined && !room.publicGame && room.host == socket.id) {
			//Depends on room options
			room.startGame();
			let options = room.options;
			if (options.timer == 0) {
				//No timer needed
				//Socket emissions will handle round ending
			} else {
				//Start a timer
				//Emit first
				socket.to(roomName).emit('game_start', options);
				socket.emit('game_start', options);
				setTimeout(() => {
					console.log('timer went off');
					finishGameTurn(socket, room);
				}, options.timer * 60000 * 2 + 3500); //Timer in minutes, add 3.5 seconds for ping
			}
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
	socket.join(roomName, function(err){
		let room = rooms.get(roomName);
		socket.emit("join_room_success", {roomName: roomName, players: Array.from(room.playersNames), publicGame:publicGame});
		socket.to(roomName).emit('player_joined_room', {id: socket.id, name:playerName});
		room.addPlayer(socket.id, playerName);
		playerRoomNames.set(socket.id, roomName);
	});
}

function finishGameTurn(socket, room) {
	//Pass books to each person
	console.log('Round finished. Starting next one');
  	//Update any books that receieved no submission with blanks
  	let gameOver = room.endRound();
  	let playersBooks = room.playersBooks();
  	//Send updated book information to players
  	if (gameOver) {
  		// so that they may display it
  		//saveToFile(room.roomName, room.playersBooks());
  		console.log(playersBooks);
      console.log(socket.rooms);
  		io.in(room.roomName).emit('game_end', JSON.stringify(Array.from(playersBooks)));
      console.log(socket.rooms);
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
  			rooms.delete(roomName);
  		}
  	}
  }

function saveToFile(roomName, data) {
	//save book texts to public file
	fs.writeFile(roomName, JSON.stringify(Array.from(data)), function(err, data){
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
