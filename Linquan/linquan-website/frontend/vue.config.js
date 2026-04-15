module.exports = {
  devServer: {
    host: '0.0.0.0',
    allowedHosts: 'all',
    client: {
      webSocketURL: 'auto://0.0.0.0:0/ws'
    },
    proxy: {
      '/api': {
        target: process.env.VUE_APP_DEV_API_TARGET || 'http://localhost:4000',
        changeOrigin: true
      },
      '/uploads': {
        target: process.env.VUE_APP_DEV_API_TARGET || 'http://localhost:4000',
        changeOrigin: true
      },
      '/ws': {
        target: process.env.VUE_APP_DEV_API_TARGET || 'http://localhost:4000',
        ws: true
      }
    }
  }
};
