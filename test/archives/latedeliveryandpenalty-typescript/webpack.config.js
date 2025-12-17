const path = require('path');

module.exports = {
    entry: './logic/logic.ts',
    experiments: {
        outputModule: true
    },
    output: {
        filename: 'logic.js',
        path: path.resolve(__dirname, 'logic'),
        library: {
            type: 'module',
        },
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
};

