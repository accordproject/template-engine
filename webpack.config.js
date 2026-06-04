/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const path = require('path');
const webpack = require('webpack');
const packageJson = require('./package.json');

// UMD browser bundle. The node entry point is the plain `tsc` output (lib/index.js);
// this config produces only the browser bundle (umd/template-engine.js). Node-only paths
// — Template.fromDirectory/fromUrl, child-process logic evaluation, disk output — are not
// available in the browser; use Template.fromArchive + the in-process evaluator instead.
module.exports = {
    target: 'web',
    mode: 'production',
    entry: path.resolve(__dirname, 'lib', 'index.js'),
    output: {
        clean: false,
        path: path.resolve(__dirname, 'umd'),
        filename: 'template-engine.js',
        library: {
            name: 'template-engine',
            type: 'umd',
        },
        globalObject: 'self',
    },
    // No source map: the published browser bundle bundles concerto/markdown/typescript,
    // so the map balloons to ~30MB. Behaviour-only e2e tests don't need it.
    devtool: false,
    resolve: {
        extensions: ['.js'],
        mainFields: ['browser', 'module', 'main'],
        alias: {
            // Force the concerto-core CJS/browser entry so webpack can apply fallbacks.
            '@accordproject/concerto-core': require.resolve('@accordproject/concerto-core/dist/concerto-core.js'),
            'node:events': require.resolve('events/'),
        },
        fallback: {
            fs:            false,
            net:           false,
            tls:           false,
            child_process: false,
            os:            false,
            util:          false,
            vm:            false,
            assert:        false,
            path:   require.resolve('path-browserify'),
            crypto: require.resolve('crypto-browserify'),
            stream: require.resolve('stream-browserify'),
            buffer: require.resolve('buffer/'),
            events: require.resolve('events/'),
        },
    },
    module: {
        rules: [
            { test: /\.js$/, loader: 'source-map-loader', exclude: /node_modules/ },
        ],
    },
    plugins: [
        // getWorkerPath() does require.resolve('@accordproject/template-engine') on the
        // node-only child-process evaluation path, which is unreachable in the browser
        // (the default in-process evaluator is used instead). Ignore the self-reference so
        // the bundle builds.
        new webpack.IgnorePlugin({ resourceRegExp: /^@accordproject\/template-engine$/ }),
        new webpack.BannerPlugin(
            `Accord Project Template Engine v${packageJson.version} — browser build\n` +
            'Licensed under the Apache License, Version 2.0'
        ),
        new webpack.DefinePlugin({
            'process.env': { NODE_ENV: JSON.stringify('production') },
        }),
        new webpack.ProvidePlugin({
            Buffer:  ['buffer', 'Buffer'],
            process: 'process/browser',
        }),
    ],
};
