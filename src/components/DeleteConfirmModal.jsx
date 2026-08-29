import React from 'react';

function DeleteConfirmModal({ itemType, itemName, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full border">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-semibold text-red-600">Bekreft sletting</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-4">
          <p className="text-gray-700">
            Er du sikker på at du vil slette {itemType} <strong>{itemName}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            Denne handlingen kan ikke angres.
          </p>

          <div className="flex gap-2 pt-4 border-t">
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-red-600 text-white rounded border border-red-600 hover:bg-red-700 flex-1"
            >
              Ja, slett
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded border hover:bg-gray-300 flex-1"
            >
              Avbryt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmModal;