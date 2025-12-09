const config = {
  apiUrl: import.meta.env.VITE_API_URL || '',
  socketUrl: import.meta.env.VITE_SOCKET_URL || window.location.origin.replace('http', 'ws').replace(':5000', ':3001')
};

export default config;
