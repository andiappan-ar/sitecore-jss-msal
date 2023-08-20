# Sitecore layout service Azure AD authentication & validation 

# 📝 Introduction

**This repository is a sample project for authenticating & validating SItecore layout services**, you can follow the instruction to achieve the results.

# ✋ Techs invloved
* Sitecore CM/CD – XM/Cloud/XP for the
* Rendering host – SSR node headless proxy
* Azure AD
* User authentication using MSAL node js Library
* Server-side token validation using Microsoft identity.

# 💡Solution
When the user initiates a request to the headless website aka rendering-host. This rendering-host has an MSAL library that allows the user to authenticate and get an access token.
This access token is attached in the request header of the layout service call.
Now Sitecore backend will validate the access token present in the request header.
Validated requests will serve the requested page JSON and non-validated requests will serve the 404-page JSON.

![sitecore-jss-msal-auth-flow - andisitecore](https://github.com/andiappan-ar/sitecore-jss-msal/assets/11770345/8009d52d-4934-46a0-b262-aca56b945d53)


# Enable Azure AD authentication in rendering-host using MSAL library
> Refernce detailed blog here: https://andisitecore.wordpress.com/2023/05/13/sitecore-headless-javascriptservices-authenticate-using-msal-library-part1authentication/

Please do these changes on top your running rendering-host node js.

## 🔧 Setup rendering host

### env file setup

Change your env files sitecore & azure configurations
```sh
SITECORE_JSS_APP_NAME=your-appname
SITECORE_JSS_SERVER_BUNDLE='../dist/your-appname/server.bundle'
SITECORE_API_HOST=https://your-appname.com/
SITECORE_API_KEY={APIKEY}
SITECORE_LAYOUT_SERVICE_ROUTE=
SITECORE_PATH_REWRITE_EXCLUDE_ROUTES=
SITECORE_ENABLE_DEBUG=
PORT=4000
AZ_ENABLE_AUTH=true
AZ_CLOUD_INSTANCE="https://login.microsoftonline.com/"
AZ_TENANT_ID="AZURE_TENANT_ID"
AZ_CLIENT_ID="AZURE_CLIENT_ID"
AZ_CLIENT_SECRET="AZURE_CLIENT_SECRET"
AZ_REDIRECT_URI="http://localhost:4000/auth/redirect"
AZ_POST_LOGOUT_REDIRECT_URI="http://localhost:4000/"
AZ_AUTHTOKEN_SCOPE=""
EXPRESS_SESSION_SECRET="EXPRESS_SESSION_SECRET"
EXPRESS_SESSION_TIMEOUT_MS=7200000
```
### Auth folder setup
Next, go to the index.ts file and make these changes. Add the below lines after the lines of server static apps,

```
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
```

### Configure start/build command in package.json

Since we are using js files in the template, we have to change the package.json start and build commands. Follow as below,

```
"scripts": {
  "start": "nodemon ./src/index.js",
  "build": "npx tsc"
}
```



### Configure tsconfig.json
Get the tsconfig.json from the repo & paste it into your solution. This is to allow compiling the javascript files.

https://github.com/andiappan-ar/sitecore-jss-msal/blob/main/src/ssr/tsconfig.json

## ▶️ Run the rendering host

```
> npm run build
> npm run start

```
Below screen shot explained the flows with the help of logs.

![image](https://github.com/andiappan-ar/sitecore-jss-msal/assets/11770345/2fd3f0d0-3988-47db-83ec-96dff8ea8837)


1. User requesting page. The requested URL is http://localhost:4000/
2. Code logic tries to validate the user & redirect to the login page login.microsoft.com
3. Post user login, Control returns back to the website http://localhost:4000/redirect. Now auth layer is able to get the access token & save it in the session cookie.
4. User authentication is validated.
5. Layet service is get called and it’s returning the layout service response.


# Validate layout service access token from Sitecore CD/CM
> Refernce detailed blog here: https://andisitecore.wordpress.com/2023/05/13/sitecore-headless-javascriptservices-authenticate-using-msal-library-part1authentication/

## ✋ Configure Azure AD details
Configure below AD details in the app config > [src/platform/Foundation/Security/YourProjectName.Foundation.Security/App_Config/Include/Foundation/Foundation.Security.config](https://github.com/andiappan-ar/sitecore-jss-msal/blob/main/src/platform/Foundation/Security/YourProjectName.Foundation.Security/App_Config/Include/Foundation/Foundation.Security.config)
```
      <setting name="YourProjectName.Foundation.Security.AzureAuthorizationEnabled" value="true" />
			<setting name="YourProjectName.Foundation.Security.AzureAudience" value="AzureAudience" />
			<setting name="YourProjectName.Foundation.Security.ValidateAudience" value="true" />
			<setting name="YourProjectName.Foundation.Security.AzureClientId" value="AzureClientId" />
			<setting name="YourProjectName.Foundation.Security.AzureTenantId" value="AzureTenantId" />
			<setting name="YourProjectName.Foundation.Security.AzureAuthority" value="https://login.microsoftonline.com/AzureTenantId/v2.0" />	
```
## ✋ Configure Unauthorized sitecore page
Configure un authorized page under your sitecore start item. Example: sitecore/yourJSStenant/yourJSSwebsite/home/UnAuthorizedPage

Note: If you want to change unauthorized action URL or logics , you can find code from the pipeline(https://github.com/andiappan-ar/sitecore-jss-msal/blob/main/src/platform/Foundation/Security/YourProjectName.Foundation.Security/Pipelines/AuthorizeContextItemResolver.cs)

## 🔧 Deploy layout service authentication pipeline
Deploy the pipleine code and config in your sitecore backend.

## ▶️ Hit the layout service

Hit the layout service,
* If no Authorization header present , layout service will serve unauthorized page JSON.
* If invalid token present in the header, layout service will serve unauthorized page JSON.
* If valid token present in the header layout service will give the respective page results.
