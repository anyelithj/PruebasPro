// social.store.ts (Redux Toolkit) => Client State del feed social: filtro por red y publicaciones nuevas anunciadas
// en vivo (Socket.io) que el usuario aún no pidió ver. Las publicaciones y métricas son Server State (TanStack Query).
// UX/a11y: las nuevas no se insertan solas (el contenido no "salta" mientras se lee); se muestra un aviso para cargarlas.
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { createSliceHook } from "@/shared/lib/store";
import type { SocialPlatform } from "../api/social.api";

interface SocialFeedState {
  platform: SocialPlatform | "ALL";
  pendingPosts: number;
}

const initialState: SocialFeedState = { platform: "ALL", pendingPosts: 0 };

export const socialFeedSlice = createSlice({
  name: "socialFeed",
  initialState,
  reducers: {
    setPlatform: (state, action: PayloadAction<SocialFeedState["platform"]>) => {
      state.platform = action.payload;
    },
    postPublished: (state) => {
      state.pendingPosts += 1;
    },
    postsRevealed: (state) => {
      state.pendingPosts = 0;
    },
  },
});

export const useSocialFeedState = createSliceHook(socialFeedSlice);
