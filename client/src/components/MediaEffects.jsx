import { useEffect } from 'react';

const MediaEffects = ({ localStream, setProcessedStream }) => {
  useEffect(() => {
    if (!localStream) return;

    // Transmettre directement le flux local sans modification
    setProcessedStream(localStream);

    return () => {
      // Nettoyage
      if (localStream) {
        localStream.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, [localStream, setProcessedStream]);

  return null;
};

export default MediaEffects; 