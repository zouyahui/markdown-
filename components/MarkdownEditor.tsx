import React from 'react';

interface MarkdownEditorProps {
  content: string;
  onChange: (value: string) => void;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ content, onChange }) => {
  return (
    <div className="h-full w-full bg-[#1e1e1e] flex flex-col">
      <textarea
        className="flex-1 w-full bg-[#1e1e1e] text-gray-200 p-8 font-mono text-sm resize-none focus:outline-none focus:ring-0 border-none leading-relaxed"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder="Start typing your markdown here..."
      />
    </div>
  );
};
