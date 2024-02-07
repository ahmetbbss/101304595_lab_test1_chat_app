// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');


const app = express();
const server = http.createServer(app);
const io = socketIo(server);


mongoose.connect('mongodb+srv://ahmetbuyukbas:Yozgatlim38@cluster0.0yemdmh.mongodb.net/chat_app', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

const userSchema = new mongoose.Schema({
  username: String,
  room: String,
});

const messageSchema = new mongoose.Schema({
  username: String,
  room: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

app.use(express.static('public'));
app.use(express.json());
app.use(cors());


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Keep track of usernames and rooms associated with sockets
const socketUserData = {};

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('disconnect', () => {
    const userData = socketUserData[socket.id];
    if (userData) {
      const { username, room } = userData;
      console.log(`${username} disconnected from ${room}`);
      delete socketUserData[socket.id];
      io.to(room).emit('notification', `${username} has left the room .`);
    }
  });

  socket.on('join', async (data) => {
    try {
      const { username, room } = data;
      // Remove user from the previous room //
      const previousUserData = socketUserData[socket.id];
      if (previousUserData) {
        const { previousRoom } = previousUserData;
        socket.leave(previousRoom);
        io.to(previousRoom).emit('notification', `${username} has left the room .`);
      }

      socket.join(room);
      socketUserData[socket.id] = { username, room };
      io.to(room).emit('notification', `${username} has joined the room.`);
      await User.create({ username, room });
    } catch (error) {
      console.error('Error joining room:', error);
    }
  });

  socket.on('leave', async (data) => {
    try {
      const { username, room } = data;
      socket.leave(room);
      io.to(room).emit('notification', `${username} has left the room.`);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });

  socket.on('chat message', async (data) => {
    try {
      const { room, message } = data;
      const username = socketUserData[socket.id].username;
      const newMessage = { username, room, message };
      io.to(room).emit('chat message', newMessage);
      await Message.create(newMessage);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  socket.on('typing', (data) => {
    const { room } = data;
    const username = socketUserData[socket.id].username;
    socket.to(room).emit('user typing', { username });
  });
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});
