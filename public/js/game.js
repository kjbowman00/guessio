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
var brushEllipse;

var bookShownNumber;

var tempRemoveLater;
//TODO: fix timer counting from 60 not 59
socket.on('join_room_success', function(data) {
    //TODO: Manage late joining (spectating)
    //TODO @IMPORTANT @!@#!@#$!@$!@$!@$!$$!@$!@$!@$!$
    //!@#!@$#!@$!@$!@$!@#$!@#!@$!@#!@#$!@$
    firstRound = true;
    wasGuessRound = true;
    //!@#!@$$!!@$!@$!@#!@#!@#$!@#


    //Check if in a room already
    //Manages for people who direct connect
    //Hide/Delete menu
    //Show game_screen
    roomName = data.roomName;
    document.getElementById("wait-room-box").style.display = 'none';
    document.getElementById('game_screen').style.display = "block";
    document.getElementById('leave-room-button').style.display = 'block';

    document.getElementById('lobby-player-list').style.display = 'inline-flex';

    let chat_box_form = document.getElementById("chat-box-form");
    chat_box_form.classList.remove("disabled");
    for (let current_node of chat_box_form.children) {
        current_node.disabled = false;
        current_node.classList.remove("mouse-disabled");
    }

    let chat_box_scroller = document.getElementById("chat-box-scroller");
    while (chat_box_scroller.hasChildNodes()) {
        chat_box_scroller.removeChild(chat_box_scroller.firstChild);
    }

    if (firstRound) {
        //Display play screen
        document.getElementById('lobby-wait-screen').style.display = 'block';
        //TODO: if host
        document.getElementById('lobby-wait-screen').children[0].style.display = 'block';
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
socket.on('host_changed', function(data) {
    //TODO: Data should actually be player who's now hosting (delete the line below)
    isHosting = (data === "true");
    if (isHosting) {
        document.getElementById('lobby-wait-screen').children[0].style.display = "block";
    } else {
        document.getElementById('lobby-wait-screen').children[0].style.display = "none";
    }
});
socket.on('player_joined_room', function(data) {
    playerJoined(data.id, data.name, "avatar.txt", true);
});
socket.on('player_left_room', function(data) {
    playerLeft(data);
});
socket.on('player_changed_info', function(data) {
    players.get(data.id).children[0].children[0].textContent = data.name;
    //TODO: change avatar
});
socket.on('game_start', function(data) {
    //start first round
    //TODO: Handle room options
    roomOptions = data;
    firstRound = true;
    wasGuestRound = true;
    setupGuess(null);
});
socket.on('book_info', function(data) {
    //Start next round with the new book info
    //TODO: escape or encode book info (X-XSS)
    if (wasGuessRound) {
        setupCanvas(data);
    } else {
        setupGuess(data);
    }
});
socket.on('game_end', function(data) {
    //Data should be the entire player books list
    clearInterval(timer);
    finishGameData = new Map(JSON.parse(data));
    finishGameDataArray = Array.from(finishGameData);
    //Hide canvas and guess thing
    document.getElementById("draw-container").style.display = 'none';
    document.getElementById('wait-container').style.display = 'none';
    document.getElementById('lobby-wait-screen').style.display = 'none';
    document.getElementById('guess_form').style.display = 'none';
    //Do something to allow players to view books

    //Allow players to restart the game

    //Allow downloading of the books as a jpeg

    //For temporary testing just show game over
    let canvas = document.getElementById("game-over-canvas");
    canvas.width = 550;
    canvas.height = getHeightForRound(finishGameDataArray.length + 2) - 1;
    document.getElementById('game-over-screen').style.display = 'block';

    bookShownNumber = 0;
    bookTimer();
    //Download previous game button available
    document.getElementById('game-image-download').style.display = 'block';
});
socket.on('vote_book_finished', function() {
    bookShownNumber++;
    bookTimer();
});
socket.on('chat_message', function(data) {
    //get player name
    let chat_name = players.get(data.socketID).children[0].children[0].innerHTML;

    //Create another chat box
    let bubble = document.createElement("div");
    bubble.setAttribute("class", "chat-bubble");
    let avatarImageBubble = document.createElement("img");
    avatarImageBubble.src = "/images/avatar.png";
    avatarImageBubble.setAttribute("class", "chat-avatar");
    bubble.appendChild(avatarImageBubble);
    let paragraphBubble = document.createElement("p");
    let nameBubble = document.createElement("strong");
    let textBubble = document.createTextNode(chat_name + ": ");
    nameBubble.appendChild(textBubble);
    textBubble = document.createTextNode(data.message);
    paragraphBubble.appendChild(nameBubble);
    paragraphBubble.appendChild(textBubble);
    bubble.appendChild(paragraphBubble);

    //add it to the chatbox
    document.getElementById("chat-box-scroller").appendChild(bubble);
});

function createRoom() {
    //Send in form information
    let form = document.getElementById('create-room-text-input');
    //Check valid form input
    if (form.value == null || form.value === "") {
        //TODO: alert
        return false;
    }

    let formInfo = {};
    let options = {};
    options.timer = 5;
    formInfo.options = options;
    formInfo.roomName = form.value;
    formInfo.playerName = document.getElementById("name-text-input").value;
    form.parentElement.style.display = "none";

    socket.emit('create_room_request', formInfo);
    document.getElementById("wait-room-box").style.display = "block";

    return false;
}

function joinRoom() {
    console.log("joining room");
    let form = document.getElementById("join-room-text-input");
    //Check for bad input
    if (form.value == null || form.value.trim() === "") {
        //TODO: alert
        return false;
    }

    let formInfo = {};
    formInfo.roomName = form.value;
    formInfo.playerName = document.getElementById("name-text-input").value;
    console.log(formInfo);
    socket.emit('join_room_request', formInfo);
    form.parentElement.style.display = "none";
    document.getElementById("wait-room-box").style.display = "block";

    return false;
}

function setupGuess(data) {
    wasGuessRound = true;
    document.getElementById("draw-container").style.display = 'none';
    document.getElementById('wait-container').style.display = 'none';
    document.getElementById('lobby-wait-screen').style.display = 'none';
    let guessBox = document.getElementById('guess-box');
    let guessForm = document.getElementById('guess_form');
    guessForm.reset();
    guessForm.style.display = 'flex';

    let guessImageBox = document.getElementById('guess-image-box');
    if (firstRound) {
        guessImageBox.style.display = 'none';
        guessBox.children[0].innerHTML = "Pick a word/phrase to draw!";
        guessBox.children[1].focus();
    } else {
        //data[0] is the player name who drew the thing
        guessImageBox.style.display = 'block';
        let image = new Image();
        let imageData = data[1];
        image.onload = function() {
            //Check width height
            if (image.width > 0 && image.height > 0) {
                guessImageBox.children[0].src = imageData;
            }
                
        };
        try {
            let decoded = window.atob(data);
            if (decoded.slice(1,4) === "PNG") {
                guessImageBox.children[0].src = "data:image/png;base64," + imageData;
            } else {
                guessImageBox.children[0].src = "/images/destroyed.jpg";
            }
        } catch (error) {
            guessImageBox.children[0].src = "/images/destroyed.jpg";
        }

        guessBox.children[0].innerHTML = "Guess what the other user drew!";
        guessBox.children[1].focus();
    }
    myTimer('guess-timer', roomOptions.timer);
}

function setupCanvas(data) {
    let drawing = data[1];
    //data[0] is who drew it
    wasGuessRound = false;
    document.getElementById("draw-container").style.display = "flex";
    document.getElementById('guess_form').style.display = 'none';
    document.getElementById('wait-container').style.display = 'none';
    document.getElementById('lobby-wait-screen').style.display = 'none';
    document.getElementById('what-to-draw-words').textContent = "You're drawing: " + drawing;


    lc = LC.init(
        document.getElementById("lc"), {
            imageURLPrefix: '/images/drawing-board',
            imageSize: { width: 550, height: 400 },
            tools: [LC.tools.Pencil, LC.tools.Eraser, LC.tools.Eyedropper]
        }
    );

    brushEllipse = LC.createShape('Ellipse', {x:-50, y:-50, width:25, height:25, strokeWidth:1, strokeColor:"transparent", fillColor:"hsla(0, 0%, 50%, 0.5)"});
    lc.on("toolChange", function(tool) {
      updateBrushSize();
      if (tool.name == 'pencil') {
         updateBrushColor();
      }
    });

    let lcBox = document.getElementById("lc");
    lc.setShapesInProgress([brushEllipse]);
    document.onpointermove = (event) => {
         brushEllipse.x = event.x - lcBox.offsetLeft - (lc.tool.strokeWidth)/2;
         brushEllipse.y = event.y - lcBox.offsetTop - (lc.tool.strokeWidth)/2;
         lc.drawShapeInProgress(brushEllipse);
      
    };

    var tools = [{
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
    if (guess == "") {
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
        setupCanvas(["yourself", guess]);
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
    socket.emit('drawing_submit', lc.getImage({ rect: { x: 0, y: 0, width: 550, height: 400 } }).toDataURL().slice(22));
    clearInterval(timer);

    //Display wait for everyone to finish drawing/guessing
    let waitContainer = document.getElementById("wait-container");
    waitContainer.style.display = "block";
    document.getElementById("draw-container").style.display = 'none';
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
    addedElement.children[0].children[0].textNode = name;
    players.set(id, addedElement);
    //adedElement.children[0].children[1].src = "avatar";
}

function playerLeft(id) {
    let element = players.get(id);
    element.parentElement.removeChild(element);
    players.delete(id);
}

function isEmpty(obj) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

function startGame() {
    socket.emit('start_game', "");

}

function myTimer(id, startingMinutes) {
    var minutes = startingMinutes;
    var seconds = 0;
    document.getElementById(id).innerHTML = `${minutes}:0${seconds}`;
    timer = setInterval(function() {
        seconds--;
        if (seconds < 0) {
            minutes--;
            seconds = 59;
        }
        if (minutes < 0) {
            clearInterval(timer);
            console.log("timer finished");
            //force submission
            if (wasGuessRound) {
                submitGuess(document.getElementById('guess_form_text').value);
            } else submitDrawing();
            return;
        }

        if (seconds < 10) {
            document.getElementById(id).innerHTML = `${minutes}:0${seconds}`;
        } else {
            document.getElementById(id).innerHTML = `${minutes}:${seconds}`;
        }


    }, 1000);
}

function leaveRoom() {
   document.getElementById('menu').style.display = "block";
    document.getElementById('game_screen').style.display = "none";
    document.getElementById('game-image-download').style.display = 'none';

    let chat_box_form = document.getElementById("chat-box-form");
    chat_box_form.classList.add("disabled");
    for (let current_node of chat_box_form.children) {
        current_node.disabled = true;
        current_node.classList.add("mouse-disabled");
    }

    //Empty chat box
    let chat_box_scroller = document.getElementById("chat-box-scroller");
    while (chat_box_scroller.hasChildNodes()) {
        chat_box_scroller.removeChild(chat_box_scroller.firstChild);
    }

    roomName = "";
    finishGameData = "";
    finishGameDataArray = "";
    //delete extra elements in player list
    //hide it
    document.getElementById('lobby-text').innerHTML = "You are not currently in a lobby!";
    let list = document.getElementById('lobby-player-list');
    players.forEach((listElement, playerID, map) => {
      list.removeChild(listElement);
    });
    players.clear();
    list.style.display = 'none';

    socket.emit('leave_room', "");
}

function bookTimer() {
    if (bookShownNumber < finishGameDataArray.length) {
        drawBook(bookShownNumber);
        document.getElementById('game-over-scroller').scrollTo(0, 0);
        document.getElementById("ready-for-book-image-button").style.display = "block";
    } else {
        //We've drawn all the books go ahead and change to wait screen
        document.getElementById('game-over-screen').style.display = 'none';
        document.getElementById('lobby-wait-screen').style.display = 'block';
    }
}

function drawBook(bookIndex) {
    let book = finishGameDataArray[bookIndex][1];
    const WIDTH = 550;
    const HEIGHT = 400;
    let GUESS_HEIGHT = 170;
    let canvas = document.getElementById("game-over-canvas");
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    let bookWidth = 0;
    for (let i = 0; i < book.length; i++) {
        let roundHeight = getHeightForRound(i);

        //Draw a horizontal line
        drawLine(0, roundHeight, canvas.width, roundHeight, canvas);
        let array = book[i];

        let name = array[0];
        let data = array[1];

        if (isGuessRound(i)) {
            //writeText(name, bookWidth + 5, roundHeight + 5, false, canvas);
            //writeText(data, bookWidth + WIDTH/2, roundHeight + GUESS_HEIGHT/2, true, canvas);
            wrapText(canvas.getContext("2d"), name, bookWidth + 5, roundHeight + 25, WIDTH - 20, 25, false);
            wrapText(canvas.getContext("2d"), handleLongWords(data, 36), bookWidth + WIDTH / 2, roundHeight + GUESS_HEIGHT / 2 - 35, WIDTH - 20, 25, true);
        } else {
            //writeText(name, bookWidth+5, roundHeight + 5, false, canvas);
            wrapText(canvas.getContext("2d"), name, bookWidth + 5, roundHeight + 25, WIDTH - 20, 25, false);

            let image = new Image();
            image.onload = function() {
                //Check width height
                if (image.width > 0 && image.height > 0) {
                    let centerX = bookWidth + WIDTH / 2 - image.width / 2;
                    let centerY = roundHeight + HEIGHT / 2 - image.height / 2;
                    let ctx = document.getElementById("game-over-canvas").getContext("2d");
                    ctx.drawImage(image, centerX, centerY);
                }
                
            };
            try {
                let decoded = window.atob(data);
                if (decoded.slice(1,4) === "PNG") {
                    image.src = "data:image/png;base64," + data;
                } else {
                    image.src = "/images/destroyed.jpg";
                }
            } catch (error) {
                image.src = "/images/destroyed.jpg";
            }

        }
    }
}

function getHeightForRound(i) {
    //Height will change depending on guess round or draw
    let HEIGHT = 400;
    let GUESS_HEIGHT = 170;
    if (isGuessRound(i)) {
        return i * HEIGHT / 2 + i * GUESS_HEIGHT / 2 + i;
        //0 > 0
        //2 > H + GH
        //4 > 2H + 2GH
    } else {
        let numH = (i - 1) / 2;
        let numGH = i - numH;
        return numH * HEIGHT + numGH * GUESS_HEIGHT;
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
    ctx.fillText(text, x, y + 20);
}

function downloadImages() {
    let newWindow = window.open("displayStuff.html");
    return false;
}

//Recursively handle stupidly long words by adding spaces
function handleLongWords(text, maxLength) {
    var words = text.split(' ');
    var rebuilt = "";
    for (var i = 0; i < words.length; i++) {
        if (words[i].length <= maxLength) {
            rebuilt += words[i] + " ";
        } else {
            rebuilt += words[i].substring(0, maxLength) + " ";
            rebuilt += handleLongWords(words[i].substring(maxLength, words[i].length), maxLength);
        }
    }
    return rebuilt;
}

//Thanks to MichaelCalvin on stackoverflow
function wrapText(ctx, text, x, y, maxWidth, lineHeight, centered) {
    ctx.font = "20px Comic Sans MS";
    if (centered) {
        ctx.textAlign = "center";
    } else {
        ctx.textAlign = "left";
    }
    var words = text.split(' ');
    var line = '';

    for (var n = 0; n < words.length; n++) {
        var testLine = line + words[n] + ' ';
        var metrics = ctx.measureText(testLine);
        var testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y);
}

function updateBrushSize() {
   if (this.value != undefined) {
      let value = parseInt(this.value);
      lc.tool.strokeWidth = value;
      brushEllipse.width = value;
      brushEllipse.height = value;
      lc.drawShapeInProgress(brushEllipse);
   } else {
      let value = parseInt(document.getElementById("brush-slider").value);
      lc.tool.strokeWidth = value;
      brushEllipse.width = value;
      brushEllipse.height = value;
      lc.drawShapeInProgress(brushEllipse);
   }
}

function updateBrushColor() {

}

function readyForBookImage() {
    //TODO:Update avatar status


    //Hide button to ready up (or make it green or something)
    document.getElementById("ready-for-book-image-button").style.display = "none";

    //Send info to server
    socket.emit('next_book_ready');
}

function chatSubmit(node) {
    //TODO: shutoff chat box if not in room

    let form = document.getElementById('chat-box-form');
    socket.emit("chat_message", form.children[0].value);

    //Create another chat box
    let bubble = document.createElement("div");
    bubble.setAttribute("class", "player-chat-bubble");
    let avatarImageBubble = document.createElement("img");
    avatarImageBubble.src = "/images/avatar.png";
    avatarImageBubble.setAttribute("class", "chat-avatar");
    bubble.appendChild(avatarImageBubble);
    let paragraphBubble = document.createElement("p");
    let nameBubble = document.createElement("strong");
    let textBubble = document.createTextNode("You: ");
    nameBubble.appendChild(textBubble);
    textBubble = document.createTextNode(form.children[0].value);
    paragraphBubble.appendChild(nameBubble);
    paragraphBubble.appendChild(textBubble);
    bubble.appendChild(paragraphBubble);

    form.reset();

    //add it to the chatbox
    document.getElementById("chat-box-scroller").appendChild(bubble);
    return false;
}

//For public games only (clicked play button)
function clickedPlay() {
    if (checkName()) {
        socket.emit("play_game", document.getElementById("name-text-input").value);
        document.getElementById("menu").style.display = "none";
        document.getElementById("wait-room-box").style.display = "block";
    }
}

function clickedCreate() {
    if (checkName()) {
        //Open create room panel, hide menu
        document.getElementById("menu").style.display = "none";
        document.getElementById("create-room-box").style.display = "block";
    }
}

function clickedJoin() {
    if (checkName()) {
        //Open join room panel, hide menu
        document.getElementById("menu").style.display = "none";
        document.getElementById("join-room-box").style.display = "block";
    }
}

function checkName() {
    let value = document.getElementById("name-text-input").value.trim();
    if (value == null || value == "") {
        //notify the user to enter a name
        return false;
    }
    else return true;
}

function backToMenu() {
    document.getElementById("menu").style.display = "inline-flex";
    document.getElementById("game_screen").style.display = "none";
    document.getElementById("wait-room-box").style.display = "none";
    document.getElementById("create-room-box").style.display = "none";
    document.getElementById("join-room-box").style.display = "none";
}