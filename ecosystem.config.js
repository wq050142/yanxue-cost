module.exports = {
  apps: [{
    name: 'yanxue-cost',
    script: 'node',
    args: 'dist/server.js',
    env: {
      PORT: 5000,
      NODE_ENV: 'production'
    }
  }]
}
