const socketIO = require('socket.io');
const connectedUsers = {};
function setupSocketIO(server) {
    console.log('websocket works')
    // const io = socketIO(server);
    const io = socketIO(server, { cors: { origin: "*" } });

    io.on('connect', (socket) => {
        socket.on('setUserId', (userId) => {
            console.log('User connected with ID:', userId);
            connectedUsers[userId] = socket;
            socket.join(userId);
            socket.emit('messageFromBackend', 'Hello from the server!');
            // const dynamicUserId = "123456789";
            // sendPrivateMessage(dynamicUserId, 'hello Qasim!');
            // io.to(dynamicUserId).emit('privateMessage', 'test message!');
            socket.on('disconnect', () => {
                console.log('User disconnected with ID:', userId);
                delete connectedUsers[userId];
                // delete connectedUsers[userId];
            });
        });
        socket.on('messageFromFrontend', (data) => {
            console.log('Received data from frontend:', data);
        });
    });
    console.log(connectedUsers, "connectedUsers")

    return io;
}

function sendPrivateMessage(targetUserId, message) {
    const targetSocket = connectedUsers[targetUserId];
    if (targetSocket) {
        targetSocket.emit('privateMessage', message);
        console.log('Sent message to user:', targetUserId);
    } else {
        console.log('User not found:', targetUserId);
    }
}
module.exports = {
    setupSocketIO,
    sendPrivateMessage
};