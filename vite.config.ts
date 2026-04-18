import path from 'path';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev-only plugin that runs the Vercel serverless function at /api/ai/chat
 * through Vite's SSR loader, so `npm run dev` gives you the same API the
 * production Vercel deployment will serve. In production the /api folder is
 * handled by Vercel natively; this plugin is a no-op there.
 */
function vercelApiDev(envMap: Record<string, string>): Plugin {
  return {
    name: 'vercel-api-dev',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      // Inject env vars from .env into process.env so the handler can read them
      for (const [k, v] of Object.entries(envMap)) {
        if (process.env[k] === undefined && v !== undefined) process.env[k] = v;
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();

        const url = req.url.split('?')[0];
        const modulePath = path.resolve(__dirname, `.${url}.ts`);

        let mod: { default?: (req: unknown, res: unknown) => unknown };
        try {
          mod = await server.ssrLoadModule(modulePath);
        } catch {
          return next();
        }
        if (!mod.default) return next();

        // Read + parse body
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const raw = Buffer.concat(chunks).toString('utf-8');
        let body: unknown = undefined;
        if (raw) {
          try {
            body = JSON.parse(raw);
          } catch {
            body = raw;
          }
        }

        // Adapt Node req/res to Vercel's shape
        const vercelReq = Object.assign(req, { body, query: {} });
        const vercelRes = Object.assign(res, {
          status(code: number) {
            res.statusCode = code;
            return this;
          },
          json(obj: unknown) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(obj));
            return this;
          },
        });

        try {
          await mod.default(vercelReq, vercelRes);
        } catch (err) {
          console.error('[vercel-api-dev]', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Internal error' }));
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/price-api': {
            target: 'https://israeli-food-prices-database-and-ap-one.vercel.app',
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/price-api/, ''),
          },
          '/gov-data-api': {
            target: 'https://data.gov.il',
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/gov-data-api/, ''),
          },
          '/pricepilot-api': {
            target: env.PRICEPILOT_API_TARGET || 'http://localhost:8080',
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/pricepilot-api/, ''),
          },
        },
      },
      plugins: [react(), vercelApiDev(env)],
      define: {
        // NOTE: OPENAI_API_KEY is still exposed client-side for legacy recipe
        // flows in services/geminiService.ts. Product-discovery AI now runs
        // server-side via /api/ai/chat and no longer reads this value.
        'process.env.API_KEY': JSON.stringify(env.OPENAI_API_KEY),
        'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
        'process.env.FIREBASE_API_KEY': JSON.stringify(env.FIREBASE_API_KEY || env.apiKey),
        'process.env.FIREBASE_AUTH_DOMAIN': JSON.stringify(env.FIREBASE_AUTH_DOMAIN || env.authDomain),
        'process.env.FIREBASE_PROJECT_ID': JSON.stringify(env.FIREBASE_PROJECT_ID || env.projectId),
        'process.env.FIREBASE_STORAGE_BUCKET': JSON.stringify(env.FIREBASE_STORAGE_BUCKET || env.storageBucket),
        'process.env.FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.FIREBASE_MESSAGING_SENDER_ID || env.messagingSenderId),
        'process.env.FIREBASE_APP_ID': JSON.stringify(env.FIREBASE_APP_ID || env.appId),
        'process.env.PRICEPILOT_API_URL': JSON.stringify(env.PRICEPILOT_API_URL || '/pricepilot-api')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
