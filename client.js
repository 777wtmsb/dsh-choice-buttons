/**
 * dsh-choice-buttons — browser half.
 *
 * When the newest finished answer ends with a block of options ("A. …" or
 * "1. …"), this plugin shows the labels as pills in the composer dock. A click
 * writes the whole option line into the composer and submits it, so the choice
 * travels as an ordinary user message and stays unambiguous.
 */

window.__ModuleLoader__.load({
  id: 'dsh-choice-buttons',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Fewer options than this are prose, not a choice. */
    const MIN_OPTIONS = 2;

    /** Separators accepted after the label: ".", "、", "．", ")", "）". */
    const OPTION = /^\s*(?:[-*•]\s+)?\*{0,2}([A-H]|\d{1,2})\*{0,2}\s*[.、．)）]\s+(\S.*)$/;

    /**
     * Collect the last run of consecutive option lines in one answer.
     * Blank lines may separate options. The run must start at the sequence head
     * ("A" or "1") and ascend without gaps, so incidental prose never qualifies.
     * @param text - the answer's plain text.
     * @returns options in written order; empty unless at least two qualify.
     */
    function parseOptions(text) {
      const runs = [];
      let pending = [];
      const flush = () => {
        if (pending.length >= MIN_OPTIONS) runs.push(pending);
        pending = [];
      };
      for (const line of String(text || '').split(/\r?\n/)) {
        if (line.trim() === '') continue;
        const match = OPTION.exec(line);
        if (match === null) { flush(); continue; }
        pending.push({ letter: match[1], label: match[2].trim() });
      }
      flush();
      const last = runs.at(-1);
      if (last === undefined) return [];
      const numeric = /^\d+$/.test(last[0].letter);
      const expected = index => (numeric ? String(index + 1) : String.fromCharCode(65 + index));
      return last.every((option, index) => option.letter === expected(index)) ? last : [];
    }

    /** Join the prose of Assistant content blocks. */
    function blocksText(blocks) {
      return (blocks || [])
        .filter(block => block && block.kind === 'text')
        .map(block => block.text)
        .join('');
    }

    /**
     * Options of the answer that ends the given turn. Chat nodes expose no
     * "assistant" kind: answer prose rides on the turn tail's closing blocks, and
     * the tail node carries the turn it belongs to.
     * @param snapshot - chat snapshot from useChat.
     * @param turn - the turn this tail component was mounted for.
     * @returns parsed options; empty when that answer offers none.
     */
    function optionsForTurn(snapshot, turn) {
      const nodes = snapshot && snapshot.nodes;
      const list = nodes && typeof nodes.values === 'function' ? Array.from(nodes.values()) : [];
      for (const node of list) {
        if (!node || node.kind !== 'turn-tail' || !node.data || !node.data.closing) continue;
        if (String(node.data.turn) !== String(turn)) continue;
        return parseOptions(blocksText(node.data.closing.blocks));
      }
      return [];
    }

    const stripStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 0 4px',
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
     * Label pills for this turn's option block.
     * @param props - turn-tail props (turn, useChat, inputActions).
     * @returns the pill strip, or null when this answer offers no options.
     */
    function ChoicePills(props) {
      const { turn, useChat, inputActions } = props;
      // The turn tail carries the turn it belongs to; the chat snapshot's turn ids
      // match it, which is how this answer's option block is found.
      const turnKey = turn && typeof turn === 'object' ? (turn.turn !== undefined ? turn.turn : turn.id) : turn;
      const options = typeof useChat === 'function'
        ? useChat(snapshot => {
          const nodes = snapshot && snapshot.nodes;
          const list = nodes && typeof nodes.values === 'function' ? Array.from(nodes.values()) : [];
          for (const node of list) {
            if (!node || node.kind !== 'turn-tail' || !node.data || !node.data.closing) continue;
            if (String(node.data.turn) !== String(turnKey)) continue;
            return parseOptions(blocksText(node.data.closing.blocks));
          }
          return [];
        }) || []
        : [];
      const [hovered, setHovered] = React.useState(null);
      // A tail stays mounted while its answer is edited, so re-arm per option set.
      const signature = options.map(option => option.letter + ':' + option.label).join('|');
      const [sent, setSent] = React.useState(null);
      React.useEffect(() => { setSent(null); }, [signature]);
      if (options.length === 0 || sent !== null || !inputActions) return null;

      const choose = option => {
        setSent(option.letter);
        inputActions.setDraft(option.letter + '. ' + option.label);
        // The editor commits the draft synchronously; submit on the next task so
        // the submission reads the new draft instead of the previous one.
        setTimeout(() => { inputActions.submit(); }, 0);
      };

      return h(
        'div',
        { style: stripStyle },
        options.map(option => h(
          'button',
          {
            key: option.letter,
            type: 'button',
            title: `${option.letter}. ${option.label}`,
            'aria-label': `选项 ${option.letter}：${option.label}`,
            style: chipStyle(hovered === option.letter),
            onMouseEnter: () => setHovered(option.letter),
            onMouseLeave: () => setHovered(null),
            onFocus: () => setHovered(option.letter),
            onBlur: () => setHovered(null),
            onClick: () => choose(option),
          },
          option.letter,
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
