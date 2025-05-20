import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import MediaEffects from './MediaEffects';
import MediaControls from './MediaControls';
import config from '../config';

const VideoChat = ({ user }) => {
  const [isSearching, setIsSearching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [partnerId, setPartnerId] = useState(null);
  const [error, setError] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  const [processedStream, setProcessedStream] = useState(null);

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerConnectionRef = useRef();
  const socketRef = useRef();
  const localStreamRef = useRef();

  useEffect(() => {
    // Initialisation de Socket.io
    socketRef.current = io(config.socketUrl, {
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

  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [localStreamRef.current]);

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Mettre à jour le flux traité
      setProcessedStream(stream);
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
      ]
    };

    console.log('Création de la connexion peer');
    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    // Ajouter les tracks immédiatement si disponibles
    const streamToUse = processedStream || localStreamRef.current;
    if (streamToUse) {
      console.log('Ajout des tracks au peer connection');
      streamToUse.getTracks().forEach(track => {
        pc.addTrack(track, streamToUse);
      });
    }

    // Gestion des candidats ICE
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Nouveau candidat ICE local');
        socketRef.current.emit('ice-candidate', {
          target: partnerId,
          candidate: event.candidate
        });
      }
    };

    // Gestion du stream distant
    pc.ontrack = (event) => {
      console.log('Stream distant reçu');
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('État de la connexion ICE:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        handlePartnerDisconnected();
      }
    };

    return pc;
  };

  const handleOffer = async (data) => {
    console.log('Offre reçue');
    try {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      const pc = createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current.emit('answer', {
        target: data.caller,
        sdp: answer
      });
    } catch (err) {
      console.error('Erreur lors de la gestion de l\'offre:', err);
      setError('Erreur lors de l\'établissement de la connexion');
    }
  };

  const handleAnswer = async (data) => {
    console.log('Réponse reçue');
    try {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    } catch (err) {
      console.error('Erreur lors de la gestion de la réponse:', err);
    }
  };

  const handleIceCandidate = async (data) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      }
    } catch (err) {
      console.error('Erreur lors de l\'ajout du candidat ICE:', err);
    }
  };

  const handlePartnerFound = async (partner) => {
    console.log('Partenaire trouvé');
    setPartnerId(partner.id);
    setIsConnected(true);
    setIsSearching(false);
    setIsWaiting(false);

    try {
      const pc = createPeerConnection();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current.emit('offer', {
        target: partner.id,
        sdp: offer
      });
    } catch (err) {
      console.error('Erreur lors de la création de l\'offre:', err);
      setError('Erreur lors de l\'établissement de la connexion');
    }
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
    console.log('Démarrage de la recherche');
    setIsSearching(true);
    setIsWaiting(false);
    setError('');
    socketRef.current.emit('searchPartner');
  };

  const endCall = () => {
    handlePartnerDisconnected();
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
      
      {localStreamRef.current && (
        <MediaEffects
          localStream={localStreamRef.current}
          setProcessedStream={setProcessedStream}
        />
      )}
    </div>
  );
};

export default VideoChat; 