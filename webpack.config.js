var path = require('path');
var webpack = require('webpack');

module.exports = {
    entry: {
      App: [
        'webpack-dev-server/client?http://localhost:8080/assets/',
        './src/game.js'
      ]
    },
    output: {
        path: __dirname,
        filename: 'build/bundle.js',
        publicPath: 'http://localhost:8080/assets'
    },
    module: {
        loaders: [
            {test: path.join(__dirname, 'src'), loader: 'babel-loader?stage=0'}
        ]
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin(),
        // Avoid publishing files when compilation failed
        new webpack.NoErrorsPlugin()
    ],
    stats: {
        // Nice colored output
        colors: true
    },
    // Create Sourcemaps for the bundle
    devtool: 'source-map'

};