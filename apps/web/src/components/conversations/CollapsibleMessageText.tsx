"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type CollapsibleMessageTextProps = {
  content: string;
  isOwn?: boolean;
};

export function CollapsibleMessageText({ content, isOwn = false }: CollapsibleMessageTextProps) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [content, expanded]);

  const showToggle = overflows || expanded;

  return (
    <div>
      <p
        ref={textRef}
        className={cn(
          "whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
          !expanded && "max-h-24 overflow-hidden",
        )}
      >
        {content}
      </p>
      {showToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "mt-1 text-xs font-medium underline-offset-2 hover:underline",
            isOwn ? "text-white/80 hover:text-white" : "text-brand-600 hover:text-brand-700",
          )}
        >
          {expanded ? "Ver menos" : "Ver mais"}
        </button>
      ) : null}
    </div>
  );
}
