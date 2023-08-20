import express from 'express';
import compression from 'compression';
import 'dotenv/config';
import scProxy from '@sitecore-jss/sitecore-jss-proxy';
import { config } from './config';
//import { cacheMiddleware } from './cacheMiddleware';

const server = express();
const port = process.env.PORT || 3000;

// enable gzip compression for appropriate file types
server.use(compression());

// turn off x-powered-by http header
server.settings['x-powered-by'] = false;

// Serve static app assets from local /dist folder
server.use(
  '/dist',
  express.static('dist', {
    fallthrough: false, // force 404 for unknown assets under /dist
  })
);

/*
Auth codes
*/
if (process.env.AZ_ENABLE_AUTH === 'true') {
  console.log('===============>>>>> AUTH Enabled');

  var cookieParser = require('cookie-parser');
  var authRouter = require('./auth/auth');
  //var session = require('express-session');
  var cookieSession = require('cookie-session')

  /**
   * Using express-session middleware for persistent user session. Be sure to
   * familiarize yourself with available options. Visit: https://www.npmjs.com/package/express-session
   */
  server.set('trust proxy', 1);
  //server.enable('trust proxy');
  server.use(
    cookieSession({
      keys: [process.env.EXPRESS_SESSION_SECRET],
      name: 'jssConnect.sid',      
      httpOnly:true,      
      maxAge:Number(process.env.EXPRESS_SESSION_TIMEOUT_MS||7200000)
    })
  );

  server.use(express.json());
  server.use(cookieParser());
  server.use(express.urlencoded({ extended: false }));  

  server.all('*', function (req: any, res, next:any) {
    try {
      console.log('===============>>>>> Middleware called');
      
      if (req.url.includes('/auth/signin') || req.url.includes('/auth/redirect') || req.url.includes('/auth/getSessionLogger')) {
        console.log('--------- AUTH INPROGRESS');
      }
      else
      {
        if (req?.session?.isAuthenticated) {
          console.log('✔✔✔✔✔✔✔✔✔✔ USER AUTHENTICATED');
        }
        else {
          req.session.RequestedURL = req.url !== '/auth/signout' ? req.url : '/';
          console.log('xxxxxxxxxx USER NOT AUTHENTICATED : ' + 'RequestedURL=' + req.url);
          return res.redirect('/auth/signin');
        }
      }
       
      next();
    } catch (error) {
      res.redirect('/auth/globalerror?gloerr='+JSON.stringify(error));
    }
  });
  server.use('/auth', authRouter);
}
else {
  console.log('===============>>>>> AUTHENTICATION SETTINGS Disabled');
}

/*
Auth codes
*/


/**
 * Output caching, can be enabled,
 * Read about restrictions here: {@link https://doc.sitecore.com/xp/en/developers/hd/210/sitecore-headless-development/caching-in-headless-server-side-rendering-mode.html}
 */
//server.use(cacheMiddleware());

server.use((req, _res, next) => {
  // because this is a proxy, all headers are forwarded on to the Sitecore server
  // but, if we SSR we only understand how to decompress gzip and deflate. Some
  // modern browsers would send 'br' (brotli) as well, and if the Sitecore server
  // supported that (maybe via CDN) it would fail SSR as we can't decode the Brotli
  // response. So, we force the accept-encoding header to only include what we can understand.
  if (req.headers['accept-encoding']) {
    req.headers['accept-encoding'] = 'gzip, deflate';
  }

  next();
});

// For any other requests, we render app routes server-side and return them
server.use('*', scProxy(config.serverBundle.renderView, config, config.serverBundle.parseRouteUrl));

server.listen(port, () => {
  console.log(`server listening on port ${port}!`);
});
