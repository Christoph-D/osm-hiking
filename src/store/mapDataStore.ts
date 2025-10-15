import { create } from 'zustand'

interface MapDataState {
  isCurrentViewLoaded: boolean
  setIsCurrentViewLoaded: (value: boolean) => void
}

export const useMapDataStore = create<MapDataState>((set) => ({
  isCurrentViewLoaded: false,
  setIsCurrentViewLoaded: (value) => set({ isCurrentViewLoaded: value }),
}))
