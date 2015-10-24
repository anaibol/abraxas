var path = require('path');
var webpack = require('webpack');

module.exports = {
    entry: './src/app.js',
    output: {
      filename: 'build/app.js'
    },
    devtool: "source-map",
    module: {
      loaders: [
  			{
  				test: /\.json$/,
  				exclude: /node_modules/,
  				loader: 'json',
  			},
  			{
  				test: /\.js$/,
  				exclude: /node_modules/,
  				loader: 'babel'
  			}
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
