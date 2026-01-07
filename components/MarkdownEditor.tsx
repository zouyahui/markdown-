import React, { useRef, useEffect } from 'react';
import Editor, { OnMount, useMonaco } from '@monaco-editor/react';

interface MarkdownEditorProps {
  content: string;
  onChange: (value: string) => void;
  onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
  editorRefProp?: React.MutableRefObject<any>; // To expose the editor instance to parent
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ content, onChange, onScroll, editorRefProp }) => {
  const monaco = useMonaco();
  
  // Configure loader to use a fast CDN for the worker files
  useEffect(() => {
    if (monaco) {
      // Custom theme or settings can go here
      monaco.editor.defineTheme('winmd-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#1e1e1e',
        }
      });
    }
  }, [monaco]);

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    if (editorRefProp) {
      editorRefProp.current = editor;
    }

    // Scroll Listener
    editor.onDidScrollChange((e) => {
        if (onScroll && e.scrollTopChanged) {
            const model = editor.getModel();
            if (model) {
               // We use the editor's layout info to determine percentages
               const layoutInfo = editor.getLayoutInfo();
               const scrollHeight = editor.getScrollHeight();
               const scrollTop = editor.getScrollTop();
               onScroll(scrollTop, scrollHeight, layoutInfo.height);
            }
        }
    });

    // --- Keybindings ---
    
    // Bold: Ctrl+B / Cmd+B
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyB, () => {
        const selection = editor.getSelection();
        if (selection) {
            const text = editor.getModel()?.getValueInRange(selection) || "";
            const newText = `**${text}**`;
            editor.executeEdits('bold', [{ range: selection, text: newText }]);
            // Optional: Adjust cursor if text was empty
        }
    });

    // Italic: Ctrl+I / Cmd+I
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyI, () => {
        const selection = editor.getSelection();
        if (selection) {
            const text = editor.getModel()?.getValueInRange(selection) || "";
            const newText = `*${text}*`;
            editor.executeEdits('italic', [{ range: selection, text: newText }]);
        }
    });

    // Save: Ctrl+S (Bubble up event manually since Monaco captures it)
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
        // Dispatch a custom event or let the browser handle it if not prevented.
        // But getting Monaco to *not* prevent default on Ctrl+S is hard.
        // We trigger a custom DOM event that App.tsx can listen to on the window
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, metaKey: true, bubbles: true }));
    });
  };

  return (
    <div className="h-full w-full bg-[#1e1e1e] flex flex-col overflow-hidden">
      <Editor
        height="100%"
        defaultLanguage="markdown"
        value={content}
        theme="vs-dark" // Use built-in dark theme which is very reliable
        onChange={(value) => onChange(value || '')}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false }, // Cleaner look for writing
          wordWrap: 'on',
          fontSize: 14,
          fontFamily: "'Segoe UI', Consolas, 'Courier New', monospace",
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 20, bottom: 20 },
          renderLineHighlight: 'none',
          contextmenu: true,
          scrollbar: {
            vertical: 'visible',
            horizontal: 'hidden',
            useShadows: false,
            verticalScrollbarSize: 10
          }
        }}
      />
    </div>
  );
};