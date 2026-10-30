import { defineConfig } from 'vitest/config';

// Testler Vite/Electron eklentilerinden bağımsız çalışır (Node ortamı).
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 30000,
    // Sunucu entegrasyon testleri ortak test veritabanını kullanır (göç testi tabloyu geçici olarak değiştirir) → dosyalar sırayla çalışır.
    fileParallelism: false },
});
