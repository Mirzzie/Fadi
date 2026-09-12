/**
 * TURN A STEP'S TEXT INTO SOMETHING YOU CAN COPY FROM.
 *
 * Steps arrive as the markdown a model writes — fenced ``` blocks, commands indented four
 * spaces, `inline code`, **bold** — and were printed as a paragraph. So a command like
 * "docker exec -it fadi-project-bb94e388 sh" sat inside prose with nothing to mark where it
 * started or ended, no way to copy it except by dragging a selection exactly, and bold
 * rendered as literal asterisks.
 *
 * This is not a markdown renderer and must not grow into one: it recognises the three
 * shapes a command takes in these steps and leaves everything else as text. No HTML is
 * produced from the input — the component renders these blocks as React text nodes — so a
 * step containing "<script>" shows those characters and nothing more.
 */

export type InlinePart = { type: "text" | "code" | "bold"; value: string };

export type InstructionBlock =
  | { type: "text"; parts: InlinePart[] }
  | { type: "code"; code: string; lang: string | null };

export function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const re = /`([^`\n]+)`|\*\*([^*\n]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ type: "text", value: text.slice(last, m.index) });
    if (m[1] !== undefined) parts.push({ type: "code", value: m[1] });
    else parts.push({ type: "bold", value: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

export function parseInstruction(input: string): InstructionBlock[] {
  const blocks: InstructionBlock[] = [];
  const lines = (input ?? "").replace(/\r\n/g, "\n").split("\n");
  let text: string[] = [];
  let indented: string[] = [];

  const flushText = () => {
    const joined = text.join("\n").trim();
    if (joined) blocks.push({ type: "text", parts: parseInline(joined) });
    text = [];
  };
  const flushIndented = () => {
    if (indented.length) {
      blocks.push({ type: "code", code: indented.join("\n").trimEnd(), lang: null });
      indented = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^\s*```\s*([\w+-]*)\s*$/.exec(line);

    if (fence) {
      flushText();
      flushIndented();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      // An unclosed fence still becomes a code block rather than swallowing the rest of the
      // step as invisible text.
      blocks.push({ type: "code", code: dedent(body).trimEnd(), lang: fence[1] || null });
      continue;
    }

    // Four-space or tab indentation is how the model writes a command on its own line.
    if (/^(?: {4}|\t)\s*\S/.test(line)) {
      flushText();
      const command = line.replace(/^(?: {4}|\t)/, "");
      indented.push(command);
      // A heredoc's body is written at column 0 ("cat > f <<'EOF'" then the file, then EOF).
      // Without this the block ended at the first body line and the command was split in two
      // — which is exactly what a copied, half-pasted heredoc does to a shell.
      const heredoc = /<<-?\s*(['"]?)([A-Za-z_]\w*)\1/.exec(command);
      if (heredoc) {
        const end = heredoc[2];
        while (i + 1 < lines.length) {
          i++;
          indented.push(lines[i]);
          if (lines[i].trim() === end) break;
        }
      }
      continue;
    }

    if (indented.length && line.trim() === "") {
      // A blank line inside an indented run belongs to it only if more code follows.
      const next = lines.slice(i + 1).find((l) => l.trim() !== "");
      if (next && /^(?: {4}|\t)\s*\S/.test(next)) {
        indented.push("");
        continue;
      }
    }

    flushIndented();
    text.push(line);
  }

  flushText();
  flushIndented();
  return blocks;
}

function dedent(lines: string[]): string {
  const indents = lines.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)![0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(min)).join("\n");
}
