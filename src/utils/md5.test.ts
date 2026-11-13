import test from 'node:test';
import assert from 'node:assert/strict';
import { md5Text } from './md5';

test('md5Text matches official RFC 1321 test vectors', () => {
  assert.equal(md5Text(''), 'd41d8cd98f00b204e9800998ecf8427e');
  assert.equal(md5Text('a'), '0cc175b9c0f1b6a831c399e269772661');
  assert.equal(md5Text('abc'), '900150983cd24fb0d6963f7d28e17f72');
  assert.equal(md5Text('message digest'), 'f96b697d7cb7938d525a2f31aaf161d0');
  assert.equal(md5Text('abcdefghijklmnopqrstuvwxyz'), 'c3fcd3d76192e4007dfb496cca67e13b');
});
