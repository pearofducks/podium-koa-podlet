'use strict';

const utils = require('@podium/utils');
const pathRegex = require('path-to-regexp');

const KoaPodlet = podlet => {
    const pathname = utils.pathnameBuilder(
        podlet.httpProxy.pathname,
        podlet.httpProxy.prefix,
        '/(.*)',
    );
    const proxyRegex = pathRegex(pathname);

    return async (ctx, next) => {
        const incoming = new utils.HttpIncoming(
            ctx.req,
            ctx.res,
            ctx.state.params,
        );
        ctx.state.podium = await podlet.process(incoming);

        ctx.set('podlet-version', podlet.version);

        ctx.app.context.podiumSend = payload => {
            ctx.type = 'text/html';
            ctx.body = ctx.state.podium.render(payload);
        };

        const match = proxyRegex.exec(ctx.path);
        // proxy
        if (match) {
            const proxyIncoming = await podlet.httpProxy.process(
                ctx.state.podium,
            );

            // the proxy didn't hit, continue
            if (proxyIncoming) {
                await next();
            }
        } else {
            // don't proxy, just move on
            await next();
        }
    };
};

module.exports = { KoaPodlet };
