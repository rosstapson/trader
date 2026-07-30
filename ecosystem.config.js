const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "trader-api",
      cwd: "apps/api",
      // The workspace packages (@trader/config, @trader/shared, ...) resolve to their raw
      // .ts source (that's how `tsx` runs them in dev) — plain `node dist/index.js` can't
      // load those. Running through tsx here too, without its watch mode, sidesteps that
      // until the workspace packages get real compiled dist/ outputs (tracked as follow-up).
      script: "node_modules/tsx/dist/cli.mjs",
      args: "src/index.ts",
      // Node loads this into process.env before tsx even starts (Node 20.6+). PM2 has no
      // real "env_file" option — don't reach for that again.
      node_args: `--env-file=${path.join(__dirname, ".env")}`,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
