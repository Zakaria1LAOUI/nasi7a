require("dotenv").config({ path: __dirname + '/.env' });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const authRoutes = require("./routes/auth");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Connexion à MongoDB
mongoose
  .connect(
    process.env.MONGODB_URI ||
      "mongodb+srv://zakariaziko3040_db_user:SqGxMDgxTpAIjXt1@cluster0.xmazy6m.mongodb.net/?appName=Cluster0",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  )
  .then(() => console.log("Connecté à MongoDB"))
  .catch((err) => console.error("Erreur de connexion à MongoDB:", err));

// Routes
app.use("/api/auth", authRoutes);

// Routes de base
app.get("/", (req, res) => {
  res.json({ message: "API Therapy App" });
});

// Gestion des utilisateurs en attente
const waitingUsers = new Set();

// Gestion des connexions Socket.io
io.on("connection", (socket) => {
  console.log("Nouvelle connexion:", socket.id);

  // Gestion de la recherche d'un partenaire
  socket.on("searchPartner", () => {
    console.log("Recherche de partenaire pour:", socket.id);

    // Si aucun utilisateur n'est en attente, ajouter cet utilisateur à la liste d'attente
    if (waitingUsers.size === 0) {
      waitingUsers.add(socket.id);
      socket.emit("waiting");
      console.log("Utilisateur en attente:", socket.id);
    } else {
      // Récupérer le premier utilisateur en attente
      const partnerId = Array.from(waitingUsers)[0];
      waitingUsers.delete(partnerId);

      // Informer les deux utilisateurs qu'ils sont mis en relation
      socket.emit("partnerFound", { id: partnerId });
      io.to(partnerId).emit("partnerFound", { id: socket.id });

      console.log("Mise en relation:", socket.id, "avec", partnerId);
    }
  });

  // Gestion des appels vidéo
  socket.on("offer", (data) => {
    console.log("Offre reçue de", socket.id, "pour", data.target);
    socket.to(data.target).emit("offer", {
      sdp: data.sdp,
      caller: socket.id,
    });
  });

  socket.on("answer", (data) => {
    console.log("Réponse reçue de", socket.id, "pour", data.target);
    socket.to(data.target).emit("answer", {
      sdp: data.sdp,
      answerer: socket.id,
    });
  });

  socket.on("ice-candidate", (data) => {
    console.log("Candidat ICE reçu de", socket.id, "pour", data.target);
    socket.to(data.target).emit("ice-candidate", {
      candidate: data.candidate,
      sender: socket.id,
    });
  });

  // Gestion de la déconnexion
  socket.on("disconnect", () => {
    console.log("Déconnexion:", socket.id);
    waitingUsers.delete(socket.id);

    // Informer le partenaire de la déconnexion
    socket.broadcast.emit("partnerDisconnected", { id: socket.id });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
