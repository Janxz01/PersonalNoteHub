import React from 'react';

interface MarkdownRendererProps {
  text: string;
  className?: string;
}

export function MarkdownRenderer({ text, className = '' }: MarkdownRendererProps) {
  // Process the text to convert markdown to HTML
  const renderMarkdown = (content: string) => {
    if (!content) return '';
    
    // Process bold text (**text**)
    let processed = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Process italic text (*text*)
    processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Process underline (__text__)
    processed = processed.replace(/__(.*?)__/g, '<u>$1</u>');
    
    // Process headings (# Heading)
    processed = processed.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
    processed = processed.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    processed = processed.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    
    // Process bullet lists (- item)
    processed = processed.replace(/^- (.*?)$/gm, '<li>$1</li>');
    // Wrap li elements in ul tags (without using s flag which might not be supported)
    processed = processed.replace(/(<li>.*?<\/li>)/g, '<ul>$1</ul>');
    
    // Convert newlines to <br>
    processed = processed.replace(/\n/g, '<br />');
    
    return processed;
  };

  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  );
}