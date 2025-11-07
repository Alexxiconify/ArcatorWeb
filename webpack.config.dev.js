const {merge} = require('webpack-merge');
const common = require('./webpack.config.js');
const path = require('path');

module.exports = merge(common, {
    mode: 'development',
    devtool: 'inline-source-map',
    devServer: {
        hot: true,
        open: true,
        historyApiFallback: true,
        compress: true,
        port: 9000,
        static: {
            directory: path.join(__dirname, 'dist'),
            publicPath: '/',
        },
        client: {
            overlay: {
                errors: true,
                warnings: false,
            },
        },
    },
});