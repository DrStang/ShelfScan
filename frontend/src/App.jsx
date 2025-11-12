import React, { useState, useEffect } from 'react';
import { Upload, Book, Star, Loader2, AlertCircle, Camera, User, LogOut, History, BookOpen } from 'lucide-react';
import { useAuth } from './AuthContext';
import AuthModal from './AuthModal';
import ReadingList from './ReadingList';
import { supabase } from './supabaseClient';
import { SpeedInsights } from "@vercel/speed-insights/react";
import LinkModal from './LinkModal';
import DescriptModal from './DescriptModal'; 
import amazonImage from './amazon.png';
import googleImage from './Google_Play_Books_icon_(2023).svg.png';
import goodreadsImage from './Goodreads_logo_2025.png';
import PwChangeModal from './PwChangeModal';
import HelpButton from "./HelpButton";
import PrivacyModal from './PrivacyModal';
import profileModal from './profileModal';


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
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [showDescriptModal, setShowDescriptModal] = useState(false); 
  const [scanHistory, setScanHistory] = useState([]);
  const [savingScan, setSavingScan] = useState(false);
  const [showOnlyMatches, setShowOnlyMatches] = useState(false);
  const [matchedCount, setMatchedCount] = useState(0);
  const [showPwChangeModal, setShowPwChangeModal] = useState(false); 
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false); 
  


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
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const openLinkModal = (bookData) => {
    console.log("Opening modal for book:", bookData); // <--- ADD THIS LINE FOR TESTING
    setSelectedBook(bookData);
    setShowLinkModal(true);
};
  const openDescriptModal = (bookData) => {
    setSelectedBook(bookData);
    setShowDescriptModal(true);
};

const topThreeBooks = displayBooks.slice(0, 3);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Header */}

        <div className="bg-white shadow-sm">
          <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              {/* Logo and Title - Left Side */}
              <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
                <Book className="w-7 h-7 sm:w-10 sm:h-10 text-indigo-600" />
                <h1 className="text-xl sm:text-3xl lg:text-4xl font-bold text-gray-800 whitespace-nowrap">Shelf Scan</h1>
              </div>
              
              {/* Navigation Buttons - Right Side */}
              <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
                {authLoading ? (
                  <div className="text-xs text-gray-500">...</div>
                ) : user ? (
                  <>
                    {/* History Button */}
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className="p-2 sm:px-3 sm:py-2 lg:px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5"
                      title="History"
                    >
                      <History className="w-4 h-4" />
                      <span className="hidden lg:inline text-sm">Scan History</span>
                    </button>
                    
                    {/* Reading List Button */}
                    <button
                      onClick={() => setShowReadingList(true)}
                      className="p-2 sm:px-3 sm:py-2 lg:px-4 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors flex items-center gap-1.5"
                      title="Reading List"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span className="hidden lg:inline text-sm">Reading List</span>
                    </button>
                    
                    {/* User Email - Hidden on mobile */}
                    <div className="hidden xl:flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg">
                      <User className="w-4 h-4 text-indigo-600" />
                      <span className="text-sm text-gray-700 max-w-[120px] truncate">{user.email}</span>
                    </div>
                    
                    {/* Change Password Button */}
                    <button
                      onClick={() => setShowProfileModal(true)}
                      className="p-2 sm:px-3 sm:py-2 lg:px-4 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors flex items-center gap-1.5"
                      title="Change Password"
                    >
                      <User className="w-4 h-4" />
                      <span className="hidden lg:inline text-sm">Change Password</span>
                    </button>
                    
                    {/* Sign Out Button */}
                    <button
                      onClick={handleSignOut}
                      className="p-2 sm:px-3 sm:py-2 lg:px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5"
                      title="Sign Out"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="hidden lg:inline text-sm">Sign Out</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="px-3 py-2 sm:px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
                  >
                    <User className="w-4 h-4" />
                    <span className="text-sm">Sign In</span>
                  </button>
                )}
              </div>
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
                        <p className="text-gray-700 leading-relaxed">
                          {book.description.replace(/<[^>]*>/g, '').substring(0, 300)}
                          {book.description.length > 300 && (
                              <>
                                ...{' '}
                                <button
                                  onClick={() => openDescriptModal(book)}
                                  className="min-h-[44px] text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer touch-manipulation flex items-center"
                                >
                                  More
                                </button>
                              </>
                          )}
                        </p>

                      </div>

                      <div className="flex flex-wrap gap-4 items-center justify-start">
                          <a
                            href={book.amazonUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center"
                            >
                           <img src={amazonImage} alt="Buy on Amazon" className="h-12 w-auto sm:h-14 hover:opacity-80 transition-opacity" />
                          
                          </a>
                        {book.infoLink && (
                          <a
                            href={book.infoLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center"
                            >
                           <img src={googleImage} alt="See on Google Books" className="h-10 w-auto sm:h-12 hover:opacity-80 transition-opacity" />
                            {/* className="inline-flex items-center justify-center px-2 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-medium min-h-[36px] text-xs sm:text-sm sm:px-4 sm:py-2"

                          >
                            Google → */}
                          </a>
                        )}
                        {book.goodreadsUrl && (
                          <a
                            href={book.goodreadsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center"
                            >
                           <img src={goodreadsImage} alt="See on Goodreads" className="h-10 w-auto sm:h-12 hover:opacity-80 transition-opacity" />
                            {/* className="inline-flex items-center justify-center px-2 py-1.5 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors font-medium min-h-[36px] text-xs sm:text-sm sm:px-4 sm:py-2"
                            >
                            Goodreads → */}
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
                   <div className={`flex gap-3 p-4 border rounded-lg hover:border-indigo-300 transition-colors ${
                    book.inReadingList ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200' : 'border-gray-200'
                  }`}
                  onClick={() => openLinkModal(book)}
                   >
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
                <div className="space-y-1 flex flex-col items-center">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setShowPrivacyModal(true)
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline bg-transparent border-none cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                  <a 
                    href="https://affiliate-program.amazon.com/help/operating/policies" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    Amazon Associates Policy
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
                  href="mailto:admin@shelfscan.xyz" 
                  className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  admin@shelfscan.xyz
                </a>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-gray-500">
                <span>© 2025 Shelf Scan. All rights reserved.</span>
                <div className="flex items-center gap-3">
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
        book={selectedBook}
        />
      <DescriptModal 
        show={showDescriptModal}
        onClose={() => setShowDescriptModal(false)}
        book={selectedBook}
        />
      <PrivacyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        />
      <PwChangeModal
        isOpen={showPwChangeModal}
        onClose={() => setShowPwChangeModal(false)}
        />
      <profileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        />
      <HelpButton />
    </>
  );
}

export default App;
