import React from 'react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h1 className="text-3xl font-bold text-center text-indigo-600 mb-8">
                  Bienvenue sur Nasi7a
                </h1>
                
                <div className="space-y-4">
                  <button
                    onClick={() => navigate('/chat')}
                    className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Commencer une conversation
                  </button>
                  
                  <button
                    onClick={() => navigate('/profile')}
                    className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Mon profil
                  </button>
                </div>

                <div className="mt-8 text-center text-sm text-gray-500">
                  <p>
                    Besoin d'aide ? Consultez notre{' '}
                    <button
                      onClick={() => navigate('/faq')}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      FAQ
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home; 