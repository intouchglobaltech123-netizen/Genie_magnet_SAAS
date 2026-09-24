"use client";

import { create } from "zustand";
import { seedProofs, type PublishProof } from "@/lib/mock/delivery";

interface PublishState {
  proofs: PublishProof[];
  addProof: (p: PublishProof) => void;
  slots: Record<string, string>;
  setSlot: (videoId: string, slot: string) => void;
}

/** Session-only publishing proofs & schedule slots (not persisted; demo). */
export const usePublishing = create<PublishState>((set) => ({
  proofs: seedProofs,
  addProof: (p) => set((s) => ({ proofs: [p, ...s.proofs.filter((x) => x.videoId !== p.videoId)] })),
  slots: {},
  setSlot: (videoId, slot) => set((s) => ({ slots: { ...s.slots, [videoId]: slot } })),
}));
