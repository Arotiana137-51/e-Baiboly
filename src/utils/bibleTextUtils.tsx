import React from 'react';
import { Text } from 'react-native';
// The reader's spans: inside a selectable iOS verse they must be the lib's
// own; anywhere else it renders a plain <Text>.
import { UITextView } from '@bsky.app/react-native-uitextview';
import { parseInlineBibleRefs, type InlineBibleRef } from './bibleRefs';
import { SPAN_LONG_PRESS } from './verseSelection';

const INLINE_ITALIC_START = '\u0002';
const INLINE_ITALIC_END = '\u0003';
const BLOCK_ITALIC_PREFIX = '\u0004';

export const normalizeTextPreservingMarkers = (input: string) => {
  if (!input) {
    return '';
  }

  // Temporarily replace markers so regexes can't accidentally move/remove them.
  const START = '__ITALIC_START__';
  const END = '__ITALIC_END__';

  let s = input
    .replaceAll(INLINE_ITALIC_START, START)
    .replaceAll(INLINE_ITALIC_END, END);

  // Comprehensive text normalization based on best practices:

  // 1. Normalize whitespace: collapse tabs/spaces to single space
  s = s.replace(/[\t\f\v]+/g, ' ');

  // 2. Remove duplicate spaces
  s = s.replace(/[ ]{2,}/g, ' ');

  // 3. Trim whitespace from start and end
  s = s.trim();

  // 4. Remove space before punctuation (but preserve after for readability)
  s = s.replace(/\s+([,.;:!?])/g, '$1');

  // 4b. Ensure exactly one space AFTER punctuation when followed by a letter/number.
  // Example: "teny,izany" -> "teny, izany"
  // (We run this before quote/paren normalization, then collapse spaces later.)
  // NOTE: Avoid \p{..} for compatibility with Hermes/older JS runtimes.
  s = s.replace(/([,.;:!?])(?=[A-Za-z0-9À-ÿ])/g, '$1 ');

  // 5. Normalize quotes and apostrophes spacing
  // Remove space before closing quotes/apostrophes
  s = s.replace(/\s+([»"'])/g, '$1');
  // Add space after opening quotes/apostrophes if missing
  s = s.replace(/([«"'])(?![ \n])/g, '$1 ');

  // 5b. Remove spaces around apostrophes inside words.
  // Example: "an ' i" -> "an'i" (common in Malagasy)
  s = s.replace(/([A-Za-zÀ-ÿ])\s*'\s*([A-Za-zÀ-ÿ])/g, "$1'$2");

  // 6. Normalize parentheses and brackets spacing
  s = s.replace(/\s*\(\s*/g, ' (');
  s = s.replace(/\s*\)\s*/g, ') ');
  s = s.replace(/\s*\[\s*/g, ' [');
  s = s.replace(/\s*\]\s*/g, '] ');

  // 6b. Remove spaces around hyphens inside words.
  // Example: "roa - polo" -> "roa-polo"
  s = s.replace(/([A-Za-zÀ-ÿ])\s*-\s*([A-Za-zÀ-ÿ])/g, '$1-$2');

  // 7. Clean up any double spaces that might have been created
  s = s.replace(/[ ]{2,}/g, ' ');

  // 8. Remove trailing/leading spaces around line breaks
  s = s.replace(/\s*\n\s*/g, '\n');

  // 8b. Ensure blank line before list items starting with -
  s = s.replace(/([),.])\n\n- /g, '$1\n\n\n- ');

  // 9. Remove multiple consecutive empty lines, but preserve triple newlines for list spacing
  s = s.replace(/\n{4,}/g, '\n\n');

  // 10. Normalize numbers and percentages
  s = s.replace(/(\d)\s*%\s*/g, '$1%');

  // 11. Clean up any remaining problematic characters
  s = s.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' '); // Various space characters

  // Re-collapse spaces after unicode-space replacement and punctuation/quote tweaks.
  s = s.replace(/[ ]{2,}/g, ' ');

  // Final cleanup
  s = s.trim();

  // Restore markers
  s = s
    .replaceAll(START, INLINE_ITALIC_START)
    .replaceAll(END, INLINE_ITALIC_END);

  return s;
};

/**
 * Processes Bible text and returns formatted lines with metadata about which lines should be italic
 * This is the main function that should be used for Bible text processing
 */
const processBibleTextWithMetadataInternal = (
  text: string,
  options: { bracketMode: 'strict_n' | 'all' }
): { lines: string[]; italicLines: Set<number> } => {
  if (typeof text !== 'string') {
    return { lines: [], italicLines: new Set() };
  }

  // 1) Convert the specific marker <n>[ ... ]</n> into its own line, mark as block-italic,
  //    and remove the brackets.
  const withBlockItalic = text.replace(
    /<\s*n\s*>\s*\[(.*?)\]\s*<\s*\/\s*n\s*>/gis,
    (match, content) => `\n${BLOCK_ITALIC_PREFIX}${String(content).trim()}\n`
  );

  // 2) Convert other <n>...</n> to inline-italic markers.
  const withInlineItalics = withBlockItalic.replace(
    /<\s*n\s*>(.*?)<\s*\/\s*n\s*>/gis,
    `${INLINE_ITALIC_START}$1${INLINE_ITALIC_END}`
  );

  const withOptionalBracketBlocks =
    options.bracketMode === 'all'
      ? withInlineItalics.replace(
          /\[([^\]]+)\]/g,
          (match, content) => `\n${BLOCK_ITALIC_PREFIX}${String(content).trim()}\n`
        )
      : withInlineItalics;

  // 3) Convert other HTML tags to newlines.
  const withLineBreaks = withOptionalBracketBlocks
    .replace(/<\s*br\s*\/\s*>/gi, '\n')
    .replace(/<\s*br\s*>/gi, '\n')
    .replace(/<\s*\/\s*p\s*>/gi, '\n')
    .replace(/<\s*p\s*>/gi, '\n');

  // 4) Strip remaining tags.
  const stripped = withLineBreaks.replace(/<[^>]*>/g, ' ');

  // 5) Normalize whitespace, but keep our markers intact.
  const cleaned = stripped
    .replace(/\r\n/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const rawLines = cleaned.length > 0 ? cleaned.split('\n') : [];
  const lines: string[] = [];
  const italicLines = new Set<number>();

  rawLines.forEach(raw => {
    const trimmed = normalizeTextPreservingMarkers(raw);
    if (!trimmed) {
      return;
    }
    if (trimmed.startsWith(BLOCK_ITALIC_PREFIX)) {
      const content = normalizeTextPreservingMarkers(
        trimmed.slice(BLOCK_ITALIC_PREFIX.length)
      );
      if (!content) {
        return;
      }
      const idx = lines.length;
      lines.push(content);
      italicLines.add(idx);
      return;
    }

    lines.push(trimmed);
  });

  return { lines, italicLines };
};

export const processBibleTextWithMetadata = (text: string): { lines: string[]; italicLines: Set<number> } => {
  return processBibleTextWithMetadataInternal(text, { bracketMode: 'strict_n' });
};

export const processBibleTextWithMetadataForReader = (text: string): { lines: string[]; italicLines: Set<number> } => {
  return processBibleTextWithMetadataInternal(text, { bracketMode: 'strict_n' });
};

export const flattenBibleTextForReader = (text: string): string => {
  if (typeof text !== 'string' || !text) {
    return '';
  }

  const { lines, italicLines } = processBibleTextWithMetadataForReader(text);
  if (lines.length === 0) {
    return '';
  }

  // Keep block-italic lines (formerly bracketed blocks) on their own lines; everything else flows.
  let out = '';
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) {
      continue;
    }

    if (italicLines.has(i)) {
      if (out && !out.endsWith('\n')) {
        out += '\n';
      }
      out += line.trim() + '\n';
      continue;
    }

    if (out && !out.endsWith('\n')) {
      out += ' ';
    }
    out += line.trim();
  }

  return normalizeTextPreservingMarkers(out.replace(/[ ]{2,}/g, ' ').trim());
};

export const extractBracketFootnotes = (
  text: string
): { textWithoutFootnotes: string; footnotes: string[] } => {
  if (typeof text !== 'string' || !text) {
    return { textWithoutFootnotes: '', footnotes: [] };
  }

  const footnotes: string[] = [];
  const regex = /\[\*([^\]]+)\]/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const content = String(match[1] ?? '').trim();
    if (content) {
      footnotes.push(content);
    }
  }

  const textWithoutFootnotes = normalizeTextPreservingMarkers(
    text.replace(regex, '').replace(/[ ]{2,}/g, ' ').trim()
  );

  return { textWithoutFootnotes, footnotes };
};

/**
 * Formats Bible text by handling HTML tags appropriately
 * - <n></n> tags are removed (content will be italicized in render functions)
 * - <br>, </p>, <p> tags become newlines
 * - [bracketed] content gets special treatment: brackets removed, content on separate lines
 * - Other HTML tags are stripped
 * @deprecated Use processBibleTextWithMetadata instead for better bracket handling
 */
export const formatBibleText = (text: string): string => {
  if (typeof text !== 'string') {
    return '';
  }

  // Convert the specific marker <n>[ ... ]</n> to be on separate lines WITHOUT brackets
  const withBracketedLines = text.replace(
    /<\s*n\s*>\s*\[(.*?)\]\s*<\s*\/\s*n\s*>/gis,
    (match, content) => `\n${String(content).trim()}\n`
  );

  // Remove remaining <n> and </n> tags completely (their content will be italicized during rendering)
  const withoutNTags = withBracketedLines
    .replace(/<\s*n\s*>/gi, '')
    .replace(/<\s*\/\s*n\s*>/gi, '');

  // Convert other HTML tags to newlines
  const withLineBreaks = withoutNTags
    .replace(/<\s*br\s*\/\s*>/gi, '\n')
    .replace(/<\s*br\s*>/gi, '\n')
    .replace(/<\s*\/\s*p\s*>/gi, '\n')
    .replace(/<\s*p\s*>/gi, '\n');

  const stripped = withLineBreaks.replace(/<[^>]*>/g, ' ');

  return stripped
    .replace(/\r\n/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Processes text with <n> tags and converts them to italicized segments
 * This function should be called on the original text before formatBibleText
 */
export const processNTags = (text: string): string => {
  if (typeof text !== 'string') {
    return '';
  }

  // Keep this for backward compatibility, but do NOT introduce brackets.
  return text.replace(
    /<\s*n\s*>(.*?)<\s*\/\s*n\s*>/gis,
    `${INLINE_ITALIC_START}$1${INLINE_ITALIC_END}`
  );
};

const renderInlineItalicSegments = (text: string, baseTextStyle?: any) => {
  if (!text) {
    return null;
  }

  const children: React.ReactNode[] = [];
  let i = 0;
  let buffer = '';
  let italic = false;

  const flush = (key: string) => {
    if (!buffer) {
      return;
    }
    children.push(
      <UITextView
        key={key}
        style={italic ? [baseTextStyle, { fontStyle: 'italic' }] : baseTextStyle}
      >
        {buffer}
      </UITextView>
    );
    buffer = '';
  };

  while (i < text.length) {
    const ch = text[i];
    if (ch === INLINE_ITALIC_START) {
      flush(`seg-${i}-n`);
      italic = true;
      i += 1;
      continue;
    }
    if (ch === INLINE_ITALIC_END) {
      flush(`seg-${i}-n`);
      italic = false;
      i += 1;
      continue;
    }
    buffer += ch;
    i += 1;
  }
  flush(`seg-end`);

  return children;
};

/**
 * Renders Bible text with proper handling of italicized lines (formerly bracketed text)
 * Used for displaying Bible verses with italicized content
 * Bracketed content now renders as single italic lines without brackets
 */
export const renderBibleLine = (line: string, baseTextStyle?: any) => {
  // No brackets should ever reach here; only inline-italic markers may exist.
  return renderInlineItalicSegments(line, baseTextStyle);
};

type InlineRefOptions = {
  /** Style applied to the parenthesized ref text. */
  refTextStyle?: any;
  /** Invoked when the user taps an inline ref. */
  onRefPress?: (ref: InlineBibleRef) => void;
};

/**
 * Render a single plain text chunk (no `[*footnote]` markers) with optional
 * Bible-reference linking. Inline italic markers are still honored inside
 * the plain pieces between refs.
 */
const renderPlainWithRefs = (
  text: string,
  options: { baseTextStyle?: any } & InlineRefOptions,
  keyPrefix: string,
): React.ReactNode[] => {
  const {baseTextStyle, refTextStyle, onRefPress} = options;
  // Cheap fast path: if the chunk has no '(' at all it can't contain a ref,
  // so skip the regex split entirely.
  if (!text.includes('(')) {
    return [
      <UITextView key={`${keyPrefix}-nr`} style={baseTextStyle}>
        {renderInlineItalicSegments(text, undefined)}
      </UITextView>,
    ];
  }

  const segments = parseInlineBibleRefs(text);
  return segments.map((seg, idx) => {
    if (seg.kind === 'ref') {
      return (
        <UITextView
          key={`${keyPrefix}-ref-${idx}`}
          // We attach onPress here so React Native treats the segment as a
          // tap target without disrupting the surrounding inline flow.
          onPress={onRefPress ? () => onRefPress(seg) : undefined}
          // A long-press on a selectable verse selects the reference instead
          // of following it on release.
          onLongPress={onRefPress ? SPAN_LONG_PRESS : undefined}
          suppressHighlighting={!onRefPress}
          style={[baseTextStyle, refTextStyle]}>
          {seg.text}
        </UITextView>
      );
    }
    return (
      <UITextView key={`${keyPrefix}-tx-${idx}`} style={baseTextStyle}>
        {renderInlineItalicSegments(seg.text, undefined)}
      </UITextView>
    );
  });
};

const renderInlineFootnoteSegments = (
  text: string,
  options: {
    baseTextStyle?: any;
    footnoteTextStyle?: any;
  } & InlineRefOptions,
) => {
  if (!text) {
    return null;
  }

  const children: React.ReactNode[] = [];
  const regex = /(\[\*[^\]]+\])/g;
  const parts = text.split(regex);

  parts.forEach((part, idx) => {
    if (!part) {
      return;
    }
    const isFootnote = part.startsWith('[*') && part.endsWith(']');
    if (isFootnote) {
      children.push(
        <UITextView key={`fn-${idx}`} style={[options.baseTextStyle, options.footnoteTextStyle]}>
          {renderInlineItalicSegments(part, undefined)}
        </UITextView>
      );
      return;
    }

    // Plain text between footnote markers — still potentially contains
    // parenthesized Bible refs.
    children.push(
      ...renderPlainWithRefs(
        part,
        {
          baseTextStyle: options.baseTextStyle,
          refTextStyle: options.refTextStyle,
          onRefPress: options.onRefPress,
        },
        `tx-${idx}`,
      ),
    );
  });

  return children;
};

export const renderBibleLineForReader = (
  line: string,
  options?: {
    baseTextStyle?: any;
    footnoteTextStyle?: any;
  } & InlineRefOptions,
) => {
  return renderInlineFootnoteSegments(line, {
    baseTextStyle: options?.baseTextStyle,
    footnoteTextStyle: options?.footnoteTextStyle,
    refTextStyle: options?.refTextStyle,
    onRefPress: options?.onRefPress,
  });
};

/**
 * Renders Bible text with search highlighting and <n> tag support
 * Used in search results to highlight matched query terms
 * Bracketed content now renders as single italic lines
 */
export const renderBibleLineWithHighlight = (line: string, searchQuery: string, theme: any) => {
  // Search highlight is kept simple here; VerseListScreen renders pre-split lines.
  // We highlight within non-italic segments only (inline italics remain italic).
  if (!searchQuery) {
    return renderInlineItalicSegments(line, { color: theme.colors.textPrimary });
  }

  const lowerQuery = searchQuery.toLowerCase();
  const raw = line;
  const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const chunks = raw.split(new RegExp(`(${escapedQuery})`, 'gi'));
  return chunks.map((chunk, idx) => {
    const isMatch = chunk.toLowerCase() === lowerQuery;
    return (
      <Text
        key={`hl-${idx}`}
        style={
          isMatch
            ? { color: theme.colors.accentBlue || '#4D96FF', fontWeight: '600' }
            : { color: theme.colors.textPrimary }
        }
      >
        {renderInlineItalicSegments(chunk, undefined)}
      </Text>
    );
  });
};

/**
 * Renders a short Bible preview snippet that respects:
 * - <n>...</n> as inline italics
 * - [bracketed] segments as watermark italic lines (no brackets)
 * And applies search-term highlighting.
 */
export const renderBibleSnippetWithHighlight = (text: string, searchQuery: string, theme: any) => {
  const { lines, italicLines } = processBibleTextWithMetadata(text);
  if (lines.length === 0) {
    return null;
  }

  // In preview we show only the first non-empty processed line.
  const idx = 0;
  const line = lines[idx];
  const isWatermark = italicLines.has(idx);

  const baseStyle = isWatermark
    ? { color: theme.colors.textWatermark, fontStyle: 'italic' as const }
    : { color: theme.colors.textSecondary ?? theme.colors.textPrimary };

  if (!searchQuery) {
    return <Text style={baseStyle}>{renderBibleLine(line, undefined)}</Text>;
  }

  // Highlight against the already-processed line; inline italics markers are preserved.
  const lowerQuery = searchQuery.toLowerCase();
  const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = line.split(new RegExp(`(${escapedQuery})`, 'gi'));

  return (
    <Text style={baseStyle}>
      {parts.map((part, i) => {
        const isMatch = part.toLowerCase() === lowerQuery;
        return (
          <Text
            key={`snip-${i}`}
            style={
              isMatch
                ? { color: theme.colors.accentBlue || '#4D96FF', fontWeight: '600' }
                : undefined
            }
          >
            {renderInlineItalicSegments(part, undefined)}
          </Text>
        );
      })}
    </Text>
  );
};

/**
 * Checks if a line should be treated as an intro line (formerly bracketed-only)
 * Used to identify introductory lines in Bible verses
 * Updated to work with the new metadata approach where brackets are removed
 */
export const isBracketOnlyLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }
  // With the new approach, we can't detect bracket-only lines anymore
  // since brackets are removed during processing
  // This function now just checks for non-empty lines
  // The actual italic detection is handled by italicLines metadata
  return trimmed.length > 0;
};

/**
 * Test function to verify <n> tag processing (for development/testing)
 */
export const testNTagProcessing = (originalText: string): { processed: string; formatted: string } => {
  const processed = processNTags(originalText);
  const formatted = formatBibleText(processed);
  return { processed, formatted };
};

/**
 * Test function to verify bracketed line processing (for development/testing)
 */
export const testBracketedLineProcessing = (originalText: string): { 
  processed: string; 
  formatted: string; 
  lines: string[];
  italicLines: number[];
} => {
  const processed = processNTags(originalText);
  const { lines: formattedLines, italicLines } = processBibleTextWithMetadata(processed);
  const formatted = formattedLines.join('\n');
  return { 
    processed, 
    formatted, 
    lines: formattedLines,
    italicLines: Array.from(italicLines).sort()
  };
};

