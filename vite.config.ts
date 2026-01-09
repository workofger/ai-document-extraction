import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    // Base path for Vercel deployment (root)
    base: '/',
    
    server: {
      port: 3000,
      host: '0.0.0.0',
      open: true,
    },
    
    preview: {
      port: 4173,
      host: '0.0.0.0',
    },
    
    plugins: [react()],
    
    define: {
      'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
    },
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development',
      minify: 'esbuild',
      rollupOptions: {
        output: {
          // Use .js extension instead of .mjs to fix MIME type issues with nginx
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          manualChunks: {
            vendor: ['react', 'react-dom'],
            ui: ['lucide-react'],
          },
        },
      },
    },
    
    optimizeDeps: {
      include: ['react', 'react-dom', 'lucide-react'],
    },
  };
});
