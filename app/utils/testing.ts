// dev-only scaffolding (theme preview, seal FX toggle): on under yarn start / electron:dev, off in every production build
export const TESTING = process.env.NODE_ENV !== 'production';
