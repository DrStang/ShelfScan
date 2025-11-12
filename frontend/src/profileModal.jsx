import React, { useState } from 'react';
import {X, Trash2, AlertTriangle, Key, LogOut } from 'lucide-react';
import PwChangeModal from './PwChangeModal';
import DeleteAccountModal from './DeleteAccountModal';
import { useAuth } from './AuthContext';



const profileModal = ({isOpen, onClose}) => {
  if (!isOpen) return null; 

  const [showPwChangeModal, setShowPwChangeModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  
  const {user, signOut, session } = useAuth();
  const API_URL = process.env.REACT_APP_API_URL

  const handleSignOut = async () => {
    await signOut();
  };
  const handleDeleteAccount = async () => {
    try {
      const token = session?.access_token;
      if (!token) {
        throw new Error('Not Authenticated');
      }
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/delete-account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account');
      }

      await signOut();
      setShowDeleteAccountModal(false);

      alert('Your account has been scheduled for deletion. All data will be permanently removed.');
    } catch(err) {
      console.error('Delete account error:', err);
      throw err;
    }  
  };
  
  return (
    <>
    <div
      className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative transform transition-all overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Signed in as</p>
            <p className="font-semibold text-gray-800">{user.email}</p>
          </div>
          <button
            onClick={() => setShowPwChangeModal(true)}
            className="p-2 px-4 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors flex items-center gap-1.5"
            title="Change Password"
          >
            <Key className="w-4 h-4" />
            <span className="inline text-sm">Change Password</span>
          </button>
          <button
            onClick={() => setShowDeleteAccountModal(true)}
            className="w-full px-4 py-3 bg-red-50 text-red-600 rounded-full font-semibold hover:bg-red-100 transition-colors active:scale-95 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Account
          </button>
          <button
            onClick={handleSignOut}
            className="p-2 sm:px-3 sm:py-2 lg:px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden lg:inline text-sm">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
    <PwChangeModal
      isOpen={showPwChangeModal}
      onClose={() => setShowPwChangeModal(false)}
    />
    <DeleteAccountModal
      isOpen={showDeleteAccountModal}
      onClose={() => setShowDeleteAccountModal(false)}
      onConfirmDelete={handleDeleteAccount}
      userEmail={user?.email}
    />
    </>
  );
}  

export default profileModal;
          
          
