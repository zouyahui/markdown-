import React, { forwardRef, useEffect, useState, isValidElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import mermaid from 'mermaid';

interface MarkdownViewerProps {
  content: string;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

// Mermaid Chart Component
const MermaidChart = ({ chart }: { chart: string }) => {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    const renderChart = async () => {
        try {
            mermaid.initialize({ startOnLoad: false, theme: 'dark', darkMode: true });
            const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
            // Mermaid render returns { svg, bindFunctions } in v10
            const { svg } = await mermaid.render(id, chart);
            setSvg(svg);
            setError(false);
        } catch (err) {
            console.error("Mermaid render error:", err);
            setError(true);
        }
    };
    renderChart();
  }, [chart]);

  if (error) {
      return (
          <div className="bg-red-900/20 border border-red-800 text-red-200 p-2 text-xs font-mono rounded">
              Invalid Mermaid Syntax
          </div>
      );
  }

  return (
      <div 
        className="mermaid-container"
        dangerouslySetInnerHTML={{ __html: svg }} 
      />
  );
};

// Helper to safely extract text from React children
const extractText = (node: any): string => {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (isValidElement(node)) {
      return extractText((node.props as any).children);
  }
  return '';
};

export const MarkdownViewer = forwardRef<HTMLDivElement, MarkdownViewerProps>(({ content, onScroll }, ref) => {
  if (!content) {
    return (
      <div className="h-full w-full flex-1 flex items-center justify-center text-gray-500 select-none bg-[#1e1e1e]">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#2d2d2d] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p>Select a file to preview content</p>
        </div>
      </div>
    );
  }

  return (
    <div 
        ref={ref}
        onScroll={onScroll}
        className="h-full flex-1 w-full overflow-y-auto px-8 py-8 bg-[#1e1e1e] scroll-smooth"
    >
      <div className="w-full max-w-none markdown-body">
        <ReactMarkdown 
            remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
                code(props: any) {
                    const {node, inline, className, children, ...rest} = props;
                    const match = /language-(\w+)/.exec(className || '');
                    const isMermaid = match && match[1] === 'mermaid';
                    
                    // Safely extract text from children
                    const value = extractText(children).replace(/\n$/, '');

                    if (!inline && isMermaid) {
                        return <MermaidChart chart={value} />;
                    }

                    if (!inline && match) {
                        return (
                            <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                customStyle={{ margin: 0, padding: 0, background: 'transparent' }}
                                codeTagProps={{ style: { fontFamily: 'inherit' } }}
                                {...(rest as any)} 
                            >
                                {value}
                            </SyntaxHighlighter>
                        );
                    }

                    return (
                        <code className={className} {...rest}>
                            {children}
                        </code>
                    );
                }
            }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
});

MarkdownViewer.displayName = 'MarkdownViewer';