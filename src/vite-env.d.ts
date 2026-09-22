/// <reference types="vite/client" />

declare global {
	var __songkeRoot: ReturnType<typeof import('react-dom/client').createRoot> | undefined
}

export {}
