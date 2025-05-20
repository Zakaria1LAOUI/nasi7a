# Therapy App - Application de Thérapie Anonyme

Une application web permettant aux utilisateurs de discuter anonymement avec des inconnus via des appels vidéo sécurisés.

## Fonctionnalités

- Authentification des utilisateurs
- Appels vidéo anonymes avec filtres de visage
- Modification de la voix pour préserver l'anonymat
- Interface moderne et intuitive
- Système de mise en relation aléatoire

## Stack Technologique

- MongoDB
- Express.js
- React.js
- Node.js
- TailwindCSS
- WebRTC pour les appels vidéo
- Socket.io pour la communication en temps réel

## Installation

### Prérequis

- Node.js (v14 ou supérieur)
- MongoDB
- npm ou yarn

### Installation du Backend

```bash
cd server
npm install
```

### Installation du Frontend

```bash
cd client
npm install
```

## Configuration

1. Créer un fichier `.env` dans le dossier `server` avec les variables suivantes :
```
MONGODB_URI=votre_uri_mongodb
JWT_SECRET=votre_secret_jwt
PORT=5000
```

2. Créer un fichier `.env` dans le dossier `client` avec les variables suivantes :
```
REACT_APP_API_URL=http://localhost:5000
```

## Démarrage

### Backend
```bash
cd server
npm run dev
```

### Frontend
```bash
cd client
npm start
```

## Sécurité

- Tous les appels vidéo sont chiffrés
- Les visages sont masqués par défaut
- La voix est modifiée pour préserver l'anonymat
- Aucune donnée personnelle n'est stockée 