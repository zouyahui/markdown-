import React, { forwardRef, useEffect, useState, isValidElement, useMemo, useRef, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import mermaid from 'mermaid';
import { Language } from '../types';
import { translations } from '../translations';

interface MarkdownViewerProps {
  content: string;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  language?: Language;
}

// Initialize Mermaid Globally Once
if (typeof window !== 'undefined') {
    mermaid.initialize({ 
        startOnLoad: false, 
        theme: 'dark', 
        darkMode: true,
        securityLevel: 'loose' 
    });
}

// Mermaid Chart Component
// Wrapped in memo to prevent re-renders when parent re-renders if chart prop hasn't changed
const MermaidChart = memo(({ chart }: { chart: string }) => {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);
  const containerId = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`).current;

  useEffect(() => {
    let isMounted = true;
    let timeoutId: any;

    const render = async () => {
        if (!chart) return;
        
        try {
            // Attempt to parse first to avoid errors appearing in console if possible
            // but mermaid.parse is async in some versions, or we just rely on render throwing.
            
            const { svg } = await mermaid.render(containerId, chart);
            
            if (isMounted) {
                setSvg(svg);
                setError(false);
            }
        } catch (err) {
            // console.debug("Mermaid render error (likely syntax)", err);
            if (isMounted) {
                setError(true);
            }
        }
    };

    // Debounce rendering to avoid thrashing while typing
    timeoutId = setTimeout(render, 500);

    return () => {
        isMounted = false;
        clearTimeout(timeoutId);
    };
  }, [chart, containerId]);

  if (error) {
      return (
          <div className="bg-[#2d2d2d] border-l-2 border-yellow-600 text-gray-400 p-2 text-xs font-mono rounded-r opacity-80 my-2 whitespace-pre-wrap">
              {chart}
              <div className="mt-1 text-yellow-600 opacity-50 italic">Diagram syntax error</div>
          </div>
      );
  }

  if (!svg) {
      return (
          <div className="bg-[#1e1e1e] p-4 rounded-lg flex justify-center opacity-50">
             <span className="text-xs text-gray-500">Rendering diagram...</span>
          </div>
      );
  }

  return (
      <div 
        className="mermaid-container"
        dangerouslySetInnerHTML={{ __html: svg }} 
      />
  );
}, (prev, next) => prev.chart === next.chart);

MermaidChart.displayName = 'MermaidChart';

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

// Define plugins outside to keep references stable
const REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkMath];
const REHYPE_PLUGINS = [rehypeKatex];

export const MarkdownViewer = forwardRef<HTMLDivElement, MarkdownViewerProps>(({ content, onScroll, language = 'en' }, ref) => {
  
  const t = translations[language].viewer;

  // Memoize components to prevent re-creation on every render
  const components = useMemo(() => ({
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
  }), []);

  if (!content) {
    return (
      <div className="h-full w-full flex-1 flex items-center justify-center text-gray-500 select-none bg-[#1e1e1e]">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#2d2d2d] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p>{t.selectFile}</p>
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
            remarkPlugins={REMARK_PLUGINS}
            rehypePlugins={REHYPE_PLUGINS}
            components={components}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
});

MarkdownViewer.displayName = 'MarkdownViewer';
