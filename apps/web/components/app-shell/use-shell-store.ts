import { create } from "zustand";

// Estado de UI del shell autenticado. Solo presentación: nunca datos del servidor.
type ShellState = {
  sidebarOpen: boolean;
  tutorialOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  setTutorialOpen: (open: boolean) => void;
};

export const useShellStore = create<ShellState>((set) => ({
  sidebarOpen: false,
  tutorialOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
  setTutorialOpen: (tutorialOpen) => set({ tutorialOpen }),
}));
