module.exports = function (options, webpack) {
  //console.log(JSON.stringify(options, null, 2));

  options.module.rules.push(
    ...[
      { test: /\.sql$/, use: 'raw-loader' },
      {
        test: /\.worker\.wts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'file-loader',
            options: {
              outputPath: 'workers',
              name: '[name].[hash:8].js'
            }
          },
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  );

  return options;
};
