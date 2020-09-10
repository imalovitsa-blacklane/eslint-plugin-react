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

const VALID_CHILDREN = {
  table: /^(?:thead|tbody|tfoot|tr)$/,
  thead: /^tr$/,
  tbody: /^tr$/,
  tfoot: /^tr$/,
  tr: /^(?:td|th)$/
};

const VALID_PARENTS = {
  thead: /^table$/,
  tbody: /^table$/,
  tfoot: /^table$/,
  tr: /^(?:table|thead|tbody|tfoot)$/,
  td: /^tr$/,
  th: /^tr$/
};

function isComponentName(elementName) {
  // Custom component names start with uppercase
  return /^[A-Z]/.test(elementName);
}

function isValidChild(parentName, childName) {
  if (has(VALID_CHILDREN, parentName)
    && !VALID_CHILDREN[parentName].test(childName)) {
    return false;
  }
  if (has(VALID_PARENTS, childName)
    && !VALID_PARENTS[childName].test(parentName)) {
    return false;
  }
  return true;
}

function errorMessage(parentName, elementName) {
  return `Invalid table elements hierarchy <${parentName}>\
 cannot be a parent of <${elementName}>.`;
}

function getJSXParentName(node) {
  if (node.parent && node.parent.type === 'JSXElement') {
    return node.parent.openingElement.name.name;
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
      const parentName = getJSXParentName(node);
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
      const parentName = getCallElementName(node.parent, utils);
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
