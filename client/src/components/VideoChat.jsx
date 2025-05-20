import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const VideoChat = ({ user }) => {
  const [isSearching, setIsSearching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [partnerId, setPartnerId] = useState(null);
  const [error, setError] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerConnectionRef = useRef();
  const socketRef = useRef();
  const localStreamRef = useRef();

  useEffect(() => {
    // Initialisation de Socket.io
    socketRef.current = io('http://localhost:5000', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    socketRef.current.on('connect', () => {
      console.log('Connecté au serveur Socket.io');
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Erreur de connexion Socket.io:', err);
      setError('Erreur de connexion au serveur');
    });

    // Gestion des événements Socket.io
    socketRef.current.on('offer', handleOffer);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('ice-candidate', handleIceCandidate);
    socketRef.current.on('partnerFound', handlePartnerFound);
    socketRef.current.on('waiting', () => {
      console.log('En attente d\'un partenaire...');
      setIsWaiting(true);
    });
    socketRef.current.on('partnerDisconnected', handlePartnerDisconnected);

    // Initialisation de la caméra
    initializeMedia();

    return () => {
      // Nettoyage
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      socketRef.current.disconnect();
    };
  }, []);

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        // Vérifier si la vidéo locale commence à jouer
        localVideoRef.current.onloadedmetadata = () => {
          console.log('Métadonnées de la vidéo locale chargées');
          localVideoRef.current.play().catch(err => {
            console.error('Erreur lors de la lecture de la vidéo locale:', err);
          });
        };
      }
      console.log('Caméra et microphone initialisés avec succès');
    } catch (err) {
      console.error('Erreur lors de l\'accès aux médias:', err);
      setError('Erreur lors de l\'accès à la caméra/microphone. Veuillez vérifier les permissions.');
    }
  };

  const createPeerConnection = () => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        {
          urls: 'turn:numb.viagenie.ca',
          credential: 'muazkh',
          username: 'webrtc@live.com'
        }
      ],
      iceCandidatePoolSize: 10
    };

    console.log('Création de la connexion peer avec la configuration:', configuration);

    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    // Ajout des tracks locales
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log('Ajout de la track:', track.kind);
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Gestion des candidats ICE
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Nouveau candidat ICE local:', event.candidate);
        socketRef.current.emit('ice-candidate', {
          target: partnerId,
          candidate: event.candidate
        });
      }
    };

    // Gestion du stream distant
    pc.ontrack = (event) => {
      console.log('Stream distant reçu:', event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        // Vérifier si la vidéo commence à jouer
        remoteVideoRef.current.onloadedmetadata = () => {
          console.log('Métadonnées de la vidéo distante chargées');
          remoteVideoRef.current.play().catch(err => {
            console.error('Erreur lors de la lecture de la vidéo distante:', err);
          });
        };
      }
    };

    // Gestion des erreurs de connexion
    pc.oniceconnectionstatechange = () => {
      console.log('État de la connexion ICE:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        handlePartnerDisconnected();
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log('État de la collecte ICE:', pc.iceGatheringState);
    };

    pc.onsignalingstatechange = () => {
      console.log('État de la signalisation:', pc.signalingState);
    };

    return pc;
  };

  const handleOffer = async (data) => {
    console.log('Offre reçue de:', data.caller);
    try {
      // Si nous avons déjà une connexion, la fermer
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      const pc = createPeerConnection();
      console.log('État de signalisation avant setRemoteDescription:', pc.signalingState);
      
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      console.log('Description distante définie');
      
      const answer = await pc.createAnswer();
      console.log('Réponse créée');
      
      await pc.setLocalDescription(answer);
      console.log('Description locale définie');

      socketRef.current.emit('answer', {
        target: data.caller,
        sdp: answer
      });
      console.log('Réponse envoyée');
    } catch (err) {
      console.error('Erreur lors de la gestion de l\'offre:', err);
      setError('Erreur lors de l\'établissement de la connexion. Veuillez réessayer.');
    }
  };

  const handleAnswer = async (data) => {
    console.log('Réponse reçue de:', data.answerer);
    try {
      if (!peerConnectionRef.current) {
        console.error('Pas de connexion peer active');
        return;
      }

      console.log('État de signalisation actuel:', peerConnectionRef.current.signalingState);

      // Attendre que l'état soit correct
      if (peerConnectionRef.current.signalingState === 'have-local-offer') {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(data.sdp)
        );
        console.log('Description distante définie pour la réponse');
      } else {
        console.log('Attente de l\'état correct de signalisation...');
        // Attendre un court instant et réessayer
        setTimeout(() => {
          if (peerConnectionRef.current && peerConnectionRef.current.signalingState === 'have-local-offer') {
            peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(data.sdp)
            ).then(() => {
              console.log('Description distante définie pour la réponse après attente');
            }).catch(err => {
              console.error('Erreur lors de la définition de la description distante après attente:', err);
            });
          }
        }, 1000);
      }
    } catch (err) {
      console.error('Erreur lors de la gestion de la réponse:', err);
      setError('Erreur lors de l\'établissement de la connexion. Veuillez réessayer.');
    }
  };

  const handleIceCandidate = async (data) => {
    console.log('Candidat ICE reçu de:', data.sender);
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
        console.log('Candidat ICE ajouté');
      }
    } catch (err) {
      console.error('Erreur lors de l\'ajout du candidat ICE:', err);
    }
  };

  const handlePartnerFound = (partner) => {
    console.log('Partenaire trouvé:', partner);
    setPartnerId(partner.id);
    setIsConnected(true);
    setIsSearching(false);
    setIsWaiting(false);

    // Si nous avons déjà une connexion, la fermer
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Créer la connexion peer et envoyer l'offre
    const pc = createPeerConnection();
    console.log('État de signalisation initial:', pc.signalingState);

    pc.createOffer()
      .then(offer => {
        console.log('Offre créée');
        return pc.setLocalDescription(offer);
      })
      .then(() => {
        console.log('Description locale définie pour l\'offre');
        console.log('État de signalisation après setLocalDescription:', pc.signalingState);
        socketRef.current.emit('offer', {
          target: partner.id,
          sdp: pc.localDescription
        });
        console.log('Offre envoyée');
      })
      .catch(err => {
        console.error('Erreur lors de la création de l\'offre:', err);
        setError('Erreur lors de l\'établissement de la connexion. Veuillez réessayer.');
      });
  };

  const handlePartnerDisconnected = () => {
    console.log('Partenaire déconnecté');
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setIsConnected(false);
    setPartnerId(null);
    setIsWaiting(false);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const startSearch = () => {
    console.log('Démarrage de la recherche d\'un partenaire');
    setIsSearching(true);
    setIsWaiting(false);
    setError('');
    socketRef.current.emit('searchPartner');
  };

  const endCall = () => {
    console.log('Fin de l\'appel');
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setIsConnected(false);
    setPartnerId(null);
    setIsWaiting(false);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full rounded-lg"
                    />
                    <p className="text-center mt-2">Vous</p>
                  </div>
                  <div>
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full rounded-lg"
                    />
                    <p className="text-center mt-2">Interlocuteur</p>
                  </div>
                </div>

                {error && (
                  <div className="text-red-500 text-center">
                    {error}
                  </div>
                )}

                <div className="flex justify-center space-x-4 mt-4">
                  {!isConnected && !isSearching && !isWaiting && (
                    <button
                      onClick={startSearch}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                      Rechercher un interlocuteur
                    </button>
                  )}

                  {isSearching && !isWaiting && (
                    <div className="text-indigo-600">
                      Recherche en cours...
                    </div>
                  )}

                  {isWaiting && (
                    <div className="text-indigo-600">
                      En attente d'un interlocuteur...
                    </div>
                  )}

                  {isConnected && (
                    <button
                      onClick={endCall}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Terminer l'appel
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoChat; 