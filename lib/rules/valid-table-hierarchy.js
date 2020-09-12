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

const HTML_ELEMENT_CONTEXT = {
  // top level elements
  html: { context: 'html', parent: [] },
  head: { context: 'head', parent: 'html' },
  title: { context: 'text', parent: 'head' },
  style: { context: 'text', parent: 'head' },
  script: { context: 'text', parent: ['flow', 'phrasing', 'head'] },
  link: { context: 'void', parent: 'head' },
  meta: { context: 'void', parent: 'head' },
  base: { context: 'void', parent: 'head' },
  body: { context: 'flow', parent: 'html' },
  // table elements
  table: { context: 'table', parent: 'flow' },
  caption: { context: 'text', parent: 'table' },
  colgroup: { context: 'table-colgroup', parent: 'table' },
  col: { context: 'void', parent: 'table-colgroup' },
  thead: { context: 'table-section', parent: 'table' },
  tbody: { context: 'table-section', parent: 'table' },
  tfoot: { context: 'table-section', parent: 'table' },
  tr: { context: 'tr', parent: ['table', 'table-section'] },
  th: { context: 'flow', parent: 'tr' },
  td: { context: 'flow', parent: 'tr' },
  // most of the special elements
  p: { context: 'phrasing', parent: 'flow' },
  div: { context: 'flow', parent: 'flow' },
  select: { context: 'select', parent: 'flow' },
  optgroup: { context: 'optgroup', parent: 'select' },
  option: { context: 'text', parent: ['optgroup', 'select'] },
  textarea: { context: 'text', parent: ['phrasing', 'flow'] },
  hr: { context: 'void', parent: 'flow' },
  picture: { context: 'picture', parent: ['phrasing', 'flow'] },
  video: { context: 'video', parent: ['phrasing', 'flow'] },
  audio: { context: 'audio', parent: ['phrasing', 'flow'] },
  track: { context: 'void', parent: ['audio', 'video'] },
  source: { context: 'void', parent: ['audio', 'video', 'picture'] },
  img: { context: 'void', parent: ['phrasing', 'flow', 'picture'] }
};

// headers
const HEADING_CONTEXT = { context: 'phrasing', parent: 'flow' };
['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(function(element) {
  HTML_ELEMENT_CONTEXT[element] = HEADING_CONTEXT;
});

// Void elements
const VOID_PHRASING = { context: 'void', parent: ['phrasing', 'flow'] };
[
   'area', 'br', 'embed', 'input', 'keygen', 'menuitem', 'param', 'wbr'
].forEach(function (element) {
  HTML_ELEMENT_CONTEXT[element] = VOID_PHRASING;
});

// Phrasing context
const PHRASING = { context: 'phrasing', parent: ['phrasing', 'flow'] };

[
   'abbr', 'b', 'bdo', 'button', 'canvas', 'cite', 'code', 'data',
   'dfn', 'em', 'embed', 'i', 'input', 'kbd', 'label', 'mark', 'math',
   'meter', 'output', 'progress', 'q', 'ruby', 'samp', 'small',
   'span', 'strong', 'sub', 'sup', 'time', 'var'
].forEach(function (element) {
  HTML_ELEMENT_CONTEXT[element] = PHRASING;
});

const isValidChild = (dict) => (parentName, childName) => {
  if (!has(dict, parentName)) {
    return 'maybe';
  }

  const parentContext = dict[parentName].context;

  if (parentContext.context === 'void') {
    return false;
  }

  if (!has(dict, childName)) {
    return 'maybe';
  }

  const allowedParent = dict[childName].parent;

  if (typeof allowedParent === 'string') {
    return parentContext === allowedParent;
  } else {
    return allowedParent.indexOf(parentContext) > -1;
  }
};

const isValidHTMLChild = isValidChild(HTML_ELEMENT_CONTEXT);

function errorMessage(parentName, elementName) {
  return `Invalid DOM elements hierarchy: <${elementName}>\
 is not a valid child of <${parentName}>.`;
}

const SKIP_PARENT_TYPES = [
  'LogicalExpression', 'ConditionalExpression', 'ReturnStatement',
  'BlockStatement', 'FunctionExpression', 'JSXExpressionContainer',
  'ArrowFunctionExpression'
];

function findParentName(node, utils) {
  node = node.parent;

  while (node) {
    // skip things which aren't important
    if (SKIP_PARENT_TYPES.indexOf(node.type) > -1) {
      node = node.parent;
      continue;
    }

    // skip parent map expressions
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
      if (!parentName) {
        return;
      }

      if (!isValidHTMLChild(parentName, childName)) {
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

      if (!isValidHTMLChild(parentName, elementName)) {
        context.report({
          node,
          message: errorMessage(parentName, elementName)
        });
      }
    }
  }))
};
