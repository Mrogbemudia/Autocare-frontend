# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Backend connection

The frontend calls the backend at `/api`. During development, Vite proxies these requests to
`http://localhost:4000`; start the backend and frontend in separate terminals with `npm run dev`
from their respective directories. In production, configure the frontend host to proxy `/api` to
the backend on the same origin so the httpOnly authentication cookies are preserved.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
