/*jshint esversion: 6 */
const Player = require('./player.js');
class Room {
	constructor(roomName, publicGame, options) {
		this._roomName = roomName;
		this._publicGame = publicGame;
		this._options = options;
		this._round = 0;

		this._players = new Map();
	}

	//TODO: implement addData() method
	_addData(socketID, data) {
		this._players.get(socketID).book.push(data);
	}

	_updateData(socketID, data) {
		let book = this._players.get(socketID).book;
		book[book.length - 1] = data;
	}

	submitData(socketID, data) {
		//TODO: make this actually an object added
		//this way we can keep track of who drew what
		let playerSubmitted = this._players.get(socketID);
		let id = playerSubmitted.playersBookId;
		if (hasSubmitted(socketID)) {
			this._updateData(id, [playerSubmitted.name, data])
		} else {
			this._addData(id, [playerSubmitted.name, data]);
		}
		
	}

	endRound() {
		let playersPlaying = this.playersPlaying();
		let numPlayers = playersPlaying.length;
		//i represents player position in the map
		let i = 0;
		this._players.forEach((player, socketID, map) => {
			let book = player.book;
			if (player.playing) {			
				if (this._round == 1) {
					if (book.length == 0) {
						book[0] = "NS";
						book[1] = "NS";
					} else if (book.length == 1) {
						book[1] = "NS";
					}
				} else if (book.length < this._round + 1) {
					book[this._round] = "NS";
				}
			}

			//Handles players book holdings
			let index = i + 1 - (this._round + 1);
  			if (index < 0) index = numPlayers + index;
  			player.playersBookId = playersPlaying[index].id;
  			i++;
		});
			
		this._round++;
		if (this._round > numPlayers) {
			//TODO: save books
			//possibly let app.js handle starting the game
			console.log("GAME OVER");
			return true;
			//this.resetRoom();
			//this.startGame();
		} else return false;
	}

	isRoundDone() {
		let value = true;
		this._players.forEach((player, socketID, map) => {
			console.log('isROOMDONE');
			if (player.playing && player.book.length < this._round + 1) value = false;
		});
		return value;
	}

	startGame() {
		this._round = 1;
		this._players.forEach((player, socketID, map) => {
			player.playing = true;
		});
	}

	playersPlaying() {
		let playersPlaying = [];
		this._players.forEach((player, socketID, map) => {
			if (player.playing) playersPlaying.push(player);
		});
		return playersPlaying;
	}

	playersBooks() {
		let bookMap = new Map();
		this._players.forEach((player, socketID, map) => {
			if (player.playing) bookMap.set(socketID, player.book);
		});
		return bookMap;
	}

	playerData(socketID) {
		return this._players.get(socketID).book;
	}

	get options() {
		return this._options;
	}

	get roomName() {
		return this._roomName;
	}

	get round() {
		return this._round;
	}

	get publicGame() {
		return this._publicGame;
	}

	data(socketID) {
		return this._players.get(socketID).book;
	}

	book(socketID) {
		return this._players.get(socketID).book;
	}

	get playerCount() {
		return this._players.size;
	}

	get playersNames() {
		let nameMap = new Map();
		this._players.forEach((player, socketID, map) => {
			nameMap.set(socketID, player.name);
		});
		return nameMap;
	}

	get host() {
		return this._host;
	}

	updatePlayer(socketID, name, clickedPlay) {
		this._players.get(socketID).name = name;
	}

	addPlayer(socketID, name) {
		this._players.set(socketID, new Player(socketID, name, this._round == 0));
		if (this._players.size == 1) {
			this._host = socketID;
		}
	}

	removePlayer(socketID) {
		this._players.delete(socketID);
		//TODO: Pick a new host
	}

	setHost(socketID) {
		this._host = socketID;
	}

	resetRoom() {
		this._round = 0;
		//Guesses and drawings should be emptied
		this._players.forEach(function(player, socketID, map) {
			player.resetBook();
		});
		//Set round to 0
	}
	hasSubmitted(socketID) {
		//TODO: Implement this
		return false;
	}
	_resubmit(socketID, data) {
		let playerSubmitted = this._players.get(socketID);
		let id = playerSubmitted.playersBookId;
		this._addData(id, [playerSubmitted.name, data]);
	}
}

module.exports = Room;