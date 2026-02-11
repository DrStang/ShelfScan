import React from 'react';
import { X, Globe, Star } from 'lucide-react';
import amazonImage from './amazon.png';
import googleImage from './Google_Play_Books_icon_(2023).svg.png';
import goodreadsImage from './Goodreads_logo_2025.png';

onClose, book }) => {
    if (!show || !book) {
        return null;
    }

    // 2. UPDATE LINKS ARRAY to include AmazonIcon
    const links = [
        {
            name: 'Amazon Product Page',
            icon: AmazonIcon, // Using the custom component
            url: book.amazonUrl,
            color: 'text-orange-600 hover:text-orange-800',
        },
        {
            name: 'Goodreads Page',
            icon: Star,
            url: book.goodreadsUrl,
            color: 'text-amber-700 hover:text-amber-900',
        },
        {
            name: 'Google Books Details',
            icon: Globe,
            url: book.infoLink,
            color: 'text-blue-600 hover:text-blue-800',
        },
    ];

    return (
        <div
            className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative transform transition-all overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Close modal"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header: Book Info */}
                <div className="px-6 pb-6">
                    <div className="flex gap-4 mb-6">
                        {book.thumbnail && (
                            <img
                                src={book.thumbnail}
                                alt={book.title}
                                className="w-16 h-24 object-cover rounded-lg shadow-md"
                            />
                        ) : (
                            <div className="w-20 h-28 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="text-gray-400 dark:text-gray-500 text-xs">No Cover</span>
                            </div>
                        )}
                        <div className="min-w-0 flex-1">    
                            <h3 className="text-xl font-semibold text-indigo-700">
                                {book.title}
                            </h3>
                            <p className="text-md text-gray-500 mb-6">
                                by {book.author || 'Unknown Author'}
                            </p>
                            {book.rating > 0 && (
                                <div className="flex items-center gap-1">
                                    <span ClassName="text-yellow-500">★</span>
                                    <span ClassName="font-semibold text-gray-800">
                                        {book.rating.toFixed(1)}
                                    </span>
                                    {book.ratingsCount > 0 && (
                                        <span ClassName="text-xs text-gray-500">
                                            ({book.ratingsCount.toLocaleString()})
                                        </span>
                                     )}
                                </div>
                              )}
                        </div>
                    </div>  

                    {/* Link List */}
                    <div className="space-y-3 mb-6">
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                            View on
                        </p>
                        <div className="flex flex-wrap gap-4 items-center">
                            {book.amazonUrl && (
                                <a
                                    href={book.amazonUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-4 p-4 border border-gray-200 rounded-lg transition-all group ${link.color} hover:bg-gray-100`}
                                >
                                    <img
                                        src={amazonImage}
                                        alt="Amazon"
                                        className="h-10 w-auto"
                                    />
                                </a>
                            )}
                            {book.goodreadsUrl && (
                                <a
                                    href={book.goodreadsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={handleLinkClick}
                                    className={`flex items-center gap-4 p-4 border border-gray-200 rounded-lg transition-all group ${link.color} hover:bg-gray-100`}
                                >
                                    <img
                                        src={goodreadsImage}
                                        alt="Goodreads"
                                        className="h-10 w-auto dark:brightness-110"
                                    />
                                </a>
                            )}

                            {book.infoLink && (
                                <a
                                    href={book.infoLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={handleLinkClick}
                                    className={`flex items-center gap-4 p-4 border border-gray-200 rounded-lg transition-all group ${link.color} hover:bg-gray-100`}
                                >
                                    <img
                                        src={googleImage}
                                        alt="Google Books"
                                        className="h-10 w-auto"
                                    />
                                </a>
                            )}
                        </div>
                    </div>
                    <book.description && (
                        <div className="mb-6">
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                                About
                            </p> 
                            <p className="text-gray-700 leading-relaxed text-sm line-clamp-4">
                                {book.description.replace(/<[^>]*>/g, '').substring(0,250)}
                                {book.description.length > 250 ? '...' : ''}
                            </p>
                        </div>
                    )}
                    

                    {/* Footer */}
                    <div className="mt-6 pt-4 border-t text-right">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>  
    );
};

export default LinkModal;
