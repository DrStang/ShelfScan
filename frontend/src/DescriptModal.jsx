import React from 'react';
import { X, Globe, Star, FileText } from 'lucide-react';

const DescriptModal = ({ show, onClose, book }) => {
    if (!show || !book) {
        return null;
    }


    return (
        <div
            className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto"
            onClick={onClose}
        >
        <div 
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col p-6 sm:p-8"
            style={{ 
              marginTop: 'max(1rem, env(safe-area-inset-top))',
              maxHeight: 'calc(100vh - 8rem)'
                }}
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
                    More Details:
                </h2>
                <p className="text-xl font-semibold text-indigo-700">
                    {book.title}
                </p>
                <p className="text-md text-gray-500 mb-6">
                    by {book.author || 'Unknown Author'}
                </p>


                <div className="bg-white rounded-xl text-gray-700 leading-relaxed overflow-y-auto">
                    {book.description.replace(/<[^>]*>/g, '').substring()}
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

export default DescriptModal;
