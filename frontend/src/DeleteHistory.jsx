import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';

function DeleteHistory({ scan, onDelete }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      await onDelete(scan.id);
    } catch (error) {
      console.error('Error deleting scan:', error);
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false); 
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">Delete Scan?</h3>
        </div>
  
          <p className="text-gray-600 mb-6">
          This scan from {new Date(scan.created_at).toLocaleDateString()} with{' '}
          {scan.books.length} book{scan.books.length !== 1 ? 's' : ''} will be permanently deleted.
          </p>
  
        <div className="flex gap-3">
          <button
            onClick={handleCancelDelete}
            disabled={isDeleting}
            className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
                <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"> </div>
                    Deleting...
                </>
            ) : (
                <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}  

export default DeleteHistory;
  
