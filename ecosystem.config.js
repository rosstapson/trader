module.exports = {
  apps: [
    {
      name: "trader-api",
      cwd: "apps/api",
      script: "dist/index.js",
      // Loads the repo-root .env natively — no dotenv dependency needed. Requires Node 20.6+.
      node_args: "--env-file=../../.env",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
