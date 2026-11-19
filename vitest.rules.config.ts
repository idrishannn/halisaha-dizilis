import { defineConfig } from 'vitest/config';

// Güvenlik kuralı testleri: Firestore emülatörü gerekir (npm run test:rules).
export default defineConfig({
  test: { include: ['tests/rules/**/*.test.ts'], environment: 'node', testTimeout: 15000, fileParallelism: false },
});
