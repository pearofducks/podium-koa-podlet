# @podium/koa-podlet

Koa plugin for @podium/podlet.

Module for building [@podium/podlet] servers with [Koa]. For writing podlets,
please see the [Podium documentation].

## Installation

```bash
$ npm install @podium/koa-podlet
```

## Requirements

This module requires Koa v2.0.0 or newer.

## Simple usage

Build a simple podlet server:

```js
const { KoaPodlet } = require('@podium/koa-podlet');
const Koa = require('koa');
const _ = require('koa-route');
const Podlet = require('@podium/podlet');

const app = Koa();

const podlet = new Podlet({
    pathname: '/',
    version: '2.0.0',
    name: 'podletContent',
});

app.use(KoaPodlet(podlet));

const contentRoute = _.get(podlet.content(), async ctx => {
    if (ctx.state.podium.context.locale === 'nb-NO') {
        ctx.podiumSend('<h2>Hei verden</h2>');
        return;
    }
    ctx.podiumSend('<h2>Hello world</h2>');
});

app.use(contentRoute);

const manifestRoute = _.get(podlet.manifest(), async ctx => {
    ctx.body = podlet;
});

app.use(manifestRoute);

const start = () => {
  try {
    const server = app.listen(7100)
    console.log(`server listening on ${server.address().port}`)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
};
start();
```

## Register plugin

The middleware is registered by passing an instance of the [@podium/podlet] class
to the middleware, and then registering that with Koa through `.use()`.

```js
app.use(KoaPodlet(podlet));
```

## Request params

On each request [@podium/podlet] will run a set of operations, such as
deserialization of the [@podium/context], on the request. When doing so
[@podium/podlet] will write parameters to `ctx.state.podium` which is
accessible inside a request handler.

```js
const contentRoute = _.get(podlet.content(), async (ctx) => {
    if (ctx.state.podium.context.locale === 'nb-NO') {
        ctx.podiumSend('<h2>Hei verden</h2>');
        return;
    }
    ctx.podiumSend('<h2>Hello world</h2>');
});
app.use(contentRoute);
```

## ctx.podiumSend(fragment)

When in development mode this method will wrap the provided fragment in a
default HTML document before dispatching. When not in development mode, this
method will just dispatch the fragment.

See [development mode] for further information.
