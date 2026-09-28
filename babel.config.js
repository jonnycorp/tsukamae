module.exports = (api) => {
  api.cache(true);

  return {
    presets: [
      ['@babel/preset-env', { targets: { chrome: '120' } }],
      ['@babel/preset-react', { runtime: 'automatic' }],
      '@babel/preset-typescript',
    ],
  };
};
