/*jshint esversion: 6 */
const Player = require('./player.js');
class Room {
	constructor(roomName, publicGame, options) {
		this._roomName = roomName;
		this._publicGame = publicGame;
		this._options = options;
		this._round = 0;
		this._timer = null;
		this._publicMatchTimer = null;
		this._gameOver = false;
		this._numVotedPlayers = 0;

		this._players = new Map();
	}

	_startPublicMatchTimer(app, io) {
		console.log("YESSSS");
		io.in(this._roomName).emit("public_match_timer_start");
		this._publicMatchTimer = setTimeout(() => {
			this.startGame(app);
			io.in(this._roomName).emit("game_start", this._options);
		}, 15000);
	}

	_clearPublicRoundTimer() {
		clearTimeout(this._publicMatchTimer);
	}

	clearRoundTimer() {
		clearTimeout(this._timer);
	}

	/**
	 * starts the timer for the round
	 * Do 
	 */
	_startRoundTimer(app) {
		this._timer = setTimeout(() => {
			app.finishGameTurn(this);
		}, this._options.timer * 60000 + 3500);
	}

	//TODO: implement addData() method
	_addData(socketID, data) {
		this._players.get(socketID).book.push(data);
	}

	_updateData(socketID, data) {
		let book = this._players.get(socketID).book;
		book[book.length - 1] = data;
	}

	/**
	 * Submits data for a given player to the room
	 * Handles if the player has already submit and just overwrites
	 */
	submitData(socketID, data) {
		//Handle game not started
		if (this._round == 0) {
			return;
		}
		//Gets who submitted it
		let playerSubmitted = this._players.get(socketID);
		//gets the player book to put data on
		let id = playerSubmitted.playersBookId;
		if (this._hasSubmitted(socketID)) {
			this._updateData(id, [playerSubmitted.name, data]);
		} else {
			this._addData(id, [playerSubmitted.name, data]);
		}
		
	}

	endRound(app) {
		this.clearRoundTimer();
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
			this._gameOver = true;
			return true;
			//this.resetRoom();
			//this.startGame();
		} else {
			this._startRoundTimer(app);
			return false;
		}
	}

	isRoundDone() {
		let value = true;
		this._players.forEach((player, socketID, map) => {
			console.log('isROOMDONE');
			if (player.playing && player.book.length < this._round + 1) value = false;
		});
		return value;
	}

	startGame(app) {
		this._round = 1;
		this._players.forEach((player, socketID, map) => {
			player.votedNextBook = false;
			player.playing = true;
		});
		this._options.timer *= 2;
		this._startRoundTimer(app);
		this._options.timer /= 2;
		this._gameOver = false;
		this._numVotedPlayers = 0;
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
			nameMap.set(socketID, {playerName:player.name, avatarNumber: player.avatarNumber});
		});
		return nameMap;
	}

	get host() {
		return this._host;
	}

	updatePlayer(socketID, name, clickedPlay, avatarNumber) {
		this._players.get(socketID).name = name;
		this._players.get(socketID).avatarNumber = avatarNumber;
	}

	addPlayer(socketID, name, avatarNumber, app, io) {
		this._players.set(socketID, new Player(socketID, name, this._round == 0, avatarNumber));
		if (this._players.size == 1) {
			this._host = socketID;
		}
		if (this._publicGame && this.playerCount >= 4 && this._round == 0) {
			this._startPublicMatchTimer(app, io);
		}
	}

	removePlayer(socketID) {
		if (this._players.get(socketID).votedNextBook) {
			this._numVotedPlayers--;
		}
		this._players.delete(socketID);
		if (this._publicGame) {
			if (this.playerCount < 4) {
				this._clearPublicRoundTimer();
			}
		} else {

		}
		//TODO: Pick a new host
	}

	setHost(socketID) {
		this._host = socketID;
	}

	resetRoom() {
		this._round = 0;
		this.clearRoundTimer();
		//Guesses and drawings should be emptied
		this._players.forEach(function(player, socketID, map) {
			player.resetBook();
		});
		this.resetVotes();
	}

	_hasSubmitted(socketID) {
		let id = this._players.get(socketID).playersBookId;
		let book = this._players.get(id).book;
		if (this._round == 1) {
			return book.length == 2;
		} else return book.length == this._round + 1;
	}

	get gameOver() {
		return this._gameOver;
	}

	setPlayerVoted(socketID) {
		let player = this._players.get(socketID);
		if (!player.votedNextBook) {
			player.votedNextBook = true;
			this._numVotedPlayers += 1;
		}
	}

	isVotingDone() {
		console.log(this._numVotedPlayers);
		console.log(this._players.size);
		return this._numVotedPlayers >= this._players.size;
	}

	resetVotes() {
		this._numVotedPlayers = 0;
		this._players.forEach(function(player, socketID, map) {
			player.votedNextBook = false;
		});
	}
}

module.exports = Room;