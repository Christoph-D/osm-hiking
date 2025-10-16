import { create } from 'zustand'
import { Router } from '../services/router'

interface RouterState {
  router: Router | null

  setRouter: (router: Router) => void
  clearRouter: () => void
}

export const useRouterStore = create<RouterState>((set) => ({
  router: null,

  setRouter: (router) => set({ router }),
  clearRouter: () => set({ router: null }),
}))
