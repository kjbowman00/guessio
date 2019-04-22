/*jshint esversion: 6 */
module.exports =
    class Player {
        constructor(socketID, name, playing) {
            this.book = [];
            this.playersBookId = socketID;
            this.name = name;
            this.id = socketID;
            this.playing = playing;
        }

        resetBook() {
            this.book = [];
            this.playersBookId = this.id;
        }
    };