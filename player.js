/*jshint esversion: 6 */
module.exports =
    class Player {
        constructor(socketID, name, playing, avatarNumber) {
            this.book = [];
            this.book.roundsBehind = 0;
            this.playersBookId = socketID;
            this.name = name;
            this.id = socketID;
            this.playing = playing;
            this.votedNextBook = false;
            this.avatarNumber = avatarNumber;
        }

        resetBook() {
            this.book = [];
            this.book.roundsBehind = 0;
            this.playersBookId = this.id;
        }

        makeBookBehind() {
            this.book.pop();
            this.book.roundsBehind++;
        }
    };