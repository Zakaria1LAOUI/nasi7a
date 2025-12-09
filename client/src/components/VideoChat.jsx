import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import MediaEffects from './MediaEffects';
import MediaControls from './MediaControls';
import config from '../config';

const VideoChat = ({ user }) => {
  const navigate = useNavigate();
  const [isSearching, setIsSearching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [partnerId, setPartnerId] = useState(null);
  const [error, setError] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  const [processedStream, setProcessedStream] = useState(null);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerConnectionRef = useRef();
  const socketRef = useRef();
  const localStreamRef = useRef();
  const timerRef = useRef();

  useEffect(() => {
    socketRef.current = io(config.socketUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    socketRef.current.on('connect', () => {
      console.log('Connecte au serveur Socket.io');
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Erreur de connexion Socket.io:', err);
      setError('Erreur de connexion au serveur');
    });

    socketRef.current.on('offer', handleOffer);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('ice-candidate', handleIceCandidate);
    socketRef.current.on('partnerFound', handlePartnerFound);
    socketRef.current.on('waiting', () => {
      console.log("En attente d'un partenaire...");
      setIsWaiting(true);
    });
    socketRef.current.on('partnerDisconnected', handlePartnerDisconnected);

    initializeMedia();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [localStreamRef.current]);

  useEffect(() => {
    if (isConnected) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isConnected]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
      
      setProcessedStream(stream);
    } catch (err) {
      console.error("Erreur lors de l'acces aux medias:", err);
      setError('Erreur lors de l\'acces a la camera/microphone. Veuillez verifier les permissions.');
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

    console.log('Creation de la connexion peer');
    const pc = new RTCPeerConnection(configuration);
    peerConnectionRef.current = pc;

    const streamToUse = processedStream || localStreamRef.current;
    if (streamToUse) {
      console.log('Ajout des tracks au peer connection');
      streamToUse.getTracks().forEach(track => {
        pc.addTrack(track, streamToUse);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Nouveau candidat ICE local');
        socketRef.current.emit('ice-candidate', {
          target: partnerId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('Stream distant recu');
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('Etat de la connexion ICE:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        handlePartnerDisconnected();
      }
    };

    return pc;
  };

  const handleOffer = async (data) => {
    console.log('Offre recue');
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
      console.error("Erreur lors de la gestion de l'offre:", err);
      setError("Erreur lors de l'etablissement de la connexion");
    }
  };

  const handleAnswer = async (data) => {
    console.log('Reponse recue');
    try {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    } catch (err) {
      console.error('Erreur lors de la gestion de la reponse:', err);
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
      console.error("Erreur lors de l'ajout du candidat ICE:", err);
    }
  };

  const handlePartnerFound = async (partner) => {
    console.log('Partenaire trouve');
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
      console.error("Erreur lors de la creation de l'offre:", err);
      setError("Erreur lors de l'etablissement de la connexion");
    }
  };

  const handlePartnerDisconnected = () => {
    console.log('Partenaire deconnecte');
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
    console.log('Demarrage de la recherche');
    setIsSearching(true);
    setIsWaiting(false);
    setError('');
    socketRef.current.emit('searchPartner');
  };

  const endCall = () => {
    handlePartnerDisconnected();
  };

  const getStatusMessage = () => {
    if (isConnected) return { text: 'Connecte', class: 'status-connected' };
    if (isWaiting) return { text: 'En attente...', class: 'status-waiting' };
    if (isSearching) return { text: 'Recherche...', class: 'status-searching' };
    return null;
  };

  const status = getStatusMessage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Retour
          </button>
          
          {status && (
            <div className={`status-indicator ${status.class}`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-current'} ${!isConnected && (isWaiting || isSearching) ? 'animate-pulse' : ''}`}></span>
              {status.text}
              {isConnected && <span className="ml-2 font-mono">{formatDuration(callDuration)}</span>}
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <div className="video-container aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm">
              Vous
            </div>
          </div>
          
          <div className="video-container aspect-video">
            {isConnected ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center text-white/50">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <p>En attente d'un interlocuteur</p>
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm">
              Interlocuteur
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-6 py-4 rounded-xl mb-6 flex items-center gap-3">
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <div className="flex justify-center gap-4">
          {!isConnected && !isSearching && !isWaiting && (
            <button
              onClick={startSearch}
              className="btn-primary flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Rechercher un interlocuteur
            </button>
          )}

          {(isSearching || isWaiting) && (
            <button
              onClick={() => {
                socketRef.current.emit('cancelSearch');
                setIsSearching(false);
                setIsWaiting(false);
              }}
              className="btn-secondary flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Annuler la recherche
            </button>
          )}

          {isConnected && (
            <>
              <button
                onClick={endCall}
                className="btn-danger flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                </svg>
                Terminer l'appel
              </button>
              
              <button
                onClick={() => {
                  endCall();
                  startSearch();
                }}
                className="btn-primary flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Suivant
              </button>
            </>
          )}
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
