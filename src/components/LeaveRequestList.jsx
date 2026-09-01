import React from 'react';

function LeaveRequestList({ requests, onApprove, onReject, onDelete, currentUser }) {
  const getStatusColor = (status) => {
    const colors = {
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status) => {
    const texts = {
      approved: 'Godkjent',
      rejected: 'Avslått',
      pending: 'Venter'
    };
    return texts[status] || status;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('no-NO', {
      timeZone: 'Europe/Oslo',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const filteredRequests = currentUser?.isAdmin
    ? requests
    : requests.filter(req => req.employeeId === currentUser?.id);

  if (filteredRequests.length === 0) {
    return (
      <div className="bg-white p-4 rounded border m-4">
        <p className="text-gray-500">Ingen forespørsler funnet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded border m-4">
      <div className="p-4 border-b">
        <h3 className="font-semibold">
          {currentUser?.isAdmin ? 'Alle forespørsler' : 'Mine forespørsler'}
        </h3>
      </div>
      
      <div className="divide-y">
        {filteredRequests.map((req) => (
          <div key={req.id} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(req.status)}`}>
                  {getStatusText(req.status)}
                </span>
                <span className="font-medium">{req.employeeName}</span>
                <span className="text-sm text-gray-500">{formatDate(req.createdAt)}</span>
              </div>
              
              {currentUser?.isAdmin && req.status === 'pending' && (
                <div className="flex gap-1">
                  <button onClick={() => onApprove(req.id, currentUser?.id, req.type)}
                    className="px-3 py-1 bg-green-600 text-white text-xs rounded">
                    Godkjenn
                  </button>
                  <button onClick={() => onReject(req.id, currentUser?.id, req.type)}
                    className="px-3 py-1 bg-red-600 text-white text-xs rounded">
                    Avslå
                  </button>
                </div>
              )}
            </div>

            <div className="ml-6 text-sm">
              <p><strong>Type:</strong> {req.type === 'leave' ? 'Fridag' : 'Bytte av vakt'}</p>
              
              {req.type === 'leave' ? (
                <p><strong>Dato:</strong> {formatDate(req.date)}
                  {req.endDate && req.endDate !== req.date && ` - ${formatDate(req.endDate)}`}
                </p>
              ) : (
                <>
                  <p><strong>Fra:</strong> {formatDate(req.originalDate)}</p>
                  <p><strong>Bytte med:</strong> {req.targetEmployeeName}</p>
                  <p><strong>Til:</strong> {formatDate(req.targetDate)}</p>
                </>
              )}
              
              {req.reason && <p><strong>Årsak:</strong> {req.reason}</p>}
            </div>

            {currentUser?.isAdmin && req.status !== 'pending' && (
              <div className="mt-2 ml-6">
                <button onClick={() => onDelete(req.id)}
                  className="px-3 py-1 bg-gray-200 text-xs rounded">
                  Slett
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default LeaveRequestList;
