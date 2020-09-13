/**
 * @fileoverview Tests for valid-table-hierarchy
 * @author Igor Malovitsa
 */

'use strict';

// -----------------------------------------------------------------------------
// Requirements
// -----------------------------------------------------------------------------

const RuleTester = require('eslint').RuleTester;
const rule = require('../../../lib/rules/valid-dom-hierarchy');

const parserOptions = {
  ecmaVersion: 2018,
  sourceType: 'module',
  ecmaFeatures: {
    jsx: true
  }
};

function errorMessage(parentName, elementName) {
  return `Invalid DOM elements hierarchy: <${elementName}>\
 is not a valid child of <${parentName}>.`;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

const ruleTester = new RuleTester({parserOptions});
ruleTester.run('valid-table-hierarchy', rule, {
  valid: [
    {
      code: '<table>{foo.map((x) => <tr />)}</table>'
    },
    {
      code: '<div />'
    },
    {
      code: `
        <table>
          <thead><tr><th>ah</th></tr></thead>
          <tbody><tr><td>av</td></tr></tbody>
          <tfoot><tr><td>af</td></tr></tfoot>
        </table>
      `
    },
    {
      code: '<table><tr><td></td></tr></table>'
    },
    {
      code: '<div>Foo</div>;'
    },
    // custom components should be allowed inside the table
    {
      code: '<table><Foo /></table>;'
    },
    {
      code: 'React.createElement("div");'
    },
    {
      code: 'React.createElement(Foo);'
    },
    {
      code: `
      React.createElement(Foo, {},
        React.createElement("div"));
      `
    },
    {
      code: `
        React.createElement("table", {},
          React.createElement(Foo));
      `
    },
    {
      code: `
        React.createElement("table", {},
          React.createElement("tr", {},
            React.createElement("td")));
      `
    },
    {
      code: '<table>{true && <tr><td /></tr>}</table>'
    },
    {
      code: '<table>{foo.map((x) => <tr><td /></tr>)}</table>'
    }
  ],
  invalid: [
    {
      code: '<script><button /></script>',
      errors: [{message: errorMessage('script', 'button')}]
    },
    {
      code: '<table><th></th></table>',
      errors: [{message: errorMessage('table', 'th')}]
    },
    {
      code: '<table><thead><th></th></thead></table>',
      errors: [{message: errorMessage('thead', 'th')}]
    },
    {
      code: '<tr><tr></tr></tr>',
      errors: [{message: errorMessage('tr', 'tr')}]
    },
    {
      code: '<td><tr></tr></td>',
      errors: [{message: errorMessage('td', 'tr')}]
    },
    {
      code: `
        React.createElement("table", {},
          React.createElement("td"))
      `,
      errors: [{message: errorMessage('table', 'td')}]
    },
    {
      code: `
        React.createElement("table", {},
          React.createElement("thead", {},
            React.createElement("th")))
      `,
      errors: [{message: errorMessage('thead', 'th')}]
    },
    {
      code: `
        React.createElement("tr", {},
          React.createElement("tr"))
      `,
      errors: [{message: errorMessage('tr', 'tr')}]
    },
    {
      code: '<table>{true && <td />}</table>',
      errors: [{message: errorMessage('table', 'td')}]
    },
    {
      code: '<table>{foo.map((x) => <td />)}</table>',
      errors: [{message: errorMessage('table', 'td')}]
    },
    {
      code: '<table>{foo.map(function(x) { return <td />; })}</table>',
      errors: [{message: errorMessage('table', 'td')}]
    }
  ]
});
