"use client";

import {
  Undo2,
  Redo2,
  Type,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Quote,
  Strikethrough,
} from "lucide-react";

const TOOLS: { icon: React.ReactNode; command: string; title: string }[] = [
  { icon: <Undo2 size={15} />, command: "undo", title: "Undo" },
  { icon: <Redo2 size={15} />, command: "redo", title: "Redo" },
  { icon: <Type size={15} />, command: "removeFormat", title: "Clear formatting" },
  { icon: <Bold size={15} />, command: "bold", title: "Bold" },
  { icon: <Italic size={15} />, command: "italic", title: "Italic" },
  { icon: <Underline size={15} />, command: "underline", title: "Underline" },
  { icon: <AlignLeft size={15} />, command: "justifyLeft", title: "Align left" },
  { icon: <List size={15} />, command: "insertUnorderedList", title: "Bulleted list" },
  { icon: <ListOrdered size={15} />, command: "insertOrderedList", title: "Numbered list" },
  { icon: <Indent size={15} />, command: "indent", title: "Indent" },
  { icon: <Outdent size={15} />, command: "outdent", title: "Outdent" },
  { icon: <Quote size={15} />, command: "formatBlock", title: "Quote" },
  { icon: <Strikethrough size={15} />, command: "strikeThrough", title: "Strikethrough" },
];

export function RichTextToolbar({ targetRef }: { targetRef: React.RefObject<HTMLDivElement> }) {
  function run(command: string) {
    targetRef.current?.focus();
    if (command === "formatBlock") {
      document.execCommand(command, false, "blockquote");
    } else {
      document.execCommand(command);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-t border-gray-200 bg-gray-50 px-2 py-1.5">
      {TOOLS.map((t, i) => (
        <button
          key={i}
          type="button"
          title={t.title}
          onMouseDown={(e) => {
            e.preventDefault();
            run(t.command);
          }}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}
