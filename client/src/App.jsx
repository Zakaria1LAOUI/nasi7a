import { useState } from 'react';
import Auth from './components/Auth';
import VideoChat from './components/VideoChat';

function App() {
  const [user, setUser] = useState(null);

  const handleAuth = (data) => {
    setUser(data.user);
    localStorage.setItem('token', data.token);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {!user ? (
        <Auth onAuth={handleAuth} />
      ) : (
        <div>
          <nav className="bg-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-bold text-gray-900">
                    Therapy App
                  </h1>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-700 mr-4">
                    Bienvenue, {user.username}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Déconnexion
                  </button>
                </div>
              </div>
            </div>
          </nav>
          <VideoChat user={user} />
        </div>
      )}
    </div>
  );
}

export default App; 