import tseslint from 'typescript-eslint';

// Module boundaries: shared imports no renderer; world/scope/ui/guide never import each other.
const ban = (patterns, message) => ({
  'no-restricted-imports': ['error', { patterns: [{ group: patterns, message }] }],
});
const others = (self) =>
  ['world', 'scope', 'ui', 'guide', 'stain'].filter((m) => m !== self).flatMap((m) => [`**/${m}`, `**/${m}/**`]);

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/shared/**/*.ts'],
    rules: ban(
      ['three', 'three/*', '**/world/**', '**/scope/**', '**/ui/**', '**/guide/**', '**/stain/**'],
      'src/shared must stay pure: no Three.js, no DOM, no feature modules.',
    ),
  },
  ...['world', 'scope', 'ui', 'guide', 'stain'].map((m) => ({
    files: [`src/${m}/**/*.ts`],
    rules: ban(others(m), 'Modules never import each other; talk through src/shared (state + bus).'),
  })),
);
