const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: {
        app: './app.js',
        'user-main': './user-main.js',
        'admin-user-management': './admin-user-management.js',
        'custom_theme_modal': './custom_theme_modal.js',
        'firebase-init': './firebase-init.js',
        'themes': './themes.js',
        'utils': './utils.js',
        'navbar': './navbar.js',
        'core': './core.js',
        'shortcuts': './shortcuts.js',
        'runtime-globals': './runtime-globals.js',
    },
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin()],
        splitChunks: {
            chunks: 'all',
            name: 'vendor',
            cacheGroups: {
                firebase: {
                    test: /[\\/]node_modules[\\/](@firebase|firebase)[\\/]/,
                    name: 'firebase',
                    chunks: 'all',
                },
            },
        },
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: 'index.html',
            chunks: ['app', 'firebase-init', 'navbar', 'core']
        }),
        new HtmlWebpackPlugin({
            template: 'about.html',
            filename: 'about.html',
            chunks: ['app', 'firebase-init', 'navbar', 'core']
        }),
        new HtmlWebpackPlugin({
            template: 'admin.html',
            filename: 'admin.html',
            chunks: ['app', 'firebase-init', 'navbar', 'core', 'admin-user-management', 'custom_theme_modal', 'themes', 'utils']
        }),
        new HtmlWebpackPlugin({
            template: 'users.html',
            filename: 'users.html',
            chunks: ['app', 'firebase-init', 'navbar', 'core', 'user-main', 'themes', 'utils', 'custom_theme_modal']
        }),
        new CopyPlugin({
            patterns: [
                {from: 'theme_variables.css', to: 'theme_variables.css'},
                {from: 'master.css', to: 'master.css'},
                {from: 'page-specific.css', to: 'page-specific.css'},
                {from: 'favicon.png', to: 'favicon.png'},
            ],
        }),
    ],
    resolve: {
        extensions: ['.js'],
        alias: {
            '@firebase': path.resolve(__dirname, 'node_modules/@firebase'),
        },
    },
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        compress: true,
        port: 9000,
        hot: true
    },
};