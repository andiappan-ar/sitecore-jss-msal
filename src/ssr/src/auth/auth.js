/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

var express = require("express");
var msal = require("@azure/msal-node");
require("dotenv").config();
var path = require("path");
const cookieLib = require('../lib/cookie');

// const app = express();
// app.use(express.static("src/"));
// app.set('view-engine', 'ejs');

var {
  msalConfig,
  REDIRECT_URI,
  POST_LOGOUT_REDIRECT_URI,
} = require("./authConfig");

const router = express.Router();
const msalInstance = new msal.ConfidentialClientApplication(msalConfig);
const cryptoProvider = new msal.CryptoProvider();

/**
 * Prepares the auth code request parameters and initiates the first leg of auth code flow
 * @param req: Express request object
 * @param res: Express response object
 * @param next: Express next function
 * @param authCodeUrlRequestParams: parameters for requesting an auth code url
 * @param authCodeRequestParams: parameters for requesting tokens using auth code
 */
async function redirectToAuthCodeUrl(
  req,
  res,
  next,
  authCodeUrlRequestParams,
  authCodeRequestParams
) {
  // Generate PKCE Codes before starting the authorization flow
  const { verifier, challenge } = await cryptoProvider.generatePkceCodes();

  // Set generated PKCE codes and method as session vars
  req.session.pkceCodes = {
    challengeMethod: "S256",
    verifier: verifier,
    challenge: challenge,
  };

  /**
   * By manipulating the request objects below before each request, we can obtain
   * auth artifacts with desired claims. For more information, visit:
   * https://azuread.github.io/microsoft-authentication-library-for-js/ref/modules/_azure_msal_node.html#authorizationurlrequest
   * https://azuread.github.io/microsoft-authentication-library-for-js/ref/modules/_azure_msal_node.html#authorizationcoderequest
   **/

  req.session.authCodeUrlRequest = {
    redirectUri: REDIRECT_URI,
    responseMode: "form_post", // recommended for confidential clients
    codeChallenge: req.session.pkceCodes.challenge,
    codeChallengeMethod: req.session.pkceCodes.challengeMethod,
    ...authCodeUrlRequestParams,
  };

  req.session.authCodeRequest = {
    redirectUri: REDIRECT_URI,
    code: "",
    ...authCodeRequestParams,
  };

  // Get url to sign user in and consent to scopes needed for application
  try {
    const authCodeUrlResponse = await msalInstance.getAuthCodeUrl(
      req.session.authCodeUrlRequest
    );
    res.redirect(authCodeUrlResponse);
  } catch (error) {
    console.log("redirectToAuthCodeUrl:", error);
    res.redirect("/auth/signin");
  }
}

router.get("/signin", async function (req, res, next) {
  try {
    // create a GUID for crsf
    req.session.csrfToken = cryptoProvider.createNewGuid();

    /**
     * The MSAL Node library allows you to pass your custom state as state parameter in the Request object.
     * The state parameter can also be used to encode information of the app's state before redirect.
     * You can pass the user's state in the app, such as the page or view they were on, as input to this parameter.
     */
    const state = cryptoProvider.base64Encode(
      JSON.stringify({
        csrfToken: req.session.csrfToken,
        redirectTo:
          req?.session?.RequestedURL !== undefined ||
          req?.session?.RequestedURL !== ""
            ? req?.session?.RequestedURL
            : "/",
      })
    );

    const authCodeUrlRequestParams = {
      state: state,

      /**
       * By default, MSAL Node will add OIDC scopes to the auth code url request. For more information, visit:
       * https://docs.microsoft.com/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
       */
      scopes: [process.env.AZ_AUTHTOKEN_SCOPE],
    };

    const authCodeRequestParams = {
      /**
       * By default, MSAL Node will add OIDC scopes to the auth code request. For more information, visit:
       * https://docs.microsoft.com/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
       */
      scopes: [process.env.AZ_AUTHTOKEN_SCOPE],
    };

    // trigger the first leg of auth code flow
    return redirectToAuthCodeUrl(
      req,
      res,
      next,
      authCodeUrlRequestParams,
      authCodeRequestParams
    );
  } catch (error) {
    next(error, req, res, next);
  }
});

router.post("/redirect", async function (req, res, next) {
  if (req.body.state) {
    const state = JSON.parse(cryptoProvider.base64Decode(req.body.state));

    console.log("Auth.js: Req state:", state);

    var jssAT = "";

    // check if csrfToken matches
    if (state.csrfToken === req.session.csrfToken) {
      req.session.authCodeRequest.code = req.body.code; // authZ code
      req.session.authCodeRequest.codeVerifier = req.session.pkceCodes.verifier; // PKCE Code Verifier

      try {
        const tokenResponse = await msalInstance.acquireTokenByCode(
          req.session.authCodeRequest
        );

          jssAT = tokenResponse.accessToken;          
          cookieLib.setCookie(res,'jssAT', jssAT);
          req.session.isAuthenticated = true;
          
        console.log(
          ">>>>accessToken:" + JSON.stringify(req.session.accessToken)
        );
      } catch (error) {
        console.log("Auth.js: Error in generate token:", error);
      }

      console.log("stringify session:");
      console.log(JSON.stringify(req.session));
      //res.cookie('accessToken', tokenResponse.accessToken, { maxAge: Number(process.env.EXPRESS_ACCESS_TOKEN_EXPIREHOURS * 60 * 60 * 1000), httpOnly: false });
      res.redirect(state.redirectTo);
    } else {
      console.log("Auth.js: Session CSRF not match: state is=", state);
      res.redirect("/auth/signin");
    }
  } else {
    console.log("Auth.js: Req state missing:", error);
    res.redirect("/auth/signin");
  }
});

router.get("/signout", function (req, res) {
  try {
    /**
     * Construct a logout URI and redirect the user to end the
     * session with Azure AD. For more information, visit:
     * https://docs.microsoft.com/azure/active-directory/develop/v2-protocols-oidc#send-a-sign-out-request
     */
    const logoutUri = `${msalConfig.auth.authority}/oauth2/v2.0/logout?post_logout_redirect_uri=${POST_LOGOUT_REDIRECT_URI}`;

    req.session.destroy(() => {
      res.redirect(logoutUri);
    });
  } catch (error) {
    next(error, req, res, next);
  }
});

//************** JIN's updates for the global error handling ******************
router.get("/*", function (req, res) {
  next("undefined router", req, res, next);
});

module.exports = router;
