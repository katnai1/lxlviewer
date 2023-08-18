import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Matches opening and closing parenthesis across multiple lines
const multilineParenthesisRegex = '\\([\\s\\S]*?\\);?';
// Finds any @use statement
const useRegex = `^@use \\S*(?: with ${multilineParenthesisRegex}|.*)?\n?$`;
// Same as above, but adds the m (multiline) flag
const useRegexTest = new RegExp(useRegex, 'm');
// Makes sure that only the last instance of `useRegex` variable is found
const useRegexReplace = new RegExp(`${useRegex}(?![\\s\\S]*${useRegex})`, 'gm');

function hoistUseStatements(resources: string): (key: string) => string {
    return function(source: string): string {
        if (useRegexTest.test(source)) {
            const output = source.replace(
                useRegexReplace,
                (useStatements) => `${useStatements}\n${resources}`,
            );

            // De-duplicate identical imports
            const importedResources: Record<string, boolean | undefined> = {};
            return output.replace(new RegExp(useRegex, 'mg'), (importedResource: string) => {
                if (importedResources[importedResource]) {
                    return '';
                }

                importedResources[importedResource] = true;
                return importedResource;
            });
        }

        return `${resources}\n${source}`;
    }
};

// https://vitejs.dev/config/
export default defineConfig({
  base: '/katalogisering/',

  plugins: [
    vue(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  server: {
    port: 8080,
    host: true,
    fs: {
      allow: ['..'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: hoistUseStatements(`
          @import "bootstrap/scss/bootstrap";
          @import "@/styles/main.scss";
          // Import kb-styles colors
          // @import "bootstrap/scss/variables.scss";
        `)
      },
    }
  },
  build: {
    rollupOptions: {
      input: './src/main.ts',
    }
  }
})
