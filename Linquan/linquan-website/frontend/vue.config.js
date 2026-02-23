module.exports = {
  devServer: {
    host: '0.0.0.0',
    allowedHosts: 'all',
    proxy: {
      '/api': {
        target: process.env.VUE_APP_DEV_API_TARGET || 'http://localhost:4000',
        changeOrigin: true
      },
      '/uploads': {
        target: process.env.VUE_APP_DEV_API_TARGET || 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
};
