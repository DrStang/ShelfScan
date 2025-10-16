import React from 'react';
import { X, Globe, Star, FileText } from 'lucide-react';

// 1. DEFINE THE CUSTOM SVG COMPONENT IN JSX FORMAT
// We convert SVG attributes to camelCase (e.g., stroke-width -> strokeWidth)
// and replace hardcoded fill: rgb(34,34,34) with 'currentColor' for Tailwind support.



const LinkModal = ({ show, onClose, book }) => {
    if (!show || !book) {
        return null;
    }

    // 2. UPDATE LINKS ARRAY to include AmazonIcon
    const links = [
        {
            name: 'Amazon Product Page',
            icon: Globe, // Using the custom component
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
                className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative transform transition-all"
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
                <h2 className="text-2xl font-bold text-gray-800 border-b pb-2 mb-2">
                    External Links for:
                </h2>
                <p className="text-xl font-semibold text-indigo-700">
                    {book.title}
                </p>
                <p className="text-md text-gray-500 mb-6">
                    by {book.author || 'Unknown Author'}
                </p>

                {/* Link List */}
                <div className="space-y-4">
                    {links.map((link, index) => (
                        link.url ? (
                            <a
                                key={index}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-4 p-4 border border-gray-200 rounded-lg transition-all group ${link.color} hover:bg-gray-100`}
                            >
                                {/* 3. Icon rendering uses the link.color for the text fill */}
                                <link.icon className={`w-6 h-6 flex-shrink-0 ${link.color}`} />
                                <span className="text-lg font-medium">
                  {link.name}
                </span>
                            </a>
                        ) : (
                            <div
                                key={index}
                                className="flex items-center gap-4 p-4 border border-gray-100 rounded-lg text-gray-400 cursor-not-allowed"
                            >
                                <link.icon className="w-6 h-6 flex-shrink-0" />
                                <span className="text-lg font-medium">
                  {link.name} (Not Available)
                </span>
                            </div>
                        )
                    ))}
                </div>

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
    );
};

export default LinkModal;
