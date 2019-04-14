/*jshint esversion: 6 */
var socket = io();
var wasGuessRound = true;
var firstRound = true;
var lc;
var players = new Map();
var isHosting = false;
var roomOptions = {};
var roomName;
var finishGameData;
var finishGameDataArray;
var timer;
var testingVariable;
socket.on('join_room_success', function(data) {
   //Check if in a room already
   //Manages for people who direct connect
   //Hide/Delete menu
   //Show game_screen
   roomName = data.roomName;
   document.getElementById('join-room-button').style.display = 'none';
   document.getElementById('join-room-form').style.display = 'none';
   document.getElementById('create-room-button').style.display = 'none';
   document.getElementById('create-room-form').style.display = 'none';
   document.getElementById('leave-room-button').style.display = 'block';

   document.getElementById('lobby-player-list').style.display = 'inline-flex';

   //TODO: Manage people that clicked play already
   if (firstRound) {
      //TODO: Move shit from playGame() to here and also add wait for room screen
      //Display play screen
      document.getElementById('lobby-wait-screen').style.display ='block';
      //hide wait for room screen
   }

   if (data.publicGame) {
      document.getElementById('lobby-text').innerHTML = "You are in a public lobby";
   } else {
      document.getElementById('lobby-text').innerHTML = "You're in room: " + data.roomName;
   }
   if (!isEmpty(data.players)) {
      let playerNameMap = new Map(data.players);
      playerNameMap.forEach(function(name, id, map) {
         playerJoined(id, name, data.avatar, false);
      });
   }
});
socket.on('host_changed', function (data) {
   isHosting = data;
   if (isHosting) {
      document.getElementById('lobby-wait-screen').children[0].style.display = "block";
   } else {
      document.getElementById('lobby-wait-screen').children[0].style.display = "none";
   }
});
socket.on('player_joined_room', function (data) {
   playerJoined(data.id ,data.name, "avatar.txt", true);
});
socket.on('player_left_room', function(data) {
   playerLeft(data);
});
socket.on('player_changed_info', function(data) {
   players.get(data.id).children[0].children[0].innerHTML = data.name;
   //TODO: change avatar
});
socket.on('game_start', function(data) {
   //start first round 
   roomOptions = data;
   firstRound = true;
   wasGuestRound = true;
   setupGuess(null);
});
socket.on('book_info', function (data) {
   //Start next round with the new book info
   console.log("heyo");
   testingVariable = data;
   if (wasGuessRound) {
      setupCanvas(data);
   } else {
      setupGuess(data);
   }
});
socket.on('game_end', function (data) {
   //Data should be the entire player books list
   clearInterval(timer);
   finishGameData = new Map(JSON.parse(data));
   finishGameDataArray = Array.from(finishGameData);
   //Hide canvas and guess thing
   document.getElementsByClassName('fs-container')[0].style.display = 'none';
   document.getElementById('wait-container').style.display = 'none';
   document.getElementById('lobby-wait-screen').style.display = 'none';
   document.getElementById('guess_form').style.display = 'none';
   //Do something to allow players to view books

   //Allow players to restart the game

   //Allow downloading of the books as a jpeg

   //For temporary testing just show game over
   let canvas = document.getElementById("game-over-canvas");
   canvas.height = getHeightForRound(finishGameDataArray.length +2) - 1;
   canvas.width = 500;
   document.getElementById('game-over-screen').style.display = 'block';
   bookTimer(0);
   //Download previous game button available
   document.getElementById('game-image-download').style.display = 'block';
});

function playGame() {
   //TODO: display "joining room" if aresn't in a private match
   //TODO: some of this needs to be moved to join_room_success
   //TODO: Manage joining late
   //TODO:Display lobby waiting screen rather than starting immediately

   //TODO: Change this to a wait screen if they ahven't joined a room yet
   document.getElementById('menu').style.display = "none";
   document.getElementById('game_screen').style.display = "block";

   let name = document.getElementById('name_form_text').value;
   if (name == "") {
      alert("you gotta enter a name dog");
   } else {
      //TODO: Display joining game message
      socket.emit('play_game', name);
      //Display guess box
      //Ask them to pick a phrase to draw
      firstRound = true;
      wasGuessRound = true;
   }
   //prevent page redirect
   return false;
}

function createRoom() {
   //Send in form information
   let form = document.getElementById('create-room-form');
   let formInfo = {};
   let options = {};
   options.timer = 5;
   formInfo.options = options;
   formInfo.roomName = form.elements['room-name'].value;

   socket.emit('create_room_request', formInfo);
   //TODO: Display sending information or something like that

   return false;
}

function joinRoom() {
   console.log("joining room");
   let form = document.getElementById('join-room-form');
   let formInfo = {};
   formInfo.roomName = form.elements['room-name'].value;
   console.log(formInfo);
   socket.emit('join_room_request', formInfo);
   //TODO: Display joining room

   return false;
}

function setupGuess(data) {
   wasGuessRound = true;
   document.getElementsByClassName("fs-container")[0].style.display='none';
   document.getElementById('wait-container').style.display='none';
   document.getElementById('lobby-wait-screen').style.display='none';
   let guessForm = document.getElementById('guess_form');
   guessForm.style.display='block';

   let guessImage = document.getElementById('guess-image');
   if (firstRound) {
      guessImage.style.display='none';
      guessForm.children[0].innerHTML = "Pick a word/phrase to draw!";
   } else {
      //data[0] is the player name who drew the thing
      let imageData = data[1];
      guessImage.style.display='block';
      guessImage.src = imageData;
      guessForm.children[0].innerHTML = "Guess what the other user drew!";
   }
   myTimer('guess-timer', roomOptions.timer);
}

function setupCanvas(data) {
   let drawing = data[1];
   console.log(data);
   //data[0] is who drew it
   wasGuessRound = false;
   let fsContainer = document.getElementsByClassName("fs-container")[0];
   fsContainer.style.display='block';
   document.getElementById('guess_form').style.display='none';
   document.getElementById('wait-container').style.display='none';
   document.getElementById('lobby-wait-screen').style.display='none';
   document.getElementById('what-to-draw-words').innerHTML = "You're drawing: " + drawing;


   lc = LC.init(
      document.getElementById("lc"),
      {imageURLPrefix: '/images/drawing-board',
      tools: [LC.tools.Pencil, LC.tools.Eraser, LC.tools.Eyedropper]
   }
   );

   var tools = [
   {
      name: 'pencil',
      el: document.getElementById('tool-pencil'),
      tool: new LC.tools.Pencil(lc)
   },
   {
      name: 'eraser',
      el: document.getElementById('tool-eraser'),
      tool: new LC.tools.Eraser(lc)
   }
   ];

   tools.forEach(function(t) {
      t.el.style.cursor = "pointer";
      t.el.onclick = function(e) {
         e.preventDefault();
         activateTool(t);
      };
   });

   var activateTool = function(t) {
      lc.setTool(t.tool);

      tools.forEach(function(t2) {
         if (t == t2) {
            t2.el.style.backgroundColor = 'yellow';
         } else {
            t2.el.style.backgroundColor = 'grey';
         }    
      });
   };

   activateTool(tools[0]);

   myTimer('draw-timer', roomOptions.timer);
}


function submitGuess(guess) {
   if (guess == "")
   {
      alert("enter a guess homie");
      return false;
   }

   socket.emit("guess_submit", guess);
   clearInterval(timer);
   //TODO: manage first round
   if (firstRound) {
      //display canvas
      //with current
      firstRound = false;
      setupCanvas(["yourself",guess]);
   } else {
      //Display wait for everyone to finish drawing/guessing
      let waitContainer = document.getElementById("wait-container");
      waitContainer.style.display = "block";
      document.getElementById('guess_form').style.display = 'none';
      if (wasGuessRound) {
         waitContainer.children[0].innerHTML = "Wait for everyone to finish guessing!";
      } else {
         waitContainer.children[0].innerHTML = "Wait for everyone to finish drawing!";
      }

   }
//todo: handle last round

   //prevent page redirect
   return false;
}

function submitDrawing() {
   //emit an event and send the
   //image data of the canvas
   socket.emit('drawing_submit', lc.getImage({rect: {x:0,y:0,width:500, height: 300}}).toDataURL());
   clearInterval(timer);

   //Display wait for everyone to finish drawing/guessing
   let waitContainer = document.getElementById("wait-container");
   waitContainer.style.display = "block";
   document.getElementsByClassName('fs-container')[0].style.display = 'none';
   if (wasGuessRound) {
      waitContainer.firstChild.value = "Wait for everyone to finish guessing!";
   } else {
      waitContainer.firstChild.value = "Wait for everyone to finish drawing!";
   }
}

function resubmit() {

}

function playerJoined(id, name, avatar, append) {
   let listElement = document.getElementById('lobby-player-list-you');
   let addedElement;
   if (append) {
      addedElement = document.getElementById('lobby-player-list').appendChild(listElement.cloneNode(true));
   } else {
      addedElement = document.getElementById('lobby-player-list').insertBefore(listElement.cloneNode(true), listElement);
   }
   addedElement.removeAttribute('id');
   addedElement.children[0].children[0].innerHTML = name;
   players.set(id, addedElement);
   //adedElement.children[0].children[1].src = "avatar";
}

function playerLeft(id) {
   let element = players.get(id);
   element.parentElement.removeChild(element);
}

function isEmpty(obj) {
   for(var key in obj) {
     if(obj.hasOwnProperty(key))
      return false;
}
return true;
}

function startGame() {
   socket.emit('start_game', "");

}

function myTimer(id, startingMinutes) {
   var minutes = startingMinutes - 1;
   var seconds = 60;

   timer =  setInterval(function () {
      seconds--;
      if (seconds < 0) {
         minutes--;
         seconds = 60;
      }
      if (minutes < 0) {
         clearInterval(timer);
         console.log("timer finished");
         //force submission
         if (wasGuessRound) {
            submitGuess();
         } else submitDrawing();
         return;
      }

      document.getElementById(id).innerHTML = `${minutes}:${seconds}`;

   }, 1000);
}

function leaveRoom() {
   document.getElementById('create-room-button').style.display = 'block';
   document.getElementById('join-room-button').style.display = 'block';
   document.getElementById('leave-room-button').style.display = 'none';
   document.getElementById('game-image-download').style.display = 'none';
   roomName = "";
   finishGameData = "";
   finishGameDataArray = "";
   //delete extra elements in player list
   //hide it
   document.getElementById('lobby-text').innerHTML = "You are not currently in a lobby!";
   let list = document.getElementById('lobby-player-list');
   for (let i = list.length - 1; i > 0; i--) {
      list.removeChild(list.children[i]);
   }
   list.style.display = 'none';

   socket.emit('leave_room', "");
}

function bookTimer(bookIndex) {
   if (bookIndex < finishGameDataArray.length) {
      drawBook(bookIndex);
      document.getElementById('game-over-screen').scrollTo(0,0);
      setTimeout(function() {
         bookTimer(bookIndex+1);
      }, 5000+ 2500*finishGameDataArray.length);
   } else {
      //We've drawn all the books go ahead and change to wait screen
      document.getElementById('game-over-screen').style.display = 'none';
      document.getElementById('lobby-wait-screen').style.display ='block';
   }
}

function drawBook(bookIndex) {
   let book = finishGameDataArray[bookIndex][1];
   const WIDTH = 500;
   const HEIGHT = 300;
   let GUESS_HEIGHT = 100;
   let canvas = document.getElementById("game-over-canvas");
   canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height);
   let bookWidth = 0;
   for (let i = 0; i < book.length; i++) {
      let roundHeight = getHeightForRound(i);

      //Draw a horizontal line
      drawLine(0, roundHeight, canvas.width, roundHeight, canvas);
      let array = book[i];

      let name = array[0];
      let data = array[1];

      if (isGuessRound(i)) {
         writeText(name, bookWidth + 5, roundHeight + 5, false, canvas);
         writeText(data, bookWidth + WIDTH/2, roundHeight + GUESS_HEIGHT/2, true, canvas);
      } else {
         writeText(name, bookWidth+5, roundHeight + 5, false, canvas);
         
         let image = new Image();
         image.onload = function() {
            let centerX = bookWidth + WIDTH/2 - image.width/2;
            let centerY = roundHeight + HEIGHT/2 - image.height/2;
            let ctx = document.getElementById("game-over-canvas").getContext("2d");
            ctx.drawImage(image, centerX, centerY);
         };
         image.src = data;
         
      }
   }
}

function getHeightForRound(i) {
   //Height will change depending on guess round or draw
   let HEIGHT = 300;
   let GUESS_HEIGHT = 100;
   if (isGuessRound(i)) {
      return i*HEIGHT/2 + i*GUESS_HEIGHT/2 + i;
      //0 > 0
      //2 > H + GH
      //4 > 2H + 2GH
   } else {
      let numH = (i-1) / 2;
      let numGH = i - numH;
      return numH*HEIGHT + numGH*GUESS_HEIGHT;
      //1 > GH
      //3 > 2GH + H
      //5 > 3GH + 2H
   }
}

function isGuessRound(n) {
   //If even round, then guess round
   return n % 2 == 0;  
}
function drawLine(startX, startY, endX, endY, canvas) {
   let ctx = canvas.getContext("2d");
   ctx.beginPath();
   ctx.moveTo(startX, startY);
   ctx.lineTo(endX, endY);
   ctx.stroke();
}
function writeText(text, x, y, centered, canvas) {

   let ctx = canvas.getContext("2d");
   if (centered) {
      ctx.textAlign = "center";
   } else {
      ctx.textAlign = "left";
   }
   ctx.font = "20px Comic Sans MS";
   ctx.fillText(text, x, y+20); 
}

function downloadImages() {
   let newWindow = window.open("displayStuff.html");
   return false;
}