"use client";

import { useEffect, useRef, useState } from "react";

export function ColumnMenu({
  columnId,
  columnTitle,
  isFirst,
  isLast,
  onMoveLeft,
  onMoveRight,
  onRequestDelete,
}: {
  columnId: string;
  columnTitle: string;
  isFirst: boolean;
  isLast: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRequestDelete: (columnId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  function handleOpen() {
    setIsOpen(true);
    setActiveIndex(0);
  }

  function handleClose() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  const menuItems = [
    {
      label: "Move left",
      disabled: isFirst,
      danger: false,
      action: () => {
        onMoveLeft();
        setIsOpen(false);
      },
    },
    {
      label: "Move right",
      disabled: isLast,
      danger: false,
      action: () => {
        onMoveRight();
        setIsOpen(false);
      },
    },
    {
      label: "Delete column",
      disabled: false,
      danger: true,
      action: () => {
        onRequestDelete(columnId);
        setIsOpen(false);
      },
    },
  ];

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        handleClose();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % menuItems.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(
          (prev) => (prev - 1 + menuItems.length) % menuItems.length,
        );
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, menuItems.length]);

  useEffect(() => {
    if (isOpen && menuRef.current) {
      const items =
        menuRef.current.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
      items[activeIndex]?.focus();
    }
  }, [isOpen, activeIndex]);

  return (
    <div className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Actions for ${columnTitle}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (isOpen) {
            handleClose();
          } else {
            handleOpen();
          }
        }}
        className="rounded p-1 text-[var(--color-text-secondary)] opacity-0 transition-opacity hover:text-[var(--color-text-primary)] focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] group-hover:opacity-100"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(event) => {
              event.stopPropagation();
              handleClose();
            }}
          />
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Actions for ${columnTitle}`}
            className="absolute right-0 z-50 mt-1 w-40 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg focus:outline-none"
            onClick={(event) => event.stopPropagation()}
          >
            {menuItems.map((item, idx) => (
              <button
                key={item.label}
                role="menuitem"
                tabIndex={activeIndex === idx ? 0 : -1}
                disabled={item.disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  item.action();
                }}
                className={`w-full px-3 py-1.5 text-left text-xs transition-colors focus:bg-[var(--color-surface-raised)] focus:outline-none ${
                  item.disabled
                    ? "cursor-not-allowed text-[var(--color-text-secondary)] opacity-50"
                    : item.danger
                    ? "text-[var(--color-danger)] hover:bg-[var(--color-surface-raised)]"
                    : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
