import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {WebView, type WebViewMessageEvent} from 'react-native-webview';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../contexts/ThemeContext';
import {useTutorialTarget} from '../contexts/TutorialContext';
import TutorialOverlay from './TutorialOverlay';
import {TEXT_STYLES, scaleFontSize} from '../constants/Typography';
import type {
  ChapterDisplay,
  ChapterMark,
  MarkStyle,
} from '../utils/chapterMarks';
import {
  buildSelectionShareItems,
  type ShareCardData,
  type ShareReference,
} from '../utils/shareCard';
import {ShareCardModal} from './ShareCardModal';
import {ShareIcon} from './ShareIcon';

interface ChapterEditorModalProps {
  visible: boolean;
  reference: string;
  chapter: ChapterDisplay | null;
  initialMarks: ChapterMark[];
  initialScrollVerseNumber?: number | null;
  fontScale: number;
  highlightColor: string;
  // Reference shape for sharing the current selection; the toolbar share
  // button is disabled when absent.
  shareReference?: ShareReference;
  onSave: (marks: ChapterMark[]) => void;
  onClear: () => void;
  onClose: () => void;
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildHtml = (
  chapter: ChapterDisplay,
  initialMarks: ChapterMark[],
  fontSize: number,
  lineHeight: number,
  textColor: string,
  bgColor: string,
  verseNumberColor: string,
  highlightColor: string,
): string => {
  const versesHtml = chapter.verses
    .map(v => {
      const safe = escapeHtml(v.displayText);
      const titleHtml = v.title
        ? `<div class="verse-title">${escapeHtml(v.title)}</div>`
        : '';
      return `${titleHtml}<p class="verse" data-verse="${v.verseNumber}"><span class="vn" contenteditable="false">${v.verseNumber}&nbsp;</span><span class="vt" data-verse="${v.verseNumber}">${safe}</span></p>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; background: ${bgColor}; color: ${textColor};
    font-size: ${fontSize}px; line-height: ${lineHeight}px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-text-size-adjust: 100%; -webkit-tap-highlight-color: transparent; }
  #editor { padding: 14px 16px 80px 16px; outline: none; }
  .verse { margin: 0 0 8px 0; text-align: justify; }
  .vn { color: ${verseNumberColor}; font-weight: 700; font-size: ${Math.round(fontSize * 0.85)}px; vertical-align: super; padding-right: 2px; user-select: none; -webkit-user-select: none; }
  .vt { white-space: pre-wrap; }
  .verse-title { font-style: italic; opacity: 0.7; margin: 6px 0 4px; user-select: none; -webkit-user-select: none; }
  mark.hl { background: ${highlightColor}; color: inherit; padding: 0; }
  /* Note marks are rendered as a dotted underline (not a background) so an
     overlapping highlight's background still shows through underneath. */
  span.note { border-bottom: 1px dotted currentColor; }
  ::selection { background: rgba(10, 132, 255, 0.35); }
</style>
</head>
<body>
<div id="editor" contenteditable="false" spellcheck="false" autocorrect="off" autocapitalize="off" style="user-select: text; -webkit-user-select: text; -webkit-touch-callout: default;">${versesHtml}</div>
<script>
(function() {
  var INITIAL = ${JSON.stringify(initialMarks)};
  var SEPARATOR = ${JSON.stringify(chapter.separator)};
  var editor = document.getElementById('editor');

  var __suppressMarkPosts = false;
  function rn(payload) {
    if (__suppressMarkPosts && payload && payload.type === 'MARK') return;
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }

  function clearVisualFormatting(start, end) {
    try {
      editor.contentEditable = 'true';
      try { selectRange(start, end); } catch (e0) {}
      // Some WebViews keep <mark> wrappers around even after removeFormat/hiliteColor.
      // Unwrap any highlight marks that intersect the current selection.
      try {
        var sel = window.getSelection();
        var r = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
        if (r && typeof r.intersectsNode === 'function') {
          var marks = Array.prototype.slice.call(editor.querySelectorAll('mark.hl'));
          marks.forEach(function(m) {
            try {
              if (!r.intersectsNode(m)) return;
              var parent = m.parentNode;
              if (!parent) return;
              while (m.firstChild) parent.insertBefore(m.firstChild, m);
              parent.removeChild(m);
            } catch (eU) {}
          });
        }
      } catch (eM) {}
      try { document.execCommand('removeFormat', false, null); } catch (e1) {}
      try {
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('hiliteColor', false, 'transparent');
      } catch (e2) {}
      editor.contentEditable = 'false';
    } catch (e) {
      try { editor.contentEditable = 'false'; } catch (e0) {}
    }
  }

  function getVtNodes() {
    return Array.prototype.slice.call(editor.querySelectorAll('.vt'));
  }

  function cumulativeOffsetBefore(vtNodes, i) {
    var total = 0;
    for (var k = 0; k < i; k++) {
      total += vtNodes[k].textContent.length;
      total += SEPARATOR.length;
    }
    return total;
  }

  function vtStartRange(vt) {
    var r = document.createRange();
    r.setStart(vt, 0);
    r.setEnd(vt, 0);
    return r;
  }

  // Map a DOM range endpoint (node, offset) to an index in concatenated chapterText.
  // chapterText = vt[0].textContent + SEP + vt[1].textContent + SEP + ...
  // Handles three cases:
  //   1) endpoint is inside a .vt — measure inner range
  //   2) endpoint is on an ancestor (e.g., <p> or #editor) that does not match
  //      vt === node || vt.contains(node) — clamp to the nearest .vt boundary
  //      using DOM position comparison. Without this, multi-paragraph selections
  //      land their endContainer on a <p>, the loop falls through, and the
  //      highlight overshoots into the end of the chapter.
  function endpointToOffset(node, offset) {
    var vtNodes = getVtNodes();
    if (!vtNodes.length) return 0;

    for (var i = 0; i < vtNodes.length; i++) {
      var vt = vtNodes[i];
      if (vt === node || vt.contains(node)) {
        var r = document.createRange();
        r.setStart(vt, 0);
        try { r.setEnd(node, offset); } catch (e) { r.setEnd(vt, vt.childNodes.length); }
        return cumulativeOffsetBefore(vtNodes, i) + r.toString().length;
      }
    }

    var probe;
    try {
      probe = document.createRange();
      probe.setStart(node, offset);
      probe.setEnd(node, offset);
    } catch (e) { return 0; }

    for (var j = 0; j < vtNodes.length; j++) {
      var vtStart = vtStartRange(vtNodes[j]);
      if (probe.compareBoundaryPoints(Range.START_TO_START, vtStart) <= 0) {
        if (j === 0) return 0;
        var prev = vtNodes[j - 1];
        return cumulativeOffsetBefore(vtNodes, j - 1) + prev.textContent.length;
      }
    }

    var lastIdx = vtNodes.length - 1;
    return cumulativeOffsetBefore(vtNodes, lastIdx) + vtNodes[lastIdx].textContent.length;
  }

  function getSelectionOffsets() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    var range = sel.getRangeAt(0);
    if (range.collapsed) return null;
    if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return null;
    var start = endpointToOffset(range.startContainer, range.startOffset);
    var end = endpointToOffset(range.endContainer, range.endOffset);
    if (end < start) { var t = start; start = end; end = t; }
    if (end <= start) return null;
    return { start: start, end: end };
  }

  function notifySelection() {
    try {
      var off = getSelectionOffsets();
      if (off) { window.__lastSelection = off; }
      rn({ type: 'SELECTION', offsets: off });
    } catch (e) {
      rn({ type: 'SELECTION', offsets: null });
    }
  }

  // Map a chapterText offset to a DOM (node, localOffset) inside .vt nodes.
  function offsetToDom(offset) {
    var vtNodes = getVtNodes();
    var consumed = 0;
    for (var i = 0; i < vtNodes.length; i++) {
      var vt = vtNodes[i];
      var len = vt.textContent.length;
      if (offset <= consumed + len) {
        var local = offset - consumed;
        // Walk text nodes inside vt to find node + offset.
        var walker = document.createTreeWalker(vt, NodeFilter.SHOW_TEXT, null);
        var n; var seen = 0;
        while ((n = walker.nextNode())) {
          var nl = n.nodeValue.length;
          if (local <= seen + nl) {
            return { node: n, offset: local - seen };
          }
          seen += nl;
        }
        return { node: vt, offset: vt.childNodes.length };
      }
      consumed += len;
      if (i < vtNodes.length - 1) consumed += SEPARATOR.length;
    }
    var last = vtNodes[vtNodes.length - 1];
    return { node: last, offset: last ? last.childNodes.length : 0 };
  }

  function selectRange(start, end) {
    var s = offsetToDom(start);
    var e = offsetToDom(end);
    var r = document.createRange();
    r.setStart(s.node, s.offset);
    r.setEnd(e.node, e.offset);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }

  function applyExec(cmd) {
    var off = getSelectionOffsets();
    if (!off) { rn({ type: 'NO_SELECTION' }); return; }
    // Temporarily make editable for formatting
    editor.contentEditable = 'true';
    // Some Android WebViews lose the selection when toggling editability.
    // Re-select the saved offsets so execCommand applies to the intended range.
    try { selectRange(off.start, off.end); } catch (e0) {}
    // queryCommandState BEFORE execCommand tells us whether the selection was
    // already styled — if it was, execCommand is going to toggle it OFF.
    var wasActive = false;
    try { wasActive = !!document.queryCommandState(cmd); } catch (eQ) { wasActive = false; }
    document.execCommand(cmd, false, null);
    editor.contentEditable = 'false';
    var style = cmd === 'bold' ? 'bold' : cmd === 'italic' ? 'italic' : 'underline';
    if (wasActive) {
      // Toggling off: tell RN to remove this style across [start,end] without
      // disturbing other styles (highlight, the other two text styles).
      rn({ type: 'UNMARK', style: style, start: off.start, end: off.end });
    } else {
      rn({ type: 'MARK', mark: { style: style, start: off.start, end: off.end } });
    }
  }

  function applyHighlight(color) {
    var off = getSelectionOffsets();
    if (!off) { rn({ type: 'NO_SELECTION' }); return; }
    // Persist FIRST so save works even if visual wrapping fails on this WebView.
    // Note: highlight does not auto-toggle here — to remove a highlight the user
    // selects the range and taps "Fafao". This keeps highlight independent of the
    // bold/italic/underline toggle behavior so a user re-tapping H to layer color
    // never accidentally erases their existing highlight.
    rn({ type: 'MARK', mark: { style: 'highlight', start: off.start, end: off.end, color: color } });
    try {
      var sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      var range = sel.getRangeAt(0);
      editor.contentEditable = 'true';
      // Same issue as applyExec: ensure selection is still the intended range.
      try {
        selectRange(off.start, off.end);
        sel = window.getSelection();
        if (sel && sel.rangeCount) range = sel.getRangeAt(0);
      } catch (eSel) {}
      var ok = false;
      try {
        document.execCommand('styleWithCSS', false, true);
        ok = document.execCommand('hiliteColor', false, color || '#FFEB3B');
      } catch (e1) { ok = false; }
      if (!ok) {
        try {
          var contents = range.extractContents();
          var mark = document.createElement('mark');
          mark.className = 'hl';
          if (color) mark.style.backgroundColor = color;
          mark.appendChild(contents);
          range.insertNode(mark);
        } catch (e2) {
          rn({ type: 'HL_VISUAL_ERROR', message: String(e2 && e2.message || e2) });
        }
      }
      editor.contentEditable = 'false';
      var sel2 = window.getSelection();
      if (sel2) sel2.removeAllRanges();
    } catch (e) {
      rn({ type: 'HL_ERROR', message: String(e && e.message || e) });
    }
  }

  // Render-only: wrap [start,end] in <span class="note"> for the dotted
  // underline. Notes are persisted RN-side by the composer, NOT by a MARK
  // post, so this never calls execCommand (there is no 'note' command — the
  // old code's execCommand('note') was a silent no-op). Mirrors applyHighlight's
  // manual-wrap fallback. extractContents over a range that already contains a
  // <mark.hl> preserves that mark inside the new span, so highlight + note coexist.
  function applyNote(start, end) {
    try {
      editor.contentEditable = 'true';
      selectRange(start, end);
      var sel = window.getSelection();
      if (!sel || !sel.rangeCount) { editor.contentEditable = 'false'; return; }
      var range = sel.getRangeAt(0);
      var contents = range.extractContents();
      var span = document.createElement('span');
      span.className = 'note';
      span.appendChild(contents);
      range.insertNode(span);
      editor.contentEditable = 'false';
      sel.removeAllRanges();
    } catch (e) {
      try { editor.contentEditable = 'false'; } catch (e0) {}
      rn({ type: 'NOTE_VISUAL_ERROR', message: String(e && e.message || e) });
    }
  }

  // Merge overlapping same-style ranges so toggle-based execCommand calls don't
  // accidentally undo themselves on the second application over the same span.
  function mergeMarks(marks) {
    var byKey = {};
    (marks || []).forEach(function(m) {
      var key = m.style === 'highlight' ? 'highlight:' + (m.color || '') : m.style;
      (byKey[key] = byKey[key] || []).push(m);
    });
    var out = [];
    Object.keys(byKey).forEach(function(k) {
      var arr = byKey[k].slice().sort(function(a, b) { return a.start - b.start; });
      var cur = null;
      arr.forEach(function(m) {
        if (!cur) { cur = {start: m.start, end: m.end, style: m.style, color: m.color}; return; }
        if (m.start <= cur.end) {
          if (m.end > cur.end) cur.end = m.end;
        } else {
          out.push(cur);
          cur = {start: m.start, end: m.end, style: m.style, color: m.color};
        }
      });
      if (cur) out.push(cur);
    });
    return out;
  }

  // Apply initial marks visually (best-effort) by selecting each range and applying the style.
  // Suppress MARK re-broadcasts so these existing marks don't get duplicated in pendingMarks.
  function applyInitial() {
    if (!INITIAL || !INITIAL.length) return;
    __suppressMarkPosts = true;
    try {
      mergeMarks(INITIAL).forEach(function(m) {
        try {
          selectRange(m.start, m.end);
          if (m.style === 'highlight') applyHighlight(m.color);
          else if (m.style === 'note') applyNote(m.start, m.end);
          else {
            editor.contentEditable = 'true';
            document.execCommand(m.style, false, null);
            editor.contentEditable = 'false';
          }
        } catch (e) {}
      });
    } finally {
      __suppressMarkPosts = false;
    }
    var sel = window.getSelection(); if (sel) sel.removeAllRanges();
  }

  window.RNEditor = {
    bold: function() { applyExec('bold'); },
    italic: function() { applyExec('italic'); },
    underline: function() { applyExec('underline'); },
    highlight: function(color) { applyHighlight(color); },
    rerenderMarks: function(newMarks) {
      try {
        // Strip ALL existing formatting from every .vt by resetting it to its original text.
        var vts = getVtNodes();
        for (var i = 0; i < vts.length; i++) {
          var orig = vts[i].dataset.originalText;
          if (typeof orig === 'string') {
            vts[i].innerHTML = '';
            vts[i].textContent = orig;
          }
        }

        // Merge overlapping same-style ranges so toggle-based execCommand calls don't
        // accidentally undo themselves on the second pass over the same span.
        var merged = mergeMarks(newMarks);

        // Re-apply every mark from scratch using the same code path as initial render.
        __suppressMarkPosts = true;
        try {
          merged.forEach(function(m) {
            try {
              selectRange(m.start, m.end);
              if (m.style === 'highlight') {
                applyHighlight(m.color);
              } else if (m.style === 'note') {
                applyNote(m.start, m.end);
              } else {
                editor.contentEditable = 'true';
                document.execCommand(m.style, false, null);
                editor.contentEditable = 'false';
              }
            } catch (eM) {}
          });
        } finally {
          __suppressMarkPosts = false;
        }

        var sel = window.getSelection();
        try { if (sel) sel.removeAllRanges(); } catch (e1) {}
        notifySelection();
      } catch (e) {
        notifySelection();
      }
    },
    clearAll: function() {
      // Strip all formatting: re-render plain content.
      var vts = getVtNodes();
      for (var i = 0; i < vts.length; i++) {
        vts[i].innerHTML = '';
        vts[i].textContent = vts[i].dataset.originalText || vts[i].textContent;
      }
      rn({ type: 'CLEARED' });
    },
    getSelectionOffsets: function() {
      var off = getSelectionOffsets();
      rn({ type: 'SELECTION', offsets: off });
    },
    eraseSelection: function() {
      // Read the live DOM selection from inside the WebView (RN-side
      // selectionOffsets state can get cleared the moment the footer button
      // is tapped). Fall back to the last cached selection if needed.
      var off = getSelectionOffsets();
      if (!off) {
        if (typeof window.__lastSelection === 'object' && window.__lastSelection) {
          off = window.__lastSelection;
        }
      }
      if (!off) { rn({ type: 'NO_SELECTION' }); return; }
      clearVisualFormatting(off.start, off.end);
      rn({ type: 'ERASE_RANGE', start: off.start, end: off.end });
    },
    eraseRange: function(start, end) {
      if (typeof start !== 'number' || typeof end !== 'number' || end <= start) {
        rn({ type: 'NO_SELECTION' });
        return;
      }
      clearVisualFormatting(start, end);
      rn({ type: 'ERASE_RANGE', start: start, end: end });
    }
  };

  // Track the last non-null selection so eraseSelection has a fallback.
  window.__lastSelection = null;

  // Save original text for clearAll.
  getVtNodes().forEach(function(vt) { vt.dataset.originalText = vt.textContent; });

  document.addEventListener('selectionchange', function() {
    // Don't spam RN while applying initial marks.
    if (__suppressMarkPosts) return;
    notifySelection();
  });

  // Tap on an existing highlight -> ask RN to show a delete popover. Skip when
  // there's an active text selection so we don't pre-empt the native selection
  // toolbar.
  editor.addEventListener('click', function(ev) {
    var t = ev.target;
    while (t && t !== editor) {
      // Tap on a note span -> ask RN to open the composer for this range.
      // Checked before the highlight branch so a note layered over a highlight
      // opens the note editor rather than the highlight-delete bar.
      if (t.nodeType === 1 && t.classList && t.classList.contains('note')) {
        var nsel = window.getSelection();
        if (nsel && !nsel.isCollapsed) return;
        var nStart = endpointToOffset(t, 0);
        var nEnd = endpointToOffset(t, t.childNodes.length);
        if (nEnd > nStart) {
          rn({ type: 'NOTE_TAP', start: nStart, end: nEnd });
        }
        return;
      }
      if (t.nodeType === 1 && t.tagName === 'MARK' && t.classList && t.classList.contains('hl')) {
        var sel = window.getSelection();
        if (sel && !sel.isCollapsed) return;
        var start = endpointToOffset(t, 0);
        var end = endpointToOffset(t, t.childNodes.length);
        if (end > start) {
          var color = (t.style && t.style.backgroundColor) || '';
          rn({ type: 'HIGHLIGHT_TAP', start: start, end: end, color: color });
        }
        return;
      }
      t = t.parentNode;
    }
  });

  applyInitial();
  rn({ type: 'READY' });
})();
true;
</script>
</body></html>`;
};

const ChapterEditorModal: React.FC<ChapterEditorModalProps> = ({
  visible,
  reference,
  chapter,
  initialMarks,
  initialScrollVerseNumber,
  fontScale,
  highlightColor,
  shareReference,
  onSave,
  onClear,
  onClose,
}) => {
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  // Highlight-tutorial spotlight targets (native Views inside this RN modal).
  const hlVerseTextRef = useTutorialTarget('hlVerseText');
  const hlColorPickerRef = useTutorialTarget('hlColorPicker');
  const hlEraseRef = useTutorialTarget('hlEraseBtn');
  const hlSaveRef = useTutorialTarget('hlSaveBtn');
  const [pendingMarks, setPendingMarks] = useState<ChapterMark[]>(initialMarks);
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<string>(highlightColor);
  const [selectionOffsets, setSelectionOffsets] = useState<
    {start: number; end: number} | null
  >(null);
  const [tappedHighlight, setTappedHighlight] = useState<
    {start: number; end: number; color: string} | null
  >(null);
  const [noteComposer, setNoteComposer] = useState<
    {start: number; end: number; text: string; editingId: string | null} | null
  >(null);
  const [shareData, setShareData] = useState<ShareCardData | null>(null);

  const highlightColors = [
    '#FFEB3B', // Yellow
    '#FF9800', // Orange  
    '#F44336', // Red
    '#E91E63', // Pink
    '#9C27B0', // Purple
    '#673AB7', // Deep Purple
    '#3F51B5', // Indigo
    '#2196F3', // Blue
    '#00BCD4', // Cyan
    '#4CAF50', // Green
    '#8BC34A', // Light Green
    '#CDDC39', // Lime
  ];

  React.useEffect(() => {
    if (visible) {
      setPendingMarks(initialMarks);
      setTappedHighlight(null);
    }
  }, [visible, initialMarks]);

  const fontSize = scaleFontSize(TEXT_STYLES.body.fontSize, fontScale);
  const lineHeight = Math.round(fontSize * 1.5);

  const html = useMemo(() => {
    if (!chapter) return '';
    return buildHtml(
      chapter,
      initialMarks,
      fontSize,
      lineHeight,
      theme.colors.readerText,
      theme.colors.backgroundSecondary,
      theme.colors.verseNumber,
      highlightColor,
    );
  }, [
    chapter,
    initialMarks,
    fontSize,
    lineHeight,
    theme.colors.readerText,
    theme.colors.backgroundSecondary,
    theme.colors.verseNumber,
    highlightColor,
  ]);

  const inject = useCallback((js: string) => {
    webViewRef.current?.injectJavaScript(js);
  }, []);

  const scrollToVerse = useCallback(
    (verseNumber: number) => {
      const js = `(function(){
        try {
          var el = document.querySelector('[data-verse="' + ${JSON.stringify(
            String(verseNumber),
          )} + '"]');
          if (!el) return true;
          el.scrollIntoView({block: 'start', behavior: 'auto'});
          return true;
        } catch (e) { return true; }
      })(); true;`;
      inject(js);
    },
    [inject],
  );

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'MARK' && msg.mark) {
        const maxLen = chapter?.chapterText.length ?? Number.MAX_SAFE_INTEGER;
        const rawStart = Number(msg.mark.start);
        const rawEnd = Number(msg.mark.end);
        const start = Math.max(0, Math.min(maxLen, rawStart));
        const end = Math.max(0, Math.min(maxLen, rawEnd));
        if (!(end > start)) return;
        const m: ChapterMark = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          start,
          end,
          style: msg.mark.style as MarkStyle,
          color:
            msg.mark.style === 'highlight'
              ? (msg.mark.color || selectedHighlightColor || '#FFEB3B')
              : undefined,
          createdAt: new Date().toISOString(),
        };
        setPendingMarks(prev => [...prev, m]);
      } else if (msg.type === 'UNMARK' && msg.style) {
        const removeStart: number = msg.start;
        const removeEnd: number = msg.end;
        const removeStyle = msg.style as MarkStyle;
        setPendingMarks(prev => {
          const next: ChapterMark[] = [];
          for (const existing of prev) {
            if (existing.style !== removeStyle) {
              next.push(existing);
              continue;
            }
            if (removeStart >= existing.end || removeEnd <= existing.start) {
              next.push(existing);
              continue;
            }
            if (removeStart <= existing.start && removeEnd >= existing.end) {
              continue;
            }
            if (existing.start < removeStart && removeEnd < existing.end) {
              next.push({...existing, id: `${existing.id}-l`, end: removeStart});
              next.push({...existing, id: `${existing.id}-r`, start: removeEnd});
              continue;
            }
            if (removeStart <= existing.start) {
              next.push({...existing, id: `${existing.id}-t`, start: removeEnd});
              continue;
            }
            next.push({...existing, id: `${existing.id}-t`, end: removeStart});
          }
          return next;
        });
      } else if (msg.type === 'ERASE_RANGE') {
        const eStart: number = msg.start;
        const eEnd: number = msg.end;
        if (typeof eStart !== 'number' || typeof eEnd !== 'number' || eEnd <= eStart) return;
        setPendingMarks(prev => {
          const next: ChapterMark[] = [];
          for (const m of prev) {
            if (eStart >= m.end || eEnd <= m.start) { next.push(m); continue; }
            if (eStart <= m.start && eEnd >= m.end) { continue; }
            if (m.start < eStart && eEnd < m.end) {
              next.push({...m, id: `${m.id}-l`, end: eStart});
              next.push({...m, id: `${m.id}-r`, start: eEnd});
              continue;
            }
            if (eStart <= m.start) { next.push({...m, id: `${m.id}-t`, start: eEnd}); continue; }
            next.push({...m, id: `${m.id}-t`, end: eStart});
          }
          const payload = JSON.stringify(next);
          inject(`window.RNEditor && window.RNEditor.rerenderMarks && window.RNEditor.rerenderMarks(${payload}); true;`);
          return next;
        });
        setSelectionOffsets(null);
        setTappedHighlight(null);
      } else if (msg.type === 'NO_SELECTION') {
        setSelectionOffsets(null);
      } else if (msg.type === 'CLEARED') {
        setPendingMarks([]);
        setSelectionOffsets(null);
        setTappedHighlight(null);
      } else if (msg.type === 'SELECTION') {
        const off = msg.offsets;
        if (off && typeof off.start === 'number' && typeof off.end === 'number') {
          setSelectionOffsets({start: off.start, end: off.end});
        } else {
          setSelectionOffsets(null);
        }
      } else if (msg.type === 'HIGHLIGHT_TAP') {
        const hStart = Number(msg.start);
        const hEnd = Number(msg.end);
        if (Number.isFinite(hStart) && Number.isFinite(hEnd) && hEnd > hStart) {
          setTappedHighlight({
            start: hStart,
            end: hEnd,
            color: typeof msg.color === 'string' ? msg.color : '',
          });
        }
      } else if (msg.type === 'NOTE_TAP') {
        const nStart = Number(msg.start);
        const nEnd = Number(msg.end);
        if (Number.isFinite(nStart) && Number.isFinite(nEnd) && nEnd > nStart) {
          // Open the composer pre-filled with any existing note covering exactly
          // this range — same lookup as openNoteComposer, keyed off the tapped
          // span instead of the live selection.
          const existing = pendingMarks.find(
            m => m.style === 'note' && m.start === nStart && m.end === nEnd,
          );
          setNoteComposer({
            start: nStart,
            end: nEnd,
            text: existing?.note ?? '',
            editingId: existing?.id ?? null,
          });
        }
      }
    } catch {
      // ignore
    }
  };

  const handleSave = () => {
    onSave(pendingMarks);
  };

  const openNoteComposer = useCallback(() => {
    if (!selectionOffsets) return;
    // Check for an existing note covering exactly this range — opening the
    // composer on top of a note edits it instead of stacking duplicates.
    const existing = pendingMarks.find(
      m =>
        m.style === 'note' &&
        m.start === selectionOffsets.start &&
        m.end === selectionOffsets.end,
    );
    setNoteComposer({
      start: selectionOffsets.start,
      end: selectionOffsets.end,
      text: existing?.note ?? '',
      editingId: existing?.id ?? null,
    });
  }, [pendingMarks, selectionOffsets]);

  const cancelNoteComposer = useCallback(() => {
    setNoteComposer(null);
  }, []);

  const canShareSelection = !!selectionOffsets && !!shareReference && !!chapter;

  const openShareSelection = useCallback(() => {
    if (!selectionOffsets || !shareReference || !chapter) return;
    const items = buildSelectionShareItems(chapter, selectionOffsets.start, selectionOffsets.end);
    if (items.length === 0) return;
    setShareData({...shareReference, rangeStepper: false, items});
  }, [chapter, selectionOffsets, shareReference]);

  const saveNoteComposer = useCallback(() => {
    if (!noteComposer) return;
    const trimmed = noteComposer.text.trim();
    setPendingMarks(prev => {
      let next: ChapterMark[];
      if (noteComposer.editingId) {
        if (!trimmed) {
          // Clearing the text removes the note entirely.
          next = prev.filter(m => m.id !== noteComposer.editingId);
        } else {
          next = prev.map(m =>
            m.id === noteComposer.editingId ? {...m, note: trimmed} : m,
          );
        }
      } else if (!trimmed) {
        next = prev;
      } else {
        const newMark: ChapterMark = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          start: noteComposer.start,
          end: noteComposer.end,
          style: 'note',
          note: trimmed,
          createdAt: new Date().toISOString(),
        };
        next = [...prev, newMark];
      }
      // Redraw the WebView so the dotted underline appears/updates/disappears
      // immediately — without this the note span only shows on next reopen.
      // rerenderMarks resets each .vt to its original text then reapplies all
      // marks, so a deleted note's span is correctly removed too.
      const payload = JSON.stringify(next);
      inject(
        `window.RNEditor && window.RNEditor.rerenderMarks && window.RNEditor.rerenderMarks(${payload}); true;`,
      );
      return next;
    });
    setNoteComposer(null);
  }, [noteComposer, inject]);

  const handleEraseSelection = () => {
    // Delegate to the WebView. It reads the live DOM selection (or the cached
    // last-known selection) and posts ERASE_RANGE back, which we handle in
    // onMessage. This avoids the race where RN's selectionOffsets state may
    // be cleared by the time the user taps Fafao.
    inject('window.RNEditor && window.RNEditor.eraseSelection && window.RNEditor.eraseSelection(); true;');
  };

  const handleDeleteTappedHighlight = () => {
    if (!tappedHighlight) return;
    inject(
      `window.RNEditor && window.RNEditor.eraseRange && window.RNEditor.eraseRange(${tappedHighlight.start}, ${tappedHighlight.end}); true;`,
    );
    setTappedHighlight(null);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View
        style={[
          styles.backdrop,
          {paddingTop: insets.top, paddingBottom: insets.bottom},
        ]}>
        <View
          style={[
            styles.card,
            {backgroundColor: theme.colors.backgroundSecondary},
          ]}>
          <View
            style={[styles.header, {borderBottomColor: theme.colors.divider}]}>
            <Text style={[styles.title, {color: theme.colors.textPrimary}]}>
              {reference}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={[styles.closeIcon, {color: theme.colors.textPrimary}]}>
                ×
              </Text>
            </Pressable>
          </View>

          <View style={styles.toolbar}>
            <ToolbarButton
              label="B"
              bold
              onPress={() => inject('window.RNEditor && window.RNEditor.bold(); true;')}
              theme={theme}
            />
            <ToolbarButton
              label="I"
              italic
              onPress={() => inject('window.RNEditor && window.RNEditor.italic(); true;')}
              theme={theme}
            />
            <ToolbarButton
              label="U"
              underline
              onPress={() => inject('window.RNEditor && window.RNEditor.underline(); true;')}
              theme={theme}
            />
            <ToolbarButton
              label="✎"
              onPress={openNoteComposer}
              disabled={!selectionOffsets}
              theme={theme}
            />
            <ToolbarButton
              icon={<ShareIcon color={theme.colors.textPrimary} />}
              onPress={openShareSelection}
              disabled={!canShareSelection}
              theme={theme}
            />
          </View>

          <View ref={hlColorPickerRef} collapsable={false} style={styles.colorPickerContainer}>
            <Text style={[styles.colorPickerLabel, {color: theme.colors.textSecondary}]}>
              Highlight Color:
            </Text>
            <View style={styles.colorPickerRow}>
              {highlightColors.map((color) => (
                <Pressable
                  key={color}
                  style={[
                    styles.colorOption,
                    {backgroundColor: color},
                    selectedHighlightColor === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedHighlightColor(color);
                    inject(`window.RNEditor && window.RNEditor.highlight(${JSON.stringify(color)}); true;`);
                  }}
                />
              ))}
            </View>
          </View>

          <View ref={hlVerseTextRef} collapsable={false} style={styles.webContainer}>
            {chapter ? (
              <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{html}}
                onMessage={onMessage}
                onLoadEnd={() => {
                  if (typeof initialScrollVerseNumber === 'number') {
                    scrollToVerse(initialScrollVerseNumber);
                  }
                }}
                javaScriptEnabled
                hideKeyboardAccessoryView
                automaticallyAdjustContentInsets={false}
                keyboardDisplayRequiresUserAction={false}
                style={{backgroundColor: theme.colors.backgroundSecondary}}
              />
            ) : null}
          </View>

          {tappedHighlight ? (
            <View
              style={[
                styles.highlightTapBar,
                {
                  backgroundColor: theme.colors.backgroundTertiary,
                  borderColor: theme.colors.divider,
                },
              ]}>
              <View style={styles.highlightTapInfo}>
                {tappedHighlight.color ? (
                  <View
                    style={[
                      styles.highlightSwatch,
                      {backgroundColor: tappedHighlight.color},
                    ]}
                  />
                ) : null}
                <Text
                  style={[
                    styles.highlightTapLabel,
                    {color: theme.colors.textPrimary},
                  ]}>
                  Loko voafidy
                </Text>
              </View>
              <View style={styles.highlightTapActions}>
                <Pressable
                  style={[
                    styles.highlightTapButton,
                    {backgroundColor: theme.colors.backgroundSecondary},
                  ]}
                  onPress={() => setTappedHighlight(null)}>
                  <Text
                    style={[
                      styles.highlightTapButtonText,
                      {color: theme.colors.textPrimary},
                    ]}>
                    Hidio
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.highlightTapButton,
                    styles.highlightTapDelete,
                    {backgroundColor: theme.colors.accentBlue},
                  ]}
                  onPress={handleDeleteTappedHighlight}>
                  <Text
                    style={[
                      styles.highlightTapButtonText,
                      {color: '#FFFFFF'},
                    ]}>
                    Fafao
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={[styles.footer, {borderTopColor: theme.colors.divider}]}>
            <View ref={hlEraseRef} collapsable={false} style={styles.footerButtonWrap}>
              <Pressable
                style={[
                  styles.footerButton,
                  {backgroundColor: theme.colors.backgroundTertiary},
                  !selectionOffsets ? {opacity: 0.5} : null,
                ]}
                onPress={handleEraseSelection}
                disabled={!selectionOffsets}>
                <Text
                  style={[styles.footerButtonText, {color: theme.colors.textPrimary}]}>
                  Fafao
                </Text>
              </Pressable>
            </View>
            <View ref={hlSaveRef} collapsable={false} style={styles.footerButtonWrap}>
              <Pressable
                style={[
                  styles.footerButton,
                  styles.footerPrimary,
                  {backgroundColor: theme.colors.accentBlue},
                ]}
                onPress={handleSave}>
                <Text style={[styles.footerButtonText, {color: '#FFFFFF'}]}>
                  Tahirizo
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Highlight-tutorial overlay — spotlights the native controls above
              while a modal-scope step is active. No-op otherwise. */}
          <TutorialOverlay scope="modal" />
        </View>
      </View>

      <Modal
        visible={noteComposer != null}
        transparent
        animationType="fade"
        onRequestClose={cancelNoteComposer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.noteBackdrop}>
          <Pressable style={styles.noteBackdropDismiss} onPress={cancelNoteComposer} />
          <View
            style={[
              styles.noteCard,
              {backgroundColor: theme.colors.backgroundSecondary},
            ]}>
            <Text style={[styles.noteTitle, {color: theme.colors.textPrimary}]}>
              {noteComposer?.editingId ? 'Ovay ny naoty' : 'Hanampy naoty'}
            </Text>
            <TextInput
              value={noteComposer?.text ?? ''}
              onChangeText={text =>
                setNoteComposer(prev => (prev ? {...prev, text} : prev))
              }
              multiline
              autoFocus
              placeholder="Soraty eto ny naotinao…"
              placeholderTextColor={theme.colors.textSecondary}
              style={[
                styles.noteInput,
                {
                  color: theme.colors.textPrimary,
                  backgroundColor: theme.colors.backgroundTertiary,
                  borderColor: theme.colors.divider,
                },
              ]}
            />
            <View style={styles.noteActions}>
              <Pressable
                onPress={cancelNoteComposer}
                style={[
                  styles.noteButton,
                  {backgroundColor: theme.colors.backgroundTertiary},
                ]}>
                <Text
                  style={[
                    styles.noteButtonText,
                    {color: theme.colors.textPrimary},
                  ]}>
                  Hidio
                </Text>
              </Pressable>
              <Pressable
                onPress={saveNoteComposer}
                style={[
                  styles.noteButton,
                  {backgroundColor: theme.colors.accentBlue},
                ]}>
                <Text style={[styles.noteButtonText, {color: '#FFFFFF'}]}>
                  Tahirizo
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {shareData ? (
        <ShareCardModal data={shareData} onClose={() => setShareData(null)} />
      ) : null}
    </Modal>
  );
};

const ToolbarButton = ({
  label,
  icon,
  onPress,
  disabled,
  bold,
  italic,
  underline,
  accent,
  theme,
}: {
  label?: string;
  // Drawn icon shown instead of the text label.
  icon?: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  accent?: string;
  theme: any;
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={[
      styles.toolbarButton,
      {backgroundColor: accent ?? theme.colors.backgroundTertiary},
      disabled ? {opacity: 0.5} : null,
    ]}>
    {icon ?? (
      <Text
        style={[
          styles.toolbarButtonText,
          {
            color: accent ? '#1B1B1B' : theme.colors.textPrimary,
            fontWeight: bold ? '900' : '700',
            fontStyle: italic ? 'italic' : 'normal',
            textDecorationLine: underline ? 'underline' : 'none',
          },
        ]}>
        {label}
      </Text>
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 10,
    height: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    paddingRight: 12,
  },
  closeIcon: {
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  toolbar: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 8,
  },
  toolbarButton: {
    width: 44,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarButtonText: {
    fontSize: 16,
  },
  colorPickerContainer: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  colorPickerLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  colorPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 4,
  },
  colorOption: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#007AFF',
    borderWidth: 3,
  },
  webContainer: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 8,
  },
  highlightTapBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  highlightTapInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  highlightSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  highlightTapLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  highlightTapActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  highlightTapButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  highlightTapDelete: {
    minWidth: 72,
  },
  highlightTapButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 4,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  // Wrapper so the tutorial can measure the button as a native View (the hole
  // target); sizes to its child, so it doesn't alter footer layout.
  footerButtonWrap: {},
  footerButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  footerPrimary: {
    minWidth: 96,
  },
  footerButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  noteBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  noteBackdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  noteCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  noteInput: {
    minHeight: 110,
    maxHeight: 220,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  noteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  noteButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 76,
    alignItems: 'center',
  },
  noteButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default ChapterEditorModal;
