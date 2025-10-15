import React, { useState, useEffect } from 'react';
import { Upload, Book, Star, Loader2, AlertCircle, Camera, User, LogOut, History, BookOpen } from 'lucide-react';
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
            <div className="flex items-center gap-3">
              <Book className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-800">Shelf Scan</h1>
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
          <div className="text-center mb-8">
            <p className="text-gray-600">Upload a photo of book spines to find the highest-rated books.</p>
            <p className="text-gray-600">Optionally register/sign-in to store your scan history and to see if a scanned book is in your Goodreads reading list!</p>
            
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
                    
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-3xl font-bold text-indigo-600">#{index + 1}</span>
                            <h3 className="text-2xl font-bold text-gray-800">{book.title}</h3>
                          </div>
                          <p className="text-lg text-gray-600 mb-2">by {book.author}</p>
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

                      <div className="flex gap-3 flex-wrap">
                        {book.amazonUrl && (
                          <a
                            href={book.amazonUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-bold shadow-md hover:shadow-lg flex items-center gap-2"
                          >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 7.594 3.166 11.87 3.166 2.852 0 5.668-.533 8.447-1.595l.315-.14c.138-.06.234-.1.293-.13.226-.088.39-.046.525.13.12.174.09.336-.12.48-.256.19-.6.41-1.006.654-1.244.743-2.64 1.316-4.185 1.726-1.53.406-3.045.61-4.516.61-2.265 0-4.434-.403-6.5-1.21-2.064-.807-3.86-1.91-5.375-3.312-.114-.104-.18-.234-.18-.39 0-.06.016-.107.046-.14zm15.006-8.52c.887 0 1.59.2 2.11.598.52.4.78.95.78 1.65 0 .67-.21 1.43-.63 2.27l-3.45 6.84c-.15.3-.38.45-.67.45-.2 0-.38-.07-.52-.21-.15-.15-.22-.33-.22-.55 0-.11.03-.24.09-.38l3.43-6.8c.29-.57.43-1.03.43-1.37 0-.3-.09-.53-.27-.69-.18-.16-.45-.24-.82-.24-.53 0-1.14.21-1.83.63-.69.42-1.32 1-1.88 1.74-.57.74-1.02 1.58-1.37 2.52-.35.94-.52 1.9-.52 2.86 0 .67.13 1.17.4 1.5.26.33.65.5 1.17.5.58 0 1.24-.14 1.98-.43.74-.29 1.36-.64 1.85-1.05.13-.11.24-.16.33-.16.15 0 .27.06.36.17.09.11.13.24.13.38 0 .26-.18.53-.54.81-.75.58-1.63 1.03-2.64 1.37-1.01.33-1.95.5-2.81.5-1.06 0-1.88-.27-2.46-.8-.58-.54-.87-1.29-.87-2.26 0-1.13.22-2.25.67-3.37.44-1.12 1.05-2.12 1.81-3 .77-.88 1.63-1.58 2.59-2.09.96-.51 1.93-.77 2.92-.77zm1.81-5.5c.48 0 .89.17 1.23.51.34.34.51.75.51 1.23 0 .49-.17.9-.51 1.24-.34.34-.75.51-1.23.51-.49 0-.9-.17-1.24-.51-.34-.34-.51-.75-.51-1.24 0-.48.17-.89.51-1.23.34-.34.75-.51 1.24-.51z"/>
                            </svg>
                            Buy on Amazon
                          </a>
                        )}
                        {book.infoLink && (
                          <a
                            href={book.infoLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-medium"
                          >
                            Google Books →
                          </a>
                        )}
                        {book.goodreadsUrl && (
                          <a
                            href={book.goodreadsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-4 py-2 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors font-medium"
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
                  <a href={book.goodreadsUrl} key={index} target="_blank" rel="noopener noreferrer">
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
                  </a>
                ))}
              </div>
            </div>
          )}
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
                <span>© 2025 Book Spine Scanner. All rights reserved.</span>
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
      </div>
      
      <SpeedInsights />

      {/* Modals */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <ReadingList isOpen={showReadingList} onClose={() => setShowReadingList(false)} />
    </>
  );
}

export default App;
