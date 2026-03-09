import React from 'react';
import { cn } from '../../utils/cn';

interface FormattedAiResponseProps {
  content: string;
  className?: string;
}

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function isOrderedList(lines: string[]) {
  return lines.every((line) => /^\d+\.\s+/.test(line));
}

function isBulletList(lines: string[]) {
  return lines.every((line) => /^[-*•]\s+/.test(line));
}

export function FormattedAiResponse({ content, className }: FormattedAiResponseProps) {
  const blocks = content
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className={cn('space-y-3 text-sm leading-6', className)}>
      {blocks.map((block, blockIndex) => {
        const lines = block
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        if (lines.length === 0) {
          return null;
        }

        if (isOrderedList(lines)) {
          return (
            <ol key={blockIndex} className="list-decimal space-y-2 pl-5">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{renderInline(line.replace(/^\d+\.\s+/, ''))}</li>
              ))}
            </ol>
          );
        }

        if (isBulletList(lines)) {
          return (
            <ul key={blockIndex} className="list-disc space-y-2 pl-5">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{renderInline(line.replace(/^[-*•]\s+/, ''))}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={blockIndex} className="whitespace-pre-wrap">
            {renderInline(lines.join('\n'))}
          </p>
        );
      })}
    </div>
  );
}

export default FormattedAiResponse;
