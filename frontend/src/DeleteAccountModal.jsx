import React, { useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';

function DeleteAccountModal({ isOpen, onClose, onConfirmDelete, userEmail }) {
    const [confirmText, setConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');

    const CONFIRM_TEXT = 'DELETE';
    const isConfirmValid = confirmText === CONFIRM_TEXT;

    const handleDelete = async () => {
        if (!isConfirmValid) return;

        setIsDeleting(true);
        setError('');

        try {
            await onConfirmDelete();

        } catch (err) {
            console.error('Delete account error:', err);
            setError(err.message || 'Failed to delete account. Please try again.');

        } finally {
            setIsDeleting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
                <button
                    onClick={onClose}
                    disabled={isDeleting}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Delete Account</h2>
                </div>

                <div className="space-y-4 mb-6">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-red-800 font-semibold mb-2">⚠️ This action cannot be undone!</p>
                        <p className="text-red-700 text-sm">
                            Deleting your account will permanently remove:
                        </p>
                        <ul className="text-red-700 text-sm mt-2 space-y-1 list-disc list-inside">
                            <li>All your scan history</li>
                            <li>Your reading list and imported books</li>
                            <li>Your account information</li>
                            <li>Any saved preferences</li>
                        </ul>
                    </div>

                    <div>
                        <p className="text-gray-700 mb-2">
                            Account: <span className="font-semibold">{userEmail}</span>
                        </p>
                        <p className="text-gray-600 text-sm mb-3">
                            Your data will be permanently deleted within 30 days.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Type <span className="font-bold text-red-600">{CONFIRM_TEXT}</span> to confirm:
                        </label>
                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                            placeholder="Type DELETE"
                            disabled={isDeleting}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-red-700 text-sm">{error}</p>
                        </div>
                    )}
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isDeleting}
                        className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={!isConfirmValid || isDeleting}
                        className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isDeleting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-4 h-4" />
                                Delete Account
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DeleteAccountModal;
