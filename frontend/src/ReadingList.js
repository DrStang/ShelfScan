import React, { useState, useEffect } from 'react';
import { Upload, Book, Trash2, Loader2, AlertCircle, CheckCircle, X, Star } from 'lucide-react';
import { useAuth } from './AuthContext';

function ReadingList({ isOpen, onClose }) {
  const [readingList, setReadingList] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stats, setStats] = useState(null);
  const { user, session } = useAuth();

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  useEffect(() => {
    if (isOpen && user) {
      loadReadingList();
    }
  }, [isOpen, user]);

  const loadReadingList = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_URL}/api/reading-list`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load reading list');
      }

      setReadingList(data.books || []);
      setFilteredBooks(data.books || []);
      calculateStats(data.books || []);
    } catch (err) {
      console.error('Error loading reading list:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (books) => {
    const read = books.filter(b => b.exclusive_shelf === 'read').length;
    const currentlyReading = books.filter(b => b.exclusive_shelf === 'currently-reading').length;
    const toRead = books.filter(b => b.exclusive_shelf === 'to-read').length;
    const avgRating = books
      .filter(b => b.my_rating && b.my_rating > 0)
      .reduce((sum, b, _, arr) => sum + b.my_rating / arr.length, 0);

    setStats({
      total: books.length,
      read,
      currentlyReading,
      toRead,
      avgRating: avgRating > 0 ? avgRating.toFixed(1) : 'N/A'
    });
  };

  const handleFilterClick = (filter) => {
    setActiveFilter(filter);
    
    if (filter === 'all') {
      setFilteredBooks(readingList);
    } else {
      const filtered = readingList.filter(book => book.exclusive_shelf === filter);
      setFilteredBooks(filtered);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/import-goodreads`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import');
      }

      setSuccess(`Successfully imported ${data.imported} books!`);
      await loadReadingList();
      setActiveFilter('all');
    } catch (err) {
      console.error('Import error:', err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleClearList = async () => {
    if (!window.confirm('Are you sure you want to clear your entire reading list? This cannot be undone.')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/api/reading-list`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clear list');
      }

      setSuccess('Reading list cleared successfully');
      setReadingList([]);
      setFilteredBooks([]);
      setStats(null);
      setActiveFilter('all');
    } catch (err) {
      console.error('Clear error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Book className="w-6 h-6 text-indigo-600" />
              <h2 className="text-2xl font-bold text-gray-800">My Reading List</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Import Section */}
          <div className="mb-6 p-4 bg-indigo-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Import from Goodreads
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Export your Goodreads library and upload the CSV file here.
              <a
                href="https://www.goodreads.com/review/import"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-700 ml-1"
              >
                Get your export →
              </a>
            </p>

            <div className="flex gap-3">
              <label className="flex-1 cursor-pointer">
                <div className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Upload CSV
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>

              {readingList.length > 0 && (
                <button
                  onClick={handleClearList}
                  disabled={loading}
                  className="px-4 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  Clear List
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">Error</p>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-green-700">{success}</p>
            </div>
          )}

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <button
                onClick={() => handleFilterClick('all')}
                className={`rounded-lg p-4 text-center transition-all hover:shadow-md ${
                  activeFilter === 'all' ? 'ring-2 ring-indigo-500 bg-indigo-50' : 'bg-gray-50'
                }`}
              >
                <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
                <div className="text-sm text-gray-600">Total Books</div>
              </button>
              
              <button
                onClick={() => handleFilterClick('read')}
                className={`rounded-lg p-4 text-center transition-all hover:shadow-md ${
                  activeFilter === 'read' ? 'ring-2 ring-green-500 bg-green-100' : 'bg-green-50'
                }`}
              >
                <div className="text-2xl font-bold text-green-700">{stats.read}</div>
                <div className="text-sm text-gray-600">Read</div>
              </button>
              
              <button
                onClick={() => handleFilterClick('currently-reading')}
                className={`rounded-lg p-4 text-center transition-all hover:shadow-md ${
                  activeFilter === 'currently-reading' ? 'ring-2 ring-blue-500 bg-blue-100' : 'bg-blue-50'
                }`}
              >
                <div className="text-2xl font-bold text-blue-700">{stats.currentlyReading}</div>
                <div className="text-sm text-gray-600">Reading</div>
              </button>
              
              <button
                onClick={() => handleFilterClick('to-read')}
                className={`rounded-lg p-4 text-center transition-all hover:shadow-md ${
                  activeFilter === 'to-read' ? 'ring-2 ring-amber-500 bg-amber-100' : 'bg-amber-50'
                }`}
              >
                <div className="text-2xl font-bold text-amber-700">{stats.toRead}</div>
                <div className="text-sm text-gray-600">To Read</div>
              </button>
              
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-700 flex items-center justify-center gap-1">
                  <Star className="w-5 h-5 fill-purple-700" />
                  {stats.avgRating}
                </div>
                <div className="text-sm text-gray-600">Avg Rating</div>
              </div>
            </div>
          )}

          {/* Reading List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : readingList.length === 0 ? (
            <div className="text-center py-12">
              <Book className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No books in your reading list yet.</p>
              <p className="text-sm text-gray-400 mt-2">Upload your Goodreads CSV to get started!</p>
            </div>
          ) : (
            <div>
              {activeFilter !== 'all' && (
                <div className="mb-4 flex items-center justify-between bg-indigo-50 px-4 py-2 rounded-lg">
                  <p className="text-sm text-indigo-700">
                    Showing {filteredBooks.length} {
                      activeFilter === 'read' ? 'read' :
                      activeFilter === 'currently-reading' ? 'currently reading' :
                      'to-read'
                    } books
                  </p>
                  <button
                    onClick={() => handleFilterClick('all')}
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Clear filter
                  </button>
                </div>
              )}
              
              <div className="max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {filteredBooks.map((book, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:border-indigo-300 transition-colors">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-800 truncate">{book.title}</h4>
                        <p className="text-sm text-gray-600 truncate">{book.author}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {book.my_rating > 0 && (
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-medium">{book.my_rating}</span>
                            </div>
                          )}
                          {book.exclusive_shelf && (
                            <span className={`text-xs px-2 py-1 rounded ${
                              book.exclusive_shelf === 'read' ? 'bg-green-100 text-green-700' :
                              book.exclusive_shelf === 'currently-reading' ? 'bg-blue-100 text-blue-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {book.exclusive_shelf === 'currently-reading' ? 'Reading' : 
                               book.exclusive_shelf === 'to-read' ? 'To Read' : 'Read'}
                            </span>
                          )}
                          {book.isbn13 && (
                            <span className="text-xs text-gray-400">ISBN: {book.isbn13}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReadingList;
