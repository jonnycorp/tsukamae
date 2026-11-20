// the data files come in untyped, each cast where it's read: typing the dexes' JSON from its contents was most of what
// the type check spent
declare module '*.json' {
  const value: unknown;
  export default value;
}
