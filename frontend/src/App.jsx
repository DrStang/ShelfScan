import React, { useState } from 'react';
import { Upload, Book, Star, Loader2, AlertCircle } from 'lucide-react';

function App() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [books, setBooks] = useState([]);
  const [error, setError] = useState('');
  const [rateLimitError, setRateLimitError] = useState(false);
  const [backendStatus, setBackendStatus] = useState(null);

  // Configure API endpoint - change this to your deployed backend URL
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Check backend health on mount
  React.useEffect(() => {
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

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setError('Image size must be less than 10MB');
        return;
      }

      // Validate file type
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
    }
  };

  const scanBooks = async () => {
    if (!image) return;

    setLoading(true);
    setError('');
    setRateLimitError(false);
    setBooks([]);

    try {
      // Check if backend is reachable
      const response = await fetch(`${API_URL}/api/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image })
      }).catch(err => {
        throw new Error(`Cannot connect to backend at ${API_URL}. Make sure the backend server is running.`);
      });

      // Try to parse JSON response
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
        // Handle rate limiting
        if (response.status === 429) {
          setRateLimitError(true);
          throw new Error('Too many requests. Please wait a few minutes and try again.');
        }
        
        throw new Error(data.error || `Server error (${response.status})`);
      }

      if (data.success && data.books) {
        setBooks(data.books);
        
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

  const topThreeBooks = books.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Book className="w-10 h-10 text-indigo-600" />
            <h1 className="text-4xl font-bold text-gray-800">Shelf Scan</h1>
          </div>
          <p className="text-gray-600">Upload a photo of book spines to find the highest-rated books</p>
          
          {/* Backend Status Indicator */}
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
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="flex flex-col items-center gap-4">
            <label className="w-full cursor-pointer">
              <div className="border-4 border-dashed border-indigo-200 rounded-lg p-12 text-center hover:border-indigo-400 transition-colors">
                {image ? (
                  <img src={image} alt="Uploaded books" className="max-h-96 mx-auto rounded-lg" />
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="w-16 h-16 text-indigo-400" />
                    <p className="text-lg text-gray-600">Click to upload book spine image</p>
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

            {image && (
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
              <div key={index} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
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

                    <div className="flex gap-3">
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
                <div key={index} className="flex gap-3 p-4 border border-gray-200 rounded-lg hover:border-indigo-300 transition-colors">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800">{book.title}</h4>
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
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
