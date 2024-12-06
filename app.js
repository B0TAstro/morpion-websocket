const { Socket } = require('socket.io');
const express = require('express');

const app = express();
const http = require('http').createServer(app);
const path = require('path');
const port = 3000;

/**
 * @type {Socket}
 */
const io = require('socket.io')(http);

// Bootstrap et jQuery
app.use('/bootstrap/css', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css')));
app.use('/bootstrap/js', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js')));
app.use('/jquery', express.static(path.join(__dirname, 'node_modules/jquery/dist')));
app.use(express.static('public'));

// Route pour la page d'accueil
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let rooms = [];

// Gestion des connexions socket
io.on('connection', (socket) => {
    console.log(`[connection] ${socket.id}`);

    // Réception des données du joueur
    socket.on('playerData', (player) => {
        console.log(`[playerData] ${player.username}`);
        let room = null;
        if (!player.roomId) {
            // Créer une nouvelle salle si aucune n'est spécifiée
            room = createRoom(player);
            console.log(`[create room] - ${room.id} - ${player.username}`);
        } else {
            // Rejoindre une salle existante
            room = rooms.find(r => r.id === player.roomId);
            if (room === undefined) {
                return;
            }
            player.roomId = room.id;
            room.players.push(player);
        }
        socket.join(room.id);
        io.to(room.id).emit('chat message', {
            message: `${player.username} a rejoint le salon.`,
            type: "system-join"
        });
        io.to(socket.id).emit('join room', room.id);
        if (room.players.length === 2) {
            io.to(room.id).emit('start game', room.players);
        }
    });

    // Réception des messages de chat
    socket.on('chat message', (data) => {
        const { roomId, message, type } = data;
        io.to(roomId).emit('chat message', { message, type });
    });

    // Demande de liste des salles
    socket.on('get rooms', () => {
        io.to(socket.id).emit('list rooms', rooms);
    });

    // Réception des actions de jeu
    socket.on('play', (player) => {
        console.log(`[play] ${player.username}`);
        io.to(player.roomId).emit('play', player);
    });

    // Demande de rejouer
    socket.on('play again', (roomId) => {
        const room = rooms.find(r => r.id === roomId);
        if (room && room.players.length === 2) {
            io.to(room.id).emit('play again', room.players);
            const player = room.players.find(p => p.socketId === socket.id);
            if (player) {
                io.to(room.id).emit('chat message', {
                    message: `${player.username} veut refaire une partie.`,
                    type: "system-replay"
                });
            }
        }
    });

    // Gestion de la déconnexion
    socket.on('disconnect', () => {
        console.log(`[disconnect] ${socket.id}`);
        let room = null;
        let leavingPlayer = null;
        rooms.forEach(r => {
            r.players = r.players.filter(p => {
                if (p.socketId === socket.id) {
                    leavingPlayer = p;
                    room = r;
                    return false;
                }
                return true;
            });
        });

        if (room && leavingPlayer) {
            io.to(room.id).emit('chat message', {
                message: `${leavingPlayer.username} a quitté le salon.`,
                type: "system-leave"
            });
        }
    });
});

// Fonction pour créer une nouvelle salle
function createRoom(player) {
    const room = { id: roomId(), players: [] };
    player.roomId = room.id;
    room.players.push(player);
    rooms.push(room);
    return room;
}

// Fonction pour générer un ID de salle unique
function roomId() {
    return Math.random().toString(36).substr(2, 9);
}

// Démarrer le serveur
http.listen(port, () => {
    console.log(`Listening on http://localhost:${port}/`);
});