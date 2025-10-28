import React, { useState } from 'react';
import { HelpCircle, X, Camera, BookOpen, History, User } from 'lucide-react';

const HelpButton = () => {
    const [showHelp, setShowHelp] = useState(false);

    return (
        <>
            {/* Help Button - Fixed Position */}
            <button
                onClick={() => setShowHelp(true)}
                className="fixed bottom-24 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all hover:scale-110 z-40 flex items-center justify-center"
                aria-label="Help"
            >
                <HelpCircle className="w-6 h-6" />
            </button>

            {/* Help Modal/Sidebar */}
            {showHelp && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 z-50"
                        onClick={() => setShowHelp(false)}
                    />

                    {/* Slide-in Panel */}
                    <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto">
                        {/* Header */}
                        <div className="sticky top-0 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white p-6 shadow-md">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-bold mb-1">Quick Start Guide</h2>
                                    <p className="text-indigo-100 text-sm">Learn how to use Shelf Scan</p>
                                </div>
                                <button
                                    onClick={() => setShowHelp(false)}
                                    className="text-white hover:text-indigo-100 transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6">
                            {/* Quick Start */}
                            <section>
                                <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <Camera className="w-5 h-5 text-indigo-600" />
                                    Quick Start
                                </h3>
                                <div className="space-y-3">
                                    <div className="bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded">
                                        <p className="font-semibold text-indigo-900 mb-2">1. 📸 Take a Photo</p>
                                        <p className="text-sm text-indigo-800">
                                            Tap the camera icon or upload button. Capture your bookshelf spines.
                                        </p>
                                    </div>
                                    <div className="bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded">
                                        <p className="font-semibold text-indigo-900 mb-2">2. 🤖 Scan Books</p>
                                        <p className="text-sm text-indigo-800">
                                            Tap "Scan & Rate Books" and wait 15-30 seconds for AI to identify books.
                                        </p>
                                    </div>
                                    <div className="bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded">
                                        <p className="font-semibold text-indigo-900 mb-2">3. ⭐ Discover Top Books</p>
                                        <p className="text-sm text-indigo-800">
                                            See your top 3 highest-rated books instantly!
                                        </p>
                                    </div>
                                </div>
                            </section>

                            {/* Pro Tips */}
                            <section>
                                <h3 className="text-xl font-bold text-gray-800 mb-3">💡 Pro Tips</h3>
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <p className="font-semibold text-green-800 mb-2">✅ For Best Results:</p>
                                    <ul className="text-sm text-green-700 space-y-1 ml-4">
                                        <li>• Use good lighting</li>
                                        <li>• Scan 5-10 books per photo</li>
                                        <li>• Keep titles clear and readable</li>
                                        <li>• Hold camera steady</li>
                                    </ul>
                                </div>
                            </section>

                            {/* Features */}
                            <section>
                                <h3 className="text-xl font-bold text-gray-800 mb-3">🎁 Optional Features</h3>
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-3">
                                    <p className="text-sm text-yellow-800 mb-2">
                                        <strong>No account needed!</strong> Start scanning immediately.
                                    </p>
                                </div>
                                <p className="text-sm text-gray-700 mb-3">Create a free account to unlock:</p>
                                <div className="space-y-2">
                                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                        <History className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-semibold text-gray-800 text-sm">Scan History</p>
                                            <p className="text-xs text-gray-600">Never lose your discoveries</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                        <BookOpen className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-semibold text-gray-800 text-sm">Goodreads Import</p>
                                            <p className="text-xs text-gray-600">See which books you already own</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                        <User className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-semibold text-gray-800 text-sm">Personal Library</p>
                                            <p className="text-xs text-gray-600">Manage your reading list</p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Goodreads Import */}
                            <section>
                                <h3 className="text-xl font-bold text-gray-800 mb-3">📚 Import Goodreads</h3>
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                                    <p className="text-sm text-emerald-800 mb-3">
                                        Auto-highlight books you own when scanning!
                                    </p>
                                    <div className="space-y-2 text-sm text-emerald-700">
                                        <p><strong>On Goodreads:</strong></p>
                                        <ol className="ml-4 space-y-1">
                                            <li>1. Go to "My Books"</li>
                                            <li>2. Find "Import and export"</li>
                                            <li>3. Export Library → Download CSV</li>
                                        </ol>
                                        <p className="mt-2"><strong>In Shelf Scan:</strong></p>
                                        <ol className="ml-4 space-y-1">
                                            <li>1. Go to Profile → My Library</li>
                                            <li>2. Import from Goodreads</li>
                                            <li>3. Upload CSV file</li>
                                        </ol>
                                    </div>
                                </div>
                            </section>

                            {/* Troubleshooting */}
                            <section>
                                <h3 className="text-xl font-bold text-gray-800 mb-3">🛠️ Troubleshooting</h3>
                                <div className="space-y-3 text-sm">
                                    <div>
                                        <p className="font-semibold text-gray-800">Books not recognized?</p>
                                        <p className="text-gray-600">Retake with better lighting and fewer books (5-10 max)</p>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-800">"Too many scans"</p>
                                        <p className="text-gray-600">Wait 3-5 minutes before trying again</p>
                                    </div>
                                </div>
                            </section>

                            {/* Contact */}
                            <section className="border-t pt-6">
                                <p className="text-sm text-gray-600 text-center">
                                    Need more help?{' '}
                                    <a
                                        href="mailto:admin@shelfscan.xyz"
                                        className="text-indigo-600 hover:text-indigo-700 font-semibold"
                                    >
                                        Contact us
                                    </a>
                                </p>
                            </section>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default HelpButton;
