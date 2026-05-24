module.exports = {
  apps: [{
    name: 'yanxue-cost',
    script: 'node',
    args: 'dist/server.js',
    env: {
      PORT: 5050,
      NODE_ENV: 'production'
    }
  }]
}
