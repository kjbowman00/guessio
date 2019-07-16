/*jshint esversion: 6 */
module.exports =
    class Player {
        constructor(socketID, name, playing, avatarNumber) {
            this.book = [];
            this.playersBookId = socketID;
            this.name = name;
            this.id = socketID;
            this.playing = playing;
            this.votedNextBook = false;
            this.avatarNumber = avatarNumber;
        }

        resetBook() {
            this.book = [];
            this.playersBookId = this.id;
        }
    };