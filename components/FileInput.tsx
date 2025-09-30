
import React, { useRef } from 'react';
import { IconUpload } from './Icons';

interface FileInputProps {
  onFilesSelected: (files: FileList | null) => void;
  disabled?: boolean;
}

export const FileInput: React.FC<FileInputProps> = ({ onFilesSelected, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilesSelected(event.target.files);
    // Reset input value to allow selecting the same file(s) again if needed
    if (event.target) {
        event.target.value = '';
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        multiple
        // @ts-ignore because webkitdirectory is non-standard but widely supported
        webkitdirectory=""
        directory=""
        accept=".pdf"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
      <button
        onClick={triggerFileInput}
        disabled={disabled}
        className="w-full bg-slate-700 hover:bg-slate-600 disabled:bg-slate-500 disabled:cursor-not-allowed text-sky-300 font-semibold py-4 px-6 rounded-lg border-2 border-dashed border-slate-600 hover:border-sky-500 transition-all duration-150 ease-in-out flex flex-col items-center justify-center"
      >
        <IconUpload className="h-10 w-10 mb-2 text-sky-400" />
        <span>Klicka för att välja mapp med PDF-kvitton</span>
        <span className="text-xs text-slate-400 mt-1">Eller dra och släpp (funktion kan variera)</span>
      </button>
    </div>
  );
};
