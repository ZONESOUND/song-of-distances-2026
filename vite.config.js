import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// envPrefix keeps the legacy REACT_APP_* variable names working unchanged, so
// .env.local files written for the CRA era stay valid on this branch.
export default defineConfig({
  base: './',
  envPrefix: 'REACT_APP_',
  plugins: [
    react(),
    ...(process.env.HTTPS === 'true' ? [basicSsl()] : []),
  ],
  optimizeDeps: {
    include: [
      'p5',
      'react-p5-wrapper',
      'tone',
      'socket.io-client',
      'firebase/app',
      'firebase/database',
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
