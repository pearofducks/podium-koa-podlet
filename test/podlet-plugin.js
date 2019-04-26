/* eslint-disable no-param-reassign */

'use strict';

const { URL } = require('url');
const Podlet = require('@podium/podlet');
const http = require('http');
const tap = require('tap');
const Koa = require('koa');
const _ = require('koa-route');
const { KoaPodlet } = require('../');

class Server {
    constructor(options = {}) {
        this.app = new Koa();
        this.server = undefined;

        const podlet = new Podlet(
            Object.assign(
                {
                    pathname: '/',
                    fallback: '/fallback',
                    version: '2.0.0',
                    name: 'podletContent',
                },
                options,
            ),
        );

        podlet.view(fragment => {
            return `## ${fragment} ##`;
        });

        podlet.defaults({
            locale: 'nb-NO',
        });

        this.app.use(KoaPodlet(podlet));

        const contentRoute = _.get(podlet.content(), async ctx => {
            if (ctx.state.podium.context.locale === 'nb-NO') {
                ctx.podiumSend('nb-NO');
                return;
            }
            if (ctx.state.podium.context.locale === 'en-NZ') {
                ctx.podiumSend('en-NZ');
                return;
            }
            ctx.podiumSend('en-US');
        });

        this.app.use(contentRoute);

        const fallbackRoute = _.get(podlet.fallback(), async ctx => {
            ctx.podiumSend('fallback');
        });

        this.app.use(fallbackRoute);

        const manifestRoute = _.get(podlet.manifest(), async ctx => {
            ctx.body = podlet;
        });

        this.app.use(manifestRoute);

        // Dummy endpoints for proxying
        const proxyTarget = _.all('/public', async ctx => {
            ctx.body = `${ctx.method} proxy target`;
        });

        this.app.use(proxyTarget);

        // Proxy to the dummy endpoints
        podlet.proxy({ target: '/public', name: 'localApi' });
    }

    listen() {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen();
                const address = this.server.address();
                const url = `http://localhost:${address.port}`;
                resolve(url);
            } catch (err) {
                reject(err);
            }
        });
    }

    close() {
        return new Promise(resolve => {
            this.server.close(() => {
                resolve();
            });
        });
    }
}

const request = (
    { pathname = '/', address = '', headers = {}, method = 'GET' } = {},
    payload,
) => {
    return new Promise((resolve, reject) => {
        const url = new URL(pathname, address);

        if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
            headers = Object.assign(headers, {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(payload),
            });
        }

        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            headers,
            method,
        };

        const req = http
            .request(options, res => {
                const chunks = [];
                res.on('data', chunk => {
                    chunks.push(chunk);
                });
                res.on('end', () => {
                    resolve({
                        headers: res.headers,
                        body: chunks.join(''),
                    });
                });
            })
            .on('error', error => {
                reject(error);
            });

        if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
            req.write(payload);
        }

        req.end();
    });
};

tap.test(
    'request "manifest" url - should return content of "manifest" url',
    async t => {
        const server = new Server();
        const address = await server.listen();
        const result = await request({ address, pathname: '/manifest.json' });
        const parsed = JSON.parse(result.body);

        t.equal(parsed.version, '2.0.0');
        t.equal(parsed.fallback, '/fallback');
        t.equal(parsed.content, '/');
        t.equal(parsed.name, 'podletContent');

        await server.close();
        t.end();
    },
);

tap.test(
    'request "content" url - development: false - should return default content of "content" url',
    async t => {
        const server = new Server({ development: false });
        const address = await server.listen();
        const result = await request({ address });

        t.equal(result.body, 'en-US');

        await server.close();
        t.end();
    },
);

tap.test(
    'request "content" url - development: true - should return context aware content of "content" url',
    async t => {
        const server = new Server({ development: true });
        const address = await server.listen();
        const result = await request({ address });

        t.equal(result.body, '## nb-NO ##');

        await server.close();
        t.end();
    },
);

tap.test(
    'request "content" url - development: true - should return development mode decorated content of "content" url',
    async t => {
        const server = new Server({ development: true });
        const address = await server.listen();
        const result = await request({ address });

        t.equal(result.body, '## nb-NO ##');

        await server.close();
        t.end();
    },
);

tap.test(
    'request "fallback" url - development: false - should return content of "fallback" url',
    async t => {
        const server = new Server();
        const address = await server.listen();
        const result = await request({ address, pathname: '/fallback' });

        t.equal(result.body, 'fallback');

        await server.close();
        t.end();
    },
);

tap.test(
    'request "fallback" url - development: false - should return development mode decorated content of "fallback" url',
    async t => {
        const server = new Server({ development: true });
        const address = await server.listen();
        const result = await request({ address, pathname: '/fallback' });

        t.equal(result.body, '## fallback ##');

        await server.close();
        t.end();
    },
);

tap.test('request "manifest" url - should have version header', async t => {
    const server = new Server();
    const address = await server.listen();
    const result = await request({ address, pathname: '/manifest.json' });

    t.equal(result.headers['podlet-version'], '2.0.0');

    await server.close();
    t.end();
});

tap.test('request "content" url - should have version header', async t => {
    const server = new Server();
    const address = await server.listen();
    const result = await request({ address });

    t.equal(result.headers['podlet-version'], '2.0.0');

    await server.close();
    t.end();
});

tap.test('request "fallback" url - should have version header', async t => {
    const server = new Server();
    const address = await server.listen();
    const result = await request({ address, pathname: '/fallback' });

    t.equal(result.headers['podlet-version'], '2.0.0');

    await server.close();
    t.end();
});

tap.test(
    'request "content" url - set a context parameter - should alter content of "content" url based on context',
    async t => {
        const server = new Server();
        const address = await server.listen();
        const result = await request({
            address,
            headers: {
                'podium-locale': 'en-NZ',
            },
        });

        t.equal(result.body, 'en-NZ');

        await server.close();
        t.end();
    },
);

tap.test(
    'GET "proxy" url - development: false - should not proxy content',
    async t => {
        const server = new Server();
        const address = await server.listen();
        const result = await request({
            address,
            pathname: '/podium-resource/podletContent/localApi',
        });

        t.equal(result.body, 'Not Found');

        await server.close();
        t.end();
    },
);

tap.test(
    'GET "proxy" url - development: true - should proxy content',
    async t => {
        const server = new Server({ development: true });
        const address = await server.listen();
        const result = await request({
            address,
            pathname: '/podium-resource/podletContent/localApi',
        });

        t.equal(result.body, 'GET proxy target');

        await server.close();
        t.end();
    },
);

tap.test(
    'GET "proxy" url - development: true - should have version header',
    async t => {
        const server = new Server({ development: true });
        const address = await server.listen();
        const result = await request({
            address,
            pathname: '/podium-resource/podletContent/localApi',
        });

        t.equal(result.headers['podlet-version'], '2.0.0');

        await server.close();
        t.end();
    },
);

tap.test(
    'POST to "proxy" url - development: true - should proxy content',
    async t => {
        const server = new Server({ development: true });
        const address = await server.listen();
        const result = await request(
            {
                address,
                method: 'POST',
                pathname: '/podium-resource/podletContent/localApi',
            },
            'payload',
        );

        t.equal(result.body, 'POST proxy target');

        await server.close();
        t.end();
    },
);

tap.test(
    'PUT to "proxy" url - development: true - should proxy content',
    async t => {
        const server = new Server({ development: true });
        const address = await server.listen();
        const result = await request(
            {
                address,
                method: 'PUT',
                pathname: '/podium-resource/podletContent/localApi',
            },
            'payload',
        );

        t.equal(result.body, 'PUT proxy target');

        await server.close();
        t.end();
    },
);
