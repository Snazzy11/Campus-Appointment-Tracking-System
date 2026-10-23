const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
// Must come last: turns off ESLint rules that would fight with Prettier's formatting.
const prettier = require('eslint-config-prettier/flat');
module.exports = defineConfig([expo, prettier, { ignores: ['dist/**', 'example/**'] }]);
