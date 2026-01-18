"use client";

import { useEffect, useState } from "react";

export function useConversationSearch() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpenPalette = () => setIsOpen(true);

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isModKey = isMac ? event.metaKey : event.ctrlKey;

      if (
        isModKey &&
        event.key === "k" &&
        !event.shiftKey &&
        !event.altKey &&
        !isInputElement
      ) {
        // Prevent default browser behavior (like opening search bar)
        event.preventDefault();
        event.stopPropagation();
        setIsOpen((prev) => !prev);
      }

      if (event.key === "Escape" && isOpen && !isInputElement) {
        setIsOpen(false);
      }
    };

    window.addEventListener("open-conversation-search", handleOpenPalette);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("open-conversation-search", handleOpenPalette);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen]);

  return {
    isOpen,
    setIsOpen,
  };
}
