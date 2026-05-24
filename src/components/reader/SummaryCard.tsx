"use client";

import { motion } from "framer-motion";
import type { CardItem } from "@/types";

interface SummaryCardProps {
  card: CardItem;
  accentColor: string;
}

export function SummaryCard({ card, accentColor }: SummaryCardProps) {
  return (
    <motion.article
      layout
      className="flex h-full min-h-[420px] flex-col rounded-[2rem] border border-black/5 bg-white p-8 shadow-sm md:p-10"
      style={{ boxShadow: `0 20px 60px ${accentColor}22` }}
    >
      <div
        className="mb-6 h-1 w-16 rounded-full"
        style={{ backgroundColor: accentColor }}
      />
      <h2 className="font-display text-2xl leading-snug text-foreground md:text-3xl">
        {card.subtitle}
      </h2>
      {card.sourcePages ? (
        <p className="mt-2 text-sm text-muted">Source: pages {card.sourcePages}</p>
      ) : null}
      <p className="mt-6 flex-1 text-base leading-8 text-foreground/90 md:text-lg md:leading-8">
        {card.body}
      </p>
      <p className="mt-6 text-xs uppercase tracking-wide text-muted">
        {card.wordCount} words
      </p>
    </motion.article>
  );
}
