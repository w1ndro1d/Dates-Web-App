import { defineConfig } from 'vite';

export default defineConfig({
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
  build: { rolldownOptions: { output: { codeSplitting: { groups: [
    { name: 'three', test: /node_modules[\\/]three/ },
  ] } } } },
});
