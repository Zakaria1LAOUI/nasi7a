const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware d'authentification
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: decoded.userId });

    if (!user) {
      throw new Error();
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Veuillez vous authentifier.' });
  }
};

// Inscription
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Vérification si l'utilisateur existe déjà
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Cet email ou nom d\'utilisateur est déjà utilisé.' });
    }

    // Création du nouvel utilisateur
    const user = new User({ username, email, password });
    await user.save();

    // Génération du token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        preferences: user.preferences
      },
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Connexion
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Recherche de l'utilisateur
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    // Vérification du mot de passe
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    // Mise à jour du statut en ligne
    user.isOnline = true;
    user.lastActive = new Date();
    await user.save();

    // Génération du token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        preferences: user.preferences
      },
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Déconnexion
router.post('/logout', auth, async (req, res) => {
  try {
    req.user.isOnline = false;
    req.user.lastActive = new Date();
    await req.user.save();
    res.json({ message: 'Déconnexion réussie.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mise à jour des préférences
router.patch('/preferences', auth, async (req, res) => {
  try {
    const { voiceModifier, faceFilter } = req.body;
    
    if (voiceModifier) req.user.preferences.voiceModifier = voiceModifier;
    if (faceFilter) req.user.preferences.faceFilter = faceFilter;
    
    await req.user.save();
    
    res.json({
      preferences: req.user.preferences
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router; 