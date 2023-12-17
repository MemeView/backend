module.exports = {
  "apps": [
    {
      "name": "tokenwatch-app",
      "script": "dist/src/main.js",
      "instances": 1,
      "autorestart": true,
      "watch": false,
      "max_memory_restart": "2G",
      "env": {
        "NODE_ENV": "production"
      }
    }
  ]
}
