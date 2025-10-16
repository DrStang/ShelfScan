import React, { useState, useEffect } from 'react';
import { Upload, Book, Star, Loader2, AlertCircle, Camera, User, LogOut, History, Globe, BookOpen } from 'lucide-react';
import { useAuth } from './AuthContext';
import AuthModal from './AuthModal';
import ReadingList from './ReadingList';
import { supabase } from './supabaseClient';
import { SpeedInsights } from "@vercel/speed-insights/react";

function App() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [books, setBooks] = useState([]);
  const [error, setError] = useState('');
  const [rateLimitError, setRateLimitError] = useState(false);
  const [backendStatus, setBackendStatus] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showReadingList, setShowReadingList] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [savingScan, setSavingScan] = useState(false);
  const [showOnlyMatches, setShowOnlyMatches] = useState(false);
  const [matchedCount, setMatchedCount] = useState(0);


  const { user, signOut, loading: authLoading } = useAuth();
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Check backend health on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch(`${API_URL}/api/health`);
        const data = await response.json();
        if (data.status === 'ok') {
          setBackendStatus('connected');
        } else {
          setBackendStatus('error');
        }
      } catch (err) {
        setBackendStatus('disconnected');
      }
    };
    checkBackend();
  }, [API_URL]);

  // Load scan history when user logs in
  useEffect(() => {
    if (user) {
      loadScanHistory();
    } else {
      setScanHistory([]);
    }
  }, [user]);

  const loadScanHistory = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('scans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setScanHistory(data || []);
    } catch (err) {
      console.error('Error loading scan history:', err);
    }
  };

  const saveScan = async (booksData) => {
    if (!user) return;
    
    setSavingScan(true);
    try {
      const { error } = await supabase
        .from('scans')
        .insert({
          user_id: user.id,
          books: booksData,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      await loadScanHistory();
    } catch (err) {
      console.error('Error saving scan:', err);
    } finally {
      setSavingScan(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      processImageFile(file);
    }
  };

  const processImageFile = (file) => {
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setImage(event.target.result);
      setBooks([]);
      setError('');
      setRateLimitError(false);
    };
    reader.onerror = () => {
      setError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const scanBooks = async () => {
  if (!image) return;

  setLoading(true);
  setError('');
  setRateLimitError(false);
  setBooks([]);
  setMatchedCount(0);

  try {
    const response = await fetch(`${API_URL}/api/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        image,
        userId: user?.id  // NEW: Pass user ID for cross-reference
      })
    }).catch(err => {
      throw new Error(`Cannot connect to backend at ${API_URL}. Make sure the backend server is running.`);
    });

    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error('Backend returned invalid JSON. Check backend logs for errors.');
      }
    } else {
      const text = await response.text();
      throw new Error(`Backend error: ${text.substring(0, 200)}`);
    }

    if (!response.ok) {
      if (response.status === 429) {
        setRateLimitError(true);
        throw new Error('Too many requests. Please wait a few minutes and try again.');
      }
      
      throw new Error(data.error || `Server error (${response.status})`);
    }

    if (data.success && data.books) {
      setBooks(data.books);
      setMatchedCount(data.matchedInReadingList || 0);  // NEW: Store match count
      
      // Auto-save scan for logged-in users
      if (user) {
        await saveScan(data.books);
      }
      
      if (data.totalProcessed < data.totalFound) {
        setError(`Found ${data.totalFound} books, but could only get ratings for ${data.totalProcessed}`);
      }
    } else {
      throw new Error('Unexpected response from server');
    }

  } catch (err) {
    console.error('Scan error:', err);
    setError(err.message || 'An error occurred while scanning books');
  } finally {
    setLoading(false);
  }
};
  const handleSignOut = async () => {
    await signOut();
    setShowHistory(false);
  };

  const displayBooks = showOnlyMatches 
  ? books.filter(book => book.inReadingList)
  : books;

const topThreeBooks = displayBooks.slice(0, 3);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2">
              <Book className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-600" />
              <h1 className="text-2xl sm:text-4xl font-bold text-gray-800">Shelf Scan</h1>
            </div>
            
            <div className="flex items-center gap-3">
              {authLoading ? (
                <div className="text-sm text-gray-500">Loading...</div>
              ) : user ? (
                <>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                  >
                    <History className="w-4 h-4" />
                    History
                  </button>
                  <button
                    onClick={() => setShowReadingList(true)}
                    className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors flex items-center gap-2"
                  >
                    <BookOpen className="w-4 h-4" />
                    Reading List
                  </button>
                  <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg">
                    <User className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm text-gray-700">{user.email}</span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-8">
          {/* Scan History Panel */}
          {showHistory && user && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Recent Scans</h2>
              {scanHistory.length === 0 ? (
                <p className="text-gray-500">No scans yet. Start scanning books to build your history!</p>
              ) : (
                <div className="space-y-4">
                  {scanHistory.map((scan) => (
                    <div key={scan.id} className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm text-gray-500">
                          {new Date(scan.created_at).toLocaleDateString()} at{' '}
                          {new Date(scan.created_at).toLocaleTimeString()}
                        </p>
                        <span className="text-sm font-medium text-indigo-600">
                          {scan.books.length} books
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {scan.books.slice(0, 3).map((book, idx) => (
                          <span key={idx} className="text-sm bg-gray-100 px-2 py-1 rounded">
                            {book.title}
                          </span>
                        ))}
                        {scan.books.length > 3 && (
                          <span className="text-sm text-gray-500">
                            +{scan.books.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Main Scanner Interface */}
          <div className="text-center mb-6 sm:mb-8">
            <p className="text-sm sm:text-base text-gray-600 px-4">Upload a photo of book spines to find the highest-rated books.</p>
            <p className="text-sm sm:text-base text-gray-600 px-4">Optionally register/sign-in to store your scan history and to see if a scanned book is in your Goodreads reading list!</p>
            
            {backendStatus && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  backendStatus === 'connected' ? 'bg-green-500' : 
                  backendStatus === 'disconnected' ? 'bg-red-500' : 'bg-yellow-500'
                }`}></div>
                <span className="text-sm text-gray-500">
                  Backend: {backendStatus === 'connected' ? 'Connected' : 
                           backendStatus === 'disconnected' ? `Not reachable at ${API_URL}` : 'Error'}
                </span>
              </div>
            )}
            
            {savingScan && (
              <div className="mt-2 text-sm text-indigo-600">
                💾 Saving scan to your library...
              </div>
            )}
          </div>
          {/* Reading List Match Notification */}
          {user && matchedCount > 0 && (
            <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-emerald-600" />
                  <span className="font-semibold text-emerald-800">
                    Found {matchedCount} book{matchedCount !== 1 ? 's' : ''} from your reading list!
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyMatches}
                    onChange={(e) => setShowOnlyMatches(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="text-sm font-medium text-emerald-700">Show only my books</span>
                </label>
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
            <div className="flex flex-col items-center gap-4">
              <label className="w-full cursor-pointer">
                <div className="border-4 border-dashed border-indigo-200 rounded-lg p-12 text-center hover:border-indigo-400 transition-colors">
                  {image ? (
                    <img src={image} alt="Uploaded books" className="max-h-96 mx-auto rounded-lg" />
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <Upload className="w-16 h-16 text-indigo-400" />
                      <p className="text-lg text-gray-600">Click to upload or take a photo</p>
                      <p className="text-sm text-gray-400">JPG, PNG up to 10MB</p>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              {!image && (
                <div className="flex gap-3 w-full max-w-md">
                  <label className="flex-1 cursor-pointer">
                    <div className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                      <Camera className="w-5 h-5" />
                      Take Photo
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  
                  <label className="flex-1 cursor-pointer">
                    <div className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
                      <Upload className="w-5 h-5" />
                      Upload File
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {image && (
                <div className="flex gap-3">
                  <button
                    onClick={scanBooks}
                    disabled={loading}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Scanning Books...
                      </>
                    ) : (
                      <>
                        <Book className="w-5 h-5" />
                        Scan & Rate Books
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => {
                      setImage(null);
                      setBooks([]);
                      setError('');
                    }}
                    disabled={loading}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className={`mt-4 p-4 border rounded-lg flex items-start gap-3 ${
                rateLimitError 
                  ? 'bg-orange-50 border-orange-200 text-orange-700' 
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{rateLimitError ? 'Rate Limit Reached' : 'Error'}</p>
                  <p>{error}</p>
                </div>
              </div>
            )}
          </div>

          {topThreeBooks.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-gray-800 text-center mb-6">
                🏆 Top 3 Highest-Rated Books
              </h2>
              
              {topThreeBooks.map((book, index) => (
              <div key={index} className={`bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow ${
                book.inReadingList ? 'ring-4 ring-emerald-400' : ''
              }`}>                  
                  <div className="flex gap-6 p-6">
                    {book.thumbnail && (
                      <img 
                        src={book.thumbnail} 
                        alt={book.title}
                        className="w-32 h-48 object-cover rounded-lg shadow-md"
                      />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-2xl sm:text-3xl font-bold text-indigo-600">#{index + 1}</span>
                            <h3 className="text-xl sm:text-2xl font-bold text-gray-800 break-words">{book.title}</h3>
                          </div>
                          <p className="text-base sm:text-lg text-gray-600 mb-2">by {book.author}</p>
                        </div>
                      </div>
                      {/* Reading List Badge - ADD THIS */}
                      {book.inReadingList && (
                        <div className="mb-4 inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 px-4 py-2 rounded-lg border border-emerald-300">
                          <BookOpen className="w-5 h-5" />
                          <div>
                            <span className="font-bold">📚 On Your Reading List!</span>
                            {book.readingListInfo && (
                              <div className="text-sm mt-1">
                                Shelf: <span className="capitalize">{book.readingListInfo.shelf?.replace('-', ' ')}</span>
                                {book.readingListInfo.myRating && (
                                  <span> • Your Rating: {book.readingListInfo.myRating}★</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex items-center gap-1">
                          <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                          <span className="text-2xl font-bold text-gray-800">
                            {book.rating > 0 ? book.rating.toFixed(1) : 'N/A'}
                          </span>
                        </div>
                        {book.ratingsCount > 0 && (
                          <span className="text-gray-500">
                            ({book.ratingsCount.toLocaleString()} ratings)
                          </span>
                        )}
                      </div>
                      
                      {book.ratingSource && (
                        <div className="mb-4 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg inline-block">
                          📊 Rating from: {book.ratingSource}
                        </div>
                      )}

                      <div className="mb-4">
                        <p className="text-gray-700 leading-relaxed line-clamp-4">
                          {book.description.replace(/<[^>]*>/g, '').substring(0, 300)}
                          {book.description.length > 300 ? '...' : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3 items-center">
                          <a
                            href={book.amazonUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-2"
                          >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            xmlnsXlink="http://www.w3.org/1999/xlink"
                            version="1.1"
                            width="256"
                            height="256"
                            viewBox="0 0 24 24"
                            className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0"
                            xmlSpace="preserve"
                          >
                            <g
                              style={{
                                stroke: "none",
                                strokeWidth: 0,
                                strokeDasharray: "none",
                                strokeLinecap: "butt",
                                strokeLinejoin: "miter",
                                strokeMiterlimit: 10,
                                fill: "none",
                                fillRule: "nonzero",
                                opacity: 1,
                              }}
                              transform="translate(71.91906614785992 71.9190661478599) scale(1.24 1.24)"
                            >
                              <path
                                d="M 69.637 65.363 H 20.363 C 9.117 65.363 0 56.246 0 45 v 0 c 0 -11.246 9.117 -20.363 20.363 -20.363 h 49.273 C 80.883 24.637 90 33.754 90 45 v 0 C 90 56.246 80.883 65.363 69.637 65.363 z"
                                style={{
                                  stroke: "none",
                                  strokeWidth: 1,
                                  strokeDasharray: "none",
                                  strokeLinecap: "butt",
                                  strokeLinejoin: "miter",
                                  strokeMiterlimit: 10,
                                  fill: "rgb(51,62,71)",
                                  fillRule: "nonzero",
                                  opacity: 1,
                                }}
                                transform=" matrix(1 0 0 1 0 0) "
                                strokeLinecap="round"
                              />
                              <path
                                d="M 52.825 52.525 c -3.776 2.787 -9.252 4.269 -13.967 4.269 c -6.608 0 -12.558 -2.443 -17.061 -6.509 c -0.353 -0.32 -0.038 -0.756 0.387 -0.508 c 4.858 2.827 10.866 4.53 17.071 4.53 c 4.186 0 8.787 -0.869 13.021 -2.665 C 52.915 51.371 53.45 52.063 52.825 52.525 z"
                                style={{
                                  stroke: "none",
                                  strokeWidth: 1,
                                  strokeDasharray: "none",
                                  strokeLinecap: "butt",
                                  strokeLinejoin: "miter",
                                  strokeMiterlimit: 10,
                                  fill: "rgb(247,156,52)",
                                  fillRule: "nonzero",
                                  opacity: 1,
                                }}
                                transform=" matrix(1 0 0 1 0 0) "
                                strokeLinecap="round"
                              />
                              <path
                                d="M 54.397 50.73 c -0.483 -0.618 -3.193 -0.293 -4.41 -0.147 c -0.369 0.045 -0.426 -0.278 -0.094 -0.511 c 2.162 -1.519 5.704 -1.08 6.116 -0.571 c 0.415 0.512 -0.109 4.064 -2.135 5.759 c -0.312 0.261 -0.608 0.122 -0.47 -0.222 C 53.86 53.898 54.88 51.349 54.397 50.73 z"
                                style={{
                                  stroke: "none",
                                  strokeWidth: 1,
                                  strokeDasharray: "none",
                                  strokeLinecap: "butt",
                                  strokeLinejoin: "miter",
                                  strokeMiterlimit: 10,
                                  fill: "rgb(247,156,52)",
                                  fillRule: "nonzero",
                                  opacity: 1,
                                }}
                                transform=" matrix(1 0 0 1 0 0) "
                                strokeLinecap="round"
                              />
                              <path
                                d="M 50.072 39.345 V 37.87 c 0.001 -0.225 0.17 -0.374 0.374 -0.373 l 6.613 -0.001 c 0.211 0 0.382 0.153 0.382 0.372 v 1.265 c -0.002 0.212 -0.181 0.489 -0.498 0.929 l -3.426 4.891 c 1.271 -0.03 2.616 0.161 3.772 0.81 c 0.261 0.146 0.331 0.364 0.351 0.576 v 1.574 c 0 0.217 -0.237 0.468 -0.487 0.338 c -2.035 -1.066 -4.736 -1.183 -6.987 0.013 c -0.23 0.123 -0.47 -0.125 -0.47 -0.342 v -1.497 c 0 -0.239 0.005 -0.649 0.246 -1.014 l 3.968 -5.693 l -3.455 -0.001 C 50.243 39.717 50.073 39.566 50.072 39.345 z"
                                style={{
                                  stroke: "none",
                                  strokeWidth: 1,
                                  strokeDasharray: "none",
                                  strokeLinecap: "butt",
                                  strokeLinejoin: "miter",
                                  strokeMiterlimit: 10,
                                  fill: "rgb(255,255,255)",
                                  fillRule: "nonzero",
                                  opacity: 1,
                                }}
                                transform=" matrix(1 0 0 1 0 0) "
                                strokeLinecap="round"
                              />
                              <path
                                d="M 25.951 48.56 h -2.012 c -0.192 -0.012 -0.344 -0.156 -0.36 -0.34 l 0.002 -10.326 c 0 -0.206 0.174 -0.371 0.388 -0.371 l 1.873 -0.001 c 0.196 0.01 0.353 0.158 0.365 0.347 v 1.348 h 0.038 c 0.488 -1.304 1.408 -1.912 2.648 -1.912 c 1.258 0 2.047 0.608 2.61 1.912 c 0.488 -1.304 1.596 -1.912 2.779 -1.912 c 0.845 0 1.765 0.348 2.329 1.13 c 0.639 0.87 0.508 2.129 0.508 3.237 l -0.002 6.516 c 0 0.206 -0.173 0.371 -0.388 0.371 H 34.72 c -0.203 -0.013 -0.361 -0.173 -0.361 -0.371 l -0.001 -5.474 c 0 -0.434 0.038 -1.52 -0.057 -1.933 c -0.15 -0.696 -0.6 -0.892 -1.182 -0.892 c -0.489 0 -0.996 0.326 -1.202 0.847 c -0.207 0.522 -0.188 1.391 -0.188 1.978 v 5.473 c 0 0.206 -0.174 0.371 -0.388 0.371 h -2.01 c -0.202 -0.013 -0.361 -0.173 -0.361 -0.371 l -0.002 -5.474 c 0 -1.152 0.188 -2.846 -1.239 -2.846 c -1.446 0 -1.389 1.651 -1.389 2.846 l -0.001 5.473 C 26.339 48.394 26.165 48.56 25.951 48.56 z"
                                style={{
                                  stroke: "none",
                                  strokeWidth: 1,
                                  strokeDasharray: "none",
                                  strokeLinecap: "butt",
                                  strokeLinejoin: "miter",
                                  strokeMiterlimit: 10,
                                  fill: "rgb(255,255,255)",
                                  fillRule: "nonzero",
                                  opacity: 1,
                                }}
                                transform=" matrix(1 0 0 1 0 0) "
                                strokeLinecap="round"
                              />
                              <path
                                d="M 63.151 39.413 c -1.483 0 -1.577 2.02 -1.577 3.28 c 0 1.26 -0.019 3.955 1.559 3.955 c 1.559 0 1.634 -2.173 1.634 -3.498 c 0 -0.869 -0.038 -1.912 -0.301 -2.738 C 64.241 39.695 63.79 39.413 63.151 39.413 z M 63.133 37.305 c 2.986 0 4.6 2.565 4.6 5.824 c 0 3.149 -1.784 5.649 -4.6 5.649 c -2.93 0 -4.526 -2.564 -4.526 -5.758 C 58.607 39.804 60.222 37.305 63.133 37.305 z"
                                style={{
                                  stroke: "none",
                                  strokeWidth: 1,
                                  strokeDasharray: "none",
                                  strokeLinecap: "butt",
                                  strokeLinejoin: "miter",
                                  strokeMiterlimit: 10,
                                  fill: "rgb(255,255,255)",
                                  fillRule: "nonzero",
                                  opacity: 1,
                                }}
                                transform=" matrix(1 0 0 1 0 0) "
                                strokeLinecap="round"
                              />
                              <path
                                d="M 71.606 48.56 h -2.005 c -0.201 -0.013 -0.361 -0.173 -0.361 -0.371 L 69.237 37.86 c 0.017 -0.189 0.184 -0.337 0.387 -0.337 l 1.866 -0.001 c 0.176 0.009 0.321 0.129 0.358 0.289 v 1.579 h 0.038 c 0.564 -1.413 1.352 -2.086 2.741 -2.086 c 0.901 0 1.784 0.326 2.348 1.217 c 0.526 0.826 0.526 2.216 0.526 3.215 v 6.498 c -0.022 0.183 -0.186 0.325 -0.386 0.325 h -2.016 c -0.186 -0.012 -0.336 -0.149 -0.358 -0.325 v -5.606 c 0 -1.13 0.132 -2.782 -1.258 -2.782 c -0.488 0 -0.939 0.326 -1.164 0.826 c -0.282 0.63 -0.32 1.26 -0.32 1.956 v 5.56 C 71.994 48.394 71.82 48.56 71.606 48.56 z"
                                style={{
                                  stroke: "none",
                                  strokeWidth: 1,
                                  strokeDasharray: "none",
                                  strokeLinecap: "butt",
                                  strokeLinejoin: "miter",
                                  strokeMiterlimit: 10,
                                  fill: "rgb(255,255,255)",
                                  fillRule: "nonzero",
                                  opacity: 1,
                                }}
                                transform=" matrix(1 0 0 1 0 0) "
                                strokeLinecap="round"
                              />
                              <path
                                d="M 22.01 46.668 c -0.368 -0.508 -0.76 -0.921 -0.76 -1.864 V 41.67 c 0 -1.329 0.094 -2.548 -0.884 -3.463 c -0.754 -0.723 -1.992 -0.989 -2.961 -1.001 h -0.149 c -1.894 0.02 -3.977 0.747 -4.419 3.079 c -0.047 0.251 0.135 0.383 0.3 0.421 l 1.95 0.211 c 0.182 -0.009 0.315 -0.189 0.35 -0.371 c 0.167 -0.815 0.849 -1.208 1.617 -1.208 c 0.413 0 0.884 0.152 1.129 0.523 c 0.283 0.414 0.244 0.979 0.244 1.459 v 0.261 c -1.167 0.131 -2.691 0.218 -3.782 0.697 c -1.262 0.544 -2.146 1.655 -2.146 3.288 c 0 2.09 1.318 3.136 3.011 3.136 c 1.431 0 2.212 -0.338 3.317 -1.462 c 0.365 0.529 0.485 0.786 1.153 1.341 c 0.15 0.08 0.342 0.072 0.475 -0.047 l 0.005 0.005 c 0.401 -0.358 1.132 -0.992 1.543 -1.336 C 22.168 47.069 22.138 46.852 22.01 46.668 z M 18.052 45.764 c -0.32 0.566 -0.828 0.914 -1.393 0.914 c -0.771 0 -1.223 -0.588 -1.223 -1.459 c 0 -1.714 1.537 -2.025 2.992 -2.025 v 0.436 C 18.428 44.414 18.447 45.067 18.052 45.764 z"
                                style={{
                                  stroke: "none",
                                  strokeWidth: 1,
                                  strokeDasharray: "none",
                                  strokeLinecap: "butt",
                                  strokeLinejoin: "miter",
                                  strokeMiterlimit: 10,
                                  fill: "rgb(255,255,255)",
                                  fillRule: "nonzero",
                                  opacity: 1,
                                }}
                                transform=" matrix(1 0 0 1 0 0) "
                                strokeLinecap="round"
                              />
                              <path
                                d="M 48.383 46.668 c -0.368 -0.508 -0.76 -0.921 -0.76 -1.864 V 41.67 c 0 -1.329 0.095 -2.548 -0.884 -3.463 c -0.754 -0.723 -1.992 -0.989 -2.961 -1.001 h -0.149 c -1.893 0.02 -3.976 0.747 -4.419 3.079 c -0.047 0.251 0.136 0.383 0.3 0.421 l 1.95 0.211 c 0.182 -0.009 0.314 -0.189 0.349 -0.371 c 0.168 -0.815 0.849 -1.208 1.617 -1.208 c 0.414 0 0.884 0.152 1.129 0.523 c 0.283 0.414 0.245 0.979 0.245 1.459 v 0.261 c -1.167 0.131 -2.692 0.218 -3.783 0.697 c -1.26 0.544 -2.146 1.655 -2.146 3.288 c 0 2.09 1.318 3.136 3.011 3.136 c 1.431 0 2.213 -0.338 3.317 -1.462 c 0.365 0.529 0.485 0.786 1.153 1.341 c 0.151 0.08 0.342 0.072 0.475 -0.047 l 0.006 0.005 c 0.401 -0.358 1.131 -0.992 1.542 -1.336 C 48.54 47.069 48.512 46.852 48.383 46.668 z M 44.425 45.764 c -0.32 0.566 -0.828 0.914 -1.393 0.914 c -0.771 0 -1.223 -0.588 -1.223 -1.459 c 0 -1.714 1.537 -2.025 2.992 -2.025 v 0.436 C 44.801 44.414 44.819 45.067 44.425 45.764 z"
                                style={{
                                  stroke: "none",
                                  strokeWidth: 1,
                                  strokeDasharray: "none",
                                  strokeLinecap: "butt",
                                  strokeLinejoin: "miter",
                                  strokeMiterlimit: 10,
                                  fill: "rgb(255,255,255)",
                                  fillRule: "nonzero",
                                  opacity: 1,
                                }}
                                transform=" matrix(1 0 0 1 0 0) "
                                strokeLinecap="round"
                              />
                            </g>
                          </svg>
                          </a>
                        {book.infoLink && (
                          <a
                            href={book.infoLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-2 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-medium min-h-[36px] text-xs sm:text-sm sm:px-4 sm:py-2"

                          >
                            Google →
                          </a>
                        )}
                        {book.goodreadsUrl && (
                          <a
                            href={book.goodreadsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-2 py-1.5 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors font-medium min-h-[36px] text-xs sm:text-sm sm:px-4 sm:py-2"
                            >
                            Goodreads →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {books.length > 3 && (
            <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Other Books Found</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {books.slice(3).map((book, index) => (
                  onClick={() => setShowLinkModal(true)}
                   <div className={`flex gap-3 p-4 border rounded-lg hover:border-indigo-300 transition-colors ${
                    book.inReadingList ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200' : 'border-gray-200'
                  }`}>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-gray-800">{book.title}</h4>
                        {book.inReadingList && (
                          <BookOpen className="w-4 h-4 text-emerald-600 flex-shrink-0 ml-2" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{book.author}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">
                          {book.rating > 0 ? book.rating.toFixed(1) : 'N/A'}
                        </span>
                        {book.ratingsCount > 0 && (
                          <span className="text-xs text-gray-500">({book.ratingsCount})</span>
                        )}
                        {book.sources && book.sources.length > 0 && (
                          <span className="text-xs text-gray-400 ml-1">
                            • {book.sources.join('+')}
                          </span>
                        )}
                      </div>
                      {/* NEW: Show shelf for matched books */}
                      {book.inReadingList && book.readingListInfo && (
                        <div className="text-xs text-emerald-700 mt-1 font-medium">
                          {book.readingListInfo.shelf?.replace('-', ' ')}
                        </div>
                      )}
                    </div>
                  </div>

                ))}
              </div>
            </div>
          )}
        </div>
      </div>

        {/* Enhanced Footer with More Options */}
      <footer className="mt-16 pb-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-6">
            {/* Main Disclosure */}
            <div className="text-center mb-6">
              <p className="text-sm text-gray-600 mb-2">
                <strong className="text-gray-800">📢 Disclosure:</strong> As an Amazon Associate I earn from qualifying purchases. 
                This means if you click on an Amazon link and make a purchase, I may receive a small commission at no extra cost to you.
              </p>
              <p className="text-xs text-gray-500">
                Ratings and reviews are sourced from Google Books and Open Library. 
                This tool is not affiliated with Amazon, Goodreads, or Google.
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 my-4"></div>

            {/* Footer Links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              {/* About */}
              <div>
                <h4 className="font-semibold text-gray-800 text-sm mb-2">About</h4>
                <p className="text-xs text-gray-600">
                  Scan book spines with AI to discover ratings and find your next great read.
                </p>
              </div>

              {/* Policies */}
              <div>
                <h4 className="font-semibold text-gray-800 text-sm mb-2">Policies</h4>
                <div className="space-y-1">
                  <a 
                    href="https://affiliate-program.amazon.com/help/operating/policies" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    Amazon Associates Policy
                  </a>
                  <a 
                    href="/privacy" 
                    className="block text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    Privacy Policy
                  </a>
                </div>
              </div>

              {/* Contact */}
              <div>
                <h4 className="font-semibold text-gray-800 text-sm mb-2">Contact</h4>
                <p className="text-xs text-gray-600">
                  Questions or feedback?
                </p>
                <a 
                  href="mailto:hello@bookspinescanner.com" 
                  className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  hello@bookspinescanner.com
                </a>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-gray-500">
                <span>© 2025 Shelf Scan. All rights reserved.</span>
                <div className="flex items-center gap-3">
                  <span>Made with ❤️ for book lovers</span>
                  <span className="hidden md:inline">•</span>
                  <span>Powered by OpenAI Vision</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
      
      <SpeedInsights />

      {/* Modals */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <ReadingList isOpen={showReadingList} onClose={() => setShowReadingList(false)} />
      <LinkModal 
        show={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        items={books}
        />
    </>
  );
}

export default App;
