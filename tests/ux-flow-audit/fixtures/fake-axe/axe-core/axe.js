// Test double: the real axe-core is never installed by the tests.
window.axe = {
  run: async () => ({
    violations: [{ id: 'fake-rule', impact: 'serious', help: 'Fake axe rule', tags: ['wcag143'], nodes: [{ target: ['h1'], failureSummary: 'fake summary' }] }],
  }),
};
