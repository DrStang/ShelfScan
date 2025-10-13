import React, { useState, useEffect } from 'react';
import { Upload, Book, Star, Loader2, AlertCircle, Camera, User, LogOut, History, BookOpen } from 'lucide-react';
import { useAuth } from './AuthContext';
import AuthModal from './AuthModal';
import ReadingList from './ReadingList';
import { supabase } from './supabaseClient';

function App() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showReadingList, setShowReadingList] = useState(false);
  const { user } = useAuth();

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold">Book Spine Scanner</h1>
          <p className="mt-4">App is working with auth!</p>
          
          {user ? (
            <div className="mt-4">
              <button
                onClick={() => setShowReadingList(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
              >
                Open Reading List
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <ReadingList isOpen={showReadingList} onClose={() => setShowReadingList(false)} />
    </>
  );
}

export default App;
