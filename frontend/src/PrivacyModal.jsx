import React, {useState, useEffect} from 'react';
import { X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import file from './PrivacyPolicy.md'
const PrivacyModal = ({ isOpen, onClose}) => {
    

    const [text, setText] = useState('');
    useEffect(() => {
        fetch(file)
            .then((response) => response.text())
            .then((md) => {
                setText(md);
            })
    }, [])

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div
                className="bg-white rounded-xl shadow-2xl max-w-4xl w-full overflow-y-auto flex flex-col relative"
                style={{
                    marginTop: 'max(1rem, env(safe-area-inset-top))',
                    maxHeight: 'calc(100vh - 8rem)'
                }}
            >
                <div className="p-6 sm:p-8 flex-grow overflow-y-auto prose max-w-none">
                <ReactMarkdown children={text} />
                </div>
                {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    {/* Footer */}
                    <div className="mt-6 pt-4 border-t text-right bg-white sticky bottom-0">
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

export default PrivacyModal;
