"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/reader/ProgressBar";
import { SummaryCard } from "@/components/reader/SummaryCard";
import type { CardItem } from "@/types";

interface CardDeckProps {
  cards: CardItem[];
  accentColor: string;
}

export function CardDeck({ cards, accentColor }: CardDeckProps) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= cards.length) return;
      setDirection(next > index ? 1 : -1);
      setIndex(next);
    },
    [cards.length, index],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") goTo(index + 1);
      if (event.key === "ArrowLeft") goTo(index - 1);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, index]);

  if (cards.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-black/10 bg-white/70 px-8 py-16 text-center">
        <p className="font-display text-2xl">No cards yet</p>
        <p className="mt-2 text-muted">Processing may still be running.</p>
      </div>
    );
  }

  const current = cards[index];

  return (
    <div className="space-y-6">
      <ProgressBar current={index} total={cards.length} accentColor={accentColor} />

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current.id}
            custom={direction}
            initial={{ opacity: 0, x: direction >= 0 ? 80 : -80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction >= 0 ? -80 : 80 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(_, info) => {
              if (info.offset.x < -80) goTo(index + 1);
              else if (info.offset.x > 80) goTo(index - 1);
            }}
          >
            <SummaryCard card={current} accentColor={accentColor} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          className="rounded-full border border-black/10"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
        >
          Previous
        </Button>

        <div className="flex max-w-md flex-1 flex-wrap justify-center gap-2">
          {cards.map((card, dotIndex) => (
            <button
              key={card.id}
              type="button"
              aria-label={`Go to card ${dotIndex + 1}`}
              onClick={() => goTo(dotIndex)}
              className="h-2.5 w-2.5 rounded-full transition"
              style={{
                backgroundColor:
                  dotIndex === index ? accentColor : "rgba(0,0,0,0.12)",
                transform: dotIndex === index ? "scale(1.2)" : "scale(1)",
              }}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          className="rounded-full border border-black/10"
          onClick={() => goTo(index + 1)}
          disabled={index === cards.length - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
