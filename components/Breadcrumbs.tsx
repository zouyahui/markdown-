import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { FileDoc } from '../types';

interface BreadcrumbsProps {
  file: FileDoc;
  allFiles: FileDoc[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ file, allFiles }) => {
  // Build path: File -> Parent Folder -> ... -> Root
  const path: FileDoc[] = [file];
  let current = file;
  
  while (current.parentId) {
    const parent = allFiles.find(f => f.id === current.parentId);
    if (parent) {
      path.unshift(parent);
      current = parent;
    } else {
      break;
    }
  }

  return (
    <div className="flex items-center space-x-1 text-xs text-gray-500 px-2 py-1 select-none overflow-hidden whitespace-nowrap">
      <Home size={12} className="text-gray-400" />
      <ChevronRight size={12} className="text-gray-600" />
      
      {path.map((item, index) => (
        <React.Fragment key={item.id}>
            <span className={`hover:text-gray-300 cursor-pointer ${index === path.length - 1 ? 'font-medium text-gray-300' : ''}`}>
                {item.name}
            </span>
            {index < path.length - 1 && (
                <ChevronRight size={12} className="text-gray-600" />
            )}
        </React.Fragment>
      ))}
    </div>
  );
};