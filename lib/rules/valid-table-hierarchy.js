/**
 * @fileoverview Prevent invalid table hierarchy:
 * Valid children:
 * <table> can only contain <thead>, <tbody>, <tfoot> or <tr>
 * <thead>, <tbody>, <tfoot> can only contain <tr>
 * <tr> can only contain <td> or <th>
 * Valid parents:
 * <thead>, <tbody>, <tfoot> can only be children of <table>
 * <tr> can only be child of <table>, <thead>, <tbody> or <tfoot>
 * <td> and <th> can only be children of <tr>
 * @author Igor Malovitsa
 */

'use strict';

const has = require('has');

const Components = require('../util/Components');
const docsUrl = require('../util/docsUrl');

// ------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------

const ELEMENT_CONTEXT = {
  // top level elements
  html: { context: 'html', parent: 'root' },
  title: { context: 'text', parent: 'html' },
  head: { context: 'head', parent: 'html' },
  link: { context: 'void', parent: 'head' },
  meta: { context: 'void', parent: 'head' },
  style: { context: 'text', parent: 'head' },
  script: { context: 'text', parent: ['flow', 'phrasing', 'head'] },
  body: { context: 'flow', parent: 'html' },
  // table definitions
  table: { context: 'table', parent: 'flow' },
  caption: { context: 'text', parent: 'table' },
  colgroup: { context: 'table-colgroup', parent: 'table' },
  col: { context: 'void', parent: 'table-colgroup' },
  thead: { context: 'table-section', parent: 'table' },
  tbody: { context: 'table-section', parent: 'table' },
  tfoot: { context: 'table-section', parent: 'table' },
  tr: { context: 'table-row', parent: ['table', 'table-section'] },
  th: { context: 'flow', parent: 'table-row' },
  td: { context: 'flow', parent: 'table-row' },
  // most of the special elements
  p: { context: 'phrasing', parent: 'flow' },
  div: { context: 'flow', parent: 'flow' },
  select: { context: 'select', parent: 'flow' },
  optgroup: { context: 'optgroup', parent: 'select' },
  option: { context: 'text', parent: ['optgroup', 'select'] },
  textarea: { context: 'text', parent: ['phrasing', 'flow'] },
  hr: { context: 'void', parent: 'flow' }
};

// Void elements
const VOID_PHRASING = {
  context: 'void',
  parent: ['phrasing', 'flow']
};
[
   'area', 'base', 'br', 'embed', 'img', 'input', 'keygen',
   'menuitem', 'param', 'source', 'track', 'wbr'
].forEach(function (element) {
  ELEMENT_CONTEXT[element] = VOID_PHRASING;
});

// Phrasing context
const PHRASING = {
  context: 'phrasing',
  parent: ['phrasing', 'flow']
};

[
   'abbr', 'audio', 'b', 'bdo', 'button', 'canvas', 'cite', 'code', 'data',
   'dfn', 'em', 'embed', 'i', 'input', 'kbd', 'label', 'mark', 'math',
   'meter', 'output', 'picture', 'progress', 'q', 'ruby', 'samp', 'small',
   'span', 'strong', 'sub', 'sup', 'time', 'var'
].forEach(function (element) {
  ELEMENT_CONTEXT[element] = PHRASING;
});

function isComponentName(elementName) {
  // Custom component names start with uppercase
  return /^[A-Z]/.test(elementName);
}

function isValidChild(parentName, childName) {
  if (!has(ELEMENT_CONTEXT, parentName)) {
    return true;
  }

  const parentContext = ELEMENT_CONTEXT[parentName].context;
  if (!has(ELEMENT_CONTEXT, childName)) {
    return parentContext !== 'text';
  }

  const allowedParent = ELEMENT_CONTEXT[childName].parent;

  if (typeof allowedParent === 'string') {
    return parentContext === allowedParent;
  } else {
    return allowedParent.indexOf(parentContext) > -1;
  }
}

function errorMessage(parentName, elementName) {
  return `Invalid DOM elements hierarchy: <${elementName}>\
 cannot be a child of <${parentName}>.`;
}

const SKIP_PARENT_TYPES = [
  'LogicalExpression', 'ConditionalExpression', 'ReturnStatement',
  'BlockStatement', 'FunctionExpression', 'JSXExpressionContainer',
  'ArrowFunctionExpression'
];

function findParentName(node, utils) {
  node = node.parent;

  while (node) {
    // skip things which aren't parents
    if (SKIP_PARENT_TYPES.indexOf(node.type) > -1) {
      node = node.parent;
      continue;
    }

    // skip map expressions
    if (node.type === 'CallExpression'
      && node.callee.type === 'MemberExpression'
      && node.callee.property.type === 'Identifier'
      && node.callee.property.name === 'map') {
      node = node.parent;
      continue;
    }

    if (node.type === 'JSXElement') {
      return node.openingElement.name.name;
    }

    if (node.type === 'CallExpression') {
      return getCallElementName(node, utils);
    }

    return;
  }
}

function getCallElementName(node, utils) {
  if (!node || node.type !== 'CallExpression') {
    return;
  }

  if (node.callee.type !== 'MemberExpression' && node.callee.type !== 'Identifier') {
    return;
  }

  if (!utils.isCreateElement(node)) {
    return;
  }

  const args = node.arguments;

  // React.createElement() should not crash linter
  // also ignore React.createElement(CustomElement)
  if (args.length < 1 || args[0].type !== 'Literal') {
    return;
  }

  return args[0].value;
}

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'Prevent invalid table hierarchy.',
      category: 'Best Practices',
      recommended: false,
      url: docsUrl('valid-table-hierarchy')
    },
    schema: []
  },
  create: Components.detect((context, components, utils) => ({
    JSXElement(node) {
      const childName = node.openingElement.name.name;
      const parentName = findParentName(node, utils);
      if (!parentName || isComponentName(parentName) || isComponentName(childName)) {
        return;
      }

      if (!isValidChild(parentName, childName)) {
        // e.g. <br children="Foo" />
        context.report({
          node,
          message: errorMessage(parentName, childName)
        });
      }
    },

    CallExpression(node) {
      const elementName = getCallElementName(node, utils);
      const parentName = findParentName(node, utils);
      if (!elementName || !parentName) {
        return;
      }

      if (!isValidChild(parentName, elementName)) {
        // e.g. <br children="Foo" />
        context.report({
          node,
          message: errorMessage(parentName, elementName)
        });
      }
    }
  }))
};
