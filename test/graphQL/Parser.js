import assert from '../assert';
import {List, Map} from 'immutable';
import {GQLRoot, GQLNode, GQLLeaf} from '../../graphQL/AST';
import Parser from '../../graphQL/Parser';

describe('Parser', () => {
  it('Should be able to parse', () => {
    let query = `
      node(type: Micropost, id: f2f7fb49-3581-4caa-b84b-e9489eb47d84) {
        text,
        createdAt,
        author { handle, }
    }`;
    let expected = new GQLRoot({
      name: 'node',
      parameters: Map({
        type: 'Micropost',
        id: 'f2f7fb49-3581-4caa-b84b-e9489eb47d84',
      }),
      children: List([
        new GQLLeaf({ name: 'text' }),
        new GQLLeaf({ name: 'createdAt' }),
        new GQLNode({
          name: 'author',
          calls: List(),
          children: List([
            new GQLLeaf({ name: 'handle' }),
          ]),
        }),
      ]),
    });

    assert.oequal(Parser.parse(query), expected);
  });

  it('Should be able to parse root calls without parameters', () => {
    let query = 'schema() { types }';
    let expected = new GQLRoot({
      name: 'schema',
      parameters: Map(),
      children: List([
        new GQLLeaf({ name: 'types' }),
      ]),
    });

    assert.oequal(Parser.parse(query), expected);
  });

  it('Should be able to parse root calls with parameters', () => {
    let query = 'nodes(type: Micropost, after: 5, first: 10) { text, }';
    let expected = new GQLRoot({
      name: 'nodes',
      parameters: Map({
        type: 'Micropost',
        after: '5',
        first: '10',
      }),
      children: List([
        new GQLLeaf({ name: 'text'}),
      ]),
    });

    assert.oequal(Parser.parse(query), expected);
  });

  it('Should be able to parse calls in children', () => {
    let query = `
      node(type: Micropost, id: f2f7fb49-3581-4caa-b84b-e9489eb47d84) {
        microposts(first: 10) {
          count
        }
      }
    `;
    let expected = new GQLNode({
      name: 'microposts',
      parameters: Map({
        first: '10',
      }),
      children: List([
        new GQLLeaf({ name: 'count'}),
      ]),
    });

    assert.oequal(Parser.parse(query).children.first(), expected);
  });

  it('Should be able to parse aliases', () => {
    let query = `
      nodes(type: Micropost) as frobar {
        objects(first: 10) as foobar {
          nodes {
            text as textName,
            author as who {
              handle as nick
            }
          }
        }
      }
    `;
    let expected = List.of(new GQLNode({
      name: 'objects',
      alias: 'foobar',
      parameters: Map({
        first: '10',
      }),
      children: List([
        new GQLNode({
          name: 'nodes',
          children: List([
            new GQLLeaf({
              name: 'text',
              alias: 'textName',
            }),
            new GQLNode({
              name: 'author',
              alias: 'who',
              children: List([
                new GQLLeaf({
                  name: 'handle',
                  alias: 'nick',
                }),
              ]),
            }),
          ]),
        }),
      ]),
    }));
    let result = Parser.parse(query);

    assert.oequal(result.children, expected);
    assert.oequal(result.alias, 'frobar');
  });

  it('Should be able to parse escapes', () => {
    let query = `
      insert(type: Micropost,
             data: \\{"data": "\\stuff\\\\f"\\},
             otherData: \\[1\\, 2\\, 3\\],
             thirdData: \\(randomStuffInsideBrackets\\)) {
        changes {
          count
        }
      }
    `;
    let expected = Map({
      type: 'Micropost',
      data: '{"data": "stuff\\f"}',
      otherData: '[1, 2, 3]',
      thirdData: '(randomStuffInsideBrackets)',
    });
    let result = Parser.parse(query).parameters;

    assert.oequal(result, expected);
  });

  it('Should fail when special characters are not escaped', () => {
    let queries = [
      `curlyBrackets(fail: {"data": "stuff"}) { test }`,
      `roundBrackets(fail: (erronneusStuff)) { test }`,
      `squareBrackets(fail: [1, 2, 3]) {test}`,
      `comma(fail: "some,StuffWithcomma", more: 123) { test }`,
    ];

    let parse = (query) => {
      return () => {
        Parser.parse(query);
      };
    };

    for (let query of queries) {
      assert.throws(parse(query));
    }
  });

  it('Should fail when empty block is passed', () => {
    assert.throws(() => {
      Parser.parse(`
        nodes() {
          foo {
          }
        }`
      );
    });
  });
});
