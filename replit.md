# Therapy App

Anonymous therapy video chat application that connects users for real-time video conversations.

## Overview

This is a full-stack application consisting of:
- **Frontend**: React + Vite with Tailwind CSS
- **Backend**: Express.js with Socket.io for WebRTC signaling
- **Database**: MongoDB (requires external MongoDB connection via MONGODB_URI)

## Project Structure

```
client/               # React frontend
  src/
    components/       # React components (Auth, VideoChat, etc.)
    pages/            # Page components
    utils/            # Utility functions
  vite.config.js      # Vite configuration (port 5000)

server/               # Express backend
  models/             # Mongoose models
  routes/             # API routes
  server.js           # Main server file (port 3001)
```

## Environment Variables

The backend requires:
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT token generation

## Running the Application

- Frontend runs on port 5000 (accessible via webview)
- Backend runs on port 3001 (internal API server)

## Features

- User authentication (login/register)
- Anonymous video chat matching
- WebRTC video/audio communication
- Real-time partner matching via Socket.io
