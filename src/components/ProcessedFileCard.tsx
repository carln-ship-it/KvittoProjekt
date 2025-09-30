import React from 'react';
import type { ProcessedFile, ReceiptItem } from '../types';
import { Spinner } from './Spinner';
import { IconCheckCircle, IconXCircle, IconClock, IconFileText, IconCalendar, IconStore, IconList, IconCurrencyDollar, IconPercentage, IconHourglass } from './Icons';

interface ProcessedFileCardProps {
  processedFile: ProcessedFile;
}

const ItemRow: React.FC<{ item: ReceiptItem, index: number }> = ({ item, index }) => (
  <tr className={`${index % 2 === 0 ? 'bg-slate-700/50' : 'bg-slate-650/50'}`}>
    <td className="px-3 py-2 text-sm text-slate-300">{item.description || 'Okänd vara'}</td>
    <td className="px-3 py-2 text-sm text-slate-300 text-center">{item.quantity ?? 'N/A'}</td>
    <td className="px-3 py-2 text-sm text-slate-300 text-right">{item.price?.toFixed(2) ?? 'N/A'}</td>
  </tr>
);

export const ProcessedFileCard: React.FC<ProcessedFileCardProps> = ({ processedFile }) => {
  const { fileName, status, data, error } = processedFile;

  const renderStatusIcon = () => {
    if (status === 'queued') return <IconHourglass className="h-5 w-5 text-slate-400" />;
    if (status === 'pending' || status === 'processing') return <Spinner className="h-5 w-5 text-sky-400" />;
    if (status === 'success') return <IconCheckCircle className="h-5 w-5 text-emerald-400" />;
    if (status === 'error') return <IconXCircle className="h-5 w-5 text-red-400" />;
    return null;
  };
  
  const statusTextMap = {
    queued: 'Köad',
    pending: 'Väntar...',
    processing: 'Bearbetar...',
    success: 'Slutförd',
    error: 'Fel',
  };
   const statusColorMap = {
    queued: 'text-slate-400',
    pending: 'text-sky-400',
    processing: 'text-sky-400',
    success: 'text-emerald-400',
    error: 'text-red-400',
  };

  return (
    <div className="bg-slate-750 shadow-lg rounded-lg p-4 transition-all duration-300 ease-in-out">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center space-x-2 min-w-0">
          <IconFileText className="h-5 w-5 text-slate-400 flex-shrink-0" />
          <h3 className="font-medium text-slate-200 truncate" title={fileName}>{fileName}</h3>
        </div>
        <div className="flex items-center space-x-2 text-sm flex-shrink-0 ml-2">
          {renderStatusIcon()}
          <span className={`font-semibold ${statusColorMap[status]}`}>
            {statusTextMap[status]}
          </span>
        </div>
      </div>

      {status === 'success' && data && (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center space-x-2 p-2 bg-slate-700 rounded">
              <IconCalendar className="h-4 w-4 text-sky-400"/>
              <span className="text-slate-400">Datum:</span>
              <span className="text-slate-200 font-medium">{data.date || 'N/A'}</span>
            </div>
            <div className="flex items-center space-x-2 p-2 bg-slate-700 rounded">
              <IconStore className="h-4 w-4 text-sky-400"/>
              <span className="text-slate-400">Butik:</span>
              <span className="text-slate-200 font-medium truncate" title={data.storeName || 'N/A'}>{data.storeName || 'N/A'}</span>
            </div>
          </div>
          
          {data.items && data.items.length > 0 && (
            <div className="mt-2">
              <h4 className="text-md font-semibold text-slate-300 mb-1 flex items-center space-x-1"><IconList className="h-4 w-4" /><span>Varor:</span></h4>
              <div className="max-h-48 overflow-y-auto rounded border border-slate-600">
                <table className="w-full">
                  <thead className="bg-slate-800">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Beskrivning</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Antal</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Pris</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item, index) => (
                      <ItemRow key={index} item={item} index={index} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3">
              <div className="flex items-start space-x-2 p-2 bg-slate-700 rounded col-span-1">
                  <IconPercentage className="h-4 w-4 text-sky-400 flex-shrink-0 mt-0.5"/>
                  <div className="flex flex-col">
                      <span className="text-xs text-slate-400">Moms</span>
                      <span className="text-slate-200 font-medium">
                          {data.vatAmount !== null ? `${data.vatAmount.toFixed(2)} ${data.currency || ''}`.trim() : 'N/A'}
                      </span>
                  </div>
              </div>
              <div className="flex items-start space-x-2 p-2 bg-slate-700 rounded col-span-1">
                  <IconCurrencyDollar className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5"/>
                  <div className="flex flex-col">
                      <span className="text-xs text-slate-400">Totalbelopp</span>
                      <span className="text-emerald-300 font-bold text-base">
                          {data.totalAmount !== null ? `${data.totalAmount.toFixed(2)} ${data.currency || ''}`.trim() : 'N/A'}
                      </span>
                  </div>
              </div>
          </div>
        </div>
      )}

      {status === 'error' && error && (
        <div className="p-3 bg-red-900/30 rounded text-red-300 text-sm">
          <p><strong>Fel:</strong> {error}</p>
        </div>
      )}
    </div>
  );
};