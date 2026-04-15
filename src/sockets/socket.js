const socketIO = require('socket.io');

let io;

const initSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log(' Yangi foydalanuvchi ulandi:', socket.id);

    socket.on('join', (userId) => {
      socket.join(userId);
      console.log(` Foydalanuvchi ${userId} o'z xonasiga kirdi`);
    });

    // Adminlar uchun maxsus xona
    socket.on('joinAdmin', () => {
      socket.join('admin-room');
      console.log('Admin admin-roomga ulandi');
    });

    socket.on('disconnect', () => {
      console.log(' Foydalanuvchi uzildi');
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io hali ishga tushmagan!");
  }
  return io;
};

module.exports = { initSocket, getIO };