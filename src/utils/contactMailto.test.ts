import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTACT_EMAIL,
  buildContactBody,
  buildContactMailtoUrl,
  buildContactSubject,
  buildGmailComposeUrl,
} from './contactMailto';

test('buildContactSubject formats subject with trimmed user name', () => {
  assert.equal(
    buildContactSubject('  Alex Perera  '),
    'New Message from NexcTool - Alex Perera'
  );
});

test('buildContactBody formats Name, Email, and Message lines accurately', () => {
  assert.equal(
    buildContactBody({
      name: ' Alex Perera ',
      email: ' alex@example.com ',
      message: ' Please add AVIF support. ',
    }),
    'Name: Alex Perera\nEmail: alex@example.com\nMessage: Please add AVIF support.'
  );
});

test('buildContactMailtoUrl builds RFC-compliant mailto URI with %20 spaces', () => {
  const url = buildContactMailtoUrl({
    name: 'Alex Perera',
    email: 'alex@example.com',
    message: 'Hello NexcTool!',
  });

  assert.ok(url.startsWith(`mailto:${CONTACT_EMAIL}?subject=`));
  assert.ok(!url.includes('+'), 'mailto URL should encode spaces as %20, not +');

  const query = url.split('?')[1];
  const params = new Map(
    query.split('&').map((pair) => {
      const [k, v] = pair.split('=');
      return [k, decodeURIComponent(v)];
    })
  );

  assert.equal(params.get('subject'), 'New Message from NexcTool - Alex Perera');
  assert.equal(
    params.get('body'),
    'Name: Alex Perera\nEmail: alex@example.com\nMessage: Hello NexcTool!'
  );
});

test('buildGmailComposeUrl builds web Gmail fallback URI for omithvidul@gmail.com', () => {
  const url = buildGmailComposeUrl({
    name: 'Alex',
    email: 'alex@example.com',
    message: 'Hi',
  });
  assert.ok(url.startsWith('https://mail.google.com/mail/?view=cm&fs=1&to=omithvidul%40gmail.com'));
  assert.ok(url.includes('su=New%20Message%20from%20NexcTool%20-%20Alex'));
});
