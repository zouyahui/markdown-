import React, { useRef, useEffect } from 'react';
import Editor, { OnMount, useMonaco, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Configure Monaco to use local source instead of CDN
loader.config({ monaco });

interface MarkdownEditorProps {
  content: string;
  onChange: (value: string) => void;
  onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
  editorRefProp?: React.MutableRefObject<any>; // To expose the editor instance to parent
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ content, onChange, onScroll, editorRefProp }) => {
  const monacoInstance = useMonaco();
  
  useEffect(() => {
    if (monacoInstance) {
      // Custom theme or settings can go here
      monacoInstance.editor.defineTheme('winmd-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#1e1e1e',
        }
      });
      // 确保主题被应用
      monacoInstance.editor.setTheme('winmd-dark');
    }
  }, [monacoInstance]);

  const handleEditorDidMount: OnMount = (editor, monacoObj) => {
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
    editor.addCommand(monacoObj.KeyMod.CtrlCmd | monacoObj.KeyCode.KeyB, () => {
        const selection = editor.getSelection();
        if (selection) {
            const text = editor.getModel()?.getValueInRange(selection) || "";
            const newText = `**${text}**`;
            editor.executeEdits('bold', [{ range: selection, text: newText }]);
        }
    });

    // Italic: Ctrl+I / Cmd+I
    editor.addCommand(monacoObj.KeyMod.CtrlCmd | monacoObj.KeyCode.KeyI, () => {
        const selection = editor.getSelection();
        if (selection) {
            const text = editor.getModel()?.getValueInRange(selection) || "";
            const newText = `*${text}*`;
            editor.executeEdits('italic', [{ range: selection, text: newText }]);
        }
    });

    // Save: Ctrl+S (Bubble up event manually since Monaco captures it)
    editor.addCommand(monacoObj.KeyMod.CtrlCmd | monacoObj.KeyCode.KeyS, () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, metaKey: true, bubbles: true }));
    });

    // Fix: Explicitly handle Paste (Ctrl+V) for Electron environment
    editor.addCommand(monacoObj.KeyMod.CtrlCmd | monacoObj.KeyCode.KeyV, () => {
        editor.focus();
        
        const insertText = (text: string) => {
            if (!text) return;
            const selection = editor.getSelection();
            if (selection) {
                editor.executeEdits('paste', [{ 
                    range: selection, 
                    text: text, 
                    forceMoveMarkers: true 
                }]);
            }
        };

        // Attempt 1: Electron Native Clipboard (Synchronous, Reliable)
        try {
            // @ts-ignore
            if (typeof window !== 'undefined' && window.require) {
                // @ts-ignore
                const { clipboard } = window.require('electron');
                const text = clipboard.readText();
                insertText(text);
                return;
            }
        } catch (e) {
            // Check if we are in a true browser environment vs broken Electron
            console.debug('Electron clipboard access failed:', e);
        }

        // Attempt 2: Navigator Clipboard API (Async, Permission-gated)
        if (navigator.clipboard && navigator.clipboard.readText) {
            navigator.clipboard.readText()
                .then(insertText)
                .catch(err => {
                    console.warn('Browser clipboard access denied. Falling back to native behavior or user must use Menu > Paste.', err);
                });
        }
    });
  };

  return (
    <div className="h-full w-full bg-[#1e1e1e] flex flex-col overflow-hidden text-left">
      <Editor
        height="100%"
        defaultLanguage="markdown"
        value={content}
        theme="vs-dark" // Use built-in dark theme initially, useEffect will upgrade it
        onChange={(value) => onChange(value || '')}
        onMount={handleEditorDidMount}
        loading={
            <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0078d4]"></div>
                <div className="text-xs">Loading Editor...</div>
            </div>
        }
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
          fixedOverflowWidgets: true,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
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