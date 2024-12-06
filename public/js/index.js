// Déclaration de l'objet player avec ses propriétés 
const player = {
    host: false,
    playedCell: "",
    roomId: null,
    username: "",
    socketId: "",
    symbol: "X",
    turn: false,
    win: false
};

// Initialisation de socket.io
const socket = io();

// Récupération des paramètres de l'URL
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const roomId = urlParams.get('room');

// Si un roomId est présent dans l'URL, changer le texte du bouton de démarrage
if (roomId) {
    document.getElementById('start').innerText = "Rejoindre";
}

// Récupération des éléments du DOM
const usernameInput = document.getElementById('username');
const gameCard = document.getElementById('game-card');
const userCard = document.getElementById('user-card');
const restartArea = document.getElementById('restart-area');
const waitingArea = document.getElementById('waiting-area');
const roomsCard = document.getElementById('rooms-card');
const roomsList = document.getElementById('rooms-list');
const turnMsg = document.getElementById('turn-message');
const linkToShare = document.getElementById('link-to-share');

let ennemyUsername = "";

// Récupération des éléments du chat
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

// Gestion de l'envoi de messages dans le chat
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();

    if (message !== "") {
        socket.emit('chat message', {
            roomId: player.roomId,
            message: `${player.username}: ${message}`,
            type: "user",
        });
        chatInput.value = ""; 
    }
});

// Réception des messages du chat
socket.on('chat message', (data) => {
    const { message, type } = data;

    const messageElement = document.createElement('p');
    messageElement.textContent = message;

    // Changement de couleur des messages selon leur type
    if (type === "system-join") {
        messageElement.style.color = "#4CAF50"; // Vert
    } else if (type === "system-replay") {
        messageElement.style.color = "#FFEB3B"; // Jaune
    } else if (type === "system-leave") {
        messageElement.style.color = "#F44336"; // Rouge
    } else {
        messageElement.style.color = "black";
    }
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Demande de la liste des salles disponibles
socket.emit('get rooms');
socket.on('list rooms', (rooms) => {
    let html = "";
    if (rooms.length > 0) {
        rooms.forEach(room => {
            if (room.players.length !== 2) {
                html += `<li class="list-group-item d-flex justify-content-between">
                            <p class="p-0 m-0 flex-grow-1 fw-bold">Salon de ${room.players[0].username} - ${room.id}</p>
                            <button class="btn btn-sm btn-success join-room" data-room="${room.id}">Rejoindre</button>
                        </li>`;
            }
        });
    }
    if (html !== "") {
        roomsCard.classList.remove('d-none');
        roomsList.innerHTML = html;
        for (const element of document.getElementsByClassName('join-room')) {
            element.addEventListener('click', joinRoom, false)
        }
    }
});

// Gestion de la soumission du formulaire de connexion
$("#form").on('submit', function (e) {
    e.preventDefault();
    player.username = usernameInput.value;
    if (roomId) {
        player.roomId = roomId;
    } else {
        player.host = true;
        player.turn = true;
    }
    player.socketId = socket.id;
    userCard.hidden = true;
    waitingArea.classList.remove('d-none');
    roomsCard.classList.add('d-none');
    socket.emit('playerData', player);
});

// Gestion du clic sur une cellule du jeu
$(".cell").on("click", function (e) {
    const playedCell = this.getAttribute('id');
    if (this.innerText === "" && player.turn) {
        player.playedCell = playedCell;
        this.innerText = player.symbol;
        player.win = calculateWin(playedCell);
        player.turn = false;
        socket.emit('play', player);
    }
});

// Gestion du clic sur le bouton de redémarrage
$("#restart").on('click', function () {
    restartGame();
})

// Gestion de la jonction à une salle
socket.on('join room', (roomId) => {
    player.roomId = roomId;
    linkToShare.innerHTML = `<a href="${window.location.href}?room=${player.roomId}" target="_blank">${window.location.href}?room=${player.roomId}</a>`;
});

// Démarrage du jeu
socket.on('start game', (players) => {
    console.log(players)
    startGame(players);
});

// Gestion du tour de jeu de l'ennemi
socket.on('play', (ennemyPlayer) => {
    if (ennemyPlayer.socketId !== player.socketId && !ennemyPlayer.turn) {
        const playedCell = document.getElementById(`${ennemyPlayer.playedCell}`);
        playedCell.classList.add('text-danger');
        playedCell.innerHTML = 'O';
        if (ennemyPlayer.win) {
            setTurnMessage('alert-info', 'alert-danger', `C'est perdu ! <b>${ennemyPlayer.username}</b> a gagné !`);
            calculateWin(ennemyPlayer.playedCell, 'O');
            showRestartArea();
            return;
        }
        if (calculateEquality()) {
            setTurnMessage('alert-info', 'alert-warning', "C'est une egalité !");
            return;
        }
        setTurnMessage('alert-info', 'alert-success', "C'est ton tour de jouer");
        player.turn = true;
    } else {
        if (player.win) {
            $("#turn-message").addClass('alert-success').html("Félicitations, tu as gagné la partie !");
            showRestartArea();
            return;
        }
        if (calculateEquality()) {
            setTurnMessage('alert-info', 'alert-warning', "C'est une egalité !");
            showRestartArea();
            return;
        }
        setTurnMessage('alert-success', 'alert-info', `C'est au tour de <b>${ennemyUsername}</b> de jouer`)
        player.turn = false;
    }
});

// Gestion de la demande de rejouer
socket.on('play again', (players) => {
    restartGame(players);
})

// Fonction pour démarrer le jeu
function startGame(players) {
    restartArea.classList.add('d-none');
    waitingArea.classList.add('d-none');
    gameCard.classList.remove('d-none');
    turnMsg.classList.remove('d-none');
    const ennemyPlayer = players.find(p => p.socketId != player.socketId);
    ennemyUsername = ennemyPlayer.username;
    if (player.host && player.turn) {
        setTurnMessage('alert-info', 'alert-success', "C'est ton tour de jouer");
    } else {
        setTurnMessage('alert-success', 'alert-info', `C'est au tour de <b>${ennemyUsername}</b> de jouer`);
    }
}

// Fonction pour redémarrer le jeu
function restartGame(players = null) {
    if (player.host && !players) {
        player.turn = true;
        socket.emit('play again', player.roomId);
    }
    const cells = document.getElementsByClassName('cell');
    for (const cell of cells) {
        cell.innerHTML = '';
        cell.classList.remove('win-cell', 'text-danger');
    }
    turnMsg.classList.remove('alert-warning', 'alert-danger');
    if (!player.host) {
        player.turn = false;
    }
    player.win = false;
    if (players) {
        startGame(players);
    }
}

// Fonction pour afficher la zone de redémarrage
function showRestartArea() {
    if (player.host) {
        restartArea.classList.remove('d-none');
    }
}

// Fonction pour définir le message de tour
function setTurnMessage(classToRemove, classToAdd, html) {
    turnMsg.classList.remove(classToRemove);
    turnMsg.classList.add(classToAdd);
    turnMsg.innerHTML = html;
}

// Fonction pour calculer l'égalité
function calculateEquality() {
    let equality = true;
    const cells = document.getElementsByClassName('cell');
    for (const cell of cells) {
        if (cell.textContent === '') {
            equality = false;
        }
    }
    return equality;
}

// Fonction pour calculer la victoire
function calculateWin(playedCell, symbol = player.symbol) {
    let row = playedCell[5];
    let column = playedCell[7];
    // 1) VERTICAL (vérifie si tous les symboles de la colonne de la cellule cliquée sont les mêmes)
    let win = true;
    for (let i = 1; i < 4; i++) {
        if ($(`#cell-${i}-${column}`).text() !== symbol) {
            win = false;
        }
    }
    if (win) {
        for (let i = 1; i < 4; i++) {
            $(`#cell-${i}-${column}`).addClass("win-cell");
        }
        return win;
    }
    // 2) HORIZONTAL (vérifie la ligne de la cellule cliquée)
    win = true;
    for (let i = 1; i < 4; i++) {
        if ($(`#cell-${row}-${i}`).text() !== symbol) {
            win = false;
        }
    }
    if (win) {
        for (let i = 1; i < 4; i++) {
            $(`#cell-${row}-${i}`).addClass("win-cell");
        }
        return win;
    }
    // 3) DIAGONALE PRINCIPALE (vérifie même si la cellule cliquée n'est pas dans la diagonale principale)
    win = true;
    for (let i = 1; i < 4; i++) {
        if ($(`#cell-${i}-${i}`).text() !== symbol) {
            win = false;
        }
    }
    if (win) {
        for (let i = 1; i < 4; i++) {
            $(`#cell-${i}-${i}`).addClass("win-cell");
        }
        return win;
    }
    // 3) DIAGONALE SECONDAIRE
    win = false;
    if ($("#cell-1-3").text() === symbol) {
        if ($("#cell-2-2").text() === symbol) {
            if ($("#cell-3-1").text() === symbol) {
                win = true;
                $("#cell-1-3").addClass("win-cell");
                $("#cell-2-2").addClass("win-cell");
                $("#cell-3-1").addClass("win-cell");
                return win;
            }
        }
    }
}
// Fonction pour rejoindre une salle
const joinRoom = function () {
    if (usernameInput.value !== "") {
        player.username = usernameInput.value;
        player.socketId = socket.id;
        player.roomId = this.dataset.room;
        socket.emit('playerData', player);
        userCard.hidden = true;
        waitingArea.classList.remove('d-none');
        roomsCard.classList.add('d-none');
    }
}