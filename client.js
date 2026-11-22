/**
 * dsh-choice-buttons — browser half.
 *
 * When a finished answer contains a block of options ("A. …" or "1. …"), this
 * plugin shows their labels as pills under that answer. A click writes the whole
 * option line into the composer and submits it, so the choice travels as an
 * ordinary user message and stays unambiguous.
 *
 * An answer may number the same options twice (letters and digits). Consecutive
 * blocks with identical labels are treated as one choice: only the lettered
 * block is shown. Blocks with different labels stay separate, one row each.
 */

window.__ModuleLoader__.load({
  id: 'dsh-choice-buttons',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Fewer options than this are prose, not a choice. */
    const MIN_OPTIONS = 2;

    /** Separators accepted after the label: ".", "、", "．", ")", "）". */
    const OPTION = /^ {0,3}(?:[-*•]\s+)?\*{0,2}([A-H]|\d{1,2})\*{0,2}\s*[.、．)）]\*{0,2}\s+(\S.*)$/;

    /** Fenced code blocks are quoted content, never a list of choices. */
    const FENCE = /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[^\n]*$/gm;

    /** Sequence head of a block: "1" for digits, "A" for letters. */
    const expectedLabel = (first, index) => (/^\d+$/.test(first)
      ? String(index + 1)
      : String.fromCharCode(65 + index));

    /** True for a block numbered 1, 2, 3… rather than A, B, C… */
    const isNumeric = block => /^\d+$/.test(block[0].letter);

    /**
     * Split an answer into blocks of consecutive option lines. Blank lines may
     * separate options. A block counts only when it starts at the sequence head
     * and ascends without gaps, so incidental prose never qualifies.
     * @param text - the answer's plain text.
     * @returns every qualifying block, in written order.
     */
    function parseOptionBlocks(text) {
      const runs = [];
      let pending = [];
      const flush = () => {
        if (pending.length >= MIN_OPTIONS) runs.push(pending);
        pending = [];
      };
      const body = String(text || '').replace(FENCE, '');
      for (const line of body.split(/\r?\n/)) {
        if (line.trim() === '') continue;
        const match = OPTION.exec(line);
        if (match === null) { flush(); continue; }
        // A different numbering or a second "A" starts a new block; the same
        // sequence simply continues, blank lines in between notwithstanding.
        if (pending.length > 0 && match[1] !== expectedLabel(pending[0].letter, pending.length)) flush();
        const label = match[2].replace(/^\*{1,3}/, '').replace(/\*{1,3}$/, '').trim();
        pending.push({ letter: match[1], label });
      }
      flush();
      return runs.filter(run => run.every((option, index) => option.letter === expectedLabel(run[0].letter, index)));
    }

    /** Labels joined for comparing two blocks, ignoring spacing differences. */
    const labelKey = block => block.map(option => option.label.replace(/\s+/g, ' ').trim()).join('\u0000');

    /**
     * Blocks to show for one answer. Consecutive blocks that list the same labels
     * are one choice written twice: keep the lettered one. Everything else stays.
     * @param text - the answer's plain text.
     * @returns blocks to render, one row each.
     */
    function choiceBlocks(text) {
      const blocks = [];
      for (const block of parseOptionBlocks(text)) {
        const previous = blocks[blocks.length - 1];
        const sameLabels = previous !== undefined
          && previous.length === block.length
          && labelKey(previous) === labelKey(block);
        if (sameLabels) {
          if (isNumeric(previous) && !isNumeric(block)) blocks[blocks.length - 1] = block;
          continue;
        }
        blocks.push(block);
      }
      return blocks;
    }

    /** Join the prose of Assistant content blocks. */
    function blocksText(blocks) {
      return (blocks || [])
        .filter(block => block && block.kind === 'text')
        .map(block => block.text)
        .join('');
    }

    /** The answer prose that closes one turn, or empty text. */
    function answerText(snapshot, turn) {
      const nodes = snapshot && snapshot.nodes;
      const list = nodes && typeof nodes.values === 'function' ? Array.from(nodes.values()) : [];
      for (const node of list) {
        if (!node || node.kind !== 'turn-tail' || !node.data || !node.data.closing) continue;
        if (String(node.data.turn) !== String(turn)) continue;
        return blocksText(node.data.closing.blocks);
      }
      return '';
    }

    const stripStyle = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: '8px',
      padding: '10px 0 4px',
    };

    const rowStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
    };

    /** Rounded chip; hover only deepens the fill, the label keeps its colour. */
    function chipStyle(active) {
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        minWidth: '40px',
        height: '36px',
        padding: '0 16px',
        borderRadius: '999px',
        border: '1px solid ' + (active ? 'var(--dsw-alias-line-strong, rgba(128,128,128,0.55))' : 'var(--dsw-alias-line, rgba(128,128,128,0.32))'),
        background: active ? 'var(--dsw-alias-interactive-bg-active, #e4e6ea)' : 'var(--dsw-alias-interactive-bg-hover, #f1f2f4)',
        color: 'inherit',
        font: 'inherit',
        fontSize: '15px',
        fontWeight: 500,
        lineHeight: 1,
        cursor: 'pointer',
        transition: 'background 90ms, border-color 90ms',
      };
    }

    /**
     * Label pills for this turn's option blocks.
     * @param props - turn-tail props (turn, useChat, inputActions).
     * @returns the pill strip, or null when this answer offers no options.
     */
    function ChoicePills(props) {
      const { turn, useChat, inputActions } = props;
      // The turn tail carries the turn it belongs to; the chat snapshot's turn ids
      // match it, which is how this answer's options are found.
      const turnKey = turn && typeof turn === 'object' ? (turn.turn !== undefined ? turn.turn : turn.id) : turn;
      // Select plain text, not a fresh array: a new array on every snapshot would
      // re-render (or loop) for no visible change.
      const answer = typeof useChat === 'function'
        ? useChat(snapshot => answerText(snapshot, turnKey)) || ''
        : '';
      const blocks = React.useMemo(() => choiceBlocks(answer), [answer]);
      const [hovered, setHovered] = React.useState(null);
      // A tail stays mounted while its answer is edited, so re-arm per option set.
      const signature = blocks.map(block => block.map(option => option.letter + ':' + option.label).join('|')).join('||');
      const [sent, setSent] = React.useState(null);
      React.useEffect(() => { setSent(null); }, [signature]);
      if (blocks.length === 0 || sent !== null || !inputActions) return null;

      const choose = option => {
        setSent(option.key);
        inputActions.setDraft(option.letter + '. ' + option.label);
        // The editor commits the draft synchronously; submit on the next task so
        // the submission reads the new draft instead of the previous one.
        setTimeout(() => { inputActions.submit(); }, 0);
      };

      return h(
        'div',
        { style: stripStyle },
        blocks.map((block, blockIndex) => h(
          'div',
          { key: 'block-' + blockIndex, style: rowStyle },
          block.map(option => {
            const key = blockIndex + ':' + option.letter;
            return h(
              'button',
              {
                key,
                type: 'button',
                title: `${option.letter}. ${option.label}`,
                'aria-label': `选项 ${option.letter}：${option.label}`,
                style: chipStyle(hovered === key),
                onMouseEnter: () => setHovered(key),
                onMouseLeave: () => setHovered(null),
                onFocus: () => setHovered(key),
                onBlur: () => setHovered(null),
                onClick: () => choose({ ...option, key }),
              },
              option.letter,
            );
          }),
        )),
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
          name: 'conversation.chat.turnTail',
          id: 'choice-buttons',
          order: 40,
        }, ChoicePills));
      },
    };
  },
});
